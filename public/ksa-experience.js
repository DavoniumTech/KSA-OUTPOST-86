/* KSA OUTPOST 86 — Mission Experience Layer v2.0.0
   Original UI, audio cues and procedural surface scan assets for the KSA student simulation.
   This layer augments the existing PlayCanvas experience; it does not replace the game engine. */
(() => {
  'use strict';

  const VERSION = '2.0.0';
  const app = document.getElementById('app');
  const uiRoot = document.getElementById('ui-root');
  if (!app || !uiRoot || document.getElementById('ksa-console')) return;

  const scriptUrl = document.currentScript?.src || new URL('./ksa-experience.js', location.href).href;
  const assetUrl = (relative) => new URL(relative, scriptUrl).href;
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false;
  const audioFiles = {
    ambience: 'assets/audio/outpost-ambience.ogg',
    breathing: 'assets/audio/suit-breathing.ogg',
    step: 'assets/audio/boot-regolith-step.ogg',
    radio: 'assets/audio/radio-chirp.ogg',
    warning: 'assets/audio/system-warning.ogg',
    success: 'assets/audio/mission-success.ogg',
    click: 'assets/audio/ui-soft-click.ogg'
  };
  const audio = Object.fromEntries(Object.entries(audioFiles).map(([key, file]) => {
    const item = new Audio(assetUrl(file));
    item.preload = key === 'ambience' || key === 'breathing' ? 'auto' : 'metadata';
    item.loop = key === 'ambience' || key === 'breathing';
    item.volume = key === 'ambience' ? 0.19 : key === 'breathing' ? 0.13 : 0.38;
    return [key, item];
  }));
  const sound = { effects: true, ambience: false, breathing: false, volume: 0.62, unlocked: false };
  let panelOpen = false;
  let activeTab = 'crew';
  let activeLayer = 'albedo';
  let reliefOpacity = 48;
  let scanImages = {};
  const scanLoading = new Set();
  let lastStepAt = 0;
  let lastToastSignature = '';
  let lastUiState = '';
  let visorOn = false;
  let scanFrame = 0;
  let lastFrameAt = 0;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const play = (key, restart = true) => {
    const item = audio[key];
    if (!item || !sound.effects && !['ambience', 'breathing'].includes(key)) return;
    if (restart && !item.loop) item.currentTime = 0;
    item.volume = clamp(sound.volume * (key === 'ambience' ? .3 : key === 'breathing' ? .22 : .72), 0, 1);
    const promise = item.play();
    if (promise?.catch) promise.catch(() => {});
  };
  const pauseLoop = (key) => { try { audio[key].pause(); audio[key].currentTime = 0; } catch {} };
  const syncLoops = () => {
    if (sound.ambience && sound.unlocked) play('ambience', false); else pauseLoop('ambience');
    if (sound.breathing && sound.unlocked) play('breathing', false); else pauseLoop('breathing');
  };
  const unlockAudio = () => {
    if (!sound.unlocked) {
      sound.unlocked = true;
      if (sound.ambience) play('ambience', false);
      if (sound.breathing) play('breathing', false);
    }
  };

  const consoleRoot = document.createElement('aside');
  consoleRoot.id = 'ksa-console';
  consoleRoot.setAttribute('aria-label', 'Outpost field systems');
  consoleRoot.innerHTML = `
    <button class="ksa-launcher" type="button" aria-expanded="false" aria-controls="ksa-console-panel">
      <span class="ksa-launcher-icon" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="ksa-launcher-copy"><b>FIELD SYSTEMS</b><small>OUTPOST 86 · v${VERSION}</small></span>
      <span class="ksa-live-dot" aria-hidden="true"></span>
    </button>
    <section class="ksa-panel" id="ksa-console-panel" hidden aria-label="Field systems panel">
      <header class="ksa-panel-head"><div><span class="ksa-kicker">KUNTAU SCIENCE ACADEMY</span><strong>MISSION COMPANION</strong></div><button type="button" class="ksa-close" data-extra-action="close" aria-label="Close panel">×</button></header>
      <nav class="ksa-tabs" aria-label="Companion sections">
        <button type="button" data-tab="crew" class="is-active">CREW</button>
        <button type="button" data-tab="surface">SURFACE</button>
        <button type="button" data-tab="audio">AUDIO</button>
      </nav>
      <div class="ksa-view" data-view="crew">
        <div class="ksa-crew-card">
          <div class="ksa-crew-copy"><span class="ksa-kicker">CREW MEMBER 01</span><strong>FIELD ASTRONAUT</strong><small id="ksa-crew-state">AWAITING DEPLOYMENT</small><div class="ksa-suit-chip"><i></i> SUIT SYSTEMS READY</div></div>
          <div class="ksa-astronaut-wrap" id="ksa-astronaut-host" role="img" aria-label="Animated KSA lunar astronaut suit illustration"></div>
          <div class="ksa-crew-foot"><span>MISSION FIRST LIGHT</span><b>086</b></div>
        </div>
        <div class="ksa-data-heading"><span>LIVE MISSION RESOURCES</span><span id="ksa-day-label">DAY -- / 7</span></div>
        <div class="ksa-resource-grid">
          <div class="ksa-resource" data-resource-card="battery"><span>POWER RESERVE</span><b id="ksa-value-battery">--</b><i><em id="ksa-bar-battery"></em></i></div>
          <div class="ksa-resource" data-resource-card="oxygen"><span>OXYGEN</span><b id="ksa-value-oxygen">--</b><i><em id="ksa-bar-oxygen"></em></i></div>
          <div class="ksa-resource" data-resource-card="water"><span>WATER</span><b id="ksa-value-water">--</b><i><em id="ksa-bar-water"></em></i></div>
          <div class="ksa-resource" data-resource-card="food"><span>FOOD</span><b id="ksa-value-food">--</b><i><em id="ksa-bar-food"></em></i></div>
        </div>
        <p class="ksa-note">Values mirror the existing training HUD when a mission is active. They are simulation values, not real spacecraft telemetry.</p>
      </div>
      <div class="ksa-view" data-view="surface" hidden>
        <div class="ksa-scan-top"><div><span class="ksa-kicker">VISUAL FIELD SCAN</span><strong>SOUTH POLAR REGOLITH</strong></div><span class="ksa-scan-pulse">SCANNING</span></div>
        <div class="ksa-scan-frame"><canvas id="ksa-scan-canvas" width="768" height="768" aria-label="Procedural lunar surface training texture with relief layer"></canvas><div class="ksa-scan-crosshair"></div><span class="ksa-scan-coord">SECTOR 86 · TRAINING GRID</span></div>
        <div class="ksa-layer-switch" role="group" aria-label="Surface scan layer">
          <button type="button" data-layer="albedo" class="is-active">ALBEDO</button><button type="button" data-layer="height">RELIEF</button><button type="button" data-layer="normal">NORMAL</button><button type="button" data-layer="roughness">ROUGHNESS</button>
        </div>
        <label class="ksa-range-label" for="ksa-relief-opacity"><span>RELIEF BLEND</span><output id="ksa-relief-value">48%</output></label>
        <input id="ksa-relief-opacity" class="ksa-range" type="range" min="0" max="100" value="48" />
        <div class="ksa-scale"><span>LOW RELIEF</span><i></i><span>HIGH RELIEF</span></div>
        <p class="ksa-note">Procedural training visualization generated for this project. It is not a NASA observation, mapped landing site, or measured lunar elevation product.</p>
      </div>
      <div class="ksa-view" data-view="audio" hidden>
        <div class="ksa-audio-banner"><span class="ksa-audio-orbit">⌁</span><div><span class="ksa-kicker">MISSION AUDIO SUITE</span><strong>OUTPOST COMMS</strong><small>Original synthesized training effects</small></div></div>
        <div class="ksa-audio-row"><div><b>Mission ambience</b><small>Low electrical room tone</small></div><button type="button" class="ksa-switch" data-audio="ambience" aria-pressed="false"><i></i></button></div>
        <div class="ksa-audio-row"><div><b>Suit breathing</b><small>Quiet crew breathing loop</small></div><button type="button" class="ksa-switch" data-audio="breathing" aria-pressed="false"><i></i></button></div>
        <div class="ksa-audio-row"><div><b>Interface & event cues</b><small>Radio, steps, alerts and success sounds</small></div><button type="button" class="ksa-switch is-on" data-audio="effects" aria-pressed="true"><i></i></button></div>
        <label class="ksa-range-label" for="ksa-volume"><span>MASTER VOLUME</span><output id="ksa-volume-value">62%</output></label>
        <input id="ksa-volume" class="ksa-range" type="range" min="0" max="100" value="62" />
        <button type="button" class="ksa-test-sound" data-extra-action="test-audio">TEST RADIO LINK <span>↗</span></button>
        <p class="ksa-note">The Moon has no breathable atmosphere. These are deliberately designed game interface and suit-system effects, not recordings of lunar surface sound.</p>
      </div>
      <footer class="ksa-panel-foot"><span>BUILD. SURVIVE. EXPLORE.</span><span>OFFLINE-READY ASSETS</span></footer>
    </section>`;
  app.appendChild(consoleRoot);

  const launcher = consoleRoot.querySelector('.ksa-launcher');
  const panel = consoleRoot.querySelector('.ksa-panel');
  const setPanel = (open) => {
    panelOpen = Boolean(open);
    panel.hidden = !panelOpen;
    launcher.setAttribute('aria-expanded', String(panelOpen));
    launcher.classList.toggle('is-open', panelOpen);
    if (panelOpen) { unlockAudio(); play('radio'); if (activeTab === 'surface') { ensureScanAssets(); drawScanner(); } updateCrew(); }
  };
  const setTab = (tab) => {
    activeTab = ['crew', 'surface', 'audio'].includes(tab) ? tab : 'crew';
    consoleRoot.querySelectorAll('[data-tab]').forEach((button) => button.classList.toggle('is-active', button.dataset.tab === activeTab));
    consoleRoot.querySelectorAll('[data-view]').forEach((view) => { view.hidden = view.dataset.view !== activeTab; });
    if (activeTab === 'surface') { syncScannerControls(); ensureScanAssets(); drawScanner(); play('click'); }
    if (activeTab === 'crew') updateCrew();
  };
  launcher.addEventListener('click', () => { unlockAudio(); setPanel(!panelOpen); });
  consoleRoot.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-tab]');
    if (tab) { setTab(tab.dataset.tab); return; }
    const layer = event.target.closest('[data-layer]');
    if (layer) { activeLayer = layer.dataset.layer; consoleRoot.querySelectorAll('[data-layer]').forEach(b => b.classList.toggle('is-active', b === layer)); syncScannerControls(); ensureScanAssets(); drawScanner(); play('click'); return; }
    const toggle = event.target.closest('[data-audio]');
    if (toggle) {
      unlockAudio();
      const key = toggle.dataset.audio;
      if (key === 'effects') sound.effects = !sound.effects;
      if (key === 'ambience') sound.ambience = !sound.ambience;
      if (key === 'breathing') sound.breathing = !sound.breathing;
      toggle.classList.toggle('is-on', sound[key]);
      toggle.setAttribute('aria-pressed', String(sound[key]));
      syncLoops(); if (key === 'effects' && sound.effects) play('radio');
      play('click'); return;
    }
    const action = event.target.closest('[data-extra-action]')?.dataset.extraAction;
    if (action === 'close') { setPanel(false); play('click'); }
    if (action === 'test-audio') { unlockAudio(); play('radio'); }
  });
  consoleRoot.querySelector('#ksa-volume').addEventListener('input', (event) => {
    sound.volume = Number(event.target.value) / 100;
    consoleRoot.querySelector('#ksa-volume-value').value = `${event.target.value}%`;
    Object.entries(audio).forEach(([key, item]) => { item.volume = sound.volume * (key === 'ambience' ? .3 : key === 'breathing' ? .22 : .72); });
  });
  consoleRoot.querySelector('#ksa-relief-opacity').addEventListener('input', (event) => {
    reliefOpacity = Number(event.target.value);
    consoleRoot.querySelector('#ksa-relief-value').value = `${reliefOpacity}%`;
    drawScanner();
  });

  // Inline the original vector so the suit's arms and legs can animate independently.
  // If SVG parsing/fetching is unavailable, retain a normal image fallback.
  const astronautHost = consoleRoot.querySelector('#ksa-astronaut-host');
  const astronautPath = 'assets/crew/ksa-astronaut-crew.svg';
  fetch(assetUrl(astronautPath)).then((response) => {
    if (!response.ok) throw new Error('Crew illustration unavailable');
    return response.text();
  }).then((source) => {
    const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
    const vector = parsed.documentElement;
    if (vector.localName !== 'svg' || parsed.querySelector('parsererror')) throw new Error('Crew illustration could not be parsed');
    const inline = document.importNode(vector, true);
    inline.classList.add('ksa-astronaut-svg');
    inline.setAttribute('aria-hidden', 'true');
    astronautHost.replaceChildren(inline);
  }).catch(() => {
    const fallback = document.createElement('img');
    fallback.className = 'ksa-astronaut-image';
    fallback.src = assetUrl(astronautPath);
    fallback.alt = 'KSA lunar astronaut suit illustration';
    astronautHost.replaceChildren(fallback);
  });

  function loadScanImage(key, file) {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => { scanImages[key] = image; scanLoading.delete(key); drawScanner(); };
    image.onerror = () => { scanImages[key] = null; scanLoading.delete(key); drawScanner(); };
    image.src = assetUrl(file);
  }
  function syncScannerControls() {
    const blend = consoleRoot.querySelector('#ksa-relief-opacity');
    blend.disabled = activeLayer === 'normal' || activeLayer === 'roughness';
    blend.setAttribute('aria-disabled', String(blend.disabled));
  }
  function ensureScanAssets() {
    const needed = activeLayer === 'normal' ? ['normal'] : activeLayer === 'roughness' ? ['roughness'] : ['albedo', 'height'];
    const files = { albedo: 'assets/terrain/south-pole-regolith-albedo.jpg', height: 'assets/terrain/south-pole-heightmap-2k.png', normal: 'assets/terrain/south-pole-normal-1k.png', roughness: 'assets/terrain/south-pole-roughness-1k.png' };
    for (const key of needed) {
      if (scanImages[key] || scanLoading.has(key)) continue;
      scanLoading.add(key);
      loadScanImage(key, files[key]);
    }
  }
  function drawScanner() {
    const canvas = consoleRoot.querySelector('#ksa-scan-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const background = scanImages[activeLayer] || scanImages.albedo || scanImages.height;
    if (!background) {
      ctx.fillStyle = '#0b1926'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#b3c1cb'; ctx.font = '20px monospace';
      const label = scanLoading.size ? 'LOADING SURFACE DATA…' : 'OPEN SURFACE TAB TO SCAN';
      ctx.fillText(label, 36, 54);
      return;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    if (activeLayer === 'albedo' && scanImages.height) {
      ctx.globalAlpha = reliefOpacity / 100 * .55;
      ctx.globalCompositeOperation = 'soft-light';
      ctx.drawImage(scanImages.height, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    if (activeLayer === 'height') {
      if (scanImages.albedo) ctx.drawImage(scanImages.albedo, 0, 0, canvas.width, canvas.height);
      if (scanImages.height) { ctx.globalAlpha = reliefOpacity / 100; ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(scanImages.height, 0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      ctx.globalAlpha = .34;
      ctx.strokeStyle = '#f1bd76'; ctx.lineWidth = 1;
      for (let ring = 0; ring < 8; ring++) {
        ctx.beginPath(); ctx.ellipse(380, 360, 90 + ring * 38, 72 + ring * 29, -.2, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (activeLayer === 'normal') {
      ctx.fillStyle = 'rgba(8,18,30,.14)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (activeLayer === 'roughness') {
      ctx.fillStyle = 'rgba(8,18,30,.12)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  const readHud = (key) => uiRoot.querySelector(`[data-hud="${key}"]`)?.textContent?.trim() || '--';
  function updateCrew() {
    const day = readHud('day');
    const onMission = Boolean(uiRoot.querySelector('.game-shell'));
    const stateText = consoleRoot.querySelector('#ksa-crew-state');
    stateText.textContent = onMission ? 'SURFACE TEAM · ACTIVE' : 'AWAITING DEPLOYMENT';
    consoleRoot.querySelector('#ksa-day-label').textContent = day || 'DAY -- / 7';
    for (const key of ['battery', 'oxygen', 'water', 'food']) {
      const value = Number.parseInt(readHud(key), 10);
      const valid = Number.isFinite(value);
      consoleRoot.querySelector(`#ksa-value-${key}`).textContent = valid ? `${value}%` : '--';
      consoleRoot.querySelector(`#ksa-bar-${key}`).style.width = `${valid ? clamp(value, 0, 100) : 0}%`;
      const card = consoleRoot.querySelector(`[data-resource-card="${key}"]`);
      card.classList.toggle('is-low', valid && value < 25);
      card.classList.toggle('is-caution', valid && value >= 25 && value < 48);
    }
  }

  function addBootDust() {
    if (prefersReducedMotion) return;
    const bounds = app.getBoundingClientRect();
    const cx = bounds.width * (.48 + Math.random() * .06);
    const cy = bounds.height * (.77 + Math.random() * .12);
    for (let i = 0; i < 5; i++) {
      const particle = document.createElement('span');
      particle.className = 'ksa-regolith-particle';
      particle.style.left = `${cx}px`; particle.style.top = `${cy}px`;
      particle.style.setProperty('--drift-x', `${(Math.random() - .5) * 88}px`);
      particle.style.setProperty('--drift-y', `${-18 - Math.random() * 76}px`);
      particle.style.setProperty('--particle-delay', `${Math.random() * 100}ms`);
      app.appendChild(particle);
      particle.addEventListener('animationend', () => particle.remove(), { once: true });
    }
  }

  // Mission event cues are driven by the existing app's action attributes and toast states.
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-ui-action], [data-mission-action]');
    if (!target || consoleRoot.contains(target)) return;
    unlockAudio();
    const action = target.dataset.uiAction || '';
    if (target.dataset.missionAction) { play('click'); return; }
    if (['start', 'begin', 'advance', 'resume', 'interact', 'mobile-interact', 'save'].includes(action)) play('radio');
    if (['pause', 'menu', 'settings', 'guide', 'about', 'sources'].includes(action)) play('click');
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.repeat || event.target?.matches?.('input, textarea, select')) return;
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key) && uiRoot.querySelector('.game-shell')) {
      const now = performance.now();
      if (now - lastStepAt > 480) { lastStepAt = now; if (sound.effects) play('step'); addBootDust(); }
    }
    if (key === 'e' && uiRoot.querySelector('.game-shell')) play('radio');
  }, true);

  const toastObserver = new MutationObserver(() => {
    const toast = uiRoot.querySelector('#mission-toast');
    if (!toast || !toast.classList.contains('is-visible')) return;
    const signature = `${toast.className}|${toast.textContent}`;
    if (signature === lastToastSignature) return;
    lastToastSignature = signature;
    if (toast.classList.contains('warning')) play('warning');
    else if (toast.classList.contains('success')) play('success');
    else play('radio');
  });
  toastObserver.observe(uiRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  const screenObserver = new MutationObserver(() => {
    const screen = uiRoot.querySelector('.screen, .game-shell');
    const state = screen?.className || 'loading';
    if (state !== lastUiState) {
      lastUiState = state;
      updateCrew();
      if (state.includes('game-shell')) { play('radio'); }
    }
  });
  screenObserver.observe(uiRoot, { childList: true, subtree: true });

  // Lightweight 2 Hz HUD sync; avoid a perpetual animation loop when the panel is closed.
  const hudTimer = window.setInterval(() => { if (panelOpen && activeTab === 'crew') updateCrew(); }, 500);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pauseLoop('ambience'); pauseLoop('breathing'); }
    else syncLoops();
  });
  window.addEventListener('pagehide', () => { pauseLoop('ambience'); pauseLoop('breathing'); window.clearInterval(hudTimer); toastObserver.disconnect(); screenObserver.disconnect(); });

  // Visor mode can be toggled from a small keyboard shortcut: V.
  document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'v' && !event.repeat && uiRoot.querySelector('.game-shell') && !event.target?.matches?.('input,textarea,select')) {
      visorOn = !visorOn; app.classList.toggle('ksa-visor-mode', visorOn); play('click');
    }
  });

  // First-visit boot marker; never blocks the original menu or mission start.
  if (!prefersReducedMotion) {
    const boot = document.createElement('div'); boot.className = 'ksa-boot-stamp';
    boot.innerHTML = '<span>86</span><b>OUTPOST SYSTEMS ONLINE</b><small>MISSION EXPERIENCE v2.0.0</small>';
    app.appendChild(boot);
    window.setTimeout(() => boot.classList.add('is-gone'), 1450);
    window.setTimeout(() => boot.remove(), 2100);
  }

  // Keep controls available after the game swaps between menu, briefing, gameplay and debrief.
  window.KSA_OUTPOST_EXPERIENCE = Object.freeze({ version: VERSION, open: () => setPanel(true), close: () => setPanel(false), setTab, getAudioState: () => ({ ...sound }) });
  window.addEventListener('resize', () => { if (panelOpen && activeTab === 'surface') drawScanner(); });
})();
