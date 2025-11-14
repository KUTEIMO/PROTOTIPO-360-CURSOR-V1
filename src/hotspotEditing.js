import { announceHotspot } from './announcer.js';

const STORAGE_KEY = 'tour.hotspotOverrides';
let overrides = loadOverrides();
let editMode = false;
let savedPointerEvents = null;
let stageElement = null;
let arrowNavigationHandler = null;

export function initHotspotEditing() {
  window.addEventListener('keydown', handleShortcut);
}

function handleShortcut(event) {
  if (event.defaultPrevented) return;

  const toggleCombination = event.ctrlKey && event.shiftKey && event.code === 'KeyH';
  const exportCombination = event.ctrlKey && event.shiftKey && event.code === 'KeyE';

  if (toggleCombination) {
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleEditMode();
  } else if (exportCombination && editMode) {
    event.preventDefault();
    event.stopImmediatePropagation();
    exportCurrentSceneOverrides();
  }
}

export function isEditMode() {
  return editMode;
}

export function getOverridesForScene(sceneId) {
  return overrides[sceneId] || {};
}

export function hydrateHotspotOverrides(map = {}) {
  if (!map || typeof map !== 'object') return;
  Object.keys(map).forEach((sceneId) => {
    const sceneOverrides = map[sceneId];
    if (!sceneOverrides || typeof sceneOverrides !== 'object') return;
    overrides[sceneId] = {
      ...sceneOverrides,
      ...(overrides[sceneId] || {})
    };
  });
  persistOverrides();
}

export function saveOverride(sceneId, hotspotId, yaw, pitch) {
  if (!overrides[sceneId]) {
    overrides[sceneId] = {};
  }
  overrides[sceneId][hotspotId] = { yaw, pitch };
  persistOverrides();
}

function toggleEditMode() {
  editMode = !editMode;
  document.body.classList.toggle('hotspot-edit-mode', editMode);

  if (editMode) {
    enableEditEnvironment();
  } else {
    disableEditEnvironment();
  }

  const message = editMode
    ? 'Modo edición activado. Usa las flechas para ajustar la vista, arrastra un hotspot y presiona Ctrl+Shift+E para descargar los cambios.'
    : 'Modo edición de hotspots desactivado.';
  announceHotspot(message);
}

function exportCurrentSceneOverrides() {
  const sceneId = window.appState?.currentSceneId;
  if (!sceneId) {
    console.info('No hay escena activa para exportar.');
    return;
  }

  const payload = JSON.stringify(overrides, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'hotspot-overrides.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);

  console.group('Hotspots ajustados (todas las escenas)');
  console.log(payload);
  console.groupEnd();
  announceHotspot('Archivo hotspot-overrides.json descargado. Súbelo a la raíz del proyecto para mantener los cambios.');
}

function loadOverrides() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    return JSON.parse(stored);
  } catch (error) {
    console.warn('No se pudieron cargar los ajustes de hotspots guardados.', error);
    return {};
  }
}

function persistOverrides() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch (error) {
    console.warn('No se pudo guardar la posición del hotspot.', error);
  }
}

function enableEditEnvironment() {
  const sceneEntry = window.appState?.scenes?.get(window.appState.currentSceneId);
  const viewer = window.appState?.viewer;
  stageElement = viewer?.stage?.domElement ? viewer.stage().domElement() : null;
  if (stageElement) {
    savedPointerEvents = stageElement.style.pointerEvents;
    stageElement.style.pointerEvents = 'none';
  }
  arrowNavigationHandler = (event) => handleEditNavigation(event);
  window.addEventListener('keydown', arrowNavigationHandler, true);
}

function disableEditEnvironment() {
  if (stageElement) {
    stageElement.style.pointerEvents = savedPointerEvents || '';
    stageElement = null;
  }
  if (arrowNavigationHandler) {
    window.removeEventListener('keydown', arrowNavigationHandler, true);
    arrowNavigationHandler = null;
  }
}

function handleEditNavigation(event) {
  if (!editMode) return;
  const sceneEntry = window.appState?.scenes?.get(window.appState.currentSceneId);
  const view = sceneEntry?.view;
  if (!view) return;
  const key = event.key;
  const stepYaw = 0.04;
  const stepPitch = 0.03;
  const stepZoom = 0.05;
  let handled = false;

  switch (key) {
    case 'ArrowLeft':
      view.setYaw(view.yaw() - stepYaw);
      handled = true;
      break;
    case 'ArrowRight':
      view.setYaw(view.yaw() + stepYaw);
      handled = true;
      break;
    case 'ArrowUp':
      view.setPitch(view.pitch() + stepPitch);
      handled = true;
      break;
    case 'ArrowDown':
      view.setPitch(view.pitch() - stepPitch);
      handled = true;
      break;
    case '+':
    case '=':
      view.setFov(Math.max(view.limit().minFov(), view.fov() - stepZoom));
      handled = true;
      break;
    case '-':
    case '_':
      view.setFov(Math.min(view.limit().maxFov(), view.fov() + stepZoom));
      handled = true;
      break;
    default:
      break;
  }

  if (handled) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}


