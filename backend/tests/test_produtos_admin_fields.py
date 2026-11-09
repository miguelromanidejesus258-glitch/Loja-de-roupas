from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database import Sessao, Base, engine
from backend.app.models import Usuario


def criar_usuario_admin():
    db = Sessao()
    try:
        usuario = db.query(Usuario).filter(Usuario.email == 'admin@rmx.store').first()
        if not usuario:
            usuario = Usuario(nome='Admin RMX', email='admin@rmx.store', senha_hash='x', token='token-admin-test', role='admin')
            db.add(usuario)
            db.commit()
            db.refresh(usuario)
        else:
            usuario.token = 'token-admin-test'
            usuario.role = 'admin'
            db.commit()
        return usuario.token
    finally:
        db.close()


def test_produto_com_preco_antigo_e_desconto():
    token = criar_usuario_admin()
    client = TestClient(app)

    payload = {
        'name': 'Camisa Teste',
        'price': '89,90R$',
        'preco_antigo': '129,90R$',
        'desconto': '31%',
        'image': 'https://example.com/camisa.png',
        'description': 'Descricao teste',
        'category': 'Camisas',
    }

    response = client.post('/api/produtos', json=payload, headers={'Authorization': f'Bearer {token}'})

    assert response.status_code == 200, response.text
    dados = response.json()
    assert dados['preco_antigo'] == '129,90R$'
    assert dados['desconto'] == '31%'
    assert dados['category'] == 'Camisas'


def test_usuario_nao_admin_nao_pode_criar_produtos():
    db = Sessao()
    try:
        usuario = db.query(Usuario).filter(Usuario.email == 'cliente@rmx.store').first()
        if not usuario:
            usuario = Usuario(
                nome='Cliente RMX',
                email='cliente@rmx.store',
                senha_hash='x',
                token='token-cliente-test',
                role='user',
            )
            db.add(usuario)
            db.commit()
            db.refresh(usuario)
        else:
            usuario.token = 'token-cliente-test'
            usuario.role = 'user'
            db.commit()
        token = usuario.token
    finally:
        db.close()

    client = TestClient(app)
    payload = {
        'name': 'Produto de cliente',
        'price': '99,90R$',
        'image': 'https://example.com/cliente.png',
        'description': 'Descricao proibida',
        'category': 'Camisas',
    }

    response = client.post('/api/produtos', json=payload, headers={'Authorization': f'Bearer {token}'})

    assert response.status_code == 403, response.text
