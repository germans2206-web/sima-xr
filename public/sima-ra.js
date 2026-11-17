/* =====================================================================
   SIMA RA · Ruta de inspección con realidad aumentada (17-11-26)
   ---------------------------------------------------------------------
   El Módulo 1 (Ruta de inspección) ahora marca cada no conformidad (NC)
   en el lugar donde está, con su ubicación:

   1. MARCAR NC EN RA  (window.SIMA_RA.marcar(recId))
      · Android + Chrome (WebXR «immersive-ar» con hit-test): la cámara
        detecta paredes, pisos y equipos; un aro sigue la superficie y al
        tocar la pantalla se clava un pin rojo «NC» sobre el punto exacto.
        Se calcula a qué distancia y en qué rumbo quedó el pin respecto del
        Inspector, y con el GPS se proyecta la coordenada de la NC.
      · iPhone / PC / celulares sin WebXR: modo cámara. Se toca el punto en
        la imagen, se clava el pin y se toma la foto con el pin dibujado
        (sirve directamente como foto de evidencia del «antes»).
      En los dos casos queda guardado en el hallazgo, en `l.ra`:
        { metodo:'webxr'|'camara'|'gps', lat, lon, acc, alt, rumbo, dist,
          insp:{lat,lon}, px:{x,y}, d, by }
      y se abre la carga de hallazgo de siempre con la ubicación ya fijada.

   2. VER NC EN RA  (SIMA_RA.radar(focoId?))
      RA por ubicación: sobre la cámara aparecen los pines de las NC abiertas
      cercanas, en la dirección real (GPS + brújula), con su distancia. Tocar
      un pin abre la ficha. Con un foco (desde la ficha) muestra sólo esa NC
      y una flecha que guía hasta ella.

   3. MAPA DE NC  (SIMA_RA.mapa(recId?))
      Plano sin conexión (SVG, sin mapas externos) con cada NC según su
      estado, la posición del Inspector y un enlace a Google Maps por punto.

   Si no hay GPS (cámaras de frío, interiores) la NC queda igual con su
   sector/subsector y se avisa la precisión. Nada bloquea la carga.
   ===================================================================== */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const e = s => (typeof esc === 'function' ? esc(s) : String(s == null ? '' : s));
  const aviso = (t, a, b) => { if (typeof toast === 'function') toast(t, a, b); };

  /* ---------- Geometría ------------------------------------------------ */
  const R_T = 6371000;
  const rad = d => d * Math.PI / 180, grad = r => r * 180 / Math.PI;
  const norm360 = a => ((a % 360) + 360) % 360;
  const difAng = (a, b) => { let d = norm360(a - b); if (d > 180) d -= 360; return d; };   // a - b en (-180, 180]
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
  const fmtM = m => m == null ? '—' : (m < 1 ? '<1 m' : m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km');
  const fmtC = n => (+n).toFixed(6);
  const PUNTOS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const cardinal = g => PUNTOS[Math.round(norm360(g) / 45) % 8];

  /* ---------- GPS ------------------------------------------------------ */
  // Se guarda el mejor dato de los últimos 20 s (menor error), no el último:
  // adentro de la planta el GPS salta mucho.
  const GEO = { fix: null, watch: null, err: '', subs: new Set() };
  function geoIniciar() {
    if (!('geolocation' in navigator)) { GEO.err = 'Este dispositivo no tiene GPS.'; return; }
    if (GEO.watch != null) return;
    GEO.watch = navigator.geolocation.watchPosition(p => {
      const c = p.coords, nuevo = { lat: c.latitude, lon: c.longitude, acc: c.accuracy, alt: c.altitude, t: Date.now() };
      const v = GEO.fix;
      if (!v || Date.now() - v.t > 20000 || nuevo.acc <= v.acc * 1.2) GEO.fix = nuevo;
      GEO.err = '';
      GEO.subs.forEach(f => { try { f(); } catch (_) {} });
    }, err => {
      GEO.err = err && err.code === 1 ? 'Sin permiso de ubicación.' : 'Sin señal de GPS (interior o cámara de frío).';
      GEO.subs.forEach(f => { try { f(); } catch (_) {} });
    }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
  }
  function geoDetener() {
    if (GEO.watch != null && !GEO.subs.size) { navigator.geolocation.clearWatch(GEO.watch); GEO.watch = null; }
  }
  const geoFresco = () => (GEO.fix && Date.now() - GEO.fix.t < 60000) ? GEO.fix : null;
  function geoChip() {
    const f = geoFresco();
    if (f) {
      const cls = f.acc <= 10 ? 'ok' : f.acc <= 30 ? 'med' : 'baja';
      return `<span class="ra-geo ${cls}"><i></i>GPS ±${Math.round(f.acc)} m${f.acc > 30 ? ' · precisión baja' : ''}</span>`;
    }
    return `<span class="ra-geo off"><i></i>${GEO.err ? e(GEO.err) : 'Buscando GPS…'}</span>`;
  }

  /* ---------- Brújula -------------------------------------------------- */
  const BRU = { rumbo: null, beta: 90, on: false, abs: false };
  function alOrientar(ev) {
    let h = null;
    if (typeof ev.webkitCompassHeading === 'number') h = ev.webkitCompassHeading;          // iPhone: ya es rumbo
    else if (ev.absolute && ev.alpha != null) h = 360 - ev.alpha;                           // Android absoluto
    else if (!BRU.abs && ev.alpha != null) h = 360 - ev.alpha;                              // relativo (mejor que nada)
    if (ev.type === 'deviceorientationabsolute') BRU.abs = true;
    else if (BRU.abs && typeof ev.webkitCompassHeading !== 'number') h = null;              // ya hay absoluto: ignorar relativo
    if (h != null) {
      const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
      const nuevo = norm360(h + ang);
      // Suavizado (los sensores tiemblan).
      BRU.rumbo = BRU.rumbo == null ? nuevo : norm360(BRU.rumbo + difAng(nuevo, BRU.rumbo) * 0.25);
    }
    if (ev.beta != null) BRU.beta = BRU.beta * 0.7 + ev.beta * 0.3;
  }
  async function brujulaIniciar() {
    if (BRU.on) return true;
    try {
      // iPhone pide permiso con un toque del usuario.
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r !== 'granted') return false;
      }
    } catch (_) { return false; }
    window.addEventListener('deviceorientationabsolute', alOrientar, true);
    window.addEventListener('deviceorientation', alOrientar, true);
    BRU.on = true;
    return true;
  }
  function brujulaDetener() {
    window.removeEventListener('deviceorientationabsolute', alOrientar, true);
    window.removeEventListener('deviceorientation', alOrientar, true);
    BRU.on = false; BRU.abs = false; BRU.rumbo = null;
  }

  /* ---------- Soporte -------------------------------------------------- */
  let soporteXR = null;
  async function hayXR() {
    if (soporteXR != null) return soporteXR;
    try { soporteXR = !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')); }
    catch (_) { soporteXR = false; }
    return soporteXR;
  }
  const hayCam = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  /* ---------- Estilos -------------------------------------------------- */
  const css = `
  .ra-screen{position:fixed;inset:0;z-index:300;background:#000;color:#fff;font-family:var(--sans,system-ui);touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden}
  .ra-screen[hidden]{display:none}
  .ra-screen video,.ra-screen canvas.ra-cv{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .ra-top{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:10px;padding:max(12px,env(safe-area-inset-top)) 14px 22px;background:linear-gradient(#000c,#0000);z-index:3}
  .ra-top b{font-size:15px;letter-spacing:.01em}
  .ra-top small{display:block;font-size:12px;color:#fffb;font-weight:500}
  .ra-x{margin-left:auto;width:42px;height:42px;border-radius:50%;border:0;background:#fff2;color:#fff;font-size:22px;line-height:1;cursor:pointer;backdrop-filter:blur(8px)}
  .ra-badge{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px;border-radius:999px;background:#FF3B30;font:700 11px var(--sans,system-ui);letter-spacing:.06em}
  .ra-geo{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;background:#0008;backdrop-filter:blur(8px)}
  .ra-geo i{width:8px;height:8px;border-radius:50%;background:#999}
  .ra-geo.ok i{background:#32D74B}.ra-geo.med i{background:#FFD60A}.ra-geo.baja i{background:#FF9F0A}.ra-geo.off i{background:#FF453A}
  .ra-info{position:absolute;left:0;right:0;top:calc(max(12px,env(safe-area-inset-top)) + 58px);display:flex;justify-content:center;gap:8px;flex-wrap:wrap;z-index:3;pointer-events:none;padding:0 14px}
  .ra-hint{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);max-width:300px;text-align:center;font-size:14px;line-height:1.45;background:#000a;padding:10px 14px;border-radius:14px;z-index:2;pointer-events:none;transition:opacity .25s}
  .ra-hint.off{opacity:0}
  .ra-mira{position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border:2px solid #fffc;border-radius:50%;z-index:2;pointer-events:none;box-shadow:0 0 0 1px #0006}
  .ra-mira::after{content:"";position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px;border-radius:50%;background:#fff}
  .ra-pin{position:absolute;z-index:2;transform:translate(-50%,-100%);pointer-events:none;filter:drop-shadow(0 3px 6px #0009)}
  .ra-pin svg{width:46px;height:58px;display:block}
  .ra-pin.cae{animation:raCae .45s cubic-bezier(.2,1.4,.4,1)}
  @keyframes raCae{from{transform:translate(-50%,-180%);opacity:0}to{transform:translate(-50%,-100%);opacity:1}}
  .ra-pin.cae::after{content:"";position:absolute;left:50%;bottom:-6px;width:30px;height:10px;margin-left:-15px;border-radius:50%;border:2px solid #FF3B30;animation:raOnda 1.4s ease-out infinite}
  @keyframes raOnda{from{transform:scale(.4);opacity:1}to{transform:scale(2.2);opacity:0}}
  .ra-bot{position:absolute;left:0;right:0;bottom:0;padding:26px 16px max(16px,env(safe-area-inset-bottom));background:linear-gradient(#0000,#000d);z-index:3;display:flex;flex-direction:column;gap:10px;align-items:stretch}
  .ra-fila{display:flex;gap:10px}
  .ra-fila>*{flex:1}
  .ra-btn{height:52px;border-radius:16px;border:0;font:700 15px var(--sans,system-ui);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 14px}
  .ra-btn.pri{background:#FF9F1C;color:#111}
  .ra-btn.rojo{background:#FF3B30;color:#fff}
  .ra-btn.sec{background:#fff2;color:#fff;backdrop-filter:blur(8px)}
  .ra-btn:disabled{opacity:.45}
  .ra-res{font-size:13px;line-height:1.45;color:#fffd;text-align:center}
  .ra-res b{color:#fff}
  .ra-marca{position:absolute;z-index:2;transform:translate(-50%,-100%);text-align:center;cursor:pointer;pointer-events:auto;transition:left .12s linear,top .12s linear}
  .ra-marca .mk{display:inline-flex;flex-direction:column;align-items:center}
  .ra-marca .mk-b{background:var(--mc,#FF3B30);color:#fff;border-radius:12px;padding:5px 9px;font:700 12px var(--sans,system-ui);white-space:nowrap;box-shadow:0 4px 14px #0008;max-width:180px;overflow:hidden;text-overflow:ellipsis}
  .ra-marca .mk-b small{display:block;font-weight:500;font-size:11px;opacity:.9}
  .ra-marca .mk-p{width:2px;height:22px;background:var(--mc,#FF3B30)}
  .ra-marca .mk-o{width:12px;height:12px;border-radius:50%;background:var(--mc,#FF3B30);border:2px solid #fff}
  .ra-marca.foco .mk-b{font-size:14px;padding:7px 12px}
  .ra-flecha{position:absolute;z-index:2;width:48px;height:48px;margin:-24px;border-radius:50%;background:#FF3B30;display:grid;place-items:center;box-shadow:0 4px 14px #0008}
  .ra-flecha svg{width:26px;height:26px}
  .ra-brujula{font-variant-numeric:tabular-nums}
  /* Ficha y captura */
  .ra-card{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:var(--s1);border:1px solid var(--line);margin-top:10px}
  .ra-card .rc-ico{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:rgba(255,59,48,.14);color:#FF3B30;flex-shrink:0}
  .ra-card .rc-ico svg{width:20px;height:20px}
  .ra-card .rc-t{flex:1;min-width:0;font-size:13px;line-height:1.45;color:var(--tx2)}
  .ra-card .rc-t b{display:block;color:var(--tx);font-size:13.5px}
  .ra-card .rc-acc{display:flex;gap:6px;flex-wrap:wrap}
  .ra-acciones{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
  /* Mapa */
  .ra-mapa{width:100%;height:auto;display:block;border-radius:14px;background:var(--s1);border:1px solid var(--line)}
  .ra-mapa text{font:600 10px var(--sans,system-ui);fill:var(--tx2)}
  .ra-mapa .pt{cursor:pointer}
  .ra-mapa .pt:hover circle,.ra-mapa .pt:focus circle{stroke-width:4}
  .ra-lista{margin-top:14px;display:flex;flex-direction:column;gap:6px}
  .ra-li{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:12px;background:var(--s1);font-size:13px;cursor:pointer}
  .ra-li:hover{background:var(--s2)}
  .ra-li i{width:10px;height:10px;border-radius:50%;flex-shrink:0}
  .ra-li span{flex:1;min-width:0}
  .ra-li small{color:var(--tx2)}
  .ra-li a{color:var(--amber);font-weight:600;text-decoration:none;white-space:nowrap}
  .ra-ley{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--tx2);margin-top:10px}
  .ra-ley span{display:inline-flex;align-items:center;gap:5px}
  .ra-ley i{width:9px;height:9px;border-radius:50%}
  .mode-grid--ra{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
  .ra-tools{display:flex;gap:8px;flex-wrap:wrap;margin:-8px 0 20px}
  `;
  const st = document.createElement('style'); st.id = 'sima-ra-css'; st.textContent = css; document.head.appendChild(st);

  const PIN_SVG = `<svg viewBox="0 0 46 58" aria-hidden="true"><path d="M23 56C23 56 4 34 4 21a19 19 0 0138 0c0 13-19 35-19 35z" fill="#FF3B30" stroke="#fff" stroke-width="3"/><text x="23" y="27" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="14" fill="#fff">NC</text></svg>`;
  const ICO_RA = '<path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/><path d="M12 7l4.5 2.6v5L12 17.2l-4.5-2.6v-5z"/><path d="M12 12l4.5-2.4M12 12v5.2M12 12L7.5 9.6"/>';
  const ICO_MAPA = '<path d="M9 20l-5.4-2.7A1 1 0 013 16.4V4.6a1 1 0 011.4-.9L9 6m0 14l6-3m-6 3V6m6 11l4.6 2.3a1 1 0 001.4-.9V7.6a1 1 0 00-.6-.9L15 4m0 13V4M9 6l6-2"/>';
  const ICO_RADAR = '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6-6"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>';
  const ICO_FLECHA = '<path d="M12 4l7 14-7-4-7 4z" fill="#fff"/>';
  const ico = (p, w = 18) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

  /* ---------- Pantalla completa --------------------------------------- */
  let pantalla = null;
  function abrirPantalla(html) {
    cerrarPantalla();
    pantalla = document.createElement('div');
    pantalla.className = 'ra-screen'; pantalla.id = 'raScreen';
    pantalla.setAttribute('role', 'dialog'); pantalla.setAttribute('aria-modal', 'true');
    pantalla.innerHTML = html;
    document.body.appendChild(pantalla);
    return pantalla;
  }
  let limpiezas = [];
  function cerrarPantalla() {
    limpiezas.forEach(f => { try { f(); } catch (_) {} }); limpiezas = [];
    if (pantalla) { pantalla.remove(); pantalla = null; }
  }

  /* =====================================================================
     1 · MARCAR NC
     ===================================================================== */
  let marcaRec = null;
  async function marcar(recId) {
    if (typeof canEdit === 'function' && !canEdit()) { aviso('err', 'Sin permiso', 'Sólo el Inspector marca no conformidades.'); return; }
    marcaRec = recId || (typeof recActivo !== 'undefined' ? recActivo : null);
    geoIniciar();
    brujulaIniciar();   // en iPhone esto pide permiso (estamos dentro del toque)
    if (await hayXR()) {
      try { await marcarXR(); return; }
      catch (err) { console.warn('[SIMA RA] WebXR no arrancó, paso a modo cámara', err); }
    }
    if (hayCam()) return marcarCamara();
    // Sin cámara: se registra con GPS y se carga normal.
    aviso('info', 'Sin cámara disponible', 'La NC se marca con la ubicación GPS del momento.');
    terminarMarca({ metodo: 'gps' });
  }

  /* Construye el registro `ra` y abre la carga de hallazgo. */
  function terminarMarca(extra) {
    const f = geoFresco();
    const ra = {
      metodo: extra.metodo,
      d: new Date().toISOString(),
      by: (typeof ROLES !== 'undefined' && typeof role !== 'undefined' && ROLES[role]) ? ROLES[role].name : ''
    };
    if (BRU.rumbo != null) ra.rumbo = Math.round(BRU.rumbo);
    if (extra.dist != null) ra.dist = Math.round(extra.dist * 100) / 100;
    if (extra.delta != null && ra.rumbo != null) ra.rumbo = Math.round(norm360(ra.rumbo + extra.delta));
    if (extra.px) ra.px = extra.px;
    if (f) {
      ra.insp = { lat: +f.lat.toFixed(7), lon: +f.lon.toFixed(7) };
      // La NC no está donde está parado el Inspector: está a `dist` metros en `rumbo`.
      const p = (ra.dist && ra.rumbo != null && ra.dist < 60) ? destino(f, ra.rumbo, ra.dist) : ra.insp;
      ra.lat = p.lat; ra.lon = p.lon;
      ra.acc = Math.round(f.acc * 10) / 10;
      if (f.alt != null) ra.alt = Math.round(f.alt * 10) / 10;
    }
    cerrarPantalla();
    GEO.subs.clear(); brujulaDetener();
    if (typeof openCaptura === 'function') {
      openCaptura({ rec: marcaRec, ra, foto: extra.foto || null });
      if (!f) aviso('info', 'NC marcada sin GPS', 'Quedó con el sector que elijas. Si salís al exterior, el GPS se completa al guardar.');
    }
  }

  /* ---------- 1a · WebXR (Android + Chrome) --------------------------- */
  async function marcarXR() {
    const THREE = await import('/vendor/three.module.min.js');
    const scr = abrirPantalla(`
      <div class="ra-top"><span class="ra-badge">RA</span><div><b>Marcar no conformidad</b><small id="raSub">Recorrido ${e(marcaRec || '')}</small></div>
        <button class="ra-x" id="raX" aria-label="Cerrar">×</button></div>
      <div class="ra-info" id="raInfo">${geoChip()}</div>
      <div class="ra-hint" id="raHint">Mové el celular despacio hacia la falla hasta que aparezca el aro sobre la superficie.</div>
      <div class="ra-bot" id="raBot">
        <div class="ra-res" id="raRes">Tocá la pantalla para clavar el pin <b>NC</b> donde está la falla.</div>
        <div class="ra-fila"><button class="ra-btn sec" id="raCam">Usar foto en su lugar</button><button class="ra-btn pri" id="raOk" disabled>Continuar con la carga</button></div>
      </div>`);
    scr.style.background = 'transparent';
    const ui = [$('raBot'), scr.querySelector('.ra-top')];
    // Tocar los botones no debe clavar un pin.
    ui.forEach(el => el && el.addEventListener('beforexrselect', ev => ev.preventDefault()));

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.domElement.className = 'ra-cv';
    scr.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.2));

    // Aro que sigue la superficie detectada.
    const reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.06, 0.08, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    reticle.matrixAutoUpdate = false; reticle.visible = false;
    scene.add(reticle);

    // Pin NC: esfera + cono rojo, aro en la base y cartel «NC».
    const pin = new THREE.Group();
    const rojo = new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: .4, metalness: .1, emissive: 0x550000 });
    const cono = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 24), rojo); cono.rotation.x = Math.PI; cono.position.y = 0.06;
    const bola = new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 16), rojo); bola.position.y = 0.14;
    const base = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.075, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: .8 }));
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#FF3B30'; g.beginPath(); g.roundRect ? g.roundRect(8, 8, 240, 112, 28) : g.rect(8, 8, 240, 112); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 72px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('NC', 128, 68);
    const cartel = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false }));
    cartel.scale.set(0.14, 0.07, 1); cartel.position.y = 0.25;
    pin.add(cono, bola, base, cartel); pin.visible = false;
    scene.add(pin);

    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay', 'local-floor', 'light-estimation'],
      domOverlay: { root: scr }
    });
    renderer.xr.setReferenceSpaceType('local');
    await renderer.xr.setSession(session);
    const viewerSpace = await session.requestReferenceSpace('viewer');
    const hitSource = await session.requestHitTestSource({ space: viewerSpace });

    let marca = null, terminado = false, primerHit = false;
    const salir = async (resultado) => {
      if (terminado) return; terminado = true;
      try { hitSource.cancel(); } catch (_) {}
      renderer.setAnimationLoop(null);
      try { await session.end(); } catch (_) {}
      renderer.dispose();
      if (resultado === 'camara') { marcarCamara(); return; }
      if (resultado) terminarMarca(resultado);
      else { cerrarPantalla(); GEO.subs.clear(); geoDetener(); brujulaDetener(); }
    };
    session.addEventListener('end', () => { if (!terminado) { terminado = true; renderer.setAnimationLoop(null); if (marca) terminarMarca(marca); else { cerrarPantalla(); GEO.subs.clear(); geoDetener(); brujulaDetener(); } } });
    limpiezas.push(() => { if (!terminado) { terminado = true; try { session.end(); } catch (_) {} } });

    $('raX').onclick = () => salir(null);
    $('raCam').onclick = () => salir('camara');
    $('raOk').onclick = () => salir(marca);
    const pintarGeo = () => { const i = $('raInfo'); if (i) i.innerHTML = geoChip() + (BRU.rumbo != null ? `<span class="ra-geo ok ra-brujula"><i></i>${cardinal(BRU.rumbo)} ${Math.round(BRU.rumbo)}°</span>` : ''); };
    GEO.subs.add(pintarGeo);

    const controller = renderer.xr.getController(0);
    controller.addEventListener('select', () => {
      if (!reticle.visible) { const h = $('raHint'); if (h) { h.classList.remove('off'); h.textContent = 'Todavía no se detecta una superficie ahí. Apuntá a la falla y esperá el aro.'; } return; }
      pin.matrix.copy(reticle.matrix);
      pin.position.setFromMatrixPosition(reticle.matrix);
      pin.visible = true;
      // Distancia y desvío del pin respecto de hacia dónde mira el Inspector.
      const cam = renderer.xr.getCamera();
      const cp = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion().setFromRotationMatrix(cam.matrixWorld));
      const v = pin.position.clone().sub(cp);
      const dist = Math.hypot(v.x, v.z);
      const aF = Math.atan2(fwd.x, -fwd.z), aV = Math.atan2(v.x, -v.z);
      const delta = grad(aV - aF);   // + = a la derecha
      marca = { metodo: 'webxr', dist, delta: difAng(delta, 0), alto: Math.round(v.y * 100) / 100 };
      if (navigator.vibrate) navigator.vibrate(40);
      $('raOk').disabled = false;
      $('raRes').innerHTML = `<b>NC marcada</b> a ${dist.toFixed(1).replace('.', ',')} m de vos${BRU.rumbo != null ? ', hacia el ' + cardinal(norm360(BRU.rumbo + marca.delta)) : ''}. Tocá otra vez para moverla, o seguí con la carga.`;
    });
    scene.add(controller);

    const reloj = new THREE.Clock();
    renderer.setAnimationLoop((t, frame) => {
      if (frame) {
        const ref = renderer.xr.getReferenceSpace();
        const hits = frame.getHitTestResults(hitSource);
        if (hits.length) {
          const pose = hits[0].getPose(ref);
          reticle.visible = true; reticle.matrix.fromArray(pose.transform.matrix);
          if (!primerHit) { primerHit = true; const h = $('raHint'); if (h) h.classList.add('off'); }
        } else reticle.visible = false;
      }
      if (pin.visible) { const k = reloj.getElapsedTime(); bola.position.y = 0.14 + Math.sin(k * 3) * 0.008; base.material.opacity = .5 + Math.sin(k * 4) * .3; }
      renderer.render(scene, camera);
    });
  }

  /* ---------- 1b · Modo cámara (iPhone, PC, Android sin ARCore) -------- */
  async function marcarCamara() {
    const scr = abrirPantalla(`
      <video id="raVid" autoplay playsinline muted></video>
      <div class="ra-top"><span class="ra-badge">RA</span><div><b>Marcar no conformidad</b><small>Recorrido ${e(marcaRec || '')}</small></div>
        <button class="ra-x" id="raX" aria-label="Cerrar">×</button></div>
      <div class="ra-info" id="raInfo">${geoChip()}</div>
      <div class="ra-hint" id="raHint">Encuadrá la falla y tocá justo donde está para clavar el pin <b>NC</b>.</div>
      <div class="ra-bot">
        <div class="ra-res" id="raRes">La foto se toma con el pin dibujado: queda como evidencia del «antes».</div>
        <div class="ra-fila"><button class="ra-btn sec" id="raSinFoto">Sólo ubicación</button><button class="ra-btn rojo" id="raOk" disabled>Tomar foto y marcar</button></div>
      </div>`);
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false });
    } catch (_) {
      cerrarPantalla();
      aviso('err', 'Cámara no disponible', 'Sin permiso de cámara. La NC se marca con la ubicación GPS.');
      terminarMarca({ metodo: 'gps' });
      return;
    }
    const vid = $('raVid'); vid.srcObject = stream;
    limpiezas.push(() => stream.getTracks().forEach(t => t.stop()));
    const pintarGeo = () => { const i = $('raInfo'); if (i) i.innerHTML = geoChip() + (BRU.rumbo != null ? `<span class="ra-geo ok ra-brujula"><i></i>${cardinal(BRU.rumbo)} ${Math.round(BRU.rumbo)}°</span>` : ''); };
    GEO.subs.add(pintarGeo);
    const tic = setInterval(pintarGeo, 1000); limpiezas.push(() => clearInterval(tic));

    let px = null, pinEl = null;
    // Coordenada del toque → fracción de la imagen real (el video usa object-fit:cover).
    function aImagen(cx, cy) {
      const r = vid.getBoundingClientRect(), vw = vid.videoWidth || r.width, vh = vid.videoHeight || r.height;
      const k = Math.max(r.width / vw, r.height / vh), dw = vw * k, dh = vh * k;
      const ox = (r.width - dw) / 2, oy = (r.height - dh) / 2;
      return { x: Math.min(1, Math.max(0, (cx - r.left - ox) / dw)), y: Math.min(1, Math.max(0, (cy - r.top - oy) / dh)) };
    }
    scr.addEventListener('pointerup', ev => {
      if (ev.target.closest('.ra-top,.ra-bot')) return;
      px = aImagen(ev.clientX, ev.clientY);
      if (pinEl) pinEl.remove();
      pinEl = document.createElement('div'); pinEl.className = 'ra-pin cae'; pinEl.innerHTML = PIN_SVG;
      pinEl.style.left = ev.clientX + 'px'; pinEl.style.top = ev.clientY + 'px';
      scr.appendChild(pinEl);
      $('raHint').classList.add('off');
      $('raOk').disabled = false;
      $('raRes').innerHTML = '<b>Pin clavado.</b> Tocá en otro lugar para moverlo, o tomá la foto.';
      if (navigator.vibrate) navigator.vibrate(30);
    });
    $('raX').onclick = () => { cerrarPantalla(); GEO.subs.clear(); geoDetener(); brujulaDetener(); };
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
    g.beginPath(); g.moveTo(0, 0);
    g.bezierCurveTo(-4, -8, -19, -22, -19, -35); g.arc(0, -35, 19, Math.PI, 0); g.bezierCurveTo(19, -22, 4, -8, 0, 0);
    g.fillStyle = '#FF3B30'; g.fill(); g.shadowColor = 'transparent';
    g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = '#fff'; g.font = '800 14px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('NC', 0, -34);
    g.beginPath(); g.ellipse(0, 2, 16, 5, 0, 0, Math.PI * 2); g.lineWidth = 2.5; g.strokeStyle = '#FF3B30'; g.stroke();
    g.restore();
  }

  /* =====================================================================
     2 · VER NC EN RA (RA por ubicación: GPS + brújula)
     ===================================================================== */
  const COLOR_ESTADO = st => (typeof ESTADOS !== 'undefined' && ESTADOS[st] && ESTADOS[st].c) || '#FF3B30';
  const conUbic = l => !!(l && l.ra && typeof l.ra.lat === 'number' && typeof l.ra.lon === 'number');
  function ncsConUbic(soloAbiertas = true, recId = null) {
    const todos = typeof L === 'function' ? L() : (typeof DB !== 'undefined' && DB ? DB.levantamientos : []);
    return (todos || []).filter(l => conUbic(l) && !l.eliminado && (!soloAbiertas || l.estado !== 'cerrado') && (!recId || l.rec === recId || (l.recs || []).includes(recId)));
  }
  const FOV_H = 62;   // campo de visión horizontal aproximado de la cámara trasera

  async function radar(focoId) {
    if (!hayCam()) { aviso('err', 'Sin cámara', 'Este dispositivo no puede mostrar la realidad aumentada.'); return; }
    geoIniciar();
    const brOk = await brujulaIniciar();
    const foco = focoId ? (typeof levPara === 'function' ? levPara(focoId) : null) : null;
    const scr = abrirPantalla(`
      <video id="raVid" autoplay playsinline muted></video>
      <div class="ra-top"><span class="ra-badge">RA</span><div><b>${foco ? 'Ir a ' + e(foco.id) : 'NC cercanas'}</b><small>${foco ? e(typeof loc === 'function' ? loc(foco) : foco.sector) : 'No conformidades abiertas con ubicación'}</small></div>
        <button class="ra-x" id="raX" aria-label="Cerrar">×</button></div>
      <div class="ra-info" id="raInfo"></div>
      <div id="raCapa"></div>
      <div class="ra-bot"><div class="ra-res" id="raRes">Buscando tu ubicación…</div>
        <div class="ra-fila"><button class="ra-btn sec" id="raMapa">${ico(ICO_MAPA)} Ver en el mapa</button></div></div>`);
    let stream = null;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); }
    catch (_) { cerrarPantalla(); aviso('err', 'Cámara no disponible', 'Sin permiso de cámara.'); return; }
    $('raVid').srcObject = stream;
    limpiezas.push(() => stream.getTracks().forEach(t => t.stop()));
    $('raX').onclick = () => { cerrarPantalla(); GEO.subs.clear(); geoDetener(); brujulaDetener(); };
    $('raMapa').onclick = () => { cerrarPantalla(); GEO.subs.clear(); brujulaDetener(); mapa(null, focoId); };

    const lista = foco ? (conUbic(foco) ? [foco] : []) : ncsConUbic(true);
    const capa = $('raCapa');
    let raf = 0;
    const cuadro = () => {
      raf = requestAnimationFrame(cuadro);
      const yo = geoFresco(), W = window.innerWidth, H = window.innerHeight;
      const info = $('raInfo'); if (!info) return;
      info.innerHTML = geoChip() + (BRU.rumbo != null ? `<span class="ra-geo ok ra-brujula"><i></i>${cardinal(BRU.rumbo)} ${Math.round(BRU.rumbo)}°</span>` : `<span class="ra-geo off"><i></i>${brOk ? 'Calibrando brújula…' : 'Sin brújula'}</span>`);
      if (!lista.length) { $('raRes').innerHTML = foco ? 'Esta NC no tiene ubicación GPS guardada.' : 'No hay NC abiertas con ubicación en esta planta.'; capa.innerHTML = ''; return; }
      if (!yo) { capa.innerHTML = ''; return; }
      const items = lista.map(l => ({ l, d: distancia(yo, l.ra), b: rumbo(yo, l.ra) })).sort((a, b) => a.d - b.d);
      const visibles = foco ? items : items.filter(x => x.d <= 400);
      const horizonte = H / 2 + (BRU.beta - 90) * (H / 50);   // inclinar el celular sube/baja los pines
      let html = '';
      visibles.slice(0, 25).forEach((x, i) => {
        if (BRU.rumbo == null) return;
        const dx = difAng(x.b, BRU.rumbo);
        const c = COLOR_ESTADO(x.l.estado);
        if (Math.abs(dx) <= FOV_H / 2 + 6) {
          const sx = W / 2 + dx / (FOV_H / 2) * (W / 2);
          const sy = horizonte - Math.min(140, 20 + 900 / Math.max(3, x.d)) + i * 4;
          html += `<div class="ra-marca ${foco ? 'foco' : ''}" style="left:${sx.toFixed(0)}px;top:${sy.toFixed(0)}px;--mc:${c}" data-id="${e(x.l.id)}">
            <div class="mk"><div class="mk-b">${e(x.l.id)} · ${fmtM(x.d)}<small>${e(typeof catOf === 'function' ? catOf(x.l.cat).label : x.l.cat)}</small></div><div class="mk-p"></div><div class="mk-o"></div></div></div>`;
        } else if (foco || i < 3) {
          // Fuera de cuadro: flecha en el borde hacia donde girar.
          const izq = dx < 0, y = H * 0.5;
          html += `<div class="ra-flecha" style="left:${izq ? 36 : W - 36}px;top:${y}px;background:${c};transform:rotate(${izq ? -90 : 90}deg)" title="${e(x.l.id)}">${ico(ICO_FLECHA, 26)}</div>`;
        }
      });
      capa.innerHTML = html;
      const c0 = items[0];
      $('raRes').innerHTML = foco
        ? `<b>${e(c0.l.id)}</b> a <b>${fmtM(c0.d)}</b>, hacia el ${cardinal(c0.b)}${BRU.rumbo != null ? ' · ' + (Math.abs(difAng(c0.b, BRU.rumbo)) < 12 ? '<b>¡está al frente!</b>' : 'girá ' + (difAng(c0.b, BRU.rumbo) > 0 ? 'a la derecha ' : 'a la izquierda ') + Math.abs(Math.round(difAng(c0.b, BRU.rumbo))) + '°') : ''}${yo.acc > 25 ? '<br><small>GPS impreciso (±' + Math.round(yo.acc) + ' m): usá también el sector «' + e(c0.l.sector) + '».</small>' : ''}`
        : `${visibles.length} NC a menos de 400 m · la más cercana: <b>${e(c0.l.id)}</b> a <b>${fmtM(c0.d)}</b> (${cardinal(c0.b)})`;
    };
    capa.addEventListener('click', ev => {
      const m = ev.target.closest('.ra-marca'); if (!m) return;
      const id = m.dataset.id; cerrarPantalla(); GEO.subs.clear(); brujulaDetener();
      if (typeof openDetalle === 'function') openDetalle(id);
    });
    raf = requestAnimationFrame(cuadro);
    limpiezas.push(() => cancelAnimationFrame(raf));
  }

  /* =====================================================================
     3 · MAPA DE NC (sin conexión)
     ===================================================================== */
  function mapa(recId, focoId) {
    geoIniciar();
    const lista = focoId && typeof levPara === 'function' && conUbic(levPara(focoId)) ? [levPara(focoId)] : ncsConUbic(!recId, recId);
    const yo = geoFresco();
    const W = 640, H = 420, M = 34;
    let svgHtml = '';
    if (lista.length) {
      const pts = lista.map(l => l.ra).concat(yo ? [yo] : []);
      const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length, lon0 = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
      const kx = 111320 * Math.cos(rad(lat0)), ky = 110540;
      const xy = p => ({ x: (p.lon - lon0) * kx, y: -(p.lat - lat0) * ky });
      const todos = pts.map(xy);
      const ext = Math.max(20, ...todos.map(p => Math.abs(p.x)), ...todos.map(p => Math.abs(p.y))) * 1.15;
      const esc2 = Math.min((W / 2 - M) / ext, (H / 2 - M) / ext);
      const P = p => { const q = xy(p); return { x: W / 2 + q.x * esc2, y: H / 2 + q.y * esc2 }; };
      // Escala gráfica redonda.
      const metros = [5, 10, 20, 50, 100, 200, 500, 1000, 2000].find(m => m * esc2 >= 70) || 2000;
      const grilla = [];
      for (let i = -6; i <= 6; i++) {
        const gx = W / 2 + i * metros * esc2, gy = H / 2 + i * metros * esc2;
        if (gx > 0 && gx < W) grilla.push(`<line x1="${gx}" y1="0" x2="${gx}" y2="${H}"/>`);
        if (gy > 0 && gy < H) grilla.push(`<line x1="0" y1="${gy}" x2="${W}" y2="${gy}"/>`);
      }
      svgHtml = `<svg class="ra-mapa" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mapa de no conformidades">
        <g stroke="var(--line)" stroke-width="1" opacity=".6">${grilla.join('')}</g>
        <g transform="translate(${W - 34},34)"><circle r="16" fill="var(--s2)"/><path d="M0-11l5 12H-5z" fill="#FF3B30"/><text y="-17" text-anchor="middle">N</text></g>
        <g transform="translate(${M},${H - 18})"><line x1="0" y1="0" x2="${metros * esc2}" y2="0" stroke="var(--tx2)" stroke-width="2"/><text x="${metros * esc2 / 2}" y="-6" text-anchor="middle">${fmtM(metros)}</text></g>
        ${lista.map(l => {
          const p = P(l.ra), c = COLOR_ESTADO(l.estado), r = l.ra.acc ? Math.min(120, l.ra.acc * esc2) : 0;
          return `<g class="pt" tabindex="0" role="button" aria-label="${e(l.id)}" onclick="closeModal();openDetalle('${e(l.id)}')">
            ${r > 6 ? `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${c}" opacity=".10"/>` : ''}
            <circle cx="${p.x}" cy="${p.y}" r="8" fill="${c}" stroke="#fff" stroke-width="2.5"/>
            <text x="${p.x}" y="${p.y - 13}" text-anchor="middle">${e(l.id)}</text></g>`;
        }).join('')}
        ${yo ? (() => { const p = P(yo); return `<g><circle cx="${p.x}" cy="${p.y}" r="${Math.min(120, yo.acc * esc2)}" fill="#0A84FF" opacity=".12"/><circle cx="${p.x}" cy="${p.y}" r="7" fill="#0A84FF" stroke="#fff" stroke-width="3"/><text x="${p.x}" y="${p.y + 22}" text-anchor="middle">Vos</text></g>`; })() : ''}
      </svg>`;
    }
    const estados = typeof ESTADOS !== 'undefined' ? ESTADOS : {};
    const ley = Object.keys(estados).map(k => `<span><i style="background:${estados[k].c}"></i>${e(estados[k].label)}</span>`).join('') + '<span><i style="background:#0A84FF"></i>Tu posición</span>';
    const filas = lista.map(l => {
      const d = yo ? distancia(yo, l.ra) : null;
      return `<div class="ra-li" onclick="closeModal();openDetalle('${e(l.id)}')"><i style="background:${COLOR_ESTADO(l.estado)}"></i>
        <span><b>${e(l.id)}</b> · ${e(typeof catOf === 'function' ? catOf(l.cat).label : l.cat)}<br><small>${e(typeof loc === 'function' ? loc(l) : l.sector)}${d != null ? ' · a ' + fmtM(d) : ''}${l.ra.acc ? ' · ±' + Math.round(l.ra.acc) + ' m' : ''}</small></span>
        <a href="https://www.google.com/maps?q=${fmtC(l.ra.lat)},${fmtC(l.ra.lon)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Maps ↗</a></div>`;
    }).join('');
    const titulo = focoId ? 'Ubicación de ' + focoId : (recId ? 'NC del recorrido ' + recId : 'NC abiertas con ubicación');
    const head = typeof mHead === 'function' ? mHead('pin', 'Mapa de NC', titulo, '#FF3B30', 'rgba(255,59,48,.14)') : `<h3>${e(titulo)}</h3>`;
    if (typeof showModal !== 'function') return;
    showModal(`${head}
      <div class="modal-body">
        ${lista.length ? svgHtml + `<div class="ra-ley">${ley}</div><div class="ra-lista">${filas}</div>`
          : `<p style="color:var(--tx2);line-height:1.6">Todavía no hay no conformidades con ubicación. Marcalas desde la Ruta de inspección con <b>«Marcar NC en RA»</b>: cada una queda guardada con su ubicación GPS.</p>`}
      </div>
      <div class="modal-foot">
        <button class="btn btn-quiet" onclick="closeModal()">Cerrar</button>
        ${lista.length ? `<button class="btn btn-primary" onclick="closeModal();SIMA_RA.radar(${focoId ? `'${e(focoId)}'` : ''})">${ico(ICO_RADAR)} Ver en RA</button>` : ''}
      </div>`, true);
  }

  /* =====================================================================
     Integración con la carga de hallazgos y la ficha
     ===================================================================== */
  const METODO = { webxr: 'Pin en RA (WebXR)', camara: 'Pin sobre la foto', gps: 'GPS del momento' };
  function texto(l) {
    const r = l && l.ra; if (!r) return '—';
    const partes = [METODO[r.metodo] || 'RA'];
    if (typeof r.lat === 'number') partes.push(`${fmtC(r.lat)}, ${fmtC(r.lon)}${r.acc ? ' (±' + Math.round(r.acc) + ' m)' : ''}`);
    else partes.push('sin GPS');
    if (r.dist) partes.push(`a ${String(r.dist).replace('.', ',')} m del Inspector${r.rumbo != null ? ' hacia el ' + cardinal(r.rumbo) : ''}`);
    return partes.join(' · ');
  }
  /* Tarjeta «Marca RA» dentro de la captura (paso 3 · Ubicación). */
  function tarjetaCaptura(ra, conBoton) {
    if (!ra) {
      const f = geoFresco();
      return `<div class="ra-card"><span class="rc-ico">${ico(ICO_RA, 20)}</span>
        <div class="rc-t"><b>Sin marca RA</b>${f ? `Se guarda la ubicación GPS del momento (±${Math.round(f.acc)} m).` : (GEO.err ? e(GEO.err) + ' Queda sólo el sector.' : 'Buscando GPS para guardar la ubicación…')}</div>
        ${conBoton ? `<div class="rc-acc"><button type="button" class="btn btn-sm btn-ghost" onclick="SIMA_RA.remarcar()">${ico(ICO_RA, 16)} Marcar en RA</button></div>` : ''}</div>`;
    }
    return `<div class="ra-card"><span class="rc-ico">${ico(ICO_RA, 20)}</span>
      <div class="rc-t"><b>NC marcada · ${e(METODO[ra.metodo] || 'RA')}</b>${typeof ra.lat === 'number' ? `${fmtC(ra.lat)}, ${fmtC(ra.lon)}${ra.acc ? ' · ±' + Math.round(ra.acc) + ' m' : ''}${ra.dist ? ' · a ' + String(ra.dist).replace('.', ',') + ' m' : ''}` : 'Sin GPS en este lugar: queda con el sector elegido.'}</div>
      ${conBoton ? `<div class="rc-acc"><button type="button" class="btn btn-sm btn-quiet" onclick="SIMA_RA.remarcar()">Volver a marcar</button></div>` : ''}</div>`;
  }
  /* Desde la captura abierta: cerrar el modal y volver a marcar (se pierde lo cargado, se avisa). */
  function remarcar() {
    const rec = (typeof capCtx !== 'undefined' && capCtx && capCtx.rec) || marcaRec;
    if (typeof closeModal === 'function') closeModal();
    marcar(rec);
  }
  /* Al guardar sin marca RA, se completa con el GPS del momento si hay. */
  function raParaGuardar(raCtx) {
    if (raCtx) {
      // Si al marcar no había GPS y ahora sí, se completa.
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
  /* La captura avisa cuando cambia el GPS para actualizar la tarjeta. */
  function seguirGPS(fn) { geoIniciar(); GEO.subs.add(fn); return () => { GEO.subs.delete(fn); geoDetener(); }; }

  /* Botones de RA en la Ruta en curso. */
  function botonesRuta(recId) {
    const n = ncsConUbic(false, recId).length;
    return `<div class="mode-grid mode-grid--ra" style="margin-bottom:14px">
      <button class="mode-card mode-card--primary" style="--glow:rgba(255,59,48,.30)" onclick="SIMA_RA.marcar('${e(recId)}')">
        <span class="m-tag">Realidad aumentada</span>
        <div class="m-ico">${ico(ICO_RA, 22)}</div>
        <h3>Marcar NC en RA</h3>
        <p>Apuntá la cámara a la falla y tocá para clavar el pin <b>NC</b>: queda guardada con su ubicación GPS, la distancia y la foto.</p>
        <span class="m-go">Marcar ${ico('<path d="M5 12h14M13 6l6 6-6 6"/>', 16)}</span>
      </button>
      <button class="mode-card" onclick="openCaptura({rec:'${e(recId)}'})">
        <span class="m-tag">Sin RA</span>
        <div class="m-ico">${ico('<path d="M3 8a2 2 0 012-2h2l2-3h6l2 3h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><circle cx="12" cy="13" r="4"/>', 22)}</div>
        <h3>Cargar hallazgo</h3>
        <p>La carga de siempre: foto, dictado y sector. También guarda la ubicación GPS del momento.</p>
        <span class="m-go">Cargar ${ico('<path d="M5 12h14M13 6l6 6-6 6"/>', 16)}</span>
      </button>
    </div>
    <div class="ra-tools">
      <button class="btn btn-ghost" onclick="SIMA_RA.radar()">${ico(ICO_RADAR)} Ver NC cercanas en RA</button>
      <button class="btn btn-ghost" onclick="SIMA_RA.mapa('${e(recId)}')">${ico(ICO_MAPA)} Mapa del recorrido${n ? ' · ' + n : ''}</button>
    </div>`;
  }
  /* Acciones de RA en la ficha del hallazgo. */
  function accionesFicha(l) {
    if (!conUbic(l)) return '';
    return `<div class="ra-acciones">
      <button class="btn btn-sm btn-ghost" onclick="closeModal();SIMA_RA.radar('${e(l.id)}')">${ico(ICO_RADAR, 16)} Ir hasta la NC en RA</button>
      <button class="btn btn-sm btn-ghost" onclick="closeModal();SIMA_RA.mapa(null,'${e(l.id)}')">${ico(ICO_MAPA, 16)} Ver en el mapa</button>
      <a class="btn btn-sm btn-quiet" href="https://www.google.com/maps?q=${fmtC(l.ra.lat)},${fmtC(l.ra.lon)}" target="_blank" rel="noopener">Google Maps ↗</a>
    </div>`;
  }

  window.SIMA_RA = {
    marcar, radar, mapa, texto, tarjetaCaptura, remarcar, raParaGuardar, seguirGPS,
    botonesRuta, accionesFicha, conUbic, ncsConUbic, hayXR,
    // Para pruebas
    _geo: { distancia, rumbo, destino, difAng, BRU }
  };
  // Se averigua el soporte de WebXR temprano, así el primer toque ya sabe el modo.
  hayXR();
})();
