import { appState, selectors } from './state.js';
import { announceScene } from './announcer.js';
import { renderHotspots, clearHotspots } from './hotspotManager.js';
import { isEditMode } from './hotspotEditing.js';

const DEFAULT_TRANSITION = 500;

export function initViewer(config, callbacks = {}) {
  if (!window.Marzipano) {
    throw new Error('La librería Marzipano no se ha cargado. Verifica la conexión a internet.');
  }

  const panorama = selectors.panorama();
  if (!panorama) {
    throw new Error('No se encontró el contenedor del visor 360.');
  }

  const viewer = new window.Marzipano.Viewer(panorama, {
    stageType: 'webgl',
    controls: {
      mouseViewMode: 'drag'
    }
  });

  const scenes = new Map();
  const defaultSceneId = config.defaultScene || config.scenes[0].id;
  const initialSceneId = resolveInitialScene(config, defaultSceneId);

  config.scenes.forEach((sceneData) => {
    const scene = createScene(viewer, config, sceneData);
    if (typeof scene.marzipanoScene?.preload === 'function') {
      scene.marzipanoScene.preload();
    }
    scenes.set(sceneData.id, scene);
  });

  appState.viewer = viewer;
  appState.scenes = scenes;

  function switchScene(sceneId, options = {}) {
    const sceneEntry = scenes.get(sceneId);
    if (!sceneEntry) {
      console.warn(`La escena "${sceneId}" no existe en la configuración.`);
      return;
    }

    const { marzipanoScene, data } = sceneEntry;
    const overlay = selectors.loadingOverlay();
    if (overlay) {
      overlay.removeAttribute('aria-hidden');
      overlay.style.display = 'flex';
    }

    marzipanoScene.switchTo({
      transitionDuration: options.transition === false ? 0 : DEFAULT_TRANSITION
    }, () => {
      if (overlay) {
        overlay.style.display = 'none';
        overlay.setAttribute('aria-hidden', 'true');
      }
    });

    appState.currentSceneId = sceneId;
    updateLocationHash(sceneId);
    updateSceneHeader(data);
    renderHotspots(data, marzipanoScene, {
      onOpenHotspot: handleHotspotOpen,
      onNavigateScene: switchScene
    });
    announceScene(`${data.title}. ${data.longDescription}`);
    callbacks.onSceneChange?.(data);
  }

  function updateSceneHeader(data) {
    const title = selectors.sceneTitle();
    const zone = selectors.sceneZone();
    if (title) {
      title.textContent = data.title;
    }
    if (zone) {
      const zoneLabel = config.zones?.[data.zone] || data.zone || 'Escena sin zona asignada';
      zone.textContent = `Zona: ${zoneLabel}`;
    }
  }

  function handleHotspotOpen(sceneData, hotspotData, options = {}) {
    callbacks.onHotspotOpen?.(sceneData, hotspotData, options);
  }

  function getCurrentScene() {
    if (!appState.currentSceneId) return null;
    return scenes.get(appState.currentSceneId) || null;
  }

  function getSceneData(sceneId) {
    const entry = scenes.get(sceneId);
    return entry ? entry.data : null;
  }

  function getView() {
    const current = getCurrentScene();
    return current ? current.view : null;
  }

  function destroy() {
    clearHotspots();
    viewer.destroy();
  }

  switchScene(initialSceneId, { transition: false });

  const api = {
    switchScene,
    getCurrentScene,
    getSceneData,
    getView,
    destroy,
    getScenes: () => scenes
  };

  initPointerNavigation(api.switchScene);
  callbacks.onViewerReady?.(api);

  return api;
}

function createScene(viewer, config, sceneData) {
  const source = window.Marzipano.ImageUrlSource.fromString(`${config.basePath}${sceneData.file}`);

  const levels = (sceneData.levels || []).map((level) => ({
    tileSize: level.tileSize,
    size: level.size,
    fallbackOnly: level.fallbackOnly
  }));

  const geometry = levels.length
    ? new window.Marzipano.CubeGeometry(levels)
    : new window.Marzipano.EquirectGeometry([{ width: sceneData.width || 8192 }]);

  const limiter = window.Marzipano.RectilinearView.limit.traditional(
    sceneData.maxResolution || 2048,
    (sceneData.maxFov || 120) * Math.PI / 180
  );

  const initialView = sceneData.initialView || { yaw: 0, pitch: 0, fov: Math.PI / 2 };
  const view = new window.Marzipano.RectilinearView(initialView, limiter);

  const marzipanoScene = viewer.createScene({
    source,
    geometry,
    view,
    pinFirstLevel: true
  });

  return {
    data: sceneData,
    marzipanoScene,
    view
  };
}

function initPointerNavigation(switchScene) {
  const panorama = selectors.panorama();
  const cue = selectors.directionCue();
  if (!panorama || !cue) return;

  let hideTimeout = null;

  const hideCue = () => {
    cue.classList.remove('direction-cue--visible');
    cue.style.left = '';
    cue.style.top = '';
    cue.style.transform = '';
  };

  const scheduleHide = () => {
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(hideCue, 1500);
  };

  const getPointerCoordinates = (event) => {
    const current = appState.scenes.get(appState.currentSceneId);
    if (!current) return null;
    const view = current.view;
    if (!view || typeof view.screenToCoordinates !== 'function') return null;
    const rect = panorama.getBoundingClientRect();
    return view.screenToCoordinates({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  };

  const selectNavTarget = (yaw, pitch) => {
    const current = appState.scenes.get(appState.currentSceneId);
    const targets = current?.data?.navigationHotspots || [];
    if (!targets.length) return null;
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;
    targets.forEach((target) => {
      const yawDiff = shortestAngleDiff(yaw, target.yaw);
      const pitchDiff = pitch - target.pitch;
      const score = Math.abs(yawDiff) + Math.abs(pitchDiff) * 0.5;
      if (score < bestScore) {
        bestScore = score;
        best = { target, yawDiff, score };
      }
    });
    if (!best || best.score > 0.6) return null;
    return best;
  };

  const positionCue = (event, navSelection) => {
    const rect = panorama.getBoundingClientRect();
    const percentX = ((event.clientX - rect.left) / rect.width) * 100;
    const percentY = ((event.clientY - rect.top) / rect.height) * 100;
    cue.style.left = `${percentX}%`;
    cue.style.top = `${percentY}%`;
    const rotationDeg = navSelection.yawDiff * (180 / Math.PI);
    cue.style.transform = `translate(-50%, -50%) rotate(${rotationDeg}deg)`;
    cue.classList.add('direction-cue--visible');
  };

  panorama.addEventListener('pointermove', (event) => {
    if (isEditMode() || event.pointerType === 'touch') {
      hideCue();
      return;
    }
    const coords = getPointerCoordinates(event);
    if (!coords) {
      hideCue();
      return;
    }
    const selection = selectNavTarget(coords.yaw, coords.pitch);
    if (!selection) {
      hideCue();
      return;
    }
    positionCue(event, selection);
    scheduleHide();
  });

  panorama.addEventListener('mouseleave', () => {
    hideCue();
  });

  panorama.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') {
      hideCue();
    }
  });

  panorama.addEventListener('dblclick', (event) => {
    if (isEditMode()) return;
    event.preventDefault();
    const coords = getPointerCoordinates(event);
    if (!coords) return;
    const selection = selectNavTarget(coords.yaw, coords.pitch);
    if (selection?.target?.target) {
      switchScene(selection.target.target);
    }
  });
}

function shortestAngleDiff(a, b) {
  let diff = (a - b + Math.PI) % (2 * Math.PI) - Math.PI;
  if (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

function resolveInitialScene(config, fallbackId) {
  try {
    const url = new URL(window.location.href);
    const sceneParam = url.searchParams.get('scene');
    if (!sceneParam) return fallbackId;
    const exists = config.scenes.some((scene) => scene.id === sceneParam);
    return exists ? sceneParam : fallbackId;
  } catch (_error) {
    return fallbackId;
  }
}

function updateLocationHash(sceneId) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('scene', sceneId);
    window.history.replaceState({}, '', url);
  } catch (_error) {
    // Ignorar si el navegador no permite modificar el historial
  }
}

