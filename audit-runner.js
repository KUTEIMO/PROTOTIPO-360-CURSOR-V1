#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'reports');
const REPORT_JSON = path.join(REPORT_DIR, 'audit-report.json');
const REPORT_HTML = path.join(REPORT_DIR, 'audit-report.html');

const CATEGORIES = [
  { id: 'A', label: 'Perceptible', description: 'Escena con textos alternativos y descripciones largas.' },
  { id: 'B', label: 'Operable', description: 'Hotspots configurados como botones accesibles.' },
  { id: 'C', label: 'Comprensible', description: 'Audiodescripciones disponibles.' },
  { id: 'D', label: 'Robusto', description: 'Transcripciones descargables.' },
  { id: 'E', label: 'Multimedia accesible', description: 'Subtítulos VTT presentes.' },
  { id: 'F', label: 'Teclado y atajos', description: 'Instrucciones de teclado definidas.' },
  { id: 'G', label: 'Navegación', description: 'Enlaces o flujo entre escenas.' },
  { id: 'H', label: 'Metadatos', description: 'Zona y taxonomía documentada.' }
];

async function main() {
  const config = await loadConfig();
  const scenesResults = await evaluateScenes(config);

  const summary = buildSummary(scenesResults);
  const report = {
    generatedAt: new Date().toISOString(),
    instrumentVersion: 'v1',
    summary,
    scenes: scenesResults
  };

  await fs.mkdir(REPORT_DIR, { recursive: true });
  await fs.writeFile(REPORT_JSON, JSON.stringify(report, null, 2), 'utf-8');
  await fs.writeFile(REPORT_HTML, renderHtmlReport(report), 'utf-8');

  console.log('✅ Auditoría completada.');
  console.log(`- JSON: ${path.relative(ROOT, REPORT_JSON)}`);
  console.log(`- HTML: ${path.relative(ROOT, REPORT_HTML)}`);
}

async function loadConfig() {
  const configPath = path.join(ROOT, 'config.json');
  const raw = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(raw);
}

async function evaluateScenes(config) {
  return Promise.all(
    config.scenes.map(async (scene) => {
      const checks = await Promise.all(
        CATEGORIES.map((category) => runCheck(category, scene, config))
      );
      const score = Math.round((checks.filter((c) => c.status === 'pass').length / CATEGORIES.length) * 100);
      return {
        sceneId: scene.id,
        title: scene.title,
        score,
        checks
      };
    })
  );
}

async function runCheck(category, scene, config) {
  switch (category.id) {
    case 'A':
      return createResult(category, Boolean(scene.altText && scene.longDescription));
    case 'B':
      return createResult(
        category,
        Array.isArray(scene.hotspots) && scene.hotspots.every(hasAccessibleFields)
      );
    case 'C':
      return createResult(category, await fileExists(scene.narration));
    case 'D': {
      const hotspotOk = await allHotspots(scene.hotspots, (hotspot) =>
        hotspot.transcript ? fileExists(hotspot.transcript) : Promise.resolve(true)
      );
      return createResult(
        category,
        (await fileExists(scene.transcript)) && hotspotOk
      );
    }
    case 'E': {
      const hotspotCaptions = await allHotspots(scene.hotspots, (hotspot) =>
        hotspot.captionFile ? fileExists(hotspot.captionFile) : Promise.resolve(true)
      );
      return createResult(
        category,
        (await fileExists(scene.captionFile)) && hotspotCaptions
      );
    }
    case 'F':
      return createResult(category, Array.isArray(scene.keyboardShortcuts) && scene.keyboardShortcuts.length > 0);
    case 'G':
      return createResult(category, Array.isArray(scene.links) && scene.links.length > 0);
    case 'H':
      return createResult(category, Boolean(scene.zone && config.zones?.[scene.zone]));
    default:
      return createResult(category, false, 'Chequeo no implementado');
  }
}

function hasAccessibleFields(hotspot) {
  return Boolean(
    hotspot &&
      hotspot.id &&
      hotspot.title &&
      typeof hotspot.yaw === 'number' &&
      typeof hotspot.pitch === 'number' &&
      hotspot.altText &&
      hotspot.description
  );
}

async function allHotspots(hotspots = [], predicate) {
  return (await Promise.all((hotspots || []).map(predicate))).every(Boolean);
}

function createResult(category, condition, message) {
  return {
    category: category.id,
    label: category.label,
    description: category.description,
    status: condition ? 'pass' : 'fail',
    details: message || (condition ? 'Cumple con el criterio.' : 'Falta información para este criterio.')
  };
}

async function fileExists(relativePath) {
  if (!relativePath) return false;
  try {
    await fs.access(path.join(ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

function buildSummary(results) {
  const avgScore =
    results.reduce((acc, scene) => acc + scene.score, 0) / (results.length || 1);
  const pending = results.flatMap((scene) =>
    scene.checks.filter((check) => check.status !== 'pass').map((check) => ({
      sceneId: scene.sceneId,
      sceneTitle: scene.title,
      category: check.category,
      label: check.label
    }))
  );
  return {
    scenesAudited: results.length,
    averageScore: Math.round(avgScore),
    pending
  };
}

function renderHtmlReport(report) {
  const rows = report.scenes
    .map((scene) => {
      const checks = scene.checks
        .map(
          (check) => `
            <li class="${check.status}">
              <strong>${check.category} - ${check.label}</strong>: ${check.details}
            </li>
          `
        )
        .join('');
      return `
        <section class="scene">
          <h2>${scene.title} <span>${scene.score}%</span></h2>
          <ul>${checks}</ul>
        </section>
      `;
    })
    .join('');

  const pending = report.summary.pending
    .map(
      (item) => `<li><strong>${item.sceneTitle}</strong>: pendiente ${item.label} (${item.category})</li>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte de Auditoría Accesible</title>
  <style>
    body { font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; }
    h1 { margin-bottom: 0.5rem; }
    .summary { background: rgba(15, 23, 42, 0.7); padding: 1.5rem; border-radius: 1rem; margin-bottom: 2rem; }
    .scene { background: rgba(30, 41, 59, 0.7); padding: 1.5rem; border-radius: 1rem; margin-bottom: 1.5rem; }
    .scene h2 { display: flex; justify-content: space-between; margin-top: 0; }
    .scene ul { list-style: none; padding: 0; }
    .scene li { margin: 0.35rem 0; padding: 0.35rem; border-radius: 0.5rem; }
    .scene li.pass { background: rgba(16, 185, 129, 0.15); }
    .scene li.fail { background: rgba(248, 113, 113, 0.15); }
    a { color: #38bdf8; }
  </style>
</head>
<body>
  <h1>Reporte de Auditoría Inicial</h1>
  <p>Generado: ${report.generatedAt}</p>
  <div class="summary">
    <h2>Resumen</h2>
    <p>Escenas auditadas: ${report.summary.scenesAudited}</p>
    <p>Puntaje promedio: ${report.summary.averageScore}%</p>
    <h3>Pendientes</h3>
    <ul>${pending || '<li>Todos los criterios se cumplen.</li>'}</ul>
  </div>
  ${rows}
</body>
</html>`;
}

main().catch((error) => {
  console.error('❌ Error en la auditoría:', error);
  process.exit(1);
});

