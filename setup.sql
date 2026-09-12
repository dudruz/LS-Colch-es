-- LS Colchões — setup do banco de dados (Supabase)
-- Rode este arquivo inteiro de uma vez em: SQL Editor → New query → Run
-- Ele cria as tabelas, as permissões e já carrega os produtos da planilha.

-- 1) Tabelas -----------------------------------------------------------
create table if not exists produtos (
  id bigint generated always as identity primary key,
  nome text not null,
  categoria text not null,
  preco numeric not null,
  foto_url text,
  ativo boolean default true,
  criado_em timestamptz default now()
);

create table if not exists promocoes (
  id bigint generated always as identity primary key,
  titulo text not null,
  descricao text not null,
  ativa boolean default true,
  criado_em timestamptz default now()
);

create table if not exists feedbacks (
  id bigint generated always as identity primary key,
  nome text not null,
  nota int not null,
  mensagem text not null,
  aprovado boolean default false,
  criado_em timestamptz default now()
);

-- 2) Segurança das tabelas ----------------------------------------------
-- Simples de propósito: o site e o admin.html usam a mesma chave "anon",
-- então liberamos leitura/escrita geral nessas 3 tabelas. Não é para
-- guardar nada sensível nelas (veja o aviso no README).
alter table produtos enable row level security;
alter table promocoes enable row level security;
alter table feedbacks enable row level security;

drop policy if exists "leitura publica produtos" on produtos;
drop policy if exists "escrita publica produtos" on produtos;
drop policy if exists "atualizacao publica produtos" on produtos;
drop policy if exists "exclusao publica produtos" on produtos;
create policy "leitura publica produtos" on produtos for select using (true);
create policy "escrita publica produtos" on produtos for insert with check (true);
create policy "atualizacao publica produtos" on produtos for update using (true);
create policy "exclusao publica produtos" on produtos for delete using (true);

drop policy if exists "leitura publica promocoes" on promocoes;
drop policy if exists "escrita publica promocoes" on promocoes;
drop policy if exists "atualizacao publica promocoes" on promocoes;
drop policy if exists "exclusao publica promocoes" on promocoes;
create policy "leitura publica promocoes" on promocoes for select using (true);
create policy "escrita publica promocoes" on promocoes for insert with check (true);
create policy "atualizacao publica promocoes" on promocoes for update using (true);
create policy "exclusao publica promocoes" on promocoes for delete using (true);

drop policy if exists "leitura publica feedbacks" on feedbacks;
drop policy if exists "escrita publica feedbacks" on feedbacks;
drop policy if exists "atualizacao publica feedbacks" on feedbacks;
drop policy if exists "exclusao publica feedbacks" on feedbacks;
create policy "leitura publica feedbacks" on feedbacks for select using (true);
create policy "escrita publica feedbacks" on feedbacks for insert with check (true);
create policy "atualizacao publica feedbacks" on feedbacks for update using (true);
create policy "exclusao publica feedbacks" on feedbacks for delete using (true);

-- 3) Bucket de fotos dos produtos ---------------------------------------
insert into storage.buckets (id, name, public)
values ('produtos-fotos', 'produtos-fotos', true)
on conflict (id) do nothing;

drop policy if exists "leitura publica fotos" on storage.objects;
drop policy if exists "upload publico fotos" on storage.objects;
create policy "leitura publica fotos" on storage.objects
  for select using (bucket_id = 'produtos-fotos');
create policy "upload publico fotos" on storage.objects
  for insert with check (bucket_id = 'produtos-fotos');

-- 4) Carga inicial dos produtos da planilha ------------------------------
-- Só roda se a tabela produtos ainda estiver vazia, para não duplicar
-- caso você já tenha rodado este arquivo antes ou cadastrado algo manualmente.
insert into produtos (nome, categoria, preco, ativo)
select * from (values
  ('Fit 33', 'Colchões', 799.1, true),
  ('Base Sommier Pop Marron', 'Bases', 499.0, true),
  ('Base Sommier Camurca Bege', 'Bases', 480.0, true),
  ('Exclusive Gel', 'Colchões', 3033.8, true),
  ('Base Sommier Camurca Preto (opção 1)', 'Bases', 710.0, true),
  ('New Freedom', 'Colchões', 2334.2, true),
  ('Exclusive Sleep', 'Colchões', 2796.2, true),
  ('Base Sommier Bau Phys Camuca Cinza', 'Bases', 1758.0, true),
  ('Exclusive Foam', 'Colchões', 2197.8, true),
  ('Base Sommier Camurca Preto (opção 2)', 'Bases', 480.0, true),
  ('Fit Springpocket', 'Colchões', 1634.6, true),
  ('Base Sommier Camurca Cinza', 'Bases', 810.0, true),
  ('Airtech Springpocket', 'Colchões', 1271.6, true),
  ('Base Sommier Pop', 'Bases', 420.0, true),
  ('Base Sommier Pop Bege', 'Bases', 338.0, true),
  ('Fit 450', 'Colchões', 974.6, true),
  ('Base Sommier Bau Phys Camu Bege', 'Bases', 918.0, true),
  ('Travesseiro Hi Conforto', 'Acessórios', 48.65, true),
  ('Travesseiro Max Malha', 'Acessórios', 45.35, true),
  ('Travesseiro Percal 200 Fios', 'Acessórios', 51.9, true),
  ('Travesseiro Aman Tec 140 Fios', 'Acessórios', 140.65, true),
  ('Protetor Colchao Coml (opção 1)', 'Acessórios', 94.75, true),
  ('Protetor Colchao Coml (opção 2)', 'Acessórios', 120.55, true),
  ('Travesseiro Casa Dinho', 'Acessórios', 49.4, true),
  ('Travesseiro Conforto Anatomico', 'Acessórios', 129.57, true),
  ('Cabeceira Murat Facto Bege (opção 1)', 'Cabeceiras', 528.0, true),
  ('Cabeceira Piave Veludo Preto (opção 1)', 'Cabeceiras', 473.0, true),
  ('Cabeceira Piave Veludo Cinza', 'Cabeceiras', 657.8, true),
  ('Cabeceira Murat Facto Cinza', 'Cabeceiras', 657.8, true),
  ('Cabeceira Piave Veludo Preto (opção 2)', 'Cabeceiras', 440.0, true),
  ('Cabeceira Piave Veludo Bege', 'Cabeceiras', 440.0, true),
  ('Cabeceira Murat Facto Bege (opção 2)', 'Cabeceiras', 440.0, true),
  ('Cabeceira Piave Veludo Marrom', 'Cabeceiras', 393.8, true),
  ('Orthofort D33 Sm', 'Colchões', 1501.95, true)
) as seed(nome, categoria, preco, ativo)
where not exists (select 1 from produtos);

-- 5) Foto e preço antigo/novo nas promoções (adicionado depois) --------
alter table promocoes add column if not exists foto_url text;
alter table promocoes add column if not exists preco_antigo numeric;
alter table promocoes add column if not exists preco_novo numeric;
-- Reaproveita o bucket "produtos-fotos" (já público) para as fotos de promoção.
