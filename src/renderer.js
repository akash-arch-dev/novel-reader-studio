let projects = [];
let settings = { apiKey: '', prompt: '' };
let activeProjectId = null;
let activeChapterId = null;
let autoSaveTimer = null;

const homeView = document.getElementById('homeView');
const workspaceView = document.getElementById('workspaceView');
const projectGrid = document.getElementById('projectGrid');
const createProjectBtn = document.getElementById('createProjectBtn');
const backToHomeBtn = document.getElementById('backToHomeBtn');
const openAiSettingsBtn = document.getElementById('openAiSettingsBtn');

const projectModal = document.getElementById('projectModal');
const confirmCreateProjectBtn = document.getElementById('confirmCreateProjectBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const newProjectName = document.getElementById('newProjectName');

const aiSettingsModal = document.getElementById('aiSettingsModal');
const apiKeyInput = document.getElementById('apiKeyInput');
const aiPromptInput = document.getElementById('aiPromptInput');
const saveAiSettingsBtn = document.getElementById('saveAiSettingsBtn');
const cancelAiSettingsBtn = document.getElementById('cancelAiSettingsBtn');

const activeProjectTitle = document.getElementById('activeProjectTitle');
const chapterList = document.getElementById('chapterList');
const addChapterBtn = document.getElementById('addChapterBtn');
const editorContainer = document.getElementById('editorContainer');
const noChapterPlaceholder = document.getElementById('noChapterPlaceholder');

const tabEditor = document.getElementById('tabEditor');
const tabAudioHub = document.getElementById('tabAudioHub');
const editorSubView = document.getElementById('editorSubView');
const audioHubSubView = document.getElementById('audioHubSubView');
const audioVersionList = document.getElementById('audioVersionList');

const chapterNumberInput = document.getElementById('chapterNumberInput');
const chapterTitleInput = document.getElementById('chapterTitleInput');
const chapterVoiceSelect = document.getElementById('chapterVoiceSelect');
const englishContentInput = document.getElementById('englishContentInput');
const hinglishContentInput = document.getElementById('hinglishContentInput');
const generateEnglishAudioBtn = document.getElementById('generateEnglishAudioBtn');
const generateHinglishAudioBtn = document.getElementById('generateHinglishAudioBtn');
const translateBtn = document.getElementById('translateBtn');
const aiStatus = document.getElementById('aiStatus');
const ttsStatus = document.getElementById('ttsStatus');
const autoSaveIndicator = document.getElementById('autoSaveIndicator');

const globalPlayerBar = document.getElementById('globalPlayerBar');
const globalAudioPlayer = document.getElementById('globalAudioPlayer');
const playingChapterTitle = document.getElementById('playingChapterTitle');
const togglePlayerMinimizeBtn = document.getElementById('togglePlayerMinimizeBtn');
const skipBackwardBtn = document.getElementById('skipBackwardBtn');
const skipForwardBtn = document.getElementById('skipForwardBtn');
const playbackSpeedSelect = document.getElementById('playbackSpeedSelect');
const saveBookmarkBtn = document.getElementById('saveBookmarkBtn');
const bookmarkStatus = document.getElementById('bookmarkStatus');

async function init() {
  projects = await window.api.getProjects();
  settings = await window.api.getSettings();
  apiKeyInput.value = settings.apiKey || '';
  aiPromptInput.value = settings.prompt || '';
  renderProjectGrid();
  
  window.api.onTTSProgress(({ chapterId, versionType, status }) => {
    if (activeChapterId === chapterId) {
      ttsStatus.textContent = `[${versionType.toUpperCase()}] ${status}`;
    }
  });
}

function renderProjectGrid() {
  projectGrid.innerHTML = '';
  if (projects.length === 0) {
    projectGrid.innerHTML = '<p>No projects found. Create one to get started.</p>';
    return;
  }

  projects.forEach(project => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <div>
        <h3>${project.name}</h3>
        <small style="color:#aaa">${project.chapters ? project.chapters.length : 0} Chapters</small>
      </div>
      <div class="card-actions">
        <button class="btn primary open-btn">Open Workspace</button>
        <button class="btn danger delete-btn">Delete</button>
      </div>
    `;

    card.querySelector('.open-btn').addEventListener('click', () => openWorkspace(project.id));
    card.querySelector('.delete-btn').addEventListener('click', async () => {
      projects = await window.api.deleteProject(project.id);
      renderProjectGrid();
    });

    projectGrid.appendChild(card);
  });
}

function openWorkspace(projectId) {
  activeProjectId = projectId;
  const project = projects.find(p => p.id === projectId);
  activeProjectTitle.textContent = project.name;
  
  homeView.classList.remove('active');
  workspaceView.classList.add('active');
  
  renderChapterList();
  deselectChapter();
  switchTab('editor');
}

function renderChapterList() {
  const project = projects.find(p => p.id === activeProjectId);
  chapterList.innerHTML = '';
  
  if (!project.chapters || project.chapters.length === 0) {
    chapterList.innerHTML = '<li style="color:#777">No chapters yet</li>';
    return;
  }

  project.chapters.sort((a, b) => a.number - b.number).forEach(ch => {
    const li = document.createElement('li');
    if (ch.id === activeChapterId) li.classList.add('active');
    
    const count = ch.audioVersions ? ch.audioVersions.length : 0;
    li.innerHTML = `
      <span>Ch ${ch.number}: ${ch.title}</span>
      ${count > 0 ? `<span>🎵 (${count})</span>` : ''}
    `;

    li.addEventListener('click', () => loadChapterIntoEditor(ch.id));
    chapterList.appendChild(li);
  });
}

function loadChapterIntoEditor(chapterId) {
  activeChapterId = chapterId;
  const project = projects.find(p => p.id === activeProjectId);
  const chapter = project.chapters.find(c => c.id === chapterId);

  chapterNumberInput.value = chapter.number;
  chapterTitleInput.value = chapter.title;
  chapterVoiceSelect.value = chapter.voice || 'hi-IN-MadhurNeural';
  englishContentInput.value = chapter.englishContent || '';
  hinglishContentInput.value = chapter.hinglishContent || '';
  
  ttsStatus.textContent = '';
  aiStatus.textContent = 'Ready';
  editorContainer.classList.remove('hidden');
  noChapterPlaceholder.classList.add('hidden');
  renderChapterList();
  renderAudioHubVersions();
}

function deselectChapter() {
  activeChapterId = null;
  editorContainer.classList.add('hidden');
  noChapterPlaceholder.classList.remove('hidden');
}

function switchTab(tabName) {
  if (tabName === 'editor') {
    tabEditor.classList.add('active');
    tabAudioHub.classList.remove('active');
    editorSubView.classList.remove('hidden');
    audioHubSubView.classList.add('hidden');
  } else {
    tabAudioHub.classList.add('active');
    tabEditor.classList.remove('active');
    audioHubSubView.classList.remove('hidden');
    editorSubView.classList.add('hidden');
    renderAudioHubVersions();
  }
}

tabEditor.addEventListener('click', () => switchTab('editor'));
tabAudioHub.addEventListener('click', () => switchTab('hub'));

function renderAudioHubVersions() {
  if (!activeChapterId) return;
  const project = projects.find(p => p.id === activeProjectId);
  const chapter = project.chapters.find(c => c.id === activeChapterId);

  audioVersionList.innerHTML = '';
  const versions = chapter.audioVersions || [];

  if (versions.length === 0) {
    audioVersionList.innerHTML = '<p style="color:#888;">No audio versions generated yet. Generate audio from the Editor tab.</p>';
    return;
  }

  versions.forEach((ver, index) => {
    const card = document.createElement('div');
    card.className = 'audio-card';
    card.innerHTML = `
      <div class="audio-meta">
        <h4>[${ver.versionType.toUpperCase()}] Take #${index + 1} — Voice: ${ver.voice}</h4>
        <small>Created: ${new Date(ver.createdAt).toLocaleString()}</small>
      </div>
      <div class="audio-card-actions">
        <button class="btn primary play-version-btn">▶ Play</button>
        <button class="btn danger delete-version-btn">Delete</button>
      </div>
    `;

    card.querySelector('.play-version-btn').addEventListener('click', () => {
      globalPlayerBar.classList.remove('hidden');
      playingChapterTitle.textContent = `${project.name} - Ch ${chapter.number} [${ver.versionType.toUpperCase()}]`;
      globalAudioPlayer.src = `file://${ver.path}?t=${Date.now()}`;
      globalAudioPlayer.play();
      if (chapter.bookmarkTime) globalAudioPlayer.currentTime = chapter.bookmarkTime;
    });

    card.querySelector('.delete-version-btn').addEventListener('click', async () => {
      projects = await window.api.deleteAudioVersion({
        projectId: activeProjectId,
        chapterId: activeChapterId,
        audioId: ver.id
      });
      renderAudioHubVersions();
      renderChapterList();
    });

    audioVersionList.appendChild(card);
  });
}

// Auto-Save Trigger
function triggerAutoSave() {
  if (!activeChapterId) return;
  autoSaveIndicator.textContent = 'Saving changes...';

  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    const project = projects.find(p => p.id === activeProjectId);
    const chapter = project.chapters.find(c => c.id === activeChapterId);

    chapter.number = parseInt(chapterNumberInput.value, 10) || 1;
    chapter.title = chapterTitleInput.value.trim() || 'Untitled';
    chapter.voice = chapterVoiceSelect.value;
    chapter.englishContent = englishContentInput.value;
    chapter.hinglishContent = hinglishContentInput.value;

    projects = await window.api.saveProject(project);
    renderChapterList();
    autoSaveIndicator.textContent = 'All changes saved automatically';
  }, 600);
}

chapterNumberInput.addEventListener('input', triggerAutoSave);
chapterTitleInput.addEventListener('input', triggerAutoSave);
chapterVoiceSelect.addEventListener('change', triggerAutoSave);
englishContentInput.addEventListener('input', triggerAutoSave);
hinglishContentInput.addEventListener('input', triggerAutoSave);

// Gemini AI Translation Integration
// Gemini AI Translation Integration
// Gemini AI Translation Integration
translateBtn.addEventListener('click', async () => {
  const englishText = englishContentInput.value.trim();
  if (!englishText) {
    aiStatus.textContent = 'Enter English text first!';
    return;
  }
  if (!settings.apiKey) {
    aiStatus.textContent = 'API Key missing! Set it in AI Editor Settings.';
    aiSettingsModal.classList.remove('hidden');
    return;
  }

  aiStatus.textContent = 'Translating via Gemini...';
  try {
    // UPDATED MODEL ENDPOINT HERE:
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${settings.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `${settings.prompt}\n\n${englishText}` }]
        }]
      })
    });
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Gemini API Error');
    }
    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
      throw new Error('No response generated. Content might have been blocked.');
    }

    const translatedText = data.candidates[0].content.parts[0].text;
    hinglishContentInput.value = translatedText;
    aiStatus.textContent = 'Translation complete!';
    triggerAutoSave();
  } catch (err) {
    aiStatus.textContent = `Error: ${err.message}`;
  }
});

// Generate Separate Audio for English or Hinglish version
async function handleGenerateAudio(versionType) {
  if (!activeChapterId) return;
  const text = versionType === 'english' ? englishContentInput.value.trim() : hinglishContentInput.value.trim();
  if (!text) {
    ttsStatus.textContent = `No text found in ${versionType} version!`;
    return;
  }

  ttsStatus.textContent = `Generating ${versionType} audio in background...`;
  try {
    await window.api.generateChapterAudio({
      projectId: activeProjectId,
      chapterId: activeChapterId,
      text,
      voice: chapterVoiceSelect.value,
      versionType
    });
    ttsStatus.textContent = `${versionType.toUpperCase()} audio ready!`;
    projects = await window.api.getProjects();
    renderChapterList();
  } catch (err) {
    ttsStatus.textContent = `Failed: ${err.message}`;
  }
}

generateEnglishAudioBtn.addEventListener('click', () => handleGenerateAudio('english'));
generateHinglishAudioBtn.addEventListener('click', () => handleGenerateAudio('hinglish'));

// Music Player Skip Controls & Minimize Toggle
skipBackwardBtn.addEventListener('click', () => { globalAudioPlayer.currentTime = Math.max(0, globalAudioPlayer.currentTime - 10); });
skipForwardBtn.addEventListener('click', () => { globalAudioPlayer.currentTime = Math.min(globalAudioPlayer.duration || 0, globalAudioPlayer.currentTime + 10); });

togglePlayerMinimizeBtn.addEventListener('click', () => {
  globalPlayerBar.classList.toggle('minimized');
  togglePlayerMinimizeBtn.textContent = globalPlayerBar.classList.contains('minimized') ? '▲ Expand' : '▼ Minimize';
});

playbackSpeedSelect.addEventListener('change', (e) => { globalAudioPlayer.playbackRate = parseFloat(e.target.value); });

saveBookmarkBtn.addEventListener('click', async () => {
  if (!activeChapterId) return;
  const project = projects.find(p => p.id === activeProjectId);
  const chapter = project.chapters.find(c => c.id === activeChapterId);
  chapter.bookmarkTime = globalAudioPlayer.currentTime;
  projects = await window.api.saveProject(project);
  bookmarkStatus.textContent = `Saved at ${Math.floor(chapter.bookmarkTime)}s!`;
  setTimeout(() => { bookmarkStatus.textContent = ''; }, 3000);
});

// AI Settings Modal Controls
openAiSettingsBtn.addEventListener('click', () => aiSettingsModal.classList.remove('hidden'));
cancelAiSettingsBtn.addEventListener('click', () => aiSettingsModal.classList.add('hidden'));
saveAiSettingsBtn.addEventListener('click', async () => {
  settings.apiKey = apiKeyInput.value.trim();
  settings.prompt = aiPromptInput.value.trim();
  await window.api.saveSettings(settings);
  aiSettingsModal.classList.add('hidden');
});

createProjectBtn.addEventListener('click', () => projectModal.classList.remove('hidden'));
cancelModalBtn.addEventListener('click', () => projectModal.classList.add('hidden'));
confirmCreateProjectBtn.addEventListener('click', async () => {
  const name = newProjectName.value.trim();
  if (!name) return;
  const newProject = { id: `proj_${Date.now()}`, name, chapters: [] };
  projects = await window.api.saveProject(newProject);
  newProjectName.value = '';
  projectModal.classList.add('hidden');
  renderProjectGrid();
});

backToHomeBtn.addEventListener('click', () => {
  workspaceView.classList.remove('active');
  homeView.classList.add('active');
  activeProjectId = null;
});

addChapterBtn.addEventListener('click', async () => {
  const project = projects.find(p => p.id === activeProjectId);
  if (!project.chapters) project.chapters = [];
  const newChapter = {
    id: `chap_${Date.now()}`,
    number: project.chapters.length + 1,
    title: `Untitled Chapter`,
    englishContent: '',
    hinglishContent: '',
    voice: 'hi-IN-MadhurNeural',
    audioVersions: [],
    bookmarkTime: 0
  };
  project.chapters.push(newChapter);
  projects = await window.api.saveProject(project);
  renderChapterList();
  loadChapterIntoEditor(newChapter.id);
});

init();