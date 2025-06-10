/**
 * 楽曲データ処理に関するユーティリティ関数群
 */

/**
 * CSVデータから楽曲情報を解析する
 * @param {string} csvContent CSVファイルの内容
 * @returns {Array} 楽曲情報の配列
 */
function parseSongDataFromCsv(csvContent) {
    // PapaParseを使った実装は、ライブラリのインポート後に切り替え
    // ここでは簡易実装
    const lines = csvContent.split('\n');
    const headers = lines[0].split(','); // ヘッダーの列数は増える
    
    const songs = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',');
      const song = {};
      
      // CSVフォーマット: ファイル名,曲名,旧作or現行,初出orアレンジ,登場作品,担当キャラクター,ステージ・場面
      song.filename = values[0]?.trim() || '';
      song.title = values[1]?.trim() || '';
      song.generation = values[2]?.trim() || ''; // 旧作or現行, 西方等, 黄昏
      song.type = values[3]?.trim() || ''; // 初出orアレンジ, 再録
      song.game = values[4]?.trim() || ''; // 登場作品
      song.character = values[5]?.trim() || ''; // 担当キャラクター
      song.stage = values[6]?.trim() || ''; // ★追加: ステージ・場面
      song.filePath = ''; // 実際のファイルパスは後で設定
      
      songs.push(song);
    }
    
    return songs;
  }
  
  /**
   * 楽曲データと音声ファイルをマッチングする
   * @param {Array} songs 楽曲情報の配列
   * @param {Array} audioFiles 音声ファイルパスの配列
   * @returns {Array} マッチング済みの楽曲情報の配列
   */
  function matchSongsWithFiles(songs, audioFiles) {
    // ファイル名からファイルパスのマップを作成
    const fileMap = {};
    audioFiles.forEach(filePath => {
      const fileName = filePath.split('/').pop().split('\\').pop();
      fileMap[fileName] = filePath;
    });
    
    // 楽曲データとファイルをマッチング
    let matchCount = 0;
    
    songs.forEach(song => {
      if (fileMap[song.filename]) {
        song.filePath = fileMap[song.filename];
        song.fileExists = true;
        matchCount++;
      } else {
        song.fileExists = false;
      }
    });
    
    console.log(`${matchCount}/${songs.length}曲のファイルとマッチしました。`);
    return songs;
  }
  
  /**
   * 楽曲をフィルタリングする
   * @param {Array} songs 楽曲情報の配列
   * @param {Object} filters フィルター条件
   * @returns {Array} フィルター済みの楽曲情報の配列
   */
  function filterSongs(songs, filters) {
    return songs.filter(song => {
      // ファイルが存在しない曲は除外
      if (filters.onlyWithFile && !song.fileExists) {
        return false;
      }
      
      // タイトルで検索
      if (filters.title && !song.title.toLowerCase().includes(filters.title.toLowerCase())) {
        return false;
      }
      
      // 初出/アレンジでフィルタ
      if (filters.type) {
        if (filters.type === 'original' && song.type !== '初出') {
          return false;
        } else if (filters.type === 'arrange' && song.type !== 'アレンジ') {
          return false;
        }
      }
      
      // 作品でフィルタ
      if (filters.game && song.game !== filters.game) {
        return false;
      }
      
      // キャラクターでフィルタ
      if (filters.character && song.character !== filters.character) {
        return false;
      }
      
      return true;
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
   * 楽曲から一意な属性値の配列を取得する（フィルタリング用）
   * @param {Array} songs 楽曲情報の配列
   * @param {string} attribute 取得する属性名
   * @returns {Array} 一意な属性値の配列（ソート済み）
   */
  function getUniqueAttributes(songs, attribute) {
    const uniqueValues = new Set();
    
    songs.forEach(song => {
      if (song[attribute]) {
        uniqueValues.add(song[attribute]);
      }
    });
    
    return Array.from(uniqueValues).sort();
  }
  
  // エクスポート
  module.exports = {
    parseSongDataFromCsv,
    matchSongsWithFiles,
    filterSongs,
    sortSongs,
    getUniqueAttributes
  };