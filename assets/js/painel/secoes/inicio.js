// Visão geral: KPIs com comparação, gráfico, meta da loja, funil, origens, produtos, equipe e operação do dia
import { painel, fmt } from '../../api.js';
import { h } from '../../html.js';
import { barraPeriodo, ligarPeriodo, lerPeriodo, delta, pill, tagOrigem, vazio, erroBloco, carregando, PERIODOS, ROT } from '../ui.js';

const nomesMes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Teto do eixo com 4 divisões de valor redondo (1; 1,5; 2; 2,5; 3; 4; 5; 7,5 × 10ⁿ) */
export function tetoBonito(v) {
  if (v <= 0) return 1000;
  const bruto = v / 4;
  const p = Math.pow(10, Math.floor(Math.log10(bruto)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) if (bruto <= m * p) return m * p * 4;
  return 40 * p;
}
export const reaisCurto = (v) => (v >= 1000 ? 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : fmt.reais(v));

function rotuloBalde(iso, porHora) {
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  return porHora ? String(d.getUTCHours()).padStart(2, '0') + 'h' : `${d.getUTCDate()} ${nomesMes[d.getUTCMonth()]}`;
}

function grafico(serie, porHora) {
  if (!serie.length) return vazio('Sem dados no período.');
  const max = tetoBonito(Math.max(...serie.map((s) => Math.max(+s.atual, +s.anterior))));
  const estreito = window.innerWidth < 760;
  const passo = Math.ceil(serie.length / (porHora ? (estreito ? 4 : 8) : (estreito ? 4 : 10)));
  return h`
    <div class="grafico">
      <div class="eixo" aria-hidden="true">${[4, 3, 2, 1, 0].map((i) => h`<span>${reaisCurto((max / 4) * i)}</span>`)}</div>
      <div style="flex:1;min-width:0">
        <div class="area">
          <div class="linhas" aria-hidden="true">${[0, 1, 2, 3, 4].map(() => h`<span></span>`)}</div>
          <div class="colunas">
            ${serie.map((s, i) => h`<div class="col" tabindex="0" aria-label="${rotuloBalde(s.inicio, porHora)}: ${fmt.reais(s.atual)}">
              <i style="height:${(+s.atual / max) * 100}%;animation-delay:${i * 15}ms"></i>
              <i class="az" style="height:${(+s.anterior / max) * 100}%;animation-delay:${i * 15}ms"></i>
              <span class="tip"><strong>${rotuloBalde(s.inicio, porHora)}</strong><br>Atual: ${fmt.reais(s.atual)}<br>Anterior: ${fmt.reais(s.anterior)}</span>
            </div>`)}
          </div>
        </div>
        <div class="rotulos" aria-hidden="true">${serie.map((s, i) => h`<span>${i % passo === 0 ? rotuloBalde(s.inicio, porHora) : ''}</span>`)}</div>
      </div>
    </div>`;
}

function kpi(rotulo, valor, atual, anterior, temComparacao) {
  return h`<div class="card kpi"><span class="rot">${rotulo}</span><span class="num">${valor}</span>${temComparacao ? delta(atual, anterior) : h`<span class="delta mut">&nbsp;</span>`}</div>`;
}

function metaLoja(m) {
  if (!m?.loja) return '';
  const l = m.loja;
  if (!l.meta) return h`<div class="card pilha"><span class="rot">Meta da loja · mês</span><p class="mut" style="margin:0">Nenhuma meta definida para este mês.</p><a class="lnk" href="#/metas">Definir meta</a></div>`;
  const pct = Math.min(100, (l.realizado / l.meta) * 100);
  const esperado = Math.min(100, m.esperado * 100);
  const noRitmo = l.projecao >= l.meta;
  return h`<div class="card realce pilha">
    <div class="hd"><span class="rot">Meta da loja · mês</span><a class="lnk" href="#/metas">Detalhes</a></div>
    <div><span class="num" style="font-size:40px">${fmt.reais(l.realizado)}</span><span class="mut"> de ${fmt.reais(l.meta)}</span></div>
    <div class="bar" title="Linha branca = onde deveria estar hoje"><i style="width:${pct}%"></i><span class="mk" style="left:${esperado}%"></span></div>
    <div class="hd" style="font-size:13px"><span>${fmt.pct(pct)} atingido · dia ${m.dia_atual} de ${m.dias_no_mes}</span><span class="${noRitmo ? 'ok-txt' : 'alerta-txt'}" style="font-weight:600">Projeção ${fmt.reais(l.projecao)}</span></div>
    <p class="mut" style="margin:0;font-size:13px">${noRitmo ? 'No ritmo atual, a loja bate a meta.' : `Faltam ${fmt.reais(l.meta - l.realizado)}. Para bater, a média diária precisa ser ${fmt.reais((l.meta - l.realizado) / Math.max(1, m.dias_no_mes - m.dia_atual))}.`}</p>
  </div>`;
}

function funil(f) {
  const etapas = [['Recebidos', f.recebidos], ['Em atendimento', f.atendimento], ['Orçamento', f.orcamento], ['Vendidos', f.vendidos]];
  const base = Math.max(1, f.recebidos);
  return h`<div class="pilha">${etapas.map(([n, v], i) => h`
    <div><div class="hd" style="font-size:13px;margin-bottom:6px"><span class="clr">${n}</span><span class="tn">${v}${i ? h` <span class="mut">· ${fmt.pct((v / base) * 100)}</span>` : ''}</span></div>
    <div class="bar"><i class="${i === 3 ? 'vd' : ''}" style="width:${(v / base) * 100}%"></i></div></div>`)}
    <p class="mut" style="margin:0;font-size:12px">${f.perdidos} perdido(s) no período.</p></div>`;
}

export default async function inicio(el, ctx) {
  let per = lerPeriodo();

  el.innerHTML = String(h`
    <div class="cabeca"><div><h1>Visão geral</h1><p>Olá, ${(ctx.perfil.nome || '').split(' ')[0] || 'equipe'}. Este é o resumo da loja.</p></div></div>
    ${barraPeriodo(per)}
    <div data-corpo>${carregando()}</div>`);
  const corpo = el.querySelector('[data-corpo]');

  async function carregar() {
    corpo.innerHTML = String(carregando());
    try {
      const [d, m] = await Promise.all([painel.dashboard(per.tipo, per.de, per.ate), painel.metas().catch(() => null)]);
      const k = d.kpis;
      const comp = true; // todo período compara com o anterior de mesma duração
      const porHora = d.periodo.por_hora;
      const nomePer = PERIODOS[per.tipo] || 'Período personalizado';
      corpo.innerHTML = String(h`
      <div class="pilha" style="gap:22px">
        <div class="gk">
          ${kpi('Faturamento', fmt.reais(k.faturamento), k.faturamento, k.faturamento_anterior, comp)}
          ${kpi('Vendas', k.vendas, k.vendas, k.vendas_anterior, comp)}
          ${kpi('Ticket médio', fmt.reais(k.ticket), k.ticket, k.ticket_anterior, comp)}
          ${kpi('Leads', k.leads, k.leads, k.leads_anterior, comp)}
          ${kpi('Conversão de leads', fmt.pct(k.conversao), k.conversao, k.conversao_anterior, comp)}
        </div>

        <div class="row">
          <div class="card" style="flex:2 1 520px">
            <div class="hd"><div><span class="rot">Faturamento ${porHora ? 'por hora' : 'por dia'}</span><h2 class="ttl" style="margin-top:4px">${nomePer}</h2></div>
              <div class="legenda"><span><i></i>Período atual</span><span><i class="az"></i>Período anterior</span></div></div>
            ${grafico(d.serie, porHora)}
          </div>
          <div class="pilha" style="flex:1 1 300px">
            ${metaLoja(m)}
            <div class="card pilha"><span class="rot">Funil de leads</span>${funil(d.funil)}</div>
          </div>
        </div>

        <div class="row">
          <div class="card"><div class="hd"><span class="rot">Mais vendidos</span><span class="mut" style="font-size:12px">receita bruta</span></div>
            ${d.mais_vendidos.length ? h`<ul class="lst">${d.mais_vendidos.map((p, i) => h`<li><span class="passo on">${i + 1}</span><span class="clr" style="flex:1">${p.nome}</span><span class="tn mut">${p.quantidade} un.</span><span class="tn clr" style="min-width:90px;text-align:right">${fmt.reais(p.receita)}</span></li>`)}</ul>` : vazio('Nenhuma venda no período.')}
          </div>
          <div class="card"><span class="rot">Tamanhos mais pedidos</span>
            ${d.tamanhos.length ? (() => { const mx = Math.max(...d.tamanhos.map((t) => t.quantidade)); return h`<div class="pilha" style="margin-top:14px">${d.tamanhos.map((t) => h`<div><div class="hd" style="font-size:13px;margin-bottom:6px"><span class="clr">${t.nome}</span><span class="tn">${t.quantidade}</span></div><div class="bar"><i class="az" style="width:${(t.quantidade / mx) * 100}%"></i></div></div>`)}</div>`; })() : vazio('Sem dados.')}
          </div>
          <div class="card"><span class="rot">Origem dos leads</span>
            ${d.origens.length ? h`<div class="tabela"><table class="tbl" style="margin-top:12px"><thead><tr><th>Origem</th><th class="r">Leads</th><th class="r">Conversão</th></tr></thead><tbody>
              ${d.origens.map((o) => h`<tr><td>${tagOrigem(o.origem)}</td><td class="r">${o.leads}</td><td class="r">${fmt.pct(o.conversao)}</td></tr>`)}</tbody></table></div>` : vazio('Nenhum lead no período.')}
          </div>
        </div>

        ${d.vendedores.length ? h`<div class="card"><div class="hd"><span class="rot">Desempenho da equipe</span><a class="lnk" href="#/metas">Metas e comissões</a></div>
          <div class="tabela"><table class="tbl" style="margin-top:12px"><thead><tr><th>Vendedor</th><th class="r">Vendas</th><th class="r">Faturamento</th><th class="r">Ticket médio</th><th class="r">Conversão de leads</th></tr></thead><tbody>
          ${d.vendedores.map((v) => h`<tr><td>${v.nome}</td><td class="r">${v.vendas}</td><td class="r">${fmt.reais(v.faturamento)}</td><td class="r">${fmt.reais(v.ticket)}</td><td class="r">${v.conversao == null ? '—' : fmt.pct(v.conversao)}</td></tr>`)}
          </tbody></table></div></div>` : ''}

        <div class="row">
          <div class="card"><div class="hd"><span class="rot">Entregas de hoje</span><a class="lnk" href="#/entregas">Abrir agenda</a></div>
            ${d.entregas_hoje.length ? h`<ul class="lst">${d.entregas_hoje.map((e) => h`<li><span class="tn clr" style="font-weight:600;width:48px">${fmt.hora(e.agendada_para)}</span><span style="flex:1;min-width:0"><span class="clr">${e.cliente || '—'}</span><span class="sub">${ROT.tiposEntrega[e.tipo]} · ${e.bairro || 'sem bairro'}${e.venda_numero ? ' · #' + e.venda_numero : ''}</span></span>${pill(e.status, 'entrega')}</li>`)}</ul>` : vazio('Nenhuma entrega agendada para hoje.')}
          </div>
          <div class="card"><div class="hd"><span class="rot">Alertas de estoque</span><a class="lnk" href="#/estoque">Ver estoque</a></div>
            ${d.alertas_estoque.length ? h`<ul class="lst">${d.alertas_estoque.map((s) => h`<li><span style="flex:1"><span class="clr">${s.produto}</span><span class="sub">${s.tamanho} · mínimo ${s.minimo}</span></span><span class="cel ${s.nivel === 'zerado' ? 'lv-zerado' : 'lv-baixo'}" style="cursor:default">${s.disponivel}</span></li>`)}</ul>` : vazio('Tudo certo: nenhum item abaixo do mínimo.')}
          </div>
        </div>

        <div class="card"><div class="hd"><span class="rot">Últimas vendas</span><a class="lnk" href="#/vendas">Ver todas</a></div>
          ${d.ultimas_vendas.length ? h`<div class="tabela"><table class="tbl" style="margin-top:12px"><thead><tr><th>Venda</th><th>Cliente</th><th>Itens</th><th>Vendedor</th><th class="r">Total</th><th>Status</th></tr></thead><tbody>
            ${d.ultimas_vendas.map((v) => h`<tr><td><span class="clr">#${v.numero}</span><span class="sub">${fmt.dataHora(v.data_venda)}</span></td><td>${v.cliente}</td><td style="max-width:280px;overflow:hidden;text-overflow:ellipsis">${v.itens || '—'}</td><td>${v.vendedor || '—'}</td><td class="r">${fmt.reais(v.total)}</td><td>${pill(v.status)}</td></tr>`)}
          </tbody></table></div>` : vazio('Nenhuma venda registrada ainda.')}
        </div>
      </div>`);
    } catch (err) {
      corpo.innerHTML = String(erroBloco(err));
    }
  }

  ligarPeriodo(el, (p) => { per = p; carregar(); });
  await carregar();
  const t = setInterval(() => { if (per.tipo === 'hoje' && document.visibilityState === 'visible') carregar(); }, 120000);
  return () => clearInterval(t);
}

