/* PRISMA — modo claro / modo escuro
   O escuro é o padrão. Eu guardo a escolha no localStorage (só "claro" ou
   "escuro", nenhum dado pessoal) e aplico no <html> como data-tema="claro".
   Este arquivo entra no <head> de todas as páginas, antes do CSS terminar
   de pintar, para a tela não piscar no tema errado.
   Os dashboards dentro do iframe recebem a troca de duas formas:
   pelo evento "storage" e, por garantia, direto pelo menu (mesma origem). */

(function () {
  "use strict";

  const CHAVE = "prisma-tema";
  const COR_BARRA = { escuro: "#050916", claro: "#EEF3FB" };

  function lerEscolha() {
    try {
      return localStorage.getItem(CHAVE) === "claro" ? "claro" : "escuro";
    } catch (erro) {
      // navegador sem localStorage (modo privado bloqueado): fico no padrão
      return "escuro";
    }
  }

  function temaAtual() {
    return document.documentElement.dataset.tema === "claro" ? "claro" : "escuro";
  }

  // marca o tema num documento (o meu ou o de um iframe da mesma origem)
  function marcar(doc, tema) {
    const raiz = doc.documentElement;
    if (tema === "claro") raiz.dataset.tema = "claro";
    else delete raiz.dataset.tema;

    const barra = doc.querySelector('meta[name="theme-color"]');
    if (barra) barra.setAttribute("content", COR_BARRA[tema]);
  }

  function atualizarBotoes(tema) {
    document.querySelectorAll("[data-alternar-tema]").forEach((botao) => {
      const claro = tema === "claro";
      botao.setAttribute("aria-pressed", String(claro));
      const texto = claro ? "Mudar para o modo escuro" : "Mudar para o modo claro";
      botao.setAttribute("aria-label", texto);
      botao.title = texto;
      const rotulo = botao.querySelector(".botao-tema-texto");
      if (rotulo) rotulo.textContent = claro ? "Modo escuro" : "Modo claro";
    });
  }

  function aplicar(tema) {
    marcar(document, tema);
    atualizarBotoes(tema);

    // passo para os dashboards abertos no iframe
    document.querySelectorAll("iframe").forEach((quadro) => {
      try {
        if (quadro.contentDocument) marcar(quadro.contentDocument, tema);
      } catch (erro) {
        // iframe de outra origem: não tenho acesso, e está tudo bem
      }
    });
  }

  function definir(tema) {
    try {
      localStorage.setItem(CHAVE, tema);
    } catch (erro) {
      // sem localStorage a troca vale só até fechar a página
    }
    aplicar(tema);
  }

  // 1) já no carregamento
  aplicar(lerEscolha());

  // 2) quando outra página (ou o menu) muda o tema
  window.addEventListener("storage", (evento) => {
    if (evento.key === CHAVE) aplicar(lerEscolha());
  });

  // 3) liga os botões quando o HTML estiver pronto
  document.addEventListener("DOMContentLoaded", () => {
    atualizarBotoes(temaAtual());
    document.querySelectorAll("[data-alternar-tema]").forEach((botao) => {
      botao.addEventListener("click", () => {
        definir(temaAtual() === "claro" ? "escuro" : "claro");
      });
    });

    // um dashboard novo no iframe já nasce com o tema certo
    document.querySelectorAll("iframe").forEach((quadro) => {
      quadro.addEventListener("load", () => aplicar(temaAtual()));
    });
  });

  window.PrismaTema = { atual: temaAtual, definir };
})();
