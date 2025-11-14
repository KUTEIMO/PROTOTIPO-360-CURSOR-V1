export const appState = {
  config: null,
  viewer: null,
  scenes: new Map(),
  currentSceneId: null,
  settings: {
    accessibleMode: false,
    textScale: 1,
    highContrast: false,
    autoNarration: false,
    autoCaptions: false
  }
};

export const selectors = {
  panorama: () => document.getElementById('panorama'),
  sceneTitle: () => document.getElementById('sceneTitle'),
  sceneZone: () => document.getElementById('sceneZone'),
  hotspotList: () => document.getElementById('hotspotList'),
  loadingOverlay: () => document.getElementById('loadingOverlay'),
  sceneAnnouncement: () => document.getElementById('sceneAnnouncement'),
  hotspotAnnouncement: () => document.getElementById('hotspotAnnouncement'),
  hotspotPanel: () => document.getElementById('hotspotPanel'),
  keyboardInstructions: () => document.getElementById('keyboardInstructions'),
  directionCue: () => document.getElementById('directionCue')
};

export function updateSetting(key, value) {
  appState.settings[key] = value;
}

export function getSetting(key) {
  return appState.settings[key];
}

