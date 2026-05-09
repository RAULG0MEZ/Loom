const config = window.LOOM_LIBRARY_CONFIG || {};
const streamHost = config.streamHost || '';
const deleteApiUrl = config.deleteApiUrl || '';
const grid = document.querySelector('#videoGrid');
const emptyState = document.querySelector('#emptyState');
const libraryMeta = document.querySelector('#libraryMeta');
const currentVideo = document.querySelector('#currentVideo');
const refreshBtn = document.querySelector('#refreshBtn');
const deleteModal = document.querySelector('#deleteModal');
const deleteVideoTitle = document.querySelector('#deleteVideoTitle');
const deletePasscode = document.querySelector('#deletePasscode');
const deleteError = document.querySelector('#deleteError');
const cancelDeleteBtn = document.querySelector('#cancelDeleteBtn');
const confirmDeleteBtn = document.querySelector('#confirmDeleteBtn');
const toast = document.querySelector('#toast');

let pendingDelete = null;
let currentVideoUid = '';

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

function deletedUids() {
  try {
    return new Set(JSON.parse(localStorage.getItem('loomDeletedUids') || '[]'));
  } catch {
    return new Set();
  }
}

function rememberDeletedUid(uid) {
  const uids = deletedUids();
  uids.add(uid);
  localStorage.setItem('loomDeletedUids', JSON.stringify([...uids]));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add('hidden'), 2400);
}

function deleteAction(uid, title) {
  if (!deleteApiUrl) return '';
  return `<button class="danger-action" type="button" data-delete="${escapeHtml(uid)}" data-title="${escapeHtml(title)}">Eliminar</button>`;
}

function cardTemplate(video) {
  const urls = videoUrls(video.uid);
  const title = video.title || video.name || 'Grabacion LoomLocal';
  const safeTitle = escapeHtml(title);
  return `
    <article class="video-card" data-video-uid="${escapeHtml(video.uid)}">
      <a class="thumb" href="${urls.watch}" target="_blank" rel="noreferrer">
        <img src="${video.thumbnail || urls.thumbnail}" alt="">
        <span>${formatDuration(video.duration)}</span>
      </a>
      <div class="video-info">
        <strong>${safeTitle}</strong>
        <small>${formatDate(video.created)}</small>
        <div class="video-actions">
          <a href="${urls.watch}" target="_blank" rel="noreferrer">Ver</a>
          <button type="button" data-copy="${urls.watch}">Copiar link</button>
          ${deleteAction(video.uid, title)}
        </div>
      </div>
    </article>`;
}

function renderCurrentVideo(uid, status = '', title = '') {
  if (!uid || !streamHost) return;
  currentVideoUid = uid;
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
        ${deleteAction(uid, title || 'Video recién grabado')}
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
    const hidden = deletedUids();
    const videos = (Array.isArray(payload.videos) ? payload.videos : []).filter((video) => !hidden.has(video.uid));
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

function openDeleteModal(uid, title) {
  pendingDelete = { uid, title };
  const savedPasscode = localStorage.getItem('loomDeletePasscode') || '';
  deleteVideoTitle.textContent = title
    ? `"${title}" se borrará de Cloudflare Stream.`
    : 'Este video se borrará de Cloudflare Stream.';
  deleteError.textContent = '';
  deleteError.classList.add('hidden');
  deletePasscode.value = savedPasscode;
  deleteModal.classList.toggle('has-saved-passcode', Boolean(savedPasscode));
  confirmDeleteBtn.disabled = false;
  confirmDeleteBtn.textContent = 'Sí, borrar';
  deleteModal.classList.remove('hidden');
  if (!savedPasscode) setTimeout(() => deletePasscode.focus(), 60);
}

function closeDeleteModal() {
  pendingDelete = null;
  deleteModal.classList.add('hidden');
}

function removeVideoFromView(uid) {
  document.querySelectorAll(`[data-video-uid="${CSS.escape(uid)}"]`).forEach((node) => node.remove());
  if (currentVideoUid === uid) {
    currentVideo.classList.add('hidden');
    currentVideo.innerHTML = '';
    currentVideoUid = '';
  }

  const count = grid.querySelectorAll('.video-card').length;
  emptyState.classList.toggle('hidden', count > 0);
  libraryMeta.textContent = count
    ? `${count} videos - actualizado ahora`
    : 'Sin videos publicados todavía';
}

async function confirmDelete() {
  if (!pendingDelete) return;

  if (!deleteApiUrl) {
    deleteError.textContent = 'La API de borrado todavía no está configurada.';
    deleteError.classList.remove('hidden');
    return;
  }

  const passcode = deletePasscode.value.trim();
  if (!passcode) {
    deleteError.textContent = 'Escribe la clave de borrado.';
    deleteError.classList.remove('hidden');
    deletePasscode.focus();
    return;
  }

  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = 'Borrando...';
  deleteError.classList.add('hidden');

  let response;
  try {
    response = await fetch(deleteApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: pendingDelete.uid, passcode })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || 'No pude borrar el video');
    }

    localStorage.setItem('loomDeletePasscode', passcode);
    rememberDeletedUid(pendingDelete.uid);
    removeVideoFromView(pendingDelete.uid);
    closeDeleteModal();
    showToast('Video eliminado de Cloudflare');
  } catch (error) {
    deleteError.textContent = error.message || 'No pude borrar el video';
    deleteError.classList.remove('hidden');
    if (response?.status === 401) {
      localStorage.removeItem('loomDeletePasscode');
      deletePasscode.value = '';
      deleteModal.classList.remove('has-saved-passcode');
      deletePasscode.focus();
    }
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = 'Sí, borrar';
  }
}

document.addEventListener('click', async (event) => {
  const copyButton = event.target.closest('[data-copy]');
  if (copyButton) {
    await navigator.clipboard.writeText(copyButton.dataset.copy);
    copyButton.textContent = 'Copiado';
    setTimeout(() => {
      copyButton.textContent = 'Copiar link';
    }, 1400);
    return;
  }

  const deleteButton = event.target.closest('[data-delete]');
  if (deleteButton) {
    openDeleteModal(deleteButton.dataset.delete, deleteButton.dataset.title || 'Video');
  }
});

refreshBtn.addEventListener('click', loadVideos);
cancelDeleteBtn.addEventListener('click', closeDeleteModal);
confirmDeleteBtn.addEventListener('click', confirmDelete);
deleteModal.addEventListener('click', (event) => {
  if (event.target === deleteModal) closeDeleteModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !deleteModal.classList.contains('hidden')) closeDeleteModal();
});

const params = new URLSearchParams(window.location.search);
renderCurrentVideo(params.get('video'), params.get('status'), params.get('title'));
loadVideos();
