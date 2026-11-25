-- Calculadora de frete: valor por km (ida e volta) e frete diluído no preço do orçamento

alter table public.site_config
  add column if not exists frete_valor_km numeric(6,2) not null default 2.00;

alter table public.orcamentos drop constraint if exists orcamentos_frete_tipo_check;
alter table public.orcamentos
  add constraint orcamentos_frete_tipo_check check (frete_tipo in ('nenhum', 'valor', 'gratis', 'diluido', 'cliente')),
  add column if not exists frete_km numeric(8,1),
  add column if not exists frete_destino text;

comment on column public.orcamentos.frete_valor is 'Valor do frete. No tipo diluido é o custo interno (km x 2 x valor do km) já embutido nos preços dos itens.';
comment on column public.orcamentos.frete_km is 'Km de ida da loja até o cliente (calculadora de frete).';

create or replace view public.v_orcamentos with (security_invoker = true) as
select o.id, o.numero, o.cliente_id, o.lead_id, o.opcoes, o.frete_tipo, o.frete_valor, o.parcelas, o.validade,
       o.observacoes, o.mensagem, o.total, o.status, o.criado_por, o.criado_em, o.atualizado_em,
       c.nome as cliente, c.whatsapp, p.nome as vendedor,
       o.frete_km, o.frete_destino
  from public.orcamentos o
  join public.clientes c on c.id = o.cliente_id
  left join public.perfis p on p.id = o.criado_por;
