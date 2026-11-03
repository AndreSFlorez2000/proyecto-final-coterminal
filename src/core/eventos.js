/* ── EVENT LISTENERS ── */
setupAllUploadDragAndDrop();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupAllUploadDragAndDrop, { once: true });
}
setupGlobalDragProtection();
$id('excelFile').addEventListener('change', handleFileUpload);
$id('searchBtn').addEventListener('click', runSearch);
$id('clearBtn').addEventListener('click', clearSearch);
$id('copyBtn').addEventListener('click', copiarIncidencias);
$id('exportFilteredBtn').addEventListener('click', exportFilteredData);
$id('showDeletedOnlyBtn')?.addEventListener('click', () => setDeletedMode('deleted'));
$id('openStatsBtn').addEventListener('click', openStatsModal);
$id('openCruceBtn').addEventListener('click', openCruceModal);
$id('openCCUrgVitalBtn')?.addEventListener('click', openCCUrgVitalModal);
$id('openChartsBtn').addEventListener('click', openChartsModal);

// Real-time search on Enter
[incInput,ocInput,cotInput,providerInput,storeInput,supervisorInput,tipoIncidenciaInput,tipoServicioInput,tipoGastoInput].forEach(el => {
  el.addEventListener('keydown', e => { if(e.key==='Enter') runSearch(); });
});

// Stats modal
$id('applyStatsFilterBtn').addEventListener('click', () => {
  state.stats.mode=statsModeSelect.value; state.stats.search=statsSearchInput.value; state.stats.includeActivos=!!statsIncludeActivos?.checked; state.stats.supervisorFilter = statsSupervisorFilter?.value || ''; state.stats.orderBy = statsOrderBy?.value || 'total';
  if ((state.filters.includeActivos !== false) !== state.stats.includeActivos) { toggleActivosGlobal(state.stats.includeActivos); }
  else refreshStatsKeepingSelection();
});
$id('clearStatsFilterBtn').addEventListener('click', () => {
  statsModeSelect.value='proveedor'; statsSearchInput.value=''; if (statsMonthFilter) statsMonthFilter.value=''; if (statsSupervisorFilter) statsSupervisorFilter.value=''; if (statsOrderBy) statsOrderBy.value='total'; if (statsIncludeActivos) statsIncludeActivos.checked=true;
  state.stats.mode='proveedor'; state.stats.search=''; state.stats.includeActivos=true; state.stats.supervisorFilter=''; state.stats.orderBy='total';
  if (state.filters.includeActivos === false) toggleActivosGlobal(true);
  else refreshStatsKeepingSelection();
});
$id('statsTop9Btn').addEventListener('click', () => {
  const items=getFilteredGroupItems(state.stats.mode,state.stats.search,'stats').slice(0,9);
  state.stats.selected=new Set(items.map(i=>i.name));
  renderSelectionList('stats'); renderStatsSummary();
});
$id('statsClearSelectionBtn').addEventListener('click', () => {
  state.stats.selected.clear(); renderSelectionList('stats'); renderStatsSummary();
});
statsSearchInput?.addEventListener('input', () => {
  state.stats.search = statsSearchInput.value || '';
  refreshStatsKeepingSelection();
});
statsModeSelect?.addEventListener('change', () => {
  state.stats.mode = statsModeSelect.value;
  refreshStatsKeepingSelection();
});
statsSupervisorFilter?.addEventListener('change', () => {
  state.stats.supervisorFilter = statsSupervisorFilter.value || '';
  refreshStatsKeepingSelection();
});
statsOrderBy?.addEventListener('change', () => {
  state.stats.orderBy = statsOrderBy.value || 'total';
  refreshStatsKeepingSelection();
});
statsMonthFilter?.addEventListener('change', () => {
  refreshStatsKeepingSelection();
});
statsIncludeActivos?.addEventListener('change', () => {
  state.stats.includeActivos = !!statsIncludeActivos.checked;
  toggleActivosGlobal(state.stats.includeActivos);
});

// Charts modal
$id('applyChartsFilterBtn').addEventListener('click', () => {
  state.charts.mode=chartsModeSelect.value; state.charts.search=chartsSearchInput.value; state.charts.includeActivos=!!chartsIncludeActivos?.checked; state.charts.supervisorFilter = chartsSupervisorFilter?.value || ''; state.charts.orderBy = chartsOrderBy?.value || 'total';
  if ((state.filters.includeActivos !== false) !== state.charts.includeActivos) { toggleActivosGlobal(state.charts.includeActivos); }
  else refreshChartsKeepingSelection();
});
$id('clearChartsFilterBtn').addEventListener('click', () => {
  chartsModeSelect.value='proveedor'; chartsSearchInput.value=''; if (chartsMonthFilter) chartsMonthFilter.value=''; if (chartsSupervisorFilter) chartsSupervisorFilter.value=''; if (chartsOrderBy) chartsOrderBy.value='total'; if (chartsIncludeActivos) chartsIncludeActivos.checked=true;
  state.charts.mode='proveedor'; state.charts.search=''; state.charts.includeActivos=true; state.charts.supervisorFilter=''; state.charts.orderBy='total'; state.charts.selected.clear();
  refreshChartsKeepingSelection();
});
$id('chartsTop9Btn').addEventListener('click', () => {
  const items=getFilteredGroupItems(state.charts.mode,state.charts.search,'charts').slice(0,9);
  state.charts.selected=new Set(items.map(i=>i.name));
  renderSelectionList('charts'); renderChartsModal(); saveChartsUiState();
});
$id('chartsClearSelectionBtn').addEventListener('click', () => {
  state.charts.selected.clear(); renderSelectionList('charts'); renderChartsModal(); saveChartsUiState();
});
chartsSearchInput?.addEventListener('input', () => {
  state.charts.search = chartsSearchInput.value || '';
  refreshChartsKeepingSelection();
});
chartsModeSelect?.addEventListener('change', () => {
  state.charts.mode = chartsModeSelect.value;
  refreshChartsKeepingSelection();
});
chartsSupervisorFilter?.addEventListener('change', () => {
  state.charts.supervisorFilter = chartsSupervisorFilter.value || '';
  refreshChartsKeepingSelection();
});
chartsOrderBy?.addEventListener('change', () => {
  state.charts.orderBy = chartsOrderBy.value || 'total';
  refreshChartsKeepingSelection();
});
chartsMonthFilter?.addEventListener('change', () => {
  refreshChartsKeepingSelection();
});
chartsIncludeActivos?.addEventListener('change', () => {
  state.charts.includeActivos = !!chartsIncludeActivos.checked;
  toggleActivosGlobal(state.charts.includeActivos);
});
$id('exportCurrentChartBtn').addEventListener('click', () => {
  exportChartData(getSelectedOrTopItems('charts'),`Comparativo_${getModeLabel(state.charts.mode).replace(/\s/g,'_')}.xlsx`);
});
$id('exportAllChartsBtn').addEventListener('click', () => {
  exportChartData(getFilteredGroupItems(state.charts.mode,state.charts.search,'charts'),`Comparativo_completo_${getModeLabel(state.charts.mode).replace(/\s/g,'_')}.xlsx`);
});



// Cruce modal
$id('excelFileCruce').addEventListener('change', (e)=>{ handleCruceFileUpload(e); setTimeout(refreshCicloCortoIfOpen, 600); setTimeout(refreshCicloCortoIfOpen, 1400); setTimeout(refreshCCUrgVitalIfOpen, 600); setTimeout(refreshCCUrgVitalIfOpen, 1400); });
$id('runCruceBtn').addEventListener('click', runCruce);
$id('copyCruceIncBtn').addEventListener('click', copiarIncidenciasCruce);
$id('clearCruceFiltersBtn').addEventListener('click', clearCruceFilters);
$id('exportCruceBtn').addEventListener('click', () => exportCruceData('completo'));
$id('exportCruceResumenBtn').addEventListener('click', () => exportCruceData('resumen'));
if ($id('openCruceStatsBtn')) $id('openCruceStatsBtn').addEventListener('click', openCruceStatsModal);

function setD1goVitalMode(mode, shouldRender=true) {
  const remove = $id('d1goRemoveVitales');
  const only = $id('d1goOnlyVitales');
  if (mode === 'solo') { if(remove) remove.checked=false; if(only) only.checked=true; }
  else if (mode === 'sin') { if(remove) remove.checked=true; if(only) only.checked=false; }
  else { if(remove) remove.checked=false; if(only) only.checked=false; mode='all'; }
  document.querySelectorAll('#d1goVitalModeGroup .d1go-seg-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.vitalMode === mode));
  if (shouldRender) renderD1goStatsModal();
}
function syncD1goVitalModeFromChecks() {
  const mode = $id('d1goOnlyVitales')?.checked ? 'solo' : ($id('d1goRemoveVitales')?.checked ? 'sin' : 'all');
  document.querySelectorAll('#d1goVitalModeGroup .d1go-seg-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.vitalMode === mode));
}

if ($id('openD1goStatsBtn')) $id('openD1goStatsBtn').addEventListener('click', openD1goStatsModal);
[cruceEstadoFilter,cruceEstadoOcFilter,cruceSupervisorFilter,cruceFechaTipo,cruceSoloCriticos,cruceSoloCritFact,cruceSoloLiberadas2XAbiertas].filter(Boolean).forEach(el => el.addEventListener('change', renderCruceFilteredResults));
[cruceSearchInput,cruceIncidenciaFilter,cruceFechaDesde,cruceFechaHasta].filter(Boolean).forEach(el => el.addEventListener('input', renderCruceFilteredResults));

// D1GO
$id('applyD1goStatsBtn').addEventListener('click', renderD1goStatsModal);
$id('clearD1goStatsBtn').addEventListener('click', clearD1goStatsFilters);
exportD1goFilteredBtn?.addEventListener('click', exportD1goFilteredData);

[d1goEstadoFilter,d1goSupervisorFilter,d1goTiendaFilter,d1goFechaFilter,d1goMesFilter,d1goCycleFilter,$id('d1goYearFilter')].filter(Boolean).forEach(el=>el.addEventListener('change',renderD1goStatsModal));
$id('d1goResumenEstados')?.addEventListener('change',()=>{ hydrateD1goStatsOptions(); renderD1goStatsModal(); });
$id('d1goIncludePreventivos')?.addEventListener('change',()=>{ hydrateD1goStatsOptions(); hydrateD1goMonthOptions(); hydrateD1goYearOptions(); renderD1goStatsModal(); });
document.querySelectorAll('#d1goVitalModeGroup .d1go-seg-btn').forEach(btn=>btn.addEventListener('click',()=>setD1goVitalMode(btn.dataset.vitalMode || 'all')));
setD1goVitalMode('all', false);
// Ciclo corto: actualización automática, sin botones de actualizar ni fechas sugeridas.
exportCicloCortoBtn?.addEventListener('click',exportCicloCortoExcel);
copyCicloCortoBtn?.addEventListener('click',copyCicloCortoTable);
[cycleDateType,cycleSupervisorFilter,cycleEstadoFilter,cycleUniqueIds].filter(Boolean).forEach(el=>{
  el.addEventListener('change',autoRefreshCicloCortoDates);
  el.addEventListener('input',autoRefreshCicloCortoDates);
});
// Las fechas del ciclo corto se aplican automáticamente.
function autoRefreshCicloCortoDates() {
  window._cycleManualDaysTouched = false;
  window._cycleSelectedDays = new Set();
  const box = document.getElementById('cycleDaysList');
  if (box) box.innerHTML = '';
  renderCicloCortoModal();
}
[cycleCurrStart,cycleCurrEnd].filter(Boolean).forEach(el=>{
  el.addEventListener('change',autoRefreshCicloCortoDates);
  el.addEventListener('input',autoRefreshCicloCortoDates);
});
[cycleDateType, cycleSupervisorFilter, cycleEstadoFilter, cycleUniqueIds, cycleRemoveVitales, cycleResumenEstados].filter(Boolean).forEach(el => {
  el.addEventListener('change', () => {
    window._cycleManualDaysTouched = false;
    window._cycleSelectedDays = new Set();
    const box = document.getElementById('cycleDaysList');
    if (box) box.innerHTML = '';
    if (el === cycleResumenEstados) hydrateCycleFilters();
    renderCicloCortoModal();
  });
});
cycleSearchInput?.addEventListener('input',renderCicloCortoModal);
$id('cycleSelectAllDaysBtn')?.addEventListener('click',()=>setCycleDaysChecked('all'));
$id('cycleClearDaysBtn')?.addEventListener('click',clearAllCycleSelections);

$id('openCCUrgVitalBtnBanner')?.addEventListener('click',openCCUrgVitalModal);
$id('applyCCUrgVitalBtn')?.addEventListener('click',()=>{ hydrateCCUrgVitalFilters(); renderCCUrgVitalModal(); });
$id('resetCCUrgVitalBtn')?.addEventListener('click',()=>{setSuggestedCCUrgVitalDates(); window._ccurgVitalManualDaysTouched = false; window._ccurgVitalSelectedDays = new Set(); const els=getCCUrgVitalElements(); if(els.daysList) els.daysList.innerHTML=''; renderCCUrgVitalModal();});
$id('copyCCUrgVitalBtn')?.addEventListener('click',copyCCUrgVitalTable);
$id('exportCCUrgVitalBtn')?.addEventListener('click',exportCCUrgVitalExcel);
[$id('ccurgStart'),$id('ccurgEnd'),$id('ccurgGroupMode'),$id('ccurgRowLimit'),$id('ccurgTipoFilter'),$id('ccurgSupervisorFilter'),$id('ccurgEstadoFilter'),$id('ccurgResumenEstados')].filter(Boolean).forEach(el=>{
  const autoRefreshCCUrg = () => {
    if (el?.id === 'ccurgResumenEstados') hydrateCCUrgVitalFilters();
    renderCCUrgVitalModal();
  };
  el.addEventListener('change', autoRefreshCCUrg);
  el.addEventListener('input', autoRefreshCCUrg);
});
$id('ccurgSelectAllDaysBtn')?.addEventListener('click',()=>setCCUrgVitalDaysChecked('all'));
$id('ccurgClearDaysBtn')?.addEventListener('click',()=>setCCUrgVitalDaysChecked('none'));
$id('ccurgSearchInput')?.addEventListener('input',renderCCUrgVitalModal);

d1goSearchInput?.addEventListener('input', renderD1goStatsModal);

// Close modals on overlay click
[cruceModal,cruceStatsModal,d1goStatsModal,cicloCortoModal,$id('ccurgVitalModal'),statsModal,chartsModal].filter(Boolean).forEach(modal => {
  modal.addEventListener('click', e => { if(e.target===modal) { modal.style.display='none'; destroyCharts(); destroyD1goCharts(); } });
});

dialogOverlay.addEventListener('click', e => { if(e.target===dialogOverlay) hideDialog(); });