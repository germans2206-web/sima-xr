# SIMA RA · App nativa (Unity + AR Foundation + ARCore Cloud Anchors)

La app nativa hace sólo lo que la web no puede: **fijar una etiqueta en el espacio
real para que vuelva a aparecer en el mismo lugar cada vez**, en cualquier celular,
hoy o dentro de meses. Todo lo demás (foto, dictado, sector, tipo, IA, programación,
Calidad, mapa) sigue en la web de SIMA RA.

```
App (Unity)                                SIMA RA (Cloudflare)
├─ Marcar NC ── sube ancla ─► ARCore ──►   abre /?ancla=<id>  → formulario de carga web
└─ Ver etiquetas ◄─ busca ancla ◄─ ARCore  GET /api/ra/anclas → tarjetas (estado, días, reincide)
                  tocar tarjeta ─────────► abre /?nc=LV-123   → ficha del hallazgo
```

## Qué hay acá

| Archivo | Qué hace |
|---|---|
| `Assets/SimaRA/Scripts/SimaRAApp.cs` | Flujo completo: ingreso, inicio, marcar, ver etiquetas, renovación |
| `Assets/SimaRA/Scripts/CloudAnchorService.cs` | Cloud Anchors de ARCore: calidad del escaneo, subir y buscar |
| `Assets/SimaRA/Scripts/SimaApi.cs` | Login (mismos usuarios que la web) y API de SIMA |
| `Assets/SimaRA/Scripts/TagView.cs` | La tarjeta colgante en 3D (mismo diseño que la web) |
| `Assets/SimaRA/Scripts/AppUI.cs` | Interfaz armada por código (botones grandes, para usar con guantes) |
| `Assets/SimaRA/Scripts/NcModelo.cs` | Datos y reglas de la señalética (rojo / amarillo / verde) |
| `Assets/SimaRA/Scripts/SimaConfig.cs` | Ajustes: dirección, planta, duración del ancla |
| `Assets/SimaRA/Editor/SimaRASetup.cs` | Menú **SIMA RA → Preparar escena**: arma la escena en un clic |

## Puesta en marcha (una vez, cerca de 1 hora)

### 1. Google Cloud (autorización de las anclas, sin claves dentro de la app)
1. Entrá a https://console.cloud.google.com, creá un proyecto (por ejemplo `sima-ra`) y activá **ARCore API**.
2. **APIs y servicios → Pantalla de consentimiento OAuth**: tipo Interno (si tenés Workspace) o Externo con tu correo como usuario de prueba.
3. **Credenciales → Crear credenciales → ID de cliente de OAuth → Android**:
   - Nombre del paquete: `com.simara.app`
   - SHA-1: la huella del certificado con el que firmás la app (paso 4).
4. Huella: en Unity, **Project Settings → Player → Android → Publishing Settings → Keystore Manager**,
   creá un keystore (guardalo bien: es con el que vas a firmar siempre) y sacá su SHA-1:
   ```
   keytool -list -v -keystore sima-ra.keystore -alias sima-ra
   ```
   Con *keyless*, Google reconoce la app por paquete + huella: no queda ninguna clave dentro del APK
   y las anclas pueden durar **hasta 365 días**.

### 2. Proyecto de Unity
1. Instalá **Unity 6 LTS** con el módulo **Android Build Support** (e iOS si vas a compilar para iPhone).
2. Creá un proyecto con la plantilla **AR Mobile** (Universal 3D). Ya trae AR Foundation, los plug-ins
   XR de ARCore y ARKit, y el Input System.
3. **Window → Package Manager → + → Add package from git URL…** y pegá:
   ```
   https://github.com/google-ar/arcore-unity-extensions.git
   ```
   (ARCore Extensions de Google. Si pide una versión, usá la última compatible con tu AR Foundation.)
4. Copiá la carpeta `Assets/SimaRA` de este repositorio dentro de `Assets` de tu proyecto.
   Si Unity pide importar **TMP Essentials**, aceptá.

### 3. Escena y ajustes
1. Abrí la escena de ejemplo de la plantilla (tiene *AR Session* y *XR Origin*).
2. Menú **SIMA RA → Preparar escena** y guardá la escena (Ctrl+S).
3. **Project Settings → XR Plug-in Management**:
   - Pestaña **Android**: tildá **ARCore**.
   - **ARCore Extensions**: *Android Authentication Strategy* = **Keyless**.
     Tildá **Cloud Anchors / iOS Support** sólo si vas a compilar para iPhone (ver abajo).
4. **Project Settings → Player → Android**:
   - *Scripting Backend*: **IL2CPP** · *Target Architectures*: **ARM64**
   - *Minimum API Level*: 24 o más (el menú ya lo pone)
   - Si la compilación falla por gráficos, dejá en *Graphics APIs* sólo **OpenGLES3**.
5. En `Assets/SimaRA/Config/SimaConfig` revisá que `baseUrl` sea `https://sima-ra.pages.dev`.

### 4. Compilar al celular
1. En el celular: activá *Opciones de desarrollador → Depuración USB* e instalá **Servicios de Google
   Play para RA** desde la tienda (si no aparece, ese celular no es compatible con ARCore).
2. Conectalo por USB → **File → Build Profiles → Android → Switch Platform → Build And Run**.

## Cómo se usa
- **Marcar NC (sólo Inspector):** tocá la falla → aparece el pin rojo → mové el celular despacio
  alrededor hasta que la barra se ponga amarilla o verde → **Guardar ancla**. Se abre el navegador con
  la carga de SIMA RA y el ancla ya puesta: completás foto, sector y tipo, y guardás.
- **Ver etiquetas (todos los roles):** elegí un sector → **Ver etiquetas** → recorré despacio con la
  cámara. Cada NC reconocida aparece como tarjeta fija en su lugar (roja pendiente · amarilla programada ·
  verde resuelta, días abierta, franja negra y amarilla si reincide). Al tocarla se abre la ficha en la web.
- **Renovación:** cuando el Inspector ve un ancla a la que le quedan menos de 30 días, la app la vuelve
  a subir sola y actualiza SIMA.

## iPhone
Los Cloud Anchors de ARCore también funcionan en iOS (sobre ARKit), pero *keyless* en iPhone necesita
tokens firmados por un servidor propio. Próximo paso: una ruta `/api/ra/token` en SIMA que firme esos
tokens con una cuenta de servicio de Google (guardada como secreto en Cloudflare). Para el piloto,
empezá por Android.

## A tener en cuenta
- Subir y buscar anclas **necesita internet**. En cámaras de frío con wifi débil, revisá la cobertura.
- El reconocimiento necesita **textura**: paneles lisos, acero brillante, vapor o escarcha lo complican.
  Si una zona falla, una calcomanía o placa con textura junto a la falla lo resuelve.
- Si el lugar cambia (se mueve un equipo, una reforma), el ancla puede dejar de reconocerse: la NC
  sigue en el mapa de SIMA por sector y GPS.
- Este proyecto se escribió sin poder compilarlo en Unity (se armó desde una sesión sin el editor).
  Si algo no compila por una diferencia de versión de ARCore Extensions o AR Foundation, el error suele
  señalar el nombre de un método: compará con la documentación oficial de Cloud Anchors para Unity.
