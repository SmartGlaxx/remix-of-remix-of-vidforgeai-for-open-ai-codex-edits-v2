import { describe, it, expect } from "vitest";
import { providerInput, VIDEO_MODELS } from "../../../supabase/functions/character-animation/contract";
describe("video model choice",()=>{
  it("routes Seedance to bytedance/seedance-2.0-mini with only its own fields",()=>{
    expect(VIDEO_MODELS.seedance.endpoint).toBe("bytedance/seedance-2.0-mini");
    expect(providerInput("seedance",10,"https://x/i.png","walk")).toEqual({duration:10,resolution:"720p",aspect_ratio:"16:9",generate_audio:true,image:"https://x/i.png",prompt:"walk"});
  });
  it("keeps Pruna as the default endpoint",()=>{expect(VIDEO_MODELS.pruna.endpoint).toBe("prunaai/p-video");});
});
