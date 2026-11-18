/* PRISMA — Login

   ⚠️ TEMPORÁRIO: enquanto o Supabase Auth não entra (CLAUDE.md, seção 2), a
   verificação abaixo é só de demonstração e acontece no navegador. Ela NÃO é
   segura e será trocada pela chamada ao Supabase. Por isso só existe o acesso
   de teste, sem nenhuma conta real aqui.
*/
(() => {
  "use strict";

  const ACESSO_TESTE = { email: "teste@corporativo.com", senha: "prisma2026" };
  const DESTINO = "./visao-geral.html";
  const DURACAO = 2800;            // ms da luz entrando até a troca de página
  const MAX_TENTATIVAS = 5;        // depois disso, espera
  const ESPERA_BLOQUEIO = 30;      // segundos

  const $ = (id) => document.getElementById(id);
  const form = $("formLogin");
  const email = $("email");
  const senha = $("senha");
  const aviso = $("aviso");
  const botao = $("botaoEntrar");
  const cartao = $("painelLogin");
  const balao = $("balao");
  const balaoTexto = $("balaoTexto");
  const roboEl = $("robo");
  const mostrarSenha = $("mostrarSenha");

  const robo = window.PrismaRobo || { expressao() {}, reagir() {}, erro() {}, olharPara() {}, brilho() {} };
  const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- fala do robô ---------- */

  let digitacao = null;

  function falar(texto) {
    clearInterval(digitacao);
    if (reduzir) { balaoTexto.textContent = texto; return; }
    let i = 0;
    balaoTexto.textContent = "";
    balao.classList.add("digitando");
    digitacao = setInterval(() => {
      i += 1;
      balaoTexto.textContent = texto.slice(0, i);
      if (i >= texto.length) {
        clearInterval(digitacao);
        balao.classList.remove("digitando");
      }
    }, 22);
  }

  function mostrarAviso(texto, tipo = "erro") {
    aviso.textContent = texto;
    aviso.classList.toggle("sucesso", tipo === "sucesso");
  }

  /* ---------- reações aos campos ---------- */

  email.addEventListener("focus", () => {
    robo.olharPara(email);
    if (!roboEl.classList.contains("erro")) robo.expressao("normal");
    falar("Use o seu e-mail corporativo.");
  });

  senha.addEventListener("focus", () => {
    robo.olharPara(null);
    if (!roboEl.classList.contains("erro")) robo.expressao("discreto");
    falar("Pode digitar a senha. Não estou olhando!");
  });

  [email, senha].forEach((campo) => {
    campo.addEventListener("blur", () => {
      robo.olharPara(null);
      if (!roboEl.classList.contains("erro") && !enviando) robo.expressao("normal");
    });
    campo.addEventListener("input", () => {
      if (aviso.textContent && !bloqueadoAte) mostrarAviso("");
    });
  });

  mostrarSenha.addEventListener("click", () => {
    const ver = senha.type === "password";
    senha.type = ver ? "text" : "password";
    mostrarSenha.setAttribute("aria-pressed", String(ver));
    mostrarSenha.setAttribute("aria-label", ver ? "Esconder senha" : "Mostrar senha");
    senha.focus();
  });

  roboEl.addEventListener("click", () => {
    if (enviando || roboEl.classList.contains("erro")) return;
    robo.reagir("feliz", 1400);
    falar("Oi! Estou pronto para mostrar os indicadores.");
  });

  $("esqueciSenha").addEventListener("click", () => {
    mostrarAviso("A recuperação de senha chega junto com o login seguro. Por enquanto, use o acesso de teste.", "info");
    aviso.classList.remove("sucesso");
    aviso.style.color = "var(--p-texto-2)";
    setTimeout(() => (aviso.style.color = ""), 6000);
  });

  $("acessoTeste").addEventListener("click", () => {
    email.value = ACESSO_TESTE.email;
    senha.value = ACESSO_TESTE.senha;
    mostrarAviso("");
    robo.reagir("feliz", 1200);
    falar("Acesso de teste preenchido. É só clicar em Entrar!");
    botao.focus();
  });

  /* ---------- limite de tentativas ---------- */

  let tentativas = 0;
  let bloqueadoAte = 0;
  let relogio = null;

  function bloquear() {
    bloqueadoAte = Date.now() + ESPERA_BLOQUEIO * 1000;
    botao.disabled = true;
    const tick = () => {
      const falta = Math.ceil((bloqueadoAte - Date.now()) / 1000);
      if (falta <= 0) {
        clearInterval(relogio);
        bloqueadoAte = 0;
        tentativas = 0;
        botao.disabled = false;
        mostrarAviso("");
        return;
      }
      mostrarAviso(`Muitas tentativas. Tente de novo em ${falta} s.`);
    };
    tick();
    relogio = setInterval(tick, 1000);
  }

  /* ---------- envio ---------- */

  let enviando = false;

  function recusar(texto, fala) {
    mostrarAviso(texto);
    falar(fala);
    robo.olharPara(null);
    robo.erro(2400);
    cartao.classList.remove("tremer");
    void cartao.offsetWidth;
    cartao.classList.add("tremer");
  }

  const normalizar = (v) => String(v || "").trim().toLowerCase();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (enviando || bloqueadoAte) return;

    const em = normalizar(email.value);
    const se = senha.value;

    if (!em || !se) {
      recusar("Preencha o e-mail e a senha.", "Faltou alguma informação.");
      (!em ? email : senha).focus();
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      recusar("Informe um e-mail válido.", "Esse e-mail parece incompleto.");
      email.focus();
      return;
    }

    // ⚠️ verificação temporária (ver o topo do arquivo)
    const ok = em === ACESSO_TESTE.email && se === ACESSO_TESTE.senha;

    if (!ok) {
      tentativas += 1;
      senha.value = "";
      // mensagem igual para e-mail ou senha errados: não revela qual dos dois falhou
      recusar("E-mail ou senha incorretos.", "Hmm... não reconheci esse acesso. Confira seus dados.");
      if (tentativas >= MAX_TENTATIVAS) bloquear();
      return;
    }

    entrar();
  });

  function entrar() {
    enviando = true;
    tentativas = 0;

    try { window.SomPrisma && !reduzir && window.SomPrisma.preparar(); } catch (_) { /* sem som */ }

    botao.disabled = true;
    botao.querySelector("span").textContent = "Acessando...";
    mostrarAviso("Acesso autorizado. Abrindo a Visão Geral...", "sucesso");
    senha.blur();
    email.blur();

    robo.olharPara(null);
    robo.expressao("feliz");
    falar("Tudo certo! Sua visão geral está a caminho.");

    try { sessionStorage.setItem("prisma-portal", "1"); } catch (_) { /* segue sem a chegada */ }

    setTimeout(() => {
      // o som nunca pode impedir a entrada
      try { window.SomPrisma && !reduzir && window.SomPrisma.tocar(DURACAO / 1000); } catch (erro) { console.warn("Som indisponível:", erro); }

      setTimeout(() => document.body.classList.add("saindo"), DURACAO * 0.55);

      const irPara = () => window.location.assign(DESTINO);
      if (window.PrismaLuz) {
        window.PrismaLuz.transicao({
          duracao: DURACAO,
          cartao,
          aoAtingirCartao: () => cartao.classList.add("atingido"),
          aoTerminar: irPara
        });
      } else {
        setTimeout(irPara, 300);
      }
    }, reduzir ? 0 : 350);
  }

  /* ---------- voltar pelo histórico ---------- */

  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    enviando = false;
    window.PrismaLuz && window.PrismaLuz.cancelar();
    document.body.classList.remove("saindo");
    cartao.classList.remove("atingido");
    botao.disabled = false;
    botao.querySelector("span").textContent = "Entrar";
    senha.value = "";
    mostrarAviso("");
    robo.expressao("normal");
  });
})();
