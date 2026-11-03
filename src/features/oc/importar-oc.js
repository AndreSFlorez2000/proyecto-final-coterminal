/* ── FILE UPLOAD ── */
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  showLoading('Leyendo Excel...');
  const reader = new FileReader();
  reader.onload = (event) => {
    setTimeout(() => {
      try {
        const data = new Uint8Array(event.target.result);
        const wb = XLSX.read(data, { type:'array', cellDates:true });
        state.workbook = wb;
        state.rowsByView = { sheet1:[], facturadas:[], pendientes:[], activos:[], liberadas:[] };
        state.cecoStats = { filasConCECO: 0, completadasTienda: 0, completadasSupervisor: 0, noEncontrados: 0, cediAutomaticos: 0 };
        state.searchedRows = { sheet1:[], facturadas:[], pendientes:[], activos:[], liberadas:[] };
        state.selectedView = 'sheet1';
        state.excelDataRows = 0;
        state.stats.selected.clear();
        state.charts.selected.clear();
        state.pagination.page = 1;

        const sheetName = (wb.SheetNames||[]).find(n => normalizeText(n)==='sheet1');
        if (!sheetName) throw new Error('No hay hoja llamada Sheet1.');
        const sheet = wb.Sheets[sheetName];
        let rows = XLSX.utils.sheet_to_json(sheet, { defval:'', raw:true, cellDates:true });
        if (Object.keys(rows[0]||{}).some(k => normalizeText(k).includes('unnamed'))) {
          rows = XLSX.utils.sheet_to_json(sheet, { defval:'', range:2, raw:true, cellDates:true });
        }
        if (!rows.length) throw new Error('La hoja Sheet1 está vacía.');
        validateRequiredColumns(rows);
        state.excelDataRows = rows.length;

        rows.forEach((row, i) => {
          const dc = getDocumentoCompras(row), tb = getTextoBreve(row);
          if (isMeaningful(dc) || isMeaningful(tb)) {
            const norm = normalizeRow(row, i);
            state.rowsByView.sheet1.push(norm);
            if (norm.viewGroup === 'facturadas') state.rowsByView.facturadas.push(norm);
            if (norm.viewGroup === 'pendientes') state.rowsByView.pendientes.push(norm);
            // La vista Activos es independiente: incluye toda OC con Tipo de imputación = A,
            // aunque también esté facturada. Así no se pierden activos facturados.
            if (esActivoOC(norm)) state.rowsByView.activos.push(norm);
            if ((norm.xLiberacion || 0) >= 2) state.rowsByView.liberadas.push(norm);
          }
        });

        hydrateFilterOptions();
        readFiltersFromInputs();
        applyCurrentFilters();
        buildActiveChips();

        fileStatus.innerHTML = `<strong>${escapeHtml(file.name)}</strong><br>${state.rowsByView.sheet1.length.toLocaleString('es-CO')} registros<br><span style="color:var(--muted);">CECO aplicado: ${formatNumber(state.cecoStats.completadasTienda)} tiendas · ${formatNumber(state.cecoStats.completadasSupervisor)} supervisores · ${formatNumber(state.cecoStats.cediAutomaticos || 0)} CEDI automático</span>`;
        updateKPIs();
        renderViewTabs();
        renderTableForCurrentView();
        renderFinancialBar();
          syncOcAnalyticsIfOpen();
        toast('Archivo cargado ✅');
      } catch (err) {
        showInfoDialog('Error al cargar', err.message || 'No se pudo procesar el archivo.');
        tableWrapper.innerHTML = `<div class="empty-state"><span class="icon">⚠️</span>${escapeHtml(err.message)}</div>`;
      } finally {
        hideLoading();
      }
    }, 30);
  };
  reader.onerror = () => { hideLoading(); showInfoDialog('Error de lectura','Ocurrió un error al leer el archivo.'); };
  reader.readAsArrayBuffer(file);
}
