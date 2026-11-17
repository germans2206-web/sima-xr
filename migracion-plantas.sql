-- =====================================================================
-- SIMA · Migración: división por plantas (Planta 2 / Planta 8)
-- Ejecutar UNA SOLA VEZ, sólo si tu base ya existía antes de este cambio
-- (si es una base nueva, schema.sql ya crea las columnas directamente
-- y este archivo no hace falta).
--
-- Se puede correr por línea de comandos:
--   wrangler d1 execute sima-db --remote --file=./migracion-plantas.sql
-- o pegando cada línea en la consola SQL de D1 en el panel de Cloudflare
-- (Workers & Pages → D1 → sima-db → Console).
-- =====================================================================

-- Parte A · hallazgos y recorridos ------------------------------------
ALTER TABLE levantamientos ADD COLUMN planta TEXT DEFAULT 'planta2';
ALTER TABLE recorridos     ADD COLUMN planta TEXT DEFAULT 'planta2';

CREATE INDEX IF NOT EXISTS idx_lev_planta ON levantamientos(planta);

-- Todo lo que ya existía queda asignado a Planta 2 (podés reasignarlo
-- editando el hallazgo, o desde una consulta SQL puntual si preferís).
UPDATE levantamientos SET planta='planta2' WHERE planta IS NULL;
UPDATE recorridos     SET planta='planta2' WHERE planta IS NULL;

-- Parte B · estructura de áreas/sectores y padrón de técnicos ----------
-- Estas dos tablas usaban (área, sector) y (legajo) como clave única y
-- compartida entre plantas. SQLite no permite agregarle una columna a una
-- clave primaria con ALTER TABLE, así que hay que recrear la tabla: se
-- renombra la vieja, se crea la nueva con "planta" en la clave primaria,
-- se copia todo lo que ya estaba (etiquetado como 'planta2', igual que los
-- hallazgos) y se borra la vieja. Planta 8 arranca vacía — se carga su
-- propia estructura y su propio padrón desde Configuración, con Planta 8
-- seleccionada arriba a la derecha.

ALTER TABLE estructura RENAME TO estructura_old;
CREATE TABLE estructura (
  planta TEXT NOT NULL DEFAULT 'planta2',
  area   TEXT NOT NULL,
  orden  INTEGER NOT NULL,
  sector TEXT NOT NULL,
  subs   TEXT,
  PRIMARY KEY (planta, area, sector)
);
INSERT INTO estructura (planta, area, orden, sector, subs)
  SELECT 'planta2', area, orden, sector, subs FROM estructura_old;
DROP TABLE estructura_old;

ALTER TABLE tecnicos RENAME TO tecnicos_old;
CREATE TABLE tecnicos (
  planta TEXT NOT NULL DEFAULT 'planta2',
  legajo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  orden  INTEGER DEFAULT 0,
  PRIMARY KEY (planta, legajo)
);
INSERT INTO tecnicos (planta, legajo, nombre, orden)
  SELECT 'planta2', legajo, nombre, orden FROM tecnicos_old;
DROP TABLE tecnicos_old;

-- Parte C · usuarios ligados a una o más plantas (cambios 10-10-26) ---
-- Cada usuario pasa a tener una lista de plantas habilitadas (antes
-- entraba a cualquiera) y, opcionalmente, su legajo del padrón de
-- técnicos — así Mantenimiento ve sólo sus propios trabajos asignados.
-- Los usuarios ya existentes quedan habilitados para AMBAS plantas (el
-- comportamiento de antes), así nadie se queda afuera por la migración;
-- el admin ajusta el acceso de cada uno después, desde Configuración.
ALTER TABLE usuarios ADD COLUMN plantas TEXT NOT NULL DEFAULT '["planta2","planta8"]';
ALTER TABLE usuarios ADD COLUMN legajo TEXT;
UPDATE usuarios SET plantas='["planta2","planta8"]' WHERE plantas IS NULL;

-- Parte D · disciplina y verificación de Calidad (cambios 12-10-26) -----
-- Desde esta versión la API agrega estas columnas sola al arrancar, así
-- que este bloque es sólo un respaldo por si preferís hacerlo a mano.
-- Si ya existen, cada línea falla con "duplicate column name": es normal.
ALTER TABLE levantamientos ADD COLUMN disciplina TEXT;
ALTER TABLE levantamientos ADD COLUMN cal TEXT;
