from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    senha_hash: Mapped[str | None] = mapped_column(String(200), nullable=True)
    token: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    provedor: Mapped[str] = mapped_column(String(20), default="local", index=True)
    role: Mapped[str] = mapped_column(String(20), default="user", index=True)
    ativo: Mapped[bool] = mapped_column(default=True, index=True)
    ultima_atividade: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    google_id: Mapped[str | None] = mapped_column(String(120), nullable=True, unique=True, index=True)
    imagem_url: Mapped[str | None] = mapped_column(String(400), nullable=True)

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


class SessaoUsuario(Base):
    __tablename__ = "sessoes_usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revogado: Mapped[bool] = mapped_column(default=False, index=True)

    usuario: Mapped[Usuario] = relationship()


class Produto(Base):
    __tablename__ = "produtos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(180))
    price: Mapped[str] = mapped_column(String(40))
    image: Mapped[str] = mapped_column(String(400), default="")
    link: Mapped[str] = mapped_column(String(200), default="descricao.html")
    description: Mapped[str] = mapped_column(String(2000), default="")
    category: Mapped[str] = mapped_column(String(60), default="mais-vendidos")
    preco_antigo: Mapped[str | None] = mapped_column(String(40), nullable=True, default="")
    desconto: Mapped[str | None] = mapped_column(String(20), nullable=True, default="")


class ItemCarrinho(Base):
    __tablename__ = "carrinho"
    __table_args__ = (UniqueConstraint("usuario_id", "produto_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    produto_id: Mapped[int] = mapped_column(ForeignKey("produtos.id"))
    quantidade: Mapped[int] = mapped_column(Integer, default=1)

    produto: Mapped[Produto] = relationship()
