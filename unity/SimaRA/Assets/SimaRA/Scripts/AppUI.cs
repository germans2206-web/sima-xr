// SIMA RA · Interfaz en pantalla, armada por código (no depende de prefabs).
// Pantallas: Ingreso · Inicio · RA (barra superior, calidad del escaneo,
// botón principal). Botones grandes (≥ 64 px) para usar con guantes.
using System;
using TMPro;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.UI;

namespace SimaRA
{
    public class AppUI : MonoBehaviour
    {
        public RectTransform raiz, pIngreso, pInicio, pRA;
        public TMP_InputField email, pass;
        public TextMeshProUGUI errIngreso, hola, estadoInicio, raTitulo, raEstado, calidadTexto;
        public Button bIngresar, bMarcar, bVer, bSalir, bCerrarRA, bAccion;
        public TextMeshProUGUI bAccionTexto;
        public TMP_Dropdown sector;
        public Image calidadBarra; public RectTransform calidadCaja;
        TMP_DefaultControls.Resources rec;

        static readonly Color Fondo = new Color(.06f, .07f, .08f, 1f), Panel = new Color(.11f, .12f, .14f, 1f);

        public void Construir()
        {
            var cgo = new GameObject("UI", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            cgo.transform.SetParent(transform, false);
            var c = cgo.GetComponent<Canvas>(); c.renderMode = RenderMode.ScreenSpaceOverlay; c.sortingOrder = 100;
            var sc = cgo.GetComponent<CanvasScaler>(); sc.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize; sc.referenceResolution = new Vector2(1080, 1920); sc.matchWidthOrHeight = .5f;
            raiz = (RectTransform)cgo.transform;
            rec = new TMP_DefaultControls.Resources();

            // --- Ingreso ---
            pIngreso = Capa("Ingreso", Fondo);
            Titulo(pIngreso, "SIMA RA", 96, -260);
            Etiqueta(pIngreso, "Etiquetas de no conformidades fijas en la planta", 34, -380, new Color(.75f, .78f, .8f));
            email = Campo(pIngreso, "Correo", -560, TMP_InputField.ContentType.EmailAddress);
            pass = Campo(pIngreso, "Contraseña", -720, TMP_InputField.ContentType.Password);
            bIngresar = Boton(pIngreso, "Iniciar sesión", -900, Senaletica.Amarillo, Senaletica.Tinta, out _);
            errIngreso = Etiqueta(pIngreso, "", 32, -1040, Senaletica.Rojo);

            // --- Inicio ---
            pInicio = Capa("Inicio", Fondo);
            hola = Titulo(pInicio, "Hola", 64, -220);
            estadoInicio = Etiqueta(pInicio, "", 34, -330, new Color(.75f, .78f, .8f));
            bMarcar = Boton(pInicio, "Marcar NC en RA", -520, Senaletica.Rojo, Color.white, out _);
            Etiqueta(pInicio, "Ver etiquetas de", 32, -690, new Color(.75f, .78f, .8f));
            sector = Desplegable(pInicio, -790);
            bVer = Boton(pInicio, "Ver etiquetas", -950, Senaletica.Amarillo, Senaletica.Tinta, out _);
            bSalir = Boton(pInicio, "Cerrar sesión", -1700, Panel, Color.white, out _);

            // --- RA (transparente, sobre la cámara) ---
            pRA = Capa("RA", new Color(0, 0, 0, 0));
            pRA.GetComponent<Image>().raycastTarget = false;
            var barra = Caja(pRA, new Vector2(0, 1), new Vector2(1, 1), new Vector2(0, -260), new Vector2(0, 0), new Color(0, 0, 0, .55f));
            raTitulo = Etiqueta(barra, "", 44, -60, Color.white); raTitulo.fontStyle = FontStyles.Bold;
            raEstado = Etiqueta(barra, "", 30, -140, new Color(1, 1, 1, .9f)); ((RectTransform)raEstado.transform).sizeDelta = new Vector2(-220, 110); raEstado.enableWordWrapping = true;
            bCerrarRA = BotonEn(barra, "×", new Vector2(1, 1), new Vector2(-90, -90), new Vector2(130, 130), new Color(1, 1, 1, .2f), Color.white, out _);
            calidadCaja = Caja(pRA, new Vector2(0, 0), new Vector2(1, 0), new Vector2(60, 330), new Vector2(-60, 400), new Color(1, 1, 1, .2f));
            calidadBarra = Caja(calidadCaja, Vector2.zero, new Vector2(0, 1), Vector2.zero, Vector2.zero, Senaletica.Rojo).GetComponent<Image>();
            calidadTexto = Etiqueta(pRA, "", 30, 0, Color.white); var ct = (RectTransform)calidadTexto.transform; ct.anchorMin = ct.anchorMax = new Vector2(.5f, 0); ct.anchoredPosition = new Vector2(0, 450);
            bAccion = BotonEn(pRA, "", new Vector2(.5f, 0), new Vector2(0, 170), new Vector2(960, 150), Senaletica.Amarillo, Senaletica.Tinta, out bAccionTexto);

            Mostrar(pIngreso);
        }

        public void Mostrar(RectTransform p) { foreach (var x in new[] { pIngreso, pInicio, pRA }) x.gameObject.SetActive(x == p); }

        public void Calidad(float v01, string texto, Color c)
        {
            var rt = calidadBarra.rectTransform; rt.anchorMax = new Vector2(Mathf.Clamp01(v01), 1); calidadBarra.color = c; calidadTexto.text = texto;
        }
        public void VerCalidad(bool si) { calidadCaja.gameObject.SetActive(si); calidadTexto.gameObject.SetActive(si); }
        public void Accion(string texto, bool activo, Color fondo, Color letra)
        {
            bAccion.gameObject.SetActive(!string.IsNullOrEmpty(texto));
            bAccionTexto.text = texto; bAccionTexto.color = letra; bAccion.GetComponent<Image>().color = fondo; bAccion.interactable = activo;
        }
        public static void Click(Button b, UnityAction a) { b.onClick.RemoveAllListeners(); b.onClick.AddListener(a); }

        // ---------- fábrica de controles ----------
        RectTransform Capa(string n, Color c)
        {
            var go = new GameObject(n, typeof(RectTransform), typeof(Image)); var rt = (RectTransform)go.transform; rt.SetParent(raiz, false);
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one; rt.offsetMin = rt.offsetMax = Vector2.zero; go.GetComponent<Image>().color = c; return rt;
        }
        RectTransform Caja(Transform p, Vector2 aMin, Vector2 aMax, Vector2 oMin, Vector2 oMax, Color c)
        {
            var go = new GameObject("Caja", typeof(RectTransform), typeof(Image)); var rt = (RectTransform)go.transform; rt.SetParent(p, false);
            rt.anchorMin = aMin; rt.anchorMax = aMax; rt.offsetMin = oMin; rt.offsetMax = oMax; go.GetComponent<Image>().color = c; return rt;
        }
        TextMeshProUGUI Titulo(Transform p, string s, float tam, float y) { var t = Etiqueta(p, s, tam, y, Color.white); t.fontStyle = FontStyles.Bold; return t; }
        TextMeshProUGUI Etiqueta(Transform p, string s, float tam, float y, Color c)
        {
            var go = new GameObject("Texto", typeof(RectTransform), typeof(TextMeshProUGUI)); var rt = (RectTransform)go.transform; rt.SetParent(p, false);
            rt.anchorMin = new Vector2(0, 1); rt.anchorMax = new Vector2(1, 1); rt.pivot = new Vector2(.5f, 1); rt.sizeDelta = new Vector2(-120, tam * 2.6f); rt.anchoredPosition = new Vector2(0, y);
            var t = go.GetComponent<TextMeshProUGUI>(); t.text = s; t.fontSize = tam; t.color = c; t.alignment = TextAlignmentOptions.Center; t.enableWordWrapping = true; t.raycastTarget = false; return t;
        }
        TMP_InputField Campo(Transform p, string ph, float y, TMP_InputField.ContentType tipo)
        {
            var go = TMP_DefaultControls.CreateInputField(rec); var rt = (RectTransform)go.transform; rt.SetParent(p, false);
            rt.anchorMin = rt.anchorMax = new Vector2(.5f, 1); rt.pivot = new Vector2(.5f, 1); rt.sizeDelta = new Vector2(900, 130); rt.anchoredPosition = new Vector2(0, y);
            var f = go.GetComponent<TMP_InputField>(); f.contentType = tipo; f.pointSize = 42;
            ((TextMeshProUGUI)f.placeholder).text = ph; return f;
        }
        TMP_Dropdown Desplegable(Transform p, float y)
        {
            var go = TMP_DefaultControls.CreateDropdown(rec); var rt = (RectTransform)go.transform; rt.SetParent(p, false);
            rt.anchorMin = rt.anchorMax = new Vector2(.5f, 1); rt.pivot = new Vector2(.5f, 1); rt.sizeDelta = new Vector2(900, 120); rt.anchoredPosition = new Vector2(0, y);
            var d = go.GetComponent<TMP_Dropdown>(); d.captionText.fontSize = 40; d.itemText.fontSize = 40; return d;
        }
        Button Boton(Transform p, string s, float y, Color fondo, Color letra, out TextMeshProUGUI txt)
            => BotonEn(p, s, new Vector2(.5f, 1), new Vector2(0, y), new Vector2(900, 140), fondo, letra, out txt, new Vector2(.5f, 1));
        Button BotonEn(Transform p, string s, Vector2 ancla, Vector2 pos, Vector2 tam, Color fondo, Color letra, out TextMeshProUGUI txt, Vector2? pivot = null)
        {
            var go = TMP_DefaultControls.CreateButton(rec); var rt = (RectTransform)go.transform; rt.SetParent(p, false);
            rt.anchorMin = rt.anchorMax = ancla; rt.pivot = pivot ?? new Vector2(.5f, .5f); rt.sizeDelta = tam; rt.anchoredPosition = pos;
            go.GetComponent<Image>().color = fondo;
            txt = go.GetComponentInChildren<TextMeshProUGUI>(); txt.text = s; txt.fontSize = 46; txt.color = letra; txt.fontStyle = FontStyles.Bold;
            return go.GetComponent<Button>();
        }
    }
}
