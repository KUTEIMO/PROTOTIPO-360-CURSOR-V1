export function initFallback() {
  document.body.classList.remove('no-js');
  document.body.classList.add('js-enabled');

  const message = document.getElementById('noJsMessage');
  if (message) {
    message.setAttribute('hidden', 'hidden');
    message.style.display = 'none';
  }
}

