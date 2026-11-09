from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database import Sessao
from backend.app.models import SessaoUsuario, Usuario
from backend.app.seguranca import criar_sessao_para_usuario


def criar_usuario_admin():
    db = Sessao()
    try:
        usuario = db.query(Usuario).filter(Usuario.email == 'admin@rmx.store').first()
        if not usuario:
            usuario = Usuario(nome='Admin RMX', email='admin@rmx.store', senha_hash='x', role='admin')
            db.add(usuario)
            db.commit()
            db.refresh(usuario)
        else:
            usuario.role = 'admin'
            db.commit()
        token = criar_sessao_para_usuario(db, usuario)
        db.refresh(usuario)
        return token
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
        sessao = db.query(SessaoUsuario).filter(SessaoUsuario.token == 'token-cliente-test').first()
        if not sessao:
            db.add(SessaoUsuario(
                usuario_id=usuario.id,
                token='token-cliente-test',
                criado_em=datetime.now(timezone.utc),
                expira_em=datetime.now(timezone.utc) + timedelta(hours=2),
                revogado=False,
            ))
            db.commit()
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


def test_login_retorna_role_do_usuario():
    client = TestClient(app)
    payload = {'nome': 'Usuario Papel', 'email': 'papel@rmx.store', 'senha': '123456'}

    response = client.post('/api/auth/registrar', json=payload)

    assert response.status_code == 200, response.text
    dados = response.json()
    assert 'role' in dados
    assert dados['role'] in {'user', 'admin'}


def test_sessao_expirada_e_rejeitada():
    db = Sessao()
    try:
        token = 'token-expirado-unique'
        db.query(SessaoUsuario).filter(SessaoUsuario.token == token).delete()

        usuario = db.query(Usuario).filter(Usuario.email == 'expirado@rmx.store').first()
        if not usuario:
            usuario = Usuario(
                nome='Usuário Expirado',
                email='expirado@rmx.store',
                senha_hash='x',
                token=token,
                role='user',
                ativo=True,
            )
            db.add(usuario)
            db.commit()
            db.refresh(usuario)
        else:
            usuario.token = token
            usuario.role = 'user'
            usuario.ativo = True
            db.commit()

        db.add(SessaoUsuario(
            usuario_id=usuario.id,
            token=token,
            criado_em=datetime.now(timezone.utc) - timedelta(hours=3),
            expira_em=datetime.now(timezone.utc) - timedelta(minutes=1),
            revogado=False,
        ))
        db.commit()
    finally:
        db.close()

    response = TestClient(app).get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})

    assert response.status_code == 401, response.text
