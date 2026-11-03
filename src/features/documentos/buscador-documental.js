
// La edición pública no incluye enlaces salientes a webhooks privados.
function enviarDatosN8N(_datos) {
  console.warn('Integración n8n deshabilitada en la edición pública.');
}

/* ── BUSCADOR DOCUMENTAL LOCAL / ONEDRIVE SIN AZURE ──
   Esta versión NO usa Azure, Microsoft Graph ni permisos de administrador.
   Funciona seleccionando una carpeta local sincronizada, por ejemplo:
   OneDrive/Proveedores. Luego busca recursivamente en subcarpetas por
   incidencia, cotización, OC o números encontrados en el texto breve.
*/
let carpetaDocumentalHandle = null;
let archivosDocumentales = [];
let archivosResultadoActual = [];
let documentoPreviewUrlActual = null;
let carpetaDocumentalNombre = '';

function setOneDriveStatus(msg, ok = false) {
  const el = document.getElementById('msStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = ok ? 'onedrive-status-ok' : 'onedrive-status-warn';
}

function soportaCarpetasLocales() {
  return !!window.showDirectoryPicker;
}

async function vincularCarpetaDocumental() {
  if (!soportaCarpetasLocales()) {
    showInfoDialog(
      'Navegador no compatible',
      'Esta función necesita Google Chrome o Microsoft Edge actualizado. Abre el HTML con Live Server o desde GitHub Pages, no con doble clic.'
    );
    return;
  }

  try {
    carpetaDocumentalHandle = await window.showDirectoryPicker({ mode: 'read' });
    carpetaDocumentalNombre = carpetaDocumentalHandle.name || 'Carpeta documental';
    await indexarCarpetaDocumental();
  } catch (err) {
    if (err && err.name === 'AbortError') {
      setOneDriveStatus('No seleccionaste ninguna carpeta.', false);
      return;
    }
    showInfoDialog('Error vinculando carpeta', err.message || 'No se pudo vincular la carpeta documental.');
  }
}

async function refrescarCarpetaDocumental() {
  if (!carpetaDocumentalHandle) {
    showInfoDialog('Sin carpeta', 'Primero vincula la carpeta documental.');
    return;
  }
  await indexarCarpetaDocumental();
}

async function indexarCarpetaDocumental() {
  try {
    showLoading('Leyendo carpeta documental...');
    archivosDocumentales = [];
    await recorrerCarpetaDocumental(carpetaDocumentalHandle, carpetaDocumentalNombre);

    const total = archivosDocumentales.length;
    setOneDriveStatus(`Carpeta vinculada: ${carpetaDocumentalNombre} · ${total} archivos indexados.`, true);

    const refreshBtn = document.getElementById('docFolderRefreshBtn');
    if (refreshBtn) refreshBtn.style.display = 'inline-flex';

    toast(`Carpeta documental lista: ${total} archivos ✅`, 'success');
  } catch (err) {
    showInfoDialog('Error leyendo carpeta', err.message || 'No se pudo leer la carpeta.');
  } finally {
    hideLoading();
  }
}

async function recorrerCarpetaDocumental(dirHandle, ruta = '') {
  for await (const [nombre, handle] of dirHandle.entries()) {
    const rutaCompleta = ruta ? `${ruta}/${nombre}` : nombre;

    if (handle.kind === 'file') {
      const ext = nombre.split('.').pop().toLowerCase();
      const extensionesUtiles = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'xlsx', 'xls', 'docx', 'doc', 'txt'];
      if (extensionesUtiles.includes(ext)) {
        archivosDocumentales.push({ nombre, ruta: rutaCompleta, handle, ext });
      }
    }

    if (handle.kind === 'directory') {
      await recorrerCarpetaDocumental(handle, rutaCompleta);
    }
  }
}

function getOCRowByIndex(rowIndex) {
  const all = [];
  Object.keys(state.rowsByView || {}).forEach(k => all.push(...(state.rowsByView[k] || [])));
  return all.find(r => Number(r.rowIndex) === Number(rowIndex));
}

function limpiarBusquedaDocumental(valor) {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extraerNumerosDocumentales(valor) {
  return String(valor || '').match(/\d{4,}/g) || [];
}

function agregarTerminoDocumental(lista, valor) {
  const limpio = String(valor || '').trim();
  if (!limpio || limpio === '—') return;

  if (!lista.includes(limpio)) lista.push(limpio);

  extraerNumerosDocumentales(limpio).forEach(n => {
    if (!lista.includes(n)) lista.push(n);
  });
}

function agregarTerminoObjetoDocumental(lista, tipo, etiqueta, valor, prioridad = 1) {
  const limpio = String(valor || '').trim();
  if (!limpio || limpio === '—') return;

  const numeros = extraerNumerosDocumentales(limpio)
    .filter(n => n.length >= 4);

  const valores = numeros.length ? numeros : [limpio];

  valores.forEach(v => {
    const key = `${tipo}:${v}`;
    if (!lista.some(x => x.key === key)) {
      lista.push({ key, tipo, etiqueta, valor: v, original: limpio, prioridad });
    }
  });
}

function getPossibleFacturaFromRow(row) {
  const posibles = [
    row.factura,
    row.Factura,
    row['No Factura'],
    row['Número Factura'],
    row.numeroFactura,
    row.nFactura
  ];
  return posibles.find(Boolean) || '';
}

function buildLocalSearchTerms(row) {
  const terms = [];

  // Búsqueda principal: incidencia y OC.
  agregarTerminoObjetoDocumental(terms, 'inc', 'Incidencia', row.incidencia, 3);
  agregarTerminoObjetoDocumental(terms, 'oc', 'OC', row.oc, 3);
  agregarTerminoObjetoDocumental(terms, 'oc', 'OC', row.ocDigits, 3);

  // Búsqueda adicional si la fila trae factura. No aparece como campo obligatorio,
  // pero si existe en algún Excel, ayuda a ubicar la factura exacta del caso.
  const factura = getPossibleFacturaFromRow(row);
  agregarTerminoObjetoDocumental(terms, 'factura', 'Factura del caso', factura, 2);

  return terms.slice(0, 10);
}

function esDocumentoFactura(archivo) {
  return /(^|[^a-z])(fact|fac|factura|fv|invoice|fe)([^a-z]|$)/i.test(archivo.nombre);
}

function esDocumentoSoporte(archivo) {
  return /(acta|evid|evidencia|soporte|recibo|cotiz|cotizacion|cotización)/i.test(archivo.nombre);
}

function contieneNumeroExacto(texto, numero) {
  const n = String(numero || '').replace(/\D/g, '');
  if (!n || n.length < 4) return false;

  // Evita falsos positivos fuertes: 12345 no debe coincidir dentro de 9123458.
  const re = new RegExp(`(^|\\D)${n}(?=\\D|$)`);
  return re.test(texto);
}

function analizarCoincidenciaArchivo(archivo, terms) {
  const nombreRaw = String(archivo.nombre || '');
  const rutaRaw = String(archivo.ruta || '');
  const nombrePlano = limpiarBusquedaDocumental(nombreRaw);
  const rutaPlano = limpiarBusquedaDocumental(rutaRaw);
  const nombreCompacto = nombrePlano.replace(/\s+/g, '');
  const rutaCompacta = rutaPlano.replace(/\s+/g, '');
  const rutaNumeroSafe = rutaRaw.toLowerCase();
  const nombreNumeroSafe = nombreRaw.toLowerCase();

  let score = 0;
  const matches = [];

  terms.forEach(term => {
    const valor = String(term.valor || '').trim();
    const valorLimpio = limpiarBusquedaDocumental(valor);
    const valorCompacto = valorLimpio.replace(/\s+/g, '');
    const numero = String(valor).replace(/\D/g, '');
    let puntos = 0;
    let zona = '';

    if (numero && contieneNumeroExacto(nombreNumeroSafe, numero)) {
      puntos += 45;
      zona = 'nombre del archivo';
    } else if (numero && contieneNumeroExacto(rutaNumeroSafe, numero)) {
      puntos += 10;
      zona = 'ruta/carpeta';
    } else if (valorCompacto && valorCompacto.length >= 5 && nombreCompacto.includes(valorCompacto)) {
      puntos += 26;
      zona = 'nombre del archivo';
    } else if (valorCompacto && valorCompacto.length >= 5 && rutaCompacta.includes(valorCompacto)) {
      puntos += 6;
      zona = 'ruta/carpeta';
    }

    if (puntos > 0) {
      puntos *= term.prioridad || 1;
      score += puntos;
      matches.push({
        tipo: term.tipo,
        etiqueta: term.etiqueta,
        valor,
        zona,
        puntos
      });
    }
  });

  if (matches.length > 1) score += 20;
  if (archivo.ext === 'pdf') score += 8;
  if (esDocumentoFactura(archivo)) {
    score += 10;
    matches.push({ tipo: 'tipo', etiqueta: 'Tipo', valor: 'Factura', zona: 'nombre del archivo', puntos: 10 });
  } else if (esDocumentoSoporte(archivo)) {
    score += 5;
    matches.push({ tipo: 'tipo', etiqueta: 'Tipo', valor: 'Soporte/Cotización/Acta', zona: 'nombre del archivo', puntos: 5 });
  }

  return { score, matches };
}

async function buscarDocumentosLocalesOC(rowIndex) {
  const row = getOCRowByIndex(rowIndex);
  if (!row) {
    showInfoDialog('Sin datos', 'No encontré la fila de OC para buscar documentos.');
    return;
  }

  if (!archivosDocumentales.length) {
    showInfoDialog(
      'Primero vincula la carpeta',
      'Haz clic en “📁 Vincular carpeta documental” y selecciona la carpeta principal donde están las facturas, por ejemplo OneDrive/Proveedores.'
    );
    return;
  }

  const terms = buildLocalSearchTerms(row);
  if (!terms.length) {
    showInfoDialog('Sin datos de búsqueda', 'Esta fila no tiene número de incidencia ni número de OC para buscar documentos.');
    return;
  }

  showLoading('Buscando documentos por incidencia y OC...');

  try {
    let encontrados = archivosDocumentales
      .map(a => {
        const analisis = analizarCoincidenciaArchivo(a, terms);
        return { ...a, _score: analisis.score, _matches: analisis.matches };
      })
      .filter(a => a._score > 0 && (a._matches || []).some(m => ['inc', 'oc', 'factura'].includes(m.tipo)))
      .sort((a, b) => b._score - a._score)
      .slice(0, 80);

    if (!encontrados.length) {
      const usados = terms.map(t => `${t.etiqueta}: ${t.valor}`).join(', ');
      showInfoDialog(
        'Sin documentos encontrados',
        `No encontré archivos para Incidencia: ${escapeHtml(row.incidencia || '—')} u OC: ${escapeHtml(row.oc || '—')}.<br><br>Busqué por: <strong>${escapeHtml(usados)}</strong>`
      );
      return;
    }

    mostrarDocumentosLocales(encontrados, row, terms);
  } finally {
    hideLoading();
  }
}

async function abrirDocumentoLocal(index) {
  const archivo = archivosResultadoActual[index];
  if (!archivo) return;

  try {
    showLoading('Preparando vista previa del documento...');
    const file = await archivo.handle.getFile();
    await mostrarVistaPreviaDocumento(file, archivo);
  } catch (err) {
    showInfoDialog('No se pudo visualizar', err.message || 'El navegador no permitió mostrar este archivo.');
  } finally {
    hideLoading();
  }
}

function limpiarUrlPreviewDocumento() {
  if (documentoPreviewUrlActual) {
    URL.revokeObjectURL(documentoPreviewUrlActual);
    documentoPreviewUrlActual = null;
  }
}

function cerrarPreviewDocumentoLocal() {
  limpiarUrlPreviewDocumento();
  if (dialogOverlay) dialogOverlay.classList.remove('doc-dialog');
  hideDialog();
}

async function mostrarVistaPreviaDocumento(file, archivo) {
  const ext = String(archivo.ext || '').toLowerCase();
  const nombre = archivo.nombre || file.name || 'Documento';
  const ruta = archivo.ruta || nombre;
  let body = '';

  limpiarUrlPreviewDocumento();

  if (['pdf'].includes(ext)) {
    documentoPreviewUrlActual = URL.createObjectURL(file);
    body = `<iframe class="doc-viewer-frame" src="${documentoPreviewUrlActual}#toolbar=1"></iframe>`;
  } else if (['jpg','jpeg','png','webp'].includes(ext)) {
    documentoPreviewUrlActual = URL.createObjectURL(file);
    body = `<img class="doc-viewer-img" src="${documentoPreviewUrlActual}" alt="${escapeHtml(nombre)}">`;
  } else if (['txt','csv'].includes(ext)) {
    const text = await file.text();
    body = `<pre class="doc-text-preview">${escapeHtml(text.slice(0, 200000))}</pre>`;
  } else if (['xlsx','xls'].includes(ext)) {
    body = await construirPreviewExcel(file);
  } else {
    body = `<div class="empty-state"><span class="icon">📄</span>Este tipo de archivo (${escapeHtml(ext.toUpperCase() || 'sin extensión')}) no tiene vista previa segura dentro del navegador.<br><br>Para evitar descargas accidentales, no lo abro automáticamente. Usa “Copiar ruta” y ábrelo directamente desde OneDrive/Explorador cuando lo necesites.</div>`;
  }

  dialogOverlay.classList.add('doc-dialog');
  dialogTitle.style.display = 'none';
  dialogActions.style.display = 'none';
  dialogMessage.innerHTML = `
    <div class="dialog-box doc-viewer-box">
      <div class="doc-viewer-head">
        <div>
          <div class="doc-viewer-title">${escapeHtml(nombre)}</div>
          <div class="doc-viewer-path">${escapeHtml(ruta)}</div>
        </div>
        <button class="doc-close-btn" type="button" onclick="cerrarPreviewDocumentoLocal()" title="Cerrar">×</button>
      </div>
      <div class="doc-viewer-body">
        <div class="doc-preview-note">Vista previa dentro del aplicativo. No se descarga una copia del archivo; se lee desde la carpeta vinculada.</div>
        ${body}
      </div>
    </div>`;
  dialogOverlay.style.display = 'flex';
}

async function construirPreviewExcel(file) {
  if (typeof XLSX === 'undefined') {
    return '<div class="empty-state">No está disponible la librería XLSX para previsualizar este archivo.</div>';
  }
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return '<div class="empty-state">El Excel no tiene hojas para mostrar.</div>';
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }).slice(0, 80);
  if (!data.length) return '<div class="empty-state">La primera hoja está vacía.</div>';
  const maxCols = Math.min(18, Math.max(...data.map(r => r.length)) || 1);
  const header = data[0] || [];
  const ths = Array.from({length:maxCols}, (_,i)=>`<th>${escapeHtml(header[i] || `Col ${i+1}`)}</th>`).join('');
  const rows = data.slice(1).map(r => `<tr>${Array.from({length:maxCols}, (_,i)=>`<td>${escapeHtml(r[i] ?? '')}</td>`).join('')}</tr>`).join('');
  return `<div class="doc-preview-note">Excel: ${escapeHtml(sheetName)} · mostrando máximo 80 filas y 18 columnas para que no se congele el navegador.</div><div class="doc-preview-table-wrap"><table class="doc-preview-table"><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function copiarRutaDocumentoLocal(index) {
  const archivo = archivosResultadoActual[index];
  if (!archivo) return;
  navigator.clipboard?.writeText(archivo.ruta || archivo.nombre || '')
    .then(() => toast('Ruta copiada ✅', 'success'))
    .catch(() => showInfoDialog('Ruta del archivo', escapeHtml(archivo.ruta || archivo.nombre || '')));
}

function cerrarDialogDocumental() {
  limpiarUrlPreviewDocumento();
  if (dialogOverlay) dialogOverlay.classList.remove('doc-dialog');
  hideDialog();
}

function showHtmlDialog(title, html) {
  dialogOverlay.classList.add('doc-dialog');
  dialogTitle.style.display = 'none';
  dialogActions.style.display = 'none';
  dialogMessage.innerHTML = `
    <div class="doc-dialog-head">
      <div>
        <h3>${escapeHtml(title)}</h3>
        <div style="font-family:var(--font-mono);font-size:11px;color:var(--muted);margin-top:4px;">Usa la rueda del mouse para desplazarte. El botón de cerrar siempre queda arriba.</div>
      </div>
      <button class="doc-close-btn" type="button" onclick="cerrarDialogDocumental()" title="Cerrar">×</button>
    </div>
    <div class="doc-results-scroll">${html}</div>
  `;
  dialogOverlay.style.display = 'flex';
}

function renderMatchBadges(matches) {
  const principales = (matches || []).filter(m => ['inc', 'oc', 'factura', 'tipo'].includes(m.tipo));
  return principales.map(m => {
    const cls = m.tipo === 'inc' ? 'inc' : m.tipo === 'oc' ? 'oc' : m.tipo === 'factura' ? 'factura' : 'tipo';
    const zona = m.zona ? ` · ${m.zona}` : '';
    return `<span class="doc-match-badge ${cls}">${escapeHtml(m.etiqueta)}: ${escapeHtml(m.valor)}${escapeHtml(zona)}</span>`;
  }).join('');
}

function mostrarDocumentosLocales(encontrados, row, terms) {
  archivosResultadoActual = encontrados;

  const termsHtml = terms.map(t => `
    <div class="doc-summary-pill">
      ${escapeHtml(t.etiqueta)}
      <strong>${escapeHtml(t.valor)}</strong>
    </div>`).join('');

  const resumen = `
    <div class="doc-search-summary">
      <div class="doc-summary-pill">Incidencia de la fila<strong>${escapeHtml(row.incidencia || '—')}</strong></div>
      <div class="doc-summary-pill">OC de la fila<strong>${escapeHtml(row.oc || '—')}</strong></div>
      <div class="doc-summary-pill">Resultados<strong>${encontrados.length}</strong></div>
    </div>
    <div style="margin-bottom:12px; font-family:var(--font-mono); font-size:12px; color:var(--muted); line-height:1.5;">
      Coincidencias analizadas principalmente por número exacto en el nombre del archivo. La ruta solo suma puntos de apoyo para evitar falsos positivos.
    </div>
    <div class="doc-search-summary">${termsHtml}</div>
  `;

  const html = resumen + encontrados.map((archivo, index) => `
    <div class="doc-result-card">
      <div>
        <div class="doc-result-title">${escapeHtml(archivo.nombre)}</div>
        <span class="doc-result-path">${escapeHtml(archivo.ruta)}</span>
        <div class="doc-match-row">${renderMatchBadges(archivo._matches)}</div>
        <div class="doc-score">Relevancia: ${Math.round(archivo._score)} · ${escapeHtml((archivo.ext || '').toUpperCase())}</div>
      </div>
      <div class="doc-actions">
        <button class="btn btn-success btn-sm" type="button" onclick="abrirDocumentoLocal(${index})">Vista previa</button>
        <button class="btn btn-secondary btn-sm" type="button" onclick="copiarRutaDocumentoLocal(${index})">Copiar ruta</button>
      </div>
    </div>`).join('');

  showHtmlDialog(`Documentos encontrados (${encontrados.length})`, html);
}

window.vincularCarpetaDocumental = vincularCarpetaDocumental;
window.refrescarCarpetaDocumental = refrescarCarpetaDocumental;
window.buscarDocumentosLocalesOC = buscarDocumentosLocalesOC;
window.abrirDocumentoLocal = abrirDocumentoLocal;
window.cerrarPreviewDocumentoLocal = cerrarPreviewDocumentoLocal;
window.copiarRutaDocumentoLocal = copiarRutaDocumentoLocal;
window.cerrarDialogDocumental = cerrarDialogDocumental;

setTimeout(() => {
  if (!soportaCarpetasLocales()) {
    setOneDriveStatus('Tu navegador no soporta selección de carpetas. Usa Chrome o Edge actualizado.', false);
  } else {
    setOneDriveStatus('Sin carpeta vinculada. Selecciona OneDrive/Proveedores desde tu PC.', false);
  }
}, 0);

