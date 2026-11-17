/* =====================================================================
   SIMI · fichas de reparación (07-11-26)
   ---------------------------------------------------------------------
   Orientación general para las no conformidades de infraestructura más
   comunes en planta frigorífica. Se usan de dos formas:
     · Con señal: van como referencia a Llama, que arma la respuesta a la
       pregunta concreta («¿cómo reparo una gotera en el techo?»).
     · Sin señal: SIMI muestra la ficha tal cual.
   No reemplazan el procedimiento de la planta, los permisos de trabajo
   ni la ficha técnica del fabricante de cada material: lo dicen siempre.
   Claves en minúscula y sin acentos.
   ===================================================================== */
window.SIMA_REPARAR = [
  {
    id: 'techo', cat: 'techo', t: 'Gotera o filtración en el techo',
    claves: ['gotera', 'goteras', 'gotea', 'filtracion', 'filtra', 'techo', 'cielorraso', 'cielo raso', 'chapa', 'membrana', 'canaleta', 'llueve', 'lluvia', 'cae agua'],
    causas: ['Chapa o membrana perforada o corroída.', 'Tornillos flojos o sin arandela de sellado.', 'Canaletas o bajadas tapadas que desbordan.', 'Uniones y babetas despegadas. Ojo: si sólo gotea con frío y sin lluvia, puede ser condensación.'],
    pasos: ['Si cae agua en zona de producto: aislá el área, cubrí producto y equipos y avisá a Calidad.', 'Buscá la entrada desde arriba: el agua corre, el ingreso suele estar más arriba que la gota.', 'Limpiá canaletas y bajadas.', 'Cambiá tornillos dañados por autoperforantes con arandela de sellado y sellá uniones con sellador o membrana líquida para techos, sobre superficie limpia y seca.', 'Si la chapa está perforada, colocá un parche o reemplazá la chapa.', 'Por dentro, repará el cielorraso o panel afectado con terminación lisa y lavable.', 'Probá con agua o esperá la lluvia antes de cerrar; limpieza, sanitización y liberación de Calidad.'],
    cuidados: ['Trabajo en altura: permiso de trabajo, arnés y línea de vida; pisá sólo sobre las correas o pasarelas.', 'No trabajes con lluvia ni viento fuerte.', 'Que no caigan limaduras ni restos de sellador sobre la zona de proceso.'],
    prevenir: ['Revisar techos y canaletas antes de la temporada de lluvias.', 'Limpieza periódica de canaletas.', 'Si la gotera vuelve, registrarla como reincidencia y revisar la causa de fondo.']
  },
  {
    id: 'puerta', cat: 'puerta', t: 'Puerta que se desprende, se descuelga o no cierra',
    claves: ['puerta', 'puertas', 'porton', 'se desprende', 'desprende', 'descuelga', 'se cae', 'bisagra', 'bisagras', 'riel', 'carro', 'burlete', 'no cierra', 'cierra mal', 'manija', 'cerradura'],
    causas: ['Bisagras, rieles o carros gastados o flojos.', 'Golpes de zorras o autoelevadores.', 'Herraje chico para el peso de la puerta.', 'En cámaras: marco o burlete congelado que obliga a forzarla.'],
    pasos: ['Señalizá y asegurá la puerta si hay riesgo de caída; si es automática, bloqueo eléctrico (LOTO).', 'Revisá bisagras, rieles, carros, tornillos y el anclaje al marco o panel.', 'Cambiá los herrajes gastados por otros de la capacidad adecuada (inoxidable en zona húmeda) y usá traba o adhesivo fijador en los tornillos.', 'Si el anclaje está flojo en el panel, colocá una placa de refuerzo o anclaje químico; un tornillo más grande no alcanza.', 'Regulá la puerta para que cierre sola, sin forzar; revisá el burlete y, en cámaras, la resistencia del marco.', 'Si recibe golpes, colocá topes o defensas.', 'Probá varias aperturas, limpiá y pedí la liberación de Calidad.'],
    cuidados: ['Puertas pesadas: entre dos personas y calzadas.', 'En cámaras, ropa para frío y tiempos de exposición.', 'Lubricante apto para la industria alimentaria (grado H1) en zonas de proceso.'],
    prevenir: ['Lubricación y ajuste periódico de herrajes.', 'Defensas donde pasan equipos y capacitación para no forzar la puerta.', 'Si se repite en la misma puerta, revisar si el herraje es el adecuado.']
  },
  {
    id: 'pared', cat: 'pared', t: 'Fisura o daño en pared o panel',
    claves: ['pared', 'paredes', 'fisura', 'fisuras', 'grieta', 'grietas', 'panel', 'paneles', 'revoque', 'revestimiento', 'rajadura', 'muro', 'chapa del panel'],
    causas: ['Golpes de equipos o carros.', 'Humedad o agua a presión del lavado.', 'Juntas de paneles abiertas.', 'Movimiento de la estructura.'],
    pasos: ['Evaluá si es superficial o puede ser estructural: si la fisura crece o atraviesa el muro, pedí evaluación de un profesional.', 'Trabajá sin producto expuesto; protegé equipos cercanos.', 'Limpiá, abrí levemente la fisura y retirá lo suelto.', 'Rellená con masilla o mortero de reparación apto para superficies lavables.', 'En paneles: sellá juntas y reponé chapa o esquineros dañados.', 'Terminá liso y lavable (pintura apta para la industria alimentaria) y respetá el curado antes de lavar.', 'Limpieza, sanitización y liberación de Calidad.'],
    cuidados: ['Polvo de lijado y solventes: ventilación y sin producto en la zona.', 'Seguí la ficha técnica de cada material (tiempos de curado).'],
    prevenir: ['Guardacantos y defensas donde pasan equipos.', 'Controlar la presión del lavado sobre juntas.']
  },
  {
    id: 'piso', cat: 'piso', t: 'Piso fisurado, roto o con agua estancada',
    claves: ['piso', 'pisos', 'baldosa', 'baldosas', 'contrapiso', 'bache', 'pozo', 'charco', 'agua estancada', 'desague', 'rejilla', 'junta del piso'],
    causas: ['Impactos y cargas de equipos.', 'Choque térmico por agua caliente de limpieza.', 'Químicos de limpieza que atacan el material.', 'Juntas deterioradas o pendiente mal hecha hacia el desagüe.'],
    pasos: ['Aislá y señalizá el área; sin producción en el sector durante la reparación y el curado.', 'Retirá el material suelto hasta base firme y limpiá.', 'Repará con mortero o resina para pisos industriales alimentarios (para choque térmico, sistemas tipo poliuretano-cemento), según la ficha del fabricante.', 'Rehacé las juntas con sellador apropiado.', 'Si se junta agua, corregí la pendiente hacia el desagüe.', 'Respetá el curado antes de habilitar tránsito y lavado; limpieza y liberación de Calidad.'],
    cuidados: ['Resinas y solventes: guantes, protección ocular y ventilación.', 'Terminación sin bordes ni poros donde se acumule suciedad.'],
    prevenir: ['Ruedas adecuadas en carros y zorras.', 'Evitar volcar agua muy caliente directamente sobre el piso.', 'Mantener juntas y desagües.']
  },
  {
    id: 'silicona', cat: 'silicona', t: 'Silicona o sellado desprendido',
    claves: ['silicona', 'siliconas', 'sellador', 'sellado', 'sellante', 'junta', 'juntas'],
    causas: ['Se aplicó sobre superficie sucia, húmeda o con silicona vieja.', 'Producto no apto para la temperatura o los químicos de limpieza.', 'Junta con movimiento o golpes.', 'Lavado a presión directo sobre la junta.'],
    pasos: ['Retirá TODA la silicona vieja: no se aplica encima.', 'Limpiá, desengrasá y dejá secar bien la junta.', 'Aplicá sellador sanitario apto para la industria alimentaria (con antihongos en zona húmeda).', 'Cordón continuo y alisado, sin huecos.', 'Respetá el curado del fabricante antes de lavar; limpieza y liberación de Calidad.'],
    cuidados: ['Que no queden restos de silicona en la zona de proceso.', 'Solventes con ventilación.'],
    prevenir: ['Elegir el sellador según temperatura y químicos.', 'Revisar las juntas en las inspecciones; si se desprende seguido en el mismo punto, buscar el movimiento o golpe que la arranca.']
  },
  {
    id: 'luminaria', cat: 'luminaria', t: 'Luminaria sin tapa, rota o apagada',
    claves: ['luminaria', 'luminarias', 'luz', 'luces', 'lampara', 'foco', 'tubo', 'artefacto', 'difusor', 'tapa estanca', 'sin tapa'],
    causas: ['Difusor o tapa rota o faltante.', 'Burlete de estanqueidad dañado: entra agua.', 'Equipo o driver quemado.'],
    pasos: ['Trabajo eléctrico: sólo electricista habilitado, con corte y bloqueo (LOTO).', 'Si hay vidrio o acrílico roto en zona de producto, aplicá el procedimiento de vidrios y plásticos quebradizos y avisá a Calidad.', 'Reemplazá por luminaria estanca con difusor irrompible, apta para lavado.', 'Revisá burlete y cierres de la tapa.', 'Probá el encendido y registrá el cambio.'],
    cuidados: ['Riesgo eléctrico y trabajo en altura.', 'Contá las piezas del difusor roto: no deben quedar fragmentos.'],
    prevenir: ['Luminarias estancas protegidas contra impactos.', 'Revisión de burletes y tapas en las inspecciones.']
  },
  {
    id: 'electrico', cat: 'tomacorriente', alt: ['conexion'], t: 'Tomacorriente o conexión eléctrica dañada',
    claves: ['tomacorriente', 'tomacorrientes', 'enchufe', 'toma', 'conexion', 'cable', 'cables', 'empalme', 'tablero', 'chispa', 'corto', 'electrico'],
    causas: ['Tomas sin tapa o no aptos para zona húmeda.', 'Agua de lavado directa.', 'Golpes o cables tironeados.'],
    pasos: ['Sólo electricista habilitado. Corte de energía y bloqueo (LOTO) antes de tocar nada.', 'Reemplazá por toma o caja estanca, con tapa, apta para lavado.', 'Cables con prensacables y canalizados; sin empalmes expuestos.', 'Verificá la protección diferencial y probá antes de habilitar.'],
    cuidados: ['Nunca trabajar con tensión ni con el piso mojado.', 'Si hubo chispa o calentamiento, revisar el circuito completo.'],
    prevenir: ['No lavar con chorro directo sobre tomas y tableros.', 'Tomas con tapa en todas las zonas húmedas.']
  },
  {
    id: 'lavamanos', cat: 'lavamanos', t: 'Lavamanos que pierde o no funciona',
    claves: ['lavamanos', 'pileta', 'canilla', 'grifo', 'pedal', 'sensor', 'agua caliente', 'sifon', 'perdida de agua'],
    causas: ['Accionamiento (pedal, rodilla o sensor) gastado.', 'Juntas o conexiones con pérdida.', 'Desagüe tapado.', 'Sin agua caliente.'],
    pasos: ['Avisá a Calidad: el lavamanos es clave para las BPM; si queda fuera de servicio, habilitá uno alternativo.', 'Cerrá la llave de paso.', 'Cambiá accionamiento o juntas y destapá el sifón.', 'Verificá agua caliente, jabón y secado de manos.', 'Probá, limpiá y sanitizá.'],
    cuidados: ['Que el sector no quede sin lavado de manos durante la reparación.'],
    prevenir: ['Revisarlo en la inspección preoperacional diaria.']
  },
  {
    id: 'esterilizador', cat: 'esterilizador', t: 'Esterilizador de cuchillos sin temperatura',
    claves: ['esterilizador', 'esterilizadores', 'temperatura del esterilizador', 'no calienta', 'resistencia', 'termostato'],
    causas: ['Resistencia o termostato dañados.', 'Bajo nivel de agua o válvula trabada.', 'Sarro acumulado.'],
    pasos: ['Avisá a Calidad: afecta la inocuidad. Habilitá uno de reemplazo.', 'Corte y bloqueo eléctrico (LOTO).', 'Revisá resistencia, termostato, nivel y válvula.', 'Descalcificá si hay sarro.', 'Verificá con termómetro calibrado que llegue a la temperatura del procedimiento de la planta (habitualmente 82 °C o más) y registralo.'],
    cuidados: ['Riesgo eléctrico y de quemaduras.'],
    prevenir: ['Descalcificación periódica.', 'Control de temperatura en la preoperacional.']
  },
  {
    id: 'soldadura', cat: 'soldadura', t: 'Soldadura fisurada o rota',
    claves: ['soldadura', 'soldaduras', 'soldar', 'soldado', 'fisura en la soldadura'],
    causas: ['Vibración o sobrecarga.', 'Soldadura mal ejecutada o material incompatible.', 'Corrosión.'],
    pasos: ['Evaluá si es una pieza estructural o de soporte: si lo es, pedí evaluación de un profesional.', 'Sin producto y con permiso de trabajo en caliente (extintor y vigía).', 'Amolá y limpiá la zona.', 'Soldador calificado, con material compatible (inoxidable con inoxidable).', 'En superficies de contacto con producto: pulido y pasivado.', 'Retirá virutas y limpiá antes de liberar.'],
    cuidados: ['Chispas, humos y proyección de partículas.', 'No dejar virutas en la zona de proceso.'],
    prevenir: ['Revisar vibraciones y sobrecargas del equipo.']
  },
  {
    id: 'zocalo', cat: 'zocalo', t: 'Zócalo sanitario roto o despegado',
    claves: ['zocalo', 'zocalos', 'zocalo sanitario', 'media cana', 'curva sanitaria'],
    causas: ['Golpes de equipos y carros.', 'Agua de lavado que entra por la unión con la pared.'],
    pasos: ['Retirá la parte suelta y limpiá.', 'Reconstruí con mortero o resina apta, respetando la media caña sanitaria.', 'Sellá la unión con la pared.', 'Respetá el curado; limpieza y liberación de Calidad.'],
    cuidados: ['Sin producto en la zona durante el trabajo.'],
    prevenir: ['Defensas o topes donde golpean los carros.']
  },
  {
    id: 'hermeticidad', cat: 'hermeticidad', t: 'Cámara que pierde frío (hermeticidad)',
    claves: ['hermeticidad', 'hermetico', 'entra aire', 'pierde frio', 'perdida de frio', 'hielo', 'escarcha', 'condensacion', 'pasamuro'],
    causas: ['Burletes dañados.', 'Puerta desregulada o que queda abierta.', 'Juntas de paneles o pasamuros sin sellar.', 'Resistencia de marco apagada.'],
    pasos: ['Ubicá el ingreso de aire: el hielo o la condensación marcan el punto.', 'Reemplazá el burlete dañado.', 'Regulá la puerta para que cierre sola.', 'Sellá juntas y pasamuros con producto apto para baja temperatura y terminación lavable.', 'Verificá la resistencia del marco y la cortina de tiras.', 'Controlá la temperatura de la cámara después del arreglo.'],
    cuidados: ['Trabajo en frío: ropa adecuada y tiempos de exposición.'],
    prevenir: ['Revisión periódica de burletes.', 'No dejar puertas abiertas.']
  },
  /* Fichas por SÍNTOMA (11-11-26): el síntoma manda sobre el objeto.
     «¿cómo resuelvo la oxidación de una puerta?» es óxido, no una puerta
     que se descuelga. Con «sintoma: true» ganan a las fichas del objeto. */
  {
    id: 'oxidacion', cat: 'otro', alt: ['puerta', 'soldadura'], sintoma: true, t: 'Óxido o corrosión en puertas, marcos, estructuras o equipos',
    claves: ['oxido', 'oxidos', 'oxidacion', 'oxidado', 'oxidada', 'oxidados', 'oxidadas', 'se oxida', 'corrosion', 'corroido', 'corroida', 'herrumbre', 'picado', 'picadura', 'manchas de oxido'],
    causas: ['Humedad y condensación permanentes (cámaras, lavado diario).', 'Químicos de limpieza agresivos (cloro, ácidos) o mal enjuagados sobre acero al carbono.', 'Pintura o galvanizado dañado por golpes que deja el metal expuesto.', 'Material inadecuado: acero común donde hace falta inoxidable, o tornillería que no es inoxidable.'],
    pasos: ['Si el óxido está en contacto o sobre el producto: aislá la zona, protegé el producto y avisá a Calidad (riesgo de cuerpo extraño).', 'Evaluá el daño: si es superficial, se trata; si el metal está perforado o perdió espesor en una parte que sostiene peso (bisagra, marco, riel), se reemplaza la pieza.', 'Quitá el óxido hasta metal sano con cepillo, lija o disco, sin dejar restos en la zona de proceso.', 'Limpiá y desengrasá; aplicá convertidor de óxido o primer anticorrosivo apto para la industria alimentaria.', 'Terminá con pintura epoxi sanitaria o de poliuretano apta alimentaria, en las capas que indica el fabricante; si es acero inoxidable, pasivalo en lugar de pintarlo.', 'Cambiá tornillos y herrajes oxidados por inoxidables.', 'Respetá el secado, limpiá y pedí la liberación de Calidad antes de volver a producir.'],
    cuidados: ['Lijado y amolado: protección ocular y respiratoria; nada de chispas ni polvo cerca del producto.', 'Productos químicos con su hoja de seguridad y ventilación.', 'Si la pieza sostiene una puerta pesada, asegurala antes de trabajar.'],
    prevenir: ['Enjuagar bien los químicos de limpieza y usar los compatibles con el material.', 'Reparar la pintura apenas aparece un golpe.', 'En zonas húmedas, especificar acero inoxidable y tornillería inoxidable.', 'Si el óxido vuelve al mismo punto, revisar la condensación o el químico que lo provoca.']
  },
  {
    id: 'moho', cat: 'pared', alt: ['techo'], sintoma: true, t: 'Moho, hongos o manchas de humedad en paredes y techos',
    claves: ['moho', 'hongo', 'hongos', 'mancha negra', 'manchas negras', 'humedad', 'humeda', 'mancha de humedad', 'verdin', 'condensa', 'transpira'],
    causas: ['Condensación por mala ventilación o puentes térmicos.', 'Filtración de agua desde el techo, cañerías o la pared vecina.', 'Superficies porosas o pintura no lavable que retienen suciedad.'],
    pasos: ['Encontrá y cortá el origen del agua (filtración, cañería, condensación).', 'Limpiá la zona con detergente y desinfectante aprobado en la planta.', 'Dejá secar por completo.', 'Repará la superficie y pintá con pintura antifúngica lavable apta para la industria alimentaria.', 'Mejorá la ventilación o la aislación si es condensación.', 'Limpieza final y liberación de Calidad.'],
    cuidados: ['Protección respiratoria al limpiar moho.', 'Proteger el producto durante la limpieza y la pintura.'],
    prevenir: ['Ventilación y extracción funcionando.', 'Revisar seguido los puntos donde condensa.']
  },
  {
    id: 'desague', cat: 'piso', sintoma: true, t: 'Desagüe o rejilla tapada, agua que no escurre',
    claves: ['desague', 'desagues', 'rejilla', 'rejillas', 'rejilla tapada', 'tapado', 'tapada', 'no escurre', 'no drena', 'agua estancada', 'charco', 'olor', 'mal olor', 'rebalsa'],
    causas: ['Restos de grasa, sólidos o carne en el sifón o la cañería.', 'Rejilla sin canasto retenedor.', 'Pendiente del piso mal hecha hacia el desagüe.'],
    pasos: ['Señalizá el piso mojado y retirá el agua acumulada.', 'Sacá la rejilla y el canasto y retirá los sólidos.', 'Destapá el sifón y la cañería con herramienta o equipo de agua a presión.', 'Tirá agua con caudal para confirmar que drena bien.', 'Si el agua igual se junta, revisá la pendiente del piso: es un hallazgo aparte.', 'Limpiá, sanitizá y volvé a colocar la rejilla bien asentada.'],
    cuidados: ['Guantes y protección ocular: el agua puede tener químicos o restos orgánicos.', 'Piso resbaladizo: cono y botas antideslizantes.'],
    prevenir: ['Limpieza diaria de canastos y rejillas.', 'No barrer sólidos hacia el desagüe.']
  },
];
