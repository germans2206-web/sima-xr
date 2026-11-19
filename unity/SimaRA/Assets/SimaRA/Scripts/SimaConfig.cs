// SIMA RA · Configuración de la app (un asset en Assets/SimaRA/Config).
using UnityEngine;

namespace SimaRA
{
    [CreateAssetMenu(fileName = "SimaConfig", menuName = "SIMA RA/Configuración")]
    public class SimaConfig : ScriptableObject
    {
        [Tooltip("Dirección de SIMA RA publicada en Cloudflare.")]
        public string baseUrl = "https://sima-ra.pages.dev";

        [Tooltip("Planta por defecto (planta2 | planta8). Vacío = todas las habilitadas para el usuario.")]
        public string planta = "planta2";

        [Tooltip("Días que dura cada ancla en la nube. Con autorización sin clave (keyless) se puede hasta 365.")]
        [Range(1, 365)] public int ttlDias = 365;

        [Tooltip("Si al reconocer un ancla le quedan menos días que esto, la app la vuelve a subir.")]
        [Range(1, 120)] public int renovarSiQuedanDias = 30;

        [Tooltip("Cuántas anclas se buscan a la vez (ARCore tiene un tope; con menos, se reconocen más rápido).")]
        [Range(1, 40)] public int maxResolverAlaVez = 20;

        [Tooltip("Segundos máximos buscando un ancla antes de darla por no encontrada en esta pasada.")]
        public float tiempoMaxResolver = 45f;
    }
}
