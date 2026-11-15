export const COUNT_UP_MS = 1800;
const ZERO_HOLD_MS = 400;
const SCORE_WIDTH = 144;
const SCORE_HEIGHT = 46;
const DIGIT_WIDTH = 33;
const DIGIT_COUNT = 4;

export function countUpScore(elapsed: number, target: number) {
  // Give polling clients time to display zero before the count moves.
  const progress = Math.max(0, Math.min(1, (elapsed - ZERO_HOLD_MS) / (COUNT_UP_MS - ZERO_HOLD_MS)));
  const eased = 1 - (1 - progress) ** 1.8;
  // Leave the final point for the simultaneous reveal.
  return Math.max(0, Math.min(target - 1, Math.floor(target * eased)));
}

export function scoreDigits(value: number) {
  return String(value).padStart(DIGIT_COUNT);
}

export function renderScore(value?: number) {
  const score = value === undefined ? undefined : scoreDigits(value);
  const cells = Array.from({ length: DIGIT_COUNT }, (_, column) => {
    const x = column * 37;
    const open = `<svg x="${x}" width="${DIGIT_WIDTH}" height="${SCORE_HEIGHT}" overflow="hidden">`;
    const cell = `<rect x=".5" y=".5" width="32" height="45" rx="5" fill="#101923" stroke="#35465A"/>`;
    return `${open}${cell}<text x="16.5" y="34">${score?.[column] ?? '–'}</text></svg>`;
  });
  return `<svg width="${SCORE_WIDTH}" height="${SCORE_HEIGHT}" viewBox="0 0 ${SCORE_WIDTH} ${SCORE_HEIGHT}" aria-hidden="true">` +
    `<g text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="32" font-weight="800" fill="#F2F5F8">${cells.join('')}</g></svg>`;
}
