// Site · Página de produto (produto.html?p=slug)
import { iniciarPagina, h, raw, ic, $, $$, fmt, urlMidia, site, linkZap, linkMapa, cardProduto, revelar, ortobom, placeholder, barrasFirmeza, nomeFirmeza, rastrear } from './comum.js';

const SELOS = { mais_escolhido: 'Mais escolhido', novidade: 'Novidade', oferta: 'Oferta' };
let p;
let tam = 0;
let foto = 0;

function midia(m) {
  const url = urlMidia(m?.caminho);
  if (!url) return placeholder('Foto do produto');
  return m.tipo === 'video'
    ? h`<video src="${url}" controls playsinline preload="metadata"></video>`
    : h`<img src="${url}" alt="${m.legenda || p.nome}">`;
}

function msgCompra() {
  const v = p.variacoes[tam];
  return v ? `Olá! Quero comprar o ${p.nome} no tamanho ${v.tamanho} (${v.largura_cm || ''}×${v.comprimento_cm || ''}). Pode me ajudar?` : `Olá! Quero saber mais sobre o ${p.nome}.`;
}

function render() {
  const v = p.variacoes[tam];
  const midias = p.midias.length ? p.midias : [null];
  $('#produto').innerHTML = String(h`
  <nav class="trilha" aria-label="Você está em"><a href="index.html">Início</a><span aria-hidden="true">/</span><a href="catalogo.html${p.categoria_slug ? '?categoria=' + p.categoria_slug : ''}">${p.categoria || 'Colchões'}</a><span aria-hidden="true">/</span><span aria-current="page">${p.nome}</span></nav>
  <div class="produto" style="margin-top:28px">
    <div class="galeria">
      <div class="foto-principal">${midia(midias[foto])}${p.selo ? h`<span class="selo-card" style="left:20px;right:auto;top:20px">${SELOS[p.selo]}</span>` : ''}</div>
      ${midias.length > 1 ? h`<div class="miniaturas" role="group" aria-label="Fotos do produto">${midias.map((m, i) => h`
        <button type="button" data-foto="${i}" aria-pressed="${String(i === foto)}" aria-label="${m.tipo === 'video' ? 'Vídeo' : 'Foto ' + (i + 1)}">${m.tipo === 'video' ? h`<span class="ph" style="background:var(--navy)">${ic.play(28)}</span>` : h`<img src="${urlMidia(m.caminho)}" alt="" loading="lazy">`}</button>`)}</div>` : ''}
    </div>
    <div class="info-prod">
      <div>
        <p class="eyebrow" style="gap:12px">${ortobom()} ${p.tipo || ''}</p>
        <h1>${p.nome}</h1>
        <p style="margin:10px 0 0;font-size:13px;color:var(--mut)">${p.codigo ? 'Ref. ' + p.codigo : ''}${p.altura_cm ? ' · Altura ' + String(p.altura_cm).replace('.', ',') + ' cm' : ''}</p>
        ${p.descricao_curta ? h`<p class="texto">${p.descricao_curta}</p>` : ''}
      </div>
      ${p.firmeza ? h`<div class="firmeza" data-vis style="font-size:13px"><span>Firmeza</span>${barrasFirmeza(p.firmeza)}<strong>${nomeFirmeza(p.firmeza)}</strong></div>` : ''}
      ${p.variacoes.length > 1 || (p.variacoes[0] && p.variacoes[0].largura_cm) ? h`
      <fieldset style="border:0;margin:0;padding:0">
        <legend style="width:100%;display:flex;justify-content:space-between;font-size:13px;font-weight:600;color:var(--navy);padding:0">Tamanho <a href="catalogo.html#medidas" style="color:var(--ouro-txt)">Guia de medidas</a></legend>
        <div class="tamanhos-sel">${p.variacoes.map((x, i) => h`<button type="button" data-tam="${i}" aria-pressed="${String(i === tam)}">${x.tamanho}<small>${x.largura_cm ? x.largura_cm + ' × ' + x.comprimento_cm : ''}</small></button>`)}</div>
      </fieldset>` : ''}
      <div class="caixa-preco">
        <div>
          <small style="font-size:12px;color:var(--mut)">${v ? v.tamanho + ' · ' : ''}${p.variacoes.length > 1 ? 'preço' : 'a partir de'}</small>
          <div class="valor">${fmt.reais(v ? v.preco : p.preco_a_partir)}${v && v.preco_normal > v.preco ? h` <s style="font-size:20px;color:var(--mut)">${fmt.reais(v.preco_normal)}</s>` : ''}</div>
          <span style="font-size:14px">em até 10x no cartão · consulte condição no Pix</span>
          ${v?.pronta_entrega ? h`<div style="margin-top:10px"><span class="pronta">● Pronta entrega</span></div>` : ''}
        </div>
        <a class="btn btn-navy btn-g btn-bloco" href="${linkZap(msgCompra())}" target="_blank" rel="noopener" data-zap>${ic.zap(22)} Comprar pelo WhatsApp</a>
        <a class="btn btn-contorno btn-bloco" href="loja.html">${ic.pin(18)} Experimentar na loja</a>
        <ul class="confianca">
          <li>${ic.escudo()} Garantia de fábrica ${p.fabricante || 'Ortobom'}</li>
          <li>${ic.caminhao()} Entrega e montagem na região</li>
          <li>${ic.cartao()} Parcele no cartão</li>
        </ul>
      </div>
      <div style="display:flex;align-items:center;gap:16px;padding:18px 20px;border-radius:20px;background:#F1EDE1">
        <span class="icone-box" style="border-radius:50%">${ic.chat(24)}</span>
        <div style="flex:1;min-width:0"><strong style="display:block;color:var(--navy)">Ficou com dúvida?</strong><span style="font-size:13px">Um consultor da LS responde pelo WhatsApp.</span></div>
        <a class="btn btn-navy btn-redondo" href="${linkZap('Olá! Tenho uma dúvida sobre o ' + p.nome + '.')}" target="_blank" rel="noopener" data-zap aria-label="Tirar dúvida no WhatsApp">${ic.zap()}</a>
      </div>
    </div>
  </div>`);
  revelar();
}

function renderDetalhes() {
  const abas = [['descricao', 'Descrição', p.descricao || p.descricao_curta || p.indicado_para?.length], ['ficha', 'Ficha técnica', p.ficha.length], ['medidas', 'Medidas', p.variacoes.some((v) => v.largura_cm)]].filter((a) => a[2]);
  if (!abas.length && !p.camadas.length) return;
  const sec = $('#detalhes');
  sec.hidden = false;
  sec.innerHTML = String(h`
  <div class="wrap duas-col" style="align-items:flex-start">
    ${abas.length ? h`
    <div style="flex:1.3 1 520px">
      <div class="abas" role="tablist" aria-label="Informações do produto">${abas.map(([id, nome], i) => h`<button type="button" role="tab" id="aba-${id}" aria-controls="painel-${id}" aria-selected="${String(i === 0)}" data-aba="${id}">${nome}</button>`)}</div>
      <div id="painel-descricao" role="tabpanel" aria-labelledby="aba-descricao" ${abas[0][0] !== 'descricao' ? raw('hidden') : ''} style="padding-top:30px">
        ${p.descricao ? h`<p class="texto" style="max-width:none;white-space:pre-line;margin:0">${p.descricao}</p>` : h`<p class="texto" style="margin:0">${p.descricao_curta || ''}</p>`}
        ${p.indicado_para?.length ? h`<h3 style="margin:28px 0 12px;font-size:13px;letter-spacing:.2em;color:var(--ouro-txt)">INDICADO PARA</h3><div class="chips">${p.indicado_para.map((x) => h`<span class="chip" style="cursor:default">${x}</span>`)}</div>` : ''}
      </div>
      <div id="painel-ficha" role="tabpanel" aria-labelledby="aba-ficha" ${abas[0][0] !== 'ficha' ? raw('hidden') : ''} style="padding-top:20px"><dl class="ficha">${p.ficha.map((f) => h`<dt>${f.campo}</dt><dd>${f.valor}</dd>`)}</dl></div>
      <div id="painel-medidas" role="tabpanel" aria-labelledby="aba-medidas" ${abas[0][0] !== 'medidas' ? raw('hidden') : ''} style="padding-top:20px"><dl class="ficha">${p.variacoes.filter((v) => v.largura_cm).map((v) => h`<dt>${v.tamanho}</dt><dd>${v.largura_cm} × ${v.comprimento_cm} cm${p.altura_cm ? ' · altura ' + String(p.altura_cm).replace('.', ',') + ' cm' : ''}</dd>`)}</dl></div>
    </div>` : ''}
    ${p.camadas.length ? h`
    <div style="flex:1 1 380px;background:var(--off);border-radius:28px;overflow:hidden">
      <div class="costura" aria-hidden="true"></div>
      <div style="padding:8px 32px 36px" data-vis>
        <p class="eyebrow" style="gap:0">Por dentro do colchão</p>
        <h2 class="titulo" style="font-size:32px;margin-top:10px">Camada por camada</h2>
        <ol class="camadas">${p.camadas.map((c) => h`<li><span style="background:${/^#[0-9a-f]{3,8}$/i.test(c.cor || '') ? c.cor : '#E9E9E6'}"></span>${c.nome}</li>`)}</ol>
      </div>
    </div>` : ''}
  </div>`);
  revelar();
}

function renderRelacionados() {
  if (!p.relacionados.length) return;
  const sec = $('#relacionados');
  sec.hidden = false;
  sec.innerHTML = String(h`
  <div class="wrap">
    <h2 class="titulo rv" style="margin-bottom:36px;font-size:clamp(30px,3.4vw,46px)">Compare com outros modelos</h2>
    <div class="grade-cards">${p.relacionados.map((r) => cardProduto(r))}</div>
    <div class="cartao-navy rv" style="margin-top:56px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:24px">
      <div style="position:relative"><h3 style="margin:0">Quer deitar nele antes de decidir?</h3><p style="margin:8px 0 0">Ele pode estar montado no showroom, em Lagoa Santa.</p></div>
      <div style="position:relative;display:flex;flex-wrap:wrap;gap:12px">
        <a class="btn btn-ouro" href="${linkMapa()}" target="_blank" rel="noopener">Como chegar</a>
        <a class="btn btn-claro" href="${linkZap('Olá! Quero experimentar o ' + p.nome + ' no showroom. Quando posso ir?')}" target="_blank" rel="noopener" data-zap>Agendar visita</a>
      </div>
    </div>
  </div>`);
  revelar();
}

(async () => {
  await iniciarPagina('colchoes');
  const slug = new URLSearchParams(location.search).get('p');
  try {
    p = slug ? await site.produto(slug) : null;
  } catch (e) {
    p = null;
  }
  if (!p) {
    $('#produto').innerHTML = String(h`<div class="vazio" style="margin:40px 0"><h1 class="serif" style="color:var(--navy);font-weight:500">Produto não encontrado</h1><p>Ele pode ter saído do catálogo. Veja os outros modelos ou fale com a gente.</p><a class="btn btn-navy" href="catalogo.html">Ver colchões</a></div>`);
    return;
  }
  document.title = `${p.nome} · LS Colchões`;
  $('meta[name="description"]').setAttribute('content', (p.descricao_curta || p.nome).slice(0, 155));
  tam = Math.max(0, p.variacoes.findIndex((v) => v.tamanho_codigo === 'C'));
  render();
  renderDetalhes();
  renderRelacionados();
  rastrear('ViewContent', { content_name: p.nome, value: p.preco_a_partir, currency: 'BRL' });

  $('#produto').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tam],[data-foto]');
    if (!b) return;
    if (b.dataset.tam) tam = +b.dataset.tam;
    if (b.dataset.foto) foto = +b.dataset.foto;
    render();
    $(`[data-${b.dataset.tam ? 'tam' : 'foto'}="${b.dataset.tam || b.dataset.foto}"]`)?.focus();
  });
  $('#detalhes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-aba]');
    if (!b) return;
    $$('[data-aba]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    $$('#detalhes [role="tabpanel"]').forEach((pn) => { pn.hidden = pn.id !== 'painel-' + b.dataset.aba; });
  });
})();
