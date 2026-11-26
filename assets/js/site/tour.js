// =====================================================================
// Site · Tour LS (jogo da loja): interface, missão, Dudu, cards e lead no CRM
// =====================================================================
import { iniciarPagina, h, raw, $, $$, fmt, site, urlMidia, cfg, parcelas, linkZap, rastrear, nomeFirmeza } from './comum.js';
import { Jogo, ZONAS } from '../tour/motor.js';
import { novoCanvas, cama, bau, baseBox, mesa, CAMA } from '../tour/arte.js';
import { efeito, musica, somLigado } from '../tour/som.js';

const BRINDE = 'Travesseiro Amore';
const MINIMO = 2000;
const MISSOES = [
  ['cama', 'Deite num colchão'],
  ['bau', 'Abra um baú'],
  ['trav', 'Conheça os travesseiros'],
  ['dudu', 'Converse com o Dudu']
];
const GRUPO = { macio: [1, 2], medio: [3], firme: [4, 5] };
const NOME_GRUPO = { macio: 'macio', medio: 'médio', firme: 'firme' };

const st = {
  produtos: [], jogo: null, feitas: new Set(), lista: new Map(), testados: new Set(),
  sondagem: {}, indicados: [], tamanhoSel: null, completou: false, enviado: false, aberto: null
};

const tela = () => $('.tour-tela');
const preco = (v) => fmt.reaisCentavos(v);

// ---------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------
async function iniciar() {
  await iniciarPagina('tour');
  const raiz = $('#tour');
  try {
    st.produtos = (await site.tour()) || [];
  } catch (e) {
    console.error(e);
    st.produtos = [];
  }
  if (!st.produtos.length) {
    $('.t-inicio .t-carregando', raiz).textContent = 'Não foi possível abrir a loja agora.';
    $('.t-inicio .t-erro', raiz).hidden = false;
    return;
  }
  st.jogo = new Jogo($('#tour-canvas'), st.produtos, {
    interagir: aoInteragir,
    alvo: aoMudarAlvo,
    zona: aoMudarZona,
    levantou: aoLevantar,
    som: efeito
  });
  st.jogo.iniciar();
  if (new URLSearchParams(location.search).has('debug')) window.tourDebug = st; // usado nos testes
  st.jogo.pausar(true);
  $('.t-inicio .t-carregando', raiz).hidden = true;
  $('.t-jogar', raiz).hidden = false;
  $('.t-jogar', raiz).addEventListener('click', comecar);
  ligarControles();
  atualizarHud();
}

function comecar() {
  $('.t-inicio').hidden = true;
  document.body.classList.add('jogando');
  if (ehCelular()) entrarTelaCheia();
  else tela().scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('.t-hud').hidden = false;
  if (matchMedia('(pointer: coarse)').matches) $('.t-controles').hidden = false;
  st.jogo.pausar(false);
  efeito('ok'); musica(true);
  toast('Missão: deite num colchão, abra um baú, conheça os travesseiros e fale com o Dudu');
  tela().focus({ preventScroll: true });
}

// ---------------------------------------------------------------------
// Tela cheia no celular: usa a tela cheia do navegador quando ele deixa
// (Android) e, sempre, ocupa a tela inteira com a loja esticada na altura
// ---------------------------------------------------------------------
const ehCelular = () => matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
let telaCheiaNativa = false;
function entrarTelaCheia() {
  const caixa = $('#tour');
  caixa.classList.add('tela-cheia');
  document.documentElement.classList.add('tour-sem-rolagem');
  $('.t-sair').hidden = false;
  try {
    const pedir = caixa.requestFullscreen?.bind(caixa) || caixa.webkitRequestFullscreen?.bind(caixa);
    const r = pedir?.({ navigationUI: 'hide' });
    if (r?.then) r.then(() => { telaCheiaNativa = true; screen.orientation?.lock?.('portrait').catch(() => {}); }).catch(() => {});
  } catch { /* navegador sem tela cheia (iPhone): fica só o modo que ocupa a tela */ }
  ajustarTela();
}
function sairTelaCheia() {
  const caixa = $('#tour');
  caixa.classList.remove('tela-cheia');
  document.documentElement.classList.remove('tour-sem-rolagem');
  $('.t-sair').hidden = true;
  const t = tela(); t.style.width = ''; t.style.aspectRatio = '';
  st.jogo?.redimensionar(320);
  if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
  telaCheiaNativa = false;
  t.scrollIntoView({ block: 'center' });
}
function ajustarTela() {
  if (!$('#tour').classList.contains('tela-cheia') || !st.jogo) return;
  const w = window.visualViewport?.width || innerWidth, h = window.visualViewport?.height || innerHeight;
  st.jogo.redimensionar(180 * h / w);
  const alt = st.jogo.alt, t = tela();
  t.style.aspectRatio = `180 / ${alt}`;
  t.style.width = `min(${Math.floor(w)}px, ${Math.floor(h * 180 / alt)}px)`;
}
['resize', 'orientationchange'].forEach((ev) => window.addEventListener(ev, () => setTimeout(ajustarTela, 60)));
window.visualViewport?.addEventListener('resize', () => setTimeout(ajustarTela, 60));
['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) => document.addEventListener(ev, () => {
  const ativo = document.fullscreenElement || document.webkitFullscreenElement;
  if (!ativo && telaCheiaNativa) sairTelaCheia(); // saiu pelo botão voltar do celular
  else setTimeout(ajustarTela, 60);
}));

// ---------------------------------------------------------------------
// Controles: teclado, botões de toque e atalhos da interface
// ---------------------------------------------------------------------
function ligarControles() {
  const t = tela();
  document.addEventListener('keydown', (e) => {
    if (!t.contains(document.activeElement) && document.activeElement !== document.body) return;
    if (e.code === 'Escape') { if (fecharTudo()) e.preventDefault(); return; }
    if (painelAberto()) return;
    if (st.jogo && !st.jogo.pausado && st.jogo.tecla(e, true)) e.preventDefault();
  });
  document.addEventListener('keyup', (e) => { st.jogo?.tecla(e, false); });
  window.addEventListener('blur', () => { if (st.jogo) { st.jogo.teclas.clear(); st.jogo._desde = {}; } });

  $$('.t-dpad button').forEach((b) => {
    const d = b.dataset.dir;
    const on = (e) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); st.jogo.direcaoToque(d, true); };
    const off = () => st.jogo.direcaoToque(d, false);
    b.addEventListener('pointerdown', on);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => b.addEventListener(ev, off));
  });
  $('.t-a').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (painelAberto()) { const foco = $('.t-dialogo:not([hidden]) .t-op:focus') || $('.t-dialogo:not([hidden]) .t-op'); foco?.click(); return; }
    st.jogo.acao();
  });
  $('.t-b').addEventListener('pointerdown', (e) => { e.preventDefault(); fecharTudo(); });

  t.addEventListener('click', (e) => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    const a = b.dataset.acao;
    if (a === 'missao') abrirMissao();
    else if (a === 'lista') abrirLista();
    else if (a === 'som') { const v = somLigado(!somLigado()); b.setAttribute('aria-pressed', String(v)); b.textContent = v ? 'SOM' : 'MUDO'; if (v && !st.jogo.pausado) musica(true); }
    else if (a === 'fechar') fecharTudo();
    else if (a === 'sair') sairTelaCheia();
  });
  const bs = $('[data-acao="som"]');
  bs.textContent = somLigado() ? 'SOM' : 'MUDO'; bs.setAttribute('aria-pressed', String(somLigado()));
}

// ---------------------------------------------------------------------
// HUD, avisos e dicas
// ---------------------------------------------------------------------
function energia() { return 0.15 + 0.85 * (st.feitas.size / MISSOES.length); }
function atualizarHud() {
  const e = energia();
  $('.t-barra i').style.width = Math.round(e * 100) + '%';
  $('.t-barra').classList.toggle('cheia', e >= 1);
  $('[data-acao="missao"] b').textContent = `${st.feitas.size}/${MISSOES.length}`;
  $('[data-acao="lista"] b').textContent = String(st.lista.size);
  if (st.jogo) st.jogo.humor = e > 0.5;
}
let toastTimer;
function toast(texto, ms = 2600) {
  const el = $('.t-toast');
  el.textContent = texto; el.hidden = false;
  el.classList.remove('sai'); void el.offsetWidth; el.classList.add('entra');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.add('sai'); setTimeout(() => { el.hidden = true; }, 300); }, ms);
}
function aoMudarZona(z) { if (st.jogo && !st.jogo.pausado && z.chave !== 'entrada') toast(z.nome.toUpperCase(), 1600); }
function aoMudarAlvo(alvo) {
  const el = $('.t-dica');
  if (!alvo) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = String(h`<span class="t-tecla">A</span> ${alvo.tipo === 'dudu' ? 'Falar com o Dudu' : alvo.p.nome}`);
}

function concluir(chave) {
  if (st.feitas.has(chave)) return;
  st.feitas.add(chave);
  efeito('moeda');
  const nome = MISSOES.find(([c]) => c === chave)[1];
  toast(`✔ ${nome}  (${st.feitas.size}/${MISSOES.length})`);
  atualizarHud();
  if (st.feitas.size === MISSOES.length && !st.completou) {
    st.completou = true;
    setTimeout(() => {
      fecharTudo(true);
      st.jogo.festa(3.5); efeito('festa'); musica(false);
      setTimeout(abrirPremio, 1400);
    }, 900);
  }
}

// ---------------------------------------------------------------------
// Painéis (card do produto, lista, missão, prêmio)
// ---------------------------------------------------------------------
function painelAberto() { return !$('.t-painel').hidden || !$('.t-dialogo').hidden; }
function abrirPainel(html, classe = '') {
  const p = $('.t-painel');
  p.className = 't-painel ' + classe;
  p.onclick = null;
  p.innerHTML = String(h`<div class="t-caixa"><button class="t-x" type="button" data-acao="fechar" aria-label="Fechar">×</button>${html}</div>`);
  p.hidden = false;
  st.jogo.pausar(true);
  efeito('abrir');
  setTimeout(() => ($('.t-caixa [autofocus]', p) || $('.t-caixa button:not(.t-x), .t-caixa a, .t-caixa input', p))?.focus({ preventScroll: true }), 30);
  return p;
}
function fecharTudo(silencioso = false) {
  const p = $('.t-painel'), d = $('.t-dialogo');
  if (p.hidden && d.hidden) return false;
  p.hidden = true; d.hidden = true; p.innerHTML = '';
  if (st.aberto?.tipo === 'base') st.jogo.abrirBau(st.aberto, false);
  st.aberto = null;
  if (!silencioso) efeito('fechar');
  if (st.jogo && !st.completouAberto) st.jogo.pausar(false);
  tela().focus({ preventScroll: true });
  return true;
}

function miniatura(item) {
  const [cv, c] = novoCanvas(70, 50);
  const p = item.p;
  if (item.tipo === 'cama') cama(c, 8, 8, 'E', p);
  else if (item.tipo === 'base') (p.categoria_slug === 'box-bau' ? bau : baseBox)(c, 6, 10, 'E', p, p.categoria_slug === 'box-bau' ? 1 : 0);
  else mesa(c, 6, 14, [p, p]);
  return cv.toDataURL();
}

function aoInteragir(alvo) {
  if (alvo.tipo === 'dudu') { conversarDudu(); return; }
  abrirProduto(alvo.item);
}

function variacaoDe(p, t) { return (p.variacoes || []).find((v) => v.t === t) || null; }

function abrirProduto(item) {
  const p = item.p;
  st.aberto = item;
  const vars = p.variacoes || [];
  let sel = variacaoDe(p, st.sondagem.tamanho)?.t || vars[0]?.t;
  const foto = urlMidia(p.capa);
  const naLista = st.lista.has(p.id);
  const ehCama = item.tipo === 'cama', ehBau = p.categoria_slug === 'box-bau';
  const html = h`
    <p class="t-cat">${p.categoria}</p>
    <h3 class="t-nome">${p.nome}</h3>
    <div class="t-midia ${foto ? 'foto' : 'pixel'}"><img src="${foto || miniatura(item)}" alt="${foto ? p.nome : ''}" ${foto ? raw('loading="lazy"') : ''}></div>
    ${p.firmeza ? h`<div class="t-firmeza"><span>FIRMEZA</span><span class="t-blocos">${[1, 2, 3, 4, 5].map((i) => h`<i class="${i <= p.firmeza ? 'on' : ''}"></i>`)}</span><b>${nomeFirmeza(p.firmeza)}</b></div>` : ''}
    ${p.tipo || p.altura_cm ? h`<p class="t-meta">${[p.tipo, p.altura_cm ? `${String(p.altura_cm).replace('.', ',')} cm de altura` : ''].filter(Boolean).join(' · ')}</p>` : ''}
    ${p.descricao_curta ? h`<p class="t-desc">${p.descricao_curta}</p>` : ''}
    ${vars.length > 1 ? h`<div class="t-tams" role="group" aria-label="Tamanho">${vars.map((v) => h`<button type="button" class="t-tam" data-t="${v.t}" aria-pressed="${v.t === sel}">${v.tamanho}</button>`)}</div>` : ''}
    <div class="t-preco"></div>
    <div class="t-acoes">
      ${ehCama ? h`<button type="button" class="t-btn ouro" data-x="deitar" autofocus>Deitar pra testar</button>` : ''}
      <button type="button" class="t-btn" data-x="lista">${naLista ? '✔ Na sua lista' : '+ Quero esse'}</button>
      ${p.visivel_site ? h`<a class="t-btn claro" href="produto.html?p=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">Ver no site</a>` : ''}
      <a class="t-btn claro" data-zap target="_blank" rel="noopener">Perguntar no WhatsApp</a>
    </div>`;
  const painel = abrirPainel(html, 't-produto');
  const pintarPreco = () => {
    const v = variacaoDe(p, sel) || vars[0];
    const promo = v && p.na_campanha && v.preco_normal > v.preco;
    $('.t-preco', painel).innerHTML = v ? String(h`
      <small>${vars.length > 1 ? v.tamanho : 'Preço'}</small>
      <strong>${preco(v.preco)}${promo ? h` <s>${preco(v.preco_normal)}</s>` : ''}</strong>
      <span>ou ${parcelas()}x de ${preco(v.preco / parcelas())} sem juros</span>`) : '';
    $('[data-zap]', painel).href = linkZap(`Olá! Vi o ${p.nome}${v && vars.length > 1 ? ` ${v.tamanho}` : ''} no Tour LS do site e quero saber mais.`);
    st.tamanhoSel = sel;
  };
  pintarPreco();
  painel.onclick = ((e) => {
    const tb = e.target.closest('.t-tam');
    if (tb) { sel = tb.dataset.t; $$('.t-tam', painel).forEach((b) => b.setAttribute('aria-pressed', String(b === tb))); pintarPreco(); efeito('blip'); return; }
    const x = e.target.closest('[data-x]')?.dataset.x;
    if (x === 'deitar') { fecharTudo(true); st.jogo.deitar(item); st.testados.add(p.nome); }
    if (x === 'lista') {
      if (st.lista.has(p.id)) st.lista.delete(p.id); else st.lista.set(p.id, { p, t: sel });
      e.target.textContent = st.lista.has(p.id) ? '✔ Na sua lista' : '+ Quero esse';
      efeito(st.lista.has(p.id) ? 'ok' : 'blip'); atualizarHud();
    }
  });
  rastrear('ViewContent', { content_name: p.nome });
  if (ehBau) { st.jogo.abrirBau(item, true); setTimeout(() => concluir('bau'), 500); }
  if (p.categoria_slug === 'travesseiros') concluir('trav');
}

function aoLevantar() {
  toast('Zzz... que conforto!');
  concluir('cama');
}

function abrirMissao() {
  abrirPainel(h`
    <p class="t-cat">MISSÃO</p>
    <h3 class="t-nome">A jornada do sono</h3>
    <ul class="t-checklist">${MISSOES.map(([c, n]) => h`<li class="${st.feitas.has(c) ? 'ok' : ''}"><span>${st.feitas.has(c) ? '✔' : '○'}</span>${n}</li>`)}</ul>
    <p class="t-desc">Complete as 4 e ganhe um <strong>${BRINDE}</strong> de brinde nas compras a partir de ${fmt.reais(MINIMO)} na LS.</p>
    <div class="t-acoes"><button type="button" class="t-btn ouro" data-acao="fechar" autofocus>Continuar</button></div>`);
}

function textoItemLista({ p, t }) {
  const v = variacaoDe(p, t) || (p.variacoes || [])[0];
  return `${p.nome}${v && p.variacoes.length > 1 ? ` ${v.tamanho}` : ''}${v ? ` (${preco(v.preco)})` : ''}`;
}
function abrirLista() {
  const itens = [...st.lista.values()];
  const msg = `Olá! Montei minha lista no Tour LS do site:\n${itens.map((i) => '• ' + textoItemLista(i)).join('\n')}\nPode me ajudar?`;
  const painel = abrirPainel(h`
    <p class="t-cat">SUA LISTA</p>
    <h3 class="t-nome">${itens.length ? 'Produtos que você curtiu' : 'Sua lista está vazia'}</h3>
    ${itens.length ? h`<ul class="t-lista">${itens.map((i) => h`<li><span>${textoItemLista(i)}</span><button type="button" class="t-rem" data-id="${i.p.id}" aria-label="Tirar ${i.p.nome} da lista">×</button></li>`)}</ul>`
      : h`<p class="t-desc">Chegue perto de um produto, aperte A e toque em “+ Quero esse”.</p>`}
    <div class="t-acoes">
      ${itens.length ? h`<a class="t-btn ouro" data-zap target="_blank" rel="noopener" href="${linkZap(msg)}">Enviar lista no WhatsApp</a>` : ''}
      <button type="button" class="t-btn claro" data-acao="fechar">Continuar</button>
    </div>`);
  painel.onclick = ((e) => {
    const b = e.target.closest('.t-rem');
    if (b) { st.lista.delete(b.dataset.id); atualizarHud(); fecharTudo(true); abrirLista(); }
  });
}

// ---------------------------------------------------------------------
// Conversa com o Dudu (mesma sondagem do roteiro de vendas da loja)
// ---------------------------------------------------------------------
let digitando;
function falar(texto, opcoes) {
  const d = $('.t-dialogo');
  d.hidden = false; st.jogo.pausar(true);
  d.innerHTML = String(h`
    <div class="t-fala"><span class="t-quem">DUDU</span><p class="t-texto" aria-live="polite"></p>
    <div class="t-ops" hidden>${opcoes.map((o, i) => h`<button type="button" class="t-op" data-i="${i}">${o.rotulo}</button>`)}</div></div>`);
  const alvo = $('.t-texto', d), ops = $('.t-ops', d);
  clearInterval(digitando);
  let n = 0;
  const mostrarOps = () => { clearInterval(digitando); alvo.textContent = texto; ops.hidden = false; $('.t-op', ops)?.focus({ preventScroll: true }); };
  digitando = setInterval(() => { n += 2; alvo.textContent = texto.slice(0, n); if (n % 6 === 0) efeito('blip'); if (n >= texto.length) mostrarOps(); }, 28);
  d.onclick = (e) => {
    const b = e.target.closest('.t-op');
    if (!b) { if (ops.hidden) mostrarOps(); return; }
    efeito('blip');
    opcoes[Number(b.dataset.i)].acao();
  };
  d.onkeydown = (e) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    const bs = $$('.t-op', d); const i = bs.indexOf(document.activeElement);
    bs[(i + (['ArrowDown', 'ArrowRight'].includes(e.key) ? 1 : bs.length - 1)) % bs.length]?.focus();
    e.preventDefault();
  };
}

function conversarDudu() {
  if (st.indicados.length) {
    falar('E aí, testou as indicações? Quer refazer a escolha?', [
      { rotulo: 'Refazer', acao: perguntarTamanho },
      { rotulo: 'Ver indicações', acao: mostrarIndicacoes },
      { rotulo: 'Valeu, Dudu!', acao: () => fecharTudo() }
    ]);
    return;
  }
  falar('Bom dia! Eu sou o Dudu, da LS. Bora achar o colchão certo pra você? É rapidinho.', [
    { rotulo: 'Bora!', acao: perguntarTamanho },
    { rotulo: 'Só olhando', acao: () => fecharTudo() }
  ]);
}
function perguntarTamanho() {
  const tams = [['S', 'Solteiro'], ['C', 'Casal'], ['Q', 'Queen'], ['K', 'King']];
  falar('Qual tamanho você procura?', tams.map(([t, n]) => ({ rotulo: n, acao: () => { st.sondagem.tamanho = t; st.sondagem.tamanhoNome = n; perguntarBau(); } })));
}
function perguntarBau() {
  falar('Você procura colchão + baú ou só o colchão?', [
    { rotulo: 'Colchão + baú', acao: () => { st.sondagem.bau = true; perguntarConforto(); } },
    { rotulo: 'Só o colchão', acao: () => { st.sondagem.bau = false; perguntarConforto(); } }
  ]);
}
function perguntarConforto() {
  falar('E qual nível de conforto você prefere?', ['macio', 'medio', 'firme'].map((g) => ({
    rotulo: NOME_GRUPO[g][0].toUpperCase() + NOME_GRUPO[g].slice(1),
    acao: () => { st.sondagem.conforto = g; indicar(); }
  })));
}

function indicar() {
  const { tamanho, conforto, bau: comBau } = st.sondagem;
  const col = st.produtos.filter((p) => p.categoria_slug === 'colchoes');
  const precoT = (p) => variacaoDe(p, tamanho)?.preco ?? Infinity;
  let lista = col.filter((p) => variacaoDe(p, tamanho) && GRUPO[conforto].includes(p.firmeza));
  if (!lista.length) lista = col.filter((p) => variacaoDe(p, tamanho));
  lista.sort((a, b) => precoT(a) - precoT(b));
  if (lista.length > 3) lista = [lista[0], lista[Math.floor(lista.length / 2)], lista[lista.length - 1]];
  const ind = lista.map((p) => ({ p, t: tamanho }));
  if (comBau) {
    const baus = st.produtos.filter((p) => p.categoria_slug === 'box-bau' && variacaoDe(p, tamanho)).sort((a, b) => precoT(a) - precoT(b));
    if (baus[0]) ind.push({ p: baus[0], t: tamanho });
  }
  st.indicados = ind;
  st.jogo.destacar(ind.map((i) => i.p.id));
  concluir('dudu');
  mostrarIndicacoes();
}
function mostrarIndicacoes() {
  const { tamanhoNome, conforto, bau: comBau } = st.sondagem;
  if (!st.indicados.length) {
    falar(`Hmm, não achei ${tamanhoNome} nesse estilo no momento. Me chama no WhatsApp que eu vejo pra você!`, [{ rotulo: 'Fechar', acao: () => fecharTudo() }]);
    return;
  }
  fecharTudo(true);
  const painel = abrirPainel(h`
    <p class="t-cat">INDICAÇÃO DO DUDU</p>
    <h3 class="t-nome">${tamanhoNome} · conforto ${NOME_GRUPO[conforto]}${comBau ? ' · com baú' : ''}</h3>
    <ul class="t-indic">${st.indicados.map((i, k) => {
      const v = variacaoDe(i.p, i.t);
      return h`<li><button type="button" class="t-ind" data-k="${k}"><span><b>${i.p.nome}</b><small>${i.p.categoria_slug === 'box-bau' ? 'Base baú' : nomeFirmeza(i.p.firmeza)}</small></span><strong>${v ? preco(v.preco) : ''}</strong></button></li>`;
    })}</ul>
    <p class="t-desc">Marquei no mapa com uma seta dourada. Chega perto e aperte A pra ver de pertinho.</p>
    <div class="t-acoes">
      <button type="button" class="t-btn ouro" data-acao="fechar" autofocus>Ir até lá</button>
      <a class="t-btn claro" data-zap target="_blank" rel="noopener" href="${linkZap(`Olá, Dudu! Fiz o Tour LS: procuro ${tamanhoNome}, conforto ${NOME_GRUPO[conforto]}${comBau ? ', com baú' : ''}. Gostei de: ${st.indicados.map((i) => i.p.nome).join(', ')}.`)}">Falar no WhatsApp</a>
    </div>`);
  painel.onclick = ((e) => {
    const b = e.target.closest('.t-ind');
    if (!b) return;
    const ind = st.indicados[Number(b.dataset.k)];
    const item = st.jogo.m.itens.find((it) => it.p.id === ind.p.id);
    fecharTudo(true);
    if (item) { st.jogo.irPara(item); abrirProduto(item); }
  });
}

// ---------------------------------------------------------------------
// Missão completa: brinde + lead no CRM + WhatsApp
// ---------------------------------------------------------------------
function resumoInteresses() {
  const nomes = [...st.lista.values()].map((i) => i.p.nome).concat(st.indicados.map((i) => i.p.nome));
  return [...new Set(nomes)].slice(0, 8);
}
function mensagemLead() {
  const s = st.sondagem;
  const linhas = [`Tour LS concluído. Brinde: ${BRINDE} (compras a partir de ${fmt.reais(MINIMO)}).`];
  if (s.tamanho) linhas.push(`Sondagem: ${s.tamanhoNome} · ${s.bau ? 'com baú' : 'só colchão'} · conforto ${NOME_GRUPO[s.conforto]}.`);
  if (st.indicados.length) linhas.push(`Indicados pelo Dudu: ${st.indicados.map((i) => textoItemLista(i)).join(', ')}.`);
  if (st.lista.size) linhas.push(`Lista do cliente: ${[...st.lista.values()].map(textoItemLista).join(', ')}.`);
  if (st.testados.size) linhas.push(`Deitou para testar: ${[...st.testados].join(', ')}.`);
  return linhas.join('\n');
}
function mensagemZap() {
  const s = st.sondagem, int = resumoInteresses();
  return `Olá! Completei o Tour LS no site e ganhei o ${BRINDE} de brinde (compras a partir de ${fmt.reais(MINIMO)}).`
    + (int.length ? ` Tenho interesse em: ${int.join(', ')}.` : '')
    + (s.tamanho ? ` Procuro ${s.tamanhoNome}, conforto ${NOME_GRUPO[s.conforto]}${s.bau ? ', com baú' : ''}.` : '');
}

function abrirPremio() {
  st.completouAberto = true;
  const painel = abrirPainel(h`
    <p class="t-cat">MISSÃO COMPLETA!</p>
    <h3 class="t-nome">Você ganhou um ${BRINDE}</h3>
    <p class="t-desc">De brinde nas compras a partir de <strong>${fmt.reais(MINIMO)}</strong> na LS Colchões, na loja ou pelo WhatsApp. Um brinde por cliente.</p>
    <form class="t-form" novalidate>
      <label>Seu nome<input name="nome" autocomplete="name" required maxlength="120"></label>
      <label>WhatsApp<input name="whatsapp" type="tel" autocomplete="tel" required placeholder="(31) 9 0000-0000"></label>
      <label class="campo-extra" aria-hidden="true">Não preencha<input name="site" tabindex="-1" autocomplete="off"></label>
      <p class="t-erro" role="alert" hidden></p>
      <button class="t-btn ouro" type="submit">Garantir meu brinde</button>
    </form>
    <p class="t-aviso">Usamos seus dados só para te atender. Nada de spam.</p>
    <a class="t-link" data-zap target="_blank" rel="noopener" href="${linkZap(mensagemZap())}">Prefiro chamar direto no WhatsApp</a>`, 't-premio');
  $('input[name="nome"]', painel).focus();
  $('.t-form', painel).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, err = $('.t-erro', f), btn = $('button[type="submit"]', f);
    err.hidden = true; btn.disabled = true; btn.textContent = 'Enviando...';
    try {
      await site.enviarLead({
        nome: f.nome.value, whatsapp: f.whatsapp.value, campoExtra: f.site.value,
        interesses: resumoInteresses(), tamanho: st.sondagem.tamanho || null,
        comoDorme: st.sondagem.conforto ? `conforto ${NOME_GRUPO[st.sondagem.conforto]}` : null,
        mensagem: mensagemLead(), pagina: '/tour'
      });
      st.enviado = true;
      rastrear('Lead', { content_name: 'Tour LS' });
      efeito('ok');
      $('.t-caixa', painel).innerHTML = String(h`
        <button class="t-x" type="button" data-acao="fechar" aria-label="Fechar">×</button>
        <p class="t-cat">BRINDE GARANTIDO</p>
        <h3 class="t-nome">Valeu, ${f.nome.value.split(' ')[0]}!</h3>
        <p class="t-desc">Seu ${BRINDE} ficou registrado com a gente. Um consultor vai te chamar, ou você pode chamar agora e já adiantar sua escolha.</p>
        <div class="t-acoes"><a class="t-btn ouro" data-zap target="_blank" rel="noopener" href="${linkZap(mensagemZap())}">Chamar no WhatsApp</a>
        <button type="button" class="t-btn claro" data-acao="fechar">Continuar passeando</button></div>`);
    } catch (ex) {
      err.textContent = ex?.message || 'Não deu para enviar agora. Tente de novo ou chame no WhatsApp.';
      err.hidden = false; btn.disabled = false; btn.textContent = 'Garantir meu brinde';
    }
  });
  painel.onclick = ((e) => { if (e.target.closest('[data-acao="fechar"]')) st.completouAberto = false; });
}

iniciar();
