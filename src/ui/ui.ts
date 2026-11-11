import {
  currentObjective,
  type MissionAction,
  type MissionState,
} from '../game/simulation';
import type { Interactable } from '../engine/babylonWorld';
import type { AssistantReply } from '../game/assistant';
import { createLanderState, startLander, stepLander, type LanderState } from '../game/lander';

export type ScreenName = 'menu' | 'briefing' | 'guide' | 'about' | 'settings' | 'game' | 'pause' | 'debrief' | 'sources' | 'lander-lab';

export interface UiCallbacks {
  startMission(): void;
  continueMission(): void;
  resumeMission(): void;
  pauseMission(): void;
  restartMission(): void;
  interact(id: string): void;
  missionAction(action: MissionAction): void;
  advanceDay(): void;
  openScreen(screen: ScreenName): void;
  setQuality(level: 'low' | 'medium' | 'high'): void;
  setReducedMotion(value: boolean): void;
  saveMission(): void;
  panelOpened(): void;
  panelClosed(): void;
  joystick(x: number, y: number): void;
  askAssistant(question: string): AssistantReply;
  openAudioSettings(): void;
}

function bar(label: string, value: number, unit = '%'): string {
  const clean = Math.max(0, Math.min(100, value));
  const status = clean < 25 ? 'danger' : clean < 48 ? 'caution' : 'good';
  return `<div class="resource-row">
    <div class="resource-meta"><span>${label}</span><strong>${Math.round(value)}${unit}</strong></div>
    <div class="resource-track"><span class="${status}" style="width:${clean}%"></span></div>
  </div>`;
}

function actionButton(action: MissionAction, label: string, detail = ''): string {
  return `<button class="action-option" data-mission-action="${action}"><span><strong>${label}</strong>${detail ? `<small>${detail}</small>` : ''}</span><span class="option-arrow">→</span></button>`;
}

function panelBody(id: string, state: MissionState): { eyebrow: string; title: string; body: string; actions: string } {
  switch (id) {
    case 'power':
      return {
        eyebrow: 'ENERGY SYSTEMS', title: 'Power management',
        body: `<p>Solar arrays generate electricity. Batteries help when generation is lower than demand. Choose which non-essential loads can run during the current sunlight window.</p>
          <div class="panel-metrics">${bar('Battery reserve', state.battery)}${bar('Solar output', state.solarGeneration / 24 * 100, ' / 24')}${bar('Electrical demand', state.powerDemand / 24 * 100, ' / 24')}</div>
          <div class="micro-note">Current plan: <strong>${state.powerPlan.toUpperCase()}</strong> · Training values, not engineering specifications.</div>`,
        actions: `${actionButton('choose-power-conserve', 'Conserve power', 'Protect battery; slow optional greenhouse work')}${actionButton('choose-power-balanced', 'Balanced plan', 'Keep essential systems steady')}${actionButton('choose-power-research', 'Research priority', 'Run more optional loads; use more energy')}${actionButton('inspect-power', 'Inspect power system', 'Record the generation and demand check')}`,
      };
    case 'life-support':
      return {
        eyebrow: 'CREW SYSTEMS', title: 'Life support',
        body: `<p>Life support includes separate functions. Oxygen supply provides oxygen; air revitalisation cleans circulating cabin air and removes carbon dioxide. A single meter cannot represent all of cabin safety.</p>
          <div class="panel-metrics">${bar('Oxygen supply', state.oxygen)}${bar('Cabin-air condition', state.cabinAir)}${bar('CO₂ control condition', state.co2Control)}${bar('Thermal condition', state.thermal)}</div>
          <div class="micro-note">The bars are simplified classroom indicators. They are not pressure, gas-composition or medical measurements.</div>`,
        actions: `${actionButton('inspect-life-support', 'Complete system inspection', 'Check oxygen and air-cleaning functions separately')}${actionButton('thermal-service', 'Service thermal control', 'Use 5 battery points to improve equipment condition')}${actionButton('crew-rest', 'Schedule crew rest', 'Improve the operational-readiness training indicator')}`,
      };
    case 'water':
      return {
        eyebrow: 'WATER SYSTEMS', title: 'Water recovery unit',
        body: `<p>Stored water is limited. A recovery unit treats used water before it is returned to storage. A fault lowers recovery, so the crew must repair the unit or reduce consumption.</p>
          <div class="panel-metrics">${bar('Stored water', state.water)}${bar('Recovery unit condition', state.waterRecovery)}</div>
          <div class="micro-note">Water recovery and oxygen generation are related through some system architectures, but this training malfunction affects water recovery only.</div>`,
        actions: `${actionButton('repair-water', 'Repair recovery unit', 'Costs 8 battery points; restores recovery condition')}${actionButton('conserve-water', 'Activate water conservation', 'Lower daily use without spending battery')}`,
      };
    case 'shelter':
      return {
        eyebrow: 'CREW SAFETY', title: 'Radiation shelter',
        body: `<p>A solar radiation warning is a prompt to stop outside work and follow the crew procedure. Move to the designated protected area and secure the shelter.</p>
          <div class="callout-warning"><strong>Important:</strong> Shielding reduces exposure; it does not make radiation disappear. The warning is a simulated mission event.</div>
          <div class="panel-metrics">${bar('Crew readiness', state.crewReadiness)}</div>`,
        actions: `${actionButton('secure-shelter', 'Pause outside work & secure shelter', 'Record that the crew has moved to protection')}`,
      };
    case 'greenhouse':
      return {
        eyebrow: 'FOOD SYSTEMS', title: 'Greenhouse control',
        body: `<p>Plants need time, water, light and energy. The greenhouse supplements stored provisions; it does not create instant or unlimited food.</p>
          <div class="panel-metrics">${bar('Stored food', state.food)}${bar('Crop growth cycle', state.greenhouseProgress)}</div>
          <div class="micro-note">Current schedule: <strong>${state.greenhousePlan.toUpperCase()}</strong></div>`,
        actions: `${actionButton('greenhouse-grow', 'Run growth cycle', 'Use more water and electricity to make progress')}${actionButton('greenhouse-conserve', 'Conserve greenhouse resources', 'Slow growth to protect water and power')}`,
      };
    case 'survey':
      return {
        eyebrow: 'SCIENCE TASK', title: 'South ridge surface survey',
        body: `<p>Record a training sample from the loose surface material called regolith. Scientists study lunar soil to understand the Moon's history and the resources that may be present.</p>
          <div class="callout-info">This action records a fictional training sample. It does not use live lunar data or claim to identify water ice.</div>`,
        actions: `${actionButton('complete-survey', 'Collect training sample', 'Complete the Day 6 science objective')}`,
      };
    default:
      return {
        eyebrow: 'MISSION CONTROL', title: 'Mission terminal',
        body: `<p>Review the current objective and close the day when its required task is complete. The mission covers seven accelerated training days.</p>
          <div class="current-objective"><span>DAY ${state.day} OBJECTIVE</span><strong>${currentObjective(state).title}</strong><p>${currentObjective(state).detail}</p></div>`,
        actions: state.day === 7
          ? `${actionButton('final-check', 'Run final systems assessment', 'Complete the training mission')}`
          : `<button class="action-option" data-ui-action="advance"><span><strong>Complete day ${state.day}</strong><small>${currentObjective(state).complete ? 'Advance to the next mission day' : 'Finish the objective first'}</small></span><span class="option-arrow">→</span></button>`,
      };
  }
}

export class GameUI {
  private readonly root: HTMLElement;
  private readonly callbacks: UiCallbacks;
  private screen: ScreenName = 'menu';
  private modalId: string | null = null;
  private toastTimer = 0;
  private nearest: Interactable | null = null;
  private assistantOpen = false;
  private assistantMessageCount = 0;
  private landerState: LanderState = createLanderState();
  private landerThrottle = 0.55;
  private landerLateral = 0;
  private landerAnimationFrame: number | null = null;
  private landerLastFrame = 0;

  constructor(root: HTMLElement, callbacks: UiCallbacks) {
    this.root = root;
    this.callbacks = callbacks;
    this.root.addEventListener('click', this.handleClick);
    this.root.addEventListener('change', this.handleChange);
    this.root.addEventListener('input', this.handleInput);
    this.root.addEventListener('submit', this.handleSubmit);
    this.renderMenu();
  }

  getScreen(): ScreenName {
    return this.screen;
  }

  isInteractionOpen(): boolean {
    return this.modalId !== null;
  }

  showScreen(screen: ScreenName, state?: MissionState): void {
    if (this.screen === 'lander-lab' && screen !== 'lander-lab') this.stopLanderLoop();
    this.screen = screen;
    this.modalId = null;
    if (screen === 'menu') this.renderMenu();
    if (screen === 'briefing') this.renderBriefing();
    if (screen === 'guide') this.renderGuide();
    if (screen === 'about') this.renderAbout();
    if (screen === 'settings') this.renderSettings();
    if (screen === 'game') this.renderGameShell(state);
    if (screen === 'pause') this.renderPause();
    if (screen === 'debrief' && state) this.renderDebrief(state);
    if (screen === 'sources') this.renderSources();
    if (screen === 'lander-lab') this.renderLanderLab();
  }

  renderHud(state: MissionState, nearest: Interactable | null): void {
    this.nearest = nearest;
    if (this.screen !== 'game') return;
    const objective = currentObjective(state);
    const dayLabel = this.root.querySelector<HTMLElement>('[data-hud="day"]');
    const battery = this.root.querySelector<HTMLElement>('[data-hud="battery"]');
    const oxygen = this.root.querySelector<HTMLElement>('[data-hud="oxygen"]');
    const water = this.root.querySelector<HTMLElement>('[data-hud="water"]');
    const food = this.root.querySelector<HTMLElement>('[data-hud="food"]');
    const power = this.root.querySelector<HTMLElement>('[data-hud="power"]');
    const objectiveTitle = this.root.querySelector<HTMLElement>('[data-hud="objective-title"]');
    const objectiveDetail = this.root.querySelector<HTMLElement>('[data-hud="objective-detail"]');
    const objectiveState = this.root.querySelector<HTMLElement>('[data-hud="objective-state"]');
    const interaction = this.root.querySelector<HTMLElement>('[data-hud="interaction"]');
    const alert = this.root.querySelector<HTMLElement>('[data-hud="alert"]');
    const endButton = this.root.querySelector<HTMLButtonElement>('[data-ui-action="advance"]');
    if (dayLabel) dayLabel.textContent = `DAY ${state.day} / 7`;
    if (battery) battery.textContent = `${Math.round(state.battery)}%`;
    if (oxygen) oxygen.textContent = `${Math.round(state.oxygen)}%`;
    if (water) water.textContent = `${Math.round(state.water)}%`;
    if (food) food.textContent = `${Math.round(state.food)}%`;
    if (power) power.textContent = `${state.solarGeneration} / ${state.powerDemand}`;
    if (objectiveTitle) objectiveTitle.textContent = objective.title;
    if (objectiveDetail) objectiveDetail.textContent = objective.detail;
    if (objectiveState) {
      objectiveState.textContent = objective.complete ? 'OBJECTIVE COMPLETE' : 'IN PROGRESS';
      objectiveState.classList.toggle('is-complete', objective.complete);
    }
    if (interaction) {
      interaction.innerHTML = nearest
        ? `<span class="keycap">E</span><span><strong>${nearest.title}</strong><small>${nearest.description}</small></span>`
        : `<span class="keycap">W A S D</span><span><strong>Explore the outpost</strong><small>Walk to a marked system to interact</small></span>`;
      interaction.classList.toggle('is-active', Boolean(nearest));
      interaction.dataset.uiAction = nearest ? 'mobile-interact' : '';
      interaction.style.cursor = nearest ? 'pointer' : 'default';
    }
    if (alert) {
      const active = state.currentAlert || state.events.find((event) => !event.resolved)?.title;
      alert.textContent = active || 'SYSTEMS NOMINAL';
      alert.classList.toggle('is-alert', Boolean(active));
    }
    if (endButton) {
      endButton.disabled = !objective.complete || state.day >= 7;
      endButton.textContent = objective.complete ? 'COMPLETE DAY →' : 'OBJECTIVE IN PROGRESS';
    }
    this.updateResourceBars(state);
  }

  updateResourceBars(state: MissionState): void {
    for (const [key, value] of Object.entries({ battery: state.battery, oxygen: state.oxygen, water: state.water, food: state.food })) {
      const track = this.root.querySelector<HTMLElement>(`[data-resource="${key}"]`);
      if (track) {
        track.style.width = `${Math.max(0, Math.min(100, value))}%`;
        track.className = value < 25 ? 'danger' : value < 48 ? 'caution' : 'good';
      }
    }
  }

  openInteraction(id: string, state: MissionState): void {
    const panel = panelBody(id, state);
    if (!this.modalId) this.callbacks.panelOpened();
    this.modalId = id;
    const current = this.root.querySelector<HTMLElement>('#interaction-panel');
    if (!current) return;
    current.innerHTML = `<div class="modal-backdrop" data-ui-action="close-panel"></div>
      <section class="system-panel" role="dialog" aria-modal="true" aria-labelledby="panel-title">
        <div class="panel-topline"><span>${panel.eyebrow}</span><button class="icon-button" data-ui-action="close-panel" aria-label="Close panel">×</button></div>
        <h2 id="panel-title">${panel.title}</h2>
        ${panel.body}
        <div class="panel-actions">${panel.actions}</div>
        <div class="panel-foot"><span>OUTPOST 86 · TRAINING SIMULATION</span><span>ESC TO CLOSE</span></div>
      </section>`;
    current.classList.add('is-open');
  }

  closeInteraction(): void {
    const wasOpen = this.modalId !== null;
    const panel = this.root.querySelector<HTMLElement>('#interaction-panel');
    panel?.classList.remove('is-open');
    this.modalId = null;
    if (wasOpen) this.callbacks.panelClosed();
  }

  showToast(title: string, message: string, tone: 'success' | 'warning' | 'info' = 'info'): void {
    let toast = this.root.querySelector<HTMLElement>('#mission-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'mission-toast';
      toast.className = 'mission-toast';
      this.root.append(toast);
    }
    const mark = document.createElement('span');
    mark.className = 'toast-mark';
    mark.textContent = tone === 'success' ? '✓' : tone === 'warning' ? '!' : 'i';
    const copy = document.createElement('span');
    const heading = document.createElement('strong');
    heading.textContent = title;
    const detail = document.createElement('small');
    detail.textContent = message;
    copy.append(heading, detail);
    toast.replaceChildren(mark, copy);
    toast.className = `mission-toast is-visible ${tone}`;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => toast?.classList.remove('is-visible'), 4500);
  }

  renderMissionLog(state: MissionState): void {
    const log = this.root.querySelector<HTMLElement>('#mission-log-list');
    if (!log) return;
    const entries = state.log.slice(0, 8).map((entry) => {
      const item = document.createElement('li');
      const day = document.createElement('span');
      day.textContent = `DAY ${entry.day}`;
      const title = document.createElement('strong');
      title.textContent = entry.title;
      const detail = document.createElement('small');
      detail.textContent = entry.detail;
      item.append(day, title, detail);
      return item;
    });
    log.replaceChildren(...entries);
  }

  private handleClick = (event: Event): void => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-ui-action], [data-mission-action], [data-assistant-action], [data-assistant-question]');
    if (!target) return;
    const assistantAction = target.dataset.assistantAction;
    if (assistantAction === 'toggle') { this.toggleAssistant(); return; }
    if (assistantAction === 'close') { this.closeAssistant(); return; }
    if (target.dataset.assistantQuestion) { this.submitAssistantQuestion(target.dataset.assistantQuestion); return; }
    const uiAction = target.dataset.uiAction;
    const missionAction = target.dataset.missionAction as MissionAction | undefined;
    if (missionAction) {
      this.callbacks.missionAction(missionAction);
      return;
    }
    switch (uiAction) {
      case 'start': this.callbacks.openScreen('briefing'); break;
      case 'continue': this.callbacks.continueMission(); break;
      case 'begin': this.callbacks.startMission(); break;
      case 'resume': this.callbacks.resumeMission(); break;
      case 'pause': this.callbacks.pauseMission(); break;
      case 'restart': this.callbacks.restartMission(); break;
      case 'guide': this.callbacks.openScreen('guide'); break;
      case 'about': this.callbacks.openScreen('about'); break;
      case 'settings': this.callbacks.openScreen('settings'); break;
      case 'sources': this.callbacks.openScreen('sources'); break;
      case 'lander-lab': this.callbacks.openScreen('lander-lab'); break;
      case 'lander-start': this.startLanderRun(); break;
      case 'lander-reset': this.resetLanderRun(); break;
      case 'menu': this.callbacks.openScreen('menu'); break;
      case 'advance': this.callbacks.advanceDay(); break;
      case 'close-panel': this.closeInteraction(); break;
      case 'save': this.callbacks.saveMission(); this.showToast('Mission saved', 'Progress is stored on this device.', 'success'); break;
      case 'open-log': this.toggleLog(); break;
      case 'open-audio-settings': this.callbacks.openAudioSettings(); break;
      case 'mobile-interact': if (this.nearest) this.callbacks.interact(this.nearest.id); else this.showToast('No system in range', 'Walk closer to a marked station first.', 'warning'); break;
    }
  };

  private handleSubmit = (event: Event): void => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'mission-assistant-form') return;
    event.preventDefault();
    const input = form.querySelector<HTMLInputElement>('#mission-assistant-input');
    if (!input) return;
    this.submitAssistantQuestion(input.value);
    input.value = '';
    input.focus();
  };

  private handleChange = (event: Event): void => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.dataset.uiAction === 'quality') {
      this.callbacks.setQuality(target.value as 'low' | 'medium' | 'high');
      this.showToast('Graphics setting updated', `${target.value.toUpperCase()} quality selected.`);
    }
    if (target.dataset.uiAction === 'reduced-motion') this.callbacks.setReducedMotion((target as HTMLInputElement).checked);
  };

  private handleInput = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.id === 'lander-throttle') {
      this.landerThrottle = Number(target.value) / 100;
      const output = this.root.querySelector<HTMLOutputElement>('#lander-throttle-value');
      if (output) output.value = `${target.value}%`;
    }
    if (target.id === 'lander-lateral') {
      this.landerLateral = Number(target.value) / 100;
      const output = this.root.querySelector<HTMLOutputElement>('#lander-lateral-value');
      if (output) output.value = this.landerLateral === 0 ? 'NEUTRAL' : `${Math.abs(Number(target.value))}% ${this.landerLateral < 0 ? 'LEFT' : 'RIGHT'}`;
    }
  };

  private toggleAssistant(): void {
    const panel = this.root.querySelector<HTMLElement>('#mission-assistant-panel');
    const button = this.root.querySelector<HTMLButtonElement>('[data-assistant-action="toggle"]');
    if (!panel || !button) return;
    this.assistantOpen = !this.assistantOpen;
    panel.hidden = !this.assistantOpen;
    button.setAttribute('aria-expanded', String(this.assistantOpen));
    if (this.assistantOpen && this.assistantMessageCount === 0) {
      this.appendAssistantMessage(
        'KSA MISSION CONTROL',
        'I am the offline mission knowledge assistant. I can explain your current objective and the project’s power, life-support, water, shelter, greenhouse and science systems. I use local rules and mission state; I am not a cloud language model or a real spacecraft controller.',
        'LOCAL KNOWLEDGE BASE',
      );
      this.submitAssistantQuestion('What is my current objective?', false);
    }
    if (this.assistantOpen) this.root.querySelector<HTMLInputElement>('#mission-assistant-input')?.focus();
  }

  private closeAssistant(): void {
    this.assistantOpen = false;
    const panel = this.root.querySelector<HTMLElement>('#mission-assistant-panel');
    const button = this.root.querySelector<HTMLButtonElement>('[data-assistant-action="toggle"]');
    if (panel) panel.hidden = true;
    button?.setAttribute('aria-expanded', 'false');
  }

  private submitAssistantQuestion(question: string, includeUserMessage = true): void {
    const clean = question.trim();
    if (!clean) return;
    if (includeUserMessage) this.appendAssistantMessage('YOU', clean);
    const reply = this.callbacks.askAssistant(clean);
    this.appendAssistantMessage('KSA MISSION CONTROL', reply.answer, reply.context);
  }

  private appendAssistantMessage(role: string, message: string, context?: string): void {
    const transcript = this.root.querySelector<HTMLElement>('#mission-assistant-transcript');
    if (!transcript) return;
    const article = document.createElement('article');
    article.className = `assistant-message ${role === 'YOU' ? 'is-user' : 'is-assistant'}`;
    const heading = document.createElement('strong');
    heading.textContent = role;
    const body = document.createElement('p');
    body.textContent = message;
    article.append(heading, body);
    if (context) {
      const meta = document.createElement('small');
      meta.textContent = context;
      article.append(meta);
    }
    transcript.append(article);
    this.assistantMessageCount += 1;
    while (transcript.children.length > 12) transcript.firstElementChild?.remove();
    transcript.scrollTop = transcript.scrollHeight;
  }

  private toggleLog(): void {
    const log = this.root.querySelector<HTMLElement>('#mission-log');
    log?.classList.toggle('is-open');
  }

  private renderMenu(): void {
    const hasSavedMission = this.hasSavedMission();
    this.root.innerHTML = `<div class="screen menu-screen">
      <div class="menu-topbar"><div class="brand-lockup"><span class="brand-symbol">86</span><span><strong>KSA OUTPOST 86</strong><small>STUDENT MISSION TRAINING</small></span></div><span class="top-status"><i></i> SIMULATION READY</span></div>
      <div class="menu-content"><div class="menu-copy"><div class="eyebrow"><span class="eyebrow-line"></span> LUNAR SOUTH POLE · TRAINING MISSION 01</div>
        <h1>BUILD.<br><em>SURVIVE.</em><br>EXPLORE.</h1>
        <p class="menu-intro">One outpost. Seven mission days. Your decisions keep the crew, the equipment and the science alive.</p>
        <div class="menu-actions"><button class="primary-button" data-ui-action="start"><span>START MISSION</span><b>↗</b></button>${hasSavedMission ? '<button class="secondary-button" data-ui-action="continue">CONTINUE SAVED <span>→</span></button>' : '<button class="secondary-button" data-ui-action="guide">HOW TO PLAY <span>→</span></button>'}</div>
        <div class="menu-links"><button data-ui-action="lander-lab">LUNAR LANDER LAB</button><button data-ui-action="about">ABOUT THE PROJECT</button><button data-ui-action="sources">SCIENCE & SOURCES</button><button data-ui-action="settings">SETTINGS</button></div>
      </div>
      <aside class="mission-preview"><div class="preview-tag">MISSION 01 <span>FIRST LIGHT</span></div><div class="preview-orbit"><div class="orbit-ring"></div><div class="orbit-moon"></div><div class="orbit-satellite">✦</div></div>
        <div class="preview-data"><div><small>LOCATION</small><strong>POLAR RIDGE</strong></div><div><small>DURATION</small><strong>7 DAYS</strong></div><div><small>ROLE</small><strong>OUTPOST COMMANDER</strong></div></div>
        <div class="preview-foot"><span>FICTIONAL TRAINING SITE</span><span>V. 2.2.0</span></div>
      </aside></div>
      <div class="menu-footer"><span>AN EDUCATIONAL PROJECT BY KSA</span><span>NOT A NASA PRODUCT · NOT ENGINEERING GUIDANCE</span></div>
    </div>`;
  }

  private renderBriefing(): void {
    this.root.innerHTML = `<div class="screen briefing-screen"><header class="screen-header"><div class="brand-lockup"><span class="brand-symbol">86</span><span><strong>KSA OUTPOST 86</strong><small>MISSION CONTROL</small></span></div><button class="text-button" data-ui-action="menu">← BACK TO MENU</button></header>
      <main class="briefing-layout"><div class="briefing-main"><div class="eyebrow">MISSION 01 · FIRST LIGHT</div><h1>YOUR OUTPOST<br>NEEDS YOU.</h1><p class="lead">You have arrived at a newly commissioned research outpost near the lunar south pole. The systems are running, but the crew needs you to inspect, plan and respond.</p>
        <div class="briefing-cards"><article><span>01 / POWER</span><strong>Balance demand</strong><p>Manage solar generation and stored battery energy.</p></article><article><span>02 / LIFE SUPPORT</span><strong>Protect the crew</strong><p>Understand oxygen, air cleaning and water as distinct systems.</p></article><article><span>03 / SCIENCE</span><strong>Explore the surface</strong><p>Complete a simple regolith survey and learn from the result.</p></article></div>
        <button class="primary-button briefing-start" data-ui-action="begin"><span>DEPLOY TO OUTPOST</span><b>↗</b></button>
      </div><aside class="briefing-side"><div class="side-heading">MISSION PARAMETERS</div><dl><div><dt>MISSION SITE</dt><dd>Fictional Polar Ridge Training Site</dd></div><div><dt>MISSION LENGTH</dt><dd>7 accelerated days</dd></div><div><dt>PLAY TIME</dt><dd>Designed for a short classroom session</dd></div><div><dt>YOUR OBJECTIVE</dt><dd>Keep essential systems ready and complete the survey</dd></div></dl><div class="training-note"><strong>TRAINING VALUES</strong><p>All resource numbers are simplified game values. They are not NASA engineering specifications or crew-health limits.</p></div><div class="controls-note"><strong>CONTROLS</strong><p><kbd>W A S D</kbd> Move · <kbd>MOUSE</kbd> Look · <kbd>E</kbd> Interact · <kbd>ESC</kbd> Pause</p><p>On touchscreens, use the on-screen joystick and tap INTERACT.</p></div></aside></main>
      <footer class="screen-footer"><span>BUILD. SURVIVE. EXPLORE.</span><span>KSA STUDENT PROJECT · NOT NASA-ENDORSED</span></footer></div>`;
  }

  private renderGuide(): void {
    this.root.innerHTML = `<div class="screen info-screen"><header class="screen-header"><div class="brand-lockup"><span class="brand-symbol">86</span><span><strong>KSA OUTPOST 86</strong><small>FIELD GUIDE</small></span></div><button class="text-button" data-ui-action="menu">← BACK</button></header>
      <main class="info-layout"><div class="eyebrow">QUICK TRAINING</div><h1>HOW TO PLAY</h1><p class="lead">Move through the outpost. Find a marked system. Interact, make a choice and read the consequence.</p>
        <div class="guide-grid"><article><span class="guide-num">01</span><h3>MOVE</h3><p>Use W A S D or the mobile joystick to walk around the lunar site. Drag to look around.</p></article><article><span class="guide-num">02</span><h3>INSPECT</h3><p>Approach a console until its name appears. Press E or tap INTERACT to open it.</p></article><article><span class="guide-num">03</span><h3>DECIDE</h3><p>Choose a power, water, greenhouse or shelter action. The mission state changes after every decision.</p></article><article><span class="guide-num">04</span><h3>ADVANCE</h3><p>Finish the current objective, then complete the day. New events appear on the next day.</p></article></div>
        <div class="guide-controls"><strong>DESKTOP</strong><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</span><span><kbd>E</kbd> Interact</span><span><kbd>ESC</kbd> Pause</span><span><kbd>CLICK + DRAG</kbd> Look around</span></div>
        <button class="primary-button" data-ui-action="start"><span>CONTINUE TO MISSION BRIEFING</span><b>↗</b></button></main></div>`;
  }

  private renderAbout(): void {
    this.root.innerHTML = `<div class="screen info-screen"><header class="screen-header"><div class="brand-lockup"><span class="brand-symbol">86</span><span><strong>KSA OUTPOST 86</strong><small>ABOUT</small></span></div><button class="text-button" data-ui-action="menu">← BACK</button></header>
      <main class="info-layout narrow"><div class="eyebrow">A KSA EDUCATIONAL PROJECT</div><h1>LEARN BY<br>MAKING DECISIONS.</h1><p class="lead">KSA OUTPOST 86 is a student-created lunar outpost training simulation for the NASA Space Apps Challenge 2026 challenge, “Build a Junior Astronaut Mission Trainer.”</p>
        <div class="about-statement"><p>The experience makes connected mission systems understandable through exploration, choices and cause-and-effect feedback. It is a fictional learning environment, not a real lunar base, NASA mission tool or engineering simulator.</p></div>
        <p class="small-print">NASA has not endorsed, certified or approved this application. No account is required and no personal information is collected by the game.</p>
        <button class="primary-button" data-ui-action="sources"><span>VIEW SCIENCE & SOURCES</span><b>↗</b></button></main></div>`;
  }

  private renderSettings(): void {
    const settings = this.readSettings();
    this.root.innerHTML = `<div class="screen info-screen"><header class="screen-header"><div class="brand-lockup"><span class="brand-symbol">86</span><span><strong>KSA OUTPOST 86</strong><small>SETTINGS</small></span></div><button class="text-button" data-ui-action="menu">← BACK</button></header>
      <main class="info-layout narrow"><div class="eyebrow">ACCESSIBILITY & PERFORMANCE</div><h1>MISSION<br>SETTINGS.</h1><p class="lead">Adjust the experience for the device you are using. Preferences are stored on this device.</p>
        <div class="settings-list"><label><span><strong>Graphics quality</strong><small>Lower settings can help on older phones and laptops.</small></span><select data-ui-action="quality"><option value="low" ${settings.quality === 'low' ? 'selected' : ''}>Low</option><option value="medium" ${settings.quality === 'medium' ? 'selected' : ''}>Medium</option><option value="high" ${settings.quality === 'high' ? 'selected' : ''}>High</option></select></label><label><span><strong>Reduced motion</strong><small>Reduce interface transitions and non-essential movement.</small></span><input type="checkbox" data-ui-action="reduced-motion" ${settings.reducedMotion ? 'checked' : ''}></label></div>
        <div class="training-note"><strong>AUDIO CONTROLS</strong><p>Original training sound effects are included. Open the audio controls to enable them after interacting with the page, adjust volume or test the radio cue.</p><button class="secondary-button" data-ui-action="open-audio-settings">OPEN AUDIO CONTROLS <span>↗</span></button></div></main></div>`;
  }

  private hasSavedMission(): boolean {
    try { return Boolean(localStorage.getItem('ksa-outpost-86-mission-v1')); } catch { return false; }
  }

  private readSettings(): { quality: 'low' | 'medium' | 'high'; reducedMotion: boolean } {
    try {
      const value = JSON.parse(localStorage.getItem('ksa-outpost-86-settings-v1') || '{}') as { quality?: string; reducedMotion?: boolean };
      const quality = value.quality === 'low' || value.quality === 'high' ? value.quality : 'medium';
      return { quality, reducedMotion: value.reducedMotion === true };
    } catch { return { quality: 'medium', reducedMotion: false }; }
  }

  private renderSources(): void {
    this.root.innerHTML = `<div class="screen info-screen"><header class="screen-header"><div class="brand-lockup"><span class="brand-symbol">86</span><span><strong>KSA OUTPOST 86</strong><small>SCIENCE & LIMITATIONS</small></span></div><button class="text-button" data-ui-action="menu">← BACK</button></header>
      <main class="info-layout narrow"><div class="eyebrow">EDUCATIONAL REFERENCES</div><h1>THE SCIENCE<br>BEHIND THE GAME.</h1><p class="lead">The game uses simplified classroom models. These references support the explanations; they do not validate the game's numerical meters.</p>
        <div class="source-list"><a href="https://www.nasa.gov/reference/environmental-control-and-life-support-systems-eclss/" target="_blank" rel="noreferrer"><span>NASA · ECLSS</span><strong>Environmental Control and Life Support Systems</strong><small>Oxygen generation, air revitalisation and water recovery are distinct functions.</small></a>
        <a href="https://www.nasa.gov/reference/moonbase-environment/" target="_blank" rel="noreferrer"><span>NASA · LUNAR SOUTH POLE</span><strong>The Lunar South Pole Region</strong><small>Low-angle sunlight, long shadows and permanently shadowed regions.</small></a>
        <a href="https://science.nasa.gov/resource/shadows-near-the-moons-south-pole/" target="_blank" rel="noreferrer"><span>NASA SCIENCE VISUALIZATION STUDIO</span><strong>Shadows near the Moon’s South Pole</strong><small>How long shadows move across rugged polar terrain.</small></a>
        <a href="https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/" target="_blank" rel="noreferrer"><span>NASA SPACE APPS · 2026</span><strong>Build a Junior Astronaut Mission Trainer</strong><small>The official challenge statement.</small></a></div>
        <div class="training-note"><strong>LIMITATIONS</strong><p>Mission resources use invented training units on a 0–100 scale. The radiation alert is procedural, not a dose forecast. The outpost, sample and events are fictional. This is not validated mission planning software.</p></div></main></div>`;
  }

  private renderLanderLab(): void {
    this.stopLanderLoop();
    this.landerState = createLanderState();
    this.landerThrottle = 0.55;
    this.landerLateral = 0;
    this.root.innerHTML = `<div class="screen info-screen lander-lab-screen">
      <header class="screen-header"><div class="brand-lockup"><span class="brand-symbol">86</span><span><strong>KSA OUTPOST 86</strong><small>ASTRONAUT ACADEMY · TRAINING LAB</small></span></div><button class="text-button" data-ui-action="menu">← BACK TO MISSION CONTROL</button></header>
      <main class="lander-layout"><div class="eyebrow">TRAINING LAB / 01 · DESCENT & TOUCHDOWN</div><h1>LAND SOFTLY.</h1><p class="lead">Guide a training lander towards a marked lunar pad. Manage vertical thrust, reduce lateral drift and aim for a controlled touchdown.</p>
        <div class="lander-grid"><section class="lander-visual-panel"><div class="lander-panel-heading"><span>APPROACH DISPLAY</span><strong data-lander-phase>READY FOR DESCENT</strong></div>
          <canvas id="lander-canvas" width="960" height="480" role="img" aria-label="Animated two-dimensional lunar lander approach with altitude and landing pad visualisation">Lunar lander training display.</canvas>
          <div class="lander-telemetry"><article><small>ALTITUDE</small><strong data-lander-stat="altitude">180 m</strong></article><article><small>VERTICAL SPEED</small><strong data-lander-stat="vertical">11.5 m/s DOWN</strong></article><article><small>HORIZONTAL SPEED</small><strong data-lander-stat="horizontal">2.2 m/s</strong></article><article><small>FUEL RESERVE</small><strong data-lander-stat="fuel">100%</strong></article></div>
        </section>
        <aside class="lander-controls"><div class="lander-controls-overline">FLIGHT CONTROLS</div><h2>TRIM YOUR APPROACH.</h2><p>Raise engine thrust to slow the descent. Use lateral trim to reduce sideways speed and approach the landing marker.</p>
          <div class="lander-coaching"><strong>QUICK COACHING · GAME VALUES</strong><span>Try about 55% thrust early. Briefly trim LEFT to cancel the initial drift, then ease towards 36% when descent speed is near 3 m/s.</span></div>
          <label class="lander-control" for="lander-throttle"><span><strong>VERTICAL THRUST</strong><output id="lander-throttle-value">55%</output></span><input id="lander-throttle" type="range" min="0" max="100" value="55" step="1"><small>0% · FREE DESCENT <b>100% · MAX THRUST</b></small></label>
          <label class="lander-control" for="lander-lateral"><span><strong>LATERAL TRIM</strong><output id="lander-lateral-value">NEUTRAL</output></span><input id="lander-lateral" type="range" min="-100" max="100" value="0" step="1"><small>LEFT <b>RIGHT</b></small></label>
          <div class="lander-button-row"><button class="primary-button" data-ui-action="lander-start" id="lander-start">START DESCENT <b>↗</b></button><button class="secondary-button" data-ui-action="lander-reset">RESET</button></div>
          <div class="lander-status" data-lander-message aria-live="polite">SYSTEM READY · Start the descent, then adjust the controls while the lander is moving.</div>
          <div class="lander-rubric"><strong>TRAINING LANDING RUBRIC</strong><p>For this game, a safe landing requires low vertical speed, low sideways speed and arrival near the pad. These are game scoring thresholds, not real-world lander certification limits.</p></div>
        </aside></div>
        <div class="training-note lander-model-note"><strong>MODEL TRANSPARENCY</strong><p>This is a simplified 2D classroom exercise using fixed game parameters. It does not solve real lunar descent guidance, navigation, propulsion, terrain-relative navigation or spacecraft flight dynamics.</p></div>
      </main><footer class="screen-footer"><span>BUILD. SURVIVE. EXPLORE.</span><span>KSA STUDENT PROJECT · NOT NASA-ENDORSED</span></footer></div>`;
    this.updateLanderDisplay();
    this.drawLanderScene();
  }

  private startLanderRun(): void {
    if (this.landerState.phase === 'flight') return;
    if (this.landerState.phase !== 'ready') this.resetLanderRun();
    this.landerState = startLander(this.landerState);
    this.landerLastFrame = 0;
    const button = this.root.querySelector<HTMLButtonElement>('#lander-start');
    if (button) { button.disabled = true; button.textContent = 'DESCENT IN PROGRESS'; }
    this.landerAnimationFrame = window.requestAnimationFrame(this.tickLanderFrame);
    this.updateLanderDisplay();
  }

  private resetLanderRun(): void {
    this.stopLanderLoop();
    this.landerState = createLanderState();
    this.landerThrottle = 0.55;
    this.landerLateral = 0;
    const throttle = this.root.querySelector<HTMLInputElement>('#lander-throttle');
    const lateral = this.root.querySelector<HTMLInputElement>('#lander-lateral');
    if (throttle) throttle.value = '55';
    if (lateral) lateral.value = '0';
    const throttleValue = this.root.querySelector<HTMLOutputElement>('#lander-throttle-value');
    const lateralValue = this.root.querySelector<HTMLOutputElement>('#lander-lateral-value');
    if (throttleValue) throttleValue.value = '55%';
    if (lateralValue) lateralValue.value = 'NEUTRAL';
    this.updateLanderDisplay();
    this.drawLanderScene();
  }

  private stopLanderLoop(): void {
    if (this.landerAnimationFrame !== null) window.cancelAnimationFrame(this.landerAnimationFrame);
    this.landerAnimationFrame = null;
    this.landerLastFrame = 0;
  }

  private tickLanderFrame = (timestamp: number): void => {
    if (this.screen !== 'lander-lab' || this.landerState.phase !== 'flight') {
      this.landerAnimationFrame = null;
      return;
    }
    const delta = this.landerLastFrame === 0 ? 1 / 60 : Math.min((timestamp - this.landerLastFrame) / 1000, 0.05);
    this.landerLastFrame = timestamp;
    this.landerState = stepLander(this.landerState, {
      throttle: this.landerThrottle,
      lateral: this.landerLateral,
    }, delta);
    this.updateLanderDisplay();
    this.drawLanderScene();
    if (this.landerState.phase === 'flight') {
      this.landerAnimationFrame = window.requestAnimationFrame(this.tickLanderFrame);
    } else {
      this.landerAnimationFrame = null;
    }
  };

  private updateLanderDisplay(): void {
    const state = this.landerState;
    const altitude = this.root.querySelector<HTMLElement>('[data-lander-stat="altitude"]');
    const vertical = this.root.querySelector<HTMLElement>('[data-lander-stat="vertical"]');
    const horizontal = this.root.querySelector<HTMLElement>('[data-lander-stat="horizontal"]');
    const fuel = this.root.querySelector<HTMLElement>('[data-lander-stat="fuel"]');
    const phase = this.root.querySelector<HTMLElement>('[data-lander-phase]');
    const message = this.root.querySelector<HTMLElement>('[data-lander-message]');
    const button = this.root.querySelector<HTMLButtonElement>('#lander-start');
    if (altitude) altitude.textContent = `${Math.round(state.altitude)} m`;
    if (vertical) vertical.textContent = `${Math.abs(state.verticalVelocity).toFixed(1)} m/s ${state.verticalVelocity < 0 ? 'DOWN' : 'UP'}`;
    if (horizontal) horizontal.textContent = `${Math.abs(state.horizontalVelocity).toFixed(1)} m/s`;
    if (fuel) fuel.textContent = `${Math.round(state.fuel)}%`;
    if (phase) {
      phase.textContent = state.phase === 'ready' ? 'READY FOR DESCENT'
        : state.phase === 'flight' ? 'DESCENT ACTIVE'
          : state.phase === 'landed' ? 'SAFE TOUCHDOWN' : 'LANDING CONTACT · RETRY';
      phase.dataset.phase = state.phase;
    }
    if (message) {
      message.textContent = state.phase === 'ready' ? 'SYSTEM READY · Start the descent, then adjust the controls while the lander is moving.'
        : state.phase === 'flight' ? 'FLIGHT ACTIVE · Watch the speed indicators and keep trimming your approach.'
          : state.phase === 'landed' ? 'SAFE TOUCHDOWN · The training lander reached the pad within the exercise scoring limits.'
            : 'HARD LANDING · The training limits were exceeded. Reset and try a slower, better-aligned approach.';
      message.dataset.phase = state.phase;
    }
    if (button) {
      button.disabled = state.phase === 'flight';
      button.innerHTML = state.phase === 'ready' ? 'START DESCENT <b>↗</b>' : state.phase === 'flight' ? 'DESCENT IN PROGRESS' : 'RUN AGAIN <b>↻</b>';
    }
  }

  private drawLanderScene(): void {
    const canvas = this.root.querySelector<HTMLCanvasElement>('#lander-canvas');
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const width = canvas.width;
    const height = canvas.height;
    const groundY = 420;
    const state = this.landerState;
    context.clearRect(0, 0, width, height);

    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#071321');
    sky.addColorStop(0.72, '#172532');
    sky.addColorStop(1, '#28323b');
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);

    for (let index = 0; index < 72; index += 1) {
      const x = (index * 137 + 31) % width;
      const y = (index * 67 + 23) % 260;
      const radius = index % 9 === 0 ? 1.7 : 0.85;
      context.fillStyle = index % 5 === 0 ? '#d7c9a6' : '#9fb3c1';
      context.globalAlpha = 0.32 + (index % 6) * 0.1;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;

    context.fillStyle = '#39434b';
    context.beginPath();
    context.moveTo(0, groundY - 34);
    for (let x = 0; x <= width; x += 24) {
      const ridge = groundY - 34 + Math.sin(x * 0.012) * 12 + Math.sin(x * 0.034 + 1.1) * 8;
      context.lineTo(x, ridge);
    }
    context.lineTo(width, height);
    context.lineTo(0, height);
    context.closePath();
    context.fill();
    context.fillStyle = '#73716d';
    context.fillRect(0, groundY, width, height - groundY);

    const padCenter = width / 2;
    context.strokeStyle = '#efaa5a';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(padCenter - 78, groundY);
    context.lineTo(padCenter + 78, groundY);
    context.stroke();
    context.strokeStyle = '#efaa5a66';
    context.lineWidth = 1;
    context.setLineDash([7, 8]);
    context.beginPath();
    context.moveTo(padCenter, 28);
    context.lineTo(padCenter, groundY - 3);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = '#f3bf7f';
    context.font = '12px monospace';
    context.fillText('TRAINING PAD 01', padCenter - 49, groundY + 24);

    const landerX = padCenter + state.horizontalPosition * 5.3;
    const landerY = Math.max(62, groundY - state.altitude * 1.75 - 26);
    const lean = Math.max(-0.24, Math.min(0.24, state.horizontalVelocity * 0.025));
    context.save();
    context.translate(landerX, landerY);
    context.rotate(lean);
    if (state.phase === 'flight' && this.landerThrottle > 0.08) {
      const flameLength = 18 + this.landerThrottle * 42;
      const flame = context.createLinearGradient(0, 15, 0, 15 + flameLength);
      flame.addColorStop(0, '#fff0bd');
      flame.addColorStop(0.45, '#f5a34d');
      flame.addColorStop(1, '#d65c31');
      context.fillStyle = flame;
      context.beginPath();
      context.moveTo(-7, 16);
      context.lineTo(0, 16 + flameLength);
      context.lineTo(7, 16);
      context.closePath();
      context.fill();
    }
    context.fillStyle = '#dce2e4';
    context.strokeStyle = '#7f929e';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-22, -10);
    context.lineTo(-14, -25);
    context.lineTo(14, -25);
    context.lineTo(22, -10);
    context.lineTo(17, 15);
    context.lineTo(-17, 15);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = '#456d83';
    context.fillRect(-10, -19, 20, 10);
    context.strokeStyle = '#c7d0d2';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-14, 12); context.lineTo(-26, 28); context.lineTo(-38, 28);
    context.moveTo(14, 12); context.lineTo(26, 28); context.lineTo(38, 28);
    context.stroke();
    context.restore();

    if (state.phase === 'landed' || state.phase === 'crashed') {
      context.fillStyle = state.phase === 'landed' ? '#75c49b' : '#e67871';
      context.font = '700 25px monospace';
      context.textAlign = 'center';
      context.fillText(state.phase === 'landed' ? 'TOUCHDOWN CONFIRMED' : 'HARD LANDING', padCenter, 74);
      context.textAlign = 'start';
    }
    context.fillStyle = '#d8e1e6';
    context.font = '11px monospace';
    context.fillText(`ALT ${Math.round(state.altitude)} M`, 24, 30);
    context.fillText(`FUEL ${Math.round(state.fuel)}%`, 24, 49);
  }

  private renderGameShell(state?: MissionState): void {
    this.assistantOpen = false;
    this.assistantMessageCount = 0;
    this.root.innerHTML = `<div class="game-shell">
      <header class="game-topbar"><div class="game-brand"><span class="brand-symbol small">86</span><span><strong>KSA OUTPOST 86</strong><small>MISSION 01 · FIRST LIGHT</small></span></div><div class="game-top-center"><span class="day-pill" data-hud="day">DAY 1 / 7</span><span class="system-pill"><i></i><b data-hud="alert">SYSTEMS NOMINAL</b></span></div><div class="game-top-actions"><button class="assistant-open-button" type="button" data-assistant-action="toggle" aria-expanded="false" aria-controls="mission-assistant-panel">MISSION AI</button><button class="icon-button" data-ui-action="save" title="Save mission">↓</button><button class="icon-button" data-ui-action="open-log" title="Mission log">≡</button><button class="icon-button" data-ui-action="pause" title="Pause mission">Ⅱ</button></div></header>
      <aside class="resource-rail"><div class="rail-heading">OUTPOST STATUS</div>
        <div class="rail-resource"><span class="resource-icon power-icon">ϟ</span><div><small>BATTERY</small><strong data-hud="battery">78%</strong></div></div>
        <div class="rail-bar"><span data-resource="battery" class="good" style="width:78%"></span></div>
        <div class="rail-resource"><span class="resource-icon oxygen-icon">O₂</span><div><small>OXYGEN SUPPLY</small><strong data-hud="oxygen">86%</strong></div></div>
        <div class="rail-bar"><span data-resource="oxygen" class="good" style="width:86%"></span></div>
        <div class="rail-resource"><span class="resource-icon water-icon">H₂O</span><div><small>WATER RESERVE</small><strong data-hud="water">72%</strong></div></div>
        <div class="rail-bar"><span data-resource="water" class="good" style="width:72%"></span></div>
        <div class="rail-resource"><span class="resource-icon food-icon">⌁</span><div><small>FOOD STORES</small><strong data-hud="food">84%</strong></div></div>
        <div class="rail-bar"><span data-resource="food" class="good" style="width:84%"></span></div>
        <div class="rail-separator"></div><div class="rail-heading">POWER FLOW</div><div class="power-flow"><span>SOLAR / LOAD</span><strong data-hud="power">20 / 16</strong></div>
        <div class="rail-separator"></div><button class="rail-link" data-ui-action="sources">SCIENCE NOTES <span>↗</span></button>
      </aside>
      <aside class="objective-card"><div class="objective-overline"><span>MISSION CONTROL</span><b data-hud="objective-state">IN PROGRESS</b></div><h2 data-hud="objective-title">Commission the outpost</h2><p data-hud="objective-detail">Inspect the power console and life-support panel.</p><div class="objective-footer"><span>ACCELERATED TRAINING DAY</span><button class="mini-action" data-ui-action="advance" disabled>OBJECTIVE IN PROGRESS</button></div></aside>
      <div class="interaction-prompt" data-hud="interaction"><span class="keycap">W A S D</span><span><strong>Explore the outpost</strong><small>Walk to a marked system to interact</small></span></div>
      <div class="game-bottom"><div class="location-tag"><span class="location-dot"></span><span>POLAR RIDGE · OUTPOST 86</span></div><div class="bottom-controls"><span><kbd>W A S D</kbd> MOVE</span><span><kbd>E</kbd> INTERACT</span><span><kbd>ESC</kbd> PAUSE</span></div></div>
      <div class="mobile-controls"><div class="joystick" id="joystick"><div class="joystick-knob" id="joystick-knob"></div></div><button class="mobile-interact" data-ui-action="mobile-interact">INTERACT</button></div>
      <div id="interaction-panel" class="interaction-layer"></div>
      <aside id="mission-log" class="mission-log"><div class="log-heading"><strong>MISSION LOG</strong><button class="icon-button" data-ui-action="open-log">×</button></div><ol id="mission-log-list"></ol></aside>
      <section id="mission-assistant-panel" class="mission-assistant-panel" role="dialog" aria-label="KSA Mission Control offline assistant" hidden>
        <header class="assistant-panel-heading"><div><span>OFFLINE KNOWLEDGE SYSTEM</span><strong>KSA MISSION CONTROL AI</strong></div><button type="button" class="icon-button" data-assistant-action="close" aria-label="Close assistant">×</button></header>
        <p class="assistant-disclaimer">Context-aware training help. No cloud AI, live NASA data or spacecraft control.</p>
        <div id="mission-assistant-transcript" class="assistant-transcript" aria-live="polite" aria-relevant="additions"></div>
        <div class="assistant-quick-prompts"><button type="button" data-assistant-question="What should I do here?">HELP HERE</button><button type="button" data-assistant-question="Explain life support">LIFE SUPPORT</button><button type="button" data-assistant-question="What about radiation?">RADIATION</button></div>
        <form id="mission-assistant-form" class="assistant-form"><label class="sr-only" for="mission-assistant-input">Ask the mission assistant</label><input id="mission-assistant-input" name="question" maxlength="240" autocomplete="off" placeholder="Ask about this mission…" required /><button type="submit">ASK</button></form>
      </section>
      <div class="training-watermark">KSA TRAINING SIMULATION · VALUES ARE ILLUSTRATIVE</div>
    </div>`;
    this.installJoystick();
    if (state) {
      this.renderHud(state, null);
      this.renderMissionLog(state);
    }
  }

  private installJoystick(): void {
    const joystick = this.root.querySelector<HTMLElement>('#joystick');
    const knob = this.root.querySelector<HTMLElement>('#joystick-knob');
    if (!joystick || !knob) return;
    let active = false;
    const reset = (): void => {
      active = false;
      knob.style.transform = 'translate(-50%, -50%)';
      this.callbacks.joystick(0, 0);
    };
    joystick.addEventListener('pointerdown', (event) => {
      active = true;
      joystick.setPointerCapture(event.pointerId);
      update(event);
    });
    const update = (event: PointerEvent): void => {
      if (!active) return;
      const rect = joystick.getBoundingClientRect();
      const radius = rect.width * 0.31;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = event.clientX - cx;
      const dy = event.clientY - cy;
      const length = Math.hypot(dx, dy);
      const scale = length > radius ? radius / length : 1;
      const x = dx * scale / radius;
      const y = dy * scale / radius;
      knob.style.transform = `translate(calc(-50% + ${dx * scale}px), calc(-50% + ${dy * scale}px))`;
      this.callbacks.joystick(x, -y);
    };
    joystick.addEventListener('pointermove', update);
    joystick.addEventListener('pointerup', reset);
    joystick.addEventListener('pointercancel', reset);
  }

  private renderPause(): void {
    this.root.innerHTML = `<div class="screen pause-screen"><div class="pause-panel"><div class="eyebrow">MISSION CONTROL</div><h1>MISSION<br>PAUSED.</h1><p>The simulation clock is stopped. Review your plan, then return to the outpost.</p><button class="primary-button" data-ui-action="resume"><span>RESUME MISSION</span><b>▶</b></button><button class="secondary-button full" data-ui-action="guide">HOW TO PLAY</button><button class="text-button" data-ui-action="menu">EXIT TO MAIN MENU</button></div></div>`;
  }

  private renderDebrief(state: MissionState): void {
    const score = state.finalScore ?? 0;
    const metric = (name: string, value: number): string => `<div class="debrief-metric"><span>${name}</span><strong>${Math.round(value)}%</strong><div class="rail-bar"><span class="${value < 35 ? 'danger' : value < 60 ? 'caution' : 'good'}" style="width:${Math.max(0, Math.min(100, value))}%"></span></div></div>`;
    const completed = [state.powerInspected && 'Power system inspected', state.lifeSupportInspected && 'Life support inspected', state.powerPlanConfirmed && 'Power plan selected', state.waterActionComplete && 'Water objective completed', state.shelterSecured && 'Shelter procedure completed', state.greenhouseActionComplete && 'Greenhouse schedule selected', state.surveyComplete && 'Science survey completed'].filter(Boolean) as string[];
    this.root.innerHTML = `<div class="screen debrief-screen"><header class="screen-header"><div class="brand-lockup"><span class="brand-symbol">86</span><span><strong>KSA OUTPOST 86</strong><small>MISSION DEBRIEF</small></span></div><span class="top-status"><i></i> TRAINING MISSION CLOSED</span></header>
      <main class="debrief-layout"><div class="debrief-score"><div class="eyebrow">MISSION 01 · FIRST LIGHT</div><div class="score-ring"><div><strong>${score}</strong><span>TRAINING SCORE</span></div></div><h1>${state.finalRating || 'Mission complete'}</h1><p>Your choices shaped the outpost's performance. The score is a classroom feedback aid, not a real mission certification.</p><button class="primary-button" data-ui-action="restart"><span>REPLAY MISSION</span><b>↻</b></button><button class="secondary-button full" data-ui-action="menu">MAIN MENU</button></div>
      <div class="debrief-details"><section class="debrief-section"><div class="section-heading"><span>01 / FINAL SYSTEM STATUS</span><small>TRAINING INDICATORS</small></div>${metric('Battery reserve', state.battery)}${metric('Oxygen supply', state.oxygen)}${metric('Cabin-air condition', state.cabinAir)}${metric('Water reserve', state.water)}${metric('Food stores', state.food)}${metric('Thermal condition', state.thermal)}</section>
      <section class="debrief-section"><div class="section-heading"><span>02 / COMPLETED OBJECTIVES</span><small>${completed.length} RECORDED</small></div><ul class="completed-list">${completed.map((item) => `<li><span>✓</span>${item}</li>`).join('')}</ul></section>
      <section class="debrief-section"><div class="section-heading"><span>03 / WHAT YOU LEARNED</span><small>MISSION DEBRIEF</small></div><div class="learning-points"><p><strong>Power:</strong> generation and demand must be balanced; a battery helps cover a shortfall but is not unlimited.</p><p><strong>Life support:</strong> oxygen supply and carbon-dioxide removal are separate functions within a wider cabin environment system.</p><p><strong>Water and food:</strong> recycling and greenhouse growth take time and compete for resources.</p><p><strong>Radiation:</strong> follow warning procedures and use shielding; a shelter does not make radiation disappear.</p></div></section>
      <section class="debrief-section"><div class="section-heading"><span>04 / MISSION LOG</span><small>RECENT DECISIONS</small></div><ol class="debrief-log">${state.log.slice(0, 7).reverse().map((entry) => `<li><span>DAY ${entry.day}</span><strong>${entry.title}</strong><small>${entry.detail}</small></li>`).join('')}</ol></section>
      <div class="training-note"><strong>SCIENTIFIC LIMITATION</strong><p>All numeric meters and event timing are simplified KSA training values. This game is not a validated spacecraft life-support, radiation, power or mission-planning model.</p></div>
      <button class="text-button" data-ui-action="sources">OPEN SCIENCE SOURCES →</button></div></main>
      <footer class="screen-footer"><span>BUILD. SURVIVE. EXPLORE.</span><span>KSA STUDENT PROJECT · NOT NASA-ENDORSED</span></footer></div>`;
  }

  destroy(): void {
    this.stopLanderLoop();
    this.root.removeEventListener('click', this.handleClick);
    this.root.removeEventListener('change', this.handleChange);
    this.root.removeEventListener('input', this.handleInput);
    this.root.removeEventListener('submit', this.handleSubmit);
    window.clearTimeout(this.toastTimer);
  }
}
