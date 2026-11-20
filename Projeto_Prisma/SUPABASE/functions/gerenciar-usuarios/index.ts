// PRISMA — função "gerenciar-usuarios" (Supabase Edge Function)
// Roda DENTRO do Supabase, nunca no navegador. É ela que usa a chave mestra (service role),
// que o próprio Supabase entrega por variável de ambiente: a chave não aparece em nenhum arquivo.
//
// O que faz (só para quem é GESTOR e está ativo — conferido aqui, no servidor):
//   criar          → cria a conta com senha provisória, papel, nome e setores
//   redefinir      → coloca uma nova senha provisória (a pessoa troca no próximo acesso)
//   bloquear       → corta o acesso (perfil inativo + conta suspensa no login)
//   desbloquear    → devolve o acesso
// Papel e setores o site muda direto nas tabelas (o RLS já só deixa o gestor).
// Cada ação fica registrada no histórico com quem fez.

import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const CORS = {
  "Access-Control-Allow-Origin": "*", // o acesso é pelo token do login (não por cookie), então "*" não abre brecha
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const PAPEIS = ["gestor", "admin", "colaborador"];
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const erro = (mensagem: string, status = 400) => resposta({ ok: false, erro: mensagem }, status);

// senha provisória: pelo menos 8 caracteres, com letra e número
const senhaValida = (s: unknown) => typeof s === "string" && s.length >= 8 && s.length <= 72 && /[A-Za-z]/.test(s) && /\d/.test(s);
const emailValido = (e: unknown) => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;
const uuidValido = (u: unknown) => typeof u === "string" && /^[0-9a-f-]{36}$/i.test(u);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return erro("Método não permitido.", 405);

  // chave mestra: o Supabase entrega numa destas variáveis (a antiga ou a lista das chaves secretas novas)
  let chaveMestra = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!chaveMestra) {
    try { const lista = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); chaveMestra = lista.default || Object.values(lista)[0] || ""; } catch { /* sem chave */ }
  }
  if (!chaveMestra) return erro("Função sem configuração.", 500);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, chaveMestra, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) quem está pedindo? (token do login que o site manda)
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: quem, error: erroQuem } = await admin.auth.getUser(token);
  if (erroQuem || !quem?.user) return erro("Sessão inválida. Entre de novo.", 401);

  // 2) é gestor e está ativo?
  const { data: perfil } = await admin.from("perfis").select("papel, ativo").eq("id", quem.user.id).maybeSingle();
  if (!perfil || perfil.papel !== "gestor" || !perfil.ativo) return erro("Só o gestor pode gerenciar usuários.", 403);

  let corpo: Record<string, unknown>;
  try { corpo = await req.json(); } catch { return erro("Pedido inválido."); }
  const acao = corpo.acao;

  const registrar = (acaoHist: string, alvo: string, detalhe: Record<string, unknown>) =>
    admin.from("historico").insert({ usuario_id: quem.user.id, tabela: "contas", acao: acaoHist, depois: { alvo, ...detalhe } });

  // ---------- criar ----------
  if (acao === "criar") {
    const email = String(corpo.email || "").trim().toLowerCase();
    const nome = String(corpo.nome || "").trim().slice(0, 120);
    const papel = String(corpo.papel || "colaborador");
    const setores = Array.isArray(corpo.setores) ? corpo.setores.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
    if (!emailValido(email)) return erro("E-mail inválido.");
    if (!nome) return erro("Informe o nome.");
    if (!PAPEIS.includes(papel)) return erro("Papel inválido.");
    if (!senhaValida(corpo.senha)) return erro("A senha provisória precisa de 8 caracteres ou mais, com letras e números.");

    const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
      email, password: corpo.senha as string, email_confirm: true, user_metadata: { nome },
    });
    if (erroCriar || !criado?.user) {
      const jaExiste = /already|registered|exists/i.test(erroCriar?.message || "");
      return erro(jaExiste ? "Já existe uma conta com esse e-mail." : "Não foi possível criar a conta.");
    }
    const id = criado.user.id;
    // o gatilho do banco já criou o perfil como colaborador; aqui ajusto papel, nome e a troca de senha
    await admin.from("perfis").update({ nome, papel, trocar_senha: true }).eq("id", id);
    if (setores.length) await admin.from("acessos_setor").insert(setores.map((s) => ({ usuario_id: id, setor_id: s })));
    await registrar("CRIAR_CONTA", id, { email, papel, setores });
    return resposta({ ok: true, id });
  }

  // as outras ações mexem numa conta que já existe
  const alvo = corpo.id;
  if (!uuidValido(alvo)) return erro("Usuário inválido.");

  if (acao === "redefinir") {
    if (!senhaValida(corpo.senha)) return erro("A senha provisória precisa de 8 caracteres ou mais, com letras e números.");
    const { error } = await admin.auth.admin.updateUserById(alvo as string, { password: corpo.senha as string });
    if (error) return erro("Não foi possível redefinir a senha.");
    await admin.from("perfis").update({ trocar_senha: true }).eq("id", alvo);
    await registrar("REDEFINIR_SENHA", alvo as string, {});
    return resposta({ ok: true });
  }

  if (acao === "bloquear" || acao === "desbloquear") {
    if (alvo === quem.user.id) return erro("Você não pode bloquear a sua própria conta.");
    const bloquear = acao === "bloquear";
    const { error } = await admin.auth.admin.updateUserById(alvo as string, { ban_duration: bloquear ? "876000h" : "none" });
    if (error) return erro("Não foi possível mudar o acesso.");
    await admin.from("perfis").update({ ativo: !bloquear }).eq("id", alvo);
    await registrar(bloquear ? "BLOQUEAR" : "DESBLOQUEAR", alvo as string, {});
    return resposta({ ok: true });
  }

  return erro("Ação desconhecida.");
});
