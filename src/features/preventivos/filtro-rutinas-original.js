
(function(){
  'use strict';

  function preventivoNorm(v) {
    return String(v || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  // Columna G del Excel D1GO = Servicio.
  // Todo lo que tenga rutina/preventivo/preventiva/preventivos se analiza solo en el módulo Preventivos.
  window.isD1goPreventivoRoutineRow = function(row) {
    const servicio = preventivoNorm(row && row.servicio);
    const detalle = preventivoNorm((row && (row.detalleSolicitud || row.detalle)) || '');
    return (
      servicio.includes('preventiv') ||
      servicio.includes('rutina') ||
      servicio.includes('preventivo') ||
      detalle.includes('rutina preventiva')
    );
  };

  function filteredNonPreventivos(rows) {
    return (rows || []).filter(r => !window.isD1goPreventivoRoutineRow(r));
  }

  // Ciclo Corto: se reemplaza la base para que no cuente rutinas/preventivos.
  if (typeof window.getCycleBaseRows === 'function' || typeof getCycleBaseRows === 'function') {
    const oldGetCycleBaseRows = (typeof getCycleBaseRows === 'function') ? getCycleBaseRows : window.getCycleBaseRows;
    window.getCycleBaseRows = getCycleBaseRows = function() {
      return filteredNonPreventivos(oldGetCycleBaseRows());
    };
  }

  // CCURGVITAL: se reemplaza la lista visible para omitir rutinas/preventivos.
  if (typeof window.getCCUrgVitalVisibleRows === 'function' || typeof getCCUrgVitalVisibleRows === 'function') {
    const oldGetCCUrgVitalVisibleRows = (typeof getCCUrgVitalVisibleRows === 'function') ? getCCUrgVitalVisibleRows : window.getCCUrgVitalVisibleRows;
    window.getCCUrgVitalVisibleRows = getCCUrgVitalVisibleRows = function(options = {}) {
      return filteredNonPreventivos(oldGetCCUrgVitalVisibleRows(options));
    };
  }

  // Re-render automático si los modales están abiertos.
  window.refreshNonPreventivoModules = function(){
    try {
      const ciclo = document.getElementById('cicloCortoModal');
      if (ciclo && ciclo.style.display === 'block' && typeof renderCicloCortoModal === 'function') renderCicloCortoModal();
    } catch(e){}
    try {
      const uv = document.getElementById('ccurgVitalModal');
      if (uv && uv.style.display === 'block' && typeof renderCCUrgVitalModal === 'function') renderCCUrgVitalModal();
    } catch(e){}
  };
})();
