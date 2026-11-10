// =====================================================================
// LS Colchões · camada de dados (site + painel)
// Todas as telas falam com o Supabase só por aqui.
// Erros viram ErroApi com mensagem em português pronta para mostrar.
// =====================================================================
import { supabase, urlMidia } from './supabase.js';
import { FUSO, DDI } from './config.js';

export { supabase, urlMidia };

// ---------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------
const MENSAGENS = {
  '42501': 'Você não tem permissão para fazer isso.',
  '23505': 'Já existe um cadastro com esses dados.',
  '23503': 'Este registro está ligado a outro e não pode ser apagado.',
  'PGRST301': 'Sua sessão expirou. Entre de novo.',
  'invalid_credentials': 'E-mail ou senha incorretos.'
};

export class ErroApi extends Error {
  constructor(mensagem, codigo, original) {
    super(mensagem);
    this.codigo = codigo;
    this.original = original;
  }
}

function ok({ data, error }) {
  if (error) {
    const codigo = error.code || error.status;
    // erros de validação das funções (22023/P0001) já vêm com texto para o cliente
    const porTexto = /invalid login credentials/i.test(error.message || '') ? MENSAGENS.invalid_credentials
      : /email not confirmed/i.test(error.message || '') ? 'Confirme seu e-mail pelo link que enviamos.'
      : /rate limit|too many/i.test(error.message || '') ? 'Muitas tentativas. Aguarde alguns minutos.'
      : /failed to fetch|network/i.test(error.message || '') ? 'Sem conexão com o servidor. Verifique a internet.' : null;
    const msg = (codigo === '22023' || codigo === 'P0001') ? error.message : (MENSAGENS[codigo] || porTexto || error.message || 'Algo deu errado. Tente de novo.');
    throw new ErroApi(msg, codigo, error);
  }
  return data;
}

const limparBusca = (t) => String(t || '').replace(/[,()%*\\]/g, ' ').trim().slice(0, 60);
const digitos = (t) => String(t || '').replace(/\D/g, '');

// ---------------------------------------------------------------------
// Datas no fuso de São Paulo (sem horário de verão desde 2019: -03:00)
// ---------------------------------------------------------------------
export function hojeSP() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export function somaDias(ymd, n) {
  const d = new Date(ymd + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function somaMeses(ymd, n) {
  const d = new Date(ymd.slice(0, 8) + '01T12:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}
export const inicioDia = (ymd) => `${ymd}T00:00:00-03:00`;

/**
 * Períodos do filtro global do painel.
 * tipo: hoje | 7d | 30d | mes | mespassado | custom (de/ate = 'AAAA-MM-DD')
 * Devolve { inicio, fim, antInicio, antFim } prontos para painel_dashboard.
 */
export function periodo(tipo = 'mes', de = null, ate = null) {
  const h = hojeSP();
  const amanha = somaDias(h, 1);
  const mes = h.slice(0, 8) + '01';
  switch (tipo) {
    case 'hoje':       return { inicio: inicioDia(h), fim: inicioDia(amanha), antInicio: null, antFim: null };
    case '7d':         return { inicio: inicioDia(somaDias(h, -6)), fim: inicioDia(amanha), antInicio: null, antFim: null };
    case '30d':        return { inicio: inicioDia(somaDias(h, -29)), fim: inicioDia(amanha), antInicio: null, antFim: null };
    // mesmo pedaço do mês anterior (ex.: 1 a 9 de nov × 1 a 9 de out)
    case 'mes':        return { inicio: inicioDia(mes), fim: inicioDia(amanha), antInicio: inicioDia(somaMeses(mes, -1)), antFim: null };
    case 'mespassado': return { inicio: inicioDia(somaMeses(mes, -1)), fim: inicioDia(mes), antInicio: inicioDia(somaMeses(mes, -2)), antFim: inicioDia(somaMeses(mes, -1)) };
    case 'custom':
      if (!de || !ate) throw new ErroApi('Escolha a data inicial e a final.');
      return { inicio: inicioDia(de), fim: inicioDia(somaDias(ate, 1)), antInicio: null, antFim: null };
    default: throw new ErroApi('Período desconhecido: ' + tipo);
  }
}

// Formatação usada nas telas
export const fmt = {
  reais: (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }),
  reaisCentavos: (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
  pct: (v) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%',
  data: (iso) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: FUSO }),
  dataHora: (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
  hora: (iso) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }),
  variacao: (atual, anterior) => (anterior ? ((atual - anterior) / anterior) * 100 : null)
};

// UTM da campanha de tráfego pago, guardada na sessão do visitante
function utmDaVisita() {
  try {
    const p = new URLSearchParams(location.search);
    const utm = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'].forEach((k) => {
      if (p.get(k)) utm[k] = p.get(k).slice(0, 120);
    });
    if (Object.keys(utm).length) sessionStorage.setItem('ls_utm', JSON.stringify(utm));
    return JSON.parse(sessionStorage.getItem('ls_utm') || 'null');
  } catch {
    return null;
  }
}

// =====================================================================
// SITE (visitante, sem login)
// =====================================================================
export const site = {
  /** Home: config, campanha, banners, destaques, depoimentos, categorias e tamanhos */
  home: () => supabase.rpc('site_home').then(ok),

  /** Catálogo com filtros. Devolve { total, itens: [card] } */
  catalogo: (f = {}) => supabase.rpc('site_catalogo', {
    p_categoria: f.categoria || null,
    p_tamanhos: f.tamanhos?.length ? f.tamanhos : null,
    p_firmezas: f.firmezas?.length ? f.firmezas : null,
    p_tipos: f.tipos?.length ? f.tipos : null,
    p_preco_min: f.precoMin ?? null,
    p_preco_max: f.precoMax ?? null,
    p_busca: f.busca || null,
    p_ordem: f.ordem || 'mais_escolhidos',
    p_limite: f.limite || 24,
    p_offset: f.offset || 0
  }).then(ok),

  /** Página de produto pelo slug (null se não existir ou estiver oculto) */
  produto: (slug) => supabase.rpc('site_produto', { p_slug: slug }).then(ok),

  /** Formulário de contato → lead no CRM. campoExtra = campo escondido anti-robô */
  enviarLead: (d) => supabase.rpc('criar_lead_site', {
    p_nome: d.nome,
    p_whatsapp: d.whatsapp,
    p_email: d.email || null,
    p_interesses: d.interesses || [],
    p_tamanho: d.tamanho || null,
    p_como_dorme: d.comoDorme || null,
    p_mensagem: d.mensagem || null,
    p_pagina: d.pagina || location.pathname,
    p_utm: utmDaVisita(),
    p_campo_extra: d.campoExtra || null
  }).then(ok),

  linkWhatsApp(numero, mensagem = '') {
    let n = digitos(numero);
    if (n && n.length <= 11) n = DDI + n;
    return `https://wa.me/${n}?text=${encodeURIComponent(mensagem)}`;
  },

  utmDaVisita,
  urlMidia
};

// =====================================================================
// LOGIN DO PAINEL
// =====================================================================
export const auth = {
  entrar: (email, senha) => supabase.auth.signInWithPassword({ email, password: senha }).then(ok),
  sair: () => supabase.auth.signOut(),
  sessao: async () => (await supabase.auth.getSession()).data.session,
  aoMudar: (cb) => supabase.auth.onAuthStateChange((_evento, sessao) => cb(sessao)),
  recuperarSenha: (email, voltarPara) => supabase.auth.resetPasswordForEmail(email, { redirectTo: voltarPara }).then(ok),
  novaSenha: (senha) => supabase.auth.updateUser({ password: senha }).then(ok),
  /** Perfil do usuário logado. null = sem login ou ainda não ativado pelo gerente */
  async perfil() {
    const s = await auth.sessao();
    if (!s) return null;
    return supabase.from('perfis').select('*').eq('id', s.user.id).maybeSingle().then(ok);
  }
};

async function meuId() {
  const s = await auth.sessao();
  return s?.user?.id || null;
}

// =====================================================================
// PAINEL
// =====================================================================
export const painel = {
  /** Visão geral. tipo = hoje | 7d | 30d | mes | mespassado | custom */
  dashboard(tipo = 'mes', de = null, ate = null) {
    const p = periodo(tipo, de, ate);
    return supabase.rpc('painel_dashboard', { p_inicio: p.inicio, p_fim: p.fim, p_ant_inicio: p.antInicio, p_ant_fim: p.antFim }).then(ok);
  },

  /** Metas e comissões do mês ('AAAA-MM-01'); vazio = mês atual */
  metas: (mes = null) => supabase.rpc('painel_metas', { p_mes: mes }).then(ok),

  equipe: () => supabase.from('perfis').select('id, nome, email, papel, ativo, comissao_percentual').order('nome').then(ok),
  /** Gerente/admin: papel, ativo, nome e % de comissão de alguém da equipe */
  salvarPerfil: (id, campos) => supabase.from('perfis').update(campos).eq('id', id).select().single().then(ok),

  /** Números do menu: leads novos, entregas de hoje e alertas de estoque */
  async contadores() {
    const h = hojeSP();
    const cont = (q) => q.then(({ count, error }) => { if (error) throw error; return count || 0; });
    const [leads, entregas, estoque] = await Promise.all([
      cont(supabase.from('leads').select('id', { count: 'exact', head: true }).eq('etapa', 'novo')),
      cont(supabase.from('entregas').select('id', { count: 'exact', head: true })
        .gte('agendada_para', inicioDia(h)).lt('agendada_para', inicioDia(somaDias(h, 1))).neq('status', 'cancelada')),
      cont(supabase.from('v_estoque').select('variacao_id', { count: 'exact', head: true }).eq('ativo', true).neq('nivel', 'ok'))
    ]);
    return { leads, entregas, estoque };
  },

  /** Campanha no ar agora (para calcular preço de campanha no painel) */
  async campanhaAtiva() {
    const c = await supabase.from('site_campanha').select('*').eq('id', 1).maybeSingle().then(ok);
    return !!(c && c.ativa && (!c.termina_em || new Date(c.termina_em) > new Date()));
  },

  catalogoBase: async () => {
    const [categorias, tamanhos, linhas] = await Promise.all([
      supabase.from('categorias').select('*').order('ordem').then(ok),
      supabase.from('tamanhos').select('*').order('ordem').then(ok),
      supabase.from('linhas').select('*').order('nome').then(ok)
    ]);
    return { categorias, tamanhos, linhas };
  },

  // ---------------- VENDAS ----------------
  vendas: {
    async listar({ status, vendedorId, forma, de, ate, busca, pagina = 0, porPagina = 20 } = {}) {
      let q = supabase.from('v_vendas').select('*', { count: 'exact' })
        .order('data_venda', { ascending: false })
        .range(pagina * porPagina, pagina * porPagina + porPagina - 1);
      if (status) q = q.eq('status', status);
      if (vendedorId) q = q.eq('vendedor_id', vendedorId);
      if (forma) q = q.eq('forma_pagamento', forma);
      if (de) q = q.gte('data_venda', inicioDia(de));
      if (ate) q = q.lt('data_venda', inicioDia(somaDias(ate, 1)));
      if (busca) q = q.ilike('cliente', `%${limparBusca(busca)}%`);
      const { data, error, count } = await q;
      return { itens: ok({ data, error }), total: count ?? 0 };
    },
    /** Quantidade por status no período (abas da lista) */
    async contagem({ de, ate } = {}) {
      let q = supabase.from('vendas').select('status');
      if (de) q = q.gte('data_venda', inicioDia(de));
      if (ate) q = q.lt('data_venda', inicioDia(somaDias(ate, 1)));
      const linhas = ok(await q);
      return linhas.reduce((acc, v) => ({ ...acc, [v.status]: (acc[v.status] || 0) + 1, todas: acc.todas + 1 }), { todas: 0 });
    },
    obter: (id) => supabase.from('v_vendas').select('*').eq('id', id).maybeSingle().then(ok),
    itens: (vendaId) => supabase.from('venda_itens').select('*').eq('venda_id', vendaId).then(ok),
    /** payload: ver comentário de registrar_venda no SQL */
    registrar: (payload) => supabase.rpc('registrar_venda', { p: payload }).then(ok),
    cancelar: (id, motivo) => supabase.rpc('cancelar_venda', { p_venda: id, p_motivo: motivo || null }).then(ok),
    alterarStatus: (id, status) => supabase.from('vendas').update({ status }).eq('id', id).select().single().then(ok)
  },

  // ---------------- CLIENTES ----------------
  clientes: {
    buscar(termo) {
      const t = limparBusca(termo);
      const d = digitos(termo);
      let q = supabase.from('clientes').select('id, nome, whatsapp, bairro, cidade').order('nome').limit(10);
      q = d.length >= 4 ? q.or(`nome.ilike.%${t}%,whatsapp_digitos.like.%${d}%`) : q.ilike('nome', `%${t}%`);
      return q.then(ok);
    },
    listar({ busca, limite = 100 } = {}) {
      let q = supabase.from('clientes').select('id, nome, whatsapp, bairro, cidade, origem, criado_em').order('criado_em', { ascending: false }).limit(limite);
      if (busca) q = q.ilike('nome', `%${limparBusca(busca)}%`);
      return q.then(ok);
    },
    ficha: (id) => supabase.rpc('painel_ficha_cliente', { p_cliente: id }).then(ok),
    salvar: (c) => supabase.from('clientes').upsert(c).select().single().then(ok)
  },

  // ---------------- CRM ----------------
  leads: {
    listar({ origem, responsavelId } = {}) {
      let q = supabase.from('v_leads').select('*').order('criado_em', { ascending: false }).limit(500);
      if (origem) q = q.eq('origem', origem);
      if (responsavelId) q = q.eq('responsavel_id', responsavelId);
      return q.then(ok);
    },
    mover: (id, etapa, motivoPerda = null) =>
      supabase.from('leads').update(etapa === 'perdido' ? { etapa, motivo_perda: motivoPerda } : { etapa }).eq('id', id).select().single().then(ok),
    atribuir: (id, responsavelId) => supabase.from('leads').update({ responsavel_id: responsavelId }).eq('id', id).then(ok),
    atualizar: (id, campos) => supabase.from('leads').update(campos).eq('id', id).then(ok),
    agendarRetorno: (id, quando) => supabase.from('leads').update({ proximo_contato: quando }).eq('id', id).then(ok),
    /** Lead manual (WhatsApp, Instagram, loja). Cria o cliente se precisar. */
    async criar({ cliente, origem = 'whatsapp', interesses = [], tamanho = null, mensagem = null, valorEstimado = null, responsavelId = null }) {
      let clienteId = cliente.id;
      if (!clienteId) {
        const novo = await painel.clientes.salvar({ nome: cliente.nome, whatsapp: cliente.whatsapp, email: cliente.email || null, origem });
        clienteId = novo.id;
      }
      const lead = await supabase.from('leads').insert({
        cliente_id: clienteId, origem, interesses, tamanho_codigo: tamanho, mensagem,
        valor_estimado: valorEstimado, responsavel_id: responsavelId || await meuId()
      }).select().single().then(ok);
      await painel.leads.anotar({ clienteId, leadId: lead.id, tipo: 'criado', texto: 'Lead cadastrado no painel · ' + origem });
      return lead;
    },
    anotar: async ({ clienteId, leadId = null, tipo = 'nota', texto }) =>
      supabase.from('lead_eventos').insert({ cliente_id: clienteId, lead_id: leadId, tipo, descricao: texto, usuario_id: await meuId() }).then(ok),
    /** Avisa na hora quando entra um lead novo (pelo site ou por outra pessoa) */
    aoNovoLead(cb) {
      const canal = supabase.channel('leads-novos-' + crypto.randomUUID().slice(0, 8))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (msg) => cb(msg.new))
        .subscribe();
      return () => supabase.removeChannel(canal);
    }
  },

  // ---------------- ENTREGAS ----------------
  entregas: {
    /** de/ate = 'AAAA-MM-DD' (inclusive) */
    periodo: (de, ate) => supabase.from('v_entregas').select('*')
      .gte('agendada_para', inicioDia(de)).lt('agendada_para', inicioDia(somaDias(ate, 1)))
      .neq('status', 'cancelada').order('agendada_para').order('ordem_rota', { nullsFirst: false }).then(ok),
    concluir: (id, feita = true) => supabase.rpc('concluir_entrega', { p_entrega: id, p_concluida: feita }).then(ok),
    salvar: (e) => supabase.from('entregas').upsert(e).select().single().then(ok),
    status: (id, status) => supabase.from('entregas').update({ status }).eq('id', id).then(ok),
    ordenarRota: (ids) => Promise.all(ids.map((id, i) => supabase.from('entregas').update({ ordem_rota: i + 1 }).eq('id', id).then(ok))),
    aoMudar(cb) {
      const canal = supabase.channel('agenda-' + crypto.randomUUID().slice(0, 8))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'entregas' }, (msg) => cb(msg))
        .subscribe();
      return () => supabase.removeChannel(canal);
    }
  },

  // ---------------- ESTOQUE ----------------
  estoque: {
    /** Linhas produto × tamanho; o painel monta a matriz */
    matriz: () => supabase.from('v_estoque').select('*').order('produto').order('tamanho_ordem').then(ok),
    movimentos: (limite = 30) => supabase.from('estoque_movimentos')
      .select('*, produto_variacoes(sku, tamanho_codigo, produtos(nome))')
      .order('criado_em', { ascending: false }).limit(limite).then(ok),
    ajustar: (variacaoId, delta, motivo) => supabase.rpc('ajustar_estoque', { p_variacao: variacaoId, p_delta: delta, p_motivo: motivo }).then(ok),
    definirMinimo: (variacaoId, minimo) => supabase.from('produto_variacoes').update({ estoque_minimo: minimo }).eq('id', variacaoId).then(ok),
    pedidos: () => supabase.from('pedidos_fabrica')
      .select('*, pedido_fabrica_itens(quantidade, produto_variacoes(sku, tamanho_codigo, produtos(nome)))')
      .order('feito_em', { ascending: false }).limit(20).then(ok),
    async criarPedido({ codigo, previsao = null, observacao = null, itens }) {
      if (!itens?.length) throw new ErroApi('Inclua pelo menos um item no pedido.');
      const pedido = await supabase.from('pedidos_fabrica')
        .insert({ codigo, previsao, observacao, criado_por: await meuId() }).select().single().then(ok);
      await supabase.from('pedido_fabrica_itens')
        .insert(itens.map((i) => ({ pedido_id: pedido.id, variacao_id: i.variacaoId, quantidade: i.quantidade }))).then(ok);
      return pedido;
    },
    statusPedido: (id, status) => supabase.from('pedidos_fabrica').update({ status }).eq('id', id).then(ok),
    receberPedido: (id) => supabase.rpc('receber_pedido_fabrica', { p_pedido: id }).then(ok)
  },

  // ---------------- METAS ----------------
  metasConfig: {
    async salvarMeta({ mes, vendedorId = null, valor }) {
      let q = supabase.from('metas').select('id').eq('mes', mes);
      q = vendedorId ? q.eq('vendedor_id', vendedorId) : q.is('vendedor_id', null);
      const existente = (await q.then(ok))[0];
      return existente
        ? supabase.from('metas').update({ valor }).eq('id', existente.id).then(ok)
        : supabase.from('metas').insert({ mes, vendedor_id: vendedorId, valor }).then(ok);
    },
    regras: () => supabase.from('regras_comissao').select('*').eq('id', 1).single().then(ok),
    salvarRegras: (r) => supabase.from('regras_comissao').update(r).eq('id', 1).then(ok),
    /** linhas = comissoes_mes_anterior vindas de painel.metas() */
    async marcarPagas(mes, linhas) {
      const eu = await meuId();
      return supabase.from('comissoes_pagas').upsert(
        linhas.map((l) => ({ mes, vendedor_id: l.vendedor_id, valor: l.comissao, pago_por: eu })),
        { onConflict: 'mes,vendedor_id' }).then(ok);
    }
  },

  // ---------------- PRODUTOS ----------------
  produtos: {
    listar: () => supabase.from('produtos')
      .select('*, categorias(nome, slug), produto_variacoes(id, tamanho_codigo, preco, preco_campanha, ativo, sku, estoque_minimo, estoque(quantidade, reservado)), produto_midias(id, caminho, tipo, capa, ordem)')
      .order('nome').then(ok),
    obter: (id) => supabase.from('produtos')
      .select('*, produto_variacoes(*, estoque(quantidade, reservado)), produto_midias(*), produto_ficha(*), produto_camadas(*)')
      .eq('id', id).single().then(ok),
    /** Salva tudo de uma vez: produto + variações + ficha + camadas */
    async salvar({ produto, variacoes = [], ficha = null, camadas = null }) {
      const salvo = await supabase.from('produtos').upsert(produto).select().single().then(ok);
      if (variacoes.length) {
        await supabase.from('produto_variacoes')
          .upsert(variacoes.map((v) => ({ ...v, produto_id: salvo.id })), { onConflict: 'produto_id,tamanho_codigo' }).then(ok);
      }
      if (ficha) {
        await supabase.from('produto_ficha').delete().eq('produto_id', salvo.id).then(ok);
        if (ficha.length) await supabase.from('produto_ficha').insert(ficha.map((f, i) => ({ produto_id: salvo.id, campo: f.campo, valor: f.valor, ordem: i }))).then(ok);
      }
      if (camadas) {
        await supabase.from('produto_camadas').delete().eq('produto_id', salvo.id).then(ok);
        if (camadas.length) await supabase.from('produto_camadas').insert(camadas.map((c, i) => ({ produto_id: salvo.id, nome: c.nome, cor: c.cor, ordem: i }))).then(ok);
      }
      return salvo;
    },
    alternarSite: (id, visivel) => supabase.from('produtos').update({ visivel_site: visivel }).eq('id', id).then(ok),
    async enviarMidia(produtoId, arquivo, { capa = false, legenda = null, ordem = 0 } = {}) {
      const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const caminho = `${produtoId}/${crypto.randomUUID()}.${ext}`;
      ok(await supabase.storage.from('produtos').upload(caminho, arquivo, { cacheControl: '31536000', upsert: false }));
      if (capa) await supabase.from('produto_midias').update({ capa: false }).eq('produto_id', produtoId).then(ok);
      return supabase.from('produto_midias').insert({
        produto_id: produtoId, caminho, legenda, ordem, capa, tipo: arquivo.type.startsWith('video') ? 'video' : 'foto'
      }).select().single().then(ok);
    },
    async removerMidia(midia) {
      await supabase.from('produto_midias').delete().eq('id', midia.id).then(ok);
      await supabase.storage.from('produtos').remove([midia.caminho]);
    },
    async definirCapa(produtoId, midiaId) {
      await supabase.from('produto_midias').update({ capa: false }).eq('produto_id', produtoId).then(ok);
      return supabase.from('produto_midias').update({ capa: true }).eq('id', midiaId).then(ok);
    },
    ordenarMidias: (ids) => Promise.all(ids.map((id, i) => supabase.from('produto_midias').update({ ordem: i }).eq('id', id).then(ok)))
  },

  // ---------------- GESTÃO DO SITE ----------------
  site: {
    async obter() {
      const [config, banners, campanha, depoimentos] = await Promise.all([
        supabase.from('site_config').select('*').eq('id', 1).single().then(ok),
        supabase.from('site_banners').select('*').order('ordem').then(ok),
        supabase.from('site_campanha').select('*').eq('id', 1).single().then(ok),
        supabase.from('site_depoimentos').select('*').order('ordem').then(ok)
      ]);
      return { config, banners, campanha, depoimentos };
    },
    salvarConfig: (c) => supabase.from('site_config').update(c).eq('id', 1).then(ok),
    salvarCampanha: (c) => supabase.from('site_campanha').update(c).eq('id', 1).then(ok),
    salvarBanner: (b) => supabase.from('site_banners').upsert(b).select().single().then(ok),
    removerBanner: (id) => supabase.from('site_banners').delete().eq('id', id).then(ok),
    ordenarBanners: (ids) => Promise.all(ids.map((id, i) => supabase.from('site_banners').update({ ordem: i + 1 }).eq('id', id).then(ok))),
    salvarDepoimento: (d) => supabase.from('site_depoimentos').upsert(d).select().single().then(ok),
    removerDepoimento: (id) => supabase.from('site_depoimentos').delete().eq('id', id).then(ok),
    async enviarMidia(arquivo, pasta = 'banners') {
      const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const caminho = `${pasta}/${crypto.randomUUID()}.${ext}`;
      ok(await supabase.storage.from('site').upload(caminho, arquivo, { cacheControl: '31536000', upsert: false }));
      return caminho;
    }
  }
};
