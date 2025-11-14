const DEFAULT_AUDIO_DATA_URI =
  'data:audio/wav;base64,UklGRjwAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQwAAAAA////AP7+/v7+/v39/f3+/v7+/v7+/f39/f3+/v7+/v7+/f39/f3+/v7+/v7+/f39/f3+/v7+/v7+/f39/f3+/v7+/v7+/f39/f3+/v7+/v7+/f39/f3+/v7+/v7+/f39/f3+/v7+/v7+/f39/f3+/v7+/v7+/f39/f3+/v7+/v7+/f39/f3+/v7+/v7+/f39/f3+/v7+/v7+/f39/f3+/v7+/v7+/f39/f3+/v7+/v7+/f39/f3+/v7+/v7+/f39/f3+/v7+/v7+';
const FALLBACK_LONG_DESC_PREFIX = 'Vista 360° del recorrido virtual';
const DEFAULT_INFO_ICON = 'ⓘ';
const FALLBACK_POSITIONS = [
  { yaw: 0, pitch: 0 },
  { yaw: Math.PI / 3, pitch: -0.1 },
  { yaw: -Math.PI / 3, pitch: 0.05 },
  { yaw: Math.PI / 2, pitch: -0.05 },
  { yaw: -Math.PI / 2, pitch: -0.05 }
];

export async function loadConfig() {
  const response = await fetch('config.json', {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`No se pudo cargar config.json (estado ${response.status})`);
  }

  const rawConfig = await response.json();
  const externalOverrides = await loadExternalOverrides();
  const normalized = normalizeConfig(rawConfig, externalOverrides);
  validateConfig(normalized);
  return normalized;
}

async function loadExternalOverrides() {
  try {
    const response = await fetch('hotspot-overrides.json', { cache: 'no-store' });
    if (!response.ok) {
      return {};
    }
    const data = await response.json();
    return typeof data === 'object' && data ? data : {};
  } catch (error) {
    console.warn('No se pudo cargar hotspot-overrides.json', error);
    return {};
  }
}

function normalizeConfig(raw, externalOverrides = {}) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('El archivo de configuración no tiene un formato JSON válido.');
  }

  const sceneEntries = Array.isArray(raw.scenes) ? raw.scenes : [];
  if (sceneEntries.length === 0) {
    throw new Error('La configuración debe incluir al menos una escena.');
  }

  const accessibleOverrides = raw.accessibleScenes || {};
  const sceneNames = raw.sceneNames || {};
  const zones = raw.zones || {};
  const defaultShortcuts = raw.shortcuts || [];
  const rawHotspots = raw.hotspots || {};

  const temporaryScenes = sceneEntries.map((entry, index) => {
    const file = entry.file;
    const override = accessibleOverrides[file] || {};
    const resolvedTitle = override.title || sceneNames[file] || file;
    const id = override.id || slugify(file);
    const zoneKey = override.zone || entry.zone || null;
    const zoneLabel = zones[zoneKey] || zoneKey || 'Área general';

    const scene = {
      id,
      file,
      title: resolvedTitle,
      shortTitle: override.shortTitle || cleanSceneTitle(resolvedTitle),
      zone: zoneKey,
      order: typeof override.order === 'number' ? override.order : index,
      altText: override.altText || cleanSceneTitle(resolvedTitle),
      longDescription:
        override.longDescription ||
        `${FALLBACK_LONG_DESC_PREFIX} en ${zoneLabel}: ${resolvedTitle}. Usa el ratón o el teclado para moverte.`,
      narration: override.narration || DEFAULT_AUDIO_DATA_URI,
      transcript: override.transcript || null,
      captionFile: override.captionFile || null,
      initialView: override.initialView || null,
      keyboardShortcuts: override.keyboardShortcuts && override.keyboardShortcuts.length > 0
        ? override.keyboardShortcuts
        : defaultShortcuts,
      links: Array.isArray(override.links) ? override.links.slice() : [],
      hotspots: [],
      rawZoneKey: entry.zone || null
    };

    const normalizedHotspots = buildHotspotList({
      file,
      sceneId: scene.id,
      sceneTitle: resolvedTitle,
      zoneLabel,
      overrideHotspots: override.hotspots,
      rawHotspotEntries: rawHotspots[file],
      fallbackIndex: index
    });

    scene.hotspots = normalizedHotspots;
    ensureNarrationForHotspots(scene);

    return scene;
  });

  const fileToSceneId = new Map(temporaryScenes.map((scene) => [scene.file, scene.id]));

  // Normalizar enlaces definidos manualmente.
  temporaryScenes.forEach((scene) => {
    scene.links = (scene.links || []).map((link, idx) => {
      const targetFile = link.targetFile || link.target;
      const targetId = targetFile ? fileToSceneId.get(targetFile) : fileToSceneId.get(link.target);
      if (!targetId) return null;
      return {
        id: `${scene.id}-link-${idx}`,
        label: link.label || 'Ir a escena',
        target: targetId
      };
    }).filter(Boolean);
  });

  // Generar enlaces automáticos dentro de cada zona.
  const scenesByZone = groupScenesByZone(temporaryScenes);
  scenesByZone.forEach((scenes) => {
    scenes.sort((a, b) => a.order - b.order);
    scenes.forEach((scene, idx) => {
      const prevScene = scenes[idx - 1];
      const nextScene = scenes[idx + 1];
      if (prevScene) {
        scene.links.push({
          id: `${scene.id}-auto-prev`,
          label: `Ir a ${prevScene.title}`,
          target: prevScene.id
        });
      }
      if (nextScene) {
        scene.links.push({
          id: `${scene.id}-auto-next`,
          label: `Ir a ${nextScene.title}`,
          target: nextScene.id
        });
      }
    });
  });

  // Transformar enlaces en datos de navegación sin crear hotspots visibles.
  temporaryScenes.forEach((scene) => {
    scene.navigationHotspots = buildNavigationHotspots(scene, scene.links, fileToSceneId);
  });

  applyExternalOverrides(temporaryScenes, externalOverrides);

  const defaultSceneId = resolveDefaultScene(raw.defaultScene, fileToSceneId) || temporaryScenes[0].id;

  return {
    basePath: raw.basePath || '',
    defaultScene: defaultSceneId,
    shortcuts: defaultShortcuts,
    zones,
    scenes: temporaryScenes,
    overrides: externalOverrides
  };
}

function buildHotspotList({
  file,
  sceneId,
  sceneTitle,
  zoneLabel,
  overrideHotspots,
  rawHotspotEntries,
  fallbackIndex
}) {
  const fromOverride = normalizeHotspotArray(overrideHotspots, file, sceneId);
  if (fromOverride.length > 0) {
    return fromOverride;
  }

  const fromRaw = normalizeRawHotspots(rawHotspotEntries, file, sceneId);
  if (fromRaw.length > 0) {
    return fromRaw;
  }

  // Fallback hotspot informativo.
  const fallbackPosition = FALLBACK_POSITIONS[fallbackIndex % FALLBACK_POSITIONS.length];
  return [
    createInfoHotspot({
      sceneId,
      sceneTitle,
      zoneLabel,
      yaw: fallbackPosition.yaw,
      pitch: fallbackPosition.pitch
    })
  ];
}

function normalizeHotspotArray(hotspots, file, sceneId) {
  if (!Array.isArray(hotspots) || hotspots.length === 0) {
    return [];
  }

  return hotspots.map((hotspot, index) => {
    const coords = normalizeCoordinates(hotspot);
    const fallbackTitle = hotspot.title || `Hotspot ${index + 1}`;
    return {
      id: hotspot.id || `${sceneId}-hotspot-${index}`,
      title: fallbackTitle,
      type: hotspot.type || 'info',
      yaw: coords.yaw,
      pitch: coords.pitch,
      icon: hotspot.icon || DEFAULT_INFO_ICON,
      altText: hotspot.altText || fallbackTitle,
      description: hotspot.description || hotspot.altText || fallbackTitle,
      narration: hotspot.narration || DEFAULT_AUDIO_DATA_URI,
      transcript: hotspot.transcript || null,
      captionFile: hotspot.captionFile || null
    };
  });
}

function normalizeRawHotspots(rawHotspots, file, sceneId) {
  if (!Array.isArray(rawHotspots) || rawHotspots.length === 0) {
    return [];
  }

  return rawHotspots.map((hotspot, index) => {
    const coords = normalizeCoordinates(hotspot);
    const title = hotspot.title || `Punto de interés ${index + 1}`;
    return {
      id: hotspot.id || `${sceneId}-raw-${index}`,
      title,
      type: hotspot.type || 'info',
      yaw: coords.yaw,
      pitch: coords.pitch,
      icon: hotspot.icon || DEFAULT_INFO_ICON,
      altText: hotspot.description || title,
      description: hotspot.description || title,
      narration: hotspot.narration || DEFAULT_AUDIO_DATA_URI,
      transcript: hotspot.transcript || null,
      captionFile: hotspot.captionFile || null
    };
  });
}

function normalizeCoordinates(hotspot) {
  if (typeof hotspot?.yaw === 'number' && typeof hotspot?.pitch === 'number') {
    return { yaw: hotspot.yaw, pitch: hotspot.pitch };
  }

  if (hotspot && hotspot.position) {
    const { yaw, pitch } = vectorToAngles(hotspot.position);
    return { yaw, pitch };
  }

  return { yaw: 0, pitch: 0 };
}

function vectorToAngles(position) {
  const x = Number(position?.x) || 0;
  const y = Number(position?.y) || 0;
  const z = Number(position?.z) || 0;
  const length = Math.sqrt(x * x + y * y + z * z) || 1;
  const nx = x / length;
  const ny = y / length;
  const nz = z / length;
  const yaw = Math.atan2(nx, -nz);
  const pitch = Math.asin(Math.max(-1, Math.min(1, ny)));
  return { yaw, pitch };
}

function ensureNarrationForHotspots(scene) {
  const narration = scene.narration || DEFAULT_AUDIO_DATA_URI;
  scene.hotspots.forEach((hotspot) => {
    if (!hotspot.narration) {
      hotspot.narration = narration;
    }
  });
}

function groupScenesByZone(scenes) {
  const map = new Map();
  scenes.forEach((scene) => {
    const key = scene.zone || 'sin-zona';
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(scene);
  });
  return map;
}

function buildNavigationHotspots(scene, links, fileToSceneId) {
  if (!Array.isArray(links) || links.length === 0) {
    return [];
  }

  const navHotspots = [];
  links.forEach((link) => {
    const targetSceneId = link.target && typeof link.target === 'string' ? link.target : null;
    if (!targetSceneId) return;

    const isPrev =
      link.id?.toLowerCase().includes('prev') ||
      /volver|anterior/.test(link.label || '');
    const yaw = isPrev ? Math.PI * 0.85 : 0;
    const pitch = isPrev ? -0.05 : -0.05;
    const sequence = navHotspots.length;

    navHotspots.push({
      id: link.id || `${scene.id}-nav-${isPrev ? 'prev' : 'next'}-${sequence}`,
      title: link.label || 'Ir a escena',
      yaw,
      pitch,
      target: targetSceneId
    });
  });

  return navHotspots;
}

function resolveDefaultScene(defaultScene, fileToSceneId) {
  if (!defaultScene) return null;
  if (fileToSceneId.has(defaultScene)) {
    return fileToSceneId.get(defaultScene);
  }
  for (const [, id] of fileToSceneId) {
    if (id === defaultScene) {
      return id;
    }
  }
  return null;
}

function slugify(value) {
  return (value || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || 'scene';
}

function cleanSceneTitle(title) {
  if (!title) return 'Escena';
  return title.replace(/^\s*\d+[\.\-)]\s*/, '').trim();
}

function createInfoHotspot({ sceneId, sceneTitle, zoneLabel, yaw, pitch }) {
  const cleanTitle = cleanSceneTitle(sceneTitle);
  return {
    id: `${sceneId}-info`,
    title: cleanTitle,
    type: 'info',
    yaw,
    pitch,
    icon: DEFAULT_INFO_ICON,
    altText: `Información sobre ${cleanTitle}`,
    description: `${cleanTitle} en ${zoneLabel}. Explora los detalles de este punto destacado.`,
    narration: DEFAULT_AUDIO_DATA_URI,
    transcript: null,
    captionFile: null
  };
}

function applyExternalOverrides(scenes, overrides) {
  if (!overrides || typeof overrides !== 'object') return;
  scenes.forEach((scene) => {
    const sceneOverrides = overrides[scene.id];
    if (!sceneOverrides) return;
    scene.hotspots.forEach((hotspot) => {
      const override = sceneOverrides[hotspot.id];
      if (override && typeof override.yaw === 'number' && typeof override.pitch === 'number') {
        hotspot.yaw = override.yaw;
        hotspot.pitch = override.pitch;
      }
    });
  });
}

function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('La configuración normalizada no es válida.');
  }

  if (!Array.isArray(config.scenes) || config.scenes.length === 0) {
    throw new Error('La configuración debe incluir al menos una escena.');
  }

  const requiredSceneFields = ['id', 'title', 'file', 'altText', 'longDescription', 'hotspots'];

  config.scenes.forEach((scene) => {
    requiredSceneFields.forEach((field) => {
      if (typeof scene[field] === 'undefined' || scene[field] === null) {
        throw new Error(`La escena "${scene.title || scene.id}" no define el campo obligatorio "${field}".`);
      }
    });

    if (!Array.isArray(scene.hotspots)) {
      throw new Error(`La escena "${scene.id}" debe incluir un arreglo de hotspots.`);
    }

    scene.hotspots.forEach((hotspot) => {
      ['id', 'title', 'yaw', 'pitch', 'description', 'altText'].forEach((field) => {
        if (typeof hotspot[field] === 'undefined') {
          throw new Error(`El hotspot "${hotspot.id || hotspot.title}" de la escena "${scene.id}" necesita el campo "${field}".`);
        }
      });
    });
  });
}

