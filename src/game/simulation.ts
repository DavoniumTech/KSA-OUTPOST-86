export type PowerPlan = 'balanced' | 'conserve' | 'research';
export type GreenhousePlan = 'grow' | 'conserve' | 'idle';
export type MissionStatus = 'active' | 'completed' | 'terminated';
export type MissionAction =
  | 'inspect-power'
  | 'inspect-life-support'
  | 'choose-power-balanced'
  | 'choose-power-conserve'
  | 'choose-power-research'
  | 'repair-water'
  | 'conserve-water'
  | 'secure-shelter'
  | 'greenhouse-grow'
  | 'greenhouse-conserve'
  | 'complete-survey'
  | 'final-check'
  | 'thermal-service'
  | 'crew-rest';

export interface MissionEvent {
  id: string;
  day: number;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  resolved: boolean;
}

export interface LogEntry {
  day: number;
  title: string;
  detail: string;
}

export interface MissionState {
  day: number;
  status: MissionStatus;
  battery: number;
  solarGeneration: number;
  powerDemand: number;
  oxygen: number;
  cabinAir: number;
  co2Control: number;
  water: number;
  waterRecovery: number;
  food: number;
  greenhouseProgress: number;
  greenhousePlan: GreenhousePlan;
  thermal: number;
  crewReadiness: number;
  powerPlan: PowerPlan;
  powerInspected: boolean;
  lifeSupportInspected: boolean;
  powerPlanConfirmed: boolean;
  waterActionComplete: boolean;
  waterConservation: boolean;
  shelterSecured: boolean;
  greenhouseActionComplete: boolean;
  surveyComplete: boolean;
  finalCheckComplete: boolean;
  scienceSamples: number;
  currentAlert: string | null;
  events: MissionEvent[];
  log: LogEntry[];
  objectiveHistory: string[];
  finalScore: number | null;
  finalRating: string | null;
}

export interface ActionResult {
  state: MissionState;
  ok: boolean;
  message: string;
  title?: string;
}

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value));
const clone = (state: MissionState): MissionState => ({
  ...state,
  events: state.events.map((event) => ({ ...event })),
  log: state.log.map((entry) => ({ ...entry })),
  objectiveHistory: [...state.objectiveHistory],
});

export function createInitialMission(): MissionState {
  return {
    day: 1,
    status: 'active',
    battery: 78,
    solarGeneration: 20,
    powerDemand: 16,
    oxygen: 86,
    cabinAir: 91,
    co2Control: 88,
    water: 72,
    waterRecovery: 82,
    food: 84,
    greenhouseProgress: 12,
    greenhousePlan: 'idle',
    thermal: 84,
    crewReadiness: 92,
    powerPlan: 'balanced',
    powerInspected: false,
    lifeSupportInspected: false,
    powerPlanConfirmed: false,
    waterActionComplete: false,
    waterConservation: false,
    shelterSecured: false,
    greenhouseActionComplete: false,
    surveyComplete: false,
    finalCheckComplete: false,
    scienceSamples: 0,
    currentAlert: null,
    events: [],
    log: [{ day: 1, title: 'Crew arrival', detail: 'Outpost 86 is stable. Complete the commissioning checks.' }],
    objectiveHistory: [],
    finalScore: null,
    finalRating: null,
  };
}

function appendLog(state: MissionState, title: string, detail: string): void {
  state.log.unshift({ day: state.day, title, detail });
  state.log = state.log.slice(0, 40);
}

function addEvent(state: MissionState, event: MissionEvent): void {
  state.events.unshift(event);
  state.currentAlert = event.title;
}

export function currentObjective(state: MissionState): { title: string; detail: string; complete: boolean } {
  switch (state.day) {
    case 1:
      return {
        title: 'Commission the outpost',
        detail: 'Inspect the power console and life-support panel.',
        complete: state.powerInspected && state.lifeSupportInspected,
      };
    case 2:
      return {
        title: 'Plan around low sunlight',
        detail: 'Choose a power plan after the shadow warning.',
        complete: state.powerPlanConfirmed,
      };
    case 3:
      return {
        title: 'Restore water recovery',
        detail: 'Repair the recovery unit or activate water conservation.',
        complete: state.waterActionComplete,
      };
    case 4:
      return {
        title: 'Protect the crew',
        detail: 'Secure the radiation shelter and move the crew inside.',
        complete: state.shelterSecured,
      };
    case 5:
      return {
        title: 'Maintain the greenhouse',
        detail: 'Choose a growing or conservation schedule.',
        complete: state.greenhouseActionComplete,
      };
    case 6:
      return {
        title: 'Complete the science survey',
        detail: 'Reach the marked ridge and collect a training surface sample.',
        complete: state.surveyComplete,
      };
    default:
      return {
        title: 'Final systems assessment',
        detail: 'Run the final outpost checklist from the mission terminal.',
        complete: state.finalCheckComplete,
      };
  }
}

export function canAdvanceDay(state: MissionState): boolean {
  return state.status === 'active' && state.day < 7 && currentObjective(state).complete;
}

export function applyMissionAction(stateIn: MissionState, action: MissionAction): ActionResult {
  const state = clone(stateIn);
  if (state.status !== 'active') return { state, ok: false, message: 'This mission is no longer active.' };

  switch (action) {
    case 'inspect-power':
      state.powerInspected = true;
      appendLog(state, 'Power inspected', 'Solar generation, battery reserve and electrical demand are now on the mission checklist.');
      return { state, ok: true, title: 'Power system inspected', message: 'Generation and demand are visible. The solar array is the main source; the battery covers shortfalls.' };
    case 'inspect-life-support':
      state.lifeSupportInspected = true;
      appendLog(state, 'Life support inspected', 'Oxygen supply, cabin-air condition and carbon-dioxide removal were checked separately.');
      return { state, ok: true, title: 'Life support checked', message: 'Oxygen supply and air-cleaning functions are related, but they are not the same system.' };
    case 'choose-power-balanced':
    case 'choose-power-conserve':
    case 'choose-power-research': {
      const plan: PowerPlan = action.replace('choose-power-', '') as PowerPlan;
      state.powerPlan = plan;
      state.powerPlanConfirmed = true;
      const event = state.events.find((item) => item.id === 'low-sunlight');
      if (event) event.resolved = true;
      state.currentAlert = null;
      state.powerDemand = plan === 'conserve' ? 13 : plan === 'research' ? 21 : 16;
      appendLog(state, `Power plan: ${plan}`, `Electrical demand target set to ${state.powerDemand} training units per day.`);
      const explanation = plan === 'conserve'
        ? 'Lower demand protects the battery, but greenhouse growth and optional science work slow down.'
        : plan === 'research'
          ? 'More optional work can run, but the battery drains faster when sunlight is limited.'
          : 'A middle path keeps core systems steady while leaving some room for optional work.';
      return { state, ok: true, title: 'Power plan saved', message: explanation };
    }
    case 'repair-water': {
      if (state.battery < 8) return { state, ok: false, message: 'Battery reserve is too low for this repair. Use the conserve power plan first.' };
      state.battery = clamp(state.battery - 8);
      state.waterRecovery = clamp(state.waterRecovery + 34);
      state.waterActionComplete = true;
      const event = state.events.find((item) => item.id === 'water-malfunction');
      if (event) event.resolved = true;
      state.currentAlert = null;
      state.waterConservation = false;
      appendLog(state, 'Water recovery repaired', 'The crew spent stored energy to restore the recovery unit.');
      return { state, ok: true, title: 'Recovery unit repaired', message: 'Recovery condition improved. The repair used 8 battery points; recovered water can now offset more daily use.' };
    }
    case 'conserve-water': {
      state.waterConservation = true;
      state.waterActionComplete = true;
      const event = state.events.find((item) => item.id === 'water-malfunction');
      if (event) event.resolved = true;
      state.currentAlert = null;
      appendLog(state, 'Water conservation enabled', 'A reduced-use schedule was selected instead of an equipment repair.');
      return { state, ok: true, title: 'Conservation schedule active', message: 'Daily water use is lower, but greenhouse activity must share the reduced water budget.' };
    }
    case 'secure-shelter': {
      if (state.day < 4) return { state, ok: false, message: 'The radiation shelter procedure is scheduled for Day 4, when Mission Control issues the warning.' };
      state.shelterSecured = true;
      const radiationEvent = state.events.find((event) => event.id === 'radiation-warning' && !event.resolved);
      if (radiationEvent) radiationEvent.resolved = true;
      state.currentAlert = null;
      appendLog(state, 'Radiation shelter secured', 'External work paused and the crew moved to the designated shielded area.');
      return { state, ok: true, title: 'Shelter procedure completed', message: 'The crew is in the designated protected area. The shelter reduces exposure; it does not remove radiation.' };
    }
    case 'greenhouse-grow': {
      state.greenhousePlan = 'grow';
      state.greenhouseActionComplete = true;
      const event = state.events.find((item) => item.id === 'greenhouse-maintenance');
      if (event) event.resolved = true;
      state.currentAlert = null;
      appendLog(state, 'Greenhouse growth schedule selected', 'Water and electrical power were allocated to the crop-growth cycle.');
      return { state, ok: true, title: 'Growth cycle selected', message: 'Plant growth takes time and uses water and electricity. The greenhouse supplements stored food; it does not replace it instantly.' };
    }
    case 'greenhouse-conserve': {
      state.greenhousePlan = 'conserve';
      state.greenhouseActionComplete = true;
      const event = state.events.find((item) => item.id === 'greenhouse-maintenance');
      if (event) event.resolved = true;
      state.currentAlert = null;
      appendLog(state, 'Greenhouse conservation selected', 'The greenhouse was placed in a reduced-power maintenance schedule.');
      return { state, ok: true, title: 'Greenhouse conserved', message: 'This protects water and power reserves, but plant growth will be slower.' };
    }
    case 'complete-survey': {
      state.surveyComplete = true;
      state.scienceSamples += 1;
      const event = state.events.find((item) => item.id === 'science-survey');
      if (event) event.resolved = true;
      state.currentAlert = null;
      appendLog(state, 'Surface survey complete', 'One simulated regolith sample was logged for classroom interpretation.');
      return { state, ok: true, title: 'Survey sample collected', message: 'Regolith is the loose material covering solid lunar rock. This is a training sample, not a real lunar measurement.' };
    }
    case 'thermal-service':
      if (state.battery < 5) return { state, ok: false, message: 'Not enough battery reserve for a thermal-system service cycle.' };
      state.battery = clamp(state.battery - 5);
      state.thermal = clamp(state.thermal + 20);
      appendLog(state, 'Thermal system serviced', 'Stored energy was used to improve the habitat thermal-control condition.');
      return { state, ok: true, title: 'Thermal system serviced', message: 'Thermal control helps equipment and habitat systems stay within their intended operating conditions.' };
    case 'crew-rest':
      state.crewReadiness = clamp(state.crewReadiness + 10);
      appendLog(state, 'Crew rest period completed', 'A scheduled rest period improved operational readiness.');
      return { state, ok: true, title: 'Rest period complete', message: 'Rest supports attention and safe task performance. This meter is a game indicator, not a medical assessment.' };
    case 'final-check':
      if (state.day < 7) return { state, ok: false, message: 'The final assessment is only available on mission day 7.' };
      state.finalCheckComplete = true;
      state.status = 'completed';
      const score = calculateMissionScore(state);
      state.finalScore = score;
      state.finalRating = score >= 82 ? 'Mission completed — strong systems leadership' : score >= 62 ? 'Mission completed — review the debrief' : 'Mission completed — more practice recommended';
      appendLog(state, 'Mission assessment complete', `Final training score: ${score}/100.`);
      state.objectiveHistory.push('Final systems assessment complete');
      return { state, ok: true, title: 'Mission complete', message: 'The seven-day training mission is complete. Review the debrief to see how your decisions affected the outpost.' };
  }
}

function simulateEndOfDay(state: MissionState): void {
  const generation = state.solarGeneration;
  const demand = state.powerDemand;
  const surplus = generation - demand;
  state.battery = clamp(state.battery + surplus * 1.15);

  // The simulation separates oxygen supply from air revitalisation and CO2 control.
  const powerHealthy = state.battery > 10;
  state.oxygen = clamp(state.oxygen + (powerHealthy ? 1.6 : -5.5));
  state.cabinAir = clamp(state.cabinAir + (state.cabinAir > 60 && powerHealthy ? 0.4 : -4));
  state.co2Control = clamp(state.co2Control + (powerHealthy ? 0.7 : -5));

  const dailyWaterUse = state.waterConservation ? 3.5 : 5.1;
  const recoveredWater = (state.waterRecovery / 100) * 4.4;
  state.water = clamp(state.water + recoveredWater - dailyWaterUse);

  const greenhouseWaterCost = state.greenhousePlan === 'grow' ? 1.1 : state.greenhousePlan === 'conserve' ? 0.25 : 0;
  state.water = clamp(state.water - greenhouseWaterCost);
  state.food = clamp(state.food - 5 + (state.greenhouseProgress >= 100 ? 12 : 0));
  if (state.greenhouseProgress >= 100) state.greenhouseProgress = 15;
  if (state.greenhousePlan === 'grow' && powerHealthy && state.water > 18) {
    state.greenhouseProgress = clamp(state.greenhouseProgress + (state.powerPlan === 'conserve' ? 14 : 24));
  } else if (state.greenhousePlan === 'conserve') {
    state.greenhouseProgress = clamp(state.greenhouseProgress + 4);
  }

  state.thermal = clamp(state.thermal + (powerHealthy ? -1 : -8));
  state.crewReadiness = clamp(state.crewReadiness - 1.5);
  if (state.crewReadiness < 55) state.crewReadiness = clamp(state.crewReadiness + 2);

  if (state.battery < 8) {
    state.currentAlert = 'Low battery reserve';
    appendLog(state, 'Low battery warning', 'Power demand exceeded reliable supply. Review optional loads and essential-system priority.');
  }
  if (state.water < 20) state.currentAlert = 'Water reserve low';
}

export function advanceMissionDay(stateIn: MissionState): ActionResult {
  const state = clone(stateIn);
  if (!canAdvanceDay(state)) {
    return { state, ok: false, message: 'Complete the current day objective before advancing.' };
  }
  const completedDay = state.day;
  simulateEndOfDay(state);
  state.objectiveHistory.push(`Day ${completedDay}: ${currentObjective(state).title}`);
  state.day += 1;
  state.waterActionComplete = false;
  state.greenhouseActionComplete = false;

  if (state.day === 2) {
    state.solarGeneration = 12;
    addEvent(state, {
      id: 'low-sunlight', day: 2, title: 'Long-shadow power window',
      description: 'The low Sun and local terrain shadow reduce solar-array output. Battery reserve must cover the shortfall.',
      severity: 'warning', resolved: false,
    });
    appendLog(state, 'Solar generation reduced', 'A training shadow event lowered solar generation to 12 units per day.');
  } else if (state.day === 3) {
    state.solarGeneration = 20;
    state.waterRecovery = clamp(state.waterRecovery - 22);
    addEvent(state, {
      id: 'water-malfunction', day: 3, title: 'Water recovery malfunction',
      description: 'A filter-stage fault lowers the recovery unit condition. Repair it or reduce water use.',
      severity: 'warning', resolved: false,
    });
  } else if (state.day === 4) {
    addEvent(state, {
      id: 'radiation-warning', day: 4, title: 'Solar radiation warning',
      description: 'Mission Control has issued a training warning. Pause outside work and move the crew to the designated shelter.',
      severity: 'critical', resolved: false,
    });
  } else if (state.day === 5) {
    addEvent(state, {
      id: 'greenhouse-maintenance', day: 5, title: 'Greenhouse maintenance window',
      description: 'A nutrient-delivery check is due. Choose a growth or conservation schedule.',
      severity: 'info', resolved: false,
    });
  } else if (state.day === 6) {
    addEvent(state, {
      id: 'science-survey', day: 6, title: 'Science survey opportunity',
      description: 'A marked ridge sample point is ready for a short training survey.',
      severity: 'info', resolved: false,
    });
  } else if (state.day === 7) {
    state.currentAlert = 'Final assessment ready';
    appendLog(state, 'Final day', 'Run the final systems checklist to complete the mission.');
  }
  appendLog(state, `Mission day ${state.day}`, currentObjective(state).detail);
  return { state, ok: true, title: `Day ${state.day} started`, message: currentObjective(state).detail };
}

export function calculateMissionScore(state: MissionState): number {
  const averageSafety = (state.oxygen + state.cabinAir + state.co2Control + state.thermal + state.crewReadiness) / 5;
  const resourceScore = (state.water + state.food + state.battery) / 3;
  const equipmentScore = (state.waterRecovery + (state.powerInspected ? 100 : 0) + (state.lifeSupportInspected ? 100 : 0)) / 3;
  const procedureScore = (state.shelterSecured ? 100 : 35) + (state.surveyComplete ? 100 : 0) + (state.powerPlanConfirmed ? 100 : 0);
  return Math.round(clamp(averageSafety * 0.34 + resourceScore * 0.28 + equipmentScore * 0.18 + (procedureScore / 3) * 0.2));
}
