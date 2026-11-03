/* ── CRUCE ── */
function openCruceModal() {
  if (cruceSecundarioWrap) cruceSecundarioWrap.style.display = 'none';
  if (cruceStatsToggleBtn) cruceStatsToggleBtn.textContent = 'Mostrar resumen D1GO';
  updateCrucePrincipalStatus();
  cruceModal.style.display='block';
  if (!state.cruce.rows.length) {
    if (cruceAlertBox) { cruceAlertBox.style.display = "none"; cruceAlertBox.innerHTML = ""; }
    cruceResultados.innerHTML = `<div class="empty-state"><span class="icon">🔗</span>Carga el archivo secundario y presiona <strong>Cruzar</strong>.</div>`;
    secundarioStats.innerHTML='';
  } else {
    renderSecondaryStats();
    renderCruceFilteredResults();
  }
}
function closeCruceModal() { cruceModal.style.display='none'; }
window.closeCruceModal = closeCruceModal;

function updateCrucePrincipalStatus() {
  crucePrincipalStatus.textContent = state.rowsByView.sheet1.length ? '✅ Listo' : 'No cargado';
}

function getPrimaryStateRank(vg) { if(vg==='facturadas') return 4; if(vg==='pendientes') return 3; if(vg==='activos') return 2; return 1; }
function getPrimaryStateLabel(vg) { if(vg==='facturadas') return 'Facturada'; if(vg==='pendientes') return 'Pendiente'; if(vg==='activos') return 'Activa'; return 'Generada'; }

function runCruce() {
  if (!state.rowsByView.sheet1.length) { showInfoDialog('Falta principal','Carga el archivo principal primero.'); return; }
  if (!state.cruce.rows.length) { showInfoDialog('Falta secundario','Carga el archivo secundario primero.'); return; }
  showLoading('Cruzando archivos...');
  setTimeout(() => {
    try {
      const primaryMap = new Map();
      (state.rowsByView.sheet1||[]).forEach(row => {
        if (!row.incidencia || row.isDeleted) return;
        const cur = primaryMap.get(row.incidencia);
        const rank = getPrimaryStateRank(row.viewGroup);
        if (!cur || rank > cur.rank) {
          primaryMap.set(row.incidencia, {
            rank,
            estadoOc:getPrimaryStateLabel(row.viewGroup),
            viewGroup:row.viewGroup,
            oc:row.oc||'',
            tiendaPrincipal:row.tienda||'',
            proveedor:row.proveedor||'',
            supervisorPrincipal:row.supervisor||'',
            textoBreve:row.textoBreve||'',
            cotizacion: row.cotizacion || '',
            xLiberacion: Number(row.xLiberacion || 0),
            valorPrincipal: Number(row.rawPrecioNeto || 0),
            porEntregarValor: Number(row.rawPorEntregarValor || 0)
          });
        }
      });
      let critFact=0, critGen=0;
      state.cruce.filteredRows = (state.cruce.rows||[]).map(sec => {
        const match = primaryMap.get(sec.id);
        if (!match) return null;
        const estNorm = normalizeText(sec.estadoGeneral);
        const isOpenOrReq = estNorm.includes('abierta')||estNorm.includes('abierto')||estNorm.includes('solicitada')||estNorm.includes('solicitado');
        const isFact = match.viewGroup==='facturadas' && isOpenOrReq;
        const isGen = ['pendientes','activos','sheet1'].includes(match.viewGroup) && isOpenOrReq;
        if (isFact) critFact++;
        if (isGen) critGen++;
        return {
          id:sec.id,
          incidencia:sec.id,
          estadoGeneral:sec.estadoGeneral,
          estadoOc:match.estadoOc,
          oc:match.oc,
          tiendaSecundaria:sec.sucursal,
          tiendaPrincipal:match.tiendaPrincipal,
          proveedor:match.proveedor||sec.proveedorAdjudicado||sec.contratista||'',
          supervisor:sec.supervisor||match.supervisorPrincipal,
          area:sec.area,
          prioridad:sec.prioridad,
          tipo:sec.tipo,
          servicio:sec.servicio,
          detalle:sec.detalle||match.textoBreve,
          detalleSolicitud:sec.detalleSolicitud||sec.detalle||'',
          fechaIngreso:sec.fechaIngreso,
          fechaIngresoDate:sec.fechaIngresoDate,
          fechaIngresoKey:sec.fechaIngresoKey,
          fechaCierre:sec.fechaCierre,
          fechaCierreDate:sec.fechaCierreDate,
          fechaCierreKey:sec.fechaCierreKey,
          criticalFact:isFact,
          criticalGen:isGen,
          ocCotizacion: match.cotizacion || '',
          ocTextoBreve: match.textoBreve || '',
          ocXLiberacion: match.xLiberacion || 0,
          ocValorPrincipal: match.valorPrincipal || 0,
          ocPorEntregarValor: match.porEntregarValor || 0,
          proveedorAdjudicado: sec.proveedorAdjudicado || '',
          contratista: sec.contratista || '',
          especialidad: sec.especialidad || ''
        };
      }).filter(Boolean);
      cruceMatchCount.textContent = state.cruce.filteredRows.length.toLocaleString('es-CO');
      cruceCriticoFact.textContent = critFact.toLocaleString('es-CO');
      cruceCriticoGen.textContent = critGen.toLocaleString('es-CO');
      state.cruce.page = 1;
      renderCruceFilteredResults();
      toast(`Cruce listo: ${state.cruce.filteredRows.length} coincidencias ✅`);
    } finally { hideLoading(); }
  }, 40);
}


function getEstadoGeneralClass(v) {
  const t = normalizeText(v);
  if (t.includes('cerrad')) return 'estado-cerrada';
  if (t.includes('abiert')) return 'estado-abierta';
  if (t.includes('solicit')) return 'estado-solicitada';
  if (t.includes('pendient')) return 'estado-pendiente';
  return '';
}

function getEstadoOcClass(v) {
  const t = normalizeText(v);
  if (t.includes('factur')) return 'estado-oc-facturada';
  if (t.includes('pendient')) return 'estado-oc-pendiente';
  if (t.includes('activ')) return 'estado-oc-activa';
  if (t.includes('generad')) return 'estado-oc-generada';
  return '';
}

function getCruceRowKey(r) {
  return encodeURIComponent(JSON.stringify([
    r.id||'', r.oc||'', r.estadoGeneral||'', r.estadoOc||'',
    r.tiendaSecundaria||'', r.tiendaPrincipal||'', r.supervisor||'', r.detalle||''
  ]));
}


function getCruceLiberacionLabel(target) {
  const x = Number(target.ocXLiberacion ?? 0);
  const txt = normalizeText(target.ocLiberacion || '');
  const liberada = x > 0 || txt.includes('lib');
  return liberada ? '✅ Liberada' : '⚠️ No liberada';
}

function openCruceDetailModal(rowKey) {
  const decoded = decodeURIComponent(rowKey||'');
  const target = (state.cruce.filteredRows||[]).find(r => getCruceRowKey(r) === decoded);
  if (!target) { showInfoDialog('Sin datos', 'No se encontró el detalle del cruce.'); return; }

  const liberacion = getCruceLiberacionLabel(target);

  const fields = [
    ['ID', target.id || '—'],
    ['Incidencia', target.incidencia || target.id || '—'],
    ['Estado General', target.estadoGeneral || '—'],
    ['Estado OC', target.estadoOc || '—'],
    ['OC', target.oc || '—'],
    ['Tienda OC', target.tiendaPrincipal || '—'],
    ['Proveedor', target.proveedor || '—'],
    ['Supervisor', target.supervisor || '—'],
    ['Cotización', target.ocCotizacion || '—'],
    ['Texto breve', target.ocTextoBreve || '—'],
    ['Detalle de solicitud D1GO / columna AG', target.detalleSolicitud || target.detalle || '—'],
    ['Estado de liberación', liberacion],
    ['Cantidad de X', target.ocXLiberacion ?? 0],
    ['Valor OC', formatCurrency(target.ocValorPrincipal || 0)],
    ['Valor por entregar', formatCurrency(target.ocPorEntregarValor || 0)],
    ['Fecha ingreso', formatDateOnly(target.fechaIngresoDate) || formatDateValue(target.fechaIngreso) || formatDateLabelFromKey(target.fechaIngresoKey) || '—'],
    ['Tienda D1GO', target.tiendaSecundaria || '—'],
    ['Área', target.area || '—'],
    ['Servicio', target.servicio || '—'],
    ['Prioridad', target.prioridad || '—'],
    ['Tipo', target.tipo || '—'],
    ['Proveedor adjudicado', target.proveedorAdjudicado || '—'],
    ['Contratista', target.contratista || '—'],
    ['Especialidad', target.especialidad || '—'],
    ['Crítico facturado', target.criticalFact ? 'Sí' : 'No'],
    ['Crítico pendiente/activo', target.criticalGen ? 'Sí' : 'No']
  ];

  cruceDetailModalBody.innerHTML = `
    ${fields.map(([k,v]) => `
      <div class="detail-item ${normalizeText(k).includes('detalle') ? 'full-detail' : ''}">
        <strong>${escapeHtml(k)}</strong>
        <span>${escapeHtml(String(v))}</span>
      </div>
    `).join('')}
    <div class="detail-item" style="grid-column:1/-1;">
      <strong>Detalle</strong>
      <span style="white-space:normal;">${escapeHtml(target.detalleSolicitud || target.detalle || '—')}</span>
    </div>
  `;
  $id('cruceDetailModal').style.display = 'block';
  toast(`Detalle del cruce abierto · OC ${target.oc || '—'} 🔎`, 'info', 1800);
}
window.openCruceDetailModal = openCruceDetailModal;

function closeCruceDetailModal() { $id('cruceDetailModal').style.display = 'none'; }
window.closeCruceDetailModal = closeCruceDetailModal;

$id('cruceDetailModal').addEventListener('click', e => { if (e.target.id === 'cruceDetailModal') closeCruceDetailModal(); });


function toggleCruceSecondaryStats() {
  state.cruce.ui.showSecundarioStats = !state.cruce.ui.showSecundarioStats;
  if (cruceSecundarioWrap) cruceSecundarioWrap.style.display = state.cruce.ui.showSecundarioStats ? 'block' : 'none';
  if (cruceStatsToggleBtn) cruceStatsToggleBtn.textContent = state.cruce.ui.showSecundarioStats ? 'Ocultar resumen D1GO' : 'Mostrar resumen D1GO';
  toast(state.cruce.ui.showSecundarioStats ? 'Resumen D1GO visible 👁️' : 'Resumen D1GO oculto 🙈', 'info', 1300);
}

function getCruceDateForFilter(row) {
  const tipo = (cruceFechaTipo && cruceFechaTipo.value) || 'ingreso';
  if (tipo === 'ingreso') return row.fechaIngresoDate || null;
  if (tipo === 'cierre') return row.fechaCierreDate || null;
  return row.fechaIngresoDate || row.fechaCierreDate || null;
}

function getCruceSemaforo(critCount, total) {
  const pct = total ? (critCount / total) * 100 : 0;
  if (pct >= 30) return { cls: 'semaforo-critico', text: `🔴 Crítico ${pct.toFixed(1)}%` };
  if (pct >= 10) return { cls: 'semaforo-medio', text: `🟡 Medio ${pct.toFixed(1)}%` };
  return { cls: 'semaforo-ok', text: `🟢 OK ${pct.toFixed(1)}%` };
}

function compareCruce(a, b, col, dir) {
  const mult = dir === 'asc' ? 1 : -1;
  const getVal = (r) => {
    switch (col) {
      case 'id': return Number(onlyDigits(r.id)) || 0;
      case 'estadoGeneral': return normalizeText(r.estadoGeneral);
      case 'estadoOc': return normalizeText(r.estadoOc);
      case 'oc': return Number(onlyDigits(r.oc)) || 0;
      case 'supervisor': return normalizeText(r.supervisor);
      case 'fechaIngreso': return r.fechaIngresoDate ? r.fechaIngresoDate.getTime() : 0;
      case 'fechaCierre': return r.fechaCierreDate ? r.fechaCierreDate.getTime() : 0;
      case 'critical': return (r.criticalFact || r.criticalGen) ? 1 : 0;
      default: return normalizeText(r[col] || '');
    }
  };
  const va = getVal(a), vb = getVal(b);
  if (va < vb) return -1 * mult;
  if (va > vb) return 1 * mult;
  return 0;
}

function setCruceSort(col) {
  if (state.cruce.sortCol === col) state.cruce.sortDir = state.cruce.sortDir === 'asc' ? 'desc' : 'asc';
  else { state.cruce.sortCol = col; state.cruce.sortDir = col in {'fechaIngreso':1,'fechaCierre':1,'critical':1} ? 'desc' : 'asc'; }
  renderCruceFilteredResults();
}
window.setCruceSort = setCruceSort;

function getCrucePagination(total) {
  const pageSize = Number(state.cruce.pageSize || 15);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (state.cruce.page > totalPages) state.cruce.page = totalPages;
  const start = (state.cruce.page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  return { pageSize, totalPages, start, end };
}

function renderCrucePagination(total) {
  const { pageSize, totalPages, start, end } = getCrucePagination(total);
  const nums = [];
  const begin = Math.max(1, state.cruce.page - 2);
  const finish = Math.min(totalPages, begin + 4);
  for (let p = begin; p <= finish; p++) {
    nums.push(`<button class="page-btn ${p===state.cruce.page?'active':''}" onclick="goToCrucePage(${p})">${p}</button>`);
  }
  return `
    <div class="pagination">
      <div class="page-info">Mostrando ${total ? start + 1 : 0}-${end} de ${total}</div>
      <div class="page-controls">
        <select class="page-size-select" id="crucePageSize">
          <option value="10" ${pageSize===10?'selected':''}>10</option>
          <option value="15" ${pageSize===15?'selected':''}>15</option>
          <option value="25" ${pageSize===25?'selected':''}>25</option>
          <option value="50" ${pageSize===50?'selected':''}>50</option>
        </select>
        <button class="page-btn" onclick="goToCrucePage(${Math.max(1, state.cruce.page-1)})" ${state.cruce.page===1?'disabled':''}>‹</button>
        ${nums.join('')}
        <button class="page-btn" onclick="goToCrucePage(${Math.min(totalPages, state.cruce.page+1)})" ${state.cruce.page===totalPages?'disabled':''}>›</button>
      </div>
    </div>`;
}
function goToCrucePage(page) { state.cruce.page = page; renderCruceFilteredResults(); }
window.goToCrucePage = goToCrucePage;





function toggleCruceResumenD1go() {
  if (!cruceSecundarioWrap || !cruceStatsToggleBtn) return;
  const isVisible = cruceSecundarioWrap.style.display === 'block';
  cruceSecundarioWrap.style.display = isVisible ? 'none' : 'block';
  cruceStatsToggleBtn.textContent = isVisible ? 'Mostrar resumen D1GO' : 'Ocultar resumen D1GO';
}
window.toggleCruceResumenD1go = toggleCruceResumenD1go;

function renderCruceAlert(rows) {
  if (!cruceAlertBox) return;
  if (!rows || !rows.length) {
    cruceAlertBox.style.display = 'none';
    cruceAlertBox.innerHTML = '';
    return;
  }

  const critFact = rows.filter(r => r.criticalFact).length;
  const critGen = rows.filter(r => r.criticalGen).length;
  const totalCrit = rows.filter(r => r.criticalFact || r.criticalGen).length;

  if (critFact > 0) {
    cruceAlertBox.style.display = 'block';
    cruceAlertBox.innerHTML = `
      <div class="cruce-alert">
        <span>⚠️ <strong>${critFact}</strong> incidencias facturadas siguen abiertas o solicitadas. Además hay <strong>${critGen}</strong> pendientes/activas/generadas abiertas y un total de <strong>${totalCrit}</strong> críticas visibles.</span>
      </div>
    `;
    return;
  }

  cruceAlertBox.style.display = 'block';
  cruceAlertBox.innerHTML = `
    <div class="cruce-alert ok">
      <span>✅ No hay incidencias facturadas críticas en la vista actual. Críticas visibles totales: <strong>${totalCrit}</strong>.</span>
    </div>
  `;
}

function isD1goOpenState(row) {
  const e = normalizeText(row?.estadoGeneral || '');
  return e.includes('abierta') || e.includes('abierto');
}

function isLiberada2XConOcAbierta(row) {
  return !!(row && row.oc && Number(row.ocXLiberacion || 0) >= 2 && isD1goOpenState(row));
}

function getVisibleCruceRows() {
  const estado = normalizeText(cruceEstadoFilter.value||'');
  const estadoOc = String(cruceEstadoOcFilter.value||'').trim();
  const supervisor = normalizeText(cruceSupervisorFilter.value||'');
  const incSet = new Set(parseIncidencias(cruceIncidenciaFilter.value||''));
  const fechaDesde = cruceFechaDesde.value ? new Date(cruceFechaDesde.value + 'T00:00:00') : null;
  const fechaHasta = cruceFechaHasta.value ? new Date(cruceFechaHasta.value + 'T23:59:59') : null;
  const soloCriticos = !!cruceSoloCriticos.checked;
  const soloCritFact = !!cruceSoloCritFact.checked;
  const soloLiberadas2XAbiertas = !!cruceSoloLiberadas2XAbiertas?.checked;
  const query = normalizeText(cruceSearchInput.value||'');

  return (state.cruce.filteredRows||[]).filter(r => {
    const matchEst = !estado || normalizeText(r.estadoGeneral)===estado;
    const opts = estadoOc ? estadoOc.split('|').map(v=>v.trim()).filter(Boolean) : [];
    const matchEstOc = !opts.length || opts.includes(String(r.estadoOc||'').trim());
    const matchSup = !supervisor || normalizeText(r.supervisor)===supervisor || normalizeText(r.supervisor).includes(supervisor);
    const matchInc = !incSet.size || incSet.has(r.id) || incSet.has(onlyDigits(r.incidencia));
    const fechaBase = getCruceDateForFilter(r);
    const matchFechaDesde = !fechaDesde || (fechaBase && fechaBase >= fechaDesde);
    const matchFechaHasta = !fechaHasta || (fechaBase && fechaBase <= fechaHasta);
    const matchCrit = !soloCriticos || r.criticalFact || r.criticalGen;
    const matchCritFact = !soloCritFact || r.criticalFact;
    const matchLiberada2XAbierta = !soloLiberadas2XAbiertas || isLiberada2XConOcAbierta(r);
    const hs = normalizeText([r.id,r.estadoGeneral,r.estadoOc,r.oc,r.tiendaSecundaria,r.tiendaPrincipal,r.proveedor,r.supervisor,r.area,r.servicio,r.detalle].join(' | '));
    const matchQ = !query || hs.includes(query);
    return matchEst && matchEstOc && matchSup && matchInc && matchFechaDesde && matchFechaHasta && matchCrit && matchCritFact && matchLiberada2XAbierta && matchQ;
  });
}



function renderCruceFilteredResults() {
  if (!state.cruce.filteredRows.length) {
    if (cruceAlertBox) { cruceAlertBox.style.display = "none"; cruceAlertBox.innerHTML = ""; }
    cruceResultados.innerHTML = `<div class="empty-state"><span class="icon">🔗</span>No hay cruce generado o sin coincidencias. Recuerda: el cruce solo toma incidencias que existen en OC y también en D1GO.</div>`;
    return;
  }

  const filteredBase = getVisibleCruceRows();
  const critCount = filteredBase.filter(r=>r.criticalFact||r.criticalGen).length;
  const critFactCount = filteredBase.filter(r=>r.criticalFact).length;
  const critGenCount = filteredBase.filter(r=>r.criticalGen).length;
  const uniqueInc = new Set(filteredBase.map(r=>onlyDigits(r.incidencia||r.id)).filter(Boolean)).size;
  const liberadas2xAbiertasCount = filteredBase.filter(isLiberada2XConOcAbierta).length;
  const sem = getCruceSemaforo(critCount, filteredBase.length);
  renderCruceAlert(filteredBase);

  if (!filteredBase.length) {
    cruceResultados.innerHTML = `<div class="pro-info-banner"><div><strong>🔗 Cruce OC vs D1GO</strong><p>Estás viendo solo coincidencias entre los dos archivos. Los filtros actuales no dejaron resultados visibles.</p></div><div class="pro-mini-kpis"><span class="pro-mini-kpi"><strong>${formatNumber(state.cruce.filteredRows.length)}</strong> coincidencias base</span></div></div><div class="empty-state"><span class="icon">🔎</span>No hay resultados con los filtros actuales. Limpia filtros o cambia estado/supervisor/fecha.</div>`;
    return;
  }

  const sorted = [...filteredBase].sort((a,b) => compareCruce(a,b,state.cruce.sortCol,state.cruce.sortDir));
  const { start, end } = getCrucePagination(sorted.length);
  const filtered = sorted.slice(start, end);
  const sortArrow = (col) => state.cruce.sortCol === col ? (state.cruce.sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  cruceResultados.innerHTML = `
    <div class="pro-info-banner">
      <div><strong>🔗 Vista de cruce OC vs D1GO</strong><p>Este módulo no representa todo D1GO. Solo muestra incidencias que aparecen en el archivo principal de OC y también en el archivo D1GO.</p></div>
      <div class="pro-mini-kpis">
        <span class="pro-mini-kpi"><strong>${formatNumber(filteredBase.length)}</strong> coincidencias visibles</span>
        <span class="pro-mini-kpi"><strong>${formatNumber(uniqueInc)}</strong> incidencias únicas</span>
        <span class="pro-mini-kpi"><strong>${formatNumber(critFactCount)}</strong> facturadas críticas</span>
        <span class="pro-mini-kpi"><strong>${formatNumber(critGenCount)}</strong> seguimiento</span>
        <span class="pro-mini-kpi"><strong>${formatNumber(liberadas2xAbiertasCount)}</strong> liberadas 2 X abiertas</span>
      </div>
    </div>
    <div class="cruce-summary-row">
      <span class="cruce-badge">🔎 ${formatNumber(filteredBase.length)} coincidencias visibles</span>
      <span class="cruce-badge">🧩 ${formatNumber(uniqueInc)} incidencias únicas</span>
      <span class="cruce-badge">🔴 ${formatNumber(critCount)} críticas</span>
      <span class="cruce-badge">✅ ${formatNumber(liberadas2xAbiertasCount)} liberadas 2 X + abiertas</span>
      <span class="semaforo-pill ${sem.cls}">${sem.text}</span>
    </div>
    <div class="table-wrapper"><div class="table-toolbar"><h4>Resultados del cruce</h4><span style="font-size:11px; color:var(--muted);">Vista resumida · Llave: Incidencia ↔ ID</span></div>
      <div class="table-scroll"><table style="min-width:1420px;"><thead><tr>
        <th class="clickable-th ${state.cruce.sortCol==='id'?'active-sort':''}" onclick="setCruceSort('id')">ID${sortArrow('id')}</th>
        <th class="clickable-th ${state.cruce.sortCol==='estadoGeneral'?'active-sort':''}" onclick="setCruceSort('estadoGeneral')">Estados${sortArrow('estadoGeneral')}</th>
        <th class="clickable-th ${state.cruce.sortCol==='oc'?'active-sort':''}" onclick="setCruceSort('oc')">OC${sortArrow('oc')}</th>
        <th>Ubicación</th>
        <th class="clickable-th ${state.cruce.sortCol==='supervisor'?'active-sort':''}" onclick="setCruceSort('supervisor')">Responsable${sortArrow('supervisor')}</th>
        <th class="clickable-th ${state.cruce.sortCol==='fechaIngreso'?'active-sort':''}" onclick="setCruceSort('fechaIngreso')">Fechas${sortArrow('fechaIngreso')}</th>
        <th class="clickable-th ${state.cruce.sortCol==='critical'?'active-sort':''}" onclick="setCruceSort('critical')">Crítico${sortArrow('critical')}</th>
        <th>Detalle</th></tr></thead><tbody>
        ${filtered.map(r=>`<tr class="${(r.criticalFact||r.criticalGen)?'cruce-critical':''}">
          <td style="font-family:var(--font-mono); font-size:12px;">${escapeHtml(r.id||'—')}</td>
          <td style="white-space:normal; min-width:170px;"><div style="display:flex; flex-direction:column; gap:6px;"><span class="estado-pill ${getEstadoGeneralClass(r.estadoGeneral)}">${escapeHtml(r.estadoGeneral||'—')}</span><span class="estado-pill ${getEstadoOcClass(r.estadoOc)}">${escapeHtml(r.estadoOc||'—')}</span></div></td>
          <td style="font-family:var(--font-mono); font-size:12px;">${escapeHtml(r.oc||'—')}</td>
          <td><div class="cruce-resumen-ubicacion"><strong>${escapeHtml(r.tiendaSecundaria||'—')}</strong><small>OC: ${escapeHtml(r.tiendaPrincipal||'—')}</small></div></td>
          <td><div class="cruce-resumen-meta"><strong>${escapeHtml(r.supervisor||'—')}</strong><small>${escapeHtml(r.proveedor||'—')}</small></div></td>
          <td><div class="cruce-resumen-meta"><strong>Ing: ${escapeHtml(formatDateValue(r.fechaIngreso)||formatDateLabelFromKey(r.fechaIngresoKey)||'—')}</strong><small class="fecha-cierre-visible">Cierre: ${escapeHtml(formatCycleCloseDate(r))}</small></div></td>
          <td>${isLiberada2XConOcAbierta(r) ? `<span class="badge badge-liberada2x">✅ 2 X + abierta</span>` : ((r.criticalFact||r.criticalGen)?`<span class="badge badge-critical">${r.criticalFact ? '⚠ Facturado' : '⚠ Seguimiento'}</span>`:`<span style="color:var(--muted); font-size:12px;">—</span>`)}</td>
          <td><button class="detail-btn cruce-detail-btn" onclick="openCruceDetailModal('${getCruceRowKey(r)}')">Ver detalle</button></td>
        </tr>`).join('')}
      </tbody></table></div>${renderCrucePagination(sorted.length)}</div>`;
  const cps = document.getElementById('crucePageSize');
  if (cps) cps.addEventListener('change', () => { state.cruce.pageSize = Number(cps.value || 15); state.cruce.page = 1; renderCruceFilteredResults(); });
  if (cruceStatsModal.style.display==='block') renderCruceStatsModal();
}

function clearCruceFilters() {
  cruceEstadoFilter.value=''; cruceEstadoOcFilter.value=''; cruceSupervisorFilter.value='';
  cruceIncidenciaFilter.value=''; cruceFechaTipo.value='ingreso'; cruceFechaDesde.value=''; cruceFechaHasta.value='';
  cruceSoloCriticos.checked=false; cruceSoloCritFact.checked=false; if (cruceSoloLiberadas2XAbiertas) cruceSoloLiberadas2XAbiertas.checked=false; cruceSearchInput.value='';
  state.cruce.page = 1;
  renderCruceFilteredResults();
}

function copiarIncidenciasCruce() {
  if (!state.cruce.filteredRows.length) { showInfoDialog('Sin datos','Primero debes realizar el cruce.'); return; }
  const filtered = getVisibleCruceRows();
  renderCruceAlert(filtered);
  if (!filtered.length) { showInfoDialog('Sin datos','No hay incidencias visibles con los filtros actuales.'); return; }
  const lista = [...new Set(filtered.map(r => onlyDigits(r.incidencia || r.id)).filter(Boolean))].join(', ');
  if (!lista) { showInfoDialog('Sin incidencias','No se detectaron incidencias válidas para copiar.'); return; }
  navigator.clipboard.writeText(lista)
    .then(() => toast(`Incidencias del cruce copiadas: ${filtered.length} filas ✅`))
    .catch(() => showInfoDialog('Error al copiar','No fue posible copiar las incidencias del cruce.'));
}

function exportCruceData(mode = 'completo') {
  if (!state.cruce.filteredRows.length) { showInfoDialog('Sin datos','No hay cruce para exportar.'); return; }
  const filtered = getVisibleCruceRows();
  if (!filtered.length) { showInfoDialog('Sin datos','No hay filas visibles con los filtros actuales.'); return; }

  const exportRows = filtered.map(r => {
    if (mode === 'resumen') {
      return {
        ID:r.id,
        Estado_General:r.estadoGeneral,
        Estado_OC:r.estadoOc,
        Fecha_Ingreso:formatDateValue(r.fechaIngreso),
        Fecha_Cierre:formatDateValue(r.fechaCierre),
        OC:r.oc,
        Tienda:r.tiendaSecundaria,
        Supervisor:r.supervisor,
        Proveedor:r.proveedor,
        Critico:r.criticalFact || r.criticalGen ? 'Sí' : 'No'
      };
    }
    return {
      ID:r.id, Estado_General:r.estadoGeneral, Estado_OC:r.estadoOc, Fecha_Ingreso:formatDateValue(r.fechaIngreso), Fecha_Cierre:formatDateValue(r.fechaCierre), OC:r.oc,
      Tienda_Secundaria:r.tiendaSecundaria, Tienda_Principal:r.tiendaPrincipal,
      Proveedor:r.proveedor, Supervisor:r.supervisor, Area:r.area,
      Prioridad:r.prioridad, Tipo:r.tipo, Servicio:r.servicio, Detalle:r.detalle,
      Critico_Fact:r.criticalFact?'Sí':'No', Critico_Gen:r.criticalGen?'Sí':'No'
    };
  });

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb2 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb2, ws, mode === 'resumen' ? 'Cruce_Resumen' : 'Cruce_Completo');
  XLSX.writeFile(wb2, mode === 'resumen' ? 'Cruce_incidencias_resumen.xlsx' : 'Cruce_incidencias_filtrado.xlsx');
  toast(mode === 'resumen' ? 'Resumen del cruce exportado ✅' : 'Cruce completo exportado ✅');
}

function openCruceStatsModal() {
  if (!state.cruce.filteredRows.length) { showInfoDialog('Sin cruce','Genera el cruce primero.'); return; }
  cruceStatsModal.style.display='block';
  renderCruceStatsModal();
}
function closeCruceStatsModal() { cruceStatsModal.style.display='none'; }
window.closeCruceStatsModal = closeCruceStatsModal;

function renderCruceStatsModal() {
  const rows = getVisibleCruceRows();
  let ab=0, sol=0, cer=0, cf=0, cg=0;
  const porEstado=new Map(), porSup=new Map();
  const addM=(m,k)=>{const n=String(k||'—').trim()||'—'; m.set(n,(m.get(n)||0)+1);};
  rows.forEach(r=>{
    const e=normalizeText(r.estadoGeneral);
    if(e.includes('abierta')||e.includes('abierto')) ab++;
    if(e.includes('solicitada')||e.includes('solicitado')) sol++;
    if(e.includes('cerrada')||e.includes('cerrado')) cer++;
    if(r.criticalFact) cf++;
    if(r.criticalGen) cg++;
    addM(porEstado,r.estadoGeneral); addM(porSup,r.supervisor);
  });
  cruceStatsTotal.textContent=formatNumber(rows.length);
  cruceStatsCerradas.textContent=formatNumber(cer);
  cruceStatsAbiertas.textContent=formatNumber(ab);
  cruceStatsSolicitadas.textContent=formatNumber(sol);
  cruceStatsCritFact.textContent=formatNumber(cf);
  cruceStatsCritGen.textContent=formatNumber(cg);
  cruceStatsContent.innerHTML=[
    buildSimpleStatsTable('Estados del cruce',topEntries(porEstado,12)),
    buildSimpleStatsTable('Supervisores del cruce',topEntries(porSup,12))
  ].join('');
}
