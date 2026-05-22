"""
wink 2.mov の各フレームにモザイク処理を適用して wink_mosaic.mp4 を出力する。
カバー.js と同じアルゴリズム（QRなし）。
"""

import cv2
import numpy as np

INPUT  = "reference/wink3.mov"
OUTPUT = "reference/wink_mosaic.mp4"

# ── カバー.js と同じ設定 ──────────────────────────────────────────────────────
FG        = np.array([59,  138, 222], dtype=np.uint8)   # 青
BG        = np.array([255, 255, 255], dtype=np.uint8)   # 白
QR_MOD    = 5
THRESHOLD = 120

OUT_W = 600
OUT_H = 888

QR_CX = OUT_W * 0.50
QR_CY = OUT_H * 0.40

ZONES = [
    (178, QR_MOD    ),
    (277, QR_MOD * 2),
    (355, QR_MOD * 4),
    (459, QR_MOD * 6),
    (float('inf'), QR_MOD * 6),
]

# ── タイルサイズ LUT（各ピクセル位置に対するS値を事前計算）────────────────────
# (OUT_H, OUT_W) の配列で各(y,x)のSを保持
tile_size = np.full((OUT_H, OUT_W), QR_MOD * 6, dtype=np.int32)

xs = np.arange(OUT_W)
ys = np.arange(OUT_H)
cx_arr = xs + QR_MOD / 2         # shape (W,)
cy_arr = ys + QR_MOD / 2         # shape (H,)

# チェビシェフ距離で各セルのSを決定
for bound, S in reversed(ZONES):
    dx = np.abs(cx_arr - QR_CX)  # (W,)
    dy = np.abs(cy_arr - QR_CY)  # (H,)
    d  = np.maximum(dx[np.newaxis, :], dy[:, np.newaxis])  # (H, W)
    mask = d < bound
    tile_size[mask] = S

# ── フレーム処理 ──────────────────────────────────────────────────────────────
def process_frame(frame_bgr):
    """frame_bgr (任意サイズ) → モザイク済み BGR (OUT_W×OUT_H)"""
    # OUT_W×OUT_H にリサイズ
    src = cv2.resize(frame_bgr, (OUT_W, OUT_H), interpolation=cv2.INTER_AREA)

    # グレースケール輝度
    gray = src[:, :, 2] * 0.299 + src[:, :, 1] * 0.587 + src[:, :, 0] * 0.114

    # 出力バッファ（白で初期化）
    out = np.full((OUT_H, OUT_W, 3), BG[::-1], dtype=np.uint8)  # BGR

    # タイルごとに処理（S 単位でスキャン）
    # S ごとにグループ化して一括処理
    for S in [QR_MOD, QR_MOD*2, QR_MOD*4, QR_MOD*6]:
        # このSに対応するタイル起点 (x%S==0 かつ y%S==0 かつ tile_size==S)
        for y in range(0, OUT_H, S):
            for x in range(0, OUT_W, S):
                if tile_size[y, x] != S:
                    continue
                # タイル中央の輝度
                ty = min(y + S // 2, OUT_H - 1)
                tx = min(x + S // 2, OUT_W - 1)
                if gray[ty, tx] < THRESHOLD:
                    x2 = min(x + S, OUT_W)
                    y2 = min(y + S, OUT_H)
                    out[y:y2, x:x2] = FG[::-1]  # BGR

    return out

# ── 動画入出力 ────────────────────────────────────────────────────────────────
cap = cv2.VideoCapture(INPUT)
fps = cap.get(cv2.CAP_PROP_FPS)
total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

fourcc = cv2.VideoWriter_fourcc(*'mp4v')
writer = cv2.VideoWriter(OUTPUT, fourcc, fps, (OUT_W, OUT_H))

print(f"入力: {INPUT}  ({total}フレーム, {fps}fps)")
print(f"出力: {OUTPUT}  ({OUT_W}×{OUT_H})")

for i in range(total):
    ret, frame = cap.read()
    if not ret:
        break
    mosaic = process_frame(frame)
    writer.write(mosaic)
    if (i + 1) % 5 == 0 or i == total - 1:
        print(f"  {i+1}/{total} フレーム完了")

cap.release()
writer.release()

# mp4v は iOS 非対応の場合があるので ffmpeg で H.264 に変換
import subprocess, os
tmp = OUTPUT.replace(".mp4", "_tmp.mp4")
os.rename(OUTPUT, tmp)
subprocess.run([
    "ffmpeg", "-y", "-i", tmp,
    "-vcodec", "libx264", "-pix_fmt", "yuv420p",
    "-preset", "fast", "-crf", "20",
    OUTPUT
], check=True)
os.remove(tmp)

print(f"\n完了: {OUTPUT}")
