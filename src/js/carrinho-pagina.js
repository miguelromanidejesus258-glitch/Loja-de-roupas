// CARRINHO-PAGINA.JS — desenha a página carrinho.html.
//
// Regra de segurança importante: aqui NUNCA usamos innerHTML com dados do produto.
// Criamos os elementos com createElement e colocamos o texto com textContent/append,
// que tratam tudo como TEXTO. Assim, um nome de produto malicioso como
// <img onerror=...> aparece escrito na tela em vez de executar (isso é o que
// evita o XSS que apareceu na análise do loja.js e do admin.html).

(() => {
  const lista = document.getElementById('lista-carrinho');
  const conteudo = document.getElementById('carrinho-conteudo');
  const vazio = document.getElementById('carrinho-vazio');
  const totalEl = document.getElementById('total-carrinho');
  const aviso = document.getElementById('aviso-tamanho');
  const status = document.getElementById('status-finalizar');
  const btnWhats = document.getElementById('btn-whatsapp');
  const btnInsta = document.getElementById('btn-instagram');
  const btnLimpar = document.getElementById('btn-limpar');
  const titulo = document.getElementById('titulo-carrinho');

  // Atalho para criar elementos sem repetir código.
  function el(tag, atributos = {}, ...filhos) {
    const e = document.createElement(tag);
    for (const [chave, valor] of Object.entries(atributos)) {
      if (chave === 'classe') e.className = valor;
      else e.setAttribute(chave, valor);
    }
    e.append(...filhos);
    return e;
  }

  function criarLinha(item) {
    const chave = `${item.id}|${item.tamanho}`;

    const foto = el('div', { classe: 'item-foto' });
    if (item.imagem) {
      const img = el('img', { alt: item.nome, loading: 'lazy' });
      img.src = item.imagem;               // .src (propriedade) em vez de montar HTML
      img.onerror = () => img.remove();    // imagem quebrada: fica só o quadrado cinza
      foto.append(img);
    }

    const idSelect = `tam-${chave.replace(/[^a-z0-9]/gi, '-')}`;
    const select = el('select', { id: idSelect, 'data-chave': `tam:${chave}` });
    select.append(el('option', { value: '' }, 'Escolha'));
    Carrinho.TAMANHOS.forEach(t => {
      const op = el('option', { value: t }, t);
      if (t === item.tamanho) op.selected = true;
      select.append(op);
    });
    select.onchange = () => {
      const novo = select.value;
      desenhar(`tam:${item.id}|${novo}`, () => Carrinho.definirTamanho(item.id, item.tamanho, novo));
    };

    const info = el('div', { classe: 'item-info' },
      el('h3', {}, item.nome),
      el('p', { classe: 'item-unit' }, Carrinho.formatar(item.preco) + ' cada'),
      el('div', { classe: 'item-tamanho' },
        el('label', { for: idSelect }, 'Tamanho'),
        select));

    const menos = el('button', {
      type: 'button', 'aria-label': `Diminuir quantidade de ${item.nome}`, 'data-chave': `menos:${chave}`
    }, '−');
    const mais = el('button', {
      type: 'button', 'aria-label': `Aumentar quantidade de ${item.nome}`, 'data-chave': `mais:${chave}`
    }, '+');
    menos.onclick = () => desenhar(`menos:${chave}`, () => Carrinho.alterarQtd(item.id, item.tamanho, -1));
    mais.onclick = () => desenhar(`mais:${chave}`, () => Carrinho.alterarQtd(item.id, item.tamanho, +1));

    const qtd = el('div', { classe: 'item-qtd', role: 'group', 'aria-label': 'Quantidade' },
      menos, el('span', { 'aria-live': 'polite' }, String(item.qtd)), mais);

    const subtotal = el('p', { classe: 'item-subtotal' }, Carrinho.formatar(item.preco * item.qtd));

    const remover = el('button', {
      type: 'button', classe: 'item-remover', 'aria-label': `Remover ${item.nome} do carrinho`
    }, 'Remover');
    remover.onclick = () => desenhar('titulo', () => Carrinho.remover(item.id, item.tamanho));

    return el('li', { classe: 'item' }, foto, info, qtd, subtotal, remover);
  }

  // acao (opcional) mexe no carrinho; depois redesenhamos e devolvemos o foco
  // ao botão usado, para quem navega pelo teclado não "se perder" na página.
  function desenhar(focoChave, acao) {
    if (acao) acao();
    const itens = Carrinho.itens();

    vazio.hidden = itens.length > 0;
    conteudo.hidden = itens.length === 0;
    lista.replaceChildren(...itens.map(criarLinha));
    totalEl.textContent = Carrinho.formatar(Carrinho.total());

    const semTamanho = Carrinho.faltaTamanho();
    aviso.hidden = !semTamanho;
    status.textContent = '';

    const linkWhats = Carrinho.linkWhatsApp();
    btnWhats.hidden = !linkWhats;
    if (linkWhats) btnWhats.href = linkWhats;
    btnInsta.hidden = !Carrinho.linkInstagram();
    if (Carrinho.linkInstagram()) btnInsta.href = Carrinho.linkInstagram();
    [btnWhats, btnInsta].forEach(b => b.setAttribute('aria-disabled', String(semTamanho)));

    if (focoChave === 'titulo') titulo.focus();
    else if (focoChave) document.querySelector(`[data-chave="${CSS.escape(focoChave)}"]`)?.focus();
  }

  // Cliques em "Finalizar": só deixam seguir se todos os itens tiverem tamanho.
  function bloquearSeFaltarTamanho(evento) {
    if (Carrinho.faltaTamanho()) {
      evento.preventDefault();
      aviso.hidden = false;
      aviso.focus();
      return true;
    }
    return false;
  }

  btnWhats.addEventListener('click', bloquearSeFaltarTamanho);

  btnInsta.addEventListener('click', evento => {
    if (bloquearSeFaltarTamanho(evento)) return;
    // Copia o pedido; o link abre a conversa do Instagram em outra aba.
    const mensagem = Carrinho.montarMensagem();
    const copiou = navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(mensagem) : Promise.reject();
    copiou
      .then(() => { status.textContent = 'Pedido copiado! Cole na conversa do Instagram.'; })
      .catch(() => { status.textContent = 'Não deu para copiar sozinho. Copie o pedido abaixo e cole na conversa.'; mostrarTexto(mensagem); });
  });

  // Plano B quando o navegador não deixa copiar: mostra o texto para selecionar.
  function mostrarTexto(mensagem) {
    let caixa = document.getElementById('texto-pedido');
    if (!caixa) {
      caixa = el('textarea', { id: 'texto-pedido', readonly: '', rows: '7', 'aria-label': 'Texto do pedido' });
      status.after(caixa);
    }
    caixa.value = mensagem;
  }

  btnLimpar.onclick = () => {
    if (confirm('Esvaziar o carrinho?')) desenhar('titulo', () => Carrinho.limpar());
  };

  // Redesenha quando o carrinho muda por fora (outra aba, por exemplo).
  document.addEventListener('carrinho:mudou', () => {
    if (!document.hidden) desenharSemFoco();
  });
  function desenharSemFoco() { desenhar(); }

  desenhar();
})();
