export type SoundEffect = 'click' | 'warning' | 'success' | 'radio' | 'step';

const EFFECTS: Record<SoundEffect, string> = {
  click: 'assets/audio/ui-soft-click.ogg',
  warning: 'assets/audio/system-warning.ogg',
  success: 'assets/audio/mission-success.ogg',
  radio: 'assets/audio/radio-chirp.ogg',
  step: 'assets/audio/boot-regolith-step.ogg',
};

export interface AudioManager {
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
  play(effect: SoundEffect): void;
  destroy(): void;
}

export function createAudioManager(baseUrl: string): AudioManager {
  let enabled = true;
  try { enabled = localStorage.getItem('ksa-outpost-86-audio-v1') !== 'false'; } catch { enabled = true; }
  let started = false;
  const ambience = new Audio(`${baseUrl}assets/audio/outpost-ambience.ogg`);
  ambience.loop = true;
  ambience.volume = 0.11;
  ambience.preload = 'none';
  const startAmbience = (): void => {
    if (!enabled || started) return;
    started = true;
    void ambience.play().catch(() => { started = false; });
  };
  document.addEventListener('pointerdown', startAmbience, { once: true });
  document.addEventListener('keydown', startAmbience, { once: true });
  const manager: AudioManager = {
    setEnabled(value) {
      enabled = value;
      try { localStorage.setItem('ksa-outpost-86-audio-v1', String(value)); } catch { /* Audio can still be toggled for this session. */ }
      if (!value) { ambience.pause(); started = false; }
      else startAmbience();
    },
    isEnabled() { return enabled; },
    play(effect) {
      if (!enabled) return;
      const audio = new Audio(`${baseUrl}${EFFECTS[effect]}`);
      audio.volume = effect === 'warning' ? 0.34 : effect === 'success' ? 0.28 : 0.18;
      void audio.play().catch(() => undefined);
    },
    destroy() { ambience.pause(); ambience.src = ''; },
  };
  return manager;
}
