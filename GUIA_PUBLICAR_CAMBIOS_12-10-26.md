# Cómo publicar SIMA · cambios 12-10-26

Esta entrega **incluye también los cambios del 10-10-26** (no hace falta
publicar aquella versión antes). Se publica todo junto, desde el
navegador, sin terminal.

## Qué trae esta versión

**Cambios 12-10-26**
1. **Filtros en Inspección y Mantenimiento:** fecha (desde/hasta), área,
   tipo de hallazgo, estado y disciplina, más un buscador libre. Lo que
   está filtrando se ve siempre como etiquetas que se quitan con la ✕.
   Inspección tiene ahora dos vistas: **Hallazgos** (todos, del más
   reciente al más antiguo) y **Rutas cerradas** (como antes).
2. **Arrastre corregido:** se arrastra sólo lo que quedó **sin resolver**
   (trabajo no cerrado) al iniciar el recorrido siguiente. Cargar otro
   hallazgo del mismo tipo en el mismo punto ya no se trata como arrastre
   ni bloquea el guardado: sólo aparece un aviso informativo.
3. **Verificación de Calidad:** el trabajo se sigue cerrando con la
   verificación del Inspector. Después, Control de Calidad ve un botón
   verde **Verificar** como control final, que no cambia el estado.
   Análisis muestra por separado *A verificar · Inspector* y *A validar ·
   Calidad*.
4. **Vista de técnicos en zócalos:** cada trabajo es una fila con la foto
   del hallazgo y su descripción, del más reciente al más antiguo, con
   pestañas Por hacer / A verificar / Cerrados / Todos y los filtros.
5. **Disciplina del hallazgo:** Civil, Eléctrico, Mecánico u Otro. Se
   sugiere sola según el tipo y se puede cambiar. Al exportar el PDF del
   recorrido se eligen las disciplinas a incluir.

**Corrección incluida:** en la versión anterior, el legajo y las plantas
de cada usuario se perdían al reconfirmar la sesión, así que los técnicos
terminaban viendo todos los trabajos. Ya está corregido.

**Cambios 10-10-26** (si todavía no estaban en línea): validación del
Inspector sin foto de Calidad, sin capturas libres, carga con buscador de
sector, tipos Puerta y Soldadura, usuarios por planta y trabajos por
legajo.

---

## Paso 1 · Preparar los archivos

1. Descargá `sima-cambios-12-10-26.zip` y descomprimilo.
2. Adentro hay una carpeta `sima` con esta estructura. **Así tiene que
   quedar en GitHub:**

   ```
   functions/
     api/
       [[path]].js
   public/
     index.html
     sima-sync.js
     sw.js
     manifest.webmanifest
     icon-192.png
     icon-512.png
   scripts/
     crear-usuario.mjs
   README.md
   schema.sql
   semilla.sql
   migracion-plantas.sql
   package.json
   package-lock.json
   wrangler.toml
   GUIA_PUBLICAR_CAMBIOS_12-10-26.md
   ```

## Paso 2 · Subir a GitHub conservando las carpetas

La vez pasada los archivos quedaron sueltos en la raíz del repositorio y
Cloudflare siguió publicando la versión vieja, porque sólo lee lo que está
**dentro** de `public/` y `functions/api/`. Para que no vuelva a pasar:

1. Entrá a github.com → `sidma-proyecto` (rama `main`).
2. **Add file → Upload files.**
3. Abrí la carpeta `sima` descomprimida, seleccioná **todo lo que hay
   adentro** (las carpetas `functions`, `public`, `scripts` y los
   archivos sueltos) y arrastralo junto a la ventana de GitHub. Usá
   Chrome o Edge: al arrastrar carpetas, GitHub respeta la estructura.
4. Antes de confirmar, mirá la lista de archivos que muestra GitHub: tienen
   que aparecer con su carpeta delante, por ejemplo
   `public/index.html` y `functions/api/[[path]].js`. Si ves `index.html`
   sin `public/` delante, cancelá y volvé a arrastrar las carpetas (no
   los archivos de adentro).
5. Escribí un mensaje como `version 12-10` y tocá **Commit changes**.

### Limpieza de la subida anterior

En la raíz del repositorio quedaron copias sueltas de la vez pasada. No
rompen nada, pero conviene borrarlas para no confundirse. Abrí cada una y
borrala con el ícono de tacho (⋯ → *Delete file*):

`index.html`, `[[path]].js`, `icon-192.png`, `icon-512.png`,
`manifest.webmanifest`, `crear-usuario.mjs` y `download`.

**No borres** los que van en la raíz: `README.md`, `schema.sql`,
`semilla.sql`, `migracion-plantas.sql`, `package.json`,
`package-lock.json`, `wrangler.toml` ni las carpetas.

### Cómo confirmar que quedó bien

En la página principal del repositorio, las carpetas **`public`** y
**`functions`** tienen que decir *version 12-10* y "hace unos minutos".
Si alguna sigue diciendo "2 weeks ago" o "last month", los archivos no
entraron en su carpeta: repetí el paso 2.

## Paso 3 · Esperar a Cloudflare

Cloudflare publica solo al detectar el commit:

1. dash.cloudflare.com → **Workers & Pages → sidma-proyecto →
   Deployments**.
2. Esperá a que el deployment de arriba diga **Production** con la tilde
   verde y el mensaje `version 12-10` (uno o dos minutos).

## Paso 4 · Base de datos: no hay que hacer nada

Esta versión agrega sola las columnas nuevas la primera vez que alguien
abre la app (plantas y legajo de usuarios; disciplina y verificación de
Calidad en los hallazgos). **No hace falta correr SQL en la consola de
D1.** Si ya lo habías hecho antes, tampoco molesta.

Los usuarios existentes quedan habilitados para ambas plantas, como
antes. Para que cada técnico vea sólo sus trabajos, entrá a
**Configuración → Usuarios**, tocá el lápiz de cada técnico y cargale su
legajo (el mismo del padrón de técnicos).

## Paso 5 · Revisar en el sitio

Abrí `sidma-proyecto.pages.dev` en una ventana privada:

1. **Inspección** muestra *Hallazgos* y *Rutas cerradas*, con la barra de
   filtros. Ya no aparece "Captura libre".
2. En una ruta, **Cargar hallazgo** pide la disciplina (se sugiere sola).
3. Entrá con un técnico que tenga legajo: ve **Mis trabajos** en
   zócalos, sólo los suyos.
4. Con una cuenta de Calidad: **Control final** muestra el botón verde
   **Verificar** en los trabajos que ya cerró el Inspector.
5. **Exportar PDF** de una ruta abre primero el selector de disciplinas.

Si todavía ves la versión vieja, revisá el Paso 2 → *Cómo confirmar que
quedó bien*: casi siempre es que `public/index.html` no se reemplazó.

## Si algo sale mal

- **Volver a la versión anterior:** Deployments → en el deployment
  anterior, ⋯ → **Rollback to this deployment**. Sólo cambia el código,
  no toca la base de datos.
- **Error "No se pudo actualizar la base de datos"** al abrir la app:
  pasame el texto completo del error. Mientras tanto, el bloque de
  `migracion-plantas.sql` (partes C y D) se puede pegar línea por línea
  en D1 → sima-db → Console.
