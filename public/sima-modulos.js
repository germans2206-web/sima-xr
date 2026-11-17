/* =====================================================================
   SIMA · Módulos (11-11-26)
   ---------------------------------------------------------------------
   SIMA se divide en tres módulos. Por ahora sólo el Inspector elige
   módulo; el resto de los roles entra directo a la Ruta de inspección.

     1. ruta  Ruta de inspección          (disponible: la app de siempre)
     2. nfc   Seguimiento de equipos NFC  (en preparación)
     3. iot   Monitoreo en tiempo real    (en preparación · datos de Grafana)

   Este archivo dibuja:
     · la pantalla para elegir módulo, que aparece después del login;
     · las pantallas de inicio de los módulos 2 y 3 (vModNfc, vModIot);
     · la prueba del lector NFC del celular (Web NFC, sólo Android).
   El estado (qué módulo está activo) vive en index.html: `modulo`,
   elegirModulo(), abrirSelector().
   ===================================================================== */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const e = s => (typeof esc === 'function' ? esc(s) : String(s == null ? '' : s));

  const ICO = {
    ruta: '<path d="M9 20l-5.4-2.7A1 1 0 013 16.4V4.6a1 1 0 011.4-.9L9 6m0 14l6-3m-6 3V6m6 11l4.6 2.3a1 1 0 001.4-.9V7.6a1 1 0 00-.6-.9L15 4m0 13V4M9 6l6-2"/>',
    nfc: '<path d="M6 8.3a6 6 0 010 7.4"/><path d="M9.5 6a10 10 0 010 12"/><path d="M13 3.6a14 14 0 010 16.8"/><rect x="15.5" y="4" width="6" height="16" rx="1.6"/>',
    iot: '<path d="M3 12h3.5l2.5-6 4 12 2.5-6H21"/>',
    frio: '<path d="M12 2v20M4.9 6l14.2 12M19.1 6L4.9 18"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5"/>',
    temp: '<path d="M14 14.8V5a2 2 0 10-4 0v9.8a4 4 0 104 0z"/><path d="M12 9v7"/>',
    energia: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    agua: '<path d="M12 2.7S5.5 10 5.5 14.5a6.5 6.5 0 0013 0C18.5 10 12 2.7 12 2.7z"/>',
    ok: '<path d="M20 6L9 17l-5-5"/>',
    salir: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
    flecha: '<path d="M5 12h14M13 6l6 6-6 6"/>'
  };
  const ico = (k, c = '') => `<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]}</svg>`;

  /* ---------- Datos de demostración (un solo interruptor) ------------ */
  // Módulos 2 y 3 comparten el interruptor. Es por dispositivo: el personal de
  // planta nunca ve datos de demostración salvo que alguien los active ahí.
  window.SIMA_DEMO = window.SIMA_DEMO || {
    on() { try { const v = localStorage.getItem('sima.demo'); if (v != null) return v === 'true'; return localStorage.getItem('sima.iot.demo') === 'true'; } catch (_) { return false; } },
    set(v) {
      v = !!v;
      try { localStorage.setItem('sima.demo', String(v)); localStorage.setItem('sima.iot.demo', String(v)); } catch (_) {}
      window.dispatchEvent(new CustomEvent('sima:demo', { detail: v }));
      if (typeof render === 'function') try { render(); } catch (_) {}
    }
  };

  const MODS = [
    { id: 'ruta', n: 1, t: 'Ruta de inspección', sub: 'RA', d: 'Recorré la planta con realidad aumentada: apuntá la cámara a la falla, clavá el pin NC y queda marcada con su ubicación. Después seguís cada trabajo hasta su cierre.', estado: 'disponible', home: 'inicio' },
    { id: 'nfc', n: 2, t: 'Seguimiento de equipos', sub: 'NFC', d: 'Apoyá el celular en la placa del equipo: se abre su ficha, su historial y los controles pendientes.', estado: 'preparacion', home: 'nfc' },
    { id: 'iot', n: 3, t: 'Monitoreo Industrial 5.0', sub: 'IoT + IA', d: 'Cámaras, túneles, energía, agua y vapor en tiempo real, con SIMI analizando los datos: predice desvíos, avisa a quien corresponde y sugiere qué hacer.', estado: 'preparacion', home: 'iot' }
  ];
  const mod = id => MODS.find(m => m.id === id) || MODS[0];
  window.SIMA_MODS = { lista: MODS, mod, ico };

  /* ---------- Estilos ---------------------------------------------- */
  const css = `
  .mod-screen{position:fixed;inset:0;z-index:40;overflow:auto;background:var(--bg);color:var(--tx);display:flex;flex-direction:column}
  .mod-screen[hidden]{display:none}
  .mod-top{display:flex;align-items:center;gap:12px;padding:16px 24px}
  .mod-top .brand-mark{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:var(--amber)}
  .mod-top .brand-mark svg{width:20px;height:20px}
  .mod-top b{font-size:17px;letter-spacing:.02em}
  .mod-user{margin-left:auto;display:flex;align-items:center;gap:10px;color:var(--tx2);font-size:13.5px}
  .mod-salir{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 14px;border-radius:999px;border:0;background:var(--s1);color:var(--tx2);font:600 13px var(--sans);cursor:pointer}
  .mod-salir:hover{color:var(--tx);background:var(--s2)}
  .mod-salir svg{width:16px;height:16px}
  .mod-cuerpo{width:100%;max-width:1120px;margin:0 auto;padding:28px 24px 40px;flex:1;display:flex;flex-direction:column}
  .mod-hola{display:flex;align-items:center;gap:16px;margin-bottom:28px}
  .mod-hola .simi-svg{width:64px;height:64px;flex-shrink:0}
  .mod-hola h1{margin:0;font-size:32px;line-height:1.15;letter-spacing:-.03em}
  .mod-hola p{margin:6px 0 0;color:var(--tx2);font-size:15px;line-height:1.5}
  .mod-simi{position:relative;display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:-12px 0 24px 80px;padding:14px 16px 14px 18px;border-radius:18px;background:var(--s1);box-shadow:var(--sh-card,none);max-width:860px}
  .mod-simi::before{content:"";position:absolute;left:-7px;top:-7px;width:16px;height:16px;background:var(--s1);border-radius:3px;transform:rotate(45deg)}
  .mod-simi.in .ms-txt{animation:msIn .35s ease-out}
  @keyframes msIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
  .ms-txt{flex:1;min-width:240px;font-size:15px;line-height:1.5;color:var(--tx)}
  .ms-txt b{color:var(--amber)}
  .mod-simi[data-m="nfc"] .ms-txt b{color:var(--ice,#3FC5E8)}.mod-simi[data-m="iot"] .ms-txt b{color:var(--violet,#8B7BF7)}
  .ms-acc{display:flex;gap:6px;flex-shrink:0}
  .ms-ir{height:36px;padding:0 14px;border-radius:999px;border:0;background:var(--s2);color:var(--tx);font:600 13px var(--sans);cursor:pointer;white-space:nowrap}
  .ms-ir:hover{background:var(--s3)}
  .ms-sig{width:36px;height:36px;border-radius:50%;border:0;background:var(--s2);color:var(--tx2);display:grid;place-items:center;cursor:pointer}
  .ms-sig svg{width:16px;height:16px}
  .ms-pasos{position:absolute;right:18px;bottom:-14px;display:flex;gap:5px}
  .ms-pasos i{width:6px;height:6px;border-radius:50%;background:var(--s3)}
  .ms-pasos i.on{background:var(--tx3);width:16px;border-radius:3px}
  .mod-card.apunta{box-shadow:var(--sh-card,none),inset 0 0 0 1.5px var(--amber)}
  .mod-card[data-m="nfc"].apunta{box-shadow:var(--sh-card,none),inset 0 0 0 1.5px var(--ice,#3FC5E8)}
  .mod-card[data-m="iot"].apunta{box-shadow:var(--sh-card,none),inset 0 0 0 1.5px var(--violet,#8B7BF7)}
  @media (prefers-reduced-motion:reduce){.mod-simi.in .ms-txt{animation:none}}
  .mod-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
  .mod-card{position:relative;display:flex;flex-direction:column;text-align:left;gap:14px;padding:24px;border:0;border-radius:24px;
    background:var(--s1);color:var(--tx);cursor:pointer;font:inherit;box-shadow:var(--sh-card,none);
    transition:transform .18s cubic-bezier(.2,.7,.2,1),background .18s,box-shadow .18s;min-height:290px}
  @media (hover:hover){.mod-card:hover{transform:translateY(-3px);background:var(--s2)}.mod-card:hover .mod-ir{background:var(--amber);color:#1A1206}}
  .mod-card:focus-visible{outline:2px solid var(--amber);outline-offset:3px}
  .mod-card:active{transform:translateY(-1px) scale(.995)}
  .mod-ico{width:56px;height:56px;border-radius:18px;display:grid;place-items:center;background:rgba(255,159,28,.12);color:var(--amber)}
  .mod-card[data-m="nfc"] .mod-ico{background:rgba(63,197,232,.12);color:var(--ice,#3FC5E8)}
  .mod-card[data-m="iot"] .mod-ico{background:rgba(139,123,247,.14);color:var(--violet,#8B7BF7)}
  .mod-ico svg{width:28px;height:28px}
  .mod-n{position:absolute;top:22px;right:24px;font-size:13px;color:var(--tx3);font-weight:500}
  .mod-card h2{margin:0;font-size:21px;letter-spacing:-.02em;line-height:1.2}
  .mod-card h2 small{font-size:13px;font-weight:600;color:var(--tx3);margin-left:6px;letter-spacing:0}
  .mod-card p{margin:0;color:var(--tx2);font-size:14px;line-height:1.5}
  .mod-pie{margin-top:auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .mod-est{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 12px;border-radius:999px;font-size:12.5px;font-weight:600;background:var(--s2);color:var(--tx2)}
  .mod-est i{width:7px;height:7px;border-radius:50%;background:var(--tx3)}
  .mod-est.ok{color:var(--st-cerrado,#1FCB7E);background:rgba(31,203,126,.1)}
  .mod-est.ok i{background:currentColor}
  .mod-dato{font-size:13px;color:var(--tx2);flex:1;min-width:0}
  .mod-dato b{color:var(--tx)}
  .mod-ir{margin-left:auto;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--s2);color:var(--tx);transition:background .18s,color .18s}
  .mod-card[data-m="ruta"] .mod-ir{background:var(--amber);color:#1A1206}
  .mod-ir svg{width:18px;height:18px}
  .mod-ult{position:absolute;top:-10px;left:24px;height:22px;padding:0 10px;border-radius:999px;background:var(--tx);color:var(--bg);font-size:11.5px;font-weight:700;display:flex;align-items:center}
  .mod-nota{margin-top:22px;color:var(--tx3);font-size:13px}
  @media (max-width:1000px){.mod-grid{grid-template-columns:1fr 1fr}.mod-card[data-m="ruta"]{grid-column:1/-1;min-height:0}}
  @media (max-width:640px){
    .mod-top{padding:12px 14px}.mod-user span{display:none}
    .mod-cuerpo{padding:12px 14px 28px}
    .mod-hola{margin-bottom:18px}.mod-hola .simi-svg{width:52px;height:52px}
    .mod-simi{margin:-6px 0 20px;padding:12px 14px}.mod-simi::before{left:22px}.ms-txt{min-width:0;flex-basis:100%;font-size:14px}.ms-acc{width:100%}.ms-ir{flex:1}
    .mod-hola h1{font-size:24px}.mod-hola p{display:none}
    .mod-grid{grid-template-columns:1fr;gap:12px}
    .mod-card{min-height:0;padding:16px;border-radius:20px;display:grid;grid-template-columns:44px 1fr;column-gap:12px;row-gap:8px;align-items:center}
    .mod-card .mod-ico{width:44px;height:44px;border-radius:14px}.mod-ico svg{width:22px;height:22px}
    .mod-card h2{font-size:17px}
    .mod-card .mod-n{position:static;grid-column:2;grid-row:1;align-self:end;font-size:12px;margin-bottom:-6px}
    .mod-card .mod-ico{grid-row:1/3}.mod-card h2{grid-column:2;grid-row:2;align-self:start}
    .mod-card p{grid-column:1/-1;font-size:13.5px}
    .mod-card .mod-pie{grid-column:1/-1;flex-wrap:nowrap}
    .mod-card .mod-dato{font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .mod-ir{width:36px;height:36px;flex-shrink:0}
  }
  @media (prefers-reduced-motion:reduce){.mod-card{transition:none}.mod-card:hover{transform:none}}

  /* Píldora del módulo en la barra superior */
  .mod-pill{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 14px 0 10px;margin-left:10px;border-radius:999px;border:0;background:var(--s1);color:var(--tx);font:600 13px var(--sans);cursor:pointer;white-space:nowrap}
  .mod-pill:hover{background:var(--s2)}
  .mod-pill svg{width:18px;height:18px;color:var(--amber)}
  .mod-pill[data-m="nfc"] svg{color:var(--ice,#3FC5E8)}.mod-pill[data-m="iot"] svg{color:var(--violet,#8B7BF7)}
  .mod-pill .mp-c{color:var(--tx3);font-weight:500}
  .mod-pill[hidden]{display:none}
  @media (max-width:760px){.mod-pill{padding:0 10px;margin-left:4px}.mod-pill .mp-t,.mod-pill .mp-c{display:none}}

  /* Pantallas de los módulos 2 y 3 */
  .mx-head{display:flex;align-items:flex-start;gap:16px;margin-bottom:22px}
  .mx-head .mod-ico{flex-shrink:0}
  .mx-head h2{margin:2px 0 4px;font-size:28px;letter-spacing:-.03em}
  .mx-head p{margin:0;color:var(--tx2);max-width:68ch;line-height:1.5}
  .mx-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px}
  .mx-sen{background:var(--s1);border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:8px;box-shadow:var(--sh-card,none)}
  .mx-sen .mx-i{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:var(--s2);color:var(--tx2)}
  .mx-sen .mx-i svg{width:20px;height:20px}
  .mx-sen b{font-size:15px}
  .mx-sen .mx-v{font-size:26px;font-weight:700;color:var(--tx3);letter-spacing:-.02em}
  .mx-sen small{color:var(--tx3);font-size:12.5px;line-height:1.4}
  .mx-dos{display:grid;grid-template-columns:1.1fr .9fr;gap:14px}
  .mx-box{background:var(--s1);border-radius:22px;padding:22px;box-shadow:var(--sh-card,none)}
  .mx-box h3{margin:0 0 12px;font-size:17px;letter-spacing:-.02em}
  .mx-pasos{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:12px;counter-reset:p}
  .mx-pasos li{display:flex;gap:12px;align-items:flex-start;color:var(--tx2);line-height:1.45;font-size:14px}
  .mx-pasos li::before{counter-increment:p;content:counter(p);flex-shrink:0;width:26px;height:26px;border-radius:50%;background:var(--s2);color:var(--tx);font-weight:700;font-size:13px;display:grid;place-items:center}
  .mx-pasos b{color:var(--tx)}
  .mx-check{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px}
  .mx-check li{display:flex;gap:10px;color:var(--tx2);font-size:14px;line-height:1.45}
  .mx-check li::before{content:"";flex-shrink:0;width:18px;height:18px;margin-top:1px;border-radius:6px;box-shadow:inset 0 0 0 1.5px var(--line-2)}
  .mx-flujo{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:4px 0 14px}
  .mx-flujo span{padding:8px 12px;border-radius:12px;background:var(--s2);font-size:13px;font-weight:600}
  .mx-flujo i{color:var(--tx3);font-style:normal}
  .nfc-prueba{display:flex;flex-direction:column;gap:12px}
  .nfc-res{border-radius:16px;background:var(--s2);padding:14px 16px;font-size:14px;line-height:1.5;color:var(--tx2)}
  .nfc-res.ok{background:rgba(31,203,126,.1);color:var(--tx)}
  .nfc-res.err{background:rgba(255,92,92,.1);color:var(--tx)}
  .nfc-res code{font-family:var(--mono);background:var(--s3);padding:2px 6px;border-radius:6px}
  .nfc-onda{width:72px;height:72px;border-radius:50%;display:grid;place-items:center;background:rgba(63,197,232,.12);color:var(--ice,#3FC5E8);margin:4px auto}
  .nfc-onda svg{width:34px;height:34px}
  .nfc-onda.on{animation:nfcLate 1.4s ease-in-out infinite}
  @keyframes nfcLate{0%,100%{box-shadow:0 0 0 0 rgba(63,197,232,.35)}50%{box-shadow:0 0 0 16px rgba(63,197,232,0)}}
  @media (prefers-reduced-motion:reduce){.nfc-onda.on{animation:none}}
  .mx-tag{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 12px;border-radius:999px;background:var(--s2);color:var(--tx2);font-size:12.5px;font-weight:600;margin-bottom:6px}
  @media (max-width:1000px){.mx-grid{grid-template-columns:1fr 1fr}.mx-dos{grid-template-columns:1fr}}
  @media (max-width:640px){.mx-head h2{font-size:22px}.mx-box{padding:18px}.mx-sen .mx-v{font-size:22px}}
  `;
  const st = document.createElement('style'); st.id = 'simaModulosCss'; st.textContent = css; document.head.appendChild(st);

  /* ---------- Pantalla para elegir módulo --------------------------- */
  function saludoHora() { const h = new Date().getHours(); return h < 12 ? 'Buen día' : (h < 20 ? 'Buenas tardes' : 'Buenas noches'); }
  function nombrePila() { try { const n = String(ROLES[role].name || '').trim().split(' ')[0]; return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : ''; } catch (_) { return ''; } }
  function datoRuta() {
    try {
      const ab = cnt(l => l.estado !== 'cerrado');
      const pl = PLANTAS[plantaActual] ? PLANTAS[plantaActual].label : '';
      return ab ? `<b>${ab}</b> hallazgo${ab > 1 ? 's' : ''} abierto${ab > 1 ? 's' : ''}${pl ? ' en ' + e(pl) : ''}` : `Sin hallazgos abiertos${pl ? ' en ' + e(pl) : ''}`;
    } catch (_) { return ''; }
  }
  function ultimo() { try { return localStorage.getItem('sima.modulo.ult') || ''; } catch (_) { return ''; } }

  function pintarSelector() {
    let raiz = $('modScreen');
    if (!raiz) { raiz = document.createElement('div'); raiz.id = 'modScreen'; raiz.className = 'mod-screen'; raiz.hidden = true; document.body.appendChild(raiz); }
    const nom = nombrePila();
    const tarjeta = m => `
      <button type="button" class="mod-card" data-m="${m.id}" onclick="elegirModulo('${m.id}')" aria-label="Módulo ${m.n}: ${e(m.t)}${m.sub ? ' ' + m.sub : ''}.">
        <span class="mod-n">Módulo ${m.n}</span>
        <span class="mod-ico">${ico(m.id)}</span>
        <h2>${e(m.t)}${m.sub ? `<small>${e(m.sub)}</small>` : ''}</h2>
        <p>${e(m.d)}</p>
        <span class="mod-pie">
          <span class="mod-dato">${m.id === 'ruta' ? datoRuta() : m.id === 'nfc' ? (window.SIMA_NFC ? SIMA_NFC.dato() : 'Probá si tu celular lee NFC') : (window.SIMA_IOT ? SIMA_IOT.dato() : '')}</span>
          <span class="mod-ir">${ico('flecha')}</span>
        </span>
      </button>`;
    raiz.innerHTML = `
      <header class="mod-top">
        <span class="brand-mark"><svg viewBox="0 0 24 24" fill="none" stroke="#14100A" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L3 7v10l9 5 9-5V7z"/><path d="M12 22V12M3 7l9 5 9-5"/></svg></span>
        <b>SIMA <em style="font-style:normal;color:#FF3B30">RA</em></b>
        <span class="mod-user"><span>${e((ROLES[role] && ROLES[role].name) || '')}</span>
          <button type="button" class="mod-salir" onclick="cerrarSesion()">${ico('salir')} Cerrar sesión</button></span>
      </header>
      <main class="mod-cuerpo" aria-labelledby="modTit">
        <div class="mod-hola">
          ${window.SIMI_M ? SIMI_M.svg('h-saluda') : ''}
          <div><h1 id="modTit">${saludoHora()}${nom ? ', ' + e(nom) : ''}</h1>
          <p>¿Con qué trabajamos hoy? Elegí un módulo; después podés cambiar desde la barra de arriba.</p></div>
        </div>
        <div class="mod-simi" id="modSimi" onmouseenter="SIMA_MOD_GLOBO.pausa(true)" onmouseleave="SIMA_MOD_GLOBO.pausa(false)" onfocusin="SIMA_MOD_GLOBO.pausa(true)" onfocusout="SIMA_MOD_GLOBO.pausa(false)">
          <span class="ms-txt" id="modSimiTxt" role="status" aria-live="polite"></span>
          <span class="ms-acc"><button type="button" class="ms-ir" id="modSimiIr"></button>
          <button type="button" class="ms-sig" onclick="SIMA_MOD_GLOBO.sig()" aria-label="Otra sugerencia de SIMI">${ico('flecha')}</button></span>
          <span class="ms-pasos" id="modSimiPasos" aria-hidden="true"></span>
        </div>
        <div class="mod-grid" role="list">${MODS.map(m => `<div role="listitem" style="display:contents">${tarjeta(m)}</div>`).join('')}</div>
      </main>`;
    if (window.SIMI_M) SIMI_M.vivir(raiz);
    globo.iniciar();
    return raiz;
  }
  window.SIMA_MOD_SELECTOR = pintarSelector;

  /* ---------- SIMI cuenta en qué ayuda cada módulo ------------------- */
  // Rota cada ~6 s (se pausa con el mouse o el foco encima), usa datos reales
  // cuando los hay y resalta la tarjeta del módulo del que habla.
  function mensajes() {
    const r = [], n = [], i = [];
    let ab = 0, pl = '';
    try { ab = cnt(l => l.estado !== 'cerrado'); pl = PLANTAS[plantaActual] ? PLANTAS[plantaActual].label : ''; } catch (_) {}
    r.push('En la <b>Ruta de inspección</b> te acompaño en el recorrido: sacás la foto, dictás lo que ves y yo ordeno el hallazgo.');
    if (ab) r.push(`Hay <b>${ab}</b> hallazgos abiertos${pl ? ' en ' + e(pl) : ''}. En la Ruta te digo cuáles atender primero y cuáles se están atrasando.`);
    r.push('Programo los trabajos en el calendario, te aviso los que vencen y te digo cómo reparar cada falla.');
    const nfc = window.SIMA_NFC, alN = nfc && nfc.activo() ? nfc.alertas() : [];
    if (alN.length) n.push(`En <b>Seguimiento de equipos</b>: ${alN[0].t.charAt(0).toLowerCase() + alN[0].t.slice(1)}. Entrá y lo resolvemos.`);
    n.push('En <b>Seguimiento de equipos</b> apoyás el celular en la placa de un equipo y te muestro su ficha, su historial y lo que falta controlar.');
    n.push('Con las placas NFC queda registrado quién pasó por cada equipo y cuándo: el recorrido deja de ser de palabra.');
    const iot = window.SIMA_IOT, act = iot && iot.activo && iot.activo(), al = act ? iot.alarmas() : [];
    if (al.length) i.push(`Ahora hay <b>${al.length}</b> ${al.length > 1 ? 'alarmas activas' : 'alarma activa'} en <b>Monitoreo Industrial 5.0</b>. Entrá y te digo qué revisar.`);
    i.push('En <b>Monitoreo Industrial 5.0</b> vigilo cámaras, túneles, energía, agua y vapor en tiempo real, y te aviso antes de que algo salga de rango.');
    i.push('Con el histórico detecto equipos que empiezan a fallar, como un túnel que tarda cada vez más en enfriar, y te propongo el trabajo.');
    const out = [], max = Math.max(r.length, n.length, i.length);
    for (let k = 0; k < max; k++) { if (r[k]) out.push({ m: 'ruta', t: r[k] }); if (i[k]) out.push({ m: 'iot', t: i[k] }); if (n[k]) out.push({ m: 'nfc', t: n[k] }); }
    if (al.length) out.unshift(out.splice(out.findIndex(x => x.m === 'iot'), 1)[0]);   // una alarma va primero
    return out;
  }
  const globo = {
    l: [], i: 0, t: null, pausado: false,
    iniciar() { clearInterval(this.t); this.l = mensajes(); this.i = 0; this.mostrar(); this.t = setInterval(() => { const s = $('modScreen'); if (!s || s.hidden) { clearInterval(this.t); return; } if (!this.pausado && !document.hidden) this.sig(true); }, 6500); },
    mostrar() {
      const x = this.l[this.i]; if (!x) return;
      const txt = $('modSimiTxt'), ir = $('modSimiIr'), p = $('modSimiPasos'), M = mod(x.m);
      if (!txt) return;
      const caja = $('modSimi'); caja.classList.remove('in'); void caja.offsetWidth; caja.classList.add('in');
      caja.dataset.m = x.m; txt.innerHTML = x.t;
      ir.textContent = `Ir a ${M.t}`; ir.onclick = () => elegirModulo(x.m);
      p.innerHTML = this.l.map((_, k) => `<i class="${k === this.i ? 'on' : ''}"></i>`).join('');
      document.querySelectorAll('#modScreen .mod-card').forEach(c => c.classList.toggle('apunta', c.dataset.m === x.m));
      const sv = document.querySelector('#modScreen .mod-hola .simi-svg');
      if (window.SIMI_M && sv) SIMI_M.humor(sv, x.m === 'iot' && /alarma/.test(x.t) ? 'alerta' : 'feliz', 1200);
    },
    sig(auto) { if (!this.l.length) return; this.i = (this.i + 1) % this.l.length; this.mostrar(); if (!auto) { clearInterval(this.t); this.t = setInterval(() => { const s = $('modScreen'); if (!s || s.hidden) { clearInterval(this.t); return; } if (!this.pausado && !document.hidden) this.sig(true); }, 6500); } },
    pausa(v) { this.pausado = v; }
  };
  window.SIMA_MOD_GLOBO = globo;

  /* ---------- Módulo 2 · Seguimiento de equipos (NFC) ---------------- */
  const nfcSoportado = () => 'NDEFReader' in window;
  let nfcCtl = null;
  window.probarNfc = async function () {
    const res = $('nfcRes'), onda = $('nfcOnda'), btn = $('nfcBtn');
    if (!res) return;
    if (!nfcSoportado()) {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      res.className = 'nfc-res err';
      res.innerHTML = ios
        ? 'Este iPhone no permite leer NFC desde una web. En el piloto las placas van a tener también un <b>código QR</b> y un enlace NFC que el iPhone abre solo.'
        : 'Este navegador no puede leer NFC. Funciona en <b>celulares Android con Chrome</b> (o Samsung Internet) y con el NFC activado en Ajustes. En computadora no está disponible.';
      return;
    }
    try {
      if (nfcCtl) nfcCtl.abort();
      nfcCtl = new AbortController();
      const lector = new NDEFReader();
      await lector.scan({ signal: nfcCtl.signal });
      onda && onda.classList.add('on'); btn && (btn.textContent = 'Esperando el tag…');
      res.className = 'nfc-res'; res.innerHTML = 'Listo. <b>Apoyá la parte de atrás del celular</b> sobre un tag o una tarjeta NFC.';
      const parar = setTimeout(() => { if (nfcCtl) nfcCtl.abort(); onda && onda.classList.remove('on'); btn && (btn.textContent = 'Probar de nuevo'); if (res.className === 'nfc-res') res.innerHTML = 'No se leyó ningún tag en 30 segundos. Probá de nuevo acercándolo despacio.'; }, 30000);
      lector.onreadingerror = () => { res.className = 'nfc-res err'; res.innerHTML = 'Detecté un tag pero no lo pude leer. Mantenelo quieto un segundo más.'; };
      lector.onreading = ev => {
        clearTimeout(parar); nfcCtl.abort(); onda && onda.classList.remove('on'); btn && (btn.textContent = 'Leer otro tag');
        const recs = [...(ev.message && ev.message.records || [])].map(r => {
          let txt = '';
          try { if (r.recordType === 'text' || r.recordType === 'url') txt = new TextDecoder(r.encoding || 'utf-8').decode(r.data); } catch (_) {}
          return r.recordType + (txt ? ': ' + txt : '');
        });
        res.className = 'nfc-res ok';
        res.innerHTML = `¡Funciona! Tu celular leyó el tag.<br>Número de serie: <code>${e(ev.serialNumber || 'sin dato')}</code>${recs.length ? `<br>Contenido: ${recs.map(e).join(' · ')}` : '<br>El tag está vacío (normal en uno nuevo).'}`;
        if (window.SIMI_M) { const s = document.querySelector('#simiFab .simi-svg'); s && SIMI_M.humor(s, 'feliz', 1600); }
      };
    } catch (err) {
      onda && onda.classList.remove('on');
      res.className = 'nfc-res err';
      res.innerHTML = /NotAllowed/i.test(err && err.name) ? 'No diste permiso para usar NFC. Volvé a tocar el botón y aceptá el permiso.'
        : /NotReadable|NotSupported/i.test(err && err.name) ? 'El NFC del celular está apagado o no está disponible. Activalo en Ajustes › Conexiones › NFC y probá de nuevo.'
          : 'No se pudo iniciar la lectura NFC (' + e(err && err.message || err) + ').';
    }
  };

  window.vModNfc = function () {
    const sop = nfcSoportado();
    return `
      <div class="mx-head"><span class="mod-ico" style="background:rgba(63,197,232,.12);color:var(--ice,#3FC5E8)">${ico('nfc')}</span>
        <div><span class="mx-tag">Módulo 2 · En preparación</span><h2>Seguimiento de equipos</h2>
        <p>Cada equipo crítico va a tener una placa NFC. Al apoyar el celular se abre su ficha: historial de fallas, controles pendientes y hallazgos, sin buscar en listas.</p></div></div>
      <div class="mx-dos">
        <section class="mx-box" aria-labelledby="nfcT1">
          <h3 id="nfcT1">Cómo va a funcionar</h3>
          <ol class="mx-pasos">
            <li><span><b>Apoyás el celular</b> en la placa del equipo (puerta de cámara, esterilizador, compresor…).</span></li>
            <li><span>Se abre la <b>ficha del equipo</b>: datos, ubicación y estado.</span></li>
            <li><span>Ves su <b>historial</b>: hallazgos, reparaciones y fallas que se repiten.</span></li>
            <li><span>Registrás el <b>control del día</b> o cargás un hallazgo con el equipo ya elegido.</span></li>
            <li><span>Queda constancia de <b>quién pasó, cuándo y dónde</b>: el recorrido deja de ser declarativo.</span></li>
          </ol>
        </section>
        <section class="mx-box nfc-prueba" aria-labelledby="nfcT2">
          <h3 id="nfcT2">Probá tu celular ahora</h3>
          <span class="nfc-onda" id="nfcOnda">${ico('nfc')}</span>
          <button type="button" class="btn btn-primary" id="nfcBtn" onclick="probarNfc()">${sop ? 'Probar lector NFC' : 'Ver si mi celular sirve'}</button>
          <div class="nfc-res" id="nfcRes" role="status" aria-live="polite">${sop ? 'Tu navegador puede leer NFC. Tocá el botón y apoyá una tarjeta o un tag.' : 'Para leer NFC hace falta un celular Android con Chrome. Tocá el botón y te digo qué pasa con este equipo.'}</div>
        </section>
      </div>
      <section class="mx-box" style="margin-top:14px" aria-labelledby="nfcT3">
        <h3 id="nfcT3">Qué hace falta para el piloto</h3>
        <ul class="mx-check">
          <li>Lista de 10 a 20 equipos críticos con su código y ubicación.</li>
          <li>Tags NFC anti-metal, aptos para frío y lavado (NTAG213/216, IP68), con un QR impreso para iPhone.</li>
          <li>Celulares Android con NFC para los inspectores.</li>
          <li>Definir qué se controla en cada tipo de equipo (checklist del control).</li>
        </ul>
      </section>`;
  };

  /* Módulo 3 · Monitoreo en tiempo real: ver sima-iot.js (modo demostración). */
})();
