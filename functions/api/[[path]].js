/* =====================================================================
   SIMA · API sobre Cloudflare Pages Functions
   Rutas montadas bajo /api/*
   Enlaces (wrangler.toml):  env.DB → D1 · env.FOTOS → R2
   Variable secreta:         env.SESSION_SECRET (wrangler secret put)
   ===================================================================== */

const JSON_H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const ok   = (d, s = 200, extraHeaders = {}) => new Response(JSON.stringify(d), { status: s, headers: { ...JSON_H, ...extraHeaders } });
const err  = (m, s = 400, extraHeaders = {}) => ok({ error: m }, s, extraHeaders);
const nowISO = () => new Date().toISOString();
// Tiempo máximo de espera a la IA (Llama en Workers AI, u Ollama / Whisper).
const IA_TIMEOUT_MS = 45000;

/* ---------- Sesión: cookie firmada con HMAC-SHA256 --------------------
   No guarda nada en el servidor: el propio contenido de la cookie
   (correo + vencimiento) va firmado, así no se puede falsificar sin
   conocer SESSION_SECRET. El rol NO va en la cookie: se resuelve contra
   la tabla usuarios en cada pedido, así un cambio de rol o una baja
   aplican al instante, sin esperar a que venza la sesión.             */
const DURACION_SESION = 60 * 60 * 12; // 12 horas, en segundos

function b64u(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64uADecodificar(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function claveHMAC(secret) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function firmarSesion(email, secret) {
  const payload = JSON.stringify({ email, exp: Math.floor(Date.now() / 1000) + DURACION_SESION });
  const cuerpo = b64u(new TextEncoder().encode(payload));
  const clave = await claveHMAC(secret);
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(cuerpo));
  return `${cuerpo}.${b64u(firma)}`;
}
async function verificarSesion(token, secret) {
  // Una cookie corrupta (base64 o %-escape inválidos) es "sin sesión", no
  // un error 500: si no, la app quedaba en modo local sin pedir login.
  try {
    if (!token || !token.includes('.')) return null;
    const [cuerpo, firma] = token.split('.');
    const clave = await claveHMAC(secret);
    const valido = await crypto.subtle.verify('HMAC', clave, b64uADecodificar(firma), new TextEncoder().encode(cuerpo));
    if (!valido) return null;
    const { email, exp } = JSON.parse(new TextDecoder().decode(b64uADecodificar(cuerpo)));
    if (!email || !exp || exp < Math.floor(Date.now() / 1000)) return null;
    return { email };
  } catch (_) { return null; }
}
function leerCookie(request, nombre) {
  const cab = request.headers.get('Cookie') || '';
  const m = cab.match(new RegExp('(?:^|;\\s*)' + nombre + '=([^;]+)'));
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch (_) { return null; }
}
function esHTTPS(request) {
  // En local (wrangler pages dev) se sirve por http://localhost; en producción
  // (Cloudflare Pages) siempre es https. La cookie sólo lleva "Secure" cuando
  // corresponde, porque los navegadores descartan cookies Secure sobre HTTP.
  return new URL(request.url).protocol === 'https:';
}
function cookieSesion(token, maxAgeSeg, secure) {
  const seguro = secure ? ' Secure;' : '';
  return `sima_session=${encodeURIComponent(token)}; Path=/; HttpOnly;${seguro} SameSite=Lax; Max-Age=${maxAgeSeg}`;
}

/* ---------- Contraseñas: PBKDF2-HMAC-SHA256, 100.000 iteraciones ------ */
const ITER_PBKDF2 = 100000;
async function derivarHash(password, salBytes) {
  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salBytes, iterations: ITER_PBKDF2 }, clave, 256);
  return b64u(bits);
}
async function crearHashPassword(password) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivarHash(password, sal);
  return { hash, sal: b64u(sal) };
}
async function verificarPassword(password, hashGuardado, salGuardada) {
  const hash = await derivarHash(password, b64uADecodificar(salGuardada));
  // Comparación en tiempo constante.
  if (hash.length !== hashGuardado.length) return false;
  let dif = 0;
  for (let i = 0; i < hash.length; i++) dif |= hash.charCodeAt(i) ^ hashGuardado.charCodeAt(i);
  return dif === 0;
}

/* ---------- Identidad --------------------------------------------------
   Resuelve quién hace el pedido a partir de la cookie de sesión. Si no
   hay sesión válida, o el usuario fue dado de baja, es anónimo.        */
async function identidad(request, env) {
  const anonimoPor = motivo => ({ email: null, nombre: null, rol: null, anonimo: true, motivo });
  if (!env.SESSION_SECRET) return anonimoPor('falta-secreto');
  const token = leerCookie(request, 'sima_session');
  if (!token) return anonimoPor('sin-sesion');
  const sesion = await verificarSesion(token, env.SESSION_SECRET);
  if (!sesion) return anonimoPor('sesion-invalida');
  const fila = await env.DB.prepare('SELECT email,nombre,rol,activo,plantas,legajo FROM usuarios WHERE email=?').bind(sesion.email).first();
  if (!fila || !fila.activo) return anonimoPor('usuario-inactivo');
  return {
    email: fila.email, nombre: fila.nombre, rol: fila.rol,
    plantas: J(fila.plantas, ['planta2', 'planta8']), legajo: fila.legajo || '',
    anonimo: false
  };
}

const puedeEditar = u => u.rol === 'inspeccion';

async function auditar(env, u, accion, destino) {
  try {
    await env.DB.prepare('INSERT INTO auditoria (ts,email,accion,destino) VALUES (?,?,?,?)')
      .bind(nowISO(), u.email || 'anonimo', accion, destino || '').run();
  } catch (_) { /* la auditoría nunca debe tumbar la operación */ }
}

/* ---------- Mapeo fila ⇄ objeto de la app --------------------------- */
const J = (t, d) => { try { return t ? JSON.parse(t) : d; } catch (_) { return d; } };

const filaALev = r => ({
  id: r.id, modo: r.modo, rec: r.rec, recs: J(r.recs, []),
  planta: r.planta || 'planta2',
  area: r.area, sector: r.sector, subsector: r.subsector || '',
  cat: r.cat, sev: r.sev, desc: r.descripcion, estado: r.estado,
  fechaDet: r.fecha_det, detBy: r.det_by, ordenSAP: r.orden_sap || '',
  fotoDet: r.foto_det, fotoEjec: r.foto_ejec, fotoVal: r.foto_val,
  prog: J(r.prog, null), ejec: J(r.ejec, null), val: J(r.val, null),
  disc: r.disciplina || '', cal: J(r.cal, null), uid: r.uid || '',
  hist: J(r.hist, []), actualizado: r.actualizado,
  // Sólo viaja si está eliminado: así los registros normales no cambian de forma.
  ...(r.eliminado ? { eliminado: J(r.eliminado, null) } : {}),
  ...(r.tent ? { tent: J(r.tent, null) } : {}),
  ...(r.ia ? { ia: J(r.ia, null) } : {}),
  ...(r.ra ? { ra: J(r.ra, null) } : {})
});

/* Las correcciones de fecha de detección no forman parte de la trazabilidad
   del hallazgo (15-10-26): quedan sólo en el registro del recorrido. Se
   descartan al guardar, aunque un dispositivo suba una copia vieja. */
const HIST_OCULTO = 'Fecha de detección corregida';
const histVisible = h => (Array.isArray(h) ? h : []).filter(x => !(x && x.e === HIST_OCULTO));
const levAFila = l => [
  l.id, l.modo || 'libre', l.rec || null, JSON.stringify(l.recs || []),
  l.planta || 'planta2',
  l.area, l.sector, l.subsector || '',
  l.cat, l.sev, l.desc || '', l.estado,
  l.fechaDet, l.detBy || '', l.ordenSAP || '',
  l.fotoDet || null, l.fotoEjec || null, l.fotoVal || null,
  JSON.stringify(l.prog || null), JSON.stringify(l.ejec || null),
  JSON.stringify(l.val || null), JSON.stringify(histVisible(l.hist)),
  l.disc || null, JSON.stringify(l.cal || null), l.uid || null,
  l.eliminado ? JSON.stringify(l.eliminado) : null,
  l.tent ? JSON.stringify(l.tent) : null,
  l.ia ? JSON.stringify(l.ia) : null,
  l.ra ? JSON.stringify(l.ra) : null,
  nowISO()   // la hora la pone el servidor: el reloj de cada dispositivo no es confiable
];

const SQL_UPSERT_LEV = `
INSERT INTO levantamientos
 (id,modo,rec,recs,planta,area,sector,subsector,cat,sev,descripcion,estado,
  fecha_det,det_by,orden_sap,foto_det,foto_ejec,foto_val,prog,ejec,val,hist,
  disciplina,cal,uid,eliminado,tent,ia,ra,actualizado)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
ON CONFLICT(id) DO UPDATE SET
 modo=excluded.modo, rec=excluded.rec, recs=excluded.recs, planta=excluded.planta,
 area=excluded.area, sector=excluded.sector, subsector=excluded.subsector,
 cat=excluded.cat, sev=excluded.sev, descripcion=excluded.descripcion,
 estado=excluded.estado, fecha_det=excluded.fecha_det, det_by=excluded.det_by,
 orden_sap=excluded.orden_sap, foto_det=excluded.foto_det,
 foto_ejec=excluded.foto_ejec, foto_val=excluded.foto_val,
 prog=excluded.prog, ejec=excluded.ejec, val=excluded.val, hist=excluded.hist,
 disciplina=excluded.disciplina, cal=excluded.cal, uid=COALESCE(levantamientos.uid, excluded.uid),
 eliminado=excluded.eliminado, tent=excluded.tent, ia=COALESCE(excluded.ia, levantamientos.ia), ra=COALESCE(excluded.ra, levantamientos.ra), actualizado=excluded.actualizado`;

// «vista» (15-10-26): ve todo como el Inspector pero no modifica nada.
const ROLES_VALIDOS = ['inspeccion', 'mantenimiento', 'calidad', 'vista'];

/* ---------- Validación de lo que escriben los dispositivos ------------
   Antes cualquier sesión podía guardar cualquier registro tal cual llegaba
   (cerrar trabajos, escribir en otra planta, inyectar HTML en una foto).
   Ahora el servidor normaliza cada campo y aplica permisos por rol. */
const ESTADOS_OK = ['detectado', 'programado', 'en_ejecucion', 'pendiente_verificacion', 'cerrado'];
const SEVS_OK = ['critica', 'alta', 'media', 'baja'];
const DISC_OK = ['civil', 'electrico', 'mecanico', 'otro'];
const RE_ID_LEV = /^LV-[A-Za-z0-9_-]{1,40}$/;
const RE_ID_REC = /^REC-[A-Za-z0-9_-]{1,40}$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_FOTO = /^\/api\/foto\/[A-Za-z0-9_\-\/.]+$/;
const MAX_LOTE = 80;
const corto = (v, n) => (v == null ? '' : String(v).slice(0, n));
const fotoSegura = v => (typeof v === 'string' && RE_FOTO.test(v) && !v.includes('..')) ? v : null;
const objONull = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : null;

/* Fecha tentativa de ejecución (14-10-26): sólo fecha válida y un registro
   acotado de reprogramaciones. */
function limpiarTent(t) {
  if (!t || typeof t !== 'object' || !RE_FECHA.test(String(t.fecha || ''))) return null;
  const reprog = (Array.isArray(t.reprog) ? t.reprog : [])
    .filter(r => r && RE_FECHA.test(String(r.de || '')) && RE_FECHA.test(String(r.a || '')))
    .map(r => ({ de: r.de, a: r.a, motivo: corto(r.motivo, 300), by: corto(r.by, 160), d: corto(r.d, 40) })).slice(-60);
  return { fecha: t.fecha, by: corto(t.by, 160), d: corto(t.d, 40), reprog };
}
/* Control de Calidad (19-10-26): acepta o rechaza el trabajo cerrado. El
   rechazo exige motivo y justificación (mínimo JUST_MIN caracteres). */
const JUST_MIN = 15;
function limpiarCal(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  const base = { fecha: RE_FECHA.test(String(c.fecha || '')) ? c.fecha : nowISO().slice(0, 10), hora: corto(c.hora, 5), by: corto(c.by, 160) };
  if (c.resultado === 'rechazado') return { resultado: 'rechazado', ...base, motivo: corto(c.motivo, 120).trim(), just: corto(c.just, 1000).trim() };
  return base;
}
const calRechazo = c => !!(c && c.resultado === 'rechazado');
const rechazoValido = c => calRechazo(c) && !!c.motivo && (c.just || '').length >= JUST_MIN;
const mismoRechazo = (a, b) => calRechazo(a) && calRechazo(b) && a.fecha === b.fecha && a.hora === b.hora && a.by === b.by;

/* SIMA RA (17-11-26): marca de la no conformidad en realidad aumentada y su
   ubicación. Sólo números en rango y textos acotados. */
const RA_METODOS = ['webxr', 'camara', 'gps'];
function numEn(v, min, max) { const n = Number(v); return (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(n) && n >= min && n <= max ? n : null; }
function limpiarRA(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r) || !RA_METODOS.includes(r.metodo)) return null;
  const out = { metodo: r.metodo, d: corto(r.d, 40), by: corto(r.by, 160) };
  const lat = numEn(r.lat, -90, 90), lon = numEn(r.lon, -180, 180);
  if (lat != null && lon != null) { out.lat = lat; out.lon = lon; }
  const acc = numEn(r.acc, 0, 100000); if (acc != null) out.acc = acc;
  const alt = numEn(r.alt, -1000, 10000); if (alt != null) out.alt = alt;
  const rb = numEn(r.rumbo, 0, 360); if (rb != null) out.rumbo = rb;
  const dist = numEn(r.dist, 0, 500); if (dist != null) out.dist = dist;
  if (r.insp && typeof r.insp === 'object') {
    const a = numEn(r.insp.lat, -90, 90), b = numEn(r.insp.lon, -180, 180);
    if (a != null && b != null) out.insp = { lat: a, lon: b };
  }
  if (r.px && typeof r.px === 'object') {
    const x = numEn(r.px.x, 0, 1), y = numEn(r.px.y, 0, 1);
    if (x != null && y != null) out.px = { x, y };
  }
  return out;
}

function limpiarLev(l) {
  if (!l || typeof l !== 'object' || !RE_ID_LEV.test(String(l.id || ''))) return null;
  return {
    id: String(l.id), modo: l.modo === 'libre' ? 'libre' : 'recorrido',
    rec: RE_ID_REC.test(String(l.rec || '')) ? String(l.rec) : null,
    recs: (Array.isArray(l.recs) ? l.recs : []).filter(x => RE_ID_REC.test(String(x))).slice(0, 300),
    planta: PLANTAS_VALIDAS.includes(l.planta) ? l.planta : 'planta2',
    area: corto(l.area, 40), sector: corto(l.sector, 160), subsector: corto(l.subsector, 160),
    cat: corto(l.cat, 40), sev: SEVS_OK.includes(l.sev) ? l.sev : null,   // la criticidad ya no se carga (14-10-26)
    disc: DISC_OK.includes(l.disc) ? l.disc : null,
    desc: corto(l.desc, 4000), estado: ESTADOS_OK.includes(l.estado) ? l.estado : 'detectado',
    fechaDet: RE_FECHA.test(String(l.fechaDet || '')) ? l.fechaDet : nowISO().slice(0, 10),
    detBy: corto(l.detBy, 160), ordenSAP: corto(l.ordenSAP, 40),
    fotoDet: fotoSegura(l.fotoDet), fotoEjec: fotoSegura(l.fotoEjec), fotoVal: fotoSegura(l.fotoVal),
    prog: objONull(l.prog), ejec: objONull(l.ejec), val: objONull(l.val), cal: limpiarCal(l.cal),
    hist: (Array.isArray(l.hist) ? l.hist : []).filter(h => h && typeof h === 'object').slice(-400),
    uid: corto(l.uid, 64),
    eliminado: (l.eliminado && typeof l.eliminado === 'object')
      ? { by: corto(l.eliminado.by, 160), d: corto(l.eliminado.d, 40), motivo: corto(l.eliminado.motivo, 300) } : null,
    tent: limpiarTent(l.tent),
    ia: limpiarIA(l.ia),
    ra: limpiarRA(l.ra)
  };
}
/* Registro de la sugerencia de IA (06-11-26): qué propuso el modelo y si el
   Inspector la aceptó o la cambió. Sirve para medir cuánto acierta. */
function limpiarIA(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const s = x.sug && typeof x.sug === 'object' ? x.sug : {};
  const a = x.acepto && typeof x.acepto === 'object' ? x.acepto : {};
  return {
    modelo: corto(x.modelo, 80), d: corto(x.d, 40), ms: Math.max(0, Math.min(600000, +x.ms || 0)),
    sug: { cat: corto(s.cat, 40), disc: DISC_OK.includes(s.disc) ? s.disc : '', conf: Math.max(0, Math.min(1, +s.conf || 0)) },
    acepto: { cat: !!a.cat, disc: !!a.disc, desc: !!a.desc },
    voz: !!x.voz
  };
}
/* Une dos historiales sin perder eventos: lo del servidor primero y después
   lo nuevo que trae el dispositivo. */
function unirHist(viejo, nuevo) {
  const vistos = new Set((viejo || []).map(h => JSON.stringify(h)));
  // «Detectado» lo fija el Inspector/administrador: el de un técnico o de
  // Calidad (quizá con una fecha ya corregida) no se suma como paso nuevo.
  return [...(viejo || []), ...(nuevo || []).filter(h => h && h.e !== 'Detectado' && h.e !== HIST_OCULTO && !vistos.has(JSON.stringify(h)))].slice(-400);
}
const asignadoA = (l, u) => (l.prog?.tecnicos || []).some(t => (t.email && t.email === u.email) || (u.legajo && t.lg === u.legajo))
  || (l.ejec?.apoyo || []).some(t => (t.email && t.email === u.email) || (u.legajo && t.lg === u.legajo));

async function guardarLevantamientos(env, u, cuerpo) {
  const crudos = Array.isArray(cuerpo) ? cuerpo : [cuerpo];
  if (crudos.length > MAX_LOTE) return err(`Máximo ${MAX_LOTE} hallazgos por envío.`, 413);
  const lista = crudos.map(limpiarLev);
  if (lista.some(x => !x)) return err('Hay hallazgos con un identificador inválido.', 400);
  if (!lista.length) return ok({ guardados: 0, remap: {}, rechazados: [] });

  const rechazados = [], remap = {}, aGuardar = [];
  const ids = [...new Set(lista.map(l => l.id))];
  const { results: filas } = await env.DB.prepare(
    `SELECT * FROM levantamientos WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
  const existentes = new Map((filas || []).map(f => [f.id, f]));

  // Próximo número libre por si hay que renumerar un choque de LV-.
  let proximo = null;
  const siguienteId = async () => {
    if (proximo == null) {
      const m = await env.DB.prepare("SELECT MAX(CAST(SUBSTR(id,4) AS INTEGER)) AS n FROM levantamientos WHERE id GLOB 'LV-[0-9]*'").first();
      const s = await env.DB.prepare("SELECT valor FROM meta WHERE clave='seq'").first();
      proximo = Math.max((m && m.n) || 0, +(s && s.valor) || 0) + 1;
    }
    let id;
    do { id = 'LV-' + (proximo++); } while (existentes.has(id) || ids.includes(id));
    return id;
  };

  /* Fecha de detección = fecha del recorrido de origen. Un hallazgo nuevo
     la toma del servidor (por si el administrador la corrigió mientras el
     dispositivo estaba sin señal); en uno existente sólo la cambia el
     administrador, al corregir la fecha del recorrido. */
  const recIds = [...new Set(lista.map(l => l.rec).filter(Boolean))];
  const fechaRec = new Map();
  if (recIds.length) {
    const { results: rr } = await env.DB.prepare(`SELECT id, fecha, fechas FROM recorridos WHERE id IN (${recIds.map(() => '?').join(',')})`).bind(...recIds).all();
    (rr || []).forEach(r => fechaRec.set(r.id, { fecha: r.fecha, fechas: J(r.fechas, null) || {} }));
  }
  const admin = esAdmin(u);

  for (const l of lista) {
    if (!u.plantas.includes(l.planta)) { rechazados.push(l.id); continue; }
    const fila = existentes.get(l.id);
    const viejo = fila ? filaALev(fila) : null;

    if (u.rol === 'inspeccion') {
      const choque = viejo && l.uid && viejo.uid !== l.uid;   // es otro hallazgo con el mismo número
      if ((!viejo || choque) && l.rec && fechaRec.has(l.rec)) {
        const fr = fechaRec.get(l.rec);
        l.fechaDet = fr.fechas[l.area] || fr.fecha;   // fecha del área dentro del recorrido
      }
      else if (viejo && !choque && !admin) l.fechaDet = viejo.fechaDet;
      // Eliminar y restaurar es sólo del administrador.
      if (!admin) l.eliminado = (viejo && !choque) ? (viejo.eliminado || null) : null;
      else if (viejo && !choque && !!l.eliminado !== !!viejo.eliminado)
        await auditar(env, u, l.eliminado ? 'eliminar-levantamiento' : 'restaurar-levantamiento', l.id + (l.eliminado ? ' · ' + l.eliminado.motivo : ''));
      // Dos dispositivos crearon el mismo número: el que llega segundo se
      // renumera en lugar de pisar al primero (antes se perdía entero).
      if (viejo && l.uid && viejo.uid !== l.uid) {
        const nuevo = await siguienteId();
        remap[l.id] = nuevo;
        l.hist.push({ e: 'Renumerado', by: 'Sistema', d: nowISO().slice(0, 16).replace('T', ' '), n: `${l.id} ya existía en otro dispositivo; este hallazgo pasa a ser ${nuevo}` });
        l.id = nuevo;
      } else if (viejo && !admin) {
        // La fecha de detección (y su paso «Detectado» en la trazabilidad)
        // sólo la cambia el administrador: una copia vieja no la revierte.
        const dv = (viejo.hist || []).find(h => h && h.e === 'Detectado');
        const k = (l.hist || []).findIndex(h => h && h.e === 'Detectado');
        if (dv && k >= 0) l.hist[k] = dv;
      }
      if (viejo && !choque) {
        // La aceptación o el rechazo los registra sólo Control de Calidad.
        // Si el dispositivo no se enteró de un rechazo (copia vieja), no lo
        // revierte: se conserva el estado del servidor y se unen historiales.
        if (calRechazo(viejo.cal) && !mismoRechazo(l.cal, viejo.cal)) {
          Object.assign(l, { estado: viejo.estado, prog: viejo.prog, ejec: viejo.ejec, fotoEjec: viejo.fotoEjec, val: viejo.val });
          l.hist = unirHist(viejo.hist, l.hist);
        }
        l.cal = viejo.cal || null;
      } else if (!viejo) l.cal = null;
      aGuardar.push(l);
      continue;
    }
    // Mantenimiento y Calidad sólo actualizan registros que ya existen, y
    // sólo sus propios campos: no pueden crear, cerrar ni reprogramar.
    if (!viejo || viejo.planta !== l.planta) { rechazados.push(l.id); continue; }
    if (u.rol === 'mantenimiento') {
      if (!asignadoA(viejo, u)) { rechazados.push(l.id); continue; }
      const pasos = { programado: ['en_ejecucion'], en_ejecucion: ['pendiente_verificacion'] };
      const estado = (l.estado === viejo.estado || (pasos[viejo.estado] || []).includes(l.estado)) ? l.estado : viejo.estado;
      // La ejecución sólo se carga mientras el trabajo está programado o en
      // ejecución: una copia vieja no repone la de un trabajo rechazado.
      const enCurso = ['programado', 'en_ejecucion'].includes(viejo.estado);
      aGuardar.push({ ...viejo, estado, ejec: enCurso ? l.ejec : viejo.ejec, fotoEjec: enCurso ? l.fotoEjec : viejo.fotoEjec, hist: unirHist(viejo.hist, l.hist) });
    } else if (u.rol === 'calidad') {
      const pendiente = viejo.estado === 'cerrado' && (!viejo.cal || calRechazo(viejo.cal));
      if (calRechazo(l.cal) && !mismoRechazo(l.cal, viejo.cal)) {
        // Rechazo nuevo: sólo sobre un trabajo cerrado que espera el control,
        // y con motivo y justificación. Vuelve a «por programar».
        if (!pendiente || !rechazoValido(l.cal)) { rechazados.push(l.id); continue; }
        aGuardar.push({ ...viejo, estado: 'detectado', cal: l.cal, ejec: null, fotoEjec: null, val: null,
          prog: viejo.prog ? { ...viejo.prog, fecha: null } : null, hist: unirHist(viejo.hist, l.hist) });
        await auditar(env, u, 'rechazo-calidad', l.id + ' · ' + l.cal.motivo);
      } else {
        // Aceptar (sobre un cerrado pendiente) o anular una aceptación. Un
        // rechazo ya registrado no se borra desde aquí.
        let cal = viejo.cal;
        if (viejo.estado === 'cerrado') {
          if (l.cal && !calRechazo(l.cal) && pendiente) cal = l.cal;
          else if (!l.cal && viejo.cal && !calRechazo(viejo.cal)) cal = null;
        }
        aGuardar.push({ ...viejo, cal, hist: unirHist(viejo.hist, l.hist) });
      }
    } else {
      rechazados.push(l.id);
    }
  }

  if (aGuardar.length) {
    const stmt = env.DB.prepare(SQL_UPSERT_LEV);
    await env.DB.batch(aGuardar.map(l => stmt.bind(...levAFila(l))));
    // El contador sube con lo que se guardó, sea quien sea el que lo cargó:
    // así ningún dispositivo vuelve a repartir un número ya usado.
    const max = Math.max(0, ...aGuardar.map(l => parseInt(String(l.id).slice(3), 10)).filter(n => n > 0));
    if (max) await env.DB.prepare("INSERT INTO meta (clave,valor) VALUES ('seq',?) ON CONFLICT(clave) DO UPDATE SET valor=CAST(MAX(CAST(valor AS INTEGER),CAST(excluded.valor AS INTEGER)) AS TEXT)").bind(String(max + 1)).run();
    await auditar(env, u, 'guardar-levantamientos', aGuardar.map(l => l.id).join(','));
  }
  return ok({ guardados: aGuardar.length, remap, rechazados, ts: nowISO() });
}
const PLANTAS_VALIDAS = ['planta1', 'planta2', 'planta8'];   // planta1: 12-11-26, copia de Planta 2 para presentaciones
/* Normaliza la lista de plantas que llega del cliente: sólo valores
   conocidos, sin duplicados, y nunca vacía (un usuario sin ninguna
   planta habilitada no podría entrar a ningún dato). */
function normPlantas(arr) {
  const limpio = [...new Set((Array.isArray(arr) ? arr : []).filter(p => PLANTAS_VALIDAS.includes(p)))];
  return limpio.length ? limpio : PLANTAS_VALIDAS.slice();
}

/* Dueño del sistema: la única cuenta que administra Configuración
   (estructura, padrón de técnicos y alta/baja de usuarios). Tiene que
   coincidir, en minúsculas, con CORREO_DUENO de public/index.html.
   El frontend esconde la sección; esto es lo que de verdad la cierra. */
const CORREO_DUENO = 'germans2206@gmail.com';
const esDueno = u => String(u.email || '').trim().toLowerCase() === CORREO_DUENO;

const esAdmin = u => u.rol === 'inspeccion' && esDueno(u);

/* ---------- Auto-migración del esquema -------------------------------
   Las columnas nuevas se agregan solas la primera vez que la API arranca,
   así publicar una versión nueva no depende de acordarse de correr un SQL
   a mano en la consola de D1 (si alguien lo corre igual, no pasa nada:
   sólo se agrega lo que falta). Se chequea una vez por instancia. */
const COLUMNAS_NUEVAS = {
  usuarios: [
    ['plantas', `TEXT NOT NULL DEFAULT '["planta2","planta8"]'`],   // cambios 10-10-26
    ['legajo', 'TEXT']
  ],
  levantamientos: [
    ['disciplina', 'TEXT'],   // civil | electrico | mecanico | otro (cambios 12-10-26)
    ['cal', 'TEXT'],          // JSON {fecha,by}: verificación de Control de Calidad
    ['uid', 'TEXT'],          // identificador único del registro: detecta choques de número LV-
    ['eliminado', 'TEXT'],    // JSON {by,d,motivo}: eliminado por el administrador (se puede restaurar)
    ['tent', 'TEXT'],         // JSON {fecha,by,d,reprog:[{de,a,motivo,by,d}]}: fecha tentativa de ejecución
    ['ra', 'TEXT'],           // JSON {metodo,lat,lon,acc,alt,rumbo,dist,insp,px,d,by}: marca de RA y ubicación (SIMA RA 17-11-26)
    ['ia', 'TEXT']            // JSON {modelo,d,ms,sug:{cat,disc,conf},acepto:{cat,disc,desc},voz}: asistente de IA (06-11-26)
  ],
  recorridos: [
    ['cambios', 'TEXT'],      // JSON [{de,a,area,by,d,motivo}]: correcciones de fecha hechas por el administrador
    ['fechas', 'TEXT'],       // JSON {fria,caliente,exteriores}: fecha de cada área dentro del recorrido
    ['plan', 'TEXT']          // JSON {fria,caliente,exteriores}: días planificados de la ruta (calendario)
  ]
};
/* Migración automática de columnas (una vez por instancia del servidor).
   Antes se guardaba la PROMESA en una variable global y la esperaban todos
   los pedidos. En Cloudflare Workers eso es peligroso: la promesa queda
   atada al pedido que la creó y, si ese pedido se corta (el usuario recarga,
   cambia de pantalla o el celular pierde señal), los demás pedidos de esa
   instancia quedan esperando algo que nunca termina → «SIMA no respondió a
   tiempo». Ahora cada pedido hace su propia verificación hasta que una
   termina bien; después sólo se consulta un booleano (16-10-26). */
let esquemaOK = false;
async function asegurarEsquema(env) {
  if (esquemaOK) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS intentos (clave TEXT PRIMARY KEY, n INTEGER NOT NULL, desde TEXT NOT NULL)').run();
  for (const [tabla, cols] of Object.entries(COLUMNAS_NUEVAS)) {
    const { results } = await env.DB.prepare(`PRAGMA table_info(${tabla})`).all();
    const hay = new Set((results || []).map(c => c.name));
    if (!hay.size) continue;   // la tabla todavía no existe: la crea schema.sql
    for (const [col, tipo] of cols) {
      if (hay.has(col)) continue;
      try { await env.DB.prepare(`ALTER TABLE ${tabla} ADD COLUMN ${col} ${tipo}`).run(); }
      catch (e) { if (!/duplicate column/i.test(String(e && e.message))) throw e; }
    }
  }
  esquemaOK = true;
}

/* ---------- Router --------------------------------------------------- */
/* Ningún pedido queda colgado: si la base no contesta en 15 s, se responde
   un error claro (el cliente lo muestra y puede reintentar) en lugar de
   dejar al celular esperando hasta su propio límite. */
const TOPE_PEDIDO_MS = 15000;
// La IA (Llama / Whisper) puede tardar más que la base:
// tiene su propio límite, un poco por encima del de la llamada al modelo.
const TOPE_IA_MS = IA_TIMEOUT_MS + 5000;
export async function onRequest(context) {
  let t;
  const esIA = /^\/api\/ia(\/|$)/.test(new URL(context.request.url).pathname);
  const tope = new Promise(r => { t = setTimeout(() => r(err('SIMA tardó demasiado en responder. Volvé a intentar en unos segundos.', 503)), esIA ? TOPE_IA_MS : TOPE_PEDIDO_MS); });
  try { return await Promise.race([atender(context), tope]); }
  finally { clearTimeout(t); }
}
async function atender(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const ruta = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');

  if (!env.DB) return err('Falta el enlace D1 «DB». Revisá wrangler.toml.', 500);
  if (!env.SESSION_SECRET) return err('Falta la variable secreta SESSION_SECRET. Corré: wrangler secret put SESSION_SECRET', 500);
  try { await asegurarEsquema(env); }
  catch (e) { return err('No se pudo actualizar la base de datos: ' + (e && e.message ? e.message : e), 500); }

  try {
    /* --- login / logout: no requieren sesión previa --- */
    if (ruta === 'login' && request.method === 'POST') return manejarLogin(context);
    if (ruta === 'logout' && request.method === 'POST')
      return ok({ ok: true }, 200, { 'Set-Cookie': cookieSesion('', 0, esHTTPS(request)) });

    const u = await identidad(request, env);

    /* --- salud e identidad --- */
    if (ruta === 'ping')
      return ok({ ok: true, usuario: u.email, nombre: u.nombre, rol: u.rol, plantas: u.plantas, legajo: u.legajo, anonimo: u.anonimo, ts: nowISO() });

    // A partir de acá, todo exige sesión válida.
    if (u.anonimo) return err('Sesión no válida o vencida. Iniciá sesión de nuevo.', 401);

    /* Fallos de ingreso guardados en el equipo (sin señal hacia SIMA): se
       reciben en el próximo ingreso exitoso y quedan en la auditoría. No
       modifica datos de la app, por eso lo puede enviar cualquier rol. */
    if (ruta === 'diag' && request.method === 'POST') {
      const cuerpo = await request.json().catch(() => ({}));
      const fallos = (Array.isArray(cuerpo.fallos) ? cuerpo.fallos : []).slice(-20);
      for (const f of fallos) {
        if (!f || typeof f !== 'object') continue;
        const cf = request.cf || {};
        const txt = ['ts', 'internet', 'tiempo', 'red', 'efectiva', 'err', 'ua'].map(k => k + '=' + String(f[k] ?? '').slice(0, 160)).join(' | ')
          + ' | enviado-desde=' + [cf.asOrganization, cf.country].filter(Boolean).join(' · ');
        await auditar(env, u, 'diag-login', txt.slice(0, 700));
      }
      return ok({ ok: true, recibidos: fallos.length });
    }

    /* Usuario vista: sólo lectura. Cualquier escritura (hallazgos, fotos,
       recorridos, configuración, usuarios) se corta acá, antes de llegar a
       cada ruta, aunque alguien arme el pedido a mano. */
    // Excepción: dictar y preguntarle a SIMI no modifican datos (06-11-26).
    if (u.rol === 'vista' && !['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !['ia/transcribir', 'ia/consulta', 'ia/chat'].includes(ruta))
      return err('El usuario vista es sólo de lectura: no puede modificar nada.', 403);

    /* --- asistente de IA (Llama en Workers AI, u Ollama) --- */
    if (ruta === 'ia' || ruta.startsWith('ia/')) return manejarIA(context, ruta, u);

    /* --- fotos --- */
    if (ruta.startsWith('foto')) return manejarFoto(context, ruta, u);

    /* --- gestión de usuarios (sólo la cuenta dueña) --- */
    if (ruta === 'usuarios') return manejarUsuarios(context, u);

    /* --- técnicos asignables (cambios 12-10-26) ---
       Ya no hay padrón cargado por CSV: los técnicos son los usuarios
       activos con rol Mantenimiento. Lo puede leer cualquier sesión válida
       (el Inspector para programar, el técnico para sumar apoyo al cerrar),
       sin hash ni sal — sólo lo necesario para asignar. */
    if (ruta === 'tecnicos' && request.method === 'GET') {
      const { results } = await env.DB.prepare(
        "SELECT email,nombre,legajo,plantas FROM usuarios WHERE rol='mantenimiento' AND activo=1 ORDER BY nombre").all();
      return ok({
        tecnicos: (results || []).map(r => ({
          email: r.email, n: r.nombre, lg: r.legajo || '', plantas: J(r.plantas, ['planta2', 'planta8'])
        })).filter(t => t.plantas.some(p => u.plantas.includes(p)))
      });
    }

    /* --- estado completo (o incremental con ?desde=) --- */
    if (ruta === 'estado' && request.method === 'GET') return traerEstado(env, url, u);

    /* --- escrituras --- */
    if (request.method === 'PUT' || request.method === 'POST') {
      if (ruta === 'config' && !(puedeEditar(u) && esDueno(u)))
        return err('Sólo la cuenta dueña modifica la configuración.', 403);

      const cuerpo = await request.json();

      if (ruta === 'levantamientos') return guardarLevantamientos(env, u, cuerpo);

      if (ruta === 'recorridos') {
        const crudos = Array.isArray(cuerpo) ? cuerpo : [cuerpo];
        if (crudos.length > MAX_LOTE) return err(`Máximo ${MAX_LOTE} recorridos por envío.`, 413);
        // Sólo el Inspector crea y cierra recorridos. A los demás roles se les
        // responde bien pero no se guarda nada (no es un error de su equipo).
        if (u.rol !== 'inspeccion') return ok({ guardados: 0, rechazados: crudos.map(r => r && r.id), ts: nowISO() });
        const lista = crudos.filter(r => r && RE_ID_REC.test(String(r.id || '')) && PLANTAS_VALIDAS.includes(r.planta || 'planta2') && u.plantas.includes(r.planta || 'planta2'));
        if (!lista.length) return ok({ guardados: 0, ts: nowISO() });
        /* La fecha de un recorrido que ya existe sólo la cambia el
           administrador (Configuración → Fechas de recorridos), y cada cambio
           viaja con su registro {de,a,by,d,motivo}. Un dispositivo con una
           copia vieja no puede volver la fecha atrás ni borrar ese registro. */
        const { results: filasRec } = await env.DB.prepare(
          `SELECT id, fecha, cambios, fechas, estado FROM recorridos WHERE id IN (${lista.map(() => '?').join(',')})`).bind(...lista.map(r => r.id)).all();
        const recPrevios = new Map((filasRec || []).map(f => [f.id, f]));
        const admin = esAdmin(u);
        const limpiarCambios = arr => (Array.isArray(arr) ? arr : []).filter(c => c && RE_FECHA.test(String(c.de || '')) && RE_FECHA.test(String(c.a || '')))
          .map(c => ({ de: c.de, a: c.a, ...(c.area ? { area: corto(c.area, 30) } : {}), by: corto(c.by, 160), d: corto(c.d, 40), motivo: corto(c.motivo, 300) })).slice(-100);
        // Fecha de cada área: sólo claves de área y fechas válidas.
        const limpiarFechas = o => {
          if (!o || typeof o !== 'object') return null;
          const out = {};
          for (const [k, v] of Object.entries(o).slice(0, 10)) if (/^[a-z_]{1,30}$/.test(k) && RE_FECHA.test(String(v || ''))) out[k] = v;
          return Object.keys(out).length ? out : null;
        };
        const stmt = env.DB.prepare(`
          INSERT INTO recorridos (id,fecha,by_user,estado,sectores,planta,actualizado,cambios,fechas,plan)
          VALUES (?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET
            fecha=excluded.fecha, by_user=excluded.by_user, estado=excluded.estado,
            sectores=excluded.sectores, planta=excluded.planta, actualizado=excluded.actualizado,
            cambios=excluded.cambios, fechas=excluded.fechas, plan=excluded.plan
          `);
        await env.DB.batch(lista.map(r => {
          const previo = recPrevios.get(r.id);
          let fecha = RE_FECHA.test(String(r.fecha || '')) ? r.fecha : nowISO().slice(0, 10);
          const viejos = previo ? limpiarCambios(J(previo.cambios, [])) : [];
          let cambios = viejos;
          let fechas = limpiarFechas(r.fechas);
          // Un recorrido planificado todavía no ocurrió: su fecha la mueve cualquier
          // inspector (al planificar o al comenzarlo). Una vez real, sólo el admin.
          if (previo && !admin && previo.estado !== 'planificado') { fecha = previo.fecha; fechas = limpiarFechas(J(previo.fechas, null)); }
          else if (admin) {
            const vistos = new Set(viejos.map(c => JSON.stringify(c)));
            cambios = viejos.concat(limpiarCambios(r.cambios).filter(c => !vistos.has(JSON.stringify(c)))).slice(-100);
          }
          return stmt.bind(
            r.id, fecha, corto(r.by, 160),
            ['cerrado', 'planificado', 'anulado'].includes(r.estado) ? r.estado : 'en_curso',
            JSON.stringify((Array.isArray(r.sectores) ? r.sectores : []).map(x => corto(x, 220)).slice(0, 500)),
            r.planta || 'planta2', nowISO(), JSON.stringify(cambios), fechas ? JSON.stringify(fechas) : null,
            limpiarFechas(r.plan) ? JSON.stringify(limpiarFechas(r.plan)) : null);
        }));
        const max = Math.max(0, ...lista.map(r => parseInt(String(r.id).slice(4), 10)).filter(n => n > 0));
        if (max) await env.DB.prepare("INSERT INTO meta (clave,valor) VALUES ('recSeq',?) ON CONFLICT(clave) DO UPDATE SET valor=CAST(MAX(CAST(valor AS INTEGER),CAST(excluded.valor AS INTEGER)) AS TEXT)").bind(String(max + 1)).run();
        await auditar(env, u, 'guardar-recorridos', lista.map(r => r.id).join(','));
        return ok({ guardados: lista.length, ts: nowISO() });
      }

      if (ruta === 'config') {
        // estructura y tecnicos viajan separados por planta — nunca se
        // mezclan: {planta2:{area:[{s,subs}]}, planta8:{...}} y
        // {planta2:[{n,lg}], planta8:[...]}. Cada plant se borra e inserta
        // por separado, así que guardar la config de una planta jamás
        // toca los datos de la otra.
        const ops = [];
        /* 12-11-26: sólo las plantas habilitadas para el usuario, y una planta
           que llega sin ningún sector (o sin técnicos) no borra lo que el
           servidor ya tiene: es un dispositivo que todavía no bajó esa
           planta y la completó vacía (pasa al agregar una planta nueva). */
        const conFilas = async tabla => new Set(((await env.DB.prepare(`SELECT DISTINCT planta FROM ${tabla}`).all()).results || []).map(r => r.planta));
        const habil = pl => PLANTAS_VALIDAS.includes(pl) && (u.plantas || []).includes(pl);
        if (cuerpo.estructura) {
          const st = env.DB.prepare('INSERT INTO estructura (planta,area,orden,sector,subs) VALUES (?,?,?,?,?)');
          const yaHay = await conFilas('estructura');
          const vacia = e => !Object.values(e).some(a => Array.isArray(a) && a.length);
          Object.keys(cuerpo.estructura).filter(pl => habil(pl) && cuerpo.estructura[pl] && typeof cuerpo.estructura[pl] === 'object' && !(vacia(cuerpo.estructura[pl]) && yaHay.has(pl))).forEach(planta => {
            ops.push(env.DB.prepare('DELETE FROM estructura WHERE planta = ?').bind(planta));
            const vistos = new Set();
            Object.keys(cuerpo.estructura[planta]).forEach(area =>
              (Array.isArray(cuerpo.estructura[planta][area]) ? cuerpo.estructura[planta][area] : []).forEach((sc, i) => {
                const nombre = corto(sc && sc.s, 160).trim();
                if (!nombre || vistos.has(area + '|' + nombre)) return;   // un sector repetido tumbaba todo el lote
                vistos.add(area + '|' + nombre);
                ops.push(st.bind(planta, corto(area, 40), i, nombre, JSON.stringify((Array.isArray(sc.subs) ? sc.subs : []).map(x => corto(x, 160)))));
              }));
          });
        }
        if (cuerpo.tecnicos) {
          const st = env.DB.prepare('INSERT INTO tecnicos (planta,legajo,nombre,orden) VALUES (?,?,?,?)');
          const yaHayT = await conFilas('tecnicos');
          Object.keys(cuerpo.tecnicos).filter(pl => habil(pl) && Array.isArray(cuerpo.tecnicos[pl]) && !(cuerpo.tecnicos[pl].length === 0 && yaHayT.has(pl))).forEach(planta => {
            ops.push(env.DB.prepare('DELETE FROM tecnicos WHERE planta = ?').bind(planta));
            const vistos = new Set();
            cuerpo.tecnicos[planta].forEach((t, i) => {
              if (!t || !t.lg || vistos.has(String(t.lg))) return;
              vistos.add(String(t.lg));
              ops.push(st.bind(planta, corto(t.lg, 40), corto(t.n, 160), i));
            });
          });
        }
        // Los contadores nunca retroceden (un dispositivo desactualizado no
        // puede volver a repartir números ya usados).
        const st = env.DB.prepare('INSERT INTO meta (clave,valor) VALUES (?,?) ON CONFLICT(clave) DO UPDATE SET valor=CAST(MAX(CAST(valor AS INTEGER),CAST(excluded.valor AS INTEGER)) AS TEXT)');
        if (cuerpo.seq != null)    ops.push(st.bind('seq', String(cuerpo.seq)));
        if (cuerpo.recSeq != null) ops.push(st.bind('recSeq', String(cuerpo.recSeq)));
        if (ops.length) await env.DB.batch(ops);
        await auditar(env, u, 'guardar-config', '');
        return ok({ ok: true, ts: nowISO() });
      }
    }

    return err('Ruta no encontrada: /api/' + ruta, 404);
  } catch (e) {
    console.error('SIMA API', ruta, e);
    return err('Error del servidor. Probá de nuevo en unos segundos.', 500);
  }
}

/* ---------- Login ------------------------------------------------------ */
async function manejarLogin(context) {
  const { request, env } = context;
  let cuerpo;
  try { cuerpo = await request.json(); } catch (_) { return err('Cuerpo inválido.'); }
  const email = String(cuerpo.email || '').trim().toLowerCase();
  const password = String(cuerpo.password || '');
  if (!email || !password) return err('Completá correo y contraseña.');

  // Límite de intentos: 8 fallidos seguidos bloquean ese correo 15 minutos.
  const VENTANA = 15 * 60 * 1000, TOPE = 8;
  const intento = await env.DB.prepare('SELECT n,desde FROM intentos WHERE clave=?').bind(email).first();
  const vigente = intento && (Date.now() - Date.parse(intento.desde)) < VENTANA;
  if (vigente && intento.n >= TOPE) return err('Demasiados intentos fallidos. Esperá 15 minutos o pedile al administrador que te restablezca la contraseña.', 429);

  const fila = await env.DB.prepare('SELECT * FROM usuarios WHERE email=?').bind(email).first();
  // Mismo mensaje Y mismo tiempo de respuesta exista o no la cuenta: no
  // revelar qué correos están dados de alta.
  const fallo = async () => {
    await env.DB.prepare(vigente
      ? 'UPDATE intentos SET n=n+1 WHERE clave=?'
      : "INSERT INTO intentos (clave,n,desde) VALUES (?,1,?) ON CONFLICT(clave) DO UPDATE SET n=1, desde=excluded.desde")
      .bind(...(vigente ? [email] : [email, nowISO()])).run();
    return err('Correo o contraseña incorrectos.', 401);
  };
  if (!fila || !fila.activo) { await derivarHash(password, new Uint8Array(16)); return fallo(); }

  const okPass = await verificarPassword(password, fila.hash, fila.sal);
  if (!okPass) return fallo();
  if (intento) await env.DB.prepare('DELETE FROM intentos WHERE clave=?').bind(email).run();

  const token = await firmarSesion(email, env.SESSION_SECRET);
  // Red desde la que se ingresa (operadora / proveedor y país), para poder
  // ver qué redes llegan a SIMA y cuáles no (16-10-26).
  const cf = context.request.cf || {};
  await auditar(env, { email }, 'login', [cf.asOrganization, cf.asn ? 'AS' + cf.asn : '', cf.country].filter(Boolean).join(' · ').slice(0, 160));
  return ok(
    {
      ok: true, email: fila.email, nombre: fila.nombre, rol: fila.rol,
      plantas: J(fila.plantas, ['planta2', 'planta8']), legajo: fila.legajo || ''
    },
    200, { 'Set-Cookie': cookieSesion(token, DURACION_SESION, esHTTPS(request)) }
  );
}

/* ---------- Gestión de usuarios (sólo la cuenta dueña) ----------------- */
async function manejarUsuarios(context, u) {
  const { request, env } = context;
  if (!esAdmin(u)) return err('Sólo la cuenta dueña administra usuarios.', 403);

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT email,nombre,rol,activo,creado,plantas,legajo FROM usuarios ORDER BY creado').all();
    return ok({
      usuarios: results.map(r => ({
        email: r.email, nombre: r.nombre, rol: r.rol, activo: r.activo, creado: r.creado,
        plantas: J(r.plantas, ['planta2', 'planta8']), legajo: r.legajo || ''
      }))
    });
  }

  if (request.method === 'POST') {
    const c = await request.json();
    const email = String(c.email || '').trim().toLowerCase();
    const nombre = String(c.nombre || '').trim();
    const rol = c.rol;
    const password = String(c.password || '');
    const plantas = normPlantas(c.plantas);
    const legajo = String(c.legajo || '').trim();
    if (!email || !nombre) return err('Falta correo o nombre.');
    if (!ROLES_VALIDOS.includes(rol)) return err('Rol inválido.');
    if (password.length < 6) return err('La contraseña debe tener al menos 6 caracteres.');
    const existe = await env.DB.prepare('SELECT email FROM usuarios WHERE email=?').bind(email).first();
    if (existe) return err('Ya existe un usuario con ese correo.', 409);
    const { hash, sal } = await crearHashPassword(password);
    await env.DB.prepare(
      'INSERT INTO usuarios (email,nombre,rol,hash,sal,activo,creado,creado_por,plantas,legajo) VALUES (?,?,?,?,?,1,?,?,?,?)')
      .bind(email, nombre, rol, hash, sal, nowISO(), u.email, JSON.stringify(plantas), legajo || null).run();
    await auditar(env, u, 'crear-usuario', email);
    return ok({ ok: true, email, nombre, rol, activo: 1, plantas, legajo }, 201);
  }

  if (request.method === 'PUT') {
    const c = await request.json();
    const email = String(c.email || '').trim().toLowerCase();
    if (!email) return err('Falta el correo del usuario a modificar.');
    if (email === u.email && (c.activo === false || c.activo === 0))
      return err('No podés desactivar tu propia cuenta.', 400);
    if (email === u.email && c.rol && c.rol !== u.rol)
      return err('No podés cambiar el rol de tu propia cuenta: perderías el acceso de administración.', 400);
    const sets = [], binds = [];
    if (c.nombre) { sets.push('nombre=?'); binds.push(String(c.nombre).trim()); }
    if (c.rol) {
      if (!ROLES_VALIDOS.includes(c.rol)) return err('Rol inválido.');
      sets.push('rol=?'); binds.push(c.rol);
    }
    if (c.activo !== undefined) { sets.push('activo=?'); binds.push(c.activo ? 1 : 0); }
    if (c.plantas !== undefined) { sets.push('plantas=?'); binds.push(JSON.stringify(normPlantas(c.plantas))); }
    if (c.legajo !== undefined) { sets.push('legajo=?'); binds.push(String(c.legajo).trim() || null); }
    if (c.password) {
      if (String(c.password).length < 6) return err('La contraseña debe tener al menos 6 caracteres.');
      const { hash, sal } = await crearHashPassword(String(c.password));
      sets.push('hash=?', 'sal=?'); binds.push(hash, sal);
    }
    if (!sets.length) return err('Nada para actualizar.');
    binds.push(email);
    const r = await env.DB.prepare(`UPDATE usuarios SET ${sets.join(',')} WHERE email=?`).bind(...binds).run();
    if (!r.meta || r.meta.changes === 0) return err('Usuario no encontrado.', 404);
    await auditar(env, u, 'editar-usuario', email);
    return ok({ ok: true });
  }

  if (request.method === 'DELETE') {
    const email = String(new URL(request.url).searchParams.get('email') || '').trim().toLowerCase();
    if (!email) return err('Falta el correo.');
    if (email === u.email) return err('No podés eliminar tu propia cuenta.', 400);
    await env.DB.prepare('DELETE FROM usuarios WHERE email=?').bind(email).run();
    await auditar(env, u, 'eliminar-usuario', email);
    return ok({ ok: true });
  }

  return err('Método no permitido para /api/usuarios', 405);
}

/* ---------- Estado ---------------------------------------------------- */
async function traerEstado(env, url, u) {
  const desde = url.searchParams.get('desde');
  // La marca de tiempo se toma ANTES de consultar: lo que se guarde mientras
  // tanto entra en la próxima traída incremental en lugar de perderse.
  const ts = nowISO();
  // Cada usuario recibe sólo las plantas que tiene habilitadas.
  const pls = (u.plantas || []).filter(p => PLANTAS_VALIDAS.includes(p));
  const enPl = `COALESCE(planta,'planta2') IN (${pls.map(() => '?').join(',') || "''"})`;

  const qLev = desde
    ? env.DB.prepare(`SELECT * FROM levantamientos WHERE ${enPl} AND actualizado > ? ORDER BY actualizado`).bind(...pls, desde)
    : env.DB.prepare(`SELECT * FROM levantamientos WHERE ${enPl} ORDER BY fecha_det DESC`).bind(...pls);
  const qRec = desde
    ? env.DB.prepare(`SELECT * FROM recorridos WHERE ${enPl} AND actualizado > ? ORDER BY fecha DESC`).bind(...pls, desde)
    : env.DB.prepare(`SELECT * FROM recorridos WHERE ${enPl} ORDER BY fecha DESC`).bind(...pls);

  const [lev, rec, est, tec, meta] = await Promise.all([
    qLev.all(), qRec.all(),
    env.DB.prepare(`SELECT * FROM estructura WHERE ${enPl} ORDER BY planta, area, orden`).bind(...pls).all(),
    env.DB.prepare(`SELECT * FROM tecnicos WHERE ${enPl} ORDER BY planta, orden`).bind(...pls).all(),
    env.DB.prepare('SELECT * FROM meta').all()
  ]);

  // estructura y tecnicos se agrupan primero por planta y recién adentro
  // por área — Planta 2 y Planta 8 quedan en ramas separadas del objeto,
  // nunca mezcladas.
  const estructura = {};
  est.results.forEach(r => {
    const pl = r.planta || 'planta2';
    const porPlanta = (estructura[pl] = estructura[pl] || {});
    (porPlanta[r.area] = porPlanta[r.area] || []).push({ s: r.sector, subs: J(r.subs, []) });
  });
  const tecnicos = {};
  tec.results.forEach(t => {
    const pl = t.planta || 'planta2';
    (tecnicos[pl] = tecnicos[pl] || []).push({ n: t.nombre, lg: t.legajo });
  });
  const m = {};
  meta.results.forEach(r => { m[r.clave] = r.valor; });

  return ok({
    levantamientos: lev.results.map(filaALev),
    recorridos: rec.results.map(r => ({
      id: r.id, fecha: r.fecha, by: r.by_user, estado: r.estado,
      sectores: J(r.sectores, []), planta: r.planta || 'planta2', actualizado: r.actualizado,
      cambios: J(r.cambios, []),
      ...(r.fechas ? { fechas: J(r.fechas, null) } : {}),
      ...(r.plan ? { plan: J(r.plan, null) } : {})
    })),
    estructura: Object.keys(estructura).length ? estructura : null,
    tecnicos: Object.keys(tecnicos).length ? tecnicos : null,
    seq: +(m.seq || 1),
    recSeq: +(m.recSeq || 1),
    parcial: !!desde,
    ts
  });
}

/* ---------- Fotos (R2) ------------------------------------------------ */
async function manejarFoto(context, ruta, u) {
  const { request, env } = context;
  if (!env.FOTOS) return err('Falta el enlace R2 «FOTOS». Revisá wrangler.toml.', 500);

  /* Subida: POST /api/foto  →  { dataUrl }  |  { key, url } */
  if (ruta === 'foto' && request.method === 'POST') {
    if (u.rol === 'vista') return err('El usuario vista es sólo de lectura.', 403);
    const { dataUrl, id, tipo } = await request.json();
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return err('dataUrl inválido');
    // Sólo fotos: un SVG o HTML subido como "imagen" se ejecutaría en el
    // dominio de SIMA. Y con tope de tamaño (la app las comprime a ~300 KB).
    if (dataUrl.length > 8000000) return err('La foto es demasiado grande (máximo ~6 MB).', 413);
    const coma = dataUrl.indexOf(',');
    const mime = dataUrl.slice(5, dataUrl.indexOf(';'));
    if (!/^image\/(jpeg|png|webp)$/.test(mime) || !dataUrl.slice(0, coma).endsWith(';base64')) return err('Formato de foto no admitido (JPG, PNG o WEBP).', 415);
    let bin;
    try { bin = atob(dataUrl.slice(coma + 1)); } catch (_) { return err('La foto llegó dañada.', 400); }
    const buf  = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);

    const ext = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const limpio = v => String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
    const key = `${new Date().toISOString().slice(0, 7)}/${limpio(id) || 'x'}-${limpio(tipo) || 'f'}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    await env.FOTOS.put(key, buf, { httpMetadata: { contentType: mime } });
    await auditar(env, u, 'subir-foto', key);
    return ok({ key, url: '/api/foto/' + key });
  }

  /* Descarga: GET /api/foto/<key> */
  if (request.method === 'GET') {
    let key = '';
    try { key = decodeURIComponent(ruta.replace(/^foto\/?/, '')); } catch (_) { key = ''; }
    if (!key || key.includes('..')) return err('Falta la clave de la foto', 404);
    const obj = await env.FOTOS.get(key);
    if (!obj) return err('Foto no encontrada', 404);
    const h = new Headers();
    obj.writeHttpMetadata(h);
    h.set('etag', obj.httpEtag);
    // Inmutables, pero privadas: requieren sesión, así que no se cachean en
    // proxies intermedios. nosniff + sandbox: nunca se interpretan como página.
    h.set('Cache-Control', 'private, max-age=31536000, immutable');
    h.set('X-Content-Type-Options', 'nosniff');
    h.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
    return new Response(obj.body, { headers: h });
  }

  return err('Método no permitido para /api/foto', 405);
}

/* =====================================================================
   Asistente de IA (06-11-26 · proveedores gratuitos 07-11-26)
   ---------------------------------------------------------------------
   La IA SUGIERE, el Inspector DECIDE: nada de lo que viene de acá se
   guarda solo. Si la IA no está configurada o no responde, SIMA sigue
   funcionando igual (la app oculta el panel o muestra el error y se
   carga el hallazgo normalmente).

   CADENA DE PROVEEDORES · se prueba en orden y, si uno falla (cupo
   agotado, 429, 5xx, demora), se pasa al siguiente sin que el usuario
   lo note. Sólo entran los que están configurados.

     1. groq          GROQ_API_KEY (gratis, sin tarjeta · console.groq.com)
                      GROQ_MODELO_TEXTO  openai/gpt-oss-120b (chat de SIMI)
                      GROQ_MODELO        qwen/qwen3.8-27b (con foto)
                      GROQ_WHISPER  whisper-large-v3-turbo
                      Groq dio de baja Llama 4 Scout (17-07-26) y Llama 3.3
                      70B (16-08-26) en el plan gratis. Si un modelo ya no
                      existe, SIMA prueba los de GROQ_RESPALDOS antes de
                      pasar al siguiente proveedor.
     2. huggingface   HF_TOKEN (Inference Providers · requiere créditos:
                      la cuenta gratis no los trae, PRO incluye USD 2/mes)
                      HF_MODELO     meta-llama/Llama-4-Scout-17B-16E-Instruct
     3. workers-ai    Binding "AI" de Cloudflare (10.000 neuronas/día
                      gratis; si se agotan, falla, no cobra)
                      IA_MODELO / WHISPER_MODELO
     4. ollama        OLLAMA_URL (+ OLLAMA_MODELO, OLLAMA_TOKEN,
                      CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET)

   IA_PROVEEDOR  opcional · fuerza cuál va primero (groq | huggingface |
                 workers-ai | ollama); los demás quedan de respaldo.
   WHISPER_URL   opcional · servidor propio compatible con OpenAI
                 (/v1/audio/transcriptions), último respaldo de la voz.
   IA_PLANTAS    opcional · "planta2,planta8" (vacío = todas)
   IA_DESACTIVADA "1" apaga el asistente sin tocar el código
   ===================================================================== */
const WAI_MODELO_DEF = '@cf/meta/llama-4-scout-17b-16e-instruct';
const WAI_WHISPER_DEF = '@cf/openai/whisper-large-v3-turbo';
const OLLAMA_MODELO_DEF = 'llama3.2-vision:11b';
const WHISPER_MODELO_DEF = 'Systran/faster-whisper-small';
const GROQ_BASE = 'https://api.groq.com/openai/v1';
const GROQ_MODELO_DEF = 'qwen/qwen3.8-27b';          // multimodal (foto + texto)
const GROQ_TEXTO_DEF = 'openai/gpt-oss-120b';         // sólo texto: chat de SIMI
const GROQ_RESPALDOS = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];
const GROQ_WHISPER_DEF = 'whisper-large-v3-turbo';
const HF_BASE = 'https://router.huggingface.co/v1';
const HF_MODELO_DEF = 'meta-llama/Llama-4-Scout-17B-16E-Instruct';
// Tope por proveedor externo: si no contesta, queda tiempo para el respaldo.
const IA_TOPE_PROVEEDOR_MS = 20000;
// Vocabulario de planta: ayuda a Whisper a escribir bien los términos.
const WHISPER_CONTEXTO = 'Hallazgo de inspección en el frigorífico. Fisura en el panel de la cámara 3, burlete dañado en la puerta de la antecámara, zócalo sanitario con filtración, óxido en la cañería, gotera en el techo, luminaria sin difusor, esterilizador y lavamanos sin agua, soldadura con porosidad, condensación y hielo en el evaporador, rejilla de desagüe tapada, silicona desprendida.';
const sinBarra = s => String(s || '').trim().replace(/\/+$/, '');
const PROVEEDORES_IA = ['groq', 'huggingface', 'workers-ai', 'ollama'];

function proveedorDisponible(env, p) {
  if (p === 'groq') return !!String(env.GROQ_API_KEY || '').trim();
  if (p === 'huggingface') return !!String(env.HF_TOKEN || '').trim();
  if (p === 'workers-ai') return !!(env.AI && typeof env.AI.run === 'function');
  if (p === 'ollama') return !!sinBarra(env.OLLAMA_URL);
  return false;
}
/* Proveedores configurados, en el orden en que se prueban. */
function cadenaIA(env) {
  if (String(env.IA_DESACTIVADA || '') === '1') return [];
  const quiere = String(env.IA_PROVEEDOR || '').trim().toLowerCase();
  const orden = PROVEEDORES_IA.includes(quiere) ? [quiere, ...PROVEEDORES_IA.filter(p => p !== quiere)] : PROVEEDORES_IA;
  return orden.filter(p => proveedorDisponible(env, p));
}
const proveedorIA = env => cadenaIA(env)[0] || null;
function modeloIA(env, prov, texto = false) {
  if (prov === 'groq') return texto ? (env.GROQ_MODELO_TEXTO || GROQ_TEXTO_DEF) : (env.GROQ_MODELO || GROQ_MODELO_DEF);
  if (prov === 'huggingface') return (texto && env.HF_MODELO_TEXTO) || env.HF_MODELO || HF_MODELO_DEF;
  if (prov === 'workers-ai') return (texto && env.IA_MODELO_TEXTO) || env.IA_MODELO || WAI_MODELO_DEF;
  return env.OLLAMA_MODELO || OLLAMA_MODELO_DEF;
}
/* Proveedores de voz, en orden: Groq → Workers AI → servidor propio. */
function cadenaVoz(env) {
  if (String(env.IA_DESACTIVADA || '') === '1') return [];
  const l = [];
  if (proveedorDisponible(env, 'groq')) l.push('groq');
  if (proveedorDisponible(env, 'workers-ai')) l.push('workers-ai');
  if (sinBarra(env.WHISPER_URL)) l.push('whisper-url');
  if (String(env.IA_PROVEEDOR || '').trim().toLowerCase() === 'workers-ai' && l[0] === 'groq') l.push(l.shift());
  return l;
}

function cabecerasIA(env, token) {
  const h = {};
  if (token) h.Authorization = 'Bearer ' + token;
  if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) {
    h['CF-Access-Client-Id'] = env.CF_ACCESS_CLIENT_ID;
    h['CF-Access-Client-Secret'] = env.CF_ACCESS_CLIENT_SECRET;
  }
  return h;
}
async function fetchConTope(url, opciones, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...opciones, signal: ctl.signal }); }
  finally { clearTimeout(t); }
}
// Workers AI no acepta AbortSignal: el límite se pone con una carrera.
function conTope(promesa, ms) {
  let t;
  const tope = new Promise((_, rej) => { t = setTimeout(() => { const e = new Error('tope'); e.name = 'AbortError'; rej(e); }, ms); });
  return Promise.race([promesa, tope]).finally(() => clearTimeout(t));
}
function plantasIA(env) {
  const l = String(env.IA_PLANTAS || '').split(',').map(x => x.trim()).filter(p => PLANTAS_VALIDAS.includes(p));
  return l.length ? l : PLANTAS_VALIDAS.slice();
}
const esCupo = e => !!(e && (e.http === 429 || /limit|quota|neuron|4006|429|rate/i.test(String(e.message))));

/* Estado de la IA. Con proveedores en la nube no se consulta nada (cada
   consulta gasta cupo). Con Ollama como único proveedor se pide la lista
   de modelos, con caché corta por instancia. */
let cacheEstadoIA = null;
async function estadoIA(env) {
  const cadena = cadenaIA(env);
  const prov = cadena[0];
  const voz = cadenaVoz(env).length > 0;
  if (!prov) return { activo: false, motivo: String(env.IA_DESACTIVADA || '') === '1' ? 'desactivada' : 'sin-configurar', voz };
  const modelo = modeloIA(env, prov);
  if (prov !== 'ollama' || cadena.length > 1) return { activo: true, proveedor: prov, respaldo: cadena.slice(1), modelo, voz };

  const base = sinBarra(env.OLLAMA_URL);
  if (cacheEstadoIA && Date.now() - cacheEstadoIA.t < 60000) return cacheEstadoIA.v;
  let v;
  try {
    const r = await fetchConTope(base + '/api/tags', { headers: cabecerasIA(env, env.OLLAMA_TOKEN) }, 5000);
    if (!r.ok) v = { activo: false, proveedor: prov, motivo: 'servidor-http-' + r.status, voz };
    else {
      const d = await r.json().catch(() => ({}));
      const nombres = (d.models || []).map(m => m.name || m.model);
      const hay = nombres.some(n => n === modelo || n === modelo + ':latest' || n.split(':')[0] === modelo);
      v = hay ? { activo: true, proveedor: prov, modelo, voz } : { activo: false, proveedor: prov, motivo: 'falta-modelo', modelo, voz };
    }
  } catch (_) { v = { activo: false, proveedor: prov, motivo: 'sin-respuesta', voz }; }
  cacheEstadoIA = { t: Date.now(), v };
  return v;
}

const PROMPT_IA = `Sos un asistente de inspección de mantenimiento edilicio e industrial en un frigorífico (planta de faena y procesamiento de carne). Te llega la foto de un hallazgo y/o lo que dijo o escribió el Inspector.

Tu tarea:
1. Elegir el TIPO de hallazgo de la lista permitida (usá exactamente la clave).
2. Elegir la DISCIPLINA que lo resuelve: civil (paredes, pisos, techos, zócalos, sellados, hermeticidad), electrico (conexiones, tomas, luminarias, tableros, cables), mecanico (puertas, soldaduras, equipos, cañerías, esterilizadores, lavamanos) u otro.
3. Escribir una DESCRIPCIÓN breve y técnica en español (máximo 2 oraciones, sin inventar medidas, marcas ni causas que no se vean o no se hayan dicho). Si el Inspector dio un texto, ordenalo y corregilo conservando TODOS sus datos (números, ubicaciones, nombres).
4. Indicar tu CONFIANZA de 0 a 1. Si la foto no se entiende o no muestra un problema claro, usá una confianza baja (menos de 0.5) y tipo "otro".
5. En "motivo", en pocas palabras, qué viste o leíste que justifica el tipo.
6. UBICACIÓN: si te pasan una lista de ubicaciones numeradas y el texto del Inspector nombra (o describe sin lugar a dudas) un sector o subsector de esa lista, devolvé su número en "ubic". Si no se menciona ninguno, o hay dudas, devolvé 0. Nunca adivines la ubicación por la foto.
7. VE: si hay foto, en "ve" contá en UNA frase corta, en primera persona y en tono cercano, qué ves en la foto («Veo una fisura vertical en el panel, cerca del marco de la puerta»). Sin foto, "ve" vacío.
8. URGENTE: true sólo si lo que se ve o se dice es un riesgo inmediato para las personas o el producto (cable expuesto, algo que se puede caer, vidrio roto, goteo sobre producto, fuga, contaminación). Si no, false.
9. REVISAR: un consejo breve (máximo 15 palabras) de qué conviene medir o mirar en el lugar antes de seguir, o vacío si no hace falta.

Respondé SÓLO con un objeto JSON con las claves: cat, disc, desc, confianza, motivo, ubic, ve, urgente, revisar. Sin texto antes ni después.`;

/* Saca el primer objeto JSON de la respuesta del modelo, venga como objeto
   (modo JSON) o como texto (a veces con ```json … ``` alrededor). */
function extraerJSON(x) {
  if (x && typeof x === 'object') return x;
  const s = String(x || '');
  const i = s.indexOf('{'), f = s.lastIndexOf('}');
  if (i < 0 || f <= i) return null;
  try { return JSON.parse(s.slice(i, f + 1)); } catch (_) { return null; }
}
function respuestaWAI(res) {
  if (!res) return null;
  if (res.response !== undefined) return res.response;
  const c = res.choices && res.choices[0] && res.choices[0].message;
  return c ? c.content : res.result ?? null;
}

/* Llama en Workers AI. Primero con modo JSON (respuesta garantizada con
   esa forma); si el modelo no lo admite o no puede cumplirlo, se repite
   sin modo JSON y se extrae el objeto del texto. */
async function sugerirWorkersAI(env, modelo, pedido, imagenDataURL, esquema, sistema = PROMPT_IA, maxTok = 400, ms = IA_TIMEOUT_MS) {
  const contenido = imagenDataURL
    ? [{ type: 'text', text: pedido }, { type: 'image_url', image_url: { url: imagenDataURL } }]
    : pedido;
  const base = {
    messages: [{ role: 'system', content: sistema }, { role: 'user', content: contenido }],
    temperature: 0.1, max_tokens: maxTok
  };
  let ultimoError = null;
  for (const extra of [{ response_format: { type: 'json_schema', json_schema: esquema } }, {}]) {
    try {
      const res = await conTope(env.AI.run(modelo, { ...base, ...extra }), ms);
      const sug = extraerJSON(respuestaWAI(res));
      if (sug) return sug;
      ultimoError = new Error('respuesta sin JSON');
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      if (esCupo(e)) throw e;   // cupo agotado: reintentar no sirve
      ultimoError = e;
      console.error('SIMA IA workers-ai', modelo, String(e && e.message || e).slice(0, 300));
    }
  }
  throw ultimoError || new Error('sin respuesta');
}

/* Groq y Hugging Face hablan el formato de OpenAI (/chat/completions).
   Primero en modo JSON; si el proveedor lo rechaza (400), sin él. */
async function sugerirCompatOpenAI(base, token, modelo, pedido, imagenDataURL, sistema, maxTok, ms) {
  const contenido = imagenDataURL
    ? [{ type: 'text', text: pedido }, { type: 'image_url', image_url: { url: imagenDataURL } }]
    : pedido;
  const razona = /gpt-oss|qwen3/.test(modelo);
  const cuerpo = {
    model: modelo, temperature: 0.1, max_tokens: razona ? maxTok + 1200 : maxTok,
    messages: [{ role: 'system', content: sistema }, { role: 'user', content: contenido }]
  };
  const fin = Date.now() + ms;
  let ultimoError = null;
  // Los modelos que razonan (gpt-oss, qwen3) piensan poco y no devuelven el
  // razonamiento; si la API no acepta esos parámetros, se reintenta sin ellos.
  const pensar = /gpt-oss/.test(modelo) ? { reasoning_effort: 'low', include_reasoning: false } : /qwen3/.test(modelo) ? { reasoning_format: 'hidden' } : {};
  const rf = { response_format: { type: 'json_object' } };
  const intentos = razona ? [{ ...rf, ...pensar }, ...(pensar.reasoning_effort ? [{ ...rf, reasoning_effort: 'low' }] : []), rf, {}] : [rf, {}];
  for (const extra of intentos) {
    const resta = fin - Date.now();
    if (resta < 1500) break;
    const r = await fetchConTope(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ ...cuerpo, ...extra })
    }, resta);
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      const e = new Error('http ' + r.status + ' ' + txt.slice(0, 200)); e.http = r.status;
      if (r.status === 400 && Object.keys(extra).length && !/decommission|deprecat|model_not_found|does not exist/i.test(txt)) { ultimoError = e; continue; }   // probar sin modo JSON / sin parámetros de razonamiento
      throw e;
    }
    const d = await r.json().catch(() => null);
    const sug = extraerJSON(d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content);
    if (sug) return sug;
    ultimoError = new Error('respuesta sin JSON');
  }
  throw ultimoError || new Error('sin respuesta');
}

async function sugerirOllama(env, modelo, pedido, imagenB64, esquema, sistema = PROMPT_IA, ms = IA_TIMEOUT_MS) {
  const base = sinBarra(env.OLLAMA_URL);
  const r = await fetchConTope(base + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecerasIA(env, env.OLLAMA_TOKEN) },
    body: JSON.stringify({
      model: modelo, stream: false, keep_alive: '30m', format: esquema,
      options: { temperature: 0.1, num_ctx: 4096 },
      messages: [
        { role: 'system', content: sistema },
        { role: 'user', content: pedido, ...(imagenB64 ? { images: [imagenB64] } : {}) }
      ]
    })
  }, ms);
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    console.error('SIMA IA ollama', r.status, txt.slice(0, 300));
    const e = new Error('http ' + r.status); e.http = r.status; throw e;
  }
  const d = await r.json().catch(() => null);
  const sug = extraerJSON(d && d.message && d.message.content);
  if (!sug) throw new Error('respuesta sin JSON');
  return sug;
}

/* Llama al primer proveedor de la cadena y, si falla, al siguiente.
   Devuelve { sug, prov, modelo }. Si fallan todos, lanza el error más
   representativo (cupo > demora > http > otro) con e.intentos. */
async function llamarIA(env, { pedido, foto = null, esquema, sistema = PROMPT_IA, maxTok = 400, texto = false }) {
  const cadena = cadenaIA(env);
  const fin = Date.now() + IA_TIMEOUT_MS;
  const errores = [];
  for (let i = 0; i < cadena.length; i++) {
    const prov = cadena[i];
    const resta = fin - Date.now();
    if (resta < 2000) break;
    const ultimo = i === cadena.length - 1;
    const ms = ultimo ? resta : Math.min(resta, IA_TOPE_PROVEEDOR_MS);
    const modelo = modeloIA(env, prov, texto);
    let usado = modelo;
    try {
      let sug;
      if (prov === 'groq') {
        // Si Groq dio de baja el modelo (400/404 «decommissioned»/«not found»),
        // se prueban los modelos vigentes antes de pasar al siguiente proveedor.
        const lista = [modelo, ...GROQ_RESPALDOS.filter(m => m !== modelo && (!foto || m.startsWith('qwen/')))];
        let ult;
        for (const m of lista) {
          try { sug = await sugerirCompatOpenAI(GROQ_BASE, String(env.GROQ_API_KEY).trim(), m, pedido, foto, sistema, maxTok, Math.max(3000, Math.min(ms, fin - Date.now() - 2000))); ult = null; usado = m; if (m !== modelo) console.warn('SIMA IA groq: se usó', m, 'en lugar de', modelo); break; }
          catch (e) { ult = e; if (!(e && (e.http === 404 || e.http === 400) && /decommission|deprecat|not found|does not exist|model_not_found|invalid model|not support/i.test(e.message))) throw e; }
        }
        if (ult) throw ult;
      }
      else if (prov === 'huggingface') sug = await sugerirCompatOpenAI(HF_BASE, String(env.HF_TOKEN).trim(), modelo, pedido, foto, sistema, maxTok, ms);
      else if (prov === 'workers-ai') sug = await sugerirWorkersAI(env, modelo, pedido, foto, esquema, sistema, maxTok, ms);
      else sug = await sugerirOllama(env, modelo, pedido, foto ? foto.slice(foto.indexOf(',') + 1) : null, esquema, sistema, ms);
      return { sug, prov, modelo: usado, respaldo: i > 0 };
    } catch (e) {
      console.error('SIMA IA', prov, String(e && e.message || e).slice(0, 300));
      errores.push({ prov, e });
    }
  }
  const tipoErr = e => esCupo(e) ? 3 : (e && e.name === 'AbortError') ? 2 : (e && e.http) ? 1 : 0;
  const peor = errores.slice().sort((a, b) => tipoErr(b.e) - tipoErr(a.e))[0];
  const e = (peor && peor.e) || new Error('sin proveedor');
  e.intentos = errores.map(x => x.prov);
  throw e;
}
const PROV_TXT = { groq: 'Groq', huggingface: 'Hugging Face', 'workers-ai': 'Workers AI', ollama: 'Ollama', 'whisper-url': 'Whisper propio' };

async function manejarIA(context, ruta, u) {
  const { request, env } = context;

  if (ruta === 'ia/estado' && request.method === 'GET') {
    const est = await estadoIA(env);
    return ok({ ...est, plantas: plantasIA(env).filter(p => u.plantas.includes(p)) });
  }

  // Sugerir al cargar hallazgos es sólo del Inspector. Dictar y preguntarle
  // a SIMI lo puede cualquier rol: no modifican datos.
  if (ruta === 'ia/sugerir' && u.rol !== 'inspeccion') return err('El asistente de IA es para el Inspector, al cargar hallazgos.', 403);
  if (request.method !== 'POST') return err('Método no permitido.', 405);
  const prov = proveedorIA(env);
  if (!prov) return err('El asistente de IA no está configurado.', 503);
  const cuerpo = await request.json().catch(() => null);
  if (!cuerpo || typeof cuerpo !== 'object') return err('Cuerpo inválido.');
  const planta = PLANTAS_VALIDAS.includes(cuerpo.planta) ? cuerpo.planta : 'planta2';
  if (!u.plantas.includes(planta) || !plantasIA(env).includes(planta))
    return err('El asistente de IA no está habilitado para esta planta.', 403);

  /* --- Sugerir tipo, disciplina, descripción y ubicación --- */
  if (ruta === 'ia/sugerir') {

    // Tipos permitidos: los manda la app (son los de su versión) y acá se acotan.
    const cats = Object.entries(cuerpo.cats && typeof cuerpo.cats === 'object' ? cuerpo.cats : {})
      .filter(([k, v]) => /^[a-z_]{1,30}$/.test(k) && typeof v === 'string').slice(0, 40)
      .map(([k, v]) => [k, corto(v, 60)]);
    if (!cats.length) return err('Faltan los tipos de hallazgo.');
    const claves = cats.map(c => c[0]);

    const texto = corto(cuerpo.texto, 2000).trim();
    let foto = null, imagenB64 = null;
    if (typeof cuerpo.foto === 'string' && cuerpo.foto) {
      const m = cuerpo.foto.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
      if (!m) return err('Formato de foto no admitido para la IA (JPG, PNG o WEBP).', 415);
      if (m[2].length > 3500000) return err('La foto es demasiado grande para la IA.', 413);
      foto = cuerpo.foto; imagenB64 = m[2];
    }
    if (!foto && !texto) return err('Sacá la foto o escribí/dictá una descripción para pedir una sugerencia.');

    const ubic = corto(cuerpo.ubic, 200);
    // Ubicaciones de la planta (sólo si el Inspector no eligió una y hay
    // texto): la IA puede reconocer el sector que se nombró al dictar.
    const ubics = !ubic && texto && Array.isArray(cuerpo.ubics)
      ? cuerpo.ubics.filter(x => typeof x === 'string' && x.trim()).slice(0, 300).map(x => corto(x, 90).trim())
      : [];
    const pedido = [
      'Tipos permitidos (clave: nombre):', ...cats.map(([k, v]) => `- ${k}: ${v}`),
      ubic ? `Ubicación elegida por el Inspector: ${ubic}` : '',
      ubics.length ? 'Ubicaciones de la planta (número: área › sector › subsector):\n' + ubics.map((x, i) => `${i + 1}: ${x}`).join('\n') : 'No hay lista de ubicaciones: devolvé ubic = 0.',
      texto ? `Lo que dijo/escribió el Inspector: """${texto}"""` : 'El Inspector no escribió nada: describí lo que se ve en la foto.',
      foto ? '' : 'No hay foto: basate sólo en el texto.'
    ].filter(Boolean).join('\n');

    const esquema = {
      type: 'object',
      properties: {
        cat: { type: 'string', enum: claves },
        disc: { type: 'string', enum: DISC_OK },
        desc: { type: 'string' },
        confianza: { type: 'number' },
        motivo: { type: 'string' },
        ubic: { type: 'integer' },
        ve: { type: 'string' },
        urgente: { type: 'boolean' },
        revisar: { type: 'string' }
      },
      required: ['cat', 'disc', 'desc', 'confianza', 'motivo', 'ubic', 've', 'urgente', 'revisar']
    };

    const t0 = Date.now();
    let sug, quien;
    try {
      quien = await llamarIA(env, { pedido, foto, esquema, maxTok: 600 });
      sug = quien.sug;
    } catch (e) {
      cacheEstadoIA = null;
      if (esCupo(e)) return err('Se agotó el cupo diario de IA. Cargá el hallazgo normalmente; mañana vuelve.', 503);
      if (e && e.name === 'AbortError') return err('La IA tardó demasiado. Cargá el hallazgo normalmente.', 503);
      if (e && e.http) return err('El servicio de IA respondió con un error (' + e.http + ').', 502);
      return err('La IA no pudo analizar este hallazgo.', 502);
    }
    if (!sug || typeof sug !== 'object') return err('La IA devolvió una respuesta que no se pudo leer.', 502);

    const cat = claves.includes(sug.cat) ? sug.cat : (claves.includes('otro') ? 'otro' : claves[0]);
    const disc = DISC_OK.includes(sug.disc) ? sug.disc : 'otro';
    const conf = Math.max(0, Math.min(1, +sug.confianza || 0));
    const nu = Math.round(+sug.ubic || 0);
    const ubicIdx = ubics.length && nu >= 1 && nu <= ubics.length ? nu - 1 : -1;
    const ms = Date.now() - t0;
    await auditar(env, u, 'ia-sugerir', `${PROV_TXT[quien.prov]} ${quien.modelo} · ${cat}/${disc}${ubicIdx >= 0 ? ' · ubic' : ''} · conf ${conf.toFixed(2)} · ${ms} ms`);
    return ok({
      sug: { cat, disc, desc: corto(sug.desc, 600).trim(), conf, motivo: corto(sug.motivo, 200).trim(), ubic: ubicIdx,
        ve: foto ? corto(sug.ve, 220).trim() : '', urgente: sug.urgente === true || sug.urgente === 'true', revisar: corto(sug.revisar, 140).trim() },
      modelo: quien.modelo, proveedor: quien.prov, ms
    });
  }

  /* --- SIMI conversacional: ayuda de uso con la guía de SIMA -----------
     La app manda la pregunta, los últimos mensajes y los artículos de la
     guía (public/sima-ayuda.js) que mejor coinciden. Llama responde SÓLO
     con eso. Si la pregunta es de números (cuántos, qué área tiene más…),
     no responde cifras: devuelve la consulta para que SIMA la calcule con
     sus datos. No ve hallazgos ni puede modificar nada. */
  if (ruta === 'ia/chat') {
    const pregunta = corto(cuerpo.pregunta, 400).trim();
    if (!pregunta) return err('Falta la pregunta.');
    const historial = (Array.isArray(cuerpo.historial) ? cuerpo.historial : []).slice(-6)
      .filter(m => m && ['usuario', 'simi'].includes(m.rol) && typeof m.texto === 'string')
      .map(m => `${m.rol === 'usuario' ? 'Usuario' : 'SIMI'}: ${corto(m.texto, 500)}`);
    const arts = (Array.isArray(cuerpo.articulos) ? cuerpo.articulos : []).slice(0, 5)
      .filter(a => a && /^[a-z0-9-]{1,40}$/.test(a.id) && typeof a.texto === 'string')
      .map(a => ({ id: a.id, texto: corto(a.texto, 1600) }));
    // Índice de la guía (sólo id y título): así el modelo sabe qué existe sin
    // anclarse en pasos de artículos que no tienen que ver con la pregunta.
    const indice = (Array.isArray(cuerpo.indice) ? cuerpo.indice : []).slice(0, 60)
      .filter(a => a && /^[a-z0-9-]{1,40}$/.test(a.id) && typeof a.t === 'string')
      .map(a => ({ id: a.id, t: corto(a.t, 90) }));
    const ids = [...new Set([...arts.map(a => a.id), ...indice.map(a => a.id)])];
    const nombre = corto(cuerpo.nombre, 40).trim();
    // Fichas de reparación de SIMA (public/sima-reparar.js) que coinciden con la pregunta.
    const fichas = (Array.isArray(cuerpo.fichas) ? cuerpo.fichas : []).slice(0, 2)
      .filter(a => a && /^[a-z0-9-]{1,40}$/.test(a.id) && typeof a.texto === 'string')
      .map(a => ({ id: a.id, texto: corto(a.texto, 1800) }));
    const ROLES_TXT = { inspeccion: 'Inspector', mantenimiento: 'técnico de Mantenimiento', calidad: 'Control de Calidad', vista: 'consulta (sólo lectura)' };
    const lista = o => Object.entries(o && typeof o === 'object' ? o : {})
      .filter(([k, v]) => /^[a-z_0-9]{1,30}$/.test(k) && typeof v === 'string').slice(0, 40).map(([k, v]) => [k, corto(v, 60)]);
    const cats = lista(cuerpo.cats), areas = lista(cuerpo.areas);
    const esquema = {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['charla', 'ayuda', 'datos', 'reparacion', 'tecnica', 'fuera'] },
        texto: { type: 'string' },
        pasos: { type: 'array', items: { type: 'string' } },
        causas: { type: 'array', items: { type: 'string' } },
        cuidados: { type: 'array', items: { type: 'string' } },
        articulos: { type: 'array', items: { type: 'string', enum: ids.length ? ids : ['ninguno'] } },
        intent: { type: 'string', enum: ['cuantos', 'ranking', 'antiguos', 'por_estado', 'resumen', 'ninguno'] },
        dim: { type: 'string', enum: ['area', 'tipo', 'sector', 'disciplina', 'estado', 'tecnico', 'ninguna'] },
        estado: { type: 'string', enum: ['abiertos', 'cerrados', 'detectado', 'programado', 'en_ejecucion', 'pendiente_verificacion', 'a_validar', 'todos'] },
        area: { type: 'string', enum: ['ninguna', ...areas.map(a => a[0])] },
        tipo_hallazgo: { type: 'string', enum: ['ninguno', ...cats.map(c => c[0])] },
        periodo: { type: 'string', enum: ['hoy', 'semana', 'mes', 'anio', 'todo'] },
        sector: { type: 'string' },
        titulo: { type: 'string' }
      },
      required: ['tipo', 'titulo', 'texto', 'pasos', 'causas', 'cuidados', 'articulos', 'intent', 'dim', 'estado', 'area', 'tipo_hallazgo', 'periodo', 'sector']
    };
    const sistema = `Sos SIMI, el asistente de SIMA, la app de inspección, mantenimiento y control de calidad de una planta frigorífica (faena y procesamiento de carne). Sos cálido, claro y práctico; hablás en español con voseo («tocá», «elegí») y tuteás con confianza, sin exagerar.
El usuario es ${ROLES_TXT[u.rol] || 'usuario'}${nombre ? ` y se llama ${nombre}` : ''}${cuerpo.vista ? `; está en la pantalla «${corto(cuerpo.vista, 40)}»` : ''}.
SIMA tiene tres módulos: 1 «Ruta de inspección» (recorridos, hallazgos, mantenimiento y control de calidad), 2 «Seguimiento de equipos» con NFC (placas NFC/QR en equipos críticos que abren su ficha, historial y controles; leer NFC desde la web sólo funciona en Android con Chrome) y 3 «Monitoreo Industrial 5.0» (IoT + IA: cámaras de frío, túneles de congelamiento, energía, agua y vapor en tiempo real, con alarmas por niveles y análisis de SIMI). ${({ ruta: 'El usuario está en el módulo 1.', nfc: 'El usuario está en el módulo 2 (NFC).', iot: 'El usuario está en el módulo 3 (Monitoreo Industrial 5.0).' })[cuerpo.modulo] || ''}
Sobre sensores, temperaturas, consumos o estados de equipos usá SÓLO las «LECTURAS DEL MÓDULO 3» de abajo, tal cual; si no vienen, decí que el módulo todavía no está conectado. Nunca inventes valores.${cuerpo.iot ? `\nLECTURAS DEL MÓDULO 3 (en este momento): ${corto(cuerpo.iot, 2200)}` : ''}

Primero clasificá el mensaje en UN tipo y respondé según su regla:

A) tipo="charla" · saludos, cómo estás, quién sos, agradecimientos, despedidas, chistes o comentarios sueltos.
   "texto": 1 o 2 oraciones naturales y amables; no repitas lo que sabés hacer ni enumeres temas (la app ya lo muestra); como mucho, una pregunta corta para seguir. Sin listas.

B) tipo="reparacion" · cualquier falla, avería, desperfecto o problema físico de la planta y cómo resolverlo, diagnosticarlo o evitar que se repita: goteras, filtraciones, puertas que se caen o no cierran, pisos rotos o con agua, fisuras, siliconas o juntas despegadas, luminarias, tomas y cables, lavamanos, esterilizadores, soldaduras, zócalos, cámaras que pierden frío, hielo, condensación, óxido, ruidos o vibraciones de equipos, etc.
   · RESPONDÉ EXACTAMENTE LO QUE SE PREGUNTA. El SÍNTOMA concreto (óxido, ruido, fisura, agua, hielo, olor, no calienta…) manda sobre el OBJETO (puerta, pared, piso…). Ejemplo: «¿cómo resuelvo la oxidación de una puerta?» → todo sobre óxido/corrosión en la puerta (quitar óxido, convertidor o primer anticorrosivo, pintura epoxi apta alimentaria, inoxidable, causas como humedad o químicos de limpieza), y NADA sobre puertas que se descuelgan o bisagras flojas. Si una ficha trata otro síntoma del mismo objeto, ignorala.
   · "titulo": el problema exacto en pocas palabras, con el objeto y el síntoma que dijo el usuario («Óxido en la puerta de la cámara»).
   · "texto": 1 o 2 oraciones con el diagnóstico más probable para ESE caso (usá lo que dijo el usuario: lugar, síntoma, frecuencia).
   · "causas": causas probables (2 a 4), pensando en por qué vuelve a pasar.
   · "pasos": pasos prácticos en orden (4 a 7, cada uno corto y accionable).
   · "cuidados": seguridad e inocuidad (2 a 4): permiso de trabajo, bloqueo eléctrico (LOTO), trabajo en altura, proteger el producto, materiales aptos para la industria alimentaria, limpieza y liberación de Calidad.
   · Si hay FICHAS DE REPARACIÓN que traten ESE síntoma, basate en ellas y adaptalas al caso. Si ninguna trata exactamente ese síntoma, respondé con buenas prácticas de mantenimiento industrial alimentario para ese problema puntual.
   · No inventes normas, marcas, medidas ni cantidades. Lo eléctrico lo hace sólo personal habilitado. Si puede ser estructural o de un equipo crítico (frío, calderas, presión), recomendá evaluación de un especialista.
   · Si el problema se repite, mencioná atacar la causa raíz y registrarlo en SIMA.

C) tipo="datos" · preguntas de NÚMEROS de hallazgos/no conformidades: cuántos hay, cuáles, qué área/tipo/sector/disciplina/técnico tiene más, los más antiguos, cómo están por estado, un resumen. NO des cifras: "texto" vacío y completá intent, dim, estado, area, tipo_hallazgo, periodo y sector (el nombre del sector tal como lo dijo el usuario, o vacío).

D) tipo="ayuda" · cómo USAR SIMA (cómo hacer algo en la app, qué significa un estado o un término, dónde está algo).
   · Respondé SÓLO con la GUÍA y el ÍNDICE de abajo. "texto": 1 a 3 oraciones (máximo 70 palabras). Nombrá botones y pantallas exactamente como en la guía, entre «».
   · "pasos": los pasos en orden si es un procedimiento (máximo 7); si no, lista vacía.
   · "articulos": los ids que usaste o que el usuario debería leer (del texto o del índice).
   · Si lo hace otro rol, decilo («Esto lo hace el Inspector»). Si la guía no lo cubre, decilo con honestidad. Nunca inventes botones, pantallas ni pasos.

F) tipo="tecnica" · consultas TÉCNICAS o de GESTIÓN de la planta que no son una falla puntual: indicadores (KPI) y mejora de agua, vapor, calderas, condensado, energía eléctrica, frío/amoníaco, aire comprimido, efluentes; consumos y eficiencia; mantenimiento preventivo/predictivo, MTBF, MTTR, disponibilidad, OEE, cumplimiento del plan, backlog, costos; buenas prácticas de ingeniería, inocuidad o seguridad; cómo armar un plan de mejora.
   · Respondé como un ingeniero de mantenimiento con experiencia en frigoríficos: concreto y útil.
   · "titulo": el tema en pocas palabras («KPI de agua y vapor»).
   · "texto": 1 o 2 oraciones con el enfoque principal.
   · "causas": usalo para los INDICADORES o conceptos clave (3 a 6), cada uno con su fórmula o cómo se mide si aplica («Agua por animal faenado = m³ de agua / cabezas faenadas»).
   · "pasos": acciones de mejora concretas y en orden de impacto (4 a 7).
   · "cuidados": cómo hacer el seguimiento (2 a 4): frecuencia de medición, medidores o registros, a quién reportar.
   · No inventes valores de referencia, metas ni datos de ESTA planta; si das un rango típico, aclará que es orientativo y que hay que medir la línea base propia. SIMA registra hallazgos, no consumos: si preguntan por consumos reales, decí que esos datos no están en SIMA.

E) tipo="fuera" · SÓLO temas personales o ajenos a la planta y a SIMA (amor, pareja, citas, fútbol, clima, comida, política…). Cualquier cosa sobre la planta, mantenimiento, ingeniería, servicios (agua, vapor, energía, frío), producción, calidad, inocuidad, seguridad o gestión NUNCA es "fuera".
   · "texto": 2 o 3 oraciones con HUMOR INTELIGENTE y respetuoso: una analogía ingeniosa con el mundo de la planta o del mantenimiento (por ejemplo, «una relación es como un burlete: si no se revisa seguido, se escapa el frío»; «el fútbol es como una ruta de inspección: el que no recorre la cancha no encuentra nada»). NO cierres listando lo que podés hacer ni ofreciendo ayuda: la app agrega sola una frase corta para volver al trabajo.
   · Variá la analogía según la pregunta; nada ofensivo, sexual, político ni que se burle de personas o grupos. No des consejos serios sobre esos temas.
   · Si la persona expresa angustia real, tristeza profunda o un riesgo para sí o para otros, NO hagas chistes: respondé con seriedad y empatía, y sugerí hablar con alguien de confianza o con un servicio de emergencias.

Ejemplos de clasificación: «¿cómo resuelvo la oxidación de una puerta?» → reparacion (sobre óxido) · «¿qué hago si mi novia no me habla?» → fuera (con humor) · «hola, buen día» → charla · «gracias crack» → charla · «la puerta de la antecámara se cae siempre» → reparacion · «hay agua en el piso del desosado» → reparacion · «¿qué hago para que la silicona no se despegue?» → reparacion · «¿cuántas puertas hay abiertas?» → datos · «¿qué técnico tiene más trabajos?» → datos (dim=tecnico) · «¿cómo programo un trabajo?» → ayuda · «¿cómo mejoro los KPI de agua y vapor?» → tecnica · «¿qué indicadores de mantenimiento conviene medir?» → tecnica · «¿cómo bajo el consumo de energía de las cámaras?» → tecnica · «¿qué es un hallazgo arrastrado?» → ayuda.
Tené en cuenta la conversación reciente: si el usuario sigue el tema anterior («¿y si no tengo silicona sanitaria?»), respondé en ese contexto.
No podés ejecutar acciones ni cambiar datos, y NO tenés acceso a personas, contactos, teléfonos, correos ni mensajería: NUNCA ofrezcas «pasar el contacto», «avisar», «pedirle a alguien», «enviar» o «agendar», ni digas que lo hiciste. Si conviene involucrar a alguien, nombrá el ROL a consultar (jefe de mantenimiento, responsable de servicios, Calidad) sin ofrecerte a hacerlo. Nunca derives una consulta técnica sin antes responderla. En los campos que no apliquen usá "ninguno"/"ninguna"/"todos"/"todo" o listas vacías.
Áreas: ${areas.map(a => `${a[0]}=${a[1]}`).join(', ')}.
Tipos de hallazgo (fallas) que registra SIMA: ${cats.map(c => `${c[0]}=${c[1]}`).join(', ')}.

GUÍA (artículos relacionados con la pregunta):
${arts.length ? arts.map(a => `[${a.id}]\n${a.texto}`).join('\n\n') : '(ningún artículo coincide con la pregunta)'}
${indice.length ? '\nÍNDICE DE LA GUÍA (id: título):\n' + indice.map(a => `${a.id}: ${a.t}`).join('\n') + '\n' : ''}${fichas.length ? '\nFICHAS DE REPARACIÓN:\n' + fichas.map(a => `[${a.id}]\n${a.texto}`).join('\n\n') + '\n' : ''}
Respondé SÓLO el objeto JSON.`;
    const pedido = `${historial.length ? 'Conversación reciente:\n' + historial.join('\n') + '\n\n' : ''}Pregunta actual: «${pregunta}»`;
    const t0 = Date.now();
    let c, quien;
    try {
      quien = await llamarIA(env, { pedido, esquema, sistema, maxTok: 1100, texto: true });
      c = quien.sug;
    } catch (e) {
      if (esCupo(e)) return err('Se agotó el cupo diario de IA.', 503);
      if (e && e.name === 'AbortError') return err('La IA tardó demasiado.', 503);
      return err('La IA no pudo responder.', 502);
    }
    const PLANTA = /\b(kpi|indicador|agua|vapor|caldera|condensad|energ|electric|consumo|eficien|frio|amoniaco|compresor|aire comprimido|efluente|mantenimiento|preventiv|predictiv|mtbf|mttr|oee|disponibilidad|backlog|planta|faena|camara|tunel|calidad|inocuidad|haccp|bpm|seguridad|costo|presupuesto|plan de mejora|auditoria)/;
    const sinTilde = x => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (c && c.tipo === 'fuera' && PLANTA.test(sinTilde(pregunta))) {
      try {
        const otra = await llamarIA(env, { pedido: pedido + '\n\n(Atención: esta pregunta ES sobre la planta o su gestión. NO es "fuera". Clasificala como tecnica, reparacion, datos o ayuda y respondela.)', esquema, sistema, maxTok: 1100, texto: true });
        if (otra && otra.sug && otra.sug.tipo !== 'fuera') { c = otra.sug; quien = otra; }
      } catch (_) {}
    }
    const modelo = quien.modelo;
    const en = (v, l, def) => l.includes(v) ? v : def;
    let tipo = en(c && c.tipo, ['charla', 'ayuda', 'datos', 'reparacion', 'tecnica', 'fuera'], 'ayuda');
    const lst = (x, n) => (Array.isArray(x) ? x : []).filter(p => typeof p === 'string' && p.trim()).slice(0, n).map(p => corto(p, 240).trim());
    const r = {
      tipo,
      texto: corto(c && c.texto, 900).trim(),
      titulo: (tipo === 'reparacion' || tipo === 'tecnica') ? corto(c && c.titulo, 90).trim() : '',
      pasos: lst(c && c.pasos, 8),
      ...(tipo === 'reparacion' ? { causas: lst(c && c.causas, 5), cuidados: lst(c && c.cuidados, 5), fichas: fichas.map(f => f.id) } : {}),
      ...(tipo === 'tecnica' ? { causas: lst(c && c.causas, 6), cuidados: lst(c && c.cuidados, 4) } : {}),
      articulos: [...new Set((Array.isArray(c && c.articulos) ? c.articulos : []).filter(id => ids.includes(id)))].slice(0, 3)
    };
    if (tipo === 'datos') {
      r.consulta = {
        intent: en(c.intent, ['cuantos', 'ranking', 'antiguos', 'por_estado', 'resumen'], 'cuantos'),
        dim: en(c.dim, ['area', 'tipo', 'sector', 'disciplina', 'estado', 'tecnico'], ''),
        estado: en(c.estado, ['abiertos', 'cerrados', 'detectado', 'programado', 'en_ejecucion', 'pendiente_verificacion', 'a_validar'], ''),
        area: en(c.area, areas.map(a => a[0]), ''), tipo: en(c.tipo_hallazgo, cats.map(x => x[0]), ''),
        periodo: en(c.periodo, ['hoy', 'semana', 'mes', 'anio'], ''),
        sector: corto(c.sector, 160).trim()
      };
    }
    // SIMI no puede contactar a nadie: se quitan las oraciones que ofrecen o
    // afirman acciones que no existen («te paso el contacto», «ya le avisé»).
    const FALSA = /(pas(o|ar|arte|e) (el|tu|su|los) contacto|te paso (el|su)|le (ped[ií]|avis[eé]|escrib[ií]|mand[eé]|envi[eé])|ya (le )?(avis|envi|mand|contact|ped|agend)|te va(n)? a (contactar|llamar|escribir)|quer[eé]s que (te )?(pase|avise|contacte|mande|env[ií]e)|(quiere|queres|querés) que te pase)/i;
    const limpiar = x => x.split(/(?<=[.!?])\s+/).filter(o => !FALSA.test(o)).join(' ').trim();
    if (FALSA.test(r.texto)) {
      r.texto = limpiar(r.texto);
      if (!r.texto) r.texto = 'No puedo contactar ni avisarle a nadie desde SIMA. Si querés, contame qué necesitás y lo vemos acá.';
    }
    r.pasos = r.pasos.filter(p => !FALSA.test(p));
    if (tipo === 'charla' && !r.texto) r.texto = '¡Hola! Soy SIMI. ¿En qué te doy una mano: SIMA, tus números o una falla de la planta?';
    if (tipo !== 'datos' && !r.texto && !r.pasos.length) r.texto = 'No lo tengo en la guía de SIMA. Consultá con el administrador del sistema.';
    await auditar(env, u, 'ia-chat', `${PROV_TXT[quien.prov]} ${modelo} · ${tipo}${r.articulos.length ? ' · ' + r.articulos.join(',') : ''} · ${Date.now() - t0} ms`);
    return ok({ r, modelo, proveedor: quien.prov });
  }

  /* --- SIMI: interpretar una pregunta en lenguaje natural ---------------
     El modelo NO ve datos ni devuelve números: sólo traduce la pregunta a
     una consulta estructurada (intención + filtros) con valores de listas
     cerradas. Los números los calcula la app con sus propios datos, así
     que no hay cifras inventadas y respeta lo que cada rol puede ver. */
  if (ruta === 'ia/consulta') {
    const pregunta = corto(cuerpo.pregunta, 300).trim();
    if (!pregunta) return err('Falta la pregunta.');
    const lista = o => Object.entries(o && typeof o === 'object' ? o : {})
      .filter(([k, v]) => /^[a-z_0-9]{1,30}$/.test(k) && typeof v === 'string').slice(0, 40).map(([k, v]) => [k, corto(v, 60)]);
    const cats = lista(cuerpo.cats), areas = lista(cuerpo.areas);
    const INT = ['resumen', 'cuantos', 'ranking', 'antiguos', 'por_estado', 'ayuda', 'desconocido'];
    const DIM = ['area', 'tipo', 'sector', 'disciplina', 'estado', 'ninguna'];
    const EST = ['abiertos', 'cerrados', 'detectado', 'programado', 'en_ejecucion', 'pendiente_verificacion', 'a_validar', 'todos'];
    const PER = ['hoy', 'ayer', 'semana', 'mes', 'mes_pasado', 'anio', 'todo'];
    const esquema = {
      type: 'object',
      properties: {
        intent: { type: 'string', enum: INT },
        dim: { type: 'string', enum: DIM },
        estado: { type: 'string', enum: EST },
        area: { type: 'string', enum: ['ninguna', ...areas.map(a => a[0])] },
        tipo: { type: 'string', enum: ['ninguno', ...cats.map(c => c[0])] },
        disc: { type: 'string', enum: ['ninguna', ...DISC_OK] },
        periodo: { type: 'string', enum: PER }
      },
      required: ['intent', 'dim', 'estado', 'area', 'tipo', 'disc', 'periodo']
    };
    const sistema = `Traducís preguntas sobre hallazgos de inspección de un frigorífico a una consulta JSON. No respondas la pregunta: sólo clasificala.
intent: resumen (cómo vamos, panorama), cuantos (cantidad/total), ranking (qué área/tipo/sector/disciplina tiene más), antiguos (los más viejos o demorados sin cerrar), por_estado (cómo se reparten por estado), ayuda (qué podés hacer), desconocido (no tiene que ver con los hallazgos).
dim: la dimensión del ranking o del desglose; "ninguna" si no aplica.
estado: abiertos = todo lo no cerrado; a_validar = cerrados pendientes de Calidad; todos si no se dice.
periodo: según la fecha de detección; todo si no se dice.
Áreas: ${areas.map(a => `${a[0]}=${a[1]}`).join(', ')}.
Tipos: ${cats.map(c => `${c[0]}=${c[1]}`).join(', ')}.
Disciplinas: civil, electrico, mecanico, otro.
Respondé SÓLO el objeto JSON.`;
    const t0 = Date.now();
    const pedido = `Pregunta: «${pregunta}»`;
    let c, modelo;
    try {
      const q = await llamarIA(env, { pedido, esquema, sistema, texto: true });
      c = q.sug; modelo = q.modelo;
    } catch (e) {
      if (esCupo(e)) return err('Se agotó el cupo diario de IA.', 503);
      if (e && e.name === 'AbortError') return err('La IA tardó demasiado.', 503);
      return err('La IA no pudo interpretar la pregunta.', 502);
    }
    const en = (v, l, def) => l.includes(v) ? v : def;
    const r = {
      intent: en(c && c.intent, INT, 'desconocido'), dim: en(c && c.dim, DIM, 'ninguna'),
      estado: en(c && c.estado, EST, 'todos'), periodo: en(c && c.periodo, PER, 'todo'),
      area: en(c && c.area, areas.map(a => a[0]), ''), tipo: en(c && c.tipo, cats.map(x => x[0]), ''),
      disc: en(c && c.disc, DISC_OK, '')
    };
    await auditar(env, u, 'ia-consulta', `${r.intent}/${r.dim} · ${Date.now() - t0} ms`);
    return ok({ c: r, modelo });
  }

  /* --- Transcribir audio (Whisper) --- */
  if (ruta === 'ia/transcribir') {
    const m = typeof cuerpo.audio === 'string' && cuerpo.audio.match(/^data:(audio\/(?:webm|ogg|mp4|mpeg|wav|x-wav|aac))(?:;codecs=[^;,]+)?;base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return err('Formato de audio no admitido.', 415);
    if (m[2].length > 8000000) return err('El audio es demasiado largo (máximo ~2 minutos).', 413);

    let bin;
    try { bin = atob(m[2]); } catch (_) { return err('El audio llegó dañado.'); }
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    const ext = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/aac': 'aac' }[m[1]] || 'wav';
    const formulario = modelo => {
      const fd = new FormData();
      fd.append('file', new Blob([buf], { type: m[1] }), 'dictado.' + ext);
      fd.append('model', modelo);
      fd.append('language', 'es');
      fd.append('prompt', WHISPER_CONTEXTO);
      fd.append('response_format', 'json');
      fd.append('temperature', '0');
      return fd;
    };
    const voces = cadenaVoz(env);
    if (!voces.length) return err('La transcripción de voz no está configurada.', 503);
    const fin = Date.now() + IA_TIMEOUT_MS;
    let texto = null, usado = '', ultimo = null;
    for (let i = 0; i < voces.length && texto === null; i++) {
      const v = voces[i];
      const resta = fin - Date.now();
      if (resta < 2000) break;
      const ms = i === voces.length - 1 ? resta : Math.min(resta, IA_TOPE_PROVEEDOR_MS);
      try {
        if (v === 'workers-ai') {
          const res = await conTope(env.AI.run(env.WHISPER_MODELO || WAI_WHISPER_DEF, {
            audio: m[2], task: 'transcribe', language: 'es', vad_filter: true,
            initial_prompt: WHISPER_CONTEXTO, condition_on_previous_text: false
          }), ms);
          texto = corto(res && (res.text ?? res.result?.text), 4000).trim();
        } else {
          const groq = v === 'groq';
          const url = groq ? GROQ_BASE + '/audio/transcriptions' : sinBarra(env.WHISPER_URL) + '/v1/audio/transcriptions';
          const h = groq ? { Authorization: 'Bearer ' + String(env.GROQ_API_KEY).trim() } : cabecerasIA(env, env.WHISPER_TOKEN || env.OLLAMA_TOKEN);
          const r = await fetchConTope(url, { method: 'POST', headers: h, body: formulario(groq ? (env.GROQ_WHISPER || GROQ_WHISPER_DEF) : (env.WHISPER_MODELO || WHISPER_MODELO_DEF)) }, ms);
          if (!r.ok) { const e = new Error('http ' + r.status); e.http = r.status; throw e; }
          const d = await r.json().catch(() => null);
          if (!d || typeof d.text !== 'string') throw new Error('respuesta sin texto');
          texto = corto(d.text, 4000).trim();
        }
        usado = v;
      } catch (e) {
        ultimo = e;
        console.error('SIMA IA voz', v, String(e && e.message || e).slice(0, 300));
      }
    }
    if (texto === null) {
      if (esCupo(ultimo)) return err('Se agotó el cupo de transcripción por hoy. Escribí la descripción.', 503);
      return err(ultimo && ultimo.name === 'AbortError' ? 'La transcripción tardó demasiado.' : 'No se pudo transcribir el audio.', 502);
    }
    await auditar(env, u, 'ia-transcribir', `${PROV_TXT[usado]} · ${texto.length} caracteres`);
    return ok({ texto });
  }

  return err('Ruta de IA no encontrada: /api/' + ruta, 404);
}
