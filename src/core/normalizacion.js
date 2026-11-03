/* ── UTILS ── */
function normalizeText(v) {
  return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function onlyDigits(v) { return String(v ?? '').replace(/\D+/g, ''); }

function parseIncidencias(v) {
  return String(v ?? '').split(',').map(s => onlyDigits(s)).filter(Boolean);
}

function escapeHtml(t) {
  return String(t ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function formatCurrency(v) {
  const num = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  if (isNaN(num)) return String(v) || '—';
  return new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 }).format(num);
}

function formatNumber(v) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(v || 0);
}

function toNumber(v) {
  const raw = String(v ?? '').trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d.,-]/g, '');
  if (!cleaned) return 0;
  const hasComma = cleaned.includes(','), hasDot = cleaned.includes('.');
  let norm = cleaned;
  if (hasComma && hasDot) norm = cleaned.replace(/\./g,'').replace(',','.');
  else if (hasComma && !hasDot) norm = cleaned.replace(',','.');
  const n = Number(norm);
  return isNaN(n) ? 0 : n;
}

function valueByExactOrContains(row, candidates) {
  const entries = Object.entries(row || {});
  for (const [k, v] of entries) {
    const nk = normalizeText(k);
    if (candidates.some(c => nk === normalizeText(c))) return v;
  }
  for (const [k, v] of entries) {
    const nk = normalizeText(k);
    if (candidates.some(c => nk.includes(normalizeText(c)))) return v;
  }
  return '';
}

function isMeaningful(v) { return v !== undefined && v !== null && String(v).trim() !== ''; }


function formatDateOnly(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function formatDateValue(v) {
  if (!v) return '';
  if (v instanceof Date && !isNaN(v)) return formatDateOnly(v);
  if (typeof v === 'number' && Number.isFinite(v) && v > 20000 && v < 80000) {
    const p = XLSX.SSF.parse_date_code(v);
    if (p) return formatDateOnly(new Date(p.y, p.m - 1, p.d));
  }
  const s = String(v).trim();
  if (!s) return '';
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:\s+.*)?$/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return formatDateOnly(new Date(y, Number(m[2]) - 1, Number(m[1])));
  }
  m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:[T\s].*)?$/);
  if (m) return formatDateOnly(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const d = new Date(s);
  if (!isNaN(d.getTime()) && s.length > 4) return formatDateOnly(d);
  return s;
}


function formatCycleVisibleDate(row) {
  if (!row) return '';
  // Esta es la fecha que realmente ubica el caso en el ciclo corto:
  // cerradas por fecha de cierre; abiertas/solicitadas por fecha de solicitud.
  return formatDateLabelFromKey(row.cicloFechaKey)
    || formatDateOnly(row.fechaIngresoDate)
    || formatDateValue(row.fechaIngreso)
    || '';
}

function hasRealCloseDate(row) {
  if (!row) return false;
  const raw = normalizeText(row.fechaCierre || '');
  if (!raw) return !!row.fechaCierreKey || !!row.fechaCierreDate;
  if (raw.includes('sin resp') || raw.includes('sin cierre') || raw.includes('no aplica') || raw === 'na' || raw === 'n/a') return false;
  return !!(row.fechaCierreKey || row.fechaCierreDate || parseFlexibleDate(row.fechaCierre));
}

function formatCycleCloseDate(row) {
  if (!row || !hasRealCloseDate(row)) {
    const estado = normalizeCycleStatus(row?.estadoGeneral || '');
    if (estado && estado !== 'Cerrada') return '';
    return '';
  }
  const byDate = formatDateOnly(row.fechaCierreDate) || formatDateLabelFromKey(row.fechaCierreKey);
  if (byDate) return byDate;
  const parsedRaw = parseFlexibleDate(row.fechaCierre);
  const byRaw = formatDateOnly(parsedRaw);
  if (byRaw) return byRaw;
  return '';
}


function parseOcDateValue(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  if (typeof v === 'number' && Number.isFinite(v) && v > 20000 && v < 80000) {
    const p = XLSX.SSF.parse_date_code(v);
    if (p) return new Date(p.y, p.m - 1, p.d);
  }
  const s = String(v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
    if (!isNaN(d)) return d;
  }
  m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!isNaN(d)) return d;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return null;
}

function getOcAgeDays(row) {
  const d = parseOcDateValue(row?.fechaDocumento);
  if (!d) return null;
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.floor((base - d) / 86400000));
}

function getOcAgeAlertInfo(row) {
  const days = getOcAgeDays(row);
  if (days === null || days < 30) return { cls: 'ok', rowCls: '', label: '—', days };
  if (days >= 60) return { cls: 'crit', rowCls: 'oc-age-crit', label: `🔴 +60 días (${days})`, days };
  return { cls: 'warn', rowCls: 'oc-age-warn', label: `🟡 +30 días (${days})`, days };
}

function countX(v) {
  const t = String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  if (!t) return 0;
  const m = t.match(/x/gi);
  return m ? m.length : 0;
}

function limpiarIncidencia(v) {
  const raw = String(v ?? '').trim().toUpperCase();
  if (!raw) return '';
  if (raw.startsWith('ST')) return raw.replace(/^ST/,'').replace(/\D+/g,'');
  if (raw.startsWith('IBA')) return raw.replace(/^IBA/,'').replace(/\D+/g,'');
  return raw.replace(/\D+/g,'');
}

function parseTextoBreve(texto) {
  const raw = String(texto ?? '').trim();
  const result = { tipoIncidencia:'', incidencia:'', tipoServicio:'', tipoGasto:'', cotizacion:'', descripcion:'' };
  if (!raw) return result;
  const partes = raw.split('_').map(p => String(p||'').trim()).filter(Boolean);
  result.tipoIncidencia = partes[0] || '';
  result.incidencia = limpiarIncidencia(partes[1] || '');
  result.tipoServicio = partes[2] || '';
  result.tipoGasto = partes[3] || '';
  let descripcionPartes = [];
  for (let i = 4; i < partes.length; i++) {
    const upper = partes[i].toUpperCase();
    if (upper === 'COT') { result.cotizacion = (partes[i+1]||'').trim(); descripcionPartes = partes.slice(i+2); break; }
    if (upper.startsWith('COT-')) { result.cotizacion = partes[i].substring(4).trim(); descripcionPartes = partes.slice(i+1); break; }
  }
  if (!result.cotizacion && partes.length > 4) descripcionPartes = partes.slice(4);
  result.descripcion = descripcionPartes.join('_').trim();
  return result;
}

function getDocumentoCompras(row) { return valueByExactOrContains(row, ['documento compras']); }
function getTextoBreve(row) { return valueByExactOrContains(row, ['texto breve','texto']); }
function getLiberacion(row) {
  const entries = Object.entries(row || {});
  const pri = ['ind. liberacion','ind. liberación','ind liberacion','ind liberación','indicador liberacion','indicador liberación','estado liberacion','estado liberación','liberacion','liberación'];
  for (const [k,v] of entries) { const nk = normalizeText(k).replace(/\s+/g,' ').trim(); if (pri.some(c => nk===normalizeText(c))) return v; }
  for (const [k,v] of entries) { const nk = normalizeText(k).replace(/\s+/g,' ').trim(); if (nk.includes('liberacion')||nk.includes('liberación')||nk.includes('ind liber')||nk.includes('indicador liber')) return v; }
  return '';
}
function getFechaDocumento(row) { return valueByExactOrContains(row, ['fecha documento']); }
function getIndicadorBorrado(row) { return String(valueByExactOrContains(row, ['indicador de borrado'])??'').trim(); }
function getPorCalcular(row) { return valueByExactOrContains(row, ['por calcular (valor)','por calcular']); }
function getPorEntregarValor(row) { return valueByExactOrContains(row, ['por entregar (valor)','por entregar valor']); }
function getPorEntregarCantidad(row) { return valueByExactOrContains(row, ['por entregar (cantidad)','por entregar cantidad']); }
function getTipoImputacion(row) { return valueByExactOrContains(row, ['tipo de imputación','tipo de imputacion']); }

function classifyFinancialView(porEntregarValorValue, porEntregarCantidadValue, tipoImputacionValue) {
  const pev = toNumber(porEntregarValorValue);
  const pec = toNumber(porEntregarCantidadValue);
  const ti = normalizeText(tipoImputacionValue);
  if (pev === 0 && pec === 0) return 'facturadas';
  if ((pev !== 0 || pec !== 0) && ti === 'a') return 'activos';
  if (pev !== 0 || pec !== 0) return 'pendientes';
  return 'sheet1';
}


function normalizeCECO(v) {
  const s = String(v ?? '').toUpperCase().replace(/\s+/g, '').trim();
  if (!s) return '';
  const tienda = s.match(/6A18T\d{5}/i);
  if (tienda) return tienda[0].toUpperCase();
  const cedi = s.match(/6A18C\d{5}/i);
  if (cedi) return cedi[0].toUpperCase();
  return s;
}

function normalizarAlmacen(v) {
  const dig = onlyDigits(v);
  if (!dig) return '';
  return dig.padStart(4, '0').slice(-4);
}

function construirCECOPorCentroAlmacen(centro, almacen) {
  const centroNorm = String(centro ?? '').toUpperCase().replace(/\s+/g, '').trim();
  const alm = normalizarAlmacen(almacen);
  if (centroNorm !== '6A18' || !alm) return '';
  // En SAP el archivo puede traer Centro = 6A18 y Almacén = 0062.
  // Para tiendas se convierte a 6A18T00062. Para CEDI 0900 se convierte a 6A18C00900.
  if (alm === '0900') return '6A18C00900';
  return '6A18T' + alm.padStart(5, '0');
}

function getAlmacen(row) {
  return valueByExactOrContains(row, ['almacén','almacen']);
}

function getCentroCosteSAP(row) {
  const centroRaw = valueByExactOrContains(row, ['centro']);
  const almacenRaw = getAlmacen(row);

  let ceco = valueByExactOrContains(row, [
    'centro de costo sap','centro de coste sap','ceco sap',
    'centro de coste','centro de costo','ceco'
  ]);
  ceco = normalizeCECO(ceco);

  if (!ceco || ceco === '6A18') {
    const derivado = construirCECOPorCentroAlmacen(centroRaw || ceco, almacenRaw);
    if (derivado) ceco = derivado;
  }

  if (ceco && (DIRECTORIO_CECO[ceco] || /^6A18C\d{5}$/.test(ceco))) return ceco;

  for (const v of Object.values(row || {})) {
    const possible = normalizeCECO(v);
    if (possible && DIRECTORIO_CECO[possible]) return possible;
  }

  const derivadoFinal = construirCECOPorCentroAlmacen(centroRaw, almacenRaw);
  return derivadoFinal || ceco;
}

function tiendaDebeCompletarse(tienda, ceco) {
  const t = String(tienda ?? '').trim();
  if (!t) return true;
  const nt = normalizeCECO(t);
  if (nt === ceco) return true;
  if (/^6A18$/i.test(t) || /^6A18T\d{5}$/i.test(t)) return true;
  if (/^\d{4,6}$/.test(t)) return true;
  return false;
}

function esValorCEDI6A18(v) {
  const t = String(v ?? '').toUpperCase().replace(/\s+/g, '').trim();
  return t === 'CEDI' || t === 'CENDIS' || t === 'CENTRODEDISTRIBUCION' || /^6A18C\d{5}$/.test(t);
}

function esCECOCEDI(ceco) {
  const t = normalizeCECO(ceco);
  return /^6A18C\d{5}$/.test(t) || t === 'CEDI' || t === 'CENDIS' || t === 'CENTRODEDISTRIBUCION';
}

function aplicarFallbackCEDI(norm, motivo = 'CEDI automático') {
  const tiendaActual = String(norm.tienda || '').trim();
  const supervisorActual = String(norm.supervisor || '').trim();
  const gerenteActual = String(norm.gerente || '').trim();
  const cecoActual = normalizeCECO(norm.centroCoste);

  const sinTiendaReal = !tiendaActual || esValorCEDI6A18(tiendaActual) || tiendaActual.toUpperCase().replace(/\s+/g,'').trim() === '6A18';
  const sinSupervisorReal = !supervisorActual || esValorCEDI6A18(supervisorActual);
  const sinGerenteReal = !gerenteActual || esValorCEDI6A18(gerenteActual);
  const pareceCEDI = esCECOCEDI(cecoActual) || (D1_FLAGS.inferirCEDISinCECO && !cecoActual && sinTiendaReal && sinSupervisorReal);

  // Regla segura: CEDI se asigna cuando el CECO derivado es 6A18Cxxxxx
  // NO se infiere CEDI por datos vacíos, salvo habilitar explícitamente el modo legado. Nunca reemplaza datos reales existentes.
  if (pareceCEDI) {
    if (sinTiendaReal) norm.tienda = 'CEDI IBAGUE';
    if (sinSupervisorReal) norm.supervisor = 'SIN ASIGNAR';
    if (sinGerenteReal) norm.gerente = 'CEDI';
    norm.origenDirectorio = motivo;
    state.cecoStats.cediAutomaticos = (state.cecoStats.cediAutomaticos || 0) + 1;
  }
  return norm;
}

function enriquecerConDirectorioCECO(norm) {
  const ceco = normalizeCECO(norm.centroCoste);
  if (esCECOCEDI(ceco)) {
    norm.centroCoste = ceco || norm.centroCoste;
    return aplicarFallbackCEDI(norm, 'CEDI por CECO/almacén');
  }

  if (!ceco || !DIRECTORIO_CECO[ceco]) {
    if (ceco) state.cecoStats.noEncontrados++;
    completarSupervisorPorGerente(norm, 'Supervisor por gerente');
    return aplicarFallbackCEDI(norm, 'CEDI automático');
  }

  const info = DIRECTORIO_CECO[ceco];
  state.cecoStats.filasConCECO++;
  norm.centroCoste = ceco;
  norm.directorioGerente = info.gerente || '';
  norm.directorioJefeZona = info.jefeZona || '';
  norm.directorioCiudad = info.ciudad || '';
  norm.directorioDepartamento = info.departamento || '';
  norm.origenDirectorio = '';

  if (tiendaDebeCompletarse(norm.tienda, ceco)) {
    norm.tienda = info.tienda || norm.tienda;
    norm.origenDirectorio += 'Tienda ';
    state.cecoStats.completadasTienda++;
  }

  if (!String(norm.gerente || '').trim()) norm.gerente = info.gerente || '';

  if (!String(norm.supervisor || '').trim()) {
    norm.supervisor = getSupervisorPorGerente(info.gerente || norm.gerente) || info.supervisor || norm.supervisor;
    if (String(norm.supervisor || '').trim()) {
      norm.origenDirectorio += 'Supervisor ';
      state.cecoStats.completadasSupervisor++;
    }
  }

  completarSupervisorPorGerente(norm, 'Supervisor por gerente/directorio');
  norm.origenDirectorio = norm.origenDirectorio.trim() || 'Archivo original';
  return norm;
}

function normalizeRow(row, index) {
  const dc = getDocumentoCompras(row), tb = getTextoBreve(row);
  const tbd = parseTextoBreve(tb), libRaw = getLiberacion(row);
  const precio = valueByExactOrContains(row, ['precio neto','importe neto']);
  const fecha = getFechaDocumento(row);
  const indBorrado = getIndicadorBorrado(row);
  const porCalc = getPorCalcular(row);
  const pev = getPorEntregarValor(row);
  const pec = getPorEntregarCantidad(row);
  const ti = getTipoImputacion(row);
  const isDeleted = normalizeText(indBorrado) === 'l';
  const norm = {
    rowIndex: index + 1,
    oc: dc, ocDigits: onlyDigits(dc),
    textoBreve: tb,
    tipoIncidencia: tbd.tipoIncidencia, incidencia: tbd.incidencia,
    tipoServicio: tbd.tipoServicio, tipoGasto: tbd.tipoGasto,
    cotizacion: tbd.cotizacion, descripcionBreve: tbd.descripcion,
    fechaDocumento: fecha, indicadorBorrado: indBorrado,
    isDeleted, estadoRegistro: isDeleted ? 'Borrado (L)' : 'Activo',
    porCalcular: porCalc, porEntregarValor: pev, porEntregarCantidad: pec,
    tipoImputacion: ti,
    viewGroup: classifyFinancialView(pev, pec, ti),
    liberacion: String(libRaw??'').trim(), xLiberacion: countX(libRaw),
    proveedor: valueByExactOrContains(row, ['nombre del proveedor','proveedor']),
    tienda: valueByExactOrContains(row, ['tienda','centro']),
    centroCoste: getCentroCosteSAP(row),
    almacen: getAlmacen(row),
    gerente: valueByExactOrContains(row, ['gerente']),
    valorPrincipal: precio,
    supervisor: valueByExactOrContains(row, ['supervisor','responsable','jefe']),
    rawPrecioNeto: toNumber(precio),
    rawPorCalcular: toNumber(porCalc),
    rawPorEntregarValor: toNumber(pev),
    rawPorEntregarCantidad: toNumber(pec)
  };
  return enriquecerConDirectorioCECO(norm);
}

function validateRequiredColumns(rows) {
  const headers = Object.keys(rows[0]||{}).map(normalizeText);
  const required = [
    { label:'Documento compras', opts:['documento compras'] },
    { label:'Texto breve', opts:['texto breve','texto'] },
    { label:'Por entregar (valor)', opts:['por entregar (valor)','por entregar valor'] },
    { label:'Por entregar (cantidad)', opts:['por entregar (cantidad)','por entregar cantidad'] }
  ];
  const missing = required.filter(r => !headers.some(h => r.opts.some(o => h===normalizeText(o)||h.includes(normalizeText(o)))));
  if (missing.length) throw new Error('Faltan columnas: ' + missing.map(m=>m.label).join(', '));
}
