-- =====================================================================
-- LS Colchões · INSTALAÇÃO COMPLETA DO BANCO V2 (um arquivo só)
-- Rode no SQL Editor, de uma vez. Se der qualquer erro, nada é gravado.
-- Junta, nesta ordem: migrations 01 a 06 + seed.sql
--
-- Projeto que já tinha a tabela "produtos" do site antigo:
-- ela NÃO é apagada. É movida para o esquema "antigo" (antigo.produtos),
-- com todos os dados, para a migração. O esquema "antigo" não fica
-- exposto na API (o visitante não lê).
-- =====================================================================
create schema if not exists antigo;
revoke all on schema antigo from anon, authenticated;
do $$
begin
  if to_regclass('public.produtos') is not null and to_regclass('public.produto_variacoes') is null then
    alter table public.produtos set schema antigo;
    raise notice 'Tabela antiga "produtos" guardada em antigo.produtos';
  end if;
end $$;

-- >>>>>>>>>> migrations/20261109120000_base.sql
-- =====================================================================
-- LS Colchões · Banco v2 · 01 · Tabelas e relações
-- Rodar no SQL Editor do Supabase (ou `supabase db push`), nesta ordem:
--   01 base → 02 segurança → 03 funções → 04 storage → seed.sql
-- =====================================================================

create extension if not exists pgcrypto;

-- Atualiza a coluna atualizado_em em todo UPDATE
create or replace function public.tg_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- EQUIPE
-- ---------------------------------------------------------------------
create table public.perfis (
  id                  uuid primary key references auth.users(id) on delete cascade,
  nome                text not null default '',
  email               text,
  papel               text not null default 'vendedor'
                      check (papel in ('admin','gerente','vendedor','entregador','leitura')),
  ativo               boolean not null default false,
  comissao_percentual numeric(5,2),          -- vazio = usa a regra padrão
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
comment on table public.perfis is 'Usuários do painel. Novo usuário nasce inativo; ative com public.definir_papel().';

-- ---------------------------------------------------------------------
-- CATÁLOGO
-- ---------------------------------------------------------------------
create table public.categorias (
  id     uuid primary key default gen_random_uuid(),
  nome   text not null,
  slug   text not null unique,
  ordem  int  not null default 0,
  ativo  boolean not null default true
);

create table public.linhas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  fabricante text not null default 'Ortobom',
  ativo      boolean not null default true
);

create table public.tamanhos (
  codigo         text primary key,            -- S, SS, V, C, Q, K, U
  nome           text not null,
  largura_cm     int,
  comprimento_cm int,
  ordem          int not null default 0
);

create table public.produtos (
  id              uuid primary key default gen_random_uuid(),
  codigo          text unique,
  nome            text not null,
  slug            text not null unique,
  categoria_id    uuid references public.categorias(id) on delete set null,
  linha_id        uuid references public.linhas(id) on delete set null,
  tipo            text,                        -- molas ensacadas, bonnel, espuma, híbrido...
  descricao_curta text,
  descricao       text,
  firmeza         smallint check (firmeza between 1 and 5),
  altura_cm       numeric(5,1),
  indicado_para   text[] not null default '{}',
  selo            text check (selo in ('mais_escolhido','novidade','oferta')),
  visivel_site    boolean not null default false,
  destaque_home   boolean not null default false,
  ordem_destaque  int not null default 0,
  na_campanha     boolean not null default false,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references public.perfis(id) on delete set null
);

create table public.produto_variacoes (
  id             uuid primary key default gen_random_uuid(),
  produto_id     uuid not null references public.produtos(id) on delete cascade,
  tamanho_codigo text not null references public.tamanhos(codigo),
  sku            text unique,
  preco          numeric(12,2) not null check (preco >= 0),
  preco_campanha numeric(12,2) check (preco_campanha >= 0),
  ativo          boolean not null default true,
  estoque_minimo int not null default 1 check (estoque_minimo >= 0),
  unique (produto_id, tamanho_codigo)
);

create table public.produto_midias (
  id         uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  tipo       text not null default 'foto' check (tipo in ('foto','video')),
  caminho    text not null,                    -- caminho no bucket "produtos"
  legenda    text,
  ordem      int not null default 0,
  capa       boolean not null default false
);
create unique index produto_midias_uma_capa on public.produto_midias(produto_id) where capa;

create table public.produto_ficha (
  id         uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  campo      text not null,
  valor      text not null default '',
  ordem      int not null default 0
);

create table public.produto_camadas (
  id         uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  nome       text not null,
  cor        text,
  ordem      int not null default 0
);

-- ---------------------------------------------------------------------
-- CLIENTES E LEADS (CRM)
-- ---------------------------------------------------------------------
create table public.clientes (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  whatsapp         text,
  whatsapp_digitos text generated always as
                   (nullif(regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g'), '')) stored,
  email            text,
  cpf              text,
  cep              text,
  logradouro       text,
  numero           text,
  complemento      text,
  bairro           text,
  cidade           text default 'Lagoa Santa',
  uf               text default 'MG',
  origem           text check (origem in ('site','whatsapp','instagram','loja','indicacao','outro')),
  observacoes      text,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
create unique index clientes_whatsapp_unico on public.clientes(whatsapp_digitos) where whatsapp_digitos is not null;
create index clientes_nome_idx on public.clientes(lower(nome));

create table public.leads (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references public.clientes(id) on delete cascade,
  origem          text not null default 'site'
                  check (origem in ('site','whatsapp','instagram','loja','indicacao','outro')),
  etapa           text not null default 'novo'
                  check (etapa in ('novo','atendimento','orcamento','vendido','perdido')),
  interesses      text[] not null default '{}',
  tamanho_codigo  text references public.tamanhos(codigo),
  como_dorme      text,
  mensagem        text,
  valor_estimado  numeric(12,2),
  responsavel_id  uuid references public.perfis(id) on delete set null,
  proximo_contato timestamptz,
  motivo_perda    text,
  campanha        text,
  pagina_origem   text,
  utm             jsonb,
  venda_id        uuid,                        -- FK criada depois de vendas
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index leads_etapa_idx on public.leads(etapa);
create index leads_cliente_idx on public.leads(cliente_id);
create index leads_criado_idx on public.leads(criado_em);
create index leads_resp_idx on public.leads(responsavel_id);

create table public.lead_eventos (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid references public.leads(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo       text not null default 'nota'
             check (tipo in ('criado','etapa','mensagem','visita','orcamento','venda','nota','perda','retorno')),
  descricao  text not null,
  usuario_id uuid references public.perfis(id) on delete set null,
  criado_em  timestamptz not null default now()
);
create index lead_eventos_cliente_idx on public.lead_eventos(cliente_id, criado_em desc);

-- ---------------------------------------------------------------------
-- VENDAS
-- ---------------------------------------------------------------------
create table public.vendas (
  id                  uuid primary key default gen_random_uuid(),
  numero              bigint generated always as identity (start with 1001) unique,
  cliente_id          uuid not null references public.clientes(id) on delete restrict,
  lead_id             uuid references public.leads(id) on delete set null,
  vendedor_id         uuid references public.perfis(id) on delete set null,
  status              text not null default 'a_entregar'
                      check (status in ('aguardando_pagamento','a_entregar','entregue','cancelada')),
  subtotal            numeric(12,2) not null default 0,
  desconto            numeric(12,2) not null default 0 check (desconto >= 0),
  total               numeric(12,2) not null default 0 check (total >= 0),
  forma_pagamento     text check (forma_pagamento in ('pix','credito','debito','dinheiro','boleto','crediario','misto')),
  parcelas            smallint not null default 1 check (parcelas between 1 and 24),
  entrega_tipo        text not null default 'entrega' check (entrega_tipo in ('entrega','retirada')),
  na_campanha         boolean not null default false,
  estoque_baixado     boolean not null default false,
  observacoes         text,
  data_venda          timestamptz not null default now(),
  cancelada_em        timestamptz,
  motivo_cancelamento text,
  criado_por          uuid references public.perfis(id) on delete set null,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
create index vendas_data_idx on public.vendas(data_venda);
create index vendas_vendedor_idx on public.vendas(vendedor_id, data_venda);
create index vendas_cliente_idx on public.vendas(cliente_id);

alter table public.leads
  add constraint leads_venda_fk foreign key (venda_id) references public.vendas(id) on delete set null;

create table public.venda_itens (
  id             uuid primary key default gen_random_uuid(),
  venda_id       uuid not null references public.vendas(id) on delete cascade,
  variacao_id    uuid references public.produto_variacoes(id) on delete restrict,
  descricao      text not null,                -- foto do nome no momento da venda
  quantidade     int not null check (quantidade > 0),
  preco_tabela   numeric(12,2) not null,
  preco_unitario numeric(12,2) not null check (preco_unitario >= 0),
  total          numeric(12,2) generated always as (quantidade * preco_unitario) stored
);
create index venda_itens_venda_idx on public.venda_itens(venda_id);
create index venda_itens_variacao_idx on public.venda_itens(variacao_id);

-- ---------------------------------------------------------------------
-- ENTREGAS E AGENDA
-- ---------------------------------------------------------------------
create table public.entregas (
  id            uuid primary key default gen_random_uuid(),
  venda_id      uuid references public.vendas(id) on delete cascade,
  cliente_id    uuid references public.clientes(id) on delete set null,
  tipo          text not null default 'entrega'
                check (tipo in ('entrega','entrega_montagem','retirada','coleta','troca')),
  agendada_para timestamptz not null,
  endereco      text,
  bairro        text,
  cidade        text,
  equipe        text,
  status        text not null default 'agendada'
                check (status in ('agendada','em_rota','concluida','reagendar','cancelada')),
  ordem_rota    int,
  observacao    text,
  concluida_em  timestamptz,
  concluida_por uuid references public.perfis(id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index entregas_data_idx on public.entregas(agendada_para);
create index entregas_venda_idx on public.entregas(venda_id);

-- ---------------------------------------------------------------------
-- ESTOQUE E PEDIDOS À FÁBRICA
-- ---------------------------------------------------------------------
create table public.estoque (
  variacao_id   uuid primary key references public.produto_variacoes(id) on delete cascade,
  quantidade    int not null default 0,
  reservado     int not null default 0 check (reservado >= 0),
  atualizado_em timestamptz not null default now()
);

create table public.pedidos_fabrica (
  id            uuid primary key default gen_random_uuid(),
  codigo        text unique,
  status        text not null default 'pedido'
                check (status in ('pedido','faturado','em_transito','recebido','cancelado')),
  feito_em      date not null default current_date,
  previsao      date,
  recebido_em   date,
  observacao    text,
  criado_por    uuid references public.perfis(id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.pedido_fabrica_itens (
  id          uuid primary key default gen_random_uuid(),
  pedido_id   uuid not null references public.pedidos_fabrica(id) on delete cascade,
  variacao_id uuid not null references public.produto_variacoes(id) on delete restrict,
  quantidade  int not null check (quantidade > 0)
);

create table public.estoque_movimentos (
  id          uuid primary key default gen_random_uuid(),
  variacao_id uuid not null references public.produto_variacoes(id) on delete cascade,
  tipo        text not null check (tipo in ('entrada','saida','reserva','liberacao','ajuste')),
  quantidade  int not null,
  motivo      text,
  venda_id    uuid references public.vendas(id) on delete set null,
  pedido_id   uuid references public.pedidos_fabrica(id) on delete set null,
  usuario_id  uuid references public.perfis(id) on delete set null,
  criado_em   timestamptz not null default now()
);
create index estoque_mov_idx on public.estoque_movimentos(variacao_id, criado_em desc);

-- Toda variação nova ganha sua linha de estoque
create or replace function public.tg_variacao_estoque()
returns trigger language plpgsql as $$
begin
  insert into public.estoque (variacao_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger variacao_cria_estoque after insert on public.produto_variacoes
  for each row execute function public.tg_variacao_estoque();

-- ---------------------------------------------------------------------
-- METAS E COMISSÕES
-- ---------------------------------------------------------------------
create table public.metas (
  id            uuid primary key default gen_random_uuid(),
  mes           date not null check (extract(day from mes) = 1),
  vendedor_id   uuid references public.perfis(id) on delete cascade,   -- vazio = meta da loja
  valor         numeric(12,2) not null check (valor > 0),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index metas_mes_vendedor on public.metas
  (mes, coalesce(vendedor_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.regras_comissao (
  id                smallint primary key default 1 check (id = 1),
  percentual_padrao numeric(5,2) not null default 3,
  bonus_meta        numeric(5,2) not null default 1,
  bonus_campanha    numeric(5,2) not null default 0.5,
  dia_pagamento     smallint not null default 5 check (dia_pagamento between 1 and 28),
  atualizado_em     timestamptz not null default now()
);

create table public.comissoes_pagas (
  id          uuid primary key default gen_random_uuid(),
  mes         date not null,
  vendedor_id uuid not null references public.perfis(id) on delete cascade,
  valor       numeric(12,2) not null,
  pago_em     timestamptz not null default now(),
  pago_por    uuid references public.perfis(id) on delete set null,
  unique (mes, vendedor_id)
);

-- ---------------------------------------------------------------------
-- SITE
-- ---------------------------------------------------------------------
create table public.site_config (
  id                    smallint primary key default 1 check (id = 1),
  whatsapp              text,
  mensagem_whatsapp     text not null default 'Olá! Vim pelo site da LS Colchões e quero ajuda para escolher.',
  endereco              text,
  maps_url              text,
  horarios              jsonb not null default '{}'::jsonb,
  instagram             text default '@ls_colchoes',
  tempo_slide_ms        int not null default 6500 check (tempo_slide_ms between 3000 and 20000),
  troca_automatica      boolean not null default true,
  destaques_automaticos boolean not null default false,
  leads_destino         text not null default 'rodizio' check (leads_destino in ('rodizio','fixo')),
  leads_responsavel_id  uuid references public.perfis(id) on delete set null,
  atualizado_em         timestamptz not null default now()
);

create table public.site_banners (
  id            uuid primary key default gen_random_uuid(),
  ordem         int not null default 0,
  ativo         boolean not null default true,
  eyebrow       text,
  titulo_1      text not null,
  titulo_2      text,
  texto         text,
  botao_texto   text,
  botao_destino text not null default 'whatsapp'
                check (botao_destino in ('whatsapp','catalogo','oferta','como_chegar','url')),
  botao_url     text,
  midia_tipo    text not null default 'foto' check (midia_tipo in ('foto','video')),
  midia_caminho text,                           -- caminho no bucket "site"
  exibir_de     timestamptz,
  exibir_ate    timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.site_campanha (
  id               smallint primary key default 1 check (id = 1),
  ativa            boolean not null default false,
  nome             text,
  texto_faixa      text,
  termina_em       timestamptz,
  mostrar_contagem boolean not null default true,
  produto_id       uuid references public.produtos(id) on delete set null,
  atualizado_em    timestamptz not null default now()
);

create table public.site_depoimentos (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  texto     text not null,
  fonte     text default 'Google',
  data      date,
  publicado boolean not null default false,
  ordem     int not null default 0,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Gatilhos de atualizado_em
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['perfis','produtos','clientes','leads','vendas','entregas','estoque',
                           'pedidos_fabrica','metas','regras_comissao','site_config','site_banners','site_campanha']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function public.tg_atualizado_em()',
                   t || '_atualizado_em', t);
  end loop;
end $$;

-- >>>>>>>>>> migrations/20261109120100_seguranca.sql
-- =====================================================================
-- LS Colchões · Banco v2 · 02 · Segurança (RLS por papel)
-- Regra geral:
--   * visitante do site (anon) NÃO lê tabelas; usa só as funções site_* e criar_lead_site
--   * equipe ativa lê tudo do painel
--   * vendedor/gerente/admin registram vendas, leads, clientes e entregas
--   * entregador só atualiza entregas
--   * admin/gerente mexem em catálogo, estoque, metas, comissões e site
--   * papel "leitura" só lê
-- =====================================================================

create or replace function public.meu_papel()
returns text language sql stable security definer set search_path = public as $$
  select papel from public.perfis where id = auth.uid() and ativo
$$;

create or replace function public.eh_equipe()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and ativo)
$$;

create or replace function public.eh_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() in ('admin','gerente'), false)
$$;

create or replace function public.pode_vender()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() in ('admin','gerente','vendedor'), false)
$$;

create or replace function public.pode_entregar()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() in ('admin','gerente','vendedor','entregador'), false)
$$;

-- Liga RLS em todas as tabelas do painel
do $$
declare t text;
begin
  foreach t in array array[
    'perfis','categorias','linhas','tamanhos','produtos','produto_variacoes','produto_midias','produto_ficha',
    'produto_camadas','clientes','leads','lead_eventos','vendas','venda_itens','entregas','estoque',
    'pedidos_fabrica','pedido_fabrica_itens','estoque_movimentos','metas','regras_comissao','comissoes_pagas',
    'site_config','site_banners','site_campanha','site_depoimentos']
  loop
    execute format('alter table public.%I enable row level security', t);
    -- visitante anônimo não acessa tabela nenhuma diretamente
    execute format('revoke all on table public.%I from anon', t);
    -- leitura para a equipe
    execute format('create policy %I on public.%I for select to authenticated using (public.eh_equipe())',
                   t || '_equipe_le', t);
  end loop;
end $$;

-- Escrita: catálogo, estoque, metas, comissões e site → admin/gerente
do $$
declare t text;
begin
  foreach t in array array[
    'categorias','linhas','tamanhos','produtos','produto_variacoes','produto_midias','produto_ficha','produto_camadas',
    'estoque','pedidos_fabrica','pedido_fabrica_itens','estoque_movimentos','metas','regras_comissao','comissoes_pagas',
    'site_config','site_banners','site_campanha','site_depoimentos','perfis']
  loop
    execute format('create policy %I on public.%I for insert to authenticated with check (public.eh_admin())', t || '_admin_insere', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.eh_admin()) with check (public.eh_admin())', t || '_admin_altera', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.eh_admin())', t || '_admin_apaga', t);
  end loop;
end $$;

-- Escrita operacional: clientes, leads, eventos, vendas → quem vende; apagar → admin
do $$
declare t text;
begin
  foreach t in array array['clientes','leads','lead_eventos','vendas','venda_itens']
  loop
    execute format('create policy %I on public.%I for insert to authenticated with check (public.pode_vender())', t || '_vende_insere', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.pode_vender()) with check (public.pode_vender())', t || '_vende_altera', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.eh_admin())', t || '_admin_apaga', t);
  end loop;
end $$;

-- Entregas: quem vende agenda; entregador também atualiza
create policy entregas_insere on public.entregas for insert to authenticated with check (public.pode_vender());
create policy entregas_altera on public.entregas for update to authenticated using (public.pode_entregar()) with check (public.pode_entregar());
create policy entregas_apaga  on public.entregas for delete to authenticated using (public.eh_admin());

-- Funções: ninguém executa por padrão; liberamos uma a uma na migration 03
alter default privileges in schema public revoke execute on functions from public, anon;
revoke execute on all functions in schema public from public, anon;
grant execute on function public.meu_papel(), public.eh_equipe(), public.eh_admin(),
                          public.pode_vender(), public.pode_entregar() to authenticated;

-- >>>>>>>>>> migrations/20261109120200_funcoes.sql
-- =====================================================================
-- LS Colchões · Banco v2 · 03 · Regras de negócio (funções, gatilhos e visões)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Usuários
-- ---------------------------------------------------------------------
create or replace function public.tg_novo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists ls_novo_usuario on auth.users;
create trigger ls_novo_usuario after insert on auth.users
  for each row execute function public.tg_novo_usuario();

-- usuários que já existiam antes do banco v2 também ganham perfil (inativo)
insert into public.perfis (id, nome, email)
select u.id, coalesce(u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1)), u.email
from auth.users u
on conflict (id) do nothing;

-- Rode no SQL Editor depois de criar o usuário em Authentication:
--   select public.definir_papel('email@exemplo.com', 'admin');
create or replace function public.definir_papel(p_email text, p_papel text, p_ativo boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.eh_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if p_papel not in ('admin','gerente','vendedor','entregador','leitura') then
    raise exception 'Papel inválido: %', p_papel using errcode = '22023';
  end if;
  update public.perfis set papel = p_papel, ativo = p_ativo where lower(email) = lower(p_email);
  if not found then
    raise exception 'Usuário % não encontrado. Crie o usuário em Authentication primeiro.', p_email using errcode = '22023';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
create or replace function public.gerar_slug(p_texto text)
returns text language sql immutable as $$
  select trim(both '-' from lower(regexp_replace(
    translate(coalesce(p_texto, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'),
    '[^a-zA-Z0-9]+', '-', 'g')))
$$;

create or replace function public.tg_produto_slug()
returns trigger language plpgsql as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := public.gerar_slug(new.nome);
  else
    new.slug := public.gerar_slug(new.slug);
  end if;
  if tg_op = 'UPDATE' or new.atualizado_por is null then
    new.atualizado_por := coalesce(auth.uid(), new.atualizado_por);
  end if;
  return new;
end $$;
create trigger produtos_slug before insert or update on public.produtos
  for each row execute function public.tg_produto_slug();

create or replace function public.campanha_ativa()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select ativa and (termina_em is null or termina_em > now())
                   from public.site_campanha where id = 1), false)
$$;

create or replace function public.preco_efetivo(p_preco numeric, p_preco_campanha numeric, p_na_campanha boolean)
returns numeric language sql stable security definer set search_path = public as $$
  select case when p_na_campanha and p_preco_campanha is not null and public.campanha_ativa()
              then least(p_preco, p_preco_campanha) else p_preco end
$$;

create or replace function public.fmt_reais(p numeric)
returns text language sql immutable as $$
  select 'R$ ' || replace(replace(replace(to_char(coalesce(p, 0), 'FM999G999G990D00'), ',', '#'), '.', ','), '#', '.')
$$;

-- ---------------------------------------------------------------------
-- CRM: histórico automático quando a etapa do lead muda
-- ---------------------------------------------------------------------
create or replace function public.tg_lead_etapa()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  nomes constant jsonb := '{"novo":"Novo","atendimento":"Em atendimento","orcamento":"Orçamento enviado","vendido":"Vendido","perdido":"Perdido"}';
begin
  if new.etapa is distinct from old.etapa then
    insert into public.lead_eventos (lead_id, cliente_id, tipo, descricao, usuario_id)
    values (new.id, new.cliente_id,
            case when new.etapa = 'perdido' then 'perda' else 'etapa' end,
            'Etapa: ' || (nomes->>old.etapa) || ' → ' || (nomes->>new.etapa)
              || coalesce(' · ' || nullif(new.motivo_perda, ''), ''),
            auth.uid());
  end if;
  return new;
end $$;
create trigger leads_etapa after update of etapa on public.leads
  for each row execute function public.tg_lead_etapa();

-- ---------------------------------------------------------------------
-- SITE: formulário de contato → cliente + lead no CRM (chamado pelo visitante)
-- ---------------------------------------------------------------------
create or replace function public.criar_lead_site(
  p_nome        text,
  p_whatsapp    text,
  p_email       text    default null,
  p_interesses  text[]  default '{}',
  p_tamanho     text    default null,
  p_como_dorme  text    default null,
  p_mensagem    text    default null,
  p_pagina      text    default null,
  p_utm         jsonb   default null,
  p_campo_extra text    default null       -- campo escondido anti-robô: tem que vir vazio
) returns boolean language plpgsql volatile security definer set search_path = public as $$
declare
  v_dig     text;
  v_cliente uuid;
  v_lead    uuid;
  v_resp    uuid;
  v_cfg     public.site_config;
begin
  if coalesce(p_campo_extra, '') <> '' then return true; end if;

  p_nome := btrim(coalesce(p_nome, ''));
  v_dig  := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  if length(p_nome) < 2 or length(p_nome) > 120 then
    raise exception 'Informe seu nome.' using errcode = '22023';
  end if;
  if length(v_dig) < 10 or length(v_dig) > 13 then
    raise exception 'Informe um WhatsApp válido, com DDD.' using errcode = '22023';
  end if;
  if coalesce(p_email, '') <> '' and p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido.' using errcode = '22023';
  end if;
  if length(coalesce(p_mensagem, '')) > 2000 then
    raise exception 'Mensagem muito longa.' using errcode = '22023';
  end if;
  if p_tamanho is not null and not exists (select 1 from public.tamanhos where codigo = p_tamanho) then
    p_tamanho := null;
  end if;

  -- mesmo número mandando várias vezes: aceita em silêncio sem duplicar
  if (select count(*) from public.leads l join public.clientes c on c.id = l.cliente_id
       where c.whatsapp_digitos = v_dig and l.criado_em > now() - interval '1 hour') >= 3 then
    return true;
  end if;
  -- trava geral contra ataque de spam
  if (select count(*) from public.leads where origem = 'site' and criado_em > now() - interval '10 minutes') >= 60 then
    raise exception 'Recebemos muitos contatos agora. Tente em alguns minutos ou chame no WhatsApp.' using errcode = 'P0001';
  end if;

  select id into v_cliente from public.clientes where whatsapp_digitos = v_dig;
  if v_cliente is null then
    insert into public.clientes (nome, whatsapp, email, origem)
    values (left(p_nome, 120), p_whatsapp, nullif(p_email, ''), 'site')
    returning id into v_cliente;
  elsif coalesce(p_email, '') <> '' then
    update public.clientes set email = coalesce(email, p_email) where id = v_cliente;
  end if;

  select * into v_cfg from public.site_config where id = 1;
  if v_cfg.leads_destino = 'fixo' and v_cfg.leads_responsavel_id is not null then
    v_resp := v_cfg.leads_responsavel_id;
  else
    select p.id into v_resp
    from public.perfis p
    where p.ativo and p.papel in ('admin','gerente','vendedor')
    order by (select count(*) from public.leads l
              where l.responsavel_id = p.id and l.criado_em > now() - interval '7 days'), p.criado_em
    limit 1;
  end if;

  insert into public.leads (cliente_id, origem, etapa, interesses, tamanho_codigo, como_dorme, mensagem,
                            responsavel_id, pagina_origem, utm, campanha)
  values (v_cliente, 'site', 'novo', coalesce(p_interesses[1:8], '{}'), p_tamanho, left(p_como_dorme, 80),
          left(p_mensagem, 2000), v_resp, left(p_pagina, 200), p_utm,
          (select nome from public.site_campanha where id = 1 and public.campanha_ativa()))
  returning id into v_lead;

  insert into public.lead_eventos (lead_id, cliente_id, tipo, descricao)
  values (v_lead, v_cliente, 'criado',
          'Lead criado pelo formulário do site' || coalesce(' (' || left(p_pagina, 60) || ')', ''));
  return true;
end $$;

-- ---------------------------------------------------------------------
-- VENDAS: registrar em uma transação só
--   cria/acha o cliente → venda e itens → reserva estoque → agenda entrega
--   → marca o lead como vendido → linha do tempo do cliente
-- Exemplo de p:
-- { "cliente_id": "...", "itens": [{"variacao_id": "...", "quantidade": 1, "preco_unitario": 3890}],
--   "desconto": 200, "forma_pagamento": "credito", "parcelas": 10, "status": "a_entregar",
--   "entrega": {"tipo": "entrega_montagem", "agendada_para": "2026-11-12T09:30:00-03:00"} }
-- ---------------------------------------------------------------------
create or replace function public.registrar_venda(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_cliente     uuid := nullif(p->>'cliente_id', '')::uuid;
  v_lead        uuid := nullif(p->>'lead_id', '')::uuid;
  v_vendedor    uuid := coalesce(nullif(p->>'vendedor_id', '')::uuid, auth.uid());
  v_status      text := coalesce(nullif(p->>'status', ''), 'a_entregar');
  v_desconto    numeric := coalesce(nullif(p->>'desconto', '')::numeric, 0);
  v_ent         jsonb := p->'entrega';
  v_venda       uuid;
  v_numero      bigint;
  v_item        jsonb;
  v_var         record;
  v_cli         public.clientes;
  v_qtd         int;
  v_preco_tab   numeric;
  v_preco       numeric;
  v_subtotal    numeric := 0;
  v_campanha    boolean := false;
  v_sem_estoque jsonb := '[]'::jsonb;
  v_dig         text;
begin
  if not public.pode_vender() then
    raise exception 'Sem permissão para registrar vendas' using errcode = '42501';
  end if;
  if jsonb_typeof(p->'itens') is distinct from 'array' or jsonb_array_length(p->'itens') = 0 then
    raise exception 'Inclua pelo menos um item' using errcode = '22023';
  end if;
  if v_status not in ('a_entregar','aguardando_pagamento') then
    raise exception 'Status inicial inválido' using errcode = '22023';
  end if;

  -- cliente
  if v_cliente is null then
    if coalesce(btrim(p->'cliente'->>'nome'), '') = '' then
      raise exception 'Informe o cliente' using errcode = '22023';
    end if;
    v_dig := nullif(regexp_replace(coalesce(p->'cliente'->>'whatsapp', ''), '\D', '', 'g'), '');
    if v_dig is not null then
      select id into v_cliente from public.clientes where whatsapp_digitos = v_dig;
    end if;
    if v_cliente is null then
      insert into public.clientes (nome, whatsapp, email, cep, logradouro, numero, complemento, bairro, cidade, origem)
      values (btrim(p->'cliente'->>'nome'), p->'cliente'->>'whatsapp', nullif(p->'cliente'->>'email', ''),
              p->'cliente'->>'cep', p->'cliente'->>'logradouro', p->'cliente'->>'numero', p->'cliente'->>'complemento',
              p->'cliente'->>'bairro', coalesce(nullif(p->'cliente'->>'cidade', ''), 'Lagoa Santa'),
              coalesce(nullif(p->'cliente'->>'origem', ''), 'loja'))
      returning id into v_cliente;
    end if;
  end if;
  select * into v_cli from public.clientes where id = v_cliente;
  if not found then raise exception 'Cliente não encontrado' using errcode = '22023'; end if;

  -- se não veio lead, usa o lead aberto mais recente do cliente
  if v_lead is null then
    select id into v_lead from public.leads
    where cliente_id = v_cliente and etapa not in ('vendido','perdido')
    order by criado_em desc limit 1;
  end if;

  insert into public.vendas (cliente_id, lead_id, vendedor_id, status, desconto, forma_pagamento, parcelas,
                             entrega_tipo, observacoes, criado_por, data_venda)
  values (v_cliente, v_lead, v_vendedor, v_status, v_desconto, nullif(p->>'forma_pagamento', ''),
          coalesce(nullif(p->>'parcelas', '')::smallint, 1),
          case when v_ent->>'tipo' = 'retirada' then 'retirada' else 'entrega' end,
          nullif(p->>'observacoes', ''), auth.uid(), coalesce(nullif(p->>'data_venda', '')::timestamptz, now()))
  returning id, numero into v_venda, v_numero;

  for v_item in select * from jsonb_array_elements(p->'itens') loop
    v_qtd := coalesce(nullif(v_item->>'quantidade', '')::int, 1);
    if v_qtd <= 0 then raise exception 'Quantidade inválida' using errcode = '22023'; end if;

    select pv.id, pv.preco, pv.preco_campanha, pr.nome, pr.na_campanha, t.nome as tamanho,
           coalesce(e.quantidade - e.reservado, 0) as disponivel
      into v_var
      from public.produto_variacoes pv
      join public.produtos pr on pr.id = pv.produto_id
      join public.tamanhos t on t.codigo = pv.tamanho_codigo
      left join public.estoque e on e.variacao_id = pv.id
     where pv.id = nullif(v_item->>'variacao_id', '')::uuid;
    if not found then raise exception 'Produto ou tamanho não encontrado' using errcode = '22023'; end if;

    v_preco_tab := public.preco_efetivo(v_var.preco, v_var.preco_campanha, v_var.na_campanha);
    if v_preco_tab < v_var.preco then v_campanha := true; end if;
    v_preco := coalesce(nullif(v_item->>'preco_unitario', '')::numeric, v_preco_tab);
    if v_preco < 0 then raise exception 'Preço inválido' using errcode = '22023'; end if;

    insert into public.venda_itens (venda_id, variacao_id, descricao, quantidade, preco_tabela, preco_unitario)
    values (v_venda, v_var.id, v_var.nome || ' · ' || v_var.tamanho, v_qtd, v_preco_tab, v_preco);
    v_subtotal := v_subtotal + v_qtd * v_preco;

    if v_var.disponivel < v_qtd then
      v_sem_estoque := v_sem_estoque || jsonb_build_object(
        'descricao', v_var.nome || ' · ' || v_var.tamanho, 'disponivel', v_var.disponivel, 'pedido', v_qtd);
    end if;

    insert into public.estoque (variacao_id) values (v_var.id) on conflict do nothing;
    update public.estoque set reservado = reservado + v_qtd where variacao_id = v_var.id;
    insert into public.estoque_movimentos (variacao_id, tipo, quantidade, motivo, venda_id, usuario_id)
    values (v_var.id, 'reserva', v_qtd, 'Reservado na venda #' || v_numero, v_venda, auth.uid());
  end loop;

  if v_desconto > v_subtotal then
    raise exception 'O desconto é maior que o valor da venda' using errcode = '22023';
  end if;
  update public.vendas
     set subtotal = v_subtotal, total = v_subtotal - v_desconto, na_campanha = v_campanha
   where id = v_venda;

  -- agenda de entrega / retirada
  if v_ent is not null and coalesce(v_ent->>'agendada_para', '') <> '' then
    insert into public.entregas (venda_id, cliente_id, tipo, agendada_para, endereco, bairro, cidade, equipe, observacao)
    values (v_venda, v_cliente, coalesce(nullif(v_ent->>'tipo', ''), 'entrega'), (v_ent->>'agendada_para')::timestamptz,
            coalesce(nullif(v_ent->>'endereco', ''), nullif(concat_ws(', ', v_cli.logradouro, v_cli.numero, v_cli.complemento), '')),
            coalesce(nullif(v_ent->>'bairro', ''), v_cli.bairro), coalesce(nullif(v_ent->>'cidade', ''), v_cli.cidade),
            nullif(v_ent->>'equipe', ''), nullif(v_ent->>'observacao', ''));
  end if;

  -- CRM
  if v_lead is not null then
    update public.leads set etapa = 'vendido', venda_id = v_venda where id = v_lead;
  end if;
  insert into public.lead_eventos (lead_id, cliente_id, tipo, descricao, usuario_id)
  values (v_lead, v_cliente, 'venda',
          'Venda #' || v_numero || ' registrada · ' || public.fmt_reais(v_subtotal - v_desconto), auth.uid());

  return jsonb_build_object('id', v_venda, 'numero', v_numero, 'total', v_subtotal - v_desconto,
                            'sem_estoque', v_sem_estoque);
end $$;

create or replace function public.cancelar_venda(p_venda uuid, p_motivo text default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v  public.vendas;
  it record;
begin
  if not public.pode_vender() then raise exception 'Sem permissão' using errcode = '42501'; end if;
  select * into v from public.vendas where id = p_venda for update;
  if not found then raise exception 'Venda não encontrada' using errcode = '22023'; end if;
  if v.status = 'cancelada' then return; end if;
  if v.estoque_baixado then
    raise exception 'Esta venda já foi entregue. Registre a devolução pelo ajuste de estoque.' using errcode = '22023';
  end if;

  for it in select variacao_id, quantidade from public.venda_itens where venda_id = v.id and variacao_id is not null loop
    update public.estoque set reservado = greatest(0, reservado - it.quantidade) where variacao_id = it.variacao_id;
    insert into public.estoque_movimentos (variacao_id, tipo, quantidade, motivo, venda_id, usuario_id)
    values (it.variacao_id, 'liberacao', it.quantidade, 'Venda #' || v.numero || ' cancelada', v.id, auth.uid());
  end loop;

  update public.vendas set status = 'cancelada', cancelada_em = now(), motivo_cancelamento = p_motivo where id = v.id;
  update public.entregas set status = 'cancelada' where venda_id = v.id and status <> 'concluida';
  insert into public.lead_eventos (lead_id, cliente_id, tipo, descricao, usuario_id)
  values (v.lead_id, v.cliente_id, 'nota', 'Venda #' || v.numero || ' cancelada' || coalesce(': ' || p_motivo, ''), auth.uid());
end $$;

-- ---------------------------------------------------------------------
-- ENTREGAS: concluir dá baixa no estoque; desmarcar devolve
-- ---------------------------------------------------------------------
create or replace function public.concluir_entrega(p_entrega uuid, p_concluida boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  e  public.entregas;
  v  public.vendas;
  it record;
begin
  if not public.pode_entregar() then raise exception 'Sem permissão' using errcode = '42501'; end if;
  select * into e from public.entregas where id = p_entrega for update;
  if not found then raise exception 'Entrega não encontrada' using errcode = '22023'; end if;

  if p_concluida then
    update public.entregas set status = 'concluida', concluida_em = now(), concluida_por = auth.uid() where id = e.id;
  else
    update public.entregas set status = 'agendada', concluida_em = null, concluida_por = null where id = e.id;
  end if;

  if e.venda_id is not null and e.tipo in ('entrega','entrega_montagem','retirada') then
    select * into v from public.vendas where id = e.venda_id for update;
    if p_concluida and not v.estoque_baixado and v.status <> 'cancelada' then
      for it in select variacao_id, quantidade from public.venda_itens where venda_id = v.id and variacao_id is not null loop
        update public.estoque
           set quantidade = quantidade - it.quantidade, reservado = greatest(0, reservado - it.quantidade)
         where variacao_id = it.variacao_id;
        insert into public.estoque_movimentos (variacao_id, tipo, quantidade, motivo, venda_id, usuario_id)
        values (it.variacao_id, 'saida', -it.quantidade, 'Entregue · venda #' || v.numero, v.id, auth.uid());
      end loop;
      update public.vendas
         set estoque_baixado = true, status = case when status = 'a_entregar' then 'entregue' else status end
       where id = v.id;
    elsif not p_concluida and v.estoque_baixado then
      for it in select variacao_id, quantidade from public.venda_itens where venda_id = v.id and variacao_id is not null loop
        update public.estoque
           set quantidade = quantidade + it.quantidade, reservado = reservado + it.quantidade
         where variacao_id = it.variacao_id;
        insert into public.estoque_movimentos (variacao_id, tipo, quantidade, motivo, venda_id, usuario_id)
        values (it.variacao_id, 'ajuste', it.quantidade, 'Entrega desmarcada · venda #' || v.numero, v.id, auth.uid());
      end loop;
      update public.vendas
         set estoque_baixado = false, status = case when status = 'entregue' then 'a_entregar' else status end
       where id = v.id;
    end if;
  end if;

  return jsonb_build_object('id', e.id, 'status', case when p_concluida then 'concluida' else 'agendada' end);
end $$;

-- ---------------------------------------------------------------------
-- ESTOQUE
-- ---------------------------------------------------------------------
create or replace function public.ajustar_estoque(p_variacao uuid, p_delta int, p_motivo text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if coalesce(p_delta, 0) = 0 then return; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Informe o motivo do ajuste' using errcode = '22023'; end if;
  insert into public.estoque (variacao_id) values (p_variacao) on conflict do nothing;
  update public.estoque set quantidade = quantidade + p_delta where variacao_id = p_variacao;
  insert into public.estoque_movimentos (variacao_id, tipo, quantidade, motivo, usuario_id)
  values (p_variacao, 'ajuste', p_delta, p_motivo, auth.uid());
end $$;

create or replace function public.receber_pedido_fabrica(p_pedido uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  pf public.pedidos_fabrica;
  it record;
begin
  if not public.eh_admin() then raise exception 'Sem permissão' using errcode = '42501'; end if;
  select * into pf from public.pedidos_fabrica where id = p_pedido for update;
  if not found then raise exception 'Pedido não encontrado' using errcode = '22023'; end if;
  if pf.status in ('recebido','cancelado') then raise exception 'Este pedido já está %', pf.status using errcode = '22023'; end if;
  for it in select variacao_id, quantidade from public.pedido_fabrica_itens where pedido_id = pf.id loop
    insert into public.estoque (variacao_id) values (it.variacao_id) on conflict do nothing;
    update public.estoque set quantidade = quantidade + it.quantidade where variacao_id = it.variacao_id;
    insert into public.estoque_movimentos (variacao_id, tipo, quantidade, motivo, pedido_id, usuario_id)
    values (it.variacao_id, 'entrada', it.quantidade, 'Pedido ' || coalesce(pf.codigo, '') || ' recebido', pf.id, auth.uid());
  end loop;
  update public.pedidos_fabrica set status = 'recebido', recebido_em = current_date where id = pf.id;
end $$;

-- ---------------------------------------------------------------------
-- VISÕES DO PAINEL (respeitam o RLS de quem consulta)
-- ---------------------------------------------------------------------
create or replace view public.v_estoque with (security_invoker = true) as
select pv.id as variacao_id, p.id as produto_id, p.nome as produto, p.codigo, c.nome as categoria,
       t.codigo as tamanho_codigo, t.nome as tamanho, t.ordem as tamanho_ordem, pv.ativo,
       pv.estoque_minimo as minimo, coalesce(e.quantidade, 0) as quantidade, coalesce(e.reservado, 0) as reservado,
       coalesce(e.quantidade, 0) - coalesce(e.reservado, 0) as disponivel,
       case when coalesce(e.quantidade, 0) - coalesce(e.reservado, 0) <= 0 then 'zerado'
            when coalesce(e.quantidade, 0) - coalesce(e.reservado, 0) < pv.estoque_minimo then 'baixo'
            else 'ok' end as nivel
from public.produto_variacoes pv
join public.produtos p on p.id = pv.produto_id
left join public.categorias c on c.id = p.categoria_id
join public.tamanhos t on t.codigo = pv.tamanho_codigo
left join public.estoque e on e.variacao_id = pv.id;

create or replace view public.v_vendas with (security_invoker = true) as
select v.id, v.numero, v.data_venda, v.status, v.subtotal, v.desconto, v.total, v.forma_pagamento, v.parcelas,
       v.entrega_tipo, v.na_campanha, v.cliente_id, c.nome as cliente, c.whatsapp, v.vendedor_id, pf.nome as vendedor,
       v.lead_id, l.origem as lead_origem,
       (select string_agg(vi.descricao || case when vi.quantidade > 1 then ' (' || vi.quantidade || ' un.)' else '' end, ', ')
          from public.venda_itens vi where vi.venda_id = v.id) as itens,
       (select min(en.agendada_para) from public.entregas en where en.venda_id = v.id and en.status <> 'cancelada') as entrega_em,
       (select count(*) from public.vendas v2
         where v2.cliente_id = v.cliente_id and v2.status <> 'cancelada' and v2.data_venda <= v.data_venda) as compra_numero
from public.vendas v
join public.clientes c on c.id = v.cliente_id
left join public.perfis pf on pf.id = v.vendedor_id
left join public.leads l on l.id = v.lead_id;

create or replace view public.v_leads with (security_invoker = true) as
select l.*, c.nome as cliente, c.whatsapp, p.nome as responsavel
from public.leads l
join public.clientes c on c.id = l.cliente_id
left join public.perfis p on p.id = l.responsavel_id;

create or replace view public.v_entregas with (security_invoker = true) as
select e.*, c.nome as cliente, c.whatsapp, v.numero as venda_numero, v.status as venda_status,
       (select string_agg(vi.descricao, ', ') from public.venda_itens vi where vi.venda_id = e.venda_id) as itens
from public.entregas e
left join public.clientes c on c.id = e.cliente_id
left join public.vendas v on v.id = e.venda_id;

revoke all on public.v_estoque, public.v_vendas, public.v_leads, public.v_entregas from anon;
grant select on public.v_estoque, public.v_vendas, public.v_leads, public.v_entregas to authenticated;

-- ---------------------------------------------------------------------
-- PAINEL: ficha completa do cliente (CRM + compras + linha do tempo)
-- ---------------------------------------------------------------------
create or replace function public.painel_ficha_cliente(p_cliente uuid)
returns jsonb language sql stable security invoker set search_path = public as $$
  select case when not public.eh_equipe() then null else
    to_jsonb(c) || jsonb_build_object(
      'leads',   (select coalesce(jsonb_agg(to_jsonb(l) order by l.criado_em desc), '[]') from public.v_leads l where l.cliente_id = c.id),
      'compras', (select coalesce(jsonb_agg(to_jsonb(v) order by v.data_venda desc), '[]') from public.v_vendas v where v.cliente_id = c.id),
      'total_gasto', (select coalesce(sum(total), 0) from public.vendas where cliente_id = c.id and status <> 'cancelada'),
      'eventos', (select coalesce(jsonb_agg(jsonb_build_object('quando', e.criado_em, 'tipo', e.tipo, 'descricao', e.descricao,
                                                               'usuario', p.nome) order by e.criado_em desc), '[]')
                    from (select * from public.lead_eventos where cliente_id = c.id order by criado_em desc limit 50) e
                    left join public.perfis p on p.id = e.usuario_id)
    ) end
  from public.clientes c where c.id = p_cliente
$$;

-- ---------------------------------------------------------------------
-- PAINEL: visão geral com comparação automática com o período anterior
-- p_inicio/p_fim no fuso de São Paulo (ex.: '2026-11-01T00:00:00-03:00')
-- ---------------------------------------------------------------------
create or replace function public.painel_dashboard(p_inicio timestamptz, p_fim timestamptz,
                                                   p_ant_inicio timestamptz default null, p_ant_fim timestamptz default null)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_dur     interval := p_fim - p_inicio;
  v_ant_ini timestamptz := coalesce(p_ant_inicio, p_inicio - (p_fim - p_inicio));   -- início do período de comparação
  v_desl    interval := p_inicio - coalesce(p_ant_inicio, p_inicio - (p_fim - p_inicio));
  v_ant_fim timestamptz := coalesce(p_ant_fim, coalesce(p_ant_inicio, p_inicio - (p_fim - p_inicio)) + (p_fim - p_inicio));
  v_passo   interval := case when p_fim - p_inicio <= interval '1 day' then interval '1 hour' else interval '1 day' end;
  v_hoje    date := (now() at time zone 'America/Sao_Paulo')::date;
  r         jsonb;
begin
  if not public.eh_equipe() then raise exception 'Sem acesso ao painel' using errcode = '42501'; end if;
  if p_fim <= p_inicio or v_dur > interval '400 days' then raise exception 'Período inválido' using errcode = '22023'; end if;

  with
  atual as (select * from public.vendas where status <> 'cancelada' and data_venda >= p_inicio and data_venda < p_fim),
  ant   as (select * from public.vendas where status <> 'cancelada' and data_venda >= v_ant_ini and data_venda < v_ant_fim),
  ld    as (select * from public.leads where criado_em >= p_inicio and criado_em < p_fim),
  ld_a  as (select * from public.leads where criado_em >= v_ant_ini and criado_em < v_ant_fim),
  k as (
    select (select coalesce(sum(total), 0) from atual) as fat, (select count(*) from atual) as nv,
           (select coalesce(sum(total), 0) from ant) as fat_a, (select count(*) from ant) as nv_a,
           (select count(*) from ld) as nl, (select count(*) from ld_a) as nl_a,
           (select count(*) from ld where etapa = 'vendido') as nlv, (select count(*) from ld_a where etapa = 'vendido') as nlv_a
  ),
  baldes as (
    select g as ini, row_number() over (order by g) as idx
    from generate_series(p_inicio, p_fim - interval '1 second', v_passo) g
  ),
  serie as (
    select b.idx, b.ini,
           (select coalesce(sum(a.total), 0) from atual a where a.data_venda >= b.ini and a.data_venda < b.ini + v_passo) as atual,
           (select coalesce(sum(a.total), 0) from ant a where a.data_venda >= b.ini - v_desl and a.data_venda < b.ini - v_desl + v_passo) as anterior
    from baldes b
  ),
  itens as (
    select vi.quantidade, vi.total, vi.descricao, pv.tamanho_codigo, pr.nome as produto
    from public.venda_itens vi
    join atual a on a.id = vi.venda_id
    left join public.produto_variacoes pv on pv.id = vi.variacao_id
    left join public.produtos pr on pr.id = pv.produto_id
  ),
  top_prod as (select coalesce(produto, descricao) as nome, sum(quantidade) as qtd, sum(total) as receita
               from itens group by 1 order by 2 desc, 3 desc limit 5),
  top_tam  as (select t.nome, t.ordem, sum(i.quantidade) as qtd from itens i join public.tamanhos t on t.codigo = i.tamanho_codigo
               group by t.nome, t.ordem order by 3 desc limit 6),
  vendedores as (
    select p.id, p.nome, count(a.id) as nv, coalesce(sum(a.total), 0) as fat,
           (select count(*) from ld where ld.responsavel_id = p.id) as leads,
           (select count(*) from ld where ld.responsavel_id = p.id and ld.etapa = 'vendido') as leads_v
    from public.perfis p
    left join atual a on a.vendedor_id = p.id
    where p.papel in ('admin','gerente','vendedor')
    group by p.id, p.nome, p.ativo
    having p.ativo or count(a.id) > 0
  ),
  origens as (select origem, count(*) as n, count(*) filter (where etapa = 'vendido') as v from ld group by origem)
  select jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim, 'anterior_inicio', v_ant_ini, 'por_hora', v_passo = interval '1 hour'),
    'kpis', (select jsonb_build_object(
        'faturamento', fat, 'faturamento_anterior', fat_a,
        'vendas', nv, 'vendas_anterior', nv_a,
        'ticket', case when nv > 0 then round(fat / nv, 2) else 0 end,
        'ticket_anterior', case when nv_a > 0 then round(fat_a / nv_a, 2) else 0 end,
        'leads', nl, 'leads_anterior', nl_a,
        'conversao', case when nl > 0 then round(nlv::numeric * 100 / nl, 1) else 0 end,
        'conversao_anterior', case when nl_a > 0 then round(nlv_a::numeric * 100 / nl_a, 1) else 0 end) from k),
    'serie', (select coalesce(jsonb_agg(jsonb_build_object('inicio', ini, 'atual', atual, 'anterior', anterior) order by idx), '[]') from serie),
    'funil', (select jsonb_build_object(
        'recebidos', count(*),
        'atendimento', count(*) filter (where etapa in ('atendimento','orcamento','vendido')),
        'orcamento', count(*) filter (where etapa in ('orcamento','vendido')),
        'vendidos', count(*) filter (where etapa = 'vendido'),
        'perdidos', count(*) filter (where etapa = 'perdido')) from ld),
    'origens', (select coalesce(jsonb_agg(jsonb_build_object('origem', origem, 'leads', n,
                  'conversao', case when n > 0 then round(v::numeric * 100 / n) else 0 end) order by n desc), '[]') from origens),
    'mais_vendidos', (select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'quantidade', qtd, 'receita', receita) order by qtd desc, receita desc), '[]') from top_prod),
    'tamanhos', (select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'quantidade', qtd) order by qtd desc), '[]') from top_tam),
    'vendedores', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'vendas', nv, 'faturamento', fat,
                    'ticket', case when nv > 0 then round(fat / nv, 2) else 0 end,
                    'conversao', case when leads > 0 then round(leads_v::numeric * 100 / leads) end) order by fat desc), '[]') from vendedores),
    'ultimas_vendas', (select coalesce(jsonb_agg(to_jsonb(u) order by u.data_venda desc), '[]')
                        from (select id, numero, data_venda, cliente, itens, vendedor, total, status
                              from public.v_vendas order by data_venda desc limit 6) u),
    'entregas_hoje', (select coalesce(jsonb_agg(to_jsonb(e) order by e.agendada_para), '[]')
                       from (select id, agendada_para, cliente, bairro, tipo, itens, status, venda_numero
                             from public.v_entregas
                             where (agendada_para at time zone 'America/Sao_Paulo')::date = v_hoje and status <> 'cancelada') e),
    'alertas_estoque', (select coalesce(jsonb_agg(to_jsonb(s) order by s.disponivel, s.produto), '[]')
                         from (select produto, tamanho, disponivel, minimo, nivel from public.v_estoque
                               where ativo and nivel <> 'ok' order by disponivel, produto limit 6) s)
  ) into r;
  return r;
end $$;

-- ---------------------------------------------------------------------
-- METAS E COMISSÕES
-- Vendedor enxerga só a própria linha; admin, gerente e leitura enxergam todos
-- ---------------------------------------------------------------------
create or replace function public.comissoes_do_mes(p_mes date)
returns table (vendedor_id uuid, nome text, meta numeric, realizado numeric, vendas bigint,
               campanha numeric, taxa_base numeric, taxa numeric, comissao numeric)
language sql stable security invoker set search_path = public as $$
  with rg as (select * from public.regras_comissao where id = 1),
  lim as (
    select date_trunc('month', p_mes)::date as mes,
           (date_trunc('month', p_mes)::timestamp at time zone 'America/Sao_Paulo') as ini,
           ((date_trunc('month', p_mes) + interval '1 month')::timestamp at time zone 'America/Sao_Paulo') as fim
  ),
  base as (
    select p.id, p.nome, p.comissao_percentual,
           (select m.valor from public.metas m where m.mes = lim.mes and m.vendedor_id = p.id) as meta,
           coalesce(sum(v.total), 0) as realizado,
           count(v.id) as vendas,
           coalesce(sum(v.total) filter (where v.na_campanha), 0) as campanha
    from public.perfis p
    cross join lim
    left join public.vendas v on v.vendedor_id = p.id and v.status <> 'cancelada'
                             and v.data_venda >= lim.ini and v.data_venda < lim.fim
    where p.papel in ('admin','gerente','vendedor')
      and (public.eh_admin() or public.meu_papel() = 'leitura' or p.id = auth.uid())
    group by p.id, p.nome, p.comissao_percentual, p.ativo, lim.mes
    having p.ativo or count(v.id) > 0
  )
  select b.id, b.nome, b.meta, b.realizado, b.vendas, b.campanha,
         coalesce(b.comissao_percentual, rg.percentual_padrao),
         coalesce(b.comissao_percentual, rg.percentual_padrao)
           + case when b.meta is not null and b.realizado >= b.meta then rg.bonus_meta else 0 end,
         round(b.realizado * (coalesce(b.comissao_percentual, rg.percentual_padrao)
           + case when b.meta is not null and b.realizado >= b.meta then rg.bonus_meta else 0 end) / 100
           + b.campanha * rg.bonus_campanha / 100, 2)
  from base b cross join rg
$$;

create or replace function public.painel_metas(p_mes date default null)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_hoje  date := (now() at time zone 'America/Sao_Paulo')::date;
  v_mes   date := date_trunc('month', coalesce(p_mes, v_hoje))::date;
  v_dias  int  := extract(day from (v_mes + interval '1 month' - interval '1 day'))::int;
  v_ini   timestamptz := (v_mes::timestamp at time zone 'America/Sao_Paulo');
  v_fim   timestamptz := ((v_mes + interval '1 month')::timestamp at time zone 'America/Sao_Paulo');
  v_todos boolean := public.eh_admin() or public.meu_papel() = 'leitura';
  v_dia   int;
  rg      public.regras_comissao;
  r       jsonb;
begin
  if not public.eh_equipe() then raise exception 'Sem acesso ao painel' using errcode = '42501'; end if;
  select * into rg from public.regras_comissao where id = 1;
  v_dia := case when v_hoje < v_mes then 0
                when v_hoje >= (v_mes + interval '1 month')::date then v_dias
                else extract(day from v_hoje)::int end;

  with c as (select * from public.comissoes_do_mes(v_mes)),
  pj as (
    select c.*,
           case when v_dia > 0 then c.realizado / v_dia * v_dias else 0 end as proj,
           case when v_dia > 0 then c.campanha / v_dia * v_dias else 0 end as proj_camp
    from c
  ),
  loja as (
    select coalesce(sum(total), 0) as realizado, count(*) as vendas
    from public.vendas where status <> 'cancelada' and data_venda >= v_ini and data_venda < v_fim
  )
  select jsonb_build_object(
    'mes', v_mes, 'dias_no_mes', v_dias, 'dia_atual', v_dia,
    'esperado', case when v_dias > 0 then round(v_dia::numeric / v_dias, 4) else 0 end,
    'regras', to_jsonb(rg),
    'loja', case when v_todos then (select jsonb_build_object(
              'meta', (select valor from public.metas where mes = v_mes and vendedor_id is null),
              'realizado', realizado, 'vendas', vendas,
              'projecao', case when v_dia > 0 then round(realizado / v_dia * v_dias, 2) else 0 end) from loja) end,
    'vendedores', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', vendedor_id, 'nome', nome, 'meta', meta, 'realizado', realizado, 'vendas', vendas,
        'ticket', case when vendas > 0 then round(realizado / vendas, 2) else 0 end,
        'taxa', taxa, 'comissao_agora', comissao,
        'projecao', round(proj, 2),
        'comissao_projetada', round(proj * (taxa_base + case when meta is not null and proj >= meta then rg.bonus_meta else 0 end) / 100
                                    + proj_camp * rg.bonus_campanha / 100, 2),
        'bate_meta', meta is not null and proj >= meta) order by realizado desc), '[]') from pj),
    'historico', (select coalesce(jsonb_agg(jsonb_build_object(
        'mes', g::date,
        'realizado', (select coalesce(sum(x.realizado), 0) from public.comissoes_do_mes(g::date) x),
        'meta', case when v_todos then (select valor from public.metas where mes = g::date and vendedor_id is null)
                     else (select valor from public.metas where mes = g::date and vendedor_id = auth.uid()) end) order by g), '[]')
        from generate_series(v_mes - interval '5 months', v_mes::timestamp, interval '1 month') g),
    'comissoes_mes_anterior', (select coalesce(jsonb_agg(jsonb_build_object(
        'vendedor_id', x.vendedor_id, 'nome', x.nome, 'realizado', x.realizado, 'meta', x.meta, 'taxa', x.taxa, 'comissao', x.comissao,
        'pago', exists (select 1 from public.comissoes_pagas cp
                        where cp.mes = (v_mes - interval '1 month')::date and cp.vendedor_id = x.vendedor_id)) order by x.realizado desc), '[]')
        from public.comissoes_do_mes((v_mes - interval '1 month')::date) x)
  ) into r;
  return r;
end $$;

-- ---------------------------------------------------------------------
-- SITE PÚBLICO (únicas portas abertas para o visitante)
-- ---------------------------------------------------------------------
create or replace function public.site_card(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'slug', p.slug, 'nome', p.nome, 'tipo', p.tipo, 'categoria', c.nome, 'categoria_slug', c.slug,
    'firmeza', p.firmeza, 'selo', p.selo, 'altura_cm', p.altura_cm,
    'na_campanha', p.na_campanha and public.campanha_ativa(),
    'preco_a_partir', (select min(public.preco_efetivo(v.preco, v.preco_campanha, p.na_campanha))
                         from public.produto_variacoes v where v.produto_id = p.id and v.ativo),
    'preco_normal_a_partir', (select min(v.preco) from public.produto_variacoes v where v.produto_id = p.id and v.ativo),
    'tamanhos', (select coalesce(jsonb_agg(v.tamanho_codigo order by t.ordem), '[]')
                   from public.produto_variacoes v join public.tamanhos t on t.codigo = v.tamanho_codigo
                  where v.produto_id = p.id and v.ativo),
    'capa', (select m.caminho from public.produto_midias m
              where m.produto_id = p.id and m.tipo = 'foto' order by m.capa desc, m.ordem limit 1)
  )
  from public.produtos p left join public.categorias c on c.id = p.categoria_id
  where p.id = p_id
$$;

create or replace function public.site_home()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'config', (select jsonb_build_object('whatsapp', whatsapp, 'mensagem_whatsapp', mensagem_whatsapp, 'endereco', endereco,
                 'maps_url', maps_url, 'horarios', horarios, 'instagram', instagram,
                 'tempo_slide_ms', tempo_slide_ms, 'troca_automatica', troca_automatica)
               from public.site_config where id = 1),
    'campanha', (select case when public.campanha_ativa() then jsonb_build_object(
                   'nome', nome, 'texto_faixa', texto_faixa, 'termina_em', termina_em, 'mostrar_contagem', mostrar_contagem,
                   'produto', (select public.site_card(pp.id) from public.produtos pp where pp.id = sc.produto_id and pp.visivel_site))
                 end from public.site_campanha sc where id = 1),
    'banners', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'eyebrow', eyebrow, 'titulo_1', titulo_1, 'titulo_2', titulo_2,
                  'texto', texto, 'botao_texto', botao_texto, 'botao_destino', botao_destino, 'botao_url', botao_url,
                  'midia_tipo', midia_tipo, 'midia_caminho', midia_caminho) order by ordem), '[]')
                from public.site_banners
                where ativo and (exibir_de is null or exibir_de <= now()) and (exibir_ate is null or exibir_ate > now())),
    'destaques', case when (select destaques_automaticos from public.site_config where id = 1) then
                   (select coalesce(jsonb_agg(public.site_card(x.id) order by x.qtd desc, x.nome), '[]') from (
                      select p.id, p.nome, coalesce(sum(vi.quantidade) filter (where v.id is not null), 0) as qtd
                      from public.produtos p
                      left join public.produto_variacoes pv on pv.produto_id = p.id
                      left join public.venda_itens vi on vi.variacao_id = pv.id
                      left join public.vendas v on v.id = vi.venda_id and v.status <> 'cancelada'
                                               and v.data_venda > now() - interval '30 days'
                      where p.visivel_site group by p.id, p.nome order by 3 desc, 2 limit 4) x)
                 else
                   (select coalesce(jsonb_agg(public.site_card(x.id) order by x.ordem_destaque, x.nome), '[]') from (
                      select id, nome, ordem_destaque from public.produtos
                      where visivel_site and destaque_home order by ordem_destaque, nome limit 8) x)
                 end,
    'depoimentos', (select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'texto', texto, 'fonte', fonte, 'data', data) order by ordem), '[]')
                    from public.site_depoimentos where publicado),
    'categorias', (select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'slug', slug) order by ordem), '[]')
                   from public.categorias where ativo),
    'tamanhos', (select coalesce(jsonb_agg(jsonb_build_object('codigo', codigo, 'nome', nome, 'largura_cm', largura_cm,
                   'comprimento_cm', comprimento_cm) order by ordem), '[]') from public.tamanhos where largura_cm is not null)
  )
$$;

create or replace function public.site_catalogo(
  p_categoria text    default null,
  p_tamanhos  text[]  default null,
  p_firmezas  int[]   default null,
  p_tipos     text[]  default null,
  p_preco_min numeric default null,
  p_preco_max numeric default null,
  p_busca     text    default null,
  p_ordem     text    default 'mais_escolhidos',
  p_limite    int     default 24,
  p_offset    int     default 0
) returns jsonb language sql stable security definer set search_path = public as $$
  with base as (
    select p.id, p.nome, p.firmeza, p.criado_em,
           (select min(public.preco_efetivo(v.preco, v.preco_campanha, p.na_campanha))
              from public.produto_variacoes v
             where v.produto_id = p.id and v.ativo
               and (p_tamanhos is null or v.tamanho_codigo = any(p_tamanhos))) as preco,
           (select coalesce(sum(vi.quantidade), 0)
              from public.venda_itens vi
              join public.produto_variacoes v on v.id = vi.variacao_id
              join public.vendas vd on vd.id = vi.venda_id
             where v.produto_id = p.id and vd.status <> 'cancelada'
               and vd.data_venda > now() - interval '90 days') as vendidos
    from public.produtos p
    left join public.categorias c on c.id = p.categoria_id
    where p.visivel_site
      and (p_categoria is null or c.slug = p_categoria)
      and (p_firmezas is null or p.firmeza = any(p_firmezas))
      and (p_tipos is null or p.tipo = any(p_tipos))
      and (p_busca is null or btrim(p_busca) = '' or p.nome ilike '%' || left(btrim(p_busca), 60) || '%')
  ),
  filtrado as (
    select * from base
    where preco is not null
      and (p_preco_min is null or preco >= p_preco_min)
      and (p_preco_max is null or preco <= p_preco_max)
  ),
  ordenado as (
    select f.id, row_number() over (order by
             case when p_ordem = 'menor_preco' then f.preco end asc,
             case when p_ordem = 'maior_preco' then f.preco end desc,
             case when p_ordem = 'mais_firmes' then f.firmeza end desc nulls last,
             case when p_ordem = 'mais_macios' then f.firmeza end asc nulls last,
             case when p_ordem = 'novidades' then f.criado_em end desc,
             f.vendidos desc, f.nome) as rn
    from filtrado f
  )
  select jsonb_build_object(
    'total', (select count(*) from filtrado),
    'itens', (select coalesce(jsonb_agg(public.site_card(o.id) order by o.rn), '[]') from ordenado o
              where o.rn > greatest(coalesce(p_offset, 0), 0)
                and o.rn <= greatest(coalesce(p_offset, 0), 0) + least(greatest(coalesce(p_limite, 24), 1), 60))
  )
$$;

create or replace function public.site_produto(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.site_card(p.id) || jsonb_build_object(
    'codigo', p.codigo, 'descricao_curta', p.descricao_curta, 'descricao', p.descricao, 'indicado_para', p.indicado_para,
    'linha', l.nome, 'fabricante', coalesce(l.fabricante, 'Ortobom'),
    'variacoes', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', v.id, 'tamanho_codigo', v.tamanho_codigo, 'tamanho', t.nome,
                    'largura_cm', t.largura_cm, 'comprimento_cm', t.comprimento_cm,
                    'preco', public.preco_efetivo(v.preco, v.preco_campanha, p.na_campanha), 'preco_normal', v.preco,
                    'pronta_entrega', coalesce(e.quantidade - e.reservado, 0) > 0) order by t.ordem), '[]')
                  from public.produto_variacoes v
                  join public.tamanhos t on t.codigo = v.tamanho_codigo
                  left join public.estoque e on e.variacao_id = v.id
                  where v.produto_id = p.id and v.ativo),
    'midias', (select coalesce(jsonb_agg(jsonb_build_object('tipo', m.tipo, 'caminho', m.caminho, 'legenda', m.legenda)
                 order by m.capa desc, m.ordem), '[]') from public.produto_midias m where m.produto_id = p.id),
    'ficha', (select coalesce(jsonb_agg(jsonb_build_object('campo', f.campo, 'valor', f.valor) order by f.ordem), '[]')
              from public.produto_ficha f where f.produto_id = p.id),
    'camadas', (select coalesce(jsonb_agg(jsonb_build_object('nome', k.nome, 'cor', k.cor) order by k.ordem), '[]')
                from public.produto_camadas k where k.produto_id = p.id),
    'relacionados', (select coalesce(jsonb_agg(public.site_card(r.id)), '[]') from (
                       select id from public.produtos r
                       where r.visivel_site and r.id <> p.id and r.categoria_id is not distinct from p.categoria_id
                       order by r.destaque_home desc, r.nome limit 4) r)
  )
  from public.produtos p
  left join public.linhas l on l.id = p.linha_id
  where p.slug = p_slug and p.visivel_site
$$;

-- ---------------------------------------------------------------------
-- TEMPO REAL: o painel recebe na hora os leads novos e mudanças na agenda
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.leads, public.entregas;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- PERMISSÕES DE EXECUÇÃO
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;

grant execute on function
  public.site_home(), public.site_produto(text),
  public.site_catalogo(text, text[], int[], text[], numeric, numeric, text, text, int, int),
  public.criar_lead_site(text, text, text, text[], text, text, text, text, jsonb, text)
to anon, authenticated;

grant execute on function
  public.meu_papel(), public.eh_equipe(), public.eh_admin(), public.pode_vender(), public.pode_entregar(),
  public.campanha_ativa(), public.preco_efetivo(numeric, numeric, boolean), public.fmt_reais(numeric), public.gerar_slug(text),
  public.definir_papel(text, text, boolean),
  public.registrar_venda(jsonb), public.cancelar_venda(uuid, text), public.concluir_entrega(uuid, boolean),
  public.ajustar_estoque(uuid, int, text), public.receber_pedido_fabrica(uuid),
  public.painel_ficha_cliente(uuid), public.painel_dashboard(timestamptz, timestamptz, timestamptz, timestamptz),
  public.comissoes_do_mes(date), public.painel_metas(date)
to authenticated;

-- >>>>>>>>>> migrations/20261109120300_storage.sql
-- =====================================================================
-- LS Colchões · Banco v2 · 04 · Arquivos (fotos e vídeos)
--   produtos → fotos/vídeos dos produtos   (leitura pública)
--   site     → banners e mídias do site    (leitura pública)
-- Só admin/gerente envia, troca ou apaga.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('produtos', 'produtos', true, 10485760, array['image/jpeg','image/png','image/webp','video/mp4']),
  ('site',     'site',     true, 52428800, array['image/jpeg','image/png','image/webp','video/mp4'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy ls_midias_equipe_le on storage.objects
  for select to authenticated using (bucket_id in ('produtos','site') and public.eh_equipe());

create policy ls_midias_admin_envia on storage.objects
  for insert to authenticated with check (bucket_id in ('produtos','site') and public.eh_admin());

create policy ls_midias_admin_troca on storage.objects
  for update to authenticated using (bucket_id in ('produtos','site') and public.eh_admin())
  with check (bucket_id in ('produtos','site') and public.eh_admin());

create policy ls_midias_admin_apaga on storage.objects
  for delete to authenticated using (bucket_id in ('produtos','site') and public.eh_admin());

-- >>>>>>>>>> migrations/20261110120000_trafego.sql
-- =====================================================================
-- LS Colchões · Banco v2 · 05 · Tráfego pago e qualidade do atendimento
-- * campanhas de tráfego (Meta, Google) com investimento por mês
-- * campanha de cada lead pelo link do anúncio (UTM) ou escolhida no painel
-- * cliques no WhatsApp do site por campanha
-- * motivo de perda padronizado, tentativas sem resposta e tempo de 1º contato
-- Pode rodar num banco que já tem o v2 (não apaga nada).
-- =====================================================================

-- ---------------------------------------------------------------------
-- CAMPANHAS
-- ---------------------------------------------------------------------
create table if not exists public.campanhas_trafego (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  codigo        text not null unique,          -- o utm_campaign usado no anúncio
  plataforma    text not null default 'meta' check (plataforma in ('meta','google','outra')),
  ativa         boolean not null default true,
  inicio        date,
  fim           date,
  observacao    text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.campanha_investimentos (
  id          uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas_trafego(id) on delete cascade,
  mes         date not null check (extract(day from mes) = 1),
  valor       numeric(12,2) not null check (valor >= 0),
  unique (campanha_id, mes)
);

create table if not exists public.site_eventos (
  id          bigint generated always as identity primary key,
  tipo        text not null check (tipo in ('whatsapp')),
  pagina      text,
  campanha_id uuid references public.campanhas_trafego(id) on delete set null,
  utm         jsonb,
  visitante   text,                             -- hash diário, não guarda IP
  criado_em   timestamptz not null default now()
);
create index if not exists site_eventos_criado_idx on public.site_eventos(criado_em);

-- ---------------------------------------------------------------------
-- LEADS: novas colunas
-- ---------------------------------------------------------------------
alter table public.leads add column if not exists campanha_trafego_id uuid references public.campanhas_trafego(id) on delete set null;
alter table public.leads add column if not exists motivo_categoria text;
alter table public.leads add column if not exists primeiro_contato_em timestamptz;
alter table public.leads add column if not exists tentativas int not null default 0;
alter table public.leads add column if not exists ultima_tentativa_em timestamptz;
do $$ begin
  alter table public.leads add constraint leads_motivo_categoria_ck
    check (motivo_categoria in ('preco','prazo','sem_resposta','concorrente','desconhecido'));
exception when duplicate_object then null; end $$;
create index if not exists leads_campanha_trafego_idx on public.leads(campanha_trafego_id);

-- leads antigos que já saíram de "Novo" contam como contatados
update public.leads set primeiro_contato_em = atualizado_em
 where primeiro_contato_em is null and etapa <> 'novo';
update public.leads set motivo_categoria = 'desconhecido'
 where etapa = 'perdido' and motivo_categoria is null;

do $$ begin
  create trigger campanhas_trafego_atualizado_em before update on public.campanhas_trafego
    for each row execute function public.tg_atualizado_em();
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- UTM → campanha (cria a campanha sozinha na primeira vez que aparece)
-- ---------------------------------------------------------------------
create or replace function public.campanha_por_utm(p_utm jsonb)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  v_fonte text := lower(coalesce(p_utm->>'utm_source', ''));
  v_cod   text;
  v_plat  text;
  v_id    uuid;
begin
  if p_utm is null then return null; end if;
  v_plat := case
    when v_fonte in ('facebook','fb','ig','instagram','meta','an','msg','messenger') then 'meta'
    when v_fonte in ('google','adwords','gads','youtube','yt') then 'google'
    when p_utm ? 'gclid' then 'google'
    when p_utm ? 'fbclid' then 'meta'
    else 'outra' end;
  v_cod := lower(btrim(coalesce(p_utm->>'utm_campaign', '')));
  if v_cod = '' then
    if p_utm ? 'gclid' then v_cod := 'google-sem-nome';
    elsif p_utm ? 'fbclid' or v_plat = 'meta' then v_cod := 'meta-sem-nome';
    elsif v_fonte <> '' then v_cod := v_fonte || '-sem-nome';
    else return null; end if;
  end if;
  v_cod := left(v_cod, 80);
  select id into v_id from public.campanhas_trafego where codigo = v_cod;
  if v_id is null then
    insert into public.campanhas_trafego (nome, codigo, plataforma, inicio)
    values (v_cod, v_cod, v_plat, (now() at time zone 'America/Sao_Paulo')::date)
    on conflict (codigo) do nothing
    returning id into v_id;
    if v_id is null then select id into v_id from public.campanhas_trafego where codigo = v_cod; end if;
  end if;
  return v_id;
end $$;

create or replace function public.tg_lead_campanha()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.campanha_trafego_id is null and new.utm is not null then
    new.campanha_trafego_id := public.campanha_por_utm(new.utm);
  end if;
  return new;
end $$;
drop trigger if exists leads_campanha on public.leads;
create trigger leads_campanha before insert on public.leads
  for each row execute function public.tg_lead_campanha();

-- 1º contato: quando sai de "Novo" ou quando registra tentativa
create or replace function public.tg_lead_contato()
returns trigger language plpgsql as $$
begin
  if new.primeiro_contato_em is null and (new.etapa <> 'novo' or new.tentativas > 0) then
    new.primeiro_contato_em := now();
  end if;
  if new.etapa = 'perdido' and new.motivo_categoria is null then
    new.motivo_categoria := 'desconhecido';
  end if;
  if new.etapa <> 'perdido' then new.motivo_categoria := null; end if;
  return new;
end $$;
drop trigger if exists leads_contato on public.leads;
create trigger leads_contato before insert or update on public.leads
  for each row execute function public.tg_lead_contato();

-- a linha do tempo mostra o motivo padronizado
create or replace function public.tg_lead_etapa()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  nomes constant jsonb := '{"novo":"Novo","atendimento":"Em atendimento","orcamento":"Orçamento enviado","vendido":"Vendido","perdido":"Perdido"}';
  motivos constant jsonb := '{"preco":"preço/valor","prazo":"prazo de entrega","sem_resposta":"não respondeu","concorrente":"comprou em outro lugar","desconhecido":"motivo desconhecido"}';
begin
  if new.etapa is distinct from old.etapa then
    insert into public.lead_eventos (lead_id, cliente_id, tipo, descricao, usuario_id)
    values (new.id, new.cliente_id,
            case when new.etapa = 'perdido' then 'perda' else 'etapa' end,
            'Etapa: ' || (nomes->>old.etapa) || ' → ' || (nomes->>new.etapa)
              || case when new.etapa = 'perdido' then coalesce(' · ' || (motivos->>new.motivo_categoria), '') else '' end
              || coalesce(' · ' || nullif(new.motivo_perda, ''), ''),
            auth.uid());
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- AÇÕES DO VENDEDOR
-- ---------------------------------------------------------------------
-- "Tentei contato e não respondeu"
create or replace function public.lead_sem_resposta(p_lead uuid)
returns int language plpgsql volatile security invoker set search_path = public as $$
declare v_n int; v_cli uuid;
begin
  if not public.pode_vender() then raise exception 'Sem permissão' using errcode = '42501'; end if;
  update public.leads
     set tentativas = tentativas + 1, ultima_tentativa_em = now(),
         etapa = case when etapa = 'novo' then 'atendimento' else etapa end,
         proximo_contato = case when proximo_contato is null or proximo_contato < now() + interval '1 hour'
                                then now() + interval '1 day' else proximo_contato end
   where id = p_lead
  returning tentativas, cliente_id into v_n, v_cli;
  if v_n is null then raise exception 'Lead não encontrado' using errcode = '22023'; end if;
  insert into public.lead_eventos (lead_id, cliente_id, tipo, descricao, usuario_id)
  values (p_lead, v_cli, 'nota', 'Tentativa de contato sem resposta (' || v_n || 'ª)', auth.uid());
  return v_n;
end $$;

-- clicou em "Chamar no WhatsApp" no lead: marca o 1º contato e tira de "Novo"
create or replace function public.lead_registrar_contato(p_lead uuid)
returns void language plpgsql volatile security invoker set search_path = public as $$
begin
  if not public.pode_vender() then raise exception 'Sem permissão' using errcode = '42501'; end if;
  update public.leads
     set primeiro_contato_em = coalesce(primeiro_contato_em, now()),
         etapa = case when etapa = 'novo' then 'atendimento' else etapa end
   where id = p_lead;
end $$;

-- ---------------------------------------------------------------------
-- SITE: clique no WhatsApp (visitante, sem login)
-- ---------------------------------------------------------------------
create or replace function public.registrar_evento_site(p_tipo text, p_pagina text default null, p_utm jsonb default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_ip  text := split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1);
  v_vis text := md5(v_ip || '|' || (now() at time zone 'America/Sao_Paulo')::date || '|ls');
begin
  if p_tipo is distinct from 'whatsapp' then return; end if;
  -- mesmo visitante clicando sem parar ou ataque: ignora em silêncio
  if (select count(*) from public.site_eventos where visitante = v_vis and criado_em > now() - interval '10 minutes') >= 5 then return; end if;
  if (select count(*) from public.site_eventos where criado_em > now() - interval '10 minutes') >= 500 then return; end if;
  insert into public.site_eventos (tipo, pagina, campanha_id, utm, visitante)
  values (p_tipo, left(p_pagina, 200), public.campanha_por_utm(p_utm), p_utm, v_vis);
end $$;

-- formulário do site agora aceita bairro (para saber a região)
drop function if exists public.criar_lead_site(text, text, text, text[], text, text, text, text, jsonb, text);
create or replace function public.criar_lead_site(
  p_nome        text,
  p_whatsapp    text,
  p_email       text    default null,
  p_interesses  text[]  default '{}',
  p_tamanho     text    default null,
  p_como_dorme  text    default null,
  p_mensagem    text    default null,
  p_pagina      text    default null,
  p_utm         jsonb   default null,
  p_campo_extra text    default null,      -- campo escondido anti-robô: tem que vir vazio
  p_bairro      text    default null
) returns boolean language plpgsql volatile security definer set search_path = public as $$
declare
  v_dig     text;
  v_cliente uuid;
  v_lead    uuid;
  v_resp    uuid;
  v_cfg     public.site_config;
begin
  if coalesce(p_campo_extra, '') <> '' then return true; end if;

  p_nome := btrim(coalesce(p_nome, ''));
  p_bairro := nullif(left(btrim(coalesce(p_bairro, '')), 80), '');
  v_dig  := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  if length(p_nome) < 2 or length(p_nome) > 120 then
    raise exception 'Informe seu nome.' using errcode = '22023';
  end if;
  if length(v_dig) < 10 or length(v_dig) > 13 then
    raise exception 'Informe um WhatsApp válido, com DDD.' using errcode = '22023';
  end if;
  if coalesce(p_email, '') <> '' and p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido.' using errcode = '22023';
  end if;
  if length(coalesce(p_mensagem, '')) > 2000 then
    raise exception 'Mensagem muito longa.' using errcode = '22023';
  end if;
  if p_tamanho is not null and not exists (select 1 from public.tamanhos where codigo = p_tamanho) then
    p_tamanho := null;
  end if;

  if (select count(*) from public.leads l join public.clientes c on c.id = l.cliente_id
       where c.whatsapp_digitos = v_dig and l.criado_em > now() - interval '1 hour') >= 3 then
    return true;
  end if;
  if (select count(*) from public.leads where origem = 'site' and criado_em > now() - interval '10 minutes') >= 60 then
    raise exception 'Recebemos muitos contatos agora. Tente em alguns minutos ou chame no WhatsApp.' using errcode = 'P0001';
  end if;

  select id into v_cliente from public.clientes where whatsapp_digitos = v_dig;
  if v_cliente is null then
    insert into public.clientes (nome, whatsapp, email, bairro, origem)
    values (left(p_nome, 120), p_whatsapp, nullif(p_email, ''), p_bairro, 'site')
    returning id into v_cliente;
  else
    update public.clientes
       set email = coalesce(email, nullif(p_email, '')), bairro = coalesce(bairro, p_bairro)
     where id = v_cliente;
  end if;

  select * into v_cfg from public.site_config where id = 1;
  if v_cfg.leads_destino = 'fixo' and v_cfg.leads_responsavel_id is not null then
    v_resp := v_cfg.leads_responsavel_id;
  else
    select p.id into v_resp
    from public.perfis p
    where p.ativo and p.papel in ('admin','gerente','vendedor')
    order by (select count(*) from public.leads l
              where l.responsavel_id = p.id and l.criado_em > now() - interval '7 days'), p.criado_em
    limit 1;
  end if;

  insert into public.leads (cliente_id, origem, etapa, interesses, tamanho_codigo, como_dorme, mensagem,
                            responsavel_id, pagina_origem, utm, campanha)
  values (v_cliente, 'site', 'novo', coalesce(p_interesses[1:8], '{}'), p_tamanho, left(p_como_dorme, 80),
          left(p_mensagem, 2000), v_resp, left(p_pagina, 200), p_utm,
          (select nome from public.site_campanha where id = 1 and public.campanha_ativa()))
  returning id into v_lead;

  insert into public.lead_eventos (lead_id, cliente_id, tipo, descricao)
  values (v_lead, v_cliente, 'criado',
          'Lead criado pelo formulário do site' || coalesce(' (' || left(p_pagina, 60) || ')', ''));
  return true;
end $$;

-- visão dos leads com o nome da campanha
drop view if exists public.v_leads;
create view public.v_leads with (security_invoker = true) as
select l.*, c.nome as cliente, c.whatsapp, c.bairro, c.cidade, p.nome as responsavel,
       ct.nome as campanha_trafego, ct.codigo as campanha_codigo, ct.plataforma as campanha_plataforma
from public.leads l
join public.clientes c on c.id = l.cliente_id
left join public.perfis p on p.id = l.responsavel_id
left join public.campanhas_trafego ct on ct.id = l.campanha_trafego_id;

-- ---------------------------------------------------------------------
-- PAINEL: tráfego e campanhas (admin, gerente e leitura)
-- ---------------------------------------------------------------------
create or replace function public.painel_trafego(p_inicio timestamptz, p_fim timestamptz)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_ini date := (p_inicio at time zone 'America/Sao_Paulo')::date;
  v_fim date := (p_fim at time zone 'America/Sao_Paulo')::date;   -- exclusivo
  r     jsonb;
begin
  if not (public.eh_admin() or public.meu_papel() = 'leitura') then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  if p_fim <= p_inicio or p_fim - p_inicio > interval '400 days' then
    raise exception 'Período inválido' using errcode = '22023';
  end if;

  with
  ld as (select l.*, c.bairro, c.cidade from public.leads l join public.clientes c on c.id = l.cliente_id
         where l.criado_em >= p_inicio and l.criado_em < p_fim),
  vd as (select v.*, l.campanha_trafego_id from public.vendas v left join public.leads l on l.id = v.lead_id
         where v.status <> 'cancelada' and v.data_venda >= p_inicio and v.data_venda < p_fim),
  ev as (select * from public.site_eventos where criado_em >= p_inicio and criado_em < p_fim),
  inv as (  -- investimento proporcional aos dias do período em cada mês
    select i.campanha_id,
           sum(i.valor * greatest(0, least(v_fim, (i.mes + interval '1 month')::date) - greatest(v_ini, i.mes))
               / ((i.mes + interval '1 month')::date - i.mes)) as valor
    from public.campanha_investimentos i
    where i.mes < v_fim and (i.mes + interval '1 month')::date > v_ini
    group by i.campanha_id
  ),
  por_campanha as (
    select ct.id, ct.nome, ct.codigo, ct.plataforma, ct.ativa,
           coalesce((select valor from inv where inv.campanha_id = ct.id), 0) as investido,
           (select count(*) from ev where ev.campanha_id = ct.id) as cliques,
           (select count(*) from ld where ld.campanha_trafego_id = ct.id) as leads,
           (select count(*) from ld where ld.campanha_trafego_id = ct.id and ld.etapa in ('novo','atendimento','orcamento')) as abertos,
           (select count(*) from ld where ld.campanha_trafego_id = ct.id and ld.etapa = 'vendido') as convertidos,
           (select count(*) from ld where ld.campanha_trafego_id = ct.id and ld.etapa = 'perdido') as perdidos,
           (select count(*) from vd where vd.campanha_trafego_id = ct.id) as vendas,
           (select coalesce(sum(total), 0) from vd where vd.campanha_trafego_id = ct.id) as receita,
           (select motivo_categoria from ld where ld.campanha_trafego_id = ct.id and ld.etapa = 'perdido'
             group by motivo_categoria order by count(*) desc, motivo_categoria limit 1) as motivo_principal
    from public.campanhas_trafego ct
  ),
  ativas as (select * from por_campanha where ativa or investido > 0 or cliques > 0 or leads > 0 or vendas > 0),
  tot as (select coalesce(sum(investido), 0) inv, coalesce(sum(cliques), 0) cli, coalesce(sum(leads), 0) lds,
                 coalesce(sum(convertidos), 0) conv, coalesce(sum(vendas), 0) vds, coalesce(sum(receita), 0) rec
          from ativas),
  resp as (select extract(epoch from (primeiro_contato_em - criado_em)) / 60 as minutos from ld where primeiro_contato_em is not null)
  select jsonb_build_object(
    'periodo', jsonb_build_object('inicio', v_ini, 'fim', v_fim - 1),
    'kpis', (select jsonb_build_object(
        'investimento', round(inv, 2), 'cliques', cli, 'leads', lds, 'vendas', vds, 'receita', rec,
        'custo_lead', case when lds > 0 then round(inv / lds, 2) end,
        'custo_venda', case when vds > 0 then round(inv / vds, 2) end,
        'retorno', case when inv > 0 then round(rec / inv, 2) end,
        'conversao', case when lds > 0 then round(conv::numeric * 100 / lds, 1) else 0 end,
        'leads_total', (select count(*) from ld),
        'resposta_mediana_min', (select round(percentile_cont(0.5) within group (order by minutos))::int from resp),
        'resposta_ate_1h_pct', (select round(count(*) filter (where minutos <= 60) * 100.0 / nullif(count(*), 0)) from resp)
      ) from tot),
    'campanhas', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'nome', nome, 'codigo', codigo, 'plataforma', plataforma, 'ativa', ativa,
        'investido', round(investido, 2), 'cliques', cliques, 'leads', leads, 'abertos', abertos,
        'convertidos', convertidos, 'perdidos', perdidos, 'vendas', vendas, 'receita', receita,
        'custo_lead', case when leads > 0 and investido > 0 then round(investido / leads, 2) end,
        'custo_venda', case when vendas > 0 and investido > 0 then round(investido / vendas, 2) end,
        'retorno', case when investido > 0 then round(receita / investido, 2) end,
        'conversao', case when leads > 0 then round(convertidos::numeric * 100 / leads, 1) else 0 end,
        'motivo_principal', motivo_principal
      ) order by receita desc, leads desc, nome), '[]') from ativas),
    'sem_campanha', (select jsonb_build_object(
        'leads', (select count(*) from ld where campanha_trafego_id is null),
        'convertidos', (select count(*) from ld where campanha_trafego_id is null and etapa = 'vendido'),
        'vendas', (select count(*) from vd where campanha_trafego_id is null),
        'receita', (select coalesce(sum(total), 0) from vd where campanha_trafego_id is null),
        'cliques', (select count(*) from ev where campanha_id is null))),
    'motivos', (select coalesce(jsonb_agg(jsonb_build_object('motivo', m, 'quantidade', n) order by n desc), '[]')
                from (select coalesce(motivo_categoria, 'desconhecido') m, count(*) n from ld where etapa = 'perdido' group by 1) x),
    'regioes', (select coalesce(jsonb_agg(jsonb_build_object('regiao', regiao, 'leads', leads, 'vendas', vendas, 'receita', receita)
                  order by receita desc, leads desc), '[]')
                from (
                  select regiao, sum(leads) leads, sum(vendas) vendas, sum(receita) receita from (
                    select coalesce(btrim(nome_local(bairro)), 'Não informado')
                           || case when nullif(btrim(cidade), '') is not null and lower(unaccent_simples(btrim(cidade))) <> 'lagoa santa'
                                   then ' · ' || btrim(nome_local(cidade)) else '' end as regiao,
                           1 as leads, 0 as vendas, 0::numeric as receita
                    from ld
                    union all
                    select coalesce(btrim(nome_local(c.bairro)), 'Não informado')
                           || case when nullif(btrim(c.cidade), '') is not null and lower(unaccent_simples(btrim(c.cidade))) <> 'lagoa santa'
                                   then ' · ' || btrim(nome_local(c.cidade)) else '' end,
                           0, 1, vd.total
                    from vd join public.clientes c on c.id = vd.cliente_id
                  ) u group by regiao order by sum(receita) desc, sum(leads) desc limit 15) g),
    'aguardando', (select coalesce(jsonb_agg(to_jsonb(a) order by a.criado_em), '[]') from (
        select l.id, l.criado_em, c.nome as cliente, c.whatsapp, p.nome as responsavel, ct.nome as campanha
        from public.leads l join public.clientes c on c.id = l.cliente_id
        left join public.perfis p on p.id = l.responsavel_id
        left join public.campanhas_trafego ct on ct.id = l.campanha_trafego_id
        where l.etapa = 'novo' and l.primeiro_contato_em is null
        order by l.criado_em limit 30) a),
    'sem_resposta', (select coalesce(jsonb_agg(to_jsonb(s) order by s.tentativas desc, s.ultima_tentativa_em), '[]') from (
        select l.id, l.tentativas, l.ultima_tentativa_em, l.etapa, c.nome as cliente, c.whatsapp, p.nome as responsavel, ct.nome as campanha
        from public.leads l join public.clientes c on c.id = l.cliente_id
        left join public.perfis p on p.id = l.responsavel_id
        left join public.campanhas_trafego ct on ct.id = l.campanha_trafego_id
        where l.etapa in ('atendimento','orcamento') and l.tentativas > 0
        order by l.tentativas desc, l.ultima_tentativa_em limit 30) s)
  ) into r;
  return r;
end $$;

-- "lagoinha de fora" → "Lagoinha de Fora"
create or replace function public.nome_local(p text)
returns text language sql immutable as $$
  select nullif(replace(replace(replace(replace(replace(replace(' ' || initcap(btrim(coalesce(p, ''))) || ' ',
         ' De ', ' de '), ' Da ', ' da '), ' Do ', ' do '), ' Dos ', ' dos '), ' Das ', ' das '), ' E ', ' e '), '  ')
$$;

-- comparação de cidade sem acento (sem depender da extensão unaccent)
create or replace function public.unaccent_simples(p text)
returns text language sql immutable as $$
  select translate(coalesce(p, ''), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')
$$;

-- ---------------------------------------------------------------------
-- SEGURANÇA
-- ---------------------------------------------------------------------
alter table public.campanhas_trafego enable row level security;
alter table public.campanha_investimentos enable row level security;
alter table public.site_eventos enable row level security;
revoke all on public.campanhas_trafego, public.campanha_investimentos, public.site_eventos from anon;
grant select, insert, update, delete on public.campanhas_trafego, public.campanha_investimentos to authenticated;
grant select on public.site_eventos to authenticated;

drop policy if exists campanhas_le on public.campanhas_trafego;
drop policy if exists campanhas_admin on public.campanhas_trafego;
drop policy if exists investimentos_le on public.campanha_investimentos;
drop policy if exists investimentos_admin on public.campanha_investimentos;
drop policy if exists eventos_le on public.site_eventos;
create policy campanhas_le on public.campanhas_trafego for select to authenticated using (public.eh_equipe());
create policy campanhas_admin on public.campanhas_trafego for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy investimentos_le on public.campanha_investimentos for select to authenticated
  using (public.eh_admin() or public.meu_papel() = 'leitura');
create policy investimentos_admin on public.campanha_investimentos for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy eventos_le on public.site_eventos for select to authenticated using (public.eh_admin() or public.meu_papel() = 'leitura');

revoke all on public.v_leads from anon;
grant select on public.v_leads to authenticated;

revoke execute on function public.campanha_por_utm(jsonb), public.lead_sem_resposta(uuid), public.lead_registrar_contato(uuid),
  public.painel_trafego(timestamptz, timestamptz), public.registrar_evento_site(text, text, jsonb),
  public.criar_lead_site(text, text, text, text[], text, text, text, text, jsonb, text, text) from public, anon;
grant execute on function public.registrar_evento_site(text, text, jsonb),
  public.criar_lead_site(text, text, text, text[], text, text, text, text, jsonb, text, text) to anon, authenticated;
grant execute on function public.lead_sem_resposta(uuid), public.lead_registrar_contato(uuid),
  public.painel_trafego(timestamptz, timestamptz) to authenticated;

-- >>>>>>>>>> migrations/20261110130000_ajustes_site.sql
-- =====================================================================
-- LS Colchões · Banco v2 · 06 · Ajustes do site
-- * tamanhos da loja: Solteiro, Viúva, Casal, Queen e King (sai o Solteirão)
-- * parcelas sem juros no cartão, editáveis no painel (padrão 12x)
-- Pode rodar num banco que já tem o v2 (não apaga dados de venda).
-- =====================================================================

-- Solteirão: sai se nenhum produto, lead ou pedido usa
delete from public.tamanhos t
 where t.codigo = 'SS'
   and not exists (select 1 from public.produto_variacoes v where v.tamanho_codigo = t.codigo)
   and not exists (select 1 from public.leads l where l.tamanho_codigo = t.codigo);
update public.tamanhos set nome = 'Viúva' where codigo = 'V';

alter table public.site_config add column if not exists parcelas_sem_juros smallint not null default 12;
do $$ begin
  alter table public.site_config add constraint site_config_parcelas_ck check (parcelas_sem_juros between 1 and 24);
exception when duplicate_object then null; end $$;

create or replace function public.site_home()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'config', (select jsonb_build_object('whatsapp', whatsapp, 'mensagem_whatsapp', mensagem_whatsapp, 'endereco', endereco,
                 'maps_url', maps_url, 'horarios', horarios, 'instagram', instagram,
                 'tempo_slide_ms', tempo_slide_ms, 'troca_automatica', troca_automatica,
                 'parcelas_sem_juros', parcelas_sem_juros)
               from public.site_config where id = 1),
    'campanha', (select case when public.campanha_ativa() then jsonb_build_object(
                   'nome', nome, 'texto_faixa', texto_faixa, 'termina_em', termina_em, 'mostrar_contagem', mostrar_contagem,
                   'produto', (select public.site_card(pp.id) from public.produtos pp where pp.id = sc.produto_id and pp.visivel_site))
                 end from public.site_campanha sc where id = 1),
    'banners', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'eyebrow', eyebrow, 'titulo_1', titulo_1, 'titulo_2', titulo_2,
                  'texto', texto, 'botao_texto', botao_texto, 'botao_destino', botao_destino, 'botao_url', botao_url,
                  'midia_tipo', midia_tipo, 'midia_caminho', midia_caminho) order by ordem), '[]')
                from public.site_banners
                where ativo and (exibir_de is null or exibir_de <= now()) and (exibir_ate is null or exibir_ate > now())),
    'destaques', case when (select destaques_automaticos from public.site_config where id = 1) then
                   (select coalesce(jsonb_agg(public.site_card(x.id) order by x.qtd desc, x.nome), '[]') from (
                      select p.id, p.nome, coalesce(sum(vi.quantidade) filter (where v.id is not null), 0) as qtd
                      from public.produtos p
                      left join public.produto_variacoes pv on pv.produto_id = p.id
                      left join public.venda_itens vi on vi.variacao_id = pv.id
                      left join public.vendas v on v.id = vi.venda_id and v.status <> 'cancelada'
                                               and v.data_venda > now() - interval '30 days'
                      where p.visivel_site group by p.id, p.nome order by 3 desc, 2 limit 4) x)
                 else
                   (select coalesce(jsonb_agg(public.site_card(x.id) order by x.ordem_destaque, x.nome), '[]') from (
                      select id, nome, ordem_destaque from public.produtos
                      where visivel_site and destaque_home order by ordem_destaque, nome limit 8) x)
                 end,
    'depoimentos', (select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'texto', texto, 'fonte', fonte, 'data', data) order by ordem), '[]')
                    from public.site_depoimentos where publicado),
    'categorias', (select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'slug', slug) order by ordem), '[]')
                   from public.categorias where ativo),
    'tamanhos', (select coalesce(jsonb_agg(jsonb_build_object('codigo', codigo, 'nome', nome, 'largura_cm', largura_cm,
                   'comprimento_cm', comprimento_cm) order by ordem), '[]') from public.tamanhos where largura_cm is not null)
  )
$$;

grant execute on function public.site_home() to anon, authenticated;

-- >>>>>>>>>> seed.sql
-- =====================================================================
-- LS Colchões · Dados básicos (rodar depois das 4 migrations)
-- Pode rodar mais de uma vez sem duplicar.
-- =====================================================================

insert into public.tamanhos (codigo, nome, largura_cm, comprimento_cm, ordem) values
  ('S',  'Solteiro',       88,  188, 1),
  ('V',  'Viúva',         128,  188, 3),
  ('C',  'Casal',         138,  188, 4),
  ('Q',  'Queen',         158,  198, 5),
  ('K',  'King',          193,  203, 6),
  ('U',  'Tamanho único', null, null, 9)
on conflict (codigo) do nothing;

insert into public.categorias (nome, slug, ordem) values
  ('Colchões',      'colchoes',      1),
  ('Conjuntos box', 'conjuntos-box', 2),
  ('Box baú',       'box-bau',       3),
  ('Travesseiros',  'travesseiros',  4),
  ('Acessórios',    'acessorios',    5)
on conflict (slug) do nothing;

insert into public.site_config (id, endereco, maps_url, instagram, horarios) values (
  1,
  'Av. Pref. João Daher, 1277, loja 3 · Lagoa Santa/MG',
  'https://www.google.com/maps/search/?api=1&query=Av.+Pref.+Jo%C3%A3o+Daher+1277+Lagoa+Santa+MG',
  '@ls_colchoes',
  '{"seg_sex": "", "sabado": "", "domingo": ""}'::jsonb
) on conflict (id) do nothing;

insert into public.site_campanha (id) values (1) on conflict (id) do nothing;
insert into public.regras_comissao (id) values (1) on conflict (id) do nothing;

insert into public.site_banners (ordem, eyebrow, titulo_1, titulo_2, texto, botao_texto, botao_destino, midia_tipo)
select * from (values
  (1, 'LOJA DE COLCHÕES EM LAGOA SANTA', 'Conforto que acolhe.', 'Sono que transforma.',
   'Aqui você entende antes de comprar. Nossos consultores ajudam você a escolher o colchão certo para o seu corpo, a sua rotina e o seu orçamento.',
   'Falar com um consultor', 'whatsapp', 'video'),
  (2, 'NOSSA CAMPANHA', 'Conjuntos box', 'com condição especial.',
   'Colchão e base escolhidos juntos, com entrega e montagem. Condição válida por tempo limitado ou enquanto durar o estoque.',
   'Ver a oferta', 'oferta', 'foto'),
  (3, 'SHOWROOM EM LAGOA SANTA', 'Venha deitar', 'antes de decidir.',
   'Sinta a diferença entre os modelos com um consultor ao lado. Sem pressa e sem pressão.',
   'Como chegar', 'como_chegar', 'foto')
) as b(ordem, eyebrow, titulo_1, titulo_2, texto, botao_texto, botao_destino, midia_tipo)
where not exists (select 1 from public.site_banners);

