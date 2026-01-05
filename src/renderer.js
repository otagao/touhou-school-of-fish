// ユーティリティのインポート
const fileUtils = require('./utils/fileUtils.js');
const songUtils = require('./utils/songUtils.js');

// モードのインポート
const { ListeningMode } = require('./modes/listening-mode.js');

// グローバル変数
let musicDirectory = '';
let csvFilePath = '';
let songData = [];
let isMusicDirSet = false;

// モードインスタンス
let listeningMode = null;

// クイズ関連のグローバル変数
let quizState = {
  isActive: false,
  currentQuestionIndex: 0,
  availableSongs: [],
  usedSongs: [],
  correctAnswers: 0,
  totalQuestions: 0,
  questionStartTime: null,
  responseTimes: [],
  currentQuizSong: null,
  quizAudioPlayer: null
};


// DOMが読み込まれたら実行
document.addEventListener('DOMContentLoaded', () => {
  // 初期設定画面のイベントリスナー
  document.getElementById('selectMusicDir').addEventListener('click', selectMusicDirectory);
  document.getElementById('selectCsvFile').addEventListener('click', selectCsvFile);
  document.getElementById('startApp').addEventListener('click', startApplication);
  
  // モード切り替えボタン
  document.getElementById('listeningModeBtn').addEventListener('click', () => switchMode('listeningMode'));
  document.getElementById('quizModeBtn').addEventListener('click', () => switchMode('quizMode'));
  document.getElementById('settingsBtn').addEventListener('click', () => switchMode('settings'));

  // 演習モードのイベントリスナー
  document.getElementById('startQuizBtn').addEventListener('click', startQuiz);
  document.getElementById('submitAnswerBtn').addEventListener('click', submitAnswer);
  document.getElementById('nextQuestionBtn').addEventListener('click', nextQuestion);
  document.getElementById('stopQuizBtn').addEventListener('click', stopQuiz);
  
  // 解答用テキストボックスでEnterキーを押した時の処理
  document.getElementById('answerText').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitAnswer();
    }
  });
  
  // 演習モードの音量スライダー
  document.getElementById('quizVolumeSlider').addEventListener('input', adjustQuizVolume);
  
  // 回答方式の変更イベント
  document.getElementById('answerMode').addEventListener('change', updateQuizStartButtonForAnswerMode);
  
  // 設定画面のイベントリスナー
  document.getElementById('selectMusicDirSettings').addEventListener('click', selectMusicDirectorySettings);
  document.getElementById('selectCsvFileSettings').addEventListener('click', selectCsvFileSettings);
  document.getElementById('applySettingsBtn').addEventListener('click', applySettings);
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
          matchSongsWithFiles(audioFiles); // audioFiles が空でも動作する想定

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

    // 演習モード用のフィルターも初期化しておく
    renderQuizFilterControls();
    updateQuizSongCounts();

    // 設定画面の値を更新
    document.getElementById('musicDirPathSettings').value = musicDirectory; // 空の場合もある
    document.getElementById('csvFilePathSettings').value = csvFilePath;
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
function matchSongsWithFiles(audioFiles) {
  try {
    // songUtils.jsの関数を使用してファイルマッチングを実行
    songData = songUtils.matchSongsWithFiles(songData, audioFiles, musicDirectory);
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

  // 演習モードから他のモードに切り替える場合、クイズを中止
  if (quizState.isActive && mode !== 'quizMode') {
    console.log('[Quiz] モード切り替えによりクイズを中止します');
    quizState.isActive = false;
    cleanupQuizAudioPlayer();
    // クイズのUIも初期状態に戻す
    document.getElementById('quizContainer').classList.add('hidden');
    document.getElementById('quizResult').classList.add('hidden');
    document.getElementById('nextQuestionBtn').style.display = 'none';
    document.getElementById('submitAnswerBtn').disabled = false;
    document.getElementById('answerText').disabled = false;
    document.getElementById('answerText').value = '';
  }

  // 選択されたモードを表示
  if (mode === 'listeningMode') {
    document.getElementById('listeningModePanel').classList.remove('hidden');
    // ListeningModeを初期化
    listeningMode = new ListeningMode(songData, isMusicDirSet);
    listeningMode.initialize();
  } else if (mode === 'quizMode') {
    document.getElementById('quizModePanel').classList.remove('hidden');
    prepareQuizMode();
  } else if (mode === 'settings') {
    document.getElementById('settingsPanel').classList.remove('hidden');
  }
}

// クイズモードの準備
function prepareQuizMode() {
  // 回答方式をリセット
  document.getElementById('answerMode').value = 'exact';

  // クイズコンテナを非表示に
  document.getElementById('quizContainer').classList.add('hidden');
  document.getElementById('quizResult').classList.add('hidden');

  // 各種UIをリセット
  const answerInput = document.getElementById('answerText');
  const submitBtn = document.getElementById('submitAnswerBtn');
  const nextBtn = document.getElementById('nextQuestionBtn');

  answerInput.value = '';
  answerInput.disabled = false;
  submitBtn.disabled = false;
  nextBtn.style.display = 'none';

  // 演習モード用の絞り込みフィルターを描画
  renderQuizFilterControls();

  // 楽曲数をリアルタイム更新
  updateQuizSongCounts();

  // 回答方式に基づいてボタン状態を更新
  updateQuizStartButtonForAnswerMode();
}

// クイズを開始
function startQuiz() {
  console.log('[Quiz] クイズを開始します');
  
  // 再生可能な楽曲を取得
  const filteredSongs = filterQuizSongsInternal();
  const availableSongs = filteredSongs.filter(song => isMusicDirSet && song.fileExists);
  
  if (availableSongs.length === 0) {
    alert('再生可能な楽曲がありません。音楽ディレクトリの設定や絞り込み条件を確認してください。');
    return;
  }
  
  // クイズ状態を初期化
  quizState = {
    isActive: true,
    currentQuestionIndex: 0,
    availableSongs: [...availableSongs], // コピーを作成
    usedSongs: [],
    correctAnswers: 0,
    totalQuestions: 0,
    questionStartTime: null,
    responseTimes: [],
    currentQuizSong: null,
    quizAudioPlayer: null
  };
  
  console.log(`[Quiz] ${availableSongs.length}曲が出題対象です`);

  // UIを出題モードに切り替え
  document.getElementById('quizContainer').classList.remove('hidden');
  document.getElementById('quizResult').classList.add('hidden');
  document.getElementById('nextQuestionBtn').style.display = 'none';

  // 回答UIを初期化（念のため）
  const answerInput = document.getElementById('answerText');
  const submitBtn = document.getElementById('submitAnswerBtn');
  answerInput.value = '';
  answerInput.disabled = false;
  submitBtn.disabled = false;

  // 最初の問題を出題
  presentNextQuestion();
}

/**
 * 次の問題を出題する
 */
function presentNextQuestion() {
  if (!quizState.isActive) {
    console.log('[Quiz] クイズが非アクティブなため出題を中止します');
    return;
  }
  
  // 未使用の楽曲がない場合はクイズ終了
  if (quizState.availableSongs.length === 0) {
    console.log('[Quiz] 全ての楽曲を出題しました。クイズを終了します');
    endQuiz();
    return;
  }
  
  // ランダムに楽曲を選出
  const randomIndex = Math.floor(Math.random() * quizState.availableSongs.length);
  const selectedSong = quizState.availableSongs.splice(randomIndex, 1)[0];
  
  quizState.currentQuizSong = selectedSong;
  quizState.currentQuestionIndex++;
  quizState.totalQuestions++;
  
  console.log(`[Quiz] 問題${quizState.currentQuestionIndex}: ${selectedSong.title}`);
  
  // UIを更新
  updateQuizUI();

  // 解答用テキストボックスをクリアして有効化
  const answerInput = document.getElementById('answerText');
  answerInput.value = '';
  answerInput.disabled = false;

  // 回答ボタンを有効化
  document.getElementById('submitAnswerBtn').disabled = false;

  // 音楽を読み込み（これは非同期処理）
  loadQuizSong(selectedSong);

  // 時間計測開始
  quizState.questionStartTime = Date.now();

  // フォーカスを設定（多段階で確実にフォーカスする）
  // 1. Electronウィンドウ自体にフォーカスを設定（メインプロセス経由）
  if (window.electronAPI && window.electronAPI.focusWindow) {
    window.electronAPI.focusWindow().catch(err => {
      console.warn('[Quiz] ウィンドウフォーカス設定エラー:', err);
    });
  }

  // 2. まず即座にフォーカスを試みる
  if (answerInput && !answerInput.disabled) {
    answerInput.focus();
  }

  // 3. requestAnimationFrameで再度フォーカスを設定（Electron環境での確実性向上）
  requestAnimationFrame(() => {
    if (quizState.isActive && quizState.currentQuizSong === selectedSong) {
      const input = document.getElementById('answerText');
      if (input && !input.disabled) {
        input.focus();
        // さらにsetTimeoutで最終確認（Electronのウィンドウフォーカス問題対策）
        setTimeout(() => {
          if (quizState.isActive && quizState.currentQuizSong === selectedSong) {
            const finalInput = document.getElementById('answerText');
            if (finalInput && !finalInput.disabled && document.activeElement !== finalInput) {
              finalInput.focus();
              console.log('[Quiz] 入力欄に遅延フォーカスを設定しました');
            }
          }
        }, 50);
        console.log('[Quiz] 入力欄にフォーカスを設定しました');
      }
    }
  });
}

/**
 * クイズUIを更新する
 */
function updateQuizUI() {
  // 出題可能な総楽曲数は、使用済み + 未使用 + 現在出題中の1曲
  const totalAvailable = quizState.usedSongs.length + quizState.availableSongs.length + 1;
  document.getElementById('currentQuestion').textContent = 
    `問題 ${quizState.currentQuestionIndex} / ${totalAvailable}`;
}

/**
 * クイズ用楽曲を読み込み、自動再生する
 */
function loadQuizSong(song) {
  // クイズが非アクティブの場合は何もしない
  if (!quizState.isActive) {
    console.log('[Quiz] クイズが非アクティブのため、楽曲読み込みを中止します');
    return;
  }
  
  // 既存のプレーヤーをクリーンアップ
  cleanupQuizAudioPlayer();
  
  if (!song.filePath || !song.fileExists) {
    console.error('[Quiz] 楽曲ファイルが存在しません:', song.filename);
    return;
  }
  
  try {
    console.log(`[Quiz] 楽曲を読み込み中: ${song.filePath}`);
    quizState.quizAudioPlayer = new Audio(song.filePath);
    
    // 音量をスライダーの値に合わせて設定
    const volume = document.getElementById('quizVolumeSlider').value / 100;
    quizState.quizAudioPlayer.volume = volume;
    
    // 読み込み完了時のイベントリスナー
    const onLoadedMetadata = () => {
      console.log('[Quiz] 楽曲の読み込み完了');
      // 再度アクティブ状態をチェック
      if (quizState.isActive && quizState.quizAudioPlayer) {
        console.log('[Quiz] 自動再生を開始');
        quizState.quizAudioPlayer.play().catch(e => {
          console.error('[Quiz] 自動再生エラー:', e);
          // クイズがアクティブな場合のみエラーメッセージを表示
          if (quizState.isActive) {
            alert(`楽曲の再生に失敗しました: ${e.message}`);
          }
        });
      }
    };
    
    // エラー時のイベントリスナー
    const onError = (e) => {
      console.error('[Quiz] 楽曲の読み込みエラー:', e);
      // クイズがアクティブな場合のみエラーメッセージを表示
      if (quizState.isActive) {
        alert('楽曲の読み込みに失敗しました。');
      }
    };
    
    // イベントリスナーを保存（後で削除するため）
    quizState.quizAudioPlayer._onLoadedMetadata = onLoadedMetadata;
    quizState.quizAudioPlayer._onError = onError;
    
    quizState.quizAudioPlayer.addEventListener('loadedmetadata', onLoadedMetadata);
    quizState.quizAudioPlayer.addEventListener('error', onError);
    
    // 最終的にアクティブ状態を再チェックして読み込み開始
    if (quizState.isActive) {
      quizState.quizAudioPlayer.load();
    } else {
      console.log('[Quiz] 読み込み開始前にクイズが非アクティブになったため中止');
      cleanupQuizAudioPlayer();
    }
  } catch (error) {
    console.error('[Quiz] 楽曲の読み込み中にエラーが発生:', error);
    // クイズがアクティブな場合のみエラーメッセージを表示
    if (quizState.isActive) {
      alert(`楽曲の読み込み中にエラーが発生しました: ${error.message}`);
    }
  }
}

/**
 * クイズ用オーディオプレーヤーをクリーンアップする
 */
function cleanupQuizAudioPlayer() {
  if (quizState.quizAudioPlayer) {
    // 保存されたイベントリスナー関数を使って正しく削除
    if (quizState.quizAudioPlayer._onLoadedMetadata) {
      quizState.quizAudioPlayer.removeEventListener('loadedmetadata', quizState.quizAudioPlayer._onLoadedMetadata);
    }
    if (quizState.quizAudioPlayer._onError) {
      quizState.quizAudioPlayer.removeEventListener('error', quizState.quizAudioPlayer._onError);
    }
    
    quizState.quizAudioPlayer.pause();
    quizState.quizAudioPlayer.src = '';
    quizState.quizAudioPlayer = null;
    console.log('[Quiz] オーディオプレーヤーをクリーンアップしました');
  }
}


// クイズの回答を提出
function submitAnswer() {
  if (!quizState.isActive || !quizState.currentQuizSong) {
    console.warn('[Quiz] クイズがアクティブでないか、現在の問題がありません');
    return;
  }
  
  const userAnswer = document.getElementById('answerText').value.trim();
  if (!userAnswer) {
    // 空の場合は何もせず、入力欄にフォーカスを戻す
    const answerInput = document.getElementById('answerText');
    answerInput.focus();
    return;
  }
  
  // 時間計測終了
  const responseTime = Date.now() - quizState.questionStartTime;
  quizState.responseTimes.push(responseTime);
  
  console.log(`[Quiz] ユーザー回答: "${userAnswer}", 正解: "${quizState.currentQuizSong.title}", 回答時間: ${responseTime}ms`);

  try {
    // Song.matchesAnswer()を使用して完全一致モードで判定
    const isCorrect = quizState.currentQuizSong.matchesAnswer(userAnswer, 'exact');

    if (isCorrect) {
      quizState.correctAnswers++;
      console.log('[Quiz] 正解!');
    } else {
      console.log('[Quiz] 不正解');
    }

    // 結果を表示
    showQuestionResult(isCorrect, userAnswer, responseTime);

    // 使用済み楽曲に追加
    quizState.usedSongs.push(quizState.currentQuizSong);
  } catch (error) {
    console.error('[Quiz] 回答判定中にエラーが発生:', error);
    alert(`回答の判定中にエラーが発生しました: ${error.message}`);
  }
}

/**
 * 問題の結果を表示
 */
function showQuestionResult(isCorrect, userAnswer, responseTime) {
  const resultContainer = document.getElementById('quizResult');
  const resultStatus = document.getElementById('resultStatus');
  const correctAnswer = document.getElementById('correctAnswer');
  const songDetails = document.getElementById('songDetails');
  
  // 結果ステータスを表示
  if (isCorrect) {
    resultStatus.textContent = '正解！';
    resultStatus.style.color = '#4caf50';
  } else {
    resultStatus.textContent = '不正解';
    resultStatus.style.color = '#f44336';
  }
  
  // 正解と回答時間を表示
  const timeInSeconds = (responseTime / 1000).toFixed(1);

  // タイトルが配列の場合は最初の要素またはカンマ区切りで表示
  const titleDisplay = Array.isArray(quizState.currentQuizSong.title)
    ? quizState.currentQuizSong.title.join(', ')
    : quizState.currentQuizSong.title;

  correctAnswer.innerHTML = `
    <strong>正解:</strong> ${titleDisplay}<br>
    <strong>あなたの回答:</strong> ${userAnswer}<br>
    <strong>回答時間:</strong> ${timeInSeconds}秒
  `;

  // 楽曲詳細情報を表示
  const song = quizState.currentQuizSong;

  // 全ての属性が配列の可能性があるため、配列の場合は文字列に変換
  const typeDisplay = Array.isArray(song.type) ? song.type.join(', ') : song.type;
  const generationDisplay = Array.isArray(song.generation) ? song.generation.join(', ') : song.generation;
  const gameDisplay = Array.isArray(song.game) ? song.game.join(', ') : song.game;
  const stageDisplay = Array.isArray(song.stage) ? song.stage.join(', ') : song.stage;
  const characterDisplay = Array.isArray(song.character) ? song.character.join(', ') : song.character;

  const details = [
    { label: 'タイプ', value: typeDisplay },
    { label: 'シリーズ区分', value: generationDisplay },
    { label: '作品名', value: gameDisplay },
    { label: '場面', value: stageDisplay },
    { label: 'キャラクター', value: characterDisplay }
  ].filter(detail => detail.value && detail.value.toString().trim() !== '');

  songDetails.innerHTML = details.map(detail =>
    `<div><span style="font-weight: bold;">${detail.label}:</span> ${detail.value}</div>`
  ).join('');
  
  // 結果を表示
  resultContainer.classList.remove('hidden');
  
  // 次の問題ボタンを有効化
  document.getElementById('nextQuestionBtn').style.display = 'inline-block';
  
  // 解答ボタンを無効化
  document.getElementById('submitAnswerBtn').disabled = true;
  document.getElementById('answerText').disabled = true;
}

// 次の問題へ進む
function nextQuestion() {
  if (!quizState.isActive) {
    return;
  }

  // 現在の楽曲を完全に停止・クリーンアップ
  cleanupQuizAudioPlayer();
  console.log('[Quiz] 次の問題に進むため、現在の楽曲を停止しました');

  // 結果表示を非表示
  document.getElementById('quizResult').classList.add('hidden');
  document.getElementById('nextQuestionBtn').style.display = 'none';

  // 解答エリアを再有効化
  const answerInput = document.getElementById('answerText');
  const submitBtn = document.getElementById('submitAnswerBtn');
  answerInput.disabled = false;
  submitBtn.disabled = false;

  // 次の問題を出題（自動再生される）
  presentNextQuestion();
}


// 設定画面でのディレクトリ選択
async function selectMusicDirectorySettings() {
  const dirPath = await window.electronAPI.openDirectoryDialog();
  if (dirPath) {
    document.getElementById('musicDirPathSettings').value = dirPath;
  }
}

// 設定画面でのCSVファイル選択
async function selectCsvFileSettings() {
  const filePath = await window.electronAPI.openFileDialog({
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });
  if (filePath) {
    document.getElementById('csvFilePathSettings').value = filePath;
  }
}

// 設定を適用
function applySettings() {
  const newMusicDir = document.getElementById('musicDirPathSettings').value;
  const newCsvPath = document.getElementById('csvFilePathSettings').value;
  
  let settingsChanged = false;
  
  // 音楽ディレクトリが変更された場合
  if (newMusicDir !== musicDirectory) {
    musicDirectory = newMusicDir;
    settingsChanged = true;
  }
  
  // CSVファイルが変更された場合
  if (newCsvPath !== csvFilePath) {
    csvFilePath = newCsvPath;
    settingsChanged = true;
  }
  
  // 設定が変更された場合、アプリケーションを再起動する必要があることを通知
  if (settingsChanged) {
    if (confirm('設定を変更するにはアプリケーションを再起動する必要があります。再起動しますか？')) {
      startApplication();
    }
  } else {
    alert('設定に変更はありませんでした。');
  }
}

/**
 * 演習モード用のフィルターコントロール（チェックボックス）を描画する
 */
function renderQuizFilterControls() {
  const typeContainer = document.getElementById('quizTypeFilters');
  const generationContainer = document.getElementById('quizGenerationFilters');
  const gameContainer = document.getElementById('quizGameFilters');
  const stageContainer = document.getElementById('quizStageFilters');

  typeContainer.innerHTML = '';
  generationContainer.innerHTML = '';
  gameContainer.innerHTML = '';
  stageContainer.innerHTML = '';

  // タイプ、シリーズ区分、作品名、ステージ・場面は全てデータからのみ取得（事前定義なし）

  const types = getUniqueValuesForFilter('type');
  const generations = getUniqueValuesForFilter('generation');
  const games = getUniqueValuesForFilter('game');
  const stages = getUniqueValuesForFilter('stage');

  createCheckboxesForQuizGroup(types, typeContainer, 'quizTypeFilter');
  createCheckboxesForQuizGroup(generations, generationContainer, 'quizGenerationFilter');
  createCheckboxesForQuizGroup(games, gameContainer, 'quizGameFilter');
  createCheckboxesForQuizGroup(stages, stageContainer, 'quizStageFilter');
}

/**
 * 演習モード用：指定された値の配列からチェックボックス群を作成し、コンテナに追加する
 * @param {string[]} values チェックボックスにする値の配列
 * @param {HTMLElement} container チェックボックスを追加する親要素
 * @param {string} groupName チェックボックスグループの名前 (inputのname属性)
 */
function createCheckboxesForQuizGroup(values, container, groupName) {
  if (values.length === 0) {
    container.innerHTML = '<p class="no-filter-options">該当データなし</p>';
    return;
  }
  values.forEach((value, index) => {
    // ユニークなIDを生成（インデックスを含めることで重複を防ぐ）
    const checkboxId = `${groupName}-${index}-${value.replace(/[^a-zA-Z0-9]/g, '-')}`;

    const label = document.createElement('label');
    label.className = 'checkbox-label';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = checkboxId;
    checkbox.name = groupName;
    checkbox.value = value;
    checkbox.addEventListener('change', updateQuizSongCounts); // 変更時に楽曲数を更新

    // ラベルにinput要素を最初に追加し、その後にテキストを追加
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(value));
    
    // ラベル自体にクリックイベントを追加して確実に動作させる
    label.addEventListener('click', (e) => {
      // チェックボックス自体がクリックされた場合は何もしない（ブラウザの標準動作に任せる）
      if (e.target === checkbox) {
        return;
      }
      // ラベルテキスト部分がクリックされた場合
      e.preventDefault();
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change'));
    });
    
    container.appendChild(label);
  });
}

/**
 * 演習モード用：指定された値の配列からラジオボタン群を作成し、コンテナに追加する
 * @param {string[]} values ラジオボタンにする値の配列
 * @param {HTMLElement} container ラジオボタンを追加する親要素
 * @param {string} groupName ラジオボタングループの名前 (inputのname属性)
 */
function createRadioButtonsForQuizGroup(values, container, groupName) {
  if (values.length === 0) {
    container.innerHTML = '<p class="no-filter-options">該当データなし</p>';
    return;
  }
  
  // 「すべて」オプションを最初に追加
  const allRadioId = `${groupName}-all-0`;
  const allLabel = document.createElement('label');
  allLabel.className = 'radio-label';

  const allRadio = document.createElement('input');
  allRadio.type = 'radio';
  allRadio.id = allRadioId;
  allRadio.name = groupName;
  allRadio.value = '';
  allRadio.checked = true; // デフォルトで選択状態
  allRadio.addEventListener('change', updateQuizSongCounts);

  allLabel.appendChild(allRadio);
  allLabel.appendChild(document.createTextNode('すべて'));
  
  // ラベル自体にクリックイベントを追加
  allLabel.addEventListener('click', (e) => {
    if (e.target === allRadio) {
      return;
    }
    e.preventDefault();
    allRadio.checked = true;
    allRadio.dispatchEvent(new Event('change'));
  });
  
  container.appendChild(allLabel);
  
  // 各値のラジオボタンを作成
  values.forEach((value, index) => {
    // ユニークなIDを生成（インデックスを含めることで重複を防ぐ）
    const radioId = `${groupName}-${index + 1}-${value.replace(/[^a-zA-Z0-9]/g, '-')}`;

    const label = document.createElement('label');
    label.className = 'radio-label';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.id = radioId;
    radio.name = groupName;
    radio.value = value;
    radio.addEventListener('change', updateQuizSongCounts);

    label.appendChild(radio);
    label.appendChild(document.createTextNode(value));
    
    // ラベル自体にクリックイベントを追加
    label.addEventListener('click', (e) => {
      if (e.target === radio) {
        return;
      }
      e.preventDefault();
      radio.checked = true;
      radio.dispatchEvent(new Event('change'));
    });
    
    container.appendChild(label);
  });
}

/**
 * 演習モード用：選択されたチェックボックスの値を取得するヘルパー
 * @param {string} groupName チェックボックスのname属性
 * @returns {string[]} 選択された値の配列
 */
function getSelectedQuizCheckboxValues(groupName) {
  const checkboxes = document.querySelectorAll(`input[name="${groupName}"]:checked`);
  return Array.from(checkboxes).map(cb => cb.value);
}

/**
 * 演習モード用：選択されたラジオボタンの値を取得するヘルパー
 * @param {string} groupName ラジオボタンのname属性
 * @returns {string} 選択された値（未選択や「すべて」の場合は空文字列）
 */
function getSelectedQuizRadioValue(groupName) {
  const radio = document.querySelector(`input[name="${groupName}"]:checked`);
  return radio ? radio.value : '';
}

/**
 * 演習モード用：現在のフィルター条件に基づいて楽曲データをフィルタリングする
 * @returns {Array} フィルタリングされた楽曲データの配列
 */
function filterQuizSongsInternal() {
  // チェックボックスから選択された値を取得
  const selectedTypes = getSelectedQuizCheckboxValues('quizTypeFilter');
  const selectedGenerations = getSelectedQuizCheckboxValues('quizGenerationFilter');
  const selectedGames = getSelectedQuizCheckboxValues('quizGameFilter');
  const selectedStages = getSelectedQuizCheckboxValues('quizStageFilter');

  // songUtils.jsの関数を使用してフィルタリング（演習モードはキーワード検索なし）
  return songUtils.filterSongs(songData, {
    keywords: [],
    types: selectedTypes,
    generations: selectedGenerations,
    games: selectedGames,
    stages: selectedStages
  });
}

/**
 * 演習モード用：楽曲数をリアルタイム更新する
 */
function updateQuizSongCounts() {
  const filteredSongs = filterQuizSongsInternal();
  const totalCount = filteredSongs.length;
  const availableCount = filteredSongs.filter(song => isMusicDirSet && song.fileExists).length;
  
  document.getElementById('quizTotalSongs').textContent = `楽曲数: ${totalCount}曲`;
  document.getElementById('quizAvailableSongs').textContent = `| 再生可能: ${availableCount}曲`;
  
  // 回答方式と再生可能楽曲数に応じて「クイズを開始」ボタンの状態を制御
  updateQuizStartButtonForAnswerMode();
}

/**
 * 演習モード用：再生可能楽曲数に応じて「クイズを開始」ボタンの状態を更新する
 * @param {number} availableCount 再生可能楽曲数
 */
function updateQuizStartButtonState(availableCount) {
  const startQuizBtn = document.getElementById('startQuizBtn');
  if (startQuizBtn) {
    if (availableCount === 0) {
      startQuizBtn.disabled = true;
      startQuizBtn.title = '再生可能な楽曲がありません。音楽ディレクトリの設定や絞り込み条件を確認してください。';
    } else {
      startQuizBtn.disabled = false;
      startQuizBtn.title = '';
    }
  }
}

/**
 * クイズを中止する
 */
function stopQuiz() {
  if (!quizState.isActive) {
    return;
  }
  
  const confirmStop = confirm('クイズを中止しますか？\n現在までの結果が表示されます。');
  if (!confirmStop) {
    return;
  }
  
  console.log('[Quiz] ユーザーによってクイズが中止されました');
  endQuiz();
}

/**
 * クイズを終了し、結果を表示する
 */
function endQuiz() {
  console.log('[Quiz] クイズを終了します');
  
  // クイズ状態を非アクティブに（最初に設定してエラーメッセージを抑制）
  quizState.isActive = false;
  
  // 音楽を完全に停止・クリーンアップ
  cleanupQuizAudioPlayer();
  
  // 最終結果を表示
  showFinalResults();
  
  // UIを初期状態に戻す
  document.getElementById('quizContainer').classList.add('hidden');
  document.getElementById('quizResult').classList.add('hidden');
  document.getElementById('nextQuestionBtn').style.display = 'none';
  document.getElementById('submitAnswerBtn').disabled = false;
  document.getElementById('answerText').disabled = false;
  document.getElementById('answerText').value = '';
}

/**
 * 最終結果を表示する
 */
function showFinalResults() {
  const totalQuestions = quizState.totalQuestions;
  const correctAnswers = quizState.correctAnswers;
  const responseTimes = quizState.responseTimes;
  
  if (totalQuestions === 0) {
    alert('問題が出題されませんでした。');
    return;
  }
  
  // 正答率を計算
  const accuracy = ((correctAnswers / totalQuestions) * 100).toFixed(1);
  
  // 平均回答時間を計算
  const averageTime = responseTimes.length > 0 
    ? (responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length / 1000).toFixed(1)
    : '0.0';
  
  // 結果メッセージを作成
  const resultMessage = `
クイズ結果

出題数: ${totalQuestions}問
正答数: ${correctAnswers}問
正答率: ${accuracy}%
平均回答時間: ${averageTime}秒

お疲れさまでした！
  `.trim();
  
  console.log('[Quiz] 最終結果:', {
    totalQuestions,
    correctAnswers,
    accuracy: `${accuracy}%`,
    averageTime: `${averageTime}秒`
  });
  
  alert(resultMessage);
}

/**
 * 演習モード用の音量調節
 */
function adjustQuizVolume() {
  const volume = document.getElementById('quizVolumeSlider').value / 100;
  if (quizState.quizAudioPlayer) {
    quizState.quizAudioPlayer.volume = volume;
    console.log(`[Quiz] 音量を${volume * 100}%に変更しました`);
  }
}

/**
 * 回答方式に基づいてクイズ開始ボタンの状態を更新
 */
function updateQuizStartButtonForAnswerMode() {
  const answerMode = document.getElementById('answerMode').value;
  const startQuizBtn = document.getElementById('startQuizBtn');
  
  if (answerMode !== 'exact') {
    // 完全一致以外の場合はボタンを無効化
    startQuizBtn.disabled = true;
    startQuizBtn.title = `${answerMode === 'fuzzy' ? '曖昧一致' : 'ボタン回答'}モードは現在未実装です。完全一致モードをご利用ください。`;
    console.log(`[Quiz] ${answerMode}モードは未実装のため、クイズ開始ボタンを無効化しました`);
  } else {
    // 完全一致の場合は、再生可能楽曲数に基づいて判定
    const filteredSongs = filterQuizSongsInternal();
    const availableCount = filteredSongs.filter(song => isMusicDirSet && song.fileExists).length;
    updateQuizStartButtonState(availableCount);
  }
}