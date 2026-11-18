/* PRISMA — robô do login
   Os olhos e a boca são desenhados em SVG sobre o visor vazio da imagem.
   Coordenadas na imagem original (1024 × 1536), as mesmas do viewBox do SVG.

   API:
     PrismaRobo.expressao("normal" | "feliz" | "triste" | "discreto")
     PrismaRobo.reagir(nome, ms)        expressão temporária
     PrismaRobo.erro(ms)                visor vermelho e triste
     PrismaRobo.olharPara(elemento|null)
     PrismaRobo.brilho(0..1)            brilho do prisma do peito
     PrismaRobo.pontoPeito()            centro do prisma do peito na tela {x, y}
*/
(() => {
  "use strict";

  const robo = document.getElementById("robo");
  if (!robo) return;

  const olhar = document.getElementById("rostoOlhar");
  const boca = document.getElementById("rostoBoca");
  const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const LARG = 1024, ALT = 1536;
  const VISOR = { x: 527, y: 412 };
  const PEITO = { x: 514, y: 772 };
  const LIMITE = { x: 30, y: 18 }; // quanto o rosto anda dentro do visor (px da imagem)

  let atual = "normal";
  let fimReacao = null;
  let fimErro = null;

  function mostrar(nome) {
    atual = nome;
    robo.dataset.exp = nome;
  }

  // uma expressão fixa cancela qualquer reação temporária pendente
  function expressao(nome) {
    clearTimeout(fimReacao);
    mostrar(nome);
  }

  function reagir(nome, ms = 1400) {
    const voltarPara = robo.classList.contains("erro") ? "triste" : "normal";
    mostrar(nome);
    clearTimeout(fimReacao);
    fimReacao = setTimeout(() => expressao(voltarPara), ms);
  }

  function erro(ms = 2200) {
    clearTimeout(fimReacao);
    clearTimeout(fimErro);
    robo.classList.add("erro");
    expressao("triste");
    fimErro = setTimeout(() => {
      robo.classList.remove("erro");
      expressao("normal");
    }, ms);
  }

  function brilho(v) {
    robo.style.setProperty("--brilho", Math.max(0, Math.min(1, v)).toFixed(3));
  }

  function naTela(px, py) {
    const r = robo.getBoundingClientRect();
    return { x: r.left + (px / LARG) * r.width, y: r.top + (py / ALT) * r.height };
  }

  const pontoPeito = () => naTela(PEITO.x, PEITO.y);

  /* ---------- olhar ---------- */

  let alvo = null;          // {x, y} na tela
  let elementoAlvo = null;
  let ultimoMovimento = 0;
  let passeio = { x: 0, y: 0 };
  let proximoPasseio = 0;
  let pos = { x: 0, y: 0 };

  function olharPara(el) {
    elementoAlvo = el || null;
  }

  window.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    alvo = { x: e.clientX, y: e.clientY };
    ultimoMovimento = performance.now();
  }, { passive: true });

  window.addEventListener("pointerdown", (e) => {
    alvo = { x: e.clientX, y: e.clientY };
    ultimoMovimento = performance.now();
  }, { passive: true });

  function destino(agora) {
    let p = null;
    if (elementoAlvo) {
      const r = elementoAlvo.getBoundingClientRect();
      p = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    } else if (alvo && agora - ultimoMovimento < 3000) {
      p = alvo;
    }

    if (!p) {
      // parado: o olhar passeia sozinho de vez em quando
      if (agora > proximoPasseio) {
        passeio = { x: (Math.random() * 2 - 1) * 0.7, y: (Math.random() * 2 - 1) * 0.5 };
        proximoPasseio = agora + 1600 + Math.random() * 2400;
      }
      return passeio;
    }

    const c = naTela(VISOR.x, VISOR.y);
    const nx = (p.x - c.x) / (window.innerWidth * 0.45);
    const ny = (p.y - c.y) / (window.innerHeight * 0.45);
    return { x: Math.max(-1, Math.min(1, nx)), y: Math.max(-1, Math.min(1, ny)) };
  }

  /* ---------- piscar ---------- */

  let proximaPiscada = performance.now() + 2500;

  function talvezPiscar(agora) {
    if (agora < proximaPiscada) return;
    proximaPiscada = agora + 2400 + Math.random() * 3800;
    if (atual !== "normal") return;
    robo.classList.add("piscando");
    setTimeout(() => robo.classList.remove("piscando"), 130);
    // às vezes pisca duas vezes
    if (Math.random() < 0.18) {
      setTimeout(() => {
        robo.classList.add("piscando");
        setTimeout(() => robo.classList.remove("piscando"), 120);
      }, 260);
    }
  }

  /* ---------- laço ---------- */

  let ativo = false;

  function quadro(agora) {
    if (!ativo) return;
    const d = destino(agora);
    pos.x += (d.x - pos.x) * 0.16;
    pos.y += (d.y - pos.y) * 0.16;
    const dx = (pos.x * LIMITE.x).toFixed(2);
    const dy = (pos.y * LIMITE.y).toFixed(2);
    olhar.setAttribute("transform", `translate(${dx} ${dy})`);
    // a boca anda menos que os olhos (dá a sensação de volume)
    boca.setAttribute("transform", `translate(${(-pos.x * LIMITE.x * 0.45).toFixed(2)} ${(-pos.y * LIMITE.y * 0.4).toFixed(2)})`);
    talvezPiscar(agora);
    requestAnimationFrame(quadro);
  }

  function ligar() {
    if (ativo || reduzir || document.hidden) return;
    ativo = true;
    requestAnimationFrame(quadro);
  }

  function desligar() { ativo = false; }

  document.addEventListener("visibilitychange", () => (document.hidden ? desligar() : ligar()));

  expressao("normal");
  brilho(0);
  ligar();

  window.PrismaRobo = { expressao, reagir, erro, olharPara, brilho, pontoPeito, get atual() { return atual; } };
})();
