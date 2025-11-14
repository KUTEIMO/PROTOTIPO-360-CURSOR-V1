# Tour Virtual Accesible – Sede 2 (MVP)

Recorrido virtual 360° basado en [Marzipano](https://www.marzipano.net/) con énfasis en accesibilidad conforme a WCAG 2.1/3.0 y la Resolución MinTIC 1519 de 2020.

## Requisitos previos

- Node.js ≥ 18
- Navegador moderno con soporte WebGL
- El archivo `vendors/marzipano.min.js` (incluido en el repo) se carga de forma local para evitar fallos de red

## Puesta en marcha

```bash
npm install
npm run start
```

El servidor local (http-server) queda disponible en `http://localhost:8080`.

## Auditoría y pruebas automatizadas

- Ejecutar auditoría inicial (JSON + HTML):

```bash
npm run audit
```

El resultado queda en `reports/audit-report.{json,html}`.

- Probar navegación por teclado (Playwright):

```bash
npm test
```

Los tests validan que los hotspots reciban foco mediante tabulación y que el panel accesible se muestre correctamente.
> Nota: ejecuta `npm run start` en otra terminal (o define `BASE_URL` apuntando a tu servidor) antes de lanzar `npm test`.

## Atajos de teclado relevantes

- Flechas ← →: rotación horizontal
- Flechas ↑ ↓: inclinación vertical
- `+` / `-`: zoom
- `Q` / `E`: balance vertical
- `Tab`: recorre controles, hotspots y menú
- `Ctrl + Shift + H`: activa/desactiva modo de edición de hotspots
- `Ctrl + Shift + E`: exporta en consola las posiciones ajustadas de la escena activa
- `Shift + /`: abre el diálogo de ayuda (también disponible desde el botón de ayuda)

## Navegación y rendimiento

- El visor 360° usa Marzipano precargado localmente para evitar pantallas en negro si la conexión falla.
- Las escenas se precargan de forma diferida para reducir los bloqueos al cambiar de panorama.
- Navegación alterna tipo Street View: mueve el cursor para ver la dirección sugerida y haz doble clic para saltar a la escena más cercana; los botones laterales originales siguen disponibles.
- La banda inferior muestra accesos rápidos a tres zonas clave (Entrada, Cafetería, Biblioteca) para saltar inmediatamente entre áreas.

## Estructura principal

```
├── index.html                 # Página principal con skip-links y fallback sin JS
├── demo.html                  # Guía rápida de demo y accesos directos
├── config.json                # Declaración de escenas, hotspots y recursos
├── src/                       # Código JavaScript modular
│   ├── main.js                # Punto de entrada
│   ├── viewer.js              # Inicialización Marzipano
│   ├── hotspotManager.js      # Hotspots accesibles
│   ├── hotspotPanel.js        # Panel de detalle con audio/subtítulos
│   ├── accessibility.js       # Controles de accesibilidad y diálogos
│   ├── keyboardControls.js    # Navegación por teclado
│   ├── navigation.js          # Botones anterior/siguiente
│   ├── menu.js                # Menú lateral accesible
│   ├── announcer.js, state.js, fallback.js, configLoader.js
├── assets/
│   ├── audio/placeholder.mp3          # Audiodescripción de muestra
│   ├── captions/*.vtt                # Subtítulos cerrados
│   └── transcripts/*.txt             # Transcripciones descargables
├── reports/                          # (se crea al ejecutar auditoría)
├── tests/
│   └── keyboard-navigation.spec.ts   # Validación automática (Playwright)
├── audit-runner.js           # Script de auditoría WCAG/MinTIC
├── instrumento_auditoria_v1.json
├── backlog.md                # Lista de tareas priorizadas
└── CHANGELOG.md
```

## Añadir nuevas escenas y hotspots

1. Copia tu imagen equirectangular a `panoramas/`.
2. Declara la escena en `config.json` con los campos obligatorios:

```jsonc
{
  "id": "laboratorio-innovacion",
  "title": "Laboratorio de Innovación",
  "file": "laboratorio.jpg",
  "zone": "laboratorios",
  "order": 3,
  "altText": "Descripción corta de la escena.",
  "longDescription": "Descripción larga anunciada por lectores de pantalla.",
  "narration": "assets/audio/placeholder.mp3",
  "transcript": "assets/transcripts/laboratorio.txt",
  "captionFile": "assets/captions/laboratorio.vtt",
  "hotspots": [
    {
      "id": "estacion-robotica",
      "title": "Estación robótica",
      "yaw": 0.8,
      "pitch": 0.1,
      "altText": "Brazo robótico interactivo sobre mesa.",
      "description": "Explica la funcionalidad del punto de interés.",
      "narration": "assets/audio/placeholder.mp3",
      "transcript": "assets/transcripts/hotspot-estacion-robotica.txt",
      "captionFile": "assets/captions/hotspot-estacion-robotica.vtt",
      "icon": "🤖"
    }
  ]
}
```

3. Crea los archivos de audio (MP3), transcripción (TXT) y subtítulos (VTT). Los placeholders actuales facilitan la integración inicial.
4. Si la escena pertenece a una nueva zona, declara el rótulo accesible en `config.zones`.
5. Ejecuta `npm run audit` para confirmar el cumplimiento.

## Modo edición de hotspots

1. Activa el modo con `Ctrl + Shift + H`. Los hotspots mostrarán un contorno amarillo y el cursor cambiará a “drag”.
2. Mientras el modo está activo, el panorama queda bloqueado al ratón para evitar giros accidentales; utiliza las flechas del teclado (y `+` / `-` para zoom) para ajustar el encuadre antes de mover un punto.
3. Arrastra el hotspot sobre la imagen para reubicarlo. Al soltar, la nueva posición se guarda en `localStorage`.
4. Presiona `Ctrl + Shift + E` para descargar `hotspot-overrides.json` (contiene **todas** las escenas editadas). Coloca este archivo en la raíz del proyecto para que se cargue automáticamente en cualquier navegador.
5. Desactiva el modo edición con la misma combinación (`Ctrl + Shift + H`).

## Sustituir audios y subtítulos

- Reemplaza `assets/audio/placeholder.mp3` por una grabación real (mismo nombre o actualiza las rutas en `config.json`).
- Genera subtítulos `.vtt` con al menos dos líneas de tiempo.
- Actualiza las transcripciones en `assets/transcripts/`.
- Para personalizar ubicaciones de hotspots sin tocar `config.json`, edita en el navegador y sobrescribe `hotspot-overrides.json` con el archivo descargado (mantén el nombre para que se cargue automáticamente).

## Demo y reporte

- `demo.html` contiene pasos guiados para la demostración rápida y accesos directos relevantes.
- `reports/audit-report.html` muestra el consolidado de criterios A–H con semáforos.

## Notas sobre accesibilidad

- La interfaz implementa los principios POUR: perceivable (descripciones y subtítulos), operable (teclado y skip-links), understandable (mensajes claros) y robust (roles ARIA, live regions).
- El modo de alto contraste y el ajuste de fuente usan variables CSS para evitar pérdida de información.
- El fallback sin JavaScript incluye imagen estática, figcaption y enlace directo a transcripción.
- Cuando un audio no está disponible, el sistema genera automáticamente una audiodescripción mediante síntesis de voz en español.

## Próximos pasos sugeridos

Revisa `backlog.md` para conocer tareas de mayor impacto: sustitución de audios reales, ampliación de pruebas automáticas con lectores de pantalla y soporte móvil avanzado.

