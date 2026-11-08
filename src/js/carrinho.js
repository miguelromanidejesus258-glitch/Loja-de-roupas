// CARRINHO.JS — o carrinho da loja, guardado no navegador (localStorage).
//
// Ideias principais (vale ler com calma):
//  1) DINHEIRO EM CENTAVOS. Guardamos 59,99 como 5999 (número inteiro).
//     Somar números decimais no JS dá erro (0.1 + 0.2 = 0.30000000000000004);
//     com inteiros a conta fecha sempre. Só viramos "R$ 59,99" na hora de mostrar.
//  2) Cada item do carrinho é um objeto: { id, nome, preco, imagem, tamanho, qtd }.
//     O mesmo produto em tamanhos diferentes vira linhas diferentes.
//  3) Este arquivo só cuida dos DADOS. Desenhar a página do carrinho fica em
//     carrinho-pagina.js.

const Carrinho = (() => {
  const CHAVE = 'rmx_carrinho';   // nome da gaveta no localStorage
  const MAX_QTD = 20;             // limite por linha, igual ao da API do backend
  const TAMANHOS = ['P', 'M', 'G', 'GG'];

  // Se o localStorage estiver bloqueado (aba anônima, por ex.), o carrinho
  // continua funcionando enquanto a página estiver aberta.
  let memoria = [];

  // ---------- 1) Ler e salvar ----------

  function itemValido(i) {
    return i && typeof i.id === 'string' && typeof i.nome === 'string' &&
      Number.isInteger(i.preco) && i.preco > 0 &&
      Number.isInteger(i.qtd) && i.qtd > 0;
  }

  function ler() {
    try {
      const dados = JSON.parse(localStorage.getItem(CHAVE));
      if (Array.isArray(dados)) return dados.filter(itemValido);
    } catch (e) { /* JSON quebrado ou storage bloqueado */ }
    return memoria.filter(itemValido);
  }

  function salvar(itens) {
    memoria = itens;
    try { localStorage.setItem(CHAVE, JSON.stringify(itens)); } catch (e) { /* sem storage */ }
    atualizarBadge();
    // Avisa quem estiver ouvindo (a página do carrinho se redesenha com isso).
    document.dispatchEvent(new CustomEvent('carrinho:mudou'));
  }

  // ---------- 2) Dinheiro e nomes ----------

  // "59,99R$" -> 5999   |   "R$ 1.299,90" -> 129990   |   lixo -> NaN
  function paraCentavos(texto) {
    const limpo = String(texto ?? '').replace(/\./g, '').replace(/[^\d,]/g, '');
    if (!limpo) return NaN;
    const [reais, centavos = ''] = limpo.split(',');
    return parseInt(reais || '0', 10) * 100 + parseInt((centavos + '00').slice(0, 2), 10);
  }

  // 5999 -> "R$ 59,99"
  function formatar(centavos) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
      .format(centavos / 100);
  }

  // "Camisa RMX Preta!" -> "camisa-rmx-preta" (o mesmo nome dá sempre o mesmo id)
  function criarId(nome) {
    return String(nome).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // ---------- 3) Mexer no carrinho ----------

  // produto = { nome, preco (texto "59,99R$" ou centavos), imagem, tamanho }
  // Devolve true se adicionou, false se o produto veio com dado inválido.
  function adicionar(produto, qtd = 1) {
    const nome = String(produto.nome || '').trim();
    const preco = typeof produto.preco === 'number' ? produto.preco : paraCentavos(produto.preco);
    if (!nome || !Number.isInteger(preco) || preco <= 0) return false;

    const id = criarId(nome);
    const tamanho = TAMANHOS.includes(produto.tamanho) ? produto.tamanho : '';
    const itens = ler();
    const existente = itens.find(i => i.id === id && i.tamanho === tamanho);

    if (existente) {
      existente.qtd = Math.min(MAX_QTD, existente.qtd + qtd);
    } else {
      itens.push({ id, nome, preco, imagem: produto.imagem || '', tamanho, qtd: Math.min(MAX_QTD, qtd) });
    }
    salvar(itens);
    return true;
  }

  function alterarQtd(id, tamanho, delta) {
    const itens = ler();
    const item = itens.find(i => i.id === id && i.tamanho === tamanho);
    if (!item) return;
    item.qtd = Math.min(MAX_QTD, item.qtd + delta);
    salvar(item.qtd <= 0 ? itens.filter(i => i !== item) : itens);
  }

  // Troca o tamanho de uma linha. Se já existir outra linha igual, junta as duas.
  function definirTamanho(id, tamanhoAntigo, tamanhoNovo) {
    if (tamanhoNovo !== '' && !TAMANHOS.includes(tamanhoNovo)) return;
    const itens = ler();
    const item = itens.find(i => i.id === id && i.tamanho === tamanhoAntigo);
    if (!item) return;
    const outra = itens.find(i => i !== item && i.id === id && i.tamanho === tamanhoNovo);
    if (outra) {
      outra.qtd = Math.min(MAX_QTD, outra.qtd + item.qtd);
      salvar(itens.filter(i => i !== item));
    } else {
      item.tamanho = tamanhoNovo;
      salvar(itens);
    }
  }

  function remover(id, tamanho) {
    salvar(ler().filter(i => !(i.id === id && i.tamanho === tamanho)));
  }

  function limpar() { salvar([]); }

  // ---------- 4) Contas ----------

  function total() { return ler().reduce((soma, i) => soma + i.preco * i.qtd, 0); }
  function quantidadeTotal() { return ler().reduce((soma, i) => soma + i.qtd, 0); }
  function faltaTamanho() { return ler().some(i => !i.tamanho); }

  // ---------- 5) Finalizar o pedido (WhatsApp / Instagram) ----------

  function montarMensagem() {
    const loja = (typeof LOJA_CONFIG !== 'undefined' && LOJA_CONFIG.nomeLoja) || 'RMX Store';
    const linhas = ler().map(i =>
      `• ${i.qtd}x ${i.nome} (${i.tamanho}) — ${formatar(i.preco * i.qtd)}`);
    return `Olá, ${loja}! Quero finalizar este pedido:\n\n${linhas.join('\n')}\n\nTotal: ${formatar(total())}`;
  }

  // Link do WhatsApp com a mensagem pronta; null se o número não foi configurado.
  function linkWhatsApp() {
    const numero = String((typeof LOJA_CONFIG !== 'undefined' && LOJA_CONFIG.whatsapp) || '').replace(/\D/g, '');
    if (numero.length < 10) return null;
    return `https://wa.me/${numero}?text=${encodeURIComponent(montarMensagem())}`;
  }

  // O Instagram não aceita mensagem pré-escrita: abrimos a conversa e o
  // cliente cola o pedido (a página copia o texto antes de abrir).
  function linkInstagram() {
    const usuario = (typeof LOJA_CONFIG !== 'undefined' && LOJA_CONFIG.instagram) || '';
    return usuario ? `https://ig.me/m/${encodeURIComponent(usuario)}` : null;
  }

  // ---------- 6) Lendo um card de produto da loja ----------

  // Funciona com os cards escritos no HTML e com os criados pelo JSON.
  function lerCard(card) {
    const img = card.querySelector('img');
    const srcOriginal = img ? img.getAttribute('src') : '';
    const imagemValida = srcOriginal && srcOriginal !== '#';
    return {
      nome: card.dataset.name || (card.querySelector('h4')?.textContent || '').trim(),
      preco: card.dataset.price || (card.querySelector('.preco-card')?.textContent || '').trim(),
      imagem: imagemValida ? srcOriginal : (card.dataset.image || '')
    };
  }

  // ---------- 7) Bolinha com a quantidade no ícone do cabeçalho ----------

  function atualizarBadge() {
    const n = quantidadeTotal();
    document.querySelectorAll('header .interact-header-cart-heart .cart').forEach(botao => {
      let selo = botao.querySelector('.cart-badge');
      if (!selo) {
        selo = document.createElement('span');
        selo.className = 'cart-badge';
        selo.setAttribute('aria-hidden', 'true');
        botao.appendChild(selo);
      }
      selo.textContent = n > 99 ? '99+' : String(n);
      selo.hidden = n === 0;
      botao.setAttribute('aria-label', n ? `Abrir carrinho, ${n} ${n === 1 ? 'item' : 'itens'}` : 'Abrir carrinho');
    });
  }

  function ligarBotaoDoHeader() {
    document.querySelectorAll('header .interact-header-cart-heart .cart').forEach(botao => {
      botao.onclick = () => { window.location.href = 'carrinho.html'; };
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    ligarBotaoDoHeader();
    atualizarBadge();
  });

  // Se o carrinho mudar em OUTRA aba, a bolinha desta aba também atualiza.
  window.addEventListener('storage', evento => {
    if (evento.key === CHAVE) {
      atualizarBadge();
      document.dispatchEvent(new CustomEvent('carrinho:mudou'));
    }
  });

  return {
    TAMANHOS, itens: ler, adicionar, alterarQtd, definirTamanho, remover, limpar,
    total, quantidadeTotal, faltaTamanho, formatar, paraCentavos,
    montarMensagem, linkWhatsApp, linkInstagram, lerCard, atualizarBadge
  };
})();
