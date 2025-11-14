import { getSetting } from './state.js';

let lastFocusedElement = null;
let currentHotspot = null;
let currentScene = null;
let speechUtterance = null;
let speechPaused = false;

const panel = () => document.getElementById('hotspotPanel');
const summary = () => document.getElementById('hotspotSummary');
const transcriptLink = () => document.getElementById('transcriptDownload');
const audioElement = () => document.getElementById('hotspotAudio');
const audioStatus = () => document.getElementById('audioStatus');
const captionContainer = () => document.getElementById('captionContainer');

export function initHotspotPanel() {
  const closeButton = document.getElementById('closeHotspotPanel');
  const toggleCaptions = document.getElementById('toggleCaptions');
  const volumeSlider = document.getElementById('audioVolume');
  const panelElement = panel();
  hideCaptions();

  if (closeButton) {
    closeButton.addEventListener('click', () => closePanel());
  }

  if (panelElement) {
    panelElement.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePanel(true);
      } else if (event.key === 'Tab') {
        trapFocus(panelElement, event);
      }
    });
  }

  document.querySelectorAll('[data-audio-action]').forEach((button) => {
    button.addEventListener('click', () => handleAudioAction(button.dataset.audioAction));
  });

  if (volumeSlider) {
    volumeSlider.addEventListener('input', (event) => {
      const audio = audioElement();
      if (!audio) return;
      audio.volume = parseFloat(event.target.value);
      setAudioStatus(`Volumen ajustado a ${(audio.volume * 100).toFixed(0)}%`);
    });
  }

  if (toggleCaptions) {
    toggleCaptions.addEventListener('click', () => toggleCaptionVisibility());
  }
}

export async function openHotspotPanel(sceneData, hotspotData, { focusPanel = false, autoNarration = false } = {}) {
  currentScene = sceneData;
  currentHotspot = hotspotData;

  const panelElement = panel();
  if (!panelElement) return;

  lastFocusedElement = document.activeElement;
  panelElement.removeAttribute('hidden');
  panelElement.setAttribute('aria-hidden', 'false');
  panelElement.classList.add('hotspot-panel--open');

  updatePanelContent(sceneData, hotspotData);

  if (focusPanel) {
    requestAnimationFrame(() => {
      panelElement.querySelector('.close-button')?.focus();
    });
  }

  if (autoNarration || getSetting('autoNarration')) {
    await playAudio();
  }

  if (getSetting('autoCaptions')) {
    await showCaptions();
  } else {
    hideCaptions();
  }
}

export function closePanel(restoreFocus = false) {
  const panelElement = panel();
  if (!panelElement) return;

  pauseAudio();
  stopSpeech();
  hideCaptions();
  panelElement.setAttribute('hidden', 'hidden');
  panelElement.setAttribute('aria-hidden', 'true');
  panelElement.classList.remove('hotspot-panel--open');

  if (restoreFocus && lastFocusedElement) {
    lastFocusedElement.focus();
  }
}

function updatePanelContent(sceneData, hotspotData) {
  if (summary()) {
    summary().textContent = hotspotData.description || sceneData.longDescription;
  }

  const captions = captionContainer();
  if (captions) {
    captions.innerHTML = '';
    captions.dataset.visible = 'false';
    captions.hidden = true;
  }
  const toggleButton = document.getElementById('toggleCaptions');
  if (toggleButton) {
    toggleButton.textContent = 'Mostrar subtítulos';
  }

  if (transcriptLink()) {
    const transcript = hotspotData.transcript || sceneData.transcript;
    if (transcript) {
      transcriptLink().href = transcript;
      transcriptLink().removeAttribute('aria-disabled');
    } else {
      transcriptLink().removeAttribute('href');
      transcriptLink().setAttribute('aria-disabled', 'true');
    }
  }

  const audio = audioElement();
  if (audio) {
    stopSpeech();
    const narration = hotspotData.narration || sceneData.narration;
    if (narration) {
      audio.src = narration;
      audio.setAttribute('data-caption', hotspotData.captionFile || sceneData.captionFile || '');
      audio.load();
      setAudioStatus('Audio listo para reproducirse.');
    } else {
      audio.removeAttribute('src');
      setAudioStatus('Este hotspot no cuenta con audiodescripción disponible.');
    }
  }
}

function handleAudioAction(action) {
  switch (action) {
    case 'play':
      playAudio();
      break;
    case 'pause':
      pauseAudio();
      break;
    case 'stop':
      stopAudio();
      break;
    default:
      break;
  }
}

async function playAudio() {
  const audio = audioElement();
  if (!audio) {
    startSpeechFallback();
    return;
  }

  if (audio.src) {
    try {
      stopSpeech();
      await audio.play();
      setAudioStatus('Reproduciendo audiodescripción.');
      return;
    } catch (error) {
      console.warn('No se pudo reproducir el audio; se usará síntesis de voz.', error);
    }
  }

  startSpeechFallback();
}

function pauseAudio() {
  const audio = audioElement();
  if (audio && !audio.paused && !audio.ended) {
    audio.pause();
    setAudioStatus('Audiodescripción en pausa.');
    return;
  }
  pauseSpeech();
  if (speechUtterance) {
    setAudioStatus('Audiodescripción sintetizada en pausa.');
  }
}

function stopAudio() {
  const audio = audioElement();
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  stopSpeech();
  setAudioStatus('Audiodescripción detenida.');
}

function setAudioStatus(message) {
  const status = audioStatus();
  if (!status) return;
  status.textContent = '';
  requestAnimationFrame(() => {
    status.textContent = message;
  });
}

async function toggleCaptionVisibility() {
  const container = captionContainer();
  const toggleButton = document.getElementById('toggleCaptions');
  if (!container) return;
  if (container.dataset.visible === 'true') {
    hideCaptions();
    if (toggleButton) toggleButton.textContent = 'Mostrar subtítulos';
  } else {
    await showCaptions();
    if (toggleButton) toggleButton.textContent = 'Ocultar subtítulos';
  }
}

async function showCaptions() {
  const container = captionContainer();
  const toggleButton = document.getElementById('toggleCaptions');
  if (!container) return;

  const captionFile = currentHotspot?.captionFile || currentScene?.captionFile;
  if (!captionFile) {
    container.textContent = 'No hay subtítulos disponibles para este recurso.';
    container.dataset.visible = 'true';
    container.hidden = false;
    return;
  }

  try {
    const response = await fetch(captionFile);
    if (!response.ok) throw new Error(`No se pudo cargar ${captionFile}`);
    const text = await response.text();
    container.innerHTML = parseVtt(text);
    container.dataset.visible = 'true';
    container.hidden = false;
    if (toggleButton) toggleButton.textContent = 'Ocultar subtítulos';
  } catch (error) {
    console.error(error);
    container.textContent = 'Error al cargar los subtítulos.';
    container.dataset.visible = 'true';
    container.hidden = false;
    if (toggleButton) toggleButton.textContent = 'Ocultar subtítulos';
  }
}

function hideCaptions() {
  const container = captionContainer();
  if (!container) return;
  container.hidden = true;
  container.dataset.visible = 'false';
  const toggleButton = document.getElementById('toggleCaptions');
  if (toggleButton) toggleButton.textContent = 'Mostrar subtítulos';
}

function parseVtt(vttText) {
  const lines = vttText.split('\n').filter((line) => line.trim().length > 0 && !line.startsWith('WEBVTT'));
  return `<ul class="caption-list">${lines.map((line) => `<li>${line}</li>`).join('')}</ul>`;
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

function startSpeechFallback() {
  if (!currentHotspot) return;
  if (!('speechSynthesis' in window)) {
    setAudioStatus('No hay audiodescripción disponible para este navegador.');
    return;
  }

  stopSpeech();
  const text = currentHotspot.description || currentScene?.longDescription || 'Descripción no disponible.';
  speechUtterance = new SpeechSynthesisUtterance(text);
  speechUtterance.lang = 'es-ES';
  speechUtterance.rate = 1;
  speechUtterance.pitch = 1;
  speechUtterance.onend = () => {
    speechUtterance = null;
    speechPaused = false;
    setAudioStatus('Audiodescripción sintetizada finalizada.');
  };
  speechUtterance.onerror = () => {
    speechUtterance = null;
    speechPaused = false;
    setAudioStatus('No se pudo reproducir la síntesis de voz.');
  };
  window.speechSynthesis.speak(speechUtterance);
  setAudioStatus('Reproduciendo audiodescripción sintetizada.');
}

function stopSpeech() {
  if (speechUtterance) {
    window.speechSynthesis.cancel();
    speechUtterance = null;
    speechPaused = false;
  }
}

function pauseSpeech() {
  if (speechUtterance && !speechPaused) {
    window.speechSynthesis.pause();
    speechPaused = true;
  }
}

