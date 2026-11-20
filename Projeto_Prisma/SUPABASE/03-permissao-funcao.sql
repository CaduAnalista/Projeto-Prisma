-- =====================================================================
-- PRISMA — Banco · Etapa 3: deixar a função "gerenciar-usuarios" ler e gravar
-- Rodar UMA vez, depois do 02-usuarios.sql.
--
-- Criei o projeto com "dar acesso automático às tabelas novas" DESLIGADO (mais seguro),
-- então nem o papel interno da função (service_role) tinha permissão nas tabelas.
-- Aqui eu libero só as tabelas que a função usa. O service_role nunca vai para o site:
-- ele só existe dentro do Supabase.
-- =====================================================================

grant select, update on public.perfis to service_role;
grant select, insert on public.acessos_setor to service_role;
grant insert on public.historico to service_role;
grant usage, select on all sequences in schema public to service_role;
