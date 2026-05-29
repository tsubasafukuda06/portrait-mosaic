# GLBテクスチャ調整ワークフロー
## MeshyAI生成GLBをARでイラスト風に見せる手順

---

## 問題点

MeshyAI で生成した GLB をそのまま AR（Three.js / A-Frame）で表示すると以下の問題が出る。

| 問題 | 原因 |
|------|------|
| 色が鮮やかすぎる | Blender の Filmic トーンマッピングが AR では効かない |
| 発光している | MeshyAI が Emission Strength を 1.0 にしている |
| 光沢がありすぎる | Roughness/Metalness がデフォルト値のまま |

---

## Blender での作業手順

### 1. Color Management を Standard に変更

`Render Properties（カメラアイコン）→ Color Management → View Transform → Standard`

- これでビューポートがブラウザ（AR）と同じ色表示になる
- **この設定でパステルに見えるよう色を作ると、ARでもそのまま出る**

---

### 2. Emission Strength を 0 にする

`Shader Editor → Principled BSDF → Emission Strength → 0`

MeshyAI はデフォルトで 1.0 に設定しているため、ARで発光して見える。全マテリアルに適用する。

Blender MCP で一括処理する場合：

```python
import bpy
for mat in bpy.data.materials:
    if not mat.use_nodes: continue
    for node in mat.node_tree.nodes:
        if node.type == 'BSDF_PRINCIPLED':
            strength = node.inputs.get('Emission Strength')
            if strength:
                strength.default_value = 0.0
```

---

### 3. テクスチャのパステル化（Python で一括処理）

塗り直さずにテクスチャ画像の彩度・明度をピクセル単位で調整する。

Blender MCP で実行：

```python
import bpy
import colorsys

img = bpy.data.images['texture_0']  # テクスチャ名を確認して変更
pixels = list(img.pixels)
new_pixels = []

SAT      = 0.85   # 彩度（1.0 = 変更なし、下げるとパステルに）
VAL_MULT = 1.05   # 明度の乗数
VAL_ADD  = 0.02   # 明度の加算

for i in range(0, len(pixels), 4):
    r, g, b, a = pixels[i], pixels[i+1], pixels[i+2], pixels[i+3]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    s  = min(1.0, s * SAT)
    v  = min(1.0, v * VAL_MULT + VAL_ADD)
    r2, g2, b2 = colorsys.hsv_to_rgb(h, s, v)
    new_pixels += [r2, g2, b2, a]

img.pixels = new_pixels
img.gl_free()
img.update()
```

**注意：この操作は元に戻せないので、事前に `.blend` を別名保存しておくこと。**

---

### 4. GLB エクスポート

`File → Export → glTF 2.0` または Blender MCP：

```python
import bpy
bpy.ops.export_scene.gltf(
    filepath='/Users/fukudatsubasa/portrait-mosaic/3d/XX.glb',
    export_format='GLB',
    use_selection=False,
    export_animations=True,
    export_skins=True,
    export_cameras=False,
    export_lights=False,
)
```

---

## ar.js 側の設定

GLB を読み込んだ後に以下を適用することで、さらにマット質感に統一できる。

```js
// ZONE_CHAR_CONFIG に matte: true を追加
const ZONE_CHAR_CONFIG = {
  '3d/01.glb': { matte: true },
  '3d/02.glb': { matte: true },
};

// スポーン時に適用
if (config.matte) {
  obj.traverse(child => {
    if (child.isMesh) {
      child.material.roughness = 1.0;
      child.material.metalness = 0.0;
    }
  });
}
```

---

## チェックリスト

```
□ Blender: Color Management → Standard に変更
□ Blender: Emission Strength → 0（全マテリアル）
□ Blender: テクスチャをパステル調整（必要に応じて）
□ Blender: GLB エクスポート（cameras/lights 除外）
□ ar.js:   ZONE_CHAR_CONFIG に matte: true を追加（光沢あるモデル用）
□ GitHub:  git add / commit / push
□ 確認:    ブラウザハードリフレッシュ（iPhoneはリロード長押し）
```
