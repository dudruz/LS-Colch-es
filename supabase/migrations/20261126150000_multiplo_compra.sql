-- Compra em caixa fechada: a sugestão de pedido arredonda para cima até o múltiplo da caixa.
-- Ex.: travesseiros Hi Conforto, Amore, Max Malha e Percal vêm em caixa com 12.
alter table public.produto_variacoes
  add column if not exists multiplo_compra integer not null default 1
  check (multiplo_compra >= 1);

comment on column public.produto_variacoes.multiplo_compra is
  'Quantidade por caixa/lote na compra da fábrica. A sugestão de pedido arredonda para cima até esse múltiplo (1 = unidade).';

create or replace view public.v_estoque with (security_invoker = true) as
 SELECT pv.id AS variacao_id,
    p.id AS produto_id,
    p.nome AS produto,
    p.codigo,
    c.nome AS categoria,
    t.codigo AS tamanho_codigo,
    t.nome AS tamanho,
    t.ordem AS tamanho_ordem,
    pv.ativo,
    pv.estoque_minimo AS minimo,
    COALESCE(e.quantidade, 0) AS quantidade,
    COALESCE(e.reservado, 0) AS reservado,
    COALESCE(e.quantidade, 0) - COALESCE(e.reservado, 0) AS disponivel,
        CASE
            WHEN (COALESCE(e.quantidade, 0) - COALESCE(e.reservado, 0)) <= 0 THEN 'zerado'::text
            WHEN (COALESCE(e.quantidade, 0) - COALESCE(e.reservado, 0)) < pv.estoque_minimo THEN 'baixo'::text
            ELSE 'ok'::text
        END AS nivel,
    COALESCE(ac.qtd, 0::bigint)::integer AS a_caminho,
    ac.proxima_previsao,
    COALESCE(v30.qtd, 0::bigint)::integer AS vendidos_30d,
    pv.sku,
    pv.multiplo_compra
   FROM produto_variacoes pv
     JOIN produtos p ON p.id = pv.produto_id
     LEFT JOIN categorias c ON c.id = p.categoria_id
     JOIN tamanhos t ON t.codigo = pv.tamanho_codigo
     LEFT JOIN estoque e ON e.variacao_id = pv.id
     LEFT JOIN LATERAL ( SELECT sum(i.quantidade) AS qtd,
            min(pf.previsao) AS proxima_previsao
           FROM pedido_fabrica_itens i
             JOIN pedidos_fabrica pf ON pf.id = i.pedido_id
          WHERE i.variacao_id = pv.id AND (pf.status = ANY (ARRAY['pedido'::text, 'faturado'::text, 'em_transito'::text]))) ac ON true
     LEFT JOIN LATERAL ( SELECT sum(vi.quantidade) AS qtd
           FROM venda_itens vi
             JOIN vendas v ON v.id = vi.venda_id
          WHERE vi.variacao_id = pv.id AND v.status <> 'cancelada'::text AND v.criado_em >= (now() - '30 days'::interval)) v30 ON true;

-- Travesseiros em caixa de 12, mínimo de 10 na loja
update public.produto_variacoes pv
   set multiplo_compra = 12, estoque_minimo = 10
  from public.produtos p
 where p.id = pv.produto_id
   and p.nome in ('Travesseiro Hi Conforto', 'Travesseiro Amore', 'Travesseiro Max Malha', 'Travesseiro Percal 200 Fios');
