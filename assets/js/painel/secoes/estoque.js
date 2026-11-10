// Estoque: matriz produto × tamanho, ajustes, pedidos à fábrica e movimentações
import { painel, fmt } from '../../api.js';
import { h, raw, $, $$, debounce } from '../../html.js';
import { icp, ROT, toast, modal, confirmar, carregando, vazio, erroBloco } from '../ui.js';

const PASSOS = ['pedido', 'faturado', 'em_transito', 'recebido'];

export default async function estoque(el, ctx) {
  const aba = ['pedidos', 'movimentos'].includes(ctx.params[0]) ? ctx.params[0] : 'matriz';
  el.innerHTML = String(h`
    <div class="cabeca"><div><h1>Estoque</h1><p>Disponível = em estoque menos o que já está reservado em vendas a entregar.</p></div>
      ${ctx.pode.admin ? h`<button class="btn btn-g" data-acao="pedido">${icp.mais()} Pedido à fábrica</button>` : ''}</div>
    <div class="seg" role="tablist">
      ${[['matriz', 'Estoque por tamanho'], ['pedidos', 'Pedidos à fábrica'], ['movimentos', 'Movimentações']].map(([k, t]) => h`<a class="sb" role="tab" href="#/estoque${k === 'matriz' ? '' : '/' + k}" aria-selected="${String(aba === k)}" style="display:inline-flex;align-items:center;text-decoration:none">${t}</a>`)}
    </div>
    <div data-corpo class="pilha" style="gap:22px">${carregando()}</div>`);
  const corpo = $('[data-corpo]', el);
  el.addEventListener('click', (e) => { if (e.target.closest('[data-acao="pedido"]')) novoPedido(ctx, () => ctx.ir('#/estoque/pedidos')); });
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
            ${tamanhos.map(([cod]) => { const c = p.cel[cod]; return c ? h`<td class="r"><button type="button" class="cel lv-${c.nivel}" data-var="${c.variacao_id}" title="${c.quantidade} em estoque · ${c.reservado} reservado(s) · mínimo ${c.minimo}" ${ctx.pode.admin ? '' : raw('tabindex="-1"')}>${c.disponivel}</button></td>` : h`<td class="r"><span class="cel lv-na">—</span></td>`; })}
            <td class="r clr">${Object.values(p.cel).reduce((a, c) => a + c.disponivel, 0)}</td></tr>`)}
        </tbody></table></div>` : vazio(f.alertas ? 'Nenhum item abaixo do mínimo.' : 'Nenhum produto encontrado.')}
        <div class="legenda"><span><span class="cel lv-ok" style="cursor:default">4</span> ok</span><span><span class="cel lv-baixo" style="cursor:default">1</span> abaixo do mínimo</span><span><span class="cel lv-zerado" style="cursor:default">0</span> zerado ou negativo (vendido sem estoque)</span>${ctx.pode.admin ? h`<span class="mut">Clique no número para ajustar.</span>` : ''}</div>
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
async function pedidos(corpo, ctx) {
  async function render() {
    let ps;
    try { ps = await painel.estoque.pedidos(); } catch (err) { corpo.innerHTML = String(erroBloco(err)); return; }
    corpo.innerHTML = String(ps.length ? h`${ps.map((p) => {
      const passo = PASSOS.indexOf(p.status);
      const itens = p.pedido_fabrica_itens || [];
      return h`<div class="card pilha">
        <div class="hd"><div><span class="rot">Pedido ${p.codigo || ''}</span><h2 class="ttl" style="margin-top:4px">${itens.reduce((a, i) => a + i.quantidade, 0)} peça(s) · feito em ${fmt.data(p.feito_em + 'T12:00:00Z')}</h2>
          <span class="mut" style="font-size:13px">${p.status === 'recebido' ? `Recebido em ${fmt.data(p.recebido_em + 'T12:00:00Z')}` : p.previsao ? `Previsão de chegada: ${fmt.data(p.previsao + 'T12:00:00Z')}` : 'Sem previsão'}</span></div>
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
    })}` : vazio('Nenhum pedido à fábrica registrado.'));
  }
  corpo.addEventListener('click', async (e) => {
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

export async function novoPedido(ctx, aoSalvar) {
  const linhas = await painel.estoque.matriz();
  const ativas = linhas.filter((l) => l.ativo);
  const opcoesVar = h`<option value="">Escolha</option>${ativas.map((l) => h`<option value="${l.variacao_id}">${l.produto} · ${l.tamanho} (disp. ${l.disponivel})</option>`)}`;
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
      caixa.append(linhaItem());
      form.addEventListener('click', (e) => {
        if (e.target.closest('[data-add]')) caixa.append(linhaItem());
        if (e.target.closest('[data-rem]')) e.target.closest('[data-item]').remove();
        if (e.target.closest('[data-sugerir]')) {
          const alertas = ativas.filter((l) => l.nivel !== 'ok');
          if (!alertas.length) return toast('Nenhum item abaixo do mínimo.');
          $$('[data-item]', caixa).forEach((d) => { if (!$('[data-v]', d).value) d.remove(); });
          alertas.forEach((l) => caixa.append(linhaItem(l.variacao_id, Math.max(1, l.minimo - l.disponivel))));
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
