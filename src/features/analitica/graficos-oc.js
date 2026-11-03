/* ── CHARTS ── */
function destroyCharts() {
  if (mainChartInstance) { mainChartInstance.destroy(); mainChartInstance=null; }
  if (allChartInstance) { allChartInstance.destroy(); allChartInstance=null; }
}


function getChartThemeColors(){
  const isLight = document.body.classList.contains('light');
  return {
    text: isLight ? '#111827' : '#f0eeff',
    muted: isLight ? '#111827' : '#9090b0',
    grid: isLight ? 'rgba(17,24,39,0.12)' : 'rgba(255,255,255,0.05)'
  };
}

function renderChartsModal() {
  const items = getSelectedOrTopItems('charts');
  destroyCharts();
  chartTitle.textContent = `📈 Comparativo por ${getModeLabel(state.charts.mode)}`;
  renderChartExecutiveSummary(items);
  const canvas = $id('mainChart');
  if (!canvas || !items.length) {
    const box = $id('chartsSummaryContent');
    if (box) box.innerHTML = '<div class="empty-state"><span class="icon">📉</span>No hay datos para graficar con los filtros actuales.</div>';
    return;
  }
  const theme = getChartThemeColors();
  const opts = {
    responsive:true, maintainAspectRatio:false,
    plugins:{
      legend:{labels:{color:theme.text,font:{family:"'JetBrains Mono', monospace",size:11,weight:'700'}}},
      datalabels:{anchor:'end',align:'top',color:theme.text,font:{weight:'700',size:11},formatter:v=>formatNumber(v)}
    },
    scales:{
      x:{ticks:{color:theme.text,font:{family:"'JetBrains Mono', monospace",size:10,weight:'700'}},grid:{color:theme.grid}},
      y:{beginAtZero:true,ticks:{color:theme.text,font:{family:"'JetBrains Mono', monospace",size:10,weight:'700'}},grid:{color:theme.grid}}
    }
  };
  mainChartInstance = new Chart(canvas, {
    type:'bar',
    data:{
      labels:items.map(i=>i.name),
      datasets:[
        {label:'Total',data:items.map(i=>i.total),backgroundColor:'rgba(255,59,59,0.65)',borderColor:'rgba(255,59,59,1)',borderWidth:1.5},
        {label:'Pendiente',data:items.map(i=>i.pendiente),backgroundColor:'rgba(96,165,250,0.55)',borderColor:'rgba(96,165,250,1)',borderWidth:1.5},
        {label:'Facturado',data:items.map(i=>i.facturado),backgroundColor:'rgba(34,197,94,0.55)',borderColor:'rgba(34,197,94,1)',borderWidth:1.5}
      ]
    },
    options:{...opts}
  });

  const allCanvas = $id('allChartCanvas');
  if (allCanvas) {
    const allItems = getFilteredGroupItems(state.charts.mode, state.charts.search, 'charts').slice(0,20);
    allChartInstance = new Chart(allCanvas, {
      type:'bar',
      data:{
        labels:allItems.map(i=>i.name),
        datasets:[{label:'Total (top 20)',data:allItems.map(i=>i.total),backgroundColor:'rgba(255,59,59,0.5)',borderColor:'rgba(255,59,59,0.9)',borderWidth:1}]
      },
      options:{...opts, plugins:{...opts.plugins, datalabels:{display:false}}}
    });
  }
}

function openChartsModal() {
  if (!state.rowsByView.sheet1.length) { showInfoDialog('Sin archivo','Carga un archivo primero.'); return; }
  readFiltersFromInputs();
  applyCurrentFilters();
  hydrateOcMonthFilters();
  hydrateStatsSupervisorFilters();
  loadChartsUiState();
  preserveValidSelection('charts');
  chartsModeSelect.value = state.charts.mode;
  chartsSearchInput.value = state.charts.search;
  if (chartsSupervisorFilter) chartsSupervisorFilter.value = state.charts.supervisorFilter || '';
  if (chartsOrderBy) chartsOrderBy.value = state.charts.orderBy || 'total';
  if (chartsIncludeActivos) chartsIncludeActivos.checked = !!state.charts.includeActivos;
  chartsModal.style.display='block';
  renderSelectionList('charts');
  renderChartsModal();
  saveChartsUiState();
}
function closeChartsModal() { chartsModal.style.display='none'; destroyCharts(); }
window.closeChartsModal = closeChartsModal;

function exportChartData(items, filename) {
  if (!items.length) { showInfoDialog('Sin datos','No hay elementos para exportar.'); return; }
  const ws = XLSX.utils.json_to_sheet(items.map(i=>({Nombre:i.name, Cantidad:i.cantidad, Total:i.total, Pendiente:i.pendiente, Facturado:i.facturado, Activos:i.activos, X_Liberacion:i.x})));
  const wb2 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb2, ws, 'Comparativo');
  XLSX.writeFile(wb2, filename);
  toast('Exportado ✅');
}
