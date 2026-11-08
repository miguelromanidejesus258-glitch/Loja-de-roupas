const msg = document.getElementById('login-msg');
const grupoNome = document.getElementById('grupo-nome');
const botao = document.getElementById('btn-login');
const link = document.getElementById('link-cadastro');
let modoCadastro = false;

function mostrarMensagem(texto) {
  if (msg) msg.textContent = texto;
}

link?.addEventListener('click', (evento) => {
  evento.preventDefault();
  modoCadastro = !modoCadastro;
  grupoNome.hidden = !modoCadastro;
  botao.textContent = modoCadastro ? 'Criar conta' : 'Entrar';
  link.textContent = modoCadastro ? 'Já tenho conta' : 'Cadastre-se';
  mostrarMensagem('');
});

botao?.addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('password').value;
  const nome = document.getElementById('nome').value.trim();
  if (!email || !senha || (modoCadastro && nome.length < 2)) {
    mostrarMensagem('Preencha os campos para continuar.');
    return;
  }

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
    localStorage.setItem('rmx_token', dados.token);
    localStorage.setItem('rmx_usuario', dados.nome || email);
    window.location.href = 'loja.html';
  } catch (erro) {
    mostrarMensagem('Servidor desligado. Rode a API e tente de novo.');
  } finally {
    botao.disabled = false;
  }
});
