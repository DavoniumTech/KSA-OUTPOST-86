/** Lightweight, deterministic rocket workshop rules for the Orbital Frontier game. */
export interface RocketConfiguration {
  crewCapsule: boolean;
  mainEngine: boolean;
  fuelTank: boolean;
  booster: boolean;
  landingLegs: boolean;
  sciencePayload: boolean;
  communications: boolean;
}

export interface RocketMetrics {
  mass: number;
  fuel: number;
  thrust: number;
  stability: number;
  readiness: boolean;
  notes: string[];
}

export const DEFAULT_ROCKET: Readonly<RocketConfiguration> = Object.freeze({
  crewCapsule: true,
  mainEngine: true,
  fuelTank: true,
  booster: true,
  landingLegs: true,
  sciencePayload: true,
  communications: true,
});

export const ROCKET_PARTS: ReadonlyArray<{ id: keyof RocketConfiguration; title: string; detail: string; mass: number; fuel: number; thrust: number }> = [
  { id: 'crewCapsule', title: 'Crew capsule', detail: 'Protects the four-person expedition crew.', mass: 1250, fuel: 0, thrust: 0 },
  { id: 'mainEngine', title: 'Main engine', detail: 'Provides the primary launch thrust.', mass: 980, fuel: 0, thrust: 78 },
  { id: 'fuelTank', title: 'Main fuel tank', detail: 'Stores the propellant for ascent and transfer.', mass: 720, fuel: 72, thrust: 0 },
  { id: 'booster', title: 'Side boosters', detail: 'Adds launch thrust for heavier payloads.', mass: 860, fuel: 28, thrust: 46 },
  { id: 'landingLegs', title: 'Landing legs', detail: 'Supports a controlled surface arrival.', mass: 340, fuel: 0, thrust: 0 },
  { id: 'sciencePayload', title: 'Science payload', detail: 'Carries instruments for surface discoveries.', mass: 260, fuel: 0, thrust: 0 },
  { id: 'communications', title: 'Communications array', detail: 'Maintains mission telemetry and crew contact.', mass: 95, fuel: 0, thrust: 0 },
];

export function calculateRocketMetrics(config: RocketConfiguration): RocketMetrics {
  const installed = ROCKET_PARTS.filter((part) => config[part.id]);
  const mass = 1800 + installed.reduce((sum, part) => sum + part.mass, 0);
  const fuel = installed.reduce((sum, part) => sum + part.fuel, 0);
  const thrust = installed.reduce((sum, part) => sum + part.thrust, 0);
  const notes: string[] = [];
  if (!config.crewCapsule) notes.push('Add a crew capsule before carrying astronauts.');
  if (!config.mainEngine) notes.push('A main engine is required for launch.');
  if (!config.fuelTank) notes.push('Install the main fuel tank.');
  if (!config.communications) notes.push('Install communications for a safe mission link.');
  if (!config.landingLegs) notes.push('Landing legs are recommended for surface missions.');
  if (!config.sciencePayload) notes.push('A science payload unlocks sample experiments.');
  const stability = Math.max(0, Math.min(100, 100 - Math.max(0, mass - 6000) / 85 - (config.booster ? 0 : 7)));
  const readiness = config.crewCapsule && config.mainEngine && config.fuelTank && config.communications && fuel >= 72 && thrust >= 78;
  if (readiness && notes.length === 0) notes.push('All essential systems are ready for the expedition.');
  return { mass: Math.round(mass), fuel, thrust, stability: Math.round(stability), readiness, notes };
}

export function buildStandardRocket(): RocketConfiguration {
  return { ...DEFAULT_ROCKET };
}
