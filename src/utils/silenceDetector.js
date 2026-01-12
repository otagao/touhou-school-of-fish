// silenceDetector.js - 音声ファイルの先頭無音部分を検出するユーティリティ
// Web Audio APIを使用して音声バッファを解析し、無音終了位置を検出

/**
 * 音声ファイルの先頭無音部分を検出するクラス
 */
class SilenceDetector {
  constructor() {
    this.cache = new Map(); // { filePath: startTime }
    this.threshold = 0.01; // 振幅の閾値（0-1）
    this.minSilenceDuration = 0.1; // 最小無音時間（秒）
  }

  /**
   * 無音終了位置（音声開始位置）を検出
   * @param {string} filePath - 音声ファイルのパス
   * @returns {Promise<number>} 音声開始位置（秒）
   */
  async detectSilenceStart(filePath) {
    // キャッシュチェック
    if (this.cache.has(filePath)) {
      console.log('[SilenceDetector] キャッシュヒット:', filePath);
      return this.cache.get(filePath);
    }

    try {
      console.log('[SilenceDetector] 解析開始:', filePath);

      // ファイルを取得
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`ファイルの取得に失敗: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();

      // AudioContextで音声バッファに変換
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (!audioContext) {
        throw new Error('Web Audio APIが非対応のブラウザです');
      }

      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // 無音検出実行
      const startTime = this._analyzeBuffer(audioBuffer);
      console.log('[SilenceDetector] 無音終了位置:', startTime, '秒');

      // キャッシュに保存
      this.cache.set(filePath, startTime);

      // AudioContextをクローズ（リソース解放）
      audioContext.close();

      return startTime;
    } catch (error) {
      console.error('[SilenceDetector] 解析エラー:', error);
      return 0; // フォールバック: 先頭から再生
    }
  }

  /**
   * AudioBufferを解析して無音終了位置を検出（内部メソッド）
   * @param {AudioBuffer} audioBuffer
   * @returns {number} 音声開始位置（秒）
   */
  _analyzeBuffer(audioBuffer) {
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0); // モノラルまたは左チャンネル

    // 最大5秒分のみ解析（パフォーマンス最適化）
    const maxSamplesToAnalyze = Math.min(
      channelData.length,
      sampleRate * 5
    );

    // サンプル単位で走査
    for (let i = 0; i < maxSamplesToAnalyze; i++) {
      const amplitude = Math.abs(channelData[i]);

      if (amplitude > this.threshold) {
        // 音声開始位置を検出
        const startTimeInSeconds = i / sampleRate;
        return startTimeInSeconds;
      }
    }

    // 無音が続く場合は0を返す
    return 0;
  }

  /**
   * 閾値を設定
   * @param {number} threshold - 新しい閾値（0-1）
   */
  setThreshold(threshold) {
    this.threshold = threshold;
    // 閾値変更時はキャッシュをクリア
    this.cache.clear();
    console.log('[SilenceDetector] 閾値を変更:', threshold);
  }

  /**
   * キャッシュをクリア
   */
  clearCache() {
    this.cache.clear();
    console.log('[SilenceDetector] キャッシュをクリアしました');
  }
}

module.exports = { SilenceDetector };
