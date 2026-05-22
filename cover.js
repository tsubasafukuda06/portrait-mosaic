'use strict';

// ── QR Matrix (41×41) ────────────────────────────────────────────────────────
const QR_MATRIX = [
[true,true,true,true,true,true,true,false,false,true,false,true,true,true,true,true,false,false,false,false,true,true,false,false,true,true,true,true,true,true,false,false,false,false,true,true,true,true,true,true,true],
[true,false,false,false,false,false,true,false,true,true,false,false,false,true,true,false,true,false,true,true,true,true,true,true,false,true,true,false,true,true,false,true,true,false,true,false,false,false,false,false,true],
[true,false,true,true,true,false,true,false,false,false,true,true,true,true,false,false,false,true,false,true,false,false,true,false,false,false,true,true,false,false,false,false,true,false,true,false,true,true,true,false,true],
[true,false,true,true,true,false,true,false,false,true,false,true,true,true,true,true,false,false,true,true,false,true,false,true,true,false,false,false,false,true,true,false,false,false,true,false,true,true,true,false,true],
[true,false,true,true,true,false,true,false,false,false,true,true,false,true,false,true,false,false,true,true,false,true,true,false,false,false,false,true,true,false,true,false,true,false,true,false,true,true,true,false,true],
[true,false,false,false,false,false,true,false,true,false,true,true,true,true,true,false,true,true,false,true,true,true,true,false,false,true,false,false,false,false,false,true,true,false,true,false,false,false,false,false,true],
[true,true,true,true,true,true,true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,true,true,true,true,true,true],
[false,false,false,false,false,false,false,false,true,false,false,false,false,false,false,false,false,true,false,true,false,true,true,false,false,false,false,true,true,true,false,true,true,false,false,false,false,false,false,false,false],
[false,false,false,false,true,true,true,true,false,false,false,false,false,false,false,false,true,true,false,false,false,false,true,true,true,true,false,true,true,true,false,true,false,false,true,true,false,false,false,true,false],
[true,false,true,false,true,true,false,true,true,false,true,true,true,true,false,true,false,false,true,true,false,true,false,false,false,true,false,true,true,true,false,false,false,true,true,true,true,true,false,true,true],
[true,true,false,true,true,true,true,false,false,false,false,false,false,false,true,false,false,true,true,true,false,true,true,true,false,true,true,true,false,false,true,false,true,true,true,false,true,false,false,false,true],
[true,true,true,true,false,true,false,true,false,true,true,true,false,true,true,false,false,false,true,false,true,false,true,true,true,false,true,true,true,true,false,true,true,false,false,false,true,true,false,false,false],
[false,true,true,false,true,true,true,false,false,true,false,false,false,true,false,true,false,true,true,false,true,false,false,true,false,false,false,false,false,true,false,false,false,false,false,false,false,false,false,true,true],
[true,false,false,false,true,true,false,false,false,true,true,false,false,true,false,false,false,false,false,false,true,false,true,true,true,true,false,false,true,false,true,true,true,false,true,true,true,false,true,false,true],
[false,true,true,true,false,false,true,false,false,false,true,false,false,true,false,false,true,true,true,true,false,true,true,false,false,false,true,false,true,false,false,false,true,true,true,false,false,false,true,true,true],
[true,false,true,true,false,false,false,true,true,true,false,false,true,true,false,false,true,false,false,false,true,false,true,true,true,true,false,false,false,true,false,false,false,false,false,false,false,true,false,true,false],
[true,true,true,false,false,true,true,false,false,true,false,false,true,true,false,true,true,false,true,false,false,true,false,true,true,false,true,true,false,true,false,true,false,false,false,true,false,false,false,false,false],
[false,true,false,false,true,false,false,false,true,true,false,true,true,true,false,false,true,true,false,true,false,true,false,false,false,false,true,true,false,false,true,false,false,true,true,true,true,false,false,false,true],
[false,false,true,true,false,true,true,true,true,false,false,false,true,true,true,false,false,true,false,true,false,true,false,true,true,true,false,true,true,true,false,false,false,false,true,true,false,false,true,false,true],
[true,false,true,true,false,false,false,true,true,false,false,false,true,true,false,false,true,true,true,false,true,false,false,true,true,false,true,true,false,true,true,true,false,true,true,true,false,true,false,false,true],
[true,false,true,false,true,false,true,true,true,false,true,false,true,true,true,true,false,false,false,false,false,false,true,true,true,false,false,false,false,false,true,true,false,true,false,false,false,true,false,false,false],
[true,false,true,false,true,false,false,true,false,true,false,true,false,false,true,true,true,true,true,false,false,false,true,true,true,false,false,true,true,false,false,false,true,false,true,true,true,true,true,false,true],
[true,false,true,false,true,false,true,false,true,false,true,true,true,false,true,false,true,true,false,false,true,true,true,true,true,true,false,true,true,false,false,false,false,true,true,false,false,true,true,false,true],
[false,true,false,false,false,false,false,false,false,true,false,true,false,true,true,true,false,false,true,false,false,false,true,true,false,false,false,true,false,true,true,false,false,true,true,true,true,true,false,true,false],
[true,true,true,false,false,false,true,false,false,true,false,true,true,true,true,false,false,false,false,true,true,false,true,false,false,true,false,false,false,true,false,true,true,true,false,false,false,true,false,false,false],
[true,true,true,false,true,false,false,true,false,false,false,false,true,false,false,true,true,true,true,false,true,false,false,false,true,false,false,true,true,false,false,false,true,false,true,false,true,false,true,false,true],
[false,false,false,false,false,true,true,false,false,true,true,true,true,true,true,false,true,true,false,false,false,false,false,false,true,true,false,true,true,false,true,false,true,false,false,false,true,false,false,false,true],
[false,false,false,true,true,false,false,true,false,true,true,false,false,true,true,true,false,false,false,true,true,false,false,false,true,false,false,false,true,true,true,true,true,false,false,false,true,true,false,false,true],
[false,false,true,false,true,false,true,true,true,true,false,true,false,true,false,false,true,false,false,true,false,true,false,true,true,false,true,false,true,true,false,false,true,false,false,true,false,false,false,true,true],
[true,false,true,false,false,false,false,false,true,true,true,false,false,true,true,false,false,false,true,true,true,false,true,false,false,false,false,false,false,false,true,true,false,false,false,true,true,false,true,false,true],
[false,false,false,false,false,false,true,false,true,true,false,true,false,false,true,true,false,false,true,true,false,false,true,false,true,false,false,true,false,true,false,true,false,true,false,false,true,true,false,false,true],
[false,false,true,false,false,true,false,false,false,true,false,true,true,false,false,true,true,true,false,true,false,true,true,true,true,true,false,true,true,true,true,true,true,true,false,true,true,true,false,false,true],
[true,true,true,true,true,false,true,true,false,false,false,false,true,true,true,true,false,true,true,false,false,false,true,false,false,false,true,false,true,true,false,false,true,true,true,true,true,true,false,true,false],
[false,false,false,false,false,false,false,false,true,true,false,false,true,true,false,true,false,true,false,true,true,false,false,true,true,true,false,true,true,true,true,false,true,false,false,false,true,true,false,false,true],
[true,true,true,true,true,true,true,false,true,false,true,true,true,true,false,true,false,false,false,false,false,true,true,true,true,true,false,true,false,false,true,true,true,false,true,false,true,true,false,false,true],
[true,false,false,false,false,false,true,false,true,false,false,true,false,false,false,true,true,true,false,false,true,true,false,true,false,false,true,true,true,false,false,true,true,false,false,false,true,true,false,false,false],
[true,false,true,true,true,false,true,false,true,true,true,false,false,true,true,true,true,false,false,false,true,false,false,false,true,true,false,true,true,false,false,true,true,true,true,true,true,true,false,false,false],
[true,false,true,true,true,false,true,false,false,false,true,true,false,false,true,true,true,false,true,false,false,false,false,false,false,false,false,true,true,false,true,false,false,false,false,true,false,true,true,true,true],
[true,false,true,true,true,false,true,false,false,true,false,false,true,false,true,false,false,false,true,true,true,false,true,true,false,true,true,true,false,true,true,true,true,true,false,false,false,true,false,true,true],
[true,false,false,false,false,false,true,false,false,true,false,true,true,false,false,true,false,false,false,false,true,false,true,false,true,false,false,true,true,true,true,true,true,true,true,true,false,true,false,true,true],
[true,true,true,true,true,true,true,false,false,false,true,false,false,true,false,false,true,false,true,true,false,true,true,false,false,true,false,true,false,true,false,true,true,true,false,true,true,true,false,true,false]
];

// ── Config ───────────────────────────────────────────────────────────────────
const FG        = [59, 138, 222];  // #3B8ADE
const BG        = [255, 255, 255]; // #FFFFFF
const QR_MOD    = 5;               // グリッド基本単位 = QRモジュールサイズ
const THRESHOLD = 120;             // 明暗の閾値

// ── ファインダーパターン判定 ─────────────────────────────────────────────────
function isFinderZone(qr, qc) {
  if (qr <= 7 && qc <= 7)  return true; // 左上
  if (qr <= 7 && qc >= 33) return true; // 右上
  if (qr >= 33 && qc <= 7) return true; // 左下
  return false;
}

let img;
let qrCX, qrCY;   // QRコード中心（canvas座標）
let maxDist;
let sliders = [];

// ── p5 lifecycle ─────────────────────────────────────────────────────────────
function preload() {
  img = loadImage('reference/face_up.jpg');
}

function setup() {
  pixelDensity(2);
  createCanvas(600, 800);

  // QR中心 = 顔の中央（face.jpg は顔のみなので中央付近）
  qrCX = width  * 0.50;
  qrCY = height * 0.40;

  maxDist = dist(0, 0, width / 2, height / 2) * 1.4;

  img.loadPixels();
  noStroke();

  // HTMLスライダーを取得
  for (let i = 0; i < 4; i++) {
    let el = document.getElementById('s' + i);
    el.addEventListener('input', () => {
      document.getElementById('v' + i).textContent = el.value;
      redraw();
    });
    sliders.push(el);
  }

  noLoop();
}

// ── Brightness sampler ───────────────────────────────────────────────────────
function sampleBright(cx, cy) {
  let ix = constrain(floor(map(cx, 0, width,  0, img.width  - 1)), 0, img.width  - 1);
  let iy = constrain(floor(map(cy, 0, height, 0, img.height - 1)), 0, img.height - 1);
  let p  = (iy * img.width + ix) * 4;
  return img.pixels[p] * 0.299 + img.pixels[p+1] * 0.587 + img.pixels[p+2] * 0.114;
}

// ── Main draw ─────────────────────────────────────────────────────────────────
function draw() {
  background(BG);

  let qrW    = 41 * QR_MOD;
  let qrH    = 41 * QR_MOD;
  let qrLeft = qrCX - qrW / 2;
  let qrTop  = qrCY - qrH / 2;

  rectMode(CORNER);
  noStroke();

  // ゾーン境界（QR中心からのチェビシェフ距離、近いほど細かい）
  let zones = [
    [+sliders[0].value, QR_MOD    ],  // 5px（QR直近）
    [+sliders[1].value, QR_MOD * 2],  // 10px
    [+sliders[2].value, QR_MOD * 4],  // 20px
    [+sliders[3].value, QR_MOD * 6],  // 30px
    [Infinity,          QR_MOD * 6],  // 30px（外縁）
  ];

  let cols = ceil(width  / QR_MOD);
  let rows = ceil(height / QR_MOD);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let x = c * QR_MOD;
      let y = r * QR_MOD;

      // QRモジュール座標（-1=QR外）
      let qc   = floor((x + QR_MOD / 2 - qrLeft) / QR_MOD);
      let qr   = floor((y + QR_MOD / 2 - qrTop)  / QR_MOD);
      let inQR = qc >= 0 && qc < 41 && qr >= 0 && qr < 41;
      let isFinder = inQR && isFinderZone(qr, qc);

      // ファインダーは常にQR_MOD解像度で描画
      let cx_ = x + QR_MOD / 2, cy_ = y + QR_MOD / 2;
      let d = max(abs(cx_ - qrCX), abs(cy_ - qrCY));  // 正方形距離
      let S = (isFinder || inQR) ? QR_MOD : zones.find(z => d < z[0])[1];

      // 代表点でなければスキップ
      if (x % S !== 0 || y % S !== 0) continue;

      // タイル中央
      let tileCX = x + S / 2;
      let tileCY = y + S / 2;

      // QRモジュールを代表点で再取得（Sが大きい場合）
      let tqc = floor((tileCX - qrLeft) / QR_MOD);
      let tqr = floor((tileCY - qrTop)  / QR_MOD);
      let tInQR = tqc >= 0 && tqc < 41 && tqr >= 0 && tqr < 41;

      // 全エリア共通：写真の明暗でフルサイズ描画
      if (sampleBright(tileCX, tileCY) < THRESHOLD) {
        fill(FG[0], FG[1], FG[2]);
        rect(x, y, S, S);
      }

      // QRゾーン内はQRを重ねる（HIDE_QR=trueの場合はスキップ）
      if (tInQR && typeof HIDE_QR === 'undefined') {
        let isStructural = isFinderZone(tqr, tqc)
          || tqr === 6 || tqc === 6
          || (tqr === 8 && (tqc <= 8 || tqc >= 33))
          || (tqc === 8 && (tqr <= 8 || tqr >= 33));

        let qrDark = QR_MATRIX[tqr][tqc];
        if (isStructural) {
          // 構造モジュール → フルサイズで正確に上書き
          fill(qrDark ? FG[0] : BG[0], qrDark ? FG[1] : BG[1], qrDark ? FG[2] : BG[2]);
          rect(x, y, QR_MOD, QR_MOD);
        } else {
          // データモジュール → 小さいドット(3px)で上書き
          let dot = 3, off = (QR_MOD - dot) / 2;
          fill(qrDark ? FG[0] : BG[0], qrDark ? FG[1] : BG[1], qrDark ? FG[2] : BG[2]);
          rect(x + off, y + off, dot, dot);
        }
      }
    }
  }
}

// スペースキーでPNG保存、SキーでSVG保存
function keyPressed() {
  if (key === ' ') saveCanvas('cover', 'png');
  if (key === 's' || key === 'S') exportSVG();
}

function exportSVG() {
  const W = width, H = height;
  const fgHex = '#3B8ADE', bgHex = '#FFFFFF';

  let qrW    = 41 * QR_MOD;
  let qrH    = 41 * QR_MOD;
  let qrLeft = qrCX - qrW / 2;
  let qrTop  = qrCY - qrH / 2;

  let zones = [
    [+sliders[0].value, QR_MOD    ],
    [+sliders[1].value, QR_MOD * 2],
    [+sliders[2].value, QR_MOD * 4],
    [+sliders[3].value, QR_MOD * 6],
    [Infinity,          QR_MOD * 6],
  ];

  let bgMosaic = [];  // 白：モザイク
  let fgMosaic = [];  // 青：モザイク
  let bgQR     = [];  // 白：QRオーバーレイ
  let fgQR     = [];  // 青：QRオーバーレイ

  // 背景
  bgMosaic.push(`<rect width="${W}" height="${H}"/>`);

  let cols = ceil(W / QR_MOD);
  let rows = ceil(H / QR_MOD);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let x = c * QR_MOD;
      let y = r * QR_MOD;

      let qc   = floor((x + QR_MOD / 2 - qrLeft) / QR_MOD);
      let qr   = floor((y + QR_MOD / 2 - qrTop)  / QR_MOD);
      let inQR = qc >= 0 && qc < 41 && qr >= 0 && qr < 41;
      let isFinder = inQR && isFinderZone(qr, qc);

      let cx_ = x + QR_MOD / 2, cy_ = y + QR_MOD / 2;
      let d = max(abs(cx_ - qrCX), abs(cy_ - qrCY));
      let S = (isFinder || inQR) ? QR_MOD : zones.find(z => d < z[0])[1];

      if (x % S !== 0 || y % S !== 0) continue;

      let tileCX = x + S / 2;
      let tileCY = y + S / 2;

      let tqc = floor((tileCX - qrLeft) / QR_MOD);
      let tqr = floor((tileCY - qrTop)  / QR_MOD);
      let tInQR = tqc >= 0 && tqc < 41 && tqr >= 0 && tqr < 41;

      // 写真モザイク（QR範囲外のみ）
      if (!tInQR && sampleBright(tileCX, tileCY) < THRESHOLD) {
        fgMosaic.push(`<rect x="${x}" y="${y}" width="${S}" height="${S}"/>`);
      }

      // QRオーバーレイ（最前面グループへ）
      if (tInQR) {
        let isStructural = isFinderZone(tqr, tqc)
          || tqr === 6 || tqc === 6
          || (tqr === 8 && (tqc <= 8 || tqc >= 33))
          || (tqc === 8 && (tqr <= 8 || tqr >= 33));

        let qrDark = QR_MATRIX[tqr][tqc];

        // QRエリア背景（ポートレートベース）
        if (sampleBright(tileCX, tileCY) < THRESHOLD) {
          fgMosaic.push(`<rect x="${x}" y="${y}" width="${QR_MOD}" height="${QR_MOD}"/>`);
        }

        // QRモジュールを最前面に
        let target = qrDark ? fgQR : bgQR;
        if (isStructural) {
          target.push(`<rect x="${x}" y="${y}" width="${QR_MOD}" height="${QR_MOD}"/>`);
        } else {
          let dot = 3, off = (QR_MOD - dot) / 2;
          target.push(`<rect x="${x + off}" y="${y + off}" width="${dot}" height="${dot}"/>`);
        }
      }
    }
  }

  // 描画順：白背景 → 青モザイク → QRオーバーレイ（白・青）
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">\n`
           + `<g id="white" fill="${bgHex}">\n` + bgMosaic.join('\n') + `\n</g>\n`
           + `<g id="blue"  fill="${fgHex}">\n` + fgMosaic.join('\n') + `\n</g>\n`
           + `<g id="qr">\n`
           +   `<g id="qr-white" fill="${bgHex}">\n` + bgQR.join('\n') + `\n</g>\n`
           +   `<g id="qr-blue"  fill="${fgHex}">\n` + fgQR.join('\n') + `\n</g>\n`
           + `</g>\n`
           + `</svg>`;

  let blob = new Blob([svg], { type: 'image/svg+xml' });
  let a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'cover.svg';
  a.click();
}
