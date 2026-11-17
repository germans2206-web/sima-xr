-- =====================================================================
-- SIMA · Estructura de planta inicial (opcional)
-- Cargá esto sólo si querés arrancar el servidor con la ruta ya armada.
-- Si no lo corrés, la primera sincronización sube la que tengas local.
--   wrangler d1 execute sima-db --remote --file=./semilla.sql
--
-- Carga sólo Planta 2, a propósito: Planta 2 y Planta 8 nunca comparten
-- estructura, así que Planta 8 queda vacía y se arma por separado desde
-- Configuración (con Planta 8 seleccionada arriba a la derecha). Si
-- querés precargar Planta 8 también, copiá el bloque de abajo cambiando
-- 'planta2' por 'planta8' con los sectores que correspondan.
-- =====================================================================
DELETE FROM estructura WHERE planta = 'planta2';

INSERT INTO estructura (planta, area, orden, sector, subs) VALUES
('planta2','caliente',0,'Noqueo y sangría','["Cajón de noqueo","Riel de sangrado","Playa de sangría"]'),
('planta2','caliente',1,'Playa de faena','["Desollado","Corte de patas y cabeza","Eviscerado","Serrado de canal","Inspección veterinaria"]'),
('planta2','caliente',2,'Menudencias','["Vísceras rojas","Vísceras verdes","Mondonguería"]'),
('planta2','caliente',3,'Cuereado','["Salado de cueros","Depósito de cueros"]'),
('planta2','caliente',4,'Lavado de canal','[]'),

('planta2','fria',0,'Oreo','["Cámara de oreo 1","Cámara de oreo 2"]'),
('planta2','fria',1,'Cámaras de frío','["Cámara de frío 1","Cámara de frío 2","Antecámara"]'),
('planta2','fria',2,'Despostada','["Despostada delantero","Despostada trasero","Sala de recorte"]'),
('planta2','fria',3,'Empaque','["Envasado al vacío","Termoencogido","Encajonado y etiquetado"]'),
('planta2','fria',4,'Túnel de congelado','["Túnel 1","Túnel 2"]'),
('planta2','fria',5,'Cámara de congelados','[]'),
('planta2','fria',6,'Expedición','["Antesala de expedición","Muelle de carga refrigerado"]'),

('planta2','exteriores',0,'Corrales y desembarcadero','["Manga de desembarque","Corrales de encierre","Bebederos","Baño de aspersión"]'),
('planta2','exteriores',1,'Playa de camiones','["Zona de carga","Zona de descarga","Lavadero de camiones"]'),
('planta2','exteriores',2,'Sala de máquinas','["Sala de compresores","Sala de calderas","Tablero eléctrico general"]'),
('planta2','exteriores',3,'Tratamiento de efluentes','["Piletas de tratamiento","Rejas y desarenador"]'),
('planta2','exteriores',4,'Depósitos','["Depósito de insumos","Depósito de envases","Depósito de químicos"]'),
('planta2','exteriores',5,'Servicios al personal','["Vestuarios","Sanitarios","Comedor"]'),
('planta2','exteriores',6,'Perímetro','["Perímetro norte","Perímetro sur","Perímetro este","Perímetro oeste"]');
