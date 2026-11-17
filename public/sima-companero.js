/* =====================================================================
   SIMI compañero (11-11-26)
   ---------------------------------------------------------------------
   SIMI deja de ser sólo un chat: aparece solo, en el momento justo y
   dentro de la pantalla donde se trabaja. El CÓDIGO decide cuándo
   hablar (con datos reales de SIMA) y la IA queda para lo que ya hace:
   sugerir tipo y sector en la carga y responder en el chat.

   1. Resumen del turno en Inicio (#homeTurno): lo importante de hoy
      según el rol, con la cara de SIMI de acuerdo al estado de la planta
      (contento si está al día, atento si hay atrasos). «Ahora no» lo
      oculta hasta mañana.
   2. SIMI en el sector (#simiSector, dentro de «Nuevo hallazgo»): al
      elegir la ubicación cuenta qué pasa ahí (abiertos, el más viejo y
      lo que más se repite) para que el inspector mire eso primero.
   3. SIMI revisa el hallazgo (#simiRevisa): mientras dictás o escribís
      marca si falta la medida, una referencia o detalle, si la foto
      salió mal y si parece urgente. No bloquea nada: sugiere.

   Reglas de convivencia (para que no sea un Clippy):
     · cada intervención dice POR QUÉ aparece;
     · se puede cerrar («Ahora no») y se recuerda;
     · durante una ruta en curso, el resumen se calla;
     · los avisos flotantes de SIMI no salen en Inicio si ya está el
       resumen (una sola voz por pantalla).
   4. (Fase 3) SIMI propone acciones: arma un plan de programación
      (técnico y fecha por hallazgo), lo muestra, se edita, y sólo con
      «Programar» se ejecuta; después ofrece «Deshacer».
   API: window.SIMI_COMP = { onboarding, cerrarOnb, seccion, datoSeccion, resumen, sector, revisar, planProgramar, planSinProgramar }
   ===================================================================== */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const M = () => window.SIMI_M;
  const D = () => window.SIMI_DATOS || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hoy = () => (typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10));
  const ls = { get: k => { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) { } } };
  const lista = () => (typeof L === 'function' ? L() : []);
  const abierto = l => l && l.estado !== 'cerrado';
  const dias = f => { if (!f) return 0; const a = new Date(f + 'T00:00:00'), b = new Date(hoy() + 'T00:00:00'); return Math.max(0, Math.round((b - a) / 864e5)); };
  const catLbl = k => { try { return CATEGORIAS[k] ? CATEGORIAS[k].label : String(k || ''); } catch (_) { return String(k || ''); } };
  const ico = n => { try { return svg(I[n] || I.info); } catch (_) { return ''; } };
  const nombre = () => { try { return String((ROLES[role] || {}).name || '').trim().split(' ')[0]; } catch (_) { return ''; } };
  const cara = h => `<span class="cmp-cara" data-humor="${h || ''}" aria-hidden="true">${M() ? M().svg('cmp-svg', { manos: false }) : ''}</span>`;
  function animarCaras(raiz) {
    if (!M() || !raiz) return;
    raiz.querySelectorAll('.cmp-cara').forEach(c => {
      if (c.dataset.vivo) return; c.dataset.vivo = '1';
      const s = c.querySelector('svg'); if (!s) return;
      try { M().vivir(c); if (c.dataset.humor) M().humor(s, c.dataset.humor, 0); } catch (_) { }
    });
  }

  /* ---------- Estilos ---------- */
  const css = `
  .cmp-cara{width:40px;height:40px;flex-shrink:0;display:inline-grid;place-items:center}
  .cmp-cara svg{width:100%;height:100%}
  .cmp-por{font-size:11.5px;color:var(--tx3);margin:4px 0 0}
  .cmp-x{margin-left:auto;align-self:flex-start;min-height:30px;padding:0 10px;border-radius:999px;border:1px solid var(--line-2);background:transparent;color:var(--tx2);font:500 12px var(--sans);cursor:pointer;flex-shrink:0}
  .cmp-x:hover{color:var(--tx);border-color:var(--amber)}
  .cmp-x:focus-visible,.cmp-it:focus-visible,.cmp-chip:focus-visible{outline:2px solid var(--amber);outline-offset:2px}
  /* 1 · Resumen del turno */
  .home-turno{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;margin:-6px 0 14px;border-radius:16px;background:var(--s1);border:1px solid var(--line)}
  .home-turno.alerta{border-color:color-mix(in srgb,#FF7A85 45%,var(--line))}
  .home-turno.ok{border-color:color-mix(in srgb,var(--green) 40%,var(--line))}
  .ht-cuerpo{flex:1;min-width:0}
  .ht-tit{font:700 10px/1.2 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ice-tx,#8FD9EE)}
  .ht-frase{margin:3px 0 8px;font-size:14px;line-height:1.45;color:var(--tx)}
  .ht-items{display:flex;flex-wrap:wrap;gap:6px}
  .cmp-it{display:inline-flex;align-items:center;gap:7px;min-height:36px;padding:0 12px;border-radius:10px;border:1px solid var(--line-2);background:var(--s2);color:var(--tx);font:500 12.5px var(--sans);cursor:pointer;text-align:left}
  .cmp-it:hover{border-color:var(--amber)}
  .cmp-it svg{width:15px;height:15px;flex-shrink:0;color:var(--c,var(--amber))}
  .cmp-it b{font-weight:700}
  /* 2 · SIMI en el sector */
  .simi-sector{display:flex;gap:10px;align-items:flex-start;margin-top:10px;padding:10px 12px;border-radius:12px;background:color-mix(in srgb,var(--ice,#3FC5E8) 8%,var(--s2));border:1px solid color-mix(in srgb,var(--ice,#3FC5E8) 30%,var(--line))}
  .simi-sector .cmp-cara{width:34px;height:34px}
  .ss-txt{flex:1;font-size:13px;line-height:1.45;color:var(--tx);margin:0}
  /* 3 · SIMI revisa */
  .simi-rev{display:flex;gap:9px;align-items:flex-start;margin-top:10px}
  .simi-rev .cmp-cara{width:30px;height:30px}
  .sr-cuerpo{flex:1;min-width:0}
  .sr-tit{font-size:11.5px;color:var(--tx3);margin:2px 0 5px}
  .sr-chips{display:flex;flex-wrap:wrap;gap:5px}
  .cmp-chip{display:inline-flex;align-items:center;gap:5px;min-height:28px;padding:0 10px;border-radius:999px;font:500 12px var(--sans);border:1px solid var(--line-2);background:transparent;color:var(--tx2);cursor:default}
  .cmp-chip svg{width:13px;height:13px}
  .cmp-chip.ok{color:var(--green-tx,#3DDC97);border-color:color-mix(in srgb,var(--green) 40%,var(--line-2))}
  .cmp-chip.falta{color:var(--amber-tx,#FFB84D);border-color:color-mix(in srgb,var(--amber) 45%,var(--line-2));cursor:pointer}
  .cmp-chip.urge{color:#FF8C95;border-color:color-mix(in srgb,#FF4D5E 50%,var(--line-2))}
  /* 4 · plan propuesto */
  .sp-simi{display:flex;gap:10px;align-items:flex-start;margin-bottom:12px}
  .sp-simi p{margin:0;font-size:13.5px;line-height:1.5;color:var(--tx)}
  .sp-lista{display:flex;flex-direction:column;gap:6px;max-height:52vh;overflow:auto}
  .sp-fila{display:grid;grid-template-columns:auto minmax(0,1.1fr) minmax(0,1.2fr) auto;gap:10px;align-items:center;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--s2)}
  .sp-fila.off{opacity:.5}
  .sp-chk input{width:18px;height:18px;accent-color:var(--amber)}
  .sp-que{display:flex;flex-direction:column;min-width:0}.sp-que span{font-size:11.5px;color:var(--tx3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sp-quien{display:flex;flex-direction:column;gap:2px;min-width:0}.sp-quien select{min-height:34px}.sp-quien small{font-size:10.5px;color:var(--tx3)}
  .sp-fecha{min-height:34px}
  .sp-urg{font:700 9.5px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:#FF8C95;margin-left:4px}
  .sp-hecho{display:flex;flex-direction:column;gap:5px;font-size:13px}
  @media(max-width:620px){.sp-fila{grid-template-columns:auto minmax(0,1fr);}.sp-quien,.sp-fecha{grid-column:2}}
  /* 5 · SIMI en cada sección + onboarding */
  .simi-sec{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;margin:0 0 16px;border-radius:16px;background:var(--s1);border:1px solid color-mix(in srgb,var(--ice,#3FC5E8) 30%,var(--line))}
  .simi-sec.alerta{border-color:color-mix(in srgb,#FF7A85 45%,var(--line))}
  .ss2-cuerpo{flex:1;min-width:0}
  .ss2-txt{margin:3px 0 8px;font-size:14px;line-height:1.45;color:var(--tx)}
  .ss2-acc{display:flex;flex-wrap:wrap;gap:6px}
  .ss2-acc .btn svg{width:14px;height:14px}
  .cmp-foco{position:relative;z-index:2;outline:3px solid var(--amber)!important;outline-offset:4px;border-radius:12px;box-shadow:0 0 0 9999px rgba(0,0,0,.35)!important;transition:outline-offset .2s}
  .simi-onb{position:fixed;z-index:9000;right:20px;bottom:20px;width:min(380px,calc(100vw - 24px));padding:14px 16px 12px;border-radius:18px;background:var(--s1);border:1px solid color-mix(in srgb,var(--amber) 45%,var(--line));box-shadow:0 24px 60px -18px rgba(0,0,0,.6);animation:onbIn .3s ease-out}
  .simi-onb.flota{right:auto;bottom:auto}
  @keyframes onbIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  .onb-cab{display:flex;gap:10px;align-items:center;margin-bottom:6px}
  .onb-paso{font-size:11.5px;color:var(--tx3)}
  .simi-onb h3{margin:4px 0 4px;font-size:16px;font-weight:700;color:var(--tx)}
  .simi-onb p{margin:0 0 10px;font-size:13.5px;line-height:1.5;color:var(--tx2)}
  .onb-ej{display:flex;flex-direction:column;gap:2px;padding:8px 10px;margin-bottom:10px;border-radius:10px;background:color-mix(in srgb,var(--amber) 9%,var(--s2));border:1px dashed color-mix(in srgb,var(--amber) 45%,var(--line));font-size:12.5px;color:var(--tx)}
  .onb-ej b{font:700 10px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--amber-tx,#FFB84D)}
  .onb-pie{display:flex;align-items:center;gap:6px}
  .onb-puntos{display:flex;gap:4px;margin-right:auto}
  .onb-puntos i{width:6px;height:6px;border-radius:50%;background:var(--tx3);opacity:.4}
  .onb-puntos i.on{width:16px;border-radius:3px;background:var(--amber);opacity:1}
  @media(max-width:820px){.simi-onb{left:12px;right:12px;bottom:calc(76px + env(safe-area-inset-bottom));width:auto}.simi-sec{padding:10px 12px}.ss2-txt{font-size:13px}}
  @media(prefers-reduced-motion:reduce){.simi-onb{animation:none}}
  @media(max-width:820px){
    .home-turno{padding:10px 12px;gap:10px;margin-top:-4px}
    .home-turno .cmp-cara{width:34px;height:34px}
    .ht-frase{font-size:13px;margin-bottom:6px}
    .ht-items{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin-right:-12px;padding-right:12px}
    .ht-items::-webkit-scrollbar{display:none}
    .cmp-it{flex-shrink:0;min-height:34px}
  }`;
  const st = document.createElement('style'); st.id = 'simiCompCss'; st.textContent = css; document.head.appendChild(st);

  /* =====================================================================
     1 · RESUMEN DEL TURNO
     ===================================================================== */
  const CLAVE_OCULTO = () => 'sima.turno.oculto.' + (typeof role === 'string' ? role : '');
  function itemsTurno() {
    const r = typeof role === 'string' ? role : '';
    const L0 = lista(), out = [];
    let atr = [], rep = [];
    try { atr = D().atrasadosDe ? D().atrasadosDe() : []; } catch (_) { }
    try { rep = r !== 'mantenimiento' && D().repetidasDe ? D().repetidasDe() : []; } catch (_) { }
    const preg = (q, consulta) => `window.simiAbrirCon&&simiAbrirCon(${JSON.stringify(q).replace(/"/g, '&quot;')},${consulta ? JSON.stringify(consulta).replace(/"/g, '&quot;') : 'null'})`;
    if (r === 'mantenimiento') {
      let mios = [];
      try { mios = L0.filter(l => ['programado', 'en_ejecucion'].includes(l.estado) && (!filtraPorTecnico() || esMiTrabajo(l))); } catch (_) { }
      const paraHoy = mios.filter(l => l.prog && l.prog.fecha && l.prog.fecha <= hoy());
      if (paraHoy.length) out.push({ c: 'var(--amber)', i: 'calendar', t: `<b>${paraHoy.length}</b> trabajo${paraHoy.length > 1 ? 's' : ''} para hoy o vencido${paraHoy.length > 1 ? 's' : ''}`, por: 'tienen fecha programada de hoy o anterior', go: "go('mantenimiento')" });
      else if (mios.length) out.push({ c: 'var(--amber)', i: 'wrench', t: `<b>${mios.length}</b> trabajo${mios.length > 1 ? 's' : ''} asignado${mios.length > 1 ? 's' : ''}`, por: 'están a tu nombre y sin cerrar', go: "go('mantenimiento')" });
    } else if (r === 'calidad') {
      let n = 0; try { n = L0.filter(aValidarCal).length; } catch (_) { }
      if (n) out.push({ c: 'var(--green)', i: 'shield', t: `<b>${n}</b> cierre${n > 1 ? 's' : ''} para validar`, por: 'Mantenimiento e Inspección ya los cerraron', go: "go('calidad')" });
    } else if (r === 'inspeccion' || r === 'vista') {
      const aVer = L0.filter(l => l.estado === 'pendiente_verificacion').length;
      const sinProg = L0.filter(l => l.estado === 'detectado').length;
      let ult = null; try { ult = ultimoCerrado(); } catch (_) { }
      const dRuta = ult && ult.fecha ? dias(String(ult.fecha).slice(0, 10)) : null;
      if (r === 'inspeccion' && dRuta != null && dRuta >= 7) out.push({ c: 'var(--amber)', i: 'route', t: `Hace <b>${dRuta} días</b> que no se cierra una ruta`, por: `la última fue ${esc(ult.id)}`, go: "go('inspeccion');iniciarRecorrido()" });
      if (aVer) out.push({ c: 'var(--green)', i: 'checkCircle', t: `<b>${aVer}</b> trabajo${aVer > 1 ? 's' : ''} para verificar`, por: 'Mantenimiento ya los terminó', go: "go('calidad')" });
      if (sinProg && r === 'inspeccion') out.push({ c: 'var(--ice,#3FC5E8)', i: 'calendar', t: `<b>${sinProg}</b> sin programar · <u>SIMI arma el plan</u>`, por: 'están detectados sin técnico ni fecha: te propongo un plan y vos confirmás', go: 'SIMI_COMP.planSinProgramar()' });
    }
    if (atr.length) out.unshift({ c: '#FF7A85', i: 'alert', t: `<b>${atr.length}</b> muy atrasado${atr.length > 1 ? 's' : ''}`, por: `el peor: ${esc(atr[0].l.id)}, ${esc(atr[0].m.txt)}`, go: preg('¿Qué trabajos están atrasados?', { intent: 'atrasados', estado: 'abiertos' }) });
    if (rep.length) out.push({ c: '#FFB84D', i: 'refresh', t: `<b>${rep.length}</b> punto${rep.length > 1 ? 's' : ''} que se repite${rep.length > 1 ? 'n' : ''}`, por: `${esc(rep[0].l[0].sector)}: ${esc(catLbl(rep[0].l[0].cat))} ${rep[0].n} veces en 120 días`, go: preg('¿Qué no conformidades se repiten?', { intent: 'repetidas' }) });
    return { items: out.slice(0, 3), atr: atr.length };
  }
  function frase(n, atr) {
    const h = new Date().getHours(), nom = nombre();
    const sal = h < 12 ? 'Buen día' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    if (!n) return `${sal}${nom ? ', ' + esc(nom) : ''}. Todo al día por ahora: si querés, arrancá la ruta y yo te acompaño.`;
    if (atr) return `${sal}${nom ? ', ' + esc(nom) : ''}. Hay trabajos que se están quedando: te dejo lo importante de hoy.`;
    return `${sal}${nom ? ', ' + esc(nom) : ''}. Esto es lo que te conviene mirar hoy:`;
  }
  function resumen() {
    const z = $('homeTurno'); if (!z) return;
    let enRuta = false; try { enRuta = !!(recEnCurso && recEnCurso()) && role !== 'mantenimiento'; } catch (_) { }
    if (enRuta || ls.get(CLAVE_OCULTO()) === hoy()) { z.hidden = true; z.innerHTML = ''; return; }
    const { items, atr } = itemsTurno();
    const humor = atr ? 'alerta' : items.length ? '' : 'feliz';
    const firma = items.map(x => x.t).join('|') + humor;
    if (z.dataset.firma === firma && z.innerHTML) return;
    z.dataset.firma = firma;
    z.hidden = false;
    z.className = 'home-turno' + (atr ? ' alerta' : items.length ? '' : ' ok');
    z.setAttribute('aria-label', 'Resumen del turno de SIMI');
    z.innerHTML = `${cara(humor)}
      <div class="ht-cuerpo"><span class="ht-tit">Tu turno con SIMI</span>
        <p class="ht-frase">${frase(items.length, atr)}</p>
        ${items.length ? `<div class="ht-items">${items.map(x => `<button type="button" class="cmp-it" style="--c:${x.c}" title="Te aviso porque ${x.por.replace(/<[^>]+>/g, '')}" onclick="${x.go}">${ico(x.i)}<span>${x.t}</span></button>`).join('')}</div>` : ''}
      </div>
      <button type="button" class="cmp-x" aria-label="Ocultar el resumen hasta mañana" title="Ocultar hasta mañana">Ahora no</button>`;
    z.querySelector('.cmp-x').addEventListener('click', () => { ls.set(CLAVE_OCULTO(), hoy()); z.hidden = true; z.innerHTML = ''; z.dataset.firma = ''; });
    animarCaras(z);
  }

  /* =====================================================================
     2 · SIMI EN EL SECTOR (dentro de «Nuevo hallazgo»)
     ===================================================================== */
  const sectorCallado = new Set();
  let sectorUlt = '';
  function sector() {
    const z = $('simiSector'); if (!z) return;
    let a = '', s = '';
    try { a = capData.area; s = capData.sector; } catch (_) { }
    const k = a + '|' + s;
    if (!a || !s || sectorCallado.has(k)) { z.innerHTML = ''; sectorUlt = ''; return; }
    if (k === sectorUlt && z.innerHTML) return;
    sectorUlt = k;
    const hs = lista().filter(l => l.area === a && l.sector === s);
    const ab = hs.filter(abierto).sort((x, y) => (x.fechaDet || '').localeCompare(y.fechaDet || ''));
    const desde = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
    const cuenta = {};
    hs.filter(l => (l.fechaDet || '') >= desde).forEach(l => { const c = l.cat && l.cat.k ? l.cat.k : l.cat; cuenta[c] = (cuenta[c] || 0) + 1; });
    const top = Object.entries(cuenta).sort((x, y) => y[1] - x[1])[0];
    let txt, por, humor = '';
    if (!hs.length) { txt = `Primera vez que se carga algo en <b>${esc(s)}</b>. Sacá la foto con una referencia del lugar: va a ser la base para las próximas rutas.`; por = 'no hay hallazgos anteriores en este sector'; humor = 'feliz'; }
    else {
      const partes = [];
      partes.push(ab.length ? `<b>${ab.length}</b> abierto${ab.length > 1 ? 's' : ''}${ab[0] && ab[0].fechaDet ? ` (el más viejo, hace ${dias(ab[0].fechaDet)} días)` : ''}` : 'nada abierto');
      txt = `En <b>${esc(s)}</b> hay ${partes.join('')}.`;
      if (top && top[1] >= 2) { txt += ` Lo que más se repite acá es <b>${esc(catLbl(top[0]))}</b> (${top[1]} veces en 120 días): fijate si es lo mismo antes de cargar uno nuevo.`; humor = top[1] >= 3 ? 'alerta' : ''; }
      else if (!ab.length) { txt += ' Buen sector: si está todo bien, marcalo «sin novedad».'; humor = 'feliz'; }
      por = `miré los ${hs.length} hallazgo${hs.length > 1 ? 's' : ''} de este sector`;
    }
    z.innerHTML = `<div class="simi-sector" role="status">${cara(humor)}<div style="flex:1;min-width:0"><p class="ss-txt">${txt}</p><p class="cmp-por">Te aviso porque ${por}.</p></div>
      <button type="button" class="cmp-x" aria-label="No mostrar más para este sector">Ahora no</button></div>`;
    z.querySelector('.cmp-x').addEventListener('click', () => { sectorCallado.add(k); z.innerHTML = ''; });
    animarCaras(z);
  }

  /* =====================================================================
     3 · SIMI REVISA EL HALLAZGO
     ===================================================================== */
  const RX_MEDIDA = /\d|\b(un|una|dos|tres|cuatro|cinco|varios|varias|medio|media)\s+(metro|metros|cm|centimetros|centímetros|panel|paneles|baldosas?|tramos?|mm)\b/i;
  const RX_REF = /\b(puerta|pared|techo|piso|lado|junto|sobre|bajo|debajo|encima|esquina|columna|panel|entrada|salida|fondo|izquierda|derecha|frente|ventana|riel|evaporador|tablero|zocalo|zócalo|marco|pasillo|anden|andén|rampa|escalera|lavamanos|esterilizador|cinta|linea|línea|camara|cámara|antecamara|antecámara|n°|nro|numero|número)\b/i;
  const RX_URGE = /\b(cable(s)? (expuesto|pelado|suelto)s?|chispa|chispas|olor a quemado|electrocu|riesgo (de )?(caida|caída|electrico|eléctrico)|se (puede )?caer|a punto de caer|vidrio roto|gotea sobre (el )?producto|contamina|cuerpo extra(n|ñ)o|fuga de amoniaco|amon[ií]aco|incendio|humo)\b/i;
  let tRev = null;
  function revisar() {
    clearTimeout(tRev);
    tRev = setTimeout(pintarRevision, 350);
  }
  function pintarRevision() {
    const z = $('simiRevisa'), f = $('fDesc'); if (!z || !f) return;
    const t = f.value.trim(), pal = t ? t.split(/\s+/).length : 0;
    if (pal < 2) { z.innerHTML = ''; return; }
    const chips = [];
    if (RX_URGE.test(t)) chips.push({ k: 'urge', i: 'alert', t: 'Parece urgente: avisá también a Mantenimiento por radio' });
    chips.push(RX_MEDIDA.test(t) ? { k: 'ok', i: 'check', t: 'Tiene medida' } : { k: 'falta', i: 'pencil', t: 'Falta la medida (ej.: 30 cm)', foco: ' de unos  cm' });
    chips.push(RX_REF.test(t) ? { k: 'ok', i: 'check', t: 'Tiene referencia' } : { k: 'falta', i: 'pin', t: 'Sumá una referencia (ej.: al lado de la puerta 2)', foco: ', al lado de ' });
    if (pal < 5) chips.push({ k: 'falta', i: 'pencil', t: 'Un poco más de detalle: qué, dónde y cuánto' });
    let foto = null; try { foto = photo; } catch (_) { }
    const fa = $('fotoAviso');
    if (foto && fa && fa.dataset.brillo) chips.push(fa.textContent.trim() ? { k: 'falta', i: 'camera', t: 'Revisá la foto' } : { k: 'ok', i: 'check', t: 'Foto clara' });
    const faltan = chips.filter(c => c.k !== 'ok').length;
    const humor = chips.some(c => c.k === 'urge') ? 'alerta' : faltan ? 'pensando' : 'feliz';
    const firma = chips.map(c => c.k + c.t).join('|');
    if (z.dataset.firma === firma && z.innerHTML) return;
    z.dataset.firma = firma;
    z.innerHTML = `<div class="simi-rev" aria-live="polite">${cara(humor)}<div class="sr-cuerpo">
        <p class="sr-tit">${faltan ? 'SIMI revisó tu hallazgo: con esto Mantenimiento llega con lo justo' : '¡Bien descripto! Mantenimiento va a entenderlo a la primera'}</p>
        <div class="sr-chips">${chips.map((c, i) => c.k === 'falta' && c.foco
          ? `<button type="button" class="cmp-chip falta" data-i="${i}">${ico(c.i)}${esc(c.t)}</button>`
          : `<span class="cmp-chip ${c.k}">${ico(c.i)}${esc(c.t)}</span>`).join('')}</div></div></div>`;
    z.querySelectorAll('button[data-i]').forEach(b => b.addEventListener('click', () => {
      const c = chips[+b.dataset.i]; const ta = $('fDesc'); if (!ta) return;
      ta.value = ta.value.replace(/\s+$/, '') + c.foco;
      ta.focus();
      const pos = c.foco.includes('  cm') ? ta.value.length - 3 : ta.value.length;
      try { ta.setSelectionRange(pos, pos); } catch (_) { }
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }));
    animarCaras(z);
  }


  /* =====================================================================
     4 · FASE 3 · SIMI PROPONE ACCIONES (y espera tu «Sí»)
     ---------------------------------------------------------------------
     «Programá los que están sin programar»: SIMI arma el plan (técnico y
     fecha para cada hallazgo), lo MUESTRA antes de hacer nada, se puede
     destildar o cambiar cada fila, y recién con «Programar» lo ejecuta.
     Después ofrece «Deshacer». Cada fila dice por qué eligió a ese técnico.
       · Técnico: el que más trabajos de esa disciplina resolvió en SIMA
         (afinidad) y menos carga abierta tiene hoy.
       · Fecha: desde el próximo día hábil (hoy si es urgente), sin cargar
         a nadie con más de 3 trabajos por día y sin domingos.
     Lo urgente que se acaba de guardar se propone para hoy.
     ===================================================================== */
  const MAX_DIA = 3;
  const sumar = (f, n) => { const d = new Date(f + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const habil = f => { let x = f; while (new Date(x + 'T12:00:00').getDay() === 0) x = sumar(x, 1); return x; };
  const fCortaLocal = f => { try { return fCorta(f); } catch (_) { return f; } };
  function tecs() { try { return tecnicosDB() || []; } catch (_) { return []; } }
  function cargaDe(email) {
    return lista().filter(l => ['programado', 'en_ejecucion'].includes(l.estado) && l.prog && (l.prog.tecnicos || []).some(t => t.email === email)).length;
  }
  function afinidad(email, disc) {
    return lista().filter(l => l.disc === disc && l.prog && (l.prog.tecnicos || []).some(t => t.email === email)).length;
  }
  function armarPlan(ids, urgentes) {
    const T = tecs(); if (!T.length) return [];
    const carga = {}, porDia = {};
    T.forEach(t => { carga[t.email] = cargaDe(t.email); });
    lista().forEach(l => { if (l.prog && l.prog.fecha && ['programado', 'en_ejecucion'].includes(l.estado)) (l.prog.tecnicos || []).forEach(t => { const k = t.email + '|' + l.prog.fecha; porDia[k] = (porDia[k] || 0) + 1; }); });
    return ids.map(id => (typeof byId === 'function' ? byId(id) : null)).filter(Boolean).map(l => {
      const urg = urgentes && urgentes.includes(l.id);
      const orden = T.map(t => ({ t, af: afinidad(t.email, l.disc), c: carga[t.email] }))
        .sort((a, b) => (b.af * 2 - b.c) - (a.af * 2 - a.c) || a.c - b.c || a.t.n.localeCompare(b.t.n));
      const el = orden[0];
      let f = urg ? hoy() : habil(sumar(hoy(), 1));
      while ((porDia[el.t.email + '|' + f] || 0) >= MAX_DIA) f = habil(sumar(f, 1));
      porDia[el.t.email + '|' + f] = (porDia[el.t.email + '|' + f] || 0) + 1;
      carga[el.t.email]++;
      let disc = ''; try { disc = DISCIPLINAS[l.disc] ? DISCIPLINAS[l.disc].label.toLowerCase() : ''; } catch (_) { }
      const por = el.af ? `resolvió ${el.af} trabajo${el.af > 1 ? 's' : ''}${disc ? ' de ' + disc : ''}` : 'es quien menos carga tiene';
      return { l, email: el.t.email, fecha: f, urg, por: por + ` · ${el.c} abierto${el.c === 1 ? '' : 's'}`, ok: true };
    });
  }
  let PLAN = [], DESHACER = null;
  function filaHtml(x, i) {
    let cat = '', ubic = '';
    try { cat = catOf(x.l.cat).label; ubic = loc(x.l); } catch (_) { }
    return `<div class="sp-fila${x.ok ? '' : ' off'}">
      <label class="sp-chk"><input type="checkbox" ${x.ok ? 'checked' : ''} data-i="${i}" aria-label="Incluir ${esc(x.l.id)}"></label>
      <div class="sp-que"><b>${esc(x.l.id)}${x.urg ? ' <span class="sp-urg">urgente</span>' : ''}</b><span>${esc(cat)} · ${esc(ubic)}</span></div>
      <div class="sp-quien"><select data-t="${i}" aria-label="Técnico para ${esc(x.l.id)}">${tecs().map(t => `<option value="${esc(t.email)}" ${t.email === x.email ? 'selected' : ''}>${esc(t.n)}</option>`).join('')}</select>
        <small>${esc(x.por)}</small></div>
      <input type="date" class="sp-fecha" data-f="${i}" value="${x.fecha}" min="${hoy()}" aria-label="Fecha para ${esc(x.l.id)}">
    </div>`;
  }
  function planProgramar(ids, opc) {
    opc = opc || {};
    try { if (!canEdit()) return; } catch (_) { return; }
    if (!tecs().length) { try { toast('err', 'No hay técnicos', 'Creá usuarios con rol Mantenimiento para esta planta.'); } catch (_) { } return; }
    PLAN = armarPlan(ids, opc.urgentes || []);
    if (!PLAN.length) return;
    const n = PLAN.length;
    showModal(`
      ${mHead('calendar', 'SIMI armó un plan', opc.urgentes && opc.urgentes.length ? 'Para lo urgente que acabás de cargar' : `${n} hallazgo${n > 1 ? 's' : ''} sin programar, del más viejo al más nuevo`)}
      <div class="modal-body sp">
        <div class="sp-simi">${cara(opc.urgentes && opc.urgentes.length ? 'alerta' : 'pensando')}<p>${opc.urgentes && opc.urgentes.length
          ? 'Esto parece urgente: te propongo programarlo para <b>hoy</b> con quien mejor lo resuelve. No hago nada hasta que confirmes.'
          : 'Elegí técnico y fecha para cada uno: el que más resolvió de esa disciplina y con menos carga, sin pasar de 3 trabajos por día. <b>Revisalo: no hago nada hasta que confirmes.</b>'}</p></div>
        <div class="sp-lista" id="spLista">${PLAN.map(filaHtml).join('')}</div>
        <p class="cmp-por">La Orden SAP y la hora se completan después desde cada trabajo. Queda en el historial como «propuesto por SIMI».</p>
      </div>
      <div class="modal-foot">
        <button class="btn btn-quiet" onclick="closeModal()">Ahora no</button>
        <button class="btn btn-primary" id="spGo">${ico('check')} <span id="spGoTxt">Programar ${n}</span></button>
      </div>`, true);
    const L0 = $('spLista');
    const contar = () => { const k = PLAN.filter(x => x.ok).length; $('spGoTxt').textContent = k ? `Programar ${k}` : 'Elegí al menos uno'; $('spGo').disabled = !k; };
    L0.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.i != null) { PLAN[+t.dataset.i].ok = t.checked; t.closest('.sp-fila').classList.toggle('off', !t.checked); }
      if (t.dataset.t != null) { PLAN[+t.dataset.t].email = t.value; PLAN[+t.dataset.t].por = 'elegido por vos'; t.parentElement.querySelector('small').textContent = 'elegido por vos'; }
      if (t.dataset.f != null && t.value) PLAN[+t.dataset.f].fecha = t.value;
      contar();
    });
    $('spGo').addEventListener('click', ejecutarPlan);
    animarCaras($('modal'));
  }
  function ejecutarPlan() {
    const quien = (() => { try { return ROLES[role].name || ''; } catch (_) { return ''; } })();
    const hechos = [];
    PLAN.filter(x => x.ok).forEach(x => {
      const l = x.l; if (!l || l.estado !== 'detectado') return;
      const t = (typeof tecPorEmail === 'function' ? tecPorEmail(x.email) : null); if (!t) return;
      hechos.push({ l, antes: { estado: l.estado, prog: l.prog ? JSON.parse(JSON.stringify(l.prog)) : null, nh: (l.hist || []).length } });
      l.prog = { tecnicos: [{ n: t.n, lg: t.lg || '', email: t.email }], fecha: x.fecha, hora: '08:00', dur: '2 h', by: quien, simi: true };
      l.estado = 'programado';
      (l.hist = l.hist || []).push({ e: 'Programado', by: quien, d: stamp(), n: `${t.lg ? `${t.n} (${t.lg})` : t.n} · ${fFull(x.fecha)} 08:00 hs · propuesto por SIMI` });
    });
    if (!hechos.length) { closeModal(); return; }
    DESHACER = hechos;
    save(); render();
    try { window.dispatchEvent(new CustomEvent('sima:celebrar', { detail: { tipo: 'plan' } })); } catch (_) { }
    showModal(`
      ${mHead('checkCircle', 'Listo', `Programé ${hechos.length} trabajo${hechos.length > 1 ? 's' : ''}`)}
      <div class="modal-body sp">
        <div class="sp-simi">${cara('feliz')}<p>Ya aparecen en «Mis trabajos» de cada técnico. Si algo no te cierra, lo deshago ahora.</p></div>
        <div class="sp-hecho">${hechos.map(h => `<div><b>${esc(h.l.id)}</b> → ${esc(h.l.prog.tecnicos[0].n)} · ${esc(fCortaLocal(h.l.prog.fecha))}</div>`).join('')}</div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-quiet" id="spUndo">${ico('undo')} Deshacer</button>
        <button class="btn btn-primary" onclick="closeModal()">Listo</button>
      </div>`);
    animarCaras($('modal'));
    $('spUndo').addEventListener('click', deshacerPlan);
  }
  function deshacerPlan() {
    if (!DESHACER) return;
    DESHACER.forEach(h => { h.l.estado = h.antes.estado; h.l.prog = h.antes.prog; if (h.l.hist) h.l.hist.length = h.antes.nh; });
    const n = DESHACER.length; DESHACER = null;
    save(); closeModal(); render();
    try { toast('info', 'Plan deshecho', `${n} trabajo${n > 1 ? 's' : ''} volvieron a «sin programar».`); } catch (_) { }
  }
  function sinProgramarIds(max) {
    return lista().filter(l => l.estado === 'detectado').sort((a, b) => (a.fechaDet || '').localeCompare(b.fechaDet || '')).slice(0, max || 8).map(l => l.id);
  }


  /* =====================================================================
     5 · SIMI EN CADA SECCIÓN + ONBOARDING (11-11-26)
     ---------------------------------------------------------------------
     Arriba de cada sección SIMI deja UN dato útil de esa pantalla, calculado
     con los datos reales, con una acción concreta y «¿Cómo funciona?».
     La primera vez que alguien entra a una sección, SIMI la recorre con él:
     resalta cada parte y da un ejemplo de uso (en el Calendario, cómo fijar
     una fecha tentativa). Se puede repetir desde la barra.
     ===================================================================== */
  const NOMBRE_SEC = { nfc: 'Equipos NFC', iot: 'Monitoreo 5.0', analisis: 'Dashboard', inspeccion: 'Inspección', mantenimiento: 'Mantenimiento', calendario: 'Calendario', calidad: 'Control de Calidad', config: 'Configuración' };
  const vistaAct = () => (typeof view === 'string' ? view : '');
  const rolAct = () => (typeof role === 'string' ? role : '');
  const LLAVE_SEC = v => 'sima.simisec.' + rolAct() + '.' + v;
  const LLAVE_ONB = v => 'sima.onb.' + rolAct() + '.' + v;
  const nombreSec = v => (rolAct() === 'mantenimiento' && v === 'mantenimiento') ? 'Mis trabajos' : (rolAct() === 'inspeccion' && v === 'calidad') ? 'Verificación y Control' : NOMBRE_SEC[v] || v;
  const fx = f => { try { return fCorta(f); } catch (_) { return f; } };
  const aj = s => JSON.stringify(s).replace(/"/g, '&quot;');

  function datoSeccion(v) {
    // Módulos 2 y 3 (en preparación): SIMI explica qué puede hacer hoy.
    if (v === 'nfc' && window.SIMA_NFC && SIMA_NFC.activo()) {
      const al = SIMA_NFC.alertas();
      return al.length
        ? { t: `${al[0].t}. ${al[0].d}`, h: al[0].nivel === 'crit' ? 'alerta' : '', acc: { t: 'Ver equipo', go: `SIMA_NFC.abrir('${al[0].eq}')` } }
        : { t: 'Los 6 equipos tienen el plan al día. Tocá cualquiera para ver su ficha, su plan y su historial.', h: 'feliz' };
    }
    if (v === 'nfc') return 'NDEFReader' in window
      ? { t: 'Este módulo está en preparación, pero ya podés probar algo real: tu celular <b>puede leer NFC</b>. Apoyá una tarjeta o un tag y te muestro lo que lee.', h: 'feliz', acc: { t: 'Probar lector NFC', go: "probarNfc()" } }
      : { t: 'Este módulo está en preparación. Para leer las placas NFC hace falta un <b>celular Android con Chrome</b>; en iPhone y en computadora vamos a usar el código QR de la placa.', h: '' };
    if (v === 'iot') {
      if (!window.SIMA_IOT || !SIMA_IOT.activo()) return { t: 'La conexión con el Grafana de la planta está pendiente. Abajo está lo que hace falta pedirle a Sistemas para que empiece a llegar la información.', h: '' };
      const al = SIMA_IOT.alarmas();
      return al.length
        ? { t: `Hay <b>${al.length}</b> ${al.length > 1 ? 'alarmas activas' : 'alarma activa'}. Te digo qué revisar en cada una y aviso a quien corresponde si nadie la reconoce.`, h: 'alerta', acc: { t: '¿Qué reviso?', go: 'SIMA_IOT.revisarAlarmas()' } }
        : { t: 'Todo en rango. Sigo las tendencias de cada equipo y te aviso <b>antes</b> de que algo salga de rango. Tocá cualquier equipo para preguntarme.', h: 'feliz', acc: { t: 'Resumen del turno', go: 'SIMA_IOT.resumenTurno()' } };
    }
    const L0 = lista(), r = rolAct();
    const ab = L0.filter(abierto);
    const top = (arr, k) => { const m = {}; arr.forEach(l => { const x = l[k]; if (typeof x === 'string' && x) m[x] = (m[x] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1])[0]; };
    if (v === 'analisis') {
      if (!ab.length) return { t: 'No hay hallazgos abiertos en esta planta. Buen momento para planificar la próxima ruta.', h: 'feliz' };
      const ta = top(ab, 'area'); let areaLbl = ta ? ta[0] : ''; try { areaLbl = AREAS[ta[0]].label; } catch (_) { }
      let venc = 0; try { venc = tentVencidas().length; } catch (_) { }
      return { t: `El área con más abiertos es <b>${esc(areaLbl)}</b> (${ta[1]} de ${ab.length}).${venc ? ` <b>${venc}</b> ya pasaron su fecha tentativa.` : ''}`, h: venc ? 'alerta' : '',
        acc: { t: '¿Qué tipo se repite más?', go: `simiAbrirCon(null,${aj({ intent: 'ranking', dim: 'tipo', estado: 'abiertos' })})` } };
    }
    if (v === 'inspeccion') {
      let rc = null; try { rc = recEnCurso(); } catch (_) { }
      if (rc) { const n = L0.filter(l => l.rec === rc.id).length; return { t: `Ruta <b>${esc(rc.id)}</b> en curso con <b>${n}</b> hallazgo${n === 1 ? '' : 's'}. Cargá cada cosa que encuentres con foto; lo que esté bien, marcalo «sin novedad».`, h: '' }; }
      const ts = top(ab, 'sector');
      if (!ts) return { t: 'Sin hallazgos abiertos. Cuando arranques la ruta, te acompaño sector por sector.', h: 'feliz' };
      return { t: `El sector con más abiertos es <b>${esc(ts[0])}</b> (${ts[1]}). Conviene mirarlo primero en la próxima ruta.`, h: '',
        acc: { t: `Ver ${esc(ts[0])}`, go: `simiVerLista(${aj({ sector: ts[0], estado: 'abiertos' })})` } };
    }
    if (v === 'mantenimiento') {
      if (r === 'mantenimiento') {
        let mios = []; try { mios = L0.filter(l => ['programado', 'en_ejecucion'].includes(l.estado) && (!filtraPorTecnico() || esMiTrabajo(l))); } catch (_) { }
        mios.sort((a, b) => ((a.prog && a.prog.fecha) || '9').localeCompare((b.prog && b.prog.fecha) || '9'));
        const x = mios[0];
        if (!x) return { t: 'No tenés trabajos asignados. Cuando el Inspector te programe uno, aparece acá.', h: 'feliz' };
        let cat = ''; try { cat = catOf(x.cat).label; } catch (_) { }
        return { t: `Tu próximo trabajo: <b>${esc(x.id)}</b> · ${esc(cat)} en ${esc(x.sector || '')}${x.prog && x.prog.fecha ? `, para el ${esc(fx(x.prog.fecha))}` : ''}. Al terminar, cerralo con la foto del después.`, h: '',
          acc: { t: 'Abrir', go: `openDetalle('${x.id}')` } };
      }
      const sp = L0.filter(l => l.estado === 'detectado').length;
      if (!sp) return { t: 'Todo lo detectado ya tiene técnico y fecha. 👌', h: 'feliz' };
      return { t: `<b>${sp}</b> hallazgo${sp > 1 ? 's esperan' : ' espera'} técnico y fecha. Puedo armarte un plan y vos confirmás.`, h: '',
        acc: r === 'inspeccion' ? { t: 'SIMI arma el plan', go: 'SIMI_COMP.planSinProgramar()' } : null };
    }
    if (v === 'calendario') {
      let ve = 0, pv = 0, st = 0; try { ve = tentVencidas().length; pv = tentPorVencer().length; st = sinTentativa().length; } catch (_) { }
      const p = [];
      if (ve) p.push(`<b>${ve}</b> tentativa${ve > 1 ? 's' : ''} vencida${ve > 1 ? 's' : ''}`);
      if (pv) p.push(`<b>${pv}</b> por vencer`);
      if (st) p.push(`<b>${st}</b> sin fecha tentativa`);
      return { t: p.length ? `Tenés ${p.join(', ')}. Arrastrá un hallazgo a un día o tildá varios para fijarles la fecha juntos.` : 'Todas las fechas tentativas están al día.', h: ve ? 'alerta' : p.length ? '' : 'feliz',
        acc: { t: 'Cómo fijar una tentativa', go: "SIMI_COMP.onboarding('calendario',true)" } };
    }
    if (v === 'calidad') {
      let pend = [];
      try { pend = r === 'calidad' ? L0.filter(aValidarCal) : L0.filter(l => l.estado === 'pendiente_verificacion'); } catch (_) { }
      if (!pend.length) return { t: r === 'calidad' ? 'No hay cierres para validar. Cuando el Inspector cierre un trabajo, aparece acá.' : 'No hay trabajos esperando tu verificación.', h: 'feliz' };
      const viejo = pend.slice().sort((a, b) => (a.fechaDet || '').localeCompare(b.fechaDet || ''))[0];
      return { t: `<b>${pend.length}</b> ${r === 'calidad' ? 'cierre' + (pend.length > 1 ? 's esperan' : ' espera') + ' tu validación' : 'trabajo' + (pend.length > 1 ? 's esperan' : ' espera') + ' tu verificación'}. El más viejo es <b>${esc(viejo.id)}</b>, detectado hace ${dias(viejo.fechaDet)} días. Compará el antes y el después.`, h: '',
        acc: { t: `Abrir ${esc(viejo.id)}`, go: `openDetalle('${viejo.id}')` } };
    }
    if (v === 'config') return { t: 'Acá se arma la estructura de la planta y los usuarios. Tip: un técnico sólo aparece al programar si tiene marcada esta planta.', h: '' };
    return null;
  }
  function seccion() {
    const v = vistaAct(); if (!NOMBRE_SEC[v]) return;
    const raiz = $('mainInner'); if (!raiz || $('simiSeccion')) return;
    if (ls.get(LLAVE_SEC(v)) === hoy()) return;
    let d = null; try { d = datoSeccion(v); } catch (_) { }
    if (!d) return;
    const div = document.createElement('section');
    div.id = 'simiSeccion'; div.className = 'simi-sec' + (d.h === 'alerta' ? ' alerta' : '');
    div.setAttribute('aria-label', 'SIMI en ' + nombreSec(v));
    div.innerHTML = `${cara(d.h)}<div class="ss2-cuerpo"><span class="ht-tit">SIMI · ${esc(nombreSec(v))}</span><p class="ss2-txt">${d.t}</p>
      <div class="ss2-acc">${d.acc ? `<button type="button" class="btn btn-sm btn-primary" onclick="${d.acc.go}">${d.acc.t}</button>` : ''}
        <button type="button" class="btn btn-sm btn-ghost" onclick="SIMI_COMP.onboarding('${v}',true)">${ico('info')} ¿Cómo funciona esta sección?</button></div></div>
      <button type="button" class="cmp-x" aria-label="Ocultar hasta mañana">Ahora no</button>`;
    div.querySelector('.cmp-x').addEventListener('click', () => { ls.set(LLAVE_SEC(v), hoy()); div.remove(); });
    const cab = raiz.querySelector('.view-head');
    if (cab && cab.parentNode) cab.parentNode.insertBefore(div, cab.nextSibling); else raiz.prepend(div);
    animarCaras(div);
  }

  /* ---------- Onboarding por sección ---------- */
  const ONB = {
    nfc: [
      { sel: '.mx-head', t: 'Seguimiento de equipos', d: 'Cada equipo tiene una placa NFC: al apoyar el celular se abre su ficha, su historial y sus controles.', ej: 'Apoyás el celular en la vaciadora y ves su plan de mantenimiento.' },
      { sel: '#nfcAl', t: 'SIMI sigue el plan', d: 'Te aviso lo que vence, lo que se atrasó y los patrones de falla, y lo resolvés desde el aviso: programar, pedir el repuesto o registrar.', ej: '«Cambio de filtro de la vaciadora el sábado 14/11: ¿ya tenemos filtros?»' },
      { sel: '.eq-grid', t: 'Cada equipo', d: 'Estado, horas de uso y el próximo mantenimiento con su barra de avance. Tocá uno para ver el modelo 3D, el plan, el historial y la ficha técnica.', ej: 'La barra se pone naranja cuando faltan menos de 3 días.' },
      { sel: '.nfc-prueba', t: 'Probá tu celular', d: 'Tocá «Probar lector NFC» y apoyá una tarjeta o un tag: te digo si tu equipo sirve para el piloto.', ej: 'Una tarjeta de colectivo o de acceso sirve para probar.' },
      { sel: '#modPill', t: 'Cambiar de módulo', d: 'Desde acá volvés a la Ruta de inspección o vas al monitoreo en tiempo real.', ej: 'Tocá «Módulo 2» para ver los tres módulos.' }],
    iot: [
      { sel: '#iotTabs', t: 'En vivo, histórico y alarmas', d: 'En vivo ves cada equipo; en Histórico, cualquier día desde el lunes 9/11; en Alarmas, quién fue avisado y cuándo.', ej: 'Histórico › Cámara 3 › martes: el gráfico marca en rojo cada desvío.' },
      { sel: '#iotIns', t: 'SIMI analiza', d: 'Predigo cuándo un equipo va a salir de rango, detecto consumos fuera de lo habitual, busco la causa probable y sugiero mantenimiento con el histórico.', ej: '«Túnel 2 tarda 15 % más en bajar» → Crear trabajo.' },
      { sel: '#iotCam', t: 'Cada equipo', d: 'Valor actual, rango y la última media hora. Una alarma salta sólo si el desvío se sostiene; descongelamientos y cargas de túnel no alarman.', ej: 'Tocá una cámara y te digo cómo está y qué revisar.' }],
    analisis: [
      { sel: '.view-head', t: 'El tablero de la planta', d: 'Acá ves cómo viene todo: abiertos, cerrados, plazos y avance por área.', ej: 'Mirá el porcentaje de plazos cumplidos antes de la reunión semanal.' },
      { sel: '.pkg-grid, .pkg', t: 'Cada área en una tarjeta', d: 'Tocá un área para ver su detalle: qué hay abierto y en qué estado.', ej: 'Tocá «Área Fría» y ves sólo sus hallazgos.' },
      { sel: '.chart-card, .duo-card', t: 'Gráficos que se leen solos', d: 'Los colores son los estados: detectado, programado, en ejecución, a verificar y cerrado.', ej: 'Si la barra naranja crece, hay mucho sin programar.' },
      { sel: null, t: 'Preguntame lo que no veas', d: 'Si querés un número puntual, preguntámelo y lo calculo con tus datos.', ej: '«¿Qué técnico tiene más trabajos abiertos?»' }],
    inspeccion: [
      { sel: '.view-head', t: 'Todos los hallazgos', d: 'Acá están los hallazgos de la planta y las rutas cerradas.', ej: 'Usá la búsqueda para encontrar «LV-5010» o «puerta».' },
      { sel: '.tabs', t: 'Hallazgos o rutas', d: 'Cambiá entre la lista de hallazgos y el historial de rutas cerradas, con su PDF y Excel.', ej: 'En «Rutas cerradas» descargás el PDF para la auditoría.' },
      { sel: '.pkg-grid, .date-group-head', t: 'Agrupados para no perderte', d: 'Se agrupan por área y por fecha; tocá uno para ver la foto, el historial y las acciones.', ej: 'Un hallazgo arrastrado viene de una ruta anterior sin resolver.' },
      { sel: null, t: 'La ruta se hace desde Inicio', d: 'Para recorrer, tocá «Comenzar la ruta» en Inicio. Mientras cargás, yo reviso la foto y la descripción.', ej: 'Dictá: «fisura de 30 cm en el panel al lado de la puerta 2».' }],
    mantenimiento: [
      { sel: '.view-head', t: 'Trabajos de mantenimiento', d: 'Acá se programa cada hallazgo con técnico, fecha y Orden SAP, y se sigue su ejecución.', ej: 'Lo detectado espera técnico; lo programado ya está en la agenda.' },
      { sel: '.tabs', t: 'Por estado', d: 'Las pestañas separan lo que falta programar, lo programado y lo que está en ejecución.', ej: 'Empezá por «sin programar», del más viejo al más nuevo.' },
      { sel: '.tbl-wrap, .cards, .lev', t: 'Cada trabajo con su acción', d: 'Desde cada fila programás, cargás la Orden SAP o ves el detalle.', ej: 'Programar: elegí técnico, fecha 08:00 y duración estimada.' },
      { sel: null, t: 'Te puedo armar el plan', d: 'Si hay muchos sin programar, armo un plan con técnico y fecha para cada uno. Vos lo revisás y confirmás.', ej: 'En la barra de arriba: «SIMI arma el plan».' }],
    calendario: [
      { sel: '.cal-capas', t: 'Qué querés ver', d: 'Prendé o apagá las capas: rutas, fechas tentativas y trabajos programados a técnicos.', ej: 'Apagá «Programados» para ver sólo los compromisos tentativos.' },
      { sel: '.sin-list, .cal-side', t: 'Hallazgos sin fecha tentativa', d: 'Acá están los que todavía no tienen compromiso de ejecución. Tildá uno o varios.', ej: 'Tildá LV-5005 y LV-5010: los dos van a recibir la misma fecha.' },
      { sel: '.cal-grid:not(.cal-head)', t: 'Elegí el día', d: 'Arrastrá el hallazgo (o los tildados) a un día del mes y confirmá. También podés tocar el día y usar «Fijar tentativa».', ej: 'Arrastrá LV-5005 al jueves 14: queda «tentativa 14/11».' },
      { sel: '.cal-alerta, .cal-ley', t: 'Te aviso antes de vencer', d: 'Dos días antes la fecha se pone naranja; si vence, roja. Si hay que moverla, se guarda el motivo para el PDF.', ej: 'Reprogramar por «Falta de repuesto» deja el respaldo para la auditoría.' }],
    calidad: [
      { sel: '.view-head', t: 'El control final', d: 'Acá se comprueba que cada arreglo quedó bien antes de liberar el punto.', ej: 'Nada se libera sin comparar el antes y el después.' },
      { sel: '.cards, .lev', t: 'Antes y después lado a lado', d: 'Cada tarjeta muestra la foto del problema y la del arreglo, con quién y cuándo lo hizo.', ej: 'Si la silicona nueva tiene huecos, rechazalo con el motivo.' },
      { sel: null, t: 'Aceptar o rechazar con motivo', d: 'Aceptar deja el registro con tu nombre y fecha; rechazar vuelve el trabajo con el motivo para que no se repita.', ej: 'Motivo: «terminación porosa, no es lavable».' }],
    config: [
      { sel: '.cfg-tabs, .tabs', t: 'Configuración', d: 'Estructura de la planta (áreas, sectores, subsectores) y usuarios.', ej: 'Agregá un subsector nuevo cuando se habilite una cámara.' },
      { sel: '.cfg-card', t: 'Cambios con cuidado', d: 'Lo que cambies acá se ve en la carga de hallazgos y en los reportes.', ej: 'Renombrar un sector no cambia los hallazgos ya cargados.' }]
  };
  let ONB_EST = null;
  const visible = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  function onboarding(v, forzado) {
    v = v || vistaAct(); const pasos0 = ONB[v]; if (!pasos0) return;
    if (!forzado && (ls.get(LLAVE_ONB(v)) || ls.get('sima.onb.todo'))) return;
    cerrarOnb();
    const pasos = pasos0.map(p => ({ ...p, el: p.sel ? [...document.querySelectorAll('#mainInner ' + p.sel.split(',').join(', #mainInner '))].find(visible) : null }))
      .filter(p => !p.sel || p.el);
    if (!pasos.length) return;
    ONB_EST = { v, pasos, i: 0 };
    ls.set(LLAVE_ONB(v), '1');
    pintarOnb();
  }
  function cerrarOnb() {
    document.querySelectorAll('.cmp-foco').forEach(x => x.classList.remove('cmp-foco'));
    const o = $('simiOnb'); if (o) o.remove();
    ONB_EST = null;
  }
  function pintarOnb() {
    const E = ONB_EST; if (!E) return;
    const p = E.pasos[E.i], n = E.pasos.length;
    document.querySelectorAll('.cmp-foco').forEach(x => x.classList.remove('cmp-foco'));
    let o = $('simiOnb');
    if (!o) { o = document.createElement('div'); o.id = 'simiOnb'; o.className = 'simi-onb'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-labelledby', 'simiOnbT'); document.body.appendChild(o); }
    o.innerHTML = `<div class="onb-cab">${cara(E.i === n - 1 ? 'feliz' : '')}<div><span class="ht-tit">SIMI te muestra · ${esc(nombreSec(E.v))}</span><div class="onb-paso">${E.i + 1} de ${n}</div></div>
        <button type="button" class="cmp-x onb-x" aria-label="Cerrar la guía">Saltar</button></div>
      <h3 id="simiOnbT">${esc(p.t)}</h3><p>${esc(p.d)}</p>
      ${p.ej ? `<div class="onb-ej"><b>Ejemplo</b><span>${esc(p.ej)}</span></div>` : ''}
      <div class="onb-pie"><div class="onb-puntos">${E.pasos.map((_, k) => `<i class="${k === E.i ? 'on' : ''}"></i>`).join('')}</div>
        ${E.i ? '<button type="button" class="btn btn-sm btn-ghost onb-ant">Anterior</button>' : ''}
        <button type="button" class="btn btn-sm btn-primary onb-sig">${E.i === n - 1 ? '¡Listo!' : 'Siguiente'}</button></div>`;
    o.querySelector('.onb-x').onclick = cerrarOnb;
    o.querySelector('.onb-sig').onclick = () => { if (E.i < n - 1) { E.i++; pintarOnb(); } else cerrarOnb(); };
    const a = o.querySelector('.onb-ant'); if (a) a.onclick = () => { E.i--; pintarOnb(); };
    animarCaras(o);
    // Posición: junto al elemento en PC; abajo como hoja en el celular.
    o.classList.remove('flota'); o.style.top = o.style.left = '';
    if (p.el) {
      p.el.classList.add('cmp-foco');
      try { p.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) { }
      if (innerWidth > 820) setTimeout(() => {
        if (!document.body.contains(o)) return;
        const r = p.el.getBoundingClientRect(), ow = o.offsetWidth, oh = o.offsetHeight;
        let top, left;
        const alto = r.height > innerHeight * 0.45 || (r.bottom + oh + 12 > innerHeight && r.top - oh - 12 < 0);
        if (alto) {
          // Elemento alto (una columna o la grilla): el globo va al costado, sin taparlo.
          top = Math.min(Math.max(12, r.top), innerHeight - oh - 12);
          left = r.left - ow - 16 >= 12 ? r.left - ow - 16 : Math.min(r.right + 16, innerWidth - ow - 12);
        } else {
          top = r.bottom + 12; if (top + oh > innerHeight - 12) top = Math.max(12, r.top - oh - 12);
          left = Math.min(Math.max(12, r.left), innerWidth - ow - 12);
        }
        o.classList.add('flota'); o.style.top = top + 'px'; o.style.left = left + 'px';
      }, 420);
    }
    setTimeout(() => { const b = o.querySelector('.onb-sig'); if (b) b.focus({ preventScroll: true }); }, 60);
  }
  document.addEventListener('keydown', e => {
    if (!ONB_EST) return;
    if (e.key === 'Escape') { e.stopPropagation(); cerrarOnb(); }
    else if (e.key === 'ArrowRight') { const b = document.querySelector('#simiOnb .onb-sig'); if (b) b.click(); }
    else if (e.key === 'ArrowLeft') { const b = document.querySelector('#simiOnb .onb-ant'); if (b) b.click(); }
  }, true);
  function trasRender() {
    const v = vistaAct();
    if (ONB_EST && ONB_EST.v !== v) cerrarOnb();
    seccion();
    if (NOMBRE_SEC[v] && !ls.get(LLAVE_ONB(v)) && !ls.get('sima.onb.todo')) setTimeout(() => {
      const ov = document.getElementById('overlay');
      if (vistaAct() !== v || $('simaTour') || ONB_EST || (ov && ov.classList.contains('show'))) return;
      onboarding(v, false);
    }, 900);
  }

  /* ---------- Enganches con SIMA ---------- */
  function envolver(nombre, despues) {
    const f = window[nombre];
    if (typeof f !== 'function' || f.__cmp) return false;
    const n = function () { const r = f.apply(this, arguments); try { despues(); } catch (_) { } return r; };
    n.__cmp = true; window[nombre] = n; return true;
  }
  function enganchar() {
    envolver('pintarUbic', sector);
    envolver('validarCaptura', revisar);
    envolver('alEscribirDesc', revisar);
    // Fase 3: lo urgente recién guardado → SIMI propone programarlo para hoy.
    const g = window.guardarLevantamiento;
    if (typeof g === 'function' && !g.__cmp) {
      const n = function () {
        const antes = new Set(lista().map(l => l.id));
        const txt = (($('fDesc') || {}).value || '');
        let urgIA = false; try { urgIA = !!(iaSug && iaSug.urgente); } catch (_) { }
        const r = g.apply(this, arguments);
        const nuevos = lista().filter(l => !antes.has(l.id) && l.estado === 'detectado').map(l => l.id);
        if (nuevos.length && (urgIA || RX_URGE.test(txt))) setTimeout(() => { if (!$('modal') || !document.getElementById('overlay').classList.contains('show')) planProgramar(nuevos, { urgentes: nuevos }); }, 900);
        return r;
      };
      n.__cmp = true; window.guardarLevantamiento = n;
    }
    envolver('render', () => setTimeout(trasRender, 60));
    envolver('openCaptura', () => { sectorUlt = ''; sectorCallado.clear(); setTimeout(() => { sector(); revisar(); }, 50); });
  }
  enganchar();
  addEventListener('DOMContentLoaded', enganchar);
  addEventListener('load', () => { enganchar(); resumen(); });
  // Inicio se redibuja con cada render(): se vuelve a llenar #homeTurno.
  new MutationObserver(() => {
    const z = $('homeTurno');
    if (z && !z.dataset.firma && !z.hidden) resumen();
    const r = $('simiRevisa'); if (r && !r.dataset.obs) { r.dataset.obs = '1'; revisar(); }
  }).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('sima:auth', () => setTimeout(resumen, 600));
  addEventListener('sima:sync', () => { const z = $('homeTurno'); if (z) { z.dataset.firma = ''; resumen(); } });

  window.SIMI_COMP = { onboarding, cerrarOnb, seccion, datoSeccion, resumen, sector, revisar: pintarRevision, itemsTurno, planProgramar, planSinProgramar: () => planProgramar(sinProgramarIds(8)), deshacerPlan };
})();
