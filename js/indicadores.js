/* indicadores.js — Los 27 indicadores del «Libro TB INDICADORES» del INS (hoja INDICADORES TOTALES),
   calculados por trimestre y consolidado. Cada definición reproduce las fórmulas COUNTIFS de la hoja
   INDICADORES NOMINALES; donde la fórmula original tiene un error evidente se corrige y se documenta
   en «ajuste» (se muestra en la interfaz y en la exportación). */
'use strict';

const Indicadores = (() => {
  const dias = (a, b) => a && b ? Math.round((b - a) / 86400000) : null;
  const media = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  const mediana = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const cnt = (rows, f) => rows.reduce((s, r) => s + (f(r) ? 1 : 0), 0);
  const prop = (rows, fn, fd) => ({ n: cnt(rows, r => fd(r) && fn(r)), d: cnt(rows, fd) });
  const PROB = new Set(['S', 'R', 'NI']);
  const mtb = r => r.mol.esp === 'MTB', conMol = r => !!r.mol.esp;
  const rr = r => mtb(r) && r.mol.R === 'R';
  const monoH = r => mtb(r) && r.mol.H === 'R' && r.mol.R === 'S';
  const pulm = r => r.tb === 'PULMONAR';
  const smearsRes = r => r.smears.filter(s => s.res && s.res !== 'OTRO');

  const DEF = [
    // ——— PRUEBAS MOLECULARES ———
    { sec: 'Pruebas moleculares', cod: '1', nombre: 'Número de ensayos realizados', tipo: 'conteo', construccion: 'Total de muestras procesadas por prueba molecular para diagnóstico (especie identificada diligenciada).',
      f: rows => ({ n: cnt(rows, conMol) }) },
    { sec: 'Pruebas moleculares', cod: '2', nombre: 'Proporción de M. tuberculosis detectado sensible a H y R o a R', tipo: 'prop', construccion: 'Muestras MTBc con rifampicina SENSIBLE (isoniacida sensible o no aplica) / muestras con MTBc detectado por prueba molecular.',
      ajuste: 'En el libro Excel, si la isoniacida queda en blanco la muestra no se cuenta (#N/A). Aquí se cuenta como «no aplica» y el control de calidad avisa del blanco.',
      f: rows => prop(rows, r => r.mol.R === 'S' && r.mol.H !== 'R' && r.mol.H !== 'NI', mtb) },
    { sec: 'Pruebas moleculares', cod: '3', nombre: 'Proporción de M. tuberculosis detectado resistente a H y R o a R', tipo: 'prop', construccion: 'Muestras MTBc con rifampicina RESISTENTE / muestras con MTBc detectado por prueba molecular.',
      f: rows => prop(rows, r => r.mol.R === 'R', mtb) },
    { sec: 'Pruebas moleculares', cod: '4', nombre: 'Proporción de M. tuberculosis detectado resistente a H', tipo: 'prop', construccion: 'Muestras MTBc con isoniacida RESISTENTE y rifampicina SENSIBLE / muestras con MTBc detectado.',
      f: rows => prop(rows, monoH, mtb) },
    { sec: 'Pruebas moleculares', cod: '5', nombre: 'Proporción de M. tuberculosis con resistencia indeterminada (no interpretable)', tipo: 'prop', construccion: 'Muestras MTBc con isoniacida o rifampicina NO INTERPRETABLE / muestras con MTBc detectado.',
      ajuste: 'La tabla auxiliar del libro (listas 1!AP:AQ) omite combinaciones como H «no aplica» + R «no interpretable» (resultado típico de Xpert). Aquí cuentan todas.',
      f: rows => prop(rows, r => r.mol.H === 'NI' || r.mol.R === 'NI', mtb) },
    { sec: 'Pruebas moleculares', cod: '6', nombre: 'Proporción de M. tuberculosis no detectado', tipo: 'prop', construccion: 'Muestras con resultado «No detectado» / total de muestras procesadas por prueba molecular.',
      f: rows => prop(rows, r => r.mol.esp === 'ND', conMol) },
    { sec: 'Pruebas moleculares', cod: '7', nombre: 'Proporción de pruebas moleculares con errores', tipo: 'prop', construccion: 'Muestras con resultado «Error» / total de muestras procesadas por prueba molecular.',
      f: rows => prop(rows, r => r.mol.esp === 'ERR', conMol) },
    { sec: 'Pruebas moleculares', cod: '8', nombre: 'Proporción de pruebas moleculares con resultado inválido', tipo: 'prop', construccion: 'Muestras con resultado «Inválido» / total de muestras procesadas por prueba molecular.',
      f: rows => prop(rows, r => r.mol.esp === 'INV', conMol) },
    { sec: 'Pruebas moleculares', cod: '9', nombre: 'Oportunidad de respuesta de la prueba molecular (días, promedio)', tipo: 'media', construccion: 'Promedio de días entre la recepción de la muestra en el laboratorio y el informe del resultado molecular.',
      f: rows => { const a = rows.filter(conMol).map(r => dias(r.mRec, r.mInf)).filter(x => x != null && x >= 0 && x <= 60); return { v: media(a), med: mediana(a), d: a.length }; } },
    { sec: 'Pruebas moleculares', cod: '9.1', nombre: 'Porcentaje de muestras con reporte molecular oportuno (≤ 2 días)', tipo: 'prop', construccion: 'Muestras con informe molecular en 2 días o menos desde la recepción / número de ensayos realizados.',
      f: rows => prop(rows, r => { const x = dias(r.mRec, r.mInf); return x != null && x >= 0 && x <= 2; }, conMol) },
    { sec: 'Pruebas moleculares', cod: '10', nombre: 'Proporción de casos resistentes solo a H con pruebas a quinolonas e inyectables', tipo: 'prop', construccion: 'Muestras MTBc resistentes solo a H con resultado para quinolonas e inyectables / muestras MTBc resistentes solo a H.',
      ajuste: 'La fórmula del libro solo cuenta quinolonas e inyectables SENSIBLES, con lo que excluye a quienes resultaron resistentes. Aquí cuenta cualquier resultado (sensible, resistente o no interpretable), igual que el indicador 11.',
      f: rows => prop(rows, r => PROB.has(r.mol.Q) && PROB.has(r.mol.I), monoH) },
    { sec: 'Pruebas moleculares', cod: '11', nombre: 'Proporción de casos resistentes a H y R o a R con pruebas a quinolonas e inyectables', tipo: 'prop', construccion: 'Muestras MTBc resistentes a rifampicina con resultado para quinolonas o inyectables / muestras MTBc resistentes a rifampicina.',
      f: rows => prop(rows, r => PROB.has(r.mol.Q) || PROB.has(r.mol.I), rr) },
    { sec: 'Pruebas moleculares', cod: '12', nombre: 'Proporción de casos resistentes a H y R o a R enviados a pruebas de otros fármacos (Bdq, Dlm, Cfz, Lzd)', tipo: 'prop', construccion: 'Muestras MTBc resistentes a rifampicina con algún resultado de linezolid, delamanid, clofazimina o bedaquilina / muestras MTBc resistentes a rifampicina.',
      ajuste: 'En el libro el numerador cuenta cualquier muestra con esos fármacos, aunque no sea resistente a rifampicina; aquí se restringe al denominador.',
      f: rows => prop(rows, r => r.psfNuevos, rr) },
    { sec: 'Pruebas moleculares', cod: '13', nombre: 'M. tuberculosis detectado por prueba molecular con cultivo positivo', tipo: 'prop', construccion: 'Muestras MTBc por prueba molecular con cultivo POSITIVO / muestras con MTBc detectado.',
      f: rows => prop(rows, r => r.liqRaw === 'POS', mtb) },
    { sec: 'Pruebas moleculares', cod: '14', nombre: 'M. tuberculosis detectado por prueba molecular con cultivo negativo', tipo: 'prop', construccion: 'Muestras MTBc por prueba molecular con cultivo líquido NEGATIVO / muestras con MTBc detectado.',
      f: rows => prop(rows, r => r.liqRaw === 'NEG', mtb) },
    { sec: 'Pruebas moleculares', cod: '15', nombre: 'M. tuberculosis detectado por prueba molecular con cultivo no realizado', tipo: 'prop', construccion: 'Muestras MTBc por prueba molecular con cultivo NO REALIZADO / muestras con MTBc detectado.',
      f: rows => prop(rows, r => r.liqRaw === 'NR', mtb) },
    { sec: 'Pruebas moleculares', cod: '16', nombre: 'M. tuberculosis no detectado por prueba molecular con cultivo positivo', tipo: 'prop', construccion: 'Muestras «No detectado» por prueba molecular con cultivo POSITIVO / muestras «No detectado».',
      f: rows => prop(rows, r => r.liqRaw === 'POS', r => r.mol.esp === 'ND') },
    { sec: 'Pruebas moleculares', cod: '17', nombre: 'M. tuberculosis detectado por prueba molecular con cultivo contaminado', tipo: 'prop', construccion: 'Muestras MTBc por prueba molecular con cultivo líquido CONTAMINADO / muestras con MTBc detectado.',
      f: rows => prop(rows, r => r.liqRaw === 'CONT', mtb) },
    // ——— CULTIVO ———
    { sec: 'Cultivo', cod: '1 C', nombre: 'Porcentaje de tubos de cultivo líquido contaminados', tipo: 'prop', construccion: 'Tubos contaminados en medio líquido / tubos sembrados con resultado (positivo + negativo + contaminado) × 100.',
      f: rows => prop(rows, r => r.liqRaw === 'CONT', r => ['POS', 'NEG', 'CONT'].includes(r.liqRaw)) },
    { sec: 'Cultivo', cod: '2 C', nombre: 'Aporte del cultivo al diagnóstico de TB pulmonar (frente a baciloscopia)', tipo: 'prop', construccion: 'Muestras pulmonares con baciloscopia negativa y cultivo MTBc / muestras pulmonares confirmadas por baciloscopia y/o cultivo.',
      ajuste: 'En el libro el numerador exige «RESULTADO FINAL BKS = NEGATIVO», valor que esa columna nunca toma, por lo que siempre da 0. Aquí BK negativa = todas las baciloscopias de la muestra con resultado «−».',
      f: rows => { const P = rows.filter(pulm); return { n: cnt(P, r => r.bkNeg && r.cultMtb), d: cnt(P, r => r.cultMtb || r.bkPos) }; } },
    { sec: 'Cultivo', cod: '3 C', nombre: 'Aporte del cultivo al diagnóstico de TB pulmonar (frente a prueba molecular)', tipo: 'prop', construccion: 'Muestras pulmonares con prueba molecular negativa, no interpretable, inválida o con error y cultivo MTBc / muestras pulmonares con MTBc por prueba molecular y/o cultivo.',
      f: rows => { const P = rows.filter(pulm); return { n: cnt(P, r => ['ND', 'NI', 'INV', 'ERR'].includes(r.mol.esp) && r.cultMtb), d: cnt(P, r => mtb(r) || r.cultMtb) }; } },
    { sec: 'Cultivo', cod: '4 C', nombre: 'Oportunidad de respuesta del cultivo (días, promedio)', tipo: 'media', construccion: 'Promedio de días entre la recepción de la muestra en el laboratorio y el informe del cultivo e identificación.',
      f: rows => { const a = rows.filter(r => r.hasC).map(r => dias(r.cRec, r.cInf)).filter(x => x != null && x >= 0 && x <= 180); return { v: media(a), med: mediana(a), d: a.length }; } },
    // ——— BACILOSCOPIA ———
    { sec: 'Baciloscopia', cod: '1 B', nombre: 'Número de baciloscopias realizadas', tipo: 'conteo', construccion: 'Total de baciloscopias de diagnóstico con resultado (BK 1, 2 y 3 de cada muestra).',
      f: rows => ({ n: rows.reduce((s, r) => s + smearsRes(r).length, 0) }) },
    { sec: 'Baciloscopia', cod: '2 B', nombre: 'Porcentaje de baciloscopias de diagnóstico positivas', tipo: 'prop', construccion: 'Baciloscopias de diagnóstico positivas (1–9 BAAR, +, ++, +++, positivo escasos) / baciloscopias de diagnóstico realizadas × 100.',
      f: rows => { let n = 0, d = 0; rows.forEach(r => smearsRes(r).forEach(s => { d++; if (Modelo.BK_POS.has(s.res)) n++; })); return { n, d }; } },
    { sec: 'Baciloscopia', cod: '3 B', nombre: 'Porcentaje de baciloscopias de control de tratamiento positivas', tipo: 'prop', construccion: 'Baciloscopias de control positivas / total de baciloscopias de control con resultado × 100.',
      f: rows => { let n = 0, d = 0; rows.forEach(r => r.ctrl.forEach(c => { if (!c.bk) return; d++; const x = Modelo.bk(c.bk); if (Modelo.BK_POS.has(x)) n++; })); return { n, d }; } },
    { sec: 'Baciloscopia', cod: '4 B', nombre: 'Concentración de la baciloscopia (BK por sintomático respiratorio)', tipo: 'razon', construccion: 'Baciloscopias de diagnóstico realizadas / personas evaluadas con baciloscopia (pacientes únicos).',
      ajuste: 'El libro divide por todas las filas (incluidas las que solo tienen cultivo); aquí el denominador son las personas con al menos una baciloscopia.',
      f: rows => { const B = rows.filter(r => smearsRes(r).length); const p = new Set(B.map(r => r.pid || 'f' + r.archivo + '-' + r.fila)); return { n: B.reduce((s, r) => s + smearsRes(r).length, 0), d: p.size }; } },
    { sec: 'Baciloscopia', cod: '5 B', nombre: 'Proporción de muestras deficientes (saliva) entre las baciloscopias de diagnóstico', tipo: 'prop', construccion: 'Baciloscopias de diagnóstico con calidad de muestra «Saliva» / baciloscopias de diagnóstico realizadas.',
      f: rows => { let n = 0, d = 0; rows.forEach(r => smearsRes(r).forEach(s => { d++; if (s.cal === 'SALIVA') n++; })); return { n, d }; } },
    { sec: 'Baciloscopia', cod: '6 B', nombre: 'Oportunidad de respuesta de la baciloscopia (días, promedio)', tipo: 'media', construccion: 'Promedio de días entre la recepción de la muestra y el informe de cada baciloscopia.',
      f: rows => { const a = []; rows.forEach(r => r.smears.forEach(s => { const x = dias(s.rec, s.inf); if (x != null && x >= 0 && x <= 60) a.push(x); })); return { v: media(a), med: mediana(a), d: a.length }; } }
  ];

  const trimestre = r => r.fecha ? Math.floor(r.fecha.getMonth() / 3) + 1 : null;
  /* rows ya filtrados por año y tipo de TB. Devuelve [{def, T:[q1..q4], total}] */
  function calcular(rows) {
    const Q = [1, 2, 3, 4].map(q => rows.filter(r => trimestre(r) === q));
    return DEF.map(def => ({ def, T: Q.map(def.f), total: def.f(rows) }));
  }
  return { DEF, calcular, trimestre };
})();
