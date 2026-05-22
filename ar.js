'use strict';

let isTracking = false;
let p5Instance = null;
let audioCtx = null;

const BLUE  = [59, 138, 222];
const WHITE = [255, 255, 255];

// 9ゾーンの音階（Hz）: ド〜シ + オクターブ上のド
const ZONE_FREQ = [
  261.6, 293.7, 329.6,  // 上段: ドレミ
  349.2, 392.0, 440.0,  // 中段: ファソラ
  493.9, 523.3, 587.3,  // 下段: シド'レ'
];

// ── サウンド ──────────────────────────────────────────────────────────────────
function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playTone(freq) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
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
// 0〜8 (左上から右下)
function getZone(x, y) {
  const col = Math.floor(x / window.innerWidth  * 3);
  const row = Math.floor(y / window.innerHeight * 3);
  return Math.min(row, 2) * 3 + Math.min(col, 2);
}

// ── エフェクト管理 ────────────────────────────────────────────────────────────
const effects = [];

function spawnEffect(x, y, zone) {
  const row = Math.floor(zone / 3); // 0=上,1=中,2=下
  if (row === 0) {
    effects.push({ type: 'hair', x, y, t: 0, color: (Math.random() < 0.5 ? BLUE : WHITE) });
  } else if (row === 1) {
    const col = zone % 3;
    if (col === 1) {
      effects.push({ type: 'mouth', x, y, t: 0, color: (Math.random() < 0.5 ? BLUE : WHITE) });
    } else {
      // 左右どちらの目か
      effects.push({ type: 'wink', x, y, t: 0, dir: col === 0 ? 1 : -1, color: (Math.random() < 0.5 ? BLUE : WHITE) });
    }
  } else {
    effects.push({ type: 'mouth', x, y, t: 0, color: (Math.random() < 0.5 ? BLUE : WHITE) });
  }
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
      cnv.style('z-index', '100');
    };

    p.draw = () => {
      p.clear();
      for (let i = effects.length - 1; i >= 0; i--) {
        const e = effects[i];
        e.t += 0.04;
        const alive = drawEffect(p, e);
        if (!alive) effects.splice(i, 1);
      }
    };

    p.windowResized = () => {
      p.resizeCanvas(window.innerWidth, window.innerHeight);
    };
  });
}

function drawEffect(p, e) {
  const [r, g, b] = e.color;
  const alpha = p.map(e.t, 0, 1, 255, 0);
  if (alpha <= 0) return false;

  p.noFill();
  p.strokeWeight(3);
  p.stroke(r, g, b, alpha);

  if (e.type === 'hair') {
    // 上から複数の曲線が流れ落ちる
    const num = 6;
    for (let i = 0; i < num; i++) {
      const ox = (i - num / 2) * 28;
      const progress = p.constrain(e.t * 1.5 - i * 0.08, 0, 1);
      const len = progress * p.height * 0.35;
      const wave = Math.sin(e.t * 4 + i) * 12;
      p.line(e.x + ox + wave, e.y - len * 0.2, e.x + ox - wave, e.y + len * 0.8);
    }
  } else if (e.type === 'wink') {
    // 弧が閉じていく（ウィンク）
    const size = p.map(e.t, 0, 1, 60, 20);
    const close = p.map(e.t, 0, 0.5, 0, Math.PI);
    p.arc(e.x, e.y, size, size * 0.5, 0, Math.PI);
    // 閉じる線
    const closeY = p.map(e.t, 0, 0.6, -size * 0.25, 0);
    p.line(e.x - size / 2, e.y + closeY, e.x + size / 2, e.y + closeY);
  } else if (e.type === 'mouth') {
    // 楕円がパカッと開いて閉じる
    const phase = Math.sin(e.t * Math.PI); // 0→1→0
    const w = 70;
    const openH = phase * 40;
    p.arc(e.x, e.y, w, 8, 0, Math.PI);             // 上唇
    p.arc(e.x, e.y + openH, w, 8, Math.PI, 0);     // 下唇
  }

  return e.t < 1;
}

function showOverlay() {
  const cnv = document.querySelector('canvas.p5Canvas');
  if (cnv) cnv.style.display = 'block';
  p5Instance && p5Instance.loop();
}

function hideOverlay() {
  const cnv = document.querySelector('canvas.p5Canvas');
  if (cnv) cnv.style.display = 'none';
  p5Instance && p5Instance.noLoop();
  effects.length = 0;
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
  if (!audioCtx) initAudio();
  const zone = getZone(e.clientX, e.clientY);
  playTone(ZONE_FREQ[zone]);
  spawnEffect(e.clientX, e.clientY, zone);
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
