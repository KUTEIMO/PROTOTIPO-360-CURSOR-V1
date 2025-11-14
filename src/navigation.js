const sceneOrder = [];
const sceneIndex = new Map();
let nextButton = null;
let prevButton = null;
let viewerReference = null;

export function initNavigation(config, viewerApi) {
  viewerReference = viewerApi;
  nextButton = document.getElementById('nextScene');
  prevButton = document.getElementById('prevScene');

  if (!nextButton || !prevButton) return;

  config.scenes
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .forEach((scene, index) => {
      sceneOrder.push(scene.id);
      sceneIndex.set(scene.id, index);
    });

  nextButton.addEventListener('click', () => gotoRelative(1));
  prevButton.addEventListener('click', () => gotoRelative(-1));
}

export function updateNavigation(currentSceneId) {
  if (!nextButton || !prevButton || !sceneIndex.has(currentSceneId)) return;

  const index = sceneIndex.get(currentSceneId);
  const isFirst = index === 0;
  const isLast = index === sceneOrder.length - 1;

  prevButton.disabled = isFirst;
  nextButton.disabled = isLast;
  prevButton.setAttribute('aria-disabled', String(isFirst));
  nextButton.setAttribute('aria-disabled', String(isLast));
}

function gotoRelative(step) {
  const currentScene = viewerReference.getCurrentScene();
  if (!currentScene) return;

  const currentId = currentScene.data.id;
  const currentIndex = sceneIndex.get(currentId);
  if (typeof currentIndex === 'undefined') return;

  let nextIndex = currentIndex + step;
  nextIndex = Math.max(0, Math.min(sceneOrder.length - 1, nextIndex));

  const nextId = sceneOrder[nextIndex];
  if (nextId && nextId !== currentId) {
    viewerReference.switchScene(nextId);
  }
}

