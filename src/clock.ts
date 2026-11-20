/** Monotonic elapsed time; no DOM, intervals, or game rules. */
export class Clock {
  private startedAt: number | null = null;
  private total = 0;
  constructor(private now: () => number = () => performance.now()) {}
  start(): void { if (this.startedAt === null) this.startedAt = this.now(); }
  stop(): void {
    if (this.startedAt !== null) { this.total = this.elapsed(); this.startedAt = null; }
  }
  reset(): void { this.startedAt = null; this.total = 0; }
  elapsed(): number { return this.total + (this.startedAt === null ? 0 : Math.max(0, this.now() - this.startedAt)); }
  get running(): boolean { return this.startedAt !== null; }
}

export function formatTime(milliseconds: number): string {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
