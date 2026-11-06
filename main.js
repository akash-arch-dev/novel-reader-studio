const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const gTTS = require('gtts');

let mainWindow;

const USER_DATA_PATH = app.getPath('userData');
const PROJECTS_FILE = path.join(USER_DATA_PATH, 'projects.json');
const SETTINGS_FILE = path.join(USER_DATA_PATH, 'settings.json');
const AUDIO_DIR = path.join(USER_DATA_PATH, 'audio');

if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

function loadJSON(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    return fallback;
  }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    backgroundColor: '#121212',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src/index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('get-projects', () => loadJSON(PROJECTS_FILE, []));
ipcMain.handle('save-project', (event, projectData) => {
  const projects = loadJSON(PROJECTS_FILE, []);
  const index = projects.findIndex(p => p.id === projectData.id);
  if (index >= 0) {
    projects[index] = { ...projects[index], ...projectData, updatedAt: Date.now() };
  } else {
    projects.push({ ...projectData, createdAt: Date.now(), updatedAt: Date.now() });
  }
  saveJSON(PROJECTS_FILE, projects);
  return projects;
});

ipcMain.handle('delete-project', (event, projectId) => {
  let projects = loadJSON(PROJECTS_FILE, []);
  projects = projects.filter(p => p.id !== projectId);
  saveJSON(PROJECTS_FILE, projects);
  return projects;
});

ipcMain.handle('get-settings', () => loadJSON(SETTINGS_FILE, { apiKey: '', prompt: 'Translate and convert this English story into natural Roman Hinglish for audiobook narration:' }));
ipcMain.handle('save-settings', (event, settings) => {
  saveJSON(SETTINGS_FILE, settings);
  return settings;
});

// Pure Node.js Edge TTS implementation using Microsoft's trusted speech synthesis endpoint
async function synthesizeEdgeTTS(text, voice, outputPath) {
  return new Promise((resolve, reject) => {
    const requestId = '6A5AA1D4EAFF4E9FB37E23D8deb49123'.toLowerCase();
    const headers = [
      'X-Timestamp: ' + new Date().toISOString(),
      'Content-Type: application/json; charset=utf-8',
      'Path: speech.config'
    ];
    
    const payload = JSON.stringify({
      context: {
        synthesis: {
          audio: {
            metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false },
            outputFormat: 'audio-24khz-96kbitrate-mono-mp3'
          }
        }
      }
    });

    const url = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/v1/voices?trustedclientid=6A5AA1D4EAFF4E9FB37E23D8deb49123`;
    
    // We can use Microsoft's speech service via standard HTTP POST or fallback chunks
    // Alternatively, let's use a reliable direct text-to-speech bridge:
    const fileStream = fs.createWriteStream(outputPath);
    
    // Fallback wrapper using Edge's public trusted endpoint request structure:
    const dataString = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\
<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>\
<voice name='${voice}'>\
<prosody rate='-5%'>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</prosody>\
</voice>\
</speak>`;

    // Execute request to Edge Speech Synthesis API
    const reqOptions = {
      hostname: 'speech.platform.bing.com',
      port: 443,
      path: `/consumer/speech/synthesize/readaloud/v1/voices/v2?trustedclientid=6A5AA1D4EAFF4E9FB37E23D8deb49123`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.1901.183'
      }
    };

    const req = https.request(reqOptions, (res) => {
      if (res.statusCode !== 200) {
        // If Edge endpoint blocks direct server IP, fallback gracefully to gTTS via Google
        reject(new Error(`Edge TTS API status code ${res.statusCode}`));
        return;
      }
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(outputPath);
      });
    });

    req.on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });

    req.write(dataString);
    req.end();
  });
}

// Multi-Engine Audio Generation Handler
ipcMain.handle('generate-chapter-audio', async (event, { projectId, chapterId, text, voice, versionType }) => {
  const uniqueAudioId = `${Date.now()}`;
  const outputFilename = `${projectId}_${chapterId}_${versionType}_${uniqueAudioId}.mp3`;
  const outputPath = path.join(AUDIO_DIR, outputFilename);

  mainWindow.webContents.send('tts-progress', {
    chapterId,
    versionType,
    status: 'Starting synthesis...'
  });

  try {
    if (voice.startsWith('gtts-')) {
      const langCode = voice.replace('gtts-', '');
      await new Promise((resolve, reject) => {
        const speech = new gTTS(text, langCode);
        speech.save(outputPath, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    } else {
      try {
        await synthesizeEdgeTTS(text, voice, outputPath);
      } catch (edgeErr) {
        // Automatic Fallback to Google TTS if network/headers block Edge endpoint
        console.warn('Edge TTS direct endpoint failed, falling back to Google TTS:', edgeErr.message);
        await new Promise((resolve, reject) => {
          const speech = new gTTS(text, 'en');
          speech.save(outputPath, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
      }
    }

    // Save metadata back to projects JSON storage
    const projects = loadJSON(PROJECTS_FILE, []);
    const pIndex = projects.findIndex(p => p.id === projectId);
    if (pIndex >= 0) {
      const cIndex = projects[pIndex].chapters.findIndex(c => c.id === chapterId);
      if (cIndex >= 0) {
        if (!projects[pIndex].chapters[cIndex].audioVersions) {
          projects[pIndex].chapters[cIndex].audioVersions = [];
        }
        projects[pIndex].chapters[cIndex].audioVersions.push({
          id: uniqueAudioId,
          versionType,
          voice,
          path: outputPath,
          createdAt: Date.now()
        });
        saveJSON(PROJECTS_FILE, projects);
      }
    }

    mainWindow.webContents.send('tts-progress', { chapterId, versionType, status: 'Completed' });
    return { success: true, audioPath: outputPath };
  } catch (err) {
    throw new Error(err.message || 'Audio generation failed');
  }
});

ipcMain.handle('delete-audio-version', (event, { projectId, chapterId, audioId }) => {
  const projects = loadJSON(PROJECTS_FILE, []);
  const pIndex = projects.findIndex(p => p.id === projectId);
  if (pIndex >= 0) {
    const cIndex = projects[pIndex].chapters.findIndex(c => c.id === chapterId);
    if (cIndex >= 0) {
      const versions = projects[pIndex].chapters[cIndex].audioVersions || [];
      const target = versions.find(v => v.id === audioId);
      if (target && fs.existsSync(target.path)) fs.unlinkSync(target.path);
      projects[pIndex].chapters[cIndex].audioVersions = versions.filter(v => v.id !== audioId);
      saveJSON(PROJECTS_FILE, projects);
    }
  }
  return loadJSON(PROJECTS_FILE, []);
});