/*
=====================================================
 PRISMA — PONTE DO TUTORIAL (fica dentro de cada painel)
 O tutorial roda na Visão Geral, mas o painel abre num iframe.
 Quando o site é aberto direto do computador (file://), o navegador
 não deixa a Visão Geral mexer no conteúdo do iframe. Por isso cada
 painel carrega esta ponte: ela recebe o pedido por mensagem, acha o
 elemento, rola até ele e devolve a posição na tela.
 Só troca seletores e posições (nenhum dado da planilha sai daqui).
=====================================================
*/

(() => {
  "use strict";
  if (window.parent === window) return;

  let alvo = null;
  let idPasso = 0;
  let quadro = 0;
  let ultimo = "";

  const responder = (mensagem) => window.parent.postMessage({ tut: true, ...mensagem }, "*");

  function achar(seletor) {
    try { return seletor ? document.querySelector(seletor) : null; } catch (_) { return null; }
  }

  function visivel(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  /* ações pedidas antes do passo: "clique em X se Y existir" (ex.: abrir o painel de filtros) */
  function executar(acoes) {
    (acoes || []).forEach((a) => {
      if (a.se && !achar(a.se)) return;
      const botao = achar(a.clicar);
      if (botao) botao.click();
    });
  }

  /* algumas páginas encaixam a rolagem (scroll-snap); durante o tutorial eu desligo */
  function desligarEncaixe() {
    const raiz = document.documentElement;
    if (raiz.dataset.tutEncaixe) return;
    raiz.dataset.tutEncaixe = "1";
    raiz.style.setProperty("scroll-snap-type", "none", "important");
  }
  function religarEncaixe() {
    const raiz = document.documentElement;
    if (!raiz.dataset.tutEncaixe) return;
    delete raiz.dataset.tutEncaixe;
    raiz.style.removeProperty("scroll-snap-type");
  }

  /* mando a posição do alvo sempre que ela muda (rolagem, gráfico redesenhando...) */
  function acompanhar() {
    if (!alvo) return;
    let r = null;
    if (alvo.isConnected) {
      const b = alvo.getBoundingClientRect();
      r = {
        left: Math.max(0, b.left),
        top: Math.max(0, b.top),
        right: Math.min(window.innerWidth, b.right),
        bottom: Math.min(window.innerHeight, b.bottom)
      };
    }
    const chave = r ? [r.left, r.top, r.right, r.bottom].map(Math.round).join(",") : "x";
    if (chave !== ultimo) {
      ultimo = chave;
      responder({ tipo: "ret", id: idPasso, r });
    }
    quadro = requestAnimationFrame(acompanhar);
  }

  function parar() {
    cancelAnimationFrame(quadro);
    alvo = null;
    ultimo = "";
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window.parent) return;
    const m = e.data;
    if (!m || m.tut !== true) return;

    if (m.tipo === "pronto?") {
      responder({ tipo: "pronto", id: m.id, arquivo: location.pathname, tem: Boolean(achar(m.seletor)) });
      return;
    }

    if (m.tipo === "passo") {
      parar();
      idPasso = m.id;
      desligarEncaixe();
      executar(m.antes);
      /* espero um instante para o que foi clicado aparecer */
      setTimeout(() => {
        if (idPasso !== m.id) return;
        const el = achar(m.alvo);
        if (!visivel(el)) { responder({ tipo: "alvo", id: m.id, existe: false }); return; }
        alvo = el;
        const opcoes = { block: m.bloco || "center", inline: "nearest" };
        try { el.scrollIntoView({ ...opcoes, behavior: m.suave ? "smooth" : "auto" }); } catch (_) { el.scrollIntoView(); }
        /* se a rolagem suave não aconteceu, rolo direto */
        setTimeout(() => {
          if (idPasso !== m.id || !el.isConnected) return;
          const b = el.getBoundingClientRect();
          if (b.bottom <= 0 || b.top >= window.innerHeight) {
            try { el.scrollIntoView({ ...opcoes, behavior: "auto" }); } catch (_) { el.scrollIntoView(); }
          }
        }, 700);
        responder({ tipo: "alvo", id: m.id, existe: true });
        acompanhar();
      }, 80);
      return;
    }

    /* passo seguinte é no menu ou sem alvo: só paro de mandar a posição */
    if (m.tipo === "pausa") { parar(); idPasso = 0; return; }

    if (m.tipo === "fim") {
      parar();
      idPasso = 0;
      executar(m.depois);
      religarEncaixe();
    }
  });
})();
