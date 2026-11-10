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
