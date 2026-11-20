/* PRISMA — trava de cada página interna
   Uso: <script src="../JAVA/sessao-pagina.js" data-pagina="codigo-da-pagina"></script> no <head>.
   A página só abre dentro da Visão geral (iframe). Aqui eu pergunto à Visão geral se o papel
   da pessoa abre esta página; se não abrir, a página some e a Visão geral recarrega.
   Sem o Supabase configurado, não faz nada (modo de demonstração).
   Lembrete: isto é só a tela. Os dados de cada página ficam protegidos pelo RLS do banco. */
(() => {
  "use strict";
  const codigo = document.currentScript && document.currentScript.dataset.pagina;
  let casca = null;
  try { casca = window.parent !== window ? window.parent.PrismaSessao : null; } catch (_) { casca = null; }
  if (!codigo || !casca || !casca.configurado) return;
  if (casca.podePagina(codigo)) return;

  document.documentElement.style.display = "none";
  try { window.parent.location.replace(window.parent.location.pathname); } catch (_) { /* fica escondida */ }
})();
