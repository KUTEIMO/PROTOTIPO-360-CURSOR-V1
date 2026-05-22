# Ejecución y despliegue

## Requisitos

- **Node.js** ≥ 18
- Navegador con **WebGL**
- `vendors/marzipano.min.js` incluido en el repo (sin CDN obligatorio)

## Servidor local

```bash
npm install
npm run start
```

URL: http://localhost:8080 — páginas `index.html` (visor) y `demo.html` (guía demo).

## Auditoría accesibilidad

```bash
npm run audit
```

Genera `reports/audit-report.json` y `reports/audit-report.html` (criterios MinTIC A–H).

## Tests Playwright

En una terminal: `npm run start`  
En otra:

```bash
npm test
```

Valida foco por teclado en hotspots y panel accesible.

## Despliegue estático

El proyecto es HTML/JS estático. Puede publicarse en:

- Firebase Hosting, Netlify, GitHub Pages, o cualquier hosting estático
- Servir la raíz del repo (mantener rutas a `panoramas/`, `assets/`, `vendors/`)

No requiere variables de entorno para la demo local.

## Demo

- `demo.html` — pasos para demostración
- `demo-report.html` — reporte de demo
