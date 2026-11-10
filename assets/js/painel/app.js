// =====================================================================
// Painel LS Colchões · login, menu por papel, rotas e avisos em tempo real
// =====================================================================
import { supabase, auth, painel } from '../api.js';
import { h, raw, $, $$ } from '../html.js';
import { icp, ROT, toast, iniciais, carregando } from './ui.js';

const app = $('#app');

// Seções do painel e quem enxerga cada uma
const TODOS = ['admin', 'gerente', 'vendedor', 'entregador', 'leitura'];
const SECOES = [
  { id: 'inicio', nome: 'Visão geral', grupo: 'Gestão', papeis: ['admin', 'gerente', 'vendedor', 'leitura'] },
  { id: 'vendas', nome: 'Vendas', papeis: ['admin', 'gerente', 'vendedor', 'leitura'] },
  { id: 'crm', nome: 'CRM e leads', badge: 'leads', papeis: ['admin', 'gerente', 'vendedor', 'leitura'] },
  { id: 'entregas', nome: 'Entregas e agenda', grupo: 'Operação', badge: 'entregas', papeis: TODOS },
  { id: 'estoque', nome: 'Estoque', badge: 'estoque', alerta: true, papeis: TODOS },
  { id: 'metas', nome: 'Metas e comissões', papeis: ['admin', 'gerente', 'vendedor', 'leitura'] },
  { id: 'produtos', nome: 'Produtos', grupo: 'Site', papeis: ['admin', 'gerente', 'leitura'] },
  { id: 'site', nome: 'Gestão do site', papeis: ['admin', 'gerente', 'leitura'] },
  { id: 'equipe', nome: 'Equipe e acessos', grupo: 'Conta', papeis: ['admin', 'gerente'] }
];

let ctx = null;
let limpar = null;
let geracao = 0;
const desligar = [];

// ---------------------------------------------------------------------
// Telas de acesso
// ---------------------------------------------------------------------
function telaLogin(aviso = '') {
  app.innerHTML = String(h`
  <main class="login">
    <form class="login-caixa" id="form-login" novalidate>
      <img src="../assets/img/ls-logo-branca.svg" alt="LS Colchões" style="height:44px;width:auto;align-self:flex-start">
      <div><h1>Painel da loja</h1><p class="mut" style="margin:4px 0 0">Entre com o e-mail e a senha cadastrados.</p></div>
      ${aviso ? h`<p class="ok-txt" style="margin:0">${aviso}</p>` : ''}
      <label class="lbl">E-mail<input class="inp" name="email" type="email" autocomplete="username" required></label>
      <label class="lbl" data-senha>Senha<input class="inp" name="senha" type="password" autocomplete="current-password" required></label>
      <p class="alerta-txt" role="alert" hidden style="margin:0"></p>
      <button class="btn btn-g" type="submit">Entrar</button>
      <button class="lnk" type="button" data-esqueci style="align-self:center">Esqueci minha senha</button>
    </form>
  </main>`);
  const form = $('#form-login');
  let recuperar = false;
  const erro = $('[role=alert]', form);
  $('[data-esqueci]', form).addEventListener('click', (e) => {
    recuperar = !recuperar;
    $('[data-senha]', form).hidden = recuperar;
    $('button[type=submit]', form).textContent = recuperar ? 'Enviar link para criar nova senha' : 'Entrar';
    e.currentTarget.textContent = recuperar ? 'Voltar para o login' : 'Esqueci minha senha';
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const botao = $('button[type=submit]', form);
    erro.hidden = true; botao.disabled = true;
    try {
      if (recuperar) {
        await auth.recuperarSenha(String(f.get('email')).trim(), location.origin + location.pathname);
        telaLogin('Se o e-mail estiver cadastrado, você vai receber um link para criar a nova senha.');
        return;
      }
      await auth.entrar(String(f.get('email')).trim(), String(f.get('senha')));
      await iniciar();
    } catch (err) {
      erro.textContent = err.message; erro.hidden = false; botao.disabled = false;
    }
  });
  $('[name=email]', form).focus();
}

function telaNovaSenha() {
  app.innerHTML = String(h`
  <main class="login">
    <form class="login-caixa" novalidate>
      <img src="../assets/img/ls-logo-branca.svg" alt="LS Colchões" style="height:44px;width:auto;align-self:flex-start">
      <h1>Criar nova senha</h1>
      <label class="lbl">Nova senha (mínimo 8 caracteres)<input class="inp" name="s1" type="password" autocomplete="new-password" minlength="8" required></label>
      <label class="lbl">Repita a senha<input class="inp" name="s2" type="password" autocomplete="new-password" required></label>
      <p class="alerta-txt" role="alert" hidden style="margin:0"></p>
      <button class="btn btn-g" type="submit">Salvar e entrar</button>
    </form>
  </main>`);
  const form = $('form', app);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const erro = $('[role=alert]', form);
    const s1 = form.s1.value, s2 = form.s2.value;
    if (s1.length < 8) { erro.textContent = 'A senha precisa ter pelo menos 8 caracteres.'; erro.hidden = false; return; }
    if (s1 !== s2) { erro.textContent = 'As duas senhas não são iguais.'; erro.hidden = false; return; }
    try {
      await auth.novaSenha(s1);
      history.replaceState(null, '', location.pathname);
      await iniciar();
      toast('Senha atualizada.', 'ok');
    } catch (err) { erro.textContent = err.message; erro.hidden = false; }
  });
}

function telaSemAcesso(email) {
  app.innerHTML = String(h`
  <main class="login">
    <div class="login-caixa">
      <img src="../assets/img/ls-logo-branca.svg" alt="LS Colchões" style="height:44px;width:auto;align-self:flex-start">
      <h1>Acesso aguardando liberação</h1>
      <p style="margin:0">Sua conta <strong class="clr">${email}</strong> foi criada, mas ainda não foi ativada. Peça ao gerente para liberar seu acesso em <em>Equipe e acessos</em>.</p>
      <button class="btn" type="button" data-sair>Sair</button>
    </div>
  </main>`);
  $('[data-sair]', app).addEventListener('click', () => auth.sair().then(() => telaLogin()));
}

// ---------------------------------------------------------------------
// Estrutura do painel
// ---------------------------------------------------------------------
function montar(perfil) {
  const papel = perfil.papel;
  const visiveis = SECOES.filter((s) => s.papeis.includes(papel));
  let grupoAtual = null;
  app.innerHTML = String(h`
  <div class="app">
    <aside class="menu" aria-label="Menu do painel">
      <div class="menu-marca"><img src="../assets/img/ls-logo-branca.svg" alt="LS Colchões"><span class="tag-painel">PAINEL</span></div>
      <nav>
        ${visiveis.map((s) => {
          const cab = s.grupo && s.grupo !== grupoAtual ? h`<div class="grupo">${s.grupo.toUpperCase()}</div>` : '';
          if (s.grupo) grupoAtual = s.grupo;
          return h`${cab}<a class="navb" href="#/${s.id}" data-secao="${s.id}">${icp[s.id]()}<span>${s.nome}</span>${s.badge ? h`<span class="badge ${s.alerta ? 'alerta' : ''}" data-badge="${s.badge}" hidden></span>` : ''}</a>`;
        })}
      </nav>
      <div class="usuario">
        <span class="avatar">${iniciais(perfil.nome || perfil.email)}</span>
        <div style="min-width:0;flex:1"><div class="clr" style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${perfil.nome || perfil.email}</div><div class="mut" style="font-size:12px">${ROT.papeis[papel]}</div></div>
        <button class="btn btn-i" type="button" data-sair aria-label="Sair" title="Sair">${icp.sair()}</button>
      </div>
    </aside>
    <div class="principal">
      <header class="barra">
        <div class="trilha" id="trilha"></div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <a class="btn btn-p" href="../index.html" target="_blank" rel="noopener">Ver site</a>
          <button class="btn btn-i so-cel" type="button" data-sair aria-label="Sair" title="Sair">${icp.sair()}</button>
          ${['admin', 'gerente', 'vendedor'].includes(papel) ? h`<button class="btn btn-g btn-p" type="button" data-nova-venda>${icp.mais(16)} Nova venda</button>` : ''}
        </div>
      </header>
      <div class="conteudo" id="conteudo"></div>
    </div>
  </div>`);

  const cache = {};
  ctx = {
    perfil, papel,
    pode: {
      admin: ['admin', 'gerente'].includes(papel),
      vender: ['admin', 'gerente', 'vendedor'].includes(papel),
      entregar: ['admin', 'gerente', 'vendedor', 'entregador'].includes(papel)
    },
    equipe: (fresco = false) => (fresco || !cache.equipe ? (cache.equipe = painel.equipe()) : cache.equipe),
    base: (fresco = false) => (fresco || !cache.base ? (cache.base = painel.catalogoBase()) : cache.base),
    ir: (rota) => { location.hash = rota; },
    trilha: (...partes) => {
      $('#trilha').innerHTML = String(h`<a href="#/inicio">Painel</a>${partes.map((p) => h`<span class="mut">/</span>${typeof p === 'string' ? h`<span class="clr">${p}</span>` : h`<a href="${p.href}">${p.nome}</a>`}`)}`);
    },
    atualizarContadores
  };

  $$('[data-sair]', app).forEach((b) => b.addEventListener('click', async () => { encerrar(); await auth.sair(); telaLogin(); }));
  $('[data-nova-venda]', app)?.addEventListener('click', async () => {
    const m = await import('./secoes/vendas.js');
    m.novaVenda(ctx, () => { if (/^#\/(vendas|inicio)?$/.test(location.hash || '#/')) navegar(); });
  });

  // avisos em tempo real
  if (ctx.pode.vender || papel === 'leitura') {
    desligar.push(painel.leads.aoNovoLead((lead) => {
      toast(`Novo lead chegou (${ROT.origens[lead.origem] || lead.origem}).`, 'ok');
      atualizarContadores();
    }));
  }
  atualizarContadores();
  const relogio = setInterval(atualizarContadores, 60000);
  desligar.push(() => clearInterval(relogio));

  window.addEventListener('hashchange', navegar);
  desligar.push(() => window.removeEventListener('hashchange', navegar));
  ctx.secoes = visiveis.map((s) => s.id);
  navegar();
}

async function atualizarContadores() {
  try {
    const c = await painel.contadores();
    $$('[data-badge]').forEach((b) => {
      const n = c[b.dataset.badge] || 0;
      b.textContent = n > 99 ? '99+' : String(n);
      b.hidden = n === 0;
    });
  } catch { /* contadores são opcionais */ }
}

async function navegar() {
  if (!ctx || /access_token|type=recovery/.test(location.hash)) return;
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const padrao = ctx.secoes[0];
  let id = partes[0] || padrao;
  if (!ctx.secoes.includes(id)) id = padrao;
  const secao = SECOES.find((s) => s.id === id);

  $$('.navb').forEach((a) => a.toggleAttribute('aria-current', a.dataset.secao === id));
  $$('.navb[aria-current]').forEach((a) => a.setAttribute('aria-current', 'page'));
  ctx.trilha(secao.nome);
  document.title = `${secao.nome} · Painel LS Colchões`;

  try { limpar?.(); } catch { /* ignora */ }
  limpar = null;
  const minha = ++geracao;
  const antigo = $('#conteudo');
  const el = document.createElement('div');
  el.id = 'conteudo'; el.className = 'conteudo sec-in';
  el.innerHTML = String(carregando());
  antigo.replaceWith(el);
  window.scrollTo(0, 0);

  try {
    const mod = await import(`./secoes/${id}.js`);
    const r = await mod.default(el, { ...ctx, params: partes.slice(1) });
    if (minha !== geracao) { if (typeof r === 'function') r(); return; }
    if (typeof r === 'function') limpar = r;
  } catch (err) {
    console.error(err);
    if (minha === geracao) el.innerHTML = String(h`<div class="vazio alerta-txt">Não foi possível abrir esta área: ${err.message}</div>`);
  }
}

function encerrar() {
  try { limpar?.(); } catch { /* ignora */ }
  while (desligar.length) { try { desligar.pop()(); } catch { /* ignora */ } }
  ctx = null;
}

// ---------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------
async function iniciar() {
  encerrar();
  const sessao = await auth.sessao();
  if (!sessao) return telaLogin();
  let perfil = null;
  try { perfil = await auth.perfil(); } catch (err) { console.error(err); }
  if (!perfil || !perfil.ativo) return telaSemAcesso(sessao.user.email);
  montar(perfil);
}

const veioDeRecuperacao = /type=recovery/.test(location.hash);
supabase.auth.onAuthStateChange((evento) => {
  if (evento === 'PASSWORD_RECOVERY') setTimeout(telaNovaSenha, 0);
  if (evento === 'SIGNED_OUT' && ctx) { encerrar(); telaLogin(); }
});
if (!veioDeRecuperacao) iniciar();
