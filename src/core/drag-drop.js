/* ── DRAG & DROP PARA CARGA DE ARCHIVOS ── */
function setupUploadDragAndDrop(inputId) {
  const input = $id(inputId);
  if (!input) return;

  const box = input.closest('.upload-box');
  if (!box || box.dataset.dragReady === '1') return;
  box.dataset.dragReady = '1';
  box.setAttribute('tabindex', '0');
  box.setAttribute('role', 'button');
  box.setAttribute('aria-label', 'Cargar archivo: puedes hacer clic o arrastrar y soltar aquí');

  if (!box.querySelector('.drag-helper')) {
    const helper = document.createElement('div');
    helper.className = 'drag-helper';
    helper.textContent = 'También puedes arrastrar y soltar el archivo aquí.';
    const status = box.querySelector('.file-status');
    if (status) box.insertBefore(helper, status);
    else box.appendChild(helper);
  }

  const allowedExt = (input.getAttribute('accept') || '')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);

  const isAllowedFile = (file) => {
    if (!file || !allowedExt.length) return true;
    const name = String(file.name || '').toLowerCase();
    return allowedExt.some(ext => name.endsWith(ext.replace('*', '')));
  };

  const processDroppedFile = (file) => {
    if (!file) return;
    if (!isAllowedFile(file)) {
      toast('Formato no permitido. Usa Excel o CSV.', 'error');
      return;
    }

    try {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (err) {
      const syntheticEvent = { target: { files: [file] } };
      if (inputId === 'excelFileCruce') {
        handleCruceFileUpload(syntheticEvent);
        setTimeout(refreshCicloCortoIfOpen, 600);
        setTimeout(refreshCicloCortoIfOpen, 1400);
        setTimeout(refreshCCUrgVitalIfOpen, 600);
        setTimeout(refreshCCUrgVitalIfOpen, 1400);
      } else {
        handleFileUpload(syntheticEvent);
      }
    }
  };

  let dragDepth = 0;
  const clearDrag = () => {
    dragDepth = 0;
    box.classList.remove('drag-over');
  };

  box.addEventListener('click', (e) => {
    const interactive = e.target.closest('label, input, button, a, select, textarea');
    if (!interactive) input.click();
  });

  box.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth++;
    box.classList.add('drag-over');
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });

  box.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    box.classList.add('drag-over');
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });

  box.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) box.classList.remove('drag-over');
  });

  box.addEventListener('dragend', clearDrag);

  box.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearDrag();

    const files = Array.from(e.dataTransfer?.files || []);
    const file = files.find(isAllowedFile) || files[0];
    processDroppedFile(file);
  });

  box.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });
}

function setupAllUploadDragAndDrop() {
  document.querySelectorAll('.upload-box input[type="file"][id]').forEach(input => {
    setupUploadDragAndDrop(input.id);
  });
}

function setupGlobalDragProtection() {
  ['dragover', 'drop'].forEach(evtName => {
    document.addEventListener(evtName, (e) => {
      const inUploadBox = e.target && e.target.closest && e.target.closest('.upload-box');
      if (!inUploadBox && e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault();
      }
    });
  });
}
