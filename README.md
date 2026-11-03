# Proyecto Final Coterminal — Edición pública de demostración

Aplicación de control de órdenes de compra y seguimiento D1Go, migrada desde un prototipo HTML hacia una estructura con módulos por carpetas.

## Seguridad y alcance

**Este repositorio es una edición pública de demostración.** Se retiraron el directorio regional CECO, las credenciales y hashes de autenticación heredados, el respaldo HTML original y el webhook particular de n8n. No incluye archivos operativos.

- Cargar Excel/CSV de OC y D1Go, filtros, estadísticas, cruces y auditoría.
- Para probarlo: usar datos sintéticos o datos autorizados. Los archivos se procesan en el navegador, excepto que bibliotecas y fuentes se cargan por CDN.
- La búsqueda documental usa carpetas locales que el usuario seleccione en Chrome/Edge (HTTPS).
- No incluye servidor ni control real de identidades; **no es una instalación corporativa segura**.
- Sin directorio CECO incrustado, no se completarán automáticamente tiendas y supervisores.

## Ejecutar

```bash
python -m http.server 5500
```

Abrir http://localhost:5500. También es apta para alojamiento estático si se habilita GitHub Pages.

## Pruebas

```bash
npm test
```

## Estructura

- `index.html` interfaz
- `src/core/` estado, normalización, utilidades y eventos
- `src/features/` OC, D1Go, cruces, Ciclo Corto, urgencias, preventivos, documental y auditoría
- `src/styles/` CSS
- `tests/` pruebas
- `.github/workflows/` CI y publicación opcional

## GitHub Pages

El archivo `.github/workflows/pages.yml` solicita el despliegue automático al hacer push. Si el repositorio aún no tiene Pages habilitado, un administrador deberá activarlo en **Settings → Pages → Source → GitHub Actions**.