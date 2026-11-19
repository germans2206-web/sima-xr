// SIMA RA · Datos que la app recibe de /api/ra/anclas y reglas de la tarjeta.
using System;
using System.Globalization;
using UnityEngine;

namespace SimaRA
{
    [Serializable]
    public class NcAncla
    {
        public string id, planta, area, sector, subsector, cat, desc, estado, fechaDet, fechaProg, fechaCierre, anclaId, anclaVence;
        public double lat, lon;
        public int rep;
    }

    [Serializable] public class RespuestaAnclas { public NcAncla[] ncs; public string hoy; }
    [Serializable] public class RespuestaLogin { public bool ok; public string email, nombre, rol; public string[] plantas; public string error; }

    /// Mismo lenguaje que la web: señalética de seguridad ISO 7010.
    public enum Grupo { Pendiente, Programada, Resuelta }

    public static class Senaletica
    {
        public static readonly Color Rojo = Hex("#E5352B");
        public static readonly Color Amarillo = Hex("#F2B705");
        public static readonly Color Verde = Hex("#1E9E5A");
        public static readonly Color Tinta = Hex("#14130F");
        public static readonly Color Papel = Hex("#FBFAF6");
        public static readonly Color AmarilloOscuro = Hex("#8A6800");

        public static Grupo GrupoDe(string estado)
        {
            switch (estado)
            {
                case "cerrado": return Grupo.Resuelta;
                case "programado":
                case "en_ejecucion":
                case "pendiente_verificacion": return Grupo.Programada;
                default: return Grupo.Pendiente;
            }
        }
        public static Color ColorDe(Grupo g) => g == Grupo.Resuelta ? Verde : g == Grupo.Programada ? Amarillo : Rojo;
        public static Color TextoSobre(Grupo g) => g == Grupo.Programada ? Tinta : Color.white;
        public static string Titulo(Grupo g) => g == Grupo.Resuelta ? "Resuelta" : g == Grupo.Programada ? "Programada" : "Pendiente";

        public static string EstadoTexto(string e)
        {
            switch (e)
            {
                case "detectado": return "Detectado";
                case "programado": return "Programado";
                case "en_ejecucion": return "En ejecución";
                case "pendiente_verificacion": return "A verificar";
                case "cerrado": return "Cerrado";
                default: return e;
            }
        }

        public static DateTime? Fecha(string iso)
        {
            if (string.IsNullOrEmpty(iso) || iso.Length < 10) return null;
            if (DateTime.TryParseExact(iso.Substring(0, 10), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)) return d;
            return null;
        }
        public static string Corta(string iso) { var d = Fecha(iso); return d.HasValue ? $"{d.Value.Day}/{d.Value.Month}" : ""; }

        /// Días abierta (o que estuvo abierta, si ya se cerró).
        public static int? Dias(NcAncla n)
        {
            var det = Fecha(n.fechaDet); if (!det.HasValue) return null;
            var fin = GrupoDe(n.estado) == Grupo.Resuelta ? (Fecha(n.fechaCierre) ?? DateTime.Today) : DateTime.Today;
            return Math.Max(0, (int)Math.Round((fin - det.Value).TotalDays));
        }

        public static string LineaDias(NcAncla n)
        {
            var d = Dias(n); var g = GrupoDe(n.estado);
            if (!d.HasValue) return "";
            if (d.Value == 0 && g != Grupo.Resuelta) return "Abierta hoy";
            return $"{d.Value} {(d.Value == 1 ? "día" : "días")} {(g == Grupo.Resuelta ? "estuvo abierta" : "abierta")}";
        }

        public static string LineaExtra(NcAncla n)
        {
            var g = GrupoDe(n.estado);
            if (g == Grupo.Resuelta) return string.IsNullOrEmpty(n.fechaCierre) ? "Resuelta" : "Cerrada el " + Corta(n.fechaCierre);
            if (g == Grupo.Programada)
            {
                if (n.estado == "en_ejecucion") return "En ejecución" + (string.IsNullOrEmpty(n.fechaProg) ? "" : " · " + Corta(n.fechaProg));
                if (n.estado == "pendiente_verificacion") return "A verificar";
                return string.IsNullOrEmpty(n.fechaProg) ? "Programada" : "Programada para el " + Corta(n.fechaProg);
            }
            return "Sin programar";
        }

        public static string Lugar(NcAncla n) => string.IsNullOrEmpty(n.subsector) ? n.sector : n.sector + " › " + n.subsector;

        static Color Hex(string h) { ColorUtility.TryParseHtmlString(h, out var c); return c; }
    }
}
