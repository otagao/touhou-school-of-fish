// settings-mode.js - 設定モードの管理

/**
 * 設定モードを管理するクラス
 * 設定画面のUI制御、ディレクトリ/ファイル選択、設定の検証と適用を担当
 */
class SettingsMode {
  /**
   * @param {string} musicDirectory 音楽ディレクトリパス
   * @param {string} csvFilePath CSVファイルパス
   * @param {Function} onApplySettings 設定適用時のコールバック関数
   * @param {string} recognitionMode 認識モード ('hash-first' | 'path-first')
   */
  constructor(musicDirectory, csvFilePath, onApplySettings, recognitionMode = 'hash-first') {
    this.musicDirectory = musicDirectory;
    this.csvFilePath = csvFilePath;
    this.onApplySettings = onApplySettings;
    this.recognitionMode = recognitionMode;

    // イベントリスナーへの参照を保持（cleanup時に削除するため）
    this.eventListeners = [];
  }

  /**
   * 設定モードを初期化する
   * イベントリスナーの登録と現在の設定値の表示を行う
   */
  initialize() {
    console.log('[SettingsMode] 設定モードを初期化します');

    // 現在の設定値を表示
    this.updateSettingsDisplay();

    // イベントリスナーを登録
    this.registerEventListeners();
  }

  /**
   * イベントリスナーを登録する
   */
  registerEventListeners() {
    // ディレクトリ選択ボタン
    this.addEventListener('selectMusicDirSettings', 'click', () => this.selectMusicDirectorySettings());

    // CSVファイル選択ボタン
    this.addEventListener('selectCsvFileSettings', 'click', () => this.selectCsvFileSettings());

    // 設定適用ボタン
    this.addEventListener('applySettingsBtn', 'click', () => this.applySettings());

    // デバッグ機能: ハッシュCSV書き込みボタン
    this.addEventListener('writeHashToCsvBtn', 'click', () => this.writeHashToCsv());
  }

  /**
   * イベントリスナーを追加し、cleanup用に参照を保持する
   * @param {string} elementId 要素のID
   * @param {string} event イベント名
   * @param {Function} handler イベントハンドラー
   */
  addEventListener(elementId, event, handler) {
    const element = document.getElementById(elementId);
    if (element) {
      element.addEventListener(event, handler);
      this.eventListeners.push({ element, event, handler });
    }
  }

  /**
   * 現在の設定値を表示する
   */
  updateSettingsDisplay() {
    document.getElementById('musicDirPathSettings').value = this.musicDirectory || '';
    document.getElementById('csvFilePathSettings').value = this.csvFilePath || '';
    document.getElementById('recognitionMode').value = this.recognitionMode;
  }

  /**
   * 設定画面でのディレクトリ選択
   */
  async selectMusicDirectorySettings() {
    // 前回の選択位置を取得（存在しなければ現在の音楽ディレクトリを使用）
    const lastMusicDirPath = localStorage.getItem('lastMusicDirectoryPath') || this.musicDirectory;
    console.log('[SettingsMode] ディレクトリダイアログを開きます。defaultPath:', lastMusicDirPath);

    const dirPath = await window.electronAPI.openDirectoryDialog({
      defaultPath: lastMusicDirPath || undefined
    });

    console.log('[SettingsMode] 選択されたディレクトリ:', dirPath);

    if (dirPath) {
      document.getElementById('musicDirPathSettings').value = dirPath;
      // 選択したディレクトリパスをlocalStorageに保存
      localStorage.setItem('lastMusicDirectoryPath', dirPath);
      console.log('[SettingsMode] localStorageに保存:', dirPath);
    }
  }

  /**
   * 設定画面でのCSVファイル選択
   */
  async selectCsvFileSettings() {
    // 前回の選択位置を取得（存在しなければ現在のCSVファイルパスを使用）
    const lastCsvFilePath = localStorage.getItem('lastCsvFilePath') || this.csvFilePath;

    const filePath = await window.electronAPI.openFileDialog({
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      defaultPath: lastCsvFilePath
    });

    if (filePath) {
      document.getElementById('csvFilePathSettings').value = filePath;
      // 選択したCSVファイルパスをlocalStorageに保存
      localStorage.setItem('lastCsvFilePath', filePath);
    }
  }

  /**
   * 設定を適用する
   */
  applySettings() {
    const newMusicDir = document.getElementById('musicDirPathSettings').value;
    const newCsvPath = document.getElementById('csvFilePathSettings').value;
    const newRecognitionMode = document.getElementById('recognitionMode').value;

    let settingsChanged = false;

    // 音楽ディレクトリが変更された場合
    if (newMusicDir !== this.musicDirectory) {
      this.musicDirectory = newMusicDir;
      settingsChanged = true;
    }

    // CSVファイルが変更された場合
    if (newCsvPath !== this.csvFilePath) {
      this.csvFilePath = newCsvPath;
      settingsChanged = true;
    }

    // 認識モードが変更された場合
    if (newRecognitionMode !== this.recognitionMode) {
      this.recognitionMode = newRecognitionMode;
      localStorage.setItem('recognitionMode', newRecognitionMode);
      settingsChanged = true;
    }

    // 設定が変更された場合、アプリケーションを再起動する必要があることを通知
    if (settingsChanged) {
      if (confirm('設定を変更するにはアプリケーションを再起動する必要があります。再起動しますか？')) {
        // コールバック関数を呼び出してアプリケーションを再起動
        if (this.onApplySettings) {
          this.onApplySettings(this.musicDirectory, this.csvFilePath);
        }
      }
    } else {
      alert('設定に変更はありませんでした。');
    }
  }

  /**
   * デバッグ機能: 現在紐付けられているファイルのハッシュをCSVに追記する
   */
  async writeHashToCsv() {
    if (!this.csvFilePath) {
      alert('CSVファイルが選択されていません。');
      return;
    }

    if (!confirm('この操作はCSVファイルにハッシュ値を追記します。\n重複するハッシュ値は追加されません。\n\n続行しますか？')) {
      return;
    }

    try {
      console.log('[SettingsMode] ハッシュCSV書き込み処理を開始します');

      // グローバル変数から楽曲データを取得
      const songData = window.songData || [];
      if (songData.length === 0) {
        alert('楽曲データが読み込まれていません。');
        return;
      }

      // 進捗表示を表示
      const progressContainer = document.getElementById('hashWriteProgress');
      const progressText = document.getElementById('hashProgressText');
      const progressBar = document.getElementById('hashProgressBar');
      progressContainer.classList.remove('hidden');

      // fileExistsがtrueで、filePathが存在する全ての楽曲を処理
      const songsToProcess = songData.filter(song => {
        return song.fileExists && song.filePath;
      });

      console.log(`[SettingsMode] ${songsToProcess.length}個のファイルのハッシュを計算します`);

      // ハッシュ計算と追記処理
      for (let i = 0; i < songsToProcess.length; i++) {
        const song = songsToProcess[i];
        progressText.textContent = `${i + 1}/${songsToProcess.length}`;
        progressBar.value = ((i + 1) / songsToProcess.length) * 100;

        try {
          const newHash = await window.electronAPI.calculateFileHash(song.filePath);
          console.log(`[SettingsMode] ハッシュ計算完了: ${song.filename} -> ${newHash}`);

          // 既存のfileHashを配列として扱う
          let hashArray = [];
          if (Array.isArray(song.fileHash)) {
            hashArray = [...song.fileHash];
          } else if (song.fileHash && song.fileHash.trim() !== '') {
            // 単一のハッシュ値の場合は配列に変換
            hashArray = [song.fileHash.trim()];
          }

          // 新しいハッシュが既存の配列に含まれていない場合のみ追加
          if (!hashArray.includes(newHash)) {
            hashArray.push(newHash);
            song.fileHash = hashArray;
            console.log(`[SettingsMode] ハッシュを追記: ${song.filename} -> [${hashArray.join(', ')}]`);
          } else {
            console.log(`[SettingsMode] 既存のハッシュと重複のためスキップ: ${song.filename}`);
          }
        } catch (error) {
          console.error(`[SettingsMode] ハッシュ計算エラー (${song.filename}):`, error);
          // エラーが発生してもスキップして続行
        }
      }

      // CSVを生成
      const csvLines = [];
      // ヘッダー行
      csvLines.push('ファイル名,タイトル,シリーズ区分,楽曲タイプ,登場作品,キャラクター,場面,ファイルハッシュ');

      // データ行
      for (const song of songData) {
        // 配列フィールドをJSON配列形式に変換
        const title = Array.isArray(song.title) ? JSON.stringify(song.title) : song.title;
        const generation = Array.isArray(song.generation) ? JSON.stringify(song.generation) : song.generation;
        const type = Array.isArray(song.type) ? JSON.stringify(song.type) : song.type;
        const game = Array.isArray(song.game) ? JSON.stringify(song.game) : song.game;
        const character = Array.isArray(song.character) ? JSON.stringify(song.character) : song.character;
        const stage = Array.isArray(song.stage) ? JSON.stringify(song.stage) : song.stage;

        // fileHashも配列の場合はJSON配列形式に変換
        let fileHashStr = '';
        if (Array.isArray(song.fileHash)) {
          // 空でない要素のみをフィルタリング
          const validHashes = song.fileHash.filter(h => h && h.trim() !== '');
          if (validHashes.length > 0) {
            fileHashStr = JSON.stringify(validHashes);
          }
        } else if (song.fileHash && song.fileHash.trim() !== '') {
          fileHashStr = song.fileHash;
        }

        const line = [
          song.filename,
          title,
          generation,
          type,
          game,
          character,
          stage,
          fileHashStr
        ].join(',');

        csvLines.push(line);
      }

      const csvContent = csvLines.join('\n');

      // CSVファイルに書き込み
      await window.electronAPI.writeCsvFile(this.csvFilePath, csvContent);

      progressContainer.classList.add('hidden');
      alert(`ハッシュ値の追記が完了しました。\n\n処理した楽曲数: ${songsToProcess.length}曲\n\n既存のハッシュ値は保持され、新しいハッシュ値が追加されました。`);
      console.log('[SettingsMode] ハッシュCSV書き込み処理が完了しました');

    } catch (error) {
      console.error('[SettingsMode] ハッシュCSV書き込みエラー:', error);
      alert(`ハッシュの書き込み中にエラーが発生しました: ${error.message}`);
    }
  }

  /**
   * クリーンアップ処理
   * モード切り替え時にイベントリスナーを削除する
   */
  cleanup() {
    console.log('[SettingsMode] 設定モードをクリーンアップします');

    // イベントリスナーを削除
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];

    console.log('[SettingsMode] クリーンアップ完了');
  }

  /**
   * データ更新時の処理
   * @param {string} newMusicDirectory 新しい音楽ディレクトリパス
   * @param {string} newCsvFilePath 新しいCSVファイルパス
   */
  updateSettings(newMusicDirectory, newCsvFilePath) {
    this.musicDirectory = newMusicDirectory;
    this.csvFilePath = newCsvFilePath;

    // 設定表示を更新
    this.updateSettingsDisplay();
  }
}

module.exports = { SettingsMode };
