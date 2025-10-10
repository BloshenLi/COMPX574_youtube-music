// plugins/cover-spin/renderer.ts

let observer: MutationObserver | null = null;

const injectOnce = () => {
  const styleId = 'ytmd-cover-spin-style';
  if (document.querySelector(`#${styleId}`)) return;

  /* 1. Rounded cover style */
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    ytmusic-player-bar .thumbnail-image-wrapper img.image {
      border-radius: 50% !important;
      width: 48px !important;
      height: 48px !important;
      object-fit: cover !important;
    }
  `;
  document.head.appendChild(style);

  /* 2. spin animation style */
  const rotateStyle = document.createElement('style');
  rotateStyle.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    ytmusic-player-bar .thumbnail-image-wrapper img.image.rotating {
      animation: spin 8s linear infinite;
      animation-play-state: running;
    }
    ytmusic-player-bar .thumbnail-image-wrapper img.image.paused {
      animation-play-state: paused;
    }
  `;
  document.head.appendChild(rotateStyle);

  // Add rotating class to the image
  const img = document.querySelector<HTMLImageElement>(
    'ytmusic-player-bar .thumbnail-image-wrapper img.image',
  );
  if (!img) return;

  img.classList.add('rotating');

  // Check if the audio is initially paused
  const onAudioCanPlay = (e: Event) => {
  const { audioContext } = (e as CustomEvent).detail;
  const isInitiallyPaused = audioContext.state !== 'running';
  if (isInitiallyPaused) {
    img.classList.add('paused');
  }
  document.removeEventListener('ytmd:audio-can-play', onAudioCanPlay);
};

document.addEventListener('ytmd:audio-can-play', onAudioCanPlay);

  window.ipcRenderer.on('ytmd:play-or-paused', (_, { isPaused }) => {
    if (isPaused) {
      img.classList.add('paused');
    } else {
      img.classList.remove('paused');
    }
  });
};

export const onPlayerApiReady = () => {
  observer = new MutationObserver(() => {
    if (document.querySelector('ytmusic-player-bar .thumbnail-image-wrapper')) {
      injectOnce();
      observer?.disconnect();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
};

export const onUnload = () => {
  observer?.disconnect();
  const style = document.querySelector('#ytmd-cover-spin-style');
  if (style) style.remove();

  // Remove all added classes and event listeners
  const img = document.querySelector<HTMLImageElement>(
    'ytmusic-player-bar .thumbnail-image-wrapper img.image'
  );
  img?.classList.remove('rotating', 'paused');
};