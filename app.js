const config = window.LOOM_LIBRARY_CONFIG || {};
const streamHost = config.streamHost || '';
const grid = document.querySelector('#videoGrid');
const emptyState = document.querySelector('#emptyState');
const libraryMeta = document.querySelector('#libraryMeta');
const currentVideo = document.querySelector('#currentVideo');
const refreshBtn = document.querySelector('#refreshBtn');

function formatDate(value) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function videoUrls(uid) {
  return {
    watch: `https://${streamHost}/${uid}/watch`,
    iframe: `https://${streamHost}/${uid}/iframe`,
    thumbnail: `https://${streamHost}/${uid}/thumbnails/thumbnail.jpg?time=1s&height=360`
  };
}

function cardTemplate(video) {
  const urls = videoUrls(video.uid);
  const title = video.title || video.name || 'Grabacion LoomLocal';
  return `
    <article class="video-card">
      <a class="thumb" href="${urls.watch}" target="_blank" rel="noreferrer">
        <img src="${video.thumbnail || urls.thumbnail}" alt="">
        <span>${formatDuration(video.duration)}</span>
      </a>
      <div class="video-info">
        <strong>${title}</strong>
        <small>${formatDate(video.created)}</small>
        <div class="video-actions">
          <a href="${urls.watch}" target="_blank" rel="noreferrer">Ver</a>
          <button type="button" data-copy="${urls.watch}">Copiar link</button>
        </div>
      </div>
    </article>`;
}

function renderCurrentVideo(uid, status = '', title = '') {
  if (!uid || !streamHost) return;
  const urls = videoUrls(uid);
  const pending = status === 'uploading' || status === 'processing';
  const heading = status === 'uploading'
    ? 'Estamos subiendo tu video'
    : pending
      ? 'Cloudflare está procesando tu video'
      : 'Tu video ya está en Cloudflare';
  const detail = pending
    ? 'El reproductor puede tardar unos segundos en activarse. Esta página se refresca solita mientras queda listo.'
    : 'Ya puedes verlo, compartirlo o copiar el link.';
  currentVideo.classList.remove('hidden');
  currentVideo.innerHTML = `
    <div class="current-copy">
      <span class="eyebrow">Recién grabado</span>
      <h2>${heading}</h2>
      <p>${escapeHtml(title) || detail}</p>
      ${pending ? `<div class="upload-status"><span></span>${detail}</div>` : ''}
      <div class="video-actions">
        <a href="${urls.watch}" target="_blank" rel="noreferrer">Abrir video</a>
        <button type="button" data-copy="${urls.watch}">Copiar link</button>
      </div>
    </div>
    <div class="player-shell ${pending ? 'is-loading' : ''}">
      <iframe src="${urls.iframe}" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowfullscreen></iframe>
      ${pending ? '<div class="player-loading"><span></span><strong>Preparando video...</strong></div>' : ''}
    </div>`;

  if (pending) {
    const iframe = currentVideo.querySelector('iframe');
    const overlay = currentVideo.querySelector('.player-loading');
    iframe.addEventListener('load', () => {
      setTimeout(() => overlay?.classList.add('soft'), 1800);
    });
    setInterval(() => {
      iframe.src = `${urls.iframe}?refresh=${Date.now()}`;
      loadVideos();
    }, 12000);
  }
}

async function loadVideos() {
  try {
    const response = await fetch(`./videos.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('No videos.json');
    const payload = await response.json();
    const videos = Array.isArray(payload.videos) ? payload.videos : [];
    grid.innerHTML = videos.map(cardTemplate).join('');
    emptyState.classList.toggle('hidden', videos.length > 0);
    libraryMeta.textContent = videos.length
      ? `${videos.length} videos - actualizado ${formatDate(payload.generatedAt)}`
      : 'Sin videos publicados todavía';
  } catch (error) {
    console.error(error);
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    libraryMeta.textContent = 'No pude cargar la libreria';
  }
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-copy]');
  if (!button) return;
  await navigator.clipboard.writeText(button.dataset.copy);
  button.textContent = 'Copiado';
  setTimeout(() => {
    button.textContent = 'Copiar link';
  }, 1400);
});

refreshBtn.addEventListener('click', loadVideos);

const params = new URLSearchParams(window.location.search);
renderCurrentVideo(params.get('video'), params.get('status'), params.get('title'));
loadVideos();
