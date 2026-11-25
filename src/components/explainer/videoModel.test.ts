import { describe, it, expect } from "vitest";
import { providerInput, VIDEO_MODELS } from "../../../supabase/functions/character-animation/contract";
describe("video model choice",()=>{
  it("offers exactly Pruna and LTX-2.5, with Seedance removed",()=>{
    expect(Object.keys(VIDEO_MODELS)).toEqual(["pruna","ltx"]);
    expect("seedance" in VIDEO_MODELS).toBe(false);
  });
  it("routes Pruna to prunaai/p-video with the draft preset",()=>{
    expect(VIDEO_MODELS.pruna.endpoint).toBe("prunaai/p-video");
    expect(providerInput("pruna",10,"https://x/i.png","walk")).toEqual({duration:10,resolution:"720p",fps:24,draft:true,save_audio:true,prompt_upsampling:false,disable_safety_filter:false,image:"https://x/i.png",prompt:"walk"});
  });
  it("routes LTX-2.5 to the owner's engine with the illustration as both frames",()=>{
    const i=providerInput("ltx",10,"https://x/i.png","walk");
    expect(i).toMatchObject({model_id:"ltx-2.5",duration_seconds:10,first_frame_url:"https://x/i.png",last_frame_url:"https://x/i.png",audio_enabled:true});
  });
  it("keeps Pruna as the default model",()=>{expect(VIDEO_MODELS.pruna.endpoint).toBe("prunaai/p-video");});
});

it("passes an approved ending image through to Pruna", () => {
  const input=providerInput("pruna",10,"https://frames.test/start.jpg","Sit and raise the mug","https://frames.test/end.jpg");
  expect(input).toMatchObject({image:"https://frames.test/start.jpg",last_frame_image:"https://frames.test/end.jpg"});
});
