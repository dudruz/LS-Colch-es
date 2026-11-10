// Gestão do site: banners do topo, campanha com contagem, depoimentos e dados da loja
import { painel, urlMidia, fmt } from '../../api.js';
import { h, raw, $ } from '../../html.js';
import { icp, opcoes, toast, modal, confirmar, carregando, vazio, erroBloco, localParaIso, isoParaLocal } from '../ui.js';

const DESTINOS = { whatsapp: 'Abrir WhatsApp', catalogo: 'Ir para o catálogo', oferta: 'Ir para a oferta', como_chegar: 'Como chegar (mapa)', url: 'Outro link' };
const ABAS = [['banners', 'Banners do topo'], ['campanha', 'Campanha'], ['depoimentos', 'Depoimentos'], ['loja', 'Dados da loja']];

export default async function site(el, ctx) {
  const aba = ABAS.some(([k]) => k === ctx.params[0]) ? ctx.params[0] : 'banners';
  const so = !ctx.pode.admin;
  el.innerHTML = String(h`
    <div class="cabeca"><div><h1>Gestão do site</h1><p>As mudanças aparecem no site em até 5 minutos (cache do navegador do visitante).</p></div><a class="btn" href="../index.html" target="_blank" rel="noopener">${icp.olho()} Ver site</a></div>
    <div class="seg" role="tablist">${ABAS.map(([k, t]) => h`<a class="sb" role="tab" href="#/site${k === 'banners' ? '' : '/' + k}" aria-selected="${String(aba === k)}" style="display:inline-flex;align-items:center;text-decoration:none">${t}</a>`)}</div>
    <div data-corpo class="pilha" style="gap:20px">${carregando()}</div>`);
  const corpo = $('[data-corpo]', el);
  let dados;
  try { dados = await painel.site.obter(); } catch (err) { corpo.innerHTML = String(erroBloco(err)); return; }
  const ctxSite = { corpo, ctx, so, dados, recarregar: async () => { dados = await painel.site.obter(); ctxSite.dados = dados; } };
  if (aba === 'campanha') return campanha(ctxSite);
  if (aba === 'depoimentos') return depoimentos(ctxSite);
  if (aba === 'loja') return loja(ctxSite);
  return banners(ctxSite);
}

const sw = (nome, rotulo, ligado, so) => h`<button type="button" class="sw" role="switch" data-sw="${nome}" aria-checked="${String(!!ligado)}" ${so ? raw('disabled') : ''}><span>${rotulo}</span><span class="trk"></span></button>`;
const lerSw = (raiz, nome) => $(`[data-sw="${nome}"]`, raiz)?.getAttribute('aria-checked') === 'true';
function ligarSw(raiz, so) { raiz.addEventListener('click', (e) => { const s = e.target.closest('[data-sw]'); if (s && !so) s.setAttribute('aria-checked', String(s.getAttribute('aria-checked') !== 'true')); }); }

// ---------------------------------------------------------------------
function banners(S) {
  let selecionado = S.dados.banners[0]?.id || null;
  const dis = S.so ? raw('disabled') : '';

  function render() {
    const bs = S.dados.banners;
    const b = bs.find((x) => x.id === selecionado) || null;
    S.corpo.innerHTML = String(h`<div class="row">
      <div class="card pilha" style="flex:1 1 300px"><div class="hd"><span class="rot">Ordem de exibição</span>${S.so ? '' : h`<button class="lnk" data-novo>${icp.mais(14)} Novo banner</button>`}</div>
        ${bs.length ? h`<ul class="lst">${bs.map((x, i) => h`<li style="gap:8px">
          <button type="button" class="lnk" data-sel="${x.id}" style="flex:1;justify-content:flex-start;color:${x.id === selecionado ? 'var(--ouro-claro)' : 'var(--txt)'};text-align:left;min-width:0"><span class="passo ${x.ativo ? 'on' : ''}">${i + 1}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x.titulo_1} ${x.titulo_2 || ''}</span></button>
          ${x.ativo ? '' : h`<span class="pill st-mute">oculto</span>`}
          ${S.so ? '' : h`<button class="btn btn-i" data-subir="${i}" ${i === 0 ? raw('disabled') : ''} aria-label="Subir">${icp.cima()}</button><button class="btn btn-i" data-descer="${i}" ${i === bs.length - 1 ? raw('disabled') : ''} aria-label="Descer">${icp.baixo()}</button>`}
        </li>`)}</ul>` : vazio('Nenhum banner. O site mostra um banner padrão.')}
        <p class="mut" style="margin:0;font-size:12px">Troca a cada ${(S.dados.config.tempo_slide_ms / 1000).toLocaleString('pt-BR')} s · ajuste em “Dados da loja”.</p>
      </div>
      <form class="card pilha" data-form-banner style="flex:2 1 460px" novalidate>
        ${b || selecionado === 'novo' ? h`
          <div class="hd"><span class="rot">${b ? 'Editar banner' : 'Novo banner'}</span>${sw('ativo', 'Ativo', b ? b.ativo : true, S.so)}</div>
          <div class="pilha" style="padding:24px;border-radius:16px;background:linear-gradient(135deg,#062A4F,#0A3359);position:relative;overflow:hidden;min-height:180px;justify-content:flex-end" data-previa>
            ${b?.midia_caminho ? (b.midia_tipo === 'video' ? h`<video src="${urlMidia(b.midia_caminho, 'site')}" muted autoplay loop playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.45"></video>` : h`<img src="${urlMidia(b.midia_caminho, 'site')}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.45">`) : ''}
            <span style="position:relative;font-size:11px;font-weight:600;letter-spacing:.2em;color:var(--ouro-claro)">${b?.eyebrow || 'EYEBROW'}</span>
            <span style="position:relative;font-family:var(--serif);font-size:34px;line-height:1.05;color:#fff">${b?.titulo_1 || 'Título'} <em style="color:var(--ouro-claro)">${b?.titulo_2 || ''}</em></span>
          </div>
          <div class="g2">
            <label class="lbl" style="grid-column:1/-1">Texto pequeno acima do título<input class="inp" name="eyebrow" value="${b?.eyebrow || ''}" maxlength="60" ${dis}></label>
            <label class="lbl">Título<input class="inp" name="titulo_1" value="${b?.titulo_1 || ''}" required maxlength="80" ${dis}></label>
            <label class="lbl">Título em destaque (dourado)<input class="inp" name="titulo_2" value="${b?.titulo_2 || ''}" maxlength="80" ${dis}></label>
            <label class="lbl" style="grid-column:1/-1">Texto<textarea class="inp" name="texto" maxlength="300" ${dis}>${b?.texto || ''}</textarea></label>
            <label class="lbl">Texto do botão<input class="inp" name="botao_texto" value="${b?.botao_texto || ''}" maxlength="40" placeholder="Falar com um consultor" ${dis}></label>
            <label class="lbl">O botão leva para<select class="inp" name="botao_destino" ${dis}>${opcoes(DESTINOS, b?.botao_destino || 'whatsapp')}</select></label>
            <label class="lbl" style="grid-column:1/-1" data-url ${(b?.botao_destino || 'whatsapp') === 'url' ? '' : raw('hidden')}>Link<input class="inp" name="botao_url" value="${b?.botao_url || ''}" placeholder="https://… ou catalogo.html?cat=box-bau" ${dis}></label>
            <label class="lbl">Exibir a partir de <small class="mut">(opcional)</small><input class="inp" name="exibir_de" type="datetime-local" value="${isoParaLocal(b?.exibir_de)}" ${dis}></label>
            <label class="lbl">Exibir até <small class="mut">(opcional)</small><input class="inp" name="exibir_ate" type="datetime-local" value="${isoParaLocal(b?.exibir_ate)}" ${dis}></label>
          </div>
          ${S.so ? '' : h`<div class="hd"><label class="btn btn-p" style="cursor:pointer">${icp.upload(16)} ${b?.midia_caminho ? 'Trocar foto ou vídeo' : 'Enviar foto ou vídeo'}<input type="file" data-midia accept="image/jpeg,image/png,image/webp,video/mp4" hidden></label><span class="mut" style="font-size:12px">Foto 1920 × 1080 (até 10 MB) ou vídeo MP4 curto e sem som (até 50 MB).</span></div>
          <p class="alerta-txt" data-erro role="alert" hidden style="margin:0"></p>
          <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-g" type="submit">Salvar banner</button>${b ? h`<button class="btn btn-perigo" type="button" data-remover>${icp.lixo()} Excluir</button>` : ''}</div>`}` : vazio('Escolha um banner na lista ou crie um novo.')}
      </form></div>`);
  }

  let midiaNova = null;
  S.corpo.addEventListener('click', async (e) => {
    const t = e.target;
    const sel = t.closest('[data-sel]');
    if (sel) { selecionado = sel.dataset.sel; midiaNova = null; return render(); }
    if (t.closest('[data-novo]')) { selecionado = 'novo'; midiaNova = null; return render(); }
    const s = t.closest('[data-sw]');
    if (s && !S.so) { s.setAttribute('aria-checked', String(s.getAttribute('aria-checked') !== 'true')); return; }
    const sub = t.closest('[data-subir]'), des = t.closest('[data-descer]');
    try {
      if (sub || des) {
        const ids = S.dados.banners.map((x) => x.id);
        const i = Number((sub || des).dataset[sub ? 'subir' : 'descer']), j = sub ? i - 1 : i + 1;
        [ids[i], ids[j]] = [ids[j], ids[i]];
        await painel.site.ordenarBanners(ids); await S.recarregar(); render(); return;
      }
      if (t.closest('[data-remover]')) {
        if (!(await confirmar('Excluir este banner do site?', { botao: 'Excluir' }))) return;
        await painel.site.removerBanner(selecionado); await S.recarregar();
        selecionado = S.dados.banners[0]?.id || null; render(); toast('Banner excluído.', 'ok');
      }
    } catch (err) { toast(err.message, 'erro'); }
  });
  S.corpo.addEventListener('change', async (e) => {
    if (e.target.name === 'botao_destino') $('[data-url]', S.corpo).hidden = e.target.value !== 'url';
    if (e.target.matches('[data-midia]')) {
      const arq = e.target.files[0];
      if (!arq) return;
      const limite = arq.type.startsWith('video') ? 50 : 10;
      if (arq.size > limite * 1024 * 1024) return toast(`Arquivo maior que ${limite} MB.`, 'erro');
      try {
        toast('Enviando arquivo…');
        midiaNova = { caminho: await painel.site.enviarMidia(arq, 'banners'), tipo: arq.type.startsWith('video') ? 'video' : 'foto' };
        const previa = $('[data-previa]', S.corpo);
        $('img, video', previa)?.remove();
        previa.insertAdjacentHTML('afterbegin', String(midiaNova.tipo === 'video'
          ? h`<video src="${urlMidia(midiaNova.caminho, 'site')}" muted autoplay loop playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.45"></video>`
          : h`<img src="${urlMidia(midiaNova.caminho, 'site')}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.45">`));
        toast('Arquivo enviado. Salve o banner para publicar.', 'ok');
      } catch (err) { toast(err.message, 'erro'); }
    }
  });
  S.corpo.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const f = new FormData(form);
    const erro = $('[data-erro]', form);
    erro.hidden = true;
    const txt = (k) => String(f.get(k) || '').trim() || null;
    try {
      if (!txt('titulo_1')) throw new Error('O título é obrigatório.');
      if (f.get('botao_destino') === 'url' && !txt('botao_url')) throw new Error('Informe o link do botão.');
      const b = {
        ...(selecionado !== 'novo' ? { id: selecionado } : { ordem: S.dados.banners.length + 1 }),
        ativo: lerSw(form, 'ativo'), eyebrow: txt('eyebrow'), titulo_1: txt('titulo_1'), titulo_2: txt('titulo_2'), texto: txt('texto'),
        botao_texto: txt('botao_texto'), botao_destino: f.get('botao_destino'), botao_url: txt('botao_url'),
        exibir_de: localParaIso(f.get('exibir_de')), exibir_ate: localParaIso(f.get('exibir_ate')),
        ...(midiaNova ? { midia_caminho: midiaNova.caminho, midia_tipo: midiaNova.tipo } : {})
      };
      const salvo = await painel.site.salvarBanner(b);
      await S.recarregar(); selecionado = salvo.id; midiaNova = null; render();
      toast('Banner salvo.', 'ok');
    } catch (err) { erro.textContent = err.message; erro.hidden = false; }
  });
  render();
}

// ---------------------------------------------------------------------
async function campanha(S) {
  const c = S.dados.campanha;
  const dis = S.so ? raw('disabled') : '';
  const produtos = await painel.produtos.listar().catch(() => []);
  const naCampanha = produtos.filter((p) => p.na_campanha);
  const noAr = c.ativa && (!c.termina_em || new Date(c.termina_em) > new Date());
  S.corpo.innerHTML = String(h`<div class="row">
    <form class="card pilha" data-form style="flex:2 1 460px" novalidate>
      <div class="hd"><span class="rot">Campanha do site</span><span class="pill ${noAr ? 'st-ok' : 'st-mute'}">${noAr ? 'No ar' : c.ativa ? 'Encerrada' : 'Desligada'}</span></div>
      ${sw('ativa', 'Campanha ligada', c.ativa, S.so)}
      <div class="g2">
        <label class="lbl">Nome<input class="inp" name="nome" value="${c.nome || ''}" placeholder="Ex.: Semana do Sono" maxlength="80" ${dis}></label>
        <label class="lbl">Termina em<input class="inp" name="termina_em" type="datetime-local" value="${isoParaLocal(c.termina_em)}" ${dis}></label>
        <label class="lbl" style="grid-column:1/-1">Texto da faixa no topo do site<input class="inp" name="texto_faixa" value="${c.texto_faixa || ''}" maxlength="140" placeholder="Ex.: Semana do Sono: até 30% off em colchões selecionados" ${dis}></label>
        <label class="lbl" style="grid-column:1/-1">Produto em oferta na home<select class="inp" name="produto_id" ${dis}><option value="">Nenhum</option>${produtos.filter((p) => p.visivel_site).map((p) => h`<option value="${p.id}" ${c.produto_id === p.id ? raw('selected') : ''}>${p.nome}${p.na_campanha ? '' : ' (não marcado como campanha)'}</option>`)}</select></label>
      </div>
      ${sw('mostrar_contagem', 'Mostrar contagem regressiva', c.mostrar_contagem, S.so)}
      ${S.so ? '' : h`<p class="alerta-txt" data-erro role="alert" hidden style="margin:0"></p><button class="btn btn-g" type="submit">Salvar campanha</button>`}
    </form>
    <div class="card pilha" style="flex:1 1 300px"><span class="rot">Produtos na campanha</span>
      ${naCampanha.length ? h`<ul class="lst">${naCampanha.map((p) => { const v = p.produto_variacoes.filter((x) => x.ativo && x.preco_campanha); return h`<li><a class="lnk" href="#/produtos/editar/${p.id}" style="flex:1;color:var(--txt)">${p.nome}</a><span class="mut" style="font-size:12px">${v.length ? `${v.length} tamanho(s) com preço de campanha` : h`<span class="alerta-txt">sem preço de campanha</span>`}</span></li>`; })}</ul>` : vazio('Nenhum produto marcado. Marque “Participa da campanha” no cadastro do produto.')}
      <p class="mut" style="margin:0;font-size:12px">Vendas com preço de campanha somam o bônus de campanha na comissão.</p>
    </div></div>`);
  const form = $('[data-form]', S.corpo);
  ligarSw(form, S.so);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const erro = $('[data-erro]', form);
    try {
      const dados = {
        ativa: lerSw(form, 'ativa'), mostrar_contagem: lerSw(form, 'mostrar_contagem'),
        nome: String(f.get('nome') || '').trim() || null, texto_faixa: String(f.get('texto_faixa') || '').trim() || null,
        termina_em: localParaIso(f.get('termina_em')), produto_id: f.get('produto_id') || null
      };
      if (dados.ativa && !dados.texto_faixa) throw new Error('Escreva o texto da faixa para ligar a campanha.');
      if (dados.ativa && dados.termina_em && new Date(dados.termina_em) < new Date()) throw new Error('A data de término já passou.');
      await painel.site.salvarCampanha(dados);
      toast(dados.ativa ? 'Campanha no ar.' : 'Campanha salva.', 'ok');
      await S.recarregar(); campanha(S);
    } catch (err) { erro.textContent = err.message; erro.hidden = false; }
  });
}

// ---------------------------------------------------------------------
function depoimentos(S) {
  function render() {
    const ds = S.dados.depoimentos;
    S.corpo.innerHTML = String(h`<div class="card pilha">
      <div class="hd"><div><span class="rot">Depoimentos</span><p class="mut" style="margin:4px 0 0;font-size:13px">Use avaliações reais (ex.: Google), com a autorização do cliente.</p></div>${S.so ? '' : h`<button class="btn btn-g btn-p" data-novo>${icp.mais(16)} Novo depoimento</button>`}</div>
      ${ds.length ? h`<div class="gk" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">${ds.map((d) => h`<div class="card pilha" style="background:var(--sup2)">
        <p class="clr" style="margin:0;font-family:var(--serif);font-size:19px;line-height:1.4">“${d.texto}”</p>
        <span class="mut" style="font-size:13px">${d.nome}${d.fonte ? ' · ' + d.fonte : ''}${d.data ? ' · ' + fmt.data(d.data + 'T12:00:00Z') : ''}</span>
        <div class="hd">${sw('pub-' + d.id, 'Publicado', d.publicado, S.so)}
          ${S.so ? '' : h`<span style="display:flex;gap:6px"><button class="btn btn-i" data-editar="${d.id}" aria-label="Editar">${icp.editar()}</button><button class="btn btn-i" data-remover="${d.id}" aria-label="Excluir">${icp.lixo()}</button></span>`}</div>
      </div>`)}</div>` : vazio('Nenhum depoimento cadastrado.')}</div>`);
  }
  async function editar(d = {}) {
    const ok = await modal({
      titulo: d.id ? 'Editar depoimento' : 'Novo depoimento',
      corpo: h`<div class="g2"><label class="lbl">Nome do cliente<input class="inp" name="nome" value="${d.nome || ''}" required maxlength="80"></label>
        <label class="lbl">Fonte<input class="inp" name="fonte" value="${d.fonte || 'Google'}" maxlength="40"></label>
        <label class="lbl">Data<input class="inp" name="data" type="date" value="${d.data || ''}"></label>
        <label class="lbl" style="grid-column:1/-1">Texto<textarea class="inp" name="texto" maxlength="400" required>${d.texto || ''}</textarea></label></div>`,
      async aoConfirmar(f) {
        if (!String(f.get('nome')).trim() || !String(f.get('texto')).trim()) throw new Error('Preencha o nome e o texto.');
        await painel.site.salvarDepoimento({ ...(d.id ? { id: d.id } : { ordem: S.dados.depoimentos.length, publicado: true }), nome: String(f.get('nome')).trim(), fonte: String(f.get('fonte') || '').trim() || null, data: f.get('data') || null, texto: String(f.get('texto')).trim() });
      }
    });
    if (ok) { await S.recarregar(); render(); toast('Depoimento salvo.', 'ok'); }
  }
  S.corpo.addEventListener('click', async (e) => {
    const t = e.target;
    try {
      if (t.closest('[data-novo]')) return editar();
      const ed = t.closest('[data-editar]');
      if (ed) return editar(S.dados.depoimentos.find((d) => d.id === ed.dataset.editar));
      const rm = t.closest('[data-remover]');
      if (rm) { if (!(await confirmar('Excluir este depoimento?', { botao: 'Excluir' }))) return; await painel.site.removerDepoimento(rm.dataset.remover); await S.recarregar(); return render(); }
      const s = t.closest('[data-sw]');
      if (s && !S.so) {
        const d = S.dados.depoimentos.find((x) => 'pub-' + x.id === s.dataset.sw);
        await painel.site.salvarDepoimento({ id: d.id, nome: d.nome, texto: d.texto, publicado: !d.publicado });
        d.publicado = !d.publicado; s.setAttribute('aria-checked', String(d.publicado));
        toast(d.publicado ? 'Publicado no site.' : 'Retirado do site.', 'ok');
      }
    } catch (err) { toast(err.message, 'erro'); }
  });
  render();
}

// ---------------------------------------------------------------------
async function loja(S) {
  const c = S.dados.config;
  const hr = c.horarios || {};
  const dis = S.so ? raw('disabled') : '';
  const equipe = (await S.ctx.equipe().catch(() => [])).filter((p) => p.ativo && ['admin', 'gerente', 'vendedor'].includes(p.papel));
  S.corpo.innerHTML = String(h`<form class="row" data-form novalidate>
    <section class="card pilha" style="flex:2 1 460px"><span class="rot">Contato e endereço</span>
      <div class="g2">
        <label class="lbl">WhatsApp da loja<input class="inp" name="whatsapp" value="${c.whatsapp || ''}" placeholder="(31) 9 0000-0000" ${dis}></label>
        <label class="lbl">Instagram<input class="inp" name="instagram" value="${c.instagram || ''}" placeholder="@ls_colchoes" ${dis}></label>
        <label class="lbl" style="grid-column:1/-1">Mensagem padrão do WhatsApp<input class="inp" name="mensagem_whatsapp" value="${c.mensagem_whatsapp || ''}" maxlength="200" ${dis}></label>
        <label class="lbl" style="grid-column:1/-1">Endereço<input class="inp" name="endereco" value="${c.endereco || ''}" ${dis}></label>
        <label class="lbl" style="grid-column:1/-1">Link do Google Maps<input class="inp" name="maps_url" value="${c.maps_url || ''}" placeholder="https://maps.app.goo.gl/…" ${dis}></label>
        <label class="lbl">Segunda a sexta<input class="inp" name="h_seg_sex" value="${hr.seg_sex || ''}" placeholder="9h às 18h" ${dis}></label>
        <label class="lbl">Sábado<input class="inp" name="h_sabado" value="${hr.sabado || ''}" placeholder="9h às 13h" ${dis}></label>
        <label class="lbl">Domingo e feriados<input class="inp" name="h_domingo" value="${hr.domingo || ''}" placeholder="Fechado" ${dis}></label>
      </div></section>
    <aside class="pilha" style="flex:1 1 300px;gap:16px">
      <section class="card pilha"><span class="rot">Banners</span>
        ${sw('troca_automatica', 'Trocar banners sozinho', c.troca_automatica, S.so)}
        <label class="lbl">Tempo de cada banner (segundos)<input class="inp" name="tempo" type="number" min="3" max="20" step="0.5" value="${c.tempo_slide_ms / 1000}" ${dis}></label>
        ${sw('destaques_automaticos', 'Destaques da home pelos mais vendidos', c.destaques_automaticos, S.so)}
      </section>
      <section class="card pilha"><span class="rot">Leads do site</span>
        <label class="lbl">Distribuição<select class="inp" name="leads_destino" ${dis}>${opcoes({ rodizio: 'Rodízio entre os vendedores', fixo: 'Sempre para a mesma pessoa' }, c.leads_destino)}</select></label>
        <label class="lbl" data-resp ${c.leads_destino === 'fixo' ? '' : raw('hidden')}>Responsável<select class="inp" name="leads_responsavel_id" ${dis}><option value="">—</option>${equipe.map((p) => h`<option value="${p.id}" ${c.leads_responsavel_id === p.id ? raw('selected') : ''}>${p.nome}</option>`)}</select></label>
      </section>
      ${S.so ? '' : h`<p class="alerta-txt" data-erro role="alert" hidden style="margin:0"></p><button class="btn btn-g" type="submit">Salvar dados da loja</button>`}
    </aside></form>`);
  const form = $('[data-form]', S.corpo);
  ligarSw(form, S.so);
  form.addEventListener('change', (e) => { if (e.target.name === 'leads_destino') $('[data-resp]', form).hidden = e.target.value !== 'fixo'; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const erro = $('[data-erro]', form);
    const txt = (k) => String(f.get(k) || '').trim() || null;
    try {
      const tempo = Math.round(Number(f.get('tempo')) * 1000);
      if (!(tempo >= 3000 && tempo <= 20000)) throw new Error('O tempo do banner deve ficar entre 3 e 20 segundos.');
      if (f.get('leads_destino') === 'fixo' && !f.get('leads_responsavel_id')) throw new Error('Escolha quem recebe os leads.');
      if (txt('whatsapp') && txt('whatsapp').replace(/\D/g, '').length < 10) throw new Error('Confira o WhatsApp (com DDD).');
      await painel.site.salvarConfig({
        whatsapp: txt('whatsapp'), instagram: txt('instagram'), mensagem_whatsapp: txt('mensagem_whatsapp') || 'Olá! Vim pelo site da LS Colchões e quero ajuda para escolher.',
        endereco: txt('endereco'), maps_url: txt('maps_url'),
        horarios: { seg_sex: txt('h_seg_sex') || '', sabado: txt('h_sabado') || '', domingo: txt('h_domingo') || '' },
        troca_automatica: lerSw(form, 'troca_automatica'), destaques_automaticos: lerSw(form, 'destaques_automaticos'), tempo_slide_ms: tempo,
        leads_destino: f.get('leads_destino'), leads_responsavel_id: f.get('leads_destino') === 'fixo' ? f.get('leads_responsavel_id') : null
      });
      toast('Dados da loja salvos.', 'ok');
    } catch (err) { erro.textContent = err.message; erro.hidden = false; }
  });
}


