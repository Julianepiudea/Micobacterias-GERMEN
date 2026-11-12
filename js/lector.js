/* lector.js — Lee la hoja BD_BK_CULTIVO_PM de un libro de actividades TB (INS) y devuelve
   registros mínimos. Se ejecuta dentro de un Web Worker (lector.worker.js); si el navegador no
   permite workers (p. ej. abierto con doble clic), app.js lo usa directamente.

   Privacidad: nombres y apellidos (E–G) solo se leen para saber si están diligenciados (sí/no);
   el documento (J) se convierte en un seudónimo SHA-256 con sal de sesión y se descarta;
   Observaciones (BX) no se lee. Ningún valor identificador sale de esta función. */
'use strict';

const Lector = (() => {
  const SHEET = 'BD_BK_CULTIVO_PM', HEADER_ROWS = 3, NCOL = 75; // columnas A..BW (BX = observaciones, no se lee)
  const IDENT = new Set([4, 5, 6, 9]);                               // nombres, apellidos, documento
  const FECHAS = [15, 16, 23, 24, 29, 30, 42, 43, 44, 48, 49, 52, 53, 56, 57, 60, 63, 66, 69, 72];
  const ES_FECHA = new Set(FECHAS);
  // Firma de la plantilla: columna → fragmento esperado del encabezado (fila 3)
  const FIRMA = { 1: 'orden', 7: 'sexo', 8: 'edad', 12: 'tipo de muestra', 13: 'tipo de tuberculosis', 24: 'recep', 26: 'liquido', 28: 'especie', 47: 'resultado' };

  const sinTilde = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const limpio = v => { if (v == null) return null; const s = String(v).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim(); return (!s || /^(nan|none|null)$/i.test(s)) ? null : s; };

  function serial(n) { const u = new Date(Math.round((n - 25569) * 86400000)); return Date.UTC(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()); }
  /* Fecha → {t: ms UTC a medianoche | null, k: 'fecha' | 'texto' | 'invalida', x: texto original si no es fecha real} */
  function fecha(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) { if (isNaN(v)) return { t: null, k: 'invalida', x: '' }; return { t: Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()), k: 'fecha' }; }
    if (typeof v === 'number') return v > 3000 && v < 80000 ? { t: serial(v), k: 'fecha' } : { t: null, k: 'invalida', x: String(v) };
    const s = String(v).trim(); if (!s) return null;
    let m, t = null;
    if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:\s|$)/))) { const d = +m[1], mo = +m[2], y = +m[3]; if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) t = Date.UTC(y, mo - 1, d); }
    else if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    else if (/^\d{5}(\.\d+)?$/.test(s)) t = serial(parseFloat(s));
    return t == null || isNaN(t) ? { t: null, k: 'invalida', x: s.slice(0, 40) } : { t, k: 'texto', x: s.slice(0, 40) };
  }

  async function seudonimo(id, sal) {
    const key = sinTilde(String(id)).toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (!key) return null;
    if (self.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sal + '|' + key));
      return Array.from(new Uint8Array(buf).slice(0, 12), b => b.toString(16).padStart(2, '0')).join('');
    }
    let x = 0x811c9dc5; for (const c of sal + '|' + key) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619) >>> 0; } return 'f' + x.toString(16);
  }

  /* buffer: ArrayBuffer del archivo; devuelve {nombre, registros, avisos, firmaOk, encabezados} */
  async function leer(buffer, nombre, sal, progreso = () => {}) {
    progreso('Abriendo ' + nombre + '…');
    let wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true, dense: true, sheets: [SHEET], cellFormula: false, cellHTML: false, cellStyles: false });
    let ws = wb.Sheets[SHEET];
    if (!ws) throw new Error('no tiene la hoja ' + SHEET);
    // Solo columnas A..BW: reduce memoria en libros con cientos de columnas auxiliares
    const ref = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    ref.e.c = Math.min(ref.e.c, NCOL - 1); ws['!ref'] = XLSX.utils.encode_range(ref);
    let raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: true });
    wb = null; ws = null;
    const hdr = (raw[2] || []).map(h => sinTilde(String(h || '')).toLowerCase().replace(/\s+/g, ' '));
    const fallos = Object.entries(FIRMA).filter(([c, frag]) => !(hdr[c] || '').includes(frag)).map(([c]) => +c);
    const registros = [], avisos = [];
    if (fallos.length > 2) avisos.push('La hoja no coincide con la plantilla INS esperada (columnas ' + fallos.map(c => XLSX.utils.encode_col(c)).join(', ') + '). Los resultados pueden ser incorrectos.');
    progreso('Procesando ' + nombre + '…');
    for (let i = HEADER_ROWS; i < raw.length; i++) {
      const r = raw[i]; if (!r) continue;
      const orden = limpio(r[1]); if (!orden) continue;
      const v = new Array(NCOL).fill(null), d = {};
      for (let c = 0; c < NCOL; c++) {
        if (IDENT.has(c)) continue;
        if (ES_FECHA.has(c)) { const f = fecha(r[c]); if (f) d[c] = f; continue; }
        let x = r[c];
        if (x instanceof Date) x = x.toLocaleDateString('es-CO');
        v[c] = limpio(x);
      }
      registros.push({
        fila: i + 1, orden, v, d,
        pid: await seudonimo(r[9], sal),
        tieneId: !!limpio(r[9]),
        tieneNombre: !!limpio(r[4]), tieneApellido: !!limpio(r[5])
      });
      if (registros.length % 2000 === 0) progreso('Procesando ' + nombre + ': ' + registros.length.toLocaleString('es-CO') + ' registros…');
    }
    raw = null;
    return { nombre, registros, avisos, firmaOk: fallos.length <= 2 };
  }
  return { leer, FECHAS, SHEET };
})();
if (typeof self !== 'undefined') self.Lector = Lector;
