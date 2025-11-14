function updateLiveRegion(element, message) {
  if (!element) return;
  element.textContent = '';
  requestAnimationFrame(() => {
    element.textContent = message;
  });
}

export function announceScene(message) {
  const region = document.getElementById('sceneAnnouncement');
  updateLiveRegion(region, message);
}

export function announceHotspot(message) {
  const region = document.getElementById('hotspotAnnouncement');
  updateLiveRegion(region, message);
}

