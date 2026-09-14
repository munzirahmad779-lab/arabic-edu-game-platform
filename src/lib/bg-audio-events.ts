export const BG_AUDIO_PAUSE_EVENT = "bg-audio-pause";
export const BG_AUDIO_RESUME_EVENT = "bg-audio-resume";

export function pauseBackgroundAudio() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BG_AUDIO_PAUSE_EVENT));
}

export function resumeBackgroundAudio() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BG_AUDIO_RESUME_EVENT));
}