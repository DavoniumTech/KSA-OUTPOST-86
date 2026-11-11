import './styles.css';
import {
  advanceMissionDay,
  applyMissionAction,
  createInitialMission,
  currentObjective,
  type MissionAction,
  type MissionState,
} from './game/simulation';
import { loadMission, loadSettings, saveMission, saveSettings, type GameSettings } from './game/storage';
import { answerMissionQuestion } from './game/assistant';
import {
  advanceMarsDay,
  applyMarsAction,
  createMarsMission,
  loadMarsMission,
  marsObjective,
  saveMarsMission,
  type FrontierAction,
  type FrontierMissionState,
} from './game/frontierSimulation';
import { createLanderState, startLander, stepLander, type LanderControls, type LanderState } from './game/lander';
import { createAudioManager } from './game/audio';
import { createBabylonWorld, type BabylonWorld, type CameraMode, type GraphicsQuality, type Planet } from './engine/babylonWorld';
import { createCanvasFallback } from './engine/canvasFallback';

const canvas = document.querySelector<HTMLCanvasElement>('#world-canvas');
const appRoot = document.querySelector<HTMLElement>('#ui-root');
if (!canvas || !appRoot) throw new Error('Application shell is incomplete.');

type View = 'home' | 'missions' | 'planets' | 'outpost' | 'crew' | 'explore' | 'science' | 'journal' | 'settings' | 'lander';
const navItems: Array<{ id: View; label: string; icon: string }> = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'missions', label: 'Missions', icon: '◎' },
  { id: 'planets', label: 'Worlds', icon: '◉' },
  { id: 'outpost', label: 'Outpost', icon: '⌖' },
  { id: 'crew', label: 'Crew', icon: '♙' },
  { id: 'explore', label: 'Explore', icon: '⌁' },
];
const crew = [
  { id: 'amara', name: 'Amara Okafor', role: 'Commander', specialty: 'Mission operations', skill: 94, color: 'coral', task: 'Command & systems' },
  { id: 'yusuf', name: 'Yusuf Bello', role: 'Flight engineer', specialty: 'Power & habitat', skill: 91, color: 'blue', task: 'Power systems' },
  { id: 'zara', name: 'Zara Mensah', role: 'Astrobiologist', specialty: 'Greenhouse & samples', skill: 96, color: 'sage', task: 'Science operations' },
  { id: 'kofi', name: 'Kofi Adeyemi', role: 'Geologist', specialty: 'Rover & terrain', skill: 89, color: 'gold', task: 'Surface exploration' },
];

let view: View = 'home';
let storedPlanet = 'mars';
try { storedPlanet = localStorage.getItem('ksa-outpost-86-world-v1') || 'mars'; } catch { storedPlanet = 'mars'; }
let planet: Planet = storedPlanet as Planet;
if (!['earth', 'moon', 'mars'].includes(planet)) planet = 'mars';
let lunarMission: MissionState = loadMission() ?? createInitialMission();
let marsMission: FrontierMissionState = loadMarsMission() ?? createMarsMission();
let settings: GameSettings = loadSettings();
let world: BabylonWorld | null = null;
let worldLoading = true;
let worldError = '';
let toast: { title: string; body: string; tone: string } | null = null;
let crewAssignments: Record<string, string> = (() => {
  try { return JSON.parse(localStorage.getItem('ksa-outpost-86-crew-v1') || '{}') as Record<string, string>; }
  catch { return {}; }
})();
let audioEnabled = true;
try { audioEnabled = localStorage.getItem('ksa-outpost-86-audio-v1') !== 'false'; } catch { audioEnabled = true; }
const audio = createAudioManager(import.meta.env.BASE_URL);
let assistantReply = 'Mission Control is online. Ask about the current objective, life support, power, water or planetary operations.';
let assistantContext = 'OFFLINE KNOWLEDGE BASE';
let lander: LanderState = createLanderState();
let landerControls: LanderControls = { throttle: 0, lateral: 0 };
let landerFrame = 0;
let lastLanderTime = 0;

const esc = (value: string): string => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
const clamp = (value: number): number => Math.min(100, Math.max(0, value));
const formatPlanet = (value: Planet): string => value === 'earth' ? 'Earth orbit' : value === 'moon' ? 'Lunar surface' : 'Mars surface';

function notify(title: string, body: string, tone = 'success'): void {
  toast = { title, body, tone };
  audio.play(tone === 'warning' ? 'warning' : tone === 'success' ? 'success' : 'radio');
  renderToast();
  window.setTimeout(() => {
    toast = null;
    renderToast();
  }, 4200);
}

function renderToast(): void {
  const existing = document.querySelector<HTMLElement>('#toast-host');
  if (!existing) return;
  existing.innerHTML = toast ? `<div class="toast toast-${esc(toast.tone)}"><span class="toast-dot"></span><div><strong>${esc(toast.title)}</strong><p>${esc(toast.body)}</p></div><button class="toast-close" data-action="dismiss-toast" aria-label="Dismiss notification">×</button></div>` : '';
}

function navButton(item: { id: View; label: string; icon: string }): string {
  return `<button class="nav-item ${view === item.id ? 'active' : ''}" data-action="navigate" data-value="${item.id}" aria-current="${view === item.id ? 'page' : 'false'}"><span class="nav-icon">${item.icon}</span><span>${item.label}</span></button>`;
}

function renderHeader(): string {
  return `<header class="topbar">
    <button class="brand-lockup" data-action="navigate" data-value="home" aria-label="KSA Outpost 86 home">
      <span class="brand-mark"><span></span><span></span><span></span></span>
      <span class="brand-copy"><strong>KSA <em>OUTPOST 86</em></strong><small>ORBITAL FRONTIER</small></span>
    </button>
    <div class="topbar-center"><span class="live-indicator"></span><span>EXPEDITION SYSTEMS</span><span class="topbar-divider"></span><span>${esc(formatPlanet(planet).toUpperCase())}</span></div>
    <div class="topbar-right"><span class="connection-label"><i></i> LOCAL SYSTEMS READY</span><button class="icon-button" data-action="navigate" data-value="settings" aria-label="Settings">⚙</button><span class="crew-avatar-mini">K</span></div>
  </header>`;
}

function renderBottomNav(): string {
  return `<nav class="bottom-nav" aria-label="Primary navigation">${navItems.map(navButton).join('')}<button class="nav-item nav-more ${view === 'science' || view === 'journal' || view === 'settings' || view === 'lander' ? 'active' : ''}" data-action="more-menu"><span class="nav-icon">···</span><span>More</span></button></nav>`;
}

function progressRing(value: number, label: string, unit = '%'): string {
  const safe = clamp(value);
  return `<div class="progress-ring" style="--progress:${safe * 3.6}deg"><div><strong>${Math.round(safe)}${unit}</strong><small>${label}</small></div></div>`;
}

function meter(label: string, value: number, meta: string, accent = 'copper'): string {
  const safe = clamp(value);
  return `<div class="metric-row"><div class="metric-copy"><span>${label}</span><strong>${Math.round(safe)}<small>%</small></strong></div><div class="metric-track"><span class="metric-fill ${accent}" style="width:${safe}%"></span></div><small class="metric-meta">${meta}</small></div>`;
}

function planetSelector(): string {
  return `<div class="planet-switcher" aria-label="Select planetary destination">
    <button data-action="planet" data-value="earth" class="planet-choice ${planet === 'earth' ? 'selected' : ''}"><span class="planet-dot earth-dot"></span><span>Earth</span></button>
    <button data-action="planet" data-value="moon" class="planet-choice ${planet === 'moon' ? 'selected' : ''}"><span class="planet-dot moon-dot"></span><span>Moon</span></button>
    <button data-action="planet" data-value="mars" class="planet-choice ${planet === 'mars' ? 'selected' : ''}"><span class="planet-dot mars-dot"></span><span>Mars</span></button>
  </div>`;
}

function renderHome(): string {
  return `<section class="home-view view-enter">
    <div class="hero-content">
      <div class="hero-copy">
        <div class="eyebrow"><span class="eyebrow-line"></span> KSA OUTPOST 86 <span class="eyebrow-tag">FIELD OPERATIONS / 01</span></div>
        <h1>A new world<br><span>is waiting.</span></h1>
        <p class="hero-description">Lead your crew beyond Earth. Build a living outpost. Explore the unknown with a mission that responds to every decision.</p>
        <div class="hero-actions"><button class="primary-cta" data-action="begin-expedition"><span>Begin expedition</span><b>↗</b></button><button class="text-cta" data-action="navigate" data-value="planets">Explore the worlds <span>→</span></button></div>
        <div class="hero-facts"><div><strong>03</strong><span>PLANETARY WORLDS</span></div><i></i><div><strong>07</strong><span>MISSION DAYS</span></div><i></i><div><strong>04</strong><span>CREW SPECIALISTS</span></div></div>
      </div>
      <aside class="hero-brief glass-surface">
        <div class="brief-top"><span class="brief-kicker">FEATURED EXPEDITION</span><span class="status-pill"><i></i> READY FOR DEPLOYMENT</span></div>
        <div class="brief-world">MARS <span>·</span> 01</div>
        <h2>The red frontier</h2>
        <p>Seven days to establish a stable habitat, protect the crew and complete the first ridge survey.</p>
        <div class="brief-stats"><div><span>CREW</span><strong>04 <small>specialists</small></strong></div><div><span>DURATION</span><strong>07 <small>sols</small></strong></div><div><span>OBJECTIVES</span><strong>06 <small>primary</small></strong></div></div>
        <button class="brief-link" data-action="start-mars">Open mission briefing <span>↗</span></button>
      </aside>
    </div>
    <div class="hero-bottom"><div class="scene-caption"><span class="caption-pulse"></span><span>LIVE ENVIRONMENT</span><span class="caption-divider"></span><strong>${esc(formatPlanet(planet).toUpperCase())}</strong><span class="caption-coordinate">18° 25′ N / 77° 12′ E</span></div>${planetSelector()}</div>
    <div class="hero-next"><span>SCROLL TO DISCOVER</span><span class="scroll-line"></span></div>
    <div class="world-renderer-tag">${worldLoading ? 'INITIALISING 3D ENVIRONMENT' : world ? `${esc(world.rendererName.toUpperCase())} RENDERER · ${esc(planet.toUpperCase())}` : '2D MISSION FALLBACK'}</div>
    ${worldError ? `<div class="renderer-notice">${esc(worldError)} · The mission interface remains available.</div>` : ''}
    <div class="home-continuation"><div><span class="section-kicker">YOUR NEXT CHAPTER</span><h2>Three worlds.<br><em>One human ambition.</em></h2></div><p>From the blue edge of Earth to the silent lunar south pole and the rust-coloured plains of Mars, each expedition is a new test of ingenuity.</p><div class="continuation-actions"><button data-action="navigate" data-value="missions">View expeditions ↗</button><button data-action="navigate" data-value="science">Explore mission science ↗</button></div></div>
  </section>`;
}

function renderMissionCard(id: string, title: string, planetName: string, description: string, status: string, tag: string, action: string): string {
  return `<article class="mission-feature mission-${id}"><div class="mission-card-top"><span>${tag}</span><span class="mission-status">${status}</span></div><div class="mission-card-body"><span class="section-kicker">${planetName}</span><h3>${title}</h3><p>${description}</p><button data-action="${action}">Open expedition <span>↗</span></button></div></article>`;
}

function renderMissions(): string {
  const moonComplete = lunarMission.status === 'completed';
  const marsComplete = marsMission.status === 'completed';
  return `<section class="page-view view-enter"><div class="page-heading"><div><span class="section-kicker">MISSION ARCHIVE / ACTIVE OPERATIONS</span><h1>Choose your <em>expedition.</em></h1><p>Every world presents a different engineering challenge. Select a mission to review its briefing and begin operations.</p></div><div class="heading-index">01 <span>/ 03</span></div></div>
    <div class="mission-grid">
      ${renderMissionCard('earth', 'Departure protocol', 'EARTH ORBIT', 'Prepare the crew, verify the vehicle and begin the journey beyond Earth.', 'PRE-FLIGHT', '01 · TRANSIT', 'start-earth')}
      ${renderMissionCard('moon', 'First Light', 'LUNAR SOUTH POLE', 'Restore the systems of a polar outpost through seven days of changing sunlight, water and radiation conditions.', moonComplete ? 'COMPLETED' : hasMoonStatus(), '02 · LUNAR', 'start-moon')}
      ${renderMissionCard('mars', 'The red frontier', 'MARS EXPEDITION', 'Establish a stable surface habitat, respond to a regional dust front and complete a geological rover survey.', marsComplete ? 'COMPLETED' : hasMarsStatus(), '03 · MARTIAN', 'start-mars')}
    </div>
    <div class="mission-note"><span class="note-icon">✳</span><div><strong>Training environment, real engineering ideas.</strong><p>Resource values and event outcomes are simplified educational models. They are not spacecraft specifications or operational procedures.</p></div></div>
  </section>`;
}

function hasMoonStatus(): string { return lunarMission.status === 'active' ? `DAY ${lunarMission.day} / 7` : 'READY'; }
function hasMarsStatus(): string { return marsMission.status === 'active' ? `DAY ${marsMission.day} / 7` : 'READY'; }

function renderPlanets(): string {
  const items: Array<{ id: Planet; name: string; sub: string; stat: string; detail: string; fact: string }> = [
    { id: 'earth', name: 'Earth', sub: 'THE DEPARTURE POINT', stat: '1 AU', detail: 'A living blue world. Prepare the crew, review the vehicle and plot a cinematic departure into orbit.', fact: 'Launch & orbital operations' },
    { id: 'moon', name: 'The Moon', sub: 'THE LUNAR FRONTIER', stat: '384,400 km', detail: 'A rugged polar landscape of cratered highlands, long shadows, resource constraints and the distant blue Earth.', fact: 'South-pole habitat mission' },
    { id: 'mars', name: 'Mars', sub: 'THE RED FRONTIER', stat: '225M km', detail: 'A cold desert world of ancient terrain, dust, distant mesas and the challenge of sustaining a crew far from Earth.', fact: 'Seven-sol outpost expedition' },
  ];
  const selected = items.find((item) => item.id === planet) ?? items[2];
  return `<section class="page-view planets-view view-enter"><div class="page-heading"><div><span class="section-kicker">PLANETARY ATLAS / 03 DESTINATIONS</span><h1>Beyond the <em>horizon.</em></h1><p>Choose a destination to inspect its environment, mission profile and exploration opportunities.</p></div><div class="heading-index">02 <span>/ 03</span></div></div>
    <div class="planet-selector-large">${items.map((item) => `<button data-action="planet" data-value="${item.id}" class="planet-selector-item ${planet === item.id ? 'selected' : ''}"><span class="planet-art ${item.id}"></span><span class="planet-item-copy"><small>${item.sub}</small><strong>${item.name}</strong></span><span class="planet-item-arrow">↗</span></button>`).join('')}</div>
    <div class="planet-detail-panel"><div class="planet-detail-copy"><span class="section-kicker">${selected.sub}</span><h2>${selected.name}<span> / ${selected.stat}</span></h2><p>${selected.detail}</p><div class="planet-fact"><span>MISSION PROFILE</span><strong>${selected.fact}</strong></div><button class="primary-cta compact" data-action="${planet === 'earth' ? 'start-earth' : planet === 'moon' ? 'start-moon' : 'start-mars'}">Select destination <b>↗</b></button></div><div class="planet-visual ${planet}"><div class="planet-orbit"></div><div class="planet-sphere"></div><div class="planet-glow"></div><span class="planet-visual-label">${planet.toUpperCase()} / SURFACE MODEL</span></div></div>
  </section>`;
}

function getMetricState(): Array<{ label: string; value: number; meta: string; accent: string }> {
  if (planet === 'mars') return [
    { label: 'Oxygen supply', value: marsMission.oxygen, meta: 'Life-support reserve', accent: 'blue' },
    { label: 'Water reserves', value: marsMission.water, meta: `${Math.round(marsMission.waterRecovery)}% recovery condition`, accent: 'teal' },
    { label: 'Power reserve', value: marsMission.battery, meta: `${marsMission.solarGeneration} units · solar generation`, accent: 'gold' },
    { label: 'Food stores', value: marsMission.food, meta: 'Stored food inventory', accent: 'copper' },
    { label: 'Habitat integrity', value: marsMission.habitat, meta: 'Pressure & structure training meter', accent: 'sage' },
    { label: 'Crew readiness', value: marsMission.crewReadiness, meta: 'Operational readiness indicator', accent: 'violet' },
  ];
  return [
    { label: 'Oxygen supply', value: lunarMission.oxygen, meta: 'Life-support reserve', accent: 'blue' },
    { label: 'Water reserves', value: lunarMission.water, meta: `${Math.round(lunarMission.waterRecovery)}% recovery condition`, accent: 'teal' },
    { label: 'Power reserve', value: lunarMission.battery, meta: `${lunarMission.solarGeneration} units · solar generation`, accent: 'gold' },
    { label: 'Food stores', value: lunarMission.food, meta: 'Stored food inventory', accent: 'copper' },
    { label: 'Cabin air', value: lunarMission.cabinAir, meta: `${Math.round(lunarMission.co2Control)}% CO₂ control condition`, accent: 'sage' },
    { label: 'Crew readiness', value: lunarMission.crewReadiness, meta: 'Operational readiness indicator', accent: 'violet' },
  ];
}

function renderObjectiveActions(): string {
  if (planet === 'mars') {
    const objective = marsObjective(marsMission);
    let actions = '';
    switch (marsMission.day) {
      case 1: actions = buttonAction('Inspect integrated systems', 'inspect-systems', marsMission.systemsInspected); break;
      case 2: actions = `${buttonAction('Conserve essential power', 'power-conserve', marsMission.powerPlanConfirmed && marsMission.powerPlan === 'conserve')} ${buttonAction('Maintain balanced operations', 'power-balanced', marsMission.powerPlanConfirmed && marsMission.powerPlan === 'balanced')} ${buttonAction('Clean solar arrays', 'clean-arrays', marsMission.arraysServiced)}`; break;
      case 3: actions = `${buttonAction('Repair water recovery · 10 power', 'repair-water', marsMission.waterActionComplete)} ${buttonAction('Activate water conservation', 'conserve-water', marsMission.waterActionComplete)}`; break;
      case 4: actions = buttonAction('Secure radiation shelter', 'secure-shelter', marsMission.shelterSecured); break;
      case 5: actions = `${buttonAction('Run greenhouse growth cycle', 'greenhouse-grow', marsMission.greenhouseActionComplete)} ${buttonAction('Conserve greenhouse power', 'greenhouse-hold', marsMission.greenhouseActionComplete)}`; break;
      case 6: actions = `${buttonAction('Deploy expedition rover', 'deploy-rover', marsMission.roverDeployed)} ${buttonAction('Collect ridge sample', 'collect-sample', marsMission.sampleCollected)}`; break;
      default: actions = buttonAction('Run final assessment', 'final-assessment', marsMission.finalAssessmentComplete);
    }
    return `<div class="objective-panel"><div class="objective-top"><span class="section-kicker">DAY ${marsMission.day} / 7 · PRIMARY OBJECTIVE</span><span class="objective-state ${objective.complete ? 'complete' : ''}">${objective.complete ? 'COMPLETE' : 'IN PROGRESS'}</span></div><h3>${objective.title}</h3><p>${objective.detail}</p><div class="objective-actions">${actions}</div>${marsMission.day < 7 ? `<button class="advance-button" data-action="advance-day" ${objective.complete ? '' : 'disabled'}>Complete day ${marsMission.day} <span>→</span></button>` : ''}</div>`;
  }
  const objective = currentObjective(lunarMission);
  let actions = '';
  switch (lunarMission.day) {
    case 1: actions = `${buttonAction('Inspect power console', 'inspect-power', lunarMission.powerInspected)} ${buttonAction('Inspect life support', 'inspect-life-support', lunarMission.lifeSupportInspected)}`; break;
    case 2: actions = `${buttonAction('Conserve power', 'choose-power-conserve', lunarMission.powerPlanConfirmed && lunarMission.powerPlan === 'conserve')} ${buttonAction('Balanced plan', 'choose-power-balanced', lunarMission.powerPlanConfirmed && lunarMission.powerPlan === 'balanced')} ${buttonAction('Research priority', 'choose-power-research', lunarMission.powerPlanConfirmed && lunarMission.powerPlan === 'research')}`; break;
    case 3: actions = `${buttonAction('Repair water recovery', 'repair-water', lunarMission.waterActionComplete)} ${buttonAction('Conserve water', 'conserve-water', lunarMission.waterActionComplete)}`; break;
    case 4: actions = buttonAction('Secure radiation shelter', 'secure-shelter', lunarMission.shelterSecured); break;
    case 5: actions = `${buttonAction('Grow crops', 'greenhouse-grow', lunarMission.greenhouseActionComplete)} ${buttonAction('Conserve greenhouse', 'greenhouse-conserve', lunarMission.greenhouseActionComplete)}`; break;
    case 6: actions = buttonAction('Collect survey sample', 'complete-survey', lunarMission.surveyComplete); break;
    default: actions = buttonAction('Run final assessment', 'final-check', lunarMission.finalCheckComplete);
  }
  return `<div class="objective-panel"><div class="objective-top"><span class="section-kicker">DAY ${lunarMission.day} / 7 · FIRST LIGHT</span><span class="objective-state ${objective.complete ? 'complete' : ''}">${objective.complete ? 'COMPLETE' : 'IN PROGRESS'}</span></div><h3>${objective.title}</h3><p>${objective.detail}</p><div class="objective-actions">${actions}</div>${lunarMission.day < 7 ? `<button class="advance-button" data-action="advance-day" ${objective.complete ? '' : 'disabled'}>Complete day ${lunarMission.day} <span>→</span></button>` : ''}</div>`;
}

function buttonAction(label: string, action: string, done: boolean): string {
  return `<button class="action-chip ${done ? 'done' : ''}" data-action="mission-action" data-value="${action}" ${done ? 'disabled' : ''}><span>${done ? '✓' : '+'}</span>${label}</button>`;
}

function renderOutpost(): string {
  const currentDay = planet === 'mars' ? marsMission.day : lunarMission.day;
  const status = planet === 'mars' ? marsMission.status : lunarMission.status;
  const metrics = getMetricState();
  const event = planet === 'mars' ? marsMission.events.find((item) => !item.resolved) : lunarMission.events.find((item) => !item.resolved);
  return `<section class="page-view view-enter"><div class="page-heading"><div><span class="section-kicker">SURFACE OPERATIONS / ${planet.toUpperCase()}</span><h1>Outpost <em>command.</em></h1><p>Monitor life-support, energy, habitat integrity and crew readiness. Every action changes the mission state.</p></div><div class="heading-index">03 <span>/ 07 SOLS</span></div></div>
    <div class="outpost-overview"><div class="outpost-status"><span class="status-pulse"></span><span>${status === 'completed' ? 'MISSION COMPLETE' : `MISSION ACTIVE · DAY ${currentDay} / 7`}</span><strong>${planet === 'mars' ? 'MARS / ARC-01' : planet === 'moon' ? 'LUNA / POLAR-01' : 'EARTH / ORBITAL'}</strong></div><div class="outpost-condition"><span>HABITAT CONDITION</span><strong>${Math.round(planet === 'mars' ? marsMission.habitat : lunarMission.thermal)}<small>%</small></strong></div></div>
    ${event ? `<div class="alert-banner ${event.severity}"><span>!</span><div><strong>${esc(event.title)}</strong><p>${esc('detail' in event ? event.detail : event.description)}</p></div><small>DAY ${event.day}</small></div>` : ''}
    <div class="resource-layout"><div class="resource-grid">${metrics.map((item) => meter(item.label, item.value, item.meta, item.accent)).join('')}</div><aside class="resource-side"><div class="resource-ring-wrap">${progressRing(planet === 'mars' ? marsMission.habitat : lunarMission.thermal, 'HABITAT')}</div><div><span class="section-kicker">MISSION OPERATIONS</span><p>Review the daily objective and choose an operation. The simulation updates power, supplies and crew condition as the mission progresses.</p></div><button class="secondary-button full" data-action="navigate" data-value="missions">Mission overview ↗</button></aside></div>
    ${renderObjectiveActions()}
  </section>`;
}

function renderCrew(): string {
  const readiness = planet === 'mars' ? marsMission.crewReadiness : lunarMission.crewReadiness;
  return `<section class="page-view view-enter"><div class="page-heading"><div><span class="section-kicker">HUMAN SYSTEMS / CREW MANIFEST</span><h1>People make <em>the mission.</em></h1><p>Four specialists. Different skills. Shared responsibility for the outpost and each other.</p></div><div class="heading-index">04 <span>/ CREW</span></div></div>
    <div class="crew-summary"><div><span>CREW ON DUTY</span><strong>04 <small>/ 04</small></strong></div><div><span>OPERATIONAL READINESS</span><strong>${Math.round(readiness)}<small>%</small></strong></div><div><span>ACTIVE DESTINATION</span><strong>${planet.toUpperCase()}</strong></div></div>
    <div class="crew-grid">${crew.map((member, index) => `<article class="crew-card"><div class="crew-portrait ${member.color}"><div class="portrait-helmet"><span></span></div><div class="portrait-body"></div><span class="portrait-index">0${index + 1}</span></div><div class="crew-info"><span class="section-kicker">${member.role}</span><h3>${member.name}</h3><p>${member.specialty}</p><div class="crew-skill"><span>PROFICIENCY</span><strong>${member.skill}%</strong></div><div class="crew-skill-track"><i style="width:${member.skill}%"></i></div><label class="crew-assignment">CURRENT ASSIGNMENT<select data-crew="${member.id}"><option ${((crewAssignments[member.id] ?? member.task) === member.task) ? 'selected' : ''}>${member.task}</option><option ${crewAssignments[member.id] === 'Habitat maintenance' ? 'selected' : ''}>Habitat maintenance</option><option ${crewAssignments[member.id] === 'Rover operations' ? 'selected' : ''}>Rover operations</option><option ${crewAssignments[member.id] === 'Science operations' ? 'selected' : ''}>Science operations</option><option ${crewAssignments[member.id] === 'Rest & recovery' ? 'selected' : ''}>Rest & recovery</option><option ${crewAssignments[member.id] === 'Power systems' ? 'selected' : ''}>Power systems</option><option ${crewAssignments[member.id] === 'Command & systems' ? 'selected' : ''}>Command & systems</option></select></label></div></article>`).join('')}</div>
    <div class="crew-note"><span>✳</span><p>Crew proficiencies are fictional training profiles. Assignments are currently recorded for the crew interface; the mission simulation uses its documented shared crew-readiness indicator.</p></div>
  </section>`;
}

function renderExplore(): string {
  const deployed = planet === 'mars' ? marsMission.roverDeployed : false;
  return `<section class="page-view view-enter"><div class="page-heading"><div><span class="section-kicker">SURFACE MOBILITY / EVA & ROVER</span><h1>Go beyond <em>the habitat.</em></h1><p>Prepare an exploration activity, deploy the rover and investigate a marked surface route.</p></div><div class="heading-index">05 <span>/ SURVEY</span></div></div>
    <div class="explore-hero"><div class="explore-copy"><span class="section-kicker">ROVER OPERATIONS / ${planet.toUpperCase()}</span><h2>Find what the<br><em>surface remembers.</em></h2><p>Remote mobility extends the crew's reach. Survey terrain, inspect geological features and bring useful science back to the outpost.</p><div class="explore-stats"><div><strong>06</strong><span>WHEELS / MOBILITY</span></div><div><strong>02</strong><span>CREW / EVA READY</span></div><div><strong>01</strong><span>RIDGE / TARGET</span></div></div></div><div class="rover-schematic"><div class="rover-disc"><div class="rover-body-shape"><i></i><i></i><i></i></div><div class="rover-wheel wheel-a"></div><div class="rover-wheel wheel-b"></div><div class="rover-wheel wheel-c"></div><div class="rover-wheel wheel-d"></div><div class="rover-wheel wheel-e"></div><div class="rover-wheel wheel-f"></div></div><span>ROVER / MK-VI FIELD UNIT</span></div></div>
    <div class="explore-controls"><article><span class="section-kicker">01 / DEPLOYMENT</span><h3>${deployed ? 'Rover deployed' : 'Prepare the rover'}</h3><p>${deployed ? 'The rover is on the survey route. Use the drive controls to move the 3D model.' : 'Deployment reserves mission energy and starts the surface survey operation.'}</p><button class="primary-cta compact" data-action="rover-deploy">${deployed ? 'Deploy again' : 'Deploy rover'} <b>↗</b></button></article><article><span class="section-kicker">02 / MOBILITY CONTROL</span><h3>Drive the route</h3><p>Move the rover model across the rendered surface. These controls are a simplified training interaction.</p><div class="drive-controls"><button data-action="rover-drive" data-value="-1" aria-label="Drive left">←</button><button data-action="rover-drive" data-value="1" aria-label="Drive right">→</button></div></article><article><span class="section-kicker">03 / SCIENCE RETURN</span><h3>Collect a sample</h3><p>Log a simulated geological sample after rover deployment and add it to the mission journal.</p><button class="secondary-button" data-action="collect-sample">Collect ridge sample ↗</button></article></div>
    <div class="eva-strip"><div><span class="section-kicker">EXTRA-VEHICULAR ACTIVITY</span><h3>Every step needs a plan.</h3><p>Check suit status, crew readiness, route distance and return reserves before authorising an EVA.</p></div><button class="secondary-button" data-action="eva-briefing">Open EVA checklist ↗</button></div>
  </section>`;
}

function renderScience(): string {
  return `<section class="page-view view-enter"><div class="page-heading"><div><span class="section-kicker">SCIENCE & LEARNING / MISSION KNOWLEDGE</span><h1>Curiosity is <em>our instrument.</em></h1><p>Understand the science behind the systems, the terrain and the decisions that keep an expedition moving.</p></div><div class="heading-index">06 <span>/ SCIENCE</span></div></div>
    <div class="science-layout"><div class="science-main"><article class="science-feature"><span class="section-kicker">FIELD NOTE / 001</span><h2>Build a world<br><em>that can sustain life.</em></h2><p>Off-world habitats depend on interconnected systems. Power supports life support, water recovery and food production. A failure in one subsystem can create pressure across the entire mission.</p><div class="science-tags"><span>HABITAT ENGINEERING</span><span>RESOURCE CYCLES</span><span>CREW SAFETY</span></div></article><div class="science-cards"><article><span class="science-symbol">◌</span><span class="section-kicker">LIFE SUPPORT</span><h3>Air is a system.</h3><p>Oxygen supply, cabin-air quality and carbon-dioxide removal are related but distinct functions.</p></article><article><span class="science-symbol">⌁</span><span class="section-kicker">IN-SITU RESOURCES</span><h3>Use what is there.</h3><p>Local materials, water ice and environmental resources may reduce dependence on Earth resupply.</p></article><article><span class="science-symbol">✳</span><span class="section-kicker">PLANETARY GEOLOGY</span><h3>Read the terrain.</h3><p>Crater forms, regolith and layered rock can preserve clues to the history of a planetary surface.</p></article></div></div><aside class="mission-control-panel"><div class="assistant-heading"><span class="assistant-orb">✳</span><div><strong>Mission Control</strong><small>OFFLINE KNOWLEDGE ASSISTANT</small></div><span class="assistant-status">READY</span></div><p class="assistant-intro">Ask a question about the mission. Replies use the local training knowledge base and current lunar mission state.</p><form id="assistant-form"><input name="question" placeholder="Ask about oxygen, power, water…" maxlength="240" autocomplete="off"/><button type="submit" aria-label="Ask Mission Control">↗</button></form><div class="assistant-reply"><small>${esc(assistantContext)}</small><p>${esc(assistantReply)}</p></div><div class="assistant-suggestions"><button data-action="assistant-suggest" data-value="What should I do next?">Next objective</button><button data-action="assistant-suggest" data-value="Explain life support">Life support</button><button data-action="assistant-suggest" data-value="Why is power important?">Power planning</button></div></aside></div>
    <div class="source-footer"><span class="section-kicker">SCIENTIFIC REFERENCE STARTING POINTS</span><div><a href="https://science.nasa.gov/eyes/" target="_blank" rel="noreferrer">NASA Eyes ↗</a><a href="https://science.nasa.gov/3d-resources/" target="_blank" rel="noreferrer">NASA 3D Resources ↗</a><a href="https://trek.nasa.gov/" target="_blank" rel="noreferrer">NASA Trek ↗</a><a href="https://api.nasa.gov/" target="_blank" rel="noreferrer">NASA APIs ↗</a></div><p>Independent educational simulation. Mission values are simplified training indicators, not real mission telemetry or engineering guidance.</p></div>
    <button class="text-cta lander-entry" data-action="navigate" data-value="lander">Open Lunar Lander Lab <span>↗</span></button>
  </section>`;
}

function renderJournal(): string {
  const entries = planet === 'mars' ? marsMission.log : lunarMission.log;
  const events = planet === 'mars' ? marsMission.events : lunarMission.events;
  return `<section class="page-view view-enter"><div class="page-heading"><div><span class="section-kicker">MISSION RECORD / FLIGHT JOURNAL</span><h1>Every decision <em>leaves a trace.</em></h1><p>Review the operational record and the events recorded during this expedition.</p></div><div class="heading-index">07 <span>/ LOG</span></div></div><div class="journal-layout"><div class="journal-timeline"><div class="journal-heading"><span>MISSION ACTIVITY</span><strong>${entries.length} ENTRIES</strong></div>${entries.map((entry) => `<article class="journal-entry"><span class="journal-day">DAY ${entry.day}</span><div><strong>${esc(entry.title)}</strong><p>${esc(entry.detail)}</p></div><i></i></article>`).join('')}</div><aside class="event-register"><span class="section-kicker">EVENT REGISTER</span><h3>Mission alerts</h3>${events.length ? events.map((event) => `<div class="event-entry ${event.severity}"><span>${event.resolved ? '✓' : '!'}</span><div><strong>${esc(event.title)}</strong><p>${esc('detail' in event ? event.detail : event.description)}</p><small>DAY ${event.day} · ${event.resolved ? 'RESOLVED' : 'OPEN'}</small></div></div>`).join('') : '<p class="muted-copy">No events recorded yet. Mission Control will log significant operational changes here.</p>'}</aside></div></section>`;
}

function renderSettings(): string {
  return `<section class="page-view view-enter"><div class="page-heading"><div><span class="section-kicker">APPLICATION / PREFERENCES</span><h1>Mission <em>preferences.</em></h1><p>Configure the visual experience, motion, saved data and application information.</p></div><div class="heading-index">08 <span>/ CONFIG</span></div></div>
    <div class="settings-layout"><article class="settings-group"><span class="section-kicker">RENDERING</span><h3>Graphics quality</h3><p>Lower quality reduces detail and GPU workload on less powerful devices.</p><div class="segmented-control">${(['low', 'medium', 'high'] as const).map((value) => `<button data-action="quality" data-value="${value}" class="${settings.quality === value ? 'selected' : ''}">${value === 'low' ? 'Performance' : value === 'medium' ? 'Balanced' : 'High'}</button>`).join('')}</div><div class="setting-row"><div><strong>Reduced motion</strong><small>Limit camera and environmental movement.</small></div><button class="toggle ${settings.reducedMotion ? 'on' : ''}" data-action="toggle-motion" aria-pressed="${settings.reducedMotion}"><i></i></button></div><div class="setting-row"><div><strong>Mission audio</strong><small>Enable ambience and interface sound effects.</small></div><button class="toggle ${audioEnabled ? 'on' : ''}" data-action="toggle-audio" aria-pressed="${audioEnabled}"><i></i></button></div><div class="setting-row"><div><strong>Renderer status</strong><small>${world ? esc(world.rendererName) : worldLoading ? 'Initialising renderer' : '2D fallback active'}</small></div><span class="setting-value">${world ? 'CONNECTED' : 'FALLBACK'}</span></div></article>
    <article class="settings-group"><span class="section-kicker">MISSION DATA</span><h3>Local progress</h3><p>Mission data is stored in this browser. It is not synchronized across devices.</p><div class="setting-row"><div><strong>Lunar First Light</strong><small>Day ${lunarMission.day} / 7 · ${lunarMission.status}</small></div><button class="text-link" data-action="navigate" data-value="missions">Open →</button></div><div class="setting-row"><div><strong>Mars Expedition</strong><small>Day ${marsMission.day} / 7 · ${marsMission.status}</small></div><button class="text-link" data-action="navigate" data-value="missions">Open →</button></div><button class="secondary-button danger-button" data-action="reset-saves">Reset local mission saves</button></article></div>
    <div class="about-strip"><div><span class="section-kicker">PROJECT IDENTITY</span><strong>KSA OUTPOST 86 / ORBITAL FRONTIER</strong><p>Independent educational planetary exploration experience. Not affiliated with or endorsed by NASA.</p></div><span class="version-label">BUILD 2.3 / FRONTIER</span></div>
  </section>`;
}

function renderLander(): string {
  const isReady = lander.phase === 'ready';
  return `<section class="page-view view-enter lander-view"><div class="page-heading"><div><span class="section-kicker">TRAINING MODULE / LUNAR DESCENT</span><h1>Lunar <em>lander lab.</em></h1><p>Practice a simplified two-dimensional descent. Manage vertical speed, lateral drift and fuel to reach the landing zone.</p></div><div class="heading-index">LAB <span>/ 01</span></div></div><div class="lander-layout"><div class="lander-visual"><div class="lander-sky"><div class="lander-moon"></div><div class="lander-craft" style="--lander-y:${Math.max(4, 80 - lander.altitude / 2.3)}%;--lander-x:${50 + lander.horizontalPosition * 0.32}%">▴</div><div class="lander-ground"></div><div class="landing-zone"></div></div><div class="lander-readouts"><div><span>ALTITUDE</span><strong>${lander.altitude.toFixed(1)}<small> m</small></strong></div><div><span>VERTICAL SPEED</span><strong>${lander.verticalVelocity.toFixed(1)}<small> m/s</small></strong></div><div><span>FUEL</span><strong>${Math.round(lander.fuel)}<small>%</small></strong></div><div><span>PHASE</span><strong>${lander.phase.toUpperCase()}</strong></div></div></div><aside class="lander-controls"><span class="section-kicker">FLIGHT CONTROLS</span><h3>Command the descent.</h3><p>Training parameters are intentionally simplified and do not represent a real flight dynamics model.</p><label>ENGINE THROTTLE <strong id="throttle-label">${Math.round(landerControls.throttle * 100)}%</strong><input id="throttle-control" type="range" min="0" max="100" value="${Math.round(landerControls.throttle * 100)}"/></label><label>LATERAL CONTROL <strong id="lateral-label">${Math.round(landerControls.lateral * 100)}%</strong><input id="lateral-control" type="range" min="-100" max="100" value="${Math.round(landerControls.lateral * 100)}"/></label><div class="lander-buttons"><button class="primary-cta compact" data-action="lander-start" ${lander.phase !== 'ready' ? 'disabled' : ''}>${isReady ? 'Start descent' : lander.phase === 'flight' ? 'In flight' : lander.phase.toUpperCase()} <b>↗</b></button><button class="secondary-button" data-action="lander-reset">Reset exercise</button></div><div class="landing-guidance">SAFE TOUCHDOWN TARGET <strong>≤ 3.0 m/s vertical · ≤ 2.0 m/s lateral</strong></div></aside></div><button class="text-cta" data-action="navigate" data-value="science">← Back to science</button></section>`;
}

function renderPage(): string {
  switch (view) {
    case 'home': return renderHome();
    case 'missions': return renderMissions();
    case 'planets': return renderPlanets();
    case 'outpost': return renderOutpost();
    case 'crew': return renderCrew();
    case 'explore': return renderExplore();
    case 'science': return renderScience();
    case 'journal': return renderJournal();
    case 'settings': return renderSettings();
    case 'lander': return renderLander();
  }
}

function render(): void {
  appRoot!.innerHTML = `${renderHeader()}<main class="app-main" id="app-main">${renderPage()}</main>${renderBottomNav()}<div id="toast-host" aria-live="polite"></div><div class="more-menu" id="more-menu" hidden><button data-action="navigate" data-value="science">Science & learning</button><button data-action="navigate" data-value="journal">Mission journal</button><button data-action="navigate" data-value="lander">Lunar Lander Lab</button><button data-action="navigate" data-value="settings">Settings</button></div>`;
  renderToast();
}

function setView(next: View): void {
  view = next;
  if (world) world.setPaused(next !== 'home' && next !== 'planets' && next !== 'explore');
  render();
  if (next === 'lander') startLanderLoop();
  else stopLanderLoop();
  window.scrollTo({ top: 0, behavior: settings.reducedMotion ? 'auto' : 'smooth' });
}

function persistPlanet(): void {
  try { localStorage.setItem('ksa-outpost-86-world-v1', planet); } catch { /* Planet selection remains active for this session. */ }
}

function setPlanet(next: Planet): void {
  planet = next;
  persistPlanet();
  if (world) world.setPlanet(next);
  render();
  notify('Destination changed', `${formatPlanet(next)} selected.`, 'info');
}

function startMission(destination: 'moon' | 'mars'): void {
  planet = destination;
  persistPlanet();
  if (destination === 'moon') {
    lunarMission = loadMission() ?? createInitialMission();
    saveMission(lunarMission);
  } else {
    marsMission = loadMarsMission() ?? createMarsMission();
    saveMarsMission(marsMission);
  }
  if (world) world.setPlanet(destination);
  view = 'outpost';
  render();
  notify('Mission briefing complete', `${destination === 'moon' ? 'First Light lunar' : 'Mars Frontier'} expedition is ready.`, 'success');
}

function beginEarthJourney(destination: 'moon' | 'mars' = 'mars'): void {
  planet = 'earth';
  persistPlanet();
  world?.setPlanet('earth');
  view = 'home';
  render();
  notify('Departure protocol', `Preparing the crew for the journey to ${destination.toUpperCase()}.`, 'info');
  if (world) {
    world.playJourney(destination, () => {
      planet = destination;
      persistPlanet();
      if (destination === 'moon') startMission('moon'); else startMission('mars');
    });
  } else {
    window.setTimeout(() => startMission(destination), 800);
  }
}

function applyLunarAction(action: MissionAction): void {
  const result = applyMissionAction(lunarMission, action);
  if (!result.ok) { notify('Action not completed', result.message, 'warning'); return; }
  lunarMission = result.state;
  saveMission(lunarMission);
  render();
  notify(result.title ?? 'System updated', result.message, 'success');
}

function applyMarsActionToMission(action: FrontierAction): void {
  const result = applyMarsAction(marsMission, action);
  if (!result.ok) { notify(result.title, result.message, 'warning'); return; }
  marsMission = result.state;
  saveMarsMission(marsMission);
  if (action === 'deploy-rover') world?.deployRover();
  render();
  notify(result.title, result.message, 'success');
}

function advanceDay(): void {
  if (planet === 'mars') {
    const result = advanceMarsDay(marsMission);
    if (!result.ok) { notify(result.title, result.message, 'warning'); return; }
    marsMission = result.state;
    saveMarsMission(marsMission);
    render();
    notify(result.title, result.message, 'info');
  } else {
    const result = advanceMissionDay(lunarMission);
    if (!result.ok) { notify('Objective incomplete', result.message, 'warning'); return; }
    lunarMission = result.state;
    saveMission(lunarMission);
    render();
    notify(result.title ?? 'Mission day advanced', result.message, 'info');
  }
}

function askAssistant(question: string): void {
  const normalized = question.trim().toLowerCase();
  if (planet === 'mars') {
    const objective = marsObjective(marsMission);
    assistantContext = `MARS DAY ${marsMission.day} / 7 · OFFLINE TRAINING KNOWLEDGE`;
    if (normalized.includes('objective') || normalized.includes('next') || normalized.includes('what should')) assistantReply = `${objective.title}. ${objective.detail} ${objective.complete ? 'This objective is complete; you can advance the mission day.' : 'Complete the objective before advancing.'}`;
    else if (normalized.includes('power') || normalized.includes('battery')) assistantReply = `Solar generation is ${marsMission.solarGeneration} training units and demand is ${marsMission.powerDemand}. Battery reserve is ${Math.round(marsMission.battery)}%. A conserve profile reduces optional loads during the dust front.`;
    else if (normalized.includes('water')) assistantReply = `Water reserve is ${Math.round(marsMission.water)}%. Recovery condition is ${Math.round(marsMission.waterRecovery)}%. On Day 3, repair the filter or activate conservation. Both choices have trade-offs.`;
    else if (normalized.includes('radiation') || normalized.includes('shelter')) assistantReply = `A solar weather alert is scheduled for Day 4. Stop outside work and secure the habitat shelter. This is an educational procedure, not radiation-dose guidance.`;
    else if (normalized.includes('rover') || normalized.includes('sample')) assistantReply = 'The Day 6 ridge survey requires rover deployment before a sample can be logged. Rover energy is deducted from the mission battery reserve.';
    else if (normalized.includes('crew') || normalized.includes('health')) assistantReply = `Crew readiness is ${Math.round(marsMission.crewReadiness)}%. Schedule rest to restore the training indicator. It is not a medical assessment.`;
    else assistantReply = 'I can explain the current Mars objective, energy planning, water recovery, radiation shelter, rover deployment and crew readiness. Ask about one of these systems.';
  } else {
    const reply = answerMissionQuestion(question, lunarMission, null);
    assistantReply = reply.answer;
    assistantContext = reply.context;
  }
  const container = document.querySelector<HTMLElement>('.assistant-reply');
  if (container) container.innerHTML = `<small>${esc(assistantContext)}</small><p>${esc(assistantReply)}</p>`;
}

function startLanderLoop(): void {
  if (landerFrame) cancelAnimationFrame(landerFrame);
  lastLanderTime = 0;
  const frame = (time: number): void => {
    if (view !== 'lander') return;
    if (!lastLanderTime) lastLanderTime = time;
    const delta = Math.min(0.05, (time - lastLanderTime) / 1000);
    lastLanderTime = time;
    if (lander.phase === 'flight') {
      lander = stepLander(lander, landerControls, delta);
      const craft = document.querySelector<HTMLElement>('.lander-craft');
      if (craft) {
        craft.style.setProperty('--lander-y', `${Math.max(4, 80 - lander.altitude / 2.3)}%`);
        craft.style.setProperty('--lander-x', `${50 + lander.horizontalPosition * 0.32}%`);
      }
      const readouts = document.querySelector<HTMLElement>('.lander-readouts');
      if (readouts) readouts.innerHTML = `<div><span>ALTITUDE</span><strong>${lander.altitude.toFixed(1)}<small> m</small></strong></div><div><span>VERTICAL SPEED</span><strong>${lander.verticalVelocity.toFixed(1)}<small> m/s</small></strong></div><div><span>FUEL</span><strong>${Math.round(lander.fuel)}<small>%</small></strong></div><div><span>PHASE</span><strong>${lander.phase.toUpperCase()}</strong></div>`;
      if (lander.phase !== 'flight') notify(lander.phase === 'landed' ? 'Safe touchdown' : 'Landing unsuccessful', lander.phase === 'landed' ? 'The training lander reached the target zone inside the safe speed limits.' : 'The lander exceeded a training touchdown or boundary limit. Reset and try again.', lander.phase === 'landed' ? 'success' : 'warning');
    }
    landerFrame = requestAnimationFrame(frame);
  };
  landerFrame = requestAnimationFrame(frame);
}

function stopLanderLoop(): void {
  if (landerFrame) cancelAnimationFrame(landerFrame);
  landerFrame = 0;
}

function handleClick(event: MouseEvent): void {
  const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-action]') : null;
  if (!target) return;
  const action = target.dataset.action ?? '';
  const value = target.dataset.value ?? '';
  switch (action) {
    case 'navigate': setView(value as View); break;
    case 'planet': if (['earth', 'moon', 'mars'].includes(value)) setPlanet(value as Planet); break;
    case 'begin-expedition': beginEarthJourney(planet === 'moon' ? 'moon' : 'mars'); break;
    case 'start-earth': setPlanet('earth'); setView('planets'); break;
    case 'start-moon': beginEarthJourney('moon'); break;
    case 'start-mars': beginEarthJourney('mars'); break;
    case 'more-menu': {
      const menu = document.querySelector<HTMLElement>('#more-menu');
      if (menu) menu.hidden = !menu.hidden;
      break;
    }
    case 'dismiss-toast': toast = null; renderToast(); break;
    case 'mission-action': {
      if (planet === 'mars') applyMarsActionToMission(value as FrontierAction);
      else applyLunarAction(value as MissionAction);
      break;
    }
    case 'advance-day': advanceDay(); break;
    case 'rover-deploy':
      if (planet === 'mars') applyMarsActionToMission('deploy-rover');
      else { world?.deployRover(); notify('Rover deployed', 'The lunar rover has been released to the marked route.', 'success'); }
      break;
    case 'rover-drive': world?.driveRover(Number(value)); notify('Rover movement', 'Drive command sent to the surface vehicle.', 'info'); break;
    case 'collect-sample':
      if (planet === 'mars') applyMarsActionToMission('collect-sample');
      else applyLunarAction('complete-survey');
      break;
    case 'eva-briefing': notify('EVA checklist', 'Confirm crew readiness, suit condition, route distance, communications and return reserves before leaving the habitat.', 'info'); break;
    case 'quality':
      if (value === 'low' || value === 'medium' || value === 'high') {
        settings = { ...settings, quality: value };
        saveSettings(settings);
        world?.setGraphicsQuality(value as GraphicsQuality);
        render();
        notify('Graphics profile updated', `${value.toUpperCase()} rendering selected.`, 'success');
      }
      break;
    case 'toggle-audio':
      audioEnabled = !audioEnabled;
      audio.setEnabled(audioEnabled);
      render();
      notify('Audio preference updated', audioEnabled ? 'Mission ambience and interface effects enabled.' : 'Mission audio muted.', 'info');
      break;
    case 'toggle-motion':
      settings = { ...settings, reducedMotion: !settings.reducedMotion };
      saveSettings(settings);
      world?.setReducedMotion(settings.reducedMotion);
      document.documentElement.classList.toggle('reduce-motion', settings.reducedMotion);
      render();
      break;
    case 'reset-saves':
      if (window.confirm('Reset both local training mission saves on this device? This cannot be undone.')) {
        localStorage.removeItem('ksa-outpost-86-mission-v1');
        localStorage.removeItem('ksa-outpost-86-mars-mission-v1');
        lunarMission = createInitialMission();
        marsMission = createMarsMission();
        render();
        notify('Mission saves reset', 'New training campaigns are ready.', 'info');
      }
      break;
    case 'assistant-suggest': askAssistant(value); break;
    case 'lander-start': lander = startLander(lander); startLanderLoop(); render(); break;
    case 'lander-reset': lander = createLanderState(); landerControls = { throttle: 0, lateral: 0 }; render(); startLanderLoop(); break;
    case 'camera': world?.setCameraMode(value as CameraMode); break;
    default: break;
  }
}

appRoot.addEventListener('click', handleClick);
appRoot.addEventListener('submit', (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== 'assistant-form') return;
  event.preventDefault();
  const input = form.elements.namedItem('question');
  if (input instanceof HTMLInputElement) {
    askAssistant(input.value);
    input.value = '';
  }
});
appRoot.addEventListener('input', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.id === 'throttle-control') {
    landerControls = { ...landerControls, throttle: Number(target.value) / 100 };
    const label = document.querySelector<HTMLElement>('#throttle-label');
    if (label) label.textContent = `${target.value}%`;
  }
  if (target instanceof HTMLInputElement && target.id === 'lateral-control') {
    landerControls = { ...landerControls, lateral: Number(target.value) / 100 };
    const label = document.querySelector<HTMLElement>('#lateral-label');
    if (label) label.textContent = `${target.value}%`;
  }
  if (target instanceof HTMLSelectElement && target.dataset.crew) {
    crewAssignments[target.dataset.crew] = target.value;
    try { localStorage.setItem('ksa-outpost-86-crew-v1', JSON.stringify(crewAssignments)); } catch { /* The assignment remains in memory for this session. */ }
    if (planet === 'mars') {
      if (target.value === 'Rest & recovery') marsMission.crewReadiness = clamp(marsMission.crewReadiness + 4);
      if (target.value === 'Habitat maintenance') marsMission.habitat = clamp(marsMission.habitat + 2);
      if (target.value === 'Power systems') marsMission.battery = clamp(marsMission.battery + 2);
      marsMission.log.unshift({ day: marsMission.day, title: 'Crew assignment updated', detail: `${target.dataset.crew} assigned to ${target.value}.` });
      saveMarsMission(marsMission);
    } else {
      if (target.value === 'Rest & recovery') lunarMission.crewReadiness = clamp(lunarMission.crewReadiness + 4);
      lunarMission.log.unshift({ day: lunarMission.day, title: 'Crew assignment updated', detail: `${target.dataset.crew} assigned to ${target.value}.` });
      saveMission(lunarMission);
    }
    notify('Crew assignment updated', `${target.dataset.crew} assigned to ${target.value}. Mission readiness and systems are updated where relevant.`, 'info');
  }
});

render();
document.documentElement.classList.toggle('reduce-motion', settings.reducedMotion);
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {
    // The mission remains usable if PWA caching is unavailable.
  });
}
void createBabylonWorld(canvas, { baseUrl: import.meta.env.BASE_URL, quality: settings.quality, reducedMotion: settings.reducedMotion })
  .then((createdWorld) => {
    world = createdWorld;
    worldLoading = false;
    world.setPlanet(planet);
    world.setGraphicsQuality(settings.quality);
    world.setReducedMotion(settings.reducedMotion);
    world.setPaused(!(view === 'home' || view === 'planets' || view === 'explore'));
    render();
  })
  .catch((error: unknown) => {
    worldLoading = false;
    worldError = error instanceof Error ? error.message : 'Babylon.js could not initialise.';
    const fallbackCanvas = canvas.cloneNode(false) as HTMLCanvasElement;
    fallbackCanvas.id = 'world-canvas';
    canvas.replaceWith(fallbackCanvas);
    try {
      world = createCanvasFallback(fallbackCanvas, settings.reducedMotion);
      world.setPlanet(planet);
      world.setPaused(!(view === 'home' || view === 'planets' || view === 'explore'));
    } catch {
      world = null;
    }
    render();
    notify('3D environment unavailable', 'Babylon.js could not load. A lightweight planetary scene is active; all mission systems remain available.', 'warning');
  });

window.addEventListener('pagehide', () => {
  saveMission(lunarMission);
  saveMarsMission(marsMission);
  world?.destroy();
  audio.destroy();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) world?.setPaused(true);
  else if (view === 'home' || view === 'planets' || view === 'explore') world?.setPaused(false);
});
