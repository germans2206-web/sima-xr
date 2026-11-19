// SIMA RA · Anclas en la nube de ARCore (ARCore Extensions para AR Foundation).
//
// · Calidad del mapa: antes de subir un ancla, ARCore tiene que "ver" bien el
//   lugar desde varios ángulos. EstimateFeatureMapQualityForHosting dice si
//   alcanza (Insufficient → Sufficient → Good).
// · Subir (host): devuelve un anclaId que se guarda en SIMA.
// · Buscar (resolve): con el anclaId, ARCore reconoce el lugar y devuelve el
//   ancla en su posición real, aunque sea otro día u otro celular.
using System;
using System.Collections;
using Google.XR.ARCoreExtensions;
using UnityEngine;
using UnityEngine.XR.ARFoundation;

namespace SimaRA
{
    public class CloudAnchorService : MonoBehaviour
    {
        public ARAnchorManager anchorManager;
        public SimaConfig config;

        /// Calidad del lugar vista desde la cámara (para la barra "Escaneá alrededor").
        public FeatureMapQuality Calidad(Pose camara)
        {
            try { return anchorManager.EstimateFeatureMapQualityForHosting(camara); }
            catch { return FeatureMapQuality.Insufficient; }
        }

        public IEnumerator Subir(ARAnchor ancla, Action<string, string> fin)
        {
            var promesa = anchorManager.HostCloudAnchorAsync(ancla, config.ttlDias);
            yield return promesa;
            var r = promesa.Result;
            if (promesa.State == PromiseState.Done && r.CloudAnchorState == CloudAnchorState.Success)
                fin(r.CloudAnchorId, null);
            else
                fin(null, Explicar(r.CloudAnchorState));
        }

        public IEnumerator Buscar(string anclaId, Action<ARCloudAnchor, string> fin)
        {
            var promesa = anchorManager.ResolveCloudAnchorAsync(anclaId);
            var t0 = Time.realtimeSinceStartup;
            while (promesa.State == PromiseState.Pending)
            {
                if (Time.realtimeSinceStartup - t0 > config.tiempoMaxResolver) { promesa.Cancel(); fin(null, "No reconocido todavía"); yield break; }
                yield return null;
            }
            var r = promesa.Result;
            if (r.CloudAnchorState == CloudAnchorState.Success && r.Anchor != null) fin(r.Anchor, null);
            else fin(null, Explicar(r.CloudAnchorState));
        }

        public string VenceDesdeHoy() => DateTime.Today.AddDays(config.ttlDias).ToString("yyyy-MM-dd");

        /// Mensajes claros para el que está en planta (no códigos).
        public static string Explicar(CloudAnchorState e)
        {
            switch (e)
            {
                case CloudAnchorState.Success: return null;
                case CloudAnchorState.ErrorNotAuthorized: return "La app no está autorizada en Google Cloud (revisá la configuración keyless o la clave).";
                case CloudAnchorState.ErrorResourceExhausted: return "Se agotó el cupo de Google para hoy. Probá más tarde.";
                case CloudAnchorState.ErrorHostingDatasetProcessingFailed: return "El lugar no tiene suficientes detalles. Escaneá más alrededor de la falla, desde varios ángulos.";
                case CloudAnchorState.ErrorCloudIdNotFound: return "El ancla ya no existe (venció o se borró).";
                case CloudAnchorState.ErrorHostingServiceUnavailable: return "Sin conexión con Google. Revisá el wifi o los datos.";
                default: return "No se pudo (" + e + "). Probá de nuevo.";
            }
        }
    }
}
