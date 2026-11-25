// Entregas e agenda: semana, rota do dia (concluir dá baixa no estoque) e agendamento
import { painel, fmt, hojeSP, somaDias } from '../../api.js';
import { h, raw, $, $$, debounce } from '../../html.js';
import { icp, ROT, opcoes, pill, toast, modal, carregando, vazio, erroBloco, localParaIso, isoParaLocal, ymdSP, zapCliente } from '../ui.js';
import { custoFrete, arred990, distanciaKm, ehLagoaSanta } from '../frete.js';

const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const ENDERECO_LOJA = 'Av. Pref. João Daher, 1277, Lagoa Santa, MG';
const diaSemana = (ymd) => new Date(ymd + 'T12:00:00Z').getUTCDay();
const segunda = (ymd) => somaDias(ymd, -((diaSemana(ymd) + 6) % 7));
const rotuloDia = (ymd) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' });
const enderecoCompleto = (e) => [e.endereco, e.bairro, e.cidade || 'Lagoa Santa', 'MG'].filter(Boolean).join(', ');
const mapa = (e) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto(e))}`;

export default async function entregas(el, ctx) {
  const hoje = hojeSP();
  let inicio = segunda(hoje);
  let dia = hoje;
  let lista = [];

  el.innerHTML = String(h`
    <div class="cabeca"><div><h1>Entregas e agenda</h1><p>Marque a entrega como concluída para dar baixa no estoque automaticamente.</p></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" data-acao="frete">${icp.mapa()} Calcular frete</button>${ctx.pode.vender ? h`<button class="btn btn-g" data-acao="agendar">${icp.mais()} Agendar</button>` : ''}</div></div>
    <div class="card pilha">
      <div class="hd">
        <div style="display:flex;align-items:center;gap:8px"><button class="btn btn-i" data-semana="-7" aria-label="Semana anterior">${icp.esq()}</button><button class="btn btn-p" data-semana="0">Hoje</button><button class="btn btn-i" data-semana="7" aria-label="Próxima semana">${icp.dir()}</button><h2 class="ttl" data-titulo style="margin-left:8px"></h2></div>
        <div class="legenda">${Object.entries(ROT.statusEntrega).filter(([k]) => k !== 'cancelada').map(([k, t]) => h`<span>${pill(k, 'entrega')}</span>`)}</div>
      </div>
      <div class="semana" data-semana-grade>${carregando()}</div>
    </div>
    <div class="card pilha" data-rota></div>`);

  const grade = $('[data-semana-grade]', el);
  const rota = $('[data-rota]', el);

  function renderSemana() {
    const fim = somaDias(inicio, 6);
    const d1 = new Date(inicio + 'T12:00:00Z'), d2 = new Date(fim + 'T12:00:00Z');
    $('[data-titulo]', el).textContent = `${d1.getUTCDate()} a ${d2.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' })}`;
    grade.innerHTML = String(h`${[0, 1, 2, 3, 4, 5, 6].map((i) => {
      const ymd = somaDias(inicio, i);
      const doDia = lista.filter((e) => ymdSP(e.agendada_para) === ymd);
      return h`<div class="pilha" style="gap:8px">
        <button type="button" class="dia-cab ${ymd === hoje ? 'hoje' : ''}" data-dia="${ymd}" style="border:0;cursor:pointer;text-align:left;${ymd === dia && ymd !== hoje ? 'outline:2px solid var(--ouro)' : ''}">
          <small>${DIAS[diaSemana(ymd)]}</small><div class="hd"><strong style="font-size:20px">${new Date(ymd + 'T12:00:00Z').getUTCDate()}</strong><span style="font-size:12px">${doDia.length || ''}</span></div></button>
        ${doDia.map((e) => h`<button type="button" class="ev ${e.status === 'concluida' ? 'feita' : ''}" data-entrega="${e.id}">
          <span class="hd"><strong class="clr tn">${fmt.hora(e.agendada_para)}</strong>${pill(e.status, 'entrega')}</span>
          <span class="clr">${e.cliente || '—'}</span>
          <span>${ROT.tiposEntrega[e.tipo]}${e.bairro ? ' · ' + e.bairro : ''}</span>
        </button>`)}
      </div>`;
    })}`);
  }

  function renderRota() {
    const doDia = lista.filter((e) => ymdSP(e.agendada_para) === dia)
      .sort((a, b) => (a.ordem_rota ?? 999) - (b.ordem_rota ?? 999) || new Date(a.agendada_para) - new Date(b.agendada_para));
    const comEndereco = doDia.filter((e) => e.tipo !== 'retirada' && e.status !== 'concluida' && (e.endereco || e.bairro));
    let linkRota = null;
    if (comEndereco.length) {
      const destino = comEndereco[comEndereco.length - 1];
      const paradas = comEndereco.slice(0, -1).slice(0, 9).map(enderecoCompleto).join('|');
      linkRota = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(ENDERECO_LOJA)}&destination=${encodeURIComponent(enderecoCompleto(destino))}${paradas ? '&waypoints=' + encodeURIComponent(paradas) : ''}`;
    }
    const feitas = doDia.filter((e) => e.status === 'concluida').length;
    rota.innerHTML = String(h`
      <div class="hd"><div><span class="rot">Rota do dia</span><h2 class="ttl" style="margin-top:4px;text-transform:capitalize">${rotuloDia(dia)}</h2></div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="mut">${feitas} de ${doDia.length} concluída(s)</span>${linkRota ? h`<a class="btn btn-p" href="${linkRota}" target="_blank" rel="noopener">${icp.mapa()} Abrir rota no Maps</a>` : ''}</div></div>
      ${doDia.length ? h`<ul class="lst" data-lista-rota>${doDia.map((e, i) => {
        const zap = zapCliente(e.whatsapp, `Olá, ${(e.cliente || '').split(' ')[0]}! Aqui é da LS Colchões. Sua ${e.tipo === 'retirada' ? 'retirada' : 'entrega'} está confirmada para ${fmt.hora(e.agendada_para)}.`);
        return h`<li style="align-items:flex-start;flex-wrap:wrap">
          <label class="sw" role="checkbox" aria-checked="${String(e.status === 'concluida')}" tabindex="0" data-concluir="${e.id}" style="flex:none" title="Concluída"><span class="sr">Concluída</span><span class="trk"></span></label>
          <span class="tn clr" style="font-weight:600;width:52px;padding-top:10px">${fmt.hora(e.agendada_para)}</span>
          <span style="flex:1 1 240px;min-width:0;padding-top:8px">
            <span class="clr" style="font-weight:600">${e.cliente || '—'}</span> ${e.venda_numero ? h`<span class="mut">· #${e.venda_numero}</span>` : ''}
            <span class="sub">${ROT.tiposEntrega[e.tipo]}${e.equipe ? ' · ' + e.equipe : ''} · ${e.tipo === 'retirada' ? 'na loja' : enderecoCompleto(e)}</span>
            ${e.itens ? h`<span class="sub">${e.itens}</span>` : ''}${e.observacao ? h`<span class="sub alerta-txt">${e.observacao}</span>` : ''}
          </span>
          <span style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <select class="inp" data-status="${e.id}" style="width:auto;height:36px;font-size:13px" ${e.status === 'concluida' || !ctx.pode.entregar ? raw('disabled') : ''} aria-label="Status">${opcoes({ agendada: 'Agendada', em_rota: 'Em rota', reagendar: 'Reagendar', ...(e.status === 'concluida' ? { concluida: 'Concluída' } : {}) }, e.status)}</select>
            ${zap ? h`<a class="btn btn-i" href="${zap}" target="_blank" rel="noopener" aria-label="WhatsApp do cliente" title="WhatsApp">${icp.zap()}</a>` : ''}
            ${e.tipo !== 'retirada' ? h`<a class="btn btn-i" href="${mapa(e)}" target="_blank" rel="noopener" aria-label="Ver no mapa" title="Mapa">${icp.mapa()}</a>` : ''}
            ${ctx.pode.vender ? h`<button class="btn btn-i" data-subir="${i}" ${i === 0 ? raw('disabled') : ''} aria-label="Subir na rota">${icp.cima()}</button><button class="btn btn-i" data-descer="${i}" ${i === doDia.length - 1 ? raw('disabled') : ''} aria-label="Descer na rota">${icp.baixo()}</button>` : ''}
          </span>
        </li>`;
      })}</ul>` : vazio('Nenhuma entrega ou retirada neste dia.')}`);
    rota._ordem = doDia;
  }

  async function carregar() {
    try {
      const de = inicio < dia ? inicio : dia, ate = somaDias(inicio, 6) > dia ? somaDias(inicio, 6) : dia;
      lista = await painel.entregas.periodo(de, ate);
      renderSemana(); renderRota();
    } catch (err) { grade.innerHTML = String(erroBloco(err)); }
  }

  async function concluir(id, alvo) {
    const e = lista.find((x) => x.id === id);
    if (!e || !ctx.pode.entregar) return;
    const feita = e.status !== 'concluida';
    alvo.setAttribute('aria-checked', String(feita));
    try {
      await painel.entregas.concluir(id, feita);
      toast(feita ? 'Entrega concluída. Estoque baixado.' : 'Entrega reaberta. Estoque devolvido.', 'ok');
      await carregar(); ctx.atualizarContadores();
    } catch (err) { toast(err.message, 'erro'); alvo.setAttribute('aria-checked', String(!feita)); }
  }

  el.addEventListener('click', async (ev) => {
    const t = ev.target;
    const sem = t.closest('[data-semana]');
    if (sem) { const n = Number(sem.dataset.semana); if (n === 0) { inicio = segunda(hoje); dia = hoje; } else { inicio = somaDias(inicio, n); dia = inicio; } grade.innerHTML = String(carregando()); return carregar(); }
    const d = t.closest('[data-dia]');
    if (d) { dia = d.dataset.dia; renderSemana(); renderRota(); rota.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const c = t.closest('[data-concluir]');
    if (c) { ev.preventDefault(); return concluir(c.dataset.concluir, c); }
    const en = t.closest('[data-entrega]');
    if (en) { const e = lista.find((x) => x.id === en.dataset.entrega); if (e && ctx.pode.vender && (await agendarEntrega(ctx, {}, e))) carregar(); return; }
    if (t.closest('[data-acao="frete"]')) return calculadoraFrete(ctx);
    if (t.closest('[data-acao="agendar"]')) { if (await agendarEntrega(ctx, { quando: dia })) carregar(); return; }
    const sub = t.closest('[data-subir]'), des = t.closest('[data-descer]');
    if (sub || des) {
      const ordem = [...rota._ordem];
      const i = Number((sub || des).dataset[sub ? 'subir' : 'descer']);
      const j = sub ? i - 1 : i + 1;
      [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
      try { await painel.entregas.ordenarRota(ordem.map((x) => x.id)); ordem.forEach((x, k) => { lista.find((y) => y.id === x.id).ordem_rota = k + 1; }); renderRota(); } catch (err) { toast(err.message, 'erro'); }
    }
  });
  el.addEventListener('keydown', (ev) => { const c = ev.target.closest('[data-concluir]'); if (c && (ev.key === ' ' || ev.key === 'Enter')) { ev.preventDefault(); concluir(c.dataset.concluir, c); } });
  el.addEventListener('change', async (ev) => {
    const s = ev.target.closest('[data-status]');
    if (!s) return;
    try { await painel.entregas.status(s.dataset.status, s.value); lista.find((x) => x.id === s.dataset.status).status = s.value; renderSemana(); toast('Status atualizado.', 'ok'); } catch (err) { toast(err.message, 'erro'); }
  });

  await carregar();
  const atualizar = debounce(carregar, 800);
  return painel.entregas.aoMudar(atualizar);
}

/**
 * Agendar (pre = { venda_id, cliente_id, tipo, quando }) ou editar (existente).
 * Devolve true se salvou.
 */
export async function agendarEntrega(ctx, pre = {}, existente = null) {
  const e = existente || {};
  let clienteId = e.cliente_id || pre.cliente_id || null;
  const padraoQuando = e.agendada_para ? isoParaLocal(e.agendada_para) : `${pre.quando || hojeSP()}T09:00`;
  const r = await modal({
    titulo: existente ? `${ROT.tiposEntrega[e.tipo]} · ${e.cliente || ''}` : 'Agendar entrega',
    confirmar: existente ? 'Salvar alterações' : 'Agendar',
    corpo: h`<div class="g2">
      ${!clienteId ? h`<div class="lbl" style="grid-column:1/-1">Cliente
        <input class="inp" data-busca-cli placeholder="Digite o nome ou WhatsApp" autocomplete="off">
        <ul class="lst" data-res-cli style="max-height:180px;overflow:auto"></ul></div>` : ''}
      <label class="lbl">Tipo<select class="inp" name="tipo">${opcoes(ROT.tiposEntrega, e.tipo || pre.tipo || 'entrega')}</select></label>
      <label class="lbl">Data e hora<input class="inp" name="quando" type="datetime-local" required value="${padraoQuando}"></label>
      <label class="lbl" style="grid-column:1/-1">Endereço<input class="inp" name="endereco" value="${e.endereco || ''}" placeholder="Vazio = usa o endereço do cadastro"></label>
      <label class="lbl">Bairro<input class="inp" name="bairro" value="${e.bairro || ''}"></label>
      <label class="lbl">Cidade<input class="inp" name="cidade" value="${e.cidade || 'Lagoa Santa'}"></label>
      <label class="lbl">Equipe<input class="inp" name="equipe" value="${e.equipe || ''}" placeholder="Ex.: Equipe 1"></label>
      ${existente ? h`<label class="lbl">Status<select class="inp" name="status">${opcoes(ROT.statusEntrega, e.status)}</select></label>` : ''}
      <label class="lbl" style="grid-column:1/-1">Observação<textarea class="inp" name="observacao" maxlength="500">${e.observacao || ''}</textarea></label>
    </div>${existente?.status === 'concluida' ? h`<p class="mut" style="margin:0;font-size:13px">Para reabrir uma entrega concluída, desmarque-a na rota do dia (o estoque volta).</p>` : ''}`,
    aoAbrir(form) {
      const busca = $('[data-busca-cli]', form);
      if (!busca) return;
      busca.addEventListener('input', debounce(async () => {
        const ul = $('[data-res-cli]', form);
        if (busca.value.trim().length < 2) { ul.innerHTML = ''; return; }
        const cs = await painel.clientes.buscar(busca.value).catch(() => []);
        ul.innerHTML = String(cs.length ? h`${cs.map((c) => h`<li><button type="button" class="lnk" data-cli="${c.id}" data-nome="${c.nome}" data-bairro="${c.bairro || ''}" style="color:var(--txt)">${c.nome} <span class="mut">${c.whatsapp || ''}</span></button></li>`)}` : h`<li class="mut">Nenhum cliente. Cadastre pela venda ou pelo CRM.</li>`);
      }, 300));
      form.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-cli]');
        if (!b) return;
        clienteId = b.dataset.cli; busca.value = b.dataset.nome; $('[data-res-cli]', form).innerHTML = '';
        if (b.dataset.bairro && !form.bairro.value) form.bairro.value = b.dataset.bairro;
      });
    },
    async aoConfirmar(f) {
      if (!clienteId) throw new Error('Escolha o cliente.');
      if (!f.get('quando')) throw new Error('Informe a data e a hora.');
      const dados = {
        ...(existente ? { id: e.id } : { venda_id: pre.venda_id || null }),
        cliente_id: clienteId, tipo: f.get('tipo'), agendada_para: localParaIso(f.get('quando')),
        endereco: f.get('endereco') || null, bairro: f.get('bairro') || null, cidade: f.get('cidade') || null,
        equipe: f.get('equipe') || null, observacao: f.get('observacao') || null
      };
      if (!dados.endereco && dados.tipo !== 'retirada') {
        const c = await painel.clientes.ficha(clienteId).catch(() => null);
        if (c) {
          dados.endereco = [c.logradouro, c.numero, c.complemento].filter(Boolean).join(', ') || null;
          dados.bairro = dados.bairro || c.bairro || null;
          dados.cidade = dados.cidade || c.cidade || null;
        }
      }
      if (existente && f.get('status') && f.get('status') !== 'concluida' && e.status !== 'concluida') dados.status = f.get('status');
      await painel.entregas.salvar(dados);
      toast(existente ? 'Agendamento atualizado.' : 'Agendado.', 'ok');
    }
  });
  if (r) ctx.atualizarContadores?.();
  return Boolean(r);
}

/** Calculadora de frete: km da loja até o cliente, custo ida e volta e o preço com frete grátis (diluído). */
export async function calculadoraFrete(ctx) {
  const brl = (v) => fmt.reaisCentavos(v);
  let valorKm = await painel.frete.valorKm().catch(() => 2);
  let cidade = '';
  await modal({
    titulo: 'Calculadora de frete',
    largura: 560,
    confirmar: ctx.pode.admin ? 'Salvar valor do km' : null,
    corpo: h`<div class="pilha" style="gap:14px">
      <p class="mut" style="margin:0;font-size:13px">O freteiro cobra por km rodado, ida e volta. Dentro de Lagoa Santa a entrega é grátis e não soma nada no preço.</p>
      <label class="lbl">Destino <small class="mut">(endereço, cidade ou CEP)</small><span style="display:flex;gap:8px"><input class="inp" name="destino" placeholder="Ex.: Rua X, 100, Vespasiano ou 33200-000" autocomplete="off"><button type="button" class="btn" data-calc style="flex:none">Calcular km</button></span></label>
      <div class="g2">
        <label class="lbl">Km até o cliente <small class="mut">(só ida)</small><input class="inp" name="km" type="number" min="0" step="0.1"></label>
        <label class="lbl">Valor por km (R$)<input class="inp" name="valor_km" type="number" min="0" step="0.01" value="${valorKm.toFixed(2)}" ${ctx.pode.admin ? '' : raw('readonly')}></label>
        <label class="lbl" style="grid-column:1/-1">Valor dos produtos <small class="mut">(opcional, pra ver o preço com frete grátis)</small><input class="inp" name="pedido" type="number" min="0" step="0.01" placeholder="Ex.: 2379.80"></label>
      </div>
      <div class="card realce pilha" style="padding:16px;gap:6px" data-res><span class="mut">Digite o destino e clique em Calcular km, ou digite os km.</span></div>
    </div>`,
    aoAbrir(form) {
      const res = $('[data-res]', form);
      const render = () => {
        const km = form.km.value === '' ? null : Number(form.km.value) || 0;
        const vk = Number(form.valor_km.value) || valorKm;
        const ref = cidade || form.destino.value;
        if (ehLagoaSanta(ref)) { res.innerHTML = String(h`<strong class="clr">Lagoa Santa: frete grátis</strong><span class="mut" style="font-size:13px">Não soma nada no preço.</span>`); return; }
        if (km == null) { res.innerHTML = String(h`<span class="mut">Digite o destino e clique em Calcular km, ou digite os km.</span>`); return; }
        const frete = custoFrete(km, vk, ref);
        const pedido = Number(form.pedido.value) || 0;
        const comFrete = pedido > 0 ? arred990(pedido + frete) : null;
        res.innerHTML = String(h`<div class="hd"><span class="clr" style="font-weight:600">Frete (ida e volta)</span><span class="num" style="font-size:26px">${brl(frete)}</span></div>
          <span class="mut" style="font-size:13px">${String(km).replace('.', ',')} km de ida x 2 = ${String(Math.round(km * 20) / 10).replace('.', ',')} km rodados x ${brl(vk)}/km</span>
          ${comFrete ? h`<div class="hd" style="margin-top:6px"><span class="clr" style="font-weight:600">Preço com frete grátis</span><span class="num" style="font-size:22px">${brl(comFrete)}</span></div>
          <span class="mut" style="font-size:13px">${brl(pedido)} + frete, arredondado para 9,90. No orçamento, escolha “Frete grátis (calcula e dilui no preço)” que ele divide o frete entre os itens.</span>` : ''}`);
      };
      form.addEventListener('input', (e) => { if (e.target.name === 'destino') cidade = ''; render(); });
      form.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.target.name === 'valor_km') return;
        e.preventDefault();
        if (e.target.name === 'destino') $('[data-calc]', form).click();
      });
      $('[data-calc]', form).addEventListener('click', async (e) => {
        const b = e.currentTarget;
        b.disabled = true; b.textContent = 'Calculando…';
        try {
          const r = await distanciaKm(form.destino.value);
          form.km.value = r.km; cidade = r.cidade; render();
          toast(`${r.km.toLocaleString('pt-BR')} km até ${r.cidade || 'o destino'}. Confira e ajuste se precisar.`, 'ok');
        } catch (err) { toast(err.message, 'erro'); }
        b.disabled = false; b.textContent = 'Calcular km';
      });
    },
    async aoConfirmar(f) {
      const v = Number(f.get('valor_km'));
      if (!(v > 0)) throw new Error('Informe o valor por km.');
      await painel.frete.salvarValorKm(v);
      valorKm = v;
      toast(`Valor do km salvo: ${brl(v)}.`, 'ok');
    }
  });
}
