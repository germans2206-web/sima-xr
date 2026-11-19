// SIMA RA · App nativa: flujo completo.
//
//  Ingreso ─► Inicio ─┬─► Marcar NC (sólo Inspector)
//                     │     1. tocar la falla → pin + ARAnchor
//                     │     2. escanear alrededor hasta calidad "Suficiente"
//                     │     3. subir ancla a ARCore → anclaId
//                     │     4. abrir SIMA RA web con ?ancla=… para completar
//                     │        foto, dictado, sector y tipo (como siempre)
//                     └─► Ver etiquetas (todos los roles)
//                           1. traer de SIMA las NC con ancla (por sector)
//                           2. buscarlas con ARCore (varias a la vez)
//                           3. cada una reconocida → tarjeta fija en su lugar
//                           4. tocar la tarjeta → ficha en la web (?nc=…)
//                           5. si el ancla vence pronto → se vuelve a subir
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Google.XR.ARCoreExtensions;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

namespace SimaRA
{
    public class SimaRAApp : MonoBehaviour
    {
        [Header("Referencias (las completa el menú SIMA RA → Preparar escena)")]
        public SimaConfig config;
        public SimaApi api;
        public CloudAnchorService nube;
        public AppUI ui;
        public ARRaycastManager raycast;
        public ARAnchorManager anclas;
        public Camera camaraAR;

        enum Modo { Ingreso, Inicio, Marcar, Subiendo, Ver }
        Modo modo;
        RespuestaAnclas datos;
        readonly List<string> sectores = new List<string>();

        // Marcar
        ARAnchor anclaNueva; GameObject pinNuevo; float tCalidad; FeatureMapQuality calidad;
        static readonly List<ARRaycastHit> hits = new List<ARRaycastHit>();

        // Ver
        readonly Dictionary<string, TagView> vistas = new Dictionary<string, TagView>();
        readonly Queue<NcAncla> cola = new Queue<NcAncla>();
        readonly Dictionary<string, int> intentos = new Dictionary<string, int>();
        int buscando, total, reconocidas, generacion;

        void Start()
        {
            Screen.sleepTimeout = SleepTimeout.NeverSleep;
            ui.Construir();
            AppUI.Click(ui.bIngresar, () => StartCoroutine(Ingresar()));
            AppUI.Click(ui.bMarcar, EmpezarMarcar);
            AppUI.Click(ui.bVer, () => StartCoroutine(EmpezarVer()));
            AppUI.Click(ui.bSalir, () => { api.CerrarSesion(); IrIngreso(); });
            AppUI.Click(ui.bCerrarRA, () => { Limpiar(); IrInicio(); });
            AppUI.Click(ui.bAccion, AlAccion);
#if ENABLE_LEGACY_INPUT_MANAGER
            if (Input.location.isEnabledByUser) Input.location.Start(5f, 1f);
#endif
            if (api.TieneSesion) IrInicio(); else IrIngreso();
        }

        // ---------------- Ingreso / Inicio ----------------
        void IrIngreso() { modo = Modo.Ingreso; ui.errIngreso.text = ""; ui.Mostrar(ui.pIngreso); }

        IEnumerator Ingresar()
        {
            ui.errIngreso.text = "Ingresando…"; ui.bIngresar.interactable = false;
            string error = null; bool ok = false;
            yield return api.Login(ui.email.text, ui.pass.text, (o, e) => { ok = o; error = e; });
            ui.bIngresar.interactable = true;
            if (!ok) { ui.errIngreso.text = error; yield break; }
            ui.pass.text = ""; IrInicio();
        }

        void IrInicio()
        {
            modo = Modo.Inicio; ui.Mostrar(ui.pInicio);
            var n = api.Nombre; ui.hola.text = string.IsNullOrEmpty(n) ? "Hola" : "Hola, " + CultureInfo.CurrentCulture.TextInfo.ToTitleCase(n.ToLowerInvariant().Split(' ')[0]);
            ui.bMarcar.gameObject.SetActive(api.EsInspector);
            ui.estadoInicio.text = "Buscando las NC con ancla…";
            StartCoroutine(api.Anclas(null, (r, e) =>
            {
                if (e != null) { ui.estadoInicio.text = e; if (!api.TieneSesion) IrIngreso(); return; }
                datos = r;
                sectores.Clear(); sectores.Add("Todos los sectores");
                sectores.AddRange(r.ncs.Select(x => x.sector).Where(s => !string.IsNullOrEmpty(s)).Distinct().OrderBy(s => s));
                ui.sector.ClearOptions(); ui.sector.AddOptions(sectores);
                var ab = r.ncs.Count(x => x.estado != "cerrado");
                ui.estadoInicio.text = r.ncs.Length == 0 ? "Todavía no hay NC marcadas con ancla." : $"{r.ncs.Length} NC con ancla · {ab} abiertas";
            }));
        }

        // ---------------- Marcar ----------------
        void EmpezarMarcar()
        {
            modo = Modo.Marcar; Limpiar(); ui.Mostrar(ui.pRA);
            ui.raTitulo.text = "Marcar no conformidad";
            ui.raEstado.text = "Apuntá a la falla y tocala para clavar el pin.";
            ui.VerCalidad(false);
            ui.Accion("Guardar ancla", false, Senaletica.Rojo, Color.white);
            if (pinNuevo == null) pinNuevo = CrearPin();
            pinNuevo.SetActive(false);
        }

        void Update()
        {
            if (modo == Modo.Marcar) ActualizarMarcar();
            else if (modo == Modo.Ver && Toques.Tap(out var p) && !Toques.SobreUI(p)) TocarEtiqueta(p);
        }

        void ActualizarMarcar()
        {
            if (Toques.Tap(out var pos) && !Toques.SobreUI(pos) &&
                raycast.Raycast(pos, hits, TrackableType.PlaneWithinPolygon | TrackableType.FeaturePoint))
            {
                var pose = hits[0].pose;
                if (anclaNueva != null) Destroy(anclaNueva.gameObject);
                var go = new GameObject("Ancla NC nueva"); go.transform.SetPositionAndRotation(pose.position, pose.rotation);
                anclaNueva = go.AddComponent<ARAnchor>();
                pinNuevo.transform.SetParent(go.transform, false); pinNuevo.SetActive(true);
                ui.VerCalidad(true);
                ui.raEstado.text = "Ahora mové el celular despacio alrededor de la falla, desde varios ángulos.";
                Handheld.Vibrate();
            }
            if (anclaNueva == null) return;
            if (Time.time - tCalidad < .3f) return;
            tCalidad = Time.time;
            var cam = camaraAR.transform;
            calidad = nube.Calidad(new Pose(cam.position, cam.rotation));
            switch (calidad)
            {
                case FeatureMapQuality.Good: ui.Calidad(1f, "Calidad: buena. Ya podés guardar.", Senaletica.Verde); break;
                case FeatureMapQuality.Sufficient: ui.Calidad(.66f, "Calidad: suficiente. Un poco más y queda mejor.", Senaletica.Amarillo); break;
                default: ui.Calidad(.25f, "Seguí escaneando alrededor de la falla…", Senaletica.Rojo); break;
            }
            ui.Accion("Guardar ancla", calidad != FeatureMapQuality.Insufficient, Senaletica.Rojo, Color.white);
        }

        void AlAccion()
        {
            if (modo == Modo.Marcar && anclaNueva != null) StartCoroutine(Subir());
            else if (modo == Modo.Ver) StartCoroutine(EmpezarVer());
        }

        IEnumerator Subir()
        {
            modo = Modo.Subiendo;
            ui.Accion("Subiendo ancla…", false, Senaletica.Rojo, Color.white);
            ui.raEstado.text = "Guardando el lugar en la nube. No muevas mucho el celular.";
            string id = null, error = null;
            yield return nube.Subir(anclaNueva, (i, e) => { id = i; error = e; });
            if (id == null) { modo = Modo.Marcar; ui.raEstado.text = error; ui.Accion("Reintentar", true, Senaletica.Rojo, Color.white); yield break; }
            var dist = Vector3.Distance(camaraAR.transform.position, anclaNueva.transform.position);
            var q = "ancla=" + UnityEngine.Networking.UnityWebRequest.EscapeURL(id) + "&vence=" + nube.VenceDesdeHoy() + "&dist=" + dist.ToString("0.00", CultureInfo.InvariantCulture);
#if ENABLE_LEGACY_INPUT_MANAGER
            if (Input.location.status == LocationServiceStatus.Running)
            {
                var l = Input.location.lastData;
                q += "&lat=" + l.latitude.ToString("0.0000000", CultureInfo.InvariantCulture) + "&lon=" + l.longitude.ToString("0.0000000", CultureInfo.InvariantCulture) + "&acc=" + l.horizontalAccuracy.ToString("0.0", CultureInfo.InvariantCulture);
            }
#endif
            ui.raEstado.text = "Ancla guardada. Completá la NC en SIMA RA (foto, sector y tipo) y volvé a la app.";
            api.AbrirWeb(q);
            yield return new WaitForSeconds(1f);
            Limpiar(); IrInicio();
        }

        GameObject CrearPin()
        {
            var raiz = new GameObject("Pin NC");
            var bola = GameObject.CreatePrimitive(PrimitiveType.Sphere); Destroy(bola.GetComponent<Collider>());
            bola.transform.SetParent(raiz.transform, false); bola.transform.localPosition = Vector3.up * .14f; bola.transform.localScale = Vector3.one * .08f;
            var palo = GameObject.CreatePrimitive(PrimitiveType.Cylinder); Destroy(palo.GetComponent<Collider>());
            palo.transform.SetParent(raiz.transform, false); palo.transform.localPosition = Vector3.up * .05f; palo.transform.localScale = new Vector3(.012f, .05f, .012f);
            var m = new Material(Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color")) { color = Senaletica.Rojo };
            bola.GetComponent<Renderer>().material = m; palo.GetComponent<Renderer>().material = m;
            return raiz;
        }

        // ---------------- Ver etiquetas ----------------
        IEnumerator EmpezarVer()
        {
            Limpiar(); modo = Modo.Ver; ui.Mostrar(ui.pRA); ui.VerCalidad(false);
            var sec = ui.sector.value > 0 && ui.sector.value < sectores.Count ? sectores[ui.sector.value] : null;
            ui.raTitulo.text = sec ?? "Etiquetas de NC";
            ui.raEstado.text = "Trayendo las NC…"; ui.Accion("", false, Color.clear, Color.clear);
            RespuestaAnclas r = null; string e = null;
            yield return api.Anclas(sec, (x, err) => { r = x; e = err; });
            if (r == null) { ui.raEstado.text = e; yield break; }
            // Primero las abiertas; las resueltas al final.
            foreach (var n in r.ncs.OrderBy(x => x.estado == "cerrado").ThenByDescending(x => x.fechaDet)) cola.Enqueue(n);
            total = r.ncs.Length; reconocidas = 0;
            if (total == 0) { ui.raEstado.text = "No hay NC con ancla en este sector."; yield break; }
            ui.raEstado.text = $"Recorré con la cámara: buscando {total} NC…";
            while (buscando < config.maxResolverAlaVez && cola.Count > 0) StartCoroutine(Buscar(cola.Dequeue()));
        }

        IEnumerator Buscar(NcAncla n)
        {
            var gen = generacion; buscando++;
            ARCloudAnchor ancla = null; string error = null;
            yield return nube.Buscar(n.anclaId, (a, e) => { ancla = a; error = e; });
            if (gen != generacion || modo != Modo.Ver) { if (ancla) Destroy(ancla.gameObject); yield break; }
            buscando--;
            if (ancla != null)
            {
                reconocidas++;
                vistas[n.id] = TagView.Crear(n, ancla.transform);
                Handheld.Vibrate();
                StartCoroutine(RenovarSiHaceFalta(n, ancla));
            }
            else
            {
                intentos.TryGetValue(n.id, out var k); intentos[n.id] = k + 1;
                if (k + 1 < 3 && !(error ?? "").StartsWith("El ancla ya no existe")) cola.Enqueue(n);   // otra pasada más tarde
            }
            ui.raEstado.text = reconocidas == 0
                ? $"Recorré despacio la zona: buscando {total} NC…"
                : $"{reconocidas} de {total} NC a la vista · tocá una tarjeta para ver la ficha.";
            if (cola.Count > 0 && buscando < config.maxResolverAlaVez) StartCoroutine(Buscar(cola.Dequeue()));
            if (cola.Count == 0 && buscando == 0 && reconocidas < total) ui.Accion("Buscar de nuevo", true, Senaletica.Amarillo, Senaletica.Tinta);
        }

        IEnumerator RenovarSiHaceFalta(NcAncla n, ARCloudAnchor ancla)
        {
            if (!api.EsInspector || n.estado == "cerrado") yield break;
            var v = Senaletica.Fecha(n.anclaVence);
            if (!v.HasValue || (v.Value - System.DateTime.Today).TotalDays > config.renovarSiQuedanDias) yield break;
            yield return new WaitForSeconds(3f);   // que ARCore "vea" el lugar un rato
            var go = new GameObject("Renovar " + n.id); go.transform.SetPositionAndRotation(ancla.transform.position, ancla.transform.rotation);
            var nueva = go.AddComponent<ARAnchor>();
            string id = null;
            yield return nube.Subir(nueva, (i, e) => id = i);
            if (id != null) yield return api.Renovar(n.id, id, nube.VenceDesdeHoy(), ok => { if (ok) n.anclaId = id; });
            Destroy(go);
        }

        void TocarEtiqueta(Vector2 p)
        {
            var ray = camaraAR.ScreenPointToRay(p);
            if (!Physics.Raycast(ray, out var hit, 60f)) return;
            var t = hit.collider.GetComponentInParent<TagView>();
            if (t != null) api.AbrirWeb("nc=" + UnityEngine.Networking.UnityWebRequest.EscapeURL(t.nc.id));
        }

        void Limpiar()
        {
            generacion++; buscando = 0; cola.Clear(); intentos.Clear();   // las búsquedas viejas se descartan solas
            foreach (var v in vistas.Values) if (v) Destroy(v.transform.parent ? v.transform.parent.gameObject : v.gameObject);
            vistas.Clear();
            if (anclaNueva != null) { if (pinNuevo) pinNuevo.transform.SetParent(null, false); Destroy(anclaNueva.gameObject); anclaNueva = null; }
            if (pinNuevo) pinNuevo.SetActive(false);
        }
    }
}
