-- Tour LS (jogo da loja no site): produtos para o mapa do jogo
-- Só leitura. Traz todos os produtos com pelo menos um tamanho ativo e com preço,
-- inclusive os que ainda não estão visíveis no catálogo (o jogo mostra o botão
-- "Ver no site" só para os visíveis). O preço já considera a campanha ativa.

create or replace function public.site_tour()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.item order by x.cat_ordem, x.nome), '[]')
  from (
    select c.ordem as cat_ordem, p.nome,
      jsonb_build_object(
        'id', p.id, 'slug', p.slug, 'nome', p.nome, 'tipo', p.tipo,
        'categoria', c.nome, 'categoria_slug', c.slug,
        'firmeza', p.firmeza, 'altura_cm', p.altura_cm, 'descricao_curta', p.descricao_curta,
        'visivel_site', p.visivel_site,
        'na_campanha', p.na_campanha and public.campanha_ativa(),
        'capa', (select m.caminho from public.produto_midias m
                  where m.produto_id = p.id and m.tipo = 'foto' order by m.capa desc, m.ordem limit 1),
        'variacoes', (select jsonb_agg(jsonb_build_object(
                         't', v.tamanho_codigo, 'tamanho', t.nome,
                         'preco', public.preco_efetivo(v.preco, v.preco_campanha, p.na_campanha),
                         'preco_normal', v.preco) order by t.ordem)
                       from public.produto_variacoes v join public.tamanhos t on t.codigo = v.tamanho_codigo
                      where v.produto_id = p.id and v.ativo and v.preco > 0),
        'preco_a_partir', (select min(public.preco_efetivo(v.preco, v.preco_campanha, p.na_campanha))
                             from public.produto_variacoes v where v.produto_id = p.id and v.ativo and v.preco > 0),
        'preco_normal_a_partir', (select min(v.preco) from public.produto_variacoes v
                                   where v.produto_id = p.id and v.ativo and v.preco > 0)
      ) as item
    from public.produtos p
    join public.categorias c on c.id = p.categoria_id
    where c.slug in ('colchoes', 'box-bau', 'bases', 'conjuntos-box', 'travesseiros', 'acessorios')
      and exists (select 1 from public.produto_variacoes v where v.produto_id = p.id and v.ativo and v.preco > 0)
  ) x
$$;

comment on function public.site_tour() is 'Produtos para o Tour LS (jogo do site). Só leitura, inclui produtos ocultos do catálogo.';

revoke execute on function public.site_tour() from public;
grant execute on function public.site_tour() to anon, authenticated;
