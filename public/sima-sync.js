/* =====================================================================
   SIMA · Capa de sincronización offline-first
   ---------------------------------------------------------------------
   La app sigue funcionando exactamente igual sin conexión: localStorage
   es la fuente de verdad para la interfaz. Esta capa empuja los cambios
   a Cloudflare D1/R2 cuando hay red, y trae lo que hicieron los demás.

   Si la API no responde, la app queda en modo local y no se rompe nada.
   ===================================================================== */
(function () {
  'use strict';

  const API = '/api';
  const DEBOUNCE = 1500;      // ms de espera antes de empujar cambios
  const REINTENTO = 60000;    // ms entre reintentos cuando falla la red
  const LOTE = 40;            // registros por pedido (el servidor acepta hasta 80)
  const REFRESCO = 30000;     // ms entre traídas automáticas con la app a la vista
  const COMPLETA_CADA = 300000; // ms: cada tanto se trae el estado ENTERO, no el incremental
  const K_ESPEJO = 'sima.espejo';
  const K_ULTIMO = 'sima.ultimoSync';

  let conectado = false;
  let usuario = null;
  let empujando = false;
  let sincronizando = false;
  let ultimaCompleta = 0;
  let guardandoInterno = false;
  let tDebounce = null;
  let pendientes = 0;
  let espejo = { lev: {}, rec: {}, cfg: '' };

  const ahora = () => new Date().toISOString();

  /* En las vistas largas (Configuración, sobre todo) el scroll no es de la
     ventana sino del contenedor <main>, que tiene overflow-y:auto. render()
     reconstruye su contenido y scrollTop vuelve a 0: si un refresco cae
     mientras la persona está bajando con la rueda, la pantalla "rebota"
     al tope. Como ahora el refresco es periódico y no una sola vez al
     arrancar, hay que devolver el scroll a donde estaba. */
  /* Si la persona está escribiendo en un campo de la pantalla (buscador,
     nombre de sector, etc.), redibujar le borraría lo tipeado y cerraría el
     teclado del celular: se espera a que salga del campo. */
  let redibujoPendiente = false;
  function escribiendo() {
    const a = document.activeElement;
    return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !!a.closest('#mainInner');
  }
  document.addEventListener('focusout', () => {
    if (!redibujoPendiente) return;
    setTimeout(() => { if (redibujoPendiente && !escribiendo()) { redibujoPendiente = false; redibujarSinSaltar(); } }, 50);
  });
  function redibujarSinSaltar() {
    if (typeof render !== 'function') return;
    if (escribiendo()) { redibujoPendiente = true; return; }
    const cont = document.querySelector('main');
    const y = cont ? cont.scrollTop : 0;
    const yDoc = window.scrollY || 0;
    render();
    if (cont && y) { cont.scrollTop = y; requestAnimationFrame(() => { cont.scrollTop = y; }); }
    if (yDoc) window.scrollTo(0, yDoc);
  }

  // save() sin reabrir el ciclo de empuje: lo usa la propia sincronización
  // cuando sólo necesita persistir en localStorage lo que acaba de bajar.
  function guardarLocal() {
    if (typeof save !== 'function') return;
    guardandoInterno = true;
    try { save(); } finally { guardandoInterno = false; }
  }
  const firma = o => JSON.stringify(o);
  const sinTs = o => { const c = { ...o }; delete c.actualizado; return firma(c); };
  // La firma de la configuración NO incluye los contadores: crear un hallazgo
  // cambiaba seq y hacía creer que había configuración sin subir, y un equipo
  // desactualizado terminaba pisando la estructura buena del servidor.
  const firmaCfg = () => firma({ estructura: DB.estructura, tecnicos: DB.tecnicos });
  const pendienteLocal = (esp, x) => esp[x.id] !== sinTs(x);
  /* Contadores: sólo suben. Además nunca quedan por debajo del número más
     alto que ya existe, para no volver a repartir un LV-/REC- usado. */
  function subirContadores(seqSrv, recSeqSrv) {
    const num = (id, n) => parseInt(String(id || '').slice(n), 10) || 0;
    const maxLev = Math.max(0, ...(DB.levantamientos || []).map(l => num(l.id, 3)));
    const maxRec = Math.max(0, ...(DB.recorridos || []).map(r => num(r.id, 4)));
    const seq = Math.max(DB.seq || 1, +seqSrv || 0, maxLev + 1);
    const recSeq = Math.max(DB.recSeq || 1, +recSeqSrv || 0, maxRec + 1);
    const cambio = seq !== DB.seq || recSeq !== DB.recSeq;
    DB.seq = seq; DB.recSeq = recSeq;
    return cambio;
  }

  /* ---------- Indicador visual ------------------------------------- */
  function chip() {
    let el = document.getElementById('syncChip');
    if (!el) {
      el = document.createElement('button');
      el.id = 'syncChip';
      el.type = 'button';
      el.title = 'Estado de sincronización — tocá para sincronizar ahora';
      el.onclick = () => sincronizar(true);
      const estilos = document.createElement('style');
      estilos.textContent = `
        #syncChip{
          display:flex;align-items:center;gap:8px;width:100%;
          padding:9px 12px;border-radius:10px;cursor:pointer;
          background:var(--s2);border:1px solid var(--line);color:var(--tx2);
          font-family:var(--mono);font-size:10px;letter-spacing:.06em;font-weight:600;
          transition:.16s var(--ease);white-space:nowrap;text-align:left;
        }
        #syncChip:hover{background:var(--s3);color:var(--tx)}
        #syncChip i{width:9px;height:9px;border-radius:2px;background:var(--tx3);flex-shrink:0;display:block}
        #syncChip.on i{background:var(--green)}
        #syncChip.off i{background:var(--tx3)}
        #syncChip.pend i{background:var(--amber);animation:pulse 1.6s infinite}
        #syncChip.err i{background:var(--red)}`;
      document.head.appendChild(estilos);
      const destino = document.getElementById('railFootFixed');
      if (destino) destino.appendChild(el);
      else document.querySelector('.topbar')?.appendChild(el);
    }
    return el;
  }
  function estado(clase, texto) {
    const el = chip();
    el.className = clase;
    el.innerHTML = `<i></i><span>${texto}</span>`;
  }
  function refrescarChip() {
    if (!conectado) {
      try { pendientes = cambios().lev.length + cambios().rec.length; } catch (_) {}
      return estado('off', pendientes ? `MODO LOCAL · ${pendientes} SIN SUBIR` : 'MODO LOCAL');
    }
    if (pendientes)  return estado('pend', pendientes + ' POR SUBIR');
    estado('on', 'SINCRONIZADO');
  }

  /* ---------- Utilidades de red ------------------------------------ */
  /* Distingue dos tipos de fallo:
       - Permiso (4xx): el servidor contestó, no es un problema de red.
       - Red (fetch falla o 5xx): reintentar más tarde.                  */
  class ErrorPermiso extends Error {}
  async function pedir(ruta, opciones) {
    let r;
    try {
      r = await fetch(API + ruta, { headers: { 'Content-Type': 'application/json' }, cache: 'no-store', ...opciones });
    } catch (e) {
      throw new Error('Sin red: ' + ruta);
    }
    if (!r.ok) {
      const texto = await r.text().catch(() => '');
      if (r.status >= 400 && r.status < 500) throw new ErrorPermiso('HTTP ' + r.status + ': ' + texto.slice(0, 160));
      throw new Error('HTTP ' + r.status + ' en ' + ruta);
    }
    return r.json();
  }

  /* ---------- Espejo: qué ya subimos ------------------------------- */
  function cargarEspejo() {
    try { espejo = JSON.parse(localStorage.getItem(K_ESPEJO)) || espejo; } catch (_) {}
  }
  function guardarEspejo() {
    try { localStorage.setItem(K_ESPEJO, JSON.stringify(espejo)); } catch (_) {}
  }

  /* ---------- Detección de cambios locales ------------------------- */
  function cambios() {
    const lev = [], rec = [];
    (DB.levantamientos || []).forEach(l => {
      const f = sinTs(l);
      if (espejo.lev[l.id] !== f) { l.actualizado = ahora(); lev.push(l); }
    });
    (DB.recorridos || []).forEach(r => {
      const f = sinTs(r);
      if (espejo.rec[r.id] !== f) { r.actualizado = ahora(); rec.push(r); }
    });
    const cfg = firmaCfg();
    return { lev, rec, cfg: espejo.cfg === cfg ? null : cfg };
  }

  /* ---------- Fotos: data URL → R2 --------------------------------- */
  async function subirFotos(l) {
    for (const campo of ['fotoDet', 'fotoEjec', 'fotoVal']) {
      const v = l[campo];
      if (typeof v === 'string' && v.startsWith('data:image/')) {
        const r = await pedir('/foto', {
          method: 'POST',
          body: JSON.stringify({ dataUrl: v, id: l.id, tipo: campo.replace('foto', '').toLowerCase() })
        });
        l[campo] = r.url;   // queda como /api/foto/<clave>; el Service Worker la cachea
      }
    }
  }

  /* ---------- Empuje ----------------------------------------------- */
  async function empujar() {
    if (empujando || !conectado) return;
    const c = cambios();
    /* Usuario vista (sólo lectura): nunca sube nada. Lo que cambie en el
       dispositivo (normalizaciones al cargar) se da por visto y la próxima
       traída lo reemplaza por la versión del servidor. */
    if (typeof role !== 'undefined' && role === 'vista') {
      c.lev.forEach(l => { espejo.lev[l.id] = sinTs(l); });
      c.rec.forEach(r => { espejo.rec[r.id] = sinTs(r); });
      if (c.cfg) espejo.cfg = c.cfg;
      guardarEspejo(); pendientes = 0; refrescarChip(); return;
    }
    pendientes = c.lev.length + c.rec.length + (c.cfg ? 1 : 0);
    if (!pendientes) { refrescarChip(); return; }
    empujando = true;
    estado('pend', 'SUBIENDO…');
    try {
      // Una foto rechazada (muy grande, formato raro) ya no frena todo: ese
      // hallazgo queda pendiente en el dispositivo y el resto sube igual.
      const fotoFallida = [];
      for (const l of c.lev) {
        try { await subirFotos(l); }
        catch (e) { if (e instanceof ErrorPermiso) fotoFallida.push(l); else throw e; }
      }
      if (fotoFallida.length && typeof toast === 'function')
        toast('err', 'Una foto no se pudo subir', fotoFallida.map(l => l.id).join(', ') + ' queda guardado en este dispositivo. Volvé a tomar la foto desde el hallazgo.');
      const lev = c.lev.filter(l => !fotoFallida.includes(l));

      // Las fotos ya subidas quedan guardadas aunque después falle un lote.
      if (c.lev.length) guardarLocal();

      /* Se envía en lotes de LOTE registros: el servidor acepta como máximo
         80 por pedido, y un dispositivo con muchos cambios acumulados (una
         carga grande, días sin señal) quedaba trabado para siempre con
         «HTTP 413 · Máximo 80 hallazgos por envío». Cada lote que entra se
         da por subido enseguida: si se corta a mitad, lo ya enviado no se
         repite. */
      for (let k = 0; k < lev.length; k += LOTE) {
        const parte = lev.slice(k, k + LOTE);
        // La firma se toma ANTES de enviar: si alguien edita el registro
        // mientras viaja, ese cambio queda pendiente para el próximo envío.
        const firmas = parte.map(sinTs);
        const resp = await pedir('/levantamientos', { method: 'PUT', body: JSON.stringify(parte) });
        parte.forEach((l, i) => { espejo.lev[l.id] = firmas[i]; });
        // Número repetido entre dos dispositivos: el servidor renumeró este.
        Object.entries((resp && resp.remap) || {}).forEach(([viejo, nuevo]) => {
          const l = lev.find(x => x.id === viejo);
          if (!l) return;
          delete espejo.lev[viejo];
          l.id = nuevo;
          (l.hist = l.hist || []).push({ e: 'Renumerado', by: 'Sistema', d: new Date().toISOString().slice(0, 16).replace('T', ' '), n: `${viejo} ya existía en otro dispositivo; este hallazgo pasa a ser ${nuevo}` });
          espejo.lev[nuevo] = sinTs(l);
          if (typeof toast === 'function') toast('info', 'Hallazgo renumerado', `${viejo} ya estaba usado en otro dispositivo: ahora es ${nuevo}.`);
        });
        // Lo que el servidor no aceptó por permisos se descarta en la próxima
        // traída (el espejo ya lo da por enviado, así que gana el servidor).
        const rech = (resp && resp.rechazados) || [];
        if (rech.length && typeof toast === 'function')
          toast('err', 'Cambios no guardados', `${rech.length} cambio(s) no se guardaron porque tu usuario no tiene permiso sobre ese trabajo: ${rech.slice(0, 5).join(', ')}.`);
        guardarEspejo();
        if (lev.length > LOTE) estado('pend', `SUBIENDO… ${Math.min(k + LOTE, lev.length)}/${lev.length}`);
      }
      for (let k = 0; k < c.rec.length; k += LOTE) {
        const parte = c.rec.slice(k, k + LOTE);
        const firmas = parte.map(sinTs);
        await pedir('/recorridos', { method: 'PUT', body: JSON.stringify(parte) });
        parte.forEach((r, i) => { espejo.rec[r.id] = firmas[i]; });
        guardarEspejo();
      }
      if (c.cfg) {
        try {
          await pedir('/config', {
            method: 'PUT',
            body: JSON.stringify({ estructura: DB.estructura, tecnicos: DB.tecnicos, seq: DB.seq, recSeq: DB.recSeq })
          });
          espejo.cfg = c.cfg;
        } catch (e) {
          // Un rol sin permiso de configuración no debe bloquear el resto:
          // sus cambios de estructura quedan sólo en su dispositivo.
          if (e instanceof ErrorPermiso) espejo.cfg = c.cfg;
          else throw e;
        }
      }
      guardarEspejo();
      subirContadores();
      // (K_ULTIMO ya no se toca acá: sólo guarda la hora del SERVIDOR que
      // devuelve /estado, nunca la del reloj de este dispositivo.)
      pendientes = cambios().lev.length;
      guardarLocal();   // persiste las URLs de R2 ya resueltas
      refrescarChip();
    } catch (e) {
      if (e instanceof ErrorPermiso) {
        estado('err', 'SIN PERMISO');
        if (typeof toast === 'function') toast('err', 'El servidor rechazó el cambio', e.message);
      } else {
        conectado = false;
        estado('err', 'SIN SUBIR');
        setTimeout(() => sincronizar(), REINTENTO);
      }
    } finally {
      empujando = false;
    }
  }

  /* ---------- Traída ------------------------------------------------ */
  async function traer(completa) {
    const desde = completa ? null : localStorage.getItem(K_ULTIMO);
    const d = await pedir('/estado' + (desde ? '?desde=' + encodeURIComponent(desde) : ''));
    let tocado = false;

    /* Fusión por identificador, nunca por posición: insertar en el array
       mientras se recorre desplaza los índices y duplica registros. */
    /* Regla de fusión (12-10-26): si este dispositivo tiene un cambio
       todavía sin subir sobre ese registro, se conserva lo local y se sube
       después. Si no, manda el servidor. Antes se comparaban horas de los
       relojes de cada equipo y, al volver la señal, un cierre hecho sin
       conexión podía quedar pisado por la versión del servidor sin aviso. */
    function fusionar(locales, servidor, marcar, ordenar, esp) {
      const por = new Map();
      (locales || []).forEach(x => por.set(x.id, x));
      let cambio = false;
      (servidor || []).forEach(sv => {
        const lo = por.get(sv.id);
        if (lo && pendienteLocal(esp, lo)) return;          // gana lo local, todavía sin subir
        if (!lo || sinTs(lo) !== sinTs(sv)) { por.set(sv.id, sv); cambio = true; }
        marcar(sv);
      });
      const lista = [...por.values()];
      if (ordenar) lista.sort(ordenar);
      return { lista, cambio };
    }

    const fl = fusionar(DB.levantamientos, d.levantamientos,
      sv => { espejo.lev[sv.id] = sinTs(sv); },
      (a, b) => (b.fechaDet || '').localeCompare(a.fechaDet || ''), espejo.lev);
    if (fl.cambio) { DB.levantamientos = fl.lista; tocado = true; }

    const fr = fusionar(DB.recorridos, d.recorridos,
      sv => { espejo.rec[sv.id] = sinTs(sv); },
      (a, b) => (b.fecha || '').localeCompare(a.fecha || ''), espejo.rec);
    if (fr.cambio) { DB.recorridos = fr.lista; tocado = true; }

    /* Purga: lo borrado en el servidor se borra también acá.
       fusionar() sólo agrega y actualiza — nunca saca nada —, así que un
       registro eliminado de D1 sobrevivía para siempre en cada dispositivo que
       alguna vez lo bajó, y volvía a subirse a la base si alguien lo editaba.

       Sólo se puede decidir esto con el estado ENTERO a la vista: en una traída
       incremental (?desde=) la ausencia de un registro no significa nada.
       Y sólo se quita lo que este dispositivo YA había sincronizado (tiene
       entrada en el espejo): lo cargado sin señal, todavía sin subir, se
       respeta siempre. */
    if (completa) {
      const purgar = (lista, servidor, esp) => {
        const enServidor = new Set((servidor || []).map(x => x.id));
        const quedan = [];
        let quitados = 0;
        (lista || []).forEach(x => {
          const yaSubido = esp[x.id] !== undefined;
          if (yaSubido && !enServidor.has(x.id)) { delete esp[x.id]; quitados++; return; }
          quedan.push(x);
        });
        return { quedan, quitados };
      };
      const pl = purgar(DB.levantamientos, d.levantamientos, espejo.lev);
      if (pl.quitados) { DB.levantamientos = pl.quedan; tocado = true; }
      const pr = purgar(DB.recorridos, d.recorridos, espejo.rec);
      if (pr.quitados) { DB.recorridos = pr.quedan; tocado = true; }
    }

    /* Configuración: estructura de áreas/sectores y padrón de técnicos, cada
       uno separado por planta ({planta2:..., planta8:...}) — nunca se pisan
       entre sí.

       Antes esto sólo se aplicaba cuando `completa` era verdadero, y eso pasa
       una sola vez por dispositivo (la primera sincronización, cuando todavía
       no existe sima.ultimoSync). Resultado: un sector agregado desde otro
       equipo no llegaba NUNCA — cada dispositivo se quedaba congelado con la
       copia que bajó la primera vez, o peor, con la estructura por defecto.

       Ahora el servidor manda en cada traída. La única excepción es que este
       dispositivo tenga cambios propios de configuración todavía sin subir:
       en ese caso gana lo local y empujar() los sube enseguida, así no se
       pierde lo que alguien acaba de cargar sin conexión. */
    const cfgActual = firmaCfg();
    const hayCambiosLocalesSinSubir = !!espejo.cfg && espejo.cfg !== cfgActual;
    const aceptarDelServidor = completa || !hayCambiosLocalesSinSubir;

    /* normalizarCfg() (definida en index.html) deja las dos plantas siempre
       presentes, aunque estén vacías. Es lo que hace estable la comparación:
       el servidor omite la planta que no tiene filas, y sin normalizar la
       diferencia se vería como un cambio en cada ciclo, redibujando la
       pantalla cada 30 segundos y bloqueando la bajada de datos. */
    const normalizar = () => { if (typeof normalizarCfg === 'function') normalizarCfg(); };

    if (aceptarDelServidor && d.estructura) {
      const antes = firma(DB.estructura);
      DB.estructura = d.estructura; normalizar();
      if (firma(DB.estructura) !== antes) tocado = true;
    }
    if (aceptarDelServidor && d.tecnicos) {
      const antes = firma(DB.tecnicos);
      DB.tecnicos = d.tecnicos; normalizar();
      if (firma(DB.tecnicos) !== antes) tocado = true;
    }
    /* Base vaciada desde el servidor: el backend manda null cuando no hay
       filas. Sin esto, el dispositivo se quedaba con su copia vieja para
       siempre — que es justo lo que pasa al limpiar la base. */
    if (aceptarDelServidor && completa && !d.estructura) {
      const antes = firma(DB.estructura);
      DB.estructura = {}; normalizar();
      if (firma(DB.estructura) !== antes) tocado = true;
    }
    if (aceptarDelServidor && completa && !d.tecnicos) {
      const antes = firma(DB.tecnicos);
      DB.tecnicos = {}; normalizar();
      if (firma(DB.tecnicos) !== antes) tocado = true;
    }
    normalizar();
    /* Contadores de numeración: sólo suben (antes podían bajar al valor del
       servidor y el siguiente hallazgo repetía un número ya usado, pisando
       al anterior). */
    if (subirContadores(d.seq, d.recSeq)) tocado = true;
    if (aceptarDelServidor) espejo.cfg = firmaCfg();

    if (tocado) {
      guardarEspejo();
      guardarLocal();
      redibujarSinSaltar();
    }
    if (d.ts) localStorage.setItem(K_ULTIMO, d.ts);
    return tocado;
  }

  /* ---------- Ciclo ------------------------------------------------- */
  async function sincronizar(manual) {
    // Evita que el refresco automático se pise con una sincronización en
    // curso (o con el botón manual) y termine duplicando pedidos.
    if (sincronizando) return;
    sincronizando = true;
    try {
      const ping = await pedir('/ping').catch(() => null);
      if (!ping) {
        conectado = false; refrescarChip();
        if (manual && typeof toast === 'function')
          toast('err', 'Sin conexión con el servidor', 'Los cambios quedan guardados en el dispositivo.');
        return;
      }
      usuario = ping;
      // index.html decide si esto habilita la app o pide iniciar sesión de
      // nuevo — el nombre/rol reales SIEMPRE vienen del login, no de acá.
      if (typeof confirmarSesion === 'function') confirmarSesion(ping);
      if (ping.anonimo) { conectado = false; refrescarChip(); return; }
      conectado = true;
      try {
        /* Antes la traída completa ocurría UNA sola vez por dispositivo (la
           primera, cuando aún no existía sima.ultimoSync). Sin estado entero no
           se puede detectar nada borrado, así que ahora se hace completa al
           abrir la app y cada tanto; en el medio siguen las incrementales. */
        const completa = !localStorage.getItem(K_ULTIMO) || (Date.now() - ultimaCompleta) > COMPLETA_CADA;
        await traer(completa);
        if (completa) ultimaCompleta = Date.now();
        await empujar();
        if (manual && typeof toast === 'function')
          toast('ok', 'Sincronizado', 'Datos al día con el servidor.');
      } catch (e) {
        conectado = false; estado('err', 'ERROR');
        if (manual && typeof toast === 'function') toast('err', 'No se pudo sincronizar', e.message);
      }
    } finally {
      sincronizando = false;
    }
  }

  /* ---------- Enganche con save() ---------------------------------- */
  function enganchar() {
    if (typeof save !== 'function') return;
    const original = save;
    window.save = function () {
      original.apply(this, arguments);
      // Guardado disparado por la propia sincronización: no vuelve a encolar
      // un empuje, si no cada subida agenda la siguiente y el ciclo no cierra.
      if (guardandoInterno) return;
      if (!conectado) { refrescarChip(); return; }
      clearTimeout(tDebounce);
      tDebounce = setTimeout(empujar, DEBOUNCE);
    };
  }

  /* ---------- Arranque ---------------------------------------------- */
  function iniciar() {
    cargarEspejo();
    chip(); refrescarChip();
    enganchar();
    sincronizar();

    window.addEventListener('online', () => sincronizar());
    window.addEventListener('offline', () => { conectado = false; refrescarChip(); });

    /* Refresco automático. Antes este intervalo sólo reintentaba con la
       conexión caída (`if (!conectado)`), así que estando conectado la app no
       volvía a traer nada del servidor hasta recargar la página entera — de
       ahí que hubiera que tocar el botón del sidebar a mano. Ahora también
       refresca conectado, pero sólo con la pestaña/app a la vista, para no
       gastar datos ni batería en segundo plano. */
    setInterval(() => {
      if (!conectado) { sincronizar(); return; }
      if (document.visibilityState === 'visible') sincronizar();
    }, REFRESCO);

    /* Al ocultar: subir lo pendiente. Al volver a la app: traer lo que
       hicieron los demás mientras tanto. Esto es lo que hace que la PWA
       quede al día apenas la abrís desde el ícono, sin tocar nada. */
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') { if (conectado) empujar(); return; }
      sincronizar();
    });

    // Volver con el botón "atrás" o desde el historial en caché del navegador.
    window.addEventListener('pageshow', e => { if (e.persisted) sincronizar(); });

    // Recién iniciada la sesión: traer todo enseguida, sin esperar al
    // próximo ciclo del intervalo.
    window.addEventListener('sima:auth', () => sincronizar());

    if ('serviceWorker' in navigator)
      navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive')
    setTimeout(iniciar, 0);
  else
    document.addEventListener('DOMContentLoaded', iniciar);

  window.SIMASync = { sincronizar, empujar, estadoActual: () => ({ conectado, usuario, pendientes }) };
})();
