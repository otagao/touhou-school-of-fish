// ユーティリティのインポート
const fileUtils = require('./utils/fileUtils.js');
const songUtils = require('./utils/songUtils.js');

// モードのインポート
const { ListeningMode } = require('./modes/listening-mode.js');
const { QuizMode } = require('./modes/quiz-mode.js');
const { SettingsMode } = require('./modes/settings-mode.js');

// グローバル変数
let musicDirectory = '';
let csvFilePath = '';
let songData = [];
let isMusicDirSet = false;
let recognitionMode = 'path-first'; // 認識モード（パス優先/ハッシュ優先）

// モードインスタンス
let listeningMode = null;
let quizMode = null;
let settingsMode = null;


// DOMが読み込まれたら実行
document.addEventListener('DOMContentLoaded', () => {
  // 認識モード設定の読み込み
  const savedMode = localStorage.getItem('recognitionMode');
  if (savedMode) {
    recognitionMode = savedMode;
  }
  // 初期設定画面のドロップダウンにも反映
  const setupModeSelect = document.getElementById('recognitionModeSetup');
  if (setupModeSelect) {
    setupModeSelect.value = recognitionMode;
  }

  // 初期設定画面のイベントリスナー
  document.getElementById('selectMusicDir').addEventListener('click', selectMusicDirectory);
  document.getElementById('selectCsvFile').addEventListener('click', selectCsvFile);
  document.getElementById('startApp').addEventListener('click', startApplication);

  // モード切り替えボタン
  document.getElementById('listeningModeBtn').addEventListener('click', () => switchMode('listeningMode'));
  document.getElementById('quizModeBtn').addEventListener('click', () => switchMode('quizMode'));
  document.getElementById('settingsBtn').addEventListener('click', () => switchMode('settings'));
});

// ディレクトリ選択処理
async function selectMusicDirectory() {
  const dirPath = await window.electronAPI.openDirectoryDialog();
  if (dirPath) {
    musicDirectory = dirPath;
    document.getElementById('musicDirPath').value = dirPath;
    checkStartConditions();
  }
}

// CSVファイル選択処理
async function selectCsvFile() {
  const filePath = await window.electronAPI.openFileDialog({
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });
  if (filePath) {
    csvFilePath = filePath;
    document.getElementById('csvFilePath').value = filePath;
    checkStartConditions();
  }
}

// 開始条件のチェック
function checkStartConditions() {
  const startButton = document.getElementById('startApp');
  startButton.disabled = !csvFilePath;
}

// アプリケーション開始
async function startApplication() {
  try {
    console.log('[renderer.js] アプリケーション開始処理を開始します');

    // 初期設定画面で選択された認識モードを取得して保存
    const setupModeSelect = document.getElementById('recognitionModeSetup');
    if (setupModeSelect) {
      recognitionMode = setupModeSelect.value;
      localStorage.setItem('recognitionMode', recognitionMode);
      console.log(`[renderer.js] 認識モードを保存: ${recognitionMode}`);
    }

    // musicDirectory が設定されているかどうかのフラグを更新
    isMusicDirSet = !!musicDirectory; // musicDirectoryが空文字列でなければ true
    console.log(`[renderer.js] 音楽ディレクトリ設定状態: ${isMusicDirSet}`);
    console.log('[renderer.js] CSVファイルパス:', csvFilePath);

    // --- CSVファイルの読み込みとパース (必須処理) ---
    console.log('[renderer.js] CSVファイルの読み込みを開始...');
    const csvContent = await window.electronAPI.readFile(csvFilePath);
    if (!csvContent) {
      console.error('[renderer.js] CSVファイルの読み込みに失敗しました');
      alert('CSVファイルの読み込みに失敗しました。');
      return;
    }
    console.log('[renderer.js] CSVファイルの読み込み成功。');

    console.log('[renderer.js] CSVデータのパースを開始...');
    parseSongData(csvContent); // songData が設定される
    window.songData = songData; // デバッグ機能用にグローバルに公開
    console.log(`[renderer.js] CSVパース完了。${songData.length}曲のデータを読み込みました`);
    if (songData.length === 0) {
        alert('CSVファイルから有効な楽曲データを読み込めませんでした。');
        return; // 楽曲データがない場合はここで終了
    }

    // --- 音楽ファイルの処理 (musicDirectory が設定されている場合のみ) ---
    let audioFiles = []; // デフォルトは空配列
    if (isMusicDirSet) {
      console.log('[renderer.js] 音楽ファイル一覧の取得を開始 (ディレクトリ指定あり)...');
      console.log('[renderer.js] 音楽ディレクトリ:', musicDirectory);
      try {
          audioFiles = await window.electronAPI.getFilesInDirectory(musicDirectory, ['.mp3', '.wav', '.flac']);
          console.log(`[renderer.js] 音楽ファイル一覧取得完了。${audioFiles.length}個のファイルを検出`);

          if (audioFiles.length === 0) {
              console.warn('[renderer.js] 指定されたディレクトリに音楽ファイルが見つかりませんでした。');
              // ファイルが見つからなくても処理は続行する（マッチング処理で fileExists が false になる）
              alert('指定されたディレクトリに音楽ファイルが見つかりませんでした。\nリストは表示されますが、再生はできません。');
          }

          // ファイル名と楽曲データをマッチング
          console.log('[renderer.js] ファイルと楽曲データのマッチングを開始...');

          // プログレスバー表示
          const progressContainer = document.getElementById('recognitionProgress');
          const progressText = document.getElementById('recognitionProgressText');
          const progressBar = document.getElementById('recognitionProgressBar');
          progressContainer.classList.remove('hidden');

          await matchSongsWithFiles(audioFiles, (current, total) => {
            // プログレスバーを更新
            progressText.textContent = `${current}/${total}`;
            progressBar.value = (current / total) * 100;
          });

          // プログレスバーを非表示
          progressContainer.classList.add('hidden');

          window.songData = songData; // デバッグ機能用に更新

      } catch (error) {
           console.error(`[renderer.js] 音楽ディレクトリ処理中にエラー: ${error.message}`);
           alert(`音楽ディレクトリの処理中にエラーが発生しました: ${error.message}\nリストは表示されますが、再生機能に問題がある可能性があります。`);
           // エラーが発生しても、CSVデータがあればリスト表示は試みる
           // そのため、マッチング処理はスキップし、全曲 fileExists=false 扱いにする
           songData.forEach(song => {
               song.filePath = '';
               song.fileExists = false;
           });
      }
    } else {
      console.log('[renderer.js] 音楽ディレクトリが指定されていないため、ファイル検索とマッチングをスキップします。');
      // musicDirectory が未指定の場合、全曲の filePath と fileExists を初期化
      songData.forEach(song => {
        song.filePath = '';
        song.fileExists = false;
      });
    }

    // --- UIの更新 ---
    console.log('[renderer.js] UIを切り替えます');
    document.getElementById('setupPanel').classList.add('hidden');
    document.getElementById('mainPanel').classList.remove('hidden');

    console.log('[renderer.js] 聴取モードを表示します');
    switchMode('listeningMode'); // デフォルトで聴取モードを表示

    console.log('[renderer.js] アプリケーション開始処理が完了しました');

  } catch (error) {
    console.error('[renderer.js] アプリケーション開始エラー:', error);
    alert(`アプリケーションの開始に失敗しました。\nエラー: ${error.message}`);
    // エラー発生時は初期設定画面に戻すなどの処理が必要かもしれない
    // document.getElementById('setupPanel').classList.remove('hidden');
    // document.getElementById('mainPanel').classList.add('hidden');
  }
}

// CSVデータのパース処理
/**
 * CSV行をパースして値の配列を返す
 * JSON配列形式（["value1", "value2"]）を含むセルに対応
 * @param {string} line CSV行
 * @returns {string[]} パースされた値の配列
 */
function parseSongData(csvContent) {
  try {
    // songUtils.jsの関数を使用してCSVをパース
    const platform = window.electronAPI ? window.electronAPI.platform : 'win32';
    songData = songUtils.parseSongDataFromCsv(csvContent, platform);
  } catch (error) {
    console.error('[renderer.js] CSVパースエラー:', error);
    throw new Error(`CSVパースエラー: ${error.message}`);
  }
}

// 楽曲データとファイルのマッチング
async function matchSongsWithFiles(audioFiles, progressCallback = null) {
  try {
    // songUtils.jsの関数を使用してファイルマッチングを実行（認識モード付き）
    songData = await songUtils.matchSongsWithFiles(songData, audioFiles, musicDirectory, recognitionMode, progressCallback);
  } catch (error) {
    console.error('[renderer.js] ファイルマッチングエラー:', error);
    alert(`ファイルのマッチング処理中にエラーが発生しました: ${error.message}`);
    throw new Error(`ファイルマッチングエラー: ${error.message}`);
  }
}

// モード切り替え
function switchMode(mode) {
  // すべてのモードパネルを非表示に
  document.getElementById('listeningModePanel').classList.add('hidden');
  document.getElementById('quizModePanel').classList.add('hidden');
  document.getElementById('settingsPanel').classList.add('hidden');

  // 聴取モードのクリーンアップ
  if (listeningMode && mode !== 'listeningMode') {
    listeningMode.cleanup();
    listeningMode = null;
  }

  // 演習モードのクリーンアップ
  if (quizMode && mode !== 'quizMode') {
    quizMode.cleanup();
    quizMode = null;
  }

  // 設定モードのクリーンアップ
  if (settingsMode && mode !== 'settings') {
    settingsMode.cleanup();
    settingsMode = null;
  }

  // 選択されたモードを表示
  if (mode === 'listeningMode') {
    document.getElementById('listeningModePanel').classList.remove('hidden');
    // ListeningModeを初期化
    listeningMode = new ListeningMode(songData, isMusicDirSet);
    listeningMode.initialize();
  } else if (mode === 'quizMode') {
    document.getElementById('quizModePanel').classList.remove('hidden');
    // QuizModeを初期化
    quizMode = new QuizMode(songData, isMusicDirSet);
    quizMode.initialize();
  } else if (mode === 'settings') {
    document.getElementById('settingsPanel').classList.remove('hidden');
    // SettingsModeを初期化（認識モード付き）
    settingsMode = new SettingsMode(musicDirectory, csvFilePath, handleApplySettings, recognitionMode);
    settingsMode.initialize();
  }
}

// 設定適用時のコールバック関数
function handleApplySettings(newMusicDir, newCsvPath) {
  musicDirectory = newMusicDir;
  csvFilePath = newCsvPath;
  startApplication();
}

