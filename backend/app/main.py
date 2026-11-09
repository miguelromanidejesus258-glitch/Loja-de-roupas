import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.orm import Session

try:
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token
except Exception:  # pragma: no cover
    google_requests = None
    id_token = None

from .database import Base, engine, get_db
from .models import ItemCarrinho, Produto, Usuario
from .schemas import (
    CadastroEntrada,
    GoogleLoginEntrada,
    ItemCarrinhoEntrada,
    ItemCarrinhoSaida,
    LoginEntrada,
    ProdutoEntrada,
    ProdutoSaida,
    UsuarioSaida,
)
from .seed import popular_banco
from .seguranca import conferir_senha, gerar_hash, usuario_logado
import secrets

RAIZ = Path(__file__).resolve().parents[2]
load_dotenv(RAIZ / "backend" / ".env")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()


def garantir_colunas_usuarios(db: Session) -> None:
    try:
        colunas = db.execute(text("PRAGMA table_info(usuarios)")).fetchall()
    except Exception:
        return

    nomes = {coluna[1] for coluna in colunas}
    alteracoes = {
        "senha_hash": "ALTER TABLE usuarios ADD COLUMN senha_hash VARCHAR(200)",
        "provedor": "ALTER TABLE usuarios ADD COLUMN provedor VARCHAR(20) DEFAULT 'local'",
        "google_id": "ALTER TABLE usuarios ADD COLUMN google_id VARCHAR(120)",
        "imagem_url": "ALTER TABLE usuarios ADD COLUMN imagem_url VARCHAR(400)",
    }

    for nome, comando in alteracoes.items():
        if nome not in nomes:
            db.execute(text(comando))

    db.execute(
        text("UPDATE usuarios SET senha_hash = :valor WHERE senha_hash IS NULL"),
        {"valor": gerar_hash(secrets.token_urlsafe(24))},
    )
    db.execute(
        text("UPDATE usuarios SET provedor = 'local' WHERE provedor IS NULL OR provedor = ''"),
    )
    db.commit()


def garantir_colunas_produtos(db: Session) -> None:
    try:
        colunas = db.execute(text("PRAGMA table_info(produtos)")).fetchall()
    except Exception:
        return

    nomes = {coluna[1] for coluna in colunas}
    alteracoes = {
        "preco_antigo": "ALTER TABLE produtos ADD COLUMN preco_antigo VARCHAR(40)",
        "desconto": "ALTER TABLE produtos ADD COLUMN desconto VARCHAR(20)",
    }

    for nome, comando in alteracoes.items():
        if nome not in nomes:
            db.execute(text(comando))

    db.commit()


@asynccontextmanager
async def vida_da_api(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    with Session(engine) as db:
        garantir_colunas_usuarios(db)
        garantir_colunas_produtos(db)
        popular_banco(db)
    yield


app = FastAPI(title="RMX Store API", version="1.0.0", lifespan=vida_da_api)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def produto_publico(produto: Produto) -> ProdutoSaida:
    categoria = (produto.category or "mais-vendidos").strip() or "mais-vendidos"
    return ProdutoSaida(
        id=produto.id,
        name=produto.name,
        price=produto.price,
        image=produto.image,
        link=produto.link,
        description=produto.description,
        category=categoria,
        categoria=categoria,
        preco_antigo=produto.preco_antigo or "",
        desconto=produto.desconto or "",
    )


def aplicar_produto(produto: Produto, dados: ProdutoEntrada) -> None:
    produto.name = dados.name.strip()
    produto.price = dados.price.strip()
    produto.image = dados.image.strip()
    produto.link = (dados.link or "descricao.html").strip()
    produto.description = dados.description.strip()
    produto.category = (dados.category or dados.categoria or "mais-vendidos").strip()
    produto.preco_antigo = (dados.preco_antigo or "").strip()
    produto.desconto = (dados.desconto or "").strip()


@app.get("/api/produtos", response_model=list[ProdutoSaida])
def listar_produtos(db: Session = Depends(get_db)):
    produtos = db.query(Produto).order_by(Produto.id).all()
    return [produto_publico(produto) for produto in produtos]


@app.get("/api/produtos/{produto_id}", response_model=ProdutoSaida)
def obter_produto(produto_id: int, db: Session = Depends(get_db)):
    produto = db.get(Produto, produto_id)
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return produto_publico(produto)


@app.post("/api/produtos", response_model=ProdutoSaida)
def criar_produto(
    dados: ProdutoEntrada,
    db: Session = Depends(get_db),
    _: Usuario = Depends(usuario_logado),
):
    produto = Produto()
    aplicar_produto(produto, dados)
    db.add(produto)
    db.commit()
    db.refresh(produto)
    return produto_publico(produto)


@app.put("/api/produtos/{produto_id}", response_model=ProdutoSaida)
def editar_produto(
    produto_id: int,
    dados: ProdutoEntrada,
    db: Session = Depends(get_db),
    _: Usuario = Depends(usuario_logado),
):
    produto = db.get(Produto, produto_id)
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    aplicar_produto(produto, dados)
    db.commit()
    db.refresh(produto)
    return produto_publico(produto)


@app.delete("/api/produtos/{produto_id}")
def apagar_produto(
    produto_id: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(usuario_logado),
):
    produto = db.get(Produto, produto_id)
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    db.query(ItemCarrinho).filter(ItemCarrinho.produto_id == produto_id).delete()
    db.delete(produto)
    db.commit()
    return {"ok": True}


@app.get("/api/auth/google/client-id")
def google_client_id():
    return {"client_id": GOOGLE_CLIENT_ID}


@app.post("/api/auth/google", response_model=UsuarioSaida)
def login_google(dados: GoogleLoginEntrada, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google client ID não configurado. Configure a variável GOOGLE_CLIENT_ID.")
    if not id_token or not google_requests:
        raise HTTPException(status_code=503, detail="Biblioteca de autenticação do Google indisponível.")

    try:
        info = id_token.verify_oauth2_token(dados.credential, google_requests.Request(), GOOGLE_CLIENT_ID)
    except Exception as erro:
        raise HTTPException(status_code=401, detail="Credencial do Google inválida") from erro

    email = (info.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="E-mail do Google não disponível")

    usuario = db.query(Usuario).filter(Usuario.email == email).first()
    if not usuario:
        usuario = Usuario(
            nome=(info.get("name") or info.get("given_name") or "Usuário Google").strip()[:120],
            email=email,
            senha_hash=gerar_hash(secrets.token_urlsafe(24)),
            provedor="google",
            google_id=str(info.get("sub") or ""),
            imagem_url=info.get("picture") or "",
            token=secrets.token_urlsafe(32),
        )
        db.add(usuario)
    else:
        usuario.nome = (usuario.nome or info.get("name") or "Usuário").strip()[:120]
        usuario.provedor = "google"
        usuario.google_id = usuario.google_id or str(info.get("sub") or "")
        usuario.imagem_url = usuario.imagem_url or (info.get("picture") or "")

    usuario.token = secrets.token_urlsafe(32)
    db.commit()
    db.refresh(usuario)
    return UsuarioSaida(id=usuario.id, nome=usuario.nome, email=usuario.email, token=usuario.token)


@app.post("/api/auth/registrar", response_model=UsuarioSaida)
def registrar(dados: CadastroEntrada, db: Session = Depends(get_db)):
    email = dados.email.lower().strip()
    if db.query(Usuario).filter(Usuario.email == email).first():
        raise HTTPException(status_code=409, detail="Esse e-mail já está cadastrado")
    usuario = Usuario(
        nome=dados.nome.strip(),
        email=email,
        senha_hash=gerar_hash(dados.senha),
        token=secrets.token_urlsafe(32),
        provedor="local",
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return UsuarioSaida(id=usuario.id, nome=usuario.nome, email=usuario.email, token=usuario.token)


@app.post("/api/auth/login", response_model=UsuarioSaida)
def login(dados: LoginEntrada, db: Session = Depends(get_db)):
    email = dados.email.lower().strip()
    usuario = db.query(Usuario).filter(Usuario.email == email).first()
    if not usuario or not conferir_senha(dados.senha, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")
    usuario.token = secrets.token_urlsafe(32)
    db.commit()
    return UsuarioSaida(id=usuario.id, nome=usuario.nome, email=usuario.email, token=usuario.token)


@app.get("/api/auth/me", response_model=UsuarioSaida)
def me(usuario: Usuario = Depends(usuario_logado)):
    return UsuarioSaida(id=usuario.id, nome=usuario.nome, email=usuario.email, token=usuario.token or "")


@app.get("/api/carrinho", response_model=list[ItemCarrinhoSaida])
def ver_carrinho(usuario: Usuario = Depends(usuario_logado), db: Session = Depends(get_db)):
    itens = db.query(ItemCarrinho).filter(ItemCarrinho.usuario_id == usuario.id).all()
    return [
        ItemCarrinhoSaida(
            id=item.id,
            product_id=item.produto_id,
            name=item.produto.name,
            price=item.produto.price,
            image=item.produto.image,
            quantidade=item.quantidade,
        )
        for item in itens
        if item.produto
    ]


@app.post("/api/carrinho", response_model=ItemCarrinhoSaida)
def adicionar_carrinho(
    dados: ItemCarrinhoEntrada,
    usuario: Usuario = Depends(usuario_logado),
    db: Session = Depends(get_db),
):
    produto = db.get(Produto, dados.product_id)
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    item = (
        db.query(ItemCarrinho)
        .filter(ItemCarrinho.usuario_id == usuario.id, ItemCarrinho.produto_id == produto.id)
        .first()
    )
    if item:
        item.quantidade += dados.quantidade
    else:
        item = ItemCarrinho(usuario_id=usuario.id, produto_id=produto.id, quantidade=dados.quantidade)
        db.add(item)
    db.commit()
    db.refresh(item)
    return ItemCarrinhoSaida(
        id=item.id,
        product_id=produto.id,
        name=produto.name,
        price=produto.price,
        image=produto.image,
        quantidade=item.quantidade,
    )


@app.delete("/api/carrinho/{item_id}")
def remover_carrinho(
    item_id: int,
    usuario: Usuario = Depends(usuario_logado),
    db: Session = Depends(get_db),
):
    item = db.get(ItemCarrinho, item_id)
    if not item or item.usuario_id != usuario.id:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    db.delete(item)
    db.commit()
    return {"ok": True}


@app.get("/")
def inicio():
    return RedirectResponse(url="/public/loja.html")


app.mount("/assets", StaticFiles(directory=RAIZ / "assets"), name="assets")
app.mount("/src", StaticFiles(directory=RAIZ / "src"), name="src")
app.mount("/public", StaticFiles(directory=RAIZ / "public"), name="public")
app.mount("/ico", StaticFiles(directory=RAIZ / "ico"), name="ico")
