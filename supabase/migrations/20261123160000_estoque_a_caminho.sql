-- Estoque: o que já foi pedido à fábrica e ainda não chegou ("a caminho"),
-- próxima previsão de chegada e vendas dos últimos 30 dias por variação.
-- Usado na matriz de estoque e no relatório "O que pedir".
create or replace view public.v_estoque
with (security_invoker = true) as
select pv.id as variacao_id,
       p.id as produto_id,
       p.nome as produto,
       p.codigo,
       c.nome as categoria,
       t.codigo as tamanho_codigo,
       t.nome as tamanho,
       t.ordem as tamanho_ordem,
       pv.ativo,
       pv.estoque_minimo as minimo,
       coalesce(e.quantidade, 0) as quantidade,
       coalesce(e.reservado, 0) as reservado,
       coalesce(e.quantidade, 0) - coalesce(e.reservado, 0) as disponivel,
       case
         when coalesce(e.quantidade, 0) - coalesce(e.reservado, 0) <= 0 then 'zerado'
         when coalesce(e.quantidade, 0) - coalesce(e.reservado, 0) < pv.estoque_minimo then 'baixo'
         else 'ok'
       end as nivel,
       coalesce(ac.qtd, 0)::int as a_caminho,
       ac.proxima_previsao,
       coalesce(v30.qtd, 0)::int as vendidos_30d,
       pv.sku
from produto_variacoes pv
join produtos p on p.id = pv.produto_id
left join categorias c on c.id = p.categoria_id
join tamanhos t on t.codigo = pv.tamanho_codigo
left join estoque e on e.variacao_id = pv.id
left join lateral (
  select sum(i.quantidade) as qtd, min(pf.previsao) as proxima_previsao
  from pedido_fabrica_itens i
  join pedidos_fabrica pf on pf.id = i.pedido_id
  where i.variacao_id = pv.id
    and pf.status in ('pedido', 'faturado', 'em_transito')
) ac on true
left join lateral (
  select sum(vi.quantidade) as qtd
  from venda_itens vi
  join vendas v on v.id = vi.venda_id
  where vi.variacao_id = pv.id
    and v.status <> 'cancelada'
    and v.criado_em >= now() - interval '30 days'
) v30 on true;
