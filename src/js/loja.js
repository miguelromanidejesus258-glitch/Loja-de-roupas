// LOJA.JS — SEM PISCADA + CAMINHOS CERTOS ✅
const STORAGE_KEY = 'rmx_produtos';

// JSON tá na mesma pasta que loja.html
const JSON_PATH = './produtos.json';

// Páginas ficam em public/, as fotos ficam em assets/ na raiz do projeto
const CAMINHO_IMAGENS = '../assets/';

function showCartAdded(name) {
  const toast = document.createElement('div');
  toast.className = 'toast-notification show';
  toast.textContent = `✅ ${name || 'Produto'} adicionado`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 3000);
}

function imagemValida(caminho) {
  if (!caminho || caminho === '#') return false;
  return true;
}

// Mantém o caminho que já funciona a partir de public/*.html
function corrigirCaminhoImagem(caminho) {
  if (!imagemValida(caminho)) return '';
  if (/^(https?:|data:)/i.test(caminho)) return caminho;
  if (caminho.startsWith('../') || caminho.startsWith('./')) return caminho;
  if (caminho.startsWith('/assets/')) return `..${caminho}`;
  if (caminho.startsWith('assets/')) return `../${caminho}`;
  if (caminho.startsWith('/')) return caminho;
  return `${CAMINHO_IMAGENS}${caminho}`;
}

function acharSecao(catId) {
  const direto = document.getElementById(catId);
  if (direto) return direto;
  const alvo = catId.toLowerCase();
  return Array.from(document.querySelectorAll('section[id]'))
    .find(secao => secao.id.toLowerCase() === alvo) || null;
}

async function carregarProdutos() {
  try {
    const api = await fetch('/api/produtos');
    if (api.ok) {
      const dados = await api.json();
      if (Array.isArray(dados) && dados.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
        return dados;
      }
    }
  } catch (e) {
    console.log('API indisponível, usando arquivo local');
  }

  try {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (salvo && JSON.parse(salvo).length > 0) return JSON.parse(salvo);

    const res = await fetch(JSON_PATH);
    if (!res.ok) throw new Error(`JSON não encontrado (status: ${res.status})`);
    const dados = await res.json();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
    return dados;
  } catch (e) {
    console.log('⚠️ Usando conteúdo do HTML:', e.message);
    return null;
  }
}

function salvarProdutos(produtos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(produtos));
}

function criarHTMLCard(p) {
  const imagem = corrigirCaminhoImagem(p.imagem || p.image);
  const nome = p.nome || p.name || 'Produto sem nome';
  const preco = p.preco || p.price || '0,00';

  const src = imagem ? `src="${imagem}"` : '';
  return `
    <img 
      ${src}
      alt="${nome}"
      loading="lazy"
    >
    <h4>${nome}</h4>
    <div class="informations-card">
        <p class="preco-card">${preco}</p>
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
  const categorias = {};
  produtos.forEach(p => {
    const cat = (p.categoria || p.category || 'mais-vendidos').toLowerCase().trim();
    if (!categorias[cat]) categorias[cat] = [];
    categorias[cat].push(p);
  });

  if (!categorias['mais-vendidos']) {
    categorias['mais-vendidos'] = produtos.slice(0, 8);
  }

  for (const catId in categorias) {
    const lista = categorias[catId];
    const section = acharSecao(catId);
    if (!section) continue;

    const grid = section.querySelector('.grid-produtos');
    if (!grid) continue;

    // Sem foto útil, o HTML estático da seção fica no lugar
    if (!lista.every(prod => imagemValida(prod.imagem || prod.image))) continue;

    // 🔑 Segredo: esconde APENAS se for substituir o conteúdo
    grid.style.opacity = '0';
    grid.innerHTML = ''; // limpa só depois de esconder

    categorias[catId].forEach(prod => {
      const article = document.createElement('article');
      article.className = 'card';
      const imagem = corrigirCaminhoImagem(prod.imagem || prod.image);
      if (prod.id != null) article.dataset.id = prod.id;
      article.dataset.name = prod.nome || prod.name;
      article.dataset.price = prod.preco || prod.price;
      article.dataset.image = imagem;
      article.dataset.link = 'descricao.html';
      article.dataset.desc = prod.descricao || prod.desc || prod.nome || '';
      article.innerHTML = criarHTMLCard(prod);
      grid.appendChild(article);
    });

    // Mostra só depois de tudo pronto
    requestAnimationFrame(() => {
      grid.style.opacity = '1';
    });
  }
  ativarBotoes();
}

function ativarBotoes() {
  document.querySelectorAll('.card').forEach(card => {
    const img = card.querySelector('img');
    if (img && !card.dataset.image) {
      card.dataset.image = img.src;
    }
  });

  document.querySelectorAll('.card .cart').forEach(btn => {
    btn.onclick = () => {
      const card = btn.closest('.card');
      showCartAdded(card.dataset.name);
      const token = localStorage.getItem('rmx_token');
      if (!token || !card.dataset.id) return;
      fetch('/api/carrinho', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({ product_id: Number(card.dataset.id), quantidade: 1 })
      }).catch(() => {});
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

document.addEventListener('DOMContentLoaded', async () => {
  const gridPrincipal = document.querySelector('#mais-vendidos .grid-produtos');
  
  // Limpa cache antigo pra não ter dado misturado
  // localStorage.removeItem(STORAGE_KEY); // descomenta 1x se precisar limpar tudo

  const produtos = await carregarProdutos();
  
  if (produtos && produtos.length > 0) {
    // Tem dados novos → substitui
    if (gridPrincipal) gridPrincipal.style.transition = 'opacity 0.2s ease';
    renderizarComJSON(produtos);
  } else {
    // Sem dados → mantém o HTML original e só ativa funções
    console.log('📦 Usando produtos do HTML');
    ativarBotoes();
  }
});

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

function compraragora() {
  alert('Função comprar agora!');
}

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
