# portrait-mosaic ワークフロー記録

星新一ショートショート全集の表紙をARターゲットにしたWebARアプリ。  
URL: `https://tsubasafukuda06.github.io/portrait-mosaic/`

---

## 技術スタック

| 用途 | ライブラリ |
|------|-----------|
| AR認識 | MindAR (mindar-image-aframe.prod.js) |
| 3D描画 | A-Frame + Three.js |
| モザイク生成（静止画） | Canvas 2D API |
| モザイク動画生成 | Python / OpenCV (`mosaic_video.py`) |
| 3Dキャラクター制作 | Blender + Geometry Nodes (`nodes_rebuild.py`) |

---

## ファイル構成

```
portrait-mosaic/
├── index.html              # メインHTML（A-Frameシーン）
├── ar.js                   # AR制御・全エフェクト
├── cover.html / cover.js   # 表紙デザイン用プレビュー（p5.js）
├── mosaic_video.py         # wink動画をモザイク化するPythonスクリプト
├── nodes_rebuild.py        # BlenderのGeoNodes・シェーダーを再現するスクリプト
├── targets.mind            # MindAR用画像ターゲット
├── 3d/
│   ├── hoshi.glb           # 「星」3Dキャラクター
│   ├── shin.glb            # 「新」3Dキャラクター
│   └── ichi.glb            # 「一」3Dキャラクター（※Three.jsで代替生成）
├── reference/
│   ├── face_up.jpg         # モザイク生成用の顔写真
│   ├── wink3.mov           # ウィンク動画（素材）
│   └── wink_mosaic.mp4     # モザイク処理済みウィンク動画（生成物）
└── sound/
    ├── zone3.wav           # ゾーン3タップ音
    └── zone5.wav           # ゾーン5（ウィンク）タップ音
```

---

## カラー設定（ar.js）

| 変数 | 現在値 | 用途 |
|------|--------|------|
| `FG` | `#15DFDF` (21,223,223) | モザイク暗部タイル |
| `BG` | `#F3F3CF` (243,243,207) | モザイク明部・背景 |
| キラキラ | `#FFF400` | ウィンク時スパークル |
| 3Dキャラクター | 6色パステルグラデーション | 下記参照 |
| ゾーンフラッシュ | `#ffffff` | タップ時の白点滅 |

### 3Dキャラクターのグラデーション（法線ベース6色）

| 方向 | 色 |
|------|----|
| +X（右） | ピンク `#FFB8D9` |
| -X（左） | ミント `#B8FFD4` |
| +Y（上） | イエロー `#FFF8A8` |
| -Y（下） | ラベンダー `#D9B8FF` |
| +Z（手前） | ブルー `#A8D9F0` |
| -Z（奥） | ピーチ `#FFD9B8` |

---

## モザイクアルゴリズム

- キャンバスサイズ: 600 × 888 px
- 中心 (ORIGIN_CX, ORIGIN_CY): (300, 355)
- 中心からのチェビシェフ距離でタイルサイズを変化（近いほど細かい）

| 距離 | タイルサイズ |
|------|------------|
| < 178px | 5px |
| < 277px | 10px |
| < 355px | 20px |
| それ以上 | 30px |

- 輝度閾値 `THRESHOLD = 120`：輝度がこれ以下のピクセルを FG カラーで塗る

---

## インタラクション（タップゾーン）

画面を3×3の9ゾーンに分割。

| ゾーン番号 | 効果 |
|-----------|------|
| 0〜4, 6〜8 | サイン波トーン再生 + 白フラッシュ |
| 3（中央左） | `zone3.wav` 再生 + 星・新・一の3Dキャラクター降下 |
| 5（中央） | `zone5.wav` 再生 + ウィンク動画再生 + キラキラスパークル |

---

## 3Dキャラクターのエフェクト詳細

### 降下アニメーション（`animateGLB`）
1. **落下**: `easeInQuart` で加速しながら Z 軸を移動（750〜870ms）
2. **停止**: 着地後 700ms 静止
3. **ディゾルブ消滅**: 2000ms かけて 3D ローカル座標ベースのチャンク単位で消えていく

### 「一」について
`ichi.glb` は横一画のため奥行きがほぼゼロ。GLB を使わず `THREE.ExtrudeGeometry` で書道風の横棒を直接生成している（`createIchiObject()`）。

---

## ウィンク動画の再生成手順

`ar.js` の FG / BG を変更した場合、`wink_mosaic.mp4` も作り直す必要がある。

1. `mosaic_video.py` の FG・BG を `ar.js` と同じ値に更新
2. 実行:
   ```bash
   cd /Users/fukudatsubasa/portrait-mosaic
   python3 mosaic_video.py
   ```
3. `reference/wink_mosaic.mp4` が更新されるのでコミット・プッシュ

---

## ARプレーン設定

- 表紙サイズ: 107 × 150 mm
- A-Frame `a-plane`: `width="1" height="1.402"` (= 150/107)
- X オフセット: `-0.05`（右ズレ補正）
- `ar.js` 内の座標変換でも同じ `1.402` を使用

---

## デプロイ

GitHub Pages（`tsubasafukuda06/portrait-mosaic`）の `main` ブランチに push するだけ。  
キャッシュが残る場合はブラウザでハードリフレッシュ（iPhoneはリロード長押し）。
