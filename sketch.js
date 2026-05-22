'use strict';

// ── Palettes ── [fg, bg, canvas]
const PALETTES = [
  { name: 'Blue',      fg: [60, 100, 165],  bg: [185, 215, 240], canvas: [255, 255, 255] },
  { name: 'Gold/Teal', fg: [155, 112, 38],  bg: [125, 190, 196], canvas: [255, 255, 255] },
  { name: 'Rust',      fg: [184, 72, 44],   bg: [214, 148, 118], canvas: [242, 228, 218] },
  { name: 'Forest',    fg: [34, 95, 38],    bg: [142, 188, 140], canvas: [255, 255, 255] },
  { name: 'Navy',      fg: [22, 38, 118],   bg: [140, 162, 218], canvas: [228, 232, 255] },
  { name: 'Gold',      fg: [188, 148, 22],  bg: [232, 208, 136], canvas: [255, 255, 255] },
  { name: 'Rose',      fg: [192, 90, 120],  bg: [232, 176, 198], canvas: [255, 248, 252] },
  { name: 'Slate',     fg: [28, 28, 28],    bg: [148, 148, 148], canvas: [240, 240, 240] },
];

const SHAPES = [
  'Circles', 'Squares', 'Crosses', 'Diamonds',
  'Characters', 'V-Lines', 'Outline Circles', 'Outline Squares',
  'Grid Fill', 'Pixel Mosaic',
];

const CHARS = '星新一 ショートショート全集';

// ── State ──
let img;
let sliders      = {};
let colorPickers = [];
let drawnPaths   = [];
let currentPath  = null;
let ropeTextInput;
let paperX, paperY, paperW, paperH;
let tText = 0; // テキスト波アニメーション用タイム（textile_weave から移植）

// ── Color utilities (textile_weave から移植) ──────────────────────────────────
function hexToRGB(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbToHex(rgb) {
  return '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function getCurrentPalette() {
  if (colorPickers.length === 5) {
    return {
      fg:     hexToRGB(colorPickers[0].elt.value),
      mid:    hexToRGB(colorPickers[1].elt.value),
      bg:     hexToRGB(colorPickers[2].elt.value),
      canvas: hexToRGB(colorPickers[3].elt.value),
      text:   hexToRGB(colorPickers[4].elt.value),
    };
  }
  return PALETTES[0];
}

// 明度に応じて3段階の色を返すヘルパー
function pickColor(bright, threshold, pal) {
  if (bright < threshold * 0.5) return pal.fg;
  if (bright < threshold)       return pal.mid;
  return pal.bg;
}

function syncPickersFromPreset(palIdx) {
  if (colorPickers.length !== 3) return;
  let pal = PALETTES[palIdx];
  colorPickers[0].elt.value = rgbToHex(pal.fg);
  colorPickers[1].elt.value = rgbToHex(pal.bg);
  colorPickers[2].elt.value = rgbToHex(pal.canvas);
}

// ── p5 lifecycle ──────────────────────────────────────────────────────────────
function preload() {
  img = loadImage('reference/hoshishinnichi.jpg');
}

function setup() {
  pixelDensity(2);
  createCanvas(windowWidth, windowHeight);

  paperX = 240;
  paperY = 40;
  resizePaper();
  buildControls();

  textFont('monospace');
  loop();
}

function resizePaper() {
  let maxW   = width  - paperX - 40;
  let maxH   = height - paperY - 40;
  let aspect = 3 / 4; // portrait ratio w/h
  if (maxW / maxH > aspect) {
    paperH = maxH;
    paperW = paperH * aspect;
  } else {
    paperW = maxW;
    paperH = paperW / aspect;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  paperW = 0; paperH = 0;
  resizePaper();
  redraw();
}

// ── UI helpers (textile_weave スタイル) ───────────────────────────────────────
function mkSlider(key, min, max, val, step, onChange) {
  let sl = createSlider(min, max, val, step || 0);
  sl.style('width', '190px');
  sl.input(() => {
    if (onChange) onChange(sl.value());
    redraw();
  });
  sliders[key] = sl;
  return sl;
}

function mkBtn(label, w, cb) {
  let b = createButton(label);
  b.size(w);
  b.style('font-family', 'monospace');
  b.style('font-size', '10px');
  b.style('cursor', 'pointer');
  b.style('background', '#111');
  b.style('color', '#999');
  b.style('border', '1px solid #333');
  b.style('padding', '3px 6px');
  b.style('letter-spacing', '0.04em');
  if (cb) b.mousePressed(cb);
  return b;
}

function buildControls() {
  const X  = 10;
  let sy   = paperY + 4;

  // ── File input ──
  let fileInput = createFileInput(handleFile);
  fileInput.position(X, sy - 20);
  fileInput.style('font-family', 'monospace');
  fileInput.style('font-size', '10px');
  fileInput.style('color', '#888');
  fileInput.style('width', '220px');
  fileInput.attribute('accept', 'image/*');

  // ── Color pickers (textile_weave から移植) ──
  let pickerLabels = ['Fg', 'Mid', 'Bg', 'Canvas', 'Text'];
  let initColors   = [
    rgbToHex(PALETTES[0].fg),
    '#78a0d2',
    rgbToHex(PALETTES[0].bg),
    rgbToHex(PALETTES[0].canvas),
    rgbToHex(PALETTES[0].fg),   // テキスト描画色（初期値は Fg と同じ）
  ];
  colorPickers = [];
  for (let i = 0; i < 5; i++) {
    let inp = createElement('input');
    inp.attribute('type', 'color');
    inp.elt.value = initColors[i];
    inp.position(X + i * 38, sy + 16);
    inp.style('width', '34px');
    inp.style('height', '36px');
    inp.style('padding', '0');
    inp.style('border', '1px solid #333');
    inp.style('cursor', 'pointer');
    inp.elt.addEventListener('input', () => redraw());
    colorPickers.push(inp);
  }
  sy += 70;

  sy += 10;

  // ── Sliders ──
  const SLIDER_DEFS = [
    { key: 'grid',      min: 6,   max: 55,  val: 18,  step: 1 },
    { key: 'threshold', min: 0,   max: 255, val: 130, step: 1 },
    { key: 'variation', min: 0,   max: 1,                   val: 0.6, step: 0 },
    { key: 'textSz',    min: 6,   max: 80,                  val: 18,  step: 1 },
    { key: 'kerning',   min: 0.3, max: 3.0,                 val: 1.0, step: 0 },
  ];

  for (let d of SLIDER_DEFS) {
    let sl = mkSlider(d.key, d.min, d.max, d.val, d.step, d.onChange);
    sl.position(X, sy + 6);
    sy += 30;
  }

  sy += 16;

  // ── Textarea ──
  ropeTextInput = createElement('textarea', '星新一 ショートショート全集');
  ropeTextInput.position(X, sy);
  ropeTextInput.size(185, 60);
  ropeTextInput.style('font-family', 'monospace');
  ropeTextInput.style('font-size', '10px');
  ropeTextInput.style('resize', 'none');
  ropeTextInput.style('line-height', '1.4');
  ropeTextInput.style('background', '#111');
  ropeTextInput.style('color', '#bbb');
  ropeTextInput.style('border', '1px solid #333');
  ropeTextInput.style('padding', '4px 6px');
  ropeTextInput.style('outline', 'none');

  let clearBtn = mkBtn('clear', 38, () => { drawnPaths = []; currentPath = null; redraw(); });
  clearBtn.position(X + 190, sy);
  clearBtn.style('height', '60px');

  sy += 76;

  sy += 16;

  // ── Save ──
  let saveBtn = mkBtn('save PNG', 100, () => saveCanvas('portrait-mosaic', 'png'));
  saveBtn.position(X, sy);
}

// ── Sidebar labels (canvas に直接描画) ───────────────────────────────────────
function drawSidebar() {
  noStroke();
  textFont('monospace');
  textSize(10);

  const X  = 10;
  let sy   = paperY + 4;

  // Title
  fill(160);
  textAlign(LEFT, BOTTOM);
  text('Portrait Mosaic', X, sy - 4);

  // Colors section
  fill(100);
  text('colors', X, sy + 1);
  sy += 70;

  sy += 10;

  // Slider labels + values
  const LABEL_DEFS = [
    { key: 'grid',      label: 'grid size',  fmt: v => v },
    { key: 'threshold', label: 'threshold',  fmt: v => v },
    { key: 'variation', label: 'variation',  fmt: v => parseFloat(v).toFixed(2) },
    { key: 'textSz',    label: 'text size',  fmt: v => v },
    { key: 'kerning',   label: 'kerning',    fmt: v => parseFloat(v).toFixed(2) },
  ];

  for (let d of LABEL_DEFS) {
    fill(100); textAlign(LEFT, BOTTOM);
    text(d.label, X, sy + 1);
    fill(40); textAlign(RIGHT, CENTER);
    text(d.fmt(sliders[d.key].value()), X + 190, sy + 9);
    sy += 30;
  }

  sy += 16;

  fill(100); textAlign(LEFT, BOTTOM);
  text('text drawing', X, sy + 1);
}

// ── Brightness sampler ───────────────────────────────────────────────────────
function sampleBright(x, y) {
  let ix = constrain(floor(map(x, paperX, paperX + paperW, 0, img.width  - 1)), 0, img.width  - 1);
  let iy = constrain(floor(map(y, paperY, paperY + paperH, 0, img.height - 1)), 0, img.height - 1);
  let p  = (iy * img.width + ix) * 4;
  return img.pixels[p] * 0.299 + img.pixels[p + 1] * 0.587 + img.pixels[p + 2] * 0.114;
}

// ── Main draw ─────────────────────────────────────────────────────────────────
function draw() {
  let grid      = sliders.grid.value();
  let shapeIdx  = 7; // Outline Squares 固定
  let threshold = sliders.threshold.value();
  let variation = sliders.variation.value();
  let pal       = getCurrentPalette();

  // rectMode を必ず CORNER にリセット（drawShape で CENTER になることがある）
  rectMode(CORNER);

  // Overall background
  background(210);

  // Paper background
  noStroke();
  fill(pal.canvas[0], pal.canvas[1], pal.canvas[2]);
  rect(paperX, paperY, paperW, paperH);

  // Clip to paper area
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(paperX, paperY, paperW, paperH);
  drawingContext.clip();

  if (!img) {
    drawPlaceholder(pal, grid);
  } else {
    img.loadPixels();

    if (shapeIdx === 8) {
      drawGridFill(grid, pal, threshold);
    } else if (shapeIdx === 9) {
      drawPixelMosaic(grid, pal, threshold);
    } else {
      drawShapesGrid(grid, shapeIdx, pal, threshold, variation);
    }
  }

  drawRopeText();

  drawingContext.restore();

  // Sidebar labels drawn on top of everything
  drawSidebar();

  tText += 0.004; // 風アニメーション進行
}

// ── Shape-per-cell grid ──────────────────────────────────────────────────────
function drawShapesGrid(grid, shapeIdx, pal, threshold, variation) {
  let cols    = ceil(paperW / grid);
  let rows    = ceil(paperH / grid);
  let offsetX = paperX + (paperW - cols * grid) / 2 + grid / 2;
  let offsetY = paperY + (paperH - rows * grid) / 2 + grid / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let x = offsetX + c * grid;
      let y = offsetY + r * grid;

      let bright    = sampleBright(x, y);
      let col       = pickColor(bright, threshold, pal);
      let fullRange = map(bright, 0, 255, 0.93, 0.08);
      let ratio     = constrain(lerp(0.55, fullRange, variation), 0.06, 0.96);

      drawShape(x, y, grid * ratio, shapeIdx, c, r, col);
    }
  }
}

// ── Shape rendering ──────────────────────────────────────────────────────────
function drawShape(x, y, sz, shapeIdx, colIdx, rowIdx, c) {
  let h = sz / 2;

  switch (shapeIdx) {
    case 0: // Circles
      noStroke(); fill(c[0], c[1], c[2]);
      ellipse(x, y, sz, sz);
      break;

    case 1: // Squares
      noStroke(); fill(c[0], c[1], c[2]);
      rectMode(CENTER); rect(x, y, sz, sz);
      break;

    case 2: // Crosses
      noFill(); stroke(c[0], c[1], c[2]);
      strokeWeight(max(0.5, sz * 0.22));
      let arm = h * 0.88;
      line(x - arm, y, x + arm, y);
      line(x, y - arm, x, y + arm);
      break;

    case 3: // Diamonds
      noStroke(); fill(c[0], c[1], c[2]);
      beginShape();
      vertex(x, y - h); vertex(x + h, y);
      vertex(x, y + h); vertex(x - h, y);
      endShape(CLOSE);
      break;

    case 4: // Characters
      noStroke(); fill(c[0], c[1], c[2]);
      textAlign(CENTER, CENTER);
      textSize(max(6, sz * 0.92)); textStyle(BOLD);
      text(CHARS[(colIdx * 7 + rowIdx * 3) % CHARS.length], x, y);
      break;

    case 5: // Vertical lines
      noFill(); stroke(c[0], c[1], c[2]);
      strokeWeight(max(0.5, sz * 0.48));
      line(x, y - h * 0.92, x, y + h * 0.92);
      break;

    case 6: // Outline circles
      noFill(); stroke(c[0], c[1], c[2]);
      strokeWeight(max(0.5, sz * 0.13));
      ellipse(x, y, sz * 0.88, sz * 0.88);
      break;

    case 7: // Outline squares
      noFill(); stroke(c[0], c[1], c[2]);
      strokeWeight(max(0.5, sz * 0.13));
      rectMode(CENTER); rect(x, y, sz * 0.88, sz * 0.88);
      break;
  }
}

// ── Grid Fill ─────────────────────────────────────────────────────────────────
function drawGridFill(grid, pal, threshold) {
  let cols = ceil(paperW / grid);
  let rows = ceil(paperH / grid);

  rectMode(CORNER); noStroke();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let x  = paperX + c * grid;
      let y  = paperY + r * grid;
      let bright = sampleBright(x + grid / 2, y + grid / 2);
      let col    = pickColor(bright, threshold, pal);
      fill(col[0], col[1], col[2]);
      rect(x, y, min(grid, paperX + paperW - x), min(grid, paperY + paperH - y));
    }
  }

  let gc = pal.canvas;
  stroke(gc[0], gc[1], gc[2]); strokeWeight(1);
  for (let c = 1; c < cols; c++)
    line(paperX + c * grid, paperY, paperX + c * grid, paperY + paperH);
  for (let r = 1; r < rows; r++)
    line(paperX, paperY + r * grid, paperX + paperW, paperY + r * grid);
}

// ── Pixel Mosaic ─────────────────────────────────────────────────────────────
function drawPixelMosaic(grid, pal, threshold) {
  let cols = ceil(paperW / grid);
  let rows = ceil(paperH / grid);

  // 各セルの明度と色を事前計算
  let cellBright = [];
  for (let r = 0; r < rows; r++) {
    cellBright[r] = [];
    for (let c = 0; c < cols; c++) {
      cellBright[r][c] = sampleBright(paperX + c * grid + grid / 2, paperY + r * grid + grid / 2);
    }
  }

  // 色ティア（0=fg, 1=mid, 2=bg）でグループ化
  function tier(bright) {
    if (bright < threshold * 0.5) return 0;
    if (bright < threshold)       return 1;
    return 2;
  }

  let drawn = [];
  for (let r = 0; r < rows; r++) drawn[r] = new Array(cols).fill(false);

  rectMode(CORNER); noStroke();

  for (let r = 0; r < rows - 1; r += 2) {
    for (let c = 0; c < cols - 1; c += 2) {
      let v = tier(cellBright[r][c]);
      if (tier(cellBright[r][c+1]) === v && tier(cellBright[r+1][c]) === v && tier(cellBright[r+1][c+1]) === v) {
        let col = pickColor(cellBright[r][c], threshold, pal);
        fill(col[0], col[1], col[2]);
        rect(paperX + c * grid, paperY + r * grid, grid * 2, grid * 2);
        drawn[r][c] = drawn[r][c+1] = drawn[r+1][c] = drawn[r+1][c+1] = true;
      }
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!drawn[r][c]) {
        let col = pickColor(cellBright[r][c], threshold, pal);
        fill(col[0], col[1], col[2]);
        rect(paperX + c * grid, paperY + r * grid,
             min(grid, paperX + paperW - paperX - c * grid),
             min(grid, paperY + paperH - paperY - r * grid));
      }
    }
  }

  let gc = pal.canvas;
  stroke(gc[0], gc[1], gc[2]); strokeWeight(1);
  for (let c = 1; c < cols; c++)
    line(paperX + c * grid, paperY, paperX + c * grid, paperY + paperH);
  for (let r = 1; r < rows; r++)
    line(paperX, paperY + r * grid, paperX + paperW, paperY + r * grid);
}

// ── パスに風の揺れを加える (textile_weave から移植) ───────────────────────────
function animatePath(path) {
  let waveAmt = 30;
  let result  = [];
  for (let i = 0; i < path.length; i++) {
    let pt   = path[i];
    let prev = path[max(0, i - 1)];
    let next = path[min(path.length - 1, i + 1)];
    let tx   = next.x - prev.x;
    let ty   = next.y - prev.y;
    let tlen = sqrt(tx * tx + ty * ty);
    if (tlen < 0.001) { result.push(pt); continue; }
    // 接線の法線方向
    let nx      = -ty / tlen;
    let ny      =  tx / tlen;
    // 風と同方向の位相遅延
    let windLag = (pt.x - paperX) / max(paperW, 1) * 0.45;
    let d       = (noise(pt.x * 0.006, pt.y * 0.006, tText - windLag) - 0.5) * 2 * waveAmt;
    result.push({ x: pt.x + nx * d, y: pt.y + ny * d });
  }
  return result;
}

// ── Rope text (textile_weave から移植) ────────────────────────────────────────
function drawRopeText() {
  let rawPaths = (currentPath && currentPath.length > 1)
    ? [...drawnPaths, currentPath]
    : drawnPaths;
  if (rawPaths.length === 0) return;

  let pal      = getCurrentPalette();
  let fontSize = sliders.textSz.value();
  let spacing  = fontSize * sliders.kerning.value();
  let label    = ((ropeTextInput ? ropeTextInput.value().trim() : '') || CHARS) + '  ';

  noStroke();
  textFont('monospace'); textAlign(CENTER, CENTER);
  textSize(fontSize); textStyle(BOLD);
  let tc = pal.text || pal.fg;
  fill(tc[0], tc[1], tc[2]);

  let globalIdx = 0;

  for (let rawPath of rawPaths) {
    if (rawPath.length < 2) continue;

    // 風で揺れるパスに変換
    let path = animatePath(rawPath);

    let lengths = [0];
    for (let i = 1; i < path.length; i++) {
      let dx = path[i].x - path[i-1].x;
      let dy = path[i].y - path[i-1].y;
      lengths.push(lengths[lengths.length-1] + sqrt(dx*dx + dy*dy));
    }

    let numChars = floor(lengths[lengths.length-1] / spacing);
    let ptr = 0;

    for (let c = 0; c < numChars; c++) {
      let target = (c + 0.5) * spacing;
      while (ptr < lengths.length - 2 && lengths[ptr+1] < target) ptr++;
      let span  = lengths[ptr+1] - lengths[ptr];
      let frac  = span > 0 ? (target - lengths[ptr]) / span : 0;
      let px    = lerp(path[ptr].x, path[ptr+1].x, frac);
      let py    = lerp(path[ptr].y, path[ptr+1].y, frac);
      let angle = atan2(path[ptr+1].y - path[ptr].y, path[ptr+1].x - path[ptr].x);
      let ch    = label.charAt((globalIdx + c) % label.length);

      push(); translate(px, py); rotate(angle); text(ch, 0, 0); pop();
    }
    globalIdx += numChars;
  }
}

// ── Mouse handlers (textile_weave から移植) ───────────────────────────────────
function mousePressed() {
  if (mouseX < paperX || mouseX > paperX + paperW ||
      mouseY < paperY || mouseY > paperY + paperH) return;
  currentPath = [{ x: mouseX, y: mouseY }];
}

function mouseDragged() {
  if (!currentPath) return;
  let last = currentPath[currentPath.length - 1];
  let dx = mouseX - last.x, dy = mouseY - last.y;
  if (dx * dx + dy * dy > 4) {
    currentPath.push({ x: mouseX, y: mouseY });
    redraw();
  }
}

function mouseReleased() {
  if (currentPath && currentPath.length > 2) drawnPaths.push(currentPath);
  currentPath = null;
  redraw();
}

// ── File handling ─────────────────────────────────────────────────────────────
function handleFile(file) {
  if (file.type === 'image') img = loadImage(file.data, () => redraw());
}

// ── Placeholder ───────────────────────────────────────────────────────────────
function drawPlaceholder(pal, grid) {
  noStroke();
  for (let y = paperY + grid; y < paperY + paperH; y += grid) {
    for (let x = paperX + grid; x < paperX + paperW; x += grid) {
      fill(pal.bg[0], pal.bg[1], pal.bg[2], 160);
      ellipse(x, y, grid * 0.4, grid * 0.4);
    }
  }
  fill(80); noStroke();
  textAlign(CENTER, CENTER); textSize(13); textStyle(NORMAL);
  text('画像をアップロードしてください', paperX + paperW / 2, paperY + paperH / 2);
}
