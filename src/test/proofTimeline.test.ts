import { describe, expect, it } from "vitest";
import { planTimeline, parseSrt, CHART_HOLD } from "../../supabase/functions/studio-render/timeline";
import { walk, walkPose } from "../../supabase/functions/studio-render/motion";
import savedScenes from "./fixtures/compoundInterestTiming.json";

const w = (word: string, start: number) => ({ word, start, end: start + 0.3 });

describe("compound-interest proof timing", () => {
  it("keeps a shoe on the floor throughout walk-in and walk-out", () => {
    for (const gait of [walk(0, -170, 290, 0.36), walk(0, 290, 1400, 0.34)]) {
      for (let t = 0; t <= gait.duration; t += 1 / 30) {
        expect(walkPose(gait, t).feet.some(foot => foot.lift === 0)).toBe(true);
      }
    }
  });
  it("keeps the planted shoe stationary while the body travels", () => {
    const gait = walk(0, 290, 1400, 0.34);
    const a = walkPose(gait, 0.05), b = walkPose(gait, 0.25);
    expect(a.feet[0].x).toBe(b.feet[0].x);
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.feet[1].x).toBeGreaterThan(a.feet[1].x);
  });
  it("shifts later words and cues by each inserted pause", () => {
    const words = ["your", "first", "hundred", "dollars.", "next"].map((x, i) => w(x, i));
    const plan = planTimeline([
      { seconds: 2, words: [w("a", 0)], cues: [] },
      { seconds: 6, words, cues: [{ value: 100, start: 2, end: 3.3 }, { value: 110, start: 4, end: 4.3 }] },
    ], [{ scene: 1, after: "first hundred dollars.", seconds: 0.6 }]);
    expect(plan.sceneStarts).toEqual([0, 2]);
    expect(plan.cues[0].start).toBe(4); // before the pause: unshifted
    expect(plan.cues[1].start).toBeCloseTo(6 + 0.6); // after "first hundred dollars." pause
    expect(plan.narrationEnd).toBeCloseTo(2 + 6 + 0.6 + CHART_HOLD);
    expect(plan.audio.filter(a => a.scene === 1).map(a => a.trim)).toEqual([0, 3.65]);
  });

  it("saved narration plus pauses and walk-out stays close to 60 seconds", () => {
    const plan = planTimeline(savedScenes.map(scene => ({ ...scene, words: parseSrt(scene.srt) })));
    const total = plan.narrationEnd + 0.4 + walk(0, 290, 1400, 0.34).duration + 0.3;
    expect(total).toBeCloseTo(61.777142857, 5);
  });
  it.each([100, 110, 121, 133])("cues $%i at its shifted spoken word", value => {
    const plan = planTimeline(savedScenes.map(scene => ({ ...scene, words: parseSrt(scene.srt) })));
    const cue = plan.cues.find(c => c.value === value);
    expect(cue).toBeDefined();
    expect(plan.words.find(word => word.start === cue?.start)?.word.toLowerCase()).toBe(value === 100 ? "hundred" : "one");
  });
});
