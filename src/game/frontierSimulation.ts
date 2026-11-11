export type FrontierAction =
  | 'inspect-systems'
  | 'power-balanced'
  | 'power-conserve'
  | 'repair-water'
  | 'conserve-water'
  | 'secure-shelter'
  | 'greenhouse-grow'
  | 'greenhouse-hold'
  | 'deploy-rover'
  | 'collect-sample'
  | 'rest-crew'
  | 'clean-arrays'
  | 'final-assessment';

export interface FrontierEvent {
  id: string;
  day: number;
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'critical';
  resolved: boolean;
}

export interface FrontierLogEntry {
  day: number;
  title: string;
  detail: string;
}

export interface FrontierMissionState {
  version: 1;
  destination: 'mars';
  day: number;
  status: 'active' | 'completed';
  battery: number;
  solarGeneration: number;
  powerDemand: number;
  oxygen: number;
  water: number;
  waterRecovery: number;
  food: number;
  greenhouse: number;
  habitat: number;
  radiation: number;
  crewReadiness: number;
  arrayCleanliness: number;
  arraysServiced: boolean;
  systemsInspected: boolean;
  powerPlan: 'balanced' | 'conserve';
  powerPlanConfirmed: boolean;
  waterActionComplete: boolean;
  shelterSecured: boolean;
  greenhouseActionComplete: boolean;
  roverDeployed: boolean;
  sampleCollected: boolean;
  finalAssessmentComplete: boolean;
  currentAlert: string | null;
  events: FrontierEvent[];
  log: FrontierLogEntry[];
  score: number | null;
  rating: string | null;
}

export interface FrontierResult {
  ok: boolean;
  state: FrontierMissionState;
  title: string;
  message: string;
}

const clamp = (value: number, min = 0, max = 100): number => Math.min(max, Math.max(min, value));
const copy = (state: FrontierMissionState): FrontierMissionState => ({
  ...state,
  events: state.events.map((event) => ({ ...event })),
  log: state.log.map((entry) => ({ ...entry })),
});

export function createMarsMission(): FrontierMissionState {
  return {
    version: 1,
    destination: 'mars',
    day: 1,
    status: 'active',
    battery: 82,
    solarGeneration: 22,
    powerDemand: 17,
    oxygen: 91,
    water: 76,
    waterRecovery: 88,
    food: 85,
    greenhouse: 18,
    habitat: 96,
    radiation: 12,
    crewReadiness: 94,
    arrayCleanliness: 92,
    arraysServiced: false,
    systemsInspected: false,
    powerPlan: 'balanced',
    powerPlanConfirmed: false,
    waterActionComplete: false,
    shelterSecured: false,
    greenhouseActionComplete: false,
    roverDeployed: false,
    sampleCollected: false,
    finalAssessmentComplete: false,
    currentAlert: null,
    events: [],
    log: [{ day: 1, title: 'Mars surface transfer complete', detail: 'The crew reached Outpost 86. Begin the habitat and energy commissioning checks.' }],
    score: null,
    rating: null,
  };
}

export function marsObjective(state: FrontierMissionState): { title: string; detail: string; complete: boolean } {
  switch (state.day) {
    case 1: return { title: 'Commission the habitat', detail: 'Inspect the integrated power, air and habitat systems before surface operations.', complete: state.systemsInspected };
    case 2: return { title: 'Ride out the dust front', detail: 'Choose a power profile and protect essential systems as dust reduces solar generation.', complete: state.powerPlanConfirmed };
    case 3: return { title: 'Stabilise water recovery', detail: 'Repair the recovery stage or conserve water until service can be restored.', complete: state.waterActionComplete };
    case 4: return { title: 'Protect the crew', detail: 'Suspend EVA activity and secure the shielded shelter during the solar weather warning.', complete: state.shelterSecured };
    case 5: return { title: 'Keep the greenhouse productive', detail: 'Choose a growth or low-resource maintenance schedule.', complete: state.greenhouseActionComplete };
    case 6: return { title: 'Complete the ridge survey', detail: 'Deploy the rover and collect one geological training sample.', complete: state.sampleCollected };
    default: return { title: 'Complete mission assessment', detail: 'Review crew safety, resource reserves, habitat health and scientific progress.', complete: state.finalAssessmentComplete };
  }
}

function log(state: FrontierMissionState, title: string, detail: string): void {
  state.log.unshift({ day: state.day, title, detail });
  state.log = state.log.slice(0, 50);
}

function resolve(state: FrontierMissionState, id: string): void {
  const event = state.events.find((item) => item.id === id);
  if (event) event.resolved = true;
  state.currentAlert = null;
}

export function applyMarsAction(input: FrontierMissionState, action: FrontierAction): FrontierResult {
  const state = copy(input);
  if (state.status !== 'active') return { ok: false, state, title: 'Mission closed', message: 'This expedition has already been assessed.' };
  switch (action) {
    case 'inspect-systems':
      state.systemsInspected = true;
      log(state, 'Habitat systems inspected', 'Power, environmental control and pressure integrity readings were checked.');
      return { ok: true, state, title: 'Commissioning complete', message: 'The habitat is stable. Essential systems are ready for the first surface operations.' };
    case 'power-balanced':
    case 'power-conserve':
      state.powerPlan = action === 'power-conserve' ? 'conserve' : 'balanced';
      state.powerPlanConfirmed = true;
      state.powerDemand = state.powerPlan === 'conserve' ? 13 : 17;
      resolve(state, 'dust-front');
      log(state, `Power profile: ${state.powerPlan}`, `Daily electrical demand is now ${state.powerDemand} training units.`);
      return { ok: true, state, title: 'Power profile saved', message: state.powerPlan === 'conserve' ? 'Optional loads are reduced. Battery reserve is protected, but greenhouse and science work will be slower.' : 'The balanced profile maintains normal activity, but battery reserve will fall faster while solar generation is low.' };
    case 'repair-water':
      if (state.battery < 10) return { ok: false, state, title: 'Insufficient energy', message: 'The repair requires 10 battery units. Choose a conservative power profile first.' };
      state.battery = clamp(state.battery - 10);
      state.waterRecovery = clamp(state.waterRecovery + 36);
      state.waterActionComplete = true;
      resolve(state, 'water-filter');
      log(state, 'Water recovery repaired', 'A filter cartridge was replaced using stored electrical energy.');
      return { ok: true, state, title: 'Recovery stage repaired', message: 'Water recovery efficiency improved. The repair used 10 battery units.' };
    case 'conserve-water':
      state.waterActionComplete = true;
      resolve(state, 'water-filter');
      log(state, 'Water conservation enabled', 'Crew use was reduced and greenhouse irrigation was placed on a reserve schedule.');
      return { ok: true, state, title: 'Conservation active', message: 'Water use is lower. Crop growth and some surface tasks will be limited until recovery is restored.' };
    case 'secure-shelter':
      if (state.day < 4) return { ok: false, state, title: 'Procedure not yet issued', message: 'Mission Control issues the solar weather shelter warning on Day 4.' };
      state.shelterSecured = true;
      state.radiation = clamp(state.radiation - 4);
      resolve(state, 'solar-weather');
      log(state, 'Crew shelter secured', 'External work was stopped and the crew entered the shielded habitat volume.');
      return { ok: true, state, title: 'Shelter procedure complete', message: 'Crew exposure is reduced in this training model. Shielding reduces exposure; it does not eliminate radiation.' };
    case 'greenhouse-grow':
    case 'greenhouse-hold':
      state.greenhouseActionComplete = true;
      if (action === 'greenhouse-grow') {
        state.powerDemand = clamp(state.powerDemand + 2, 0, 100);
        log(state, 'Greenhouse growth cycle selected', 'Water and electrical power were allocated to active crop production.');
      } else {
        log(state, 'Greenhouse hold selected', 'The crop system entered a low-power maintenance schedule.');
      }
      resolve(state, 'nutrient-check');
      return { ok: true, state, title: action === 'greenhouse-grow' ? 'Growth cycle active' : 'Greenhouse conserved', message: action === 'greenhouse-grow' ? 'Crop growth takes time and consumes water and power. Harvest is not immediate.' : 'The lower-power schedule protects reserves but delays food production.' };
    case 'deploy-rover':
      if (state.battery < 12) return { ok: false, state, title: 'Rover launch delayed', message: 'Rover preparation requires 12 battery units. Stabilise the power system first.' };
      state.battery = clamp(state.battery - 12);
      state.roverDeployed = true;
      log(state, 'Rover deployed', 'The rover left the outpost for the marked ridge route.');
      return { ok: true, state, title: 'Rover deployed', message: 'The rover is moving to the ridge survey zone. Use the 3D rover controls to drive the model.' };
    case 'collect-sample':
      if (!state.roverDeployed) return { ok: false, state, title: 'Rover not deployed', message: 'Deploy the rover before collecting a ridge sample.' };
      state.sampleCollected = true;
      resolve(state, 'ridge-survey');
      log(state, 'Ridge sample collected', 'A simulated basaltic regolith sample was catalogued for classroom interpretation.');
      return { ok: true, state, title: 'Sample secured', message: 'The sample is logged. This is a fictional training sample, not a real returned Martian specimen.' };
    case 'rest-crew':
      state.crewReadiness = clamp(state.crewReadiness + 12);
      log(state, 'Crew rest scheduled', 'A protected rest period improved operational readiness.');
      return { ok: true, state, title: 'Rest period complete', message: 'Crew readiness improved. The meter is a game indicator, not a medical assessment.' };
    case 'clean-arrays':
      if (state.arraysServiced) return { ok: false, state, title: 'Array maintenance complete', message: 'The array field has already received its maintenance pass.' };
      if (state.day < 2) return { ok: false, state, title: 'No dust accumulation', message: 'The dust front has not reached the array field yet.' };
      state.arrayCleanliness = clamp(state.arrayCleanliness + 28);
      state.arraysServiced = true;
      state.solarGeneration = clamp(state.solarGeneration + 5, 0, 100);
      log(state, 'Solar arrays cleaned', 'The crew cleared accumulated dust from the exposed array surfaces.');
      return { ok: true, state, title: 'Array output restored', message: 'Solar generation improved. Maintenance took crew time and should be balanced against other tasks.' };
    case 'final-assessment': {
      if (state.day !== 7) return { ok: false, state, title: 'Assessment unavailable', message: 'The final assessment is available on Day 7.' };
      state.finalAssessmentComplete = true;
      state.status = 'completed';
      const score = Math.round(state.oxygen * 0.16 + state.water * 0.14 + state.food * 0.12 + state.battery * 0.12 + state.habitat * 0.16 + state.crewReadiness * 0.16 + (state.sampleCollected ? 8 : 0) + (state.shelterSecured ? 6 : 0));
      state.score = clamp(score);
      state.rating = score >= 82 ? 'Expedition commander' : score >= 64 ? 'Operational explorer' : 'Mission trainee';
      log(state, 'Mars expedition assessed', `Final mission score: ${state.score}/100. ${state.rating}.`);
      return { ok: true, state, title: 'Expedition complete', message: `The seven-day Mars training expedition is complete. Final score: ${state.score}/100.` };
    }
  }
}

function advanceResources(state: FrontierMissionState): void {
  const surplus = state.solarGeneration - state.powerDemand;
  state.battery = clamp(state.battery + surplus * 1.18);
  const powerGood = state.battery > 12;
  state.oxygen = clamp(state.oxygen + (powerGood ? 1.1 : -6));
  state.habitat = clamp(state.habitat - (powerGood ? 0.6 : 2.4));
  state.crewReadiness = clamp(state.crewReadiness - 2.2);
  const waterUse = state.waterRecovery < 50 ? 7 : 4.8;
  state.water = clamp(state.water + state.waterRecovery / 100 * 4.2 - waterUse);
  if (state.greenhouseActionComplete && state.greenhouse > 65 && state.greenhouse < 100) {
    state.food = clamp(state.food - 4.2 + 1.2);
  } else {
    state.food = clamp(state.food - 4.2);
  }
  state.greenhouse = clamp(state.greenhouse + (state.powerDemand > 17 ? 3.2 : 6.5));
  state.radiation = clamp(state.radiation + (state.shelterSecured ? 0.8 : 2.2));
  if (state.battery < 8) state.currentAlert = 'Critical battery reserve';
  if (state.water < 18) state.currentAlert = 'Water reserve low';
  if (state.food < 18) state.currentAlert = 'Food reserve low';
}

export function advanceMarsDay(input: FrontierMissionState): FrontierResult {
  const state = copy(input);
  if (state.status !== 'active' || state.day >= 7 || !marsObjective(state).complete) {
    return { ok: false, state, title: 'Objective incomplete', message: "Complete the active day's mission objective before advancing." };
  }
  advanceResources(state);
  state.day += 1;
  state.waterActionComplete = false;
  state.greenhouseActionComplete = false;
  const events: Record<number, FrontierEvent> = {
    2: { id: 'dust-front', day: 2, title: 'Regional dust front', detail: 'Atmospheric dust reduces solar-array output. Confirm a power profile and prepare array maintenance.', severity: 'warning', resolved: false },
    3: { id: 'water-filter', day: 3, title: 'Water recovery filter fault', detail: 'A filter-stage fault reduces recovered water. Repair the unit or activate conservation.', severity: 'warning', resolved: false },
    4: { id: 'solar-weather', day: 4, title: 'Solar weather alert', detail: 'Mission Control recommends suspending EVA activity and moving the crew into the shielded habitat.', severity: 'critical', resolved: false },
    5: { id: 'nutrient-check', day: 5, title: 'Greenhouse nutrient check', detail: 'The nutrient-delivery system needs a growth or low-power maintenance decision.', severity: 'info', resolved: false },
    6: { id: 'ridge-survey', day: 6, title: 'Ridge survey window', detail: 'A rover route is available to collect a simulated geological sample.', severity: 'info', resolved: false },
  };
  const event = events[state.day];
  if (event) {
    state.events.unshift(event);
    state.currentAlert = event.title;
  }
  if (state.day === 2) { state.solarGeneration = 11; state.arrayCleanliness = clamp(state.arrayCleanliness - 28); }
  if (state.day === 3) state.waterRecovery = clamp(state.waterRecovery - 32);
  if (state.day === 4) state.radiation = clamp(state.radiation + 12);
  if (state.day === 5) state.greenhouse = clamp(state.greenhouse - 12);
  log(state, `Mission day ${state.day}`, marsObjective(state).detail);
  return { ok: true, state, title: `Day ${state.day} started`, message: marsObjective(state).detail };
}

export function saveMarsMission(state: FrontierMissionState): boolean {
  try { localStorage.setItem('ksa-outpost-86-mars-mission-v1', JSON.stringify(state)); return true; } catch { return false; }
}

export function loadMarsMission(): FrontierMissionState | null {
  try {
    const raw = localStorage.getItem('ksa-outpost-86-mars-mission-v1');
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<FrontierMissionState>;
    if (value.version !== 1 || value.destination !== 'mars' || !Number.isInteger(value.day) || (value.day ?? 0) < 1 || (value.day ?? 8) > 7) return null;
    if (value.status !== 'active' && value.status !== 'completed') return null;
    const numeric = ['battery', 'solarGeneration', 'powerDemand', 'oxygen', 'water', 'waterRecovery', 'food', 'greenhouse', 'habitat', 'radiation', 'crewReadiness', 'arrayCleanliness'] as const;
    if (numeric.some((key) => typeof value[key] !== 'number' || !Number.isFinite(value[key]))) return null;
    if (!Array.isArray(value.events) || !Array.isArray(value.log)) return null;
    return value as FrontierMissionState;
  } catch { return null; }
}
