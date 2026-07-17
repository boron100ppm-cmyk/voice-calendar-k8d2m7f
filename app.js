// ==========================================================================
// App Configuration
// ==========================================================================

const AUTH_PASSWORD = 'ryo1234'; // 簡易認証パスワード

const STATE_KEYS = {
  API_KEY: 'voicecal_api_key',
  DICTIONARY: 'voicecal_dictionary_v2', // バージョン2に変更して構造化データに対応
  PREFERRED_MODEL: 'voicecal_preferred_model',
  FAMILY_NAMES: 'voicecal_family_names',
  AUTHENTICATED: 'voicecal_authenticated',
  CALENDAR_HISTORY: 'voicecal_calendar_history'
};

let appState = {
  apiKey: '',
  dictionary: [], // 構造: { word: string, reading: string, aliases: string }
  model: 'gemini-3.1-flash-lite', // デフォルトモデルを高速な 3.1-flash-lite に
  familyNames: ['パパ', 'ママ', 'りく', 'とおり'],
  calendarHistory: [], // カレンダー履歴（別ファイルからインポート可能）
  authenticated: false,
  isRecording: false,
  mediaRecorder: null,
  audioChunks: [],
  parsedEvents: []
};

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  try {
    loadState();
    initDOM();
    checkAuth();
    initSpeechRecognition();
    renderDictionaryTags();
  } catch (error) {
    console.error('Initialization failed:', error);
    alert('アプリの起動中にエラーが発生しました:\n' + error.message + '\n' + error.stack);
  }
});

function checkAuth() {
  if (appState.authenticated) {
    elPasswordOverlay.classList.add('hidden');
  } else {
    elPasswordOverlay.classList.remove('hidden');
    elInputAuthPassword.focus();
  }
}

function handleAuthSubmit() {
  const pwd = elInputAuthPassword.value.trim();
  if (pwd === AUTH_PASSWORD) {
    appState.authenticated = true;
    localStorage.setItem(STATE_KEYS.AUTHENTICATED, 'true');
    elPasswordOverlay.classList.add('hidden');
    console.log('Authentication passed.');
  } else {
    alert('パスワードが正しくありません。');
    elInputAuthPassword.value = '';
    elInputAuthPassword.focus();
  }
}

// Load state from localStorage & migration support
function loadState() {
  appState.apiKey = localStorage.getItem(STATE_KEYS.API_KEY) || '';
  appState.model = localStorage.getItem(STATE_KEYS.PREFERRED_MODEL) || 'gemini-3.1-flash-lite';
  appState.authenticated = localStorage.getItem(STATE_KEYS.AUTHENTICATED) === 'true';
  
  const savedFamilyNames = localStorage.getItem(STATE_KEYS.FAMILY_NAMES);
  if (savedFamilyNames) {
    try {
      appState.familyNames = JSON.parse(savedFamilyNames);
    } catch (e) {
      appState.familyNames = ['パパ', 'ママ', 'りく', 'とおり'];
    }
  } else {
    appState.familyNames = ['パパ', 'ママ', 'りく', 'とおり'];
  }

  // v1 (文字列配列) から v2 (オブジェクト配列) への移行サポート
  const legacyDictJson = localStorage.getItem('voicecal_dictionary');
  const v2DictJson = localStorage.getItem(STATE_KEYS.DICTIONARY);

  if (v2DictJson) {
    try {
      appState.dictionary = JSON.parse(v2DictJson) || [];
    } catch (e) {
      appState.dictionary = [];
    }
  } else if (legacyDictJson) {
    // 古いデータがある場合はマイグレーションを実行
    try {
      const oldList = JSON.parse(legacyDictJson) || [];
      appState.dictionary = oldList.map(word => ({
        word: word,
        reading: '',
        aliases: ''
      }));
      // 新しいストレージに保存し、古いものはそのままにする（安全のため）
      localStorage.setItem(STATE_KEYS.DICTIONARY, JSON.stringify(appState.dictionary));
    } catch (e) {
      appState.dictionary = [];
    }
  } else {
    appState.dictionary = [];
  }

  const savedHistory = localStorage.getItem(STATE_KEYS.CALENDAR_HISTORY);
  if (savedHistory) {
    try {
      appState.calendarHistory = JSON.parse(savedHistory) || [];
    } catch (e) {
      appState.calendarHistory = [];
    }
  } else {
    appState.calendarHistory = [];
  }
}

// Save state to localStorage
function saveState() {
  localStorage.setItem(STATE_KEYS.API_KEY, appState.apiKey);
  localStorage.setItem(STATE_KEYS.DICTIONARY, JSON.stringify(appState.dictionary));
  localStorage.setItem(STATE_KEYS.PREFERRED_MODEL, appState.model);
  localStorage.setItem(STATE_KEYS.FAMILY_NAMES, JSON.stringify(appState.familyNames));
  localStorage.setItem(STATE_KEYS.CALENDAR_HISTORY, JSON.stringify(appState.calendarHistory));
}

// DOM Elements & Event Listeners
let elMicBtn, elSpeechStatus, elTextInput, elBtnClearText, elBtnAnalyze;
let elResultsSection, elEventCount, elEventsList, elBulkActions;
let elLoadingOverlay, elLoadingMessage;
let elSettingsModal, elBtnSettings, elBtnCloseSettings, elInputApiKey, elSelectModel, elInputFamilyNames;
let elBtnToggleApiKey, elInputDictWord, elInputDictReading, elInputDictAliases, elBtnAddWord, elDictionaryTags, elBtnSaveSettings;
let elBtnExportSettings, elBtnImportSettings, elInputImportFile;
let elPasswordOverlay, elInputAuthPassword, elBtnSubmitAuth;

function initDOM() {
  elMicBtn = document.getElementById('btn-mic');
  elSpeechStatus = document.getElementById('speech-status');
  elTextInput = document.getElementById('text-input');
  elBtnClearText = document.getElementById('btn-clear-text');
  elBtnAnalyze = document.getElementById('btn-analyze');

  elResultsSection = document.getElementById('results-section');
  elEventCount = document.getElementById('event-count');
  elEventsList = document.getElementById('events-list');
  elBulkActions = document.getElementById('bulk-actions');

  elLoadingOverlay = document.getElementById('loading-overlay');
  elLoadingMessage = document.getElementById('loading-message');

  elSettingsModal = document.getElementById('settings-modal');
  elBtnSettings = document.getElementById('btn-settings');
  elBtnCloseSettings = document.getElementById('btn-close-settings');
  elInputApiKey = document.getElementById('input-api-key');
  elSelectModel = document.getElementById('select-model');
  elInputFamilyNames = document.getElementById('input-family-names');
  elBtnToggleApiKey = document.getElementById('btn-toggle-api-key');

  // 辞書フォーム項目
  elInputDictWord = document.getElementById('input-dict-word');
  elInputDictReading = document.getElementById('input-dict-reading');
  elInputDictAliases = document.getElementById('input-dict-aliases');
  elBtnAddWord = document.getElementById('btn-add-word');
  elDictionaryTags = document.getElementById('dictionary-tags');

  elBtnSaveSettings = document.getElementById('btn-save-settings');
  
  // 設定インポート・エクスポート
  elBtnExportSettings = document.getElementById('btn-export-settings');
  elBtnImportSettings = document.getElementById('btn-import-settings');
  elInputImportFile = document.getElementById('input-import-file');

  // パスワード認証要素
  elPasswordOverlay = document.getElementById('password-overlay');
  elInputAuthPassword = document.getElementById('input-auth-password');
  elBtnSubmitAuth = document.getElementById('btn-submit-auth');

  // Input events
  elBtnClearText.addEventListener('click', () => {
    elTextInput.value = '';
  });

  elBtnAnalyze.addEventListener('click', analyzeText);

  // Settings Modal events
  elBtnSettings.addEventListener('click', openSettings);
  elBtnCloseSettings.addEventListener('click', closeSettings);
  elBtnToggleApiKey.addEventListener('click', toggleApiKeyVisibility);
  elBtnExportSettings.addEventListener('click', exportSettings);
  elBtnImportSettings.addEventListener('click', () => elInputImportFile.click());
  elInputImportFile.addEventListener('change', handleImportFile);
  elBtnAddWord.addEventListener('click', handleAddWord);
  elBtnSaveSettings.addEventListener('click', handleSaveSettings);
  elBtnSubmitAuth.addEventListener('click', handleAuthSubmit);
  elInputAuthPassword.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAuthSubmit();
  });

  // Key press events in settings form
  const handleKeypress = (e) => {
    if (e.key === 'Enter') handleAddWord();
  };
  elInputDictWord.addEventListener('keypress', handleKeypress);
  elInputDictReading.addEventListener('keypress', handleKeypress);
  elInputDictAliases.addEventListener('keypress', handleKeypress);

  // API Key empty notice
  if (!appState.apiKey) {
    setTimeout(openSettings, 500);
  }
}

// ==========================================================================
// Speech Recognition Service (Google Cloud Speech-to-Text via MediaRecorder)
// ==========================================================================
function initSpeechRecognition() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    elSpeechStatus.textContent = 'マイク未対応ブラウザ';
    elMicBtn.disabled = true;
    elMicBtn.style.opacity = '0.5';
    return;
  }

  elMicBtn.addEventListener('click', () => {
    if (appState.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });
}

async function startRecording() {
  if (appState.isRecording) return;
  appState.audioChunks = [];

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // ブラウザがサポートするMIMEタイプを判別
    let options = {};
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      options = { mimeType: 'audio/webm;codecs=opus' };
    } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
      options = { mimeType: 'audio/ogg;codecs=opus' };
    }

    const mediaRecorder = new MediaRecorder(stream, options);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        appState.audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      // マイクのストリームトラックを完全に停止してインジケータを消す
      stream.getTracks().forEach(track => track.stop());

      const mimeType = mediaRecorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(appState.audioChunks, { type: mimeType });

      // BlobをBase64に変換
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = () => {
        const base64Audio = reader.result.split(',')[1];
        requestGeminiASR(base64Audio, mimeType);
      };
    };

    appState.mediaRecorder = mediaRecorder;
    mediaRecorder.start();

    appState.isRecording = true;
    elMicBtn.classList.add('recording');
    elSpeechStatus.textContent = '録音中...';
    elSpeechStatus.classList.add('recording');
  } catch (err) {
    console.error('Error accessing microphone:', err);
    alert('マイクへのアクセスに失敗しました。パーミッションを確認してください。');
    stopRecording();
  }
}

function stopRecording() {
  if (appState.mediaRecorder && appState.isRecording) {
    appState.mediaRecorder.stop();
    appState.isRecording = false;
    elMicBtn.classList.remove('recording');
    elSpeechStatus.textContent = '待機中';
    elSpeechStatus.classList.remove('recording');
  }
}

// Geminiマルチモーダル音声認識 (Audio to Text)
async function requestGeminiASR(base64Audio, mimeType) {
  if (!appState.apiKey) {
    alert('Gemini API キーを設定してください。設定画面から登録できます。');
    openSettings();
    return;
  }

  showLoading('音声を文字に変換中...');

  // 1. ユーザー登録辞書データコンテキスト
  let dictContext = '';
  if (appState.dictionary.length > 0) {
    dictContext = `【補正用固有名詞辞書リスト】:
${appState.dictionary.map(item => {
      let line = `* 登録単語: "${item.word}"`;
      if (item.reading) line += `（よみがな: "${item.reading}"）`;
      if (item.aliases) line += `、誤認識例・類音語: [${item.aliases}]`;
      return line;
    }).join('\n')}`;
  } else {
    dictContext = '【補正用固有名詞辞書リスト】: なし';
  }

  // 2. 過去のカレンダー履歴コンテキスト
  const historyContext = `【過去の予定履歴リスト】:
${appState.calendarHistory.map(item => `  - "${item}"`).join('\n')}`;

  // 家族名ルールの動的生成
  const familyNamesListStr = appState.familyNames.map(name => `   - "${name}"`).join('\n');
  const familyNamesCsvStr = appState.familyNames.join('」「');
  const sampleName = appState.familyNames[0] || 'パパ';

  const asrInstruction = `
あなたは高精度な音声認識・書き起こしアシスタントです。
ユーザーの音声を聴いて、正確な日本語のテキスト（書き起こし結果）のみを出力してください。挨拶や説明などは一切不要です。

## 固有名詞・発音ベースの補正ルール:
1. 提供された「補正用固有名詞辞書リスト」および「過去の予定履歴リスト」を強く参考にし、録音された音声の言葉や発音が、これらのリストの単語に似ている場合は、優先的に正しい名称に補正してテキスト化してください。
   例：「タピックス」「ハニックス」と聞こえたら「サピックス」に変換。
   例：「過労等リング」と聞こえたら「カローラツーリング」に変換。

## 家族の名前に関するルール:
1. 予定のタイトルの前後に、家族の名前がつくことがよくあります（例: 「${sampleName} 歯医者」や「歯医者 ${sampleName}」など）。
2. 主な家族の名前の候補は以下の通りです：
${familyNamesListStr}
3. 音声でこれらの名前が呼ばれている場合、勝手に漢字や他の同音異義語に変換せず、必ずリストに指定された表記（「${familyNamesCsvStr}」）に補正して書き起こしてください。
4. 名前と予定内容の間に半角スペースを空けて書き起こしてください。

${dictContext}
${historyContext}
`;

  // リクエストパラメータの構築
  const requestBody = {
    contents: [{
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Audio
          }
        },
        {
          text: "上記の音声を聴いて、正確な日本語で書き起こしてください。"
        }
      ]
    }],
    systemInstruction: {
      parts: [{
        text: asrInstruction
      }]
    }
  };

  // タイムアウト付きフェッチヘルパー
  const fetchWithTimeout = async (url, options, timeoutMs = 10000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  };

  try {
    let modelName = appState.model; // 優先モデルを使用
    const fallbackModel = modelName === 'gemini-3.1-flash-lite' ? 'gemini-3.5-flash' : 'gemini-3.1-flash-lite';
    let response;
    let useFallback = false;

    try {
      console.log(`Sending ASR request to ${modelName} with 20s timeout...`);
      response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${appState.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        },
        20000 // 20秒タイムアウト
      );

      if (response.status === 503) {
        console.warn(`${modelName} returned 503. Switching to fallback.`);
        useFallback = true;
      }
    } catch (e) {
      const isAbort = e.name === 'AbortError' || 
                      (e.message && (e.message.includes('aborted') || e.message.includes('abort')));
      if (isAbort) {
        console.warn(`${modelName} request timed out after 20s. Switching to fallback.`);
      } else {
        console.warn(`${modelName} request failed:`, e);
      }
      useFallback = true;
    }

    // フォールバックが必要な場合はもう一方のモデルを使用
    if (useFallback) {
      console.log(`Retrying ASR with fallback model: ${fallbackModel}...`);
      elLoadingMessage.textContent = '一時的に別モデルで音声認識中...';
      
      response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${appState.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        },
        25000 // 25秒タイムアウト
      );
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Gemini APIリクエストに失敗しました（ステータス: ${response.status}）`);
    }

    const data = await response.json();
    const transcript = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!transcript || !transcript.trim()) {
      alert('音声を認識できませんでした。もう少しはっきりと話してみてください。');
      hideLoading();
      return;
    }

    // テキストエリアに書き起こしテキストを反映
    elTextInput.value = transcript.trim();

    hideLoading();
  } catch (error) {
    console.error('Gemini ASR failed:', error);
    alert('音声認識処理中にエラーが発生しました:\n' + error.message);
    hideLoading();
  }
}

// ==========================================================================
// Settings & Dictionary Logic (Enhanced v2)
// ==========================================================================
function openSettings() {
  elInputApiKey.value = appState.apiKey;
  elSelectModel.value = appState.model;
  elInputFamilyNames.value = appState.familyNames.join(', ');
  renderDictionaryTags();
  elSettingsModal.classList.remove('hidden');
}

function closeSettings() {
  elSettingsModal.classList.add('hidden');
}

function toggleApiKeyVisibility() {
  const icon = elBtnToggleApiKey.querySelector('i');
  if (elInputApiKey.type === 'password') {
    elInputApiKey.type = 'text';
    icon.setAttribute('data-lucide', 'eye-off');
  } else {
    elInputApiKey.type = 'password';
    icon.setAttribute('data-lucide', 'eye');
  }
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function handleAddWord() {
  const word = elInputDictWord.value.trim();
  const reading = elInputDictReading.value.trim();
  const aliases = elInputDictAliases.value.trim();

  if (!word) {
    alert('登録する単語を入力してください。');
    return;
  }

  // 重複チェック
  const exists = appState.dictionary.some(item => item.word.toLowerCase() === word.toLowerCase());
  if (exists) {
    alert('この単語は既に登録されています。');
    return;
  }

  appState.dictionary.push({
    word: word,
    reading: reading,
    aliases: aliases
  });

  saveState();
  renderDictionaryTags();

  // フォームクリア
  elInputDictWord.value = '';
  elInputDictReading.value = '';
  elInputDictAliases.value = '';
  elInputDictWord.focus();
}

function removeWord(wordToRemove) {
  appState.dictionary = appState.dictionary.filter(item => item.word !== wordToRemove);
  saveState();
  renderDictionaryTags();
}

function renderDictionaryTags() {
  elDictionaryTags.innerHTML = '';
  if (appState.dictionary.length === 0) {
    elDictionaryTags.innerHTML = '<span class="help-text">登録された固有名詞はありません。</span>';
    return;
  }

  appState.dictionary.forEach(item => {
    const tag = document.createElement('div');
    tag.className = 'dict-tag';

    // 詳細情報テキストの構築
    let detailsText = '';
    if (item.reading) {
      detailsText += `<span class="dict-tag-reading">よみがな: ${escapeHtml(item.reading)}</span>`;
    }
    if (item.aliases) {
      if (detailsText) detailsText += ' / ';
      detailsText += `<span class="dict-tag-aliases">誤認識例: ${escapeHtml(item.aliases)}</span>`;
    }
    if (!detailsText) {
      detailsText = '<span class="dict-tag-aliases">追記情報なし</span>';
    }

    tag.innerHTML = `
      <div class="dict-tag-info">
        <span class="dict-tag-word">${escapeHtml(item.word)}</span>
        <span class="dict-tag-details">${detailsText}</span>
      </div>
      <div class="dict-tag-actions">
        <button type="button" title="削除">
          <i data-lucide="x" style="width:14px;height:14px;"></i>
        </button>
      </div>
    `;

    tag.querySelector('button').addEventListener('click', () => removeWord(item.word));
    elDictionaryTags.appendChild(tag);
  });

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function handleSaveSettings() {
  appState.apiKey = elInputApiKey.value.trim();
  appState.model = elSelectModel.value;
  
  // カンマ（全角半角両方）で区切って配列化
  appState.familyNames = elInputFamilyNames.value
    .split(/[,，]/)
    .map(name => name.trim())
    .filter(name => name.length > 0);
    
  saveState();
  closeSettings();
}

function exportSettings() {
  const exportData = {
    version: '2.0',
    apiKey: appState.apiKey,
    model: appState.model,
    familyNames: appState.familyNames,
    dictionary: appState.dictionary,
    calendarHistory: appState.calendarHistory // カレンダー履歴を追加
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `voice-calendar-settings_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log('Settings exported successfully.');
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      
      // パターン1: 配列形式（カレンダー履歴単体のインポート）
      if (Array.isArray(importedData)) {
        if (!confirm(`カレンダー履歴データをインポートします（件数: ${importedData.length}件）。よろしいですか？`)) {
          elInputImportFile.value = '';
          return;
        }
        appState.calendarHistory = importedData;
        saveState();
        alert('カレンダー履歴を読み込みました！');
        console.log('Calendar history imported successfully.');
        return;
      }
      
      // パターン2: オブジェクト形式（設定バックアップ）
      if (importedData.apiKey === undefined || !Array.isArray(importedData.dictionary)) {
        throw new Error('設定ファイルのフォーマットが不正です。');
      }
      
      if (!confirm('現在の設定（APIキー、モデル、家族名、辞書、履歴）が上書きされます。よろしいですか？')) {
        elInputImportFile.value = ''; // クリア
        return;
      }
      
      // 状態への適用
      appState.apiKey = importedData.apiKey || '';
      appState.model = importedData.model || 'gemini-3.1-flash-lite';
      appState.familyNames = Array.isArray(importedData.familyNames) ? importedData.familyNames : ['パパ', 'ママ', 'りく', 'とおり'];
      appState.dictionary = importedData.dictionary;
      appState.calendarHistory = Array.isArray(importedData.calendarHistory) ? importedData.calendarHistory : [];
      
      saveState();
      
      // UIの更新
      elInputApiKey.value = appState.apiKey;
      elSelectModel.value = appState.model;
      elInputFamilyNames.value = appState.familyNames.join(', ');
      renderDictionaryTags();
      
      alert('設定をインポートしました！');
      console.log('Settings imported successfully.');
    } catch (err) {
      alert('インポートに失敗しました:\n' + err.message);
    } finally {
      elInputImportFile.value = ''; // ファイルインプットをリセットして再インポート可能にする
    }
  };
  reader.readAsText(file);
}

// ==========================================================================
// Gemini API Integration (Event Parsing & Reading-based Correction)
// ==========================================================================
async function analyzeText() {
  const text = elTextInput.value.trim();
  if (!text) {
    alert('音声入力するか、テキストを入力してください。');
    return;
  }

  showLoading('AIが予定を解析・補正中...');
  await analyzeTextInternal(text);
}

// Gemini 3.5 Flash を用いた予定の解析・補正のコア処理
async function analyzeTextInternal(text) {
  if (!appState.apiKey) {
    alert('Gemini API キーを設定してください。');
    openSettings();
    hideLoading();
    return;
  }

  // 現在の日時情報を取得
  const now = new Date();
  const currentDateTimeStr = now.toLocaleString('ja-JP', { timeZoneName: 'short' });

  // 音素補正用辞書コンテキストの組み立て
  let dictContext = '';
  if (appState.dictionary.length > 0) {
    dictContext = `【補正用固有名詞辞書リスト】:
以下のリストに定義された「よみがな」や「誤認識例」に近い発音のテキストが音声入力に含まれる場合、強制的に正しい「登録単語」に置換・補正して予定を抽出してください。
${appState.dictionary.map(item => {
      let line = `* 登録単語: "${item.word}"`;
      if (item.reading) line += `（よみがな: "${item.reading}"）`;
      if (item.aliases) line += `、誤認識例・類音語: [${item.aliases}]`;
      return line;
    }).join('\n')}`;
  } else {
    dictContext = '【補正用固有名詞辞書リスト】: なし';
  }

  // 過去の予定履歴コンテキストの組み立て（表記揺れ統一用、入力テキストに関連するものに事前フィルタリングして軽量化）
  const cleanTokens = text.split(/[\s　、。にでとをが行くの]/).filter(t => t.length >= 2);
  const filteredHistory = appState.calendarHistory.filter(item => {
    return cleanTokens.some(token => item.includes(token) || token.includes(item));
  });
  // 関連するものがない場合は、デフォルトで最初の15件をフォールバックとして渡す
  const displayHistory = filteredHistory.length > 0 ? filteredHistory : appState.calendarHistory.slice(0, 15);

  const historyContext = `【過去の予定履歴リスト】:
以下のリストはユーザーが過去1年間に登録した正確な予定タイトル（カレンダー履歴）の一部です。
音声認識されたテキストに曖昧な箇所、誤字脱字、表記のブレ（例: 「A社定例ミーティング」や「A社ミーティング」など）がある場合、過去履歴にある正確な名称（例: 「A社定例MTG」）に自動的にマッチング・統一して予定タイトル（title）を作成してください。
* 過去の履歴一覧:
${displayHistory.map(item => `  - "${item}"`).join('\n')}`;

  // 家族名ルールの動的生成
  const familyNamesListStr = appState.familyNames.map(name => `   - "${name}"`).join('\n');
  const familyNamesCsvStr = appState.familyNames.join('」「');
  const sampleName = appState.familyNames[0] || 'パパ';

  const systemInstruction = `
あなたは優秀なスケジュール管理アシスタントです。ユーザーの音声入力テキストをパースし、複数の予定を構造化したJSONに分解・整理してください。

## 音素・発音ベースの補正 ＆ 履歴マッチングルール (Chain of Thought):
必ず JSON の \`thought_process\` フィールドにて、以下の推論プロセスを文章で言語化してから \`events\` を出力してください。
1. 入力テキスト内に不自然な単語や文脈に合わない単語（音声認識の誤変換）がないか分析する。
2. もしあれば、「補正用固有名詞辞書リスト」や「過去の予定履歴リスト」の中から、発音（母音の並びなど）が最も近い単語を探し出す。
   ※ 音声認識の誤変換パターンの例：
     - 子音の間違い: 「タピックス」「ハニックス」→「サピックス」
     - 当て字・同音異義: 「過労等リング」→「カローラツーリング」
     - 一部欠落: 「にっさんおーだ」→「日産オーラ」
3. 最も適切な固有名詞や予定タイトルに強制置換する理由を説明する。

## 家族の名前に関するルール:
1. 予定のタイトルの前後に、家族の名前がつくことがよくあります（例: 「${sampleName} 歯医者」や「歯医者 ${sampleName}」など）。
2. 主な家族の名前の候補は以下の通りです：
${familyNamesListStr}
3. 音声入力テキストから予定タイトルを抽出・補正する際、これらの名前と予定の組み合わせを認識し、適切に「[家族の名前] [予定タイトル]」（スペース区切り）として 'title' を抽出してください。
4. 音声認識エラーで名前自体が誤変換されている場合（例: 家族の名前が他の漢字等に誤変換されている場合）は、必ずリストに指定された表記（「${familyNamesCsvStr}」）に補正してください。

## データ構築ルール
1. 上記の推論および家族名ルールに基づき、本来の固有名詞や予定タイトルへ補正した上で予定を抽出してください。
2. 時間表現（「明日」「今日の15時」「来週月曜」など）は、基準日時から具体的な日付を計算してISO 8601形式（YYYY-MM-DDTHH:mm:ss）に変換してください。
3. 終了時間が明示されていない場合は、開始時間の1時間後をデフォルトに設定してください。

基準日時: ${currentDateTimeStr}
${dictContext}
${historyContext}
`;

  // リクエストパラメータの構築
  const requestBody = {
    contents: [{
      parts: [{
        text: `以下の音声入力から予定を抽出・補正してください:\n\n${text}`
      }]
    }],
    systemInstruction: {
      parts: [{
        text: systemInstruction
      }]
    },
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          thought_process: { type: 'STRING', description: '予定抽出を行う前に、テキスト内の不自然な単語や音声認識の誤変換の分析・補正プロセスを1行（50文字以内）で簡潔に記述してください。' },
          events: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING', description: '予定の件名。音声認識エラーや表記揺れが補正された後の文字列。過去履歴の名称と一致または類似する場合はその名称を使用。' },
                start: { type: 'STRING', description: '予定の開始日時。ISO 8601形式 (YYYY-MM-DDTHH:mm:ss)' },
                end: { type: 'STRING', description: '予定の終了日時. ISO 8601形式 (YYYY-MM-DDTHH:mm:ss)' },
                details: { type: 'STRING', description: '場所、メモ、オンラインミーティングURLなど。なければ空文字。' },
                keywords: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      word: { type: 'STRING', description: 'この予定の件名や詳細に含まれる、固有名詞や重要単語（例: アプロ塾、加藤さん、Bクリニック）' },
                      reading: { type: 'STRING', description: 'その固有名詞・単語のひらがなでのよみがな（例: あぷろじゅく、かとうさん、びーくりにっく）' }
                    },
                    required: ['word', 'reading']
                  },
                  description: 'この予定のタイトルや場所、相手から抽出した、今後も頻出する可能性の高い固有名詞とよみがなのペア。'
                }
              },
              required: ['title', 'start', 'end']
            }
          }
        }
      }
    }
  };

  // タイムアウト付きフェッチヘルパー
  const fetchWithTimeout = async (url, options, timeoutMs = 10000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  };

  try {
    let modelName = appState.model; // 優先モデルを使用
    const fallbackModel = modelName === 'gemini-3.1-flash-lite' ? 'gemini-3.5-flash' : 'gemini-3.1-flash-lite';
    let response;
    let useFallback = false;

    try {
      console.log(`Sending request to ${modelName} with 20s timeout...`);
      response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${appState.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        },
        20000 // 20秒タイムアウト
      );

      if (response.status === 503) {
        console.warn(`${modelName} returned 503. Switching to fallback.`);
        useFallback = true;
      }
    } catch (e) {
      // タイムアウト（AbortError）またはその他のエラー
      const isAbort = e.name === 'AbortError' || 
                      (e.message && (e.message.includes('aborted') || e.message.includes('abort')));
      if (isAbort) {
        console.warn(`${modelName} request timed out after 20s. Switching to fallback.`);
      } else {
        console.warn(`${modelName} request failed:`, e);
      }
      useFallback = true;
    }

    // フォールバックが必要な場合はもう一方のモデルを使用
    if (useFallback) {
      console.log(`Retrying with fallback model: ${fallbackModel}...`);
      elLoadingMessage.textContent = '一時的に別モデルで再解析中...';
      
      response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${appState.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        },
        25000 // 25秒タイムアウト
      );
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Gemini APIリクエストに失敗しました（ステータス: ${response.status}）`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error('解析結果が取得できませんでした。');
    }

    const result = JSON.parse(responseText);
    appState.parsedEvents = result.events || [];

    renderEvents();
  } catch (error) {
    console.error('Analysis failed:', error);
    alert('予定の解析中にエラーが発生しました:\n' + error.message);
  } finally {
    hideLoading();
  }
}

// ==========================================================================
// Event Rendering & Handling
// ==========================================================================
function renderEvents() {
  elEventsList.innerHTML = '';
  elResultsSection.classList.remove('hidden');

  if (appState.parsedEvents.length === 0) {
    elEventCount.textContent = '0 件';
    elEventsList.innerHTML = '<p class="instruction">予定を検出できませんでした。別の言い方で話してみてください。</p>';
    elBulkActions.classList.add('hidden');
    return;
  }

  elEventCount.textContent = `${appState.parsedEvents.length} 件`;

  appState.parsedEvents.forEach((event, index) => {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.dataset.index = index;

    const formatInputDateTime = (isoStr) => {
      if (!isoStr) return '';
      return isoStr.substring(0, 16);
    };

    // 提案キーワードセクションの構築
    let suggestKeywordsHtml = '';
    const unregs = (event.keywords || []).filter(kw => {
      if (!kw.word || !kw.word.trim()) return false;
      return !appState.dictionary.some(d => d.word.toLowerCase() === kw.word.trim().toLowerCase());
    });

    if (unregs.length > 0) {
      const suggestListHtml = unregs.map((kw, kwIdx) => {
        return `
          <button class="keyword-suggest-btn" 
                  onclick="addSuggestedKeyword(${index}, ${kwIdx}, this)">
            <i data-lucide="plus" style="width:12px;height:12px;"></i>
            辞書登録: ${escapeHtml(kw.word)}${kw.reading ? ` (${escapeHtml(kw.reading)})` : ''}
          </button>
        `;
      }).join('');

      suggestKeywordsHtml = `
        <div class="suggested-keywords-section">
          <div class="suggested-keywords-title">
            <i data-lucide="lightbulb" style="width:14px;height:14px;color:var(--accent-secondary);"></i>
            AIが新しい固有名詞を検出しました（辞書登録できます）
          </div>
          <div class="suggested-keywords-list">
            ${suggestListHtml}
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="event-card-header">
        <input type="text" class="event-title-input" value="${escapeHtml(event.title)}" placeholder="予定のタイトル">
      </div>
      <div class="event-card-body">
        <div class="datetime-picker-group">
          <label>開始日時</label>
          <input type="datetime-local" class="event-start-input" value="${formatInputDateTime(event.start)}">
        </div>
        <div class="datetime-picker-group">
          <label>終了日時</label>
          <input type="datetime-local" class="event-end-input" value="${formatInputDateTime(event.end)}">
        </div>
        <div class="event-card-details">
          <label>詳細・メモ</label>
          <textarea class="event-details-input" placeholder="場所やオンラインURL、メモなど">${escapeHtml(event.details || '')}</textarea>
        </div>
      </div>
      ${suggestKeywordsHtml}
      <div class="event-card-actions">
        <button class="card-action-btn delete" onclick="deleteEventCard(${index})">
          <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
          削除
        </button>
        <button class="card-action-btn add-calendar" onclick="registerToCalendar(${index})">
          <i data-lucide="calendar-plus" style="width:14px;height:14px;"></i>
          カレンダーに追加
        </button>
      </div>
    `;
    elEventsList.appendChild(card);
  });

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
  elResultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.deleteEventCard = function (index) {
  appState.parsedEvents.splice(index, 1);
  renderEvents();
};

window.addSuggestedKeyword = function (eventIdx, kwIdx, buttonEl) {
  const event = appState.parsedEvents[eventIdx];
  if (!event || !event.keywords || !event.keywords[kwIdx]) return;

  const kw = event.keywords[kwIdx];
  const word = kw.word.trim();
  const reading = (kw.reading || '').trim();

  // 重複チェック
  const exists = appState.dictionary.some(item => item.word.toLowerCase() === word.toLowerCase());
  if (exists) {
    alert('この単語は既に登録されています。');
    return;
  }

  // 辞書への追加
  appState.dictionary.push({
    word: word,
    reading: reading,
    aliases: ''
  });

  saveState();
  renderDictionaryTags(); // 設定画面側のUIリストも更新しておく

  // ボタンの状態を変更
  buttonEl.disabled = true;
  buttonEl.className = 'keyword-suggest-btn added';
  buttonEl.innerHTML = `
    <i data-lucide="check" style="width:12px;height:12px;"></i>
    登録完了: ${escapeHtml(word)}
  `;

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
};

// ==========================================================================
// Google Calendar Integration & Vocabulary Learning (With Readings)
// ==========================================================================
window.registerToCalendar = function (index) {
  const card = document.querySelector(`.event-card[data-index="${index}"]`);
  if (!card) return;

  const title = card.querySelector('.event-title-input').value.trim();
  const startVal = card.querySelector('.event-start-input').value;
  const endVal = card.querySelector('.event-end-input').value;
  const details = card.querySelector('.event-details-input').value.trim();

  if (!title || !startVal || !endVal) {
    alert('タイトル、開始日時、終了日時は必須項目です。');
    return;
  }

  const formatForGoogle = (dateTimeStr) => {
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const gStart = formatForGoogle(startVal);
  const gEnd = formatForGoogle(endVal);

  if (!gStart || !gEnd) {
    alert('日時のフォーマットが不正です。');
    return;
  }

  const gCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${gStart}/${gEnd}&details=${encodeURIComponent(details)}`;

  // バックグラウンドで固有名詞・単語の自動学習を行う（よみがな付き）
  const eventData = appState.parsedEvents[index];
  if (eventData && eventData.keywords && eventData.keywords.length > 0) {
    learnKeywords(eventData.keywords);
  }

  window.open(gCalUrl, '_blank');
};

// よみがな付きキーワードの自動学習
function learnKeywords(keywords) {
  let updated = false;
  keywords.forEach(kw => {
    const word = kw.word.trim();
    const reading = (kw.reading || '').trim();

    // 最小長チェック、重複チェック、数字のみチェック
    if (word.length >= 2 && isNaN(word)) {
      const exists = appState.dictionary.some(item => item.word.toLowerCase() === word.toLowerCase());
      if (!exists) {
        appState.dictionary.push({
          word: word,
          reading: reading,
          aliases: ''
        });
        updated = true;
      }
    }
  });

  if (updated) {
    saveState();
    renderDictionaryTags();
    console.log('Learned new vocabulary with readings:', keywords);
  }
}

// ==========================================================================
// UI Helpers
// ==========================================================================
function showLoading(message) {
  elLoadingMessage.textContent = message;
  elLoadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  elLoadingOverlay.classList.add('hidden');
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
