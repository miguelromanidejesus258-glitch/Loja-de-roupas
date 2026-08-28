// Centraliza comportamento de adicionar ao carrinho e notificação (toast)
function adicionarAoCarrinho() {
    // função legacy — mantenho para compatibilidade se chamada diretamente
    showCartAdded('Produto');
}

function showCartAdded(productName) {
    if (!productName) productName = 'Produto';

    // criar toast
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = `✅ ${productName} adicionado ao carrinho`;
    document.body.appendChild(toast);

    // força reflow para ativar transição
    // eslint-disable-next-line no-unused-expressions
    toast.offsetHeight;
    toast.classList.add('show');

    // remover após 3s
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 3000);
}

// adiciona listeners depois que o DOM carregar
document.addEventListener('DOMContentLoaded', () => {
  // popula atributos data-* em cada card usando o conteúdo já presente no HTML
  function populateCardData(){
    document.querySelectorAll('.card').forEach(card => {
      const title = card.querySelector('h4, h3, .titulo-card');
      const img = card.querySelector('img');
      const price = card.querySelector('.preco-card');
      if(title) card.dataset.name = title.textContent.trim();
      if(img) card.dataset.image = img.src || '';
      if(price) card.dataset.price = price.textContent.trim();
      if(!card.dataset.link) card.dataset.link = 'descricao.html';
    });
  }

  populateCardData();
    // delegação: seleciona todos os botões com class 'cart' dentro dos cards
    const cartButtons = document.querySelectorAll('.card .interact .cart, .card .interact button.cart');
    cartButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // tenta ler data-product do botão
            const productFromData = btn.dataset && btn.dataset.product;
            if (productFromData) return showCartAdded(productFromData);

            // senão, procura o título do produto no card pai
            const card = btn.closest('.card');
            const titleEl = card ? card.querySelector('h4, h3, .titulo-card') : null;
            const productName = titleEl ? titleEl.textContent.trim() : 'Produto';
            showCartAdded(productName);
        });
    });
});

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.btn-view-details').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const card = btn.closest('.card');
      const d = card.dataset;
      const product = {
        name: d.name || card.querySelector('h4')?.textContent.trim() || 'Produto',
        price: d.price || card.querySelector('.preco-card')?.textContent.trim() || '',
        image: d.image || card.querySelector('img')?.src || '',
        desc: d.desc || ''
      };
      sessionStorage.setItem('productDetails', JSON.stringify(product));
      window.location.href = d.link || 'detalhes.html';
    });
  });
});