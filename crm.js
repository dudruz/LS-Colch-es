// CRM: funil de leads (arrastar entre etapas), ficha do lead, clientes e ficha do cliente
import { painel, fmt } from '../../api.js';
import { h, raw, $, $$, debounce } from '../../html.js';
import { icp, ROT, opcoes, tagOrigem, pill, iniciais, toast, gaveta, modal, pedirTexto, confirmar, carregando, vazio, erroBloco, localParaIso, isoParaLocal, zapCliente } from '../ui.js';

const ETAPAS = ['novo', 'atendimento', 'orcamento', 'vendido', 'perdido'];
const DIAS_FECHADOS = 30; // vendidos/perdidos aparecem por 30 dias no funil

function tempo(iso) {
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (min < 60) return `há ${Math.max(1, min)} min`;
  if (min < 1440) return `há ${Math.round(min / 60)} h`;
  return `há ${Math.round(min / 1440)} d`;
}

export default async function crm(el, ctx) {
  const [sub, id] = ctx.params;
  const abas = h`<div class="seg" role="tablist"><a class="sb" role="tab" href="#/crm" aria-selected="${String(!sub)}" style="display:inline-flex;align-items:center;text-decoration:none">Funil de leads</a><a class="sb" role="tab" href="#/crm/clientes" aria-selected="${String(sub === 'clientes' || sub === 'cliente')}" style="display:inline-flex;align-items:center;text-decoration:none">Clientes</a></div>`;
  if (sub === 'cliente' && id) return fichaCliente(el, ctx, id, abas);
  if (sub === 'clientes') return listaClientes(el, ctx, abas);
  return funil(el, ctx, abas, sub === 'lead' ? id : null);
}

/** Pergunta o motivo da perda: { categoria, detalhe } ou null se cancelar */
export async function escolherMotivo(nome = '') {
  return modal({
    titulo: nome ? `Por que ${nome.split(' ')[0]} não comprou?` : 'Por que o lead foi perdido?', confirmar: 'Marcar como perdido', perigo: true,
    corpo: h`<div class="chips" role="radiogroup" aria-label="Motivo">${Object.entries(ROT.motivos).map(([k, t]) => h`<button type="button" class="chip" role="radio" data-motivo="${k}" aria-pressed="false">${t}</button>`)}</div>
      <label class="lbl">Detalhe <small class="mut">(opcional)</small><textarea class="inp" name="detalhe" maxlength="300" placeholder="Ex.: achou caro o king, queria entrega no sábado"></textarea></label>`,
    aoAbrir(form) {
      form.addEventListener('click', (e) => {
        const b = e.target.closest('[data-motivo]'); if (!b) return;
        $$('[data-motivo]', form).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      });
    },
    aoConfirmar(f, form) {
      const sel = $('[data-motivo][aria-pressed="true"]', form);
      if (!sel) throw new Error('Escolha o motivo.');
      return { categoria: sel.dataset.motivo, detalhe: String(f.get('detalhe') || '').trim() || null };
    }
  });
}

const horas = (iso) => (Date.now() - new Date(iso)) / 36e5;
export const duracao = (min) => (min < 60 ? `${Math.max(1, Math.round(min))} min` : min < 1440 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} d`);

// ---------------------------------------------------------------------
// Funil (kanban)
// ---------------------------------------------------------------------
async function funil(el, ctx, abas, abrirId = null) {
  const [equipe, campanhas] = await Promise.all([ctx.equipe().catch(() => []), painel.campanhas.ativas().catch(() => [])]);
  const vendedores = equipe.filter((p) => ['admin', 'gerente', 'vendedor'].includes(p.papel));
  const f = { origem: '', responsavelId: ctx.papel === 'vendedor' ? ctx.perfil.id : '', busca: '' };
  let leads = [];

  el.innerHTML = String(h`
    <div class="cabeca"><div><h1>CRM e leads</h1><p>Arraste o card para mudar a etapa. Leads do site entram sozinhos em “Novo”.</p></div>
      ${ctx.pode.vender ? h`<button class="btn btn-g" data-acao="novo-lead">${icp.mais()} Novo lead</button>` : ''}</div>
    <div class="hd">${abas}
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <label class="busca"><span class="sr">Buscar</span>${icp.busca()}<input class="inp" type="search" data-f="busca" placeholder="Buscar cliente" style="width:220px"></label>
        <select class="inp" data-f="origem" style="width:auto" aria-label="Origem">${opcoes(ROT.origens, '', 'Todas as origens')}</select>
        <select class="inp" data-f="responsavelId" style="width:auto" aria-label="Responsável"><option value="">Toda a equipe</option>${vendedores.map((v) => h`<option value="${v.id}" ${f.responsavelId === v.id ? raw('selected') : ''}>${v.nome}</option>`)}</select>
      </div></div>
    <div class="gk" data-resumo></div>
    <div data-quadro>${carregando()}</div>`);

  const quadro = $('[data-quadro]', el);

  function card(l) {
    const atrasado = l.proximo_contato && new Date(l.proximo_contato) < new Date() && !['vendido', 'perdido'].includes(l.etapa);
    return h`<button type="button" class="lead" draggable="${ctx.pode.vender}" data-lead="${l.id}">
      <span class="hd" style="gap:8px"><span class="clr" style="font-weight:600;font-size:14px">${l.cliente}</span>${tagOrigem(l.origem)}</span>
      ${l.campanha_trafego ? h`<span class="mut" style="font-size:12px">${icp.trafego(13)} ${l.campanha_trafego}</span>` : ''}
      ${l.etapa === 'novo' && !l.primeiro_contato_em && horas(l.criado_em) >= 1 ? h`<span class="alerta-txt" style="font-size:12px;font-weight:600">Sem 1º contato há ${tempo(l.criado_em).replace('há ', '')}</span>` : ''}
      ${l.tentativas > 0 && !['vendido', 'perdido'].includes(l.etapa) ? h`<span class="alerta-txt" style="font-size:12px">${l.tentativas} tentativa(s) sem resposta</span>` : ''}
      ${l.interesses?.length ? h`<span>${l.interesses.join(', ')}${l.tamanho_codigo ? ' · ' + l.tamanho_codigo : ''}</span>` : ''}
      ${l.valor_estimado ? h`<span class="clr tn">${fmt.reais(l.valor_estimado)}</span>` : ''}
      ${l.proximo_contato && !['vendido', 'perdido'].includes(l.etapa) ? h`<span class="${atrasado ? 'alerta-txt' : 'mut'}" style="font-size:12px">${atrasado ? 'Retorno atrasado · ' : 'Retornar '}${fmt.dataHora(l.proximo_contato)}</span>` : ''}
      ${l.etapa === 'perdido' ? h`<span class="mut" style="font-size:12px">Motivo: ${ROT.motivos[l.motivo_categoria] || 'Desconhecido'}${l.motivo_perda ? ' · ' + l.motivo_perda : ''}</span>` : ''}
      <span class="hd" style="font-size:12px"><span class="mut">${tempo(l.criado_em)}</span>${l.responsavel ? h`<span class="avatar az" style="width:26px;height:26px;font-size:10px" title="${l.responsavel}">${iniciais(l.responsavel)}</span>` : h`<span class="mut">sem responsável</span>`}</span>
    </button>`;
  }

  function render() {
    const termo = f.busca.trim().toLowerCase();
    const limite = Date.now() - DIAS_FECHADOS * 864e5;
    const visiveis = leads.filter((l) => (!termo || l.cliente.toLowerCase().includes(termo))
      && (!['vendido', 'perdido'].includes(l.etapa) || new Date(l.atualizado_em) >= limite));
    const abertos = visiveis.filter((l) => !['vendido', 'perdido'].includes(l.etapa));
    const atrasados = abertos.filter((l) => l.proximo_contato && new Date(l.proximo_contato) < new Date());
    $('[data-resumo]', el).innerHTML = String(h`
      <div class="card kpi"><span class="rot">Leads em aberto</span><span class="num">${abertos.length}</span></div>
      <div class="card kpi"><span class="rot">Valor em negociação</span><span class="num">${fmt.reais(abertos.reduce((a, l) => a + Number(l.valor_estimado || 0), 0))}</span></div>
      <div class="card kpi"><span class="rot">Aguardando 1º contato</span><span class="num ${abertos.some((l) => l.etapa === 'novo' && !l.primeiro_contato_em && horas(l.criado_em) >= 1) ? 'alerta-txt' : ''}">${abertos.filter((l) => l.etapa === 'novo' && !l.primeiro_contato_em).length}</span></div>
      <div class="card kpi"><span class="rot">Retornos atrasados</span><span class="num ${atrasados.length ? 'alerta-txt' : ''}">${atrasados.length}</span></div>
      <div class="card kpi"><span class="rot">Sem responsável</span><span class="num">${abertos.filter((l) => !l.responsavel_id).length}</span></div>`);
    quadro.innerHTML = String(h`<div class="kanban">${ETAPAS.map((et) => {
      const doGrupo = visiveis.filter((l) => l.etapa === et);
      const soma = doGrupo.reduce((a, l) => a + Number(l.valor_estimado || 0), 0);
      return h`<section class="coluna" data-etapa="${et}" style="--cor:${ROT.etapaCor[et]}" aria-label="${ROT.etapas[et]}">
        <header><span class="clr" style="font-weight:600">${ROT.etapas[et]} <span class="mut">${doGrupo.length}</span></span><span class="mut tn" style="font-size:12px">${soma ? fmt.reais(soma) : ''}</span></header>
        ${doGrupo.length ? doGrupo.map(card) : h`<p class="mut" style="font-size:12px;text-align:center;margin:12px 0">${['vendido', 'perdido'].includes(et) ? `Nada nos últimos ${DIAS_FECHADOS} dias` : 'Vazio'}</p>`}
      </section>`;
    })}</div>`);
  }

  async function carregar() {
    try {
      leads = await painel.leads.listar({ origem: f.origem || undefined, responsavelId: f.responsavelId || undefined });
      render();
    } catch (err) { quadro.innerHTML = String(erroBloco(err)); }
  }

  async function mover(lead, etapa) {
    if (lead.etapa === etapa) return;
    try {
      if (etapa === 'vendido') {
        const registrar = await confirmar('Quer registrar a venda agora? Ela reserva o estoque e já marca o lead como vendido.', { titulo: 'Lead vendido', botao: 'Registrar venda', perigo: false });
        if (registrar) {
          const { novaVenda } = await import('./vendas.js');
          return novaVenda(ctx, carregar, { cliente: { id: lead.cliente_id, nome: lead.cliente, whatsapp: lead.whatsapp }, leadId: lead.id });
        }
      }
      let motivo = null;
      if (etapa === 'perdido') {
        motivo = await escolherMotivo(lead.cliente);
        if (!motivo) return render();
      }
      await painel.leads.mover(lead.id, etapa, motivo?.detalhe || null, motivo?.categoria || null);
      lead.etapa = etapa; lead.atualizado_em = new Date().toISOString();
      if (motivo) { lead.motivo_categoria = motivo.categoria; lead.motivo_perda = motivo.detalhe; }
      if (etapa !== 'novo' && !lead.primeiro_contato_em) lead.primeiro_contato_em = new Date().toISOString();
      render();
      toast(`${lead.cliente} → ${ROT.etapas[etapa]}`, 'ok');
    } catch (err) { toast(err.message, 'erro'); render(); }
  }

  // arrastar e soltar
  let arrastado = null;
  quadro.addEventListener('dragstart', (e) => { const c = e.target.closest('[data-lead]'); if (!c) return; arrastado = c.dataset.lead; e.dataTransfer.setData('text/plain', arrastado); e.dataTransfer.effectAllowed = 'move'; });
  quadro.addEventListener('dragover', (e) => { const col = e.target.closest('[data-etapa]'); if (!col || !arrastado) return; e.preventDefault(); $$('.coluna', quadro).forEach((c) => c.classList.toggle('alvo', c === col)); });
  quadro.addEventListener('dragleave', (e) => { if (!e.relatedTarget || !quadro.contains(e.relatedTarget)) $$('.coluna', quadro).forEach((c) => c.classList.remove('alvo')); });
  quadro.addEventListener('drop', (e) => {
    e.preventDefault();
    const col = e.target.closest('[data-etapa]');
    $$('.coluna', quadro).forEach((c) => c.classList.remove('alvo'));
    const l = leads.find((x) => x.id === arrastado); arrastado = null;
    if (col && l) mover(l, col.dataset.etapa);
  });
  quadro.addEventListener('dragend', () => { arrastado = null; $$('.coluna', quadro).forEach((c) => c.classList.remove('alvo')); });

  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-acao="novo-lead"]')) return novoLead(ctx, vendedores, campanhas, carregar);
    const c = e.target.closest('[data-lead]');
    if (c) { const l = leads.find((x) => x.id === c.dataset.lead); if (l) detalheLead(ctx, l, vendedores, campanhas, { carregar, mover }); }
  });
  const buscar = debounce(render, 200);
  el.addEventListener('input', (e) => { if (e.target.dataset.f === 'busca') { f.busca = e.target.value; buscar(); } });
  el.addEventListener('change', (e) => { const k = e.target.dataset.f; if (k && k !== 'busca') { f[k] = e.target.value; carregar(); } });

  await carregar();
  if (abrirId) {
    const l = leads.find((x) => x.id === abrirId);
    if (l) detalheLead(ctx, l, vendedores, campanhas, { carregar, mover });
    history.replaceState(null, '', '#/crm');
  }
  return painel.leads.aoNovoLead(() => carregar());
}

// ---------------------------------------------------------------------
// Gaveta do lead
// ---------------------------------------------------------------------
async function detalheLead(ctx, lead, vendedores, campanhas, { carregar, mover }) {
  const g = gaveta({ titulo: lead.cliente, corpo: carregando() });
  async function render() {
    let ficha = null;
    try { ficha = await painel.clientes.ficha(lead.cliente_id); } catch { /* segue sem linha do tempo */ }
    const zap = zapCliente(lead.whatsapp, `Olá, ${lead.cliente.split(' ')[0]}! Aqui é da LS Colchões. Recebemos seu contato e vou te ajudar a escolher.`);
    const utm = lead.utm ? Object.entries(lead.utm).map(([k, v]) => `${k.replace('utm_', '')}: ${v}`).join(' · ') : '';
    const pode = ctx.pode.vender;
    g.corpo.innerHTML = String(h`
      <div class="hd"><span>${tagOrigem(lead.origem)} <span class="mut" style="font-size:13px">· entrou ${fmt.dataHora(lead.criado_em)}</span></span>
        ${zap ? h`<a class="btn btn-g btn-p" href="${zap}" target="_blank" rel="noopener" data-acao="zap">${icp.zap()} Chamar no WhatsApp</a>` : ''}</div>
      <p class="${!lead.primeiro_contato_em && lead.etapa === 'novo' ? 'alerta-txt' : 'mut'}" style="margin:0;font-size:13px">${lead.primeiro_contato_em
        ? `1º contato em ${fmt.dataHora(lead.primeiro_contato_em)} (${duracao((new Date(lead.primeiro_contato_em) - new Date(lead.criado_em)) / 6e4)} depois de chegar)${lead.tentativas ? ` · ${lead.tentativas} tentativa(s) sem resposta` : ''}`
        : `Aguardando 1º contato há ${tempo(lead.criado_em).replace('há ', '')}`}</p>
      ${lead.etapa === 'perdido' ? h`<p class="alerta-txt" style="margin:0;font-size:13px">Perdido: ${ROT.motivos[lead.motivo_categoria] || 'Desconhecido'}${lead.motivo_perda ? ' · ' + lead.motivo_perda : ''}</p>` : ''}
      <div class="card pilha" style="padding:18px;gap:10px;font-size:14px">
        <div class="hd"><span>WhatsApp</span><span class="clr">${lead.whatsapp || '—'}</span></div>
        <div class="hd"><span>Interesse</span><span class="clr" style="text-align:right">${lead.interesses?.join(', ') || '—'}</span></div>
        <div class="hd"><span>Tamanho</span><span class="clr">${lead.tamanho_codigo || 'não informado'}</span></div>
        ${lead.como_dorme ? h`<div class="hd"><span>Como dorme</span><span class="clr">${lead.como_dorme}</span></div>` : ''}
        ${lead.pagina_origem ? h`<div class="hd"><span>Página</span><span class="clr">${lead.pagina_origem}</span></div>` : ''}
        ${utm ? h`<div class="hd"><span>Link do anúncio</span><span class="clr" style="text-align:right;font-size:12px">${utm}</span></div>` : ''}
        ${lead.mensagem ? h`<div><span class="rot">Mensagem</span><p class="clr" style="margin:6px 0 0;white-space:pre-wrap">${lead.mensagem}</p></div>` : ''}
      </div>
      <form class="g2" data-form-lead>
        <label class="lbl">Etapa<select class="inp" name="etapa" ${pode ? '' : raw('disabled')}>${opcoes(ROT.etapas, lead.etapa)}</select></label>
        <label class="lbl">Responsável<select class="inp" name="responsavel" ${ctx.pode.admin ? '' : raw('disabled')}><option value="">Sem responsável</option>${vendedores.map((v) => h`<option value="${v.id}" ${lead.responsavel_id === v.id ? raw('selected') : ''}>${v.nome}</option>`)}</select></label>
        <label class="lbl">Próximo contato<input class="inp" name="retorno" type="datetime-local" value="${isoParaLocal(lead.proximo_contato)}" ${pode ? '' : raw('disabled')}></label>
        <label class="lbl">Valor estimado (R$)<input class="inp" name="valor" type="number" min="0" step="0.01" value="${lead.valor_estimado ?? ''}" ${pode ? '' : raw('disabled')}></label>
        <label class="lbl" style="grid-column:1/-1">Campanha de tráfego<select class="inp" name="campanha" ${pode ? '' : raw('disabled')}><option value="">Nenhuma (orgânico, indicação, loja)</option>${[...campanhas, ...(lead.campanha_trafego_id && !campanhas.some((c) => c.id === lead.campanha_trafego_id) ? [{ id: lead.campanha_trafego_id, nome: lead.campanha_trafego }] : [])].map((c) => h`<option value="${c.id}" ${lead.campanha_trafego_id === c.id ? raw('selected') : ''}>${c.nome}${c.codigo && c.codigo !== c.nome ? ` (ref: ${c.codigo})` : ''}</option>`)}</select></label>
      </form>
      ${pode ? h`<div style="display:flex;gap:10px;flex-wrap:wrap">
        ${lead.etapa !== 'vendido' ? h`<button class="btn btn-g" data-acao="venda">Registrar venda</button>` : ''}
        ${!['vendido', 'perdido'].includes(lead.etapa) ? h`<button class="btn" data-acao="sem-resposta">Tentei contato, sem resposta${lead.tentativas ? ` (${lead.tentativas})` : ''}</button>` : ''}
        ${lead.tentativas >= 3 && !['vendido', 'perdido'].includes(lead.etapa) ? h`<button class="btn btn-perigo" data-acao="perder-sem-resposta">Encerrar: não respondeu</button>` : ''}
        <button class="btn" data-acao="nota">Adicionar anotação</button>
        <a class="btn" href="#/crm/cliente/${lead.cliente_id}">Ficha do cliente</a>
      </div>` : ''}
      <div><span class="rot">Linha do tempo</span>
        ${ficha?.eventos?.length ? h`<ol class="linha-tempo">${ficha.eventos.map((ev) => h`<li><span class="clr">${ev.descricao}</span><span class="sub">${fmt.dataHora(ev.quando)}${ev.usuario ? ' · ' + ev.usuario : ''}</span></li>`)}</ol>` : h`<p class="mut" style="font-size:13px">Sem registros ainda.</p>`}
      </div>`);
  }
  await render();

  g.corpo.addEventListener('change', async (e) => {
    const n = e.target.name;
    try {
      if (n === 'etapa') { g.fechar(); return mover(lead, e.target.value); }
      if (n === 'responsavel') { await painel.leads.atribuir(lead.id, e.target.value || null); lead.responsavel_id = e.target.value || null; lead.responsavel = vendedores.find((v) => v.id === e.target.value)?.nome || null; }
      if (n === 'retorno') { await painel.leads.agendarRetorno(lead.id, localParaIso(e.target.value)); lead.proximo_contato = localParaIso(e.target.value); }
      if (n === 'valor') { await painel.leads.atualizar(lead.id, { valor_estimado: e.target.value || null }); lead.valor_estimado = e.target.value || null; }
      if (n === 'campanha') {
        await painel.leads.atualizar(lead.id, { campanha_trafego_id: e.target.value || null });
        lead.campanha_trafego_id = e.target.value || null;
        lead.campanha_trafego = campanhas.find((c) => c.id === e.target.value)?.nome || null;
      }
      toast('Lead atualizado.', 'ok');
      carregar();
    } catch (err) { toast(err.message, 'erro'); }
  });
  g.corpo.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-acao]')?.dataset.acao;
    if (a === 'zap' && ctx.pode.vender && (!lead.primeiro_contato_em || lead.etapa === 'novo')) {
      painel.leads.registrarContato(lead.id).then(() => {
        lead.primeiro_contato_em = lead.primeiro_contato_em || new Date().toISOString();
        if (lead.etapa === 'novo') lead.etapa = 'atendimento';
        carregar(); render();
      }, () => {});
      return;
    }
    if (a === 'sem-resposta') {
      try {
        lead.tentativas = await painel.leads.semResposta(lead.id);
        if (lead.etapa === 'novo') lead.etapa = 'atendimento';
        lead.primeiro_contato_em = lead.primeiro_contato_em || new Date().toISOString();
        toast(`Tentativa registrada (${lead.tentativas}ª). Retorno agendado para amanhã.`, 'ok');
        carregar(); await render();
      } catch (err) { toast(err.message, 'erro'); }
      return;
    }
    if (a === 'perder-sem-resposta') {
      try {
        await painel.leads.mover(lead.id, 'perdido', `${lead.tentativas} tentativas sem resposta`, 'sem_resposta');
        toast(`${lead.cliente} → Perdido (não respondeu)`, 'ok'); g.fechar(); carregar();
      } catch (err) { toast(err.message, 'erro'); }
      return;
    }
    if (a === 'venda') {
      g.fechar();
      const { novaVenda } = await import('./vendas.js');
      novaVenda(ctx, carregar, { cliente: { id: lead.cliente_id, nome: lead.cliente, whatsapp: lead.whatsapp }, leadId: lead.id });
    }
    if (a === 'nota') {
      const texto = await pedirTexto('Nova anotação', 'O que aconteceu neste atendimento?', { obrigatorio: true });
      if (!texto) return;
      try { await painel.leads.anotar({ clienteId: lead.cliente_id, leadId: lead.id, texto }); await render(); } catch (err) { toast(err.message, 'erro'); }
    }
  });
}

// ---------------------------------------------------------------------
// Novo lead manual
// ---------------------------------------------------------------------
async function novoLead(ctx, vendedores, campanhas, aoSalvar) {
  const base = await ctx.base();
  await modal({
    titulo: 'Novo lead', confirmar: 'Cadastrar lead',
    corpo: h`<div class="g2">
      <label class="lbl">Nome<input class="inp" name="nome" required maxlength="120"></label>
      <label class="lbl">WhatsApp<input class="inp" name="whatsapp" type="tel" required placeholder="(31) 9 0000-0000"></label>
      <label class="lbl">Origem<select class="inp" name="origem">${opcoes(ROT.origens, 'whatsapp')}</select></label>
      <label class="lbl">Tamanho<select class="inp" name="tamanho"><option value="">Não sabe ainda</option>${base.tamanhos.map((t) => h`<option value="${t.codigo}">${t.nome}</option>`)}</select></label>
      <label class="lbl">Interesse<input class="inp" name="interesses" placeholder="Ex.: colchão, box baú"></label>
      <label class="lbl">Valor estimado (R$)<input class="inp" name="valor" type="number" min="0" step="0.01"></label>
      <label class="lbl" style="grid-column:1/-1">Campanha de tráfego <small class="mut">(a mensagem do site termina com “ref: …”)</small><select class="inp" name="campanha"><option value="">Nenhuma (orgânico, indicação, loja)</option>${campanhas.map((c) => h`<option value="${c.id}">${c.nome}${c.codigo !== c.nome ? ` (ref: ${c.codigo})` : ''}</option>`)}</select></label>
      ${ctx.pode.admin ? h`<label class="lbl">Responsável<select class="inp" name="responsavel">${vendedores.map((v) => h`<option value="${v.id}" ${v.id === ctx.perfil.id ? raw('selected') : ''}>${v.nome}</option>`)}</select></label>` : ''}
      <label class="lbl" style="grid-column:1/-1">Anotação<textarea class="inp" name="mensagem" maxlength="2000"></textarea></label>
    </div>`,
    async aoConfirmar(f) {
      const nome = String(f.get('nome') || '').trim(), whatsapp = String(f.get('whatsapp') || '').trim();
      if (!nome || whatsapp.replace(/\D/g, '').length < 10) throw new Error('Informe o nome e um WhatsApp com DDD.');
      const existentes = await painel.clientes.buscar(whatsapp);
      const dig = whatsapp.replace(/\D/g, '');
      const cliente = existentes.find((c) => String(c.whatsapp || '').replace(/\D/g, '').endsWith(dig.slice(-10))) || { nome, whatsapp };
      await painel.leads.criar({
        cliente, origem: f.get('origem'), tamanho: f.get('tamanho') || null, mensagem: f.get('mensagem') || null,
        interesses: String(f.get('interesses') || '').split(',').map((s) => s.trim()).filter(Boolean),
        valorEstimado: f.get('valor') ? Number(f.get('valor')) : null, responsavelId: f.get('responsavel') || null,
        campanhaId: f.get('campanha') || null
      });
      toast(cliente.id ? `Lead criado para ${cliente.nome} (cliente já cadastrado).` : 'Lead cadastrado.', 'ok');
    }
  }) && aoSalvar();
}

// ---------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------
async function listaClientes(el, ctx, abas) {
  ctx.trilha({ nome: 'CRM e leads', href: '#/crm' }, 'Clientes');
  el.innerHTML = String(h`
    <div class="cabeca"><div><h1>Clientes</h1><p>Todos os clientes cadastrados, do site, do WhatsApp e da loja.</p></div></div>
    <div class="hd">${abas}<label class="busca"><span class="sr">Buscar</span>${icp.busca()}<input class="inp" type="search" data-busca placeholder="Buscar pelo nome" style="width:260px"></label></div>
    <div class="card" data-lista>${carregando()}</div>`);
  const lista = $('[data-lista]', el);
  async function carregar(busca = '') {
    try {
      const cs = await painel.clientes.listar({ busca, limite: 200 });
      lista.innerHTML = String(cs.length ? h`<div class="tabela"><table class="tbl"><thead><tr><th>Cliente</th><th>WhatsApp</th><th>Bairro</th><th>Origem</th><th>Cadastro</th></tr></thead><tbody>
        ${cs.map((c) => h`<tr style="cursor:pointer" data-cliente="${c.id}"><td class="clr">${c.nome}</td><td>${c.whatsapp || '—'}</td><td>${[c.bairro, c.cidade].filter(Boolean).join(' · ') || '—'}</td><td>${c.origem ? tagOrigem(c.origem) : '—'}</td><td>${fmt.data(c.criado_em)}</td></tr>`)}
      </tbody></table></div>${cs.length === 200 ? h`<p class="mut" style="font-size:12px">Mostrando os 200 mais recentes. Use a busca para achar outros.</p>` : ''}` : vazio('Nenhum cliente encontrado.'));
    } catch (err) { lista.innerHTML = String(erroBloco(err)); }
  }
  el.addEventListener('click', (e) => { const r = e.target.closest('[data-cliente]'); if (r) ctx.ir('#/crm/cliente/' + r.dataset.cliente); });
  $('[data-busca]', el).addEventListener('input', debounce((e) => carregar(e.target.value), 350));
  await carregar();
}

async function fichaCliente(el, ctx, id, abas) {
  el.innerHTML = String(carregando());
  async function render() {
    let c;
    try { c = await painel.clientes.ficha(id); } catch (err) { el.innerHTML = String(erroBloco(err)); return; }
    if (!c) { el.innerHTML = String(vazio('Cliente não encontrado.')); return; }
    ctx.trilha({ nome: 'Clientes', href: '#/crm/clientes' }, c.nome);
    const zap = zapCliente(c.whatsapp);
    const compras = c.compras.filter((v) => v.status !== 'cancelada');
    el.innerHTML = String(h`
      <div class="hd">${abas}</div>
      <div class="cabeca"><div><h1>${c.nome}</h1><p>${[c.whatsapp, c.email, c.cpf ? 'CPF ' + c.cpf : null, [c.logradouro, c.numero].filter(Boolean).join(', '), c.bairro, c.cidade].filter(Boolean).join(' · ') || 'Sem contato cadastrado'}</p></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">${zap ? h`<a class="btn" href="${zap}" target="_blank" rel="noopener">${icp.zap()} WhatsApp</a>` : ''}
        ${ctx.pode.vender ? h`<button class="btn" data-acao="editar">${icp.editar()} Editar</button><button class="btn btn-g" data-acao="venda">Nova venda</button>` : ''}</div></div>
      <div class="gk">
        <div class="card kpi"><span class="rot">Total comprado</span><span class="num">${fmt.reais(c.total_gasto)}</span></div>
        <div class="card kpi"><span class="rot">Compras</span><span class="num">${compras.length}</span></div>
        <div class="card kpi"><span class="rot">Ticket médio</span><span class="num">${fmt.reais(compras.length ? c.total_gasto / compras.length : 0)}</span></div>
        <div class="card kpi"><span class="rot">Cliente desde</span><span class="num" style="font-size:26px">${fmt.data(c.criado_em)}</span></div>
      </div>
      <div class="row">
        <div class="pilha" style="flex:2 1 480px">
          <div class="card"><span class="rot">Compras</span>
            ${c.compras.length ? h`<div class="tabela"><table class="tbl" style="margin-top:10px"><thead><tr><th>Venda</th><th>Itens</th><th class="r">Total</th><th>Status</th></tr></thead><tbody>
              ${c.compras.map((v) => h`<tr data-venda="${v.id}" style="cursor:pointer"><td><span class="clr">#${v.numero}</span><span class="sub">${fmt.data(v.data_venda)}</span></td><td style="white-space:normal">${v.itens || '—'}</td><td class="r">${fmt.reais(v.total)}</td><td>${pill(v.status)}</td></tr>`)}</tbody></table></div>` : vazio('Ainda não comprou.')}
          </div>
          <div class="card"><span class="rot">Atendimentos (leads)</span>
            ${c.leads.length ? h`<ul class="lst">${c.leads.map((l) => h`<li>${tagOrigem(l.origem)}<span style="flex:1"><span class="clr">${ROT.etapas[l.etapa]}</span><span class="sub">${fmt.data(l.criado_em)}${l.responsavel ? ' · ' + l.responsavel : ''}${l.motivo_perda ? ' · ' + l.motivo_perda : ''}</span></span></li>`)}</ul>` : vazio('Nenhum lead.')}
          </div>
        </div>
        <div class="card" style="flex:1 1 300px"><div class="hd"><span class="rot">Linha do tempo</span>${ctx.pode.vender ? h`<button class="lnk" data-acao="nota">${icp.mais(14)} Anotar</button>` : ''}</div>
          ${c.observacoes ? h`<p class="clr" style="font-size:13px;white-space:pre-wrap">${c.observacoes}</p>` : ''}
          ${c.eventos.length ? h`<ol class="linha-tempo">${c.eventos.map((ev) => h`<li><span class="clr">${ev.descricao}</span><span class="sub">${fmt.dataHora(ev.quando)}${ev.usuario ? ' · ' + ev.usuario : ''}</span></li>`)}</ol>` : h`<p class="mut" style="font-size:13px">Sem registros.</p>`}
        </div>
      </div>`);

    el.onclick = async (e) => {
      const a = e.target.closest('[data-acao]')?.dataset.acao;
      const venda = e.target.closest('[data-venda]');
      if (venda) { const { detalheVenda } = await import('./vendas.js'); return detalheVenda(ctx, venda.dataset.venda, render); }
      if (a === 'venda') { const { novaVenda } = await import('./vendas.js'); return novaVenda(ctx, render, { cliente: { id: c.id, nome: c.nome, whatsapp: c.whatsapp, bairro: c.bairro } }); }
      if (a === 'nota') {
        const texto = await pedirTexto('Nova anotação', 'Anotação sobre o cliente', { obrigatorio: true });
        if (texto) { try { await painel.leads.anotar({ clienteId: c.id, texto }); render(); } catch (err) { toast(err.message, 'erro'); } }
      }
      if (a === 'editar') {
        const campos = [['nome', 'Nome'], ['whatsapp', 'WhatsApp'], ['email', 'E-mail'], ['cpf', 'CPF'], ['cep', 'CEP'], ['logradouro', 'Rua'], ['numero', 'Número'], ['complemento', 'Complemento'], ['bairro', 'Bairro'], ['cidade', 'Cidade']];
        const ok = await modal({
          titulo: 'Editar cliente',
          corpo: h`<div class="g2">${campos.map(([k, t]) => h`<label class="lbl">${t}<input class="inp" name="${k}" value="${c[k] || ''}"></label>`)}
            <label class="lbl" style="grid-column:1/-1">Observações<textarea class="inp" name="observacoes">${c.observacoes || ''}</textarea></label></div>`,
          async aoConfirmar(f) {
            const dados = { id: c.id };
            [...campos.map(([k]) => k), 'observacoes'].forEach((k) => { dados[k] = String(f.get(k) || '').trim() || null; });
            if (!dados.nome) throw new Error('O nome é obrigatório.');
            await painel.clientes.salvar(dados);
          }
        });
        if (ok) { toast('Cliente atualizado.', 'ok'); render(); }
      }
    };
  }
  await render();
}
