// Orçamentos: monta o orçamento com os preços do cadastro, gera a mensagem do WhatsApp e o PDF
import { painel, fmt } from '../../api.js';
import { h, raw, $, $$, debounce, esc } from '../../html.js';
import { icp, toast, gaveta, carregando, vazio, erroBloco, zapCliente } from '../ui.js';

const STATUS = { enviado: 'Enviado', aprovado: 'Aprovado', perdido: 'Perdido', rascunho: 'Rascunho' };
const STATUS_CLASSE = { enviado: 'st-info', aprovado: 'st-ok', perdido: 'st-mute', rascunho: 'st-wait' };
const FRETE = { nenhum: 'Não mencionar frete', valor: 'Frete com valor (parcelável junto)', gratis: 'Frete grátis', cliente: 'Frete por conta do cliente' };
const LOJA = {
  nome: 'LS Colchões',
  endereco: 'Av. Pref. João Daher, 1277, loja 3 · Lagoa Santa/MG',
  web: 'lscolchoes.com.br · @ls_colchoes',
  cnpj: 'CNPJ 68.020.458/0001-46',
  frase: 'Conforto que acolhe. Sono que transforma.',
  atendimento: 'Eduardo Moreira'
};

const brl = (v) => fmt.reaisCentavos(v);
const termina990 = (v) => Math.round(Number(v) * 100) % 1000 === 990;
const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0] || '';
const somaDiasData = (n) => { const d = new Date(Date.now() - 3 * 3600e3); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dataBR = (ymd) => (ymd ? ymd.slice(8, 10) + '/' + ymd.slice(5, 7) + '/' + ymd.slice(0, 4) : '');

// ---------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------
export default async function orcamentos(el, ctx) {
  const f = { busca: '', status: '' };
  el.innerHTML = String(h`
    <div class="cabeca"><div><h1>Orçamentos</h1><p>Monte o orçamento com os preços do cadastro, copie a mensagem pro WhatsApp e gere o PDF.</p></div>
      ${ctx.pode.vender ? h`<button class="btn btn-g" data-acao="novo">${icp.mais()} Novo orçamento</button>` : ''}</div>
    <div class="hd" style="gap:12px;flex-wrap:wrap">
      <div class="seg" role="tablist">${[['', 'Todos'], ...Object.entries(STATUS).filter(([k]) => k !== 'rascunho')].map(([k, t]) => h`<button class="sb" data-status="${k}" aria-selected="${String(k === '')}">${t}</button>`)}</div>
      <label class="busca" style="min-width:240px"><span class="sr">Buscar</span>${icp.busca()}<input class="inp" type="search" data-busca placeholder="Buscar cliente"></label>
    </div>
    <div data-lista>${carregando()}</div>`);
  const lista = $('[data-lista]', el);

  async function carregar() {
    lista.innerHTML = String(carregando());
    try {
      const itens = await painel.orcamentos.listar(f);
      if (!itens.length) { lista.innerHTML = String(vazio('Nenhum orçamento ainda. Clique em “Novo orçamento”.')); return; }
      lista.innerHTML = String(h`<div class="tabela"><table class="tbl"><thead><tr><th>Orçamento</th><th>Cliente</th><th>Itens</th><th class="r">Total</th><th>Validade</th><th>Status</th></tr></thead><tbody>
        ${itens.map((o) => {
          const ops = o.opcoes || [];
          const resumo = ops.map((op) => (op.itens || []).map((i) => `${i.qtd > 1 ? i.qtd + 'x ' : ''}${i.produto} ${i.tamanho}`).join(' + ')).join(' | ');
          const vencido = o.validade && o.validade < somaDiasData(0) && o.status === 'enviado';
          return h`<tr data-orc="${o.id}" style="cursor:pointer">
            <td><span class="clr" style="font-weight:600">#${o.numero}</span><span class="sub">${fmt.dataHora(o.criado_em)}${o.vendedor ? ' · ' + o.vendedor : ''}</span></td>
            <td>${o.cliente}<span class="sub">${o.whatsapp || ''}</span></td>
            <td style="max-width:320px;overflow:hidden;text-overflow:ellipsis" title="${resumo}">${ops.length > 1 ? h`<span class="tag o-outro">${ops.length} opções</span> ` : ''}${resumo || '—'}</td>
            <td class="r">${brl(o.total)}<span class="sub">${o.parcelas}x ${brl(Number(o.total) / (o.parcelas || 1))}</span></td>
            <td>${o.validade ? h`<span class="${vencido ? 'alerta-txt' : ''}">${dataBR(o.validade)}</span>` : '—'}</td>
            <td><span class="pill ${STATUS_CLASSE[o.status] || ''}">${STATUS[o.status] || o.status}</span></td>
          </tr>`;
        })}
      </tbody></table></div>`);
    } catch (err) { lista.innerHTML = String(erroBloco(err)); }
  }

  el.addEventListener('click', async (e) => {
    const st = e.target.closest('[data-status]');
    if (st) { f.status = st.dataset.status; $$('[data-status]', el).forEach((b) => b.setAttribute('aria-selected', String(b === st))); return carregar(); }
    if (e.target.closest('[data-acao="novo"]')) return novoOrcamento(ctx, carregar);
    const linha = e.target.closest('[data-orc]');
    if (linha) {
      try { const o = await painel.orcamentos.obter(linha.dataset.orc); novoOrcamento(ctx, carregar, { existente: o }); } catch (err) { toast(err.message, 'erro'); }
    }
  });
  const buscar = debounce(carregar, 350);
  el.addEventListener('input', (e) => { if (e.target.matches('[data-busca]')) { f.busca = e.target.value; buscar(); } });
  carregar();
}

// ---------------------------------------------------------------------
// Montar / abrir orçamento
// pre = { cliente: {id, nome, whatsapp}, leadId, existente }
// ---------------------------------------------------------------------
export async function novoOrcamento(ctx, aoSalvar = () => {}, pre = {}) {
  const ex = pre.existente || null;
  const g = gaveta({ titulo: ex ? `Orçamento #${ex.numero}` : 'Novo orçamento', corpo: carregando() });
  let produtos, base;
  try {
    [produtos, base] = await Promise.all([painel.produtos.listar(), ctx.base()]);
  } catch (err) { g.corpo.innerHTML = String(erroBloco(err)); return; }
  const TAM = Object.fromEntries(base.tamanhos.map((t) => [t.codigo, t]));
  produtos = produtos.filter((p) => p.produto_variacoes.some((v) => v.ativo && Number(v.preco) > 0)).sort((a, b) => a.nome.localeCompare(b.nome));
  const disp = (v) => (v.estoque ? (v.estoque.quantidade ?? 0) - (v.estoque.reservado ?? 0) : 0);
  const precoBlack = (v) => (v.preco_campanha != null && Number(v.preco_campanha) > 0 && Number(v.preco_campanha) < Number(v.preco) ? Number(v.preco_campanha) : null);
  const ehColchao = (p) => /colch/i.test(p.categorias?.slug || p.categorias?.nome || '') && !/^colch/i.test(p.nome);
  const nomeItem = (p) => (ehColchao(p) ? 'Colchão ' : '') + p.nome;
  const medida = (codigo) => { const t = TAM[codigo]; return t?.largura_cm && t?.comprimento_cm ? `${t.largura_cm}x${t.comprimento_cm}` : ''; };

  let cliente = pre.cliente || (ex ? { id: ex.cliente_id, nome: ex.cliente, whatsapp: ex.whatsapp } : null);
  let clienteNovo = false;
  let leadId = pre.leadId || ex?.lead_id || null;
  let mensagemEditada = false;

  g.corpo.innerHTML = String(h`
    <form class="pilha" style="gap:20px" novalidate>
      <fieldset class="pilha" style="border:0;padding:0;margin:0;gap:10px">
        <legend class="rot" style="padding:0;margin-bottom:10px">Cliente</legend>
        <div data-cliente></div>
      </fieldset>
      <div class="pilha" data-opcoes style="gap:16px"></div>
      <button type="button" class="lnk" data-acao="opcao">${icp.mais(16)} Adicionar outra opção (repete os itens pra você trocar)</button>
      <fieldset class="g2" style="border:0;padding:0;margin:0">
        <legend class="rot" style="padding:0;margin-bottom:10px">Condições</legend>
        <label class="lbl">Frete<select class="inp" name="frete_tipo">${Object.entries(FRETE).map(([k, t]) => h`<option value="${k}" ${(ex?.frete_tipo || 'nenhum') === k ? raw('selected') : ''}>${t}</option>`)}</select></label>
        <label class="lbl" data-frete-valor>Valor do frete (R$)<input class="inp" name="frete_valor" type="number" min="0" step="0.01" value="${ex?.frete_valor || ''}"></label>
        <label class="lbl">Parcelas sem juros<input class="inp" name="parcelas" type="number" min="1" max="24" value="${ex?.parcelas || 12}"></label>
        <label class="lbl">Validade (dias)<input class="inp" name="validade" type="number" min="1" max="30" value="3"></label>
        <label class="lbl" style="grid-column:1/-1">Observação no fim da mensagem <small class="mut">(opcional)</small><input class="inp" name="obs" maxlength="300" value="${ex?.observacoes || ''}" placeholder="Ex.: Garantia de fábrica Ortobom: 5 anos nas molas e 3 na espuma."></label>
      </fieldset>
      <div class="card realce pilha" style="padding:18px;gap:8px" data-totais></div>
      <div class="pilha" data-avisos style="gap:6px"></div>
      <label class="lbl">Mensagem pro WhatsApp <small class="mut">(pode editar antes de copiar)</small><textarea class="inp" name="mensagem" rows="12" style="font-family:inherit;line-height:1.5"></textarea></label>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button type="button" class="btn" data-acao="copiar">Copiar mensagem</button>
        <button type="button" class="btn" data-acao="zap">${icp.zap()} Abrir no WhatsApp</button>
        <button type="button" class="btn" data-acao="pdf">Gerar PDF</button>
      </div>
      ${ex ? h`<label class="lbl">Status do orçamento<select class="inp" name="status">${Object.entries(STATUS).map(([k, t]) => h`<option value="${k}" ${ex.status === k ? raw('selected') : ''}>${t}</option>`)}</select></label>` : ''}
      <p class="alerta-txt" data-erro role="alert" hidden style="margin:0"></p>
      ${ctx.pode.vender ? h`<button class="btn btn-g" type="submit">${ex ? 'Salvar alterações' : 'Salvar orçamento'}</button>` : ''}
    </form>`);

  const form = $('form', g.corpo);
  const caixaCliente = $('[data-cliente]', form);
  const caixaOpcoes = $('[data-opcoes]', form);

  // ---------------- cliente ----------------
  function renderCliente() {
    if (cliente) {
      caixaCliente.innerHTML = String(h`<div class="hd card" style="padding:14px 16px"><div><div class="clr" style="font-weight:600">${cliente.nome}</div><div class="mut" style="font-size:13px">${cliente.whatsapp || ''}</div></div>${ex ? '' : h`<button type="button" class="lnk" data-acao="trocar-cliente">Trocar</button>`}</div>`);
      return;
    }
    if (clienteNovo) {
      caixaCliente.innerHTML = String(h`<div class="g2">
        <label class="lbl">Nome<input class="inp" name="c_nome" required maxlength="120"></label>
        <label class="lbl">WhatsApp<input class="inp" name="c_whatsapp" type="tel" placeholder="(31) 9 0000-0000"></label>
      </div><button type="button" class="lnk" data-acao="buscar-cliente">Buscar cliente já cadastrado</button>`);
      $('[name=c_nome]', caixaCliente).focus();
      return;
    }
    caixaCliente.innerHTML = String(h`<label class="busca"><span class="sr">Buscar cliente</span>${icp.busca()}<input class="inp" type="search" data-busca-cliente placeholder="Nome ou WhatsApp do cliente" autocomplete="off"></label>
      <ul class="lst" data-resultados></ul>
      <button type="button" class="lnk" data-acao="cliente-novo">${icp.mais(16)} Cliente novo</button>`);
  }
  const buscarCliente = debounce(async (termo) => {
    const ul = $('[data-resultados]', caixaCliente);
    if (!ul) return;
    if (termo.trim().length < 2) { ul.innerHTML = ''; return; }
    try {
      const r = await painel.clientes.buscar(termo);
      ul.innerHTML = String(r.length ? h`${r.map((c) => h`<li><button type="button" class="lnk" style="flex:1;justify-content:space-between;color:var(--txt)" data-escolher="${c.id}" data-nome="${c.nome}" data-whats="${c.whatsapp || ''}"><span>${c.nome}</span><span class="mut">${c.whatsapp || ''}</span></button></li>`)}` : h`<li class="mut">Nenhum cliente encontrado. Use “Cliente novo”.</li>`);
    } catch (err) { ul.innerHTML = String(h`<li class="alerta-txt">${err.message}</li>`); }
  }, 300);

  // ---------------- opções e itens ----------------
  function novaOpcao(itens = []) {
    const card = document.createElement('fieldset');
    card.className = 'card pilha'; card.style.cssText = 'padding:16px;gap:10px;margin:0'; card.dataset.opcao = '';
    card.innerHTML = String(h`<div class="hd"><legend class="rot" data-titulo-opcao style="padding:0">Itens</legend><button type="button" class="lnk" data-acao="remover-opcao" style="color:var(--alerta)" hidden>${icp.lixo()} Remover opção</button></div>
      <div class="pilha" data-itens style="gap:10px"></div>
      <button type="button" class="lnk" data-acao="item">${icp.mais(16)} Adicionar item</button>`);
    caixaOpcoes.append(card);
    if (itens.length) itens.forEach((i) => linhaItem(card, i)); else linhaItem(card);
    rotularOpcoes();
    return card;
  }
  function rotularOpcoes() {
    const ops = $$('[data-opcao]', caixaOpcoes);
    ops.forEach((op, i) => {
      $('[data-titulo-opcao]', op).textContent = ops.length > 1 ? `Opção ${i + 1}` : 'Itens';
      $('[data-acao="remover-opcao"]', op).hidden = ops.length < 2;
    });
  }
  function linhaItem(card, ini = null) {
    const div = document.createElement('div');
    div.className = 'card'; div.style.padding = '12px'; div.dataset.item = '';
    div.innerHTML = String(h`<div class="g2" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr))">
      <label class="lbl" style="grid-column:1/-1">Produto<select class="inp" data-produto><option value="">Escolha o produto</option>${produtos.map((p) => h`<option value="${p.id}">${p.nome}</option>`)}</select></label>
      <label class="lbl">Tamanho<select class="inp" data-variacao disabled><option value="">—</option></select></label>
      <label class="lbl">Qtd.<input class="inp" data-qtd type="number" min="1" value="1"></label>
      <label class="lbl">Preço unit. (R$)<input class="inp" data-preco type="number" min="0" step="0.01"></label>
    </div>
    <div class="hd" style="margin-top:8px;gap:10px;flex-wrap:wrap"><span class="mut" style="font-size:12px" data-info></span>
      <span style="display:flex;gap:14px;align-items:center"><label class="mut" style="font-size:12px;display:none;align-items:center;gap:6px" data-caixa-black><input type="checkbox" data-black checked> Preço Black</label>
      <button type="button" class="lnk" data-acao="remover-item" style="color:var(--alerta)">${icp.lixo()} Remover</button></span></div>`);
    $('[data-itens]', card).append(div);
    if (ini?.produto_id) {
      $('[data-produto]', div).value = ini.produto_id;
      preencherTamanhos(div);
      if (ini.variacao_id) { $('[data-variacao]', div).value = ini.variacao_id; escolherVariacao(div, ini); }
      $('[data-qtd]', div).value = ini.qtd || 1;
    }
    return div;
  }
  function preencherTamanhos(item) {
    const p = produtos.find((x) => x.id === $('[data-produto]', item).value);
    const sel = $('[data-variacao]', item);
    const vars = (p?.produto_variacoes || []).filter((v) => v.ativo && Number(v.preco) > 0).sort((a, b) => (TAM[a.tamanho_codigo]?.ordem ?? 0) - (TAM[b.tamanho_codigo]?.ordem ?? 0));
    sel.innerHTML = String(h`<option value="">Escolha</option>${vars.map((v) => h`<option value="${v.id}">${TAM[v.tamanho_codigo]?.nome || v.tamanho_codigo} · ${fmt.reais(precoBlack(v) ?? v.preco)}</option>`)}`);
    sel.disabled = !vars.length;
    if (vars.length === 1) { sel.value = vars[0].id; escolherVariacao(item); return; }
    $('[data-preco]', item).value = ''; $('[data-info]', item).textContent = ''; $('[data-caixa-black]', item).style.display = 'none';
  }
  function escolherVariacao(item, ini = null) {
    const p = produtos.find((x) => x.id === $('[data-produto]', item).value);
    const v = p?.produto_variacoes.find((x) => x.id === $('[data-variacao]', item).value);
    const caixaBlack = $('[data-caixa-black]', item);
    if (!v) { $('[data-preco]', item).value = ''; $('[data-info]', item).textContent = ''; caixaBlack.style.display = 'none'; return; }
    const pb = precoBlack(v);
    const usarBlack = ini ? !!ini.black : true;
    caixaBlack.style.display = pb ? 'inline-flex' : 'none';
    $('[data-black]', item).checked = !!(pb && usarBlack);
    $('[data-preco]', item).value = (ini?.preco != null ? Number(ini.preco) : (pb && usarBlack ? pb : Number(v.preco))).toFixed(2);
    const d = disp(v);
    $('[data-info]', item).innerHTML = String(h`Tabela ${brl(v.preco)}${pb ? ` · Black ${brl(pb)}` : ''} · <span class="${d > 0 ? 'ok-txt' : 'alerta-txt'}">${d > 0 ? `${d} em estoque` : 'sem estoque: sob encomenda'}</span>`);
  }

  // ---------------- leitura dos dados ----------------
  function lerOpcoes() {
    return $$('[data-opcao]', caixaOpcoes).map((op, i, todas) => {
      const itens = $$('[data-item]', op).map((d) => {
        const p = produtos.find((x) => x.id === $('[data-produto]', d).value);
        const v = p?.produto_variacoes.find((x) => x.id === $('[data-variacao]', d).value);
        if (!p || !v) return null;
        const qtd = Math.max(1, Number($('[data-qtd]', d).value) || 1);
        const preco = Number($('[data-preco]', d).value) || 0;
        return {
          produto_id: p.id, variacao_id: v.id, produto: nomeItem(p), tamanho: TAM[v.tamanho_codigo]?.nome || v.tamanho_codigo,
          medida: medida(v.tamanho_codigo), qtd, preco, preco_tabela: Number(v.preco),
          black: !!(precoBlack(v) && $('[data-black]', d).checked), encomenda: disp(v) < qtd
        };
      }).filter(Boolean);
      const subtotal = itens.reduce((a, it) => a + it.qtd * it.preco, 0);
      return { titulo: todas.length > 1 ? `Opção ${i + 1}` : '', itens, subtotal };
    });
  }
  function condicoes() {
    const freteTipo = form.frete_tipo.value;
    const freteValor = freteTipo === 'valor' ? Number(form.frete_valor.value) || 0 : 0;
    const parcelas = Math.min(24, Math.max(1, Number(form.parcelas.value) || 12));
    const dias = Math.min(30, Math.max(1, Number(form.validade.value) || 3));
    return { freteTipo, freteValor, parcelas, dias, obs: form.obs.value.trim() };
  }
  const nomeCliente = () => cliente?.nome || form.c_nome?.value.trim() || '';

  function montarMensagem(ops, c) {
    const nome = primeiroNome(nomeCliente());
    const linhas = [];
    const usadas = ops.filter((o) => o.itens.length);
    linhas.push(nome ? `${nome}, segue o seu orçamento:` : 'Segue o seu orçamento:');
    usadas.forEach((op) => {
      linhas.push('');
      if (op.titulo) linhas.push(`*${op.titulo}*`);
      op.itens.forEach((it) => linhas.push(`${it.qtd > 1 ? it.qtd + 'x ' : ''}${it.produto} ${it.tamanho}${it.medida ? ` (${it.medida})` : ''}: ${brl(it.preco * it.qtd)}`));
      if (c.freteTipo === 'valor' && c.freteValor > 0) linhas.push(`Frete: ${brl(c.freteValor)}`);
      const total = op.subtotal + c.freteValor;
      linhas.push(`Total: *${brl(total)}*, em até ${c.parcelas}x de ${brl(total / c.parcelas)} sem juros ou o mesmo valor à vista.`);
    });
    linhas.push('');
    if (c.freteTipo === 'valor' && c.freteValor > 0) linhas.push('O frete já está incluso no total e pode ser parcelado junto.');
    if (c.freteTipo === 'gratis') linhas.push('A entrega é por nossa conta, sem custo de frete.');
    if (c.freteTipo === 'cliente') linhas.push('O frete fica por sua conta: você combina a retirada aqui na loja e a gente entrega tudo embalado.');
    if (c.obs) linhas.push(c.obs);
    linhas.push(`Orçamento válido por ${c.dias} ${c.dias === 1 ? 'dia' : 'dias'}.`);
    linhas.push('');
    linhas.push(usadas.length > 1 ? 'Qual das opções fez mais sentido pra você?' : 'Como fica melhor pra você: à vista ou parcelado?');
    return linhas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function atualizar() {
    const ops = lerOpcoes();
    const c = condicoes();
    $('[data-frete-valor]', form).hidden = c.freteTipo !== 'valor';
    const usadas = ops.filter((o) => o.itens.length);
    $('[data-totais]', form).innerHTML = String(usadas.length ? h`${usadas.map((op) => {
      const total = op.subtotal + c.freteValor;
      return h`<div class="hd"><span class="clr" style="font-weight:600">${op.titulo || 'Total'}</span><span style="text-align:right"><span class="num" style="font-size:26px">${brl(total)}</span><span class="sub">${c.parcelas}x de ${brl(total / c.parcelas)} sem juros ou à vista</span></span></div>`;
    })}${c.freteValor > 0 ? h`<span class="mut" style="font-size:12px">Inclui frete de ${brl(c.freteValor)}.</span>` : ''}` : h`<span class="mut">Escolha os produtos para ver o total.</span>`);
    const avisos = [];
    usadas.forEach((op) => op.itens.forEach((it) => {
      if (it.encomenda) avisos.push(`${op.titulo ? op.titulo + ': ' : ''}${it.produto} ${it.tamanho} sem estoque, é sob encomenda (até 25 dias, normalmente uns 10 dias úteis). Isso não vai na mensagem.`);
      if (!termina990(it.preco)) avisos.push(`${it.produto} ${it.tamanho}: o preço ${brl(it.preco)} não termina em 9,90.`);
      if (it.preco < it.preco_tabela && !it.black) avisos.push(`${it.produto} ${it.tamanho}: preço abaixo da tabela (${brl(it.preco_tabela)}).`);
    }));
    $('[data-avisos]', form).innerHTML = String(h`${avisos.map((a) => h`<p class="alerta-txt" style="margin:0;font-size:13px">${a}</p>`)}`);
    if (!mensagemEditada) form.mensagem.value = usadas.length ? montarMensagem(ops, c) : '';
    return { ops: usadas, c };
  }

  // ---------------- PDF (página de impressão com a marca) ----------------
  function gerarPdf() {
    const { ops, c } = atualizar();
    if (!ops.length) return toast('Escolha os produtos primeiro.', 'erro');
    const nome = nomeCliente() || 'Cliente';
    const hoje = somaDiasData(0);
    const num = ex?.numero ? `Nº ${ex.numero}` : '';
    const logo = new URL('../assets/img/ls-logo-branca.svg', location.href).href;
    const blocos = ops.map((op) => {
      const total = op.subtotal + c.freteValor;
      return `<section class="op">${op.titulo ? `<h3>${esc(op.titulo)}</h3>` : ''}
        <table><thead><tr><th>Produto</th><th>Medida</th><th class="r">Qtd.</th><th class="r">Valor</th></tr></thead><tbody>
        ${op.itens.map((it) => `<tr><td>${esc(it.produto)} <span class="t">${esc(it.tamanho)}</span></td><td>${esc(it.medida || '—')}</td><td class="r">${it.qtd}</td><td class="r">${brl(it.preco * it.qtd)}</td></tr>`).join('')}
        ${c.freteValor > 0 ? `<tr><td>Frete</td><td>—</td><td class="r">1</td><td class="r">${brl(c.freteValor)}</td></tr>` : ''}
        </tbody></table>
        <div class="tot"><div><span class="lb">Total</span><span class="vl">${brl(total)}</span></div>
          <div class="cond">em até <b>${c.parcelas}x de ${brl(total / c.parcelas)}</b> sem juros no cartão<br>ou <b>${brl(total)}</b> à vista (Pix, dinheiro ou débito)</div></div></section>`;
    }).join('');
    const obsFrete = c.freteTipo === 'cliente' ? 'Frete por conta do cliente (retirada na loja).' : c.freteTipo === 'gratis' ? 'Entrega sem custo de frete.' : '';
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Orçamento LS Colchões - ${esc(nome)}</title>
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,600;0,700;1,500&display=swap" rel="stylesheet">
      <style>
        @page { size: A4; margin: 0; }
        * { box-sizing: border-box; } body { margin: 0; font-family: Montserrat, Arial, sans-serif; color: #4A4A4A; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .pg { width: 210mm; min-height: 297mm; display: flex; flex-direction: column; }
        header { background: #062A4F; color: #fff; padding: 28px 40px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #C9A65A; }
        header img { height: 54px; } header .dir { text-align: right; } header h1 { font-family: 'Cormorant Garamond', serif; font-weight: 700; font-size: 34px; margin: 0; letter-spacing: .02em; }
        header .n { color: #E8D6A8; font-size: 12px; letter-spacing: .18em; text-transform: uppercase; }
        main { padding: 28px 40px; flex: 1; }
        .info { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: #FAF8F2; border: 1px solid #E8D6A8; border-radius: 10px; padding: 16px 20px; margin-bottom: 22px; font-size: 13px; }
        .info .lb { display: block; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: #C9A65A; font-weight: 600; margin-bottom: 3px; }
        .info b { color: #062A4F; font-size: 15px; }
        h3 { font-family: 'Cormorant Garamond', serif; color: #062A4F; font-size: 22px; margin: 0 0 8px; }
        .op { margin-bottom: 22px; page-break-inside: avoid; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #003B73; color: #fff; text-align: left; font-weight: 600; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; padding: 9px 12px; }
        td { padding: 10px 12px; border-bottom: 1px solid #E9E9E6; } tbody tr:nth-child(even) td { background: #F4F1E9; }
        td .t { color: #C9A65A; font-weight: 600; } .r { text-align: right; }
        .tot { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; background: #062A4F; color: #fff; border-radius: 10px; padding: 14px 20px; }
        .tot .lb { display: block; font-size: 10px; letter-spacing: .18em; text-transform: uppercase; color: #E8D6A8; } .tot .vl { font-family: 'Cormorant Garamond', serif; font-size: 32px; font-weight: 700; }
        .tot .cond { text-align: right; font-size: 12px; line-height: 1.6; } .tot b { color: #E8D6A8; }
        .obs { font-size: 12px; color: #4A4A4A; margin: 4px 0; }
        footer { background: #062A4F; color: #E8D6A8; text-align: center; padding: 16px 40px; font-size: 11px; line-height: 1.7; }
        footer .fr { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 17px; color: #fff; }
        @media screen { body { background: #e9e9e6; } .pg { margin: 20px auto; background: #fff; box-shadow: 0 6px 30px rgba(0,0,0,.15); } }
      </style></head><body><div class="pg">
      <header><img src="${logo}" alt="LS Colchões"><div class="dir"><h1>Orçamento</h1><div class="n">${esc(num)}${num ? ' · ' : ''}${dataBR(hoje)}</div></div></header>
      <main>
        <div class="info"><div><span class="lb">Cliente</span><b>${esc(nome)}</b>${cliente?.whatsapp || form.c_whatsapp?.value ? `<br>${esc(cliente?.whatsapp || form.c_whatsapp?.value)}` : ''}</div>
          <div><span class="lb">Atendimento</span><b>${esc(LOJA.atendimento)}</b><br>Válido até ${dataBR(somaDiasData(c.dias))}</div></div>
        ${blocos}
        ${obsFrete ? `<p class="obs">${esc(obsFrete)}</p>` : ''}${c.obs ? `<p class="obs">${esc(c.obs)}</p>` : ''}
        <p class="obs">Mesmo valor à vista ou em até ${c.parcelas}x sem juros no cartão.</p>
      </main>
      <footer><div class="fr">${esc(LOJA.frase)}</div>${esc(LOJA.endereco)}<br>${esc(LOJA.web)} · ${esc(LOJA.cnpj)}</footer>
      </div><script>document.fonts.ready.then(()=>setTimeout(()=>print(),300));<\/script></body></html>`;
    const w = window.open('', '_blank');
    if (!w) return toast('O navegador bloqueou a janela do PDF. Libere pop-ups para o painel.', 'erro');
    w.document.write(html); w.document.close();
  }

  // ---------------- eventos ----------------
  form.addEventListener('input', (e) => {
    if (e.target.matches('[data-busca-cliente]')) return buscarCliente(e.target.value);
    if (e.target.name === 'mensagem') { mensagemEditada = true; return; }
    if (e.target.matches('[data-qtd], [data-preco], [name=frete_valor], [name=parcelas], [name=validade], [name=obs], [name=c_nome]')) atualizar();
  });
  form.addEventListener('change', (e) => {
    const item = e.target.closest('[data-item]');
    if (e.target.matches('[data-produto]')) { preencherTamanhos(item); atualizar(); }
    if (e.target.matches('[data-variacao]')) { escolherVariacao(item); atualizar(); }
    if (e.target.matches('[data-black]')) {
      const p = produtos.find((x) => x.id === $('[data-produto]', item).value);
      const v = p?.produto_variacoes.find((x) => x.id === $('[data-variacao]', item).value);
      if (v) $('[data-preco]', item).value = (e.target.checked && precoBlack(v) ? precoBlack(v) : Number(v.preco)).toFixed(2);
      atualizar();
    }
    if (e.target.name === 'frete_tipo') atualizar();
  });
  form.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-acao]')?.dataset.acao;
    const escolha = e.target.closest('[data-escolher]');
    if (escolha) { cliente = { id: escolha.dataset.escolher, nome: escolha.dataset.nome, whatsapp: escolha.dataset.whats }; leadId = null; renderCliente(); atualizar(); return; }
    if (a === 'trocar-cliente' || a === 'buscar-cliente') { cliente = null; clienteNovo = false; leadId = null; renderCliente(); $('[data-busca-cliente]', caixaCliente)?.focus(); }
    if (a === 'cliente-novo') { clienteNovo = true; renderCliente(); }
    if (a === 'item') { linhaItem(e.target.closest('[data-opcao]')); }
    if (a === 'remover-item') { e.target.closest('[data-item]').remove(); atualizar(); }
    if (a === 'opcao') {
      const ultima = $$('[data-opcao]', caixaOpcoes).pop();
      const itens = ultima ? $$('[data-item]', ultima).map((d) => ({ produto_id: $('[data-produto]', d).value, variacao_id: $('[data-variacao]', d).value, qtd: $('[data-qtd]', d).value, preco: $('[data-preco]', d).value === '' ? null : Number($('[data-preco]', d).value), black: $('[data-black]', d).checked })).filter((i) => i.produto_id) : [];
      novaOpcao(itens); atualizar();
    }
    if (a === 'remover-opcao') { e.target.closest('[data-opcao]').remove(); rotularOpcoes(); atualizar(); }
    if (a === 'copiar') {
      atualizar();
      if (!form.mensagem.value) return toast('Escolha os produtos primeiro.', 'erro');
      try { await navigator.clipboard.writeText(form.mensagem.value); toast('Mensagem copiada.', 'ok'); } catch { form.mensagem.select(); document.execCommand('copy'); toast('Mensagem copiada.', 'ok'); }
    }
    if (a === 'zap') {
      atualizar();
      const numero = cliente?.whatsapp || form.c_whatsapp?.value;
      const link = zapCliente(numero, form.mensagem.value);
      if (!link) return toast('Cliente sem WhatsApp cadastrado.', 'erro');
      window.open(link, '_blank');
    }
    if (a === 'pdf') gerarPdf();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const erro = $('[data-erro]', form);
    const botao = $('button[type=submit]', form);
    erro.hidden = true;
    try {
      const { ops, c } = atualizar();
      if (!cliente && !(clienteNovo && form.c_nome?.value.trim())) throw new Error('Escolha ou cadastre o cliente.');
      if (!ops.length) throw new Error('Inclua pelo menos um produto com tamanho.');
      if (c.freteTipo === 'valor' && !c.freteValor) throw new Error('Informe o valor do frete.');
      botao.disabled = true; botao.textContent = 'Salvando…';
      if (!cliente) {
        const novo = await painel.clientes.salvar({ nome: form.c_nome.value.trim(), whatsapp: form.c_whatsapp.value || null, origem: 'whatsapp' });
        cliente = { id: novo.id, nome: novo.nome, whatsapp: novo.whatsapp };
      }
      if (!leadId) leadId = (await painel.orcamentos.leadAberto(cliente.id))?.id || null;
      const opcoes = ops.map((op) => ({ titulo: op.titulo, itens: op.itens, total: Number((op.subtotal + c.freteValor).toFixed(2)) }));
      const total = opcoes[0].total;
      const salvo = await painel.orcamentos.salvar({
        ...(ex ? { id: ex.id } : {}),
        cliente_id: cliente.id, lead_id: leadId, opcoes,
        frete_tipo: c.freteTipo, frete_valor: c.freteValor, parcelas: c.parcelas,
        validade: somaDiasData(c.dias), observacoes: c.obs || null, mensagem: form.mensagem.value, total,
        status: form.status?.value || ex?.status || 'enviado'
      });
      if (leadId && !ex) {
        const resumo = opcoes.map((op) => `${op.titulo ? op.titulo + ': ' : ''}${op.itens.map((i) => `${i.qtd > 1 ? i.qtd + 'x ' : ''}${i.produto} ${i.tamanho} ${brl(i.preco * i.qtd)}`).join(' + ')} = ${brl(op.total)}`).join(' | ');
        await painel.leads.atualizar(leadId, { etapa: 'orcamento', valor_estimado: total });
        await painel.leads.anotar({ clienteId: cliente.id, leadId, tipo: 'orcamento', texto: `Orçamento #${salvo.numero}: ${resumo} (${c.parcelas}x sem juros)` });
      }
      toast(`Orçamento #${salvo.numero} salvo${leadId && !ex ? ' · lead em Orçamento' : ''}.`, 'ok');
      g.fechar();
      aoSalvar(salvo);
    } catch (err) {
      erro.textContent = err.message; erro.hidden = false;
      if (botao) { botao.disabled = false; botao.textContent = ex ? 'Salvar alterações' : 'Salvar orçamento'; }
    }
  });

  // ---------------- início ----------------
  renderCliente();
  if (ex?.opcoes?.length) {
    ex.opcoes.forEach((op) => novaOpcao(op.itens || []));
    form.validade.value = ex.validade ? Math.max(1, Math.round((new Date(ex.validade) - new Date(ex.criado_em.slice(0, 10))) / 864e5)) : 3;
    if (ex.mensagem) { form.mensagem.value = ex.mensagem; mensagemEditada = true; }
    atualizar();
    if (ex.mensagem) form.mensagem.value = ex.mensagem;
  } else {
    novaOpcao();
    atualizar();
  }
}
