// quiz-mode.js - 演習モードの管理
const songUtils = require('../utils/songUtils.js');

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
      quizAudioPlayer: null
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

    this.createCheckboxesForQuizGroup(types, typeContainer, 'quizTypeFilter');
    this.createCheckboxesForQuizGroup(generations, generationContainer, 'quizGenerationFilter');
    this.createCheckboxesForQuizGroup(games, gameContainer, 'quizGameFilter');
    this.createCheckboxesForQuizGroup(stages, stageContainer, 'quizStageFilter');
  }

  /**
   * 演習モード用：指定された値の配列からチェックボックス群を作成し、コンテナに追加する
   * @param {string[]} values チェックボックスにする値の配列
   * @param {HTMLElement} container チェックボックスを追加する親要素
   * @param {string} groupName チェックボックスグループの名前 (inputのname属性)
   */
  createCheckboxesForQuizGroup(values, container, groupName) {
    if (values.length === 0) {
      container.innerHTML = '<p class="no-filter-options">該当データなし</p>';
      return;
    }
    values.forEach((value, index) => {
      // ユニークなIDを生成（インデックスを含めることで重複を防ぐ）
      const checkboxId = `${groupName}-${index}-${value.replace(/[^a-zA-Z0-9]/g, '-')}`;

      const label = document.createElement('label');
      label.className = 'checkbox-label';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = checkboxId;
      checkbox.name = groupName;
      checkbox.value = value;
      checkbox.addEventListener('change', () => this.updateQuizSongCounts());

      // ラベルにinput要素を最初に追加し、その後にテキストを追加
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(value));

      // ラベル自体にクリックイベントを追加して確実に動作させる
      label.addEventListener('click', (e) => {
        // チェックボックス自体がクリックされた場合は何もしない（ブラウザの標準動作に任せる）
        if (e.target === checkbox) {
          return;
        }
        // ラベルテキスト部分がクリックされた場合
        e.preventDefault();
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      });

      container.appendChild(label);
    });
  }

  /**
   * 演習モード用：選択されたチェックボックスの値を取得するヘルパー
   * @param {string} groupName チェックボックスのname属性
   * @returns {string[]} 選択された値の配列
   */
  getSelectedQuizCheckboxValues(groupName) {
    const checkboxes = document.querySelectorAll(`input[name="${groupName}"]:checked`);
    return Array.from(checkboxes).map(cb => cb.value);
  }

  /**
   * 演習モード用：現在のフィルター条件に基づいて楽曲データをフィルタリングする
   * @returns {Array} フィルタリングされた楽曲データの配列
   */
  filterQuizSongsInternal() {
    // チェックボックスから選択された値を取得
    const selectedTypes = this.getSelectedQuizCheckboxValues('quizTypeFilter');
    const selectedGenerations = this.getSelectedQuizCheckboxValues('quizGenerationFilter');
    const selectedGames = this.getSelectedQuizCheckboxValues('quizGameFilter');
    const selectedStages = this.getSelectedQuizCheckboxValues('quizStageFilter');

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

    document.getElementById('quizTotalSongs').textContent = `楽曲数: ${totalCount}曲`;
    document.getElementById('quizAvailableSongs').textContent = `| 再生可能: ${availableCount}曲`;

    // 回答方式と再生可能楽曲数に応じて「クイズを開始」ボタンの状態を制御
    this.updateQuizStartButtonForAnswerMode();
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

    if (answerMode !== 'exact') {
      // 完全一致以外の場合はボタンを無効化
      startQuizBtn.disabled = true;
      startQuizBtn.title = `${answerMode === 'fuzzy' ? '曖昧一致' : 'ボタン回答'}モードは現在未実装です。完全一致モードをご利用ください。`;
      console.log(`[Quiz] ${answerMode}モードは未実装のため、クイズ開始ボタンを無効化しました`);
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
      quizAudioPlayer: null
    };

    console.log(`[Quiz] ${availableSongs.length}曲が出題対象です`);

    // UIを出題モードに切り替え
    document.getElementById('quizContainer').classList.remove('hidden');
    document.getElementById('quizResult').classList.add('hidden');
    document.getElementById('nextQuestionBtn').style.display = 'none';

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

    // 解答用テキストボックスをクリアして有効化
    const answerInput = document.getElementById('answerText');
    answerInput.value = '';
    answerInput.disabled = false;

    // 回答ボタンを有効化
    document.getElementById('submitAnswerBtn').disabled = false;

    // 音楽を読み込み（これは非同期処理）
    this.loadQuizSong(selectedSong);

    // 時間計測開始
    this.quizState.questionStartTime = Date.now();

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
      if (this.quizState.isActive && this.quizState.currentQuizSong === selectedSong) {
        const input = document.getElementById('answerText');
        if (input && !input.disabled) {
          input.focus();
          // さらにsetTimeoutで最終確認（Electronのウィンドウフォーカス問題対策）
          setTimeout(() => {
            if (this.quizState.isActive && this.quizState.currentQuizSong === selectedSong) {
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
    this.quizState.responseTimes.push(responseTime);

    console.log(`[Quiz] ユーザー回答: "${userAnswer}", 正解: "${this.quizState.currentQuizSong.title}", 回答時間: ${responseTime}ms`);

    try {
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
   * クリーンアップ処理
   * モード切り替え時にイベントリスナーを削除し、音楽を停止する
   */
  cleanup() {
    console.log('[QuizMode] 演習モードをクリーンアップします');

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
