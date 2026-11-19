/* =====================================================================
   SIMA · Guía de uso para SIMI (07-11-26)
   ---------------------------------------------------------------------
   Base de conocimiento de SIMI: cómo se hace cada cosa en SIMA, con los
   nombres de botones y pantallas TAL COMO aparecen en la app. Es la
   fuente única de las respuestas de ayuda:
     · Sin señal, SIMI busca acá y responde con el artículo.
     · Con señal, Llama redacta la respuesta usando SÓLO estos textos
       (no inventa pantallas ni botones).
   Para corregir o sumar una respuesta, se edita este archivo.

   Campos de cada artículo:
     id     identificador estable (se usa en «Ver guía»)
     t      título, como pregunta o acción
     quien  quién lo hace (se avisa si el usuario tiene otro rol)
     roles  roles que lo hacen: inspeccion | mantenimiento | calidad | vista | admin
     claves palabras y sinónimos con que lo puede preguntar la gente
     pasos  pasos en orden, con los botones entre «»
     nota   aclaración o consejo (opcional)
     ir     pantalla a la que lleva «Llevame ahí» (opcional)
     rel    artículos relacionados
   ===================================================================== */
window.SIMA_AYUDA = [
  {
    id: 'recorrido', t: '¿Cómo hago un recorrido (ruta de inspección)?', quien: 'el Inspector', roles: ['inspeccion'],
    claves: 'recorrido ruta inspeccion comenzar iniciar empezar arrancar abrir nuevo periodo quincena recorrer hacer ruta',
    pasos: [
      'Entrá a «Inspección».',
      'En la tarjeta «Ruta de inspección», tocá «Comenzar siguiente recorrido».',
      'Revisá el aviso: los hallazgos sin resolver pasan al nuevo recorrido como arrastrados.',
      'Tocá «Comenzar recorrido». Se abre la ruta en curso.',
      'Por cada no conformidad, tocá «Cargar hallazgo».',
      'Cuando completes la ruta, tocá «Cerrar recorrido» (ver cómo se cierra).'
    ],
    nota: 'Si ya hay una ruta en curso, la tarjeta muestra «Continuar ruta». Para seguir cargando el último recorrido otro día sin arrastrar nada, usá «Reabrir».',
    ir: { vista: 'inspeccion' }, rel: ['cargar', 'sin-novedad', 'cerrar-recorrido', 'planificar']
  },
  {
    id: 'cargar', t: '¿Cómo cargo un hallazgo?', quien: 'el Inspector', roles: ['inspeccion'],
    claves: 'cargar hallazgo levantar levantamiento registrar foto falla no conformidad nuevo punto anotar subir',
    pasos: [
      'Con la ruta en curso, tocá «Cargar hallazgo».',
      'Sacá la foto. Si sale oscura o movida, SIMA te avisa para repetirla.',
      'Elegí el sector o subsector con el buscador de ubicación.',
      'Elegí el tipo de hallazgo y la disciplina, o tocá «Aplicar todo» en la sugerencia ✦ de la IA.',
      'Escribí la descripción o tocá «Dictar» y hablá.',
      'Tocá «Guardar levantamiento».'
    ],
    nota: 'La foto es obligatoria. Sin señal se guarda igual en el equipo y se sube después.',
    ir: { vista: 'inspeccion' }, rel: ['ia', 'dictado', 'sin-novedad']
  },
  {
    id: 'sin-novedad', t: '¿Cómo marco un sector sin novedad?', quien: 'el Inspector', roles: ['inspeccion'],
    claves: 'sector sin novedad marcar sector recorrido ok todo bien sin problemas sin hallazgos revisado',
    pasos: [
      'Con la ruta en curso, tocá «Cargar hallazgo».',
      'Elegí el sector en el buscador de ubicación.',
      'Tocá «Marcar sector sin novedad». Queda en verde como «Sector marcado sin novedad».'
    ],
    nota: 'Si lo marcaste por error, tocá el mismo botón para desmarcarlo. La barra de la ruta muestra cuántos sectores llevás.',
    ir: { vista: 'inspeccion' }, rel: ['recorrido', 'cerrar-recorrido']
  },
  {
    id: 'cerrar-recorrido', t: '¿Cómo cierro el recorrido?', quien: 'el Inspector', roles: ['inspeccion'],
    claves: 'cerrar recorrido cierro cierre cierra terminar ruta finalizar ruta salir cancelar recorrido guardar ruta',
    pasos: [
      'En la ruta en curso, tocá «Cerrar recorrido».',
      'Si quedan sectores sin marcar, SIMA te pregunta si querés cerrarlo igual.',
      'Confirmá. El recorrido pasa a «Rutas cerradas».'
    ],
    nota: '«Salir sin cerrar» guarda la ruta para retomarla después. «Cancelar» sólo se puede si la ruta no tiene hallazgos nuevos.',
    ir: { vista: 'inspeccion' }, rel: ['recorrido', 'pdf', 'excel']
  },
  {
    id: 'planificar', t: '¿Cómo planifico el próximo recorrido?', quien: 'el Inspector', roles: ['inspeccion'],
    claves: 'planificar planificacion calendario proximo recorrido fecha dia por area agendar ruta',
    pasos: [
      'En «Inspección», tarjeta «Ruta de inspección», tocá «Planificar en el calendario».',
      'Elegí un día para cada área (podés dejar alguna sin fecha).',
      'Tocá «Guardar». La planificación aparece en el «Calendario».'
    ],
    nota: 'Los hallazgos no se arrastran hasta que comiences el recorrido.',
    ir: { vista: 'calendario' }, rel: ['recorrido', 'tentativa']
  },
  {
    id: 'programar', t: '¿Cómo programo un trabajo?', quien: 'el Inspector', roles: ['inspeccion'],
    claves: 'programar trabajo asignar tecnico asignacion mandar mantenimiento derivar orden reprogramar agenda',
    pasos: [
      'Abrí el hallazgo en estado «Detectado» (desde «Inspección» o «Mantenimiento»).',
      'Tocá «Programar».',
      'Elegí el técnico. Con «Agregar técnico» sumás más.',
      'Precisá la descripción del trabajo si hace falta.',
      'Completá fecha, hora tentativa, duración estimada y, si la tenés, la orden SAP.',
      'Tocá «Programar».'
    ],
    nota: 'El trabajo aparece en «Mis trabajos» de cada técnico asignado. Si no aparece ningún técnico, falta crear usuarios con rol Mantenimiento en esa planta.',
    ir: { vista: 'mantenimiento' }, rel: ['tentativa', 'sap', 'usuarios']
  },
  {
    id: 'tentativa', t: '¿Qué es y cómo pongo una fecha tentativa?', quien: 'el Inspector', roles: ['inspeccion'],
    claves: 'fecha tentativa plazo vencimiento vencida por vencer compromiso cuando se hace calendario',
    pasos: [
      'Abrí el hallazgo y tocá «Fecha tentativa».',
      'Elegí la fecha comprometida y tocá «Guardar».',
      'También podés hacerlo desde el «Calendario»: tocá un día y fijalo para varios hallazgos a la vez.'
    ],
    nota: 'Es la fecha en que debería quedar resuelto. Si cambia, «Reprogramar tentativa» deja registro. Las vencidas se marcan en rojo.',
    ir: { vista: 'calendario' }, rel: ['programar', 'planificar']
  },
  {
    id: 'sap', t: '¿Dónde cargo la orden SAP?', quien: 'el Inspector', roles: ['inspeccion'],
    claves: 'orden sap numero sap cargar sap aviso sap',
    pasos: [
      'Al programar el trabajo, completá el campo «Orden SAP».',
      'Si ya estaba programado, abrí el hallazgo y tocá «Orden SAP».'
    ],
    nota: 'Se puede completar después. El Excel de seguimiento marca los abiertos sin orden SAP.',
    rel: ['programar', 'excel']
  },
  {
    id: 'iniciar', t: '¿Cómo inicio un trabajo?', quien: 'el técnico de Mantenimiento', roles: ['mantenimiento'],
    claves: 'iniciar trabajo empezar comenzar trabajo arrancar tarea mis trabajos por hacer',
    pasos: [
      'Entrá a «Mis trabajos», pestaña «Por hacer».',
      'Abrí el trabajo programado.',
      'Tocá «Iniciar trabajo». La fecha de inicio queda registrada sola.'
    ],
    ir: { vista: 'mantenimiento' }, rel: ['cerrar-trabajo']
  },
  {
    id: 'cerrar-trabajo', t: '¿Cómo cierro un trabajo terminado?', quien: 'el técnico de Mantenimiento', roles: ['mantenimiento'],
    claves: 'cerrar trabajo cierro cierre cierra terminar trabajo finalizar registrar cierre foto despues cumplimiento legajo horas apoyo',
    pasos: [
      'En «Mis trabajos», abrí el trabajo en ejecución.',
      'Tocá «Registrar cierre».',
      'Sacá la foto del trabajo terminado (evidencia de cumplimiento).',
      'Cargá fechas y horas de inicio y fin, y tu legajo.',
      'Si te ayudó alguien, sumalo en «Técnicos de apoyo».',
      'Guardá. El trabajo pasa a «A verificar» por el Inspector.'
    ],
    nota: 'La foto, las horas y el legajo son obligatorios.',
    ir: { vista: 'mantenimiento' }, rel: ['iniciar', 'verificar']
  },
  {
    id: 'verificar', t: '¿Cómo verifico un trabajo cerrado por Mantenimiento?', quien: 'el Inspector', roles: ['inspeccion'],
    claves: 'verificar verificacion aprobar trabajo revisar cierre rechazar verificacion a verificar control inspector',
    pasos: [
      'Entrá a «Control de Calidad» y mirá el bloque «A verificar · Inspector».',
      'Abrí el trabajo y tocá «Verificar y cerrar».',
      'Revisá la foto de cumplimiento, quién lo hizo y las horas.',
      'Si está bien, verificalo: queda cerrado y pasa al control final de Calidad.',
      'Si no, rechazalo con el motivo: vuelve a Mantenimiento.'
    ],
    ir: { vista: 'calidad' }, rel: ['calidad', 'estados']
  },
  {
    id: 'calidad', t: '¿Cómo hace Calidad el control final?', quien: 'Control de Calidad', roles: ['calidad'],
    claves: 'calidad control final validar aceptar rechazar validacion bpm inocuidad anular validacion',
    pasos: [
      'Entrá a «Control final», bloque «A validar · Calidad».',
      'Abrí el trabajo cerrado por el Inspector.',
      'Tocá «Aceptar» si está bien.',
      'O tocá «Rechazar», elegí el motivo y escribí la justificación (al menos 15 caracteres).'
    ],
    nota: 'Un rechazo de Calidad hace que el trabajo vuelva a programarse. Si aceptaste por error, «Anular validación» lo revierte.',
    ir: { vista: 'calidad' }, rel: ['verificar', 'estados']
  },
  {
    id: 'estados', t: '¿Qué significa cada estado?', quien: '', roles: [],
    claves: 'estados estado significa detectado programado en ejecucion a verificar cerrado ciclo flujo etapas que es',
    pasos: [
      '«Detectado»: el Inspector lo cargó; falta programarlo.',
      '«Programado»: tiene técnicos y fecha asignados.',
      '«En ejecución»: el técnico lo inició.',
      '«A verificar»: Mantenimiento lo cerró con foto; lo revisa el Inspector.',
      '«Cerrado»: el Inspector lo verificó; falta el control final de Calidad.'
    ],
    nota: 'Si Calidad rechaza, vuelve a programarse. Todo queda en el historial del hallazgo.',
    rel: ['programar', 'verificar', 'calidad']
  },
  {
    id: 'arrastre', t: '¿Qué es un hallazgo arrastrado?', quien: '', roles: [],
    claves: 'arrastrado arrastre arrastra pendiente anterior viene del recorrido anterior repetido periodo anterior',
    pasos: [
      'Es un hallazgo de un recorrido anterior que sigue sin resolver.',
      'Pasa al recorrido nuevo recién cuando se toca «Comenzar siguiente recorrido».',
      'No hay que volver a cargarlo: aparece solo en la lista de la ruta.'
    ],
    nota: 'Si cargás otro hallazgo del mismo tipo en el mismo punto, SIMA sólo te avisa; no lo bloquea.',
    rel: ['recorrido']
  },
  {
    id: 'editar', t: '¿Cómo corrijo un hallazgo ya cargado?', quien: 'el Inspector', roles: ['inspeccion'],
    claves: 'editar corregir modificar cambiar hallazgo error descripcion tipo ubicacion equivocado',
    pasos: [
      'Abrí el hallazgo.',
      'Tocá «Editar».',
      'Corregí lo necesario y guardá. El cambio queda en el historial.'
    ],
    nota: 'Sólo se edita mientras está «Detectado» y su recorrido sigue en curso: el PDF de una ruta cerrada ya es un documento emitido.',
    rel: ['cargar']
  },
  {
    id: 'pdf', t: '¿Cómo saco el PDF del recorrido?', quien: '', roles: ['inspeccion', 'vista', 'calidad'],
    claves: 'pdf imprimir reporte informe formulario exportar pdf recorrido auditoria',
    pasos: [
      'Entrá a «Inspección», pestaña «Rutas cerradas».',
      'En la ruta, tocá «Exportar PDF».',
      'Elegí las disciplinas a incluir y generá el PDF.'
    ],
    nota: 'Con la ruta en curso también está «Vista previa PDF». Desde el detalle de un hallazgo, «PDF del recorrido».',
    ir: { vista: 'inspeccion', insp: 'rutas' }, rel: ['excel']
  },
  {
    id: 'excel', t: '¿Cómo exporto el Excel de seguimiento?', quien: '', roles: ['inspeccion', 'vista', 'calidad'],
    claves: 'excel planilla exportar seguimiento xlsx dashboard descargar listado',
    pasos: [
      'Entrá a «Inspección», pestaña «Rutas cerradas».',
      'Tocá «Exportar Excel» en una ruta, o «Exportar Excel · todas las rutas» arriba.',
      'Se descarga con dos hojas: «Levantamientos» (sin fotos) y «Dashboard».'
    ],
    nota: 'En la hoja Levantamientos podés cambiar el estado con la lista desplegable: el Dashboard se recalcula solo.',
    ir: { vista: 'inspeccion', insp: 'rutas' }, rel: ['pdf']
  },
  {
    id: 'dictado', t: '¿Cómo dicto por voz?', quien: '', roles: [],
    claves: 'dictar dictado voz hablar microfono audio transcribir grabar',
    pasos: [
      'En el campo de descripción, tocá «Dictar» (abajo a la derecha).',
      'Hablá. Vas a ver el tiempo y el nivel de tu voz.',
      'Tocá «Listo». SIMA transcribe y agrega el texto.',
      'Revisalo antes de guardar.'
    ],
    nota: 'Con ✕ o Esc cancelás sin tocar lo que ya estaba escrito. Al cargar un hallazgo también está «Dictar descripción» junto a la foto. Si el navegador lo pide, permití el micrófono.',
    rel: ['cargar', 'ia']
  },
  {
    id: 'ia', t: '¿Cómo funciona la sugerencia de la IA?', quien: '', roles: ['inspeccion'],
    claves: 'ia inteligencia artificial sugerencia sugiere llama aplicar todo chips confianza automatico',
    pasos: [
      'Al sacar la foto, el panel ✦ propone tipo, disciplina y descripción.',
      'Tocá cada sugerencia o «Aplicar todo» para usarla.',
      'Si no coincide, elegí vos los valores: nada se aplica solo.'
    ],
    nota: 'Con confianza baja te avisa que revises. Sin señal o sin cupo se carga igual que siempre.',
    rel: ['cargar', 'dictado']
  },
  {
    id: 'sin-senal', t: '¿Qué pasa si no tengo señal?', quien: '', roles: [],
    claves: 'sin senal offline sin internet sin conexion modo local sin subir sincronizar camara de frio no sube',
    pasos: [
      'Seguí trabajando: SIMA guarda todo en el equipo.',
      'La banda «MODO LOCAL · N SIN SUBIR» muestra lo que falta subir.',
      'Al volver la señal, se sube solo.'
    ],
    nota: 'Evitá borrar los datos del navegador mientras haya cambios sin subir.',
    rel: ['cargar']
  },
  {
    id: 'planta', t: '¿Cómo cambio de planta?', quien: '', roles: [],
    claves: 'planta cambiar planta planta 2 planta 8 otra planta selector',
    pasos: [
      'Tocá el selector de planta, junto a tu avatar.',
      'Elegí la planta.'
    ],
    nota: 'Cada planta tiene sus propios hallazgos, rutas, estructura y técnicos. Sólo ves las plantas habilitadas en tu usuario.',
    rel: ['usuarios']
  },
  {
    id: 'usuarios', t: '¿Cómo doy de alta un usuario o técnico?', quien: 'el administrador', roles: ['admin'],
    claves: 'usuario usuarios alta crear tecnico nuevo legajo rol permisos acceso contrasena plantas',
    pasos: [
      'Entrá a «Configuración», pestaña «Usuarios y técnicos».',
      'Tocá «Nuevo usuario» y completá nombre y apellido, correo, rol, legajo, plantas con acceso y contraseña provisoria.',
      'A un técnico cargale el legajo (también con el lápiz, después): así ve sólo sus trabajos.'
    ],
    nota: 'Sólo la cuenta administradora ve «Configuración».',
    ir: { vista: 'config' }, rel: ['estructura', 'programar']
  },
  {
    id: 'estructura', t: '¿Cómo agrego un sector o subsector?', quien: 'el administrador', roles: ['admin'],
    claves: 'estructura sector subsector area agregar sector nuevo sector ubicacion configurar planta',
    pasos: [
      'Entrá a «Configuración», pestaña «Estructura de planta».',
      'Elegí el área y agregá o editá sectores y subsectores.'
    ],
    nota: 'La estructura es propia de cada planta.',
    ir: { vista: 'config' }, rel: ['usuarios']
  },
  {
    id: 'filtros', t: '¿Cómo busco o filtro hallazgos?', quien: '', roles: [],
    claves: 'buscar filtrar filtro encontrar busqueda fecha area tipo estado disciplina lista',
    pasos: [
      'En «Inspección» o «Mantenimiento», usá la barra de filtros.',
      'Filtrá por fecha, área, tipo, estado o disciplina, o escribí en el buscador (ID, descripción, técnico u orden SAP).',
      'Lo que está filtrando se ve como etiquetas; quitalas con la ✕.'
    ],
    nota: 'También podés preguntarme: «¿cuántos abiertos hay en Área Fría?» y te abro la lista ya filtrada.',
    ir: { vista: 'inspeccion' }, rel: ['simi']
  },
  {
    id: 'sesion', t: '¿Por qué se cerró mi sesión?', quien: '', roles: [],
    claves: 'sesion cerro sesion salio me saco login ingresar contrasena inactividad',
    pasos: [
      'Por seguridad, la sesión se cierra tras 60 minutos sin uso.',
      'Ingresá de nuevo con tu correo y contraseña.'
    ],
    nota: 'Lo que cargaste sin señal no se pierde: queda en el equipo hasta subirse.',
    rel: ['sin-senal']
  },
  {
    id: 'simi', t: '¿Qué puedo preguntarle a SIMI?', quien: '', roles: [],
    claves: 'simi que podes hacer ayuda que sabes asistente preguntas',
    pasos: [
      'Cómo hacer algo en SIMA: un recorrido, programar, cerrar o verificar un trabajo, exportar…',
      'Números de tus hallazgos: cuántos hay, qué área, tipo o sector tiene más, los más antiguos.',
      'Podés escribir o tocar el micrófono.'
    ],
    nota: 'Las cifras salen de los datos de SIMA que podés ver. No puedo cambiar datos: te indico los pasos y te llevo a la pantalla.',
    rel: ['inicio', 'recorrido', 'programar']
  },
  {
    id: 'nc', t: '¿Qué es una no conformidad o un hallazgo?', quien: '', roles: [],
    claves: 'no conformidad nc hallazgo hallazgos levantamiento levantamientos que es significa definicion',
    pasos: [
      'Es algo de la planta que no cumple lo esperado: una puerta que no cierra, una fisura, silicona despegada, una luminaria sin tapa…',
      'En SIMA se llama «hallazgo» o «levantamiento». Lo carga el Inspector durante la ruta de inspección, con foto, ubicación y tipo.',
      'Recorre un circuito: Detectado → Programado → En ejecución → A verificar → Cerrado, y al final lo valida Control de Calidad.'
    ],
    nota: 'Cada hallazgo tiene un número (LV-…) para seguirlo en todo el circuito y en la auditoría.',
    ir: { vista: 'inspeccion' }, rel: ['estados', 'recorrido', 'repetidas']
  },
  {
    id: 'disciplinas', t: '¿Qué es la disciplina de un hallazgo?', quien: '', roles: [],
    claves: 'disciplina disciplinas civil electrico mecanico especialidad que es significa',
    pasos: [
      'Es la especialidad que lo resuelve: Civil (paredes, pisos, techos, zócalos, sellados), Eléctrico (conexiones, tomas, luminarias), Mecánico (puertas, soldaduras, equipos) u Otro.',
      'Se sugiere sola según el tipo de hallazgo y el Inspector la puede cambiar al cargarlo.'
    ],
    rel: ['cargar', 'ia']
  },
  {
    id: 'repetidas', t: '¿Qué es una no conformidad repetitiva?', quien: '', roles: [],
    claves: 'repetitiva repetitivas repetida repetidas reincidencia reincidente se repite causa raiz que es',
    pasos: [
      'Cuando aparecen 3 o más hallazgos del mismo tipo en el mismo punto (área, sector y subsector) en 120 días.',
      'Significa que el arreglo no atacó la causa: conviene un análisis de causa raíz antes de repetir la misma reparación.',
      'SIMI lo avisa con un número en su botón y al cargar el hallazgo; preguntame «NC que se repiten» para verlas.'
    ],
    rel: ['nc', 'estados']
  },
  {
    id: 'inicio', t: '¿Para qué sirve Inicio?', quien: '', roles: [],
    claves: 'inicio home principal portada por donde empiezo donde arranco secciones donde esta navegar menu moverme',
    pasos: [
      'Es la primera pantalla al entrar. Arriba, «Tu próximo paso» te dice qué conviene hacer primero según tu rol.',
      'Debajo, los números de lo que espera una acción (sin programar, a verificar, vencidas…): tocá uno para ir.',
      '«Secciones de SIMA» explica en una línea para qué sirve cada sección.',
      'Para repetir la guía paso a paso, tocá «Ver el recorrido guiado con SIMI» al final de Inicio, o pedímelo.'
    ],
    ir: { vista: 'inicio' }, rel: ['simi', 'estados']
  },
  {
    id: 'ra', t: '¿Cómo marco una no conformidad con realidad aumentada (RA)?', quien: 'el Inspector', roles: ['inspeccion', 'vista', 'mantenimiento', 'calidad'],
    claves: 'ra realidad aumentada marcar nc no conformidad pin ubicacion gps mapa radar camara webxr donde esta ir hasta',
    pasos: [
      'Dentro de una Ruta de inspección en curso, tocá «Marcar NC en RA».',
      'Android con Chrome: mové el celular despacio hacia la falla hasta que aparezca un aro sobre la superficie y tocá la pantalla: se clava el pin rojo «NC». SIMA calcula la distancia y el rumbo y guarda la ubicación de la falla.',
      'iPhone y otros equipos: tocá en la imagen el punto exacto de la falla y luego «Tomar foto y marcar». La foto queda con el pin dibujado como evidencia.',
      'Se abre la carga de siempre con la marca ya hecha: completá descripción, sector y tipo, y guardá. Aunque cargues sin RA, se guarda la ubicación GPS del momento.',
      'Para encontrarla: en «Mapa NC» tocá el punto y «Ir hasta la NC», o «Buscar con la cámara»: cada NC aparece como una tarjeta fija en el lugar donde se levantó, con su estado (roja pendiente, amarilla programada, verde resuelta) y los días que lleva abierta.',
      'Si en ese lugar ya hubo NC, SIMI te avisa: es una reincidencia y conviene ir a la causa.'
    ],
    nota: 'Adentro de las cámaras de frío el GPS puede no llegar o ser impreciso: la NC queda igual con su sector y subsector, y se indica la precisión (±m).',
    ir: { vista: 'inspeccion' }, rel: ['modulos']
  },
  {
    id: 'modulos', t: '¿Qué son los módulos de SIMA y cómo cambio de módulo?', quien: 'el Inspector', roles: ['inspeccion'],
    claves: 'modulo modulos cambiar modulo elegir modulo pantalla de modulos tres modulos ruta nfc iot tiempo real equipos volver',
    pasos: [
      'SIMA tiene tres módulos: 1 «Ruta de inspección», 2 «Seguimiento de equipos» (NFC) y 3 «Monitoreo en tiempo real» (IoT).',
      'Después de iniciar sesión aparece la pantalla de módulos: tocá la tarjeta del que quieras usar.',
      'Para cambiar, tocá la píldora del módulo en la barra de arriba (al lado del logo de SIMA) o «Módulos» en el menú del módulo.',
      'El logo de SIMA te lleva al inicio del módulo en el que estás.'
    ],
    nota: 'Por ahora los módulos son sólo para el Inspector. Los módulos 2 y 3 están en preparación: se puede entrar para ver cómo van a funcionar.',
    ir: { vista: 'modulos' }, rel: ['mod-nfc', 'mod-iot']
  },
  {
    id: 'mod-nfc', t: '¿Cómo va a funcionar el módulo de seguimiento de equipos con NFC?', quien: 'el Inspector', roles: ['inspeccion'],
    claves: 'nfc tag tags placa etiqueta equipo equipos activo activos seguimiento ficha historial apoyar celular acercar leer tarjeta piloto iphone android qr ntag',
    pasos: [
      'Cada equipo (vaciadora, termocontraíble, secador, flejadora, detector de metales, rayos X…) tiene una placa con un tag NFC y un código QR.',
      'Apoyás el celular en la placa (o tocás el equipo en la lista): se abre su ficha con el modelo 3D, la ubicación y las horas de uso.',
      'En Plan de mantenimiento ves cada tarea, su frecuencia (por horas, por días o por turno) y cuándo toca; desde ahí la programás o la marcás como realizada.',
      'En Historial ves preventivos, correctivos, controles por NFC y verificaciones de PCC desde el 1/10. SIMI te avisa lo que vence y pregunta, por ejemplo, si hay repuestos antes de programar.',
      'Registrás el control del día o cargás un hallazgo con el equipo ya elegido.',
      'Queda registrado quién pasó, cuándo y dónde.'
    ],
    nota: 'Está en preparación. Leer NFC desde la web funciona sólo en celulares Android con Chrome o Samsung Internet; en iPhone se usa el QR de la placa. En el módulo podés tocar «Probar lector NFC» para saber si tu celular sirve. Para el piloto hacen falta 10 a 20 equipos con código, tags NFC anti-metal aptos para frío y lavado (NTAG213/216, IP68) y definir qué se controla en cada equipo.',
    ir: { vista: 'nfc' }, rel: ['modulos', 'mod-iot']
  },
  {
    id: 'mod-iot', t: '¿Cómo funciona Monitoreo Industrial 5.0 (IoT + IA)?', quien: 'el Inspector', roles: ['inspeccion'],
    claves: 'iot monitoreo industrial 5.0 tiempo real sensores grafana camaras de frio tuneles temperatura energia electrica agua vapor presion caldera consumo alarma alerta aviso escalamiento whatsapp correo historico tendencia prediccion simi analiza',
    pasos: [
      'En vivo: cada cámara, túnel, la energía, el agua y el vapor con su valor, su rango y la última media hora.',
      'SIMI analiza: predice cuándo un equipo va a salir de rango, marca consumos fuera de lo habitual, busca la causa probable y sugiere mantenimiento con el histórico.',
      'Alarmas: saltan si el desvío se sostiene; los descongelamientos y las cargas de túnel no alarman. Se pueden reconocer o posponer 30 minutos.',
      'Avisos por niveles: técnico de turno al instante (app y WhatsApp), supervisor a los 10 minutos (WhatsApp y llamada) y jefe de planta y Calidad a los 20 (correo y WhatsApp). Reconocer corta el escalamiento.',
      'Histórico: cualquier día desde el lunes 9/11, cada 15 minutos, con resumen diario de energía, agua y vapor por cabeza y descarga en CSV.'
    ],
    nota: 'Los datos de los sensores se integran desde el Grafana de la planta con una cuenta de solo lectura y un túnel cifrado.',
    ir: { vista: 'iot' }, rel: ['modulos', 'mod-nfc']
  }
];
