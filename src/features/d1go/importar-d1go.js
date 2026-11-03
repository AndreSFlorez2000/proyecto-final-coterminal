/* ── SECONDARY FILE ── */
function extractPossibleIncidentId(value) {
  const text = String(value??'').trim(); if(!text) return '';
  const direct = onlyDigits(text);
  if(direct.length>=4&&direct.length<=8) return direct;
  const patterns=[/incidencia\s*#?\s*(\d{4,8})/i,/id\s*[:#-]?\s*(\d{4,8})/i,/(^|\D)(\d{4,8})(\D|$)/];
  for(const pat of patterns){const m=text.match(pat); if(m) return onlyDigits(m[1]||m[2]||'');}
  return '';
}

function parseFlexibleDate(value) {
  if(!value) return null;
  if(value instanceof Date&&!isNaN(value)) return value;
  if(typeof value==='number'&&Number.isFinite(value)&&value>20000&&value<80000){
    const p=XLSX.SSF.parse_date_code(value); if(p) return new Date(p.y,p.m-1,p.d);
  }
  const str=String(value).trim();
  const d1=str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if(d1){let [,dd,mm,yy]=d1; if(yy.length===2) yy='20'+yy; return new Date(+yy,+mm-1,+dd);}
  const d2=str.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if(d2){return new Date(+d2[1],+d2[2]-1,+d2[3]);}
  const d3=new Date(str); if(!isNaN(d3.getTime())&&str.length>4) return d3;
  return null;
}

function formatDateKey(d) {
  if(!d||!(d instanceof Date)||isNaN(d)) return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDateLabelFromKey(key) {
  if(!key) return '';
  const [y,m,d]=String(key).split('-');
  if(!y||!m||!d) return key;
  return `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`;
}

function extractSecondaryId(row, entries, findValue) {
  const directId = findValue('ID Incidencia','Incidencia','ID','Número de caso','Numero de caso','Caso','Ticket');
  if (isMeaningful(directId)) return extractPossibleIncidentId(directId);
  // Antes se buscaba cualquier número en cualquier columna. Esto interpretaba
  // fechas, CECO o valores como ID de incidencia cuando el ID estaba vacío.
  // La alternativa segura: solo explorar campos cuyo ENCABEZADO indica un ID.
  for (const [header, value] of entries) {
    const key = normalizeText(header);
    if (/(incidencia|ticket|numero de caso|numero caso|nro caso|id caso)/.test(key)) {
      const found = extractPossibleIncidentId(value);
      if (found) return found;
    }
  }
  return '';
}

function normalizeSecondaryRow(row, index) {
  const entries=Object.entries(row||{});
  const find=(...cands)=>{
    for(const [k,v] of entries){const nk=normalizeText(k); if(cands.some(c=>nk===normalizeText(c))) return v;}
    for(const [k,v] of entries){const nk=normalizeText(k); if(cands.some(c=>nk.includes(normalizeText(c)))) return v;}
    return '';
  };

  const findByHeaderTokens = (positiveTokens = [], negativeTokens = []) => {
    const positives = positiveTokens.map(normalizeText);
    const negatives = negativeTokens.map(normalizeText);
    for (const [k, v] of entries) {
      const nk = normalizeText(k);
      const ok = positives.some(t => nk.includes(t));
      const bad = negatives.some(t => nk.includes(t));
      if (ok && !bad && isMeaningful(v)) return v;
    }
    return '';
  };

  const fiRaw = find(
    'Fecha Ingreso','Fecha ingreso','Fecha de ingreso','Fecha creación','Fecha Creacion','Fecha de creación','Fecha de creacion',
    'Fecha apertura','Fecha de apertura','Fecha registro','Fecha de registro','Fecha reporte','Fecha de reporte','Fecha solicitud','Fecha de solicitud'
  ) || findByHeaderTokens(['fecha'], ['cierre','cerrado','solucion','solución','final','fin','resuelto','terminacion','terminación']);

  const fcRaw = find(
    'Fecha Cierre','Fecha cierre','Fecha de cierre','Fecha cerrado','Fecha de cerrado','Fecha solucion','Fecha solución','Fecha de solucion','Fecha de solución',
    'Fecha finalización','Fecha finalizacion','Fecha de finalización','Fecha de finalizacion','Fecha terminación','Fecha terminacion',
    'Fecha de terminación','Fecha de terminacion','Fecha resuelto','Fecha de resuelto','Fecha cierre solicitud','Fecha cierre incidencia'
  ) || findByHeaderTokens(['cierre','cerrado','solucion','solución','final','terminacion','terminación','resuelto'], []);

  const fiDate=parseFlexibleDate(fiRaw), fcDate=parseFlexibleDate(fcRaw);
  const id=extractSecondaryId(row,entries,find);
  const ceco = getCentroCosteSAP(row);
  const dir = ceco && DIRECTORIO_CECO[ceco] ? DIRECTORIO_CECO[ceco] : null;
  const sucursalBase = String(find('Sucursal','Tienda','Nombre Tienda','Punto de venta')||'').trim();
  const supervisorBase = String(find('Supervisor','Responsable','Asignado a')||'').trim();

  // D1GO: el detalle largo normalmente viene en la columna AG.
  // Se prioriza esa columna para que el botón “Ver detalle” muestre la descripción completa,
  // incluso cuando el encabezado aparece recortado como “solicitud”.
  const agRaw = (
    entries[32]?.[1] ||  // AG exacta si A=0
    entries[33]?.[1] ||  // respaldo por columnas corridas
    entries[31]?.[1] ||  // respaldo por columnas corridas
    ''
  );
  const agDetalle = isMeaningful(agRaw) ? String(agRaw).trim() : '';
  const detalleExacto = String(find(
    'Detalle de solicitud','Detalle solicitud','Detalle Solicitud','Descripción de la solicitud','Descripcion de la solicitud',
    'Descripción de la incidencia','Descripcion de la incidencia','Descripción larga','Descripcion larga'
  ) || '').trim();
  const detalleGenerico = String(find(
    'Detalle','Comentarios','Observación','Observacion','Descripción','Descripcion','Solicitud'
  ) || '').trim();
  const detalleSolicitud = (agDetalle && agDetalle.length >= Math.max(10, detalleExacto.length))
    ? agDetalle
    : (detalleExacto || agDetalle || detalleGenerico || '');
  return {
    rowIndex:index+1, id,
    estadoGeneral:String(find('Estado General','Estado')||'').trim(),
    area:String(find('Area','Área')||'').trim(),
    sucursal: sucursalBase || (dir ? dir.tienda : ''),
    supervisor: supervisorBase || (dir ? dir.supervisor : ''),
    centroCoste: ceco || '',
    gerente: dir ? dir.gerente : '',
    prioridad:String(find('Prioridad')||'').trim(),
    tipo:String(find('Tipo','SubServicio','Sub Servicio')||'').trim(),
    servicio:String(find('Servicio')||'').trim(),
    proveedorAdjudicado:String(find('Proveedor Adjudicado','Proveedor')||'').trim(),
    contratista:String(find('Contratista')||'').trim(),
    detalle:detalleSolicitud,
    detalleSolicitud:detalleSolicitud,
    fechaIngreso:fiRaw, fechaIngresoDate:fiDate, fechaIngresoKey:formatDateKey(fiDate),
    fechaCierre:fcRaw, fechaCierreDate:fcDate, fechaCierreKey:formatDateKey(fcDate)
  };
}

function hydrateCruceFilterOptions() {
  cruceEstadoFilter.innerHTML='<option value="">Todos</option>'+state.cruce.estados.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  cruceSupervisorFilter.innerHTML='<option value="">Todos</option>'+state.cruce.supervisores.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
}

function hydrateD1goStatsOptions() {
  const rows=state.cruce.rows||[];
  const keep = {
    estado: d1goEstadoFilter?.value || '',
    supervisor: d1goSupervisorFilter?.value || '',
    tienda: d1goTiendaFilter?.value || '',
    fecha: d1goFechaFilter?.value || ''
  };
  const resumActivo = !!$id('d1goResumenEstados')?.checked;
  const estados = resumActivo
    ? ['Abierto','Cerrado']
    : [...new Set(rows.map(r=>getD1goPivotStatusLabel(r.estadoGeneral)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const sups=[...new Set(rows.map(r=>r.supervisor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const tiendas=[...new Set(rows.map(r=>r.sucursal).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const fechas=[...new Set(rows.map(r=>getD1goStatsMainDateKey(r)).filter(Boolean))].sort().reverse();
  d1goEstadoFilter.innerHTML='<option value="">Todos</option>'+estados.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  d1goSupervisorFilter.innerHTML='<option value="">Todos</option>'+sups.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  d1goTiendaFilter.innerHTML='<option value="">Todas</option>'+tiendas.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  d1goFechaFilter.innerHTML='<option value="">Todos</option>'+fechas.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(formatDateLabelFromKey(v))}</option>`).join('');
  if (keep.estado && estados.includes(keep.estado)) d1goEstadoFilter.value = keep.estado;
  if (keep.supervisor && sups.includes(keep.supervisor)) d1goSupervisorFilter.value = keep.supervisor;
  if (keep.tienda && tiendas.includes(keep.tienda)) d1goTiendaFilter.value = keep.tienda;
  if (keep.fecha && fechas.includes(keep.fecha)) d1goFechaFilter.value = keep.fecha;
}

function handleCruceFileUpload(e) {
  const file=e.target.files[0]; if(!file) return;
  showLoading('Cargando archivo secundario...');
  const reader=new FileReader();
  reader.onload=(event)=>{
    setTimeout(()=>{
      try{
        const data=new Uint8Array(event.target.result);
        const wb=XLSX.read(data,{type:'array',cellDates:true});
        const sheet=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:true,cellDates:true});
        if(!rows.length) throw new Error('El archivo secundario está vacío.');
        const normalizedAll=rows.map(normalizeSecondaryRow);
        const normalized=normalizedAll.filter(r=>r.id);
        const discardedWithoutId=normalizedAll.filter(r=>!r.id);
        if(!normalized.length) throw new Error('No se encontró columna ID con incidencias válidas.');
        state.cruce.rows=normalized;
        state.cruce.discardedWithoutId=discardedWithoutId; // Diagnóstico; no se mezcla con las vistas válidas.
        state.cruce.filteredRows=[];
        state.cruce.estados=[...new Set(normalized.map(r=>r.estadoGeneral).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
        state.cruce.supervisores=[...new Set(normalized.map(r=>r.supervisor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
        hydrateCruceFilterOptions();
        hydrateD1goStatsOptions();
        const secSummary = summarizeSecondary(normalized);
        $id('cruceFileStatus').innerHTML=`<strong>${escapeHtml(file.name)}</strong><br>${formatNumber(normalized.length)} registros · ${formatNumber(secSummary.unicas)} IDs únicos · ${formatNumber(secSummary.duplicadas)} duplicados${discardedWithoutId.length ? ' · '+formatNumber(discardedWithoutId.length)+' sin ID para revisar' : ''}`;
        cruceSecundarioStatus.textContent='✅ Listo';
        cruceSecundarioCount.textContent=normalized.length.toLocaleString('es-CO');
        renderSecondaryStats();
        cruceResultados.innerHTML=`<div class="empty-state"><span class="icon">✅</span>Archivo listo. Presiona <strong>Cruzar</strong>.</div>`;
        toast('Archivo secundario cargado ✅');
      }catch(err){
        cruceSecundarioStatus.textContent='Error';
        cruceSecundarioCount.textContent='0';
        showInfoDialog('Error archivo secundario', err.message||'No se pudo procesar.');
      }finally{ hideLoading(); }
    },30);
  };
  reader.onerror=()=>{hideLoading(); showInfoDialog('Error','Fallo al leer el archivo.');};
  reader.readAsArrayBuffer(file);
}

function summarizeSecondary(rows) {
  const s={total:rows.length,abiertas:0,solicitadas:0,pendientes:0,cerradas:0,porEstado:new Map(),porSup:new Map(),porSuc:new Map(),ids:new Map()};
  const add=(m,k)=>{const n=String(k||'—').trim()||'—'; m.set(n,(m.get(n)||0)+1);};
  rows.forEach(r=>{
    const e=normalizeText(r.estadoGeneral);
    if(e.includes('abierta')||e.includes('abierto')) s.abiertas++;
    if(e.includes('solicitada')||e.includes('solicitado')) s.solicitadas++;
    if(e.includes('pendiente')) s.pendientes++;
    if(e.includes('cerrada')||e.includes('cerrado')) s.cerradas++;
    add(s.porEstado,r.estadoGeneral); add(s.porSup,r.supervisor); add(s.porSuc,r.sucursal); add(s.ids, onlyDigits(r.id));
  });
  s.unicas = Array.from(s.ids.keys()).filter(Boolean).length;
  s.duplicadas = Array.from(s.ids.values()).filter(v=>v>1).reduce((a,v)=>a+(v-1),0);
  s.tasaCierre = s.total ? (s.cerradas / s.total) * 100 : 0;
  return s;
}

function topEntries(map,limit=10){
  return Array.from(map.entries()).sort((a,b)=>b[1]-a[1]).slice(0,limit);
}

function buildSimpleStatsTable(title, entries) {
  return `<div class="stats-card-block"><h4>${escapeHtml(title)}</h4><div style="overflow:auto;"><table class="stats-table" style="min-width:400px;"><thead><tr><th>Nombre</th><th>Cantidad</th></tr></thead><tbody>${entries.length?entries.map(([n,v])=>`<tr><td>${escapeHtml(n)}</td><td>${v}</td></tr>`).join(''):'<tr><td colspan="2">Sin datos</td></tr>'}</tbody></table></div></div>`;
}

function renderSecondaryStats() {
  const rows=state.cruce.rows||[];
  if(!rows.length){secundarioStats.innerHTML=''; secAbiertas.textContent='0'; secSolicitadas.textContent='0'; secCerradas.textContent='0'; return;}
  const s=summarizeSecondary(rows);
  secAbiertas.textContent=s.abiertas.toLocaleString('es-CO');
  secSolicitadas.textContent=s.solicitadas.toLocaleString('es-CO');
  secCerradas.textContent=s.cerradas.toLocaleString('es-CO');
  secundarioStats.innerHTML=`
    <div class="pro-info-banner">
      <div><strong>📊 Estado general D1GO del archivo cargado</strong><p>Este resumen analiza TODO el archivo D1GO cargado. No es el cruce. Úsalo para ver el estado operativo general antes de compararlo contra las OC.</p></div>
      <div class="pro-mini-kpis">
        <span class="pro-mini-kpi"><strong>${formatNumber(s.total)}</strong> registros</span>
        <span class="pro-mini-kpi"><strong>${formatNumber(s.unicas)}</strong> IDs únicos</span>
        <span class="pro-mini-kpi"><strong>${formatNumber(s.duplicadas)}</strong> duplicados</span>
        <span class="pro-mini-kpi"><strong>${s.tasaCierre.toFixed(1)}%</strong> cierre</span>
      </div>
    </div>
  ` + [
    buildSimpleStatsTable('Estados generales',topEntries(s.porEstado)),
    buildSimpleStatsTable('Supervisores',topEntries(s.porSup)),
    buildSimpleStatsTable('Tiendas',topEntries(s.porSuc))
  ].join('');
}
