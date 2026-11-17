/* =====================================================================
   SIMA · Modelos 3D de los equipos (módulo 2)
   ---------------------------------------------------------------------
   Modelos procedurales con three.js (vendor/, funciona sin señal):
   vaciadora, termocontraible, secador, flejadora, detector de metales y
   rayos X. Se usan de dos formas:
     · miniatura(tipo)  → imagen PNG (render fijo, fondo transparente)
     · visor(el, tipo)  → vista interactiva: arrastrar para girar,
                           giro lento automático (salvo «reducir movimiento»)
   Cargado con import() desde sima-nfc.js; expone window.SIMA_3D.
   ===================================================================== */
import * as THREE from './vendor/three.module.min.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Materiales ---------------------------------------------- */
function materiales() {
  const m = (o) => new THREE.MeshStandardMaterial(o);
  return {
    inox: m({ color: 0xd9dee3, metalness: 0.9, roughness: 0.26 }),
    inoxOsc: m({ color: 0xaab2ba, metalness: 0.85, roughness: 0.34 }),
    pintura: m({ color: 0x2b3138, metalness: 0.2, roughness: 0.55 }),
    goma: m({ color: 0x1b1f24, metalness: 0, roughness: 0.92 }),
    cinta: m({ color: 0x23282e, metalness: 0.05, roughness: 0.85 }),
    blanco: m({ color: 0xeef1f4, metalness: 0.1, roughness: 0.5 }),
    pantalla: m({ color: 0x0b1a22, emissive: 0x2bb3d9, emissiveIntensity: 0.9, roughness: 0.3 }),
    verde: m({ color: 0x16a35f, emissive: 0x1fcb7e, emissiveIntensity: 0.8 }),
    ambar: m({ color: 0xc77800, emissive: 0xff9f1c, emissiveIntensity: 0.7 }),
    rojo: m({ color: 0xb3202a, metalness: 0.1, roughness: 0.4 }),
    amarillo: m({ color: 0xf2b705, metalness: 0.1, roughness: 0.45 }),
    azul: m({ color: 0x1f6fb2, metalness: 0.3, roughness: 0.45 }),
    plomo: m({ color: 0x4b5159, metalness: 0.3, roughness: 0.75 }),
    agua: m({ color: 0x5fb7d9, metalness: 0.1, roughness: 0.08, transparent: true, opacity: 0.75 }),
    vidrio: m({ color: 0x9fd3e6, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.35 }),
    fleje: m({ color: 0x2f7de1, metalness: 0.1, roughness: 0.6 })
  };
}

/* ---------- Ayudas de geometría ------------------------------------- */
function caja(g, mat, w, h, d, x, y, z, r = 0) {
  const geo = r > 0 && THREE.CapsuleGeometry ? redondeada(w, h, d, r) : new THREE.BoxGeometry(w, h, d);
  const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); g.add(me); return me;
}
function redondeada(w, h, d, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(s, { depth: d - r * 2, bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.6, bevelSegments: 3, curveSegments: 6 });
  geo.translate(0, 0, -(d - r * 2) / 2); return geo;
}
function cil(g, mat, rad, h, x, y, z, rx = 0, rz = 0, seg = 24) {
  const me = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, h, seg), mat);
  me.position.set(x, y, z); me.rotation.x = rx; me.rotation.z = rz; g.add(me); return me;
}
function patas(g, M, w, d, h, x0 = 0) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    cil(g, M.inoxOsc, 0.035, h, x0 + sx * (w / 2 - 0.08), h / 2, sz * (d / 2 - 0.08));
    cil(g, M.goma, 0.06, 0.04, x0 + sx * (w / 2 - 0.08), 0.02, sz * (d / 2 - 0.08));
  }
}
function rodillos(g, M, x0, x1, y, d, n) {
  for (let i = 0; i < n; i++) cil(g, M.inoxOsc, 0.035, d, x0 + (x1 - x0) * i / (n - 1), y, 0, Math.PI / 2, 0, 16);
}
function cinta(g, M, largo, y, d, x = 0) {
  caja(g, M.cinta, largo, 0.04, d, x, y, 0);
  caja(g, M.inoxOsc, largo, 0.06, 0.04, x, y - 0.04, d / 2 + 0.03);
  caja(g, M.inoxOsc, largo, 0.06, 0.04, x, y - 0.04, -d / 2 - 0.03);
}
function tablero(g, M, x, y, z, ry = 0) {
  const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = ry; g.add(t);
  caja(t, M.inox, 0.36, 0.3, 0.12, 0, 0, 0, 0.02);
  caja(t, M.pantalla, 0.24, 0.14, 0.01, 0, 0.04, 0.065);
  cil(t, M.rojo, 0.028, 0.03, -0.1, -0.09, 0.07, Math.PI / 2);
  cil(t, M.verde, 0.018, 0.02, 0.02, -0.09, 0.065, Math.PI / 2);
  cil(t, M.ambar, 0.018, 0.02, 0.08, -0.09, 0.065, Math.PI / 2);
  return t;
}
function baliza(g, M, x, y, z) {
  cil(g, M.inoxOsc, 0.015, 0.25, x, y + 0.125, z);
  cil(g, M.verde, 0.04, 0.07, x, y + 0.28, z);
  cil(g, M.ambar, 0.04, 0.07, x, y + 0.35, z);
  cil(g, M.rojo, 0.04, 0.07, x, y + 0.42, z);
}

/* ---------- Modelos -------------------------------------------------- */
const MODELOS = {
  vaciadora(M) {
    const g = new THREE.Group();
    caja(g, M.inox, 2.0, 0.78, 0.95, 0, 0.6, 0, 0.03);
    patas(g, M, 2.0, 0.95, 0.22);
    caja(g, M.pintura, 0.7, 0.45, 0.02, -0.45, 0.55, 0.48);                       // rejilla de la bomba
    for (let i = 0; i < 7; i++) caja(g, M.goma, 0.6, 0.02, 0.01, -0.45, 0.38 + i * 0.06, 0.495);
    caja(g, M.blanco, 1.9, 0.03, 0.88, 0, 1.005, 0);                              // camas de sellado
    caja(g, M.azul, 0.04, 0.02, 0.8, -0.42, 1.03, 0); caja(g, M.azul, 0.04, 0.02, 0.8, 0.52, 1.03, 0);
    const tapa = (x, abierta) => {
      const piv = new THREE.Group(); piv.position.set(x, 1.02, -0.44); g.add(piv);
      const t = new THREE.Group(); piv.add(t);
      caja(t, M.inox, 0.9, 0.3, 0.86, 0, 0.15, 0.43, 0.08);
      caja(t, M.vidrio, 0.6, 0.02, 0.55, 0, 0.305, 0.43);
      cil(t, M.inoxOsc, 0.02, 0.7, 0, 0.15, 0.9, 0, Math.PI / 2);
      if (abierta) piv.rotation.x = -0.75;
    };
    tapa(-0.47, false); tapa(0.47, true);
    tablero(g, M, 1.13, 0.9, 0.1, -Math.PI / 2 + 0.25);
    cil(g, M.inoxOsc, 0.02, 0.35, 1.04, 0.72, 0.1);
    return g;
  },
  termocontraible(M) {
    const g = new THREE.Group();
    caja(g, M.inox, 1.6, 0.6, 0.9, 0, 0.7, 0, 0.03);                             // tanque
    patas(g, M, 1.6, 0.9, 0.4);
    caja(g, M.agua, 1.3, 0.02, 0.7, 0, 1.0, 0);
    caja(g, M.inox, 1.0, 0.35, 0.95, 0, 1.25, 0, 0.06);                          // campana
    caja(g, M.inoxOsc, 0.3, 0.12, 0.3, 0, 1.47, 0);                              // extractor
    for (const s of [-1, 1]) {                                                     // transportadores de entrada y salida
      const x = s * 1.25;
      caja(g, M.inoxOsc, 0.9, 0.06, 0.7, x, 0.92, 0);
      rodillos(g, M, x - 0.38, x + 0.38, 0.97, 0.66, 8);
      patas(g, M, 0.9, 0.7, 0.9, x);
    }
    cil(g, M.inoxOsc, 0.035, 1.6, 0, 0.45, -0.52, 0, Math.PI / 2);                  // cañerías
    cil(g, M.rojo, 0.03, 0.4, 0.62, 0.62, -0.52);
    caja(g, M.pintura, 0.25, 0.35, 0.2, -0.55, 0.3, -0.35);                         // bomba
    cil(g, M.pintura, 0.11, 0.25, -0.55, 0.3, -0.18, Math.PI / 2);
    tablero(g, M, 0.85, 1.35, 0.42, -0.4);
    cil(g, M.inoxOsc, 0.02, 0.4, 0.85, 1.05, 0.42);
    return g;
  },
  secador(M) {
    const g = new THREE.Group();
    caja(g, M.inox, 1.3, 0.75, 0.95, 0, 1.15, 0, 0.05);                          // túnel de soplado
    caja(g, M.goma, 1.32, 0.3, 0.7, 0, 0.98, 0);                                  // boca (sombra interior)
    cinta(g, M, 2.6, 0.86, 0.66);
    patas(g, M, 2.4, 0.7, 0.84);
    cil(g, M.azul, 0.2, 0.42, 0.1, 1.72, 0, 0, Math.PI / 2, 32);                  // soplador
    cil(g, M.pintura, 0.16, 0.3, -0.27, 1.72, 0, 0, Math.PI / 2, 32);             // motor
    caja(g, M.inoxOsc, 0.35, 0.18, 0.35, 0.1, 1.52, 0);
    for (const x of [-0.35, 0, 0.35]) caja(g, M.inoxOsc, 0.04, 0.05, 0.75, x, 1.22, 0); // cuchillas de aire
    caja(g, M.blanco, 0.35, 0.22, 0.25, 0.5, 0.95, 0.05);                          // caja de producto
    tablero(g, M, -0.75, 1.25, 0.5, 0.2);
    return g;
  },
  flejadora(M) {
    const g = new THREE.Group();
    caja(g, M.blanco, 1.25, 0.72, 0.85, 0, 0.5, 0, 0.03);                        // gabinete
    patas(g, M, 1.25, 0.85, 0.14);
    rodillos(g, M, -0.55, 0.55, 0.89, 0.8, 9);
    const arco = M.inox;
    caja(g, arco, 0.12, 1.35, 0.16, -0.62, 1.4, 0, 0.03);
    caja(g, arco, 0.12, 1.35, 0.16, 0.62, 1.4, 0, 0.03);
    caja(g, arco, 1.36, 0.14, 0.16, 0, 2.08, 0, 0.03);
    caja(g, M.fleje, 1.16, 0.012, 0.02, 0, 1.99, 0.085);                          // fleje en el arco
    caja(g, M.fleje, 0.012, 1.1, 0.02, -0.55, 1.45, 0.085); caja(g, M.fleje, 0.012, 1.1, 0.02, 0.55, 1.45, 0.085);
    const bob = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.08, 16, 40), M.fleje); // bobina
    bob.position.set(0.9, 0.55, 0); bob.rotation.y = Math.PI / 2; g.add(bob);
    cil(g, M.inoxOsc, 0.03, 0.3, 0.86, 0.55, 0, 0, Math.PI / 2);
    caja(g, M.blanco, 0.6, 0.4, 0.5, 0.45, 1.1, 0);                                // caja flejada
    caja(g, M.fleje, 0.012, 0.405, 0.505, 0.45, 1.1, 0);
    tablero(g, M, -0.3, 0.72, 0.43, 0);
    return g;
  },
  detector(M) {
    const g = new THREE.Group();
    cinta(g, M, 2.6, 0.86, 0.5);
    patas(g, M, 2.4, 0.5, 0.84);
    const cab = new THREE.Group(); cab.position.set(0, 0.95, 0); g.add(cab);      // cabezal con abertura
    caja(cab, M.inox, 0.5, 0.12, 0.9, 0, 0.42, 0, 0.03);
    caja(cab, M.inox, 0.5, 0.12, 0.9, 0, -0.18, 0, 0.03);
    caja(cab, M.inox, 0.5, 0.6, 0.18, 0, 0.12, 0.36, 0.03);
    caja(cab, M.inox, 0.5, 0.6, 0.18, 0, 0.12, -0.36, 0.03);
    caja(cab, M.azul, 0.51, 0.06, 0.18, 0, 0.3, 0.36);
    cil(cab, M.verde, 0.025, 0.02, 0.15, 0.12, 0.455, Math.PI / 2);
    caja(g, M.blanco, 0.3, 0.18, 0.25, -0.75, 0.97, 0);                           // producto
    caja(g, M.inoxOsc, 0.5, 0.45, 0.55, 1.0, 0.45, 0.62);                         // contenedor de rechazo
    caja(g, M.rojo, 0.5, 0.06, 0.56, 1.0, 0.7, 0.62);
    caja(g, M.inox, 0.08, 0.2, 0.35, 0.75, 0.97, 0.15).rotation.y = -0.6;          // compuerta de rechazo
    cil(g, M.inoxOsc, 0.025, 0.8, -0.35, 1.25, -0.45);
    tablero(g, M, -0.35, 1.7, -0.45, 0);
    baliza(g, M, 0.2, 1.5, 0);
    return g;
  },
  rayosx(M) {
    const g = new THREE.Group();
    caja(g, M.inox, 1.5, 1.25, 1.05, 0, 1.32, 0, 0.05);                          // gabinete
    caja(g, M.goma, 1.52, 0.38, 0.62, 0, 0.98, 0);                                // túnel
    for (const s of [-1, 1]) for (let i = 0; i < 8; i++) caja(g, M.plomo, 0.012, 0.36, 0.075, s * 0.77, 0.98, -0.27 + i * 0.077); // cortinas de plomo
    cinta(g, M, 2.8, 0.78, 0.55);
    patas(g, M, 2.6, 0.55, 0.76);
    caja(g, M.amarillo, 0.22, 0.22, 0.01, 0.35, 1.6, 0.53);                        // cartel de radiación
    const tri = new THREE.Mesh(new THREE.CircleGeometry(0.06, 3), M.pintura); tri.position.set(0.35, 1.6, 0.537); tri.rotation.z = Math.PI / 2; g.add(tri);
    caja(g, M.pintura, 0.7, 0.04, 0.9, 0, 1.97, 0);                               // techo
    baliza(g, M, -0.55, 1.98, 0.3);
    cil(g, M.inoxOsc, 0.025, 0.55, 0.95, 1.65, 0.45);                              // brazo del monitor
    const mon = tablero(g, M, 0.95, 1.95, 0.45, -0.5); mon.scale.set(1.3, 1.3, 1);
    caja(g, M.blanco, 0.3, 0.16, 0.25, -1.1, 0.88, 0);
    return g;
  }
};

/* ---------- Escena --------------------------------------------------- */
let renderer = null, pmrem = null, envTex = null;
function asegurarRenderer() {
  if (renderer) return renderer;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  pmrem = new THREE.PMREMGenerator(renderer);
  envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  return renderer;
}
function sombra() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; return m;
}
function escena(tipo) {
  const sc = new THREE.Scene();
  sc.environment = envTex;
  sc.add(new THREE.HemisphereLight(0xffffff, 0x334455, 0.5));
  const d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(3, 5, 4); sc.add(d);
  const M = materiales();
  const modelo = (MODELOS[tipo] || MODELOS.vaciadora)(M);
  const box = new THREE.Box3().setFromObject(modelo), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  modelo.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
  const piv = new THREE.Group(); piv.add(modelo); sc.add(piv);
  const sh = sombra(); sh.scale.set(sz.x * 1.5, sz.z * 1.9, 1); sh.position.y = 0.002; piv.add(sh);
  const radio = Math.max(sz.x, sz.y, sz.z);
  const cam = new THREE.PerspectiveCamera(30, 4 / 3, 0.05, 50);
  return { sc, piv, cam, radio, alto: sz.y };
}
function encuadrar(cam, radio, alto, aspecto, giro = -0.62, elev = 0.42) {
  cam.aspect = aspecto; cam.updateProjectionMatrix();
  const dist = radio * (aspecto < 1 ? 2.9 : 2.25);
  cam.position.set(Math.sin(giro) * dist * Math.cos(elev), alto * 0.45 + dist * Math.sin(elev), Math.cos(giro) * dist * Math.cos(elev));
  cam.lookAt(0, alto * 0.42, 0);
}

const cache = {};
async function miniatura(tipo, w = 560, h = 420) {
  if (cache[tipo]) return cache[tipo];
  const r = asegurarRenderer();
  r.setPixelRatio(1); r.setSize(w, h, false);
  const { sc, cam, radio, alto } = escena(tipo);
  encuadrar(cam, radio, alto, w / h);
  r.setClearColor(0x000000, 0); r.render(sc, cam);
  return (cache[tipo] = r.domElement.toDataURL('image/png'));
}

function visor(el, tipo) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  r.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  const pm = new THREE.PMREMGenerator(r); const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const { sc, piv, cam, radio, alto } = escena(tipo); sc.environment = env;
  el.appendChild(r.domElement); r.domElement.className = 'eq3d-canvas';
  let giro = -0.62, elev = 0.4, vel = REDUCE ? 0 : 0.0022, arr = null, vivo = true, ultimoToque = 0;
  const tam = () => { const w = el.clientWidth || 600, h = el.clientHeight || 420; r.setSize(w, h, false); encuadrar(cam, radio, alto, w / h, giro, elev); };
  const ro = new ResizeObserver(tam); ro.observe(el); tam();
  const cv = r.domElement;
  cv.addEventListener('pointerdown', e => { arr = { x: e.clientX, y: e.clientY, g: giro, el: elev }; cv.setPointerCapture(e.pointerId); ultimoToque = Date.now(); });
  cv.addEventListener('pointermove', e => { if (!arr) return; giro = arr.g - (e.clientX - arr.x) * 0.008; elev = Math.max(0.05, Math.min(1.1, arr.el + (e.clientY - arr.y) * 0.005)); ultimoToque = Date.now(); });
  cv.addEventListener('pointerup', () => { arr = null; });
  cv.addEventListener('pointercancel', () => { arr = null; });
  (function bucle() {
    if (!vivo) return;
    if (!arr && Date.now() - ultimoToque > 2500) giro += vel;
    encuadrar(cam, radio, alto, cam.aspect, giro, elev);
    r.render(sc, cam);
    requestAnimationFrame(bucle);
  })();
  return { cerrar() { vivo = false; ro.disconnect(); r.dispose(); pm.dispose(); env.dispose(); cv.remove(); }, girar(d) { giro += d; ultimoToque = Date.now(); } };
}

let ok = true;
try { const c = document.createElement('canvas'); ok = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (_) { ok = false; }
window.SIMA_3D = { ok, miniatura, visor, tipos: Object.keys(MODELOS) };
window.dispatchEvent(new Event('sima:3d'));
