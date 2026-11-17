# SIMA en tres módulos (11-11-26)

| # | Módulo | Estado | Pantalla |
|---|---|---|---|
| 1 | Ruta de inspección | En uso | `inicio` y el resto de la app |
| 2 | Seguimiento de equipos (NFC) | Con datos de demostración; lectura NFC real en Android | `nfc` |
| 3 | Monitoreo en tiempo real (IoT, datos de Grafana) | En preparación | `iot` |

## Cómo funciona hoy
- **Sólo el Inspector** elige módulo. Los demás roles entran directo a la Ruta.
- Después del login aparece la pantalla de módulos (`#modScreen`, en `public/sima-modulos.js`) con las tres tarjetas en orden. Marca el último módulo usado.
- El módulo elegido se guarda **por pestaña** (`sessionStorage sima.modulo`): recargar no vuelve a preguntar; un login nuevo o una pestaña nueva, sí.
- Cambiar de módulo: la píldora «Módulo N» al lado del logo, o «Módulos» en el menú de los módulos 2 y 3.
- El logo lleva al inicio del módulo actual. Ir a una pantalla de otro módulo (por ejemplo «Llevame ahí» de SIMI) cambia de módulo solo.
- Estado y navegación: `modulo`, `elegirModulo()`, `abrirSelector()`, `navFor()` en `index.html`.

## SIMI en cada módulo
- **Chat:** saludo y sugerencias propios de cada módulo; envía `modulo` a `/api/ia/chat` y el prompt sabe qué módulo es y que 2 y 3 están en preparación.
- **Nunca inventa lecturas:** preguntas como «¿qué temperatura tiene la cámara 3?» se responden diciendo que todavía no hay sensores conectados (en el cliente, sin IA, y también regla en el prompt).
- **Barra de sección y onboarding** propios para `nfc` e `iot` (`sima-companero.js`).
- **Guía:** artículos `modulos`, `mod-nfc` y `mod-iot` en `sima-ayuda.js` (sirven sin señal).
- El recorrido guiado de primera vez sólo corre en la Ruta.

## Viabilidad

### Módulo 2 · NFC — viable, esfuerzo medio
- **Web NFC** (`NDEFReader`) sólo funciona en **Android con Chrome / Samsung Internet**, con HTTPS y un toque del usuario. No funciona en iPhone ni en PC.
- iPhone: la placa lleva además un **QR** y un registro NFC con URL (`https://<sima>/t/<idTag>`), que iOS abre solo en segundo plano.
- Ya disponible: botón «Probar lector NFC» que lee el número de serie y el contenido de un tag real → sirve para relevar qué celulares sirven.
- Falta: tablas `equipos`, `tags`, `marcas` en D1; ficha del equipo; control del día; tags anti-metal NTAG213/216 IP68 (NTAG 424 DNA en puntos críticos, antifraude).
- Funciona sin señal: la lectura es local y la marca se encola como el resto de SIMA.

### Módulo 3 · IoT con Grafana — viable, depende de Sistemas
- Grafana es la capa de visualización; los datos están en su base (InfluxDB, Prometheus, SQL…). SIMA los pide **a través de Grafana** con su API (`POST /api/ds/query`, Grafana 8+) usando una **cuenta de servicio de solo lectura** (rol Viewer).
- El Grafana está en la red de planta: Cloudflare no lo ve. Se publica con **Cloudflare Tunnel + Access (service token)**, sin abrir puertos. SIMA ya usa ese patrón para Ollama (`CF_ACCESS_CLIENT_ID/SECRET`).
- Refresco: la Pages Function consulta cada 30–60 s y guarda en caché compartida, así 1 consulta sirve a todos los usuarios. Con 10 inspectores 8 h/día son ~10.000 pedidos/día: dentro del plan gratis de Workers (100.000/día).
- Alarmas: mejor que SIMA no dependa del refresco del navegador. Opción recomendada: **alertas de Grafana → webhook a SIMA** (`/api/iot/alerta`) + Cron Trigger cada 5 min para sensores mudos; SIMA avisa por push y crea NC si la excursión es larga.
- SIMI lee valores **calculados por el servidor** (como hoy con los hallazgos): la IA explica, nunca inventa cifras.
- **No recomendado:** incrustar paneles de Grafana con iframe o dashboards públicos (expone datos, requiere anónimo o cookies de terceros).
- Pedido a Sistemas: URL y versión de Grafana, tipo de datasource, UIDs de tableros/paneles y sus consultas, cuenta de servicio Viewer, permiso para el túnel, rangos por cámara y a quién avisar.

### Riesgos
- Seguridad: la aprobación de Sistemas para el túnel es el paso crítico.
- NFC en iPhone limitado (se cubre con QR).
- Push en iPhone sólo con iOS 16.4+ y SIMA instalada en la pantalla de inicio.

## Módulo 3 · Monitoreo Industrial 5.0 (IoT + IA) — 12-11-26
`public/sima-iot.js`. Nombre visible: «Monitoreo Industrial 5.0» con «IoT + IA» en gris. En la pantalla de módulos ya no se muestra «Disponible / En preparación».

### Dos estados
- **Sin fuente de datos** (por defecto): «Conexión con Grafana pendiente», qué pedirle a Sistemas y el botón «Ver con datos de demostración».
- **Datos de demostración** (por dispositivo, `localStorage sima.iot.demo`): pantalla limpia para presentaciones, sin rótulos. Se desactiva en el menú «···» › «Desactivar datos de demostración». Así ningún inspector ve valores de demostración como si fueran de planta sin haberlo activado.
- Los valores salen de un **modelo determinístico de planta** (mismo resultado en cualquier equipo): turnos de producción, limpieza 22–24 h, domingos sin faena, descongelamientos 4 veces por día, cargas diarias de túnel, desvíos del histórico generados por día y los que se prueban en vivo. Al conectar Grafana sólo se reemplaza `valor(sensor, t)`.

### Equipos y rangos de referencia (ajustables)
| Equipo | Advertencia | Alarma |
|---|---|---|
| Cámaras 1–4 (enfriado) | fuera de 0 a 4 °C | fuera de −2 a 6 °C |
| Cámaras 5–6 (congelado) | arriba de −18 °C | arriba de −15 °C |
| Túneles 1–2 | arriba de −28 °C (fuera de la bajada post carga) | arriba de −24 °C |
| Demanda eléctrica | > 1.100 kW | > 1.200 kW (contratado) |
| Agua | > 60 m³/h | > 70 m³/h |
| Caudal de vapor (caldera 8 t/h) | > 6,5 t/h | > 7,5 t/h |
| Presión de vapor (colector) | fuera de 8 a 10,3 bar | < 7,2 o > 10,8 bar |

Vapor: los esterilizadores necesitan agua a 82 °C; con el colector por debajo de ~7 bar puede no alcanzarse. Los rangos son de referencia y deben ajustarse con los datos de la caldera y los procedimientos de la planta.

### Histórico
Desde el **lunes 9/11/26** (el 10/11 fue martes): gráfico cada 15 min por equipo y día con rango y desvíos marcados, mín./prom./máx., minutos fuera de rango, alarmas; resumen diario (cabezas, kWh, m³, t de vapor, por cabeza, cadena de frío %, alarmas) y CSV.

### Gestión de alarmas (ISA-18.2 / IEC 62682 / EEMUA 191)
- Una alarma tiene que exigir una **acción del operador**; lo demás es información. Dos prioridades (advertencia, alarma) + «sin datos».
- **Retardo de activación** (3 lecturas) y **cierre con histéresis** (2 lecturas en rango) para evitar alarmas que parpadean.
- **Supresión por estado**: descongelamiento y bajada post carga del túnel no alarman.
- **Shelving**: posponer 30 min, con registro.
- **Escalamiento** que se corta al reconocer: nivel 1 técnico de turno al instante (app + WhatsApp), nivel 2 supervisor a los 10 min (WhatsApp + llamada), nivel 3 jefe de planta y Calidad a los 20 min (correo + WhatsApp, sólo alarmas).
- **KPIs** a la vista: alarmas por día, tiempo medio de reconocimiento, % reconocidas en ≤ 5 min (meta > 95 %), equipos con más alarmas («malos actores»). Referencia: más de 10 alarmas en 10 min es una «inundación».

### Canales para avisar a más personas (para implementar)
| Canal | Uso | Cómo | Costo |
|---|---|---|---|
| Push de la PWA | Nivel 1, a quien tiene SIMA | Web Push con claves VAPID desde la Pages Function | Gratis (iPhone: iOS 16.4+ con SIMA instalada) |
| WhatsApp | Niveles 1–3 | WhatsApp Business Cloud API con plantilla «utility» aprobada | Por mensaje: utilidad ~US$ 0,011 en Paraguay (verificar en Meta) |
| Correo | Nivel 3 y resumen diario | Proveedor de correo transaccional desde la Function | Bajo / plan gratis |
| Llamada o SMS | Nivel 2 de alarmas críticas fuera de horario | Twilio u otro proveedor de voz | Por llamada |
| Telegram | Alternativa gratuita a WhatsApp | Bot de Telegram | Gratis |
Todos se disparan desde el servidor (no dependen de que alguien tenga la app abierta); Grafana también puede enviar sus alertas a un webhook de SIMA.

### SIMI en Industria 5.0 (humano + IA + sostenibilidad)
- **Predicción**: tiempo hasta salir de rango por tendencia; avisa antes de la alarma.
- **Fuera de lo habitual**: compara con la misma hora de los 3 días anteriores (aunque esté en rango).
- **Causa probable por correlación**: varias cámaras del mismo circuito suben juntas → compresor; presión de vapor cae con caudal alto → purgas/trampas; puerta abierta.
- **Mantenimiento predictivo**: tiempo de bajada del túnel después de la carga contra el histórico → «Crear trabajo» abre la carga en la Ruta con la descripción.
- **Eficiencia**: kWh, L de agua y kg de vapor por cabeza contra el promedio.
- **Resumen del turno**, consultas del histórico por día («¿cuánta energía consumimos el lunes?»), alarmas y lecturas en el chat sin IA; la IA recibe las lecturas del momento para preguntas abiertas y no puede inventar otras.
- **Humano en el circuito**: «Útil / No aplica» ajusta la sensibilidad de cada tipo de observación; lectura de alarmas en voz alta (opcional).

### SIMI en la pantalla de módulos (12-11-26)
Globo bajo el saludo que rota cada ~6,5 s (pausa con el mouse o el foco encima, botón «siguiente»): cuenta en qué ayuda cada módulo, con datos reales cuando hay (hallazgos abiertos de la planta, alarmas activas del módulo 3 —si hay alarma, ese mensaje va primero—), resalta la tarjeta del módulo del que habla y ofrece «Ir a …». El saludo muestra el nombre con mayúscula inicial aunque el usuario esté cargado en MAYÚSCULAS.

## Módulo 2 · Seguimiento de equipos (NFC) — 12-11-26

### Interruptor de demostración compartido
- `window.SIMA_DEMO.on()` / `SIMA_DEMO.set(v)` (en `sima-modulos.js`), clave `sima.demo` (lee también la vieja `sima.iot.demo`). Dispara `sima:demo`.
- Activa los módulos 2 y 3 a la vez, por dispositivo. Se apaga desde el menú «···» de cualquiera de los dos.
- Sin demo, el módulo 2 muestra la pantalla original (probar lector NFC) más el botón «Ver con datos de demostración».

### Equipos (`public/sima-nfc.js`)
| Código | Equipo | Ubicación | Plan |
|---|---|---|---|
| VAC-01 | Vaciadora (doble campana) | Envasado · Línea 1 | filtro de escape cada 500 h (**sáb 14/11**), aceite cada 1.000 h, teflón semanal, juntas mensual |
| TER-01 | Termocontraíble (inmersión) | Envasado · Línea 1 | boquillas semanal, descalcificación mensual, resistencias cada 1.000 h |
| SEC-01 | Secador de termocontraíble | Envasado · Línea 1 | filtro de aire semanal, rodamientos cada 500 h, correa cada 2.000 h |
| FLE-01 | Flejadora («Feljadora» en el pedido) | Expedición | cabezal semanal, tensores quincenal, cuchilla cada 800 h |
| DM-01 | Detector de metales · PCC | Salida de la vaciadora | verificación con patrones 07:00 y 15:00, validación semestral |
| RX-01 | Rayos X · PCC | Antes del paletizado | verificación 07:00 y 15:00, cortinas mensual, calibración anual (24/11) |

- Horómetro determinístico desde el 1/10 (15 h lun–vie, 8 h sáb). Histórico: preventivos (con algunos atrasos), correctivos fijos (junta de campana 08/10, resistencia 15/10, 3 atascos de la flejadora, falla de verificación Inox 19/10, cortina de plomo 30/10…), controles diarios por NFC y verificaciones de PCC.
- KPIs por equipo: disponibilidad, MTBF, MTTR, cumplimiento del plan, verificaciones o correctivos.
- Lo que hace el usuario (programar, realizado, control del día, verificación, lectura de placa, pedido de repuesto) queda en `localStorage 'sima.nfc.estado'`.

### SIMI
- Panel «SIMI · plan de mantenimiento» + aviso al entrar (uno por sesión y alerta).
- Filtro de la vaciadora: «¿Ya tenemos filtros en stock?» → **Sí** programa el 14/11 y confirma en el chat; **No** anota el pedido (FIL-VAC-500 ×2, 3–5 días) y propone nueva fecha + control de vacío por turno.
- Patrón de 3 atascos de la flejadora → programar inspección del cabezal. Calibración anual de rayos X. Verificaciones de PCC pendientes del turno.
- Chat (`SIMA_NFC.responder`, sin IA): qué vence esta semana, alertas, estado / plan / historial de cada equipo, «sí/no hay filtros». Sugerencias propias del módulo.

### 3D (`public/sima-equipos3d.js`)
- three.js 0.170 local en `public/vendor/` (licencia MIT incluida). Modelos procedurales (sin marcas) de los 6 equipos.
- Lista: miniaturas renderizadas una vez y cacheadas. Detalle: visor que se gira arrastrando y rota solo despacio (sin rotación con «reducir movimiento»).
- Se carga con `import()` sólo al abrir el módulo, para no pesar en la Ruta.

### Lectura NFC
- Android + Chrome: «Leer placa NFC» (`NDEFReader`) → abre el equipo y registra el paso. Placa desconocida → se asigna a un equipo.
- En PC/iPhone: el menú «···» permite abrir un equipo como si se leyera su placa (para la presentación).
