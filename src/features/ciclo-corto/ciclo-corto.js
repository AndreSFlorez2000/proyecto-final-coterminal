/* ── CICLO CORTO SEMANAL: TABLA DINÁMICA POR FECHAS ── */
function getAllD1goRows() { return state.cruce.rows || []; }
function getMaxD1goDateKey() {
  const keys = getAllD1goRows().flatMap(r => [r.fechaIngresoKey, r.fechaCierreKey]).filter(Boolean).sort();
  return keys.length ? keys[keys.length - 1] : formatDateKey(new Date());
}
function setSuggestedCycleDates() {
  const maxKey = getMaxD1goDateKey();
  const end = new Date(maxKey + 'T00:00:00');
  if (isNaN(end.getTime())) return;
  const start = new Date(end);
  start.setDate(end.getDate() - 21);
  if (cycleCurrStart) cycleCurrStart.value = formatDateKey(start);
  if (cycleCurrEnd) cycleCurrEnd.value = formatDateKey(end);
  if (cyclePrevStart) cyclePrevStart.value = '';
  if (cyclePrevEnd) cyclePrevEnd.value = '';
}
function normalizeCycleStatus(estado) {
  const e = normalizeText(estado || '');
  if (e.includes('abiert')) return 'Abierta';
  if (e.includes('cerr')) return 'Cerrada';
  if (e.includes('solicit')) return 'Solicitada';
  if (e.includes('pendient')) return 'Pendiente';
  if (e.includes('rechaz')) return 'Rechazada';
  if (e.includes('anulad')) return 'Anulada';
  return estado ? String(estado).trim() : 'Sin estado';
}
function normalizeCycleStatusForView(estado) {
  const st = normalizeCycleStatus(estado);
  if (!cycleResumenEstados?.checked) return st;
  const e = normalizeText(st);
  if (e.includes('abiert') || e.includes('solicit')) return 'Abierta';
  if (e.includes('cerr') || e.includes('rechaz') || e.includes('anulad')) return 'Cerrada';
  return st;
}
function normalizeCCUrgVitalStatusForView(estado) {
  const st = normalizeCycleStatus(estado);
  const resum = document.getElementById('ccurgResumenEstados');
  if (!resum?.checked) return st;
  const e = normalizeText(st);
  if (e.includes('abiert') || e.includes('solicit')) return 'Abierta';
  if (e.includes('cerr') || e.includes('rechaz') || e.includes('anulad')) return 'Cerrada';
  return st;
}
function hydrateCycleFilters() {
  const rows = getAllD1goRows();
  const sups = [...new Set(rows.map(r => r.supervisor || 'Sin supervisor').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const estados = [...new Set(rows.filter(r => !(cycleRemoveVitales?.checked && isUrgenciaVitalRow(r))).map(r => normalizeCycleStatusForView(r.estadoGeneral || 'Sin estado')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const keepSup = cycleSupervisorFilter?.value || '';
  const keepEst = cycleEstadoFilter?.value || '';
  if (cycleSupervisorFilter) {
    cycleSupervisorFilter.innerHTML = '<option value="">Todos</option>' + sups.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    cycleSupervisorFilter.value = keepSup;
  }
  if (cycleEstadoFilter) {
    cycleEstadoFilter.innerHTML = '<option value="">Todos</option>' + estados.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    cycleEstadoFilter.value = keepEst;
  }
}
function keyInRange(key, start, end) {
  return !!(key && start && end && String(key) >= String(start) && String(key) <= String(end));
}
function cycleKeysForRow(r, type) {
  const status = normalizeCycleStatusForView(r.estadoGeneral);
  if (type === 'cierre') return r.fechaCierreKey ? [r.fechaCierreKey] : [];
  if (type === 'ambas') return [...new Set([r.fechaIngresoKey, r.fechaCierreKey].filter(Boolean))];
  if (type === 'auto') {
    if (status === 'Cerrada') return r.fechaCierreKey ? [r.fechaCierreKey] : (r.fechaIngresoKey ? [r.fechaIngresoKey] : []);
    return r.fechaIngresoKey ? [r.fechaIngresoKey] : (r.fechaCierreKey ? [r.fechaCierreKey] : []);
  }
  return r.fechaIngresoKey ? [r.fechaIngresoKey] : [];
}
function getCycleBaseRows() {
  const sup = normalizeText(cycleSupervisorFilter?.value || '');
  const est = normalizeText(cycleEstadoFilter?.value || '');
  const q = normalizeText(cycleSearchInput?.value || '');
  return getAllD1goRows().filter(r => {
    if (cycleRemoveVitales?.checked && isUrgenciaVitalRow(r)) return false;
    const rowSup = normalizeText(r.supervisor || 'Sin supervisor');
    const rowEst = normalizeText(normalizeCycleStatusForView(r.estadoGeneral || 'Sin estado'));
    const mS = !sup || rowSup === sup || rowSup.includes(sup);
    const mE = !est || rowEst === est;
    const hay = normalizeText([r.id, r.estadoGeneral, r.prioridad, r.sucursal, r.supervisor, r.area, r.detalle, r.fechaIngresoKey, r.fechaCierreKey].join('|'));
    return mS && mE && (!q || hay.includes(q));
  });
}
function getCycleAvailableDays() {
  const data = buildCyclePivot({ ignoreDaySelection: true });
  return data.dates || [];
}
function getSelectedCycleDays() {
  if (window._cycleManualDaysTouched && window._cycleSelectedDays instanceof Set) {
    return new Set(window._cycleSelectedDays);
  }
  const box = document.getElementById('cycleDaysList');
  if (!box) return new Set();
  return new Set([...box.querySelectorAll('input[type="checkbox"]:checked')].map(x => x.value));
}
function getCycleDaySelectionState() {
  const selected = getSelectedCycleDays();
  return {
    selected,
    manual: !!window._cycleManualDaysTouched,
    hasSelection: selected.size > 0
  };
}
function syncCycleSelectedDaysFromDom() {
  const box = document.getElementById('cycleDaysList');
  window._cycleSelectedDays = new Set(box ? [...box.querySelectorAll('input[type="checkbox"]:checked')].map(x => x.value) : []);
  window._cycleManualDaysTouched = true;
}
function setCycleDaysChecked(mode) {
  const days = getCycleAvailableDays();
  window._cycleManualDaysTouched = true;
  window._cycleSelectedDays = mode === 'all' ? new Set(days) : new Set();
  const box = document.getElementById('cycleDaysList');
  if (box) {
    box.querySelectorAll('input[type="checkbox"]').forEach(chk => { chk.checked = mode === 'all'; });
  }
  renderCicloCortoModal();
  toast(mode === 'all' ? 'Todas las fechas de Ciclo Corto seleccionadas ✅' : 'Selecciones de Ciclo Corto quitadas ✅', 'success');
}

function clearAllCycleSelections() {
  setCycleDaysChecked('none');
}
function renderCycleDaySelector() {
  const box = document.getElementById('cycleDaysList');
  if (!box) return;
  const previousChecked = getSelectedCycleDays();
  const days = getCycleAvailableDays();
  if (!days.length) {
    box.innerHTML = '<div class="file-status">No hay días disponibles con los filtros actuales.</div>';
    return;
  }
  const shouldDefaultAll = previousChecked.size === 0 && !window._cycleManualDaysTouched;
  if (shouldDefaultAll) window._cycleSelectedDays = new Set(days);
  box.innerHTML = days.map(day => {
    const checked = shouldDefaultAll || previousChecked.has(day) ? 'checked' : '';
    return `<label class="ccurg-day-chip"><input type="checkbox" value="${escapeHtml(day)}" ${checked} /> ${escapeHtml(formatDateLabelFromKey(day))}</label>`;
  }).join('');
  box.querySelectorAll('input[type="checkbox"]').forEach(chk => chk.addEventListener('change', () => { syncCycleSelectedDaysFromDom(); renderCicloCortoModal(); }));
}
function buildCyclePivot(options = {}) {
  const start = cycleCurrStart.value;
  const end = cycleCurrEnd.value;
  const type = cycleDateType.value || 'ingreso';
  const base = getCycleBaseRows();
  const unique = !!cycleUniqueIds?.checked;
  const dateSet = new Set();
  const supMap = new Map();
  const rowsInRange = [];
  const dayState = options.ignoreDaySelection ? { selected: new Set(), manual: false, hasSelection: false } : getCycleDaySelectionState();
  const selectedDays = dayState.selected;
  const blockAllDays = dayState.manual && !dayState.hasSelection;
  const seen = new Set();

  // Si el usuario oprime "Limpiar días", la tabla debe quedar vacía.
  // Antes un Set vacío se interpretaba como "mostrar todos", por eso parecía que no obedecía.
  if (blockAllDays) return { base, rows: [], supervisors: [], dates: [], start, end, type };

  function ensureSup(name) {
    const supName = name || 'Sin supervisor';
    if (!supMap.has(supName)) supMap.set(supName, { supervisor: supName, states: new Map(), totalByDate: new Map(), total: 0 });
    return supMap.get(supName);
  }
  function ensureState(supObj, stateName) {
    if (!supObj.states.has(stateName)) supObj.states.set(stateName, { state: stateName, byDate: new Map(), total: 0, rows: [] });
    return supObj.states.get(stateName);
  }
  base.forEach(r => {
    cycleKeysForRow(r, type).filter(k => keyInRange(k, start, end)).forEach(dateKey => {
      if (selectedDays.size && !selectedDays.has(dateKey)) return;
      const id = String(r.id || '').trim() || JSON.stringify(r).slice(0,60);
      const st = normalizeCycleStatusForView(r.estadoGeneral);
      const supName = r.supervisor || 'Sin supervisor';
      const dedupKey = `${dateKey}|${supName}|${st}|${id}`;
      if (unique && seen.has(dedupKey)) return;
      seen.add(dedupKey);
      dateSet.add(dateKey);
      const row = { ...r, cicloFechaKey: dateKey, cicloEstado: st, cicloSupervisor: supName };
      rowsInRange.push(row);
      const supObj = ensureSup(supName);
      const stateObj = ensureState(supObj, st);
      const arr = stateObj.byDate.get(dateKey) || [];
      arr.push(row);
      stateObj.byDate.set(dateKey, arr);
      stateObj.total++;
      stateObj.rows.push(row);
      supObj.totalByDate.set(dateKey, (supObj.totalByDate.get(dateKey) || 0) + 1);
      supObj.total++;
    });
  });
  const dates = [...dateSet].sort();
  const supervisors = [...supMap.values()].sort((a,b) => {
    const badA = [...a.states.values()].reduce((sum,x)=> sum + (['Abierta','Solicitada','Pendiente'].includes(x.state) ? x.total : 0), 0);
    const badB = [...b.states.values()].reduce((sum,x)=> sum + (['Abierta','Solicitada','Pendiente'].includes(x.state) ? x.total : 0), 0);
    return badB - badA || b.total - a.total || a.supervisor.localeCompare(b.supervisor, 'es');
  });
  return { base, rows: rowsInRange, supervisors, dates, start, end, type };
}
function cycleStatusClass(stateName) {
  const st = normalizeText(stateName);
  if (st.includes('cerr')) return 'good';
  if (st.includes('abiert')) return 'bad';
  if (st.includes('solicit') || st.includes('pendient')) return 'warn';
  return 'neutral';
}
window._cycleDetailMap = new Map();
function registerCycleDetail(rows, label) {
  const key = `cc_${window._cycleDetailMap.size + 1}`;
  window._cycleDetailMap.set(key, { rows, label });
  return key;
}
function buildCycleCountCell(rows, label) {
  const count = rows?.length || 0;
  if (!count) return '<span class="cycle-empty-count">0</span>';
  const key = registerCycleDetail(rows, label);
  return `<button class="cycle-count-btn" type="button" onclick="openCycleDetail('${key}')">${formatNumber(count)}</button>`;
}
function openCycleDetail(key) {
  const payload = window._cycleDetailMap.get(key);
  const box = document.getElementById('cicloCortoDetailBox');
  if (!payload || !box) return;
  const rows = payload.rows || [];
  box.innerHTML = `
    <div class="stats-card-block" style="margin-top:16px;">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
        <div><h4 style="margin:0;">Detalle de casos</h4><div class="modal-subtitle">${escapeHtml(payload.label)} · ${formatNumber(rows.length)} registros</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-secondary btn-sm" type="button" onclick="copyCycleDetailIds('${key}')">Copiar incidencias</button><button class="btn btn-secondary btn-sm" type="button" onclick="exportCycleDetail('${key}')">Exportar detalle</button></div>
      </div>
      <div class="table-scroll" style="max-height:330px;"><table class="stats-table" style="min-width:1080px;"><thead><tr><th>ID</th><th>Fecha solicitud</th><th>Estado</th><th>Supervisor</th><th>Tienda/Sucursal</th><th>Área</th><th>Servicio</th><th>Detalle D1GO AG</th></tr></thead><tbody>
        ${rows.map(r => `<tr><td>${escapeHtml(r.id||'')}</td><td>${escapeHtml(formatDateOnly(r.fechaIngresoDate) || formatDateValue(r.fechaIngreso) || formatDateLabelFromKey(r.fechaIngresoKey) || '')}</td><td>${escapeHtml(r.estadoGeneral||'')}</td><td>${escapeHtml(r.supervisor||'')}</td><td>${escapeHtml(r.sucursal||'')}</td><td>${escapeHtml(r.area||'')}</td><td>${escapeHtml(r.servicio||'')}</td><td style="white-space:normal;min-width:360px;">${escapeHtml(r.detalleSolicitud || r.detalle || '')}</td></tr>`).join('')}
      </tbody></table></div>
    </div>`;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
window.openCycleDetail = openCycleDetail;
window.copyCycleDetailIds = function(key) {
  const payload = window._cycleDetailMap.get(key);
  const ids = [...new Set((payload?.rows || []).map(r => String(r.id || '').trim()).filter(Boolean))];
  if (!ids.length) { toast('No hay IDs para copiar', 'error'); return; }
  const text = ids.join(', ');
  navigator.clipboard?.writeText(text).then(() => toast('Incidencias copiadas separadas por comas ✅')).catch(() => showInfoDialog('Copiar incidencias', text));
};
window.exportCycleDetail = function(key) {
  const payload = window._cycleDetailMap.get(key);
  const rows = payload?.rows || [];
  if (!rows.length) { toast('No hay detalle para exportar', 'error'); return; }
  const wsData = rows.map(r => ({
    ID: r.id,
    Fecha_Solicitud: formatDateOnly(r.fechaIngresoDate) || formatDateValue(r.fechaIngreso) || formatDateLabelFromKey(r.fechaIngresoKey),
    Estado: r.estadoGeneral,
    Supervisor: r.supervisor,
    Sucursal: r.sucursal,
    Area: r.area,
    Detalle: r.detalleSolicitud || r.detalle || ''
  }));
  const ws = XLSX.utils.json_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Detalle ciclo corto');
  XLSX.writeFile(wb, `detalle_ciclo_corto_${formatDateKey(new Date())}.xlsx`);
};
function renderCicloCortoModal() {
  if (!cicloCortoModal || cicloCortoModal.style.display !== 'block') return;
  window._cycleDetailMap = new Map();
  renderCycleDaySelector();
  const data = buildCyclePivot();
  const rows = data.rows;
  const closed = rows.filter(r => normalizeCycleStatusForView(r.estadoGeneral) === 'Cerrada').length;
  const open = rows.filter(r => normalizeCycleStatusForView(r.estadoGeneral) === 'Abierta').length;
  const solic = rows.filter(r => normalizeCycleStatusForView(r.estadoGeneral) === 'Solicitada').length;
  const pend = rows.filter(r => normalizeCycleStatusForView(r.estadoGeneral) === 'Pendiente').length;
  const cierre = rows.length ? (closed / rows.length) * 100 : 0;
  const modeLabel = data.type === 'auto' ? 'Auto: cerradas por fecha de cierre y demás por ingreso' : data.type === 'cierre' ? 'Fecha cierre' : data.type === 'ambas' ? 'Ingreso o cierre' : 'Fecha ingreso / creación';
  const topProblem = data.supervisors.map(s => {
    const bad = [...s.states.values()].reduce((sum,x)=> sum + (['Abierta','Solicitada','Pendiente'].includes(x.state) ? x.total : 0),0);
    return { sup: s.supervisor, bad, total: s.total };
  }).filter(x=>x.total).sort((a,b)=>b.bad-a.bad).slice(0,3);
  const alerts = topProblem.length
    ? topProblem.map(x => `<div class="cycle-alert ${x.bad ? 'bad':'good'}"><strong>${x.bad ? '⚠️' : '✅'} ${escapeHtml(x.sup)}</strong><br>${formatNumber(x.bad)} casos abiertos/solicitados/pendientes dentro del rango.</div>`).join('')
    : '<div class="cycle-alert good"><strong>✅ Sin alertas</strong><br>No hay casos para los filtros seleccionados.</div>';
  const dateHeaders = data.dates.map(d => `<th>${escapeHtml(formatDateLabelFromKey(d))}</th>`).join('');
  const totalByDate = new Map(data.dates.map(d => [d,0]));
  const bodyRows = data.supervisors.map(s => {
    const supCells = data.dates.map(d => {
      const count = s.totalByDate.get(d) || 0;
      totalByDate.set(d, (totalByDate.get(d) || 0) + count);
      return `<td>${count ? formatNumber(count) : ''}</td>`;
    }).join('');
    const orderedStates = [...s.states.values()].sort((a,b) => ({'Abierta':1,'Cerrada':2,'Solicitada':3,'Pendiente':4}[a.state] || 99) - ({'Abierta':1,'Cerrada':2,'Solicitada':3,'Pendiente':4}[b.state] || 99) || a.state.localeCompare(b.state,'es'));
    const stateRows = orderedStates.map(st => {
      const cells = data.dates.map(d => {
        const arr = st.byDate.get(d) || [];
        return `<td>${buildCycleCountCell(arr, `${s.supervisor} / ${st.state} / ${formatDateLabelFromKey(d)}`)}</td>`;
      }).join('');
      const detailKey = registerCycleDetail(st.rows, `${s.supervisor} / ${st.state} / rango completo`);
      return `<tr><td class="state-cell"><span class="cycle-status-dot ${cycleStatusClass(st.state)}"></span>${escapeHtml(st.state)} <button class="detail-btn" type="button" onclick="openCycleDetail('${detailKey}')">Detalle</button></td>${cells}<td><strong>${formatNumber(st.total)}</strong></td></tr>`;
    }).join('');
    const supDetailKey = registerCycleDetail([...s.states.values()].flatMap(x => x.rows), `${s.supervisor} / todos los estados`);
    return `<tr class="supervisor-row"><td>${escapeHtml(s.supervisor)} <button class="detail-btn" type="button" onclick="openCycleDetail('${supDetailKey}')">Ver casos</button></td>${supCells}<td>${formatNumber(s.total)}</td></tr>${stateRows}`;
  }).join('');
  const totalCells = data.dates.map(d => `<td>${formatNumber(totalByDate.get(d) || 0)}</td>`).join('');
  const noDaySelection = getCycleDaySelectionState().manual && !getCycleDaySelectionState().hasSelection;
  const emptyMessage = noDaySelection
    ? 'No hay días seleccionados. Usa el botón Todos para volver a mostrar las fechas.'
    : 'No hay registros D1GO en el rango seleccionado. Revisa las fechas, el tipo de fecha o los filtros.';
  const empty = !rows.length ? `<div class="empty-state"><span class="icon">🔎</span>${emptyMessage}</div>` : '';
  cicloCortoContent.innerHTML = `
    <div class="cycle-alert good"><strong>Fechas aplicadas</strong><br>${escapeHtml(formatDateLabelFromKey(data.start))} a ${escapeHtml(formatDateLabelFromKey(data.end))} · ${escapeHtml(modeLabel)}${cycleRemoveVitales?.checked ? ' · Sin Urgencia Vital' : ''}${cycleResumenEstados?.checked ? ' · RESUM activo' : ''}</div>
    <div class="cycle-kpi-grid">
      <div class="cycle-kpi"><div class="label">Total rango</div><div class="value">${formatNumber(rows.length)}</div></div>
      <div class="cycle-kpi bad"><div class="label">Abiertas</div><div class="value">${formatNumber(open)}</div></div>
      <div class="cycle-kpi good"><div class="label">Cerradas</div><div class="value">${formatNumber(closed)}</div></div>
      <div class="cycle-kpi warn"><div class="label">Solicitadas/Pend.</div><div class="value">${formatNumber(solic + pend)}</div></div>
      <div class="cycle-kpi"><div class="label">% cierre</div><div class="value">${cierre.toFixed(1)}%</div></div>
    </div>
    <div class="cycle-alerts">${alerts}<div class="cycle-alert warn"><strong>🧭 Fecha evaluada</strong><br>${escapeHtml(modeLabel)} · ${escapeHtml(formatDateLabelFromKey(data.start))} a ${escapeHtml(formatDateLabelFromKey(data.end))}.</div></div>
    ${empty}
    <div class="cycle-table-wrap">
      <table class="cycle-table" id="cicloCortoTable">
        <thead><tr><th>Supervisor / Estado</th>${dateHeaders}<th>Total general</th></tr></thead>
        <tbody>${bodyRows || '<tr><td colspan="2">Sin datos para mostrar</td></tr>'}<tr class="cycle-total-row"><td>Total general</td>${totalCells}<td>${formatNumber(rows.length)}</td></tr></tbody>
      </table>
    </div>
    <div id="cicloCortoDetailBox"></div>`;
}
function openCicloCortoModal() {
  try {
  if (!getAllD1goRows().length) {
    showInfoDialog('Sin D1GO', 'Carga primero el archivo D1GO. Este análisis usa todo el archivo D1GO, no solo las coincidencias del cruce con OC.');
    return;
  }
  hydrateCycleFilters();
  if (!cycleCurrStart.value || !cycleCurrEnd.value) setSuggestedCycleDates();
  cicloCortoModal.style.display = 'block';
  renderCicloCortoModal();
  } catch (err) { console.error('Error ciclo corto:', err); showInfoDialog('Error ciclo corto', err.message || 'No se pudo abrir el ciclo corto.'); }
}
window.openCicloCortoModal = openCicloCortoModal;
function closeCicloCortoModal() { if (cicloCortoModal) cicloCortoModal.style.display = 'none'; }
window.closeCicloCortoModal = closeCicloCortoModal;
function exportCicloCortoExcel() {
  const table = document.getElementById('cicloCortoTable');
  if (!table) { toast('No hay tabla para exportar', 'error'); return; }
  const wb = XLSX.utils.table_to_book(table, { sheet: 'Ciclo corto' });
  XLSX.writeFile(wb, `ciclo_corto_D1GO_${formatDateKey(new Date())}.xlsx`);
}
function copyCicloCortoTable() {
  const table = document.getElementById('cicloCortoTable');
  if (!table) { toast('No hay tabla para copiar', 'error'); return; }
  const rows = [...table.querySelectorAll('tr')].map(tr => [...tr.children].map(td => td.innerText.replace(/\s+/g, ' ').trim()).join('\t')).join('\n');
  navigator.clipboard?.writeText(rows).then(() => toast('Tabla copiada ✅')).catch(() => showInfoDialog('Copiar tabla', 'Selecciona la tabla y copia manualmente.'));
}


