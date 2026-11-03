/* ── STATE ── */
const state = {
  workbook: null,
  rowsByView: { sheet1: [], facturadas: [], pendientes: [], activos: [], liberadas: [] },
  searchedRows: { sheet1: [], facturadas: [], pendientes: [], activos: [], liberadas: [] },
  selectedView: 'sheet1',
  excelDataRows: 0,
  exportBusy: false,
  filters: { incidencias: [], oc: '', cotizacion: '', proveedor: '', tienda: '', supervisor: '', tipoIncidencia: '', tipoServicio: '', tipoGasto: '', deletedMode: 'all', onlyLiberadas2x: false, includeActivos: true },
  cecoStats: { filasConCECO: 0, completadasTienda: 0, completadasSupervisor: 0, noEncontrados: 0, cediAutomaticos: 0 },
  pagination: { page: 1, pageSize: 50, sortCol: null, sortDir: 'asc' },
  stats: { mode: 'proveedor', search: '', selected: new Set(), includeActivos: true, supervisorFilter: '', orderBy: 'total' },
  charts: { mode: 'proveedor', search: '', selected: new Set(), includeActivos: true, supervisorFilter: '', orderBy: 'total' },
  cruce: {
    rows: [], filteredRows: [], estados: [], supervisores: [],
    sortCol: 'fechaIngreso',
    sortDir: 'desc',
    page: 1,
    pageSize: 15,
    d1goFilters: { estado: '', supervisor: '', tienda: '', fecha: '', search: '' },
    ui: { showSecundarioStats: false }
  }
};

const VIEW_KEYS = [
  { key: 'sheet1',    label: 'Total general' },
  { key: 'facturadas', label: 'Facturadas' },
  { key: 'pendientes', label: 'Pendientes' },
  { key: 'activos',   label: 'Activos' },
  { key: 'liberadas', label: 'Liberadas 2X' }
];
