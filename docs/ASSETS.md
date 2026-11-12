# Assets and rendering notes — KSA OUTPOST 86 v3.6.0

## Runtime and rendering

- Babylon.js `@babylonjs/core` is pinned in `package.json`/`package-lock.json` and dynamically imported by `src/engine/babylonWorld.ts`. Vite places the 3D runtime in a separate chunk; it is not loaded as an unversioned standalone CDN script.
- WebGPU is preferred where available; WebGL 2 is the fallback. `src/engine/canvasFallback.ts` keeps the mission UI available if the 3D runtime cannot initialise, but it is not equivalent to the Babylon 3D scene.
- Large planetary surfaces are selected-world assets. The app shell does not preload every planet's textures.

## Original procedural assets

- Earth surface artwork is generated programmatically at runtime; it is illustrative, not a current satellite basemap.
- Lunar and Martian terrain geometry is procedural educational terrain, not a verified digital elevation model.
- Astronauts, spacecraft, habitat structures, rover components and equipment are procedural educational models, not certified engineering models, motion-capture characters or NASA photogrammetry.
- `public/favicon.svg` is the original KSA OUTPOST 86 orbital emblem. It is not NASA branding.

## Existing supplied lunar assets

The v2.2.0 source archive supplied lunar albedo, height, normal and roughness maps, a crew SVG, UI illustrations and audio. They are retained only where used. Their original provenance and licence could not be independently verified from the archive; do not attribute them to NASA without confirming the original source and licence.

## V3.6 Mars material maps

- `public/assets/terrain/mars-regolith-albedo.webp` — original code-generated, tileable Martian regolith colour map.
- `public/assets/terrain/mars-regolith-normal.webp` — normal map derived from the original procedural height field.
- `public/assets/terrain/mars-regolith-metallic-roughness.webp` — packed roughness/metalness texture derived from the same procedural field.

These are original game materials, not NASA imagery or measured surface properties. They are loaded when the Mars scene is selected.

## Future imported models

For every external GLB/glTF model, record the exact source, creator, licence, date acquired, checksum and attribution requirements before redistributing it. Do not include assets with unclear redistribution rights.

## Science references

- [NASA 3D Resources](https://science.nasa.gov/3d-resources/)
- [NASA Eyes](https://science.nasa.gov/eyes/)
- [NASA Solar System Treks](https://trek.nasa.gov/)

These are research references, not proof that every current model or texture originated from NASA.
