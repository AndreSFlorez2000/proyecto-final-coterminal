const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/core/cerrar-con-escape.js'), 'utf8');

function escenario() {
  const ids = [
    'dialogOverlay', 'cruceModal', 'cruceStatsModal', 'd1goStatsModal',
    'cicloCortoModal', 'ccurgVitalModal', 'statsModal', 'chartsModal',
    'cruceDetailModal', 'detailModal', 'preventivosModal', 'preventivoFloatingDetail'
  ];
  const elementos = new Map(ids.map(id => [id, {
    id, hidden: false, style: { display: 'none' }, z: 1500
  }]));
  const loading = { classList: { contains: () => false } };
  const llamadas = [];
  let listener;
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
  const window = {
    getComputedStyle: el => ({
      display: el.style.display,
      visibility: 'visible',
      zIndex: String(el.z)
    })
  };
  for (const [id, cerrar] of Object.entries(cierres)) {
    window[cerrar] = () => {
      llamadas.push(id);
      elementos.get(id).style.display = 'none';
    };
  }
  const document = {
    querySelectorAll: () => ids.map(id => elementos.get(id)),
    getElementById: id => id === 'loadingOverlay' ? loading : elementos.get(id) || null,
    addEventListener: (type, handler, capture) => {
      assert.equal(type, 'keydown');
      assert.equal(capture, true);
      listener = handler;
    }
  };
  vm.runInNewContext(source, { window, document });
  return {
    abrir(id, z = 1500) {
      const el = elementos.get(id);
      el.style.display = 'block';
      el.z = z;
    },
    escapar(override = {}) {
      const ev = {
        key: 'Escape', repeat: false, isComposing: false, defaultPrevented: false,
        prevented: false, stopped: false,
        preventDefault() { this.prevented = true; },
        stopPropagation() { this.stopped = true; },
        ...override
      };
      listener(ev);
      return ev;
    },
    llamadas,
    elementos
  };
}

test('Esc cierra la única ventana abierta', () => {
  const e = escenario();
  e.abrir('cruceModal');
  const evento = e.escapar();
  assert.deepEqual(e.llamadas, ['cruceModal']);
  assert.equal(evento.prevented, true);
  assert.equal(evento.stopped, true);
});

test('Esc cierra una capa por pulsación y conserva la anterior', () => {
  const e = escenario();
  e.abrir('d1goStatsModal');
  e.abrir('cicloCortoModal');
  e.escapar();
  assert.deepEqual(e.llamadas, ['cicloCortoModal']);
  assert.equal(e.elementos.get('d1goStatsModal').style.display, 'block');
  e.escapar();
  assert.deepEqual(e.llamadas, ['cicloCortoModal', 'd1goStatsModal']);
});

test('Esc prioriza diálogos, detalles y luego ventanas según su z-index', () => {
  const e = escenario();
  e.abrir('statsModal', 1500);
  e.abrir('detailModal', 2200);
  e.abrir('dialogOverlay', 3000);
  e.escapar(); e.escapar(); e.escapar();
  assert.deepEqual(e.llamadas, ['dialogOverlay', 'detailModal', 'statsModal']);
});

test('Esc cierra primero el detalle flotante de preventivos', () => {
  const e = escenario();
  e.abrir('preventivosModal', 1500);
  e.abrir('preventivoFloatingDetail', 99999);
  e.escapar();
  assert.deepEqual(e.llamadas, ['preventivoFloatingDetail']);
  assert.equal(e.elementos.get('preventivosModal').style.display, 'block');
});

test('Esc sin modales visibles no interfiere con la página', () => {
  const e = escenario();
  const evento = e.escapar();
  assert.deepEqual(e.llamadas, []);
  assert.equal(evento.prevented, false);
});

test('Otros atajos y autorepetición no cierran ventanas', () => {
  const e = escenario();
  e.abrir('cruceModal');
  e.escapar({ key: 'Enter' });
  e.escapar({ repeat: true });
  e.escapar({ ctrlKey: true });
  assert.deepEqual(e.llamadas, []);
});
