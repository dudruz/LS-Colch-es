// Tráfego e campanhas: investimento × leads × vendas por campanha, motivos de perda, regiões e leads sem resposta
import { painel, fmt, hojeSP } from '../../api.js';
import { h, raw, $, $$ } from '../../html.js';
import { icp, ROT, tagPlataforma, opcoes, toast, modal, carregando, vazio, erroBloco, barraPeriodo, ligarPeriodo, lerPeriodo, zapCliente } from '../ui.js';

const slug = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

const vezes = (v) => (v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'x');
const tempoMin = (m) => (m == null ? '—' : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`);
const desde = (iso) => tempoMin(Math.round((Date.now() - new Date(iso)) / 6e4));
const COR_MOTIVO = { preco: 'var(--serie1)', prazo: 'var(--serie2)', sem_resposta: 'var(--alerta)', concorrente: '#9C7BD0', desconhecido: 'rgba(255,255,255,.25)' };

function kpi(rot, valor, sub = '') {
  return h`<div class="card kpi"><span class="rot">${rot}</span><span class="num">${valor}</span>${sub ? h`<span class="delta mut" style="font-weight:500">${sub}</span>` : h`<span class="delta">&nbsp;</span>`}</div>`;
}

export default async function trafego(el, ctx) {
  let per = lerPeriodo();
  el.innerHTML = String(h`
    <div class="cabeca"><div><h1>Tráfego e campanhas</h1><p>Quanto cada campanha traz de leads e vendas, quanto custa e por que os leads não compram.</p></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" data-acao="link">Link para anúncio</button>${ctx.pode.admin ? h`<button class="btn btn-g" data-acao="nova">${icp.mais()} Nova campanha</button>` : ''}</div></div>
    ${barraPeriodo(per)}
    <div data-corpo class="pilha" style="gap:22px">${carregando()}</div>`);
  const corpo = $('[data-corpo]', el);
  let d = null;

  async function carregar() {
    corpo.innerHTML = String(carregando());
    try { d = await painel.trafego(per.tipo, per.de, per.ate); render(); } catch (err) { corpo.innerHTML = String(erroBloco(err)); }
  }

  function render() {
    const k = d.kpis, sc = d.sem_campanha;
    const totalPerdidos = d.motivos.reduce((a, m) => a + m.quantidade, 0);
    const maxReg = Math.max(1, ...d.regioes.map((r) => Number(r.receita)));
    const maxLeadsReg = Math.max(1, ...d.regioes.map((r) => r.leads));
    corpo.innerHTML = String(h`
      <div class="gk">
        ${kpi('Investimento', fmt.reais(k.investimento), 'proporcional aos dias do período')}
        ${kpi('Leads de campanha', k.leads, `de ${k.leads_total} leads no total`)}
        ${kpi('Custo por lead', k.custo_lead == null ? '—' : fmt.reais(k.custo_lead))}
        ${kpi('Vendas de campanha', k.vendas, `conversão dos leads: ${fmt.pct(k.conversao)}`)}
        ${kpi('Custo por venda', k.custo_venda == null ? '—' : fmt.reais(k.custo_venda))}
        ${kpi('Receita de campanha', fmt.reais(k.receita))}
        ${kpi('Retorno', vezes(k.retorno), 'receita ÷ investimento')}
        ${kpi('1º contato (mediana)', tempoMin(k.resposta_mediana_min), k.resposta_ate_1h_pct == null ? '' : `${k.resposta_ate_1h_pct}% em até 1 hora`)}
      </div>

      <div class="card">
        <div class="hd"><div><span class="rot">Campanhas</span><p class="mut" style="margin:4px 0 0;font-size:13px">Cliques no WhatsApp do site, leads e vendas de cada campanha no período.${ctx.pode.admin ? ' Clique numa linha para editar e lançar o investimento.' : ''}</p></div>
          <span class="mut" style="font-size:12px">${k.cliques} clique(s) no WhatsApp vindos de anúncio</span></div>
        ${d.campanhas.length ? h`<div class="tabela"><table class="tbl" style="margin-top:12px"><thead><tr>
            <th>Campanha</th><th class="r">Investido</th><th class="r">Cliques WhatsApp</th><th class="r">Leads</th><th class="r">Custo/lead</th>
            <th class="r">Vendas</th><th class="r">Conversão</th><th class="r">Receita</th><th class="r">Retorno</th><th>Mais perde por</th></tr></thead><tbody>
          ${d.campanhas.map((c) => h`<tr ${ctx.pode.admin ? raw(`data-campanha="${c.id}" style="cursor:pointer"`) : ''}>
            <td><span style="display:flex;gap:8px;align-items:center"><span class="clr" style="font-weight:600">${c.nome}</span>${tagPlataforma(c.plataforma)}${c.ativa ? '' : h`<span class="pill st-mute">pausada</span>`}</span><span class="sub">ref: ${c.codigo}</span></td>
            <td class="r">${c.investido ? fmt.reais(c.investido) : h`<span class="mut">lançar</span>`}</td>
            <td class="r">${c.cliques}</td>
            <td class="r">${c.leads}${c.abertos ? h`<span class="sub">${c.abertos} em aberto</span>` : ''}</td>
            <td class="r">${c.custo_lead == null ? '—' : fmt.reais(c.custo_lead)}</td>
            <td class="r">${c.vendas}</td>
            <td class="r">${c.leads ? fmt.pct(c.conversao) : '—'}</td>
            <td class="r clr">${fmt.reais(c.receita)}</td>
            <td class="r ${c.retorno == null ? '' : c.retorno >= 3 ? 'ok-txt' : c.retorno < 1 ? 'alerta-txt' : 'clr'}" style="font-weight:600">${vezes(c.retorno)}</td>
            <td>${c.motivo_principal ? ROT.motivos[c.motivo_principal] : h`<span class="mut">—</span>`}${c.perdidos ? h`<span class="sub">${c.perdidos} perdido(s)</span>` : ''}</td>
          </tr>`)}
          <tr><td><span class="mut">Sem campanha</span><span class="sub">orgânico, indicação, loja</span></td><td class="r mut">—</td><td class="r mut">${sc.cliques}</td><td class="r mut">${sc.leads}</td><td class="r mut">—</td>
            <td class="r mut">${sc.vendas}</td><td class="r mut">${sc.leads ? fmt.pct((sc.convertidos / sc.leads) * 100) : '—'}</td><td class="r mut">${fmt.reais(sc.receita)}</td><td class="r mut">—</td><td></td></tr>
        </tbody></table></div>
        <p class="mut" style="margin:12px 0 0;font-size:12px">Retorno em verde = cada R$ 1 investido voltou R$ 3 ou mais em vendas. Vermelho = vendeu menos do que gastou.</p>` : vazio('Nenhuma campanha ainda. Use “Link para anúncio” para gerar o link certo; a campanha aparece aqui sozinha no primeiro lead ou clique.')}
      </div>

      <div class="row">
        <div class="card"><div class="hd"><span class="rot">Por que não compraram</span><span class="mut" style="font-size:12px">${totalPerdidos} lead(s) perdido(s) no período</span></div>
          ${totalPerdidos ? h`<div class="pilha" style="margin-top:14px">${d.motivos.map((m) => h`<div>
              <div class="hd" style="font-size:13px;margin-bottom:6px"><span class="clr">${ROT.motivos[m.motivo] || m.motivo}</span><span class="tn">${m.quantidade} <span class="mut">· ${fmt.pct((m.quantidade / totalPerdidos) * 100)}</span></span></div>
              <div class="bar"><i style="width:${(m.quantidade / totalPerdidos) * 100}%;background:${COR_MOTIVO[m.motivo] || 'var(--serie1)'}"></i></div></div>`)}</div>
            ${d.motivos.find((m) => m.motivo === 'desconhecido') ? h`<p class="mut" style="margin:14px 0 0;font-size:12px">“Desconhecido” inclui leads perdidos antes desta versão do painel.</p>` : ''}` : vazio('Nenhum lead perdido no período.')}
        </div>
        <div class="card"><div class="hd"><span class="rot">De onde vêm (bairro)</span><span class="mut" style="font-size:12px">leads e vendas do período</span></div>
          ${d.regioes.length ? h`<div class="tabela"><table class="tbl" style="margin-top:12px"><thead><tr><th>Bairro</th><th class="r">Leads</th><th class="r">Vendas</th><th class="r">Receita</th></tr></thead><tbody>
            ${d.regioes.map((r) => h`<tr><td style="white-space:normal">${r.regiao}<div class="bar" style="height:4px;margin-top:6px"><i class="az" style="width:${(r.leads / maxLeadsReg) * 100}%"></i></div></td><td class="r">${r.leads}</td><td class="r">${r.vendas}</td>
              <td class="r clr">${fmt.reais(r.receita)}<div class="bar" style="height:4px;margin-top:6px"><i style="width:${(Number(r.receita) / maxReg) * 100}%"></i></div></td></tr>`)}
          </tbody></table></div>
          <p class="mut" style="margin:12px 0 0;font-size:12px">O bairro vem do formulário de contato e do endereço de entrega. Lead sem bairro aparece como “Não informado”.</p>` : vazio('Sem dados no período.')}
        </div>
      </div>

      <div class="row">
        <div class="card"><div class="hd"><span class="rot">Aguardando 1º contato</span><span class="mut" style="font-size:12px">${d.aguardando.length} lead(s) em “Novo”</span></div>
          ${d.aguardando.length ? h`<ul class="lst">${d.aguardando.map((l) => listaLead(l, h`<span class="${(Date.now() - new Date(l.criado_em)) / 36e5 >= 1 ? 'alerta-txt' : 'mut'}">há ${desde(l.criado_em)}</span>`))}</ul>` : vazio('Ninguém esperando. Todos os leads novos já foram atendidos.')}
        </div>
        <div class="card"><div class="hd"><span class="rot">Cliente não responde</span><span class="mut" style="font-size:12px">tentativas registradas no CRM</span></div>
          ${d.sem_resposta.length ? h`<ul class="lst">${d.sem_resposta.map((l) => listaLead(l, h`<span class="alerta-txt">${l.tentativas} tentativa(s) · última há ${desde(l.ultima_tentativa_em)}</span>`))}</ul>
            <p class="mut" style="margin:12px 0 0;font-size:12px">Depois de 3 tentativas, o CRM oferece encerrar o lead como “Não respondeu”.</p>` : vazio('Nenhum lead com tentativa sem resposta.')}
        </div>
      </div>`);
  }

  function listaLead(l, status) {
    const zap = zapCliente(l.whatsapp, `Olá, ${(l.cliente || '').split(' ')[0]}! Aqui é da LS Colchões.`);
    return h`<li style="flex-wrap:wrap">
      <span style="flex:1 1 180px;min-width:0"><span class="clr" style="font-weight:600">${l.cliente}</span><span class="sub">${status} · ${l.responsavel || 'sem responsável'}${l.campanha ? ' · ' + l.campanha : ''}</span></span>
      ${zap ? h`<a class="btn btn-i" href="${zap}" target="_blank" rel="noopener" aria-label="WhatsApp de ${l.cliente}" title="WhatsApp">${icp.zap()}</a>` : ''}
      <a class="btn btn-p" href="#/crm/lead/${l.id}">Abrir</a></li>`;
  }

  el.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-acao]')?.dataset.acao;
    if (a === 'link') return linkAnuncio(ctx);
    if (a === 'nova') { if (await editarCampanha(ctx, null)) carregar(); return; }
    const linha = e.target.closest('[data-campanha]');
    if (linha && ctx.pode.admin) { if (await editarCampanha(ctx, linha.dataset.campanha)) carregar(); }
  });
  ligarPeriodo(el, (p) => { per = p; carregar(); });
  await carregar();
}

// ---------------------------------------------------------------------
// Cadastro da campanha + investimento por mês
// ---------------------------------------------------------------------
async function editarCampanha(ctx, id) {
  const todas = await painel.campanhas.listar();
  const c = todas.find((x) => x.id === id) || { nome: '', codigo: '', plataforma: 'meta', ativa: true, campanha_investimentos: [] };
  const mesAtual = hojeSP().slice(0, 8) + '01';
  const invs = [...(c.campanha_investimentos || [])].sort((a, b) => b.mes.localeCompare(a.mes));
  if (!invs.some((i) => i.mes === mesAtual)) invs.unshift({ mes: mesAtual, valor: '' });
  const linhaInv = (i) => h`<div class="g2" data-inv style="grid-template-columns:1fr 150px 40px;align-items:end">
      <label class="lbl">Mês<input class="inp" type="month" data-mes value="${i.mes.slice(0, 7)}"></label>
      <label class="lbl">Investido (R$)<input class="inp" type="number" min="0" step="0.01" data-valor value="${i.valor ?? ''}"></label>
      <button type="button" class="btn btn-i" data-rem-inv aria-label="Remover mês">${icp.lixo()}</button></div>`;

  const r = await modal({
    titulo: id ? 'Editar campanha' : 'Nova campanha', confirmar: 'Salvar campanha', largura: 620,
    corpo: h`<div class="g2">
        <label class="lbl" style="grid-column:1/-1">Nome<input class="inp" name="nome" value="${c.nome}" required maxlength="80" placeholder="Ex.: Black Friday colchões"></label>
        <label class="lbl">Código do link (utm_campaign)<input class="inp" name="codigo" value="${c.codigo}" required maxlength="60" placeholder="black-friday" ${id ? raw('data-fixo') : ''}></label>
        <label class="lbl">Plataforma<select class="inp" name="plataforma">${opcoes(ROT.plataformas, c.plataforma)}</select></label>
        <label class="lbl">Início<input class="inp" type="date" name="inicio" value="${c.inicio || ''}"></label>
        <label class="lbl">Fim<input class="inp" type="date" name="fim" value="${c.fim || ''}"></label>
        <label class="lbl" style="grid-column:1/-1">Observação<input class="inp" name="observacao" value="${c.observacao || ''}" maxlength="200" placeholder="Público, oferta, criativo…"></label>
      </div>
      <label class="sw" style="justify-content:flex-start;gap:12px"><input type="checkbox" name="ativa" ${c.ativa ? raw('checked') : ''}> Campanha rodando (aparece para escolher no CRM)</label>
      <div class="pilha" style="gap:10px"><span class="rot">Investimento por mês</span>
        <p class="mut" style="margin:0;font-size:12px">Copie o “Valor usado” do Gerenciador de Anúncios (Meta) ou do Google Ads. No relatório, o valor é dividido pelos dias do período escolhido.</p>
        <div class="pilha" data-invs style="gap:8px">${invs.map(linhaInv)}</div>
        <button type="button" class="lnk" data-add-inv>${icp.mais(14)} Adicionar mês</button></div>
      ${id ? h`<p class="alerta-txt" style="margin:0;font-size:12px">Mudar o código só vale para anúncios novos: o link do anúncio tem que usar o mesmo código.</p>` : ''}`,
    aoAbrir(form) {
      const nome = form.nome, cod = form.codigo;
      if (!id) nome.addEventListener('input', () => { if (!cod.dataset.mexeu) cod.value = slug(nome.value); });
      cod.addEventListener('input', () => { cod.dataset.mexeu = '1'; });
      form.addEventListener('click', (e) => {
        if (e.target.closest('[data-add-inv]')) {
          const usados = $$('[data-mes]', form).map((i) => i.value);
          const d = new Date(mesAtual + 'T12:00:00Z');
          while (usados.includes(d.toISOString().slice(0, 7))) d.setUTCMonth(d.getUTCMonth() - 1);
          $('[data-invs]', form).insertAdjacentHTML('beforeend', String(linhaInv({ mes: d.toISOString().slice(0, 10), valor: '' })));
        }
        if (e.target.closest('[data-rem-inv]')) e.target.closest('[data-inv]').remove();
      });
    },
    async aoConfirmar(f, form) {
      const nome = String(f.get('nome') || '').trim();
      const codigo = slug(f.get('codigo'));
      if (!nome) throw new Error('Informe o nome da campanha.');
      if (!codigo) throw new Error('Informe o código do link.');
      if (todas.some((x) => x.codigo === codigo && x.id !== id)) throw new Error('Já existe uma campanha com esse código.');
      const meses = $$('[data-inv]', form).map((l) => ({ mes: $('[data-mes]', l).value, valor: $('[data-valor]', l).value }))
        .filter((i) => i.mes && i.valor !== '').map((i) => ({ mes: i.mes + '-01', valor: Number(i.valor) }));
      if (meses.some((i) => !(i.valor >= 0))) throw new Error('Confira os valores investidos.');
      if (new Set(meses.map((i) => i.mes)).size !== meses.length) throw new Error('Há meses repetidos no investimento.');
      const salva = await painel.campanhas.salvar({
        ...(id ? { id } : {}), nome, codigo, plataforma: f.get('plataforma'), ativa: !!f.get('ativa'),
        inicio: f.get('inicio') || null, fim: f.get('fim') || null, observacao: String(f.get('observacao') || '').trim() || null
      });
      const antes = c.campanha_investimentos || [];
      await Promise.all([
        ...meses.map((i) => painel.campanhas.salvarInvestimento({ campanha_id: salva.id, mes: i.mes, valor: i.valor })),
        ...antes.filter((a) => !meses.some((m) => m.mes === a.mes)).map((a) => painel.campanhas.removerInvestimento(a.id))
      ]);
      toast('Campanha salva.', 'ok');
      return salva;
    }
  });
  return r;
}

// ---------------------------------------------------------------------
// Gerador do link do anúncio
// ---------------------------------------------------------------------
async function linkAnuncio(ctx) {
  const campanhas = await painel.campanhas.ativas().catch(() => []);
  const site = new URL('../', location.href).href;
  const blocos = (cod, plat) => {
    const meta = `utm_source=meta&utm_medium=paid&utm_campaign=${cod}&utm_content={{ad.name}}`;
    const google = `utm_source=google&utm_medium=cpc&utm_campaign=${cod}&utm_term={keyword}`;
    const item = (rot, texto, ajuda) => h`<div class="pilha" style="gap:6px"><span class="rot">${rot}</span>
      <div style="display:flex;gap:8px"><input class="inp" readonly value="${texto}" style="font-size:12px"><button type="button" class="btn btn-p" data-copiar="${texto}">Copiar</button></div>
      <span class="mut" style="font-size:12px">${ajuda}</span></div>`;
    return h`
      ${plat !== 'google' ? item('Meta · campo “Parâmetros de URL” do anúncio', meta, 'URL do site no anúncio: ' + site + '. O {{ad.name}} a Meta troca sozinha pelo nome do anúncio.') : ''}
      ${plat !== 'meta' ? item('Google Ads · “Sufixo do URL final” da campanha', google, 'Deixe a marcação automática (gclid) ligada. O {keyword} o Google troca pela palavra pesquisada.') : ''}
      ${item('Link completo (para testar ou usar em outro lugar)', `${site}?utm_source=${plat === 'google' ? 'google' : 'meta'}&utm_medium=${plat === 'google' ? 'cpc' : 'paid'}&utm_campaign=${cod}`, 'Abra numa aba anônima e clique no WhatsApp: o clique aparece nesta tela em até 1 minuto.')}`;
  };
  await modal({
    titulo: 'Link para anúncio', confirmar: null, largura: 640,
    corpo: h`<p style="margin:0">Use sempre o mesmo código em todos os anúncios da campanha. Assim cada lead e cada clique no WhatsApp ficam ligados a ela.</p>
      <label class="lbl">Campanha<select class="inp" name="camp"><option value="">Escolha…</option>${campanhas.map((c) => h`<option value="${c.codigo}" data-plat="${c.plataforma}">${c.nome} (ref: ${c.codigo})</option>`)}<option value="__nova">Outro código…</option></select></label>
      <label class="lbl" data-novo hidden>Código novo<input class="inp" name="novo" placeholder="ex.: black-friday" maxlength="60"></label>
      <div class="pilha" data-saida style="gap:16px"></div>`,
    aoAbrir(form) {
      const saida = $('[data-saida]', form);
      const atualizar = () => {
        const v = form.camp.value;
        $('[data-novo]', form).hidden = v !== '__nova';
        const cod = v === '__nova' ? slug(form.novo.value) : v;
        const plat = v === '__nova' ? 'ambas' : form.camp.selectedOptions[0]?.dataset.plat;
        saida.innerHTML = cod ? String(blocos(cod, plat)) : '';
      };
      form.addEventListener('change', atualizar);
      form.novo.addEventListener('input', atualizar);
      form.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-copiar]');
        if (!b) return;
        try { await navigator.clipboard.writeText(b.dataset.copiar); toast('Copiado.', 'ok'); } catch { b.previousElementSibling.select(); toast('Selecione e copie (Ctrl+C).'); }
      });
    }
  });
}


