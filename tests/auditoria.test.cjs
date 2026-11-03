const test = require('node:test');
const assert = require('node:assert/strict');
const {analizar} = require('../src/features/auditoria/auditoria-datos.js');

test('identifica incidencia con varias OC sin perder los números', () => {
  const result = analizar([
    {incidencia:'12345',oc:'450001',centroCoste:'6A18T00067',rawPorEntregarValor:100,rawPorEntregarCantidad:1},
    {incidencia:'12345',oc:'450002',centroCoste:'6A18T00067',rawPorEntregarValor:0,rawPorEntregarCantidad:0},
    {incidencia:'12345',oc:'450002',centroCoste:'6A18T00067',rawPorEntregarValor:0,rawPorEntregarCantidad:0},
  ],[]);
  assert.equal(result.resumen.variasOC,1);
  assert.deepEqual(result.variasOC[0].ocs,['450001','450002']);
  assert.equal(result.variasOC[0].lineas,3);
});

test('detecta IDs duplicados de D1Go sin eliminarlos', () => {
  const result = analizar([], [{id:'85001',estadoGeneral:'Abierta'},{id:'85001',estadoGeneral:'Cerrada'},{id:'85002',estadoGeneral:'Solicitada'}]);
  assert.equal(result.resumen.duplicadasD1go,1);
  assert.equal(result.duplicadasD1go[0].cantidad,2);
  assert.deepEqual(result.duplicadasD1go[0].estados,['Abierta','Cerrada']);
});

test('señala filas incompletas y saldos/cantidades inconsistentes', () => {
  const result = analizar([{oc:'45003',incidencia:'',centroCoste:'',rawPorEntregarValor:0,rawPorEntregarCantidad:2}], [{id:''}]);
  assert.equal(result.resumen.sinIncidencia,1);
  assert.equal(result.resumen.sinCECO,1);
  assert.equal(result.resumen.cantidadesDifieren,1);
  assert.equal(result.resumen.sinIdD1go,1);
});