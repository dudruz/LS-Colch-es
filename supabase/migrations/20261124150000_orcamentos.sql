-- =====================================================================
-- Orçamentos: histórico dos orçamentos montados no painel
-- Cada orçamento tem uma ou mais opções (opcoes jsonb):
--   [{ "titulo": "...", "itens": [{ "variacao_id", "produto", "tamanho", "medida",
--      "qtd", "preco", "preco_tabela", "black", "encomenda" }], "total": 0 }]
-- total = total da primeira opção (com frete, quando o frete é cobrado)
-- =====================================================================
create table if not exists public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  numero integer generated always as identity (start with 1001),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  opcoes jsonb not null default '[]'::jsonb,
  frete_tipo text not null default 'nenhum' check (frete_tipo in ('nenhum', 'valor', 'gratis', 'cliente')),
  frete_valor numeric(12,2) not null default 0,
  parcelas integer not null default 12 check (parcelas between 1 and 24),
  validade date,
  observacoes text,
  mensagem text,
  total numeric(12,2) not null default 0,
  status text not null default 'enviado' check (status in ('rascunho', 'enviado', 'aprovado', 'perdido')),
  criado_por uuid references public.perfis(id) default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists orcamentos_cliente_idx on public.orcamentos (cliente_id);
create index if not exists orcamentos_lead_idx on public.orcamentos (lead_id);
create index if not exists orcamentos_criado_idx on public.orcamentos (criado_em desc);

alter table public.orcamentos enable row level security;
revoke all on table public.orcamentos from anon;
create policy orcamentos_equipe_le on public.orcamentos for select to authenticated using (public.eh_equipe());
create policy orcamentos_vende_insere on public.orcamentos for insert to authenticated with check (public.pode_vender());
create policy orcamentos_vende_altera on public.orcamentos for update to authenticated using (public.pode_vender()) with check (public.pode_vender());
create policy orcamentos_admin_apaga on public.orcamentos for delete to authenticated using (public.eh_admin());

create or replace function public.orcamentos_toca() returns trigger language plpgsql set search_path = public as $$
begin new.atualizado_em := now(); return new; end $$;
drop trigger if exists orcamentos_toca on public.orcamentos;
create trigger orcamentos_toca before update on public.orcamentos for each row execute function public.orcamentos_toca();

-- Lista com nome do cliente e de quem montou
create or replace view public.v_orcamentos with (security_invoker = true) as
select o.*, c.nome as cliente, c.whatsapp, p.nome as vendedor
from public.orcamentos o
join public.clientes c on c.id = o.cliente_id
left join public.perfis p on p.id = o.criado_por;

grant select on public.v_orcamentos to authenticated;
grant select, insert, update, delete on public.orcamentos to authenticated;
