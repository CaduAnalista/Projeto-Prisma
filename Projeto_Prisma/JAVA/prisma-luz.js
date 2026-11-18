/* PRISMA — luz do login e transição de entrada
   - #luzBrilho (volume): feixes de luz volumétrica, como raios de sol na névoa.
     Saem do alto, à esquerda, e convergem no prisma do peito. Cada feixe é luz
     branca com o arco-íris aparecendo por dentro, e pulsos suaves de luz fluem
     por ele até o peito. É desenhado em meia resolução e desfocado pelo CSS:
     por isso as bordas ficam macias, como luz de verdade.
   - #luzFundo (nítido): estrelas e a poeira brilhando dentro dos feixes, que
     também flui devagar até o peito.
   - #luzFrente: só na transição. O peito se enche de luz, a seta sai dele,
     atravessa o cartão e a tela, e um clarão cobre tudo.

   PrismaLuz.transicao({ duracao, cartao, aoAtingirCartao, aoTerminar })
*/
(() => {
  "use strict";

  const fundo = document.getElementById("luzFundo");
  const volume = document.getElementById("luzBrilho");
  const frente = document.getElementById("luzFrente");
  if (!fundo || !volume || !frente) return;

  const cf = fundo.getContext("2d");
  const cv = volume.getContext("2d");
  const cr = frente.getContext("2d");
  const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const robo = () => window.PrismaRobo;

  // feixes: origem (fração da tela, fora dela no alto/esquerda), largura na origem e força
  const RAIOS = [
    { sx: -0.02, sy: -0.10, larg: 0.34, forca: 1.0, fase: 0.0 },
    { sx: 0.22, sy: -0.16, larg: 0.22, forca: 0.75, fase: 1.7 },
    { sx: -0.14, sy: 0.24, larg: 0.22, forca: 0.65, fase: 3.1 },
    { sx: 0.44, sy: -0.18, larg: 0.15, forca: 0.45, fase: 4.4 },
    { sx: -0.16, sy: 0.66, larg: 0.17, forca: 0.45, fase: 5.2 }
  ];

  RAIOS.forEach((r) => {
    r.riscos = Array.from({ length: 4 }, () => ({
      f: Math.random() * 1.6 - 0.8,
      w: 0.03 + Math.random() * 0.05,
      a: 0.1 + Math.random() * 0.12,
      vel: 0.15 + Math.random() * 0.25,
      fase: Math.random() * Math.PI * 2
    }));
  });

  // arco-íris dentro da luz branca (de um lado ao outro do feixe)
  // paleta quente e contida: azul, gelo, creme, laranja, âmbar e marrom (sem rosa nem violeta)
  // cada feixe tem a sua família de cor (se todos tivessem todas, a soma virava branco)
  const QUENTE = ["#8A4A22", "#C2611A", "#FF8A2B", "#FFB45C", "#FFD08A"];
  const AZUL = ["#1F4FE0", "#2F6BFF", "#3D8BFF", "#6FB0FF", "#A8D4FF"];
  const MISTO = ["#2F6BFF", "#6FB0FF", "#FFD08A", "#FF9A3C", "#A85A24"];
  [QUENTE, AZUL, QUENTE, MISTO, AZUL].forEach((cores, i) => (RAIOS[i].cores = cores));

  const ESTRELAS = Array.from({ length: 60 }, () => ({
    x: Math.random(), y: Math.random() * 0.8, r: 0.4 + Math.random() * 1.1,
    fase: Math.random() * Math.PI * 2
  }));

  const POEIRA = Array.from({ length: 120 }, () => novaPoeira(Math.random()));

  function novaPoeira(a = Math.random() * 0.15) {
    const grande = Math.random() < 0.12;
    return {
      r: Math.random() < 0.45 ? 0 : 1 + Math.floor(Math.random() * (RAIOS.length - 1)),
      a,
      f: (Math.random() * 2 - 1) * 0.85,
      vel: 0.5 + Math.random() * 0.9,
      tam: grande ? 2 + Math.random() * 1.8 : 0.6 + Math.random() * 1.2,
      fase: Math.random() * Math.PI * 2,
      grande
    };
  }

  let W = 0, H = 0, dprF = 1;
  const RES_VOLUME = 0.5; // o volume é desenhado em meia resolução (mais leve; o CSS desfoca)

  function medir() {
    W = window.innerWidth;
    H = window.innerHeight;
    dprF = Math.min(window.devicePixelRatio || 1, 1.5);
    fundo.width = Math.round(W * dprF);
    fundo.height = Math.round(H * dprF);
    cf.setTransform(dprF, 0, 0, dprF, 0, 0);
    volume.width = Math.round(W * RES_VOLUME);
    volume.height = Math.round(H * RES_VOLUME);
    cv.setTransform(RES_VOLUME, 0, 0, RES_VOLUME, 0, 0);
    frente.width = Math.round(W);
    frente.height = Math.round(H);
  }

  medir();
  window.addEventListener("resize", medir);

  const lim = (v) => Math.max(0, Math.min(1, v));
  const suave = (v) => { v = lim(v); return v * v * (3 - 2 * v); };
  const entrada = (v) => { v = lim(v); return v * v * v; };
  const saida = (v) => { v = lim(v); return 1 - Math.pow(1 - v, 3); };

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a))})`;
  }

  /* ---------- estado da transição ---------- */

  let trans = null;

  function fases(agora) {
    if (!trans) return { absorver: 0, seta: 0, clarao: 0, ms: 0 };
    const ms = agora - trans.inicio;
    const D = trans.duracao;
    return {
      ms,
      absorver: suave(ms / (D * 0.54)),          // 0 → ~1,5 s
      seta: lim((ms - D * 0.52) / (D * 0.25)),    // ~1,45 → 2,15 s
      clarao: suave((ms - D * 0.68) / (D * 0.29)) // ~1,9 → 2,7 s
    };
  }

  /* ---------- geometria dos feixes ---------- */

  // cada feixe é uma cunha: larga na origem, fina no peito
  function geometria(r, p, t, k, m) {
    const S = {
      x: r.sx * W + Math.sin(t * 0.13 + r.fase) * W * 0.02,
      y: r.sy * H + Math.cos(t * 0.11 + r.fase) * H * 0.02
    };
    const d = { x: p.x - S.x, y: p.y - S.y };
    const L = Math.hypot(d.x, d.y) || 1;
    const n = { x: -d.y / L, y: d.x / L };
    const ws = r.larg * m * (1 + 0.07 * Math.sin(t * 0.35 + r.fase)) * (1 - 0.35 * k);
    const we = m * 0.012 * (1 + k);
    // ponto ao longo do feixe (a: 0 na origem, 1 no peito) e de um lado ao outro (f: -1 a 1)
    const ponto = (a, f) => {
      const w = ws * (1 - a) + we * a;
      return { x: S.x + d.x * a + n.x * f * w, y: S.y + d.y * a + n.y * f * w };
    };
    return { S, p, ponto };
  }

  function cunha(ctx, g, a0, a1, f0, f1) {
    const q1 = g.ponto(a0, f0), q2 = g.ponto(a1, f0), q3 = g.ponto(a1, f1), q4 = g.ponto(a0, f1);
    ctx.beginPath();
    ctx.moveTo(q1.x, q1.y);
    ctx.lineTo(q2.x, q2.y);
    ctx.lineTo(q3.x, q3.y);
    ctx.lineTo(q4.x, q4.y);
    ctx.closePath();
  }

  // degradê ao longo do feixe (da origem até o peito)
  function aoLongo(ctx, g, a0, a1, paradas) {
    const i = g.ponto(a0, 0), f = g.ponto(a1, 0);
    const gr = ctx.createLinearGradient(i.x, i.y, f.x, f.y);
    paradas.forEach(([o, c]) => gr.addColorStop(o, c));
    return gr;
  }

  /* ---------- desenho ---------- */

  let ultimo = 0;

  function desenharFundo(agora, f) {
    const t = agora / 1000;
    const dt = Math.min(0.05, ultimo ? (agora - ultimo) / 1000 : 0.016);
    ultimo = agora;

    const p = robo() ? robo().pontoPeito() : { x: W * 0.35, y: H * 0.55 };
    const k = f.absorver;
    const m = Math.min(W, H);
    const geos = RAIOS.map((r) => geometria(r, p, t, k, m));

    /* --- volume (desfocado pelo CSS) --- */
    cv.clearRect(0, 0, W, H);
    cv.globalCompositeOperation = "lighter";

    // abertura de luz no alto, à esquerda (de onde vêm os raios)
    const ga = cv.createRadialGradient(W * 0.06, -H * 0.05, 0, W * 0.06, -H * 0.05, m * 0.75);
    ga.addColorStop(0, `rgba(255, 236, 210, ${0.22 + 0.15 * k})`);
    ga.addColorStop(0.4, `rgba(140, 190, 255, ${0.08 + 0.06 * k})`);
    ga.addColorStop(1, "rgba(140, 190, 255, 0)");
    cv.fillStyle = ga;
    cv.fillRect(0, 0, W, H);

    const velFluxo = 0.06 + 0.95 * entrada(k);
    RAIOS.forEach((r, i) => {
      const g = geos[i];
      const fz = r.forca * (1 + 1.3 * k);
      const respira = 0.9 + 0.1 * Math.sin(t * 0.5 + r.fase * 2);

      // névoa larga em volta do feixe
      cunha(cv, g, 0, 1, -1.25, 1.25);
      cv.fillStyle = aoLongo(cv, g, 0, 1, [
        [0, rgba("#C8E6FF", 0.03 * fz)], [0.6, rgba("#C8E6FF", 0.05 * fz)], [1, rgba("#FFFFFF", 0.12 * fz)]
      ]);
      cv.fill();

      // arco-íris por dentro da luz branca
      const ESPECTRO = r.cores;
      const n = ESPECTRO.length;
      for (let j = 0; j < n; j++) {
        const f0 = -0.95 + (1.9 * j) / n, f1 = f0 + 1.9 / n + 0.02;
        cunha(cv, g, 0, 1, f0, f1);
        cv.fillStyle = aoLongo(cv, g, 0, 1, [
          [0, rgba(ESPECTRO[j], 0.04 * fz)],
          [0.35, rgba(ESPECTRO[j], 0.24 * fz * respira)],
          [0.85, rgba(ESPECTRO[j], 0.34 * fz * respira)],
          [1, rgba(ESPECTRO[j], 0.16 * fz)]
        ]);
        cv.fill();
      }

      // miolo branco
      cunha(cv, g, 0, 1, -0.3, 0.3);
      cv.fillStyle = aoLongo(cv, g, 0, 1, [
        [0, rgba("#FFFFFF", 0.04 * fz)], [0.5, rgba("#FFF6EA", 0.1 * fz * respira)], [1, rgba("#FFFFFF", 0.38 * fz)]
      ]);
      cv.fill();

      // raios finos por dentro do feixe (o "risco" da luz passando pela névoa)
      for (const s of r.riscos) {
        const c = s.f + Math.sin(t * s.vel + s.fase) * 0.06;
        cunha(cv, g, 0, 1, c - s.w, c + s.w);
        const brilhoR = s.a * fz * (0.6 + 0.4 * Math.sin(t * s.vel * 2.3 + s.fase));
        cv.fillStyle = aoLongo(cv, g, 0, 1, [
          [0, rgba("#FFFFFF", 0)], [0.3, rgba("#F4FBFF", brilhoR)], [0.9, rgba("#FFFFFF", brilhoR * 1.4)], [1, rgba("#FFFFFF", 0)]
        ]);
        cv.fill();
      }

      // pulsos de luz fluindo até o peito
      for (let j = 0; j < 2; j++) {
        const pos = (t * velFluxo + r.fase * 0.31 + j * 0.5) % 1;
        const meio = 0.1 + 0.06 * k;
        const a0 = Math.max(0, pos - meio), a1 = Math.min(1, pos + meio);
        cunha(cv, g, a0, a1, -0.8, 0.8);
        const forcaPulso = (0.1 + 0.25 * k) * r.forca * (0.4 + 0.6 * pos);
        cv.fillStyle = aoLongo(cv, g, a0, a1, [
          [0, rgba("#FFFFFF", 0)], [0.5, rgba("#F2FBFF", forcaPulso)], [1, rgba("#FFFFFF", 0)]
        ]);
        cv.fill();
      }
    });

    // brilho no peito, onde a luz se junta
    const rb = m * (0.2 + 0.2 * k);
    const gb = cv.createRadialGradient(p.x, p.y, 0, p.x, p.y, rb);
    gb.addColorStop(0, `rgba(255, 255, 255, ${0.35 + 0.5 * k})`);
    gb.addColorStop(0.3, `rgba(255, 220, 170, ${0.14 + 0.28 * k})`);
    gb.addColorStop(1, "rgba(255, 170, 90, 0)");
    cv.fillStyle = gb;
    cv.fillRect(p.x - rb, p.y - rb, rb * 2, rb * 2);
    cv.globalCompositeOperation = "source-over";

    /* --- nítido: estrelas e poeira de luz --- */
    cf.clearRect(0, 0, W, H);
    cf.globalCompositeOperation = "lighter";

    for (const s of ESTRELAS) {
      const a = 0.2 + 0.3 * Math.sin(t * 1.2 + s.fase);
      cf.fillStyle = `rgba(190, 220, 255, ${Math.max(0, a) * 0.5})`;
      cf.beginPath();
      cf.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      cf.fill();
    }

    const velPoeira = 0.025 + 0.75 * entrada(k);
    for (const po of POEIRA) {
      po.a += dt * po.vel * velPoeira;
      if (po.a >= 1) Object.assign(po, novaPoeira(0));
      const g = geos[po.r];
      const q = g.ponto(po.a, po.f + Math.sin(t * 0.6 + po.fase) * 0.05);
      const brilhoP = (0.45 + 0.55 * Math.sin(t * 2.2 + po.fase)) * Math.min(1, po.a * 4) * RAIOS[po.r].forca;
      const a = Math.max(0, brilhoP) * (po.grande ? 0.35 : 0.9) * (1 + k);
      const rr = po.tam * (po.grande ? 3.2 : 2.6);
      const gp = cf.createRadialGradient(q.x, q.y, 0, q.x, q.y, rr);
      gp.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, a)})`);
      gp.addColorStop(0.4, `rgba(200, 235, 255, ${Math.min(1, a * 0.45)})`);
      gp.addColorStop(1, "rgba(200, 235, 255, 0)");
      cf.fillStyle = gp;
      cf.fillRect(q.x - rr, q.y - rr, rr * 2, rr * 2);
    }
    cf.globalCompositeOperation = "source-over";

    // brilho do prisma do peito (no robô)
    if (robo()) {
      const repouso = 0.08 + 0.05 * Math.sin(t * 1.6);
      const v = trans ? Math.max(repouso, suave((f.ms - trans.duracao * 0.1) / (trans.duracao * 0.42))) : repouso;
      robo().brilho(v);
    }
  }

  /* ---------- seta e clarão ---------- */

  function desenharFrente(f) {
    cr.clearRect(0, 0, W, H);
    if (!trans) return;

    // o peito se enche de luz (por cima do robô, para aparecer sobre a armadura branca)
    const cheio = suave((f.ms - trans.duracao * 0.12) / (trans.duracao * 0.4));
    if (cheio > 0 && robo()) {
      const c = robo().pontoPeito();
      const m = Math.min(W, H);
      const pulso = 1 + 0.08 * Math.sin(f.ms / 70) * cheio;
      const r = m * (0.04 + 0.16 * cheio) * pulso;
      cr.globalCompositeOperation = "lighter";
      const g = cr.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
      g.addColorStop(0, `rgba(255, 255, 255, ${0.95 * cheio})`);
      g.addColorStop(0.3, `rgba(160, 240, 255, ${0.7 * cheio})`);
      g.addColorStop(0.65, `rgba(255, 170, 90, ${0.26 * cheio})`);
      g.addColorStop(1, "rgba(255, 170, 90, 0)");
      cr.fillStyle = g;
      cr.beginPath();
      cr.arc(c.x, c.y, r, 0, Math.PI * 2);
      cr.fill();

      // reflexo horizontal de lente
      cr.save();
      cr.translate(c.x, c.y);
      cr.scale(1, 0.07);
      const rs = m * 0.32 * cheio;
      const gs = cr.createRadialGradient(0, 0, 0, 0, 0, rs);
      gs.addColorStop(0, `rgba(255, 255, 255, ${0.8 * cheio})`);
      gs.addColorStop(0.4, `rgba(120, 220, 255, ${0.35 * cheio})`);
      gs.addColorStop(1, "rgba(120, 220, 255, 0)");
      cr.fillStyle = gs;
      cr.beginPath();
      cr.arc(0, 0, rs, 0, Math.PI * 2);
      cr.fill();
      cr.restore();
      cr.globalCompositeOperation = "source-over";
    }

    const s = trans.saida; // ponto de saída (peito), fixado no disparo
    if (f.seta > 0 && s) {
      const fim = { x: W * 1.12, y: s.y - H * 0.14 };
      const ctrl = { x: (s.x + fim.x) / 2, y: s.y - H * 0.02 };
      const pr = saida(f.seta);
      const ponto = (u) => ({
        x: (1 - u) * (1 - u) * s.x + 2 * (1 - u) * u * ctrl.x + u * u * fim.x,
        y: (1 - u) * (1 - u) * s.y + 2 * (1 - u) * u * ctrl.y + u * u * fim.y
      });
      const cabeca = ponto(pr);
      const atras = ponto(Math.max(0, pr - 0.02));
      const ang = Math.atan2(cabeca.y - atras.y, cabeca.x - atras.x);
      const escala = Math.min(W, H) / 900;

      // cauda (branca no peito, laranja na ponta, como a seta da logo)
      cr.globalCompositeOperation = "lighter";
      const g = cr.createLinearGradient(s.x, s.y, cabeca.x, cabeca.y);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(0.5, "rgba(255,214,140,0.9)");
      g.addColorStop(1, "rgba(255,138,43,0.95)");
      const passos = 40;
      const tracar = () => {
        cr.beginPath();
        for (let i = 0; i <= passos; i++) {
          const q = ponto((pr * i) / passos);
          i ? cr.lineTo(q.x, q.y) : cr.moveTo(q.x, q.y);
        }
      };
      cr.strokeStyle = g;
      cr.lineCap = "round";
      [[46, 0.12], [20, 0.35], [7, 0.9], [2.5, 1]].forEach(([l, a]) => {
        cr.globalAlpha = a;
        cr.lineWidth = l * escala;
        tracar();
        cr.stroke();
      });

      // ponta da seta
      cr.save();
      cr.translate(cabeca.x, cabeca.y);
      cr.rotate(ang);
      const tam = 38 * escala;
      const gp = cr.createRadialGradient(0, 0, 0, 0, 0, tam * 2.2);
      gp.addColorStop(0, "rgba(255,240,210,0.9)");
      gp.addColorStop(1, "rgba(255,138,43,0)");
      cr.globalAlpha = 1;
      cr.fillStyle = gp;
      cr.beginPath();
      cr.arc(0, 0, tam * 2.2, 0, Math.PI * 2);
      cr.fill();
      cr.fillStyle = "#FFF4DD";
      cr.beginPath();
      cr.moveTo(tam * 0.9, 0);
      cr.lineTo(-tam * 0.55, -tam * 0.62);
      cr.lineTo(-tam * 0.25, 0);
      cr.lineTo(-tam * 0.55, tam * 0.62);
      cr.closePath();
      cr.fill();
      cr.restore();
      cr.globalAlpha = 1;
      cr.globalCompositeOperation = "source-over";

      // a seta chegou no cartão
      if (trans.cartao && !trans.cartaoAtingido) {
        const rc = trans.cartao.getBoundingClientRect();
        if (cabeca.x >= rc.left) {
          trans.cartaoAtingido = true;
          trans.aoAtingirCartao && trans.aoAtingirCartao();
        }
      }
    }

    // clarão: a luz da seta toma a tela
    if (f.clarao > 0) {
      const cx = W * 0.78, cy = H * 0.42;
      const r = Math.hypot(W, H) * (0.25 + 0.9 * f.clarao);
      const g = cr.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(255, 252, 244, ${f.clarao})`);
      g.addColorStop(0.55, `rgba(214, 244, 255, ${f.clarao * 0.95})`);
      g.addColorStop(1, `rgba(170, 200, 255, ${f.clarao * f.clarao})`);
      cr.fillStyle = g;
      cr.fillRect(0, 0, W, H);
      if (f.clarao >= 1) {
        cr.fillStyle = "#F4FAFF";
        cr.fillRect(0, 0, W, H);
      }
    }
  }

  /* ---------- laço ---------- */

  let ativo = false;

  function quadro(agora) {
    if (!ativo) return;
    const f = fases(agora);
    desenharFundo(agora, f);
    if (trans) {
      if (!trans.saida && f.seta > 0) trans.saida = robo() ? robo().pontoPeito() : { x: W * 0.35, y: H * 0.55 };
      desenharFrente(f);
      if (f.ms >= trans.duracao && !trans.terminou) {
        trans.terminou = true;
        trans.aoTerminar && trans.aoTerminar();
      }
    }
    requestAnimationFrame(quadro);
  }

  function ligar() {
    if (ativo || document.hidden) return;
    ativo = true;
    requestAnimationFrame(quadro);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && !trans) ativo = false;
    else ligar();
  });

  if (reduzir) {
    // sem movimento: desenha a luz uma vez, parada
    requestAnimationFrame((agora) => desenharFundo(agora, fases(agora)));
    window.addEventListener("resize", () => desenharFundo(performance.now(), fases(performance.now())));
  } else {
    ligar();
  }

  function transicao(opcoes) {
    const duracao = opcoes.duracao || 2800;
    if (reduzir) {
      frente.style.transition = "opacity 0.3s ease";
      frente.style.opacity = "0";
      cr.fillStyle = "#050916";
      cr.fillRect(0, 0, W, H);
      requestAnimationFrame(() => (frente.style.opacity = "1"));
      setTimeout(() => opcoes.aoTerminar && opcoes.aoTerminar(), 320);
      return;
    }
    trans = {
      inicio: performance.now(),
      duracao,
      cartao: opcoes.cartao || null,
      aoAtingirCartao: opcoes.aoAtingirCartao,
      aoTerminar: opcoes.aoTerminar,
      saida: null
    };
    ligar();
    // garantia: se o navegador atrasar os quadros, a página troca do mesmo jeito
    setTimeout(() => {
      if (trans && !trans.terminou) {
        trans.terminou = true;
        trans.aoTerminar && trans.aoTerminar();
      }
    }, duracao + 400);
  }

  function cancelar() {
    trans = null;
    cr.clearRect(0, 0, W, H);
  }

  window.PrismaLuz = { transicao, cancelar };
})();
