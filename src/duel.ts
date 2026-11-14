import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { blue, findItem } from './categories.js';
import { identify, score } from './judge.js';

type Entry = { frame?: Buffer; lockedAt?: number; guesses?: string[]; options?: boolean; label?: string; done: boolean };
type Player = { token: string; ready: boolean; retain: boolean };
type Result = Awaited<ReturnType<typeof score>>;
type Phase = 'lobby' | 'hunt' | 'confirm' | 'scoring' | 'result' | 'void';
const empty = (): [Entry, Entry] => [{ done: false }, { done: false }];
const blank = (): Player => ({ token: randomUUID(), ready: false, retain: false });

export class Duel {
  readonly players = [blank(), blank()];
  accepted = false;
  phase: Phase = 'lobby';
  deadline = 0;
  entries = empty();
  results?: [Result, Result];
  message = '';
  round = 1;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(readonly code: string) {}

  state(slot: number) {
    const entry = this.entries[slot];
    return {
      code: this.code, accepted: this.accepted, phase: this.phase, round: this.round,
      deadline: this.deadline, serverTime: Date.now(), prompt: blue.prompt, ready: this.players.map(player => player.ready),
      locked: this.entries.map(find => Boolean(find.frame)), message: this.message,
      guesses: entry.done ? [] : entry.guesses, options: entry.options, confirmed: entry.done,
      results: this.results, retentionEnabled: Boolean(process.env.TRAINING_DATA_DIR), slot,
    };
  }

  ready(slot: number, retain: boolean) {
    if (!this.accepted || !['lobby', 'result', 'void'].includes(this.phase)) return;
    this.players[slot].ready = true;
    this.players[slot].retain = retain;
    if (!this.players.every(player => player.ready)) return;
    if (this.phase !== 'lobby') this.round++;
    this.entries = empty();
    this.results = undefined;
    this.message = '';
    this.phase = 'hunt';
    this.deadline = Date.now() + 20_000;
    this.players.forEach(player => { player.ready = false; });
    this.timer = setTimeout(() => void this.finish(), 20_000);
  }

  lock(slot: number, frame: Buffer, round: number, receivedAt = Date.now()) {
    const entry = this.entries[slot];
    if (this.phase !== 'hunt' || receivedAt >= this.deadline || round !== this.round || receivedAt < (entry.lockedAt ?? 0)) return false;
    entry.frame = frame;
    entry.lockedAt = receivedAt;
    return true;
  }

  void(message: string) {
    if (!['hunt', 'confirm', 'scoring'].includes(this.phase)) {
      this.players.forEach(player => { player.ready = false; });
      return;
    }
    clearTimeout(this.timer);
    this.phase = 'void';
    this.message = message;
    this.entries = empty();
  }

  private async finish() {
    if (this.phase !== 'hunt') return;
    this.phase = 'confirm';
    const entries = this.entries;
    try {
      await Promise.all(entries.map(async entry => {
        if (!entry.frame) {
          entry.done = true;
          return;
        }
        entry.guesses = await identify(entry.frame);
        entry.options = !findItem(entry.guesses[0] ?? '');
        if (!entry.guesses.length) entry.done = true;
      }));
      if (this.entries !== entries || this.phase !== 'confirm') return;
      if (entries.every(entry => entry.done)) void this.reveal();
      else this.timer = setTimeout(() => {
        if (this.entries !== entries || this.phase !== 'confirm') return;
        entries.forEach(entry => { entry.done = true; });
        void this.reveal();
      }, 45_000);
    } catch (error) {
      console.error('[envoggle] Identification failed', error instanceof Error ? error.message : '');
      if (this.entries === entries) this.void('The referee could not identify the finds. Try a rematch.');
    }
  }

  confirm(slot: number, action: string, value?: string) {
    const entry = this.entries[slot];
    if (this.phase !== 'confirm' || entry.done || !entry.guesses?.length) return false;
    if (action === 'reject' && !entry.options) {
      entry.options = true;
      return true;
    }
    const label = action === 'skip' ? undefined
      : entry.options && action === 'custom' ? value
      : entry.options && action === 'choose' ? entry.guesses.find(guess => guess === value)
      : !entry.options && action === 'accept' ? entry.guesses[0] : undefined;
    if (action !== 'skip' && !label?.trim()) return false;
    entry.label = label?.trim().slice(0, 64);
    entry.done = true;
    if (this.entries.every(item => item.done)) void this.reveal();
    return true;
  }

  private async reveal() {
    clearTimeout(this.timer);
    this.phase = 'scoring';
    const entries = this.entries;
    try {
      const judge = (entry: Entry): Promise<Result> => entry.frame && entry.label
        ? score(entry.frame, entry.label)
        : Promise.resolve({ label: 'No confirmed find', points: 0, reason: 'No item was confirmed.', unlisted: false, safeToRetain: false });
      const results = await Promise.all([judge(entries[0]), judge(entries[1])]);
      if (entries !== this.entries || this.phase !== 'scoring') return;
      this.results = results;
      this.phase = 'result';
      results.forEach((result, slot) => {
        if (result.unlisted) console.info('[envoggle] Review unlisted item:', JSON.stringify(result.label));
        const entry = entries[slot];
        if (this.players[slot].retain && result.safeToRetain && entry.frame && process.env.TRAINING_DATA_DIR) {
          void this.retain(entry.frame, result.label).catch(() => console.error('[envoggle] Could not retain confirmed frame'));
        }
      });
    } catch (error) {
      console.error('[envoggle] Scoring failed', error instanceof Error ? error.message : '');
      if (entries === this.entries) this.void('Scoring timed out or failed. Try a rematch.');
    }
  }

  frame(slot: number) {
    return this.phase === 'result' ? this.entries[slot]?.frame : undefined;
  }

  private async retain(frame: Buffer, label: string) {
    const directory = `${process.env.TRAINING_DATA_DIR}/${randomUUID()}`;
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(`${directory}/frame.jpg`, frame, { mode: 0o600 });
    await writeFile(`${directory}/label.json`, JSON.stringify({ label, category: blue.prompt }), { mode: 0o600 });
  }
}

export const duels = new Map<string, Duel>();
export function createDuel() {
  let code: string;
  do { code = String(randomBytes(4).readUInt32BE() % 100_000_000).padStart(8, '0'); } while (duels.has(code));
  const duel = new Duel(code);
  duels.set(code, duel);
  setTimeout(() => { duels.delete(code); }, 2 * 60 * 60 * 1000).unref();
  return duel;
}
