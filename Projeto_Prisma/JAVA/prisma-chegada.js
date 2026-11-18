/* PRISMA — chegada pela luz do login
   O login termina com a tela coberta pela luz da seta. Aqui a mesma luz
   aparece e se desfaz aos poucos, enquanto a página entra em foco.
   Inclua no <head> da página de destino. Aviso via sessionStorage ("prisma-portal"). */
(() => {
  "use strict";

  let veio = false;
  try {
    veio = sessionStorage.getItem("prisma-portal") === "1";
    sessionStorage.removeItem("prisma-portal");
  } catch (_) {
    return;
  }
  if (!veio) return;

  const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duracao = reduzir ? 200 : 1300;

  // mesma cor do fim do clarão no login (prisma-luz.js)
  const luz = document.createElement("div");
  luz.setAttribute("aria-hidden", "true");
  luz.style.cssText = [
    "position:fixed", "inset:0", "z-index:2147483647", "pointer-events:none",
    "background:radial-gradient(ellipse at 78% 42%, #FFFCF4 0%, #F4FAFF 35%, #D6F4FF 70%, #AAC8FF 100%)",
    "opacity:1"
  ].join(";");

  const foco = document.createElement("div");
  foco.setAttribute("aria-hidden", "true");
  foco.style.cssText = [
    "position:fixed", "inset:0", "z-index:2147483646", "pointer-events:none",
    "backdrop-filter:blur(12px)", "-webkit-backdrop-filter:blur(12px)"
  ].join(";");

  // o <body> ainda não existe enquanto o <head> carrega: entra no <html>
  document.documentElement.appendChild(foco);
  document.documentElement.appendChild(luz);

  // começa no próximo quadro, ou depois de 120 ms se o navegador atrasar os quadros
  let comecou = false;
  const quandoPronto = (fn) => {
    const umaVez = () => { if (!comecou) { comecou = true; fn(); } };
    requestAnimationFrame(umaVez);
    setTimeout(umaVez, 120);
  };

  window.addEventListener("DOMContentLoaded", () => {
    quandoPronto(() => {
      luz.animate(
        [
          { opacity: 1, transform: "scale(1)" },
          { opacity: 0.4, transform: "scale(1.04)", offset: 0.4 },
          { opacity: 0, transform: "scale(1.1)" }
        ],
        { duration: duracao, easing: "cubic-bezier(0.3, 0, 0.4, 1)", fill: "forwards" }
      );
      foco.animate(
        [
          { backdropFilter: "blur(12px)", webkitBackdropFilter: "blur(12px)" },
          { backdropFilter: "blur(0px)", webkitBackdropFilter: "blur(0px)" }
        ],
        { duration: duracao * 1.15, easing: "ease-out", fill: "forwards" }
      );
      setTimeout(() => { luz.remove(); foco.remove(); }, duracao * 1.15 + 80);
    });
  });
})();
