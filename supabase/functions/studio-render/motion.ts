// World-space foot anchors make stance shoes stationary as the hips travel.
export interface Walk { t0: number; xa: number; xb: number; stepSeconds: number; steps: number; duration: number }
export function walk(t0: number, xa: number, xb: number, stepSeconds: number): Walk {
  const steps = Math.max(1, Math.ceil(Math.abs(xb - xa) / 70));
  return { t0, xa, xb, stepSeconds, steps, duration: steps * stepSeconds };
}
export function walkPose(w: Walk, t: number) {
  const q = Math.max(0, Math.min(w.steps, (t - w.t0) / w.stepSeconds));
  const n = Math.min(w.steps - 1, Math.floor(q)), f = q - n;
  const d = (w.xb - w.xa) / w.steps;
  const smooth = f * f * (3 - 2 * f);
  const feet = [0, 1].map(side => side === n % 2
    ? { x: w.xa + (n + 0.5) * d, lift: 0 }
    : { x: w.xa + (n - 0.5 + 2 * smooth) * d, lift: 28 * Math.sin(Math.PI * f) });
  return { x: w.xa + q * d, feet };
}