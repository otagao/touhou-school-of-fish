// audio-player.js - HTML5 Audio要素のラッパークラス
// listening-modeとquiz-modeで共有される音楽再生機能を提供

const { SilenceDetector } = require('../utils/silenceDetector.js');

/**
 * オーディオプレーヤーを管理するクラス
 * HTML5 Audio要素のラッパーとして、共通の再生制御APIを提供
 */
class AudioPlayerController {
  constructor() {
    this.audioElement = null;
    this.isPlaying = false;
    this.isPaused = false;

    // 頭出し機能関連
    this.silenceDetector = new SilenceDetector();
    this.trimSilenceEnabled = true; // デフォルトで有効
    this.startTime = 0; // 検出された音声開始位置

    // イベントリスナーへの参照を保持（cleanup時に削除するため）
    this.eventHandlers = {
      loadedmetadata: null,
      canplay: null,
      ended: null,
      error: null
    };
  }

  /**
   * 楽曲を読み込む
   * @param {string} filePath 楽曲ファイルのパス
   * @param {number} volume 音量（0.0〜1.0）
   * @param {Object} options オプション設定
   * @param {boolean} options.trimSilence 頭出し機能を使用するか（デフォルト: this.trimSilenceEnabled）
   * @returns {Promise} 読み込み完了を待つPromise
   */
  async load(filePath, volume = 1.0, options = {}) {
    const { trimSilence = this.trimSilenceEnabled } = options;

    return new Promise(async (resolve, reject) => {
      try {
        // 既存のオーディオをクリーンアップ
        this.cleanup();

        console.log(`[AudioPlayerController] 楽曲を読み込み中: ${filePath}`);

        // 頭出し機能が有効な場合、無音検出を実行
        let startTime = 0;
        if (trimSilence) {
          try {
            startTime = await this.silenceDetector.detectSilenceStart(filePath);
            if (startTime > 0) {
              console.log(`[AudioPlayerController] 頭出し: ${startTime.toFixed(3)}秒から開始`);
            }
          } catch (err) {
            console.warn('[AudioPlayerController] 無音検出失敗、通常再生:', err);
          }
        }

        this.audioElement = new Audio(filePath);
        this.audioElement.volume = volume;
        this.startTime = startTime;

        // イベントハンドラーを設定
        this.eventHandlers.loadedmetadata = () => {
          console.log('[AudioPlayerController] オーディオメタデータ読み込み完了');
        };

        this.eventHandlers.canplay = () => {
          console.log('[AudioPlayerController] 再生準備完了');
          // 開始位置を設定
          if (this.startTime > 0) {
            this.audioElement.currentTime = this.startTime;
          }
          resolve();
        };

        this.eventHandlers.ended = () => {
          console.log('[AudioPlayerController] 楽曲の再生が終了しました');
          this.isPlaying = false;
          this.isPaused = false;
        };

        this.eventHandlers.error = (e) => {
          console.error('[AudioPlayerController] オーディオ再生エラー:', this.audioElement.error);
          reject(new Error(this.audioElement.error?.message || '不明なエラー'));
        };

        // イベントリスナーを登録
        this.audioElement.addEventListener('loadedmetadata', this.eventHandlers.loadedmetadata);
        this.audioElement.addEventListener('canplay', this.eventHandlers.canplay);
        this.audioElement.addEventListener('ended', this.eventHandlers.ended);
        this.audioElement.addEventListener('error', this.eventHandlers.error);

        // 読み込み開始
        this.audioElement.load();
      } catch (error) {
        console.error('[AudioPlayerController] 楽曲の読み込み中にエラーが発生:', error);
        reject(error);
      }
    });
  }

  /**
   * 楽曲を再生する
   * @returns {Promise} 再生開始を待つPromise
   */
  play() {
    if (!this.audioElement) {
      console.warn('[AudioPlayerController] オーディオが読み込まれていません');
      return Promise.reject(new Error('オーディオが読み込まれていません'));
    }

    console.log('[AudioPlayerController] 再生を開始します');
    this.isPlaying = true;
    this.isPaused = false;
    return this.audioElement.play();
  }

  /**
   * 楽曲を一時停止する
   */
  pause() {
    if (!this.audioElement) {
      console.warn('[AudioPlayerController] オーディオが読み込まれていません');
      return;
    }

    if (!this.audioElement.paused) {
      this.audioElement.pause();
      console.log('[AudioPlayerController] 楽曲を一時停止しました');
      this.isPlaying = false;
      this.isPaused = true;
    }
  }

  /**
   * 楽曲を停止する（一時停止して再生位置を先頭に戻す）
   */
  stop() {
    if (!this.audioElement) {
      return;
    }

    this.audioElement.pause();
    this.audioElement.currentTime = 0;
    console.log('[AudioPlayerController] 楽曲を停止しました');
    this.isPlaying = false;
    this.isPaused = false;
  }

  /**
   * 音量を設定する
   * @param {number} volume 音量（0.0〜1.0）
   */
  setVolume(volume) {
    if (this.audioElement) {
      this.audioElement.volume = Math.max(0, Math.min(1, volume));
      console.log(`[AudioPlayerController] 音量を${volume * 100}%に設定しました`);
    }
  }

  /**
   * 再生中かどうかを取得
   * @returns {boolean} 再生中の場合true
   */
  getIsPlaying() {
    return this.isPlaying;
  }

  /**
   * 一時停止中かどうかを取得
   * @returns {boolean} 一時停止中の場合true
   */
  getIsPaused() {
    return this.isPaused;
  }

  /**
   * カスタムイベントハンドラーを設定する
   * @param {string} eventName イベント名（'ended', 'error'など）
   * @param {Function} handler イベントハンドラー
   */
  on(eventName, handler) {
    if (!this.audioElement) {
      console.warn('[AudioPlayerController] オーディオが読み込まれていません');
      return;
    }

    // 既存のハンドラーを削除
    if (this.eventHandlers[eventName]) {
      this.audioElement.removeEventListener(eventName, this.eventHandlers[eventName]);
    }

    // 新しいハンドラーを設定
    this.eventHandlers[eventName] = handler;
    this.audioElement.addEventListener(eventName, handler);
  }

  /**
   * 頭出し機能のON/OFF切り替え
   * @param {boolean} enabled 有効にする場合true
   */
  setTrimSilenceEnabled(enabled) {
    this.trimSilenceEnabled = enabled;
    console.log(`[AudioPlayerController] 頭出し機能: ${enabled ? 'ON' : 'OFF'}`);
  }

  /**
   * 無音検出の閾値を設定
   * @param {number} threshold 閾値（0-1）
   */
  setSilenceThreshold(threshold) {
    this.silenceDetector.setThreshold(threshold);
    console.log(`[AudioPlayerController] 無音検出閾値を設定: ${threshold}`);
  }

  /**
   * クリーンアップ処理
   * オーディオ要素とイベントリスナーを解放する
   */
  cleanup() {
    if (this.audioElement) {
      // 再生を停止
      this.audioElement.pause();

      // イベントリスナーを削除
      Object.keys(this.eventHandlers).forEach(eventName => {
        if (this.eventHandlers[eventName]) {
          this.audioElement.removeEventListener(eventName, this.eventHandlers[eventName]);
          this.eventHandlers[eventName] = null;
        }
      });

      // srcをクリア
      this.audioElement.src = '';
      this.audioElement = null;

      this.isPlaying = false;
      this.isPaused = false;

      console.log('[AudioPlayerController] オーディオプレーヤーをクリーンアップしました');
    }
  }
}

module.exports = { AudioPlayerController };
