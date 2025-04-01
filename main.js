const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// アプリケーションのグローバル参照を防ぐため
let mainWindow = null;

function createWindow() {
  // ブラウザウィンドウを作成
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    }
  });

  // index.htmlをロード
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // 開発者ツールを開く
  // mainWindow.webContents.openDevTools();

  // ウィンドウが閉じられたときに発火
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Electronの初期化が完了した時に呼ばれる
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // macOS特有の挙動: ドックアイコンがクリックされたときにウィンドウがなければ作成
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// macOS以外では、全てのウィンドウが閉じられたときにアプリケーションを終了
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC通信のハンドラー
// ディレクトリ選択ダイアログを開く
ipcMain.handle('open-directory-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.filePaths[0];
});

// ファイル選択ダイアログを開く
ipcMain.handle('open-file-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options?.filters || [{ name: 'CSV Files', extensions: ['csv'] }]
  });
  return result.filePaths[0];
});

// ディレクトリ内のファイル一覧を取得
ipcMain.handle('get-files-in-directory', async (event, directoryPath, extensions) => {
  if (!directoryPath) {
    console.error('ディレクトリパスが指定されていません');
    return [];
  }
  
  try {
    console.log(`ディレクトリ内のファイル一覧を取得: ${directoryPath}`);
    console.log(`拡張子フィルター: ${extensions ? extensions.join(', ') : 'なし'}`);
    
    const files = fs.readdirSync(directoryPath);
    console.log(`ディレクトリ内のファイル数: ${files.length}`);
    
    let result;
    if (!extensions || extensions.length === 0) {
      result = files.map(file => path.join(directoryPath, file));
    } else {
      result = files
        .filter(file => {
          const ext = path.extname(file).toLowerCase();
          return extensions.includes(ext);
        })
        .map(file => path.join(directoryPath, file));
    }
    
    console.log(`フィルタリング後のファイル数: ${result.length}`);
    
    // 最初の数件だけログ出力
    if (result.length > 0) {
      console.log('ファイルの例:');
      result.slice(0, 3).forEach(file => console.log(` - ${file}`));
    }
    
    return result;
  } catch (error) {
    console.error('ディレクトリ読み込みエラー:', error);
    throw new Error(`ディレクトリの読み込みに失敗しました: ${error.message}`);
  }
});

// ファイルの内容を読み込む
ipcMain.handle('read-file', async (event, filePath) => {
  if (!filePath) {
    console.error('ファイルパスが指定されていません');
    return null;
  }
  
  try {
    console.log(`ファイルの読み込み: ${filePath}`);
    
    // ファイルが存在するか確認
    if (!fs.existsSync(filePath)) {
      console.error(`ファイルが存在しません: ${filePath}`);
      throw new Error(`ファイルが存在しません: ${filePath}`);
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    console.log(`ファイル読み込み成功: ${filePath}, サイズ: ${content.length}バイト`);
    
    if (content.length > 0) {
      console.log(`ファイル内容の最初の100文字: ${content.substring(0, 100)}`);
    } else {
      console.warn('ファイルの内容が空です');
    }
    
    return content;
  } catch (error) {
    console.error('ファイル読み込みエラー:', error);
    throw new Error(`ファイルの読み込みに失敗しました: ${error.message}`);
  }
});