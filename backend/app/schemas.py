from pydantic import BaseModel, EmailStr, Field


class ProdutoEntrada(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    price: str = Field(min_length=1, max_length=40)
    image: str = ""
    link: str = "descricao.html"
    description: str = ""
    category: str | None = None
    categoria: str | None = None
    preco_antigo: str | None = None
    desconto: str | None = None


class ProdutoSaida(BaseModel):
    id: int
    name: str
    price: str
    image: str
    link: str
    description: str
    category: str
    categoria: str
    preco_antigo: str = ""
    desconto: str = ""


class CadastroEntrada(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    email: EmailStr
    senha: str = Field(min_length=4, max_length=80)


class LoginEntrada(BaseModel):
    email: EmailStr
    senha: str


class GoogleLoginEntrada(BaseModel):
    credential: str


class UsuarioSaida(BaseModel):
    id: int
    nome: str
    email: str
    token: str


class ItemCarrinhoEntrada(BaseModel):
    product_id: int
    quantidade: int = Field(default=1, ge=1, le=20)


class ItemCarrinhoSaida(BaseModel):
    id: int
    product_id: int
    name: str
    price: str
    image: str
    quantidade: int
