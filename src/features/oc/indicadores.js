/* ── KPIs ── */
function updateKPIs() {
  const base = state.rowsByView.sheet1.length;
  const filtered = (state.searchedRows[state.selectedView]||[]).length;
  const xLib = (state.searchedRows[state.selectedView]||[]).reduce((s,r) => s+r.xLiberacion, 0);
  const del = (state.searchedRows[state.selectedView]||[]).filter(r=>r.isDeleted).length;
  const viewLabel = VIEW_KEYS.find(v=>v.key===state.selectedView)?.label||'—';

  excelRows.textContent = state.excelDataRows.toLocaleString('es-CO');
  totalRows.textContent = base.toLocaleString('es-CO');
  resultCount.textContent = filtered.toLocaleString('es-CO');
  sheetCount.textContent = viewLabel;
  xCount.textContent = xLib.toLocaleString('es-CO');
  deletedCount.textContent = del.toLocaleString('es-CO');

  kpiExcel.textContent = state.excelDataRows.toLocaleString('es-CO');
  kpiBase.textContent = base.toLocaleString('es-CO');
  kpiFiltered.textContent = filtered.toLocaleString('es-CO');
  kpiX.textContent = xLib.toLocaleString('es-CO');
  kpiDeleted.textContent = del.toLocaleString('es-CO');
  kpiView.textContent = viewLabel;
}

/* ── FINANCIAL BAR ── */
function esActivoOC(row) {
  // Activo se define SOLO por Tipo de imputación = A.
  // No depende de si está facturada o pendiente, para que la vista Activos no pierda filas.
  return normalizeText(row?.tipoImputacion) === 'a';
}

function esFacturadaOC(row) {
  // Facturado según el Excel de control: Por entregar valor = 0 y Por entregar cantidad = 0.
  return Number(row?.rawPorEntregarValor || 0) === 0 && Number(row?.rawPorEntregarCantidad || 0) === 0;
}

function calcularTotalesBarraPrincipal(rows) {
  // IMPORTANTE:
  // rows ya llega con o sin borrados según el botón "Mostrar eliminadas L".
  // Aquí NO se filtra isDeleted, porque si se filtra aquí el botón deja de cuadrar.
  const base = rows || [];

  const facturado = base
    .filter(r => esFacturadaOC(r))
    .reduce((s,r) => s + Number(r.rawPrecioNeto || 0), 0);

  const pendiente = base
    .reduce((s,r) => s + Number(r.rawPorEntregarValor || 0), 0);

  const activos = base
    .filter(r => esActivoOC(r))
    .reduce((s,r) => s + Number(r.rawPrecioNeto || 0), 0);

  // Total general debe cuadrar como Excel: facturado + pendiente.
  // En el archivo actual con eliminadas incluidas da 4.066.267.757.
  const generadas = facturado + pendiente;

  return { generadas, facturado, pendiente, activos };
}

function renderFinancialBar() {
  const rows = state.searchedRows.sheet1 || [];
  const t = calcularTotalesBarraPrincipal(rows);
  finFacturado.textContent = formatCurrency(t.facturado);
  finPendiente.textContent = formatCurrency(t.pendiente);
  finActivos.textContent = formatCurrency(t.activos);
  finRegistros.textContent = formatCurrency(t.generadas);
}
