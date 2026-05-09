const { app, BrowserWindow, ipcMain, desktopCapturer, shell, dialog, screen, session, systemPreferences, Menu, Tray, nativeImage, clipboard } = require('electron');
const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');

const execFileAsync = promisify(execFile);
const defaultRecordingsDir = path.join(os.homedir(), 'Desktop');
const cloudUploadLimitBytes = 200 * 1024 * 1024;
let recordingTray = null;
let trayPulseTimer = null;
let trayPulse = false;
let trayRecordingPaused = false;

app.setName('Loom');

function createWindow() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    title: 'Loom',
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    fullscreenable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setContentProtection(true);
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(async () => {
  await fs.mkdir(await getRecordingsDir(), { recursive: true });
  configurePermissions();
  createAppMenu();
  if (app.dock) app.dock.show();
  createWindow();
  warnIfNotInstalledInApplications();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

function warnIfNotInstalledInApplications() {
  if (process.platform !== 'darwin' || !app.isPackaged || app.isInApplicationsFolder()) return;
  dialog.showMessageBox({
    type: 'warning',
    title: 'Instala Loom en Aplicaciones',
    message: 'Loom debe abrirse desde Aplicaciones',
    detail: 'Si la abres desde el DMG, Descargas o una copia temporal, macOS puede pedir permisos de pantalla una y otra vez. Arrastra Loom a Aplicaciones, reemplaza la anterior, ciérrala por completo y vuelve a abrirla desde ahí.',
    buttons: ['Entendido']
  });
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

async function readAppSettings() {
  const defaults = {
    saveTarget: 'local',
    recordingsDir: defaultRecordingsDir
  };

  try {
    const raw = await fs.readFile(getSettingsPath(), 'utf8');
    const saved = JSON.parse(raw);
    const saveTarget = saved.saveTarget === 'cloud' ? 'cloud' : 'local';
    const recordingsDir = typeof saved.recordingsDir === 'string' && saved.recordingsDir.trim()
      ? saved.recordingsDir
      : defaultRecordingsDir;
    return { ...defaults, saveTarget, recordingsDir };
  } catch {
    return defaults;
  }
}

async function writeAppSettings(nextSettings) {
  const current = await readAppSettings();
  const settings = {
    ...current,
    ...nextSettings
  };
  settings.saveTarget = settings.saveTarget === 'cloud' ? 'cloud' : 'local';
  if (!settings.recordingsDir) settings.recordingsDir = defaultRecordingsDir;
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(getSettingsPath(), JSON.stringify(settings, null, 2));
  return formatAppSettings(settings);
}

async function getRecordingsDir() {
  const settings = await readAppSettings();
  return settings.recordingsDir || defaultRecordingsDir;
}

function formatAppSettings(settings) {
  const recordingsDir = settings.recordingsDir || defaultRecordingsDir;
  return {
    saveTarget: settings.saveTarget === 'cloud' ? 'cloud' : 'local',
    recordingsDir,
    recordingsDirName: path.basename(recordingsDir) || recordingsDir,
    defaultRecordingsDir
  };
}

function configurePermissions() {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'display-capture', 'fullscreen'].includes(permission);
    callback(allowed);
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => (
    ['media', 'display-capture', 'fullscreen'].includes(permission)
  ));

  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 0, height: 0 },
      fetchWindowIcons: false
    }).then((sources) => {
      if (sources.length === 0) {
        callback({});
        return;
      }
      const currentDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      const currentScreen = sources.find((source) => source.display_id === String(currentDisplay.id));
      callback({ video: currentScreen || sources[0] });
    }).catch((error) => {
      console.error('No pude preparar la captura de pantalla:', error);
      callback({});
    });
  }, { useSystemPicker: process.platform === 'darwin' });
}

function createAppMenu() {
  const template = [
    {
      label: 'Loom',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Cerrar Loom',
          accelerator: 'Command+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Vista',
      submenu: [
        {
          label: 'Mostrar/Ocultar Overlay',
          accelerator: 'Command+H',
          click: () => {
            const win = BrowserWindow.getAllWindows()[0];
            if (!win) return;
            if (win.isVisible()) win.hide();
            else win.show();
          }
        },
        { role: 'toggleDevTools' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function makeTrayIcon(state = 'recording') {
  const paused = state === 'paused';
  const active = state === 'recording-active';
  const fill = paused ? '#ff9f0a' : active ? '#ff3b30' : '#bd1b16';
  const glow = paused ? '#ffd60a' : active ? '#ff9a94' : '#ff453a';
  const glyph = paused
    ? '<rect x="8" y="7" width="2.2" height="8" rx="1" fill="#fff"/><rect x="12" y="7" width="2.2" height="8" rx="1" fill="#fff"/>'
    : '<circle cx="11" cy="11" r="2.2" fill="#fff" opacity="0.72"/>';
  const svg = `
    <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="11" r="8.2" fill="${glow}" opacity="0.28"/>
      <circle cx="11" cy="11" r="5.8" fill="${fill}"/>
      ${glyph}
    </svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
}

function buildRecordingTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: trayRecordingPaused ? 'Continuar grabacion' : 'Pausar grabacion',
      click: togglePauseRecordingFromTray
    },
    {
      label: 'Detener y guardar',
      click: stopRecordingFromTray
    },
    { type: 'separator' },
    {
      label: 'Mostrar controles',
      click: () => BrowserWindow.getAllWindows()[0]?.show()
    },
    {
      label: 'Cerrar Loom',
      click: () => app.quit()
    }
  ]);
}

function openRecordingTrayMenu() {
  if (recordingTray) recordingTray.popUpContextMenu(buildRecordingTrayMenu());
}

function updateRecordingTrayMenu() {
  if (!recordingTray) return;
  recordingTray.setToolTip(trayRecordingPaused
    ? 'Loom esta en pausa. Clic para terminar y guardar.'
    : 'Loom esta grabando. Clic para terminar y guardar.');
  recordingTray.setImage(makeTrayIcon(trayRecordingPaused ? 'paused' : 'recording-active'));
  if (process.platform === 'darwin') {
    recordingTray.setTitle(trayRecordingPaused ? ' PAUSA' : ' REC');
  }
}

function showRecordingTray(isPaused = false) {
  trayRecordingPaused = Boolean(isPaused);
  if (!recordingTray) {
    recordingTray = new Tray(makeTrayIcon(trayRecordingPaused ? 'paused' : 'recording-active'));
    recordingTray.on('click', stopRecordingFromTray);
    recordingTray.on('right-click', openRecordingTrayMenu);
  }
  updateRecordingTrayMenu();

  clearInterval(trayPulseTimer);
  if (!trayRecordingPaused) {
    trayPulseTimer = setInterval(() => {
      if (!recordingTray) return;
      trayPulse = !trayPulse;
      recordingTray.setImage(makeTrayIcon(trayPulse ? 'recording-active' : 'recording-idle'));
    }, 650);
  }
}

function hideRecordingTray() {
  clearInterval(trayPulseTimer);
  trayPulseTimer = null;
  trayPulse = false;
  trayRecordingPaused = false;
  if (recordingTray) {
    if (process.platform === 'darwin') recordingTray.setTitle('');
    recordingTray.destroy();
    recordingTray = null;
  }
}

function stopRecordingFromTray() {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('recording:stop-request');
}

function togglePauseRecordingFromTray() {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('recording:pause-toggle-request');
}

function getCloudflareConfigPath() {
  return path.join(app.getPath('userData'), 'cloudflare-stream.json');
}

function getLegacyCloudflareConfigPath() {
  return path.join(os.homedir(), 'Library', 'Application Support', 'LoomLocal', 'cloudflare-stream.json');
}

async function getCloudflareConfig() {
  try {
    let raw;
    try {
      raw = await fs.readFile(getCloudflareConfigPath(), 'utf8');
    } catch {
      raw = await fs.readFile(getLegacyCloudflareConfigPath(), 'utf8');
    }
    const config = JSON.parse(raw);
    const accountId = String(config.accountId || '').trim();
    const apiToken = String(config.apiToken || '').trim();
    const customerSubdomain = String(config.customerSubdomain || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const creator = String(config.creator || 'loomlocal').trim();
    const libraryUrl = String(config.libraryUrl || 'https://raulg0mez.github.io/Loom/').trim();
    return {
      configured: Boolean(accountId && apiToken),
      accountId,
      apiToken,
      customerSubdomain,
      creator: creator || 'loomlocal',
      libraryUrl
    };
  } catch {
    return { configured: false };
  }
}

function getCloudflareWatchUrl(config, uid) {
  if (!config.customerSubdomain || !uid) return '';
  return `https://${config.customerSubdomain}/${uid}/watch`;
}

function getLibraryUrl(config, uid, status, title) {
  if (!config.libraryUrl || !uid) return '';
  const url = new URL(config.libraryUrl);
  url.searchParams.set('video', uid);
  if (status) url.searchParams.set('status', status);
  if (title) url.searchParams.set('title', title);
  return url.toString();
}

async function createCloudflareDirectUpload(config, title) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/stream/direct_upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
      'Upload-Creator': config.creator
    },
    body: JSON.stringify({
      maxDurationSeconds: 3600,
      requireSignedURLs: false,
      meta: {
        name: title || 'Grabacion Loom',
        source: 'Loom'
      }
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.success === false || !payload.result?.uploadURL || !payload.result?.uid) {
    const detail = payload?.errors?.[0]?.message || response.statusText || 'Cloudflare no genero URL de subida.';
    throw new Error(detail);
  }

  return payload.result;
}

async function uploadFileToCloudflare(uploadURL, filePath) {
  await execFileAsync('curl', [
    '--fail',
    '--silent',
    '--show-error',
    '--request', 'POST',
    '--form', `file=@${filePath};type=video/mp4`,
    uploadURL
  ], { maxBuffer: 4 * 1024 * 1024 });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('sources:list', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 0, height: 0 },
    fetchWindowIcons: false
  });

  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    type: source.id.startsWith('screen') ? 'screen' : 'window',
    thumbnail: null
  }));
});

async function getFfmpegPath() {
  const candidates = [
    path.join(process.resourcesPath || '', 'ffmpeg', 'ffmpeg')
  ];

  try {
    const staticPath = require('ffmpeg-static');
    if (staticPath) candidates.push(staticPath.replace('app.asar', 'app.asar.unpacked'));
  } catch (error) {
    console.warn('ffmpeg-static no esta disponible:', error.message);
  }

  for (const candidate of candidates.filter(Boolean)) {
    try {
      await fs.access(candidate);
      await fs.chmod(candidate, 0o755).catch(() => {});
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error('No encontre ffmpeg dentro de la app para convertir a MP4.');
}

async function convertRecordingToMp4(inputPath, outputPath) {
  const ffmpegPath = await getFfmpegPath();
  await execFileAsync(ffmpegPath, [
    '-y',
    '-i', inputPath,
    '-map', '0:v:0',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'veryfast',
    '-crf', '22',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-movflags', '+faststart',
    outputPath
  ], { windowsHide: true });
}

async function makeRecordingOutputPath(targetDir, title) {
  const safeTitle = (title || 'Grabacion')
    .replace(/[^a-z0-9-_ ]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'Grabacion';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(targetDir, `${stamp}-${safeTitle}.mp4`);
}

ipcMain.handle('recordings:save', async (_event, payload) => {
  const saveToTemp = payload.destination === 'temp';
  const targetDir = saveToTemp ? path.join(os.tmpdir(), 'loomlocal-recordings') : await getRecordingsDir();
  await fs.mkdir(targetDir, { recursive: true });
  const buffer = Buffer.from(payload.buffer);
  if (buffer.length === 0) {
    throw new Error('La grabacion no genero datos de video. Intenta de nuevo y espera un segundo antes de detener.');
  }

  const outputPath = await makeRecordingOutputPath(targetDir, payload.title);
  if (payload.mimeType && payload.mimeType.includes('mp4')) {
    await fs.writeFile(outputPath, buffer);
    return { filePath: outputPath, temporary: saveToTemp };
  }

  const tempPath = path.join(os.tmpdir(), `${path.basename(outputPath, '.mp4')}.webm`);
  await fs.writeFile(tempPath, buffer);
  try {
    await convertRecordingToMp4(tempPath, outputPath);
    return { filePath: outputPath, temporary: saveToTemp };
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
});

ipcMain.handle('recordings:saveTempLocally', async (_event, payload) => {
  const sourcePath = path.resolve(String(payload.filePath || ''));
  const tempRoot = path.resolve(path.join(os.tmpdir(), 'loomlocal-recordings'));
  if (!sourcePath.startsWith(tempRoot + path.sep)) {
    throw new Error('No puedo mover un archivo temporal desconocido.');
  }

  await fs.access(sourcePath);
  const targetDir = await getRecordingsDir();
  await fs.mkdir(targetDir, { recursive: true });
  const outputPath = await makeRecordingOutputPath(targetDir, payload.title || path.basename(sourcePath, '.mp4'));
  await fs.rename(sourcePath, outputPath).catch(async () => {
    await fs.copyFile(sourcePath, outputPath);
    await fs.unlink(sourcePath).catch(() => {});
  });
  return { filePath: outputPath, temporary: false };
});

ipcMain.handle('cloudflare:status', async () => {
  const config = await getCloudflareConfig();
  return {
    configured: Boolean(config.configured),
    customerSubdomain: config.customerSubdomain || '',
    creator: config.creator || '',
    basicUploadLimitMb: Math.floor(cloudUploadLimitBytes / 1024 / 1024)
  };
});

ipcMain.handle('cloudflare:upload', async (_event, payload) => {
  const config = await getCloudflareConfig();
  if (!config.configured) {
    throw new Error('Cloudflare Stream no esta configurado en esta Mac.');
  }

  const filePath = payload.filePath;
  const stat = await fs.stat(filePath);
  if (stat.size > cloudUploadLimitBytes) {
    throw new Error('Este video pesa mas de 200 MB. Cloudflare Stream requiere subida resumible TUS para archivos grandes; baja la resolucion o grabalo mas corto por ahora.');
  }

  const directUpload = await createCloudflareDirectUpload(config, payload.title);
  const uploadLibraryUrl = getLibraryUrl(config, directUpload.uid, 'uploading', payload.title);
  if (uploadLibraryUrl) await shell.openExternal(uploadLibraryUrl).catch(() => {});
  await uploadFileToCloudflare(directUpload.uploadURL, filePath);

  const watchUrl = getCloudflareWatchUrl(config, directUpload.uid);
  if (watchUrl) clipboard.writeText(watchUrl);
  if (payload.deleteLocal) await fs.unlink(filePath).catch(() => {});
  const libraryUrl = getLibraryUrl(config, directUpload.uid, 'processing', payload.title);

  return {
    uid: directUpload.uid,
    watchUrl,
    iframeUrl: config.customerSubdomain ? `https://${config.customerSubdomain}/${directUpload.uid}/iframe` : '',
    libraryUrl,
    copiedToClipboard: Boolean(watchUrl)
  };
});

ipcMain.handle('recordings:list', async () => {
  const recordingsDir = await getRecordingsDir();
  await fs.mkdir(recordingsDir, { recursive: true });
  const entries = await fs.readdir(recordingsDir, { withFileTypes: true });
  const videos = await Promise.all(entries
    .filter((entry) => entry.isFile() && /\.(webm|mp4)$/i.test(entry.name))
    .map(async (entry) => {
      const filePath = path.join(recordingsDir, entry.name);
      const stat = await fs.stat(filePath);
      return {
        name: entry.name,
        path: filePath,
        size: stat.size,
        createdAt: stat.birthtimeMs
      };
    }));

  return videos.sort((a, b) => b.createdAt - a.createdAt);
});

ipcMain.handle('recordings:reveal', async (_event, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('recordings:openFolder', async () => {
  await shell.openPath(await getRecordingsDir());
});

ipcMain.handle('settings:get', async () => formatAppSettings(await readAppSettings()));

ipcMain.handle('settings:setSaveTarget', async (_event, saveTarget) => {
  const target = saveTarget === 'cloud' ? 'cloud' : 'local';
  return writeAppSettings({ saveTarget: target });
});

ipcMain.handle('settings:chooseSaveDirectory', async () => {
  const settings = await readAppSettings();
  const result = await dialog.showOpenDialog({
    title: 'Elegir carpeta para guardar videos',
    buttonLabel: 'Usar esta carpeta',
    defaultPath: settings.recordingsDir || defaultRecordingsDir,
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || !result.filePaths[0]) {
    return formatAppSettings(settings);
  }

  const recordingsDir = result.filePaths[0];
  await fs.mkdir(recordingsDir, { recursive: true });
  return writeAppSettings({ saveTarget: 'local', recordingsDir });
});

ipcMain.handle('overlay:pointer', (event, ignore) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
});

ipcMain.handle('permissions:help', async () => {
  const result = await dialog.showMessageBox({
    type: 'info',
    title: 'Permisos de macOS',
    message: 'Activa permisos para Loom',
    detail: 'En Configuración del Sistema > Privacidad y seguridad activa Loom en "Grabación de audio del sistema y pantalla". También permite Cámara y Micrófono. La app debe estar en Aplicaciones, no abierta desde el DMG. Después ciérrala por completo y ábrela de nuevo.',
    buttons: ['Abrir Configuración', 'Luego'],
    defaultId: 0,
    cancelId: 1
  });
  if (result.response === 0) {
    await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
  }
});

ipcMain.handle('permissions:openSettings', async () => {
  await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
});

ipcMain.handle('permissions:openCameraSettings', async () => {
  await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Camera');
});

ipcMain.handle('permissions:openMicrophoneSettings', async () => {
  await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
});

ipcMain.handle('permissions:request', async () => {
  const results = {
    camera: systemPreferences.getMediaAccessStatus('camera'),
    microphone: systemPreferences.getMediaAccessStatus('microphone'),
    screen: systemPreferences.getMediaAccessStatus('screen')
  };

  if (results.camera !== 'granted') {
    results.camera = await systemPreferences.askForMediaAccess('camera') ? 'granted' : systemPreferences.getMediaAccessStatus('camera');
  }

  if (results.microphone !== 'granted') {
    results.microphone = await systemPreferences.askForMediaAccess('microphone') ? 'granted' : systemPreferences.getMediaAccessStatus('microphone');
  }

  results.screen = systemPreferences.getMediaAccessStatus('screen');
  return results;
});

ipcMain.handle('permissions:status', async () => ({
  camera: systemPreferences.getMediaAccessStatus('camera'),
  microphone: systemPreferences.getMediaAccessStatus('microphone'),
  screen: systemPreferences.getMediaAccessStatus('screen')
}));

ipcMain.handle('app:quit', () => {
  app.quit();
});

ipcMain.handle('recording:state', (_event, state) => {
  const nextState = typeof state === 'object' && state !== null
    ? state
    : { isRecording: Boolean(state), isPaused: false };

  if (nextState.isRecording) showRecordingTray(Boolean(nextState.isPaused));
  else hideRecordingTray();
});
