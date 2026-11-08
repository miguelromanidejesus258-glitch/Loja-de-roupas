from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .models import ItemCarrinho, Produto, Usuario
from .schemas import (
    CadastroEntrada,
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


@asynccontextmanager
async def vida_da_api(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    with Session(engine) as db:
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
    return ProdutoSaida(
        id=produto.id,
        name=produto.name,
        price=produto.price,
        image=produto.image,
        link=produto.link,
        description=produto.description,
        category=produto.category,
        categoria=produto.category,
    )


def aplicar_produto(produto: Produto, dados: ProdutoEntrada) -> None:
    produto.name = dados.name.strip()
    produto.price = dados.price.strip()
    produto.image = dados.image.strip()
    produto.link = (dados.link or "descricao.html").strip()
    produto.description = dados.description.strip()
    produto.category = (dados.category or dados.categoria or "mais-vendidos").strip()


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
