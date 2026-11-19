// SIMA RA · Menú del editor: deja lista la escena en un clic.
//   SIMA RA → Preparar escena
// Parte de la escena de la plantilla "AR Mobile" de Unity 6 (que ya trae
// AR Session y XR Origin) y agrega lo que falta:
//   · ARRaycastManager, ARAnchorManager y ARPlaneManager en el XR Origin
//   · ARCore Extensions con Cloud Anchors activados
//   · el objeto "SIMA RA" con la app, la API y la configuración
//   · EventSystem para la interfaz
//   · el shader Unlit de URP incluido en la compilación (tarjetas y pin)
using Google.XR.ARCoreExtensions;
using Unity.XR.CoreUtils;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.Rendering;
using UnityEngine.XR.ARFoundation;

namespace SimaRA.Editor
{
    public static class SimaRASetup
    {
        const string CARPETA = "Assets/SimaRA/Config";

        [MenuItem("SIMA RA/Preparar escena")]
        public static void Preparar()
        {
            var sesion = Object.FindFirstObjectByType<ARSession>();
            var origen = Object.FindFirstObjectByType<XROrigin>();
            if (sesion == null || origen == null)
            {
                EditorUtility.DisplayDialog("SIMA RA", "Esta escena no tiene AR Session y XR Origin.\n\nAbrí la escena de ejemplo de la plantilla «AR Mobile» (o agregalos con GameObject → XR) y volvé a usar este menú.", "Entendido");
                return;
            }
            var camara = origen.Camera;
            var camMgr = camara.GetComponent<ARCameraManager>();

            var raycast = Asegurar<ARRaycastManager>(origen.gameObject);
            var anclas = Asegurar<ARAnchorManager>(origen.gameObject);
            Asegurar<ARPlaneManager>(origen.gameObject);

            if (!AssetDatabase.IsValidFolder(CARPETA)) AssetDatabase.CreateFolder("Assets/SimaRA", "Config");

            // --- ARCore Extensions con Cloud Anchors ---
            var cfgExt = Cargar<ARCoreExtensionsConfig>(CARPETA + "/ARCoreExtensionsConfig.asset");
            cfgExt.CloudAnchorMode = CloudAnchorMode.Enabled;
            EditorUtility.SetDirty(cfgExt);
            var ext = Object.FindFirstObjectByType<ARCoreExtensions>();
            if (ext == null) ext = new GameObject("ARCore Extensions").AddComponent<ARCoreExtensions>();
            ext.Session = sesion; ext.Origin = origen; ext.CameraManager = camMgr; ext.ARCoreExtensionsConfig = cfgExt;
            EditorUtility.SetDirty(ext);

            // --- Configuración de SIMA ---
            var cfg = Cargar<SimaConfig>(CARPETA + "/SimaConfig.asset");

            // --- Objeto de la app ---
            var app = Object.FindFirstObjectByType<SimaRAApp>();
            if (app == null) app = new GameObject("SIMA RA").AddComponent<SimaRAApp>();
            var go = app.gameObject;
            var api = Asegurar<SimaApi>(go); api.config = cfg;
            var nube = Asegurar<CloudAnchorService>(go); nube.config = cfg; nube.anchorManager = anclas;
            var ui = Asegurar<AppUI>(go);
            app.config = cfg; app.api = api; app.nube = nube; app.ui = ui; app.raycast = raycast; app.anclas = anclas; app.camaraAR = camara;
            if (!camara.CompareTag("MainCamera")) camara.tag = "MainCamera";
            EditorUtility.SetDirty(app);

            // --- EventSystem para la interfaz ---
            if (Object.FindFirstObjectByType<EventSystem>() == null)
            {
                var es = new GameObject("EventSystem", typeof(EventSystem));
#if ENABLE_INPUT_SYSTEM
                es.AddComponent<UnityEngine.InputSystem.UI.InputSystemUIInputModule>();
#else
                es.AddComponent<StandaloneInputModule>();
#endif
            }

            IncluirShader("Universal Render Pipeline/Unlit");

            // --- Ajustes del reproductor ---
            PlayerSettings.productName = "SIMA RA";
            if (PlayerSettings.GetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.Android).StartsWith("com.DefaultCompany") ||
                string.IsNullOrEmpty(PlayerSettings.GetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.Android)))
                PlayerSettings.SetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.Android, "com.simara.app");
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel24;
            PlayerSettings.iOS.cameraUsageDescription = "SIMA RA usa la cámara para mostrar las etiquetas de no conformidades en la planta.";
            PlayerSettings.iOS.locationUsageDescription = "SIMA RA guarda la ubicación aproximada de cada no conformidad.";

            EditorSceneManager.MarkSceneDirty(sesion.gameObject.scene);
            AssetDatabase.SaveAssets();
            Selection.activeObject = cfg;
            EditorUtility.DisplayDialog("SIMA RA", "Escena lista.\n\nFaltan dos pasos (ver README):\n1. Project Settings → XR Plug-in Management → ARCore Extensions: autorización «Keyless» (Android).\n2. Guardar la escena (Ctrl+S) y compilar en un celular.", "Listo");
        }

        // (sin ??: en el editor Unity devuelve objetos «nulos falsos» que ?? no detecta)
        static T Asegurar<T>(GameObject go) where T : Component { var c = go.GetComponent<T>(); return c ? c : go.AddComponent<T>(); }

        static T Cargar<T>(string ruta) where T : ScriptableObject
        {
            var a = AssetDatabase.LoadAssetAtPath<T>(ruta);
            if (a != null) return a;
            a = ScriptableObject.CreateInstance<T>(); AssetDatabase.CreateAsset(a, ruta); return a;
        }

        static void IncluirShader(string nombre)
        {
            var sh = Shader.Find(nombre); if (sh == null) return;
            var gs = AssetDatabase.LoadAssetAtPath<GraphicsSettings>("ProjectSettings/GraphicsSettings.asset");
            var so = new SerializedObject(gs); var lista = so.FindProperty("m_AlwaysIncludedShaders");
            for (int i = 0; i < lista.arraySize; i++) if (lista.GetArrayElementAtIndex(i).objectReferenceValue == sh) return;
            lista.InsertArrayElementAtIndex(lista.arraySize); lista.GetArrayElementAtIndex(lista.arraySize - 1).objectReferenceValue = sh;
            so.ApplyModifiedProperties();
        }
    }
}
