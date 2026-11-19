import { readFileSync, existsSync } from "fs";
import { describe, expect, it } from "vitest";
import { planTimeline, PAUSES, CHART_HOLD } from "../../supabase/functions/studio-render/timeline";

const w = (word: string, start: number) => ({ word, start, end: start + 0.3 });

describe("compound-interest proof timing", () => {
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

  const dir = "/tmp/w";
  it.runIf(existsSync(dir + "/1.srt"))("real narration lands near 60 seconds", async () => {
    const { parseSrt } = await import("../../supabase/functions/studio-render/timeline");
    const scenes = [0, 1, 2].map(i => ({ ...JSON.parse(readFileSync(`${dir}/${i}.json`, "utf8")), words: parseSrt(readFileSync(`${dir}/${i}.srt`, "utf8")) }));
    const plan = planTimeline(scenes);
    const total = plan.narrationEnd + 0.4 + 14 * 0.4 + 0.3;
    console.log(JSON.stringify({ total, cues: plan.cues, starts: plan.sceneStarts }));
    expect(PAUSES.length).toBe(5);
    expect(total).toBeGreaterThan(57);
    expect(total).toBeLessThan(63);
  });
});
