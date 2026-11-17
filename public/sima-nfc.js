/* =====================================================================
   SIMA · Módulo 2 · Seguimiento de equipos (NFC)
   ---------------------------------------------------------------------
   Con los datos de demostración activos (window.SIMA_DEMO, el mismo
   interruptor que el módulo 3) el módulo muestra 6 equipos de envasado y
   expedición con:
     · modelo 3D (sima-equipos3d.js) en la lista y en el detalle;
     · placa NFC (UID), ubicación, horómetro y criticidad;
     · plan de mantenimiento por horas, por días y verificaciones por turno;
     · histórico desde el 1/10/26: preventivos, correctivos, controles
       diarios por NFC y verificaciones de PCC (detector y rayos X);
     · KPIs: disponibilidad, MTBF, MTTR y cumplimiento del plan;
     · alertas de SIMI con acciones (p. ej. filtro de la vaciadora del 14/11:
       «¿ya tenemos filtros para programar el cambio?»).
   Todo es determinístico (mismos datos en cualquier equipo); lo que hace
   el usuario (programar, realizar, controles, lecturas) se guarda en
   localStorage 'sima.nfc.estado'.
   Sin datos de demostración, se usa la pantalla original de sima-modulos.js.
   ===================================================================== */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const e = s => (typeof esc === 'function' ? esc(s) : String(s == null ? '' : s));
  const MIN = 60e3, H = 3600e3, DIA = 864e5;
  const p2 = n => String(n).padStart(2, '0');
  const F = s => { const [d, h] = s.split(' '); const [y, m, dd] = d.split('-').map(Number); const [hh, mm] = (h || '08:00').split(':').map(Number); return new Date(y, m - 1, dd, hh, mm).getTime(); };
  const INICIO = F('2026-10-01 00:00');
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const fecha = t => { const d = new Date(t); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}${d.getFullYear() !== new Date().getFullYear() ? '/' + String(d.getFullYear()).slice(2) : ''}`; };
  const fechaL = t => { const d = new Date(t); return `${DIAS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; };
  const hora = t => { const d = new Date(t); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  const inicioDia = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const nf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const rnd = k => { let t = hash(k) + 0x6D2B79F5 | 0; t = Math.imul(t ^ t >>> 15, 1 | t); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ls = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} } };
  const demoOn = () => !!(window.SIMA_DEMO && SIMA_DEMO.on());
  const quien = () => { try { return (ROLES[role] && ROLES[role].name) || 'Inspector'; } catch (_) { return 'Inspector'; } };

  /* ---------- Equipos ------------------------------------------------- */
  const EQ = [
    { id: 'VAC-01', tipo: 'vaciadora', n: 'Vaciadora', sub: 'Envasadora al vacío de doble campana', ubic: 'Sala de envasado · Línea 1', tag: '04:7A:3C:B2:51:6E:80', hd: 15, h0: 9132, crit: 'Alta',
      ficha: [['Capacidad', '4 ciclos por minuto por campana'], ['Bomba de vacío', '300 m³/h, lubricada por aceite'], ['Vacío final', '2 mbar'], ['Sellado', '2 barras de 1.000 mm por campana'], ['Potencia', '7,5 kW · 380 V'], ['En servicio desde', '2021']],
      checks: ['Nivel de aceite de la bomba en el visor', 'Vacío alcanzado de 5 mbar o menos', 'Sello parejo y sin arrugas en bolsa de prueba', 'Juntas de las campanas sin cortes'],
      plan: [
        { id: 'filtro', t: 'Cambio de filtro de escape de la bomba de vacío', tipo: 'h', cada: 500, ancla: F('2026-11-14 10:00'), quien: 'Técnico mecánico', rep: { cod: 'FIL-VAC-500', n: 'filtros de escape (separadores de niebla de aceite)', cant: 2, demora: '3 a 5 días' } },
        { id: 'aceite', t: 'Cambio de aceite de la bomba de vacío', tipo: 'h', cada: 1000, ancla: F('2026-11-21 09:00'), quien: 'Técnico mecánico' },
        { id: 'teflon', t: 'Cambio de teflón de las barras de sellado', tipo: 'd', cada: 7, ancla: F('2026-10-06 07:00'), quien: 'Técnico mecánico' },
        { id: 'juntas', t: 'Revisión de juntas de las campanas', tipo: 'd', cada: 30, ancla: F('2026-10-20 09:00'), quien: 'Técnico mecánico' }],
      corr: [['2026-10-08 10:20', 90, 'Pérdida de vacío en la campana 2', 'Junta de la campana cortada: se reemplazó y se verificó el vacío en 3 mbar.'], ['2026-10-27 15:40', 35, 'Sello incompleto en bolsas', 'Temperatura baja en la barra de sellado: se ajustó y se cambió el teflón.']] },
    { id: 'TER-01', tipo: 'termocontraible', n: 'Termocontraíble', sub: 'Túnel termocontraíble por inmersión', ubic: 'Sala de envasado · Línea 1', tag: '04:19:E2:6A:C3:5D:80', hd: 15, h0: 7420, crit: 'Alta',
      ficha: [['Temperatura de trabajo', '82 a 88 °C'], ['Tanque', '450 L de agua'], ['Resistencias', '3 × 9 kW'], ['Bomba de recirculación', '1,5 kW'], ['Inmersión', '1 a 2 segundos por pieza'], ['En servicio desde', '2022']],
      checks: ['Temperatura del agua entre 82 y 88 °C', 'Nivel del tanque correcto', 'Boquillas sin obstrucción', 'Sin pérdidas de agua'],
      plan: [
        { id: 'boquillas', t: 'Limpieza de filtro de agua y boquillas', tipo: 'd', cada: 7, ancla: F('2026-10-03 06:30'), quien: 'Técnico mecánico' },
        { id: 'descal', t: 'Descalcificación del tanque', tipo: 'd', cada: 30, ancla: F('2026-10-25 08:00'), quien: 'Técnico mecánico' },
        { id: 'resist', t: 'Revisión de resistencias y termostato', tipo: 'h', cada: 1000, ancla: F('2026-11-25 10:00'), quien: 'Técnico eléctrico' }],
      corr: [['2026-10-15 07:50', 180, 'El agua no llega a temperatura (78 °C)', 'Resistencia 2 quemada: se reemplazó y se verificó el termostato.']] },
    { id: 'SEC-01', tipo: 'secador', n: 'Secador de termocontraíble', sub: 'Secador por soplado de aire', ubic: 'Sala de envasado · Línea 1', tag: '04:5C:81:0F:9B:22:80', hd: 15, h0: 7395, crit: 'Media',
      ficha: [['Soplador', '5,5 kW · 2.900 rpm'], ['Cuchillas de aire', '3, de acero inoxidable'], ['Velocidad de cinta', 'hasta 18 m/min'], ['Filtro de aspiración', 'G4 lavable'], ['En servicio desde', '2022']],
      checks: ['Filtro de aspiración limpio', 'Sin vibraciones ni ruidos en el soplador', 'Producto sale seco', 'Cinta alineada'],
      plan: [
        { id: 'filtroaire', t: 'Limpieza del filtro de aire', tipo: 'd', cada: 7, ancla: F('2026-10-02 06:30'), quien: 'Técnico mecánico' },
        { id: 'rodam', t: 'Lubricación de rodamientos del soplador', tipo: 'h', cada: 500, ancla: F('2026-11-18 10:00'), quien: 'Técnico mecánico' },
        { id: 'correa', t: 'Cambio de correa del soplador', tipo: 'h', cada: 2000, ancla: F('2026-12-09 10:00'), quien: 'Técnico mecánico' }],
      corr: [['2026-10-22 11:10', 50, 'Vibración y ruido en el soplador', 'Rodamiento del lado del motor con juego: se lubricó y se programó el cambio.'], ['2026-11-05 14:00', 120, 'Cambio de rodamientos del soplador', 'Se reemplazaron ambos rodamientos (6205-2RS); vibración normal.']] },
    { id: 'FLE-01', tipo: 'flejadora', n: 'Flejadora', sub: 'Flejadora automática de arco', ubic: 'Expedición · fin de línea', tag: '04:A1:7D:44:E8:93:80', hd: 15, h0: 11850, crit: 'Media',
      ficha: [['Fleje', 'polipropileno de 9 a 12 mm'], ['Velocidad', '25 flejes por minuto'], ['Arco', '850 × 600 mm'], ['Soldadura', 'por calor'], ['En servicio desde', '2020']],
      checks: ['Cabezal de soldadura limpio', 'Fleje tensado y soldado', 'Arco sin restos de fleje', 'Bobina con fleje suficiente'],
      plan: [
        { id: 'cabezal', t: 'Limpieza del cabezal de soldadura', tipo: 'd', cada: 7, ancla: F('2026-10-04 06:30'), quien: 'Técnico mecánico' },
        { id: 'tensores', t: 'Lubricación de rodillos tensores', tipo: 'd', cada: 15, ancla: F('2026-10-09 08:00'), quien: 'Técnico mecánico' },
        { id: 'cuchilla', t: 'Cambio de cuchilla de corte', tipo: 'h', cada: 800, ancla: F('2026-11-26 10:00'), quien: 'Técnico mecánico' }],
      corr: [['2026-10-10 09:30', 25, 'Atasco de fleje en el arco', 'Se liberó el arco y se limpió la guía.'], ['2026-10-24 16:10', 30, 'Atasco de fleje en el arco', 'Se liberó el arco; fleje mal cortado.'], ['2026-11-07 10:45', 35, 'Atasco de fleje en el arco', 'Se liberó el arco; se ajustó la tensión.']] },
    { id: 'DM-01', tipo: 'detector', n: 'Detector de metales', sub: 'Detector de túnel · PCC 2', ubic: 'Envasado · salida de la vaciadora', tag: '04:3E:B9:72:1A:C6:80', hd: 15, h0: 10260, crit: 'Crítica (PCC)', pcc: true,
      ficha: [['Sensibilidad', 'Fe 2,0 mm · No Fe 2,5 mm · Inox 3,0 mm'], ['Abertura', '500 × 200 mm'], ['Rechazo', 'compuerta automática a contenedor con llave'], ['Verificación', 'con patrones al inicio de cada turno'], ['En servicio desde', '2021']],
      checks: ['Patrón Fe 2,0 mm rechazado', 'Patrón No Fe 2,5 mm rechazado', 'Patrón Inox 3,0 mm rechazado', 'Contenedor de rechazo cerrado con llave'],
      plan: [
        { id: 'verif', t: 'Verificación con patrones (Fe, No Fe, Inox)', tipo: 'v', turnos: [7, 15], quien: 'Inspector de calidad' },
        { id: 'valid', t: 'Validación semestral de sensibilidad', tipo: 'd', cada: 182, ancla: F('2026-06-02 09:00'), quien: 'Proveedor externo' }],
      corr: [['2026-10-19 15:20', 60, 'Falla de verificación con patrón Inox 3,0 mm', 'Se retuvo y reinspeccionó el producto del turno; se recalibró la sensibilidad y la verificación dio conforme.']] },
    { id: 'RX-01', tipo: 'rayosx', n: 'Máquina de rayos X', sub: 'Inspección de producto envasado', ubic: 'Expedición · antes del paletizado', tag: '04:D8:26:5F:0B:E4:80', hd: 15, h0: 6210, crit: 'Crítica (PCC)', pcc: true,
      ficha: [['Detección', 'hueso calcificado ≥ 2 mm · metal ≥ 0,8 mm · vidrio ≥ 2 mm'], ['Tubo', '80 kV'], ['Fuga de radiación', 'menor a 1 µSv/h en la superficie'], ['Cortinas', 'de plomo en entrada y salida'], ['En servicio desde', '2023']],
      checks: ['Pieza de prueba detectada y rechazada', 'Cortinas de plomo completas', 'Baliza y parada de emergencia funcionando', 'Pantalla sin alarmas'],
      plan: [
        { id: 'verif', t: 'Verificación con piezas de prueba', tipo: 'v', turnos: [7, 15], quien: 'Inspector de calidad' },
        { id: 'cortinas', t: 'Inspección de cortinas de plomo', tipo: 'd', cada: 30, ancla: F('2026-10-30 09:00'), quien: 'Técnico mecánico' },
        { id: 'calib', t: 'Calibración anual y control de radiación', tipo: 'd', cada: 365, ancla: F('2025-11-24 09:00'), quien: 'Proveedor externo' }],
      corr: [['2026-10-30 08:15', 40, 'Cortina de plomo rota en la salida', 'Se reemplazó la cortina; control de fugas conforme (0,3 µSv/h).']] }
  ];
  const eqDe = id => EQ.find(x => x.id === id);
  const TAGS_DEMO = Object.fromEntries(EQ.map(x => [x.tag.replace(/:/g, '').toLowerCase(), x.id]));

  /* ---------- Horómetro ---------------------------------------------- */
  function horasDia(eq, t) { const d = new Date(t).getDay(); return d === 0 ? 0 : d === 6 ? 8 : eq.hd; }
  function horas(eq, t) {
    let h = eq.h0;
    for (let d = INICIO; d < t; d += DIA) {
      const dia = inicioDia(d + 2 * H), hd = horasDia(eq, dia), ini = dia + 6 * H;
      const fin = Math.min(t, dia + DIA);
      if (fin <= ini) continue;
      h += Math.min(hd, (fin - ini) / H);
    }
    return h;
  }
  function tiempoDeHoras(eq, objetivo) {         // primer instante en que el horómetro llega a `objetivo`
    let lo = INICIO - 400 * DIA, hi = INICIO + 400 * DIA;
    if (objetivo <= eq.h0) { lo = INICIO - 400 * DIA; hi = INICIO; }
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (horasNeg(eq, m) < objetivo) lo = m; else hi = m; }
    return hi;
  }
  function horasNeg(eq, t) { if (t >= INICIO) return horas(eq, t); let h = eq.h0; for (let d = inicioDia(INICIO - DIA); d >= inicioDia(t); d -= DIA) { const hd = horasDia(eq, d), ini = d + 6 * H; const desde = Math.max(t, ini), hasta = ini + hd * H; if (hasta > desde) h -= Math.min(hd, (hasta - desde) / H); } return h; }

  /* ---------- Estado del usuario ------------------------------------- */
  const est = ls.get('sima.nfc.estado', { prog: {}, rep: {}, hechos: {}, controles: [], verifs: [], lecturas: [], tags: {}, extra: [], visto: {} });
  ['prog', 'rep', 'hechos', 'tags', 'visto'].forEach(k => est[k] = est[k] || {}); ['controles', 'verifs', 'lecturas', 'extra'].forEach(k => est[k] = est[k] || []);
  const guardar = () => ls.set('sima.nfc.estado', est);
  const CORTE = F('2026-11-13 00:00');          // lo que vence después de esta fecha lo resuelve el usuario en pantalla

  /* ---------- Plan: ocurrencias, realizadas y próximas ---------------- */
  function ocurrencias(eq, it) {
    const out = [], ahora = Date.now();
    if (it.tipo === 'd') {
      for (let k = -60; k < 60; k++) { const t = it.ancla + k * it.cada * DIA; if (t < INICIO - it.cada * DIA) continue; if (t > ahora + 120 * DIA) break; out.push(t); }
    } else if (it.tipo === 'h') {
      const hA = horas(eq, it.ancla) || horasNeg(eq, it.ancla);
      for (let k = -12; k <= 6; k++) { const t = tiempoDeHoras(eq, hA + k * it.cada); if (t > ahora + 120 * DIA) break; out.push(t); }
    }
    return out.filter(t => t >= INICIO - (it.tipo === 'd' ? it.cada * DIA : 120 * DIA));
  }
  function estadoItem(eq, it) {
    const key = eq.id + ':' + it.id, ahora = Date.now(), occ = ocurrencias(eq, it), hechosU = est.hechos[key] || [];
    const hechos = []; let pendiente = null;
    for (const t of occ) {
      const auto = t < ahora - 12 * H && t < (it.rep ? CORTE : Infinity);
      const r = rnd(key + t), r2 = rnd(key + 'm' + t);
      let dias = r < 0.12 ? 2 + Math.floor(r * 25) : it.tipo === 'h' ? (r < 0.6 ? 0 : 1) : (r < 0.55 ? 0 : r < 0.8 ? -1 : 1);
      if (new Date(t + dias * DIA).getDay() === 0) dias += 1;
      const atraso = dias * DIA + (10 + r2 * 140) * MIN;
      if (auto) { hechos.push({ t: t + atraso, prev: t, quien: it.quien, ok: atraso <= 1.5 * DIA }); continue; }
      const u = hechosU.find(h => h.prev === t);
      if (u) { hechos.push({ t: u.t, prev: t, quien: u.quien, ok: u.t - t <= 1.5 * DIA, usuario: true }); continue; }
      if (!pendiente) pendiente = t;
    }
    const ult = hechos.filter(h => h.t <= ahora).sort((a, b) => b.t - a.t)[0] || null;
    const prog = est.prog[key] && est.prog[key].prev === pendiente ? est.prog[key] : null;
    let estado = 'ok';
    if (pendiente != null) { if (pendiente < ahora) estado = 'vencido'; else if (pendiente - ahora < 3 * DIA) estado = 'proximo'; }
    const prev = hechos.filter(h => h.t <= ahora && h.t >= INICIO);
    return { key, it, hechos: prev, ult, prox: pendiente, prog, estado, horasProx: it.tipo === 'h' && pendiente ? horas(eq, pendiente) : null };
  }
  function verificaciones(eq, it) {     // verificaciones por turno (detector y rayos X)
    const ahora = Date.now(), out = [];
    for (let d = INICIO; d <= ahora; d += DIA) {
      const dia = inicioDia(d + 2 * H); if (new Date(dia).getDay() === 0) continue;
      for (const tu of it.turnos) {
        const t = dia + tu * H; if (t > ahora) continue;
        const u = est.verifs.find(v => v.eq === eq.id && v.prog === t);
        if (dia < inicioDia(ahora) || u) {
          const r = rnd(eq.id + 'v' + t);
          const falla = eq.id === 'DM-01' && t === F('2026-10-19 15:00');
          out.push({ t: u ? u.t : t + (5 + r * 25) * MIN, prog: t, ok: u ? u.ok : !falla, quien: u ? u.quien : 'Inspector de calidad', usuario: !!u });
        } else out.push({ t, prog: t, pendiente: true });
      }
    }
    return out;
  }
  function controlesNfc(eq) {          // control diario con lectura de la placa (lunes a sábado)
    const ahora = Date.now(), out = [];
    for (let d = INICIO; d < inicioDia(ahora); d += DIA) {
      const dia = inicioDia(d + 2 * H); if (new Date(dia).getDay() === 0) continue;
      const r = rnd(eq.id + 'c' + dia); if (r < 0.04) continue;
      out.push({ t: dia + (7 * 60 + 10 + r * 50) * MIN, quien: 'Inspector de turno', ok: eq.checks.length, n: eq.checks.length });
    }
    return out.concat(est.controles.filter(c => c.eq === eq.id));
  }

  /* ---------- Indicadores -------------------------------------------- */
  function kpis(eq) {
    const ahora = Date.now(), hOp = horas(eq, ahora) - eq.h0;
    const corr = eq.corr.map(c => ({ t: F(c[0]), min: c[1] })).filter(c => c.t <= ahora);
    const parada = corr.reduce((a, c) => a + c.min, 0) / 60;
    const items = eq.plan.filter(it => it.tipo !== 'v').map(it => estadoItem(eq, it));
    const total = items.reduce((a, s) => a + s.hechos.length + (s.estado === 'vencido' ? 1 : 0), 0);
    const aTiempo = items.reduce((a, s) => a + s.hechos.filter(h => h.ok).length, 0);
    const vv = eq.plan.filter(it => it.tipo === 'v').flatMap(it => verificaciones(eq, it));
    const vOk = vv.filter(v => !v.pendiente).length;
    return {
      hOp, disp: hOp ? (1 - parada / hOp) * 100 : 100, mtbf: corr.length ? hOp / corr.length : null, mttr: corr.length ? corr.reduce((a, c) => a + c.min, 0) / corr.length : null,
      cumpl: total ? aTiempo / total * 100 : 100, nCorr: corr.length, verif: vv.length ? { ok: vOk, total: vv.length, pend: vv.filter(v => v.pendiente) } : null
    };
  }
  function estadoEquipo(eq) {
    const items = eq.plan.filter(it => it.tipo !== 'v').map(it => estadoItem(eq, it));
    const pend = eq.plan.filter(it => it.tipo === 'v').flatMap(it => verificaciones(eq, it)).filter(v => v.pendiente && Date.now() - v.prog > 60 * MIN);
    if (pend.length || items.some(s => s.estado === 'vencido' && !s.prog)) return ['atencion', 'Atención'];
    if (items.some(s => !s.prog && (s.estado === 'vencido' || (s.estado === 'proximo' && (s.it.tipo === 'h' || s.it.cada > 7 || s.prox - Date.now() < DIA))))) return ['proximo', 'Mantenimiento próximo'];
    return ['ok', 'Operativo'];
  }
  function proximoDe(eq) { return eq.plan.filter(it => it.tipo !== 'v').map(it => estadoItem(eq, it)).filter(s => s.prox).sort((a, b) => a.prox - b.prox)[0]; }

  /* ---------- Alertas de SIMI ----------------------------------------- */
  function alertas() {
    const ahora = Date.now(), out = [];
    for (const eq of EQ) for (const it of eq.plan.filter(i => i.tipo === 'v')) {
      for (const v of verificaciones(eq, it).filter(v => v.pendiente && ahora - v.prog > 60 * MIN)) out.push({ id: `verif-${eq.id}-${v.prog}`, eq: eq.id, pri: 0, nivel: 'crit', t: `${eq.n}: verificación del turno pendiente`, d: `La ${it.t.toLowerCase()} de las ${hora(v.prog)} todavía no se registró. Es un punto crítico de control: sin verificación, el producto de este turno queda observado.`, acc: [{ t: 'Registrar verificación', fn: `SIMA_NFC.verificar('${eq.id}',${v.prog})` }] });
    }
    const vac = eqDe('VAC-01'), sf = estadoItem(vac, vac.plan[0]);
    if (sf.prox && !sf.prog) {
      const rep = est.rep[sf.key], h = horas(vac, ahora);
      if (!rep) out.push({ id: 'filtro-vac', eq: 'VAC-01', pri: 1, nivel: sf.estado === 'vencido' ? 'crit' : 'adv', t: `Cambio de filtro de la vaciadora: ${sf.estado === 'vencido' ? 'vencido el' : 'vence el'} ${fechaL(sf.prox)}`, d: `Toca a las ${nf.format(sf.horasProx)} h de bomba (hoy marca ${nf.format(h)} h). ¿Ya tenemos ${vac.plan[0].rep.n} en stock para programar el cambio?`, acc: [{ t: 'Sí, hay filtros · Programar', fn: "SIMA_NFC.filtro(true)" }, { t: 'No, pedir repuesto', fn: "SIMA_NFC.filtro(false)" }], pregunta: true });
      else if (rep.estado === 'pedido') out.push({ id: 'filtro-vac-p', eq: 'VAC-01', pri: 1, nivel: 'adv', t: 'Filtro de la vaciadora: repuesto pedido', d: `Pediste ${vac.plan[0].rep.cant} filtros (${vac.plan[0].rep.cod}) el ${fecha(rep.t)}; con ${vac.plan[0].rep.demora} de entrega llegarían el ${fecha(rep.llega)}. Te propongo programar el cambio para el ${fechaL(rep.llega + DIA)} y controlar el vacío de la bomba en cada turno hasta entonces.`, acc: [{ t: `Programar para el ${fecha(rep.llega + DIA)}`, fn: `SIMA_NFC.programar('${sf.key}',${rep.llega + DIA})` }, { t: 'Ya llegaron · Programar', fn: "SIMA_NFC.filtro(true)" }] });
    }
    const fle = eqDe('FLE-01'), atascos = fle.corr.filter(c => F(c[0]) > ahora - 35 * DIA && F(c[0]) <= ahora);
    if (atascos.length >= 3 && !est.extra.some(x => x.id === 'insp-cabezal')) out.push({ id: 'fle-patron', eq: 'FLE-01', pri: 2, nivel: 'adv', t: `Flejadora: ${atascos.length} atascos de fleje en 30 días`, d: `${atascos.map(c => fecha(F(c[0]))).join(', ')}. Es el patrón típico de una cuchilla de corte gastada o la guía del arco desalineada. Conviene inspeccionar el cabezal antes de que pare la línea de expedición.`, acc: [{ t: 'Programar inspección del cabezal', fn: "SIMA_NFC.extra('FLE-01','insp-cabezal','Inspección de cuchilla y guía del arco')" }] });
    for (const eq of EQ) for (const it of eq.plan.filter(i => i.tipo !== 'v')) {
      if (eq.id === 'VAC-01' && it.id === 'filtro') continue;
      const s = estadoItem(eq, it); if (!s.prox || s.prog) continue;
      const dias = (s.prox - ahora) / DIA;
      if (it.id === 'calib' && dias < 21) out.push({ id: s.key, eq: eq.id, pri: 2, nivel: 'adv', t: `${eq.n}: calibración anual el ${fechaL(s.prox)}`, d: 'La hace el proveedor externo e incluye el control de radiación. ¿La coordinamos? Conviene confirmar la visita con una semana de anticipación.', acc: [{ t: 'Programar calibración', fn: `SIMA_NFC.programar('${s.key}',${s.prox})` }] });
      else if (dias < 0) out.push({ id: s.key, eq: eq.id, pri: 1, nivel: 'crit', t: `${eq.n}: ${it.t.toLowerCase()} vencido`, d: `Vencía el ${fechaL(s.prox)}. ¿Lo programamos para hoy?`, acc: [{ t: 'Programar para hoy', fn: `SIMA_NFC.programar('${s.key}',${ahora})` }, { t: 'Ya se hizo', fn: `SIMA_NFC.realizado('${s.key}')` }] });
      else if (dias < 3 && it.tipo !== 'd' || (dias < 2)) out.push({ id: s.key, eq: eq.id, pri: 3, nivel: 'info', t: `${eq.n}: ${it.t.toLowerCase()}`, d: `Toca el ${fechaL(s.prox)}${s.horasProx ? ` (a las ${nf.format(s.horasProx)} h)` : ''}.`, acc: [{ t: 'Programar', fn: `SIMA_NFC.programar('${s.key}',${s.prox})` }] });
    }
    return out.sort((a, b) => a.pri - b.pri);
  }

  /* ---------- Historial ------------------------------------------------ */
  function historial(eq) {
    const ahora = Date.now(), ev = [];
    for (const it of eq.plan) {
      if (it.tipo === 'v') { for (const v of verificaciones(eq, it).filter(v => !v.pendiente).slice(-6)) ev.push({ t: v.t, k: 'verif', tit: v.ok ? 'Verificación conforme' : 'Verificación NO conforme', det: `${it.t} · turno de las ${hora(v.prog)} · ${v.quien}`, ok: v.ok }); continue; }
      for (const h of estadoItem(eq, it).hechos) ev.push({ t: h.t, k: 'prev', tit: it.t, det: `Preventivo · ${h.quien}${h.ok ? '' : ' · realizado con atraso'}`, ok: true });
    }
    for (const c of eq.corr) if (F(c[0]) <= ahora) ev.push({ t: F(c[0]), k: 'corr', tit: c[2], det: `${c[3]} Parada de ${c[1]} min.`, ok: false });
    for (const c of controlesNfc(eq).slice(-8)) ev.push({ t: c.t, k: 'ctrl', tit: 'Control diario por NFC', det: `${c.quien} · ${c.ok}/${c.n} puntos conformes`, ok: c.ok === c.n });
    for (const l of est.lecturas.filter(x => x.eq === eq.id)) ev.push({ t: l.t, k: 'ctrl', tit: 'Lectura de la placa NFC', det: `${l.quien} · placa ${l.uid}`, ok: true });
    for (const x of est.extra.filter(x => x.eq === eq.id)) ev.push({ t: x.creado, k: 'prev', tit: `Programado: ${x.t}`, det: `Para el ${fechaL(x.fecha)} · lo programó ${x.quien}`, ok: true });
    for (const [k, p] of Object.entries(est.prog)) if (k.startsWith(eq.id + ':')) ev.push({ t: p.creado, k: 'prev', tit: `Programado: ${eq.plan.find(i => eq.id + ':' + i.id === k).t}`, det: `Para el ${fechaL(p.fecha)}, turno ${p.turno} · lo programó ${p.quien}`, ok: true });
    return ev.filter(x => x.t <= ahora + 60e3).sort((a, b) => b.t - a.t);
  }

  /* ---------- Modelos 3D ----------------------------------------------- */
  let carga3d = null, visorAct = null;
  function cargar3d() { if (!carga3d) carga3d = import('/sima-equipos3d.js').catch(() => null); return carga3d; }
  async function pintarMiniaturas() {
    await cargar3d(); if (!window.SIMA_3D || !SIMA_3D.ok) return;
    for (const img of document.querySelectorAll('img[data-eq3d]')) { try { img.src = await SIMA_3D.miniatura(img.dataset.eq3d); img.classList.add('ok'); } catch (_) {} }
  }
  async function montarVisor() {
    if (visorAct) { try { visorAct.cerrar(); } catch (_) {} visorAct = null; }
    const el = $('eq3d'); if (!el) return;
    await cargar3d(); if (!window.SIMA_3D || !SIMA_3D.ok || !$('eq3d')) return;
    visorAct = SIMA_3D.visor(el, el.dataset.tipo);
    el.classList.add('ok');
  }

  /* ---------- Vistas -------------------------------------------------- */
  let sel = null, pest = 'plan', filtroHist = 'todo', ctrlAbierto = false;
  const icoM = k => (window.SIMA_MODS ? SIMA_MODS.ico(k) : '');
  const ICO = {
    nfc: '<path d="M6 8.3a6 6 0 010 7.4"/><path d="M9.5 6a10 10 0 010 12"/><path d="M13 3.6a14 14 0 010 16.8"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    atras: '<path d="M15 6l-6 6 6 6"/>',
    llave: '<path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
    ok: '<path d="M20 6L9 17l-5-5"/>', alerta: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/>'
  };
  const ico = (k, c = '') => `<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]}</svg>`;
  const nfcLee = () => 'NDEFReader' in window;
  function opciones() {
    return `<details class="iot-mas"><summary aria-label="Opciones">···</summary><div class="iot-menu" role="menu">
      <b>Leer una placa</b>${EQ.map(x => `<button type="button" role="menuitem" onclick="SIMA_NFC.leida('${x.tag}');this.closest('details').open=false">${e(x.n)} · ${x.id}</button>`).join('')}
      <hr><button type="button" role="menuitem" class="sal" onclick="SIMA_DEMO.set(false)">Desactivar datos de demostración</button></div></details>`;
  }
  let verTodas = false;
  function pintarAlertas(lista, max = verTodas ? 9 : 2) {
    if (!lista.length) return `<div class="ins-head">${window.SIMI_M ? SIMI_M.svg('h-feliz') : ''}<div><b>SIMI · plan de mantenimiento</b><small>Todo al día: no hay tareas vencidas ni verificaciones pendientes.</small></div></div>`;
    return `<div class="ins-head">${window.SIMI_M ? SIMI_M.svg(lista[0].nivel === 'crit' ? 'h-alerta' : '') : ''}<div><b>SIMI · plan de mantenimiento</b><small>${lista.length} ${lista.length > 1 ? 'temas para resolver' : 'tema para resolver'}</small></div>
      <button type="button" class="it-b" onclick="simiPreguntar('¿Qué mantenimientos vencen esta semana?')">Esta semana</button></div>
      <div class="nfc-al">${lista.slice(0, max).map(a => `<article class="nal ${a.nivel}"><span class="nal-k">${ico(a.nivel === 'info' ? 'reloj' : 'alerta')}${e(eqDe(a.eq).n)}</span><b>${e(a.t)}</b><p>${e(a.d)}</p>
        <span class="nal-a">${a.acc.map((x, i) => `<button type="button" class="${i ? '' : 'pri'}" onclick="${x.fn}">${e(x.t)}</button>`).join('')}<button type="button" class="lnk" onclick="SIMA_NFC.abrir('${a.eq}')">Ver equipo</button></span></article>`).join('')}</div>${lista.length > 2 ? `<button type="button" class="nal-mas" onclick="SIMA_NFC.verTodas()">${verTodas ? 'Ver menos' : `Ver los ${lista.length} temas`}</button>` : ''}`;
  }
  function tarjeta(eq) {
    const [ec, el] = estadoEquipo(eq), p = proximoDe(eq), ahora = Date.now();
    let barra = 0, cuando = '';
    if (p) {
      const ini = p.ult ? p.ult.prev || p.ult.t : p.prox - (p.it.tipo === 'd' ? p.it.cada * DIA : 30 * DIA);
      barra = Math.max(0, Math.min(100, (ahora - ini) / (p.prox - ini) * 100));
      const dd = Math.round((p.prox - ahora) / DIA);
      cuando = p.prog ? `programado ${fecha(p.prog.fecha)}` : dd < 0 ? `vencido hace ${-dd} día${dd === -1 ? '' : 's'}` : dd === 0 ? 'hoy' : dd === 1 ? 'mañana' : `en ${dd} días`;
    }
    return `<button type="button" class="eqc ${ec}" onclick="SIMA_NFC.abrir('${eq.id}')" aria-label="${e(eq.n)}, ${el}. Ver detalle">
      <span class="eqc-img"><img data-eq3d="${eq.tipo}" alt="" draggable="false"><span class="eqc-est"><i></i>${el}</span><span class="eqc-id">${eq.id}</span></span>
      <span class="eqc-c"><b>${e(eq.n)}</b><small>${e(eq.sub)}</small>
        <span class="eqc-meta">${ico('pin')}${e(eq.ubic)}</span>
        <span class="eqc-meta">${ico('reloj')}${nf.format(horas(eq, ahora))} h de uso</span>
        ${p ? `<span class="eqc-prox"><span><small>Próximo</small>${e(p.it.t)}</span><em class="${p.estado}">${cuando}</em></span><span class="iot-bar eqc-bar ${p.estado}"><i style="width:${barra.toFixed(0)}%"></i></span>` : ''}
      </span></button>`;
  }
  function vLista() {
    const al = alertas(), ahora = Date.now(), ks = EQ.map(kpis);
    const oper = EQ.filter(x => estadoEquipo(x)[0] !== 'atencion').length;
    const semana = EQ.flatMap(eq => eq.plan.filter(i => i.tipo !== 'v').map(it => estadoItem(eq, it))).filter(s => s.prox && s.prox - ahora < 7 * DIA).length;
    const cumpl = ks.reduce((a, k) => a + k.cumpl, 0) / ks.length, disp = ks.reduce((a, k) => a + k.disp, 0) / ks.length;
    const prox = EQ.flatMap(eq => eq.plan.filter(i => i.tipo !== 'v').map(it => ({ eq, s: estadoItem(eq, it) }))).filter(x => x.s.prox).sort((a, b) => a.s.prox - b.s.prox).slice(0, 8);
    return `<div id="nfcRoot">
      <div class="mx-head"><span class="mod-ico" style="background:rgba(63,197,232,.12);color:var(--ice,#3FC5E8)">${icoM('nfc')}</span>
        <div style="flex:1;min-width:0"><span class="mx-tag">Módulo 2</span><h2>Seguimiento de equipos <small class="mx-sub">NFC</small></h2>
        <p>${EQ.length} equipos de envasado y expedición con placa NFC · plan de mantenimiento e historial desde el 1/10</p></div></div>
      <div class="iot-barra">${nfcLee() ? `<button type="button" class="btn btn-primary nfc-leer" onclick="SIMA_NFC.leer()">${ico('nfc')} Leer placa NFC</button>` : ''}<span class="nfc-ayuda">${nfcLee() ? 'Apoyá el celular en la placa del equipo.' : 'Tocá un equipo para ver su ficha.'}</span>${opciones()}</div>
      <div class="iot-resumen nfc-kpi">
        <div class="iot-kpi"><small>Equipos operativos</small><b>${oper} de ${EQ.length}</b></div>
        <div class="iot-kpi"><small>Mantenimientos en 7 días</small><b>${semana}</b></div>
        <div class="iot-kpi"><small>Cumplimiento del plan</small><b>${nf1.format(cumpl)} %</b></div>
        <div class="iot-kpi"><small>Disponibilidad promedio</small><b>${nf1.format(disp)} %</b></div>
      </div>
      <section class="mx-box iot-ins" id="nfcAl">${pintarAlertas(al)}</section>
      <div class="eq-grid">${EQ.map(tarjeta).join('')}</div>
      <section class="mx-box" style="margin-top:16px"><h3 class="iot-h" style="margin-top:0">Próximos mantenimientos</h3>
        <div class="h-tabla"><table><thead><tr><th>Fecha</th><th>Equipo</th><th>Tarea</th><th>Frecuencia</th><th>Estado</th></tr></thead><tbody>
        ${prox.map(({ eq, s }) => `<tr><td>${fechaL(s.prog ? s.prog.fecha : s.prox)}</td><td>${e(eq.n)}</td><td>${e(s.it.t)}</td><td>${frec(s.it)}</td><td>${chip(s)}</td></tr>`).join('')}</tbody></table></div></section>
      </div>`;
  }
  const frec = it => it.tipo === 'h' ? `cada ${nf.format(it.cada)} h` : it.tipo === 'v' ? `cada turno (${it.turnos.map(h => p2(h) + ':00').join(' y ')})` : it.cada === 7 ? 'semanal' : it.cada === 15 ? 'quincenal' : it.cada === 30 ? 'mensual' : it.cada === 182 ? 'semestral' : it.cada === 365 ? 'anual' : `cada ${it.cada} días`;
  const chip = s => s.prog ? `<span class="eqs prog">Programado ${fecha(s.prog.fecha)}</span>` : s.estado === 'vencido' ? '<span class="eqs venc">Vencido</span>' : s.estado === 'proximo' ? '<span class="eqs prox">Próximo</span>' : '<span class="eqs ok">Al día</span>';
  function vDetalle(eq) {
    const [ec, el] = estadoEquipo(eq), k = kpis(eq), ahora = Date.now();
    const al = alertas().filter(a => a.eq === eq.id);
    const items = eq.plan.map(it => it.tipo === 'v' ? { it, v: verificaciones(eq, it) } : estadoItem(eq, it));
    const hist = historial(eq).filter(x => filtroHist === 'todo' || x.k === filtroHist);
    const ultCorr = eq.corr.filter(c => F(c[0]) <= ahora).slice(-1)[0];
    let cuerpo;
    if (pest === 'plan') cuerpo = `<div class="h-tabla"><table><thead><tr><th>Tarea</th><th>Frecuencia</th><th>Última</th><th>Próxima</th><th>Estado</th><th></th></tr></thead><tbody>
      ${items.map(s => {
        if (s.v) { const hoy = s.v.filter(v => v.prog >= inicioDia(ahora)), pend = hoy.filter(v => v.pendiente && ahora > v.prog); const ult = s.v.filter(v => !v.pendiente).slice(-1)[0];
          return `<tr><td><b>${e(s.it.t)}</b><small>${e(s.it.quien)} · punto crítico de control</small></td><td>${frec(s.it)}</td><td>${ult ? `${fecha(ult.t)} ${hora(ult.t)}` : '—'}</td><td>${(() => { const n = eq.plan.find(i => i.id === s.it.id).turnos.map(h => inicioDia(ahora) + h * H).find(t => t > ahora); return n ? `hoy ${hora(n)}` : 'mañana 07:00'; })()}</td><td>${pend.length ? '<span class="eqs venc">Pendiente</span>' : '<span class="eqs ok">Al día</span>'}</td><td>${pend.length ? `<button type="button" class="it-b pri" onclick="SIMA_NFC.verificar('${eq.id}',${pend[0].prog})">Registrar</button>` : ''}</td></tr>`; }
        return `<tr><td><b>${e(s.it.t)}</b><small>${e(s.it.quien)}${s.it.rep ? ` · repuesto ${s.it.rep.cod}` : ''}</small></td><td>${frec(s.it)}</td><td>${s.ult ? fecha(s.ult.t) + (s.it.tipo === 'h' ? ` · ${nf.format(horas(eq, s.ult.prev))} h` : '') : '—'}</td><td>${s.prox ? fecha(s.prog ? s.prog.fecha : s.prox) + (s.horasProx ? ` · ${nf.format(s.horasProx)} h` : '') : '—'}</td><td>${chip(s)}</td>
          <td>${s.prox ? `<span class="pl-acc">${s.prog ? '' : `<button type="button" class="it-b" onclick="SIMA_NFC.programar('${s.key}',${Math.max(s.prox, ahora)})">Programar</button>`}${s.prox - ahora < 5 * DIA ? `<button type="button" class="it-b" onclick="SIMA_NFC.realizado('${s.key}')">Realizado</button>` : ''}</span>` : ''}</td></tr>`;
      }).join('')}
      ${est.extra.filter(x => x.eq === eq.id).map(x => `<tr><td><b>${e(x.t)}</b><small>Pedido por SIMI</small></td><td>única</td><td>—</td><td>${fecha(x.fecha)}</td><td><span class="eqs prog">Programado ${fecha(x.fecha)}</span></td><td></td></tr>`).join('')}
      </tbody></table></div>`;
    else if (pest === 'hist') cuerpo = `<div class="h-dias hf">${[['todo', 'Todo'], ['prev', 'Preventivos'], ['corr', 'Correctivos'], ['ctrl', 'Controles NFC'], ['verif', 'Verificaciones']].filter(([kk]) => kk !== 'verif' || eq.pcc).map(([kk, l]) => `<button type="button" class="${filtroHist === kk ? 'on' : ''}" onclick="SIMA_NFC.filtroHist('${kk}')">${l}</button>`).join('')}</div>
      <ol class="eq-hist">${hist.slice(0, 40).map(x => `<li class="${x.k} ${x.ok ? '' : 'mal'}"><time>${fecha(x.t)} · ${hora(x.t)}</time><b>${e(x.tit)}</b><span>${e(x.det)}</span></li>`).join('') || '<li><span>Sin registros.</span></li>'}</ol>`;
    else cuerpo = `<dl class="eq-ficha">${[['Código', eq.id], ['Placa NFC', eq.tag], ['Ubicación', eq.ubic], ['Criticidad', eq.crit], ...eq.ficha].map(([a, b]) => `<div><dt>${e(a)}</dt><dd>${e(b)}</dd></div>`).join('')}</dl>`;
    return `<div id="nfcRoot" class="eq-det">
      <div class="iot-barra"><button type="button" class="btn btn-ghost btn-sm" onclick="SIMA_NFC.abrir(null)">${ico('atras')} Equipos</button>${opciones()}</div>
      <div class="eqd-top">
        <div class="eqd-3d" id="eq3d" data-tipo="${eq.tipo}"><span class="eqd-hint">Arrastrá para girar</span><span class="eqc-est ${ec}"><i></i>${el}</span></div>
        <div class="eqd-info">
          <span class="mx-tag">${eq.id} · ${e(eq.crit)}</span><h2>${e(eq.n)}</h2><p class="eqd-sub">${e(eq.sub)}</p>
          <div class="eqd-datos"><span>${ico('pin')}${e(eq.ubic)}</span><span>${ico('nfc')}Placa ${eq.tag}</span><span>${ico('reloj')}${nf.format(horas(eq, ahora))} h de uso</span></div>
          <div class="eqd-acc"><button type="button" class="btn btn-primary" onclick="SIMA_NFC.control('${eq.id}')">${ico('ok')} Registrar control del día</button>
            <button type="button" class="btn btn-ghost" onclick="SIMA_NFC.hallazgo('${eq.id}')">Cargar hallazgo</button>
            <button type="button" class="btn btn-ghost" onclick="simiPreguntar('¿Cómo está la ${eq.n.toLowerCase().replace('máquina de ', '')}?')">Preguntar a SIMI</button></div>
          ${ctrlAbierto ? `<form class="eq-ctrl" onsubmit="event.preventDefault();SIMA_NFC.guardarControl('${eq.id}',this)"><b>Control del día · ${e(eq.n)}</b>${eq.checks.map((c, i) => `<label><input type="checkbox" name="c${i}" checked> ${e(c)}</label>`).join('')}<span class="pl-acc"><button type="submit" class="it-b pri">Guardar control</button><button type="button" class="it-b" onclick="SIMA_NFC.control(null)">Cancelar</button></span></form>` : ''}
          <div class="eqd-simi">${window.SIMI_M ? SIMI_M.svg(al.length && al[0].nivel === 'crit' ? 'h-alerta' : '') : ''}<div>${al.length ? `<b>${e(al[0].t)}</b><p>${e(al[0].d)}</p><span class="nal-a">${al[0].acc.map((x, i) => `<button type="button" class="${i ? '' : 'pri'}" onclick="${x.fn}">${e(x.t)}</button>`).join('')}</span>` : `<b>Sin pendientes</b><p>${ultCorr ? `Última falla: ${e(ultCorr[2].toLowerCase())} el ${fecha(F(ultCorr[0]))}. ` : ''}El próximo mantenimiento es ${(() => { const p = proximoDe(eq); return p ? `${e(p.it.t.toLowerCase())} el ${fechaL(p.prog ? p.prog.fecha : p.prox)}` : 'sin fecha'; })()}.</p>`}</div></div>
        </div></div>
      <div class="iot-resumen nfc-kpi kpi5">
        <div class="iot-kpi"><small>Disponibilidad</small><b>${nf1.format(k.disp)} %</b><small>desde el 1/10</small></div>
        <div class="iot-kpi"><small>MTBF</small><b>${k.mtbf ? nf.format(k.mtbf) + ' h' : '—'}</b><small>tiempo medio entre fallas</small></div>
        <div class="iot-kpi"><small>MTTR</small><b>${k.mttr ? nf.format(k.mttr) + ' min' : '—'}</b><small>tiempo medio de reparación</small></div>
        <div class="iot-kpi"><small>Cumplimiento del plan</small><b>${nf1.format(k.cumpl)} %</b></div>
        <div class="iot-kpi"><small>${k.verif ? 'Verificaciones de PCC' : 'Correctivos'}</small><b>${k.verif ? `${k.verif.ok} de ${k.verif.total}` : k.nCorr}</b><small>${k.verif ? 'desde el 1/10' : 'desde el 1/10'}</small></div>
      </div>
      <div class="iot-tabs eq-tabs" role="tablist">${[['plan', 'Plan de mantenimiento'], ['hist', 'Historial'], ['ficha', 'Ficha técnica']].map(([kk, l]) => `<button type="button" role="tab" aria-selected="${pest === kk}" class="${pest === kk ? 'on' : ''}" onclick="SIMA_NFC.pestana('${kk}')">${l}</button>`).join('')}</div>
      <section class="mx-box">${cuerpo}</section></div>`;
  }

  /* ---------- Pantalla del módulo ------------------------------------- */
  const original = window.vModNfc;
  window.vModNfc = function () {
    if (!demoOn()) {
      const base = original ? original() : '';
      return base + `<p style="margin-top:16px"><button type="button" class="btn btn-ghost" id="nfcDemoBtn" onclick="SIMA_DEMO.set(true)">Ver con datos de demostración</button></p>`;
    }
    setTimeout(() => { if (sel) montarVisor(); else pintarMiniaturas(); if (!avisado) { avisado = true; avisoEntrada(); } }, 0);
    return sel && eqDe(sel) ? vDetalle(eqDe(sel)) : vLista();
  };
  function repintar() { if (typeof view !== 'undefined' && view === 'nfc' && typeof render === 'function') render(); }

  /* ---------- Aviso de SIMI al entrar --------------------------------- */
  let toastT = null, avisado = false;
  function toast(a) {
    if (typeof modulo !== 'undefined' && modulo !== 'nfc') return;
    let t = $('nfcToast');
    if (!t) { t = document.createElement('div'); t.id = 'nfcToast'; t.setAttribute('role', 'alert'); document.body.appendChild(t); }
    t.className = 'iot-toast ' + (a.nivel === 'crit' ? 'crit' : a.nivel === 'ok' ? 'ok' : 'adv');
    t.innerHTML = `${window.SIMI_M ? SIMI_M.svg(a.nivel === 'ok' ? 'h-feliz' : 'h-alerta') : ''}<div class="it-c"><small>SIMI · ${hora(Date.now())}</small><b>${e(a.t)}</b><p>${e(a.d)}</p>
      <div class="it-a">${(a.acc || []).map((x, i) => `<button type="button" class="it-b ${i ? '' : 'pri'}" onclick="document.getElementById('nfcToast').classList.remove('show');${x.fn}">${e(x.t)}</button>`).join('')}</div></div>
      <button type="button" class="it-x" aria-label="Cerrar aviso" onclick="this.parentNode.classList.remove('show')">×</button>`;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), a.nivel === 'ok' ? 6000 : 20000);
    const fs = document.querySelector('#simiFab .simi-svg'); if (window.SIMI_M && fs && a.nivel !== 'ok') SIMI_M.humor(fs, 'alerta', 2400);
  }
  function avisoEntrada() {
    let ses = {}; try { ses = JSON.parse(sessionStorage.getItem('sima.nfc.avisos') || '{}'); } catch (_) {}
    const a = alertas().find(x => !ses[x.id]); if (!a) return;
    ses[a.id] = 1; try { sessionStorage.setItem('sima.nfc.avisos', JSON.stringify(ses)); } catch (_) {}
    setTimeout(() => toast(a), 900);
  }
  window.addEventListener('sima:modulo', ev => { if (ev.detail !== 'nfc') { avisado = false; const t = $('nfcToast'); t && t.classList.remove('show'); if (visorAct) { visorAct.cerrar(); visorAct = null; } } });

  /* ---------- Lectura NFC (real en Android; simulada desde el menú) ---- */
  let lector = null;
  async function leer() {
    if (!nfcLee()) return;
    try {
      lector = lector || new AbortController();
      const r = new NDEFReader(); await r.scan({ signal: lector.signal });
      toast({ nivel: 'ok', t: 'Listo para leer', d: 'Apoyá la parte de atrás del celular sobre la placa del equipo.' });
      r.onreading = ev => leida(ev.serialNumber || '');
    } catch (err) { toast({ nivel: 'adv', t: 'No se pudo activar el NFC', d: /NotAllowed/i.test(err && err.name) ? 'Aceptá el permiso de NFC y volvé a intentar.' : 'Activá el NFC del celular en Ajustes y probá de nuevo.' }); }
  }
  function leida(uid) {
    const k = String(uid).replace(/:/g, '').toLowerCase();
    const id = est.tags[k] || TAGS_DEMO[k];
    if (!id) {
      toast({ nivel: 'adv', t: 'Placa nueva', d: `La placa ${uid} no está asignada. ¿A qué equipo corresponde?`, acc: EQ.map(x => ({ t: x.n, fn: `SIMA_NFC.asignar('${k}','${x.id}','${uid}')` })) });
      return;
    }
    const eq = eqDe(id);
    est.lecturas.push({ eq: id, t: Date.now(), uid: uid || eq.tag, quien: quien() }); guardar();
    sel = id; pest = 'plan'; ctrlAbierto = false; repintar();
    const al = alertas().find(a => a.eq === id);
    toast(al || { nivel: 'ok', t: `${eq.n} · placa leída`, d: `Registré tu paso a las ${hora(Date.now())}. ¿Hacemos el control del día?`, acc: [{ t: 'Registrar control', fn: `SIMA_NFC.control('${id}')` }] });
  }

  /* ---------- Acciones ------------------------------------------------- */
  function programar(key, t, turno) {
    const [id, itId] = key.split(':'), eq = eqDe(id), it = eq.plan.find(i => i.id === itId), s = estadoItem(eq, it);
    if (!s.prox) return;
    est.prog[key] = { prev: s.prox, fecha: +t, turno: turno || 'mañana', quien: quien(), creado: Date.now() }; guardar();
    repintar();
    toast({ nivel: 'ok', t: 'Programado', d: `${it.t} de ${eq.n.toLowerCase()} para el ${fechaL(+t)}, turno mañana, a cargo del ${it.quien.toLowerCase()}. Te aviso el día anterior.` });
  }
  window.SIMA_NFC = {
    abrir(id) { sel = id; pest = 'plan'; filtroHist = 'todo'; ctrlAbierto = false; repintar(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
    pestana(k) { pest = k; repintar(); },
    verTodas() { verTodas = !verTodas; const b = $('nfcAl'); if (b) b.innerHTML = pintarAlertas(alertas()); },
    filtroHist(k) { filtroHist = k; repintar(); },
    leer, leida,
    asignar(k, id, uid) { est.tags[k] = id; guardar(); leida(uid); },
    programar,
    realizado(key) {
      const [id, itId] = key.split(':'), eq = eqDe(id), it = eq.plan.find(i => i.id === itId), s = estadoItem(eq, it);
      if (!s.prox) return;
      (est.hechos[key] = est.hechos[key] || []).push({ prev: s.prox, t: Date.now(), quien: quien() }); delete est.prog[key]; guardar(); repintar();
      const n = estadoItem(eq, it);
      toast({ nivel: 'ok', t: 'Registrado', d: `${it.t} realizado hoy. El próximo toca el ${n.prox ? fechaL(n.prox) : '—'}${n.horasProx ? ` (a las ${nf.format(n.horasProx)} h)` : ''}.` });
    },
    filtro(hay) {
      const vac = eqDe('VAC-01'), it = vac.plan[0], s = estadoItem(vac, it);
      if (hay) { est.rep[s.key] = { estado: 'stock', t: Date.now() }; guardar(); programar(s.key, Math.max(s.prox, Date.now())); simiDice(`Perfecto. Programé el cambio del filtro de escape de la vaciadora para el <b>${fechaL(Math.max(s.prox, Date.now()))}</b>, turno mañana. Reservá ${it.rep.cant} filtros ${it.rep.cod} del depósito; te aviso el día anterior.`); }
      else {
        const llega = inicioDia(Date.now() + 4 * DIA) + 10 * H;
        est.rep[s.key] = { estado: 'pedido', t: Date.now(), llega }; guardar(); repintar();
        toast({ nivel: 'adv', t: 'Repuesto pedido', d: `Anoté el pedido de ${it.rep.cant} filtros ${it.rep.cod}. Con ${it.rep.demora} de entrega llegarían el ${fechaL(llega)}: te propongo programar el cambio para el ${fechaL(llega + DIA)} y controlar el vacío en cada turno hasta entonces.`, acc: [{ t: `Programar para el ${fecha(llega + DIA)}`, fn: `SIMA_NFC.programar('${s.key}',${llega + DIA})` }] });
        simiDice(`Anoté el pedido de <b>${it.rep.cant} filtros ${it.rep.cod}</b>. Llegarían el ${fechaL(llega)}. Mientras tanto, controlá que la bomba siga llegando a 5 mbar o menos en cada turno: si no llega, el filtro está saturado y hay que adelantar el cambio.`);
      }
    },
    extra(id, k, t) { const f = inicioDia(Date.now() + DIA) + 9 * H; est.extra.push({ eq: id, id: k, t, fecha: f, quien: quien(), creado: Date.now() }); guardar(); repintar(); toast({ nivel: 'ok', t: 'Programado', d: `${t} en la ${eqDe(id).n.toLowerCase()} para el ${fechaL(f)}, turno mañana.` }); },
    verificar(id, prog) { est.verifs.push({ eq: id, prog, t: Date.now(), ok: true, quien: quien() }); guardar(); repintar(); toast({ nivel: 'ok', t: 'Verificación registrada', d: `${eqDe(id).n}: verificación del turno de las ${hora(prog)} conforme, registrada a las ${hora(Date.now())} por ${quien()}.` }); },
    control(id) { if (id) { sel = id; ctrlAbierto = true; } else ctrlAbierto = false; repintar(); },
    guardarControl(id, f) { const eq = eqDe(id), ok = eq.checks.filter((_, i) => f.elements['c' + i].checked).length; est.controles.push({ eq: id, t: Date.now(), quien: quien(), ok, n: eq.checks.length }); guardar(); ctrlAbierto = false; repintar(); toast({ nivel: ok === eq.checks.length ? 'ok' : 'adv', t: 'Control registrado', d: ok === eq.checks.length ? `${eq.n}: ${ok}/${eq.checks.length} puntos conformes.` : `${eq.n}: ${eq.checks.length - ok} punto${eq.checks.length - ok > 1 ? 's' : ''} no conforme${eq.checks.length - ok > 1 ? 's' : ''}. ¿Cargamos un hallazgo?`, acc: ok === eq.checks.length ? [] : [{ t: 'Cargar hallazgo', fn: `SIMA_NFC.hallazgo('${id}')` }] }); },
    hallazgo(id) { const eq = eqDe(id); if (typeof elegirModulo === 'function') elegirModulo('ruta'); setTimeout(() => { if (typeof openCaptura === 'function') { openCaptura(null); setTimeout(() => { const d = $('fDesc'); if (d) { d.value = `${eq.n} (${eq.id}, ${eq.ubic}): `; d.dispatchEvent(new Event('input', { bubbles: true })); d.focus(); } }, 150); } }, 150); },
    alertas, responder: null, activo: demoOn,
    dato() { if (!demoOn()) return 'Probá si tu celular lee NFC'; const a = alertas(); return a.length ? `<b>${a.length}</b> ${a.length > 1 ? 'temas' : 'tema'} de mantenimiento` : `${EQ.length} equipos al día`; }
  };
  function simiDice(html) { if (window.simiAbrir) { simiAbrir(); setTimeout(() => { const log = $('simiLog'); if (log) { const d = document.createElement('div'); d.className = 'simi-msg bot'; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; } }, 450); } }

  /* ---------- SIMI en el chat ------------------------------------------ */
  const norm = t => ' ' + String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[¿?¡!.,;:]/g, ' ') + ' ';
  const NOMBRES = [['VAC-01', /\b(vaciadora|envasadora|vacio|vac 01)\b/], ['TER-01', /\b(termocontraible|termo contraible|termo|tunel termo)/], ['SEC-01', /\bsecador/], ['FLE-01', /\b(flejadora|fejadora|feljadora|flejes?)\b/], ['DM-01', /\b(detector|detector de metales|metales)\b/], ['RX-01', /\b(rayos x|rayo x|rx|rayos)\b/]];
  const tag = '<span class="simi-g-tag">✦ Seguimiento de equipos</span>';
  function resumenEq(eq) {
    const [, el] = estadoEquipo(eq), k = kpis(eq), p = proximoDe(eq), al = alertas().filter(a => a.eq === eq.id), u = eq.corr.filter(c => F(c[0]) <= Date.now()).slice(-1)[0];
    return `${tag}<p style="margin:6px 0 0"><b>${e(eq.n)}</b> (${eq.id}, ${e(eq.ubic)}): <b>${el}</b>. ${nf.format(horas(eq, Date.now()))} h de uso · disponibilidad ${nf1.format(k.disp)} % desde el 1/10.</p><ul class="simi-ul">
      ${p ? `<li><span>Próximo: ${e(p.it.t.toLowerCase())} el ${fechaL(p.prog ? p.prog.fecha : p.prox)}${p.horasProx ? ` (a las ${nf.format(p.horasProx)} h)` : ''}${p.prog ? ' · programado' : ''}.</span></li>` : ''}
      ${u ? `<li><span>Última falla: ${e(u[2].toLowerCase())} el ${fecha(F(u[0]))} (${u[1]} min de parada).</span></li>` : ''}
      ${k.verif ? `<li><span>Verificaciones de PCC: ${k.verif.ok} de ${k.verif.total}${k.verif.pend.length ? ` · <b>${k.verif.pend.length} pendiente</b>` : ''}.</span></li>` : ''}
      ${al.map(a => `<li><span><b>${e(a.t)}</b>. ${e(a.d)}</span></li>`).join('')}</ul>`;
  }
  function responder(texto) {
    if (!demoOn()) return null;
    const q = norm(texto), enMod = typeof modulo !== 'undefined' && modulo === 'nfc';
    if (/\b(si|ya) (hay|tenemos) filtros?\b|\bhay filtros\b|\btenemos filtros\b(?!\?)/.test(q) && !/\bno\b/.test(q) && !/\?/.test(texto)) { SIMA_NFC.filtro(true); return `${tag}<p style="margin:6px 0 0">Listo, lo programé. Te lo confirmo arriba.</p>`; }
    if (/\bno (hay|tenemos) filtros?\b/.test(q)) { SIMA_NFC.filtro(false); return `${tag}<p style="margin:6px 0 0">Entendido: pedí los filtros.</p>`; }
    const eqId = (NOMBRES.find(([, re]) => re.test(q)) || [])[0];
    if (!eqId && !enMod) return null;
    if (/\b(vence|vencen|proximos? mantenimientos?|esta semana|que toca|pendientes?|agenda)\b/.test(q) && !eqId) {
      const l = EQ.flatMap(eq => eq.plan.filter(i => i.tipo !== 'v').map(it => ({ eq, s: estadoItem(eq, it) }))).filter(x => x.s.prox && x.s.prox - Date.now() < 7 * DIA).sort((a, b) => a.s.prox - b.s.prox);
      return `${tag}<p style="margin:6px 0 0">En los próximos 7 días:</p><ul class="simi-ul">${l.map(({ eq, s }) => `<li><span><b>${fechaL(s.prog ? s.prog.fecha : s.prox)}</b> · ${e(eq.n)}: ${e(s.it.t.toLowerCase())}${s.prog ? ' (programado)' : s.estado === 'vencido' ? ' (<b>vencido</b>)' : ''}</span></li>`).join('') || '<li><span>Nada: el plan está al día.</span></li>'}</ul>`;
    }
    if (/\b(alertas?|avisos?|que tengo|problemas?|atencion)\b/.test(q) && !eqId) {
      const al = alertas();
      return al.length ? `${tag}<ul class="simi-ul">${al.map(a => `<li><span><b>${e(a.t)}</b>. ${e(a.d)}</span></li>`).join('')}</ul>` : `${tag}<p style="margin:6px 0 0">No hay alertas: los 6 equipos están al día.</p>`;
    }
    if (/\b(como funciona|lectura nfc|leer (la )?placa|placa nfc)\b/.test(q) && !eqId) return `${tag}<p style="margin:6px 0 0">Cada equipo tiene una placa con chip NFC. En un Android con Chrome, tocá <b>Leer placa NFC</b> y apoyá el celular: se abre la ficha del equipo y queda registrado tu paso. Desde ahí registrás el control del día o cargás un hallazgo con el equipo ya elegido.</p>`;
    if (!eqId) return null;
    const eq = eqDe(eqId);
    if (/\b(historial|historia|fallas?|correctivos?|que paso|reparaciones)\b/.test(q)) {
      const h = historial(eq).filter(x => x.k === 'corr' || x.k === 'prev').slice(0, 6);
      return `${tag}<p style="margin:6px 0 0"><b>${e(eq.n)}</b> · últimos registros:</p><ul class="simi-ul">${h.map(x => `<li><span><b>${fecha(x.t)}</b> · ${e(x.tit)}. ${e(x.det)}</span></li>`).join('')}</ul>`;
    }
    if (/\b(plan|mantenimientos?|cuando|calibra|proximo|frecuencia)\b/.test(q)) {
      return `${tag}<p style="margin:6px 0 0"><b>${e(eq.n)}</b> · plan de mantenimiento:</p><ul class="simi-ul">${eq.plan.map(it => { if (it.tipo === 'v') return `<li><span>${e(it.t)}: ${frec(it)}.</span></li>`; const s = estadoItem(eq, it); return `<li><span>${e(it.t)} (${frec(it)}): próximo el <b>${s.prox ? fechaL(s.prog ? s.prog.fecha : s.prox) : '—'}</b>${s.prog ? ', programado' : s.estado === 'vencido' ? ', <b>vencido</b>' : ''}.</span></li>`; }).join('')}</ul>`;
    }
    return resumenEq(eq);
  }
  window.SIMA_NFC.responder = responder;
  window.addEventListener('sima:demo', () => { sel = null; repintar(); });

  /* ---------- Estilos -------------------------------------------------- */
  const css = `
  .nfc-leer{display:inline-flex;align-items:center;gap:8px}.nfc-leer svg{width:18px;height:18px}
  .nfc-ayuda{color:var(--tx3);font-size:13px}
  .nfc-kpi{grid-template-columns:repeat(4,1fr)!important}
  .nfc-kpi.kpi5{grid-template-columns:repeat(5,1fr)!important;margin-top:16px}
  .nfc-al{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
  .nal{background:var(--s2);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:6px}
  .nal.crit{background:rgba(255,92,92,.09)}
  .nal-k{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--amber)}
  .nal.crit .nal-k{color:#FF7A7A}.nal.info .nal-k{color:var(--ice,#3FC5E8)}
  .nal-k svg{width:15px;height:15px}
  .nal b{font-size:14.5px;line-height:1.35}.nal p{margin:0;color:var(--tx2);font-size:13px;line-height:1.5}
  .nal-a{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;align-items:center}
  .nal-a button{height:32px;padding:0 12px;border-radius:999px;border:0;background:var(--s3);color:var(--tx);font:600 12.5px var(--sans);cursor:pointer}
  .nal-a button.pri{background:var(--amber);color:#1A1206}
  .nal-a button.lnk{background:transparent;color:var(--tx3)}
  .nal-mas{display:block;margin:10px auto 0;border:0;background:transparent;color:var(--tx2);font:600 13px var(--sans);cursor:pointer;padding:6px 12px;border-radius:999px}.nal-mas:hover{background:var(--s2)}
  .eq-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .eqc{display:flex;flex-direction:column;text-align:left;border:0;padding:0;cursor:pointer;font:inherit;color:var(--tx);background:var(--s1);border-radius:22px;overflow:hidden;box-shadow:var(--sh-card,none);transition:transform .18s cubic-bezier(.2,.7,.2,1),background .18s}
  @media (hover:hover){.eqc:hover{transform:translateY(-3px);background:var(--s2)}.eqc:hover img.ok{transform:scale(1.04)}}
  .eqc:focus-visible{outline:2px solid var(--amber);outline-offset:3px}
  .eqc-img{position:relative;display:block;aspect-ratio:4/3;background:radial-gradient(80% 70% at 50% 60%,rgba(255,255,255,.07),transparent 70%),linear-gradient(180deg,var(--s2),var(--s1))}
  html[data-theme="light"] .eqc-img{background:radial-gradient(80% 70% at 50% 60%,#fff,transparent 70%),linear-gradient(180deg,#E9EDF1,#F6F8FA)}
  .eqc-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:0;transition:opacity .4s,transform .4s}
  .eqc-img img.ok{opacity:1}
  .eqc-est{position:absolute;left:12px;top:12px;display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:999px;background:rgba(11,14,18,.72);backdrop-filter:blur(6px);font-size:12px;font-weight:600;color:#fff}
  .eqc-est i{width:8px;height:8px;border-radius:50%;background:var(--st-cerrado,#1FCB7E)}
  .eqc.proximo .eqc-est i,.eqc-est.proximo i{background:var(--amber)}.eqc.atencion .eqc-est i,.eqc-est.atencion i{background:#FF5C5C}
  .eqc-id{position:absolute;right:12px;top:12px;font-size:12px;font-weight:600;color:var(--tx3);font-variant-numeric:tabular-nums}
  .eqc-c{display:flex;flex-direction:column;gap:6px;padding:14px 16px 16px}
  .eqc-c>b{font-size:17px;letter-spacing:-.01em}.eqc-c>small{color:var(--tx3);font-size:13px;margin-top:-4px}
  .eqc-meta{display:flex;align-items:center;gap:6px;color:var(--tx2);font-size:12.5px}.eqc-meta svg{width:14px;height:14px;color:var(--tx3);flex-shrink:0}
  .eqc-prox{display:flex;align-items:flex-end;gap:8px;justify-content:space-between;margin-top:6px;font-size:13px}
  .eqc-prox span{display:flex;flex-direction:column;min-width:0}.eqc-prox small{color:var(--tx3);font-size:11.5px}
  .eqc-prox em{font-style:normal;font-weight:700;white-space:nowrap;color:var(--tx2)}
  .eqc-prox em.proximo{color:var(--amber)}.eqc-prox em.vencido{color:#FF7A7A}
  .eqc-bar{--c:var(--st-cerrado,#1FCB7E)}.eqc-bar.proximo{--c:var(--amber)}.eqc-bar.vencido{--c:#FF5C5C}
  .eqs{display:inline-flex;height:24px;align-items:center;padding:0 10px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap}
  .eqs.ok{background:rgba(31,203,126,.12);color:var(--st-cerrado,#1FCB7E)}.eqs.prox{background:rgba(255,159,28,.14);color:var(--amber)}
  .eqs.venc{background:rgba(255,92,92,.14);color:#FF7A7A}.eqs.prog{background:rgba(63,197,232,.14);color:var(--ice,#3FC5E8)}
  .eqd-top{display:grid;grid-template-columns:1.15fr 1fr;gap:16px}
  .eqd-3d{position:relative;min-height:400px;border-radius:24px;overflow:hidden;background:radial-gradient(70% 60% at 50% 55%,rgba(255,255,255,.08),transparent 70%),linear-gradient(180deg,var(--s2),var(--s1));box-shadow:var(--sh-card,none);cursor:grab;touch-action:none}
  html[data-theme="light"] .eqd-3d{background:radial-gradient(70% 60% at 50% 55%,#fff,transparent 70%),linear-gradient(180deg,#E6EBF0,#F7F9FB)}
  .eqd-3d:active{cursor:grabbing}
  .eq3d-canvas{position:absolute;inset:0;width:100%!important;height:100%!important;display:block}
  .eqd-hint{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);font-size:12px;color:var(--tx3);background:rgba(11,14,18,.5);padding:4px 10px;border-radius:999px;pointer-events:none;z-index:2}
  html[data-theme="light"] .eqd-hint{background:rgba(255,255,255,.7)}
  .eqd-3d .eqc-est{z-index:2}
  .eqd-info{display:flex;flex-direction:column;gap:10px}
  .eqd-info h2{margin:0;font-size:30px;letter-spacing:-.03em}.eqd-sub{margin:-4px 0 0;color:var(--tx2)}
  .eqd-datos{display:flex;flex-direction:column;gap:6px}.eqd-datos span{display:flex;align-items:center;gap:8px;color:var(--tx2);font-size:13.5px;font-variant-numeric:tabular-nums}.eqd-datos svg{width:16px;height:16px;color:var(--tx3)}
  .eqd-acc{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}.eqd-acc .btn svg{width:16px;height:16px}
  .eqd-simi{display:flex;gap:12px;background:var(--s1);border-radius:18px;padding:14px;box-shadow:var(--sh-card,none);margin-top:4px}
  .eqd-simi .simi-svg{width:40px;height:40px;flex-shrink:0}.eqd-simi b{font-size:14.5px}.eqd-simi p{margin:4px 0 0;color:var(--tx2);font-size:13px;line-height:1.5}
  .eq-ctrl{display:flex;flex-direction:column;gap:8px;background:var(--s1);border-radius:16px;padding:14px;box-shadow:var(--sh-card,none)}
  .eq-ctrl label{display:flex;gap:10px;align-items:center;font-size:13.5px;color:var(--tx2)}.eq-ctrl input{accent-color:var(--amber);width:18px;height:18px}
  .pl-acc{display:flex;gap:6px;flex-wrap:wrap}
  .eq-tabs{margin:16px 0 12px;max-width:560px}
  .h-tabla td small{display:block;color:var(--tx3);font-weight:500;font-size:12px;white-space:normal}
  .h-tabla td b{color:var(--tx)}
  .eq-hist{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column}
  .eq-hist li{position:relative;display:grid;grid-template-columns:110px 1fr;gap:2px 14px;padding:10px 0 10px 18px;border-top:1px solid var(--line)}
  .eq-hist li::before{content:"";position:absolute;left:0;top:16px;width:8px;height:8px;border-radius:50%;background:var(--violet,#8B7BF7)}
  .eq-hist li.corr::before{background:#FF5C5C}.eq-hist li.prev::before{background:var(--st-cerrado,#1FCB7E)}.eq-hist li.ctrl::before{background:var(--ice,#3FC5E8)}.eq-hist li.mal::before{background:#FF5C5C}
  .eq-hist time{grid-row:1/3;color:var(--tx3);font-size:12.5px;font-variant-numeric:tabular-nums;padding-top:1px}
  .eq-hist b{font-size:14px}.eq-hist span{color:var(--tx2);font-size:13px;line-height:1.45}
  .hf{margin-bottom:4px}
  .eq-ficha{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:0}
  .eq-ficha div{background:var(--s2);border-radius:14px;padding:12px 14px}.eq-ficha dt{color:var(--tx3);font-size:12px}.eq-ficha dd{margin:2px 0 0;font-weight:600;font-size:14px}
  @media (max-width:1100px){.eq-grid{grid-template-columns:repeat(2,1fr)}.nfc-kpi.kpi5{grid-template-columns:repeat(3,1fr)!important}}
  @media (max-width:900px){.eqd-top{grid-template-columns:1fr}.eqd-3d{min-height:320px}.nfc-al{grid-template-columns:1fr}}
  @media (max-width:640px){.eqc-img{aspect-ratio:16/10}.nfc-kpi.kpi5 .iot-kpi:last-child{grid-column:1/-1}
    .eq-det .h-tabla{overflow:visible}.eq-det .h-tabla table,.eq-det .h-tabla tbody,.eq-det .h-tabla tr{display:block;width:100%}.eq-det .h-tabla thead{display:none}
    .eq-det .h-tabla tr{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;padding:12px 0;border-top:1px solid var(--line)}.eq-det .h-tabla tr:first-child{border-top:0}
    .eq-det .h-tabla td{display:block;padding:0;border:0;font-size:13px;color:var(--tx2)}.eq-det .h-tabla td:first-child{flex:1 0 100%}.eq-det .h-tabla td:nth-child(3){display:none}.eq-det .h-tabla td:nth-child(4)::before{content:"Próxima ";color:var(--tx3)}.eq-det .h-tabla td:last-child{flex:1 0 100%}.eq-det .h-tabla td:empty{display:none}
    .eq-grid{grid-template-columns:1fr}.nfc-kpi,.nfc-kpi.kpi5{grid-template-columns:1fr 1fr!important}.eqd-3d{min-height:280px}.eq-ficha{grid-template-columns:1fr}.eq-hist li{grid-template-columns:1fr}.eq-hist time{grid-row:auto}.eqd-info h2{font-size:24px}.nfc-ayuda{display:none}}
  `;
  const st = document.createElement('style'); st.id = 'simaNfcCss'; st.textContent = css; document.head.appendChild(st);
})();
