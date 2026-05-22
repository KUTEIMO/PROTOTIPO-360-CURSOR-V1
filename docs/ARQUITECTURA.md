# Arquitectura

## Flujo

```text
index.html
    └── src/main.js
            ├── configLoader.js   → config.json
            ├── viewer.js         → Marzipano
            ├── hotspotManager.js / hotspotPanel.js
            ├── accessibility.js  → contraste, fuente, diálogos
            ├── keyboardControls.js
            ├── navigation.js / menu.js
            └── announcer.js      → live regions ARIA
```

## Datos

- `config.json` — escenas, zonas, hotspots (yaw/pitch), rutas a media
- `hotspot-overrides.json` (opcional) — posiciones editadas en navegador

## CSS modular

Carpeta `css/`: base, header, navegación, menú, componentes (hotspots, panel, skip-links, fallback).

## Accesibilidad

- Skip-links, roles ARIA, fallback sin JS en `index.html`
- Síntesis de voz de respaldo si falta audio
- Cumplimiento orientado a instrumento en `instrumento_auditoria_v1.json`
