// filter-controls.js - フィルターUIコントロールの共通機能
// listening-modeとquiz-modeで共有されるフィルター関連の機能を提供

/**
 * フィルターコントロールを管理するクラス
 * チェックボックス/ラジオボタンの生成と値の取得を担当
 */
class FilterControls {
  /**
   * 指定された値の配列からチェックボックス群を作成し、コンテナに追加する
   * @param {string[]} values チェックボックスにする値の配列
   * @param {HTMLElement} container チェックボックスを追加する親要素
   * @param {string} groupName チェックボックスグループの名前 (inputのname属性)
   * @param {Function} onChange チェックボックス変更時のコールバック関数
   */
  static createCheckboxesForGroup(values, container, groupName, onChange) {
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

      if (onChange) {
        checkbox.addEventListener('change', onChange);
      }

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
   * 指定された値の配列からラジオボタン群を作成し、コンテナに追加する
   * @param {string[]} values ラジオボタンにする値の配列
   * @param {HTMLElement} container ラジオボタンを追加する親要素
   * @param {string} groupName ラジオボタングループの名前 (inputのname属性)
   * @param {Function} onChange ラジオボタン変更時のコールバック関数
   */
  static createRadioButtonsForGroup(values, container, groupName, onChange) {
    if (values.length === 0) {
      container.innerHTML = '<p class="no-filter-options">該当データなし</p>';
      return;
    }

    values.forEach((value, index) => {
      const radioId = `${groupName}-${index}-${value.replace(/[^a-zA-Z0-9]/g, '-')}`;

      const label = document.createElement('label');
      label.className = 'radio-label';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.id = radioId;
      radio.name = groupName;
      radio.value = value;

      if (onChange) {
        radio.addEventListener('change', onChange);
      }

      label.appendChild(radio);
      label.appendChild(document.createTextNode(value));

      label.addEventListener('click', (e) => {
        if (e.target === radio) {
          return;
        }
        e.preventDefault();
        radio.checked = true;
        radio.dispatchEvent(new Event('change'));
      });

      container.appendChild(label);
    });
  }

  /**
   * 選択されたチェックボックスの値を取得する
   * @param {string} groupName チェックボックスのname属性
   * @returns {string[]} 選択された値の配列
   */
  static getSelectedCheckboxValues(groupName) {
    const checkboxes = document.querySelectorAll(`input[name="${groupName}"]:checked`);
    return Array.from(checkboxes).map(cb => cb.value);
  }

  /**
   * 選択されたラジオボタンの値を取得する
   * @param {string} groupName ラジオボタンのname属性
   * @returns {string|null} 選択された値（選択されていない場合はnull）
   */
  static getSelectedRadioValue(groupName) {
    const radio = document.querySelector(`input[name="${groupName}"]:checked`);
    return radio ? radio.value : null;
  }

  /**
   * 指定されたグループの全てのチェックボックスをクリアする
   * @param {string} groupName チェックボックスのname属性
   */
  static clearCheckboxes(groupName) {
    const checkboxes = document.querySelectorAll(`input[name="${groupName}"]`);
    checkboxes.forEach(cb => {
      cb.checked = false;
    });
  }

  /**
   * 指定されたグループの全てのラジオボタンをクリアする
   * @param {string} groupName ラジオボタンのname属性
   */
  static clearRadioButtons(groupName) {
    const radios = document.querySelectorAll(`input[name="${groupName}"]`);
    radios.forEach(radio => {
      radio.checked = false;
    });
  }

  /**
   * フィルターコンテナの表示/非表示を切り替える
   * @param {string} containerId コンテナ要素のID
   * @param {string} toggleButtonId 切り替えボタンのID
   * @param {string} showText 表示時のボタンテキスト（デフォルト: "詳細絞り込み ▲"）
   * @param {string} hideText 非表示時のボタンテキスト（デフォルト: "詳細絞り込み ▼"）
   */
  static toggleFilterContainer(containerId, toggleButtonId, showText = '詳細絞り込み ▲', hideText = '詳細絞り込み ▼') {
    const container = document.getElementById(containerId);
    const toggleButton = document.getElementById(toggleButtonId);

    if (!container || !toggleButton) {
      console.warn(`[FilterControls] 要素が見つかりません: container=${containerId}, button=${toggleButtonId}`);
      return;
    }

    if (container.classList.contains('hidden')) {
      container.classList.remove('hidden');
      toggleButton.textContent = showText;
    } else {
      container.classList.add('hidden');
      toggleButton.textContent = hideText;
    }
  }
}

module.exports = { FilterControls };
