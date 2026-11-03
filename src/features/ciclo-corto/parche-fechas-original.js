
/* =========================================================
   FIX DEFINITIVO BOTONES DE FECHAS - CICLO CORTO / CCURGVITAL
   Objetivo: "Todos" marca todos los checkboxes visibles y
   "Quitar todas las selecciones" los desmarca todos, sin borrar datos.
   Este bloque es independiente para que funcione aunque otros listeners fallen.
========================================================= */
(function(){
  function byId(id){ return document.getElementById(id); }
  function toastSafe(msg, type){
    try { if (typeof window.toast === 'function') window.toast(msg, type || 'success'); }
    catch(e) { console.log(msg); }
  }
  function getValuesFromBox(boxId){
    const box = byId(boxId);
    if (!box) return [];
    return Array.from(box.querySelectorAll('input[type="checkbox"]'))
      .map(chk => chk.value)
      .filter(Boolean);
  }
  function getCycleDaysSafe(){
    try {
      if (typeof window.getCycleAvailableDays === 'function') {
        const days = window.getCycleAvailableDays() || [];
        if (days.length) return days;
      }
    } catch(e) {}
    return getValuesFromBox('cycleDaysList');
  }
  function getCCUrgDaysSafe(){
    try {
      if (typeof window.getCCUrgVitalAvailableDays === 'function') {
        const days = window.getCCUrgVitalAvailableDays() || [];
        if (days.length) return days;
      }
    } catch(e) {}
    return getValuesFromBox('ccurgDaysList');
  }
  function setChecks(boxId, checked){
    const box = byId(boxId);
    if (!box) return;
    box.querySelectorAll('input[type="checkbox"]').forEach(chk => {
      chk.checked = checked;
      const chip = chk.closest('.ccurg-day-chip');
      if (chip) chip.classList.toggle('active', checked);
    });
  }
  function renderCycleSafe(){
    try { if (typeof window.renderCicloCortoModal === 'function') window.renderCicloCortoModal(); } catch(e){ console.error(e); }
    setTimeout(() => {
      const selected = window._cycleSelectedDays instanceof Set ? window._cycleSelectedDays : new Set();
      const manual = !!window._cycleManualDaysTouched;
      const box = byId('cycleDaysList');
      if (!box) return;
      box.querySelectorAll('input[type="checkbox"]').forEach(chk => {
        chk.checked = manual ? selected.has(chk.value) : chk.checked;
      });
    }, 0);
  }
  function renderCCUrgSafe(){
    try { if (typeof window.renderCCUrgVitalModal === 'function') window.renderCCUrgVitalModal(); } catch(e){ console.error(e); }
    setTimeout(() => {
      const selected = window._ccurgVitalSelectedDays instanceof Set ? window._ccurgVitalSelectedDays : new Set();
      const manual = !!window._ccurgVitalManualDaysTouched;
      const box = byId('ccurgDaysList');
      if (!box) return;
      box.querySelectorAll('input[type="checkbox"]').forEach(chk => {
        chk.checked = manual ? selected.has(chk.value) : chk.checked;
      });
    }, 0);
  }

  window.__forceCycleDays = function(mode){
    const days = getCycleDaysSafe();
    window._cycleManualDaysTouched = true;
    window._cycleSelectedDays = mode === 'all' ? new Set(days) : new Set();
    setChecks('cycleDaysList', mode === 'all');
    renderCycleSafe();
    toastSafe(mode === 'all' ? 'Todas las fechas de Ciclo Corto seleccionadas ✅' : 'Selecciones de Ciclo Corto quitadas ✅', 'success');
  };

  window.__forceCCUrgDays = function(mode){
    const days = getCCUrgDaysSafe();
    window._ccurgVitalManualDaysTouched = true;
    window._ccurgVitalSelectedDays = mode === 'all' ? new Set(days) : new Set();
    setChecks('ccurgDaysList', mode === 'all');
    renderCCUrgSafe();
    toastSafe(mode === 'all' ? 'Todas las fechas de CCURGVITAL seleccionadas ✅' : 'Selecciones de CCURGVITAL quitadas ✅', 'success');
  };

  document.addEventListener('click', function(ev){
    const btn = ev.target.closest && ev.target.closest('#cycleSelectAllDaysBtn,#cycleClearDaysBtn,#ccurgSelectAllDaysBtn,#ccurgClearDaysBtn');
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    if (btn.id === 'cycleSelectAllDaysBtn') window.__forceCycleDays('all');
    if (btn.id === 'cycleClearDaysBtn') window.__forceCycleDays('none');
    if (btn.id === 'ccurgSelectAllDaysBtn') window.__forceCCUrgDays('all');
    if (btn.id === 'ccurgClearDaysBtn') window.__forceCCUrgDays('none');
  }, true);

  document.addEventListener('change', function(ev){
    const chk = ev.target;
    if (!chk || chk.type !== 'checkbox') return;
    const cycleBox = chk.closest('#cycleDaysList');
    const ccurgBox = chk.closest('#ccurgDaysList');
    if (cycleBox) {
      window._cycleManualDaysTouched = true;
      window._cycleSelectedDays = new Set(Array.from(cycleBox.querySelectorAll('input[type="checkbox"]:checked')).map(x => x.value));
      setTimeout(renderCycleSafe, 0);
    }
    if (ccurgBox) {
      window._ccurgVitalManualDaysTouched = true;
      window._ccurgVitalSelectedDays = new Set(Array.from(ccurgBox.querySelectorAll('input[type="checkbox"]:checked')).map(x => x.value));
      setTimeout(renderCCUrgSafe, 0);
    }
  }, true);
})();
