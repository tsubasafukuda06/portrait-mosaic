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

// ── ページロード時から状態を監視 ──────────────────────────────────────────────
let diagCount = 0;
const diagTimer = setInterval(() => {
  const sceneEl = document.querySelector('a-scene');
  if (!sceneEl) return;
  const sys = Object.keys(sceneEl.systems || {}).slice(0,3).join(',');
  const comp = sceneEl.components ? Object.keys(sceneEl.components).slice(0,3).join(',') : '-';
  setDebug(`t=${diagCount} loaded=${sceneEl.hasLoaded} sys=[${sys}] comp=[${comp}]`);
  diagCount++;
  if (diagCount > 60) clearInterval(diagTimer);
}, 500);

// ── 起動 ─────────────────────────────────────────────────────────────────────
initOverlay();

document.getElementById('start-btn').addEventListener('click', async () => {
  clearInterval(diagTimer);
  document.getElementById('start-screen').style.display = 'none';
  setDebug('⏳ 起動中...');

  const sceneEl = document.querySelector('a-scene');

  // systemが利用可能になるまでポーリング（最大15秒）
  let arSystem = null;
  for (let i = 0; i < 75; i++) {
    arSystem = sceneEl.systems && sceneEl.systems['mindar-image-system'];
    if (arSystem) break;
    setDebug('⏳ 起動中... ' + i + ' loaded=' + sceneEl.hasLoaded);
    await new Promise(r => setTimeout(r, 200));
  }

  if (!arSystem) {
    const comp = sceneEl.components ? Object.keys(sceneEl.components).join(',') : 'none';
    const sys = sceneEl.systems ? Object.keys(sceneEl.systems).join(',') : 'none';
    showError('MindARシステムが見つかりません\nloaded=' + sceneEl.hasLoaded + '\ncomp=' + comp + '\nsys=' + sys);
    return;
  }

  setDebug('⏳ カメラ起動中...');
  try {
    setupAREvents();
    arSystem.start();
    setDebug('🔍 表紙を探しています...');
  } catch (err) {
    showError('startエラー: ' + (err.message || String(err)));
  }
});
