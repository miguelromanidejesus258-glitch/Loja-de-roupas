// LOJA.JS FINAL - RMX STORE
function showCartAdded(name) {
  const toast = document.createElement('div');
  toast.className = 'toast-notification show';
  toast.textContent = `✅ ${name || 'Produto'} adicionado`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
  // 1. Preenche data-* automático
  document.querySelectorAll('.card').forEach(card => {
    const h4 = card.querySelector('h4');
    const img = card.querySelector('img');
    const preco = card.querySelector('.preco-card');
    if(h4) card.dataset.name = card.dataset.name || h4.innerText.trim();
    if(img) card.dataset.image = card.dataset.image || img.src;
    if(preco) card.dataset.price = card.dataset.price || preco.innerText.trim();
    if(!card.dataset.link) card.dataset.link = 'descricao.html';
  });

  // 2. Botão carrinho
  document.querySelectorAll('.card .cart').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.card');
      showCartAdded(card.dataset.name);
    });
  });

  // 3. Ver mais - UMA vez só
  document.querySelectorAll('.btn-view-details').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const card = btn.closest('.card');
      const produto = {
        name: card.dataset.name,
        price: card.dataset.price,
        image: card.dataset.image,
        desc: card.dataset.desc || card.dataset.name
      };
      sessionStorage.setItem('productDetails', JSON.stringify(produto));
      window.location.href = 'descricao.html';
    });
  });
});

function prt(){
  const input = document.getElementById('perguntaDigitada');
  if(!input.value) return;
  const div = document.createElement('p');
  div.textContent = "Você: " + input.value;
  div.style = "margin-top:10px; color:#f2f2f2; background:#1d1d1d; padding:10px; border-radius:8px;";
  document.querySelector('.pergunta').appendChild(div);
  input.value = "";
  showCartAdded("Pergunta enviada");
}