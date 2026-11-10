import * as pc from 'playcanvas';

export interface WorldInput {
  forward: number;
  strafe: number;
}

export interface Interactable {
  id: string;
  title: string;
  description: string;
  x: number;
  z: number;
  range: number;
}

export interface WorldScene {
  app: pc.AppBase;
  camera: pc.Entity;
  astronaut: pc.Entity;
  interactables: Interactable[];
  getPosition(): { x: number; z: number };
  getNearestInteractable(): Interactable | null;
  setTouchMove(x: number, y: number): void;
  setPaused(paused: boolean): void;
  setGraphicsQuality(level: 'low' | 'medium' | 'high'): void;
  dispose(): void;
}

const colors = {
  regolith: 0x777b80,
  rock: 0x555b63,
  rockLight: 0x92969b,
  white: 0xe6e8e6,
  warmWhite: 0xcbd0cf,
  dark: 0x1a2734,
  blue: 0x4f8ba7,
  glass: 0x4d829a,
  amber: 0xf1a34e,
  green: 0x6ac49c,
  red: 0xe66f68,
  yellow: 0xf1ce72,
};

function material(hex: number, metalness = 0.08, emissive = false): pc.StandardMaterial {
  const color = new pc.Color(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
  const mat = new pc.StandardMaterial();
  mat.diffuse = color;
  mat.useMetalness = true;
  mat.metalness = metalness;
  mat.shininess = 32 + metalness * 55;
  if (emissive) {
    mat.emissive = new pc.Color(color.r * 0.3, color.g * 0.3, color.b * 0.3);
  }
  mat.update();
  return mat;
}

function addPrimitive(
  parent: pc.Entity,
  name: string,
  type: 'box' | 'cylinder' | 'plane' | 'sphere',
  position: [number, number, number],
  scale: [number, number, number],
  mat: pc.StandardMaterial,
  rotation: [number, number, number] = [0, 0, 0],
): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent('render', { type, material: mat });
  parent.addChild(entity);
  entity.setLocalPosition(position[0], position[1], position[2]);
  entity.setLocalScale(scale[0], scale[1], scale[2]);
  entity.setLocalEulerAngles(rotation[0], rotation[1], rotation[2]);
  return entity;
}

function makeLabelBeacon(parent: pc.Entity, x: number, z: number, tint: pc.StandardMaterial): void {
  addPrimitive(parent, 'marker-stem', 'cylinder', [x, 0.42, z], [0.06, 0.84, 0.06], material(0x27394b, 0.55));
  addPrimitive(parent, 'marker-light', 'sphere', [x, 0.93, z], [0.18, 0.18, 0.18], tint);
  addPrimitive(parent, 'marker-foot', 'cylinder', [x, 0.05, z], [0.38, 0.08, 0.38], material(0x3a4754, 0.42));
}

function buildAstronaut(parent: pc.Entity): { root: pc.Entity; arms: pc.Entity[]; legs: pc.Entity[]; helmet: pc.Entity } {
  const root = new pc.Entity('KSA training astronaut');
  parent.addChild(root);
  const suit = material(colors.white, 0.16);
  const suitShade = material(0xb9c2c9, 0.25);
  const dark = material(colors.dark, 0.42);
  const visor = material(0x254d68, 0.7, true);
  const orange = material(colors.amber, 0.25);
  const glow = material(colors.green, 0.1, true);

  // Layered torso and life-support backpack create a recognisable suit silhouette.
  addPrimitive(root, 'suit torso', 'box', [0, 1.42, 0], [0.78, 0.86, 0.48], suit);
  addPrimitive(root, 'lower suit', 'box', [0, 0.94, 0], [0.62, 0.34, 0.44], suitShade);
  addPrimitive(root, 'chest plate', 'box', [0, 1.47, -0.253], [0.45, 0.34, 0.035], dark);
  addPrimitive(root, 'mission patch', 'box', [-0.13, 1.52, -0.28], [0.14, 0.13, 0.025], orange);
  addPrimitive(root, 'status lamp', 'sphere', [0.14, 1.52, -0.29], [0.055, 0.055, 0.025], glow);
  addPrimitive(root, 'backpack', 'box', [0, 1.45, 0.37], [0.66, 0.78, 0.34], suitShade);
  addPrimitive(root, 'backpack top', 'box', [0, 1.87, 0.38], [0.54, 0.11, 0.3], dark);
  addPrimitive(root, 'left pack tank', 'cylinder', [-0.22, 1.47, 0.55], [0.13, 0.45, 0.13], suit);
  addPrimitive(root, 'right pack tank', 'cylinder', [0.22, 1.47, 0.55], [0.13, 0.45, 0.13], suit);
  addPrimitive(root, 'collar', 'cylinder', [0, 1.91, 0], [0.29, 0.12, 0.29], dark);
  const helmet = addPrimitive(root, 'helmet', 'sphere', [0, 2.2, -0.01], [0.46, 0.46, 0.43], suit);
  addPrimitive(root, 'visor', 'sphere', [0, 2.21, -0.365], [0.335, 0.245, 0.085], visor);
  addPrimitive(root, 'visor rim', 'box', [0, 1.94, -0.31], [0.55, 0.055, 0.1], suitShade);
  addPrimitive(root, 'helmet side left', 'cylinder', [-0.45, 2.18, 0], [0.12, 0.17, 0.12], orange, [0, 0, 90]);
  addPrimitive(root, 'helmet side right', 'cylinder', [0.45, 2.18, 0], [0.12, 0.17, 0.12], orange, [0, 0, 90]);

  const arms: pc.Entity[] = [];
  for (const side of [-1, 1]) {
    const pivot = new pc.Entity(side < 0 ? 'left arm pivot' : 'right arm pivot');
    root.addChild(pivot);
    pivot.setLocalPosition(side * 0.46, 1.72, 0);
    addPrimitive(pivot, 'upper arm', 'box', [0, -0.27, 0], [0.24, 0.54, 0.27], suit);
    addPrimitive(pivot, 'shoulder band', 'box', [0, -0.06, -0.015], [0.27, 0.12, 0.29], orange);
    addPrimitive(pivot, 'elbow', 'sphere', [0, -0.55, 0], [0.14, 0.14, 0.14], suitShade);
    addPrimitive(pivot, 'forearm', 'box', [0, -0.81, -0.01], [0.22, 0.43, 0.24], suitShade);
    addPrimitive(pivot, 'wrist', 'cylinder', [0, -1.04, -0.01], [0.12, 0.09, 0.12], dark);
    addPrimitive(pivot, 'glove', 'sphere', [0, -1.17, -0.02], [0.16, 0.17, 0.16], suit);
    arms.push(pivot);
  }

  const legs: pc.Entity[] = [];
  for (const side of [-1, 1]) {
    const pivot = new pc.Entity(side < 0 ? 'left leg pivot' : 'right leg pivot');
    root.addChild(pivot);
    pivot.setLocalPosition(side * 0.2, 0.84, 0);
    addPrimitive(pivot, 'thigh', 'box', [0, -0.23, 0], [0.29, 0.48, 0.32], suit);
    addPrimitive(pivot, 'knee', 'sphere', [0, -0.48, -0.01], [0.16, 0.14, 0.17], suitShade);
    addPrimitive(pivot, 'shin', 'box', [0, -0.71, 0.01], [0.25, 0.42, 0.28], suit);
    addPrimitive(pivot, 'boot', 'box', [0, -0.96, -0.055], [0.31, 0.18, 0.42], dark);
    addPrimitive(pivot, 'boot sole', 'box', [0, -1.065, -0.055], [0.32, 0.045, 0.43], orange);
    legs.push(pivot);
  }
  return { root, arms, legs, helmet };
}

function buildHabitat(root: pc.Entity): void {
  const shell = material(0xbac4ca, 0.45);
  const trim = material(0x526272, 0.48);
  const glass = material(colors.glass, 0.62, true);
  const warm = material(0xd9d4c6, 0.22);
  // Main rectangular pressure module and attached entry vestibule.
  addPrimitive(root, 'Outpost 86 habitat', 'box', [0, 1.45, 0], [5.3, 2.65, 3.4], shell);
  addPrimitive(root, 'habitat roof rail', 'box', [0, 2.83, 0], [5.55, 0.13, 3.62], trim);
  addPrimitive(root, 'front lower trim', 'box', [0, 0.25, -1.73], [5.2, 0.17, 0.13], trim);
  addPrimitive(root, 'habitat door', 'box', [0, 1.1, -1.77], [1.0, 1.75, 0.12], trim);
  addPrimitive(root, 'door inner panel', 'box', [0, 1.1, -1.85], [0.78, 1.46, 0.04], warm);
  addPrimitive(root, 'airlock indicator', 'sphere', [0.39, 1.77, -1.91], [0.07, 0.07, 0.035], material(colors.green, 0.1, true));
  for (const x of [-1.75, 1.75]) {
    addPrimitive(root, 'habitat window frame', 'box', [x, 1.8, -1.74], [0.9, 0.65, 0.1], trim);
    addPrimitive(root, 'habitat window', 'box', [x, 1.8, -1.81], [0.73, 0.49, 0.035], glass);
  }
  for (const x of [-2.35, 2.35]) {
    addPrimitive(root, 'habitat support', 'cylinder', [x, 0.5, 0.95], [0.12, 0.8, 0.12], trim);
  }
  // The connected airlock vestibule gives the front of the habitat a clear silhouette.
  addPrimitive(root, 'airlock vestibule', 'cylinder', [0, 1.0, -2.6], [1.0, 1.15, 1.0], shell);
  addPrimitive(root, 'airlock hatch', 'cylinder', [0, 1.0, -3.13], [0.55, 0.07, 0.55], trim, [90, 0, 0]);
  addPrimitive(root, 'habitat side light', 'box', [2.7, 1.55, 0.35], [0.08, 0.6, 0.42], glass);
  addPrimitive(root, 'roof comms mast', 'cylinder', [1.75, 3.18, 0.75], [0.055, 0.65, 0.055], trim);
  addPrimitive(root, 'mast dish', 'sphere', [1.75, 3.56, 0.75], [0.3, 0.09, 0.3], shell, [20, 0, 0]);
  addPrimitive(root, 'habitat name plate', 'box', [0, 2.48, -1.79], [1.55, 0.22, 0.045], trim);
  addPrimitive(root, 'plate light', 'box', [0, 2.49, -1.83], [0.12, 0.08, 0.02], material(colors.amber, 0.15, true));
}

function buildSolarArray(root: pc.Entity): pc.Entity {
  const frame = material(0x687783, 0.65);
  const panel = material(0x254b70, 0.68);
  const cells = material(0x4787ae, 0.3, true);
  const array = new pc.Entity('solar array assembly');
  root.addChild(array);
  array.setPosition(-8.2, 0, -2.1);
  addPrimitive(array, 'central support', 'cylinder', [0, 0.95, 0], [0.12, 1.9, 0.12], frame);
  addPrimitive(array, 'panel left frame', 'box', [-1.9, 1.35, 0], [3.65, 0.12, 2.05], frame, [0, 0, -12]);
  addPrimitive(array, 'panel right frame', 'box', [1.9, 1.35, 0], [3.65, 0.12, 2.05], frame, [0, 0, -12]);
  addPrimitive(array, 'panel left glass', 'box', [-1.9, 1.45, 0], [3.52, 0.045, 1.92], panel, [0, 0, -12]);
  addPrimitive(array, 'panel right glass', 'box', [1.9, 1.45, 0], [3.52, 0.045, 1.92], panel, [0, 0, -12]);
  for (let i = 0; i < 7; i += 1) {
    const x = -3.45 + i * 0.5;
    addPrimitive(array, 'solar cell seam', 'box', [x, 1.48, 0], [0.025, 0.02, 1.88], cells, [0, 0, -12]);
  }
  for (const x of [-3.8, 0, 3.8]) addPrimitive(array, 'array foot', 'cylinder', [x, 0.16, 0], [0.18, 0.32, 0.18], frame);
  return array;
}

function buildGreenhouse(root: pc.Entity): void {
  const frame = material(0x8799a4, 0.5);
  const glass = material(0x4e8290, 0.6, true);
  const plant = material(0x4d8d68, 0.1);
  addPrimitive(root, 'greenhouse base', 'box', [7, 0.25, -3], [4.4, 0.42, 3.5], frame);
  addPrimitive(root, 'greenhouse body', 'box', [7, 1.4, -3], [4.05, 2.0, 3.1], glass);
  addPrimitive(root, 'greenhouse roof front', 'box', [7, 2.55, -2.1], [4.2, 0.12, 1.7], frame, [18, 0, 0]);
  addPrimitive(root, 'greenhouse roof rear', 'box', [7, 2.55, -3.9], [4.2, 0.12, 1.7], frame, [-18, 0, 0]);
  addPrimitive(root, 'greenhouse door frame', 'box', [7, 1.25, -4.62], [0.9, 1.7, 0.12], frame);
  addPrimitive(root, 'greenhouse door glass', 'box', [7, 1.25, -4.7], [0.64, 1.4, 0.04], glass);
  for (const x of [5.8, 7, 8.2]) {
    addPrimitive(root, 'grow bed', 'box', [x, 0.62, -2.95], [0.78, 0.24, 1.8], material(0x3a4a3f));
    for (let i = 0; i < 3; i += 1) addPrimitive(root, 'crop cluster', 'sphere', [x + (i - 1) * 0.18, 0.94, -2.95 + (i % 2) * 0.45], [0.18, 0.32, 0.18], plant);
  }
}

function buildWaterUnit(root: pc.Entity): void {
  const metal = material(0xaab6be, 0.62);
  const dark = material(0x293947, 0.52);
  const water = material(0x3e8fb2, 0.25, true);
  addPrimitive(root, 'water recovery cabinet', 'box', [-3.8, 1.0, 4.4], [1.7, 1.8, 1.25], metal);
  addPrimitive(root, 'water tank left', 'cylinder', [-4.55, 0.8, 4.4], [0.36, 1.35, 0.36], water);
  addPrimitive(root, 'water tank right', 'cylinder', [-3.05, 0.8, 4.4], [0.36, 1.35, 0.36], metal);
  addPrimitive(root, 'water control panel', 'box', [-3.8, 1.35, 3.75], [0.72, 0.55, 0.08], dark);
  addPrimitive(root, 'water status', 'sphere', [-3.8, 1.52, 3.68], [0.09, 0.09, 0.04], water);
  addPrimitive(root, 'water pipe', 'cylinder', [-3.8, 0.2, 4.95], [0.07, 0.7, 0.07], dark, [90, 0, 0]);
}

function buildShelter(root: pc.Entity): void {
  const shell = material(0x9baab5, 0.4);
  const trim = material(0x334556, 0.4);
  addPrimitive(root, 'radiation shelter base', 'cylinder', [-8, 0.18, 6], [2.0, 0.36, 2.0], trim);
  addPrimitive(root, 'radiation shelter module', 'cylinder', [-8, 1.25, 6], [1.62, 2.2, 1.62], shell);
  addPrimitive(root, 'shelter roof', 'sphere', [-8, 2.38, 6], [1.62, 0.42, 1.62], shell);
  addPrimitive(root, 'shelter entrance', 'box', [-8, 1.0, 4.98], [0.9, 1.55, 0.12], trim);
  addPrimitive(root, 'shelter door inner', 'box', [-8, 1.0, 4.9], [0.66, 1.28, 0.04], shell);
  addPrimitive(root, 'shelter warning lamp', 'sphere', [-8, 2.08, 4.9], [0.12, 0.12, 0.1], material(colors.amber, 0.1, true));
  addPrimitive(root, 'shelter shield plate', 'box', [-8, 1.6, 7.64], [1.15, 0.62, 0.1], trim);
}

function buildRover(root: pc.Entity): void {
  const chassis = material(0xb2bec4, 0.5);
  const tyre = material(0x26313b, 0.22);
  const glass = material(0x315b75, 0.65, true);
  addPrimitive(root, 'rover chassis', 'box', [4.4, 0.86, 6.5], [2.0, 0.58, 1.35], chassis);
  addPrimitive(root, 'rover cabin', 'box', [4.4, 1.4, 6.5], [1.0, 0.62, 1.0], glass);
  addPrimitive(root, 'rover front panel', 'box', [4.4, 1.38, 5.96], [0.72, 0.18, 0.06], chassis);
  for (const x of [3.45, 5.35]) {
    for (const z of [5.92, 7.08]) addPrimitive(root, 'rover wheel', 'cylinder', [x, 0.55, z], [0.46, 0.2, 0.46], tyre, [0, 0, 90]);
  }
  addPrimitive(root, 'rover antenna', 'cylinder', [4.8, 1.9, 6.5], [0.04, 0.62, 0.04], chassis);
}

function buildAntenna(root: pc.Entity): void {
  const metal = material(0x9da9b5, 0.55);
  addPrimitive(root, 'communications mast', 'cylinder', [9.4, 1.65, 5.0], [0.08, 3.3, 0.08], metal);
  addPrimitive(root, 'antenna crossbar', 'box', [9.4, 2.65, 5.0], [1.4, 0.09, 0.09], metal);
  addPrimitive(root, 'dish', 'sphere', [9.4, 3.05, 5.0], [0.72, 0.2, 0.72], material(0xd7dce0, 0.6), [15, 0, 0]);
  addPrimitive(root, 'dish receiver', 'cylinder', [9.4, 3.3, 5.0], [0.08, 0.35, 0.08], material(colors.amber, 0.25));
}

function makeRocks(root: pc.Entity): pc.Entity[] {
  const rocks: pc.Entity[] = [];
  // Fixed seed keeps the terrain reproducible for testing and judging.
  let seed = 8606;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const rockMaterials = [material(colors.rock), material(colors.rockLight), material(0x666b71)];
  for (let i = 0; i < 58; i += 1) {
    const x = (random() - 0.5) * 38;
    const z = (random() - 0.5) * 38;
    if (Math.abs(x) < 4 && Math.abs(z) < 4) continue;
    if ((x < -4 && x > -12 && z > -5 && z < 7) || (x > 4 && x < 10 && z > -6 && z < -1)) continue;
    const size = 0.18 + random() * 0.62;
    const rock = addPrimitive(root, 'regolith boulder', 'sphere', [x, size * 0.36, z], [size * 1.2, size * 0.72, size], rockMaterials[i % rockMaterials.length]);
    rocks.push(rock);
    rock.setLocalEulerAngles(random() * 35, random() * 360, random() * 30);
  }
  for (const crater of [{ x: -14, z: -9, s: 2.9 }, { x: 13, z: -11, s: 3.6 }, { x: 14, z: 10, s: 2.4 }]) {
    addPrimitive(root, 'crater shadow', 'sphere', [crater.x, 0.03, crater.z], [crater.s, 0.08, crater.s * 0.8], material(0x343941));
    addPrimitive(root, 'crater rim', 'sphere', [crater.x, 0.1, crater.z], [crater.s * 1.25, 0.16, crater.s], material(0x666a70));
    addPrimitive(root, 'crater interior', 'sphere', [crater.x, 0.07, crater.z], [crater.s * 0.83, 0.055, crater.s * 0.63], material(0x454a51));
  }
  return rocks;
}

function addStars(root: pc.Entity): pc.Entity[] {
  const stars: pc.Entity[] = [];
  const starMaterials = [material(0xd8e6fa, 0, true), material(0x8bb9dc, 0, true)];
  let seed = 860;
  const random = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < 74; i += 1) {
    const x = (random() - 0.5) * 90;
    const y = 8 + random() * 28;
    const z = (random() - 0.5) * 85;
    const r = 0.025 + random() * 0.04;
    stars.push(addPrimitive(root, 'distant star', 'sphere', [x, y, z], [r, r, r], starMaterials[i % 2]));
  }
  addPrimitive(root, 'distant Earth', 'sphere', [18, 11, -26], [1.3, 1.3, 1.3], material(0x316d9a, 0.3, true));
  addPrimitive(root, 'Earth cloud band', 'sphere', [18, 11, -26], [1.31, 0.48, 1.31], material(0x8eafc3, 0.1, true));
  return stars;
}

export async function createWorld(canvas: HTMLCanvasElement): Promise<WorldScene> {
  const device = await pc.createGraphicsDevice(canvas, {
    deviceTypes: [pc.DEVICETYPE_WEBGL2],
    antialias: true,
    depth: true,
    stencil: false,
    powerPreference: 'high-performance',
  });
  const options = new pc.AppOptions();
  options.graphicsDevice = device;
  options.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
  options.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

  const app = new pc.AppBase(canvas);
  app.init(options);
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);

  const root = app.root;
  const camera = new pc.Entity('third-person camera');
  camera.addComponent('camera', {
    clearColor: new pc.Color(0.012, 0.022, 0.04),
    fov: 58,
    nearClip: 0.1,
    farClip: 120,
    frustumCulling: true,
  });
  root.addChild(camera);

  const sun = new pc.Entity('low polar sunlight');
  sun.addComponent('light', { type: 'directional', intensity: 1.65, castShadows: true, shadowResolution: 1024 });
  sun.setEulerAngles(18, 32, -18);
  root.addChild(sun);
  const fill = new pc.Entity('soft habitat fill');
  fill.addComponent('light', { type: 'omni', intensity: 0.24, range: 26, color: new pc.Color(0.36, 0.5, 0.68) });
  fill.setPosition(0, 7, 4);
  root.addChild(fill);

  addPrimitive(root, 'lunar regolith surface', 'plane', [0, -0.08, 0], [48, 1, 48], material(colors.regolith, 0.02));
  // Slightly raised, darker path slabs help students read the outpost layout.
  addPrimitive(root, 'habitat approach path', 'box', [0, 0.005, 5.5], [3.0, 0.06, 8.0], material(0x666d73));
  addPrimitive(root, 'power service path', 'box', [-5.0, 0.005, 0.3], [7.8, 0.06, 1.35], material(0x626970));
  addPrimitive(root, 'greenhouse path', 'box', [4.6, 0.005, -2.9], [6.5, 0.06, 1.2], material(0x646c73));
  const qualityRocks = makeRocks(root);
  const qualityStars = addStars(root);
  buildHabitat(root);
  const solarArray = buildSolarArray(root);
  buildGreenhouse(root);
  buildWaterUnit(root);
  buildShelter(root);
  buildRover(root);
  buildAntenna(root);

  // A small mission kiosk anchors the starting area.
  const kioskMetal = material(0x8295a4, 0.5);
  const kioskDark = material(0x1d2b39, 0.5);
  addPrimitive(root, 'mission kiosk pedestal', 'box', [0, 0.7, 8.2], [1.25, 1.4, 0.62], kioskMetal);
  addPrimitive(root, 'mission kiosk screen', 'box', [0, 1.05, 7.86], [0.9, 0.62, 0.06], kioskDark);
  addPrimitive(root, 'kiosk status strip', 'box', [0, 1.45, 7.85], [0.38, 0.05, 0.04], material(colors.green, 0.1, true));
  addPrimitive(root, 'kiosk feet', 'box', [0, 0.08, 8.2], [1.45, 0.16, 0.75], kioskDark);

  const astronautModel = buildAstronaut(root);
  astronautModel.root.setPosition(0, 0, 10.6);
  const astronaut = astronautModel.root;

  // Consoles and equipment get distinctive silhouettes and status markers.
  const consoleBody = material(0x8595a1, 0.48);
  const consoleDark = material(0x1e2e3e, 0.45);
  const blueLamp = material(colors.blue, 0.1, true);
  addPrimitive(root, 'power console cabinet', 'box', [-5.0, 0.88, -0.9], [1.2, 1.65, 0.82], consoleBody);
  addPrimitive(root, 'power console face', 'box', [-5.0, 1.13, -1.34], [0.85, 0.72, 0.07], consoleDark);
  addPrimitive(root, 'power console screen glow', 'box', [-5.0, 1.23, -1.39], [0.58, 0.36, 0.02], blueLamp);
  addPrimitive(root, 'life support console cabinet', 'box', [3.5, 0.84, 2.7], [1.1, 1.55, 0.78], consoleBody);
  addPrimitive(root, 'life support console face', 'box', [3.5, 1.1, 2.29], [0.8, 0.7, 0.07], consoleDark);
  addPrimitive(root, 'life support screen glow', 'box', [3.5, 1.2, 2.24], [0.55, 0.35, 0.02], material(colors.green, 0.1, true));
  addPrimitive(root, 'science marker platform', 'cylinder', [0, 0.12, -11.0], [1.35, 0.24, 1.35], material(0x535f6b, 0.2));
  addPrimitive(root, 'science marker post', 'cylinder', [0, 0.75, -11.0], [0.1, 1.2, 0.1], consoleBody);
  addPrimitive(root, 'science marker beacon', 'sphere', [0, 1.48, -11.0], [0.24, 0.24, 0.24], material(colors.amber, 0.1, true));

  makeLabelBeacon(root, -5.0, -1.7, blueLamp);
  makeLabelBeacon(root, 3.5, 1.65, material(colors.green, 0.1, true));
  makeLabelBeacon(root, -3.8, 5.45, material(colors.blue, 0.1, true));
  makeLabelBeacon(root, -8.0, 7.6, material(colors.amber, 0.1, true));
  makeLabelBeacon(root, 7.0, -5.2, material(colors.green, 0.1, true));
  makeLabelBeacon(root, 0, -12.6, material(colors.amber, 0.1, true));

  const interactables: Interactable[] = [
    { id: 'power', title: 'Power management', description: 'Solar array and battery control', x: -5.0, z: -0.9, range: 3.0 },
    { id: 'life-support', title: 'Life support', description: 'Oxygen supply and cabin-air systems', x: 3.5, z: 2.7, range: 2.8 },
    { id: 'water', title: 'Water recovery', description: 'Storage, recovery and conservation', x: -3.8, z: 4.4, range: 2.8 },
    { id: 'shelter', title: 'Radiation shelter', description: 'Crew protection procedure', x: -8.0, z: 6.0, range: 3.0 },
    { id: 'greenhouse', title: 'Greenhouse', description: 'Food growth and crop maintenance', x: 7.0, z: -3.0, range: 3.0 },
    { id: 'survey', title: 'Science survey', description: 'Marked lunar surface sample point', x: 0, z: -11.0, range: 2.8 },
    { id: 'terminal', title: 'Mission terminal', description: 'Daily briefing and final assessment', x: 0, z: 8.2, range: 2.5 },
  ];

  const blockers = [
    { x: 0, z: -0.2, r: 2.7 },
    { x: 7, z: -3, r: 1.8 },
    { x: -8, z: 6, r: 1.2 },
    { x: -3.8, z: 4.4, r: 0.8 },
    { x: 4.4, z: 6.5, r: 0.95 },
  ];

  let yaw = 0;
  let pitch = 16;
  let touchForward = 0;
  let touchStrafe = 0;
  let paused = true;
  let animationClock = 0;
  let moving = false;
  let quality: 'low' | 'medium' | 'high' = 'medium';
  const keys = new Set<string>();
  let pointerDown = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  const keyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
    keys.add(key);
  };
  const keyUp = (event: KeyboardEvent): void => { keys.delete(event.key.toLowerCase()); };
  const onBlur = (): void => keys.clear();
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', onBlur);

  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' || event.pointerType === 'touch') {
      pointerDown = true;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      if (event.pointerType === 'touch') canvas.setPointerCapture(event.pointerId);
    }
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!pointerDown || paused) return;
    const dx = event.clientX - lastPointerX;
    const dy = event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    yaw -= dx * 0.0042;
    pitch = Math.max(8, Math.min(27, pitch + dy * 0.06));
  });
  const pointerUp = (): void => { pointerDown = false; };
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);

  const getPosition = (): { x: number; z: number } => ({ x: astronaut.getPosition().x, z: astronaut.getPosition().z });
  const getNearestInteractable = (): Interactable | null => {
    const p = getPosition();
    let best: Interactable | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const item of interactables) {
      const distance = Math.hypot(p.x - item.x, p.z - item.z);
      if (distance <= item.range && distance < bestDistance) {
        best = item;
        bestDistance = distance;
      }
    }
    return best;
  };

  app.on('update', (dt: number) => {
    const step = Math.min(dt, 0.05);
    if (!paused) {
      const forward = (keys.has('w') || keys.has('arrowup') ? 1 : 0)
        - (keys.has('s') || keys.has('arrowdown') ? 1 : 0) + touchForward;
      const strafe = (keys.has('d') || keys.has('arrowright') ? 1 : 0)
        - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + touchStrafe;
      const length = Math.hypot(forward, strafe);
      moving = length > 0.08;
      if (moving) {
        const f = forward / Math.max(length, 1);
        const s = strafe / Math.max(length, 1);
        const speed = quality === 'low' ? 5.0 : 5.8;
        const dx = (-Math.sin(yaw) * f + Math.cos(yaw) * s) * speed * step;
        const dz = (-Math.cos(yaw) * f - Math.sin(yaw) * s) * speed * step;
        const current = astronaut.getPosition();
        let nextX = Math.max(-19, Math.min(19, current.x + dx));
        let nextZ = Math.max(-19, Math.min(19, current.z + dz));
        if (blockers.some((item) => Math.hypot(nextX - item.x, nextZ - item.z) < item.r)) nextX = current.x;
        if (blockers.some((item) => Math.hypot(nextX - item.x, nextZ - item.z) < item.r)) nextZ = current.z;
        astronaut.setPosition(nextX, 0, nextZ);
        astronaut.setEulerAngles(0, yaw * 180 / Math.PI, 0);
        animationClock += step * 8;
        astronautModel.legs[0].setLocalEulerAngles(Math.sin(animationClock) * 22, 0, 0);
        astronautModel.legs[1].setLocalEulerAngles(-Math.sin(animationClock) * 22, 0, 0);
        astronautModel.arms[0].setLocalEulerAngles(-Math.sin(animationClock) * 15, 0, 0);
        astronautModel.arms[1].setLocalEulerAngles(Math.sin(animationClock) * 15, 0, 0);
      } else {
        animationClock += step;
        astronautModel.legs.forEach((leg) => leg.setLocalEulerAngles(0, 0, 0));
        astronautModel.arms[0].setLocalEulerAngles(Math.sin(animationClock * 1.4) * 1.8, 0, 0);
        astronautModel.arms[1].setLocalEulerAngles(-Math.sin(animationClock * 1.4) * 1.8, 0, 0);
      }
      const p = astronaut.getPosition();
      const distance = quality === 'low' ? 7.6 : quality === 'high' ? 6.7 : 7.1;
      const cameraX = p.x + Math.sin(yaw) * distance;
      const cameraZ = p.z + Math.cos(yaw) * distance;
      const cameraY = p.y + 3.6 + (pitch - 16) * 0.065;
      camera.setPosition(cameraX, cameraY, cameraZ);
      camera.lookAt(p.x, p.y + 1.25, p.z - 0.1);
    }
    // Slowly sweep the polar array to make the scene feel active without a heavy animation system.
    solarArray.setEulerAngles(0, Math.sin(Date.now() * 0.00008) * 2.2, 0);
  });

  app.start();
  camera.setPosition(0, 4.5, 17.6);
  camera.lookAt(0, 1.2, 8.5);

  return {
    app,
    camera,
    astronaut,
    interactables,
    getPosition,
    getNearestInteractable,
    setTouchMove(x, y) { touchStrafe = Math.max(-1, Math.min(1, x)); touchForward = Math.max(-1, Math.min(1, y)); },
    setPaused(value) { paused = value; if (value) { touchStrafe = 0; touchForward = 0; } },
    setGraphicsQuality(level) {
      quality = level;
      const rockLimit = level === 'low' ? 18 : level === 'medium' ? 42 : qualityRocks.length;
      const starLimit = level === 'low' ? 18 : level === 'medium' ? 48 : qualityStars.length;
      qualityRocks.forEach((entity, index) => { entity.enabled = index < rockLimit; });
      qualityStars.forEach((entity, index) => { entity.enabled = index < starLimit; });
    },
    dispose() {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', onBlur);
      app.destroy();
    },
  };
}
