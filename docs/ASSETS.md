# Assets and rendering notes — v2.3.0

## Procedural assets in this release

The Babylon scene creates procedural Earth surface artwork, lunar/Martian terrain, rocks, crater forms, habitats, solar arrays, astronauts, rover and spacecraft components using runtime-generated textures and meshes. These are original educational visualization assets, not NASA photogrammetry or flight-qualified models.

The existing v2.2.0 archive also supplied lunar albedo/height/normal/roughness imagery, a crew SVG, UI illustrations and audio. Retain their original names and bundled assets where still used. The original source/licence for every terrain-map file was not independently verifiable from the supplied archive, so they must not be attributed to NASA without a separate provenance check.

## Babylon.js runtime

The browser loads the official Babylon.js standalone runtime from `https://cdn.babylonjs.com/babylon.js`. This avoids introducing an unverified local package into the locked dependency tree in a network-isolated release environment. It does mean initial 3D startup needs access to the CDN. The application includes a Canvas 2D fallback if loading fails.

## Future imported models

When adding external GLB/glTF models, record the exact source URL, creator, licence, date acquired, file checksum and any attribution requirements here. Do not redistribute assets until licence terms are clear.

## NASA references

- [NASA 3D Resources](https://science.nasa.gov/3d-resources/)
- [NASA Eyes](https://science.nasa.gov/eyes/)
- [NASA Solar System Treks](https://trek.nasa.gov/)

These resources are references; they are not proof that an asset in this release came from NASA.
