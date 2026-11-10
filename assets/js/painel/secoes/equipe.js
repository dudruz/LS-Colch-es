// Equipe e acessos: ativar contas, definir papel e % de comissão individual
import { painel } from '../../api.js';
import { h, raw, $ } from '../../html.js';
import { ROT, opcoes, toast, carregando, vazio, erroBloco, iniciais } from '../ui.js';

const DESCRICAO = {
  admin: 'Tudo, inclusive equipe, produtos, site, estoque e comissões.',
  gerente: 'Igual ao administrador.',
  vendedor: 'Vendas, CRM, agenda e as próprias metas. Não altera produtos, estoque nem site.',
  entregador: 'Agenda de entregas: conclui e muda status. Vê o estoque.',
  leitura: 'Vê tudo, não altera nada (ex.: contador, sócio).'
};

export default async function equipe(el, ctx) {
  el.innerHTML = String(h`
    <div class="cabeca"><div><h1>Equipe e acessos</h1><p>Toda conta nova nasce sem acesso. Ative aqui e escolha o papel.</p></div></div>
    <div class="row">
      <div class="card" style="flex:2 1 560px" data-lista>${carregando()}</div>
      <aside class="card pilha" style="flex:1 1 280px"><span class="rot">Como adicionar alguém</span>
        <ol style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:8px;font-size:13px">
          <li>No Supabase, abra <strong class="clr">Authentication → Users → Add user</strong> e convide pelo e-mail.</li>
          <li>A pessoa recebe o convite e cria a senha.</li>
          <li>Ela aparece aqui como <em>inativa</em>: escolha o papel e ative.</li>
        </ol>
        <span class="rot" style="margin-top:8px">O que cada papel pode fazer</span>
        <ul class="lst">${Object.entries(DESCRICAO).map(([k, t]) => h`<li style="flex-direction:column;align-items:flex-start;gap:2px"><span class="clr" style="font-weight:600">${ROT.papeis[k]}</span><span class="mut">${t}</span></li>`)}</ul>
      </aside>
    </div>`);
  const lista = $('[data-lista]', el);
  let pessoas = [];

  async function carregar() {
    try { pessoas = await ctx.equipe(true); render(); } catch (err) { lista.innerHTML = String(erroBloco(err)); }
  }
  function render() {
    lista.innerHTML = String(pessoas.length ? h`<div class="tabela"><table class="tbl"><thead><tr><th>Pessoa</th><th>Papel</th><th class="r">Comissão (%)</th><th>Acesso</th></tr></thead><tbody>
      ${pessoas.map((p) => { const eu = p.id === ctx.perfil.id; return h`<tr data-id="${p.id}">
        <td><span style="display:flex;gap:12px;align-items:center"><span class="avatar ${p.ativo ? '' : 'az'}">${iniciais(p.nome || p.email)}</span><span>
          <input class="inp" data-campo="nome" value="${p.nome || ''}" placeholder="Nome" style="height:36px;width:200px" aria-label="Nome">
          <span class="sub">${p.email || ''}${eu ? ' · você' : ''}</span></span></span></td>
        <td><select class="inp" data-campo="papel" style="height:36px;width:auto" ${eu ? raw('disabled title="Você não pode mudar o próprio papel"') : ''}>${opcoes(ROT.papeis, p.papel)}</select></td>
        <td class="r"><input class="inp" data-campo="comissao_percentual" type="number" step="0.1" min="0" max="100" value="${p.comissao_percentual ?? ''}" placeholder="padrão" style="height:36px;width:100px" ${['admin', 'gerente', 'vendedor'].includes(p.papel) ? '' : raw('disabled')}></td>
        <td><button type="button" class="sw" role="switch" data-ativo aria-checked="${String(p.ativo)}" ${eu ? raw('disabled') : ''}><span>${p.ativo ? 'Ativo' : 'Inativo'}</span><span class="trk"></span></button></td>
      </tr>`; })}</tbody></table></div>` : vazio('Nenhuma conta ainda.'));
  }

  async function salvar(id, campos, msg = 'Salvo.') {
    try { const r = await painel.salvarPerfil(id, campos); Object.assign(pessoas.find((p) => p.id === id), r); render(); toast(msg, 'ok'); } catch (err) { toast(err.message, 'erro'); render(); }
  }
  lista.addEventListener('click', (e) => {
    const s = e.target.closest('[data-ativo]');
    if (!s || s.disabled) return;
    const id = s.closest('[data-id]').dataset.id;
    const ativo = s.getAttribute('aria-checked') !== 'true';
    salvar(id, { ativo }, ativo ? 'Acesso liberado.' : 'Acesso bloqueado.');
  });
  lista.addEventListener('change', (e) => {
    const campo = e.target.dataset.campo;
    if (!campo) return;
    const id = e.target.closest('[data-id]').dataset.id;
    let v = e.target.value.trim();
    if (campo === 'comissao_percentual') v = v === '' ? null : Number(v);
    if (campo === 'nome' && !v) return toast('O nome não pode ficar vazio.', 'erro');
    salvar(id, { [campo]: v });
  });
  await carregar();
}
