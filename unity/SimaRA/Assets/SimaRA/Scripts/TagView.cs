// SIMA RA · La tarjeta colgante en el espacio (mismo diseño que la web).
//   banda de color con el estado · número grande · tipo · días abierta ·
//   fecha programada/cierre · franja negra y amarilla si reincide.
// Cuelga 30 cm sobre el punto anclado, con un hilo hasta un punto en la falla,
// y gira para mirar siempre al celular (sólo en horizontal, no se "acuesta").
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace SimaRA
{
    public class TagView : MonoBehaviour
    {
        public NcAncla nc;
        Transform tarjeta; LineRenderer hilo; Transform cam;
        const float ALTO = 0.30f, ESCALA = 0.00055f;   // 520 px ≈ 29 cm de ancho

        public static TagView Crear(NcAncla nc, Transform padre)
        {
            var go = new GameObject("NC " + nc.id);
            go.transform.SetParent(padre, false);
            var t = go.AddComponent<TagView>(); t.nc = nc; t.Armar();
            return t;
        }

        void Armar()
        {
            var g = Senaletica.GrupoDe(nc.estado);
            var color = Senaletica.ColorDe(g);

            // Punto en la falla + hilo.
            var punto = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            Destroy(punto.GetComponent<Collider>());
            punto.transform.SetParent(transform, false); punto.transform.localScale = Vector3.one * 0.03f;
            punto.GetComponent<Renderer>().material = Mat(color);
            hilo = gameObject.AddComponent<LineRenderer>();
            hilo.positionCount = 2; hilo.startWidth = hilo.endWidth = 0.004f; hilo.useWorldSpace = false;
            hilo.material = Mat(Color.white);
            hilo.SetPosition(0, Vector3.zero); hilo.SetPosition(1, Vector3.up * ALTO);

            // Tarjeta (Canvas en el mundo).
            var cgo = new GameObject("Tarjeta", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler));
            tarjeta = cgo.transform; tarjeta.SetParent(transform, false);
            var canvas = cgo.GetComponent<Canvas>(); canvas.renderMode = RenderMode.WorldSpace; canvas.sortingOrder = 10;
            var rt = (RectTransform)tarjeta; rt.sizeDelta = new Vector2(520, nc.rep > 0 ? 420 : 360); rt.pivot = new Vector2(.5f, 0);
            tarjeta.localPosition = Vector3.up * ALTO; tarjeta.localScale = Vector3.one * ESCALA;
            var col = cgo.AddComponent<BoxCollider>(); col.size = new Vector3(rt.sizeDelta.x, rt.sizeDelta.y, 10); col.center = new Vector3(0, rt.sizeDelta.y / 2, 0);

            var fondo = Panel(tarjeta, "Fondo", Senaletica.Papel, 0, 0, 1, 1);
            var banda = Panel(fondo, "Banda", color, 0, 1, 1, 1); Alto(banda, 84, true);
            var ojo = Panel(banda, "Ojo", Senaletica.Papel, 0, .5f, 0, .5f); ((RectTransform)ojo).sizeDelta = new Vector2(30, 30); ((RectTransform)ojo).anchoredPosition = new Vector2(40, 0);
            Texto(banda, Senaletica.Titulo(g), 38, Senaletica.TextoSobre(g), FontStyles.Bold, new Vector2(72, 0), new Vector2(-20, 0), TextAlignmentOptions.MidlineLeft);

            float y = -100;
            Linea(fondo, nc.id, 64, Senaletica.Tinta, FontStyles.Bold, ref y, 70);
            Linea(fondo, Recortar(TipoTexto(nc), 28), 32, Senaletica.Tinta, FontStyles.Bold, ref y, 44);
            var dias = Senaletica.LineaDias(nc);
            Linea(fondo, dias, 36, g == Grupo.Programada ? Senaletica.AmarilloOscuro : color, FontStyles.Bold, ref y, 48);
            Linea(fondo, Recortar(Senaletica.LineaExtra(nc) + " · " + Senaletica.Lugar(nc), 40), 26, new Color(.33f, .33f, .3f), FontStyles.Normal, ref y, 40);

            if (nc.rep > 0)
            {
                var franja = Panel(fondo, "Reincide", Senaletica.Amarillo, 0, 0, 1, 0); Alto(franja, 70, false);
                var img = franja.GetComponent<Image>(); img.sprite = Rayas(); img.type = Image.Type.Tiled; img.color = Color.white;
                var et = Panel(franja, "Et", Senaletica.Amarillo, 0, .5f, 0, .5f); ((RectTransform)et).pivot = new Vector2(0, .5f);
                ((RectTransform)et).sizeDelta = new Vector2(360, 46); ((RectTransform)et).anchoredPosition = new Vector2(20, 0);
                Texto(et, $"Reincide · {nc.rep + 1} veces aquí", 28, Senaletica.Tinta, FontStyles.Bold, new Vector2(14, 0), new Vector2(-10, 0), TextAlignmentOptions.MidlineLeft);
            }
        }

        void LateUpdate()
        {
            if (cam == null) { var c = Camera.main; if (c) cam = c.transform; else return; }
            // Mira al celular girando sólo sobre el eje vertical del mundo.
            var dir = tarjeta.position - cam.position; dir.y = 0;
            if (dir.sqrMagnitude > 0.0001f) tarjeta.rotation = Quaternion.LookRotation(dir, Vector3.up);
            // El hilo siempre vertical, aunque el ancla esté en una pared.
            tarjeta.position = transform.position + Vector3.up * ALTO;
            hilo.useWorldSpace = true; hilo.SetPosition(0, transform.position); hilo.SetPosition(1, tarjeta.position);
            // Más lejos, un poco más grande, para que se pueda leer.
            var d = Vector3.Distance(cam.position, tarjeta.position);
            tarjeta.localScale = Vector3.one * ESCALA * Mathf.Clamp(d / 2.5f, 1f, 4f) / Mathf.Max(0.0001f, transform.lossyScale.x);
        }

        // ---- helpers de UI ----
        static string TipoTexto(NcAncla n) => !string.IsNullOrEmpty(n.desc) ? n.desc : (string.IsNullOrEmpty(n.cat) ? "No conformidad" : n.cat);
        static string Recortar(string s, int n) => string.IsNullOrEmpty(s) || s.Length <= n ? s : s.Substring(0, n - 1) + "…";
        static Transform Panel(Transform padre, string nombre, Color c, float x0, float y0, float x1, float y1)
        {
            var go = new GameObject(nombre, typeof(RectTransform), typeof(Image));
            var rt = (RectTransform)go.transform; rt.SetParent(padre, false);
            rt.anchorMin = new Vector2(x0, y0); rt.anchorMax = new Vector2(x1, y1); rt.offsetMin = rt.offsetMax = Vector2.zero;
            go.GetComponent<Image>().color = c; return go.transform;
        }
        static void Alto(Transform t, float h, bool arriba) { var rt = (RectTransform)t; rt.pivot = new Vector2(.5f, arriba ? 1 : 0); rt.sizeDelta = new Vector2(0, h); }
        static TextMeshProUGUI Texto(Transform padre, string s, float tam, Color c, FontStyles st, Vector2 offMin, Vector2 offMax, TextAlignmentOptions al)
        {
            var go = new GameObject("Texto", typeof(RectTransform), typeof(TextMeshProUGUI));
            var rt = (RectTransform)go.transform; rt.SetParent(padre, false);
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one; rt.offsetMin = offMin; rt.offsetMax = offMax;
            var t = go.GetComponent<TextMeshProUGUI>(); t.text = s; t.fontSize = tam; t.color = c; t.fontStyle = st; t.alignment = al; t.enableWordWrapping = false; t.overflowMode = TextOverflowModes.Ellipsis;
            return t;
        }
        static void Linea(Transform padre, string s, float tam, Color c, FontStyles st, ref float y, float alto)
        {
            var go = new GameObject("Linea", typeof(RectTransform), typeof(TextMeshProUGUI));
            var rt = (RectTransform)go.transform; rt.SetParent(padre, false);
            rt.anchorMin = new Vector2(0, 1); rt.anchorMax = new Vector2(1, 1); rt.pivot = new Vector2(0, 1);
            rt.sizeDelta = new Vector2(-56, alto); rt.anchoredPosition = new Vector2(28, y);
            var t = go.GetComponent<TextMeshProUGUI>(); t.text = s; t.fontSize = tam; t.color = c; t.fontStyle = st; t.enableWordWrapping = false; t.overflowMode = TextOverflowModes.Ellipsis;
            y -= alto;
        }
        static Material Mat(Color c) { var m = new Material(Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color")); m.color = c; return m; }
        static Sprite rayas;
        static Sprite Rayas()
        {
            if (rayas) return rayas;
            const int N = 64; var tx = new Texture2D(N, N) { wrapMode = TextureWrapMode.Repeat, filterMode = FilterMode.Bilinear };
            for (int x = 0; x < N; x++) for (int y = 0; y < N; y++) tx.SetPixel(x, y, ((x + y) / 16) % 2 == 0 ? Senaletica.Amarillo : new Color(.1f, .1f, .09f));
            tx.Apply();
            return rayas = Sprite.Create(tx, new Rect(0, 0, N, N), new Vector2(.5f, .5f), 100);
        }
    }
}
