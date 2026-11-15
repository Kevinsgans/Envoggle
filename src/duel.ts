import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { rounds, TOTAL_ROUNDS } from './categories.js';
import sharp from 'sharp';
import { FOCUS_MS, SCAN_MIN_MS, type Presentation } from './find-visual.js';
import { judgeFind, type JudgedResult, type Result } from './judge.js';
import { COUNT_UP_MS } from './score-display.js';

type Entry = { frame?: Buffer; object?: Promise<Buffer>; lockedAt?: number; guesses?: string[]; options?: boolean; label?: string; done: boolean };
type Player = { token: string; ready: boolean; retain: boolean };
type Phase = 'lobby' | 'hunt' | 'confirm' | 'scoring' | 'result' | 'void';
const empty = (): [Entry, Entry] => [{ done: false }, { done: false }];
const blank = (): Player => ({ token: randomUUID(), ready: false, retain: false });

export const HUNT_DURATION_MS = 30_000;
let backgroundRemoval: Promise<any> | undefined;

async function segmentObject(image: Buffer) {
  backgroundRemoval ??= import('@huggingface/transformers').then(({ pipeline }) =>
    pipeline('background-removal', 'onnx-community/BEN2-ONNX'));
  const { RawImage } = await import('@huggingface/transformers');
  const decoded = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const input = new RawImage(new Uint8Array(decoded.data), decoded.info.width, decoded.info.height, decoded.info.channels as 3);
  const pipeline = await backgroundRemoval;
  const masks = await pipeline([input]);
  const mask = masks?.[0];
  if (!mask?.data || !mask.width || !mask.height) throw new Error('Segmentation returned no mask');
  // The pipeline returns the image with the background cut away (RGBA); its alpha channel is the mask.
  const raw = sharp(Buffer.from(mask.data), { raw: { width: mask.width, height: mask.height, channels: mask.channels } });
  const alpha = await (mask.channels === 4 ? raw.extractChannel(3) : raw.greyscale())
    .resize(decoded.info.width, decoded.info.height).raw().toBuffer();
  return sharp(decoded.data, { raw: decoded.info }).joinChannel(alpha, { raw: { width: decoded.info.width, height: decoded.info.height, channels: 1 } }).png().toBuffer();
}
export class Duel {
  readonly players = [blank(), blank()];
  accepted = false;
  phase: Phase = 'lobby';
  deadline = 0;
  entries = empty();
  results?: [Result, Result];
  totalScores: [number, number] = [0, 0];
  message = '';
  round = 1;
  private timer?: ReturnType<typeof setTimeout>;
  private presentation?: Presentation;

  constructor(readonly code: string) {}

  state(slot: number) {
    const entry = this.entries[slot];
    return {
      code: this.code, accepted: this.accepted, phase: this.phase, round: this.round,
      totalRounds: TOTAL_ROUNDS, totalScores: this.totalScores, completed: this.round >= TOTAL_ROUNDS && this.phase === 'result',
      deadline: this.deadline, serverTime: Date.now(), prompt: rounds[this.round - 1].prompt, ready: this.players.map(player => player.ready),
      locked: this.entries.map(find => Boolean(find.frame)), message: this.message,
      guesses: entry.done ? [] : entry.guesses, options: entry.options, confirmed: entry.done,
      results: this.results, presentation: this.presentation, retentionEnabled: Boolean(process.env.TRAINING_DATA_DIR), slot,
    };
  }

  ready(slot: number, retain: boolean) {
    if (!this.accepted || !['lobby', 'result', 'void'].includes(this.phase)) return;
    if (this.phase === 'result' && this.round >= TOTAL_ROUNDS) return;
    this.players[slot].ready = true;
    this.players[slot].retain = retain;
    if (!this.players.every(player => player.ready)) return;
    if (this.phase !== 'lobby') this.round++;
    this.entries = empty();
    this.results = undefined;
    this.presentation = undefined;
    this.message = '';
    this.phase = 'hunt';
    this.deadline = Date.now() + HUNT_DURATION_MS;
    this.players.forEach(player => { player.ready = false; });
    this.timer = setTimeout(() => void this.finish(), HUNT_DURATION_MS);
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
    this.presentation = undefined;
  }

  private async finish() {
    if (this.phase !== 'hunt') return;
    // No confirmation step: each locked frame is named and scored in one model call.
    void this.reveal();
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
    const scanStartedAt = Date.now();
    if (entries.some(entry => entry.frame)) this.presentation = { scanStartedAt };
    const isCurrent = () => entries === this.entries && this.phase === 'scoring';
    try {
      const judge = (entry: Entry): Promise<JudgedResult> => entry.frame
        ? judgeFind(entry.frame, rounds[this.round - 1])
        : Promise.resolve({ label: 'No find', points: 0, reason: 'No camera view was captured.', unlisted: false, safeToRetain: false });
      const [{ geometry: firstFind, ...first }, { geometry: secondFind, ...second }] = await Promise.all([judge(entries[0]), judge(entries[1])]);
      if (!isCurrent()) return;
      if (this.presentation) {
        const remainingScan = scanStartedAt + SCAN_MIN_MS - Date.now();
        if (remainingScan > 0) await new Promise<void>(resolve => setTimeout(resolve, remainingScan));
        if (!isCurrent()) return;
        this.presentation = { scanStartedAt, focusStartedAt: Date.now(), finds: [firstFind, secondFind] };
        await new Promise<void>(resolve => setTimeout(resolve, FOCUS_MS));
        if (!isCurrent()) return;
        this.presentation = { ...this.presentation, countUp: {
          startedAt: Date.now(), targets: [entries[0].frame ? first.points : null, entries[1].frame ? second.points : null],
        } };
        await new Promise<void>(resolve => setTimeout(resolve, COUNT_UP_MS));
        if (!isCurrent()) return;
      }
      const results: [Result, Result] = [first, second];
      this.results = results;
      results.forEach((result, slot) => { this.totalScores[slot] += result.points; });
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
      if (isCurrent()) this.void('Scoring timed out or failed. Try a rematch.');
    }
  }

  frame(slot: number, round = this.round) {
    if (round !== this.round || (this.phase !== 'scoring' && this.phase !== 'result')) return;
    return this.entries[slot]?.frame;
  }

  async objectFrame(slot: number) {
    const entry = this.entries[slot];
    const frame = this.frame(slot);
    const box = this.results?.[slot]?.box;
    if (!frame) return undefined;
    if (!box) return frame;
    if (entry.object) return entry.object;
    const meta = await sharp(frame).metadata();
    if (!meta.width || !meta.height) return frame;
    const [left, top, right, bottom] = box;
    const marginX = (right - left) * .12;
    const marginY = (bottom - top) * .12;
    const x = Math.max(0, Math.floor((left - marginX) * meta.width));
    const y = Math.max(0, Math.floor((top - marginY) * meta.height));
    const endX = Math.min(1, right + marginX) * meta.width;
    const endY = Math.min(1, bottom + marginY) * meta.height;
    const width = Math.max(1, Math.min(meta.width - x, Math.ceil(endX - x)));
    const height = Math.max(1, Math.min(meta.height - y, Math.ceil(endY - y)));
    const crop = await sharp(frame).extract({ left: x, top: y, width, height }).resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
    entry.object = (async () => {
      try { return await segmentObject(crop); }
      catch (error) {
        console.warn('[envoggle] Object segmentation unavailable; showing the object crop.', error instanceof Error ? error.message : '');
        return crop;
      }
    })();
    return entry.object;
  }

  private async retain(frame: Buffer, label: string) {
    const directory = `${process.env.TRAINING_DATA_DIR}/${randomUUID()}`;
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(`${directory}/frame.jpg`, frame, { mode: 0o600 });
    await writeFile(`${directory}/label.json`, JSON.stringify({ label, category: rounds[this.round - 1].prompt }), { mode: 0o600 });
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
