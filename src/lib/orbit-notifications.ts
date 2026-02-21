let audioContext: AudioContext | null = null;
let incomingRingtoneAudio: HTMLAudioElement | null = null;
let incomingRingtoneMuted = false;

// Replace this URL with your own Heavenly.mp3 when ready.
export const ORBIT_RINGTONE_URL =
  "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3";

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }
  if (!audioContext) {
    audioContext = new window.AudioContext();
  }
  return audioContext;
}

interface OrbitToneNote {
  frequency: number;
  startOffset: number;
  duration: number;
  gain: number;
}

function playOrbitToneSequence(notes: OrbitToneNote[]) {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const startAt = context.currentTime;
  for (const note of notes) {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const filter = context.createBiquadFilter();
    const noteStart = startAt + note.startOffset;
    const noteEnd = noteStart + note.duration;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(note.frequency, noteStart);
    oscillator.frequency.exponentialRampToValueAtTime(
      note.frequency * 1.04,
      noteEnd,
    );

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1900, noteStart);

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

export function playOrbitPingSound() {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const filter = context.createBiquadFilter();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(740, now);
  oscillator.frequency.exponentialRampToValueAtTime(920, now + 0.12);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1600, now);

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

  oscillator.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.24);
}

export function playOrbitCallJoinSound() {
  playOrbitToneSequence([
    { frequency: 640, startOffset: 0, duration: 0.12, gain: 0.08 },
    { frequency: 860, startOffset: 0.1, duration: 0.14, gain: 0.07 },
  ]);
}

export function playOrbitCallLeaveSound() {
  playOrbitToneSequence([
    { frequency: 760, startOffset: 0, duration: 0.12, gain: 0.07 },
    { frequency: 490, startOffset: 0.1, duration: 0.14, gain: 0.07 },
  ]);
}

export function playOrbitParticipantJoinSound() {
  playOrbitToneSequence([
    { frequency: 540, startOffset: 0, duration: 0.1, gain: 0.05 },
    { frequency: 720, startOffset: 0.08, duration: 0.12, gain: 0.05 },
  ]);
}

export function playOrbitParticipantLeaveSound() {
  playOrbitToneSequence([
    { frequency: 620, startOffset: 0, duration: 0.1, gain: 0.05 },
    { frequency: 420, startOffset: 0.08, duration: 0.12, gain: 0.05 },
  ]);
}

export async function playOrbitIncomingRingtoneLoop() {
  if (typeof window === "undefined") {
    return;
  }

  if (!incomingRingtoneAudio) {
    incomingRingtoneAudio = new window.Audio(ORBIT_RINGTONE_URL);
    incomingRingtoneAudio.loop = true;
    incomingRingtoneAudio.preload = "auto";
    incomingRingtoneAudio.volume = 0.34;
  }

  incomingRingtoneAudio.muted = incomingRingtoneMuted;
  try {
    await incomingRingtoneAudio.play();
  } catch {
    // Autoplay may be blocked until user interaction.
  }
}

export function stopOrbitIncomingRingtone() {
  if (!incomingRingtoneAudio) {
    return;
  }
  incomingRingtoneAudio.pause();
  incomingRingtoneAudio.currentTime = 0;
}

export function setOrbitIncomingRingtoneMuted(value: boolean) {
  incomingRingtoneMuted = value;
  if (incomingRingtoneAudio) {
    incomingRingtoneAudio.muted = value;
  }
}

export async function ensureNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission === "denied") {
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export async function notifyOrbitMessage(title: string, body: string) {
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission || typeof window === "undefined") {
    return;
  }

  new Notification(title, {
    body,
    icon: "/favicon.ico",
    tag: "orbit-message",
  });
}
