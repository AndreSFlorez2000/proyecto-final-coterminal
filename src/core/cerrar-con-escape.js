/* Cierre centralizado con Escape: una sola capa por pulsación. */
(() => {
  'use strict';

  const cierres = {
    cruceModal: 'closeCruceModal',
    cruceStatsModal: 'closeCruceStatsModal',
    d1goStatsModal: 'closeD1goStatsModal',
    cicloCortoModal: 'closeCicloCortoModal',
    ccurgVitalModal: 'closeCCUrgVitalModal',
    statsModal: 'closeStatsModal',
    chartsModal: 'closeChartsModal',
    preventivosModal: 'closePreventivosModal',
    detailModal: 'closeDetailModal',
    cruceDetailModal: 'closeCruceDetailModal',
    dialogOverlay: 'cerrarDialogDocumental',
    preventivoFloatingDetail: 'closePreventivoFloatingDetail'
  };

  function visible(elemento) {
    if (!elemento || elemento.hidden) return false;
    const estilo = window.getComputedStyle(elemento);
    return estilo.display !== 'none' && estilo.visibility !== 'hidden';
  }

  function superior() {
    // querySelectorAll devuelve orden DOM: ante igual z-index gana la última capa.
    const selector = Object.keys(cierres).map(id => '#' + id).join(', ');
    const elementos = Array.from(document.querySelectorAll(selector));
    let primero = null;
    elementos.forEach((elemento, orden) => {
      if (!visible(elemento)) return;
      const z = Number.parseInt(window.getComputedStyle(elemento).zIndex, 10) || 0;
      if (!primero || z > primero.z || (z === primero.z && orden > primero.orden)) {
        primero = { elemento, orden, z, cerrar: cierres[elemento.id] };
      }
    });
    return primero;
  }

  document.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape' || evento.repeat || evento.isComposing ||
        evento.defaultPrevented || evento.altKey || evento.ctrlKey || evento.metaKey) return;
    // Evita cerrar pantallas que estén procesando una importación.
    if (document.getElementById('loadingOverlay')?.classList.contains('visible')) return;

    const capa = superior();
    if (!capa) return;

    evento.preventDefault();
    evento.stopPropagation();
    const cerrar = window[capa.cerrar];
    if (typeof cerrar === 'function') {
      cerrar();
    } else {
      capa.elemento.style.display = 'none';
    }
  }, true);
})();
