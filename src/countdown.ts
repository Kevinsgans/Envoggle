export const HUNT_DURATION_MS = 30_000;
export const FINAL_COUNTDOWN_MS = 5_000;

// Use the server deadline with a monotonic clock between state polls.
export class HuntClock {
  private deadline = 0;
  private endsAt = 0;

  sync(deadline: number, serverTime: number, now = performance.now()) {
    const estimate = now + deadline - serverTime;
    this.endsAt = deadline === this.deadline ? Math.min(this.endsAt, estimate) : estimate;
    this.deadline = deadline;
  }

  remaining(now = performance.now()) {
    return Math.max(0, Math.min(HUNT_DURATION_MS, this.endsAt - now));
  }
}

function ease(value: number) {
  const fraction = Math.max(0, Math.min(1, value));
  return fraction * fraction * (3 - 2 * fraction);
}

export function countdownFrame(remainingMs: number, animate = true) {
  const seconds = Math.ceil(remainingMs / 1000);
  const elapsed = seconds * 1000 - remainingMs;
  const blend = animate && remainingMs > 0 && elapsed < 180 && seconds < HUNT_DURATION_MS / 1000 ? ease(elapsed / 180) : 1;
  const urgency = animate ? ease((FINAL_COUNTDOWN_MS - remainingMs) / 260) : Number(remainingMs <= FINAL_COUNTDOWN_MS);
  return {
    seconds,
    blend,
    urgency,
    progress: (animate ? remainingMs : seconds * 1000) / HUNT_DURATION_MS,
    color: `rgb(${Math.round(184 + 71 * urgency)},${Math.round(242 - 26 * urgency)},${Math.round(92 - 15 * urgency)})`,
  };
}
