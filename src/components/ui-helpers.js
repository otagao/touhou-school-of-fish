// ui-helpers.js - UI制御のヘルパー関数
// モーダル、ダイアログ、DOM操作など、共通のUI制御機能を提供

/**
 * UI制御のヘルパー関数を提供するクラス
 */
class UIHelpers {
  /**
   * 要素の表示/非表示を切り替える
   * @param {string} elementId 要素のID
   * @param {boolean} show trueで表示、falseで非表示
   */
  static toggleElement(elementId, show) {
    const element = document.getElementById(elementId);
    if (element) {
      if (show) {
        element.classList.remove('hidden');
      } else {
        element.classList.add('hidden');
      }
    } else {
      console.warn(`[UIHelpers] 要素が見つかりません: ${elementId}`);
    }
  }

  /**
   * 要素を表示する
   * @param {string} elementId 要素のID
   */
  static showElement(elementId) {
    this.toggleElement(elementId, true);
  }

  /**
   * 要素を非表示にする
   * @param {string} elementId 要素のID
   */
  static hideElement(elementId) {
    this.toggleElement(elementId, false);
  }

  /**
   * 確認ダイアログを表示する
   * @param {string} message 確認メッセージ
   * @returns {boolean} OKが押された場合true、キャンセルの場合false
   */
  static showConfirmDialog(message) {
    return confirm(message);
  }

  /**
   * アラートダイアログを表示する
   * @param {string} message アラートメッセージ
   */
  static showAlert(message) {
    alert(message);
  }

  /**
   * 要素にイベントリスナーを追加する
   * @param {string} elementId 要素のID
   * @param {string} event イベント名
   * @param {Function} handler イベントハンドラー
   * @returns {Object|null} リスナー情報（削除用）、要素が見つからない場合null
   */
  static addEventListener(elementId, event, handler) {
    const element = document.getElementById(elementId);
    if (element) {
      element.addEventListener(event, handler);
      return { element, event, handler };
    } else {
      console.warn(`[UIHelpers] 要素が見つかりません: ${elementId}`);
      return null;
    }
  }

  /**
   * イベントリスナーを削除する
   * @param {Object} listenerInfo addEventListener()で返されたリスナー情報
   */
  static removeEventListener(listenerInfo) {
    if (listenerInfo && listenerInfo.element) {
      listenerInfo.element.removeEventListener(listenerInfo.event, listenerInfo.handler);
    }
  }

  /**
   * 要素のテキストコンテンツを設定する
   * @param {string} elementId 要素のID
   * @param {string} text 設定するテキスト
   */
  static setTextContent(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = text;
    } else {
      console.warn(`[UIHelpers] 要素が見つかりません: ${elementId}`);
    }
  }

  /**
   * 要素のHTMLコンテンツを設定する
   * @param {string} elementId 要素のID
   * @param {string} html 設定するHTML
   */
  static setHTMLContent(elementId, html) {
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = html;
    } else {
      console.warn(`[UIHelpers] 要素が見つかりません: ${elementId}`);
    }
  }

  /**
   * 要素のHTMLコンテンツをクリアする
   * @param {string} elementId 要素のID
   */
  static clearContent(elementId) {
    this.setHTMLContent(elementId, '');
  }

  /**
   * 要素の有効/無効を切り替える
   * @param {string} elementId 要素のID
   * @param {boolean} enabled trueで有効、falseで無効
   */
  static setEnabled(elementId, enabled) {
    const element = document.getElementById(elementId);
    if (element) {
      element.disabled = !enabled;
    } else {
      console.warn(`[UIHelpers] 要素が見つかりません: ${elementId}`);
    }
  }

  /**
   * 要素の値を取得する
   * @param {string} elementId 要素のID
   * @returns {string|null} 要素の値、要素が見つからない場合null
   */
  static getValue(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      return element.value;
    } else {
      console.warn(`[UIHelpers] 要素が見つかりません: ${elementId}`);
      return null;
    }
  }

  /**
   * 要素の値を設定する
   * @param {string} elementId 要素のID
   * @param {string} value 設定する値
   */
  static setValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      element.value = value;
    } else {
      console.warn(`[UIHelpers] 要素が見つかりません: ${elementId}`);
    }
  }

  /**
   * 要素にクラスを追加する
   * @param {string} elementId 要素のID
   * @param {string} className 追加するクラス名
   */
  static addClass(elementId, className) {
    const element = document.getElementById(elementId);
    if (element) {
      element.classList.add(className);
    } else {
      console.warn(`[UIHelpers] 要素が見つかりません: ${elementId}`);
    }
  }

  /**
   * 要素からクラスを削除する
   * @param {string} elementId 要素のID
   * @param {string} className 削除するクラス名
   */
  static removeClass(elementId, className) {
    const element = document.getElementById(elementId);
    if (element) {
      element.classList.remove(className);
    } else {
      console.warn(`[UIHelpers] 要素が見つかりません: ${elementId}`);
    }
  }

  /**
   * 要素にフォーカスを設定する
   * @param {string} elementId 要素のID
   */
  static setFocus(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.focus();
    } else {
      console.warn(`[UIHelpers] 要素が見つかりません: ${elementId}`);
    }
  }
}

module.exports = { UIHelpers };
