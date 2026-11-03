/* ── SEARCH ── */

function setDeletedMode(mode) {
  state.filters.deletedMode = mode || 'all';
  readFiltersFromInputs();
  state.filters.deletedMode = mode || 'all';
  applyCurrentFilters();
  buildActiveChips();
  state.pagination.page = 1;
  updateKPIs();
  renderViewTabs();
  renderTableForCurrentView();
  renderFinancialBar();
  syncOcAnalyticsIfOpen();
  const msg = mode === 'deleted' ? 'Visual: solo eliminadas L 🟡' : mode === 'active' ? 'Visual: eliminadas ocultas' : 'Visual: activos + eliminadas';
  toast(msg, 'info', 1600);
}
window.setDeletedMode = setDeletedMode;

function toggleDeletedRowsFromBar(checked) {
  // Checked: muestra activos + eliminadas. Unchecked: oculta eliminadas L de visual, estadísticas y exportado filtrado.
  setDeletedMode(checked ? 'all' : 'active');
}
window.toggleDeletedRowsFromBar = toggleDeletedRowsFromBar;

function toggleActivosGlobal(checked) {
  // Checked: incluye activos. Unchecked: excluye Tipo de imputación A en vista principal, totales, estadísticas y gráficos.
  state.filters.includeActivos = !!checked;
  state.stats.includeActivos = !!checked;
  state.charts.includeActivos = !!checked;
  readFiltersFromInputs();
  state.filters.includeActivos = !!checked;
  applyCurrentFilters();
  buildActiveChips();
  state.pagination.page = 1;
  updateKPIs();
  renderViewTabs();
  renderTableForCurrentView();
  renderFinancialBar();
  if (statsIncludeActivos) statsIncludeActivos.checked = !!checked;
  if (chartsIncludeActivos) chartsIncludeActivos.checked = !!checked;
  syncOcAnalyticsIfOpen();
  toast(checked ? 'Activos incluidos en vista y estadísticas ✅' : 'Activos excluidos de vista y estadísticas', 'info', 1600);
}
window.toggleActivosGlobal = toggleActivosGlobal;

function setOnlyLiberadas2X(checked) {
  state.filters.onlyLiberadas2x = !!checked;
  readFiltersFromInputs();
  state.filters.onlyLiberadas2x = !!checked;
  applyCurrentFilters();
  buildActiveChips();
  state.pagination.page = 1;
  updateKPIs();
  renderViewTabs();
  renderTableForCurrentView();
  renderFinancialBar();
  syncOcAnalyticsIfOpen();
  toast(checked ? 'Visual: solo liberadas 2X ✅' : 'Visual: liberadas 2X sin filtro', 'info', 1600);
}
window.setOnlyLiberadas2X = setOnlyLiberadas2X;

function runSearch() {
  if (!state.rowsByView.sheet1.length) {
    showInfoDialog('Sin archivo','Primero carga un archivo con la hoja Sheet1.');
    return;
  }
  readFiltersFromInputs();
  if (!validateSearchCombination()) return;
  applyCurrentFilters();
  buildActiveChips();
  state.pagination.page = 1;
  updateKPIs();
  renderViewTabs();
  renderTableForCurrentView();
  renderFinancialBar();
  syncOcAnalyticsIfOpen();
  notifyEmptySearchIfNeeded();
}

function clearSearch() {
  incInput.value=''; ocInput.value=''; cotInput.value='';
  providerInput.value=''; storeInput.value=''; supervisorInput.value='';
  tipoIncidenciaInput.value=''; tipoServicioInput.value=''; tipoGastoInput.value='';
  state.filters = { incidencias:[], oc:'', cotizacion:'', proveedor:'', tienda:'', supervisor:'', tipoIncidencia:'', tipoServicio:'', tipoGasto:'', deletedMode:'all', onlyLiberadas2x:false, includeActivos:true };
  if (state.rowsByView.sheet1.length) {
    applyCurrentFilters();
    buildActiveChips();
    state.pagination.page = 1;
    updateKPIs();
    renderViewTabs();
    renderTableForCurrentView();
    renderFinancialBar();
    syncOcAnalyticsIfOpen();
  } else {
    activeChips.innerHTML = `<span style="font-size:11px; color:var(--muted); font-family:var(--font-mono);">Sin filtros</span>`;
  }
}

/* ── COPY / EXPORT ── */
function copiarIncidencias() {
  const rows = state.searchedRows[state.selectedView]||[];
  if (!rows.length) { showInfoDialog('Sin datos','No hay incidencias para copiar.'); return; }
  const lista = [...new Set(rows.map(r=>r.incidencia).filter(Boolean))].join(', ');
  if (!lista) { showInfoDialog('Sin incidencias','No se detectaron incidencias válidas.'); return; }
  navigator.clipboard.writeText(lista)
    .then(() => toast('Incidencias copiadas ✅'))
    .catch(() => showInfoDialog('Error','No se pudo copiar.'));
}

function exportFilteredData() {
  if (!state.rowsByView.sheet1.length) { showInfoDialog('Sin archivo','Carga un archivo primero.'); return; }
  showConfirmDialog('Exportar filtrado','¿Exportar las filas actuales?', () => {
    if (state.exportBusy) return;
    state.exportBusy = true;
    try {
      const rows = state.searchedRows[state.selectedView]||[];
      if (!rows.length) { showInfoDialog('Sin datos','No hay filas para exportar.'); return; }
      const exportRows = rows.map(r => ({
        OC: r.oc||'', Incidencia: r.incidencia||'', Fecha: formatDateValue(r.fechaDocumento),
        Proveedor: r.proveedor||'', Tienda: r.tienda||'', Supervisor: r.supervisor||'', Gerente: r.gerente||r.directorioGerente||'', JefeZona: r.directorioJefeZona||'', OrigenDatos: r.origenDirectorio||'Archivo original',
        Cotizacion: r.cotizacion||'', TipoIncidencia: r.tipoIncidencia||'',
        TipoServicio: r.tipoServicio||'', TipoGasto: r.tipoGasto||'',
        X_Liberacion: r.xLiberacion??0, EstadoRegistro: r.estadoRegistro||'',
        PorCalcular: r.rawPorCalcular||0, PorEntregarValor: r.rawPorEntregarValor||0,
        PorEntregarCantidad: r.rawPorEntregarCantidad||0, TipoImputacion: r.tipoImputacion||'',
        CentroCoste: r.centroCoste||'', Valor: r.rawPrecioNeto||0,
        TextoBreve: r.textoBreve||'', LiberacionCruda: r.liberacion||''
      }));
      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb2 = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb2, ws, 'Filtrado');
      const vl = VIEW_KEYS.find(v=>v.key===state.selectedView)?.label||'Vista';
      XLSX.writeFile(wb2, `Control_OC_${vl.replace(/\s+/g,'_')}_filtrado.xlsx`);
      toast('Exportado ✅');
    } catch(err) {
      showInfoDialog('Error','No se pudo exportar.');
    } finally {
      state.exportBusy = false;
    }
  });
}


function syncOcAnalyticsIfOpen() {
  try {
    if (statsModal && statsModal.style.display === 'block') {
      renderSelectionList('stats');
      renderStatsSummary();
    }
    if (chartsModal && chartsModal.style.display === 'block') {
      preserveValidSelection('charts');
      renderSelectionList('charts');
      renderChartsModal();
      saveChartsUiState();
    }
  } catch (e) {}
}
