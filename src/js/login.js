const msg = document.getElementById('login-msg');
const grupoNome = document.getElementById('grupo-nome');
const botao = document.getElementById('btn-login');
const botaoGoogle = document.getElementById('btn-google');
const link = document.getElementById('link-cadastro');
let modoCadastro = false;

function mostrarMensagem(texto) {
  if (msg) msg.textContent = texto;
}

function salvarSessao(dados, email) {
  localStorage.setItem('rmx_token', dados.token);
  localStorage.setItem('rmx_usuario', dados.nome || email);
  window.location.href = 'loja.html';
}

link?.addEventListener('click', (evento) => {
  evento.preventDefault();
  modoCadastro = !modoCadastro;
  grupoNome.hidden = !modoCadastro;
  botao.textContent = modoCadastro ? 'Criar conta' : 'Entrar';
  link.textContent = modoCadastro ? 'Já tenho conta' : 'Cadastre-se';
  mostrarMensagem('');
});

async function autenticarLocal(email, senha, nome = '') {
  const caminho = modoCadastro ? '/api/auth/registrar' : '/api/auth/login';
  const corpo = modoCadastro ? { nome, email, senha } : { email, senha };
  botao.disabled = true;

  try {
    const resposta = await fetch(caminho, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      mostrarMensagem(dados.detail || 'Não foi possível entrar.');
      return;
    }
    salvarSessao(dados, email);
  } catch (erro) {
    mostrarMensagem('Servidor desligado. Rode a API e tente de novo.');
  } finally {
    botao.disabled = false;
  }
}

async function autenticarGoogle(credential) {
  if (!credential) {
    mostrarMensagem('Credencial do Google inválida.');
    return;
  }

  botaoGoogle.disabled = true;
  mostrarMensagem('Entrando com Google...');

  try {
    const resposta = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential })
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      mostrarMensagem(dados.detail || 'Não foi possível entrar com o Google.');
      return;
    }
    salvarSessao(dados, dados.email || 'google-user');
  } catch (erro) {
    mostrarMensagem('Não foi possível validar a conta do Google. Configure o CLIENT_ID do Google.');
  } finally {
    botaoGoogle.disabled = false;
  }
}

async function inicializarGoogle() {
  try {
    const resposta = await fetch('/api/auth/google/client-id');
    const dados = await resposta.json().catch(() => ({}));
    const clientId = dados.client_id || '';

    if (!clientId || !window.google?.accounts?.id) {
      if (botaoGoogle) {
        botaoGoogle.disabled = true;
        botaoGoogle.title = 'Google não configurado';
        botaoGoogle.textContent = 'Google não configurado';
      }
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (resposta) => autenticarGoogle(resposta.credential)
    });

    if (botaoGoogle) {
      botaoGoogle.disabled = false;
      botaoGoogle.textContent = 'Continuar com Google';
      botaoGoogle.addEventListener('click', () => {
        window.google.accounts.id.prompt();
      }, { once: true });
    }
  } catch (erro) {
    if (botaoGoogle) {
      botaoGoogle.disabled = true;
      botaoGoogle.textContent = 'Google indisponível';
    }
  }
}

botao?.addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('password').value;
  const nome = document.getElementById('nome').value.trim();
  if (!email || !senha || (modoCadastro && nome.length < 2)) {
    mostrarMensagem('Preencha os campos para continuar.');
    return;
  }

  await autenticarLocal(email, senha, nome);
});

inicializarGoogle();
