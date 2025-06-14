// グローバル変数
let musicDirectory = '';
let csvFilePath = '';
let songData = [];
let currentSong = null;
let audioPlayer = null;
let isMusicDirSet = false;

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

/**
 * ファイル名またはフルパスから拡張子を除いたファイル名本体を取得する
 * @param {string} filePath ファイルパスまたはファイル名
 * @returns {string} 拡張子を除いたファイル名
 */
function getBaseName(filePath) {
  if (!filePath) return '';
  // パス区切り文字 (\ または /) で分割し、最後の要素（ファイル名）を取得
  const fileName = filePath.split(/[\\/]/).pop();
  // 最後のドット (.) の位置を見つける
  const lastDotIndex = fileName.lastIndexOf('.');
  // ドットがない、またはドットが最初にある（隠しファイルなど）場合は、そのまま返す
  if (lastDotIndex <= 0) return fileName;
  // ドットより前の部分を返す
  return fileName.slice(0, lastDotIndex);
}

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
  document.getElementById('playBtn').addEventListener('click', playSong);
  document.getElementById('pauseBtn').addEventListener('click', pauseSong);
  document.getElementById('stopBtn').addEventListener('click', stopSong);
  document.getElementById('volumeSlider').addEventListener('input', adjustVolume);
  
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
  
  // 絞り込みフィルターの折りたたみボタン
  document.getElementById('toggleFilters').addEventListener('click', toggleFilters);
  
  
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

    console.log('[renderer.js] 楽曲リストを表示します');
    renderFilterControls();
    renderSongList(); // 修正された renderSongList を呼び出す
    
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

// ★新規追加: フィルターコントロールを動的に生成する関数群
/**
 * 指定された属性のユニークな値を取得する（フィルターオプション用）
 * @param {string} attribute 楽曲オブジェクトの属性名
 * @param {string[]} predefinedValues 事前定義された値の配列（データに無くても表示したい場合）
 * @returns {string[]} ソート済みのユニークな値の配列
 */
function getUniqueValuesForFilter(attribute, predefinedValues = []) {
  if (!songData || songData.length === 0) return [...predefinedValues].sort();
  const uniqueValues = new Set(predefinedValues);
  songData.forEach(song => {
    if (song[attribute] && typeof song[attribute] === 'string' && song[attribute].trim() !== '') {
      uniqueValues.add(song[attribute].trim());
    }
  });
  return Array.from(uniqueValues).sort();
}

/**
 * フィルターコントロール（チェックボックス）を描画する
 */
function renderFilterControls() {
  const typeContainer = document.getElementById('typeFilters');
  const generationContainer = document.getElementById('generationFilters');
  const gameContainer = document.getElementById('gameFilters');
  const stageContainer = document.getElementById('stageFilters');

  typeContainer.innerHTML = '';
  generationContainer.innerHTML = '';
  gameContainer.innerHTML = '';
  stageContainer.innerHTML = '';

  const predefinedTypes = ['初出', 'アレンジ', '再録'];
  const predefinedGenerations = ['旧作', '現行', '西方等', '黄昏'];
  // 作品名とステージ・場面はデータからのみ取得（事前定義なし）

  const types = getUniqueValuesForFilter('type', predefinedTypes);
  const generations = getUniqueValuesForFilter('generation', predefinedGenerations);
  const games = getUniqueValuesForFilter('game');
  const stages = getUniqueValuesForFilter('stage');

  createCheckboxesForGroup(types, typeContainer, 'typeFilter');
  createCheckboxesForGroup(generations, generationContainer, 'generationFilter');
  createCheckboxesForGroup(games, gameContainer, 'gameFilter');
  createRadioButtonsForGroup(stages, stageContainer, 'stageFilter');
}

/**
 * 指定された値の配列からチェックボックス群を作成し、コンテナに追加する
 * @param {string[]} values チェックボックスにする値の配列
 * @param {HTMLElement} container チェックボックスを追加する親要素
 * @param {string} groupName チェックボックスグループの名前 (inputのname属性)
 */
function createCheckboxesForGroup(values, container, groupName) {
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
    checkbox.addEventListener('change', filterSongs); // 変更時に楽曲リストを更新

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
 * 指定された値の配列からラジオボタン群を作成し、コンテナに追加する
 * @param {string[]} values ラジオボタンにする値の配列
 * @param {HTMLElement} container ラジオボタンを追加する親要素
 * @param {string} groupName ラジオボタングループの名前 (inputのname属性)
 */
function createRadioButtonsForGroup(values, container, groupName) {
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
  allRadio.addEventListener('change', filterSongs);

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
    radio.addEventListener('change', filterSongs);

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

// ★新規追加: 選択されたチェックボックスの値を取得するヘルパー
/**
 * 指定されたグループ名のチェックボックスから選択されている値の配列を取得する
 * @param {string} groupName チェックボックスのname属性
 * @returns {string[]} 選択された値の配列
 */
function getSelectedCheckboxValues(groupName) {
  const checkboxes = document.querySelectorAll(`input[name="${groupName}"]:checked`);
  return Array.from(checkboxes).map(cb => cb.value);
}

/**
 * 指定されたグループ名のラジオボタンから選択されている値を取得する
 * @param {string} groupName ラジオボタンのname属性
 * @returns {string} 選択された値（未選択や「すべて」の場合は空文字列）
 */
function getSelectedRadioValue(groupName) {
  const radio = document.querySelector(`input[name="${groupName}"]:checked`);
  return radio ? radio.value : '';
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
      song.generation = values[2]?.trim() || '';
      song.type = values[3]?.trim() || '';
      song.game = values[4]?.trim() || '';
      song.character = values[5]?.trim() || '';
      song.stage = values[6]?.trim() || ''; // ★追加: ステージ・場面
      song.filePath = '';
      
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
    console.log('[renderer.js] ファイルマッチング処理を開始します (拡張子あいまい、サブフォルダ対応)');
    console.log(`[renderer.js] 処理対象の楽曲データ数: ${songData.length}`);
    console.log(`[renderer.js] 検出された音声ファイル数: ${audioFiles.length}`);

    // 1. 検出された音声ファイルのマップを作成
    //    キー: 拡張子を除いたファイル名 (小文字)
    //    バリュー: ファイルのフルパス
    //    重複するベース名があった場合、最初に見つかったものを優先する
    const audioFileMap = new Map();
    for (const fullPath of audioFiles) {
        const baseNameLower = getBaseName(fullPath).toLowerCase(); // 拡張子なしファイル名 (小文字)
        if (baseNameLower && !audioFileMap.has(baseNameLower)) { // ベース名があり、まだマップにない場合
            audioFileMap.set(baseNameLower, fullPath); // マップに追加
        }
        // else {
        //   // 重複した場合のログ（必要に応じて）
        //   console.warn(`[renderer.js] 重複ベース名検出: ${baseNameLower}. 最初に検出された ${audioFileMap.get(baseNameLower)} を使用します。`);
        // }
    }

    console.log(`[renderer.js] 音声ファイルマップ作成完了。ユニークなベース名数: ${audioFileMap.size}`);
    // マップ内容のサンプルログ（デバッグ用）
    let logCount = 0;
    for (const [name, path] of audioFileMap.entries()) {
      if (logCount < 3) {
        console.log(`  マップ例: "${name}" => "${path}"`);
        logCount++;
      } else break;
    }

    // 2. 楽曲データと音声ファイルマップをマッチング
    let matchCount = 0;
    let noMatchCount = 0;

    songData.forEach((song, index) => {
      // CSVから読み込んだファイル名から拡張子を除去し、小文字に変換
      const csvBaseNameLower = getBaseName(song.filename).toLowerCase();

      // デバッグログ（最初の数件と最後の数件）
      const logDetails = index < 5 || index >= songData.length - 5;
      if (logDetails) {
        console.log(`[renderer.js] マッチング試行 ${index + 1}/${songData.length}: CSV Filename="${song.filename}", BaseName="${csvBaseNameLower}"`);
      }

      // マップにCSVのベース名（小文字）が存在するか確認
      if (csvBaseNameLower && audioFileMap.has(csvBaseNameLower)) {
        song.filePath = audioFileMap.get(csvBaseNameLower); // マップからフルパスを取得
        song.fileExists = true; // ファイルが存在することを示すフラグ
        matchCount++;

        if (logDetails) {
          console.log(`  -> マッチ成功: Path = ${song.filePath}`);
        }
      } else {
        song.filePath = ''; // マッチしなかった場合はパスをクリア
        song.fileExists = false; // ファイルが存在しないフラグ
        noMatchCount++;

        if (logDetails && csvBaseNameLower) {
            console.log(`  -> マッチ失敗: ベース名 "${csvBaseNameLower}" のファイルが見つかりません`);
        } else if (logDetails && !csvBaseNameLower) {
            console.log(`  -> マッチ失敗: CSVのファイル名からベース名を取得できませんでした`);
        }
      }
    });

    console.log(`[renderer.js] マッチング処理完了: ${matchCount} / ${songData.length} 曲のファイルとマッチしました。`);
    console.log(`[renderer.js] マッチしなかった曲数: ${noMatchCount}`);

    // マッチしたファイルが一つもない場合のエラーハンドリング (より具体的に)
    if (matchCount === 0 && songData.length > 0) {
      const errorMsg = '楽曲データと音声ファイルが一つもマッチしませんでした。\n\n' +
                       '考えられる原因:\n' +
                       '- 音楽フォルダの指定が間違っている。\n' +
                       '- CSVファイルの「ファイル名」列の値が、実際の音声ファイル名（拡張子を除く）と異なっている。\n' +
                       '- CSVファイルの内容が空、または形式が正しくない。\n' +
                       '- 音楽フォルダ内に対応する音声ファイルが存在しない。\n\n' +
                       '設定とファイルを確認してください。';
      console.error('[renderer.js] ' + errorMsg.replace(/\n/g, ' '));
      alert(errorMsg);
      // 必要であれば、ここで処理を中断するなどの対応を追加
      // 例: return false; や throw new Error(...);
    }
  } catch (error) {
    console.error('[renderer.js] ファイルマッチングエラー:', error);
    alert(`ファイルのマッチング処理中にエラーが発生しました: ${error.message}`);
    throw new Error(`ファイルマッチングエラー: ${error.message}`); // エラーを再スローして startApplication で捕捉可能にする
  }
}

// 楽曲リストの表示
function renderSongList() {
  const songListElement = document.getElementById('songList');
  const songListHeader = document.getElementById('songListHeader');
  songListElement.innerHTML = ''; // リストをクリア

  const songsToRender = filterSongsInternal(); // 現在のフィルター/検索条件で曲を取得

  // ヘッダーを常時表示し、楽曲件数を更新
  songListHeader.style.display = 'flex';
  updateSongListHeader(songsToRender.length);

  if (songsToRender.length === 0) {
      songListElement.innerHTML = '<p style="padding: 20px 12px; color: #666; text-align: center; margin: 0;">表示する楽曲がありません。</p>';
      return;
  }

  songsToRender.forEach((song) => { // songData ではなくフィルタリング結果を使う
    // songData 配列内での元のインデックスを探す（クリックイベントで必要）
    const originalIndex = songData.findIndex(s => s === song);

    const songElement = document.createElement('div');
    songElement.className = 'song-item';
    songElement.dataset.index = originalIndex; // songData 配列のインデックスを使う

    // タイトル列
    const titleCell = document.createElement('div');
    titleCell.className = 'song-title';
    titleCell.textContent = song.title;

    // キャラクター列
    const characterCell = document.createElement('div');
    characterCell.className = 'song-character';
    characterCell.textContent = song.character || ''; // キャラクターが未設定の場合は空文字

    songElement.appendChild(titleCell);
    songElement.appendChild(characterCell);

    // ★★★ 音楽ディレクトリが設定されていて、かつファイルが存在しない場合にクラスを追加 ★★★
    if (isMusicDirSet && !song.fileExists) {
      songElement.classList.add('file-missing');
      songElement.title = '対応する音声ファイルが見つかりません'; // ツールチップを追加
    }

    songElement.addEventListener('click', () => selectSong(originalIndex)); // 元のインデックスで選択

    songListElement.appendChild(songElement);
  });
}

/**
 * 聴取モード用：楽曲リストヘッダーの楽曲件数を更新する
 * @param {number} count 表示中の楽曲件数
 */
function updateSongListHeader(count) {
  const titleHeader = document.querySelector('.song-title-header');
  if (titleHeader) {
    titleHeader.textContent = `楽曲名 (${count}件)`;
  }
}

// 曲の選択処理
function selectSong(index) {
  if (index < 0 || index >= songData.length) {
      console.error(`[renderer.js] 不正なインデックスで selectSong が呼ばれました: ${index}`);
      return;
  }
  console.log(`[renderer.js] 曲を選択: インデックス ${index}`);

  currentSong = songData[index]; // 選択された曲を更新

  // --- UI更新 ---
  // 前の選択をクリア
  const selectedItems = document.querySelectorAll('.song-item.active');
  selectedItems.forEach(item => item.classList.remove('active'));

  // 新しい選択をハイライト
  const newSelectedItem = document.querySelector(`.song-item[data-index="${index}"]`);
  if (newSelectedItem) {
    newSelectedItem.classList.add('active');
  }

  // 選択した曲の情報を表示
  console.log(`[renderer.js] 選択された曲: ${currentSong.title}, ファイル存在: ${currentSong.fileExists}, 音楽Dir設定: ${isMusicDirSet}`);
  document.getElementById('nowPlayingTitle').textContent = currentSong.title;
  
  // 詳細情報を箇条書き形式で作成
  const detailsElement = document.getElementById('nowPlayingDetails');
  detailsElement.innerHTML = ''; // 既存の内容をクリア
  
  const details = [
    { label: 'タイプ', value: currentSong.type },
    { label: 'シリーズ区分', value: currentSong.generation },
    { label: '作品名', value: currentSong.game },
    { label: '場面', value: currentSong.stage },
    { label: 'キャラクター', value: currentSong.character }
  ];
  
  details.forEach(detail => {
    if (detail.value && detail.value.trim() !== '') {
      const listItem = document.createElement('div');
      listItem.className = 'song-detail-item';
      listItem.innerHTML = `<span class="detail-label">${detail.label}:</span> <span class="detail-value">${detail.value}</span>`;
      detailsElement.appendChild(listItem);
    }
  });

  // --- 再生ボタンの状態制御 ---
  const playBtn = document.getElementById('playBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const stopBtn = document.getElementById('stopBtn');

  // ★★★ 音楽ディレクトリが設定されていて、かつファイルが存在する場合のみ再生ボタンを有効化 ★★★
  if (isMusicDirSet && currentSong.fileExists && currentSong.filePath) {
      playBtn.disabled = false;
      pauseBtn.disabled = true; // 初期状態は一時停止不可
      stopBtn.disabled = true;  // 初期状態は停止不可
  } else {
      // それ以外（音楽Dir未設定 or ファイル欠損）の場合は再生関連ボタンを無効化
      playBtn.disabled = true;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
  }

  // すでに再生中の曲があれば停止
  if (audioPlayer) {
    console.log('[renderer.js] 既存のオーディオプレーヤーを停止します');
    stopSongInternal(); // 内部停止処理を呼び出す
  }
}

// 楽曲の再生
function playSong() {
  if (!currentSong || !currentSong.filePath || !isMusicDirSet) {
      console.warn('[renderer.js] 再生条件を満たしていません。', { currentSong, isMusicDirSet });
      return;
  }

  try {
    console.log(`[renderer.js] 楽曲の再生を開始します: ${currentSong.title}, ファイルパス: ${currentSong.filePath}`);
    stopSongInternal(); // 念のため、開始前に既存のプレーヤーを停止・破棄

    console.log('[renderer.js] 新しいオーディオプレーヤーを作成します');
    audioPlayer = new Audio(currentSong.filePath);
    const volume = document.getElementById('volumeSlider').value / 100;
    audioPlayer.volume = volume;

    audioPlayer.addEventListener('loadedmetadata', () => {
        console.log('[renderer.js] オーディオメタデータ読み込み完了');
    });
    audioPlayer.addEventListener('canplay', () => {
        console.log('[renderer.js] 再生準備完了');
        audioPlayer.play().catch(e => { // play()もPromiseを返すのでcatchを追加
            console.error('[renderer.js] 再生開始エラー:', e);
            alert(`楽曲の再生開始に失敗しました: ${e.message}`);
            updatePlayButtons(false); // 再生失敗時はボタン状態を元に戻す
        });
        console.log('[renderer.js] 再生を開始しました');
        updatePlayButtons(true); // 再生中のボタン状態に更新
    });
    audioPlayer.addEventListener('ended', () => {
      console.log('[renderer.js] 楽曲の再生が終了しました');
      updatePlayButtons(false); // 再生終了時のボタン状態
    });
    audioPlayer.addEventListener('error', (e) => {
        console.error('[renderer.js] オーディオ再生エラー:', audioPlayer.error);
        alert(`楽曲の再生中にエラーが発生しました: ${audioPlayer.error?.message || '不明なエラー'}`);
        updatePlayButtons(false); // エラー時もボタン状態をリセット
    });

    console.log('[renderer.js] オーディオの読み込みを開始します...');
    audioPlayer.load(); // 明示的にロードを開始

  } catch (error) {
    console.error('[renderer.js] 再生処理でのエラー:', error);
    alert(`楽曲の再生準備中にエラーが発生しました: ${error.message}`);
    updatePlayButtons(false); // エラー時もボタン状態をリセット
  }
}

// 楽曲の一時停止
function pauseSong() {
  if (audioPlayer && !audioPlayer.paused) {
    audioPlayer.pause();
    console.log('[renderer.js] 楽曲を一時停止しました');
    updatePlayButtons(false, true); // 一時停止中のボタン状態
  }
}

// 楽曲の停止
function stopSong() {
  stopSongInternal();
  updatePlayButtons(false); // 停止後のボタン状態
}

function stopSongInternal() {
  if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
      // イベントリスナーを削除してメモリリークを防ぐ (より安全に)
      audioPlayer.removeEventListener('loadedmetadata', null);
      audioPlayer.removeEventListener('canplay', null);
      audioPlayer.removeEventListener('ended', null);
      audioPlayer.removeEventListener('error', null);
      audioPlayer.src = ''; // ソースをクリア
      audioPlayer = null; // 参照を破棄
      console.log('[renderer.js] オーディオプレーヤーを停止・破棄しました');
  }
}

// 再生ボタンの状態を更新するヘルパー関数
/**
 * 再生コントロールボタンの状態を更新する
 * @param {boolean} isPlaying 再生中かどうか
 * @param {boolean} isPaused 一時停止中かどうか (isPlaying=false の場合のみ有効)
 */
function updatePlayButtons(isPlaying, isPaused = false) {
  const playBtn = document.getElementById('playBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const stopBtn = document.getElementById('stopBtn');

  if (!currentSong || !isMusicDirSet || !currentSong.fileExists) {
      // 再生不可能な状態なら全て無効
      playBtn.disabled = true;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
      return;
  }

  if (isPlaying) {
      playBtn.disabled = true;
      pauseBtn.disabled = false;
      stopBtn.disabled = false;
  } else if (isPaused) { // 一時停止中
      playBtn.disabled = false;
      pauseBtn.disabled = true;
      stopBtn.disabled = false; // 停止は可能
  } else { // 停止中 (または初期状態)
      playBtn.disabled = false;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
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
  console.log("[renderer.js] フィルター/検索が変更されました。リストを再描画します。");
  renderSongList(); // フィルタリング結果を使ってリストを再描画
}

// 内部用のフィルタリング処理関数
/**
 * 現在のフィルター/検索条件に基づいて楽曲データをフィルタリングする
 * @returns {Array} フィルタリングされた楽曲データの配列
 */
function filterSongsInternal() {
  const searchTermInput = document.getElementById('songSearch').value;
  const keywords = searchTermInput.toLowerCase().split(' ').filter(k => k.trim() !== '');

  // チェックボックスとラジオボタンから選択された値を取得
  const selectedTypes = getSelectedCheckboxValues('typeFilter');
  const selectedGenerations = getSelectedCheckboxValues('generationFilter');
  const selectedGames = getSelectedCheckboxValues('gameFilter');
  const selectedStage = getSelectedRadioValue('stageFilter');

  return songData.filter(song => {
    // 1. テキスト検索 (AND検索) - titleとcharacterのみに限定
    let keywordMatch = true;
    if (keywords.length > 0) {
      keywordMatch = keywords.every(keyword => {
        const searchFields = [
          song.title,
          song.character
        ];
        return searchFields.some(field =>
          field && typeof field === 'string' && field.toLowerCase().includes(keyword)
        );
      });
    }
    if (!keywordMatch) return false;

    // 2. タイプフィルター (カテゴリ内でOR、未選択ならそのカテゴリは無視)
    if (selectedTypes.length > 0 && !selectedTypes.includes(song.type)) {
      return false;
    }

    // 3. シリーズ区分フィルター
    if (selectedGenerations.length > 0 && !selectedGenerations.includes(song.generation)) {
      return false;
    }

    // 4. 作品名フィルター
    if (selectedGames.length > 0 && !selectedGames.includes(song.game)) {
      return false;
    }

    // 5. ステージ・場面フィルター（ラジオボタン）
    if (selectedStage && selectedStage !== song.stage) {
      return false;
    }

    return true; // 全てのフィルター条件を通過
  });
}

// モード切り替え
function switchMode(mode) {
  // すべてのモードパネルを非表示に
  document.getElementById('listeningModePanel').classList.add('hidden');
  document.getElementById('quizModePanel').classList.add('hidden');
  document.getElementById('settingsPanel').classList.add('hidden');
  
  // 聴取モードの音楽が再生中なら停止
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer = null;
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
  document.getElementById('answerText').value = '';
  
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
  
  // 音楽を読み込み
  loadQuizSong(selectedSong);
  
  // 解答用テキストボックスをクリアしてフォーカス
  const answerInput = document.getElementById('answerText');
  answerInput.value = '';
  answerInput.focus();
  
  // 時間計測開始
  quizState.questionStartTime = Date.now();
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
    alert('解答を入力してください。');
    return;
  }
  
  // 時間計測終了
  const responseTime = Date.now() - quizState.questionStartTime;
  quizState.responseTimes.push(responseTime);
  
  console.log(`[Quiz] ユーザー回答: "${userAnswer}", 正解: "${quizState.currentQuizSong.title}", 回答時間: ${responseTime}ms`);
  
  // 完全一致モードでの判定
  const isCorrect = checkExactMatch(userAnswer, quizState.currentQuizSong.title);
  
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
}

/**
 * 完全一致モードでの解答判定
 */
function checkExactMatch(userAnswer, correctTitle) {
  // 空白と全角半角を正規化して比較
  const normalizeString = (str) => {
    return str
      .trim()
      .replace(/　/g, ' ') // 全角スペースを半角スペースに
      .replace(/\s+/g, ' ') // 連続する空白を単一のスペースに
      .toLowerCase();
  };
  
  const normalizedAnswer = normalizeString(userAnswer);
  const normalizedTitle = normalizeString(correctTitle);
  
  return normalizedAnswer === normalizedTitle;
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
  correctAnswer.innerHTML = `
    <strong>正解:</strong> ${quizState.currentQuizSong.title}<br>
    <strong>あなたの回答:</strong> ${userAnswer}<br>
    <strong>回答時間:</strong> ${timeInSeconds}秒
  `;
  
  // 楽曲詳細情報を表示
  const song = quizState.currentQuizSong;
  const details = [
    { label: 'タイプ', value: song.type },
    { label: 'シリーズ区分', value: song.generation },
    { label: '作品名', value: song.game },
    { label: '場面', value: song.stage },
    { label: 'キャラクター', value: song.character }
  ].filter(detail => detail.value && detail.value.trim() !== '');
  
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
  document.getElementById('submitAnswerBtn').disabled = false;
  document.getElementById('answerText').disabled = false;
  
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

// 絞り込みフィルターの折りたたみ機能
function toggleFilters() {
  const filterContainer = document.getElementById('filterControlsContainer');
  const toggleButton = document.getElementById('toggleFilters');
  
  if (filterContainer.classList.contains('hidden')) {
    // 展開
    filterContainer.classList.remove('hidden');
    toggleButton.textContent = '詳細絞り込み ▲';
  } else {
    // 折りたたみ
    filterContainer.classList.add('hidden');
    toggleButton.textContent = '詳細絞り込み ▼';
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

  const predefinedTypes = ['初出', 'アレンジ', '再録'];
  const predefinedGenerations = ['旧作', '現行', '西方等', '黄昏'];
  // 作品名とステージ・場面はデータからのみ取得（事前定義なし）

  const types = getUniqueValuesForFilter('type', predefinedTypes);
  const generations = getUniqueValuesForFilter('generation', predefinedGenerations);
  const games = getUniqueValuesForFilter('game');
  const stages = getUniqueValuesForFilter('stage');

  createCheckboxesForQuizGroup(types, typeContainer, 'quizTypeFilter');
  createCheckboxesForQuizGroup(generations, generationContainer, 'quizGenerationFilter');
  createCheckboxesForQuizGroup(games, gameContainer, 'quizGameFilter');
  createRadioButtonsForQuizGroup(stages, stageContainer, 'quizStageFilter');
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
  // チェックボックスとラジオボタンから選択された値を取得
  const selectedTypes = getSelectedQuizCheckboxValues('quizTypeFilter');
  const selectedGenerations = getSelectedQuizCheckboxValues('quizGenerationFilter');
  const selectedGames = getSelectedQuizCheckboxValues('quizGameFilter');
  const selectedStage = getSelectedQuizRadioValue('quizStageFilter');

  return songData.filter(song => {
    // 1. タイプフィルター (カテゴリ内でOR、未選択ならそのカテゴリは無視)
    if (selectedTypes.length > 0 && !selectedTypes.includes(song.type)) {
      return false;
    }

    // 2. シリーズ区分フィルター
    if (selectedGenerations.length > 0 && !selectedGenerations.includes(song.generation)) {
      return false;
    }

    // 3. 作品名フィルター
    if (selectedGames.length > 0 && !selectedGames.includes(song.game)) {
      return false;
    }

    // 4. ステージ・場面フィルター（ラジオボタン）
    if (selectedStage && selectedStage !== song.stage) {
      return false;
    }

    return true; // 全てのフィルター条件を通過
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