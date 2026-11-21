import { describe, expect, it } from "vitest";
import { danielPose, performanceTimes } from "../../supabase/functions/studio-render/design/performance";
import { planTimeline, parseSrt } from "../../supabase/functions/studio-render/timeline";
import { walkPose } from "../../supabase/functions/studio-render/motion";
import fixture from "./fixtures/compoundInterestTiming.json";
const base=planTimeline(fixture.map(s=>({...s,words:parseSrt(s.srt)})));
const plan={...base,total:63};
describe("Daniel's replaceable artwork performance",()=>{
  it("keeps the stance foot fixed in world space and lifts the other shoe",()=>{
    const w=performanceTimes(plan).entrance;
    const a=walkPose(w,.1),b=walkPose(w,.3);
    expect(a.feet[0].x).toBe(b.feet[0].x);
    expect(a.feet[0].lift).toBe(0);
    expect(b.feet[1].lift).toBeGreaterThan(0);
    expect(b.x).toBeGreaterThan(a.x);
    expect(danielPose(plan,.3).legs[1].lower).toBeGreaterThan(10);
  });
  it("settles with nearly straight legs and weight centred over feet",()=>{
    const pose=danielPose(plan,10);
    expect(pose.x).toBe(380);
    expect(pose.walking).toBe(false);
    expect(pose.legs[0].lower).toBeLessThan(3);
    expect(pose.legs[1].lower).toBeLessThan(3);
  });
  it("points and looks toward the chart at each saved spoken amount",()=>{
    expect(plan.cues.map(c=>c.value)).toEqual([100,110,121,133]);
    for(const cue of plan.cues){
      const pose=danielPose(plan,cue.start);
      expect(pose.hand).toBe("point");
      expect(pose.gaze).toBe(4);
      expect(pose.right).toBeLessThan(-60);
    }
  });
  it("uses an open hand for the greeting and raises both shoulders in the shrug",()=>{
    const times=performanceTimes(plan);
    expect(danielPose(plan,times.wave+.6).hand).toBe("open");
    expect(danielPose(plan,times.shrug+.6).shoulders).toBe(-12);
  });
});