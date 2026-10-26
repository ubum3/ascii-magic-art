// Where FerroBloom's magnet sits, as pure numbers (tested in test/bg-36.test.mjs).

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The mark's placement for a box of this aspect (width / height), in shader units
 * (x 0 to aspect, y 0 to 1, y up): [centre x, centre y, side of the SDF square].
 * Wide boxes get a big mark low on the right, partly off the edge; tall ones a
 * smaller mark low in the middle. Either way the centre stays clear for a card.
 */
export function ferroLayout(aspect: number): [number, number, number] {
  const k = smooth(0.7, 1.3, aspect);
  const phone = [aspect * 0.5, 0.13, aspect];
  const desk = [aspect - 0.3, 0.3, Math.min(1, aspect * 0.62)];
  return [0, 1, 2].map((i) => phone[i]! + (desk[i]! - phone[i]!) * k) as [number, number, number];
}
