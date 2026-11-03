/* ── STATS ── */
function getBaseRowsForStats() {
  // Las estadísticas resumidas deben usar exactamente la misma base que la barra financiera:
  // Sheet1 filtrada por proveedor/tienda/supervisor/mes y por el botón con/sin eliminadas L.
  // No depende de la pestaña visual seleccionada, porque si el usuario está en Activos,
  // Pendientes o Eliminadas, los totales internos se descuadran frente a los de afuera.
  if (!state.rowsByView.sheet1.length) return [];
  return Array.isArray(state.searchedRows.sheet1) ? state.searchedRows.sheet1 : [];
}

function getStatsDedupKey(row) {
  return [
    row.ocDigits || row.oc || '',
    row.incidencia || '',
    row.cotizacion || '',
    normalizeText(row.proveedor || ''),
    normalizeText(row.tienda || ''),
    normalizeText(row.supervisor || ''),
    Number(row.rawPrecioNeto || 0),
    Number(row.rawPorEntregarValor || 0),
    Number(row.rawPorEntregarCantidad || 0),
    row.viewGroup || '',
    normalizeText(row.textoBreve || '')
  ].join('|');
}

function buildGroupedStats(rows, key, includeActivos = true) {
  // Misma lógica que la barra principal:
  // - NO se excluyen borrados aquí; el botón con/sin eliminadas ya filtró rows.
  // - NO se excluyen activos del total; los activos también pueden estar facturados o pendientes.
  // - NO se deduplican filas; si Excel trae una línea válida, debe sumar como afuera.
  // - Total general = Facturado + Pendiente.
  const map = new Map();

  (rows || []).forEach(row => {
    if (!row) return;

    const name = String(row[key] || 'No disponible').trim() || 'No disponible';
    const cur = map.get(name) || { name, cantidad: 0, total: 0, pendiente: 0, facturado: 0, activos: 0, x: 0 };

    const precioNeto = Number(row.rawPrecioNeto || 0);
    const pendienteBase = Number(row.rawPorEntregarValor || 0);

    cur.cantidad += 1;
    cur.pendiente += pendienteBase;
    cur.x += Number(row.xLiberacion || 0);

    if (esFacturadaOC(row)) {
      cur.facturado += precioNeto;
    }

    if (esActivoOC(row)) {
      cur.activos += precioNeto;
    }

    // Se recalcula abajo, pero se deja acumulado por claridad.
    cur.total = cur.facturado + cur.pendiente;

    map.set(name, cur);
  });

  map.forEach(v => {
    v.total = Number(v.facturado || 0) + Number(v.pendiente || 0);
  });

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}


function hydrateStatsSupervisorFilters() {
  const rows = getBaseRowsForStats().filter(r => r);
  const supervisors = Array.from(new Set(rows.map(r => String(r.supervisor || '').trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'es'));
  const options = '<option value="">Todos</option>' + supervisors.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  if (statsSupervisorFilter) statsSupervisorFilter.innerHTML = options;
  if (chartsSupervisorFilter) chartsSupervisorFilter.innerHTML = options;
}

function getStatsAlarmInfo(row) {
  const fact = Number(row.facturado || 0);
  const pend = Number(row.pendiente || 0);
  const ratio = fact > 0 ? pend / fact : (pend > 0 ? 1 : 0);
  if (ratio >= 0.7) return { cls: 'crit', rowCls: 'row-critica', text: 'Alta > 70%' };
  if (ratio >= 0.6) return { cls: 'warn', rowCls: 'row-alerta', text: 'Alerta > 60%' };
  return { cls: 'ok', rowCls: '', text: 'Controlado' };
}

function getRowsForOcAnalytics(type = 'stats', onlySelected = false) {
  // ÚNICA BASE OFICIAL PARA ESTADÍSTICAS Y GRÁFICAS.
  // Debe coincidir con la barra principal: Sheet1 ya filtrada por búsqueda global,
  // botón con/sin eliminadas L y botón incluir/quitar activos.
  let rows = getBaseRowsForStats();

  const selectedMonth = String((type === 'charts' ? chartsMonthFilter?.value : statsMonthFilter?.value) || '').trim();
  const supervisorFilter = normalizeText(state[type]?.supervisorFilter || '');
  const includeActivos = state.filters.includeActivos !== false;

  rows = applyMonthFilterToRows(rows, selectedMonth);

  if (!includeActivos) {
    rows = rows.filter(r => !esActivoOC(r));
  }

  if (supervisorFilter) {
    rows = rows.filter(r => normalizeText(r.supervisor || '') === supervisorFilter);
  }

  if (onlySelected && state[type]?.selected?.size) {
    const mode = state[type].mode || 'proveedor';
    rows = rows.filter(r => {
      const name = String(r[mode] || 'No disponible').trim() || 'No disponible';
      return state[type].selected.has(name);
    });
  }

  return rows;
}

function getFilteredGroupItems(mode, searchText, type = 'stats') {
  const rows = getRowsForOcAnalytics(type, false);
  const grouped = buildGroupedStats(rows, mode, state.filters.includeActivos !== false);
  const s = normalizeText(searchText || '');
  let filtered = !s ? grouped : grouped.filter(i => normalizeText(i.name).includes(s));
  const orderBy = state[type].orderBy || 'total';
  filtered.sort((a, b) => {
    if (orderBy === 'facturado') return (b.facturado || 0) - (a.facturado || 0);
    if (orderBy === 'pendiente') return (b.pendiente || 0) - (a.pendiente || 0);
    return (b.total || 0) - (a.total || 0);
  });
  return filtered;
}

function getSelectedOrTopItems(type) {
  /* La búsqueda lateral NO borra la comparación visual seleccionada. */
  const visibleItems = getFilteredGroupItems(state[type].mode, state[type].search, type);
  const allItemsForCurrentContext = getFilteredGroupItems(state[type].mode, '', type);
  if (state[type].selected.size > 0) {
    const selectedRows = allItemsForCurrentContext.filter(i => state[type].selected.has(i.name));
    return selectedRows.length ? selectedRows : [];
  }
  return visibleItems.slice(0,9);
}

/* Mantiene la selección manual. La búsqueda escrita no invalida lo seleccionado;
   solo se elimina si ya no existe en el contexto real: modo, mes, supervisor o activos. */
function preserveValidSelection(type = 'charts') {
  if (!state[type] || !state[type].selected) return;
  const validNames = new Set(getFilteredGroupItems(state[type].mode, '', type).map(i => i.name));
  state[type].selected = new Set([...state[type].selected].filter(name => validNames.has(name)));
}

function renderChartExecutiveSummary(items) {
  const box = $id('chartExecutiveSummary');
  if (!box) return;
  const total = items.reduce((acc, r) => acc + Number(r.total || 0), 0);
  const pendiente = items.reduce((acc, r) => acc + Number(r.pendiente || 0), 0);
  const facturado = items.reduce((acc, r) => acc + Number(r.facturado || 0), 0);
  const activos = items.reduce((acc, r) => acc + Number(r.activos || 0), 0);
  const xLib = items.reduce((acc, r) => acc + Number(r.x || 0), 0);
  const selectedCount = state.charts.selected.size;
  const labelSeleccion = selectedCount > 0 ? `${selectedCount} seleccionados` : `Top ${items.length}`;
  box.innerHTML = `
    <div class="chart-summary-card"><div class="label">Vista</div><div class="value">${escapeHtml(getModeLabel(state.charts.mode))}</div></div>
    <div class="chart-summary-card"><div class="label">Comparando</div><div class="value">${escapeHtml(labelSeleccion)}</div></div>
    <div class="chart-summary-card"><div class="label">Total</div><div class="value">${escapeHtml(formatCurrency(total))}</div></div>
    <div class="chart-summary-card"><div class="label">Pendiente</div><div class="value">${escapeHtml(formatCurrency(pendiente))}</div></div>
    <div class="chart-summary-card"><div class="label">Facturado</div><div class="value">${escapeHtml(formatCurrency(facturado))}</div></div>
    <div class="chart-summary-card"><div class="label">Activos / X Lib.</div><div class="value">${escapeHtml(formatCurrency(activos))} · ${formatNumber(xLib)}</div></div>
  `;
}

const CHARTS_UI_STORAGE_KEY = 'control_oc_charts_ui_v2';
function saveChartsUiState() {
  try {
    localStorage.setItem(CHARTS_UI_STORAGE_KEY, JSON.stringify({
      mode: state.charts.mode,
      search: state.charts.search,
      selected: [...state.charts.selected],
      includeActivos: !!state.charts.includeActivos,
      supervisorFilter: state.charts.supervisorFilter || '',
      orderBy: state.charts.orderBy || 'total',
      month: chartsMonthFilter?.value || ''
    }));
  } catch (e) {}
}

function loadChartsUiState() {
  try {
    const raw = localStorage.getItem(CHARTS_UI_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return;
    state.charts.mode = saved.mode || state.charts.mode || 'proveedor';
    state.charts.search = saved.search || '';
    state.charts.selected = new Set(Array.isArray(saved.selected) ? saved.selected : []);
    state.charts.includeActivos = !!saved.includeActivos;
    state.charts.supervisorFilter = saved.supervisorFilter || '';
    state.charts.orderBy = saved.orderBy || 'total';
    if (chartsMonthFilter && saved.month !== undefined) chartsMonthFilter.value = saved.month || '';
  } catch (e) {}
}

function refreshChartsKeepingSelection() {
  preserveValidSelection('charts');
  renderSelectionList('charts');
  renderChartsModal();
  saveChartsUiState();
}

function refreshStatsKeepingSelection() {
  preserveValidSelection('stats');
  renderSelectionList('stats');
  renderStatsSummary();
}

function renderSelectionList(type) {
  const items = getFilteredGroupItems(state[type].mode, state[type].search, type);
  const container = type==='stats' ? statsSelectionList : chartsSelectionList;
  if (!items.length) { container.innerHTML=`<div style="font-size:12px; color:var(--muted); line-height:1.45;">Sin elementos para esa búsqueda.<br><span style="opacity:.85;">La comparación seleccionada se mantiene.</span></div>`; return; }
  container.innerHTML = items.map(item => `
    <button type="button" class="select-chip ${state[type].selected.has(item.name)?'active':''}" data-name="${escapeHtml(item.name)}">
      <span>${escapeHtml(item.name)}</span>
      <small>${escapeHtml(formatCurrency(item.total))}</small>
    </button>
  `).join('');
  container.querySelectorAll('.select-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-name');
      if (state[type].selected.has(name)) state[type].selected.delete(name);
      else state[type].selected.add(name);
      renderSelectionList(type);
      if (type==='stats') renderStatsSummary();
      else { renderChartsModal(); saveChartsUiState(); }
    });
  });
}

function getModeLabel(m) { return m==='proveedor'?'Proveedores':m==='tienda'?'Tiendas':'Supervisores'; }

function buildStatsTable(title, rows) {
  return `<div class="stats-card-block">
    <h4>${escapeHtml(title)}</h4>
    <div class="stats-table-wrap">
      <table class="stats-table">
        <thead><tr><th>Nombre</th><th>Cantidad</th><th>Total</th><th>Pendiente</th><th>Facturado</th><th>Activos</th><th>Alarma</th><th>X lib.</th></tr></thead>
        <tbody>${rows.length?rows.map(r=>{ const alarm=getStatsAlarmInfo(r); return `<tr class="${alarm.rowCls}"><td>${escapeHtml(r.name)}</td><td>${r.cantidad}</td><td>${escapeHtml(formatCurrency(r.total))}</td><td>${escapeHtml(formatCurrency(r.pendiente))}</td><td>${escapeHtml(formatCurrency(r.facturado))}</td><td>${escapeHtml(formatCurrency(r.activos))}</td><td><span class="alarm-pill ${alarm.cls}">${alarm.text}</span></td><td>${r.x}</td></tr>`; }).join(''):'<tr><td colspan="8">Sin datos</td></tr>'}</tbody>
      </table>
    </div>
  </div>`;
}

function renderStatsSummary() {
  const rows = getSelectedOrTopItems('stats');

  // Los KPI superiores del modal se calculan desde las filas reales, no desde el resumen agrupado.
  // Así cuadran exactamente con la barra de afuera para el mismo filtro, por ejemplo WESTON.
  const rawRowsForKpis = getRowsForOcAnalytics('stats', state.stats.selected.size > 0);
  const totals = calcularTotalesBarraPrincipal(rawRowsForKpis);

  const totalGeneral = totals.generadas;
  const totalPendiente = totals.pendiente;
  const totalFacturado = totals.facturado;
  const totalActivos = totals.activos;
  const criticas = rows.filter(r => getStatsAlarmInfo(r).cls === 'crit').length;
  const alertas = rows.filter(r => getStatsAlarmInfo(r).cls === 'warn').length;
  statsSummaryContent.innerHTML = `
    <div class="stat-grid" style="grid-template-columns: repeat(6,1fr); margin-bottom:16px;">
      <div class="stat-item"><div class="s-label">Total general</div><div class="s-value">${formatCurrency(totalGeneral)}</div></div>
      <div class="stat-item"><div class="s-label">Pendiente</div><div class="s-value">${formatCurrency(totalPendiente)}</div></div>
      <div class="stat-item"><div class="s-label">Facturado</div><div class="s-value">${formatCurrency(totalFacturado)}</div></div>
      <div class="stat-item"><div class="s-label">Activos</div><div class="s-value">${formatCurrency(totalActivos)}</div></div>
      <div class="stat-item"><div class="s-label">Alertas 60%</div><div class="s-value">${formatNumber(alertas)}</div></div>
      <div class="stat-item"><div class="s-label">Críticas 70%</div><div class="s-value">${formatNumber(criticas)}</div></div>
    </div>
    ${buildStatsTable(getModeLabel(state.stats.mode), rows)}
  `;
}

function openStatsModal() {
  if (!state.rowsByView.sheet1.length) { showInfoDialog('Sin archivo','Carga un archivo primero.'); return; }
  readFiltersFromInputs();
  applyCurrentFilters();
  hydrateOcMonthFilters();
  hydrateStatsSupervisorFilters();
  preserveValidSelection('stats');
  statsModeSelect.value = state.stats.mode;
  statsSearchInput.value = state.stats.search;
  if (statsSupervisorFilter) statsSupervisorFilter.value = state.stats.supervisorFilter || '';
  if (statsOrderBy) statsOrderBy.value = state.stats.orderBy || 'total';
  if (statsIncludeActivos) statsIncludeActivos.checked = state.filters.includeActivos !== false;
  statsModal.style.display = 'block';
  renderSelectionList('stats');
  renderStatsSummary();
}
function closeStatsModal() { statsModal.style.display='none'; }
window.closeStatsModal = closeStatsModal;
