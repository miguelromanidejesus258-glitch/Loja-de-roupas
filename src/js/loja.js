// LOJA.JS FINAL - RMX STORE COM JSON
const STORAGE_KEY = 'rmx_produtos';
const JSON_PATH = './produtos.json'; // Se você moveu pra public/produtos.json, deixa assim. Se deixou em config, use '../config/produtos.json'

function showCartAdded(name) {
  const toast = document.createElement('div');
  toast.className = 'toast-notification show';
  toast.textContent = `✅ ${name || 'Produto'} adicionado`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 3000);
}

// 1. NOVA PARTE - BUSCA DO JSON
async function carregarProdutos() {
  try {
    // tenta pegar do localStorage primeiro (que o admin salva)
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (salvo) {
      return JSON.parse(salvo);
    }
    // se não tem, busca do seu produtos.json
    const res = await fetch(JSON_PATH);
    if (!res.ok) throw new Error('JSON não encontrado');
    const dados = await res.json();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
    return dados;
  } catch (e) {
    console.log('Não achou o JSON, vai usar os cards do HTML mesmo:', e);
    return null;
  }
}

function salvarProdutos(produtos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(produtos));
}

function criarHTMLCard(p) {
  return `
    <img src="${p.imagem || p.image}" alt="${p.nome || p.name}">
    <h4>${p.nome || p.name}</h4>
    <div class="informations-card">
        <p class="preco-card">${p.preco || p.price}</p>
        <div class="interact">
            <button class="cart"><ion-icon name="cart-outline"></ion-icon></button>
            <button class="heart"><ion-icon name="heart-outline"></ion-icon></button>
        </div>
    </div>
    <div class="interact-bottom">
       <button onclick="compraragora()" class="btn-compraragora">Compre Agora</button> 
       <button class="btn-view-details">Ver mais</button>
    </div>
  `;
}

function renderizarComJSON(produtos) {
  // limpa os grids e preenche com o JSON
  const categorias = {};
  produtos.forEach(p => {
    const cat = (p.categoria || p.category || 'mais-vendidos').toLowerCase();
    if (!categorias[cat]) categorias[cat] = [];
    categorias[cat].push(p);
  });

  for (const catId in categorias) {
    const section = document.getElementById(catId) || document.getElementById('mais-vendidos');
    if (!section) continue;
    const grid = section.querySelector('.grid-produtos');
    if (!grid) continue;
    grid.innerHTML = ''; // limpa o HTML velho
    categorias[catId].forEach(prod => {
      const article = document.createElement('article');
      article.className = 'card';
      article.dataset.name = prod.nome || prod.name;
      article.dataset.price = prod.preco || prod.price;
      article.dataset.image = prod.imagem || prod.image;
      article.dataset.link = 'descricao.html';
      article.dataset.desc = prod.descricao || prod.desc || prod.nome;
      article.innerHTML = criarHTMLCard(prod);
      grid.appendChild(article);
    });
  }
  // depois de renderizar, reativa os botões
  ativarBotoes();
}

function ativarBotoes() {
  document.querySelectorAll('.card').forEach(card => {
    const h4 = card.querySelector('h4');
    const img = card.querySelector('img');
    const preco = card.querySelector('.preco-card');
    if(h4) card.dataset.name = card.dataset.name || h4.innerText.trim();
    if(img) card.dataset.image = card.dataset.image || img.src;
    if(preco) card.dataset.price = card.dataset.price || preco.innerText.trim();
    if(!card.dataset.link) card.dataset.link = 'descricao.html';
  });

  document.querySelectorAll('.card .cart').forEach(btn => {
    btn.onclick = () => {
      const card = btn.closest('.card');
      showCartAdded(card.dataset.name);
    };
  });

  document.querySelectorAll('.btn-view-details').forEach(btn => {
    btn.onclick = e => {
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
    };
  });
}

// 2. SEU DOMContentLoaded ORIGINAL, AGORA COM FETCH
document.addEventListener('DOMContentLoaded', async () => {
  const produtos = await carregarProdutos();
  
  if (produtos) {
    // SE ACHOU O JSON, usa ele
    renderizarComJSON(produtos);
  } else {
    // SE NÃO ACHOU, usa seu código antigo que lê do HTML
    ativarBotoes();
  }
});

// Suas outras funções continuam iguais
function prt(){
  const input = document.getElementById('perguntaDigitada');
  if(!input || !input.value) return;
  const div = document.createElement('p');
  div.textContent = "Você: " + input.value;
  div.style = "margin-top:10px; color:#f2f2f2; background:#1d1d1d; padding:10px; border-radius:8px;";
  const container = document.querySelector('.pergunta');
  if(container) container.appendChild(div);
  input.value = "";
  showCartAdded("Pergunta enviada");
}

// Funções pro seu admin.html usar
function adicionarCard(novoProduto) {
  const produtos = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  novoProduto.id = Date.now();
  produtos.push(novoProduto);
  salvarProdutos(produtos);
  location.reload();
}

function removerCard(id) {
  let produtos = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  produtos = produtos.filter(p => p.id != id);
  salvarProdutos(produtos);
  location.reload();
}