/* =====================================================================
   SIMI · mascota animada (07-11-26)
   ---------------------------------------------------------------------
   Un solo dibujo y un solo «motor» para todas las apariciones de SIMI:
   la pantalla de inicio, el botón flotante y el panel de conversación.
     · Respira, parpadea a intervalos naturales y mira alrededor.
     · En la PC sus ojos siguen al cursor (sólo con mouse; en celular
       mira para los costados de vez en cuando).
     · Humores: feliz, salta (festeja), saluda, alerta (cejas, antena roja,
       boca de «¡oh!»), pensando, tapa (se tapa los ojos) y espía.
     · Confeti con los colores de SIMA para festejar un cierre.
   Con «reducir movimiento» del sistema operativo no se mueve: sólo cambia
   la cara. Todo es decorativo (aria-hidden): los avisos los lleva el
   texto que acompaña a SIMI, nunca el dibujo.
   API: window.SIMI_M = { svg, vivir, humor, mirar, confeti, saltar }
   ===================================================================== */
(function () {
  'use strict';
  const REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINO = window.matchMedia && matchMedia('(pointer: fine)').matches;
  let n = 0;

  function svg(cls = '', { manos = true } = {}) {
    const g = 'simiG' + (++n), m = 'simiM' + n;
    return `<svg class="simi-svg ${cls}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB84D"/><stop offset="1" stop-color="#E5761A"/></linearGradient>
        <linearGradient id="${m}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC266"/><stop offset="1" stop-color="#F08A24"/></linearGradient>
      </defs>
      <g class="simi-cuerpo">
        <line class="simi-ant-l" x1="32" y1="9" x2="32" y2="3.5" stroke="#54646F" stroke-width="2.2" stroke-linecap="round"/>
        <circle class="simi-ant" cx="32" cy="3.6" r="3" fill="#3FC5E8"/>
        <path d="M32 8 L56 20 V45 L32 58 L8 45 V20 Z" fill="url(#${g})" stroke="#14100A" stroke-opacity=".18" stroke-width="1"/>
        <path d="M8 20 L32 8 L56 20 L32 31 Z" fill="#fff" fill-opacity=".22"/>
        <rect x="13.5" y="24" width="37" height="21" rx="10" fill="#14100A"/>
        <g class="simi-ojos"><g class="simi-pupilas"><rect x="22" y="29.5" width="6" height="9" rx="3" fill="#3FC5E8"/><rect x="36" y="29.5" width="6" height="9" rx="3" fill="#3FC5E8"/>
          <circle cx="26.3" cy="31.6" r="1.1" fill="#E6FBFF" opacity=".9"/><circle cx="40.3" cy="31.6" r="1.1" fill="#E6FBFF" opacity=".9"/></g></g>
        <g class="simi-ojos-f" fill="none" stroke="#3FC5E8" stroke-width="2.6" stroke-linecap="round"><path d="M21.5 35 q3.5 -5 7 0"/><path d="M35.5 35 q3.5 -5 7 0"/></g>
        <g class="simi-cejas" fill="none" stroke="#3FC5E8" stroke-width="1.8" stroke-linecap="round"><path d="M20.5 28.2 L28 26.4"/><path d="M36 26.4 L43.5 28.2"/></g>
        <path class="simi-boca" d="M29.5 41.2 q2.5 1.8 5 0" fill="none" stroke="#3FC5E8" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>
        <ellipse class="simi-boca-o" cx="32" cy="41.6" rx="1.9" ry="1.6" fill="none" stroke="#3FC5E8" stroke-width="1.5"/>
        ${manos ? `<g class="simi-mano simi-mano-i"><circle cx="7.4" cy="47" r="4.4" fill="url(#${m})" stroke="#14100A" stroke-opacity=".22" stroke-width=".9"/></g>
        <g class="simi-mano simi-mano-d"><circle cx="56.6" cy="47" r="4.4" fill="url(#${m})" stroke="#14100A" stroke-opacity=".22" stroke-width=".9"/></g>` : ''}
      </g>
    </svg>`;
  }

  const css = `
  .simi-svg{overflow:visible}
  .simi-svg .simi-cuerpo,.simi-svg .simi-mano,.simi-svg .simi-ojos,.simi-svg .simi-pupilas,.simi-svg .simi-ant,.simi-svg .simi-ant-l{transform-box:fill-box;transform-origin:center}
  .simi-svg .simi-cuerpo{transform-origin:50% 100%}
  .simi-svg .simi-pupilas{transition:transform .14s ease-out}
  .simi-svg .simi-ojos{transition:transform .09s ease-in}
  .simi-svg.parpadea .simi-ojos{transform:scaleY(.08)}
  .simi-svg .simi-ojos-f,.simi-svg .simi-cejas,.simi-svg .simi-boca-o{display:none}
  .simi-svg .simi-mano{transition:transform .38s cubic-bezier(.34,1.56,.64,1)}
  .simi-svg .simi-ant{transition:fill .2s}
  .simi-svg.vivo .simi-cuerpo{animation:simiRespira 3.8s ease-in-out infinite}
  .simi-svg.vivo .simi-mano-i{animation:simiManoI 3.8s ease-in-out infinite}
  .simi-svg.vivo .simi-mano-d{animation:simiManoD 3.8s ease-in-out infinite}
  @keyframes simiRespira{0%,100%{transform:translateY(0) scale(1,1)}50%{transform:translateY(-1.2px) scale(1.012,.988)}}
  @keyframes simiManoI{0%,100%{transform:translate(0,0)}50%{transform:translate(-.4px,-1.4px)}}
  @keyframes simiManoD{0%,100%{transform:translate(0,0)}50%{transform:translate(.4px,-1.4px)}}
  /* feliz */
  .feliz .simi-svg .simi-ojos,.feliz .simi-svg .simi-boca,.simi-svg.h-feliz .simi-ojos,.simi-svg.h-feliz .simi-boca,
  .simi-svg.h-salta .simi-ojos,.simi-svg.h-salta .simi-boca{display:none}
  .feliz .simi-svg .simi-ojos-f,.simi-svg.h-feliz .simi-ojos-f,.simi-svg.h-salta .simi-ojos-f{display:inline}
  /* salta: festeja con las manos arriba */
  .simi-svg.h-salta .simi-cuerpo{animation:simiSalta .95s cubic-bezier(.3,.7,.4,1) 2!important}
  .simi-svg.h-salta .simi-mano-i{animation:none!important;transform:translate(1px,-26px) rotate(-20deg)}
  .simi-svg.h-salta .simi-mano-d{animation:none!important;transform:translate(-1px,-26px) rotate(20deg)}
  @keyframes simiSalta{0%{transform:translateY(0) scale(1.08,.9)}22%{transform:translateY(-9px) scale(.94,1.07)}45%{transform:translateY(-11px) rotate(-4deg)}70%{transform:translateY(0) scale(1.1,.88)}85%{transform:translateY(-2px) scale(.98,1.02)}100%{transform:translateY(0) scale(1,1)}}
  /* saluda */
  .simi-svg.h-saluda .simi-mano-d{animation:simiSaluda 1.3s ease-in-out!important}
  @keyframes simiSaluda{0%,100%{transform:translate(0,0)}18%{transform:translate(1px,-20px) rotate(0)}34%{transform:translate(4px,-22px)}50%{transform:translate(-1px,-21px)}66%{transform:translate(4px,-22px)}82%{transform:translate(1px,-20px)}}
  /* alerta */
  .simi-svg.h-alerta .simi-cejas,.simi-svg.h-alerta .simi-boca-o{display:inline}
  .simi-svg.h-alerta .simi-boca{display:none}
  .simi-svg.h-alerta .simi-ant{fill:#FF4D5E;animation:simiAlerta .9s ease-in-out infinite!important}
  .simi-svg.h-alerta.sacude .simi-cuerpo{animation:simiSacude .5s ease-in-out!important}
  @keyframes simiAlerta{0%,100%{opacity:1}50%{opacity:.25}}
  @keyframes simiSacude{0%,100%{transform:rotate(0)}20%{transform:rotate(-5deg)}40%{transform:rotate(5deg)}60%{transform:rotate(-3deg)}80%{transform:rotate(2deg)}}
  /* pensando */
  .pensando .simi-svg .simi-pupilas,.simi-svg.h-pensando .simi-pupilas{animation:simiMiraLados 1.1s ease-in-out infinite;transition:none}
  @keyframes simiMiraLados{0%,100%{transform:translateX(-2.2px) translateY(-1px)}50%{transform:translateX(2.2px) translateY(-1px)}}
  /* se tapa los ojos / espía */
  .simi-svg.h-tapa .simi-mano-i,.simi-svg.h-espia .simi-mano-i{animation:none!important;transform:translate(17.6px,-12.4px) scale(1.55)}
  .simi-svg.h-tapa .simi-mano-d{animation:none!important;transform:translate(-17.6px,-12.4px) scale(1.55)}
  .simi-svg.h-espia .simi-mano-d{animation:none!important;transform:translate(-15px,-5px) scale(1.3)}
  .simi-svg.h-tapa .simi-boca,.simi-svg.h-espia .simi-boca{d:path("M29.5 41.6 q2.5 -1.2 5 0")}
  /* antena que se mueve */
  .simi-svg.antena .simi-ant,.simi-svg.antena .simi-ant-l{animation:simiAntena .8s ease-in-out}
  @keyframes simiAntena{0%,100%{transform:rotate(0)}25%{transform:rotate(-14deg)}75%{transform:rotate(14deg)}}
  .simi-svg .simi-ant-l,.simi-svg .simi-ant{transform-origin:50% 100%}
  /* confeti */
  .simi-confeti{position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:120}
  .simi-confeti i{position:absolute;left:0;top:0;width:7px;height:11px;border-radius:2px;opacity:0;
    animation:simiConfeti var(--t,1.1s) cubic-bezier(.15,.6,.35,1) forwards}
  @keyframes simiConfeti{0%{opacity:1;transform:translate(0,0) rotate(0)}70%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) rotate(var(--r))}}
  @media(prefers-reduced-motion:reduce){
    .simi-svg *,.simi-svg.vivo .simi-cuerpo,.simi-svg.vivo .simi-mano{animation:none!important;transition:none!important}
    .simi-confeti{display:none}
  }`;
  const st = document.createElement('style'); st.id = 'simiMascotaCss'; st.textContent = css; document.head.appendChild(st);

  /* ---------- Motor ---------- */
  const vivos = new Set();
  const visible = el => { if (!el.isConnected) { vivos.delete(el); return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight; };
  // Registra los SIMI dentro de raiz (o el propio elemento) para que respiren, parpadeen y miren.
  function vivir(raiz) {
    const l = raiz.matches && raiz.matches('.simi-svg') ? [raiz] : raiz.querySelectorAll('.simi-svg');
    l.forEach(s => { s.classList.add('vivo'); vivos.add(s); });
  }
  // Parpadeo con intervalos irregulares (2,5 a 6 s), a veces doble.
  function parpadeo() {
    if (!REDUCE) vivos.forEach(s => {
      if (!visible(s) || s.classList.contains('h-tapa') || s.classList.contains('h-feliz') || s.classList.contains('h-salta')) return;
      s.classList.add('parpadea'); setTimeout(() => s.classList.remove('parpadea'), 130);
      if (Math.random() < .18) setTimeout(() => { s.classList.add('parpadea'); setTimeout(() => s.classList.remove('parpadea'), 120); }, 260);
    });
    setTimeout(parpadeo, 2500 + Math.random() * 3500);
  }
  setTimeout(parpadeo, 1800);

  function mirarSvg(s, dx, dy) {
    const p = s.querySelector('.simi-pupilas'); if (!p) return;
    p.style.transform = `translate(${dx.toFixed(2)}px,${dy.toFixed(2)}px)`;
  }
  // Mira hacia un punto de la pantalla (x, y en px); null = al frente.
  function mirar(objetivo, x, y) {
    const lista = objetivo ? [objetivo] : [...vivos];
    lista.forEach(s => {
      if (x == null) return mirarSvg(s, 0, 0);
      const r = s.getBoundingClientRect(); if (!r.width) return;
      const cx = r.left + r.width / 2, cy = r.top + r.height * .53;
      const vx = x - cx, vy = y - cy, d = Math.hypot(vx, vy) || 1;
      const k = Math.min(1, d / 260);
      mirarSvg(s, vx / d * 2.6 * k, vy / d * 2.1 * k);
    });
  }
  // Ojos que siguen al cursor (sólo con mouse; en táctil no hay cursor que seguir).
  let px = null, py = null, raf = null, quieto = null;
  if (FINO && !REDUCE) {
    addEventListener('pointermove', e => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      px = e.clientX; py = e.clientY;
      if (!raf) raf = requestAnimationFrame(() => {
        raf = null;
        vivos.forEach(s => { if (visible(s) && !s.dataset.fijo && !s.classList.contains('h-pensando')) mirar(s, px, py); });
      });
      clearTimeout(quieto);
      quieto = setTimeout(() => vivos.forEach(s => { if (!s.dataset.fijo) mirar(s, null); }), 6000);   // si el cursor se queda quieto, vuelve a mirar al frente
    }, { passive: true });
    document.addEventListener('mouseleave', () => vivos.forEach(s => !s.dataset.fijo && mirar(s, null)));
  }

  const timers = new WeakMap();
  // Pone un humor por un rato (ms) o fijo (ms = 0). h = '' lo quita.
  function humor(s, h, ms) {
    if (!s) return;
    const lista = s.matches && s.matches('.simi-svg') ? [s] : [...s.querySelectorAll('.simi-svg')];
    lista.forEach(x => {
      ['h-feliz', 'h-salta', 'h-saluda', 'h-alerta', 'h-pensando', 'h-tapa', 'h-espia', 'sacude'].forEach(c => x.classList.remove(c));
      clearTimeout(timers.get(x));
      if (!h) return;
      x.classList.add('h-' + h);
      if (ms) timers.set(x, setTimeout(() => { x.classList.remove('h-' + h); if (x.dataset.base) x.classList.add('h-' + x.dataset.base); }, ms));
    });
  }
  // Festejo: dos saltos con las manos arriba (o sólo cara feliz si se reduce el movimiento).
  function saltar(s) { humor(s, REDUCE ? 'feliz' : 'salta', REDUCE ? 2200 : 1950); }
  function confeti(x, y, cant = 26) {
    if (REDUCE) return;
    const c = document.createElement('div'); c.className = 'simi-confeti'; c.style.left = x + 'px'; c.style.top = y + 'px';
    const COL = ['#FF9F1C', '#FFB84D', '#3FC5E8', '#1FCB7E', '#8B7BF7', '#FF4D5E'];
    for (let i = 0; i < cant; i++) {
      const a = (-90 + (Math.random() - .5) * 150) * Math.PI / 180, v = 70 + Math.random() * 130;
      const p = document.createElement('i');
      p.style.background = COL[i % COL.length];
      p.style.setProperty('--dx', (Math.cos(a) * v).toFixed(0) + 'px');
      p.style.setProperty('--dy', (Math.sin(a) * v + 90 + Math.random() * 60).toFixed(0) + 'px');
      p.style.setProperty('--r', ((Math.random() - .5) * 720).toFixed(0) + 'deg');
      p.style.setProperty('--t', (0.9 + Math.random() * .6).toFixed(2) + 's');
      if (Math.random() < .35) { p.style.width = '8px'; p.style.height = '8px'; p.style.borderRadius = '50%'; }
      c.appendChild(p);
    }
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 1700);
  }
  // Gestos sueltos de vez en cuando, para que se vea vivo sin distraer.
  function gesto(s) {
    if (REDUCE || !s || !visible(s) || [...s.classList].some(c => /^h-/.test(c) && c !== 'h-alerta')) return;
    const r = Math.random();
    if (r < .38) {           // mira para un costado y vuelve
      if (FINO && px != null) return;
      const lado = Math.random() < .5 ? -1 : 1;
      s.dataset.fijo = '1'; mirarSvg(s, 2.4 * lado, -.6);
      setTimeout(() => { mirarSvg(s, -2 * lado, .4); }, 900);
      setTimeout(() => { delete s.dataset.fijo; mirarSvg(s, 0, 0); }, 1800);
    } else if (r < .7) {     // antena
      s.classList.add('antena'); setTimeout(() => s.classList.remove('antena'), 850);
    } else if (r < .9) {     // saludito
      humor(s, 'saluda', 1350);
    } else {                 // saltito
      humor(s, 'salta', 980);
    }
  }
  window.SIMI_M = { svg, vivir, humor, mirar, confeti, saltar, gesto, REDUCE, FINO };
})();
