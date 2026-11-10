// Vendas: lista com abas e filtros, detalhe da venda e gaveta "Nova venda"
import { painel, fmt } from '../../api.js';
import { h, raw, $, $$, debounce } from '../../html.js';
import {
  icp, ROT, pill, opcoes, toast, gaveta, pedirTexto, carregando, vazio, erroBloco,
  barraPeriodo, ligarPeriodo, lerPeriodo, datasDoPeriodo, paginacao, localParaIso, zapCliente
} from '../ui.js';

const POR_PAGINA = 20;
const ordinal = (n) => (n ? `${n}ª compra` : '');

export default async function vendas(el, ctx) {
  let per = lerPeriodo();
  const f = { status: '', busca: '', vendedorId: '', forma: '', pagina: 0 };
  const equipe = await ctx.equipe().catch(() => []);
  const vendedores = equipe.filter((p) => ['admin', 'gerente', 'vendedor'].includes(p.papel));

  el.innerHTML = String(h`
    <div class="cabeca"><div><h1>Vendas</h1><p>Todas as vendas da loja, com status de pagamento e entrega.</p></div>
      ${ctx.pode.vender ? h`<button class="btn btn-g" data-acao="nova">${icp.mais()} Nova venda</button>` : ''}</div>
    ${barraPeriodo(per)}
    <div class="card pilha">
      <div class="seg" role="tablist" data-abas></div>
      <div class="g2">
        <label class="busca"><span class="sr">Buscar cliente</span>${icp.busca()}<input class="inp" type="search" data-f="busca" placeholder="Buscar pelo nome do cliente"></label>
        <select class="inp" data-f="vendedorId" aria-label="Vendedor"><option value="">Todos os vendedores</option>${vendedores.map((v) => h`<option value="${v.id}">${v.nome}</option>`)}</select>
        <select class="inp" data-f="forma" aria-label="Forma de pagamento">${opcoes(ROT.formas, '', 'Todas as formas de pagamento')}</select>
      </div>
      <div data-lista>${carregando()}</div>
    </div>`);

  const lista = $('[data-lista]', el);
  const abas = $('[data-abas]', el);

  async function carregarAbas() {
    const c = await painel.vendas.contagem(datasDoPeriodo(per)).catch(() => ({}));
    const itens = [['', 'Todas', c.todas], ...Object.entries(ROT.status).map(([k, t]) => [k, t, c[k]])];
    abas.innerHTML = String(h`${itens.map(([k, t, n]) => h`<button class="sb" role="tab" data-status="${k}" aria-selected="${String(f.status === k)}">${t} <span class="mut">${n || 0}</span></button>`)}`);
  }

  async function carregar() {
    lista.innerHTML = String(carregando());
    try {
      const { itens, total } = await painel.vendas.listar({ ...f, ...datasDoPeriodo(per), porPagina: POR_PAGINA });
      if (!itens.length) { lista.innerHTML = String(vazio('Nenhuma venda encontrada com esses filtros.')); return; }
      const soma = itens.filter((v) => v.status !== 'cancelada').reduce((a, v) => a + Number(v.total), 0);
      lista.innerHTML = String(h`
        <div class="tabela"><table class="tbl"><thead><tr><th>Venda</th><th>Cliente</th><th>Itens</th><th>Vendedor</th><th>Pagamento</th><th>Entrega</th><th class="r">Total</th><th>Status</th></tr></thead><tbody>
        ${itens.map((v) => h`<tr data-venda="${v.id}" style="cursor:pointer">
          <td><span class="clr" style="font-weight:600">#${v.numero}</span><span class="sub">${fmt.dataHora(v.data_venda)}</span></td>
          <td>${v.cliente}<span class="sub">${ordinal(v.compra_numero)}${v.lead_origem ? ' · veio de ' + (ROT.origens[v.lead_origem] || v.lead_origem) : ''}</span></td>
          <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis" title="${v.itens || ''}">${v.itens || '—'}</td>
          <td>${v.vendedor || '—'}</td>
          <td>${ROT.formas[v.forma_pagamento] || '—'}${v.parcelas > 1 ? h`<span class="sub">${v.parcelas}x</span>` : ''}</td>
          <td>${v.entrega_tipo === 'retirada' ? 'Retirada' : ''}${v.entrega_em ? h`<span class="${v.entrega_tipo === 'retirada' ? 'sub' : ''}">${fmt.dataHora(v.entrega_em)}</span>` : (v.entrega_tipo === 'retirada' ? '' : h`<span class="mut">a agendar</span>`)}</td>
          <td class="r">${fmt.reais(v.total)}${v.desconto > 0 ? h`<span class="sub">desc. ${fmt.reais(v.desconto)}</span>` : ''}</td>
          <td>${pill(v.status)}${v.na_campanha ? h` <span class="tag o-instagram">campanha</span>` : ''}</td>
        </tr>`)}
        </tbody></table></div>
        <div class="hd" style="margin-top:12px"><span class="mut" style="font-size:13px">Soma desta página (sem canceladas): <strong class="clr">${fmt.reais(soma)}</strong></span>${paginacao(f.pagina, total, POR_PAGINA)}</div>`);
    } catch (err) { lista.innerHTML = String(erroBloco(err)); }
  }

  const recarregar = () => { carregarAbas(); carregar(); };
  ligarPeriodo(el, (p) => { per = p; f.pagina = 0; recarregar(); });

  el.addEventListener('click', (e) => {
    const aba = e.target.closest('[data-status]');
    if (aba) { f.status = aba.dataset.status; f.pagina = 0; $$('[data-status]', abas).forEach((b) => b.setAttribute('aria-selected', String(b === aba))); return carregar(); }
    const pg = e.target.closest('[data-pagina]');
    if (pg) { f.pagina = Number(pg.dataset.pagina); return carregar(); }
    if (e.target.closest('[data-acao="nova"]')) return novaVenda(ctx, recarregar);
    const linha = e.target.closest('[data-venda]');
    if (linha) detalheVenda(ctx, linha.dataset.venda, recarregar);
  });
  const buscar = debounce(() => { f.pagina = 0; carregar(); }, 350);
  el.addEventListener('input', (e) => { const k = e.target.dataset.f; if (k === 'busca') { f.busca = e.target.value; buscar(); } });
  el.addEventListener('change', (e) => { const k = e.target.dataset.f; if (k && k !== 'busca') { f[k] = e.target.value; f.pagina = 0; carregar(); } });

  recarregar();
}

// ---------------------------------------------------------------------
// Detalhe da venda
// ---------------------------------------------------------------------
export async function detalheVenda(ctx, vendaId, aoMudar = () => {}) {
  const g = gaveta({ titulo: 'Venda', corpo: carregando() });
  async function render() {
    try {
      const [v, itens] = await Promise.all([painel.vendas.obter(vendaId), painel.vendas.itens(vendaId)]);
      if (!v) throw new Error('Venda não encontrada.');
      $('.ttl', g.el).textContent = `Venda #${v.numero}`;
      const zap = zapCliente(v.whatsapp, `Olá, ${v.cliente.split(' ')[0]}! Aqui é da LS Colchões, sobre a sua compra #${v.numero}.`);
      const podeCancelar = ctx.pode.vender && v.status !== 'cancelada' && v.status !== 'entregue';
      g.corpo.innerHTML = String(h`
        <div class="hd"><span>${pill(v.status)}</span><span class="mut" style="font-size:13px">${fmt.dataHora(v.data_venda)} · ${v.vendedor || 'sem vendedor'}</span></div>
        <div class="card" style="padding:18px">
          <span class="rot">Cliente</span>
          <div class="hd" style="margin-top:6px"><div><div class="clr" style="font-weight:600">${v.cliente}</div><div class="mut" style="font-size:13px">${v.whatsapp || 'sem WhatsApp'} · ${ordinal(v.compra_numero)}</div></div>
            <div style="display:flex;gap:8px">${zap ? h`<a class="btn btn-p" href="${zap}" target="_blank" rel="noopener">${icp.zap()} WhatsApp</a>` : ''}<a class="btn btn-p" href="#/crm/cliente/${v.cliente_id}">Ficha</a></div></div>
        </div>
        <div><span class="rot">Itens</span>
          <div class="tabela"><table class="tbl" style="margin-top:8px"><thead><tr><th>Produto</th><th class="r">Qtd.</th><th class="r">Unitário</th><th class="r">Total</th></tr></thead><tbody>
          ${itens.map((i) => h`<tr><td style="white-space:normal">${i.descricao}${Number(i.preco_unitario) !== Number(i.preco_tabela) ? h`<span class="sub">tabela ${fmt.reaisCentavos(i.preco_tabela)}</span>` : ''}</td><td class="r">${i.quantidade}</td><td class="r">${fmt.reaisCentavos(i.preco_unitario)}</td><td class="r">${fmt.reaisCentavos(i.total)}</td></tr>`)}
          </tbody></table></div>
          <div class="pilha" style="gap:6px;margin-top:12px;font-size:14px">
            <div class="hd"><span>Subtotal</span><span class="tn clr">${fmt.reaisCentavos(v.subtotal)}</span></div>
            ${v.desconto > 0 ? h`<div class="hd"><span>Desconto</span><span class="tn alerta-txt">− ${fmt.reaisCentavos(v.desconto)}</span></div>` : ''}
            <div class="hd"><span class="clr" style="font-weight:600">Total</span><span class="num" style="font-size:28px">${fmt.reaisCentavos(v.total)}</span></div>
            <div class="hd"><span>Pagamento</span><span class="clr">${ROT.formas[v.forma_pagamento] || '—'}${v.parcelas > 1 ? ` em ${v.parcelas}x` : ''}</span></div>
            <div class="hd"><span>${v.entrega_tipo === 'retirada' ? 'Retirada' : 'Entrega'}</span><span class="clr">${v.entrega_em ? fmt.dataHora(v.entrega_em) : 'não agendada'}</span></div>
          </div>
        </div>
        ${ctx.pode.vender && v.status !== 'cancelada' ? h`<div class="pilha" style="gap:10px">
          ${v.status === 'aguardando_pagamento' ? h`<button class="btn btn-g" data-acao="paga">${icp.check()} Pagamento recebido</button>` : ''}
          ${!v.entrega_em && v.status !== 'entregue' ? h`<button class="btn" data-acao="agendar">Agendar ${v.entrega_tipo === 'retirada' ? 'retirada' : 'entrega'}</button>` : ''}
          ${podeCancelar ? h`<button class="btn btn-perigo" data-acao="cancelar">Cancelar venda</button>` : ''}
        </div>` : ''}
        ${v.status === 'entregue' ? h`<p class="mut" style="margin:0;font-size:13px">Venda entregue: o estoque já foi baixado. Para devolução, use o ajuste de estoque.</p>` : ''}`);

      g.corpo.onclick = async (e) => {
        const a = e.target.closest('[data-acao]')?.dataset.acao;
        try {
          if (a === 'paga') { await painel.vendas.alterarStatus(v.id, 'a_entregar'); toast('Pagamento registrado.', 'ok'); }
          else if (a === 'cancelar') {
            const motivo = await pedirTexto(`Cancelar a venda #${v.numero}?`, 'Motivo do cancelamento', { botao: 'Cancelar venda', obrigatorio: true });
            if (motivo == null) return;
            await painel.vendas.cancelar(v.id, motivo); toast('Venda cancelada e reserva de estoque liberada.', 'ok');
          } else if (a === 'agendar') {
            const { agendarEntrega } = await import('./entregas.js');
            if (!(await agendarEntrega(ctx, { venda_id: v.id, cliente_id: v.cliente_id, tipo: v.entrega_tipo === 'retirada' ? 'retirada' : 'entrega' }))) return;
          } else return;
          aoMudar(); render();
        } catch (err) { toast(err.message, 'erro'); }
      };
    } catch (err) { g.corpo.innerHTML = String(erroBloco(err)); }
  }
  render();
}

// ---------------------------------------------------------------------
// Nova venda
// ---------------------------------------------------------------------
export async function novaVenda(ctx, aoSalvar = () => {}, pre = {}) {
  const g = gaveta({ titulo: 'Nova venda', corpo: carregando() });
  let produtos, base, campanha, equipe;
  try {
    [produtos, base, campanha, equipe] = await Promise.all([painel.produtos.listar(), ctx.base(), painel.campanhaAtiva(), ctx.equipe()]);
  } catch (err) { g.corpo.innerHTML = String(erroBloco(err)); return; }
  const nomeTam = Object.fromEntries(base.tamanhos.map((t) => [t.codigo, t.nome]));
  const ordemTam = Object.fromEntries(base.tamanhos.map((t) => [t.codigo, t.ordem]));
  produtos = produtos.filter((p) => p.produto_variacoes.some((v) => v.ativo));
  const vendedores = equipe.filter((p) => p.ativo && ['admin', 'gerente', 'vendedor'].includes(p.papel));
  const precoDe = (p, v) => (campanha && p.na_campanha && v.preco_campanha != null && Number(v.preco_campanha) < Number(v.preco) ? Number(v.preco_campanha) : Number(v.preco));
  const disp = (v) => (v.estoque ? (v.estoque.quantidade ?? 0) - (v.estoque.reservado ?? 0) : 0);

  let cliente = pre.cliente || null; // {id, nome, whatsapp}
  let clienteNovo = false;

  g.corpo.innerHTML = String(h`
    <form class="pilha" style="gap:20px" novalidate>
      <fieldset class="pilha" style="border:0;padding:0;margin:0;gap:10px">
        <legend class="rot" style="padding:0;margin-bottom:10px">Cliente</legend>
        <div data-cliente></div>
      </fieldset>
      <fieldset class="pilha" style="border:0;padding:0;margin:0;gap:10px">
        <legend class="rot" style="padding:0;margin-bottom:10px">Itens</legend>
        <div class="pilha" data-itens style="gap:10px"></div>
        <button type="button" class="lnk" data-acao="item">${icp.mais(16)} Adicionar item</button>
      </fieldset>
      <fieldset class="g2" style="border:0;padding:0;margin:0">
        <legend class="rot" style="padding:0;margin-bottom:10px">Pagamento</legend>
        <label class="lbl">Forma<select class="inp" name="forma">${opcoes(ROT.formas, 'pix')}</select></label>
        <label class="lbl">Parcelas<input class="inp" name="parcelas" type="number" min="1" max="24" value="1"></label>
        <label class="lbl">Desconto (R$)<input class="inp" name="desconto" type="number" min="0" step="0.01" value="0"></label>
        <label class="lbl">Situação<select class="inp" name="status"><option value="a_entregar">Pago</option><option value="aguardando_pagamento">Aguardando pagamento</option></select></label>
      </fieldset>
      <fieldset class="g2" style="border:0;padding:0;margin:0">
        <legend class="rot" style="padding:0;margin-bottom:10px">Entrega</legend>
        <label class="lbl">Tipo<select class="inp" name="entrega_tipo">${opcoes({ entrega: 'Entrega', entrega_montagem: 'Entrega + montagem', retirada: 'Retirada na loja' }, 'entrega')}</select></label>
        <label class="lbl">Data e hora <small class="mut">(opcional)</small><input class="inp" name="entrega_quando" type="datetime-local"></label>
        <label class="lbl" style="grid-column:1/-1">Endereço<input class="inp" name="entrega_endereco" placeholder="Rua, número, complemento"></label>
        <label class="lbl">Bairro<input class="inp" name="entrega_bairro"></label>
        <label class="lbl">Equipe<input class="inp" name="entrega_equipe" placeholder="Ex.: Equipe 1"></label>
      </fieldset>
      <div class="g2">
        ${ctx.pode.admin ? h`<label class="lbl">Vendedor<select class="inp" name="vendedor">${vendedores.map((v) => h`<option value="${v.id}" ${v.id === ctx.perfil.id ? raw('selected') : ''}>${v.nome}</option>`)}</select></label>` : ''}
        <label class="lbl" style="grid-column:1/-1">Observações<textarea class="inp" name="obs" maxlength="1000"></textarea></label>
      </div>
      <div class="card realce pilha" style="padding:18px;gap:6px" data-totais></div>
      <p class="alerta-txt" data-erro role="alert" hidden style="margin:0"></p>
      <button class="btn btn-g" type="submit">Registrar venda</button>
    </form>`);

  const form = $('form', g.corpo);
  const caixaCliente = $('[data-cliente]', form);
  const caixaItens = $('[data-itens]', form);

  function renderCliente() {
    if (cliente) {
      caixaCliente.innerHTML = String(h`<div class="hd card" style="padding:14px 16px"><div><div class="clr" style="font-weight:600">${cliente.nome}</div><div class="mut" style="font-size:13px">${cliente.whatsapp || ''}${cliente.bairro ? ' · ' + cliente.bairro : ''}</div></div><button type="button" class="lnk" data-acao="trocar-cliente">Trocar</button></div>`);
      if (cliente.bairro && !form.entrega_bairro.value) form.entrega_bairro.value = cliente.bairro;
      return;
    }
    if (clienteNovo) {
      caixaCliente.innerHTML = String(h`<div class="g2">
        <label class="lbl">Nome<input class="inp" name="c_nome" required maxlength="120"></label>
        <label class="lbl">WhatsApp<input class="inp" name="c_whatsapp" type="tel" placeholder="(31) 9 0000-0000"></label>
        <label class="lbl" style="grid-column:1/-1">Endereço<input class="inp" name="c_logradouro" placeholder="Rua e número"></label>
        <label class="lbl">Bairro<input class="inp" name="c_bairro"></label>
        <label class="lbl">Cidade<input class="inp" name="c_cidade" value="Lagoa Santa"></label>
      </div><button type="button" class="lnk" data-acao="buscar-cliente">Buscar cliente já cadastrado</button>`);
      $('[name=c_nome]', caixaCliente).focus();
      return;
    }
    caixaCliente.innerHTML = String(h`<label class="busca"><span class="sr">Buscar cliente</span>${icp.busca()}<input class="inp" type="search" data-busca-cliente placeholder="Nome ou WhatsApp do cliente" autocomplete="off"></label>
      <ul class="lst" data-resultados></ul>
      <button type="button" class="lnk" data-acao="cliente-novo">${icp.mais(16)} Cliente novo</button>`);
  }

  function linhaItem() {
    const div = document.createElement('div');
    div.className = 'card'; div.style.padding = '14px'; div.dataset.item = '';
    div.innerHTML = String(h`<div class="g2" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
      <label class="lbl" style="grid-column:1/-1">Produto<select class="inp" data-produto><option value="">Escolha o produto</option>${produtos.map((p) => h`<option value="${p.id}">${p.nome}${p.codigo ? ' · ' + p.codigo : ''}</option>`)}</select></label>
      <label class="lbl">Tamanho<select class="inp" data-variacao disabled><option value="">—</option></select></label>
      <label class="lbl">Qtd.<input class="inp" data-qtd type="number" min="1" value="1"></label>
      <label class="lbl">Preço unit. (R$)<input class="inp" data-preco type="number" min="0" step="0.01"></label>
    </div><div class="hd" style="margin-top:8px"><span class="mut" style="font-size:12px" data-info></span><button type="button" class="lnk" data-acao="remover-item" style="color:var(--alerta)">${icp.lixo()} Remover</button></div>`);
    caixaItens.append(div);
    return div;
  }

  function totais() {
    let subtotal = 0;
    $$('[data-item]', caixaItens).forEach((d) => { subtotal += (Number($('[data-qtd]', d).value) || 0) * (Number($('[data-preco]', d).value) || 0); });
    const desconto = Number(form.desconto.value) || 0;
    $('[data-totais]', form).innerHTML = String(h`
      <div class="hd"><span>Subtotal</span><span class="tn clr">${fmt.reaisCentavos(subtotal)}</span></div>
      <div class="hd"><span>Desconto</span><span class="tn">− ${fmt.reaisCentavos(desconto)}</span></div>
      <div class="hd"><span class="clr" style="font-weight:600">Total</span><span class="num" style="font-size:30px">${fmt.reaisCentavos(Math.max(0, subtotal - desconto))}</span></div>`);
    return { subtotal, desconto };
  }

  const buscar = debounce(async (termo) => {
    const ul = $('[data-resultados]', caixaCliente);
    if (!ul) return;
    if (termo.trim().length < 2) { ul.innerHTML = ''; return; }
    try {
      const r = await painel.clientes.buscar(termo);
      ul.innerHTML = String(r.length ? h`${r.map((c) => h`<li><button type="button" class="lnk" style="flex:1;justify-content:space-between;color:var(--txt)" data-escolher="${c.id}" data-nome="${c.nome}" data-whats="${c.whatsapp || ''}" data-bairro="${c.bairro || ''}"><span>${c.nome}</span><span class="mut">${c.whatsapp || ''}</span></button></li>`)}` : h`<li class="mut">Nenhum cliente encontrado. Use “Cliente novo”.</li>`);
    } catch (err) { ul.innerHTML = String(h`<li class="alerta-txt">${err.message}</li>`); }
  }, 300);

  form.addEventListener('input', (e) => {
    if (e.target.matches('[data-busca-cliente]')) buscar(e.target.value);
    if (e.target.matches('[data-qtd], [data-preco], [name=desconto]')) totais();
  });
  form.addEventListener('change', (e) => {
    const item = e.target.closest('[data-item]');
    if (e.target.matches('[data-produto]')) {
      const p = produtos.find((x) => x.id === e.target.value);
      const sel = $('[data-variacao]', item);
      const vars = (p?.produto_variacoes || []).filter((v) => v.ativo).sort((a, b) => ordemTam[a.tamanho_codigo] - ordemTam[b.tamanho_codigo]);
      sel.innerHTML = String(h`<option value="">Escolha</option>${vars.map((v) => h`<option value="${v.id}">${nomeTam[v.tamanho_codigo] || v.tamanho_codigo} · ${fmt.reais(precoDe(p, v))}</option>`)}`);
      sel.disabled = !vars.length;
      $('[data-preco]', item).value = ''; $('[data-info]', item).textContent = '';
      totais();
    }
    if (e.target.matches('[data-variacao]')) {
      const p = produtos.find((x) => x.id === $('[data-produto]', item).value);
      const v = p?.produto_variacoes.find((x) => x.id === e.target.value);
      if (v) {
        const preco = precoDe(p, v);
        $('[data-preco]', item).value = preco.toFixed(2);
        const d = disp(v);
        $('[data-info]', item).innerHTML = String(h`Tabela ${fmt.reaisCentavos(v.preco)}${preco < Number(v.preco) ? ' · preço de campanha' : ''} · <span class="${d > 0 ? 'ok-txt' : 'alerta-txt'}">${d > 0 ? `${d} disponível(is)` : 'sem estoque: entra como encomenda'}</span>`);
      }
      totais();
    }
    if (e.target.name === 'entrega_tipo') {
      const ret = e.target.value === 'retirada';
      form.entrega_endereco.closest('label').hidden = ret; form.entrega_bairro.closest('label').hidden = ret; form.entrega_equipe.closest('label').hidden = ret;
    }
  });
  form.addEventListener('click', (e) => {
    const a = e.target.closest('[data-acao]')?.dataset.acao;
    const esc = e.target.closest('[data-escolher]');
    if (esc) { cliente = { id: esc.dataset.escolher, nome: esc.dataset.nome, whatsapp: esc.dataset.whats, bairro: esc.dataset.bairro }; renderCliente(); return; }
    if (a === 'trocar-cliente' || a === 'buscar-cliente') { cliente = null; clienteNovo = false; renderCliente(); $('[data-busca-cliente]', caixaCliente)?.focus(); }
    if (a === 'cliente-novo') { clienteNovo = true; renderCliente(); }
    if (a === 'item') linhaItem();
    if (a === 'remover-item') { e.target.closest('[data-item]').remove(); totais(); }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const erro = $('[data-erro]', form);
    const botao = $('button[type=submit]', form);
    erro.hidden = true;
    try {
      const itens = $$('[data-item]', caixaItens).map((d) => ({
        variacao_id: $('[data-variacao]', d).value, quantidade: Number($('[data-qtd]', d).value) || 0, preco_unitario: $('[data-preco]', d).value
      })).filter((i) => i.variacao_id);
      if (!cliente && !(clienteNovo && form.c_nome?.value.trim())) throw new Error('Escolha ou cadastre o cliente.');
      if (!itens.length) throw new Error('Inclua pelo menos um produto com tamanho.');
      if (itens.some((i) => i.quantidade < 1)) throw new Error('Confira as quantidades.');
      const { subtotal, desconto } = totais();
      if (desconto > subtotal) throw new Error('O desconto é maior que o valor da venda.');
      const tipo = form.entrega_tipo.value;
      const payload = {
        cliente_id: cliente?.id || null,
        cliente: cliente ? null : { nome: form.c_nome.value.trim(), whatsapp: form.c_whatsapp.value, logradouro: form.c_logradouro.value, bairro: form.c_bairro.value, cidade: form.c_cidade.value, origem: 'loja' },
        lead_id: pre.leadId || null,
        vendedor_id: form.vendedor?.value || null,
        status: form.status.value,
        desconto, forma_pagamento: form.forma.value, parcelas: Number(form.parcelas.value) || 1,
        observacoes: form.obs.value,
        itens: itens.map((i) => ({ ...i, preco_unitario: i.preco_unitario === '' ? null : Number(i.preco_unitario) })),
        entrega: {
          tipo, agendada_para: localParaIso(form.entrega_quando.value),
          endereco: tipo === 'retirada' ? null : form.entrega_endereco.value || form.c_logradouro?.value || null,
          bairro: tipo === 'retirada' ? null : form.entrega_bairro.value || form.c_bairro?.value || null,
          equipe: form.entrega_equipe.value || null
        }
      };
      botao.disabled = true; botao.textContent = 'Registrando…';
      const r = await painel.vendas.registrar(payload);
      toast(`Venda #${r.numero} registrada · ${fmt.reais(r.total)}`, 'ok');
      if (r.sem_estoque?.length) toast(`Atenção: sem estoque para ${r.sem_estoque.map((s) => s.descricao).join(', ')}. Faça o pedido à fábrica.`, 'erro');
      g.fechar();
      aoSalvar(r);
    } catch (err) {
      erro.textContent = err.message; erro.hidden = false;
      botao.disabled = false; botao.textContent = 'Registrar venda';
    }
  });

  renderCliente();
  linhaItem();
  totais();
}

