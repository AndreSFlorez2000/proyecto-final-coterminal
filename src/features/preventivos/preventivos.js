
(function(){
  'use strict';

  const PM = {
    selectedDays: new Set(),
    manualDaysTouched: false,
    currentDrill: null,
    detailMap: new Map(),
    lastRows: [],
    lastTableRows: [],
    page: 1,
    pageSize: 25,
    tableFilters: { fecha: '', supervisor: '', tienda: '', estado: '', search: '' }
  };

  function qs(id){ return document.getElementById(id); }
  function norm(v){
    try {
      if (typeof normalizeText === 'function') return normalizeText(v || '');
    } catch(e){}
    return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  }
  function esc(v){
    try { if (typeof escapeHtml === 'function') return escapeHtml(v); } catch(e){}
    return String(v ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));
  }
  function nfmt(v){
    try { if (typeof formatNumber === 'function') return formatNumber(v); } catch(e){}
    return Number(v || 0).toLocaleString('es-CO');
  }
  function dateLabel(k){
    try { if (typeof formatDateLabelFromKey === 'function') return formatDateLabelFromKey(k); } catch(e){}
    return k || '';
  }
  function dateShort(k){
    try { if (typeof formatPivotDateShort === 'function') return formatPivotDateShort(k); } catch(e){}
    if (!k) return '';
    const parts = String(k).split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : k;
  }
  function dateKeyFromDate(d){
    try { if (typeof formatDateKey === 'function') return formatDateKey(d); } catch(e){}
    return d.toISOString().slice(0,10);
  }
  function todayKey(){ return dateKeyFromDate(new Date()); }
  function cycleStatus(v){
    try { if (typeof normalizeCycleStatus === 'function') return normalizeCycleStatus(v || 'Sin estado'); } catch(e){}
    const t = norm(v);
    if (t.includes('cerrad')) return 'Cerrada';
    if (t.includes('abiert')) return 'Abierta';
    if (t.includes('solicit')) return 'Solicitada';
    if (t.includes('pend')) return 'Pendiente';
    return v || 'Sin estado';
  }
  function toastMsg(msg, type){
    try { if (typeof toast === 'function') return toast(msg, type || 'success'); } catch(e){}
    alert(msg);
  }
  function info(title, msg){
    try { if (typeof showInfoDialog === 'function') return showInfoDialog(title, msg); } catch(e){}
    alert(title + '\n' + msg);
  }
  function allRows(){
    try { if (typeof getAllD1goRows === 'function') return getAllD1goRows() || []; } catch(e){}
    try { return (window.state && window.state.cruce && window.state.cruce.rows) || []; } catch(e){}
    return [];
  }

  function isPreventivoRow(r){
    const servicio = norm(r && r.servicio);
    const detalle = norm((r && (r.detalleSolicitud || r.detalle)) || '');
    return servicio.includes('preventiv') || servicio.includes('rutina') || detalle.includes('rutina preventiva');
  }

  function rowDateKeys(r, mode){
    const ingreso = r && r.fechaIngresoKey;
    const cierre = r && r.fechaCierreKey;
    const st = cycleStatus(r && r.estadoGeneral);
    if (mode === 'ingreso') return ingreso ? [ingreso] : [];
    if (mode === 'cierre') return cierre ? [cierre] : [];
    if (mode === 'ambas') return Array.from(new Set([ingreso, cierre].filter(Boolean)));
    if (st === 'Cerrada') return cierre ? [cierre] : (ingreso ? [ingreso] : []);
    return ingreso ? [ingreso] : (cierre ? [cierre] : []);
  }

  function els(){
    return {
      modal: qs('preventivosModal'),
      content: qs('preventivosContent'),
      detail: qs('preventivosDetailBox'),
      start: qs('preventivosStart'),
      end: qs('preventivosEnd'),
      dateType: qs('preventivosDateType'),
      supervisor: qs('preventivosSupervisorFilter'),
      estado: qs('preventivosEstadoFilter'),
      tipo: qs('preventivosTipoFilter'),
      tienda: qs('preventivosTiendaFilter'),
      search: qs('preventivosSearchInput'),
      daysList: qs('preventivosDaysList')
    };
  }

  function ensureModal(){
    if (qs('preventivosModal')) return;

    const modal = document.createElement('div');
    modal.id = 'preventivosModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <div>
            <div class="modal-title">🛠️ Preventivos</div>
            <div class="modal-subtitle">Sección separada para rutinas y preventivos detectados desde la columna G / Servicio del archivo D1GO.</div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary btn-sm" type="button" onclick="copyPreventivosIncidencias()">📋 Copiar incidencias</button>
            <button class="btn btn-secondary btn-sm" type="button" onclick="exportPreventivosExcel()">⬇ Exportar Excel</button>
            <button class="btn btn-secondary btn-sm" type="button" onclick="closePreventivosModal()">✕ Cerrar</button>
          </div>
        </div>

        <div class="preventivos-shell">
          <div class="preventivos-hero">
            <div>
              <strong>Panel de control de preventivos</strong>
              <p>Aquí puedes revisar preventivos por estado, tipo de rutina, supervisor y tienda. Al hacer clic en cualquier número se filtra automáticamente la tabla inferior con el detalle correspondiente.</p>
            </div>
            <button class="btn btn-success btn-sm" type="button" onclick="clearPreventivosDrill()">Ver todos los preventivos</button>
          </div>

          <div id="preventivosFilterNote" class="preventivos-filter-note">
            <span>Vista actual: <strong>Todos los preventivos</strong></span>
            <button class="btn btn-secondary btn-sm" type="button" onclick="clearPreventivosDrill()">Limpiar selección</button>
          </div>

          <div class="preventivos-controls">
            <div class="field"><label for="preventivosStart">Desde</label><input id="preventivosStart" type="date" /></div>
            <div class="field"><label for="preventivosEnd">Hasta</label><input id="preventivosEnd" type="date" /></div>
            <div class="field"><label for="preventivosDateType">Fecha a evaluar</label><select id="preventivosDateType"><option value="ingreso">Fecha ingreso / creación</option><option value="cierre">Fecha cierre</option><option value="ambas">Ingreso o cierre</option><option value="auto" selected>Auto: cerradas por cierre, demás por ingreso</option></select></div>
            <div class="field"><label for="preventivosSupervisorFilter">Supervisor</label><select id="preventivosSupervisorFilter"><option value="">Todos</option></select></div>
            <div class="field"><label for="preventivosEstadoFilter">Estado</label><select id="preventivosEstadoFilter"><option value="">Todos</option></select></div>
            <div class="field"><label for="preventivosTipoFilter">Rutina / servicio</label><select id="preventivosTipoFilter"><option value="">Todos</option></select></div>
            <div class="field"><label for="preventivosTiendaFilter">Tienda</label><select id="preventivosTiendaFilter"><option value="">Todas</option></select></div>
            <div class="field"><label for="preventivosSearchInput">Buscar</label><input id="preventivosSearchInput" type="text" placeholder="ID, tienda, detalle..." /></div>
          </div>

          <div class="preventivos-days-box">
            <div class="preventivos-days-head">
              <div><strong>Días exactos visibles</strong><small>Marca únicamente los días que quieres incluir en el análisis.</small></div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-secondary btn-sm" type="button" onclick="setPreventivosDaysChecked('all')">Todos</button>
                <button class="btn btn-secondary btn-sm" type="button" onclick="setPreventivosDaysChecked('none')">Quitar todas las selecciones</button>
              </div>
            </div>
            <div id="preventivosDaysList" class="preventivos-days-list"></div>
          </div>

          <div id="preventivosContent"></div>
          <div id="preventivosDetailBox" style="display:none;"></div>
        </div>
      </div>

      <div id="preventivoFloatingDetail" class="preventivo-floating-detail" onclick="if(event.target===this) closePreventivoFloatingDetail()">
        <div class="preventivo-floating-box">
          <div class="preventivo-floating-head">
            <div>
              <div class="preventivo-floating-title">Detalle de solicitud D1GO</div>
              <div id="preventivoFloatingSubtitle" class="preventivo-floating-subtitle"></div>
            </div>
            <button class="btn btn-secondary btn-sm" type="button" onclick="closePreventivoFloatingDetail()">✕ Cerrar</button>
          </div>
          <div class="preventivo-floating-body">
            <div id="preventivoFloatingText" class="preventivo-floating-text"></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    // El detalle de preventivos queda por fuera del modal principal para que siempre se vea centrado en pantalla.
    const floating = modal.querySelector('#preventivoFloatingDetail');
    if (floating) document.body.appendChild(floating);
  }

  function ensureButton(){
    if (qs('openPreventivosBtn') || qs('openPreventivosBtnBanner')) return;
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary cycle-main-only-btn';
    btn.id = 'openPreventivosBtn';
    btn.type = 'button';
    btn.textContent = '🛠️ Preventivos';
    btn.onclick = openPreventivosModal;

    const ccurgBtn = qs('openCCUrgVitalBtnBanner');
    if (ccurgBtn && ccurgBtn.parentNode) {
      ccurgBtn.parentNode.insertBefore(btn, ccurgBtn.nextSibling);
      return;
    }
    const d1goModal = qs('d1goStatsModal');
    if (d1goModal) {
      const hero = d1goModal.querySelector('.cycle-hero-access');
      if (hero) hero.appendChild(btn);
    }
  }

  function suggestedDates(){
    const e = els();
    const keys = allRows().filter(isPreventivoRow).flatMap(r => [r.fechaIngresoKey, r.fechaCierreKey]).filter(Boolean).sort();
    const max = keys[keys.length - 1] || todayKey();
    const end = new Date(max + 'T00:00:00');
    if (isNaN(end.getTime())) return;
    const start = new Date(end);
    start.setDate(end.getDate() - 30);
    if (e.start && !e.start.value) e.start.value = dateKeyFromDate(start);
    if (e.end && !e.end.value) e.end.value = dateKeyFromDate(end);
  }

  function hydrateFilters(){
    const e = els();
    const rows = allRows().filter(isPreventivoRow);
    const keep = {
      supervisor: e.supervisor && e.supervisor.value || '',
      estado: e.estado && e.estado.value || '',
      tipo: e.tipo && e.tipo.value || '',
      tienda: e.tienda && e.tienda.value || ''
    };

    const sups = Array.from(new Set(rows.map(r => r.supervisor || 'Sin supervisor').filter(Boolean))).sort((a,b)=>a.localeCompare(b,'es'));
    const estados = Array.from(new Set(rows.map(r => cycleStatus(r.estadoGeneral || 'Sin estado')).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'es'));
    const tipos = Array.from(new Set(rows.map(r => r.servicio || 'Sin servicio').filter(Boolean))).sort((a,b)=>a.localeCompare(b,'es'));
    const tiendas = Array.from(new Set(rows.map(r => r.sucursal || 'Sin tienda').filter(Boolean))).sort((a,b)=>a.localeCompare(b,'es'));

    if (e.supervisor) { e.supervisor.innerHTML = '<option value="">Todos</option>' + sups.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join(''); e.supervisor.value = keep.supervisor; }
    if (e.estado) { e.estado.innerHTML = '<option value="">Todos</option>' + estados.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join(''); e.estado.value = keep.estado; }
    if (e.tipo) { e.tipo.innerHTML = '<option value="">Todos</option>' + tipos.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join(''); e.tipo.value = keep.tipo; }
    if (e.tienda) { e.tienda.innerHTML = '<option value="">Todas</option>' + tiendas.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join(''); e.tienda.value = keep.tienda; }
  }

  function rowsAfterBaseFilters(ignoreDays){
    const e = els();
    const start = e.start && e.start.value || '';
    const end = e.end && e.end.value || '';
    const mode = e.dateType && e.dateType.value || 'auto';
    const sup = norm(e.supervisor && e.supervisor.value || '');
    const est = norm(e.estado && e.estado.value || '');
    const tipo = norm(e.tipo && e.tipo.value || '');
    const tienda = norm(e.tienda && e.tienda.value || '');
    const q = norm(e.search && e.search.value || '');
    const selected = ignoreDays ? new Set() : getSelectedDays();

    if (!ignoreDays && PM.manualDaysTouched && selected.size === 0) return [];

    const out = [];
    allRows().forEach(r => {
      if (!isPreventivoRow(r)) return;

      const keys = rowDateKeys(r, mode);
      const dateKeysInside = keys.filter(k => (!start || k >= start) && (!end || k <= end));
      const inDate = dateKeysInside.some(k => !selected.size || selected.has(k));
      if (!inDate) return;

      if (sup && norm(r.supervisor || 'Sin supervisor') !== sup) return;
      if (est && norm(cycleStatus(r.estadoGeneral || 'Sin estado')) !== est) return;
      if (tipo && norm(r.servicio || 'Sin servicio') !== tipo) return;
      if (tienda && norm(r.sucursal || 'Sin tienda') !== tienda) return;

      const hay = norm([r.id, r.estadoGeneral, r.sucursal, r.supervisor, r.area, r.servicio, r.tipo, r.detalle, r.detalleSolicitud, r.fechaIngresoKey, r.fechaCierreKey].join('|'));
      if (q && !hay.includes(q)) return;

      out.push({...r, preventivoFechaCols: dateKeysInside});
    });

    return out;
  }

  function applyDrill(rows){
    if (!PM.currentDrill) return rows;
    const { type, value } = PM.currentDrill;
    const target = norm(value);
    return rows.filter(r => {
      if (type === 'estado') return norm(cycleStatus(r.estadoGeneral || 'Sin estado')) === target;
      if (type === 'servicio') return norm(r.servicio || 'Sin servicio') === target;
      if (type === 'supervisor') return norm(r.supervisor || 'Sin supervisor') === target;
      if (type === 'tienda') return norm(r.sucursal || 'Sin tienda') === target;
      if (type === 'fecha') {
        const fecha = primaryRowDate(r);
        return norm(dateLabel(fecha) || fecha || 'Sin fecha') === target || norm(fecha) === target;
      }
      return true;
    });
  }

  function availableDays(){
    const e = els();
    const start = e.start && e.start.value || '';
    const end = e.end && e.end.value || '';
    const mode = e.dateType && e.dateType.value || 'auto';
    const days = new Set();

    allRows().filter(isPreventivoRow).forEach(r => {
      rowDateKeys(r, mode).forEach(k => {
        if ((!start || k >= start) && (!end || k <= end)) days.add(k);
      });
    });

    return Array.from(days).sort();
  }

  function getSelectedDays(){
    if (PM.manualDaysTouched) return new Set(PM.selectedDays);
    const e = els();
    if (!e.daysList) return new Set();
    return new Set(Array.from(e.daysList.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value).filter(Boolean));
  }

  function syncDays(){
    const e = els();
    PM.selectedDays = new Set(e.daysList ? Array.from(e.daysList.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value).filter(Boolean) : []);
    PM.manualDaysTouched = true;
  }

  window.setPreventivosDaysChecked = function(mode){
    const days = availableDays();
    PM.manualDaysTouched = true;
    PM.selectedDays = mode === 'all' ? new Set(days) : new Set();
    const e = els();
    if (e.daysList) e.daysList.querySelectorAll('input[type="checkbox"]').forEach(chk => { chk.checked = mode === 'all'; });
    renderPreventivosModal();
    toastMsg(mode === 'all' ? 'Todas las fechas de preventivos seleccionadas ✅' : 'Selecciones de preventivos quitadas ✅', 'success');
  };

  function renderDaySelector(){
    const e = els();
    if (!e.daysList) return;
    const days = availableDays();

    if (!days.length) {
      e.daysList.innerHTML = '<small style="color:var(--muted);font-family:var(--font-mono);">No hay días disponibles con los filtros actuales.</small>';
      return;
    }

    const selected = getSelectedDays();
    const defaultAll = selected.size === 0 && !PM.manualDaysTouched;
    if (defaultAll) PM.selectedDays = new Set(days);

    e.daysList.innerHTML = days.map(day => {
      const checked = defaultAll || selected.has(day) ? 'checked' : '';
      return `<label class="preventivos-day-chip"><input type="checkbox" value="${esc(day)}" ${checked}> ${esc(dateShort(day))}</label>`;
    }).join('');

    e.daysList.querySelectorAll('input[type="checkbox"]').forEach(chk => {
      chk.addEventListener('change', function(){ syncDays(); renderPreventivosModal(); });
    });
  }

  function primaryRowDate(r){
    return (r.preventivoFechaCols && r.preventivoFechaCols.length ? r.preventivoFechaCols[0] : (r.fechaIngresoKey || r.fechaCierreKey || ''));
  }

  function countMap(rows, getter){
    const m = new Map();
    rows.forEach(r => {
      const k = getter(r) || 'Sin dato';
      m.set(k, (m.get(k) || 0) + 1);
    });
    return Array.from(m.entries()).sort((a,b)=>b[1]-a[1] || String(a[0]).localeCompare(String(b[0]), 'es'));
  }

  function drillLabel(){
    if (!PM.currentDrill) return 'Todos los preventivos';
    const names = { estado:'Estado', servicio:'Rutina / servicio', supervisor:'Supervisor', tienda:'Tienda', fecha:'Fecha' };
    return `${names[PM.currentDrill.type] || 'Filtro'}: ${PM.currentDrill.value}`;
  }

  function setFilterNote(total){
    const note = qs('preventivosFilterNote');
    if (!note) return;
    note.innerHTML = `
      <span>Vista actual: <strong>${esc(drillLabel())}</strong> · ${nfmt(total)} registro(s)</span>
      <button class="btn btn-secondary btn-sm" type="button" onclick="clearPreventivosDrill()">Limpiar selección</button>`;
  }

  window.applyPreventivosDrill = function(type, rawValue){
    PM.currentDrill = { type, value: rawValue };
    PM.page = 1;
    renderPreventivosModal();
    const table = qs('preventivosMainTableWrap');
    if (table) table.scrollIntoView({ behavior:'smooth', block:'start' });
  };

  window.clearPreventivosDrill = function(){
    PM.currentDrill = null;
    PM.page = 1;
    const box = qs('preventivosDetailBox');
    if (box) box.innerHTML = '';
    renderPreventivosModal();
  };

  function kpiCard(label, value, type, rawValue, extraClass){
    const active = PM.currentDrill && PM.currentDrill.type === type && norm(PM.currentDrill.value) === norm(rawValue);
    return `<div class="preventivos-kpi ${extraClass || ''} ${active ? 'active' : ''}" onclick="applyPreventivosDrill('${type}', '${esc(String(rawValue)).replace(/'/g, '&#039;')}')">
      <div class="label">${esc(label)}</div>
      <div class="value">${nfmt(value)}</div>
    </div>`;
  }

  function clickableTable(title, data, type){
    const rows = data.slice(0,12).map(([k,v]) => `
      <tr>
        <td>${esc(k)}</td>
        <td style="text-align:right;">
          <button class="num-btn" type="button" onclick="applyPreventivosDrill('${type}', '${esc(String(k)).replace(/'/g, '&#039;')}')">${nfmt(v)}</button>
        </td>
      </tr>`).join('');

    return `<div class="preventivos-card">
      <h4>${esc(title)} <small>Clic en número</small></h4>
      <div class="stats-table-wrap">
        <table class="preventivos-click-table">
          <thead><tr><th>Concepto</th><th>Total</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="2">Sin datos</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
  }

  function tableFilterValue(r, key){
    if (key === 'fecha') return primaryRowDate(r) || '';
    if (key === 'supervisor') return r.supervisor || 'Sin supervisor';
    if (key === 'tienda') return r.sucursal || 'Sin tienda';
    if (key === 'estado') return cycleStatus(r.estadoGeneral || 'Sin estado');
    return '';
  }

  function applyPreventivosTableSubfilters(rows){
    const f = PM.tableFilters || {};
    const fecha = f.fecha || '';
    const supervisor = norm(f.supervisor || '');
    const tienda = norm(f.tienda || '');
    const estado = norm(f.estado || '');
    const search = norm(f.search || '');

    return rows.filter(r => {
      if (fecha && tableFilterValue(r, 'fecha') !== fecha) return false;
      if (supervisor && norm(tableFilterValue(r, 'supervisor')) !== supervisor) return false;
      if (tienda && norm(tableFilterValue(r, 'tienda')) !== tienda) return false;
      if (estado && norm(tableFilterValue(r, 'estado')) !== estado) return false;
      if (search) {
        const hay = norm([r.id, r.estadoGeneral, r.sucursal, r.supervisor, r.area, r.servicio, r.tipo, r.contratista, r.proveedor, r.proveedorAdjudicado, r.detalle, r.detalleSolicitud, r.fechaIngresoKey, r.fechaCierreKey].join('|'));
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }

  function selectOptionsFromRows(rows, getter, current, first){
    const vals = Array.from(new Set(rows.map(getter).filter(Boolean))).sort((a,b)=>String(a).localeCompare(String(b),'es'));
    return `<option value="">${esc(first || 'Todos')}</option>` + vals.map(v => `<option value="${esc(v)}" ${String(current || '') === String(v) ? 'selected' : ''}>${esc(v)}</option>`).join('');
  }

  function activeSubfilterChips(){
    const f = PM.tableFilters || {};
    const chips = [];
    if (f.fecha) chips.push(`Fecha: ${dateLabel(f.fecha) || f.fecha}`);
    if (f.estado) chips.push(`Estado: ${f.estado}`);
    if (f.supervisor) chips.push(`Supervisor: ${f.supervisor}`);
    if (f.tienda) chips.push(`Tienda: ${f.tienda}`);
    if (f.search) chips.push(`Búsqueda: ${f.search}`);
    return chips.map(c => `<span class="preventivos-chip">${esc(c)}</span>`).join('');
  }

  function renderPreventivosSubfilters(rows){
    const f = PM.tableFilters || {};
    return `
      <div class="preventivos-subfilters">
        <div class="field"><label>Subfiltro fecha</label><input type="date" value="${esc(f.fecha || '')}" onchange="setPreventivosTableFilter('fecha', this.value)"></div>
        <div class="field"><label>Subfiltro estado</label><select onchange="setPreventivosTableFilter('estado', this.value)">${selectOptionsFromRows(rows, r => tableFilterValue(r,'estado'), f.estado, 'Todos')}</select></div>
        <div class="field"><label>Subfiltro supervisor</label><select onchange="setPreventivosTableFilter('supervisor', this.value)">${selectOptionsFromRows(rows, r => tableFilterValue(r,'supervisor'), f.supervisor, 'Todos')}</select></div>
        <div class="field"><label>Subfiltro tienda</label><select onchange="setPreventivosTableFilter('tienda', this.value)">${selectOptionsFromRows(rows, r => tableFilterValue(r,'tienda'), f.tienda, 'Todas')}</select></div>
        <div class="field"><label>Buscar dentro de tabla</label><input type="text" value="${esc(f.search || '')}" placeholder="ID, tienda, supervisor..." oninput="setPreventivosTableFilter('search', this.value)"></div>
      </div>
      <div class="preventivos-active-subfilters">${activeSubfilterChips() || '<span style="font-family:var(--font-mono);font-size:11px;color:var(--muted);">Sin subfiltros internos aplicados.</span>'}</div>`;
  }

  window.setPreventivosTableFilter = function(key, value){
    PM.tableFilters[key] = value || '';
    PM.page = 1;
    renderPreventivosModal();
  };

  window.clearPreventivosTableFilters = function(){
    PM.tableFilters = { fecha: '', supervisor: '', tienda: '', estado: '', search: '' };
    PM.page = 1;
    renderPreventivosModal();
  };

  window.setPreventivosPageSize = function(value){
    PM.pageSize = Number(value) || 25;
    PM.page = 1;
    renderPreventivosModal();
  };

  window.setPreventivosPage = function(page){
    PM.page = Math.max(1, Number(page) || 1);
    renderPreventivosModal();
  };

  function renderPreventivosPagination(total){
    const size = Math.max(1, Number(PM.pageSize) || 25);
    const pages = Math.max(1, Math.ceil(total / size));
    PM.page = Math.min(Math.max(1, PM.page || 1), pages);
    const start = total ? ((PM.page - 1) * size + 1) : 0;
    const end = Math.min(total, PM.page * size);
    return `<div class="preventivos-pagination">
      <div>Mostrando <strong>${nfmt(start)}-${nfmt(end)}</strong> de <strong>${nfmt(total)}</strong> preventivos filtrados</div>
      <div class="preventivos-page-controls">
        <span>Ver</span>
        <select onchange="setPreventivosPageSize(this.value)">
          ${[10,25,50,100,200].map(n => `<option value="${n}" ${PM.pageSize == n ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
        <span>por página</span>
        <button class="preventivos-page-btn" type="button" onclick="setPreventivosPage(1)" ${PM.page<=1?'disabled':''}>«</button>
        <button class="preventivos-page-btn" type="button" onclick="setPreventivosPage(${PM.page-1})" ${PM.page<=1?'disabled':''}>‹</button>
        <span>Página <strong>${PM.page}</strong> / ${pages}</span>
        <button class="preventivos-page-btn" type="button" onclick="setPreventivosPage(${PM.page+1})" ${PM.page>=pages?'disabled':''}>›</button>
        <button class="preventivos-page-btn" type="button" onclick="setPreventivosPage(${pages})" ${PM.page>=pages?'disabled':''}>»</button>
      </div>
    </div>`;
  }

  function buildRowsForTable(rows){
    PM.detailMap.clear();

    return rows.map((r, idx) => {
      const fecha = primaryRowDate(r);
      const key = 'prev_' + idx + '_' + String(r.id || '').replace(/[^a-zA-Z0-9_-]/g,'');
      PM.detailMap.set(key, r);

      return `<tr>
        <td>${esc(r.id || '')}</td>
        <td>${esc(dateLabel(fecha) || '')}</td>
        <td>${esc(r.estadoGeneral || '')}</td>
        <td>${esc(r.supervisor || '')}</td>
        <td>${esc(r.sucursal || '')}</td>
        <td>${esc(r.servicio || '')}</td>
        <td>${esc(r.area || '')}</td>
        <td>${esc(r.contratista || r.proveedor || r.proveedorAdjudicado || '')}</td>
        <td><button class="detail-btn" type="button" onclick="openPreventivoDetail('${key}')">Ver</button></td>
      </tr>`;
    }).join('');
  }

  window.openPreventivoDetail = function(key){
    const r = PM.detailMap.get(key);
    if (!r) return;

    const modal = document.getElementById('preventivoFloatingDetail');
    const subtitle = document.getElementById('preventivoFloatingSubtitle');
    const body = document.getElementById('preventivoFloatingText');
    const bodyWrap = modal ? modal.querySelector('.preventivo-floating-body') : null;

    const detalle = r.detalleSolicitud || r.detalle || 'Sin detalle de solicitud registrado en D1GO.';
    const meta = [
      r.id ? `ID ${r.id}` : '',
      r.estadoGeneral || '',
      r.supervisor || '',
      r.sucursal || '',
      r.servicio || ''
    ].filter(Boolean).join(' · ');

    if (subtitle) subtitle.textContent = meta;
    if (body) body.textContent = detalle;
    if (bodyWrap) bodyWrap.scrollTop = 0;
    if (modal) {
      modal.classList.add('visible');
      modal.style.display = 'flex';
      setTimeout(() => {
        const closeBtn = modal.querySelector('button');
        if (closeBtn) closeBtn.focus({ preventScroll: true });
      }, 30);
    }
  };

  window.closePreventivoFloatingDetail = function(){
    const modal = document.getElementById('preventivoFloatingDetail');
    if (modal) {
      modal.classList.remove('visible');
      modal.style.display = 'none';
    }
  }

  window.renderPreventivosModal = function(){
    ensureModal();
    renderDaySelector();

    const baseRows = rowsAfterBaseFilters(false);
    const rows = applyDrill(baseRows);
    const tableRows = applyPreventivosTableSubfilters(rows);
    PM.lastRows = rows;
    PM.lastTableRows = tableRows;

    const total = tableRows.length;
    const size = Math.max(1, Number(PM.pageSize) || 25);
    const pages = Math.max(1, Math.ceil(total / size));
    PM.page = Math.min(Math.max(1, PM.page || 1), pages);
    const pagedRows = tableRows.slice((PM.page - 1) * size, PM.page * size);
    const abiertas = tableRows.filter(r => cycleStatus(r.estadoGeneral) === 'Abierta').length;
    const cerradas = tableRows.filter(r => cycleStatus(r.estadoGeneral) === 'Cerrada').length;
    const solicitadas = tableRows.filter(r => cycleStatus(r.estadoGeneral) === 'Solicitada').length;
    const pendientes = tableRows.filter(r => cycleStatus(r.estadoGeneral) === 'Pendiente').length;
    const sups = new Set(tableRows.map(r=>r.supervisor).filter(Boolean)).size;
    const tiendas = new Set(tableRows.map(r=>r.sucursal).filter(Boolean)).size;

    const estadoMap = countMap(baseRows, r => cycleStatus(r.estadoGeneral));
    const servicioMap = countMap(baseRows, r => r.servicio || 'Sin servicio');
    const supMap = countMap(baseRows, r => r.supervisor || 'Sin supervisor');
    const tiendaMap = countMap(baseRows, r => r.sucursal || 'Sin tienda');

    setFilterNote(total);

    const content = els().content;
    content.innerHTML = `
      <div class="preventivos-kpi-grid">
        <div class="preventivos-kpi ${!PM.currentDrill ? 'active' : ''}" onclick="clearPreventivosDrill()">
          <div class="label">Total preventivos</div>
          <div class="value">${nfmt(baseRows.length)}</div>
        </div>
        ${kpiCard('Abiertos', baseRows.filter(r => cycleStatus(r.estadoGeneral) === 'Abierta').length, 'estado', 'Abierta', 'bad')}
        ${kpiCard('Cerrados', baseRows.filter(r => cycleStatus(r.estadoGeneral) === 'Cerrada').length, 'estado', 'Cerrada', 'good')}
        ${kpiCard('Solicitados', baseRows.filter(r => cycleStatus(r.estadoGeneral) === 'Solicitada').length, 'estado', 'Solicitada', 'warn')}
        ${kpiCard('Pendientes', baseRows.filter(r => cycleStatus(r.estadoGeneral) === 'Pendiente').length, 'estado', 'Pendiente', 'warn')}
        <div class="preventivos-kpi"><div class="label">Supervisores visibles</div><div class="value">${nfmt(sups)}</div></div>
        <div class="preventivos-kpi"><div class="label">Tiendas visibles</div><div class="value">${nfmt(tiendas)}</div></div>
      </div>

      <div class="preventivos-grid">
        ${clickableTable('Preventivos por estado', estadoMap, 'estado')}
        ${clickableTable('Tipo de rutina / servicio', servicioMap, 'servicio')}
        ${clickableTable('Preventivos por supervisor', supMap, 'supervisor')}
        ${clickableTable('Preventivos por tienda', tiendaMap, 'tienda')}
        
      </div>

      <div id="preventivosMainTableWrap">
        <div class="preventivos-table-toolbar">
          <div>
            <h4>Tabla de preventivos</h4>
            <small>${esc(drillLabel())} · ${nfmt(rows.length)} registro(s) de la vista · ${nfmt(total)} después de subfiltros</small>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" type="button" onclick="clearPreventivosDrill()">Ver todos</button>
            <button class="btn btn-secondary btn-sm" type="button" onclick="clearPreventivosTableFilters()">Limpiar subfiltros</button>
            <button class="btn btn-secondary btn-sm" type="button" onclick="copyPreventivosIncidencias()">Copiar incidencias</button>
          </div>
        </div>
        ${renderPreventivosSubfilters(rows)}
        <div class="preventivos-table-wrap">
          <table class="preventivos-table" id="preventivosTable">
            <thead>
              <tr>
                <th>ID</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Supervisor</th>
                <th>Tienda</th>
                <th>Rutina / servicio columna G</th>
                <th>Área</th>
                <th>Contratista</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>${buildRowsForTable(pagedRows) || '<tr><td colspan="9">Sin preventivos para los filtros seleccionados.</td></tr>'}</tbody>
          </table>
        </div>
        ${renderPreventivosPagination(total)}
      </div>`;
  };

  window.openPreventivosModal = function(){
    ensureModal();
    if (!allRows().length) {
      info('Sin D1GO', 'Carga primero el archivo D1GO. El análisis de preventivos se construye desde la columna G / Servicio del archivo Excel.');
      return;
    }
    hydrateFilters();
    suggestedDates();
    bindAuto();
    const e = els();
    e.modal.style.display = 'block';
    renderPreventivosModal();
  };

  window.closePreventivosModal = function(){
    const e = els();
    if (e.modal) e.modal.style.display = 'none';
  };

  window.copyPreventivosTable = function(){
    const table = qs('preventivosTable');
    if (!table) return toastMsg('No hay tabla para copiar', 'error');
    const txt = Array.from(table.querySelectorAll('tr')).map(tr => Array.from(tr.children).map(td => td.innerText.replace(/\s+/g,' ').trim()).join('\t')).join('\n');
    navigator.clipboard?.writeText(txt).then(()=>toastMsg('Tabla de preventivos copiada ✅')).catch(()=>info('Copiar tabla','Selecciona la tabla y copia manualmente.'));
  };

  // Alias usado por los botones del módulo de preventivos.
  // Evita que el botón "Copiar incidencias" falle por referencia inexistente.
  window.copyPreventivosIncidencias = function(){
    const rows = PM.lastTableRows || [];
    const ids = Array.from(new Set(rows.map(r => String(r.id || '').trim()).filter(Boolean)));
    if (!ids.length) return toastMsg('No hay incidencias de preventivos para copiar', 'error');
    const txt = ids.join(',');
    navigator.clipboard?.writeText(txt)
      .then(()=>toastMsg(`${ids.length} incidencias de preventivos copiadas ✅`))
      .catch(()=>info('Copiar incidencias', txt));
  };

  window.exportPreventivosExcel = function(){
    if (typeof XLSX === 'undefined') return info('Exportar Excel','No se encontró la librería XLSX.');
    const rows = (PM.lastTableRows || []).map(r => ({
      ID: r.id || '',
      Fecha: dateLabel(primaryRowDate(r)) || '',
      Estado: r.estadoGeneral || '',
      Supervisor: r.supervisor || '',
      Tienda: r.sucursal || '',
      Servicio: r.servicio || '',
      Area: r.area || '',
      Contratista: r.contratista || r.proveedor || r.proveedorAdjudicado || '',
      Detalle: r.detalleSolicitud || r.detalle || ''
    }));
    if (!rows.length) return toastMsg('No hay preventivos para exportar', 'error');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Preventivos');
    XLSX.writeFile(wb, `preventivos_D1GO_${todayKey()}.xlsx`);
  };

  function bindAuto(){
    ['preventivosStart','preventivosEnd','preventivosDateType','preventivosSupervisorFilter','preventivosEstadoFilter','preventivosTipoFilter','preventivosTiendaFilter'].forEach(id => {
      const el = qs(id);
      if (el && !el.dataset.preventivosBound) {
        el.dataset.preventivosBound = '1';
        el.addEventListener('change', function(){
          PM.currentDrill = null;
          PM.page = 1;
          const isDateControl = ['preventivosStart','preventivosEnd','preventivosDateType'].includes(id);
          if (isDateControl) PM.manualDaysTouched = false;
          hydrateFilters();
          renderPreventivosModal();
        });
      }
    });
    const search = qs('preventivosSearchInput');
    if (search && !search.dataset.preventivosBound) {
      search.dataset.preventivosBound = '1';
      search.addEventListener('input', function(){
        PM.currentDrill = null;
        PM.page = 1;
        renderPreventivosModal();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    ensureModal();
    ensureButton();
    setTimeout(ensureButton, 500);
    setTimeout(ensureButton, 1500);
    document.addEventListener('click', function(ev){
      const modal = qs('preventivosModal');
      if (modal && ev.target === modal) closePreventivosModal();
      const floating = document.getElementById('preventivoFloatingDetail');
      if (floating && ev.target === floating) closePreventivoFloatingDetail();
    });
  });
})();
