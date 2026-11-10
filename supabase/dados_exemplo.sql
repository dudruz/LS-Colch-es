-- =====================================================================
-- LS Colchões · DADOS DE EXEMPLO — só para o projeto de TESTE
-- Não rode no projeto oficial: os produtos reais vêm da migração.
-- =====================================================================

with p (codigo, nome, cat, tipo, firmeza, selo, destaque, ordem_d, campanha, tams, precos, descricao) as (values
  ('LS-0101', 'Colchão Molas Ensacadas Pillow Top',  'colchoes',      'Molas ensacadas', 3, 'mais_escolhido', true,  1, false, '{S,V,C,Q,K}', '{1990,2590,2890,3390,4290}', 'As molas ensacadas trabalham de forma independente e reduzem a sensação de movimento. O pillow top acrescenta uma camada macia e acolhedora.'),
  ('LS-0102', 'Colchão de Espuma Alta Densidade',    'colchoes',      'Espuma',          4, null,             true,  2, false, '{S,V,C,Q}',   '{990,1290,1590,1890}',       'Suporte firme e uniforme para quem gosta de colchão mais durinho.'),
  ('LS-0201', 'Conjunto Box Molas Ensacadas',        'conjuntos-box', 'Molas ensacadas', 3, 'oferta',         true,  3, true,  '{S,C,Q,K}',   '{2590,3490,4090,4990}',      'Colchão e base escolhidos juntos, prontos para montar.'),
  ('LS-0103', 'Colchão Híbrido Euro Top',            'colchoes',      'Híbrido',         2, null,             true,  4, false, '{C,Q,K}',     '{2790,3290,4690}',           'Molas e espumas combinadas com euro top para um toque mais macio.'),
  ('LS-0104', 'Colchão Molas Bonnel',                'colchoes',      'Molas bonnel',    4, null,             false, 0, false, '{S,V,C}',     '{890,1290,1690}',            'Boa relação custo-benefício, com suporte firme.'),
  ('LS-0301', 'Conjunto Box Baú Molas Ensacadas',    'box-bau',       'Molas ensacadas', 3, 'novidade',       false, 0, false, '{C,Q,K}',     '{3290,3990,4890}',           'Conforto das molas ensacadas com espaço extra para guardar.'),
  ('LS-0202', 'Conjunto Box Espuma Ortopédico',      'conjuntos-box', 'Espuma',          5, null,             false, 0, false, '{S,C,Q}',     '{1890,2690,3290}',           'Suporte bem firme para quem precisa de mais sustentação.'),
  ('LS-0105', 'Colchão Molas Ensacadas Double Face', 'colchoes',      'Molas ensacadas', 4, null,             false, 0, false, '{C,Q,K}',     '{2290,2790,3590}',           'Duas faces de uso para durar mais.'),
  ('LS-0401', 'Travesseiro Viscoelástico',           'travesseiros',  'Viscoelástico',   3, null,             false, 0, false, '{U}',         '{289}',                      'Acompanha o formato da cabeça e do pescoço.')
),
ins as (
  insert into public.produtos (codigo, nome, slug, categoria_id, tipo, firmeza, selo, visivel_site, destaque_home, ordem_destaque, na_campanha, descricao_curta)
  select p.codigo, p.nome, '', c.id, p.tipo, p.firmeza, p.selo, true, p.destaque, p.ordem_d, p.campanha, p.descricao
  from p join public.categorias c on c.slug = p.cat
  on conflict (codigo) do nothing
  returning id, codigo
)
insert into public.produto_variacoes (produto_id, tamanho_codigo, sku, preco, preco_campanha, estoque_minimo)
select ins.id, t.tam, ins.codigo || '-' || t.tam, t.preco,
       case when p.campanha then t.preco - 200 end,
       case when t.tam = 'U' then 6 else 1 end
from ins
join p on p.codigo = ins.codigo
cross join lateral unnest(p.tams::text[], p.precos::numeric[]) as t(tam, preco);

-- estoque inicial
update public.estoque e set quantidade = q.qtd
from (select pv.id, (abs(hashtext(pv.sku)) % 5) + case when pv.tamanho_codigo = 'U' then 10 else 0 end as qtd
      from public.produto_variacoes pv where pv.sku like 'LS-0%') q
where e.variacao_id = q.id;

-- ficha e camadas do produto principal
insert into public.produto_ficha (produto_id, campo, valor, ordem)
select p.id, f.campo, f.valor, f.ordem
from public.produtos p,
     (values ('Fabricante','Ortobom',1), ('Tipo de mola','Ensacada individualmente',2), ('Pillow top','Sim',3),
             ('Tecido','[Tipo de tecido]',4), ('Peso por pessoa','Até [000] kg',5), ('Garantia','[X] anos de fábrica',6)) as f(campo, valor, ordem)
where p.codigo = 'LS-0101' and not exists (select 1 from public.produto_ficha pf where pf.produto_id = p.id);

insert into public.produto_camadas (produto_id, nome, cor, ordem)
select p.id, k.nome, k.cor, k.ordem
from public.produtos p,
     (values ('Tecido em malha','#E8D6A8',1), ('Pillow top macio','#FFFFFF',2), ('Espuma de conforto','#E9E9E6',3),
             ('Molas ensacadas individualmente','#062A4F',4), ('Base de sustentação','#003B73',5)) as k(nome, cor, ordem)
where p.codigo = 'LS-0101' and not exists (select 1 from public.produto_camadas pc where pc.produto_id = p.id);

-- campanha de exemplo até o fim do mês
update public.site_campanha
   set ativa = true, nome = 'Semana do Sono (exemplo)', texto_faixa = 'condições especiais em conjuntos box',
       termina_em = (date_trunc('month', now()) + interval '1 month' - interval '1 minute'),
       produto_id = (select id from public.produtos where codigo = 'LS-0201')
 where id = 1;

-- metas de exemplo do mês atual (loja)
insert into public.metas (mes, vendedor_id, valor)
values (date_trunc('month', now())::date, null, 160000)
on conflict do nothing;
