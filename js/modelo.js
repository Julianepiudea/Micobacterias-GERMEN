/* modelo.js — Convierte el registro mínimo del lector en variables analíticas normalizadas.
   Columnas (base 0) de la hoja BD_BK_CULTIVO_PM de la plantilla INS. */
'use strict';

const COL = {
  TRIM: 0, ORDEN: 1, DPTO: 2, LAB: 3, SEXO: 7, EDAD: 8, MUN: 10, EAPB: 11, TM: 12, TB: 13, OTRO_TM: 14, F_TOMA: 15,
  M_REC: 16, M_MET: 17, M_ESP: 18, M_H: 19, M_R: 20, M_Q: 21, M_I: 22, M_INF: 23,
  C_REC: 24, C_TIPO: 25, C_LIQ: 26, C_SOL: 27, C_ESP: 28, C_INF: 29,
  P_REC: 30, P_MET: 31, P_FARM: [32, 33, 34, 35, 36, 37, 38, 39, 40, 41], P_NUEVOS: [38, 39, 40, 41], P_INF1: 42, P_INF2: 43,
  B_COL: 45, BK: [{ rec: 44, cal: 46, res: 47, inf: 48 }, { rec: 49, cal: 50, res: 51, inf: 52 }, { rec: 53, cal: 54, res: 55, inf: 56 }],
  CTRL: [{ rec: 57, bk: 58, cul: 59 }, { rec: 60, bk: 61, cul: 62 }, { rec: 63, bk: 64, cul: 65 }, { rec: 66, bk: 67, cul: 68 }, { rec: 69, bk: 70, cul: 71 }, { rec: 72, bk: 73, cul: 74 }]
};
const NOMBRE_COL = {
  0: 'Trimestre', 1: 'N.º de orden', 2: 'Departamento del LSP', 3: 'Nombre del laboratorio', 4: 'Nombres', 5: 'Primer apellido', 7: 'Sexo', 8: 'Edad', 9: 'N.º identificación',
  10: 'Municipio de residencia', 11: 'EAPB', 12: 'Tipo de muestra', 13: 'Tipo de TB', 14: 'Otro tipo de muestra', 15: 'Fecha de toma',
  16: 'Molecular · fecha recepción', 17: 'Molecular · metodología', 18: 'Molecular · especie', 19: 'Molecular · isoniacida', 20: 'Molecular · rifampicina', 21: 'Molecular · quinolonas', 22: 'Molecular · inyectables', 23: 'Molecular · fecha informe',
  24: 'Cultivo · fecha recepción', 25: 'Cultivo · tipo', 26: 'Cultivo · resultado líquido', 27: 'Cultivo · resultado sólido', 28: 'Cultivo · especie', 29: 'Cultivo · fecha informe',
  30: 'PSF · fecha recepción', 31: 'PSF · metodología', 32: 'PSF · isoniazida', 33: 'PSF · rifampicina', 34: 'PSF · moxifloxacina 0,25', 35: 'PSF · moxifloxacina 1,0', 36: 'PSF · levofloxacina', 37: 'PSF · amikacina', 38: 'PSF · linezolid', 39: 'PSF · delamanid', 40: 'PSF · clofazimina', 41: 'PSF · bedaquilina', 42: 'PSF · fecha informe 1', 43: 'PSF · fecha informe 2',
  44: 'BK 1 · fecha recepción', 45: 'BK · coloración', 46: 'BK 1 · calidad', 47: 'BK 1 · resultado', 48: 'BK 1 · fecha informe', 49: 'BK 2 · fecha recepción', 50: 'BK 2 · calidad', 51: 'BK 2 · resultado', 52: 'BK 2 · fecha informe', 53: 'BK 3 · fecha recepción', 54: 'BK 3 · calidad', 55: 'BK 3 · resultado', 56: 'BK 3 · fecha informe'
};
for (let i = 0; i < 6; i++) { NOMBRE_COL[57 + 3 * i] = `Control ${i + 1} · fecha recepción`; NOMBRE_COL[58 + 3 * i] = `Control ${i + 1} · BK`; NOMBRE_COL[59 + 3 * i] = `Control ${i + 1} · cultivo`; }
const letraCol = c => { let s = '', n = c + 1; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

const Modelo = (() => {
  const sinTilde = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const N = v => v == null ? '' : sinTilde(String(v)).toUpperCase().replace(/\s+/g, ' ').trim();
  const titleCase = s => s.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  const local = ms => { if (ms == null) return null; const u = new Date(ms); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()); };

  function liq(v) { const s = N(v); if (!s) return null; if (s.startsWith('NEG')) return 'NEG'; if (s.startsWith('POS')) return 'POS'; if (s.startsWith('CONT')) return 'CONT'; if (s.includes('NO REALIZ')) return 'NR'; return 'OTRO'; }
  function sol(v) { const s = N(v).replace(/\s/g, ''); if (!s) return null; if (s === '-' || s.startsWith('NEG')) return 'NEG'; if (s.startsWith('CONT')) return 'CONT'; if (s.includes('+') || s.includes('COLONIA')) return 'POS'; return 'OTRO'; }
  // Baciloscopia: NEG, 1-9, 1+, 2+, 3+, ESC (positivo escasos), CONF (se requiere confirmación)
  function bk(v) {
    const s = N(v).replace(/\s/g, ''); if (!s) return null;
    if (s === '-' || s.startsWith('NEG')) return 'NEG';
    if (s.includes('CONFIRM')) return 'CONF';
    if (s.includes('ESCASO')) return 'ESC';
    if (s.includes('+++')) return '3+'; if (s.includes('++')) return '2+';
    if (/1A9|BAA?R|^\d/.test(s)) return '1-9';
    if (s.includes('+')) return '1+';
    return 'OTRO';
  }
  const BK_POS = new Set(['1-9', '1+', '2+', '3+', 'ESC']);
  function sens(v) { const s = N(v); if (!s) return null; if (s.startsWith('SENS')) return 'S'; if (s.startsWith('RESIS')) return 'R'; if (s.includes('INTERPRET')) return 'NI'; if (s.includes('APLICA')) return 'NA'; return 'OTRO'; }
  function molEsp(v) { const s = N(v); if (!s) return null; if (s.includes('TUBERC')) return 'MTB'; if (s.includes('NO DETECT')) return 'ND'; if (s.includes('INTERPRET')) return 'NI'; if (s.startsWith('ERROR')) return 'ERR'; if (s.startsWith('INVALID')) return 'INV'; return 'OTRO'; }
  function especie(v) {
    const s = v && String(v).trim(); if (!s) return null; const k = sinTilde(s.toLowerCase());
    if (/^contam/.test(k) || /no (amplific|detect|interpret)/.test(k)) return null;
    if (k.includes('tuberculosis')) return 'Complejo M. tuberculosis';
    if (/no tuberc|^mnt|^micobacteria/.test(k)) return 'MNT sin especie';
    return s.replace(/^m\.\s*/i, 'M. ');
  }
  function eapb(v) { const s = v && String(v).trim(); if (!s) return 'Sin dato'; const m = s.match(/^(?:EPS|EAS|EPSS|ESS|CCF|RES|MIN|EPSI|EPSIC)\S*\s+(.+)$/i); let n = m ? m[1] : s; n = n.replace(/^E\.?P\.?S\.?\s+/i, '').replace(/\s+(S\.A\.?|E\.?P\.?S\.?)$/i, '').trim(); return titleCase(n).slice(0, 30); }
  function edad(v) {
    if (v == null) return null; if (typeof v === 'number') return v >= 0 && v <= 120 ? v : null;
    const s = sinTilde(String(v).toLowerCase()); if (s.startsWith('<1')) return 0;
    const m = s.match(/(\d+(?:[.,]\d+)?)/); if (!m) return null; const n = parseFloat(m[1].replace(',', '.'));
    if (/mes|\dm\b|\dm$/.test(s)) return n / 12; if (/dia/.test(s)) return n / 365; return n <= 120 ? n : null;
  }
  function periodoOrden(o) { const s = String(o).match(/\d{3,}/); if (!s) return null; const y = +s[0][0], m = +s[0].slice(1, 3); if (m < 1 || m > 12) return null; const cy = new Date().getFullYear(); let yr = 2020 + y; if (yr > cy) yr -= 10; return new Date(yr, m - 1, 15); }

  /* raw: {fila, orden, v, d, pid, ...}; devuelve el mismo objeto con campos derivados */
  function derivar(raw, archivo) {
    const v = raw.v, d = raw.d;
    const dt = c => d[c] && d[c].t != null ? local(d[c].t) : null;
    const r = raw; r.archivo = archivo;
    r.cRec = dt(COL.C_REC); r.cInf = dt(COL.C_INF); r.toma = dt(COL.F_TOMA); r.mRec = dt(COL.M_REC); r.mInf = dt(COL.M_INF);
    r.smears = COL.BK.map(b => ({ rec: dt(b.rec), inf: dt(b.inf), res: bk(v[b.res]), cal: v[b.cal] ? N(v[b.cal]) : null })).filter(s => s.rec || s.inf || s.res);
    const bkRec = r.smears.length ? r.smears[0].rec : null;
    r.fecha = r.cRec || r.toma || bkRec || r.mRec || periodoOrden(r.orden);
    const sx = N(v[COL.SEXO]); r.sexo = sx === 'M' || sx === 'F' ? sx : null; r.edad = edad(v[COL.EDAD]);
    r.mun = v[COL.MUN] ? titleCase(v[COL.MUN]) : 'Sin dato'; r.eapb = eapb(v[COL.EAPB]);
    r.tm = v[COL.TM] ? titleCase(v[COL.TM]) : 'Sin dato'; r.tmN = N(v[COL.TM]);
    r.tb = N(v[COL.TB]) || null;
    // cultivo
    r.hasC = !!(v[COL.C_TIPO] || v[COL.C_LIQ] || v[COL.C_SOL] || r.cRec);
    const l = liq(v[COL.C_LIQ]), so = sol(v[COL.C_SOL]);
    r.liq = r.hasC ? (l && l !== 'OTRO' ? l : (so === 'POS' ? 'POS' : so === 'NEG' ? 'NEG' : so === 'CONT' ? 'CONT' : 'PEND')) : null;
    r.liqRaw = l; // resultado literal de la columna AA (indicadores INS)
    r.esp = r.liq === 'POS' ? (especie(v[COL.C_ESP]) || 'Sin identificar') : null;
    r.cultMtb = N(v[COL.C_ESP]).includes('TUBERC');
    r.mtb = r.esp === 'Complejo M. tuberculosis'; r.mnt = !!r.esp && !r.mtb && r.esp !== 'Sin identificar';
    // baciloscopia
    r.hasB = r.smears.length > 0 || !!v[COL.B_COL];
    const res = r.smears.map(s => s.res).filter(x => x && x !== 'OTRO');
    r.bk = res[0] || null; r.bkRec = bkRec; r.bkInf = r.smears.length ? r.smears[0].inf : null;
    r.bkPos = res.some(x => BK_POS.has(x)); r.bkNeg = res.length > 0 && res.every(x => x === 'NEG');
    // molecular
    r.mol = { esp: molEsp(v[COL.M_ESP]), H: sens(v[COL.M_H]), R: sens(v[COL.M_R]), Q: sens(v[COL.M_Q]), I: sens(v[COL.M_I]), met: v[COL.M_MET] };
    r.hasM = !!(r.mol.esp || r.mRec || r.mol.met);
    // PSF y controles
    r.psf = COL.P_FARM.some(c => v[c]); r.psfNuevos = COL.P_NUEVOS.some(c => v[c]);
    r.ctrl = COL.CTRL.map(c => ({ bk: v[c.bk] ? N(v[c.bk]) : null, cul: v[c.cul] ? N(v[c.cul]) : null, rec: dt(c.rec) })).filter(c => c.bk || c.cul || c.rec);
    return r;
  }
  return { derivar, N, sinTilde, titleCase, bk, BK_POS, liq, sens, molEsp };
})();
