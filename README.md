# SIMA RA · Ruta de inspección con realidad aumentada

Versión de SIMA donde el **Módulo 1 (Ruta de inspección)** marca cada no
conformidad con **realidad aumentada** y la deja guardada **con su ubicación**
(GPS + distancia y rumbo desde el Inspector). Detalle en
[`docs/REALIDAD_AUMENTADA.md`](docs/REALIDAD_AUMENTADA.md).

Es un proyecto **separado** de SIMA: sitio de Pages `sima-ra`, base D1
`sima-ra-db`, bucket R2 `sima-ra-fotos`. En los pasos de abajo, donde dice
`sima`, `sima-db` o `sima-fotos`, usá esos nombres (los scripts de
`package.json` ya están ajustados).

---

# SIMA en Cloudflare

Sistema de Gestión de Ruta de Inspección, Mantenimiento y Calidad.
App web instalable (PWA) + API + base de datos + almacenamiento de fotos,
todo dentro del plan gratuito de Cloudflare.

```
public/index.html      la aplicación (funciona sola, sin servidor)
public/sima-sync.js    capa de sincronización offline-first
public/sw.js           Service Worker: app y fotos disponibles sin señal
public/sima-excel.js   exportación a Excel de seguimiento (se carga al exportar)
public/sima-bot.js     SIMI, la mascota asistente (botón flotante + panel)
public/vendor/         ExcelJS, JSZip y ECharts locales (funcionan sin CDN)
functions/api/[[path]].js   la API (Pages Functions) + login propio
scripts/crear-usuario.mjs   bootstrap: crea/actualiza un usuario directo en D1
schema.sql             tablas e índices de la base (incluye tabla usuarios)
semilla.sql            estructura de planta inicial (opcional)
wrangler.toml          enlaces a la base, al bucket, a Workers AI y variables
docs/ASISTENTE_IA.md   asistente de IA: flujo, configuración, costo y medición
```

**Asistente de IA (06-11-26):** al cargar un hallazgo, Llama 4 (Workers AI)
sugiere tipo, disciplina y descripción desde la foto, y Whisper transcribe el
dictado. La IA sugiere y el Inspector decide; si no hay señal o cupo, se
carga igual que siempre. Detalle y diagrama de flujo en
[`docs/ASISTENTE_IA.md`](docs/ASISTENTE_IA.md).

**Proveedores gratuitos y nueva carga de hallazgo (07-11-26):** con la clave
gratuita de Groq (`GROQ_API_KEY`, sin tarjeta) Llama 4 y Whisper corren en Groq,
y Workers AI queda como respaldo automático si se agota el cupo. Hugging Face
es opcional (`HF_TOKEN`; requiere créditos). La carga de hallazgo se rediseñó en
4 pasos (Foto · Contá qué encontraste · Ubicación · Tipo); al dictar, la IA
propone tipo, disciplina y **sector**. Ver
[`docs/SIMI_Y_DICTADO_UX.md`](docs/SIMI_Y_DICTADO_UX.md).

**Portada y SIMI con vida (07-11-26):** la pantalla de inicio pasó a ser una
portada con SIMI interactivo. En la app, SIMI respira, sigue el cursor, festeja
cada cierre y avisa de trabajos muy atrasados y de no conformidades que se
repiten. También responde «¿cómo se repara…?» con fichas de reparación.

**Inicio y recorrido guiado (09-11-26):** todos los roles entran a «Inicio»,
con su acción principal (la Ruta de inspección), las secciones explicadas y el
circuito de una no conformidad. En el primer ingreso, SIMI muestra paso a paso
cómo moverse por SIMA (`public/sima-tour.js`).
En Inicio, lo principal es el botón de la Ruta de inspección, con SIMI trabajando al lado
(levantamiento, eléctrica, pintura, escalera con arnés y control de calidad) y dejando
consejos de levantamiento, seguridad y calidad (`public/sima-escenas.js`).

**SIMI y dictado (06-11-26):** SIMI es la mascota asistente de SIMA, en un
botón flotante en todas las pantallas (Ctrl + / en PC). Saluda con un resumen
según el rol y responde cantidades, rankings por área/tipo/sector/disciplina,
reparto por estado y los más antiguos, con acciones para profundizar o ver la
lista filtrada. Las cifras las calcula la app; Llama sólo interpreta preguntas
difíciles. El dictado ahora es un botón «Dictar» grande dentro del campo, con
tiempo, nivel de voz, Cancelar y Listo. Detalle en
[`docs/SIMI_Y_DICTADO_UX.md`](docs/SIMI_Y_DICTADO_UX.md).

**Exportar Excel (06-11-26):** en Inspección → Rutas cerradas, cada ruta
tiene «Exportar Excel» y arriba está «Exportar Excel · todas las rutas».
La planilla trae la hoja *Levantamientos* (un renglón por hallazgo, con
estado, fechas del ciclo, responsables y orden SAP, sin fotos; filtros,
colores por estado, lista desplegable y columna libre de seguimiento) y la
hoja *Dashboard* (indicadores, tablas y gráficos nativos de Excel). Todo el
Dashboard son fórmulas sobre *Levantamientos*: si se actualiza un estado,
se recalcula.

---

## Puesta en producción

Todo esto se hace una sola vez. Necesitás Node.js 20 o superior.

### 1. Cuenta y herramientas

Creá una cuenta gratuita en https://dash.cloudflare.com (no pide tarjeta).

```bash
cd sima-cf
npm install
npx wrangler login        # abre el navegador para autorizar
```

### 2. Crear la base de datos

```bash
npx wrangler d1 create sima-db
```

Devuelve un bloque con `database_id`. **Copiá ese identificador y pegalo
en `wrangler.toml`**, reemplazando `PEGAR-AQUI-EL-DATABASE-ID`.

### 3. Crear las tablas

```bash
npm run db:migrar
```

Opcional, para arrancar con la ruta de planta ya cargada en el servidor:

```bash
npm run db:semilla
```

### 4. Crear el almacenamiento de fotos

```bash
npm run r2:crear
```

### 5. Probar en tu máquina antes de publicar

```bash
npm run db:migrar:local
npm run dev
```

Abrí http://localhost:8788. Arriba a la derecha aparece un indicador:
**SINCRONIZADO** (verde) significa que la app está hablando con la base.

### 6. Publicar

```bash
npm run deploy
```

La primera vez pregunta el nombre del proyecto (poné `sima`). Al terminar
te da una URL `https://sima.pages.dev` con HTTPS. Para actualizar,
volvés a correr `npm run deploy`.

Si preferís que se publique solo con cada `git push`, en el panel de
Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**.
Build command: dejalo vacío. Output directory: `public`.

### 7. Conectar la base al sitio publicado

Los enlaces de `wrangler.toml` valen para desarrollo. Para producción,
en el panel: **tu proyecto → Settings → Bindings**, y agregás:

| Tipo | Nombre de variable | Recurso |
|---|---|---|
| D1 database | `DB` | sima-db |
| R2 bucket | `FOTOS` | sima-fotos |

### 8. Configurar el secreto de sesión

SIMA tiene su propio login (correo + contraseña): no depende de
Cloudflare Access ni de ningún proveedor externo. Las sesiones son
cookies firmadas con HMAC-SHA256, y la firma necesita un secreto.

En producción se carga así (una sola vez):

```bash
npx wrangler secret put SESSION_SECRET
```

Te va a pedir un valor: pegá cualquier texto largo y aleatorio, por
ejemplo el que genera:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

**Guardalo en un lugar seguro** (gestor de contraseñas). Si lo perdés o
lo cambiás, todas las sesiones activas se cierran (no pasa nada, la
gente vuelve a iniciar sesión) — lo único importante es no perderlo
para siempre sin tener otro configurado.

Para desarrollo local, copiá `.dev.vars.ejemplo` como `.dev.vars` y
poné ahí tu propio valor (ese archivo está en `.gitignore`, nunca se
sube al repositorio).

### 9. Crear el primer usuario administrador

Sin usuarios, nadie puede entrar — ni siquiera vos. El panel de
Configuración → Usuarios (donde después se agregan los demás) sólo lo
puede abrir alguien que **ya** inició sesión como Inspección/Admin, así
que el primero se crea por línea de comandos:

```bash
npm run usuario:crear -- "tu.correo@frigomerc.com.py" "Tu Nombre" inspeccion "unaContraseñaSegura"
```

Por defecto escribe en la base **remota** (producción). Para probar
primero en local, agregá `--local` al final:

```bash
npm run usuario:crear -- "tu.correo@frigomerc.com.py" "Tu Nombre" inspeccion "unaContraseñaSegura" --local
```

Roles válidos: `inspeccion` (el único con acceso a todas las vistas y
a Configuración → Usuarios), `mantenimiento`, `calidad`. Correr el
comando de nuevo con el mismo correo actualiza nombre/rol/contraseña
de ese usuario (no crea uno duplicado).

Del resto de los usuarios ya no hace falta ocuparse por consola: una
vez que el admin entra, en **Configuración → Usuarios y accesos** puede
crear, resetear la contraseña, desactivar o eliminar cuentas — esa
sección sólo la ve y la usa el rol Inspección/Admin, nadie más.

### Actualizando una instalación que ya estaba publicada

Si ya tenías SIMA corriendo en Cloudflare (D1 y R2 ya activados) desde
antes de que existiera este login propio, para pasar a esta versión:

1. Volvé a correr `npm run db:migrar` (o `wrangler d1 execute sima-db
   --remote --file=./schema.sql`). Es seguro repetirlo: todas las
   tablas usan `CREATE TABLE IF NOT EXISTS`, así que sólo agrega la
   tabla `usuarios` nueva y no toca los datos existentes.
2. Cargá el secreto: `npx wrangler secret put SESSION_SECRET` (paso 8
   arriba) — sin esto la API devuelve error 500 en cualquier pedido.
3. Creá tu propio usuario admin con `npm run usuario:crear` (paso 9) y
   después agregá al resto del equipo desde Configuración → Usuarios.
4. Si antes usabas Cloudflare Access (Zero Trust) delante del sitio,
   ya no es necesario — el login ahora lo maneja la propia app — pero
   podés dejarlo activo igual, como capa extra, sin que estorbe.
5. Volvé a publicar: `npm run deploy`.

### Columnas nuevas: se agregan solas

Desde la versión de los cambios 12-10-26, la API revisa la base al
arrancar y agrega sola las columnas que falten (`plantas` y `legajo` en
`usuarios`; `disciplina` y `cal` en `levantamientos`). No hace falta
correr ningún SQL a mano al publicar una versión nueva. `migracion-plantas.sql`
queda como respaldo por si alguna vez preferís hacerlo desde la consola
de D1 (si una columna ya existe, esa línea da "duplicate column name" y
no pasa nada).

Los usuarios que ya existían quedan habilitados para **ambas** plantas
(el comportamiento de antes); el admin ajusta después, en Configuración →
Usuarios, a qué planta(s) entra cada uno y qué legajo tiene vinculado
cada técnico de Mantenimiento.

---

## Impresión y trazabilidad

**Ficha individual de hallazgo.** Cualquier punto, en cualquier estado,
se imprime con su flujo completo: detección, programación (con fecha,
hora tentativa, duración estimada y técnicos), ejecución (fechas, horas
reales, duración, legajo) y validación de Calidad, más las tres fotos y
la tabla de trazabilidad evento por evento. Está en el botón
**Imprimir ficha** del detalle, y como ícono directo en cada tarjeta.

**Formulario de recorrido.** Exporta el recorrido completo con el
formato F.MTO.PRY.016. Cada **subsector** tiene su propio cuadro de
control con los 12 ítems, numeración correlativa y estado C/N, y al pie
los identificadores de las no conformidades encontradas ahí. Al dorso va
el detalle de cada una con fotos.

**Ruta de inspección, único mecanismo de carga (cambio 10-10-26).** Ya
no existen las "capturas libres": todo hallazgo se carga desde dentro
de una ruta de inspección en curso, con una sola pantalla — la cámara —
donde se elige el sector y subsector con un buscador por nombre (no hace
falta navegar área por área). Lo que haya quedado de capturas libres de
antes de este cambio sigue siendo consultable en Análisis y conserva su
ficha imprimible, pero no se pueden crear nuevas.

---

## Cómo funciona la sincronización

La app **no depende del servidor para funcionar**. `localStorage` sigue
siendo la fuente de verdad de la pantalla, igual que antes. Encima de eso:

- Cada vez que la app guarda, se detecta qué cambió y se encola.
- 1,5 segundos después (o al volver la red) se sube a la base.
- Las fotos se comprimen en el dispositivo antes de guardarlas (JPEG,
  calidad ajustada automáticamente hasta entrar en ~300 KB) y viajan a
  R2 como `/api/foto/<clave>`. El Service Worker las cachea, así que se
  siguen viendo sin señal.
- Al abrir la app se baja lo que hicieron los demás y se fusiona.
- Si dos personas tocan el mismo punto, gana el cambio más reciente. Lo
  que el dispositivo todavía no subió nunca se pisa con lo del servidor.
- Si dos equipos sin señal crean el mismo número de hallazgo, el que
  sube segundo se renumera solo (queda anotado en su historial).
- La API controla los permisos por rol, no sólo la pantalla: Mantenimiento
  sólo actualiza la ejecución de los trabajos que tiene asignados
  (programado → en ejecución → a verificar), Calidad sólo su validación
  final, y cada usuario sólo recibe y escribe datos de sus plantas.
- Login: 8 intentos fallidos en 15 minutos bloquean ese correo un rato.

En las cámaras de frío, donde el wifi flaquea, el indicador pasa a
**MODO LOCAL** y todo sigue funcionando: al salir, sube solo.

---

## Alcance del plan gratuito

| Servicio | Cuota gratis | Consumo estimado de SIMA |
|---|---|---|
| Pages | 500 builds/mes · ancho de banda ilimitado | 1–2 builds por semana |
| Pages Functions | 100.000 pedidos/día | ~2.000/día con 10 usuarios |
| D1 | 5 GB · 5M filas leídas/día · 100.000 escritas/día | ~3.000 filas/año |
| R2 | 10 GB · egreso gratis | ~145 MB/año en fotos (menos aún con la compresión) |
| Workers AI | 10.000 neuronas/día | depende del uso del asistente: medirlo en Workers AI → Analytics |

Con recorrido quincenal y ~20 hallazgos por recorrido, tardás décadas en
acercarte a cualquiera de esos techos.

**Un cuidado técnico:** desde el 1 de septiembre de 2026, D1 corta las
consultas al superar el límite diario en lugar de sólo avisar. Y las
"filas leídas" cuentan filas *escaneadas*, no devueltas — por eso
`schema.sql` crea índices sobre estado, recorrido, fecha y área. No los
saques.

---

## Comandos útiles

```bash
npm run dev                  # servidor local
npm run deploy               # publicar
npm run db:migrar            # crear/actualizar tablas en producción
npm run usuario:crear -- "correo" "Nombre" rol "contraseña" [--local]
npm run db:consulta "SELECT COUNT(*) FROM levantamientos"
npx wrangler pages deployment list --project-name sima
npx wrangler r2 object list sima-fotos
npx wrangler secret put SESSION_SECRET     # rotar el secreto de sesión
```

## Copia de seguridad

```bash
npx wrangler d1 export sima-db --remote --output=respaldo.sql
```

Guardalo periódicamente. Las fotos viven en R2 y se listan con
`npx wrangler r2 object list sima-fotos`.
