/* ── D1GO STATS ── *//* ── D1GO STATS ── */
function getMonthKeyFromDateKey(dateKey) {
  const s = String(dateKey || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  return s.slice(0, 7);
}

function formatMonthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return 'Sin mes';
  const [y, m] = monthKey.split('-');
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${meses[Number(m) - 1] || m} ${y}`;
}

function getMonthKeyFromAnyDate(value) {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m1) {
    const mm = String(m1[2]).padStart(2, '0');
    return `${m1[3]}-${mm}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return '';
}

function getRowDateForStats(row) {
  return row?.fechaDocumento || row?.fecha || row?.['Fecha documento'] || row?.['Fecha'] || row?.documentDate || '';
}

function hydrateOcMonthFilters() {
  const rows = getBaseRowsForStats();
  const monthSet = new Set((rows || []).map(r => getMonthKeyFromAnyDate(getRowDateForStats(r))).filter(Boolean));
  const months = Array.from(monthSet).sort().reverse();
  const options = '<option value="">Todos</option>' + months.map(m => `<option value="${m}">${formatMonthLabel(m)}</option>`).join('');
  if (statsMonthFilter) statsMonthFilter.innerHTML = options;
  if (chartsMonthFilter) chartsMonthFilter.innerHTML = options;
}

function applyMonthFilterToRows(rows, selectedMonth) {
  if (!selectedMonth) return rows || [];
  return (rows || []).filter(r => getMonthKeyFromAnyDate(getRowDateForStats(r)) === selectedMonth);
}


function hydrateD1goMonthOptions() {
  if (!d1goMesFilter) return;
  const previous = d1goMesFilter.value || '';
  const monthSet = new Set(
    (state.cruce.rows || [])
      .map(r => getMonthKeyFromDateKey(getD1goStatsMainDateKey(r)))
      .filter(Boolean)
  );
  const months = Array.from(monthSet).sort().reverse();
  d1goMesFilter.innerHTML = '<option value="">Todos</option>' +
    months.map(m => `<option value="${m}">${formatMonthLabel(m)}</option>`).join('');
  if (previous && months.includes(previous)) d1goMesFilter.value = previous;
}

function hydrateD1goYearOptions() {
  const yearFilter = $id('d1goYearFilter');
  if (!yearFilter) return;
  const previous = yearFilter.value || '';
  const yearSet = new Set((state.cruce.rows || [])
    .map(r => getD1goStatsMainDateKey(r))
    .map(k => String(k || '').slice(0, 4))
    .filter(y => /^\d{4}$/.test(y)));
  const years = Array.from(yearSet).sort().reverse();
  yearFilter.innerHTML = '<option value="">Todos</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
  if (previous && years.includes(previous)) yearFilter.value = previous;
}

function getD1goStatsMainDateKey(row) {
  return row?.fechaIngresoKey || row?.fechaCierreKey || '';
}

function normalizeD1goStatsStatusForView(estado) {
  const st = String(estado || 'Sin estado').trim() || 'Sin estado';
  const resum = $id('d1goResumenEstados');
  if (!resum?.checked) return st;
  const n = normalizeText(st);
  if (n.includes('cerrad') || n.includes('rechazad') || n.includes('anulad')) return 'Cerrado';
  if (n.includes('abiert') || n.includes('solicit') || n.includes('pendient')) return 'Abierto';
  return st;
}

function getVisibleD1goRows() {
  const estado=normalizeText(d1goEstadoFilter?.value||'');
  const sup=normalizeText(d1goSupervisorFilter?.value||'');
  const tienda=normalizeText(d1goTiendaFilter?.value||'');
  const fecha=String(d1goFechaFilter?.value||'').trim();
  const mes=String(d1goMesFilter?.value||'').trim();
  const year=String($id('d1goYearFilter')?.value||'').trim();
  const removeVitales=!!$id('d1goRemoveVitales')?.checked;
  const onlyVitales=!!$id('d1goOnlyVitales')?.checked;
  const cycleDays = Number(String(d1goCycleFilter?.value || '').trim() || 0);
  const search=normalizeText(d1goSearchInput?.value||'');
  const resumActivo = !!$id('d1goResumenEstados')?.checked;
  const includePreventivos = !!$id('d1goIncludePreventivos')?.checked;

  const referenceDateKey = fecha || String((state.cruce.rows||[]).map(r => getD1goStatsMainDateKey(r)).filter(Boolean).sort().slice(-1)[0] || '');

  return (state.cruce.rows||[]).filter(r=>{
    const isPreventivo = (typeof window.isD1goPreventivoRoutineRow === 'function')
      ? window.isD1goPreventivoRoutineRow(r)
      : normalizeText([r?.servicio, r?.tipo, r?.detalle, r?.detalleSolicitud].join('|')).includes('preventiv');
    if (!includePreventivos && isPreventivo) return false;

    const vital = (typeof isUrgenciaVitalRow === 'function') ? isUrgenciaVitalRow(r) : normalizeText(r?.prioridad || '').includes('urgencia vital');
    if (removeVitales && vital) return false;
    if (onlyVitales && !vital) return false;

    const rowEstadoLabel = resumActivo ? normalizeD1goStatsStatusForView(r.estadoGeneral) : getD1goPivotStatusLabel(r.estadoGeneral);
    const rowDateKey = getD1goStatsMainDateKey(r);
    const rowMonth = getMonthKeyFromDateKey(rowDateKey);
    const rowYear = String(rowDateKey || '').slice(0,4);

    const mE=!estado||normalizeText(rowEstadoLabel)===estado;
    const mS=!sup||normalizeText(r.supervisor)===sup||normalizeText(r.supervisor).includes(sup);
    const mT=!tienda||normalizeText(r.sucursal)===tienda||normalizeText(r.sucursal).includes(tienda);
    const mF=!fecha||rowDateKey===fecha;
    const mM=!mes||rowMonth===mes;
    const mY=!year||rowYear===year;
    let mC = true;
    if (cycleDays && referenceDateKey && r.fechaCierreKey) {
      const ref = new Date(referenceDateKey + 'T00:00:00');
      const close = new Date(String(r.fechaCierreKey) + 'T00:00:00');
      const diff = Math.round((ref - close) / 86400000);
      const closedState = normalizeText(r.estadoGeneral).includes('cerrad');
      mC = closedState && diff >= 1 && diff <= cycleDays;
    }
    const hs=normalizeText([r.id,r.estadoGeneral,rowEstadoLabel,r.sucursal,r.supervisor,r.area,r.servicio,r.tipo,r.detalle,r.detalleSolicitud,r.prioridad].join('|'));
    const mQ=!search||hs.includes(search);
    return mE&&mS&&mT&&mF&&mM&&mY&&mC&&mQ;
  });
}

function buildCategoryCountMap(rows, getter) {
  const map=new Map();
  (rows||[]).forEach(r=>{const n=String(getter(r)||'—').trim()||'—'; map.set(n,(map.get(n)||0)+1);});
  return map;
}

function createSimpleBarChart(canvasId, items, label) {
  const canvas=$id(canvasId); if(!canvas) return null;
  const theme = getChartThemeColors();
  return new Chart(canvas, {
    type:'bar',
    data:{labels:items.map(i=>i[0]),datasets:[{label,data:items.map(i=>i[1]),backgroundColor:'rgba(255,59,59,0.65)',borderColor:'rgba(255,59,59,1)',borderWidth:1.5}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:theme.text,font:{size:11,weight:'700'}}},datalabels:{anchor:'end',align:'top',color:theme.text,font:{weight:'700',size:11},formatter:v=>formatNumber(v)}},scales:{x:{ticks:{color:theme.text,font:{size:10,weight:'700'}},grid:{color:theme.grid}},y:{beginAtZero:true,ticks:{color:theme.text,font:{size:10,weight:'700'}},grid:{color:theme.grid}}}}
  });
}

function destroyD1goCharts(){
  if(d1goEstadoChartInstance){d1goEstadoChartInstance.destroy();d1goEstadoChartInstance=null;}
  if(d1goSupervisorChartInstance){d1goSupervisorChartInstance.destroy();d1goSupervisorChartInstance=null;}
  if(d1goTiendaChartInstance){d1goTiendaChartInstance.destroy();d1goTiendaChartInstance=null;}
}

function getD1goAgeAlerts(rows) {
  const today = new Date(); today.setHours(0,0,0,0);
  let warn30 = 0, crit60 = 0;
  (rows || []).forEach(r => {
    const e = normalizeText(r.estadoGeneral);
    const open = e.includes('abiert') || e.includes('solicit') || e.includes('pendient');
    if (!open || !r.fechaIngresoKey) return;
    const d = new Date(String(r.fechaIngresoKey) + 'T00:00:00'); if (isNaN(d.getTime())) return;
    const days = Math.floor((today - d) / 86400000);
    if (days > 60) crit60++; else if (days > 30) warn30++;
  });
  return { warn30, crit60 };
}

window._d1goStatsDetailMap = window._d1goStatsDetailMap || new Map();
function registerD1goStatsDetail(rows, label) {
  const key = `d1go_${window._d1goStatsDetailMap.size + 1}`;
  window._d1goStatsDetailMap.set(key, { rows: rows || [], label: label || '' });
  return key;
}
function buildD1goStatsCountButton(rows, label) {
  const count = rows?.length || 0;
  if (!count) return '<span class="cycle-empty-count">0</span>';
  const key = registerD1goStatsDetail(rows, label);
  return `<button class="cycle-count-btn" type="button" onclick="openD1goStatsDetail('${key}')">${formatNumber(count)}</button>`;
}
function getD1goStatusBucket(estado) {
  const n = normalizeText(estado || '');
  if (n.includes('cerrad') || n.includes('rechazad') || n.includes('anulad')) return 'cerradas';
  if (n.includes('abiert')) return 'abiertas';
  if (n.includes('solicit')) return 'solicitadas';
  if (n.includes('pendient')) return 'pendientes';
  return 'otros';
}
function getD1goPivotStatusLabel(estado) {
  const n = normalizeText(estado || '');
  if (n.includes('abiert')) return 'Abiertas';
  if (n.includes('solicit')) return 'Solicitadas';
  if (n.includes('anulad')) return 'Anuladas';
  if (n.includes('rechazad')) return 'Rechazadas';
  if (n.includes('cerrad')) return 'Cerradas';
  if (n.includes('pendient')) return 'Pendientes';
  return String(estado || 'Otros').trim() || 'Otros';
}

function getD1goMonthShortLabel(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey || ''))) return 'Sin mes';
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return meses[Number(String(monthKey).slice(5,7)) - 1] || String(monthKey);
}

function isD1goStatsClosedState(estado) {
  const n = normalizeText(estado || '');
  return n.includes('cerrad') || n.includes('rechazad') || n.includes('anulad');
}

function isD1goStatsOpenState(estado) {
  const n = normalizeText(estado || '');
  return n.includes('abiert') || n.includes('solicit') || n.includes('pendient');
}

function isD1goStatsVital(row) {
  if (typeof isUrgenciaVitalRow === 'function') return isUrgenciaVitalRow(row);
  return normalizeText([row?.prioridad, row?.tipoPrioridad, row?.criticidad, row?.urgencia, row?.detalle, row?.detalleSolicitud].join('|')).includes('urgencia vital');
}

function getD1goStatsTableLabel(row, resum) {
  const vital = isD1goStatsVital(row);
  const closed = isD1goStatsClosedState(row?.estadoGeneral);
  const open = isD1goStatsOpenState(row?.estadoGeneral);

  // En RESUM se separa vitales de normales:
  // - Abiertas = SOLO prioridad media/baja abiertas o solicitadas.
  // - Urg. vitales abiertas = SOLO urgencia vital abierta/solicitada.
  // - Cerradas = SOLO prioridad media/baja cerrada/rechazada/anulada.
  // - Urg. vitales cerradas = SOLO urgencia vital cerrada/rechazada/anulada.
  if (resum) {
    if (vital && closed) return 'Urg. vitales cerradas';
    if (vital && open) return 'Urg. vitales abiertas';
    if (!vital && closed) return 'Cerradas';
    if (!vital && open) return 'Abiertas';
    return vital ? 'Urg. vitales abiertas' : 'Abiertas';
  }

  return getD1goPivotStatusLabel(row?.estadoGeneral);
}

function buildD1goDynamicPivot(rows) {
  const resum = !!$id('d1goResumenEstados')?.checked;
  const selectedYear = String($id('d1goYearFilter')?.value || '').trim();
  const selectedMonth = String(d1goMesFilter?.value || '').trim();
  const selectedSupervisor = String(d1goSupervisorFilter?.value || '').trim();
  const includePreventivos = !!$id('d1goIncludePreventivos')?.checked;
  const removeVitales = !!$id('d1goRemoveVitales')?.checked;
  const onlyVitales = !!$id('d1goOnlyVitales')?.checked;

  const visibleRows = rows || [];
  const monthSet = new Set();
  visibleRows.forEach(r => {
    const mk = getMonthKeyFromDateKey(getD1goStatsMainDateKey(r));
    if (mk) monthSet.add(mk);
  });

  let months = [];
  if (selectedMonth) months = [selectedMonth];
  else if (selectedYear && /^\d{4}$/.test(selectedYear)) months = Array.from({ length: 12 }, (_, i) => `${selectedYear}-${String(i + 1).padStart(2, '0')}`);
  else months = Array.from(monthSet).sort();
  if (!months.length) months = ['Sin fecha'];

  let states;
  if (resum) {
    if (onlyVitales) states = ['Urg. vitales abiertas', 'Urg. vitales cerradas'];
    else if (removeVitales) states = ['Abiertas', 'Cerradas'];
    else states = ['Abiertas', 'Urg. vitales abiertas', 'Cerradas', 'Urg. vitales cerradas'];
  } else {
    const baseStates = ['Abiertas', 'Solicitadas', 'Anuladas', 'Rechazadas', 'Cerradas'];
    const hasPendientes = visibleRows.some(r => getD1goPivotStatusLabel(r.estadoGeneral) === 'Pendientes');
    const hasOtros = visibleRows.some(r => !['Abiertas','Solicitadas','Anuladas','Rechazadas','Cerradas','Pendientes'].includes(getD1goPivotStatusLabel(r.estadoGeneral)));
    states = [...baseStates];
    if (hasPendientes) states.splice(2, 0, 'Pendientes');
    if (hasOtros) states.push('Otros');
  }

  const grid = new Map();
  const totalByMonth = new Map();
  const vitalByMonth = new Map();
  const totalByLabel = new Map();
  const allTotalRows = [];
  const allVitalRows = [];
  function cellKey(label, monthKey) { return `${label}||${monthKey}`; }

  visibleRows.forEach(r => {
    const monthKey = getMonthKeyFromDateKey(getD1goStatsMainDateKey(r)) || 'Sin fecha';
    let label = getD1goStatsTableLabel(r, resum);
    if (!resum && !states.includes(label)) label = 'Otros';

    const k = cellKey(label, monthKey);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(r);
    if (!totalByLabel.has(label)) totalByLabel.set(label, []);
    totalByLabel.get(label).push(r);

    const tk = cellKey('Total', monthKey);
    if (!totalByMonth.has(tk)) totalByMonth.set(tk, []);
    totalByMonth.get(tk).push(r);
    allTotalRows.push(r);

    const vital = isD1goStatsVital(r);
    if (vital) {
      const vk = cellKey('Vitales', monthKey);
      if (!vitalByMonth.has(vk)) vitalByMonth.set(vk, []);
      vitalByMonth.get(vk).push(r);
      allVitalRows.push(r);
    }
  });

  const summary = {
    total: visibleRows.length,
    abiertas: visibleRows.filter(r => isD1goStatsOpenState(r.estadoGeneral) && !isD1goStatsVital(r)).length,
    cerradas: visibleRows.filter(r => isD1goStatsClosedState(r.estadoGeneral) && !isD1goStatsVital(r)).length,
    vitales: allVitalRows.length
  };

  const labelIcon = {
    'Abiertas': ['📂','open'], 'Abierto': ['📂','open'], 'Solicitadas': ['📄','req'], 'Anuladas': ['🗑️','cancel'],
    'Rechazadas': ['✖','reject'], 'Cerradas': ['✓','close'], 'Cerrado': ['✓','close'], 'Pendientes': ['⏳','req'],
    'Urg. vitales abiertas': ['⚠','vital-open'], 'Urg. vitales cerradas': ['✓','vital-close'],
    'Vitales': ['🚨','vital'], 'Total': ['📊','total'], 'Otros': ['•','open']
  };
  function labelCell(label) {
    const [ico, cls] = labelIcon[label] || ['•','open'];
    return `<span class="d1go-row-icon ${cls}">${ico}</span><strong>${escapeHtml(label)}</strong>`;
  }
  function rowClass(label) {
    return 'row-' + normalizeText(label).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  }

  const monthHeaders = months.map(m => `<th>${escapeHtml(getD1goMonthShortLabel(m))}</th>`).join('') + '<th class="total-head">Total</th>';
  const yearLine = selectedYear ? `Año ${escapeHtml(selectedYear)}` : 'Todos los años visibles';
  const supLine = selectedSupervisor ? `Supervisor: ${escapeHtml(d1goSupervisorFilter.options[d1goSupervisorFilter.selectedIndex]?.text || selectedSupervisor)}` : 'Todos los supervisores';
  const vitalLine = onlyVitales ? 'Vista: solo urgencias vitales' : (removeVitales ? 'Vista: abiertas/cerradas solo media y baja' : 'Vista: normales + urgencias vitales separadas');
  const preventivoLine = includePreventivos ? 'Preventivos: incluidos' : 'Preventivos: ocultos por Servicio/Rutina Preventiva';

  function rowHtml(label, sourceMap, extraClass='', totalRowsOverride=null) {
    const cells = months.map(m => {
      const cellRows = sourceMap.get(cellKey(label, m)) || [];
      return `<td>${buildD1goStatsCountButton(cellRows, `${label} / ${formatMonthLabel(m)}`)}</td>`;
    }).join('');
    const totalRows = totalRowsOverride || totalByLabel.get(label) || [];
    return `<tr class="${extraClass || rowClass(label)}"><td>${labelCell(label)}</td>${cells}<td class="total-cell">${buildD1goStatsCountButton(totalRows, `${label} / Total`)}</td></tr>`;
  }

  const stateRows = states.map(label => rowHtml(label, grid)).join('');
  const vitalRow = (!resum && !removeVitales) ? rowHtml('Vitales', vitalByMonth, 'row-vitales', allVitalRows) : '';
  const totalRow = rowHtml('Total', totalByMonth, 'row-total', allTotalRows);

  return { summary, html: `
    <div class="chart-helper-note"><strong>${yearLine}</strong> · ${supLine} · ${vitalLine} · ${preventivoLine}. En RESUM, <strong>Abiertas</strong> y <strong>Cerradas</strong> son solo prioridad media/baja; las urgencias vitales quedan en sus propias filas para no mezclarlas. Da clic sobre cualquier número para ver detalle y copiar incidencias.</div>
    <div class="d1go-pivot-table-wrap"><table class="d1go-pivot-table"><thead><tr><th>${labelCell('Total').replace('<strong>Total</strong>','<strong>ESTADO</strong>')}</th>${monthHeaders}</tr></thead><tbody>${stateRows}${vitalRow}${totalRow || `<tr><td colspan="${months.length + 2}" style="text-align:center;color:var(--muted);padding:24px;">No hay registros con los filtros actuales.</td></tr>`}</tbody></table></div>` };
}

function renderD1goStatsModal() {
  if(!d1goStatsModal||d1goStatsModal.style.display!=='block') return;
  window._d1goStatsDetailMap = new Map();
  const rows=getVisibleD1goRows();
  const age = getD1goAgeAlerts(rows);
  const noRowsBox = !rows.length ? '<div class="empty-state"><span class="icon">🔎</span>No hay D1GO visible con los filtros actuales. Limpia filtros o revisa estado, supervisor, tienda, año, mes o búsqueda.</div>' : '';
  const ageWarning = (age.warn30 || age.crit60) ? `<div class="d1go-warning-box">⚠️ Alertas D1GO visibles: <strong>${formatNumber(age.crit60)}</strong> casos abiertos/solicitados con más de 60 días y <strong>${formatNumber(age.warn30)}</strong> entre 31 y 60 días.</div>` : '';
  const pivot = buildD1goDynamicPivot(rows);
  d1goStatsContent.innerHTML = `${ageWarning}${noRowsBox}${pivot.html}`;
  const detail = $id('d1goDynamicDetail');
  if (detail) detail.innerHTML = '';
  destroyD1goCharts();
}

function openD1goStatsDetail(key) {
  const payload = window._d1goStatsDetailMap.get(key);
  const box = $id('d1goDynamicDetail');
  if (!payload || !box) return;
  const rows = payload.rows || [];
  box.innerHTML = `
    <div class="stats-card-block" style="margin-top:16px;">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
        <div><h4 style="margin:0;">Detalle de casos</h4><div class="modal-subtitle">${escapeHtml(payload.label)} · ${formatNumber(rows.length)} registros</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-secondary btn-sm" type="button" onclick="copyD1goStatsDetailIds('${key}')">Copiar incidencias</button><button class="btn btn-secondary btn-sm" type="button" onclick="exportD1goStatsDetail('${key}')">Exportar detalle</button></div>
      </div>
      <div class="table-scroll" style="max-height:330px;"><table class="stats-table" style="min-width:1080px;"><thead><tr><th>ID</th><th>Fecha solicitud</th><th>Estado</th><th>Prioridad</th><th>Supervisor</th><th>Tienda/Sucursal</th><th>Área</th><th>Servicio</th><th>Detalle D1GO AG</th></tr></thead><tbody>
        ${rows.map(r => `<tr><td>${escapeHtml(r.id||'')}</td><td>${escapeHtml(formatDateOnly(r.fechaIngresoDate) || formatDateValue(r.fechaIngreso) || formatDateLabelFromKey(r.fechaIngresoKey) || '')}</td><td>${escapeHtml(normalizeD1goStatsStatusForView(r.estadoGeneral||''))}</td><td>${escapeHtml(r.prioridad||'')}</td><td>${escapeHtml(r.supervisor||'')}</td><td>${escapeHtml(r.sucursal||'')}</td><td>${escapeHtml(r.area||'')}</td><td>${escapeHtml(r.servicio||'')}</td><td style="white-space:normal;min-width:360px;">${escapeHtml(r.detalleSolicitud || r.detalle || '')}</td></tr>`).join('')}
      </tbody></table></div>
    </div>`;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
window.openD1goStatsDetail = openD1goStatsDetail;
window.copyD1goStatsDetailIds = function(key) {
  const payload = window._d1goStatsDetailMap.get(key);
  const ids = [...new Set((payload?.rows || []).map(r => String(r.id || '').trim()).filter(Boolean))];
  if (!ids.length) { toast('No hay IDs para copiar', 'error'); return; }
  const text = ids.join(', ');
  navigator.clipboard?.writeText(text).then(() => toast('Incidencias copiadas separadas por comas ✅')).catch(() => showInfoDialog('Copiar incidencias', text));
};
window.exportD1goStatsDetail = function(key) {
  const payload = window._d1goStatsDetailMap.get(key);
  const rows = payload?.rows || [];
  if (!rows.length) { toast('No hay detalle para exportar', 'error'); return; }
  const wsData = rows.map(r => ({
    ID: r.id,
    Fecha_Solicitud: formatDateOnly(r.fechaIngresoDate) || formatDateValue(r.fechaIngreso) || formatDateLabelFromKey(r.fechaIngresoKey),
    Estado: normalizeD1goStatsStatusForView(r.estadoGeneral),
    Prioridad: r.prioridad,
    Supervisor: r.supervisor,
    Tienda: r.sucursal,
    Area: r.area,
    Detalle_D1GO_AG: r.detalleSolicitud || r.detalle || ''
  }));
  const ws = XLSX.utils.json_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Detalle_D1GO');
  XLSX.writeFile(wb, `detalle_D1GO_${formatDateKey(new Date())}.xlsx`);
};

function openD1goStatsModal() {
  if(!state.cruce.rows.length){showInfoDialog('Sin D1GO','Carga el archivo secundario primero.');return;}
  hydrateD1goStatsOptions();
  hydrateD1goMonthOptions();
  hydrateD1goYearOptions();
  hydrateCycleFilters();
  d1goStatsModal.style.display='block';
  renderD1goStatsModal();
}


function closeD1goStatsModal() { d1goStatsModal.style.display='none'; destroyD1goCharts(); }
window.closeD1goStatsModal = closeD1goStatsModal;

function clearD1goStatsFilters() {
  d1goEstadoFilter.value=''; d1goSupervisorFilter.value='';
  d1goTiendaFilter.value=''; d1goFechaFilter.value=''; if(d1goMesFilter) d1goMesFilter.value=''; if($id('d1goYearFilter')) $id('d1goYearFilter').value=''; if(d1goCycleFilter) d1goCycleFilter.value=''; if($id('d1goResumenEstados')) $id('d1goResumenEstados').checked=false; if($id('d1goIncludePreventivos')) $id('d1goIncludePreventivos').checked=false; setD1goVitalMode('all', false); d1goSearchInput.value='';
  hydrateD1goStatsOptions();
  hydrateD1goMonthOptions();
  hydrateD1goYearOptions();
  renderD1goStatsModal();
}



// Corrección: el botón «Exportar visible» tenía un listener, pero no existía esta función
// en el archivo original. Exporta exactamente los registros que cumplen los filtros D1Go.
function exportD1goFilteredData() {
  const rows = (typeof getVisibleD1goRows === 'function') ? getVisibleD1goRows() : [];
  if (!rows.length) {
    if (typeof toast === 'function') toast('No hay filas D1Go visibles para exportar', 'info');
    return;
  }
  const records = rows.map(r => ({
    ID: r.id || '', Estado: r.estadoGeneral || '', Fecha_Ingreso: r.fechaIngresoKey || '',
    Fecha_Cierre: r.fechaCierreKey || '', Tienda: r.sucursal || '', CECO: r.centroCoste || '',
    Supervisor: r.supervisor || '', Area: r.area || '', Prioridad: r.prioridad || '',
    Tipo: r.tipo || '', Servicio: r.servicio || '', Proveedor: r.proveedorAdjudicado || '',
    Contratista: r.contratista || '', Detalle: r.detalleSolicitud || r.detalle || ''
  }));
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(records);
  XLSX.utils.book_append_sheet(workbook, sheet, 'D1Go_Visible');
  XLSX.writeFile(workbook, 'D1GO_visible_' + formatDateKey(new Date()) + '.xlsx');
}