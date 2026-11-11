export type Planet = 'earth' | 'moon' | 'mars';
export type GraphicsQuality = 'low' | 'medium' | 'high';
export type CameraMode = 'overview' | 'habitat' | 'rover' | 'horizon';

export interface Interactable { id: string; title: string; description: string }

export interface BabylonWorld {
  setPlanet(planet: Planet): void;
  setPaused(paused: boolean): void;
  setGraphicsQuality(quality: GraphicsQuality): void;
  setReducedMotion(reduced: boolean): void;
  setCameraMode(mode: CameraMode): void;
  deployRover(): void;
  driveRover(direction: number): void;
  playJourney(destination: Planet, onComplete?: () => void): void;
  destroy(): void;
  readonly rendererName: string;
}

interface WorldOptions {
  baseUrl: string;
  quality: GraphicsQuality;
  reducedMotion: boolean;
}

function loadBabylon(): Promise<any> {
  if (window.BABYLON) return Promise.resolve(window.BABYLON);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-babylon-runtime]');
    if (existing) {
      existing.addEventListener('load', () => window.BABYLON ? resolve(window.BABYLON) : reject(new Error('Babylon.js loaded without its runtime namespace.')), { once: true });
      existing.addEventListener('error', () => reject(new Error('The Babylon.js CDN could not be reached.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.babylonjs.com/babylon.js';
    script.async = true;
    script.dataset.babylonRuntime = 'true';
    script.crossOrigin = 'anonymous';
    script.onload = () => window.BABYLON ? resolve(window.BABYLON) : reject(new Error('Babylon.js loaded without its runtime namespace.'));
    script.onerror = () => reject(new Error('Babylon.js could not be downloaded. Check the network connection or CDN availability.'));
    document.head.append(script);
  });
}

function hash(x: number, z: number, seed = 1): number {
  const value = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

function smoothNoise(x: number, z: number, scale: number, seed: number): number {
  const sx = x / scale;
  const sz = z / scale;
  const ix = Math.floor(sx);
  const iz = Math.floor(sz);
  const fx = sx - ix;
  const fz = sz - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, seed);
  const b = hash(ix + 1, iz, seed);
  const c = hash(ix, iz + 1, seed);
  const d = hash(ix + 1, iz + 1, seed);
  const top = a + (b - a) * ux;
  const bottom = c + (d - c) * ux;
  return top + (bottom - top) * uz;
}

function terrainHeight(x: number, z: number, planet: Planet): number {
  if (planet === 'earth') return 0;
  const scale = planet === 'mars' ? 1 : 0.7;
  const broad = smoothNoise(x, z, 24, planet === 'mars' ? 4 : 8) * (planet === 'mars' ? 5.8 : 2.6);
  const medium = smoothNoise(x, z, 7.5, 13) * (planet === 'mars' ? 1.9 : 0.8);
  const fine = smoothNoise(x, z, 2.1, 19) * (planet === 'mars' ? 0.46 : 0.24);
  const ridge = Math.pow(Math.abs(smoothNoise(x, z, 13, 31) - 0.5) * 2, 1.5) * (planet === 'mars' ? 2.1 : 1.0);
  const craterCenters = planet === 'moon'
    ? [[-20, -9, 8, 2.5], [18, 14, 11, 3.1], [8, -25, 6, 1.6], [-31, 26, 5, 1.3]]
    : [[-26, 17, 7, 1.4], [23, -20, 10, 1.6], [8, 29, 5, 1.0]];
  let crater = 0;
  for (const [cx, cz, radius, depth] of craterCenters) {
    const distance = Math.hypot(x - cx, z - cz);
    const bowl = Math.max(0, 1 - (distance / radius) ** 2);
    const rim = Math.exp(-((distance - radius * 0.92) ** 2) / (radius * radius * 0.015));
    crater += -bowl * depth + rim * depth * 0.24;
  }
  return (broad + medium + fine + ridge * (planet === 'mars' ? 1 : 0.6) + crater) * scale - 2.1;
}

function makeTexture(B: any, scene: any, planet: Planet): any {
  const texture = new B.DynamicTexture(`${planet}-surface-texture`, { width: 512, height: 512 }, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  const palette = planet === 'mars'
    ? ['#9b4930', '#b65b3c', '#c87750', '#713c2e', '#d08a65', '#87432f']
    : ['#545452', '#666561', '#77756f', '#494844', '#89877f', '#5a5955'];
  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i += 1) {
    const x = hash(i, 4, planet === 'mars' ? 9 : 12) * 512;
    const y = hash(i, 8, 21) * 512;
    const radius = 0.5 + hash(i, 18, 11) * (planet === 'mars' ? 14 : 10);
    ctx.globalAlpha = 0.08 + hash(i, 21, 7) * 0.22;
    ctx.fillStyle = palette[Math.floor(hash(i, 12, 31) * palette.length)];
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.8, radius, hash(i, 33, 4) * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 90; i += 1) {
    const y = hash(i, 44, 5) * 512;
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = palette[3];
    ctx.lineWidth = 1 + hash(i, 9, 13) * 4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(160, y - 35, 350, y + 35, 512, y + (hash(i, 6, 2) - 0.5) * 80);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  texture.update(false);
  texture.wrapU = B.Texture.WRAP_ADDRESSMODE;
  texture.wrapV = B.Texture.WRAP_ADDRESSMODE;
  return texture;
}

function makeEarthTexture(B: any, scene: any): any {
  const texture = new B.DynamicTexture('earth-albedo', { width: 1024, height: 512 }, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  const ocean = ctx.createLinearGradient(0, 0, 1024, 512);
  ocean.addColorStop(0, '#154d78');
  ocean.addColorStop(0.5, '#237eaa');
  ocean.addColorStop(1, '#0b355d');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, 1024, 512);
  const continents = [
    [[120, 95], [190, 65], [260, 90], [278, 145], [238, 177], [210, 250], [170, 270], [150, 210], [112, 174]],
    [[280, 270], [340, 248], [375, 290], [360, 378], [330, 442], [295, 378], [270, 314]],
    [[470, 88], [530, 65], [585, 96], [622, 141], [585, 198], [545, 178], [510, 215], [468, 175]],
    [[550, 215], [608, 208], [640, 255], [627, 340], [580, 394], [548, 326], [528, 267]],
    [[690, 90], [760, 63], [840, 85], [892, 130], [870, 186], [795, 205], [736, 170]],
    [[815, 275], [880, 248], [928, 285], [910, 352], [855, 375], [820, 330]],
  ];
  continents.forEach((points, index) => {
    ctx.beginPath();
    points.forEach(([x, y], pointIndex) => pointIndex === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.closePath();
    ctx.fillStyle = index % 2 ? '#78936e' : '#8d9b70';
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#c9b98b';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
  for (let i = 0; i < 420; i += 1) {
    const x = hash(i, 7, 3) * 1024;
    const y = hash(i, 19, 5) * 512;
    const r = 1 + hash(i, 3, 9) * 8;
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(x, y, r * 2.5, r * 0.7, hash(i, 11, 2), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  texture.update(false);
  return texture;
}

function material(B: any, scene: any, name: string, color: string, roughness = 0.88, metallic = 0.02): any {
  const mat = new B.PBRMaterial(name, scene);
  mat.albedoColor = B.Color3.FromHexString(color);
  mat.roughness = roughness;
  mat.metallic = metallic;
  return mat;
}

function createStars(B: any, scene: any): void {
  const starMaterial = new B.StandardMaterial('star-mat', scene);
  starMaterial.emissiveColor = new B.Color3(0.82, 0.88, 1);
  const seed = B.MeshBuilder.CreateSphere('star-seed', { diameter: 0.085, segments: 4 }, scene);
  seed.material = starMaterial;
  seed.position.set(1000, 1000, 1000);
  for (let i = 0; i < 260; i += 1) {
    const star = seed.createInstance(`star-${i}`);
    const theta = hash(i, 3, 9) * Math.PI * 2;
    const phi = Math.acos(2 * hash(i, 11, 4) - 1);
    const radius = 115 + hash(i, 8, 3) * 35;
    star.position.set(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
    const size = 0.45 + hash(i, 14, 5) * 1.5;
    star.scaling.setAll(size);
  }
}

function createTerrain(B: any, scene: any, planet: Planet, baseUrl: string, quality: GraphicsQuality): any {
  const size = planet === 'mars' ? 180 : 150;
  const segments = quality === 'low' ? 72 : quality === 'medium' ? 112 : 156;
  const positions: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const colorA = planet === 'mars' ? new B.Color3(0.70, 0.36, 0.24) : new B.Color3(0.39, 0.39, 0.38);
  const colorB = planet === 'mars' ? new B.Color3(0.43, 0.22, 0.16) : new B.Color3(0.23, 0.23, 0.23);
  for (let z = 0; z <= segments; z += 1) {
    for (let x = 0; x <= segments; x += 1) {
      const wx = (x / segments - 0.5) * size;
      const wz = (z / segments - 0.5) * size;
      const height = terrainHeight(wx, wz, planet);
      positions.push(wx, height, wz);
      uvs.push(x / segments * 12, z / segments * 12);
      const shade = Math.min(1, Math.max(0, 0.52 + height * 0.035 + hash(x, z, 17) * 0.08));
      const color = B.Color3.Lerp(colorB, colorA, shade);
      colors.push(color.r, color.g, color.b, 1);
      if (x < segments && z < segments) {
        const current = z * (segments + 1) + x;
        const next = current + segments + 1;
        indices.push(current, next, current + 1, current + 1, next, next + 1);
      }
    }
  }
  const mesh = new B.Mesh(`${planet}-terrain`, scene);
  const vertexData = new B.VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.uvs = uvs;
  vertexData.colors = colors;
  const normals: number[] = [];
  B.VertexData.ComputeNormals(positions, indices, normals);
  vertexData.normals = normals;
  vertexData.applyToMesh(mesh, true);
  const ground = new B.PBRMaterial(`${planet}-regolith`, scene);
  ground.albedoColor = B.Color3.White();
  ground.roughness = 1;
  ground.useVertexColors = true;
  ground.useVertexAlpha = false;
  ground.bumpTexture = null;
  if (planet === 'moon') {
    const albedo = new B.Texture(`${baseUrl}assets/terrain/south-pole-regolith-albedo.jpg`, scene, true, false, B.Texture.TRILINEAR_SAMPLINGMODE, undefined, () => undefined);
    albedo.uScale = 7;
    albedo.vScale = 7;
    ground.albedoTexture = albedo;
  } else {
    const texture = makeTexture(B, scene, planet);
    texture.uScale = 8;
    texture.vScale = 8;
    ground.albedoTexture = texture;
  }
  mesh.material = ground;
  mesh.receiveShadows = true;
  return mesh;
}

function createRock(B: any, scene: any, x: number, z: number, scale: number, color: string, index: number): any {
  const rock = B.MeshBuilder.CreatePolyhedron(`regolith-rock-${index}`, { type: index % 3 === 0 ? 2 : 1, size: 1 }, scene);
  rock.position.set(x, terrainHeight(x, z, 'mars') + scale * 0.25 - 1.7, z);
  rock.scaling.set(scale * (0.8 + hash(index, 3) * 0.9), scale * (0.45 + hash(index, 7) * 0.65), scale * (0.75 + hash(index, 13) * 0.8));
  rock.rotation.set(hash(index, 18) * 0.3, hash(index, 21) * Math.PI, hash(index, 33) * 0.25);
  rock.material = material(B, scene, `rock-mat-${index}`, color, 1);
  rock.receiveShadows = true;
  return rock;
}

function addCrater(B: any, scene: any, x: number, z: number, radius: number, planet: Planet): void {
  const ring = B.MeshBuilder.CreateTorus(`crater-rim-${x}-${z}`, { diameter: radius * 2, thickness: Math.max(0.5, radius * 0.11), tessellation: 64 }, scene);
  ring.position.set(x, terrainHeight(x, z, planet) + 0.25, z);
  ring.rotation.x = Math.PI / 2;
  ring.material = material(B, scene, `crater-rim-mat-${x}`, planet === 'moon' ? '#797771' : '#9c5038', 1);
  ring.scaling.z = 0.88;
}

function createHabitat(B: any, scene: any, x: number, z: number, label: string, mars = true): any {
  const root = new B.TransformNode(`${label}-habitat-root`, scene);
  root.position.set(x, terrainHeight(x, z, mars ? 'mars' : 'moon') - 1.1, z);
  const shell = material(B, scene, `${label}-shell`, mars ? '#e8d4b8' : '#c8c8c3', 0.62, 0.12);
  const dark = material(B, scene, `${label}-structure`, '#59616a', 0.48, 0.58);
  const glass = material(B, scene, `${label}-glass`, '#5a98a7', 0.24, 0.22);
  glass.alpha = 0.56;
  const body = B.MeshBuilder.CreateCapsule(`${label}-pressure-module`, { height: 8.5, radius: 2.05, tessellation: 32, subdivisions: 8 }, scene);
  body.rotation.z = Math.PI / 2;
  body.position.y = 2.1;
  body.scaling.z = 0.82;
  body.material = shell;
  body.parent = root;
  const centralRing = B.MeshBuilder.CreateTorus(`${label}-airlock-ring`, { diameter: 4.1, thickness: 0.28, tessellation: 48 }, scene);
  centralRing.rotation.z = Math.PI / 2;
  centralRing.position.set(0, 2.1, 0);
  centralRing.material = dark;
  centralRing.parent = root;
  const domeBase = B.MeshBuilder.CreateCylinder(`${label}-greenhouse-base`, { height: 0.48, diameter: 5.3, tessellation: 48 }, scene);
  domeBase.position.set(5.2, 0.25, 0.4);
  domeBase.material = dark;
  domeBase.parent = root;
  const dome = B.MeshBuilder.CreateSphere(`${label}-greenhouse-dome`, { diameter: 5.2, segments: 32 }, scene);
  dome.scaling.y = 0.62;
  dome.position.set(5.2, 1.6, 0.4);
  dome.material = glass;
  dome.parent = root;
  const airlock = B.MeshBuilder.CreateCylinder(`${label}-airlock`, { height: 2.8, diameter: 1.8, tessellation: 24 }, scene);
  airlock.rotation.z = Math.PI / 2;
  airlock.position.set(-5.4, 1.6, 0);
  airlock.material = dark;
  airlock.parent = root;
  const windowMat = new B.StandardMaterial(`${label}-window-light`, scene);
  windowMat.emissiveColor = new B.Color3(0.8, 0.5, 0.22);
  windowMat.disableLighting = true;
  for (let i = 0; i < 5; i += 1) {
    const windowMesh = B.MeshBuilder.CreateSphere(`${label}-window-${i}`, { diameter: 0.25, segments: 12 }, scene);
    windowMesh.position.set(-2.7 + i * 1.3, 2.45, -1.73);
    windowMesh.scaling.y = 0.55;
    windowMesh.material = windowMat;
    windowMesh.parent = root;
  }
  return root;
}

function createSolarArray(B: any, scene: any, x: number, z: number, label: string, planet: Planet = 'mars'): any {
  const root = new B.TransformNode(`${label}-solar-array`, scene);
  root.position.set(x, terrainHeight(x, z, planet) + 0.2, z);
  const frame = material(B, scene, `${label}-frame`, '#3a4650', 0.38, 0.72);
  const panel = material(B, scene, `${label}-panel`, '#214e70', 0.25, 0.38);
  panel.emissiveColor = new B.Color3(0.025, 0.06, 0.12);
  const post = B.MeshBuilder.CreateCylinder(`${label}-post`, { height: 3.4, diameter: 0.22 }, scene);
  post.position.y = 1.7;
  post.material = frame;
  post.parent = root;
  const cross = B.MeshBuilder.CreateBox(`${label}-crossbeam`, { width: 11, height: 0.18, depth: 0.18 }, scene);
  cross.position.y = 2.9;
  cross.material = frame;
  cross.parent = root;
  for (let side = -1; side <= 1; side += 2) {
    const panelMesh = B.MeshBuilder.CreateBox(`${label}-panel-${side}`, { width: 4.8, height: 0.08, depth: 3.2 }, scene);
    panelMesh.position.set(side * 3.5, 3.1, 0);
    panelMesh.rotation.x = -0.18;
    panelMesh.material = panel;
    panelMesh.parent = root;
    for (let line = -2; line <= 2; line += 1) {
      const grid = B.MeshBuilder.CreateBox(`${label}-grid-${side}-${line}`, { width: 0.035, height: 0.1, depth: 3.2 }, scene);
      grid.position.set(side * 3.5 + line * 0.88, 3.16, 0);
      grid.material = frame;
      grid.parent = root;
    }
  }
  return root;
}

function createRover(B: any, scene: any, x: number, z: number, planet: Planet = 'mars'): { root: any; wheels: any[] } {
  const root = new B.TransformNode('expedition-rover', scene);
  root.position.set(x, terrainHeight(x, z, planet) + 0.55, z);
  const chassis = material(B, scene, 'rover-chassis', '#a9b3b7', 0.42, 0.5);
  const gold = material(B, scene, 'rover-gold', '#be8b50', 0.4, 0.55);
  const dark = material(B, scene, 'rover-carbon', '#313c45', 0.76, 0.25);
  const body = B.MeshBuilder.CreateBox('rover-pressure-body', { width: 4.5, height: 1.0, depth: 2.6 }, scene);
  body.position.y = 1.85;
  body.material = chassis;
  body.parent = root;
  const deck = B.MeshBuilder.CreateBox('rover-equipment-deck', { width: 3.7, height: 0.25, depth: 2.3 }, scene);
  deck.position.set(0, 2.48, 0);
  deck.material = gold;
  deck.parent = root;
  const mast = B.MeshBuilder.CreateCylinder('rover-camera-mast', { height: 2.4, diameter: 0.18 }, scene);
  mast.position.set(0.5, 3.7, 0.25);
  mast.material = dark;
  mast.parent = root;
  const camera = B.MeshBuilder.CreateSphere('rover-camera-head', { diameter: 0.78, segments: 20 }, scene);
  camera.position.set(0.5, 4.9, 0.25);
  camera.material = gold;
  camera.parent = root;
  const lensMat = new B.StandardMaterial('rover-lens', scene);
  lensMat.emissiveColor = new B.Color3(0.05, 0.35, 0.5);
  lensMat.disableLighting = true;
  const lens = B.MeshBuilder.CreateSphere('rover-lens', { diameter: 0.28 }, scene);
  lens.position.set(0.5, 4.9, -0.12);
  lens.material = lensMat;
  lens.parent = root;
  const wheels: any[] = [];
  for (const side of [-1, 1]) {
    for (const axle of [-1.65, 0, 1.65]) {
      const wheel = B.MeshBuilder.CreateCylinder(`rover-wheel-${side}-${axle}`, { height: 0.62, diameter: 1.55, tessellation: 32 }, scene);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(axle, 0.75, side * 1.48);
      wheel.material = dark;
      wheel.parent = root;
      wheels.push(wheel);
      const hub = B.MeshBuilder.CreateCylinder(`rover-hub-${side}-${axle}`, { height: 0.68, diameter: 0.46, tessellation: 20 }, scene);
      hub.rotation.z = Math.PI / 2;
      hub.position.copyFrom(wheel.position);
      hub.material = gold;
      hub.parent = root;
    }
  }
  const antenna = B.MeshBuilder.CreateCylinder('rover-radio-antenna', { height: 1.7, diameter: 0.07 }, scene);
  antenna.position.set(-1.65, 3.1, 0.65);
  antenna.material = gold;
  antenna.parent = root;
  return { root, wheels };
}

function createAstronaut(B: any, scene: any, x: number, z: number, index: number, planet: Planet = 'mars'): any {
  const root = new B.TransformNode(`astronaut-${index}`, scene);
  root.position.set(x, terrainHeight(x, z, planet) - 1.5, z);
  const suit = material(B, scene, `astronaut-suit-${index}`, '#eee5d5', 0.82, 0.04);
  const trim = material(B, scene, `astronaut-trim-${index}`, index % 2 ? '#bf7848' : '#526b7a', 0.55, 0.2);
  const visor = new B.PBRMaterial(`astronaut-visor-${index}`, scene);
  visor.albedoColor = new B.Color3(0.045, 0.105, 0.15);
  visor.metallic = 0.8;
  visor.roughness = 0.16;
  const torso = B.MeshBuilder.CreateCapsule(`astronaut-torso-${index}`, { height: 1.9, radius: 0.58, tessellation: 18 }, scene);
  torso.position.y = 1.8;
  torso.material = suit;
  torso.parent = root;
  const backpack = B.MeshBuilder.CreateBox(`astronaut-pack-${index}`, { width: 0.85, height: 1.25, depth: 0.5 }, scene);
  backpack.position.set(0, 1.9, 0.61);
  backpack.material = trim;
  backpack.parent = root;
  const helmet = B.MeshBuilder.CreateSphere(`astronaut-helmet-${index}`, { diameter: 1.05, segments: 24 }, scene);
  helmet.position.y = 3.12;
  helmet.material = suit;
  helmet.parent = root;
  const face = B.MeshBuilder.CreateSphere(`astronaut-visor-${index}`, { diameter: 0.78, segments: 24 }, scene);
  face.position.set(0, 3.12, -0.31);
  face.scaling.z = 0.42;
  face.material = visor;
  face.parent = root;
  const limb = (name: string, px: number, py: number, pz: number, sx: number, sy: number, sz: number): any => {
    const piece = B.MeshBuilder.CreateCapsule(`${name}-${index}`, { height: 1.18, radius: 0.22, tessellation: 12 }, scene);
    piece.position.set(px, py, pz);
    piece.scaling.set(sx, sy, sz);
    piece.material = suit;
    piece.parent = root;
    return piece;
  };
  const armL = limb('astronaut-arm-left', -0.72, 1.92, 0, 1, 0.82, 1);
  const armR = limb('astronaut-arm-right', 0.72, 1.92, 0, 1, 0.82, 1);
  const legL = limb('astronaut-leg-left', -0.32, 0.63, 0, 1, 0.78, 1);
  const legR = limb('astronaut-leg-right', 0.32, 0.63, 0, 1, 0.78, 1);
  const badge = B.MeshBuilder.CreateBox(`astronaut-chest-badge-${index}`, { width: 0.42, height: 0.35, depth: 0.06 }, scene);
  badge.position.set(0, 2.1, -0.54);
  badge.material = trim;
  badge.parent = root;
  return { root, limbs: [armL, armR, legL, legR] };
}

function createSpacecraft(B: any, scene: any, x: number, z: number): any {
  const root = new B.TransformNode('frontier-spacecraft', scene);
  root.position.set(x, 12, z);
  root.rotation.z = 0.13;
  const hull = material(B, scene, 'spacecraft-hull', '#d9d8d0', 0.38, 0.35);
  const dark = material(B, scene, 'spacecraft-thermal', '#3d4d5c', 0.58, 0.5);
  const orange = material(B, scene, 'spacecraft-markings', '#c16e43', 0.52, 0.18);
  const fuselage = B.MeshBuilder.CreateCylinder('spacecraft-fuselage', { height: 14, diameterTop: 1.65, diameterBottom: 2.35, tessellation: 48 }, scene);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.material = hull;
  fuselage.parent = root;
  const nose = B.MeshBuilder.CreateCylinder('spacecraft-nose', { height: 3.1, diameterTop: 0.05, diameterBottom: 1.66, tessellation: 40 }, scene);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = -8.4;
  nose.material = dark;
  nose.parent = root;
  const cockpit = B.MeshBuilder.CreateSphere('spacecraft-cockpit', { diameter: 2.35, segments: 24 }, scene);
  cockpit.position.set(0, 0.4, -4.4);
  cockpit.scaling.set(0.84, 0.68, 0.38);
  cockpit.material = dark;
  cockpit.parent = root;
  for (const side of [-1, 1]) {
    const wing = B.MeshBuilder.CreateBox(`spacecraft-wing-${side}`, { width: 5.8, height: 0.22, depth: 5.2 }, scene);
    wing.position.set(side * 3.3, 0, 1.3);
    wing.rotation.z = side * -0.13;
    wing.material = orange;
    wing.parent = root;
    const panel = B.MeshBuilder.CreateBox(`spacecraft-solar-wing-${side}`, { width: 5.5, height: 0.08, depth: 4.7 }, scene);
    panel.position.set(side * 3.3, 0.18, 1.3);
    panel.material = dark;
    panel.parent = root;
    for (let line = -2; line <= 2; line += 1) {
      const grid = B.MeshBuilder.CreateBox(`spacecraft-panel-grid-${side}-${line}`, { width: 0.045, height: 0.1, depth: 4.7 }, scene);
      grid.position.set(side * 3.3 + line * 0.92, 0.25, 1.3);
      grid.material = hull;
      grid.parent = root;
    }
  }
  for (let i = -1; i <= 1; i += 1) {
    const engine = B.MeshBuilder.CreateCylinder(`spacecraft-engine-${i}`, { height: 2.1, diameterTop: 0.6, diameterBottom: 1.2, tessellation: 24 }, scene);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(i * 0.85, 0, 7.25);
    engine.material = dark;
    engine.parent = root;
    const glow = new B.StandardMaterial(`engine-glow-${i}`, scene);
    glow.emissiveColor = new B.Color3(1, 0.32, 0.08);
    glow.disableLighting = true;
    const flame = B.MeshBuilder.CreateCylinder(`engine-flame-${i}`, { height: 3.2, diameterTop: 0.03, diameterBottom: 0.75, tessellation: 16 }, scene);
    flame.rotation.x = Math.PI / 2;
    flame.position.set(i * 0.85, 0, 9.5);
    flame.material = glow;
    flame.parent = root;
  }
  return root;
}

function addLunarEarth(B: any, scene: any): void {
  const earth = B.MeshBuilder.CreateSphere('earth-in-lunar-sky', { diameter: 12, segments: 48 }, scene);
  earth.position.set(-37, 30, 58);
  const earthMat = new B.PBRMaterial('earth-horizon-mat', scene);
  earthMat.albedoTexture = makeEarthTexture(B, scene);
  earthMat.roughness = 0.86;
  earth.material = earthMat;
  const halo = B.MeshBuilder.CreateSphere('earth-atmospheric-halo', { diameter: 12.8, segments: 40 }, scene);
  halo.position.copyFrom(earth.position);
  const haloMat = new B.StandardMaterial('earth-halo-mat', scene);
  haloMat.emissiveColor = new B.Color3(0.08, 0.33, 0.58);
  haloMat.alpha = 0.15;
  haloMat.backFaceCulling = false;
  halo.material = haloMat;
}

export async function createBabylonWorld(canvas: HTMLCanvasElement, options: WorldOptions): Promise<BabylonWorld> {
  const B = await loadBabylon();
  let engine: any;
  let rendererName = 'WebGL 2';
  if (B.WebGPUEngine && 'gpu' in navigator) {
    try {
      const candidate = new B.WebGPUEngine(canvas, { antialias: true, adaptToDeviceRatio: true });
      await candidate.initAsync();
      engine = candidate;
      rendererName = 'WebGPU';
    } catch {
      engine = undefined;
    }
  }
  if (!engine) engine = new B.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, adaptToDeviceRatio: true });
  let quality = options.quality;
  let reducedMotion = options.reducedMotion;
  let paused = true;
  let planet: Planet = 'mars';
  let scene: any;
  let camera: any;
  let roverRoot: any;
  let roverWheels: any[] = [];
  let roverTargetX = 0;
  let roverMoving = false;
  let roverDeployed = false;
  let astronautRoots: any[] = [];
  let spacecraftRoot: any;
  let journeyActive = false;
  let journeyElapsed = 0;
  let journeyDestination: Planet = 'mars';
  let journeyCallback: (() => void) | undefined;
  let animationTime = 0;

  const rebuildScene = (destination: Planet): void => {
    if (scene) scene.dispose();
    planet = destination;
    scene = new B.Scene(engine);
    scene.clearColor = destination === 'earth'
      ? new B.Color4(0.025, 0.09, 0.16, 1)
      : destination === 'mars'
        ? new B.Color4(0.72, 0.52, 0.39, 1)
        : new B.Color4(0.23, 0.24, 0.25, 1);
    scene.fogMode = B.Scene.FOGMODE_EXP2;
    scene.fogDensity = destination === 'mars' ? 0.0032 : destination === 'moon' ? 0.001 : 0;
    scene.fogColor = destination === 'mars' ? new B.Color3(0.72, 0.52, 0.39) : new B.Color3(0.2, 0.22, 0.24);
    camera = new B.ArcRotateCamera('frontier-camera', -Math.PI / 2.25, 1.12, destination === 'earth' ? 38 : 49, new B.Vector3(0, 1, 0), scene);
    camera.lowerRadiusLimit = 10;
    camera.upperRadiusLimit = 100;
    camera.wheelPrecision = 28;
    camera.panningSensibility = 75;
    camera.inertia = 0.84;
    camera.attachControl(canvas, true);
    camera.inputs.attached.pointers.buttons = [0, 1, 2];
    const hemi = new B.HemisphericLight('ambient-sky', new B.Vector3(0, 1, 0), scene);
    hemi.intensity = destination === 'moon' ? 0.34 : 0.78;
    hemi.groundColor = destination === 'mars' ? new B.Color3(0.22, 0.13, 0.1) : new B.Color3(0.16, 0.17, 0.2);
    const sun = new B.DirectionalLight('solar-key', new B.Vector3(-0.55, -1, 0.44), scene);
    sun.position = new B.Vector3(45, 70, -40);
    sun.intensity = destination === 'moon' ? 2.45 : 1.8;
    sun.shadowEnabled = false;
    createStars(B, scene);
    roverRoot = undefined;
    roverWheels = [];
    roverDeployed = false;
    astronautRoots = [];
    spacecraftRoot = undefined;

    if (destination === 'earth') {
      const earth = B.MeshBuilder.CreateSphere('planet-earth', { diameter: 27, segments: 80 }, scene);
      earth.position.set(0, 0, 0);
      const earthMat = material(B, scene, 'planet-earth-mat', '#ffffff', 0.65, 0.08);
      earthMat.albedoTexture = makeEarthTexture(B, scene);
      earth.material = earthMat;
      const clouds = B.MeshBuilder.CreateSphere('earth-cloud-shell', { diameter: 27.45, segments: 64 }, scene);
      const cloudMat = new B.StandardMaterial('earth-cloud-mat', scene);
      cloudMat.diffuseColor = new B.Color3(0.8, 0.9, 0.96);
      cloudMat.alpha = 0.11;
      cloudMat.backFaceCulling = false;
      clouds.material = cloudMat;
      const atmosphere = B.MeshBuilder.CreateSphere('earth-atmosphere', { diameter: 28.15, segments: 64 }, scene);
      const atmosphereMat = new B.StandardMaterial('earth-atmosphere-mat', scene);
      atmosphereMat.emissiveColor = new B.Color3(0.06, 0.32, 0.72);
      atmosphereMat.alpha = 0.1;
      atmosphereMat.backFaceCulling = false;
      atmosphere.material = atmosphereMat;
      camera.setTarget(B.Vector3.Zero());
      camera.radius = 44;
      const orbital = B.MeshBuilder.CreateTorus('orbital-path', { diameter: 36, thickness: 0.05, tessellation: 160 }, scene);
      orbital.rotation.x = Math.PI / 2.8;
      orbital.material = material(B, scene, 'orbit-line', '#a9c8d4', 0.7, 0.1);
      const moonTarget = B.MeshBuilder.CreateSphere('journey-target-moon', { diameter: 8, segments: 32 }, scene);
      moonTarget.position.set(-55, -14, -28);
      moonTarget.material = material(B, scene, 'journey-target-moon-mat', '#a4a29a', 1);
      const marsTarget = B.MeshBuilder.CreateSphere('journey-target-mars', { diameter: 14, segments: 48 }, scene);
      marsTarget.position.set(-76, 16, 34);
      marsTarget.material = material(B, scene, 'journey-target-mars-mat', '#b85f43', 1);
      const marsHaze = B.MeshBuilder.CreateSphere('journey-target-mars-haze', { diameter: 14.8, segments: 32 }, scene);
      marsHaze.position.copyFrom(marsTarget.position);
      const marsHazeMat = new B.StandardMaterial('journey-target-mars-haze-mat', scene);
      marsHazeMat.emissiveColor = new B.Color3(0.55, 0.18, 0.1);
      marsHazeMat.alpha = 0.12;
      marsHazeMat.backFaceCulling = false;
      marsHaze.material = marsHazeMat;
      spacecraftRoot = createSpacecraft(B, scene, 26, -10);
      spacecraftRoot.position.set(24, 12, -4);
      const station = B.MeshBuilder.CreateCylinder('orbital-station-core', { height: 3.2, diameter: 1.8, tessellation: 24 }, scene);
      station.position.set(-25, 4, 2);
      station.material = material(B, scene, 'station-shell', '#d9ddd8', 0.4, 0.55);
      const array = B.MeshBuilder.CreateBox('station-array', { width: 22, height: 0.12, depth: 2.3 }, scene);
      array.position.set(-25, 4, 2);
      array.material = material(B, scene, 'station-array-mat', '#244f70', 0.22, 0.38);
    } else {
      createTerrain(B, scene, destination, options.baseUrl, quality);
      const isMars = destination === 'mars';
      if (isMars) {
        const rockColors = ['#6f392b', '#a4563a', '#7d4432', '#c07551', '#63392e'];
        for (let i = 0; i < (quality === 'low' ? 42 : quality === 'medium' ? 88 : 150); i += 1) {
          let x = (hash(i, 4, 3) - 0.5) * 152;
          let z = (hash(i, 9, 7) - 0.5) * 136;
          if (Math.abs(x) < 20 && Math.abs(z) < 17) x += x < 0 ? -22 : 22;
          createRock(B, scene, x, z, 0.6 + hash(i, 21, 4) * 3.4, rockColors[i % rockColors.length], i);
        }
        for (let i = 0; i < 6; i += 1) addCrater(B, scene, -48 + i * 21, 44 - (i % 2) * 21, 4.4 + (i % 3) * 2.4, 'mars');
        createHabitat(B, scene, -7, 0, 'mars-primary', true);
        createHabitat(B, scene, 14, -8, 'mars-laboratory', true);
        createSolarArray(B, scene, -21, -15, 'mars-west-array');
        createSolarArray(B, scene, 25, 10, 'mars-east-array');
        roverRoot = createRover(B, scene, 14, 16).root;
        roverWheels = roverRoot.getChildMeshes(false).filter((mesh: any) => mesh.name.startsWith('rover-wheel'));
        astronautRoots = [createAstronaut(B, scene, -2, 8, 1), createAstronaut(B, scene, 3, 9, 2), createAstronaut(B, scene, -14, -4, 3)];
        spacecraftRoot = createSpacecraft(B, scene, 46, -31);
        spacecraftRoot.position.set(42, 8, -32);
      } else {
        for (let i = 0; i < (quality === 'low' ? 32 : 76); i += 1) {
          const x = (hash(i, 4, 7) - 0.5) * 140;
          const z = (hash(i, 9, 3) - 0.5) * 130;
          const rock = B.MeshBuilder.CreatePolyhedron(`lunar-boulder-${i}`, { type: 2, size: 1 }, scene);
          rock.position.set(x, terrainHeight(x, z, 'moon') - 1.3, z);
          const s = 0.4 + hash(i, 17, 5) * 3.1;
          rock.scaling.set(s * 1.4, s * 0.8, s);
          rock.rotation.set(hash(i, 3, 1) * 0.4, hash(i, 4, 6) * 6, 0.2);
          rock.material = material(B, scene, `lunar-boulder-mat-${i}`, '#76746e', 1);
        }
        addCrater(B, scene, -25, -18, 12, 'moon');
        addCrater(B, scene, 33, 18, 9, 'moon');
        addCrater(B, scene, 16, -35, 6, 'moon');
        createHabitat(B, scene, -4, 1, 'lunar-polar', false);
        createSolarArray(B, scene, -24, -18, 'lunar-array', 'moon');
        roverRoot = createRover(B, scene, 15, 15, 'moon').root;
        roverWheels = roverRoot.getChildMeshes(false).filter((mesh: any) => mesh.name.startsWith('rover-wheel'));
        astronautRoots = [createAstronaut(B, scene, -1, 9, 1, 'moon'), createAstronaut(B, scene, 4, 9, 2, 'moon')];
        addLunarEarth(B, scene);
        spacecraftRoot = createSpacecraft(B, scene, 43, -24);
        spacecraftRoot.position.set(38, 10, -27);
      }
      camera.setTarget(new B.Vector3(0, 2, 0));
      camera.radius = isMars ? 55 : 50;
    }
    scene.onBeforeRenderObservable.add(() => {
      if (paused || reducedMotion) return;
      const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);
      animationTime += dt;
      if (destination === 'earth') {
        const cloudLayer = scene.getMeshByName('earth-cloud-shell');
        if (cloudLayer) cloudLayer.rotation.y += dt * 0.012;
        const globe = scene.getMeshByName('planet-earth');
        if (globe) globe.rotation.y += dt * 0.006;
      }
      astronautRoots.forEach((astronaut, index) => {
        astronaut.root.position.y += Math.sin(animationTime * 2.1 + index) * 0.0018;
        astronaut.limbs[0].rotation.z = Math.sin(animationTime * 1.3 + index) * 0.06;
        astronaut.limbs[1].rotation.z = -Math.sin(animationTime * 1.3 + index) * 0.06;
      });
      if (roverMoving && roverRoot) {
        const direction = Math.sign(roverTargetX - roverRoot.position.x);
        roverRoot.position.x += direction * dt * 3.4;
        roverWheels.forEach((wheel) => { wheel.rotation.x += direction * dt * 1.4; });
        if (Math.abs(roverTargetX - roverRoot.position.x) < 0.35) {
          roverRoot.position.x = roverTargetX;
          roverMoving = false;
        }
      }
      if (journeyActive && spacecraftRoot) {
        journeyElapsed += dt;
        const progress = Math.min(1, journeyElapsed / 7.5);
        const eased = progress * progress * (3 - 2 * progress);
        const destinationPosition = journeyDestination === 'mars'
          ? { x: -76, y: 16, z: 34 }
          : { x: -55, y: -14, z: -28 };
        spacecraftRoot.position.x = 24 + eased * (destinationPosition.x - 24);
        spacecraftRoot.position.y = 12 + eased * (destinationPosition.y - 12) + Math.sin(progress * Math.PI) * 18;
        spacecraftRoot.position.z = -4 + eased * (destinationPosition.z + 4);
        spacecraftRoot.rotation.z = 0.13 - Math.sin(progress * Math.PI) * 0.18;
        if (progress >= 1) {
          journeyActive = false;
          const completed = journeyDestination;
          rebuildScene(completed);
          journeyCallback?.();
        }
      }
    });
  };

  rebuildScene('mars');
  engine.runRenderLoop(() => {
    if (scene && !scene.isDisposed) scene.render();
  });
  const resizeHandler = (): void => engine.resize();
  window.addEventListener('resize', resizeHandler);

  return {
    get rendererName() { return rendererName; },
    setPlanet(destination: Planet) { journeyActive = false; rebuildScene(destination); },
    setPaused(value: boolean) { paused = value; },
    setGraphicsQuality(value: GraphicsQuality) {
      quality = value;
      const ratio = value === 'low' ? 0.72 : value === 'medium' ? 1 : 1.25;
      engine.setHardwareScalingLevel(1 / ratio);
      if (value === 'low' && planet !== 'earth') rebuildScene(planet);
    },
    setReducedMotion(value: boolean) { reducedMotion = value; },
    setCameraMode(mode: CameraMode) {
      if (!camera) return;
      const targets: Record<CameraMode, { alpha: number; beta: number; radius: number; target: any }> = {
        overview: { alpha: -Math.PI / 2.25, beta: 1.12, radius: planet === 'earth' ? 44 : 55, target: new B.Vector3(0, 2, 0) },
        habitat: { alpha: -Math.PI / 3, beta: 1.05, radius: 24, target: new B.Vector3(0, 2, 0) },
        rover: { alpha: -Math.PI / 2, beta: 1.25, radius: 17, target: roverRoot?.position ?? new B.Vector3(12, 1, 12) },
        horizon: { alpha: -Math.PI / 2.8, beta: 1.48, radius: 72, target: new B.Vector3(0, 0, 0) },
      };
      const target = targets[mode];
      camera.alpha = target.alpha;
      camera.beta = target.beta;
      camera.radius = target.radius;
      camera.setTarget(target.target);
    },
    deployRover() {
      if (!roverRoot) return;
      roverDeployed = true;
      roverRoot.setEnabled(true);
      roverTargetX = roverRoot.position.x + 16;
      roverMoving = true;
    },
    driveRover(direction: number) {
      if (!roverRoot || !roverDeployed) return;
      roverTargetX = Math.max(-55, Math.min(55, roverRoot.position.x + Math.sign(direction) * 9));
      roverMoving = true;
    },
    playJourney(destination: Planet, onComplete?: () => void) {
      if (destination === 'earth') { rebuildScene('earth'); onComplete?.(); return; }
      if (!spacecraftRoot) spacecraftRoot = createSpacecraft(B, scene, 42, -32);
      journeyDestination = destination;
      journeyElapsed = 0;
      journeyActive = true;
      journeyCallback = onComplete;
      paused = false;
      if (camera) { camera.radius = 110; camera.setTarget(new B.Vector3(-24, 1, 0)); }
    },
    destroy() {
      window.removeEventListener('resize', resizeHandler);
      engine.stopRenderLoop();
      scene?.dispose();
      engine.dispose();
    },
  };
}
