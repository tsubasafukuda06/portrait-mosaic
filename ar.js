'use strict';

// ── Mosaic config ─────────────────────────────────────────────────────────────
const FG        = [21, 223, 223];
const BG        = [243, 243, 207];
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


// ── State ─────────────────────────────────────────────────────────────────────
let isTracking    = false;
let audioCtx      = null;
let winkBuffer    = null;   // wink.wav のデコード済みバッファ
let faceCanvas    = null;
let faceCtx       = null;
let srcPixels     = null;
let srcW = 0, srcH = 0;
let texture       = null;
let isPlayingWink = false;

// キラキラ エフェクト
const WINK_EYE = { x: 360, y: 355 };  // faceCanvas座標（ウィンクしている目）
const sparkles    = [];
const zoneFlashes = [];

// スクリーン空間のオーバーレイ（sparkle用）
let overlayCanvas = null;
let overlayCtx    = null;


// ── モザイク描画（動的中心対応）─────────────────────────────────────────────
function sampleBright(cx, cy) {
  const ix = Math.min(Math.max(Math.floor(cx / CANVAS_W * (srcW - 1)), 0), srcW - 1);
  const iy = Math.min(Math.max(Math.floor(cy / CANVAS_H * (srcH - 1)), 0), srcH - 1);
  const p  = (iy * srcW + ix) * 4;
  return srcPixels[p] * 0.299 + srcPixels[p + 1] * 0.587 + srcPixels[p + 2] * 0.114;
}

// FGタイルを描画
function drawFGTile(x, y, S) {
  faceCtx.fillStyle = `rgb(${FG[0]},${FG[1]},${FG[2]})`;
  faceCtx.fillRect(x, y, S, S);
}

function redrawMosaic() {
  faceCtx.fillStyle = `rgb(${BG[0]},${BG[1]},${BG[2]})`;
  faceCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const cols = Math.ceil(CANVAS_W / QR_MOD);
  const rows = Math.ceil(CANVAS_H / QR_MOD);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x   = c * QR_MOD;
      const y   = r * QR_MOD;
      const cx_ = x + QR_MOD / 2;
      const cy_ = y + QR_MOD / 2;
      const d   = Math.max(Math.abs(cx_ - ORIGIN_CX), Math.abs(cy_ - ORIGIN_CY));
      const S   = ZONES.find(z => d < z[0])[1];

      if (x % S !== 0 || y % S !== 0) {
        // ゾーン境界ギャップ補填：代表タイルが別ゾーンなら個別に描画
        const tx  = Math.floor(x / S) * S;
        const ty  = Math.floor(y / S) * S;
        const td  = Math.max(Math.abs(tx + QR_MOD / 2 - ORIGIN_CX),
                             Math.abs(ty + QR_MOD / 2 - ORIGIN_CY));
        const tS  = ZONES.find(z => td < z[0])[1];
        if (tS !== S) {
          if (sampleBright(cx_, cy_) < THRESHOLD) {
            drawFGTile(x, y, QR_MOD);
          }
        }
        continue;
      }

      const tileCX = x + S / 2;
      const tileCY = y + S / 2;

      if (sampleBright(tileCX, tileCY) < THRESHOLD) {
        drawFGTile(x, y, S);
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
  if (winkRaw)   { winkBuffer   = await audioCtx.decodeAudioData(winkRaw);   winkRaw   = null; }
  if (zone3Raw)  { zone3Buffer  = await audioCtx.decodeAudioData(zone3Raw);  zone3Raw  = null; }
}

// zone5（ウィンク音）先読み
let winkRaw = null;
fetch('sound/zone5.wav')
  .then(r => r.arrayBuffer())
  .then(buf => {
    winkRaw = buf;
    if (audioCtx) audioCtx.decodeAudioData(buf).then(b => { winkBuffer = b; winkRaw = null; });
  });

// zone3（星新一音）先読み
let zone3Raw = null, zone3Buffer = null;
fetch('sound/zone3.wav')
  .then(r => r.arrayBuffer())
  .then(buf => {
    zone3Raw = buf;
    if (audioCtx) audioCtx.decodeAudioData(buf).then(b => { zone3Buffer = b; zone3Raw = null; });
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

function playZone3Sound() {
  if (!audioCtx || !zone3Buffer) return;
  const src  = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  src.buffer = zone3Buffer;
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

  // canvas UV → a-plane上の3Dローカル座標（width=1, height=1.402, 中心が原点）
  const u = cx / CANVAS_W;
  const v = cy / CANVAS_H;
  const localX =  (u - 0.5) * 1;
  const localY = -(v - 0.5) * 1.402;  // Y軸反転

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
      x:    origin.x + (Math.random() - 0.5) * 20,
      y:    origin.y + (Math.random() - 0.5) * 10,
      vx:   Math.cos(angle) * speed,
      vy:   Math.sin(angle) * speed,
      size,
      life: 20 + Math.floor(Math.random() * 40), // フレーム数でランダムな寿命
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
    s.x  += s.vx;
    s.y  += s.vy;
    s.vy += 0.15;
    s.life--;
    if (s.life <= 0) { sparkles.splice(i, 1); continue; }
    overlayCtx.globalAlpha = 1;
    overlayCtx.fillStyle   = '#FFF400';
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


// ── 星新一 3D GLBキャラクター ─────────────────────────────────────────────────
const HOSHI_CHARS = [
  { path: '3d/hoshi.glb' },
  { path: '3d/shin.glb'  },
  { path: '3d/ichi.glb'  },
];

// GLBキャッシュ（ロード済みシーンを保持）
const glbCache = {};

function loadGLB(path, cb) {
  if (glbCache[path]) { const c = glbCache[path]; cb(c.scene, c.animations); return; }
  if (!THREE.GLTFLoader) { setDebug('GLTFLoader unavailable'); return; }
  setDebug('loading: ' + path);
  const loader = new THREE.GLTFLoader();
  loader.load(path, gltf => {
    setDebug('loaded: ' + path);
    glbCache[path] = { scene: gltf.scene, animations: gltf.animations };
    cb(gltf.scene, gltf.animations);
  }, undefined, err => setDebug('GLB error: ' + err.message));
}

// オリジナルマテリアルを維持したまま落下 + opacity フェード（05/06/07 用）
function animateGLBOpacity(obj, target, startZ, rotDir, rotSpd) {
  const floorZ  = 0.02;
  const fallDur = 750;
  const holdDur = 700;
  const fadeDur = 2000;

  function easeInQuart(t) { return t * t * t * t; }
  let t0 = null;

  function animFall(now) {
    if (!t0) t0 = now;
    const t = Math.min((now - t0) / fallDur, 1);
    obj.position.z = startZ + (floorZ - startZ) * easeInQuart(t);
    obj.rotation.y += rotSpd * rotDir;
    if (t < 1) { requestAnimationFrame(animFall); }
    else { setTimeout(() => { t0 = null; requestAnimationFrame(animFade); }, holdDur); }
  }

  function animFade(now) {
    if (!t0) t0 = now;
    const t = Math.min((now - t0) / fadeDur, 1);
    obj.traverse(child => {
      if (child.isMesh) child.material.opacity = 1 - t;
    });
    if (t < 1) { requestAnimationFrame(animFade); }
    else { target.object3D.remove(obj); }
  }

  requestAnimationFrame(animFall);
}

function animateGLB(obj, target, startZ, rotDir, rotSpd, i, S) {
  const floorZ     = 0.02;
  const fallDur    = 750 + i * 60;
  const holdDur    = 700;
  const fadeDur    = 2000;

  function easeInQuart(t) { return t * t * t * t; }

  let t0 = null;

  function animFall(now) {
    if (!t0) t0 = now;
    const t = Math.min((now - t0) / fallDur, 1);
    obj.position.z = startZ + (floorZ - startZ) * easeInQuart(t);
    obj.rotation.y += rotSpd * rotDir;
    if (t < 1) { requestAnimationFrame(animFall); }
    else { setTimeout(() => { t0 = null; requestAnimationFrame(animFade); }, holdDur); }
  }

  function animFade(now) {
    if (!t0) t0 = now;
    const t = Math.min((now - t0) / fadeDur, 1);
    obj.traverse(child => {
      if (child.isMesh && child.material && child.material.uniforms) {
        child.material.uniforms.uDissolve.value = t;
      }
    });
    if (t < 1) { requestAnimationFrame(animFade); }
    else { target.object3D.remove(obj); }
  }

  requestAnimationFrame(animFall);
}

// ── 「一」Three.js 直接生成 ───────────────────────────────────────────────────
// ichi.glb は横一画のため奥行きがほぼゼロ → ExtrudeGeometry で立体化
function createIchiObject() {
  const shape = new THREE.Shape();
  const W = 0.75;   // 半幅
  const H = 0.13;   // 半高さ
  // 書道風：両端をわずかに細くする
  shape.moveTo(-W,        -H * 0.65);
  shape.lineTo(-W * 0.88, -H);
  shape.lineTo( W * 0.88, -H);
  shape.lineTo( W,        -H * 0.65);
  shape.lineTo( W,         H * 0.65);
  shape.lineTo( W * 0.88,  H);
  shape.lineTo(-W * 0.88,  H);
  shape.lineTo(-W,         H * 0.65);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth:          0.32,
    bevelEnabled:   true,
    bevelThickness: 0.055,
    bevelSize:      0.05,
    bevelSegments:  4,
  });
  geo.center();
  return new THREE.Mesh(geo, createDissolveMaterial());
}

// ディゾルブShaderMaterial（uDissolve: 0→1 でモザイクブロック単位に消える）
function createDissolveMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uDissolve: { value: 0.0 },
      uOpacity:  { value: 1.0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vLocalPos;
      void main() {
        vNormal    = normalize(normalMatrix * normal);
        vLocalPos  = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uDissolve;
      uniform float uOpacity;
      varying vec3  vNormal;
      varying vec3  vLocalPos;
      float hash3(vec3 p) {
        p = fract(p * vec3(127.1, 311.7, 74.7));
        p += dot(p, p.yxz + 19.19);
        return fract((p.x + p.y) * p.z);
      }
      void main() {
        // 3Dローカル座標でチャンクを決め、一つずつ消えていく
        vec3 chunk = floor(vLocalPos * 5.0);
        if (hash3(chunk) < uDissolve) discard;

        vec3 n = normalize(vNormal);

        // 6方向の法線にパステルカラーを割り当て、回転で多色グラデーションに
        vec3 cPx = vec3(1.00, 0.72, 0.85);  // +X ピンク
        vec3 cNx = vec3(0.66, 0.94, 0.82);  // -X ミント
        vec3 cPy = vec3(1.00, 0.97, 0.66);  // +Y イエロー
        vec3 cNy = vec3(0.85, 0.72, 1.00);  // -Y ラベンダー
        vec3 cPz = vec3(0.66, 0.85, 0.94);  // +Z ブルー
        vec3 cNz = vec3(1.00, 0.85, 0.72);  // -Z ピーチ

        float wx = max( n.x, 0.0);
        float wnx= max(-n.x, 0.0);
        float wy = max( n.y, 0.0);
        float wny= max(-n.y, 0.0);
        float wz = max( n.z, 0.0);
        float wnz= max(-n.z, 0.0);
        float total = wx + wnx + wy + wny + wz + wnz + 0.001;
        vec3 color = (cPx*wx + cNx*wnx + cPy*wy + cNy*wny + cPz*wz + cNz*wnz) / total;

        // ソフトな拡散照明
        float diff = max(dot(n, normalize(vec3(1.0, 3.0, 2.0))), 0.0) * 0.4 + 0.6;
        gl_FragColor = vec4(color * diff, uOpacity);
      }
    `,
    side:        THREE.DoubleSide,
    transparent: true,
  });
}

function spawnHoshiShinichi() {
  const target = document.getElementById('ar-target');
  if (!target || !target.object3D) return;

  // obj を受け取ってスケール・配置・アニメーションを行う共通処理
  const place = (obj, i) => {
    const box    = new THREE.Box3().setFromObject(obj);
    const size   = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s      = 0.25 / maxDim;
    obj.scale.setScalar(s);

    const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center.multiplyScalar(s));

    const x      = (Math.random() - 0.5) * 1.68;
    const y      = (Math.random() - 0.5) * 1.96;
    const startZ = 0.45 + i * 0.04 + Math.random() * 0.1;
    const rotDir = (Math.random() > 0.5 ? 1 : -1);
    const rotSpd = 0.015 + Math.random() * 0.015;

    obj.position.set(x, y, startZ);
    target.object3D.add(obj);
    animateGLB(obj, target, startZ, rotDir, rotSpd, i, s);
  };

  HOSHI_CHARS.forEach((def, i) => {
    // 「一」はGLBが平坦なためThree.jsで直接生成
    if (def.path === '3d/ichi.glb') {
      place(createIchiObject(), i);
      return;
    }

    loadGLB(def.path, (scene) => {
      const obj = scene.clone(true);
      const mat = createDissolveMaterial();
      obj.traverse(child => {
        if (child.isMesh) child.material = mat;
      });
      place(obj, i);
    });
  });
}


// ── ゾーンキャラクター（01〜07.glb） ─────────────────────────────────────────
const ZONE_CHARS = {
  0: '3d/01.glb',
  1: '3d/02.glb',
  2: '3d/03.glb',
  4: '3d/04.glb',
  6: '3d/05.glb',
  7: '3d/06.glb',
  8: '3d/07.glb',
};

// アニメありGLBのターゲットサイズ（デフォルト 0.45）
const ZONE_CHAR_SIZES = {
  '3d/02.glb': 0.27,   // 0.45 × 0.6
  '3d/04.glb': 1.80,   // 0.45 × 4
};

// GLBごとの特殊挙動
const ZONE_CHAR_CONFIG = {
  '3d/01.glb': { matte: true },
  '3d/02.glb': { matte: true },
  '3d/03.glb': { float: true },        // 横向きのまま空中浮遊
  '3d/04.glb': { fadeAfter: 2000 },    // 2秒ゆっくり移動後フェードアウト
};

const zoneChars    = {};
const activeMixers = [];
let   mixerClock   = null;

function startMixerLoop() {
  if (mixerClock) return;
  mixerClock = new THREE.Clock();
  (function tick() {
    if (activeMixers.length === 0) { mixerClock = null; return; }
    const delta = mixerClock.getDelta();
    const now   = Date.now();

    for (const m of activeMixers) m.update(delta);

    // 歩き回りキャラの移動更新
    Object.values(zoneChars).forEach(c => {
      if (!c.wrapper) return;
      const w = c.wrapper;
      w.position.x += c.vx * delta;
      w.position.y += c.vy * delta;

      // 境界で反転（表紙 + 少し外）
      const BX = 0.84, BY = 0.98;
      if (Math.abs(w.position.x) > BX) { c.vx *= -1; w.position.x = Math.sign(w.position.x) * BX; }
      if (Math.abs(w.position.y) > BY) { c.vy *= -1; w.position.y = Math.sign(w.position.y) * BY; }

      if (c.float) {
        // 浮遊：ゆっくりZ方向に揺れる、向き変更なし
        c.phase = (c.phase || 0) + delta * 1.2;
        w.position.z = 0.7 + Math.sin(c.phase) * 0.16;
      } else {
        // 歩行：進行方向に向かせる（GLB forward = +Y after Rx(π/2)、+π で後ろ向き補正）
        w.rotation.z = Math.atan2(-c.vx, c.vy) + Math.PI;
      }

      // ランダムに方向転換
      if (now > c.nextTurn) {
        const angle = Math.random() * Math.PI * 2;
        const spd   = 0.08 + Math.random() * 0.07;
        c.vx = Math.cos(angle) * spd;
        c.vy = Math.sin(angle) * spd;
        c.nextTurn = now + 2000 + Math.random() * 3000;
      }
    });

    requestAnimationFrame(tick);
  })();
}

function clearAllZoneChars() {
  const target = document.getElementById('ar-target');
  Object.keys(zoneChars).forEach(z => {
    const c = zoneChars[z];
    if (target && target.object3D) target.object3D.remove(c.wrapper || c.obj);
    if (c.mixer) {
      c.mixer.stopAllAction();
      const idx = activeMixers.indexOf(c.mixer);
      if (idx !== -1) activeMixers.splice(idx, 1);
    }
    delete zoneChars[z];
  });
}

function spawnZoneChar(zone) {
  const target = document.getElementById('ar-target');
  if (!target || !target.object3D) return;

  // アニメ付きキャラのみ追跡・削除（リスポーン）
  if (zoneChars[zone]) {
    const old = zoneChars[zone];
    target.object3D.remove(old.wrapper || old.obj);
    if (old.mixer) {
      old.mixer.stopAllAction();
      const idx = activeMixers.indexOf(old.mixer);
      if (idx !== -1) activeMixers.splice(idx, 1);
    }
    delete zoneChars[zone];
  }

  loadGLB(ZONE_CHARS[zone], (scene, animations) => {
    const hasAnim = animations && animations.length > 0;

    // アニメあり → スキンメッシュのためクローン不可、scene を直接使用（1インスタンス保証）
    // アニメなし → clone(true) で複数インスタンス可（hoshi 同様に使い捨て）
    const obj = hasAnim ? scene : scene.clone(true);

    // スケール：初回のみ bbox から算出してキャッシュ（リスポーン時の巨大化を防ぐ）
    const entry = glbCache[ZONE_CHARS[zone]];
    if (!entry.cachedScale) {
      if (hasAnim) obj.scale.set(1, 1, 1);  // アニメありは前回スケールをリセット
      const box  = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const targetSize = hasAnim ? (ZONE_CHAR_SIZES[ZONE_CHARS[zone]] || 0.45) : 0.3;
      entry.cachedScale = targetSize / (Math.max(size.x, size.y, size.z) || 1);
    }
    obj.scale.setScalar(entry.cachedScale);

    if (hasAnim) {
      const path    = ZONE_CHARS[zone];
      const config  = ZONE_CHAR_CONFIG[path] || {};
      const isFloat = config.float;
      const initAngle = Math.random() * Math.PI * 2;
      const spd       = isFloat             ? 0.04 + Math.random() * 0.03   // 浮遊
                      : config.fadeAfter  ? 0.02 + Math.random() * 0.01   // 徐行
                                          : 0.08 + Math.random() * 0.07;  // 歩行

      const wrapper = new THREE.Object3D();
      wrapper.position.set(
        (Math.random() - 0.5) * 0.9,
        (Math.random() - 0.5) * 1.2,
        isFloat ? 0.6 + Math.random() * 0.4 : 0.05,  // 浮遊は高い位置
      );
      if (!isFloat) obj.rotation.set(Math.PI / 2, 0, 0);  // 歩行のみ立たせる
      obj.position.set(0, 0, 0);
      if (config.matte) {
        // GLBのemissiveMap等を完全に排除するため、mapだけ引き継いで新規マテリアルに差し替え
        obj.traverse(child => {
          if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({
              map:       child.material.map || null,
              roughness: 1.0,
              metalness: 0.0,
            });
          }
        });
      }
      wrapper.add(obj);
      target.object3D.add(wrapper);

      const mixer = new THREE.AnimationMixer(obj);
      mixer.clipAction(animations[0]).play();
      activeMixers.push(mixer);
      zoneChars[zone] = {
        obj, wrapper, mixer,
        vx: Math.cos(initAngle) * spd,
        vy: Math.sin(initAngle) * spd,
        float: isFloat,
        phase: Math.random() * Math.PI * 2,
        nextTurn: Date.now() + 2000 + Math.random() * 2000,
      };
      startMixerLoop();

      // 浮遊 or fadeAfter キャラ：指定秒数後にフェードアウト消滅
      if (isFloat || config.fadeAfter) {
        const delay = isFloat ? 2000 : config.fadeAfter;
        const thisWrapper = wrapper;
        obj.traverse(child => {
          if (child.isMesh) { child.material = child.material.clone(); child.material.transparent = true; }
        });
        setTimeout(() => {
          const fadeDur = 1000;
          let t0 = null;
          (function fade(now) {
            if (!t0) t0 = now;
            const t = Math.min((now - t0) / fadeDur, 1);
            obj.traverse(child => { if (child.isMesh) child.material.opacity = 1 - t; });
            if (t < 1) { requestAnimationFrame(fade); return; }
            target.object3D.remove(thisWrapper);
            if (zoneChars[zone] && zoneChars[zone].wrapper === thisWrapper) {
              const c = zoneChars[zone];
              c.mixer.stopAllAction();
              const idx = activeMixers.indexOf(c.mixer);
              if (idx !== -1) activeMixers.splice(idx, 1);
              delete zoneChars[zone];
            }
            obj.traverse(child => { if (child.isMesh) child.material.opacity = 1.0; });
          })(performance.now());
        }, delay);
      }
    } else {
      // ランダム位置 + 落下 + opacity フェード消滅（オリジナルテクスチャ維持）
      obj.traverse(child => {
        if (child.isMesh) {
          child.material = child.material.clone();
          child.material.transparent = true;
        }
      });
      const x      = (Math.random() - 0.5) * 0.9;
      const y      = (Math.random() - 0.5) * 1.2;
      const startZ = 1.0 + Math.random() * 0.2;
      const rotDir = Math.random() > 0.5 ? 1 : -1;
      const rotSpd = 0.015 + Math.random() * 0.015;
      obj.position.set(x, y, startZ);
      target.object3D.add(obj);
      animateGLBOpacity(obj, target, startZ, rotDir, rotSpd);
    }
  });
}


// ── タップ ────────────────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  if (!isTracking) return;
  if (!audioCtx) initAudio();

  const zone = getZone(e.clientX, e.clientY);
  if (zone !== 5) playTone(ZONE_FREQ[zone]);

  spawnZoneFlash(zone);
  ensureOverlayLoop();
  if (zone === 3) { playZone3Sound(); spawnHoshiShinichi(); }
  if (zone === 5) playWink();
  if (ZONE_CHARS[zone]) spawnZoneChar(zone);
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
    clearAllZoneChars();
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
// 全GLBをページ読み込み時にバックグラウンドでキャッシュ + cachedScale 事前計算
(function preloadGLBs() {
  const zoneCharPaths = new Set(Object.values(ZONE_CHARS));
  const paths = [
    ...Object.values(ZONE_CHARS),
    ...HOSHI_CHARS.filter(c => c.path !== '3d/ichi.glb').map(c => c.path),
  ];
  paths.forEach(path => {
    loadGLB(path, (scene, animations) => {
      if (!zoneCharPaths.has(path)) return;
      const entry = glbCache[path];
      if (entry.cachedScale) return;
      const hasAnim  = animations && animations.length > 0;
      const box      = new THREE.Box3().setFromObject(scene);
      const size     = box.getSize(new THREE.Vector3());
      const baseSize = hasAnim ? (ZONE_CHAR_SIZES[path] || 0.45) : 0.3;
      entry.cachedScale = baseSize / (Math.max(size.x, size.y, size.z) || 1);

      // matteマテリアルをプリロード時に差し替え（スポーン時の new Material コストを除去）
      if ((ZONE_CHAR_CONFIG[path] || {}).matte) {
        scene.traverse(child => {
          if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({
              map:       child.material.map || null,
              roughness: 1.0,
              metalness: 0.0,
            });
          }
        });
      }
    });
  });
})();

initFaceCanvas();
initOverlay();

document.getElementById('start-btn').addEventListener('click', async () => {
  document.getElementById('start-screen').style.display = 'none';
  setDebug('🔍 表紙を探しています...');

  const sceneEl = document.querySelector('a-scene');
  if (!sceneEl.hasLoaded) {
    await new Promise(resolve => sceneEl.addEventListener('loaded', resolve, { once: true }));
  }

  // Three.jsライト追加（MeshStandardMaterialの陰影に必要）
  const threeScene = sceneEl.object3D;
  if (!threeScene.getObjectByName('_charAmbient')) {
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    ambient.name = '_charAmbient';
    threeScene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.name = '_charDir';
    dirLight.position.set(1, 3, 2);
    threeScene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xaaccff, 0.2);
    fillLight.name = '_charFill';
    fillLight.position.set(-1, -1, 1);
    threeScene.add(fillLight);
  }

  const arSystem = sceneEl.systems['mindar-image-system'];
  if (!arSystem) { showError('MindARシステムが見つかりません'); return; }

  // GLBシェーダー・テクスチャをGPUに事前転送（1x1オフスクリーンrender）
  if (sceneEl.renderer && sceneEl.camera) {
    const warmupScene = new THREE.Scene();
    const warmupAdded = [];
    Object.values(glbCache).forEach(entry => {
      if (!entry.scene) return;
      entry.scene.traverse(n => { if (n.isMesh) n.frustumCulled = false; });
      warmupScene.add(entry.scene);
      warmupAdded.push(entry.scene);
    });
    const rt = new THREE.WebGLRenderTarget(1, 1);
    sceneEl.renderer.setRenderTarget(rt);
    sceneEl.renderer.render(warmupScene, sceneEl.camera);
    sceneEl.renderer.setRenderTarget(null);
    rt.dispose();
    warmupAdded.forEach(s => {
      s.traverse(n => { if (n.isMesh) n.frustumCulled = true; });
      warmupScene.remove(s);
    });
  }

  setTexture();

  try {
    setupAREvents();
    arSystem.start();
  } catch (err) {
    showError('ARエラー: ' + (err.message || String(err)));
  }
});
