// Site · Catálogo com filtros (estado guardado na URL para poder compartilhar)
import { iniciarPagina, h, raw, $, $$, site, cardProduto, revelar } from './comum.js';

const USO = {
  S: 'Uma pessoa, quartos menores e quarto de criança.', SS: 'Uma pessoa alta ou que gosta de espaço.',
  V: 'Uma pessoa que gosta de espaço de sobra.', C: 'O tamanho mais comum para duas pessoas.',
  Q: 'Duas pessoas, com mais largura e comprimento.', K: 'Máximo espaço para o casal, ou casal com criança.'
};
const POR_PAGINA = 12;
let offset = 0;
let total = 0;

function lerUrl() {
  const p = new URLSearchParams(location.search);
  return {
    categoria: p.get('categoria') || '',
    tamanhos: p.getAll('tamanho'),
    firmeza: p.getAll('firmeza'),
    tipos: p.getAll('tipo'),
    preco: p.get('preco') || '',
    ordem: p.get('ordem') || 'mais_escolhidos'
  };
}
function gravarUrl(f) {
  const p = new URLSearchParams();
  if (f.categoria) p.set('categoria', f.categoria);
  f.tamanhos.forEach((t) => p.append('tamanho', t));
  f.firmeza.forEach((t) => p.append('firmeza', t));
  f.tipos.forEach((t) => p.append('tipo', t));
  if (f.preco) p.set('preco', f.preco);
  if (f.ordem !== 'mais_escolhidos') p.set('ordem', f.ordem);
  history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
}
function lerForm() {
  const form = $('#filtros');
  const marcados = (n) => $$(`input[name="${n}"]:checked`, form).map((i) => i.value);
  return {
    categoria: $('#categorias [aria-pressed="true"]')?.dataset.cat || '',
    tamanhos: marcados('tamanho'), firmeza: marcados('firmeza'), tipos: marcados('tipo'),
    preco: $('input[name="preco"]:checked', form)?.value || '',
    ordem: $('#ordem').value
  };
}
function paraApi(f) {
  const [min, max] = (f.preco || '-').split('-');
  return {
    categoria: f.categoria || null, tamanhos: f.tamanhos, tipos: f.tipos,
    firmezas: f.firmeza.flatMap((v) => v.split(',').map(Number)),
    precoMin: min ? Number(min) : null, precoMax: max ? Number(max) : null, ordem: f.ordem
  };
}

async function buscar(acumular = false) {
  const f = lerForm();
  gravarUrl(f);
  if (!acumular) offset = 0;
  const lista = $('#produtos');
  $('#mais').disabled = true;
  try {
    const r = await site.catalogo({ ...paraApi(f), limite: POR_PAGINA, offset });
    total = r.total;
    const cards = String(h`${r.itens.map((p) => cardProduto(p))}`);
    if (acumular) lista.insertAdjacentHTML('beforeend', cards);
    else lista.innerHTML = cards || String(h`<div class="vazio" style="grid-column:1/-1"><h3 class="serif" style="font-size:28px;color:var(--navy);margin:0">Nenhum modelo com esses filtros.</h3><p>Tire algum filtro ou fale com um consultor: ele encontra a opção certa para você.</p></div>`);
    offset += r.itens.length;
    $('#contador').textContent = `${total} ${total === 1 ? 'modelo' : 'modelos'}`;
    $('#mais').hidden = offset >= total;
  } catch (e) {
    lista.innerHTML = String(h`<div class="vazio" style="grid-column:1/-1"><p>Não foi possível carregar os produtos agora. ${e.message}</p></div>`);
    $('#contador').textContent = '';
  }
  $('#mais').disabled = false;
  revelar();
}

(async () => {
  const d = await iniciarPagina('colchoes');
  const f = lerUrl();

  const cats = [{ nome: 'Todos', slug: '' }, ...(d.categorias || [])];
  $('#categorias').innerHTML = String(h`${cats.map((c) => h`<button type="button" class="chip" data-cat="${c.slug}" aria-pressed="${String(c.slug === f.categoria)}">${c.nome}</button>`)}`);
  $('#f-tamanhos').innerHTML = String(h`${(d.tamanhos || []).map((t) => h`<label class="opcao"><input type="checkbox" name="tamanho" value="${t.codigo}" ${f.tamanhos.includes(t.codigo) ? raw('checked') : ''}> ${t.nome} <small>${t.largura_cm} × ${t.comprimento_cm}</small></label>`)}`);
  $$('#filtros input[name="firmeza"]').forEach((i) => { i.checked = f.firmeza.includes(i.value); });
  $$('#filtros input[name="tipo"]').forEach((i) => { i.checked = f.tipos.includes(i.value); });
  $$('#filtros input[name="preco"]').forEach((i) => { i.checked = i.value === f.preco; });
  $('#ordem').value = f.ordem;

  const maxL = Math.max(...(d.tamanhos || []).map((t) => t.largura_cm || 0), 1);
  $('#medidas').innerHTML = String(h`${(d.tamanhos || []).filter((t) => USO[t.codigo]).map((t) => h`
    <div class="medida rv">
      <div class="desenho" aria-hidden="true"><span style="width:${Math.round(t.largura_cm / maxL * 100)}%;height:${Math.round(t.comprimento_cm / 203 * 110)}px"></span></div>
      <h3>${t.nome}</h3><b>${t.largura_cm} × ${t.comprimento_cm} cm</b><p>${USO[t.codigo]}</p>
    </div>`)}`);

  $('#categorias').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    $$('#categorias [data-cat]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    buscar();
  });
  $('#filtros').addEventListener('change', () => buscar());
  $('#ordem').addEventListener('change', () => buscar());
  $('#mais').addEventListener('click', () => buscar(true));
  $('#limpar').addEventListener('click', () => {
    $$('#filtros input').forEach((i) => { i.checked = i.type === 'radio' ? i.value === '' : false; });
    $$('#categorias [data-cat]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.cat === '')));
    $('#ordem').value = 'mais_escolhidos';
    buscar();
  });

  await buscar();
})();
