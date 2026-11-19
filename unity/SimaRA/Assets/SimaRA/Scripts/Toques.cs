// SIMA RA · Toques en pantalla, con el sistema de entrada nuevo o el clásico.
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;

namespace SimaRA
{
    public static class Toques
    {
        public static bool Tap(out Vector2 pos)
        {
#if ENABLE_INPUT_SYSTEM
            var ts = UnityEngine.InputSystem.Touchscreen.current;
            if (ts != null && ts.primaryTouch.press.wasPressedThisFrame) { pos = ts.primaryTouch.position.ReadValue(); return true; }
            var m = UnityEngine.InputSystem.Mouse.current;
            if (m != null && m.leftButton.wasPressedThisFrame) { pos = m.position.ReadValue(); return true; }
#else
            if (Input.touchCount > 0 && Input.GetTouch(0).phase == TouchPhase.Began) { pos = Input.GetTouch(0).position; return true; }
            if (Input.GetMouseButtonDown(0)) { pos = Input.mousePosition; return true; }
#endif
            pos = default; return false;
        }

        static readonly List<RaycastResult> res = new List<RaycastResult>();
        /// ¿El toque cayó sobre un botón o panel? (para no clavar el pin sin querer)
        public static bool SobreUI(Vector2 pos)
        {
            if (EventSystem.current == null) return false;
            var p = new PointerEventData(EventSystem.current) { position = pos };
            res.Clear(); EventSystem.current.RaycastAll(p, res);
            return res.Count > 0;
        }
    }
}
