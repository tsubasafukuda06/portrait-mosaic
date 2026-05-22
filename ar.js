'use strict';

import 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-image.prod.js';

let controller = null;
let isTracking = false;
let p5Instance = null;

// ── カメラ起動 ────────────────────────────────────────────────────────────────
async function startCamera() {
  const video = document.getElementById('video');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false,
  });
  video.srcObject = stream;
  await new Promise(resolve => video.addEventListener('loadedmetadata', resolve, { once: true }));
  await video.play();
  return video;
}

// ── AR起動 ────────────────────────────────────────────────────────────────────
async function startAR() {
  const video = await startCamera();
  setDebug('カメラ起動 ✅');

  const response = await fetch('targets.mind');
  if (!response.ok) throw new Error('targets.mind が見つかりません');
  const buffer = await response.arrayBuffer();

  controller = new window.MINDAR.IMAGE.Controller({
    inputWidth:  video.videoWidth,
    inputHeight: video.videoHeight,
    maxTrack: 1,
    onUpdate: ({ type, targetIndex, worldMatrix }) => {
      if (type === 'processDone') return; // フレーム処理完了（毎フレーム）

      if (type === 'updateMatrix') {
        if (worldMatrix !== null) {
          // ターゲット検出
          if (!isTracking) {
            isTracking = true;
            showOverlay();
            setDebug('✅ 表紙を認識中');
          }
        } else {
          // ターゲット消失
          if (isTracking) {
            isTracking = false;
            hideOverlay();
            setDebug('🔍 表紙を探しています...');
          }
        }
      }
    },
  });

  controller.addImageTargetsFromBuffer(buffer);

  // GPU ウォームアップ（初回検出を速くする）
  controller.dummyRun(video);

  setDebug('🔍 表紙を探しています...');
  controller.processVideo(video);
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

document.getElementById('start-btn').addEventListener('click', () => {
  document.getElementById('start-screen').style.display = 'none';
  startAR().catch((err) => {
    console.error(err);
    showError('エラー: ' + (err.message || String(err)));
  });
});
