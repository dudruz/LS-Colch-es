// Metas e comissões: meta da loja e por vendedor, projeção, histórico, regras e pagamento
import { painel, fmt, hojeSP } from '../../api.js';
import { h, $ } from '../../html.js';
import { icp, toast, modal, confirmar, carregando, vazio, erroBloco, iniciais } from '../ui.js';
import { tetoBonito, reaisCurto } from './inicio.js';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeMes = (ymd) => { const [a, m] = ymd.split('-'); return `${MESES[Number(m) - 1]} de ${a}`; };
const somaMes = (ymd, n) => { const d = new Date(ymd.slice(0, 8) + '01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };

function barraMeta(realizado, meta, esperado) {
  const pct = meta ? Math.min(100, (realizado / meta) * 100) : 0;
  return h`<div class="bar" title="Linha branca = onde deveria estar hoje"><i style="width:${pct}%"></i>${meta ? h`<span class="mk" style="left:${Math.min(100, esperado * 100)}%"></span>` : ''}</div>`;
}

export default async function metas(el, ctx) {
  let mes = hojeSP().slice(0, 8) + '01';
  el.innerHTML = String(h`
    <div class="cabeca"><div><h1>Metas e comissões</h1><p>${ctx.pode.admin ? 'Acompanhe o ritmo da loja e de cada vendedor.' : 'Seu ritmo no mês e a comissão prevista.'}</p></div>
      <div style="display:flex;align-items:center;gap:8px"><button class="btn btn-i" data-mes="-1" aria-label="Mês anterior">${icp.esq()}</button><h2 class="ttl" data-titulo style="min-width:200px;text-align:center;text-transform:capitalize"></h2><button class="btn btn-i" data-mes="1" aria-label="Próximo mês">${icp.dir()}</button></div></div>
    <div data-corpo class="pilha" style="gap:22px">${carregando()}</div>`);
  const corpo = $('[data-corpo]', el);
  let dados = null, regras = null;

  async function carregar() {
    $('[data-titulo]', el).textContent = nomeMes(mes);
    corpo.innerHTML = String(carregando());
    try {
      [dados, regras] = await Promise.all([painel.metas(mes), ctx.pode.admin ? painel.metasConfig.regras() : Promise.resolve(null)]);
      render();
    } catch (err) { corpo.innerHTML = String(erroBloco(err)); }
  }

  function render() {
    const d = dados, rg = d.regras || {};
    const l = d.loja;
    const maxHist = tetoBonito(Math.max(1, ...d.historico.map((x) => Math.max(+x.realizado, +(x.meta || 0)))));
    const mesAnt = somaMes(d.mes, -1);
    const pendentes = d.comissoes_mes_anterior.filter((c) => !c.pago && c.comissao > 0);
    corpo.innerHTML = String(h`
      ${l ? h`<div class="card realce">
        <div class="hd"><span class="rot">Meta da loja</span>${ctx.pode.admin ? h`<button class="lnk" data-acao="editar">${icp.editar()} Editar metas do mês</button>` : ''}</div>
        <div class="row" style="margin-top:12px;align-items:center">
          <div class="pilha" style="flex:2 1 380px">
            <div><span class="num" style="font-size:48px">${fmt.reais(l.realizado)}</span><span class="mut"> ${l.meta ? 'de ' + fmt.reais(l.meta) : '· sem meta definida'}</span></div>
            ${barraMeta(l.realizado, l.meta, d.esperado)}
            <span class="mut" style="font-size:13px">Dia ${d.dia_atual} de ${d.dias_no_mes} · ${l.vendas} venda(s)${l.meta ? ` · ${fmt.pct((l.realizado / l.meta) * 100)} atingido` : ''}</span>
          </div>
          <div class="gk" style="flex:1 1 300px;grid-template-columns:repeat(2,1fr)">
            <div><span class="rot">Projeção</span><div class="num ${l.meta && l.projecao < l.meta ? 'alerta-txt' : 'ok-txt'}" style="font-size:28px">${fmt.reais(l.projecao)}</div></div>
            <div><span class="rot">Falta</span><div class="num" style="font-size:28px">${l.meta ? fmt.reais(Math.max(0, l.meta - l.realizado)) : '—'}</div></div>
          </div>
        </div></div>` : ''}

      <div><div class="hd" style="margin-bottom:12px"><span class="rot">${ctx.pode.admin || ctx.papel === 'leitura' ? 'Vendedores' : 'Seu desempenho'}</span><span class="mut" style="font-size:12px">Comissão: ${fmt.pct(rg.percentual_padrao)} + ${fmt.pct(rg.bonus_meta)} ao bater a meta + ${fmt.pct(rg.bonus_campanha)} sobre vendas de campanha</span></div>
        ${d.vendedores.length ? h`<div class="gk" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">${d.vendedores.map((v) => h`
          <div class="card pilha">
            <div class="hd"><span style="display:flex;gap:12px;align-items:center"><span class="avatar">${iniciais(v.nome)}</span><span><span class="clr" style="font-weight:600">${v.nome}</span><span class="sub">${v.vendas} venda(s) · ticket ${fmt.reais(v.ticket)}</span></span></span>
              ${v.meta ? h`<span class="pill ${v.bate_meta ? 'st-ok' : 'st-warn'}">${v.bate_meta ? 'No ritmo' : 'Abaixo do ritmo'}</span>` : h`<span class="pill st-mute">Sem meta</span>`}</div>
            <div><span class="num" style="font-size:30px">${fmt.reais(v.realizado)}</span><span class="mut"> ${v.meta ? 'de ' + fmt.reais(v.meta) : ''}</span></div>
            ${barraMeta(v.realizado, v.meta, d.esperado)}
            <div class="gk" style="grid-template-columns:repeat(3,1fr);gap:10px;font-size:13px">
              <div><span class="rot" style="font-size:10px">Projeção</span><div class="clr tn">${fmt.reais(v.projecao)}</div></div>
              <div><span class="rot" style="font-size:10px">Comissão hoje</span><div class="clr tn">${fmt.reaisCentavos(v.comissao_agora)}</div></div>
              <div><span class="rot" style="font-size:10px">Prevista</span><div class="ok-txt tn" style="font-weight:600">${fmt.reaisCentavos(v.comissao_projetada)}</div></div>
            </div>
          </div>`)}</div>` : vazio('Nenhum vendedor ativo.')}
      </div>

      <div class="row">
        <div class="card" style="flex:2 1 420px"><div class="hd"><span class="rot">Últimos 6 meses</span><div class="legenda"><span><i></i>Realizado</span><span><i class="linha"></i>Meta</span></div></div>
          <div class="grafico"><div class="eixo" aria-hidden="true">${[4, 3, 2, 1, 0].map((i) => h`<span>${reaisCurto((maxHist / 4) * i)}</span>`)}</div>
            <div style="flex:1;min-width:0"><div class="area"><div class="linhas" aria-hidden="true">${[0, 1, 2, 3, 4].map(() => h`<span></span>`)}</div>
              <div class="colunas" style="gap:12px">${d.historico.map((x, i) => h`<div class="col" tabindex="0" aria-label="${nomeMes(x.mes)}: ${fmt.reais(x.realizado)}">
                <i style="height:${(x.realizado / maxHist) * 100}%;max-width:48px;animation-delay:${i * 60}ms;${x.meta && x.realizado >= x.meta ? 'background:var(--ok)' : ''}"></i>
                ${x.meta ? h`<span class="meta-linha" style="bottom:${(x.meta / maxHist) * 100}%"></span>` : ''}
                <span class="tip"><strong style="text-transform:capitalize">${nomeMes(x.mes)}</strong><br>Realizado: ${fmt.reais(x.realizado)}<br>Meta: ${x.meta ? fmt.reais(x.meta) : '—'}</span></div>`)}</div></div>
              <div class="rotulos" style="gap:12px">${d.historico.map((x) => h`<span style="text-transform:capitalize">${MESES[Number(x.mes.slice(5, 7)) - 1].slice(0, 3)}</span>`)}</div></div></div>
        </div>
        ${regras ? h`<form class="card pilha" data-regras style="flex:1 1 300px"><span class="rot">Regras de comissão</span>
          <div class="g2" style="grid-template-columns:1fr 1fr">
            <label class="lbl">Comissão padrão (%)<input class="inp" name="percentual_padrao" type="number" step="0.1" min="0" max="100" value="${regras.percentual_padrao}"></label>
            <label class="lbl">Bônus meta (%)<input class="inp" name="bonus_meta" type="number" step="0.1" min="0" max="100" value="${regras.bonus_meta}"></label>
            <label class="lbl">Bônus campanha (%)<input class="inp" name="bonus_campanha" type="number" step="0.1" min="0" max="100" value="${regras.bonus_campanha}"></label>
            <label class="lbl">Dia do pagamento<input class="inp" name="dia_pagamento" type="number" min="1" max="28" value="${regras.dia_pagamento}"></label>
          </div>
          <p class="mut" style="margin:0;font-size:12px">O % individual de cada vendedor, quando existir, fica em Equipe e acessos e substitui o padrão.</p>
          <button class="btn btn-g" type="submit">Salvar regras</button></form>` : ''}
      </div>

      <div class="card"><div class="hd"><div><span class="rot">Comissões de ${nomeMes(mesAnt)}</span><p class="mut" style="margin:4px 0 0;font-size:13px">Pagamento no dia ${rg.dia_pagamento} de ${nomeMes(d.mes)}.</p></div>
        ${ctx.pode.admin && pendentes.length ? h`<button class="btn btn-g btn-p" data-acao="pagar">${icp.check()} Marcar ${pendentes.length} como paga(s)</button>` : ''}</div>
        ${d.comissoes_mes_anterior.length ? h`<div class="tabela"><table class="tbl" style="margin-top:12px"><thead><tr><th>Vendedor</th><th class="r">Vendido</th><th class="r">Meta</th><th class="r">Taxa</th><th class="r">Comissão</th><th>Situação</th></tr></thead><tbody>
          ${d.comissoes_mes_anterior.map((c) => h`<tr><td>${c.nome}</td><td class="r">${fmt.reais(c.realizado)}</td><td class="r">${c.meta ? fmt.reais(c.meta) : '—'}</td><td class="r">${fmt.pct(c.taxa)}</td><td class="r clr">${fmt.reaisCentavos(c.comissao)}</td><td>${c.pago ? h`<span class="pill st-ok">Paga</span>` : h`<span class="pill st-wait">A pagar</span>`}</td></tr>`)}
          <tr><td class="clr" style="font-weight:600">Total</td><td class="r clr">${fmt.reais(d.comissoes_mes_anterior.reduce((a, c) => a + Number(c.realizado), 0))}</td><td></td><td></td><td class="r clr" style="font-weight:600">${fmt.reaisCentavos(d.comissoes_mes_anterior.reduce((a, c) => a + Number(c.comissao), 0))}</td><td></td></tr>
        </tbody></table></div>` : vazio('Sem comissões no mês anterior.')}
      </div>`);
  }

  async function editarMetas() {
    const equipe = (await ctx.equipe(true)).filter((p) => p.ativo && ['admin', 'gerente', 'vendedor'].includes(p.papel));
    const atual = Object.fromEntries(dados.vendedores.map((v) => [v.id, v.meta]));
    const ok = await modal({
      titulo: `Metas de ${nomeMes(mes)}`, confirmar: 'Salvar metas',
      corpo: h`<label class="lbl">Meta da loja (R$)<input class="inp" name="loja" type="number" min="0" step="100" value="${dados.loja?.meta ?? ''}"></label>
        <div class="g2">${equipe.map((p) => h`<label class="lbl">${p.nome} (R$)<input class="inp" name="v_${p.id}" type="number" min="0" step="100" value="${atual[p.id] ?? ''}" placeholder="Sem meta"></label>`)}</div>
        <p class="mut" style="margin:0;font-size:12px">Deixe vazio para não definir. A soma das metas individuais não precisa ser igual à da loja.</p>`,
      async aoConfirmar(f) {
        const tarefas = [];
        if (Number(f.get('loja')) > 0) tarefas.push(painel.metasConfig.salvarMeta({ mes, valor: Number(f.get('loja')) }));
        equipe.forEach((p) => { const v = Number(f.get('v_' + p.id)); if (v > 0) tarefas.push(painel.metasConfig.salvarMeta({ mes, vendedorId: p.id, valor: v })); });
        await Promise.all(tarefas);
        toast('Metas salvas.', 'ok');
      }
    });
    if (ok) carregar();
  }

  el.addEventListener('click', async (e) => {
    const m = e.target.closest('[data-mes]');
    if (m) { mes = somaMes(mes, Number(m.dataset.mes)); return carregar(); }
    const a = e.target.closest('[data-acao]')?.dataset.acao;
    if (a === 'editar') return editarMetas();
    if (a === 'pagar') {
      const pend = dados.comissoes_mes_anterior.filter((c) => !c.pago && c.comissao > 0);
      if (!(await confirmar(`Registrar o pagamento de ${fmt.reaisCentavos(pend.reduce((s, c) => s + Number(c.comissao), 0))} em comissões?`, { titulo: 'Pagar comissões', botao: 'Confirmar pagamento', perigo: false }))) return;
      try { await painel.metasConfig.marcarPagas(somaMes(mes, -1), pend); toast('Comissões marcadas como pagas.', 'ok'); carregar(); } catch (err) { toast(err.message, 'erro'); }
    }
  });
  el.addEventListener('submit', async (e) => {
    if (!e.target.matches('[data-regras]')) return;
    e.preventDefault();
    const f = new FormData(e.target);
    const r = {};
    ['percentual_padrao', 'bonus_meta', 'bonus_campanha', 'dia_pagamento'].forEach((k) => { r[k] = Number(f.get(k)); });
    if (Object.values(r).some((v) => !Number.isFinite(v) || v < 0)) return toast('Confira os valores.', 'erro');
    try { await painel.metasConfig.salvarRegras(r); toast('Regras salvas. As comissões foram recalculadas.', 'ok'); carregar(); } catch (err) { toast(err.message, 'erro'); }
  });

  await carregar();
}


