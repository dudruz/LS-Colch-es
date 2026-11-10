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
