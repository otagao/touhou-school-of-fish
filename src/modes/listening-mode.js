// listening-mode.js - 聴取モードの管理
const songUtils = require('../utils/songUtils.js');

/**
 * 聴取モードを管理するクラス
 * 楽曲リストの表示、フィルタリング、楽曲再生を担当
 */
class ListeningMode {
  /**
   * @param {Array} songData 楽曲データの配列
   * @param {boolean} isMusicDirSet 音楽ディレクトリが設定されているか
   */
  constructor(songData, isMusicDirSet) {
    this.songData = songData;
    this.isMusicDirSet = isMusicDirSet;
    this.currentSong = null;
    this.audioPlayer = null;

    // イベントリスナーへの参照を保持（cleanup時に削除するため）
    this.eventListeners = [];
  }

  /**
   * 聴取モードを初期化する
   * イベントリスナーの登録とUIの初期化を行う
   */
  initialize() {
    console.log('[ListeningMode] 聴取モードを初期化します');

    // イベントリスナーを登録
    this.registerEventListeners();

    // フィルターコントロールを描画
    this.renderFilterControls();

    // 楽曲リストを描画
    this.renderSongList();
  }

  /**
   * イベントリスナーを登録する
   */
  registerEventListeners() {
    // 検索ボックス
    this.addEventListener('songSearch', 'input', () => this.filterSongs());

    // 再生コントロールボタン
    this.addEventListener('playBtn', 'click', () => this.playSong());
    this.addEventListener('pauseBtn', 'click', () => this.pauseSong());
    this.addEventListener('stopBtn', 'click', () => this.stopSong());

    // 音量スライダー
    this.addEventListener('volumeSlider', 'input', () => this.adjustVolume());

    // フィルター折りたたみボタン
    this.addEventListener('toggleFilters', 'click', () => this.toggleFilters());
  }

  /**
   * イベントリスナーを追加し、cleanup用に参照を保持する
   * @param {string} elementId 要素のID
   * @param {string} event イベント名
   * @param {Function} handler イベントハンドラー
   */
  addEventListener(elementId, event, handler) {
    const element = document.getElementById(elementId);
    if (element) {
      element.addEventListener(event, handler);
      this.eventListeners.push({ element, event, handler });
    }
  }

  /**
   * フィルターコントロール（チェックボックス・ラジオボタン）を描画する
   */
  renderFilterControls() {
    const typeContainer = document.getElementById('typeFilters');
    const generationContainer = document.getElementById('generationFilters');
    const gameContainer = document.getElementById('gameFilters');
    const stageContainer = document.getElementById('stageFilters');

    typeContainer.innerHTML = '';
    generationContainer.innerHTML = '';
    gameContainer.innerHTML = '';
    stageContainer.innerHTML = '';

    // データから一意な値を取得
    const types = songUtils.getUniqueAttributes(this.songData, 'type');
    const generations = songUtils.getUniqueAttributes(this.songData, 'generation');
    const games = songUtils.getUniqueAttributes(this.songData, 'game');
    const stages = songUtils.getUniqueAttributes(this.songData, 'stage');

    this.createCheckboxesForGroup(types, typeContainer, 'typeFilter');
    this.createCheckboxesForGroup(generations, generationContainer, 'generationFilter');
    this.createCheckboxesForGroup(games, gameContainer, 'gameFilter');
    this.createCheckboxesForGroup(stages, stageContainer, 'stageFilter');
  }

  /**
   * 指定された値の配列からチェックボックス群を作成し、コンテナに追加する
   * @param {string[]} values チェックボックスにする値の配列
   * @param {HTMLElement} container チェックボックスを追加する親要素
   * @param {string} groupName チェックボックスグループの名前 (inputのname属性)
   */
  createCheckboxesForGroup(values, container, groupName) {
    if (values.length === 0) {
      container.innerHTML = '<p class="no-filter-options">該当データなし</p>';
      return;
    }
    values.forEach((value, index) => {
      const checkboxId = `${groupName}-${index}-${value.replace(/[^a-zA-Z0-9]/g, '-')}`;

      const label = document.createElement('label');
      label.className = 'checkbox-label';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = checkboxId;
      checkbox.name = groupName;
      checkbox.value = value;
      checkbox.addEventListener('change', () => this.filterSongs());

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(value));

      // ラベルクリックイベント
      label.addEventListener('click', (e) => {
        if (e.target === checkbox) {
          return;
        }
        e.preventDefault();
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      });

      container.appendChild(label);
    });
  }

  /**
   * 楽曲リストを描画する
   */
  renderSongList() {
    const songListElement = document.getElementById('songList');
    const songListHeader = document.getElementById('songListHeader');
    songListElement.innerHTML = '';

    const songsToRender = this.filterSongsInternal();

    // ヘッダーを常時表示し、楽曲件数を更新
    songListHeader.style.display = 'flex';
    this.updateSongListHeader(songsToRender.length);

    if (songsToRender.length === 0) {
      songListElement.innerHTML = '<p style="padding: 20px 12px; color: #666; text-align: center; margin: 0;">表示する楽曲がありません。</p>';
      return;
    }

    songsToRender.forEach((song) => {
      const originalIndex = this.songData.findIndex(s => s === song);

      const songElement = document.createElement('div');
      songElement.className = 'song-item';
      songElement.dataset.index = originalIndex;

      // タイトル列
      const titleCell = document.createElement('div');
      titleCell.className = 'song-title';
      const titleDisplay = Array.isArray(song.title) ? song.title.join(', ') : song.title;
      titleCell.textContent = titleDisplay;

      // キャラクター列
      const characterCell = document.createElement('div');
      characterCell.className = 'song-character';
      const characterDisplay = Array.isArray(song.character) ? song.character.join(', ') : song.character;
      characterCell.textContent = characterDisplay || '';

      songElement.appendChild(titleCell);
      songElement.appendChild(characterCell);

      // ファイルが存在しない場合にクラスを追加
      if (this.isMusicDirSet && !song.fileExists) {
        songElement.classList.add('file-missing');
        songElement.title = '対応する音声ファイルが見つかりません';
      }

      songElement.addEventListener('click', () => this.selectSong(originalIndex));

      songListElement.appendChild(songElement);
    });
  }

  /**
   * 楽曲リストヘッダーの楽曲件数を更新する
   * @param {number} count 表示中の楽曲件数
   */
  updateSongListHeader(count) {
    const titleHeader = document.querySelector('.song-title-header');
    if (titleHeader) {
      titleHeader.textContent = `楽曲名 (${count}件)`;
    }
  }

  /**
   * 曲の選択処理
   * @param {number} index songData内のインデックス
   */
  selectSong(index) {
    if (index < 0 || index >= this.songData.length) {
      console.error(`[ListeningMode] 不正なインデックスで selectSong が呼ばれました: ${index}`);
      return;
    }
    console.log(`[ListeningMode] 曲を選択: インデックス ${index}`);

    this.currentSong = this.songData[index];

    // UI更新
    const selectedItems = document.querySelectorAll('.song-item.active');
    selectedItems.forEach(item => item.classList.remove('active'));

    const newSelectedItem = document.querySelector(`.song-item[data-index="${index}"]`);
    if (newSelectedItem) {
      newSelectedItem.classList.add('active');
    }

    // 選択した曲の情報を表示
    const titleDisplay = Array.isArray(this.currentSong.title) ? this.currentSong.title.join(', ') : this.currentSong.title;
    console.log(`[ListeningMode] 選択された曲: ${titleDisplay}, ファイル存在: ${this.currentSong.fileExists}`);
    document.getElementById('nowPlayingTitle').textContent = titleDisplay;

    // 詳細情報を表示
    const detailsElement = document.getElementById('nowPlayingDetails');
    detailsElement.innerHTML = '';

    const typeDisplay = Array.isArray(this.currentSong.type) ? this.currentSong.type.join(', ') : this.currentSong.type;
    const generationDisplay = Array.isArray(this.currentSong.generation) ? this.currentSong.generation.join(', ') : this.currentSong.generation;
    const gameDisplay = Array.isArray(this.currentSong.game) ? this.currentSong.game.join(', ') : this.currentSong.game;
    const stageDisplay = Array.isArray(this.currentSong.stage) ? this.currentSong.stage.join(', ') : this.currentSong.stage;
    const characterDisplay = Array.isArray(this.currentSong.character) ? this.currentSong.character.join(', ') : this.currentSong.character;

    const details = [
      { label: 'タイプ', value: typeDisplay },
      { label: 'シリーズ区分', value: generationDisplay },
      { label: '作品名', value: gameDisplay },
      { label: '場面', value: stageDisplay },
      { label: 'キャラクター', value: characterDisplay }
    ];

    details.forEach(detail => {
      if (detail.value && detail.value.toString().trim() !== '') {
        const listItem = document.createElement('div');
        listItem.className = 'song-detail-item';
        listItem.innerHTML = `<span class="detail-label">${detail.label}:</span> <span class="detail-value">${detail.value}</span>`;
        detailsElement.appendChild(listItem);
      }
    });

    // 再生ボタンの状態制御
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');

    if (this.isMusicDirSet && this.currentSong.fileExists && this.currentSong.filePath) {
      playBtn.disabled = false;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
    } else {
      playBtn.disabled = true;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
    }

    // すでに再生中の曲があれば停止
    if (this.audioPlayer) {
      console.log('[ListeningMode] 既存のオーディオプレーヤーを停止します');
      this.stopSongInternal();
    }
  }

  /**
   * 楽曲の再生
   */
  playSong() {
    if (!this.currentSong || !this.currentSong.filePath || !this.isMusicDirSet) {
      console.warn('[ListeningMode] 再生条件を満たしていません。', { currentSong: this.currentSong, isMusicDirSet: this.isMusicDirSet });
      return;
    }

    try {
      console.log(`[ListeningMode] 楽曲の再生を開始します: ${this.currentSong.title}, ファイルパス: ${this.currentSong.filePath}`);
      this.stopSongInternal();

      console.log('[ListeningMode] 新しいオーディオプレーヤーを作成します');
      this.audioPlayer = new Audio(this.currentSong.filePath);
      const volume = document.getElementById('volumeSlider').value / 100;
      this.audioPlayer.volume = volume;

      this.audioPlayer.addEventListener('loadedmetadata', () => {
        console.log('[ListeningMode] オーディオメタデータ読み込み完了');
      });
      this.audioPlayer.addEventListener('canplay', () => {
        console.log('[ListeningMode] 再生準備完了');
        this.audioPlayer.play().catch(e => {
          console.error('[ListeningMode] 再生開始エラー:', e);
          alert(`楽曲の再生開始に失敗しました: ${e.message}`);
          this.updatePlayButtons(false);
        });
        console.log('[ListeningMode] 再生を開始しました');
        this.updatePlayButtons(true);
      });
      this.audioPlayer.addEventListener('ended', () => {
        console.log('[ListeningMode] 楽曲の再生が終了しました');
        this.updatePlayButtons(false);
      });
      this.audioPlayer.addEventListener('error', (e) => {
        console.error('[ListeningMode] オーディオ再生エラー:', this.audioPlayer.error);
        alert(`楽曲の再生中にエラーが発生しました: ${this.audioPlayer.error?.message || '不明なエラー'}`);
        this.updatePlayButtons(false);
      });

      console.log('[ListeningMode] オーディオの読み込みを開始します...');
      this.audioPlayer.load();

    } catch (error) {
      console.error('[ListeningMode] 再生処理でのエラー:', error);
      alert(`楽曲の再生準備中にエラーが発生しました: ${error.message}`);
      this.updatePlayButtons(false);
    }
  }

  /**
   * 楽曲の一時停止
   */
  pauseSong() {
    if (this.audioPlayer && !this.audioPlayer.paused) {
      this.audioPlayer.pause();
      console.log('[ListeningMode] 楽曲を一時停止しました');
      this.updatePlayButtons(false, true);
    }
  }

  /**
   * 楽曲の停止
   */
  stopSong() {
    this.stopSongInternal();
    this.updatePlayButtons(false);
  }

  /**
   * 楽曲の停止（内部処理）
   */
  stopSongInternal() {
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer.currentTime = 0;
      this.audioPlayer.removeEventListener('loadedmetadata', null);
      this.audioPlayer.removeEventListener('canplay', null);
      this.audioPlayer.removeEventListener('ended', null);
      this.audioPlayer.removeEventListener('error', null);
      this.audioPlayer.src = '';
      this.audioPlayer = null;
      console.log('[ListeningMode] オーディオプレーヤーを停止・破棄しました');
    }
  }

  /**
   * 再生コントロールボタンの状態を更新する
   * @param {boolean} isPlaying 再生中かどうか
   * @param {boolean} isPaused 一時停止中かどうか (isPlaying=false の場合のみ有効)
   */
  updatePlayButtons(isPlaying, isPaused = false) {
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');

    if (!this.currentSong || !this.isMusicDirSet || !this.currentSong.fileExists) {
      playBtn.disabled = true;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
      return;
    }

    if (isPlaying) {
      playBtn.disabled = true;
      pauseBtn.disabled = false;
      stopBtn.disabled = false;
    } else if (isPaused) {
      playBtn.disabled = false;
      pauseBtn.disabled = true;
      stopBtn.disabled = false;
    } else {
      playBtn.disabled = false;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
    }
  }

  /**
   * 音量調整
   */
  adjustVolume() {
    const volume = document.getElementById('volumeSlider').value / 100;
    if (this.audioPlayer) {
      this.audioPlayer.volume = volume;
    }
  }

  /**
   * 楽曲のフィルタリング
   */
  filterSongs() {
    console.log("[ListeningMode] フィルター/検索が変更されました。リストを再描画します。");
    this.renderSongList();
  }

  /**
   * 内部用のフィルタリング処理関数
   * @returns {Array} フィルタリングされた楽曲データの配列
   */
  filterSongsInternal() {
    const searchTermInput = document.getElementById('songSearch').value;
    const keywords = searchTermInput.toLowerCase().split(' ').filter(k => k.trim() !== '');

    // チェックボックスから選択された値を取得
    const selectedTypes = this.getSelectedCheckboxValues('typeFilter');
    const selectedGenerations = this.getSelectedCheckboxValues('generationFilter');
    const selectedGames = this.getSelectedCheckboxValues('gameFilter');
    const selectedStages = this.getSelectedCheckboxValues('stageFilter');

    // songUtils.jsの関数を使用してフィルタリング
    return songUtils.filterSongs(this.songData, {
      keywords: keywords,
      types: selectedTypes,
      generations: selectedGenerations,
      games: selectedGames,
      stages: selectedStages
    });
  }

  /**
   * 選択されたチェックボックスの値を取得する
   * @param {string} groupName チェックボックスのname属性
   * @returns {string[]} 選択された値の配列
   */
  getSelectedCheckboxValues(groupName) {
    const checkboxes = document.querySelectorAll(`input[name="${groupName}"]:checked`);
    return Array.from(checkboxes).map(cb => cb.value);
  }

  /**
   * フィルターの折りたたみ切り替え
   */
  toggleFilters() {
    const filterContainer = document.getElementById('filterControlsContainer');
    const toggleButton = document.getElementById('toggleFilters');

    if (filterContainer.classList.contains('hidden')) {
      filterContainer.classList.remove('hidden');
      toggleButton.textContent = '詳細絞り込み ▲';
    } else {
      filterContainer.classList.add('hidden');
      toggleButton.textContent = '詳細絞り込み ▼';
    }
  }

  /**
   * songDataを更新する
   * @param {Array} newSongData 新しい楽曲データ
   */
  updateSongData(newSongData) {
    this.songData = newSongData;
    this.renderFilterControls();
    this.renderSongList();
  }

  /**
   * クリーンアップ処理
   * モード切り替え時に呼び出され、リソースを解放する
   */
  cleanup() {
    console.log('[ListeningMode] クリーンアップを実行します');

    // 音楽を停止
    this.stopSongInternal();

    // イベントリスナーを削除
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];

    // 状態をリセット
    this.currentSong = null;
  }
}

module.exports = { ListeningMode };
