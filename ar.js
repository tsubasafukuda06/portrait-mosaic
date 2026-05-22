'use strict';

// ── Mosaic config (cover.js と同じ値) ────────────────────────────────────────
const FG        = [59, 138, 222];
const BG        = [255, 255, 255];
const QR_MOD    = 5;
const THRESHOLD = 120;

const CANVAS_W = 600;
const CANVAS_H = 888;

const QR_CX = CANVAS_W * 0.50;
const QR_CY = CANVAS_H * 0.40;

const ZONES = [
  [178, QR_MOD    ],
  [277, QR_MOD * 2],
  [355, QR_MOD * 4],
  [459, QR_MOD * 6],
  [Infinity, QR_MOD * 6],
];

// ── State ─────────────────────────────────────────────────────────────────────
let isTracking = false;
let audioCtx   = null;
let faceCanvas = null;
let faceCtx    = null;
let texture    = null;
let animFrame  = null;

// ── パーティクル ───────────────────────────────────────────────────────────────
const particles = [];

let overlayCanvas = null;
let overlayCtx    = null;

function initOverlay() {
  overlayCanvas               = document.createElement('canvas');
  overlayCanvas.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:100;';
  overlayCanvas.width         = window.innerWidth;
  overlayCanvas.height        = window.innerHeight;
  document.body.appendChild(overlayCanvas);
  overlayCtx = overlayCanvas.getContext('2d');

  window.addEventListener('resize', () => {
    overlayCanvas.width  = window.innerWidth;
    overlayCanvas.height = window.innerHeight;
  });
}

// タップ地点のキャンバス座標でモザイク色をサンプリング
function sampleMosaicColor(screenX, screenY) {
  const cx = (screenX / window.innerWidth)  * CANVAS_W;
  const cy = (screenY / window.innerHeight) * CANVAS_H;
  const px = faceCtx.getImageData(Math.round(cx), Math.round(cy), 1, 1).data;
  return [px[0], px[1], px[2]];
}

// ピクセル散乱エフェクトをスポーン
function spawnPixels(screenX, screenY) {
  const count = 18;
  for (let i = 0; i < count; i++) {
    // タップ周辺の少しずつ違う点からサンプリング
    const jx = screenX + (Math.random() - 0.5) * 60;
    const jy = screenY + (Math.random() - 0.5) * 60;
    const color = sampleMosaicColor(
      Math.max(0, Math.min(window.innerWidth  - 1, jx)),
      Math.max(0, Math.min(window.innerHeight - 1, jy))
    );

    // タップ地点から外向きにランダムな速度
    const angle  = Math.random() * Math.PI * 2;
    const speed  = 4 + Math.random() * 8;
    const size   = 5 + Math.floor(Math.random() * 3) * 5;  // 5, 10, 15px

    particles.push({
      x:     jx,
      y:     jy,
      vx:    Math.cos(angle) * speed,
      vy:    Math.sin(angle) * speed - 2,  // 少し上向きバイアス
      size,
      color,
      alpha: 1,
    });
  }
}

function updateParticles() {
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x    += p.vx;
    p.y    += p.vy;
    p.vy   += 0.4;          // 重力
    p.alpha -= 0.025;
    if (p.alpha <= 0) { particles.splice(i, 1); continue; }

    overlayCtx.globalAlpha = p.alpha;
    overlayCtx.fillStyle   = `rgb(${p.color[0]},${p.color[1]},${p.color[2]})`;
    overlayCtx.fillRect(p.x, p.y, p.size, p.size);
  }
  overlayCtx.globalAlpha = 1;
}

// ── Audio ─────────────────────────────────────────────────────────────────────
const ZONE_FREQ = [
  261.6, 293.7, 329.6,
  349.2, 392.0, 440.0,
  493.9, 523.3, 587.3,
];

function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playTone(freq) {
  if (!audioCtx) return;
  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.6);
}

// ── Mosaic 描画 ───────────────────────────────────────────────────────────────
function drawMosaic(pixels, imgW, imgH) {
  faceCtx.fillStyle = `rgb(${BG[0]},${BG[1]},${BG[2]})`;
  faceCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  function sampleBright(cx, cy) {
    const ix = Math.min(Math.max(Math.floor(cx / CANVAS_W * (imgW - 1)), 0), imgW - 1);
    const iy = Math.min(Math.max(Math.floor(cy / CANVAS_H * (imgH - 1)), 0), imgH - 1);
    const p  = (iy * imgW + ix) * 4;
    return pixels[p] * 0.299 + pixels[p + 1] * 0.587 + pixels[p + 2] * 0.114;
  }

  const cols = Math.ceil(CANVAS_W / QR_MOD);
  const rows = Math.ceil(CANVAS_H / QR_MOD);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * QR_MOD;
      const y = r * QR_MOD;

      const cx_ = x + QR_MOD / 2;
      const cy_ = y + QR_MOD / 2;
      const d   = Math.max(Math.abs(cx_ - QR_CX), Math.abs(cy_ - QR_CY));
      const S   = ZONES.find(z => d < z[0])[1];

      if (x % S !== 0 || y % S !== 0) continue;

      const tileCX = x + S / 2;
      const tileCY = y + S / 2;

      if (sampleBright(tileCX, tileCY) < THRESHOLD) {
        faceCtx.fillStyle = `rgb(${FG[0]},${FG[1]},${FG[2]})`;
        faceCtx.fillRect(x, y, S, S);
      }
    }
  }
}

// ── アニメーションループ ───────────────────────────────────────────────────────
function animLoop() {
  updateParticles();
  if (isTracking || particles.length > 0) {
    animFrame = requestAnimationFrame(animLoop);
  } else {
    animFrame = null;
  }
}

function ensureLoop() {
  if (!animFrame) animFrame = requestAnimationFrame(animLoop);
}

// ── ゾーン判定 ────────────────────────────────────────────────────────────────
function getZone(x, y) {
  const col = Math.floor(x / window.innerWidth  * 3);
  const row = Math.floor(y / window.innerHeight * 3);
  return Math.min(row, 2) * 3 + Math.min(col, 2);
}

// ── タップ ────────────────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  if (!isTracking) return;
  if (!audioCtx) initAudio();

  const zone = getZone(e.clientX, e.clientY);
  playTone(ZONE_FREQ[zone]);

  spawnPixels(e.clientX, e.clientY);
  ensureLoop();
});

// ── AR イベント ───────────────────────────────────────────────────────────────
function setupAREvents() {
  const target = document.getElementById('ar-target');
  target.addEventListener('targetFound', () => {
    isTracking = true;
    setDebug('✅ 表紙を認識中');
    ensureLoop();
  });
  target.addEventListener('targetLost', () => {
    isTracking = false;
    setDebug('🔍 表紙を探しています...');
  });
}

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

// ── オフスクリーンcanvas + 画像読み込み ─────────────────────────────────────
function initFaceCanvas() {
  faceCanvas        = document.createElement('canvas');
  faceCanvas.width  = CANVAS_W;
  faceCanvas.height = CANVAS_H;
  faceCtx           = faceCanvas.getContext('2d');

  faceCtx.fillStyle = `rgb(${BG[0]},${BG[1]},${BG[2]})`;
  faceCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const img = new Image();
  img.onload = () => {
    const tmp    = document.createElement('canvas');
    tmp.width    = img.naturalWidth;
    tmp.height   = img.naturalHeight;
    const tmpCtx = tmp.getContext('2d');
    tmpCtx.drawImage(img, 0, 0);
    const { data } = tmpCtx.getImageData(0, 0, tmp.width, tmp.height);
    drawMosaic(data, tmp.width, tmp.height);
  };
  img.onerror = () => showError('reference/face_up.jpg の読み込みに失敗しました');
  img.src = 'reference/face_up.jpg';
}

function setTexture() {
  const plane = document.getElementById('face-plane');
  if (!plane) { requestAnimationFrame(setTexture); return; }

  const mesh = plane.getObject3D('mesh');
  if (!mesh)  { requestAnimationFrame(setTexture); return; }

  texture = new THREE.CanvasTexture(faceCanvas);
  mesh.material.map = texture;
  mesh.material.needsUpdate = true;
}

// ── 起動 ─────────────────────────────────────────────────────────────────────
initFaceCanvas();
initOverlay();

document.getElementById('start-btn').addEventListener('click', async () => {
  document.getElementById('start-screen').style.display = 'none';
  setDebug('🔍 表紙を探しています...');

  const sceneEl = document.querySelector('a-scene');
  if (!sceneEl.hasLoaded) {
    await new Promise(resolve => sceneEl.addEventListener('loaded', resolve, { once: true }));
  }

  const arSystem = sceneEl.systems['mindar-image-system'];
  if (!arSystem) { showError('MindARシステムが見つかりません'); return; }

  setTexture();

  try {
    setupAREvents();
    arSystem.start();
  } catch (err) {
    showError('ARエラー: ' + (err.message || String(err)));
  }
});
