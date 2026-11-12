export type Planet = 'earth' | 'moon' | 'mars';
export type GraphicsQuality = 'low' | 'medium' | 'high';
export type CameraMode = 'overview' | 'habitat' | 'rover' | 'horizon';
export type SceneMode = 'solar' | 'rocket' | 'planetary';
export interface RocketConfiguration { crewCapsule: boolean; mainEngine: boolean; fuelTank: boolean; booster: boolean; landingLegs: boolean; sciencePayload: boolean; communications: boolean }

export interface Interactable { id: string; title: string; description: string }

export interface BabylonWorld {
  setPlanet(planet: Planet): void;
  setSceneMode(mode: SceneMode): void;
  focusCelestial(name: string): void;
  setRocketConfiguration(config: RocketConfiguration): void;
  launchRocket(destination: Planet, onComplete?: () => void): void;
  setPaused(paused: boolean): void;
  setGraphicsQuality(quality: GraphicsQuality): void;
  setReducedMotion(reduced: boolean): void;
  setCameraMode(mode: CameraMode): void;
  deployRover(): void;
  driveRover(direction: number): void;
  setPlayerControlled(enabled: boolean): void;
  setJoystick(x: number, y: number): void;
  jumpPlayer(): void;
  atSampleSite(): boolean;
  getNearbyInteractable(): Interactable | null;
  interactNearest(): Interactable | null;
  setVehicleMode(enabled: boolean): void;
  setVehicleInput(x: number, y: number): void;
  enterHabitat(): void;
  exitHabitat(): void;
  focusStation(id: string): void;
  activateStation(id: string): void;
  playJourney(destination: Planet, onComplete?: () => void): void;
  destroy(): void;
  readonly rendererName: string;
}

interface WorldOptions {
  baseUrl: string;
  quality: GraphicsQuality;
  reducedMotion: boolean;
  initialMode?: SceneMode;
  rocketConfiguration?: RocketConfiguration;
  preferWebGPU?: boolean;
}

async function loadBabylon(): Promise<any> {
  // Split the 3D engine into its own chunk so the app shell and controls render first.
  // @ts-ignore -- Installed from the pinned package during npm ci.
  const module = await import('@babylonjs/core/Legacy/legacy');
  return module as any;
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

function createStars(B: any, scene: any, quality: GraphicsQuality): void {
  const starMaterial = new B.StandardMaterial('star-mat', scene);
  starMaterial.emissiveColor = new B.Color3(0.82, 0.88, 1);
  const seed = B.MeshBuilder.CreateSphere('star-seed', { diameter: 0.085, segments: 4 }, scene);
  seed.material = starMaterial;
  seed.position.set(1000, 1000, 1000);
  const starCount = quality === 'low' ? 105 : quality === 'medium' ? 180 : 260;
  for (let i = 0; i < starCount; i += 1) {
    const star = seed.createInstance(`star-${i}`);
    const theta = hash(i, 3, 9) * Math.PI * 2;
    const phi = Math.acos(2 * hash(i, 11, 4) - 1);
    const radius = 220 + hash(i, 8, 3) * 90;
    star.position.set(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
    const size = 0.45 + hash(i, 14, 5) * 1.5;
    star.scaling.setAll(size);
  }
}

function createAtmosphericDust(B: any, scene: any, planet: Planet): any {
  if (planet !== 'mars') return null;
  const texture = new B.DynamicTexture('mars-dust-particle', { width: 64, height: 64 }, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  const gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
  gradient.addColorStop(0, 'rgba(255,224,199,0.85)');
  gradient.addColorStop(0.38, 'rgba(234,164,126,0.30)');
  gradient.addColorStop(1, 'rgba(234,164,126,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  texture.update(false);
  const dust = new B.ParticleSystem('mars-atmospheric-dust', 220, scene);
  dust.particleTexture = texture;
  dust.emitter = new B.Vector3(0, 2, 0);
  dust.minEmitBox = new B.Vector3(-78, 1.5, -74);
  dust.maxEmitBox = new B.Vector3(78, 17, 74);
  dust.color1 = new B.Color4(0.96, 0.68, 0.48, 0.34);
  dust.color2 = new B.Color4(0.72, 0.39, 0.27, 0.24);
  dust.colorDead = new B.Color4(0.55, 0.3, 0.22, 0);
  dust.minSize = 0.05;
  dust.maxSize = 0.34;
  dust.minLifeTime = 5;
  dust.maxLifeTime = 15;
  dust.emitRate = 26;
  dust.direction1 = new B.Vector3(-0.75, 0.04, -0.18);
  dust.direction2 = new B.Vector3(-0.12, 0.25, 0.3);
  dust.minEmitPower = 0.16;
  dust.maxEmitPower = 0.62;
  dust.updateSpeed = 0.012;
  dust.blendMode = B.ParticleSystem.BLENDMODE_STANDARD;
  dust.start();
  return dust;
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

function createSampleBeacon(B: any, scene: any, x: number, z: number, planet: Planet): any {
  const root = new B.TransformNode('science-sample-beacon', scene);
  root.position.set(x, terrainHeight(x, z, planet), z);
  const metal = material(B, scene, 'sample-beacon-metal', '#526c75', 0.4, 0.58);
  const glow = new B.StandardMaterial('sample-beacon-glow', scene);
  glow.emissiveColor = new B.Color3(0.16, 0.88, 0.82);
  glow.disableLighting = true;
  const base = B.MeshBuilder.CreateCylinder('sample-beacon-base', { height: 0.55, diameter: 1.8, tessellation: 24 }, scene);
  base.position.y = 0.28; base.material = metal; base.parent = root;
  const mast = B.MeshBuilder.CreateCylinder('sample-beacon-mast', { height: 3.8, diameter: 0.13, tessellation: 12 }, scene);
  mast.position.y = 2.25; mast.material = metal; mast.parent = root;
  const lamp = B.MeshBuilder.CreateSphere('sample-beacon-lamp', { diameter: 0.82, segments: 20 }, scene);
  lamp.position.y = 4.25; lamp.material = glow; lamp.parent = root;
  const ring = B.MeshBuilder.CreateTorus('sample-beacon-ring', { diameter: 4.5, thickness: 0.12, tessellation: 48 }, scene);
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.12; ring.material = glow; ring.parent = root;
  const halo = B.MeshBuilder.CreateTorus('sample-beacon-halo', { diameter: 2.1, thickness: 0.07, tessellation: 40 }, scene);
  halo.rotation.x = Math.PI / 2; halo.position.y = 4.25; halo.material = glow; halo.parent = root;
  return root;
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
  root.position.set(x, terrainHeight(x, z, planet) + 0.12, z);
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
  for (const side of [-1, 1]) {
    const boot = B.MeshBuilder.CreateBox(`astronaut-boot-${index}-${side}`, { width: 0.56, height: 0.3, depth: 0.86 }, scene);
    boot.position.set(side * 0.32, 0.12, -0.16);
    boot.material = trim;
    boot.parent = root;
    const glove = B.MeshBuilder.CreateSphere(`astronaut-glove-${index}-${side}`, { diameter: 0.52, segments: 14 }, scene);
    glove.position.set(side * 0.76, 1.26, -0.03);
    glove.material = trim;
    glove.parent = root;
    const shoulder = B.MeshBuilder.CreateSphere(`astronaut-shoulder-${index}-${side}`, { diameter: 0.68, segments: 16 }, scene);
    shoulder.position.set(side * 0.69, 2.33, 0);
    shoulder.scaling.y = 0.82;
    shoulder.material = suit;
    shoulder.parent = root;
  }
  const chestLightMat = new B.StandardMaterial(`astronaut-chest-light-${index}`, scene);
  chestLightMat.emissiveColor = new B.Color3(0.18, 0.72, 0.74);
  chestLightMat.disableLighting = true;
  const chestLight = B.MeshBuilder.CreateSphere(`astronaut-status-light-${index}`, { diameter: 0.12, segments: 12 }, scene);
  chestLight.position.set(0.19, 2.33, -0.58);
  chestLight.material = chestLightMat;
  chestLight.parent = root;
  const packTank = B.MeshBuilder.CreateCylinder(`astronaut-oxygen-tank-${index}`, { height: 0.9, diameter: 0.28, tessellation: 16 }, scene);
  packTank.rotation.z = Math.PI / 2;
  packTank.position.set(-0.18, 2.1, 0.91);
  packTank.material = trim;
  packTank.parent = root;
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


function createSolarSystem(B: any, scene: any, quality: GraphicsQuality): { bodies: Map<string, any>; pivots: Array<{ node: any; speed: number; mesh: any }> } {
  const bodies = new Map<string, any>();
  const pivots: Array<{ node: any; speed: number; mesh: any }> = [];
  const sun = B.MeshBuilder.CreateSphere('solar-sun', { diameter: 17, segments: quality === 'low' ? 24 : 48 }, scene);
  const sunMat = new B.StandardMaterial('solar-sun-material', scene);
  sunMat.emissiveColor = new B.Color3(1, 0.48, 0.12);
  sunMat.diffuseColor = new B.Color3(0.9, 0.33, 0.07);
  sunMat.disableLighting = true;
  sun.material = sunMat;
  const corona = B.MeshBuilder.CreateSphere('solar-sun-corona', { diameter: 19.5, segments: 32 }, scene);
  const coronaMat = new B.StandardMaterial('solar-sun-corona-material', scene);
  coronaMat.emissiveColor = new B.Color3(1, 0.28, 0.06);
  coronaMat.alpha = 0.18;
  coronaMat.backFaceCulling = false;
  corona.material = coronaMat;
  const sunlight = new B.PointLight('solar-system-star-light', B.Vector3.Zero(), scene);
  sunlight.diffuse = new B.Color3(1, 0.83, 0.64);
  sunlight.intensity = 2.4;
  sunlight.range = 280;
  if (quality !== 'low') try {
    const glow = new B.GlowLayer('solar-system-glow', scene, { blurKernelSize: quality === 'high' ? 48 : 24 });
    glow.intensity = quality === 'high' ? 0.58 : 0.44;
    glow.addIncludedOnlyMesh(sun);
    glow.addIncludedOnlyMesh(corona);
  } catch { /* The basic emissive sun remains visible if glow is unavailable. */ }

  const planets = [
    { id: 'mercury', label: 'Mercury', orbit: 20, size: 1.05, color: '#a99c8b', speed: 0.21 },
    { id: 'venus', label: 'Venus', orbit: 29, size: 1.8, color: '#d7ad79', speed: 0.15 },
    { id: 'earth', label: 'Earth', orbit: 41, size: 2.05, color: '#347fa8', speed: 0.105 },
    { id: 'mars', label: 'Mars', orbit: 54, size: 1.45, color: '#bc6444', speed: 0.082 },
    { id: 'jupiter', label: 'Jupiter', orbit: 76, size: 6.4, color: '#bd9d7c', speed: 0.047 },
    { id: 'saturn', label: 'Saturn', orbit: 101, size: 5.2, color: '#d4bb87', speed: 0.033 },
    { id: 'uranus', label: 'Uranus', orbit: 124, size: 3.3, color: '#83c2ca', speed: 0.024 },
    { id: 'neptune', label: 'Neptune', orbit: 145, size: 3.1, color: '#416cae', speed: 0.018 },
  ];
  const ringMaterial = new B.StandardMaterial('solar-orbit-line-material', scene);
  ringMaterial.emissiveColor = new B.Color3(0.19, 0.31, 0.43);
  ringMaterial.alpha = 0.32;
  ringMaterial.disableLighting = true;
  for (const definition of planets) {
    const orbit = B.MeshBuilder.CreateTorus(`${definition.id}-orbit`, { diameter: definition.orbit * 2, thickness: 0.045, tessellation: quality === 'low' ? 48 : quality === 'medium' ? 80 : 128 }, scene);
    orbit.rotation.x = Math.PI / 2;
    orbit.material = ringMaterial;
    const pivot = new B.TransformNode(`${definition.id}-orbital-pivot`, scene);
    const planetMesh = B.MeshBuilder.CreateSphere(`solar-planet-${definition.id}`, { diameter: definition.size, segments: quality === 'low' ? 16 : quality === 'medium' ? 24 : 40 }, scene);
    planetMesh.position.x = definition.orbit;
    planetMesh.parent = pivot;
    const planetMat = new B.StandardMaterial(`${definition.id}-material`, scene);
    planetMat.diffuseColor = B.Color3.FromHexString(definition.color);
    planetMat.specularColor = new B.Color3(0.18, 0.2, 0.24);
    planetMat.specularPower = 28;
    planetMesh.material = planetMat;
    if (definition.id === 'earth') {
      const cloud = B.MeshBuilder.CreateSphere('solar-earth-clouds', { diameter: definition.size * 1.035, segments: 24 }, scene);
      const cloudMat = new B.StandardMaterial('solar-earth-cloud-material', scene);
      cloudMat.diffuseColor = new B.Color3(0.86, 0.94, 1);
      cloudMat.alpha = 0.18;
      cloudMat.backFaceCulling = false;
      cloud.material = cloudMat;
      cloud.parent = planetMesh;
      cloud.position.setAll(0);
      const atmosphere = B.MeshBuilder.CreateSphere('solar-earth-atmosphere', { diameter: definition.size * 1.13, segments: 24 }, scene);
      const atmosphereMat = new B.StandardMaterial('solar-earth-atmosphere-material', scene);
      atmosphereMat.emissiveColor = new B.Color3(0.04, 0.34, 0.82);
      atmosphereMat.alpha = 0.13;
      atmosphereMat.backFaceCulling = false;
      atmosphere.material = atmosphereMat;
      atmosphere.parent = planetMesh;
      atmosphere.position.setAll(0);
      // Earth's moon follows the Earth in its own small orbit.
      const moonOrbit = B.MeshBuilder.CreateTorus('solar-moon-orbit', { diameter: 7.8, thickness: 0.025, tessellation: 64 }, scene);
      moonOrbit.parent = planetMesh;
      moonOrbit.rotation.x = Math.PI / 2;
      moonOrbit.material = ringMaterial;
      const moonPivot = new B.TransformNode('solar-moon-pivot', scene);
      moonPivot.parent = planetMesh;
      const moonMesh = B.MeshBuilder.CreateSphere('solar-planet-moon', { diameter: 0.62, segments: 16 }, scene);
      moonMesh.position.x = 3.8;
      moonMesh.parent = moonPivot;
      const moonMat = new B.StandardMaterial('solar-moon-material', scene);
      moonMat.diffuseColor = new B.Color3(0.62, 0.63, 0.6);
      moonMesh.material = moonMat;
      bodies.set('moon', moonMesh);
      pivots.push({ node: moonPivot, speed: 0.42, mesh: moonMesh });
      // A compact communications satellite, visibly orbiting Earth.
      const satellitePivot = new B.TransformNode('earth-communications-satellite-orbit', scene);
      satellitePivot.parent = planetMesh;
      const satellite = new B.TransformNode('earth-communications-satellite', scene);
      satellite.parent = satellitePivot;
      satellite.position.x = 5.3;
      const satelliteBody = B.MeshBuilder.CreateBox('earth-satellite-bus', { width: 0.8, height: 0.62, depth: 0.62 }, scene);
      satelliteBody.parent = satellite;
      satelliteBody.material = planetMat;
      for (const side of [-1, 1]) {
        const solarWing = B.MeshBuilder.CreateBox(`earth-satellite-wing-${side}`, { width: 1.9, height: 0.05, depth: 0.66 }, scene);
        solarWing.position.x = side * 1.25;
        solarWing.parent = satellite;
        const wingMat = new B.StandardMaterial(`earth-satellite-wing-material-${side}`, scene);
        wingMat.diffuseColor = new B.Color3(0.1, 0.3, 0.57);
        wingMat.emissiveColor = new B.Color3(0.015, 0.045, 0.085);
        solarWing.material = wingMat;
      }
      pivots.push({ node: satellitePivot, speed: 0.78, mesh: satellite });
    }
    if (definition.id === 'saturn') {
      const rings = B.MeshBuilder.CreateTorus('saturn-visible-rings', { diameter: definition.size * 2.05, thickness: 0.72, tessellation: 72 }, scene);
      rings.parent = planetMesh;
      rings.position.setAll(0);
      rings.rotation.x = 0.26;
      const ringsMat = new B.StandardMaterial('saturn-rings-material', scene);
      ringsMat.diffuseColor = new B.Color3(0.74, 0.63, 0.46);
      ringsMat.alpha = 0.76;
      rings.material = ringsMat;
    }
    bodies.set(definition.id, planetMesh);
    pivots.push({ node: pivot, speed: definition.speed, mesh: planetMesh });
  }

  // A loose, low-poly asteroid belt between Mars and Jupiter.
  const asteroidMat = new B.StandardMaterial('asteroid-belt-material', scene);
  asteroidMat.diffuseColor = new B.Color3(0.45, 0.42, 0.39);
  asteroidMat.roughness = 1;
  const seed = B.MeshBuilder.CreatePolyhedron('asteroid-belt-seed', { type: 2, size: 0.42 }, scene);
  seed.material = asteroidMat;
  seed.setEnabled(false);
  const asteroidCount = quality === 'low' ? 36 : quality === 'medium' ? 68 : 105;
  for (let i = 0; i < asteroidCount; i += 1) {
    const angle = hash(i, 6, 17) * Math.PI * 2;
    const radius = 64 + hash(i, 9, 14) * 6;
    const asteroid = seed.createInstance(`asteroid-${i}`);
    asteroid.position.set(Math.cos(angle) * radius, (hash(i, 3, 8) - 0.5) * 3.8, Math.sin(angle) * radius);
    const scale = 0.35 + hash(i, 5, 21) * 1.4;
    asteroid.scaling.set(scale * (0.7 + hash(i, 4, 6)), scale, scale * (0.8 + hash(i, 12, 4)));
    asteroid.rotation.set(hash(i, 14, 3), hash(i, 19, 4), hash(i, 2, 9));
  }

  // Small transfer craft on an orbit that crosses the inner planets.
  const shipPivot = new B.TransformNode('solar-transfer-ship-orbit', scene);
  const ship = B.MeshBuilder.CreateCapsule('solar-transfer-craft', { height: 5.4, radius: 0.68, tessellation: 16 }, scene);
  ship.parent = shipPivot;
  ship.position.set(46, 1.6, 0);
  ship.rotation.z = Math.PI / 2;
  const shipMat = new B.StandardMaterial('solar-transfer-craft-material', scene);
  shipMat.diffuseColor = new B.Color3(0.84, 0.86, 0.84);
  shipMat.emissiveColor = new B.Color3(0.05, 0.045, 0.035);
  ship.material = shipMat;
  const shipGlow = new B.PointLight('solar-transfer-craft-light', new B.Vector3(0, 0, -2), scene);
  shipGlow.parent = ship;
  shipGlow.intensity = 0.45;
  shipGlow.range = 12;
  pivots.push({ node: shipPivot, speed: 0.12, mesh: ship });

  const sunHalo = B.MeshBuilder.CreateTorus('solar-system-sun-halo', { diameter: 22, thickness: 0.07, tessellation: 96 }, scene);
  sunHalo.material = coronaMat;
  sunHalo.rotation.x = Math.PI / 2.3;
  return { bodies, pivots };
}

function createRocketWorkshop(B: any, scene: any, config: RocketConfiguration, quality: GraphicsQuality): { root: any; exhaust: any } {
  const floor = B.MeshBuilder.CreateGround('rocket-workshop-floor', { width: 150, height: 130, subdivisions: quality === 'low' ? 12 : 24 }, scene);
  floor.position.y = -0.4;
  floor.material = material(B, scene, 'rocket-workshop-floor-material', '#263744', 0.78, 0.22);
  const pad = B.MeshBuilder.CreateCylinder('rocket-launch-platform', { diameter: 22, height: 1.2, tessellation: 64 }, scene);
  pad.position.y = 0.2;
  pad.material = material(B, scene, 'rocket-launch-platform-material', '#71828a', 0.42, 0.62);
  const padTop = B.MeshBuilder.CreateCylinder('rocket-launch-platform-top', { diameter: 17.5, height: 0.12, tessellation: 64 }, scene);
  padTop.position.y = 0.86;
  padTop.material = material(B, scene, 'rocket-launch-platform-top-material', '#d5d4ca', 0.62, 0.22);
  const towerMat = material(B, scene, 'rocket-tower-material', '#71808a', 0.55, 0.55);
  const tower = new B.TransformNode('rocket-service-tower', scene);
  tower.position.set(10.5, 0, -1.5);
  for (const x of [-1.8, 1.8]) for (const z of [-1.8, 1.8]) {
    const leg = B.MeshBuilder.CreateBox(`rocket-tower-leg-${x}-${z}`, { width: 0.35, height: 31, depth: 0.35 }, scene);
    leg.position.set(x, 15.5, z); leg.material = towerMat; leg.parent = tower;
  }
  for (let level = 4; level <= 28; level += 4) {
    const beam = B.MeshBuilder.CreateBox(`rocket-tower-beam-${level}`, { width: 4, height: 0.24, depth: 4 }, scene);
    beam.position.y = level; beam.material = towerMat; beam.parent = tower;
  }
  const rocket = new B.TransformNode('customisable-expedition-rocket', scene);
  rocket.position.set(-1.5, 1.1, 0.3);
  const hull = material(B, scene, 'rocket-hull-material', '#e7e5db', 0.32, 0.42);
  const dark = material(B, scene, 'rocket-carbon-material', '#344552', 0.54, 0.58);
  const orange = material(B, scene, 'rocket-marking-material', '#cf7047', 0.44, 0.32);
  const stripe = material(B, scene, 'rocket-stripe-material', '#efb879', 0.47, 0.22);
  const core = B.MeshBuilder.CreateCylinder('rocket-main-stage', { height: 18, diameterTop: 2.05, diameterBottom: 2.45, tessellation: 48 }, scene);
  core.position.y = 11.8; core.material = hull; core.parent = rocket;
  if (config.fuelTank) {
    const tankBand = B.MeshBuilder.CreateCylinder('rocket-fuel-band', { height: 0.58, diameterTop: 2.08, diameterBottom: 2.32, tessellation: 48 }, scene);
    tankBand.position.y = 8.1; tankBand.material = orange; tankBand.parent = rocket;
    const tankLabel = B.MeshBuilder.CreateCylinder('rocket-fuel-label-band', { height: 0.16, diameter: 2.34, tessellation: 48 }, scene);
    tankLabel.position.y = 14.5; tankLabel.material = stripe; tankLabel.parent = rocket;
  }
  if (config.crewCapsule) {
    const capsule = B.MeshBuilder.CreateCylinder('rocket-crew-capsule', { height: 3.8, diameterTop: 0.12, diameterBottom: 2.0, tessellation: 48 }, scene);
    capsule.position.y = 22.4; capsule.material = dark; capsule.parent = rocket;
    const nose = B.MeshBuilder.CreateSphere('rocket-capsule-crown', { diameter: 1.72, segments: 24 }, scene);
    nose.position.y = 24.1; nose.scaling.y = 0.8; nose.material = orange; nose.parent = rocket;
    const porthole = B.MeshBuilder.CreateSphere('rocket-capsule-window', { diameter: 0.65, segments: 20 }, scene);
    porthole.position.set(0, 22.65, -0.86); porthole.scaling.z = 0.26; porthole.material = material(B, scene, 'rocket-window-material', '#5ca3bd', 0.16, 0.55); porthole.parent = rocket;
  }
  if (config.mainEngine) {
    const nozzle = B.MeshBuilder.CreateCylinder('rocket-main-nozzle', { height: 2.5, diameterTop: 0.88, diameterBottom: 1.55, tessellation: 32 }, scene);
    nozzle.position.y = 1.6; nozzle.material = dark; nozzle.parent = rocket;
    for (let i = -1; i <= 1; i += 1) {
      const engine = B.MeshBuilder.CreateCylinder(`rocket-engine-bell-${i}`, { height: 1.7, diameterTop: 0.38, diameterBottom: 0.68, tessellation: 24 }, scene);
      engine.position.set(i * 0.65, 0.4, 0); engine.material = dark; engine.parent = rocket;
    }
  }
  if (config.booster) for (const side of [-1, 1]) {
    const booster = B.MeshBuilder.CreateCylinder(`rocket-side-booster-${side}`, { height: 13.8, diameterTop: 0.68, diameterBottom: 0.92, tessellation: 32 }, scene);
    booster.position.set(side * 1.85, 8.7, 0); booster.material = hull; booster.parent = rocket;
    const boosterTip = B.MeshBuilder.CreateCylinder(`rocket-booster-nose-${side}`, { height: 1.45, diameterTop: 0, diameterBottom: 0.68, tessellation: 24 }, scene);
    boosterTip.position.set(side * 1.85, 16.3, 0); boosterTip.material = orange; boosterTip.parent = rocket;
    const boosterNozzle = B.MeshBuilder.CreateCylinder(`rocket-booster-nozzle-${side}`, { height: 1.25, diameterTop: 0.36, diameterBottom: 0.72, tessellation: 20 }, scene);
    boosterNozzle.position.set(side * 1.85, 1.15, 0); boosterNozzle.material = dark; boosterNozzle.parent = rocket;
  }
  for (let side = 0; side < 3; side += 1) {
    const fin = B.MeshBuilder.CreateBox(`rocket-fin-${side}`, { width: 0.2, height: 2.6, depth: 1.55 }, scene);
    const angle = side * (Math.PI * 2 / 3);
    fin.position.set(Math.sin(angle) * 1.05, 3.1, Math.cos(angle) * 1.05);
    fin.rotation.y = angle; fin.material = orange; fin.parent = rocket;
  }
  if (config.landingLegs) for (const side of [-1, 1]) {
    const leg = B.MeshBuilder.CreateCylinder(`rocket-landing-leg-${side}`, { height: 2.7, diameter: 0.12, tessellation: 12 }, scene);
    leg.position.set(side * 1.45, 1.4, 0.1); leg.rotation.z = side * -0.55; leg.material = dark; leg.parent = rocket;
    const foot = B.MeshBuilder.CreateBox(`rocket-landing-foot-${side}`, { width: 1.5, height: 0.12, depth: 0.68 }, scene);
    foot.position.set(side * 2.05, 0.2, 0.1); foot.material = orange; foot.parent = rocket;
  }
  if (config.sciencePayload) {
    const payload = B.MeshBuilder.CreateCylinder('rocket-science-payload', { height: 1.7, diameter: 1.1, tessellation: 24 }, scene);
    payload.position.set(1.3, 13.2, 0.4); payload.material = stripe; payload.parent = rocket;
  }
  if (config.communications) {
    const dish = B.MeshBuilder.CreateSphere('rocket-communications-dish', { diameter: 0.95, segments: 16 }, scene);
    dish.position.set(-1.3, 16.5, 0.1); dish.scaling.set(1, 0.3, 0.85); dish.material = stripe; dish.parent = rocket;
  }
  // Launch-service arms and safety lights make the workshop readable at a glance.
  const arm = B.MeshBuilder.CreateBox('rocket-service-arm', { width: 9, height: 0.52, depth: 0.52 }, scene);
  arm.position.set(7.1, 17.5, 0); arm.material = towerMat; arm.parent = tower;
  const beacon = B.MeshBuilder.CreateSphere('rocket-workshop-beacon', { diameter: 0.8 }, scene);
  beacon.position.set(10.5, 30.5, -1.5);
  const beaconMat = new B.StandardMaterial('rocket-workshop-beacon-material', scene);
  beaconMat.emissiveColor = new B.Color3(1, 0.24, 0.08); beaconMat.disableLighting = true; beacon.material = beaconMat;
  const exhaustTexture = new B.DynamicTexture('rocket-exhaust-texture', { width: 64, height: 64 }, scene, false);
  const ctx = exhaustTexture.getContext() as CanvasRenderingContext2D;
  const gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
  gradient.addColorStop(0, 'rgba(255,245,214,0.95)'); gradient.addColorStop(0.34, 'rgba(255,159,69,0.55)'); gradient.addColorStop(1, 'rgba(219,83,31,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64); exhaustTexture.update(false);
  const exhaust = new B.ParticleSystem('rocket-launch-exhaust', quality === 'low' ? 320 : 700, scene);
  exhaust.particleTexture = exhaustTexture;
  exhaust.emitter = new B.Vector3(-1.5, 1.15, 0.3);
  exhaust.minEmitBox = new B.Vector3(-1.25, -0.1, -1.1); exhaust.maxEmitBox = new B.Vector3(1.25, 0.2, 1.1);
  exhaust.color1 = new B.Color4(1, 0.77, 0.35, 0.9); exhaust.color2 = new B.Color4(0.95, 0.28, 0.06, 0.62); exhaust.colorDead = new B.Color4(0.25, 0.2, 0.18, 0);
  exhaust.minSize = 0.6; exhaust.maxSize = 2.7; exhaust.minLifeTime = 0.45; exhaust.maxLifeTime = 1.35; exhaust.emitRate = 0;
  exhaust.direction1 = new B.Vector3(-0.35, -1, -0.3); exhaust.direction2 = new B.Vector3(0.35, -1, 0.3); exhaust.minEmitPower = 2; exhaust.maxEmitPower = 7; exhaust.updateSpeed = 0.012;
  return { root: rocket, exhaust };
}

function createStationTerminal(B: any, scene: any, id: string, title: string, x: number, z: number, planet: Planet, color = '#d88a55', baseHeight?: number): void {
  const root = new B.TransformNode(`station-${id}`, scene);
  root.metadata = { title };
  const indoor = ['oxygen', 'power', 'water', 'greenhouse', 'science', 'shelter'].includes(id);
  root.position.set(x, baseHeight ?? (indoor ? 0.3 : terrainHeight(x, z, planet)), z);
  const frame = material(B, scene, `${id}-terminal-frame`, '#3d4d59', 0.44, 0.55);
  const shell = material(B, scene, `${id}-terminal-shell`, '#d8d4c8', 0.62, 0.12);
  const glow = new B.StandardMaterial(`${id}-terminal-glow`, scene);
  glow.emissiveColor = B.Color3.FromHexString(color);
  glow.disableLighting = true;
  const pedestal = B.MeshBuilder.CreateBox(`${id}-terminal-pedestal`, { width: 1.45, height: 1.55, depth: 0.72 }, scene);
  pedestal.position.y = 0.82; pedestal.material = frame; pedestal.parent = root;
  const screen = B.MeshBuilder.CreateBox(`${id}-terminal-screen`, { width: 1.22, height: 0.9, depth: 0.12 }, scene);
  screen.position.set(0, 1.72, -0.39); screen.material = shell; screen.parent = root;
  const status = B.MeshBuilder.CreateBox(`${id}-terminal-status`, { width: 0.62, height: 0.12, depth: 0.05 }, scene);
  status.position.set(0, 1.82, -0.47); status.material = glow; status.parent = root;
  const ring = B.MeshBuilder.CreateTorus(`${id}-station-ring`, { diameter: 2.45, thickness: 0.075, tessellation: 40 }, scene);
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.15; ring.material = glow; ring.parent = root;
}

function createHabitatInterior(B: any, scene: any, planet: Planet): void {
  const cx = 49;
  const cz = 58;
  const floorMat = material(B, scene, 'habitat-interior-floor', '#aeb8b6', 0.82, 0.08);
  const wallMat = material(B, scene, 'habitat-interior-wall', '#e4e2d7', 0.72, 0.06);
  const trimMat = material(B, scene, 'habitat-interior-trim', '#465766', 0.42, 0.5);
  const glassMat = material(B, scene, 'habitat-interior-glass', '#70b3c6', 0.2, 0.18);
  glassMat.alpha = 0.34;
  const floor = B.MeshBuilder.CreateBox('habitat-interior-floor', { width: 27, height: 0.35, depth: 23 }, scene);
  floor.position.set(cx, 0.05, cz); floor.material = floorMat;
  for (const [x, z, width, height, depth] of [
    [cx, cz - 11.4, 27, 5.2, 0.35], [cx, cz + 11.4, 27, 5.2, 0.35],
    [cx - 13.4, cz, 0.35, 5.2, 23], [cx + 13.4, cz, 0.35, 5.2, 23],
  ]) {
    const wall = B.MeshBuilder.CreateBox(`habitat-interior-wall-${x}-${z}`, { width, height, depth }, scene);
    wall.position.set(x, 2.65, z); wall.material = wallMat;
  }
  const ceiling = B.MeshBuilder.CreateBox('habitat-interior-ceiling', { width: 27, height: 0.35, depth: 23 }, scene);
  ceiling.position.set(cx, 5.25, cz); ceiling.material = trimMat;
  const ceilingLight = new B.PointLight('habitat-interior-light', new B.Vector3(cx, 4.6, cz), scene);
  ceilingLight.intensity = 0.9; ceilingLight.diffuse = new B.Color3(0.75, 0.86, 0.95); ceilingLight.range = 38;
  const window = B.MeshBuilder.CreateBox('habitat-interior-observation-window', { width: 8.4, height: 2.4, depth: 0.18 }, scene);
  window.position.set(cx, 3.1, cz - 11.12); window.material = glassMat;
  const consoleRow = (id: string, x: number, z: number, color: string): void => createStationTerminal(B, scene, id, id, x, z, planet, color);
  consoleRow('oxygen', cx - 8.4, cz - 4.5, '#4da5d0');
  consoleRow('power', cx, cz - 4.5, '#edb34e');
  consoleRow('water', cx + 8.4, cz - 4.5, '#53aeb9');
  consoleRow('greenhouse', cx - 8.4, cz + 6.2, '#82b875');
  consoleRow('science', cx + 8.4, cz + 6.2, '#9b8ed3');
  consoleRow('shelter', cx, cz + 6.2, '#c97873');
  // Raised crop beds and plant growth make the greenhouse a place, not just a menu.
  for (let i = 0; i < 5; i += 1) {
    const bed = B.MeshBuilder.CreateBox(`greenhouse-bed-${i}`, { width: 2.4, height: 0.42, depth: 1.3 }, scene);
    bed.position.set(cx - 1.2 + i * 1.2, 0.45, cz + 8.6); bed.material = material(B, scene, `greenhouse-bed-mat-${i}`, '#625344', 0.95);
    for (let j = 0; j < 3; j += 1) {
      const stem = B.MeshBuilder.CreateCylinder(`greenhouse-stem-${i}-${j}`, { height: 0.8 + (j % 2) * 0.25, diameter: 0.07 }, scene);
      stem.position.set(cx - 1.8 + i * 1.2 + j * 0.2, 0.9, cz + 8.25 + j * 0.32);
      stem.material = material(B, scene, `greenhouse-stem-mat-${i}-${j}`, '#4b8c57', 0.9);
    }
  }
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
  if (options.preferWebGPU && B.WebGPUEngine && 'gpu' in navigator) {
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
  let sceneMode: SceneMode = options.initialMode ?? 'solar';
  let rocketConfig: RocketConfiguration = { crewCapsule: true, mainEngine: true, fuelTank: true, booster: true, landingLegs: true, sciencePayload: true, communications: true, ...(options.rocketConfiguration ?? {}) };
  let rocketRoot: any = null;
  let rocketExhaust: any = null;
  let rocketLaunchActive = false;
  let rocketLaunchElapsed = 0;
  let rocketLaunchCallback: (() => void) | undefined;
  let solarBodies = new Map<string, any>();
  let solarPivots: Array<{ node: any; speed: number; mesh: any }> = [];
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
  let playerControlled = false;
  let vehicleMode = false;
  let insideHabitat = false;
  let jumpVelocity = 0;
  let sampleSitePosition: any = null;
  let sampleBeacon: any = null;
  let dustSystem: any = null;
  const solarArrayRoots: any[] = [];
  let shadowGenerator: any = null;
  let postPipeline: any = null;
  let joystickX = 0;
  let joystickY = 0;
  let vehicleX = 0;
  let vehicleY = 0;
  const pressedKeys = new Set<string>();
  let playerAstronaut: any = null;
  const stationRecords: Array<{ id: string; title: string; description: string; position: any; radius: number }> = [];
  let nearbyInteractable: Interactable | null = null;
  let activatedStationId = '';
  let activatedStationAt = 0;

  const rebuildScene = (destination: Planet): void => {
    if (dustSystem) { try { dustSystem.stop(); } catch { /* disposed with scene */ } dustSystem = null; }
    if (shadowGenerator) { try { shadowGenerator.dispose(); } catch { /* scene may already be disposed */ } shadowGenerator = null; }
    if (postPipeline) { try { postPipeline.dispose(); } catch { /* scene may already be disposed */ } postPipeline = null; }
    if (scene) scene.dispose();
    solarArrayRoots.length = 0;
    planet = destination;
    animationTime = 0;
    rocketLaunchActive = false;
    rocketLaunchElapsed = 0;
    rocketLaunchCallback = undefined;
    solarBodies = new Map<string, any>();
    solarPivots = [];
    rocketRoot = null;
    rocketExhaust = null;
    scene = new B.Scene(engine);
    scene.clearColor = sceneMode === 'solar'
      ? new B.Color4(0.012, 0.022, 0.052, 1)
      : sceneMode === 'rocket'
        ? new B.Color4(0.025, 0.055, 0.085, 1)
        : destination === 'earth'
          ? new B.Color4(0.025, 0.09, 0.16, 1)
          : destination === 'mars'
            ? new B.Color4(0.72, 0.52, 0.39, 1)
            : new B.Color4(0.23, 0.24, 0.25, 1);
    if (sceneMode === 'planetary') {
      scene.fogMode = B.Scene.FOGMODE_EXP2;
      scene.fogDensity = destination === 'mars' ? 0.0032 : destination === 'moon' ? 0.001 : 0;
      scene.fogColor = destination === 'mars' ? new B.Color3(0.72, 0.52, 0.39) : new B.Color3(0.2, 0.22, 0.24);
    } else {
      scene.fogMode = B.Scene.FOGMODE_NONE;
    }
    const initialRadius = sceneMode === 'solar' ? 184 : sceneMode === 'rocket' ? 47 : destination === 'earth' ? 38 : 49;
    camera = new B.ArcRotateCamera('frontier-camera', -Math.PI / 2.25, sceneMode === 'solar' ? 1.2 : 1.12, initialRadius, new B.Vector3(0, sceneMode === 'rocket' ? 12 : 1, 0), scene);
    camera.lowerRadiusLimit = sceneMode === 'solar' ? 28 : 9;
    camera.upperRadiusLimit = sceneMode === 'solar' ? 340 : 150;
    camera.wheelPrecision = sceneMode === 'solar' ? 19 : 28;
    camera.panningSensibility = 75;
    camera.inertia = 0.84;
    camera.attachControl(canvas, true);
    camera.inputs.attached.pointers.buttons = [0, 1, 2];
    const hemi = new B.HemisphericLight('ambient-sky', new B.Vector3(0, 1, 0), scene);
    hemi.intensity = sceneMode === 'solar' ? 0.44 : destination === 'moon' ? 0.34 : 0.78;
    hemi.groundColor = destination === 'mars' ? new B.Color3(0.22, 0.13, 0.1) : new B.Color3(0.16, 0.17, 0.2);
    const sun = new B.DirectionalLight('solar-key', new B.Vector3(-0.55, -1, 0.44), scene);
    sun.position = new B.Vector3(45, 70, -40);
    sun.intensity = sceneMode === 'solar' ? 0.55 : destination === 'moon' ? 2.45 : 1.8;
    sun.shadowEnabled = sceneMode === 'planetary' && quality !== 'low';
    createStars(B, scene, quality);
    dustSystem = createAtmosphericDust(B, scene, destination);
    roverRoot = undefined;
    roverWheels = [];
    roverDeployed = false;
    astronautRoots = [];
    playerAstronaut = null;
    stationRecords.length = 0;
    nearbyInteractable = null;
    vehicleMode = false;
    insideHabitat = false;
    jumpVelocity = 0;
    sampleSitePosition = null;
    sampleBeacon = null;
    spacecraftRoot = undefined;
    if (sceneMode === 'solar') {
      const solar = createSolarSystem(B, scene, quality);
      solarBodies = solar.bodies;
      solarPivots = solar.pivots;
      camera.setTarget(B.Vector3.Zero());
      camera.radius = 184;
    } else if (sceneMode === 'rocket') {
      const workshop = createRocketWorkshop(B, scene, rocketConfig, quality);
      rocketRoot = workshop.root;
      rocketExhaust = workshop.exhaust;
      camera.setTarget(new B.Vector3(-1, 13, 0));
      camera.alpha = -Math.PI / 2.3;
      camera.beta = 1.15;
      camera.radius = 47;
      // Make the rocket-service gantry and main vehicle visible in the first frame.
    } else if (destination === 'earth') {
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
      const orbitalPlatform = B.MeshBuilder.CreateCylinder('orbital-platform', { diameter: 13, height: 0.6, tessellation: 48 }, scene);
      orbitalPlatform.position.set(-25, 2.0, 2);
      orbitalPlatform.material = material(B, scene, 'orbital-platform-mat', '#6c7781', 0.5, 0.45);
      playerAstronaut = createAstronaut(B, scene, -22, 2, 0, 'earth');
      playerAstronaut.root.position.y = 2.34;
      astronautRoots.push(playerAstronaut);
      const flightConsole = B.MeshBuilder.CreateBox('orbital-flight-console', { width: 1.8, height: 1.65, depth: 0.8 }, scene);
      flightConsole.position.set(-25, 3.25, 7.2);
      flightConsole.material = material(B, scene, 'orbital-flight-console-mat', '#7b8b91', 0.35, 0.5);
      const flightScreen = B.MeshBuilder.CreateBox('orbital-flight-screen', { width: 1.35, height: 0.82, depth: 0.08 }, scene);
      flightScreen.position.set(-25, 3.55, 6.76);
      flightScreen.material = material(B, scene, 'orbital-flight-screen-mat', '#2e8aa5', 0.24, 0.22);
      flightScreen.material.emissiveColor = new B.Color3(0.03, 0.18, 0.28);
      stationRecords.push({ id: 'command', title: 'Orbital flight deck', description: 'Review expedition readiness and planetary navigation.', position: new B.Vector3(-25, 2.34, 5.6), radius: 6 });

      // The Earth-orbit onboarding area contains the same three systems the
      // player learns in the tutorial, so every Step 3 interaction is real.
      createStationTerminal(B, scene, 'oxygen', 'Oxygen', -29, 2, 'earth', '#54b8d8', 2.34);
      createStationTerminal(B, scene, 'power', 'Power', -25, -2, 'earth', '#efb64d', 2.34);
      createStationTerminal(B, scene, 'water', 'Water', -21, 2, 'earth', '#52b9b0', 2.34);
      stationRecords.push(
        { id: 'oxygen', title: 'Oxygen systems', description: 'Inspect atmospheric reserves and activate life support.', position: new B.Vector3(-29, 2.34, 2), radius: 3.4 },
        { id: 'power', title: 'Power systems', description: 'Inspect solar generation and orbital battery storage.', position: new B.Vector3(-25, 2.34, -2), radius: 3.4 },
        { id: 'water', title: 'Water recovery', description: 'Inspect and activate the water recovery unit.', position: new B.Vector3(-21, 2.34, 2), radius: 3.4 },
      );
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
        solarArrayRoots.push(createSolarArray(B, scene, -21, -15, 'mars-west-array'));
        solarArrayRoots.push(createSolarArray(B, scene, 25, 10, 'mars-east-array'));
        roverRoot = createRover(B, scene, 14, 16).root;
        sampleSitePosition = new B.Vector3(-31, terrainHeight(-31, 30, 'mars') + 0.3, 30);
        sampleBeacon = createSampleBeacon(B, scene, -31, 30, 'mars');
        roverWheels = roverRoot.getChildMeshes(false).filter((mesh: any) => mesh.name.startsWith('rover-wheel'));
        astronautRoots = [createAstronaut(B, scene, -4, 9, 1), createAstronaut(B, scene, 3, 9, 2), createAstronaut(B, scene, -14, -4, 3)];
        playerAstronaut = astronautRoots[0];
        createStationTerminal(B, scene, 'airlock-exterior', 'Airlock', -7, 0, 'mars', '#e6a269');
        createStationTerminal(B, scene, 'command-exterior', 'Command', -12, 7, 'mars', '#72a7cb');
        createHabitatInterior(B, scene, 'mars');
        stationRecords.push(
          { id: 'airlock', title: 'Enter habitat', description: 'Step inside Outpost 86.', position: new B.Vector3(-7, terrainHeight(-7, 0, 'mars'), 0), radius: 5.5 },
          { id: 'rover', title: 'Drive expedition rover', description: 'Enter the six-wheel rover and drive the ridge route.', position: new B.Vector3(14, terrainHeight(14, 16, 'mars'), 16), radius: 5.8 },
          { id: 'command', title: 'Mission command', description: 'Review the current mission and crew operations.', position: new B.Vector3(-12, terrainHeight(-12, 7, 'mars'), 7), radius: 5.5 },
          { id: 'shelter', title: 'Radiation shelter', description: 'Reach the shielded habitat during solar weather.', position: new B.Vector3(-3, terrainHeight(-3, 7, 'mars'), 7), radius: 4.5 },
          { id: 'oxygen', title: 'Oxygen & life support', description: 'Inspect oxygen supply and cabin air systems.', position: new B.Vector3(40.6, 0.3, 53.5), radius: 5.5 },
          { id: 'power', title: 'Power console', description: 'Balance solar generation, battery and system demand.', position: new B.Vector3(49, 0.3, 53.5), radius: 5.5 },
          { id: 'water', title: 'Water recovery', description: 'Repair the filter or conserve the water reserve.', position: new B.Vector3(57.4, 0.3, 53.5), radius: 5.5 },
          { id: 'greenhouse', title: 'Greenhouse', description: 'Grow crops and manage food production.', position: new B.Vector3(40.6, 0.3, 64.2), radius: 5.5 },
          { id: 'science', title: 'Science laboratory', description: 'Study geological samples and discoveries.', position: new B.Vector3(57.4, 0.3, 64.2), radius: 5.5 },
          { id: 'shelter', title: 'Radiation shelter', description: 'Secure the protected crew volume.', position: new B.Vector3(49, 0.3, 64.2), radius: 5.5 },
          { id: 'exit-habitat', title: 'Exit habitat', description: 'Return to the Martian surface.', position: new B.Vector3(49, 0.3, 47), radius: 5.5 },
        );
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
        astronautRoots = [createAstronaut(B, scene, -4, 9, 1, 'moon'), createAstronaut(B, scene, 4, 9, 2, 'moon')];
        playerAstronaut = astronautRoots[0];
        createStationTerminal(B, scene, 'lunar-airlock-exterior', 'Airlock', -7, 0, 'moon', '#e6a269');
        createHabitatInterior(B, scene, 'moon');
        stationRecords.push(
          { id: 'airlock', title: 'Enter lunar habitat', description: 'Step inside the lunar outpost.', position: new B.Vector3(-7, terrainHeight(-7, 0, 'moon'), 0), radius: 5.5 },
          { id: 'rover', title: 'Drive lunar rover', description: 'Enter the lunar surface vehicle.', position: new B.Vector3(15, terrainHeight(15, 15, 'moon'), 15), radius: 5.8 },
          { id: 'command', title: 'Mission command', description: 'Review the lunar mission.', position: new B.Vector3(-12, terrainHeight(-12, 7, 'moon'), 7), radius: 5.5 },
          { id: 'shelter', title: 'Radiation shelter', description: 'Reach the shielded habitat during solar weather.', position: new B.Vector3(-3, terrainHeight(-3, 7, 'moon'), 7), radius: 4.5 },
          { id: 'oxygen', title: 'Oxygen & life support', description: 'Inspect oxygen and cabin air.', position: new B.Vector3(40.6, 0.3, 53.5), radius: 5.5 },
          { id: 'power', title: 'Power console', description: 'Balance power demand and generation.', position: new B.Vector3(49, 0.3, 53.5), radius: 5.5 },
          { id: 'water', title: 'Water recovery', description: 'Repair or conserve water.', position: new B.Vector3(57.4, 0.3, 53.5), radius: 5.5 },
          { id: 'greenhouse', title: 'Greenhouse', description: 'Manage crop production.', position: new B.Vector3(40.6, 0.3, 64.2), radius: 5.5 },
          { id: 'science', title: 'Science laboratory', description: 'Collect and analyse a training sample.', position: new B.Vector3(57.4, 0.3, 64.2), radius: 5.5 },
          { id: 'shelter', title: 'Radiation shelter', description: 'Secure the protected crew volume.', position: new B.Vector3(49, 0.3, 64.2), radius: 5.5 },
          { id: 'exit-habitat', title: 'Exit habitat', description: 'Return to the lunar surface.', position: new B.Vector3(49, 0.3, 47), radius: 5.5 },
        );
        addLunarEarth(B, scene);
        spacecraftRoot = createSpacecraft(B, scene, 43, -24);
        spacecraftRoot.position.set(38, 10, -27);
      }
      camera.setTarget(new B.Vector3(0, 2, 0));
      camera.radius = isMars ? 55 : 50;
    }

    // Desktop-quality lighting with conservative mobile defaults.
    if (sceneMode === 'planetary' && quality !== 'low') {
      try {
        shadowGenerator = new B.ShadowGenerator(quality === 'high' ? 1536 : 1024, sun);
        shadowGenerator.useBlurExponentialShadowMap = true;
        shadowGenerator.blurKernel = quality === 'high' ? 20 : 12;
        shadowGenerator.bias = 0.00045;
        for (const mesh of scene.meshes) {
          if (/^(astronaut-|rover-|habitat-|mars-|lunar-)/.test(mesh.name) && mesh.isVisible) {
            shadowGenerator.addShadowCaster(mesh);
          }
        }
        const ground = scene.getMeshByName(`${destination}-terrain`);
        if (ground) ground.receiveShadows = true;
      } catch { shadowGenerator = null; }
    }
    if (sceneMode === 'planetary' && quality === 'high') try {
      postPipeline = new B.DefaultRenderingPipeline('orbital-frontier-post', true, scene, [camera]);
      postPipeline.fxaaEnabled = true;
      postPipeline.bloomEnabled = true;
      postPipeline.bloomThreshold = 0.84;
      postPipeline.bloomWeight = 0.22;
      postPipeline.bloomKernel = 48;
    } catch { postPipeline = null; }

    scene.onBeforeRenderObservable.add(() => {
      if (paused) return;
      const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);
      if (!reducedMotion) animationTime += dt;
      if (sceneMode === 'solar' && !reducedMotion) {
        solarPivots.forEach((body) => { body.node.rotation.y += body.speed * dt; body.mesh.rotation.y += dt * 0.025; });
      }
      if (sceneMode === 'rocket' && rocketLaunchActive && rocketRoot) {
        rocketLaunchElapsed += dt;
        const progress = Math.min(1, rocketLaunchElapsed / 4.8);
        const lift = progress * progress * 29;
        rocketRoot.position.y = 1.1 + lift;
        rocketRoot.rotation.z = Math.sin(progress * Math.PI) * 0.045;
        camera.setTarget(new B.Vector3(rocketRoot.position.x, rocketRoot.position.y + 13, rocketRoot.position.z));
        camera.radius = Math.max(28, 47 - progress * 13);
        if (rocketLaunchElapsed > 4.8) {
          rocketLaunchActive = false;
          rocketExhaust?.stop();
          const callback = rocketLaunchCallback;
          rocketLaunchCallback = undefined;
          sceneMode = 'planetary';
          rebuildScene('earth');
          callback?.();
        }
      }
      // Character and rover control: keyboard + virtual joystick share one movement model.
      if (playerControlled && playerAstronaut && !vehicleMode) {
        const forwardInput = (pressedKeys.has('w') || pressedKeys.has('arrowup') ? 1 : 0) - (pressedKeys.has('s') || pressedKeys.has('arrowdown') ? 1 : 0) - joystickY;
        const strafeInput = (pressedKeys.has('d') || pressedKeys.has('arrowright') ? 1 : 0) - (pressedKeys.has('a') || pressedKeys.has('arrowleft') ? 1 : 0) + joystickX;
        const length = Math.hypot(forwardInput, strafeInput);
        if (length > 0.05) {
          const speed = (pressedKeys.has('shift') ? 9.2 : 5.6) * (destination === 'moon' ? 0.62 : 1);
          const forwardX = -Math.cos(camera.alpha);
          const forwardZ = -Math.sin(camera.alpha);
          const rightX = -forwardZ;
          const rightZ = forwardX;
          const mx = (forwardX * forwardInput + rightX * strafeInput) / Math.max(1, length);
          const mz = (forwardZ * forwardInput + rightZ * strafeInput) / Math.max(1, length);
          playerAstronaut.root.position.x += mx * speed * dt;
          playerAstronaut.root.position.z += mz * speed * dt;
          const xBounds = destination === 'earth' ? [-31, -19] : insideHabitat ? [37.5, 60.5] : [-79, 79];
          const zBounds = destination === 'earth' ? [-4, 8] : insideHabitat ? [48, 69] : [-79, 79];
          playerAstronaut.root.position.x = Math.max(xBounds[0], Math.min(xBounds[1], playerAstronaut.root.position.x));
          playerAstronaut.root.position.z = Math.max(zBounds[0], Math.min(zBounds[1], playerAstronaut.root.position.z));
          playerAstronaut.root.rotation.y = Math.atan2(mx, mz);
          const gait = Math.sin(animationTime * (pressedKeys.has('shift') ? 13 : 9));
          if (!reducedMotion) {
            playerAstronaut.limbs[2].rotation.x = gait * 0.48;
            playerAstronaut.limbs[3].rotation.x = -gait * 0.48;
            playerAstronaut.limbs[0].rotation.x = -gait * 0.27;
            playerAstronaut.limbs[1].rotation.x = gait * 0.27;
          }
        } else {
          playerAstronaut.limbs.forEach((limb: any) => { limb.rotation.x *= 0.78; limb.rotation.z *= 0.78; });
        }
        const groundY = destination === 'earth' ? 2.34 : insideHabitat ? 0.12 : terrainHeight(playerAstronaut.root.position.x, playerAstronaut.root.position.z, destination) + 0.12;
        if (jumpVelocity !== 0 || playerAstronaut.root.position.y > groundY + 0.08) {
          jumpVelocity -= 14.5 * dt;
          playerAstronaut.root.position.y = Math.max(groundY, playerAstronaut.root.position.y + jumpVelocity * dt);
          if (playerAstronaut.root.position.y <= groundY + 0.001) { playerAstronaut.root.position.y = groundY; jumpVelocity = 0; }
        } else {
          playerAstronaut.root.position.y = groundY + (length > 0.05 ? Math.abs(Math.sin(animationTime * 9)) * 0.035 : 0);
        }
        camera.setTarget(new B.Vector3(playerAstronaut.root.position.x, playerAstronaut.root.position.y + 2.05, playerAstronaut.root.position.z));
        camera.radius = Math.max(11, Math.min(22, camera.radius));
        nearbyInteractable = null;
        let nearestDistance = Infinity;
        for (const item of stationRecords) {
          const distance = B.Vector3.Distance(playerAstronaut.root.position, item.position);
          if (distance < item.radius && distance < nearestDistance) {
            nearestDistance = distance;
            nearbyInteractable = { id: item.id, title: item.title, description: item.description };
          }
        }
      }
      if (vehicleMode && roverRoot) {
        const keyForward = (pressedKeys.has('w') || pressedKeys.has('arrowup') ? 1 : 0) - (pressedKeys.has('s') || pressedKeys.has('arrowdown') ? 1 : 0);
        const keyStrafe = (pressedKeys.has('d') || pressedKeys.has('arrowright') ? 1 : 0) - (pressedKeys.has('a') || pressedKeys.has('arrowleft') ? 1 : 0);
        const fx = vehicleY + keyForward;
        const sx = vehicleX + keyStrafe;
        const length = Math.hypot(fx, sx);
        if (length > 0.04) {
          const speed = 8.2;
          roverRoot.position.x += sx * speed * dt;
          roverRoot.position.z += fx * speed * dt;
          roverRoot.position.x = Math.max(-70, Math.min(70, roverRoot.position.x));
          roverRoot.position.z = Math.max(-70, Math.min(70, roverRoot.position.z));
          roverRoot.position.y = terrainHeight(roverRoot.position.x, roverRoot.position.z, destination) + 0.55;
          roverRoot.rotation.y = Math.atan2(sx, fx);
          roverWheels.forEach((wheel) => { wheel.rotation.x += length * dt * 2.8; });
        }
        camera.setTarget(new B.Vector3(roverRoot.position.x, roverRoot.position.y + 2.3, roverRoot.position.z));
      }
      if (activatedStationId && animationTime - activatedStationAt < 1.35) {
        const ring = scene.getMeshByName(`${activatedStationId}-station-ring`);
        const status = scene.getMeshByName(`${activatedStationId}-terminal-status`);
        const pulse = 1 + Math.sin((animationTime - activatedStationAt) * 11) * 0.13;
        if (ring) ring.scaling.set(pulse, pulse, pulse);
        if (status?.material?.emissiveColor) status.material.emissiveColor = new B.Color3(0.1 + pulse * 0.35, 0.55 + pulse * 0.22, 0.8);
      } else if (activatedStationId) {
        const ring = scene.getMeshByName(`${activatedStationId}-station-ring`);
        const status = scene.getMeshByName(`${activatedStationId}-terminal-status`);
        if (ring) ring.scaling.setAll(1);
        if (status?.material?.emissiveColor) status.material.emissiveColor = B.Color3.FromHexString(activatedStationId === 'oxygen' ? '#54b8d8' : activatedStationId === 'power' ? '#efb64d' : '#52b9b0');
        const stationRoot = scene.getTransformNodeByName(`station-${activatedStationId}`);
        if (stationRoot) stationRoot.scaling.setAll(1);
        activatedStationId = '';
      }
      if (!reducedMotion) {
        if (destination === 'earth') {
          const cloudLayer = scene.getMeshByName('earth-cloud-shell');
          if (cloudLayer) cloudLayer.rotation.y += dt * 0.012;
          const globe = scene.getMeshByName('planet-earth');
          if (globe) globe.rotation.y += dt * 0.006;
        }
        astronautRoots.forEach((astronaut, index) => {
          if (astronaut !== playerAstronaut || !playerControlled) {
            astronaut.root.position.y += Math.sin(animationTime * 2.1 + index) * 0.0018;
            astronaut.limbs[0].rotation.z = Math.sin(animationTime * 1.3 + index) * 0.06;
            astronaut.limbs[1].rotation.z = -Math.sin(animationTime * 1.3 + index) * 0.06;
          }
        });
        solarArrayRoots.forEach((array, index) => { array.rotation.y = Math.sin(animationTime * 0.12 + index * 1.8) * 0.11; });
        if (sampleBeacon) {
          sampleBeacon.rotation.y += dt * 0.5;
          const lamp = scene.getMeshByName('sample-beacon-lamp');
          if (lamp) lamp.scaling.setAll(1 + Math.sin(animationTime * 2.8) * 0.08);
        }
      }
      if (roverMoving && roverRoot && !vehicleMode) {
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

  engine.setHardwareScalingLevel(quality === 'low' ? 1.35 : quality === 'medium' ? 1.0 : 0.85);
  rebuildScene(planet);
  const renderFrame = (): void => { if (scene && !scene.isDisposed) scene.render(); };
  let renderLoopActive = true;
  engine.runRenderLoop(renderFrame);
  const resizeHandler = (): void => engine.resize();
  const keyDown = (event: KeyboardEvent): void => {
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.matches('input,textarea,select,[contenteditable="true"]'))) return;
    const key = event.key.toLowerCase();
    if (key === ' ' && playerControlled && !vehicleMode) {
      event.preventDefault();
      if (playerAstronaut && jumpVelocity === 0) jumpVelocity = 5.6;
      return;
    }
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(key)) {
      pressedKeys.add(key);
      if (playerControlled || vehicleMode) event.preventDefault();
    }
  };
  const keyUp = (event: KeyboardEvent): void => { pressedKeys.delete(event.key.toLowerCase()); };
  window.addEventListener('resize', resizeHandler);
  window.addEventListener('keydown', keyDown, { passive: false });
  window.addEventListener('keyup', keyUp);

  return {
    get rendererName() { return rendererName; },
    setPlanet(destination: Planet) { journeyActive = false; sceneMode = 'planetary'; rebuildScene(destination); },
    setSceneMode(mode: SceneMode) { journeyActive = false; sceneMode = mode; rebuildScene(planet); if (mode === 'solar' || mode === 'rocket') { playerControlled = false; vehicleMode = false; } },
    focusCelestial(name: string) {
      const body = solarBodies.get(name.toLowerCase());
      if (!body || !camera) return;
      const target = body.getAbsolutePosition();
      camera.setTarget(target);
      camera.radius = Math.max(12, body.getBoundingInfo().boundingSphere.radiusWorld * 7.2);
    },
    setRocketConfiguration(config: RocketConfiguration) { rocketConfig = { ...config }; if (sceneMode === 'rocket') rebuildScene(planet); },
    launchRocket(destination: Planet, onComplete?: () => void) {
      if (sceneMode !== 'rocket' || !rocketConfig.crewCapsule || !rocketConfig.mainEngine || !rocketConfig.fuelTank || !rocketConfig.communications || !rocketRoot) return;
      journeyDestination = destination; rocketLaunchElapsed = 0; rocketLaunchActive = true; rocketLaunchCallback = onComplete; paused = false;
      try { rocketExhaust?.start(); } catch { /* rocket motion remains playable without particles */ }
    },
    setPaused(value: boolean) {
      paused = value;
      // Stop the GPU render loop while the app is in a secondary screen or
      // background tab. Resume it on the next active game/planet screen.
      if (value && renderLoopActive) { engine.stopRenderLoop(renderFrame); renderLoopActive = false; }
      else if (!value && !renderLoopActive) { engine.runRenderLoop(renderFrame); renderLoopActive = true; }
      if (dustSystem) { if (value || reducedMotion) dustSystem.stop(); else dustSystem.start(); }
    },
    setGraphicsQuality(value: GraphicsQuality) {
      const changed = quality !== value;
      quality = value;
      const ratio = value === 'low' ? 0.72 : value === 'medium' ? 1 : 1.25;
      engine.setHardwareScalingLevel(1 / ratio);
      // Avoid rebuilding the entire solar system a second time during initial
      // renderer hand-off when the requested quality has not changed.
      if (changed && (sceneMode === 'solar' || sceneMode === 'rocket' || value === 'low' && planet !== 'earth')) rebuildScene(planet);
    },
    setReducedMotion(value: boolean) { reducedMotion = value; if (dustSystem) { if (value || paused) dustSystem.stop(); else dustSystem.start(); } },
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
    setPlayerControlled(enabled: boolean) {
      playerControlled = enabled;
      if (enabled && playerAstronaut && camera) {
        camera.radius = 17;
        camera.beta = 1.18;
        camera.setTarget(new B.Vector3(playerAstronaut.root.position.x, playerAstronaut.root.position.y + 2, playerAstronaut.root.position.z));
      }
      if (!enabled) { joystickX = 0; joystickY = 0; pressedKeys.clear(); }
    },
    setJoystick(x: number, y: number) { joystickX = Math.max(-1, Math.min(1, x)); joystickY = Math.max(-1, Math.min(1, y)); },
    jumpPlayer() { if (playerControlled && !vehicleMode && jumpVelocity === 0) jumpVelocity = 5.6; },
    atSampleSite() { return Boolean(vehicleMode && roverRoot && sampleSitePosition && Math.hypot(roverRoot.position.x - sampleSitePosition.x, roverRoot.position.z - sampleSitePosition.z) <= 7.5); },
    getNearbyInteractable() { return nearbyInteractable; },
    interactNearest() { return nearbyInteractable; },
    setVehicleMode(enabled: boolean) {
      if (enabled && !roverDeployed && roverRoot) {
        roverDeployed = true;
        roverRoot.setEnabled(true);
      }
      vehicleMode = enabled;
      if (playerAstronaut) playerAstronaut.root.setEnabled(!enabled);
      if (camera) {
        camera.radius = enabled ? 13 : 17;
        const target = enabled && roverRoot ? roverRoot.position : playerAstronaut?.root.position;
        if (target) camera.setTarget(new B.Vector3(target.x, target.y + 2, target.z));
      }
    },
    setVehicleInput(x: number, y: number) { vehicleX = Math.max(-1, Math.min(1, x)); vehicleY = Math.max(-1, Math.min(1, y)); },
    enterHabitat() {
      if (!playerAstronaut) return;
      insideHabitat = true;
      jumpVelocity = 0;
      playerAstronaut.root.position.set(49, 0.12, 47.8);
      camera.radius = 14;
      camera.setTarget(new B.Vector3(49, 2.2, 52));
    },
    exitHabitat() {
      if (!playerAstronaut) return;
      insideHabitat = false;
      jumpVelocity = 0;
      playerAstronaut.root.position.set(-8.5, terrainHeight(-8.5, 0, planet) + 0.12, 0);
      camera.radius = 17;
      camera.setTarget(new B.Vector3(-8.5, 2, 0));
    },
    focusStation(id: string) {
      const station = stationRecords.find((item) => item.id === id);
      if (station && camera) {
        camera.setTarget(new B.Vector3(station.position.x, station.position.y + 2, station.position.z));
        camera.radius = 12;
      }
    },
    activateStation(id: string) {
      activatedStationId = id; activatedStationAt = animationTime;
      const rootNode = scene.getTransformNodeByName(`station-${id}`);
      if (rootNode) { rootNode.scaling.setAll(1.035); }
      const station = stationRecords.find((item) => item.id === id);
      if (station && camera) camera.setTarget(new B.Vector3(station.position.x, station.position.y + 2, station.position.z));
    },
    playJourney(destination: Planet, onComplete?: () => void) {
      sceneMode = 'planetary';
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
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      engine.stopRenderLoop();
      try { rocketExhaust?.stop(); } catch { /* already disposed */ }
      scene?.dispose();
      engine.dispose();
    },
  };
}
