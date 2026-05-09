const cameraButtons = document.querySelector('#cameraButtons');
const cameraDropdownBtn = document.querySelector('#cameraDropdownBtn');
const cameraMenu = document.querySelector('#cameraMenu');
const cameraTestBtn = document.querySelector('#cameraTestBtn');
const cameraName = document.querySelector('#cameraName');
const cameraHint = document.querySelector('#cameraHint');
const modeButtons = document.querySelectorAll('[data-mode]');
const controlPanel = document.querySelector('#controlPanel');
const dragHandle = document.querySelector('#dragHandle');
const areaSelectionLayer = document.querySelector('#areaSelectionLayer');
const areaSelectionBox = document.querySelector('#areaSelectionBox');
const recordingRegionMask = document.querySelector('#recordingRegionMask');

const screenVideo = document.querySelector('#screenVideo');
const cameraVideo = document.querySelector('#cameraVideo');
const cameraPreview = document.querySelector('#cameraPreview');
const cameraOverlay = document.querySelector('#cameraOverlay');
const recordCanvas = document.querySelector('#recordCanvas');
const drawCanvas = document.querySelector('#drawCanvas');
const ctx = recordCanvas.getContext('2d');
const drawCtx = drawCanvas.getContext('2d');

const startBtn = document.querySelector('#startBtn');
const stopBtn = document.querySelector('#stopBtn');
const restartBtn = document.querySelector('#restartBtn');
const liveControls = document.querySelector('#liveControls');
const liveDragHandle = document.querySelector('#liveDragHandle');
const livePauseBtn = document.querySelector('#livePauseBtn');
const livePenBtn = document.querySelector('#livePenBtn');
const liveStopBtn = document.querySelector('#liveStopBtn');
const liveCancelBtn = document.querySelector('#liveCancelBtn');
const countdownEl = document.querySelector('#countdown');
const saveToast = document.querySelector('#saveToast');
const recStatus = document.querySelector('#recStatus');
const recTimer = document.querySelector('#recTimer');

const micToggle = document.querySelector('#micToggle');
const cameraToggle = document.querySelector('#cameraToggle');
const systemAudioToggle = document.querySelector('#systemAudioToggle');
const countdownToggle = document.querySelector('#countdownToggle');
const drawToggle = document.querySelector('#drawToggle');
const titleInput = document.querySelector('#titleInput');
const qualitySelect = document.querySelector('#qualitySelect');
const qualityButtons = document.querySelectorAll('[data-quality]');
const qualityLabel = document.querySelector('#qualityLabel');
const qualityDropdownBtn = document.querySelector('#qualityDropdownBtn');
const qualityMenu = document.querySelector('#qualityMenu');
const saveTargetLabel = document.querySelector('#saveTargetLabel');
const saveTargetBtn = document.querySelector('#saveTargetBtn');
const saveTargetMenu = document.querySelector('#saveTargetMenu');
const saveTargetButtons = document.querySelectorAll('[data-save-target]');
const settingsBtn = document.querySelector('#settingsBtn');
const settingsPanel = document.querySelector('#settingsPanel');
const settingsCloseBtn = document.querySelector('#settingsCloseBtn');
const cloudProviderBtn = document.querySelector('#cloudProviderBtn');
const cloudProviderMenu = document.querySelector('#cloudProviderMenu');
const cloudProviderLabel = document.querySelector('#cloudProviderLabel');
const cloudProviderButtons = document.querySelectorAll('[data-cloud-provider]');
const cloudflareSettingsStatus = document.querySelector('#cloudflareSettingsStatus');
const driveStatus = document.querySelector('#driveStatus');
const youtubeStatus = document.querySelector('#youtubeStatus');
const driveSettingsStatus = document.querySelector('#driveSettingsStatus');
const youtubeSettingsStatus = document.querySelector('#youtubeSettingsStatus');
const googleAuthStatus = document.querySelector('#googleAuthStatus');
const googleDriveLocation = document.querySelector('#googleDriveLocation');
const chooseDriveLocationBtn = document.querySelector('#chooseDriveLocationBtn');
const authorizeGoogleBtn = document.querySelector('#authorizeGoogleBtn');
const disconnectGoogleBtn = document.querySelector('#disconnectGoogleBtn');
const localFolderRow = document.querySelector('#localFolderRow');
const localFolderName = document.querySelector('#localFolderName');
const localFolderPath = document.querySelector('#localFolderPath');
const localTargetStatus = document.querySelector('#localTargetStatus');
const chooseFolderBtn = document.querySelector('#chooseFolderBtn');
const cloudToggle = document.querySelector('#cloudToggle');
const cloudStatus = document.querySelector('#cloudStatus');
const shapeButtons = document.querySelectorAll('[data-shape]');
const sizeButtons = document.querySelectorAll('[data-size]');
const openFolderBtn = document.querySelector('#openFolderBtn');
const quitBtn = document.querySelector('#quitBtn');
const cornerQuitBtn = document.querySelector('#cornerQuitBtn');

let cameraDevices = [];
let mode = 'screenOnly';
let screenStream;
let cameraStream;
let micStream;
let mixedStream;
let mediaRecorder;
let chunks = [];
let animationId;
let timerId;
let audioContext;
let startedAt = 0;
let isRecording = false;
let isPaused = false;
let isStopping = false;
let quitAfterCurrentSave = false;
let discardRecording = false;
let pausedAt = 0;
let pausedMs = 0;
let isDrawing = false;
let cloudUploadEnabled = false;
let saveTarget = 'local';
let cloudProvider = 'cloudflare';
let cloudStatusState = null;
let localSaveDir = '';
let localSaveDirName = 'Escritorio';
let lastPoint = null;
let drawFadeTimer;
let dragState = null;
let pointerIgnored = false;
let selectedCameraId = '';
let cameraShape = 'circle';
let cameraSizePreset = 'medium';
let cameraToolbarCloseTimer;
let captureRegion = null;
let areaSelectionState = null;
let startAfterAreaSelection = false;

systemAudioToggle.checked = false;
systemAudioToggle.disabled = true;

async function requestStartupPermissions() {
  if (!window.loomLocal) {
    await loadCameraDevices();
    return;
  }

  try {
    await window.loomLocal.requestPermissions();
  } catch (error) {
    console.error(error);
  }

  try {
    await loadCameraDevices();
    if (cameraToggle.checked) await ensureCameraPreview();
  } catch (error) {
    console.error(error);
    showToast('No pude encender la cámara. Revisa permisos de Cámara en macOS.');
  }
}

const CLOUD_PROVIDER_LABELS = {
  cloudflare: 'Cloudflare Stream',
  googleDrive: 'Google Drive',
  youtube: 'YouTube no listado'
};

function normalizeCloudProvider(provider) {
  return CLOUD_PROVIDER_LABELS[provider] ? provider : 'cloudflare';
}

async function loadCloudStatus() {
  if (!window.loomLocal?.cloudStatus && !window.loomLocal?.cloudflareStatus) return;
  try {
    if (window.loomLocal.cloudStatus) {
      applyCloudStatus(await window.loomLocal.cloudStatus());
    } else {
      const status = await window.loomLocal.cloudflareStatus();
      applyCloudStatus({
        cloudProvider,
        providers: {
          cloudflare: {
            configured: Boolean(status.configured)
          }
        },
        google: {}
      });
    }
    updateCloudUi();
  } catch (error) {
    console.error(error);
    cloudStatusState = null;
    if (saveTarget === 'cloud') saveTarget = 'local';
    updateCloudUi();
  }
}

async function loadCloudflareStatus() {
  await loadCloudStatus();
}

function applyCloudStatus(status) {
  cloudStatusState = status || null;
  if (status?.cloudProvider) cloudProvider = normalizeCloudProvider(status.cloudProvider);
  if (status?.saveTarget) saveTarget = status.saveTarget === 'cloud' ? 'cloud' : 'local';
  if (saveTarget === 'cloud' && !isCloudProviderConfigured(cloudProvider)) saveTarget = 'local';
  renderSettingsPanel();
}

function getProviderState(provider = cloudProvider) {
  return cloudStatusState?.providers?.[normalizeCloudProvider(provider)] || {};
}

function isCloudProviderConfigured(provider = cloudProvider) {
  return Boolean(getProviderState(provider).configured);
}

function getProviderLabel(provider = cloudProvider) {
  return CLOUD_PROVIDER_LABELS[normalizeCloudProvider(provider)];
}

function getProviderStatusText(provider = cloudProvider) {
  const normalized = normalizeCloudProvider(provider);
  if (normalized === 'cloudflare') return isCloudProviderConfigured(normalized) ? 'Listo para biblioteca' : 'No configurado';
  return isCloudProviderConfigured(normalized) ? 'Google conectado' : 'Conecta Google';
}

function updateCloudUi() {
  cloudUploadEnabled = saveTarget === 'cloud' && isCloudProviderConfigured(cloudProvider);
  if (cloudToggle) {
    cloudToggle.classList.toggle('enabled', cloudUploadEnabled);
    cloudToggle.disabled = !isCloudProviderConfigured(cloudProvider);
  }
  if (cloudStatus) {
    cloudStatus.textContent = getProviderStatusText('cloudflare');
  }
  if (driveStatus) driveStatus.textContent = getProviderStatusText('googleDrive');
  if (youtubeStatus) youtubeStatus.textContent = getProviderStatusText('youtube');
  if (cloudflareSettingsStatus) cloudflareSettingsStatus.textContent = getProviderStatusText('cloudflare');
  if (driveSettingsStatus) driveSettingsStatus.textContent = getProviderStatusText('googleDrive');
  if (youtubeSettingsStatus) youtubeSettingsStatus.textContent = getProviderStatusText('youtube');
  updateSaveUi();
}

async function loadAppSettings() {
  if (!window.loomLocal?.getSettings) return;
  try {
    const settings = await window.loomLocal.getSettings();
    applySettings(settings);
  } catch (error) {
    console.error(error);
  }
}

function applySettings(settings, updateTarget = true) {
  if (!settings) return;
  if (updateTarget) saveTarget = settings.saveTarget === 'cloud' ? 'cloud' : 'local';
  if (settings.cloudProvider) cloudProvider = normalizeCloudProvider(settings.cloudProvider);
  localSaveDir = settings.recordingsDir || localSaveDir;
  localSaveDirName = settings.recordingsDirName || folderName(localSaveDir) || localSaveDirName;
  updateSaveUi();
}

function folderName(filePath) {
  if (!filePath) return '';
  const clean = filePath.replace(/\/+$/, '');
  return clean.split('/').pop() || clean;
}

function compactPath(filePath) {
  if (!filePath) return 'Carpeta local';
  const home = '/Users/';
  if (filePath.startsWith(home)) {
    const parts = filePath.split('/');
    if (parts.length > 3) return `~/${parts.slice(3).join('/')}`;
  }
  return filePath;
}

function setQuality(value) {
  const labels = {
    720: '720p',
    1080: '1080p',
    1440: '1440p',
    2160: '4K'
  };
  const next = labels[value] ? String(value) : '1080';
  qualitySelect.value = next;
  const label = labels[next];
  if (qualityLabel) qualityLabel.textContent = label;
  qualityButtons.forEach((button) => button.classList.toggle('selected', button.dataset.quality === next));
}

function updateSaveUi() {
  const isCloud = saveTarget === 'cloud';
  const label = isCloud ? getProviderLabel(cloudProvider) : 'Local';
  if (saveTargetLabel) saveTargetLabel.textContent = label;
  if (cloudProviderLabel) cloudProviderLabel.textContent = getProviderLabel(cloudProvider);
  if (localFolderName) localFolderName.textContent = localSaveDirName || folderName(localSaveDir) || 'Carpeta local';
  if (localFolderPath) localFolderPath.textContent = compactPath(localSaveDir);
  if (localTargetStatus) localTargetStatus.textContent = localSaveDirName || 'En carpeta';
  if (localFolderRow) localFolderRow.classList.toggle('hidden', isCloud);
  saveTargetButtons.forEach((button) => {
    const target = button.dataset.saveTarget;
    const selected = isCloud ? target === cloudProvider : target === 'local';
    button.classList.toggle('selected', selected);
    button.classList.toggle('needs-setup', target !== 'local' && !isCloudProviderConfigured(target));
  });
  cloudProviderButtons.forEach((button) => {
    const provider = normalizeCloudProvider(button.dataset.cloudProvider);
    button.classList.toggle('selected', provider === cloudProvider);
    button.classList.toggle('needs-setup', !isCloudProviderConfigured(provider));
  });
  cloudUploadEnabled = isCloud && isCloudProviderConfigured(cloudProvider);
}

async function setSaveTarget(nextTarget, persist = true) {
  const target = nextTarget === 'cloud' ? 'cloudflare' : nextTarget;
  if (target === 'local') {
    saveTarget = 'local';
  } else {
    cloudProvider = normalizeCloudProvider(target);
    if (!isCloudProviderConfigured(cloudProvider)) {
      saveTarget = 'local';
      showToast(`${getProviderLabel(cloudProvider)} necesita ajustes`);
      openSettingsPanel();
    } else {
      saveTarget = 'cloud';
    }
  }
  updateSaveUi();
  if (persist && window.loomLocal?.setSaveTarget) {
    try {
      applySettings(await window.loomLocal.setSaveTarget({ saveTarget, cloudProvider }), false);
      await loadCloudStatus();
    } catch (error) {
      console.error(error);
    }
  }
}

async function setCloudProvider(nextProvider, persist = true) {
  cloudProvider = normalizeCloudProvider(nextProvider);
  if (saveTarget === 'cloud' && !isCloudProviderConfigured(cloudProvider)) saveTarget = 'local';
  updateSaveUi();
  if (persist && window.loomLocal?.setSaveTarget) {
    try {
      applySettings(await window.loomLocal.setSaveTarget({ saveTarget, cloudProvider }), false);
      await loadCloudStatus();
    } catch (error) {
      console.error(error);
    }
  }
}

function toggleDropdown(menu) {
  if (!menu) return;
  const willOpen = menu.classList.contains('hidden');
  closeDropdowns();
  if (willOpen) menu.classList.remove('hidden');
}

function closeDropdowns() {
  [qualityMenu, saveTargetMenu, cameraMenu, cloudProviderMenu].forEach((menu) => {
    if (menu) menu.classList.add('hidden');
  });
}

function renderSettingsPanel() {
  const google = cloudStatusState?.google || {};
  if (cloudProviderLabel) cloudProviderLabel.textContent = getProviderLabel(cloudProvider);
  if (googleAuthStatus) {
    googleAuthStatus.textContent = google.authorized ? 'Conectado' : 'Sin conectar';
  }
  if (googleDriveLocation) {
    googleDriveLocation.textContent = google.driveFolderName || 'Mi unidad';
  }
  if (chooseDriveLocationBtn) chooseDriveLocationBtn.disabled = !google.authorized;
  if (disconnectGoogleBtn) disconnectGoogleBtn.disabled = !google.authorized;
  updateSaveUi();
}

function openSettingsPanel() {
  closeDropdowns();
  if (!settingsPanel) return;
  settingsPanel.classList.remove('hidden');
  renderSettingsPanel();
  if (window.loomLocal) window.loomLocal.setMousePassthrough(false);
}

function closeSettingsPanel() {
  if (!settingsPanel) return;
  settingsPanel.classList.add('hidden');
}

function keepOverlayInteractive(event) {
  if (event) event.stopPropagation();
  pointerIgnored = false;
  if (window.loomLocal) window.loomLocal.setMousePassthrough(false);
}

async function authorizeGoogleFromUi() {
  if (!window.loomLocal?.authorizeGoogleCloud) return;
  try {
    showToast('Abriendo Google para conectar...');
    const status = await window.loomLocal.authorizeGoogleCloud();
    applyCloudStatus(status);
    const nextProvider = cloudProvider === 'youtube' ? 'youtube' : 'googleDrive';
    if (nextProvider === 'googleDrive' && window.loomLocal?.chooseGoogleDriveLocation) {
      showToast('Elige ubicación en Google Drive...');
      applyCloudStatus(await window.loomLocal.chooseGoogleDriveLocation());
    }
    await setSaveTarget(nextProvider);
    closeSettingsPanel();
    closeDropdowns();
    showToast(`${getProviderLabel(nextProvider)} conectado y seleccionado`);
  } catch (error) {
    console.error(error);
    alert(`No pude conectar Google: ${error.message}`);
  }
}

async function chooseDriveLocationFromUi() {
  if (!window.loomLocal?.chooseGoogleDriveLocation) return;
  try {
    const status = await window.loomLocal.chooseGoogleDriveLocation();
    applyCloudStatus(status);
    updateCloudUi();
    showToast(`Google Drive guardará en ${status?.google?.driveFolderName || 'Mi unidad'}`);
  } catch (error) {
    console.error(error);
    alert(`No pude cambiar ubicación de Drive: ${error.message}`);
  }
}

async function disconnectGoogleFromUi() {
  if (!window.loomLocal?.disconnectGoogleCloud) return;
  try {
    const status = await window.loomLocal.disconnectGoogleCloud();
    applyCloudStatus(status);
    if (saveTarget === 'cloud' && ['googleDrive', 'youtube'].includes(cloudProvider)) {
      await setSaveTarget('local');
    } else {
      updateCloudUi();
    }
    showToast('Google desconectado');
  } catch (error) {
    console.error(error);
    alert(`No pude desconectar Google: ${error.message}`);
  }
}

async function loadCameraDevices() {
  const previousDeviceId = selectedCameraId;
  const devices = await navigator.mediaDevices.enumerateDevices();
  cameraDevices = devices.filter((device) => device.kind === 'videoinput');
  if (cameraDevices.length === 0) {
    cameraToggle.checked = false;
    selectedCameraId = '';
    cameraName.textContent = 'Sin cámara';
    cameraHint.textContent = 'No se grabará cámara';
    cameraButtons.innerHTML = '<button class="camera-device selected" data-camera-option="none">Sin cámara</button><button class="camera-device empty" disabled>Sin cámaras detectadas</button>';
    cameraTestBtn.disabled = true;
    setCameraOverlayVisible(false);
    return;
  }

  cameraTestBtn.disabled = false;

  if (previousDeviceId && cameraDevices.some((device) => device.deviceId === previousDeviceId)) {
    selectedCameraId = previousDeviceId;
  } else {
    const preferred = pickPreferredCamera(cameraDevices);
    selectedCameraId = preferred ? preferred.deviceId : cameraDevices[0].deviceId;
  }
  if (!selectedCameraId) cameraToggle.checked = false;
  renderCameraButtons();
}

function pickPreferredCamera(devices) {
  return devices.find((device) => /insta|360|usb|external|cam link|elgato|logitech|brio|obs/i.test(device.label))
    || devices[0];
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function setMode(nextMode) {
  mode = nextMode === 'customArea' ? 'customArea' : 'screenOnly';
  modeButtons.forEach((button) => button.classList.toggle('selected', button.dataset.mode === mode));
  setCameraOverlayVisible(cameraToggle.checked);
  if (!cameraToggle.checked) stopCameraPreview();
  if (mode === 'customArea') {
    captureRegion = null;
    startAfterAreaSelection = true;
    showAreaSelection();
  } else {
    startAfterAreaSelection = false;
    captureRegion = null;
    hideAreaSelection();
    hideRecordingRegionMask();
  }
}

async function ensureCameraPreview() {
  if (cameraStream) return;
  await loadCameraDevices();
  const selectedDeviceId = selectedCameraId;
  cameraStream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: 1280,
      height: 720,
      frameRate: 30,
      ...(selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : {})
    },
    audio: false
  });
  cameraVideo.srcObject = cameraStream;
  cameraPreview.srcObject = cameraStream;
  await Promise.all([cameraVideo.play(), cameraPreview.play()]);
  await loadCameraDevices();
  const preferred = pickPreferredCamera(cameraDevices);
  if (preferred && preferred.deviceId && preferred.deviceId !== selectedDeviceId) {
    await switchCamera(preferred.deviceId);
  }
}

async function getStreams() {
  const quality = Number(qualitySelect.value);
  try {
    screenStream = await getScreenCaptureStream(quality, 30);
  } catch (error) {
    await window.loomLocal.showPermissionHelp();
    throw new Error('macOS no dejó iniciar la captura. Activa Loom en Configuración del Sistema > Privacidad y seguridad > Grabación de audio del sistema y pantalla. Después cierra Loom por completo y ábrela otra vez desde Aplicaciones.');
  }
  screenVideo.srcObject = screenStream;
  await screenVideo.play();

  if (cameraToggle.checked) {
    try {
      await ensureCameraPreview();
    } catch (error) {
      await window.loomLocal.openCameraSettings();
      throw new Error('No pude abrir la cámara. Si macOS no mostró el permiso, activa Loom en Configuración del Sistema > Privacidad y seguridad > Cámara, cierra la app y vuelve a abrirla.');
    }
  }

  if (micToggle.checked) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (error) {
      await window.loomLocal.openMicrophoneSettings();
      throw new Error('No pude abrir el micrófono. Si macOS no mostró el permiso, activa Loom en Configuración del Sistema > Privacidad y seguridad > Micrófono, cierra la app y vuelve a abrirla.');
    }
  }

  sizeRecordingCanvas();
}

async function getScreenCaptureStream(quality, frameRate) {
  const maxWidth = Math.round(quality * 16 / 9);
  return navigator.mediaDevices.getDisplayMedia({
    audio: false,
    systemAudio: 'exclude',
    windowAudio: 'exclude',
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'exclude',
    monitorTypeSurfaces: 'include',
    video: {
      displaySurface: 'monitor',
      width: { ideal: maxWidth },
      height: { ideal: quality },
      frameRate: { ideal: frameRate, max: frameRate }
    }
  });
}

function sizeRecordingCanvas() {
  const quality = Number(qualitySelect.value) || 1080;
  if (mode === 'customArea' && captureRegion) {
    const ratio = captureRegion.width / captureRegion.height || 16 / 9;
    recordCanvas.width = Math.round(quality * ratio);
    recordCanvas.height = quality;
  } else if (screenVideo.videoWidth && screenVideo.videoHeight) {
    const ratio = screenVideo.videoWidth / screenVideo.videoHeight || 16 / 9;
    recordCanvas.width = Math.round(quality * ratio);
    recordCanvas.height = quality;
  } else {
    recordCanvas.width = Math.round(quality * 16 / 9);
    recordCanvas.height = quality;
  }

  drawCanvas.width = recordCanvas.width;
  drawCanvas.height = recordCanvas.height;
  syncDrawCanvasFrame();
}

function syncDrawCanvasFrame() {
  const rect = mode === 'customArea' && captureRegion
    ? captureRegion
    : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  drawCanvas.style.left = `${rect.left}px`;
  drawCanvas.style.top = `${rect.top}px`;
  drawCanvas.style.right = 'auto';
  drawCanvas.style.bottom = 'auto';
  drawCanvas.style.width = `${rect.width}px`;
  drawCanvas.style.height = `${rect.height}px`;
}

function startCanvasLoop() {
  const drawFrame = () => {
    const width = recordCanvas.width;
    const height = recordCanvas.height;
    ctx.fillStyle = '#111417';
    ctx.fillRect(0, 0, width, height);

    if (mode === 'customArea' && captureRegion && screenVideo.readyState >= 2) {
      drawSelectedScreenRegion();
    } else if (screenVideo.readyState >= 2) {
      drawCover(screenVideo, 0, 0, width, height, false);
    }

    if (cameraToggle.checked && cameraVideo.readyState >= 2) {
      drawCameraOverlay();
    }

    ctx.drawImage(drawCanvas, 0, 0, width, height);
    animationId = requestAnimationFrame(drawFrame);
  };

  drawFrame();
}

function getOutputViewportRect() {
  if (mode === 'customArea' && captureRegion) return captureRegion;
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

function drawSelectedScreenRegion() {
  const region = captureRegion || getDefaultCaptureRegion();
  const scaleX = screenVideo.videoWidth / window.innerWidth;
  const scaleY = screenVideo.videoHeight / window.innerHeight;
  const sourceX = region.left * scaleX;
  const sourceY = region.top * scaleY;
  const sourceWidth = region.width * scaleX;
  const sourceHeight = region.height * scaleY;
  ctx.drawImage(screenVideo, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, recordCanvas.width, recordCanvas.height);
}

function drawCover(video, x, y, width, height, mirrored) {
  const videoRatio = video.videoWidth / video.videoHeight || 16 / 9;
  const targetRatio = width / height;
  let sourceWidth = video.videoWidth;
  let sourceHeight = video.videoHeight;
  let sourceX = 0;
  let sourceY = 0;
  if (videoRatio > targetRatio) {
    sourceWidth = video.videoHeight * targetRatio;
    sourceX = (video.videoWidth - sourceWidth) / 2;
  } else {
    sourceHeight = video.videoWidth / targetRatio;
    sourceY = (video.videoHeight - sourceHeight) / 2;
  }

  if (mirrored) {
    ctx.save();
    ctx.translate(x + width, y);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
    ctx.restore();
  } else {
    ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  }
}

function drawCameraOverlay() {
  const box = cameraOverlay.getBoundingClientRect();
  const viewport = getOutputViewportRect();
  const scaleX = recordCanvas.width / viewport.width;
  const scaleY = recordCanvas.height / viewport.height;
  const x = (box.left - viewport.left) * scaleX;
  const y = (box.top - viewport.top) * scaleY;
  const width = box.width * scaleX;
  const height = box.height * scaleY;
  const radius = cameraSizePreset === 'full'
    ? Math.min(width, height) * 0.055
    : cameraShape === 'circle' ? width / 2 : cameraShape === 'rounded' ? Math.min(width, height) * 0.12 : 0;

  ctx.save();
  roundedPath(ctx, x, y, width, height, radius);
  ctx.clip();
  drawCover(cameraVideo, x, y, width, height, true);
  ctx.restore();
}

function roundedPath(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function buildMixedStream() {
  const canvasStream = recordCanvas.captureStream(30);
  const sourceAudioTracks = [
    ...(micStream ? micStream.getAudioTracks() : [])
  ];
  const audioTracks = mixAudioTracks(sourceAudioTracks);
  mixedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
}

function mixAudioTracks(tracks) {
  if (tracks.length <= 1) return tracks;
  audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();
  tracks.forEach((track) => {
    const source = audioContext.createMediaStreamSource(new MediaStream([track]));
    source.connect(destination);
  });
  return destination.stream.getAudioTracks();
}

function pickMimeType() {
  const candidates = [
    'video/mp4;codecs=h264,aac',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function playRecordCue(type) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const now = context.currentTime;
    const notes = {
      start: [[880, 0, 0.08], [1320, 0.1, 0.13]],
      stop: [[660, 0, 0.08], [392, 0.1, 0.16]],
      pause: [[523, 0, 0.1]],
      resume: [[784, 0, 0.08]],
      complete: [[523, 0, 0.08, 'triangle'], [659, 0.09, 0.08, 'triangle'], [784, 0.18, 0.1, 'triangle'], [1046, 0.32, 0.22, 'sine']]
    }[type] || [[660, 0, 0.1]];

    notes.forEach(([frequency, offset, duration, wave = 'sine']) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(frequency, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(type === 'complete' ? 0.13 : 0.18, now + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + duration + 0.02);
    });

    setTimeout(() => context.close(), type === 'complete' ? 950 : 700);
  } catch (error) {
    console.warn('No pude reproducir el sonido de grabacion:', error);
  }
}

async function startRecording() {
  try {
    if (isRecording) return;
    if (mode === 'customArea' && !captureRegion) {
      startAfterAreaSelection = true;
      showAreaSelection();
      return;
    }
    drawToggle.checked = false;
    document.body.classList.remove('drawing-enabled');
    clearDrawing();
    hideAreaSelection();
    await getStreams();
    if (countdownToggle.checked) await runCountdown();
    startCanvasLoop();
    buildMixedStream();

    const mimeType = pickMimeType();
    chunks = [];
    mediaRecorder = new MediaRecorder(mixedStream, mimeType ? { mimeType } : undefined);
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    mediaRecorder.onstop = saveRecording;
    mediaRecorder.start(1000);

    isRecording = true;
    isPaused = false;
    isStopping = false;
    discardRecording = false;
    pausedAt = 0;
    pausedMs = 0;
    startedAt = Date.now();
    timerId = setInterval(updateTimer, 250);
    setRecordingUi(true);
    if (mode === 'customArea') showRecordingRegionMask();
    window.loomLocal.setRecordingState({ isRecording: true, isPaused: false });
    playRecordCue('start');
  } catch (error) {
    console.error(error);
    alert(`No pude iniciar la grabación: ${error.message}`);
    cleanup();
  }
}

async function runCountdown() {
  countdownEl.classList.remove('hidden');
  for (const value of [3, 2, 1]) {
    countdownEl.textContent = value;
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  countdownEl.classList.add('hidden');
}

function stopRecording() {
  if (!isRecording || !mediaRecorder || isStopping) return;
  const recorder = mediaRecorder;
  isStopping = true;
  if (recorder.state === 'paused') {
    recorder.resume();
    if (pausedAt) pausedMs += Date.now() - pausedAt;
    pausedAt = 0;
    isPaused = false;
  }

  playRecordCue('stop');
  window.loomLocal.setRecordingState({ isRecording: false, isPaused: false });

  setTimeout(() => {
    try {
      if (recorder.state === 'inactive') return;
      if (typeof recorder.requestData === 'function') recorder.requestData();
      recorder.stop();
    } catch (error) {
      console.error(error);
      alert(`No pude detener la grabación: ${error.message}`);
      cleanup();
    }
  }, 160);
  setRecordingUi(false);
}

function cancelRecording() {
  if (!isRecording || !mediaRecorder || isStopping) return;
  discardRecording = true;
  stopRecording();
}

function togglePauseRecording() {
  if (!isRecording || !mediaRecorder || isStopping) return;

  if (mediaRecorder.state === 'recording') {
    mediaRecorder.pause();
    isPaused = true;
    pausedAt = Date.now();
    playRecordCue('pause');
  } else if (mediaRecorder.state === 'paused') {
    mediaRecorder.resume();
    if (pausedAt) pausedMs += Date.now() - pausedAt;
    pausedAt = 0;
    isPaused = false;
    playRecordCue('resume');
  }

  setRecordingUi(true);
  window.loomLocal.setRecordingState({ isRecording: true, isPaused });
}

async function restartRecording() {
  if (!isRecording) {
    await startRecording();
    return;
  }
  mediaRecorder.onstop = async () => {
    cleanup();
    await startRecording();
  };
  mediaRecorder.stop();
}

async function saveRecording() {
  const recorder = mediaRecorder;
  const blob = new Blob(chunks, { type: recorder?.mimeType || 'video/webm' });
  const buffer = await blob.arrayBuffer();
  const shouldQuit = quitAfterCurrentSave;
  const shouldDiscard = discardRecording;
  quitAfterCurrentSave = false;
  cleanup();

  try {
    if (shouldDiscard) {
      chunks = [];
      showToast('Grabación cancelada');
      if (shouldQuit && window.loomLocal) window.loomLocal.quit();
      return;
    }

    const shouldUploadToCloud = saveTarget === 'cloud' && isCloudProviderConfigured(cloudProvider);
    const providerLabel = getProviderLabel(cloudProvider);
    showToast(shouldUploadToCloud ? `Procesando MP4 para ${providerLabel}...` : 'Guardando MP4...');
    const saved = await window.loomLocal.saveRecording({
      title: titleInput.value,
      mimeType: blob.type,
      buffer,
      destination: shouldUploadToCloud ? 'temp' : 'local'
    });
    const filePath = typeof saved === 'string' ? saved : saved.filePath;
    chunks = [];

    if (shouldUploadToCloud) {
      showToast(`Subiendo a ${providerLabel}...`);
      try {
        const upload = await window.loomLocal.uploadToCloud({
          filePath,
          title: titleInput.value,
          deleteLocal: true,
          provider: cloudProvider
        });
        playRecordCue('complete');
        showToast(upload.watchUrl ? `Subido a ${providerLabel}. Link copiado.` : `Subido a ${providerLabel}.`);
      } catch (uploadError) {
        console.error(uploadError);
        const fallback = await window.loomLocal.saveTempRecordingLocally({
          filePath,
          title: titleInput.value
        });
        playRecordCue('complete');
        const reason = humanCloudUploadError(uploadError, providerLabel);
        showToast(`${providerLabel} falló; guardado local: ${fallback.filePath.split('/').pop()}`);
        alert(`${reason}\n\nNo perdí la grabación: quedó guardada localmente en:\n${fallback.filePath}`);
      }
    } else {
      playRecordCue('complete');
      showToast(`Guardado en ${localSaveDirName || 'la carpeta'}: ${filePath.split('/').pop()}`);
    }

    if (shouldQuit && window.loomLocal) window.loomLocal.quit();
  } catch (error) {
    console.error(error);
    alert(`No pude guardar la grabación: ${error.message}`);
  }
}

function humanCloudUploadError(error, providerLabel = 'la nube') {
  const raw = String(error?.message || error || `${providerLabel} no pudo subir el video.`);
  const message = raw.replace(/^Error invoking remote method 'cloud(?:flare)?:upload': Error:\s*/i, '').trim();
  if (/storage capacity exceeded|quota|allocated storage/i.test(message)) {
    return `${providerLabel} se quedó sin espacio o cuota para subir videos. Borra videos viejos, espera a que regrese la cuota o compra más capacidad.`;
  }
  return `${providerLabel} no pudo subir el video: ${message}`;
}

function cleanup() {
  isRecording = false;
  isPaused = false;
  isStopping = false;
  discardRecording = false;
  pausedAt = 0;
  pausedMs = 0;
  window.loomLocal.setRecordingState({ isRecording: false, isPaused: false });
  clearInterval(timerId);
  cancelAnimationFrame(animationId);
  [screenStream, micStream, mixedStream].forEach((stream) => {
    if (stream) stream.getTracks().forEach((track) => track.stop());
  });
  if (!cameraToggle.checked) stopCameraPreview();
  if (audioContext) audioContext.close();
  audioContext = null;
  screenStream = null;
  micStream = null;
  mixedStream = null;
  mediaRecorder = null;
  screenVideo.srcObject = null;
  clearDrawing();
  hideRecordingRegionMask();
  setRecordingUi(false);
}

function requestQuit() {
  if (isRecording && mediaRecorder) {
    quitAfterCurrentSave = true;
    stopRecording();
    return;
  }
  if (window.loomLocal) window.loomLocal.quit();
}

function stopCameraPreview() {
  if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  cameraVideo.srcObject = null;
  cameraPreview.srcObject = null;
}

async function switchCamera(deviceId) {
  if (!deviceId || deviceId === 'none') {
    cameraToggle.checked = false;
    stopCameraPreview();
    setCameraOverlayVisible(false);
    renderCameraButtons();
    return;
  }

  stopCameraPreview();
  cameraToggle.checked = true;
  selectedCameraId = deviceId;
  renderCameraButtons();
  try {
    await ensureCameraPreview();
    setCameraOverlayVisible(true);
  } catch (error) {
    cameraToggle.checked = false;
    setCameraOverlayVisible(false);
    renderCameraButtons();
    showToast(`No pude abrir esa cámara: ${error.message}`);
  }
}

function setRecordingUi(recording) {
  document.body.classList.toggle('recording', recording);
  document.body.classList.toggle('paused', recording && isPaused);
  document.body.classList.toggle('drawing-enabled', recording && drawToggle.checked);
  if (liveControls) liveControls.classList.toggle('hidden', !recording);
  startBtn.disabled = recording;
  stopBtn.disabled = !recording;
  restartBtn.disabled = !recording;
  if (recStatus) recStatus.textContent = recording ? (isPaused ? 'Pausado' : 'Grabando') : 'Listo para grabar';
  if (!recording && recTimer) recTimer.textContent = '00:00';
  updateLiveControls();
}

function updateLiveControls() {
  if (livePauseBtn) livePauseBtn.textContent = isPaused ? '▶' : 'Ⅱ';
  if (livePauseBtn) livePauseBtn.title = isPaused ? 'Continuar' : 'Pausar';
  if (livePenBtn) livePenBtn.classList.toggle('active', drawToggle.checked);
}

function updateTimer() {
  const now = isPaused && pausedAt ? pausedAt : Date.now();
  const seconds = Math.max(0, Math.floor((now - startedAt - pausedMs) / 1000));
  if (recTimer) {
    recTimer.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
}

function canvasPoint(event) {
  const rect = mode === 'customArea' && captureRegion
    ? {
        left: captureRegion.left,
        top: captureRegion.top,
        width: captureRegion.width,
        height: captureRegion.height
      }
    : drawCanvas.getBoundingClientRect();
  if (
    mode === 'customArea'
    && captureRegion
    && (event.clientX < rect.left || event.clientY < rect.top || event.clientX > rect.left + rect.width || event.clientY > rect.top + rect.height)
  ) {
    return null;
  }
  return {
    x: (event.clientX - rect.left) * (drawCanvas.width / rect.width),
    y: (event.clientY - rect.top) * (drawCanvas.height / rect.height)
  };
}

function startDraw(event) {
  if (!isRecording || !drawToggle.checked) return;
  const point = canvasPoint(event);
  if (!point) return;
  isDrawing = true;
  lastPoint = point;
}

function moveDraw(event) {
  if (!isDrawing || !lastPoint) return;
  const point = canvasPoint(event);
  if (!point) {
    stopDraw();
    return;
  }
  drawCtx.strokeStyle = '#ffd166';
  drawCtx.lineWidth = Math.max(6, drawCanvas.width * 0.006);
  drawCtx.lineCap = 'round';
  drawCtx.lineJoin = 'round';
  drawCtx.beginPath();
  drawCtx.moveTo(lastPoint.x, lastPoint.y);
  drawCtx.lineTo(point.x, point.y);
  drawCtx.stroke();
  lastPoint = point;
  clearTimeout(drawFadeTimer);
  drawFadeTimer = setTimeout(clearDrawing, 5000);
}

function stopDraw() {
  isDrawing = false;
  lastPoint = null;
}

function clearDrawing() {
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
}

function showToast(message) {
  saveToast.textContent = message;
  saveToast.classList.remove('hidden');
  setTimeout(() => saveToast.classList.add('hidden'), 4500);
}

function renderCameraButtons() {
  if (cameraDevices.length === 0) return;
  const selectedDevice = cameraDevices.find((device) => device.deviceId === selectedCameraId);
  const cameraEnabled = Boolean(cameraToggle.checked && selectedDevice);
  cameraName.textContent = cameraEnabled ? (selectedDevice.label || 'Cámara') : 'Sin cámara';
  cameraHint.textContent = cameraEnabled ? 'Se grabará tu burbuja' : 'Sólo pantalla';
  setCameraOverlayVisible(cameraEnabled);
  const noCameraButton = `<button class="camera-device${cameraEnabled ? '' : ' selected'}" data-camera-option="none">Sin cámara</button>`;
  const cameraOptions = cameraDevices.map((device, index) => {
    const label = escapeHtml(device.label || `Cámara ${index + 1}`);
    const selected = cameraEnabled && device.deviceId === selectedCameraId ? ' selected' : '';
    return `<button class="camera-device${selected}" data-camera-id="${escapeHtml(device.deviceId)}">${label}</button>`;
  }).join('');
  cameraButtons.innerHTML = `${noCameraButton}${cameraOptions}`;
}

function setCameraOverlayVisible(visible) {
  cameraOverlay.classList.toggle('hidden-camera', !visible);
  syncCameraCloseButton();
}

function syncSwitchLabel(input) {
  const label = input.closest('.loom-switch');
  const text = label ? label.querySelector('span') : null;
  if (text) text.textContent = input.checked ? 'Sí' : 'No';
}

function syncSwitchLabels() {
  syncSwitchLabel(cameraToggle);
  syncSwitchLabel(micToggle);
}

function applyCameraShape() {
  cameraOverlay.classList.remove('circle', 'rounded', 'square');
  cameraOverlay.classList.add(cameraShape);
  shapeButtons.forEach((button) => button.classList.toggle('selected', button.dataset.shape === cameraShape));
  syncCameraCloseButton();
}

function applyCameraSize(width, height = width) {
  cameraOverlay.style.width = `${width}px`;
  cameraOverlay.style.height = `${height}px`;
  syncCameraCloseButton();
}

function applyCameraSizePreset(preset) {
  cameraSizePreset = preset;
  cameraOverlay.classList.toggle('fullscreen-camera', preset === 'full');

  if (preset === 'full') {
    const topMargin = 86;
    const bottomMargin = 124;
    const sideMargin = 72;
    const availableWidth = Math.max(360, window.innerWidth - sideMargin * 2);
    const availableHeight = Math.max(260, window.innerHeight - topMargin - bottomMargin);
    const ratio = cameraPreview.videoWidth && cameraPreview.videoHeight
      ? cameraPreview.videoWidth / cameraPreview.videoHeight
      : 16 / 9;
    let width = availableWidth;
    let height = width / ratio;
    if (height > availableHeight) {
      height = availableHeight;
      width = height * ratio;
    }
    cameraOverlay.style.left = `${Math.round((window.innerWidth - width) / 2)}px`;
    cameraOverlay.style.top = `${Math.round(topMargin + (availableHeight - height) / 2)}px`;
    cameraOverlay.style.right = 'auto';
    cameraOverlay.style.bottom = 'auto';
    applyCameraSize(Math.round(width), Math.round(height));
    sizeButtons.forEach((button) => button.classList.toggle('selected', button.dataset.size === preset));
    return;
  }

  const sizes = {
    small: 230,
    medium: 320,
    large: 430
  };
  applyCameraSize(sizes[preset] || sizes.medium);
  sizeButtons.forEach((button) => button.classList.toggle('selected', button.dataset.size === preset));
}

function syncCameraCloseButton() {
  if (!cornerQuitBtn) return;
  const cameraVisible = !cameraOverlay.classList.contains('hidden-camera');
  cornerQuitBtn.classList.toggle('hidden-camera-close', !cameraVisible);
  if (!cameraVisible) return;

  requestAnimationFrame(() => {
    const rect = cameraOverlay.getBoundingClientRect();
    const size = cornerQuitBtn.offsetWidth || 30;
    const left = clamp(rect.left - 10, 6, window.innerWidth - size - 6);
    const top = clamp(rect.top - 10, 6, window.innerHeight - size - 6);
    cornerQuitBtn.style.left = `${left}px`;
    cornerQuitBtn.style.top = `${top}px`;
  });
}

function getDefaultCaptureRegion() {
  const marginX = Math.max(70, Math.round(window.innerWidth * 0.08));
  const marginY = Math.max(70, Math.round(window.innerHeight * 0.1));
  return {
    left: marginX,
    top: marginY,
    width: Math.max(320, window.innerWidth - marginX * 2),
    height: Math.max(220, window.innerHeight - marginY * 2)
  };
}

function renderCaptureRegion() {
  if (!areaSelectionBox || !captureRegion) return;
  areaSelectionBox.classList.remove('hidden');
  areaSelectionBox.style.left = `${captureRegion.left}px`;
  areaSelectionBox.style.top = `${captureRegion.top}px`;
  areaSelectionBox.style.width = `${captureRegion.width}px`;
  areaSelectionBox.style.height = `${captureRegion.height}px`;
  renderRecordingRegionMask();
  syncDrawCanvasFrame();
}

function normalizeCaptureRegion(startX, startY, endX, endY) {
  const left = clamp(Math.min(startX, endX), 0, window.innerWidth - 1);
  const top = clamp(Math.min(startY, endY), 0, window.innerHeight - 1);
  const right = clamp(Math.max(startX, endX), left + 1, window.innerWidth);
  const bottom = clamp(Math.max(startY, endY), top + 1, window.innerHeight);
  return {
    left,
    top,
    width: right - left,
    height: bottom - top
  };
}

function showAreaSelection() {
  if (!areaSelectionLayer) return;
  if (captureRegion) renderCaptureRegion();
  else areaSelectionBox.classList.add('hidden');
  areaSelectionLayer.classList.remove('hidden');
  document.body.classList.add('selecting-area');
  if (window.loomLocal) window.loomLocal.setMousePassthrough(false);
}

function hideAreaSelection() {
  if (!areaSelectionLayer) return;
  areaSelectionState = null;
  areaSelectionLayer.classList.add('hidden');
  document.body.classList.remove('selecting-area');
}

function beginAreaSelection(event) {
  if (isRecording) return;
  areaSelectionState = {
    startX: event.clientX,
    startY: event.clientY
  };
  captureRegion = normalizeCaptureRegion(event.clientX, event.clientY, event.clientX + 1, event.clientY + 1);
  renderCaptureRegion();
  areaSelectionLayer.setPointerCapture(event.pointerId);
}

function moveAreaSelection(event) {
  if (!areaSelectionState) return;
  captureRegion = normalizeCaptureRegion(areaSelectionState.startX, areaSelectionState.startY, event.clientX, event.clientY);
  renderCaptureRegion();
}

async function endAreaSelection() {
  if (!areaSelectionState) return;
  areaSelectionState = null;
  if (!captureRegion || captureRegion.width < 90 || captureRegion.height < 70) {
    captureRegion = null;
    areaSelectionBox.classList.add('hidden');
    showToast('Selecciona un área más grande');
    return;
  }
  hideAreaSelection();
  showRecordingRegionMask();
  if (startAfterAreaSelection) {
    startAfterAreaSelection = false;
    await startRecording();
  } else {
    showToast('Área seleccionada');
  }
}

function renderRecordingRegionMask() {
  if (!recordingRegionMask || !captureRegion) return;
  recordingRegionMask.style.left = `${captureRegion.left}px`;
  recordingRegionMask.style.top = `${captureRegion.top}px`;
  recordingRegionMask.style.width = `${captureRegion.width}px`;
  recordingRegionMask.style.height = `${captureRegion.height}px`;
}

function showRecordingRegionMask() {
  if (!recordingRegionMask || mode !== 'customArea' || !captureRegion) return;
  renderRecordingRegionMask();
  recordingRegionMask.classList.remove('hidden');
}

function hideRecordingRegionMask() {
  if (recordingRegionMask) recordingRegionMask.classList.add('hidden');
}

function keepCameraToolbarOpen() {
  clearTimeout(cameraToolbarCloseTimer);
  document.querySelector('.camera-toolbar').classList.add('open');
  if (window.loomLocal) window.loomLocal.setMousePassthrough(false);
}

function scheduleCameraToolbarClose() {
  clearTimeout(cameraToolbarCloseTimer);
  cameraToolbarCloseTimer = setTimeout(() => {
    document.querySelector('.camera-toolbar').classList.remove('open');
  }, 500);
}

function beginMove(event, target) {
  const rect = target.getBoundingClientRect();
  dragState = {
    type: target === cameraOverlay ? 'camera' : target === liveControls ? 'live' : 'panel',
    startX: event.clientX,
    startY: event.clientY,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
  target.setPointerCapture(event.pointerId);
}

function beginCameraResize(event) {
  event.stopPropagation();
  cameraOverlay.classList.remove('fullscreen-camera');
  const rect = cameraOverlay.getBoundingClientRect();
  dragState = {
    type: 'resize',
    startX: event.clientX,
    startY: event.clientY,
    width: rect.width
  };
  cameraOverlay.setPointerCapture(event.pointerId);
}

function moveTarget(event) {
  if (!dragState || dragState.type === 'resize') return;
  const target = dragState.type === 'camera' ? cameraOverlay : dragState.type === 'live' ? liveControls : controlPanel;
  const left = clamp(dragState.left + event.clientX - dragState.startX, 0, window.innerWidth - dragState.width);
  const top = clamp(dragState.top + event.clientY - dragState.startY, 0, window.innerHeight - dragState.height);
  target.style.left = `${left}px`;
  target.style.top = `${top}px`;
  target.style.right = 'auto';
  target.style.bottom = 'auto';
  if (target === liveControls) target.style.transform = 'none';
  if (target === cameraOverlay) syncCameraCloseButton();
}

function resizeCamera(event) {
  if (!dragState || dragState.type !== 'resize') return;
  const delta = Math.max(event.clientX - dragState.startX, event.clientY - dragState.startY);
  const nextSize = clamp(dragState.width + delta, 120, 420);
  cameraSizePreset = 'custom';
  sizeButtons.forEach((button) => button.classList.remove('selected'));
  applyCameraSize(nextSize);
  syncCameraCloseButton();
}

function isNearCameraEdge(event) {
  const rect = cameraOverlay.getBoundingClientRect();
  const edge = 14;
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  return x <= edge || y <= edge || rect.width - x <= edge || rect.height - y <= edge;
}

function updateCameraCursor(event) {
  if (event.target.closest('.camera-toolbar')) return;
  cameraOverlay.style.cursor = isNearCameraEdge(event) ? 'nwse-resize' : 'move';
}

function endPointer() {
  dragState = null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function updatePointerPassthrough(event) {
  if (!window.loomLocal) return;
  const interactive = event.target.closest('.interactive') || (event.target === drawCanvas && isRecording && drawToggle.checked);
  const shouldIgnore = !interactive;
  if (shouldIgnore !== pointerIgnored) {
    pointerIgnored = shouldIgnore;
    await window.loomLocal.setMousePassthrough(shouldIgnore);
  }
}

modeButtons.forEach((button) => button.addEventListener('click', () => {
  if (isRecording) return;
  setMode(button.dataset.mode);
}));
qualityButtons.forEach((button) => button.addEventListener('click', () => {
  setQuality(button.dataset.quality);
  closeDropdowns();
}));
if (qualityDropdownBtn) qualityDropdownBtn.addEventListener('click', () => toggleDropdown(qualityMenu));
if (saveTargetBtn) saveTargetBtn.addEventListener('click', () => toggleDropdown(saveTargetMenu));
if (cameraDropdownBtn) cameraDropdownBtn.addEventListener('click', () => toggleDropdown(cameraMenu));
if (cloudProviderBtn) cloudProviderBtn.addEventListener('click', () => toggleDropdown(cloudProviderMenu));
saveTargetButtons.forEach((button) => button.addEventListener('click', async () => {
  await setSaveTarget(button.dataset.saveTarget);
  closeDropdowns();
}));
cloudProviderButtons.forEach((button) => button.addEventListener('click', async () => {
  await setCloudProvider(button.dataset.cloudProvider);
  closeDropdowns();
}));
if (cloudToggle) {
  cloudToggle.addEventListener('click', async () => {
    await setSaveTarget(cloudUploadEnabled ? 'local' : cloudProvider);
  });
}
if (settingsBtn) {
  settingsBtn.addEventListener('pointerdown', keepOverlayInteractive);
  settingsBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    openSettingsPanel();
  });
}
if (settingsCloseBtn) {
  settingsCloseBtn.addEventListener('pointerdown', keepOverlayInteractive);
  settingsCloseBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    closeSettingsPanel();
  });
}
if (authorizeGoogleBtn) authorizeGoogleBtn.addEventListener('click', authorizeGoogleFromUi);
if (chooseDriveLocationBtn) chooseDriveLocationBtn.addEventListener('click', chooseDriveLocationFromUi);
if (disconnectGoogleBtn) disconnectGoogleBtn.addEventListener('click', disconnectGoogleFromUi);
startBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);
restartBtn.addEventListener('click', restartRecording);
if (livePauseBtn) livePauseBtn.addEventListener('click', togglePauseRecording);
if (liveStopBtn) liveStopBtn.addEventListener('click', stopRecording);
if (liveCancelBtn) liveCancelBtn.addEventListener('click', cancelRecording);
if (liveDragHandle) liveDragHandle.addEventListener('pointerdown', (event) => {
  event.stopPropagation();
  beginMove(event, liveControls);
});
if (livePenBtn) livePenBtn.addEventListener('click', () => {
  drawToggle.checked = !drawToggle.checked;
  document.body.classList.toggle('drawing-enabled', isRecording && drawToggle.checked);
  updateLiveControls();
});
if (chooseFolderBtn) chooseFolderBtn.addEventListener('click', async () => {
  if (!window.loomLocal?.chooseSaveDirectory) return;
  try {
    applySettings(await window.loomLocal.chooseSaveDirectory());
    await setSaveTarget('local');
  } catch (error) {
    console.error(error);
    showToast('No pude cambiar la carpeta');
  }
});
if (openFolderBtn) openFolderBtn.addEventListener('click', () => {
  if (window.loomLocal) window.loomLocal.openFolder();
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.dropdown')) closeDropdowns();
});
quitBtn.addEventListener('click', () => {
  requestQuit();
});
quitBtn.addEventListener('pointerdown', keepOverlayInteractive);
cornerQuitBtn.addEventListener('click', () => {
  requestQuit();
});
cornerQuitBtn.addEventListener('pointerenter', () => {
  if (window.loomLocal) window.loomLocal.setMousePassthrough(false);
});
cornerQuitBtn.addEventListener('pointerdown', (event) => {
  event.stopPropagation();
  if (window.loomLocal) window.loomLocal.setMousePassthrough(false);
});
window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (settingsPanel && !settingsPanel.classList.contains('hidden')) {
    closeSettingsPanel();
    return;
  }
  requestQuit();
});
cameraTestBtn.addEventListener('click', () => switchCamera(selectedCameraId || cameraDevices[0]?.deviceId));
cameraButtons.addEventListener('click', (event) => {
  const noCameraButton = event.target.closest('[data-camera-option="none"]');
  if (noCameraButton) {
    switchCamera('none');
    closeDropdowns();
    return;
  }
  const button = event.target.closest('[data-camera-id]');
  if (button) {
    switchCamera(button.dataset.cameraId);
    closeDropdowns();
  }
});
cameraToggle.addEventListener('change', async () => {
  syncSwitchLabels();
  const visible = cameraToggle.checked;
  setCameraOverlayVisible(visible);
  if (visible) {
    try {
      await ensureCameraPreview();
    } catch (error) {
      cameraToggle.checked = false;
      syncSwitchLabels();
      setCameraOverlayVisible(false);
      showToast(`No pude encender la cámara: ${error.message}`);
    }
  } else {
    stopCameraPreview();
  }
  renderCameraButtons();
});
micToggle.addEventListener('change', syncSwitchLabels);
drawToggle.addEventListener('change', () => {
  document.body.classList.toggle('drawing-enabled', isRecording && drawToggle.checked);
  updateLiveControls();
});
shapeButtons.forEach((button) => button.addEventListener('click', () => {
  cameraShape = button.dataset.shape;
  applyCameraShape();
  keepCameraToolbarOpen();
}));
sizeButtons.forEach((button) => button.addEventListener('click', () => {
  applyCameraSizePreset(button.dataset.size);
  keepCameraToolbarOpen();
}));
cameraOverlay.addEventListener('mouseenter', keepCameraToolbarOpen);
cameraOverlay.addEventListener('mouseleave', scheduleCameraToolbarClose);
document.querySelector('.camera-toolbar').addEventListener('mouseenter', keepCameraToolbarOpen);
document.querySelector('.camera-toolbar').addEventListener('mouseleave', scheduleCameraToolbarClose);
document.querySelector('.camera-toolbar').addEventListener('pointerdown', (event) => {
  event.stopPropagation();
  keepCameraToolbarOpen();
});
document.querySelector('.camera-toolbar').addEventListener('click', (event) => {
  event.stopPropagation();
  keepCameraToolbarOpen();
});
cameraOverlay.addEventListener('pointerdown', (event) => {
  if (event.target.closest('.camera-toolbar, .corner-quit')) return;
  if (isNearCameraEdge(event)) {
    beginCameraResize(event);
    return;
  }
  beginMove(event, cameraOverlay);
});
dragHandle.addEventListener('pointerdown', (event) => beginMove(event, controlPanel));
cameraOverlay.addEventListener('mousemove', updateCameraCursor);
window.addEventListener('pointermove', (event) => {
  moveTarget(event);
  resizeCamera(event);
  updatePointerPassthrough(event);
});
document.querySelectorAll('.interactive').forEach((element) => {
  element.addEventListener('pointerenter', () => keepOverlayInteractive());
  element.addEventListener('pointermove', () => keepOverlayInteractive());
});
window.addEventListener('pointerup', endPointer);
if (areaSelectionLayer) {
  areaSelectionLayer.addEventListener('pointerdown', beginAreaSelection);
  areaSelectionLayer.addEventListener('pointermove', moveAreaSelection);
  areaSelectionLayer.addEventListener('pointerup', endAreaSelection);
  areaSelectionLayer.addEventListener('pointercancel', endAreaSelection);
}
window.addEventListener('resize', sizeRecordingCanvas);
window.addEventListener('resize', () => {
  if (cameraSizePreset !== 'custom') applyCameraSizePreset(cameraSizePreset);
  if (mode === 'customArea' && captureRegion) {
    captureRegion = normalizeCaptureRegion(
      captureRegion.left,
      captureRegion.top,
      Math.min(captureRegion.left + captureRegion.width, window.innerWidth),
      Math.min(captureRegion.top + captureRegion.height, window.innerHeight)
    );
    renderCaptureRegion();
  }
  syncCameraCloseButton();
});
drawCanvas.addEventListener('pointerdown', startDraw);
drawCanvas.addEventListener('pointermove', moveDraw);
drawCanvas.addEventListener('pointerup', stopDraw);
drawCanvas.addEventListener('pointerleave', stopDraw);

setMode(mode);
applyCameraShape();
applyCameraSizePreset(cameraSizePreset);
syncCameraCloseButton();
navigator.mediaDevices.addEventListener('devicechange', loadCameraDevices);
if (window.loomLocal) window.loomLocal.onStopRecordingRequest(() => stopRecording());
if (window.loomLocal) window.loomLocal.onPauseToggleRecordingRequest(() => togglePauseRecording());
setQuality(qualitySelect.value);
loadAppSettings().then(loadCloudflareStatus);
requestStartupPermissions();
