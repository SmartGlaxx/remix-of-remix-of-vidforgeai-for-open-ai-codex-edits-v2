import { armArt, headArt, legArt, torsoArt } from "./daniel.ts";
export type DanielAction = "stand" | "walk" | "wave" | "point";
// Named review poses share the same layered parts. These are art poses, not motion verification.
export const reviewActions = {
  stand: { legs: [[5,-7],[-5,7]], arms: [[8,-8],[-8,8]], head:0, gaze:0, lift:0 },
  walk: { legs: [[24,-8],[-28,54]], arms: [[-24,-12],[25,-16]], head:0, gaze:0, lift:5 },
  wave: { legs: [[5,-7],[-5,7]], arms: [[8,-8],[-142,-18]], head:-3, gaze:0, lift:0 },
  point: { legs: [[5,-7],[-5,7]], arms: [[8,-8],[-65,-26]], head:9, gaze:4, lift:0 },
};
export function danielArtwork(action: DanielAction) {
  const p = reviewActions[action];
  return `<g stroke="#263234" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <g transform="translate(0 ${-10-p.lift})"><g transform="translate(-17 -140)">${legArt(p.legs[0][0],p.legs[0][1],"left-leg")}</g><g transform="translate(17 -140)">${legArt(p.legs[1][0],p.legs[1][1],"right-leg")}</g>
  <g transform="translate(-34 -252)">${armArt(p.arms[0][0],p.arms[0][1],"rest","left-arm")}</g><g transform="translate(0 -252)">${torsoArt()}</g>
  <g transform="translate(0 -292) rotate(${p.head})">${headArt(action === "point" ? "thinking":"smile",p.gaze)}</g>
  <g transform="translate(34 -252)">${armArt(p.arms[1][0],p.arms[1][1],action === "wave"?"open":action === "point"?"point":"rest","right-arm")}</g></g></g>`;
}