-- =====================================================================
-- SIMA · Esquema de base de datos (Cloudflare D1 / SQLite)
-- Ejecutar:  wrangler d1 execute sima-db --remote --file=./schema.sql
-- =====================================================================

-- Hallazgos levantados en planta -------------------------------------
CREATE TABLE IF NOT EXISTS levantamientos (
  id           TEXT PRIMARY KEY,      -- LV-1046
  modo         TEXT,                  -- 'recorrido' | 'libre'
  rec          TEXT,                  -- recorrido de origen (puede ser NULL)
  recs         TEXT,                  -- JSON: recorridos en los que aparece (arrastre)
  planta       TEXT DEFAULT 'planta2', -- 'planta2' | 'planta8'
  area         TEXT,                  -- 'fria' | 'caliente' | 'exteriores'
  sector       TEXT,
  subsector    TEXT,
  cat          TEXT,                  -- tipo de hallazgo
  sev          TEXT,                  -- critica | alta | media | baja
  descripcion  TEXT,
  estado       TEXT,                  -- detectado | programado | en_ejecucion | pendiente_verificacion | cerrado
  fecha_det    TEXT,                  -- YYYY-MM-DD
  det_by       TEXT,
  orden_sap    TEXT,
  foto_det     TEXT,                  -- clave/URL en R2
  foto_ejec    TEXT,
  foto_val     TEXT,
  prog         TEXT,                  -- JSON {tecnicos:[{n,lg}], fecha, by}
  ejec         TEXT,                  -- JSON {ini,fin,hIni,hFin,legajo,by}
  val          TEXT,                  -- JSON {fecha,by,resultado,motivo}
  hist         TEXT,                  -- JSON [{e,by,d,n}]
  disciplina   TEXT,                  -- civil | electrico | mecanico | otro
  cal          TEXT,                  -- JSON {fecha,by}: verificación de Control de Calidad (no cambia el estado)
  ra           TEXT,                  -- JSON {metodo,lat,lon,acc,rumbo,dist,...}: marca de RA y ubicación de la NC
  actualizado  TEXT                   -- ISO 8601 · resuelve conflictos (gana el más nuevo)
);

-- Los índices evitan escaneos completos de tabla. Importante: D1 cobra
-- "filas leídas" por filas ESCANEADAS, no devueltas.
CREATE INDEX IF NOT EXISTS idx_lev_estado      ON levantamientos(estado);
CREATE INDEX IF NOT EXISTS idx_lev_rec         ON levantamientos(rec);
CREATE INDEX IF NOT EXISTS idx_lev_fecha       ON levantamientos(fecha_det);
CREATE INDEX IF NOT EXISTS idx_lev_area        ON levantamientos(area, sector);
CREATE INDEX IF NOT EXISTS idx_lev_actualizado ON levantamientos(actualizado);
CREATE INDEX IF NOT EXISTS idx_lev_planta      ON levantamientos(planta);

-- Recorridos quincenales ----------------------------------------------
CREATE TABLE IF NOT EXISTS recorridos (
  id          TEXT PRIMARY KEY,       -- REC-005
  fecha       TEXT,
  by_user     TEXT,
  estado      TEXT,                   -- en_curso | cerrado
  sectores    TEXT,                   -- JSON ['fria|Oreo', ...]
  planta      TEXT DEFAULT 'planta2', -- 'planta2' | 'planta8'
  actualizado TEXT
);
CREATE INDEX IF NOT EXISTS idx_rec_fecha       ON recorridos(fecha);
CREATE INDEX IF NOT EXISTS idx_rec_actualizado ON recorridos(actualizado);

-- Estructura de planta: Área principal → Sector → Subsector ------------
-- Cada planta tiene la suya propia: Planta 2 y Planta 8 nunca comparten
-- áreas, sectores ni subsectores.
CREATE TABLE IF NOT EXISTS estructura (
  planta TEXT NOT NULL DEFAULT 'planta2',
  area   TEXT NOT NULL,
  orden  INTEGER NOT NULL,
  sector TEXT NOT NULL,
  subs   TEXT,                        -- JSON ['Cámara de frío 1', ...]
  PRIMARY KEY (planta, area, sector)
);

-- Padrón de técnicos -----------------------------------------------------
-- También separado por planta: un técnico cargado en Planta 2 no aparece
-- en Planta 8, aunque el mismo legajo exista en ambas por separado.
CREATE TABLE IF NOT EXISTS tecnicos (
  planta TEXT NOT NULL DEFAULT 'planta2',
  legajo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  orden  INTEGER DEFAULT 0,
  PRIMARY KEY (planta, legajo)
);

-- Contadores y metadatos ----------------------------------------------
CREATE TABLE IF NOT EXISTS meta (clave TEXT PRIMARY KEY, valor TEXT);
INSERT OR IGNORE INTO meta (clave, valor) VALUES ('seq', '1046');
INSERT OR IGNORE INTO meta (clave, valor) VALUES ('recSeq', '5');

-- Bitácora de acceso (quién tocó qué) ----------------------------------
CREATE TABLE IF NOT EXISTS auditoria (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      TEXT,
  email   TEXT,
  accion  TEXT,
  destino TEXT
);
CREATE INDEX IF NOT EXISTS idx_aud_ts ON auditoria(ts);

-- Usuarios y contraseñas (login propio de la app) ----------------------
CREATE TABLE IF NOT EXISTS usuarios (
  email    TEXT PRIMARY KEY,      -- en minúsculas
  nombre   TEXT NOT NULL,
  rol      TEXT NOT NULL,         -- inspeccion | mantenimiento | calidad
  hash     TEXT NOT NULL,         -- PBKDF2 derivado, en base64
  sal      TEXT NOT NULL,         -- salt aleatorio, en base64
  activo   INTEGER NOT NULL DEFAULT 1,
  creado   TEXT,
  creado_por TEXT,
  plantas  TEXT NOT NULL DEFAULT '["planta2","planta8"]', -- JSON: plantas habilitadas para este usuario
  legajo   TEXT                   -- legajo del padrón de técnicos (rol mantenimiento): filtra "sus" trabajos
);
