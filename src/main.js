import { loadConfig } from './configLoader.js';
import { initViewer } from './viewer.js';
import { initMenu } from './menu.js';
import { initAccessibilityControls, openHelpDialog, applyInitialAccessibilityState } from './accessibility.js';
import { initFallback } from './fallback.js';
import { initHotspotPanel, openHotspotPanel } from './hotspotPanel.js';
import { initKeyboardControls } from './keyboardControls.js';
import { initNavigation, updateNavigation } from './navigation.js';
import { appState, selectors } from './state.js';
import { focusFirstHotspot } from './hotspotManager.js';
import { initHotspotEditing, hydrateHotspotOverrides } from './hotspotEditing.js';

document.addEventListener('DOMContentLoaded', () => {
  startApp().catch(handleFatalError);
});

async function startApp() {
  initFallback();
  initHotspotPanel();

  const config = await loadConfig();
  appState.config = config;
  window.appState = appState;
  hydrateHotspotOverrides(config.overrides || {});

  const viewerApi = initViewer(config, {
    onViewerReady: (api) => {
      initKeyboardControls(api);
      initNavigation(config, api);
      initHotspotEditing();
    },
    onSceneChange: (sceneData) => {
      updateNavigation(sceneData.id);
      updateKeyboardInstructions(sceneData);
      updateShareLink();
      highlightQuickAccess(sceneData.id);
    },
    onHotspotOpen: (sceneData, hotspotData, options) => {
      openHotspotPanel(sceneData, hotspotData, options);
    }
  });

  initMenu(config, viewerApi);
  initAccessibilityControls(config);
  applyInitialAccessibilityState();
  setupShareDialog();
  buildQuickAccessList(config, viewerApi);
  setupHelpAndInstructions(config);
  updateNavigation(appState.currentSceneId);
  updateShareLink();

  const skipHotspots = document.getElementById('skipHotspots');
  if (skipHotspots) {
    skipHotspots.addEventListener('click', (event) => {
      event.preventDefault();
      focusFirstHotspot();
    });
  }

  const skipMenu = document.getElementById('skipMenu');
  if (skipMenu) {
    skipMenu.addEventListener('click', (event) => {
      event.preventDefault();
      const menu = document.getElementById('sceneMenu');
      const toggle = document.getElementById('menuToggle');
      if (menu && toggle) {
        toggle.setAttribute('aria-expanded', 'true');
        menu.setAttribute('aria-expanded', 'true');
        menu.classList.add('scene-menu--open');
      }
      const firstSceneButton = document.querySelector('.scene-button');
      if (firstSceneButton instanceof HTMLElement) {
        firstSceneButton.focus();
      }
    });
  }
}

function updateKeyboardInstructions(sceneData) {
  const container = document.getElementById('keyboardInstructions');
  if (!container) return;

  const instructions = sceneData.keyboardShortcuts || [];
  const fallback = 'Usa las flechas para rotar, + y - para zoom, y Tab para navegar por los controles.';

  container.textContent = instructions.length > 0 ? instructions.join(' • ') : fallback;
  if (!container.hasAttribute('data-manual')) {
    container.setAttribute('hidden', '');
  }
}

function handleFatalError(error) {
  console.error('Error crítico en la aplicación', error);
  const fallback = document.getElementById('noJsMessage');
  if (fallback) {
    fallback.removeAttribute('hidden');
    fallback.style.display = 'block';
    fallback.innerHTML = `
      <h2>Ocurrió un error al iniciar el tour</h2>
      <p>${error.message}</p>
      <p>Revisa el archivo README para más información o vuelve a intentarlo.</p>
    `;
  }
}

function setupShareDialog() {
  const openButton = document.getElementById('shareButton');
  const dialog = document.getElementById('shareDialog');
  const closeButton = document.getElementById('closeShareDialog');
  const copyButton = document.getElementById('copyShareLink');
  const input = document.getElementById('shareInput');
  const status = document.getElementById('shareStatus');
  if (!openButton || !dialog || !closeButton || !copyButton || !input) return;

  const openDialog = () => {
    updateShareLink();
    dialog.showModal();
    status.textContent = '';
    requestAnimationFrame(() => {
      input.select();
    });
  };

  openButton.addEventListener('click', () => {
    openDialog();
  });

  closeButton.addEventListener('click', () => {
    dialog.close();
    openButton.focus();
  });

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    dialog.close();
    openButton.focus();
  });

  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(input.value);
      status.textContent = 'Enlace copiado al portapapeles.';
    } catch (error) {
      console.warn('No se pudo copiar automáticamente.', error);
      status.textContent = 'No se pudo copiar automáticamente. Selecciona y copia el texto.';
    }
  });
}

function updateShareLink() {
  const input = document.getElementById('shareInput');
  if (!input) return;
  const url = new URL(window.location.href);
  if (appState.currentSceneId) {
    url.searchParams.set('scene', appState.currentSceneId);
  } else {
    url.searchParams.delete('scene');
  }
  input.value = url.toString();
}

function buildQuickAccessList(config, viewerApi) {
  const list = document.getElementById('hotspotList');
  if (!list) return;
  list.innerHTML = '';

  const zonesSeen = new Set();
  const featured = [];
  config.scenes.forEach((scene) => {
    if (!scene.zone || zonesSeen.has(scene.zone)) return;
    zonesSeen.add(scene.zone);
    featured.push(scene);
    if (featured.length === 3) return;
  });

  const zoneLabels = appState.config?.zones || {};
  featured.forEach((scene) => {
    const item = document.createElement('li');
    item.className = 'hotspot-inline-item';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hotspot-inline-button hotspot-inline-button--featured';
    button.dataset.sceneId = scene.id;
    const zoneLabel = zoneLabels[scene.zone] || scene.zone || scene.title;
    button.innerHTML = `<span class="hotspot-inline-title">${zoneLabel}</span>`;
    button.addEventListener('click', () => viewerApi.switchScene(scene.id));
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        viewerApi.switchScene(scene.id);
      }
    });
    item.appendChild(button);
    list.appendChild(item);
  });

  if (featured.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'hotspot-inline-empty';
    emptyItem.textContent = 'Agrega escenas con zona para accesos directos.';
    list.appendChild(emptyItem);
  }

  highlightQuickAccess(appState.currentSceneId);
}

function highlightQuickAccess(sceneId) {
  const buttons = document.querySelectorAll('.hotspot-inline-button--featured');
  buttons.forEach((button) => {
    const isActive = button.dataset.sceneId === sceneId;
    button.classList.toggle('hotspot-inline-button--active', isActive);
    if (isActive) {
      button.setAttribute('aria-current', 'true');
    } else {
      button.removeAttribute('aria-current');
    }
  });
}

function setupHelpAndInstructions(config) {
  const infoButton = document.getElementById('helpToggle');
  const instructions = selectors.keyboardInstructions();
  if (!infoButton || !instructions) return;
  let infoTimeout = null;

  infoButton.addEventListener('click', (event) => {
    event.preventDefault();
    const hidden = instructions.hasAttribute('hidden');
    if (hidden) {
      instructions.removeAttribute('hidden');
      instructions.setAttribute('data-manual', 'true');
      clearTimeout(infoTimeout);
      infoTimeout = setTimeout(() => {
        instructions.setAttribute('hidden', '');
        instructions.removeAttribute('data-manual');
      }, 8000);
      return;
    }
    instructions.setAttribute('hidden', '');
    instructions.removeAttribute('data-manual');
    if (typeof openHelpDialog === 'function') {
      openHelpDialog(config);
    }
  });
}

