'use strict';
// MindARThree (Three.js版) を使用
// import mapで "three" をローカルファイルに解決

import 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-image-three.prod.js';

let mindarThree = null;
let isTracking  = false;
let p5Instance  = null;

// ── AR起動 ────────────────────────────────────────────────────────────────────
async function startAR() {
  const container = document.getElementById('ar-container');

  mindarThree = new window.MINDAR.IMAGE.MindARThree({
    container,
    imageTargetSrc: 'targets.mind',
    uiLoading:  'no',
    uiScanning: 'no',
    uiError:    'no',
  });

  const { renderer, scene, camera } = mindarThree;

  const anchor = mindarThree.addAnchor(0);

  anchor.onTargetFound = () => {
    isTracking = true;
    showOverlay();
    setDebug('✅ 表紙を認識中');
  };

  anchor.onTargetLost = () => {
    isTracking = false;
    hideOverlay();
    setDebug('🔍 表紙を探しています...');
  };

  setDebug('🔍 表紙を探しています...');
  await mindarThree.start();

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });
}

// ── p5.js オーバーレイ ────────────────────────────────────────────────────────
function initOverlay() {
  p5Instance = new p5((p) => {
    p.setup = () => {
      const cnv = p.createCanvas(window.innerWidth, window.innerHeight);
      cnv.style('position', 'fixed');
      cnv.style('top', '0');
      cnv.style('left', '0');
      cnv.style('pointer-events', 'none');
      cnv.style('display', 'none');
      p.noLoop();
    };
    p.draw = () => {
      p.clear();
      // ── アニメーションをここに実装 ──
    };
    p.windowResized = () => {
      p.resizeCanvas(window.innerWidth, window.innerHeight);
    };
  });
}

function showOverlay() {
  const cnv = document.querySelector('canvas.p5Canvas');
  if (cnv) { cnv.style.display = 'block'; p5Instance && p5Instance.loop(); }
}

function hideOverlay() {
  const cnv = document.querySelector('canvas.p5Canvas');
  if (cnv) { cnv.style.display = 'none'; p5Instance && p5Instance.noLoop(); }
}

// ── タップ ────────────────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  if (!isTracking) return;
  console.log('タップ:', e.clientX, e.clientY);
  // ── patatap的エフェクトをここに実装 ──
});

// ── デバッグ表示 ──────────────────────────────────────────────────────────────
function setDebug(msg) {
  const el = document.getElementById('debug');
  if (el) el.textContent = msg;
}

function showError(msg) {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:red;color:#fff;font-size:14px;padding:12px;z-index:9999;white-space:pre-wrap;word-break:break-all;';
  div.textContent = msg;
  document.body.appendChild(div);
}

// ── 起動 ─────────────────────────────────────────────────────────────────────
initOverlay();

document.getElementById('start-btn').addEventListener('click', () => {
  document.getElementById('start-screen').style.display = 'none';
  startAR().catch((err) => {
    console.error(err);
    showError('エラー: ' + (err.message || String(err)));
  });
});
