const { contextBridge, ipcRenderer } = require('electron');

// レンダラープロセスに公開するAPIを定義
contextBridge.exposeInMainWorld('electronAPI', {
  // ディレクトリ選択ダイアログを開く
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  
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
  }
});