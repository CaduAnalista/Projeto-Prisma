-- =====================================================================
-- PRISMA — Banco (Supabase/PostgreSQL) · Etapa 1: usuários, papéis, setores e páginas
-- Rodar UMA vez no Supabase: painel do projeto > SQL Editor > New query > colar tudo > Run.
--
-- Decisões do autor (19/11/2026):
--   * O sistema vai para USO REAL (com LGPD).
--   * Contas criadas só pelo autor e pelo admin (cadastro público desligado no painel).
--   * Papéis:
--       gestor      → tudo
--       admin       → tudo, MENOS a página "Volume e produtividade"
--       colaborador → só a Visão geral e o CRM do(s) seu(s) setor(es)
--
-- Como pensei a segurança: quem decide o que cada um vê é o banco (RLS),
-- e não o JavaScript do site. Mesmo que alguém mexa no navegador, o banco recusa.
-- Este arquivo NÃO tem nenhuma chave ou senha: pode ir para o GitHub.
-- =====================================================================


-- ---------- 1. Setores ----------------------------------------------
-- A mesma lista que já existe no site: os 8 do Kanban e os 9 do formulário de reunião
-- (alguns nomes se repetem nas duas listas; aqui cada nome entra uma vez só).
create table public.setores (
  id    smallint generated always as identity primary key,
  nome  text not null unique
);

insert into public.setores (nome) values
  ('ADM/PAT'), ('Reembolso'), ('Credenciamento'), ('Auditoria'), ('Cadastro'),
  ('Captação'), ('Financeiro'), ('Triagem'),
  ('Inteligência de rede'), ('Gestão'), ('Captação/Cadastro'), ('Gerência'), ('Coordenação');


-- ---------- 2. Perfis (um por conta de login) -----------------------
-- O e-mail e a senha ficam no Supabase Auth (auth.users). Aqui fica só o que o site precisa.
create table public.perfis (
  id          uuid primary key references auth.users (id) on delete cascade,
  nome        text not null default '',
  papel       text not null default 'colaborador' check (papel in ('gestor', 'admin', 'colaborador')),
  ativo       boolean not null default true,      -- desligar = bloqueia sem apagar a conta
  criado_em   timestamptz not null default now()
);


-- ---------- 3. Setores de cada colaborador ---------------------------
-- Um colaborador pode ter mais de um setor. Gestor e admin veem todos e não precisam estar aqui.
create table public.acessos_setor (
  usuario_id  uuid     not null references public.perfis (id) on delete cascade,
  setor_id    smallint not null references public.setores (id) on delete cascade,
  criado_em   timestamptz not null default now(),
  primary key (usuario_id, setor_id)
);
create index acessos_setor_setor_idx on public.acessos_setor (setor_id);


-- ---------- 4. Páginas que cada papel abre ----------------------------
-- O código de cada página é o mesmo "data-pagina" do menu da Visão geral.
-- Fica numa tabela (e não fixo no código) para o gestor poder ajustar sem mexer no site.
create table public.paginas (
  codigo  text primary key,
  nome    text not null
);

insert into public.paginas (codigo, nome) values
  ('visao-geral',               'Visão geral'),
  ('inteligencia',              'Inteligência de Rede'),
  ('estudo-reclamacoes',        'Estudo de reclamações'),
  ('volume-produtividade',      'Volume e produtividade'),
  ('kanban-crm',                'CRM (Kanban de tratativas)'),
  ('geolocalizacao',            'Geolocalização de vidas e rede'),
  ('formulario-reuniao',        'Formulário para a reunião'),
  ('assuntos-por-setor',        'Assuntos por setor'),
  ('financeiro-credenciamento', 'Financeiro/Credenciamento'),
  ('crm',                       'CRM'),
  ('nip',                       'NIP');

create table public.permissoes_pagina (
  papel   text not null check (papel in ('gestor', 'admin', 'colaborador')),
  pagina  text not null references public.paginas (codigo) on update cascade on delete cascade,
  primary key (papel, pagina)
);

-- gestor: tudo
insert into public.permissoes_pagina (papel, pagina)
  select 'gestor', codigo from public.paginas;
-- admin: tudo menos Volume e produtividade
insert into public.permissoes_pagina (papel, pagina)
  select 'admin', codigo from public.paginas where codigo <> 'volume-produtividade';
-- colaborador: Visão geral e o CRM (no CRM ele só enxerga os cartões do próprio setor)
insert into public.permissoes_pagina (papel, pagina) values
  ('colaborador', 'visao-geral'),
  ('colaborador', 'kanban-crm');


-- ---------- 5. Funções de apoio para as regras (RLS) ----------------
-- security definer: leem as tabelas acima sem cair na própria RLS (senão daria laço infinito).
-- search_path vazio: ninguém consegue "trocar" uma tabela por outra com o mesmo nome.

-- papel de quem está logado (nulo se a conta estiver bloqueada)
create or replace function public.meu_papel()
returns text
language sql stable security definer set search_path = ''
as $$
  select papel from public.perfis where id = (select auth.uid()) and ativo;
$$;

-- papel de outra pessoa (usado para o admin só mexer em colaborador)
create or replace function public.papel_de(p_usuario uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select papel from public.perfis where id = p_usuario;
$$;

create or replace function public.eh_gestor()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.meu_papel() = 'gestor', false); $$;

-- gestor ou admin (os dois veem todos os setores)
create or replace function public.eh_gestao()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.meu_papel() in ('gestor', 'admin'), false); $$;

-- pode ver/mexer nos dados de um setor?
create or replace function public.pode_setor(p_setor smallint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.eh_gestao() or (
    public.meu_papel() = 'colaborador' and exists (
      select 1 from public.acessos_setor
      where usuario_id = (select auth.uid()) and setor_id = p_setor
    )
  );
$$;

-- CRM (Kanban): igual ao pode_setor, mas quem tem o setor TRIAGEM vê e trata todos os setores
-- (decisão do autor, 19/11/2026: a Triagem prioriza e cria protocolos para qualquer setor).
-- Fica separada do pode_setor para essa exceção valer só no CRM.
create or replace function public.pode_setor_crm(p_setor smallint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.pode_setor(p_setor) or (
    public.meu_papel() = 'colaborador' and exists (
      select 1 from public.acessos_setor a
      join public.setores s on s.id = a.setor_id
      where a.usuario_id = (select auth.uid()) and s.nome = 'Triagem'
    )
  );
$$;

-- pode abrir uma página? (o menu usa; as tabelas de cada página também vão usar)
create or replace function public.pode_pagina(p_pagina text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.permissoes_pagina
    where papel = public.meu_papel() and pagina = p_pagina
  );
$$;

-- só quem está logado usa essas funções
revoke execute on function public.meu_papel(), public.papel_de(uuid), public.eh_gestor(),
  public.eh_gestao(), public.pode_setor(smallint), public.pode_setor_crm(smallint),
  public.pode_pagina(text) from public, anon;
grant execute on function public.meu_papel(), public.papel_de(uuid), public.eh_gestor(),
  public.eh_gestao(), public.pode_setor(smallint), public.pode_setor_crm(smallint),
  public.pode_pagina(text) to authenticated;


-- ---------- 6. Perfil criado sozinho quando a conta é criada ----------
-- Toda conta nova nasce como 'colaborador', sem setor nenhum (só vê a Visão geral até ser liberada).
create or replace function public.criar_perfil()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', ''));
  return new;
end;
$$;
revoke execute on function public.criar_perfil() from public, anon, authenticated;

create trigger ao_criar_conta
  after insert on auth.users
  for each row execute function public.criar_perfil();


-- ---------- 7. Histórico: quem mudou o quê e quando -------------------
-- Preenchido só pelo banco (gatilho). Ninguém escreve nem apaga direto.
create table public.historico (
  id          bigint generated always as identity primary key,
  quando      timestamptz not null default now(),
  usuario_id  uuid default auth.uid(),
  tabela      text not null,
  acao        text not null,          -- INSERT, UPDATE ou DELETE
  antes       jsonb,
  depois      jsonb
);
create index historico_quando_idx on public.historico (quando desc);

create or replace function public.registrar_historico()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.historico (tabela, acao, antes, depois)
  values (
    tg_table_name, tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;
revoke execute on function public.registrar_historico() from public, anon, authenticated;

-- mudanças de papel, bloqueio, setores e permissões de página ficam registradas
create trigger historico_perfis
  after insert or update or delete on public.perfis
  for each row execute function public.registrar_historico();
create trigger historico_acessos
  after insert or update or delete on public.acessos_setor
  for each row execute function public.registrar_historico();
create trigger historico_permissoes
  after insert or update or delete on public.permissoes_pagina
  for each row execute function public.registrar_historico();


-- ---------- 8. RLS: ligada em TODAS as tabelas ----------------------
alter table public.setores            enable row level security;
alter table public.perfis             enable row level security;
alter table public.acessos_setor      enable row level security;
alter table public.paginas            enable row level security;
alter table public.permissoes_pagina  enable row level security;
alter table public.historico          enable row level security;

-- quem não está logado (anon) não toca em nada
revoke all on public.setores, public.perfis, public.acessos_setor, public.paginas,
  public.permissoes_pagina, public.historico from anon;

-- O projeto foi criado SEM "dar acesso automático da API às tabelas novas" (mais seguro).
-- Então eu libero aqui, para quem está logado, só os comandos que cada tabela precisa.
-- Mesmo com o comando liberado, cada linha ainda passa pelas regras (RLS) logo abaixo.
grant select, insert, update, delete on public.setores, public.paginas,
  public.acessos_setor, public.permissoes_pagina to authenticated;
grant select, update, delete on public.perfis to authenticated;     -- perfil nasce pelo gatilho
grant select on public.historico to authenticated;                   -- só o gatilho grava
grant usage on all sequences in schema public to authenticated;

-- Setores e páginas: qualquer pessoa logada lê a lista de nomes; só o gestor altera
create policy "setores: logado le"         on public.setores for select to authenticated using (true);
create policy "setores: gestor altera"     on public.setores for all to authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());
create policy "paginas: logado le"         on public.paginas for select to authenticated using (true);
create policy "paginas: gestor altera"     on public.paginas for all to authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());

-- Permissões de página: cada um lê as do próprio papel (o menu precisa); gestor/admin leem todas;
-- só o gestor muda (assim o admin não consegue se liberar no Volume e produtividade)
create policy "permissoes: le as minhas"   on public.permissoes_pagina for select to authenticated
  using (papel = public.meu_papel() or public.eh_gestao());
create policy "permissoes: gestor altera"  on public.permissoes_pagina for all to authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());

-- Perfis: cada um lê o próprio; gestor e admin leem todos.
-- Gestor altera qualquer perfil. Admin só altera COLABORADOR e não pode promover ninguém
-- (nem a si mesmo) a admin ou gestor. Ninguém muda o próprio papel.
create policy "perfis: le"                 on public.perfis for select to authenticated
  using (id = (select auth.uid()) or public.eh_gestao());
create policy "perfis: gestor altera"      on public.perfis for update to authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());
create policy "perfis: admin altera colaborador" on public.perfis for update to authenticated
  using (public.meu_papel() = 'admin' and papel = 'colaborador')
  with check (public.meu_papel() = 'admin' and papel = 'colaborador');
create policy "perfis: gestor apaga"       on public.perfis for delete to authenticated
  using (public.eh_gestor());

-- Setores de cada colaborador: cada um vê os próprios; gestor e admin veem todos.
-- Gestor libera/tira de qualquer pessoa; admin só de colaborador.
create policy "acessos: le"                on public.acessos_setor for select to authenticated
  using (usuario_id = (select auth.uid()) or public.eh_gestao());
create policy "acessos: gestor altera"     on public.acessos_setor for all to authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());
create policy "acessos: admin altera colaborador" on public.acessos_setor for all to authenticated
  using (public.meu_papel() = 'admin' and public.papel_de(usuario_id) = 'colaborador')
  with check (public.meu_papel() = 'admin' and public.papel_de(usuario_id) = 'colaborador');

-- Histórico: gestor e admin leem (não há política de escrita: só o gatilho grava)
create policy "historico: gestao le"       on public.historico for select to authenticated
  using (public.eh_gestao());


-- =====================================================================
-- DEPOIS DE RODAR: transformar a SUA conta em gestor (uma vez só).
-- 1) Authentication > Users > Add user > Create new user (seu e-mail e uma senha forte).
-- 2) Rode a linha abaixo trocando o e-mail pelo seu:
--
--   update public.perfis set papel = 'gestor', nome = 'Seu nome'
--   where id = (select id from auth.users where email = 'SEU-EMAIL-AQUI');
--
-- Para o admin: crie a conta dele do mesmo jeito e rode a mesma linha com papel = 'admin'.
-- Colaborador: crie a conta (já nasce colaborador) e libere o setor dele em acessos_setor.
-- =====================================================================
