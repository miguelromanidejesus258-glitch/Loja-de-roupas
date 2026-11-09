(function () {
  function pegarUsuario() {
    const nome = localStorage.getItem('rmx_usuario') || '';
    const token = localStorage.getItem('rmx_token') || '';
    const avatar = localStorage.getItem('rmx_avatar') || '';
    const role = localStorage.getItem('rmx_role') || 'user';
    return { nome, token, avatar, role };
  }

  function inicializarAvatarInicial(nome) {
    const partes = (nome || 'U').trim().split(/\s+/).filter(Boolean);
    const primeira = partes[0]?.[0]?.toUpperCase() || 'U';
    const segunda = partes[1]?.[0]?.toUpperCase() || '';
    return `${primeira}${segunda}`;
  }

  function renderizarHeaderAuth() {
    const container = document.getElementById('header-auth');
    if (!container) return;

    const { nome, token, avatar, role } = pegarUsuario();
    const logado = Boolean(token && nome);

    if (!logado) {
      container.innerHTML = `
        <div class="auth-actions">
          <a class="auth-button auth-button-light" href="login.html">Entrar</a>
          <a class="auth-button auth-button-gold" href="login.html?modo=cadastro">Cadastre-se</a>
        </div>
      `;
      return;
    }

    const nomeExibicao = nome.trim();
    const avatarUrl = avatar && avatar.trim() ? avatar.trim() : '';
    const eAdmin = role === 'admin';

    container.innerHTML = `
      <div class="user-pill" aria-label="Usuário autenticado">
        ${avatarUrl ? `<img src="${avatarUrl}" alt="Foto de ${nomeExibicao}" class="user-avatar-image">` : `<span class="user-avatar-circle">${inicializarAvatarInicial(nomeExibicao)}</span>`}
        <span class="user-name">${nomeExibicao}</span>
        ${eAdmin ? `<a class="user-admin-link" href="admin.html">Admin</a>` : ''}
        <button class="user-logout" type="button">Sair</button>
      </div>
    `;

    const botaoSair = container.querySelector('.user-logout');
    botaoSair?.addEventListener('click', () => {
      localStorage.removeItem('rmx_token');
      localStorage.removeItem('rmx_usuario');
      localStorage.removeItem('rmx_avatar');
      localStorage.removeItem('rmx_email');
      window.location.href = 'login.html';
    });
  }

  document.addEventListener('DOMContentLoaded', renderizarHeaderAuth);
})();
