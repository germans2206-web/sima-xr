# SIMA RA · Ruta de inspección con realidad aumentada (17-11-26 · v2 19-11-26)

## v2 (19-11-26): tarjetas fijas, mapa para todos y reincidencias
- **Lenguaje visual:** señalética de seguridad (ISO 7010). Cada NC es una tarjeta colgante
  de inspección: rojo *Pendiente* (detectado), amarillo *Programada* (programado, en
  ejecución, a verificar), verde *Resuelta* (cerrado). Dice número, tipo, **días abierta**,
  fecha programada o de cierre y, con franjas negras y amarillas, si **reincide** ahí.
  Además del color cambia la forma (círculo, rombo, tilde).
- **Buscar con la cámara:** en Android + Chrome las tarjetas son 3D y **quedan fijas en el
  mundo** (GPS + brújula al empezar, después las sostiene el seguimiento de ARCore), con
  poste y aro en el piso donde se levantó la falla. Si la brújula está corrida, ⟲ ⟳ las
  gira de a 10°. En iPhone/PC: tarjetas sobre la cámara, suavizadas, más un radar de bolsillo.
  Tocar una tarjeta abre su resumen y la ficha.
- **Mapa NC** (menú, todos los roles): arrastrar, pellizcar o rueda; filtros Abiertas /
  Pendientes / Programadas / Resueltas / Reincidencias / Todas; tu posición y hacia dónde
  mirás; al tocar un punto, su tarjeta con «Ir hasta la NC», «Ver ficha» y Google Maps.
- **SIMI y reincidencias:** mismo lugar = a menos de 6 m (con GPS) o mismo subsector, en
  120 días. SIMI avisa en vivo al marcar (en la RA), en la carga, en la ficha, al guardar y
  en el mapa («Un lugar se repite»).
- **IA:** Groq (`GROQ_API_KEY`) como principal y Workers AI de respaldo.
- **Skills de RA** guardadas en `.claude/skills/` (threejs-impl-xr, ar-vr-xr y three.js).


Proyecto nuevo, separado de SIMA: otro repositorio, otro sitio de Cloudflare Pages
(`sima-ra`), otra base D1 (`sima-ra-db`) y otro bucket R2 (`sima-ra-fotos`).
SIMA original no se toca.

## Lógica
Durante una **Ruta de inspección en curso**, cada no conformidad (NC) se marca en
el lugar donde está y queda guardada con su ubicación.

| Acción | Dónde | Qué hace |
|---|---|---|
| **Marcar NC en RA** | Ruta en curso | Abre la cámara en RA. El Inspector clava un pin «NC» sobre la falla. Se abre la carga de hallazgo con la marca hecha. |
| **Cargar hallazgo** (sin RA) | Ruta en curso | La carga de siempre. Igual guarda la ubicación GPS del momento. |
| **Ver NC cercanas en RA** | Ruta en curso | Sobre la cámara aparecen las NC abiertas cercanas, en su dirección real y con su distancia. Tocar una abre su ficha. |
| **Mapa del recorrido** | Ruta en curso | Plano sin conexión (SVG) con cada NC según su estado, tu posición y enlace a Google Maps. |
| **Ir hasta la NC en RA / Ver en el mapa** | Ficha del hallazgo | Guía con flecha y metros hasta esa NC. |

### Cómo se marca
- **Android + Chrome (ARCore):** WebXR `immersive-ar` con *hit-test*. Un aro sigue
  la superficie (pared, piso, equipo); al tocar se clava el pin 3D. SIMA mide la
  distancia y el desvío del pin respecto de hacia dónde mira el Inspector y, con GPS +
  brújula, **proyecta la coordenada de la NC** (no la del Inspector). Después se abre
  la cámara normal para la foto de evidencia.
- **iPhone, PC y Android sin ARCore:** modo cámara. Se toca el punto en la imagen y
  «Tomar foto y marcar»: la foto queda con el pin dibujado y es la evidencia del «antes».
- **Sin cámara:** sólo GPS.

### Qué se guarda (`levantamientos.ra`, JSON)
`{ metodo: 'webxr'|'camara'|'gps', lat, lon, acc, alt, rumbo, dist, insp:{lat,lon}, px:{x,y}, d, by }`
- `lat/lon`: ubicación de la NC · `acc`: precisión del GPS en metros.
- `insp`: dónde estaba el Inspector · `dist`/`rumbo`: a cuántos metros y hacia dónde.
- `px`: punto tocado en la foto (0–1).
La columna se agrega sola en D1 (auto-migración de la API). La API valida rangos.
Queda en la trazabilidad («Marcado en RA»), en la ficha y en el Excel
(columnas «Ubicación GPS» y «Marca RA»).

### Límites
- WebXR RA sólo en Android con Chrome y Servicios de Google Play para RA.
- Adentro de cámaras de frío el GPS puede faltar o tener ±20–50 m: la NC conserva
  siempre sector y subsector, y se muestra la precisión.
- La brújula se perturba cerca de estructuras metálicas: el radar es una guía, el
  sector es la referencia.
- iPhone pide permiso de brújula y de ubicación al primer uso.

## Archivos
- `public/sima-ra.js` · todo el módulo (marcar, radar, mapa, integración).
- `public/index.html` · botones de la Ruta, paso 3 de la carga, guardado, ficha, Excel.
- `functions/api/[[path]].js` · columna `ra` + validación `limpiarRA`.
