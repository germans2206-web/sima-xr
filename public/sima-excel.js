/* =====================================================================
   SIMA · Exportación a Excel para seguimiento (06-11-26)
   ---------------------------------------------------------------------
   Genera un .xlsx con dos hojas:
     · Levantamientos: un renglón por hallazgo, con estado y fechas del
       ciclo, SIN fotos. Filtros, paneles fijos, colores por estado, lista
       desplegable de estado y una columna libre de seguimiento.
     · Dashboard: indicadores, tablas por estado / área / disciplina /
       antigüedad / tipo y gráficos nativos de Excel. Todo con fórmulas
       sobre la hoja Levantamientos: si se cambia un estado, se recalcula.
   Usa ExcelJS (/vendor/exceljs.min.js) y, para los gráficos nativos que
   ExcelJS no sabe dibujar, JSZip (/vendor/jszip.min.js): se agregan al
   archivo como partes DrawingML estándar.
   Se carga recién al exportar (index.html → exportarExcel).
   ===================================================================== */
(function () {
  'use strict';

  const H1 = 'Levantamientos', H2 = 'Dashboard';
  const FILA_ENC = 5, FILA_INI = 6;
  /* Paleta corporativa de SIMA (la misma de la app, index.html :root y
     tema claro): grafito de fondo, ámbar de marca (gradiente del logo
     #FF9F1C → #E5761A, tinta #14100A) y los acentos de estado. Sobre el
     blanco de Excel, el texto de color usa las variantes «-tx» del tema
     claro, que cumplen contraste AA. */
  const C = {
    navy: 'FF111519',      // --s1 oscuro: banda de título
    slate: 'FF1D242B',     // --s3 oscuro: encabezados de tabla
    tx: 'FF151A1E', tx2: 'FF54646F', tx3: 'FF5F6D78',   // texto del tema claro
    linea: 'FFE3E7EB', zebra: 'FFF7F8FA', tile: 'FFEEF1F4',
    amber: 'FFFF9F1C', amber2: 'FFE5761A', tinta: 'FF14100A', blanco: 'FFFFFFFF',
    nota: 'FFFFF4E3',      // ámbar muy suave: columna de seguimiento
    redTx: 'FFC41B2B', greenTx: 'FF0A7346', amberTx: 'FF9A5B00', iceTx: 'FF0A6E8A', violetTx: 'FF5A46C7',
    ice: 'FF3FC5E8', violet: 'FF8B7BF7', red: 'FFFF4D5E', green: 'FF1FCB7E', gris: 'FF93A2AE'
  };
  const FUENTE = 'Segoe UI', MONO = 'Consolas';   // Inter y JetBrains Mono no vienen con Office
  // Estado: relleno claro + texto oscuro (contraste AA) en la tabla; color
  // pleno de la app en los gráficos.
  const EST = {
    'Detectado':    { bg: 'FFFFE3E6', fg: 'FFC41B2B', graf: 'FF4D5E' },
    'Programado':   { bg: 'FFFFF0DB', fg: 'FF9A5B00', graf: 'FF9F1C' },
    'En ejecución': { bg: 'FFDDF5FB', fg: 'FF0A6E8A', graf: '3FC5E8' },
    'A verificar':  { bg: 'FFECE9FE', fg: 'FF5A46C7', graf: '8B7BF7' },
    'Cerrado':      { bg: 'FFD9F7EA', fg: 'FF0A7346', graf: '1FCB7E' }
  };
  const ESTADOS = Object.keys(EST);

  /* Columnas de la hoja Levantamientos (orden = letra A, B, C…). */
  const COLS = [
    { k: 'n',        t: 'N°',                     w: 5,  al: 'center' },
    { k: 'id',       t: 'ID',                     w: 10, al: 'center', bold: true },
    { k: 'estado',   t: 'Estado',                 w: 14, al: 'center' },
    { k: 'dias',     t: 'Días abierto',           w: 9,  al: 'center' },
    { k: 'fechaDet', t: 'Fecha detección',        w: 12, fecha: true },
    { k: 'rec',      t: 'Recorrido',              w: 11, al: 'center' },
    { k: 'area',     t: 'Área',                   w: 14 },
    { k: 'sector',   t: 'Sector',                 w: 22 },
    { k: 'sub',      t: 'Subsector',              w: 22 },
    { k: 'tipo',     t: 'Tipo de hallazgo',       w: 20 },
    { k: 'disc',     t: 'Disciplina',             w: 12 },
    { k: 'crit',     t: 'Criticidad',             w: 10, al: 'center' },
    { k: 'desc',     t: 'Descripción',            w: 48, wrap: true },
    { k: 'sap',      t: 'Orden SAP',              w: 12, al: 'center' },
    { k: 'resp',     t: 'Responsable(s)',         w: 24, wrap: true },
    { k: 'fProg',    t: 'Fecha programada',       w: 12, fecha: true },
    { k: 'fTent',    t: 'Fecha tentativa',        w: 12, fecha: true },
    { k: 'fIni',     t: 'Inicio ejecución',       w: 12, fecha: true },
    { k: 'fFin',     t: 'Fin ejecución',          w: 12, fecha: true },
    { k: 'fCierre',  t: 'Cierre (verif. Inspector)', w: 13, fecha: true },
    { k: 'cal',      t: 'Control de Calidad',     w: 14, al: 'center' },
    { k: 'arr',      t: 'Arrastrado',             w: 10, al: 'center' },
    { k: 'detBy',    t: 'Detectado por',          w: 18 },
    { k: 'gps',      t: 'Ubicación GPS (lat, lon)', w: 24 },
    { k: 'raMarca',  t: 'Marca RA',               w: 14, al: 'center' },
    { k: 'seg',      t: 'Seguimiento / observaciones', w: 34, wrap: true }
  ];
  const L = k => String.fromCharCode(65 + COLS.findIndex(c => c.k === k));
  const ULT = String.fromCharCode(64 + COLS.length);

  const fechaXL = iso => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  };
  const hoyUTC = () => { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
  const borde = (color = C.linea) => ({ style: 'thin', color: { argb: color } });
  const bordes = c => ({ top: borde(c), left: borde(c), bottom: borde(c), right: borde(c) });
  const relleno = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
  const xmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function banda(ws, titulo, subtitulo, meta, hastaCol) {
    ws.mergeCells(`A1:${hastaCol}1`); ws.mergeCells(`A2:${hastaCol}2`); ws.mergeCells(`A3:${hastaCol}3`);
    const t = ws.getCell('A1');
    const [marca, ...resto] = String(titulo).split(' · ');
    t.value = { richText: [
      { text: marca, font: { name: FUENTE, size: 17, bold: true, color: { argb: C.amber } } },
      { text: resto.length ? '  ·  ' + resto.join(' · ') : '', font: { name: FUENTE, size: 15, bold: true, color: { argb: C.blanco } } }
    ] };
    t.fill = relleno(C.navy); t.alignment = { vertical: 'middle', indent: 1 };
    t.border = { bottom: { style: 'thick', color: { argb: C.amber } } };
    ws.getRow(1).height = 34;
    const s = ws.getCell('A2');
    s.value = subtitulo; s.font = { size: 11, bold: true, color: { argb: C.tx } };
    s.alignment = { vertical: 'middle', indent: 1 }; ws.getRow(2).height = 20;
    const m = ws.getCell('A3');
    m.value = meta; m.font = { size: 9, italic: true, color: { argb: C.tx3 } };
    m.alignment = { vertical: 'middle', indent: 1 };
  }

  /* ---------------- Hoja 1 · Levantamientos ---------------- */
  function hojaLevantamientos(wb, d) {
    const ws = wb.addWorksheet(H1, {
      properties: { tabColor: { argb: C.amber } },
      views: [{ state: 'frozen', xSplit: 3, ySplit: FILA_ENC, showGridLines: false }],
      pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
      headerFooter: { oddFooter: '&L&8SIMA · Seguimiento de levantamientos&R&8Página &P de &N' }
    });
    COLS.forEach((c, i) => { ws.getColumn(i + 1).width = c.w; });
    banda(ws, d.titulo, d.subtitulo, d.meta, ULT);

    const enc = ws.getRow(FILA_ENC);
    COLS.forEach((c, i) => {
      const cel = enc.getCell(i + 1);
      cel.value = c.t;
      const seg = c.k === 'seg';
      cel.font = { bold: true, size: 10, color: { argb: seg ? C.tinta : C.blanco } };
      cel.fill = relleno(seg ? C.amber : C.slate);
      cel.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cel.border = { ...bordes(seg ? C.amber2 : C.slate), bottom: { style: 'medium', color: { argb: C.amber } } };
    });
    enc.height = 32;

    const hoy = hoyUTC();
    d.filas.forEach((f, i) => {
      const r = FILA_INI + i;
      const fila = ws.getRow(r);
      COLS.forEach((c, j) => {
        const cel = fila.getCell(j + 1);
        let v;
        if (c.k === 'n') v = i + 1;
        else if (c.k === 'dias') {
          const det = fechaXL(f.fechaDet), cie = fechaXL(f.fCierre);
          const res = det ? Math.max(0, Math.round(((cie ? cie.getTime() : hoy) - det.getTime()) / 864e5)) : '';
          const E = L('fechaDet') + r, T = L('fCierre') + r;
          v = { formula: `IF(${E}="","",IF(${T}<>"",${T}-${E},TODAY()-${E}))`, result: res };
        } else if (c.fecha) v = fechaXL(f[c.k]);
        else v = f[c.k] == null || f[c.k] === '' ? (c.k === 'seg' ? null : '') : f[c.k];
        cel.value = v;
        if (c.fecha) cel.numFmt = 'dd/mm/yyyy';
        if (c.k === 'dias') cel.numFmt = '0';
        cel.font = { size: 10, color: { argb: C.tx }, bold: !!c.bold };
        cel.alignment = { vertical: 'top', horizontal: c.al || (c.fecha ? 'center' : 'left'), wrapText: !!c.wrap };
        cel.border = bordes();
        if (c.k === 'seg') cel.fill = relleno(C.nota);
        else if (i % 2) cel.fill = relleno(C.zebra);
      });
    });
    const fin = FILA_INI + d.filas.length - 1;

    ws.autoFilter = { from: { row: FILA_ENC, column: 1 }, to: { row: fin, column: COLS.length } };
    ws.pageSetup.printTitlesRow = `${FILA_ENC}:${FILA_ENC}`;

    // Estado: color por valor y lista desplegable para actualizarlo.
    const cE = L('estado'), cD = L('dias');
    ws.addConditionalFormatting({
      ref: `${cE}${FILA_INI}:${cE}${fin}`,
      rules: ESTADOS.map((e, p) => ({
        type: 'expression', priority: p + 1, formulae: [`$${cE}${FILA_INI}="${e}"`],
        style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: EST[e].bg } }, font: { bold: true, color: { argb: EST[e].fg } } }
      }))
    });
    ws.addConditionalFormatting({
      ref: `${cD}${FILA_INI}:${cD}${fin}`,
      rules: [
        { type: 'expression', priority: 6, formulae: [`AND($${cE}${FILA_INI}<>"Cerrado",$${cD}${FILA_INI}>30)`],
          style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: EST['Detectado'].bg } }, font: { bold: true, color: { argb: C.redTx } } } },
        { type: 'expression', priority: 7, formulae: [`AND($${cE}${FILA_INI}<>"Cerrado",$${cD}${FILA_INI}>15)`],
          style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: EST['Programado'].bg } }, font: { bold: true, color: { argb: C.amberTx } } } }
      ]
    });
    ws.dataValidations.add(`${cE}${FILA_INI}:${cE}${fin}`, {
      type: 'list', allowBlank: false, showErrorMessage: true,
      errorTitle: 'Estado no válido', error: 'Elegí un estado de la lista.',
      formulae: [`"${ESTADOS.join(',')}"`]
    });
    const cC = L('cal');
    ws.addConditionalFormatting({
      ref: `${cC}${FILA_INI}:${cC}${fin}`,
      rules: [
        { type: 'expression', priority: 8, formulae: [`$${cC}${FILA_INI}="Aceptado"`], style: { font: { bold: true, color: { argb: C.greenTx } } } },
        { type: 'expression', priority: 9, formulae: [`$${cC}${FILA_INI}="Rechazado"`], style: { font: { bold: true, color: { argb: C.redTx } } } }
      ]
    });

    // Nota al pie
    const pie = ws.getCell(`A${fin + 2}`);
    pie.value = 'Días abierto: hasta el cierre por el Inspector, o hasta hoy si sigue abierto (se actualiza solo). Naranja: más de 15 días abierto · Rojo: más de 30. ' +
      'El Estado se puede actualizar con la lista desplegable y el Dashboard se recalcula. Las fotos no se incluyen: están en SIMA.';
    pie.font = { size: 9, italic: true, color: { argb: C.tx3 } };
    ws.mergeCells(`A${fin + 2}:${L('desc')}${fin + 2}`);
    pie.alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(fin + 2).height = 26;
    return fin;
  }

  /* ---------------- Hoja 2 · Dashboard ---------------- */
  function hojaDashboard(wb, d, fin) {
    const ws = wb.addWorksheet(H2, {
      properties: { tabColor: { argb: '3FC5E8'.padStart(8, 'F') } },
      views: [{ showGridLines: false, zoomScale: 100 }],
      pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }
    });
    // A angosta de margen; B..M contenido.
    const anchos = [2, 22, 11, 11, 11, 11, 3, 11, 11, 11, 11, 11, 11];
    anchos.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    banda(ws, d.titulo.replace('Seguimiento de levantamientos', 'Dashboard de seguimiento'), d.subtitulo, d.meta, 'M');

    const R = k => `${H1}!$${L(k)}$${FILA_INI}:$${L(k)}$${fin}`;
    const rE = R('estado'), rD = R('dias'), rId = R('id');
    const filas = d.filas;
    const cuenta = pred => filas.filter(pred).length;
    const abierto = f => f.estado !== 'Cerrado';

    /* ---- Indicadores ---- */
    const total = filas.length, cerr = cuenta(f => !abierto(f));
    const diasAb = filas.filter(abierto).map(f => {
      const det = fechaXL(f.fechaDet); return det ? Math.max(0, Math.round((hoyUTC() - det.getTime()) / 864e5)) : null;
    }).filter(x => x != null);
    const sinSap = cuenta(f => abierto(f) && !f.sap);
    const kpis = [
      { t: 'LEVANTAMIENTOS', f: `COUNTA(${rId})`, r: total, fmt: '0', ac: C.amber, h: 'en el período exportado' },
      { t: 'ABIERTOS', f: `C6-H6`, r: total - cerr, fmt: '0', ac: C.red, h: 'sin cierre del Inspector', ref: 'E6' },
      { t: 'CERRADOS', f: `COUNTIF(${rE},"Cerrado")`, r: cerr, fmt: '0', ac: C.green, h: 'verificados por el Inspector', ref: 'H6' },
      { t: '% DE CIERRE', f: `IF(C6=0,0,H6/C6)`, r: total ? cerr / total : 0, fmt: '0%', ac: C.ice, h: 'cerrados / total' },
      { t: 'DÍAS PROMEDIO ABIERTO', f: `IFERROR(AVERAGEIFS(${rD},${rE},"<>Cerrado"),0)`, r: diasAb.length ? diasAb.reduce((a, b) => a + b, 0) / diasAb.length : 0, fmt: '0.0', ac: C.amber2, h: 'de los que siguen abiertos' },
      { t: 'ABIERTOS SIN ORDEN SAP', f: `COUNTIFS(${rE},"<>Cerrado",${R('sap')},"")`, r: sinSap, fmt: '0', ac: C.violet, h: 'a cargar en SAP' }
    ];
    // Posiciones: B:C(B6 merged? ) — cada indicador ocupa 2 columnas.
    const pares = [['B', 'B'], ['C', 'D'], ['E', 'F'], ['H', 'I'], ['J', 'K'], ['L', 'M']];
    // Valor en la primera celda de cada par; ABIERTOS usa C6 (total) y H6 (cerrados).
    const celdaValor = {};
    pares.forEach(([a, b], i) => { celdaValor[i] = a + '6'; });
    // Reescribir referencias según dónde quedó cada valor.
    kpis[1].f = `${celdaValor[0]}-${celdaValor[2]}`;
    kpis[3].f = `IF(${celdaValor[0]}=0,0,${celdaValor[2]}/${celdaValor[0]})`;
    ws.getRow(5).height = 18; ws.getRow(6).height = 26; ws.getRow(7).height = 14; ws.getRow(8).height = 16;
    kpis.forEach((k, i) => {
      const [a, b] = pares[i];
      if (a !== b) { ws.mergeCells(`${a}5:${b}5`); ws.mergeCells(`${a}6:${b}7`); ws.mergeCells(`${a}8:${b}8`); }
      else { ws.mergeCells(`${a}6:${a}7`); }
      const lbl = ws.getCell(`${a}5`), val = ws.getCell(`${a}6`), ayu = ws.getCell(`${a}8`);
      lbl.value = k.t; lbl.font = { size: 8, bold: true, color: { argb: C.tx3 } };
      val.value = { formula: k.f, result: k.r }; val.numFmt = k.fmt;
      val.font = { size: 22, bold: true, color: { argb: C.tx } };
      ayu.value = k.h; ayu.font = { size: 8, italic: true, color: { argb: C.tx3 } };
      [lbl, val, ayu].forEach(c => { c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }; });
      for (let r = 5; r <= 8; r++) {
        for (const col of [a, b]) {
          const c = ws.getCell(`${col}${r}`);
          c.fill = relleno(C.tile);
          c.border = { left: col === a ? { style: 'thick', color: { argb: k.ac } } : undefined };
        }
      }
    });

    /* ---- Tablas ---- */
    const encTabla = (fila, titulo, cols, desde = 'B') => {
      const ini = desde.charCodeAt(0);
      ws.mergeCells(`${desde}${fila}:${String.fromCharCode(ini + cols.length - 1)}${fila}`);
      const t = ws.getCell(`${desde}${fila}`);
      t.value = titulo; t.font = { size: 11, bold: true, color: { argb: C.tx } };
      t.border = { bottom: { style: 'medium', color: { argb: C.amber } } };
      const r = ws.getRow(fila + 1);
      cols.forEach((c, i) => {
        const cel = r.getCell(ini - 64 + i);
        cel.value = c; cel.font = { size: 9, bold: true, color: { argb: C.blanco } };
        cel.border = { bottom: { style: 'thin', color: { argb: C.amber } } };
        cel.fill = relleno(C.slate); cel.alignment = { horizontal: i ? 'center' : 'left', vertical: 'middle', indent: i ? 0 : 1 };
      });
      r.height = 18;
    };
    const celda = (ref, v, fmt, extra = {}) => {
      const c = ws.getCell(ref);
      c.value = v; if (fmt) c.numFmt = fmt;
      c.font = { size: 10, color: { argb: C.tx }, ...(extra.font || {}) };
      c.alignment = { horizontal: extra.al || 'center', vertical: 'middle', indent: extra.al === 'left' ? 1 : 0 };
      c.border = { bottom: borde() };
      if (extra.fill) c.fill = relleno(extra.fill);
      return c;
    };
    const barras = (ref, color) => ws.addConditionalFormatting({
      ref, rules: [{ type: 'dataBar', priority: 1, minLength: 0, maxLength: 100, gradient: false,
        cfvo: [{ type: 'num', value: 0 }, { type: 'max' }], color: { argb: color } }]
    });
    const graficos = [];

    // 1) Por estado
    let f0 = 10;
    encTabla(f0, 'Levantamientos por estado', ['Estado', 'Cantidad', '% del total']);
    ESTADOS.forEach((e, i) => {
      const r = f0 + 2 + i;
      celda(`B${r}`, e, null, { al: 'left', font: { bold: true, color: { argb: EST[e].fg } }, fill: EST[e].bg });
      const n = cuenta(f => f.estado === e);
      celda(`C${r}`, { formula: `COUNTIF(${rE},B${r})`, result: n }, '0');
      celda(`D${r}`, { formula: `IF(${celdaValor[0]}=0,0,C${r}/${celdaValor[0]})`, result: total ? n / total : 0 }, '0%');
    });
    const fe = f0 + 2 + ESTADOS.length;
    celda(`B${fe}`, 'Total', null, { al: 'left', font: { bold: true } });
    celda(`C${fe}`, { formula: `SUM(C${f0 + 2}:C${fe - 1})`, result: total }, '0', { font: { bold: true } });
    celda(`D${fe}`, { formula: `IF(${celdaValor[0]}=0,0,C${fe}/${celdaValor[0]})`, result: total ? 1 : 0 }, '0%', { font: { bold: true } });
    graficos.push({
      tipo: 'dona', titulo: 'Distribución por estado', desde: { col: 7, row: f0 - 1 }, hasta: { col: 13, row: f0 + 12 },
      cats: { ref: `${H2}!$B$${f0 + 2}:$B$${fe - 1}`, v: ESTADOS },
      series: [{ nombre: 'Cantidad', ref: `${H2}!$C$${f0 + 2}:$C$${fe - 1}`, v: ESTADOS.map(e => cuenta(f => f.estado === e)), colores: ESTADOS.map(e => EST[e].graf) }]
    });

    // 2) Por área · 3) Por disciplina (misma forma)
    const tablaGrupo = (fila, titulo, claves, campo, rango) => {
      encTabla(fila, titulo, [campo === 'area' ? 'Área' : 'Disciplina', 'Total', 'Abiertos', 'Cerrados', '% cierre']);
      claves.forEach((k, i) => {
        const r = fila + 2 + i;
        const tot = cuenta(f => f[campo] === k), ce = cuenta(f => f[campo] === k && !abierto(f));
        celda(`B${r}`, k, null, { al: 'left', font: { bold: true } });
        celda(`C${r}`, { formula: `COUNTIF(${rango},B${r})`, result: tot }, '0');
        celda(`D${r}`, { formula: `C${r}-E${r}`, result: tot - ce }, '0', { font: { bold: true, color: { argb: C.redTx } } });
        celda(`E${r}`, { formula: `COUNTIFS(${rango},B${r},${rE},"Cerrado")`, result: ce }, '0', { font: { color: { argb: C.greenTx } } });
        celda(`F${r}`, { formula: `IF(C${r}=0,0,E${r}/C${r})`, result: tot ? ce / tot : 0 }, '0%');
      });
      const ult = fila + 1 + claves.length;
      barras(`F${fila + 2}:F${ult}`, 'FF8FE5BE');
      return {
        tipo: 'barras', titulo: titulo.replace('Levantamientos por ', 'Abiertos y cerrados por '),
        desde: { col: 7, row: fila - 1 }, hasta: { col: 13, row: fila + 12 },
        cats: { ref: `${H2}!$B$${fila + 2}:$B$${ult}`, v: claves },
        series: [
          { nombre: 'Abiertos', tx: `${H2}!$D$${fila + 1}`, ref: `${H2}!$D$${fila + 2}:$D$${ult}`, v: claves.map(k => cuenta(f => f[campo] === k && abierto(f))), color: 'FF4D5E' },
          { nombre: 'Cerrados', tx: `${H2}!$E$${fila + 1}`, ref: `${H2}!$E$${fila + 2}:$E$${ult}`, v: claves.map(k => cuenta(f => f[campo] === k && !abierto(f))), color: '1FCB7E' }
        ]
      };
    };
    f0 = 25;
    graficos.push(tablaGrupo(f0, 'Levantamientos por área', d.areas, 'area', R('area')));
    f0 = 40;
    graficos.push(tablaGrupo(f0, 'Levantamientos por disciplina', d.disciplinas, 'disc', R('disc')));

    // 4) Antigüedad de los abiertos
    f0 = 55;
    encTabla(f0, 'Antigüedad de los abiertos', ['Días abierto', 'Cantidad', '% abiertos']);
    const tramos = [['0 a 15 días', 0, 15], ['16 a 30 días', 16, 30], ['31 a 60 días', 31, 60], ['Más de 60 días', 61, null]];
    const colTramo = [C.gris, C.amber, C.red, C.redTx];
    const txTramo = [C.tx2, C.amberTx, C.redTx, C.redTx];
    tramos.forEach(([lbl, a, b], i) => {
      const r = f0 + 2 + i;
      const n = diasAb.filter(x => x >= a && (b == null || x <= b)).length;
      celda(`B${r}`, lbl, null, { al: 'left', font: { bold: true } });
      const cond = `${rE},"<>Cerrado",${rD},">=${a}"` + (b == null ? '' : `,${rD},"<=${b}"`);
      celda(`C${r}`, { formula: `COUNTIFS(${cond})`, result: n }, '0', { font: { bold: true, color: { argb: txTramo[i] } } });
      celda(`D${r}`, { formula: `IF(${celdaValor[1]}=0,0,C${r}/${celdaValor[1]})`, result: diasAb.length ? n / diasAb.length : 0 }, '0%');
    });
    graficos.push({
      tipo: 'barras', horizontal: true, titulo: 'Antigüedad de los abiertos', desde: { col: 7, row: f0 - 1 }, hasta: { col: 13, row: f0 + 10 },
      cats: { ref: `${H2}!$B$${f0 + 2}:$B$${f0 + 5}`, v: tramos.map(t => t[0]) },
      series: [{ nombre: 'Abiertos', ref: `${H2}!$C$${f0 + 2}:$C$${f0 + 5}`, v: tramos.map(([, a, b]) => diasAb.filter(x => x >= a && (b == null || x <= b)).length), colores: colTramo.map(c => c.slice(2)), sinLeyenda: true }]
    });

    // 5) Por tipo de hallazgo (de mayor a menor)
    f0 = 68;
    const tipos = [...new Set(filas.map(f => f.tipo))]
      .map(t => [t, cuenta(f => f.tipo === t)]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
    encTabla(f0, 'Levantamientos por tipo de hallazgo', ['Tipo de hallazgo', 'Total', 'Abiertos', 'Cerrados', '% cierre']);
    tipos.forEach((t, i) => {
      const r = f0 + 2 + i, tot = cuenta(f => f.tipo === t), ce = cuenta(f => f.tipo === t && !abierto(f));
      celda(`B${r}`, t, null, { al: 'left', font: { bold: true } });
      celda(`C${r}`, { formula: `COUNTIF(${R('tipo')},B${r})`, result: tot }, '0');
      celda(`D${r}`, { formula: `C${r}-E${r}`, result: tot - ce }, '0', { font: { bold: true, color: { argb: C.redTx } } });
      celda(`E${r}`, { formula: `COUNTIFS(${R('tipo')},B${r},${rE},"Cerrado")`, result: ce }, '0', { font: { color: { argb: C.greenTx } } });
      celda(`F${r}`, { formula: `IF(C${r}=0,0,E${r}/C${r})`, result: tot ? ce / tot : 0 }, '0%');
    });
    if (tipos.length) { barras(`C${f0 + 2}:C${f0 + 1 + tipos.length}`, 'FFFFCF8D'); barras(`F${f0 + 2}:F${f0 + 1 + tipos.length}`, 'FF8FE5BE'); }
    if (tipos.length) graficos.push({
      tipo: 'barras', horizontal: true, apilado: true, titulo: 'Por tipo de hallazgo',
      desde: { col: 7, row: f0 - 1 }, hasta: { col: 13, row: f0 + Math.max(12, tipos.length + 3) },
      cats: { ref: `${H2}!$B$${f0 + 2}:$B$${f0 + 1 + tipos.length}`, v: tipos },
      series: [
        { nombre: 'Abiertos', tx: `${H2}!$D$${f0 + 1}`, ref: `${H2}!$D$${f0 + 2}:$D$${f0 + 1 + tipos.length}`, v: tipos.map(t => cuenta(f => f.tipo === t && abierto(f))), color: 'FF4D5E' },
        { nombre: 'Cerrados', tx: `${H2}!$E$${f0 + 1}`, ref: `${H2}!$E$${f0 + 2}:$E$${f0 + 1 + tipos.length}`, v: tipos.map(t => cuenta(f => f.tipo === t && !abierto(f))), color: '1FCB7E' }
      ]
    });

    // Impresión: cortes entre bloques para no partir ningún gráfico.
    ws.getRow(22).addPageBreak(); ws.getRow(52).addPageBreak();
    const pie = ws.getCell(`B${f0 + Math.max(14, tipos.length + 4)}`);
    pie.value = 'Los indicadores, tablas y gráficos se calculan con fórmulas sobre la hoja «Levantamientos»: si se actualiza un estado allí, el Dashboard se recalcula.';
    pie.font = { size: 9, italic: true, color: { argb: C.tx3 } };
    return graficos;
  }

  /* ---------------- Gráficos nativos (DrawingML) ---------------- */
  const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
  const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const txPr = (sz = 900, color = '54646F', b = 0) =>
    `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}" b="${b}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Segoe UI"/></a:defRPr></a:pPr><a:endParaRPr lang="es-PY"/></a:p></c:txPr>`;
  const solido = c => `<a:solidFill><a:srgbClr val="${c}"/></a:solidFill>`;
  const strCache = vals => `<c:strCache><c:ptCount val="${vals.length}"/>${vals.map((v, i) => `<c:pt idx="${i}"><c:v>${xmlEsc(v)}</c:v></c:pt>`).join('')}</c:strCache>`;
  const numCache = vals => `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${vals.length}"/>${vals.map((v, i) => `<c:pt idx="${i}"><c:v>${+v || 0}</c:v></c:pt>`).join('')}</c:numCache>`;

  function chartXml(g) {
    const titulo = `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"/></a:pPr><a:r><a:rPr lang="es-PY" sz="1200" b="1">${solido('151A1E')}<a:latin typeface="Segoe UI"/></a:rPr><a:t>${xmlEsc(g.titulo)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`;
    const cat = `<c:cat><c:strRef><c:f>${g.cats.ref}</c:f>${strCache(g.cats.v)}</c:strRef></c:cat>`;
    const serTx = s => s.tx ? `<c:tx><c:strRef><c:f>${s.tx}</c:f>${strCache([s.nombre])}</c:strRef></c:tx>` : `<c:tx><c:v>${xmlEsc(s.nombre)}</c:v></c:tx>`;
    const dPts = s => (s.colores || []).map((c, i) =>
      `<c:dPt><c:idx val="${i}"/>${g.tipo === 'dona' ? '<c:bubble3D val="0"/>' : '<c:invertIfNegative val="0"/><c:bubble3D val="0"/>'}<c:spPr>${solido(c)}<a:ln w="19050">${solido('FFFFFF')}</a:ln></c:spPr></c:dPt>`).join('');
    let plot;
    if (g.tipo === 'dona') {
      const s = g.series[0];
      plot = `<c:doughnutChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/>${serTx(s)}${dPts(s)}` +
        `<c:dLbls><c:numFmt formatCode="0%" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txPr(900, 'FFFFFF', 1)}<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/><c:showLeaderLines val="0"/></c:dLbls>` +
        `${cat}<c:val><c:numRef><c:f>${s.ref}</c:f>${numCache(s.v)}</c:numRef></c:val></c:ser>` +
        `<c:firstSliceAng val="0"/><c:holeSize val="58"/></c:doughnutChart>`;
    } else {
      const sers = g.series.map((s, i) =>
        `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${serTx(s)}<c:spPr>${solido(s.color || '93A2AE')}</c:spPr><c:invertIfNegative val="0"/>${dPts(s)}` +
        `<c:dLbls>${g.apilado ? '<c:numFmt formatCode="0;;;" sourceLinked="0"/>' : ''}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txPr(900, g.apilado ? 'FFFFFF' : '151A1E', 1)}<c:dLblPos val="${g.apilado ? 'ctr' : 'outEnd'}"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>` +
        `${cat}<c:val><c:numRef><c:f>${s.ref}</c:f>${numCache(s.v)}</c:numRef></c:val></c:ser>`).join('');
      plot = `<c:barChart><c:barDir val="${g.horizontal ? 'bar' : 'col'}"/><c:grouping val="${g.apilado ? 'stacked' : 'clustered'}"/><c:varyColors val="0"/>${sers}` +
        `<c:gapWidth val="${g.horizontal ? 60 : 80}"/>${g.apilado ? '<c:overlap val="100"/>' : '<c:overlap val="-8"/>'}<c:axId val="5001"/><c:axId val="5002"/></c:barChart>` +
        `<c:catAx><c:axId val="5001"/><c:scaling><c:orientation val="${g.horizontal ? 'maxMin' : 'minMax'}"/></c:scaling><c:delete val="0"/><c:axPos val="${g.horizontal ? 'l' : 'b'}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln w="9525">${solido('D2D9DF')}</a:ln></c:spPr>${txPr(900)}<c:crossAx val="5002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
        `<c:valAx><c:axId val="5002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${g.horizontal ? 'b' : 'l'}"/><c:majorGridlines><c:spPr><a:ln w="6350">${solido('E3E7EB')}</a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${txPr(800, '5F6D78')}<c:crossAx val="5001"/><c:crosses val="${g.horizontal ? 'max' : 'autoZero'}"/><c:crossBetween val="between"/><c:majorUnit val="1"/></c:valAx>`;
    }
    const sinLeyenda = g.series.every(s => s.sinLeyenda);
    const leyenda = sinLeyenda ? '' : `<c:legend><c:legendPos val="${g.tipo === 'dona' ? 'r' : 'b'}"/><c:overlay val="0"/>${txPr(900)}</c:legend>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}"><c:date1904 val="0"/><c:lang val="es-ES"/><c:roundedCorners val="0"/>` +
      `<c:chart>${titulo}<c:plotArea><c:layout/>${plot}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>${leyenda}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>` +
      `<c:spPr>${solido('FFFFFF')}<a:ln w="9525">${solido('E3E7EB')}</a:ln></c:spPr>` +
      `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr><a:latin typeface="Segoe UI"/></a:defRPr></a:pPr><a:endParaRPr lang="es-PY"/></a:p></c:txPr></c:chartSpace>`;
  }

  // La escala de 1 en 1 sólo tiene sentido con pocos casos.
  function ajustarEscala(xml, g) {
    const max = Math.max(0, ...g.series.flatMap(s => s.v));
    return max > 12 ? xml.replace('<c:majorUnit val="1"/>', '') : xml;
  }

  // Sin entradas de carpeta en el zip: Excel es estricto con el paquete.
  const SIN_CARPETAS = { createFolders: false };
  async function agregarGraficos(buffer, graficos, hojaN) {
    const zip = await window.JSZip.loadAsync(buffer);
    const hoja = `xl/worksheets/sheet${hojaN}.xml`;
    const relsHoja = `xl/worksheets/_rels/sheet${hojaN}.xml.rels`;
    let ancla = '', relsDib = '';
    graficos.forEach((g, i) => {
      const n = i + 1;
      zip.file(`xl/charts/chart${n}.xml`, ajustarEscala(chartXml(g), g), SIN_CARPETAS);
      relsDib += `<Relationship Id="rId${n}" Type="${NS_R}/chart" Target="../charts/chart${n}.xml"/>`;
      ancla += `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${g.desde.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${g.desde.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
        `<xdr:to><xdr:col>${g.hasta.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${g.hasta.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
        `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${n + 1}" name="Gráfico ${n}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
        `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${NS_C}"><c:chart xmlns:c="${NS_C}" xmlns:r="${NS_R}" r:id="rId${n}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
    });
    zip.file('xl/drawings/drawing1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="${NS_A}">${ancla}</xdr:wsDr>`, SIN_CARPETAS);
    zip.file('xl/drawings/_rels/drawing1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relsDib}</Relationships>`, SIN_CARPETAS);

    // Relación hoja → dibujo
    const relDrw = `<Relationship Id="rIdSimaDrw" Type="${NS_R}/drawing" Target="../drawings/drawing1.xml"/>`;
    const relsPrev = zip.file(relsHoja) ? await zip.file(relsHoja).async('string') : null;
    zip.file(relsHoja, relsPrev
      ? relsPrev.replace('</Relationships>', relDrw + '</Relationships>')
      : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relDrw}</Relationships>`, SIN_CARPETAS);

    // <drawing> en su lugar dentro de la hoja (antes de legacyDrawing/tableParts/extLst)
    let xml = await zip.file(hoja).async('string');
    if (!/xmlns:r=/.test(xml.slice(0, 600))) xml = xml.replace('<worksheet ', `<worksheet xmlns:r="${NS_R}" `);
    // Según el esquema, <drawing> va después de pageMargins / pageSetup /
    // headerFooter / rowBreaks / colBreaks / ignoredErrors. Ojo: no se puede
    // buscar el primer <extLst>, porque las barras de datos traen uno anidado.
    const tag = '<drawing r:id="rIdSimaDrw"/>';
    let pos = -1;
    for (const n of ['pageMargins', 'pageSetup', 'headerFooter', 'rowBreaks', 'colBreaks', 'customProperties', 'cellWatches', 'ignoredErrors', 'smartTags']) {
      const re = new RegExp(`<${n}\\b[^>]*\\/>|<${n}\\b[\\s\\S]*?<\\/${n}>`, 'g');
      let m; while ((m = re.exec(xml))) pos = Math.max(pos, m.index + m[0].length);
    }
    if (pos < 0) {
      const fin = xml.lastIndexOf('</worksheet>'), ext = xml.lastIndexOf('<extLst');
      pos = ext > xml.lastIndexOf('</conditionalFormatting>') ? ext : fin;
    }
    xml = xml.slice(0, pos) + tag + xml.slice(pos);
    zip.file(hoja, xml);

    let ct = await zip.file('[Content_Types].xml').async('string');
    const ov = graficos.map((_, i) => `<Override PartName="/xl/charts/chart${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`).join('') +
      '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>';
    ct = ct.replace('</Types>', ov + '</Types>');
    zip.file('[Content_Types].xml', ct);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' });
  }

  /* ---------------- Punto de entrada ---------------- */
  async function generar(d) {
    if (!window.ExcelJS) throw new Error('No se cargó el generador de Excel.');
    if (!d.filas.length) throw new Error('No hay levantamientos para exportar.');
    const wb = new window.ExcelJS.Workbook();
    wb.creator = 'SIMA'; wb.created = new Date();
    wb.title = d.titulo; wb.subject = d.subtitulo;
    wb.calcProperties.fullCalcOnLoad = true;
    const fin = hojaLevantamientos(wb, d);
    const graficos = hojaDashboard(wb, d, fin);
    const colId = COLS.findIndex(c => c.k === 'id') + 1;
    wb.eachSheet(ws => ws.eachRow({ includeEmpty: true }, (row, nr) => row.eachCell({ includeEmpty: true }, (cel, nc) => {
      if (cel.value && cel.value.richText) return;
      const mono = ws.name === H1 && nc === colId && nr >= FILA_INI && nr <= fin;
      cel.font = { ...(cel.font || {}), name: mono ? MONO : FUENTE };
    })));
    const buf = await wb.xlsx.writeBuffer();
    if (window.JSZip && graficos.length) {
      try { return await agregarGraficos(buf, graficos, 2); }
      catch (e) { console.warn('SIMA Excel: sin gráficos nativos', e); }
    }
    return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  window.SIMAExcel = { generar, ESTADOS };
})();
