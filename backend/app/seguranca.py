import hashlib
import secrets

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from .models import Usuario


def gerar_hash(senha: str) -> str:
    sal = secrets.token_hex(16)
    chave = hashlib.pbkdf2_hmac("sha256", senha.encode(), sal.encode(), 120_000)
    return f"{sal}${chave.hex()}"


def conferir_senha(senha: str, senha_hash: str) -> bool:
    try:
        sal, chave = senha_hash.split("$", 1)
    except ValueError:
        return False
    calculada = hashlib.pbkdf2_hmac("sha256", senha.encode(), sal.encode(), 120_000).hex()
    return secrets.compare_digest(calculada, chave)


def usuario_logado(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Usuario:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Faça login para continuar")
    token = authorization.split(" ", 1)[1].strip()
    usuario = db.query(Usuario).filter(Usuario.token == token).first()
    if not usuario:
        raise HTTPException(status_code=401, detail="Sessão inválida")
    return usuario
