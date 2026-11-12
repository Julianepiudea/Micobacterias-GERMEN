/* app.js — Interfaz: carga de libros, filtros, pestañas, calidad del dato, indicadores INS,
   exportaciones, instalación como aplicación y service worker. */
'use strict';
const APP_VERSION = '1.1.0';

/* === ESTADO (solo en memoria) === */
let RECORDS = new Map();          // clave archivo|orden → registro derivado (sin nombres ni documento)
let FILES = [], CHARTS = {}, EXPORT = [], SUPPRESS = true, PYR = 'all', SALT = null;
let DUPS = { mismoLibro: [], entreLibros: [] };
const STATE = { tab: 'calidad', corte: null, qc: null, open: new Set(), insVista: 'tarjetas', insSec: 'all', metaEdit: null };
const TH = { cont: 10, tatC: 56, tatB: 2, bkAb: 3 };
try { Object.assign(TH, JSON.parse(localStorage.getItem('mico-umbrales') || '{}')); } catch (e) { /* sin almacenamiento */ }

const hoy = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const isoDia = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function newSalt() { const a = new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); }

/* === LECTURA (Web Worker; si no está disponible, en esta misma página) === */
let worker = null, workerFalla = false, seq = 0;
function leerArchivo(file) {
  return file.arrayBuffer().then(buffer => {
    if (!workerFalla && typeof Worker !== 'undefined') {
      try { if (!worker) worker = new Worker('js/lector.worker.js'); } catch (e) { workerFalla = true; }
    }
    if (worker && !workerFalla) return new Promise((ok, mal) => {
      const id = ++seq;
      const h = e => {
        const m = e.data; if (m.id !== id) return;
        if (m.tipo === 'progreso') { $('loading-txt').textContent = m.txt; return; }
        worker.removeEventListener('message', h);
        m.tipo === 'ok' ? ok(m.res) : mal(new Error(m.msg));
      };
      worker.addEventListener('message', h);
      worker.addEventListener('error', ev => { ev.preventDefault(); workerFalla = true; worker = null; Lector.leer(buffer, file.name, SALT, t => $('loading-txt').textContent = t).then(ok, mal); }, { once: true });
      worker.postMessage({ id, buffer, nombre: file.name, sal: SALT }, [buffer]);
    });
    return Lector.leer(buffer, file.name, SALT, t => $('loading-txt').textContent = t);
  });
}

async function loadFiles(list) {
  const files = [...list].filter(Boolean).sort((a, b) => a.lastModified - b.lastModified); // el más reciente prevalece
  if (!files.length) return;
  if (!SALT) SALT = newSalt();
  $('loading').style.display = 'flex';
  const errores = [];
  // índice orden → registro vigente (para detectar repetidos entre libros)
  const porOrden = new Map([...RECORDS.values()].map(r => [r.orden, r]));
  for (const f of files) {
    $('loading-txt').textContent = 'Leyendo ' + f.name + '…';
    try {
      const res = await leerArchivo(f);
      const idx = FILES.length, vistos = new Map();
      let n = 0;
      for (const raw of res.registros) {
        const r = Modelo.derivar(raw, f.name);
        if (vistos.has(r.orden)) { DUPS.mismoLibro.push({ ...r, filaOtra: vistos.get(r.orden) }); }
        vistos.set(r.orden, r.fila);
        const prev = porOrden.get(r.orden);
        if (prev && prev.archivo !== f.name) { DUPS.entreLibros.push({ ...r, detalle: 'reemplaza a ' + prev.archivo + ' fila ' + prev.fila }); RECORDS.delete(prev.archivo + '|' + prev.orden); }
        RECORDS.set(f.name + '|' + r.orden, r); porOrden.set(r.orden, r); n++;
      }
      FILES.push({ name: f.name, n, idx });
      res.avisos.forEach(a => errores.push(f.name + ': ' + a));
      if (!n) errores.push(f.name + ': la hoja no tiene órdenes');
    } catch (e) { errores.push(f.name + ': no se pudo leer (' + e.message + ')'); }
  }
  $('loading').style.display = 'none';
  if (errores.length) alert(errores.join('\n'));
  if (!RECORDS.size) return;
  $('landing').hidden = true; $('dash').hidden = false;
  if (!STATE.corte) { STATE.corte = hoy(); $('q-corte').value = isoDia(STATE.corte); }
  buildYearFilter(); refresh();
}

/* === FILTROS === */
function buildYearFilter() {
  const ys = [...new Set([...RECORDS.values()].map(r => r.fecha && r.fecha.getFullYear()).filter(Boolean))].sort();
  const sel = $('f-year'), cur = sel.value;
  sel.innerHTML = '<option value="all">Todos</option>' + ys.map(y => `<option>${y}</option>`).join('');
  sel.value = ys.includes(+cur) ? cur : (ys.length ? String(ys[ys.length - 1]) : 'all');
}
/* opts.periodo=false ignora el filtro de periodo; opts.sinFecha=true conserva registros sin fecha */
function filtered(opts = {}) {
  const y = $('f-year').value, p = opts.periodo === false ? 'all' : $('f-per').value, tb = $('f-tb').value;
  return [...RECORDS.values()].filter(r => {
    if (tb !== 'all' && r.tb !== tb) return false;
    if (y === 'all' && p === 'all') return true;
    if (!r.fecha) return !!opts.sinFecha;
    if (y !== 'all' && r.fecha.getFullYear() !== +y) return false;
    const m = r.fecha.getMonth() + 1;
    if (p[0] === 'Q') return Math.ceil(m / 3) === +p[1];
    if (p[0] === 'M') return m === +p.slice(1);
    return true;
  });
}
const filtroTxt = () => `año=${$('f-year').value}; periodo=${$('f-per').selectedOptions[0].text}; tipo TB=${$('f-tb').selectedOptions[0].text}`;

/* === PESTAÑAS === */
function setTab(t) {
  STATE.tab = t;
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  ['calidad', 'tablero', 'ins'].forEach(k => $('p-' + k).hidden = k !== t);
  if (history.replaceState) history.replaceState(null, '', '#' + t);
  refresh();
}
function refresh() {
  if (!RECORDS.size) return;
  $('gen-date').textContent = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  renderCalidad();               // siempre: alimenta el contador de la pestaña
  if (STATE.tab === 'tablero') render();
  if (STATE.tab === 'ins') renderINS();
  if (STATE.tab !== 'tablero') {
    const rows = filtered(), dates = rows.map(r => r.fecha).filter(Boolean).sort((a, b) => a - b);
    $('sub').textContent = FILES.length === 1 ? FILES[0].name : FILES.length + ' libros combinados';
    $('context').innerHTML = `<span>Archivos: <b>${FILES.map(f => esc(f.name) + ' (' + fmtInt(f.n) + ')').join(' · ')}</b></span><span>Rango de fechas: <b>${dates.length ? dates[0].toLocaleDateString('es-CO') + ' – ' + dates[dates.length - 1].toLocaleDateString('es-CO') : '—'}</b></span>`;
  }
  Editor.aplicarTextos();
}

/* === CALIDAD DEL DATO === */
const SEV_TXT = { error: 'Error', aviso: 'Aviso', info: 'Info' };
function renderCalidad() {
  const rows = filtered({ sinFecha: true });
  const qc = Calidad.evaluar(rows, filtrarDups(rows), { corte: STATE.corte || hoy(), bkDias: TH.bkAb });
  STATE.qc = qc;
  const pctOk = qc.total ? (qc.total - qc.filasError) / qc.total * 100 : null;
  const nErr = qc.reglas.filter(r => r.sev === 'error').reduce((s, r) => s + r.n, 0);
  const nAv = qc.reglas.filter(r => r.sev === 'aviso').reduce((s, r) => s + r.n, 0);
  const ab = qc.abiertos, ab60 = ab.filter(a => a.dias > 60).length, ab42 = ab.filter(a => a.dias > 42 && a.dias <= 60).length;
  const badge = $('badge-q'); badge.textContent = nErr ? fmtInt(nErr) : '✓'; badge.className = 'badge ' + (nErr ? 'err' : 'ok');
  badge.title = nErr ? `${nErr} errores` : 'Sin errores';
  if (STATE.tab !== 'calidad') return;

  const K = (label, val, sub, color) => `<div class="kpi" style="--kc:${color}"><div class="kpi-label">${label}</div><div class="kpi-val">${val}</div><div class="kpi-sub">${sub}</div></div>`;
  $('q-score').innerHTML =
    K('Registros sin errores', `${fmt1(pctOk)}<small>%</small>`, `${fmtInt(qc.total - qc.filasError)} de ${fmtInt(qc.total)} registros evaluados`, pctOk >= 95 ? 'var(--good)' : pctOk >= 80 ? 'var(--warn)' : 'var(--crit)') +
    K('Errores', fmtInt(nErr), `en ${fmtInt(qc.filasError)} registros · afectan indicadores`, 'var(--crit)') +
    K('Avisos', fmtInt(nAv), `en ${fmtInt(qc.filasAviso)} registros más · revisar`, 'var(--warn)') +
    K('Cultivos sin cerrar', fmtInt(ab.length), `${fmtInt(ab60)} con más de 60 días · ${fmtInt(ab42)} de 43–60 días`, ab60 ? 'var(--crit)' : 'var(--teal)');

  // filtro por área y severidad
  const areaSel = $('q-area'), areas = [...new Set(Object.values(Calidad.REGLAS).map(r => r.area))];
  if (areaSel.options.length === 1) areaSel.insertAdjacentHTML('beforeend', areas.map(a => `<option>${esc(a)}</option>`).join(''));
  const fs = $('q-sev').value, fa = areaSel.value;
  const vis = qc.reglas.filter(r => (fs === 'all' || (fs === 'error' ? r.sev === 'error' : r.sev !== 'info')) && (fa === 'all' || r.area === fa));
  const colTxt = c => `${letraCol(c)} · ${esc(NOMBRE_COL[c] || '')}`;
  let h = `<table class="rules"><thead><tr><th>Severidad</th><th>Regla</th><th class="n">Hallazgos</th><th class="n">Registros</th></tr></thead><tbody>`;
  if (!vis.length) h += `<tr><td colspan="4"><div class="empty">${qc.reglas.length ? 'Sin hallazgos con estos filtros' : '¡Sin hallazgos! El libro cumple todas las reglas.'}</div></td></tr>`;
  vis.forEach(r => {
    const open = STATE.open.has(r.id);
    h += `<tr data-rule="${r.id}" style="cursor:pointer"><td><span class="sev ${r.sev}">${SEV_TXT[r.sev]}</span></td><td><div class="t">${open ? '▾' : '▸'} ${esc(r.titulo)}</div><div class="dsc">${esc(r.desc)}</div><div class="area">${esc(r.area)}</div></td><td class="n">${fmtInt(r.n)}</td><td class="n">${fmtInt(r.filas)}<div class="area">${fmt1(r.filas / qc.total * 100)} %</div></td></tr>`;
    if (open) {
      const MAX = 300, items = [...r.items].sort((a, b) => a.archivo.localeCompare(b.archivo) || a.fila - b.fila);
      const multi = FILES.length > 1;
      h += `<tr class="det"><td colspan="4"><table class="items"><thead><tr>${multi ? '<th>Libro</th>' : ''}<th>Fila</th><th>N.º orden</th><th>Columna</th><th>Valor</th><th>Detalle</th></tr></thead><tbody>${items.slice(0, MAX).map(i => `<tr>${multi ? `<td>${esc(i.archivo)}</td>` : ''}<td>${i.fila}</td><td><code>${esc(i.orden)}</code></td><td>${colTxt(i.col)}</td><td>${i.valor ? `<code>${esc(i.valor)}</code>` : '<span style="color:var(--ink3)">(vacío)</span>'}</td><td>${esc(i.detalle)}</td></tr>`).join('')}</tbody></table>${items.length > MAX ? `<div class="more">… y ${fmtInt(items.length - MAX)} más. Descargue la lista de corrección para verlos todos.</div>` : ''}</td></tr>`;
    }
  });
  $('q-rules').innerHTML = h + '</tbody></table>';

  // completitud
  $('q-comp').innerHTML = qc.completitud.map(c => { const cls = c.pct >= 95 ? '' : c.pct >= 80 ? 'mid' : 'bad'; return `<div class="cbar"><span>${esc(c.variable)}</span><div class="ibar"><i class="${cls}" style="width:${c.pct || 0}%"></i></div><span class="p">${fmt1(c.pct)} %</span></div>`; }).join('');

  // cultivos abiertos por antigüedad
  const BINS = [[0, 14], [15, 28], [29, 42], [43, 60], [61, 90], [91, 180], [181, 1e9]];
  const lab = BINS.map(([a, b]) => b > 1e8 ? '> 180' : `${a}–${b}`), cnt = BINS.map(([a, b]) => ab.filter(x => x.dias >= a && x.dias <= b).length);
  const col = BINS.map(([a]) => a > 60 ? cssv('--crit') : a > 42 ? cssv('--warn') : cssv('--good'));
  const o = baseOpts(); o.scales.x.title = { display: true, text: 'Días sin resultado', color: cssv('--ink3') };
  o.plugins.tooltip.callbacks = { title: c => `${c[0].label} días`, label: c => ` ${fmtInt(c.raw)} cultivos` };
  mk('ch-open', { type: 'bar', data: { labels: lab, datasets: [bar('Cultivos', cnt, col)] }, options: o });
  $('q-open-desc').textContent = `Días desde la recepción hasta la fecha de corte (${(STATE.corte || hoy()).toLocaleDateString('es-CO')})`;
  const masViejo = ab.length ? Math.max(...ab.map(a => a.dias)) : null;
  $('q-open-note').textContent = ab.length ? `${fmtInt(ab.length)} cultivos recibidos sin resultado; el más antiguo lleva ${masViejo} días. Los de más de 42 días aparecen en la regla «Cultivo sin cerrar».` : 'No hay cultivos pendientes de resultado.';

  // calidad por mes
  const marca = new Map(); qc.reglas.forEach(r => r.items.forEach(i => { const k = i.archivo + '|' + i.orden; if (!marca.has(k)) marca.set(k, { e: 0, a: 0 }); if (r.sev === 'error') marca.get(k).e++; else if (r.sev === 'aviso') marca.get(k).a++; }));
  const byM = new Map();
  rows.forEach(r => { if (!r.fecha) return; const k = r.fecha.getFullYear() * 100 + r.fecha.getMonth(); if (!byM.has(k)) byM.set(k, { n: 0, ok: 0, e: 0, a: 0 }); const m = byM.get(k), q = marca.get(r.archivo + '|' + r.orden); m.n++; if (!q || !q.e) m.ok++; if (q) { m.e += q.e; m.a += q.a; } });
  const keys = [...byM.keys()].sort((a, b) => a - b), multiY = new Set(keys.map(k => Math.floor(k / 100))).size > 1;
  const labels = keys.map(k => MES[k % 100] + (multiY ? ' ' + String(Math.floor(k / 100)).slice(2) : '')), M = keys.map(k => byM.get(k));
  const o2 = baseOpts();
  o2.scales = { x: o2.scales.x, y: { ...o2.scales.y, position: 'left', title: { display: true, text: 'Hallazgos', color: cssv('--ink3') } }, y2: { position: 'right', min: 0, max: 100, grid: { display: false }, border: { display: false }, ticks: { callback: v => v + ' %', color: cssv('--ink2') } } };
  o2.scales.x.stacked = true; o2.scales.y.stacked = true;
  o2.plugins.tooltip.callbacks = { label: c => c.datasetIndex === 0 ? ` Sin errores: ${fmt1(c.raw)} % (${fmtInt(M[c.dataIndex].ok)}/${fmtInt(M[c.dataIndex].n)})` : ` ${c.dataset.label}: ${fmtInt(c.raw)}` };
  mk('ch-qmes', { type: 'bar', data: { labels, datasets: [
    { type: 'line', label: 'Sin errores', data: M.map(m => m.ok / m.n * 100), yAxisID: 'y2', borderColor: cssv('--s1'), backgroundColor: cssv('--s1'), borderWidth: 2, pointRadius: 4, pointBorderColor: cssv('--surface'), pointBorderWidth: 2, tension: .25 },
    bar('Errores', M.map(m => m.e), cssv('--crit'), { stack: 'h' }), bar('Avisos', M.map(m => m.a), cssv('--warn'), { stack: 'h' })] }, options: o2 });
}
function filtrarDups(rows) {
  const keys = new Set(rows.map(r => r.orden));
  return { mismoLibro: DUPS.mismoLibro.filter(r => keys.has(r.orden)), entreLibros: DUPS.entreLibros.filter(r => keys.has(r.orden)) };
}
function csvDe(lineas) { return '﻿' + lineas.map(r => r.map(v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n'); }
function exportCalidadResumen() {
  const qc = STATE.qc; if (!qc) return;
  const L = [['Resumen de calidad del dato — Micobacterias GERMEN v' + APP_VERSION], ['Filtros: ' + filtroTxt() + '; fecha de corte=' + isoDia(STATE.corte)], ['Registros evaluados', qc.total], ['Registros sin errores', qc.total - qc.filasError], [],
    ['Severidad', 'Área', 'Regla', 'Hallazgos', 'Registros afectados', '% registros']];
  qc.reglas.forEach(r => L.push([SEV_TXT[r.sev], r.area, r.titulo, r.n, r.filas, String(Math.round(r.filas / qc.total * 1000) / 10).replace('.', ',')]));
  L.push([], ['Completitud', 'Diligenciados', '%']); qc.completitud.forEach(c => L.push([c.variable, c.n, c.pct == null ? '' : String(Math.round(c.pct * 10) / 10).replace('.', ',')]));
  L.push([], ['Cultivos sin cerrar (días)', 'n']); [[0, 42], [43, 60], [61, 90], [91, 1e9]].forEach(([a, b]) => L.push([b > 1e8 ? '> 90' : `${a}–${b}`, qc.abiertos.filter(x => x.dias >= a && x.dias <= b).length]));
  download(new Blob([csvDe(L)], { type: 'text/csv;charset=utf-8' }), `calidad_resumen_micobacterias_${stamp()}.csv`);
}
function exportCalidadLista() {
  const qc = STATE.qc; if (!qc) return;
  if (!confirm('La lista de corrección contiene n.º de orden y fila de Excel de cada hallazgo (sin nombres ni documentos).\nEs para uso interno del laboratorio: no la comparta fuera de la institución.\n\n¿Descargar?')) return;
  const L = [['Libro', 'Fila Excel', 'N.º de orden', 'Columna', 'Variable', 'Valor registrado', 'Severidad', 'Regla', 'Detalle']];
  const all = []; qc.reglas.forEach(r => r.items.forEach(i => all.push([i.archivo, i.fila, i.orden, letraCol(i.col), NOMBRE_COL[i.col] || '', i.valor, SEV_TXT[r.sev], r.titulo, i.detalle])));
  all.sort((a, b) => String(a[0]).localeCompare(b[0]) || a[1] - b[1]);
  download(new Blob([csvDe(L.concat(all))], { type: 'text/csv;charset=utf-8' }), `lista_correccion_USO_INTERNO_${stamp()}.csv`);
}

/* === INDICADORES INS === */
function celdaINS(def, x) {
  if (def.tipo === 'conteo') return x.n ? `<b>${fmtN(x.n)}</b>` : '<span class="na">0</span>';
  if (def.tipo === 'media') return x.d ? `<b>${fmt1(x.v)} d</b><span>mediana ${fmt1(x.med)} · n=${fmtInt(x.d)}</span>` : '<span class="na">—</span>';
  if (!x.d) return '<span class="na">—</span>';
  if (def.tipo === 'razon') return `<b>${fmt1(x.n / x.d)}</b><span>${fmtInt(x.n)}/${fmtInt(x.d)}</span>`;
  return hidden(x.n) ? `<b>—</b><span>&lt;5/${fmtInt(x.d)}</span>` : `<b>${fmt1(x.n / x.d * 100)} %</b><span>${fmtInt(x.n)}/${fmtInt(x.d)}</span>`;
}
/* Metas: las define el laboratorio (se recuerdan en este equipo). Por defecto, los umbrales configurados. */
let METAS = {};
try { METAS = JSON.parse(localStorage.getItem('mico-metas') || '{}') || {}; } catch (e) { /* sin almacenamiento */ }
const guardarMetas = () => { try { localStorage.setItem('mico-metas', JSON.stringify(METAS)); } catch (e) { /* sin almacenamiento */ } };
function metaDe(cod) {
  if (cod in METAS) return METAS[cod];
  return ({ '1 C': { op: '<=', v: TH.cont }, '4 C': { op: '<=', v: TH.tatC }, '6 B': { op: '<=', v: TH.tatB } })[cod] || null;
}
/* Sentido deseable de cada indicador (para colorear la variación entre trimestres) */
const INS_MEJOR = { '5': 'bajo', '7': 'bajo', '8': 'bajo', '9': 'bajo', '9.1': 'alto', '10': 'alto', '11': 'alto', '12': 'alto', '15': 'bajo', '17': 'bajo', '1 C': 'bajo', '4 C': 'bajo', '5 B': 'bajo', '6 B': 'bajo' };
const ROM = ['I', 'II', 'III', 'IV'];
function valINS(def, x) {
  if (def.tipo === 'conteo') return x.n || 0;
  if (def.tipo === 'media') return x.d ? x.v : null;
  if (!x.d || hidden(x.n)) return null;
  return def.tipo === 'razon' ? x.n / x.d : x.n / x.d * 100;
}
const unidadINS = def => def.tipo === 'prop' ? ' %' : def.tipo === 'media' ? ' d' : '';
function txtINS(def, v) { if (v == null) return '—'; if (def.tipo === 'conteo') return fmtN(v); return fmt1(v) + unidadINS(def); }
function cumpleINS(def, v) { const m = metaDe(def.cod); if (!m || v == null) return null; return m.op === '<=' ? v <= m.v : v >= m.v; }

function sparkINS(def, vals) {
  const W = 220, H = 52, bw = 38, gap = (W - 4 * bw) / 3, m = metaDe(def.cod);
  const mx = Math.max(1e-9, ...vals.filter(v => v != null), m ? m.v : 0) * 1.08;
  let s = `<svg class="spk" viewBox="0 0 ${W} ${H + 16}" role="img" aria-label="Valor por trimestre">`;
  vals.forEach((v, i) => {
    const x = i * (bw + gap);
    s += v == null ? `<rect class="nd" x="${x}" y="${H - 2}" width="${bw}" height="2"/>`
      : `<rect class="b${i === 3 || vals.slice(i + 1).every(z => z == null) ? ' last' : ''}" x="${x}" y="${(H - Math.max(3, v / mx * H)).toFixed(1)}" width="${bw}" height="${Math.max(3, v / mx * H).toFixed(1)}" rx="4"><title>Trimestre ${ROM[i]}: ${txtINS(def, v)}</title></rect>`;
    s += `<text x="${x + bw / 2}" y="${H + 13}">${ROM[i]}</text>`;
  });
  if (m) { const y = (H - m.v / mx * H).toFixed(1); s += `<line class="meta" x1="0" x2="${W}" y1="${y}" y2="${y}"><title>Meta ${m.op === '<=' ? '≤' : '≥'} ${fmt1(m.v)}</title></line>`; }
  return s + '</svg>';
}
function tarjetaINS({ def, T, total }) {
  const v = valINS(def, total), ok = cumpleINS(def, v), m = metaDe(def.cod), vals = T.map(x => valINS(def, x));
  const idx = vals.map((x, i) => x == null ? null : i).filter(i => i != null);
  let delta = '<span class="dl eq">Un solo trimestre con datos</span>';
  if (!idx.length) delta = '<span class="dl eq">Sin datos por trimestre</span>';
  if (idx.length >= 2) {
    const a = idx[idx.length - 2], b = idx[idx.length - 1], dv = vals[b] - vals[a], dir = INS_MEJOR[def.cod];
    const cls = Math.abs(dv) < 1e-9 ? 'eq' : !dir ? 'neu' : (dv < 0) === (dir === 'bajo') ? 'up' : 'down';
    const u = def.tipo === 'prop' ? ' pp' : def.tipo === 'media' ? ' d' : '';
    delta = `<span class="dl ${cls}">${dv > 0 ? '▲' : dv < 0 ? '▼' : '='} ${def.tipo === 'conteo' ? fmtInt(Math.abs(dv)) : fmt1(Math.abs(dv))}${u}<small> trim. ${ROM[b]} vs ${ROM[a]}</small></span>`;
  }
  const nd = def.tipo === 'conteo' ? 'consolidado del periodo' : def.tipo === 'media' ? (total.d ? `mediana ${fmt1(total.med)} d · ${fmtInt(total.d)} muestras` : 'sin muestras con fechas') : total.d ? `${hidden(total.n) ? '&lt;5' : fmtInt(total.n)} de ${fmtInt(total.d)}` : 'sin denominador';
  const estado = ok == null ? 'none' : ok ? 'ok' : 'bad';
  const editando = STATE.metaEdit === def.cod;
  const metaTxt = m ? `Meta ${m.op === '<=' ? '≤' : '≥'} ${fmt1(m.v)}${unidadINS(def)}` : 'Definir meta';
  const pctBar = def.tipo === 'prop' && v != null ? `<div class="ic-pbar"><i style="width:${Math.min(100, v)}%"></i>${m && def.tipo === 'prop' ? `<b style="left:${Math.min(100, m.v)}%"></b>` : ''}</div>` : '';
  return `<article class="ic ${estado}" data-cod="${esc(def.cod)}">
    <header><span class="cod">${esc(def.cod)}</span>${def.ajuste ? `<span class="ajc" title="${esc(def.ajuste)}">▲ ajustado</span>` : ''}${ok != null ? `<span class="st ${estado}">${ok ? '✓ cumple' : '✕ no cumple'}</span>` : ''}</header>
    <h4 title="${esc(def.construccion)}">${esc(def.nombre)}</h4>
    <div class="ic-v">${v == null ? '—' : def.tipo === 'conteo' ? fmtN(v) : fmt1(v)}<small>${v == null ? '' : unidadINS(def)}</small></div>
    <div class="ic-nd">${nd}</div>${pctBar}
    ${sparkINS(def, vals)}
    <footer>${delta}<button class="meta-chip" type="button" data-meta="${esc(def.cod)}">${metaTxt}</button></footer>
    ${editando ? `<div class="meta-ed" data-cod="${esc(def.cod)}"><select data-meta-op><option value="<="${m && m.op === '<=' ? ' selected' : ''}>≤ como máximo</option><option value=">="${m && m.op === '>=' ? ' selected' : ''}>≥ como mínimo</option></select><input data-meta-v type="number" step="any" value="${m ? m.v : ''}" placeholder="valor${unidadINS(def)}"><button class="btn primary" type="button" data-meta-ok>Guardar</button><button class="btn" type="button" data-meta-del>Sin meta</button></div>` : ''}
  </article>`;
}
function anilloINS(p, color, centro, etiqueta, sub) {
  const r = 42, C = 2 * Math.PI * r, off = C * (1 - Math.min(100, Math.max(0, p || 0)) / 100);
  return `<div class="ring"><div class="ring-g"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${r}" class="rb"/><circle cx="50" cy="50" r="${r}" class="rf" transform="rotate(-90 50 50)" style="stroke:${color};stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${off.toFixed(1)};--c:${C.toFixed(1)}"/></svg><div class="rv">${centro}</div></div><div class="rl">${etiqueta}</div><div class="rs">${sub}</div></div>`;
}

function renderINS() {
  const rows = filtered({ periodo: false });
  const res = Indicadores.calcular(rows);
  STATE.ins = res;
  const R = cod => res.find(x => x.def.cod === cod);
  const ajustes = Indicadores.DEF.filter(d => d.ajuste).length;
  const hayMol = rows.some(r => r.hasM);

  /* --- portada con anillos --- */
  const conMeta = res.map(x => cumpleINS(x.def, valINS(x.def, x.total))).filter(x => x != null);
  const ringDe = (cod, etq, colorBase) => {
    const x = R(cod), v = valINS(x.def, x.total), ok = cumpleINS(x.def, v);
    const col = ok == null ? colorBase : ok ? '#5fe08a' : '#ff7a7a';
    const sub = x.total.d ? `${hidden(x.total.n) ? '&lt;5' : fmtInt(x.total.n)} de ${fmtInt(x.total.d)}${ok == null ? '' : ok ? ' · cumple meta' : ' · fuera de meta'}` : 'sin datos';
    return anilloINS(v, col, v == null ? '—' : `${fmt1(v)}<small>%</small>`, `${etq} <span>(${cod})</span>`, sub);
  };
  const anio = $('f-year').value === 'all' ? 'Todos los años' : 'Año ' + $('f-year').value;
  const tbTxt = $('f-tb').value === 'all' ? 'TB pulmonar y extrapulmonar' : 'TB ' + $('f-tb').selectedOptions[0].text.toLowerCase();
  const mtbN = R('3').total.d;
  $('ins-hero').innerHTML = `
    <svg class="hero-bac" viewBox="0 0 400 220" aria-hidden="true"><g stroke-linecap="round" fill="none"><path d="M40 170 C90 120 140 120 200 90"/><path d="M90 200 C150 160 200 150 260 110"/><path d="M180 60 C220 40 260 40 310 20"/><path d="M260 150 C300 130 330 130 380 100"/><path d="M300 70 C330 60 350 60 380 45"/></g></svg>
    <div class="hero-l">
      <div class="eyebrow">Indicadores INS · laboratorio del programa de tuberculosis</div>
      <h2>${esc(anio)}</h2>
      <div class="hero-sub">${esc(tbTxt)} · ${fmtInt(rows.length)} muestras · cuatro trimestres y consolidado</div>
      <div class="hero-n">
        <div><b>${fmtN(R('1').total.n)}</b><span>ensayos moleculares</span></div>
        <div><b>${fmtN(mtbN)}</b><span>con MTBc detectado</span></div>
        <div><b>${fmtN(R('1 B').total.n)}</b><span>baciloscopias</span></div>
      </div>
      <div class="hero-m"><span><b>${conMeta.filter(Boolean).length}</b> de ${conMeta.length} indicadores con meta la cumplen</span><span><b>${ajustes}</b> definiciones ajustadas ▲</span></div>
    </div>
    <div class="hero-r">
      ${ringDe('3', 'Resistencia a rifampicina', '#ff5c9a')}
      ${ringDe('9.1', 'Molecular informado ≤ 2 días', '#7fd6dc')}
      ${ringDe('1 C', 'Contaminación del cultivo', '#ffc24a')}
      ${ringDe('2 B', 'Baciloscopias positivas', '#8dbfe8')}
    </div>`;

  const w = [];
  if (!hayMol) w.push('El libro no tiene datos de pruebas moleculares (columnas Q–X): los indicadores 1 a 17 y 3 C quedan vacíos.');
  if ($('f-year').value === 'all' && new Set(rows.map(r => r.fecha && r.fecha.getFullYear()).filter(Boolean)).size > 1) w.push('Con «Año: Todos» los trimestres suman varios años. Seleccione un año para el reporte trimestral al INS.');
  if ($('f-per').value !== 'all') w.push('Esta pestaña ignora el filtro de periodo: siempre muestra los cuatro trimestres y el consolidado.');
  const sinF = rows.filter(r => !r.fecha).length; if (sinF) w.push(`${fmtInt(sinF)} muestras sin ninguna fecha solo cuentan en el consolidado.`);
  $('ins-warn').hidden = !w.length;
  $('ins-warn').innerHTML = `<svg class="i" viewBox="0 0 24 24"><path d="M12 8v5M12 17h0"/><circle cx="12" cy="12" r="9"/></svg><div>${w.map(esc).join('<br>')}</div>`;
  /* --- gráficos --- */
  const pc = (n, d) => d && !hidden(n) ? n / d * 100 : null;
  const ens = R('1').total.n, nd = R('6').total.n, er = R('7').total.n, inv = R('8').total.n, otro = Math.max(0, ens - mtbN - nd - er - inv);
  const molCats = [['MTBc detectado', mtbN, cssv('--crit')], ['No detectado', nd, cssv('--neutral')], ['Error', er, cssv('--warn')], ['Inválido', inv, cssv('--serious')]].concat(otro ? [['Otro resultado', otro, cssv('--muted')]] : []);
  const oM = baseOpts(); oM.scales = {}; oM.cutout = '62%'; oM.interaction = { mode: 'nearest', intersect: true };
  oM.plugins.legend = { display: true, position: 'right', labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, color: cssv('--ink2'), generateLabels: ch => ch.data.labels.map((l, i) => ({ text: `${l}  ${fmtN(ch.data.datasets[0].data[i])}`, fillStyle: ch.data.datasets[0].backgroundColor[i], strokeStyle: ch.data.datasets[0].backgroundColor[i], pointStyle: 'circle', index: i, hidden: !ch.getDataVisibility(i), fontColor: cssv('--ink2') })) } };
  oM.plugins.tooltip.callbacks = { label: c => ` ${c.label}: ${fmtN(c.raw)} (${ens && !hidden(c.raw) ? fmt1(c.raw / ens * 100) + ' %' : '—'})` };
  mk('ch-ins-mol', { type: 'doughnut', data: { labels: molCats.map(c => c[0]), datasets: [{ label: 'Ensayos', data: molCats.map(c => c[1]), backgroundColor: molCats.map(c => c[2]), hoverBackgroundColor: molCats.map(c => c[2]), borderColor: cssv('--surface'), borderWidth: 2 }] }, options: oM });
  $('ins-mol-note').textContent = ens ? `${fmtN(ens)} ensayos; MTBc detectado en ${fmt1(pc(mtbN, ens))} %. Errores e inválidos: ${fmt1(pc(er + inv, ens))} %.` : 'Sin pruebas moleculares en la selección.';

  const resCats = [['Sensible a R', '2', cssv('--good')], ['Resistente a R (con o sin H)', '3', cssv('--crit')], ['Resistente solo a H', '4', cssv('--serious')], ['No interpretable', '5', cssv('--neutral')]];
  const resN = {}; resCats.forEach(([l, c]) => resN[l] = R(c).total);
  const oR = baseOpts(); oR.indexAxis = 'y'; oR.interaction = { mode: 'nearest', axis: 'y', intersect: false };
  oR.scales = { x: { beginAtZero: true, max: 100, grid: { color: cssv('--grid') }, border: { display: false }, ticks: { callback: v => v + ' %' } }, y: { grid: { display: false }, border: { color: cssv('--line') } } };
  oR.plugins.tooltip.callbacks = { label: c => { const t = resN[c.label]; return t && t.d ? ` ${c.raw == null ? '—' : fmt1(c.raw) + ' %'} · ${fmtN(t.n)}/${fmtInt(t.d)}` : ' sin datos'; } };
  oR.plugins.etiquetas = { display: true };
  mk('ch-ins-res', { type: 'bar', data: { labels: resCats.map(c => c[0]), datasets: [bar('% de MTBc', resCats.map(([l]) => pc(resN[l].n, resN[l].d)), resCats.map(c => c[2]), { maxBarThickness: 34, borderSkipped: 'start' })] }, options: oR });
  $('ins-res-note').textContent = mtbN ? `Base: ${fmtN(mtbN)} muestras con MTBc detectado. Las categorías pueden superponerse (p. ej. R resistente con H no interpretable).` : 'Sin MTBc detectado por prueba molecular.';

  const cuartos = [...R('13').T, R('13').total].map((_, i) => i);
  const labQ = ['Trim. I', 'Trim. II', 'Trim. III', 'Trim. IV', 'Anual'];
  const serie = cod => cuartos.map(i => { const x = i < 4 ? R(cod).T[i] : R(cod).total; return x.d ? x.n / x.d * 100 : null; });
  const sPos = serie('13'), sNeg = serie('14'), sNR = serie('15'), sCont = serie('17');
  const sOtro = cuartos.map(i => sPos[i] == null ? null : Math.max(0, 100 - sPos[i] - sNeg[i] - sNR[i] - sCont[i]));
  const oC = baseOpts(); oC.scales.x.stacked = true; oC.scales.y.stacked = true; oC.scales.y.max = 100; oC.scales.y.ticks = { callback: v => v + ' %', color: cssv('--ink2') };
  const dQ = i => i < 4 ? R('13').T[i].d : R('13').total.d;
  oC.plugins.tooltip.callbacks = { title: c => `${c[0].label} · ${fmtN(dQ(c[0].dataIndex))} muestras MTBc`, label: c => ` ${c.dataset.label}: ${c.raw == null ? '—' : fmt1(c.raw) + ' %'}` };
  mk('ch-ins-cult', { type: 'bar', data: { labels: labQ, datasets: [bar('Positivo', sPos, cssv('--crit'), { borderRadius: 0 }), bar('Negativo', sNeg, cssv('--neutral'), { borderRadius: 0 }), bar('Contaminado', sCont, cssv('--warn'), { borderRadius: 0 }), bar('No realizado', sNR, cssv('--muted'), { borderRadius: 0 }), bar('Pendiente / sin dato', sOtro, cssv('--line'), { borderRadius: 0 })] }, options: oC });

  const tend = [['Resistencia a R (3)', '3', cssv('--crit')], ['Molecular ≤ 2 d (9.1)', '9.1', cssv('--teal')], ['Contaminación (1 C)', '1 C', cssv('--warn')], ['BK positivas (2 B)', '2 B', cssv('--s1')]];
  const oT = baseOpts(); oT.scales.y.ticks = { callback: v => v + ' %', color: cssv('--ink2') }; oT.scales.y.suggestedMax = 100;
  oT.plugins.tooltip.callbacks = { label: c => ` ${c.dataset.label}: ${c.raw == null ? '—' : fmt1(c.raw) + ' %'}` };
  mk('ch-ins-tend', { type: 'line', data: { labels: ROM.map(r => 'Trim. ' + r), datasets: tend.map(([l, c, col]) => ({ label: l, data: R(c).T.map(x => valINS(R(c).def, x)), borderColor: col, backgroundColor: col, borderWidth: 2.5, pointRadius: 5, pointHoverRadius: 7, pointBorderColor: cssv('--surface'), pointBorderWidth: 2, tension: .3, spanGaps: true })) }, options: oT });

  /* --- tarjetas de los 27 indicadores --- */
  const vista = STATE.insVista || 'tarjetas', secSel = STATE.insSec || 'all';
  $('ins-cards').hidden = vista !== 'tarjetas'; $('ins-tabla-card').hidden = vista !== 'tabla'; $('ins-sec').hidden = vista !== 'tarjetas';
  let hc = '', secAct = '';
  res.filter(x => secSel === 'all' || x.def.sec === secSel).forEach(x => {
    if (x.def.sec !== secAct) { secAct = x.def.sec; const n = res.filter(y => y.def.sec === secAct).length; hc += `<h3 class="ins-sec">${esc(secAct)}<span>${n} indicadores</span></h3>`; }
    hc += tarjetaINS(x);
  });
  $('ins-cards').innerHTML = hc;

  /* --- tabla en formato del libro INS --- */
  let h = '<table class="ins"><thead><tr><th>N.º</th><th>Indicador</th><th>Trim. I</th><th>Trim. II</th><th>Trim. III</th><th>Trim. IV</th><th>Consolidado</th></tr></thead><tbody>', sec = '';
  res.forEach(({ def, T, total }) => {
    if (def.sec !== sec) { sec = def.sec; h += `<tr class="sec"><td colspan="7">${esc(sec)}</td></tr>`; }
    h += `<tr><td class="cod">${esc(def.cod)}</td><td><div class="nom">${esc(def.nombre)}${def.ajuste ? ' <span style="color:var(--warn-ink)" title="Definición ajustada">▲</span>' : ''}</div><div class="cons">${esc(def.construccion)}</div>${def.ajuste ? `<div class="aj">▲ ${esc(def.ajuste)}</div>` : ''}</td>${T.map(x => `<td class="q">${celdaINS(def, x)}</td>`).join('')}<td class="q tot">${celdaINS(def, total)}</td></tr>`;
  });
  $('ins-table').innerHTML = h + '</tbody></table>';
}
function exportINS() {
  const res = STATE.ins; if (!res) return;
  const num = x => x == null || isNaN(x) ? '' : String(Math.round(x * 10) / 10).replace('.', ',');
  const L = [['Indicadores laboratorio programa de tuberculosis — Micobacterias GERMEN v' + APP_VERSION], ['Filtros: año=' + $('f-year').value + '; tipo TB=' + $('f-tb').selectedOptions[0].text + '; supresión <5=' + (SUPPRESS ? 'sí' : 'no')], [],
    ['Sección', 'N.º', 'Indicador', 'Componente', 'Trimestre I', 'Trimestre II', 'Trimestre III', 'Trimestre IV', 'Consolidado anual', 'Construcción', 'Ajuste respecto al libro Excel']];
  res.forEach(({ def, T, total }) => {
    const all = [...T, total], base = [def.sec, def.cod, def.nombre];
    const n = v => hidden(v) ? '<5' : v;
    if (def.tipo === 'conteo') L.push([...base, 'Total', ...all.map(x => n(x.n)), def.construccion, def.ajuste || '']);
    else if (def.tipo === 'media') { L.push([...base, 'Promedio (días)', ...all.map(x => num(x.v)), def.construccion, def.ajuste || '']); L.push([...base, 'Mediana (días)', ...all.map(x => num(x.med)), '', '']); L.push([...base, 'n', ...all.map(x => x.d), '', '']); }
    else {
      L.push([...base, 'Numerador', ...all.map(x => n(x.n)), def.construccion, def.ajuste || '']);
      L.push([...base, 'Denominador', ...all.map(x => x.d), '', '']);
      L.push([...base, def.tipo === 'razon' ? 'Razón' : 'Porcentaje', ...all.map(x => !x.d || hidden(x.n) ? '' : num(def.tipo === 'razon' ? x.n / x.d : x.n / x.d * 100)), '', '']);
    }
  });
  download(new Blob([csvDe(L)], { type: 'text/csv;charset=utf-8' }), `indicadores_INS_micobacterias_${stamp()}.csv`);
}

/* === BORRADO DE DATOS === */
function closeData() {
  Object.values(CHARTS).forEach(c => c.destroy()); CHARTS = {};
  RECORDS = new Map(); FILES = []; EXPORT = []; SALT = null; DUPS = { mismoLibro: [], entreLibros: [] }; STATE.qc = null; STATE.ins = null; STATE.open.clear();
  if (worker) { worker.terminate(); worker = null; }
  ['t-cult', 't-bk', 't-conc', 't-esp', 't-tipotb', 't-mun', 't-muestra', 'kpi1', 'kpi2', 'context', 'q-score', 'q-rules', 'q-comp', 'ins-table', 'ins-hero', 'ins-cards'].forEach(id => $(id).innerHTML = '');
  $('dash').hidden = true; $('landing').hidden = false; $('sub').textContent = 'Libro de actividades TB · INS — hoja BD_BK_CULTIVO_PM';
}

/* === EVENTOS === */
const drop = $('drop'), inp = $('file');
drop.addEventListener('click', () => inp.click());
drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } });
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); loadFiles(e.dataTransfer.files); });
inp.addEventListener('change', e => { loadFiles(e.target.files); e.target.value = ''; });
$('btn-add').addEventListener('click', () => inp.click());
['f-year', 'f-per', 'f-tb'].forEach(id => $(id).addEventListener('change', refresh));
$('f-suppress').addEventListener('change', e => { SUPPRESS = e.target.checked; refresh(); });
$('pyr-seg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; PYR = b.dataset.v; $('pyr-seg').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); render(); });
document.addEventListener('click', e => { const b = e.target.closest('[data-png]'); if (b) exportPNG(b.dataset.png); });
document.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) setTab(b.dataset.tab); });
$('q-rules').addEventListener('click', e => { const tr = e.target.closest('tr[data-rule]'); if (!tr) return; const id = tr.dataset.rule; STATE.open.has(id) ? STATE.open.delete(id) : STATE.open.add(id); renderCalidad(); });
$('q-corte').addEventListener('change', e => { const [y, m, d] = e.target.value.split('-').map(Number); STATE.corte = y ? new Date(y, m - 1, d) : hoy(); refresh(); });
['q-sev', 'q-area'].forEach(id => $(id).addEventListener('change', renderCalidad));
$('btn-q-csv').addEventListener('click', exportCalidadResumen);
$('btn-q-list').addEventListener('click', exportCalidadLista);
$('btn-ins-csv').addEventListener('click', exportINS);
const segINS = (id, k) => $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; STATE[k] = b.dataset.v; $(id).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); renderINS(); });
segINS('ins-vista', 'insVista'); segINS('ins-sec', 'insSec');
$('ins-cards').addEventListener('click', e => {
  const chip = e.target.closest('[data-meta]');
  if (chip) { STATE.metaEdit = STATE.metaEdit === chip.dataset.meta ? null : chip.dataset.meta; renderINS(); const inp = document.querySelector('.meta-ed input'); if (inp) inp.focus(); return; }
  const ed = e.target.closest('.meta-ed'); if (!ed) return;
  const cod = ed.dataset.cod;
  if (e.target.closest('[data-meta-ok]')) { const v = parseFloat(ed.querySelector('[data-meta-v]').value); if (isNaN(v)) { delete METAS[cod]; } else METAS[cod] = { op: ed.querySelector('[data-meta-op]').value, v }; }
  else if (e.target.closest('[data-meta-del]')) METAS[cod] = null;
  else return;
  guardarMetas(); STATE.metaEdit = null; renderINS();
});
$('ins-cards').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-meta-v]')) { e.preventDefault(); e.target.closest('.meta-ed').querySelector('[data-meta-ok]').click(); } if (e.key === 'Escape' && STATE.metaEdit) { STATE.metaEdit = null; renderINS(); } });
$('u-reset').addEventListener('click', () => { if (!confirm('¿Restablecer títulos, colores, tipos de gráfico, columnas y metas personalizadas?')) return; METAS = {}; guardarMetas(); $('dlg').close(); Editor.restablecerTodo(); });
Editor.iniciar();
$('btn-csv').addEventListener('click', exportCSV);
$('btn-print').addEventListener('click', () => window.print());
$('btn-close').addEventListener('click', () => { if (confirm('¿Borrar de la memoria todos los datos cargados?')) closeData(); });
$('btn-settings').addEventListener('click', () => { $('u-cont').value = TH.cont; $('u-tatc').value = TH.tatC; $('u-tatb').value = TH.tatB; $('u-bkab').value = TH.bkAb; $('dlg').showModal(); });
$('u-cancel').addEventListener('click', () => $('dlg').close());
$('u-ok').addEventListener('click', () => {
  const v = (id, d) => { const x = parseFloat($(id).value); return isNaN(x) ? d : x; };
  TH.cont = v('u-cont', TH.cont); TH.tatC = v('u-tatc', TH.tatC); TH.tatB = v('u-tatb', TH.tatB); TH.bkAb = v('u-bkab', TH.bkAb);
  try { localStorage.setItem('mico-umbrales', JSON.stringify(TH)); } catch (e) { /* sin almacenamiento */ }
  $('dlg').close(); refresh();
});
$('btn-theme').addEventListener('click', () => { const root = document.documentElement, dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; root.dataset.theme = dark ? 'light' : 'dark'; refresh(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refresh);
window.addEventListener('beforeunload', () => { RECORDS.clear(); });
$('ver').textContent = 'Versión ' + APP_VERSION + '.';
{ const t = (location.hash || '').slice(1); if (['calidad', 'tablero', 'ins'].includes(t)) STATE.tab = t; document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === STATE.tab)); ['calidad', 'tablero', 'ins'].forEach(k => $('p-' + k).hidden = k !== STATE.tab); }

/* === APLICACIÓN INSTALABLE (PWA) === */
let eventoInstalar = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); eventoInstalar = e; $('btn-install').classList.add('show'); });
$('btn-install').addEventListener('click', async () => { if (!eventoInstalar) return; eventoInstalar.prompt(); await eventoInstalar.userChoice; eventoInstalar = null; $('btn-install').classList.remove('show'); });
window.addEventListener('appinstalled', () => $('btn-install').classList.remove('show'));
function estadoRed() { $('net-txt').textContent = navigator.onLine ? 'Procesamiento local' : 'Sin conexión · local'; }
window.addEventListener('online', estadoRed); window.addEventListener('offline', estadoRed); estadoRed();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
