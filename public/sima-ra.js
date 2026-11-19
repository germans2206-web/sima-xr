/* =====================================================================
   SIMA RA · Ruta de inspección con realidad aumentada  (v2 · 19-11-26)
   ---------------------------------------------------------------------
   Lenguaje visual: señalética de seguridad industrial (ISO 7010). Cada no
   conformidad (NC) es una TARJETA COLGANTE de inspección, como las de
   bloqueo y etiquetado de la planta:
     rojo      Pendiente     (detectado)
     amarillo  Programada    (programado · en ejecución · a verificar)
     verde     Resuelta      (cerrado)
   La tarjeta dice el número, el tipo, cuántos días lleva abierta, la fecha
   programada o de cierre y, con franjas negras y amarillas, si REINCIDE en
   el mismo lugar. Además del color, cambia la forma (círculo, rombo, tilde)
   para que se distinga sin depender del color.

   1. MARCAR NC EN RA     SIMA_RA.marcar(recId)
      · Android + Chrome: WebXR immersive-ar con hit-test. Pin sobre la
        superficie; se ven también las tarjetas de las NC que ya existen ahí.
      · iPhone / PC: modo cámara, pin sobre la foto (queda como evidencia).
      · SIMI avisa en vivo si en ese lugar ya hubo NC (reincidencia).
   2. BUSCAR NC CON LA CÁMARA   SIMA_RA.radar(focoId?)
      · Android + Chrome: tarjetas 3D FIJAS EN EL MUNDO (ancladas por GPS +
        brújula), con poste y aro en el piso donde se levantó la falla.
      · Resto: tarjetas sobre la cámara, suavizadas, más un radar de bolsillo.
      · Tocar una tarjeta abre su resumen y la ficha.
   3. MAPA DE NC   vista «mapa» (todos los roles)
      Mapa interactivo (arrastrar, pellizcar, rueda) con filtros Pendientes /
      Programadas / Resueltas / Reincidencias, tu posición y «Ir hasta la NC».
   ===================================================================== */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const e = s => (typeof esc === 'function' ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const aviso = (t, a, b) => { if (typeof toast === 'function') toast(t, a, b); };
  const REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const vibrar = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {} };

  /* ---------- Estados → grupos de la señalética ------------------------ */
  const GRUPOS = {
    pendiente:  { t: 'Pendiente',  plural: 'Pendientes',  c: '#E5352B', tx: '#FFFFFF', forma: 'circulo', estados: ['detectado'] },
    programado: { t: 'Programada', plural: 'Programadas', c: '#F2B705', tx: '#14130F', forma: 'rombo',   estados: ['programado', 'en_ejecucion', 'pendiente_verificacion'] },
    resuelto:   { t: 'Resuelta',   plural: 'Resueltas',   c: '#1E9E5A', tx: '#FFFFFF', forma: 'tilde',   estados: ['cerrado'] }
  };
  const grupoDe = st => Object.keys(GRUPOS).find(k => GRUPOS[k].estados.includes(st)) || 'pendiente';
  const estadoTxt = st => (typeof ESTADOS !== 'undefined' && ESTADOS[st]) ? ESTADOS[st].label : st;
  const catTxt = l => (!l.cat ? '' : typeof catOf === 'function' ? catOf(l.cat).label : l.cat);
  const lugarTxt = l => (typeof loc === 'function' ? loc(l) : [l.sector, l.subsector].filter(Boolean).join(' › '));
  const hoyISO = () => (typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10));
  const diasEntre = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 864e5));
  const fCorta = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${+m[3]}/${+m[2]}` : ''; };
  function fechaCierre(l) {
    if (l.val && l.val.fecha) return String(l.val.fecha).slice(0, 10);
    const h = (l.hist || []).slice().reverse().find(x => x && /cerr|verific/i.test(x.e || ''));
    return h && h.d ? String(h.d).slice(0, 10) : '';
  }
  /* Lo que dice la tarjeta. */
  function ficha(l) {
    const g = grupoDe(l.estado), G = GRUPOS[g];
    let dias, diasTxt, extra = '';
    if (g === 'resuelto') {
      const fc = fechaCierre(l);
      dias = fc ? diasEntre(l.fechaDet, fc) : null;
      diasTxt = dias == null ? 'Resuelta' : `Estuvo abierta ${dias} ${dias === 1 ? 'día' : 'días'}`;
      if (fc) extra = 'Cerrada el ' + fCorta(fc);
    } else {
      dias = diasEntre(l.fechaDet || hoyISO(), hoyISO());
      diasTxt = dias === 0 ? 'Abierta hoy' : `Abierta hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
      const fp = (l.tent && l.tent.fecha) || (l.prog && l.prog.fecha);
      if (g === 'programado' && fp) extra = (l.estado === 'en_ejecucion' ? 'En ejecución · ' : l.estado === 'pendiente_verificacion' ? 'A verificar · ' : 'Programada para el ') + fCorta(fp);
      else if (g === 'programado') extra = estadoTxt(l.estado);
      else extra = 'Sin programar';
    }
    const rep = reincidenciasDe(l).length;
    return { id: l.id, cat: catTxt(l), lugar: lugarTxt(l), g, G, dias, diasTxt, extra, rep, estado: estadoTxt(l.estado) };
  }

  /* ---------- Geometría ------------------------------------------------ */
  const R_T = 6371000;
  const rad = d => d * Math.PI / 180, grad = r => r * 180 / Math.PI;
  const norm360 = a => ((a % 360) + 360) % 360;
  const difAng = (a, b) => { let d = norm360(a - b); if (d > 180) d -= 360; return d; };
  function distancia(a, b) {
    const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R_T * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function rumbo(a, b) {
    const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
    const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
    return norm360(grad(Math.atan2(y, x)));
  }
  function destino(p, rumboG, dist) {
    const dLat = dist * Math.cos(rad(rumboG)) / 111320;
    const dLon = dist * Math.sin(rad(rumboG)) / (111320 * Math.cos(rad(p.lat)) || 1);
    return { lat: +(p.lat + dLat).toFixed(7), lon: +(p.lon + dLon).toFixed(7) };
  }
  const fmtM = m => m == null ? '—' : (m < 1 ? 'menos de 1 m' : m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km');
  const fmtC = n => (+n).toFixed(6);
  const PUNTOS = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
  const PUNTOS_C = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const cardinal = g => PUNTOS[Math.round(norm360(g) / 45) % 8];
  const cardinalC = g => PUNTOS_C[Math.round(norm360(g) / 45) % 8];

  /* ---------- Datos ---------------------------------------------------- */
  const conUbic = l => !!(l && l.ra && typeof l.ra.lat === 'number' && typeof l.ra.lon === 'number');
  const todas = () => ((typeof L === 'function' ? L() : (typeof DB !== 'undefined' && DB ? DB.levantamientos : [])) || []).filter(l => !l.eliminado);
  function ncsConUbic(soloAbiertas = true, recId = null) {
    return todas().filter(l => conUbic(l) && (!soloAbiertas || l.estado !== 'cerrado') && (!recId || l.rec === recId || (l.recs || []).includes(recId)));
  }

  /* ---------- Reincidencias -------------------------------------------- */
  // Mismo lugar = a menos de RADIO_REP metros (con GPS) o el mismo subsector
  // (sin GPS), dentro de los últimos REP_DIAS días.
  const RADIO_REP = 6, REP_DIAS = 120;
  const mismoSitio = (a, b) => {
    if (conUbic(a) && conUbic(b)) return distancia(a.ra, b.ra) <= Math.max(RADIO_REP, Math.min(15, ((a.ra.acc || 0) + (b.ra.acc || 0)) / 3));
    return !!(a.sector && a.area === b.area && a.sector === b.sector && (a.subsector || '') === (b.subsector || '') && (a.subsector || b.subsector));
  };
  let cacheRep = null, cacheRepK = '';
  function mapaReincidencias() {
    const lista = todas();
    const k = lista.length + '|' + lista.map(l => l.id + (l.actualizado || '')).join(',').length;
    if (cacheRep && cacheRepK === k) return cacheRep;
    const desde = new Date(Date.now() - REP_DIAS * 864e5).toISOString().slice(0, 10);
    const rec = lista.filter(l => (l.fechaDet || '') >= desde);
    const m = new Map();
    rec.forEach(a => m.set(a.id, rec.filter(b => b.id !== a.id && mismoSitio(a, b))));
    cacheRep = m; cacheRepK = k;
    return m;
  }
  const reincidenciasDe = l => mapaReincidencias().get(l.id) || [];
  /* NC cercanas a un punto (para avisar ANTES de cargar una nueva). */
  function cercanasA(p, radio = 8) {
    if (!p) return [];
    const desde = new Date(Date.now() - REP_DIAS * 864e5).toISOString().slice(0, 10);
    return todas().filter(l => conUbic(l) && (l.fechaDet || '') >= desde && distancia(p, l.ra) <= Math.max(radio, Math.min(20, (p.acc || 0))))
      .sort((a, b) => distancia(p, a.ra) - distancia(p, b.ra));
  }
  /* Focos: grupos de 2 o más NC en el mismo lugar. */
  function focos() {
    const vistos = new Set(), out = [];
    todas().forEach(l => {
      if (vistos.has(l.id)) return;
      const r = reincidenciasDe(l);
      if (!r.length) return;
      const g = [l, ...r]; g.forEach(x => vistos.add(x.id));
      out.push({ ncs: g.sort((a, b) => (b.fechaDet || '').localeCompare(a.fechaDet || '')), abiertas: g.filter(x => x.estado !== 'cerrado').length, ref: g.find(conUbic) || l });
    });
    return out.sort((a, b) => b.ncs.length - a.ncs.length || b.abiertas - a.abiertas);
  }

  /* ---------- GPS ------------------------------------------------------ */
  const GEO = { fix: null, watch: null, err: '', subs: new Set() };
  function geoIniciar() {
    if (!('geolocation' in navigator)) { GEO.err = 'Este dispositivo no tiene GPS.'; return; }
    if (GEO.watch != null) return;
    GEO.watch = navigator.geolocation.watchPosition(p => {
      const c = p.coords, nuevo = { lat: c.latitude, lon: c.longitude, acc: c.accuracy, alt: c.altitude, t: Date.now() };
      const v = GEO.fix;
      // Se queda con el mejor dato reciente: adentro de la planta el GPS salta.
      if (!v || Date.now() - v.t > 15000 || nuevo.acc <= v.acc * 1.25) GEO.fix = nuevo;
      GEO.err = '';
      GEO.subs.forEach(f => { try { f(); } catch (_) {} });
    }, err => {
      GEO.err = err && err.code === 1 ? 'Sin permiso de ubicación' : 'Sin señal de GPS';
      GEO.subs.forEach(f => { try { f(); } catch (_) {} });
    }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
  }
  function geoDetener() { if (GEO.watch != null && !GEO.subs.size) { navigator.geolocation.clearWatch(GEO.watch); GEO.watch = null; } }
  const geoFresco = () => (GEO.fix && Date.now() - GEO.fix.t < 60000) ? GEO.fix : null;
  function geoChip() {
    const f = geoFresco();
    if (f) {
      const cls = f.acc <= 10 ? 'ok' : f.acc <= 30 ? 'med' : 'baja';
      return `<span class="ra-chip ${cls}" role="status"><i></i>GPS ±${Math.round(f.acc)} m</span>`;
    }
    return `<span class="ra-chip off" role="status"><i></i>${GEO.err ? e(GEO.err) : 'Buscando GPS'}</span>`;
  }

  /* ---------- Brújula -------------------------------------------------- */
  const BRU = { rumbo: null, beta: 90, on: false, abs: false, ok: false };
  function alOrientar(ev) {
    let h = null;
    if (typeof ev.webkitCompassHeading === 'number') h = ev.webkitCompassHeading;
    else if (ev.absolute && ev.alpha != null) h = 360 - ev.alpha;
    else if (!BRU.abs && ev.alpha != null) h = 360 - ev.alpha;
    if (ev.type === 'deviceorientationabsolute') BRU.abs = true;
    else if (BRU.abs && typeof ev.webkitCompassHeading !== 'number') h = null;
    if (h != null) {
      const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
      const nuevo = norm360(h + ang);
      BRU.rumbo = BRU.rumbo == null ? nuevo : norm360(BRU.rumbo + difAng(nuevo, BRU.rumbo) * 0.2);
    }
    if (ev.beta != null) BRU.beta = BRU.beta * 0.75 + ev.beta * 0.25;
  }
  async function brujulaIniciar() {
    if (BRU.on) return BRU.ok;
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r !== 'granted') return (BRU.ok = false);
      }
    } catch (_) { return (BRU.ok = false); }
    window.addEventListener('deviceorientationabsolute', alOrientar, true);
    window.addEventListener('deviceorientation', alOrientar, true);
    BRU.on = true; BRU.ok = true;
    return true;
  }
  function brujulaDetener() {
    window.removeEventListener('deviceorientationabsolute', alOrientar, true);
    window.removeEventListener('deviceorientation', alOrientar, true);
    BRU.on = false; BRU.abs = false; BRU.rumbo = null;
  }
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  async function esperarRumbo(ms = 1500) { const t = Date.now(); while (BRU.rumbo == null && Date.now() - t < ms) await esperar(80); return BRU.rumbo; }

  /* ---------- Soporte -------------------------------------------------- */
  let soporteXR = null;
  async function hayXR() {
    if (soporteXR != null) return soporteXR;
    try { soporteXR = !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')); } catch (_) { soporteXR = false; }
    return soporteXR;
  }
  const hayCam = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  /* =====================================================================
     Estilos
     ===================================================================== */
  const css = `
  :root{--nc-rojo:#E5352B;--nc-amar:#F2B705;--nc-verde:#1E9E5A;--nc-tinta:#14130F;--nc-papel:#FBFAF6}
  .ra-screen{position:fixed;inset:0;z-index:9500;background:#000;color:#fff;font-family:var(--sans,system-ui);touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden;-webkit-tap-highlight-color:transparent}
  .ra-screen video,.ra-screen canvas.ra-cv{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .ra-screen :focus-visible{outline:3px solid #fff;outline-offset:2px}
  .ra-top{position:absolute;left:0;right:0;top:0;display:flex;align-items:flex-start;gap:12px;padding:max(14px,env(safe-area-inset-top)) 14px 28px;background:linear-gradient(rgba(0,0,0,.72),rgba(0,0,0,0));z-index:5}
  .ra-tit{flex:1;min-width:0}
  .ra-tit b{display:block;font-size:17px;line-height:1.25;font-weight:700}
  .ra-tit small{display:block;font-size:13px;color:rgba(255,255,255,.78);margin-top:2px}
  .ra-x{width:48px;height:48px;flex-shrink:0;border-radius:50%;border:0;background:rgba(255,255,255,.18);color:#fff;font-size:26px;line-height:1;cursor:pointer;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
  .ra-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
  .ra-chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px;border-radius:999px;background:rgba(0,0,0,.55);font-size:12.5px;font-weight:600;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);white-space:nowrap}
  .ra-chip i{width:8px;height:8px;border-radius:50%;background:#9AA}
  .ra-chip.ok i{background:#3DDC84}.ra-chip.med i{background:var(--nc-amar)}.ra-chip.baja i{background:#FF9F0A}.ra-chip.off i{background:var(--nc-rojo)}
  .ra-guia{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);width:min(320px,82vw);text-align:center;font-size:15px;line-height:1.45;background:rgba(0,0,0,.62);padding:14px 16px;border-radius:16px;z-index:3;pointer-events:none;transition:opacity .3s}
  .ra-guia.off{opacity:0}
  .ra-guia .mano{display:block;width:56px;height:56px;margin:0 auto 8px;border:2px solid rgba(255,255,255,.85);border-radius:12px;position:relative}
  .ra-guia .mano::after{content:"";position:absolute;inset:14px;border:2px solid #fff;border-radius:50%}
  @media (prefers-reduced-motion:no-preference){.ra-guia .mano{animation:raMano 2.4s ease-in-out infinite}}
  @keyframes raMano{0%,100%{transform:translateX(-18px) rotate(-8deg)}50%{transform:translateX(18px) rotate(8deg)}}
  .ra-bot{position:absolute;left:0;right:0;bottom:0;padding:34px 14px max(14px,env(safe-area-inset-bottom));background:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.8));z-index:5;display:flex;flex-direction:column;gap:10px}
  .ra-fila{display:flex;gap:10px}
  .ra-fila>*{flex:1}
  .ra-btn{min-height:56px;border-radius:16px;border:0;font:700 16px var(--sans,system-ui);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 16px;text-decoration:none}
  .ra-btn.pri{background:var(--nc-amar);color:var(--nc-tinta)}
  .ra-btn.rojo{background:var(--nc-rojo);color:#fff}
  .ra-btn.sec{background:rgba(255,255,255,.18);color:#fff;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
  .ra-btn:disabled{opacity:.4}
  .ra-btn svg{width:20px;height:20px}
  .ra-res{font-size:14.5px;line-height:1.45;color:rgba(255,255,255,.92);text-align:center;text-wrap:balance}
  .ra-res b{color:#fff}
  .ra-mira{position:absolute;left:50%;top:50%;width:72px;height:72px;margin:-36px 0 0 -36px;z-index:2;pointer-events:none}
  .ra-mira::before,.ra-mira::after{content:"";position:absolute;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.35)}
  .ra-mira::before{left:50%;top:0;bottom:0;width:2px;margin-left:-1px}
  .ra-mira::after{top:50%;left:0;right:0;height:2px;margin-top:-1px}
  /* SIMI en RA */
  .ra-simi{position:absolute;left:12px;right:12px;z-index:6;display:flex;gap:10px;align-items:flex-start;background:var(--nc-papel);color:var(--nc-tinta);border-radius:16px;padding:12px 12px 12px 10px;box-shadow:0 10px 30px rgba(0,0,0,.45);border-left:6px solid var(--nc-amar)}
  .ra-simi .simi-svg{width:44px;height:44px;flex-shrink:0}
  .ra-simi .sm-t{flex:1;min-width:0;font-size:14px;line-height:1.4}
  .ra-simi .sm-t b{display:block;font-size:14.5px}
  .ra-simi .sm-l{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}
  .ra-simi .sm-l button{border:0;border-radius:999px;padding:6px 10px;font:600 12.5px var(--sans,system-ui);background:#ECE9E0;color:var(--nc-tinta);cursor:pointer}
  .ra-simi .sm-x{border:0;background:none;font-size:22px;line-height:1;color:#555;cursor:pointer;width:36px;height:36px;margin:-6px -4px 0 0}
  @media (prefers-reduced-motion:no-preference){.ra-simi{animation:raBaja .35s ease-out}}
  @keyframes raBaja{from{transform:translateY(-10px);opacity:0}to{transform:none;opacity:1}}
  /* ---- Tarjeta colgante (la pieza central) ---- */
  .nc-tag{--tc:var(--nc-rojo);--tt:#fff;position:relative;width:208px;background:var(--nc-papel);color:var(--nc-tinta);border-radius:10px 10px 14px 14px;box-shadow:0 10px 28px rgba(0,0,0,.5),0 1px 0 rgba(255,255,255,.6) inset;overflow:hidden;font-family:var(--sans,system-ui);text-align:left}
  .nc-tag .tg-b{display:flex;align-items:center;gap:9px;background:var(--tc);color:var(--tt);padding:9px 11px 9px 10px;font-weight:800;font-size:14px;letter-spacing:.01em}
  .nc-tag .tg-ojo{width:14px;height:14px;border-radius:50%;background:var(--nc-papel);box-shadow:inset 0 0 0 3px rgba(0,0,0,.28);flex-shrink:0}
  .nc-tag .tg-f{margin-left:auto;width:18px;height:18px;flex-shrink:0}
  .nc-tag .tg-c{padding:9px 12px 11px}
  .nc-tag .tg-id{font-size:25px;font-weight:800;letter-spacing:-.02em;line-height:1;font-variant-numeric:tabular-nums}
  .nc-tag .tg-cat{font-size:14px;font-weight:650;margin-top:4px;line-height:1.25}
  .nc-tag .tg-d{display:flex;align-items:baseline;gap:6px;margin-top:8px;font-size:13px;font-weight:600}
  .nc-tag .tg-d b{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--tcd,var(--tc))}
  .nc-tag .tg-x{font-size:12.5px;color:#55534C;margin-top:3px}
  .nc-tag .tg-dist{font-size:12.5px;color:#55534C;margin-top:6px;padding-top:6px;border-top:1px dashed #CFCBC0}
  .nc-tag .tg-rep{display:flex;align-items:center;gap:6px;padding:6px 11px;font-size:12.5px;font-weight:800;color:var(--nc-tinta);background:repeating-linear-gradient(-45deg,var(--nc-amar) 0 9px,#1b1a16 9px 18px)}
  .nc-tag .tg-rep span{background:var(--nc-amar);padding:2px 7px;border-radius:5px}
  .nc-tag.g-programado{--tcd:#8A6800}
  /* Tarjetas sobre la cámara */
  .ra-capa{position:absolute;inset:0;z-index:2;pointer-events:none}
  .ra-ancla{position:absolute;left:0;top:0;pointer-events:auto;cursor:pointer;will-change:transform;transform-origin:50% 100%}
  .ra-ancla .hilo{width:2px;height:46px;margin:0 auto;background:linear-gradient(rgba(255,255,255,.95),rgba(255,255,255,.4))}
  .ra-ancla .pie{width:16px;height:16px;margin:-2px auto 0;border-radius:50%;background:var(--tc);border:3px solid #fff;box-shadow:0 0 0 6px rgba(255,255,255,.18)}
  .ra-ancla.foco .nc-tag{outline:3px solid #fff}
  .ra-flecha{position:absolute;z-index:3;width:56px;height:56px;margin:-28px;border-radius:50%;display:grid;place-items:center;box-shadow:0 6px 18px rgba(0,0,0,.5);pointer-events:none}
  .ra-flecha svg{width:28px;height:28px}
  /* Radar de bolsillo */
  .ra-dial{position:absolute;left:14px;bottom:calc(max(14px,env(safe-area-inset-bottom)) + 150px);width:104px;height:104px;border-radius:50%;background:rgba(0,0,0,.55);border:1.5px solid rgba(255,255,255,.35);z-index:4;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
  .ra-dial::before{content:"";position:absolute;left:50%;top:50%;width:0;height:0;border:44px solid transparent;border-bottom-color:rgba(255,255,255,.14);border-top:0;transform:translate(-50%,-100%) scaleX(.62);transform-origin:50% 100%}
  .ra-dial i{position:absolute;width:10px;height:10px;margin:-5px;border-radius:50%;border:1.5px solid #fff}
  .ra-dial .yo{left:50%;top:50%;width:10px;height:10px;margin:-5px;background:#4DA3FF;border:2px solid #fff}
  .ra-dial small{position:absolute;bottom:-20px;left:0;right:0;text-align:center;font-size:11px;color:rgba(255,255,255,.8)}
  /* Hoja de detalle en RA */
  .ra-hoja{position:absolute;left:0;right:0;bottom:0;z-index:7;background:var(--nc-papel);color:var(--nc-tinta);border-radius:22px 22px 0 0;padding:10px 16px max(16px,env(safe-area-inset-bottom));box-shadow:0 -10px 30px rgba(0,0,0,.4)}
  .ra-hoja .asa{width:44px;height:5px;border-radius:5px;background:#CFCBC0;margin:0 auto 12px}
  .ra-hoja .hj-c{display:flex;gap:14px;align-items:flex-start}
  .ra-hoja .nc-tag{flex-shrink:0;box-shadow:0 4px 14px rgba(0,0,0,.18)}
  .ra-hoja .hj-t{flex:1;min-width:0;font-size:14px;line-height:1.45;color:#3B3A35}
  .ra-hoja .hj-t b{color:var(--nc-tinta)}
  .ra-hoja .ra-fila{margin-top:14px}
  .ra-hoja .ra-btn.sec{background:#ECE9E0;color:var(--nc-tinta)}
  @media (max-width:420px){.ra-hoja .hj-c{flex-direction:column}.ra-hoja .nc-tag{width:100%}}
  .ra-giro{display:flex;gap:8px;justify-content:center}
  .ra-giro button{min-width:56px;height:44px;border-radius:12px;border:0;background:rgba(255,255,255,.18);color:#fff;font:700 15px var(--sans,system-ui);cursor:pointer}
  /* ---- Captura y ficha ---- */
  .ra-card{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:var(--s1);border:1px solid var(--line);margin-top:10px}
  .ra-card .rc-ico{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;background:rgba(229,53,43,.14);color:var(--nc-rojo);flex-shrink:0}
  .ra-card .rc-ico svg{width:20px;height:20px}
  .ra-card .rc-t{flex:1;min-width:0;font-size:13px;line-height:1.45;color:var(--tx2)}
  .ra-card .rc-t b{display:block;color:var(--tx);font-size:13.5px}
  .ra-rep-note{display:flex;gap:10px;align-items:flex-start;margin-top:10px;padding:11px 12px;border-radius:14px;background:rgba(242,183,5,.12);border:1px solid rgba(242,183,5,.45);font-size:13px;line-height:1.45;color:var(--tx)}
  .ra-rep-note a{color:var(--nc-amar);font-weight:700}
  .ra-rep-note .simi-svg{width:36px;height:36px;flex-shrink:0}
  .ra-rep-note .st{display:block;height:6px;border-radius:3px;margin-bottom:6px;background:repeating-linear-gradient(-45deg,var(--nc-amar) 0 7px,#1b1a16 7px 14px)}
  .ra-acciones{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
  .mode-grid--ra{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
  .ra-tools{display:flex;gap:8px;flex-wrap:wrap;margin:-8px 0 20px}
  /* ---- Vista Mapa ---- */
  .mp{display:flex;flex-direction:column;gap:14px}
  .mp-cab{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap}
  .mp-cab h2{margin:0;font-size:26px;letter-spacing:-.02em;line-height:1.15}
  .mp-cab p{margin:4px 0 0;color:var(--tx2);font-size:14px}
  .mp-cab .mp-acc{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}
  .mp-fil{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 4px;scrollbar-width:none}
  .mp-fil::-webkit-scrollbar{display:none}
  .mp-f{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border-radius:999px;border:1.5px solid var(--line);background:var(--s1);color:var(--tx);font:600 14px var(--sans,system-ui);cursor:pointer;white-space:nowrap}
  .mp-f .sh{width:14px;height:14px;flex-shrink:0}
  .mp-f b{font-variant-numeric:tabular-nums;font-weight:800}
  .mp-f[aria-pressed="true"]{background:var(--tx);color:var(--bg);border-color:var(--tx)}
  .mp-f.rep .sh{border-radius:3px;background:repeating-linear-gradient(-45deg,var(--nc-amar) 0 3px,#1b1a16 3px 6px)}
  .mp-cuerpo{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:14px;align-items:start}
  @media (max-width:1000px){.mp-cuerpo{grid-template-columns:1fr}}
  .mp-lienzo{position:relative;height:min(62vh,560px);min-height:340px;border-radius:20px;overflow:hidden;background:#0F1A14;border:1px solid var(--line);touch-action:none;cursor:grab}
  .mp-lienzo.arrastra{cursor:grabbing}
  .mp-lienzo>svg{position:absolute;inset:0;width:100%;height:100%;display:block}
  .mp-lienzo .grilla line{stroke:rgba(190,230,200,.08);stroke-width:1}
  .mp-lienzo .grilla line.m{stroke:rgba(190,230,200,.16)}
  .mp-pt{cursor:pointer}
  .mp-pt:focus{outline:none}
  .mp-pt:focus-visible .halo,.mp-pt.sel .halo{stroke:#fff;stroke-width:3;opacity:1}
  .mp-pt .halo{fill:none;opacity:0}
  .mp-pt text{font:700 11px var(--sans,system-ui);fill:#EAF4EC;paint-order:stroke;stroke:#0F1A14;stroke-width:4px}
  .mp-ctl{position:absolute;right:12px;top:12px;display:flex;flex-direction:column;gap:8px;z-index:2}
  .mp-ctl button{width:44px;height:44px;border-radius:12px;border:0;background:#EAF4EC;color:#0F1A14;font:700 20px var(--sans,system-ui);cursor:pointer;display:grid;place-items:center;box-shadow:0 4px 12px rgba(0,0,0,.3)}
  .mp-ctl button svg{width:20px;height:20px}.mp-ctl button span{font:700 24px/1 var(--sans,system-ui)}
  .mp-esc{position:absolute;left:12px;bottom:12px;z-index:2;font:600 11.5px var(--sans,system-ui);color:#CFE3D5;display:flex;flex-direction:column;gap:4px}
  .mp-esc i{display:block;height:3px;background:#CFE3D5;border-radius:2px}
  .mp-norte{position:absolute;left:12px;top:12px;z-index:2;width:40px;height:40px;border-radius:50%;background:#EAF4EC;display:grid;place-items:center;font:800 11px var(--sans,system-ui);color:#0F1A14}
  .mp-vacio{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px;color:#CFE3D5;font-size:14.5px;line-height:1.5}
  .mp-vacio b{display:block;font-size:17px;color:#fff;margin-bottom:6px}
  .mp-lado{display:flex;flex-direction:column;gap:12px}
  .mp-sel{background:var(--s1);border:1px solid var(--line);border-radius:20px;padding:14px}
  .mp-sel .nc-tag{width:100%}
  .mp-sel .mp-sel-acc{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
  .mp-sel .mp-sel-acc .btn{flex:1;justify-content:center;min-height:44px}
  .mp-sel-vacio{color:var(--tx2);font-size:14px;line-height:1.5}
  .mp-simi{display:flex;gap:10px;align-items:flex-start;background:var(--s1);border:1px solid var(--line);border-left:6px solid var(--nc-amar);border-radius:16px;padding:12px}
  .mp-simi .simi-svg{width:40px;height:40px;flex-shrink:0}
  .mp-simi .ms{flex:1;min-width:0;font-size:13.5px;line-height:1.45;color:var(--tx2)}
  .mp-simi .ms b{color:var(--tx)}
  .mp-simi .ms button{display:flex;width:100%;text-align:left;gap:8px;align-items:center;margin-top:7px;padding:8px 10px;border-radius:10px;border:0;background:var(--s2);color:var(--tx);font:600 13px var(--sans,system-ui);cursor:pointer}
  .mp-simi .ms button em{font-style:normal;margin-left:auto;font-weight:800;color:var(--nc-amar)}
  .mp-lista{display:flex;flex-direction:column;gap:6px}
  .mp-it{display:flex;align-items:center;gap:12px;min-height:56px;padding:9px 12px;border-radius:14px;background:var(--s1);border:1px solid transparent;cursor:pointer;text-align:left;color:var(--tx);font:inherit;width:100%}
  .mp-it:hover{border-color:var(--line)}
  .mp-it.sel{border-color:var(--tx)}
  .mp-it .sh{width:16px;height:16px;flex-shrink:0}
  .mp-it .it-t{flex:1;min-width:0;font-size:13.5px;line-height:1.35}
  .mp-it .it-t b{font-weight:800}
  .mp-it .it-t small{display:block;color:var(--tx2);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mp-it .it-d{text-align:right;font-size:12px;color:var(--tx2);white-space:nowrap}
  .mp-it .it-d b{display:block;font-size:16px;color:var(--tx);font-variant-numeric:tabular-nums}
  .mp-it .rep{font-size:11px;font-weight:800;padding:2px 6px;border-radius:5px;background:var(--nc-amar);color:var(--nc-tinta);margin-left:6px}
  .mp-sin{font-size:13px;color:var(--tx2);padding:4px 2px}
  `;
  if (!$('sima-ra-css')) { const st = document.createElement('style'); st.id = 'sima-ra-css'; st.textContent = css; document.head.appendChild(st); }

  /* ---------- Íconos y formas ----------------------------------------- */
  const ico = (p, w = 18) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const P = {
    ra: '<path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/><path d="M12 7l4.5 2.6v5L12 17.2l-4.5-2.6v-5z"/><path d="M12 12l4.5-2.4M12 12v5.2M12 12L7.5 9.6"/>',
    mapa: '<path d="M9 20l-5.4-2.7A1 1 0 013 16.4V4.6a1 1 0 011.4-.9L9 6m0 14l6-3m-6 3V6m6 11l4.6 2.3a1 1 0 001.4-.9V7.6a1 1 0 00-.6-.9L15 4m0 13V4M9 6l6-2"/>',
    cam: '<path d="M3 8a2 2 0 012-2h2l2-3h6l2 3h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><circle cx="12" cy="13" r="4"/>',
    ir: '<path d="M12 2l7 19-7-4-7 4z"/>',
    ficha: '<path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    yo: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    mas: '<path d="M12 5v14M5 12h14"/>', menos: '<path d="M5 12h14"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>'
  };
  // Forma por estado: además del color, para que se lea sin depender de él.
  function formaSvg(g, size = 16, sinBorde) {
    const G = GRUPOS[g], s = sinBorde ? '' : ' stroke="#fff" stroke-width="2"';
    if (g === 'programado') return `<svg class="sh" viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true"><path d="M8 1l7 7-7 7-7-7z" fill="${G.c}"${s}/></svg>`;
    if (g === 'resuelto') return `<svg class="sh" viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="${G.c}"${s}/><path d="M4.6 8.2l2.3 2.3 4.5-4.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    return `<svg class="sh" viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="${G.c}"${s}/><path d="M8 4.2v4.6M8 11.2v.2" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`;
  }
  const FLECHA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 16-8-4.5L4 19z" fill="currentColor"/></svg>';
  const simiMini = () => (window.SIMI_M ? SIMI_M.svg('mini', { manos: false }) : '');

  /* ---------- Tarjeta colgante (HTML) ---------------------------------- */
  function tagHtml(l, opt = {}) {
    const f = ficha(l);
    const dNum = `<b>${f.dias}</b>`;
    return `<div class="nc-tag g-${f.g}" style="--tc:${f.G.c};--tt:${f.G.tx}" role="img" aria-label="${e(f.id)}, ${e(f.G.t)}, ${e(f.cat)}, ${e(f.diasTxt)}${f.rep ? ', reincide ' + (f.rep + 1) + ' veces en este lugar' : ''}">
      <div class="tg-b"><span class="tg-ojo"></span>${e(f.G.t)}${formaSvg(f.g, 18, true).replace('class="sh"', 'class="tg-f"')}</div>
      <div class="tg-c">
        <div class="tg-id">${e(f.id)}</div>
        <div class="tg-cat">${e(f.cat)}</div>
        <div class="tg-d">${f.dias == null ? `<span>${e(f.diasTxt)}</span>` : f.dias === 0 && f.g !== 'resuelto' ? '<span>Abierta hoy</span>' : `${dNum}<span>${f.dias === 1 ? 'día' : 'días'} ${f.g === 'resuelto' ? 'estuvo abierta' : 'abierta'}</span>`}</div>
        ${f.extra ? `<div class="tg-x">${e(f.extra)}</div>` : ''}
        ${opt.dist != null ? `<div class="tg-dist">A ${fmtM(opt.dist)}${opt.lugar !== false ? ' · ' + e(f.lugar) : ''}</div>` : (opt.lugar ? `<div class="tg-dist">${e(f.lugar)}</div>` : '')}
      </div>
      ${f.rep ? `<div class="tg-rep"><span>Reincide · ${f.rep + 1} veces aquí</span></div>` : ''}
    </div>`;
  }

  /* ---------- Tarjeta colgante (canvas, para la RA 3D) ----------------- */
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function tagCanvas(l, dist) {
    const f = ficha(l), W = 512, H = f.rep ? 420 : 372;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const FF = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
    g.fillStyle = '#FBFAF6'; rrect(g, 8, 8, W - 16, H - 16, 30); g.fill();
    g.save(); rrect(g, 8, 8, W - 16, H - 16, 30); g.clip();
    g.fillStyle = f.G.c; g.fillRect(0, 0, W, 86);
    g.fillStyle = '#FBFAF6'; g.beginPath(); g.arc(52, 47, 17, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 6; g.stroke();
    g.fillStyle = f.G.tx; g.font = `800 38px ${FF}`; g.textBaseline = 'middle'; g.fillText(f.G.t, 86, 49);
    g.fillStyle = '#14130F'; g.font = `800 66px ${FF}`; g.textBaseline = 'alphabetic'; g.fillText(f.id, 32, 160);
    g.font = `650 34px ${FF}`; g.fillText(f.cat.length > 24 ? f.cat.slice(0, 23) + '…' : f.cat, 32, 206);
    g.font = `800 50px ${FF}`; g.fillStyle = f.g === 'programado' ? '#8A6800' : f.G.c;
    const num = f.dias == null ? '' : String(f.dias);
    g.fillText(num, 32, 268);
    const nw = num ? g.measureText(num).width + 12 : 0;
    g.fillStyle = '#14130F'; g.font = `650 30px ${FF}`;
    g.fillText(f.dias == null ? f.diasTxt : (f.g === 'resuelto' ? 'días abierta' : (f.dias === 1 ? 'día abierta' : 'días abierta')), 32 + nw, 266);
    g.fillStyle = '#55534C'; g.font = `500 28px ${FF}`;
    g.fillText(((f.extra ? f.extra : '') + (dist != null ? (f.extra ? ' · ' : '') + 'a ' + fmtM(dist) : '')).slice(0, 34), 32, 314);
    if (f.rep) {
      const y0 = H - 84;
      for (let x = -60; x < W + 60; x += 36) { g.fillStyle = (x / 36) % 2 ? '#1b1a16' : '#F2B705'; g.beginPath(); g.moveTo(x, H); g.lineTo(x + 36, H); g.lineTo(x + 36 + 76, y0); g.lineTo(x + 76, y0); g.closePath(); g.fill(); }
      g.fillStyle = '#F2B705'; rrect(g, 24, y0 + 16, 330, 46, 10); g.fill();
      g.fillStyle = '#14130F'; g.font = `800 28px ${FF}`; g.fillText(`Reincide · ${f.rep + 1} veces aquí`, 38, y0 + 49);
    }
    g.restore();
    return cv;
  }

  /* ---------- Pantalla completa --------------------------------------- */
  let pantalla = null, limpiezas = [];
  function abrirPantalla(html, etiqueta) {
    cerrarPantalla();
    pantalla = document.createElement('div');
    pantalla.className = 'ra-screen'; pantalla.id = 'raScreen';
    pantalla.setAttribute('role', 'dialog'); pantalla.setAttribute('aria-modal', 'true'); pantalla.setAttribute('aria-label', etiqueta || 'Realidad aumentada');
    pantalla.innerHTML = html;
    document.body.appendChild(pantalla);
    const esc_ = ev => { if (ev.key === 'Escape') salirTodo(); };
    document.addEventListener('keydown', esc_); limpiezas.push(() => document.removeEventListener('keydown', esc_));
    setTimeout(() => { const x = $('raX'); if (x) x.focus(); }, 50);
    return pantalla;
  }
  function cerrarPantalla() {
    limpiezas.forEach(f => { try { f(); } catch (_) {} }); limpiezas = [];
    if (pantalla) { pantalla.remove(); pantalla = null; }
  }
  function salirTodo() { cerrarPantalla(); GEO.subs.clear(); geoDetener(); brujulaDetener(); }
  const cabecera = (tit, sub) => `<div class="ra-top"><div class="ra-tit"><b>${tit}</b><small>${sub || ''}</small><div class="ra-chips" id="raChips">${geoChip()}</div></div>
    <button class="ra-x" id="raX" aria-label="Cerrar">×</button></div>`;
  function pintarChips(extra = '') {
    const c = $('raChips'); if (!c) return;
    c.innerHTML = geoChip() + (BRU.rumbo != null ? `<span class="ra-chip ok"><i></i>Mirás al ${cardinal(BRU.rumbo)}</span>` : '') + extra;
  }

  /* ---------- SIMI avisa reincidencias en RA --------------------------- */
  let simiCerrado = '';
  function simiReincidencia(cont, lista, top) {
    const z = $(cont); if (!z) return;
    const clave = lista.map(l => l.id).join(',');
    if (!lista.length || simiCerrado === clave) { z.innerHTML = ''; return; }
    if (z.dataset.k === clave) return;
    z.dataset.k = clave;
    const ab = lista.filter(l => l.estado !== 'cerrado').length;
    z.innerHTML = `<div class="ra-simi" style="top:${top}px" role="alert">${simiMini()}
      <div class="sm-t"><b>${lista.length === 1 ? 'Acá ya hubo una NC' : `Acá ya hubo ${lista.length} NC`} en los últimos ${REP_DIAS} días</b>
        ${ab ? `${ab === 1 ? 'Una sigue abierta' : ab + ' siguen abiertas'}. Si es la misma falla, no la cargues de nuevo; si volvió a aparecer, anotá la causa probable.` : 'Ya se habían resuelto: si volvió a aparecer, es una reincidencia. Anotá la causa probable.'}
        <div class="sm-l">${lista.slice(0, 4).map(l => `<button type="button" data-id="${e(l.id)}">${e(l.id)} · ${e(GRUPOS[grupoDe(l.estado)].t)}</button>`).join('')}</div></div>
      <button type="button" class="sm-x" aria-label="Cerrar aviso">×</button></div>`;
    z.querySelector('.sm-x').onclick = () => { simiCerrado = clave; z.innerHTML = ''; };
    z.querySelectorAll('[data-id]').forEach(b => b.onclick = () => mostrarHoja(b.dataset.id));
    vibrar([30, 60, 30]);
    const fab = document.querySelector('#simiFab .simi-svg'); if (fab && window.SIMI_M) SIMI_M.humor(fab, 'alerta', 2600);
  }

  /* ---------- Hoja de detalle dentro de la RA -------------------------- */
  function mostrarHoja(id, dist) {
    if (!pantalla) return;
    const l = typeof levPara === 'function' ? levPara(id) : todas().find(x => x.id === id);
    if (!l) return;
    let h = $('raHoja');
    if (!h) { h = document.createElement('div'); h.id = 'raHoja'; h.className = 'ra-hoja'; pantalla.appendChild(h); h.addEventListener('beforexrselect', ev => ev.preventDefault()); }
    const f = ficha(l), yo = geoFresco();
    const d = dist != null ? dist : (yo && conUbic(l) ? distancia(yo, l.ra) : null);
    const r = reincidenciasDe(l);
    h.innerHTML = `<div class="asa"></div>
      <div class="hj-c">${tagHtml(l)}
        <div class="hj-t"><b>${e(f.lugar)}</b><br>${e(f.estado)}${d != null ? ` · a ${fmtM(d)}` + (yo && conUbic(l) ? ` hacia el ${cardinal(rumbo(yo, l.ra))}` : '') : ''}
          ${l.desc ? `<br><span style="color:#55534C">${e(String(l.desc).slice(0, 140))}</span>` : ''}
          ${r.length ? `<br><b style="color:#8A6800">Reincide:</b> ${r.slice(0, 3).map(x => e(x.id)).join(', ')}` : ''}</div></div>
      <div class="ra-fila"><button class="ra-btn sec" id="hjCerrar">Seguir buscando</button><button class="ra-btn pri" id="hjFicha">${ico(P.ficha)} Ver ficha</button></div>`;
    $('hjCerrar').onclick = () => h.remove();
    $('hjFicha').onclick = () => { salirTodo(); if (typeof openDetalle === 'function') openDetalle(id); };
    vibrar(20);
  }

  /* =====================================================================
     Capa 3D de tarjetas ancladas al mundo (WebXR)
     ---------------------------------------------------------------------
     Al empezar se toma el rumbo de la brújula (H0) y hacia dónde mira la
     cámara en el espacio XR. Desde ahí, cada NC queda en su rumbo y a su
     distancia reales: la tarjeta queda QUIETA en el lugar donde se levantó
     la falla mientras caminás (la sigue el seguimiento de ARCore, no el GPS).
     ===================================================================== */
  function capaGeo(THREE, scene, renderer, lista, opts = {}) {
    const grupo = new THREE.Group(); scene.add(grupo);
    const items = [];
    let base = null, giro = 0;   // giro manual (°) si la brújula estaba corrida
    const yaw = () => {
      const cam = renderer.xr.getCamera();
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion().setFromRotationMatrix(cam.matrixWorld));
      return { a: Math.atan2(fwd.x, -fwd.z), p: new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld) };
    };
    function hacerItem(l) {
      const cv = tagCanvas(l, null);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      spr.renderOrder = 10; spr.userData.id = l.id;
      const asp = cv.height / cv.width;
      const G = GRUPOS[grupoDe(l.estado)], col = new THREE.Color(G.c);
      const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .85 }));
      const aro = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.24, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .9, side: THREE.DoubleSide }));
      const punto = new THREE.Mesh(new THREE.CircleGeometry(0.09, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
      const g = new THREE.Group(); g.add(spr, poste, aro, punto); grupo.add(g);
      return { l, g, spr, poste, aro, asp, cv, tex, ultDist: null };
    }
    lista.forEach(l => items.push(hacerItem(l)));
    const PISO = opts.piso != null ? opts.piso : -1.45;   // espacio 'local': el piso está ~1,45 m bajo los ojos
    function ubicar() {
      const yo = geoFresco(); if (!yo) return false;
      const y = yaw();
      // Primera vez: se fija la relación brújula ↔ espacio XR.
      if (!base) base = { h0: BRU.rumbo != null ? BRU.rumbo : 0, a0: y.a, p0: y.p.clone(), geo: { lat: yo.lat, lon: yo.lon } };
      items.forEach(it => {
        if (!conUbic(it.l)) { it.g.visible = false; return; }
        const d = distancia(base.geo, it.l.ra), b = rumbo(base.geo, it.l.ra);
        const ang = base.a0 + rad(b - base.h0 + giro);
        const dd = Math.min(d, 35);   // lo muy lejano se dibuja a 35 m, con su distancia real en la tarjeta
        const x = base.p0.x + Math.sin(ang) * dd, z = base.p0.z - Math.cos(ang) * dd;
        it.g.position.set(x, 0, z);
        const alto = 1.75 + PISO, ancho = THREE.MathUtils.clamp(dd * 0.075, 0.42, 2.4);
        it.spr.scale.set(ancho, ancho * it.asp, 1);
        it.spr.position.set(0, alto + ancho * it.asp / 2 + 0.08, 0);
        it.poste.scale.y = Math.max(0.05, alto - PISO); it.poste.position.y = PISO + (alto - PISO) / 2;
        it.aro.position.y = PISO + 0.01; it.g.children[3].position.y = PISO + 0.012;
        it.g.visible = true;
      });
      return true;
    }
    function actualizarDistancias() {
      const y = yaw();
      items.forEach(it => {
        if (!it.g.visible) return;
        const dx = it.g.position.x - y.p.x, dz = it.g.position.z - y.p.z, d = Math.hypot(dx, dz);
        const gf = geoFresco();
        const real = base && gf && distancia(base.geo, it.l.ra) > 35 ? distancia(gf, it.l.ra) : d;
        if (it.ultDist == null || Math.abs(it.ultDist - real) > 1.5) {
          it.ultDist = real;
          const cv = tagCanvas(it.l, real); it.tex.image = cv; it.tex.needsUpdate = true;
        }
      });
    }
    function pulso(t) { items.forEach(it => { if (it.g.visible) it.aro.material.opacity = .55 + Math.sin(t * 3 + it.g.position.x) * .3; }); }
    const ray = new THREE.Raycaster();
    function elegir(controller) {
      ray.setFromXRController(controller); ray.camera = renderer.xr.getCamera();
      const hit = ray.intersectObjects(items.filter(i => i.g.visible).map(i => i.spr), false)[0];
      return hit ? hit.object.userData.id : null;
    }
    function girar(g) { giro += g; ubicar(); }
    function dispose() { items.forEach(it => { it.tex.dispose(); it.spr.material.dispose(); }); scene.remove(grupo); }
    return { ubicar, actualizarDistancias, pulso, elegir, girar, dispose, listo: () => !!base, n: () => items.length };
  }

  /* =====================================================================
     1 · MARCAR NC
     ===================================================================== */
  let marcaRec = null;
  async function marcar(recId) {
    if (typeof canEdit === 'function' && !canEdit()) { aviso('err', 'Sin permiso', 'Solo el Inspector marca no conformidades.'); return; }
    marcaRec = recId || (typeof recActivo !== 'undefined' ? recActivo : null);
    simiCerrado = '';
    geoIniciar();
    brujulaIniciar();
    if (await hayXR()) {
      try { await marcarXR(); return; }
      catch (err) { console.warn('[SIMA RA] WebXR no arrancó, paso a modo cámara', err); cerrarPantalla(); }
    }
    if (hayCam()) return marcarCamara();
    aviso('info', 'Sin cámara disponible', 'La NC se marca con la ubicación GPS del momento.');
    terminarMarca({ metodo: 'gps' });
  }
  function terminarMarca(extra) {
    const f = geoFresco();
    const ra = { metodo: extra.metodo, d: new Date().toISOString(), by: (typeof ROLES !== 'undefined' && typeof role !== 'undefined' && ROLES[role]) ? ROLES[role].name : '' };
    if (BRU.rumbo != null) ra.rumbo = Math.round(BRU.rumbo);
    if (extra.dist != null) ra.dist = Math.round(extra.dist * 100) / 100;
    if (extra.delta != null && ra.rumbo != null) ra.rumbo = Math.round(norm360(ra.rumbo + extra.delta));
    if (extra.px) ra.px = extra.px;
    if (f) {
      ra.insp = { lat: +f.lat.toFixed(7), lon: +f.lon.toFixed(7) };
      const p = (ra.dist && ra.rumbo != null && ra.dist < 60) ? destino(f, ra.rumbo, ra.dist) : ra.insp;
      ra.lat = p.lat; ra.lon = p.lon;
      ra.acc = Math.round(f.acc * 10) / 10;
      if (f.alt != null) ra.alt = Math.round(f.alt * 10) / 10;
    }
    cerrarPantalla(); GEO.subs.clear(); brujulaDetener();
    if (typeof openCaptura === 'function') {
      openCaptura({ rec: marcaRec, ra, foto: extra.foto || null });
      if (!f) aviso('info', 'NC marcada sin GPS', 'Queda con el sector que elijas. Si hay señal al guardar, se completa la ubicación.');
    }
  }
  const pieMarca = (extra) => `<div class="ra-bot" id="raBot"><div class="ra-res" id="raRes" aria-live="polite"></div>${extra}</div>`;

  /* ---------- 1a · WebXR ---------------------------------------------- */
  async function marcarXR() {
    const THREE = await import('/vendor/three.module.min.js');
    const scr = abrirPantalla(`${cabecera('Marcar no conformidad', marcaRec ? 'Recorrido ' + e(marcaRec) : '')}
      <div class="ra-guia" id="raGuia"><span class="mano"></span>Mové el celular despacio, apuntando a la falla, hasta que aparezca el aro sobre la superficie.</div>
      <div id="raSimi"></div>
      ${pieMarca(`<div class="ra-fila"><button class="ra-btn sec" id="raCam">${ico(P.cam)} Usar foto</button><button class="ra-btn pri" id="raOk" disabled>Continuar con la carga</button></div>`)}`, 'Marcar no conformidad en realidad aumentada');
    scr.style.background = 'transparent';
    ['raBot', 'raSimi'].forEach(id => $(id) && $(id).addEventListener('beforexrselect', ev => ev.preventDefault()));
    scr.querySelector('.ra-top').addEventListener('beforexrselect', ev => ev.preventDefault());
    $('raRes').innerHTML = 'Tocá la pantalla para clavar el pin <b>NC</b> sobre la falla.';

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.domElement.className = 'ra-cv';
    scr.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 60);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.4));

    const reticle = new THREE.Group();
    reticle.add(new THREE.Mesh(new THREE.RingGeometry(0.07, 0.09, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff })));
    reticle.add(new THREE.Mesh(new THREE.CircleGeometry(0.012, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff })));
    reticle.matrixAutoUpdate = false; reticle.visible = false; scene.add(reticle);

    // El pin nuevo: chincheta roja + tarjeta «Nueva NC».
    const pin = new THREE.Group();
    const rojo = new THREE.MeshStandardMaterial({ color: 0xe5352b, roughness: .45, emissive: 0x4a0000 });
    const cono = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 24), rojo); cono.rotation.x = Math.PI; cono.position.y = 0.06;
    const bola = new THREE.Mesh(new THREE.SphereGeometry(0.042, 24, 16), rojo); bola.position.y = 0.14;
    const base = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.08, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe5352b, transparent: true, opacity: .85 }));
    const cvN = tagCanvas({ id: 'Nueva NC', estado: 'detectado', cat: '', fechaDet: hoyISO() }, null);
    const gN = cvN.getContext('2d'); gN.fillStyle = '#FBFAF6'; gN.fillRect(24, 170, 470, 160); gN.fillStyle = '#14130F'; gN.font = '650 32px system-ui,sans-serif'; gN.fillText('Completá la carga', 32, 210); gN.fillText('para guardarla', 32, 250);
    const cartel = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cvN), depthTest: false }));
    cartel.scale.set(0.26, 0.26 * cvN.height / cvN.width, 1); cartel.position.y = 0.36; cartel.renderOrder = 10;
    pin.add(cono, bola, base, cartel); pin.visible = false; scene.add(pin);

    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay', 'local-floor', 'light-estimation'], domOverlay: { root: scr }
    });
    renderer.xr.setReferenceSpaceType('local');
    await renderer.xr.setSession(session);
    const viewerSpace = await session.requestReferenceSpace('viewer');
    const hitSource = await session.requestHitTestSource({ space: viewerSpace });

    // Las NC que ya existen cerca también se ven, para no duplicar.
    const yo0 = geoFresco();
    const cerca = yo0 ? todas().filter(l => conUbic(l) && distancia(yo0, l.ra) < 60) : [];
    await esperarRumbo(1200);
    const capa = cerca.length ? capaGeo(THREE, scene, renderer, cerca) : null;

    let marca = null, terminado = false, primerHit = false;
    const fin = async (resultado) => {
      if (terminado) return; terminado = true;
      try { hitSource.cancel(); } catch (_) {}
      renderer.setAnimationLoop(null);
      try { await session.end(); } catch (_) {}
      if (capa) capa.dispose(); renderer.dispose();
      if (resultado === 'camara') { cerrarPantalla(); marcarCamara(); return; }
      if (resultado) terminarMarca(resultado); else salirTodo();
    };
    session.addEventListener('end', () => { if (!terminado) { terminado = true; renderer.setAnimationLoop(null); if (marca) terminarMarca(marca); else salirTodo(); } });
    limpiezas.push(() => { if (!terminado) { terminado = true; try { session.end(); } catch (_) {} } });
    $('raX').onclick = () => fin(null);
    $('raCam').onclick = () => fin('camara');
    $('raOk').onclick = () => fin(marca);

    const refrescar = () => {
      pintarChips();
      const f = geoFresco();
      simiReincidencia('raSimi', f ? cercanasA(f, 8) : [], 150);
      if (capa && !capa.listo()) capa.ubicar();
    };
    GEO.subs.add(refrescar); refrescar();

    const controller = renderer.xr.getController(0);
    controller.addEventListener('select', () => {
      if (capa) { const id = capa.elegir(controller); if (id) { mostrarHoja(id); return; } }
      if (!reticle.visible) { const gg = $('raGuia'); if (gg) { gg.classList.remove('off'); gg.lastChild.textContent = 'Todavía no se ve una superficie ahí. Apuntá a la falla y esperá el aro blanco.'; } return; }
      pin.position.setFromMatrixPosition(reticle.matrix); pin.visible = true;
      const cam = renderer.xr.getCamera();
      const cp = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion().setFromRotationMatrix(cam.matrixWorld));
      const v = pin.position.clone().sub(cp);
      const dist = Math.hypot(v.x, v.z);
      const delta = grad(Math.atan2(v.x, -v.z) - Math.atan2(fwd.x, -fwd.z));
      marca = { metodo: 'webxr', dist, delta: difAng(delta, 0) };
      vibrar(40);
      $('raOk').disabled = false;
      $('raRes').innerHTML = `<b>Pin clavado</b> a ${dist.toFixed(1).replace('.', ',')} m${BRU.rumbo != null ? ', hacia el ' + cardinal(norm360(BRU.rumbo + marca.delta)) : ''}. Tocá otro punto para moverlo.`;
    });
    scene.add(controller);

    const reloj = new THREE.Clock();
    renderer.setAnimationLoop((t, frame) => {
      if (frame) {
        const hits = frame.getHitTestResults(hitSource);
        if (hits.length) {
          const pose = hits[0].getPose(renderer.xr.getReferenceSpace());
          reticle.visible = true; reticle.matrix.fromArray(pose.transform.matrix);
          if (!primerHit) { primerHit = true; const gg = $('raGuia'); if (gg) gg.classList.add('off'); vibrar(15); }
        } else reticle.visible = false;
      }
      const k = reloj.getElapsedTime();
      if (pin.visible && !REDUCE) { bola.position.y = 0.14 + Math.sin(k * 3) * 0.008; base.material.opacity = .5 + Math.sin(k * 4) * .3; }
      if (capa) { if (!capa.listo()) capa.ubicar(); capa.pulso(k); if ((k * 2 | 0) % 2 === 0) capa.actualizarDistancias(); }
      renderer.render(scene, camera);
    });
  }

  /* ---------- 1b · Modo cámara ----------------------------------------- */
  async function marcarCamara() {
    const scr = abrirPantalla(`<video id="raVid" autoplay playsinline muted></video>
      ${cabecera('Marcar no conformidad', marcaRec ? 'Recorrido ' + e(marcaRec) : '')}
      <div class="ra-guia" id="raGuia">Encuadrá la falla y tocá justo donde está para clavar el pin.</div>
      <div id="raSimi"></div>
      ${pieMarca(`<div class="ra-fila"><button class="ra-btn sec" id="raSinFoto">Solo ubicación</button><button class="ra-btn rojo" id="raOk" disabled>${ico(P.cam)} Tomar foto y marcar</button></div>`)}`, 'Marcar no conformidad con la cámara');
    $('raRes').textContent = 'La foto sale con el pin dibujado y queda como evidencia del «antes».';
    let stream = null;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false }); }
    catch (_) { cerrarPantalla(); aviso('err', 'Cámara no disponible', 'Sin permiso de cámara. La NC se marca con la ubicación GPS.'); terminarMarca({ metodo: 'gps' }); return; }
    const vid = $('raVid'); vid.srcObject = stream;
    limpiezas.push(() => stream.getTracks().forEach(t => t.stop()));
    const refrescar = () => { pintarChips(); const f = geoFresco(); simiReincidencia('raSimi', f ? cercanasA(f, 8) : [], 150); };
    GEO.subs.add(refrescar); refrescar();
    const tic = setInterval(pintarChips, 1000); limpiezas.push(() => clearInterval(tic));

    let px = null, pinEl = null;
    function aImagen(cx, cy) {
      const r = vid.getBoundingClientRect(), vw = vid.videoWidth || r.width, vh = vid.videoHeight || r.height;
      const k = Math.max(r.width / vw, r.height / vh), dw = vw * k, dh = vh * k;
      const ox = (r.width - dw) / 2, oy = (r.height - dh) / 2;
      return { x: Math.min(1, Math.max(0, (cx - r.left - ox) / dw)), y: Math.min(1, Math.max(0, (cy - r.top - oy) / dh)) };
    }
    scr.addEventListener('pointerup', ev => {
      if (ev.target.closest('.ra-top,.ra-bot,.ra-simi,.ra-hoja')) return;
      px = aImagen(ev.clientX, ev.clientY);
      if (pinEl) pinEl.remove();
      pinEl = document.createElement('div'); pinEl.className = 'ra-ancla'; pinEl.style.pointerEvents = 'none';
      pinEl.innerHTML = `<div style="transform:translate(-50%,-100%)"><svg viewBox="0 0 46 58" width="46" height="58" aria-hidden="true"><path d="M23 56C23 56 4 34 4 21a19 19 0 0138 0c0 13-19 35-19 35z" fill="#E5352B" stroke="#fff" stroke-width="3"/><text x="23" y="27" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="14" fill="#fff">NC</text></svg></div>`;
      pinEl.style.transform = `translate(${ev.clientX}px,${ev.clientY}px)`;
      scr.appendChild(pinEl);
      $('raGuia').classList.add('off');
      $('raOk').disabled = false;
      $('raRes').innerHTML = '<b>Pin clavado.</b> Tocá otro punto para moverlo, o tomá la foto.';
      vibrar(30);
    });
    $('raX').onclick = salirTodo;
    $('raSinFoto').onclick = () => terminarMarca({ metodo: 'camara', px });
    $('raOk').onclick = () => {
      if (!vid.videoWidth) return;
      const c = document.createElement('canvas'), max = 1100;
      const k = Math.min(1, max / Math.max(vid.videoWidth, vid.videoHeight));
      c.width = Math.round(vid.videoWidth * k); c.height = Math.round(vid.videoHeight * k);
      const g = c.getContext('2d');
      g.drawImage(vid, 0, 0, c.width, c.height);
      if (px) dibujarPin(g, px.x * c.width, px.y * c.height, c.width);
      const foto = typeof comprimirCanvas === 'function' ? comprimirCanvas(c) : c.toDataURL('image/jpeg', .74);
      terminarMarca({ metodo: 'camara', px, foto });
    };
  }
  function dibujarPin(g, x, y, ancho) {
    const s = Math.max(1, ancho / 700);
    g.save(); g.translate(x, y); g.scale(s, s);
    g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-4, -8, -19, -22, -19, -35); g.arc(0, -35, 19, Math.PI, 0); g.bezierCurveTo(19, -22, 4, -8, 0, 0);
    g.fillStyle = '#E5352B'; g.fill(); g.shadowColor = 'transparent';
    g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = '#fff'; g.font = '800 14px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('NC', 0, -34);
    g.beginPath(); g.ellipse(0, 2, 16, 5, 0, 0, Math.PI * 2); g.lineWidth = 2.5; g.strokeStyle = '#E5352B'; g.stroke();
    g.restore();
  }

  /* =====================================================================
     2 · BUSCAR NC CON LA CÁMARA
     ===================================================================== */
  let radarFiltro = 'abiertas';
  function listaRadar(focoId) {
    if (focoId) { const l = typeof levPara === 'function' ? levPara(focoId) : null; return l && conUbic(l) ? [l] : []; }
    return todas().filter(l => conUbic(l) && (radarFiltro === 'todas' || l.estado !== 'cerrado'));
  }
  async function radar(focoId) {
    geoIniciar();
    const brOk = await brujulaIniciar();
    const lista = listaRadar(focoId);
    if (!lista.length) {
      aviso('info', focoId ? 'Esta NC no tiene ubicación' : 'No hay NC con ubicación', focoId ? 'Se cargó sin GPS: buscala por su sector.' : 'Las NC marcadas con RA aparecen acá con su tarjeta.');
      if (!focoId) { mapa(); return; }
      return;
    }
    if (await hayXR()) {
      try { await radarXR(lista, focoId); return; }
      catch (err) { console.warn('[SIMA RA] WebXR no arrancó para buscar, paso a cámara', err); cerrarPantalla(); }
    }
    if (!hayCam()) { aviso('err', 'Sin cámara', 'Usá el mapa para llegar hasta la NC.'); mapa(null, focoId); return; }
    return radarCamara(lista, focoId, brOk);
  }

  /* ---------- 2a · WebXR: tarjetas fijas en el mundo ------------------- */
  async function radarXR(lista, focoId) {
    const THREE = await import('/vendor/three.module.min.js');
    const foco = focoId ? lista[0] : null;
    const scr = abrirPantalla(`${cabecera(foco ? 'Ir a ' + e(foco.id) : 'NC a tu alrededor', foco ? e(lugarTxt(foco)) : `${lista.length} con ubicación · tocá una tarjeta`)}
      <div class="ra-guia" id="raGuia"><span class="mano"></span>Girá despacio: cada tarjeta queda fija donde se levantó la falla.</div>
      <div class="ra-bot" id="raBot"><div class="ra-res" id="raRes" aria-live="polite">Buscando tu ubicación…</div>
        <div class="ra-giro" aria-label="Corregir dirección de las tarjetas"><button id="gIzq" aria-label="Girar tarjetas a la izquierda">⟲ 10°</button><button id="gDer" aria-label="Girar tarjetas a la derecha">10° ⟳</button></div>
        <div class="ra-fila"><button class="ra-btn sec" id="raMapa">${ico(P.mapa)} Mapa</button></div></div>`, 'Buscar no conformidades en realidad aumentada');
    scr.style.background = 'transparent';
    [scr.querySelector('.ra-top'), $('raBot')].forEach(el => el.addEventListener('beforexrselect', ev => ev.preventDefault()));
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true; renderer.domElement.className = 'ra-cv'; scr.prepend(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 80);
    const session = await navigator.xr.requestSession('immersive-ar', { optionalFeatures: ['dom-overlay', 'local-floor'], domOverlay: { root: scr } });
    let piso = -1.45;
    try { await session.requestReferenceSpace('local-floor'); renderer.xr.setReferenceSpaceType('local-floor'); piso = 0; } catch (_) { renderer.xr.setReferenceSpaceType('local'); }
    await renderer.xr.setSession(session);
    await esperarRumbo(1500);
    const capa = capaGeo(THREE, scene, renderer, lista, { piso });
    let terminado = false;
    const fin = async (sig) => {
      if (terminado) return; terminado = true;
      renderer.setAnimationLoop(null);
      try { await session.end(); } catch (_) {}
      capa.dispose(); renderer.dispose(); salirTodo();
      if (sig === 'mapa') mapa(null, focoId);
    };
    session.addEventListener('end', () => { if (!terminado) { terminado = true; renderer.setAnimationLoop(null); salirTodo(); } });
    limpiezas.push(() => { if (!terminado) { terminado = true; try { session.end(); } catch (_) {} } });
    $('raX').onclick = () => fin();
    $('raMapa').onclick = () => fin('mapa');
    $('gIzq').onclick = () => { capa.girar(-10); vibrar(10); };
    $('gDer').onclick = () => { capa.girar(10); vibrar(10); };
    const controller = renderer.xr.getController(0);
    controller.addEventListener('select', () => { const id = capa.elegir(controller); if (id) mostrarHoja(id); });
    scene.add(controller);
    const texto = () => {
      pintarChips();
      const yo = geoFresco(); const r = $('raRes'); if (!r) return;
      if (!yo) { r.textContent = 'Buscando tu ubicación… salí de las cámaras de frío si no aparece.'; return; }
      if (!capa.listo()) capa.ubicar();
      const it = lista.map(l => ({ l, d: distancia(yo, l.ra), b: rumbo(yo, l.ra) })).sort((a, b) => a.d - b.d)[0];
      r.innerHTML = `${foco ? '' : 'La más cercana: '}<b>${e(it.l.id)}</b> a <b>${fmtM(it.d)}</b>, hacia el ${cardinal(it.b)}.${BRU.rumbo == null ? ' Sin brújula: si las tarjetas quedan corridas, giralas con ⟲ ⟳.' : ''}${yo.acc > 20 ? ` GPS ±${Math.round(yo.acc)} m: guiate también por el sector.` : ''}`;
    };
    GEO.subs.add(texto); texto();
    const tic = setInterval(texto, 1500); limpiezas.push(() => clearInterval(tic));
    const reloj = new THREE.Clock(); let ocultaGuia = false;
    renderer.setAnimationLoop(() => {
      const k = reloj.getElapsedTime();
      if (!capa.listo()) capa.ubicar();
      else if (!ocultaGuia && k > 3) { ocultaGuia = true; const g = $('raGuia'); if (g) g.classList.add('off'); }
      capa.pulso(REDUCE ? 0 : k);
      if ((k * 2 | 0) % 2 === 0) capa.actualizarDistancias();
      renderer.render(scene, camera);
    });
  }

  /* ---------- 2b · Cámara + brújula (iPhone, PC, Android sin ARCore) --- */
  const FOV_H = 62;
  async function radarCamara(lista, focoId, brOk) {
    const foco = focoId ? lista[0] : null;
    const scr = abrirPantalla(`<video id="raVid" autoplay playsinline muted></video>
      ${cabecera(foco ? 'Ir a ' + e(foco.id) : 'NC a tu alrededor', foco ? e(lugarTxt(foco)) : `${lista.length} con ubicación · tocá una tarjeta`)}
      <div class="ra-capa" id="raCapa"></div>
      <div class="ra-dial" id="raDial" aria-hidden="true"><i class="yo"></i><small>50 m</small></div>
      <div class="ra-bot"><div class="ra-res" id="raRes" aria-live="polite">Buscando tu ubicación…</div>
        <div class="ra-fila"><button class="ra-btn sec" id="raMapa">${ico(P.mapa)} Ver en el mapa</button></div></div>`, 'Buscar no conformidades con la cámara');
    let stream = null;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); }
    catch (_) { cerrarPantalla(); aviso('err', 'Cámara no disponible', 'Sin permiso de cámara. Te muestro el mapa.'); mapa(null, focoId); return; }
    $('raVid').srcObject = stream;
    limpiezas.push(() => stream.getTracks().forEach(t => t.stop()));
    $('raX').onclick = salirTodo;
    $('raMapa').onclick = () => { salirTodo(); mapa(null, focoId); };

    // Un nodo por NC (se crean una vez; cada cuadro sólo se mueven).
    const capa = $('raCapa'), dial = $('raDial');
    const nodos = new Map();
    lista.forEach(l => {
      const el = document.createElement('div'); el.className = 'ra-ancla' + (foco ? ' foco' : ''); el.dataset.id = l.id; el.style.opacity = '0';
      el.style.setProperty('--tc', GRUPOS[grupoDe(l.estado)].c);
      el.innerHTML = `<div class="tg-w"></div><div class="hilo"></div><div class="pie"></div>`;
      el.addEventListener('click', ev => { ev.stopPropagation(); mostrarHoja(l.id); });
      capa.appendChild(el);
      const pt = document.createElement('i'); pt.style.background = GRUPOS[grupoDe(l.estado)].c; dial.appendChild(pt);
      nodos.set(l.id, { el, pt, x: null, y: null, s: 1, ultD: null, w: el.querySelector('.tg-w') });
    });
    const flechas = document.createElement('div'); capa.appendChild(flechas);
    let raf = 0, ultTexto = 0, ultChip = 0;
    const cuadro = (ts) => {
      raf = requestAnimationFrame(cuadro);
      const yo = geoFresco(), W = innerWidth, H = innerHeight;
      if (ts - ultChip > 900 && (ultChip = ts)) pintarChips(BRU.rumbo == null ? `<span class="ra-chip off"><i></i>${brOk ? 'Calibrando brújula: mové el celular en forma de 8' : 'Sin brújula'}</span>` : '');
      if (!yo) { if (ts - ultTexto > 900) { $('raRes').textContent = 'Buscando tu ubicación… salí de las cámaras de frío si no aparece.'; ultTexto = ts; } return; }
      const items = lista.map(l => ({ l, d: distancia(yo, l.ra), b: rumbo(yo, l.ra) })).sort((a, b) => a.d - b.d);
      const horizonte = H * 0.52 + (BRU.beta - 90) * (H / 55);
      let fl = '';
      const ocupados = [];
      items.forEach((x, i) => {
        const n = nodos.get(x.l.id);
        // La tarjeta se redibuja sólo si la distancia cambió (no en cada cuadro).
        if (n.ultD == null || Math.abs(n.ultD - x.d) > 1) { n.ultD = x.d; n.w.innerHTML = tagHtml(x.l, { dist: x.d, lugar: false }); }
        if (BRU.rumbo == null) { n.el.style.opacity = '0'; n.pt.style.display = 'none'; return; }
        const dx = difAng(x.b, BRU.rumbo);
        // Radar de bolsillo: arriba = hacia donde mirás.
        const rr = Math.min(1, x.d / 50) * 44, aa = rad(dx);
        n.pt.style.display = ''; n.pt.style.left = (52 + Math.sin(aa) * rr) + 'px'; n.pt.style.top = (52 - Math.cos(aa) * rr) + 'px';
        const visible = Math.abs(dx) <= FOV_H / 2 + 4 && (foco || x.d <= 400);
        if (visible) {
          const tx = W / 2 + dx / (FOV_H / 2) * (W / 2);
          const s = foco ? 1 : Math.max(.62, Math.min(1, 1.15 - x.d / 70));
          let ty = horizonte - (1 - s) * 60;
          // Si otra tarjeta más cercana ya está en ese lugar, ésta sube un escalón.
          while (ty > H * .42 && ocupados.some(o => Math.abs(o.x - tx) < 190 * Math.min(o.s, s) && Math.abs(o.y - ty) < 70)) ty -= 74;
          ocupados.push({ x: tx, y: ty, s });
          // Suavizado: la tarjeta no tiembla con el sensor.
          n.x = n.x == null ? tx : n.x + (tx - n.x) * (REDUCE ? 1 : .22);
          n.y = n.y == null ? ty : n.y + (ty - n.y) * (REDUCE ? 1 : .22);
          n.s = s;
          n.el.style.transform = `translate(${n.x.toFixed(1)}px,${n.y.toFixed(1)}px) translate(-50%,-100%) scale(${s.toFixed(3)})`;
          n.el.style.opacity = '1'; n.el.style.zIndex = String(1000 - Math.round(x.d));
        } else {
          n.el.style.opacity = '0'; n.x = null;
          if (foco || i < 2) {
            const izq = dx < 0, c = GRUPOS[grupoDe(x.l.estado)];
            fl += `<div class="ra-flecha" style="left:${izq ? 40 : W - 40}px;top:${H * .48 + i * 64}px;background:${c.c};color:${c.tx};transform:rotate(${izq ? -90 : 90}deg)">${FLECHA}</div>`;
          }
        }
      });
      flechas.innerHTML = fl;
      if (ts - ultTexto > 600) {
        ultTexto = ts;
        const c0 = items[0], dx0 = BRU.rumbo != null ? difAng(c0.b, BRU.rumbo) : null;
        const giro = dx0 == null ? '' : Math.abs(dx0) < 12 ? ' · <b>está al frente</b>' : ` · girá a la ${dx0 > 0 ? 'derecha' : 'izquierda'} ${Math.abs(Math.round(dx0))}°`;
        $('raRes').innerHTML = `${foco ? '' : 'La más cercana: '}<b>${e(c0.l.id)}</b> a <b>${fmtM(c0.d)}</b>, hacia el ${cardinal(c0.b)}${giro}${yo.acc > 20 ? `<br>GPS ±${Math.round(yo.acc)} m: guiate también por el sector «${e(c0.l.sector || '')}».` : ''}`;
      }
    };
    raf = requestAnimationFrame(cuadro);
    limpiezas.push(() => cancelAnimationFrame(raf));
  }

  /* =====================================================================
     3 · MAPA DE NC (vista para todos los roles)
     ===================================================================== */
  const MP = { filtro: 'abiertas', sel: null, zoom: 1, cx: 0, cy: 0, recId: null, geoOff: null, montado: false, ajustado: false };
  const FILTROS = [
    { k: 'abiertas', t: 'Abiertas', f: l => l.estado !== 'cerrado' },
    { k: 'pendiente', t: 'Pendientes', f: l => grupoDe(l.estado) === 'pendiente' },
    { k: 'programado', t: 'Programadas', f: l => grupoDe(l.estado) === 'programado' },
    { k: 'resuelto', t: 'Resueltas', f: l => grupoDe(l.estado) === 'resuelto' },
    { k: 'rep', t: 'Reincidencias', f: l => reincidenciasDe(l).length > 0 },
    { k: 'todas', t: 'Todas', f: () => true }
  ];
  const filtroDe = k => FILTROS.find(x => x.k === k) || FILTROS[0];
  function listaMapa() {
    const base = todas().filter(l => !MP.recId || l.rec === MP.recId || (l.recs || []).includes(MP.recId));
    return base.filter(filtroDe(MP.filtro).f);
  }
  /* Abre la vista Mapa (desde la Ruta, la ficha o el radar). */
  function mapa(recId, focoId) {
    MP.recId = recId || null;
    if (focoId) { MP.sel = focoId; const l = typeof levPara === 'function' ? levPara(focoId) : null; if (l && !filtroDe(MP.filtro).f(l)) MP.filtro = 'todas'; }
    MP.ajustado = false;
    if (typeof closeModal === 'function') try { closeModal(); } catch (_) {}
    if (typeof go === 'function') go('mapa');
  }
  function vMapa() {
    const base = todas().filter(l => !MP.recId || l.rec === MP.recId || (l.recs || []).includes(MP.recId));
    const cont = k => base.filter(filtroDe(k).f).length;
    const conGps = base.filter(conUbic).length;
    const pl = (typeof PLANTAS !== 'undefined' && PLANTAS[plantaActual]) ? PLANTAS[plantaActual].label : '';
    const forma = { pendiente: formaSvg('pendiente'), programado: formaSvg('programado'), resuelto: formaSvg('resuelto'), abiertas: '', todas: '', rep: '<span class="sh"></span>' };
    return `<div class="mp">
      <div class="mp-cab"><div><h2>Mapa de no conformidades</h2>
        <p>${e(pl)}${MP.recId ? ' · recorrido ' + e(MP.recId) : ''} · ${conGps} de ${base.length} con ubicación. Tocá un punto para ver en qué estado está y cómo llegar.</p></div>
        <div class="mp-acc">${MP.recId ? `<button class="btn btn-quiet" onclick="SIMA_RA.mapa()">Ver toda la planta</button>` : ''}
          <button class="btn btn-primary" onclick="SIMA_RA.radar()">${ico(P.ra)} Buscar con la cámara</button></div></div>
      <div class="mp-fil" role="toolbar" aria-label="Filtrar por estado">${FILTROS.map(f => `<button type="button" class="mp-f ${f.k === 'rep' ? 'rep' : ''}" aria-pressed="${MP.filtro === f.k}" onclick="SIMA_RA._filtro('${f.k}')">${forma[f.k] || ''}${f.t} <b>${cont(f.k)}</b></button>`).join('')}</div>
      <div class="mp-cuerpo">
        <div class="mp-lienzo" id="mpLienzo" aria-label="Mapa: arrastrá para moverte, pellizcá o usá + y − para acercar">
          <div class="mp-norte" aria-hidden="true">N ▲</div>
          <div class="mp-ctl"><button type="button" onclick="SIMA_RA._zoom(1.4)" aria-label="Acercar"><span aria-hidden="true">+</span></button><button type="button" onclick="SIMA_RA._zoom(1/1.4)" aria-label="Alejar"><span aria-hidden="true">−</span></button><button type="button" onclick="SIMA_RA._centrar()" aria-label="Centrar en mi posición">${ico(P.yo, 20)}</button></div>
          <svg id="mpSvg" role="group" aria-label="Puntos de no conformidad"></svg>
          <div class="mp-esc" id="mpEsc"></div>
        </div>
        <div class="mp-lado">
          <div class="mp-sel" id="mpSel"></div>
          <div id="mpSimi"></div>
        </div>
      </div>
      <div class="mp-lista" id="mpLista"></div>
    </div>`;
  }
  /* Se llama después de render(): arma el SVG y los gestos. */
  function montarMapa() {
    const lz = $('mpLienzo'); if (!lz) return;
    if (!MP.geoOff) { geoIniciar(); const f = () => { if ($('mpSvg')) dibujarMapa(); }; GEO.subs.add(f); MP.geoOff = () => { GEO.subs.delete(f); geoDetener(); }; }
    gestos(lz);
    dibujarMapa(); pintarSel(); pintarLista(); pintarSimiMapa();
  }
  // Proyección local en metros alrededor de un centro fijo.
  let ORIG = null;
  function origen() {
    const pts = todas().filter(conUbic).map(l => l.ra), yo = geoFresco();
    if (!pts.length && !yo) return null;
    if (!ORIG) { const a = pts.length ? pts : [yo]; ORIG = { lat: a.reduce((s, p) => s + p.lat, 0) / a.length, lon: a.reduce((s, p) => s + p.lon, 0) / a.length }; }
    return ORIG;
  }
  const aMetros = p => { const o = ORIG; return { x: (p.lon - o.lon) * 111320 * Math.cos(rad(o.lat)), y: -(p.lat - o.lat) * 110540 }; };
  function ajustar(lista, W, H) {
    const pts = lista.filter(conUbic).map(l => aMetros(l.ra)); const yo = geoFresco(); if (yo) pts.push(aMetros(yo));
    if (!pts.length) { MP.zoom = 4; MP.cx = 0; MP.cy = 0; return; }
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    MP.cx = (minx + maxx) / 2; MP.cy = (miny + maxy) / 2;
    const ext = Math.max(30, maxx - minx, maxy - miny) * 1.3;
    MP.zoom = Math.min(W, H) / ext;
  }
  function dibujarMapa() {
    const svg = $('mpSvg'), lz = $('mpLienzo'); if (!svg || !lz) return;
    const W = lz.clientWidth, H = lz.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const lista = listaMapa().filter(conUbic);
    if (!origen()) {
      svg.innerHTML = '';
      lz.querySelector('.mp-vacio') || lz.insertAdjacentHTML('beforeend', `<div class="mp-vacio"><div><b>Todavía no hay NC con ubicación</b>Marcalas desde la Ruta de inspección con «Marcar NC en RA»: cada una aparece acá en su lugar.</div></div>`);
      return;
    }
    const v = lz.querySelector('.mp-vacio'); if (v) v.remove();
    if (!MP.ajustado) { ajustar(MP.sel ? [levPara(MP.sel)].filter(Boolean) : listaMapa(), W, H); if (MP.sel) MP.zoom = Math.max(MP.zoom, 6); MP.ajustado = true; }
    const S = p => { const m = aMetros(p); return { x: W / 2 + (m.x - MP.cx) * MP.zoom, y: H / 2 + (m.y - MP.cy) * MP.zoom }; };
    // Grilla cada «paso» metros, con línea mayor cada 5.
    const paso = [2, 5, 10, 20, 50, 100, 200, 500].find(m => m * MP.zoom >= 36) || 1000;
    let gr = '';
    const x0 = MP.cx - W / 2 / MP.zoom, y0 = MP.cy - H / 2 / MP.zoom;
    for (let gx = Math.floor(x0 / paso) * paso; gx < x0 + W / MP.zoom; gx += paso) { const sx = W / 2 + (gx - MP.cx) * MP.zoom; gr += `<line class="${Math.round(gx / paso) % 5 === 0 ? 'm' : ''}" x1="${sx}" y1="0" x2="${sx}" y2="${H}"/>`; }
    for (let gy = Math.floor(y0 / paso) * paso; gy < y0 + H / MP.zoom; gy += paso) { const sy = H / 2 + (gy - MP.cy) * MP.zoom; gr += `<line class="${Math.round(gy / paso) % 5 === 0 ? 'm' : ''}" x1="0" y1="${sy}" x2="${W}" y2="${sy}"/>`; }
    // Focos de reincidencia: aro con franjas.
    const fo = focos().filter(f => conUbic(f.ref)).map(f => {
      const p = S(f.ref.ra), r = Math.max(22, RADIO_REP * MP.zoom);
      return `<g aria-hidden="true"><circle cx="${p.x}" cy="${p.y}" r="${r}" fill="rgba(242,183,5,.10)" stroke="#F2B705" stroke-width="3" stroke-dasharray="8 6"/>
        <g transform="translate(${p.x + r * .72},${p.y - r * .72})"><rect x="-15" y="-11" width="30" height="22" rx="6" fill="#F2B705"/><text x="0" y="5" text-anchor="middle" style="fill:#14130F;stroke:none;font:800 12px var(--sans,system-ui)">×${f.ncs.length}</text></g></g>`;
    }).join('');
    // Etiquetas sin encimarse: primero la elegida, después las más recientes.
    const conTexto = new Set(), puestos = [];
    lista.slice().sort((a, b) => (b.id === MP.sel) - (a.id === MP.sel) || (b.fechaDet || '').localeCompare(a.fechaDet || '')).forEach(l => {
      if (!(MP.zoom > 2.2 || l.id === MP.sel)) return;
      const p = S(l.ra);
      if (puestos.every(q => Math.abs(q.x - p.x) > 64 || Math.abs(q.y - p.y) > 22)) { puestos.push(p); conTexto.add(l.id); }
    });
    const pts = lista.slice().sort((a, b) => (a.id === MP.sel) - (b.id === MP.sel)).map(l => {
      const p = S(l.ra), g = grupoDe(l.estado), G = GRUPOS[g], sel = MP.sel === l.id;
      const acc = l.ra.acc ? Math.min(160, l.ra.acc * MP.zoom) : 0;
      const sh = g === 'programado' ? `<path d="M0 -13 L13 0 L0 13 L-13 0 Z" fill="${G.c}" stroke="#fff" stroke-width="2.5"/>`
        : g === 'resuelto' ? `<circle r="11" fill="${G.c}" stroke="#fff" stroke-width="2.5"/><path d="M-5 0.5l3.3 3.3 6.3-6.6" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`
        : `<circle r="11" fill="${G.c}" stroke="#fff" stroke-width="2.5"/><path d="M0 -5v5.5M0 4.6v.2" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>`;
      return `<g class="mp-pt ${sel ? 'sel' : ''}" tabindex="0" role="button" data-id="${e(l.id)}" aria-label="${e(l.id)}, ${e(G.t)}, ${e(catTxt(l))}" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})">
        ${acc > 14 ? `<circle r="${acc}" fill="${G.c}" opacity=".09"/>` : ''}<circle class="halo" r="19"/>${sh}
        ${conTexto.has(l.id) ? `<text y="-19" text-anchor="middle">${e(l.id)}</text>` : ''}</g>`;
    }).join('');
    const yo = geoFresco();
    const yoSvg = yo ? (() => { const p = S(yo), r = Math.min(200, yo.acc * MP.zoom); return `<g aria-label="Tu posición"><circle cx="${p.x}" cy="${p.y}" r="${r}" fill="#4DA3FF" opacity=".14"/>${BRU.rumbo != null ? `<path d="M${p.x} ${p.y} L${p.x - 16} ${p.y - 38} A40 40 0 0 1 ${p.x + 16} ${p.y - 38} Z" fill="#4DA3FF" opacity=".35" transform="rotate(${BRU.rumbo} ${p.x} ${p.y})"/>` : ''}<circle cx="${p.x}" cy="${p.y}" r="8" fill="#4DA3FF" stroke="#fff" stroke-width="3"/></g>`; })() : '';
    svg.innerHTML = `<g class="grilla">${gr}</g>${fo}${pts}${yoSvg}`;
    svg.querySelectorAll('.mp-pt').forEach(n => {
      const elegir = () => { MP.sel = n.dataset.id; dibujarMapa(); pintarSel(); pintarLista(); };
      n.addEventListener('click', ev => { if (MP._movio) return; ev.stopPropagation(); elegir(); });
      n.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); elegir(); } });
    });
    const esc_ = $('mpEsc'); if (esc_) esc_.innerHTML = `<span>${fmtM(paso)}</span><i style="width:${paso * MP.zoom}px"></i>`;
  }
  function gestos(lz) {
    if (lz.dataset.g) return; lz.dataset.g = '1';
    const ptrs = new Map(); let d0 = 0, z0 = 1, ini = null;
    lz.addEventListener('pointerdown', ev => {
      if (ev.target.closest('.mp-ctl')) return;
      lz.setPointerCapture(ev.pointerId); ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      MP._movio = false; ini = { x: ev.clientX, y: ev.clientY, cx: MP.cx, cy: MP.cy };
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; d0 = Math.hypot(a.x - b.x, a.y - b.y); z0 = MP.zoom; }
    });
    lz.addEventListener('pointermove', ev => {
      if (!ptrs.has(ev.pointerId)) return;
      ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (d0) { MP.zoom = Math.min(80, Math.max(.05, z0 * d / d0)); MP._movio = true; dibujarMapa(); } return; }
      if (!ini) return;
      const dx = ev.clientX - ini.x, dy = ev.clientY - ini.y;
      if (Math.hypot(dx, dy) > 6) { MP._movio = true; lz.classList.add('arrastra'); }
      if (MP._movio) { MP.cx = ini.cx - dx / MP.zoom; MP.cy = ini.cy - dy / MP.zoom; dibujarMapa(); }
    });
    const soltar = ev => { ptrs.delete(ev.pointerId); if (ptrs.size < 2) d0 = 0; if (!ptrs.size) { lz.classList.remove('arrastra'); ini = null; setTimeout(() => { MP._movio = false; }, 0); } };
    lz.addEventListener('pointerup', soltar); lz.addEventListener('pointercancel', soltar);
    lz.addEventListener('wheel', ev => { ev.preventDefault(); MP.zoom = Math.min(80, Math.max(.05, MP.zoom * (ev.deltaY < 0 ? 1.15 : 1 / 1.15))); dibujarMapa(); }, { passive: false });
  }
  function pintarSel() {
    const z = $('mpSel'); if (!z) return;
    const l = MP.sel && typeof levPara === 'function' ? levPara(MP.sel) : null;
    if (!l) { z.innerHTML = `<div class="mp-sel-vacio"><b style="color:var(--tx)">Elegí un punto</b><br>Vas a ver su tarjeta: en qué estado está, hace cuántos días está abierta y cómo llegar.</div>`; return; }
    const yo = geoFresco(), d = yo && conUbic(l) ? distancia(yo, l.ra) : null;
    z.innerHTML = `${tagHtml(l, { dist: d, lugar: true })}
      <div class="mp-sel-acc">
        ${conUbic(l) ? `<button class="btn btn-primary" onclick="SIMA_RA.radar('${e(l.id)}')">${ico(P.ir)} Ir hasta la NC</button>` : ''}
        <button class="btn btn-ghost" onclick="openDetalle('${e(l.id)}')">${ico(P.ficha)} Ver ficha</button>
        ${conUbic(l) ? `<a class="btn btn-quiet" href="https://www.google.com/maps/dir/?api=1&destination=${fmtC(l.ra.lat)},${fmtC(l.ra.lon)}&travelmode=walking" target="_blank" rel="noopener">${ico(P.ext)} Google Maps</a>` : ''}
      </div>`;
  }
  function pintarLista() {
    const z = $('mpLista'); if (!z) return;
    const yo = geoFresco();
    const lista = listaMapa().slice().sort((a, b) => {
      if (yo && conUbic(a) && conUbic(b)) return distancia(yo, a.ra) - distancia(yo, b.ra);
      if (conUbic(a) !== conUbic(b)) return conUbic(a) ? -1 : 1;
      return (a.fechaDet || '').localeCompare(b.fechaDet || '');
    });
    const sin = lista.filter(l => !conUbic(l)).length;
    z.innerHTML = lista.length ? lista.slice(0, 120).map(l => {
      const f = ficha(l), d = yo && conUbic(l) ? distancia(yo, l.ra) : null;
      return `<button type="button" class="mp-it ${MP.sel === l.id ? 'sel' : ''}" onclick="SIMA_RA._elegir('${e(l.id)}')">${formaSvg(f.g)}
        <span class="it-t"><b>${e(l.id)}</b> ${e(f.cat)}${f.rep ? `<span class="rep">×${f.rep + 1}</span>` : ''}<small>${e(f.G.t)} · ${e(f.lugar)}${conUbic(l) ? '' : ' · sin ubicación'}</small></span>
        <span class="it-d"><b>${f.dias == null ? '—' : f.dias + ' d'}</b>${d != null ? fmtM(d) : (f.g === 'resuelto' ? 'cerrada' : 'abierta')}</span></button>`;
    }).join('') + (sin ? `<div class="mp-sin">${sin} ${sin === 1 ? 'NC no tiene' : 'NC no tienen'} ubicación GPS (se cargaron sin RA o sin señal): figuran en la lista por su sector.</div>` : '')
      : `<div class="mp-sin">No hay NC con este filtro.</div>`;
  }
  function pintarSimiMapa() {
    const z = $('mpSimi'); if (!z) return;
    const fs = focos().slice(0, 3);
    if (!fs.length) { z.innerHTML = `<div class="mp-simi">${simiMini()}<div class="ms"><b>Sin reincidencias</b><br>No hay lugares con NC repetidas en los últimos ${REP_DIAS} días. Si aparece una, te aviso acá y al marcarla.</div></div>`; return; }
    z.innerHTML = `<div class="mp-simi">${simiMini()}<div class="ms"><b>${fs.length === 1 ? 'Un lugar se repite' : fs.length + ' lugares se repiten'}</b><br>Conviene atacar la causa, no sólo el síntoma.
      ${fs.map(f => `<button type="button" onclick="SIMA_RA._elegir('${e(f.ref.id)}',true)">${e(lugarTxt(f.ref))}<em>×${f.ncs.length}</em></button>`).join('')}</div></div>`;
  }
  const API_MAPA = {
    _filtro(k) { MP.filtro = k; MP.ajustado = false; if (typeof render === 'function') render(); },
    _zoom(k) { MP.zoom = Math.min(80, Math.max(.05, MP.zoom * k)); dibujarMapa(); },
    _centrar() { const yo = geoFresco(); if (!yo) { aviso('info', 'Sin ubicación todavía', 'Activá el GPS o salí de la cámara de frío.'); return; } origen(); const m = aMetros(yo); MP.cx = m.x; MP.cy = m.y; MP.zoom = Math.max(MP.zoom, 4); dibujarMapa(); },
    _elegir(id, centrar) {
      MP.sel = id; const l = levPara(id);
      if (l && !filtroDe(MP.filtro).f(l)) { MP.filtro = 'todas'; if (typeof render === 'function') render(); }
      if (l && conUbic(l) && (centrar || true)) { origen(); const m = aMetros(l.ra); MP.cx = m.x; MP.cy = m.y; MP.zoom = Math.max(MP.zoom, 5); }
      dibujarMapa(); pintarSel(); pintarLista();
      const s = $('mpLienzo'); if (s && s.getBoundingClientRect().top < 0) s.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' });
    }
  };
  // Al salir de la vista se apaga el GPS del mapa (lo llama render()).
  function salirMapa() { if (MP.geoOff) { MP.geoOff(); MP.geoOff = null; } }

  /* =====================================================================
     Integración con la carga de hallazgos y la ficha
     ===================================================================== */
  const METODO = { webxr: 'Pin en RA', camara: 'Pin sobre la foto', gps: 'GPS del momento', cloud: 'Ancla en la nube (app SIMA RA)' };
  function texto(l) {
    const r = l && l.ra; if (!r) return '—';
    const partes = [METODO[r.metodo] || 'RA'];
    if (typeof r.lat === 'number') partes.push(`${fmtC(r.lat)}, ${fmtC(r.lon)}${r.acc ? ' (±' + Math.round(r.acc) + ' m)' : ''}`); else partes.push('sin GPS');
    if (r.dist) partes.push(`a ${String(r.dist).replace('.', ',')} m del Inspector${r.rumbo != null ? ' hacia el ' + cardinal(r.rumbo) : ''}`);
    return partes.join(' · ');
  }
  function notaReincidencia(lista, titulo) {
    if (!lista.length) return '';
    const ab = lista.filter(l => l.estado !== 'cerrado').length;
    return `<div class="ra-rep-note" role="alert">${simiMini()}<div><span class="st"></span><b>${titulo || (lista.length === 1 ? 'SIMI: acá ya hubo una NC' : `SIMI: acá ya hubo ${lista.length} NC`)}</b> en los últimos ${REP_DIAS} días${ab ? ` (${ab} abierta${ab > 1 ? 's' : ''})` : ''}: ${lista.slice(0, 4).map(l => `<a href="#" onclick="event.preventDefault();openDetalle('${e(l.id)}')">${e(l.id)}</a> ${e(catTxt(l))}`).join(' · ')}. Si es la misma, no la cargues de nuevo; si volvió a aparecer, anotá la causa probable en la descripción.</div></div>`;
  }
  function tarjetaCaptura(ra, conBoton) {
    const f = geoFresco();
    const punto = ra && typeof ra.lat === 'number' ? ra : (f ? { lat: f.lat, lon: f.lon, acc: f.acc } : null);
    const rep = notaReincidencia(punto ? cercanasA(punto, 8) : []);
    if (rep) { const fab = document.querySelector('#simiFab .simi-svg'); if (fab && window.SIMI_M) SIMI_M.humor(fab, 'alerta', 2600); }
    if (!ra) {
      return `<div class="ra-card"><span class="rc-ico">${ico(P.ra, 20)}</span>
        <div class="rc-t"><b>Sin marca RA</b>${f ? `Se guarda la ubicación GPS del momento (±${Math.round(f.acc)} m).` : (GEO.err ? e(GEO.err) + ': queda sólo el sector.' : 'Buscando GPS para guardar la ubicación…')}</div>
        ${conBoton ? `<button type="button" class="btn btn-sm btn-ghost" onclick="SIMA_RA.remarcar()">${ico(P.ra, 16)} Marcar en RA</button>` : ''}</div>${rep}`;
    }
    return `<div class="ra-card"><span class="rc-ico">${ico(P.ra, 20)}</span>
      <div class="rc-t"><b>NC marcada · ${e(METODO[ra.metodo] || 'RA')}</b>${typeof ra.lat === 'number' ? `${fmtC(ra.lat)}, ${fmtC(ra.lon)}${ra.acc ? ' · ±' + Math.round(ra.acc) + ' m' : ''}${ra.dist ? ' · a ' + String(ra.dist).replace('.', ',') + ' m' : ''}` : 'Sin GPS en este lugar: queda con el sector elegido.'}</div>
      ${conBoton && ra.metodo !== 'cloud' ? `<button type="button" class="btn btn-sm btn-quiet" onclick="SIMA_RA.remarcar()">Volver a marcar</button>` : ''}</div>${rep}`;
  }
  function remarcar() {
    const rec = (typeof capCtx !== 'undefined' && capCtx && capCtx.rec) || marcaRec;
    if (typeof closeModal === 'function') closeModal();
    marcar(rec);
  }
  function raParaGuardar(raCtx) {
    if (raCtx) {
      if (typeof raCtx.lat !== 'number') {
        const f = geoFresco();
        if (f) Object.assign(raCtx, { lat: +f.lat.toFixed(7), lon: +f.lon.toFixed(7), acc: Math.round(f.acc * 10) / 10, insp: { lat: +f.lat.toFixed(7), lon: +f.lon.toFixed(7) } });
      }
      return raCtx;
    }
    const f = geoFresco();
    if (!f) return null;
    const ra = { metodo: 'gps', lat: +f.lat.toFixed(7), lon: +f.lon.toFixed(7), acc: Math.round(f.acc * 10) / 10, d: new Date().toISOString(),
      by: (typeof ROLES !== 'undefined' && typeof role !== 'undefined' && ROLES[role]) ? ROLES[role].name : '' };
    ra.insp = { lat: ra.lat, lon: ra.lon };
    if (f.alt != null) ra.alt = Math.round(f.alt * 10) / 10;
    if (BRU.rumbo != null) ra.rumbo = Math.round(BRU.rumbo);
    return ra;
  }
  /* Después de guardar: SIMI avisa si la nueva NC reincide. */
  function alGuardar(l) {
    cacheRep = null;
    const r = reincidenciasDe(l);
    if (!r.length) return;
    const fab = document.querySelector('#simiFab .simi-svg'); if (fab && window.SIMI_M) SIMI_M.humor(fab, 'alerta', 3200);
    setTimeout(() => aviso('info', `SIMI: ${l.id} reincide`, `Es la ${r.length + 1}.ª NC en este lugar en ${REP_DIAS} días (${r.slice(0, 3).map(x => x.id).join(', ')}). Conviene revisar la causa raíz.`), 900);
  }
  function seguirGPS(fn) { geoIniciar(); GEO.subs.add(fn); return () => { GEO.subs.delete(fn); geoDetener(); }; }

  function botonesRuta(recId) {
    const n = ncsConUbic(false, recId).length;
    return `<div class="mode-grid mode-grid--ra" style="margin-bottom:14px">
      <button class="mode-card mode-card--primary" style="--glow:rgba(229,53,43,.30)" onclick="SIMA_RA.marcar('${e(recId)}')">
        <span class="m-tag">Realidad aumentada</span>
        <div class="m-ico">${ico(P.ra, 22)}</div>
        <h3>Marcar NC en RA</h3>
        <p>Apuntá a la falla y clavá el pin: queda su tarjeta en ese lugar, con la ubicación y la foto. SIMI te avisa si ahí ya hubo otra.</p>
        <span class="m-go">Marcar ${ico('<path d="M5 12h14M13 6l6 6-6 6"/>', 16)}</span>
      </button>
      <button class="mode-card" onclick="openCaptura({rec:'${e(recId)}'})">
        <span class="m-tag">Sin RA</span>
        <div class="m-ico">${ico(P.cam, 22)}</div>
        <h3>Cargar hallazgo</h3>
        <p>La carga de siempre: foto, dictado y sector. También guarda la ubicación GPS del momento.</p>
        <span class="m-go">Cargar ${ico('<path d="M5 12h14M13 6l6 6-6 6"/>', 16)}</span>
      </button>
    </div>
    <div class="ra-tools">
      <button class="btn btn-ghost" onclick="SIMA_RA.radar()">${ico(P.ra)} Buscar NC con la cámara</button>
      <button class="btn btn-ghost" onclick="SIMA_RA.mapa('${e(recId)}')">${ico(P.mapa)} Mapa del recorrido${n ? ' · ' + n : ''}</button>
    </div>`;
  }
  function accionesFicha(l) {
    const r = reincidenciasDe(l);
    const rep = r.length ? notaReincidencia(r, `SIMI: reincide en este lugar · ${r.length + 1} NC`) : '';
    if (!conUbic(l)) return rep;
    return `${rep}<div class="ra-acciones">
      <button class="btn btn-sm btn-primary" onclick="closeModal();SIMA_RA.radar('${e(l.id)}')">${ico(P.ir, 16)} Ir hasta la NC</button>
      <button class="btn btn-sm btn-ghost" onclick="closeModal();SIMA_RA.mapa(null,'${e(l.id)}')">${ico(P.mapa, 16)} Ver en el mapa</button>
      <a class="btn btn-sm btn-quiet" href="https://www.google.com/maps/dir/?api=1&destination=${fmtC(l.ra.lat)},${fmtC(l.ra.lon)}&travelmode=walking" target="_blank" rel="noopener">${ico(P.ext, 16)} Google Maps</a>
    </div>`;
  }

  /* =====================================================================
     Enlaces desde la app nativa (Unity + ARCore)
     · ?nc=LV-123          abre la ficha de esa NC
     · ?ancla=<id>&vence=AAAA-MM-DD&lat=..&lon=..&acc=..&dist=..
                           abre la carga de una NC nueva con el ancla puesta
     ===================================================================== */
  function procesarEnlace() {
    let q; try { q = new URLSearchParams(location.search); } catch (_) { return; }
    const nc = q.get('nc'), ancla = q.get('ancla');
    if (!nc && !ancla) return;
    const t0 = Date.now();
    const listo = () => typeof role !== 'undefined' && role && typeof DB !== 'undefined' && DB && DB.levantamientos && $('mainInner') && $('mainInner').children.length;
    const tic = setInterval(() => {
      if (Date.now() - t0 > 90000) { clearInterval(tic); return; }
      if (!listo()) return;
      clearInterval(tic);
      try { history.replaceState(null, '', location.pathname); } catch (_) {}
      if (nc && typeof openDetalle === 'function') {
        if (typeof levPara === 'function' && !levPara(nc)) { aviso('info', 'No encontré ' + nc, 'Puede ser de otra planta o todavía no se sincronizó.'); return; }
        openDetalle(nc); return;
      }
      if (!/^[A-Za-z0-9_\-:.]{6,200}$/.test(ancla)) { aviso('err', 'Ancla inválida', 'Volvé a marcar la NC desde la app.'); return; }
      const num = k => { const v = parseFloat(q.get(k)); return Number.isFinite(v) ? v : null; };
      const ra = { metodo: 'cloud', anclaId: ancla, d: new Date().toISOString(), by: (typeof ROLES !== 'undefined' && ROLES[role]) ? ROLES[role].name : '' };
      const v = q.get('vence'); if (/^\d{4}-\d{2}-\d{2}$/.test(v || '')) ra.anclaVence = v;
      if (num('lat') != null && num('lon') != null) { ra.lat = num('lat'); ra.lon = num('lon'); ra.insp = { lat: ra.lat, lon: ra.lon }; }
      if (num('acc') != null) ra.acc = num('acc');
      if (num('dist') != null) ra.dist = num('dist');
      const rec = typeof recEnCurso === 'function' ? recEnCurso() : null;
      if (!rec) aviso('info', 'No hay una ruta en curso', 'La NC se carga igual; para que quede en un recorrido, comenzá la ruta desde Inspección.');
      if (typeof openCaptura === 'function') openCaptura({ rec: rec ? rec.id : null, ra });
    }, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', procesarEnlace); else procesarEnlace();

  window.vMapaNC = vMapa;
  window.SIMA_RA = Object.assign({
    marcar, radar, mapa, montarMapa, salirMapa, texto, tarjetaCaptura, remarcar, raParaGuardar, alGuardar, seguirGPS,
    botonesRuta, accionesFicha, conUbic, ncsConUbic, hayXR, tagHtml, reincidenciasDe, focos, grupoDe,
    _geo: { distancia, rumbo, destino, difAng, BRU, GEO }
  }, API_MAPA);
  hayXR();
})();
