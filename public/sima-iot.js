/* =====================================================================
   SIMA · Módulo 3 · Monitoreo Industrial 5.0 (IoT + IA)
   ---------------------------------------------------------------------
   Dos estados:
     · Sin fuente de datos: la conexión con Grafana está pendiente; se
       muestra qué hace falta y un botón para ver los datos de demostración.
     · Con datos de demostración (localStorage 'sima.iot.demo' = true):
       se activa en ese dispositivo para presentaciones. Los valores salen
       de un modelo determinístico de planta (mismo resultado en cualquier
       equipo) desde el lunes 9-11-26, más los desvíos que se prueban en
       vivo. Cuando se conecte Grafana, sólo cambia `valor()`: pantalla,
       reglas de alarma, avisos e IA quedan iguales.

   Equipos: 6 cámaras (4 de enfriado, 2 de congelado), 2 túneles de
   congelamiento, demanda eléctrica, agua, caudal y presión de vapor.

   Alarmas (ISA-18.2 / IEC 62682):
     · advertencia y alarma con dos umbrales; desvío sostenido 3 lecturas;
     · supresión por estado: descongelamiento y carga de túnel no alarman;
     · «sin datos» si un sensor deja de reportar; cierre al volver a rango;
     · reconocer, posponer 30 min (shelving) y escalamiento por niveles
       (técnico de turno → supervisor → jefe de planta y Calidad).

   SIMI analiza (IA aplicada a los sensores):
     · predicción del tiempo hasta el límite (tendencia);
     · anomalías contra lo habitual a esa hora aunque no haya alarma;
     · causa probable por correlación (puerta, compresor, vapor);
     · mantenimiento predictivo con el histórico (túnel que tarda más);
     · eficiencia por cabeza (energía, agua, vapor) y resumen del turno;
     · aprende de «Útil / No aplica» (ajusta la sensibilidad).
   ===================================================================== */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const e = s => (typeof esc === 'function' ? esc(s) : String(s == null ? '' : s));
  const TICK = 3000, SLOT = 15 * 60e3, MIN = 60e3, H = 3600e3, DIA = 864e5;
  const T0 = new Date(2026, 10, 9, 0, 0, 0).getTime();           // lunes 9-11-26 (el 10 fue martes)
  const nf = d => new Intl.NumberFormat('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const NF = [nf(0), nf(1), nf(2)];
  const p2 = n => String(n).padStart(2, '0');
  const hora = t => { const d = new Date(t); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  const horaS = t => { const d = new Date(t); return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; };
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const DIAS_C = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const inicioDia = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const claveDia = t => { const d = new Date(t); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
  const fechaC = t => { const d = new Date(t); return `${DIAS_C[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ls = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} } };

  /* ---------- Azar determinístico (mismos datos en cualquier equipo) -- */
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const r1 = k => rng(hash(k))() * 2 - 1;
  function ruido(id, t, paso = SLOT) { const k = Math.floor((t - T0) / paso), f = (t - T0) / paso - k; const a = r1(id + ':' + k), b = r1(id + ':' + (k + 1)); const s = f * f * (3 - 2 * f); return a + (b - a) * s; }

  /* ---------- Equipos y rangos -------------------------------------- */
  // aLo/aHi: advertencia · lo/hi: alarma. rTxt: cómo se muestra el rango.
  const S = [
    { id: 'c1', cat: 'camara', n: 'Cámara 1', sub: 'Medias reses', u: '°C', d: 1, sp: 1.9, aLo: 0, aHi: 4, lo: -2, hi: 6, rTxt: '0 a 4 °C' },
    { id: 'c2', cat: 'camara', n: 'Cámara 2', sub: 'Cortes', u: '°C', d: 1, sp: 1.5, aLo: 0, aHi: 4, lo: -2, hi: 6, rTxt: '0 a 4 °C' },
    { id: 'c3', cat: 'camara', n: 'Cámara 3', sub: 'Menudencias', u: '°C', d: 1, sp: 2.1, aLo: 0, aHi: 4, lo: -2, hi: 6, rTxt: '0 a 4 °C' },
    { id: 'c4', cat: 'camara', n: 'Cámara 4', sub: 'Despacho', u: '°C', d: 1, sp: 2.4, aLo: 0, aHi: 4, lo: -2, hi: 6, rTxt: '0 a 4 °C' },
    { id: 'c5', cat: 'congelado', n: 'Cámara 5', sub: 'Congelados', u: '°C', d: 1, sp: -20.3, aLo: -28, aHi: -18, lo: -32, hi: -15, rTxt: '−18 °C o menos', desc: [2, 8, 14, 20] },
    { id: 'c6', cat: 'congelado', n: 'Cámara 6', sub: 'Congelados', u: '°C', d: 1, sp: -19.9, aLo: -28, aHi: -18, lo: -32, hi: -15, rTxt: '−18 °C o menos', desc: [3, 9, 15, 21] },
    { id: 't1', cat: 'tunel', n: 'Túnel 1', sub: 'Cajas de cortes', u: '°C', d: 1, sp: -33.5, aLo: -45, aHi: -28, lo: -50, hi: -24, rTxt: '−28 °C o menos', carga: 15, tau: 1.15, deg: 0 },
    { id: 't2', cat: 'tunel', n: 'Túnel 2', sub: 'Menudencias', u: '°C', d: 1, sp: -34, aLo: -45, aHi: -28, lo: -50, hi: -24, rTxt: '−28 °C o menos', carga: 16.5, tau: 1.05, deg: 0.075 },
    { id: 'en', cat: 'energia', n: 'Demanda eléctrica', sub: 'Toda la planta', u: 'kW', d: 0, aLo: -1, aHi: 1100, lo: -1, hi: 1200, rTxt: 'hasta 1.100 kW (contratado 1.200)' },
    { id: 'ag', cat: 'agua', n: 'Caudal de agua', sub: 'Toda la planta', u: 'm³/h', d: 0, aLo: -1, aHi: 60, lo: -1, hi: 70, rTxt: 'hasta 60 m³/h (máximo 70)' },
    { id: 'vf', cat: 'vapor', n: 'Caudal de vapor', sub: 'Caldera 1 · 8 t/h', u: 't/h', d: 1, aLo: -1, aHi: 6.5, lo: -1, hi: 7.5, rTxt: 'hasta 6,5 t/h (caldera 8 t/h)' },
    { id: 'pv', cat: 'presion', n: 'Presión de vapor', sub: 'Colector principal', u: 'bar', d: 1, aLo: 8, aHi: 10.3, lo: 7.2, hi: 10.8, rTxt: '8 a 10,3 bar' }
  ];
  const sen = id => S.find(s => s.id === id);
  const fmt = (s, v) => v == null ? '—' : NF[s.d].format(v) + ' ' + s.u;

  /* ---------- Modelo de planta --------------------------------------- */
  const hDe = t => { const d = new Date(t); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; };
  function prod(t) { const d = new Date(t), h = hDe(t); if (d.getDay() === 0) return 0; return clamp((h - 5.5) / 1, 0, 1) * clamp((22 - h) / 0.5, 0, 1); }
  function limpieza(t) { const d = new Date(t), h = hDe(t); return (d.getDay() !== 0 && h >= 22) ? clamp((h - 22) / 0.25, 0, 1) * clamp((24 - h) / 0.25, 0, 1) : 0; }
  function cabezas(t) { const d = new Date(t); if (d.getDay() === 0) return 0; const r = rng(hash('cab' + claveDia(t)))(); return d.getDay() === 6 ? 300 + Math.round(r * 60) : 440 + Math.round(r * 110); }
  function descShape(s, t) { const h = hDe(t); for (const x of s.desc) { const dh = h - x; if (dh >= 0 && dh < 0.6) return dh < 0.2 ? dh / 0.2 : Math.exp(-(dh - 0.2) / 0.12); } return 0; }
  function tunel(s, t) {
    const h = hDe(t);
    let dt = h - s.carga, dia = inicioDia(t);
    if (dt < 0) { dt += 24; dia -= DIA; }
    if (new Date(dia + 2 * H).getDay() === 0) dt += 24;               // el domingo no se carga
    const dias = Math.max(0, (dia - T0) / DIA);
    const tau = s.tau * (1 + s.deg * dias);
    return { dt, tau, v: s.sp + (-9 - s.sp) * Math.exp(-dt / tau) };
  }

  /* Eventos: desvíos del histórico (determinísticos por día) y en vivo */
  const TIPOS = {
    puerta: { t: 'Puerta abierta', sids: ['c1', 'c2', 'c3', 'c4'] },
    compresor: { t: 'Falla de compresor (circuito de enfriado)', sids: ['c1'] },
    tunel_lento: { t: 'Túnel que no llega a temperatura', sids: ['t1', 't2'] },
    pico: { t: 'Pico de demanda eléctrica', sids: ['en'] },
    agua_alta: { t: 'Consumo de agua anómalo', sids: ['ag'] },
    vapor_alto: { t: 'Demanda de vapor alta y caída de presión', sids: ['vf'] },
    sindatos: { t: 'Sensor sin datos', sids: ['c4', 'c6', 'ag'] }
  };
  function efectoDe(ev, sid, t) {
    if (t < ev.t0) return 0;
    const sube = clamp((t - ev.t0) / ev.ramp, 0, 1), baja = t > ev.t1 ? Math.exp(-(t - ev.t1) / ev.ramp) : 1;
    const f = sube * baja; if (f < 0.01) return 0;
    switch (ev.tipo) {
      case 'puerta': return sid === ev.sid ? 6.8 * ev.mag * f : 0;
      case 'compresor': return ['c1', 'c2', 'c3'].includes(sid) ? 4.2 * ev.mag * f : sid === 'en' ? -140 * f : 0;
      case 'tunel_lento': return sid === ev.sid ? 9.5 * ev.mag * f : 0;
      case 'pico': return sid === 'en' ? 270 * ev.mag * f : 0;
      case 'agua_alta': return sid === 'ag' ? 30 * ev.mag * f : 0;
      case 'vapor_alto': return sid === 'vf' ? 2.8 * ev.mag * f : sid === 'pv' ? -1.9 * ev.mag * f : 0;
    }
    return 0;
  }
  const histCache = {};
  function eventosDia(dia) {
    const k = claveDia(dia);
    if (histCache[k]) return histCache[k];
    const r = rng(hash('ev' + k)), out = [], dow = new Date(dia + 2 * H).getDay();
    const n = dow === 0 ? 0 : 1 + Math.floor(r() * 2.7);
    const bolsa = ['puerta', 'puerta', 'puerta', 'tunel_lento', 'pico', 'agua_alta', 'vapor_alto', 'sindatos', 'compresor'];
    for (let i = 0; i < n; i++) {
      const tipo = bolsa[Math.floor(r() * bolsa.length)], sids = TIPOS[tipo].sids, sid = sids[Math.floor(r() * sids.length)];
      const t0 = dia + (6.5 + r() * 14.5) * H, dur = (0.45 + r() * 0.75) * H;
      out.push({ tipo, sid, t0, t1: t0 + dur, ramp: 9 * MIN, mag: 0.9 + r() * 0.35, ackMin: 1 + Math.floor(r() * 13), hist: true, id: k + '-' + i });
    }
    return (histCache[k] = out);
  }
  let vivos = ls.get('sima.iot.vivos', []).filter(v => v.t1 > Date.now() - 2 * DIA);
  function eventosEn(t) {
    const d = inicioDia(t);
    return [...eventosDia(d - DIA), ...eventosDia(d), ...vivos].filter(ev => ev.t0 <= t && t < ev.t1 + 6 * ev.ramp);
  }

  /* Valor de un sensor en un instante (acá se conectará Grafana) */
  function valor(s, t, vivo) {
    const evs = eventosEn(t);
    if (evs.some(ev => ev.tipo === 'sindatos' && ev.sid === s.id && t >= ev.t0 + (ev.hist ? 2 * MIN : 0) && t <= ev.t1)) return null;
    const p = prod(t), lim = limpieza(t), n = ruido(s.id, t) + (vivo ? 0.35 * ruido(s.id + 'v', t, 9e3) : 0);
    let v;
    switch (s.cat) {
      case 'camara': v = s.sp + 0.3 * Math.sin((hDe(t) - 15) / 24 * 2 * Math.PI) + n * 0.17 + (s.id === 'c4' ? 0.8 * p * (hDe(t) < 14 ? 1 : 0.3) : 0) + (s.id === 'c1' ? 0.4 * p : 0); break;
      case 'congelado': v = s.sp + n * 0.35 + 7.8 * descShape(s, t); break;
      case 'tunel': v = tunel(s, t).v + n * 0.45; break;
      case 'energia': { const cargas = ['t1', 't2'].reduce((a, id) => a + (tunel(sen(id), t).dt < 3 ? 1 : 0), 0); v = 540 + 420 * p + 95 * lim + 105 * cargas + 40 * Math.sin(hDe(t) * 1.3) + n * 28; break; }
      case 'agua': v = 9 + 44 * p + 56 * lim + n * 3; break;
      case 'vapor': v = 0.9 + 3.6 * p + 4.0 * lim + n * 0.25; break;
      case 'presion': { const f = valor(sen('vf'), t, vivo); v = 9.6 - 0.22 * ((f == null ? 3 : f) - 1) + n * 0.1; break; }
    }
    for (const ev of evs) v += efectoDe(ev, s.id, t);
    return v;
  }
  function estadoProceso(s, t) {
    if (s.cat === 'congelado' && descShape(s, t) > 0.04) return 'desc';
    if (s.cat === 'tunel' && tunel(s, t).dt < 2.6) return 'carga';
    return '';
  }
  const puertaAbierta = (s, t) => eventosEn(t).some(ev => ev.tipo === 'puerta' && ev.sid === s.id && t <= ev.t1);
  function sevDe(s, v) {
    if (v == null) return '';
    if (v > s.hi || v < s.lo) return 'crit';
    if (v > s.aHi || v < s.aLo) return 'adv';
    return '';
  }

  /* ---------- Estado de la demostración y el motor en vivo ----------- */
  let demo = window.SIMA_DEMO ? SIMA_DEMO.on() : ls.get('sima.iot.demo', false);
  let auto = ls.get('sima.iot.auto', true), voz = ls.get('sima.iot.voz', false);
  const sens = ls.get('sima.iot.sens', { prediccion: 1, anomalia: 1, causa: 1, mant: 1, efic: 1 });
  const descartes = {};
  let tab = 'vivo', ticks = 0, timer = null, ultimo = 0;
  const vivo = {};                         // sid → {v, st, cuenta, dentro, off}
  let alarmas = ls.get('sima.iot.alarmas', []).filter(a => !a.fin && a.t0 > Date.now() - DIA);
  const alHist = ls.get('sima.iot.alhist', []).filter(a => a.t0 > T0);
  const guardar = () => { ls.set('sima.iot.vivos', vivos); ls.set('sima.iot.alarmas', alarmas); ls.set('sima.iot.alhist', alHist.slice(0, 200)); };

  function probar(tipo, sid) {
    const ahora = Date.now(), T = TIPOS[tipo]; if (!T) return;
    sid = sid || T.sids[Math.floor(Math.random() * T.sids.length)];
    if (vivos.some(v => v.t1 > ahora && (v.sid === sid || v.tipo === tipo))) return false;
    vivos.push({ tipo, sid, t0: ahora, t1: ahora + (tipo === 'sindatos' ? 75e3 : 120e3 + Math.random() * 40e3), ramp: 45e3, mag: 0.95 + Math.random() * 0.2, vivo: true, id: 'v' + ahora });
    guardar(); paso(true); return true;
  }

  const POLITICA = [
    { n: 1, min: 0, rol: 'Técnico de turno', canales: ['App', 'WhatsApp'] },
    { n: 2, min: 10, rol: 'Supervisor de mantenimiento', canales: ['WhatsApp', 'Llamada'] },
    { n: 3, min: 20, rol: 'Jefe de planta y Calidad', canales: ['Correo', 'WhatsApp'] }
  ];
  const nivelesDe = a => POLITICA.filter(p => a.sev === 'crit' || p.n < 3);

  function paso(forzado) {
    ticks++;
    const ahora = Date.now();
    if (auto && !forzado && !vivos.some(v => v.t1 > ahora) && (ticks === 5 || (ticks > 12 && Math.random() < 0.035))) {
      probar(ticks === 5 ? 'puerta' : ['puerta', 'tunel_lento', 'pico', 'agua_alta', 'vapor_alto', 'compresor', 'sindatos'][Math.floor(Math.random() * 7)]);
      return;
    }
    S.forEach(s => {
      const v = valor(s, ahora, true), st = estadoProceso(s, ahora);
      const x = vivo[s.id] || (vivo[s.id] = { cuenta: 0, dentro: 0, off: 0 });
      x.v = v; x.st = st;
      let act = alarmas.find(al => al.sid === s.id && !al.fin);
      if (v == null) { x.off++; if (x.off >= 3 && !act) nueva(s, 'sindatos', 'adv', ahora, null); return; }
      x.off = 0;
      if (act && act.tipo === 'sindatos') { cerrar(act, s, ahora); act = null; }
      const sev = st ? '' : sevDe(s, v);
      if (sev) { x.cuenta++; x.dentro = 0; } else { x.dentro++; x.cuenta = 0; }
      if (sev && x.cuenta >= 3) {
        if (!act) nueva(s, 'rango', sev, ahora, v);
        else {
          const mid = (s.aHi + s.aLo) / 2;
          if (act.pico == null || Math.abs(v - mid) > Math.abs(act.pico - mid)) act.pico = v;
          if (sev === 'crit' && act.sev === 'adv') { act.sev = 'crit'; avisar(act, s, true); }
        }
      } else if (!sev && act && x.dentro >= 2) cerrar(act, s, ahora);
    });
    vivos = vivos.filter(v => v.t1 > ahora - 2 * DIA);
    if (ticks % 5 === 0) guardar();
    ultimo = ahora;
    if (typeof view !== 'undefined' && view === 'iot' && $('iotRoot')) pintarVivo();
  }
  function nueva(s, tipo, sev, t, v) {
    const ev = eventosEn(t).find(x => x.sid === s.id || (x.tipo === 'compresor' && ['c1', 'c2', 'c3'].includes(s.id)) || (x.tipo === 'vapor_alto' && s.id === 'pv'));
    const a = { id: s.id + '-' + t, sid: s.id, tipo, sev, t0: t, pico: v, ack: null, pospuesta: 0, evento: ev ? ev.tipo : '' };
    alarmas.push(a); guardar(); avisar(a, s, false);
  }
  function cerrar(a, s, t) {
    a.fin = t; alarmas = alarmas.filter(x => x !== a);
    alHist.unshift({ ...a }); guardar();
    if (!a.pospuesta || a.pospuesta < t) toast({ sev: 'ok', titulo: `${s.n} volvió a rango`, txt: `Ahora marca ${fmt(s, vivo[s.id] && vivo[s.id].v)}. La alarma quedó registrada en el historial.`, sid: s.id });
  }

  /* ---------- Textos de SIMI ----------------------------------------- */
  const QUE_REVISAR = {
    puerta: ['Cerrá la puerta y verificá que el burlete selle en todo el marco.', 'Revisá que la cortina de PVC esté completa y que ninguna carga trabe la puerta.', 'Si estuvo abierta más de 30 minutos, avisá a Calidad para evaluar el producto.'],
    camara: ['Que la puerta cierre bien y el burlete selle.', 'Que el evaporador no tenga hielo y los ventiladores giren.', 'Presión de succión y estado del compresor del circuito.', 'Si sigue subiendo más de 30 minutos, avisá a Calidad para evaluar el producto.'],
    compresor: ['Varias cámaras del mismo circuito suben juntas: revisá el compresor y el tablero del circuito de enfriado.', 'Presiones de succión y descarga, nivel de aceite y alarmas del controlador.', 'Si no arranca, pasá las cámaras críticas al circuito de respaldo.', 'Avisá a Calidad si alguna cámara supera 6 °C.'],
    congelado: ['Que la puerta no haya quedado abierta y el burlete no esté congelado o roto.', 'Que no esté descongelando fuera de horario.', 'Presión de succión y funcionamiento del compresor del circuito.', 'Si supera −15 °C, avisá a Calidad: el producto congelado puede perder la cadena de frío.'],
    tunel: ['Que el túnel no esté sobrecargado y las cajas no tapen el flujo de aire.', 'Que todos los ventiladores del evaporador funcionen.', 'Escarcha en el evaporador: si tarda cada vez más en bajar, programá el descarche.', 'Presión de succión y nivel de amoníaco del circuito.'],
    energia: ['Escalonar el arranque de compresores para no sumar picos.', 'Postergar cargas no críticas (bombas de lavado, compresores de aire de reserva).', 'Revisar equipos funcionando fuera de turno.', 'Si se repite, revisar el factor de potencia y el banco de capacitores.'],
    agua: ['Mangueras abiertas sin uso en faena o lavado.', 'Pérdidas en válvulas, flotantes de tanques o duchas de higienización.', 'Boquillas de lavado gastadas (más caudal del necesario).', 'Si pasa fuera de producción, buscá una fuga recorriendo los medidores por sector.'],
    vapor: ['Purgas o válvulas abiertas de más en esterilizadores y tanques de agua caliente.', 'Trampas de vapor trabadas abiertas (pierden vapor vivo).', 'Fugas visibles en la línea y el colector.', 'Que la caldera no esté trabajando al límite: escalonar los consumos grandes.'],
    presion: ['Demanda de vapor por encima de lo que entrega la caldera: escalonar consumos.', 'Fugas o purgas abiertas en la línea.', 'Combustión y nivel de agua de la caldera.', 'Con menos de 7 bar, los esterilizadores pueden no llegar a 82 °C: avisá a Calidad.'],
    sindatos: ['Batería del sensor (los inalámbricos duran unos 3 años).', 'Señal con el gateway: puertas metálicas o carga nueva pueden taparla.', 'Que el gateway esté encendido y con red.', 'Mientras tanto, controlá con el display del controlador del equipo.']
  };
  function revisarDe(a, s) {
    if (a.tipo === 'sindatos') return QUE_REVISAR.sindatos;
    if (a.evento === 'puerta') return QUE_REVISAR.puerta;
    if (a.evento === 'compresor') return QUE_REVISAR.compresor;
    return QUE_REVISAR[s.cat] || QUE_REVISAR.camara;
  }
  function fraseAlarma(a, s) {
    if (a.tipo === 'sindatos') return `${s.n} (${s.sub}) no reporta desde las ${hora(a.t0)}.`;
    const v = vivo[s.id] && vivo[s.id].v;
    const dir = s.cat === 'tunel' ? 'no llega a temperatura' : s.cat === 'presion' && v != null && v < s.aLo ? 'tiene la presión baja' : v != null && v < s.aLo ? 'está por debajo del rango' : 'está por encima del rango';
    const causa = a.evento === 'puerta' ? ' La puerta figura abierta.' : a.evento === 'compresor' ? ' Otras cámaras del circuito también suben.' : '';
    return `${s.n} (${s.sub}) ${dir}: marca ${fmt(s, v)} (rango ${s.rTxt}). Desde las ${hora(a.t0)}.${causa}`;
  }

  /* ---------- Aviso emergente de SIMI --------------------------------- */
  let toastT = null;
  function avisar(a, s, escalo) {
    if (Date.now() < (a.pospuesta || 0)) return;
    toast({ sev: a.sev === 'crit' ? 'crit' : 'adv', titulo: `${escalo ? 'Empeoró · ' : ''}${a.tipo === 'sindatos' ? 'Sensor sin datos' : a.sev === 'crit' ? 'Alarma' : 'Advertencia'} · ${s.n}`, txt: fraseAlarma(a, s), sid: s.id, alarma: a.id });
    const fs = document.querySelector('#simiFab .simi-svg');
    if (window.SIMI_M && fs) SIMI_M.humor(fs, 'alerta', 2600);
    try { if (a.sev === 'crit' && navigator.vibrate) navigator.vibrate([120, 80, 120]); } catch (_) {}
    if (voz && 'speechSynthesis' in window) { try { const u = new SpeechSynthesisUtterance(`${a.sev === 'crit' ? 'Alarma' : 'Atención'}. ${fraseAlarma(a, s)}`); u.lang = 'es-AR'; u.rate = 1.02; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (_) {} }
  }
  function toast({ sev, titulo, txt, sid, alarma }) {
    if (typeof modulo !== 'undefined' && modulo !== 'iot') return;
    let t = $('iotToast');
    if (!t) { t = document.createElement('div'); t.id = 'iotToast'; t.setAttribute('role', 'alert'); document.body.appendChild(t); }
    t.className = 'iot-toast ' + sev;
    t.innerHTML = `${window.SIMI_M ? SIMI_M.svg(sev === 'ok' ? 'h-feliz' : 'h-alerta') : ''}
      <div class="it-c"><small>SIMI · ${hora(Date.now())}</small><b>${e(titulo)}</b><p>${e(txt)}</p>
      <div class="it-a">${alarma ? `<button type="button" class="it-b pri" onclick="SIMA_IOT.preguntar('${sid}')">¿Qué reviso?</button><button type="button" class="it-b" onclick="SIMA_IOT.reconocer('${alarma}')">Reconocer</button>` : ''}<button type="button" class="it-b" onclick="SIMA_IOT.ver('${sid}')">Ver</button></div></div>
      <button type="button" class="it-x" aria-label="Cerrar aviso" onclick="this.parentNode.classList.remove('show')">×</button>`;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), sev === 'ok' ? 6000 : 15000);
  }

  /* ---------- Agregados diarios e históricos -------------------------- */
  const aggCache = {};
  function agregados(dia) {
    const k = claveDia(dia), hoy = inicioDia(Date.now()) === dia;
    if (aggCache[k] && (!hoy || Date.now() - aggCache[k].calc < 60e3)) return aggCache[k];
    const fin = Math.min(dia + DIA, Date.now());
    let kwh = 0, m3 = 0, tv = 0, frioOk = 0, frioN = 0, slots = 0;
    for (let t = dia; t < fin; t += SLOT) {
      slots++;
      kwh += (valor(sen('en'), t) || 0) * 0.25; m3 += (valor(sen('ag'), t) || 0) * 0.25; tv += (valor(sen('vf'), t) || 0) * 0.25;
      for (const s of S) if (s.cat === 'camara' || s.cat === 'congelado') { if (estadoProceso(s, t)) continue; const v = valor(s, t); if (v == null) continue; frioN++; if (!sevDe(s, v)) frioOk++; }
    }
    const cab = hoy ? Math.round(cabezas(dia) * clamp((Date.now() - dia - 6 * H) / (15 * H), 0, 1)) : cabezas(dia);
    const nHist = eventosDia(dia).filter(ev => ev.t0 + 15 * MIN <= Date.now()).length;
    const nVivas = alHist.filter(a => inicioDia(a.t0) === dia).length + alarmas.filter(a => inicioDia(a.t0) === dia).length;
    const t2 = sen('t2'), tauDia = tunel(t2, dia + 20 * H).tau;
    const bajada = -tauDia * Math.log((-28 - t2.sp) / (-9 - t2.sp));
    return (aggCache[k] = { dia, k, kwh, m3, tv, cab, frio: frioN ? frioOk / frioN * 100 : 100, alarmas: nHist + nVivas, bajadaT2: bajada, parcial: hoy, calc: Date.now(), horas: slots / 4 });
  }
  function diasDisponibles() { const out = []; for (let d = T0; d <= inicioDia(Date.now()); d += DIA) out.push(inicioDia(d + 2 * H)); return [...new Set(out)]; }

  function alarmasHistoricas() {
    const out = [];
    for (const d of diasDisponibles()) for (const ev of eventosDia(d)) {
      if (ev.t0 + 15 * MIN > Date.now()) continue;
      const s = sen(ev.tipo === 'compresor' ? 'c2' : ev.tipo === 'vapor_alto' ? 'pv' : ev.sid);
      let pico = null; const mid = (s.aHi + s.aLo) / 2;
      if (ev.tipo !== 'sindatos') for (let t = ev.t0; t <= ev.t1 + ev.ramp; t += 5 * MIN) { const v = valor(s, t); if (v != null && (pico == null || Math.abs(v - mid) > Math.abs(pico - mid))) pico = v; }
      const sev = ev.tipo === 'sindatos' ? 'sindatos' : (sevDe(s, pico) || 'adv');
      out.push({ t0: ev.t0 + 12 * MIN, fin: ev.t1, sid: s.id, tipo: ev.tipo, sev, pico, ackMin: ev.ackMin, nivel: ev.ackMin >= 20 && sev === 'crit' ? 3 : ev.ackMin >= 10 ? 2 : 1 });
    }
    for (const a of alHist.concat(alarmas)) out.push({ t0: a.t0, fin: a.fin, sid: a.sid, tipo: a.evento || (a.tipo === 'sindatos' ? 'sindatos' : 'rango'), sev: a.tipo === 'sindatos' ? 'sindatos' : a.sev, pico: a.pico, ackMin: a.ack ? Math.round((a.ack.t - a.t0) / MIN) : null, nivel: a.ack ? (a.ack.t - a.t0 >= 20 * MIN ? 3 : a.ack.t - a.t0 >= 10 * MIN ? 2 : 1) : Math.max(1, nivelesDe(a).filter(p => (a.fin || Date.now()) - a.t0 >= p.min * MIN).length) });
    return out.sort((x, y) => y.t0 - x.t0);
  }

  /* ---------- SIMI analiza (IA sobre los sensores) -------------------- */
  function pendiente(s, t) { const a = valor(s, t, false), b = valor(s, t - 40e3, false); if (a == null || b == null) return 0; return (a - b) / 40; }   // unidades por segundo
  function habitual(s, t) { const v = [1, 2, 3].map(k => valor(s, t - k * DIA)).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }
  function insights() {
    const ahora = Date.now(), out = [];
    const quitar = k => descartes[k] && descartes[k] > ahora;
    // 1) Predicción: en rango pero yendo hacia el límite
    for (const s of S) {
      const x = vivo[s.id]; if (!x || x.v == null || x.st) continue;
      if (alarmas.some(a => a.sid === s.id)) continue;
      const m = pendiente(s, ahora); if (Math.abs(m) < 1e-6) continue;
      const lim = m > 0 ? s.aHi : s.aLo; if (lim < -900 || lim === -1) continue;
      const eta = (lim - x.v) / m;
      if (eta > 0 && eta < 25 * 60 * sens.prediccion) {
        const k = 'pred-' + s.id; if (quitar(k)) continue;
        const cuando = eta < 60 ? 'en menos de 1 minuto' : `en unos ${Math.round(eta / 60)} min`;
        out.push({ k, tipo: 'prediccion', pri: 1, sid: s.id, t: `${s.n} va a salir de rango ${cuando}`, d: `Marca ${fmt(s, x.v)} y viene ${m > 0 ? 'subiendo' : 'bajando'}. Si sigue así, cruza ${NF[s.d].format(lim)} ${s.u}. Revisarlo ahora evita la alarma.` });
      }
    }
    // 2) Causa probable por correlación
    const subenEnf = ['c1', 'c2', 'c3', 'c4'].filter(id => { const x = vivo[id]; return x && x.v != null && pendiente(sen(id), ahora) > 0.012; });
    if (subenEnf.length >= 2 && !quitar('causa-circ')) out.push({ k: 'causa-circ', tipo: 'causa', pri: 0, sid: subenEnf[0], t: `${subenEnf.length} cámaras suben al mismo tiempo`, d: `${subenEnf.map(id => sen(id).n).join(', ')} comparten el circuito de enfriado y bajó la demanda de los compresores: es más probable una falla de compresor que puertas abiertas.` });
    const pv = vivo.pv, vf = vivo.vf;
    if (pv && vf && pv.v != null && vf.v != null && pv.v < 8.4 && vf.v > 5.5 && !quitar('causa-vapor')) out.push({ k: 'causa-vapor', tipo: 'causa', pri: 0, sid: 'pv', t: 'La presión de vapor cae porque sube el consumo', d: `Se piden ${fmt(sen('vf'), vf.v)} y el colector bajó a ${fmt(sen('pv'), pv.v)}. Revisá purgas abiertas y trampas de vapor antes de exigir más a la caldera.` });
    // 3) Anomalías contra lo habitual a esta hora (sin alarma)
    for (const id of ['ag', 'en', 'vf']) {
      const s = sen(id), x = vivo[id]; if (!x || x.v == null || alarmas.some(a => a.sid === id)) continue;
      const hab = habitual(s, ahora); if (!hab) continue;
      const dif = (x.v - hab) / hab;
      if (Math.abs(dif) > 0.22 / sens.anomalia && !quitar('anom-' + id)) out.push({ k: 'anom-' + id, tipo: 'anomalia', pri: 2, sid: id, t: `${s.n}: ${Math.round(Math.abs(dif) * 100)} % ${dif > 0 ? 'más' : 'menos'} que lo habitual a esta hora`, d: `Ahora ${fmt(s, x.v)}; los últimos 3 días a esta hora el promedio fue ${fmt(s, hab)}. Todavía está dentro del rango, pero conviene mirarlo.` });
    }
    // 4) Mantenimiento predictivo con el histórico
    const dias = diasDisponibles();
    if (dias.length >= 2 && !quitar('mant-t2')) {
      const a0 = agregados(dias[0]).bajadaT2, a1 = agregados(dias[dias.length - 1]).bajadaT2, cre = (a1 - a0) / a0;
      if (cre > 0.08 / sens.mant) out.push({ k: 'mant-t2', tipo: 'mant', pri: 2, sid: 't2', t: `Túnel 2 tarda ${Math.round(cre * 100)} % más en llegar a −28 °C que el ${DIAS[new Date(dias[0]).getDay()].toLowerCase()}`, d: `Pasó de ${NF[1].format(a0)} h a ${NF[1].format(a1)} h después de cada carga. Es la firma típica de escarcha en el evaporador o un ventilador débil: conviene programar descarche e inspección antes de que falle.`, crear: 'Túnel 2: tarda cada vez más en llegar a −28 °C después de la carga. Revisar escarcha del evaporador y ventiladores; programar descarche.' });
    }
    // 5) Eficiencia por cabeza
    const hoy = agregados(inicioDia(ahora)), prev = dias.slice(0, -1).map(agregados).filter(a => a.cab > 0);
    if (hoy.cab > 50 && prev.length && !quitar('efic')) {
      const base = prev.reduce((x, a) => x + a.kwh / a.cab, 0) / prev.length, hoyK = hoy.kwh / hoy.cab;
      const dif = (hoyK - base) / base;
      if (Math.abs(dif) > 0.04 / sens.efic) out.push({ k: 'efic', tipo: 'efic', pri: 3, sid: 'en', t: `Energía por cabeza: ${dif > 0 ? '+' : ''}${Math.round(dif * 100)} % frente al promedio`, d: `Hoy va ${NF[1].format(hoyK)} kWh por cabeza; el promedio desde el lunes es ${NF[1].format(base)} kWh. ${dif > 0 ? 'Revisar equipos encendidos fuera de turno y arranques simultáneos de compresores.' : 'Buen día: se puede tomar como referencia.'}` });
    }
    return out.sort((a, b) => a.pri - b.pri).slice(0, 4);
  }

  /* ---------- Dibujo: pestaña En vivo -------------------------------- */
  const EST = { ok: ['En rango', 'ok'], adv: ['Advertencia', 'adv'], crit: ['Alarma', 'crit'], off: ['Sin datos', 'off'], desc: ['Descongelando', 'desc'], carga: ['En carga', 'desc'] };
  function estDe(s) {
    const x = vivo[s.id]; if (!x) return 'ok';
    if (x.v == null) return x.off >= 3 ? 'off' : 'ok';
    if (x.st) return x.st;
    const a = alarmas.find(al => al.sid === s.id); return a ? (a.tipo === 'sindatos' ? 'off' : a.sev) : 'ok';
  }
  // Límites que se dibujan: el superior siempre; el inferior sólo donde existe de verdad.
  const limLo = s => (s.cat === 'camara' || s.id === 'pv') ? s.aLo : null;
  function escala(lo, hi, n) {               // escala con números redondos
    const paso0 = (hi - lo) / n || 1, mag = Math.pow(10, Math.floor(Math.log10(paso0))), r = paso0 / mag;
    const paso = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
    const a = Math.floor(lo / paso) * paso, b = Math.ceil(hi / paso) * paso, ticks = [];
    for (let v = a; v <= b + paso / 2; v += paso) ticks.push(+v.toFixed(6));
    return { lo: a, hi: b, ticks, paso };
  }
  const fmtLim = (s, v) => `${NF[Number.isInteger(v) ? 0 : s.d].format(v)} ${s.u}`;
  function chispa(s, t) {
    const W = 300, Hh = 56, N = 40, pts = [];
    for (let i = N; i >= 0; i--) pts.push(i === 0 && vivo[s.id] ? vivo[s.id].v : valor(s, t - i * 60e3, false));
    const v = pts.filter(x => x != null); if (!v.length) return '<div class="iot-spw"></div>';
    const lL = limLo(s);
    let lo = Math.min(...v, lL != null ? lL : Infinity), hi = Math.max(...v, s.aHi);
    if (s.cat === 'energia' || s.cat === 'agua' || s.cat === 'vapor') lo = Math.min(...v) * 0.85;
    const pad = (hi - lo) * 0.14 || 1; lo -= pad; hi += pad;
    const yp = val => (1 - (val - lo) / (hi - lo)) * 100;                 // % del alto
    const X = i => (i / N * W).toFixed(1), Y = val => (yp(val) / 100 * Hh).toFixed(1);
    let linea = '', area = '', pen = false, x0 = null, xl = null;
    pts.forEach((val, i) => {
      if (val == null) { if (pen) area += `L${xl},${Hh}L${x0},${Hh}Z`; pen = false; return; }
      linea += `${pen ? 'L' : 'M'}${X(i)},${Y(val)}`;
      area += pen ? `L${X(i)},${Y(val)}` : `M${X(i)},${Hh}L${X(i)},${Y(val)}`;
      if (!pen) x0 = X(i); xl = X(i); pen = true;
    });
    if (pen) area += `L${xl},${Hh}L${x0},${Hh}Z`;
    const ult = pts[pts.length - 1] != null ? pts[pts.length - 1] : v[v.length - 1], gid = 'gsp' + s.id;
    const lim = (val, cls) => `<line x1="0" x2="${W}" y1="${Y(val)}" y2="${Y(val)}" class="iot-lim ${cls}"/>`;
    const etq = (val, abajo) => `<span class="iot-lime${abajo ? ' ab' : ''}" style="top:${yp(val).toFixed(1)}%">${fmtLim(s, val)}</span>`;
    return `<div class="iot-spw" aria-hidden="true"><svg class="iot-sp" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".22"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
      ${lim(s.aHi, 'hi')}${lL != null ? lim(lL, 'lo') : ''}
      <path d="${area}" fill="url(#${gid})"/><path d="${linea}" class="iot-spl"/></svg>
      <i class="iot-dot" style="top:${yp(ult).toFixed(1)}%"></i>${etq(s.aHi)}${lL != null ? etq(lL, true) : ''}</div>`;
  }
  function tile(s, t) {
    const est = estDe(s), [lbl, cls] = EST[est] || EST.ok, x = vivo[s.id] || {};
    let meta = `Rango ${s.rTxt}`;
    if (s.cat === 'tunel') { const tu = tunel(s, t); meta = `${est === 'carga' ? 'Bajando después de la carga · ' : ''}ciclo ${NF[1].format(Math.min(tu.dt, 18))} h de 18 h`; }
    if (puertaAbierta(s, t)) meta = `<b class="iot-puerta">Puerta abierta</b> · ${meta}`;
    const bar = s.cat === 'tunel' ? `<span class="iot-bar"><i style="width:${(Math.min(tunel(s, t).dt, 18) / 18 * 100).toFixed(0)}%"></i></span>` : '';
    return `<button type="button" class="iot-t ${cls}" data-sid="${s.id}" onclick="SIMA_IOT.preguntar('${s.id}')" aria-label="${e(s.n)}: ${est === 'off' ? 'sin datos' : fmt(s, x.v)}, ${lbl}. Preguntarle a SIMI">
      <span class="iot-top"><b>${e(s.n)}</b><span class="iot-est"><i></i>${lbl}</span></span>
      <span class="iot-sub">${e(s.sub)}</span>
      <span class="iot-v">${est === 'off' ? '—' : fmt(s, x.v)}</span>
      ${chispa(s, t)}<span class="iot-meta">${meta}</span>${bar}</button>`;
  }
  function tableros(t) {
    const en = (vivo.en && vivo.en.v) || valor(sen('en'), t), p = [['Frío y túneles', 0.54], ['Faena y desposte', 0.31], ['Servicios e iluminación', 0.15]];
    return `<div class="iot-t iot-tab"><span class="iot-top"><b>Demanda por tablero</b></span><span class="iot-sub">Reparto de la demanda actual</span>
      ${p.map(([n, f]) => `<span class="iot-fila"><span>${n}</span><b>${NF[0].format(en * f)} kW</b><span class="iot-bar"><i style="width:${(f * 100).toFixed(0)}%"></i></span></span>`).join('')}</div>`;
  }
  function resumen() {
    const act = alarmas.filter(a => Date.now() >= (a.pospuesta || 0)), c = act.filter(a => a.sev === 'crit').length, w = act.length - c;
    const hoy = agregados(inicioDia(Date.now()));
    return `<div class="iot-sem ${c ? 'crit' : w ? 'adv' : 'ok'}"><i></i><span><b>${c ? `${c} alarma${c > 1 ? 's' : ''}${w ? ` y ${w} advertencia${w > 1 ? 's' : ''}` : ''}` : w ? `${w} advertencia${w > 1 ? 's' : ''}` : 'Todo en rango'}</b><small>${S.length} sensores · actualizado ${horaS(ultimo || Date.now())}</small></span></div>
      <div class="iot-kpi"><small>Energía hoy</small><b>${NF[0].format(hoy.kwh)} kWh</b></div>
      <div class="iot-kpi"><small>Agua hoy</small><b>${NF[0].format(hoy.m3)} m³</b></div>
      <div class="iot-kpi"><small>Vapor hoy</small><b>${NF[1].format(hoy.tv)} t</b></div>
      <div class="iot-kpi"><small>Cadena de frío hoy</small><b>${NF[1].format(hoy.frio)} %</b></div>`;
  }
  const ICO_INS = { prediccion: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>', causa: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>', anomalia: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/>', mant: '<path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>', efic: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>' };
  const TIT_INS = { prediccion: 'Predicción', causa: 'Causa probable', anomalia: 'Fuera de lo habitual', mant: 'Mantenimiento predictivo', efic: 'Eficiencia' };
  function pintarInsights() {
    const l = insights();
    return `<div class="ins-head">${window.SIMI_M ? SIMI_M.svg('') : ''}<div><b>SIMI analiza</b><small>Tendencias, correlaciones e histórico de los sensores</small></div>
      <button type="button" class="it-b pri" onclick="SIMA_IOT.resumenTurno()">Resumen del turno</button></div>
      ${l.length ? `<div class="ins-grid">${l.map(i => `<article class="ins ${i.tipo}">
        <span class="ins-k"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO_INS[i.tipo]}</svg>${TIT_INS[i.tipo]}</span>
        <b>${e(i.t)}</b><p>${e(i.d)}</p>
        <span class="ins-a"><button type="button" onclick="SIMA_IOT.preguntar('${i.sid}')">Preguntar</button>${i.crear ? `<button type="button" onclick="SIMA_IOT.crearTrabajo('${i.k}')">Crear trabajo</button>` : ''}
        <span class="ins-fb"><button type="button" onclick="SIMA_IOT.opinar('${i.k}','${i.tipo}',1)">Útil</button><button type="button" title="SIMI baja la sensibilidad para este tipo de aviso" onclick="SIMA_IOT.opinar('${i.k}','${i.tipo}',0)">No aplica</button></span></span>
      </article>`).join('')}</div>` : '<p class="iot-vacio">Sin observaciones por ahora: todo se comporta como de costumbre.</p>'}`;
  }
  function filaAlarma(a) {
    const s = sen(a.sid), pos = Date.now() < (a.pospuesta || 0);
    return `<li class="${a.sev}${a.ack ? ' ack' : ''}${pos ? ' pos' : ''}"><i></i><span><b>${e(s.n)}</b> ${e(fraseAlarma(a, s).replace(s.n + ' (' + s.sub + ') ', ''))}${a.ack ? ` <em>Reconocida ${hora(a.ack.t)}</em>` : ''}${pos ? ` <em>Pospuesta hasta ${hora(a.pospuesta)}</em>` : ''}</span>
      <span class="ia-acc"><button type="button" onclick="SIMA_IOT.preguntar('${s.id}')">¿Qué reviso?</button>${a.ack ? '' : `<button type="button" onclick="SIMA_IOT.reconocer('${a.id}')">Reconocer</button>`}</span></li>`;
  }
  function pintarVivo() {
    const t = Date.now(), set = (id, h) => { const el = $(id); if (el) el.innerHTML = h; };
    set('iotResumen', resumen());
    set('iotEstado', `actualizado ${horaS(ultimo || t)}`);
    const n = document.querySelector('#iotTabs .iot-n'), tabAl = document.querySelector('#iotTabs [data-tab="alarmas"]');
    if (tabAl) tabAl.innerHTML = `Alarmas y avisos${alarmas.length ? ` <span class="iot-n">${alarmas.length}</span>` : ''}`;
    if (tab === 'vivo') {
      const ins = $('iotIns'); if (ins && (ticks % 2 === 0 || !ins.children.length)) ins.innerHTML = pintarInsights();
      set('iotAlertas', alarmas.length ? `<h3>Alarmas activas <small>${alarmas.length}</small><button type="button" class="iot-link" onclick="SIMA_IOT.tab('alarmas')">Ver alarmas y avisos</button></h3><ul class="iot-al">${alarmas.slice().sort((x, y) => (y.sev === 'crit') - (x.sev === 'crit')).map(filaAlarma).join('')}</ul>` : '');
      set('iotCam', S.filter(s => s.cat === 'camara' || s.cat === 'congelado').map(s => tile(s, t)).join(''));
      set('iotTun', S.filter(s => s.cat === 'tunel').map(s => tile(s, t)).join(''));
      set('iotServ', S.filter(s => ['energia', 'agua', 'vapor', 'presion'].includes(s.cat)).map(s => tile(s, t)).join('') + tableros(t));
    } else if (tab === 'alarmas') set('iotAct', pintarActivas());
    void n;
  }

  /* ---------- Pestaña Histórico -------------------------------------- */
  let hDia = null, hSid = 'c3';
  let GW = 720, GH = 260, GL = 44, GR = 58, GT = 30, GB = 30;
  function grafico(s, dia) {
    const chico = typeof innerWidth !== 'undefined' && innerWidth < 640;
    GW = chico ? 400 : 760; GH = chico ? 262 : 282; GL = chico ? 36 : 44; GR = chico ? 50 : 60;
    const ahora = Date.now(), fin = Math.min(dia + DIA, ahora), pts = [];
    for (let t = dia; t <= fin; t += SLOT) pts.push([t, valor(s, t)]);
    const vals = pts.map(p => p[1]).filter(v => v != null);
    const lL = limLo(s);
    let lo = Math.min(...vals, lL != null ? lL : Infinity), hi = Math.max(...vals, s.aHi);
    const pad = (hi - lo) * 0.06 || 1; const esc_ = escala(lo - pad, hi + pad, chico ? 4 : 5); lo = esc_.lo; hi = esc_.hi;
    const x = t => GL + (t - dia) / DIA * (GW - GL - GR), y = v => GT + (1 - (v - lo) / (hi - lo)) * (GH - GT - GB);
    const base = GH - GB, uid = s.id + dia;
    let linea = '', area = '', pen = false, x0 = 0, xl = 0;
    for (const [t, v] of pts) {
      if (v == null) { if (pen) area += `L${xl},${base}L${x0},${base}Z`; pen = false; continue; }
      const X = x(t).toFixed(1), Y = y(v).toFixed(1);
      linea += `${pen ? 'L' : 'M'}${X},${Y}`; area += pen ? `L${X},${Y}` : `M${X},${base}L${X},${Y}`;
      if (!pen) x0 = X; xl = X; pen = true;
    }
    if (pen) area += `L${xl},${base}L${x0},${base}Z`;
    const dec = esc_.paso < 1 ? 1 : 0;
    const zonas = [];
    for (const ev of eventosDia(dia).concat(vivos.filter(v => inicioDia(v.t0) === dia))) {
      const afecta = ev.sid === s.id || (ev.tipo === 'compresor' && ['c1', 'c2', 'c3', 'en'].includes(s.id)) || (ev.tipo === 'vapor_alto' && s.id === 'pv');
      if (afecta && ev.t0 < fin) { const xa = x(ev.t0), w = Math.max(3, x(Math.min(ev.t1, fin)) - xa);
        zonas.push(`<g class="hz-al"><title>${TIPOS[ev.tipo].t} · ${hora(ev.t0)}</title><rect x="${xa.toFixed(1)}" y="${GT}" width="${w.toFixed(1)}" height="${base - GT}" class="hz-f"/><rect x="${xa.toFixed(1)}" y="${GT}" width="${w.toFixed(1)}" height="3" rx="1.5" class="hz-t"/></g>`); }
    }
    const yHi = y(s.aHi), yLo = lL != null ? y(lL) : base;
    const limite = (v, yy) => `<line x1="${GL}" x2="${GW - GR}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" class="h-lim"/><text x="${GW - GR + 6}" y="${(yy + 4).toFixed(1)}" class="h-limt">${fmtLim(s, v)}</text>`;
    const horas = chico ? [0, 6, 12, 18, 24] : [0, 3, 6, 9, 12, 15, 18, 21, 24];
    const hoy = ahora < dia + DIA, xn = x(ahora);
    return `<svg class="h-graf" viewBox="0 0 ${GW} ${GH}" role="img" aria-label="${e(s.n)} el ${fechaC(dia)}" data-dia="${dia}" data-sid="${s.id}" data-lo="${lo}" data-hi="${hi}" onpointermove="SIMA_IOT.punto(event)" onpointerleave="SIMA_IOT.punto(null)">
      <defs>
        <linearGradient id="ha${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="h-ga0"/><stop offset="1" class="h-ga1"/></linearGradient>
        <clipPath id="hin${uid}"><rect x="0" y="${yHi.toFixed(1)}" width="${GW}" height="${Math.max(0, yLo - yHi).toFixed(1)}"/></clipPath>
        <clipPath id="hout${uid}"><rect x="0" y="0" width="${GW}" height="${yHi.toFixed(1)}"/>${lL != null ? `<rect x="0" y="${yLo.toFixed(1)}" width="${GW}" height="${(GH - yLo).toFixed(1)}"/>` : ''}</clipPath>
      </defs>
      ${esc_.ticks.map(v => `<line x1="${GL}" x2="${GW - GR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="h-grid"/><text x="${GL - 8}" y="${(y(v) + 4).toFixed(1)}" class="h-ty">${NF[dec].format(v)}</text>`).join('')}
      <text x="${GL - 8}" y="${GT - 16}" class="h-ty h-u">${s.u}</text>
      ${horas.map(hh => `<line x1="${x(dia + hh * H).toFixed(1)}" x2="${x(dia + hh * H).toFixed(1)}" y1="${base}" y2="${base + 4}" class="h-tk"/><text x="${x(dia + hh * H).toFixed(1)}" y="${GH - 8}" class="h-tx">${p2(hh % 24)}:00</text>`).join('')}
      ${zonas.join('')}
      <path d="${area}" fill="url(#ha${uid})"/>
      ${limite(s.aHi, yHi)}${lL != null ? limite(lL, yLo) : ''}
      <path d="${linea}" class="h-linea" clip-path="url(#hin${uid})"/>
      <path d="${linea}" class="h-linea fuera" clip-path="url(#hout${uid})"/>
      <line x1="${GL}" x2="${GW - GR}" y1="${base}" y2="${base}" class="h-eje"/>
      ${hoy ? `<line x1="${xn.toFixed(1)}" x2="${xn.toFixed(1)}" y1="${GT}" y2="${base}" class="h-ahora"/><text x="${xn.toFixed(1)}" y="${GT - 10}" class="h-ahorat">Ahora</text>` : ''}
      <g id="hPunto"></g></svg>`;
  }
  function resumenSensorDia(s, dia) {
    const fin = Math.min(dia + DIA, Date.now()); let mn = Infinity, mx = -Infinity, sum = 0, n = 0, fuera = 0;
    for (let t = dia; t <= fin; t += 5 * MIN) { const v = valor(s, t); if (v == null) continue; mn = Math.min(mn, v); mx = Math.max(mx, v); sum += v; n++; if (!estadoProceso(s, t) && sevDe(s, v)) fuera++; }
    const al = alarmasHistoricas().filter(a => a.sid === s.id && inicioDia(a.t0) === dia).length;
    return { mn: n ? mn : null, mx: n ? mx : null, prom: n ? sum / n : null, fueraMin: fuera * 5, al };
  }
  function pintarHistorico() {
    const dias = diasDisponibles(); if (!hDia || !dias.includes(hDia)) hDia = dias[dias.length - 1];
    const s = sen(hSid), r = resumenSensorDia(s, hDia), ag = dias.map(agregados), hoyD = inicioDia(Date.now());
    return `<div class="h-ctrl">
        <div class="h-dias" role="tablist" aria-label="Día">${dias.map(d => `<button type="button" role="tab" aria-selected="${d === hDia}" class="${d === hDia ? 'on' : ''}" onclick="SIMA_IOT.hist(${d},null)">${fechaC(d)}${d === hoyD ? ' · hoy' : ''}</button>`).join('')}</div>
        <select id="hSensor" aria-label="Variable" onchange="SIMA_IOT.hist(null,this.value)">${S.map(x => `<option value="${x.id}" ${x.id === hSid ? 'selected' : ''}>${x.n} · ${x.sub}</option>`).join('')}</select>
        <button type="button" class="btn btn-ghost btn-sm" onclick="SIMA_IOT.csv()">Descargar CSV del día</button>
      </div>
      <section class="mx-box h-box"><div class="h-tit"><b>${e(s.n)} · ${e(s.sub)}</b><small>${DIAS[new Date(hDia).getDay()]} ${new Date(hDia).getDate()}/${new Date(hDia).getMonth() + 1} · cada 15 min · rango ${s.rTxt}</small><span class="h-tip" id="hTip" aria-live="polite"></span></div>
        ${grafico(s, hDia)}
        <div class="h-leyenda"><span><i class="ll in"></i>En rango</span><span><i class="ll out"></i>Fuera de rango</span><span><i class="ll lim"></i>Límite</span><span><i class="lz al"></i>Desvío registrado</span></div>
        <div class="h-stats"><div><small>Mínimo</small><b>${fmt(s, r.mn)}</b></div><div><small>Promedio</small><b>${fmt(s, r.prom)}</b></div><div><small>Máximo</small><b>${fmt(s, r.mx)}</b></div><div><small>Fuera de rango</small><b>${r.fueraMin} min</b></div><div><small>Alarmas</small><b>${r.al}</b></div></div>
      </section>
      <section class="mx-box"><h3 class="iot-h" style="margin-top:0">Resumen diario de la planta</h3>
        <div class="h-tabla"><table><thead><tr><th>Día</th><th>Cabezas</th><th>Energía</th><th>kWh/cab</th><th>Agua</th><th>L/cab</th><th>Vapor</th><th>kg vapor/cab</th><th>Cadena de frío</th><th>Alarmas</th></tr></thead>
        <tbody>${ag.map(a => `<tr class="${a.dia === hDia ? 'on' : ''}"><td>${fechaC(a.dia)}${a.parcial ? ' <small>(hasta ahora)</small>' : ''}</td><td>${a.cab ? NF[0].format(a.cab) : '—'}</td><td>${NF[0].format(a.kwh)} kWh</td><td>${a.cab ? NF[1].format(a.kwh / a.cab) : '—'}</td><td>${NF[0].format(a.m3)} m³</td><td>${a.cab ? NF[0].format(a.m3 * 1000 / a.cab) : '—'}</td><td>${NF[1].format(a.tv)} t</td><td>${a.cab ? NF[0].format(a.tv * 1000 / a.cab) : '—'}</td><td>${NF[1].format(a.frio)} %</td><td>${a.alarmas}</td></tr>`).join('')}</tbody></table></div>
      </section>`;
  }

  /* ---------- Pestaña Alarmas y avisos ------------------------------- */
  function linea(a) {
    const ahora = Date.now();
    return `<ol class="esc">${nivelesDe(a).map(p => {
      const tN = a.t0 + p.min * MIN, ack = a.ack && a.ack.t <= tN;
      const st = ack ? 'No hizo falta: reconocida' : ahora >= tN ? `Avisado ${hora(tN)}` : `Si nadie la reconoce, a las ${hora(tN)}`;
      return `<li class="${ack ? 'skip' : ahora >= tN ? 'done' : 'next'}"><b>Nivel ${p.n} · ${p.rol}</b><span>${p.canales.join(' + ')} · ${st}</span></li>`;
    }).join('')}</ol>`;
  }
  function pintarActivas() {
    if (!alarmas.length) return '<p class="iot-vacio">No hay alarmas activas.</p>';
    return alarmas.slice().sort((x, y) => (y.sev === 'crit') - (x.sev === 'crit')).map(a => {
      const s = sen(a.sid), pos = Date.now() < (a.pospuesta || 0);
      return `<article class="al-card ${a.sev}"><div class="al-top"><span class="iot-est"><i></i>${a.tipo === 'sindatos' ? 'Sin datos' : a.sev === 'crit' ? 'Alarma' : 'Advertencia'}</span><b>${e(s.n)} · ${e(s.sub)}</b><small>desde ${hora(a.t0)}</small></div>
        <p>${e(fraseAlarma(a, s))}</p>${linea(a)}
        <div class="al-acc"><button type="button" class="it-b pri" onclick="SIMA_IOT.preguntar('${s.id}')">¿Qué reviso?</button>
          ${a.ack ? `<span class="al-ok">Reconocida por ${e(a.ack.quien)} a las ${hora(a.ack.t)}</span>` : `<button type="button" class="it-b" onclick="SIMA_IOT.reconocer('${a.id}')">Reconocer</button>`}
          ${pos ? `<span class="al-ok">Pospuesta hasta ${hora(a.pospuesta)}</span>` : `<button type="button" class="it-b" onclick="SIMA_IOT.posponer('${a.id}')">Posponer 30 min</button>`}</div></article>`;
    }).join('');
  }
  function pintarAlarmas() {
    const h = alarmasHistoricas(), dias = Math.max(1, diasDisponibles().length);
    const conAck = h.filter(a => a.ackMin != null), prom = conAck.length ? conAck.reduce((x, a) => x + a.ackMin, 0) / conAck.length : 0;
    const en5 = conAck.length ? conAck.filter(a => a.ackMin <= 5).length / conAck.length * 100 : 100;
    const cuenta = {}; h.forEach(a => cuenta[a.sid] = (cuenta[a.sid] || 0) + 1);
    const top = Object.entries(cuenta).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return `<section class="mx-box"><h3 class="iot-h" style="margin-top:0">Alarmas activas</h3><div id="iotAct">${pintarActivas()}</div></section>
      <div class="iot-resumen kpis4">
        <div class="iot-kpi"><small>Alarmas por día</small><b>${NF[1].format(h.length / dias)}</b><small>Desde el lunes 9/11</small></div>
        <div class="iot-kpi"><small>Tiempo medio de reconocimiento</small><b>${NF[1].format(prom)} min</b></div>
        <div class="iot-kpi"><small>Reconocidas en 5 min o menos</small><b>${NF[0].format(en5)} %</b><small>Meta: más del 95 %</small></div>
        <div class="iot-kpi"><small>Equipo con más alarmas</small><b>${top[0] ? e(sen(top[0][0]).n) : '—'}</b><small>${top[0] ? top[0][1] + ' desde el lunes' : ''}</small></div>
      </div>
      <div class="mx-dos">
        <section class="mx-box"><h3 class="iot-h" style="margin-top:0">Política de avisos</h3>
          <ol class="esc pol">${POLITICA.map(p => `<li class="done"><b>Nivel ${p.n} · ${p.rol}</b><span>${p.min ? `Si nadie reconoce en ${p.min} min` : 'Al instante'} · ${p.canales.join(' + ')}${p.n === 3 ? ' · sólo alarmas' : ''}</span></li>`).join('')}</ol>
          <p class="pol-n">Reconocer una alarma corta el escalamiento. Las advertencias llegan hasta el nivel 2. Cada aviso incluye qué pasó, el valor, desde cuándo y qué revisar.</p>
          <label class="iot-sw"><input type="checkbox" ${voz ? 'checked' : ''} onchange="SIMA_IOT.voz(this.checked)"> Leer las alarmas en voz alta en este equipo</label>
        </section>
        <section class="mx-box"><h3 class="iot-h" style="margin-top:0">Equipos con más alarmas</h3>
          <ul class="mx-check top">${top.map(([sid, n]) => `<li><span><b>${e(sen(sid).n)}</b> · ${n} alarma${n > 1 ? 's' : ''} desde el lunes.${n >= 3 ? ' Conviene revisar la causa de fondo o el ajuste del rango.' : ''}</span></li>`).join('') || '<li>Sin alarmas registradas.</li>'}</ul>
        </section>
      </div>
      <section class="mx-box"><h3 class="iot-h" style="margin-top:0">Historial desde el lunes 9/11</h3>
        <div class="h-tabla"><table><thead><tr><th>Inicio</th><th>Equipo</th><th>Qué pasó</th><th>Pico</th><th>Duración</th><th>Reconocida</th><th>Nivel</th></tr></thead>
        <tbody>${h.slice(0, 60).map(a => { const s = sen(a.sid); return `<tr><td>${fechaC(a.t0)} ${hora(a.t0)}</td><td>${e(s.n)}</td><td><span class="sev ${a.sev}"></span>${e((TIPOS[a.tipo] || { t: a.tipo === 'sindatos' ? 'Sensor sin datos' : 'Fuera de rango' }).t)}</td><td>${a.sev === 'sindatos' ? '—' : fmt(s, a.pico)}</td><td>${a.fin ? Math.max(1, Math.round((a.fin - a.t0) / MIN)) + ' min' : 'en curso'}</td><td>${a.ackMin != null ? `${a.ackMin} min` : a.fin ? 'volvió sola' : 'pendiente'}</td><td>${a.nivel || 1}</td></tr>`; }).join('')}</tbody></table></div>
      </section>`;
  }

  /* ---------- Pantalla del módulo ------------------------------------ */
  const icoM = k => (window.SIMA_MODS ? SIMA_MODS.ico(k) : '');
  const cabecera = extra => `<div class="mx-head"><span class="mod-ico" style="background:rgba(139,123,247,.14);color:var(--violet,#8B7BF7)">${icoM('iot')}</span>
      <div style="flex:1;min-width:0"><span class="mx-tag">Módulo 3</span><h2>Monitoreo Industrial 5.0 <small class="mx-sub">IoT + IA</small></h2>${extra || ''}</div></div>`;
  function opciones() {
    return `<details class="iot-mas"><summary aria-label="Opciones">···</summary><div class="iot-menu" role="menu">
      <b>Probar una alarma</b>${Object.entries(TIPOS).map(([k, x]) => `<button type="button" role="menuitem" onclick="SIMA_IOT.probar('${k}');this.closest('details').open=false">${x.t}</button>`).join('')}
      <hr><label class="iot-sw"><input type="checkbox" ${auto ? 'checked' : ''} onchange="SIMA_IOT.auto(this.checked)"> Desvíos automáticos</label>
      <label class="iot-sw"><input type="checkbox" ${voz ? 'checked' : ''} onchange="SIMA_IOT.voz(this.checked)"> Leer alarmas en voz alta</label>
      <hr><button type="button" role="menuitem" onclick="SIMA_IOT.csv()">Descargar datos de hoy (CSV)</button>
      <button type="button" role="menuitem" class="sal" onclick="SIMA_IOT.demo(false)">Desactivar datos de demostración</button></div></details>`;
  }
  window.vModIot = function () {
    if (!demo) return `<div id="iotRoot">${cabecera('<p>Cámaras de frío, túneles, energía, agua y vapor en tiempo real, con SIMI analizando los datos: predice desvíos, avisa a quien corresponde y sugiere qué hacer.</p>')}
      <div class="mx-dos"><section class="mx-box"><h3>Conexión con Grafana pendiente</h3>
        <div class="mx-flujo"><span>Grafana de la planta</span><i>→</i><span>Túnel seguro</span><i>→</i><span>SIMA</span><i>→</i><span>SIMI y avisos</span></div>
        <ol class="mx-pasos"><li><span>SIMA consulta a Grafana con una <b>cuenta de solo lectura</b>.</span></li><li><span>La conexión pasa por un <b>túnel cifrado</b>, sin abrir puertos de la red.</span></li><li><span>Las lecturas se actualizan cada <b>30 a 60 segundos</b> y se guardan para el histórico.</span></li></ol>
        <button type="button" class="btn btn-primary" id="iotDemoBtn" style="margin-top:14px" onclick="SIMA_IOT.demo(true)">Ver con datos de demostración</button></section>
        <section class="mx-box"><h3>Qué hace falta de Sistemas</h3><ul class="mx-check"><li>Dirección y versión del Grafana de la planta.</li><li>Tipo de base de datos de los sensores (InfluxDB, Prometheus, SQL…).</li><li>Los tableros a mostrar: cámaras, túneles, energía, agua y vapor.</li><li>Una cuenta de servicio de Grafana con rol de solo lectura.</li><li>Permiso para instalar el túnel de Cloudflare en un equipo de la red.</li><li>Rangos por equipo y a quién avisar en cada nivel.</li></ul></section></div></div>`;
    setTimeout(() => { arrancar(); if (!ultimo) paso(true); else pintarVivo(); }, 0);
    const tabs = [['vivo', 'En vivo'], ['historico', 'Histórico'], ['alarmas', 'Alarmas y avisos']];
    let cuerpo;
    if (tab === 'historico') cuerpo = pintarHistorico();
    else if (tab === 'alarmas') cuerpo = pintarAlarmas();
    else cuerpo = `<section class="mx-box iot-ins" id="iotIns" aria-label="SIMI analiza"></section>
      <section class="iot-alertas mx-box" id="iotAlertas" aria-label="Alarmas activas"></section>
      <h3 class="iot-h">Cámaras de frío</h3><div class="iot-grid" id="iotCam"></div>
      <h3 class="iot-h">Túneles de congelamiento</h3><div class="iot-grid g2" id="iotTun"></div>
      <h3 class="iot-h">Energía, agua y vapor</h3><div class="iot-grid" id="iotServ"></div>`;
    return `<div id="iotRoot">${cabecera(`<p class="iot-vivo"><i></i>En vivo · <span id="iotEstado">actualizado ${horaS(ultimo || Date.now())}</span></p>`)}
      <div class="iot-barra"><div class="iot-tabs" role="tablist" id="iotTabs">${tabs.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" onclick="SIMA_IOT.tab('${k}')">${l}${k === 'alarmas' && alarmas.length ? ` <span class="iot-n">${alarmas.length}</span>` : ''}</button>`).join('')}</div>${opciones()}</div>
      <div class="iot-resumen" id="iotResumen" aria-live="polite">${resumen()}</div>
      ${cuerpo}</div>`;
  };

  function arrancar() {
    if (timer) return;
    timer = setInterval(() => {
      if (!demo || (typeof modulo !== 'undefined' && modulo !== 'iot') || document.hidden) return;
      paso(false);
    }, TICK);
  }
  window.addEventListener('sima:demo', ev => { demo = !!ev.detail; if (demo) { ticks = 0; ultimo = 0; if (typeof modulo !== 'undefined' && modulo === 'iot') arrancar(); } else { const t = $('iotToast'); t && t.classList.remove('show'); } });
  window.addEventListener('sima:modulo', ev => { if (ev.detail === 'iot' && demo) arrancar(); else { const t = $('iotToast'); t && t.classList.remove('show'); } });
  const repintar = () => { if (typeof view !== 'undefined' && view === 'iot' && typeof render === 'function') render(); };

  /* ---------- SIMI en el chat ---------------------------------------- */
  const norm = t => ' ' + String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[¿?¡!.,;:]/g, ' ') + ' ';
  const tag = '<span class="simi-g-tag">✦ Monitoreo en vivo</span>';
  function detalle(s) {
    const t = Date.now(), x = vivo[s.id] || { v: valor(s, t) }, est = estDe(s), a = alarmas.find(al => al.sid === s.id);
    let h = `${tag}<p style="margin:6px 0 0"><b>${e(s.n)}</b> (${e(s.sub)}): ${est === 'off' ? 'sin datos' : `<b>${fmt(s, x.v)}</b>`} · ${(EST[est] || EST.ok)[0]}. Rango ${s.rTxt}.`;
    if (s.cat === 'tunel') h += ` Ciclo en ${NF[1].format(Math.min(tunel(s, t).dt, 18))} h de 18 h.`;
    if (puertaAbierta(s, t)) h += ' La puerta figura abierta.';
    if (est === 'desc') h += ' Está descongelando: por eso no alarma aunque suba.';
    if (est === 'carga') h += ' Está bajando después de la carga: no alarma hasta terminar la bajada.';
    const m = pendiente(s, t) * 600; if (x.v != null && Math.abs(m) > (s.u === 'kW' ? 40 : s.u === 'm³/h' ? 4 : 0.6)) h += ` Viene ${m > 0 ? 'subiendo' : 'bajando'}.`;
    const hab = habitual(s, t); if (hab != null && x.v != null && ['energia', 'agua', 'vapor'].includes(s.cat)) h += ` Lo habitual a esta hora es ${fmt(s, hab)}.`;
    h += '</p>';
    if (a) h += `<h5>Qué revisar</h5><ol class="simi-pasos">${revisarDe(a, s).map(z => `<li>${e(z)}</li>`).join('')}</ol>`;
    return h;
  }
  function revisarTodas() {
    if (!alarmas.length) return estadoGeneral();
    const orden = alarmas.slice().sort((x, y) => (y.sev === 'crit') - (x.sev === 'crit'));
    const intro = orden.length > 1 ? `${tag}<p style="margin:6px 0 0">Hay <b>${orden.length}</b> alarmas activas. Empezá por la de arriba:</p>` : '';
    return intro + orden.map((a, i) => { const s = sen(a.sid); const h = detalle(s); return i || intro ? h.replace(tag, '') : h; }).join('<hr style="border:0;border-top:1px solid var(--line,rgba(255,255,255,.08));margin:10px 0">')
      + `<p style="margin:8px 0 0">Si nadie la reconoce, aviso al siguiente nivel según la escalera de la alarma.</p>`;
  }
  function estadoGeneral() {
    const v = id => fmt(sen(id), vivo[id] && vivo[id].v);
    if (!alarmas.length) return `${tag}<p style="margin:6px 0 0">Todo en rango: ${S.length} sensores reportando. Demanda <b>${v('en')}</b>, agua <b>${v('ag')}</b>, vapor <b>${v('vf')}</b> a <b>${v('pv')}</b>.</p>`;
    return `${tag}<p style="margin:6px 0 0">Hay <b>${alarmas.length}</b> ${alarmas.length > 1 ? 'alarmas activas' : 'alarma activa'}:</p><ul class="simi-ul">${alarmas.map(a => `<li><span>${e(fraseAlarma(a, sen(a.sid)))}</span></li>`).join('')}</ul><p style="margin:6px 0 0">Preguntame por cualquiera y te digo qué revisar.</p>`;
  }
  function turno() {
    const ahora = Date.now(), desde = ahora - 8 * H, hoy = agregados(inicioDia(ahora));
    const al = alarmasHistoricas().filter(a => a.t0 >= desde), sinAck = alarmas.filter(a => !a.ack), ins = insights();
    return `${tag}<p style="margin:6px 0 0"><b>Resumen de las últimas 8 horas</b></p><ul class="simi-ul">
      <li><span><b>${al.length}</b> alarma${al.length === 1 ? '' : 's'}${al.length ? `: ${[...new Set(al.map(a => sen(a.sid).n))].join(', ')}` : ''}. ${sinAck.length ? `<b>${sinAck.length}</b> sin reconocer.` : 'Todas atendidas.'}</span></li>
      <li><span>Cadena de frío hoy: <b>${NF[1].format(hoy.frio)} %</b> del tiempo en rango.</span></li>
      <li><span>Consumo de hoy: <b>${NF[0].format(hoy.kwh)} kWh</b>, <b>${NF[0].format(hoy.m3)} m³</b> de agua y <b>${NF[1].format(hoy.tv)} t</b> de vapor.</span></li>
      ${ins.slice(0, 2).map(i => `<li><span>${e(TIT_INS[i.tipo])}: ${e(i.t)}.</span></li>`).join('')}</ul>`;
  }
  function diaPedido(q) {
    const dias = diasDisponibles(), hoy = inicioDia(Date.now());
    if (/\bhoy\b/.test(q)) return hoy;
    if (/\banteayer\b/.test(q)) return hoy - 2 * DIA;
    if (/\bayer\b/.test(q)) return inicioDia(hoy - DIA + 2 * H);
    for (let i = 0; i < 7; i++) { const n = norm(DIAS[i]).trim(); if (new RegExp('\\b' + n + '\\b').test(q)) { const d = dias.filter(x => new Date(x).getDay() === i).pop(); if (d) return d; } }
    return null;
  }
  function responder(texto) {
    if (!demo) return null;
    const q = norm(texto);
    if (/\b(resumen del turno|resumen de turno|como viene el turno|briefing|que paso en el turno|novedades del turno)\b/.test(q)) return turno();
    // «¿Qué reviso en las alarmas activas?» (botón de SIMI arriba del módulo):
    // qué revisar en CADA alarma, no sólo la lista.
    if (/\b(que reviso|que reviso en|que hago con|revisar)\b/.test(q) && /\balarmas?\b/.test(q)) return revisarTodas();
    const dia = diaPedido(q);
    if (dia != null && dia >= T0 && /\b(energia|kwh|agua|vapor|consumo|consumimos|gastamos|alarmas|cadena de frio|cabezas)\b/.test(q)) {
      const a = agregados(dia);
      return `${tag}<p style="margin:6px 0 0"><b>${DIAS[new Date(dia).getDay()]} ${new Date(dia).getDate()}/${new Date(dia).getMonth() + 1}${a.parcial ? ' (hasta ahora)' : ''}</b></p><ul class="simi-ul">
        <li><span>Energía: <b>${NF[0].format(a.kwh)} kWh</b>${a.cab ? ` · ${NF[1].format(a.kwh / a.cab)} kWh por cabeza` : ''}</span></li>
        <li><span>Agua: <b>${NF[0].format(a.m3)} m³</b>${a.cab ? ` · ${NF[0].format(a.m3 * 1000 / a.cab)} L por cabeza` : ''}</span></li>
        <li><span>Vapor: <b>${NF[1].format(a.tv)} t</b>${a.cab ? ` · ${NF[0].format(a.tv * 1000 / a.cab)} kg por cabeza` : ''}</span></li>
        <li><span>Cadena de frío: <b>${NF[1].format(a.frio)} %</b> en rango · <b>${a.alarmas}</b> alarma${a.alarmas === 1 ? '' : 's'}</span></li></ul>`;
    }
    if (/\b(mas tiempo fuera de rango|peor camara|mas alarmas|equipo con mas|equipos con mas)\b/.test(q)) {
      const c = {}; alarmasHistoricas().forEach(a => c[a.sid] = (c[a.sid] || 0) + 1);
      const top = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 3);
      return `${tag}<p style="margin:6px 0 0">Desde el lunes, los equipos con más alarmas:</p><ul class="simi-ul">${top.map(([sid, n]) => `<li><span><b>${e(sen(sid).n)}</b>: ${n}</span></li>`).join('')}</ul>`;
    }
    if (/\b(predic|va a pasar|que viene|riesgo|que me recomendas|que ves|analisis|analiza|insight|observaciones)/.test(q)) {
      const l = insights();
      return l.length ? `${tag}<ul class="simi-ul">${l.map(i => `<li><span><b>${e(TIT_INS[i.tipo])}:</b> ${e(i.t)}. ${e(i.d)}</span></li>`).join('')}</ul>` : `${tag}<p style="margin:6px 0 0">No veo nada fuera de lo habitual: tendencias estables y consumos dentro de lo esperado para esta hora.</p>`;
    }
    let s = null;
    const nc = q.match(/\bcamara (\d)\b/), nt = q.match(/\btunel (\d)\b/);
    if (nc) s = sen('c' + nc[1]); else if (nt) s = sen('t' + nt[1]);
    else if (/\bpresion\b/.test(q)) s = sen('pv');
    else if (/\b(vapor|caldera)\b/.test(q)) s = sen('vf');
    else if (/\b(energia|electric|demanda|kw|tablero)/.test(q)) s = sen('en');
    else if (/\b(agua|caudal)\b/.test(q)) s = sen('ag');
    else if (/\btuneles?\b/.test(q)) return `${tag}<ul class="simi-ul">${['t1', 't2'].map(id => { const x = sen(id); return `<li><span><b>${x.n}</b>: ${fmt(x, vivo[id] && vivo[id].v)} · ${(EST[estDe(x)] || EST.ok)[0]}, ciclo ${NF[1].format(Math.min(tunel(x, Date.now()).dt, 18))} h</span></li>`; }).join('')}</ul>`;
    else if (/\bcamaras?\b/.test(q)) return `${tag}<ul class="simi-ul">${S.filter(x => x.cat === 'camara' || x.cat === 'congelado').map(x => `<li><span><b>${x.n}</b> (${e(x.sub)}): ${estDe(x) === 'off' ? 'sin datos' : fmt(x, vivo[x.id] && vivo[x.id].v)} · ${(EST[estDe(x)] || EST.ok)[0]}</span></li>`).join('')}</ul>`;
    if (s && s.id.length === 2 && sen(s.id)) return detalle(s);
    if (/\b(alarma|alarmas|alerta|alertas|desvio|desvios|problema|que pasa|como (esta|estan|anda|va) (todo|la planta)|estado general|todo bien)\b/.test(q)) return estadoGeneral();
    return null;
  }
  function resumenTexto() {
    if (!demo) return '';
    const hoy = agregados(inicioDia(Date.now()));
    return S.map(s => `${s.n} (${s.sub}): ${fmt(s, vivo[s.id] && vivo[s.id].v)}, ${(EST[estDe(s)] || EST.ok)[0].toLowerCase()}, rango ${s.rTxt}`).join('; ')
      + `. Alarmas activas: ${alarmas.length ? alarmas.map(a => fraseAlarma(a, sen(a.sid))).join(' ') : 'ninguna'}. Hoy: ${NF[0].format(hoy.kwh)} kWh, ${NF[0].format(hoy.m3)} m³ de agua, ${NF[1].format(hoy.tv)} t de vapor, cadena de frío ${NF[1].format(hoy.frio)} %. Observaciones de SIMI: ${insights().map(i => i.t).join('; ') || 'ninguna'}.`;
  }

  /* ---------- API pública -------------------------------------------- */
  window.SIMA_IOT = {
    responder, resumenTexto,
    activo: () => demo,
    alarmas: () => alarmas.slice(),
    dato() { if (!demo) return 'Conexión con Grafana pendiente'; const n = alarmas.length; return n ? `<b>${n}</b> alarma${n > 1 ? 's' : ''} activa${n > 1 ? 's' : ''}` : `Todo en rango · ${S.length} sensores`; },
    demo(on) { if (window.SIMA_DEMO && !!on !== demo) return SIMA_DEMO.set(on); demo = !!on; ls.set('sima.iot.demo', demo); if (demo) { ticks = 0; ultimo = 0; arrancar(); } else { const t = $('iotToast'); t && t.classList.remove('show'); } repintar(); },
    auto(v) { auto = !!v; ls.set('sima.iot.auto', auto); },
    voz(v) { voz = !!v; ls.set('sima.iot.voz', voz); if (voz && 'speechSynthesis' in window) { try { const u = new SpeechSynthesisUtterance('Listo. Te voy a leer las alarmas.'); u.lang = 'es-AR'; speechSynthesis.speak(u); } catch (_) {} } },
    probar(k) { const ok = probar(k); if (ok === false) toast({ sev: 'adv', titulo: 'Ya hay un desvío en curso en ese equipo', txt: 'Esperá a que vuelva a rango o probá otro.', sid: 'en' }); },
    tab(k) { tab = k; repintar(); },
    hist(d, sid) { if (d) hDia = +d; if (sid) hSid = sid; repintar(); },
    reconocer(id) {
      const a = alarmas.find(x => x.id === id); if (!a) return;
      a.ack = { t: Date.now(), quien: (typeof ROLES !== 'undefined' && typeof role !== 'undefined' && ROLES[role] && ROLES[role].name) || 'Inspector' };
      guardar(); const t = $('iotToast'); t && t.classList.remove('show');
      repintar();
    },
    posponer(id) { const a = alarmas.find(x => x.id === id); if (!a) return; a.pospuesta = Date.now() + 30 * MIN; guardar(); repintar(); },
    ver(sid) {
      const t = $('iotToast'); t && t.classList.remove('show');
      if (tab !== 'vivo') { tab = 'vivo'; repintar(); }
      if (typeof view !== 'undefined' && view !== 'iot' && typeof go === 'function') go('iot');
      setTimeout(() => { const el = document.querySelector(`.iot-t[data-sid="${sid}"]`); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('iot-foco'); setTimeout(() => el.classList.remove('iot-foco'), 1800); } }, 150);
    },
    preguntar(sid) {
      const s = sen(sid); if (!s) return;
      const t = $('iotToast'); t && t.classList.remove('show');
      const a = alarmas.find(x => x.sid === sid);
      const nombre = s.cat === 'energia' ? 'la energía' : s.cat === 'agua' ? 'el agua' : s.cat === 'vapor' ? 'el vapor' : s.cat === 'presion' ? 'la presión de vapor' : (s.cat === 'tunel' ? 'el ' : 'la ') + s.n.toLowerCase();
      if (window.simiPreguntar) simiPreguntar(a ? `¿Qué reviso en ${nombre}?` : `¿Cómo está ${nombre}?`);
    },
    resumenTurno() { if (window.simiPreguntar) simiPreguntar('Resumen del turno'); },
    // Botón del aviso de SIMI arriba del módulo: lleva a «Alarmas y avisos»,
    // marca las tarjetas y le pide a SIMI qué revisar en cada una.
    revisarAlarmas() {
      const t = $('iotToast'); t && t.classList.remove('show');
      if (typeof view !== 'undefined' && view !== 'iot' && typeof go === 'function') go('iot');
      if (tab !== 'alarmas') { tab = 'alarmas'; repintar(); }
      setTimeout(() => {
        const cs = document.querySelectorAll('.al-card');
        if (cs[0]) cs[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        cs.forEach(c => { c.classList.add('iot-foco'); setTimeout(() => c.classList.remove('iot-foco'), 1800); });
      }, 150);
      if (!alarmas.length) { if (window.simiPreguntar) simiPreguntar('¿Cómo está todo?'); return; }
      if (alarmas.length === 1) return SIMA_IOT.preguntar(alarmas[0].sid);
      if (window.simiPreguntar) simiPreguntar('¿Qué reviso en las alarmas activas?');
    },
    opinar(k, tipo, util) {
      sens[tipo] = util ? Math.min(1.5, (sens[tipo] || 1) * 1.05) : Math.max(0.5, (sens[tipo] || 1) * 0.8);
      ls.set('sima.iot.sens', sens);
      if (!util) descartes[k] = Date.now() + 30 * MIN;
      const el = $('iotIns'); if (el) el.innerHTML = pintarInsights();
      if (typeof toast === 'function') toast({ sev: 'ok', titulo: util ? 'Gracias' : 'Anotado', txt: util ? 'SIMI lo tiene en cuenta para próximas observaciones.' : 'SIMI baja la sensibilidad para este tipo de observación.', sid: 'en' });
    },
    crearTrabajo(k) {
      const i = insights().find(x => x.k === k); if (!i || !i.crear) return;
      if (typeof elegirModulo === 'function') elegirModulo('ruta');
      setTimeout(() => { if (typeof openCaptura === 'function') { openCaptura(null); setTimeout(() => { const d = $('fDesc'); if (d) { d.value = i.crear; d.dispatchEvent(new Event('input', { bubbles: true })); } }, 150); } }, 150);
    },
    punto(ev) {
      const g = $('hPunto'), tip = $('hTip'); if (!g) return;
      if (!ev) { g.innerHTML = ''; if (tip) tip.textContent = ''; return; }
      const svg = ev.currentTarget, r = svg.getBoundingClientRect();
      const fx = (ev.clientX - r.left) / r.width * GW, f = clamp((fx - GL) / (GW - GL - GR), 0, 1);
      const dia = +svg.dataset.dia, s = sen(svg.dataset.sid), t = dia + Math.round(f * 96) * SLOT;
      if (t > Date.now()) return;
      const v = valor(s, t), x = GL + (t - dia) / DIA * (GW - GL - GR);
      const lo = +svg.dataset.lo, hi = +svg.dataset.hi, yv = v == null ? null : GT + (1 - (v - lo) / (hi - lo)) * (GH - GT - GB);
      g.innerHTML = `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${GT}" y2="${GH - GB}" class="h-cur"/>${yv != null ? `<circle cx="${x.toFixed(1)}" cy="${yv.toFixed(1)}" r="5" class="h-pt${sevDe(s, v) ? ' fuera' : ''}"/>` : ''}`;
      if (tip) tip.textContent = `${hora(t)} · ${fmt(s, v)}`;
    },
    csv() {
      const dia = tab === 'historico' && hDia ? hDia : inicioDia(Date.now()), fin = Math.min(dia + DIA, Date.now());
      const filas = [['Fecha y hora', ...S.map(s => `${s.n} - ${s.sub} (${s.u})`)].join(';')];
      for (let t = dia; t <= fin; t += SLOT) filas.push([`${claveDia(t)} ${hora(t)}`, ...S.map(s => { const v = valor(s, t); return v == null ? '' : NF[s.d].format(v).replace(/\./g, ''); })].join(';'));
      const b = new Blob(['﻿' + filas.join('\n')], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = `SIMA_monitoreo_${claveDia(dia)}.csv`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
  };

  /* ---------- Estilos ------------------------------------------------- */
  const css = `
  .mx-sub{font-size:15px;font-weight:600;color:var(--tx3);letter-spacing:0;margin-left:6px}
  .iot-vivo{display:flex;align-items:center;gap:8px;margin:2px 0 0!important;color:var(--tx2);font-size:13.5px}
  .iot-vivo i{width:8px;height:8px;border-radius:50%;background:var(--st-cerrado,#1FCB7E)}
  .iot-barra{display:flex;align-items:center;gap:10px;margin-bottom:14px}
  .iot-tabs{display:flex;gap:4px;background:var(--s1);border-radius:999px;padding:4px;flex:1;max-width:540px}
  .iot-tabs button{flex:1;height:38px;border:0;border-radius:999px;background:transparent;color:var(--tx2);font:600 13.5px var(--sans);cursor:pointer;white-space:nowrap}
  .iot-tabs button.on{background:var(--s3);color:var(--tx)}
  .iot-n{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 6px;border-radius:99px;background:#FF5C5C;color:#fff;font-size:11.5px;margin-left:4px}
  .iot-mas{position:relative;margin-left:auto}
  .iot-mas summary{list-style:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--s1);cursor:pointer;color:var(--tx2);font-weight:800;letter-spacing:1px}
  .iot-mas summary::-webkit-details-marker{display:none}
  .iot-menu{position:absolute;right:0;top:50px;z-index:30;width:300px;background:var(--s1);border-radius:18px;padding:10px;box-shadow:0 24px 60px -20px rgba(0,0,0,.8),inset 0 0 0 1px var(--line-2);display:flex;flex-direction:column;gap:2px}
  .iot-menu b{font-size:12.5px;color:var(--tx3);padding:6px 10px 4px;font-weight:600}
  .iot-menu button{text-align:left;border:0;background:transparent;color:var(--tx);font:500 13.5px var(--sans);padding:9px 10px;border-radius:10px;cursor:pointer}
  .iot-menu button:hover{background:var(--s2)}
  .iot-menu .sal{color:var(--tx3)}
  .iot-menu hr{border:0;height:1px;background:var(--line-2);margin:6px 4px}
  .iot-menu .iot-sw{padding:8px 10px}
  .iot-sw{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--tx2);cursor:pointer}
  .iot-sw input{accent-color:var(--amber);width:16px;height:16px}
  .iot-resumen{display:grid;grid-template-columns:1.5fr repeat(4,1fr);gap:12px;margin-bottom:14px}
  .iot-resumen.kpis4{grid-template-columns:repeat(4,1fr);margin-top:14px}
  .iot-sem,.iot-kpi{background:var(--s1);border-radius:18px;padding:14px 16px;box-shadow:var(--sh-card,none)}
  .iot-sem{display:flex;align-items:center;gap:12px}
  .iot-sem>i{flex-shrink:0;width:12px;height:12px;border-radius:50%;background:var(--st-cerrado,#1FCB7E);box-shadow:0 0 0 5px rgba(31,203,126,.15)}
  .iot-sem.adv>i{background:var(--amber);box-shadow:0 0 0 5px rgba(255,159,28,.18)}
  .iot-sem.crit>i{background:#FF5C5C;box-shadow:0 0 0 5px rgba(255,92,92,.2)}
  .iot-sem span{display:flex;flex-direction:column}.iot-sem b{font-size:17px}.iot-sem small{color:var(--tx3);font-size:12.5px}
  .iot-kpi small{display:block;color:var(--tx3);font-size:12.5px}.iot-kpi b{display:block;font-size:19px;font-variant-numeric:tabular-nums;letter-spacing:-.01em;margin:2px 0}
  .iot-ins{margin-bottom:14px}
  .ins-head{display:flex;align-items:center;gap:12px;margin-bottom:12px}
  .ins-head .simi-svg{width:40px;height:40px;flex-shrink:0}
  .ins-head div{flex:1;min-width:0;display:flex;flex-direction:column}.ins-head b{font-size:16px}.ins-head small{color:var(--tx3);font-size:12.5px}
  .ins-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
  .ins{background:var(--s2);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:6px}
  .ins-k{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--violet,#8B7BF7)}
  .ins-k svg{width:15px;height:15px}
  .ins.prediccion .ins-k{color:var(--amber)}.ins.causa .ins-k{color:#FF7A7A}.ins.mant .ins-k{color:var(--ice,#3FC5E8)}.ins.efic .ins-k{color:var(--st-cerrado,#1FCB7E)}
  .ins b{font-size:14.5px;line-height:1.35}.ins p{margin:0;color:var(--tx2);font-size:13px;line-height:1.5}
  .ins-a{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;align-items:center}
  .ins-a button{height:30px;padding:0 12px;border-radius:999px;border:0;background:var(--s3);color:var(--tx);font:600 12.5px var(--sans);cursor:pointer}
  .ins-a>button:first-child{background:var(--amber);color:#1A1206}
  .ins-fb{margin-left:auto;display:flex;gap:4px}.ins-fb button{background:transparent!important;color:var(--tx3)!important;padding:0 8px!important}
  .ins-fb button:hover{color:var(--tx)!important}
  .iot-alertas{margin-bottom:6px}.iot-alertas:empty{display:none}
  .iot-alertas h3{display:flex;align-items:baseline;gap:8px;margin:0 0 10px;font-size:16px}
  .iot-alertas h3 small{color:var(--tx3);font-weight:500;font-size:13px}
  .iot-link{margin-left:auto;border:0;background:transparent;color:var(--amber);font:600 13px var(--sans);cursor:pointer}
  .iot-al{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
  .iot-al li{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:14px;background:var(--s2);font-size:13.5px;line-height:1.45;color:var(--tx2)}
  .iot-al li>i{flex-shrink:0;width:10px;height:10px;border-radius:50%;background:var(--amber)}
  .iot-al li.crit>i{background:#FF5C5C}.iot-al li.crit{background:rgba(255,92,92,.09)}.iot-al li.ack,.iot-al li.pos{opacity:.72}
  .iot-al b{color:var(--tx)}.iot-al em{font-style:normal;font-weight:600;color:var(--tx3);margin-left:4px}
  .iot-al .ia-acc{margin-left:auto;display:flex;gap:6px;flex-shrink:0}
  .iot-al button{height:32px;padding:0 12px;border-radius:999px;border:0;background:var(--s3);color:var(--tx);font:600 12.5px var(--sans);cursor:pointer}
  .iot-al button:first-child{background:var(--amber);color:#1A1206}
  .iot-vacio{margin:0;color:var(--tx2);font-size:14px}
  .iot-h{margin:22px 0 10px;font-size:16px;letter-spacing:-.01em}
  .iot-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  .iot-grid.g2{grid-template-columns:repeat(2,1fr)}
  .iot-t{--c:var(--st-cerrado,#1FCB7E);display:flex;flex-direction:column;gap:4px;text-align:left;border:0;cursor:pointer;font:inherit;color:var(--tx);background:var(--s1);border-radius:20px;padding:16px;box-shadow:var(--sh-card,none);transition:background .2s,box-shadow .2s}
  .iot-t:hover{background:var(--s2)}
  .iot-t:focus-visible{outline:2px solid var(--amber);outline-offset:2px}
  .iot-t.adv{--c:var(--amber)}.iot-t.crit{--c:#FF5C5C;box-shadow:inset 0 0 0 1.5px rgba(255,92,92,.55)}
  .iot-t.off{--c:var(--tx3)}.iot-t.desc{--c:var(--ice,#3FC5E8)}
  .iot-t.iot-foco{box-shadow:inset 0 0 0 2px var(--amber)}
  .al-card.iot-foco{box-shadow:inset 0 0 0 2px var(--c);transition:box-shadow .2s}
  .iot-top{display:flex;align-items:center;gap:8px}.iot-top b{font-size:15px}
  .iot-est{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--c)}
  .iot-est i{width:8px;height:8px;border-radius:50%;background:var(--c)}
  .iot-sub{font-size:12.5px;color:var(--tx3)}
  .iot-v{font-size:28px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin-top:4px}
  .iot-t.crit .iot-v{color:#FF7A7A}.iot-t.adv .iot-v{color:var(--amber)}
  .iot-spw{position:relative;height:56px;margin:18px 6px 18px 0;color:var(--c)}
  .iot-sp{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
  .iot-spl{fill:none;stroke:currentColor;stroke-width:2;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke}
  .iot-lim{stroke:var(--tx3);stroke-width:1;stroke-dasharray:3 4;vector-effect:non-scaling-stroke;opacity:.7}
  .iot-lime{position:absolute;left:0;transform:translateY(calc(-100% - 3px));font-size:10.5px;font-weight:600;color:var(--tx3);font-variant-numeric:tabular-nums;line-height:1;white-space:nowrap}.iot-lime.ab{transform:translateY(3px)}
  .iot-dot{position:absolute;right:-4px;width:8px;height:8px;margin-top:-4px;border-radius:50%;background:currentColor;box-shadow:0 0 0 3px var(--s1),0 0 0 5px color-mix(in srgb,currentColor 30%,transparent)}
  .iot-t:hover .iot-dot{box-shadow:0 0 0 3px var(--s2),0 0 0 5px color-mix(in srgb,currentColor 30%,transparent)}
  .iot-meta{font-size:12.5px;color:var(--tx2)}
  .iot-puerta{color:#FF7A7A}
  .iot-bar{display:block;height:6px;border-radius:99px;background:var(--s3);overflow:hidden;margin-top:4px}
  .iot-bar i{display:block;height:100%;background:var(--c);border-radius:99px}
  .iot-tab{cursor:default;--c:var(--violet,#8B7BF7)}
  .iot-fila{display:grid;grid-template-columns:1fr auto;gap:2px 8px;font-size:13px;color:var(--tx2);margin-top:6px}
  .iot-fila b{color:var(--tx);font-variant-numeric:tabular-nums}.iot-fila .iot-bar{grid-column:1/-1;margin-top:0}
  .h-ctrl{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
  .h-dias{display:flex;gap:6px;flex-wrap:wrap}
  .h-dias button{height:36px;padding:0 14px;border-radius:999px;border:0;background:var(--s1);color:var(--tx2);font:600 13px var(--sans);cursor:pointer}
  .h-dias button.on{background:var(--tx);color:var(--bg)}
  #hSensor{height:38px;border-radius:12px!important;padding:0 10px;font:500 13.5px var(--sans);color:var(--tx);width:auto!important;min-width:220px}
  .h-box{margin-bottom:14px}
  .h-tit{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:8px}.h-tit b{font-size:16px}.h-tit small{color:var(--tx3);font-size:12.5px}
  .h-tip{margin-left:auto;font-weight:700;font-variant-numeric:tabular-nums;color:var(--amber)}
  .h-graf{width:100%;height:auto;display:block;touch-action:pan-y}
  .h-graf{--hc:var(--ice,#3FC5E8)}
  .h-grid{stroke:var(--tx);stroke-opacity:.07;stroke-width:1}.h-eje{stroke:var(--tx);stroke-opacity:.22;stroke-width:1}.h-tk{stroke:var(--tx);stroke-opacity:.22}
  .h-ty,.h-tx{fill:var(--tx3);font:500 11px var(--sans);font-variant-numeric:tabular-nums}.h-ty{text-anchor:end}.h-tx{text-anchor:middle}.h-u{font-weight:700}
  .h-ga0{stop-color:var(--hc);stop-opacity:.20}.h-ga1{stop-color:var(--hc);stop-opacity:0}
  .h-linea{fill:none;stroke:var(--hc);stroke-width:2.25;stroke-linejoin:round;stroke-linecap:round}.h-linea.fuera{stroke:#FF5C5C}
  .h-lim{stroke:var(--amber);stroke-width:1.25;stroke-dasharray:5 5;stroke-opacity:.85}.h-limt{fill:var(--amber);font:700 11px var(--sans);font-variant-numeric:tabular-nums}
  .hz-f{fill:#FF5C5C;fill-opacity:.09}.hz-t{fill:#FF5C5C}
  .h-ahora{stroke:var(--tx2);stroke-width:1;stroke-dasharray:2 4}.h-ahorat{fill:var(--tx2);font:600 10.5px var(--sans);text-anchor:middle}
  .h-cur{stroke:var(--tx2);stroke-width:1;stroke-dasharray:3 3}.h-pt{fill:var(--hc);stroke:var(--s1);stroke-width:2.5}.h-pt.fuera{fill:#FF5C5C}
  .h-leyenda{display:flex;gap:16px;font-size:12.5px;color:var(--tx3);margin-top:6px}
  .h-leyenda span{display:inline-flex;align-items:center;gap:6px}.lz{width:14px;height:10px;border-radius:3px;display:inline-block}.lz.al{background:rgba(255,92,92,.18);box-shadow:inset 0 2px 0 #FF5C5C}
  .ll{width:18px;height:0;display:inline-block;border-top:2.5px solid var(--ice,#3FC5E8);border-radius:2px}.ll.out{border-color:#FF5C5C}.ll.lim{border-top:1.5px dashed var(--amber)}
  .h-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:14px}
  .h-stats div{background:var(--s2);border-radius:14px;padding:10px 12px}.h-stats small{display:block;color:var(--tx3);font-size:12px}.h-stats b{font-variant-numeric:tabular-nums}
  .h-tabla{overflow-x:auto}
  .h-tabla table{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}
  .h-tabla th{text-align:left;color:var(--tx3);font-weight:500;padding:8px 10px;white-space:nowrap}
  .h-tabla td{padding:9px 10px;border-top:1px solid var(--line);white-space:nowrap;color:var(--tx2)}
  .h-tabla td:first-child{color:var(--tx);font-weight:600}.h-tabla tr.on td{background:var(--s2)}
  .h-tabla small{color:var(--tx3);font-weight:500}
  .sev{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--amber);margin-right:8px}.sev.crit{background:#FF5C5C}.sev.sindatos{background:var(--tx3)}
  .al-card{background:var(--s2);border-radius:16px;padding:14px;margin-bottom:10px;--c:var(--amber)}
  .al-card.crit{--c:#FF5C5C;background:rgba(255,92,92,.08)}
  .al-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.al-top .iot-est{margin-left:0}.al-top small{color:var(--tx3);margin-left:auto}
  .al-card p{margin:8px 0;color:var(--tx2);font-size:13.5px;line-height:1.5}
  .al-acc{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
  .al-ok{font-size:12.5px;color:var(--tx3);font-weight:600;padding:0 6px}
  .esc{list-style:none;margin:6px 0 10px;padding:0 0 0 4px;display:flex;flex-direction:column;align-items:stretch;gap:8px;text-align:left}
  .esc li{position:relative;padding-left:20px;display:flex;flex-direction:column;align-items:flex-start;font-size:13px;text-align:left}
  .esc li::before{content:"";position:absolute;left:0;top:5px;width:10px;height:10px;border-radius:50%;box-shadow:inset 0 0 0 2px var(--tx3)}
  .esc li.done::before{background:var(--st-cerrado,#1FCB7E);box-shadow:none}.esc li.skip{opacity:.55}
  .esc li.next::before{box-shadow:inset 0 0 0 2px var(--amber)}
  .esc b{font-size:13.5px}.esc span{color:var(--tx2)}
  .esc.pol li.done::before{background:var(--violet,#8B7BF7)}
  .pol-n{color:var(--tx2);font-size:13px;line-height:1.5;margin:6px 0 12px}
  .mx-check.top li::before{display:none}
  .iot-toast{position:fixed;right:20px;bottom:96px;z-index:60;width:min(400px,calc(100vw - 24px));display:flex;gap:12px;align-items:flex-start;background:var(--s1);border-radius:20px;padding:14px 16px;box-shadow:0 20px 50px -18px rgba(0,0,0,.8),inset 0 0 0 1.5px var(--amber);
    transform:translateY(16px);opacity:0;visibility:hidden;pointer-events:none;transition:transform .25s cubic-bezier(.2,.7,.2,1),opacity .25s,visibility 0s .25s}
  .iot-toast.crit{box-shadow:0 20px 50px -18px rgba(0,0,0,.8),inset 0 0 0 1.5px #FF5C5C}
  .iot-toast.ok{box-shadow:0 20px 50px -18px rgba(0,0,0,.8),inset 0 0 0 1.5px var(--st-cerrado,#1FCB7E)}
  .iot-toast.show{transform:none;opacity:1;visibility:visible;pointer-events:auto;transition:transform .25s cubic-bezier(.2,.7,.2,1),opacity .25s,visibility 0s}
  .iot-toast .simi-svg{width:44px;height:44px;flex-shrink:0}
  .iot-toast .it-c{flex:1;min-width:0}.iot-toast small{color:var(--tx3);font-size:12px}
  .iot-toast b{display:block;font-size:15px;margin:2px 0}.iot-toast p{margin:0;color:var(--tx2);font-size:13.5px;line-height:1.45}
  .iot-toast .it-a{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
  .it-b{height:34px;padding:0 14px;border-radius:999px;border:0;background:var(--s2);color:var(--tx);font:600 13px var(--sans);cursor:pointer;white-space:nowrap}
  .it-b.pri{background:var(--amber);color:#1A1206}
  .it-x{border:0;background:transparent;color:var(--tx3);font-size:22px;line-height:1;cursor:pointer;padding:0 2px}
  html[data-theme="light"] .iot-toast{box-shadow:0 20px 50px -20px rgba(16,24,32,.35),inset 0 0 0 1.5px var(--amber)}
  @media (max-width:1100px){.iot-resumen{grid-template-columns:repeat(4,1fr)}.iot-sem{grid-column:1/-1}.iot-resumen.kpis4{grid-template-columns:1fr 1fr}}
  @media (max-width:1000px){.iot-grid{grid-template-columns:repeat(2,1fr)}.ins-grid{grid-template-columns:1fr}.h-stats{grid-template-columns:repeat(3,1fr)}}
  @media (max-width:640px){
    .mx-sub{display:block;margin:2px 0 0;font-size:13px}
    .iot-tabs button{font-size:12.5px;padding:0 6px}
    .iot-grid,.iot-grid.g2{grid-template-columns:1fr 1fr;gap:10px}
    .iot-t{padding:12px;border-radius:16px}.iot-v{font-size:21px}.iot-top b{font-size:14px}.iot-est{font-size:11px}
    .iot-tab{grid-column:1/-1}
    .iot-resumen{grid-template-columns:1fr 1fr;gap:8px}.iot-kpi{padding:10px 12px}.iot-kpi b{font-size:15px}
    .iot-al li{flex-wrap:wrap}.iot-al .ia-acc{margin-left:22px}
    .h-stats{grid-template-columns:1fr 1fr}#hSensor{flex:1;min-width:0}
    .iot-toast{right:12px;bottom:84px;padding:12px 14px}.iot-toast p{font-size:13px}.iot-toast .simi-svg{width:36px;height:36px}
    .iot-menu{width:min(300px,calc(100vw - 32px))}
    .ins-head{flex-wrap:wrap}.ins-head .it-b{width:100%}.ins-fb{margin-left:0}
  }
  @media (prefers-reduced-motion:reduce){.iot-toast{transition:none}}
  `;
  const st = document.createElement('style'); st.id = 'simaIotCss'; st.textContent = css; document.head.appendChild(st);
})();
