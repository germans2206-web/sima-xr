# SIMA RA · Ruta de inspección con realidad aumentada (17-11-26)

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
