# Tour virtual 360° accesible — Sede 2 (MVP)

Recorrido virtual **360°** con [Marzipano](https://www.marzipano.net/), orientado a **accesibilidad** (WCAG 2.1 y Resolución MinTIC 1519 de 2020): teclado, lectores de pantalla, subtítulos, transcripciones y auditoría automatizada.

**Repositorio:** https://github.com/KUTEIMO/PROTOTIPO-360-CURSOR-V1

---

## Inicio rápido

```bash
git clone https://github.com/KUTEIMO/PROTOTIPO-360-CURSOR-V1.git
cd PROTOTIPO-360-CURSOR-V1
npm install
npm run start
```

Abrir `http://localhost:8080`.

| Comando | Uso |
|---------|-----|
| `npm run audit` | Auditoría WCAG/MinTIC → `reports/audit-report.{json,html}` |
| `npm test` | Pruebas de teclado (Playwright; requiere servidor en 8080) |

Guía detallada (escenas, hotspots, edición): [docs/GUIA-COMPLETA-360.md](docs/GUIA-COMPLETA-360.md).

---

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [docs/GUIA-COMPLETA-360.md](docs/GUIA-COMPLETA-360.md) | Manual completo del MVP |
| [docs/EJECUCION-Y-DEPLOY.md](docs/EJECUCION-Y-DEPLOY.md) | Instalación, pruebas y demo |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Módulos JS y estructura |
| [backlog.md](backlog.md) | Tareas pendientes |
| [CHANGELOG.md](CHANGELOG.md) | Historial de cambios |

---

## Estructura (resumen)

```text
index.html, config.json    # Entrada y escenas
src/                       # Visor, hotspots, accesibilidad, teclado
panoramas/                 # Imágenes equirectangulares
assets/                    # Audio, VTT, transcripciones
tests/                     # Playwright
audit-runner.js            # Auditoría MinTIC
```

---

## Licencia

[MIT](LICENSE)
