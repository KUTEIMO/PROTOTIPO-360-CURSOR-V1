const KEY_ACTIONS = {
  ArrowLeft: { yaw: -0.1 },
  ArrowRight: { yaw: 0.1 },
  ArrowUp: { pitch: -0.05 },
  ArrowDown: { pitch: 0.05 },
  '+': { zoom: -0.1 },
  '=': { zoom: -0.1 },
  '-': { zoom: 0.1 },
  _: { zoom: 0.1 },
  q: { roll: -0.05 },
  Q: { roll: -0.05 },
  e: { roll: 0.05 },
  E: { roll: 0.05 }
};

export function initKeyboardControls(viewerApi) {
  const panorama = document.getElementById('panorama');
  if (!panorama) return;

  panorama.addEventListener('keydown', (event) => {
    if (!KEY_ACTIONS[event.key]) return;
    event.preventDefault();
    applyAction(viewerApi, KEY_ACTIONS[event.key]);
  });
}

function applyAction(viewerApi, action) {
  const view = viewerApi.getView();
  if (!view) return;

  if (action.yaw) {
    const currentYaw = view.yaw();
    view.setYaw(currentYaw + action.yaw);
  }

  if (action.pitch) {
    const currentPitch = view.pitch();
    view.setPitch(currentPitch + action.pitch);
  }

  if (typeof action.zoom !== 'undefined') {
    const currentFov = view.fov();
    view.setFov(currentFov + action.zoom);
  }

  if (action.roll) {
    const currentRoll = view.roll ? view.roll() : 0;
    if (view.setRoll) {
      view.setRoll(currentRoll + action.roll);
    }
  }
}

