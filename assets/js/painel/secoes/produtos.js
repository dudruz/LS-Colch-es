// Produtos: lista com publicação no site e editor completo (preços por tamanho, fotos, ficha e camadas)
import { painel, fmt, urlMidia } from '../../api.js';
import { h, raw, $, $$, debounce } from '../../html.js';
import { icp, ROT, opcoes, toast, confirmar, carregando, vazio, erroBloco } from '../ui.js';

const FIRMEZAS = { 1: 'Macio', 2: 'Macio a médio', 3: 'Médio', 4: 'Firme', 5: 'Extra firme' };

export default async function produtos(el, ctx) {
  const [acao, id] = ctx.params;
  if (acao === 'novo') return editor(el, ctx, null);
  if (acao === 'editar' && id) return editor(el, ctx, id);
  return lista(el, ctx);
}

// ---------------------------------------------------------------------
async function lista(el, ctx) {
  const f = { busca: '', categoria: '', situacao: '' };
  let itens = [];
  const base = await ctx.base();
  el.innerHTML = String(h`
    <div class="cabeca"><div><h1>Produtos</h1><p>O que estiver “No site” aparece no catálogo. Preço de campanha vale enquanto a campanha estiver ativa.</p></div>
      ${ctx.pode.admin ? h`<a class="btn btn-g" href="#/produtos/novo">${icp.mais()} Novo produto</a>` : ''}</div>
    <div class="card pilha">
      <div class="hd">
        <div class="chips"><button class="chip" data-cat="" aria-pressed="true">Todos</button>${base.categorias.map((c) => h`<button class="chip" data-cat="${c.id}" aria-pressed="false">${c.nome}</button>`)}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <select class="inp" data-situacao style="width:auto" aria-label="Situação"><option value="">Todos</option><option value="site">No site</option><option value="oculto">Ocultos</option><option value="sem-foto">Sem foto</option><option value="campanha">Na campanha</option></select>
          <label class="busca"><span class="sr">Buscar</span>${icp.busca()}<input class="inp" type="search" data-busca placeholder="Nome ou código" style="width:220px"></label>
        </div>
      </div>
      <div data-lista>${carregando()}</div>
    </div>`);
  const caixa = $('[data-lista]', el);

  function render() {
    const termo = f.busca.trim().toLowerCase();
    const vis = itens.filter((p) => (!f.categoria || p.categoria_id === f.categoria)
      && (!termo || `${p.nome} ${p.codigo || ''}`.toLowerCase().includes(termo))
      && (!f.situacao || (f.situacao === 'site' && p.visivel_site) || (f.situacao === 'oculto' && !p.visivel_site)
        || (f.situacao === 'sem-foto' && !p.produto_midias.length) || (f.situacao === 'campanha' && p.na_campanha)));
    if (!vis.length) { caixa.innerHTML = String(vazio('Nenhum produto encontrado.')); return; }
    caixa.innerHTML = String(h`<div class="tabela"><table class="tbl"><thead><tr><th></th><th>Produto</th><th>Categoria</th><th class="r">A partir de</th><th class="r">Tamanhos</th><th class="r">Estoque</th><th>Selo</th><th>Destaque</th><th>No site</th></tr></thead><tbody>
      ${vis.map((p) => {
        const vars = p.produto_variacoes.filter((v) => v.ativo);
        const menor = vars.length ? Math.min(...vars.map((v) => Number(v.preco))) : null;
        const capa = p.produto_midias.find((m) => m.capa) || p.produto_midias.filter((m) => m.tipo === 'foto').sort((a, b) => a.ordem - b.ordem)[0];
        const est = vars.reduce((a, v) => a + ((v.estoque?.quantidade ?? 0) - (v.estoque?.reservado ?? 0)), 0);
        return h`<tr data-produto="${p.id}" style="cursor:pointer">
          <td style="width:56px">${capa ? h`<img src="${urlMidia(capa.caminho)}" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:10px;display:block" loading="lazy">` : h`<span style="width:44px;height:44px;border-radius:10px;background:var(--sup2);display:flex;align-items:center;justify-content:center" class="mut" title="Sem foto">${icp.upload(16)}</span>`}</td>
          <td><span class="clr" style="font-weight:600">${p.nome}</span><span class="sub">${[p.codigo, p.tipo].filter(Boolean).join(' · ')}</span></td>
          <td>${p.categorias?.nome || '—'}</td>
          <td class="r">${menor != null ? fmt.reais(menor) : '—'}</td>
          <td class="r">${vars.map((v) => v.tamanho_codigo).join(' ') || '—'}</td>
          <td class="r ${est <= 0 ? 'alerta-txt' : ''}">${est}</td>
          <td>${p.selo ? h`<span class="tag o-instagram">${ROT.selos[p.selo]}</span>` : ''}${p.na_campanha ? h` <span class="tag o-site">campanha</span>` : ''}</td>
          <td><button type="button" class="btn btn-i" data-destaque="${p.id}" aria-pressed="${String(p.destaque_home)}" title="Destaque na home" style="${p.destaque_home ? 'color:var(--ouro);border-color:var(--ouro)' : ''}" ${ctx.pode.admin ? '' : raw('disabled')}>${icp.estrela()}</button></td>
          <td><button type="button" class="sw" role="switch" aria-checked="${String(p.visivel_site)}" data-site="${p.id}" aria-label="Mostrar no site" ${ctx.pode.admin ? '' : raw('disabled')}><span class="trk"></span></button></td>
        </tr>`;
      })}</tbody></table></div>
      <p class="mut" style="margin:12px 0 0;font-size:12px">${vis.length} produto(s) · ${vis.filter((p) => p.visivel_site).length} no site</p>`);
  }
  async function carregar() { try { itens = await painel.produtos.listar(); render(); } catch (err) { caixa.innerHTML = String(erroBloco(err)); } }

  el.addEventListener('click', async (e) => {
    const cat = e.target.closest('[data-cat]');
    if (cat) { f.categoria = cat.dataset.cat; $$('[data-cat]', el).forEach((b) => b.setAttribute('aria-pressed', String(b === cat))); return render(); }
    const sw = e.target.closest('[data-site]');
    if (sw) {
      e.stopPropagation();
      const p = itens.find((x) => x.id === sw.dataset.site);
      if (!p.visivel_site && !p.produto_variacoes.some((v) => v.ativo)) return toast('Cadastre pelo menos um tamanho com preço antes de publicar.', 'erro');
      try { await painel.produtos.alternarSite(p.id, !p.visivel_site); p.visivel_site = !p.visivel_site; render(); toast(p.visivel_site ? `${p.nome} está no site.` : `${p.nome} saiu do site.`, 'ok'); } catch (err) { toast(err.message, 'erro'); }
      return;
    }
    const st = e.target.closest('[data-destaque]');
    if (st) {
      e.stopPropagation();
      const p = itens.find((x) => x.id === st.dataset.destaque);
      try { await painel.produtos.salvar({ produto: { id: p.id, nome: p.nome, slug: p.slug, destaque_home: !p.destaque_home } }); p.destaque_home = !p.destaque_home; render(); } catch (err) { toast(err.message, 'erro'); }
      return;
    }
    const linha = e.target.closest('[data-produto]');
    if (linha) ctx.ir('#/produtos/editar/' + linha.dataset.produto);
  });
  el.addEventListener('input', debounce((e) => { if (e.target.matches('[data-busca]')) { f.busca = e.target.value; render(); } }, 200));
  el.addEventListener('change', (e) => { if (e.target.matches('[data-situacao]')) { f.situacao = e.target.value; render(); } });
  await carregar();
}

// ---------------------------------------------------------------------
async function editor(el, ctx, id) {
  ctx.trilha({ nome: 'Produtos', href: '#/produtos' }, id ? 'Editar produto' : 'Novo produto');
  let p, base;
  try {
    [base, p] = await Promise.all([ctx.base(), id ? painel.produtos.obter(id) : Promise.resolve(null)]);
  } catch (err) { el.innerHTML = String(erroBloco(err)); return; }
  p = p || { nome: '', indicado_para: [], produto_variacoes: [], produto_midias: [], produto_ficha: [], produto_camadas: [], visivel_site: false, firmeza: 3 };
  const so = !ctx.pode.admin;
  const dis = so ? raw('disabled') : '';
  const varPor = Object.fromEntries(p.produto_variacoes.map((v) => [v.tamanho_codigo, v]));
  const midias = () => [...p.produto_midias].sort((a, b) => (b.capa - a.capa) || a.ordem - b.ordem);

  el.innerHTML = String(h`
    <div class="cabeca"><div><h1>${p.nome || 'Novo produto'}</h1><p>${id ? h`${p.visivel_site ? 'Publicado no site' : 'Oculto no site'}${p.slug ? h` · <a href="../produto.html?p=${p.slug}" target="_blank" rel="noopener">ver página</a>` : ''}` : 'Salve as informações para liberar as fotos.'}</p></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn" href="#/produtos">${icp.esq(16)} Voltar</a>${so ? '' : h`<button class="btn btn-g" type="submit" form="form-produto">Salvar produto</button>`}</div></div>
    <form id="form-produto" class="row" novalidate>
      <div class="pilha" style="flex:2 1 560px;gap:16px">
        <section class="card pilha"><span class="rot">Informações</span>
          <div class="g2">
            <label class="lbl" style="grid-column:1/-1">Nome<input class="inp" name="nome" required maxlength="140" value="${p.nome}" ${dis}></label>
            <label class="lbl">Código<input class="inp" name="codigo" value="${p.codigo || ''}" placeholder="LS-0101" ${dis}></label>
            <label class="lbl">Categoria<select class="inp" name="categoria_id" ${dis}><option value="">—</option>${base.categorias.map((c) => h`<option value="${c.id}" ${p.categoria_id === c.id ? raw('selected') : ''}>${c.nome}</option>`)}</select></label>
            <label class="lbl">Linha<select class="inp" name="linha_id" ${dis}><option value="">—</option>${base.linhas.map((l) => h`<option value="${l.id}" ${p.linha_id === l.id ? raw('selected') : ''}>${l.nome}</option>`)}</select></label>
            <label class="lbl">Tipo<input class="inp" name="tipo" value="${p.tipo || ''}" placeholder="Molas ensacadas, espuma…" ${dis}></label>
            <label class="lbl">Firmeza<select class="inp" name="firmeza" ${dis}><option value="">—</option>${opcoes(FIRMEZAS, p.firmeza)}</select></label>
            <label class="lbl">Altura (cm)<input class="inp" name="altura_cm" type="number" step="0.5" min="0" value="${p.altura_cm ?? ''}" ${dis}></label>
            <label class="lbl" style="grid-column:1/-1">Resumo (aparece no card)<input class="inp" name="descricao_curta" maxlength="200" value="${p.descricao_curta || ''}" ${dis}></label>
            <label class="lbl" style="grid-column:1/-1">Descrição completa<textarea class="inp" name="descricao" rows="5" ${dis}>${p.descricao || ''}</textarea></label>
            <label class="lbl" style="grid-column:1/-1">Indicado para <small class="mut">(separe por vírgula)</small><input class="inp" name="indicado_para" value="${(p.indicado_para || []).join(', ')}" placeholder="Quem dorme de lado, casais, dor nas costas" ${dis}></label>
          </div></section>

        <section class="card pilha"><span class="rot">Tamanhos e preços</span>
          <div class="tabela"><table class="tbl"><thead><tr><th>Ativo</th><th>Tamanho</th><th>Preço (R$)</th><th>Preço campanha</th><th>SKU</th><th class="r">Mín.</th><th class="r">Disp.</th></tr></thead><tbody>
          ${base.tamanhos.map((t) => { const v = varPor[t.codigo]; return h`<tr data-tam="${t.codigo}">
            <td><input type="checkbox" data-c="ativo" ${v?.ativo ? raw('checked') : ''} ${dis} aria-label="Vender ${t.nome}"></td>
            <td><span class="clr">${t.nome}</span><span class="sub">${t.largura_cm ? `${t.largura_cm} × ${t.comprimento_cm}` : ''}</span></td>
            <td><input class="inp" data-c="preco" type="number" step="0.01" min="0" value="${v?.preco ?? ''}" style="width:120px;height:38px" ${dis}></td>
            <td><input class="inp" data-c="preco_campanha" type="number" step="0.01" min="0" value="${v?.preco_campanha ?? ''}" style="width:120px;height:38px" ${dis}></td>
            <td><input class="inp" data-c="sku" value="${v?.sku || ''}" style="width:130px;height:38px" ${dis}></td>
            <td class="r"><input class="inp" data-c="estoque_minimo" type="number" min="0" value="${v?.estoque_minimo ?? 1}" style="width:70px;height:38px" ${dis}></td>
            <td class="r">${v?.estoque ? (v.estoque.quantidade - v.estoque.reservado) : '—'}</td></tr>`; })}
          </tbody></table></div>
          <p class="mut" style="margin:0;font-size:12px">Marque “Ativo” e informe o preço para vender o tamanho. O preço de campanha só aparece quando a campanha está ligada e o produto está marcado como “Na campanha”.</p></section>

        <section class="card pilha"><div class="hd"><span class="rot">Fotos e vídeos</span>${id && !so ? h`<label class="btn btn-p" style="cursor:pointer">${icp.upload(16)} Enviar arquivos<input type="file" data-upload accept="image/jpeg,image/png,image/webp,video/mp4" multiple hidden></label>` : ''}</div>
          <div data-midias></div>
          <p class="mut" style="margin:0;font-size:12px">JPG, PNG ou WebP até 10 MB (ideal 1600 px, fundo claro). A primeira foto é a capa.</p></section>

        <div class="row">
          <section class="card pilha"><div class="hd"><span class="rot">Ficha técnica</span>${so ? '' : h`<button type="button" class="lnk" data-add="ficha">${icp.mais(14)} Linha</button>`}</div><div class="pilha" data-ficha style="gap:8px"></div></section>
          <section class="card pilha"><div class="hd"><span class="rot">Camadas (de cima para baixo)</span>${so ? '' : h`<button type="button" class="lnk" data-add="camada">${icp.mais(14)} Camada</button>`}</div><div class="pilha" data-camadas style="gap:8px"></div></section>
        </div>
      </div>

      <aside class="pilha" style="flex:1 1 280px;gap:16px;position:sticky;top:90px">
        <section class="card pilha"><span class="rot">Publicação</span>
          ${[['visivel_site', 'Mostrar no site'], ['destaque_home', 'Destaque na home'], ['na_campanha', 'Participa da campanha']].map(([k, t]) => h`<button type="button" class="sw" role="switch" data-sw="${k}" aria-checked="${String(!!p[k])}" ${dis}><span>${t}</span><span class="trk"></span></button>`)}
          <label class="lbl">Selo<select class="inp" name="selo" ${dis}><option value="">Nenhum</option>${opcoes(ROT.selos, p.selo)}</select></label>
          <label class="lbl">Ordem no destaque<input class="inp" name="ordem_destaque" type="number" value="${p.ordem_destaque ?? 0}" ${dis}></label>
          ${p.slug ? h`<label class="lbl">Endereço da página<input class="inp" name="slug" value="${p.slug}" ${dis}></label>` : ''}
        </section>
        ${so ? '' : h`<p class="alerta-txt" data-erro role="alert" hidden style="margin:0"></p><button class="btn btn-g" type="submit">Salvar produto</button>`}
      </aside>
    </form>`);

  const form = $('#form-produto', el);
  const linhaFicha = (c = {}) => h`<div class="g2" data-linha style="grid-template-columns:1fr 1.3fr 40px;align-items:center"><input class="inp" data-k="campo" value="${c.campo || ''}" placeholder="Ex.: Molas" ${dis}><input class="inp" data-k="valor" value="${c.valor || ''}" placeholder="Ex.: Ensacadas individualmente" ${dis}>${so ? '' : h`<button type="button" class="btn btn-i" data-rem aria-label="Remover">${icp.lixo()}</button>`}</div>`;
  const linhaCamada = (c = {}) => h`<div class="g2" data-linha style="grid-template-columns:48px 1fr 40px;align-items:center"><input type="color" data-k="cor" value="${c.cor || '#E2DED2'}" style="width:44px;height:40px;border:0;background:none" ${dis} aria-label="Cor"><input class="inp" data-k="nome" value="${c.nome || ''}" placeholder="Ex.: Pillow top em viscoelástico" ${dis}>${so ? '' : h`<button type="button" class="btn btn-i" data-rem aria-label="Remover">${icp.lixo()}</button>`}</div>`;
  $('[data-ficha]', form).innerHTML = String(h`${[...p.produto_ficha].sort((a, b) => a.ordem - b.ordem).map(linhaFicha)}`);
  $('[data-camadas]', form).innerHTML = String(h`${[...p.produto_camadas].sort((a, b) => a.ordem - b.ordem).map(linhaCamada)}`);

  function renderMidias() {
    const ms = midias();
    $('[data-midias]', form).innerHTML = String(!id ? vazio('Salve o produto para enviar fotos.') : ms.length ? h`<div class="gk" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${ms.map((m, i) => h`
      <figure style="margin:0;position:relative;border-radius:14px;overflow:hidden;border:1px solid ${m.capa ? 'var(--ouro)' : 'var(--linha)'};background:var(--sup2)">
        ${m.tipo === 'video' ? h`<video src="${urlMidia(m.caminho)}" muted style="width:100%;aspect-ratio:1;object-fit:cover;display:block"></video>` : h`<img src="${urlMidia(m.caminho)}" alt="" style="width:100%;aspect-ratio:1;object-fit:cover;display:block" loading="lazy">`}
        ${m.capa ? h`<span class="tag" style="position:absolute;top:8px;left:8px;background:var(--ouro);color:var(--fundo)">Capa</span>` : ''}
        ${so ? '' : h`<figcaption style="display:flex;gap:4px;justify-content:center;padding:6px">
          ${!m.capa && m.tipo === 'foto' ? h`<button type="button" class="btn btn-i" data-capa="${m.id}" title="Usar como capa" aria-label="Usar como capa">${icp.estrela()}</button>` : ''}
          <button type="button" class="btn btn-i" data-mover="${i}" data-dir="-1" ${i === 0 ? raw('disabled') : ''} aria-label="Mover para a esquerda">${icp.esq(16)}</button>
          <button type="button" class="btn btn-i" data-mover="${i}" data-dir="1" ${i === ms.length - 1 ? raw('disabled') : ''} aria-label="Mover para a direita">${icp.dir(16)}</button>
          <button type="button" class="btn btn-i" data-remover-midia="${m.id}" aria-label="Remover">${icp.lixo()}</button></figcaption>`}
      </figure>`)}</div>` : vazio('Nenhuma foto ainda. Produtos com foto vendem muito mais.'));
  }
  renderMidias();

  form.addEventListener('click', async (e) => {
    const t = e.target;
    const sw = t.closest('[data-sw]');
    if (sw && !so) { sw.setAttribute('aria-checked', String(sw.getAttribute('aria-checked') !== 'true')); return; }
    const add = t.closest('[data-add]');
    if (add) { const alvo = add.dataset.add === 'ficha' ? $('[data-ficha]', form) : $('[data-camadas]', form); alvo.insertAdjacentHTML('beforeend', String(add.dataset.add === 'ficha' ? linhaFicha() : linhaCamada())); $('[data-linha]:last-child input', alvo)?.focus(); return; }
    if (t.closest('[data-rem]')) { t.closest('[data-linha]').remove(); return; }
    try {
      const capa = t.closest('[data-capa]');
      if (capa) { await painel.produtos.definirCapa(id, capa.dataset.capa); p.produto_midias.forEach((m) => { m.capa = m.id === capa.dataset.capa; }); renderMidias(); return; }
      const mv = t.closest('[data-mover]');
      if (mv) {
        const ms = midias(); const i = Number(mv.dataset.mover), j = i + Number(mv.dataset.dir);
        [ms[i], ms[j]] = [ms[j], ms[i]];
        await painel.produtos.ordenarMidias(ms.map((m) => m.id));
        ms.forEach((m, k) => { m.ordem = k; });
        if (ms[0].tipo === 'foto' && !ms[0].capa) { await painel.produtos.definirCapa(id, ms[0].id); p.produto_midias.forEach((m) => { m.capa = m.id === ms[0].id; }); }
        renderMidias(); return;
      }
      const rm = t.closest('[data-remover-midia]');
      if (rm) {
        if (!(await confirmar('Remover este arquivo do produto?', { botao: 'Remover' }))) return;
        const m = p.produto_midias.find((x) => x.id === rm.dataset.removerMidia);
        await painel.produtos.removerMidia(m);
        p.produto_midias = p.produto_midias.filter((x) => x.id !== m.id);
        renderMidias();
      }
    } catch (err) { toast(err.message, 'erro'); }
  });

  form.addEventListener('change', async (e) => {
    if (!e.target.matches('[data-upload]')) return;
    const arquivos = [...e.target.files];
    e.target.value = '';
    for (const arq of arquivos) {
      if (arq.size > 10 * 1024 * 1024) { toast(`${arq.name}: maior que 10 MB.`, 'erro'); continue; }
      try {
        toast(`Enviando ${arq.name}…`);
        const semCapa = !p.produto_midias.some((m) => m.capa);
        const m = await painel.produtos.enviarMidia(id, arq, { capa: semCapa && arq.type.startsWith('image'), ordem: p.produto_midias.length });
        p.produto_midias.push(m);
        renderMidias();
      } catch (err) { toast(`${arq.name}: ${err.message}`, 'erro'); }
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (so) return;
    const erro = $('[data-erro]', form);
    erro.hidden = true;
    const fd = new FormData(form);
    const txt = (k) => String(fd.get(k) || '').trim() || null;
    const num = (k) => (fd.get(k) === '' || fd.get(k) == null ? null : Number(fd.get(k)));
    const sw = (k) => $(`[data-sw="${k}"]`, form).getAttribute('aria-checked') === 'true';
    try {
      if (!txt('nome')) throw new Error('Informe o nome do produto.');
      const variacoes = [];
      $$('[data-tam]', form).forEach((tr) => {
        const v = (c) => $(`[data-c="${c}"]`, tr);
        const ativo = v('ativo').checked, preco = v('preco').value;
        const existente = varPor[tr.dataset.tam];
        if (!preco && !existente) { if (ativo) throw new Error(`Informe o preço do tamanho ${tr.dataset.tam}.`); return; }
        if (ativo && !preco) throw new Error(`Informe o preço do tamanho ${tr.dataset.tam}.`);
        variacoes.push({
          tamanho_codigo: tr.dataset.tam, ativo,
          preco: Number(preco || existente?.preco || 0), preco_campanha: v('preco_campanha').value ? Number(v('preco_campanha').value) : null,
          sku: v('sku').value.trim() || null, estoque_minimo: Number(v('estoque_minimo').value) || 0
        });
      });
      if (sw('visivel_site') && !variacoes.some((v) => v.ativo)) throw new Error('Para mostrar no site, ative pelo menos um tamanho com preço.');
      const produto = {
        ...(id ? { id, slug: txt('slug') || p.slug } : { slug: '' }),
        nome: txt('nome'), codigo: txt('codigo'), categoria_id: txt('categoria_id'), linha_id: txt('linha_id'), tipo: txt('tipo'),
        firmeza: num('firmeza'), altura_cm: num('altura_cm'), descricao_curta: txt('descricao_curta'), descricao: txt('descricao'),
        indicado_para: String(fd.get('indicado_para') || '').split(',').map((s) => s.trim()).filter(Boolean),
        selo: txt('selo'), ordem_destaque: num('ordem_destaque') || 0,
        visivel_site: sw('visivel_site'), destaque_home: sw('destaque_home'), na_campanha: sw('na_campanha')
      };
      const ficha = $$('[data-ficha] [data-linha]', form).map((l) => ({ campo: $('[data-k=campo]', l).value.trim(), valor: $('[data-k=valor]', l).value.trim() })).filter((x) => x.campo);
      const camadas = $$('[data-camadas] [data-linha]', form).map((l) => ({ nome: $('[data-k=nome]', l).value.trim(), cor: $('[data-k=cor]', l).value })).filter((x) => x.nome);
      $$('button[type=submit]').forEach((b) => { b.disabled = true; });
      const salvo = await painel.produtos.salvar({ produto, variacoes, ficha, camadas });
      toast('Produto salvo.', 'ok');
      ctx.base(true);
      if (!id) { ctx.ir('#/produtos/editar/' + salvo.id); return; }
      editor(el, ctx, id);
    } catch (err) {
      erro.textContent = err.message; erro.hidden = false;
      $$('button[type=submit]').forEach((b) => { b.disabled = false; });
    }
  });
}
