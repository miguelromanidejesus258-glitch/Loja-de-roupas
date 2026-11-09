import json
from pathlib import Path

from sqlalchemy.orm import Session

from .models import Produto, Usuario
from .seguranca import gerar_hash

RAIZ = Path(__file__).resolve().parents[2]
ARQUIVO_PRODUTOS = RAIZ / "public" / "produtos.json"
EMAIL_ADMIN = "admin@rmx.store"
SENHA_ADMIN = "admin123"


def categoria_de(item: dict) -> str:
    return (item.get("category") or item.get("categoria") or "mais-vendidos").strip()


def popular_banco(db: Session) -> None:
    if db.query(Produto).count() == 0 and ARQUIVO_PRODUTOS.exists():
        itens = json.loads(ARQUIVO_PRODUTOS.read_text(encoding="utf-8"))
        for item in itens:
            db.add(Produto(
                id=int(item["id"]),
                name=item.get("name") or item.get("nome") or "Produto",
                price=str(item.get("price") or item.get("preco") or "0,00"),
                old_price=str(item.get("old_price") or item.get("preco_antigo") or ""),
                offer_price=str(item.get("offer_price") or item.get("preco_oferta") or ""),
                is_offer=bool(item.get("is_offer") or item.get("oferta") or False),
                image=item.get("image") or item.get("imagem") or "",
                link=item.get("link") or "descricao.html",
                description=item.get("description") or item.get("descricao") or "",
                category=categoria_de(item),
            ))

    if not db.query(Usuario).filter(Usuario.email == EMAIL_ADMIN).first():
        db.add(Usuario(
            nome="Admin RMX",
            email=EMAIL_ADMIN,
            senha_hash=gerar_hash(SENHA_ADMIN),
        ))

    db.commit()
