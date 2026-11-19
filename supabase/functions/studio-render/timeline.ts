// Pure timing plan for the compound-interest proof: inserts pauses into the
// saved narration and shifts every word, cue and audio segment accordingly.
export interface Word { word: string; start: number; end: number }
export interface Cue { value: number; start: number; end: number }
export interface SceneAudio { seconds: number; words: Word[]; cues: Cue[] }

export const PAUSES = [
  { scene: 0, after: "one hundred and ten dollars.", seconds: 0.7 },
  { scene: 1, after: "first hundred dollars.", seconds: 0.6 },
  { scene: 1, after: "one hundred and ten.", seconds: 0.8 },
  { scene: 1, after: "one hundred and twenty-one.", seconds: 0.8 },
  { scene: 1, after: "one hundred and thirty-three dollars,", seconds: 1.0 },
];
export const CHART_HOLD = 2.0;

export function parseSrt(srt: string): Word[] {
  const t = (s: string) => { const [h, m, r] = s.split(":"); return +h * 3600 + +m * 60 + +r.replace(",", "."); };
  return srt.trim().split(/\n\s*\n/).map(block => {
    const [, time, ...text] = block.trim().split("\n");
    const [a, b] = time.split(" --> ");
    return { word: text.join(" ").trim(), start: t(a), end: t(b) };
  });
}

function cutAfter(words: Word[], phrase: string) {
  const p = phrase.toLowerCase().split(" ");
  const i = words.findIndex((_, k) => p.every((w, j) => words[k + j]?.word.toLowerCase() === w));
  if (i < 0) throw new Error("Pause phrase not found: " + phrase);
  const last = words[i + p.length - 1], next = words[i + p.length];
  return next ? (last.end + next.start) / 2 : last.end;
}

export function planTimeline(scenes: SceneAudio[], pauses = PAUSES) {
  const audio: { scene: number; trim: number; start: number; length: number }[] = [];
  const words: Word[] = [], cues: Cue[] = [], sceneStarts: number[] = [];
  let start = 0;
  scenes.forEach((s, i) => {
    sceneStarts.push(start);
    const cuts = pauses.filter(p => p.scene === i).map(p => ({ at: cutAfter(s.words, p.after), seconds: p.seconds })).sort((a, b) => a.at - b.at);
    const shift = (src: number) => start + src + cuts.filter(c => c.at <= src).reduce((n, c) => n + c.seconds, 0);
    const edges = [0, ...cuts.map(c => c.at), s.seconds];
    for (let k = 0; k < edges.length - 1; k++) audio.push({ scene: i, trim: edges[k], start: shift(edges[k]), length: edges[k + 1] - edges[k] });
    for (const w of s.words) words.push({ word: w.word, start: shift(w.start), end: shift(w.end) });
    for (const c of s.cues) cues.push({ value: c.value, start: shift(c.start), end: shift(c.end) });
    start = shift(s.seconds) + (i === 1 ? CHART_HOLD : 0);
  });
  return { audio, words, cues, sceneStarts, narrationEnd: start };
}
