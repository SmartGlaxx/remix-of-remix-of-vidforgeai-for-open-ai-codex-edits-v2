import { describe, expect, it } from "vitest";
import { eggImages, eggNarration, eggPlan } from "../../supabase/functions/studio-render/eggs";

const words=eggNarration.split(" ").map((word,i)=>({word,start:i*.38,end:i*.38+.3}));
describe("egg-price sandbox timing",()=>{
  it("uses shelf, delivery, then receipt illustrations",()=>{
    expect(eggImages.map(url=>url.split('/').pop())).toEqual(['egg-shelf.png','egg-delivery.png','egg-receipts.png']);
  });
  it("cuts at delivery and receipt narration without gaps",()=>{
    const plan=eggPlan(words,29);
    expect(words.find(w=>w.start===plan.cuts[1])?.word).toBe('A');
    expect(words.find(w=>w.start===plan.cuts[2])?.word).toBe('Put');
    expect(plan.total).toBe(30);
  });
  it("reveals illustrative 3, 4, and positive 1-dollar difference in order on receipts",()=>{
    const plan=eggPlan(words,29);
    expect(plan.values).toEqual([3,4,1]);
    expect(plan.reveals[0]).toBe(plan.cuts[2]);
    expect(plan.reveals[1]).toBeGreaterThan(plan.reveals[0]);
    expect(plan.reveals[2]).toBeGreaterThan(plan.reveals[1]);
  });
});