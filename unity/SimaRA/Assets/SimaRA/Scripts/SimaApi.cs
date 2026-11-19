// SIMA RA · Cliente de la API de SIMA (Cloudflare Pages Functions).
// Usa el mismo login que la web: correo + contraseña → cookie de sesión
// firmada (sima_session). La cookie se guarda en el celular para no pedir
// la contraseña cada vez.
using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace SimaRA
{
    public class SimaApi : MonoBehaviour
    {
        public SimaConfig config;
        const string K_COOKIE = "sima.ra.cookie", K_NOMBRE = "sima.ra.nombre", K_ROL = "sima.ra.rol";

        public string Cookie { get; private set; }
        public string Nombre => PlayerPrefs.GetString(K_NOMBRE, "");
        public string Rol => PlayerPrefs.GetString(K_ROL, "");
        public bool TieneSesion => !string.IsNullOrEmpty(Cookie);
        public bool EsInspector => Rol == "inspeccion";

        void Awake() { Cookie = PlayerPrefs.GetString(K_COOKIE, ""); }

        string Url(string ruta) => config.baseUrl.TrimEnd('/') + "/api/" + ruta;

        public IEnumerator Login(string email, string pass, Action<bool, string> fin)
        {
            var cuerpo = JsonUtility.ToJson(new LoginDto { email = email.Trim().ToLowerInvariant(), password = pass });
            using var req = new UnityWebRequest(Url("login"), "POST")
            {
                uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(cuerpo)),
                downloadHandler = new DownloadHandlerBuffer(),
                timeout = 25
            };
            req.SetRequestHeader("Content-Type", "application/json");
            yield return req.SendWebRequest();
            if (req.result != UnityWebRequest.Result.Success && req.responseCode == 0) { fin(false, "Sin conexión con SIMA. Revisá el wifi o los datos."); yield break; }
            var r = Parse<RespuestaLogin>(req.downloadHandler.text);
            if (req.responseCode != 200 || r == null || !r.ok) { fin(false, r?.error ?? "Correo o contraseña incorrectos."); yield break; }
            var set = req.GetResponseHeader("Set-Cookie") ?? req.GetResponseHeader("set-cookie") ?? "";
            var i = set.IndexOf("sima_session=", StringComparison.Ordinal);
            if (i < 0) { fin(false, "SIMA no devolvió la sesión. Probá de nuevo."); yield break; }
            var fin_ = set.IndexOf(';', i);
            Cookie = fin_ > i ? set.Substring(i, fin_ - i) : set.Substring(i);
            PlayerPrefs.SetString(K_COOKIE, Cookie);
            PlayerPrefs.SetString(K_NOMBRE, r.nombre ?? "");
            PlayerPrefs.SetString(K_ROL, r.rol ?? "");
            PlayerPrefs.Save();
            fin(true, null);
        }

        public void CerrarSesion()
        {
            Cookie = ""; PlayerPrefs.DeleteKey(K_COOKIE); PlayerPrefs.DeleteKey(K_NOMBRE); PlayerPrefs.DeleteKey(K_ROL); PlayerPrefs.Save();
        }

        /// NC con ancla en la nube (opcional: sólo un sector).
        public IEnumerator Anclas(string sector, Action<RespuestaAnclas, string> fin)
        {
            var q = "ra/anclas?";
            if (!string.IsNullOrEmpty(config.planta)) q += "planta=" + UnityWebRequest.EscapeURL(config.planta) + "&";
            if (!string.IsNullOrEmpty(sector)) q += "sector=" + UnityWebRequest.EscapeURL(sector);
            using var req = UnityWebRequest.Get(Url(q));
            req.timeout = 25;
            req.SetRequestHeader("Cookie", Cookie);
            yield return req.SendWebRequest();
            if (req.responseCode == 401) { CerrarSesion(); fin(null, "La sesión venció. Iniciá sesión de nuevo."); yield break; }
            if (req.result != UnityWebRequest.Result.Success) { fin(null, "No pude traer las NC: " + req.error); yield break; }
            fin(Parse<RespuestaAnclas>(req.downloadHandler.text), null);
        }

        /// Guarda el anclaId nuevo cuando se volvió a subir un ancla por vencer.
        public IEnumerator Renovar(string id, string anclaId, string vence, Action<bool> fin)
        {
            var cuerpo = JsonUtility.ToJson(new RenovarDto { id = id, anclaId = anclaId, anclaVence = vence });
            using var req = new UnityWebRequest(Url("ra/renovar"), "POST")
            {
                uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(cuerpo)),
                downloadHandler = new DownloadHandlerBuffer(),
                timeout = 25
            };
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("Cookie", Cookie);
            yield return req.SendWebRequest();
            fin(req.responseCode == 200);
        }

        /// Abre la web de SIMA RA (formulario de carga o ficha) en el navegador.
        public void AbrirWeb(string query) => Application.OpenURL(config.baseUrl.TrimEnd('/') + "/?" + query);

        static T Parse<T>(string json) where T : class
        {
            try { return string.IsNullOrEmpty(json) ? null : JsonUtility.FromJson<T>(json); } catch { return null; }
        }

        [Serializable] class LoginDto { public string email, password; }
        [Serializable] class RenovarDto { public string id, anclaId, anclaVence; }
    }
}
