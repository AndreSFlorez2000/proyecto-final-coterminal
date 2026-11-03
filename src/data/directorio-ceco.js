/* Edición pública: sin directorio regional privado ni datos de empleados.
   Los nombres de tienda, gerente y supervisor provienen del archivo que cargue el usuario. */
const D1_FLAGS = Object.freeze({ inferirCEDISinCECO: false });
const DIRECTORIO_CECO = Object.freeze({});
const SUPERVISOR_POR_GERENTE = Object.freeze({});
function getSupervisorPorGerente(gerente) { return ''; }
function completarSupervisorPorGerente(norm, motivo = '') { return norm; }