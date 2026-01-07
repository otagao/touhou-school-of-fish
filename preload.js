const { ipcRenderer } = require('electron');

// contextIsolation: false のため、windowオブジェクトに直接公開
window.electronAPI = {
  // プラットフォーム情報を取得
  platform: process.platform,

  // ディレクトリ選択ダイアログを開く
  openDirectoryDialog: (options) => ipcRenderer.invoke('open-directory-dialog', options),

  // ファイル選択ダイアログを開く
  openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),

  // ディレクトリ内のファイル一覧を取得
  getFilesInDirectory: async (directoryPath, extensions) => {
    try {
      return await ipcRenderer.invoke('get-files-in-directory', directoryPath, extensions);
    } catch (error) {
      console.error('getFilesInDirectory エラー:', error);
      throw new Error(`ディレクトリからファイル一覧を取得できませんでした: ${error.message}`);
    }
  },

  // ファイルの内容を読み込む
  readFile: async (filePath) => {
    try {
      const result = await ipcRenderer.invoke('read-file', filePath);
      if (result === null) {
        throw new Error('ファイルが読み込めませんでした');
      }
      return result;
    } catch (error) {
      console.error('readFile エラー:', error);
      throw new Error(`ファイルの読み込みに失敗しました: ${error.message}`);
    }
  },

  // ウィンドウにフォーカスを設定
  focusWindow: () => ipcRenderer.invoke('focus-window'),

  // ファイルのハッシュ値を計算
  calculateFileHash: (filePath) => ipcRenderer.invoke('calculate-file-hash', filePath),

  // CSVファイルに書き込む
  writeCsvFile: (filePath, content) => ipcRenderer.invoke('write-csv-file', filePath, content)
};