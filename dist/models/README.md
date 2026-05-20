# Blender model imports

Put exported Blender models here as `.glb` files.

Recommended export path from Blender:

1. `File` -> `Export` -> `glTF 2.0`
2. Format: `GLB`
3. Apply transforms before export
4. Keep the origin/pivot useful for the object animation

After adding a model, register it in:

`frontend/src/config/blenderAssets.js`

Example:

```js
export const blenderAssets = [
  {
    id: 'mainframe-detail',
    path: '/models/mainframe-detail.glb',
    position: [0, 0.5, 0.8],
    rotation: [0, 0, 0],
    scale: 1,
  },
];
```
