// =====================================================================
// Site · partes comuns: topo, rodapé, campanha, WhatsApp, animações e rastreamento
// =====================================================================
import { site, urlMidia, fmt } from '../api.js';
import { LOGO_ORTOBOM, META_PIXEL_ID, GA4_ID } from '../config.js';
import { h, raw, ic, $, $$, selo } from '../html.js';

export { h, raw, ic, $, $$, selo, fmt, urlMidia, site };

const CACHE = 'ls_home_v1';
let dados = null;

/** Dados gerais do site (config, campanha, banners...). Guarda 5 min na sessão. */
export async function carregarDados({ fresco = false } = {}) {
  if (dados) return dados;
  if (!fresco) {
    try {
      const c = JSON.parse(sessionStorage.getItem(CACHE) || 'null');
      if (c && Date.now() - c.t < 5 * 60 * 1000) return (dados = c.d);
    } catch { /* sem cache */ }
  }
  try {
    dados = await site.home();
    try { sessionStorage.setItem(CACHE, JSON.stringify({ t: Date.now(), d: dados })); } catch { /* sem cache */ }
  } catch (e) {
    console.error(e);
    dados = { config: {}, campanha: null, banners: [], destaques: [], depoimentos: [], categorias: [], tamanhos: [] };
  }
  return dados;
}

export const cfg = () => dados?.config || {};
const MSG_PADRAO = 'Olá! Vim pelo site da LS Colchões e quero ajuda para escolher.';
export const linkZap = (msg) => site.linkWhatsApp(cfg().whatsapp, msg || cfg().mensagem_whatsapp || MSG_PADRAO);
export const linkMapa = () => cfg().maps_url || 'https://www.google.com/maps/search/?api=1&query=Av.+Pref.+Jo%C3%A3o+Daher+1277+Lagoa+Santa+MG';
export const endereco = () => cfg().endereco || 'Av. Pref. João Daher, 1277, loja 3 · Lagoa Santa/MG';
export function horarioTexto() {
  const hr = cfg().horarios || {};
  const p = [];
  if (hr.seg_sex) p.push('Seg a sex, ' + hr.seg_sex);
  if (hr.sabado) p.push('Sáb, ' + hr.sabado);
  return p.join(' · ') || 'Consulte nosso horário pelo WhatsApp';
}
export const ortobom = () => (LOGO_ORTOBOM ? h`<img class="logo-ortobom" src="${LOGO_ORTOBOM}" alt="Ortobom" decoding="async">` : h`<span class="ortobom">ORTOBOM</span>`);

export function placeholder(texto, icone = true) {
  return h`<div class="ph">${icone ? ic.camera() : ''}${texto}</div>`;
}
export function imagem(caminho, alt, textoFalta, bucket = 'produtos') {
  const url = urlMidia(caminho, bucket);
  return url ? h`<img src="${url}" alt="${alt}" loading="lazy" decoding="async">` : placeholder(textoFalta);
}

// ---------------------------------------------------------------------
// Rastreamento (Meta Pixel e GA4) — só liga se os IDs estiverem no config.js
// ---------------------------------------------------------------------
function iniciarRastreamento() {
  if (META_PIXEL_ID && !window.fbq) {
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', META_PIXEL_ID);
    window.fbq('track', 'PageView');
  }
  if (GA4_ID && !window.gtag) {
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID);
  }
}
/** evento: 'Lead' | 'Contact' | 'ViewContent' */
export function rastrear(evento, extra = {}) {
  try {
    if (window.fbq) window.fbq('track', evento, extra);
    if (window.gtag) window.gtag('event', evento === 'Lead' ? 'generate_lead' : evento === 'Contact' ? 'contact' : 'view_item', extra);
  } catch { /* nada */ }
}

// ---------------------------------------------------------------------
// Topo, faixa de campanha, rodapé e botões fixos
// ---------------------------------------------------------------------
const PAGINAS = [['inicio', 'Início', 'index.html'], ['colchoes', 'Colchões', 'catalogo.html'], ['loja', 'A Loja', 'loja.html'], ['contato', 'Contato', 'contato.html']];

function topo(ativa) {
  return h`
  <div class="topo-in">
    <div class="marca">
      <a href="index.html" aria-label="LS Colchões, página inicial"><img src="assets/img/ls-logo-cor.svg" alt="LS Colchões" width="117" height="50"></a>
      <span class="revenda"><span>REVENDA AUTORIZADA</span>${ortobom()}</span>
    </div>
    <nav class="nav" id="menu-principal" aria-label="Principal">
      ${PAGINAS.map(([id, nome, href]) => h`<a href="${href}" ${id === ativa ? raw('aria-current="page"') : ''}>${nome}</a>`)}
    </nav>
    <a class="btn btn-navy" href="${linkZap()}" target="_blank" rel="noopener" data-zap>${ic.zap()} Falar com consultor</a>
    <button class="menu-btn" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="menu-principal">${ic.menu()}</button>
  </div>`;
}

function faixaCampanha(c) {
  if (!c) return '';
  try { if (sessionStorage.getItem('ls_faixa_fechada') === c.nome) return ''; } catch { /* nada */ }
  return h`
  <div class="faixa" role="region" aria-label="Campanha">
    <span><strong>${c.nome}</strong> ${c.texto_faixa || ''}</span>
    ${c.mostrar_contagem && c.termina_em ? h`<span class="cd" data-contagem="${c.termina_em}" aria-label="Tempo restante">termina em <b data-d>00d</b><b data-h>00h</b><b data-m>00m</b><b data-s>00s</b></span>` : ''}
    <a href="index.html#oferta">Ver oferta →</a>
    <button class="fechar" type="button" aria-label="Fechar aviso da campanha">${ic.fechar()}</button>
  </div>`;
}

function rodape() {
  const c = cfg();
  return h`
  <div class="rodape-grade">
    <div>
      <img src="assets/img/ls-logo-branca.svg" alt="LS Colchões" width="131" height="56" loading="lazy">
      <p class="lema">Conforto que acolhe.<br>Sono que transforma.</p>
      <span class="selo-revenda"><span>REVENDA<br>AUTORIZADA</span>${ortobom()}</span>
    </div>
    <nav aria-label="Rodapé">
      <h2>NAVEGUE</h2>
      ${PAGINAS.map(([, nome, href]) => h`<a href="${href}">${nome}</a>`)}
    </nav>
    <div>
      <h2>VISITE A LOJA</h2>
      <p style="margin:0 0 8px">${endereco()}</p>
      <p style="margin:0 0 8px">${horarioTexto()}</p>
      <a href="${linkMapa()}" target="_blank" rel="noopener" style="color:#E8D6A8;font-weight:600">Como chegar ${ic.seta(16)}</a>
    </div>
    <div>
      <h2>ATENDIMENTO</h2>
      <p style="margin:0 0 12px">Respondemos pelo WhatsApp em horário comercial.</p>
      <a class="btn btn-ouro" href="${linkZap()}" target="_blank" rel="noopener" data-zap style="display:inline-flex;min-height:48px">${ic.zap()} Falar no WhatsApp</a>
      ${c.instagram ? h`<a href="https://instagram.com/${String(c.instagram).replace('@', '')}" target="_blank" rel="noopener" style="margin-top:8px;color:#E8D6A8">${ic.insta(18)} ${c.instagram}</a>` : ''}
    </div>
  </div>
  <svg class="rodape-ondas" viewBox="0 0 1440 48" preserveAspectRatio="none" fill="none" stroke="#C9A65A" stroke-width="1.2" aria-hidden="true"><path stroke-opacity=".16" d="M0 18C120 2 240 2 360 18S600 34 720 18 960 2 1080 18 1320 34 1440 18"/><path stroke-opacity=".09" d="M0 38C120 22 240 22 360 38S600 54 720 38 960 22 1080 38 1320 54 1440 38"/></svg>
  <div class="rodape-base">
    <span>© ${new Date().getFullYear()} LS Colchões · CNPJ 68.020.458/0001-46</span>
    <span>Site desenvolvido por PX Forge</span>
  </div>`;
}

function botoesFixos() {
  return h`
  <a class="zap-flutuante pulsa" href="${linkZap()}" target="_blank" rel="noopener" data-zap aria-label="Falar com um consultor no WhatsApp">${ic.zap(28)}</a>
  <div class="barra-cel">
    <a class="btn btn-navy" href="${linkZap()}" target="_blank" rel="noopener" data-zap>${ic.zap(18)} WhatsApp</a>
    <a class="btn btn-contorno" href="${linkMapa()}" target="_blank" rel="noopener">Como chegar</a>
  </div>`;
}

// ---------------------------------------------------------------------
// Contagem regressiva (faixa e oferta do mês)
// ---------------------------------------------------------------------
const dois = (n) => String(n).padStart(2, '0');
export function partesContagem(fimIso) {
  const resta = Math.max(0, new Date(fimIso).getTime() - Date.now());
  return { d: dois(Math.floor(resta / 864e5)), h: dois(Math.floor(resta / 36e5) % 24), m: dois(Math.floor(resta / 6e4) % 60), s: dois(Math.floor(resta / 1e3) % 60) };
}
function tickContagens() {
  $$('[data-contagem]').forEach((el) => {
    const p = partesContagem(el.dataset.contagem);
    const suf = el.closest('.faixa') ? { d: 'd', h: 'h', m: 'm', s: 's' } : { d: '', h: '', m: '', s: '' };
    ['d', 'h', 'm', 's'].forEach((k) => { const n = el.querySelector(`[data-${k}]`); if (n) n.textContent = p[k] + suf[k]; });
  });
}

// ---------------------------------------------------------------------
// Animação ao rolar
// ---------------------------------------------------------------------
let observador;
export function revelar(raiz = document) {
  const alvos = $$('.rv:not(.vis), [data-vis]:not(.vis)', raiz);
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    alvos.forEach((a) => a.classList.add('vis'));
    return;
  }
  observador = observador || new IntersectionObserver((itens) => {
    itens.forEach((i) => { if (i.isIntersecting) { i.target.classList.add('vis'); observador.unobserve(i.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  alvos.forEach((a) => observador.observe(a));
}

// ---------------------------------------------------------------------
// Card de produto (Home, Catálogo e relacionados)
// ---------------------------------------------------------------------
const SELOS = { mais_escolhido: 'Mais escolhido', novidade: 'Novidade', oferta: 'Oferta' };
const FIRMEZA = ['', 'Muito macia', 'Macia', 'Média', 'Firme', 'Muito firme'];
export const nomeFirmeza = (n) => FIRMEZA[n] || '';
export function barrasFirmeza(n) {
  return h`<span class="barras" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => h`<i class="${i <= (n || 0) ? 'on' : ''}"></i>`)}</span>`;
}
export function cardProduto(p, classe = '') {
  const url = `produto.html?p=${encodeURIComponent(p.slug)}`;
  const msg = `Olá! Vi o ${p.nome} no site e quero saber mais.`;
  return h`
  <article class="card-prod ${classe}" data-vis>
    <a class="img" href="${url}" tabindex="-1" aria-hidden="true">
      ${imagem(p.capa, p.nome, 'Foto do produto')}
      ${p.tipo ? h`<span class="etiqueta">${p.tipo}</span>` : ''}
      ${p.selo ? h`<span class="selo-card">${SELOS[p.selo] || p.selo}</span>` : ''}
    </a>
    <div class="card-corpo">
      <div>${ortobom()}<h3><a href="${url}">${p.nome}</a></h3>${p.altura_cm ? h`<p class="meta">Altura ${String(p.altura_cm).replace('.', ',')} cm</p>` : ''}</div>
      ${p.firmeza ? h`<div class="firmeza"><span>Firmeza</span>${barrasFirmeza(p.firmeza)}<strong>${nomeFirmeza(p.firmeza)}</strong></div>` : ''}
      <div class="preco">
        <small>a partir de</small>
        <strong>${fmt.reais(p.preco_a_partir)}${p.na_campanha && p.preco_normal_a_partir > p.preco_a_partir ? h`<s>${fmt.reais(p.preco_normal_a_partir)}</s>` : ''}</strong>
        <span>ou em até 10x no cartão</span>
      </div>
      <div class="card-acoes">
        <a class="btn btn-contorno" href="${url}">Ver detalhes</a>
        <a class="btn btn-navy btn-redondo" href="${linkZap(msg)}" target="_blank" rel="noopener" data-zap aria-label="Perguntar no WhatsApp sobre ${p.nome}">${ic.zap()}</a>
      </div>
    </div>
  </article>`;
}

// ---------------------------------------------------------------------
// Preenche marcações simples do HTML estático
//   data-ic="pin"            → ícone
//   data-zap-msg="..."       → link do WhatsApp com a mensagem
//   data-mapa                → link do Google Maps
//   data-info="endereco"     → endereço / horario / instagram
//   data-foto="fotos/x.jpg"  → foto local em assets/img (mostra aviso se faltar)
// ---------------------------------------------------------------------
export function hidratar(raiz = document) {
  $$('[data-ic]', raiz).forEach((el) => { const f = ic[el.dataset.ic]; if (f) el.outerHTML = String(f()); });
  $$('[data-zap-msg]', raiz).forEach((el) => { el.href = linkZap(el.dataset.zapMsg); el.dataset.zap = ''; });
  $$('[data-mapa]', raiz).forEach((el) => { el.href = linkMapa(); });
  const info = { endereco: endereco(), horario: horarioTexto(), instagram: cfg().instagram || '@ls_colchoes' };
  $$('[data-info]', raiz).forEach((el) => { el.textContent = info[el.dataset.info] || ''; });
  $$('[data-foto]', raiz).forEach((el) => {
    el.innerHTML = String(h`<img src="assets/img/${el.dataset.foto}" alt="${el.dataset.alt || ''}" loading="lazy" data-falta="${el.dataset.falta || 'Foto'}">`);
    el.removeAttribute('data-foto');
  });
  const insta = $('#link-insta', raiz);
  if (insta) insta.href = 'https://instagram.com/' + String(cfg().instagram || '@ls_colchoes').replace('@', '');
}
// foto local que ainda não existe vira um aviso elegante
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img.tagName === 'IMG' && img.dataset.falta) img.replaceWith(document.createRange().createContextualFragment(String(placeholder(img.dataset.falta))));
}, true);

// ---------------------------------------------------------------------
// Inicialização de toda página
// ---------------------------------------------------------------------
export async function iniciarPagina(ativa) {
  iniciarRastreamento();
  const d = await carregarDados();
  const topoEl = $('#topo');
  if (topoEl) {
    topoEl.className = 'topo';
    topoEl.innerHTML = topo(ativa);
    topoEl.insertAdjacentHTML('beforebegin', String(faixaCampanha(d.campanha)));
    const btn = $('.menu-btn', topoEl);
    btn.addEventListener('click', () => {
      const aberto = topoEl.classList.toggle('aberto');
      btn.setAttribute('aria-expanded', String(aberto));
      btn.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
    });
  }
  const rod = $('#rodape');
  if (rod) {
    rod.className = 'rodape';
    rod.innerHTML = rodape();
    document.body.insertAdjacentHTML('beforeend', String(botoesFixos()));
  }
  const fechar = $('.faixa .fechar');
  if (fechar) {
    fechar.addEventListener('click', () => {
      try { sessionStorage.setItem('ls_faixa_fechada', d.campanha?.nome || '1'); } catch { /* nada */ }
      fechar.closest('.faixa').remove();
    });
  }
  // qualquer clique em WhatsApp conta como contato no Pixel/GA4
  document.addEventListener('click', (e) => { if (e.target.closest('[data-zap]')) rastrear('Contact'); });
  hidratar();
  tickContagens();
  setInterval(tickContagens, 1000);
  revelar();
  return d;
}
