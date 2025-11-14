import { announceHotspot } from './announcer.js';
import { getSetting, selectors } from './state.js';
import { getOverridesForScene, isEditMode, saveOverride } from './hotspotEditing.js';

const ACTIVE_CLASS = 'hotspot--active';

let activeHotspotId = null;
let hotspotControls = [];
let dragState = null;

export function clearHotspots() {
  hotspotControls.forEach(({ control }) => {
    if (control && typeof control.destroy === 'function') {
      control.destroy();
    }
  });
  hotspotControls = [];
  activeHotspotId = null;
}

export function renderHotspots(sceneData, marzipanoScene, options = {}) {
  const { onOpenHotspot } = options;
  clearHotspots();

  applyStoredOverrides(sceneData);

  const container = marzipanoScene.hotspotContainer();

  sceneData.hotspots.forEach((hotspot) => {
    const button = createHotspotButton({
      sceneData,
      hotspot,
      onOpenHotspot
    });

    const control = container.createHotspot(button, {
      yaw: hotspot.yaw,
      pitch: hotspot.pitch
    });

    hotspotControls.push({ control, sceneId: sceneData.id, hotspot });
    registerEditableBehavior(button, control, sceneData, hotspot, marzipanoScene);
  });
}

export function focusFirstHotspot() {
  const quickButton = document.querySelector('.hotspot-inline-button--featured');
  if (quickButton instanceof HTMLElement) {
    quickButton.focus();
    return;
  }
  const hotspot = document.querySelector('.hotspot');
  if (hotspot instanceof HTMLElement) {
    hotspot.focus();
  }
}

export function setActiveHotspot(hotspotId) {
  activeHotspotId = hotspotId;
  document.querySelectorAll('.hotspot').forEach((element) => {
    if (element.dataset.hotspotId === hotspotId) {
      element.classList.add(ACTIVE_CLASS);
      element.setAttribute('aria-pressed', 'true');
    } else {
      element.classList.remove(ACTIVE_CLASS);
      element.setAttribute('aria-pressed', 'false');
    }
  });
}

function applyStoredOverrides(sceneData) {
  const overrides = getOverridesForScene(sceneData.id);
  sceneData.hotspots.forEach((hotspot) => {
    const override = overrides[hotspot.id];
    if (override) {
      hotspot.yaw = override.yaw;
      hotspot.pitch = override.pitch;
    }
  });
}

function createHotspotButton({ sceneData, hotspot, onOpenHotspot }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `hotspot hotspot--${hotspot.type || 'info'}`;
  button.dataset.hotspotId = hotspot.id;
  button.dataset.hotspotType = hotspot.type || 'info';
  button.setAttribute('role', 'button');
  button.setAttribute('tabindex', '0');
  button.setAttribute('aria-label', hotspot.title);
  button.setAttribute('aria-describedby', getDescriptionId(sceneData, hotspot));
  button.setAttribute('aria-pressed', 'false');

  const icon = document.createElement('span');
  icon.className = 'hotspot__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = hotspot.icon || '⬤';
  button.appendChild(icon);

  const srDescription = document.createElement('span');
  srDescription.id = getDescriptionId(sceneData, hotspot);
  srDescription.className = 'sr-only';
  srDescription.textContent = hotspot.altText;
  button.appendChild(srDescription);

  const handleActivate = () => {
    if (isEditMode()) return;
    if (typeof onOpenHotspot === 'function') {
      setActiveHotspot(hotspot.id);
      announceHotspot(`Hotspot abierto: ${hotspot.title}`);
      onOpenHotspot(sceneData, hotspot, {
        autoNarration: getSetting('autoNarration'),
        focusPanel: true
      });
    }
  };

  button.addEventListener('click', handleActivate);
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleActivate();
    }
  });

  return button;
}

function registerEditableBehavior(button, control, sceneData, hotspot, marzipanoScene) {
  button.addEventListener('pointerdown', (event) => {
    if (!isEditMode() || event.button !== 0) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    dragState = {
      pointerId: event.pointerId,
      control,
      hotspot,
      sceneId: sceneData.id,
      marzipanoScene
    };
  });

  button.addEventListener('pointermove', (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const coords = screenToCoordinates(event, dragState.marzipanoScene);
    if (!coords) return;
    dragState.control.setPosition(coords);
    dragState.hotspot.yaw = coords.yaw;
    dragState.hotspot.pitch = coords.pitch;
  });

  const finishDrag = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    try {
      button.releasePointerCapture(event.pointerId);
    } catch (_) {
      /* noop */
    }
    saveOverride(dragState.sceneId, dragState.hotspot.id, dragState.hotspot.yaw, dragState.hotspot.pitch);
    announceHotspot(`Hotspot "${dragState.hotspot.title}" reubicado.`);
    dragState = null;
  };

  button.addEventListener('pointerup', finishDrag);
  button.addEventListener('pointercancel', finishDrag);
}

function screenToCoordinates(event, marzipanoScene) {
  const panorama = selectors.panorama();
  if (!panorama) return null;
  const rect = panorama.getBoundingClientRect();
  const view = marzipanoScene.view();
  if (!view || typeof view.screenToCoordinates !== 'function') {
    return null;
  }
  const coords = view.screenToCoordinates({
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  });
  return coords;
}

function getDescriptionId(sceneData, hotspot) {
  return `hotspot-desc-${sceneData.id}-${hotspot.id}`;
}

