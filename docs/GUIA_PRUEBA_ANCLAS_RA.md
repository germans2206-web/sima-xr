# Guía de prueba · Etiquetas RA fijas con ARCore Cloud Anchors

**Objetivo:** saber, antes de invertir en el desarrollo completo, si en *tu* planta
el celular reconoce los lugares lo suficiente como para que una etiqueta vuelva a
aparecer en el mismo punto.

**Tiempo:** 1 día de preparación + 1 a 2 días de prueba en planta.
**Qué se usa:** la app SIMA RA de Unity de este repositorio (`unity/SimaRA`), compilada en un Android.

---

## 1. Antes de ir a planta

### Celulares
- [ ] Al menos **2 Android compatibles con ARCore** (gama media o alta, de los últimos 4 años).
      En la tienda tiene que aparecer **Servicios de Google Play para RA**.
- [ ] Cargados y con **datos móviles o wifi**: subir y buscar anclas necesita internet.
- [ ] Opcional: 1 iPhone, para la etapa siguiente (no entra en esta prueba).

### App
- [ ] Seguí `unity/SimaRA/README.md` hasta **Build And Run** en los dos celulares.
- [ ] Iniciá sesión en la app con tu usuario de SIMA RA (germans2206@gmail.com).
- [ ] En el navegador de esos celulares, iniciá sesión en https://sima-ra.pages.dev
      (la app abre ahí el formulario de carga).

### Zonas a probar (elegí 6, de las más fáciles a las más difíciles)
| # | Zona | Por qué |
|---|---|---|
| 1 | Oficina o pasillo con objetos | Control: debería andar siempre |
| 2 | Sala de máquinas / tableros | Equipos, cables, textura: suele andar bien |
| 3 | Playa de faena | Acero inoxidable, agua, iluminación fuerte |
| 4 | Cámara de oreo | Paneles blancos lisos, frío, poca luz |
| 5 | Túnel o cámara de congelados | Escarcha, vapor, muy poca textura |
| 6 | Exterior (corrales o playa de camiones) | Sol, cambios de luz durante el día |

---

## 2. Cómo marcar (Prueba A · subir el ancla)
En cada zona, marcá **3 puntos distintos** (por ejemplo: una junta de panel, un tablero, una puerta):

1. En la app: **Marcar NC en RA**.
2. Apuntá al punto y tocalo: aparece el pin rojo.
3. Mové el celular **despacio, en arco, a 1–2 m**, durante 10 a 30 segundos, mirando el punto
   desde la izquierda, el centro y la derecha.
4. Esperá que la barra pase a **amarilla (suficiente)** o **verde (buena)** y tocá **Guardar ancla**.
5. Completá la NC en el navegador. En la descripción poné `PRUEBA RA – zona X – punto Y`.
6. Anotá en la planilla: cuántos segundos tardó en ponerse amarilla o verde y si subió bien.

## 3. Cómo buscar (Prueba B · reconocer el ancla)
Repetí la búsqueda en **tres momentos**:
- **B1 · enseguida**, con el **otro** celular.
- **B2 · otro turno** (luz distinta, con gente y equipos en movimiento).
- **B3 · al día siguiente.**

En cada uno:
1. En la app: elegí el sector → **Ver etiquetas**.
2. Parate a 2–3 m del punto y recorré despacio con la cámara.
3. Anotá: si apareció la tarjeta, en cuántos segundos, y **a qué distancia del punto real quedó**
   (a ojo: menos de 5 cm, 5 a 20 cm, más de 20 cm).

---

## 4. Planilla (copiala en papel o en una hoja de cálculo)

| Zona | Punto | Calidad al marcar (seg. hasta amarillo/verde) | ¿Subió? | B1 ¿apareció? / seg / error | B2 ¿apareció? / seg / error | B3 ¿apareció? / seg / error | Notas (luz, vapor, gente…) |
|---|---|---|---|---|---|---|---|
| 1 Oficina | 1 | | | | | | |
| 1 Oficina | 2 | | | | | | |
| 1 Oficina | 3 | | | | | | |
| 2 Sala de máquinas | 1 | | | | | | |
| … | | | | | | | |

---

## 5. Cómo leer el resultado

| Resultado por zona | Qué significa | Qué hacer |
|---|---|---|
| **3 de 3 puntos** aparecen en B1, B2 y B3, con error menor a 20 cm | La zona funciona bien con anclas en la nube | Usar la app en esa zona tal cual |
| Aparecen en B1 pero **fallan en B2/B3** | La zona cambia mucho (luz, equipos, gente) | Marcar sobre cosas fijas (columnas, tableros, marcos), no sobre lo que se mueve |
| No llega a amarillo o **no sube** | El lugar no tiene textura suficiente | Poner una placa o calcomanía con textura cerca, o usar placas físicas en esa zona |
| Sube pero **casi nunca aparece** | Superficies lisas, brillantes o con vapor | Placas físicas (opción A) en esa zona |

**Decisión:**
- Si **4 o más de las 6 zonas** funcionan → seguir con la app nativa (Unity + ARCore) como herramienta principal.
- Si funcionan **3 o menos** → conviene la opción A (placas físicas en la web) como base, y la app sólo en las zonas que sí funcionan.

---

## 6. Problemas comunes

| Mensaje | Causa | Solución |
|---|---|---|
| «La app no está autorizada en Google Cloud» | Falta el ID de cliente Android o el SHA-1 no coincide | Revisar el paso 1 del README: paquete `com.simara.app` y SHA-1 del keystore con el que compilaste |
| «Sin conexión con Google» | Sin datos o wifi | Probar con datos móviles |
| «El lugar no tiene suficientes detalles» | Poca textura o se escaneó poco | Escanear más tiempo y desde más ángulos; si persiste, es una zona difícil |
| La tarjeta aparece pero «flota» corrida | Se marcó sobre algo que se movió, o el escaneo fue corto | Volver a marcar escaneando hasta verde |
| La app no encuentra las NC | No se completó la carga en la web o es otra planta | Revisar que la NC exista en SIMA RA con «Ancla en la nube (app SIMA RA)» |

Al terminar, borrá las NC de prueba desde SIMA RA (ficha → Eliminar) o dejalas como ejemplo.
