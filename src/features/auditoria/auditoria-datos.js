/* Auditoría no destructiva del aplicativo D1: NO altera el estado ni los KPIs. */
(function (root) {
  'use strict';

  function analizar(ocRows = [], d1goRows = []) {
    const porIncidencia = new Map();
    const sinCECO = [];
    const sinIncidencia = [];
    const cantidadesDifieren = [];
    const cediSinCECO = [];
    const filasEliminadas = [];

    for (const r of ocRows) {
      const id = String(r.incidencia || '').trim();
      const oc = String(r.oc || '').trim();
      if (!id) sinIncidencia.push(r);
      if (!String(r.centroCoste || '').trim()) sinCECO.push(r);
      if (String(r.tienda || '').toUpperCase().includes('CEDI') && !/^6A18C\d{5}$/i.test(String(r.centroCoste || ''))) cediSinCECO.push(r);
      if (r.isDeleted) filasEliminadas.push(r);
      if (Number(r.rawPorEntregarValor || 0) === 0 && Number(r.rawPorEntregarCantidad || 0) !== 0) cantidadesDifieren.push(r);
      if (id && !r.isDeleted) {
        if (!porIncidencia.has(id)) porIncidencia.set(id, { incidencia: id, ocs: new Map(), lineas: 0, tiendas: new Set() });
        const group = porIncidencia.get(id);
        group.lineas++;
        if (oc) group.ocs.set(oc, (group.ocs.get(oc) || 0) + 1);
        if (r.tienda) group.tiendas.add(String(r.tienda));
      }
    }

    const variasOC = Array.from(porIncidencia.values())
      .filter(group => group.ocs.size > 1)
      .map(group => ({ incidencia: group.incidencia, ocs: [...group.ocs.keys()].sort(), lineas: group.lineas, tiendas: [...group.tiendas] }))
      .sort((a,b) => b.ocs.length - a.ocs.length || a.incidencia.localeCompare(b.incidencia));
    const estadoD1go = new Map();
    const sinIdD1go = [];
    for (const row of d1goRows) {
      const id = String(row.id || '').trim();
      if (!id) { sinIdD1go.push(row); continue; }
      if (!estadoD1go.has(id)) estadoD1go.set(id, { id, rows: [] });
      estadoD1go.get(id).rows.push(row);
    }
    const duplicadasD1go = [...estadoD1go.values()]
      .filter(group => group.rows.length > 1)
      .map(group => ({ id: group.id, cantidad: group.rows.length, estados: [...new Set(group.rows.map(r => String(r.estadoGeneral || '').trim()))] }))
      .sort((a,b) => b.cantidad - a.cantidad);

    return {
      resumen: {
        filasOC: ocRows.length, filasD1go: d1goRows.length,
        sinCECO: sinCECO.length, sinIncidencia: sinIncidencia.length,
        variasOC: variasOC.length, duplicadasD1go: duplicadasD1go.length,
        sinIdD1go: sinIdD1go.length, cantidadesDifieren: cantidadesDifieren.length,
        cediSinCECO: cediSinCECO.length, filasEliminadas: filasEliminadas.length
      },
      variasOC, duplicadasD1go,
      sinCECO: sinCECO.map(r => ({ incidencia: r.incidencia, oc: r.oc, tienda: r.tienda })),
      sinIncidencia: sinIncidencia.map(r => ({ oc: r.oc, texto: r.textoBreve })),
      cantidadesDifieren: cantidadesDifieren.map(r => ({ incidencia:r.incidencia, oc:r.oc, valor:r.rawPorEntregarValor, cantidad:r.rawPorEntregarCantidad })),
      cediSinCECO: cediSinCECO.map(r => ({ incidencia:r.incidencia, oc:r.oc, ceco:r.centroCoste }))
    };
  }

  const api = { analizar };
  root.D1Auditoria = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  const fmt = n => Number(n || 0).toLocaleString('es-CO');
  const safe = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const btn = document.createElement('button');
  btn.id = 'abrirAuditoriaD1';
  btn.type = 'button';
  btn.className = 'btn btn-secondary btn-sm';
  btn.textContent = '🧪 Calidad de datos';
  document.querySelector('.topbar-actions')?.appendChild(btn);

  const modal = document.createElement('div');
  modal.id = 'modalAuditoriaD1';
  modal.className = 'auditoria-fondo';
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-label','Auditoría de datos');
  modal.innerHTML = `
    <div class="auditoria-ventana">
      <header class="auditoria-cabecera">
        <div><h2>🧪 Auditoría de calidad de datos</h2><p>Revisa anomalías de importación sin modificar los cálculos ni las tablas existentes.</p></div>
        <button id="cerrarAuditoriaD1" class="btn btn-secondary btn-sm" type="button">✕ Cerrar</button>
      </header>
      <div id="auditoriaContenido" class="auditoria-contenido"></div>
      <footer class="auditoria-pie">
        <small>Las alertas son indicios que requieren revisión; no equivalen por sí solas a errores de SAP o D1Go.</small>
        <button id="exportarAuditoriaD1" class="btn btn-primary btn-sm" type="button">⬇ Descargar diagnóstico CSV</button>
      </footer>
    </div>`;
  document.body.appendChild(modal);
  let ultimo = null;

  function render() {
    const oc = (typeof state !== 'undefined' && state.rowsByView?.sheet1) || [];
    const d1go = (typeof state !== 'undefined' && state.cruce?.rows) || [];
    const descartadas = (typeof state !== 'undefined' && state.cruce?.discardedWithoutId) || [];
    ultimo = analizar(oc, [...d1go, ...descartadas]);
    const m = ultimo.resumen;
    const cifras = [
      ['Filas OC', m.filasOC], ['Filas D1Go', m.filasD1go], ['Incidencias con varias OC', m.variasOC],
      ['CECO ausente', m.sinCECO], ['OC sin incidencia', m.sinIncidencia], ['ID repetidos D1Go', m.duplicadasD1go],
      ['D1Go sin ID', m.sinIdD1go], ['Valor 0 / cantidad no 0', m.cantidadesDifieren],
      ['CEDI sin CECO C válido', m.cediSinCECO], ['Filas eliminadas L', m.filasEliminadas]
    ];
    const cards = cifras.map(([label,num]) => `<div class="auditoria-tarjeta"><strong>${fmt(num)}</strong><span>${safe(label)}</span></div>`).join('');
    const tabla = ultimo.variasOC.slice(0, 35).map(r => `<tr><td>${safe(r.incidencia)}</td><td>${fmt(r.ocs.length)}</td><td>${safe(r.ocs.join(', '))}</td><td>${fmt(r.lineas)}</td></tr>`).join('');
    const duplicados = ultimo.duplicadasD1go.slice(0, 25).map(r => `<tr><td>${safe(r.id)}</td><td>${fmt(r.cantidad)}</td><td>${safe(r.estados.join(', '))}</td></tr>`).join('');
    document.getElementById('auditoriaContenido').innerHTML = `
      ${!m.filasOC && !m.filasD1go ? '<p class="auditoria-nota">Carga el Excel principal y/o D1Go para analizar la calidad de sus registros.</p>' : ''}
      <div class="auditoria-cuadricula">${cards}</div>
      <h3>Incidencias con múltiples órdenes de compra</h3>
      <p>El cruce actual presenta una OC representativa por incidencia. Este reporte conserva la lista completa para revisar los casos uno a muchos.</p>
      <div class="auditoria-tabla"><table><thead><tr><th>Incidencia</th><th>OC distintas</th><th>Órdenes encontradas</th><th>Líneas OC</th></tr></thead><tbody>${tabla || '<tr><td colspan="4">No se identificaron coincidencias múltiples en las filas cargadas.</td></tr>'}</tbody></table></div>
      <h3>Identificadores repetidos en D1Go</h3>
      <p>Una repetición puede representar registros distintos, actualizaciones o duplicados; se requiere revisar la fuente.</p>
      <div class="auditoria-tabla"><table><thead><tr><th>ID D1Go</th><th>Registros</th><th>Estados observados</th></tr></thead><tbody>${duplicados || '<tr><td colspan="3">No se identificaron ID repetidos.</td></tr>'}</tbody></table></div>
      <p class="auditoria-nota">Se muestran hasta 35 incidencias con múltiples OC y 25 ID repetidos. La descarga CSV contiene todos los hallazgos del diagnóstico.</p>`;
  }

  function exportar() {
    if (!ultimo) render();
    const encabezado = ['Tipo','Incidencia/ID','OC','Detalle'];
    const filas = [];
    for (const r of ultimo.variasOC) filas.push(['Múltiples OC',r.incidencia,r.ocs.join(' | '),`${r.lineas} líneas`]);
    for (const r of ultimo.duplicadasD1go) filas.push(['ID repetido D1Go',r.id,'',`${r.cantidad} filas. Estados: ${r.estados.join(' | ')}`]);
    for (const r of ultimo.sinCECO) filas.push(['CECO vacío',r.incidencia,r.oc,r.tienda]);
    for (const r of ultimo.sinIncidencia) filas.push(['OC sin incidencia','',r.oc,r.texto]);
    for (const r of ultimo.cantidadesDifieren) filas.push(['Valor 0/cantidad no 0',r.incidencia,r.oc,`Valor ${r.valor}; cantidad ${r.cantidad}`]);
    for (const r of ultimo.cediSinCECO) filas.push(['CEDI sin CECO C válido',r.incidencia,r.oc,r.ceco]);
    const quote = cell => '"' + String(cell ?? '').replace(/"/g,'""') + '"';
    const csv = '\uFEFF' + [encabezado,...filas].map(row => row.map(quote).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = 'D1_diagnostico_calidad.csv'; document.body.append(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }

  const cerrar = () => {modal.style.display = 'none';document.body.style.overflow='';};
  btn.addEventListener('click', () => { render(); modal.style.display = 'flex'; document.body.style.overflow='hidden'; });
  modal.querySelector('#cerrarAuditoriaD1').addEventListener('click', cerrar);
  modal.querySelector('#exportarAuditoriaD1').addEventListener('click', exportar);
  modal.addEventListener('click', e => {if(e.target===modal)cerrar();});
  document.addEventListener('keydown',e => {if(e.key==='Escape' && modal.style.display==='flex')cerrar();});
})(typeof window !== 'undefined' ? window : globalThis);