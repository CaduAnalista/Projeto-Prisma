/* PRISMA — som da entrada (luz entrando no prisma e a seta saindo)
   Gerado na hora com a Web Audio API, sem arquivo de áudio.
   Um só som contínuo: cresce enquanto a luz entra (vindo da esquerda),
   ganha um brilho quando a seta sai (indo para a direita) e desce até
   o silêncio antes de a página trocar.

   SomPrisma.preparar()  → chamar dentro do clique/Enter (o navegador exige um gesto)
   SomPrisma.tocar(duracaoSegundos)

   ⚠️ Não marcar valores num AudioParam no mesmo instante em que uma
   setValueCurveAtTime termina: o navegador dá erro (ver CLAUDE.md, seção 4).
*/
(() => {
  "use strict";

  let ctx = null;

  function preparar() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume();
  }

  function ruido(segundos) {
    const n = Math.floor(ctx.sampleRate * segundos);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function reverb(segundos) {
    const n = Math.floor(ctx.sampleRate * segundos);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6);
    }
    const conv = ctx.createConvolver();
    conv.buffer = buf;
    return conv;
  }

  // curva do volume geral: sobe com a luz, brilho na seta, desce até zero
  function curvaGeral(dur) {
    const n = 256, c = new Float32Array(n);
    const pico = dur * 0.52, fim = dur * 0.97;
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1)) * dur;
      let v;
      if (t <= pico) {
        const u = t / pico;
        v = 0.6 * u * u * (3 - 2 * u);
      } else {
        const u = Math.min(1, (t - pico) / (fim - pico));
        const bump = 0.15 * Math.exp(-Math.pow((t - pico - 0.12) / 0.12, 2));
        v = (0.6 + bump) * Math.pow(1 - u, 2.2);
      }
      c[i] = v;
    }
    c[n - 1] = 0;
    return c;
  }

  function tocar(dur = 2.8) {
    if (!ctx) preparar();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.03;
    const pico = t0 + dur * 0.52;

    const geral = ctx.createGain();
    geral.gain.value = 0;
    geral.gain.setValueCurveAtTime(curvaGeral(dur), t0, dur);
    geral.connect(ctx.destination);

    const sala = reverb(2.4);
    const molhado = ctx.createGain();
    molhado.gain.value = 0.55;
    sala.connect(molhado).connect(geral);

    const saidaSeca = ctx.createGain();
    saidaSeca.gain.value = 0.7;
    saidaSeca.connect(geral);
    saidaSeca.connect(sala);

    const parar = t0 + dur + 0.1;

    /* 1. a luz entrando: ar filtrado que sobe e vem da esquerda para o centro */
    const ar = ctx.createBufferSource();
    ar.buffer = ruido(dur + 0.2);
    const filtroAr = ctx.createBiquadFilter();
    filtroAr.type = "bandpass";
    filtroAr.Q.value = 2.2;
    filtroAr.frequency.setValueAtTime(380, t0);
    filtroAr.frequency.exponentialRampToValueAtTime(3200, pico);
    filtroAr.frequency.exponentialRampToValueAtTime(1400, t0 + dur);
    const ganhoAr = ctx.createGain();
    ganhoAr.gain.setValueAtTime(0.0001, t0);
    ganhoAr.gain.exponentialRampToValueAtTime(0.5, pico - 0.05);
    ganhoAr.gain.exponentialRampToValueAtTime(0.12, t0 + dur);
    const panAr = ctx.createStereoPanner();
    panAr.pan.setValueAtTime(-0.85, t0);
    panAr.pan.linearRampToValueAtTime(0, pico);
    panAr.pan.linearRampToValueAtTime(0.6, t0 + dur);
    ar.connect(filtroAr).connect(ganhoAr).connect(panAr).connect(saidaSeca);
    ar.start(t0);
    ar.stop(parar);

    /* 2. acorde de fundo (mi maior com nona) com o filtro abrindo junto com a luz */
    const filtroAcorde = ctx.createBiquadFilter();
    filtroAcorde.type = "lowpass";
    filtroAcorde.Q.value = 0.8;
    filtroAcorde.frequency.setValueAtTime(260, t0);
    filtroAcorde.frequency.exponentialRampToValueAtTime(2600, pico);
    filtroAcorde.frequency.exponentialRampToValueAtTime(900, t0 + dur);
    filtroAcorde.connect(saidaSeca);
    [164.81, 246.94, 329.63, 415.3, 369.99].forEach((f, i) => {
      [-6, 6].forEach((desafino) => {
        const o = ctx.createOscillator();
        o.type = i < 2 ? "triangle" : "sine";
        o.frequency.value = f;
        o.detune.value = desafino;
        const g = ctx.createGain();
        g.gain.value = 0.07;
        o.connect(g).connect(filtroAcorde);
        o.start(t0);
        o.stop(parar);
      });
    });

    /* 3. grave macio crescendo por baixo */
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(48, t0);
    sub.frequency.linearRampToValueAtTime(62, pico);
    const gSub = ctx.createGain();
    gSub.gain.setValueAtTime(0.0001, t0);
    gSub.gain.exponentialRampToValueAtTime(0.35, pico);
    gSub.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    sub.connect(gSub).connect(geral);
    sub.start(t0);
    sub.stop(parar);

    /* 4. a seta: sopro rápido que vai para a direita */
    const sopro = ctx.createBufferSource();
    sopro.buffer = ruido(1.2);
    const filtroSopro = ctx.createBiquadFilter();
    filtroSopro.type = "highpass";
    filtroSopro.frequency.setValueAtTime(700, pico);
    filtroSopro.frequency.exponentialRampToValueAtTime(5200, pico + 0.55);
    const gSopro = ctx.createGain();
    gSopro.gain.setValueAtTime(0.0001, pico - 0.02);
    gSopro.gain.exponentialRampToValueAtTime(0.4, pico + 0.06);
    gSopro.gain.exponentialRampToValueAtTime(0.0001, pico + 0.8);
    const panSopro = ctx.createStereoPanner();
    panSopro.pan.setValueAtTime(-0.1, pico);
    panSopro.pan.linearRampToValueAtTime(0.9, pico + 0.6);
    sopro.connect(filtroSopro).connect(gSopro).connect(panSopro).connect(saidaSeca);
    sopro.start(pico - 0.02);
    sopro.stop(pico + 0.85);

    /* 5. brilho de cristal quando a seta sai (sobe em arpejo, para a direita) */
    [659.25, 830.61, 987.77, 1318.51].forEach((f, i) => {
      const ti = pico + i * 0.07;
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, ti);
      g.gain.exponentialRampToValueAtTime(0.11 - i * 0.015, ti + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ti + 1.0);
      const p = ctx.createStereoPanner();
      p.pan.value = 0.15 + i * 0.2;
      o.connect(g).connect(p).connect(saidaSeca);
      o.start(ti);
      o.stop(ti + 1.05);
    });
  }

  window.SomPrisma = { preparar, tocar };
})();
