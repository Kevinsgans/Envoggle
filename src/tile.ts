import { tierName } from './categories.js';
import { HUNT_DURATION_MS, countdownFrame } from './countdown.js';
import { renderPhoto, type FindGeometry, type Photo } from './find-visual.js';
import { countUpScore, renderScore } from './score-display.js';

// The referee's video tile: 720 x 1280 portrait. FaceTime crops it to fill the screen or a group
// tile, so everything stays inside the centre 560 x 720 (x 80-640, y 280-1000).
export const TILE_WIDTH = 720;
export const TILE_HEIGHT = 1280;

export const COLORS = ['#FF9F43', '#54A0FF'];
export const DEFAULT_NAMES = ['Orange', 'Blue'];
const ink = '#F2F5F8';
const muted = '#9AA7B6';
const soft = '#C9D2DC';
const ground = '#0D131C';
const card = '#16202C';
const track = '#1F2A38';
const lime = '#B8F25C';
const yellow = '#FFD84D';
const font = `font-family="Helvetica Neue, Helvetica, Arial, sans-serif"`;
// Colours of the five 200-point bands, lowest first.
const tierColors = ['#AAB4C0', '#8FD3B6', '#C9A5FF', '#FFB3D1', yellow];

type Result = { label: string; points: number };
type Finds = { names: string[]; prompt: string; photos: (Photo | undefined)[]; finds?: (FindGeometry | undefined | null)[] };
export type View =
  | { kind: 'waiting'; present: boolean[] }
  | { kind: 'message'; title: string; detail: string }
  | { kind: 'names'; names: (string | undefined)[]; turn: number; frames: (Buffer | undefined)[] }
  | { kind: 'ready'; names: string[]; prompt: string }
  | { kind: 'hunt'; names: string[]; prompt: string; remainingMs: number; locked: boolean[]; animate?: boolean }
  | (Finds & { kind: 'scoring'; focus: number; scan?: number; countUp?: { elapsed: number; targets: (number | null)[] } })
  | (Finds & { kind: 'reveal'; results: Result[]; last?: boolean })
  | { kind: 'final'; names: string[]; history: { prompt: string; points: number[] }[]; totals: number[] };

export function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]!);
}

export function wrap(value: string, chars: number, max = 2) {
  const lines: string[] = [];
  for (const word of value.split(/\s+/).filter(Boolean)) {
    const last = lines.length - 1;
    if (last >= 0 && (lines[last] + ' ' + word).length <= chars) lines[last] += ' ' + word;
    else lines.push(word.slice(0, chars));
  }
  if (lines.length > max) lines.length = max;
  return lines;
}

export function tierOf(points: number, prompt = '') {
  return tierName(points, prompt);
}

// Text centred at x, baseline from the top of a line box of the given size.
function text(value: string, x: number, top: number, size: number, options: { weight?: number; fill?: string; anchor?: string; spacing?: number } = {}) {
  const { weight = 400, fill = ink, anchor = 'middle', spacing = 0 } = options;
  return `<text x="${x}" y="${top + size * 0.8}" text-anchor="${anchor}" fill="${fill}" ${font} font-weight="${weight}" font-size="${size}"${spacing ? ` letter-spacing="${spacing}"` : ''}>${escapeXml(value)}</text>`;
}

// Stacks blocks vertically, centred in the tile. Each block is drawn at its top y.
function stack(blocks: { height: number; draw: (top: number) => string }[], gap: number) {
  const total = blocks.reduce((sum, block) => sum + block.height, 0) + gap * (blocks.length - 1);
  let top = (TILE_HEIGHT - total) / 2;
  return blocks.map(block => { const out = block.draw(top); top += block.height + gap; return out; }).join('');
}

const logo = (cx: number, top: number) =>
  `<g transform="translate(${cx - 120} ${top})"><circle cx="12" cy="12" r="9" fill="none" stroke="${COLORS[0]}" stroke-width="5"/><circle cx="44" cy="12" r="9" fill="none" stroke="${COLORS[1]}" stroke-width="5"/><rect x="21" y="10" width="14" height="4" fill="#5B6878"/></g>` +
  text('ENVOGGLE', TILE_WIDTH / 2 + 30, top + 1, 22, { weight: 700, fill: muted, spacing: 7 });

function heading(label: string, title: string, size: number) {
  const lines = wrap(title, Math.floor(560 / (size * 0.55)), 3);
  return {
    height: 34 + lines.length * size * 1.05,
    draw: (top: number) => text(label, TILE_WIDTH / 2, top, 24, { weight: 700, fill: muted, spacing: 5 }) +
      lines.map((line, index) => text(line, TILE_WIDTH / 2, top + 34 + index * size * 1.05, size, { weight: 800 })).join(''),
  };
}

// The two player cards: a colour bar, the name, and a status line.
function players(names: string[], status: string[], dim: boolean[] = [false, false]) {
  return {
    height: 104,
    draw: (top: number) => names.map((name, slot) => {
      const x = 80 + slot * 288;
      return `<rect x="${x}" y="${top}" width="272" height="104" fill="${dim[slot] ? '#121A24' : card}"/>` +
        `<rect x="${x}" y="${top}" width="272" height="6" fill="${dim[slot] ? '#2A3646' : COLORS[slot]}"/>` +
        text(name.slice(0, 14), x + 22, top + 20, 32, { weight: 800, fill: dim[slot] ? '#6C7A8B' : COLORS[slot], anchor: 'start' }) +
        text(status[slot], x + 22, top + 62, 26, { fill: dim[slot] ? '#8A97A6' : soft, anchor: 'start' });
    }).join(''),
  };
}

function ring(frame: ReturnType<typeof countdownFrame>, size: number, numberSize: number) {
  const r = size / 2 - 18;
  const circumference = 2 * Math.PI * r;
  const { seconds, blend, color, progress } = frame;
  return {
    height: size,
    draw: (top: number) => {
      const cx = TILE_WIDTH / 2;
      const cy = top + size / 2;
      const numberTop = cy - numberSize * 0.62 + 2;
      const previous = blend < 1 ? `<g opacity="${1 - blend}">${text(String(seconds + 1), cx, numberTop - 18 * blend, numberSize, { weight: 800 })}</g>` : '';
      const arc = progress > 0 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="18" stroke-linecap="round" stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${(circumference * (1 - progress)).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>` : '';
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${track}" stroke-width="18"/>` +
        arc + previous + `<g opacity="${blend}">${text(String(seconds), cx, numberTop + 18 * (1 - blend), numberSize, { weight: 800 })}</g>` +
        text('seconds', cx, numberTop + numberSize * 0.94, 26, { fill: muted });
    },
  };
}

const mic = (cx: number, top: number, color: string) =>
  `<g transform="translate(${cx - 22} ${top})"><rect x="12" y="2" width="20" height="34" rx="10" fill="none" stroke="${color}" stroke-width="5"/><path d="M4 28 a18 18 0 0 0 36 0 M22 46 v12" fill="none" stroke="${color}" stroke-width="5"/></g>`;

function findCards(view: Extract<View, { kind: 'scoring' | 'reveal' }>) {
  const results = view.kind === 'reveal' ? view.results : undefined;
  const winner = !results || results[0].points === results[1].points ? -1 : results[0].points > results[1].points ? 0 : 1;
  const headline = !results ? 'Scoring' : winner < 0 ? 'Draw' : `${view.names[winner]} wins`;
  const focus = view.kind === 'reveal' ? 1 : view.focus;
  const scan = view.kind === 'scoring' ? view.scan : undefined;
  const countUp = view.kind === 'scoring' ? view.countUp : undefined;
  const cards = {
    height: 520,
    draw: (top: number) => view.names.map((name, slot) => {
      const x = 80 + slot * 288;
      const result = results?.[slot];
      const photo = view.photos[slot];
      const tier = result ? tierOf(result.points, view.prompt) : undefined;
      const lose = winner >= 0 && winner !== slot;
      let out = `<rect x="${x}" y="${top}" width="272" height="520" fill="${card}"/>`;
      out += photo
        ? `<g transform="translate(${x} ${top + 8})">${renderPhoto(`f${slot}`, photo, view.finds?.[slot] ?? undefined, focus, scan)}</g>`
        : `<rect x="${x}" y="${top + 8}" width="272" height="292" fill="#222D3B"/>` + text('No frame', x + 136, top + 140, 24, { fill: '#8A97A6' });
      out += `<rect x="${x}" y="${top}" width="272" height="8" fill="${COLORS[slot]}"/>`;
      if (winner === slot) out += `<rect x="${x - 2}" y="${top - 2}" width="276" height="524" fill="none" stroke="${COLORS[slot]}" stroke-width="4"/>`;
      const body = top + 316;
      out += text(name.slice(0, 14), x + 18, body, 26, { weight: 800, fill: COLORS[slot], anchor: 'start' });
      const target = countUp?.targets[slot];
      const score = result?.points ?? (countUp && target != null ? countUpScore(countUp.elapsed, target) : undefined);
      if (score !== undefined) {
        out += `<g transform="translate(${x + 18} ${body + 106})">${renderScore(score)}</g>`;
      }
      if (!result) return out;
      out += wrap(result.label, 15).map((line, index) => text(line, x + 18, body + 34 + index * 30, 26, { weight: 700, fill: lose ? soft : ink, anchor: 'start' })).join('');
      if (tier) {
        const width = tier.length * 13 + 24;
        out += `<rect x="${x + 18}" y="${body + 156}" width="${width}" height="28" fill="${tierColors[Math.min(4, Math.max(0, Math.ceil(result.points / 200) - 1))]}"/>` +
          text(tier.toUpperCase(), x + 18 + width / 2, body + 162, 18, { weight: 700, fill: ground, spacing: 1 });
      }
      out += `<rect x="${x + 18}" y="${body + 190}" width="236" height="6" fill="#26313F"/><rect x="${x + 18}" y="${body + 190}" width="${Math.round(236 * Math.min(1, result.points / 1000))}" height="6" fill="${COLORS[slot]}"/>`;
      return out;
    }).join(''),
  };
  return stack([
    { height: 112, draw: top => text(view.prompt.toUpperCase(), TILE_WIDTH / 2, top, 22, { weight: 700, fill: muted, spacing: 4 }) + text(headline, TILE_WIDTH / 2, top + 36, 76, { weight: 800, fill: winner < 0 ? ink : COLORS[winner] }) },
    cards,
    { height: 30, draw: top => results ? text(view.kind === 'reveal' && view.last ? 'Final scores next' : 'Say “continue” for the next round', TILE_WIDTH / 2, top, 28, { fill: muted }) : '' },
  ], 26);
}

export function renderTile(view: View) {
  let body = '';
  const center = TILE_WIDTH / 2;
  if (view.kind === 'waiting') {
    const count = view.present.filter(Boolean).length;
    body = stack([
      { height: 128, draw: top => view.present.map((present, slot) => `<circle cx="${center - 86 + slot * 172}" cy="${top + 64}" r="50" fill="none" stroke="${present ? COLORS[slot] : '#2A3646'}" stroke-width="18"${present ? '' : ' stroke-dasharray="14 12"'}/>`).join('') + `<rect x="${center - 28}" y="${top + 56}" width="56" height="16" fill="#5B6878"/>` },
      { height: 30, draw: top => text('ENVOGGLE', center, top, 30, { weight: 700, fill: muted, spacing: 10 }) },
      { height: 130, draw: top => wrap(count ? 'Waiting for one more player' : 'Waiting for players', 18).map((line, index) => text(line, center, top + index * 64, 60, { weight: 800 })).join('') },
      { height: 82, draw: top => ['Both players on camera, side by', 'side in the Group FaceTime'].map((line, index) => text(line, center, top + index * 40, 30, { fill: muted })).join('') },
    ], 36);
  } else if (view.kind === 'message') {
    body = stack([
      { height: 24, draw: top => logo(center, top) },
      { height: 130, draw: top => wrap(view.title, 18).map((line, index) => text(line, center, top + index * 64, 60, { weight: 800 })).join('') },
      { height: 82, draw: top => wrap(view.detail, 32).map((line, index) => text(line, center, top + index * 40, 30, { fill: muted })).join('') },
    ], 40);
  } else if (view.kind === 'names') {
    // Each player's live camera sits in their colour box, so they can see which colour they are.
    body = stack([
      heading('ONE AT A TIME', 'Say your name', 64),
      {
        height: 380,
        draw: top => view.names.map((name, slot) => {
          const x = 80 + slot * 288;
          const frame = view.frames[slot];
          const current = !name && slot === view.turn;
          let out = `<rect x="${x}" y="${top}" width="272" height="380" fill="${current ? card : '#121A24'}"/>`;
          out += frame
            ? `<clipPath id="n${slot}"><rect x="${x}" y="${top + 8}" width="272" height="272"/></clipPath><image x="${x}" y="${top + 8}" width="272" height="272" preserveAspectRatio="xMidYMid slice" clip-path="url(#n${slot})" href="data:image/jpeg;base64,${frame.toString('base64')}" xlink:href="data:image/jpeg;base64,${frame.toString('base64')}"/>`
            : `<rect x="${x}" y="${top + 8}" width="272" height="272" fill="#222D3B"/>`;
          out += `<rect x="${x}" y="${top}" width="272" height="8" fill="${COLORS[slot]}"/>`;
          if (current) out += `<rect x="${x - 2}" y="${top - 2}" width="276" height="384" fill="none" stroke="${COLORS[slot]}" stroke-width="4"/>`;
          out += name
            ? text(name.slice(0, 12), x + 136, top + 306, 40, { weight: 800, fill: COLORS[slot] })
            : text(current ? `${DEFAULT_NAMES[slot]}, say your name` : DEFAULT_NAMES[slot], x + 136, top + 314, current ? 24 : 30, { weight: current ? 700 : 400, fill: current ? COLORS[slot] : '#8A97A6' });
          return out;
        }).join(''),
      },
      { height: 30, draw: top => text('Say “skip” to play as Orange and Blue', center, top, 28, { fill: muted }) },
    ], 44);
  } else if (view.kind === 'ready') {
    const category = heading('NEXT CATEGORY', view.prompt, 64);
    body = stack([
      { height: 24, draw: top => logo(center, top) },
      { height: category.height + 48, draw: top => category.draw(top) + text(`${HUNT_DURATION_MS / 1000} seconds · highest score wins`, center, top + category.height + 14, 28, { fill: muted }) },
      { height: 200, draw: top => `<rect x="80" y="${top}" width="560" height="200" fill="${lime}"/>` + mic(center, top + 30, ground) + text('Say “start”', center, top + 104, 72, { weight: 800, fill: ground }) },
      players(view.names, ['In', 'In']),
    ], 44);
  } else if (view.kind === 'hunt') {
    const frame = countdownFrame(view.remainingMs, view.animate);
    body = stack([
      heading('FIND', view.prompt, 48),
      ring(frame, 328, 166),
      { height: 64, draw: top => frame.urgency > 0 ? `<g opacity="${frame.urgency}"><rect x="80" y="${top}" width="560" height="64" fill="${yellow}"/>` +
        text('Hold it up to the camera', center, top + 13, 36, { weight: 800, fill: ground }) + '</g>' : '' },
      players(view.names, view.locked.map(locked => locked ? 'Captured' : 'Hunting')),
    ], 27);
  } else if (view.kind === 'final') {
    // Final scores: one row per round, then the totals, with the match winner on top.
    const [a, b] = view.totals;
    const winner = a === b ? -1 : a > b ? 0 : 1;
    const row = (label: string, points: number[], top: number, big: boolean) =>
      wrap(label, big ? 16 : 22).map((line, index) => text(line, 100, top + index * 30, big ? 32 : 26, { weight: big ? 800 : 400, fill: big ? ink : soft, anchor: 'start' })).join('') +
      points.map((value, slot) => text(String(value), 448 + slot * 128, top, big ? 40 : 30, { weight: 800, fill: big && winner === slot ? COLORS[slot] : ink })).join('');
    body = stack([
      { height: 24, draw: top => logo(center, top) },
      { height: 112, draw: top => text('FINAL SCORES', center, top, 24, { weight: 700, fill: muted, spacing: 5 }) + text(winner < 0 ? 'Tied match' : `${view.names[winner]} wins`, center, top + 36, 76, { weight: 800, fill: winner < 0 ? ink : COLORS[winner] }) },
      {
        height: 70 + view.history.length * 96 + 90,
        draw: top => {
          let out = `<rect x="80" y="${top}" width="560" height="${70 + view.history.length * 96 + 90}" fill="${card}"/>`;
          out += view.names.map((name, slot) => `<rect x="${384 + slot * 128}" y="${top}" width="128" height="8" fill="${COLORS[slot]}"/>` + text(name.slice(0, 7), 448 + slot * 128, top + 24, 26, { weight: 800, fill: COLORS[slot] })).join('');
          view.history.forEach((round, index) => { out += row(round.prompt, round.points, top + 84 + index * 96, false); });
          const totalTop = top + 70 + view.history.length * 96 + 22;
          out += `<rect x="100" y="${totalTop - 18}" width="520" height="2" fill="#2A3646"/>` + row('Total', view.totals, totalTop, true);
          return out;
        },
      },
      { height: 30, draw: top => text('Say “start” for a new match', center, top, 28, { fill: muted }) },
    ], 40);
  } else body = findCards(view);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${TILE_WIDTH}" height="${TILE_HEIGHT}"><rect width="${TILE_WIDTH}" height="${TILE_HEIGHT}" fill="${ground}"/>${body}</svg>`;
}
