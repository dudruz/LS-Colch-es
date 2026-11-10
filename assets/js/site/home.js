// Site · Página inicial
import { iniciarPagina, h, raw, ic, $, $$, selo, fmt, urlMidia, site, linkZap, linkMapa, cardProduto, revelar, hidratar, placeholder, rastrear } from './comum.js';

const PADRAO = [{
  eyebrow: 'Loja de colchões em Lagoa Santa', titulo_1: 'Conforto que acolhe.', titulo_2: 'Sono que transforma.',
  texto: 'Aqui você entende antes de comprar. Nossos consultores ajudam você a escolher o colchão certo para o seu corpo, a sua rotina e o seu orçamento.',
  botao_texto: 'Falar com um consultor', botao_destino: 'whatsapp', midia_tipo: 'video'
}];
const PALAVRAS = ['conforto', 'descanso', 'cuidado', 'qualidade', 'bem-estar', 'tranquilidade', 'acolhimento', 'confiança'];
const BENEFICIOS = [
  ['chat', 'Atendimento consultivo', 'A gente ajuda você a escolher, sem empurrar produto.'],
  ['escudo', 'Garantia de fábrica', 'Produtos Ortobom com garantia do fabricante.'],
  ['caminhao', 'Entrega e montagem', 'Combinamos o melhor dia para entregar e montar.'],
  ['cartao', 'Parcelamento', 'Parcele no cartão ou pague no Pix.']
];
const CATS_TXT = {
  colchoes: 'Molas ensacadas, bonnel, espuma e híbridos.',
  'conjuntos-box': 'Colchão e base juntos, prontos para montar.',
  'box-bau': 'Conforto e espaço extra para guardar.',
  travesseiros: 'Para cada posição de dormir.',
  acessorios: 'Protetores e roupa de cama.'
};

function destino(b, d) {
  switch (b.botao_destino) {
    case 'catalogo': return { href: 'catalogo.html' };
    case 'oferta': return { href: d.campanha ? '#oferta' : 'catalogo.html' };
    case 'como_chegar': return { href: linkMapa(), externo: true };
    case 'url': return { href: b.botao_url || '#', externo: /^https?:/.test(b.botao_url || '') };
    default: return { href: linkZap(), externo: true, zap: true };
  }
}

function midiaBanner(b) {
  const url = urlMidia(b.midia_caminho, 'site');
  if (url && b.midia_tipo === 'video') return h`<video class="kb" src="${url}" autoplay muted loop playsinline aria-hidden="true"></video>`;
  if (url) return h`<img class="kb" src="${url}" alt="" loading="eager">`;
  return h`<div class="ph">${b.midia_tipo === 'video' ? ic.play() : ic.camera(40)}<strong style="color:#fff">${b.midia_tipo === 'video' ? 'Vídeo do showroom' : 'Foto do destaque'}</strong></div>`;
}

function cartaoBanner(i, d) {
  if (i === 0) return h`<strong>Showroom em Lagoa Santa</strong><span>Venha deitar antes de decidir</span><a href="loja.html">Como chegar →</a>`;
  const p = d.campanha?.produto;
  if (p) return h`<strong>a partir de ${fmt.reais(p.preco_a_partir)}</strong><span>${p.nome}</span><a href="produto.html?p=${encodeURIComponent(p.slug)}">Ver detalhes →</a>`;
  return h`<strong>Atendimento consultivo</strong><span>Fale com um especialista</span><a href="contato.html">Falar com a gente →</a>`;
}

function montarHero(d) {
  const banners = d.banners?.length ? d.banners : PADRAO;
  $('#slides').innerHTML = String(h`${banners.map((b, i) => {
    const dst = destino(b, d);
    return h`
    <div class="slide" role="group" aria-roledescription="slide" aria-label="${i + 1} de ${banners.length}" ${i ? raw('hidden') : ''}>
      <div class="slide-txt entra">
        <p class="eyebrow claro">${b.eyebrow || ''}</p>
        ${i === 0 ? h`<h1>${b.titulo_1}${b.titulo_2 ? h`<br><em>${b.titulo_2}</em>` : ''}</h1>` : h`<h2 class="hero-h" style="margin:24px 0 0;font-family:var(--serif);font-weight:500;font-size:clamp(46px,5.6vw,82px);line-height:1.02;color:#fff">${b.titulo_1}${b.titulo_2 ? h`<br><em style="color:#E8D6A8">${b.titulo_2}</em>` : ''}</h2>`}
        ${b.texto ? h`<p>${b.texto}</p>` : ''}
        <div class="acoes">
          <a class="btn btn-ouro btn-g pulsa" href="${dst.href}" ${dst.externo ? raw('target="_blank" rel="noopener"') : ''} ${dst.zap ? raw('data-zap') : ''}>${b.botao_texto || 'Saiba mais'} ${ic.seta()}</a>
          <a class="btn btn-claro btn-g" href="catalogo.html">Ver colchões</a>
        </div>
      </div>
      <div class="slide-midia">
        <div class="arco">${midiaBanner(b)}</div>
        <div class="selo" aria-hidden="true">${selo('CONFORTO ESCOLHIDO COM CUIDADO · LS COLCHÕES ·', 'selo' + i)}</div>
        <div class="hero-card">${cartaoBanner(i, d)}</div>
      </div>
    </div>`;
  })}`);

  if (banners.length < 2) return;
  const slides = $$('.slide');
  const tempo = d.config?.tempo_slide_ms || 6500;
  const ctrl = $('#hero-ctrl');
  ctrl.hidden = false;
  ctrl.style.setProperty('--tempo', tempo + 'ms');
  $('[data-hero="anterior"]').innerHTML = String(ic.voltar());
  $('[data-hero="proximo"]').innerHTML = String(ic.seta());
  $('#pontos').innerHTML = String(h`${banners.map((_, i) => h`<button type="button" data-ir="${i}" aria-label="Ir para o destaque ${i + 1}"><span></span></button>`)}`);
  let atual = 0;
  let timer;
  const pausado = () => document.querySelector('.hero:hover') || document.hidden;
  function ir(n) {
    atual = (n + slides.length) % slides.length;
    slides.forEach((s, i) => { s.hidden = i !== atual; });
    $$('#pontos button').forEach((b, i) => b.setAttribute('aria-current', String(i === atual)));
    $('#hero-num').textContent = `${atual + 1} / ${slides.length}`;
    clearInterval(timer);
    if (d.config?.troca_automatica !== false) timer = setInterval(() => { if (!pausado()) ir(atual + 1); }, tempo);
  }
  ctrl.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.ir) ir(+b.dataset.ir);
    else ir(atual + (b.dataset.hero === 'anterior' ? -1 : 1));
  });
  ir(0);
}

function montarOferta(c) {
  const p = c?.produto;
  if (!p) return;
  const sec = $('#oferta');
  sec.hidden = false;
  sec.innerHTML = String(h`
  <div class="wrap oferta-grid">
    <div class="oferta-midia rv rv-e">
      <div class="arco">${p.capa ? h`<img src="${urlMidia(p.capa)}" alt="${p.nome}" loading="lazy">` : placeholder('Foto do produto da campanha')}</div>
      <div class="selo" aria-hidden="true">${selo('CONDIÇÃO ESPECIAL · POR TEMPO LIMITADO ·', 'selo-oferta')}</div>
    </div>
    <div class="oferta-txt rv rv-d">
      <p class="eyebrow">Oferta do mês · ${c.nome}</p>
      <h2 class="titulo" style="font-size:clamp(38px,4.2vw,58px)">${p.nome}</h2>
      <div style="margin-top:26px;display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px 24px">
        <div><small style="font-size:13px;color:var(--mut)">a partir de</small><div class="serif" style="font-weight:600;font-size:54px;line-height:1;color:var(--navy)">${fmt.reais(p.preco_a_partir)}</div></div>
        ${p.preco_normal_a_partir > p.preco_a_partir ? h`<div style="padding-bottom:6px;font-size:14px;color:var(--mut)">de <s>${fmt.reais(p.preco_normal_a_partir)}</s></div>` : ''}
      </div>
      ${c.mostrar_contagem && c.termina_em ? h`
      <div style="margin-top:30px">
        <span style="font-size:12px;font-weight:600;letter-spacing:.2em;color:var(--navy)">A CONDIÇÃO TERMINA EM</span>
        <div class="contagem" data-contagem="${c.termina_em}">
          <div><b data-d>00</b><small>DIAS</small></div><div><b data-h>00</b><small>HORAS</small></div>
          <div><b data-m>00</b><small>MIN</small></div><div><b data-s>00</b><small>SEG</small></div>
        </div>
      </div>` : ''}
      <div style="margin-top:30px;display:flex;flex-wrap:wrap;gap:12px">
        <a class="btn btn-navy btn-g" href="${linkZap(`Olá! Quero garantir o ${p.nome} da campanha ${c.nome}.`)}" target="_blank" rel="noopener" data-zap>Garantir pelo WhatsApp ${ic.seta()}</a>
        <a class="btn btn-contorno btn-g" href="produto.html?p=${encodeURIComponent(p.slug)}">Ver detalhes</a>
      </div>
    </div>
  </div>`);
}

async function enviarLead(form) {
  const erro = $('.msg-erro', form);
  const botao = $('button[type=submit]', form);
  erro.hidden = true;
  const f = new FormData(form);
  botao.disabled = true;
  botao.textContent = 'Enviando…';
  try {
    await site.enviarLead({ nome: f.get('nome'), whatsapp: f.get('whatsapp'), interesses: [f.get('interesse')], campoExtra: f.get('site'), pagina: 'home' });
    rastrear('Lead');
    form.innerHTML = String(h`<div class="sucesso" style="grid-column:1/-1" role="status"><h3>Recebemos seu contato.</h3><p style="margin:0">Um consultor da LS vai te chamar no WhatsApp em horário comercial.</p><a class="btn btn-navy" href="${linkZap()}" target="_blank" rel="noopener" data-zap>Adiantar a conversa no WhatsApp</a></div>`);
  } catch (e) {
    erro.textContent = e.message;
    erro.hidden = false;
    botao.disabled = false;
    botao.textContent = 'Quero ser atendido';
  }
}

(async () => {
  const d = await iniciarPagina('inicio');
  montarHero(d);
  $('#palavras').innerHTML = String(h`${[...PALAVRAS, ...PALAVRAS].map((p) => h`<span>${p}</span>`)}`);
  $('#beneficios').innerHTML = String(h`${BENEFICIOS.map(([i, t, x]) => h`<div class="benef rv"><span class="icone-box">${ic[i](26)}</span><div><h3>${t}</h3><p>${x}</p></div></div>`)}`);

  const cats = (d.categorias || []).slice(0, 4);
  $('#categorias').innerHTML = String(h`${cats.map((c) => h`
    <a class="card-cat rv" href="catalogo.html?categoria=${encodeURIComponent(c.slug)}">
      <div class="img"><img src="assets/img/fotos/cat-${c.slug}.jpg" alt="" loading="lazy" data-falta="Foto: ${c.nome}"></div>
      <h3>${c.nome}</h3><p>${CATS_TXT[c.slug] || ''}</p>
    </a>`)}`);
  $('#tamanhos').innerHTML = String(h`${(d.tamanhos || []).filter((t) => t.codigo !== 'SS').map((t) => h`<a class="chip" href="catalogo.html?tamanho=${t.codigo}">${t.nome} <small>${t.largura_cm} × ${t.comprimento_cm}</small></a>`)}`);

  montarOferta(d.campanha);

  if (d.destaques?.length) {
    $('#sec-destaques').hidden = false;
    $('#destaques').innerHTML = String(h`${d.destaques.slice(0, 4).map((p) => cardProduto(p))}`);
  }
  if (d.depoimentos?.length) {
    $('#sec-depo').hidden = false;
    $('#depoimentos').innerHTML = String(h`${d.depoimentos.slice(0, 6).map((x) => h`<figure class="depo rv"><blockquote>${x.texto}</blockquote><figcaption><strong>${x.nome}</strong>${x.fonte || ''}</figcaption></figure>`)}`);
  }

  const form = $('#form-lead');
  form.addEventListener('submit', (e) => { e.preventDefault(); enviarLead(form); });

  hidratar();
  revelar();
})();
