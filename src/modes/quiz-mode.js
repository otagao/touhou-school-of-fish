// quiz-mode.js - 演習モードの管理
const songUtils = require('../utils/songUtils.js');
const { FilterControls } = require('../components/filter-controls.js');

/**
 * 演習モードを管理するクラス
 * クイズセッションの管理、問題の出題と解答判定、スコアと統計の管理を担当
 */
class QuizMode {
  /**
   * @param {Array} songData 楽曲データの配列
   * @param {boolean} isMusicDirSet 音楽ディレクトリが設定されているか
   */
  constructor(songData, isMusicDirSet) {
    this.songData = songData;
    this.isMusicDirSet = isMusicDirSet;

    // クイズの状態管理
    this.quizState = {
      isActive: false,
      currentQuestionIndex: 0,
      availableSongs: [],
      usedSongs: [],
      correctAnswers: 0,
      totalQuestions: 0,
      questionStartTime: null,
      responseTimes: [],
      currentQuizSong: null,
      quizAudioPlayer: null,
      awaitingCandidateSelection: false,  // 候補選択待ち状態
      fuzzyMatchCandidates: [],           // 現在の候補楽曲リスト
      fuzzyUserAnswer: ''                 // 曖昧一致で入力された回答
    };

    // イベントリスナーへの参照を保持（cleanup時に削除するため）
    this.eventListeners = [];
  }

  /**
   * 演習モードを初期化する
   * イベントリスナーの登録とUIの初期化を行う
   */
  initialize() {
    console.log('[QuizMode] 演習モードを初期化します');

    // 回答方式をリセット
    document.getElementById('answerMode').value = 'exact';

    // クイズコンテナを非表示に
    document.getElementById('quizContainer').classList.add('hidden');
    document.getElementById('quizResult').classList.add('hidden');

    // 各種UIをリセット
    const answerInput = document.getElementById('answerText');
    const submitBtn = document.getElementById('submitAnswerBtn');
    const nextBtn = document.getElementById('nextQuestionBtn');

    answerInput.value = '';
    answerInput.disabled = false;
    submitBtn.disabled = false;
    nextBtn.style.display = 'none';

    // イベントリスナーを登録
    this.registerEventListeners();

    // 演習モード用の絞り込みフィルターを描画
    this.renderQuizFilterControls();

    // 楽曲数をリアルタイム更新
    this.updateQuizSongCounts();

    // 回答方式に基づいてボタン状態を更新
    this.updateQuizStartButtonForAnswerMode();
  }

  /**
   * イベントリスナーを登録する
   */
  registerEventListeners() {
    // クイズ開始ボタン
    this.addEventListener('startQuizBtn', 'click', () => this.startQuiz());

    // 回答提出ボタン
    this.addEventListener('submitAnswerBtn', 'click', () => this.submitAnswer());

    // 次の問題ボタン
    this.addEventListener('nextQuestionBtn', 'click', () => this.nextQuestion());

    // クイズ中止ボタン
    this.addEventListener('stopQuizBtn', 'click', () => this.stopQuiz());

    // 音量スライダー
    this.addEventListener('quizVolumeSlider', 'input', () => this.adjustQuizVolume());

    // 回答方式選択
    this.addEventListener('answerMode', 'change', () => this.updateQuizStartButtonForAnswerMode());

    // 曖昧一致候補選択キャンセルボタン
    this.addEventListener('fuzzyCancelBtn', 'click', () => this.cancelFuzzySelection());

    // 出題絞り込み折りたたみボタン
    this.addEventListener('toggleQuizFilters', 'click', () => this.toggleQuizFilters());

    // Enterキーで回答提出
    const answerInput = document.getElementById('answerText');
    if (answerInput) {
      const enterHandler = (e) => {
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault();
          this.submitAnswer();
        }
      };
      answerInput.addEventListener('keydown', enterHandler);
      this.eventListeners.push({ element: answerInput, event: 'keydown', handler: enterHandler });
    }
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
   * 演習モード用のフィルターコントロール（チェックボックス）を描画する
   */
  renderQuizFilterControls() {
    const typeContainer = document.getElementById('quizTypeFilters');
    const generationContainer = document.getElementById('quizGenerationFilters');
    const gameContainer = document.getElementById('quizGameFilters');
    const stageContainer = document.getElementById('quizStageFilters');

    typeContainer.innerHTML = '';
    generationContainer.innerHTML = '';
    gameContainer.innerHTML = '';
    stageContainer.innerHTML = '';

    // データから一意な値を取得
    const types = songUtils.getUniqueAttributes(this.songData, 'type');
    const generations = songUtils.getUniqueAttributes(this.songData, 'generation');
    const games = songUtils.getUniqueAttributes(this.songData, 'game');
    const stages = songUtils.getUniqueAttributes(this.songData, 'stage');

    FilterControls.createCheckboxesForGroup(types, typeContainer, 'quizTypeFilter', () => this.updateQuizSongCounts());
    FilterControls.createCheckboxesForGroup(generations, generationContainer, 'quizGenerationFilter', () => this.updateQuizSongCounts());
    FilterControls.createCheckboxesForGroup(games, gameContainer, 'quizGameFilter', () => this.updateQuizSongCounts());
    FilterControls.createCheckboxesForGroup(stages, stageContainer, 'quizStageFilter', () => this.updateQuizSongCounts());
  }

  /**
   * 演習モード用：現在のフィルター条件に基づいて楽曲データをフィルタリングする
   * @returns {Array} フィルタリングされた楽曲データの配列
   */
  filterQuizSongsInternal() {
    // チェックボックスから選択された値を取得
    const selectedTypes = FilterControls.getSelectedCheckboxValues('quizTypeFilter');
    const selectedGenerations = FilterControls.getSelectedCheckboxValues('quizGenerationFilter');
    const selectedGames = FilterControls.getSelectedCheckboxValues('quizGameFilter');
    const selectedStages = FilterControls.getSelectedCheckboxValues('quizStageFilter');

    // songUtils.jsの関数を使用してフィルタリング（演習モードはキーワード検索なし）
    return songUtils.filterSongs(this.songData, {
      keywords: [],
      types: selectedTypes,
      generations: selectedGenerations,
      games: selectedGames,
      stages: selectedStages
    });
  }

  /**
   * 演習モード用：楽曲数をリアルタイム更新する
   */
  updateQuizSongCounts() {
    const filteredSongs = this.filterQuizSongsInternal();
    const totalCount = filteredSongs.length;
    const availableCount = filteredSongs.filter(song => this.isMusicDirSet && song.fileExists).length;

    document.getElementById('quizTotalSongs').textContent = `絞り込み条件に適合する楽曲数: ${totalCount}曲`;
    document.getElementById('quizAvailableSongs').textContent = `| 再生可能: ${availableCount}曲`;

    // 回答方式と再生可能楽曲数に応じて「クイズを開始」ボタンの状態を制御
    this.updateQuizStartButtonForAnswerMode();
  }

  /**
   * 出題絞り込みパネルを折りたたむ/展開する
   */
  toggleQuizFilters() {
    const container = document.getElementById('quizFilterControlsContainer');
    const toggleBtn = document.getElementById('toggleQuizFilters');

    if (container.classList.contains('hidden')) {
      container.classList.remove('hidden');
      toggleBtn.textContent = '出題絞り込み ▼';
    } else {
      container.classList.add('hidden');
      toggleBtn.textContent = '出題絞り込み ▶';
    }
  }

  /**
   * 演習モード用：再生可能楽曲数に応じて「クイズを開始」ボタンの状態を更新する
   * @param {number} availableCount 再生可能楽曲数
   */
  updateQuizStartButtonState(availableCount) {
    const startQuizBtn = document.getElementById('startQuizBtn');
    if (startQuizBtn) {
      if (availableCount === 0) {
        startQuizBtn.disabled = true;
        startQuizBtn.title = '再生可能な楽曲がありません。音楽ディレクトリの設定や絞り込み条件を確認してください。';
      } else {
        startQuizBtn.disabled = false;
        startQuizBtn.title = '';
      }
    }
  }

  /**
   * 回答方式に基づいてクイズ開始ボタンの状態を更新
   */
  updateQuizStartButtonForAnswerMode() {
    const answerMode = document.getElementById('answerMode').value;
    const startQuizBtn = document.getElementById('startQuizBtn');

    if (answerMode === 'button') {
      // ボタン回答の場合は、再生可能楽曲数が4曲以上必要
      const filteredSongs = this.filterQuizSongsInternal();
      const availableCount = filteredSongs.filter(song => this.isMusicDirSet && song.fileExists).length;
      if (availableCount < 4) {
        startQuizBtn.disabled = true;
        startQuizBtn.title = 'ボタン回答モードには最低4曲の再生可能な楽曲が必要です。絞り込み条件を変更してください。';
      } else {
        startQuizBtn.disabled = false;
        startQuizBtn.title = '';
      }
    } else {
      // 完全一致の場合は、再生可能楽曲数に基づいて判定
      const filteredSongs = this.filterQuizSongsInternal();
      const availableCount = filteredSongs.filter(song => this.isMusicDirSet && song.fileExists).length;
      this.updateQuizStartButtonState(availableCount);
    }
  }

  /**
   * クイズを開始する
   */
  startQuiz() {
    console.log('[Quiz] クイズを開始します');

    // 再生可能な楽曲を取得
    const filteredSongs = this.filterQuizSongsInternal();
    const availableSongs = filteredSongs.filter(song => this.isMusicDirSet && song.fileExists);

    if (availableSongs.length === 0) {
      alert('再生可能な楽曲がありません。音楽ディレクトリの設定や絞り込み条件を確認してください。');
      return;
    }

    // ボタン回答モードの場合は楽曲数チェック
    const answerMode = document.getElementById('answerMode').value;
    if (answerMode === 'button' && availableSongs.length < 4) {
      alert('ボタン回答モードには最低4曲の再生可能な楽曲が必要です。');
      return;
    }

    // クイズ状態を初期化
    this.quizState = {
      isActive: true,
      currentQuestionIndex: 0,
      availableSongs: [...availableSongs], // コピーを作成
      usedSongs: [],
      correctAnswers: 0,
      totalQuestions: 0,
      questionStartTime: null,
      responseTimes: [],
      currentQuizSong: null,
      quizAudioPlayer: null,
      answerMode: answerMode, // 回答モードを保存
      awaitingCandidateSelection: false,  // 候補選択待ち状態
      fuzzyMatchCandidates: [],           // 現在の候補楽曲リスト
      fuzzyUserAnswer: ''                 // 曖昧一致で入力された回答
    };

    console.log(`[Quiz] ${availableSongs.length}曲が出題対象です（回答モード: ${answerMode}）`);

    // UIを出題モードに切り替え
    document.getElementById('quizContainer').classList.remove('hidden');
    document.getElementById('quizResult').classList.add('hidden');
    document.getElementById('nextQuestionBtn').style.display = 'none';

    // 絞り込み、回答方式選択、楽曲数表示エリアを非表示
    const filterSection = document.querySelector('.quiz-filter-section');
    const answerModeGroup = document.getElementById('answerModeGroup');
    const filterSummary = document.querySelector('.quiz-filter-summary');
    if (filterSection) {
      filterSection.style.display = 'none';
    }
    if (answerModeGroup) {
      answerModeGroup.style.display = 'none';
    }
    if (filterSummary) {
      filterSummary.style.display = 'none';
    }

    // 回答UIを初期化（念のため）
    const answerInput = document.getElementById('answerText');
    const submitBtn = document.getElementById('submitAnswerBtn');
    answerInput.value = '';
    answerInput.disabled = false;
    submitBtn.disabled = false;

    // 最初の問題を出題
    this.presentNextQuestion();
  }

  /**
   * 次の問題を出題する
   */
  presentNextQuestion() {
    if (!this.quizState.isActive) {
      console.log('[Quiz] クイズが非アクティブなため出題を中止します');
      return;
    }

    // 未使用の楽曲がない場合はクイズ終了
    if (this.quizState.availableSongs.length === 0) {
      console.log('[Quiz] 全ての楽曲を出題しました。クイズを終了します');
      this.endQuiz();
      return;
    }

    // ランダムに楽曲を選出
    const randomIndex = Math.floor(Math.random() * this.quizState.availableSongs.length);
    const selectedSong = this.quizState.availableSongs.splice(randomIndex, 1)[0];

    this.quizState.currentQuizSong = selectedSong;
    this.quizState.currentQuestionIndex++;
    this.quizState.totalQuestions++;

    console.log(`[Quiz] 問題${this.quizState.currentQuestionIndex}: ${selectedSong.title}`);

    // UIを更新
    this.updateQuizUI();

    // 回答方式に応じてUIを切り替え
    if (this.quizState.answerMode === 'button') {
      this.showButtonAnswerUI(selectedSong);
    } else {
      this.showTextAnswerUI();
    }

    // 音楽を読み込み（これは非同期処理）
    this.loadQuizSong(selectedSong);

    // 時間計測開始
    this.quizState.questionStartTime = Date.now();
  }

  /**
   * テキスト入力UIを表示する
   */
  showTextAnswerUI() {
    const textAnswerInput = document.getElementById('textAnswerInput');
    const buttonAnswerInput = document.getElementById('buttonAnswerInput');

    // ボタンUIを非表示、テキストUIを表示
    buttonAnswerInput.classList.add('hidden');
    textAnswerInput.classList.remove('hidden');

    // 解答用テキストボックスをクリアして有効化
    const answerInput = document.getElementById('answerText');
    answerInput.value = '';
    answerInput.disabled = false;

    // 回答ボタンを有効化
    document.getElementById('submitAnswerBtn').disabled = false;

    // フォーカスを設定（多段階で確実にフォーカスする）
    // 1. Electronウィンドウ自体にフォーカスを設定（メインプロセス経由）
    if (window.electronAPI && window.electronAPI.focusWindow) {
      window.electronAPI.focusWindow().catch(err => {
        console.warn('[Quiz] ウィンドウフォーカス設定エラー:', err);
      });
    }

    // 2. まず即座にフォーカスを試みる
    if (answerInput && !answerInput.disabled) {
      answerInput.focus();
    }

    // 3. requestAnimationFrameで再度フォーカスを設定（Electron環境での確実性向上）
    requestAnimationFrame(() => {
      if (this.quizState.isActive && this.quizState.currentQuizSong) {
        const input = document.getElementById('answerText');
        if (input && !input.disabled) {
          input.focus();
          // さらにsetTimeoutで最終確認（Electronのウィンドウフォーカス問題対策）
          setTimeout(() => {
            if (this.quizState.isActive) {
              const finalInput = document.getElementById('answerText');
              if (finalInput && !finalInput.disabled && document.activeElement !== finalInput) {
                finalInput.focus();
                console.log('[Quiz] 入力欄に遅延フォーカスを設定しました');
              }
            }
          }, 50);
          console.log('[Quiz] 入力欄にフォーカスを設定しました');
        }
      }
    });
  }

  /**
   * ボタン回答UIを表示する
   * @param {Song} correctSong 正解の楽曲
   */
  showButtonAnswerUI(correctSong) {
    const textAnswerInput = document.getElementById('textAnswerInput');
    const buttonAnswerInput = document.getElementById('buttonAnswerInput');

    // テキストUIを非表示、ボタンUIを表示
    textAnswerInput.classList.add('hidden');
    buttonAnswerInput.classList.remove('hidden');

    // 4択の選択肢を生成
    const choices = this.generateButtonChoices(correctSong);

    // ボタンを生成
    buttonAnswerInput.innerHTML = '';
    choices.forEach((song, index) => {
      const button = document.createElement('button');
      button.className = 'answer-choice-button';

      // タイトルが配列の場合は最初の要素を表示
      const titleDisplay = Array.isArray(song.title) ? song.title[0] : song.title;
      button.textContent = titleDisplay;

      // ボタンクリック時のハンドラー
      const clickHandler = () => this.submitButtonAnswer(song);
      button.addEventListener('click', clickHandler);

      // クリーンアップ用にハンドラーを保存
      button._clickHandler = clickHandler;

      buttonAnswerInput.appendChild(button);
    });

    console.log('[Quiz] ボタン回答UIを生成しました');
  }

  /**
   * 4択の選択肢を生成する
   * @param {Song} correctSong 正解の楽曲
   * @returns {Array} 4つの楽曲オブジェクトの配列（正解含む）
   */
  generateButtonChoices(correctSong) {
    // 利用可能な全楽曲から選択肢を選ぶ（現在の問題と使用済み楽曲を含む）
    const allPossibleSongs = [...this.quizState.availableSongs, ...this.quizState.usedSongs];

    // 正解以外の楽曲からランダムに3曲選出
    const wrongChoices = [];
    const candidates = allPossibleSongs.filter(song => song !== correctSong);

    while (wrongChoices.length < 3 && candidates.length > 0) {
      const randomIndex = Math.floor(Math.random() * candidates.length);
      wrongChoices.push(candidates.splice(randomIndex, 1)[0]);
    }

    // 正解を追加
    const choices = [...wrongChoices, correctSong];

    // シャッフル（Fisher-Yates アルゴリズム）
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }

    return choices;
  }

  /**
   * ボタンで選択した回答を提出する
   * @param {Song} selectedSong ユーザーが選択した楽曲
   */
  submitButtonAnswer(selectedSong) {
    if (!this.quizState.isActive || !this.quizState.currentQuizSong) {
      console.warn('[Quiz] クイズがアクティブでないか、現在の問題がありません');
      return;
    }

    // タイトルを取得（配列の場合は最初の要素）
    const userAnswer = Array.isArray(selectedSong.title) ? selectedSong.title[0] : selectedSong.title;

    // 時間計測終了
    const responseTime = Date.now() - this.quizState.questionStartTime;
    this.quizState.responseTimes.push(responseTime);

    console.log(`[Quiz] ユーザー回答: "${userAnswer}", 正解: "${this.quizState.currentQuizSong.title}", 回答時間: ${responseTime}ms`);

    // 正誤判定（同じ楽曲オブジェクトかどうかで判定）
    const isCorrect = selectedSong === this.quizState.currentQuizSong;

    if (isCorrect) {
      this.quizState.correctAnswers++;
      console.log('[Quiz] 正解!');
    } else {
      console.log('[Quiz] 不正解');
    }

    // 結果を表示
    this.showQuestionResult(isCorrect, userAnswer, responseTime);

    // 使用済み楽曲に追加
    this.quizState.usedSongs.push(this.quizState.currentQuizSong);
  }

  /**
   * クイズUIを更新する
   */
  updateQuizUI() {
    // 出題可能な総楽曲数は、使用済み + 未使用 + 現在出題中の1曲
    const totalAvailable = this.quizState.usedSongs.length + this.quizState.availableSongs.length + 1;
    document.getElementById('currentQuestion').textContent =
      `問題 ${this.quizState.currentQuestionIndex} / ${totalAvailable}`;
  }

  /**
   * クイズ用楽曲を読み込み、自動再生する
   */
  loadQuizSong(song) {
    // クイズが非アクティブの場合は何もしない
    if (!this.quizState.isActive) {
      console.log('[Quiz] クイズが非アクティブのため、楽曲読み込みを中止します');
      return;
    }

    // 既存のプレーヤーをクリーンアップ
    this.cleanupQuizAudioPlayer();

    if (!song.filePath || !song.fileExists) {
      console.error('[Quiz] 楽曲ファイルが存在しません:', song.filename);
      return;
    }

    try {
      console.log(`[Quiz] 楽曲を読み込み中: ${song.filePath}`);
      this.quizState.quizAudioPlayer = new Audio(song.filePath);

      // 音量をスライダーの値に合わせて設定
      const volume = document.getElementById('quizVolumeSlider').value / 100;
      this.quizState.quizAudioPlayer.volume = volume;

      // 読み込み完了時のイベントリスナー
      const onLoadedMetadata = () => {
        console.log('[Quiz] 楽曲の読み込み完了');
        // 再度アクティブ状態をチェック
        if (this.quizState.isActive && this.quizState.quizAudioPlayer) {
          console.log('[Quiz] 自動再生を開始');
          this.quizState.quizAudioPlayer.play().catch(e => {
            console.error('[Quiz] 自動再生エラー:', e);
            // クイズがアクティブな場合のみエラーメッセージを表示
            if (this.quizState.isActive) {
              alert(`楽曲の再生に失敗しました: ${e.message}`);
            }
          });
        }
      };

      // エラー時のイベントリスナー
      const onError = (e) => {
        console.error('[Quiz] 楽曲の読み込みエラー:', e);
        // クイズがアクティブな場合のみエラーメッセージを表示
        if (this.quizState.isActive) {
          alert('楽曲の読み込みに失敗しました。');
        }
      };

      // イベントリスナーを保存（後で削除するため）
      this.quizState.quizAudioPlayer._onLoadedMetadata = onLoadedMetadata;
      this.quizState.quizAudioPlayer._onError = onError;

      this.quizState.quizAudioPlayer.addEventListener('loadedmetadata', onLoadedMetadata);
      this.quizState.quizAudioPlayer.addEventListener('error', onError);

      // 最終的にアクティブ状態を再チェックして読み込み開始
      if (this.quizState.isActive) {
        this.quizState.quizAudioPlayer.load();
      } else {
        console.log('[Quiz] 読み込み開始前にクイズが非アクティブになったため中止');
        this.cleanupQuizAudioPlayer();
      }
    } catch (error) {
      console.error('[Quiz] 楽曲の読み込み中にエラーが発生:', error);
      // クイズがアクティブな場合のみエラーメッセージを表示
      if (this.quizState.isActive) {
        alert(`楽曲の読み込み中にエラーが発生しました: ${error.message}`);
      }
    }
  }

  /**
   * クイズ用オーディオプレーヤーをクリーンアップする
   */
  cleanupQuizAudioPlayer() {
    if (this.quizState.quizAudioPlayer) {
      // 保存されたイベントリスナー関数を使って正しく削除
      if (this.quizState.quizAudioPlayer._onLoadedMetadata) {
        this.quizState.quizAudioPlayer.removeEventListener('loadedmetadata', this.quizState.quizAudioPlayer._onLoadedMetadata);
      }
      if (this.quizState.quizAudioPlayer._onError) {
        this.quizState.quizAudioPlayer.removeEventListener('error', this.quizState.quizAudioPlayer._onError);
      }

      this.quizState.quizAudioPlayer.pause();
      this.quizState.quizAudioPlayer.src = '';
      this.quizState.quizAudioPlayer = null;
      console.log('[Quiz] オーディオプレーヤーをクリーンアップしました');
    }
  }

  /**
   * クイズの回答を提出する
   */
  submitAnswer() {
    // 候補選択待ち中のチェック
    if (this.quizState.awaitingCandidateSelection) {
      console.warn('[Quiz] 候補選択待ち中は新しい回答を提出できません');
      return;
    }

    if (!this.quizState.isActive || !this.quizState.currentQuizSong) {
      console.warn('[Quiz] クイズがアクティブでないか、現在の問題がありません');
      return;
    }

    const userAnswer = document.getElementById('answerText').value.trim();
    if (!userAnswer) {
      // 空の場合は何もせず、入力欄にフォーカスを戻す
      const answerInput = document.getElementById('answerText');
      answerInput.focus();
      return;
    }

    // 時間計測終了
    const responseTime = Date.now() - this.quizState.questionStartTime;

    console.log(`[Quiz] ユーザー回答: "${userAnswer}", 正解: "${this.quizState.currentQuizSong.title}", 回答時間: ${responseTime}ms`);

    try {
      // 回答モード取得
      const answerMode = this.quizState.answerMode;

      if (answerMode === 'exact') {
        // 完全一致モード
        this.quizState.responseTimes.push(responseTime);

        // Song.matchesAnswer()を使用して完全一致モードで判定
        const isCorrect = this.quizState.currentQuizSong.matchesAnswer(userAnswer, 'exact');

        if (isCorrect) {
          this.quizState.correctAnswers++;
          console.log('[Quiz] 正解!');
        } else {
          console.log('[Quiz] 不正解');
        }

        // 結果を表示
        this.showQuestionResult(isCorrect, userAnswer, responseTime);

        // 使用済み楽曲に追加
        this.quizState.usedSongs.push(this.quizState.currentQuizSong);
      } else if (answerMode === 'fuzzy') {
        // 曖昧一致モード
        this.handleFuzzyAnswer(userAnswer, responseTime);
      }
    } catch (error) {
      console.error('[Quiz] 回答判定中にエラーが発生:', error);
      alert(`回答の判定中にエラーが発生しました: ${error.message}`);
    }
  }

  /**
   * 問題の結果を表示
   */
  showQuestionResult(isCorrect, userAnswer, responseTime) {
    const resultContainer = document.getElementById('quizResult');
    const resultStatus = document.getElementById('resultStatus');
    const correctAnswer = document.getElementById('correctAnswer');
    const songDetails = document.getElementById('songDetails');

    // 結果ステータスを表示
    if (isCorrect) {
      resultStatus.textContent = '正解！';
      resultStatus.style.color = '#4caf50';
    } else {
      resultStatus.textContent = '不正解';
      resultStatus.style.color = '#f44336';
    }

    // 正解と回答時間を表示
    const timeInSeconds = (responseTime / 1000).toFixed(1);

    // タイトルが配列の場合は最初の要素またはカンマ区切りで表示
    const titleDisplay = Array.isArray(this.quizState.currentQuizSong.title)
      ? this.quizState.currentQuizSong.title.join(', ')
      : this.quizState.currentQuizSong.title;

    correctAnswer.innerHTML = `
      <strong>正解:</strong> ${titleDisplay}<br>
      <strong>あなたの回答:</strong> ${userAnswer}<br>
      <strong>回答時間:</strong> ${timeInSeconds}秒
    `;

    // 楽曲詳細情報を表示
    const song = this.quizState.currentQuizSong;

    // 全ての属性が配列の可能性があるため、配列の場合は文字列に変換
    const typeDisplay = Array.isArray(song.type) ? song.type.join(', ') : song.type;
    const generationDisplay = Array.isArray(song.generation) ? song.generation.join(', ') : song.generation;
    const gameDisplay = Array.isArray(song.game) ? song.game.join(', ') : song.game;
    const stageDisplay = Array.isArray(song.stage) ? song.stage.join(', ') : song.stage;
    const characterDisplay = Array.isArray(song.character) ? song.character.join(', ') : song.character;

    const details = [
      { label: 'タイプ', value: typeDisplay },
      { label: 'シリーズ区分', value: generationDisplay },
      { label: '作品名', value: gameDisplay },
      { label: '場面', value: stageDisplay },
      { label: 'キャラクター', value: characterDisplay }
    ].filter(detail => detail.value && detail.value.toString().trim() !== '');

    songDetails.innerHTML = details.map(detail =>
      `<div><span style="font-weight: bold;">${detail.label}:</span> ${detail.value}</div>`
    ).join('');

    // 結果を表示
    resultContainer.classList.remove('hidden');

    // 次の問題ボタンを有効化
    document.getElementById('nextQuestionBtn').style.display = 'inline-block';

    // 解答ボタンを無効化
    document.getElementById('submitAnswerBtn').disabled = true;
    document.getElementById('answerText').disabled = true;
  }

  /**
   * 次の問題へ進む
   */
  nextQuestion() {
    if (!this.quizState.isActive) {
      return;
    }

    // 候補選択UIが表示されている場合はクリーンアップ
    this.cleanupFuzzyCandidatesUI();

    // 現在の楽曲を完全に停止・クリーンアップ
    this.cleanupQuizAudioPlayer();
    console.log('[Quiz] 次の問題に進むため、現在の楽曲を停止しました');

    // 結果表示を非表示
    document.getElementById('quizResult').classList.add('hidden');
    document.getElementById('nextQuestionBtn').style.display = 'none';

    // 解答エリアを再有効化
    const answerInput = document.getElementById('answerText');
    const submitBtn = document.getElementById('submitAnswerBtn');
    answerInput.disabled = false;
    submitBtn.disabled = false;

    // 次の問題を出題（自動再生される）
    this.presentNextQuestion();
  }

  /**
   * クイズを中止する
   */
  stopQuiz() {
    if (!this.quizState.isActive) {
      return;
    }

    const confirmStop = confirm('クイズを中止しますか？\n現在までの結果が表示されます。');
    if (!confirmStop) {
      return;
    }

    console.log('[Quiz] ユーザーによってクイズが中止されました');
    this.endQuiz();
  }

  /**
   * クイズを終了し、結果を表示する
   */
  endQuiz() {
    console.log('[Quiz] クイズを終了します');

    // 候補選択UIが表示されている場合はクリーンアップ
    this.cleanupFuzzyCandidatesUI();

    // クイズ状態を非アクティブに（最初に設定してエラーメッセージを抑制）
    this.quizState.isActive = false;

    // 音楽を完全に停止・クリーンアップ
    this.cleanupQuizAudioPlayer();

    // 最終結果を表示
    this.showFinalResults();

    // UIを初期状態に戻す
    document.getElementById('quizContainer').classList.add('hidden');
    document.getElementById('quizResult').classList.add('hidden');
    document.getElementById('nextQuestionBtn').style.display = 'none';
    document.getElementById('submitAnswerBtn').disabled = false;
    document.getElementById('answerText').disabled = false;
    document.getElementById('answerText').value = '';

    // 絞り込み、回答方式選択、楽曲数表示エリアを再表示
    const filterSection = document.querySelector('.quiz-filter-section');
    const answerModeGroup = document.getElementById('answerModeGroup');
    const filterSummary = document.querySelector('.quiz-filter-summary');
    if (filterSection) {
      filterSection.style.display = '';
    }
    if (answerModeGroup) {
      answerModeGroup.style.display = '';
    }
    if (filterSummary) {
      filterSummary.style.display = '';
    }
  }

  /**
   * 最終結果を表示する
   */
  showFinalResults() {
    const totalQuestions = this.quizState.totalQuestions;
    const correctAnswers = this.quizState.correctAnswers;
    const responseTimes = this.quizState.responseTimes;

    if (totalQuestions === 0) {
      alert('問題が出題されませんでした。');
      return;
    }

    // 正答率を計算
    const accuracy = ((correctAnswers / totalQuestions) * 100).toFixed(1);

    // 平均回答時間を計算
    const averageTime = responseTimes.length > 0
      ? (responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length / 1000).toFixed(1)
      : '0.0';

    // 結果メッセージを作成
    const resultMessage = `
クイズ結果

出題数: ${totalQuestions}問
正答数: ${correctAnswers}問
正答率: ${accuracy}%
平均回答時間: ${averageTime}秒

お疲れさまでした！
    `.trim();

    console.log('[Quiz] 最終結果:', {
      totalQuestions,
      correctAnswers,
      accuracy: `${accuracy}%`,
      averageTime: `${averageTime}秒`
    });

    alert(resultMessage);
  }

  /**
   * 演習モード用の音量調節
   */
  adjustQuizVolume() {
    const volume = document.getElementById('quizVolumeSlider').value / 100;
    if (this.quizState.quizAudioPlayer) {
      this.quizState.quizAudioPlayer.volume = volume;
      console.log(`[Quiz] 音量を${volume * 100}%に変更しました`);
    }
  }

  /**
   * 曖昧一致候補選択UIを表示する
   * @param {Array<Song>} candidateSongs 候補楽曲の配列（重複タイトル除外済み）
   */
  showFuzzyCandidatesUI(candidateSongs) {
    const container = document.getElementById('fuzzyCandidatesContainer');
    const buttonsArea = document.getElementById('fuzzyCandidatesButtons');

    if (!container || !buttonsArea) {
      console.error('[Quiz] 候補選択UIの要素が見つかりません');
      return;
    }

    // 既存のボタンをクリア
    buttonsArea.innerHTML = '';

    // 各候補に対してボタンを生成
    candidateSongs.forEach(song => {
      const button = document.createElement('button');
      button.className = 'answer-choice-button';

      // タイトル表示
      const titleDisplay = Array.isArray(song.title) ? song.title[0] : song.title;
      button.textContent = titleDisplay;

      // クリックハンドラー
      const clickHandler = () => this.submitFuzzyCandidate(song);
      button.addEventListener('click', clickHandler);

      // クリーンアップ用にハンドラーを保存
      button._clickHandler = clickHandler;

      buttonsArea.appendChild(button);
    });

    // コンテナを表示
    container.classList.remove('hidden');

    // 回答ボタンと入力欄を無効化
    const submitBtn = document.getElementById('submitAnswerBtn');
    const answerInput = document.getElementById('answerText');
    if (submitBtn) submitBtn.disabled = true;
    if (answerInput) answerInput.disabled = true;

    // 候補選択中フラグを立てる
    this.quizState.awaitingCandidateSelection = true;

    console.log(`[Quiz] 候補選択UIを表示しました（${candidateSongs.length}件）`);
  }

  /**
   * 候補選択UIをクリーンアップする
   */
  cleanupFuzzyCandidatesUI() {
    const container = document.getElementById('fuzzyCandidatesContainer');
    const buttonsArea = document.getElementById('fuzzyCandidatesButtons');

    if (!container || !buttonsArea) return;

    // ボタンのイベントリスナーを削除
    const buttons = buttonsArea.querySelectorAll('.answer-choice-button');
    buttons.forEach(button => {
      if (button._clickHandler) {
        button.removeEventListener('click', button._clickHandler);
      }
    });

    // ボタンをクリア
    buttonsArea.innerHTML = '';

    // コンテナを非表示
    container.classList.add('hidden');

    // 回答ボタンと入力欄を再有効化
    const submitBtn = document.getElementById('submitAnswerBtn');
    const answerInput = document.getElementById('answerText');
    if (submitBtn) submitBtn.disabled = false;
    if (answerInput) answerInput.disabled = false;

    // 状態フラグをリセット
    this.quizState.awaitingCandidateSelection = false;
    this.quizState.fuzzyMatchCandidates = [];
    this.quizState.fuzzyUserAnswer = '';

    console.log('[Quiz] 候補選択UIをクリーンアップしました');
  }

  /**
   * 候補選択をキャンセルして入力に戻る
   */
  cancelFuzzySelection() {
    console.log('[Quiz] 候補選択をキャンセルしました');
    this.cleanupFuzzyCandidatesUI();

    // 入力欄にフォーカスを設定
    const answerInput = document.getElementById('answerText');
    if (answerInput) {
      answerInput.focus();
    }
  }

  /**
   * ユーザーの回答に曖昧一致する候補楽曲を検出する
   * @param {string} userAnswer ユーザーの回答
   * @returns {Array<Song>} 候補楽曲の配列
   */
  findFuzzyCandidates(userAnswer) {
    // 全楽曲データから曖昧一致する楽曲を抽出
    const candidates = this.songData.filter(song =>
      song.matchesAnswer(userAnswer, 'fuzzy')
    );

    console.log(`[Quiz] 曖昧一致候補: ${candidates.length}件検出`);
    return candidates;
  }

  /**
   * 候補楽曲をタイトルでグルーピングし、重複を排除する
   * @param {Array<Song>} candidateSongs 候補楽曲の配列
   * @returns {Object} { uniqueTitles: Array<string>, titleGroups: Map, representatives: Array<Song> }
   */
  groupCandidatesByTitle(candidateSongs) {
    const titleGroups = new Map();

    candidateSongs.forEach(song => {
      const normalizedTitle = (Array.isArray(song.title) ? song.title[0] : song.title).toLowerCase();
      if (!titleGroups.has(normalizedTitle)) {
        titleGroups.set(normalizedTitle, []);
      }
      titleGroups.get(normalizedTitle).push(song);
    });

    const uniqueTitles = Array.from(titleGroups.keys());

    // 各タイトルグループから代表楽曲を1つ選択
    const representatives = uniqueTitles.map(title => titleGroups.get(title)[0]);

    return { uniqueTitles, titleGroups, representatives };
  }

  /**
   * 曖昧一致モードでの回答処理
   * @param {string} userAnswer ユーザーの回答
   * @param {number} responseTime 回答時間（ミリ秒）
   */
  handleFuzzyAnswer(userAnswer, responseTime) {
    // 候補検出
    const candidates = this.findFuzzyCandidates(userAnswer);

    if (candidates.length === 0) {
      // ケースA: 候補なし → 不正解
      console.log('[Quiz] 候補なし → 不正解');
      this.quizState.responseTimes.push(responseTime);
      this.showQuestionResult(false, userAnswer, responseTime);
      this.quizState.usedSongs.push(this.quizState.currentQuizSong);
      return;
    }

    // タイトルでグルーピング
    const { uniqueTitles, titleGroups, representatives } = this.groupCandidatesByTitle(candidates);

    if (uniqueTitles.length === 1) {
      // ケースB: 全候補が同一タイトル → 即座に判定
      const isCorrect = titleGroups.get(uniqueTitles[0]).includes(this.quizState.currentQuizSong);
      console.log(`[Quiz] 同一タイトル候補 → ${isCorrect ? '正解' : '不正解'}`);

      if (isCorrect) {
        this.quizState.correctAnswers++;
      }

      this.quizState.responseTimes.push(responseTime);
      this.showQuestionResult(isCorrect, userAnswer, responseTime);
      this.quizState.usedSongs.push(this.quizState.currentQuizSong);
      return;
    }

    // ケースC: 複数の異なるタイトル → 候補選択UI表示
    console.log(`[Quiz] 複数タイトル候補（${uniqueTitles.length}件） → 選択UI表示`);
    this.quizState.fuzzyMatchCandidates = representatives;
    this.quizState.fuzzyUserAnswer = userAnswer;
    this.showFuzzyCandidatesUI(representatives);

    // 注意: 回答時間はこの時点では記録せず、候補選択後に記録
  }

  /**
   * 候補選択時の処理
   * @param {Song} selectedSong ユーザーが選択した楽曲
   */
  submitFuzzyCandidate(selectedSong) {
    if (!this.quizState.isActive || !this.quizState.currentQuizSong) {
      return;
    }

    // 候補選択UIをクリーンアップ
    this.cleanupFuzzyCandidatesUI();

    // 時間計測終了（初回回答からの経過時間）
    const responseTime = Date.now() - this.quizState.questionStartTime;
    this.quizState.responseTimes.push(responseTime);

    // 正誤判定
    const isCorrect = selectedSong === this.quizState.currentQuizSong;

    if (isCorrect) {
      this.quizState.correctAnswers++;
      console.log('[Quiz] 正解!');
    } else {
      console.log('[Quiz] 不正解');
    }

    // タイトル表示
    const userAnswer = Array.isArray(selectedSong.title) ? selectedSong.title[0] : selectedSong.title;

    // 結果表示
    this.showQuestionResult(isCorrect, userAnswer, responseTime);

    // 使用済み楽曲に追加
    this.quizState.usedSongs.push(this.quizState.currentQuizSong);
  }

  /**
   * クリーンアップ処理
   * モード切り替え時にイベントリスナーを削除し、音楽を停止する
   */
  cleanup() {
    console.log('[QuizMode] 演習モードをクリーンアップします');

    // 候補選択UIをクリーンアップ
    this.cleanupFuzzyCandidatesUI();

    // クイズがアクティブな場合は終了
    if (this.quizState.isActive) {
      this.quizState.isActive = false;
      this.cleanupQuizAudioPlayer();
    }

    // イベントリスナーを削除
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];

    console.log('[QuizMode] クリーンアップ完了');
  }

  /**
   * データ更新時の処理
   * @param {Array} newSongData 新しい楽曲データの配列
   * @param {boolean} newIsMusicDirSet 音楽ディレクトリが設定されているか
   */
  updateSongData(newSongData, newIsMusicDirSet) {
    this.songData = newSongData;
    this.isMusicDirSet = newIsMusicDirSet;

    // フィルターコントロールを再描画
    this.renderQuizFilterControls();

    // 楽曲数を更新
    this.updateQuizSongCounts();
  }
}

module.exports = { QuizMode };
