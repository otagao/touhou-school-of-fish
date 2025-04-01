// グローバル変数
let musicDirectory = '';
let csvFilePath = '';
let songData = [];
let currentSong = null;
let audioPlayer = null;

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
  
  // 聴取モードのイベントリスナー
  document.getElementById('songSearch').addEventListener('input', filterSongs);
  document.getElementById('songFilter').addEventListener('change', filterSongs);
  document.getElementById('playBtn').addEventListener('click', playSong);
  document.getElementById('pauseBtn').addEventListener('click', pauseSong);
  document.getElementById('stopBtn').addEventListener('click', stopSong);
  document.getElementById('volumeSlider').addEventListener('input', adjustVolume);
  
  // 演習モードのイベントリスナー
  document.getElementById('startQuizBtn').addEventListener('click', startQuiz);
  document.getElementById('submitAnswerBtn').addEventListener('click', submitAnswer);
  document.getElementById('nextQuestionBtn').addEventListener('click', nextQuestion);
  document.getElementById('quizPlayBtn').addEventListener('click', playQuizSong);
  document.getElementById('quizPauseBtn').addEventListener('click', pauseQuizSong);
  document.getElementById('quizStopBtn').addEventListener('click', stopQuizSong);
  
  // 設定画面のイベントリスナー
  document.getElementById('selectMusicDirSettings').addEventListener('click', selectMusicDirectorySettings);
  document.getElementById('selectCsvFileSettings').addEventListener('click', selectCsvFileSettings);
  document.getElementById('applySettingsBtn').addEventListener('click', applySettings);
  
  // ライブラリの準備
  // Howlerは実際に使用するときに初期化
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
  startButton.disabled = !(musicDirectory && csvFilePath);
}

// アプリケーション開始
async function startApplication() {
  try {
    console.log('アプリケーション開始処理を開始します');
    console.log('音楽ディレクトリ:', musicDirectory);
    console.log('CSVファイルパス:', csvFilePath);
    
    // CSVファイルを読み込む
    console.log('CSVファイルの読み込みを開始...');
    const csvContent = await window.electronAPI.readFile(csvFilePath);
    if (!csvContent) {
      console.error('CSVファイルの読み込みに失敗しました');
      alert('CSVファイルの読み込みに失敗しました。');
      return;
    }
    console.log('CSVファイルの読み込み成功。最初の100文字:', csvContent.substring(0, 100));
    
    // CSVをパース
    console.log('CSVデータのパースを開始...');
    parseSongData(csvContent);
    console.log(`CSVパース完了。${songData.length}曲のデータを読み込みました`);
    
    // 音楽ファイル一覧を取得
    console.log('音楽ファイル一覧の取得を開始...');
    const audioFiles = await window.electronAPI.getFilesInDirectory(musicDirectory, ['.mp3', '.wav', '.flac']);
    console.log(`音楽ファイル一覧取得完了。${audioFiles.length}個のファイルを検出`);
    if (audioFiles.length === 0) {
      console.error('音楽ファイルが見つかりませんでした');
      alert('選択したディレクトリに音楽ファイルが見つかりませんでした。');
      return;
    }
    
    // ファイル名と楽曲データをマッチング
    console.log('ファイルと楽曲データのマッチングを開始...');
    matchSongsWithFiles(audioFiles);
    
    // UIを切り替え
    console.log('UIを切り替えます');
    document.getElementById('setupPanel').classList.add('hidden');
    document.getElementById('mainPanel').classList.remove('hidden');
    
    // 聴取モードを表示
    console.log('聴取モードを表示します');
    switchMode('listeningMode');
    
    // 楽曲リストを表示
    console.log('楽曲リストを表示します');
    renderSongList();
    
    // 設定画面の値を更新
    document.getElementById('musicDirPathSettings').value = musicDirectory;
    document.getElementById('csvFilePathSettings').value = csvFilePath;
    console.log('アプリケーション開始処理が完了しました');
  } catch (error) {
    console.error('アプリケーション開始エラー:', error);
    console.error('エラーの詳細:', error.message);
    console.error('エラーのスタックトレース:', error.stack);
    alert(`アプリケーションの開始に失敗しました。エラー: ${error.message}`);
  }
}

// CSVデータのパース処理
function parseSongData(csvContent) {
  try {
    console.log('CSVパース処理を開始します');
    
    // 簡易的なCSVパース (実際の実装ではPapaParseを使用)
    const lines = csvContent.split('\n');
    console.log(`CSVの行数: ${lines.length}`);
    
    if (lines.length === 0) {
      console.error('CSVファイルが空です');
      throw new Error('CSVファイルが空です');
    }
    
    const headers = lines[0].split(',');
    console.log(`CSVのヘッダー: ${headers.join(', ')}`);
    
    if (headers.length < 2) {
      console.error('CSVヘッダーの形式が不正です');
      throw new Error('CSVヘッダーの形式が不正です');
    }
    
    songData = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) {
        console.log(`行 ${i}: 空行のためスキップします`);
        continue;
      }
      
      const values = lines[i].split(',');
      console.log(`行 ${i}: ${values.length}個の値を検出`);
      
      if (values.length < 2) {
        console.warn(`行 ${i}: 値の数が少ないため、この行はスキップします`);
        continue;
      }
      
      const song = {};
      
      // CSVフォーマット: ファイル名,曲名,旧作or現行,初出orアレンジ,登場作品,担当キャラクター
      song.filename = values[0]?.trim() || '';
      song.title = values[1]?.trim() || '';
      song.generation = values[2]?.trim() || ''; // 旧作or現行
      song.type = values[3]?.trim() || ''; // 初出orアレンジ
      song.game = values[4]?.trim() || ''; // 登場作品
      song.character = values[5]?.trim() || ''; // 担当キャラクター
      song.filePath = ''; // 実際のファイルパスは後で設定
      
      if (!song.filename || !song.title) {
        console.warn(`行 ${i}: ファイル名または曲名が空のため、この行はスキップします`);
        continue;
      }
      
      songData.push(song);
      
      // 最初の数件だけ詳細ログを出力
      if (i <= 3) {
        console.log(`楽曲データの例 (行 ${i}):`, JSON.stringify(song));
      }
    }
    
    console.log(`${songData.length}曲の情報を読み込みました。`);
    
    if (songData.length === 0) {
      console.error('有効な楽曲データがありません');
      throw new Error('有効な楽曲データがありません');
    }
  } catch (error) {
    console.error('CSVパースエラー:', error);
    throw new Error(`CSVパースエラー: ${error.message}`);
  }
}

// 楽曲データとファイルのマッチング
function matchSongsWithFiles(audioFiles) {
  try {
    console.log('ファイルマッチング処理を開始します');
    
    // ファイル名からファイルパスのマップを作成
    const fileMap = {};
    audioFiles.forEach(filePath => {
      const fileName = filePath.split('/').pop().split('\\').pop();
      fileMap[fileName] = filePath;
    });
    
    console.log(`ファイルマップを作成しました。${Object.keys(fileMap).length}個のファイルが対象です`);
    
    // マップの最初の数件を表示
    const fileMapEntries = Object.entries(fileMap).slice(0, 3);
    fileMapEntries.forEach(([name, path]) => {
      console.log(`ファイルマップの例: "${name}" => "${path}"`);
    });
    
    // 楽曲データとファイルをマッチング
    let matchCount = 0;
    let noMatchCount = 0;
    
    songData.forEach((song, index) => {
      // 処理の進捗を表示（最初の数件と最後の数件）
      const logDetails = index < 3 || index >= songData.length - 3;
      
      if (logDetails) {
        console.log(`マッチング処理: 曲 ${index + 1}/${songData.length}, ファイル名: "${song.filename}"`);
      }
      
      if (fileMap[song.filename]) {
        song.filePath = fileMap[song.filename];
        matchCount++;
        
        if (logDetails) {
          console.log(`マッチ成功: "${song.filename}" => "${song.filePath}"`);
        }
      } else {
        noMatchCount++;
        
        if (logDetails) {
          console.log(`マッチ失敗: "${song.filename}" - ファイルが見つかりません`);
        }
      }
    });
    
    console.log(`マッチング処理完了: ${matchCount}/${songData.length}曲のファイルとマッチしました。`);
    console.log(`マッチしなかった曲: ${noMatchCount}曲`);
    
    // マッチしたファイルが一つもない場合はエラー
    if (matchCount === 0) {
      console.error('一つもマッチする楽曲がありませんでした');
      throw new Error('楽曲データとファイルがマッチしませんでした。ファイル名の形式を確認してください。');
    }
  } catch (error) {
    console.error('ファイルマッチングエラー:', error);
    throw new Error(`ファイルマッチングエラー: ${error.message}`);
  }
}

// 楽曲リストの表示
function renderSongList() {
  const songListElement = document.getElementById('songList');
  songListElement.innerHTML = '';
  
  songData.forEach((song, index) => {
    if (!song.filePath) return; // ファイルが見つからない曲はスキップ
    
    const songElement = document.createElement('div');
    songElement.className = 'song-item';
    songElement.dataset.index = index;
    songElement.textContent = song.title;
    songElement.addEventListener('click', () => selectSong(index));
    
    songListElement.appendChild(songElement);
  });
}

// 曲の選択処理
function selectSong(index) {
  console.log(`曲を選択: インデックス ${index}`);
  
  // 前の選択をクリア
  const selectedItems = document.querySelectorAll('.song-item.active');
  selectedItems.forEach(item => item.classList.remove('active'));
  
  // 新しい選択をハイライト
  const newSelectedItem = document.querySelector(`.song-item[data-index="${index}"]`);
  if (newSelectedItem) {
    newSelectedItem.classList.add('active');
  }
  
  // 選択した曲の情報を表示
  currentSong = songData[index];
  console.log(`選択された曲: ${currentSong.title}, ファイル: ${currentSong.filename}`);
  
  document.getElementById('nowPlayingTitle').textContent = currentSong.title;
  document.getElementById('nowPlayingDetails').textContent = 
    `${currentSong.game} (${currentSong.type} ${currentSong.character ? '/ ' + currentSong.character : ''})`;
  
  // 再生ボタンを有効化
  document.getElementById('playBtn').disabled = false;
  document.getElementById('pauseBtn').disabled = true;
  document.getElementById('stopBtn').disabled = true;
  
  // すでに再生中の曲があれば停止
  if (audioPlayer) {
    console.log('既存のオーディオプレーヤーを停止します');
    audioPlayer.pause();
    audioPlayer = null;
  }
}

// 楽曲の再生
function playSong() {
  if (!currentSong) return;
  
  try {
    console.log(`楽曲の再生を開始します: ${currentSong.title}, ファイルパス: ${currentSong.filePath}`);
    
    // 以前のオーディオプレーヤーが存在する場合は破棄する
    if (audioPlayer) {
      console.log('以前のオーディオプレーヤーを破棄します');
      audioPlayer.pause();
      audioPlayer = null;
    }
    
    // 新しいオーディオプレーヤーを作成
    console.log('新しいオーディオプレーヤーを作成します');
    audioPlayer = new Audio(currentSong.filePath);
    const volume = document.getElementById('volumeSlider').value / 100;
    audioPlayer.volume = volume;
    
    audioPlayer.addEventListener('ended', () => {
      console.log('楽曲の再生が終了しました');
      document.getElementById('playBtn').disabled = false;
      document.getElementById('pauseBtn').disabled = true;
      document.getElementById('stopBtn').disabled = true;
    });
    
    // 楽曲を再生
    console.log('楽曲の再生を開始します');
    audioPlayer.play();
    
    // ボタン状態の更新
    document.getElementById('playBtn').disabled = true;
    document.getElementById('pauseBtn').disabled = false;
    document.getElementById('stopBtn').disabled = false;
    
    console.log('楽曲の再生処理が完了しました');
  } catch (error) {
    console.error('再生エラー:', error);
    alert(`楽曲の再生に失敗しました: ${error.message}`);
  }
}

// 楽曲の一時停止
function pauseSong() {
  if (audioPlayer) {
    audioPlayer.pause();
    document.getElementById('playBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;
  }
}

// 楽曲の停止
function stopSong() {
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    document.getElementById('playBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
    document.getElementById('stopBtn').disabled = true;
  }
}

// 音量調整
function adjustVolume() {
  const volume = document.getElementById('volumeSlider').value / 100;
  if (audioPlayer) {
    audioPlayer.volume = volume;
  }
}

// 楽曲のフィルタリング
function filterSongs() {
  const searchTerm = document.getElementById('songSearch').value.toLowerCase();
  const filterType = document.getElementById('songFilter').value;
  
  const songListElement = document.getElementById('songList');
  songListElement.innerHTML = '';
  
  songData.forEach((song, index) => {
    if (!song.filePath) return; // ファイルが見つからない曲はスキップ
    
    // 検索条件と一致するか確認
    const titleMatch = song.title.toLowerCase().includes(searchTerm);
    
    // フィルタ条件と一致するか確認
    let typeMatch = true;
    if (filterType === 'original' && song.type !== '初出') {
      typeMatch = false;
    } else if (filterType === 'arrange' && song.type !== 'アレンジ') {
      typeMatch = false;
    }
    
    if (titleMatch && typeMatch) {
      const songElement = document.createElement('div');
      songElement.className = 'song-item';
      songElement.dataset.index = index;
      songElement.textContent = song.title;
      songElement.addEventListener('click', () => selectSong(index));
      
      songListElement.appendChild(songElement);
    }
  });
}

// モード切り替え
function switchMode(mode) {
  // すべてのモードパネルを非表示に
  document.getElementById('listeningModePanel').classList.add('hidden');
  document.getElementById('quizModePanel').classList.add('hidden');
  document.getElementById('settingsPanel').classList.add('hidden');
  
  // 選択されたモードを表示
  if (mode === 'listeningMode') {
    document.getElementById('listeningModePanel').classList.remove('hidden');
  } else if (mode === 'quizMode') {
    document.getElementById('quizModePanel').classList.remove('hidden');
    prepareQuizMode();
  } else if (mode === 'settings') {
    document.getElementById('settingsPanel').classList.remove('hidden');
  }
  
  // 音楽が再生中なら停止
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer = null;
  }
}

// クイズモードの準備
function prepareQuizMode() {
  // 絞り込み条件をリセット
  document.getElementById('quizFilter').value = 'all';
  
  // 回答方式をリセット
  document.getElementById('answerMode').value = 'exact';
  
  // クイズコンテナを非表示に
  document.getElementById('quizContainer').classList.add('hidden');
  document.getElementById('quizResult').classList.add('hidden');
  
  // 各種UIをリセット
  document.getElementById('answerText').value = '';
}

// クイズを開始
function startQuiz() {
  // TODO: クイズ機能の実装（フェーズ3）
  alert('クイズ機能は開発中です（フェーズ3で実装予定）');
}

// クイズの回答を提出
function submitAnswer() {
  // TODO: クイズ機能の実装（フェーズ3）
  alert('クイズ機能は開発中です（フェーズ3で実装予定）');
}

// 次の問題へ進む
function nextQuestion() {
  // TODO: クイズ機能の実装（フェーズ3）
  alert('クイズ機能は開発中です（フェーズ3で実装予定）');
}

// クイズ楽曲の再生
function playQuizSong() {
  // TODO: クイズ機能の実装（フェーズ3）
  alert('クイズ機能は開発中です（フェーズ3で実装予定）');
}

// クイズ楽曲の一時停止
function pauseQuizSong() {
  // TODO: クイズ機能の実装（フェーズ3）
  alert('クイズ機能は開発中です（フェーズ3で実装予定）');
}

// クイズ楽曲の停止
function stopQuizSong() {
  // TODO: クイズ機能の実装（フェーズ3）
  alert('クイズ機能は開発中です（フェーズ3で実装予定）');
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