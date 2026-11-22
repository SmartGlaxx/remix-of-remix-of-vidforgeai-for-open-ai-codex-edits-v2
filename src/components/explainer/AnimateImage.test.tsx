import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import AnimateImage, { restoreDraft, type AnimationJob } from "./AnimateImage";
import { PRESET, ESTIMATED_COST, canSave, imageError, ownsImage, shouldSubmit } from "../../../supabase/functions/character-animation/contract";
const invoke=vi.hoisted(()=>vi.fn());
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({user:{id:"owner"}})}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{functions:{invoke},storage:{from:vi.fn()}}}));
const saved:AnimationJob={id:"job",request_id:"req",prompt:"Turn and wave.",image_path:"owner/image.png",image_url:"https://example.test/image.png",video_url:"https://example.test/clip.mp4",state:"ready",error:null,prediction_id:"prediction-1",created_at:"2026-11-22T02:31:00Z"};
beforeEach(()=>{localStorage.clear();invoke.mockReset();invoke.mockResolvedValue({data:{jobs:[saved]},error:null});});
describe("image-animation rules",()=>{
  it("keeps the exact $0.05 10-second 720p/24fps Draft/audio preset",()=>{expect(PRESET).toEqual({duration:10,resolution:"720p",fps:24,draft:true,save_audio:true,prompt_upsampling:false,disable_safety_filter:false});expect(ESTIMATED_COST).toBe(10*0.005);});
  it("never starts another paid prediction for an existing uncertain attempt",()=>{expect(shouldSubmit({state:"checking",request_id:"same"})).toBe(false);expect(shouldSubmit(null)).toBe(true);});
  it("rejects another owner's image and path traversal",()=>{expect(ownsImage("owner","other/image.png")).toBe(false);expect(ownsImage("owner","owner/../other/image.png")).toBe(false);expect(ownsImage("owner","owner/image.png")).toBe(true);});
  it("limits images to supported formats and 10 MB",()=>{expect(imageError("image/gif",100)).not.toBe("");expect(imageError("image/png",10*1024*1024+1)).not.toBe("");expect(imageError("image/webp",100)).toBe("");});
  it("retries saving the same prediction rather than generating again",()=>{const failed={state:"save_failed",prediction_id:"prediction-1",output_url:"https://replicate.delivery/video.mp4"};expect(canSave(failed)).toBe(true);expect(shouldSubmit(failed)).toBe(false);expect(canSave({...failed,state:"ready"})).toBe(false);});
  it("restores original inputs from the latest saved attempt",()=>{expect(restoreDraft([saved])).toEqual({prompt:"Turn and wave.",path:"owner/image.png",image:"https://example.test/image.png"});});
  it("restores a saved clip and direction after remount without submitting",async()=>{const first=render(<AnimateImage/>);await waitFor(()=>expect(screen.getByLabelText("What should happen?")).toHaveValue(saved.prompt));expect(screen.getByLabelText("Generated character clip")).toHaveAttribute("src",saved.video_url);first.unmount();render(<AnimateImage/>);await waitFor(()=>expect(screen.getByLabelText("Generated character clip")).toHaveAttribute("src",saved.video_url));expect(invoke.mock.calls.every(([name,args])=>name==="character-animation"&&args.body.action==="list")).toBe(true);});
  it("save recovery invokes status for the existing job",async()=>{invoke.mockResolvedValueOnce({data:{jobs:[{...saved,state:"save_failed",video_url:null}]},error:null}).mockResolvedValue({data:{job:saved},error:null});render(<AnimateImage/>);fireEvent.click(await screen.findByRole("button",{name:"Retry saving video"}));await waitFor(()=>expect(invoke).toHaveBeenCalledWith("character-animation",{body:{action:"status",id:"job"}}));expect(invoke.mock.calls.some(([,args])=>args.body.action==="submit")).toBe(false);});
});