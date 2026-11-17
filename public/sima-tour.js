/* =====================================================================
   Recorrido guiado con SIMI (09-11-26)
   ---------------------------------------------------------------------
   En el primer ingreso de cada usuario, SIMI muestra en 6 a 8 pasos cómo
   moverse por SIMA y cómo usarlo a él. Patrón de «product tour» de las
   apps grandes de 2026 (Microsoft 365, Notion, Linear, Figma):
     · bienvenida que se puede posponer, sin obligar;
     · un foco por paso (spotlight) sobre la parte real de la pantalla,
       con el resto atenuado: se aprende el lugar, no una captura;
     · pocas palabras por paso, contador «2 de 7», Atrás / Siguiente,
       «Saltar» siempre a mano;
     · teclado: ← → para moverse, Esc para salir; el foco queda dentro
       del cuadro (role="dialog", aria-modal) y vuelve adonde estaba;
     · se repite cuando se quiera: desde Inicio o pidiéndoselo a SIMI.
   Los pasos cambian según el rol y la pantalla (riel en PC, barra
   inferior en el celular). Si un elemento no está a la vista, el paso se
   salta solo.
   ===================================================================== */
(function () {
  'use strict';
  const K = 'sima.tour.v1';
  const M = () => window.SIMI_M;
  const movil = () => window.matchMedia('(max-width:1000px)').matches;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function quien() {
    try { const id = JSON.parse(localStorage.getItem('sima.identidad') || 'null'); if (id && id.email) return String(id.email).toLowerCase(); } catch (_) {}
    return (typeof role !== 'undefined' ? role : '') || 'anon';
  }
  function hecho(u) {
    try { const v = localStorage.getItem(K) || ''; if (v === '*') return true; return JSON.parse(v || '[]').includes(u); } catch (_) { return false; }
  }
  function marcar(u) {
    try { const v = localStorage.getItem(K); if (v === '*') return; const l = JSON.parse(v || '[]'); if (!l.includes(u)) l.push(u); localStorage.setItem(K, JSON.stringify(l)); localStorage.setItem('sima.simi.visto', '1'); } catch (_) {}
  }

  const nombre = () => { try { return String((ROLES[role] || {}).name || '').trim().split(' ')[0]; } catch (_) { return ''; } };
  function secciones() {
    try { return navFor().map(n => n.l); } catch (_) { return []; }
  }
  const lista = l => l.length > 1 ? l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1] : (l[0] || '');

  function pasos() {
    const r = typeof role !== 'undefined' ? role : '';
    const nav = movil() ? '#tabbar' : '#rail';
    const P = [];
    P.push({ id: 'hola', humor: 'saluda', t: `¡Hola${nombre() ? ', ' + esc(nombre()) : ''}! Soy SIMI`,
      d: 'Te acompaño en SIMA. En menos de un minuto te muestro cómo moverte y cómo pedirme ayuda.', bienvenida: true });
    P.push({ id: 'proximo', sel: '#homeRuta', t: r === 'mantenimiento' ? 'Tu trabajo, primero' : 'La ruta de inspección', humor: 'feliz',
      d: r === 'mantenimiento' ? 'Cada vez que entres, Inicio te dice qué trabajo atender primero. Un toque y vas directo. Al lado me vas a ver trabajando, con consejos de seguridad y calidad.'
        : r === 'inspeccion' ? 'Es lo principal: con este botón comenzás la ruta o seguís la que está en curso. Al lado me vas a ver trabajando y dejando consejos de levantamiento, seguridad y calidad.'
          : 'Desde acá consultás la ruta de inspección. Al lado me vas a ver trabajando y dejando consejos de levantamiento, seguridad y calidad.' });
    P.push({ id: 'secciones', sel: nav, t: 'Las secciones', abrirRiel: true,
      d: `${movil() ? 'Abajo' : 'A la izquierda'} están ${esc(lista(secciones()))}. El número rojo indica cuántos pendientes hay en cada una.${movil() ? '' : ' Acercá el mouse para ver los nombres.'}` });
    P.push({ id: 'mapa', sel: '#homeSecciones', t: 'Si no sabés dónde está algo', d: 'En Inicio cada sección dice para qué sirve. Tocá la que necesites.' });
    P.push({ id: 'avisos', sel: '#notifBell', t: 'Avisos', d: 'La campanita junta lo que espera una acción tuya: hallazgos sin programar, trabajos a verificar y fechas por vencer.' });
    P.push({ id: 'planta', sel: '#plantaBtn', t: 'Planta', d: 'Todo lo que ves es de la planta elegida. Si trabajás en más de una, la cambiás acá.', si: () => { const b = $('plantaBtn'); return b && !b.disabled; } });
    P.push({ id: 'simi', sel: '#simiFab', t: 'Y me encontrás siempre acá', humor: 'saluda',
      d: `En cualquier pantalla: preguntame cómo hacer algo, tus números o cómo reparar una falla. Podés dictarme con el micrófono${movil() ? '' : ' o abrirme con Ctrl + /'}. Si hay trabajos muy atrasados o no conformidades que se repiten, te aviso con un número.` });
    P.push({ id: 'fin', humor: 'salta', t: '¡Listo, ya sabés moverte!', d: 'Te dejo en Inicio. Si querés repetir esta guía, tocá «Ver el recorrido guiado» en Inicio o pedímelo: «recorrido guiado».', final: true });
    return P;
  }

  let T = null;   // estado del recorrido abierto
  function el(sel) {
    if (!sel) return null;
    const e = document.querySelector(sel);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? e : null;
  }
  function iniciar(forzado) {
    if (T) return;
    const app = $('appRoot');
    if (!app || app.hidden) return;
    if (typeof modulo !== 'undefined' && modulo !== 'ruta') return;   // el recorrido guiado es de la Ruta
    const u = quien();
    if (!forzado && hecho(u)) return;
    if (typeof go === 'function' && typeof view !== 'undefined' && view !== 'inicio') go('inicio');
    if (window.simiCerrar) window.simiCerrar();
    const tip = $('simiTip'); if (tip) tip.remove();
    const prev = document.activeElement;
    const ps = pasos();
    const d = document.createElement('div');
    d.className = 'tour'; d.id = 'simaTour';
    d.innerHTML = `<div class="tour-bloq"></div><div class="tour-foco" aria-hidden="true"></div>
      <div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tourT" aria-describedby="tourD">
        <div class="tour-simi">${M() ? M().svg('tour-av') : ''}</div>
        <div class="tour-body">
          <div class="tour-cont" id="tourCont" aria-live="polite"></div>
          <h3 id="tourT"></h3><p id="tourD"></p>
          <div class="tour-acc">
            <button type="button" class="btn btn-quiet btn-sm tour-saltar" id="tourSaltar">Saltar</button>
            <span class="tour-esp"></span>
            <button type="button" class="btn btn-ghost btn-sm" id="tourAtras">Atrás</button>
            <button type="button" class="btn btn-primary btn-sm" id="tourSig">Siguiente</button>
          </div>
          <div class="tour-puntos" aria-hidden="true"></div>
        </div>
      </div>`;
    document.body.appendChild(d);
    T = { d, ps, i: 0, u, prev, rielAbierto: false };
    if (M()) M().vivir(d.querySelector('.tour-av'));
    $('tourSig').addEventListener('click', () => mover(1));
    $('tourAtras').addEventListener('click', () => mover(-1));
    $('tourSaltar').addEventListener('click', () => terminar(false));
    d.addEventListener('keydown', teclado);
    addEventListener('resize', ubicar);
    requestAnimationFrame(() => { d.classList.add('on'); mostrar(); });
  }
  function teclado(e) {
    if (!T) return;
    if (e.key === 'Escape') { e.preventDefault(); terminar(false); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); mover(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); mover(-1); }
    else if (e.key === 'Tab') {   // el foco queda dentro del cuadro
      const f = [...T.d.querySelectorAll('.tour-card button:not([hidden])')];
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  }
  function visibles() { return T.ps.filter(p => (!p.sel || el(p.sel)) && (!p.si || p.si())); }
  function mover(n) {
    const v = visibles(), act = T.ps[T.i], k = v.indexOf(act);
    if (act.final && n > 0) return terminar(true);
    if (act.bienvenida && n < 0) return;
    const sig = v[Math.max(0, Math.min(v.length - 1, k + n))];
    T.i = T.ps.indexOf(sig);
    mostrar();
  }
  function riel(abrir) {
    if (typeof setRail !== 'function' || movil()) return;
    if (abrir && !T.rielAbierto) { setRail(true); T.rielAbierto = true; }
    if (!abrir && T.rielAbierto) { setRail(false); T.rielAbierto = false; }
  }
  function mostrar() {
    const p = T.ps[T.i];
    const v = visibles(), k = v.indexOf(p);
    riel(!!p.abrirRiel);
    const e = el(p.sel);
    if (e && e.scrollIntoView) {
      const r = e.getBoundingClientRect();
      if (r.top < 70 || r.bottom > innerHeight - 20) e.scrollIntoView({ block: 'center', behavior: M() && M().REDUCE ? 'auto' : 'smooth' });
    }
    $('tourT').innerHTML = p.t; $('tourD').innerHTML = p.d;
    $('tourCont').textContent = p.bienvenida ? 'Recorrido guiado' : (p.final ? '¡Terminado!' : `Paso ${k} de ${v.length - 2}`);
    $('tourAtras').hidden = !!p.bienvenida;
    $('tourSaltar').hidden = !!p.final;
    $('tourSig').textContent = p.bienvenida ? 'Empezar' : (p.final ? 'Terminar' : 'Siguiente');
    $('tourSaltar').textContent = p.bienvenida ? 'Ahora no' : 'Saltar';
    T.d.querySelector('.tour-puntos').innerHTML = v.slice(1, -1).map((x, i) => `<i class="${i + 1 === k ? 'on' : ''}"></i>`).join('');
    T.d.classList.toggle('centro', !e);
    const sv = T.d.querySelector('.tour-av .simi-svg');
    if (M() && sv) {
      if (p.humor === 'salta') { M().saltar(sv); const r = sv.getBoundingClientRect(); setTimeout(() => M().confeti(r.left + r.width / 2, r.top + r.height / 2), 120); }
      else M().humor(sv, p.humor || '', p.humor === 'saluda' ? 1400 : 0);
    }
    setTimeout(ubicar, e ? 260 : 0);
    ubicar();
    setTimeout(() => $('tourSig') && $('tourSig').focus({ preventScroll: true }), 30);
  }
  // Ubica el foco sobre el elemento y el cuadro al lado, sin salirse de la pantalla.
  function ubicar() {
    if (!T) return;
    const p = T.ps[T.i], e = el(p.sel), foco = T.d.querySelector('.tour-foco'), card = T.d.querySelector('.tour-card');
    const W = innerWidth, H = innerHeight, m = 12;
    if (!e) {
      foco.style.cssText = `left:${W / 2}px;top:${H / 2}px;width:0;height:0;opacity:0`;
      card.style.left = Math.max(m, (W - card.offsetWidth) / 2) + 'px';
      card.style.top = Math.max(m, (H - card.offsetHeight) / 2) + 'px';
      return;
    }
    const r = e.getBoundingClientRect(), pad = 6;
    const fx = Math.max(4, r.left - pad), fy = Math.max(4, r.top - pad);
    const fw = Math.min(W - 8, r.right + pad) - fx, fh = Math.min(H - 8, r.bottom + pad) - fy;
    const rad = getComputedStyle(e).borderRadius;
    foco.style.cssText = `left:${fx}px;top:${fy}px;width:${fw}px;height:${fh}px;opacity:1;border-radius:${rad && rad !== '0px' ? 'calc(' + rad + ' + 6px)' : '14px'}`;
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let x, y;
    if (fy + fh + ch + 16 < H) { y = fy + fh + 12; x = fx + fw / 2 - cw / 2; }        // debajo
    else if (fy - ch - 16 > 0) { y = fy - ch - 12; x = fx + fw / 2 - cw / 2; }        // arriba
    else if (fx + fw + cw + 16 < W) { x = fx + fw + 12; y = fy + fh / 2 - ch / 2; }   // a la derecha
    else if (fx - cw - 16 > 0) { x = fx - cw - 12; y = fy + fh / 2 - ch / 2; }        // a la izquierda
    else { x = (W - cw) / 2; y = fy > H / 2 ? m : H - ch - m; }
    card.style.left = Math.max(m, Math.min(W - cw - m, x)) + 'px';
    card.style.top = Math.max(m, Math.min(H - ch - m, y)) + 'px';
  }
  function terminar(completo) {
    if (!T) return;
    const t = T; T = null;
    marcar(t.u);
    if (t.rielAbierto && typeof setRail === 'function' && !movil()) setRail(false);
    removeEventListener('resize', ubicar);
    t.d.classList.remove('on');
    setTimeout(() => { t.d.remove(); if (window.simiRevisarAlertas) setTimeout(window.simiRevisarAlertas, 1500); }, 220);
    const fab = $('simiFab');
    if (!completo && t.ps[t.i].bienvenida && fab) {
      // Pospuesto: SIMI recuerda dónde está la guía.
      const r = fab.getBoundingClientRect();
      const g = document.createElement('div');
      g.className = 'simi-tip simi-tip-lado'; g.id = 'simiTip'; g.setAttribute('role', 'status');
      g.style.right = Math.max(8, innerWidth - r.left + 10) + 'px'; g.style.bottom = Math.max(8, innerHeight - r.bottom) + 'px';
      g.innerHTML = 'Cuando quieras, pedime el <b>recorrido guiado</b> o tocá «Ver el recorrido guiado» en Inicio.<button type="button" class="simi-tip-x" aria-label="Cerrar aviso" onclick="this.parentNode.remove()">×</button>';
      ($('appRoot') || document.body).appendChild(g);
      setTimeout(() => g.isConnected && g.remove(), 7000);
    }
    try { (t.prev && t.prev.focus && t.prev.isConnected ? t.prev : $('mainInner'))?.focus?.({ preventScroll: true }); } catch (_) {}
  }

  const css = `
  .tour{position:fixed;inset:0;z-index:140;opacity:0;transition:opacity .2s ease}
  .tour.on{opacity:1}
  .tour-bloq{position:absolute;inset:0}
  .tour-foco{position:fixed;border-radius:14px;box-shadow:0 0 0 2px var(--amber),0 0 0 9999px rgba(4,7,10,.74);pointer-events:none;
    transition:left .32s cubic-bezier(.3,.7,.3,1),top .32s cubic-bezier(.3,.7,.3,1),width .32s cubic-bezier(.3,.7,.3,1),height .32s cubic-bezier(.3,.7,.3,1),opacity .2s}
  .tour.centro .tour-foco{box-shadow:0 0 0 9999px rgba(4,7,10,.74)}
  .tour-card{position:fixed;width:min(380px,calc(100vw - 24px));display:flex;gap:14px;padding:18px 18px 14px;border-radius:18px;background:var(--s1);border:1px solid var(--line-2);
    box-shadow:0 24px 60px -18px rgba(0,0,0,.7);transition:left .32s cubic-bezier(.3,.7,.3,1),top .32s cubic-bezier(.3,.7,.3,1)}
  .tour.centro .tour-card{width:min(440px,calc(100vw - 24px));flex-direction:column;align-items:center;text-align:center;padding:26px 24px 18px}
  .tour-simi{width:52px;height:52px;flex-shrink:0}
  .tour.centro .tour-simi{width:104px;height:104px}
  .tour-simi .simi-svg{width:100%;height:100%;filter:drop-shadow(0 10px 18px rgba(229,118,26,.3))}
  .tour-body{flex:1;min-width:0;width:100%}
  .tour-cont{font:700 10px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--amber-tx)}
  .tour-body h3{font-size:17px;font-weight:750;letter-spacing:-.01em;margin:7px 0 5px;line-height:1.3}
  .tour.centro .tour-body h3{font-size:21px}
  .tour-body p{font-size:13.5px;line-height:1.55;color:var(--tx2);margin:0}
  .tour-acc{display:flex;align-items:center;gap:6px;margin-top:15px}
  .tour-esp{flex:1}
  .tour.centro .tour-acc{justify-content:center}
  .tour.centro .tour-esp{display:none}
  .tour-acc .btn{min-height:40px}
  .tour-acc [hidden]{display:none}
  .tour-puntos{display:flex;gap:5px;justify-content:center;margin-top:12px}
  .tour-puntos:empty{display:none}
  .tour.centro .tour-puntos{display:none}
  .tour-puntos i{width:6px;height:6px;border-radius:3px;background:var(--line-2);transition:width .2s,background .2s}
  .tour-puntos i.on{width:18px;background:var(--amber)}
  @media(prefers-reduced-motion:reduce){.tour,.tour-foco,.tour-card{transition:none}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  window.simaTour = { iniciar, hecho: () => hecho(quien()), reiniciar: () => { try { localStorage.removeItem(K); } catch (_) {} } };
  // Primer ingreso: después de iniciar sesión (o al abrir con la sesión guardada).
  const intentar = () => setTimeout(() => iniciar(false), 1200);
  window.addEventListener('sima:auth', intentar);
  window.addEventListener('sima:modulo', ev => { if (ev.detail === 'ruta') intentar(); });
  if (document.readyState !== 'loading') intentar(); else document.addEventListener('DOMContentLoaded', intentar);
})();
