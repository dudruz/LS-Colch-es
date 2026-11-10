-- =====================================================================
-- LS Colchões · Banco v2 · 05 · Tráfego pago e qualidade do atendimento
-- * campanhas de tráfego (Meta, Google) com investimento por mês
-- * campanha de cada lead pelo link do anúncio (UTM) ou escolhida no painel
-- * cliques no WhatsApp do site por campanha
-- * motivo de perda padronizado, tentativas sem resposta e tempo de 1º contato
-- Pode rodar num banco que já tem o v2 (não apaga nada).
-- =====================================================================

-- ---------------------------------------------------------------------
-- CAMPANHAS
-- ---------------------------------------------------------------------
create table if not exists public.campanhas_trafego (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  codigo        text not null unique,          -- o utm_campaign usado no anúncio
  plataforma    text not null default 'meta' check (plataforma in ('meta','google','outra')),
  ativa         boolean not null default true,
  inicio        date,
  fim           date,
  observacao    text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.campanha_investimentos (
  id          uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas_trafego(id) on delete cascade,
  mes         date not null check (extract(day from mes) = 1),
  valor       numeric(12,2) not null check (valor >= 0),
  unique (campanha_id, mes)
);

create table if not exists public.site_eventos (
  id          bigint generated always as identity primary key,
  tipo        text not null check (tipo in ('whatsapp')),
  pagina      text,
  campanha_id uuid references public.campanhas_trafego(id) on delete set null,
  utm         jsonb,
  visitante   text,                             -- hash diário, não guarda IP
  criado_em   timestamptz not null default now()
);
create index if not exists site_eventos_criado_idx on public.site_eventos(criado_em);

-- ---------------------------------------------------------------------
-- LEADS: novas colunas
-- ---------------------------------------------------------------------
alter table public.leads add column if not exists campanha_trafego_id uuid references public.campanhas_trafego(id) on delete set null;
alter table public.leads add column if not exists motivo_categoria text;
alter table public.leads add column if not exists primeiro_contato_em timestamptz;
alter table public.leads add column if not exists tentativas int not null default 0;
alter table public.leads add column if not exists ultima_tentativa_em timestamptz;
do $$ begin
  alter table public.leads add constraint leads_motivo_categoria_ck
    check (motivo_categoria in ('preco','prazo','sem_resposta','concorrente','desconhecido'));
exception when duplicate_object then null; end $$;
create index if not exists leads_campanha_trafego_idx on public.leads(campanha_trafego_id);

-- leads antigos que já saíram de "Novo" contam como contatados
update public.leads set primeiro_contato_em = atualizado_em
 where primeiro_contato_em is null and etapa <> 'novo';
update public.leads set motivo_categoria = 'desconhecido'
 where etapa = 'perdido' and motivo_categoria is null;

do $$ begin
  create trigger campanhas_trafego_atualizado_em before update on public.campanhas_trafego
    for each row execute function public.tg_atualizado_em();
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- UTM → campanha (cria a campanha sozinha na primeira vez que aparece)
-- ---------------------------------------------------------------------
create or replace function public.campanha_por_utm(p_utm jsonb)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  v_fonte text := lower(coalesce(p_utm->>'utm_source', ''));
  v_cod   text;
  v_plat  text;
  v_id    uuid;
begin
  if p_utm is null then return null; end if;
  v_plat := case
    when v_fonte in ('facebook','fb','ig','instagram','meta','an','msg','messenger') then 'meta'
    when v_fonte in ('google','adwords','gads','youtube','yt') then 'google'
    when p_utm ? 'gclid' then 'google'
    when p_utm ? 'fbclid' then 'meta'
    else 'outra' end;
  v_cod := lower(btrim(coalesce(p_utm->>'utm_campaign', '')));
  if v_cod = '' then
    if p_utm ? 'gclid' then v_cod := 'google-sem-nome';
    elsif p_utm ? 'fbclid' or v_plat = 'meta' then v_cod := 'meta-sem-nome';
    elsif v_fonte <> '' then v_cod := v_fonte || '-sem-nome';
    else return null; end if;
  end if;
  v_cod := left(v_cod, 80);
  select id into v_id from public.campanhas_trafego where codigo = v_cod;
  if v_id is null then
    insert into public.campanhas_trafego (nome, codigo, plataforma, inicio)
    values (v_cod, v_cod, v_plat, (now() at time zone 'America/Sao_Paulo')::date)
    on conflict (codigo) do nothing
    returning id into v_id;
    if v_id is null then select id into v_id from public.campanhas_trafego where codigo = v_cod; end if;
  end if;
  return v_id;
end $$;

create or replace function public.tg_lead_campanha()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.campanha_trafego_id is null and new.utm is not null then
    new.campanha_trafego_id := public.campanha_por_utm(new.utm);
  end if;
  return new;
end $$;
drop trigger if exists leads_campanha on public.leads;
create trigger leads_campanha before insert on public.leads
  for each row execute function public.tg_lead_campanha();

-- 1º contato: quando sai de "Novo" ou quando registra tentativa
create or replace function public.tg_lead_contato()
returns trigger language plpgsql as $$
begin
  if new.primeiro_contato_em is null and (new.etapa <> 'novo' or new.tentativas > 0) then
    new.primeiro_contato_em := now();
  end if;
  if new.etapa = 'perdido' and new.motivo_categoria is null then
    new.motivo_categoria := 'desconhecido';
  end if;
  if new.etapa <> 'perdido' then new.motivo_categoria := null; end if;
  return new;
end $$;
drop trigger if exists leads_contato on public.leads;
create trigger leads_contato before insert or update on public.leads
  for each row execute function public.tg_lead_contato();

-- a linha do tempo mostra o motivo padronizado
create or replace function public.tg_lead_etapa()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  nomes constant jsonb := '{"novo":"Novo","atendimento":"Em atendimento","orcamento":"Orçamento enviado","vendido":"Vendido","perdido":"Perdido"}';
  motivos constant jsonb := '{"preco":"preço/valor","prazo":"prazo de entrega","sem_resposta":"não respondeu","concorrente":"comprou em outro lugar","desconhecido":"motivo desconhecido"}';
begin
  if new.etapa is distinct from old.etapa then
    insert into public.lead_eventos (lead_id, cliente_id, tipo, descricao, usuario_id)
    values (new.id, new.cliente_id,
            case when new.etapa = 'perdido' then 'perda' else 'etapa' end,
            'Etapa: ' || (nomes->>old.etapa) || ' → ' || (nomes->>new.etapa)
              || case when new.etapa = 'perdido' then coalesce(' · ' || (motivos->>new.motivo_categoria), '') else '' end
              || coalesce(' · ' || nullif(new.motivo_perda, ''), ''),
            auth.uid());
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- AÇÕES DO VENDEDOR
-- ---------------------------------------------------------------------
-- "Tentei contato e não respondeu"
create or replace function public.lead_sem_resposta(p_lead uuid)
returns int language plpgsql volatile security invoker set search_path = public as $$
declare v_n int; v_cli uuid;
begin
  if not public.pode_vender() then raise exception 'Sem permissão' using errcode = '42501'; end if;
  update public.leads
     set tentativas = tentativas + 1, ultima_tentativa_em = now(),
         etapa = case when etapa = 'novo' then 'atendimento' else etapa end,
         proximo_contato = case when proximo_contato is null or proximo_contato < now() + interval '1 hour'
                                then now() + interval '1 day' else proximo_contato end
   where id = p_lead
  returning tentativas, cliente_id into v_n, v_cli;
  if v_n is null then raise exception 'Lead não encontrado' using errcode = '22023'; end if;
  insert into public.lead_eventos (lead_id, cliente_id, tipo, descricao, usuario_id)
  values (p_lead, v_cli, 'nota', 'Tentativa de contato sem resposta (' || v_n || 'ª)', auth.uid());
  return v_n;
end $$;

-- clicou em "Chamar no WhatsApp" no lead: marca o 1º contato e tira de "Novo"
create or replace function public.lead_registrar_contato(p_lead uuid)
returns void language plpgsql volatile security invoker set search_path = public as $$
begin
  if not public.pode_vender() then raise exception 'Sem permissão' using errcode = '42501'; end if;
  update public.leads
     set primeiro_contato_em = coalesce(primeiro_contato_em, now()),
         etapa = case when etapa = 'novo' then 'atendimento' else etapa end
   where id = p_lead;
end $$;

-- ---------------------------------------------------------------------
-- SITE: clique no WhatsApp (visitante, sem login)
-- ---------------------------------------------------------------------
create or replace function public.registrar_evento_site(p_tipo text, p_pagina text default null, p_utm jsonb default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_ip  text := split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1);
  v_vis text := md5(v_ip || '|' || (now() at time zone 'America/Sao_Paulo')::date || '|ls');
begin
  if p_tipo is distinct from 'whatsapp' then return; end if;
  -- mesmo visitante clicando sem parar ou ataque: ignora em silêncio
  if (select count(*) from public.site_eventos where visitante = v_vis and criado_em > now() - interval '10 minutes') >= 5 then return; end if;
  if (select count(*) from public.site_eventos where criado_em > now() - interval '10 minutes') >= 500 then return; end if;
  insert into public.site_eventos (tipo, pagina, campanha_id, utm, visitante)
  values (p_tipo, left(p_pagina, 200), public.campanha_por_utm(p_utm), p_utm, v_vis);
end $$;

-- formulário do site agora aceita bairro (para saber a região)
drop function if exists public.criar_lead_site(text, text, text, text[], text, text, text, text, jsonb, text);
create or replace function public.criar_lead_site(
  p_nome        text,
  p_whatsapp    text,
  p_email       text    default null,
  p_interesses  text[]  default '{}',
  p_tamanho     text    default null,
  p_como_dorme  text    default null,
  p_mensagem    text    default null,
  p_pagina      text    default null,
  p_utm         jsonb   default null,
  p_campo_extra text    default null,      -- campo escondido anti-robô: tem que vir vazio
  p_bairro      text    default null
) returns boolean language plpgsql volatile security definer set search_path = public as $$
declare
  v_dig     text;
  v_cliente uuid;
  v_lead    uuid;
  v_resp    uuid;
  v_cfg     public.site_config;
begin
  if coalesce(p_campo_extra, '') <> '' then return true; end if;

  p_nome := btrim(coalesce(p_nome, ''));
  p_bairro := nullif(left(btrim(coalesce(p_bairro, '')), 80), '');
  v_dig  := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  if length(p_nome) < 2 or length(p_nome) > 120 then
    raise exception 'Informe seu nome.' using errcode = '22023';
  end if;
  if length(v_dig) < 10 or length(v_dig) > 13 then
    raise exception 'Informe um WhatsApp válido, com DDD.' using errcode = '22023';
  end if;
  if coalesce(p_email, '') <> '' and p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido.' using errcode = '22023';
  end if;
  if length(coalesce(p_mensagem, '')) > 2000 then
    raise exception 'Mensagem muito longa.' using errcode = '22023';
  end if;
  if p_tamanho is not null and not exists (select 1 from public.tamanhos where codigo = p_tamanho) then
    p_tamanho := null;
  end if;

  if (select count(*) from public.leads l join public.clientes c on c.id = l.cliente_id
       where c.whatsapp_digitos = v_dig and l.criado_em > now() - interval '1 hour') >= 3 then
    return true;
  end if;
  if (select count(*) from public.leads where origem = 'site' and criado_em > now() - interval '10 minutes') >= 60 then
    raise exception 'Recebemos muitos contatos agora. Tente em alguns minutos ou chame no WhatsApp.' using errcode = 'P0001';
  end if;

  select id into v_cliente from public.clientes where whatsapp_digitos = v_dig;
  if v_cliente is null then
    insert into public.clientes (nome, whatsapp, email, bairro, origem)
    values (left(p_nome, 120), p_whatsapp, nullif(p_email, ''), p_bairro, 'site')
    returning id into v_cliente;
  else
    update public.clientes
       set email = coalesce(email, nullif(p_email, '')), bairro = coalesce(bairro, p_bairro)
     where id = v_cliente;
  end if;

  select * into v_cfg from public.site_config where id = 1;
  if v_cfg.leads_destino = 'fixo' and v_cfg.leads_responsavel_id is not null then
    v_resp := v_cfg.leads_responsavel_id;
  else
    select p.id into v_resp
    from public.perfis p
    where p.ativo and p.papel in ('admin','gerente','vendedor')
    order by (select count(*) from public.leads l
              where l.responsavel_id = p.id and l.criado_em > now() - interval '7 days'), p.criado_em
    limit 1;
  end if;

  insert into public.leads (cliente_id, origem, etapa, interesses, tamanho_codigo, como_dorme, mensagem,
                            responsavel_id, pagina_origem, utm, campanha)
  values (v_cliente, 'site', 'novo', coalesce(p_interesses[1:8], '{}'), p_tamanho, left(p_como_dorme, 80),
          left(p_mensagem, 2000), v_resp, left(p_pagina, 200), p_utm,
          (select nome from public.site_campanha where id = 1 and public.campanha_ativa()))
  returning id into v_lead;

  insert into public.lead_eventos (lead_id, cliente_id, tipo, descricao)
  values (v_lead, v_cliente, 'criado',
          'Lead criado pelo formulário do site' || coalesce(' (' || left(p_pagina, 60) || ')', ''));
  return true;
end $$;

-- visão dos leads com o nome da campanha
drop view if exists public.v_leads;
create view public.v_leads with (security_invoker = true) as
select l.*, c.nome as cliente, c.whatsapp, c.bairro, c.cidade, p.nome as responsavel,
       ct.nome as campanha_trafego, ct.codigo as campanha_codigo, ct.plataforma as campanha_plataforma
from public.leads l
join public.clientes c on c.id = l.cliente_id
left join public.perfis p on p.id = l.responsavel_id
left join public.campanhas_trafego ct on ct.id = l.campanha_trafego_id;

-- ---------------------------------------------------------------------
-- PAINEL: tráfego e campanhas (admin, gerente e leitura)
-- ---------------------------------------------------------------------
create or replace function public.painel_trafego(p_inicio timestamptz, p_fim timestamptz)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_ini date := (p_inicio at time zone 'America/Sao_Paulo')::date;
  v_fim date := (p_fim at time zone 'America/Sao_Paulo')::date;   -- exclusivo
  r     jsonb;
begin
  if not (public.eh_admin() or public.meu_papel() = 'leitura') then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  if p_fim <= p_inicio or p_fim - p_inicio > interval '400 days' then
    raise exception 'Período inválido' using errcode = '22023';
  end if;

  with
  ld as (select l.*, c.bairro, c.cidade from public.leads l join public.clientes c on c.id = l.cliente_id
         where l.criado_em >= p_inicio and l.criado_em < p_fim),
  vd as (select v.*, l.campanha_trafego_id from public.vendas v left join public.leads l on l.id = v.lead_id
         where v.status <> 'cancelada' and v.data_venda >= p_inicio and v.data_venda < p_fim),
  ev as (select * from public.site_eventos where criado_em >= p_inicio and criado_em < p_fim),
  inv as (  -- investimento proporcional aos dias do período em cada mês
    select i.campanha_id,
           sum(i.valor * greatest(0, least(v_fim, (i.mes + interval '1 month')::date) - greatest(v_ini, i.mes))
               / ((i.mes + interval '1 month')::date - i.mes)) as valor
    from public.campanha_investimentos i
    where i.mes < v_fim and (i.mes + interval '1 month')::date > v_ini
    group by i.campanha_id
  ),
  por_campanha as (
    select ct.id, ct.nome, ct.codigo, ct.plataforma, ct.ativa,
           coalesce((select valor from inv where inv.campanha_id = ct.id), 0) as investido,
           (select count(*) from ev where ev.campanha_id = ct.id) as cliques,
           (select count(*) from ld where ld.campanha_trafego_id = ct.id) as leads,
           (select count(*) from ld where ld.campanha_trafego_id = ct.id and ld.etapa in ('novo','atendimento','orcamento')) as abertos,
           (select count(*) from ld where ld.campanha_trafego_id = ct.id and ld.etapa = 'vendido') as convertidos,
           (select count(*) from ld where ld.campanha_trafego_id = ct.id and ld.etapa = 'perdido') as perdidos,
           (select count(*) from vd where vd.campanha_trafego_id = ct.id) as vendas,
           (select coalesce(sum(total), 0) from vd where vd.campanha_trafego_id = ct.id) as receita,
           (select motivo_categoria from ld where ld.campanha_trafego_id = ct.id and ld.etapa = 'perdido'
             group by motivo_categoria order by count(*) desc, motivo_categoria limit 1) as motivo_principal
    from public.campanhas_trafego ct
  ),
  ativas as (select * from por_campanha where ativa or investido > 0 or cliques > 0 or leads > 0 or vendas > 0),
  tot as (select coalesce(sum(investido), 0) inv, coalesce(sum(cliques), 0) cli, coalesce(sum(leads), 0) lds,
                 coalesce(sum(convertidos), 0) conv, coalesce(sum(vendas), 0) vds, coalesce(sum(receita), 0) rec
          from ativas),
  resp as (select extract(epoch from (primeiro_contato_em - criado_em)) / 60 as minutos from ld where primeiro_contato_em is not null)
  select jsonb_build_object(
    'periodo', jsonb_build_object('inicio', v_ini, 'fim', v_fim - 1),
    'kpis', (select jsonb_build_object(
        'investimento', round(inv, 2), 'cliques', cli, 'leads', lds, 'vendas', vds, 'receita', rec,
        'custo_lead', case when lds > 0 then round(inv / lds, 2) end,
        'custo_venda', case when vds > 0 then round(inv / vds, 2) end,
        'retorno', case when inv > 0 then round(rec / inv, 2) end,
        'conversao', case when lds > 0 then round(conv::numeric * 100 / lds, 1) else 0 end,
        'leads_total', (select count(*) from ld),
        'resposta_mediana_min', (select round(percentile_cont(0.5) within group (order by minutos))::int from resp),
        'resposta_ate_1h_pct', (select round(count(*) filter (where minutos <= 60) * 100.0 / nullif(count(*), 0)) from resp)
      ) from tot),
    'campanhas', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'nome', nome, 'codigo', codigo, 'plataforma', plataforma, 'ativa', ativa,
        'investido', round(investido, 2), 'cliques', cliques, 'leads', leads, 'abertos', abertos,
        'convertidos', convertidos, 'perdidos', perdidos, 'vendas', vendas, 'receita', receita,
        'custo_lead', case when leads > 0 and investido > 0 then round(investido / leads, 2) end,
        'custo_venda', case when vendas > 0 and investido > 0 then round(investido / vendas, 2) end,
        'retorno', case when investido > 0 then round(receita / investido, 2) end,
        'conversao', case when leads > 0 then round(convertidos::numeric * 100 / leads, 1) else 0 end,
        'motivo_principal', motivo_principal
      ) order by receita desc, leads desc, nome), '[]') from ativas),
    'sem_campanha', (select jsonb_build_object(
        'leads', (select count(*) from ld where campanha_trafego_id is null),
        'convertidos', (select count(*) from ld where campanha_trafego_id is null and etapa = 'vendido'),
        'vendas', (select count(*) from vd where campanha_trafego_id is null),
        'receita', (select coalesce(sum(total), 0) from vd where campanha_trafego_id is null),
        'cliques', (select count(*) from ev where campanha_id is null))),
    'motivos', (select coalesce(jsonb_agg(jsonb_build_object('motivo', m, 'quantidade', n) order by n desc), '[]')
                from (select coalesce(motivo_categoria, 'desconhecido') m, count(*) n from ld where etapa = 'perdido' group by 1) x),
    'regioes', (select coalesce(jsonb_agg(jsonb_build_object('regiao', regiao, 'leads', leads, 'vendas', vendas, 'receita', receita)
                  order by receita desc, leads desc), '[]')
                from (
                  select regiao, sum(leads) leads, sum(vendas) vendas, sum(receita) receita from (
                    select coalesce(btrim(nome_local(bairro)), 'Não informado')
                           || case when nullif(btrim(cidade), '') is not null and lower(unaccent_simples(btrim(cidade))) <> 'lagoa santa'
                                   then ' · ' || btrim(nome_local(cidade)) else '' end as regiao,
                           1 as leads, 0 as vendas, 0::numeric as receita
                    from ld
                    union all
                    select coalesce(btrim(nome_local(c.bairro)), 'Não informado')
                           || case when nullif(btrim(c.cidade), '') is not null and lower(unaccent_simples(btrim(c.cidade))) <> 'lagoa santa'
                                   then ' · ' || btrim(nome_local(c.cidade)) else '' end,
                           0, 1, vd.total
                    from vd join public.clientes c on c.id = vd.cliente_id
                  ) u group by regiao order by sum(receita) desc, sum(leads) desc limit 15) g),
    'aguardando', (select coalesce(jsonb_agg(to_jsonb(a) order by a.criado_em), '[]') from (
        select l.id, l.criado_em, c.nome as cliente, c.whatsapp, p.nome as responsavel, ct.nome as campanha
        from public.leads l join public.clientes c on c.id = l.cliente_id
        left join public.perfis p on p.id = l.responsavel_id
        left join public.campanhas_trafego ct on ct.id = l.campanha_trafego_id
        where l.etapa = 'novo' and l.primeiro_contato_em is null
        order by l.criado_em limit 30) a),
    'sem_resposta', (select coalesce(jsonb_agg(to_jsonb(s) order by s.tentativas desc, s.ultima_tentativa_em), '[]') from (
        select l.id, l.tentativas, l.ultima_tentativa_em, l.etapa, c.nome as cliente, c.whatsapp, p.nome as responsavel, ct.nome as campanha
        from public.leads l join public.clientes c on c.id = l.cliente_id
        left join public.perfis p on p.id = l.responsavel_id
        left join public.campanhas_trafego ct on ct.id = l.campanha_trafego_id
        where l.etapa in ('atendimento','orcamento') and l.tentativas > 0
        order by l.tentativas desc, l.ultima_tentativa_em limit 30) s)
  ) into r;
  return r;
end $$;

-- "lagoinha de fora" → "Lagoinha de Fora"
create or replace function public.nome_local(p text)
returns text language sql immutable as $$
  select nullif(replace(replace(replace(replace(replace(replace(' ' || initcap(btrim(coalesce(p, ''))) || ' ',
         ' De ', ' de '), ' Da ', ' da '), ' Do ', ' do '), ' Dos ', ' dos '), ' Das ', ' das '), ' E ', ' e '), '  ')
$$;

-- comparação de cidade sem acento (sem depender da extensão unaccent)
create or replace function public.unaccent_simples(p text)
returns text language sql immutable as $$
  select translate(coalesce(p, ''), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')
$$;

-- ---------------------------------------------------------------------
-- SEGURANÇA
-- ---------------------------------------------------------------------
alter table public.campanhas_trafego enable row level security;
alter table public.campanha_investimentos enable row level security;
alter table public.site_eventos enable row level security;
revoke all on public.campanhas_trafego, public.campanha_investimentos, public.site_eventos from anon;
grant select, insert, update, delete on public.campanhas_trafego, public.campanha_investimentos to authenticated;
grant select on public.site_eventos to authenticated;

drop policy if exists campanhas_le on public.campanhas_trafego;
drop policy if exists campanhas_admin on public.campanhas_trafego;
drop policy if exists investimentos_le on public.campanha_investimentos;
drop policy if exists investimentos_admin on public.campanha_investimentos;
drop policy if exists eventos_le on public.site_eventos;
create policy campanhas_le on public.campanhas_trafego for select to authenticated using (public.eh_equipe());
create policy campanhas_admin on public.campanhas_trafego for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy investimentos_le on public.campanha_investimentos for select to authenticated
  using (public.eh_admin() or public.meu_papel() = 'leitura');
create policy investimentos_admin on public.campanha_investimentos for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy eventos_le on public.site_eventos for select to authenticated using (public.eh_admin() or public.meu_papel() = 'leitura');

revoke all on public.v_leads from anon;
grant select on public.v_leads to authenticated;

revoke execute on function public.campanha_por_utm(jsonb), public.lead_sem_resposta(uuid), public.lead_registrar_contato(uuid),
  public.painel_trafego(timestamptz, timestamptz), public.registrar_evento_site(text, text, jsonb),
  public.criar_lead_site(text, text, text, text[], text, text, text, text, jsonb, text, text) from public, anon;
grant execute on function public.registrar_evento_site(text, text, jsonb),
  public.criar_lead_site(text, text, text, text[], text, text, text, text, jsonb, text, text) to anon, authenticated;
grant execute on function public.lead_sem_resposta(uuid), public.lead_registrar_contato(uuid),
  public.painel_trafego(timestamptz, timestamptz) to authenticated;
