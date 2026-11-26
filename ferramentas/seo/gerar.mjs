#!/usr/bin/env node
// =====================================================================
// Gerador de páginas estáticas de SEO da LS Colchões
//
//   node ferramentas/seo/gerar.mjs
//
// Lê os produtos visíveis no site direto do Supabase (as mesmas funções
// públicas que o site usa) e gera, na raiz do repositório:
//   /<categoria>/                 página da categoria
//   /<categoria>/<produto>/       página do produto
//   /colchoes-em-<cidade>/        páginas das cidades atendidas
//   /guia/ e /guia/<guia>/        guias de compra
//   sitemap.xml e robots.txt
// e atualiza o bloco <!--seo--> do <head> das páginas fixas.
//
// Roda sozinho todo dia pelo GitHub Action (.github/workflows/seo.yml).
// Sem dependências: só Node 20+.
// =====================================================================
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, LOJA, AREA_ATENDIMENTO, CIDADES, GUIAS } from './conteudo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFESTO = path.join(RAIZ, 'ferramentas/seo/gerado.json');
const HOJE = new Date().toISOString().slice(0, 10);
const OG_PADRAO = `${SITE}/assets/img/fotos/showroom.jpg`;

// ---------------------------------------------------------------------
// Supabase (chave pública do config.js)
// ---------------------------------------------------------------------
const configJs = await readFile(path.join(RAIZ, 'assets/js/config.js'), 'utf8');
const SUPABASE_URL = configJs.match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];
const SUPABASE_KEY = configJs.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/)[1];

async function rpc(nome, args = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  if (!r.ok) throw new Error(`${nome}: HTTP ${r.status} ${await r.text()}`);
  return r.json();
}
const urlMidia = (c) => (!c ? null : /^https?:\/\//.test(c) ? c : `${SUPABASE_URL}/storage/v1/object/public/produtos/${c.split('/').map(encodeURIComponent).join('/')}`);

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const reais = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ');
const corta = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)) + '…'; };
const cm = (n) => String(n).replace('.', ',');
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const digitos = (s) => String(s || '').replace(/\D/g, '');

let CONFIG = {};
let PARCELAS = 12;
const zap = (msg) => {
  let n = digitos(CONFIG.whatsapp || LOJA.telefone);
  if (n.length <= 11) n = '55' + n;
  return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;
};
const linkZapAttr = (msg) => `href="${esc(zap(msg))}" data-zap-msg="${esc(msg)}" target="_blank" rel="noopener"`;
const MAPA = 'https://www.google.com/maps/search/?api=1&query=Av.+Pref.+Jo%C3%A3o+Daher+1277+Lagoa+Santa+MG';

// ---------------------------------------------------------------------
// Schema da loja (mesmos dados do Perfil da Empresa no Google)
// ---------------------------------------------------------------------
function schemaLoja() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FurnitureStore',
    '@id': `${SITE}/#loja`,
    name: LOJA.nome,
    legalName: LOJA.razao,
    url: `${SITE}/`,
    logo: `${SITE}/assets/img/ls-logo-cor.svg`,
    image: [`${SITE}/assets/img/fotos/fachada.jpg`, `${SITE}/assets/img/fotos/showroom.jpg`],
    description: 'Loja de colchões em Lagoa Santa/MG, revenda autorizada Ortobom. Colchões, conjuntos box, box baú e travesseiros, com showroom para testar e atendimento consultivo.',
    telephone: LOJA.telefone,
    priceRange: '$$',
    currenciesAccepted: 'BRL',
    paymentAccepted: 'Cartão de crédito, cartão de débito, Pix, dinheiro',
    address: { '@type': 'PostalAddress', streetAddress: LOJA.rua, addressLocality: LOJA.cidade, addressRegion: LOJA.uf, postalCode: LOJA.cep, addressCountry: 'BR' },
    openingHoursSpecification: LOJA.horarios.map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: h.dias, opens: h.abre, closes: h.fecha })),
    areaServed: AREA_ATENDIMENTO.map((c) => ({ '@type': 'City', name: `${c}, MG` })),
    sameAs: [LOJA.instagram],
    brand: { '@type': 'Brand', name: 'Ortobom' }
  };
}
const schemaTrilha = (itens) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: itens.map(([nome, url], i) => ({ '@type': 'ListItem', position: i + 1, name: nome, item: SITE + url }))
});
const schemaFaq = (faq) => ({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: faq.map(([q, r]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: r } }))
});

// ---------------------------------------------------------------------
// Moldura da página (mesmo topo/rodapé do site, montados pelo comum.js)
// ---------------------------------------------------------------------
function pagina({ caminho, titulo, descricao, corpo, schemas = [], ativa = '', script = 'assets/js/site/estatica.js', bodyAttrs = '', og = OG_PADRAO, tipoOg = 'website' }) {
  const url = SITE + caminho;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="/">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
<link rel="canonical" href="${esc(url)}">
<meta name="theme-color" content="#062A4F">
<link rel="icon" href="assets/img/ls-simbolo.svg" type="image/svg+xml">
<meta property="og:type" content="${tipoOg}">
<meta property="og:site_name" content="LS Colchões">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(og)}">
<meta property="og:locale" content="pt_BR">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Montserrat:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="assets/css/site.css">
${schemas.map(jsonLd).join('\n')}
</head>
<body data-pagina="${esc(ativa)}" ${bodyAttrs}>
<a class="pular" href="${esc(caminho)}#conteudo">Pular para o conteúdo</a>
<header id="topo"></header>
<main id="conteudo">
${corpo}
</main>
<footer id="rodape"></footer>
<script type="module" src="${script}"></script>
</body>
</html>
`;
}

const trilha = (itens) => `<nav class="trilha" aria-label="Você está em">${itens.map(([nome, url], i) => (i < itens.length - 1 ? `<a href="${esc(url)}">${esc(nome)}</a><span aria-hidden="true">/</span>` : `<span aria-current="page">${esc(nome)}</span>`)).join('')}</nav>`;

function blocoContato(titulo, texto, msg) {
  return `
  <div class="cartao-navy" style="margin-top:56px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:24px">
    <div style="position:relative"><h3 style="margin:0">${esc(titulo)}</h3><p style="margin:8px 0 0">${esc(texto)}</p></div>
    <div style="position:relative;display:flex;flex-wrap:wrap;gap:12px">
      <a class="btn btn-ouro" ${linkZapAttr(msg)}>Falar no WhatsApp</a>
      <a class="btn btn-claro" href="${MAPA}" data-mapa target="_blank" rel="noopener">Como chegar</a>
    </div>
  </div>`;
}

function blocoFaq(faq) {
  return `<div class="faq">${faq.map(([q, r], i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(q)}</summary><p>${esc(r)}</p></details>`).join('')}</div>`;
}

// ---------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------
const urlProduto = (p) => `/${p.categoria_slug}/${p.slug}/`;
const ehColchao = (p) => p.categoria_slug === 'colchoes' && !/^colch/i.test(p.nome);
const nomeSeo = (p) => (ehColchao(p) ? `Colchão ${p.nome}` : p.nome);
const FIRMEZA = ['', 'Muito macia', 'Macia', 'Média', 'Firme', 'Muito firme'];

function cardEstatico(p) {
  const url = urlProduto(p);
  const img = urlMidia(p.capa);
  return `
    <article class="card-prod" data-vis>
      <a class="img" href="${url}" tabindex="-1" aria-hidden="true">${img ? `<img src="${esc(img)}" alt="${esc(nomeSeo(p))}" loading="lazy" decoding="async">` : '<div class="ph">Foto do produto</div>'}${p.tipo ? `<span class="etiqueta">${esc(p.tipo)}</span>` : ''}</a>
      <div class="card-corpo">
        <div><h3><a href="${url}">${esc(p.nome)}</a></h3>${p.altura_cm ? `<p class="meta">Altura ${cm(p.altura_cm)} cm</p>` : ''}</div>
        ${p.firmeza ? `<div class="firmeza"><span>Firmeza</span><strong>${FIRMEZA[p.firmeza]}</strong></div>` : ''}
        <div class="preco"><small>a partir de</small><strong>${reais(p.preco_a_partir)}</strong><span class="parcela">ou <strong>${PARCELAS}x de ${reais(p.preco_a_partir / PARCELAS)}</strong> sem juros</span></div>
        <div class="card-acoes"><a class="btn btn-contorno" href="${url}">Ver detalhes</a></div>
      </div>
    </article>`;
}

function paginaProduto(p, cat) {
  const caminho = urlProduto(p);
  const fotos = p.midias.filter((m) => m.tipo !== 'video').map((m) => urlMidia(m.caminho));
  const vars = p.variacoes || [];
  const precos = vars.map((v) => Number(v.preco)).filter((n) => n > 0);
  const min = Math.min(...precos);
  const max = Math.max(...precos);
  const tamanhos = vars.map((v) => v.tamanho).join(', ');
  const titulo = `${nomeSeo(p)}${p.categoria_slug === 'colchoes' ? ' Ortobom' : ''}${vars.length > 1 && vars.length <= 4 ? ` · ${tamanhos.replace(/, ([^,]*)$/, ' e $1')}` : ''} · LS Colchões Lagoa Santa`;
  const descricao = corta(`${p.descricao_curta || p.nome}. Em Lagoa Santa/MG, a partir de ${reais(min)} em até ${PARCELAS}x sem juros.`, 158);
  const trilhaItens = [['Início', '/'], [cat.nome, `/${cat.slug}/`], [p.nome, caminho]];
  const marca = (p.ficha || []).find((f) => /marca/i.test(f.campo))?.valor || 'Ortobom';
  const schema = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: nomeSeo(p), description: p.descricao_curta || p.descricao || p.nome, sku: p.codigo || undefined,
    category: p.categoria, brand: { '@type': 'Brand', name: marca }, url: SITE + caminho,
    image: fotos.length ? fotos : undefined,
    offers: {
      '@type': 'AggregateOffer', priceCurrency: 'BRL', lowPrice: min.toFixed(2), highPrice: max.toFixed(2), offerCount: vars.length,
      availability: vars.some((v) => v.pronta_entrega) ? 'https://schema.org/InStock' : 'https://schema.org/BackOrder',
      seller: { '@id': `${SITE}/#loja` }
    }
  };
  const msg = `Olá! Vi o ${p.nome} no site e quero saber mais.`;
  const corpo = `
  <section class="sec" style="padding:28px 0 96px">
    <div class="wrap" id="produto">
      ${trilha(trilhaItens)}
      <div class="produto" style="margin-top:28px">
        <div class="galeria"><div class="foto-principal">${fotos[0] ? `<img src="${esc(fotos[0])}" alt="${esc(nomeSeo(p))}" fetchpriority="high">` : '<div class="ph">Foto do produto</div>'}</div></div>
        <div class="info-prod">
          <div>
            <p class="eyebrow" style="gap:12px">${esc(marca)} ${p.tipo ? '· ' + esc(p.tipo) : ''}</p>
            <h1>${esc(p.nome)}</h1>
            <p style="margin:10px 0 0;font-size:13px;color:var(--mut)">${p.codigo ? 'Ref. ' + esc(p.codigo) : ''}${p.altura_cm ? ' · Altura ' + cm(p.altura_cm) + ' cm' : ''}${p.firmeza ? ' · Firmeza ' + FIRMEZA[p.firmeza].toLowerCase() : ''}</p>
            ${p.descricao_curta ? `<p class="texto">${esc(p.descricao_curta)}</p>` : ''}
          </div>
          <div class="caixa-preco">
            <dl class="ficha">${vars.map((v) => `<dt>${esc(v.tamanho)}${v.largura_cm ? ` · ${v.largura_cm} × ${v.comprimento_cm} cm` : ''}</dt><dd>${reais(v.preco)}</dd>`).join('')}</dl>
            <span class="parcela">Em até <strong>${PARCELAS}x sem juros</strong> no cartão.</span>
            <a class="btn btn-navy btn-g btn-bloco" ${linkZapAttr(msg)}>Comprar pelo WhatsApp</a>
            <a class="btn btn-contorno btn-bloco" href="/loja.html">Experimentar na loja</a>
          </div>
        </div>
      </div>
    </div>
  </section>
  <section class="sec sec-branca" id="detalhes">
    <div class="wrap duas-col" style="align-items:flex-start">
      <div style="flex:1.3 1 520px">
        <h2 class="titulo" style="font-size:32px">Sobre o ${esc(p.nome)}</h2>
        ${p.descricao ? `<p class="texto" style="max-width:none;white-space:pre-line">${esc(p.descricao)}</p>` : ''}
        ${p.indicado_para?.length ? `<h3 style="margin:28px 0 12px;font-size:13px;letter-spacing:.2em;color:var(--ouro-txt)">INDICADO PARA</h3><p>${p.indicado_para.map(esc).join(' · ')}</p>` : ''}
      </div>
      ${p.ficha?.length ? `<div style="flex:1 1 380px"><h2 class="titulo" style="font-size:32px">Ficha técnica</h2><dl class="ficha" style="margin-top:20px">${p.ficha.map((f) => `<dt>${esc(f.campo)}</dt><dd>${esc(f.valor)}</dd>`).join('')}</dl></div>` : ''}
    </div>
  </section>
  <section class="sec" id="relacionados" hidden></section>`;
  return pagina({
    caminho, titulo, descricao, corpo, ativa: 'colchoes', script: 'assets/js/site/produto.js', tipoOg: 'product',
    bodyAttrs: `data-slug="${esc(p.slug)}"`, og: fotos[0] || OG_PADRAO,
    schemas: [schema, schemaTrilha(trilhaItens)]
  });
}

// ---------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------
const INTRO_CATEGORIA = {
  colchoes: { h1: 'Colchões em Lagoa Santa', texto: 'Colchões Ortobom de molas ensacadas e de espuma, do solteiro ao king, para testar no showroom da LS em Lagoa Santa. Compare firmeza, altura e tecnologia com a ajuda de um consultor e parcele em até 12x sem juros.' },
  'box-bau': { h1: 'Box baú em Lagoa Santa', texto: 'Bases box baú com espaço para guardar roupa de cama, edredons e malas sem ocupar o quarto. Escolha o tamanho e o acabamento e combine com o colchão na mesma compra.' },
  bases: { h1: 'Bases box em Lagoa Santa', texto: 'Bases box em vários acabamentos e tamanhos, do solteiro ao king, para montar o conjunto com o colchão certo e deixar a cama firme e nivelada.' },
  'conjuntos-box': { h1: 'Conjuntos box em Lagoa Santa', texto: 'Colchão e base box na medida certa, prontos para montar. Uma forma prática de trocar a cama inteira de uma vez, com garantia de fábrica.' },
  travesseiros: { h1: 'Travesseiros em Lagoa Santa', texto: 'Travesseiros de vários tipos e alturas para completar o conforto do colchão novo. No showroom dá para testar e escolher conforme a posição em que você dorme.' },
  acessorios: { h1: 'Acessórios para a cama em Lagoa Santa', texto: 'Protetores, cabeceiras e outros itens para proteger o colchão e completar o quarto.' }
};

function paginaCategoria(cat, itens) {
  const intro = INTRO_CATEGORIA[cat.slug] || { h1: `${cat.nome} em Lagoa Santa`, texto: `${cat.nome} na LS Colchões, revenda autorizada Ortobom em Lagoa Santa/MG.` };
  const caminho = `/${cat.slug}/`;
  const trilhaItens = [['Início', '/'], [cat.nome, caminho]];
  const min = Math.min(...itens.map((p) => Number(p.preco_a_partir)));
  const corpo = `
  <section class="sec" style="padding:28px 0 96px">
    <div class="wrap">
      ${trilha(trilhaItens)}
      <div class="hd-sec" style="margin-top:28px">
        <div><p class="eyebrow">Revenda autorizada Ortobom</p><h1 class="titulo">${esc(intro.h1)}</h1><p class="texto">${esc(intro.texto)}</p></div>
        <a class="link-seta" href="/catalogo.html?categoria=${esc(cat.slug)}">Filtrar por tamanho e firmeza →</a>
      </div>
      <div class="grade-cards">${itens.map(cardEstatico).join('')}</div>
      ${cat.slug === 'colchoes' ? `<p class="texto" style="max-width:none;margin-top:40px">Na dúvida entre modelos? Leia <a href="/guia/molas-ensacadas-ou-espuma/">molas ensacadas ou espuma</a> e o <a href="/guia/medidas-de-colchao/">guia de medidas</a>.</p>` : ''}
      ${blocoContato('Quer deitar antes de decidir?', 'Os modelos ficam montados no showroom, em Lagoa Santa.', `Olá! Quero ajuda para escolher ${cat.nome.toLowerCase()}.`)}
    </div>
  </section>`;
  return pagina({
    caminho, titulo: `${intro.h1} · a partir de ${reais(min)} · LS Colchões`,
    descricao: corta(intro.texto, 158), corpo, ativa: 'colchoes',
    schemas: [schemaTrilha(trilhaItens), {
      '@context': 'https://schema.org', '@type': 'ItemList', name: intro.h1,
      itemListElement: itens.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + urlProduto(p), name: nomeSeo(p) }))
    }]
  });
}

// ---------------------------------------------------------------------
// Cidades
// ---------------------------------------------------------------------
function paginaCidade(c, destaques) {
  const caminho = `/colchoes-em-${c.slug}/`;
  const nomeH1 = c.regiao ? `${c.nome} (${c.regiao})` : c.nome;
  const trilhaItens = [['Início', '/'], [`Colchões em ${c.nome}`, caminho]];
  const faq = [
    [`A LS Colchões entrega em ${c.nome}?`, `Sim. ${c.nome} está na área de atendimento da LS. O consultor confirma o valor do frete e o prazo pelo WhatsApp antes de você fechar a compra.`],
    ['Dá para comprar sem ir até a loja?', 'Dá. Pelo WhatsApp o consultor entende como você dorme, manda fotos e vídeos dos modelos, passa as medidas e fecha a compra com você.'],
    ['Quais as formas de pagamento?', `Cartão de crédito em até ${PARCELAS}x sem juros, débito, Pix e dinheiro.`],
    ['Onde fica o showroom?', `Na ${LOJA.rua}, bairro ${LOJA.bairro}, em Lagoa Santa. Seg a sex, 9h às 19h, e sábado, 8h30 às 13h.`]
  ];
  const outras = CIDADES.filter((x) => x.slug !== c.slug);
  const corpo = `
  <section class="sec" style="padding:28px 0 64px">
    <div class="wrap">
      ${trilha(trilhaItens)}
      <div class="duas-col" style="margin-top:28px;align-items:flex-start">
        <div>
          <p class="eyebrow">Loja de colchões perto de ${esc(c.nome)}</p>
          <h1 class="titulo">Colchões em ${esc(nomeH1)}</h1>
          <p class="texto">${esc(c.sobre)}</p>
          <p class="texto">A LS Colchões é revenda autorizada Ortobom: colchões de molas ensacadas e de espuma, box baú e travesseiros, com garantia de fábrica e parcelamento em até ${PARCELAS}x sem juros no cartão.</p>
          <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:28px">
            <a class="btn btn-navy" ${linkZapAttr(`Olá! Sou de ${c.nome} e quero ajuda para escolher um colchão.`)}>Falar com consultor</a>
            <a class="btn btn-contorno" href="${MAPA}" data-mapa target="_blank" rel="noopener">Como chegar à loja</a>
          </div>
        </div>
        <div class="cartao-navy">
          <h2 style="position:relative;margin:0;font-family:var(--serif);font-weight:500;font-size:30px;color:#fff">Como funciona para quem é de ${esc(c.nome)}</h2>
          <ol style="position:relative;margin:20px 0 0;padding-left:20px;line-height:1.8">
            <li>Chame no WhatsApp e conte como você dorme e o tamanho da cama.</li>
            <li>Receba as indicações com fotos e vídeos, ou venha testar no showroom (uns ${c.km} km em linha reta).</li>
            <li>Feche a compra e combine a entrega em ${esc(c.nome)}, com frete e prazo informados antes.</li>
          </ol>
        </div>
      </div>
    </div>
  </section>
  ${destaques.length ? `<section class="sec sec-branca" style="padding:80px 0">
    <div class="wrap">
      <div class="hd-sec"><div><p class="eyebrow">No showroom</p><h2 class="titulo">Modelos para conhecer</h2></div><a class="link-seta" href="/catalogo.html">Ver todo o catálogo →</a></div>
      <div class="grade-cards">${destaques.map(cardEstatico).join('')}</div>
    </div>
  </section>` : ''}
  <section class="sec" style="padding:80px 0">
    <div class="wrap duas-col" style="align-items:flex-start">
      <div style="flex:1 1 320px"><p class="eyebrow">Dúvidas</p><h2 class="titulo">Perguntas de quem é de ${esc(c.nome)}</h2></div>
      <div style="flex:2 1 560px">${blocoFaq(faq)}</div>
    </div>
    <div class="wrap">
      ${blocoContato(`Atendimento para ${c.nome}`, 'Um consultor responde pelo WhatsApp em horário comercial.', `Olá! Sou de ${c.nome} e quero saber sobre colchões.`)}
      <p style="margin-top:40px;font-size:14px">Também atendemos: ${outras.map((x) => `<a href="/colchoes-em-${x.slug}/">${esc(x.nome)}</a>`).join(' · ')}.</p>
    </div>
  </section>`;
  return pagina({
    caminho,
    titulo: `Colchões em ${c.nome} · Loja Ortobom a ${c.km} km · LS Colchões`,
    descricao: corta(`Loja de colchões perto de ${c.nome}: revenda Ortobom em Lagoa Santa, a uns ${c.km} km. Molas ensacadas, espuma e box baú em até ${PARCELAS}x sem juros.`, 158),
    corpo, schemas: [schemaTrilha(trilhaItens), schemaFaq(faq)]
  });
}

// ---------------------------------------------------------------------
// Guias
// ---------------------------------------------------------------------
function paginaGuia(g, tamanhos) {
  const caminho = `/guia/${g.slug}/`;
  const trilhaItens = [['Início', '/'], ['Guias', '/guia/'], [g.h1, caminho]];
  const tabela = `<div class="tabela-med" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:15px"><thead><tr><th style="text-align:left;padding:12px;border-bottom:2px solid var(--borda)">Tamanho</th><th style="text-align:left;padding:12px;border-bottom:2px solid var(--borda)">Largura × comprimento</th></tr></thead><tbody>${tamanhos.map((t) => `<tr><td style="padding:12px;border-bottom:1px solid var(--borda)"><strong>${esc(t.nome)}</strong></td><td style="padding:12px;border-bottom:1px solid var(--borda)">${t.largura_cm} × ${t.comprimento_cm} cm</td></tr>`).join('')}</tbody></table></div>`;
  const outras = GUIAS.filter((x) => x.slug !== g.slug);
  const corpo = `
  <section class="sec" style="padding:28px 0 96px">
    <div class="wrap" style="max-width:860px">
      ${trilha(trilhaItens)}
      <article style="margin-top:28px">
        <p class="eyebrow">Guia LS Colchões</p>
        <h1 class="titulo">${esc(g.h1)}</h1>
        <p class="texto" style="max-width:none;font-size:18px">${esc(g.intro)}</p>
        ${g.secoes.map((s) => `<h2 class="titulo" style="font-size:32px;margin-top:48px">${esc(s.h2)}</h2>${s.tabelaTamanhos ? tabela : `<div class="texto" style="max-width:none">${s.html}</div>`}`).join('')}
        <h2 class="titulo" style="font-size:32px;margin-top:48px">Perguntas frequentes</h2>
        <div style="margin-top:20px">${blocoFaq(g.faq)}</div>
      </article>
      ${blocoContato('Ainda na dúvida?', 'Conte como você dorme que um consultor ajuda pelo WhatsApp.', 'Olá! Li o guia no site e quero ajuda para escolher um colchão.')}
      <p style="margin-top:40px;font-size:14px">Outros guias: ${outras.map((x) => `<a href="/guia/${x.slug}/">${esc(x.h1)}</a>`).join(' · ')}.</p>
    </div>
  </section>`;
  return pagina({
    caminho, titulo: `${g.titulo} · LS Colchões`, descricao: g.descricao, corpo, tipoOg: 'article',
    schemas: [schemaTrilha(trilhaItens), schemaFaq(g.faq), {
      '@context': 'https://schema.org', '@type': 'Article', headline: g.titulo, description: g.descricao,
      inLanguage: 'pt-BR', mainEntityOfPage: SITE + caminho, author: { '@id': `${SITE}/#loja` }, publisher: { '@id': `${SITE}/#loja` }
    }]
  });
}

function paginaGuias() {
  const caminho = '/guia/';
  const trilhaItens = [['Início', '/'], ['Guias', caminho]];
  const corpo = `
  <section class="sec" style="padding:28px 0 96px">
    <div class="wrap">
      ${trilha(trilhaItens)}
      <p class="eyebrow" style="margin-top:28px">Antes de comprar, entenda</p>
      <h1 class="titulo">Guias para escolher colchão</h1>
      <div class="grade-cards" style="margin-top:40px">${GUIAS.map((g) => `<article class="card-prod"><div class="card-corpo"><h2 style="font-family:var(--serif);font-weight:500;font-size:26px;color:var(--navy);margin:0"><a href="/guia/${g.slug}/">${esc(g.h1)}</a></h2><p>${esc(g.descricao)}</p><a class="btn btn-contorno" href="/guia/${g.slug}/">Ler o guia</a></div></article>`).join('')}</div>
    </div>
  </section>`;
  return pagina({ caminho, titulo: 'Guias para escolher colchão · LS Colchões', descricao: 'Medidas de colchão, molas ensacadas ou espuma e como escolher em 5 passos: guias da LS Colchões, em Lagoa Santa.', corpo, schemas: [schemaTrilha(trilhaItens)] });
}

// ---------------------------------------------------------------------
// Bloco <!--seo--> das páginas fixas (canonical, og e schema da loja)
// ---------------------------------------------------------------------
const FIXAS = [
  { arquivo: 'index.html', caminho: '/', loja: true },
  { arquivo: 'catalogo.html', caminho: '/catalogo.html' },
  { arquivo: 'loja.html', caminho: '/loja.html', loja: true, og: `${SITE}/assets/img/fotos/fachada.jpg` },
  { arquivo: 'contato.html', caminho: '/contato.html' },
  { arquivo: 'tour.html', caminho: '/tour.html', og: `${SITE}/assets/img/tour/preview.png` }
];
async function atualizarFixas() {
  for (const f of FIXAS) {
    const arq = path.join(RAIZ, f.arquivo);
    let html = await readFile(arq, 'utf8');
    const bloco = `<!--seo-->
<link rel="canonical" href="${SITE}${f.caminho}">
<meta property="og:url" content="${SITE}${f.caminho}">
<meta property="og:image" content="${f.og || OG_PADRAO}">
<meta property="og:site_name" content="LS Colchões">
${f.loja ? jsonLd(schemaLoja()) + '\n' : ''}<!--/seo-->`;
    if (html.includes('<!--seo-->')) html = html.replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, bloco);
    else html = html.replace('</head>', `${bloco}\n</head>`);
    await writeFile(arq, html);
  }
}

// ---------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------
const anterior = existsSync(MANIFESTO) ? JSON.parse(await readFile(MANIFESTO, 'utf8')) : { paginas: {} };
const novo = { paginas: {} };

async function salvar(caminho, html) {
  const hash = createHash('sha1').update(html).digest('hex').slice(0, 12);
  const antes = anterior.paginas[caminho];
  novo.paginas[caminho] = { hash, lastmod: antes && antes.hash === hash ? antes.lastmod : HOJE };
  const dir = path.join(RAIZ, caminho);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), html);
}

const home = await rpc('site_home');
CONFIG = home.config || {};
PARCELAS = Number(CONFIG.parcelas_sem_juros) || 12;
const categorias = home.categorias || [];
const tamanhos = home.tamanhos || [];
const catalogo = await rpc('site_catalogo', { p_limite: 500, p_offset: 0, p_ordem: 'mais_escolhidos' });
const itens = (catalogo.itens || []).filter((p) => p.slug && p.categoria_slug && Number(p.preco_a_partir) > 0);
console.log(`${itens.length} produto(s) visível(is) no site`);

// produtos e categorias
for (const cat of categorias) {
  const daCat = itens.filter((p) => p.categoria_slug === cat.slug);
  if (!daCat.length) continue;
  for (const resumo of daCat) {
    const p = await rpc('site_produto', { p_slug: resumo.slug });
    if (!p || !p.variacoes?.length) continue;
    p.categoria_slug = cat.slug;
    await salvar(urlProduto(p), paginaProduto(p, cat));
  }
  await salvar(`/${cat.slug}/`, paginaCategoria(cat, daCat));
}

// cidades e guias
const destaques = itens.filter((p) => p.categoria_slug === 'colchoes').slice(0, 4).concat(itens.filter((p) => p.categoria_slug !== 'colchoes').slice(0, 2)).slice(0, 4);
for (const c of CIDADES) await salvar(`/colchoes-em-${c.slug}/`, paginaCidade(c, destaques));
for (const g of GUIAS) await salvar(`/guia/${g.slug}/`, paginaGuia(g, tamanhos));
await salvar('/guia/', paginaGuias());

// remove páginas que deixaram de existir (produto oculto, categoria vazia)
for (const caminho of Object.keys(anterior.paginas)) {
  if (!novo.paginas[caminho]) {
    await rm(path.join(RAIZ, caminho, 'index.html'), { force: true });
    console.log('removida', caminho);
  }
}

await atualizarFixas();

// sitemap e robots
const fixasMap = [['/', 1.0], ['/catalogo.html', 0.8], ['/loja.html', 0.7], ['/contato.html', 0.5], ['/tour.html', 0.4]];
const prioridade = (c) => (/^\/colchoes-em-/.test(c) ? 0.7 : c.startsWith('/guia/') ? 0.6 : c.split('/').filter(Boolean).length === 1 ? 0.8 : 0.7);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${fixasMap.map(([c, pr]) => `  <url><loc>${SITE}${c}</loc><priority>${pr.toFixed(1)}</priority></url>`).join('\n')}
${Object.entries(novo.paginas).sort().map(([c, v]) => `  <url><loc>${SITE}${c}</loc><lastmod>${v.lastmod}</lastmod><priority>${prioridade(c).toFixed(1)}</priority></url>`).join('\n')}
</urlset>
`;
await writeFile(path.join(RAIZ, 'sitemap.xml'), sitemap);
await writeFile(path.join(RAIZ, 'robots.txt'), `# LS Colchões: buscadores e assistentes de IA são bem-vindos
User-agent: *
Allow: /
Disallow: /painel/
Disallow: /ferramentas/

Sitemap: ${SITE}/sitemap.xml
`);
await writeFile(MANIFESTO, JSON.stringify(novo, null, 2) + '\n');
console.log(`${Object.keys(novo.paginas).length} página(s) gerada(s) · sitemap.xml e robots.txt atualizados`);
