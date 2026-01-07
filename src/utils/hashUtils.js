/**
 * ファイルハッシュ計算に関するユーティリティ関数群
 */
const crypto = require('crypto');
const fs = require('fs');

/**
 * ファイルのMD5ハッシュ値を計算する
 * @param {string} filePath ファイルパス
 * @returns {Promise<string>} MD5ハッシュ値（32文字の16進数文字列）
 */
async function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

/**
 * 複数ファイルのハッシュ値を計算する（進捗コールバック付き）
 * @param {string[]} filePaths ファイルパスの配列
 * @param {Function} onProgress 進捗コールバック (current, total)
 * @returns {Promise<Map<string, string>>} ファイルパスをキー、ハッシュ値をバリューとするMap
 */
async function calculateMultipleHashes(filePaths, onProgress = null) {
  const hashMap = new Map();

  for (let i = 0; i < filePaths.length; i++) {
    try {
      const hash = await calculateFileHash(filePaths[i]);
      hashMap.set(filePaths[i], hash);

      if (onProgress) {
        onProgress(i + 1, filePaths.length);
      }
    } catch (error) {
      console.error(`[hashUtils.js] ハッシュ計算エラー (${filePaths[i]}):`, error);
      // エラーが発生したファイルはスキップして続行
    }
  }

  return hashMap;
}

// エクスポート
module.exports = {
  calculateFileHash,
  calculateMultipleHashes
};
