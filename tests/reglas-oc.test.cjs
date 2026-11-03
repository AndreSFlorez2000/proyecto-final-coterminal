const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const base = path.join(__dirname,'..','src');
const ctx = vm.createContext({Chart:{register(){}},ChartDataLabels:{}, XLSX:{SSF:{parse_date_code(){return null}}},console});
for(const file of ['data/directorio-ceco.js','core/estado.js','core/normalizacion.js']) {
  vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),ctx,{filename:file});
}
function run(js) {return vm.runInContext(js,ctx);}

test('no asigna arbitrariamente CEDI a una OC sin CECO ni tienda', () => {
  const actual = run('aplicarFallbackCEDI({centroCoste:"",tienda:"",supervisor:"",gerente:""})');
  assert.equal(actual.tienda,'');
  assert.equal(actual.supervisor,'');
});

test('sí asigna CEDI cuando el CECO lo identifica explícitamente', () => {
  const actual = run('aplicarFallbackCEDI({centroCoste:"6A18C00001",tienda:"",supervisor:"",gerente:""})');
  assert.equal(actual.tienda,'CEDI IBAGUE');
  assert.equal(actual.supervisor,'SIN ASIGNAR');
});

test('clasificación financiera anterior sigue intacta en la migración inicial', () => {
  assert.equal(run('classifyFinancialView(0,0,"")'),'facturadas');
  assert.equal(run('classifyFinancialView(50,1,"")'),'pendientes');
  assert.equal(run('classifyFinancialView(50,1,"A")'),'activos');
  // Esta diferencia todavía requiere validación de negocio y aparece en auditoría.
  assert.equal(run('classifyFinancialView(0,1,"")'),'pendientes');
});