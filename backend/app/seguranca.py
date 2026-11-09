import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from .models import SessaoUsuario, Usuario


def gerar_hash(senha: str) -> str:
    sal = secrets.token_hex(16)
    chave = hashlib.pbkdf2_hmac("sha256", senha.encode(), sal.encode(), 120_000)
    return f"{sal}${chave.hex()}"


def gerar_token_seguro() -> str:
    return secrets.token_urlsafe(32)


def criar_sessao_para_usuario(db: Session, usuario: Usuario, ttl_horas: int = 12) -> str:
    token = gerar_token_seguro()
    expiracao = datetime.now(timezone.utc) + timedelta(hours=ttl_horas)

    db.query(SessaoUsuario).filter(
        SessaoUsuario.usuario_id == usuario.id,
        SessaoUsuario.revogado.is_(False),
    ).update({"revogado": True})

    sessao = SessaoUsuario(
        usuario_id=usuario.id,
        token=token,
        expira_em=expiracao,
        revogado=False,
    )
    db.add(sessao)
    usuario.token = token
    usuario.ultima_atividade = datetime.now(timezone.utc)
    db.commit()
    return token


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
    if not token or any(char.isspace() for char in token):
        raise HTTPException(status_code=401, detail="Token inválido")

    sessao = db.query(SessaoUsuario).filter(SessaoUsuario.token == token).first()
    if not sessao or sessao.revogado or sessao.expira_em <= datetime.now(timezone.utc):
        if sessao:
            sessao.revogado = True
            db.commit()
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada")

    usuario = db.get(Usuario, sessao.usuario_id)
    if not usuario or not usuario.ativo or usuario.token != token:
        raise HTTPException(status_code=401, detail="Sessão inválida")

    usuario.ultima_atividade = datetime.now(timezone.utc)
    db.commit()
    return usuario


def usuario_admin(usuario: Usuario = Depends(usuario_logado)) -> Usuario:
    if not usuario.is_admin and usuario.email.lower() != "admin@rmx.store":
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador")
    return usuario
