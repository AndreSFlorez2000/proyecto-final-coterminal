/* ── VIEW TABS ── */
function renderViewTabs() {
  const tabsHtml = VIEW_KEYS.map(item => {
    const count = (state.searchedRows[item.key]||[]).length;
    const hasRows = (state.rowsByView[item.key]||[]).length > 0;
    const cls = ['view-tab', state.selectedView===item.key?'active':'', !hasRows?'empty':''].filter(Boolean).join(' ');
    return `<button class="${cls}" onclick="selectView('${item.key}')">${escapeHtml(item.label)} <span style="opacity:.7;font-size:11px;">(${count})</span></button>`;
  }).join('');

  const showDeletedChecked = state.filters.deletedMode !== 'active' ? 'checked' : '';
  const onlyLiberadasChecked = state.filters.onlyLiberadas2x ? 'checked' : '';
  const includeActivosChecked = state.filters.includeActivos !== false ? 'checked' : '';
  const controlsHtml = `
    <div class="view-tab-controls">
      <label class="inline-check yellow-check" title="Cuando está marcado, las eliminadas L siguen visibles y salen en el exportado. Si lo desmarcas, se ocultan de la visual y del exportado filtrado.">
        <input type="checkbox" id="toggleDeletedRowsCheck" ${showDeletedChecked} onchange="toggleDeletedRowsFromBar(this.checked)">
        Mostrar eliminadas L
      </label>
      <label class="inline-check green-check" title="Cuando está marcado, incluye las OC con Tipo de imputación A. Si lo desmarcas, las quita de la vista principal, totales, estadísticas y gráficos.">
        <input type="checkbox" id="toggleActivosCheck" ${includeActivosChecked} onchange="toggleActivosGlobal(this.checked)">
        Incluir activos
      </label>
      <label class="inline-check green-check" title="Filtra únicamente las filas con dos o más X de liberación.">
        <input type="checkbox" id="toggleLiberadas2XCheck" ${onlyLiberadasChecked} onchange="setOnlyLiberadas2X(this.checked)">
        Solo liberadas 2X
      </label>
    </div>`;

  viewTabs.innerHTML = tabsHtml + controlsHtml;
}

function selectView(viewKey) {
  state.selectedView = viewKey;
  state.pagination.page = 1;
  state.pagination.sortCol = null;
  renderViewTabs();
  toast(`Vista OC: ${VIEW_KEYS.find(v => v.key === viewKey)?.label || viewKey} 👁️`, 'info', 1200);
  updateKPIs();
  renderTableForCurrentView();
  renderFinancialBar();
  syncOcAnalyticsIfOpen();
}
window.selectView = selectView;

/* ── TABLE RENDER WITH PAGINATION & SORT ── */
function renderTableForCurrentView() {
  let rows = [...(state.searchedRows[state.selectedView]||[])];
  if (!rows.length) {
    tableWrapper.innerHTML = `<div class="empty-state"><span class="icon">🔍</span>No hay resultados para este filtro en la vista actual.</div>`;
    return;
  }

  // Sort
  const sc = state.pagination.sortCol;
  if (sc) {
    const dir = state.pagination.sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let av = a[sc] ?? '', bv = b[sc] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), 'es') * dir;
    });
  } else {
    rows.sort((a,b) => b.rawPrecioNeto - a.rawPrecioNeto);
  }

  // Pagination
  const ps = state.pagination.pageSize;
  const totalPages = Math.max(1, Math.ceil(rows.length / ps));
  if (state.pagination.page > totalPages) state.pagination.page = totalPages;
  const start = (state.pagination.page - 1) * ps;
  const pageRows = rows.slice(start, start + ps);

  const cols = [
    { key: 'oc', label: 'OC' },
    { key: 'incidencia', label: 'Incidencia' },
    { key: 'fechaDocumento', label: 'Fecha' },
    { key: 'proveedor', label: 'Proveedor' },
    { key: 'tienda', label: 'Tienda' },
    { key: 'supervisor', label: 'Supervisor' },
    { key: 'cotizacion', label: 'Cotización' },
    { key: 'xLiberacion', label: 'X Lib.' },
    { key: 'rawPrecioNeto', label: 'Precio neto' },
    { key: 'ocAgeAlert', label: 'Alerta OC' },
    { key: 'documentos', label: 'Docs' },
    { key: 'detalle', label: '' }
  ];

  const sc2 = state.pagination.sortCol;
  const sd = state.pagination.sortDir;

  const headerHTML = cols.map(c => {
    if (!c.key) return `<th></th>`;
    const cls = sc2 === c.key ? `sort-${sd}` : '';
    return `<th class="${cls}" onclick="sortBy('${c.key}')">${escapeHtml(c.label)}</th>`;
  }).join('');

  const bodyHTML = pageRows.map(row => {
    const ageInfo = getOcAgeAlertInfo(row);
    const delClass = [row.isDeleted ? 'deleted-row' : '', ageInfo.rowCls].filter(Boolean).join(' ');
    return `
      <tr class="${delClass}">
        <td>${escapeHtml(row.oc||'—')}</td>
        <td><span style="font-family:var(--font-mono); font-size:12px;">${escapeHtml(row.incidencia||'—')}</span></td>
        <td>${escapeHtml(formatDateValue(row.fechaDocumento))}</td>
        <td>${escapeHtml(row.proveedor||'—')}</td>
        <td>${escapeHtml(row.tienda||'—')}</td>
        <td>${escapeHtml(row.supervisor||'—')}</td>
        <td>${escapeHtml(row.cotizacion||'—')}</td>
        <td style="text-align:center;">${row.xLiberacion||0}${row.isDeleted?` <span class="badge badge-deleted">L</span>`:''}</td>
        <td style="font-family:var(--font-mono); font-size:12px;">${escapeHtml(formatCurrency(row.rawPrecioNeto))}</td>
        <td><span class="oc-age-pill ${ageInfo.cls}">${escapeHtml(ageInfo.label)}</span></td>
        <td><button class="detail-btn" title="Buscar documentos por incidencia u OC en la carpeta vinculada" onclick="buscarDocumentosLocalesOC(${row.rowIndex})">📎 Docs</button></td>
        <td><button class="detail-btn" onclick="openDetailModal(${row.rowIndex})">Ver</button></td>
      </tr>
    `;
  }).join('');

  // Pagination controls
  const maxPages = 7;
  let pageNums = [];
  if (totalPages <= maxPages) {
    pageNums = Array.from({length:totalPages},(_,i)=>i+1);
  } else {
    const cur = state.pagination.page;
    pageNums = [1];
    if (cur > 3) pageNums.push('...');
    for (let p = Math.max(2, cur-1); p <= Math.min(totalPages-1, cur+1); p++) pageNums.push(p);
    if (cur < totalPages - 2) pageNums.push('...');
    pageNums.push(totalPages);
  }

  const pageHTML = pageNums.map(p => {
    if (p === '...') return `<span style="padding:0 6px; color:var(--muted); font-family:var(--font-mono); font-size:12px;">…</span>`;
    return `<button class="page-btn ${p===state.pagination.page?'active':''}" onclick="goToPage(${p})">${p}</button>`;
  }).join('');

  tableWrapper.innerHTML = `
    <div class="table-toolbar">
      <h4>${escapeHtml(VIEW_KEYS.find(v=>v.key===state.selectedView)?.label||'Detalle')}</h4>
      <span style="font-size:12px; color:var(--muted); font-family:var(--font-mono);">${rows.length.toLocaleString('es-CO')} registros · pág ${state.pagination.page}/${totalPages}</span>
      <span style="font-size:11px; color:var(--muted);">Borrados L en amarillo</span>
    </div>
    <div class="table-scroll">
      <table>
        <thead><tr>${headerHTML}</tr></thead>
        <tbody>${bodyHTML}</tbody>
      </table>
    </div>
    <div class="pagination">
      <div class="page-info">Mostrando ${start+1}–${Math.min(start+ps, rows.length)} de ${rows.length.toLocaleString('es-CO')}</div>
      <div class="page-controls">
        <button class="page-btn" onclick="goToPage(${state.pagination.page-1})" ${state.pagination.page===1?'disabled':''}>‹</button>
        ${pageHTML}
        <button class="page-btn" onclick="goToPage(${state.pagination.page+1})" ${state.pagination.page===totalPages?'disabled':''}>›</button>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:11px; color:var(--muted); font-family:var(--font-mono);">Por pág:</span>
        <select class="page-size-select" onchange="changePageSize(this.value)">
          ${[25,50,100,200,500].map(n=>`<option value="${n}" ${n===ps?'selected':''}>${n}</option>`).join('')}
        </select>
      </div>
    </div>
  `;
}

function sortBy(col) {
  if (state.pagination.sortCol === col) {
    state.pagination.sortDir = state.pagination.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    state.pagination.sortCol = col;
    state.pagination.sortDir = 'asc';
  }
  state.pagination.page = 1;
  renderTableForCurrentView();
}
window.sortBy = sortBy;

function goToPage(p) {
  const rows = state.searchedRows[state.selectedView]||[];
  const totalPages = Math.max(1, Math.ceil(rows.length / state.pagination.pageSize));
  if (p < 1 || p > totalPages) return;
  state.pagination.page = p;
  renderTableForCurrentView();
}
window.goToPage = goToPage;

function changePageSize(val) {
  state.pagination.pageSize = parseInt(val, 10);
  state.pagination.page = 1;
  renderTableForCurrentView();
}
window.changePageSize = changePageSize;

/* ── DETAIL MODAL ── */
function openDetailModal(rowIndex) {
  const rows = state.searchedRows[state.selectedView]||[];
  const row = rows.find(r => r.rowIndex === rowIndex);
  if (!row) { showInfoDialog('Sin datos','No se encontró el registro.'); return; }

  const fields = [
    ['OC', row.oc||'—'], ['Incidencia', row.incidencia||'—'],
    ['Tipo incidencia', row.tipoIncidencia||'—'], ['Fecha doc.', formatDateValue(row.fechaDocumento)],
    ['Estado', row.isDeleted ? '🔴 Borrado (L)' : '✅ Activo'], ['Liberación', row.liberacion||'—'],
    ['X liberación', row.xLiberacion??0], ['Proveedor', row.proveedor||'—'],
    ['Tienda', row.tienda||'—'], ['Supervisor', row.supervisor||'—'],
    ['Cotización', row.cotizacion||'—'], ['Tipo servicio', row.tipoServicio||'—'],
    ['Tipo gasto', row.tipoGasto||'—'], ['Descripción', row.descripcionBreve||'—'],
    ['Por calcular', formatCurrency(row.porCalcular)], ['Por entregar valor', formatCurrency(row.porEntregarValor)],
    ['Por entregar cantidad', row.porEntregarCantidad??'0'], ['Tipo imputación', row.tipoImputacion||'—'],
    ['Centro coste', row.centroCoste||'—'], ['Gerente', row.gerente||row.directorioGerente||'—'],
    ['Jefe de zona', row.directorioJefeZona||'—'], ['Origen datos', row.origenDirectorio||'Archivo original'],
    ['Precio neto', formatCurrency(row.rawPrecioNeto)]
  ];

  $id('detailModalBody').innerHTML = `
    ${fields.map(([k,v]) => `
      <div class="detail-item ${normalizeText(k).includes('detalle') ? 'full-detail' : ''}">
        <strong>${escapeHtml(k)}</strong>
        <span>${escapeHtml(String(v))}</span>
      </div>
    `).join('')}
    <div class="detail-item" style="grid-column:1/-1;">
      <strong>Texto breve</strong>
      <span style="white-space:normal;">${escapeHtml(row.textoBreve||'—')}</span>
    </div>
  `;
  $id('detailModal').style.display = 'block';
}
window.openDetailModal = openDetailModal;

function closeDetailModal() { $id('detailModal').style.display = 'none'; }
window.closeDetailModal = closeDetailModal;

$id('detailModal').addEventListener('click', e => { if (e.target.id==='detailModal') closeDetailModal(); });
