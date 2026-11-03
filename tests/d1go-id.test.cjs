const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const base = path.join(__dirname,'..','src');
const ctx = vm.createContext({Chart:{register(){}},ChartDataLabels:{}, XLSX:{SSF:{parse_date_code(){return null}}},console});
for(const file of ['data/directorio-ceco.js','core/estado.js','core/normalizacion.js','features/d1go/importar-d1go.js']) {
  vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),ctx,{filename:file});
}
function run(code){return vm.runInContext(code,ctx)}

test('una fecha no se convierte en ID cuando falta identificación D1Go', () => {
  const id=run(`extractSecondaryId({"ID Incidencia":"","Fecha Ingreso":"03/11/2026"}, [["ID Incidencia",""],["Fecha Ingreso","03/11/2026"]], () => "")`);
  assert.equal(id,'');
});

test('reconoce un ID cuando el encabezado es válido', () => {
  assert.equal(run(`extractSecondaryId({"ID Incidencia":"12345"}, [["ID Incidencia","12345"]], () => "12345")`),'12345');
  assert.equal(run(`extractSecondaryId({"ID de incidencia":"12346"}, [["ID de incidencia","12346"]], () => "")`),'12346');
});