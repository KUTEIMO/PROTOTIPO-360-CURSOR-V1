import { announceScene } from './announcer.js';

export function initMenu(config, viewerApi) {
  const list = document.getElementById('sceneGroupList');
  if (!list) return;

  const grouped = groupScenes(config.scenes);
  list.innerHTML = '';

  Object.entries(grouped).forEach(([zoneKey, scenes]) => {
    const groupItem = createGroupItem(zoneKey, scenes, config, viewerApi);
    list.appendChild(groupItem);
  });

  setupMenuToggle();
}

function groupScenes(scenes) {
  return scenes.reduce((acc, scene) => {
    const zone = scene.zone || 'sin-zona';
    if (!acc[zone]) acc[zone] = [];
    acc[zone].push(scene);
    return acc;
  }, {});
}

function createGroupItem(zoneKey, scenes, config, viewerApi) {
  const zoneLabel = config.zones?.[zoneKey] || zoneKey;

  const item = document.createElement('li');
  item.className = 'scene-group';
  item.setAttribute('role', 'treeitem');
  item.setAttribute('aria-expanded', 'false');

  const headerButton = document.createElement('button');
  headerButton.type = 'button';
  headerButton.className = 'scene-group__header';
  headerButton.innerHTML = `
    <span class="scene-group__name">${zoneLabel}</span>
    <span class="scene-group__toggle" aria-hidden="true">+</span>
  `;
  item.appendChild(headerButton);

  const sceneList = document.createElement('ul');
  sceneList.className = 'scene-sublist';
  sceneList.setAttribute('role', 'group');
  sceneList.hidden = true;

  scenes
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .forEach((scene) => {
      const sceneItem = document.createElement('li');
      sceneItem.className = 'scene-sublist__item';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'scene-button';
      button.dataset.sceneId = scene.id;
      button.textContent = scene.shortTitle || scene.title;

      button.addEventListener('click', () => {
        viewerApi.switchScene(scene.id);
        announceScene(`Escena seleccionada: ${scene.title}`);
        closeMenuOnSelection();
      });

      button.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          viewerApi.switchScene(scene.id);
          closeMenuOnSelection();
        }
      });

      sceneItem.appendChild(button);
      sceneList.appendChild(sceneItem);
    });

  item.appendChild(sceneList);

  headerButton.addEventListener('click', () => {
    const expanded = item.getAttribute('aria-expanded') === 'true';
    item.setAttribute('aria-expanded', String(!expanded));
    headerButton.querySelector('.scene-group__toggle').textContent = expanded ? '+' : '−';
    sceneList.hidden = expanded;
  });

  return item;
}

function setupMenuToggle() {
  const toggle = document.getElementById('menuToggle');
  const menu = document.getElementById('sceneMenu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    menu.setAttribute('aria-expanded', String(!expanded));
    menu.classList.toggle('scene-menu--open', !expanded);
  });
}

function closeMenuOnSelection() {
  const toggle = document.getElementById('menuToggle');
  const menu = document.getElementById('sceneMenu');
  if (!toggle || !menu) return;

  toggle.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-expanded', 'false');
  menu.classList.remove('scene-menu--open');
}

