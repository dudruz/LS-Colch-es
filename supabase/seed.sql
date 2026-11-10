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
