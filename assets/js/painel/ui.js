// =====================================================================
// Painel · peças de interface reaproveitadas pelas seções
// =====================================================================
import { h, raw, $, esc } from '../html.js';
import { fmt, hojeSP } from '../api.js';

// ---------------- ícones do menu e das ações ----------------
const svg = (d, w = 20) => raw(`<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`);
export const icp = {
  inicio: (w) => svg('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>', w),
  vendas: (w) => svg('<path d="M5 7h14l-1.2 12.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9z"/><path d="M9 7a3 3 0 0 1 6 0"/>', w),
  crm: (w) => svg('<path d="M3 5h18l-7 8.5V20l-4-2v-4.5z"/>', w),
  entregas: (w) => svg('<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>', w),
  estoque: (w) => svg('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>', w),
  metas: (w) => svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3"/>', w),
  produtos: (w) => svg('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>', w),
  site: (w) => svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>', w),
  trafego: (w) => svg('<path d="M3 10v4h3l6 4V6L6 10z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.8 6a8.5 8.5 0 0 1 0 12"/>', w),
  equipe: (w) => svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .8 3.5 3 3.5 6"/>', w),
  sair: (w = 18) => svg('<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>', w),
  mais: (w = 18) => svg('<path d="M12 5v14M5 12h14"/>', w),
  lixo: (w = 16) => svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', w),
  editar: (w = 16) => svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>', w),
  olho: (w = 16) => svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', w),
  busca: (w = 18) => svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', w),
  fechar: (w = 18) => svg('<path d="M6 6l12 12M18 6L6 18"/>', w),
  cima: (w = 16) => svg('<path d="M12 19V5M6 11l6-6 6 6"/>', w),
  baixo: (w = 16) => svg('<path d="M12 5v14M6 13l6 6 6-6"/>', w),
  esq: (w = 18) => svg('<path d="M15 6l-6 6 6 6"/>', w),
  dir: (w = 18) => svg('<path d="M9 6l6 6-6 6"/>', w),
  upload: (w = 18) => svg('<path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/>', w),
  zap: (w = 16) => svg('<path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3.5 20.5l1.4-4.2a8.5 8.5 0 1 1 15.6-4.7z"/>', w),
  mapa: (w = 16) => svg('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', w),
  check: (w = 16) => svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', w),
  estrela: (w = 16) => svg('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>', w)
};

// ---------------- rótulos ----------------
export const ROT = {
  status: { aguardando_pagamento: 'Aguardando pagamento', a_entregar: 'A entregar', entregue: 'Entregue', cancelada: 'Cancelada' },
  statusClasse: { aguardando_pagamento: 'st-wait', a_entregar: 'st-info', entregue: 'st-ok', cancelada: 'st-mute' },
  etapas: { novo: 'Novo', atendimento: 'Em atendimento', orcamento: 'Orçamento', vendido: 'Vendido', perdido: 'Perdido' },
  etapaCor: { novo: '#B9D0F0', atendimento: '#C9A65A', orcamento: '#E8D6A8', vendido: '#7FD1AE', perdido: '#8D9BAE' },
  origens: { site: 'Site', whatsapp: 'WhatsApp', instagram: 'Instagram', loja: 'Loja', indicacao: 'Indicação', outro: 'Outro' },
  formas: { pix: 'Pix', credito: 'Crédito', debito: 'Débito', dinheiro: 'Dinheiro', boleto: 'Boleto', crediario: 'Crediário', misto: 'Misto' },
  tiposEntrega: { entrega: 'Entrega', entrega_montagem: 'Entrega + montagem', retirada: 'Retirada na loja', coleta: 'Coleta', troca: 'Troca' },
  statusEntrega: { agendada: 'Agendada', em_rota: 'Em rota', concluida: 'Concluída', reagendar: 'Reagendar', cancelada: 'Cancelada' },
  statusEntregaClasse: { agendada: 'st-info', em_rota: 'st-wait', concluida: 'st-ok', reagendar: 'st-warn', cancelada: 'st-mute' },
  pedidos: { pedido: 'Pedido feito', faturado: 'Faturado', em_transito: 'Em trânsito', recebido: 'Recebido', cancelado: 'Cancelado' },
  papeis: { admin: 'Administrador', gerente: 'Gerente', vendedor: 'Vendedor', entregador: 'Entregador', leitura: 'Só leitura' },
  movimentos: { entrada: 'Entrada', saida: 'Saída', reserva: 'Reserva', liberacao: 'Liberação', ajuste: 'Ajuste' },
  selos: { mais_escolhido: 'Mais escolhido', novidade: 'Novidade', oferta: 'Oferta' },
  motivos: { preco: 'Preço / valor', prazo: 'Prazo de entrega', sem_resposta: 'Não respondeu', concorrente: 'Comprou em outro lugar', desconhecido: 'Desconhecido' },
  plataformas: { meta: 'Meta (Face/Insta)', google: 'Google Ads', outra: 'Outra' }
};
export const tagPlataforma = (p) => h`<span class="tag ${p === 'google' ? 'o-site' : p === 'meta' ? 'o-instagram' : 'o-outro'}">${{ meta: 'Meta', google: 'Google', outra: 'Outra' }[p] || p}</span>`;

export const pill = (status, mapa = 'status') => {
  const cls = (mapa === 'status' ? ROT.statusClasse : ROT.statusEntregaClasse)[status] || 'st-mute';
  const txt = (mapa === 'status' ? ROT.status : ROT.statusEntrega)[status] || status;
  return h`<span class="pill ${cls}">${txt}</span>`;
};
export const tagOrigem = (o) => h`<span class="tag o-${o || 'outro'}">${ROT.origens[o] || o || '—'}</span>`;
export const iniciais = (nome) => String(nome || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
export const opcoes = (mapa, atual, vazio = null) =>
  h`${vazio != null ? h`<option value="">${vazio}</option>` : ''}${Object.entries(mapa).map(([v, t]) => h`<option value="${v}" ${String(atual ?? '') === v ? raw('selected') : ''}>${t}</option>`)}`;

/** Variação percentual com seta e cor */
export function delta(atual, anterior, { inverso = false, sufixo = 'vs. período anterior' } = {}) {
  const v = fmt.variacao(Number(atual) || 0, Number(anterior) || 0);
  if (v == null) return h`<span class="delta mut">sem base de comparação</span>`;
  const bom = inverso ? v <= 0 : v >= 0;
  return h`<span class="delta ${bom ? 'ok-txt' : 'alerta-txt'}">${v >= 0 ? '▲' : '▼'} ${fmt.pct(Math.abs(v))} <span class="mut" style="font-weight:500">${sufixo}</span></span>`;
}

export const carregando = (txt = 'Carregando…') => h`<div class="carregando">${txt}</div>`;
export const vazio = (txt) => h`<div class="vazio">${txt}</div>`;
export const erroBloco = (err) => h`<div class="vazio alerta-txt">${err?.message || 'Não foi possível carregar.'}</div>`;

// ---------------- avisos ----------------
export function toast(msg, tipo = '') {
  let caixa = $('.toasts');
  if (!caixa) { caixa = document.createElement('div'); caixa.className = 'toasts'; caixa.setAttribute('role', 'status'); document.body.append(caixa); }
  const t = document.createElement('div');
  t.className = 'toast ' + tipo;
  t.textContent = msg;
  caixa.append(t);
  setTimeout(() => t.remove(), tipo === 'erro' ? 6000 : 3500);
}

/**
 * Modal com formulário. aoConfirmar(FormData, form) pode lançar erro: a mensagem aparece no próprio modal.
 * Devolve uma Promise com o retorno de aoConfirmar (ou null se fechou).
 */
export function modal({ titulo, corpo = '', confirmar = 'Salvar', perigo = false, aoConfirmar = () => true, aoAbrir = null, largura = null }) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    if (largura) d.style.width = `min(${largura}px, calc(100% - 32px))`;
    d.innerHTML = String(h`<form novalidate>
      <div class="hd"><h2 class="ttl">${titulo}</h2><button type="button" class="btn btn-i" data-fechar aria-label="Fechar">${icp.fechar()}</button></div>
      ${corpo}
      <p class="alerta-txt" data-erro role="alert" hidden style="margin:0;font-size:13px"></p>
      <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
        <button type="button" class="btn" data-fechar>Cancelar</button>
        ${confirmar ? h`<button type="submit" class="btn ${perigo ? 'btn-perigo' : 'btn-g'}">${confirmar}</button>` : ''}
      </div></form>`);
    document.body.append(d);
    const form = $('form', d);
    let resultado = null;
    d.addEventListener('close', () => { d.remove(); resolve(resultado); });
    d.addEventListener('click', (e) => { if (e.target.closest('[data-fechar]')) d.close(); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const erro = $('[data-erro]', form);
      const botao = $('button[type=submit]', form);
      erro.hidden = true; botao.disabled = true;
      try {
        resultado = (await aoConfirmar(new FormData(form), form)) ?? true;
        d.close();
      } catch (err) {
        erro.textContent = err.message || 'Algo deu errado.'; erro.hidden = false; botao.disabled = false;
      }
    });
    d.showModal();
    aoAbrir?.(form);
  });
}

export const confirmar = (texto, { titulo = 'Confirmar', botao = 'Confirmar', perigo = true } = {}) =>
  modal({ titulo, corpo: h`<p style="margin:0">${texto}</p>`, confirmar: botao, perigo }).then(Boolean);

export const pedirTexto = (titulo, rotulo, { obrigatorio = false, botao = 'Salvar', valor = '' } = {}) =>
  modal({
    titulo, confirmar: botao,
    corpo: h`<label class="lbl">${rotulo}<textarea class="inp" name="t" maxlength="500">${valor}</textarea></label>`,
    aoConfirmar: (f) => {
      const t = String(f.get('t') || '').trim();
      if (obrigatorio && !t) throw new Error('Preencha o campo.');
      return { texto: t };
    }
  }).then((r) => (r ? r.texto : null));

/** Gaveta lateral. Devolve { el, fechar } */
export function gaveta({ titulo, corpo = '', aoFechar = null }) {
  const veu = document.createElement('div'); veu.className = 'veu';
  const g = document.createElement('aside'); g.className = 'gaveta'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-label', titulo);
  g.innerHTML = String(h`<div class="hd"><h2 class="ttl">${titulo}</h2><button type="button" class="btn btn-i" data-fechar-gaveta aria-label="Fechar">${icp.fechar()}</button></div><div data-corpo class="pilha">${corpo}</div>`);
  const fechar = () => { veu.remove(); g.remove(); document.removeEventListener('keydown', esc); aoFechar?.(); };
  const esc = (e) => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) fechar(); };
  veu.addEventListener('click', fechar);
  g.addEventListener('click', (e) => { if (e.target.closest('[data-fechar-gaveta]')) fechar(); });
  document.addEventListener('keydown', esc);
  document.body.append(veu, g);
  $('button, input, select, textarea', $('[data-corpo]', g))?.focus();
  return { el: g, corpo: $('[data-corpo]', g), fechar };
}

// ---------------- período global (lembrado neste navegador) ----------------
const CHAVE_PERIODO = 'ls_painel_periodo';
export const PERIODOS = { hoje: 'Hoje', '7d': '7 dias', '30d': '30 dias', mes: 'Este mês', mespassado: 'Mês passado' };
export function lerPeriodo() {
  try { const p = JSON.parse(localStorage.getItem(CHAVE_PERIODO)); if (p?.tipo) return p; } catch { /* sem armazenamento */ }
  return { tipo: 'mes' };
}
export function salvarPeriodo(p) { try { localStorage.setItem(CHAVE_PERIODO, JSON.stringify(p)); } catch { /* sem armazenamento */ } }

/** Barra de período: chama aoMudar({tipo, de, ate}) */
export function barraPeriodo(atual) {
  return h`<div class="hd" style="justify-content:flex-start" data-periodo>
    <div class="seg" role="group" aria-label="Período">
      ${Object.entries(PERIODOS).map(([k, t]) => h`<button type="button" class="sb" data-tipo="${k}" aria-pressed="${String(atual.tipo === k)}">${t}</button>`)}
      <button type="button" class="sb" data-tipo="custom" aria-pressed="${String(atual.tipo === 'custom')}">Personalizado</button>
    </div>
    <span data-custom ${atual.tipo === 'custom' ? '' : raw('hidden')} style="display:inline-flex;gap:8px;align-items:center">
      <input class="inp" type="date" name="de" value="${atual.de || somaHoje(-6)}" style="width:auto;height:40px">
      <span class="mut">até</span>
      <input class="inp" type="date" name="ate" value="${atual.ate || hojeSP()}" style="width:auto;height:40px">
      <button type="button" class="btn btn-p" data-aplicar>Aplicar</button>
    </span>
  </div>`;
}
function somaHoje(n) { const d = new Date(hojeSP() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function ligarPeriodo(raiz, aoMudar) {
  const caixa = $('[data-periodo]', raiz);
  if (!caixa) return;
  caixa.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tipo]');
    if (b) {
      caixa.querySelectorAll('[data-tipo]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      const custom = $('[data-custom]', caixa);
      custom.hidden = b.dataset.tipo !== 'custom';
      if (b.dataset.tipo !== 'custom') { const p = { tipo: b.dataset.tipo }; salvarPeriodo(p); aoMudar(p); }
      return;
    }
    if (e.target.closest('[data-aplicar]')) {
      const de = $('[name=de]', caixa).value, ate = $('[name=ate]', caixa).value;
      if (!de || !ate || de > ate) return toast('Confira as datas do período.', 'erro');
      const p = { tipo: 'custom', de, ate }; salvarPeriodo(p); aoMudar(p);
    }
  });
}

/** Datas (de/ate) de um período para filtros de lista */
export function datasDoPeriodo(p) {
  const h0 = hojeSP();
  const mes = h0.slice(0, 8) + '01';
  const mesAnt = (() => { const d = new Date(mes + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 10); })();
  switch (p.tipo) {
    case 'hoje': return { de: h0, ate: h0 };
    case '7d': return { de: somaHoje(-6), ate: h0 };
    case '30d': return { de: somaHoje(-29), ate: h0 };
    case 'mespassado': return { de: mesAnt, ate: (() => { const d = new Date(mes + 'T12:00:00Z'); d.setUTCDate(0); return d.toISOString().slice(0, 10); })() };
    case 'custom': return { de: p.de, ate: p.ate };
    default: return { de: mes, ate: h0 };
  }
}

/** Paginação simples */
export function paginacao(pagina, total, porPagina) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return '';
  return h`<div class="hd" style="justify-content:flex-end;gap:8px">
    <span class="mut" style="font-size:13px">Página ${pagina + 1} de ${paginas} · ${total} registros</span>
    <button class="btn btn-i" data-pagina="${pagina - 1}" ${pagina <= 0 ? raw('disabled') : ''} aria-label="Página anterior">${icp.esq()}</button>
    <button class="btn btn-i" data-pagina="${pagina + 1}" ${pagina + 1 >= paginas ? raw('disabled') : ''} aria-label="Próxima página">${icp.dir()}</button>
  </div>`;
}

/** Converte 'AAAA-MM-DDTHH:MM' (campo datetime-local) para ISO com fuso de São Paulo */
export const localParaIso = (v) => (v ? `${v}:00-03:00` : null);
/** ISO → valor para datetime-local no fuso de São Paulo */
export function isoParaLocal(iso) {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}
export const ymdSP = (iso) => isoParaLocal(iso).slice(0, 10);

/** Link de WhatsApp para falar com o cliente */
export function zapCliente(numero, msg = '') {
  let n = String(numero || '').replace(/\D/g, '');
  if (!n) return null;
  if (n.length <= 11) n = '55' + n;
  return `https://wa.me/${n}${msg ? '?text=' + encodeURIComponent(msg) : ''}`;
}

/** Arrastar e soltar de lista vertical (reordenar). aoSoltar(idsNaOrdem) */
export function reordenavel(lista, seletorItem, aoSoltar) {
  let arrastando = null;
  lista.addEventListener('dragstart', (e) => { arrastando = e.target.closest(seletorItem); e.dataTransfer.effectAllowed = 'move'; });
  lista.addEventListener('dragover', (e) => {
    if (!arrastando) return;
    e.preventDefault();
    const alvo = e.target.closest(seletorItem);
    if (!alvo || alvo === arrastando) return;
    const r = alvo.getBoundingClientRect();
    alvo[e.clientY > r.top + r.height / 2 ? 'after' : 'before'](arrastando);
  });
  lista.addEventListener('drop', (e) => {
    e.preventDefault();
    if (arrastando) aoSoltar([...lista.querySelectorAll(seletorItem)].map((x) => x.dataset.id));
    arrastando = null;
  });
}

export { esc, fmt };
