'use strict';

// ── MindAR + p5.js AR骨格 ────────────────────────────────────────────────────
// 依存: Three.js, MindAR (mindar-image-three.prod.js), p5.js

let mindarThree = null;
let anchor      = null;
let isTracking  = false;

// p5.js スケッチ（オーバーレイ）
let p5Instance  = null;

// ── AR初期化 ─────────────────────────────────────────────────────────────────
async function startAR() {
  const container = document.getElementById('ar-container');

  mindarThree = new window.MINDAR.IMAGE.MindARThree({
    container,
    imageTargetSrc: 'targets.mind', // ← コンパイル済み .mind ファイルを配置
    uiLoading:  'yes',
    uiScanning: 'yes',
    uiError:    'yes',
  });

  const { renderer, scene, camera } = mindarThree;

  // ターゲット0番を監視
  anchor = mindarThree.addAnchor(0);

  anchor.onTargetFound = () => {
    isTracking = true;
    showOverlay();
    console.log('ターゲット検出');
  };

  anchor.onTargetLost = () => {
    isTracking = false;
    hideOverlay();
    console.log('ターゲット消失');
  };

  await mindarThree.start();

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });
}

// ── p5.js オーバーレイ ────────────────────────────────────────────────────────
function initOverlay() {
  const sketch = (p) => {
    p.setup = () => {
      const cnv = p.createCanvas(window.innerWidth, window.innerHeight);
      cnv.id('p5-overlay');
      cnv.style('position', 'fixed');
      cnv.style('top', '0');
      cnv.style('left', '0');
      cnv.style('pointer-events', 'none'); // タップはDOMに貫通させる
      cnv.style('display', 'none');
      p.noLoop();
    };

    p.draw = () => {
      p.clear();
      // ── ここにアニメーションを実装 ──
      // 例: p.background(0, 0, 0, 100);
    };

    p.windowResized = () => {
      p.resizeCanvas(window.innerWidth, window.innerHeight);
    };
  };

  p5Instance = new p5(sketch);
}

function showOverlay() {
  const cnv = document.getElementById('p5-overlay');
  if (cnv) {
    cnv.style.display = 'block';
    if (p5Instance) p5Instance.loop();
  }
}

function hideOverlay() {
  const cnv = document.getElementById('p5-overlay');
  if (cnv) {
    cnv.style.display = 'none';
    if (p5Instance) p5Instance.noLoop();
  }
}

// ── タップハンドラ（patatap的インタラクション用） ──────────────────────────
document.addEventListener('click', (e) => {
  if (!isTracking) return;
  // ── ここにタップ時のビジュアル変化を実装 ──
  console.log('タップ:', e.clientX, e.clientY);
});

// ── エラー表示 ────────────────────────────────────────────────────────────────
function showError(msg) {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:red;color:white;font-size:14px;padding:12px;z-index:9999;white-space:pre-wrap;word-break:break-all;';
  div.textContent = msg;
  document.body.appendChild(div);
}

// ── 起動 ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  if (typeof window.MINDAR === 'undefined') {
    showError('MindAR が読み込まれていません。ネットワーク接続を確認してください。');
    return;
  }
  if (typeof THREE === 'undefined') {
    showError('Three.js が読み込まれていません。');
    return;
  }

  initOverlay();
  startAR().catch((err) => {
    console.error('AR起動エラー:', err);
    showError('AR起動エラー:\n' + (err && err.message ? err.message : String(err)));
  });
});
