/* tablero.js — Gráficos y tablas del tablero (portado del tablero autónomo). Solo muestra agregados. */
'use strict';
const MES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const $=id=>document.getElementById(id);
const clean=v=>{if(v==null)return null;const s=String(v).replace(/\s+/g,' ').trim();return(!s||/^(nan|none|null|n\/a|na)$/i.test(s))?null:s;};
const U=v=>(clean(v)||'').toUpperCase();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const titleCase=s=>s.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu,(m,a,b)=>a+b.toUpperCase());
const stripAcc=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'');
const fmt1=x=>x==null||isNaN(x)?'—':x.toLocaleString('es-CO',{minimumFractionDigits:1,maximumFractionDigits:1});
const fmtInt=x=>x.toLocaleString('es-CO');
const fmtN=n=>SUPPRESS&&n>0&&n<5?'<5':fmtInt(n);
const hidden=n=>SUPPRESS&&n>0&&n<5;
function cssv(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim();}
const days=(a,b)=>a&&b?Math.round((b-a)/86400000):null;
function wilson(x,n,z=1.96){if(!n)return null;const p=x/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return[Math.max(0,c-h)*100,Math.min(1,c+h)*100];}
function quant(arr,q){if(!arr.length)return null;const a=[...arr].sort((x,y)=>x-y),pos=(a.length-1)*q,lo=Math.floor(pos),hi=Math.ceil(pos);return a[lo]+(a[hi]-a[lo])*(pos-lo);}
const pct=(x,n)=>n?x/n*100:null;
const ciTxt=ci=>ci?`IC95 ${fmt1(ci[0])}–${fmt1(ci[1])}`:'';
/* === GRÁFICOS: tema común === */
function baseOpts(){
  const ink2=cssv('--ink2'),grid=cssv('--grid');
  Chart.defaults.font.family="'Plex Sans',system-ui,sans-serif";Chart.defaults.font.size=11.5;Chart.defaults.color=ink2;
  return{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:false},tooltip:{backgroundColor:cssv('--surface'),titleColor:cssv('--ink'),bodyColor:cssv('--ink2'),borderColor:cssv('--line'),borderWidth:1,padding:10,cornerRadius:8,boxPadding:4,usePointStyle:true,titleFont:{weight:'600'}}},
    scales:{x:{grid:{display:false},border:{color:cssv('--line')},ticks:{color:ink2}},y:{beginAtZero:true,grid:{color:grid},border:{display:false},ticks:{color:ink2,precision:0}}}};
}
const bar=(label,data,color,extra={})=>({label,data,backgroundColor:color,hoverBackgroundColor:color,borderRadius:4,borderSkipped:'start',maxBarThickness:28,categoryPercentage:.72,barPercentage:.9,borderColor:cssv('--surface'),borderWidth:{left:0,right:0,top:0,bottom:0},...extra});
function mk(id,cfg){Editor.registrar(id,cfg);}  // editor.js aplica la personalización guardada

/* === RENDER PRINCIPAL === */
function render(){
  const rows=filtered();EXPORT=[];
  const pushX=(sec,ind,cat,n,d,ci)=>EXPORT.push({sec,ind,cat,n,d,ci});
  $('gen-date').textContent=new Date().toLocaleDateString('es-CO',{day:'numeric',month:'long',year:'numeric'});

  /* --- contexto --- */
  const dates=rows.map(r=>r.fecha).filter(Boolean).sort((a,b)=>a-b);
  const lastDate=dates.length?dates[dates.length-1]:new Date();
  const span=dates.length?`${dates[0].toLocaleDateString('es-CO')} – ${lastDate.toLocaleDateString('es-CO')}`:'—';
  $('sub').textContent=FILES.length===1?FILES[0].name:FILES.length+' libros combinados';
  $('context').innerHTML=`<span>Archivos: <b>${FILES.map(f=>esc(f.name)).join(' · ')}</b></span><span>Rango de fechas: <b>${span}</b></span>`;

  /* --- agregados de cultivo --- */
  const C=rows.filter(r=>r.hasC),B=rows.filter(r=>r.hasB);
  const cnt=k=>C.filter(r=>r.liq===k).length;
  const nNeg=cnt('NEG'),nPos=cnt('POS'),nCont=cnt('CONT'),nNR=cnt('NR'),nPend=cnt('PEND');
  const valid=nPos+nNeg, withCont=valid+nCont;
  const nMtb=C.filter(r=>r.mtb).length,nMnt=C.filter(r=>r.mnt).length,nSinId=nPos-nMtb-nMnt;
  const posP=pct(nPos,valid),posCI=wilson(nPos,valid);
  const contP=pct(nCont,withCont),contCI=wilson(nCont,withCont);
  const pids=new Set(rows.map(r=>r.pid).filter(Boolean));
  const pidValid=new Set(C.filter(r=>r.liq==='POS'||r.liq==='NEG').map(r=>r.pid).filter(Boolean));
  const pidMtb=new Set(C.filter(r=>r.mtb).map(r=>r.pid).filter(Boolean));
  const pidMnt=new Set(C.filter(r=>r.mnt).map(r=>r.pid).filter(Boolean));
  const bkDone=B.filter(r=>r.bk),bkPos=bkDone.filter(r=>r.bkPos);
  const nSmears=rows.reduce((s,r)=>s+r.smears.filter(x=>x.res).length,0);
  const bkP=pct(bkPos.length,bkDone.length),bkCI=wilson(bkPos.length,bkDone.length);
  const tatC=C.filter(r=>r.liq!=='PEND'&&r.liq!=='NR').map(r=>days(r.cRec,r.cInf)).filter(d=>d!=null&&d>=0&&d<=180);
  const tatB=[];bkDone.forEach(r=>r.smears.forEach(x=>{const d=days(x.rec,x.inf);if(d!=null&&d>=0&&d<=60)tatB.push(d);}));
  const mC=quant(tatC,.5),mB=quant(tatB,.5);
  const corte=STATE.corte||lastDate;
  const overdue=C.filter(r=>r.liq==='PEND'&&r.cRec&&days(r.cRec,corte)>TH.tatC).length;

  /* --- KPI --- */
  const flag=(cls,txt)=>`<div class="kpi-flag ${cls}">${cls==='ok'?'<svg class="i" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>':'<svg class="i" viewBox="0 0 24 24"><path d="M12 8v5M12 17h0"/><circle cx="12" cy="12" r="9"/></svg>'}${txt}</div>`;
  const K=(label,val,sub,color,fl='')=>`<div class="kpi" style="--kc:${color}"><div class="kpi-label">${label}</div><div class="kpi-val">${val}</div>${sub?`<div class="kpi-sub">${sub}</div>`:''}${fl}</div>`;
  $('kpi1').innerHTML=
    K('Muestras procesadas',fmtInt(rows.length),`${fmtN(pids.size)} pacientes únicos`,'var(--teal)')+
    K('Cultivos',fmtInt(C.length),`${fmt1(pct(C.length-nPend,C.length))} % con resultado`,'var(--s1)')+
    K('Baciloscopias',fmtInt(nSmears),`en ${fmtInt(bkDone.length)} muestras · ${fmt1(pct(bkDone.length,B.length))} % con resultado`,'var(--s2)')+
    K('Cultivos pendientes',fmtN(nPend),overdue?`${fmtN(overdue)} con más de ${TH.tatC} días`:'ninguno vencido','var(--warn)',overdue?flag('mid','Revisar vencidos'):'');
  $('kpi2').innerHTML=
    K('Positividad cultivo',`${fmt1(posP)}<small>%</small>`,`${fmtN(nPos)}/${fmtInt(valid)} · ${ciTxt(posCI)}`,'var(--crit)')+
    K('Pacientes con MTBc',fmtN(pidMtb.size),`${fmt1(pct(pidMtb.size,pidValid.size))} % de ${fmtInt(pidValid.size)} pacientes con cultivo válido · MNT: ${fmtN(pidMnt.size)}`,'var(--crit)')+
    K('Contaminación',`${fmt1(contP)}<small>%</small>`,`${fmtN(nCont)}/${fmtInt(withCont)} · ${ciTxt(contCI)}`,'var(--warn)',contP==null?'':contP<=TH.cont?flag('ok',`≤ ${fmt1(TH.cont)} % (umbral)`):flag('bad',`> ${fmt1(TH.cont)} % (umbral)`))+
    K('Tiempo de respuesta',mC==null?'—':`${fmt1(mC)}<small>d cultivo</small>`,`RIC ${fmt1(quant(tatC,.25))}–${fmt1(quant(tatC,.75))} · BK mediana ${fmt1(mB)} d`,'var(--teal)',mC==null?'':(mC<=TH.tatC&&(mB==null||mB<=TH.tatB))?flag('ok','Dentro de umbrales'):flag('bad','Fuera de umbral'));
  pushX('Producción','Muestras','',rows.length,null);pushX('Producción','Pacientes únicos','',pids.size,null);
  pushX('Producción','Cultivos líquidos','',C.length,null);pushX('Producción','Muestras con baciloscopia','',B.length,null);pushX('Producción','Baciloscopias con resultado','',nSmears,null);pushX('Producción','Cultivos pendientes','',nPend,C.length);
  pushX('Calidad','Positividad cultivo','',nPos,valid,posCI);pushX('Calidad','Contaminación cultivo','',nCont,withCont,contCI);
  pushX('Calidad','Positividad baciloscopia','',bkPos.length,bkDone.length,bkCI);
  pushX('Pacientes','Pacientes con MTBc','',pidMtb.size,pidValid.size,wilson(pidMtb.size,pidValid.size));pushX('Pacientes','Pacientes con MNT','',pidMnt.size,pidValid.size);
  EXPORT.push({sec:'Oportunidad',ind:'Mediana días recepción-informe cultivo',cat:'',val:mC,q1:quant(tatC,.25),q3:quant(tatC,.75),n:tatC.length});
  EXPORT.push({sec:'Oportunidad',ind:'Mediana días recepción-informe BK',cat:'',val:mB,q1:quant(tatB,.25),q3:quant(tatB,.75),n:tatB.length});

  /* --- tendencia mensual --- */
  const byM=new Map();
  rows.forEach(r=>{if(!r.fecha)return;const k=r.fecha.getFullYear()*100+r.fecha.getMonth();if(!byM.has(k))byM.set(k,{c:0,b:0,m:0,pos:0,neg:0,cont:0,pend:0});const o=byM.get(k);if(r.hasC)o.c++;if(r.hasB)o.b++;if(r.hasM)o.m++;if(r.liq==='POS')o.pos++;if(r.liq==='NEG')o.neg++;if(r.liq==='CONT')o.cont++;if(r.liq==='PEND')o.pend++;});
  const keys=[...byM.keys()].sort((a,b)=>a-b);
  const multiYear=new Set(keys.map(k=>Math.floor(k/100))).size>1;
  const labels=keys.map(k=>MES[k%100]+(multiYear?' '+String(Math.floor(k/100)).slice(2):''));
  const M=keys.map(k=>byM.get(k));
  const o1=baseOpts();
  const s1=cssv('--s1'),s2=cssv('--s2');
  o1.plugins.tooltip.callbacks={label:c=>` ${c.dataset.label}: ${fmtN(c.raw)}`};
  const anyMol=M.some(m=>m.m);$('leg-mol').hidden=!anyMol;
  mk('ch-vol',{type:'bar',data:{labels,datasets:[bar('Cultivos',M.map(m=>m.c),s1),bar('Baciloscopias',M.map(m=>m.b),s2)].concat(anyMol?[bar('Molecular',M.map(m=>m.m),cssv('--teal'))]:[])},options:o1});

  const posM=M.map(m=>{const v=m.pos+m.neg;return v?m.pos/v*100:null;}),ciM=M.map(m=>wilson(m.pos,m.pos+m.neg));
  const contM=M.map(m=>{const v=m.pos+m.neg+m.cont;return v?m.cont/v*100:null;});
  // meses provisionales: >20 % de cultivos pendientes (los negativos tardan ≥42 d; la positividad reciente se sobreestima)
  const prov=M.map(m=>m.c>0&&m.pend/m.c>0.2);
  const surf=cssv('--surface');
  const o2=baseOpts();o2.scales.y.ticks={callback:v=>v+' %',color:cssv('--ink2')};
  o2.plugins.tooltip.filter=c=>c.datasetIndex===2||c.datasetIndex===3;
  o2.plugins.tooltip.callbacks={label:c=>{const m=M[c.dataIndex];if(c.datasetIndex===2){const ci=ciM[c.dataIndex];const pv=prov[c.dataIndex]?' · PROVISIONAL ('+Math.round(m.pend/m.c*100)+' % pendiente)':'';return hidden(m.pos)?` Positividad: — (<5 positivos de ${m.pos+m.neg})`:` Positividad: ${fmt1(c.raw)} % (${ciTxt(ci)}) · ${m.pos}/${m.pos+m.neg}${pv}`;}return hidden(m.cont)?` Contaminación: — (<5 de ${m.pos+m.neg+m.cont})`:` Contaminación: ${fmt1(c.raw)} % · ${m.cont}/${m.pos+m.neg+m.cont}`;}};
  mk('ch-pos',{type:'line',data:{labels,datasets:[
    {label:'IC sup',data:ciM.map(c=>c&&c[1]),borderWidth:0,pointRadius:0,fill:false,spanGaps:true},
    {label:'IC inf',data:ciM.map(c=>c&&c[0]),borderWidth:0,pointRadius:0,fill:'-1',backgroundColor:s1+'26',spanGaps:true},
    {label:'Positividad',data:posM,borderColor:s1,backgroundColor:s1,pointBackgroundColor:prov.map(p=>p?surf:s1),pointBorderColor:prov.map(p=>p?s1:surf),segment:{borderDash:c=>prov[c.p1DataIndex]?[3,3]:undefined},borderWidth:2,pointRadius:4,pointHoverRadius:6,pointBorderWidth:2,tension:.25,spanGaps:true},
    {label:'Contaminación',data:contM,borderColor:s2,backgroundColor:s2,borderWidth:2,pointRadius:4,pointHoverRadius:6,pointBorderColor:cssv('--surface'),pointBorderWidth:2,tension:.25,spanGaps:true,borderDash:[5,4]}]},options:o2});
  const provL=labels.filter((l,i)=>prov[i]);
  $('pos-note').textContent=`Positividad global ${fmt1(posP)} % (${ciTxt(posCI)}). Bandas anchas indican pocos cultivos ese mes.`+(provL.length?` Puntos huecos = meses provisionales (${provL.join(', ')}): más del 20 % de cultivos aún pendientes; como los positivos se informan antes que los negativos, su positividad está sobreestimada.`:'');
  keys.forEach((k,i)=>{const m=M[i];pushX('Tendencia mensual','Positividad cultivo',labels[i],m.pos,m.pos+m.neg,ciM[i]);pushX('Tendencia mensual','Contaminación cultivo',labels[i],m.cont,m.pos+m.neg+m.cont);pushX('Tendencia mensual','Cultivos',labels[i],m.c,null);pushX('Tendencia mensual','Baciloscopias',labels[i],m.b,null);});

  /* --- tabla resultados de cultivo --- */
  const cultCats=[['Negativo',nNeg,'var(--neutral)'],['Positivo · MTBc',nMtb,'var(--crit)'],['Positivo · MNT',nMnt,'var(--serious)'],['Positivo · sin identificar',nSinId,'var(--s1)'],['Contaminado',nCont,'var(--warn)'],['No realizado',nNR,'var(--muted)'],['Pendiente',nPend,'var(--line)']];
  $('t-cult').innerHTML=C.length?stackBar(cultCats,C.length)+catTable(cultCats,C.length,'Cultivos'):'<div class="empty">Sin cultivos en el periodo</div>';
  cultCats.forEach(([l,n])=>pushX('Resultado cultivo',l,'',n,C.length));

  /* --- baciloscopia --- */
  const bc=k=>bkDone.filter(r=>r.bk===k).length;
  const bkCats=[['Negativo (−)',bc('NEG'),'var(--neutral)'],['1–9 BAAR',bc('1-9'),'var(--warn)'],['Positivo (+)',bc('1+'),'var(--serious)'],['Positivo (++)',bc('2+'),'var(--crit)'],['Positivo (+++)',bc('3+'),'var(--crit)'],['Positivo (escasos)',bc('ESC'),'var(--warn)'],['Se requiere confirmación',bc('CONF'),'var(--muted)']].filter(c=>c[1]||!['ESC','CONF'].some(k=>c[0].includes(k==='ESC'?'escasos':'confirm')));
  $('t-bk').innerHTML=bkDone.length?stackBar(bkCats,bkDone.length)+catTable(bkCats,bkDone.length,'Baciloscopias')+`<div class="note">Positividad BK ${fmt1(bkP)} % (${ciTxt(bkCI)}) · ${fmtN(bkPos.length)}/${fmtInt(bkDone.length)}</div>`:'<div class="empty">Sin baciloscopias con resultado</div>';
  bkCats.forEach(([l,n])=>pushX('Resultado baciloscopia',l,'',n,bkDone.length));

  /* --- concordancia BK vs cultivo --- */
  const pair=rows.filter(r=>(r.bkPos||r.bkNeg)&&(r.mtb||r.liq==='NEG'));
  const a=pair.filter(r=>r.bkPos&&r.mtb).length,b=pair.filter(r=>r.bkPos&&!r.mtb).length,c=pair.filter(r=>r.bkNeg&&r.mtb).length,d=pair.filter(r=>r.bkNeg&&!r.mtb).length;
  if(pair.length){
    const se=wilson(a,a+c),sp=wilson(d,b+d),ppv=wilson(a,a+b),npv=wilson(d,c+d);
    const mt=(l,x,n,ci)=>`<div class="metric"><div class="l">${l}</div><div class="v">${hidden(x)||!n?'—':fmt1(x/n*100)+' %'}</div><div class="c">${n?`${fmtN(x)}/${fmtInt(n)}${hidden(x)?'':' · '+ciTxt(ci)}`:'sin datos'}</div></div>`;
    $('t-conc').innerHTML=`<table class="ct"><tr><th></th><th>Cultivo MTBc +</th><th>Cultivo −</th></tr>
      <tr><th>BK +</th><td class="hit">${fmtN(a)}</td><td>${fmtN(b)}</td></tr><tr><th>BK −</th><td>${fmtN(c)}</td><td class="hit">${fmtN(d)}</td></tr></table>
      <div class="metrics">${mt('Sensibilidad BK',a,a+c,se)}${mt('Especificidad BK',d,b+d,sp)}${mt('VPP',a,a+b,ppv)}${mt('VPN',d,c+d,npv)}</div>
      <div class="note">n = ${fmtInt(pair.length)} muestras. Descriptivo; no sustituye una evaluación diagnóstica formal.</div>`;
    pushX('BK vs cultivo','Sensibilidad BK','',a,a+c,se);pushX('BK vs cultivo','Especificidad BK','',d,b+d,sp);
  }else $('t-conc').innerHTML='<div class="empty">No hay muestras con ambos resultados</div>';

  /* --- tiempo de respuesta --- */
  const BINS=[[0,7],[8,14],[15,21],[22,28],[29,35],[36,42],[43,49],[50,56],[57,999]];
  const bl=BINS.map(([x,y])=>y===999?'>56':`${x}–${y}`);
  const binOf=dd=>BINS.findIndex(([x,y])=>dd>=x&&dd<=y);
  const tN=BINS.map(()=>0),tP=BINS.map(()=>0),dN=[],dP=[];
  C.forEach(r=>{const dd=days(r.cRec,r.cInf);if(dd==null||dd<0||dd>180)return;if(r.liq==='NEG'){tN[binOf(dd)]++;dN.push(dd);}else if(r.liq==='POS'){tP[binOf(dd)]++;dP.push(dd);}});
  const o3=baseOpts();o3.scales.x.title={display:true,text:'Días desde la recepción',color:cssv('--ink3')};
  o3.plugins.tooltip.callbacks={title:c=>`${c[0].label} días`,label:c=>` ${c.dataset.label}: ${fmtN(c.raw)} cultivos`};
  mk('ch-tat',{type:'bar',data:{labels:bl,datasets:[bar('Negativo',tN,s1),bar('Positivo',tP,s2)]},options:o3});
  $('tat-note').textContent=`Negativos: mediana ${fmt1(quant(dN,.5))} d (RIC ${fmt1(quant(dN,.25))}–${fmt1(quant(dN,.75))}). Positivos: mediana ${fmt1(quant(dP,.5))} d (RIC ${fmt1(quant(dP,.25))}–${fmt1(quant(dP,.75))}). Umbral configurado: ${TH.tatC} d.`;
  EXPORT.push({sec:'Oportunidad',ind:'Mediana días cultivo negativo',cat:'',val:quant(dN,.5),q1:quant(dN,.25),q3:quant(dN,.75),n:dN.length});
  EXPORT.push({sec:'Oportunidad',ind:'Mediana días cultivo positivo',cat:'',val:quant(dP,.5),q1:quant(dP,.25),q3:quant(dP,.75),n:dP.length});

  /* --- especies --- */
  const espM=new Map();C.filter(r=>r.esp).forEach(r=>{if(!espM.has(r.esp))espM.set(r.esp,{n:0,p:new Set()});const o=espM.get(r.esp);o.n++;if(r.pid)o.p.add(r.pid);});
  if(espM.size){
    const mtbRow=espM.get('Complejo M. tuberculosis');
    const mntRows=[...espM.entries()].filter(([k])=>k!=='Complejo M. tuberculosis'&&k!=='Sin identificar').sort((x,y)=>y[1].n-x[1].n);
    const sinId=espM.get('Sin identificar');
    const nMntIso=mntRows.reduce((s,[,o])=>s+o.n,0),pMnt=new Set(mntRows.flatMap(([,o])=>[...o.p])).size;
    const row=(l,o,cls='',ind=false)=>`<tr class="${cls}"><td>${ind?'<span style="padding-left:14px"></span>':''}${esc(l)}</td><td class="n">${fmtN(o.n)}</td><td class="n">${fmtN(o.p.size??o.p)}</td><td class="n">${hidden(o.n)?'—':fmt1(o.n/nPos*100)+' %'}</td></tr>`;
    let h=`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Especie</th><th class="n">Aislamientos</th><th class="n">Pacientes</th><th class="n">% positivos</th></tr></thead><tbody>`;
    if(mtbRow)h+=row('Complejo M. tuberculosis',mtbRow,'group');
    if(mntRows.length){h+=row('Micobacterias no tuberculosas',{n:nMntIso,p:{size:pMnt}},'group');mntRows.forEach(([k,o])=>h+=row(k,o,'',true));}
    if(sinId)h+=row('Sin identificar',sinId);
    h+=`<tr class="total"><td>Total positivos</td><td class="n">${fmtN(nPos)}</td><td class="n">${fmtN(new Set(C.filter(r=>r.liq==='POS').map(r=>r.pid)).size)}</td><td class="n">100 %</td></tr></tbody></table></div>`;
    $('t-esp').innerHTML=h;
    espM.forEach((o,k)=>pushX('Especies',k,'',o.n,nPos));
  }else $('t-esp').innerHTML='<div class="empty">No hay cultivos positivos en el periodo</div>';

  /* --- pirámide (pacientes únicos) --- */
  renderPyramid(rows);

  /* --- positividad por tipo de TB / tipo de muestra / municipio --- */
  const posTable=(groupFn,title,limit,secName)=>{
    const g=new Map();rows.forEach(r=>{const k=groupFn(r)||'Sin dato';if(!g.has(k))g.set(k,{m:0,v:0,p:0,mtb:0});const o=g.get(k);o.m++;if(r.liq==='POS'||r.liq==='NEG')o.v++;if(r.liq==='POS')o.p++;if(r.mtb)o.mtb++;});
    let ent=[...g.entries()].sort((x,y)=>y[1].m-x[1].m);
    if(limit&&ent.length>limit){const rest=ent.slice(limit).reduce((s,[,o])=>({m:s.m+o.m,v:s.v+o.v,p:s.p+o.p,mtb:s.mtb+o.mtb}),{m:0,v:0,p:0,mtb:0});ent=ent.slice(0,limit).concat([[`Otras (${ent.length-limit})`,rest]]);}
    const maxP=Math.max(...ent.map(([,o])=>o.v?o.p/o.v:0),.01);
    let h=`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>${title}</th><th class="n">Muestras</th><th class="n">Cult. válidos</th><th class="n">MTBc</th><th class="n">Positividad</th><th class="bar-cell"></th></tr></thead><tbody>`;
    ent.forEach(([k,o])=>{const p=o.v?o.p/o.v*100:null,ci=wilson(o.p,o.v),hid=hidden(o.p);
      h+=`<tr><td>${esc(k)}</td><td class="n">${fmtN(o.m)}</td><td class="n">${fmtN(o.v)}</td><td class="n">${fmtN(o.mtb)}</td><td class="n">${p==null||hid?'—':fmt1(p)+' %'}<div class="ci">${p==null||hid?'':ciTxt(ci)}</div></td><td class="bar-cell"><div class="ibar"><i style="width:${p==null||hid?0:(o.p/o.v)/maxP*100}%"></i></div></td></tr>`;
      pushX(secName,'Positividad cultivo',k,o.p,o.v,ci);pushX(secName,'Muestras',k,o.m,null);});
    return h+'</tbody></table></div>';
  };
  $('t-tipotb').innerHTML=posTable(r=>r.tb&&titleCase(r.tb),'Tipo',0,'Por tipo de TB');
  $('t-muestra').innerHTML=posTable(r=>r.tm,'Tipo de muestra',8,'Por tipo de muestra');
  // municipio: muestras y pacientes MTBc
  const mg=new Map();rows.forEach(r=>{if(!mg.has(r.mun))mg.set(r.mun,{m:0,p:new Set(),mtb:new Set()});const o=mg.get(r.mun);o.m++;if(r.pid)o.p.add(r.pid);if(r.mtb&&r.pid)o.mtb.add(r.pid);});
  let me=[...mg.entries()].sort((x,y)=>y[1].m-x[1].m);
  if(me.length>8){const rest=me.slice(8);me=me.slice(0,8).concat([[`Otros (${rest.length})`,{m:rest.reduce((s,[,o])=>s+o.m,0),p:{size:rest.reduce((s,[,o])=>s+o.p.size,0)},mtb:{size:rest.reduce((s,[,o])=>s+o.mtb.size,0)}}]]);}
  $('t-mun').innerHTML=`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Municipio</th><th class="n">Muestras</th><th class="n">Pacientes</th><th class="n">Pac. MTBc</th></tr></thead><tbody>${me.map(([k,o])=>`<tr><td>${esc(k)}</td><td class="n">${fmtN(o.m)}</td><td class="n">${fmtN(o.p.size)}</td><td class="n">${fmtN(o.mtb.size)}</td></tr>`).join('')}</tbody></table></div>`;
  me.forEach(([k,o])=>{pushX('Por municipio','Muestras',k,o.m,null);pushX('Por municipio','Pacientes con MTBc',k,o.mtb.size,null);});

  /* --- EAPB --- */
  const eg=new Map();rows.forEach(r=>eg.set(r.eapb,(eg.get(r.eapb)||0)+1));
  let ee=[...eg.entries()].sort((x,y)=>y[1]-x[1]);
  if(ee.length>8){const rest=ee.slice(8).reduce((s,[,n])=>s+n,0);ee=ee.slice(0,8).concat([['Otras',rest]]);}
  const o4=baseOpts();o4.indexAxis='y';o4.interaction={mode:'nearest',axis:'y',intersect:false};
  o4.scales={x:{beginAtZero:true,grid:{color:cssv('--grid')},border:{display:false},ticks:{precision:0}},y:{grid:{display:false},border:{color:cssv('--line')}}};
  o4.plugins.tooltip.callbacks={label:c=>` ${fmtN(c.raw)} muestras (${hidden(c.raw)?'—':fmt1(c.raw/rows.length*100)+' %'})`};
  $('ch-eapb').parentElement.style.height=Math.max(180,ee.length*30+40)+'px';
  mk('ch-eapb',{type:'bar',data:{labels:ee.map(e=>e[0]),datasets:[bar('Muestras',ee.map(e=>e[1]),s1,{borderSkipped:'start',maxBarThickness:20})]},options:o4});
  ee.forEach(([k,n])=>pushX('Por asegurador','Muestras',k,n,rows.length));
}

function stackBar(cats,total){return`<div class="stack" role="img" aria-label="Distribución">${cats.filter(c=>c[1]).map(([l,n,col])=>`<i style="width:${n/total*100}%;background:${col}" title="${esc(l)}: ${fmtN(n)}"></i>`).join('')}</div>`;}
function catTable(cats,total,unit){
  return`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Resultado</th><th class="n">n</th><th class="n">%</th></tr></thead><tbody>${cats.map(([l,n,col])=>`<tr><td><span class="sw" style="background:${col}"></span>${l}</td><td class="n">${fmtN(n)}</td><td class="n">${hidden(n)?'—':fmt1(n/total*100)+' %'}</td></tr>`).join('')}<tr class="total"><td>${unit}</td><td class="n">${fmtInt(total)}</td><td class="n">100 %</td></tr></tbody></table></div>`;
}

function renderPyramid(rows){
  const AG=['0–4','5–14','15–24','25–34','35–44','45–54','55–64','65–74','75+'];
  const ag=e=>e==null?null:e<5?0:e<15?1:e<25?2:e<35?3:e<45?4:e<55?5:e<65?6:e<75?7:8;
  const pts=new Map();   // primera muestra de cada paciente
  rows.filter(r=>r.pid).forEach(r=>{if(!pts.has(r.pid))pts.set(r.pid,{sexo:r.sexo,edad:r.edad,mtb:false});const p=pts.get(r.pid);if(r.mtb)p.mtb=true;if(p.edad==null)p.edad=r.edad;if(!p.sexo)p.sexo=r.sexo;});
  const list=[...pts.values()].filter(p=>PYR==='all'||p.mtb);
  const M=AG.map(()=>0),F=AG.map(()=>0);let nd=0;
  list.forEach(p=>{const g=ag(p.edad);if(g==null||!p.sexo){nd++;return;}(p.sexo==='M'?M:F)[g]++;});
  const ages=list.map(p=>p.edad).filter(e=>e!=null);
  $('pyr-desc').textContent=`${PYR==='all'?'Pacientes únicos estudiados':'Pacientes con cultivo MTBc'}: ${fmtN(list.length)} · mediana de edad ${fmt1(quant(ages,.5))} años · ${fmtN(list.filter(p=>p.sexo==='M').length)} H / ${fmtN(list.filter(p=>p.sexo==='F').length)} M${nd?` · ${fmtN(nd)} sin edad/sexo`:''}`;
  const o=baseOpts();o.indexAxis='y';o.interaction={mode:'index',axis:'y',intersect:false};
  const mx=Math.max(1,...M,...F);
  o.scales={x:{stacked:true,suggestedMin:-mx,suggestedMax:mx,grid:{color:cssv('--grid')},border:{display:false},ticks:{callback:v=>Math.abs(v),precision:0}},y:{stacked:true,reverse:true,grid:{display:false},border:{color:cssv('--line')}}};
  o.plugins.tooltip.callbacks={title:c=>`${c[0].label} años`,label:c=>` ${c.dataset.label}: ${fmtN(Math.abs(c.raw))}`};
  mk('ch-pyr',{type:'bar',data:{labels:AG,datasets:[bar('Hombres',M.map(v=>-v),cssv('--s1'),{borderSkipped:false,categoryPercentage:.86,barPercentage:1,maxBarThickness:30}),bar('Mujeres',F,cssv('--s2'),{borderSkipped:false,categoryPercentage:.86,barPercentage:1,maxBarThickness:30})]},options:o});
  AG.forEach((g,i)=>{EXPORT.push({sec:'Pirámide ('+(PYR==='all'?'estudiados':'MTBc')+')',ind:'Hombres',cat:g,n:M[i],d:null});EXPORT.push({sec:'Pirámide ('+(PYR==='all'?'estudiados':'MTBc')+')',ind:'Mujeres',cat:g,n:F[i],d:null});});
}

/* === EXPORTACIONES (solo agregados) === */
function exportCSV(){
  const num=x=>x==null||isNaN(x)?'':String(Math.round(x*10)/10).replace('.',',');
  const lines=[['Sección','Indicador','Categoría','Numerador / n','Denominador','Valor (%) o mediana','IC95 inf / Q1','IC95 sup / Q3']];
  EXPORT.forEach(e=>{
    if('val'in e){lines.push([e.sec,e.ind,e.cat,e.n,'',num(e.val),num(e.q1),num(e.q3)]);return;}
    const hid=hidden(e.n);
    lines.push([e.sec,e.ind,e.cat,hid?'<5':e.n,e.d??'',hid||!e.d?'':num(e.n/e.d*100),hid||!e.ci?'':num(e.ci[0]),hid||!e.ci?'':num(e.ci[1])]);
  });
  const filt=`Filtros: año=${$('f-year').value}; periodo=${$('f-per').selectedOptions[0].text}; tipo TB=${$('f-tb').selectedOptions[0].text}; supresión <5=${SUPPRESS?'sí':'no'}`;
  const csv='﻿'+[[filt],...lines].map(r=>r.map(v=>{const s=String(v??'');return/[;"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}).join(';')).join('\r\n');
  download(new Blob([csv],{type:'text/csv;charset=utf-8'}),`indicadores_micobacterias_${stamp()}.csv`);
}
function exportPNG(id){
  const ch=CHARTS[id];if(!ch)return;const src=ch.canvas,card=src.closest('.card');
  const title=card.querySelector('h3').textContent,pad=24,th=40,fh=30,scale=2;
  const c=document.createElement('canvas');c.width=(src.clientWidth+pad*2)*scale;c.height=(src.clientHeight+pad*2+th+fh)*scale;
  const x=c.getContext('2d');x.scale(scale,scale);x.fillStyle=cssv('--surface');x.fillRect(0,0,c.width,c.height);
  x.fillStyle=cssv('--ink');x.font="600 15px 'Plex Sans'";x.fillText(title,pad,pad+14);
  x.drawImage(src,pad,pad+th,src.clientWidth,src.clientHeight);
  x.fillStyle=cssv('--ink3');x.font="11px 'Plex Sans'";x.fillText(`Labmédico · Red GERMEN — ${$('f-year').selectedOptions[0].text}, ${$('f-per').selectedOptions[0].text}, ${$('f-tb').selectedOptions[0].text}`,pad,pad+th+src.clientHeight+fh);
  c.toBlob(b=>download(b,`${id.replace('ch-','grafico_')}_${stamp()}.png`),'image/png');
}
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}
const stamp=()=>new Date().toISOString().slice(0,10);
