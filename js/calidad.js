/* calidad.js — Control de calidad del diligenciamiento de la hoja BD_BK_CULTIVO_PM.
   Severidad: 'error' (el dato impide o distorsiona un indicador), 'aviso' (revisar), 'info'.
   Los valores se comparan con las listas desplegables oficiales de la plantilla (catalogos.js):
     · igual al catálogo → válido
     · solo cambia mayúsculas → info (Excel lo cuenta igual)
     · cambia tildes o espacios → aviso (los COUNTIFS del libro de indicadores NO lo cuentan)
     · no está en el catálogo → error
   Nunca se muestran nombres ni documentos: solo fila, n.º de orden, columna y valor del campo revisado. */
'use strict';

const Calidad = (() => {
  const { N } = Modelo;
  const DIA = 86400000;
  const dias = (a, b) => a && b ? Math.round((b - a) / DIA) : null;
  const lower = s => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
  const sets = {};
  function catalogo(nombre) {
    if (sets[nombre]) return sets[nombre];
    const lista = (CATALOGOS[nombre] || []).map(x => String(x).replace(/\s+/g, ' ').trim()); // la plantilla trae espacios finales
    return (sets[nombre] = { exacto: new Set(lista), casi: new Map(lista.map(x => [lower(x), x])), norm: new Map(lista.map(x => [N(x).replace(/\s/g, ''), x])) });
  }
  /* → null si es válido; si no, {sev, motivo, sugerido} */
  function enLista(valor, nombre) {
    if (valor == null) return null;
    const s = String(valor), c = catalogo(nombre);
    if (c.exacto.has(s)) return null;
    if (c.casi.has(lower(s))) return { sev: 'info', motivo: 'difiere solo en mayúsculas', sugerido: c.casi.get(lower(s)) };
    const k = N(s).replace(/\s/g, '');
    if (c.norm.has(k)) return { sev: 'aviso', motivo: 'difiere en tildes o espacios (el libro de indicadores no lo cuenta)', sugerido: c.norm.get(k) };
    return { sev: 'error', motivo: 'valor fuera de la lista oficial', sugerido: null };
  }

  /* ——— Definición de reglas (catálogo visible en la interfaz) ——— */
  const R = {};
  const regla = (id, sev, area, titulo, desc) => (R[id] = { id, sev, area, titulo, desc });
  regla('dup', 'error', 'Estructura', 'N.º de orden repetido en el mismo libro', 'Cada fila debe tener un n.º de orden único. Las filas repetidas se cuentan una sola vez (se conserva la última).');
  regla('dupArch', 'info', 'Estructura', 'N.º de orden presente en varios libros cargados', 'Normal al combinar meses. Se conserva el registro del archivo más reciente.');
  regla('trim', 'aviso', 'Estructura', 'Trimestre (col. A) no coincide con la fecha', 'El libro de indicadores INS filtra por la columna A; si no coincide con el trimestre de la fecha de recepción, el caso cae en otro trimestre.');
  regla('trimVacio', 'info', 'Estructura', 'Columna Trimestre (A) vacía', 'El libro de indicadores INS usa esta columna para separar trimestres. La PWA usa la fecha de recepción, pero el libro Excel no contará la fila.');
  regla('oblig', 'error', 'Datos básicos', 'Variable obligatoria sin diligenciar', 'Departamento, laboratorio, nombres, apellido, sexo, edad, identificación, municipio, EAPB, tipo de muestra, tipo de TB y fecha de toma.');
  regla('lista', 'error', 'Listas', 'Valor fuera de la lista oficial', 'El valor no corresponde a ninguna opción de la lista desplegable de la plantilla INS.');
  regla('listaTilde', 'aviso', 'Listas', 'Valor con tildes o espacios distintos a la lista', 'Parece el valor correcto, pero escrito distinto; los COUNTIFS del libro de indicadores no lo cuentan.');
  regla('listaMay', 'info', 'Listas', 'Valor con mayúsculas distintas a la lista', 'Excel lo cuenta igual, pero conviene uniformarlo.');
  regla('edad', 'aviso', 'Datos básicos', 'Edad con formato no estándar', 'La lista admite «<1mes», «1m»…«11m» y años enteros de 1 a 119.');
  regla('otroTm', 'error', 'Datos básicos', '«Otro tipo de muestra» sin especificar', 'Si el tipo de muestra es «OTRO TIPO DE MUESTRA», la columna O es obligatoria.');
  regla('tmTb', 'aviso', 'Coherencia', 'Tipo de muestra incoherente con el tipo de TB', 'Según la plantilla, cada tipo de muestra corresponde a TB pulmonar o extrapulmonar (p. ej., esputo → pulmonar; líquido pleural → extrapulmonar).');
  regla('pacSexo', 'aviso', 'Coherencia', 'Mismo paciente con sexo distinto entre muestras', 'Se compara por seudónimo del documento; puede indicar error de digitación del documento o del sexo.');
  regla('pacEdad', 'aviso', 'Coherencia', 'Mismo paciente con edades que difieren más de 2 años', 'Se compara por seudónimo del documento en las muestras cargadas.');
  regla('fTexto', 'info', 'Fechas', 'Fecha escrita como texto', 'La celda contiene texto con forma de fecha, no una fecha de Excel; las restas de días del libro pueden fallar.');
  regla('fInval', 'error', 'Fechas', 'Fecha ilegible', 'El contenido de una columna de fecha no se puede interpretar como fecha.');
  regla('fFutura', 'error', 'Fechas', 'Fecha posterior a la fecha de corte', 'Fecha en el futuro respecto a la fecha de corte del control.');
  regla('fAntigua', 'aviso', 'Fechas', 'Fecha anterior a 2015', 'Probable error de digitación del año.');
  regla('fOrden', 'error', 'Fechas', 'Fechas en orden imposible', 'Toma después de recepción o informe antes de recepción.');
  regla('tatLargo', 'aviso', 'Fechas', 'Tiempo de respuesta atípicamente largo', 'Cultivo > 90 días, baciloscopia > 7 días o prueba molecular > 15 días entre recepción e informe.');
  regla('cTipo', 'error', 'Cultivo', 'Cultivo sin tipo (sólido/líquido)', 'Hay datos de cultivo pero falta «Tipo de cultivo».');
  regla('cSolLiq', 'aviso', 'Cultivo', 'Resultado sólido diligenciado con tipo LÍQUIDO (o al revés)', 'El resultado no corresponde al tipo de cultivo registrado.');
  regla('cSinRes', 'error', 'Cultivo', 'Cultivo informado sin resultado', 'Tiene fecha de informe pero no resultado.');
  regla('cSinInf', 'error', 'Cultivo', 'Cultivo con resultado sin fecha de informe', 'No se puede calcular la oportunidad (indicador 4 C).');
  regla('cSinRec', 'error', 'Cultivo', 'Cultivo con resultado sin fecha de recepción', 'No se puede asignar el periodo ni la oportunidad.');
  regla('cPosSinEsp', 'error', 'Cultivo', 'Cultivo positivo sin especie identificada', 'Un cultivo positivo debe tener identificación (MTBc o especie de MNT).');
  regla('cEspSinPos', 'error', 'Cultivo', 'Especie registrada en cultivo no positivo', 'Hay especie identificada pero el resultado del cultivo no es positivo.');
  regla('cIdPend', 'aviso', 'Cultivo', 'Identificación pendiente o no concluyente en cultivo positivo', '«No amplificó», «No detectado» o «No interpretable» en un cultivo positivo: requiere identificación.');
  regla('abierto42', 'aviso', 'Pendientes', 'Cultivo sin cerrar: 43–60 días', 'Superó los 42 días del protocolo de cultivo líquido sin resultado.');
  regla('abierto60', 'error', 'Pendientes', 'Cultivo sin cerrar: más de 60 días', 'Cultivo sin resultado más de 60 días después de la recepción. Verifique si se informó y no se digitó.');
  regla('bkAbierta', 'aviso', 'Pendientes', 'Baciloscopia sin resultado después del umbral', 'Baciloscopia recibida sin resultado tras más días que el umbral configurado.');
  regla('molAbierta', 'aviso', 'Pendientes', 'Prueba molecular sin resultado después de 2 días', 'Muestra recibida para prueba molecular sin resultado.');
  regla('bkSinInf', 'error', 'Baciloscopia', 'Baciloscopia con resultado sin fecha de informe', 'No se cuenta en el indicador 1 B del libro y no permite calcular la oportunidad.');
  regla('bkSinRec', 'error', 'Baciloscopia', 'Baciloscopia con resultado sin fecha de recepción', 'No permite calcular la oportunidad ni la concentración en esputo.');
  regla('bkCol', 'aviso', 'Baciloscopia', 'Baciloscopia sin tipo de coloración', 'Diligencie ZN, AURAMINA u OTRA.');
  regla('bkCal', 'aviso', 'Baciloscopia', 'Esputo sin calidad de muestra', 'La calidad (saliva, moco, mucopurulenta, hemoptoica) alimenta el indicador 5 B.');
  regla('bkConf', 'info', 'Baciloscopia', 'Baciloscopia «Se requiere confirmación»', 'Resultado intermedio: verifique si ya se confirmó.');
  regla('mMet', 'error', 'Molecular', 'Prueba molecular sin metodología', 'Diligencie la metodología (Xpert, Truenat, etc.).');
  regla('mSinInf', 'error', 'Molecular', 'Prueba molecular con resultado sin fecha de informe o recepción', 'No permite calcular la oportunidad (indicador 9).');
  regla('mRif', 'error', 'Molecular', 'MTBc detectado sin resultado de rifampicina', 'Los indicadores 2, 3 y 11 requieren el resultado de rifampicina.');
  regla('mInh', 'aviso', 'Molecular', 'MTBc detectado con isoniacida en blanco', 'Use «NO APLICA» si la prueba no evalúa isoniacida; en blanco el libro Excel excluye la muestra del indicador 2.');
  regla('mSensSinMtb', 'error', 'Molecular', 'Sensibilidad registrada sin MTBc detectado', 'Hay resultados de H/R/Q/I pero la especie no es «Complejo M. tuberculosis».');
  regla('psfSinMtb', 'aviso', 'PSF', 'Prueba fenotípica sin MTBc confirmado', 'Hay resultados de PSF pero ni el cultivo ni la prueba molecular registran MTBc.');
  regla('psfDatos', 'error', 'PSF', 'Prueba fenotípica sin fecha de recepción, metodología o informe', 'Complete los datos de la PSF.');
  regla('ctrlFecha', 'aviso', 'Controles', 'Control de tratamiento sin fecha de recepción', 'Resultado de control sin fecha.');

  /* Variables para la tabla de completitud: [etiqueta, función(r) → diligenciado?] */
  const COMPLETITUD = [
    ['Departamento', r => !!r.v[COL.DPTO]], ['Laboratorio', r => !!r.v[COL.LAB]], ['Nombres', r => r.tieneNombre], ['Primer apellido', r => r.tieneApellido],
    ['Sexo', r => !!r.v[COL.SEXO]], ['Edad', r => r.v[COL.EDAD] != null], ['Identificación', r => r.tieneId], ['Municipio', r => !!r.v[COL.MUN]],
    ['EAPB', r => !!r.v[COL.EAPB]], ['Tipo de muestra', r => !!r.v[COL.TM]], ['Tipo de TB', r => !!r.v[COL.TB]], ['Fecha de toma', r => !!r.d[COL.F_TOMA]],
    ['Trimestre (col. A)', r => !!r.v[COL.TRIM]]
  ];
  const OBLIG = [[COL.DPTO, 'v'], [COL.LAB, 'v'], [4, 'nom'], [5, 'ape'], [COL.SEXO, 'v'], [COL.EDAD, 'v'], [9, 'id'], [COL.MUN, 'v'], [COL.EAPB, 'v'], [COL.TM, 'v'], [COL.TB, 'v'], [COL.F_TOMA, 'd']];
  const LISTAS = [[COL.DPTO, 'DEPARTAMENTO'], [COL.SEXO, 'SEXO'], [COL.MUN, 'MUNICIPIO'], [COL.EAPB, 'EAPB'], [COL.TM, 'TIPO_MUESTRA'], [COL.TB, 'TIPO_TB'],
    [COL.M_MET, 'METODO_MOL'], [COL.M_ESP, 'ESPECIE_MOL'], [COL.M_H, 'SENSIB'], [COL.M_R, 'SENSIB'], [COL.M_Q, 'SENSIB'], [COL.M_I, 'SENSIB'],
    [COL.C_TIPO, 'TIPO_CULTIVO'], [COL.C_LIQ, 'RES_LIQ'], [COL.C_SOL, 'RES_SOL'], [COL.C_ESP, 'ESPECIE_CULT'], [COL.P_MET, 'METODO_PSF'],
    ...COL.P_FARM.map(c => [c, 'SENSIB']), [COL.B_COL, 'COLORACION'],
    ...COL.BK.flatMap(b => [[b.cal, 'CALIDAD_BK'], [b.res, 'RES_BK']]), ...COL.CTRL.flatMap(c => [[c.bk, 'RES_BK'], [c.cul, 'RES_CTRL_CULT']])];
  const MUESTRA_TB = new Map(Object.entries(CATALOGOS.MUESTRA_TB).map(([k, t]) => [N(k), t]));
  const EDAD_OK = /^(<1mes|([1-9]|1[01])m|[1-9]\d?|1[01]\d)$/;

  /* registros: derivados (ya deduplicados); dups: {mismoLibro:[r], entreLibros:[{orden,..}]}
     opts: {corte: Date, bkDias: n} */
  function evaluar(registros, dups, opts) {
    const corte = opts.corte, hallazgos = new Map(Object.keys(R).map(k => [k, []]));
    const add = (id, r, col, valor, detalle) => hallazgos.get(id).push({ fila: r.fila, orden: r.orden, archivo: r.archivo, col, valor: valor == null ? '' : String(valor).slice(0, 60), detalle: detalle || '' });
    const conError = new Set(), conAviso = new Set();
    const ref = new Map(); // seudónimo → {sexo, edades}
    const abiertos = [];

    (dups.mismoLibro || []).forEach(r => add('dup', r, COL.ORDEN, r.orden, 'también en la fila ' + r.filaOtra));
    (dups.entreLibros || []).forEach(r => add('dupArch', r, COL.ORDEN, r.orden, r.detalle));

    for (const r of registros) {
      const v = r.v, d = r.d;
      // obligatorias
      for (const [c, k] of OBLIG) {
        const ok = k === 'v' ? v[c] != null : k === 'd' ? !!d[c] : k === 'nom' ? r.tieneNombre : k === 'ape' ? r.tieneApellido : r.tieneId;
        if (!ok) add('oblig', r, c, '', 'vacío');
      }
      // listas
      for (const [c, lista] of LISTAS) {
        const e = enLista(v[c], lista); if (!e) continue;
        add(e.sev === 'error' ? 'lista' : e.sev === 'aviso' ? 'listaTilde' : 'listaMay', r, c, v[c], e.sugerido ? 'debe ser «' + e.sugerido + '»' : e.motivo);
      }
      if (v[COL.EDAD] != null && !EDAD_OK.test(String(v[COL.EDAD]).trim())) add('edad', r, COL.EDAD, v[COL.EDAD], 'formato no estándar');
      if (r.tmN === 'OTRO TIPO DE MUESTRA' && !v[COL.OTRO_TM]) add('otroTm', r, COL.OTRO_TM, '', 'vacío');
      const esperado = MUESTRA_TB.get(N(v[COL.TM]));
      if (esperado && r.tb && N(esperado) !== r.tb) add('tmTb', r, COL.TB, v[COL.TB], `${v[COL.TM]} corresponde a ${esperado}`);
      // trimestre col. A
      const q = r.fecha ? ['I', 'II', 'III', 'IV'][Math.floor(r.fecha.getMonth() / 3)] : null;
      if (!v[COL.TRIM]) add('trimVacio', r, COL.TRIM, '', q ? 'debería ser ' + q : '');
      else if (q && N(v[COL.TRIM]) !== q) add('trim', r, COL.TRIM, v[COL.TRIM], 'según la fecha es ' + q);
      // fechas
      for (const c of Lector.FECHAS) {
        const f = d[c]; if (!f) continue;
        if (f.k === 'invalida') { add('fInval', r, c, f.x, 'no es una fecha'); continue; }
        if (f.k === 'texto') add('fTexto', r, c, f.x, 'texto, no fecha');
        if (f.t > corte.getTime() + DIA) add('fFutura', r, c, new Date(f.t).toISOString().slice(0, 10), 'posterior al corte');
        else if (f.t < Date.UTC(2015, 0, 1)) add('fAntigua', r, c, new Date(f.t).toISOString().slice(0, 10), '');
      }
      const ord = (a, b, cb, txt) => { if (a && b && b < a) add('fOrden', r, cb, b.toLocaleDateString('es-CO'), txt + ' (' + a.toLocaleDateString('es-CO') + ')'); };
      ord(r.toma, r.cRec, COL.C_REC, 'recepción del cultivo antes de la toma');
      ord(r.cRec, r.cInf, COL.C_INF, 'informe del cultivo antes de la recepción');
      ord(r.toma, r.mRec, COL.M_REC, 'recepción molecular antes de la toma');
      ord(r.mRec, r.mInf, COL.M_INF, 'informe molecular antes de la recepción');
      const fx = t => new Date(t).toISOString().slice(0, 10);
      COL.BK.forEach((b, i) => { const s = { rec: r.d[b.rec], inf: r.d[b.inf] }; if (s.rec && s.inf && s.rec.t != null && s.inf.t != null && s.inf.t < s.rec.t) add('fOrden', r, b.inf, fx(s.inf.t), `informe BK ${i + 1} antes de la recepción (${fx(s.rec.t)})`); if (r.toma && s.rec && s.rec.t != null && s.rec.t < Date.UTC(r.toma.getFullYear(), r.toma.getMonth(), r.toma.getDate())) add('fOrden', r, b.rec, fx(s.rec.t), `recepción BK ${i + 1} antes de la toma`); });
      const tC = dias(r.cRec, r.cInf); if (tC != null && tC > 90) add('tatLargo', r, COL.C_INF, tC + ' días', 'cultivo');
      const tM = dias(r.mRec, r.mInf); if (tM != null && tM > 15) add('tatLargo', r, COL.M_INF, tM + ' días', 'molecular');

      // cultivo
      const tipo = N(v[COL.C_TIPO]), cl = v[COL.C_LIQ], cs = v[COL.C_SOL];
      if (r.hasC) {
        if (!tipo && (cl || cs || r.cInf)) add('cTipo', r, COL.C_TIPO, '', 'vacío');
        if (tipo === 'LIQUIDO' && cs && !cl) add('cSolLiq', r, COL.C_SOL, cs, 'tipo LIQUIDO con resultado sólido');
        if (tipo === 'SOLIDO' && cl && !cs) add('cSolLiq', r, COL.C_LIQ, cl, 'tipo SOLIDO con resultado líquido');
        const conRes = !!(cl || cs);
        if (r.cInf && !conRes) add('cSinRes', r, COL.C_LIQ, '', 'informe sin resultado');
        if (conRes && !r.cInf && r.liqRaw !== 'NR') add('cSinInf', r, COL.C_INF, '', 'vacío');
        if (conRes && !r.cRec) add('cSinRec', r, COL.C_REC, '', 'vacío');
        const pos = r.liq === 'POS';
        const espV = v[COL.C_ESP], espN = N(espV);
        if (pos && !espV) add('cPosSinEsp', r, COL.C_ESP, '', 'vacío');
        if (espV && !pos && !/CONTAM|NO DETECT|NO AMPLIF|NO INTERPRET/.test(espN) && ['NEG', 'NR', 'CONT'].includes(r.liq)) add('cEspSinPos', r, COL.C_ESP, espV, 'resultado: ' + cl);
        if (pos && /NO DETECT|NO AMPLIF|NO INTERPRET/.test(espN)) add('cIdPend', r, COL.C_ESP, espV, '');
        if (!conRes && r.cRec && tipo !== 'NO REALIZADO') {
          const dd = dias(r.cRec, corte);
          if (dd != null && dd >= 0) { abiertos.push({ r, dias: dd }); if (dd > 60) add('abierto60', r, COL.C_LIQ, dd + ' días', 'recibido ' + r.cRec.toLocaleDateString('es-CO')); else if (dd > 42) add('abierto42', r, COL.C_LIQ, dd + ' días', 'recibido ' + r.cRec.toLocaleDateString('es-CO')); }
        }
      }
      // baciloscopia
      let algunaBk = false;
      COL.BK.forEach((b, i) => {
        const res = v[b.res], rec = d[b.rec], inf = d[b.inf];
        if (res) {
          algunaBk = true;
          if (!inf) add('bkSinInf', r, b.inf, '', `BK ${i + 1}`);
          if (!rec) add('bkSinRec', r, b.rec, '', `BK ${i + 1}`);
          if (r.tmN === 'ESPUTO' && !v[b.cal]) add('bkCal', r, b.cal, '', `BK ${i + 1}`);
          if (Modelo.bk(res) === 'CONF') add('bkConf', r, b.res, res, `BK ${i + 1}`);
        } else if (rec && rec.t != null) {
          const dd = Math.round((corte.getTime() - rec.t) / DIA);
          if (dd > opts.bkDias) add('bkAbierta', r, b.res, dd + ' días', `BK ${i + 1}`);
        }
      });
      if (algunaBk && !v[COL.B_COL]) add('bkCol', r, COL.B_COL, '', 'vacío');
      // molecular
      const m = r.mol;
      if (r.hasM) {
        if (m.esp && !m.met) add('mMet', r, COL.M_MET, '', 'vacío');
        if (m.esp && (!r.mInf || !r.mRec)) add('mSinInf', r, r.mInf ? COL.M_REC : COL.M_INF, '', 'vacío');
        if (m.esp === 'MTB' && !m.R) add('mRif', r, COL.M_R, '', 'vacío');
        if (m.esp === 'MTB' && !m.H) add('mInh', r, COL.M_H, '', 'use NO APLICA');
        if (m.esp && m.esp !== 'MTB' && [m.H, m.R, m.Q, m.I].some(x => x === 'S' || x === 'R')) add('mSensSinMtb', r, COL.M_R, v[COL.M_R] || v[COL.M_H], 'especie: ' + v[COL.M_ESP]);
        if (!m.esp && r.mRec) { const dd = dias(r.mRec, corte); if (dd > 2) add('molAbierta', r, COL.M_ESP, dd + ' días', ''); }
      }
      // PSF
      if (r.psf) {
        if (!r.cultMtb && m.esp !== 'MTB') add('psfSinMtb', r, COL.P_FARM[0], '', 'sin MTBc');
        if (!d[COL.P_REC] || !v[COL.P_MET] || !d[COL.P_INF1]) add('psfDatos', r, !d[COL.P_REC] ? COL.P_REC : !v[COL.P_MET] ? COL.P_MET : COL.P_INF1, '', 'vacío');
      }
      COL.CTRL.forEach((c, i) => { if ((v[c.bk] || v[c.cul]) && !d[c.rec]) add('ctrlFecha', r, c.rec, '', `control ${i + 1}`); });
      // paciente (seudónimo)
      if (r.pid) { if (!ref.has(r.pid)) ref.set(r.pid, { sexo: new Set(), edad: [], r }); const p = ref.get(r.pid); if (r.sexo) p.sexo.add(r.sexo); if (r.edad != null) p.edad.push({ e: r.edad, f: r.fecha }); }
    }
    for (const p of ref.values()) {
      if (p.sexo.size > 1) add('pacSexo', p.r, COL.SEXO, [...p.sexo].join(' y '), 'mismo documento');
      if (p.edad.length > 1) {
        // descuenta el tiempo transcurrido entre muestras
        const aj = p.edad.map(x => x.e - (x.f ? (x.f - p.edad[0].f) / (365.25 * DIA) : 0));
        if (Math.max(...aj) - Math.min(...aj) > 2) add('pacEdad', p.r, COL.EDAD, p.edad.map(x => Math.round(x.e)).join(', '), 'mismo documento');
      }
    }
    // resumen
    const reglas = [];
    for (const [id, items] of hallazgos) {
      if (!items.length) continue;
      const def = R[id]; const filas = new Set(items.map(i => i.archivo + ':' + i.fila));
      filas.forEach(k => (def.sev === 'error' ? conError : def.sev === 'aviso' ? conAviso : new Set()).add(k));
      reglas.push({ ...def, n: items.length, filas: filas.size, items });
    }
    const ordenSev = { error: 0, aviso: 1, info: 2 };
    reglas.sort((a, b) => ordenSev[a.sev] - ordenSev[b.sev] || b.n - a.n);
    const total = registros.length;
    const completitud = COMPLETITUD.map(([l, f]) => { const n = registros.reduce((s, r) => s + (f(r) ? 1 : 0), 0); return { variable: l, n, pct: total ? n / total * 100 : null }; });
    return { total, reglas, completitud, abiertos, filasError: conError.size, filasAviso: [...conAviso].filter(k => !conError.has(k)).length };
  }
  return { evaluar, REGLAS: R, enLista };
})();
