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
