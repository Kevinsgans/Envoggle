// In a Group FaceTime call, Chert (beta.21) sends one capture of its FaceTime window with player 1
// in the left tile and player 2 in the right tile. The window size varies, so the tiles are found
// in each checked frame: the widest band of lit rows, split into exactly two similar lit column spans.
export type Tile = { left: number; right: number; top: number; bottom: number };
function findRow(data: Buffer, width: number, height: number, channels: number): Tile[] | undefined {
  const lit = (x: number, y: number) => data[(y * width + x) * channels] > 8;
  const runs = (values: number[], test: (value: number) => boolean, min: number) => {
    const found: [number, number][] = [];
    let start = -1;
    values.forEach((value, index) => {
      if (test(value) && start < 0) start = index;
      if (!test(value) && start >= 0) { if (index - start >= min) found.push([start, index - 1]); start = -1; }
    });
    if (start >= 0 && values.length - start >= min) found.push([start, values.length - 1]);
    return found;
  };
  const rows = Array.from({ length: height }, (_, y) => { let count = 0; for (let x = 0; x < width; x++) if (lit(x, y)) count++; return count; });
  const peak = Math.max(...rows);
  if (peak < width * 0.15) return undefined;
  const band = runs(rows, count => count >= peak * 0.6, height * 0.15).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
  if (!band) return undefined;
  const [top, bottom] = band;
  const columns = Array.from({ length: width }, (_, x) => { let count = 0; for (let y = top; y <= bottom; y++) if (lit(x, y)) count++; return count / (bottom - top + 1); });
  const spans = runs(columns, share => share > 0.5, width * 0.08);
  if (spans.length !== 2) return undefined;
  const [a, b] = spans.map(([start, end]) => end - start + 1);
  if (Math.min(a, b) / Math.max(a, b) < 0.7 || spans[1][0] - spans[0][1] > width * 0.1) return undefined;
  // Inset by 1% to skip the tiles' rounded corners.
  return spans.map(([start, end]) => ({ left: start / width + 0.01, right: (end + 1) / width - 0.01, top: top / height + 0.01, bottom: (bottom + 1) / height - 0.01 }));
}
// Tries side-by-side tiles first, then tiles stacked one above the other (a narrow FaceTime
// window). Player 1 is the left or top tile.
export function findTiles(data: Buffer, width: number, height: number, channels: number): Tile[] | undefined {
  const row = findRow(data, width, height, channels);
  if (row) return row;
  const turned = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) turned[x * height + y] = data[(y * width + x) * channels];
  return findRow(turned, height, width, 1)?.map(tile => ({ left: tile.top, right: tile.bottom, top: tile.left, bottom: tile.right }));
}
