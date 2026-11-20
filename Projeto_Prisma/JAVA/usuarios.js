/* PRISMA — Usuários (só o gestor)
   Esta página roda dentro do iframe da Visão geral e usa o login que já está aberto lá
   (parent.PrismaSessao), então não precisa de outra sessão.
   - Criar conta, redefinir senha e bloquear: pela função "gerenciar-usuarios" do Supabase
     (é ela que tem a chave mestra; o site nunca vê essa chave).
   - Papel e setores: direto nas tabelas, porque o RLS só deixa o gestor mudar.
   Todo texto que vem do banco entra com textContent (nunca innerHTML). Nada vai para o console. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // uso o login da Visão geral; se o navegador não deixar acessar (ex.: arquivo aberto direto
  // da pasta), uso o sessao.js que esta própria página carrega. Antes, esse bloqueio derrubava
  // o script inteiro e os botões "Gerar" e "Criar usuário" ficavam sem fazer nada.
  let sessao = null;
  try { if (window.parent !== window && window.parent.PrismaSessao) sessao = window.parent.PrismaSessao; } catch (_) { sessao = null; }
  if (!sessao) sessao = window.PrismaSessao || null;
  const sb = sessao && sessao.configurado ? sessao.cliente() : null;

  const PAPEIS = { gestor: "Gestor", admin: "Admin", colaborador: "Colaborador" };
  let setores = [];          // [{id, nome}]
  let meuId = null;

  // ---------- utilidades ----------
  function el(tag, props = {}, filhos = []) {
    const n = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === "texto") n.textContent = v;
      else if (k === "classe") n.className = v;
      else if (k in n) n[k] = v;
      else n.setAttribute(k, v);
    });
    filhos.forEach((f) => f && n.appendChild(f));
    return n;
  }

  function mensagem(alvo, texto, tipo = "") {
    alvo.className = "mensagem" + (tipo ? " " + tipo : "");
    alvo.textContent = texto;
  }

  // senha provisória: 10 caracteres sem os que confundem (0/O, 1/l/I), sempre com letra e número
  function gerarSenha() {
    const letras = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
    const numeros = "23456789";
    const todos = letras + numeros;
    const sorteio = new Uint32Array(10);
    crypto.getRandomValues(sorteio);
    let s = Array.from(sorteio, (n) => todos[n % todos.length]);
    s[0] = letras[sorteio[0] % letras.length];
    s[9] = numeros[sorteio[9] % numeros.length];
    return s.join("");
  }

  const senhaValida = (s) => s.length >= 8 && s.length <= 72 && /[A-Za-z]/.test(s) && /\d/.test(s);

  // chama a função do Supabase e devolve { ok, erro }
  async function chamarFuncao(corpo) {
    try {
      const { data, error } = await sb.functions.invoke("gerenciar-usuarios", { body: corpo });
      if (!error) return data || { ok: false, erro: "Resposta vazia." };
      try { const j = await error.context.json(); return { ok: false, erro: j.erro || "Não deu certo." }; }
      catch (_) { return { ok: false, erro: "Não foi possível falar com o servidor." }; }
    } catch (_) {
      return { ok: false, erro: "Sem conexão. Tente de novo." };
    }
  }

  // ---------- caixinhas de setor ----------
  function montarSetores(caixa, marcados = []) {
    caixa.replaceChildren();
    setores.forEach((s) => {
      const cb = el("input", { type: "checkbox", value: String(s.id), checked: marcados.includes(s.id) });
      caixa.appendChild(el("label", { classe: "opcao-setor" }, [cb, el("span", { texto: s.nome })]));
    });
  }
  const setoresMarcados = (caixa) =>
    Array.from(caixa.querySelectorAll("input:checked")).map((c) => Number(c.value));

  // ---------- novo usuário ----------
  const form = $("formNovo");
  const msgNovo = $("msgNovo");

  // gestor e admin já veem todos os setores, então a escolha de setores só aparece para colaborador
  function atualizarBlocoSetores() { $("blocoSetores").hidden = $("novoPapel").value !== "colaborador"; }
  $("novoPapel").addEventListener("change", atualizarBlocoSetores);
  $("gerarSenha").addEventListener("click", () => { $("novaSenha").value = gerarSenha(); });
  form.addEventListener("reset", () => setTimeout(() => { atualizarBlocoSetores(); mensagem(msgNovo, ""); }, 0));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = $("novoNome").value.trim();
    const email = $("novoEmail").value.trim().toLowerCase();
    const papel = $("novoPapel").value;
    const senha = $("novaSenha").value;
    const lista = papel === "colaborador" ? setoresMarcados($("novoSetores")) : [];

    if (!nome) return mensagem(msgNovo, "Informe o nome.", "erro");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return mensagem(msgNovo, "E-mail inválido.", "erro");
    if (!senhaValida(senha)) return mensagem(msgNovo, "A senha provisória precisa de 8 caracteres ou mais, com letras e números.", "erro");
    if (papel === "colaborador" && !lista.length) return mensagem(msgNovo, "Escolha pelo menos um setor para o colaborador.", "erro");

    const botao = $("botaoCriar");
    botao.disabled = true; botao.textContent = "Criando...";
    const r = await chamarFuncao({ acao: "criar", nome, email, papel, senha, setores: lista });
    botao.disabled = false; botao.textContent = "Criar usuário";

    if (!r.ok) return mensagem(msgNovo, r.erro, "erro");
    form.reset();
    // mostro a senha uma vez, na tela, para o gestor passar para a pessoa
    // (depois do "reset", que limpa a mensagem — por isso o setTimeout)
    setTimeout(() => {
      msgNovo.className = "mensagem sucesso";
      msgNovo.replaceChildren(
        document.createTextNode(`Conta criada para ${email}. Senha provisória:`),
        el("span", { classe: "senha-entregue", texto: senha })
      );
    }, 0);
    carregarLista();
  });

  // ---------- lista de contas ----------
  const corpo = $("corpoTabela");
  const msgLista = $("msgLista");

  async function carregarLista() {
    // "Carregando..." só na primeira vez, para não apagar o aviso de sucesso das ações
    const primeira = !corpo.children.length;
    if (primeira) mensagem(msgLista, "Carregando...");
    const [perfis, acessos] = await Promise.all([
      sb.from("perfis").select("id, nome, email, papel, ativo, trocar_senha").order("nome"),
      sb.from("acessos_setor").select("usuario_id, setor_id")
    ]);
    if (perfis.error || acessos.error) return mensagem(msgLista, "Não consegui carregar as contas.", "erro");
    if (primeira) mensagem(msgLista, "");

    const porUsuario = {};
    acessos.data.forEach((a) => { (porUsuario[a.usuario_id] = porUsuario[a.usuario_id] || []).push(a.setor_id); });
    const nomeSetor = Object.fromEntries(setores.map((s) => [s.id, s.nome]));

    $("contagem").textContent = `${perfis.data.length} conta(s)`;
    corpo.replaceChildren();
    perfis.data.forEach((p) => corpo.appendChild(linha(p, porUsuario[p.id] || [], nomeSetor)));
  }

  function linha(p, meusSetores, nomeSetor) {
    const souEu = p.id === meuId;

    // nome
    const tdNome = el("td", {}, [el("span", { texto: p.nome || "(sem nome)" })]);
    if (souEu) tdNome.appendChild(el("span", { classe: "eu", texto: "(você)" }));

    // papel (o gestor não muda o próprio papel, para não perder o acesso a esta página)
    const sel = el("select", { "aria-label": `Papel de ${p.email}`, disabled: souEu });
    Object.entries(PAPEIS).forEach(([v, t]) => sel.appendChild(el("option", { value: v, texto: t, selected: v === p.papel })));
    sel.addEventListener("change", async () => {
      sel.disabled = true;
      const { error } = await sb.from("perfis").update({ papel: sel.value }).eq("id", p.id);
      if (error) { mensagem(msgLista, "Não foi possível mudar o papel.", "erro"); sel.value = p.papel; }
      else mensagem(msgLista, `Papel de ${p.email} mudado para ${PAPEIS[sel.value]}.`, "sucesso");
      carregarLista();
    });

    // setores
    const textoSetores = p.papel === "colaborador"
      ? (meusSetores.map((id) => nomeSetor[id]).filter(Boolean).join(", ") || "Nenhum")
      : "Todos (pelo papel)";

    // situação
    const tdSituacao = el("td", {}, [el("span", { classe: "selo " + (p.ativo ? "ativo" : "bloqueado"), texto: p.ativo ? "Ativo" : "Bloqueado" })]);
    if (p.trocar_senha) tdSituacao.appendChild(el("span", { classe: "selo trocar", texto: "Senha provisória" }));

    // ações
    const bSetores = el("button", { type: "button", classe: "mini", texto: "Setores", disabled: p.papel !== "colaborador" });
    bSetores.addEventListener("click", () => editarSetores(p, meusSetores));
    const bSenha = el("button", { type: "button", classe: "mini", texto: "Redefinir senha" });
    bSenha.addEventListener("click", () => redefinirSenha(p));
    const acoes = [bSetores, bSenha];
    if (!souEu) {
      const bBloq = el("button", { type: "button", classe: "mini" + (p.ativo ? " perigo" : ""), texto: p.ativo ? "Bloquear" : "Desbloquear" });
      bBloq.addEventListener("click", () => bloquear(p));
      acoes.push(bBloq);
    }

    return el("tr", {}, [
      tdNome,
      el("td", { texto: p.email }),
      el("td", {}, [sel]),
      el("td", { classe: "setores-texto", texto: textoSetores }),
      tdSituacao,
      el("td", {}, [el("div", { classe: "acoes-linha" }, acoes)])
    ]);
  }

  // ---------- janela (setores e senha) ----------
  const janela = $("janela");
  let aoConfirmar = null;
  $("janelaCancelar").addEventListener("click", () => janela.close());
  $("janelaForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!aoConfirmar) return janela.close();
    $("janelaOk").disabled = true;
    const fechar = await aoConfirmar();
    $("janelaOk").disabled = false;
    if (fechar) janela.close();
  });

  function abrirJanela(titulo, sub, conteudo, botao, acao) {
    $("janelaTitulo").textContent = titulo;
    $("janelaSub").textContent = sub;
    $("janelaConteudo").replaceChildren(conteudo);
    $("janelaOk").textContent = botao;
    mensagem($("janelaMsg"), "");
    aoConfirmar = acao;
    janela.showModal();
  }

  function editarSetores(p, atuais) {
    const caixa = el("div", { classe: "lista-setores" });
    montarSetores(caixa, atuais);
    abrirJanela("Setores", `${p.nome || p.email} vê o CRM destes setores.`, caixa, "Salvar", async () => {
      const novos = setoresMarcados(caixa);
      if (!novos.length) { mensagem($("janelaMsg"), "Escolha pelo menos um setor.", "erro"); return false; }
      const sair = atuais.filter((s) => !novos.includes(s));
      const entrar = novos.filter((s) => !atuais.includes(s));
      if (sair.length) {
        const { error } = await sb.from("acessos_setor").delete().eq("usuario_id", p.id).in("setor_id", sair);
        if (error) { mensagem($("janelaMsg"), "Não foi possível salvar.", "erro"); return false; }
      }
      if (entrar.length) {
        const { error } = await sb.from("acessos_setor").insert(entrar.map((s) => ({ usuario_id: p.id, setor_id: s })));
        if (error) { mensagem($("janelaMsg"), "Não foi possível salvar.", "erro"); return false; }
      }
      mensagem(msgLista, `Setores de ${p.email} atualizados.`, "sucesso");
      carregarLista();
      return true;
    });
  }

  function redefinirSenha(p) {
    const campo = el("input", { type: "text", maxLength: 72, value: gerarSenha(), spellcheck: false, autocomplete: "off", "aria-label": "Nova senha provisória" });
    abrirJanela("Redefinir senha", `Nova senha provisória para ${p.email}. A pessoa troca no próximo acesso.`, campo, "Redefinir", async () => {
      const senha = campo.value;
      if (!senhaValida(senha)) { mensagem($("janelaMsg"), "8 caracteres ou mais, com letras e números.", "erro"); return false; }
      const r = await chamarFuncao({ acao: "redefinir", id: p.id, senha });
      if (!r.ok) { mensagem($("janelaMsg"), r.erro, "erro"); return false; }
      msgLista.className = "mensagem sucesso";
      msgLista.replaceChildren(
        document.createTextNode(`Senha de ${p.email} redefinida. Senha provisória:`),
        el("span", { classe: "senha-entregue", texto: senha })
      );
      carregarLista();
      return true;
    });
  }

  function bloquear(p) {
    const vaiBloquear = p.ativo;
    const texto = el("p", { texto: vaiBloquear
      ? "A pessoa deixa de conseguir entrar no PRISMA. A conta e o histórico continuam guardados e dá para desbloquear depois."
      : "A pessoa volta a conseguir entrar com a senha que já tinha." });
    abrirJanela(vaiBloquear ? "Bloquear acesso" : "Desbloquear acesso", p.email, texto, vaiBloquear ? "Bloquear" : "Desbloquear", async () => {
      const r = await chamarFuncao({ acao: vaiBloquear ? "bloquear" : "desbloquear", id: p.id });
      if (!r.ok) { mensagem($("janelaMsg"), r.erro, "erro"); return false; }
      mensagem(msgLista, `${p.email} ${vaiBloquear ? "bloqueado" : "desbloqueado"}.`, "sucesso");
      carregarLista();
      return true;
    });
  }

  // ---------- início ----------
  async function iniciar() {
    // o "Gerar" não depende do banco: já funciona aqui
    $("gerarSenha").disabled = false;
    mensagem(msgNovo, "");
    if (!sb) {
      mensagem(msgNovo, "Não encontrei o acesso ao Supabase nesta página. Confira se LIB/supabase.js, JAVA/supabase-config.js e JAVA/sessao.js foram enviados junto com o site.", "erro");
      return;
    }
    const { data: u } = await sb.auth.getUser();
    meuId = u && u.user ? u.user.id : null;
    if (!meuId) {
      mensagem(msgNovo, "Não achei o seu login nesta página. Abra o PRISMA pelo endereço do site (não pelo arquivo da pasta), entre de novo e volte aqui.", "erro");
      return;
    }
    $("botaoCriar").disabled = false;
    const { data, error } = await sb.from("setores").select("id, nome").order("nome");
    if (!error) setores = data;
    montarSetores($("novoSetores"));
    atualizarBlocoSetores();
    carregarLista();
  }
  iniciar();
})();
