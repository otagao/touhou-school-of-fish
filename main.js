const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { promises: fsPromises } = require('fs'); // fs.promises をインポート

// アプリケーションのグローバル参照を防ぐため
let mainWindow = null;

function createWindow() {
  // ブラウザウィンドウを作成
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
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

async function findFilesRecursive(dir, extensions, allFiles = []) {
  try {
    const dirents = await fsPromises.readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
      const fullPath = path.resolve(dir, dirent.name);
      if (dirent.isDirectory()) {
        // '.' で始まる隠しディレクトリなどはスキップした方が良い場合がある
        if (!dirent.name.startsWith('.')) {
           await findFilesRecursive(fullPath, extensions, allFiles); // 再帰呼び出し
        }
      } else if (dirent.isFile()){ // direntがファイルの場合のみ処理
        const ext = path.extname(dirent.name).toLowerCase();
        // 拡張子フィルターが指定されているか、または指定された拡張子リストに含まれるか
        if (!extensions || extensions.length === 0 || extensions.includes(ext)) {
          allFiles.push(fullPath); // フルパスを追加
        }
      }
    }
  } catch (err) {
    // アクセス権がないなどの理由でエラーが発生した場合
    console.error(`Error reading directory ${dir}: ${err.message}`);
    // エラーが発生しても処理を続行させる（エラーが発生したディレクトリはスキップされる）
  }
  return allFiles;
}

// ディレクトリ内のファイル一覧を取得
ipcMain.handle('get-files-in-directory', async (event, directoryPath, extensions) => {
  if (!directoryPath) {
    console.error('[main.js] ディレクトリパスが指定されていません');
    return [];
  }

  try {
    console.log(`[main.js] ディレクトリ内のファイル一覧を再帰的に取得: ${directoryPath}`);
    console.log(`[main.js] 拡張子フィルター: ${extensions ? extensions.join(', ') : 'なし'}`);

    // 再帰探索関数を呼び出す
    const allAudioFiles = await findFilesRecursive(directoryPath, extensions);

    console.log(`[main.js] フィルタリング後のファイル数 (再帰探索含む): ${allAudioFiles.length}`);

    // 最初の数件だけログ出力（デバッグ用）
    if (allAudioFiles.length > 0) {
      console.log('[main.js] ファイルの例:');
      allAudioFiles.slice(0, 5).forEach(file => console.log(` - ${file}`));
    }

    return allAudioFiles; // フルパスの配列を返す
  } catch (error) {
    console.error('[main.js] ディレクトリ読み込みエラー:', error);
    // レンダラープロセスにエラー情報を伝えるために、エラーメッセージを含む新しいエラーをスロー
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

// ウィンドウにフォーカスを設定
ipcMain.handle('focus-window', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return true;
  }
  return false;
});

// ファイルのMD5ハッシュ値を計算
ipcMain.handle('calculate-file-hash', async (event, filePath) => {
  const crypto = require('crypto');

  if (!filePath) {
    console.error('[main.js] ファイルパスが指定されていません');
    throw new Error('ファイルパスが指定されていません');
  }

  try {
    console.log(`[main.js] ハッシュ計算: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      console.error(`[main.js] ファイルが存在しません: ${filePath}`);
      throw new Error(`ファイルが存在しません: ${filePath}`);
    }

    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => {
        const hashValue = hash.digest('hex');
        console.log(`[main.js] ハッシュ計算完了: ${hashValue}`);
        resolve(hashValue);
      });
      stream.on('error', (err) => {
        console.error(`[main.js] ハッシュ計算エラー:`, err);
        reject(err);
      });
    });
  } catch (error) {
    console.error('[main.js] ハッシュ計算エラー:', error);
    throw new Error(`ハッシュ計算に失敗しました: ${error.message}`);
  }
});

// CSVファイルにハッシュ値を書き込む
ipcMain.handle('write-csv-file', async (event, filePath, content) => {
  if (!filePath || !content) {
    console.error('[main.js] ファイルパスまたはコンテンツが指定されていません');
    throw new Error('ファイルパスまたはコンテンツが指定されていません');
  }

  try {
    console.log(`[main.js] CSVファイル書き込み: ${filePath}`);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('[main.js] CSVファイル書き込み成功');
    return true;
  } catch (error) {
    console.error('[main.js] CSVファイル書き込みエラー:', error);
    throw new Error(`CSVファイルの書き込みに失敗しました: ${error.message}`);
  }
});