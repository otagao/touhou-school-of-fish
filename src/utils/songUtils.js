/**
 * 楽曲データ処理に関するユーティリティ関数群
 */

const Song = require('../models/Song.js');

/**
 * CSV行をパースして値の配列を返す（JSON配列形式対応）
 * @param {string} line CSV行
 * @returns {string[]} パースされた値の配列
 */
function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inBracket = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '[') {
      inBracket = true;
      current += char;
    } else if (char === ']') {
      inBracket = false;
      current += char;
    } else if (char === ',' && !inBracket) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // 最後の値を追加
  if (current) {
    values.push(current);
  }

  return values;
}

/**
 * JSON配列形式の文字列をパースして配列に変換
 * @param {string} value JSON配列形式の文字列（例: '["道中", "1面"]'）
 * @returns {string[]} パースされた配列、失敗時は元の値を含む配列
 */
function parseJsonArrayValue(value) {
  const trimmed = value.trim();

  // JSON配列形式かチェック
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      console.warn('JSON配列のパースに失敗しました:', value, e);
    }
  }

  // JSON配列でない場合は、値が空でなければ配列として返す
  return trimmed ? [trimmed] : [];
}

/**
 * CSVデータから楽曲情報を解析する（強化版: JSON配列対応、詳細ログ）
 * @param {string} csvContent CSVファイルの内容
 * @param {string} platform プラットフォーム ('win32' | 'darwin' | 'linux')
 * @returns {Array} 楽曲情報の配列
 */
function parseSongDataFromCsv(csvContent, platform = 'win32') {
  try {
    console.log('[songUtils.js] CSVパース処理を開始します');

    const lines = csvContent.split('\n');
    console.log(`[songUtils.js] CSVの行数: ${lines.length}`);

    if (lines.length === 0) {
      console.error('[songUtils.js] CSVファイルが空です');
      throw new Error('CSVファイルが空です');
    }

    const headers = parseCsvLine(lines[0]);
    console.log(`[songUtils.js] CSVのヘッダー: ${headers.join(', ')}`);

    if (headers.length < 2) {
      console.error('[songUtils.js] CSVヘッダーの形式が不正です');
      throw new Error('CSVヘッダーの形式が不正です');
    }

    const songs = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) {
        console.log(`[songUtils.js] 行 ${i}: 空行のためスキップします`);
        continue;
      }

      const values = parseCsvLine(lines[i]);
      console.log(`[songUtils.js] 行 ${i}: ${values.length}個の値を検出`);

      if (values.length < 2) {
        console.warn(`[songUtils.js] 行 ${i}: 値の数が少ないため、この行はスキップします`);
        continue;
      }

      // CSVフォーマット: ファイル名,曲名,シリーズ区分,楽曲タイプ,登場作品,担当キャラクター,場面,ファイルハッシュ
      // ファイル名以外の全ての列でJSON配列形式に対応
      let filename = values[0]?.trim() || '';
      // Windows環境ではスラッシュをバックスラッシュに変換
      if (platform === 'win32') {
        filename = filename.replace(/\//g, '\\');
      }

      // JSON配列形式をパース（配列の場合は配列として保持）
      const title = parseJsonArrayValue(values[1]?.trim() || '');
      const generation = parseJsonArrayValue(values[2]?.trim() || '');
      const type = parseJsonArrayValue(values[3]?.trim() || '');
      const game = parseJsonArrayValue(values[4]?.trim() || '');
      const character = parseJsonArrayValue(values[5]?.trim() || '');
      const stage = parseJsonArrayValue(values[6]?.trim() || '');
      const fileHash = parseJsonArrayValue(values[7]?.trim() || ''); // ★追加: ファイルハッシュ値（JSON配列対応）

      // タイトルは配列なので、配列が空でないか、または最初の要素が存在するかをチェック
      const hasTitle = Array.isArray(title) && title.length > 0 && title[0];
      if (!filename || !hasTitle) {
        console.warn(`[songUtils.js] 行 ${i}: ファイル名または曲名が空のため、この行はスキップします`);
        continue;
      }

      // Songインスタンスを生成
      const song = new Song({
        filename: filename,
        title: title,
        generation: generation,
        type: type,
        game: game,
        character: character,
        stage: stage,
        filePath: '',
        fileHash: fileHash // ★追加: ファイルハッシュ値
      });

      songs.push(song);

      // 最初の数件だけ詳細ログを出力
      if (i <= 3) {
        console.log(`[songUtils.js] 楽曲データの例 (行 ${i}):`, JSON.stringify(song));
      }
    }

    console.log(`[songUtils.js] ${songs.length}曲の情報を読み込みました。`);

    if (songs.length === 0) {
      console.error('[songUtils.js] 有効な楽曲データがありません');
      throw new Error('有効な楽曲データがありません');
    }

    return songs;
  } catch (error) {
    console.error('[songUtils.js] CSVパースエラー:', error);
    throw new Error(`CSVパースエラー: ${error.message}`);
  }
}
  
/**
 * 楽曲データと音声ファイルをマッチングする（ハッシュ優先・パス併用版）
 * @param {Array} songs 楽曲情報の配列
 * @param {Array} audioFiles 音声ファイルパスの配列
 * @param {string} musicDirectory 音楽ディレクトリのパス
 * @param {string} recognitionMode 認識モード ('hash-first' | 'path-first')
 * @param {Function} progressCallback プログレス報告用コールバック関数
 * @returns {Promise<Array>} マッチング済みの楽曲情報の配列
 */
async function matchSongsWithFiles(songs, audioFiles, musicDirectory, recognitionMode = 'hash-first', progressCallback = null) {
  const fileUtils = require('./fileUtils.js');
  const hashUtils = require('./hashUtils.js');

  try {
    console.log('[songUtils.js] ファイルマッチング処理を開始します');
    console.log(`[songUtils.js] 認識モード: ${recognitionMode}`);
    console.log(`[songUtils.js] 処理対象の楽曲データ数: ${songs.length}`);
    console.log(`[songUtils.js] 検出された音声ファイル数: ${audioFiles.length}`);

    // 1. 検出された音声ファイルのマップを作成
    //    キー: 音楽ディレクトリからの相対パス（拡張子なし、小文字）
    //    バリュー: ファイルのフルパス
    const audioFileMap = new Map();
    for (const fullPath of audioFiles) {
      // 音楽ディレクトリからの相対パスを取得
      let relativePath = fullPath;
      if (musicDirectory && fullPath.toLowerCase().startsWith(musicDirectory.toLowerCase())) {
        relativePath = fullPath.slice(musicDirectory.length);
        // 先頭のパス区切り文字を削除
        if (relativePath.startsWith('\\') || relativePath.startsWith('/')) {
          relativePath = relativePath.slice(1);
        }
      }

      // 拡張子を除去して小文字に変換
      const relativePathNoExt = fileUtils.removeExtension(relativePath).toLowerCase();

      if (relativePathNoExt && !audioFileMap.has(relativePathNoExt)) {
        audioFileMap.set(relativePathNoExt, fullPath);
      }
    }

    console.log(`[songUtils.js] パスベースマップ作成完了。ユニークなパス数: ${audioFileMap.size}`);

    // 2. 第一段階のマッチング処理（優先モードに応じた処理）
    let matchCount = 0;
    let hashMatchCount = 0;
    let pathMatchCount = 0;
    let noMatchCount = 0;
    const unmatchedSongs = []; // 第一段階でマッチしなかった楽曲

    if (recognitionMode === 'hash-first') {
      // ハッシュ優先モード: まずハッシュ情報がある楽曲をハッシュでマッチング
      console.log('[songUtils.js] ハッシュ優先モード: ハッシュ認識を実行します');

      // ハッシュ情報がある楽曲を抽出
      const songsWithHash = songs.filter(song => {
        if (Array.isArray(song.fileHash)) {
          return song.fileHash.length > 0 && song.fileHash.some(hash => hash && hash.trim() !== '');
        }
        return song.fileHash && song.fileHash.trim() !== '';
      });

      const matchedFilePaths = new Set(); // ハッシュでマッチしたファイルパスを記録

      if (songsWithHash.length > 0) {
        console.log(`[songUtils.js] ${songsWithHash.length}曲にハッシュ情報があります。ハッシュを計算します...`);

        // 全ファイルのハッシュを計算
        const hashMap = await hashUtils.calculateMultipleHashes(
          audioFiles,
          (current, total) => {
            if (current % 10 === 0 || current === total) {
              console.log(`[songUtils.js] ハッシュ計算進捗: ${current}/${total}`);
            }
            if (progressCallback) {
              progressCallback(current, total);
            }
          }
        );

        // ハッシュ値をキー、ファイルパスをバリューとするマップを作成
        const hashFileMap = new Map();
        for (const [filePath, hash] of hashMap.entries()) {
          hashFileMap.set(hash, filePath);
        }
        console.log(`[songUtils.js] ハッシュベースマップ作成完了。ユニークなハッシュ数: ${hashFileMap.size}`);

        // ハッシュマッチング
        for (const song of songs) {
          let matched = false;
          const hashArray = Array.isArray(song.fileHash) ? song.fileHash : [song.fileHash];

          for (const hash of hashArray) {
            if (hash && hash.trim() !== '' && hashFileMap.has(hash)) {
              const filePath = hashFileMap.get(hash);
              song.filePath = filePath;
              song.fileExists = true;
              matchedFilePaths.add(filePath); // マッチしたファイルを記録
              matched = true;
              hashMatchCount++;
              matchCount++;
              break;
            }
          }

          if (!matched) {
            unmatchedSongs.push(song);
          }
        }
      } else {
        // ハッシュ情報がない場合はすべて未マッチ扱い
        unmatchedSongs.push(...songs);
      }

      console.log(`[songUtils.js] ハッシュ認識完了: ${hashMatchCount}曲マッチ、${unmatchedSongs.length}曲未マッチ`);

      // フォールバック: パス認識（ハッシュでマッチしなかったファイルのパスのみチェック）
      if (unmatchedSongs.length > 0) {
        console.log(`[songUtils.js] ${unmatchedSongs.length}曲をパス認識でフォールバック処理します`);

        // ハッシュでマッチしなかったファイルのみをパス認識対象にする
        // audioFileMapから既にマッチしたファイルを除外した新しいマップを作成
        const unmatchedAudioFileMap = new Map();
        for (const [pathKey, filePath] of audioFileMap.entries()) {
          if (!matchedFilePaths.has(filePath)) {
            unmatchedAudioFileMap.set(pathKey, filePath);
          }
        }
        console.log(`[songUtils.js] ${unmatchedAudioFileMap.size}個のファイル（全${audioFileMap.size}個中）をパス認識対象にします`);

        for (const song of unmatchedSongs) {
          const csvPathLower = song.filename.toLowerCase();
          if (csvPathLower && unmatchedAudioFileMap.has(csvPathLower)) {
            song.filePath = unmatchedAudioFileMap.get(csvPathLower);
            song.fileExists = true;
            pathMatchCount++;
            matchCount++;
          } else {
            song.filePath = '';
            song.fileExists = false;
            noMatchCount++;
          }
        }
        console.log(`[songUtils.js] パス認識フォールバック完了: ${pathMatchCount}曲マッチ`);
      }

    } else {
      // パス優先モード: まずパスでマッチング
      console.log('[songUtils.js] パス優先モード: パス認識を実行します');

      const matchedFilePaths = new Set(); // パスでマッチしたファイルパスを記録

      for (const song of songs) {
        const csvPathLower = song.filename.toLowerCase();
        if (csvPathLower && audioFileMap.has(csvPathLower)) {
          const filePath = audioFileMap.get(csvPathLower);
          song.filePath = filePath;
          song.fileExists = true;
          matchedFilePaths.add(filePath); // マッチしたファイルを記録
          pathMatchCount++;
          matchCount++;
        } else {
          unmatchedSongs.push(song);
        }
      }

      console.log(`[songUtils.js] パス認識完了: ${pathMatchCount}曲マッチ、${unmatchedSongs.length}曲未マッチ`);

      // フォールバック: ハッシュ認識（未マッチの楽曲のうちハッシュ情報があるもののみ）
      if (unmatchedSongs.length > 0) {
        const unmatchedWithHash = unmatchedSongs.filter(song => {
          if (Array.isArray(song.fileHash)) {
            return song.fileHash.length > 0 && song.fileHash.some(hash => hash && hash.trim() !== '');
          }
          return song.fileHash && song.fileHash.trim() !== '';
        });

        if (unmatchedWithHash.length > 0) {
          console.log(`[songUtils.js] ${unmatchedWithHash.length}曲をハッシュ認識でフォールバック処理します`);

          // パスでマッチしなかったファイルのみをハッシュ計算対象にする
          const unmatchedFiles = audioFiles.filter(file => !matchedFilePaths.has(file));
          console.log(`[songUtils.js] ${unmatchedFiles.length}個のファイル（全${audioFiles.length}個中）のハッシュを計算します`);

          // フォールバック用にマッチしなかったファイルのみハッシュを計算
          const hashMap = await hashUtils.calculateMultipleHashes(
            unmatchedFiles,
            (current, total) => {
              if (current % 10 === 0 || current === total) {
                console.log(`[songUtils.js] ハッシュ計算進捗: ${current}/${total}`);
              }
              if (progressCallback) {
                progressCallback(current, total);
              }
            }
          );

          // ハッシュ値をキー、ファイルパスをバリューとするマップを作成
          const hashFileMap = new Map();
          for (const [filePath, hash] of hashMap.entries()) {
            hashFileMap.set(hash, filePath);
          }
          console.log(`[songUtils.js] ハッシュベースマップ作成完了。ユニークなハッシュ数: ${hashFileMap.size}`);

          // ハッシュマッチング
          for (const song of unmatchedSongs) {
            let matched = false;
            const hashArray = Array.isArray(song.fileHash) ? song.fileHash : [song.fileHash];

            for (const hash of hashArray) {
              if (hash && hash.trim() !== '' && hashFileMap.has(hash)) {
                song.filePath = hashFileMap.get(hash);
                song.fileExists = true;
                matched = true;
                hashMatchCount++;
                matchCount++;
                break;
              }
            }

            if (!matched) {
              song.filePath = '';
              song.fileExists = false;
              noMatchCount++;
            }
          }
          console.log(`[songUtils.js] ハッシュ認識フォールバック完了: ${hashMatchCount}曲マッチ`);
        } else {
          // ハッシュ情報がない未マッチ楽曲は認識失敗として処理
          for (const song of unmatchedSongs) {
            song.filePath = '';
            song.fileExists = false;
            noMatchCount++;
          }
        }
      }
    }

    console.log(`[songUtils.js] マッチング処理完了: ${matchCount} / ${songs.length} 曲`);
    console.log(`[songUtils.js]   ハッシュマッチ: ${hashMatchCount}曲`);
    console.log(`[songUtils.js]   パスマッチ: ${pathMatchCount}曲`);
    console.log(`[songUtils.js]   未マッチ: ${noMatchCount}曲`);

    // マッチしたファイルが一つもない場合のエラーハンドリング
    if (matchCount === 0 && songs.length > 0) {
      const errorMsg = '楽曲データと音声ファイルが一つもマッチしませんでした。\n\n' +
                       '考えられる原因:\n' +
                       '- 音楽フォルダの指定が間違っている。\n' +
                       '- CSVファイルの「ファイル名」列や「ファイルハッシュ」列の値が正しくない。\n' +
                       '- 音楽フォルダ内に対応する音声ファイルが存在しない。\n\n' +
                       '設定とファイルを確認してください。';
      console.error('[songUtils.js] ' + errorMsg.replace(/\n/g, ' '));
      throw new Error('ファイルマッチングエラー: 楽曲データと音声ファイルが一つもマッチしませんでした');
    }

    return songs;
  } catch (error) {
    console.error('[songUtils.js] ファイルマッチングエラー:', error);
    throw new Error(`ファイルマッチングエラー: ${error.message}`);
  }
}
  
/**
 * 楽曲をフィルタリングする（強化版: 複数フィルタ、AND検索、配列フィールド対応）
 * @param {Array} songs 楽曲情報の配列
 * @param {Object} filters フィルター条件
 *   - keywords: string[] - 検索キーワード（AND検索）
 *   - types: string[] - 選択されたタイプ
 *   - generations: string[] - 選択されたシリーズ区分
 *   - games: string[] - 選択された作品名
 *   - stages: string[] - 選択されたステージ・場面
 * @returns {Array} フィルター済みの楽曲情報の配列
 */
function filterSongs(songs, filters) {
  const keywords = filters.keywords || [];
  const selectedTypes = filters.types || [];
  const selectedGenerations = filters.generations || [];
  const selectedGames = filters.games || [];
  const selectedStages = filters.stages || [];

  return songs.filter(song => {
    // 1. テキスト検索 (AND検索) - titleとcharacterのみに限定
    // titleとcharacterは配列の可能性があるため、配列の全要素を検索対象にする
    let keywordMatch = true;
    if (keywords.length > 0) {
      keywordMatch = keywords.every(keyword => {
        // 配列を平坦化して検索対象フィールドのリストを作成
        const titleArray = Array.isArray(song.title) ? song.title : [song.title];
        const characterArray = Array.isArray(song.character) ? song.character : [song.character];
        const searchFields = [...titleArray, ...characterArray];

        return searchFields.some(field =>
          field && typeof field === 'string' && field.toLowerCase().includes(keyword.toLowerCase())
        );
      });
    }
    if (!keywordMatch) return false;

    // 2. タイプフィルター (カテゴリ内でOR、未選択ならそのカテゴリは無視)
    // 全ての属性は配列の可能性があるため、配列として扱う
    if (selectedTypes.length > 0) {
      const typeArray = Array.isArray(song.type) ? song.type : [song.type];
      const hasMatch = typeArray.some(type => selectedTypes.includes(type));
      if (!hasMatch) return false;
    }

    // 3. シリーズ区分フィルター
    if (selectedGenerations.length > 0) {
      const generationArray = Array.isArray(song.generation) ? song.generation : [song.generation];
      const hasMatch = generationArray.some(gen => selectedGenerations.includes(gen));
      if (!hasMatch) return false;
    }

    // 4. 作品名フィルター
    if (selectedGames.length > 0) {
      const gameArray = Array.isArray(song.game) ? song.game : [song.game];
      const hasMatch = gameArray.some(game => selectedGames.includes(game));
      if (!hasMatch) return false;
    }

    // 5. ステージ・場面フィルター
    if (selectedStages.length > 0) {
      const stageArray = Array.isArray(song.stage) ? song.stage : [song.stage];
      const hasMatch = stageArray.some(stage => selectedStages.includes(stage));
      if (!hasMatch) return false;
    }

    return true; // 全てのフィルター条件を通過
  });
}
  
  /**
   * 楽曲の比較関数
   * @param {Object} songA 楽曲A
   * @param {Object} songB 楽曲B
   * @param {string} sortBy ソート基準
   * @param {boolean} ascending 昇順かどうか
   * @returns {number} ソート順値
   */
  function compareSongs(songA, songB, sortBy = 'title', ascending = true) {
    let comparison = 0;
    
    switch (sortBy) {
      case 'title':
        comparison = songA.title.localeCompare(songB.title);
        break;
      case 'game':
        comparison = songA.game.localeCompare(songB.game);
        break;
      case 'type':
        comparison = songA.type.localeCompare(songB.type);
        break;
      default:
        comparison = 0;
    }
    
    return ascending ? comparison : -comparison;
  }
  
  /**
   * 楽曲をソートする
   * @param {Array} songs 楽曲情報の配列
   * @param {string} sortBy ソート基準
   * @param {boolean} ascending 昇順かどうか
   * @returns {Array} ソート済みの楽曲情報の配列
   */
  function sortSongs(songs, sortBy = 'title', ascending = true) {
    return [...songs].sort((a, b) => compareSongs(a, b, sortBy, ascending));
  }
  
/**
 * 楽曲から一意な属性値の配列を取得する（強化版: 配列フィールド対応）
 * @param {Array} songs 楽曲情報の配列
 * @param {string} attribute 取得する属性名
 * @param {string[]} predefinedValues 事前定義された値の配列（データに無くても表示したい場合）
 * @returns {Array} 一意な属性値の配列（ソート済み）
 */
function getUniqueAttributes(songs, attribute, predefinedValues = []) {
  if (!songs || songs.length === 0) return [...predefinedValues].sort();
  const uniqueValues = new Set(predefinedValues);

  songs.forEach(song => {
    const value = song[attribute];

    // 配列の場合は各要素を個別に追加
    if (Array.isArray(value)) {
      value.forEach(item => {
        if (item && typeof item === 'string' && item.trim() !== '') {
          uniqueValues.add(item.trim());
        }
      });
    }
    // 文字列の場合は直接追加
    else if (value && typeof value === 'string' && value.trim() !== '') {
      uniqueValues.add(value.trim());
    }
  });

  return Array.from(uniqueValues).sort();
}
  
// エクスポート
module.exports = {
  parseCsvLine,
  parseJsonArrayValue,
  parseSongDataFromCsv,
  matchSongsWithFiles,
  filterSongs,
  sortSongs,
  getUniqueAttributes
};