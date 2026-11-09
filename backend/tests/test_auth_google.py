from fastapi.testclient import TestClient

from backend.app.main import app


def test_google_route_exists_and_returns_service_error_without_client_id():
    with TestClient(app) as client:
        response = client.post('/api/auth/google', json={'credential': 'token-invalido'})
        assert response.status_code in (401, 503), response.text
