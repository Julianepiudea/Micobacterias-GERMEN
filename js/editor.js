/* editor.js — Personalización de gráficos y tablas.
   Gráficos: título, descripción, tipo, paleta y colores por serie, etiquetas de valor, leyenda,
   apilado, orden, escala y altura. Tablas: título, columnas (mostrar/ocultar y renombrar), orden
   por columna (clic en el encabezado), modo compacto, copiar y CSV.
   Solo se guardan preferencias de presentación en este equipo (localStorage «mico-perso»); nunca datos. */
'use strict';

const Editor = (() => {
  const KEY = 'mico-perso';
  let P = { graf: {}, tabla: {}, txt: {} };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) P = { graf: s.graf || {}, tabla: s.tabla || {}, txt: s.txt || {} }; } catch (e) { /* sin almacenamiento */ }
  const guardar = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* sin almacenamiento */ } };
  const ORIG = {};        // configuración original de cada gráfico (antes de personalizar)
  const LEY = {};         // gráficos que muestran su propia leyenda (se oculta la leyenda HTML)

  /* === CAPACIDADES DE CADA GRÁFICO === */
  const GRAF = {
    'ch-open':     { tipos: ['bar', 'barh', 'line', 'area', 'doughnut', 'pie'], porCategoria: true },
    'ch-qmes':     { tipos: [], apilar: true },
    'ch-vol':      { tipos: ['bar', 'barh', 'line', 'area'], apilar: true },
    'ch-pos':      { tipos: [], sufijo: ' %' },
    'ch-tat':      { tipos: ['bar', 'barh', 'line', 'area'], apilar: true },
    'ch-pyr':      { tipos: [] },
    'ch-eapb':     { tipos: ['barh', 'bar', 'doughnut', 'pie'], porCategoria: true, ordenar: true },
    'ch-ins-mol':  { tipos: ['doughnut', 'pie', 'bar', 'barh'], porCategoria: true, ordenar: true },
    'ch-ins-res':  { tipos: ['barh', 'bar'], porCategoria: true, ordenar: true, sufijo: ' %' },
    'ch-ins-cult': { tipos: ['bar', 'barh', 'line', 'area'], apilar: true, sufijo: ' %' },
    'ch-ins-tend': { tipos: ['line', 'area', 'bar', 'barh'], sufijo: ' %' }
  };
  const TIPO_TXT = { bar: 'Barras verticales', barh: 'Barras horizontales', line: 'Líneas', area: 'Área', doughnut: 'Dona', pie: 'Torta' };
  /* === TABLAS EDITABLES (contenedores) === */
  const TABLAS = {
    'q-rules': { ordenar: false }, 't-cult': {}, 't-bk': {}, 't-conc': { columnas: false, ordenar: false }, 't-esp': {},
    't-tipotb': {}, 't-mun': {}, 't-muestra': {}, 'ins-table': { ordenar: false }
  };

  /* === PALETAS === */
  const hex2rgba = (h, a) => { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(h || ''); return m ? `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})` : h; };
  const PALETAS = {
    germen:    { txt: 'GERMEN', f: () => [cssv('--s1'), cssv('--s2'), cssv('--teal'), cssv('--crit'), cssv('--warn'), cssv('--good'), '#8e5bd1', cssv('--neutral'), '#c2185b'] },
    ziehl:     { txt: 'Ziehl-Neelsen (fucsia / azul)', f: () => ['#c2185b', '#1f5faf', '#e57399', '#5b8fd6', '#8a0f3e', '#9cc0ea', '#f2a7c0', '#2e4f7a', '#d81b60'] },
    contraste: { txt: 'Alto contraste (daltonismo)', f: () => ['#0072B2', '#E69F00', '#009E73', '#D55E00', '#CC79A7', '#56B4E9', '#F0E442', '#555555', '#999999'] },
    mono:      { txt: 'Monocromática', f: () => { const b = cssv('--teal'); return [1, .8, .64, .5, .38, .28, .2, .14, .1].map(a => hex2rgba(b, a)); } }
  };
  const aHex = c => { if (typeof c !== 'string') return '#888888'; if (/^#[\da-f]{6}/i.test(c)) return c.slice(0, 7); const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); return m ? '#' + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join('') : '#888888'; };

  /* === ETIQUETAS DE VALOR (complemento de Chart.js) === */
  const fmtVal = (v, suf) => { const a = Math.abs(v); if (suf) return fmt1(a) + suf; return Number.isInteger(a) ? (hidden(a) ? '<5' : fmtInt(a)) : fmt1(a); };
  Chart.register({
    id: 'etiquetas', defaults: { display: false },
    afterDatasetsDraw(ch, _a, op) {
      if (!op || !op.display) return;
      const ctx = ch.ctx, circ = ['doughnut', 'pie'].includes(ch.config.type), horiz = ch.options.indexAxis === 'y';
      const apil = !!(ch.options.scales && ((ch.options.scales.x && ch.options.scales.x.stacked) || (ch.options.scales.y && ch.options.scales.y.stacked)));
      ctx.save(); ctx.font = "600 10.5px 'Plex Sans',sans-serif";
      ch.data.datasets.forEach((d, i) => {
        if (!ch.isDatasetVisible(i) || /^IC /.test(d.label || '')) return;
        const meta = ch.getDatasetMeta(i), tipo = meta.type;
        meta.data.forEach((el, j) => {
          const v = d.data[j]; if (v == null || isNaN(v) || ((circ || apil) && !v)) return;
          const t = fmtVal(v, op.sufijo); let x, y;
          if (circ) { const p = el.tooltipPosition(); x = p.x; y = p.y; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; }
          else if (apil && tipo === 'bar') { x = horiz ? (el.x + el.base) / 2 : el.x; y = horiz ? el.y : (el.y + el.base) / 2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; }
          else if (horiz && tipo === 'bar') { x = el.x + (v < 0 ? -5 : 5); y = el.y; ctx.textAlign = v < 0 ? 'right' : 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = cssv('--ink'); }
          else { x = el.x; y = el.y - 6; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillStyle = cssv('--ink'); }
          ctx.fillText(t, x, y);
        });
      });
      ctx.restore();
    }
  });

  /* === COPIA PROFUNDA QUE CONSERVA FUNCIONES === */
  const clon = o => Array.isArray(o) ? o.map(clon) : (o && typeof o === 'object' && Object.getPrototypeOf(o) === Object.prototype) ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, clon(v)])) : o;
  const tipoDe = cfg => cfg.type === 'bar' && cfg.options && cfg.options.indexAxis === 'y' ? 'barh' : cfg.type;
  const circular = t => t === 'doughnut' || t === 'pie';

  /* Aplica la personalización guardada a una copia de la configuración original */
  function aplicar(id, cfg) {
    const g = P.graf[id], reg = GRAF[id] || { tipos: [] };
    const o = cfg.options = cfg.options || {}; o.plugins = o.plugins || {};
    o.plugins.etiquetas = { display: !!(o.plugins.etiquetas && o.plugins.etiquetas.display), sufijo: reg.sufijo || '' };
    LEY[id] = false;
    if (!g) return cfg;
    let ds = cfg.data.datasets;
    const orig = tipoDe(cfg), tipo = g.tipo && reg.tipos.includes(g.tipo) ? g.tipo : orig;

    // orden de categorías (según la primera serie)
    if (reg.ordenar && g.orden && g.orden !== 'orig' && ds.length) {
      const idx = cfg.data.labels.map((_, i) => i), v = i => Math.abs(+ds[0].data[i] || 0);
      idx.sort((a, b) => g.orden === 'desc' ? v(b) - v(a) : g.orden === 'asc' ? v(a) - v(b) : String(cfg.data.labels[a]).localeCompare(String(cfg.data.labels[b]), 'es'));
      cfg.data.labels = idx.map(i => cfg.data.labels[i]);
      ds.forEach(d => { d.data = idx.map(i => d.data[i]); ['backgroundColor', 'hoverBackgroundColor', 'borderColor'].forEach(k => { if (Array.isArray(d[k])) d[k] = idx.map(i => d[k][i]); }); });
    }
    // paleta y colores
    const pal = g.paleta && PALETAS[g.paleta] ? PALETAS[g.paleta].f() : null;
    if (pal && reg.porCategoria && ds[0]) ds[0].backgroundColor = ds[0].hoverBackgroundColor = cfg.data.labels.map((_, i) => pal[i % pal.length]);
    ds.forEach((d, i) => {
      let c = g.colores && g.colores[i];
      if (!c && pal && !reg.porCategoria && !/^IC /.test(d.label || '')) c = pal[i % pal.length];
      if (!c) return;
      d.backgroundColor = d.hoverBackgroundColor = c; d.borderColor = c;
      if (d.pointBackgroundColor && !Array.isArray(d.pointBackgroundColor)) d.pointBackgroundColor = c;
    });
    if (id === 'ch-pos') { const c = ds[2] && typeof ds[2].borderColor === 'string' ? ds[2].borderColor : null; if (c && ds[1]) ds[1].backgroundColor = hex2rgba(aHex(c), .15); }

    // tipo de gráfico
    if (tipo !== orig) {
      if (circular(tipo)) {
        cfg.type = tipo; delete o.indexAxis; o.scales = {}; o.interaction = { mode: 'nearest', intersect: true };
        cfg.data.datasets = ds = ds.slice(0, 1);
        if (ds[0] && !Array.isArray(ds[0].backgroundColor)) { const p = pal || PALETAS.germen.f(); ds[0].backgroundColor = cfg.data.labels.map((_, i) => p[i % p.length]); }
        if (ds[0]) { ds[0].borderColor = cssv('--surface'); ds[0].borderWidth = 2; ds[0].hoverBackgroundColor = ds[0].backgroundColor; ds[0].borderRadius = 0; }
        o.cutout = tipo === 'doughnut' ? '58%' : 0;
      } else {
        if (circular(orig)) {
          const b = baseOpts(); o.scales = b.scales; o.interaction = b.interaction;
          if (reg.sufijo) o.scales.y.ticks = { ...o.scales.y.ticks, callback: v => v + ' %' };
        }
        const hOrig = orig === 'barh', hNuevo = tipo === 'barh';
        if (hOrig !== hNuevo && o.scales && o.scales.x && o.scales.y) { const s = o.scales; o.scales = { ...s, x: s.y, y: s.x }; }
        if (hNuevo) o.indexAxis = 'y'; else delete o.indexAxis;
        if (tipo === 'line' || tipo === 'area') {
          cfg.type = 'line';
          ds.forEach((d, i) => {
            const c = Array.isArray(d.backgroundColor) ? d.backgroundColor[0] : d.backgroundColor;
            const ap = !!(o.scales && o.scales.y && o.scales.y.stacked);
            Object.assign(d, { type: 'line', borderColor: c, pointBackgroundColor: c, pointBorderColor: cssv('--surface'), backgroundColor: tipo === 'area' ? hex2rgba(aHex(c), .28) : c, fill: tipo === 'area' ? (ap && i ? '-1' : 'origin') : false, tension: .3, pointRadius: 3, borderWidth: 2 });
          });
        } else {
          cfg.type = 'bar';
          ds.forEach(d => { delete d.type; delete d.fill; if (!d.borderRadius) d.borderRadius = 4; });
        }
      }
    }
    // apilado
    if (reg.apilar && typeof g.apilar === 'boolean' && o.scales && o.scales.x && o.scales.y) { o.scales.x.stacked = g.apilar; o.scales.y.stacked = g.apilar; }
    // escala del eje de valores
    if (!circular(cfg.type) && o.scales) {
      const ax = o.indexAxis === 'y' ? o.scales.x : o.scales.y;
      if (ax) { if (g.min !== '' && g.min != null) ax.min = +g.min; if (g.max !== '' && g.max != null) ax.max = +g.max; }
    }
    // etiquetas y leyenda
    if (typeof g.etiquetas === 'boolean') o.plugins.etiquetas.display = g.etiquetas;
    if (o.plugins.etiquetas.display) o.layout = { padding: { top: 18, right: 30 } };
    const cambiado = (g.colores && g.colores.some(Boolean)) || !!g.paleta || tipo !== orig;
    const pos = g.leyenda && g.leyenda !== 'auto' ? g.leyenda : (circular(cfg.type) ? 'right' : cambiado && !reg.porCategoria ? 'top' : null);
    LEY[id] = !!pos || cambiado;
    if (pos) o.plugins.legend = { display: pos !== 'none', position: pos === 'none' ? 'top' : pos, labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, color: cssv('--ink2'), filter: it => !/^IC /.test(it.text) } };
    return cfg;
  }

  /* === DIBUJO === */
  function dibujar(id) {
    const base = ORIG[id]; if (!base) return;
    const cv = $(id); if (!cv) return;
    const g = P.graf[id] || {}, cfg = aplicar(id, clon(base));
    if (CHARTS[id]) CHARTS[id].destroy();
    CHARTS[id] = new Chart(cv, cfg);
    // leyenda HTML de la tarjeta: se oculta si el gráfico muestra la suya
    const card = cv.closest('.card'), leg = card && card.querySelector('.legend');
    if (leg) leg.classList.toggle('perso-oculta', !!LEY[id]);
    // altura
    const box = cv.parentElement, ALTO = { baja: 200, media: 280, alta: 400 };
    if (g.alto && ALTO[g.alto]) { box.style.height = ALTO[g.alto] + 'px'; box.dataset.alto = ALTO[g.alto] + 'px'; }
    else if (box.dataset.alto) { if (box.style.height === box.dataset.alto) box.style.height = ''; delete box.dataset.alto; }
  }
  function registrar(id, cfg) { ORIG[id] = cfg; dibujar(id); }

  /* === TÍTULOS Y DESCRIPCIONES === */
  function cabecera(id) {
    const el = $(id); if (!el) return null;
    if (el.tagName === 'CANVAS') { const c = el.closest('.card'); return c && c.querySelector('.card-h'); }
    const prev = el.previousElementSibling;
    if (prev && prev.classList.contains('card-h')) return prev;
    const c = el.closest('.card'); return c && c.querySelector('.card-h');
  }
  function aplicarTextos() {
    Object.keys({ ...GRAF, ...TABLAS }).forEach(id => {
      const h = cabecera(id); if (!h) return;
      const h3 = h.querySelector('h3'), d = h.querySelector('.desc'), t = P.txt[id] || {};
      if (h3) { if (h3.dataset.orig == null) h3.dataset.orig = h3.textContent; h3.textContent = t.t || h3.dataset.orig; }
      if (d) {
        if (t.d) { if (d.dataset.orig == null) d.dataset.orig = d.innerHTML; d.textContent = t.d; d.dataset.perso = '1'; }
        else if (d.dataset.perso) { d.innerHTML = d.dataset.orig; delete d.dataset.perso; }
      }
    });
  }

  /* === TABLAS === */
  const valorCelda = c => {
    const t = (c ? c.textContent : '').trim();
    if (/^<\s*5/.test(t)) return 2.5;
    if (t === '—' || t === '') return -Infinity;
    const m = t.replace(/\s/g, '').match(/^-?[\d.]+(,\d+)?/);
    return m ? parseFloat(m[0].replace(/\./g, '').replace(',', '.')) : t.toLowerCase();
  };
  const cmp = (a, b) => typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'es', { numeric: true });
  const tablaDe = id => { const c = $(id); return c && c.querySelector('table'); };
  const ordenable = (id, tb) => TABLAS[id] && TABLAS[id].ordenar !== false && tb && !tb.querySelector('tr.sec, tr.det, tr.group');
  const encabezados = tb => tb && tb.tHead && tb.tHead.rows[0] ? [...tb.tHead.rows[0].cells] : (tb && tb.rows[0] ? [...tb.rows[0].cells] : []);

  function aplicarTabla(id) {
    const cont = $(id); if (!cont) return;
    const t = P.tabla[id] || {}, tb = tablaDe(id);
    cont.classList.toggle('tbl-compacta', !!t.compacta);
    if (!tb) return;
    const ths = encabezados(tb), n = ths.length;
    ths.forEach((th, i) => { if (th.dataset.orig == null) th.dataset.orig = th.textContent; if (t.nombres && t.nombres[i]) th.textContent = t.nombres[i]; });
    const puede = ordenable(id, tb);
    tb.classList.toggle('ordenable', !!puede);
    ths.forEach(th => th.removeAttribute('aria-sort'));
    if (puede && t.orden && ths[t.orden.col] && tb.tBodies[0]) {
      const body = tb.tBodies[0], filas = [...body.rows], fijas = filas.filter(r => r.classList.contains('total')), mov = filas.filter(r => !r.classList.contains('total'));
      mov.sort((a, b) => cmp(valorCelda(a.cells[t.orden.col]), valorCelda(b.cells[t.orden.col])) * (t.orden.dir === 'desc' ? -1 : 1));
      [...mov, ...fijas].forEach(r => body.appendChild(r));
      ths[t.orden.col].setAttribute('aria-sort', t.orden.dir === 'desc' ? 'descending' : 'ascending');
    }
    const oc = new Set(TABLAS[id].columnas === false ? [] : (t.ocultas || []));
    [...tb.rows].forEach(r => { if (r.cells.length !== n) return; [...r.cells].forEach((c, i) => { c.classList.toggle('col-oculta', oc.has(i)); }); });
  }
  function filasTabla(id) {
    const tb = tablaDe(id); if (!tb) return [];
    const oc = new Set((P.tabla[id] || {}).ocultas || []), n = encabezados(tb).length;
    return [...tb.rows].filter(r => !r.classList.contains('det')).map(r => [...r.cells].filter((c, i) => r.cells.length !== n || !oc.has(i)).map(c => c.textContent.replace(/\s+/g, ' ').trim()));
  }

  /* === DIÁLOGO DE EDICIÓN === */
  const dlg = document.createElement('dialog'); dlg.id = 'dlg-edit'; dlg.className = 'dlg-edit'; document.body.appendChild(dlg);
  let actual = null;
  const opc = (pares, v) => pares.map(([k, t]) => `<option value="${k}"${String(v) === String(k) ? ' selected' : ''}>${esc(t)}</option>`).join('');
  const tituloActual = id => { const h = cabecera(id), h3 = h && h.querySelector('h3'), d = h && h.querySelector('.desc'); return { t: h3 ? (h3.dataset.orig || h3.textContent) : id, d: d ? (d.dataset.orig != null ? d.dataset.orig.replace(/<[^>]+>/g, '') : d.textContent) : '' }; };

  function abrirGrafico(id) {
    actual = { tipo: 'graf', id };
    const reg = GRAF[id] || { tipos: [] }, g = P.graf[id] || {}, base = ORIG[id], tt = P.txt[id] || {}, o0 = tituloActual(id);
    if (!base) return;
    const orig = tipoDe(base), ch = CHARTS[id];
    const series = (ch ? ch.data.datasets : base.data.datasets).map((d, i) => ({ i, label: d.label || 'Serie ' + (i + 1), c: Array.isArray(d.backgroundColor) ? null : (d.borderColor && typeof d.borderColor === 'string' && d.type === 'line' ? d.borderColor : d.backgroundColor) })).filter(s => !/^IC /.test(s.label));
    const circ = circular(g.tipo || orig);
    dlg.innerHTML = `<form method="dialog">
      <h3><svg class="i" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>Personalizar gráfico</h3>
      <p>Los cambios se ven al instante y se recuerdan en este equipo. No modifican los datos ni los cálculos.</p>
      <label class="f">Título<input name="t" value="${esc(tt.t || '')}" placeholder="${esc(o0.t)}"></label>
      <label class="f">Descripción<input name="d" value="${esc(tt.d || '')}" placeholder="${esc(o0.d)}"></label>
      <div class="f2">
        ${reg.tipos.length ? `<label class="f">Tipo<select name="tipo">${opc([[orig, TIPO_TXT[orig] + ' (original)'], ...reg.tipos.filter(x => x !== orig).map(x => [x, TIPO_TXT[x]])], g.tipo || orig)}</select></label>` : ''}
        <label class="f">Paleta<select name="paleta">${opc([['', 'Original'], ...Object.entries(PALETAS).map(([k, p]) => [k, p.txt])], g.paleta || '')}</select></label>
        <label class="f">Leyenda<select name="leyenda">${opc([['auto', 'Automática'], ['top', 'Arriba'], ['bottom', 'Abajo'], ['right', 'Derecha'], ['none', 'Oculta']], g.leyenda || 'auto')}</select></label>
        <label class="f">Altura<select name="alto">${opc([['', 'Original'], ['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta']], g.alto || '')}</select></label>
        ${reg.ordenar ? `<label class="f">Orden<select name="orden">${opc([['orig', 'Original'], ['desc', 'Mayor a menor'], ['asc', 'Menor a mayor'], ['alfa', 'Alfabético']], g.orden || 'orig')}</select></label>` : ''}
        ${!circ ? `<label class="f">Eje: mínimo<input name="min" type="number" step="any" value="${g.min ?? ''}" placeholder="auto"></label><label class="f">Eje: máximo<input name="max" type="number" step="any" value="${g.max ?? ''}" placeholder="auto"></label>` : ''}
      </div>
      <div class="chk">
        <label class="toggle"><input type="checkbox" name="etiquetas"${(typeof g.etiquetas === 'boolean' ? g.etiquetas : !!(base.options.plugins && base.options.plugins.etiquetas && base.options.plugins.etiquetas.display)) ? ' checked' : ''}> Mostrar valores sobre el gráfico</label>
        ${reg.apilar ? `<label class="toggle"><input type="checkbox" name="apilar"${(typeof g.apilar === 'boolean' ? g.apilar : !!(base.options.scales && base.options.scales.y && base.options.scales.y.stacked)) ? ' checked' : ''}> Series apiladas</label>` : ''}
      </div>
      ${!reg.porCategoria ? `<div class="f"><span>Colores por serie</span><div class="colores">${series.map(s => `<label class="col"><input type="color" name="c${s.i}" value="${aHex((g.colores && g.colores[s.i]) || s.c)}"><span>${esc(s.label)}</span></label>`).join('')}</div></div>` : ''}
      <div class="actions"><button class="btn" value="reset" type="button" data-accion="reset">Restablecer</button><span style="flex:1"></span><button class="btn" type="button" data-accion="png">PNG</button><button class="btn primary" value="ok">Listo</button></div>
    </form>`;
    if (!dlg.open) dlg.showModal();
  }

  function abrirTabla(id) {
    actual = { tipo: 'tabla', id };
    const t = P.tabla[id] || {}, tt = P.txt[id] || {}, o0 = tituloActual(id), tb = tablaDe(id), reg = TABLAS[id];
    const ths = encabezados(tb).map((th, i) => ({ i, orig: th.dataset.orig || th.textContent }));
    const oc = new Set(t.ocultas || []), puede = ordenable(id, tb);
    dlg.innerHTML = `<form method="dialog">
      <h3><svg class="i" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>Personalizar tabla</h3>
      <p>Cambie el título, elija qué columnas ver y cómo nombrarlas, y ordene las filas. ${puede ? 'También puede ordenar pulsando el encabezado de una columna.' : ''}</p>
      <label class="f">Título<input name="t" value="${esc(tt.t || '')}" placeholder="${esc(o0.t)}"></label>
      <label class="f">Descripción<input name="d" value="${esc(tt.d || '')}" placeholder="${esc(o0.d)}"></label>
      ${reg.columnas !== false && ths.length ? `<div class="f"><span>Columnas</span><div class="cols">${ths.map(c => `<div class="colr"><label class="toggle"><input type="checkbox" name="v${c.i}"${oc.has(c.i) ? '' : ' checked'}></label><input name="n${c.i}" value="${esc((t.nombres && t.nombres[c.i]) || '')}" placeholder="${esc(c.orig || '(sin título)')}"></div>`).join('')}</div></div>` : ''}
      <div class="f2">
        ${puede ? `<label class="f">Ordenar por<select name="ocol">${opc([['', 'Orden original'], ...ths.map(c => [c.i, c.orig || 'Columna ' + (c.i + 1)])], t.orden ? t.orden.col : '')}</select></label>
        <label class="f">Sentido<select name="odir">${opc([['desc', 'Mayor a menor / Z–A'], ['asc', 'Menor a mayor / A–Z']], t.orden ? t.orden.dir : 'desc')}</select></label>` : ''}
      </div>
      <div class="chk"><label class="toggle"><input type="checkbox" name="compacta"${t.compacta ? ' checked' : ''}> Filas compactas</label></div>
      <div class="actions"><button class="btn" type="button" data-accion="reset">Restablecer</button><span style="flex:1"></span><button class="btn" type="button" data-accion="copiar">Copiar</button><button class="btn" type="button" data-accion="csv">CSV</button><button class="btn primary" value="ok">Listo</button></div>
    </form>`;
    if (!dlg.open) dlg.showModal();
  }

  function leerDialogo() {
    const f = dlg.querySelector('form'); if (!f || !actual) return;
    const v = n => f.elements[n], id = actual.id;
    P.txt[id] = { t: v('t').value.trim(), d: v('d').value.trim() };
    if (!P.txt[id].t && !P.txt[id].d) delete P.txt[id];
    if (actual.tipo === 'graf') {
      const g = {};
      if (v('tipo')) g.tipo = v('tipo').value;
      if (v('paleta').value) g.paleta = v('paleta').value;
      g.leyenda = v('leyenda').value; if (v('alto').value) g.alto = v('alto').value;
      if (v('orden')) g.orden = v('orden').value;
      if (v('min')) { g.min = v('min').value; g.max = v('max').value; }
      g.etiquetas = v('etiquetas').checked;
      if (v('apilar')) g.apilar = v('apilar').checked;
      // colores: solo los que el usuario cambió respecto al valor mostrado al abrir
      g.colores = [];
      [...f.querySelectorAll('input[type=color]')].forEach(inp => { const i = +inp.name.slice(1); if (inp.dataset.tocado) g.colores[i] = inp.value; else if (P.graf[id] && P.graf[id].colores && P.graf[id].colores[i]) g.colores[i] = P.graf[id].colores[i]; });
      P.graf[id] = g;
      guardar(); dibujar(id); aplicarTextos();
    } else {
      const t = { ocultas: [], nombres: [] };
      [...f.querySelectorAll('input[name^=v]')].forEach(inp => { const i = +inp.name.slice(1); if (!inp.checked) t.ocultas.push(i); });
      [...f.querySelectorAll('input[name^=n]')].forEach(inp => { const i = +inp.name.slice(1); if (inp.value.trim()) t.nombres[i] = inp.value.trim(); });
      if (v('ocol') && v('ocol').value !== '') t.orden = { col: +v('ocol').value, dir: v('odir').value };
      t.compacta = v('compacta').checked;
      P.tabla[id] = t;
      guardar(); aplicarTextos(); refrescarTabla(id);
    }
  }
  // al restaurar nombres u orden, la tabla se vuelve a dibujar desde los datos
  function refrescarTabla(id) {
    const tb = tablaDe(id);
    if (tb) encabezados(tb).forEach(th => { if (th.dataset.orig != null) th.textContent = th.dataset.orig; });
    if (typeof refresh === 'function') refresh(); else aplicarTabla(id);
  }

  let espera = null;
  dlg.addEventListener('input', e => { if (e.target.type === 'color') e.target.dataset.tocado = '1'; clearTimeout(espera); espera = setTimeout(leerDialogo, 180); });
  dlg.addEventListener('close', () => { clearTimeout(espera); leerDialogo(); actual = null; });
  dlg.addEventListener('click', e => {
    const b = e.target.closest('[data-accion]'); if (!b || !actual) return;
    const id = actual.id, acc = b.dataset.accion;
    if (acc === 'reset') {
      if (actual.tipo === 'graf') { delete P.graf[id]; delete P.txt[id]; guardar(); dibujar(id); aplicarTextos(); abrirGrafico(id); }
      else { delete P.tabla[id]; delete P.txt[id]; guardar(); aplicarTextos(); refrescarTabla(id); abrirTabla(id); }
    }
    if (acc === 'png') { leerDialogo(); exportPNG(id); }
    if (acc === 'copiar') { const txt = filasTabla(id).map(r => r.join('\t')).join('\n'); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { b.textContent = 'Copiado ✓'; }, () => { b.textContent = 'No se pudo copiar'; }); }
    if (acc === 'csv') { const nom = (P.txt[id] && P.txt[id].t) || tituloActual(id).t; download(new Blob([csvDe(filasTabla(id))], { type: 'text/csv;charset=utf-8' }), `tabla_${nom.toLowerCase().normalize('NFD').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '')}_${stamp()}.csv`); }
  });

  /* === BOTONES «EDITAR» Y ORDEN POR ENCABEZADO === */
  const ICONO = '<svg class="i" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
  function iniciar() {
    Object.keys(GRAF).concat(Object.keys(TABLAS)).forEach(id => {
      const h = cabecera(id); if (!h) return;
      let tools = h.querySelector('.tools'); if (!tools) { tools = document.createElement('div'); tools.className = 'tools'; h.appendChild(tools); }
      if (tools.querySelector(`[data-edit="${id}"]`)) return;
      tools.insertAdjacentHTML('afterbegin', `<button class="btn btn-edit no-print" type="button" data-edit="${id}" data-edit-tipo="${GRAF[id] ? 'graf' : 'tabla'}" title="Personalizar">${ICONO}Editar</button>`);
    });
    Object.keys(TABLAS).forEach(id => { const c = $(id); if (c) new MutationObserver(() => aplicarTabla(id)).observe(c, { childList: true }); });
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-edit]');
      if (b) { b.dataset.editTipo === 'graf' ? abrirGrafico(b.dataset.edit) : abrirTabla(b.dataset.edit); return; }
      const th = e.target.closest('table.ordenable th'); if (!th) return;
      const cont = Object.keys(TABLAS).find(id => $(id) && $(id).contains(th)); if (!cont) return;
      const col = th.cellIndex, t = P.tabla[cont] = P.tabla[cont] || {};
      t.orden = !t.orden || t.orden.col !== col ? { col, dir: 'desc' } : t.orden.dir === 'desc' ? { col, dir: 'asc' } : undefined;
      if (!t.orden) delete t.orden;
      guardar(); refrescarTabla(cont);
    });
    aplicarTextos();
  }
  function restablecerTodo() { P = { graf: {}, tabla: {}, txt: {} }; guardar(); Object.keys(ORIG).forEach(dibujar); aplicarTextos(); if (typeof refresh === 'function') refresh(); }

  return { registrar, dibujar, aplicarTextos, aplicarTabla, iniciar, restablecerTodo };
})();
