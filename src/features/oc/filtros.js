/* ── FILTER OPTIONS ── */
function buildUniqueList(rows, key) {
  return [...new Set((rows||[]).map(r => String(r[key]||'').trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b,'es'));
}

function fillDataList(el, values) {
  el.innerHTML = values.map(v => `<option value="${escapeHtml(v)}"></option>`).join('');
}

function hydrateFilterOptions() {
  const base = state.rowsByView.sheet1 || [];
  fillDataList(providerOptions, buildUniqueList(base,'proveedor'));
  fillDataList(storeOptions, buildUniqueList(base,'tienda'));
  fillDataList(supervisorOptions, buildUniqueList(base,'supervisor'));
  fillDataList(tipoIncidenciaOptions, buildUniqueList(base,'tipoIncidencia'));
  fillDataList(tipoServicioOptions, buildUniqueList(base,'tipoServicio'));
  fillDataList(tipoGastoOptions, buildUniqueList(base,'tipoGasto'));
  fillDataList(cotOptions, buildUniqueList(base,'cotizacion'));
}

function readFiltersFromInputs() {
  state.filters = {
    incidencias: parseIncidencias(incInput.value),
    oc: onlyDigits(ocInput.value),
    cotizacion: String(cotInput.value||'').trim(),
    proveedor: String(providerInput.value||'').trim(),
    tienda: String(storeInput.value||'').trim(),
    supervisor: String(supervisorInput.value||'').trim(),
    tipoIncidencia: String(tipoIncidenciaInput.value||'').trim(),
    tipoServicio: String(tipoServicioInput.value||'').trim(),
    tipoGasto: String(tipoGastoInput.value||'').trim(),
    deletedMode: state.filters.deletedMode || 'all',
    onlyLiberadas2x: !!state.filters.onlyLiberadas2x,
    includeActivos: state.filters.includeActivos !== false
  };
}

function filterRows(rows, filters) {
  return (rows||[]).filter(row => {
    const matchInc = !filters.incidencias.length || filters.incidencias.includes(row.incidencia);
    const matchOc = !filters.oc || row.ocDigits===filters.oc || row.ocDigits.includes(filters.oc) || filters.oc.includes(row.ocDigits);
    const matchCot = !filters.cotizacion || normalizeText(row.cotizacion).includes(normalizeText(filters.cotizacion));
    const matchProv = !filters.proveedor || normalizeText(row.proveedor).includes(normalizeText(filters.proveedor));
    const matchTienda = !filters.tienda || normalizeText(row.tienda).includes(normalizeText(filters.tienda));
    const matchSup = !filters.supervisor || normalizeText(row.supervisor).includes(normalizeText(filters.supervisor));
    const matchTipoInc = !filters.tipoIncidencia || normalizeText(row.tipoIncidencia).includes(normalizeText(filters.tipoIncidencia));
    const matchTipoServ = !filters.tipoServicio || normalizeText(row.tipoServicio).includes(normalizeText(filters.tipoServicio));
    const matchTipoGasto = !filters.tipoGasto || normalizeText(row.tipoGasto).includes(normalizeText(filters.tipoGasto));
    const matchDeleted = (filters.deletedMode || 'all') === 'all' || ((filters.deletedMode === 'deleted') ? row.isDeleted : !row.isDeleted);
    const matchLiberada2x = !filters.onlyLiberadas2x || ((row.xLiberacion || 0) >= 2);
    const matchActivos = filters.includeActivos !== false || !esActivoOC(row);
    return matchInc && matchOc && matchCot && matchProv && matchTienda && matchSup && matchTipoInc && matchTipoServ && matchTipoGasto && matchDeleted && matchLiberada2x && matchActivos;
  });
}

function applyCurrentFilters() {
  VIEW_KEYS.forEach(v => {
    state.searchedRows[v.key] = filterRows(state.rowsByView[v.key]||[], state.filters);
  });
}

function hasActiveMainFilters() {
  const f = state.filters || {};
  return !!(
    (f.incidencias && f.incidencias.length) || f.oc || f.cotizacion || f.proveedor ||
    f.tienda || f.supervisor || f.tipoIncidencia || f.tipoServicio || f.tipoGasto || (f.deletedMode && f.deletedMode !== 'all') || f.onlyLiberadas2x
  );
}

function countFilteredRowsAllViews() {
  return VIEW_KEYS.reduce((acc, v) => acc + ((state.searchedRows[v.key] || []).length), 0);
}

function validateSearchCombination() {
  const f = state.filters || {};
  if ((f.incidencias || []).length && f.oc) {
    showInfoDialog(
      'Búsqueda combinada detectada',
      'Estás buscando por incidencia y por OC al mismo tiempo. Esto puede dejar resultados en cero si la OC no corresponde exactamente a esa incidencia. Recomendación: busca primero por incidencia o primero por OC, pero no ambos a la vez.'
    );
    return false;
  }
  return true;
}

function notifyEmptySearchIfNeeded() {
  if (!hasActiveMainFilters()) return;
  const total = countFilteredRowsAllViews();
  if (total === 0) {
    toast('Sin resultados para los filtros aplicados', 'error', 3500);
    showInfoDialog(
      'Sin resultados',
      'No se encontraron registros con los filtros actuales. Revisa si mezclaste OC con incidencia, si la cotización está escrita igual que en el archivo o si el proveedor/tienda/supervisor tiene una variación en el nombre.'
    );
  }
}

/* ── ACTIVE CHIPS ── */
function buildActiveChips() {
  const f = state.filters;
  const chips = [];
  if (f.incidencias.length) chips.push(['inc', `Inc: ${f.incidencias.length}`, () => { incInput.value=''; removeFilter('inc'); }]);
  if (f.oc) chips.push(['oc', `OC: ${f.oc}`, () => { ocInput.value=''; removeFilter('oc'); }]);
  if (f.cotizacion) chips.push(['cot', `Cot: ${f.cotizacion}`, () => { cotInput.value=''; removeFilter('cot'); }]);
  if (f.proveedor) chips.push(['prov', `Prov: ${f.proveedor}`, () => { providerInput.value=''; removeFilter('prov'); }]);
  if (f.tienda) chips.push(['tienda', `Tienda: ${f.tienda}`, () => { storeInput.value=''; removeFilter('tienda'); }]);
  if (f.supervisor) chips.push(['sup', `Sup: ${f.supervisor}`, () => { supervisorInput.value=''; removeFilter('sup'); }]);
  if (f.tipoIncidencia) chips.push(['ti', `TInc: ${f.tipoIncidencia}`, () => { tipoIncidenciaInput.value=''; removeFilter('ti'); }]);
  if (f.tipoServicio) chips.push(['ts', `TServ: ${f.tipoServicio}`, () => { tipoServicioInput.value=''; removeFilter('ts'); }]);
  if (f.tipoGasto) chips.push(['tg', `TGasto: ${f.tipoGasto}`, () => { tipoGastoInput.value=''; removeFilter('tg'); }]);
  if (f.deletedMode === 'deleted') chips.push(['delmode', 'Solo eliminadas L', () => { setDeletedMode('all'); }]);
  if (f.deletedMode === 'active') chips.push(['delmode', 'Sin eliminadas L', () => { setDeletedMode('all'); }]);
  if (f.onlyLiberadas2x) chips.push(['lib2x', 'Solo liberadas 2X', () => { setOnlyLiberadas2X(false); }]);

  if (!chips.length) {
    activeChips.innerHTML = `<span style="font-size:11px; color:var(--muted); font-family:var(--font-mono);">Sin filtros</span>`;
    return;
  }
  activeChips.innerHTML = chips.map(([key, label]) =>
    `<span class="filter-chip" data-key="${key}">${escapeHtml(label)}<span class="rm" data-key="${key}">✕</span></span>`
  ).join('');

  activeChips.querySelectorAll('.rm').forEach(btn => {
    btn.addEventListener('click', () => {
      const k = btn.getAttribute('data-key');
      const chip = chips.find(c => c[0] === k);
      if (chip) chip[2]();
    });
  });
}

function removeFilter(key) {
  const map = { inc:'incidencias', oc:'oc', cot:'cotizacion', prov:'proveedor', tienda:'tienda', sup:'supervisor', ti:'tipoIncidencia', ts:'tipoServicio', tg:'tipoGasto' };
  const fk = map[key];
  if (!fk) return;
  if (fk === 'incidencias') state.filters.incidencias = [];
  else state.filters[fk] = '';
  applyCurrentFilters();
  buildActiveChips();
  state.pagination.page = 1;
  updateKPIs();
  renderViewTabs();
  renderTableForCurrentView();
  renderFinancialBar();
}
