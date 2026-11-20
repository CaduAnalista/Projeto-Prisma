/* PRISMA — sessão de login (Supabase Auth)
   Usado pelo login e pela Visão geral (a casca com o menu).
   - Sem o Supabase configurado (supabase-config.js vazio), tudo segue no modo de demonstração.
   - Com o Supabase: sem sessão volta para o login; o menu só mostra as páginas que o papel da pessoa abre.
   A sessão fica no sessionStorage (e não no localStorage): fechar a aba encerra o acesso,
   e nada da conta fica guardado no computador depois disso.
   Lembrete: isto só organiza a tela. Quem protege os dados de verdade é o RLS do banco. */
(() => {
  "use strict";

  const cfg = window.PRISMA_SUPABASE || {};
  const configurado = !!(cfg.url && cfg.chave && window.supabase && window.supabase.createClient);
  let cliente = null;
  let perfilCache = null;

  function obterCliente() {
    if (!configurado) return null;
    if (!cliente) {
      cliente = window.supabase.createClient(cfg.url, cfg.chave, {
        auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
    }
    return cliente;
  }

  /* login: devolve { ok } ou { ok:false, motivo } — a mensagem para a tela é sempre genérica */
  async function entrar(email, senha) {
    const sb = obterCliente();
    if (!sb) return { ok: false, motivo: "nao-configurado" };
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) return { ok: false, motivo: error.status === 429 ? "muitas-tentativas" : "credenciais" };
    // conta bloqueada (ativo = false) ou sem perfil: não entra
    const perfil = await carregarPerfil(true);
    if (!perfil || !perfil.ativo) { await sb.auth.signOut(); return { ok: false, motivo: "bloqueado" }; }
    return { ok: true };
  }

  async function carregarPerfil(forcar = false) {
    const sb = obterCliente();
    if (!sb) return null;
    if (perfilCache && !forcar) return perfilCache;
    const { data: sessao } = await sb.auth.getSession();
    const usuario = sessao && sessao.session && sessao.session.user;
    if (!usuario) return null;
    const { data: perfil, error } = await sb.from("perfis").select("nome, papel, ativo, trocar_senha").eq("id", usuario.id).maybeSingle();
    if (error || !perfil) return null;
    const { data: permissoes } = await sb.from("permissoes_pagina").select("pagina").eq("papel", perfil.papel);
    perfilCache = {
      nome: perfil.nome || "",
      email: usuario.email || "",
      papel: perfil.papel,
      ativo: perfil.ativo,
      trocarSenha: !!perfil.trocar_senha,   // conta com senha provisória: precisa trocar antes de usar
      paginas: new Set((permissoes || []).map((p) => p.pagina))
    };
    return perfilCache;
  }

  /* troca da senha provisória pela senha da própria pessoa */
  async function trocarSenha(nova) {
    const sb = obterCliente();
    if (!sb) return { ok: false, erro: "Login não configurado." };
    const { error } = await sb.auth.updateUser({ password: nova });
    if (error) {
      const igual = /different|same/i.test(error.message || "");
      return { ok: false, erro: igual ? "A nova senha precisa ser diferente da provisória." : "Não foi possível trocar a senha. Tente de novo." };
    }
    await sb.rpc("senha_trocada");
    if (perfilCache) perfilCache.trocarSenha = false;
    return { ok: true };
  }

  function irParaLogin() {
    try { sessionStorage.removeItem("prisma-portal"); } catch (_) { /* sem problema */ }
    (window.top || window).location.replace(new URL("./login.html", document.baseURI).href);
  }

  /* Visão geral: confere a sessão antes de mostrar a tela */
  async function protegerCasca() {
    if (!configurado) return null;
    const raiz = document.documentElement;
    raiz.style.visibility = "hidden";              // nada aparece antes de conferir o login
    const perfil = await carregarPerfil().catch(() => null);
    if (!perfil || !perfil.ativo) { irParaLogin(); return null; }
    raiz.style.visibility = "";
    return perfil;
  }

  async function sair() {
    const sb = obterCliente();
    perfilCache = null;
    if (sb) { try { await sb.auth.signOut(); } catch (_) { /* sai mesmo assim */ } }
    irParaLogin();
  }

  // páginas abertas dentro do iframe perguntam aqui se podem aparecer
  function podePagina(codigo) {
    if (!configurado) return true;
    // enquanto a senha provisória não for trocada, nenhuma página abre
    return !!(perfilCache && perfilCache.ativo && !perfilCache.trocarSenha && perfilCache.paginas.has(codigo));
  }

  window.PrismaSessao = { configurado, entrar, carregarPerfil, protegerCasca, sair, podePagina, trocarSenha, cliente: obterCliente };
})();
