

/* ── THEME ── */
document.addEventListener('DOMContentLoaded', () => {
  const themeBtn = document.getElementById('toggleThemeBtn');

  function setTheme(mode) {
    document.body.classList.remove('dark', 'light');
    document.body.classList.add(mode);
    try { localStorage.setItem('control_oc_theme', mode); } catch (e) {}
    if (themeBtn) {
      themeBtn.textContent = mode === 'dark' ? '☀️' : '🌙';
      toast(mode === 'dark' ? 'Tema oscuro activo 🌙' : 'Tema claro activo ☀️', 'info', 1200);
      themeBtn.title = mode === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
    }
    try {
      if (typeof renderChartsModal === 'function' && document.getElementById('chartsModal')?.style.display === 'block') renderChartsModal();
      if (typeof renderD1goStatsModal === 'function' && document.getElementById('d1goStatsModal')?.style.display === 'block') renderD1goStatsModal();
    } catch (e) {}
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = document.body.classList.contains('dark') ? 'light' : 'dark';
      setTheme(next);
    });
  }

  try {
    const savedTheme = localStorage.getItem('control_oc_theme') || 'dark';
    setTheme(savedTheme);
  } catch (e) {
    setTheme('dark');
  }
});

