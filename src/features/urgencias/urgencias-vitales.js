/* ── CCURGVITAL: TABLA DINÁMICA URGENCIA VITAL ── */
function getCCUrgVitalElements() {
  return {
    modal: $id('ccurgVitalModal'), start: $id('ccurgStart'), end: $id('ccurgEnd'), groupMode: $id('ccurgGroupMode'), rowLimit: $id('ccurgRowLimit'),
    tipo: $id('ccurgTipoFilter'), supervisor: $id('ccurgSupervisorFilter'), estado: $id('ccurgEstadoFilter'), resumen: $id('ccurgResumenEstados'), search: $id('ccurgSearchInput'), daysList: $id('ccurgDaysList'),
    content: $id('ccurgVitalContent'), detail: $id('ccurgVitalDetailBox')
  };
}
function getD1goPriorityText(r) {
  // En algunos archivos D1GO la prioridad no siempre llega exactamente en la columna "Prioridad".
  // Por eso se revisan varios campos posibles, pero el filtro sigue detectando solo casos Vitales.
  return normalizeText([
    r?.prioridad,
    r?.tipo,
    r?.servicio,
    r?.area,
    r?.categoria,
    r?.criticidad,
    r?.detalleSolicitud,
    r?.detalle
  ].filter(Boolean).join(' | '));
}

function isUrgenciaVitalRow(r) {
  const txt = getD1goPriorityText(r);
  return (
    txt.includes('urgencia vital') ||
    txt.includes('urgente vital') ||
    txt.includes('urg vital') ||
    txt.includes('urg. vital') ||
    (txt.includes('urgencia') && txt.includes('vital')) ||
    (txt.includes('urgente') && txt.includes('vital'))
  );
}
function getWeekMondayKey(dateKey) {
  if (!dateKey) return '';
  const d = new Date(String(dateKey) + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatDateKey(d);
}
function formatPivotDateShort(key) {
  if (!key) return '';
  const [y,m,d] = String(key).split('-').map(Number);
  if (!y || !m || !d) return key;
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d}-${meses[m-1] || m}`;
}
function setSuggestedCCUrgVitalDates() {
  const els = getCCUrgVitalElements();
  const keys = (getAllD1goRows() || []).filter(isUrgenciaVitalRow).map(r => r.fechaIngresoKey).filter(Boolean).sort();
  const maxKey = keys.length ? keys[keys.length - 1] : getMaxD1goDateKey();
  const end = new Date(String(maxKey) + 'T00:00:00');
  if (isNaN(end.getTime())) return;
  const start = new Date(end);
  start.setDate(end.getDate() - 21);
  if (els.start) els.start.value = formatDateKey(start);
  if (els.end) els.end.value = formatDateKey(end);
}
function hydrateCCUrgVitalFilters() {
  const els = getCCUrgVitalElements();
  const rows = (getAllD1goRows() || []).filter(isUrgenciaVitalRow);
  const tipos = [...new Set(rows.map(r => r.tipo || 'Sin tipo').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const sups = [...new Set(rows.map(r => r.supervisor || 'Sin supervisor').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const estados = [...new Set(rows.map(r => normalizeCCUrgVitalStatusForView(r.estadoGeneral || 'Sin estado')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const keepTipo = els.tipo?.value || '', keepSup = els.supervisor?.value || '', keepEst = els.estado?.value || '';
  if (els.tipo) { els.tipo.innerHTML = '<option value="">Todos</option>' + tipos.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join(''); els.tipo.value = keepTipo; }
  if (els.supervisor) { els.supervisor.innerHTML = '<option value="">Todos</option>' + sups.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join(''); els.supervisor.value = keepSup; }
  if (els.estado) { els.estado.innerHTML = '<option value="">Todos</option>' + estados.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join(''); els.estado.value = keepEst; }
}

function getCCUrgVitalAvailableDays() {
  const baseRows = getCCUrgVitalVisibleRows({ ignoreDaySelection: true });
  return [...new Set(baseRows.map(r => r.fechaIngresoKey).filter(Boolean))].sort();
}
function getSelectedCCUrgVitalDays() {
  if (window._ccurgVitalManualDaysTouched && window._ccurgVitalSelectedDays instanceof Set) {
    return new Set(window._ccurgVitalSelectedDays);
  }
  const els = getCCUrgVitalElements();
  if (!els.daysList) return new Set();
  return new Set([...els.daysList.querySelectorAll('input[type="checkbox"]:checked')].map(i => i.value).filter(Boolean));
}
function syncCCUrgVitalSelectedDaysFromDom() {
  const els = getCCUrgVitalElements();
  window._ccurgVitalSelectedDays = new Set(els.daysList ? [...els.daysList.querySelectorAll('input[type="checkbox"]:checked')].map(i => i.value).filter(Boolean) : []);
  window._ccurgVitalManualDaysTouched = true;
}
function setCCUrgVitalDaysChecked(mode) {
  const els = getCCUrgVitalElements();
  const days = getCCUrgVitalAvailableDays();
  window._ccurgVitalManualDaysTouched = true;
  window._ccurgVitalSelectedDays = mode === 'all' ? new Set(days) : new Set();
  if (els.daysList) {
    els.daysList.querySelectorAll('input[type="checkbox"]').forEach(chk => { chk.checked = mode === 'all'; });
  }
  renderCCUrgVitalModal();
  toast(mode === 'all' ? 'Todas las fechas de CCURGVITAL seleccionadas ✅' : 'Selecciones de CCURGVITAL quitadas ✅', 'success');
}
function renderCCUrgVitalDaySelector() {
  const els = getCCUrgVitalElements();
  if (!els.daysList) return;
  const previousChecked = getSelectedCCUrgVitalDays();
  const days = getCCUrgVitalAvailableDays();
  if (!days.length) {
    els.daysList.innerHTML = '<small style="color:var(--muted);font-family:var(--font-mono);">No hay días disponibles con los filtros actuales.</small>';
    return;
  }
  const shouldDefaultAll = previousChecked.size === 0 && !window._ccurgVitalManualDaysTouched;
  if (shouldDefaultAll) window._ccurgVitalSelectedDays = new Set(days);
  els.daysList.innerHTML = days.map(day => {
    const checked = shouldDefaultAll || previousChecked.has(day) ? 'checked' : '';
    return `<label class="ccurg-day-chip"><input type="checkbox" value="${escapeHtml(day)}" ${checked} /> ${escapeHtml(formatPivotDateShort(day))}</label>`;
  }).join('');
  els.daysList.querySelectorAll('input[type="checkbox"]').forEach(chk => chk.addEventListener('change', () => { syncCCUrgVitalSelectedDaysFromDom(); renderCCUrgVitalModal(); }));
}
function getCCUrgVitalVisibleRows(options = {}) {
  const els = getCCUrgVitalElements();
  const start = els.start?.value || '', end = els.end?.value || '';
  const tipo = normalizeText(els.tipo?.value || ''), sup = normalizeText(els.supervisor?.value || ''), est = normalizeText(els.estado?.value || ''), q = normalizeText(els.search?.value || '');
  const selectedDays = options.ignoreDaySelection ? new Set() : getSelectedCCUrgVitalDays();
  const blockAllDays = !options.ignoreDaySelection && !!window._ccurgVitalManualDaysTouched && selectedDays.size === 0;
  if (blockAllDays) return [];
  return (getAllD1goRows() || []).filter(r => {
    if (!isUrgenciaVitalRow(r)) return false;
    const fecha = r.fechaIngresoKey || '';
    if (start && fecha < start) return false;
    if (end && fecha > end) return false;
    if (selectedDays.size && !selectedDays.has(fecha)) return false;
    const rowTipo = normalizeText(r.tipo || 'Sin tipo');
    const rowSup = normalizeText(r.supervisor || 'Sin supervisor');
    const rowEst = normalizeText(normalizeCCUrgVitalStatusForView(r.estadoGeneral || 'Sin estado'));
    const hay = normalizeText([r.id, r.sucursal, r.supervisor, r.estadoGeneral, r.tipo, r.servicio, r.area, r.detalle, r.fechaIngresoKey].join('|'));
    return (!tipo || rowTipo === tipo || rowTipo.includes(tipo)) && (!sup || rowSup === sup || rowSup.includes(sup)) && (!est || rowEst === est) && (!q || hay.includes(q));
  });
}
function registerCCUrgVitalDetail(rows, title) {
  if (!window._ccurgVitalDetailMap) window._ccurgVitalDetailMap = new Map();
  const key = 'uv_' + window._ccurgVitalDetailMap.size;
  window._ccurgVitalDetailMap.set(key, { rows: rows || [], title });
  return key;
}
function buildCCUrgVitalPivot() {
  const els = getCCUrgVitalElements();
  const groupMode = els.groupMode?.value || 'week';
  const rows = getCCUrgVitalVisibleRows();
  const colSet = new Set();
  const supMap = new Map();
  const seen = new Set();
  rows.forEach(r => {
    const fecha = r.fechaIngresoKey || '';
    const col = groupMode === 'day' ? fecha : getWeekMondayKey(fecha);
    if (!col) return;
    const id = String(r.id || '').trim() || `${r.rowIndex || ''}-${fecha}`;
    const uniq = `${id}|${col}`;
    if (seen.has(uniq)) return;
    seen.add(uniq);
    const supervisor = r.supervisor || 'Sin supervisor';
    const estado = normalizeCCUrgVitalStatusForView(r.estadoGeneral || 'Sin estado');
    colSet.add(col);
    if (!supMap.has(supervisor)) supMap.set(supervisor, { supervisor, states: new Map(), totalByCol: new Map(), rows: [], total: 0 });
    const supObj = supMap.get(supervisor);
    if (!supObj.states.has(estado)) supObj.states.set(estado, { estado, byCol: new Map(), rows: [], total: 0 });
    const stObj = supObj.states.get(estado);
    const rowWithCol = { ...r, ccurgFechaCol: col };
    supObj.totalByCol.set(col, (supObj.totalByCol.get(col) || 0) + 1);
    supObj.total += 1; supObj.rows.push(rowWithCol);
    if (!stObj.byCol.has(col)) stObj.byCol.set(col, []);
    stObj.byCol.get(col).push(rowWithCol);
    stObj.total += 1; stObj.rows.push(rowWithCol);
  });
  let supervisors = [...supMap.values()].sort((a,b)=>b.total - a.total || a.supervisor.localeCompare(b.supervisor,'es'));
  const limitValue = els.rowLimit?.value || 'all';
  if (limitValue !== 'all') {
    const limit = Number(limitValue);
    if (Number.isFinite(limit) && limit > 0) supervisors = supervisors.slice(0, limit);
  }
  return { rows, cols: [...colSet].sort(), supervisors, totalSupervisorsFull: supMap.size };
}
function buildCCUrgCountCell(rows, title) {
  const count = (rows || []).length;
  if (!count) return '';
  const key = registerCCUrgVitalDetail(rows, title);
  return `<button class="ccurg-count-btn" type="button" onclick="openCCUrgVitalDetail('${key}')">${formatNumber(count)}</button>`;
}
function renderCCUrgVitalModal() {
  const els = getCCUrgVitalElements();
  if (!els.modal || els.modal.style.display !== 'block') return;
  window._ccurgVitalDetailMap = new Map();
  if (!els.content) return;
  renderCCUrgVitalDaySelector();
  const data = buildCCUrgVitalPivot();
  const cols = data.cols;
  const totalByCol = new Map(cols.map(c => [c, 0]));
  const totalIds = data.supervisors.reduce((a,s)=>a+s.total,0);
  const headers = cols.map(c => `<th>${escapeHtml(formatPivotDateShort(c))}</th>`).join('');
  const body = data.supervisors.map(s => {
    const supCells = cols.map(c => {
      const val = s.totalByCol.get(c) || 0;
      totalByCol.set(c, (totalByCol.get(c) || 0) + val);
      return `<td>${val ? formatNumber(val) : ''}</td>`;
    }).join('');
    const supKey = registerCCUrgVitalDetail(s.rows, `${s.supervisor} / Urgencia Vital`);
    const orderedStates = [...s.states.values()].sort((a,b)=>({'Abierta':1,'Cerrada':2,'Solicitada':3,'Pendiente':4}[a.estado] || 99) - ({'Abierta':1,'Cerrada':2,'Solicitada':3,'Pendiente':4}[b.estado] || 99) || a.estado.localeCompare(b.estado,'es'));
    const stateRows = orderedStates.map(st => {
      const cells = cols.map(c => buildCCUrgCountCell(st.byCol.get(c) || [], `${s.supervisor} / ${st.estado} / ${formatPivotDateShort(c)}`)).map(v=>`<td>${v}</td>`).join('');
      return `<tr><td class="state-cell">${escapeHtml(st.estado)}</td>${cells}<td><strong>${formatNumber(st.total)}</strong></td></tr>`;
    }).join('');
    return `<tr class="supervisor-row"><td>${escapeHtml(s.supervisor)} <button class="detail-btn" type="button" onclick="openCCUrgVitalDetail('${supKey}')">Ver casos</button></td>${supCells}<td>${formatNumber(s.total)}</td></tr>${stateRows}`;
  }).join('');
  const totalCells = cols.map(c => `<td>${formatNumber(totalByCol.get(c) || 0)}</td>`).join('');
  const empty = !totalIds ? '<div class="empty-state"><span class="icon">🔎</span>No hay registros con Prioridad Urgencia Vital para los filtros seleccionados.</div>' : '';
  els.content.innerHTML = `
    <div class="cycle-kpi-grid">
      <div class="cycle-kpi bad"><div class="label">Urgencia Vital</div><div class="value">${formatNumber(totalIds)}</div></div>
      <div class="cycle-kpi"><div class="label">Supervisores visibles</div><div class="value">${formatNumber(data.supervisors.length)}<span style="font-size:12px;color:var(--muted);">/${formatNumber(data.totalSupervisorsFull || data.supervisors.length)}</span></div></div>
      <div class="cycle-kpi"><div class="label">Columnas</div><div class="value">${formatNumber(cols.length)}</div></div>
      <div class="cycle-kpi warn"><div class="label">Agrupación</div><div class="value" style="font-size:18px;">${escapeHtml((els.groupMode?.value || 'week') === 'week' ? 'Semana' : 'Día')}</div></div>
    </div>
    ${empty}
    <div class="cycle-table-wrap">
      <table class="cycle-table ccurg-table" id="ccurgVitalTable">
        <thead class="ccurg-excel-head"><tr><th>Cuenta de ID</th><th colspan="${Math.max(cols.length,1)+1}">Etiquetas de columna</th></tr><tr><th>Etiquetas de fila</th>${headers}<th>Total general</th></tr></thead>
        <tbody>${body || `<tr><td colspan="${Math.max(cols.length,1)+2}">Sin datos</td></tr>`}<tr class="ccurg-grand-row"><td>Total general</td>${totalCells}<td>${formatNumber(totalIds)}</td></tr></tbody>
      </table>
    </div>`;
  if (els.detail) els.detail.innerHTML = '';
}
function openCCUrgVitalModal() {
  if (!getAllD1goRows().length) { showInfoDialog('Sin D1GO', 'Carga primero el archivo D1GO. CCURGVITAL se construye desde el archivo secundario D1GO.'); return; }
  const els = getCCUrgVitalElements();
  hydrateCCUrgVitalFilters();
  if (!els.start?.value || !els.end?.value) setSuggestedCCUrgVitalDates();
  if (els.groupMode && !els.groupMode.value) els.groupMode.value = 'day';
  if (els.modal) els.modal.style.display = 'block';
  renderCCUrgVitalModal();
}
window.openCCUrgVitalModal = openCCUrgVitalModal;
function closeCCUrgVitalModal() { const els = getCCUrgVitalElements(); if (els.modal) els.modal.style.display = 'none'; }
window.closeCCUrgVitalModal = closeCCUrgVitalModal;
function openCCUrgVitalDetail(key) {
  const els = getCCUrgVitalElements();
  const payload = window._ccurgVitalDetailMap?.get(key);
  const rows = payload?.rows || [];
  if (!els.detail) return;
  if (!rows.length) { els.detail.innerHTML = ''; return; }
  els.detail.innerHTML = `
    <div class="stats-card-block" style="margin-top:16px;">
      <div class="modal-header" style="margin-bottom:10px;padding-bottom:10px;"><div><div class="modal-title" style="font-size:16px;">Detalle CCURGVITAL</div><div class="modal-subtitle">${escapeHtml(payload.title || '')} · ${formatNumber(rows.length)} registros</div></div><div class="modal-actions"><button class="btn btn-secondary btn-sm" type="button" onclick="copyCCUrgVitalDetailIds('${key}')">Copiar incidencias</button><button class="btn btn-secondary btn-sm" type="button" onclick="exportCCUrgVitalDetail('${key}')">Exportar detalle</button></div></div>
      <div class="table-scroll" style="max-height:330px;"><table class="stats-table" style="min-width:1120px;"><thead><tr><th>ID</th><th>Columna</th><th>Fecha ingreso</th><th>Estado</th><th>Supervisor</th><th>Tienda/Sucursal</th><th>Tipo</th><th>Servicio</th><th>Detalle</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td>${escapeHtml(r.id||'')}</td><td>${escapeHtml(formatPivotDateShort(r.ccurgFechaCol)||'')}</td><td>${escapeHtml(formatDateValue(r.fechaIngreso)||formatDateLabelFromKey(r.fechaIngresoKey)||'')}</td><td>${escapeHtml(r.estadoGeneral||'')}</td><td>${escapeHtml(r.supervisor||'')}</td><td>${escapeHtml(r.sucursal||'')}</td><td>${escapeHtml(r.tipo||'')}</td><td>${escapeHtml(r.servicio||'')}</td><td style="white-space:normal;min-width:260px;">${escapeHtml(r.detalle||'')}</td></tr>`).join('')}
      </tbody></table></div>
    </div>`;
  els.detail.scrollIntoView({behavior:'smooth',block:'nearest'});
}
window.openCCUrgVitalDetail = openCCUrgVitalDetail;
window.copyCCUrgVitalDetailIds = function(key) {
  const rows = window._ccurgVitalDetailMap?.get(key)?.rows || [];
  const ids = [...new Set(rows.map(r=>String(r.id||'').trim()).filter(Boolean))];
  if (!ids.length) { toast('No hay IDs para copiar', 'error'); return; }
  const text = ids.join(', ');
  navigator.clipboard?.writeText(text).then(()=>toast('Incidencias copiadas separadas por comas ✅')).catch(()=>showInfoDialog('Copiar incidencias', text));
};
window.exportCCUrgVitalDetail = function(key) {
  const rows = window._ccurgVitalDetailMap?.get(key)?.rows || [];
  if (!rows.length) { toast('No hay detalle para exportar', 'error'); return; }
  const ws = XLSX.utils.json_to_sheet(rows.map(r=>({ID:r.id, Columna:formatPivotDateShort(r.ccurgFechaCol), Fecha_Ingreso:formatDateValue(r.fechaIngreso)||formatDateLabelFromKey(r.fechaIngresoKey), Estado:r.estadoGeneral, Supervisor:r.supervisor, Sucursal:r.sucursal, Tipo:r.tipo, Servicio:r.servicio, Detalle:r.detalle})));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Detalle CCURGVITAL'); XLSX.writeFile(wb, `detalle_CCURGVITAL_${formatDateKey(new Date())}.xlsx`);
};

function refreshCicloCortoIfOpen() {
  if (cicloCortoModal && cicloCortoModal.style.display === 'block') {
    hydrateCycleFilters();
    renderCicloCortoModal();
  }
}

function refreshCCUrgVitalIfOpen() {
  const els = getCCUrgVitalElements();
  if (els.modal && els.modal.style.display === 'block') {
    hydrateCCUrgVitalFilters();
    renderCCUrgVitalModal();
  }
}

function copyCCUrgVitalTable() {
  const table = document.getElementById('ccurgVitalTable');
  if (!table) { toast('No hay tabla para copiar', 'error'); return; }
  const text = [...table.querySelectorAll('tr')].map(tr=>[...tr.children].map(td=>td.innerText.replace(/\s+/g,' ').trim()).join('\t')).join('\n');
  navigator.clipboard?.writeText(text).then(()=>toast('Tabla CCURGVITAL copiada ✅')).catch(()=>showInfoDialog('Copiar tabla','Selecciona la tabla y copia manualmente.'));
}
function exportCCUrgVitalExcel() {
  const table = document.getElementById('ccurgVitalTable');
  if (!table) { toast('No hay tabla para exportar', 'error'); return; }
  const wb = XLSX.utils.table_to_book(table, { sheet: 'CCURGVITAL' });
  XLSX.writeFile(wb, `CCURGVITAL_${formatDateKey(new Date())}.xlsx`);
}

