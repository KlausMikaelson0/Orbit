"use client";

export interface OrbitSoundboardPreset {
  id: string;
  title: string;
  emoji: string;
  description: string;
}

interface OrbitToneNote {
  frequency: number;
  startOffset: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
}

let soundboardAudioContext: AudioContext | null = null;

function getSoundboardAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }
  if (!soundboardAudioContext) {
    soundboardAudioContext = new window.AudioContext();
  }
  return soundboardAudioContext;
}

function playToneSequence(notes: OrbitToneNote[]) {
  const context = getSoundboardAudioContext();
  if (!context) {
    return;
  }

  const startedAt = context.currentTime;
  for (const note of notes) {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const filter = context.createBiquadFilter();
    const noteStart = startedAt + note.startOffset;
    const noteEnd = noteStart + note.duration;

    oscillator.type = note.type ?? "sine";
    oscillator.frequency.setValueAtTime(note.frequency, noteStart);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(40, note.frequency * 0.96),
      noteEnd,
    );

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2200, noteStart);

    gainNode.gain.setValueAtTime(0.0001, noteStart);
    gainNode.gain.exponentialRampToValueAtTime(note.gain, noteStart + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.01);
  }
}

const BUILTIN_SOUND_PRESETS: OrbitSoundboardPreset[] = [
  {
    id: "duck-quack",
    title: "Duck Quack",
    emoji: "🦆",
    description: "Classic quack burst.",
  },
  {
    id: "loser-drop",
    title: "Loser Drop",
    emoji: "📉",
    description: "Play when someone loses.",
  },
  {
    id: "crowd-hype",
    title: "Crowd Hype",
    emoji: "🔥",
    description: "Short hype fanfare.",
  },
  {
    id: "sad-trombone",
    title: "Sad Trombone",
    emoji: "🎺",
    description: "Womp womp style.",
  },
  {
    id: "victory-chime",
    title: "Victory Chime",
    emoji: "🏆",
    description: "Quick win stinger.",
  },
];

export function getOrbitBuiltInSoundboardPresets(): OrbitSoundboardPreset[] {
  return BUILTIN_SOUND_PRESETS;
}

function playDuckQuack() {
  playToneSequence([
    { frequency: 420, startOffset: 0, duration: 0.08, gain: 0.11, type: "square" },
    { frequency: 360, startOffset: 0.07, duration: 0.08, gain: 0.1, type: "square" },
    { frequency: 510, startOffset: 0.15, duration: 0.08, gain: 0.09, type: "triangle" },
  ]);
}

function playLoserDrop() {
  playToneSequence([
    { frequency: 520, startOffset: 0, duration: 0.14, gain: 0.08 },
    { frequency: 390, startOffset: 0.1, duration: 0.16, gain: 0.09 },
    { frequency: 280, startOffset: 0.22, duration: 0.2, gain: 0.1 },
  ]);
}

function playCrowdHype() {
  playToneSequence([
    { frequency: 530, startOffset: 0, duration: 0.1, gain: 0.07, type: "triangle" },
    { frequency: 680, startOffset: 0.08, duration: 0.1, gain: 0.08, type: "triangle" },
    { frequency: 860, startOffset: 0.16, duration: 0.12, gain: 0.09, type: "sawtooth" },
  ]);
}

function playSadTrombone() {
  playToneSequence([
    { frequency: 390, startOffset: 0, duration: 0.14, gain: 0.09, type: "sawtooth" },
    { frequency: 330, startOffset: 0.12, duration: 0.16, gain: 0.09, type: "sawtooth" },
    { frequency: 250, startOffset: 0.24, duration: 0.24, gain: 0.1, type: "sawtooth" },
  ]);
}

function playVictoryChime() {
  playToneSequence([
    { frequency: 620, startOffset: 0, duration: 0.08, gain: 0.08 },
    { frequency: 780, startOffset: 0.07, duration: 0.08, gain: 0.09 },
    { frequency: 990, startOffset: 0.14, duration: 0.12, gain: 0.09 },
  ]);
}

export async function playOrbitSoundboardPreset(presetId: string) {
  switch (presetId) {
    case "duck-quack":
      playDuckQuack();
      return;
    case "loser-drop":
      playLoserDrop();
      return;
    case "crowd-hype":
      playCrowdHype();
      return;
    case "sad-trombone":
      playSadTrombone();
      return;
    case "victory-chime":
      playVictoryChime();
      return;
    default:
      playCrowdHype();
  }
}

export async function playOrbitSoundboardUrl(url: string, volume = 0.88) {
  if (typeof window === "undefined") {
    return;
  }
  const audio = new window.Audio(url);
  audio.volume = Math.min(1, Math.max(0.05, volume));
  audio.preload = "auto";
  try {
    await audio.play();
  } catch {
    // Autoplay and source failures are handled silently.
  }
}
