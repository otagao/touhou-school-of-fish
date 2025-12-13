/**
 * 楽曲データモデルクラス
 * 楽曲の情報と関連操作を管理する
 */
class Song {
    /**
     * 楽曲オブジェクトのコンストラクタ
     * @param {Object} songData 楽曲データオブジェクト
     */
    constructor(songData) {
      this.filename = songData.filename || '';
      this.title = songData.title || '';
      this.generation = songData.generation || ''; // 旧作or現行、西方等、黄昏
      this.type = songData.type || ''; // 初出orアレンジ、再録
      this.game = songData.game || ''; // 登場作品
      this.character = songData.character || ''; // 担当キャラクター
      this.stage = songData.stage || ''; // ★追加: ステージ・場面
      this.filePath = songData.filePath || '';
      this.fileExists = !!songData.filePath;
    }
    
    /**
     * 楽曲の完全な説明を取得
     * @returns {string} 楽曲の詳細情報
     */
    getFullDescription() {
      let description = `${this.title}`;
      
      if (this.game) {
        description += ` (${this.game})`;
      }
      
      if (this.type) {
        description += ` - ${this.type}`;
      }
      
      if (this.character) {
        description += ` / ${this.character}`;
      }

      // ★追加: stage情報も表示に含める場合 (任意)
      if (this.stage) {
        description += ` [${this.stage}]`;
      }
      
      return description;
    }
    
    /**
     * 楽曲がクイズの回答に合致するかを判定
     * @param {string} answer ユーザーの回答
     * @param {string} mode 判定モード（'exact'|'fuzzy'）
     * @returns {boolean} 合致すればtrue
     */
    matchesAnswer(answer, mode = 'exact') {
      if (!answer) return false;
      
      const userAnswer = answer.trim().toLowerCase();
      const correctAnswer = this.title.toLowerCase();
      
      if (mode === 'exact') {
        return userAnswer === correctAnswer;
      } else if (mode === 'fuzzy') {
        // 曖昧一致モード: 楽曲名に回答が含まれるか、またはその逆
        return correctAnswer.includes(userAnswer) || userAnswer.includes(correctAnswer);
      }
      
      return false;
    }
    
    /**
     * 楽曲情報をオブジェクトとして取得
     * @returns {Object} 楽曲情報オブジェクト
     */
    toObject() {
      return {
        filename: this.filename,
        title: this.title,
        generation: this.generation,
        type: this.type,
        game: this.game,
        character: this.character,
        stage: this.stage, // ★追加
        filePath: this.filePath,
        fileExists: this.fileExists
      };
    }
    
    /**
     * JSON文字列から楽曲オブジェクトを作成
     * @param {string} json JSON文字列
     * @returns {Song} 楽曲オブジェクト
     */
    static fromJSON(json) {
      try {
        const data = JSON.parse(json);
        return new Song(data);
      } catch (error) {
        console.error('JSON解析エラー:', error);
        return null;
      }
    }
    
    /**
     * 楽曲配列からJSON文字列を作成
     * @param {Array<Song>} songs 楽曲オブジェクトの配列
     * @returns {string} JSON文字列
     */
    static toJSONArray(songs) {
      const songObjects = songs.map(song => song.toObject());
      return JSON.stringify(songObjects);
    }
  }
  
  // エクスポート
  module.exports = Song;