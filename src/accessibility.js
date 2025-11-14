import { appState, updateSetting, getSetting } from './state.js';

const FONT_STEP = 0.1;
const FONT_MIN = 0.8;
const FONT_MAX = 1.6;
const STORAGE_KEY = 'tour.accessibilityPrefs';

let lastFocusedElement = null;
let storedSettings = loadStoredSettings();
let helpDialogOpener = null;
let storedConfig = null;

export function initAccessibilityControls(config) {
  storedConfig = config;
  setupTextSizeButtons();
  setupContrastButtons();
  setupAccessibleMode();
  setupAccessibilityPanel();
  helpDialogOpener = setupHelpDialog(config);
}

export function applyInitialAccessibilityState() {
  const settings = {
    textScale: storedSettings.textScale ?? 1,
    highContrast: storedSettings.highContrast ?? false,
    accessibleMode: storedSettings.accessibleMode ?? false,
    autoNarration: storedSettings.autoNarration ?? false,
    autoCaptions: storedSettings.autoCaptions ?? false
  };

  Object.assign(appState.settings, settings);
  applyFontScale(settings.textScale);
  applyContrast(settings.highContrast);
  applyAccessibleMode(settings.accessibleMode, { skipSync: true });
  updateSetting('autoNarration', settings.autoNarration);
  updateSetting('autoCaptions', settings.autoCaptions);

  const accessibleToggle = document.getElementById('accessibleModeToggle');
  if (accessibleToggle) accessibleToggle.checked = settings.accessibleMode;
  const narrationToggle = document.getElementById('textToSpeechToggle');
  if (narrationToggle) narrationToggle.checked = settings.autoNarration;
  const captionToggle = document.getElementById('captionAutoToggle');
  if (captionToggle) captionToggle.checked = settings.autoCaptions;
}

export function openHelpDialog(configOverride) {
  if (typeof helpDialogOpener === 'function') {
    helpDialogOpener(configOverride || storedConfig);
  }
}

function setupTextSizeButtons() {
  const buttons = document.querySelectorAll('[data-font-size]');
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.fontSize;
      const current = getSetting('textScale');
      let next = current;

      if (action === 'increase') {
        next = Math.min(FONT_MAX, current + FONT_STEP);
      } else if (action === 'decrease') {
        next = Math.max(FONT_MIN, current - FONT_STEP);
      } else if (action === 'reset') {
        next = 1;
      }

      updateSetting('textScale', next);
      applyFontScale(next);
      persistSettings();
    });
  });
}

function applyFontScale(scale) {
  document.documentElement.style.setProperty('--font-scale', scale.toString());
}

function setupContrastButtons() {
  const buttons = document.querySelectorAll('[data-contrast]');
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const contrast = button.dataset.contrast;
      const highContrast = contrast === 'high';
      updateSetting('highContrast', highContrast);
      applyContrast(highContrast);
      persistSettings();
    });
  });
}

function applyContrast(highContrast) {
  document.body.classList.toggle('theme-high-contrast', highContrast);
}

function setupAccessibleMode() {
  const toggle = document.getElementById('accessibleModeToggle');
  if (toggle) {
    toggle.checked = getSetting('accessibleMode');
    toggle.addEventListener('change', (event) => {
      const enabled = event.target.checked;
      applyAccessibleMode(enabled);
      persistSettings();
    });
  }

  const narrationToggle = document.getElementById('textToSpeechToggle');
  if (narrationToggle) {
    narrationToggle.checked = getSetting('autoNarration');
    narrationToggle.addEventListener('change', (event) => {
      const enabled = event.target.checked;
      updateSetting('autoNarration', enabled);
      persistSettings();
    });
  }

  const captionToggle = document.getElementById('captionAutoToggle');
  if (captionToggle) {
    captionToggle.checked = getSetting('autoCaptions');
    captionToggle.addEventListener('change', (event) => {
      const enabled = event.target.checked;
      updateSetting('autoCaptions', enabled);
      persistSettings();
    });
  }
}

function applyAccessibleMode(enabled, options = {}) {
  const skipSync = options.skipSync;
  document.body.classList.toggle('accessible-mode', enabled);
  updateSetting('accessibleMode', enabled);

  if (!skipSync) {
    if (enabled) {
      updateSetting('autoNarration', true);
      updateSetting('autoCaptions', true);
      updateSetting('highContrast', true);
      updateSetting('textScale', Math.min(FONT_MAX, Math.max(1.2, getSetting('textScale'))));
      applyFontScale(getSetting('textScale'));
      applyContrast(true);
      const narrationToggle = document.getElementById('textToSpeechToggle');
      if (narrationToggle) narrationToggle.checked = true;
      const captionToggle = document.getElementById('captionAutoToggle');
      if (captionToggle) captionToggle.checked = true;
      const contrastHigh = document.querySelector('[data-contrast="high"]');
      if (contrastHigh) contrastHigh.focus();
    } else {
      updateSetting('autoNarration', false);
      updateSetting('autoCaptions', false);
      updateSetting('highContrast', false);
      updateSetting('textScale', 1);
      applyFontScale(1);
      applyContrast(false);
      const narrationToggle = document.getElementById('textToSpeechToggle');
      if (narrationToggle) narrationToggle.checked = false;
      const captionToggle = document.getElementById('captionAutoToggle');
      if (captionToggle) captionToggle.checked = false;
    }
    persistSettings();
  }
}

function setupAccessibilityPanel() {
  const openButton = document.getElementById('accessibilityToggle');
  const panel = document.getElementById('accessibilityMenu');
  const closeButton = document.getElementById('closeAccessibility');

  if (!openButton || !panel || !closeButton) return;

  openButton.addEventListener('click', () => {
    const expanded = openButton.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      closePanel(openButton, panel);
    } else {
      openPanel(openButton, panel, closeButton);
    }
  });

  closeButton.addEventListener('click', () => closePanel(openButton, panel));

  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closePanel(openButton, panel, true);
    } else if (event.key === 'Tab') {
      trapFocus(panel, event);
    }
  });
}

function openPanel(trigger, panel, closeButton) {
  lastFocusedElement = document.activeElement;
  trigger.setAttribute('aria-expanded', 'true');
  panel.removeAttribute('hidden');
  panel.classList.add('accessibility-menu--open');
  panel.focus();

  requestAnimationFrame(() => {
    closeButton.focus();
  });
}

function closePanel(trigger, panel, restoreFocus = false) {
  trigger.setAttribute('aria-expanded', 'false');
  panel.setAttribute('hidden', 'hidden');
  panel.classList.remove('accessibility-menu--open');

  if (restoreFocus && lastFocusedElement) {
    lastFocusedElement.focus();
  } else {
    trigger.focus();
  }
}

function trapFocus(container, event) {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ];
  const focusableElements = Array.from(container.querySelectorAll(focusableSelectors.join(',')));

  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

function setupHelpDialog(config) {
  const helpDialog = document.getElementById('helpDialog');
  const closeButton = document.getElementById('closeHelpDialog');
  const list = document.getElementById('helpShortcutsList');

  if (!helpDialog || !closeButton || !list) return null;

  const open = (conf = config) => {
    helpDialog.showModal();
    populateHelpShortcuts(list, conf);
    requestAnimationFrame(() => {
      closeButton.focus();
    });
  };

  closeButton.addEventListener('click', () => {
    helpDialog.close();
  });

  helpDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    helpDialog.close();
  });

  return open;
}

function populateHelpShortcuts(list, config) {
  list.innerHTML = '';
  const shortcuts = config?.shortcuts || [
    'Flechas ← →: rotar horizontalmente',
    'Flechas ↑ ↓: inclinar la vista',
    '+ / - : acercar y alejar',
    'Q / E: inclinar verticalmente',
    'Tab: navegar entre controles y hotspots'
  ];

  shortcuts.forEach((line) => {
    const item = document.createElement('li');
    item.textContent = line;
    list.appendChild(item);
  });
}

function loadStoredSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn('No se pudieron cargar las preferencias de accesibilidad.', error);
    return {};
  }
}

function persistSettings() {
  storedSettings = {
    textScale: getSetting('textScale'),
    highContrast: getSetting('highContrast'),
    accessibleMode: getSetting('accessibleMode'),
    autoNarration: getSetting('autoNarration'),
    autoCaptions: getSetting('autoCaptions')
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSettings));
  } catch (error) {
    console.warn('No se pudieron guardar las preferencias de accesibilidad.', error);
  }
}

