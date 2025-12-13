/**
 * ファイル操作に関するユーティリティ関数群
 */

/**
 * ファイル名からファイル拡張子を取得する
 * @param {string} filename ファイル名
 * @returns {string} 拡張子（ドット含む、小文字）
 */
function getFileExtension(filename) {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) return ''; // 拡張子なし
    return filename.slice(lastDotIndex).toLowerCase();
  }
  
  /**
   * ファイル名から拡張子を除いた部分を取得する
   * @param {string} filename ファイル名
   * @returns {string} 拡張子を除いたファイル名
   */
  function getBaseName(filename) {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) return filename; // 拡張子なし
    return filename.slice(0, lastDotIndex);
  }
  
  /**
   * パスからファイル名部分を取得する
   * @param {string} filePath ファイルパス
   * @returns {string} ファイル名
   */
  function getFileName(filePath) {
    // OSに依存しない形で最後のパス区切り文字以降を取得
    const normalizedPath = filePath.replace(/\\/g, '/');
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    if (lastSlashIndex === -1) return filePath; // パス区切りなし
    return normalizedPath.slice(lastSlashIndex + 1);
  }
  
  /**
   * 指定された拡張子の配列に一致するかどうかを判定する
   * @param {string} filename ファイル名
   * @param {string[]} extensions 拡張子の配列（ドット含む、小文字）
   * @returns {boolean} いずれかの拡張子と一致すればtrue
   */
  function isMatchingExtension(filename, extensions) {
    if (!extensions || extensions.length === 0) return true;
    const fileExt = getFileExtension(filename);
    return extensions.includes(fileExt);
  }
  
  /**
   * CSVファイルを検証する（基本的な形式チェック）
   * @param {string} content CSVファイルの内容
   * @returns {boolean} 有効なCSVファイルであればtrue
   */
  function validateCsvFormat(content) {
    if (!content || typeof content !== 'string') return false;
    
    // 最低限の行数と列数をチェック
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return false; // ヘッダー + 少なくとも1行のデータ
    
    // ヘッダー行を解析
    const headers = lines[0].split(',');
    if (headers.length < 3) return false; // 最低限必要なカラム数
    
    // ヘッダーの内容をチェックすることもできる
    // return headers.includes('曲名') && headers.includes('ファイル名'); など
    
    return true;
  }
  
  // エクスポート
  module.exports = {
    getFileExtension,
    getBaseName,
    getFileName,
    isMatchingExtension,
    validateCsvFormat
  };