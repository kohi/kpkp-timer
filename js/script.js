/*
 * (c) RE:SML
 * 無断での改変、再配布を禁じます。
 */
document.addEventListener('DOMContentLoaded', init);

// === DOM Elements ===
const mainScreen = document.getElementById('main-screen');
const settingsScreen = document.getElementById('settings-screen');
const settingsBtn = document.getElementById('settings-btn');
const backToMainBtn = document.getElementById('back-to-main-btn');

// Main screen elements
const personCounterContainer = document.getElementById('person-counter-container');
const personCountDisplay = document.getElementById('person-count');
const personLabelDisplay = document.getElementById('person-label');
const mainTimerDisplay = document.getElementById('main-timer-display');
const remainingTimeDisplay = document.getElementById('remaining-time-display');
const nextTimerDisplay = document.getElementById('next-timer-display');
const subTimerInfo = document.getElementById('sub-timer-info');

const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const skipBtn = document.getElementById('skip-btn');

// Settings screen elements
const togglePersonCounter = document.getElementById('toggle-person-counter');
const toggleAutoCountup = document.getElementById('toggle-auto-countup');
const personLabelInput = document.getElementById('person-label-input');

// Timer settings
const timersList = document.getElementById('timers-list');
const addTimerBtn = document.getElementById('add-timer-btn');
const importCsvBtn = document.getElementById('import-csv-btn');
const downloadCsvTemplateBtn = document.getElementById('download-csv-template-btn');
const csvFileInput = document.getElementById('csv-file-input');

// Display settings
const toggleMainTimerDisplay = document.getElementById('toggle-main-timer-display');
const toggleRemainingTimeDisplay = document.getElementById('toggle-remaining-time-display');
const toggleIntervalTimeDisplay = document.getElementById('toggle-interval-time-display');

// Media settings
const toggleSound = document.getElementById('toggle-sound');
const bgmAudio = document.getElementById('bgm-audio');
const alarmAudio = document.getElementById('alarm-audio');
const shortBeepAudio = document.getElementById('short-beep-audio');

// Clock settings
const toggleClockMode = document.getElementById('toggle-clock-mode');

// === Web Audio API ===
let audioContext = null;

// === 新しい統一状態管理 ===
const timerState = {
    currentIndex: 0,           // 現在のタイマーインデックス（0-based）
    phase: 'stopped',          // 'stopped', 'running', 'paused', 'interval'
    startTime: null,           // 開始時刻
    elapsedMs: 0              // 累積経過時間（ミリ秒）
};

// 既存システムとの互換性用
let timerIntervalId = null;
let clockIntervalId = null;
let intervalAudio = null;  // インターバル終了音用

// 警告音の再生管理フラグ (一度鳴らしたら次の警告レベルまで鳴らさないように管理)
const playedBeepWarnings = new Set();
// 警告色変化の再生管理レベル (現在適用されている最高レベルの秒数を記憶)
let lastAppliedVisualLevel = null; // null または秒数 (例: 10, 5, 3)

const TIMER_MAX_COUNT = 10;
const TIMER_TICK_INTERVAL_MS = 100;

// Default settings - PWA設定を統合
const defaultSettings = {
    showPersonCounter: true,
    autoCountUp: true,
    personCounterLabel: "人目",
    personCount: 1,  // 互換性のため残すが使用しない
    timers: [
        { id: 1, name: "タイマー 1", duration: 300, interval: 30 },
        { id: 2, name: "タイマー 2", duration: 120, interval: 15 },
        { id: 3, name: "タイマー 3", duration: 60, interval: 0 },
    ],
    currentTimerIndex: 0,  // 互換性のため残すが使用しない
    
    // タイマータイプを統一設定に変更
    globalTimerType: "countdown",  // "countdown" または "countup"
    
    showMainTimer: true,
    showRemainingTimeDisplay: true,
    showIntervalTimeDisplay: true,
    backgroundImage: "",
    bgmFile: "",
    alarmFile: "",
    intervalFile: "",  // インターバル終了音
    shortBeepFile: "", // ショートビープ音ファイル

    // 音声設定の個別制御
    bgmEnabled: true,
    alarmEnabled: true,
    intervalSoundEnabled: true,
    soundEnabled: true,  // 全体のマスター音声設定
    beepWarningEnabled: true, // ビープ音警告ON/OFF
    beepWarningSeconds: "10,5,3", // ビープ音秒数 (カンマ区切り文字列)
    
    // 視覚警告設定
    visualWarningEnabled: false, // デフォルトでOFF
    visualWarningLevels: "10,5,3", // 視覚警告秒数 (カンマ区切り文字列)

    isClockMode: false,
    
    // PWA設定
    webAudioEnabled: true,
    notificationsEnabled: false
};

let settings = {};

// メディアファイル表示用のスパン要素を管理するマップ
const mediaDisplaySpans = {};

// --- 【追加】タイマー時間プリセット ---
const TIMER_PRESETS = [
    { label: "5分", value: 300 },
    { label: "3分", value: 180 },
    { label: "1分", value: 60 },
    { label: "30秒", value: 30 },
    { label: "10秒", value: 10 },
    { label: "5秒", value: 5 },
];

// === Web Audio API機能 ===
function initWebAudio() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
            settings.webAudioEnabled = false;
        }
    }
    
    // ユーザーインタラクション後にコンテキストを再開
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

// ビープ音生成（Web Audio API）
function generateBeep(frequency = 800, duration = 200, volume = 0.3) {
    if (!settings.webAudioEnabled || !audioContext) return;
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration / 1000);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);
        
    } catch (error) {
        console.error('Web Audio beep generation failed:', error);
    }
}

// アラーム音生成（Web Audio API）
function generateAlarm(duration = 1000) {
    if (!settings.webAudioEnabled || !audioContext) return;
    
    try {
        const frequencies = [659, 523, 659, 523]; // E5, C5 の繰り返し
        const noteLength = duration / frequencies.length / 1000;
        
        frequencies.forEach((freq, index) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
            oscillator.type = 'square';
            
            const startTime = audioContext.currentTime + (index * noteLength);
            const endTime = startTime + noteLength * 0.8; // 少し間をあける
            
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, endTime);
            
            oscillator.start(startTime);
            oscillator.stop(endTime);
        });
        
    } catch (error) {
        console.error('Web Audio alarm generation failed:', error);
    }
}

// インターバル音生成（Web Audio API）
function generateIntervalSound(duration = 500) {
    if (!settings.webAudioEnabled || !audioContext) return;
    
    try {
        // 短い2音のチャイム
        const frequencies = [523, 659]; // C5, E5
        const noteLength = duration / frequencies.length / 1000;
        
        frequencies.forEach((freq, index) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
            oscillator.type = 'sine';
            
            const startTime = audioContext.currentTime + (index * noteLength);
            const endTime = startTime + noteLength;
            
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, endTime);
            
            oscillator.start(startTime);
            oscillator.stop(endTime);
        });
        
    } catch (error) {
        console.error('Web Audio interval sound generation failed:', error);
    }
}

// === PWA通知機能 ===
function checkNotificationPermission() {
    if ('Notification' in window) {
        if (Notification.permission === 'default') {
            return Notification.requestPermission();
        }
        return Promise.resolve(Notification.permission);
    }
    return Promise.resolve('denied');
}

function sendTimerCompleteNotification(timerName) {
    if ('Notification' in window && Notification.permission === 'granted' && settings.notificationsEnabled) {
        const notification = new Notification('KPKP-Timer', {
            body: `${timerName}が完了しました`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: 'timer-complete',
            vibrate: [100, 50, 100],
            requireInteraction: true
        });
        
        notification.onclick = function() {
            window.focus();
            notification.close();
        };
        
        // 5秒後に自動で閉じる
        setTimeout(() => {
            notification.close();
        }, 5000);
    }
}

// === 計算専用関数（副作用なし・表示問題修正） ===
function getCurrentTimerInfo() {
    const timer = settings.timers[timerState.currentIndex];
    if (!timer) return null;
    
    // 人数表示を完全にインデックス連動にする
    const personNumber = timerState.currentIndex + 1;
    
    let displayTime, remainingTime, elapsedTime;
    
    if (timerState.phase === 'stopped') {
        // 停止中は初期値表示
        elapsedTime = 0;
        if (settings.globalTimerType === 'countdown') {
            displayTime = timer.duration;
            remainingTime = timer.duration;
        } else {
            displayTime = 0;
            remainingTime = timer.duration;
        }
    } else {
        // 実行中は経過時間から計算
        const now = Date.now();
        const totalElapsed = timerState.elapsedMs + (timerState.startTime ? now - timerState.startTime : 0);
        const elapsedSeconds = Math.floor(totalElapsed / 1000);
        
        if (timerState.phase === 'interval') {
            // インターバル中は常にカウントダウン
            displayTime = Math.max(0, timer.interval - elapsedSeconds);
            remainingTime = displayTime;
            elapsedTime = Math.min(elapsedSeconds, timer.interval);
        } else if (settings.globalTimerType === 'countdown') {
            elapsedTime = Math.min(elapsedSeconds, timer.duration);
            remainingTime = Math.max(0, timer.duration - elapsedSeconds);
            displayTime = remainingTime;
        } else { // countup
            elapsedTime = elapsedSeconds;
            remainingTime = Math.max(0, timer.duration - elapsedSeconds);
            displayTime = elapsedTime;
        }
    }
    
    return {
        timer,
        personNumber,
        displayTime,
        remainingTime, // これはサブ表示のロジックで使用
        elapsedTime,
        isInterval: timerState.phase === 'interval'
    };
}

// === 保存状況表示機能 ===
function showSaveStatus(message, isError = false) {
    let statusEl = document.getElementById('save-status');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'save-status';
        statusEl.className = 'save-status';
        document.body.appendChild(statusEl);
    }
    
    statusEl.textContent = message;
    statusEl.className = 'save-status show' + (isError ? ' error' : '');
    
    setTimeout(() => {
        statusEl.classList.remove('show');
    }, 2000);
}

// === Initialization ===
function init() {
    loadSettings();
    setupAudioElements();  // 音声要素の初期化
    setupFileInputs(); // ファイル入力UIを初期化 (ボタン、ファイルinput、表示スパンの追加)
    applySettingsToUI(); // 設定をUIに適用 (表示スパンのテキスト更新など)
    setupEventListeners();
    updateBackgroundImage();
    setupAudioSources(); // 音源パスを設定
    
    // PWA関連の初期化
    initWebAudio();
    setupPWASettings();

    if (settings.isClockMode) {
        enterClockMode();
    } else {
        exitClockMode();
    }
    updateControlButtons();
    
    // 最初のユーザーインタラクションでWeb Audioを有効化
    document.addEventListener('click', function initOnFirstClick() {
        initWebAudio();
    }, { once: true });
}

function loadSettings() {
    const savedSettings = localStorage.getItem('timerAppSettings');
    if (savedSettings) {
        settings = JSON.parse(savedSettings);
        settings = { ...defaultSettings, ...settings };
        
        // 古い設定から新しい音声設定への移行
        if (settings.soundEnabled !== undefined && settings.bgmEnabled === undefined) {
            settings.bgmEnabled = settings.soundEnabled;
            settings.alarmEnabled = settings.soundEnabled;
            settings.intervalSoundEnabled = settings.soundEnabled;
        }
        
        // 古いタイマータイプ設定から統一設定への移行
        if (settings.globalTimerType === undefined) {
            // 既存タイマーの最初のタイプを全体設定として使用
            if (settings.timers && settings.timers.length > 0 && settings.timers[0].type) {
                settings.globalTimerType = settings.timers[0].type;
            } else {
                settings.globalTimerType = "countdown";
            }
        }
        
        // PWA設定の互換性処理
        if (settings.webAudioEnabled === undefined) {
            settings.webAudioEnabled = true;
        }
        if (settings.notificationsEnabled === undefined) {
            settings.notificationsEnabled = false;
        }
        
        if (!Array.isArray(settings.timers) || settings.timers.length === 0) {
            settings.timers = JSON.parse(JSON.stringify(defaultSettings.timers));
        } else {
            settings.timers = settings.timers.map((timer, index) => ({
                id: timer.id || (index + 1),
                name: timer.name || `T${index + 1}`,
                duration: timer.duration || 60,
                interval: timer.interval || 0,
                // type プロパティは削除（統一設定を使用）
            }));
            settings.timers = Array.from(new Map(settings.timers.map(t => [t.id, t])).values()).slice(0, TIMER_MAX_COUNT);
        }
    } else {
        settings = JSON.parse(JSON.stringify(defaultSettings));
    }

    // 旧設定値は無視して新しい状態管理を優先
    if (settings.currentTimerIndex >= settings.timers.length) {
        timerState.currentIndex = 0;
    } else {
        timerState.currentIndex = settings.currentTimerIndex || 0;
    }
}

function saveSettings() {
    try {
        // 現在のインデックスを設定に反映（互換性のため）
        settings.currentTimerIndex = timerState.currentIndex;
        settings.personCount = timerState.currentIndex + 1;
        
        localStorage.setItem('timerAppSettings', JSON.stringify(settings));
        showSaveStatus('設定を保存しました');
    } catch (error) {
        showSaveStatus('保存に失敗しました', true);
        console.error('保存エラー:', error);
    }
}

function saveSettingsWithDelay() {
    clearTimeout(saveSettingsWithDelay.timeoutId);
    saveSettingsWithDelay.timeoutId = setTimeout(saveSettings, 500);
}

// === 音声要素の初期化 ===
function setupAudioElements() {
    // インターバル終了音用のaudio要素を動的に作成
    if (!intervalAudio) {
        intervalAudio = document.createElement('audio');
        intervalAudio.id = 'interval-audio';
        intervalAudio.preload = 'none';
        document.body.appendChild(intervalAudio);
    }
    // shortBeepAudioはHTMLで定義済み
}

// === PWA設定の初期化 ===
function setupPWASettings() {
    const toggleWebAudio = document.getElementById('toggle-web-audio');
    const toggleNotifications = document.getElementById('toggle-notifications');
    
    if (toggleWebAudio) {
        toggleWebAudio.checked = settings.webAudioEnabled;
        toggleWebAudio.addEventListener('change', (e) => {
            settings.webAudioEnabled = e.target.checked;
            if (settings.webAudioEnabled) {
                initWebAudio();
            }
            saveSettingsWithDelay();
        });
    }
    
    if (toggleNotifications) {
        // 通知許可状態を確認
        if ('Notification' in window) {
            toggleNotifications.checked = Notification.permission === 'granted' && settings.notificationsEnabled;
        }
        
        toggleNotifications.addEventListener('change', async (e) => {
            if (e.target.checked) {
                const permission = await checkNotificationPermission();
                if (permission !== 'granted') {
                    e.target.checked = false;
                    alert('通知許可が拒否されました。ブラウザの設定から許可してください。');
                } else {
                    settings.notificationsEnabled = true;
                }
            } else {
                settings.notificationsEnabled = false;
            }
            saveSettingsWithDelay();
        });
    }
}

// === ファイル入力設定 ===
// ファイル入力UIを一度だけセットアップする関数
function setupFileInputs() {
    createFileInput('bg-image-container', 'backgroundImage', 'image/*');
    createFileInput('bgm-file-container', 'bgmFile', 'audio/*');
    createFileInput('alarm-file-container', 'alarmFile', 'audio/*');
    createFileInput('interval-file-container', 'intervalFile', 'audio/*');
    createFileInput('short-beep-file-container', 'shortBeepFile', 'audio/*'); // ショートビープ音
}

// 動的なファイル選択UIの生成と更新ロジック
function createFileInput(containerId, settingKey, accept) {
    const fileSelectContainer = document.getElementById(containerId);
    if (!fileSelectContainer) {
        console.error(`Container for ${containerId} not found. HTML structure might be incorrect.`);
        return;
    }

    // ボタンとクリアボタンのグループ
    let btnGroup = document.createElement('div');
    btnGroup.className = 'file-input-btn-group';

    // ファイル選択ボタン
    let fileBtn = document.createElement('button');
    fileBtn.type = 'button';
    fileBtn.className = 'file-input-btn';
    fileBtn.textContent = '選択'; // テキストを短縮
    btnGroup.appendChild(fileBtn); 

    // クリアボタン
    let clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'file-clear-btn';
    clearBtn.textContent = 'クリア';
    btnGroup.appendChild(clearBtn);

    fileSelectContainer.appendChild(btnGroup);

    // 隠しファイル入力
    let fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.className = 'file-input-hidden';
    fileInput.accept = accept;
    fileSelectContainer.appendChild(fileInput); 

    // 現在のファイル表示スパン
    let currentFileDisplay = document.createElement('span');
    currentFileDisplay.className = 'current-file-display';
    fileSelectContainer.appendChild(currentFileDisplay); 
    
    // 後で参照できるようにスパン要素への参照を保存
    mediaDisplaySpans[settingKey] = currentFileDisplay;

    // イベントリスナーを設定
    fileBtn.onclick = () => fileInput.click();

    // クリアボタンのイベントリスナー
    clearBtn.onclick = () => {
        settings[settingKey] = ''; // 設定を空にする
        fileInput.value = ''; // input fileもリセット
        updateMediaFileDisplay(settingKey); // UIを更新
        saveSettingsWithDelay();

        // 関連するメディアをリセット
        if (settingKey === 'backgroundImage') updateBackgroundImage();
        if (settingKey === 'bgmFile') {
            if (bgmAudio) { bgmAudio.pause(); bgmAudio.currentTime = 0; bgmAudio.src = ''; }
        } else if (settingKey === 'alarmFile') {
            if (alarmAudio) { alarmAudio.pause(); alarmAudio.currentTime = 0; alarmAudio.src = ''; }
        } else if (settingKey === 'intervalFile') {
            if (intervalAudio) { intervalAudio.pause(); intervalAudio.currentTime = 0; intervalAudio.src = ''; }
        } else if (settingKey === 'shortBeepFile') {
            if (shortBeepAudio) { shortBeepAudio.pause(); shortBeepAudio.currentTime = 0; shortBeepAudio.src = ''; }
        }
    };

    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            const fileName = file.name;
            settings[settingKey] = fileName;
            
            updateMediaFileDisplay(settingKey); // UIコンポーネントを更新
            saveSettingsWithDelay();
            
            // 関連するメディアをすぐに適用
            if (settingKey === 'backgroundImage') updateBackgroundImage();
            if (settingKey === 'bgmFile' || settingKey === 'alarmFile' || settingKey === 'intervalFile' || settingKey === 'shortBeepFile') setupAudioSources();
        }
    };
    
    // 初期UI更新
    updateMediaFileDisplay(settingKey);
}

// 現在のファイル表示を更新する統一関数
function updateMediaFileDisplay(settingKey) {
    const fileName = settings[settingKey];
    const currentFileDisplaySpan = mediaDisplaySpans[settingKey];

    if (!currentFileDisplaySpan) return;

    if (fileName) {
        currentFileDisplaySpan.textContent = `現在: ${fileName}`;
    } else {
        currentFileDisplaySpan.textContent = 'ファイル未選択';
    }
}

function applySettingsToUI() {
    if (togglePersonCounter) togglePersonCounter.checked = settings.showPersonCounter;
    if (toggleAutoCountup) toggleAutoCountup.checked = settings.autoCountUp;
    if (personLabelInput) personLabelInput.value = settings.personCounterLabel;

    renderTimerList();

    if (toggleMainTimerDisplay) toggleMainTimerDisplay.checked = settings.showMainTimer;
    if (toggleRemainingTimeDisplay) toggleRemainingTimeDisplay.checked = settings.showRemainingTimeDisplay;
    if (toggleIntervalTimeDisplay) toggleIntervalTimeDisplay.checked = settings.showIntervalTimeDisplay;

    // 各メディア設定のUIをsettingsの値に合わせて更新
    updateMediaFileDisplay('backgroundImage');
    updateMediaFileDisplay('bgmFile');
    updateMediaFileDisplay('alarmFile');
    updateMediaFileDisplay('intervalFile');
    updateMediaFileDisplay('shortBeepFile'); // ショートビープ音

    if (toggleSound) toggleSound.checked = settings.soundEnabled;
    if (toggleClockMode) toggleClockMode.checked = settings.isClockMode;

    const toggleBGM = document.getElementById('toggle-bgm');
    const toggleAlarm = document.getElementById('toggle-alarm-sound');
    const toggleInterval = document.getElementById('toggle-interval-sound');
    const toggleBeepWarning = document.getElementById('toggle-beep-warning');
    const beepWarningSecondsInput = document.getElementById('beep-warning-seconds-input');
    const toggleVisualWarning = document.getElementById('toggle-visual-warning');
    const visualWarningLevelsInput = document.getElementById('visual-warning-levels-input');
    const toggleWebAudio = document.getElementById('toggle-web-audio');
    const toggleNotifications = document.getElementById('toggle-notifications');

    if (toggleBGM) toggleBGM.checked = settings.bgmEnabled;
    if (toggleAlarm) toggleAlarm.checked = settings.alarmEnabled;
    if (toggleInterval) toggleInterval.checked = settings.intervalSoundEnabled;
    if (toggleBeepWarning) toggleBeepWarning.checked = settings.beepWarningEnabled;
    if (beepWarningSecondsInput) beepWarningSecondsInput.value = settings.beepWarningSeconds;
    if (toggleVisualWarning) toggleVisualWarning.checked = settings.visualWarningEnabled;
    if (visualWarningLevelsInput) visualWarningLevelsInput.value = settings.visualWarningLevels;
    if (toggleWebAudio) toggleWebAudio.checked = settings.webAudioEnabled;
    if (toggleNotifications) {
        toggleNotifications.checked = settings.notificationsEnabled && ('Notification' in window && Notification.permission === 'granted');
    }

    const globalTimerType = document.getElementById('global-timer-type');
    if (globalTimerType) globalTimerType.value = settings.globalTimerType;

    updateDisplay();
}

function setupAudioSources() {
    if (bgmAudio) {
        const bgmPath = settings.bgmFile ? `music/${settings.bgmFile}` : '';
        bgmAudio.src = bgmPath;
        bgmAudio.volume = 0.5;
        bgmAudio.onerror = () => {
            if (bgmPath) console.warn(`BGMファイルが見つかりません: ${bgmPath}`);
        };
    }
    if (alarmAudio) {
        const alarmPath = settings.alarmFile ? `sounds/${settings.alarmFile}` : '';
        alarmAudio.src = alarmPath;
        alarmAudio.volume = 0.7;
        alarmAudio.onerror = () => {
            if (alarmPath) console.warn(`アラームファイルが見つかりません: ${alarmPath}`);
        };
    }
    if (intervalAudio) {
        const intervalPath = settings.intervalFile ? `sounds/${settings.intervalFile}` : '';
        intervalAudio.src = intervalPath;
        intervalAudio.volume = 0.7;
        intervalAudio.onerror = () => {
            if (intervalPath) console.warn(`インターバルファイルが見つかりません: ${intervalPath}`);
        };
    }
    if (shortBeepAudio) { // ショートビープ音
        const beepPath = settings.shortBeepFile ? `sounds/${settings.shortBeepFile}` : '';
        shortBeepAudio.src = beepPath;
        shortBeepAudio.volume = 0.6; // 少し小さめ
        shortBeepAudio.onerror = () => {
            if (beepPath) console.warn(`ビープファイルが見つかりません: ${beepPath}`);
        };
    }
}

// === イベントリスナー設定 ===
function setupEventListeners() {
    if (settingsBtn) {
        settingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showSettingsScreen();
        });
    }
    
    if (backToMainBtn) {
        backToMainBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            saveSettings(); // 設定画面から戻る際に保存
            showMainScreen();
        });
    }

    // Main timer controls
    if (startBtn) {
        startBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startTimer();
        });
    }
    
    if (pauseBtn) {
        pauseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            pauseTimer();
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            resetTimer();
        });
    }
    
    if (skipBtn) {
        skipBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            skipTimer();
        });
    }

    // Comment settings
    if (togglePersonCounter) {
        togglePersonCounter.addEventListener('change', (e) => {
            settings.showPersonCounter = e.target.checked;
            saveSettingsWithDelay();
            updateDisplay();
        });
    }
    
    if (toggleAutoCountup) {
        toggleAutoCountup.addEventListener('change', (e) => {
            settings.autoCountUp = e.target.checked;
            saveSettingsWithDelay();
        });
    }
    
    if (personLabelInput) {
        personLabelInput.addEventListener('input', (e) => {
            settings.personCounterLabel = e.target.value;
            saveSettingsWithDelay();
            updateDisplay();
        });
    }

    // Timer settings
    if (addTimerBtn) {
        addTimerBtn.addEventListener('click', addTimer);
    }

    // CSV Import/Download
    if (importCsvBtn) { 
        importCsvBtn.addEventListener('click', () => csvFileInput.click());
    }
    if (csvFileInput) { 
        csvFileInput.addEventListener('change', handleCsvFileSelect);
    }
    if (downloadCsvTemplateBtn) { 
        downloadCsvTemplateBtn.addEventListener('click', downloadCsvTemplate);
    }

    // タイマータイプ統一設定
    const globalTimerType = document.getElementById('global-timer-type');
    if (globalTimerType) {
        globalTimerType.addEventListener('change', (e) => {
            settings.globalTimerType = e.target.value;
            saveSettingsWithDelay();
            updateDisplay();
        });
    }

    // Display settings
    if (toggleMainTimerDisplay) {
        toggleMainTimerDisplay.addEventListener('change', (e) => {
            settings.showMainTimer = e.target.checked;
            saveSettingsWithDelay();
            updateDisplay();
        });
    }
    
    if (toggleRemainingTimeDisplay) {
        toggleRemainingTimeDisplay.addEventListener('change', (e) => {
            settings.showRemainingTimeDisplay = e.target.checked;
            saveSettingsWithDelay();
            updateDisplay();
        });
    }
    
    if (toggleIntervalTimeDisplay) {
        toggleIntervalTimeDisplay.addEventListener('change', (e) => {
            settings.showIntervalTimeDisplay = e.target.checked;
            saveSettingsWithDelay();
            updateDisplay();
        });
    }

    // 音声個別制御設定
    if (toggleSound) {
        toggleSound.addEventListener('change', (e) => {
            settings.soundEnabled = e.target.checked;
            saveSettingsWithDelay();
            if (!settings.soundEnabled) {
                stopBGM();
                if (alarmAudio) alarmAudio.pause();
                if (intervalAudio) intervalAudio.pause();
                if (shortBeepAudio) shortBeepAudio.pause();
            } else if (timerState.phase === 'running' && timerIntervalId) {
                playBGM();
            }
        });
    }

    const toggleBGM = document.getElementById('toggle-bgm');
    const toggleAlarm = document.getElementById('toggle-alarm-sound');
    const toggleInterval = document.getElementById('toggle-interval-sound');
    const toggleBeepWarning = document.getElementById('toggle-beep-warning');
    const beepWarningSecondsInput = document.getElementById('beep-warning-seconds-input');
    const toggleVisualWarning = document.getElementById('toggle-visual-warning');
    const visualWarningLevelsInput = document.getElementById('visual-warning-levels-input');
    
    if (toggleBGM) {
        toggleBGM.addEventListener('change', (e) => {
            settings.bgmEnabled = e.target.checked;
            saveSettingsWithDelay();
            if (!settings.bgmEnabled) {
                stopBGM();
            } else if (timerState.phase === 'running' && timerIntervalId) {
                playBGM();
            }
        });
    }
    
    if (toggleAlarm) {
        toggleAlarm.addEventListener('change', (e) => {
            settings.alarmEnabled = e.target.checked;
            saveSettingsWithDelay();
        });
    }
    
    if (toggleInterval) {
        toggleInterval.addEventListener('change', (e) => {
            settings.intervalSoundEnabled = e.target.checked;
            saveSettingsWithDelay();
        });
    }

    // ビープ音警告設定
    if (toggleBeepWarning) {
        toggleBeepWarning.addEventListener('change', (e) => {
            settings.beepWarningEnabled = e.target.checked;
            saveSettingsWithDelay();
        });
    }
    if (beepWarningSecondsInput) {
        beepWarningSecondsInput.addEventListener('input', (e) => {
            settings.beepWarningSeconds = e.target.value;
            saveSettingsWithDelay();
        });
    }

    // 視覚警告設定
    if (toggleVisualWarning) {
        toggleVisualWarning.addEventListener('change', (e) => {
            settings.visualWarningEnabled = e.target.checked;
            saveSettingsWithDelay();
            if (!e.target.checked) {
                removeVisualWarningClasses(); // OFFになったらクラスを削除
            }
        });
    }
    if (visualWarningLevelsInput) {
        visualWarningLevelsInput.addEventListener('input', (e) => {
            settings.visualWarningLevels = e.target.value;
            saveSettingsWithDelay();
        });
    }

    // 時計機能
    if (toggleClockMode) {
        toggleClockMode.addEventListener('change', (e) => {
            settings.isClockMode = e.target.checked;
            saveSettingsWithDelay();
            
            const clockNoticeForClockSettings = document.querySelector('#clock-settings .clock-mode-notice');
            if (clockNoticeForClockSettings) {
                clockNoticeForClockSettings.style.display = e.target.checked ? 'block' : 'none';
            }
            
            if (settings.isClockMode) {
                enterClockMode();
                if (timerIntervalId) {
                    clearInterval(timerIntervalId);
                    timerIntervalId = null;
                    stopBGM();
                }
                timerState.phase = 'stopped';
            } else {
                exitClockMode();
            }
            updateControlButtons();
            updateDisplay();
        });
    }
}

// === CSV インポート/ダウンロード機能 ===
function handleCsvFileSelect(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const csvText = e.target.result;
            const newTimers = parseCsvData(csvText);
            
            // 既存のタイマーを上書きし、状態をリセット
            settings.timers = newTimers;
            timerState.currentIndex = 0; 
            timerState.phase = 'stopped'; // CSVインポート後は停止状態
            timerState.elapsedMs = 0;
            timerState.startTime = null;

            // 警告管理フラグもリセット
            playedBeepWarnings.clear();
            lastAppliedVisualLevel = null;
            removeVisualWarningClasses(); // Bodyのクラスもリセット

            renderTimerList();
            saveSettingsWithDelay();
            updateDisplay(); // メイン画面の表示も更新
            showSaveStatus('CSVからタイマー設定をインポートしました');
        } catch (error) {
            showSaveStatus(`CSVインポートエラー: ${error.message}`, true);
            console.error('CSVインポートエラー:', error);
        } finally {
            // 同じファイルを再度選択できるようにinputをリセット
            event.target.value = '';
        }
    };
    reader.onerror = () => {
        showSaveStatus('ファイルの読み込みに失敗しました。', true);
        event.target.value = '';
    };
    reader.readAsText(file, 'UTF-8');
}

function parseCsvData(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length <= 1) { // ヘッダー行のみ、または空の場合
        throw new Error('CSVファイルにタイマーデータが見つかりません。');
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const expectedHeaders = ['t1', '時間', 'INVL']; 

    const nameIndex = headers.indexOf('t1');
    const durationIndex = headers.indexOf('時間');
    const intervalIndex = headers.indexOf('INVL');

    if (nameIndex === -1 || durationIndex === -1 || intervalIndex === -1) {
        throw new Error('CSVヘッダーが無効です。`t1`, `時間`, `INVL`が必要です。');
    }

    const newTimers = [];
    let nextId = 1; // CSVインポート時はIDを1から再割り当て

    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        if (parts.length < 3) { // 最低3カラム必要
            console.warn(`CSVの行 ${i + 1} が不正なフォーマットです。スキップします。`);
            continue;
        }

        const name = parts[nameIndex];
        const durationStr = parts[durationIndex];
        const intervalStr = parts[intervalIndex];

        const duration = parseMMSS(durationStr);
        const interval = parseMMSS(intervalStr);

        if (isNaN(duration) || isNaN(interval) || duration < 0 || interval < 0) {
            console.warn(`CSVの行 ${i + 1} の時間またはインターバルが無効です。スキップします。`);
            continue;
        }
        
        if (newTimers.length >= TIMER_MAX_COUNT) {
            console.warn(`タイマー最大数(${TIMER_MAX_COUNT})に達しました。以降の行はスキップされます。`);
            break;
        }

        newTimers.push({
            id: nextId++,
            name: name,
            duration: duration,
            interval: interval
        });
    }

    if (newTimers.length === 0) {
        throw new Error('有効なタイマーデータがCSVファイルに見つかりませんでした。');
    }
    
    return newTimers;
}

function downloadCsvTemplate() {
    const csvContent = "t1,時間,INVL\n1さん,00:10,00:05\n2さん,00:09,00:05\n3さん,00:08,00:04";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timer_template.csv';
    document.body.appendChild(a); // Firefoxなどで必要
    a.click();
    document.body.removeChild(a); // クリーンアップ
    URL.revokeObjectURL(url); // オブジェクトURLを解放

    showSaveStatus('CSVテンプレートをダウンロードしました');
}
// === Screen Management ===
function showMainScreen() {
    if (settingsScreen) settingsScreen.classList.remove('active');
    if (mainScreen) mainScreen.classList.add('active');
    document.body.classList.remove('clock-mode');

    // 警告管理フラグもリセット
    playedBeepWarnings.clear();
    lastAppliedVisualLevel = null;
    removeVisualWarningClasses(); // bodyのクラスもリセット

    if (settings.isClockMode) {
        enterClockMode();
    } else {
        exitClockMode();
    }
    updateControlButtons();
}

function showSettingsScreen() {
    if (timerIntervalId) {
        pauseTimer();
    }
    if (clockIntervalId) {
        clearInterval(clockIntervalId);
        clockIntervalId = null;
    }

    if (mainScreen) mainScreen.classList.remove('active');
    if (settingsScreen) settingsScreen.classList.add('active');
    applySettingsToUI();
}

// === Timer List Management（タイプ設定削除） ===
function renderTimerList() {
    if (!timersList) return;
    
    timersList.innerHTML = '';
    settings.timers.forEach((timer, index) => {
        const timerItem = document.createElement('div');
        timerItem.className = 'timer-item';
        timerItem.dataset.timerId = timer.id;

        const [minDuration, secDuration] = formatSecondsToMMSS(timer.duration).split(':');
        const [minInterval, secInterval] = formatSecondsToMMSS(timer.interval).split(':');

        timerItem.innerHTML = `
            <h4>T${index + 1}: <input type="text" class="timer-name-short" value="${timer.name}" title="タイマー名称">
                <button class="remove-timer-btn">×</button>
            </h4>
            <div class="timer-duration-group">
                <label>時間:</label>
                <input type="text" class="timer-duration" value="${minDuration}:${secDuration}" pattern="[0-5][0-9]:[0-5][0-9]" title="時間 (mm:ss)">
                <div class="preset-buttons">
                    ${TIMER_PRESETS.map(p => `<button type="button" class="preset-btn" data-field="duration" data-value="${p.value}">${p.label}</button>`).join('')}
                </div>
            </div>
            <div class="timer-interval-group">
                <label>INVL:</label>
                <input type="text" class="timer-interval" value="${minInterval}:${secInterval}" pattern="[0-5][0-9]:[0-5][0-9]" title="インターバル (mm:ss)">
                <div class="preset-buttons">
                    ${TIMER_PRESETS.map(p => `<button type="button" class="preset-btn" data-field="interval" data-value="${p.value}">${p.label}</button>`).join('')}
                </div>
            </div>
        `;

        timersList.appendChild(timerItem);

        const removeBtn = timerItem.querySelector('.remove-timer-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => removeTimer(timer.id));
        }

        const nameInput = timerItem.querySelector('.timer-name-short');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                updateTimerSetting(timer.id, 'name', e.target.value);
                saveSettingsWithDelay();
            });
        }

        const durationInput = timerItem.querySelector('.timer-duration');
        if (durationInput) {
            durationInput.addEventListener('blur', (e) => {
                const parsed = parseMMSS(e.target.value);
                if (!isNaN(parsed)) {
                    updateTimerSetting(timer.id, 'duration', parsed);
                    e.target.value = formatSecondsToMMSS(parsed);
                    saveSettingsWithDelay();
                    updateDisplay();
                } else {
                    e.target.value = formatSecondsToMMSS(settings.timers.find(t => t.id === timer.id)?.duration || 0); // 無効な場合は元の値に戻す
                }
            });
        }

        const intervalInput = timerItem.querySelector('.timer-interval');
        if (intervalInput) {
            intervalInput.addEventListener('blur', (e) => {
                const parsed = parseMMSS(e.target.value);
                if (!isNaN(parsed)) {
                    updateTimerSetting(timer.id, 'interval', parsed);
                    e.target.value = formatSecondsToMMSS(parsed);
                    saveSettingsWithDelay();
                    updateDisplay();
                } else {
                    e.target.value = formatSecondsToMMSS(settings.timers.find(t => t.id === timer.id)?.interval || 0); // 無効な場合は元の値に戻す
                }
            });
        }

        // --- 【追加】プリセットボタンのイベントリスナー設定 ---
        const presetButtons = timerItem.querySelectorAll('.preset-btn');
        presetButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const field = e.target.dataset.field; // 'duration' or 'interval'
                const value = parseInt(e.target.dataset.value, 10);
                if (!isNaN(value)) {
                    updateTimerSetting(timer.id, field, value);
                    // 入力フィールドの表示も更新
                    if (field === 'duration') {
                        durationInput.value = formatSecondsToMMSS(value);
                    } else if (field === 'interval') {
                        intervalInput.value = formatSecondsToMMSS(value);
                    }
                    saveSettingsWithDelay();
                    updateDisplay();
                }
            });
        });
        // --- 【ここまで追加】 ---
    });
    updateControlButtons();
}

function addTimer() {
    if (settings.timers.length >= TIMER_MAX_COUNT) {
        alert(`設定できるタイマーは最大${TIMER_MAX_COUNT}個までです。`);
        return;
    }
    const newId = settings.timers.length > 0 ? Math.max(...settings.timers.map(t => t.id)) + 1 : 1;
    const newTimer = { id: newId, name: `T${settings.timers.length + 1}`, duration: 60, interval: 0 };
    settings.timers.push(newTimer);
    saveSettingsWithDelay();
    renderTimerList();
}

function removeTimer(id) {
    if (settings.timers.length === 1) {
        alert("最低1つのタイマーが必要です。");
        return;
    }
    settings.timers = settings.timers.filter(timer => timer.id !== id);
    if (timerState.currentIndex >= settings.timers.length) {
        timerState.currentIndex = Math.max(0, settings.timers.length - 1);
    }
    saveSettingsWithDelay();
    renderTimerList();
    resetTimer();
}

function updateTimerSetting(id, key, value) {
    const timerIndex = settings.timers.findIndex(timer => timer.id === id);
    if (timerIndex !== -1) {
        settings.timers[timerIndex][key] = value;
        
        // 現在実行中のタイマーが変更された場合は再計算
        if (timerIndex === timerState.currentIndex && timerState.phase !== 'stopped') {
            const wasRunning = timerIntervalId !== null;
            if (wasRunning) {
                pauseTimer();
            }
            if (key === 'duration') {
                timerState.elapsedMs = 0;
            }
            if (wasRunning) {
                startTimer();
            }
        }
        updateDisplay();
    }
}

// === タイマー制御ロジック ===
function startTimer() {
    if (settings.isClockMode || !settings.timers.length) return;
    
    // 重複実行を確実に防止
    if (timerIntervalId) {
        console.warn('タイマーは既に実行中です');
        return;
    }
    
    if (timerState.phase === 'stopped') { // 停止状態からの開始の場合のみcurrentIndexを0に
        // 新規開始
        timerState.currentIndex = 0; 
        timerState.phase = 'running';
        timerState.elapsedMs = 0;
    } else if (timerState.phase === 'paused') {
        // 再開
        timerState.phase = 'running';
    }
    
    timerState.startTime = Date.now();
    
    // 警告管理フラグをリセット
    playedBeepWarnings.clear();
    lastAppliedVisualLevel = null; // 【修正】
    removeVisualWarningClasses(); // Bodyのクラスもリセット

    timerIntervalId = setInterval(tick, TIMER_TICK_INTERVAL_MS);
    playBGM();
    updateDisplay();
}

function pauseTimer() {
    if (!timerIntervalId) return;
    
    clearInterval(timerIntervalId);
    timerIntervalId = null;
    
    // 経過時間を累積
    if (timerState.startTime) {
        timerState.elapsedMs += Date.now() - timerState.startTime;
    }
    
    timerState.phase = 'paused';
    timerState.startTime = null;
    stopBGM();
    updateDisplay();
}

function resetTimer() {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
    stopBGM();
    
    // 状態を完全リセット
    timerState.currentIndex = 0;
    timerState.phase = 'stopped';
    timerState.startTime = null;
    timerState.elapsedMs = 0;
    
    // 警告管理フラグをリセット
    playedBeepWarnings.clear();
    lastAppliedVisualLevel = null; // 【修正】
    removeVisualWarningClasses(); // Bodyのクラスもリセット

    updateDisplay();
}

function skipTimer() {
    if (settings.isClockMode || !settings.timers.length) return;
    
    // 停止中または一時停止中のスキップ: 次のタイマーに移動し、一時停止状態にする
    if (timerState.phase === 'stopped' || timerState.phase === 'paused') {
        clearInterval(timerIntervalId); // 念のためクリア
        timerIntervalId = null;
        stopBGM(); // BGMも停止
        
        if (timerState.currentIndex < settings.timers.length - 1) {
            timerState.currentIndex++;
            timerState.phase = 'paused'; // スキップ後は一時停止状態に設定
            timerState.elapsedMs = 0; // 新しいタイマーは経過時間0から
            timerState.startTime = null; // 再生されていないので開始時間なし
            showSaveStatus(`T${timerState.currentIndex + 1}: ${settings.timers[timerState.currentIndex].name} が選択されました`);
        } else {
            // 最終タイマーでスキップしようとした場合、リセット状態に
            resetTimer();
            showSaveStatus('最終タイマーです。タイマーをリセットしました。', false);
        }
    } else { // 'running' または 'interval' 中のスキップ
        // 実行中の場合は、通常のフェーズ移行ロジック
        moveToNextPhase();
    }
    // スキップ後も警告管理フラグをリセット
    playedBeepWarnings.clear();
    lastAppliedVisualLevel = null; // 【修正】
    removeVisualWarningClasses(); // Bodyのクラスもリセット
    updateDisplay();
}

function tick() {
    const info = getCurrentTimerInfo();
    if (!info) return;
    
    const now = Date.now();
    const totalElapsed = timerState.elapsedMs + (now - timerState.startTime);
    const elapsedSeconds = Math.floor(totalElapsed / 1000);
    // 【修正】警告の残り秒数はメインタイマーの場合のみを対象とする (カウントダウンのdisplayTimeまたはカウントアップの残り時間)
    const remainingSecondsForWarning = info.isInterval ? -1 : (settings.globalTimerType === 'countdown' ? info.displayTime : Math.max(0, info.timer.duration - elapsedSeconds)); // インターバル中は警告しないように-1

    // 【修正】ビープ音警告のロジック (インターバル中は実行しない)
    if (settings.beepWarningEnabled && !info.isInterval && (timerState.phase === 'running' || timerState.phase === 'interval')) {
        const beepLevels = settings.beepWarningSeconds.split(',').map(s => parseInt(s.trim(), 10)).filter(s => !isNaN(s) && s > 0).sort((a,b)=>b-a);
        for (const level of beepLevels) {
            // 残り時間が指定レベルに達した（またはそれを下回った）が、まだこのレベルの警告を再生していない場合
            if (remainingSecondsForWarning <= level && !playedBeepWarnings.has(level)) {
                playShortBeep();
                playedBeepWarnings.add(level); // 再生済みのレベルを記録
                break; // 最も高いレベルの警告が優先されるように一つだけ再生
            }
        }
    } else {
        playedBeepWarnings.clear(); // インターバル中や無効の場合はフラグをクリア
    }

    // 【修正】視覚警告のロジック (body全体に適用, インターバル中は実行しない)
    if (settings.visualWarningEnabled && !info.isInterval && (timerState.phase === 'running' || timerState.phase === 'interval')) {
        const visualLevels = settings.visualWarningLevels.split(',').map(s => parseInt(s.trim(), 10)).filter(s => !isNaN(s) && s > 0).sort((a,b)=>b-a);
        let currentLevelToApply = null; // 今回適用すべきレベルの秒数

        for (let i = 0; i < visualLevels.length; i++) {
            const level = visualLevels[i];
            if (remainingSecondsForWarning <= level) {
                currentLevelToApply = level;
                break; // 最も高い（秒数の小さい）レベルが優先
            }
        }

        // 以前適用されたレベルと異なる場合にのみ更新
        if (currentLevelToApply !== lastAppliedVisualLevel) {
            removeVisualWarningClasses(); // 全ての警告クラスを削除
            if (currentLevelToApply !== null) {
                const index = visualLevels.indexOf(currentLevelToApply);
                document.body.classList.add(`warning-level-${index + 1}`);
            }
            lastAppliedVisualLevel = currentLevelToApply; // 適用したレベルを記憶
        }

    } else {
        removeVisualWarningClasses(); // 機能が無効な場合やインターバル中、停止中などもクラスを削除
        lastAppliedVisualLevel = null;
    }


    let shouldMove = false;
    
    if (timerState.phase === 'interval') {
        shouldMove = elapsedSeconds >= info.timer.interval;
    } else if (settings.globalTimerType === 'countdown') {
        shouldMove = elapsedSeconds >= info.timer.duration;
    } else if (settings.globalTimerType === 'countup' && info.timer.duration > 0) {
        shouldMove = elapsedSeconds >= info.timer.duration;
    }
    
    if (shouldMove) {
        if (timerState.phase === 'interval') {
            playIntervalSound();  // インターバル終了音
        } else {
            playAlarm();  // タイマー終了音
        }
        moveToNextPhase();
    } else {
        updateDisplay();
    }
}

function moveToNextPhase() {
    const currentTimer = settings.timers[timerState.currentIndex];
    if (!currentTimer) return;
    
    // 通知送信
    if (settings.notificationsEnabled) {
        if (timerState.phase === 'interval') {
            sendTimerCompleteNotification(`${currentTimer.name} (インターバル)`);
        } else {
            sendTimerCompleteNotification(currentTimer.name);
        }
    }
    
    // 経過時間を累積
    if (timerState.startTime) {
        timerState.elapsedMs += Date.now() - timerState.startTime;
    }
    
    if (timerState.phase === 'running' && currentTimer.interval > 0) {
        // タイマー完了 → インターバル開始
        timerState.phase = 'interval';
        timerState.elapsedMs = 0;
    } else {
        // 次のタイマーに移動
        timerState.currentIndex++;
        if (timerState.currentIndex >= settings.timers.length) {
            // 全完了
            resetTimer();
            alert("全てのタイマーが終了しました！");
            return;
        }
        timerState.phase = 'running';
        timerState.elapsedMs = 0;
    }
    
    timerState.startTime = Date.now();
    // 警告管理フラグをリセット
    playedBeepWarnings.clear();
    lastAppliedVisualLevel = null; // 【修正】
    removeVisualWarningClasses(); // Bodyのクラスもリセット

    playBGM();
    updateDisplay();
}

// 視覚警告クラスを全て削除するヘルパー関数 (bodyから)
function removeVisualWarningClasses() {
    document.body.classList.remove('warning-level-1', 'warning-level-2', 'warning-level-3');
    // lastAppliedVisualLevel はこの関数が呼ばれただけではnullにしない。tick()側で適切に制御
}

// === 表示更新 ===
function updateDisplay() {
    if (settings.isClockMode) {
        updateClockDisplay();
        return;
    }
    
    const info = getCurrentTimerInfo();
    if (!info) {
        showNoTimerState();
        return;
    }
    
    // 人数カウンター表示（インターバル対応・位置調整）
    if (personCounterContainer && settings.showPersonCounter) {
        personCounterContainer.style.display = 'flex';
        // 位置を少し下に調整
        personCounterContainer.style.position = 'absolute';
        personCounterContainer.style.top = '15vh';
        personCounterContainer.style.left = '50%';
        personCounterContainer.style.transform = 'translateX(-50%)';
        personCounterContainer.style.zIndex = '10';
        
        if (personCountDisplay) {
            personCountDisplay.textContent = info.personNumber;
        }
        if (personLabelDisplay) {
            // インターバル中は「○人目(インターバル)」表記
            if (info.isInterval) {
                personLabelDisplay.textContent = settings.personCounterLabel + '(インターバル)';
            } else {
                personLabelDisplay.textContent = settings.personCounterLabel;
            }
        }
    } else if (personCounterContainer) {
        personCounterContainer.style.display = 'none';
    }
    
    // メインタイマー表示
    if (mainTimerDisplay && settings.showMainTimer) {
        mainTimerDisplay.textContent = formatSecondsToMMSS(info.displayTime);
        mainTimerDisplay.style.display = 'flex';
    } else if (mainTimerDisplay) {
        mainTimerDisplay.style.display = 'none';
    }
    
    // サブ情報表示の完全修正
    updateSubDisplay(info);
    updateControlButtons();
}

function updateSubDisplay(info) {
    let remainingText = "";
    let nextText = "";
    
    // 表示文字列の確実な生成
    if (info.isInterval) {
        remainingText = `インターバル: ${formatSecondsToMMSS(info.displayTime)}`;
    } else if (settings.globalTimerType === 'countdown') {
        // カウントダウンではメインタイマーで残り時間を表示しているため、サブでは経過時間のみ
        remainingText = `経過 ${formatSecondsToMMSS(info.elapsedTime)}`;
    } else { // countup
        // カウントアップではメインタイマーで経過時間を表示しているため、サブでは制限時間のみ
        if (info.timer.duration > 0) {
            remainingText = `制限 ${formatSecondsToMMSS(info.timer.duration)}`;
        } else {
            remainingText = `無制限`; // 制限がない場合は無制限と表示
        }
    }
    
    // 次の予定表示でタイマー名を明確に表示
    if (info.timer.interval > 0 && !info.isInterval) {
        nextText = `次インターバル: ${formatSecondsToMMSS(info.timer.interval)}`;
    } else if (timerState.currentIndex + 1 < settings.timers.length) {
        const nextTimer = settings.timers[timerState.currentIndex + 1];
        nextText = `次: ${nextTimer.name}`; // タイマー名を反映 
    } else {
        nextText = "最終タイマー";
    }
    
    // DOM更新の確実な実行
    if (remainingTimeDisplay) {
        remainingTimeDisplay.textContent = remainingText;
        remainingTimeDisplay.style.display = settings.showRemainingTimeDisplay ? 'block' : 'none';
        remainingTimeDisplay.style.visibility = settings.showRemainingTimeDisplay ? 'visible' : 'hidden';
        remainingTimeDisplay.style.opacity = settings.showRemainingTimeDisplay ? '1' : '0';
    }
    
    if (nextTimerDisplay) {
        nextTimerDisplay.textContent = nextText;
        nextTimerDisplay.style.display = settings.showIntervalTimeDisplay ? 'block' : 'none';
        nextTimerDisplay.style.visibility = settings.showIntervalTimeDisplay ? 'visible' : 'hidden';
        nextTimerDisplay.style.opacity = settings.showIntervalTimeDisplay ? '1' : '0';
    }
    
    if (subTimerInfo) {
        const showSub = settings.showRemainingTimeDisplay || settings.showIntervalTimeDisplay;
        subTimerInfo.style.display = showSub ? 'block' : 'none';
        subTimerInfo.style.visibility = showSub ? 'visible' : 'hidden';
        subTimerInfo.style.opacity = showSub ? '1' : '0';
    }
}

function updateClockDisplay() {
    document.body.classList.add('clock-mode');
    if (mainTimerDisplay) {
        mainTimerDisplay.textContent = formatClock(new Date());
    }
    if (personCounterContainer) {
        personCounterContainer.style.display = 'none';
    }
    if (subTimerInfo) {
        subTimerInfo.style.display = 'none';
    }
    removeVisualWarningClasses(); // 時計モードでは警告は不要
    lastAppliedVisualLevel = null; // 【修正】
}

function showNoTimerState() {
    document.body.classList.remove('clock-mode');
    
    if (personCounterContainer) {
        personCounterContainer.style.display = settings.showPersonCounter ? 'flex' : 'none';
    }
    if (personCountDisplay) {
        personCountDisplay.textContent = '1';
    }
    if (personLabelDisplay) {
        personLabelDisplay.textContent = settings.personCounterLabel;
    }
    
    if (mainTimerDisplay) {
        mainTimerDisplay.textContent = "00:00";
        mainTimerDisplay.style.display = settings.showMainTimer ? 'flex' : 'none';
    }
    
    if (remainingTimeDisplay) {
        remainingTimeDisplay.textContent = "タイマー設定なし";
        remainingTimeDisplay.style.display = settings.showRemainingTimeDisplay ? 'block' : 'none';
    }
    
    if (nextTimerDisplay) {
        nextTimerDisplay.textContent = "";
        nextTimerDisplay.style.display = settings.showIntervalTimeDisplay ? 'block' : 'none';
    }
    
    if (subTimerInfo) {
        const showSub = settings.showRemainingTimeDisplay || settings.showIntervalTimeDisplay;
        subTimerInfo.style.display = showSub ? 'block' : 'none';
    }
    removeVisualWarningClasses(); // タイマーがない場合も警告は不要
    lastAppliedVisualLevel = null; // 【修正】
}

function updateControlButtons() {
    const hasTimers = settings.timers && settings.timers.length > 0;
    const isTimerRunningOrInterval = timerState.phase === 'running' || timerState.phase === 'interval';
    const isTimerPaused = timerState.phase === 'paused';
    const isTimerStopped = timerState.phase === 'stopped';

    let canSkip = false;
    // スキップボタンの活性化ロジック
    if (hasTimers) {
        if (isTimerRunningOrInterval) {
            const currentTimer = settings.timers[timerState.currentIndex];
            // null チェック追加
            if (currentTimer && (currentTimer.interval > 0 || timerState.currentIndex < settings.timers.length - 1)) {
                canSkip = true; // 実行中かつインターバルがあるか、次のタイマーがある場合
            }
        } else if (isTimerStopped || isTimerPaused) {
            // 停止中または一時停止中の場合、次のタイマーが存在すればスキップ可能
            if (timerState.currentIndex < settings.timers.length - 1) {
                canSkip = true;
            } else if (isTimerPaused) {
                const currentTimer = settings.timers[timerState.currentIndex];
                if (currentTimer && currentTimer.interval > 0) {
                    canSkip = true;
                }
            }
        }
    }


    if (settings.isClockMode) {
        // null チェック追加
        if (startBtn) startBtn.disabled = true;
        if (pauseBtn) pauseBtn.disabled = true;
        if (resetBtn) resetBtn.disabled = true;
        if (skipBtn) skipBtn.disabled = true;
    } else {
        if (startBtn) {
            startBtn.disabled = !hasTimers || isTimerRunningOrInterval; // 実行中/インターバル中なら無効
            startBtn.textContent = isTimerPaused ? '再開' : 'スタート'; // 一時停止中なら「再開」
        }
        if (pauseBtn) pauseBtn.disabled = !hasTimers || !isTimerRunningOrInterval; // 実行中/インターバル中のみ有効
        if (resetBtn) resetBtn.disabled = !hasTimers || isTimerStopped; // 停止状態なら無効
        if (skipBtn) skipBtn.disabled = !hasTimers || !canSkip;
    }
    
    // タイマーが全く設定されていない場合、全ての操作ボタンを無効化
    if (!hasTimers) {
        if (startBtn) startBtn.disabled = true;
        if (pauseBtn) pauseBtn.disabled = true;
        if (resetBtn) resetBtn.disabled = true;
        if (skipBtn) skipBtn.disabled = true;
    }
}

// === Clock Mode ===
function enterClockMode() {
    pauseTimer();
    clearInterval(timerIntervalId);
    timerIntervalId = null;

    if (clockIntervalId) clearInterval(clockIntervalId);
    clockIntervalId = setInterval(() => {
        updateDisplay();
    }, 1000);

    document.body.classList.add('clock-mode');
    updateDisplay();
}

function exitClockMode() {
    clearInterval(clockIntervalId);
    clockIntervalId = null;
    document.body.classList.remove('clock-mode');
    updateDisplay();
    updateControlButtons();
}

// === 音声制御（Web Audio API統合版） ===
function playBGM() {
    if (settings.soundEnabled && settings.bgmEnabled && bgmAudio && bgmAudio.src) {
        bgmAudio.pause();
        bgmAudio.currentTime = 0;
        bgmAudio.play().catch(e => console.error("BGM再生エラー:", e));
    }
}

function stopBGM() {
    if (bgmAudio) {
        bgmAudio.pause();
        bgmAudio.currentTime = 0;
    }
}

function playAlarm() {
    initWebAudio();
    
    if (settings.soundEnabled && settings.alarmEnabled) {
        // ユーザー音源が設定されている場合はそれを使用
        if (alarmAudio && alarmAudio.src && settings.alarmFile) {
            alarmAudio.currentTime = 0;
            alarmAudio.play().catch(e => {
                console.warn("ユーザーアラーム音再生エラー、内蔵音源にフォールバック:", e);
                if (settings.webAudioEnabled) generateAlarm(1200);
            });
        } else if (settings.webAudioEnabled) {
            // ユーザー音源がない場合は内蔵音源を使用
            generateAlarm(1200);
        }
    }
}

function playIntervalSound() {
    initWebAudio();
    
    if (settings.soundEnabled && settings.intervalSoundEnabled) {
        // ユーザー音源が設定されている場合はそれを使用
        if (intervalAudio && intervalAudio.src && settings.intervalFile) {
            intervalAudio.currentTime = 0;
            intervalAudio.play().catch(e => {
                console.warn("ユーザーインターバル音再生エラー、内蔵音源にフォールバック:", e);
                if (settings.webAudioEnabled) generateIntervalSound(600);
            });
        } else if (settings.webAudioEnabled) {
            // ユーザー音源がない場合は内蔵音源を使用
            generateIntervalSound(600);
        }
    }
}

function playShortBeep() {
    initWebAudio();
    
    if (settings.soundEnabled && settings.beepWarningEnabled) {
        // ユーザー音源が設定されている場合はそれを使用
        if (shortBeepAudio && shortBeepAudio.src && settings.shortBeepFile) {
            shortBeepAudio.currentTime = 0;
            shortBeepAudio.play().catch(e => {
                console.warn("ユーザービープ音再生エラー、内蔵音源にフォールバック:", e);
                if (settings.webAudioEnabled) generateBeep(800, 150, 0.3);
            });
        } else if (settings.webAudioEnabled) {
            // ユーザー音源がない場合は内蔵音源を使用
            generateBeep(800, 150, 0.3);
        }
    }
}

// === Utility Functions ===
function formatSecondsToMMSS(totalSeconds) {
    totalSeconds = Math.max(0, Math.round(totalSeconds));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function parseMMSS(mmssString) {
    const parts = mmssString.split(':');
    if (parts.length === 2) {
        const minutes = parseInt(parts[0], 10);
        const seconds = parseInt(parts[1], 10);
        if (!isNaN(minutes) && !isNaN(seconds)) {
            return (minutes * 60) + seconds;
        }
    }
    return NaN;
}

function formatClock(date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function updateBackgroundImage() {
    if (settings.backgroundImage) {
        document.body.style.backgroundImage = `url('images/${settings.backgroundImage}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
    } else {
        document.body.style.backgroundImage = 'none';
    }
}