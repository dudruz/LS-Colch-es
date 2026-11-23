// Estoque: matriz produto × tamanho, ajustes, o que pedir, pedidos à fábrica e movimentações
import { painel, fmt } from '../../api.js';
import { h, raw, $, $$, debounce } from '../../html.js';
import { icp, ROT, toast, modal, confirmar, carregando, vazio, erroBloco } from '../ui.js';

const PASSOS = ['pedido', 'faturado', 'em_transito', 'recebido'];
const EM_ROTA = ['pedido', 'faturado', 'em_transito'];
const hojeISO = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const dataCurta = (iso) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '');

export default async function estoque(el, ctx) {
  const aba = ['comprar', 'pedidos', 'movimentos'].includes(ctx.params[0]) ? ctx.params[0] : 'matriz';
  el.innerHTML = String(h`
    <div class="cabeca"><div><h1>Estoque</h1><p>Disponível = em estoque menos o que já está reservado em vendas a entregar.</p></div>
      ${ctx.pode.admin ? h`<button class="btn btn-g" data-acao="pedido">${icp.mais()} Pedido à fábrica</button>` : ''}</div>
    <div class="seg" role="tablist">
      ${[['matriz', 'Estoque por tamanho'], ['comprar', 'O que pedir'], ['pedidos', 'Pedidos à fábrica'], ['movimentos', 'Movimentações']].map(([k, t]) => h`<a class="sb" role="tab" href="#/estoque${k === 'matriz' ? '' : '/' + k}" aria-selected="${String(aba === k)}" style="display:inline-flex;align-items:center;text-decoration:none">${t}</a>`)}
    </div>
    <div data-corpo class="pilha" style="gap:22px">${carregando()}</div>`);
  const corpo = $('[data-corpo]', el);
  el.addEventListener('click', (e) => { if (e.target.closest('[data-acao="pedido"]')) novoPedido(ctx, () => ctx.ir('#/estoque/pedidos')); });
  if (aba === 'comprar') return comprar(corpo, ctx);
  if (aba === 'pedidos') return pedidos(corpo, ctx);
  if (aba === 'movimentos') return movimentos(corpo);
  return matriz(corpo, ctx);
}

// ---------------------------------------------------------------------
async function matriz(corpo, ctx) {
  const f = { categoria: '', alertas: false, busca: '' };
  let linhas = [];
  async function carregar() {
    try { linhas = await painel.estoque.matriz(); render(); } catch (err) { corpo.innerHTML = String(erroBloco(err)); }
  }
  function render() {
    const ativas = linhas.filter((l) => l.ativo);
    const tamanhos = [...new Map(ativas.sort((a, b) => a.tamanho_ordem - b.tamanho_ordem).map((l) => [l.tamanho_codigo, l.tamanho])).entries()];
    const categorias = [...new Set(ativas.map((l) => l.categoria).filter(Boolean))];
    const termo = f.busca.trim().toLowerCase();
    const porProduto = new Map();
    ativas.forEach((l) => {
      if (f.categoria && l.categoria !== f.categoria) return;
      if (termo && !(`${l.produto} ${l.codigo || ''}`).toLowerCase().includes(termo)) return;
      if (!porProduto.has(l.produto_id)) porProduto.set(l.produto_id, { nome: l.produto, codigo: l.codigo, categoria: l.categoria, cel: {} });
      porProduto.get(l.produto_id).cel[l.tamanho_codigo] = l;
    });
    let produtos = [...porProduto.values()];
    if (f.alertas) produtos = produtos.filter((p) => Object.values(p.cel).some((c) => c.nivel !== 'ok'));
    const zerados = ativas.filter((l) => l.nivel === 'zerado').length;
    const baixos = ativas.filter((l) => l.nivel === 'baixo').length;

    corpo.innerHTML = String(h`
      <div class="gk">
        <div class="card kpi"><span class="rot">Unidades em estoque</span><span class="num">${ativas.reduce((a, l) => a + l.quantidade, 0)}</span></div>
        <div class="card kpi"><span class="rot">Reservadas</span><span class="num">${ativas.reduce((a, l) => a + l.reservado, 0)}</span></div>
        <div class="card kpi"><span class="rot">A caminho (pedidos à fábrica)</span><span class="num">${ativas.reduce((a, l) => a + (l.a_caminho || 0), 0)}</span></div>
        <div class="card kpi"><span class="rot">Abaixo do mínimo</span><span class="num ${baixos ? 'alerta-txt' : ''}">${baixos}</span></div>
        <div class="card kpi"><span class="rot">Zerados</span><span class="num ${zerados ? 'alerta-txt' : ''}">${zerados}</span></div>
      </div>
      <div class="card pilha">
        <div class="hd">
          <div class="chips"><button class="chip" data-cat="" aria-pressed="${String(!f.categoria)}">Todas</button>${categorias.map((c) => h`<button class="chip" data-cat="${c}" aria-pressed="${String(f.categoria === c)}">${c}</button>`)}</div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <label class="busca"><span class="sr">Buscar</span>${icp.busca()}<input class="inp" type="search" data-busca value="${f.busca}" placeholder="Produto ou código" style="width:200px"></label>
            <button type="button" class="sw" role="switch" aria-checked="${String(f.alertas)}" data-alertas><span>Só alertas</span><span class="trk"></span></button>
          </div>
        </div>
        ${produtos.length ? h`<div class="tabela"><table class="tbl"><thead><tr><th>Produto</th>${tamanhos.map(([cod, nome]) => h`<th class="r" title="${nome}">${cod}</th>`)}<th class="r">Total</th></tr></thead><tbody>
          ${produtos.map((p) => h`<tr><td><span class="clr">${p.nome}</span><span class="sub">${[p.codigo, p.categoria].filter(Boolean).join(' · ')}</span></td>
            ${tamanhos.map(([cod]) => { const c = p.cel[cod]; return c ? h`<td class="r"><button type="button" class="cel lv-${c.nivel}" data-var="${c.variacao_id}" title="${c.quantidade} em estoque · ${c.reservado} reservado(s) · mínimo ${c.minimo}${c.a_caminho ? ` · ${c.a_caminho} a caminho${c.proxima_previsao ? ' (previsão ' + dataCurta(c.proxima_previsao) + ')' : ''}` : ''}" ${ctx.pode.admin ? '' : raw('tabindex="-1"')}>${c.disponivel}</button>${c.a_caminho ? h`<span class="sub" style="color:var(--azul,#2563eb);white-space:nowrap" title="A caminho">+${c.a_caminho}${c.proxima_previsao ? ' · ' + dataCurta(c.proxima_previsao) : ''}</span>` : ''}</td>` : h`<td class="r"><span class="cel lv-na">—</span></td>`; })}
            <td class="r clr">${Object.values(p.cel).reduce((a, c) => a + c.disponivel, 0)}</td></tr>`)}
        </tbody></table></div>` : vazio(f.alertas ? 'Nenhum item abaixo do mínimo.' : 'Nenhum produto encontrado.')}
        <div class="legenda"><span><span class="cel lv-ok" style="cursor:default">4</span> ok</span><span><span class="cel lv-baixo" style="cursor:default">1</span> abaixo do mínimo</span><span><span class="cel lv-zerado" style="cursor:default">0</span> zerado ou negativo (vendido sem estoque)</span><span style="color:var(--azul,#2563eb)">+2 · 28/11 = a caminho e previsão de chegada</span>${ctx.pode.admin ? h`<span class="mut">Clique no número para ajustar.</span>` : ''}</div>
      </div>`);
  }
  corpo.addEventListener('click', async (e) => {
    const cat = e.target.closest('[data-cat]');
    if (cat) { f.categoria = cat.dataset.cat; return render(); }
    if (e.target.closest('[data-alertas]')) { f.alertas = !f.alertas; return render(); }
    const cel = e.target.closest('[data-var]');
    if (cel && ctx.pode.admin) { const l = linhas.find((x) => x.variacao_id === cel.dataset.var); if (l && (await ajustar(l))) carregar(); }
  });
  corpo.addEventListener('input', debounce((e) => { if (e.target.matches('[data-busca]')) { f.busca = e.target.value; render(); $('[data-busca]', corpo)?.focus(); const i = $('[data-busca]', corpo); if (i) i.setSelectionRange(i.value.length, i.value.length); } }, 300));
  await carregar();
}

async function ajustar(l) {
  return modal({
    titulo: `${l.produto} · ${l.tamanho}`, confirmar: 'Salvar',
    corpo: h`<div class="gk" style="grid-template-columns:repeat(3,1fr)">
        <div><span class="rot">Em estoque</span><div class="num" style="font-size:30px">${l.quantidade}</div></div>
        <div><span class="rot">Reservado</span><div class="num" style="font-size:30px">${l.reservado}</div></div>
        <div><span class="rot">Disponível</span><div class="num" style="font-size:30px">${l.disponivel}</div></div></div>
      <div class="g2">
        <label class="lbl">Movimento<select class="inp" name="tipo"><option value="1">Entrada (+)</option><option value="-1">Saída / perda (−)</option></select></label>
        <label class="lbl">Quantidade<input class="inp" name="qtd" type="number" min="0" value="0"></label>
        <label class="lbl" style="grid-column:1/-1">Motivo<input class="inp" name="motivo" placeholder="Ex.: contagem, avaria, devolução, mostruário" maxlength="200"></label>
        <label class="lbl">Estoque mínimo<input class="inp" name="minimo" type="number" min="0" value="${l.minimo}"></label>
      </div>`,
    async aoConfirmar(f) {
      const qtd = Number(f.get('qtd')) || 0;
      const minimo = Number(f.get('minimo'));
      if (qtd < 0) throw new Error('Quantidade inválida.');
      if (qtd > 0) {
        if (!String(f.get('motivo') || '').trim()) throw new Error('Informe o motivo do ajuste.');
        await painel.estoque.ajustar(l.variacao_id, qtd * Number(f.get('tipo')), String(f.get('motivo')).trim());
      }
      if (Number.isFinite(minimo) && minimo !== l.minimo) await painel.estoque.definirMinimo(l.variacao_id, minimo);
      toast('Estoque atualizado.', 'ok');
    }
  });
}

// ---------------------------------------------------------------------
// O que pedir: o que precisa ser comprado, já descontando o que está a caminho.
// Sugestão = estoque mínimo + vendas dos últimos 30 dias − disponível − a caminho.
async function comprar(corpo, ctx) {
  const f = { categoria: '' };
  let linhas = [];
  const qtdEditada = new Map();
  const marcados = new Set();
  const sugestao = (l) => Math.max(0, (l.minimo || 0) + (l.vendidos_30d || 0) - l.disponivel - (l.a_caminho || 0));
  async function carregar() {
    try {
      linhas = (await painel.estoque.matriz()).filter((l) => l.ativo && sugestao(l) > 0);
      // primeiro o que já foi vendido sem estoque, depois a maior sugestão
      linhas.sort((a, b) => Number(b.disponivel < 0) - Number(a.disponivel < 0) || sugestao(b) - sugestao(a) || a.produto.localeCompare(b.produto));
      linhas.forEach((l) => marcados.add(l.variacao_id));
      render();
    } catch (err) { corpo.innerHTML = String(erroBloco(err)); }
  }
  const qtd = (l) => (qtdEditada.has(l.variacao_id) ? qtdEditada.get(l.variacao_id) : sugestao(l));
  function visiveis() { return linhas.filter((l) => !f.categoria || l.categoria === f.categoria); }
  function render() {
    const lista = visiveis();
    const categorias = [...new Set(linhas.map((l) => l.categoria).filter(Boolean))];
    const semEstoque = linhas.filter((l) => l.disponivel < 0);
    const selecionados = lista.filter((l) => marcados.has(l.variacao_id) && qtd(l) > 0);
    corpo.innerHTML = String(h`
      <div class="gk">
        <div class="card kpi"><span class="rot">Itens para pedir</span><span class="num">${linhas.length}</span></div>
        <div class="card kpi"><span class="rot">Peças sugeridas</span><span class="num">${linhas.reduce((a, l) => a + qtd(l), 0)}</span></div>
        <div class="card kpi"><span class="rot">Vendidos sem estoque</span><span class="num ${semEstoque.length ? 'alerta-txt' : ''}">${semEstoque.length}</span></div>
      </div>
      <div class="card pilha">
        <div class="hd">
          <div class="chips"><button class="chip" data-cat="" aria-pressed="${String(!f.categoria)}">Todas</button>${categorias.map((c) => h`<button class="chip" data-cat="${c}" aria-pressed="${String(f.categoria === c)}">${c}</button>`)}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn" data-csv>Baixar lista (CSV)</button>
            ${ctx.pode.admin ? h`<button class="btn btn-g" data-pedir ${selecionados.length ? '' : raw('disabled')}>${icp.mais()} Criar pedido com ${selecionados.length} item(ns)</button>` : ''}
          </div>
        </div>
        <p class="mut" style="margin:0;font-size:13px">Sugestão = estoque mínimo + vendas dos últimos 30 dias − disponível − o que já está a caminho. Ajuste a quantidade antes de criar o pedido.</p>
        ${lista.length ? h`<div class="tabela"><table class="tbl"><thead><tr><th style="width:32px"><input type="checkbox" data-todos aria-label="Marcar todos" ${lista.every((l) => marcados.has(l.variacao_id)) ? raw('checked') : ''}></th><th>Produto</th><th>Tam.</th><th class="r">Estoque</th><th class="r">Reserv.</th><th class="r">Disp.</th><th class="r">A caminho</th><th class="r">Vend. 30d</th><th class="r">Mín.</th><th class="r">Pedir</th></tr></thead><tbody>
          ${lista.map((l) => h`<tr>
            <td><input type="checkbox" data-marca="${l.variacao_id}" ${marcados.has(l.variacao_id) ? raw('checked') : ''} aria-label="Incluir no pedido"></td>
            <td><span class="clr">${l.produto}</span><span class="sub">${[l.sku, l.categoria].filter(Boolean).join(' · ')}${l.disponivel < 0 ? raw(' · <span class="alerta-txt">vendido sem estoque</span>') : ''}</span></td>
            <td>${l.tamanho_codigo}</td>
            <td class="r">${l.quantidade}</td><td class="r">${l.reservado}</td>
            <td class="r ${l.disponivel <= 0 ? 'alerta-txt' : ''}">${l.disponivel}</td>
            <td class="r">${l.a_caminho ? `${l.a_caminho}${l.proxima_previsao ? ' · ' + dataCurta(l.proxima_previsao) : ''}` : '—'}</td>
            <td class="r">${l.vendidos_30d || 0}</td><td class="r">${l.minimo}</td>
            <td class="r"><input class="inp" type="number" min="0" data-qtd="${l.variacao_id}" value="${qtd(l)}" style="width:72px;text-align:right"></td>
          </tr>`)}
        </tbody></table></div>` : vazio('Nada para pedir agora: o estoque disponível mais o que está a caminho cobre o mínimo e as vendas recentes.')}
      </div>`);
  }
  corpo.addEventListener('click', async (e) => {
    const cat = e.target.closest('[data-cat]');
    if (cat) { f.categoria = cat.dataset.cat; return render(); }
    if (e.target.closest('[data-csv]')) {
      const lista = visiveis().filter((l) => marcados.has(l.variacao_id) && qtd(l) > 0);
      const linhasCsv = [['Produto', 'Tamanho', 'SKU', 'Quantidade'], ...lista.map((l) => [l.produto, l.tamanho, l.sku || '', qtd(l)])];
      const csv = linhasCsv.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
      a.download = `pedido-ls-${hojeISO()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      return;
    }
    if (e.target.closest('[data-pedir]')) {
      const itens = visiveis().filter((l) => marcados.has(l.variacao_id) && qtd(l) > 0).map((l) => ({ variacaoId: l.variacao_id, quantidade: qtd(l) }));
      return novoPedido(ctx, () => ctx.ir('#/estoque/pedidos'), itens);
    }
  });
  corpo.addEventListener('change', (e) => {
    const m = e.target.closest('[data-marca]');
    if (m) { m.checked ? marcados.add(m.dataset.marca) : marcados.delete(m.dataset.marca); return render(); }
    if (e.target.closest('[data-todos]')) { visiveis().forEach((l) => (e.target.checked ? marcados.add(l.variacao_id) : marcados.delete(l.variacao_id))); return render(); }
    const q = e.target.closest('[data-qtd]');
    if (q) { qtdEditada.set(q.dataset.qtd, Math.max(0, Number(q.value) || 0)); render(); }
  });
  await carregar();
}

// ---------------------------------------------------------------------
async function pedidos(corpo, ctx) {
  let filtro = 'rota';
  async function render() {
    let ps;
    try { ps = await painel.estoque.pedidos(); } catch (err) { corpo.innerHTML = String(erroBloco(err)); return; }
    const hoje = hojeISO();
    const emRota = ps.filter((p) => EM_ROTA.includes(p.status));
    const lista = filtro === 'rota' ? emRota : ps;
    const pecasRota = emRota.reduce((a, p) => a + (p.pedido_fabrica_itens || []).reduce((b, i) => b + i.quantidade, 0), 0);
    const atrasados = emRota.filter((p) => p.previsao && p.previsao < hoje).length;
    corpo.innerHTML = String(h`
      <div class="hd" style="align-items:center">
        <div class="chips"><button class="chip" data-filtro="rota" aria-pressed="${String(filtro === 'rota')}">Em rota (${emRota.length})</button><button class="chip" data-filtro="todos" aria-pressed="${String(filtro === 'todos')}">Todos (${ps.length})</button></div>
        <span class="mut" style="font-size:13px">${pecasRota} peça(s) a caminho${atrasados ? raw(` · <span class="alerta-txt">${atrasados} pedido(s) atrasado(s)</span>`) : ''}</span>
      </div>
      ${lista.length ? h`${lista.map((p) => {
      const passo = PASSOS.indexOf(p.status);
      const itens = p.pedido_fabrica_itens || [];
      return h`<div class="card pilha">
        <div class="hd"><div><span class="rot">Pedido ${p.codigo || ''}</span><h2 class="ttl" style="margin-top:4px">${itens.reduce((a, i) => a + i.quantidade, 0)} peça(s) · feito em ${fmt.data(p.feito_em + 'T12:00:00Z')}</h2>
          <span class="mut" style="font-size:13px">${p.status === 'recebido' ? `Recebido em ${fmt.data(p.recebido_em + 'T12:00:00Z')}` : p.previsao ? `Previsão de chegada: ${fmt.data(p.previsao + 'T12:00:00Z')}` : 'Sem previsão'}</span>
          ${EM_ROTA.includes(p.status) && p.previsao && p.previsao < hoje ? h` <span class="pill st-warn">Atrasado</span>` : ''}
          ${ctx.pode.admin && EM_ROTA.includes(p.status) ? h` <button type="button" class="lnk" data-previsao="${p.id}" data-atual="${p.previsao || ''}" style="font-size:13px">Alterar previsão</button>` : ''}</div>
          ${p.status === 'cancelado' ? h`<span class="pill st-mute">Cancelado</span>` : h`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${PASSOS.map((s, i) => h`<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px" class="${i <= passo ? 'clr' : 'mut'}"><span class="passo ${i <= passo ? 'on' : ''}">${i + 1}</span>${ROT.pedidos[s]}</span>`)}</div>`}
        </div>
        <div class="tabela"><table class="tbl"><thead><tr><th>Produto</th><th>Tamanho</th><th>SKU</th><th class="r">Qtd.</th></tr></thead><tbody>
          ${itens.map((i) => h`<tr><td>${i.produto_variacoes?.produtos?.nome || '—'}</td><td>${i.produto_variacoes?.tamanho_codigo || ''}</td><td class="mut">${i.produto_variacoes?.sku || ''}</td><td class="r">${i.quantidade}</td></tr>`)}
        </tbody></table></div>
        ${p.observacao ? h`<p class="mut" style="margin:0;font-size:13px">${p.observacao}</p>` : ''}
        ${ctx.pode.admin && !['recebido', 'cancelado'].includes(p.status) ? h`<div style="display:flex;gap:10px;flex-wrap:wrap">
          ${passo < 2 ? h`<button class="btn btn-p" data-avancar="${p.id}" data-para="${PASSOS[passo + 1]}">Marcar como ${ROT.pedidos[PASSOS[passo + 1]].toLowerCase()}</button>` : ''}
          <button class="btn btn-g btn-p" data-receber="${p.id}">${icp.check()} Recebi a mercadoria</button>
          <button class="btn btn-perigo btn-p" data-cancelar="${p.id}">Cancelar pedido</button></div>` : ''}
      </div>`;
    })}` : vazio(filtro === 'rota' ? 'Nenhum pedido em rota no momento.' : 'Nenhum pedido à fábrica registrado.')}`);
  }
  corpo.addEventListener('click', async (e) => {
    const fl = e.target.closest('[data-filtro]');
    if (fl) { filtro = fl.dataset.filtro; return render(); }
    const pv = e.target.closest('[data-previsao]');
    if (pv) {
      const ok = await modal({
        titulo: 'Alterar previsão de chegada', confirmar: 'Salvar',
        corpo: h`<label class="lbl">Nova previsão<input class="inp" name="previsao" type="date" value="${pv.dataset.atual}"></label>`,
        async aoConfirmar(f) { await painel.estoque.previsaoPedido(pv.dataset.previsao, f.get('previsao')); toast('Previsão atualizada.', 'ok'); }
      });
      if (ok) render();
      return;
    }
    const av = e.target.closest('[data-avancar]'), rc = e.target.closest('[data-receber]'), cc = e.target.closest('[data-cancelar]');
    try {
      if (av) { await painel.estoque.statusPedido(av.dataset.avancar, av.dataset.para); toast('Pedido atualizado.', 'ok'); }
      else if (rc) {
        if (!(await confirmar('Confirmar o recebimento? As quantidades entram no estoque agora.', { titulo: 'Receber pedido', botao: 'Receber', perigo: false }))) return;
        await painel.estoque.receberPedido(rc.dataset.receber); toast('Mercadoria recebida e estoque atualizado.', 'ok'); ctx.atualizarContadores();
      } else if (cc) {
        if (!(await confirmar('Cancelar este pedido à fábrica?', { botao: 'Cancelar pedido' }))) return;
        await painel.estoque.statusPedido(cc.dataset.cancelar, 'cancelado');
      } else return;
      render();
    } catch (err) { toast(err.message, 'erro'); }
  });
  await render();
}

export async function novoPedido(ctx, aoSalvar, itensIniciais = []) {
  const linhas = await painel.estoque.matriz();
  const ativas = linhas.filter((l) => l.ativo);
  const opcoesVar = h`<option value="">Escolha</option>${ativas.map((l) => h`<option value="${l.variacao_id}">${l.produto} · ${l.tamanho} (disp. ${l.disponivel}${l.a_caminho ? ', a caminho ' + l.a_caminho : ''})</option>`)}`;
  const linhaItem = (varId = '', qtd = 1) => {
    const d = document.createElement('div');
    d.className = 'g2'; d.dataset.item = ''; d.style.gridTemplateColumns = '1fr 90px 40px'; d.style.alignItems = 'end';
    d.innerHTML = String(h`<label class="lbl">Produto e tamanho<select class="inp" data-v>${opcoesVar}</select></label><label class="lbl">Qtd.<input class="inp" data-q type="number" min="1" value="${qtd}"></label><button type="button" class="btn btn-i" data-rem aria-label="Remover">${icp.lixo()}</button>`);
    $('[data-v]', d).value = varId;
    return d;
  };
  const ok = await modal({
    titulo: 'Novo pedido à fábrica', confirmar: 'Registrar pedido', largura: 640,
    corpo: h`<div class="g2"><label class="lbl">Código do pedido<input class="inp" name="codigo" placeholder="Ex.: ORT-2026-118"></label><label class="lbl">Previsão de chegada<input class="inp" name="previsao" type="date"></label></div>
      <div class="pilha" data-itens style="gap:10px"></div>
      <div style="display:flex;gap:16px;flex-wrap:wrap"><button type="button" class="lnk" data-add>${icp.mais(14)} Adicionar item</button><button type="button" class="lnk" data-sugerir>Sugerir itens abaixo do mínimo</button></div>
      <label class="lbl">Observação<textarea class="inp" name="observacao" maxlength="500"></textarea></label>`,
    aoAbrir(form) {
      const caixa = $('[data-itens]', form);
      if (itensIniciais.length) itensIniciais.forEach((i) => caixa.append(linhaItem(i.variacaoId, i.quantidade)));
      else caixa.append(linhaItem());
      form.addEventListener('click', (e) => {
        if (e.target.closest('[data-add]')) caixa.append(linhaItem());
        if (e.target.closest('[data-rem]')) e.target.closest('[data-item]').remove();
        if (e.target.closest('[data-sugerir]')) {
          const alertas = ativas.filter((l) => (l.minimo || 0) - l.disponivel - (l.a_caminho || 0) > 0);
          if (!alertas.length) return toast('Nenhum item abaixo do mínimo (contando o que já está a caminho).');
          $$('[data-item]', caixa).forEach((d) => { if (!$('[data-v]', d).value) d.remove(); });
          alertas.forEach((l) => caixa.append(linhaItem(l.variacao_id, Math.max(1, l.minimo - l.disponivel - (l.a_caminho || 0)))));
        }
      });
    },
    async aoConfirmar(f, form) {
      const itens = $$('[data-item]', form).map((d) => ({ variacaoId: $('[data-v]', d).value, quantidade: Number($('[data-q]', d).value) || 0 })).filter((i) => i.variacaoId && i.quantidade > 0);
      await painel.estoque.criarPedido({ codigo: f.get('codigo') || null, previsao: f.get('previsao') || null, observacao: f.get('observacao') || null, itens });
      toast('Pedido registrado.', 'ok');
    }
  });
  if (ok) aoSalvar?.();
}

// ---------------------------------------------------------------------
async function movimentos(corpo) {
  try {
    const ms = await painel.estoque.movimentos(80);
    corpo.innerHTML = String(h`<div class="card">${ms.length ? h`<div class="tabela"><table class="tbl"><thead><tr><th>Quando</th><th>Produto</th><th>Movimento</th><th class="r">Qtd.</th><th>Motivo</th></tr></thead><tbody>
      ${ms.map((m) => h`<tr><td>${fmt.dataHora(m.criado_em)}</td><td>${m.produto_variacoes?.produtos?.nome || '—'} <span class="mut">· ${m.produto_variacoes?.tamanho_codigo || ''}</span></td>
        <td><span class="pill ${m.tipo === 'entrada' ? 'st-ok' : m.tipo === 'saida' ? 'st-warn' : m.tipo === 'reserva' ? 'st-wait' : 'st-info'}">${ROT.movimentos[m.tipo]}</span></td>
        <td class="r ${m.quantidade < 0 ? 'alerta-txt' : 'clr'}">${m.quantidade > 0 && m.tipo !== 'reserva' ? '+' : ''}${m.quantidade}</td><td style="white-space:normal">${m.motivo || '—'}</td></tr>`)}
    </tbody></table></div>` : vazio('Nenhuma movimentação ainda.')}</div>`);
  } catch (err) { corpo.innerHTML = String(erroBloco(err)); }
}
