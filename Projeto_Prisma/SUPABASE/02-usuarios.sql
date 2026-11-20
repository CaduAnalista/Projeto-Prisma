-- =====================================================================
-- PRISMA — Banco · Etapa 2: tela "Usuários" (só o gestor) e troca de senha
-- Rodar UMA vez, depois do 01-base-acesso.sql (SQL Editor > New query > Run).
--
-- Decisões do autor (19/11/2026):
--   * Só o GESTOR cria logins, e pelo próprio site (sem entrar no Supabase).
--   * A conta nasce com uma SENHA PROVISÓRIA que o gestor passa para a pessoa;
--     no primeiro acesso o site obriga a pessoa a trocar por uma senha só dela.
--   * Na mesma tela o gestor muda papel e setores, bloqueia/desbloqueia e redefine senha.
--
-- Criar conta e mexer em senha precisam da chave mestra do Supabase, que NUNCA vai para o site.
-- Por isso isso é feito pela função "gerenciar-usuarios" (Edge Function, roda dentro do Supabase),
-- que confere no servidor se quem pediu é gestor. Este arquivo NÃO tem chave nem senha.
-- =====================================================================


-- ---------- 1. Perfil: e-mail (para a lista do gestor) e "precisa trocar a senha" ----------
alter table public.perfis add column email text not null default '';
alter table public.perfis add column trocar_senha boolean not null default false;

-- quem já existe recebe o e-mail da conta
update public.perfis p set email = u.email from auth.users u where u.id = p.id;

-- daqui em diante o perfil já nasce com o e-mail
create or replace function public.criar_perfil()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', ''), coalesce(new.email, ''));
  return new;
end;
$$;
revoke execute on function public.criar_perfil() from public, anon, authenticated;


-- ---------- 2. A própria pessoa avisa que já trocou a senha ----------
-- Ela não pode mexer no próprio perfil (não tem política para isso), então só esta função
-- desliga o "trocar_senha" — e só da própria conta.
create or replace function public.senha_trocada()
returns void
language sql security definer set search_path = ''
as $$
  update public.perfis set trocar_senha = false where id = (select auth.uid());
$$;
revoke execute on function public.senha_trocada() from public, anon;
grant execute on function public.senha_trocada() to authenticated;


-- ---------- 3. Página "Usuários": só o gestor abre ----------
insert into public.paginas (codigo, nome) values ('usuarios', 'Usuários');
insert into public.permissoes_pagina (papel, pagina) values ('gestor', 'usuarios');


-- ---------- 4. O admin não mexe mais em contas (decisão de 19/11/2026: só o gestor) ----------
drop policy if exists "perfis: admin altera colaborador" on public.perfis;
drop policy if exists "acessos: admin altera colaborador" on public.acessos_setor;
