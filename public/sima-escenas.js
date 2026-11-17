/* =====================================================================
   SIMI trabajando · escenas animadas de Inicio (09-11-26)
   ---------------------------------------------------------------------
   Junto al botón de la Ruta de inspección, SIMI aparece trabajando en
   ambientes reales del frigorífico (cámara de frío, sala de máquinas,
   sala de proceso). Son 14 escenas, entre ellas:
     · levantamiento con la tablet;
     · tablero eléctrico con bloqueo y etiqueta;
     · lavado de manos;
     · escalera con arnés, con un mini SIMI que sostiene la escalera;
     · relleno y pintura;
     · piso mojado con cono;
     · burlete de la cámara;
     · extintor y salida;
     · control con lupa.
   Cada escena trae consejos de levantamiento, seguridad, calidad o mantenimiento.
     · Las escenas rotan solas cada 11 s. Tienen botón «Pausar» (WCAG
       2.2.2) y botón «Otro consejo». La pausa se recuerda.
     · Con una ruta de inspección en curso no hay consejos: SIMI queda
       con la tablet acompañando y deja trabajar.
     · Con «reducir movimiento» del sistema: escena quieta y sin rotar.
     · Fuera de pantalla o con la pestaña oculta no anima nada.
   El dibujo es decorativo (aria-hidden); el consejo es texto real.
   API: window.SIMI_ESC = { montar, ESCENAS, CONSEJOS }
   ===================================================================== */
(function () {
  'use strict';
  const REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CLAVE_PAUSA = 'sima.simi.escenas.pausa';
  const CICLO = 11000;

  const CAT = {
    lev: { t: 'Levantamiento', c: 'var(--amber-tx, #FFB84D)' },
    seg: { t: 'Seguridad', c: '#FF7A85' },
    cal: { t: 'Calidad', c: 'var(--green-tx, #3DDC97)' },
    mant: { t: 'Mantenimiento', c: 'var(--ice-tx, #8FD9EE)' }
  };

  /* Escena → qué hace SIMI, dónde y qué tipo de consejos lleva. */
  const ESCENAS = [
    { id: 'tablet', t: 'Haciendo un levantamiento en la cámara de frío', cat: 'lev' },
    { id: 'electrica', t: 'Reparando un tablero en la sala de máquinas, con bloqueo y etiqueta', cat: 'seg' },
    { id: 'evaporador', t: 'Limpiando el hielo del evaporador de la cámara', cat: 'mant' },
    { id: 'manos', t: 'Lavándose las manos antes de entrar a proceso', cat: 'cal' },
    { id: 'escalera', t: 'Cambiando una luminaria con arnés, mientras un compañero sostiene la escalera', cat: 'seg' },
    { id: 'engrase', t: 'Engrasando la cinta transportadora con grasa grado alimenticio', cat: 'mant' },
    { id: 'pintura', t: 'Rellenando fisuras y pintando la pared de la sala de proceso', cat: 'cal' },
    { id: 'piso', t: 'Secando el piso mojado con el cono puesto', cat: 'seg' },
    { id: 'antesdespues', t: 'Comparando la foto del antes y la del después', cat: 'cal' },
    { id: 'camara', t: 'Revisando el burlete de la puerta de la cámara con la linterna', cat: 'cal' },
    { id: 'desague', t: 'Destapando y limpiando la rejilla de desagüe', cat: 'mant' },
    { id: 'extintor', t: 'Controlando el extintor y la salida de emergencia', cat: 'seg' },
    { id: 'sellado', t: 'Sellando el zócalo sanitario con sellador apto', cat: 'mant' },
    { id: 'calidad', t: 'Revisando la terminación de la mesa de acero con la lupa', cat: 'cal' }
  ];

  /* Un consejo puede llevar otra categoría que la de su escena: { c, t }. */
  const CONSEJOS = {
    tablet: [
      'Sacá dos fotos: una de lejos que muestre dónde está y otra de cerca con el detalle.',
      'Describí qué ves, dónde y cuánto: «fisura de 30 cm en el panel sobre la puerta 2».',
      'Si el hallazgo ya está cargado, no lo dupliques: SIMA te avisa cuando se repite el punto.',
      'Elegí bien la categoría: así Mantenimiento manda al técnico que corresponde.',
      'Marcá «Sin novedad» en los sectores que están bien: también es dato del recorrido.',
      'Dictá el hallazgo apenas lo ves: en la cámara de frío los dedos se entumecen rápido.',
      { c: 'mant', t: 'Anotá la medida y el material del daño: el técnico llega con el repuesto justo y no hace dos viajes.' },
      { c: 'cal', t: 'Una foto con algo de referencia (una mano, una regla) deja claro el tamaño del daño.' }
    ],
    electrica: [
      'Antes de abrir un tablero: cortá, bloqueá y etiquetá. Después verificá que no haya tensión.',
      'Con las manos húmedas o el piso mojado no se toca nada eléctrico.',
      'Usá herramientas aisladas y guantes dieléctricos en cualquier trabajo eléctrico.',
      'Si ves cables expuestos, señalizá la zona y cargalo como hallazgo urgente.',
      'El candado de bloqueo es personal: sólo lo saca quien lo puso.',
      { c: 'mant', t: 'Ajustá los bornes flojos en cada mantenimiento: un borne flojo calienta y termina en corte.' },
      { c: 'mant', t: 'Tableros con la tapa cerrada y el prensacables puesto: en sectores húmedos entra agua y vapor.' },
      { c: 'mant', t: 'Si una térmica salta seguido, no la subas y listo: buscá la causa antes de que se queme el equipo.' }
    ],
    manos: [
      'Lavate las manos al entrar al sector y cada vez que cambies de tarea: 20 segundos con jabón.',
      'Uñas cortas, sin anillos ni reloj: en proceso no entra nada que pueda caer al producto.',
      'Casco y uniforme reglamentario completos y limpios antes de entrar a proceso.',
      'Las herramientas que entran a proceso van limpias y desinfectadas, nunca apoyadas en el piso.',
      'Un lavamanos sin jabón, sin papel o con el pedal roto es un hallazgo: cargalo.',
      { c: 'cal', t: 'Después de una reparación en proceso, el sector se limpia y se desinfecta antes de volver a producir.' },
      { c: 'cal', t: 'Contá las piezas y tornillos que entraron y los que salieron: nada puede quedar suelto cerca del producto.' }
    ],
    escalera: [
      'En trabajos en altura: arnés de cuerpo completo enganchado a un punto de anclaje firme.',
      'Un compañero sostiene la escalera mientras subís: nunca la dejes sola.',
      'Subí y bajá de frente a la escalera, con tres puntos de apoyo todo el tiempo.',
      'Revisá la escalera antes de usarla: peldaños sanos, patas antideslizantes y traba puesta.',
      'Las herramientas suben en un cinturón o en un balde con soga, nunca en la mano.',
      { c: 'mant', t: 'Luminarias de proceso siempre herméticas y con difusor sano: un vidrio roto es riesgo de cuerpo extraño.' },
      { c: 'mant', t: 'Al cambiar una luminaria, revisá también la junta de goma: si está reseca, cambiala en el mismo trabajo.' }
    ],
    pintura: [
      'Rellená la fisura antes de pintar: la pintura sola no sella.',
      'Antes de sellar o pintar, limpiá y secá la superficie: si no, se desprende en semanas.',
      'En las áreas de proceso usá pinturas y selladores aptos para la industria alimentaria.',
      'Respetá el tiempo de secado antes de devolver el sector a producción.',
      { c: 'mant', t: 'Lijá y sacá la pintura suelta antes de repintar: si no, la capa nueva se cae con la anterior.' },
      { c: 'cal', t: 'La terminación tiene que ser lisa y lavable: sin grumos, chorreaduras ni poros que junten suciedad.' }
    ],
    piso: [
      'Piso mojado: poné el cono antes de empezar a limpiar, no después.',
      'En las áreas húmedas, siempre botas de seguridad antideslizantes.',
      'Un desagüe tapado es un hallazgo: el agua estancada causa caídas y contaminación.',
      'En pasillos con agua o grasa se camina, no se corre.',
      { c: 'cal', t: 'Si el agua no corre hacia el desagüe, la pendiente del piso está mal: reportalo.' },
      { c: 'mant', t: 'Un piso con fisuras o baldosas flojas se repara con material epoxi apto para áreas húmedas.' }
    ],
    camara: [
      'Burletes de la puerta sanos y sin hielo: si no cierra hermético, la cámara pierde frío.',
      'Hielo en el piso o en el techo de la cámara indica que entra aire: cargalo como hallazgo.',
      'No dejes la puerta abierta más de lo necesario: cada minuto suma hielo y condensación.',
      'Antes de firmar la ronda, confirmá que la temperatura de la cámara esté dentro del rango.',
      { c: 'seg', t: 'Al entrar a una cámara, fijate que el pulsador de emergencia interno funcione.' },
      { c: 'mant', t: 'Revisá bisagras y cierre de la puerta: una puerta caída es la que rompe el burlete.' },
      { c: 'mant', t: 'Si la resistencia del marco de la puerta no calienta, se forma hielo y la puerta no cierra: reportalo.' },
      { c: 'cal', t: 'Que no gotee condensación del techo sobre el producto: es contaminación directa.' }
    ],
    extintor: [
      'El manómetro del extintor tiene que estar en verde y la tarjeta de control al día.',
      'Nada apoyado adelante de los extintores ni de las salidas de emergencia.',
      'Si un cartel de salida no enciende, es un hallazgo de seguridad: cargalo.',
      'Conocé el punto de reunión de tu sector antes de que haga falta.',
      { c: 'mant', t: 'Cartel de salida y luz de emergencia: probá el botón de test una vez por mes.' },
      { c: 'mant', t: 'Cargá en el calendario el vencimiento de cada extintor para que no se pase la recarga.' }
    ],
    evaporador: [
      'Mantené limpios los evaporadores y su bandeja de desagüe: el hielo acumulado baja el rendimiento del frío.',
      'Revisá que todos los ventiladores del evaporador giren: uno parado arma hielo en esa zona.',
      'La bandeja del evaporador tiene que drenar libre: si rebalsa, gotea dentro de la cámara.',
      { c: 'cal', t: 'Nada de producto debajo de un evaporador que gotea: movelo y cargá el hallazgo.' }
    ],
    engrase: [
      'Lubricá sólo con grasa grado alimenticio en los equipos de proceso.',
      'Limpiá la grasa vieja antes de engrasar: el exceso junta suciedad y gotea.',
      'Cadenas o rodillos con ruido o con juego: cargalo antes de que se corte la línea.',
      { c: 'seg', t: 'Engrasá con la máquina detenida y bloqueada: nunca con la cinta en movimiento.' }
    ],
    antesdespues: [
      'Cerrá un trabajo con la foto del después: sin evidencia, la verificación se demora.',
      'Sacá la foto del después desde el mismo ángulo que la del antes.',
      'Al verificar, compará antes y después lado a lado: se nota enseguida si quedó a medias.'
    ],
    desague: [
      'Revisá y limpiá las rejillas de desagüe en cada ronda: un desagüe tapado termina en charcos y malos olores.',
      'Después de destapar, tirá agua con caudal para confirmar que drena bien.',
      { c: 'seg', t: 'Rejillas bien asentadas: una rejilla floja hace tropezar y rompe las ruedas de los carros.' }
    ],
    sellado: [
      'Usá silicona o sellador sanitario en juntas de panel: el sellador común se pone negro con la humedad.',
      'Retirá el sellador viejo antes de aplicar el nuevo: encima no pega.',
      { c: 'cal', t: 'El zócalo sanitario tiene que ser continuo y curvo: en las esquinas rectas se junta suciedad.' }
    ],
    calidad: [
      'Verificá con la foto del antes a mano: ¿quedó resuelto exactamente lo que se reportó?',
      'Si un cierre no convence, devolvelo con el motivo concreto: así no vuelve a pasar.',
      'Una no conformidad que vuelve al mismo punto pide revisar la causa, no sólo el parche.',
      'Juntas y sellados continuos, sin huecos: ahí se juntan suciedad y condensación.',
      'Soldaduras del acero lisas y pulidas: una porosidad es un nido de bacterias.',
      { c: 'cal', t: 'Mirá también alrededor del arreglo: a veces la reparación deja restos, tornillos o grasa.' },
      { c: 'cal', t: 'Superficies en contacto con el producto: de acero inoxidable, sin óxido ni rayas profundas.' },
      { c: 'mant', t: 'Un arreglo provisorio (cinta, alambre, cartón) es un hallazgo nuevo: no debe quedar como solución.' },
      { c: 'cal', t: 'Si una falla se repite, sumá en la verificación qué la causó: así Mantenimiento ataca la causa.' }
    ]
  };

  /* ---------- Dibujos (escenario 240 × 150, piso desde y = 132) ---------- */
  const M = () => window.SIMI_M;
  const T = (x, y, txt, tam, color, ancla = 'start', peso = 700) =>
    `<text x="${x}" y="${y}" fill="${color}" text-anchor="${ancla}" style="font:${peso} ${tam}px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em">${txt}</text>`;
  // SIMI anidado en su propio sistema de coordenadas (64 × 64).
  const simi = (manos = true) => (M() ? M().svg('esc-simi', { manos }) : '').replace(/<svg class="simi-svg esc-simi"/, '<svg class="simi-svg esc-simi" x="0" y="0" width="64" height="64"');
  const casco = (c = '#FFD23F', b = '#F2B705') => `<path d="M15 16.5 Q15 3.5 32 3 Q49 3.5 49 16.5 Z" fill="${c}" stroke="#14100A" stroke-opacity=".25"/>
    <path d="M30 3.4 h4 v12.6 h-4z" fill="${b}"/><rect x="11" y="15.5" width="42" height="3.4" rx="1.7" fill="${b}"/>`;
  const actor = (x, y, cuerpo, k = 1.15) => `<g transform="translate(${x} ${y}) scale(${k})">${cuerpo}</g>`;
  const rango = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');

  // Cámara de frío: paneles sándwich, riel de carne, zócalo sanitario, visor de temperatura y escarcha.
  const fondoCamara = temp => `<rect width="240" height="150" fill="#1A2731"/>
    ${rango(8, i => `<rect x="${i * 30 + 1}" y="14" width="28" height="114" fill="#283B48"/><path d="M${i * 30 + 8} 14 V128 M${i * 30 + 15} 14 V128 M${i * 30 + 22} 14 V128" stroke="#2F4554"/>`)}
    <rect y="8" width="240" height="6" fill="#647682"/>
    ${[22, 82, 142, 202].map(x => `<g class="esc-gancho" style="animation-delay:${-x / 40}s"><path d="M${x} 14 v7 q0 5 4 5 q3 0 3 -3" fill="none" stroke="#9AA9B3" stroke-width="1.6" stroke-linecap="round"/></g>`).join('')}
    <path d="M0 124 Q0 132 8 132 H240 V124 Z" fill="#34505F"/><rect y="132" width="240" height="18" fill="#121C22"/>
    <g><rect x="8" y="30" width="40" height="18" rx="2.5" fill="#0A1116" stroke="#3E5563"/>${T(28, 42.5, temp, 8.5, '#3FC5E8', 'middle')}
      </g>
    <g class="esc-frio" fill="#D6F2FF">${[[18, 62], [58, 40], [118, 30], [196, 52], [150, 84], [92, 72], [226, 96], [36, 100]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 2 ? 1.1 : 1.6}" style="animation-delay:${(-i * 0.8).toFixed(1)}s"/>`).join('')}</g>`;

  // Sala de máquinas: cañerías de frío (una aislada con escarcha), manómetro, cartel de riesgo y franja de seguridad.
  const fondoMaquinas = () => `<defs><pattern id="escRayas" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="8" fill="#FFC21A"/><rect x="4" width="4" height="8" fill="#14100A"/></pattern></defs>
    <rect width="240" height="150" fill="#20252A"/>
    ${rango(6, i => `<rect x="${i * 40 + 1}" y="0" width="38" height="128" fill="#262C32"/>`)}
    <rect y="16" width="240" height="7" fill="#2F6CA8"/><rect y="27" width="240" height="10" rx="2" fill="#8C979F"/>
    ${[30, 110, 190].map(x => `<rect x="${x}" y="14" width="5" height="11" rx="1" fill="#24548A"/><rect x="${x + 2}" y="25" width="5" height="14" rx="1" fill="#6F7B83"/>`).join('')}
    <g fill="#E6F7FF" opacity=".7"><circle cx="60" cy="30" r="1.6"/><circle cx="66" cy="34" r="1.1"/><circle cx="150" cy="31" r="1.4"/><circle cx="214" cy="33" r="1.2"/></g>
    <g><circle cx="26" cy="66" r="12" fill="#0A1116" stroke="#8C979F" stroke-width="2"/><path d="M17 72 A11 11 0 0 1 35 72" fill="none" stroke="#1FCB7E" stroke-width="2.2"/><path d="M30 61 A11 11 0 0 1 35 72" fill="none" stroke="#FF4D5E" stroke-width="2.2"/>
      <g class="esc-aguja"><path d="M26 66 L19 60" stroke="#FFD23F" stroke-width="1.8" stroke-linecap="round"/></g><circle cx="26" cy="66" r="1.8" fill="#C9D2D9"/>
      <path d="M26 78 V128" stroke="#8C979F" stroke-width="3"/></g>
    <g transform="translate(120 41) scale(.8) translate(-120 -46)"><path d="M120 46 L134 70 H106 Z" fill="#FFC21A" stroke="#14100A" stroke-width="1.4" stroke-linejoin="round"/><path d="M121.5 52 L116 62 h5 l-2.5 6.5 l7.5 -10 h-5 l2.5 -6.5 z" fill="#14100A"/></g>
    <rect y="126" width="240" height="6" fill="url(#escRayas)"/><rect y="132" width="240" height="18" fill="#16191C"/>`;

  // Sala de proceso: azulejo sanitario, luminaria hermética, zócalo curvo y rejilla de desagüe.
  const fondoProceso = (rejilla = true) => `<defs><pattern id="escAzulejo" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#2F404B"/><path d="M12 0 V12 H0" fill="none" stroke="#3A4F5C" stroke-width="1"/></pattern></defs>
    <rect width="240" height="150" fill="url(#escAzulejo)"/>
    <g><rect x="88" y="4" width="64" height="7" rx="3.5" fill="#E2EEF4"/><path d="M92 11 L74 60 H166 L148 11 Z" fill="#FFF6D8" opacity=".05"/></g>
    <path d="M0 124 Q0 132 8 132 H240 V124 Z" fill="#3E5867"/><rect y="132" width="240" height="18" fill="#1A252C"/>
    ${rejilla ? `<g><rect x="196" y="137" width="30" height="6" rx="2" fill="#0A1116"/>${rango(5, i => `<path d="M${200 + i * 5.5} 138 v4" stroke="#56646E" stroke-width="1.4"/>`)}</g>` : ''}`;

  const DIBUJO = {
    tablet: () => `${fondoCamara('0,5 °C')}
      <g><path d="M183 58 l6 9 l-4 7 l7 10 l-3 8" fill="none" stroke="#0B1217" stroke-opacity=".75" stroke-width="2" stroke-linecap="round"/>
        <circle class="esc-mira" cx="188" cy="76" r="17" fill="none" stroke="#3FC5E8" stroke-width="2" stroke-dasharray="5 4"/></g>
      ${actor(62, 63, `${simi()}${casco()}
        <g class="esc-tablet"><rect x="49" y="31" width="22" height="28" rx="3.5" fill="#14100A"/><rect x="51.5" y="34" width="17" height="21" rx="1.5" fill="#123642"/>
          <g class="esc-lineas" stroke-linecap="round" stroke-width="1.6">
            <path class="l1" d="M54 38.5 h3" stroke="#1FCB7E"/><path class="l1" d="M59 38.5 h7" stroke="#8FD9EE"/>
            <path class="l2" d="M54 44 h3" stroke="#1FCB7E"/><path class="l2" d="M59 44 h6" stroke="#8FD9EE"/>
            <path class="l3" d="M54 49.5 h3" stroke="#FFB84D"/><path class="l3" d="M59 49.5 h7" stroke="#8FD9EE"/></g>
          <circle class="esc-flash" cx="60" cy="45" r="12" fill="#fff"/></g>`)}`,

    electrica: () => `${fondoMaquinas()}
      <g><rect x="158" y="40" width="60" height="68" rx="4" fill="#3A434B" stroke="#56636D" stroke-width="1.5"/>
        <rect x="164" y="48" width="48" height="42" rx="2" fill="#0A1116"/>
        <g stroke="#3FC5E8" stroke-width="2" stroke-linecap="round"><path d="M173 56 v26"/><path d="M186 56 v26"/><path d="M199 56 v26"/></g>
        <g fill="#C9D2D9"><rect x="170" y="62" width="6" height="5" rx="1"/><rect x="183" y="62" width="6" height="5" rx="1"/><rect x="196" y="62" width="6" height="5" rx="1"/></g>
        <circle class="esc-led" cx="208" cy="99" r="3.6"/>${T(170, 101, 'SIN TENSIÓN', 4.3, '#9AA9B3')}
        <path d="M173 108 v24 M199 108 c0 12 8 16 20 24" fill="none" stroke="#56646E" stroke-width="2.4" stroke-linecap="round"/>
        <g class="esc-loto"><path d="M219 50 q7 0 7 8" fill="none" stroke="#C9D2D9" stroke-width="2"/><rect x="221" y="57" width="10" height="9" rx="2" fill="#FF4D5E"/>
          <rect x="218" y="68" width="17" height="21" rx="2" fill="#FF4D5E"/><path d="M221 74 h11 M221 79 h9 M221 84 h7" stroke="#fff" stroke-width="1.5"/></g></g>
      ${actor(78, 63, `${simi()}${casco()}
        <circle cx="56.6" cy="47" r="4.9" fill="#1E5FA8"/>
        <g class="esc-destornillador"><path d="M57.5 44 L64 39.5" stroke="#FFD23F" stroke-width="5.4" stroke-linecap="round"/>
          <path d="M64.5 38.5 L78 29" stroke="#C9D2D9" stroke-width="1.9" stroke-linecap="round"/></g>`)}`,

    manos: () => `${fondoProceso(false)}
      <g><rect x="164" y="30" width="44" height="22" rx="3" fill="#E2EEF4"/><circle cx="175" cy="41" r="6" fill="#3FC5E8"/><path d="M172 41 q3 -5 6 0" stroke="#fff" stroke-width="1.4" fill="none"/>
        ${T(196, 39, 'LAVATE', 4.6, '#1A252C', 'middle')}${T(196, 46, 'LAS MANOS', 4.6, '#1A252C', 'middle')}</g>
      <g><rect x="214" y="56" width="10" height="20" rx="3" fill="#E2EEF4"/><rect x="217" y="76" width="4" height="4" fill="#9AA9B3"/></g>
      <g><path d="M158 84 H222 L216 104 H164 Z" fill="#AEB9C0" stroke="#7D8A93"/><path d="M162 88 H218" stroke="#D9E2E7" stroke-width="1.4"/>
        <path d="M190 104 V132 M182 132 h16" stroke="#7D8A93" stroke-width="3"/>
        <path d="M190 64 V70 Q190 74 186 74" fill="none" stroke="#C9D2D9" stroke-width="3.2" stroke-linecap="round"/>
        <path class="esc-agua" d="M186 75 V92" stroke="#8FD9EE" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="3 3"/></g>
      ${actor(72, 63, `${simi(false)}${casco('#F5F7F8', '#D5DDE2')}
        <g class="esc-burbujas" fill="#F2FBFF" stroke="#8FD9EE" stroke-width=".5">${[[23, 52], [32, 49], [41, 52], [27, 56], [37, 56]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${1.4 + (i % 2) * .6}" style="animation-delay:${(-i * 0.35).toFixed(2)}s"/>`).join('')}</g>
        <circle class="esc-mano-i" cx="27" cy="55" r="4.6" fill="#F5A33C" stroke="#14100A" stroke-opacity=".25"/>
        <circle class="esc-mano-d" cx="37" cy="55" r="4.6" fill="#F5A33C" stroke="#14100A" stroke-opacity=".25"/>`)}`,

    escalera: () => `<defs><clipPath id="escClipEsc"><rect x="0" y="11" width="240" height="139"/></clipPath></defs>${fondoCamara('2,0 °C').replace(/<g><rect x="8" y="30"[\s\S]*?<\/g>/, '')}
      <g><rect x="122" y="12" width="16" height="4" rx="1.5" fill="#C9D2D9"/><circle cx="130" cy="17.5" r="3" fill="none" stroke="#C9D2D9" stroke-width="2"/></g>
      <g><rect x="158" y="15" width="44" height="6" rx="3" fill="#E6F6FB"/><rect class="esc-tubo" x="161" y="20" width="38" height="3" rx="1.5" fill="#FFF3C4"/></g>
      <g stroke="#C9D2D9" stroke-width="3.2" stroke-linecap="round"><path d="M104 30 L96 132"/><path d="M156 30 L164 132"/></g>
      <g stroke="#C9D2D9" stroke-width="2.4" stroke-linecap="round">${[44, 60, 76, 92, 108, 124].map(y => { const d = (y - 30) / 102 * 8; return `<path d="M${104 - d} ${y} H${156 + d}"/>`; }).join('')}</g>
      <g fill="#14100A"><rect x="92" y="130" width="8" height="4" rx="1"/><rect x="160" y="130" width="8" height="4" rx="1"/></g>
      <g clip-path="url(#escClipEsc)"><g class="esc-sube"><g transform="translate(98 70)">
        <path d="M32 9 V-140" stroke="#FFB84D" stroke-width="1.6" stroke-dasharray="4 2.5"/>
        ${simi()}${casco()}
        <g fill="none" stroke="#1E5FA8" stroke-width="3" stroke-linecap="round"><path d="M12 21 V47"/><path d="M52 21 V47"/><path d="M10 48.5 L32 56 L54 48.5"/><path d="M12 21 Q32 11 52 21"/></g>
        <g fill="#FFD23F"><rect x="10" y="30" width="4" height="4" rx="1"/><rect x="50" y="30" width="4" height="4" rx="1"/></g></g></g></g>
      <g class="esc-ataja">${actor(52, 94, `${simi()}${casco('#3FC5E8', '#2B9FC2')}`, .62)}</g>
      <g class="esc-ataja-mano"><circle cx="94.5" cy="122" r="3" fill="#F5A33C" stroke="#14100A" stroke-opacity=".3"/></g>`,

    pintura: () => `${fondoProceso()}
      <g><rect x="150" y="18" width="82" height="106" fill="#46555F"/>
        <path d="M150 40 h82 M150 62 h82 M150 84 h82 M150 106 h82" stroke="#3A4852"/>
        <path d="M164 34 l7 10 l-3 8 l8 12 M204 80 l-6 8 l5 9 l-4 10" fill="none" stroke="#0B1217" stroke-opacity=".8" stroke-width="2" stroke-linecap="round"/>
        <g fill="#6B5A3E" opacity=".55"><ellipse cx="214" cy="40" rx="7" ry="4"/><ellipse cx="172" cy="104" rx="9" ry="5"/></g>
        <rect class="esc-pintado" x="150" y="18" width="82" height="106" fill="#DCE6EC"/></g>
      ${actor(70, 63, `${simi()}${casco()}
        <g class="esc-rodillo"><path d="M57 46 L76 22" stroke="#9AA4AC" stroke-width="2.2" stroke-linecap="round"/>
          <rect x="71.5" y="10" width="7" height="22" rx="3" fill="#DCE6EC" stroke="#14100A" stroke-opacity=".3"/></g>`)}
      <g><path d="M56 120 h22 l-2 12 h-18 z" fill="#E2EEF4"/><rect x="55" y="117.5" width="24" height="3.4" rx="1.4" fill="#9AA9B3"/>${T(67, 129, 'APTO ALIM.', 3.6, '#1A252C', 'middle')}</g>`,

    piso: () => `${fondoProceso()}
      <g class="esc-charco"><ellipse cx="160" cy="138" rx="58" ry="6" fill="#3FC5E8" opacity=".28"/>
        <path class="esc-brillo" d="M128 137 h14 M160 140 h20 M190 136 h10" stroke="#D6F2FF" stroke-width="1.3" stroke-linecap="round"/></g>
      <g><path d="M30 132 L40 92 L50 132 Z" fill="#FFC21A" stroke="#14100A" stroke-width="1" stroke-linejoin="round"/><rect x="24" y="130" width="32" height="4" rx="1.5" fill="#14100A"/>
        <rect x="33.5" y="104" width="13" height="5" fill="#14100A"/><rect x="31.8" y="114" width="16.4" height="5" fill="#14100A"/>
        <g class="esc-cartel"><rect x="8" y="64" width="64" height="22" rx="3" fill="#FFC21A" stroke="#14100A"/>${T(40, 73.5, '¡CUIDADO!', 6, '#14100A', 'middle')}${T(40, 81.5, 'PISO MOJADO', 5.4, '#14100A', 'middle')}</g></g>
      ${actor(84, 63, `${simi()}${casco()}
        <g class="esc-secador"><path d="M57 46 L80 64" stroke="#9AA4AC" stroke-width="2.2" stroke-linecap="round"/><rect x="74" y="62" width="16" height="4.5" rx="1.5" fill="#1E5FA8"/>
          <path d="M84 70 q4 2 8 0" stroke="#8FD9EE" stroke-width="1.2" fill="none" stroke-linecap="round"/></g>`)}`,

    camara: () => `${fondoCamara('-1,5 °C')}
      <g><rect x="146" y="20" width="84" height="108" rx="3" fill="#D3DDE3"/><rect x="146" y="20" width="84" height="108" rx="3" fill="none" stroke="#3B4650" stroke-width="4"/>
        <rect x="152" y="26" width="72" height="96" rx="2" fill="none" stroke="#B5C2CA"/>
        <rect x="214" y="62" width="6" height="26" rx="3" fill="#56646E"/>
        <g class="esc-hielo"><circle cx="150" cy="114" r="7" fill="none" stroke="#FF4D5E" stroke-width="1.6"/><path d="M146 116 l3 -5 l3 5 l2 -4" stroke="#E6F7FF" stroke-width="1.4" fill="none"/></g>
        ${T(188, 48, 'CÁMARA 3', 6, '#3B4650', 'middle')}</g>
      ${actor(56, 63, `${simi()}${casco()}
        <g><path d="M57 46 L66 42" stroke="#30373D" stroke-width="5" stroke-linecap="round"/><circle cx="67.5" cy="41.4" r="2.6" fill="#FFF3C4"/></g>
        <path class="esc-haz" d="M68 41 L118 20 L122 48 Z" fill="#FFF3C4" opacity=".22"/>`)}`,

    extintor: () => `${fondoMaquinas()}
      <g class="esc-salida"><rect x="162" y="8" width="56" height="16" rx="2" fill="#0F8A4F"/><path d="M168 20 l3 -4 l-1 -4 m1 4 l4 1 m-4 -1 l-3 2" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round"/><circle cx="171.5" cy="10.8" r="1.3" fill="#fff"/>${T(198, 19.5, 'SALIDA', 7, '#fff', 'middle')}</g>
      <g><rect x="182" y="56" width="22" height="5" rx="1.5" fill="#56646E"/>
        <rect x="182" y="62" width="22" height="58" rx="8" fill="#E0242F"/><rect x="186" y="74" width="14" height="22" rx="2" fill="#F5F5F5"/>${T(193, 87, 'ABC', 4.6, '#E0242F', 'middle')}
        <path d="M188 62 V54 h12 l6 -4" stroke="#30373D" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="193" cy="52" r="5" fill="#0A1116" stroke="#C9D2D9" stroke-width="1.4"/>
        <path d="M189.5 53.5 A4 4 0 0 1 196.5 53.5" fill="none" stroke="#1FCB7E" stroke-width="1.6"/><path d="M193 52 L195 49.5" stroke="#FFD23F" stroke-width="1.2" stroke-linecap="round"/>
        <g class="esc-tarjeta"><path d="M204 60 v6" stroke="#C9D2D9"/><rect x="200" y="66" width="12" height="16" rx="1.5" fill="#FFF3C4" stroke="#9AA9B3" stroke-width=".6"/><path d="M202 71 h8 M202 75 h6" stroke="#56646E" stroke-width=".9"/></g></g>
      ${actor(66, 63, `${simi()}${casco()}
        <g><rect x="49" y="32" width="18" height="24" rx="2" fill="#E6F6FB" stroke="#14100A" stroke-opacity=".25"/><rect x="54" y="30" width="8" height="4" rx="1.5" fill="#9AA4AC"/>
          ${[38, 44, 50].map((y, i) => `<path class="esc-tilde" style="animation-delay:${i * 0.7}s" d="M52 ${y} l2 2 l4 -4" stroke="#1FCB7E" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M60 ${y} h5" stroke="#56646E" stroke-width="1"/>`).join('')}</g>`)}`,

    evaporador: () => `${fondoCamara('-0,5 °C')}
      <g><rect x="132" y="16" width="100" height="34" rx="3" fill="#B9C6CE" stroke="#7D8A93"/>
        ${[152, 182, 212].map(x => `<circle cx="${x}" cy="33" r="11" fill="#2A3640"/><g class="esc-helice"><path d="M${x} 33 l0 -9 a4 4 0 0 1 3 4 z M${x} 33 l8 4 a4 4 0 0 1 -5 2 z M${x} 33 l-8 4 a4 4 0 0 1 2 -5 z" fill="#C9D2D9"/></g><circle cx="${x}" cy="33" r="1.8" fill="#56646E"/>`).join('')}
        <path class="esc-hieloev" d="M134 50 l5 6 l4 -5 l5 7 l4 -6 l6 6 l5 -5 l4 7 l5 -6 l5 5 l4 -6 l6 6 l4 -5 l5 6 l4 -7 l5 6 l4 -5 l4 6 l3 -4 V50 Z" fill="#E6F7FF"/>
        <path d="M136 56 H228 V60 H136 Z" fill="#8C979F"/><path d="M226 60 V90" stroke="#8C979F" stroke-width="2.4"/>
        <circle class="esc-gota" cx="226" cy="64" r="1.6" fill="#8FD9EE"/></g>
      ${actor(62, 63, `${simi()}${casco()}
        <g class="esc-cepillo"><path d="M57 46 L92 -2" stroke="#9AA4AC" stroke-width="2.2" stroke-linecap="round"/><rect x="86" y="-8" width="14" height="6" rx="1.5" fill="#1E5FA8" transform="rotate(-36 93 -5)"/></g>`)}`,

    engrase: () => `${fondoProceso()}
      <g><rect x="138" y="88" width="96" height="10" rx="5" fill="#30373D"/>
        <path class="esc-cinta" d="M144 88 H228" stroke="#56646E" stroke-width="2" stroke-dasharray="6 4"/>
        ${[144, 228].map(x => `<circle cx="${x}" cy="93" r="5" fill="#8C979F"/><g class="esc-rueda"><path d="M${x - 4} 93 h8 M${x} 89 v8" stroke="#30373D" stroke-width="1.4"/></g>`).join('')}
        <path d="M190 98 V132 M228 98 V132" stroke="#9AA9B3" stroke-width="3"/>
        <rect x="143" y="100" width="40" height="26" rx="3" fill="#2F6CA8"/>
        <g class="esc-engranaje"><circle cx="153" cy="115" r="7" fill="#C9D2D9"/>${rango(8, i => `<rect x="151.6" y="106" width="2.8" height="3.4" fill="#C9D2D9" transform="rotate(${i * 45} 153 115)"/>`)}<circle cx="153" cy="115" r="2" fill="#30373D"/></g>
        <g class="esc-engranaje2"><circle cx="167" cy="115" r="5.4" fill="#9AA9B3"/>${rango(6, i => `<rect x="165.8" y="108" width="2.4" height="3" fill="#9AA9B3" transform="rotate(${i * 60} 167 115)"/>`)}<circle cx="167" cy="115" r="1.6" fill="#30373D"/></g></g>
      ${actor(46, 63, `${simi()}${casco()}
        <g><rect x="52" y="40" width="22" height="8" rx="3" fill="#E0242F"/><rect x="56" y="34" width="12" height="6" rx="1" fill="#F5F5F5"/>${T(62, 39, 'H1', 4, '#E0242F', 'middle')}
          <path d="M74 44 L80 47" stroke="#30373D" stroke-width="2" stroke-linecap="round"/><circle class="esc-grasa" cx="81.5" cy="47.8" r="1.8" fill="#FFE08A"/></g>`)}`,

    antesdespues: () => `${fondoProceso()}
      <g><rect x="122" y="20" width="108" height="92" rx="4" fill="#0A1116" stroke="#56646E"/>
        <rect x="126" y="30" width="100" height="78" fill="#DCE6EC"/>
        <g class="esc-antes"><rect x="126" y="30" width="100" height="78" fill="#55636D"/><path d="M140 40 l8 12 l-4 9 l9 14 M190 60 l-6 9 l5 10" fill="none" stroke="#0B1217" stroke-width="2" stroke-linecap="round"/><ellipse cx="205" cy="92" rx="10" ry="5" fill="#6B5A3E" opacity=".6"/></g>
        <g class="esc-divisor"><path d="M176 30 V108" stroke="#FFB84D" stroke-width="2"/><circle cx="176" cy="69" r="5" fill="#FFB84D"/><path d="M174 67 l-2 2 l2 2 M178 67 l2 2 l-2 2" stroke="#14100A" stroke-width="1" fill="none"/></g>
        ${T(132, 27, 'ANTES', 5, '#9AA9B3')}${T(224, 27, 'DESPUÉS', 5, '#1FCB7E', 'end')}</g>
      ${actor(40, 63, `${simi()}${casco('#F5F7F8', '#D5DDE2')}
        <g class="esc-senala"><path d="M57 46 L78 34" stroke="#9AA4AC" stroke-width="1.6" stroke-linecap="round"/><circle cx="79" cy="33.4" r="1.6" fill="#FFB84D"/></g>`)}`,

    desague: () => `${fondoProceso(false)}
      <g><ellipse class="esc-remolino" cx="176" cy="139" rx="34" ry="5" fill="#3FC5E8" opacity=".25"/>
        <rect x="160" y="136" width="32" height="6" rx="2" fill="#0A1116"/>
        <g class="esc-rejilla">${rango(6, i => `<path d="M${163.5 + i * 5} 137 v4" stroke="#8C979F" stroke-width="1.5"/>`)}<rect x="160" y="136" width="32" height="6" rx="2" fill="none" stroke="#8C979F"/></g>
        <g class="esc-mugre" fill="#7A6040">${[[214, 139], [222, 137], [206, 140], [230, 139]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${1.4 + (i % 2) * .7}" style="animation-delay:${(-i * 0.5).toFixed(1)}s"/>`).join('')}</g></g>
      ${actor(96, 63, `${simi()}${casco()}
        <g class="esc-escoba"><path d="M57 46 L84 66" stroke="#9AA4AC" stroke-width="2.2" stroke-linecap="round"/><rect x="78" y="64" width="16" height="5" rx="1.5" fill="#FFC21A"/><path d="M80 69 v3 M84 69 v3 M88 69 v3 M92 69 v3" stroke="#C99A12" stroke-width="1"/></g>`)}`,

    sellado: () => `${fondoProceso(false)}
      <path class="esc-cordon" d="M136 127 H214" stroke="#F5F7F8" stroke-width="3.2" stroke-linecap="round"/>
      <g class="esc-camina">${actor(36, 61, `${simi()}${casco()}
        <g><rect x="50" y="40" width="24" height="7" rx="2" fill="#FFF3C4" stroke="#C99A12" stroke-width=".8"/><path d="M74 43.5 L86 57" stroke="#F5F7F8" stroke-width="2.6" stroke-linecap="round"/>
          <path d="M50 43.5 h-6 M54 47 v6" stroke="#30373D" stroke-width="2" stroke-linecap="round"/></g>`)}</g>
      ${T(226, 120, 'SELLADOR SANITARIO', 4.2, '#9AA9B3', 'end')}`,
    calidad: () => `${fondoProceso()}
      <g><rect x="140" y="88" width="90" height="7" rx="1.5" fill="#C9D2D9"/><path d="M140 95 h90" stroke="#8C979F" stroke-width="1.5"/>
        <path d="M148 95 V132 M222 95 V132" stroke="#9AA9B3" stroke-width="3.4"/><path d="M148 116 H222" stroke="#9AA9B3" stroke-width="2"/>
        <path d="M184 88 v7" stroke="#6F7B83" stroke-width="1.6" stroke-dasharray="1.4 1.2"/>
        <g class="esc-ok"><circle cx="206" cy="68" r="11" fill="#1FCB7E"/><path d="M201 68 l4 4 l7 -8" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g></g>
      ${actor(58, 63, `${simi()}${casco('#F5F7F8', '#D5DDE2')}
        <g><rect x="-6" y="34" width="15" height="20" rx="2" fill="#E6F6FB" stroke="#14100A" stroke-opacity=".25"/><rect x="-2" y="32" width="7" height="4" rx="1.5" fill="#9AA4AC"/>
          <path d="M-3 41 h9 M-3 45 h9 M-3 49 h6" stroke="#54646F" stroke-width="1.2"/></g>
        <g class="esc-lupa"><path d="M58 44 L67 33" stroke="#54646F" stroke-width="3" stroke-linecap="round"/>
          <circle cx="73" cy="26" r="9" fill="#8FD9EE" fill-opacity=".25" stroke="#C9D2D9" stroke-width="2.6"/></g>`)}`
  };

  /* ---------- Estilos ---------- */
  const css = `
  .esc{position:relative;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:14px;align-items:center}
  .esc-esc{position:relative;aspect-ratio:240/150;border-radius:14px;overflow:hidden;background:#1A2731;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}
  .esc-esc>svg{position:absolute;inset:0;width:100%;height:100%;display:block}
  .esc-esc>svg.entra{animation:escEntra .45s ease-out}
  @keyframes escEntra{from{opacity:0;transform:scale(1.03)}to{opacity:1;transform:none}}
  .esc-globo{position:relative;padding:12px 14px;border-radius:14px;background:var(--s1);border:1px solid var(--line);min-height:96px;display:flex;flex-direction:column;gap:6px}
  .esc-globo::before{content:'';position:absolute;left:-7px;top:26px;width:12px;height:12px;background:var(--s1);border-left:1px solid var(--line);border-bottom:1px solid var(--line);transform:rotate(45deg)}
  .esc-cat{font:700 10px/1.2 var(--mono);letter-spacing:.13em;text-transform:uppercase;color:var(--c)}
  .esc-txt{font-size:13.5px;line-height:1.5;color:var(--tx);margin:0}
  .esc-hace{font-size:11.5px;color:var(--tx3);margin:0}
  .esc-acc{display:flex;gap:6px;margin-top:auto;padding-top:4px}
  .esc-acc button{min-height:34px;padding:0 11px;border-radius:999px;border:1px solid var(--line-2);background:transparent;color:var(--tx2);font:500 12px var(--sans);cursor:pointer;display:inline-flex;align-items:center;gap:6px}
  .esc-acc button:hover{color:var(--tx);border-color:var(--amber)}
  .esc-acc button:focus-visible{outline:2px solid var(--amber);outline-offset:2px}
  .esc-acc svg{width:13px;height:13px}
  .esc-puntos{position:absolute;left:9px;bottom:7px;display:flex;gap:4px}
  .esc-puntos i{width:5px;height:5px;border-radius:50%;background:#fff;opacity:.35;transition:opacity .2s,width .2s}
  .esc-puntos i.on{opacity:1;width:14px;border-radius:3px;background:var(--amber)}
  .esc svg [class*="esc-"],.esc svg [class^="l"]{transform-box:fill-box}
  /* ambiente */
  .esc .esc-frio circle{animation:escNieve 6s linear infinite}
  @keyframes escNieve{0%{transform:translate(0,-8px);opacity:0}20%{opacity:.85}100%{transform:translate(6px,34px);opacity:0}}
  .esc .esc-gancho{transform-origin:50% 0%;animation:escGancho 3.2s ease-in-out infinite}
  @keyframes escGancho{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
  .esc .esc-aguja{transform-origin:100% 100%;animation:escAguja 2.6s ease-in-out infinite}
  @keyframes escAguja{0%,100%{transform:rotate(0)}50%{transform:rotate(14deg)}}
  /* levantamiento */
  .esc .esc-tablet{transform-origin:50% 100%;animation:escTap 2.2s ease-in-out infinite}
  @keyframes escTap{0%,100%{transform:rotate(0)}50%{transform:rotate(-4deg) translateY(-1px)}}
  .esc .esc-lineas path{opacity:0;animation:escLinea 5.5s ease-out infinite}
  .esc .esc-lineas .l1{animation-delay:.3s}.esc .esc-lineas .l2{animation-delay:1.2s}.esc .esc-lineas .l3{animation-delay:2.1s}
  @keyframes escLinea{0%{opacity:0}8%,85%{opacity:1}100%{opacity:0}}
  .esc .esc-flash{opacity:0;animation:escFlash 5.5s ease-out infinite 3s}
  @keyframes escFlash{0%,100%{opacity:0}3%{opacity:.9}12%{opacity:0}}
  .esc .esc-mira{transform-origin:center;animation:escMira 2.4s ease-in-out infinite}
  @keyframes escMira{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(.86);opacity:.5}}
  /* eléctrica */
  .esc .esc-destornillador{transform-origin:0% 100%;animation:escAtornilla 1.1s ease-in-out infinite}
  @keyframes escAtornilla{0%,100%{transform:rotate(0)}50%{transform:rotate(-9deg)}}
  .esc .esc-led{fill:#FF4D5E;animation:escLed 6s steps(1) infinite}
  @keyframes escLed{0%,55%{fill:#FF4D5E}56%,100%{fill:#1FCB7E}}
  .esc .esc-loto{transform-origin:20% 0%;animation:escPendula 3s ease-in-out infinite}
  @keyframes escPendula{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
  /* manos */
  .esc .esc-agua{animation:escAgua .5s linear infinite}
  @keyframes escAgua{to{stroke-dashoffset:-6}}
  .esc .esc-mano-i{animation:escFrotaI .55s ease-in-out infinite}
  .esc .esc-mano-d{animation:escFrotaD .55s ease-in-out infinite}
  @keyframes escFrotaI{0%,100%{transform:translate(0,0)}50%{transform:translate(4px,-2px)}}
  @keyframes escFrotaD{0%,100%{transform:translate(0,0)}50%{transform:translate(-4px,2px)}}
  .esc .esc-burbujas circle{animation:escBurbuja 1.8s ease-out infinite}
  @keyframes escBurbuja{0%{transform:translateY(0) scale(.6);opacity:0}25%{opacity:1}100%{transform:translateY(-16px) scale(1.2);opacity:0}}
  /* pintura */
  .esc .esc-rodillo{animation:escRodillo 2.4s ease-in-out infinite}
  @keyframes escRodillo{0%,100%{transform:translateY(-22px)}50%{transform:translateY(26px)}}
  .esc .esc-pintado{transform-origin:50% 100%;animation:escPinta 9s linear infinite}
  @keyframes escPinta{0%{transform:scaleY(.04)}85%,100%{transform:scaleY(1)}}
  /* escalera */
  .esc .esc-sube{animation:escSube 8s ease-in-out infinite}
  @keyframes escSube{0%,8%{transform:translateY(0)}45%,62%{transform:translateY(-42px)}95%,100%{transform:translateY(0)}}
  .esc .esc-tubo{animation:escTubo 8s steps(1) infinite}
  @keyframes escTubo{0%,50%{opacity:.15}51%,100%{opacity:1}}
  .esc .esc-ataja{animation:escAtaja 2s ease-in-out infinite}
  @keyframes escAtaja{0%,100%{transform:translateX(0)}50%{transform:translateX(1.4px)}}
  .esc .esc-ataja-mano{animation:escAtaja 2s ease-in-out infinite}
  /* piso */
  .esc .esc-secador{animation:escSecador 2.6s ease-in-out infinite}
  @keyframes escSecador{0%,100%{transform:translateX(-6px)}50%{transform:translateX(12px)}}
  .esc .esc-brillo{animation:escBrillo 1.8s ease-in-out infinite}
  @keyframes escBrillo{0%,100%{opacity:.25}50%{opacity:1}}
  .esc .esc-charco{transform-origin:50% 50%;animation:escCharco 7s ease-in-out infinite}
  @keyframes escCharco{0%{transform:scaleX(1)}80%{transform:scaleX(.35);opacity:.6}100%{transform:scaleX(1)}}
  .esc .esc-cartel{transform-origin:50% 100%;animation:escPendula 3.4s ease-in-out infinite}
  /* cámara */
  .esc .esc-haz{transform-origin:0% 50%;animation:escHaz 3.6s ease-in-out infinite}
  @keyframes escHaz{0%,100%{transform:rotate(-12deg)}50%{transform:rotate(26deg)}}
  .esc .esc-hielo{transform-origin:center;animation:escHielo 3.6s ease-in-out infinite}
  @keyframes escHielo{0%,40%{opacity:0;transform:scale(.6)}55%,90%{opacity:1;transform:scale(1)}100%{opacity:0}}
  /* extintor */
  .esc .esc-salida{animation:escSalida 3s ease-in-out infinite}
  @keyframes escSalida{0%,100%{opacity:1}50%{opacity:.75}}
  .esc .esc-tarjeta{transform-origin:50% 0%;animation:escPendula 2.8s ease-in-out infinite}
  .esc .esc-tilde{stroke-dasharray:12;stroke-dashoffset:12;animation:escTilde 4.2s ease-out infinite}
  @keyframes escTilde{0%,10%{stroke-dashoffset:12}30%,90%{stroke-dashoffset:0}100%{stroke-dashoffset:12}}
  /* calidad */
  .esc .esc-lupa{animation:escLupa 4s ease-in-out infinite}
  @keyframes escLupa{0%,100%{transform:translate(0,0)}35%{transform:translate(14px,8px)}70%{transform:translate(4px,16px)}}
  .esc .esc-ok{transform-origin:center;animation:escOk 4s ease-out infinite}
  @keyframes escOk{0%,55%{transform:scale(0);opacity:0}65%{transform:scale(1.25);opacity:1}75%,95%{transform:scale(1);opacity:1}100%{opacity:0}}
  /* evaporador */
  .esc .esc-helice{transform-origin:center;animation:escGira .6s linear infinite}
  @keyframes escGira{to{transform:rotate(360deg)}}
  .esc .esc-hieloev{transform-origin:50% 0%;animation:escDeshiela 7s ease-in-out infinite}
  @keyframes escDeshiela{0%,10%{transform:scaleY(1);opacity:1}70%,90%{transform:scaleY(.15);opacity:.4}100%{transform:scaleY(1);opacity:1}}
  .esc .esc-gota{animation:escGota 1.4s ease-in infinite}
  @keyframes escGota{0%{transform:translateY(0);opacity:0}15%{opacity:1}100%{transform:translateY(24px);opacity:0}}
  .esc .esc-cepillo{animation:escCepillo 1.3s ease-in-out infinite}
  @keyframes escCepillo{0%,100%{transform:translate(-4px,0)}50%{transform:translate(8px,-2px)}}
  /* engrase */
  .esc .esc-cinta{animation:escCinta .7s linear infinite}
  @keyframes escCinta{to{stroke-dashoffset:-10}}
  .esc .esc-rueda,.esc .esc-engranaje{transform-origin:center;animation:escGira 2.4s linear infinite}
  .esc .esc-engranaje2{transform-origin:center;animation:escGira 1.75s linear infinite reverse}
  .esc .esc-grasa{transform-origin:center;animation:escGrasa 1.6s ease-out infinite}
  @keyframes escGrasa{0%,40%{transform:scale(0)}70%{transform:scale(1.3)}100%{transform:scale(1);opacity:0}}
  /* antes y después */
  .esc .esc-antes{transform-origin:0% 50%;animation:escAntes 5s ease-in-out infinite}
  @keyframes escAntes{0%,100%{transform:scaleX(.9)}50%{transform:scaleX(.12)}}
  .esc .esc-divisor{animation:escDivisor 5s ease-in-out infinite}
  @keyframes escDivisor{0%,100%{transform:translateX(40px)}50%{transform:translateX(-38px)}}
  .esc .esc-senala{transform-origin:0% 100%;animation:escPendula 2.6s ease-in-out infinite}
  /* desagüe */
  .esc .esc-escoba{animation:escEscoba 1.5s ease-in-out infinite}
  @keyframes escEscoba{0%,100%{transform:translateX(18px)}50%{transform:translateX(-4px)}}
  .esc .esc-mugre circle{animation:escMugre 3s ease-in infinite}
  @keyframes escMugre{0%{transform:translateX(0);opacity:1}80%{transform:translateX(-40px);opacity:1}100%{transform:translateX(-44px);opacity:0}}
  .esc .esc-remolino{transform-origin:center;animation:escRemolino 2s ease-in-out infinite}
  @keyframes escRemolino{0%,100%{transform:scaleX(1);opacity:.25}50%{transform:scaleX(.7);opacity:.4}}
  /* sellado */
  .esc .esc-camina{animation:escCamina 7s linear infinite}
  @keyframes escCamina{0%{transform:translateX(0)}85%,100%{transform:translateX(78px)}}
  .esc .esc-cordon{stroke-dasharray:80;stroke-dashoffset:80;animation:escCordon 7s linear infinite}
  @keyframes escCordon{0%{stroke-dashoffset:80}85%,100%{stroke-dashoffset:2}}
  .esc.pausa *,.esc.pausa .simi-svg *{animation-play-state:paused!important}
  /* Celular: escena y consejo lado a lado, compactos, para no ocupar la pantalla */
  @media(max-width:820px){
    .esc{grid-template-columns:minmax(0,46%) minmax(0,1fr);gap:10px;align-items:stretch}
    .esc-esc{align-self:center;border-radius:11px}
    .esc-globo{min-height:0;padding:9px 10px;gap:4px;border-radius:12px}
    .esc-globo::before{top:22px}
    .esc-cat{font-size:8.5px;letter-spacing:.1em}
    .esc-txt{font-size:12.5px;line-height:1.4}
    .esc-hace,.esc-acc .esc-lbl,.esc-puntos{display:none}
    .esc-acc{padding-top:2px;gap:5px}
    .esc-acc button{min-height:32px;min-width:36px;padding:0 9px;justify-content:center}
  }
  @media(prefers-reduced-motion:reduce){.esc *{animation:none!important}.esc .esc-lineas path,.esc .esc-hielo{opacity:1}.esc .esc-pintado{transform:scaleY(.6)}.esc .esc-ok{opacity:1;transform:none}.esc .esc-tilde{stroke-dashoffset:0}.esc .esc-cordon{stroke-dashoffset:20}.esc .esc-antes{transform:scaleX(.5)}.esc .esc-divisor{transform:none}.esc .esc-frio circle{opacity:.6}}`;
  const st = document.createElement('style'); st.id = 'simiEscenasCss'; st.textContent = css; document.head.appendChild(st);

  /* ---------- Estado y motor ---------- */
  const leerPausa = () => { try { return localStorage.getItem(CLAVE_PAUSA) === '1'; } catch (_) { return false; } };
  const S = { esc: 0, tip: {}, pausa: leerPausa(), timer: null };
  ESCENAS.forEach(e => { S.tip[e.id] = Math.floor(Math.random() * CONSEJOS[e.id].length); });
  S.esc = Math.floor(Math.random() * ESCENAS.length);

  const ICO = {
    pausa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    otro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>'
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function pintar(raiz, anima) {
    const enRuta = raiz.dataset.ruta === 'curso';
    const e = enRuta ? ESCENAS[0] : ESCENAS[S.esc];
    const svgEl = `<svg viewBox="0 0 240 150" class="${anima ? 'entra' : ''}" aria-hidden="true" focusable="false">${DIBUJO[e.id]()}</svg>`;
    const caja = raiz.querySelector('.esc-esc');
    caja.innerHTML = svgEl + (enRuta ? '' : `<div class="esc-puntos" aria-hidden="true">${ESCENAS.map((x, i) => `<i class="${i === S.esc ? 'on' : ''}"></i>`).join('')}</div>`);
    caja.setAttribute('aria-label', 'SIMI ' + e.t.charAt(0).toLowerCase() + e.t.slice(1));
    if (M()) M().vivir(caja);
    const g = raiz.querySelector('.esc-globo');
    if (enRuta) {
      g.innerHTML = `<span class="esc-cat" style="--c:var(--ice-tx, #8FD9EE)">Ruta en curso</span>
        <p class="esc-txt">Te acompaño con la tablet. Cargá cada hallazgo con foto y, cuando termines, cerrá la ruta desde Inspección.</p>`;
      return;
    }
    const lista = CONSEJOS[e.id], raw = lista[S.tip[e.id] % lista.length];
    const tip = typeof raw === 'string' ? raw : raw.t, c = CAT[(raw && raw.c) || e.cat];
    g.innerHTML = `<span class="esc-cat" style="--c:${c.c}">Consejo de SIMI · ${c.t}</span>
      <p class="esc-txt" id="escTxt">${esc(tip)}</p>
      <p class="esc-hace">${esc(e.t)}</p>
      <div class="esc-acc">
        <button type="button" data-acc="otro" aria-label="Otro consejo">${ICO.otro}<span class="esc-lbl"> Otro consejo</span></button>
        ${REDUCE ? '' : `<button type="button" data-acc="pausa" aria-pressed="${S.pausa}" aria-label="${S.pausa ? 'Animar' : 'Pausar'}">${S.pausa ? ICO.play + '<span class="esc-lbl"> Animar</span>' : ICO.pausa + '<span class="esc-lbl"> Pausar</span>'}</button>`}
      </div>`;
  }

  function avanzar(raiz) {
    S.tip[ESCENAS[S.esc].id]++;
    S.esc = (S.esc + 1) % ESCENAS.length;
    pintar(raiz, true);
  }
  const raizActual = () => document.getElementById('homeEsc');
  const enPantalla = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight; };

  function programar() {
    clearTimeout(S.timer);
    S.timer = setTimeout(function tic() {
      const r = raizActual();
      if (r && r.dataset.ruta !== 'curso' && !S.pausa && !REDUCE && !document.hidden && enPantalla(r) && !document.getElementById('simaTour')) avanzar(r);
      S.timer = setTimeout(tic, CICLO);
    }, CICLO);
  }

  function montar(raiz) {
    if (!raiz || raiz.dataset.montado) return;
    raiz.dataset.montado = '1';
    raiz.classList.add('esc');
    raiz.classList.toggle('pausa', S.pausa && !REDUCE);
    raiz.innerHTML = `<div class="esc-esc" role="img"></div><div class="esc-globo"></div>`;
    pintar(raiz, false);
    raiz.addEventListener('click', ev => {
      const b = ev.target.closest('button[data-acc]'); if (!b) return;
      if (b.dataset.acc === 'otro') { avanzar(raiz); programar(); raiz.querySelector('[data-acc="otro"]').focus(); }
      else {
        S.pausa = !S.pausa;
        try { localStorage.setItem(CLAVE_PAUSA, S.pausa ? '1' : '0'); } catch (_) { }
        raiz.classList.toggle('pausa', S.pausa);
        pintar(raiz, false);
        raiz.querySelector('[data-acc="pausa"]').focus();
      }
    });
    programar();
  }

  // Inicio se vuelve a dibujar con cada render(): al aparecer #homeEsc se monta
  // de nuevo sin perder la escena ni el consejo en el que iba.
  addEventListener('load', () => montar(raizActual()));
  new MutationObserver(() => { const r = raizActual(); if (r && !r.dataset.montado) montar(r); })
    .observe(document.documentElement, { childList: true, subtree: true });

  window.SIMI_ESC = { montar, ESCENAS, CONSEJOS };
})();
