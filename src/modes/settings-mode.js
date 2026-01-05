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
   */
  constructor(musicDirectory, csvFilePath, onApplySettings) {
    this.musicDirectory = musicDirectory;
    this.csvFilePath = csvFilePath;
    this.onApplySettings = onApplySettings;

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
  }

  /**
   * 設定画面でのディレクトリ選択
   */
  async selectMusicDirectorySettings() {
    const dirPath = await window.electronAPI.openDirectoryDialog();
    if (dirPath) {
      document.getElementById('musicDirPathSettings').value = dirPath;
    }
  }

  /**
   * 設定画面でのCSVファイル選択
   */
  async selectCsvFileSettings() {
    const filePath = await window.electronAPI.openFileDialog({
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });
    if (filePath) {
      document.getElementById('csvFilePathSettings').value = filePath;
    }
  }

  /**
   * 設定を適用する
   */
  applySettings() {
    const newMusicDir = document.getElementById('musicDirPathSettings').value;
    const newCsvPath = document.getElementById('csvFilePathSettings').value;

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
