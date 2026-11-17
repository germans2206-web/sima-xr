/* =====================================================================
   SIMI · asistente de SIMA (06-11-26)
   ---------------------------------------------------------------------
   Mascota propia de SIMA: nace del logo (el cubo hexagonal ámbar) con un
   visor y ojos celestes. Vive en un botón flotante, disponible en todas
   las pantallas, y abre un panel de conversación:
     · Celular / tablet: hoja inferior (bottom sheet) con fondo atenuado.
     · PC: panel flotante abajo a la derecha, sin tapar la pantalla.
   Qué hace:
     · Acompaña: al abrir saluda y resume lo pendiente según el rol.
     · Responde cantidades, rankings (área, tipo, sector, disciplina),
       reparto por estado y los más antiguos sin cerrar, con filtros por
       área, tipo, disciplina, estado y período.
     · Cada respuesta lleva acciones: ver en la lista (con los filtros ya
       puestos), abrir un hallazgo o profundizar con un toque.
   Cómo calcula: TODOS los números salen de los datos que la app ya tiene
   (L(): planta activa y lo que el rol puede ver). La pregunta se entiende
   primero con reglas locales (funciona sin señal); si no alcanza y hay
   señal, Llama sólo la traduce a una consulta estructurada en
   /api/ia/consulta. El modelo nunca ve datos ni inventa cifras.
   Depende de globales de index.html (L, AREAS, CATEGORIAS, ESTADOS, …) y
   del motor de dictado (dictIniciar).
   ===================================================================== */
(function () {
  'use strict';

  /* ---------------- Mascota (SVG original) ---------------- */
  let nSvg = 0;
  function simiSvg(cls = '') {
    // Dibujo animado común (sima-mascota.js); sin él, el dibujo fijo de siempre.
    if (window.SIMI_M) return SIMI_M.svg(cls, { manos: !/\bmini\b/.test(cls) });
    const g = 'simiG' + (++nSvg);
    return `<svg class="simi-svg ${cls}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB84D"/><stop offset="1" stop-color="#E5761A"/></linearGradient></defs>
      <line class="simi-ant-l" x1="32" y1="9" x2="32" y2="3.5" stroke="#54646F" stroke-width="2.2" stroke-linecap="round"/>
      <circle class="simi-ant" cx="32" cy="3.6" r="3" fill="#3FC5E8"/>
      <path d="M32 8 L56 20 V45 L32 58 L8 45 V20 Z" fill="url(#${g})" stroke="#14100A" stroke-opacity=".18" stroke-width="1"/>
      <path d="M8 20 L32 8 L56 20 L32 31 Z" fill="#fff" fill-opacity=".22"/>
      <rect x="13.5" y="24" width="37" height="21" rx="10" fill="#14100A"/>
      <g class="simi-ojos"><rect x="22" y="29.5" width="6" height="9" rx="3" fill="#3FC5E8"/><rect x="36" y="29.5" width="6" height="9" rx="3" fill="#3FC5E8"/></g>
      <g class="simi-ojos-f" fill="none" stroke="#3FC5E8" stroke-width="2.6" stroke-linecap="round"><path d="M21.5 35 q3.5 -5 7 0"/><path d="M35.5 35 q3.5 -5 7 0"/></g>
      <path class="simi-boca" d="M29.5 41.2 q2.5 1.8 5 0" fill="none" stroke="#3FC5E8" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>
    </svg>`;
  }

  /* ---------------- Estilos ---------------- */
  const css = `
  .simi-fab{position:fixed;right:24px;bottom:24px;z-index:46;display:flex;align-items:center;gap:10px;height:60px;padding:0 20px 0 8px;border-radius:30px;border:1px solid var(--line-2);
    background:var(--s1);color:var(--tx);cursor:pointer;box-shadow:var(--sh-2),0 0 0 4px color-mix(in srgb,var(--amber) 0%,transparent);font:700 14px/1 var(--sans);
    transition:transform .18s var(--ease),box-shadow .2s var(--ease)}
  .simi-fab:hover{transform:translateY(-2px);box-shadow:var(--sh-3)}
  .simi-fab:active{transform:scale(.96)}
  .simi-fab:focus-visible{outline:3px solid var(--amber);outline-offset:3px}
  .simi-fab .simi-svg{width:46px;height:46px;flex-shrink:0;filter:drop-shadow(0 3px 6px rgba(229,118,26,.35))}
  .simi-fab-lbl small{display:block;font:500 10px/1.2 var(--mono);letter-spacing:.08em;color:var(--tx3);margin-top:3px}
  .simi-fab.abierto{opacity:0;pointer-events:none;transform:scale(.8)}
  .simi-fab.nuevo::after{content:'';position:absolute;inset:-5px;border-radius:34px;border:2px solid var(--amber);animation:simiAnillo 1.8s ease-out 3}
  @keyframes simiAnillo{from{opacity:.9;transform:scale(.96)}to{opacity:0;transform:scale(1.12)}}
  .simi-tip{position:fixed;right:24px;bottom:96px;z-index:46;max-width:270px;padding:12px 38px 12px 14px;border-radius:14px 14px 4px 14px;background:var(--s1);border:1px solid var(--line-2);
    box-shadow:var(--sh-2);font-size:13px;line-height:1.45;color:var(--tx);animation:simiSube .35s var(--ease)}
  .simi-tip b{color:var(--amber-tx)}
  .simi-tip>button{position:absolute;top:6px;right:6px;width:30px;height:30px;border:0;background:none;color:var(--tx3);cursor:pointer;border-radius:8px;font-size:16px}
  .simi-scrim{position:fixed;inset:0;z-index:89;background:rgba(5,7,9,.55);backdrop-filter:blur(2px);opacity:0;pointer-events:none;transition:opacity .2s}
  .simi-panel{position:fixed;right:24px;bottom:24px;z-index:90;width:400px;height:min(660px,calc(100vh - 48px));display:flex;flex-direction:column;
    background:var(--s1);border:1px solid var(--line-2);border-radius:22px;box-shadow:var(--sh-3);overflow:hidden;transform-origin:bottom right;animation:simiAbre .22s var(--ease)}
  .simi-panel[hidden]{display:none}
  @keyframes simiAbre{from{opacity:0;transform:scale(.92) translateY(10px)}to{opacity:1;transform:none}}
  @keyframes simiSube{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  .simi-grab{display:none}
  .simi-head{display:flex;align-items:center;gap:11px;padding:12px 10px 12px 14px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,color-mix(in srgb,var(--amber) 9%,var(--s1)),var(--s1))}
  .simi-head .simi-svg{width:42px;height:42px;flex-shrink:0}
  .simi-head h2{font-size:16px;font-weight:800;letter-spacing:.12em;line-height:1.1}
  .simi-sub{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--tx3);margin-top:3px}
  .simi-tit{flex:1;min-width:0;outline:none}
  .simi-ico{width:44px;height:44px;display:grid;place-items:center;border:0;border-radius:12px;background:none;color:var(--tx2);cursor:pointer}
  .simi-ico:hover{background:var(--s3);color:var(--tx)}
  .simi-ico:focus-visible{outline:2px solid var(--amber);outline-offset:-2px}
  .simi-ico svg{width:19px;height:19px}
  .simi-log{flex:1;overflow-y:auto;padding:16px 14px 6px;display:flex;flex-direction:column;gap:12px;overscroll-behavior:contain;scroll-behavior:smooth}
  .simi-msg{display:flex;gap:8px;max-width:100%;animation:simiSube .25s var(--ease)}
  .simi-msg.yo{justify-content:flex-end}
  .simi-msg .simi-mini{width:28px;height:28px;flex-shrink:0;margin-top:2px}
  .simi-msg .simi-mini .simi-svg{width:28px;height:28px}
  .simi-msg.cont .simi-mini{visibility:hidden}
  .simi-bur{min-width:0;max-width:calc(100% - 36px);padding:10px 13px;border-radius:4px 16px 16px 16px;background:var(--s2);border:1px solid var(--line);font-size:14px;line-height:1.5;color:var(--tx)}
  .simi-msg.yo .simi-bur{border-radius:16px 4px 16px 16px;background:color-mix(in srgb,var(--amber) 16%,var(--s2));border-color:color-mix(in srgb,var(--amber) 35%,transparent)}
  .simi-bur b{font-weight:800}
  .simi-bur .simi-num{color:var(--amber-tx)}
  .simi-ctx{display:flex;flex-wrap:wrap;gap:5px;margin:0 0 8px}
  .simi-ctx span{font:600 10.5px/1 var(--mono);letter-spacing:.04em;padding:5px 7px;border-radius:6px;background:var(--s3);color:var(--tx2)}
  .simi-ia{display:inline-flex;align-items:center;gap:4px;font:600 10px/1 var(--mono);color:var(--violet-tx);margin-top:8px}
  .simi-guia{margin-top:2px;padding:12px 13px;border-radius:12px;background:var(--s1);border:1px solid var(--line);border-left:3px solid var(--amber)}
  .simi-guia-cab{font:700 10px/1 var(--mono);letter-spacing:.12em;color:var(--amber-tx);margin-bottom:7px}
  .simi-guia-t{display:block;font-size:14.5px;line-height:1.35;margin-bottom:8px}
  .simi-pasos{margin:6px 0 0;padding:0;list-style:none;counter-reset:paso;display:flex;flex-direction:column;gap:7px}
  .simi-pasos li{counter-increment:paso;display:grid;grid-template-columns:22px 1fr;gap:8px;font-size:13.5px;line-height:1.45;color:var(--tx)}
  .simi-pasos li::before{content:counter(paso);width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font:700 11px/1 var(--mono);
    background:color-mix(in srgb,var(--amber) 16%,transparent);color:var(--amber-tx)}
  .simi-ref{font-weight:700;color:var(--tx)}
  .simi-tip-g{margin:10px 0 0;padding:8px 10px;border-radius:9px;background:var(--s2);font-size:12.5px;line-height:1.45;color:var(--tx2)}
  .simi-volver{margin:8px 0 0;color:var(--tx2)}
  .simi-aviso{margin:0 0 8px;padding:7px 9px;border-radius:8px;font-size:12.5px;background:color-mix(in srgb,var(--ice) 12%,transparent);color:var(--ice-tx)}
  .simi-rep{margin-top:2px;padding:12px 13px;border-radius:12px;background:var(--s1);border:1px solid var(--line)}
  .simi-g-tag{font:700 10px/1 var(--mono);letter-spacing:.12em;color:var(--ice-tx);margin-bottom:7px}
  .simi-rep-t{display:block;font-size:14.5px;line-height:1.35}
  .simi-rep h5{font:700 10.5px/1.2 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--tx3);margin:12px 0 6px}
  .simi-rep h5.simi-cuid-t{color:var(--amber-tx)}
  .simi-ul{margin:0;padding:0 0 0 2px;list-style:none;display:flex;flex-direction:column;gap:5px}
  .simi-ul li{position:relative;padding-left:14px;font-size:13px;line-height:1.45;color:var(--tx)}
  .simi-ul li::before{content:'';position:absolute;left:2px;top:.6em;width:5px;height:5px;border-radius:50%;background:var(--tx3)}
  .simi-cuid li::before{background:var(--amber)}
  .simi-badge{position:absolute;top:-4px;left:38px;min-width:21px;height:21px;padding:0 6px;border-radius:11px;background:var(--red);color:#fff;font:800 11px/21px var(--sans);text-align:center;box-shadow:0 0 0 2px var(--s1)}
  .simi-badge[hidden]{display:none}
  .simi-tip-lado{right:auto;bottom:auto;border-radius:14px 14px 4px 14px;max-width:300px}
  .simi-tip.ok{border-color:color-mix(in srgb,var(--green) 45%,var(--line-2))}
  .simi-tip.ok b{color:var(--green-tx)}
  .simi-tip.alerta{border-color:color-mix(in srgb,var(--red) 45%,var(--line-2))}
  .simi-tip.alerta b{color:var(--red-tx)}
  .simi-tip-tit{display:block;font:700 10px/1.4 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--red-tx);margin-bottom:4px}
  .simi-tip-acc{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
  .simi-tip-acc .btn{min-height:36px}
  .simi-tip-lado{position:fixed}
  .simi-kpis{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
  .simi-kpi{text-align:left;padding:10px 11px;border-radius:12px;background:var(--s1);border:1px solid var(--line);border-left:3px solid var(--kc);cursor:pointer;color:var(--tx);min-height:44px}
  .simi-kpi:hover{background:var(--s3)}
  .simi-kpi b{display:block;font:800 22px/1 var(--sans);font-variant-numeric:tabular-nums}
  .simi-kpi span{display:block;font-size:11.5px;color:var(--tx2);margin-top:4px}
  .simi-barras{display:flex;flex-direction:column;gap:2px;margin-top:10px}
  .simi-fila{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 10px;align-items:center;padding:7px 8px;border-radius:9px;border:0;background:none;color:var(--tx);text-align:left;cursor:pointer;font:inherit;min-height:44px}
  .simi-fila:hover{background:var(--s3)}
  .simi-fila:focus-visible{outline:2px solid var(--amber);outline-offset:-2px}
  .simi-fila .l{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .simi-fila .v{font:700 13px/1 var(--sans);font-variant-numeric:tabular-nums}
  .simi-fila .v small{font-weight:500;color:var(--tx3);font-size:11px;margin-left:4px}
  .simi-fila .b{grid-column:1/-1;height:7px;border-radius:4px;background:var(--s3);overflow:hidden}
  .simi-fila .b i{display:block;height:100%;border-radius:4px;background:var(--bc,var(--amber))}
  .simi-fila .b i+i{margin-top:-7px;opacity:.45}
  .simi-lista{display:flex;flex-direction:column;gap:6px;margin-top:10px}
  .simi-it{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:11px;border:1px solid var(--line);background:var(--s1);cursor:pointer;color:var(--tx);text-align:left;font:inherit;min-height:48px}
  .simi-it:hover{background:var(--s3)}
  .simi-it .id{font:700 11.5px/1 var(--mono);color:var(--tx2)}
  .simi-it .t{flex:1;min-width:0;font-size:12.5px;line-height:1.35}
  .simi-it .t small{display:block;color:var(--tx3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .simi-it .d{font:700 11px/1 var(--mono);padding:5px 7px;border-radius:7px;background:color-mix(in srgb,var(--red) 16%,transparent);color:var(--red-tx);white-space:nowrap}
  .simi-acc{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
  .simi-acc .btn{min-height:40px}
  .simi-piensa{display:flex;gap:10px;align-items:center;padding:10px 14px 10px 10px;border-radius:4px 16px 16px 16px;background:var(--s2);border:1px solid var(--line);max-width:300px}
  .sp-cara{width:34px;height:34px;flex-shrink:0;display:grid;place-items:center}.sp-cara svg{width:100%;height:100%}
  .sp-cuerpo{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
  .sp-txt{font-size:13px;color:var(--tx2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sp-txt.in{animation:spIn .35s ease-out}
  @keyframes spIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
  .sp-lineas{display:flex;flex-direction:column;gap:4px}
  .sp-lineas i{height:5px;border-radius:3px;background:linear-gradient(90deg,var(--s3) 0%,color-mix(in srgb,var(--amber) 45%,var(--s3)) 50%,var(--s3) 100%);background-size:200% 100%;animation:spLinea 1.4s linear infinite}
  .sp-lineas i:nth-child(1){width:92%}.sp-lineas i:nth-child(2){width:74%;animation-delay:.2s}.sp-lineas i:nth-child(3){width:52%;animation-delay:.4s}
  @keyframes spLinea{from{background-position:100% 0}to{background-position:-100% 0}}
  .simi-esc{display:flex;gap:5px;padding:12px 14px;border-radius:4px 16px 16px 16px;background:var(--s2);border:1px solid var(--line)}
  .simi-esc i{width:7px;height:7px;border-radius:50%;background:var(--tx3);animation:simiPunto 1.1s infinite}
  .simi-esc i:nth-child(2){animation-delay:.15s}.simi-esc i:nth-child(3){animation-delay:.3s}
  @keyframes simiPunto{0%,60%,100%{opacity:.3;transform:none}30%{opacity:1;transform:translateY(-3px)}}
  .simi-sug{display:flex;gap:8px;padding:8px 14px 10px;overflow-x:auto;scrollbar-width:none;flex-shrink:0}
  .simi-sug::-webkit-scrollbar{display:none}
  .simi-chip{flex-shrink:0;min-height:40px;padding:0 14px;border-radius:20px;border:1px solid color-mix(in srgb,var(--amber) 45%,var(--line-2));background:color-mix(in srgb,var(--amber) 8%,var(--s1));
    color:var(--tx);font:600 13px/1 var(--sans);cursor:pointer;white-space:nowrap}
  .simi-chip:hover{background:color-mix(in srgb,var(--amber) 18%,var(--s1))}
  .simi-chip:focus-visible{outline:2px solid var(--amber);outline-offset:2px}
  .simi-pie{padding:0 12px 12px;border-top:1px solid var(--line);padding-top:10px;flex-shrink:0}
  .simi-dict.dict{display:flex;align-items:flex-end;border-radius:24px;background:var(--s2)}
  .simi-dict.dict textarea{min-height:46px;max-height:120px;padding:13px 4px 11px 16px;resize:none;font-size:15px;line-height:1.35}
  .simi-dict .dict-bar{border-top:0;min-height:46px;padding:3px;flex-shrink:0;width:auto}
  .simi-dict .dict-idle{gap:4px;width:auto}
  .simi-dict .simi-mic,.simi-dict .simi-env{width:44px;height:44px;border-radius:22px;border:0;display:grid;place-items:center;cursor:pointer}
  .simi-dict .simi-mic{background:var(--s3);color:var(--tx)}
  .simi-dict .simi-mic:hover{background:var(--s4)}
  .simi-dict .simi-env{background:linear-gradient(145deg,var(--amber),#E5761A);color:#14100A}
  .simi-dict .simi-env:disabled{background:var(--s3);color:var(--tx3);cursor:default}
  .simi-dict .simi-mic svg,.simi-dict .simi-env svg{width:20px;height:20px}
  .simi-dict.grabando,.simi-dict.procesando,.simi-dict.hecho{align-items:center}
  .simi-dict.grabando textarea,.simi-dict.procesando textarea{display:none}
  .simi-dict.grabando .dict-bar,.simi-dict.procesando .dict-bar{flex:1;width:100%;padding:3px 3px 3px 14px;border-radius:24px}
  .simi-dict .dict-proc{padding-left:14px}
  .simi-dict .dict-rec{gap:6px}
  .simi-dict .dict-rev{background:var(--s3);color:var(--tx);box-shadow:none}
  .simi-revnota{display:flex;gap:7px;align-items:center;font-size:12px;color:var(--tx2);margin:0 4px 8px;padding:7px 10px;border-radius:10px;background:color-mix(in srgb,var(--amber) 10%,var(--s2));border:1px solid color-mix(in srgb,var(--amber) 35%,var(--line))}
  .simi-revnota svg{width:14px;height:14px;flex-shrink:0;color:var(--amber)}
  @media(max-width:420px){.simi-dict .dict-ok span{display:none}.simi-dict .dict-ok{padding:0 12px}}
  .simi-dict.hecho .dict-bar{display:none}
  .simi-svg .simi-ojos-f{display:none}
  .simi-panel .simi-svg .simi-ant{animation:none}
  .feliz .simi-svg .simi-ojos,.feliz .simi-svg .simi-boca{display:none}
  .feliz .simi-svg .simi-ojos-f{display:inline}
  @media(max-width:1000px){
    .simi-fab{right:14px;bottom:calc(76px + env(safe-area-inset-bottom));width:58px;height:58px;padding:0;justify-content:center;border-radius:29px}
    .simi-fab .simi-fab-lbl{display:none}
    .simi-fab .simi-svg{width:44px;height:44px}
    .simi-fab.nuevo::after{border-radius:33px}
    .simi-tip{right:14px;bottom:calc(144px + env(safe-area-inset-bottom))}
    .simi-badge{left:auto;right:-4px}
    .simi-tip-lado{max-width:min(300px,calc(100vw - 96px))}
    .simi-scrim.on{opacity:1;pointer-events:auto}
    .simi-panel{left:0;right:0;bottom:0;width:auto;height:min(88dvh,760px);border-radius:24px 24px 0 0;border-bottom:0;transform-origin:bottom center;animation:simiHoja .26s var(--ease);
      padding-bottom:env(safe-area-inset-bottom)}
    @keyframes simiHoja{from{transform:translateY(40%);opacity:.4}to{transform:none;opacity:1}}
    .simi-grab{display:block;width:40px;height:5px;border-radius:3px;background:var(--line-2);margin:8px auto 0;flex-shrink:0}
    .simi-head{background:none;padding-top:6px}
    .main-inner{padding-bottom:calc(160px + env(safe-area-inset-bottom))!important}
    .toast-wrap{bottom:calc(146px + env(safe-area-inset-bottom))!important}
  }
  @media(min-width:1001px){
    .toast-wrap{bottom:100px!important}
    .main-inner{padding-bottom:110px}
  }
  @media(prefers-reduced-motion:reduce){
    .simi-svg *,.simi-fab.nuevo::after,.simi-panel,.simi-msg,.simi-tip,.simi-esc i,.sp-lineas i,.sp-txt.in{animation:none!important}
  }`;
  const st = document.createElement('style'); st.id = 'simiCss'; st.textContent = css; document.head.appendChild(st);

  /* ---------------- Utilidades ---------------- */
  const N = x => Number(x).toLocaleString('es-PY');
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const abierto = l => l.estado !== 'cerrado';
  const diasDe = l => { if (!l.fechaDet) return 0; const d = new Date(l.fechaDet + 'T12:00'), h = new Date(today() + 'T12:00'); return Math.max(0, Math.round((h - d) / 864e5)); };
  const nombrePila = () => (ROLES[role] && ROLES[role].name || '').split(' ')[0] || '';
  const plantaLbl = () => (PLANTAS[plantaActual] && PLANTAS[plantaActual].label) || '';
  const iaOk = () => typeof iaDisponible === 'function' && iaDisponible() && navigator.onLine !== false;
  const sumarDias = (iso, n) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return isoLocal(d); };

  const DIM_LBL = { tecnico: 'Técnico',  area: 'Área', tipo: 'Tipo de hallazgo', sector: 'Sector', disciplina: 'Disciplina', estado: 'Estado' };
  const EST_TXT = { abiertos: 'abiertos', cerrados: 'cerrados', detectado: 'por programar', programado: 'programados', en_ejecucion: 'en ejecución', pendiente_verificacion: 'a verificar por el Inspector', a_validar: 'a validar por Calidad' };
  const PER_TXT = { hoy: 'hoy', ayer: 'ayer', semana: 'en los últimos 7 días', mes: 'este mes', mes_pasado: 'el mes pasado', anio: 'este año' };

  /* ---------------- Entender la pregunta (local) ---------------- */
  const SIN_AREA = { fria: /\bfri[ao]s?\b/, caliente: /\bcalient/, exteriores: /\bexterior/, graseria: /\bgraser/ };
  const SIN_TIPO = { luminaria: /\b(luz|luces|ilumina|lampara|foco)/, tomacorriente: /\b(enchufe|toma\b)/, conexion: /\b(cable|cableado)/, hermeticidad: /\b(hermetic|sellado)/, silicona: /\bsilicon/ };
  const raiz = w => w.length > 5 ? w.slice(0, w.length - 2) : w;

  function interpretar(texto) {
    const q = ' ' + sinAcentos(texto).replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ') + ' ';
    const c = { intent: '', dim: '', estado: '', area: '', tipo: '', disc: '', periodo: '', sector: '' };
    // Entidades
    areaKeys().forEach(k => {
      const re = SIN_AREA[k] || new RegExp('\\b' + raiz(sinAcentos(AREAS[k].label).replace(/^area\s+/, '').split(' ')[0]));
      if (!c.area && re.test(q)) c.area = k;
    });
    Object.keys(CATEGORIAS).filter(k => k !== 'otro').forEach(k => {
      if (c.tipo) return;
      const w = sinAcentos(CATEGORIAS[k].label).split(' ')[0];
      if (new RegExp('\\b' + raiz(w)).test(q) || (SIN_TIPO[k] && SIN_TIPO[k].test(q))) c.tipo = k;
    });
    if (/\bcivil/.test(q)) c.disc = 'civil'; else if (/\belectric/.test(q) && c.tipo !== 'conexion') c.disc = 'electrico'; else if (/\bmecanic/.test(q)) c.disc = 'mecanico';
    if (/\b(a validar|validar|validacion|calidad)/.test(q)) c.estado = 'a_validar';
    else if (/\b(por programar|sin programar|sin asignar|detectad|sin orden)/.test(q)) c.estado = 'detectado';
    else if (/\bprogramad/.test(q)) c.estado = 'programado';
    else if (/\b(ejecucion|en curso|trabajando|haciendo)/.test(q)) c.estado = 'en_ejecucion';
    else if (/\b(a verificar|por verificar|verificar|verificacion)/.test(q)) c.estado = 'pendiente_verificacion';
    else if (/\b(abiert|pendient|sin cerrar|sin resolver|falta)/.test(q)) c.estado = 'abiertos';
    else if (/\b(cerr(ad|aron|o\b|amos)|resuelt|terminad|solucionad)/.test(q)) c.estado = 'cerrados';
    if (/\bhoy\b/.test(q)) c.periodo = 'hoy';
    else if (/\bayer\b/.test(q)) c.periodo = 'ayer';
    else if (/\bsemana\b/.test(q)) c.periodo = 'semana';
    else if (/\bmes (pasado|anterior)/.test(q)) c.periodo = 'mes_pasado';
    else if (/\bmes\b/.test(q)) c.periodo = 'mes';
    else if (/\b(ano|anio)\b/.test(q)) c.periodo = 'anio';
    // Sector por nombre (el más largo que aparezca en la pregunta)
    const s = buscarSector(q);
    if (s) { c.sector = s.sector; if (!c.area && s.area) c.area = s.area; }

    // Intención
    const hayEnt = c.area || c.tipo || c.disc || c.estado || c.sector || (c.periodo && /\b(hallazgo|levantamiento|trabajo|falla|punto|cargad|cargaron|detectad)/.test(q));
    const pideDim = /\b(que|cual|cuales|en que|donde)\b.{0,12}\b(area|areas|tipo|tipos|sector|sectores|disciplina|disciplinas|lugar|zona)/.test(q);
    if (/\b(ayuda|que (podes|puedes|sabes) hacer|como funciona|que haces)\b/.test(q)) c.intent = 'ayuda';
    else if (/\b(repit|repet|reinciden|recurren|reaparec|vuelve a aparecer|vuelven a aparecer|se vuelve a)/.test(q) && !/\b(tipo|tipos|area|areas|sector|sectores)\b.{0,15}\b(mas|mayor)/.test(q)) c.intent = 'repetidas';
    else if (/\b(muy atrasad|atrasad|retrasad|vencid)/.test(q)) c.intent = 'atrasados';
    else if (/\b(antigu|viej|demor|mas dias|hace mas|lleva mas)/.test(q)) c.intent = 'antiguos';
    else if (/\b(mas|mayor|top|ranking|principal|principales|frecuent|repite|repiten|concentra|comun|comunes)\b/.test(q) || pideDim) c.intent = 'ranking';
    else if (/\b(por estado|estados|como estan|avance|reparte|reparten|distribu)/.test(q)) c.intent = 'por_estado';
    else if (/\b(resumen|como vamos|como venimos|panorama|situacion|estado general)\b/.test(q)) c.intent = 'resumen';
    // 09-11-26: «cuántos» sólo con una palabra de cantidad, o con una
    // pregunta corta hecha sólo de filtros («puertas abiertas»). Antes
    // cualquier frase con «puerta» o «piso» se respondía con un conteo.
    else if (/\b(cuant|cantidad|total|numero de|lista|listame|listado|cuales|mostrame|mostra|ver los|ver las|hay (hallazgos|levantamientos|trabajos|nc|no conformidades|puertas|pisos|techos))/.test(q)
      || (hayEnt && q.trim().split(' ').length <= 5 && !SINTOMA.test(q) && !ARREGLO.test(q))
      || (c.sector && /\b(falla|fallas|problema|problemas|hallazgo|hallazgos|novedad|novedades|nc|no conformidad|no conformidades|pendiente|pendientes|que hay|que tiene|que paso|como esta|como estan)\b/.test(q) && !ARREGLO_FUERTE.test(q))) c.intent = 'cuantos';
    if (!c.intent) return null;
    if (c.intent === 'ranking') {
      if (/\b(tecnic|operari|quien (tiene|hizo|resolvio|cerro))/.test(q)) c.dim = 'tecnico';
      else if (/\b(tipo|tipos|categor|clase|hallazgos? mas comun|que se repite)/.test(q)) c.dim = 'tipo';
      else if (/\b(sector|sectores|lugar|lugares|ubicacion|donde|zona|punto)/.test(q)) c.dim = 'sector';
      else if (/\b(disciplina|especialidad)/.test(q)) c.dim = 'disciplina';
      else if (/\b(area|areas)\b/.test(q) && !c.area) c.dim = 'area';
      else c.dim = c.area ? 'tipo' : 'area';
    }
    if (c.intent === 'cuantos' && /\b(por tipo|cada tipo)/.test(q)) { c.intent = 'ranking'; c.dim = 'tipo'; }
    if (c.intent === 'cuantos' && /\b(por area|cada area)/.test(q)) { c.intent = 'ranking'; c.dim = 'area'; }
    return c;
  }

  /* ---------------- Calcular ---------------- */
  function enPeriodo(l, p) {
    const f = l.fechaDet || '', h = today();
    if (!p) return true;
    if (p === 'hoy') return f === h;
    if (p === 'ayer') return f === sumarDias(h, -1);
    if (p === 'semana') return f >= sumarDias(h, -6) && f <= h;
    if (p === 'mes') return f.slice(0, 7) === h.slice(0, 7);
    if (p === 'mes_pasado') { const d = new Date(h + 'T12:00'); d.setDate(1); d.setMonth(d.getMonth() - 1); return f.slice(0, 7) === isoLocal(d).slice(0, 7); }
    if (p === 'anio') return f.slice(0, 4) === h.slice(0, 4);
    return true;
  }
  function pasaEstado(l, e) {
    if (!e) return true;
    if (e === 'abiertos') return abierto(l);
    if (e === 'cerrados') return l.estado === 'cerrado';
    if (e === 'a_validar') return aValidarCal(l);
    return l.estado === e;
  }
  /* Sector nombrado en la pregunta (10-11-26). Antes había que escribirlo
     igual que en la estructura («Cámara N°3»); ahora se comparan sin
     tildes, signos ni «n°/nro», y con palabras completas: «camara 3»
     encuentra «Cámara N° 3» pero no «Cámara 30». Gana el más largo. */
  const normSec = t => ' ' + sinAcentos(String(t || '')).toLowerCase().replace(/\b(n|nro|num|numero)\s*[°º.]?\s*(?=\d)/g, ' ').replace(/[°º#.,;:()\-_/]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  function buscarSector(q) {
    const nq = normSec(q);
    const vistos = new Map();
    L().forEach(l => { if (typeof l.sector === 'string' && l.sector && !vistos.has(l.sector)) vistos.set(l.sector, l.area); });
    let mejor = null;
    vistos.forEach((area, sector) => {
      const ns = normSec(sector);
      if (ns.trim().length > 3 && nq.includes(ns) && (!mejor || ns.length > mejor.n)) mejor = { sector, area, n: ns.length };
    });
    return mejor;
  }
  window.simiBuscarSector = buscarSector;
  function filtrar(c) {
    return L().filter(l => pasaEstado(l, c.estado) && (!c.area || l.area === c.area) && (!c.tipo || catKey(l.cat) === c.tipo)
      && (!c.disc || discKey(l) === c.disc) && (!c.sector || l.sector === c.sector) && enPeriodo(l, c.periodo));
  }
  function contexto(c) {
    const t = [];
    if (c.estado) t.push(EST_TXT[c.estado]);
    if (c.tipo) t.push(CATEGORIAS[c.tipo].label);
    if (c.disc) t.push(DISCIPLINAS[c.disc].label);
    if (c.area) t.push(AREAS[c.area].label);
    if (c.sector) t.push(c.sector);
    if (c.periodo) t.push(PER_TXT[c.periodo]);
    return t;
  }
  function frase(c) {
    const p = [];
    if (c.estado) p.push(EST_TXT[c.estado]);
    if (c.tipo) p.push('de tipo ' + CATEGORIAS[c.tipo].label);
    if (c.disc) p.push('de disciplina ' + DISCIPLINAS[c.disc].label);
    if (c.area) p.push('en ' + AREAS[c.area].label);
    if (c.sector) p.push('en ' + c.sector);
    if (c.periodo) p.push(PER_TXT[c.periodo]);
    return p.length ? ' ' + p.join(' ') : '';
  }
  function agrupar(lista, dim) {
    const m = new Map();
    lista.forEach(l => {
      let k, lbl, color;
      if (dim === 'area') { k = l.area; lbl = AREAS[k].label; color = AREAS[k].c; }
      else if (dim === 'tipo') { k = catKey(l.cat); lbl = CATEGORIAS[k].label; }
      else if (dim === 'disciplina') { k = discKey(l); lbl = DISCIPLINAS[k].label; color = DISCIPLINAS[k].c; }
      else if (dim === 'sector') { k = l.sector || '—'; lbl = k + (l.area ? ' · ' + AREAS[l.area].label : ''); }
      else if (dim === 'tecnico') {
        // Un trabajo puede tener varios técnicos: suma a cada uno.
        const ts = (l.prog && Array.isArray(l.prog.tecnicos) ? l.prog.tecnicos : []).map(t => t && t.n).filter(Boolean);
        ts.forEach(n => { const g = m.get(n) || { k: n, lbl: n, n: 0, ab: 0 }; g.n++; if (abierto(l)) g.ab++; m.set(n, g); });
        return;
      }
      else { k = l.estado; lbl = ESTADOS[k].label; color = ESTADOS[k].c; }
      const g = m.get(k) || { k, lbl, color, n: 0, ab: 0 };
      g.n++; if (abierto(l)) g.ab++;
      m.set(k, g);
    });
    return [...m.values()].sort((a, b) => b.n - a.n || b.ab - a.ab || a.lbl.localeCompare(b.lbl));
  }

  /* ---------------- Estado de la conversación ---------------- */
  const S = { abierto: false, planta: null, acciones: [], chips: [], log: [], hist: [] };
  const reg = fn => { S.acciones.push(fn); return S.acciones.length - 1; };
  window.simiAccion = i => { const f = S.acciones[i]; if (f) f(); };

  /* ---------------- Respuestas ---------------- */
  const barrasHtml = (grupos, total, alTocar, dim) => {
    const max = Math.max(1, ...grupos.map(g => g.n));
    return `<div class="simi-barras" role="list">${grupos.map(g => `
      <button type="button" class="simi-fila" role="listitem" onclick="simiAccion(${reg(() => alTocar(g))})" aria-label="${esc(g.lbl)}: ${g.n} hallazgos, ${g.ab} abiertos. Tocá para ver el detalle.">
        <span class="l">${esc(g.lbl)}</span><span class="v">${N(g.n)}<small>${dim === 'estado' ? pct(g.n, total) + ' %' : g.ab + ' abiertos'}</small></span>
        <span class="b" style="--bc:${g.color || 'var(--amber)'}"><i style="width:${g.n / max * 100}%"></i></span>
      </button>`).join('')}</div>`;
  };
  const ctxHtml = c => { const t = contexto(c); return t.length ? `<div class="simi-ctx">${t.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''; };
  const verListaBtn = (c, txt) => c.sector && !txt
    ? `<button type="button" class="btn btn-sm btn-primary" onclick="simiAccion(${reg(() => verLista(c))})">${svg(I.arrowR)} Llevame a ${esc(c.sector)}</button>`
    : `<button type="button" class="btn btn-sm btn-ghost" onclick="simiAccion(${reg(() => verLista(c))})">${svg(I.list)} ${txt || 'Ver en la lista'}</button>`;

  /* ---------------- Alertas: trabajos muy atrasados y NC repetitivas (07-11-26) --------
     Muy atrasado (cualquiera de estas):
       · fecha tentativa vencida hace más de 7 días;
       · programado para una fecha que pasó hace más de 3 días y sin iniciar;
       · más de 45 días abierto y sin fecha tentativa.
     Repetitiva: 3 o más no conformidades del MISMO tipo en el MISMO punto
     (área, sector y subsector) en los últimos 120 días, abiertas o cerradas:
     indica que la acción correctiva no está atacando la causa. */
  const ATRASO_TENT = 7, ATRASO_PROG = 3, ATRASO_SIN_TENT = 45, REP_DIAS = 120, REP_MIN = 3;
  function motivoAtraso(x) {
    const hoy = today();
    const t = typeof tentDe === 'function' ? tentDe(x) : null;
    if (t) { const d = diasEntre(t.fecha, hoy); if (d > ATRASO_TENT) return { dias: d, txt: `tentativa vencida hace ${d} días` }; }
    if (x.estado === 'programado' && x.prog && x.prog.fecha) { const d = diasEntre(x.prog.fecha, hoy); if (d > ATRASO_PROG) return { dias: d, txt: `programado para hace ${d} días y sin iniciar` }; }
    if (!t && diasDe(x) > ATRASO_SIN_TENT) return { dias: diasDe(x), txt: `${diasDe(x)} días abierto sin fecha tentativa` };
    return null;
  }
  function atrasadosDe(base) {
    let l = (base || L()).filter(abierto);
    if (role === 'mantenimiento') l = l.filter(x => ['programado', 'en_ejecucion'].includes(x.estado) && (!filtraPorTecnico() || esMiTrabajo(x)));
    return l.map(x => ({ l: x, m: motivoAtraso(x) })).filter(x => x.m).sort((a, b) => b.m.dias - a.m.dias);
  }
  function repetidasDe(base) {
    const desde = sumarDias(today(), -REP_DIAS), g = new Map();
    (base || L()).forEach(x => {
      if (!x.fechaDet || x.fechaDet < desde || !x.sector) return;
      const k = [x.area, x.sector, x.subsector || '', catKey(x.cat)].join('|');
      if (!g.has(k)) g.set(k, []); g.get(k).push(x);
    });
    return [...g.values()].filter(v => v.length >= REP_MIN)
      .map(v => ({ l: v.sort((a, b) => (b.fechaDet || '').localeCompare(a.fechaDet || '')), n: v.length, ab: v.filter(abierto).length }))
      .sort((a, b) => b.n - a.n || b.ab - a.ab);
  }
  // Cuántas veces apareció este mismo tipo en este mismo punto (para avisar al cargar).
  window.simiVecesEnPunto = (area, sector, subsector, cat) => {
    const desde = sumarDias(today(), -REP_DIAS);
    return L().filter(x => x.area === area && x.sector === sector && (x.subsector || '') === (subsector || '') && catKey(x.cat) === cat && (x.fechaDet || '') >= desde).length;
  };
  function respAtrasados(c, marca) {
    const base = filtrar({ ...c, intent: 'cuantos', estado: '' });
    const a = atrasadosDe(base);
    if (!a.length) return { html: ctxHtml(c) + `No hay trabajos muy atrasados${frase({ ...c, estado: '' })}. ¡Bien ahí! ${marca}`, chips: chipsBase(), feliz: true };
    const items = a.slice(0, 6).map(({ l, m }) => `<button type="button" class="simi-it" onclick="simiAccion(${reg(() => openDetalle(l.id))})">
        <span class="id">${esc(l.id)}</span><span class="t">${esc(catOf(l.cat).label)}<small>${esc(loc(l))} · ${esc(m.txt)}</small></span>
        <span class="d" style="color:var(--red-tx)">${m.dias} d</span></button>`).join('');
    const quien = role === 'mantenimiento' ? 'Tenés' : 'Hay';
    return {
      html: ctxHtml(c) + `${quien} <b class="simi-num" style="color:var(--red-tx)">${N(a.length)}</b> trabajo${a.length > 1 ? 's' : ''} muy atrasado${a.length > 1 ? 's' : ''}. ${a.length > 6 ? 'Estos son los 6 más demorados' : 'Tocá uno para abrirlo'}:<div class="simi-lista">${items}</div>
        <p class="simi-tip-g">${role === 'mantenimiento' ? 'Si algo te frena (repuestos, acceso, producción), avisale al Inspector para reprogramar con el motivo.' : 'Reprogramá con el motivo o reasigná el técnico: así queda el respaldo para la auditoría.'}</p>${marca}`,
      chips: [chip('No conformidades que se repiten', { intent: 'repetidas' }), chip('Los más antiguos sin cerrar', { intent: 'antiguos', estado: 'abiertos' })]
    };
  }
  function respRepetidas(c, marca) {
    let r = repetidasDe(filtrar({ ...c, intent: 'cuantos', estado: '' }));
    if (!r.length) return { html: ctxHtml(c) + `No encontré no conformidades que se repitan (${REP_MIN} o más del mismo tipo en el mismo punto en ${REP_DIAS} días)${frase({ ...c, estado: '' })}. ${marca}`, chips: chipsBase(), feliz: true };
    const items = r.slice(0, 5).map(g => { const l = g.l[0];
      return `<button type="button" class="simi-it" onclick="simiAccion(${reg(() => verLista({ area: l.area, tipo: catKey(l.cat), sector: l.sector }))})">
        <span class="id" style="color:var(--amber-tx)">${g.n}×</span><span class="t">${esc(catOf(l.cat).label)}<small>${esc(AREAS[l.area] ? AREAS[l.area].label : '')} · ${esc(loc(l))}${g.ab ? ` · ${g.ab} abierto${g.ab > 1 ? 's' : ''}` : ''}</small></span>
        <span class="d">ver</span></button>`; }).join('');
    const top = r[0].l[0];
    return {
      html: ctxHtml(c) + `<b class="simi-num" style="color:var(--amber-tx)">${N(r.length)}</b> punto${r.length > 1 ? 's' : ''} con no conformidades que se repiten (${REP_MIN} o más del mismo tipo en ${REP_DIAS} días):<div class="simi-lista">${items}</div>
        <p class="simi-tip-g">Si vuelve a aparecer, la reparación no atacó la causa. Pedí un análisis de causa raíz antes de repetir el mismo arreglo.</p>${marca}`,
      chips: [{ t: `¿Cómo evito que se repita: ${catOf(top.cat).label.toLowerCase()}?` }, chip('Trabajos muy atrasados', { intent: 'atrasados' })]
    };
  }

  /* ---------------- Reparación: «¿cómo reparo…?» (07-11-26) ---------------- */
  /* ---------------- Conversación y clasificación (09-11-26) ----------------
     Por qué fallaba SIMI (pruebas del 09-11-26):
       · «hola» y «buen día» se respondían con el resumen de números.
       · Cualquier frase que nombrara un tipo («el piso tiene agua»,
         «se rompió un toma», «¿qué causa que la silicona se despegue?»)
         se contestaba con un conteo de hallazgos de ese tipo.
       · A la IA se le mandaban los 4 artículos «más parecidos» aunque no
         tuvieran nada que ver, y respondía con ellos («el esterilizador no
         calienta» → cómo valida Calidad).
       · «¿Quién sos?» o «¿cómo estás?» iban a la IA y volvían con pasos de
         la guía.
     Ahora el orden es: charla → recorrido guiado → falla/avería → números
     → guía clara → IA (con sólo lo relevante) → guía local. */
  const SINTOMA = /\b(romp|roto|rota|rotos|rotas|rompio|cae\b|caen\b|cayo|se cae|desprend|despeg|descuelg|suelt[oa]|floj[oa]|gote|filtr|pierde|perdida de (agua|frio|aire)|fuga|agua estancada|charco|se junta agua|humedad|hongo|moho|oxid|corro|fisur|griet|rajad|quebr|tapad|obstru|no (prende|enciende|anda|funciona|cierra|abre|calienta|enfria|drena|traba|sella)|no tiene (tapa|agua)|sin tapa|hace ruido|ruido|vibra|chispa|cortocircuito|quemad|recalient|congel|hielo|escarcha|condensa|averi|desgast|se rompe|se rompio|se despega|se suelta|se traba|gotea)/;
  const ARREGLO = /\b(como (se )?(repar|arregl|solucion|cambi|sell|tap|evit|preven|corrij|corrig|reduzc|reduc|elimin|mejor|diagnost|detect)|que (hago|hacer|hay que hacer|se hace|puedo hacer|me recomend|recomend|material|uso para)|para que no|por que (se|pasa|ocurre|aparece)|que (causa|provoca|origina)|causa de|causas de|solucion(ar)? |reparar|arreglar|mantenimiento preventivo|prevenir|evitar que)/;
  const ARREGLO_FUERTE = /\b(como (se )?(repar|arregl|solucion)|reparar|arreglar|que hago (con|si|para)|para que no (se )?(cai|caig|romp|despeg|desprend|gote|filtr|repit|vuelv))/;
  const EQUIPO = /\b(compresor|evaporador|condensador|motor|bomba|caldera|ventilador|cinta|transportador|riel|noria|sierra|equipo|maquina|cano|caneria|valvula|tablero|camara|tunel|cortina|aislacion|panel|desague|rejilla|canaleta)/;
  const CUENTA = /\b(cuant|cantidad|total de|numero de|lista de|listame|listado|ranking|porcentaje|resumen|cuales son (los|las) (hallazgos|que)|hay hallazgos|que area|que sector|que tipo|mas hallazgos|mostrame (los|las) hallazgos)/;
  const nom1 = () => { const n = nombrePila(); return n ? ', ' + esc(n) : ''; };
  const alAzar = l => l[Math.floor(Math.random() * l.length)];
  // Módulo activo (11-11-26): ruta | nfc | iot. SIMI cambia saludo, sugerencias y contexto.
  const modAct = () => (typeof modulo === 'string' ? modulo : 'ruta');
  const MOD_TXT = { ruta: 'Ruta de inspección', nfc: 'Seguimiento de equipos (NFC)', iot: 'Monitoreo en tiempo real (IoT)' };
  // Sugerencias rotativas: un banco por rol; no repite lo que el usuario ya
  // preguntó ni lo que se mostró en la respuesta anterior (antes eran siempre
  // las mismas tres y cansaban).
  const BANCO = {
    mantenimiento: ['¿Cómo cierro un trabajo?', 'Mis trabajos por hacer', '¿Cómo reparo una gotera en el techo?', '¿Qué hago si el piso se fisura?', '¿Cómo cambio una luminaria en zona húmeda?', '¿Cuáles vencen esta semana?', '¿Cómo saco la foto del después?', '¿Qué hago con una puerta de cámara que no cierra?'],
    calidad: ['¿Cómo valido un cierre?', '¿Cuántos cierres hay para validar?', '¿Qué hago si la silicona se despega seguido?', '¿Cuándo conviene rechazar un cierre?', '¿Qué áreas repiten no conformidades?', '¿Cómo saco el PDF?', '¿Cómo evito que vuelva el moho?'],
    vista: ['¿Qué área tiene más hallazgos?', '¿Qué significa cada estado?', '¿Cómo exporto el Excel?', '¿Cuántos se cerraron este mes?', '¿Qué tipo de falla se repite más?'],
    inspector: ['¿Cómo hago un recorrido?', '¿Qué área tiene más hallazgos abiertos?', 'La puerta de la cámara se cae seguido, ¿qué hago?', '¿Cómo programo un trabajo?', '¿Cómo verifico un trabajo terminado?', '¿Qué hago con una oxidación en la puerta?', '¿Cuáles son los más antiguos sin cerrar?', '¿Cómo fijo una fecha tentativa?']
  };
  const BANCO_MOD = {
    nfc: ['¿Cómo va a funcionar el módulo NFC?', '¿Mi celular sirve para leer NFC?', '¿Qué tags conviene comprar?', '¿Funciona en iPhone?', '¿Qué equipos conviene marcar primero?', '¿Qué hace falta para el piloto?'],
    nfcDemo: ['¿Qué mantenimientos vencen esta semana?', '¿Cómo está la vaciadora?', '¿Qué alertas hay en los equipos?', 'Historial de la flejadora', '¿Cuándo es la calibración de rayos X?', '¿Cómo está el detector de metales?', 'Plan de mantenimiento del termocontraible', '¿Cómo funciona la lectura NFC?'],
    iot: ['Resumen del turno', '¿Hay alarmas activas?', '¿Qué ves en los datos?', '¿Cómo están las cámaras?', '¿Cuánta energía consumimos ayer?', '¿Cómo está el vapor?', '¿Qué equipo tuvo más alarmas?', '¿Cómo está el túnel 2?']
  };
  const bancoMod = () => modAct() === 'nfc' && window.SIMA_NFC && SIMA_NFC.activo() ? BANCO_MOD.nfcDemo : BANCO_MOD[modAct()];
  function menuTres() {
    const banco = bancoMod() || BANCO[role] || BANCO.inspector;
    const clave = t => sinAcentos(String(t)).toLowerCase();
    const ya = new Set(S.hist.filter(m => m.rol === 'usuario').map(m => clave(m.texto)));
    const previas = new Set(S.sugeridas || []);
    let libres = banco.filter(t => !ya.has(clave(t)) && !previas.has(t));
    if (libres.length < 3) libres = banco.filter(t => !ya.has(clave(t)));
    if (libres.length < 3) libres = banco.slice();
    const elegidas = libres.map(t => [Math.random(), t]).sort((x, y) => x[0] - y[0]).slice(0, 3).map(x => x[1]);
    S.sugeridas = elegidas;
    return elegidas.map(t => ({ t }));
  }
  // Lo que sabe hacer SIMI se muestra UNA vez por conversación, o cuando lo
  // piden explícitamente («ayuda», «¿qué podés hacer?»). Después, nada.
  const MENU_LISTA = '<ul class="simi-ul" style="margin-top:6px"><li><span><b>Cómo usar SIMA</b>: recorridos, programar, cerrar, validar…</span></li><li><span><b>Tus números</b>: cuántos hallazgos hay, dónde, de qué tipo.</span></li><li><span><b>Resolver fallas</b>: goteras, puertas, pisos, siliconas, luminarias…</span></li></ul>';
  function menu(forzado) {
    if (forzado || !S.menuN) { S.menuN = (S.menuN || 0) + 1; return MENU_LISTA; }
    return '';
  }
  // Tras un tema ajeno a la planta: una sola frase para volver, que va
  // cambiando, en lugar de repetir la lista completa.
  const VOLVER = ['Volviendo a la planta: ¿en qué te ayudo?', 'Bueno, de vuelta al trabajo: ¿qué necesitás?', 'Eso sí, de hallazgos y reparaciones sé un montón. ¿Qué vemos?', '¿Seguimos con lo de la planta?', 'Cuando quieras volvemos a lo nuestro: recorridos, números o reparaciones.'];
  function volver() {
    let v; do { v = alAzar(VOLVER); } while (v === S.ultVolver);
    S.ultVolver = v;
    return `<p class="simi-volver">${v}</p>`;
  }
  // Devuelve null si no es charla; {html, chips} si lo es; con «resto» si
  // después del saludo viene una pregunta.
  function charla(q) {
    const t = q.trim();
    const h = new Date().getHours(), momento = h < 12 ? '¡Buen día' : (h < 20 ? '¡Buenas tardes' : '¡Buenas noches');
    const SAL = /^(hola+|holaa+|holis|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|ey|que tal|como va|saludos|alo|ola)\b( (simi|che|amigo|crack|como (estas|andas|va|te va)))*/;
    const m = t.match(SAL);
    if (m) {
      const resto = t.slice(m[0].length).replace(/^(simi|che)\b/, '').trim();
      const palabras = resto.split(' ').filter(w => w.length > 2);
      const comoEstas = /\b(como (estas|andas|te va|va)|que tal)\b/.test(t);
      if (palabras.length >= 2 && !/^(como (estas|andas|te va)|todo bien|que tal)$/.test(resto)) {
        return { resto, html: `${momento}${nom1()}!`, txt: 'Saludo' };
      }
      const al = S.alertas && (S.alertas.a.length || S.alertas.r.length);
      S.saludosN = (S.saludosN || 0) + 1;
      const yaHablamos = S.saludosN > 1 || S.hist.filter(x => x.rol === 'usuario').length > 1;
      const preg = yaHablamos ? alAzar(['¿En qué seguimos?', '¿Qué vemos ahora?', 'Acá sigo, ¿qué necesitás?']) : '¿En qué te doy una mano?';
      return { html: `${momento}${yaHablamos ? ' de nuevo' : ''}${nom1()}! ${comoEstas ? 'Acá ando, con las pilas cargadas y la antena prendida. ' : ''}${preg}${yaHablamos ? '' : menu()}${al ? `<p class="simi-tip-g">Ojo: tengo ${S.alertas.a.length ? `<b>${S.alertas.a.length} trabajo${S.alertas.a.length > 1 ? 's' : ''} muy atrasado${S.alertas.a.length > 1 ? 's' : ''}</b>` : ''}${S.alertas.a.length && S.alertas.r.length ? ' y ' : ''}${S.alertas.r.length ? `<b>${S.alertas.r.length} NC que se repiten</b>` : ''} para mostrarte.</p>` : ''}`,
        chips: al ? [chip('Trabajos muy atrasados', { intent: 'atrasados' }), ...menuTres().slice(0, 2)] : menuTres(), feliz: true, txt: 'Saludo' };
    }
    if (/^(como (estas|andas|te va|va todo|anda todo)|todo bien|que tal (estas|andas|todo)|como andamos)( simi)?$/.test(t))
      return { html: alAzar(['¡Muy bien! Con las pilas cargadas y la antena prendida. ¿Y vos? Contame en qué te ayudo.', 'Todo en orden por acá, revisando que no se escape ninguna no conformidad. ¿En qué te doy una mano?']), chips: menuTres(), feliz: true, txt: 'Estoy bien' };
    if (/\b(quien (sos|eres)|que (sos|eres)|como te llamas|tu nombre|tu funcion|para que (servis|sirves)|sos (un robot|una ia|un bot|humano|real)|que (podes|puedes|sabes) hacer|en que (me )?(podes|puedes) ayudar|que haces)\b/.test(t))
      return { html: `Soy <b>SIMI</b>, el asistente de SIMA. Te ayudo con tres cosas:${menu(true)}<p class="simi-tip-g">Los números los calculo con los datos que podés ver; para entender preguntas abiertas uso inteligencia artificial (Llama). No cambio datos: te digo los pasos y te llevo a la pantalla.</p>`, chips: menuTres(), feliz: true, txt: 'Soy SIMI, el asistente de SIMA' };
    if (/^(muchas )?(gracias|grax|gracia|mil gracias|te agradezco|genio|crack|groso|capo|sos (un )?(genio|crack|groso|capo))\b/.test(t) && t.split(' ').length <= 5)
      return { html: alAzar([`¡De nada${nom1()}! Para eso estoy.`, '¡Un gusto! Si surge otra cosa, acá estoy.', '¡Cuando quieras! Seguimos.']), chips: menuTres(), feliz: true, txt: 'De nada' };
    if (/^(chau|chao|adios|hasta (luego|manana|pronto)|nos vemos|me voy|bye)\b/.test(t))
      return { html: alAzar(['¡Chau! Buen trabajo hoy.', '¡Hasta luego! Acá quedo por si me necesitás.']), chips: [], feliz: true, txt: 'Chau' };
    if (/^(ok|okey|oka|dale|listo|perfecto|genial|buenisimo|excelente|joya|de una|entendido|entiendo|ya esta|bien|muy bien|re bien|barbaro)( (gracias|simi))?$/.test(t))
      return { html: alAzar(['¡Genial! ¿Algo más?', '¡Bárbaro! Si necesitás otra cosa, preguntame.']), chips: menuTres(), feliz: true, txt: 'Ok' };
    if (/^(ja|je|ji|jaja|jajaja+|jeje+|lol|xd)+$/.test(t.replace(/\s/g, '')))
      return { html: '¡Me alegra sacarte una sonrisa! ¿Seguimos?', chips: menuTres(), feliz: true, txt: 'Jaja' };
    if (/^(ayuda|ayudame|necesito ayuda|help|socorro|una consulta|tengo una (duda|consulta|pregunta)|te hago una (pregunta|consulta))$/.test(t))
      return { html: `¡Claro! Contame. Puedo ayudarte con:${menu(true)}`, chips: menuTres(), txt: 'Menú de ayuda' };
    if (/\b(no (sirve|sirves|entendes|entiendes|entendiste|me (sirve|ayuda|ayudaste))|sos (malo|tonto|inutil|lento)|respuesta (mala|incorrecta|equivocada)|esta mal|eso no (es|era)|no es eso|cualquier cosa|no tiene sentido)\b/.test(t))
      return { html: 'Perdón, me equivoqué. Probá contármelo con otras palabras —por ejemplo el lugar y qué pasa («la puerta de la cámara 2 se descuelga»)— o elegí qué necesitás:', chips: menuTres(), txt: 'Perdón' };
    return null;
  }

  // Temas técnicos o de gestión de planta (no son de uso de SIMA).
  const TECNICA = /\b(kpi|kpis|indicador(es)?|vapor|caldera|condensado|trampas? de vapor|consumo (de )?(agua|energia|vapor|gas)|eficiencia (energetica)?|ahorro (de )?(agua|energia)|energia electrica|aire comprimido|amoniaco|efluente|mtbf|mttr|oee|disponibilidad|confiabilidad|backlog|plan (de )?(mantenimiento|mejora)|mantenimiento (preventivo|predictivo|autonomo)|tpm|rcm|costos? de mantenimiento)\b/;
  const LECTURA = /\b((cuanto|que|cual|como) (es |esta |marca |da |hay de |tiene |anda )?(la |el )?(temperatura|consumo|energia|kwh|kw|agua|presion|humedad)( actual| ahora| de hoy)?|temperatura (actual|ahora)|(como|que tal) (esta|estan|anda|andan) (la |las )?camaras?( de frio)?( \d+)?$|lecturas?|en tiempo real|datos en vivo|grafana (dice|marca|muestra))\b/;
  const ES_REPARA = /\b(como (se )?(repar|arregl|solucion|soluciona|cambi|sell|tap|evit|preven|corrij|corrig)|que (hago|hacer|hay que hacer|se hace)|para que no|se (desprende|descuelga|cae|rompe|vuelve a romper|filtra|despega)|gotera|goteras|gotea|no (cierra|calienta|prende|enciende)|repar(o|ar|acion)|arregl(o|ar))/;
  const FICHAS = () => window.SIMA_REPARAR || [];
  function buscarFicha(texto) {
    const q = ' ' + sinAcentos(texto).toLowerCase().replace(/[¿?¡!.,;:]/g, ' ') + ' ';
    const r = FICHAS().map(f => ({ f, s: f.claves.reduce((a, k) => a + (q.includes(' ' + k + ' ') || (k.includes(' ') && q.includes(k)) ? (k.length > 6 ? 3 : 2) : 0), 0) * (f.sintoma ? 2 : 1) }))
      .filter(x => x.s > 0).sort((a, b) => b.s - a.s);
    // El síntoma manda sobre el objeto (11-11-26): «oxidación de la puerta»
    // es una ficha de óxido; la de «puerta que se descuelga» no aplica.
    return r.some(x => x.f.sintoma) ? r.filter(x => x.f.sintoma) : r;
  }
  const textoFicha = f => `${f.t}\nCausas probables: ${f.causas.join(' ')}\nPasos:\n${f.pasos.map((p, i) => `${i + 1}. ${p}`).join('\n')}\nSeguridad e inocuidad: ${f.cuidados.join(' ')}\nPara que no se repita: ${f.prevenir.join(' ')}`;
  const li = l => (l || []).map(x => `<li><span>${fmtTxt(x)}</span></li>`).join('');
  function tarjetaRep({ titulo, texto, causas, pasos, cuidados, prevenir, ia }) {
    return `<div class="simi-rep">
      <div class="simi-g-tag">${ia ? '✦ ' : ''}Guía de reparación</div>
      ${titulo ? `<b class="simi-rep-t">${esc(titulo)}</b>` : ''}
      ${texto ? `<p style="margin:4px 0 0">${fmtTxt(texto)}</p>` : ''}
      ${causas && causas.length ? `<h5>Causas probables</h5><ul class="simi-ul">${li(causas)}</ul>` : ''}
      ${pasos && pasos.length ? `<h5>Pasos</h5><ol class="simi-pasos">${li(pasos)}</ol>` : ''}
      ${cuidados && cuidados.length ? `<h5 class="simi-cuid-t">Seguridad e inocuidad</h5><ul class="simi-ul simi-cuid">${li(cuidados)}</ul>` : ''}
      ${prevenir && prevenir.length ? `<h5>Para que no se repita</h5><ul class="simi-ul">${li(prevenir)}</ul>` : ''}
      <p class="simi-tip-g">Orientación general: seguí el procedimiento de la planta, los permisos de trabajo y la ficha técnica de cada material.</p>
      ${ia ? '<div class="simi-ia">✦ respondido con IA a partir de las fichas de SIMA</div>' : ''}
    </div>`;
  }
  // Consulta técnica o de gestión (KPI, agua, vapor, energía, preventivo…).
  function tarjetaTec({ titulo, texto, causas, pasos, cuidados }) {
    return `<div class="simi-rep">
      <div class="simi-g-tag">✦ Consulta técnica</div>
      ${titulo ? `<b class="simi-rep-t">${esc(titulo)}</b>` : ''}
      ${texto ? `<p style="margin:4px 0 0">${fmtTxt(texto)}</p>` : ''}
      ${causas && causas.length ? `<h5>Qué medir</h5><ul class="simi-ul">${li(causas)}</ul>` : ''}
      ${pasos && pasos.length ? `<h5>Cómo mejorarlo</h5><ol class="simi-pasos">${li(pasos)}</ol>` : ''}
      ${cuidados && cuidados.length ? `<h5>Seguimiento</h5><ul class="simi-ul">${li(cuidados)}</ul>` : ''}
      <p class="simi-tip-g">Orientación general de buenas prácticas: los valores de referencia dependen de cada planta; medí primero tu línea base.</p>
      <div class="simi-ia">✦ respondido con IA</div>
    </div>`;
  }
  function chipsRep(cat) {
    const c = [];
    if (cat && CATEGORIAS[cat]) c.push(chip(`¿Se repite ${CATEGORIAS[cat].label.toLowerCase()} en algún punto?`, { intent: 'repetidas', tipo: cat }));
    c.push(chip('Trabajos muy atrasados', { intent: 'atrasados' }));
    c.push({ t: '¿Cómo reparo una gotera en el techo?' });
    return c.filter((x, i, a) => a.findIndex(y => y.t === x.t) === i).slice(0, 3);
  }
  function respuestaRepLocal(f, sinRed) {
    S.hist.push({ rol: 'simi', texto: f.t + ': ' + f.pasos.join(' ') });
    return { html: (sinRed ? '<p class="simi-aviso">Sin señal: te muestro la ficha guardada en SIMA.</p>' : '') + tarjetaRep({ titulo: f.t, causas: f.causas, pasos: f.pasos, cuidados: f.cuidados, prevenir: f.prevenir }), chips: chipsRep(f.cat) };
  }

  function responder(c, viaIA) {
    const marca = viaIA ? `<div class="simi-ia">✦ pregunta interpretada con IA · cifras calculadas por SIMA</div>` : '';
    const todos = L();
    if (!todos.length && c.intent !== 'ayuda') {
      return { html: `Todavía no hay hallazgos cargados en <b>${esc(plantaLbl())}</b>. Cuando el Inspector cargue la primera ruta, te cuento cómo vienen.`, chips: [] };
    }
    if (c.intent === 'ayuda') return {
      html: `Te puedo contar <b>cuántos</b> hallazgos hay, <b>qué áreas, tipos o sectores</b> tienen más, cómo se reparten <b>por estado</b> y cuáles son <b>los más antiguos</b> sin cerrar. Podés filtrar por área, tipo, disciplina, estado y período (hoy, semana, mes…). Escribime o tocá el micrófono.`,
      chips: chipsBase()
    };
    if (c.intent === 'resumen') return resumen(c, marca);
    if (c.intent === 'atrasados') return respAtrasados(c, marca);
    if (c.intent === 'repetidas') return respRepetidas(c, marca);
    const lista = filtrar(c);
    if (c.intent === 'antiguos') {
      const ab = lista.filter(abierto).sort((a, b) => (a.fechaDet || '').localeCompare(b.fechaDet || '')).slice(0, 5);
      if (!ab.length) return { html: ctxHtml(c) + `No hay hallazgos abiertos${frase({ ...c, estado: '' })}. ¡Todo al día! ${marca}`, chips: chipsBase(), feliz: true };
      const items = ab.map(l => `<button type="button" class="simi-it" onclick="simiAccion(${reg(() => openDetalle(l.id))})">
          <span class="id">${esc(l.id)}</span><span class="t">${esc(catOf(l.cat).label)}<small>${esc(AREAS[l.area].label)} · ${esc(loc(l))}</small></span>
          <span class="d">${diasDe(l)} días</span></button>`).join('');
      return {
        html: ctxHtml(c) + `El hallazgo abierto más antiguo${frase({ ...c, estado: '' })} lleva <b class="simi-num">${diasDe(ab[0])} días</b> (${esc(ab[0].id)}). Estos son los ${ab.length} más viejos; tocá uno para abrirlo:<div class="simi-lista">${items}</div>${marca}`,
        chips: [chip('¿Qué área tiene más abiertos?', { intent: 'ranking', dim: 'area', estado: 'abiertos' }), chip('Abiertos por tipo', { intent: 'ranking', dim: 'tipo', estado: 'abiertos' })]
      };
    }
    if (c.intent === 'por_estado') {
      const g = agrupar(lista, 'estado').sort((a, b) => EST_ORDER.indexOf(a.k) - EST_ORDER.indexOf(b.k));
      const cerr = lista.filter(l => !abierto(l)).length;
      return {
        html: ctxHtml(c) + `De <b class="simi-num">${N(lista.length)}</b> hallazgos${frase(c)}, <b>${N(lista.length - cerr)}</b> siguen abiertos y <b>${N(cerr)}</b> están cerrados (${pct(cerr, lista.length)} % de cierre).${barrasHtml(g, lista.length, x => preguntar(null, { ...c, intent: 'cuantos', estado: x.k === 'cerrado' ? 'cerrados' : x.k }), 'estado')}<div class="simi-acc">${verListaBtn(c)}</div>${marca}`,
        chips: [chip('Los más antiguos sin cerrar', { ...c, intent: 'antiguos' }), chip('¿Qué área tiene más?', { ...c, intent: 'ranking', dim: 'area' })]
      };
    }
    if (c.intent === 'ranking') {
      const dim = c.dim && c.dim !== 'ninguna' ? c.dim : 'area';
      const g = agrupar(lista, dim);
      if (!g.length) return { html: ctxHtml(c) + (dim === 'tecnico' ? `Todavía no hay trabajos con técnico asignado${frase(c)}. ${marca}` : `No encontré hallazgos${frase(c)}. ${marca}`), chips: chipsBase() };
      const top = g[0], emp = g.filter(x => x.n === top.n).slice(1);
      const quien = { area: 'El área', tipo: 'El tipo de hallazgo', sector: 'El sector', disciplina: 'La disciplina', estado: 'El estado', tecnico: 'El técnico' }[dim];
      const filtroDe = x => ({ area: { area: x.k }, tipo: { tipo: x.k }, disciplina: { disc: x.k }, sector: { sector: x.k }, estado: { estado: x.k === 'cerrado' ? 'cerrados' : x.k }, tecnico: {} }[dim]);
      const siguiente = dim === 'area' ? 'tipo' : dim === 'tipo' ? 'area' : 'tipo';
      return {
        html: ctxHtml(c) + `${quien} con más hallazgos${frase(c)} es <b class="simi-num">${esc(top.lbl)}</b>: ${N(top.n)} de ${N(lista.length)} (${pct(top.n, lista.length)} %), ${N(top.ab)} todavía abiertos.${emp.length ? ` Empata con ${emp.map(x => '<b>' + esc(x.lbl) + '</b>').join(', ')}.` : ''}
          ${barrasHtml(g.slice(0, 6), lista.length, x => preguntar(null, { ...c, ...filtroDe(x), intent: 'ranking', dim: siguiente }), dim)}
          <div class="simi-acc">${verListaBtn({ ...c, ...filtroDe(top) }, 'Ver ' + top.lbl.split(' · ')[0])}</div>${marca}`,
        chips: [chip(`¿Qué ${siguiente === 'tipo' ? 'tipos' : 'áreas'} hay en ${top.lbl.split(' · ')[0]}?`, { ...c, ...filtroDe(top), intent: 'ranking', dim: siguiente }),
          chip('Los más antiguos', { ...c, intent: 'antiguos' }), dim !== 'sector' ? chip('¿Y por sector?', { ...c, intent: 'ranking', dim: 'sector' }) : chip('¿Y por área?', { ...c, intent: 'ranking', dim: 'area' })]
      };
    }
    // cuantos
    const ab = lista.filter(abierto).length;
    const desglose = !c.estado ? agrupar(lista, 'estado').sort((a, b) => EST_ORDER.indexOf(a.k) - EST_ORDER.indexOf(b.k)) : agrupar(lista, c.area ? 'tipo' : 'area');
    const dimD = !c.estado ? 'estado' : (c.area ? 'tipo' : 'area');
    return {
      html: ctxHtml(c) + (lista.length
        ? `Hay <b class="simi-num">${N(lista.length)}</b> hallazgo${lista.length === 1 ? '' : 's'}${frase(c)}.${!c.estado ? ` ${N(ab)} abiertos y ${N(lista.length - ab)} cerrados.` : ''}${barrasHtml(desglose.slice(0, 6), lista.length, x => preguntar(null, dimD === 'estado' ? { ...c, estado: x.k === 'cerrado' ? 'cerrados' : x.k } : { ...c, [dimD]: x.k, intent: 'ranking', dim: dimD === 'area' ? 'tipo' : 'area' }), dimD)}<div class="simi-acc">${verListaBtn(c)}</div>`
        : `No hay hallazgos${frase(c)}.`) + marca,
      chips: lista.length ? [chip(c.area ? `Tipos en ${AREAS[c.area].label}` : '¿En qué área hay más?', { ...c, intent: 'ranking', dim: c.area ? 'tipo' : 'area' }), chip('Los más antiguos', { ...c, intent: 'antiguos' })] : chipsBase(),
      feliz: !lista.length && c.estado === 'abiertos'
    };
  }

  function resumen(c, marca = '') {
    const l = L(), ab = l.filter(abierto);
    const k = [];
    if (role === 'mantenimiento') {
      const mios = l.filter(x => ['programado', 'en_ejecucion'].includes(x.estado) && (!filtraPorTecnico() || esMiTrabajo(x)));
      k.push({ n: mios.filter(x => x.estado === 'programado').length, t: 'por hacer', c: 'var(--amber)', q: { intent: 'cuantos', estado: 'programado' } });
      k.push({ n: mios.filter(x => x.estado === 'en_ejecucion').length, t: 'en ejecución', c: 'var(--ice)', q: { intent: 'cuantos', estado: 'en_ejecucion' } });
    } else if (role === 'calidad') {
      k.push({ n: l.filter(aValidarCal).length, t: 'a validar', c: 'var(--green)', q: { intent: 'cuantos', estado: 'a_validar' } });
      k.push({ n: l.filter(x => x.estado === 'pendiente_verificacion').length, t: 'a verificar · Inspector', c: 'var(--violet)', q: { intent: 'cuantos', estado: 'pendiente_verificacion' } });
    } else {
      k.push({ n: l.filter(x => x.estado === 'detectado').length, t: 'por programar', c: 'var(--red)', q: { intent: 'cuantos', estado: 'detectado' } });
      k.push({ n: l.filter(x => x.estado === 'pendiente_verificacion').length, t: 'a verificar', c: 'var(--violet)', q: { intent: 'cuantos', estado: 'pendiente_verificacion' } });
    }
    k.unshift({ n: ab.length, t: 'abiertos', c: 'var(--amber)', q: { intent: 'cuantos', estado: 'abiertos' } });
    k.push({ n: ab.filter(x => diasDe(x) > 30).length, t: 'abiertos hace +30 días', c: 'var(--red)', q: { intent: 'antiguos', estado: 'abiertos' } });
    const cerr = l.length - ab.length;
    const kpis = `<div class="simi-kpis">${k.map(x => `<button type="button" class="simi-kpi" style="--kc:${x.c}" onclick="simiAccion(${reg(() => preguntar(null, x.q))})"><b>${N(x.n)}</b><span>${x.t}</span></button>`).join('')}</div>`;
    return {
      html: `En <b>${esc(plantaLbl())}</b> hay <b class="simi-num">${N(l.length)}</b> hallazgos: ${N(ab.length)} abiertos y ${N(cerr)} cerrados (${pct(cerr, l.length)} % de cierre).${kpis}${marca}`,
      chips: chipsBase()
    };
  }

  const chip = (t, q) => ({ t, q });
  const chipG = (t, id) => ({ t, ayuda: id });
  function chipsBase() {
    if (modAct() !== 'ruta') return chipsBase0();   // los avisos de hallazgos son de la Ruta
    const al = S.alertas || { a: [], r: [] }, extra = [];
    if (al.a.length) extra.push(chip(`Trabajos muy atrasados (${al.a.length})`, { intent: 'atrasados' }));
    if (al.r.length) extra.push(chip(`NC que se repiten (${al.r.length})`, { intent: 'repetidas' }));
    return [...extra, ...chipsBase0()].slice(0, 5);
  }
  function chipsBase0() {
    if (bancoMod()) return bancoMod().slice(0, 4).map(t => ({ t }));
    if (role === 'mantenimiento') return [chipG('¿Cómo cierro un trabajo?', 'cerrar-trabajo'), chip('Mis trabajos por hacer', { intent: 'cuantos', estado: 'programado' }),
      { t: '¿Cómo reparo una gotera en el techo?' }, chipG('¿Qué significa cada estado?', 'estados')];
    if (role === 'calidad') return [chipG('¿Cómo hago el control final?', 'calidad'), chip('¿Cuántos a validar?', { intent: 'cuantos', estado: 'a_validar' }),
      chip('Los más antiguos sin cerrar', { intent: 'antiguos', estado: 'abiertos' }), chipG('¿Cómo saco el PDF?', 'pdf')];
    if (role === 'vista') return [chip('¿Qué área tiene más hallazgos?', { intent: 'ranking', dim: 'area' }), chipG('¿Qué significa cada estado?', 'estados'),
      chip('Los más antiguos sin cerrar', { intent: 'antiguos', estado: 'abiertos' }), chipG('¿Cómo exporto el Excel?', 'excel')];
    return [chipG('¿Cómo hago un recorrido?', 'recorrido'), chipG('¿Cómo programo un trabajo?', 'programar'),
      chip('¿Qué área tiene más hallazgos?', { intent: 'ranking', dim: 'area' }), chip('Los más antiguos sin cerrar', { intent: 'antiguos', estado: 'abiertos' })];
  }

  /* Ver en la lista: filtros de la vista puestos y SIMI se aparta. */
  function verLista(c) {
    const nav = navFor().map(n => n.v);
    const scope = role === 'mantenimiento' ? 'mant' : (nav.includes('inspeccion') ? 'insp' : 'cal');
    const vista = { insp: 'inspeccion', mant: 'mantenimiento', cal: 'calidad' }[scope];
    const f = FILTRO_VACIO();
    if (c.area) f.area = c.area;
    if (c.tipo) f.cat = c.tipo;
    if (c.disc) f.disc = c.disc;
    if (c.sector) f.sector = c.sector;
    if (c.estado && c.estado !== 'abiertos') f.estado = c.estado === 'cerrados' ? 'cerrado' : c.estado === 'a_validar' ? 'cal_pend' : c.estado;
    const h = today();
    if (c.periodo === 'hoy') f.desde = f.hasta = h;
    else if (c.periodo === 'ayer') f.desde = f.hasta = sumarDias(h, -1);
    else if (c.periodo === 'semana') { f.desde = sumarDias(h, -6); f.hasta = h; }
    else if (c.periodo === 'mes') { f.desde = h.slice(0, 8) + '01'; f.hasta = h; }
    else if (c.periodo === 'anio') { f.desde = h.slice(0, 4) + '-01-01'; f.hasta = h; }
    filtros[scope] = f;
    if (scope === 'insp') { try { inspVista = 'hallazgos'; } catch (_) {} }
    if (window.innerWidth <= 1000) cerrar();
    go(vista);
    try { const m = document.getElementById('main'); if (m) m.scrollTop = 0; } catch (_) {}
    toast('info', c.sector ? 'Sector ' + c.sector : 'Filtros aplicados', c.estado === 'abiertos' ? 'Se muestran todos los estados: los abiertos son los que no dicen «Cerrado».' : 'Podés quitarlos desde la barra de filtros.');
  }

  /* =====================================================================
     AYUDA CONVERSACIONAL (07-11-26)
     ---------------------------------------------------------------------
     SIMI además responde CÓMO se hace cada cosa en SIMA, con la guía de
     public/sima-ayuda.js (window.SIMA_AYUDA):
       1. Búsqueda local en la guía (funciona sin señal, al instante).
       2. Si la pregunta es ambigua, de seguimiento («¿y si…?») o no está
          clara y hay señal, Llama redacta la respuesta en /api/ia/chat
          usando SÓLO los artículos encontrados y la conversación reciente.
       3. Si es de números, la calcula SIMA (motor de datos de arriba).
     ===================================================================== */
  const GUIA = Array.isArray(window.SIMA_AYUDA) ? window.SIMA_AYUDA : [];
  const STOP = new Set('como que cual cuales donde cuando para por con sin los las del una uno unos unas mis tus sus esta este esto eso esa ese hay hacer hago puedo puede pueden tengo tiene debo quiero necesito sima simi favor quisiera saber podes podrias decime dime explicame algo cosa cosas muy mas the and significa significan quiere decir pasa sirve hallazgo hallazgos sistema app aplicacion pantalla boton'.split(' '));
  const tokens = q => sinAcentos(q).toLowerCase().split(/[^a-z0-9ñ]+/).filter(w => w.length >= 3 && !STOP.has(w));
  const parecido = (a, b) => {
    const n = Math.min(a.length, b.length);
    const umbral = n >= 5 ? Math.min(5, n) - 1 : n;
    let i = 0; while (i < n && a[i] === b[i]) i++;
    return i >= Math.max(3, umbral);
  };
  const IDX = GUIA.map(a => ({
    a,
    claves: tokens(a.claves || ''),
    principal: tokens(a.claves || '')[0] || '',
    titulo: tokens(a.t),
    pasos: tokens((a.pasos || []).join(' ') + ' ' + (a.nota || ''))
  }));
  const conocida = w => IDX.some(x => x.claves.some(c => parecido(w, c)) || x.titulo.some(c => parecido(w, c)) || x.pasos.some(c => parecido(w, c)));
  function buscarAyuda(q) {
    const tq = [...new Set(tokens(q))].filter(conocida);   // sólo palabras que la guía conoce
    if (!tq.length) return [];
    return IDX.map(x => {
      let s = 0;
      tq.forEach(w => {
        let k = 0;
        if (x.principal && parecido(w, x.principal)) k = 5;
        else if (x.claves.some(c => parecido(w, c))) k = 3;
        if (x.titulo.some(c => parecido(w, c))) k += 2;
        if (x.pasos.some(c => parecido(w, c))) k += 1;
        s += k;
      });
      const m = tq.filter(w => x.claves.some(c => parecido(w, c)) || x.titulo.some(c => parecido(w, c)) || x.pasos.some(c => parecido(w, c))).length;
      if (s && x.a.roles && x.a.roles.includes(rolAyuda())) s += 1;
      return { a: x.a, s, m, n: tq.length };
    }).filter(r => r.s > 0).sort((p, q2) => q2.s - p.s);
  }
  const rolAyuda = () => (role === 'inspeccion' && typeof esDueno === 'function' && esDueno()) ? 'admin' : role;
  // Pregunta claramente de USO (no de números).
  const ES_AYUDA = /\b(como (hago|se|puedo|cargo|programo|asigno|cierro|termino|inicio|empiezo|comienzo|verifico|valido|acepto|rechazo|exporto|saco|descargo|agrego|creo|doy|marco|cambio|corrijo|edito|dicto|busco|filtro|funciona|planifico|hacer|hago para|registro|subo|imprimo)|que (significa|es|son|quiere decir|pasa si|hago si|tengo que)|donde (esta|estan|veo|cargo|encuentro|se)|por que|para que (sirve|es)|no (puedo|me deja|aparece|aparecen|veo|encuentro|funciona|sube|anda)|paso a paso|pasos|explica|ensena|ayudame a|tengo que|hay que|se puede)/;
  const articulo = id => GUIA.find(a => a.id === id);
  const fmtTxt = s => esc(s).replace(/«([^»]{1,60})»/g, '<b class="simi-ref">«$1»</b>');
  const textoArticulo = a => `${a.t}\nQuién lo hace: ${a.quien || 'cualquier usuario'}\nPasos:\n${(a.pasos || []).map((p, i) => `${i + 1}. ${p}`).join('\n')}${a.nota ? '\nNota: ' + a.nota : ''}`;
  function puedeIr(a) {
    if (!a || !a.ir) return false;
    if (['nfc', 'iot', 'modulos'].includes(a.ir.vista)) return typeof eligeModulo === 'function' && eligeModulo();
    try { return navFor().some(n => n.v === a.ir.vista); } catch (_) { return false; }
  }
  function irA(a, sector) {
    if (!puedeIr(a)) { toast('info', 'Esa sección no está en tu menú', 'Tu usuario no tiene acceso a esa pantalla.'); return; }
    // Si la pregunta nombraba un sector, se va a la lista de ESE sector
    // (antes se abría la pantalla con todos los sectores).
    if (sector && sector.sector && ['inspeccion', 'mantenimiento', 'calidad'].includes(a.ir.vista)) return verLista({ sector: sector.sector, area: sector.area || '' });
    if (a.ir.insp) { try { inspVista = a.ir.insp; } catch (_) {} }
    if (window.innerWidth <= 1000) cerrar();
    go(a.ir.vista);
    try { const m = document.getElementById('main'); if (m) m.scrollTop = 0; } catch (_) {}
  }
  function avisoRol(a) {
    if (!a.roles || !a.roles.length || a.roles.includes(rolAyuda()) || (rolAyuda() === 'admin' && a.roles.includes('inspeccion'))) return '';
    return `<p class="simi-aviso">Esto lo hace ${esc(a.quien || 'otro rol')}. Te cuento cómo, por si lo necesitás.</p>`;
  }
  const accionesGuia = a => {
    const b = [];
    if (puedeIr(a) && !avisoRol(a)) b.push(`<button type="button" class="btn btn-sm btn-primary" onclick="simiAccion(${reg(() => irA(a))})">${svg(I.arrowR)} Llevame ahí</button>`);
    return b.length ? `<div class="simi-acc">${b.join('')}</div>` : '';
  };
  function tarjetaGuia(a, intro) {
    return `${intro ? `<p style="margin:0 0 8px">${intro}</p>` : ''}<div class="simi-guia">
      <div class="simi-guia-cab">GUÍA DE SIMA</div>
      <b class="simi-guia-t">${esc(a.t)}</b>
      ${avisoRol(a)}
      <ol class="simi-pasos">${(a.pasos || []).map(p => `<li><span>${fmtTxt(p)}</span></li>`).join('')}</ol>
      ${a.nota ? `<p class="simi-tip-g">${fmtTxt(a.nota)}</p>` : ''}
      ${accionesGuia(a)}
    </div>`;
  }
  const chipsRel = a => (a.rel || []).map(articulo).filter(Boolean).slice(0, 3).map(r => ({ t: r.t.replace(/^¿|\?$/g, ''), ayuda: r.id }));
  function responderGuia(a, intro) {
    S.hist.push({ rol: 'simi', texto: a.t + ': ' + (a.pasos || []).join(' ') });
    return { html: tarjetaGuia(a, intro), chips: chipsRel(a) };
  }
  async function preguntarIA(texto, encontrados, fichas) {
    // Sólo los artículos que de verdad coinciden (antes iban los 4 «más
    // parecidos» aunque no tuvieran que ver, y la IA respondía con ellos).
    const prev = [...S.hist].reverse().find(m => m.rol === 'usuario' && m.texto !== texto);
    const extra = prev ? buscarAyuda(prev.texto).filter(r => r.s >= 5).slice(0, 1) : [];
    const arts = [...new Map([...encontrados.filter(r => r.s >= 4).slice(0, 3), ...extra].map(r => [r.a.id, r.a])).values()].slice(0, 4);
    const cats = {}; Object.entries(CATEGORIAS).forEach(([k, v]) => { cats[k] = v.label; });
    const areas = {}; areaKeys().forEach(k => { areas[k] = AREAS[k].label; });
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 30000);
    try {
      const r = await fetch('/api/ia/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal: ctl.signal,
        body: JSON.stringify({ pregunta: texto, planta: plantaActual, modulo: modAct(), iot: window.SIMA_IOT && SIMA_IOT.activo() ? SIMA_IOT.resumenTexto() : '', vista: typeof view === 'string' ? view : '',
          historial: S.hist.slice(-7, -1), articulos: arts.map(a => ({ id: a.id, texto: textoArticulo(a) })), cats, areas,
          indice: GUIA.map(a => ({ id: a.id, t: a.t })), nombre: nombrePila(),
          fichas: (fichas || []).slice(0, 2).map(f => ({ id: f.id, texto: textoFicha(f) })) }) });
      const j = await r.json().catch(() => ({}));
      return r.ok && j.r ? j.r : null;
    } catch (_) { return null; } finally { clearTimeout(t); }
  }
  function respuestaIA(r) {
    if (r.tipo === 'reparacion') {
      const f = (r.fichas || []).map(id => FICHAS().find(x => x.id === id)).filter(Boolean)[0];
      S.hist.push({ rol: 'simi', texto: [r.texto, ...(r.pasos || [])].join(' ') });
      return { html: tarjetaRep({ titulo: r.titulo || '', texto: r.texto, causas: r.causas, pasos: r.pasos, cuidados: r.cuidados, prevenir: f && f.sintoma ? f.prevenir : null, ia: true }), chips: chipsRep(f && f.cat) };
    }
    if (r.tipo === 'tecnica') {
      S.hist.push({ rol: 'simi', texto: [r.titulo, r.texto, ...(r.causas || []), ...(r.pasos || [])].join(' ') });
      return { html: tarjetaTec(r), chips: menuTres() };
    }
    if (r.tipo === 'charla' || r.tipo === 'fuera') {
      S.hist.push({ rol: 'simi', texto: r.texto });
      return { html: `<p style="margin:0">${fmtTxt(r.texto)}</p>${r.tipo === 'fuera' ? volver() : ''}`, chips: menuTres(), feliz: r.tipo === 'charla' };
    }
    const fuentes = (r.articulos || []).map(articulo).filter(Boolean);
    const conIr = fuentes.find(f => puedeIr(f) && !avisoRol(f));
    const sec = S.sectorPregunta || null;
    // Si la tarea es de otro rol, se avisa igual que en la guía local
    // (salvo que Llama ya lo haya dicho).
    const aviso = fuentes[0] && !/lo hace/i.test(r.texto || '') ? avisoRol(fuentes[0]) : '';
    S.hist.push({ rol: 'simi', texto: [r.texto, ...(r.pasos || [])].join(' ') });
    const html = `${aviso}${r.texto ? `<p style="margin:0">${fmtTxt(r.texto)}</p>` : ''}
      ${r.pasos && r.pasos.length ? `<ol class="simi-pasos">${r.pasos.map(p => `<li><span>${fmtTxt(p)}</span></li>`).join('')}</ol>` : ''}
      ${conIr || fuentes.length ? `<div class="simi-acc">${conIr ? `<button type="button" class="btn btn-sm btn-primary" onclick="simiAccion(${reg(() => irA(conIr, sec))})">${svg(I.arrowR)} ${sec && ['inspeccion', 'mantenimiento', 'calidad'].includes(conIr.ir.vista) ? 'Llevame a ' + esc(sec.sector) : 'Llevame ahí'}</button>` : ''}${fuentes.map(f => `<button type="button" class="btn btn-sm btn-ghost" onclick="simiAccion(${reg(() => verGuia(f.id))})">Ver guía: ${esc(f.t.replace(/^¿|\?$/g, ''))}</button>`).join('')}</div>` : ''}
      <div class="simi-ia">✦ respondido con IA a partir de la guía de SIMA</div>`;
    const rel = fuentes[0] ? chipsRel(fuentes[0]) : [];
    return { html, chips: rel.length ? rel : chipsBase() };
  }
  function verGuia(id) {
    const a = articulo(id); if (!a) return;
    agregar('yo', esc(a.t));
    S.hist.push({ rol: 'usuario', texto: a.t });
    const r = responderGuia(a);
    agregar('bot', r.html); pintarChips(r.chips);
  }

  /* ---------------- Interfaz ---------------- */
  const raizApp = document.getElementById('appRoot') || document.body;
  raizApp.insertAdjacentHTML('beforeend', `
    <button type="button" class="simi-fab" id="simiFab" onclick="simiAlternar()" aria-label="Abrir SIMI, el asistente de SIMA (Ctrl + /)" aria-expanded="false" aria-controls="simiPanel" title="Preguntale a SIMI · Ctrl + /">
      ${simiSvg()}<span class="simi-fab-lbl">Preguntale a SIMI<small>ASISTENTE · CTRL + /</small></span>
    </button>
    <div class="simi-scrim" id="simiScrim" onclick="simiCerrar()"></div>
    <section class="simi-panel" id="simiPanel" role="dialog" aria-modal="false" aria-labelledby="simiTit" hidden>
      <div class="simi-grab" aria-hidden="true"></div>
      <header class="simi-head" id="simiHead">
        <span id="simiAvatar">${simiSvg()}</span>
        <div class="simi-tit" id="simiTit" tabindex="-1"><h2>SIMI</h2><div class="simi-sub"><span id="simiSub">Asistente de SIMA</span></div></div>
        <button type="button" class="simi-ico" onclick="simiNueva()" aria-label="Empezar una conversación nueva" title="Nueva conversación">${svg(I.refresh, '2.2')}</button>
        <button type="button" class="simi-ico" onclick="simiCerrar()" aria-label="Cerrar SIMI" title="Cerrar (Esc)">${svg(I.x, '2.4')}</button>
      </header>
      <div class="simi-log" id="simiLog" role="log" aria-live="polite" aria-relevant="additions"></div>
      <div class="simi-sug" id="simiSug" role="group" aria-label="Preguntas sugeridas"></div>
      <form class="simi-pie" onsubmit="simiEnviar(event)">
        <div class="dict simi-dict" id="dict_simiQ">
          <label for="simiQ" class="sr-only">Pregunta para SIMI</label>
          <textarea id="simiQ" rows="1" placeholder="Preguntá cómo hacer algo o por tus hallazgos…" enterkeyhint="send" autocomplete="off"></textarea>
          <div class="dict-bar">
            <div class="dict-idle">
              ${dictPosible() ? `<button type="button" class="simi-mic" onclick="dictIniciar('simiQ')" aria-label="Preguntar con la voz" title="Preguntar con la voz">${svg(I.mic, '2.2')}</button>` : ''}
              <button type="submit" class="simi-env" id="simiEnv" aria-label="Enviar pregunta" disabled>${svg(I.arrowR, '2.6')}</button>
            </div>
            <div class="dict-rec">
              <span class="dict-dot" aria-hidden="true"></span><span class="dict-estado">Te escucho</span><span class="dict-t" id="dictT_simiQ">0:00</span>
              <span class="dict-nivel" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
              <button type="button" class="dict-x" onclick="dictCancelar('simiQ')" aria-label="Cancelar">${svg(I.x, '2.4')}</button>
              <button type="button" class="dict-ok dict-rev" onclick="simiDictModo('revisar')" aria-label="Terminar y revisar el texto antes de enviar" title="Ver la transcripción y corregirla">${svg(I.pencil, '2.4')}<span>Revisar</span></button>
              <button type="button" class="dict-ok" onclick="simiDictModo('enviar')" aria-label="Terminar y enviar la pregunta" title="Enviar sin revisar">${svg(I.arrowR, '2.6')}<span>Enviar</span></button>
            </div>
            <div class="dict-proc"><span class="ia-spin" aria-hidden="true"></span> Entendiendo tu pregunta…</div>
            <div class="dict-hecho"></div>
          </div>
          <div class="sr-only" aria-live="polite" id="dictLive_simiQ"></div>
        </div>
      </form>
    </section>`);

  const $ = id => document.getElementById(id);
  const fab = $('simiFab'), panel = $('simiPanel'), log = $('simiLog'), sug = $('simiSug'), inp = $('simiQ');
  // Al cambiar de módulo, la próxima vez que se abra el chat SIMI saluda según el módulo.
  window.addEventListener('sima:modulo', () => { log.innerHTML = ''; S.acciones = []; });

  function humor(cls, ms) {
    const a = $('simiAvatar'); if (!a) return;
    a.classList.remove('pensando', 'feliz');
    if (cls) a.classList.add(cls);
    if (ms) setTimeout(() => a.classList.remove(cls), ms);
  }
  function agregar(quien, html, cont) {
    const d = document.createElement('div');
    d.className = 'simi-msg ' + quien + (cont ? ' cont' : '');
    d.innerHTML = quien === 'bot' ? `<span class="simi-mini">${simiSvg('mini')}</span><div class="simi-bur">${html}</div>` : `<div class="simi-bur">${html}</div>`;
    log.appendChild(d);
    if (typeof hacerAccesibles === 'function') hacerAccesibles(d);
    requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
    return d;
  }
  function pintarChips(lista) {
    S.chips = lista || [];
    sug.innerHTML = S.chips.map((c, i) => `<button type="button" class="simi-chip" onclick="simiChip(${i})">${esc(c.t)}</button>`).join('');
    sug.hidden = !S.chips.length;
  }
  window.simiChip = i => { const c = S.chips[i]; if (!c) return; if (c.ayuda) verGuia(c.ayuda); else preguntar(c.t, c.q); };

  function saludar() {
    const nom = nombrePila();
    const r = resumen({});
    let veces = 0;
    try { veces = +localStorage.getItem('sima.simi.saludos') || 0; localStorage.setItem('sima.simi.saludos', veces + 1); } catch (_) {}
    const conocido = veces >= 3; // ya lo vio varias veces: saludo corto, sin presentarse
    const m = modAct();
    if (m !== 'ruta') {
      S.hist = []; S.menuN = 1; S.saludosN = 0; S.sugeridas = [];
      const alN = m === 'nfc' && window.SIMA_NFC && SIMA_NFC.activo() ? SIMA_NFC.alertas() : null;
      agregar('bot', alN
        ? `¡Hola${nom ? ', ' + esc(nom) : ''}! Estás en <b>Seguimiento de equipos</b>. Sigo el plan de mantenimiento de los 6 equipos de envasado y expedición${alN.length ? `; ahora hay <b>${alN.length}</b> ${alN.length > 1 ? 'temas para resolver' : 'tema para resolver'}, el primero: ${esc(alN[0].t.charAt(0).toLowerCase() + alN[0].t.slice(1))}` : ' y está todo al día'}. Preguntame por un equipo, su historial o qué vence esta semana.`
        : m === 'nfc'
        ? `¡Hola${nom ? ', ' + esc(nom) : ''}! Estás en el módulo <b>Seguimiento de equipos (NFC)</b>, que está en preparación. Te cuento cómo va a funcionar, qué hace falta para el piloto o probamos si tu celular lee NFC.`
        : (window.SIMA_IOT && SIMA_IOT.activo()
          ? `¡Hola${nom ? ', ' + esc(nom) : ''}! Estás en <b>Monitoreo Industrial 5.0</b>. Vigilo cámaras, túneles, energía, agua y vapor: preguntame cómo está un equipo, qué hacer con una alarma, cuánto se consumió un día o pedime el resumen del turno.`
          : `¡Hola${nom ? ', ' + esc(nom) : ''}! Estás en <b>Monitoreo Industrial 5.0</b>. La conexión con el Grafana de la planta está pendiente; te cuento cómo va a funcionar y qué hay que pedirle a Sistemas.`));
      pintarChips(chipsBase());
      humor('feliz', 1400);
      return;
    }
    const intro = conocido
      ? (L().length ? `¡Hola${nom ? ', ' + esc(nom) : ''}! Así viene <b>${esc(plantaLbl())}</b>:` : `¡Hola${nom ? ', ' + esc(nom) : ''}! ¿En qué te ayudo?`)
      : L().length
      ? `¡Hola${nom ? ', ' + esc(nom) : ''}! Soy <b>SIMI</b>, tu asistente en SIMA. Preguntame <b>cómo hacer algo</b> —un recorrido, programar o cerrar un trabajo— o <b>por tus hallazgos</b>. Así viene <b>${esc(plantaLbl())}</b>:`
      : `¡Hola${nom ? ', ' + esc(nom) : ''}! Soy <b>SIMI</b>, tu asistente en SIMA. Preguntame cómo hacer cualquier cosa en el sistema.`;
    S.hist = []; S.menuN = 0; S.saludosN = 0; S.sugeridas = [];
    agregar('bot', intro);
    if (L().length) agregar('bot', r.html, true);
    pintarChips(chipsBase());
    humor('feliz', 1400);
  }

  const PIENSA = {
    general: ['Leyendo tu pregunta…', 'Pensando…', 'Buscando en la guía de SIMA…', 'Uniendo las piezas…', 'Armando la respuesta…', 'Casi listo…'],
    falla: ['Analizando la falla…', 'Revisando las fichas de reparación…', 'Pensando en las causas posibles…', 'Ordenando los pasos…', 'Sumando los cuidados de seguridad e inocuidad…', 'Repasando cómo evitar que vuelva…'],
    datos: ['Contando hallazgos…', 'Cruzando áreas y estados…', 'Calculando con tus datos…'],
    ia: ['Analizando lo que me pediste…', 'Consultando la guía…', 'Trabajando en ello…', 'Escribiendo la respuesta…', 'Revisando que esté clara…']
  };
  function pensar(el, tipo) {
    clearInterval(S.piensaT);
    const lista = PIENSA[tipo] || PIENSA.general; let i = 0;
    const t = el && el.querySelector('.sp-txt'); if (!t) return;
    const poner = () => { t.classList.remove('in'); void t.offsetWidth; t.textContent = lista[i % lista.length]; t.classList.add('in'); i++; };
    poner();
    S.piensaT = setInterval(() => { if (!document.body.contains(t)) return clearInterval(S.piensaT); poner(); }, 1300);
  }
  /* Humor para temas que no son de la planta (11-11-26). Respetuoso, con una
     analogía de mantenimiento, y de vuelta a lo que SIMI sí sabe hacer.
     Si hay señales de angustia real, nada de chistes. */
  const FUERA = [
    { rx: /\b(novia|novio|pareja|mi ex|amor|enamor\w*|cita|casarme|casamiento|me quiere|no me habla|corazon|celos|romance|crush|me gusta alguien)\b/,
      r: ['Mirá, en el amor pasa como con un burlete: si no lo revisás seguido, se escapa el frío y después cuesta recuperar la temperatura. Yo de corazones no sé mucho, pero de cámaras que pierden frío, un montón.',
        'Las relaciones son como una ruta de inspección: si dejás pendientes sin cerrar, se arrastran a la siguiente. Mi consejo profesional termina ahí; lo mío son las no conformidades de la planta.',
        'Si el amor tuviera Orden SAP, te lo programaba con fecha tentativa. Como no la tiene, te ayudo con lo que sí: fallas, rutas y tus números.'] },
    { rx: /\b(futbol|partido|gol|cerro|olimpia|libertad|messi|mundial|equipo de futbol|hincha)\b/,
      r: ['El fútbol es como una ruta de inspección: el que no recorre toda la cancha no encuentra nada. Yo juego de lateral en la planta: te cubro las fallas y los números.'] },
    { rx: /\b(clima|lluvia|va a llover|calor|frio afuera|pronostico|temperatura afuera)\b/,
      r: ['Del clima de afuera no te sé decir, pero si llueve, fijate las canaletas: las goteras aparecen justo el día de la auditoría. ¿Te paso la ficha de goteras?'] },
    { rx: /\b(chiste|contame algo|aburrido|me aburro|cantame|bailar|receta|cocinar|asado)\b/,
      r: ['Un chiste de planta: ¿por qué la silicona se fue de la junta? Porque nadie la limpió antes de pegarla. Ahora en serio, ¿te ayudo con una falla o con tus números?'] }
  ];
  const ANGUSTIA = /\b(suicid\w*|matarme|no quiero vivir|quiero morir|me quiero morir|hacerme dano|no aguanto mas|depresion|estoy muy mal)\b/;
  function humorFuera(q) {
    if (ANGUSTIA.test(q)) return 'Lamento que estés pasando por algo así. No estás solo: hablá ahora con alguien de confianza o, si sentís que estás en peligro, llamá al servicio de emergencias (911). Si querés, también podés avisar a tu supervisor o a Recursos Humanos para que te acompañen.';
    const g = FUERA.find(x => x.rx.test(q)); if (!g) return '';
    return g.r[Math.floor(Math.random() * g.r.length)];
  }
  async function preguntar(texto, consulta) {
    const visible = texto || describir(consulta);
    agregar('yo', esc(visible));
    S.hist.push({ rol: 'usuario', texto: visible });
    pintarChips([]);
    const esc_ = agregar('bot', '');
    // SIMI trabajando en la respuesta (11-11-26): su cara pensando, renglones
    // que se «escriben» y frases que van cambiando según lo que está haciendo.
    esc_.querySelector('.simi-bur').outerHTML = `<div class="simi-piensa" role="status" aria-live="polite">
      <span class="sp-cara">${window.SIMI_M ? SIMI_M.svg('sp-svg', { manos: false }) : ''}</span>
      <div class="sp-cuerpo"><span class="sp-txt">${PIENSA.general[0]}</span>
        <span class="sp-lineas" aria-hidden="true"><i></i><i></i><i></i></span></div></div>`;
    try { const c = esc_.querySelector('.sp-svg'); if (c && window.SIMI_M) SIMI_M.humor(c, 'pensando', 0); } catch (_) {}
    pensar(esc_, 'general');
    humor('pensando');
    const fin = r => { clearInterval(S.piensaT); esc_.remove(); humor(''); agregar('bot', r.html); pintarChips(r.chips); if (r.feliz) humor('feliz', 1600); };
    const pausa = () => new Promise(r => setTimeout(r, 300));   // se lee como respuesta, no como salto

    // 1) Consulta de datos ya estructurada (chips, barras, tarjetas).
    if (consulta) { await pausa(); return fin(responderDatos(consulta, false)); }

    // Si el chat se abrió con una pregunta, el estado de la IA puede no estar
    // consultado todavía: se espera (queda en caché 5 min) para no responder
    // «sin IA» cuando sí hay.
    if (!iaOk() && navigator.onLine !== false && typeof iaConsultarEstado === 'function') { try { await iaConsultarEstado(); } catch (_) {} }
    // Módulo 3 (Monitoreo Industrial 5.0): lecturas, alarmas, histórico y
    // resumen del turno se responden con los datos del módulo, sin IA.
    // Módulo 2 (Seguimiento de equipos): estado, plan e historial de cada equipo.
    if (window.SIMA_NFC && SIMA_NFC.activo() && modAct() !== 'iot') {
      const h = SIMA_NFC.responder(texto);
      if (h) { await pausa(); S.hist.push({ rol: 'simi', texto: 'Equipos: ' + texto }); return fin({ html: h, chips: menuTres() }); }
    }
    if (window.SIMA_IOT && SIMA_IOT.activo() && (modAct() === 'iot' || LECTURA.test(' ' + sinAcentos(texto).toLowerCase() + ' '))) {
      const h = SIMA_IOT.responder(texto);
      if (h) { await pausa(); S.hist.push({ rol: 'simi', texto: 'Monitoreo: ' + texto }); return fin({ html: h, chips: menuTres() }); }
    }
    const q = ' ' + sinAcentos(texto).toLowerCase().replace(/[¿?¡!.,;:]/g, ' ') + ' ';
    const encontrados = buscarAyuda(texto);
    const s1 = encontrados[0] ? encontrados[0].s : 0, s2 = encontrados[1] ? encontrados[1].s : 0;
    const esAyuda = ES_AYUDA.test(q);
    const datos = interpretar(texto);
    S.sectorPregunta = buscarSector(q);

    // 2) Charla (saludos, cómo estás, quién sos, gracias, chau…): se
    //    responde acá, al instante y sin señal. Si el saludo trae una
    //    pregunta («hola, ¿cuántas puertas hay?»), se saluda y se sigue.
    const ch = charla(q);
    if (ch && !ch.resto) { await pausa(); S.hist.push({ rol: 'simi', texto: ch.txt }); return fin({ html: ch.html, chips: ch.chips, feliz: ch.feliz }); }
    if (ch && ch.resto) { texto = ch.resto; agregar('bot', ch.html); }
    if (ANGUSTIA.test(q)) { await pausa(); const t = humorFuera(q); S.hist.push({ rol: 'simi', texto: t }); return fin({ html: `<p style="margin:0">${t}</p>`, chips: [] }); }
    const q2 = ch && ch.resto ? ' ' + sinAcentos(texto).toLowerCase().replace(/[¿?¡!.,;:]/g, ' ') + ' ' : q;
    const enc2 = ch && ch.resto ? buscarAyuda(texto) : encontrados;
    const t1 = enc2[0] ? enc2[0].s : 0;
    const esAy2 = ES_AYUDA.test(q2);
    const datos2 = ch && ch.resto ? interpretar(texto) : datos;

    // 3) «recorrido guiado», «cómo me muevo en SIMA» → la guía paso a paso.
    if (/\b(recorrido guiado|tour|tutorial|guia paso a paso|como me (muevo|manejo|ubico)|como (uso|se usa|funciona) (sima|el sistema|la app)|primeros pasos|mostrame (el sistema|sima|como funciona))\b/.test(q2) && window.simaTour) {
      await pausa();
      fin({ html: '¡Vamos! Te muestro SIMA paso a paso.', chips: [] });
      setTimeout(() => { cerrar(); simaTour.iniciar(true); }, 700);
      return;
    }
    // 3b) Consultas técnicas o de gestión (KPI de agua y vapor, energía,
    //    preventivo, MTBF, OEE…): no son de la guía de SIMA ni una falla
    //    puntual → las responde la IA como ingeniero de mantenimiento.
    if (TECNICA.test(q2) && !CUENTA.test(q2)) {
      pensar(esc_, 'ia');
      if (iaOk()) {
        const r = await preguntarIA(texto, enc2);
        if (r && r.tipo !== 'fuera') return fin(r.tipo === 'datos' && r.consulta ? responderDatos(normalizarConSector(r.consulta), true) : respuestaIA(r));
      }
      await pausa();
      S.hist.push({ rol: 'simi', texto: 'Consulta técnica sin IA.' });
      return fin({ html: `${navigator.onLine === false ? 'Estoy sin señal, y para' : 'Para'} una consulta técnica como esta necesito la inteligencia artificial, que ahora no responde. Probá de nuevo en un rato. Mientras tanto, lo que sí registra SIMA son los hallazgos: puedo mostrarte cuáles hay por área o por tipo.`, chips: menuTres() });
    }
    // 3c) Lecturas en vivo (temperatura, energía, agua): todavía no hay
    //     sensores conectados → se dice claro, sin inventar valores.
    if (LECTURA.test(q2) && !ARREGLO.test(q2) && !/\b(no (enfria|anda|funciona|prende)|se (corta|rompe|cae))\b/.test(q2)) {
      await pausa();
      S.hist.push({ rol: 'simi', texto: 'Sin lecturas en vivo todavía.' });
      return fin({ html: `Todavía no tengo lecturas en vivo: el módulo <b>Monitoreo Industrial 5.0</b> todavía no está conectado al Grafana de la planta. Para el valor de ahora, miralo en Grafana o en el controlador de la cámara.${modAct() !== 'iot' && typeof modulo === 'string' && typeof eligeModulo === 'function' && eligeModulo() ? ' <a href="#" onclick="event.preventDefault();simiCerrar();elegirModulo(\'iot\')">Ver el módulo 3</a>' : ''}`, chips: menuTres() });
    }
    // 4) Fallas y averías de la planta («la puerta se cae siempre», «hay
    //    agua en el piso», «¿cómo reparo…?», «¿qué hago para que no…?»):
    //    con señal responde Llama con las fichas que coinciden; sin señal,
    //    la ficha. Una pregunta de cantidad («¿cuántas puertas…?») no entra.
    const fichas = buscarFicha(texto).map(x => x.f);
    const tipoMencionado = datos2 && datos2.tipo;
    const falla = !CUENTA.test(q2) && (ARREGLO.test(q2) || SINTOMA.test(q2)) && (fichas.length || tipoMencionado || ARREGLO_FUERTE.test(q2) || EQUIPO.test(q2))
      && !(esAy2 && t1 >= 7 && !fichas.length) && !/\b(sima|la app|el sistema|recorrido|hallazgo arrastrado|orden sap|usuario|contrasena|planta 2|planta 8)\b/.test(q2);
    if (falla) {
      pensar(esc_, 'falla');
      if (iaOk()) {
        const r = await preguntarIA(texto, enc2, fichas.length ? fichas : (tipoMencionado ? FICHAS().filter(f => f.cat === tipoMencionado || (f.alt || []).includes(tipoMencionado)) : []));
        if (r && r.tipo === 'reparacion' && (r.pasos || []).length) return fin(respuestaIA(r));
        if (r && r.tipo === 'charla' && r.texto) return fin(respuestaIA(r));
      }
      await pausa();
      const f = fichas[0] || FICHAS().find(x => x.cat === tipoMencionado);
      if (f) return fin(respuestaRepLocal(f, !iaOk()));
      S.hist.push({ rol: 'simi', texto: 'Sin ficha para esa reparación.' });
      return fin({ html: `${navigator.onLine === false ? 'Estoy sin señal y no' : 'No'} tengo una ficha para esa falla. Tengo fichas de goteras, puertas, paredes, pisos, siliconas, luminarias, tomas y cables, lavamanos, esterilizadores, soldaduras, zócalos y cámaras que pierden frío.${navigator.onLine === false ? ' Con señal te lo respondo con IA.' : ''}`, chips: chipsRep() });
    }
    // 5) Números de hallazgos → siempre se calculan acá, con los datos que
    //    el usuario puede ver (la IA nunca da cifras).
    const ayuda = (esAy2 && t1 >= 4) || (!datos2 && t1 >= 7) || (datos2 && datos2.intent === 'ayuda');
    if (datos2 && datos2.intent === 'ayuda') { await pausa(); return fin(responderGuia(articulo('simi'))); }
    if (datos2 && !ayuda) { await pausa(); return fin(responderDatos(datos2, false)); }
    // 6) Uso de SIMA con una coincidencia muy clara en la guía: local, al
    //    instante (no gasta IA ni depende de la señal).
    const e1 = enc2[0], e2 = enc2[1];
    const clara = e1 && t1 >= 8 && e1.m === e1.n && (!e2 || e2.m < e1.m || t1 - e2.s >= 3) && !/\b(y si|pero|entonces|y cuando|y despues|tambien)\b/.test(q2);
    if (clara && esAy2) { await pausa(); return fin(responderGuia(e1.a)); }
    // Glosario («¿qué es una disciplina?», «¿qué significa arrastrado?»): con una coincidencia buena, local.
    if (e1 && t1 >= 5 && /\b(que (es|son|significa|quiere decir)|definicion|a que se refiere)\b/.test(q2) && (!e2 || t1 - e2.s >= 2)) { await pausa(); return fin(responderGuia(e1.a)); }
    // 7) Con señal, TODO lo demás (seguimientos, preguntas abiertas,
    //    charla más larga) lo responde Llama con los artículos que de verdad
    //    coinciden, el índice de la guía y la conversación reciente.
    if (iaOk()) {
      pensar(esc_, 'ia');
      const r = await preguntarIA(texto, enc2);
      if (r) return fin(r.tipo === 'datos' && r.consulta ? responderDatos(normalizarConSector(r.consulta), true) : respuestaIA(r));
    }
    // 8) Sin señal o si la IA no respondió: la guía local.
    await pausa();
    const sinRed = navigator.onLine === false;
    // Temas ajenos a la planta (amor, fútbol, clima…): con humor y una analogía
    // de mantenimiento, sin IA. Con IA, el modelo arma su propio chiste.
    const fueraLocal = humorFuera(q2);
    if (fueraLocal) { S.hist.push({ rol: 'simi', texto: fueraLocal }); return fin({ html: `<p style="margin:0">${fueraLocal}</p>${volver()}`, chips: menuTres() }); }
    if (ayuda || t1 >= 3) {
      return fin(responderGuia(e1.a, clara ? '' : (ayuda ? 'Creo que te referís a esto:' : 'No estoy seguro, pero quizás te sirva esto:')));
    }
    S.hist.push({ rol: 'simi', texto: 'No entendí la pregunta.' });
    fin({ html: `Perdón, no te entendí${sinRed ? ' (estoy sin señal, así que entiendo preguntas más simples)' : ''}. Puedo ayudarte con tres cosas:`, chips: menuTres() });
  }

  function normalizar(x) {
    return { intent: x.intent, dim: x.dim || '', estado: x.estado || '', area: AREAS_BASE[x.area] ? x.area : '', tipo: CATEGORIAS[x.tipo] ? x.tipo : '',
      disc: '', periodo: x.periodo || '', sector: '' };
  }
  function normalizarConSector(x) {
    const c = normalizar(x);
    const s = (x.sector && buscarSector(x.sector)) || S.sectorPregunta;
    if (s) { c.sector = s.sector; if (!c.area && s.area) c.area = s.area; }
    return c;
  }
  function responderDatos(c, viaIA) {
    const r = responder(c, viaIA);
    S.hist.push({ rol: 'simi', texto: '(respuesta con números de hallazgos: ' + describir(c) + ')' });
    return r;
  }
  function describir(c) {
    if (!c) return '';
    const t = contexto(c).join(' · ');
    const base = { resumen: 'Resumen', cuantos: '¿Cuántos hay?', ranking: `${DIM_LBL[c.dim] || 'Área'} con más hallazgos`, antiguos: 'Los más antiguos sin cerrar', atrasados: 'Trabajos muy atrasados', repetidas: 'No conformidades que se repiten', por_estado: 'Por estado', ayuda: 'Ayuda' }[c.intent] || '';
    return t ? `${base} · ${t}` : base;
  }

  /* ---------------- Abrir / cerrar ---------------- */
  function abrir() {
    if (S.abierto) return;
    S.abierto = true;
    if (typeof iaConsultarEstado === 'function') iaConsultarEstado();
    const tip = $('simiTip'); if (tip) tip.remove();
    try { localStorage.setItem('sima.simi.visto', '1'); } catch (_) {}
    fab.classList.remove('nuevo');
    panel.hidden = false; fab.classList.add('abierto'); fab.setAttribute('aria-expanded', 'true');
    $('simiScrim').classList.add('on');
    $('simiSub').textContent = 'Asistente de SIMA · ' + plantaLbl();
    if (S.planta !== plantaActual || !log.children.length) { log.innerHTML = ''; S.acciones = []; S.planta = plantaActual; saludar(); }
    // En celular no se abre el teclado solo: el foco va al título.
    setTimeout(() => (window.matchMedia('(pointer:coarse)').matches ? $('simiTit') : inp).focus({ preventScroll: true }), 60);
  }
  function cerrar() {
    if (!S.abierto) return;
    if (dictAct && dictAct.id === 'simiQ') dictCancelar('simiQ');
    S.abierto = false;
    panel.hidden = true; fab.classList.remove('abierto'); fab.setAttribute('aria-expanded', 'false');
    $('simiScrim').classList.remove('on');
    fab.focus({ preventScroll: true });
  }
  window.simiAlternar = () => S.abierto ? cerrar() : abrir();
  window.simiCerrar = cerrar;
  window.simiAbrir = abrir;
  window.simiNueva = () => { log.innerHTML = ''; S.acciones = []; S.planta = plantaActual; saludar(); };
  window.simiPreguntar = (t) => { abrir(); preguntar(t); };
  window.simiEnviar = e => {
    e && e.preventDefault();
    const t = inp.value.trim(); if (!t) return;
    const nota = $('simiRevNota'); if (nota) nota.remove();
    inp.value = ''; autoAlto(); preguntar(t);
  };
  function autoAlto() {
    inp.style.height = 'auto'; inp.style.height = Math.min(120, inp.scrollHeight) + 'px';
    $('simiEnv').disabled = !inp.value.trim();
  }
  inp.addEventListener('input', autoAlto);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); window.simiEnviar(); } });
  // Pregunta dictada: se envía sola (como un asistente de voz).
  /* Dictado en el chat con dos salidas (11-11-26), como en los asistentes de
     voz: «Revisar» deja la transcripción en la caja para corregirla (el
     dictado a veces se equivoca) y «Enviar» pregunta directo. */
  window.simiDictModo = m => { S.dictModo = m; dictListo('simiQ'); };
  document.addEventListener('sima:dictado', e => {
    if (e.detail.id !== 'simiQ' || !inp.value.trim()) return;
    const modo = S.dictModo || 'revisar'; S.dictModo = '';
    if (modo === 'enviar') { setTimeout(() => window.simiEnviar(), 250); return; }
    setTimeout(() => {
      try { dictPintar('simiQ', ''); } catch (_) {}
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.focus(); try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (_) {}
      let n = $('simiRevNota');
      if (!n) { n = document.createElement('div'); n.id = 'simiRevNota'; n.className = 'simi-revnota'; n.setAttribute('role', 'status'); inp.closest('.simi-pie').prepend(n); }
      n.innerHTML = `${svg(I.pencil, '2.2')} Revisá lo que entendí y tocá <b>Enviar</b>. Podés corregir cualquier palabra.`;
      const quitar = () => { n.remove(); };
      setTimeout(() => inp.addEventListener('keydown', quitar, { once: true }), 50);
    }, 300);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && S.abierto && !document.getElementById('overlay')?.classList.contains('show')) { e.preventDefault(); cerrar(); }
    if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); window.simiAlternar(); }
  });
  // Hoja inferior: deslizar hacia abajo desde la cabecera la cierra.
  (() => {
    let y0 = null; const h = $('simiHead');
    const ini = e => { if (window.innerWidth <= 1000) y0 = (e.touches ? e.touches[0] : e).clientY; };
    const mov = e => { if (y0 == null) return; const dy = (e.touches ? e.touches[0] : e).clientY - y0; if (dy > 0) panel.style.transform = `translateY(${dy}px)`; };
    const fin = e => { if (y0 == null) return; const dy = ((e.changedTouches ? e.changedTouches[0] : e).clientY) - y0; y0 = null; panel.style.transform = ''; if (dy > 90) cerrar(); };
    h.addEventListener('touchstart', ini, { passive: true }); h.addEventListener('touchmove', mov, { passive: true }); h.addEventListener('touchend', fin);
    panel.querySelector('.simi-grab').addEventListener('touchstart', ini, { passive: true });
  })();

  /* Primer uso: anillo en el botón. La presentación la hace el recorrido
     guiado (sima-tour.js, 09-11-26), que reemplaza al globo de bienvenida. */
  let visto = false; try { visto = localStorage.getItem('sima.simi.visto') === '1'; } catch (_) {}
  if (!visto) fab.classList.add('nuevo');


  /* ---------------- SIMI con vida (07-11-26) ----------------
     · Respira, parpadea, sigue el cursor (PC) y cada tanto hace un gesto.
     · Festeja cada cierre: salta, confeti y un globo con el logro.
     · Si hay trabajos muy atrasados o NC que se repiten: cara de alerta,
       antena roja, un número en el botón y un aviso (una vez por día, o
       antes si los números suben). */
  const M = window.SIMI_M;
  const fabSvg = () => fab.querySelector('.simi-svg');
  if (M) { M.vivir(fab); M.vivir($('simiAvatar')); }
  fab.insertAdjacentHTML('beforeend', '<span class="simi-badge" id="simiBadge" hidden></span>');
  (function gestos() {
    setTimeout(() => {
      const sv = fabSvg();
      if (M && sv && !S.abierto && document.visibilityState === 'visible' && !document.getElementById('overlay')?.classList.contains('show')) {
        if (sv.classList.contains('h-alerta')) { if (!M.REDUCE) { sv.classList.add('sacude'); setTimeout(() => sv.classList.remove('sacude'), 520); } }
        else M.gesto(sv);
      }
      gestos();
    }, 12000 + Math.random() * 14000);
  })();
  // Globo al costado del botón (no tapa los avisos de la app, que salen abajo a la derecha).
  function globo(html, { ms = 0, tono = '', id = 'simiTip' } = {}) {
    const prev = $(id); if (prev) prev.remove();
    const r = fab.getBoundingClientRect();
    const d = document.createElement('div');
    d.className = 'simi-tip simi-tip-lado' + (tono ? ' ' + tono : ''); d.id = id; d.setAttribute('role', 'status');
    d.innerHTML = html + '<button type="button" class="simi-tip-x" aria-label="Cerrar aviso">×</button>';
    if (r.width) { d.style.right = Math.max(8, innerWidth - r.left + 10) + 'px'; d.style.bottom = Math.max(8, innerHeight - r.bottom) + 'px'; }
    raizApp.appendChild(d);
    if (typeof hacerAccesibles === 'function') hacerAccesibles(d);
    if (ms) setTimeout(() => d.isConnected && d.remove(), ms);
    return d;
  }
  // Festejo de cierres (lo dispara index.html al cerrar, verificar o validar).
  window.addEventListener('sima:celebrar', e => {
    const { id = '', tipo = 'cerrado' } = e.detail || {};
    const av = S.abierto ? $('simiAvatar') : fab;
    const sv = av && av.querySelector('.simi-svg'), r = av.getBoundingClientRect();
    if (M && sv) { M.saltar(sv); M.confeti(r.left + Math.min(r.width, 62) / 2 + (S.abierto ? 0 : 0), r.top + r.height / 2); }
    const frases = {
      mant: [`¡Buen trabajo! <b>${esc(id)}</b> pasó a la verificación del Inspector.`, `¡Listo el arreglo de <b>${esc(id)}</b>! Ahora lo verifica el Inspector.`],
      validado: [`¡Validado por Calidad! <b>${esc(id)}</b> queda liberado.`, `<b>${esc(id)}</b> pasó el control final. ¡Circuito completo!`],
      cerrado: [`¡Una no conformidad menos! <b>${esc(id)}</b> quedó cerrada.`, `¡Bien! <b>${esc(id)}</b> cerrada con evidencia.`]
    }[tipo] || [`¡Bien! <b>${esc(id)}</b>.`];
    if (!S.abierto) globo(frases[Math.floor(Math.random() * frases.length)], { ms: 4800, tono: 'ok', id: 'simiFesta' });
    setTimeout(revisarAlertas, 2200);
  });
  let alertaUlt = '';
  function revisarAlertas() {
    const app = document.getElementById('appRoot');
    if (!app || app.hidden || typeof L !== 'function') return;
    let a = [], r = [];
    try { a = atrasadosDe(); r = role === 'mantenimiento' ? [] : repetidasDe(); } catch (_) { return; }
    const n = a.length + r.length, sv = fabSvg(), b = $('simiBadge');
    if (b) { b.hidden = !n; b.textContent = n > 99 ? '99+' : String(n); }
    fab.setAttribute('aria-label', 'Abrir SIMI, el asistente de SIMA (Ctrl + /)' + (n ? ` · ${n} aviso${n > 1 ? 's' : ''}` : ''));
    if (M && sv) {
      const era = sv.dataset.base === 'alerta';
      sv.dataset.base = n ? 'alerta' : '';
      if (n && !era && !/h-(salta|feliz|saluda)/.test(sv.getAttribute('class'))) M.humor(sv, 'alerta', 0);
      if (!n && era) M.humor(sv, '');
    }
    S.alertas = { a, r };
    // Aviso: una vez por día, o de nuevo si aumentaron.
    const sig = today() + '|' + a.length + '|' + r.length;
    let visto = ''; try { visto = localStorage.getItem('sima.simi.alerta.' + role) || ''; } catch (_) {}
    const [vd, va, vr] = visto.split('|');
    const nuevo = vd !== today() || a.length > +va || r.length > +vr;
    if (!n || !nuevo || S.abierto || $('simiTip') || $('simaTour') || sig === alertaUlt) return;
    if (modAct() !== 'ruta') return;   // los avisos de hallazgos son de la Ruta; los módulos 2 y 3 tienen los suyos
    // Una sola voz por pantalla: en Inicio ya lo dice el resumen del turno;
    // con una ruta en curso SIMI no interrumpe.
    if ($('homeTurno') && !$('homeTurno').hidden) return;
    if ($('simiOnb') || $('simiSeccion')) return;   // en cada sección ya habla la barra de SIMI
    try { if (role !== 'mantenimiento' && typeof recEnCurso === 'function' && recEnCurso()) return; } catch (_) {}
    alertaUlt = sig;
    const partes = [];
    if (a.length) partes.push(`<b>${a.length} trabajo${a.length > 1 ? 's' : ''} muy atrasado${a.length > 1 ? 's' : ''}</b>`);
    if (r.length) partes.push(`<b>${r.length} punto${r.length > 1 ? 's' : ''} con no conformidades que se repiten</b>`);
    const d = globo(`<span class="simi-tip-tit">SIMI te avisa</span>${role === 'mantenimiento' ? 'Tenés' : 'Hay'} ${partes.join(' y ')}.
      <span class="simi-tip-acc">${a.length ? '<button type="button" class="btn btn-sm btn-primary" data-q="atrasados">Ver atrasados</button>' : ''}${r.length ? `<button type="button" class="btn btn-sm ${a.length ? 'btn-ghost' : 'btn-primary'}" data-q="repetidas">Ver repetidas</button>` : ''}</span>`, { tono: 'alerta' });
    const marcar = () => { try { localStorage.setItem('sima.simi.alerta.' + role, sig); } catch (_) {} };
    d.querySelector('.simi-tip-x').addEventListener('click', () => { marcar(); d.remove(); });
    d.querySelectorAll('[data-q]').forEach(x => x.addEventListener('click', () => {
      marcar(); d.remove(); abrir();
      setTimeout(() => preguntar(null, { intent: x.dataset.q, estado: x.dataset.q === 'atrasados' ? 'abiertos' : '' }), 120);
    }));
  }
  window.simiRevisarAlertas = revisarAlertas;
  // Para SIMI compañero (sima-companero.js): mismos cálculos de atrasos y repetidas.
  window.SIMI_DATOS = { atrasadosDe, repetidasDe, motivoAtraso };
  // Abrir el chat con una pregunta ya hecha (desde el resumen del turno).
  window.simiVerLista = c => verLista(c);
  window.simiAbrirCon = (q, consulta) => { abrir(); setTimeout(() => consulta ? preguntar(null, consulta) : preguntar(q), 120); };
  // Se revisa después de cada render de la app (con pausa), al iniciar sesión y cada 5 minutos.
  if (typeof window.render === 'function') {
    const r0 = window.render; let tRev = null;
    window.render = function () { const x = r0.apply(this, arguments); clearTimeout(tRev); tRev = setTimeout(revisarAlertas, 900); return x; };
  }
  window.addEventListener('sima:auth', () => setTimeout(revisarAlertas, 1500));
  setInterval(revisarAlertas, 300000);
  setTimeout(revisarAlertas, 2500);
  window.SIMI = { interpretar, filtrar, responder, agrupar, atrasadosDe, repetidasDe, buscarFicha };
})();
