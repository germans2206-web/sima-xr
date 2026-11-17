# Rediseño visual 2026 («calma operativa»)

Misma paleta (azul noche + naranja + colores de estado). Cambia cómo se usa.

## Dónde está
- **Tokens** (`public/index.html`, `:root` y `html[data-theme="light"]`): superficies, líneas casi transparentes, radios 8/12/16/22/28 + píldora, `--mono` ahora es Inter (sin JetBrains Mono).
- **Capa de componentes**: `public/sima-2026.css`, cargada al final del `<head>` y cacheada por el service worker (`sima-app-v42`). Está dividida en 11 secciones (base, shell, superficies, botones, chips, campos, inicio, carga, calendario, SIMI, responsive).
- **Textos**: las etiquetas que estaban escritas en mayúsculas en el código pasaron a minúscula de oración (eyebrows, filtros, encabezados de sección, tablas, `data-l` de tablas en celular). Los PDF impresos no cambian.

## Reglas
1. Tarjetas tonales sin borde.
2. Un solo naranja por pantalla (acción principal); secundarios en gris tonal.
3. Radios: modal 28 · tarjeta 22 · campo 14 · botones y chips en píldora.
4. Etiquetas en minúscula, sin monoespaciada ni interletra abierta.
5. Barra superior y riel fundidos con el fondo.

## Responsive
- Escritorio (> 1000 px): riel lateral.
- Tablet (761–1000 px): menos padding; en vertical usa la barra inferior.
- Celular (≤ 760 px): radios 20, botones ≥ 44 px de alto, «Comenzar la ruta» a todo el ancho, modales como hoja desde abajo.

Para volver atrás: quitar el `<link href="/sima-2026.css">` y restaurar los tokens.
