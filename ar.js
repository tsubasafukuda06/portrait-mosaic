'use strict';

// ── Mosaic config ─────────────────────────────────────────────────────────────
const FG        = [59, 138, 222];
const BG        = [255, 255, 255];
const QR_MOD    = 5;
const THRESHOLD = 120;

const CANVAS_W = 600;
const CANVAS_H = 888;

// ゾーン境界（カバー.jsと同じ値）
const ZONES = [
  [178, QR_MOD    ],
  [277, QR_MOD * 2],
  [355, QR_MOD * 4],
  [459, QR_MOD * 6],
  [Infinity, QR_MOD * 6],
];

// ゾーン中心の初期位置
const ORIGIN_CX = CANVAS_W * 0.50;
const ORIGIN_CY = CANVAS_H * 0.40;

// 9ゾーンそれぞれのアニメーション目的地（canvas座標）
// 画面を3×3に分割、タップしたゾーンに対応する顔の部位へ移動
const ZONE_TARGETS = [
  [CANVAS_W * 0.25, CANVAS_H * 0.15],  // 0: 左上  → 顔の左上
  [CANVAS_W * 0.50, CANVAS_H * 0.15],  // 1: 上中  → 顔の上中央（髪）
  [CANVAS_W * 0.75, CANVAS_H * 0.15],  // 2: 右上  → 顔の右上
  [CANVAS_W * 0.15, CANVAS_H * 0.42],  // 3: 左中  → 左耳あたり
  [CANVAS_W * 0.50, CANVAS_H * 0.42],  // 4: 中央  → 顔の中心
  [CANVAS_W * 0.85, CANVAS_H * 0.42],  // 5: 右中  → 右耳あたり
  [CANVAS_W * 0.25, CANVAS_H * 0.75],  // 6: 左下  → 顎の左
  [CANVAS_W * 0.50, CANVAS_H * 0.80],  // 7: 下中  → 顎の中央
  [CANVAS_W * 0.75, CANVAS_H * 0.75],  // 8: 右下  → 顎の右
];

// ── State ─────────────────────────────────────────────────────────────────────
let isTracking    = false;
let audioCtx      = null;
let winkBuffer    = null;   // wink.wav のデコード済みバッファ
let faceCanvas    = null;
let faceCtx       = null;
let srcPixels     = null;
let srcW = 0, srcH = 0;
let texture       = null;
let animFrame     = null;
let isPlayingWink = false;

// キラキラ エフェクト
const WINK_EYE = { x: 360, y: 355 };  // faceCanvas座標（ウィンクしている目）
const sparkles    = [];
const zoneFlashes = [];

// スクリーン空間のオーバーレイ（sparkle用）
let overlayCanvas = null;
let overlayCtx    = null;

// ゾーン中心（アニメーション用）
let dynCX = ORIGIN_CX;
let dynCY = ORIGIN_CY;

// アニメーション
let animPhase    = 'idle';   // 'out' | 'back'
let animT        = 0;
let animFromCX   = ORIGIN_CX;
let animFromCY   = ORIGIN_CY;
let animToCX     = ORIGIN_CX;
let animToCY     = ORIGIN_CY;

// ── イージング ────────────────────────────────────────────────────────────────
function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
function lerp(a, b, t) { return a + (b - a) * t; }

// ── ゾーン中心アニメーション トリガー ─────────────────────────────────────────
function triggerAnim(zone) {
  const [cx, cy] = ZONE_TARGETS[zone];
  animToCX   = cx;
  animToCY   = cy;
  animFromCX = dynCX;
  animFromCY = dynCY;
  animPhase  = 'out';
  animT      = 0;
}

function updateAnim() {
  if (animPhase === 'idle') return false;

  animT = Math.min(animT + 0.05, 1);

  if (animPhase === 'out') {
    dynCX = lerp(animFromCX, animToCX, easeInOut(animT));
    dynCY = lerp(animFromCY, animToCY, easeInOut(animT));
    if (animT >= 1) { animT = 0; animPhase = 'back'; }
  } else {
    dynCX = lerp(animToCX, ORIGIN_CX, easeInOut(animT));
    dynCY = lerp(animToCY, ORIGIN_CY, easeInOut(animT));
    if (animT >= 1) {
      dynCX = ORIGIN_CX;
      dynCY = ORIGIN_CY;
      animPhase = 'idle';
      return false;
    }
  }
  return true;
}

// ── モザイク描画（動的中心対応）─────────────────────────────────────────────
function sampleBright(cx, cy) {
  const ix = Math.min(Math.max(Math.floor(cx / CANVAS_W * (srcW - 1)), 0), srcW - 1);
  const iy = Math.min(Math.max(Math.floor(cy / CANVAS_H * (srcH - 1)), 0), srcH - 1);
  const p  = (iy * srcW + ix) * 4;
  return srcPixels[p] * 0.299 + srcPixels[p + 1] * 0.587 + srcPixels[p + 2] * 0.114;
}

function redrawMosaic() {
  faceCtx.fillStyle = `rgb(${BG[0]},${BG[1]},${BG[2]})`;
  faceCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const cols = Math.ceil(CANVAS_W / QR_MOD);
  const rows = Math.ceil(CANVAS_H / QR_MOD);

  faceCtx.fillStyle = `rgb(${FG[0]},${FG[1]},${FG[2]})`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x   = c * QR_MOD;
      const y   = r * QR_MOD;
      const cx_ = x + QR_MOD / 2;
      const cy_ = y + QR_MOD / 2;
      const d   = Math.max(Math.abs(cx_ - dynCX), Math.abs(cy_ - dynCY));
      const S   = ZONES.find(z => d < z[0])[1];

      if (x % S !== 0 || y % S !== 0) {
        // ゾーン境界ギャップ補填：代表タイルが別ゾーンなら個別に描画
        const tx  = Math.floor(x / S) * S;
        const ty  = Math.floor(y / S) * S;
        const td  = Math.max(Math.abs(tx + QR_MOD / 2 - dynCX),
                             Math.abs(ty + QR_MOD / 2 - dynCY));
        const tS  = ZONES.find(z => td < z[0])[1];
        if (tS !== S) {
          if (sampleBright(cx_, cy_) < THRESHOLD) {
            faceCtx.fillRect(x, y, QR_MOD, QR_MOD);
          }
        }
        continue;
      }

      const tileCX = x + S / 2;
      const tileCY = y + S / 2;

      if (sampleBright(tileCX, tileCY) < THRESHOLD) {
        faceCtx.fillRect(x, y, S, S);
      }
    }
  }
}

// ── アニメーションループ ───────────────────────────────────────────────────────
function animLoop() {
  const running = updateAnim();
  if (running) {
    redrawMosaic();
    if (texture) texture.needsUpdate = true;
    animFrame = requestAnimationFrame(animLoop);
  } else {
    animFrame = null;
  }
}

function ensureLoop() {
  if (!animFrame) animFrame = requestAnimationFrame(animLoop);
}

// ── Audio ─────────────────────────────────────────────────────────────────────
const ZONE_FREQ = [
  261.6, 293.7, 329.6,
  349.2, 392.0, 440.0,
  493.9, 523.3, 587.3,
];

async function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // wink.wav をデコード（fetch済みのrawがあれば即デコード）
  if (winkRaw) {
    winkBuffer = await audioCtx.decodeAudioData(winkRaw);
    winkRaw = null;
  }
}

// 起動時に先読み（ArrayBufferとして保持、audioCtx前でも可）
let winkRaw = null;
fetch('sound/zone5.wav')
  .then(r => r.arrayBuffer())
  .then(buf => {
    winkRaw = buf;
    // audioCtxが既にあればすぐデコード
    if (audioCtx) audioCtx.decodeAudioData(buf).then(b => { winkBuffer = b; winkRaw = null; });
  });

function playWinkSound() {
  if (!audioCtx || !winkBuffer) return;
  const src  = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  src.buffer = winkBuffer;
  src.connect(gain);
  gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(0.7, audioCtx.currentTime);
  src.start();
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

// ── ゾーン判定 ────────────────────────────────────────────────────────────────
function getZone(x, y) {
  const col = Math.floor(x / window.innerWidth  * 3);
  const row = Math.floor(y / window.innerHeight * 3);
  return Math.min(row, 2) * 3 + Math.min(col, 2);
}

// ── オーバーレイ初期化 ────────────────────────────────────────────────────────
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

// ── キラキラ ──────────────────────────────────────────────────────────────────
// faceCanvas座標 → スクリーン座標（Three.js投影で正確に算出）
function canvasToScreen(cx, cy) {
  const target = document.getElementById('ar-target');
  const camera = document.querySelector('a-camera');
  if (!target || !camera) return null;

  // canvas UV → a-plane上の3Dローカル座標（width=1, height=1.480, 中心が原点）
  const u = cx / CANVAS_W;
  const v = cy / CANVAS_H;
  const localX =  (u - 0.5) * 1;
  const localY = -(v - 0.5) * 1.480;  // Y軸反転

  const vec = new THREE.Vector3(localX, localY, 0);
  target.object3D.updateMatrixWorld();
  vec.applyMatrix4(target.object3D.matrixWorld);

  const cam = camera.getObject3D('camera');
  vec.project(cam);

  return {
    x:  (vec.x + 1) / 2 * window.innerWidth,
    y: (-vec.y + 1) / 2 * window.innerHeight,
  };
}

function spawnSparkles() {
  const origin = canvasToScreen(WINK_EYE.x, WINK_EYE.y);
  if (!origin) return;
  const count  = 14;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.25;
    const speed = 4 + Math.random() * 6;
    // ドットサイズはモザイクタイルに合わせて5の倍数
    const size  = [5, 10, 10, 15][Math.floor(Math.random() * 4)];
    sparkles.push({
      x:  origin.x + (Math.random() - 0.5) * 20,
      y:  origin.y + (Math.random() - 0.5) * 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size,
      alpha: 1,
    });
  }
}

function drawOverlay() {
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  // ゾーンフラッシュ
  const zw = overlayCanvas.width  / 3;
  const zh = overlayCanvas.height / 3;
  for (let i = zoneFlashes.length - 1; i >= 0; i--) {
    const f = zoneFlashes[i];
    f.alpha -= 0.08;
    if (f.alpha <= 0) { zoneFlashes.splice(i, 1); continue; }
    const col = f.zone % 3;
    const row = Math.floor(f.zone / 3);
    overlayCtx.globalAlpha = f.alpha;
    overlayCtx.fillStyle   = '#ffffff';
    overlayCtx.fillRect(col * zw, row * zh, zw, zh);
  }

  // キラキラ
  for (let i = sparkles.length - 1; i >= 0; i--) {
    const s = sparkles[i];
    s.x    += s.vx;
    s.y    += s.vy;
    s.vy   += 0.15;
    s.alpha -= 0.025;
    if (s.alpha <= 0) { sparkles.splice(i, 1); continue; }
    overlayCtx.globalAlpha = s.alpha;
    overlayCtx.fillStyle   = '#FFD700';
    overlayCtx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
  }

  overlayCtx.globalAlpha = 1;
}

function spawnZoneFlash(zone) {
  zoneFlashes.push({ zone, alpha: 0.45 });
}

let overlayTicking = false;
function ensureOverlayLoop() {
  if (overlayTicking) return;
  overlayTicking = true;
  (function tick() {
    if (zoneFlashes.length === 0 && sparkles.length === 0) {
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      overlayTicking = false;
      return;
    }
    drawOverlay();
    requestAnimationFrame(tick);
  })();
}

// ── ウィンク動画再生 ──────────────────────────────────────────────────────────
let winkTicking = false;

function playWink() {
  const vid = document.getElementById('wink-video');
  if (!vid) return;

  // 連打: 0.4秒地点から再スタート、sparkleと音を即トリガー
  vid.onended = null;
  vid.currentTime = 0.4;
  vid.play();
  isPlayingWink = true;

  playWinkSound();
  spawnSparkles();
  ensureOverlayLoop();

  // faceCanvas更新ループ（動画フレームを貼り続ける）
  if (!winkTicking) {
    winkTicking = true;
    (function tick() {
      if (!isPlayingWink) { winkTicking = false; return; }
      faceCtx.drawImage(vid, 0, 0, CANVAS_W, CANVAS_H);
      if (texture) texture.needsUpdate = true;
      requestAnimationFrame(tick);
    })();
  }

  vid.onended = () => {
    isPlayingWink = false;
    redrawMosaic();
    if (texture) texture.needsUpdate = true;
    // オーバーレイはsparkles配列が空になり次第自動停止
  };
}

// ── フローティングテキスト ────────────────────────────────────────────────────
const TAP_LABELS = ['星新一', 'ショートショート'];
let tapCount = 0;

function makeTextCanvas(label, color) {
  const canvas = document.createElement('canvas');
  canvas.width  = 512;
  canvas.height = 128;
  const ctx     = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  ctx.font         = 'bold 60px sans-serif';
  ctx.fillStyle    = color;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 256, 64);
  return canvas;
}

function spawnFloatingText() {
  const label  = TAP_LABELS[tapCount % 2];
  tapCount++;

  const target = document.getElementById('ar-target');
  if (!target || !target.object3D) return;

  const w = 0.65;
  const h = w * 128 / 512;

  // メインテキスト
  const tex  = new THREE.CanvasTexture(makeTextCanvas(label, '#ffffff'));
  const mat  = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);

  const x      = (Math.random() - 0.5) * 0.6;
  const y      = (Math.random() - 0.5) * 1.0;
  const startZ = 0.5 + Math.random() * 0.2;
  const floorZ = 0.02;

  mesh.position.set(x, y, startZ);
  target.object3D.add(mesh);

  // シャドウ（着地面）
  const sTex    = new THREE.CanvasTexture(makeTextCanvas(label, '#000000'));
  const sMat    = new THREE.MeshBasicMaterial({ map: sTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const shadow  = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.1, h * 1.1), sMat);
  shadow.position.set(x + 0.03, y - 0.03, 0.001);
  target.object3D.add(shadow);

  const MAX_SHADOW  = 0.28;
  const fallDur     = 700;
  const squishDur   = 100;
  const unsquishDur = 200;
  const holdDur     = 800;
  const fadeDur     = 1500;

  function easeInQuart(t) { return t * t * t * t; }
  function easeOutQuad(t)  { return t * (2 - t); }

  let t0 = null;

  // 1. 落下（近づくほど影が濃くなる）
  function animFall(now) {
    if (!t0) t0 = now;
    const t    = Math.min((now - t0) / fallDur, 1);
    const ease = easeInQuart(t);
    mesh.position.z = startZ + (floorZ - startZ) * ease;
    sMat.opacity    = MAX_SHADOW * ease;
    if (t < 1) { requestAnimationFrame(animFall); }
    else { t0 = null; requestAnimationFrame(animSquish); }
  }

  // 2. スカッシュ（着地）
  function animSquish(now) {
    if (!t0) t0 = now;
    const t = Math.min((now - t0) / squishDur, 1);
    mesh.scale.set(1 + 0.25 * t, 1 - 0.35 * t, 1);
    if (t < 1) { requestAnimationFrame(animSquish); }
    else { t0 = null; requestAnimationFrame(animUnsquish); }
  }

  // 3. アンスカッシュ
  function animUnsquish(now) {
    if (!t0) t0 = now;
    const t = Math.min((now - t0) / unsquishDur, 1);
    const e = easeOutQuad(t);
    mesh.scale.set(1.25 - 0.25 * e, 0.65 + 0.35 * e, 1);
    if (t < 1) { requestAnimationFrame(animUnsquish); }
    else {
      mesh.scale.set(1, 1, 1);
      setTimeout(() => { t0 = null; requestAnimationFrame(animFade); }, holdDur);
    }
  }

  // 4. フェードアウト
  function animFade(now) {
    if (!t0) t0 = now;
    const t = Math.min((now - t0) / fadeDur, 1);
    mat.opacity  = 1 - t;
    sMat.opacity = MAX_SHADOW * (1 - t);
    if (t < 1) { requestAnimationFrame(animFade); }
    else {
      target.object3D.remove(mesh);
      target.object3D.remove(shadow);
      mesh.geometry.dispose();   mat.dispose();  tex.dispose();
      shadow.geometry.dispose(); sMat.dispose(); sTex.dispose();
    }
  }

  requestAnimationFrame(animFall);
}

// ── タップ ────────────────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  if (!isTracking) return;
  if (!audioCtx) initAudio();

  const zone = getZone(e.clientX, e.clientY);
  if (zone !== 5) playTone(ZONE_FREQ[zone]);

  spawnZoneFlash(zone);
  ensureOverlayLoop();
  spawnFloatingText();

  if (zone === 5) {
    // 中央右 → ウィンク動画
    playWink();
  } else {
    // その他 → モザイクアニメーション
    triggerAnim(zone);
    ensureLoop();
  }
});

// ── AR イベント ───────────────────────────────────────────────────────────────
function setupAREvents() {
  const target = document.getElementById('ar-target');
  target.addEventListener('targetFound', () => {
    isTracking = true;
    setDebug('✅ 表紙を認識中');
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

// ── 初期モザイク描画 ──────────────────────────────────────────────────────────
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
    const id = tmpCtx.getImageData(0, 0, tmp.width, tmp.height);
    srcPixels = id.data;
    srcW      = tmp.width;
    srcH      = tmp.height;
    redrawMosaic();  // 初期描画
  };
  img.onerror = () => showError('reference/face_up.jpg の読み込みに失敗しました');
  img.src = 'reference/face_up.jpg';
}

function setTexture() {
  const plane = document.getElementById('face-plane');
  if (!plane) { requestAnimationFrame(setTexture); return; }
  const mesh = plane.getObject3D('mesh');
  if (!mesh)  { requestAnimationFrame(setTexture); return; }

  // CanvasTexture一本のみ
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
