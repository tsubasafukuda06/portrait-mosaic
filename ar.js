'use strict';

let isTracking = false;
let p5Instance = null;

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
      cnv.style('z-index', '100');
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

// ── ターゲット イベント ────────────────────────────────────────────────────────
function setupAREvents() {
  const target = document.getElementById('ar-target');
  target.addEventListener('targetFound', () => {
    isTracking = true;
    showOverlay();
    setDebug('✅ 表紙を認識中');
  });
  target.addEventListener('targetLost', () => {
    isTracking = false;
    hideOverlay();
    setDebug('🔍 表紙を探しています...');
  });
}

// ── タップ ────────────────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  if (!isTracking) return;
  console.log('タップ:', e.clientX, e.clientY);
  // ── patatap的エフェクトをここに実装 ──
});

// ── ユーティリティ ────────────────────────────────────────────────────────────
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

document.getElementById('start-btn').addEventListener('click', async () => {
  document.getElementById('start-screen').style.display = 'none';
  setDebug('🔍 表紙を探しています...');

  const sceneEl = document.querySelector('a-scene');

  // sceneEl の loaded を待つ
  if (!sceneEl.hasLoaded) {
    await new Promise(resolve => sceneEl.addEventListener('loaded', resolve, { once: true }));
  }

  const arSystem = sceneEl.systems['mindar-image-system'];
  if (!arSystem) { showError('MindARシステムが見つかりません'); return; }

  try {
    setupAREvents();
    arSystem.start();
  } catch (err) {
    showError('ARエラー: ' + (err.message || String(err)));
  }
});
