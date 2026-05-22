'use strict';

// ── Mosaic config (cover.js と同じ値) ────────────────────────────────────────
const FG        = [59, 138, 222];   // #3B8ADE
const BG        = [255, 255, 255];  // white
const QR_MOD    = 5;
const THRESHOLD = 120;

// キャンバスサイズ（表紙比率 127:188）
const CANVAS_W = 600;
const CANVAS_H = 888;  // 600 * 188/127 ≈ 888

// QR中心（ゾーン計算用、QRは非表示）
const QR_CX = CANVAS_W * 0.50;
const QR_CY = CANVAS_H * 0.40;

// チェビシェフ距離ゾーン境界
const ZONES = [
  [178, QR_MOD    ],   // 5px
  [277, QR_MOD * 2],   // 10px
  [355, QR_MOD * 4],   // 20px
  [459, QR_MOD * 6],   // 30px
  [Infinity, QR_MOD * 6],
];

// 目の領域（canvas座標、顔画像に合わせて調整可）
const LEFT_EYE  = { x: 70,  y: 190, w: 190, h: 90 };  // 向かって左
const RIGHT_EYE = { x: 340, y: 190, w: 190, h: 90 };  // 向かって右

// ── State ─────────────────────────────────────────────────────────────────────
let isTracking = false;
let audioCtx   = null;
let faceCanvas = null;
let faceCtx    = null;
let baseImage  = null;   // クリーンなモザイクのImageData
let texture    = null;
let animFrame  = null;

const winkState = { left: 0, right: 0 }; // 0=open, >0=animating

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

      // チェビシェフ距離でタイルサイズを決定
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

  // クリーン状態を保存
  baseImage = faceCtx.getImageData(0, 0, CANVAS_W, CANVAS_H);
}

// ── ウィンク アニメーション ───────────────────────────────────────────────────
function triggerWink(side) {
  winkState[side] = 0.01;
}

function updateWinks() {
  let dirty = false;
  for (const side of ['left', 'right']) {
    if (winkState[side] <= 0) continue;
    dirty = true;
    winkState[side] += 0.05;
    if (winkState[side] >= 2) winkState[side] = 0;
  }
  if (!dirty) return false;

  // クリーンなモザイクに戻す
  faceCtx.putImageData(baseImage, 0, 0);

  // まぶたを描画
  for (const [side, eye] of [['left', LEFT_EYE], ['right', RIGHT_EYE]]) {
    if (winkState[side] <= 0) continue;
    const t     = winkState[side];
    // 0→1: 閉じる, 1→2: 開く
    const phase = t <= 1 ? t : 2 - t;
    drawEyelid(eye, phase);
  }

  return true;
}

function drawEyelid(eye, phase) {
  // まぶたを白タイルで塗りつぶす（上から下に広がる）
  const eyelidH = eye.h * phase;
  if (eyelidH <= 0) return;

  // タイルグリッドに合わせて塗る
  const tileS = QR_MOD;
  faceCtx.fillStyle = `rgb(${BG[0]},${BG[1]},${BG[2]})`;
  for (let y = eye.y; y < eye.y + eyelidH; y += tileS) {
    faceCtx.fillRect(
      eye.x,
      y,
      eye.w,
      Math.min(tileS, (eye.y + eyelidH) - y)
    );
  }
}

// ── テクスチャ更新ループ ───────────────────────────────────────────────────────
function animLoop() {
  if (!isTracking) return;
  const dirty = updateWinks();
  if (dirty && texture) texture.needsUpdate = true;
  animFrame = requestAnimationFrame(animLoop);
}

// ── ゾーン / 目判定 ───────────────────────────────────────────────────────────
function getZone(x, y) {
  const col = Math.floor(x / window.innerWidth  * 3);
  const row = Math.floor(y / window.innerHeight * 3);
  return Math.min(row, 2) * 3 + Math.min(col, 2);
}

function getEyeSide(screenX, screenY) {
  const cx = (screenX / window.innerWidth)  * CANVAS_W;
  const cy = (screenY / window.innerHeight) * CANVAS_H;

  const dleft  = Math.hypot(cx - (LEFT_EYE.x  + LEFT_EYE.w  / 2),
                             cy - (LEFT_EYE.y  + LEFT_EYE.h  / 2));
  const dright = Math.hypot(cx - (RIGHT_EYE.x + RIGHT_EYE.w / 2),
                             cy - (RIGHT_EYE.y + RIGHT_EYE.h / 2));
  const threshold = 160;
  if (dleft < dright && dleft < threshold) return 'left';
  if (dright <= dleft && dright < threshold) return 'right';
  return null;
}

// ── タップ ────────────────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  if (!isTracking) return;
  if (!audioCtx) initAudio();

  const zone = getZone(e.clientX, e.clientY);
  playTone(ZONE_FREQ[zone]);

  const side = getEyeSide(e.clientX, e.clientY);
  if (side) triggerWink(side);
});

// ── AR イベント ───────────────────────────────────────────────────────────────
function setupAREvents() {
  const target = document.getElementById('ar-target');
  target.addEventListener('targetFound', () => {
    isTracking = true;
    setDebug('✅ 表紙を認識中');
    cancelAnimationFrame(animFrame);
    animLoop();
  });
  target.addEventListener('targetLost', () => {
    isTracking = false;
    cancelAnimationFrame(animFrame);
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

  // とりあえず白で初期化
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
    // テクスチャ設定は setTexture() が担う（シーン読み込み後に呼ぶ）
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

document.getElementById('start-btn').addEventListener('click', async () => {
  document.getElementById('start-screen').style.display = 'none';
  setDebug('🔍 表紙を探しています...');

  const sceneEl = document.querySelector('a-scene');
  if (!sceneEl.hasLoaded) {
    await new Promise(resolve => sceneEl.addEventListener('loaded', resolve, { once: true }));
  }

  const arSystem = sceneEl.systems['mindar-image-system'];
  if (!arSystem) { showError('MindARシステムが見つかりません'); return; }

  // テクスチャをセット
  setTexture();

  try {
    setupAREvents();
    arSystem.start();
  } catch (err) {
    showError('ARエラー: ' + (err.message || String(err)));
  }
});
