/**
 * ビルド後のクリーンアップスクリプト
 * electron-builderのafterPackフックで実行される
 * 不要なファイルを削除してパッケージサイズを削減する
 */

const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  const appOutDir = context.appOutDir;
  console.log('クリーンアップを開始:', appOutDir);

  // 削除対象のファイルとディレクトリ
  const itemsToRemove = [
    // 不要なロケールファイル（ja.pakとen-US.pak以外）
    'locales/af.pak',
    'locales/am.pak',
    'locales/ar.pak',
    'locales/bg.pak',
    'locales/bn.pak',
    'locales/ca.pak',
    'locales/cs.pak',
    'locales/da.pak',
    'locales/de.pak',
    'locales/el.pak',
    'locales/en-GB.pak',
    'locales/es-419.pak',
    'locales/es.pak',
    'locales/et.pak',
    'locales/fa.pak',
    'locales/fi.pak',
    'locales/fil.pak',
    'locales/fr.pak',
    'locales/gu.pak',
    'locales/he.pak',
    'locales/hi.pak',
    'locales/hr.pak',
    'locales/hu.pak',
    'locales/id.pak',
    'locales/it.pak',
    'locales/kn.pak',
    'locales/ko.pak',
    'locales/lt.pak',
    'locales/lv.pak',
    'locales/ml.pak',
    'locales/mr.pak',
    'locales/ms.pak',
    'locales/nb.pak',
    'locales/nl.pak',
    'locales/pl.pak',
    'locales/pt-BR.pak',
    'locales/pt-PT.pak',
    'locales/ro.pak',
    'locales/ru.pak',
    'locales/sk.pak',
    'locales/sl.pak',
    'locales/sr.pak',
    'locales/sv.pak',
    'locales/sw.pak',
    'locales/ta.pak',
    'locales/te.pak',
    'locales/th.pak',
    'locales/tr.pak',
    'locales/uk.pak',
    'locales/ur.pak',
    'locales/vi.pak',
    'locales/zh-CN.pak',
    'locales/zh-TW.pak',

    // Vulkan/DirectX関連（3Dレンダリング不使用のため）
    'vk_swiftshader.dll',
    'vk_swiftshader_icd.json',
    'vulkan-1.dll',
    'dxcompiler.dll',
    'dxil.dll',
    'd3dcompiler_47.dll',

    // 高DPI用リソース（オプション: サイズ削減優先の場合）
    'chrome_200_percent.pak'
  ];

  let removedCount = 0;
  let totalSizeSaved = 0;

  for (const item of itemsToRemove) {
    const itemPath = path.join(appOutDir, item);

    try {
      if (fs.existsSync(itemPath)) {
        const stats = fs.statSync(itemPath);
        const size = stats.size;

        fs.unlinkSync(itemPath);
        removedCount++;
        totalSizeSaved += size;
        console.log(`削除: ${item} (${(size / 1024).toFixed(2)} KB)`);
      }
    } catch (error) {
      console.warn(`削除失敗: ${item} - ${error.message}`);
    }
  }

  console.log(`\nクリーンアップ完了:`);
  console.log(`  削除ファイル数: ${removedCount}`);
  console.log(`  削減サイズ: ${(totalSizeSaved / 1024 / 1024).toFixed(2)} MB`);
};
