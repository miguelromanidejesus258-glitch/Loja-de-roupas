from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

PASTA_BACKEND = Path(__file__).resolve().parents[1]
ARQUIVO_DB = PASTA_BACKEND / "rmx.db"

engine = create_engine(
    f"sqlite:///{ARQUIVO_DB.as_posix()}",
    connect_args={"check_same_thread": False},
)
Sessao = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = Sessao()
    try:
        yield db
    finally:
        db.close()
