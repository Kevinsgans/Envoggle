export type Point = [number, number];
export type Rotation = 0 | 90 | 180 | 270;
export type FindGeometry = { contour?: Point[]; holes?: Point[][]; rotation: Rotation };
export type Presentation = {
  scanStartedAt: number;
  focusStartedAt?: number;
  countUp?: { startedAt: number; targets: [number | null, number | null] };
  finds?: [FindGeometry | undefined, FindGeometry | undefined];
};
export type Photo = { href: string; width: number; height: number };

export const SCAN_MIN_MS = 1000;
export const FOCUS_MS = 650;
export const PHOTO_WIDTH = 272;
export const PHOTO_HEIGHT = 292;
const green = '#B8F25C';

export function focusProgress(elapsed: number) {
  const fraction = Math.max(0, Math.min(1, elapsed / FOCUS_MS));
  return fraction * fraction * (3 - 2 * fraction);
}

export function scanProgress(elapsed: number) {
  return Math.max(0, elapsed) % SCAN_MIN_MS / SCAN_MIN_MS;
}

export function photoMotion(photo: Photo, geometry?: FindGeometry, focus = 0) {
  const { width, height } = photo;
  const centerX = PHOTO_WIDTH / 2;
  const centerY = PHOTO_HEIGHT / 2;
  const fit = Math.min(PHOTO_WIDTH / width, PHOTO_HEIGHT / height);
  let angle = 0;
  let scale = fit;
  let originX = width / 2;
  let originY = height / 2;
  if (geometry && focus > 0) {
    const points: Point[] = geometry.contour?.map(([x, y]) => [x * width / 1000, y * height / 1000])
      ?? [[0, 0], [width, 0], [width, height], [0, height]];
    angle = (geometry.rotation === 270 ? -90 : geometry.rotation) * focus;
    const radians = angle * Math.PI / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const xs = points.map(([x, y]) => x * cosine - y * sine);
    const ys = points.map(([x, y]) => x * sine + y * cosine);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const right = Math.max(...xs);
    const bottom = Math.max(...ys);
    const midX = (left + right) / 2;
    const midY = (top + bottom) / 2;
    originX += (midX * cosine + midY * sine - originX) * focus;
    originY += (midY * cosine - midX * sine - originY) * focus;
    const padding = geometry.contour ? .8 : 1;
    const targetScale = Math.min(PHOTO_WIDTH * padding / (right - left), PHOTO_HEIGHT * padding / (bottom - top), fit * 3);
    const rotatedX = originX * cosine - originY * sine;
    const rotatedY = originX * sine + originY * cosine;
    scale = Math.min(fit + (targetScale - fit) * focus,
      centerX / Math.max(right - rotatedX, rotatedX - left), centerY / Math.max(bottom - rotatedY, rotatedY - top));
  }
  return {
    transform: `translate(${centerX} ${centerY}) scale(${scale}) rotate(${angle}) translate(${-originX} ${-originY})`,
    background: 1 - .85 * focus,
    stroke: 2.5 / scale,
  };
}

// The photo and its source-space contour use the same transform throughout the reveal.
export function renderPhoto(id: string, photo: Photo, geometry?: FindGeometry, focus = 0, scan?: number) {
  const { width, height, href } = photo;
  const motion = photoMotion(photo, geometry, focus);
  const image = `<image width="${width}" height="${height}" href="${href}" xlink:href="${href}"/>`;
  const path = geometry?.contour && [geometry.contour, ...(geometry.holes ?? [])].map(ring =>
    `M${ring.map(([x, y]) => `${x * width / 1000},${y * height / 1000}`).join('L')}Z`).join('');
  const layers = path ? `<clipPath id="${id}-object"><path d="${path}" clip-rule="evenodd"/></clipPath>` +
    `<g data-background="" opacity="${motion.background}">${image}</g><g clip-path="url(#${id}-object)">${image}</g>` +
    `<path data-outline="" d="${path}" fill="none" stroke="${green}" stroke-width="${motion.stroke}" stroke-linejoin="round" opacity="${focus}"/>`
    : image;

  const beam = scan === undefined ? '' : `<g data-beam="" transform="translate(0 ${scan * PHOTO_HEIGHT})">` +
    `<rect y="-38" width="${PHOTO_WIDTH}" height="38" fill="url(#${id}-beam)"/>` +
    `<rect width="${PHOTO_WIDTH}" height="3" fill="${green}"/></g>`;
  return `<svg width="${PHOTO_WIDTH}" height="${PHOTO_HEIGHT}" viewBox="0 0 ${PHOTO_WIDTH} ${PHOTO_HEIGHT}" overflow="hidden">` +
    `<defs><linearGradient id="${id}-beam" x2="0" y2="1"><stop stop-color="${green}" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="${green}" stop-opacity=".42"/></linearGradient></defs>` +
    `<rect width="${PHOTO_WIDTH}" height="${PHOTO_HEIGHT}" fill="#131D29"/>` +
    `<g data-photo="" transform="${motion.transform}">${layers}</g>` +
    `${beam}</svg>`;
}
