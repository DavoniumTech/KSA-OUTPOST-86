import {
  advanceMissionDay,
  applyMissionAction,
  createInitialMission,
  currentObjective,
  type MissionAction,
  type MissionState,
} from '../game/simulation';
import {
  advanceMarsDay,
  applyMarsAction,
  createMarsMission,
  loadMarsMission,
  marsObjective,
  saveMarsMission,
  type FrontierAction,
  type FrontierMissionState,
} from '../game/frontierSimulation';
import { answerMissionQuestion } from '../game/assistant';
import { createAudioManager } from '../game/audio';
import { loadMission, loadSettings, saveMission, saveSettings } from '../game/storage';
import { createBabylonWorld, type BabylonWorld, type CameraMode, type GraphicsQuality, type Planet, type Interactable } from '../engine/babylonWorld';
import { createCanvasFallback } from '../engine/canvasFallback';
import { createLanderState, startLander, stepLander, type LanderControls, type LanderState } from '../game/lander';
import { DEFAULT_ROCKET, ROCKET_PARTS, buildStandardRocket, calculateRocketMetrics, type RocketConfiguration } from '../game/rocket';

type Theme = 'light' | 'dark' | 'glass';
type View = 'onboarding' | 'home' | 'universe' | 'rocket' | 'game' | 'missions' | 'worlds' | 'outpost' | 'crew' | 'explore' | 'science' | 'journal' | 'settings' | 'lander' | 'account';
type StationId = 'oxygen' | 'power' | 'water' | 'greenhouse' | 'science' | 'command' | 'airlock' | 'exit-habitat' | 'rover' | 'shelter';
type CrewRole = 'Commander' | 'Pilot' | 'Systems Engineer' | 'Science Specialist';

interface PlayerProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  theme: Theme;
  onboardingComplete: boolean;
}

interface PlayerProgress {
  xp: number;
  badges: string[];
}

const root = document.querySelector<HTMLElement>('#ui-root');
const canvas = document.querySelector<HTMLCanvasElement>('#world-canvas');
if (!root || !canvas) throw new Error('KSA OUTPOST 86 application shell is incomplete.');

const esc = (value: string): string => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
const clamp = (value: number): number => Math.max(0, Math.min(100, value));
const planets: Planet[] = ['earth', 'moon', 'mars'];
const ONBOARDING_KEY = 'ksa-outpost-86-onboarding-v35';
const crew: Array<{ id: string; name: string; role: CrewRole; skill: number; specialty: string; avatar: string }> = [
  { id: 'amara', name: 'Amara Okafor', role: 'Commander', skill: 94, specialty: 'Mission operations', avatar: 'AO' },
  { id: 'muhammad', name: 'Muhammad Imran', role: 'Pilot', skill: 91, specialty: 'Flight operations', avatar: 'MI' },
  { id: 'shuaib', name: 'Shuaib', role: 'Systems Engineer', skill: 96, specialty: 'Power & life support', avatar: 'SH' },
  { id: 'jafar', name: 'Jafar', role: 'Science Specialist', skill: 89, specialty: 'Rover & samples', avatar: 'JF' },
];
const NAV: Array<{ view: View; label: string; icon: string }> = [
  { view: 'home', label: 'Home', icon: '⌂' },
  { view: 'missions', label: 'Missions', icon: '✦' },
  { view: 'worlds', label: 'Worlds', icon: '◉' },
  { view: 'outpost', label: 'Outpost', icon: '⌂' },
  { view: 'crew', label: 'Crew', icon: '♙' },
  { view: 'explore', label: 'Explore', icon: '⌁' },
];

let settings = loadSettings();
const constrainedDevice = window.matchMedia('(max-width: 760px)').matches || (navigator.hardwareConcurrency || 8) <= 4 || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;
if (constrainedDevice && settings.quality === 'medium') { settings = { ...settings, quality: 'low' }; saveSettings(settings); }
let theme: Theme = (() => {
  try { const value = localStorage.getItem('ksa-outpost-86-theme-v3'); return value === 'dark' || value === 'glass' ? value : 'light'; } catch { return 'light'; }
})();
let selectedPlanet: Planet = (() => {
  try { const value = localStorage.getItem('ksa-outpost-86-world-v1'); return planets.includes(value as Planet) ? value as Planet : 'mars'; } catch { return 'mars'; }
})();
let view: View = (() => {
  // V3.5 introduces a new hands-on tutorial; do not let completion of an older
  // menu-only tutorial silently skip the new playable onboarding.
  try { return localStorage.getItem(ONBOARDING_KEY) === 'complete' ? 'home' : 'onboarding'; } catch { return 'onboarding'; }
})();
let onboardingStep = 1;
let onboardingPlanet: Planet = selectedPlanet === 'earth' ? 'mars' : selectedPlanet;
let onboardingChecks = new Set<string>();
let world: BabylonWorld | null = null;
let worldLoading = true;
let worldError = '';
let vehicleMode = false;
let currentStation: Interactable | null = null;
let showMoreMenu = false;
let toastTimer = 0;
let toast: { title: string; body: string; tone: 'success' | 'warning' | 'info' } | null = null;
let stationModal: StationId | null = null;
let oxygenCalibration = '';
let solarCalibration = '';
let greenhouseCalibration = '';
let authMode: 'login' | 'register' = 'login';
let account: PlayerProfile | null = null;
let accountBusy = false;
let serverStatus: 'checking' | 'ready' | 'unavailable' = 'checking';
let liveSocket: WebSocket | null = null;
let notificationHistory: Array<{ title: string; body: string; time: number; tone: string }> = [];
let notificationsOpen = false;
let browserAlertsEnabled = false;
try { browserAlertsEnabled = localStorage.getItem('ksa-outpost-86-browser-alerts-v1') === 'true'; } catch { browserAlertsEnabled = false; }
let mission: MissionState = loadMission() ?? createInitialMission();
let mars: FrontierMissionState = loadMarsMission() ?? createMarsMission();
let audioEnabled = true;
try { audioEnabled = localStorage.getItem('ksa-outpost-86-audio-v1') !== 'false'; } catch { audioEnabled = true; }
const audio = createAudioManager(import.meta.env.BASE_URL);
let lander: LanderState = createLanderState();
let landerControls: LanderControls = { throttle: 0.45, lateral: 0 };
let landerFrame = 0;
let lastLanderFrame = 0;
let hudTimer = 0;
let playerAssignments: Record<string, string> = {};
try { playerAssignments = JSON.parse(localStorage.getItem('ksa-outpost-86-crew-v1') || '{}') as Record<string, string>; } catch { playerAssignments = {}; }
const PROGRESS_KEY = 'ksa-outpost-86-player-progress-v1';
let playerProgress: PlayerProgress = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null') as Partial<PlayerProgress> | null;
    return { xp: Number.isFinite(saved?.xp) ? Math.max(0, Math.floor(saved!.xp!)) : 0, badges: Array.isArray(saved?.badges) ? saved!.badges!.filter((item): item is string => typeof item === 'string').slice(0, 80) : [] };
  } catch { return { xp: 0, badges: [] }; }
})();
const ROCKET_CONFIG_KEY = 'ksa-outpost-86-rocket-config-v1';
let rocketConfig: RocketConfiguration = (() => {
  try {
    const stored = JSON.parse(localStorage.getItem(ROCKET_CONFIG_KEY) || 'null') as Partial<RocketConfiguration> | null;
    return { ...DEFAULT_ROCKET, ...(stored ?? {}) };
  } catch { return { ...DEFAULT_ROCKET }; }
})();
let rocketLaunchBusy = false;
let rocketCountdown = 0;
let rocketCountdownTimer = 0;
function persistPlayerProgress(): void {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(playerProgress)); } catch { /* progress remains in memory for this session */ }
  if (account) void syncPlayerSave();
}
function awardXP(amount: number, reason: string): void {
  const points = Math.max(0, Math.floor(amount));
  if (!points) return;
  playerProgress = { ...playerProgress, xp: Math.min(999999, playerProgress.xp + points) };
  persistPlayerProgress();
  toastMessage(`+${points} XP earned`, reason, 'success');
}
function unlockBadge(id: string, _title: string, points = 0): boolean {
  if (playerProgress.badges.includes(id)) return false;
  playerProgress = { ...playerProgress, badges: [...playerProgress.badges, id].slice(-80) };
  if (points > 0) playerProgress.xp = Math.min(999999, playerProgress.xp + points);
  persistPlayerProgress();
  return true;
}
function saveRocketConfiguration(): void {
  try { localStorage.setItem(ROCKET_CONFIG_KEY, JSON.stringify(rocketConfig)); } catch { /* current session remains playable */ }
  world?.setRocketConfiguration(rocketConfig);
}
function rocketStats() { return calculateRocketMetrics(rocketConfig); }

function currentDay(): number { return selectedPlanet === 'mars' ? mars.day : mission.day; }
function currentResources(): Array<{ id: string; label: string; value: number; suffix?: string }> {
  const s = selectedPlanet === 'mars' ? mars : mission;
  return [
    { id: 'oxygen', label: 'Oxygen', value: s.oxygen },
    { id: 'power', label: 'Power', value: s.battery },
    { id: 'water', label: 'Water', value: s.water },
    { id: 'food', label: 'Food', value: s.food },
  ];
}
function objective(): { title: string; detail: string; complete: boolean } {
  return selectedPlanet === 'mars' ? marsObjective(mars) : currentObjective(mission);
}
function persistPlanet(): void { try { localStorage.setItem('ksa-outpost-86-world-v1', selectedPlanet); } catch { /* session remains usable */ } }
function persistTheme(): void { try { localStorage.setItem('ksa-outpost-86-theme-v3', theme); } catch { /* session remains usable */ } }
function setTheme(value: Theme): void {
  theme = value; persistTheme();
  if (account) { account = { ...account, theme: value }; saveProfileLocally(); void updateAccountProfile({ theme: value }); }
  document.documentElement.dataset.theme = value;
  render();
  toastMessage('Appearance updated', `${value === 'light' ? 'Light Explorer' : value === 'dark' ? 'Dark Cosmos' : 'Glass Blue'} is now active.`, 'success');
}
function saveCurrentMission(): void {
  saveMission(mission); saveMarsMission(mars);
  if (account) void syncPlayerSave();
}
function toastMessage(title: string, body: string, tone: 'success' | 'warning' | 'info' = 'info', broadcast = true): void {
  toast = { title, body, tone };
  notificationHistory.unshift({ title, body, time: Date.now(), tone });
  notificationHistory = notificationHistory.slice(0, 40);
  if (tone === 'warning') audio.play('warning'); else if (tone === 'success') audio.play('success'); else audio.play('radio');
  if (browserAlertsEnabled && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification(`KSA OUTPOST 86 · ${title}`, { body, icon: `${import.meta.env.BASE_URL}favicon.svg`, tag: `ksa-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` }); } catch { /* browser notifications are an optional enhancement */ }
  }
  renderToast();
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast = null; renderToast(); }, 5200);
  if (account && broadcast) void fetch('/api/player/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body, tone }) }).catch(() => undefined);
}
function renderToast(): void {
  const host = document.querySelector<HTMLElement>('#toast-host');
  if (!host) return;
  host.innerHTML = toast ? `<div class="toast toast-${toast.tone}" role="status"><span class="toast-mark">${toast.tone === 'warning' ? '!' : toast.tone === 'success' ? '✓' : '✦'}</span><div><strong>${esc(toast.title)}</strong><p>${esc(toast.body)}</p></div><button class="toast-close" data-action="dismiss-toast" aria-label="Dismiss">×</button></div>` : '';
}
function bar(label: string, value: number): string {
  const v = clamp(value);
  const status = v < 24 ? 'critical' : v < 48 ? 'caution' : 'healthy';
  return `<div class="resource-meter"><div class="resource-meter-label"><span>${label}</span><strong>${Math.round(v)}%</strong></div><div class="resource-track"><i class="${status}" style="width:${v}%"></i></div></div>`;
}
function brand(): string {
  return `<button class="brand" data-action="navigate" data-view="home" aria-label="KSA Outpost home"><span class="brand-emblem"><b>86</b></span><span class="brand-words"><strong>KSA <i>OUTPOST 86</i></strong><small>ORBITAL FRONTIER</small></span></button>`;
}
function header(): string {
  const name = account?.name ?? 'Guest commander';
  return `<header class="app-header">${brand()}<div class="header-center"><span class="live-dot"></span><span>${serverStatus === 'ready' ? 'ACCOUNT SYSTEMS ONLINE' : serverStatus === 'checking' ? 'CHECKING SYSTEMS' : 'GUEST SYSTEMS'}</span><i></i><strong>${view === 'rocket' ? 'ROCKET WORKSHOP' : view === 'universe' ? 'SOLAR SYSTEM' : `${selectedPlanet.toUpperCase()} ${view === 'game' ? `· DAY ${currentDay()}/7` : '· READY'}`}</strong></div><div class="header-actions"><button class="header-more" data-action="toggle-more" aria-label="More features" aria-expanded="${showMoreMenu}"><span>•••</span><small>MORE</small></button><button class="header-alert" data-action="notifications" aria-label="Notifications" aria-expanded="${notificationsOpen}">♢<span>${notificationHistory.filter((n) => n.tone !== 'info').length || ''}</span></button><button class="profile-button" data-action="account"><span class="profile-avatar">${esc(account?.avatar ?? 'G')}</span><span class="profile-name">${esc(name)}</span><b>⌄</b></button></div></header>`;
}
function bottomNavigation(): string {
  if (view === 'onboarding' || view === 'account' || view === 'lander') return '';
  return `<nav class="bottom-nav" aria-label="Main navigation">${NAV.map((item) => `<button class="nav-item ${view === item.view || (view === 'science' || view === 'journal' || view === 'settings') && item.view === 'explore' ? 'active' : ''}" data-action="navigate" data-view="${item.view}" aria-current="${view === item.view ? 'page' : 'false'}"><span class="nav-glyph">${item.icon}</span><span>${item.label}</span></button>`).join('')}</nav>`;
}
function commonMain(content: string): string {
  const notificationPanel = notificationsOpen ? `<div class="notification-backdrop" data-action="close-notifications"><section class="notification-panel" role="dialog" aria-modal="true" aria-label="Mission notifications" data-notification-panel><div class="notification-panel-head"><div><span class="eyebrow-pill">MISSION CONTROL</span><h2>Command updates</h2></div><button class="modal-close" data-action="close-notifications">×</button></div>${notificationHistory.length ? notificationHistory.slice(0, 20).map((n) => `<article class="notification-entry ${esc(n.tone)}"><i></i><div><strong>${esc(n.title)}</strong><p>${esc(n.body)}</p><small>${new Date(n.time).toLocaleString()}</small></div></article>`).join('') : `<div class="notification-empty"><strong>All quiet, Commander.</strong><p>Mission Control updates and system warnings will appear here.</p></div>`}<button class="secondary-button" data-action="navigate" data-view="journal">Open mission journal →</button></section></div>` : '';
  return `${header()}<main class="app-main ${view === 'game' ? 'game-main' : ''}" id="app-main">${content}</main>${bottomNavigation()}<div id="more-popover" class="more-popover ${showMoreMenu ? 'open' : ''}"><button data-action="open-universe">3D Solar system</button><button data-action="open-rocket">Rocket workshop</button><button data-action="navigate" data-view="science">Science lab</button><button data-action="navigate" data-view="journal">Mission journal</button><button data-action="navigate" data-view="lander">Lunar Lander Lab</button><button data-action="navigate" data-view="settings">Settings</button></div>${notificationPanel}<div id="toast-host" aria-live="polite"></div>`;
}

function renderOnboarding(): string {
  const completed = onboardingChecks.size;
  const steps = [
    { n: 1, title: 'MEET YOUR CREW', sub: 'Your adventure starts together.' },
    { n: 2, title: 'CHOOSE YOUR WORLD', sub: 'Three worlds. Three different challenges.' },
    { n: 3, title: 'LEARN TO COMMAND', sub: 'Get to know oxygen, power and water.' },
  ];
  const stepContent = onboardingStep === 1
    ? `<div class="onboard-art-copy"><span class="eyebrow-pill">01 / THE CREW</span><h1>Welcome aboard,<br><em>Commander.</em></h1><p>Your crew is ready to explore. You'll travel to new worlds, repair your habitat and discover the science behind every mission.</p><div class="crew-intro-strip">${crew.map((member, i) => `<div class="crew-mini crew-mini-${i}"><span>${member.avatar}</span><div><strong>${member.name}</strong><small>${member.role}</small></div></div>`).join('')}</div><p class="onboard-tip">Explore the animated solar system behind this panel. Your crew will join you on the first expedition.</p><button class="primary-button" data-action="onboard-next">Meet my crew <b>→</b></button></div>`
    : onboardingStep === 2
      ? `<div class="onboard-art-copy"><span class="eyebrow-pill">02 / DESTINATION SELECTION</span><h1>Where will<br>you <em>explore?</em></h1><p>Watch the planets orbit the Sun, then choose where your first rocket will take you.</p><div class="planet-pick-grid">${(['earth','moon','mars'] as Planet[]).map((p) => `<button class="planet-pick ${onboardingPlanet === p ? 'selected' : ''}" data-action="onboard-planet" data-value="${p}"><span class="planet-orb ${p}"></span><strong>${p.toUpperCase()}</strong><small>${p === 'earth' ? 'ORBITAL GATEWAY' : p === 'moon' ? 'LUNAR SOUTH POLE' : 'THE RED FRONTIER'}</small><i>${onboardingPlanet === p ? 'SELECTED ✓' : 'EXPLORE →'}</i></button>`).join('')}</div><div class="onboard-actions"><button class="quiet-button" data-action="onboard-back">Back</button><button class="primary-button" data-action="onboard-next">Continue <b>→</b></button></div></div>`
      : `<div class="onboard-art-copy"><span class="eyebrow-pill">03 / FIRST SYSTEM CHECK</span><h1>Learn to<br><em>command.</em></h1><p>Walk to each glowing station. When you are close, press E or tap INTERACT to activate it. Complete all three to earn your first badge.</p><div class="training-stations">${[
        { id:'oxygen', icon:'O₂', name:'Oxygen', detail:'Keep breathable air systems healthy.' },
        { id:'power', icon:'ϟ', name:'Power', detail:'Balance sunlight, batteries and demand.' },
        { id:'water', icon:'H₂O', name:'Water', detail:'Recover water and protect reserves.' },
      ].map((station) => `<button class="training-station ${onboardingChecks.has(station.id) ? 'checked' : ''}" data-action="onboard-focus" data-value="${station.id}"><span>${station.icon}</span><div><strong>${station.name}</strong><small>${station.detail}</small></div><b>${onboardingChecks.has(station.id) ? '✓ DONE' : 'WAYPOINT ↗'}</b></button>`).join('')}</div><div class="onboard-actions"><button class="quiet-button" data-action="onboard-back">Back</button><button class="primary-button" data-action="finish-onboarding" ${completed < 3 ? 'disabled' : ''}>Start my adventure <b>→</b></button></div><small class="onboard-completion">${completed}/3 training systems checked ${completed === 3 ? '· COMMANDER BADGE UNLOCKED' : ''}</small></div>`;
  return `<section class="onboarding-screen"><div class="onboarding-scene-note"><span class="scene-pulse"></span> LIVE 3D ENVIRONMENT <span>DRAG TO LOOK AROUND</span></div><div class="onboarding-layout"><div class="onboarding-main">${stepContent}</div><aside class="onboarding-progress"><div class="progress-header"><strong>YOUR FIRST FLIGHT</strong><span>STEP 0${onboardingStep} / 03</span></div><div class="onboarding-track"><i style="width:${(onboardingStep/3)*100}%"></i></div>${steps.map((step) => `<div class="onboarding-step ${onboardingStep === step.n ? 'current' : onboardingStep > step.n ? 'done' : ''}"><b>${onboardingStep > step.n ? '✓' : `0${step.n}`}</b><div><strong>${step.title}</strong><small>${step.sub}</small></div></div>`).join('')}<div class="onboarding-footer"><span>DESIGNED FOR FIRST-TIME EXPLORERS</span><button data-action="skip-onboarding">Skip tutorial ↗</button></div></aside></div>${onboardingStep === 3 ? `<div class="onboard-guided-controls"><div id="onboarding-interaction-hint" class="interaction-hint"><span class="keycap">W A S D</span><div><strong>Walk to the glowing stations</strong><small>Choose a waypoint, walk close, then press E or tap INTERACT.</small></div></div><div class="onboard-control-hints"><kbd>W A S D</kbd><span>MOVE</span><kbd>SHIFT</kbd><span>RUN</span><kbd>E</kbd><span>INTERACT</span></div><div class="onboard-touch-controls"><div class="touch-joystick" id="move-joystick" aria-label="Move astronaut"><span class="joystick-ring"></span><span class="joystick-knob" id="move-knob"></span></div><button data-action="mobile-interact">INTERACT</button></div></div>` : ''}<div class="onboarding-brand">KSA OUTPOST 86 <span>·</span> ORBITAL FRONTIER</div></section>`;
}

function renderHome(): string {
  const day = selectedPlanet === 'mars' ? mars.day : mission.day;
  const progress = selectedPlanet === 'mars' ? Math.round(((day - 1) / 7) * 100) : Math.round(((day - 1) / 7) * 100);
  return `<section class="home-world view-enter"><div class="home-shade"></div><div class="home-copy"><span class="eyebrow-pill"><i class="scene-pulse"></i> KSA OUTPOST 86 · ORBITAL FRONTIER</span><h1>Your universe.<br><em>Your next adventure.</em></h1><p>Become an astronaut, explore living planetary worlds, build a home away from Earth and uncover the science of survival.</p><div class="home-actions"><button class="primary-button primary-large" data-action="open-rocket"><span>Build my rocket</span><b>↗</b></button><button class="secondary-button" data-action="open-universe">Explore the solar system <span>◉</span></button><button class="demo-quick-button" data-action="demo-mode">▶ 5-MINUTE DEMO</button></div><div class="home-highlights"><div><strong>03</strong><span>WORLDS TO EXPLORE</span></div><i></i><div><strong>07</strong><span>MISSION DAYS</span></div><i></i><div><strong>04</strong><span>CREW SPECIALISTS</span></div><i></i><div><strong>${playerProgress.xp.toLocaleString()}</strong><span>COMMANDER XP</span></div></div></div><aside class="home-mission-card"><div class="mission-card-head"><span>YOUR EXPEDITION</span><span class="status-live">● READY</span></div><div class="mission-planet-row"><span class="planet-orb mars"></span><div><small>FEATURED MISSION</small><h2>${selectedPlanet === 'moon' ? 'FIRST LIGHT' : selectedPlanet === 'earth' ? 'EARTH ORBIT' : 'THE RED FRONTIER'}</h2><p>${selectedPlanet === 'moon' ? 'Lunar South Pole' : selectedPlanet === 'earth' ? 'Orbital Gateway' : 'Mars · Arc-01'}</p></div></div><div class="mission-progress-label"><span>MISSION PROGRESS</span><strong>${progress}%</strong></div><div class="mission-progress"><i style="width:${progress}%"></i></div><div class="mission-card-meta"><span>DAY <b>${day}/7</b></span><span>CREW <b>04</b></span><span>STATUS <b>ACTIVE</b></span></div><button class="card-play" data-action="continue-adventure">${day > 1 ? 'Continue your adventure' : 'Enter the outpost'} <b>→</b></button><button class="card-play secondary-card-play" data-action="open-rocket">Build & launch a rocket <b>↗</b></button></aside><div class="home-scene-caption"><i></i> PLANETARY SIMULATION ACTIVE <span>DRAG TO ORBIT · SCROLL TO ZOOM</span></div><div class="home-scroll-cue">DISCOVER YOUR NEXT WORLD <b>↓</b></div></section><section class="home-discover"><div class="section-intro"><span class="eyebrow-pill">EXPLORE BEYOND EARTH</span><h2>Three worlds.<br><em>Infinite discoveries.</em></h2><p>Every destination has its own terrain, challenges and secrets waiting to be explored.</p></div><div class="destination-feature-grid">${(['earth','moon','mars'] as Planet[]).map((p) => `<button class="destination-feature ${p}" data-action="select-world" data-value="${p}"><span class="planet-orb ${p}"></span><small>${p === 'earth' ? 'THE BEGINNING' : p === 'moon' ? 'FIRST FRONTIER' : 'THE RED FRONTIER'}</small><strong>${p.toUpperCase()}</strong><span class="destination-arrow">Explore world ↗</span></button>`).join('')}</div></section>`;
}

function renderMissions(): string {
  const cards = [
    { p: 'moon' as Planet, title: 'First Light', sub: 'Lunar South Pole', detail: 'Stabilise a remote lunar habitat through seven changing mission days.', day: mission.day },
    { p: 'mars' as Planet, title: 'The Red Frontier', sub: 'Mars · Arc-01', detail: 'Establish a sustainable habitat and complete your first ridge survey.', day: mars.day },
  ];
  return `<section class="page-shell"><div class="page-heading"><div><span class="eyebrow-pill">MISSION SELECT</span><h1>Choose your <em>expedition.</em></h1><p>Every mission is a new adventure. Learn, explore and bring your crew home safely.</p></div><span class="heading-stamp">KSA / 86</span></div><div class="mission-select-grid">${cards.map((card) => `<article class="mission-select-card ${card.p}"><div class="mission-select-art"><span class="planet-orb ${card.p}"></span><span class="mission-ribbon">${card.p.toUpperCase()} EXPEDITION</span></div><div class="mission-select-copy"><small>${card.sub}</small><h2>${card.title}</h2><p>${card.detail}</p><div class="mission-select-meta"><span>7 MISSION DAYS</span><span>4 CREW</span><span>PROGRESS ${Math.round((card.day-1)/7*100)}%</span></div><button class="primary-button" data-action="launch-world" data-value="${card.p}">${card.day > 1 ? 'Continue mission' : 'Brief me for launch'} <b>→</b></button></div></article>`).join('')}</div><div class="mission-note"><span>✦</span><p>Guided mode explains each engineering decision. Mistakes are part of learning; you can recover and try a different plan.</p></div></section>`;
}

function renderWorlds(): string {
  return `<section class="page-shell"><div class="page-heading"><div><span class="eyebrow-pill">PLANETARY NAVIGATOR</span><h1>Pick a world to <em>visit.</em></h1><p>Tap a planet to move the 3D camera and discover its exploration zone.</p></div></div><div class="world-selector-grid">${(['earth','moon','mars'] as Planet[]).map((p) => `<button class="world-selector ${p} ${selectedPlanet === p ? 'selected' : ''}" data-action="select-world" data-value="${p}"><span class="world-orb-wrap"><span class="planet-orb ${p}"></span></span><span class="world-selector-copy"><small>${p === 'earth' ? 'ORBITAL GATEWAY' : p === 'moon' ? 'LUNAR SOUTH POLE' : 'ARC-01 · MARS'}</small><strong>${p.toUpperCase()}</strong><em>${p === 'earth' ? 'Cloud systems · orbital station' : p === 'moon' ? 'Craters · long shadows · regolith' : 'Mesas · red dunes · dust weather'}</em></span><b>VIEW WORLD ↗</b></button>`).join('')}</div><div class="world-tip"><strong>3D CONTROLS</strong><span>Drag to rotate · Scroll to zoom · On a phone, swipe and pinch.</span></div></section>`;
}

function renderUniverse(): string {
  const selected = selectedPlanet.toUpperCase();
  const planetFacts: Record<Planet, { label: string; fact: string; distance: string }> = {
    earth: { label: 'OUR HOME', fact: 'A blue world with oceans, clouds and the orbital gateway.', distance: 'HOME WORLD' },
    moon: { label: 'FIRST FRONTIER', fact: 'A cratered neighbour where sunlight and shadow shape every mission.', distance: '3 DAYS · TRAINING FLIGHT' },
    mars: { label: 'THE RED FRONTIER', fact: 'A rocky world of dust, ancient valleys and challenging outpost operations.', distance: '7 DAYS · OUTPOST EXPEDITION' },
  };
  const fact = planetFacts[selectedPlanet];
  return `<section class="universe-screen view-enter"><div class="universe-vignette"></div><div class="universe-topline"><span class="eyebrow-pill">ORBITAL NAVIGATOR · LIVE 3D SOLAR SYSTEM</span><span class="universe-tip">DRAG TO ORBIT · PINCH / SCROLL TO ZOOM</span></div><div class="universe-copy"><small>CHOOSE YOUR NEXT DESTINATION</small><h1>Explore the <em>universe.</em></h1><p>Planets orbit the Sun while your transfer spacecraft moves through the system. Select a world to inspect it.</p><div class="universe-planet-pills">${(['earth','moon','mars'] as Planet[]).map((p) => `<button class="universe-planet ${selectedPlanet === p ? 'active' : ''}" data-action="solar-select" data-value="${p}"><span class="planet-orb ${p}"></span><span><strong>${p.toUpperCase()}</strong><small>${p === 'earth' ? 'ORBITAL GATEWAY' : p === 'moon' ? 'LUNAR SOUTH POLE' : 'ARC-01 · MARS'}</small></span><b>${selectedPlanet === p ? 'SELECTED' : 'VIEW'}</b></button>`).join('')}</div><div class="universe-selected"><div><span class="eyebrow-pill">${fact.label}</span><h2>${selected}</h2><p>${fact.fact}</p><small>${fact.distance}</small></div><button class="primary-button" data-action="solar-travel">Build a rocket to ${selectedPlanet === 'moon' ? 'the Moon' : selectedPlanet === 'mars' ? 'Mars' : 'Earth orbit'} <b>↗</b></button></div></div><div class="universe-controls"><span><i></i> 8 PLANETS</span><span>1 ACTIVE TRANSFER CRAFT</span><span>ORBIT MODEL · EDUCATIONAL SCALE</span></div></section>`;
}

function renderRocketWorkshop(): string {
  const stats = rocketStats();
  const parts = ROCKET_PARTS.map((part) => `<button class="rocket-part ${rocketConfig[part.id] ? 'installed' : ''}" data-action="rocket-part" data-value="${part.id}" aria-pressed="${rocketConfig[part.id]}"><span class="rocket-part-check">${rocketConfig[part.id] ? '✓' : '+'}</span><span><strong>${part.title}</strong><small>${part.detail}</small></span><b>${rocketConfig[part.id] ? 'INSTALLED' : 'ADD PART'}</b></button>`).join('');
  return `<section class="rocket-workshop-screen view-enter"><div class="rocket-workshop-shade"></div><div class="rocket-workshop-header"><div><span class="eyebrow-pill">FLIGHT OPERATIONS · VEHICLE ASSEMBLY</span><h1>Build your <em>rocket.</em></h1><p>Choose your spacecraft components, check the flight systems, then launch for ${selectedPlanet.toUpperCase()}.</p></div><div class="rocket-destination"><span>DESTINATION</span><strong>${selectedPlanet.toUpperCase()}</strong><button data-action="open-universe">Change world ↗</button></div></div><div class="rocket-workshop-layout"><div class="rocket-assembly-hint"><span class="rocket-live-dot"></span><strong>LIVE 3D ASSEMBLY</strong><small>Drag to inspect the vehicle. Select a component to add or remove it.</small><div class="rocket-specs"><div><strong>${stats.mass.toLocaleString()}</strong><small>KG · MASS</small></div><div><strong>${stats.fuel}%</strong><small>FUEL LOAD</small></div><div><strong>${stats.thrust}</strong><small>THRUST INDEX</small></div><div><strong>${stats.stability}%</strong><small>STABILITY</small></div></div></div><aside class="rocket-builder-panel"><div class="rocket-builder-title"><div><span class="eyebrow-pill">YOUR VEHICLE</span><h2>Expedition <em>MK-I</em></h2></div><span class="rocket-ready ${stats.readiness ? 'ready' : 'needs-work'}">${stats.readiness ? '● FLIGHT READY' : '● NEEDS PARTS'}</span></div><div class="rocket-parts-list">${parts}</div><div class="rocket-readiness ${stats.readiness ? 'ready' : ''}"><strong>${stats.readiness ? 'All essential systems ready.' : 'Complete your flight configuration.'}</strong><small>${stats.notes[0] ?? 'Run the pre-flight inspection.'}</small></div><div class="rocket-builder-actions"><button class="secondary-button" data-action="rocket-quick-build">Quick build</button><button class="primary-button" data-action="launch-rocket" ${!stats.readiness || rocketLaunchBusy ? 'disabled' : ''}>${rocketLaunchBusy ? `COUNTDOWN ${rocketCountdown || '…'}` : 'LAUNCH EXPEDITION'} <b>↗</b></button></div><small class="rocket-builder-foot">EDUCATIONAL FLIGHT MODEL · NOT REAL VEHICLE PERFORMANCE</small></aside></div>${rocketLaunchBusy ? `<div class="launch-countdown-overlay"><span>MISSION CONTROL</span><strong>${rocketCountdown || 'IGNITION'}</strong><p>Checking crew, propulsion and launch systems…</p></div>` : ''}<div class="rocket-workshop-bottom"><span>CREW MANIFEST · AMARA · MUHAMMAD · SHUAIB · JAFAR</span><button data-action="navigate" data-view="home">← Back to command deck</button></div></section>`;
}

function renderObjectiveCard(): string {
  const o = objective();
  const day = currentDay();
  return `<article class="objective-widget"><div class="objective-head"><span>DAY ${day} / 07 · PRIMARY OBJECTIVE</span><span class="objective-status ${o.complete ? 'done' : ''}">${o.complete ? '✓ COMPLETE' : 'IN PROGRESS'}</span></div><h2>${esc(o.title)}</h2><p>${esc(o.detail)}</p><div class="objective-foot"><span>${o.complete ? 'READY TO ADVANCE' : 'FOLLOW THE HIGHLIGHTED STATION'}</span>${day === 7 ? `<button data-action="final-assessment" class="mini-cta" ${o.complete ? '' : 'disabled'}>ASSESS MISSION</button>` : `<button data-action="advance-day" class="mini-cta" ${o.complete ? '' : 'disabled'}>COMPLETE DAY →</button>`}</div></article>`;
}
function renderGame(): string {
  const resources = currentResources();
  return `<section class="game-view"><div class="game-scene-label"><span class="scene-pulse"></span> THIRD-PERSON EXPLORATION <i></i><b>${selectedPlanet.toUpperCase()} SURFACE</b></div><div class="game-left-hud"><div class="game-day-pill">MISSION DAY <strong>${currentDay()} / 07</strong></div>${renderObjectiveCard()}<div class="game-resource-stack">${resources.map((r) => `<div class="game-resource"><span class="resource-icon">${r.id === 'oxygen' ? 'O₂' : r.id === 'power' ? 'ϟ' : r.id === 'water' ? 'H₂O' : '✿'}</span><div><div class="resource-meter-label"><span>${r.label}</span><strong>${Math.round(r.value)}%</strong></div><div class="resource-track"><i class="${r.value < 24 ? 'critical' : r.value < 48 ? 'caution' : 'healthy'}" style="width:${clamp(r.value)}%"></i></div></div></div>`).join('')}</div></div><div class="game-right-hud"><button data-action="camera" data-value="overview">◎ OVERVIEW</button><button data-action="camera" data-value="habitat">⌂ HABITAT</button><button data-action="camera" data-value="horizon">◇ HORIZON</button><button data-action="pause-game">Ⅱ PAUSE</button></div><div class="game-bottom-hud"><div id="interaction-hint" class="interaction-hint"><span class="keycap">E</span><div><strong>Explore the outpost</strong><small>Walk towards a glowing station to interact</small></div></div><div class="movement-legend"><kbd>W A S D</kbd><span>MOVE</span><kbd>SHIFT</kbd><span>RUN</span><kbd>SPACE</kbd><span>JUMP</span><kbd>E</kbd><span>INTERACT</span><kbd>ESC</kbd><span>PAUSE</span></div></div><div class="mobile-game-controls"><div class="touch-joystick" id="move-joystick" aria-label="Move astronaut"><span class="joystick-ring"></span><span class="joystick-knob" id="move-knob"></span></div><div class="touch-actions"><button data-action="mobile-interact">INTERACT</button><button data-action="mobile-jump" class="jump-action" ${vehicleMode ? 'hidden' : ''}>JUMP</button><button data-action="exit-vehicle" class="vehicle-exit" ${vehicleMode ? '' : 'hidden'}>EXIT ROVER</button><button data-action="scan-sample">SCAN</button></div></div>${stationModal ? renderStationModal(stationModal) : ''}${vehicleMode ? `<div class="vehicle-banner"><span>ROVER CONTROL ACTIVE</span><button data-action="exit-vehicle">EXIT VEHICLE ×</button><small>WASD / virtual joystick · Drive to the turquoise beacon to scan</small></div>` : ''}${worldLoading ? `<div class="loading-chip">INITIALISING PLANETARY WORLD…</div>` : ''}${worldError ? `<div class="fallback-chip">3D fallback active · ${esc(worldError)}</div>` : ''}<div class="game-world-controls"><button data-action="open-assistant">MISSION CONTROL AI</button><button data-action="save-game">SAVE PROGRESS</button></div><div id="assistant-box" class="assistant-box" hidden><div><strong>MISSION CONTROL</strong><button data-action="close-assistant">×</button></div><p id="assistant-answer">Ask about your current task, oxygen, power, water or crew safety.</p><form id="assistant-form"><input name="question" placeholder="Ask Mission Control…" required><button>ASK</button></form></div></section>`;
}

function renderStationModal(id: StationId): string {
  const isMars = selectedPlanet === 'mars';
  const close = `<button class="modal-close" data-action="close-station" aria-label="Close station">×</button>`;
  const metricHtml = currentResources().map((r) => bar(r.label, r.value)).join('');
  let title = 'Mission terminal'; let description = 'Choose an operation for the current mission.'; let actions = '';
  if (id === 'oxygen') {
    title = 'Life support & oxygen'; description = 'Oxygen supply, cabin-air conditioning and carbon-dioxide removal are separate parts of a life-support system. Inspect them as a team.';
    actions = `<div class="oxygen-puzzle"><div class="oxygen-puzzle-heading"><span class="puzzle-icon">O₂</span><div><strong>RESTORE OXYGEN FLOW</strong><small>Connect the three valves in the correct order: A → C → B.</small></div></div><div class="valve-sequence"><span class="${oxygenCalibration.length > 0 ? 'lit' : ''}">A</span><i></i><span class="${oxygenCalibration.length > 1 ? 'lit' : ''}">C</span><i></i><span class="${oxygenCalibration.length > 2 ? 'lit' : ''}">B</span></div><div class="valve-controls">${['A','B','C'].map((v) => `<button data-action="oxygen-valve" data-value="${v}" class="${oxygenCalibration.includes(v) ? 'used' : ''}">${v}<small>VALVE</small></button>`).join('')}</div><p class="puzzle-progress">${oxygenCalibration.length}/3 connections aligned</p><button data-action="complete-oxygen-calibration" class="station-action" ${oxygenCalibration === 'ACB' ? '' : 'disabled'}>VERIFY OXYGEN SYSTEM <b>→</b></button></div><button data-action="rest-crew" class="station-action secondary">Schedule crew recovery <b>→</b></button>`;
  } else if (id === 'power') {
    title = 'Power control'; description = 'Solar arrays generate electricity. Batteries cover shortfalls. Choose the plan that protects essential systems.';
    actions = isMars ? `<button data-action="mission-action" data-value="power-balanced" class="station-action">Balanced power <small>Normal activity, more battery use</small><b>→</b></button><button data-action="mission-action" data-value="power-conserve" class="station-action secondary">Conserve power <small>Protect reserves, slow optional work</small><b>→</b></button>${mars.day >= 2 && !mars.arraysServiced ? `<div class="microgame-block"><span class="eyebrow-pill">OPTIONAL FIELD CHALLENGE</span><h3>Restore solar output</h3><p>Calibrate the array controls in order: ALIGN → CLEAR → LOCK.</p><div class="microgame-steps">${[['A','ALIGN'],['L','CLEAR'],['C','LOCK']].map(([,label],index) => `<span class="${solarCalibration.length > index ? 'done' : ''}">${solarCalibration.length > index ? '✓' : label}</span>`).join('')}</div><div class="microgame-buttons">${[['A','ALIGN'],['L','CLEAR'],['C','LOCK']].map(([code,label]) => `<button data-action="solar-step" data-value="${code}" ${solarCalibration.includes(code) ? 'disabled' : ''}>${label}</button>`).join('')}</div><button data-action="complete-solar-service" class="station-action" ${solarCalibration === 'ALC' ? '' : 'disabled'}>VERIFY ARRAY REPAIR <b>→</b></button></div>` : ''}` : `<button data-action="mission-action" data-value="inspect-power" class="station-action">Inspect power console <b>→</b></button><button data-action="mission-action" data-value="choose-power-balanced" class="station-action secondary">Balanced plan <b>→</b></button><button data-action="mission-action" data-value="choose-power-conserve" class="station-action secondary">Conserve power <b>→</b></button>`;
  } else if (id === 'water') {
    title = 'Water recovery'; description = 'Recovery equipment treats used water before it returns to storage. Repair the fault or conserve supplies.';
    actions = `<button data-action="mission-action" data-value="repair-water" class="station-action">Repair recovery filter <small>Uses battery reserves</small><b>→</b></button><button data-action="mission-action" data-value="conserve-water" class="station-action secondary">Activate water conservation <b>→</b></button>`;
  } else if (id === 'greenhouse') {
    title = 'Greenhouse & food'; description = 'Plants need time, water, light and electricity. Select a growing schedule or conserve resources.';
    actions = `<div class="microgame-block"><span class="eyebrow-pill">GREENHOUSE TASK</span><h3>Prepare a growing cycle</h3><p>Complete the irrigation, grow-light and nutrient checks in order.</p><div class="microgame-steps">${[['W','WATER'],['L','LIGHT'],['N','NUTRIENTS']].map(([,label],index) => `<span class="${greenhouseCalibration.length > index ? 'done' : ''}">${greenhouseCalibration.length > index ? '✓' : label}</span>`).join('')}</div><div class="microgame-buttons">${[['W','WATER'],['L','LIGHT'],['N','NUTRIENTS']].map(([code,label]) => `<button data-action="greenhouse-step" data-value="${code}" ${greenhouseCalibration.includes(code) ? 'disabled' : ''}>${label}</button>`).join('')}</div><button data-action="complete-greenhouse-setup" class="station-action" ${greenhouseCalibration === 'WLN' ? '' : 'disabled'}>START GROWTH CYCLE <b>→</b></button></div><button data-action="mission-action" data-value="${isMars ? 'greenhouse-hold' : 'greenhouse-conserve'}" class="station-action secondary">${isMars ? 'Low-resource maintenance' : 'Conserve greenhouse resources'} <b>→</b></button>`;
  } else if (id === 'science') {
    title = 'Science laboratory'; description = 'Study samples, record geological features and add discoveries to your mission journal.';
    actions = isMars ? `<button data-action="collect-sample" class="station-action" ${mars.roverDeployed ? '' : 'disabled'}>Catalogue ridge sample <b>→</b></button><button data-action="navigate" data-view="science" class="station-action secondary">Open discovery archive <b>→</b></button>` : `<button data-action="mission-action" data-value="complete-survey" class="station-action">Record lunar training sample <b>→</b></button><button data-action="navigate" data-view="science" class="station-action secondary">Open science lab <b>→</b></button>`;
  } else if (id === 'shelter') {
    title = 'Radiation shelter'; description = 'When Mission Control issues the solar weather alert, pause surface work and move the crew to the protected volume.';
    actions = `<button data-action="mission-action" data-value="secure-shelter" class="station-action">Secure the shelter <b>→</b></button>`;
  } else if (id === 'rover') {
    title = 'Expedition rover'; description = 'Board the six-wheel surface vehicle to drive, inspect terrain and scan a sample location.';
    actions = `<button data-action="enter-rover" class="station-action">${mars.roverDeployed ? 'Enter rover' : 'Deploy & enter rover'} <b>→</b></button><button data-action="navigate" data-view="explore" class="station-action secondary">Review exploration route <b>→</b></button>`;
  } else if (id === 'airlock' || id === 'exit-habitat') {
    title = id === 'airlock' ? 'Habitat airlock' : 'Return to surface'; description = id === 'airlock' ? 'Enter the habitat and visit the command centre, life-support room, greenhouse and laboratory.' : 'Suit checks complete. Return to the planetary surface.';
    actions = `<button data-action="toggle-habitat" class="station-action">${id === 'airlock' ? 'Enter habitat' : 'Exit habitat'} <b>→</b></button>`;
  } else {
    title = 'Mission command'; description = "Review today's objective, check crew readiness and advance the training day when the required task is complete.";
    actions = `<button data-action="navigate" data-view="outpost" class="station-action">Open mission control <b>→</b></button><button data-action="advance-day" class="station-action secondary" ${objective().complete ? '' : 'disabled'}>Complete day ${currentDay()} <b>→</b></button>`;
  }
  return `<div class="station-backdrop" data-action="close-station"><section class="station-modal" role="dialog" aria-modal="true" aria-labelledby="station-title" data-modal="station"><div class="station-modal-head"><div><span class="eyebrow-pill">OUTPOST INTERACTION · ${currentDay()}/7</span><h2 id="station-title">${esc(title)}</h2></div>${close}</div><p>${esc(description)}</p><div class="station-state-grid">${metricHtml}</div><div class="station-actions">${actions}</div><small class="station-footnote">KSA training indicators are simplified educational values, not real spacecraft telemetry.</small></section></div>`;
}

function renderOutpost(): string {
  const o = objective();
  return `<section class="page-shell"><div class="page-heading"><div><span class="eyebrow-pill">OUTPOST COMMAND</span><h1>Your habitat, <em>your mission.</em></h1><p>Visit the actual 3D habitat in Explore Mode, or open a system below to manage it directly.</p></div><button class="primary-button" data-action="enter-game">Enter 3D outpost <b>↗</b></button></div><div class="outpost-objective-card"><span>START HERE · DAY ${currentDay()} / 07</span><h2>${esc(o.title)}</h2><p>${esc(o.detail)}</p><button class="primary-button" data-action="enter-game">Go to the highlighted station <b>↗</b></button></div><div class="outpost-system-grid">${[
    { id:'oxygen', icon:'O₂', title:'Life support', detail:'Oxygen, cabin air & CO₂ control', value: selectedPlanet === 'mars' ? mars.oxygen : mission.oxygen },
    { id:'power', icon:'ϟ', title:'Power & energy', detail:'Solar generation & battery storage', value: selectedPlanet === 'mars' ? mars.battery : mission.battery },
    { id:'water', icon:'H₂O', title:'Water recovery', detail:'Storage, filters & recycling', value: selectedPlanet === 'mars' ? mars.water : mission.water },
    { id:'greenhouse', icon:'✿', title:'Greenhouse', detail:'Crop growth & food supply', value: selectedPlanet === 'mars' ? mars.greenhouse : mission.greenhouseProgress },
    { id:'science', icon:'⌕', title:'Science laboratory', detail:'Geology, samples & research', value: selectedPlanet === 'mars' ? (mars.sampleCollected ? 100 : 20) : (mission.surveyComplete ? 100 : 20) },
    { id:'shelter', icon:'⬡', title:'Radiation shelter', detail:'Surface safety & storm protocol', value: selectedPlanet === 'mars' ? 100-mars.radiation : 100-mission.thermal },
  ].map((s) => `<button class="outpost-system" data-action="open-station" data-value="${s.id}"><span class="system-icon">${s.icon}</span><div><strong>${s.title}</strong><small>${s.detail}</small>${bar('SYSTEM CONDITION', s.value)}</div><b>↗</b></button>`).join('')}</div></section>`;
}

function renderCrew(): string {
  return `<section class="page-shell"><div class="page-heading"><div><span class="eyebrow-pill">CREW ROSTER</span><h1>Meet your <em>specialists.</em></h1><p>Every team member brings a different skill to the expedition. Assign a role and keep the crew ready.</p></div></div><div class="crew-grid">${crew.map((member, index) => `<article class="crew-card crew-${index}"><div class="crew-portrait"><span>${member.avatar}</span><i>✦</i></div><div class="crew-info"><small>${member.role}</small><h2>${member.name}</h2><p>${member.specialty}</p><div class="skill-row"><span>MISSION PROFICIENCY</span><strong>${member.skill}%</strong></div><div class="skill-track"><i style="width:${member.skill}%"></i></div><label>ASSIGNMENT<select data-crew="${member.id}"><option ${!playerAssignments[member.id] ? 'selected' : ''}>${member.role === 'Commander' ? 'Command & systems' : member.role === 'Pilot' ? 'Flight operations' : member.role === 'Systems Engineer' ? 'Power systems' : 'Science operations'}</option><option>Rest & recovery</option><option>Habitat maintenance</option><option>Power systems</option><option>Science operations</option><option>Surface exploration</option></select></label></div></article>`).join('')}</div><div class="crew-readiness"><span>TEAM READINESS</span><strong>${Math.round(selectedPlanet === 'mars' ? mars.crewReadiness : mission.crewReadiness)}%</strong>${bar('Crew operational readiness', selectedPlanet === 'mars' ? mars.crewReadiness : mission.crewReadiness)}</div><div class="commander-progress"><div><span class="eyebrow-pill">COMMANDER PROFILE</span><h2>${playerProgress.xp.toLocaleString()} <em>XP</em></h2><p>${playerProgress.badges.length} achievement${playerProgress.badges.length === 1 ? '' : 's'} unlocked. Complete missions and make discoveries to earn more.</p></div><div class="commander-badges">${playerProgress.badges.length ? playerProgress.badges.map((badge) => `<span class="commander-badge">✦ ${esc(badge.replace(/-/g, ' '))}</span>`).join('') : '<span class="commander-badge locked">Your first badge is waiting in onboarding.</span>'}</div></div></section>`;
}

function renderExplore(): string {
  return `<section class="page-shell"><div class="page-heading"><div><span class="eyebrow-pill">SURFACE OPERATIONS</span><h1>Go a little <em>further.</em></h1><p>Walk around the outpost, enter the habitat, board the rover and discover the terrain.</p></div><button class="primary-button" data-action="enter-game">Enter 3D world <b>↗</b></button></div><div class="explore-howto"><article><span>01</span><h3>Explore on foot</h3><p>Use W A S D or the on-screen joystick. Move close to a glowing station to see its interaction prompt.</p><kbd>W A S D · E</kbd></article><article><span>02</span><h3>Enter the habitat</h3><p>Walk to the airlock marker. Press E or tap INTERACT to visit the life-support, greenhouse and science stations.</p><kbd>E · INTERACT</kbd></article><article><span>03</span><h3>Drive the rover</h3><p>Approach the six-wheel rover and choose Deploy & enter. Drive to the ridge, then use SCAN.</p><kbd>W A S D · SCAN</kbd></article></div><div class="explore-actions"><button class="primary-button" data-action="enter-game">Start exploring now <b>↗</b></button><button class="secondary-button" data-action="open-station" data-value="rover">Rover operations</button></div></section>`;
}

function renderScience(): string {
  const discoveries = selectedPlanet === 'mars' ? mars.log.filter((entry) => /sample|ridge|science/i.test(entry.title)) : mission.log.filter((entry) => /sample|survey|science/i.test(entry.title));
  return `<section class="page-shell"><div class="page-heading"><div><span class="eyebrow-pill">SCIENCE LABORATORY</span><h1>Discover the <em>unknown.</em></h1><p>Scan terrain, catalogue samples and learn why planetary scientists study these materials.</p></div><button class="primary-button" data-action="enter-game">Visit the lab <b>↗</b></button></div><div class="science-feature"><div class="science-scan-icon">⌕</div><div><span>PLANETARY GEOLOGY</span><h2>${selectedPlanet === 'moon' ? 'Lunar regolith survey' : 'Martian ridge investigation'}</h2><p>${selectedPlanet === 'moon' ? 'Lunar regolith is the loose, fragmented material covering much of the surface. Scientists study its grains, history and resource potential.' : 'Mars contains volcanic rocks, ancient sedimentary deposits and evidence of past water-related environments. A rover can help select samples for further study.'}</p></div></div><div class="discovery-log"><div class="section-title"><h2>Your discoveries</h2><span>${discoveries.length} RECORDED</span></div>${discoveries.length ? discoveries.map((d) => `<article><span>DAY ${d.day}</span><div><strong>${esc(d.title)}</strong><p>${esc(d.detail)}</p></div><b>✓</b></article>`).join('') : `<div class="empty-discovery"><span>✦</span><strong>No samples collected yet</strong><p>Enter the 3D world, visit the science lab or drive the rover to the ridge and scan a sample.</p><button class="primary-button" data-action="enter-game">Explore now <b>→</b></button></div>`}</div></section>`;
}

function renderJournal(): string {
  const logs = selectedPlanet === 'mars' ? mars.log : mission.log;
  const events = selectedPlanet === 'mars' ? mars.events : mission.events;
  return `<section class="page-shell"><div class="page-heading"><div><span class="eyebrow-pill">MISSION HISTORY</span><h1>Your story in <em>space.</em></h1><p>Every decision, discovery and mission event is recorded here.</p></div><button class="secondary-button" data-action="save-game">Save now ↓</button></div><div class="journal-layout"><div class="journal-main"><div class="section-title"><h2>Mission activity</h2><span>${logs.length} ENTRIES</span></div>${logs.map((entry) => `<article class="journal-entry"><span class="journal-day">DAY ${entry.day}</span><div><strong>${esc(entry.title)}</strong><p>${esc(entry.detail)}</p></div></article>`).join('')}</div><aside class="journal-events"><h3>Mission events</h3>${events.length ? events.map((event) => `<div class="event-entry ${event.severity}"><span>${event.severity.toUpperCase()}</span><strong>${esc(event.title)}</strong><p>${esc('detail' in event ? event.detail : event.description)}</p><small>${event.resolved ? 'RESOLVED' : 'ACTION REQUIRED'}</small></div>`).join('') : '<p>No active mission warnings.</p>'}</aside></div></section>`;
}

function renderSettings(): string {
  return `<section class="page-shell"><div class="page-heading"><div><span class="eyebrow-pill">PERSONALISE YOUR EXPERIENCE</span><h1>Make it <em>yours.</em></h1><p>Choose how your universe looks, sounds and responds.</p></div></div><div class="settings-section"><div class="section-title"><h2>Visual theme</h2><span>THREE WORLDS OF STYLE</span></div><div class="theme-grid"><button class="theme-choice theme-light ${theme === 'light' ? 'selected' : ''}" data-action="theme" data-value="light"><span class="theme-swatch"><i></i><i></i><i></i></span><strong>Light Explorer</strong><small>Ivory · copper · warm sand</small><b>${theme === 'light' ? 'ACTIVE ✓' : 'SELECT'}</b></button><button class="theme-choice theme-dark ${theme === 'dark' ? 'selected' : ''}" data-action="theme" data-value="dark"><span class="theme-swatch"><i></i><i></i><i></i></span><strong>Dark Cosmos</strong><small>Deep navy · silver · indigo</small><b>${theme === 'dark' ? 'ACTIVE ✓' : 'SELECT'}</b></button><button class="theme-choice theme-glass ${theme === 'glass' ? 'selected' : ''}" data-action="theme" data-value="glass"><span class="theme-swatch"><i></i><i></i><i></i></span><strong>Glass Blue</strong><small>Frosted blue · electric cyan</small><b>${theme === 'glass' ? 'ACTIVE ✓' : 'SELECT'}</b></button></div></div><div class="settings-section settings-list"><label><span><strong>Graphics quality</strong><small>Higher quality uses more device resources.</small></span><select data-setting="quality"><option value="low" ${settings.quality === 'low' ? 'selected' : ''}>Performance</option><option value="medium" ${settings.quality === 'medium' ? 'selected' : ''}>Balanced</option><option value="high" ${settings.quality === 'high' ? 'selected' : ''}>High</option></select></label><label><span><strong>Reduced motion</strong><small>Reduce non-essential animation.</small></span><input type="checkbox" data-setting="reducedMotion" ${settings.reducedMotion ? 'checked' : ''}></label><label><span><strong>Mission audio</strong><small>Ambient and interface sounds.</small></span><input type="checkbox" data-setting="audio" ${audioEnabled ? 'checked' : ''}></label><label><span><strong>Browser mission alerts</strong><small>Show important alerts while this tab is in the background. This is not a push service when the browser is closed.</small></span><button class="secondary-button" data-action="enable-browser-alerts">${browserAlertsEnabled ? 'Alerts enabled ✓' : 'Enable alerts'}</button></label><label><span><strong>Replay 3D onboarding</strong><small>Meet the crew, choose a world and learn the systems again.</small></span><button class="secondary-button" data-action="replay-onboarding">Replay tutorial ↗</button></label></div><div class="settings-section account-settings"><div><span class="eyebrow-pill">COMMANDER ACCOUNT</span><h2>${account ? `Welcome back, ${esc(account.name)}.` : 'Playing as a guest commander'}</h2><p>${account ? 'Your profile can sync mission progress to the configured game server.' : 'Guest progress is saved on this device. Create an account to use server-backed profile and save synchronisation when the Cloudflare API is configured.'}</p></div><button class="primary-button" data-action="account">${account ? 'Manage account' : 'Sign in / Create account'} <b>→</b></button></div><div class="settings-section"><button class="text-button" data-action="open-guide">OPEN HOW TO PLAY GUIDE ↗</button><button class="text-button" data-action="navigate" data-view="lander">OPEN LUNAR LANDER LAB ↗</button><button class="text-button" data-action="navigate" data-view="journal">OPEN MISSION JOURNAL ↗</button></div></section>`;
}

function renderAccount(): string {
  return `<section class="account-screen"><div class="account-card"><button class="modal-close" data-action="account-close">×</button><span class="eyebrow-pill">PLAYER IDENTITY</span><h1>${account ? 'Commander profile' : 'Join the crew.'}</h1><p>${account ? `Signed in as ${esc(account.email)}.` : 'Create a commander profile to save your journey across devices. You can also continue as a guest.'}</p>${account ? `<div class="profile-summary"><span>${esc(account.avatar)}</span><div><strong>${esc(account.name)}</strong><small>${esc(account.email)}</small></div></div><div class="avatar-pickers"><span>COMMANDER MARK</span>${['AO','MI','SH','JF','86'].map((v) => `<button data-action="set-avatar" data-value="${v}" class="${account?.avatar === v ? 'selected' : ''}">${v}</button>`).join('')}</div><button class="primary-button" data-action="sync-save">Sync mission progress ↗</button><button class="secondary-button" data-action="logout">Sign out</button>` : `<div class="auth-tabs"><button class="${authMode === 'login' ? 'active' : ''}" data-action="auth-mode" data-value="login">Sign in</button><button class="${authMode === 'register' ? 'active' : ''}" data-action="auth-mode" data-value="register">Create account</button></div><form id="account-form" class="auth-form">${authMode === 'register' ? `<label>Commander name<input name="name" minlength="2" maxlength="40" placeholder="Your commander name" required></label>` : ''}<label>Email address<input name="email" type="email" autocomplete="email" placeholder="commander@example.com" required></label><label>Password<input name="password" type="password" minlength="10" autocomplete="${authMode === 'register' ? 'new-password' : 'current-password'}" placeholder="At least 10 characters" required></label><button class="primary-button" type="submit" ${accountBusy ? 'disabled' : ''}>${authMode === 'register' ? 'Create commander account' : 'Sign in'} <b>→</b></button></form><button class="quiet-button" data-action="account-close">Continue as guest</button><small class="auth-note">Accounts require the Cloudflare API to be deployed and configured. Guest mode remains available.</small>`}</div></section>`;
}

function renderLander(): string {
  return `<section class="page-shell lander-page"><div class="page-heading"><div><span class="eyebrow-pill">ASTRONAUT TRAINING LAB</span><h1>Lunar <em>landing.</em></h1><p>Control descent speed and lateral drift. Touch down gently inside the target zone.</p></div><button class="secondary-button" data-action="navigate" data-view="home">← Back home</button></div><div class="lander-game"><div class="lander-scene"><div class="lander-moon"></div><div class="lander-craft" style="--lander-y:${Math.max(4,80-lander.altitude/2.3)}%;--lander-x:${50+lander.horizontalPosition*.32}%">◈</div><div class="lander-target"></div></div><div class="lander-panel"><div class="lander-stats"><span>ALTITUDE <b>${lander.altitude.toFixed(1)} m</b></span><span>VERTICAL SPEED <b>${lander.verticalVelocity.toFixed(1)} m/s</b></span><span>FUEL <b>${Math.round(lander.fuel)}%</b></span></div><label>ENGINE THROTTLE <input id="lander-throttle" type="range" min="0" max="100" value="${landerControls.throttle*100}"></label><label>LATERAL CONTROL <input id="lander-lateral" type="range" min="-100" max="100" value="${landerControls.lateral*100}"></label><button class="primary-button" data-action="lander-start">${lander.phase === 'flight' ? 'DESCENT IN PROGRESS' : lander.phase === 'landed' ? 'LANDED SUCCESSFULLY' : lander.phase === 'crashed' ? 'RESET & RETRY' : 'START DESCENT'} <b>→</b></button><button class="secondary-button" data-action="lander-reset">Reset simulation</button><p class="training-note-small">Simplified educational landing exercise. Not a real flight-dynamics model.</p></div></div></section>`;
}

function renderView(): string {
  switch (view) {
    case 'onboarding': return renderOnboarding();
    case 'home': return renderHome();
    case 'universe': return renderUniverse();
    case 'rocket': return renderRocketWorkshop();
    case 'game': return renderGame();
    case 'missions': return renderMissions();
    case 'worlds': return renderWorlds();
    case 'outpost': return renderOutpost();
    case 'crew': return renderCrew();
    case 'explore': return renderExplore();
    case 'science': return renderScience();
    case 'journal': return renderJournal();
    case 'settings': return renderSettings();
    case 'lander': return renderLander();
    case 'account': return renderAccount();
    default: return renderHome();
  }
}
function render(): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('reduce-motion', settings.reducedMotion);
  const page = view === 'onboarding' ? `${header()}<main class="app-main onboarding-main">${renderOnboarding()}</main><div id="toast-host" aria-live="polite"></div>` : commonMain(renderView());
  const loadingBadge = worldLoading ? `<div class="world-loading-badge" role="status"><span class="loading-orbit"></span><span><strong>Preparing your universe</strong><small>Loading the first planetary scene…</small></span></div>` : '';
  root!.innerHTML = page + loadingBadge;
  renderToast();
  if (view === 'game' || view === 'onboarding' && onboardingStep === 3) refreshInteractionHint();
  world?.setPaused(!['home', 'universe', 'rocket', 'worlds', 'game', 'onboarding'].includes(view));
  world?.setPlayerControlled((view === 'game' || view === 'onboarding' && onboardingStep === 3) && !stationModal && !vehicleMode);
}
function setView(next: View): void {
  showMoreMenu = false;
  notificationsOpen = false;
  view = next;
  if (next !== 'game') { vehicleMode = false; world?.setVehicleMode(false); world?.setPlayerControlled(false); }
  if (next === 'universe' || next === 'home') world?.setSceneMode('solar');
  if (next === 'rocket') world?.setSceneMode('rocket');
  if (next === 'game') { world?.setPlanet(selectedPlanet); world?.setPlayerControlled(true); }
  render();
  if (next === 'game') startHudLoop(); else stopHudLoop();
  window.scrollTo({ top: 0, behavior: settings.reducedMotion ? 'auto' : 'smooth' });
}
function setPlanet(next: Planet): void {
  selectedPlanet = next; persistPlanet(); world?.setPlanet(next);
  toastMessage(`${next.toUpperCase()} selected`, `The 3D planetary environment is changing to ${next}.`, 'success');
  if (view === 'worlds' || view === 'onboarding') render();
}
function startHudLoop(): void {
  stopHudLoop();
  hudTimer = window.setInterval(refreshInteractionHint, 180);
}
function stopHudLoop(): void { if (hudTimer) window.clearInterval(hudTimer); hudTimer = 0; }
function refreshInteractionHint(): void {
  const inTutorial = view === 'onboarding' && onboardingStep === 3;
  if (view !== 'game' && !inTutorial) return;
  const hint = document.querySelector<HTMLElement>(inTutorial ? '#onboarding-interaction-hint' : '#interaction-hint');
  const near = world?.getNearbyInteractable() ?? null;
  currentStation = near;
  if (!hint) return;
  if (vehicleMode) {
    hint.innerHTML = `<span class="keycap">F</span><div><strong>Drive to the ridge and scan</strong><small>Use W A S D or the mobile controls. Press F or tap SCAN near the route.</small></div>`;
  } else if (near) {
    hint.innerHTML = `<span class="keycap">E</span><div><strong>${esc(near.title)}</strong><small>${esc(near.description)} · Press E or tap INTERACT</small></div><button data-action="interact-near">INTERACT →</button>`;
  } else if (inTutorial) {
    const left = 3 - onboardingChecks.size;
    hint.innerHTML = `<span class="keycap">W A S D</span><div><strong>${left ? 'Walk to a glowing station' : 'All tutorial systems checked'}</strong><small>${left ? `${left} system${left === 1 ? '' : 's'} remaining · Move close, then press E or tap INTERACT.` : 'You are ready to begin your first expedition.'}</small></div>`;
  } else {
    hint.innerHTML = `<span class="keycap">W A S D</span><div><strong>Explore the outpost</strong><small>Walk towards a glowing station to interact. Drag to orbit the camera.</small></div>`;
  }
}
function openRocketWorkshop(destination = selectedPlanet): void {
  selectedPlanet = destination; persistPlanet();
  if (destination === 'mars') { mars = loadMarsMission() ?? createMarsMission(); saveMarsMission(mars); }
  else if (destination === 'moon') { mission = loadMission() ?? createInitialMission(); saveMission(mission); }
  rocketLaunchBusy = false; rocketCountdown = 0;
  if (rocketCountdownTimer) window.clearInterval(rocketCountdownTimer);
  setView('rocket');
}
function startAdventure(destination = selectedPlanet): void { openRocketWorkshop(destination); }
function launchConfiguredRocket(): void {
  const stats = rocketStats();
  if (!stats.readiness) { toastMessage('Flight check failed', stats.notes[0] ?? 'Install the required rocket components.', 'warning'); return; }
  if (!world) { toastMessage('3D engine is still loading', 'Please try launch again in a moment.', 'warning'); return; }
  if (rocketLaunchBusy) return;
  rocketLaunchBusy = true; rocketCountdown = 3; render();
  toastMessage('Launch sequence started', 'Crew strapped in. Propulsion and communications checks are green.', 'success');
  rocketCountdownTimer = window.setInterval(() => {
    rocketCountdown -= 1;
    if (rocketCountdown > 0) { render(); return; }
    window.clearInterval(rocketCountdownTimer); rocketCountdownTimer = 0;
    rocketCountdown = 0; render();
    world?.launchRocket(selectedPlanet, () => {
      world?.playJourney(selectedPlanet, () => {
        rocketLaunchBusy = false;
        persistPlanet();
        view = 'game'; world?.setPlayerControlled(true); world?.setPaused(false); render();
        toastMessage('Touchdown confirmed', `Welcome to ${selectedPlanet.toUpperCase()}, Commander. Move towards the glowing station and press E or tap INTERACT.`, 'success');
        startHudLoop();
      });
    });
  }, 1000);
}
function openStation(id: StationId): void {
  if (id === 'oxygen') oxygenCalibration = '';
  if (id === 'power') solarCalibration = '';
  if (id === 'greenhouse') greenhouseCalibration = '';
  if (id === 'airlock') { world?.enterHabitat(); toastMessage('Inside Outpost 86', 'Explore the command centre, life support, water recovery, greenhouse and science lab.', 'success'); return; }
  if (id === 'exit-habitat') { world?.exitHabitat(); toastMessage('Back on the surface', 'Your suit systems are ready for surface operations.', 'info'); return; }
  if (id === 'rover') { stationModal = 'rover'; world?.setPlayerControlled(false); render(); return; }
  stationModal = id; world?.setPlayerControlled(false); render();
}
function closeStation(): void { stationModal = null; render(); world?.setPlayerControlled(view === 'game' && !vehicleMode); }
function applyAction(action: string): void {
  if (selectedPlanet === 'mars') {
    const result = applyMarsAction(mars, action as FrontierAction);
    if (!result.ok) { toastMessage(result.title, result.message, 'warning'); return; }
    mars = result.state; saveMarsMission(mars);
    if (action === 'deploy-rover') world?.deployRover();
    const earned = action === 'collect-sample'
      ? unlockBadge('mars-field-scientist', 'Mars Field Scientist', 100)
      : action === 'final-assessment' ? unlockBadge('mars-expedition-complete', 'Mars Expedition Complete', 150) : false;
    toastMessage(earned ? `${result.title} · Achievement unlocked` : result.title, earned ? `${result.message} · +${action === 'collect-sample' ? 100 : 150} XP` : result.message, 'success');
  } else {
    const result = applyMissionAction(mission, action as MissionAction);
    if (!result.ok) { toastMessage(result.title ?? 'Action not completed', result.message, 'warning'); return; }
    mission = result.state; saveMission(mission);
    const earned = action === 'complete-survey'
      ? unlockBadge('lunar-field-scientist', 'Lunar Field Scientist', 100)
      : action === 'final-check' ? unlockBadge('first-light-complete', 'First Light Graduate', 150) : false;
    toastMessage(earned ? `${result.title ?? 'System updated'} · Achievement unlocked` : result.title ?? 'System updated', earned ? `${result.message} · +${action === 'complete-survey' ? 100 : 150} XP` : result.message, 'success');
  }
  if (account) void syncPlayerSave();
  render();
}
function advanceDay(): void {
  if (selectedPlanet === 'mars') {
    const result = advanceMarsDay(mars);
    if (!result.ok) { toastMessage(result.title, result.message, 'warning'); return; }
    mars = result.state; saveMarsMission(mars);
    toastMessage(result.title, result.message, 'success');
    if (mars.currentAlert) window.setTimeout(() => toastMessage('Mission alert', mars.currentAlert ?? 'Check your outpost systems.', 'warning'), 800);
  } else {
    const result = advanceMissionDay(mission);
    if (!result.ok) { toastMessage(result.title ?? 'Objective incomplete', result.message, 'warning'); return; }
    mission = result.state; saveMission(mission);
    toastMessage(result.title ?? 'Mission day advanced', result.message, 'success');
    if (mission.currentAlert) window.setTimeout(() => toastMessage('Mission alert', mission.currentAlert ?? 'Check your outpost systems.', 'warning'), 800);
  }
  awardXP(40, `Day ${currentDay() - 1} complete. Your crew is one step closer to mission success.`);
  saveCurrentMission(); render();
}
function handleNearby(): void {
  const near = world?.interactNearest();
  if (!near) { toastMessage('Move closer', 'Walk towards a glowing station or rover to interact.', 'info'); return; }
  if (view === 'onboarding' && onboardingStep === 3 && ['oxygen','power','water'].includes(near.id)) {
    onboardingChecks.add(near.id); world?.activateStation(near.id);
    toastMessage(`${near.title} checked`, 'Nice work! The station responded. Find the next highlighted system.', 'success');
    if (onboardingChecks.size === 3) toastMessage('Training complete', 'Oxygen, power and water are online. Your First Commander badge is ready.', 'success');
    render(); return;
  }
  openStation(near.id as StationId);
}
function enterRover(): void {
  if (selectedPlanet === 'mars' && !mars.roverDeployed) {
    const result = applyMarsAction(mars, 'deploy-rover');
    if (!result.ok) { toastMessage(result.title, result.message, 'warning'); return; }
    mars = result.state; saveMarsMission(mars); world?.deployRover();
    toastMessage('Rover deployed', 'The rover is powered and ready. Use W A S D to drive the ridge route.', 'success');
  } else if (selectedPlanet === 'moon') world?.deployRover();
  vehicleMode = true; stationModal = null; world?.setVehicleMode(true); render();
  toastMessage('Rover control active', 'Drive with W A S D or use the on-screen controls. Scan the ridge to collect a sample.', 'info');
}
function scanSample(): void {
  if (!vehicleMode) { toastMessage('Scanner not ready', 'Enter the rover first to use its surface scanner.', 'warning'); return; }
  if (!world?.atSampleSite()) { toastMessage('Science beacon is still ahead', 'Drive the rover towards the glowing turquoise beacon. The scanner activates when you are within the marked survey zone.', 'info'); return; }
  if (selectedPlanet === 'mars') applyAction('collect-sample'); else applyAction('complete-survey');
}
function switchHabitat(): void {
  if (stationModal === 'exit-habitat') world?.exitHabitat(); else world?.enterHabitat();
  stationModal = null; render(); world?.setPlayerControlled(true);
}
function openAssistant(): void {
  const box = document.querySelector<HTMLElement>('#assistant-box');
  if (box) box.hidden = false;
}
function askAssistant(question: string): void {
  const response = answerMissionQuestion(question, mission, currentStation ? { id: currentStation.id, title: currentStation.title, description: currentStation.description } : null);
  const answer = document.querySelector<HTMLElement>('#assistant-answer');
  if (answer) answer.textContent = response.answer;
  openAssistant();
}
function saveProfileLocally(): void {
  if (!account) return;
  try { localStorage.setItem('ksa-outpost-86-player-profile-v3', JSON.stringify(account)); } catch { /* optional profile */ }
}
function adoptAccountProfile(profile: PlayerProfile): void {
  account = profile;
  saveProfileLocally();
  if (profile.theme === 'light' || profile.theme === 'dark' || profile.theme === 'glass') {
    theme = profile.theme;
    persistTheme();
    document.documentElement.dataset.theme = theme;
  }
  if (profile.onboardingComplete) {
    // Keep legacy profile compatibility, but only the v3.5 tutorial key may
    // skip the new hands-on tutorial.
    try { localStorage.setItem('ksa-outpost-86-onboarding-v3', 'complete'); } catch { /* account profile remains authoritative */ }
  }
}
async function apiRequest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(path, { ...init, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
}
async function updateAccountProfile(changes: Partial<Pick<PlayerProfile, 'name' | 'avatar' | 'theme' | 'onboardingComplete'>>): Promise<void> {
  if (!account) return;
  try {
    const response = await apiRequest('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(changes) });
    if (!response.ok) throw new Error('Profile update is unavailable on this deployment.');
    const payload = await response.json() as { user?: PlayerProfile };
    if (payload.user) adoptAccountProfile(payload.user);
  } catch { /* Local profile settings remain usable when the Worker is not deployed. */ }
}
async function enableBrowserAlerts(): Promise<void> {
  if (!('Notification' in window)) { toastMessage('Notifications unavailable', 'This browser does not support desktop notifications.', 'warning'); return; }
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  browserAlertsEnabled = permission === 'granted';
  try { localStorage.setItem('ksa-outpost-86-browser-alerts-v1', String(browserAlertsEnabled)); } catch { /* preference remains for this session */ }
  toastMessage(browserAlertsEnabled ? 'Mission alerts enabled' : 'Mission alerts not enabled', browserAlertsEnabled ? 'Important mission events can appear while this tab is in the background.' : 'Allow notifications in your browser settings to receive background-tab alerts.', browserAlertsEnabled ? 'success' : 'warning');
}
async function checkServer(): Promise<void> {
  try {
    const response = await apiRequest('/api/health', { method: 'GET', headers: {} });
    serverStatus = response.ok ? 'ready' : 'unavailable';
    if (response.ok) {
      const me = await apiRequest('/api/auth/me', { method: 'GET', headers: {} });
      if (me.ok) {
        const payload = await me.json() as { user?: PlayerProfile };
        if (payload.user) {
          adoptAccountProfile(payload.user);
          if (payload.user.onboardingComplete && view === 'onboarding' && localStorage.getItem(ONBOARDING_KEY) === 'complete') view = 'home';
          void restorePlayerSave(); void restorePlayerEvents(); openRealtime();
        }
      }
    }
  } catch { serverStatus = 'unavailable'; }
  if (view === 'settings' || view === 'account') render();
}
async function signInOrRegister(form: HTMLFormElement): Promise<void> {
  const data = new FormData(form);
  const payload: Record<string, string> = {
    email: String(data.get('email') ?? '').trim(),
    password: String(data.get('password') ?? ''),
  };
  if (authMode === 'register') payload.name = String(data.get('name') ?? '').trim();
  accountBusy = true; render();
  try {
    const response = await apiRequest(`/api/auth/${authMode === 'register' ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify(payload) });
    const result = await response.json() as { user?: PlayerProfile; error?: string };
    if (!response.ok || !result.user) throw new Error(result.error || 'Account service is not available.');
    adoptAccountProfile(result.user);
    // Restore any existing server profile before uploading this device's state;
    // otherwise a fresh browser could overwrite an established commander save.
    await restorePlayerSave();
    await restorePlayerEvents();
    openRealtime();
    await syncPlayerSave();
    view = 'home'; render(); toastMessage('Commander profile ready', `Welcome, ${result.user.name}. Your account is connected.`, 'success');
  } catch (error) {
    toastMessage('Account unavailable', error instanceof Error ? error.message : 'The server could not complete sign-in. You can continue as a guest.', 'warning');
    view = 'account'; render();
  } finally { accountBusy = false; }
}
async function syncPlayerSave(): Promise<void> {
  if (!account) return;
  try {
    const response = await apiRequest('/api/player/save', { method: 'PUT', body: JSON.stringify({ version: 3, planet: selectedPlanet, mission, mars, theme, progress: playerProgress, savedAt: new Date().toISOString() }) });
    if (!response.ok) throw new Error('Cloud save unavailable');
    toastMessage('Cloud progress saved', 'Your commander profile and mission progress are synchronised.', 'success');
  } catch { toastMessage('Local save complete', 'Your mission is saved on this device. Cloud sync is unavailable on the current deployment.', 'info'); }
}
async function restorePlayerEvents(): Promise<void> {
  try {
    const response = await apiRequest('/api/player/events', { method: 'GET', headers: {} });
    if (!response.ok) return;
    const payload = await response.json() as { events?: Array<{ title?: string; body?: string; tone?: string; time?: number }> };
    if (Array.isArray(payload.events)) {
      notificationHistory = payload.events.slice(0, 40).map((event) => ({ title: String(event.title || 'Mission update'), body: String(event.body || ''), tone: String(event.tone || 'info'), time: Number(event.time || Date.now()) }));
    }
  } catch { /* local notification history remains */ }
}
async function restorePlayerSave(): Promise<void> {
  if (!account) return;
  try {
    const response = await apiRequest('/api/player/save', { method: 'GET', headers: {} });
    if (!response.ok) return;
    const payload = await response.json() as { save?: { version?: number; planet?: Planet; mission?: MissionState; mars?: FrontierMissionState; theme?: Theme; progress?: PlayerProgress } };
    const saved = payload.save;
    if (!saved || saved.version !== 3) return;
    if (saved.mission) mission = saved.mission;
    if (saved.mars) mars = saved.mars;
    if (saved.planet && planets.includes(saved.planet)) { selectedPlanet = saved.planet; world?.setPlanet(saved.planet); }
    if (saved.theme === 'light' || saved.theme === 'dark' || saved.theme === 'glass') setTheme(saved.theme);
    if (saved.progress && Number.isFinite(saved.progress.xp) && Array.isArray(saved.progress.badges)) {
      playerProgress = { xp: Math.max(0, Math.floor(saved.progress.xp)), badges: saved.progress.badges.filter((item): item is string => typeof item === 'string').slice(0, 80) };
      try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(playerProgress)); } catch { /* account progress remains in memory */ }
    }
    saveMission(mission); saveMarsMission(mars); render();
  } catch { /* local progress remains */ }
}
function openRealtime(): void {
  if (!account || liveSocket || !('WebSocket' in window)) return;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  try {
    liveSocket = new WebSocket(`${protocol}//${location.host}/api/realtime`);
    liveSocket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(String(event.data)) as { type?: string; title?: string; body?: string; tone?: 'success' | 'warning' | 'info' };
        if (message.type === 'mission-event') toastMessage(message.title || 'Mission update', message.body || 'A new event was received.', message.tone || 'info', false);
      } catch { /* ignore invalid server message */ }
    });
    liveSocket.addEventListener('close', () => { liveSocket = null; });
    liveSocket.addEventListener('error', () => { liveSocket?.close(); liveSocket = null; });
  } catch { liveSocket = null; }
}
function signOut(): void {
  void apiRequest('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => undefined);
  liveSocket?.close(); liveSocket = null; account = null;
  try { localStorage.removeItem('ksa-outpost-86-player-profile-v3'); } catch { /* optional */ }
  view = 'home'; render(); toastMessage('Signed out', 'Guest mode is ready on this device.', 'info');
}
function startLanderLoop(): void {
  if (landerFrame) cancelAnimationFrame(landerFrame);
  lastLanderFrame = 0;
  const frame = (time: number): void => {
    if (view !== 'lander') return;
    if (!lastLanderFrame) lastLanderFrame = time;
    const delta = Math.min(0.05, (time - lastLanderFrame) / 1000); lastLanderFrame = time;
    if (lander.phase === 'flight') {
      lander = stepLander(lander, landerControls, delta);
      if (lander.phase !== 'flight') toastMessage(lander.phase === 'landed' ? 'Safe touchdown!' : 'Landing unsuccessful', lander.phase === 'landed' ? 'The training lander reached the target zone.' : 'Reset and try another descent.', lander.phase === 'landed' ? 'success' : 'warning');
      const craft = document.querySelector<HTMLElement>('.lander-craft');
      if (craft) { craft.style.setProperty('--lander-y', `${Math.max(4,80-lander.altitude/2.3)}%`); craft.style.setProperty('--lander-x', `${50+lander.horizontalPosition*.32}%`); }
      const stats = document.querySelector<HTMLElement>('#lander-stats');
      if (stats) stats.innerHTML = `<span>ALTITUDE <b>${lander.altitude.toFixed(1)} m</b></span><span>VERTICAL SPEED <b>${lander.verticalVelocity.toFixed(1)} m/s</b></span><span>FUEL <b>${Math.round(lander.fuel)}%</b></span>`;
    }
    landerFrame = requestAnimationFrame(frame);
  };
  landerFrame = requestAnimationFrame(frame);
}
function stopLanderLoop(): void { if (landerFrame) cancelAnimationFrame(landerFrame); landerFrame = 0; }

function handleClick(event: MouseEvent): void {
  const eventElement = event.target instanceof HTMLElement ? event.target : null;
  if (notificationsOpen && eventElement?.closest('[data-notification-panel]') && !eventElement.closest('[data-action="close-notifications"]')) return;
  const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-action]') : null;
  if (!target || target.hasAttribute('disabled')) return;
  const action = target.dataset.action ?? '';
  const value = target.dataset.value ?? '';
  switch (action) {
    case 'navigate': setView(target.dataset.view as View); break;
    case 'open-universe': setView('universe'); break;
    case 'open-rocket': openRocketWorkshop(); break;
    case 'demo-mode': selectedPlanet = 'mars'; persistPlanet(); rocketConfig = buildStandardRocket(); saveRocketConfiguration(); openRocketWorkshop('mars'); toastMessage('Demo mission ready', 'Your standard rocket is assembled. Press LAUNCH EXPEDITION to begin the five-minute Mars adventure.', 'success'); break;
    case 'start-adventure': openRocketWorkshop(); break;
    case 'continue-adventure': setView('game'); break;
    case 'enter-game': setView('game'); break;
    case 'launch-world': openRocketWorkshop(value as Planet); break;
    case 'solar-select': if (planets.includes(value as Planet)) { selectedPlanet = value as Planet; persistPlanet(); world?.focusCelestial(value); render(); } break;
    case 'solar-travel': openRocketWorkshop(selectedPlanet); break;
    case 'rocket-part': { const key = value as keyof RocketConfiguration; if (key in rocketConfig) { rocketConfig = { ...rocketConfig, [key]: !rocketConfig[key] }; saveRocketConfiguration(); render(); } break; }
    case 'rocket-quick-build': rocketConfig = buildStandardRocket(); saveRocketConfiguration(); render(); toastMessage('Standard rocket assembled', 'Your Expedition MK-I is ready for final checks.', 'success'); break;
    case 'launch-rocket': launchConfiguredRocket(); break;
    case 'select-world': if (planets.includes(value as Planet)) { setPlanet(value as Planet); if (view === 'worlds') render(); } break;
    case 'onboard-next':
      if (onboardingStep === 1) { onboardingStep = 2; world?.setSceneMode('solar'); world?.focusCelestial('earth'); }
      else if (onboardingStep === 2) { onboardingStep = 3; selectedPlanet = onboardingPlanet; persistPlanet(); world?.setPlanet(onboardingPlanet); if (onboardingPlanet === 'earth') world?.setCameraMode('overview'); else { world?.enterHabitat(); world?.setCameraMode('habitat'); } world?.setPlayerControlled(true); startHudLoop(); }
      render(); break;
    case 'onboard-back': onboardingStep = Math.max(1, onboardingStep - 1); if (onboardingStep < 3) stopHudLoop(); if (onboardingStep === 1) world?.setSceneMode('solar'); else if (onboardingStep === 2) world?.setSceneMode('solar'); render(); break;
    case 'onboard-planet': if (planets.includes(value as Planet)) { onboardingPlanet = value as Planet; selectedPlanet = onboardingPlanet; persistPlanet(); world?.focusCelestial(onboardingPlanet); render(); } break;
    case 'onboard-focus': world?.focusStation(value); toastMessage('Waypoint set', `Walk to the ${value} station. When the INTERACT prompt appears, activate it to complete this lesson.`, 'info'); break;
    case 'finish-onboarding':
      if (onboardingChecks.size < 3) { toastMessage('One more step', 'Inspect oxygen, power and water before launching.', 'warning'); break; }
      try { localStorage.setItem('ksa-outpost-86-onboarding-v3','complete'); localStorage.setItem(ONBOARDING_KEY, 'complete'); } catch { /* guest onboarding remains complete for this session */ }
      if (account) { account = { ...account, onboardingComplete: true }; saveProfileLocally(); void updateAccountProfile({ onboardingComplete: true }); }
      unlockBadge('first-commander', 'First Commander', 50);
      stopHudLoop(); view = 'home'; world?.setSceneMode('solar'); render(); toastMessage('First Commander unlocked', 'Badge earned · +50 XP. You are ready for your first expedition.', 'success'); break;
    case 'skip-onboarding':
      try { localStorage.setItem('ksa-outpost-86-onboarding-v3','complete'); localStorage.setItem(ONBOARDING_KEY, 'complete'); } catch { /* session fallback */ }
      if (account) { account = { ...account, onboardingComplete: true }; saveProfileLocally(); void updateAccountProfile({ onboardingComplete: true }); }
      stopHudLoop(); view = 'home'; world?.setSceneMode('solar'); render(); break;
    case 'begin-expedition': startAdventure(); break;
    case 'open-station': openStation(value as StationId); break;
    case 'interact-near': handleNearby(); break;
    case 'mobile-interact': handleNearby(); break;
    case 'mobile-jump': world?.jumpPlayer(); break;
    case 'solar-step': {
      const expected = ['A','L','C'][solarCalibration.length];
      if (value === expected) { solarCalibration += value; render(); if (solarCalibration === 'ALC') toastMessage('Array controls aligned', 'The solar field is ready for verification.', 'success'); }
      else { solarCalibration = ''; render(); toastMessage('Calibration reset', 'Try ALIGN, then CLEAR, then LOCK.', 'warning'); }
      break;
    }
    case 'complete-solar-service':
      if (solarCalibration !== 'ALC') { toastMessage('Array check incomplete', 'Complete ALIGN, CLEAR and LOCK in order.', 'warning'); break; }
      applyAction('clean-arrays');
      break;
    case 'greenhouse-step': {
      const expected = ['W','L','N'][greenhouseCalibration.length];
      if (value === expected) { greenhouseCalibration += value; render(); if (greenhouseCalibration === 'WLN') toastMessage('Greenhouse ready', 'Irrigation, grow lights and nutrients are configured.', 'success'); }
      else { greenhouseCalibration = ''; render(); toastMessage('Growing cycle reset', 'Try WATER, then LIGHT, then NUTRIENTS.', 'warning'); }
      break;
    }
    case 'complete-greenhouse-setup':
      if (greenhouseCalibration !== 'WLN') { toastMessage('Greenhouse setup incomplete', 'Complete WATER, LIGHT and NUTRIENTS in order.', 'warning'); break; }
      applyAction('greenhouse-grow');
      break;
    case 'oxygen-valve': {
      const expected = ['A','C','B'][oxygenCalibration.length];
      if (value === expected) { oxygenCalibration += value; render(); if (oxygenCalibration === 'ACB') toastMessage('Valves aligned', 'The oxygen flow sequence is ready to verify.', 'success'); }
      else { oxygenCalibration = ''; render(); toastMessage('Sequence reset', 'Try the valve order shown above: A, then C, then B.', 'warning'); }
      break;
    }
    case 'complete-oxygen-calibration':
      if (oxygenCalibration !== 'ACB') { toastMessage('Calibration incomplete', 'Align valves A, C and B in order.', 'warning'); break; }
      applyAction(selectedPlanet === 'mars' ? 'inspect-systems' : 'inspect-life-support');
      break;
    case 'close-station': if (target.dataset.modal !== 'station' && !target.closest('[data-modal="station"]')) closeStation(); break;
    case 'mission-action': applyAction(value); break;
    case 'collect-sample':
    case 'scan-sample': scanSample(); break;
    case 'enter-rover': enterRover(); break;
    case 'exit-vehicle': vehicleMode = false; world?.setVehicleMode(false); render(); break;
    case 'toggle-habitat': switchHabitat(); break;
    case 'advance-day': advanceDay(); break;
    case 'final-assessment': applyAction(selectedPlanet === 'mars' ? 'final-assessment' : 'final-check'); break;
    case 'pause-game': world?.setPaused(true); stationModal = 'command'; toastMessage('Mission paused', 'Review your current objective or close this panel to return.', 'info'); break;
    case 'camera': world?.setCameraMode(value as CameraMode); break;
    case 'toggle-more': showMoreMenu = !showMoreMenu; document.querySelector('#more-popover')?.classList.toggle('open', showMoreMenu); break;
    case 'dismiss-toast': toast = null; renderToast(); break;
    case 'theme': if (value === 'light' || value === 'dark' || value === 'glass') setTheme(value); break;
    case 'quality': if (value === 'low' || value === 'medium' || value === 'high') { settings = { ...settings, quality: value }; saveSettings(settings); world?.setGraphicsQuality(value as GraphicsQuality); render(); } break;
    case 'toggle-motion': settings = { ...settings, reducedMotion: !settings.reducedMotion }; saveSettings(settings); world?.setReducedMotion(settings.reducedMotion); render(); break;
    case 'replay-onboarding': onboardingStep = 1; onboardingChecks.clear(); onboardingPlanet = selectedPlanet === 'earth' ? 'mars' : selectedPlanet; view = 'onboarding'; world?.setSceneMode('solar'); render(); break;
    case 'open-guide': setView('explore'); break;
    case 'account': setView('account'); break;
    case 'account-close': view = 'settings'; render(); break;
    case 'auth-mode': authMode = value === 'register' ? 'register' : 'login'; render(); break;
    case 'logout': signOut(); break;
    case 'sync-save': void syncPlayerSave(); break;
    case 'save-game': saveCurrentMission(); toastMessage('Mission saved', account ? 'Local progress saved. Cloud sync is requested.' : 'Your mission progress is saved on this device.', 'success'); break;
    case 'notifications': notificationsOpen = true; render(); break;
    case 'close-notifications': notificationsOpen = false; render(); break;
    case 'enable-browser-alerts': void enableBrowserAlerts(); break;
    case 'set-avatar': if (account) { account = { ...account, avatar: value.slice(0, 3).toUpperCase() }; saveProfileLocally(); void updateAccountProfile({ avatar: account.avatar }); render(); toastMessage('Commander updated', 'Your avatar initials have been saved.', 'success'); } break;
    case 'open-assistant': openAssistant(); break;
    case 'close-assistant': { const box = document.querySelector<HTMLElement>('#assistant-box'); if (box) box.hidden = true; break; }
    case 'rest-crew': applyAction(selectedPlanet === 'mars' ? 'rest-crew' : 'crew-rest'); break;
    case 'lander-start': lander = startLander(lander); startLanderLoop(); render(); break;
    case 'lander-reset': lander = createLanderState(); landerControls = { throttle: 0.45, lateral: 0 }; render(); break;
    default: break;
  }
}

root.addEventListener('click', handleClick);
document.addEventListener('pointerdown', (event) => {
  if (!notificationsOpen) return;
  const target = event.target;
  if (target instanceof HTMLElement && !target.closest('[data-notification-panel]') && !target.closest('[data-action="notifications"]')) {
    notificationsOpen = false; render();
  }
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && notificationsOpen) { notificationsOpen = false; render(); }
});
root.addEventListener('submit', (event) => {
  const form = event.target;
  if (form instanceof HTMLFormElement && form.id === 'account-form') { event.preventDefault(); void signInOrRegister(form); }
  if (form instanceof HTMLFormElement && form.id === 'assistant-form') {
    event.preventDefault(); const field = form.elements.namedItem('question');
    if (field instanceof HTMLInputElement) { askAssistant(field.value); field.value = ''; }
  }
});
root.addEventListener('input', (event) => {
  const input = event.target;
  if (input instanceof HTMLInputElement && input.id === 'lander-throttle') landerControls = { ...landerControls, throttle: Number(input.value) / 100 };
  if (input instanceof HTMLInputElement && input.id === 'lander-lateral') landerControls = { ...landerControls, lateral: Number(input.value) / 100 };
  if (input instanceof HTMLSelectElement && input.dataset.crew) {
    playerAssignments[input.dataset.crew] = input.value;
    try { localStorage.setItem('ksa-outpost-86-crew-v1', JSON.stringify(playerAssignments)); } catch { /* session only */ }
    if (input.value === 'Rest & recovery') {
      if (selectedPlanet === 'mars') mars.crewReadiness = clamp(mars.crewReadiness + 4);
      else mission.crewReadiness = clamp(mission.crewReadiness + 4);
    }
    saveCurrentMission(); toastMessage('Crew assignment updated', `${input.dataset.crew} assigned to ${input.value}.`, 'success');
  }
});
root.addEventListener('change', (event) => {
  const input = event.target;
  if (input instanceof HTMLSelectElement && input.dataset.setting === 'quality') {
    const quality = input.value as GraphicsQuality; settings = { ...settings, quality }; saveSettings(settings); world?.setGraphicsQuality(quality);
  }
  if (input instanceof HTMLInputElement && input.dataset.setting === 'reducedMotion') {
    settings = { ...settings, reducedMotion: input.checked }; saveSettings(settings); world?.setReducedMotion(input.checked); render();
  }
  if (input instanceof HTMLInputElement && input.dataset.setting === 'audio') { audioEnabled = input.checked; audio.setEnabled(audioEnabled); }
});

// Mobile virtual joystick. Pointer capture keeps movement smooth if the thumb leaves the control ring.
let joystickPointer: number | null = null;
let joystickCenter = { x: 0, y: 0 };
function updateJoystick(event: PointerEvent): void {
  if (joystickPointer !== event.pointerId) return;
  const dx = event.clientX - joystickCenter.x;
  const dy = event.clientY - joystickCenter.y;
  const max = 38; const length = Math.max(1, Math.hypot(dx, dy));
  const x = dx / Math.max(max, length); const y = dy / Math.max(max, length);
  world?.setJoystick(x, y);
  world?.setVehicleInput(x, -y);
  const knob = document.querySelector<HTMLElement>('#move-knob');
  if (knob) knob.style.transform = `translate(${x*28}px, ${y*28}px)`;
}
root.addEventListener('pointerdown', (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('#move-joystick') : null;
  if (!target) return;
  joystickPointer = event.pointerId; const rect = target.getBoundingClientRect();
  joystickCenter = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
  target.setPointerCapture(event.pointerId); updateJoystick(event);
});
root.addEventListener('pointermove', updateJoystick);
function resetJoystick(): void { joystickPointer = null; world?.setJoystick(0,0); world?.setVehicleInput(0,0); const knob = document.querySelector<HTMLElement>('#move-knob'); if (knob) knob.style.transform = 'translate(0,0)'; }
root.addEventListener('pointerup', resetJoystick);
root.addEventListener('pointercancel', resetJoystick);

window.addEventListener('keydown', (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || target.matches('input,textarea,select,[contenteditable="true"]'))) return;
  if (event.key.toLowerCase() === 'e' && (view === 'game' || view === 'onboarding' && onboardingStep === 3) && !stationModal) { event.preventDefault(); handleNearby(); }
  if (event.code === 'Space' && (view === 'game' || view === 'onboarding' && onboardingStep === 3) && !stationModal && !vehicleMode) { event.preventDefault(); world?.jumpPlayer(); }
  if (event.key.toLowerCase() === 'f' && view === 'game' && vehicleMode) { event.preventDefault(); scanSample(); }
  if (event.key === 'Escape') {
    if (stationModal) closeStation();
    else if (view === 'game') { stationModal = 'command'; render(); world?.setPlayerControlled(false); }
  }
});

// Initial UI and 3D environment.
render();
void checkServer();
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => undefined);
}
void createBabylonWorld(canvas, { baseUrl: import.meta.env.BASE_URL, quality: settings.quality, reducedMotion: settings.reducedMotion, initialMode: 'solar', rocketConfiguration: rocketConfig, preferWebGPU: !constrainedDevice && settings.quality === 'high' })
  .then((created) => {
    world = created; worldLoading = false; world.setGraphicsQuality(settings.quality); world.setReducedMotion(settings.reducedMotion);
    // Reconcile the scene with the player's current view. The 3D engine loads
    // after the app shell, so users may advance onboarding before it is ready.
    if (view === 'rocket') world.setSceneMode('rocket');
    else if (view === 'game') { world.setPlanet(selectedPlanet); world.setPlayerControlled(true); }
    else if (view === 'onboarding' && onboardingStep === 3) {
      world.setPlanet(onboardingPlanet); if (onboardingPlanet === 'earth') world.setCameraMode('overview'); else { world.enterHabitat(); world.setCameraMode('habitat'); } world.setPlayerControlled(true); startHudLoop();
    } else if (view === 'universe' || view === 'home' || view === 'onboarding') world.setSceneMode('solar');
    world.setPaused(false); render();
  })
  .catch((error: unknown) => {
    worldLoading = false; worldError = error instanceof Error ? error.message : 'Babylon.js could not initialise.';
    const fallback = canvas.cloneNode(false) as HTMLCanvasElement; fallback.id = 'world-canvas'; canvas.replaceWith(fallback);
    try {
      world = createCanvasFallback(fallback, settings.reducedMotion);
      if (view === 'rocket') { world.setSceneMode('rocket'); world.setRocketConfiguration(rocketConfig); }
      else if (view === 'game') world.setPlanet(selectedPlanet);
      else world.setSceneMode('solar');
      world.setPaused(false);
    } catch { world = null; }
    render(); toastMessage('3D engine unavailable', 'The simplified solar-system or planetary fallback is active. Mission menus remain available.', 'warning');
  });

window.addEventListener('pagehide', () => { saveCurrentMission(); world?.destroy(); audio.destroy(); liveSocket?.close(); stopLanderLoop(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) world?.setPaused(true); else world?.setPaused(false); });
