/* ── LOADING ── */
function showLoading(msg = 'Procesando...') {
  loadingText.textContent = msg;
  loadingOverlay.classList.add('visible');
}

function hideLoading() {
  loadingOverlay.classList.remove('visible');
}

/* ── TOAST ── */
function toast(msg, type = 'success', duration = 2500) {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  $id('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

/* ── DIALOG ── */
function hideDialog() {
  dialogOverlay.style.display = 'none';
  dialogOverlay.classList.remove('doc-dialog');
  dialogTitle.style.display = '';
  dialogActions.style.display = '';
  dialogMessage.innerHTML = '';
  dialogActions.innerHTML = '';
}

function showInfoDialog(title, message) {
  dialogOverlay.classList.remove('doc-dialog');
  dialogTitle.style.display = '';
  dialogActions.style.display = '';
  dialogTitle.textContent = title;
  dialogMessage.textContent = message;
  dialogActions.innerHTML = `<button class="btn btn-primary btn-sm" id="dialogOkBtn">Aceptar</button>`;
  dialogOverlay.style.display = 'flex';
  $id('dialogOkBtn').onclick = hideDialog;
}

function showConfirmDialog(title, message, onConfirm) {
  dialogTitle.textContent = title;
  dialogMessage.textContent = message;
  dialogActions.innerHTML = `
    <button class="btn btn-secondary btn-sm" id="dialogCancelBtn">Cancelar</button>
    <button class="btn btn-primary btn-sm" id="dialogConfirmBtn">Confirmar</button>
  `;
  dialogOverlay.style.display = 'flex';
  $id('dialogCancelBtn').onclick = hideDialog;
  $id('dialogConfirmBtn').onclick = () => { hideDialog(); if (typeof onConfirm === 'function') onConfirm(); };
}
