-- =====================================================================
-- PRISMA — Banco · Etapa 4: relatório do CRM salvo no banco (todos veem o mesmo)
-- Rodar UMA vez, depois do 03-permissao-funcao.sql.
--
-- Decisões do autor (20/11/2026):
--   * Um relatório só (o do CRM) alimenta o CRM de todos os setores, a Inteligência de Rede,
--     o Estudo de reclamações e o Volume e produtividade. Fica salvo até a próxima importação.
--   * Só o GESTOR e o ADMIN importam (na Inteligência ou no CRM com o filtro Triagem).
--   * O banco guarda só a última foto: cada importação substitui a anterior.
--   * No CRM, a importação mantém o trabalho da equipe (coluna, responsável, observações,
--     histórico, prioridade, transferência) de quem continua na planilha; quem saiu da planilha sai do banco.
--   * Protocolo criado no PRISMA (PRISMA-AAAA-NNNN) nunca é mexido pela importação.
--   * O CRM leva o CPF (a equipe usa para procurar e cadastrar). Cada colaborador só vê o próprio setor.
--
-- Ninguém grava direto nas tabelas: tudo passa pelas funções abaixo, que conferem o papel.
-- =====================================================================


-- ---------- 1. Funções de apoio ----------

-- setores do CRM que a pessoa enxerga (gestor/admin e quem tem Triagem: todos)
create or replace function public.meus_setores_crm()
returns text[]
language sql stable security definer set search_path = ''
as $$
  select case
    when public.eh_gestao()
      or (public.meu_papel() = 'colaborador' and exists (
            select 1 from public.acessos_setor a join public.setores s on s.id = a.setor_id
            where a.usuario_id = (select auth.uid()) and s.nome = 'Triagem'))
      then (select coalesce(array_agg(nome), '{}') from public.setores)
    when public.meu_papel() = 'colaborador'
      then (select coalesce(array_agg(s.nome), '{}') from public.acessos_setor a
            join public.setores s on s.id = a.setor_id where a.usuario_id = (select auth.uid()))
    else '{}'::text[]
  end;
$$;

create or replace function public.setor_valido(p_nome text)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.setores where nome = p_nome); $$;


-- ---------- 2. Tabelas ----------

-- a última planilha importada (só as colunas que as páginas usam; o site filtra antes de enviar)
create table public.relatorio_linhas (
  id      bigint generated always as identity primary key,
  ordem   integer not null,
  chave   text,                    -- ["protocolo","num. ocorrência"], igual ao CRM; nulo se a linha não tiver
  linha   jsonb not null
);
create index relatorio_linhas_chave on public.relatorio_linhas (chave);
create index relatorio_linhas_ordem on public.relatorio_linhas (ordem);

-- área de passagem: o site manda a planilha em pedaços e depois pede para aplicar tudo de uma vez
create table public.relatorio_envio (
  lote         uuid not null,
  ordem        integer not null,
  chave        text,
  setor        text not null default 'Triagem',
  linha        jsonb not null,
  enviado_por  uuid not null default auth.uid(),
  enviado_em   timestamptz not null default now(),
  primary key (lote, ordem)
);

-- quem importou, quando e os números (sem dado pessoal)
create table public.relatorio_importacoes (
  id           bigint generated always as identity primary key,
  em           timestamptz not null default now(),
  por          uuid references public.perfis (id) on delete set null,
  por_nome     text not null default '',
  arquivo      text not null,
  linhas       integer not null,
  cartoes      integer not null,
  novos        integer not null,
  atualizados  integer not null,
  removidos    integer not null
);

-- o trabalho da equipe em cada protocolo (e os protocolos criados no PRISMA)
create table public.crm_cartoes (
  chave           text primary key,
  protocolo       text not null,
  origem          text not null default 'planilha' check (origem in ('planilha', 'prisma')),
  setor           text not null default 'Triagem',
  dados           jsonb,                              -- só nos protocolos criados no PRISMA
  trabalho        jsonb not null default '{}'::jsonb, -- tratativa, prioridade, transferidoDe
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid
);
create index crm_cartoes_setor on public.crm_cartoes (setor);

-- avisos para as telas abertas se atualizarem na hora (guardo só 1 dia)
create table public.crm_mudancas (
  id     bigint generated always as identity primary key,
  chave  text not null,
  setor  text not null,
  em     timestamptz not null default now()
);

-- numeração PRISMA-AAAA-NNNN (uma por ano, sem repetir entre computadores)
create table public.crm_sequencia (
  ano  integer primary key,
  n    integer not null
);

alter table public.relatorio_linhas      enable row level security;
alter table public.relatorio_envio       enable row level security;
alter table public.relatorio_importacoes enable row level security;
alter table public.crm_cartoes           enable row level security;
alter table public.crm_mudancas          enable row level security;
alter table public.crm_sequencia         enable row level security;


-- ---------- 3. Quem lê o quê (RLS) ----------

-- gestor/admin: tudo; colaborador: só as linhas dos protocolos do(s) seu(s) setor(es)
create policy "relatorio: le conforme o setor" on public.relatorio_linhas for select to authenticated
  using (
    (select public.eh_gestao())
    or (chave is not null and exists (
          select 1 from public.crm_cartoes c
          where c.chave = relatorio_linhas.chave
            and c.setor = any ((select public.meus_setores_crm())::text[]))));

create policy "cartoes: le conforme o setor" on public.crm_cartoes for select to authenticated
  using ((select public.eh_gestao()) or setor = any ((select public.meus_setores_crm())::text[]));

create policy "mudancas: le conforme o setor" on public.crm_mudancas for select to authenticated
  using ((select public.eh_gestao()) or setor = any ((select public.meus_setores_crm())::text[]));

create policy "importacoes: logado le" on public.relatorio_importacoes for select to authenticated
  using (true);

-- só gestor/admin mandam planilha, e cada um só na própria remessa
create policy "envio: gestao manda" on public.relatorio_envio for insert to authenticated
  with check ((select public.eh_gestao()) and enviado_por = (select auth.uid()));

-- crm_sequencia: sem política (só as funções mexem)


-- ---------- 4. Importação: aplica a planilha enviada de uma vez ----------
create or replace function public.relatorio_aplicar(p_lote uuid, p_arquivo text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_linhas integer; v_cartoes integer; v_novos integer; v_atual integer; v_rem integer;
  v_nome text;
begin
  if not public.eh_gestao() then
    raise exception 'Só o gestor e o admin importam o relatório.' using errcode = '42501';
  end if;

  select count(*) into v_linhas from public.relatorio_envio
   where lote = p_lote and enviado_por = (select auth.uid());
  if v_linhas = 0 then raise exception 'Nenhuma linha foi enviada.'; end if;

  -- primeira linha de cada protocolo (como o CRM sempre fez)
  -- (apago antes: se a função rodar duas vezes na mesma transação, a tabela temporária ainda existe)
  drop table if exists pg_temp.prisma_novas;
  drop table if exists pg_temp.prisma_antigas;
  create temp table pg_temp.prisma_novas on commit drop as
    select distinct on (chave) chave, setor, linha
      from public.relatorio_envio
     where lote = p_lote and enviado_por = (select auth.uid()) and chave is not null
     order by chave, ordem;
  create temp table pg_temp.prisma_antigas on commit drop as
    select distinct on (chave) chave, linha
      from public.relatorio_linhas where chave is not null
     order by chave, ordem;

  select count(*) into v_novos from pg_temp.prisma_novas n
   where not exists (select 1 from public.crm_cartoes c where c.chave = n.chave);
  select count(*) into v_atual from pg_temp.prisma_novas n
    join pg_temp.prisma_antigas a on a.chave = n.chave
   where a.linha is distinct from n.linha;

  -- quem saiu da planilha sai do banco (os do PRISMA ficam)
  delete from public.crm_cartoes c
   where c.origem = 'planilha'
     and not exists (select 1 from pg_temp.prisma_novas n where n.chave = c.chave);
  get diagnostics v_rem = row_count;

  -- quem é novo ganha o cartão no setor que a planilha indica; quem já existia mantém tudo
  insert into public.crm_cartoes (chave, protocolo, origem, setor)
  select n.chave, coalesce(n.chave::jsonb ->> 0, ''), 'planilha',
         case when public.setor_valido(n.setor) then n.setor else 'Triagem' end
    from pg_temp.prisma_novas n
  on conflict (chave) do nothing;

  -- troca a foto da planilha
  delete from public.relatorio_linhas where true;   -- "where true": o Supabase recusa delete sem where vindo do site
  insert into public.relatorio_linhas (ordem, chave, linha)
  select ordem, chave, linha from public.relatorio_envio
   where lote = p_lote and enviado_por = (select auth.uid())
   order by ordem;

  delete from public.relatorio_envio where lote = p_lote or enviado_em < now() - interval '1 day';

  select count(*) into v_cartoes from public.crm_cartoes;
  select coalesce(nullif(nome, ''), email) into v_nome from public.perfis where id = (select auth.uid());

  insert into public.relatorio_importacoes (por, por_nome, arquivo, linhas, cartoes, novos, atualizados, removidos)
  values ((select auth.uid()), coalesce(v_nome, ''), left(coalesce(p_arquivo, ''), 200),
          v_linhas, v_cartoes, v_novos, v_atual, v_rem);

  return jsonb_build_object('linhas', v_linhas, 'cartoes', v_cartoes, 'novos', v_novos,
                            'atualizados', v_atual, 'removidos', v_rem);
end;
$$;


-- ---------- 5. CRM: salvar o trabalho de um cartão ----------
create or replace function public.crm_salvar(p_chave text, p_setor text, p_trabalho jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_antes public.crm_cartoes;
begin
  select * into v_antes from public.crm_cartoes where chave = p_chave for update;
  if not found then raise exception 'Protocolo não encontrado (pode ter saído na última importação).'; end if;
  if not (public.eh_gestao() or v_antes.setor = any (public.meus_setores_crm())) then
    raise exception 'Sem permissão para este protocolo.' using errcode = '42501';
  end if;
  if not public.setor_valido(p_setor) then raise exception 'Setor inválido.'; end if;
  if not public.eh_gestao()
     and coalesce(v_antes.trabalho -> 'prioridade', 'null'::jsonb) is distinct from coalesce(p_trabalho -> 'prioridade', 'null'::jsonb) then
    raise exception 'Só a Triagem muda a prioridade.' using errcode = '42501';
  end if;
  if p_trabalho is null or jsonb_typeof(p_trabalho) <> 'object' or pg_column_size(p_trabalho) > 300000 then
    raise exception 'Tratativa inválida.';
  end if;

  update public.crm_cartoes
     set setor = p_setor, trabalho = p_trabalho, atualizado_em = now(), atualizado_por = (select auth.uid())
   where chave = p_chave;

  insert into public.crm_mudancas (chave, setor) values (p_chave, v_antes.setor);
  if p_setor <> v_antes.setor then insert into public.crm_mudancas (chave, setor) values (p_chave, p_setor); end if;
  delete from public.crm_mudancas where em < now() - interval '1 day';
end;
$$;


-- ---------- 6. CRM: protocolo criado pela Triagem (PRISMA-AAAA-NNNN) ----------
create or replace function public.crm_proximo_numero()
returns text
language sql stable security definer set search_path = ''
as $$
  select format('PRISMA-%s-%s', a.ano, lpad((coalesce((select n from public.crm_sequencia where ano = a.ano), 0) + 1)::text, 4, '0'))
    from (select extract(year from now() at time zone 'America/Sao_Paulo')::integer as ano) a
   where public.eh_gestao();
$$;

create or replace function public.crm_criar_prisma(p_setor text, p_dados jsonb, p_trabalho jsonb)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_ano integer := extract(year from now() at time zone 'America/Sao_Paulo')::integer;
  v_n integer; v_prot text; v_chave text;
begin
  if not public.eh_gestao() then
    raise exception 'Só a Triagem cria protocolo PRISMA.' using errcode = '42501';
  end if;
  if not public.setor_valido(p_setor) then raise exception 'Setor inválido.'; end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' or pg_column_size(p_dados) > 100000 then
    raise exception 'Dados inválidos.';
  end if;

  insert into public.crm_sequencia (ano, n) values (v_ano, 1)
  on conflict (ano) do update set n = public.crm_sequencia.n + 1
  returning n into v_n;

  v_prot  := format('PRISMA-%s-%s', v_ano, lpad(v_n::text, 4, '0'));
  v_chave := format('["%s","PRISMA"]', v_prot);   -- igual ao JSON.stringify do site

  insert into public.crm_cartoes (chave, protocolo, origem, setor, dados, trabalho, atualizado_por)
  values (v_chave, v_prot, 'prisma', p_setor, p_dados, coalesce(p_trabalho, '{}'::jsonb), (select auth.uid()));

  insert into public.crm_mudancas (chave, setor) values (v_chave, p_setor);
  return v_prot;
end;
$$;


-- ---------- 7. Permissões (o projeto não dá acesso automático às tabelas) ----------
revoke all on public.relatorio_linhas, public.relatorio_envio, public.relatorio_importacoes,
  public.crm_cartoes, public.crm_mudancas, public.crm_sequencia from anon, authenticated;

grant select on public.relatorio_linhas, public.relatorio_importacoes, public.crm_cartoes, public.crm_mudancas to authenticated;
grant insert on public.relatorio_envio to authenticated;

revoke execute on function public.meus_setores_crm(), public.setor_valido(text),
  public.relatorio_aplicar(uuid, text), public.crm_salvar(text, text, jsonb),
  public.crm_proximo_numero(), public.crm_criar_prisma(text, jsonb, jsonb) from public, anon;
grant execute on function public.meus_setores_crm(), public.setor_valido(text),
  public.relatorio_aplicar(uuid, text), public.crm_salvar(text, text, jsonb),
  public.crm_proximo_numero(), public.crm_criar_prisma(text, jsonb, jsonb) to authenticated;


-- ---------- 8. Aviso em tempo real (as telas abertas se atualizam sozinhas) ----------
alter publication supabase_realtime add table public.crm_mudancas, public.relatorio_importacoes;
