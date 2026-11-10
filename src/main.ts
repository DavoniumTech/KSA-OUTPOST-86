import './styles.css';
import {
  advanceMissionDay,
  applyMissionAction,
  createInitialMission,
  type MissionAction,
  type MissionState,
} from './game/simulation';
import { loadMission, loadSettings, saveMission, saveSettings, type GameSettings } from './game/storage';
import { createWorld, type WorldScene } from './engine/createWorld';
import { GameUI, type ScreenName } from './ui/ui';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const uiRoot = document.querySelector<HTMLElement>('#ui-root');

function showBootError(message: string): void {
  if (uiRoot) {
    uiRoot.innerHTML = `<div class="screen pause-screen"><div class="pause-panel"><div class="eyebrow">OUTPOST SYSTEM CHECK</div><h1>3D VIEW<br>UNAVAILABLE.</h1><p>${message}</p><p class="small-print">Try the latest Chrome or Edge with hardware acceleration enabled. The mission requires WebGL 2.</p></div></div>`;
  }
}

async function boot(): Promise<void> {
  if (!canvas || !uiRoot) throw new Error('The game canvas or interface root is missing.');
  if (!('WebGL2RenderingContext' in window)) {
    showBootError('This browser does not expose WebGL 2, which is required to render the outpost.');
    return;
  }

  let world: WorldScene;
  try {
    world = await createWorld(canvas);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'The graphics device could not be created.';
    showBootError(`The 3D engine could not start. ${reason}`);
    return;
  }

  let mission: MissionState = createInitialMission();
  let settings: GameSettings = loadSettings();
  let screen: ScreenName = 'menu';
  let hudElapsed = 0;
  let ui: GameUI;

  const applySettings = (): void => {
    world.setGraphicsQuality(settings.quality);
    document.documentElement.classList.toggle('reduce-motion', settings.reducedMotion);
  };

  const openGame = (state: MissionState): void => {
    mission = state;
    screen = 'game';
    ui.showScreen('game', mission);
    world.setPaused(false);
    ui.renderHud(mission, world.getNearestInteractable());
    ui.renderMissionLog(mission);
    saveMission(mission);
  };

  const callbacks = {
    startMission(): void {
      mission = createInitialMission();
      openGame(mission);
      ui.showToast('Mission started', 'Outpost 86 is ready. Begin with the Day 1 commissioning checks.', 'success');
    },
    continueMission(): void {
      const saved = loadMission();
      if (!saved) {
        ui.showToast('No saved mission found', 'Start a new training mission instead.', 'warning');
        ui.showScreen('menu');
        screen = 'menu';
        return;
      }
      mission = saved;
      if (mission.status === 'completed') {
        screen = 'debrief';
        world.setPaused(true);
        ui.showScreen('debrief', mission);
      } else {
        openGame(mission);
        ui.showToast('Mission restored', `Continuing from mission day ${mission.day}.`, 'success');
      }
    },
    resumeMission(): void {
      screen = 'game';
      ui.showScreen('game', mission);
      world.setPaused(false);
      ui.renderHud(mission, world.getNearestInteractable());
      ui.renderMissionLog(mission);
    },
    pauseMission(): void {
      if (screen !== 'game') return;
      screen = 'pause';
      world.setPaused(true);
      saveMission(mission);
      ui.showScreen('pause');
    },
    restartMission(): void {
      mission = createInitialMission();
      openGame(mission);
      ui.showToast('New mission', 'The training scenario has been reset.', 'success');
    },
    interact(id: string): void {
      const interactable = world.interactables.find((item) => item.id === id);
      if (!interactable || screen !== 'game') return;
      ui.openInteraction(id, mission);
    },
    missionAction(action: MissionAction): void {
      const result = applyMissionAction(mission, action);
      if (!result.ok) {
        ui.showToast('Action not completed', result.message, 'warning');
        return;
      }
      mission = result.state;
      saveMission(mission);
      ui.closeInteraction();
      if (mission.status === 'completed') {
        screen = 'debrief';
        world.setPaused(true);
        ui.showScreen('debrief', mission);
        return;
      }
      ui.renderHud(mission, world.getNearestInteractable());
      ui.renderMissionLog(mission);
      ui.showToast(result.title || 'System updated', result.message, 'success');
    },
    advanceDay(): void {
      const result = advanceMissionDay(mission);
      if (!result.ok) {
        ui.showToast('Objective incomplete', result.message, 'warning');
        return;
      }
      mission = result.state;
      saveMission(mission);
      ui.closeInteraction();
      ui.renderHud(mission, world.getNearestInteractable());
      ui.renderMissionLog(mission);
      ui.showToast(result.title || 'Mission day advanced', result.message, 'info');
    },
    openScreen(next: ScreenName): void {
      screen = next;
      const pauseWorld = next !== 'game';
      world.setPaused(pauseWorld);
      if (next === 'menu' && mission.status === 'active') saveMission(mission);
      ui.showScreen(next, mission);
    },
    setQuality(level: 'low' | 'medium' | 'high'): void {
      settings = { ...settings, quality: level };
      saveSettings(settings);
      applySettings();
    },
    setReducedMotion(value: boolean): void {
      settings = { ...settings, reducedMotion: value };
      saveSettings(settings);
      applySettings();
    },
    saveMission(): void {
      saveMissionToDevice();
    },
    panelOpened(): void { world.setPaused(true); },
    panelClosed(): void { if (screen === 'game') world.setPaused(false); },
    joystick(x: number, y: number): void {
      world.setTouchMove(x, y);
    },
  };

  const saveMissionToDevice = (): void => {
    const ok = saveMission(mission);
    if (!ok) ui.showToast('Could not save on this device', 'Browser storage may be disabled or full.', 'warning');
  };

  ui = new GameUI(uiRoot, callbacks);
  applySettings();

  // Keyboard interaction is separate from movement input handled by the engine layer.
  const onGameKey = (event: KeyboardEvent): void => {
    if (screen !== 'game' || event.repeat) return;
    if (event.key.toLowerCase() === 'e') {
      const nearest = world.getNearestInteractable();
      if (nearest) callbacks.interact(nearest.id);
    }
    if (event.key === 'Escape') {
      if (ui.isInteractionOpen()) ui.closeInteraction();
      else callbacks.pauseMission();
    }
  };
  window.addEventListener('keydown', onGameKey);

  let lastHudUpdate = 0;
  world.app.on('update', (dt: number) => {
    if (screen !== 'game') return;
    hudElapsed += dt;
    if (hudElapsed - lastHudUpdate >= 0.16) {
      lastHudUpdate = hudElapsed;
      ui.renderHud(mission, world.getNearestInteractable());
    }
  });

  const onVisibilityChange = (): void => {
    if (document.hidden && screen === 'game') callbacks.pauseMission();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', saveMissionToDevice);

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The game remains usable if PWA caching is unavailable.
    });
  }

  // Initial scene is a live 3D environment behind the main menu.
  world.setPaused(true);
  ui.showScreen('menu');

  // Restore the last graphics preference even if the settings screen was not opened.
  const restored = loadMission();
  if (restored && restored.status === 'active') {
    ui.showToast('Saved mission available', `You can continue from day ${restored.day} in the main menu.`, 'info');
  }

  // Make application cleanup explicit for hot reload and browser shutdown.
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      window.removeEventListener('keydown', onGameKey);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', saveMissionToDevice);
      ui.destroy();
      world.dispose();
    });
  }
}

void boot().catch((error: unknown) => {
  const reason = error instanceof Error ? error.message : 'Unknown startup error.';
  showBootError(reason);
});
