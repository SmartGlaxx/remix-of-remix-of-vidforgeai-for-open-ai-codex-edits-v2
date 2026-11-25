import { planCharacterFilm, stitchInputs } from "./characterFilmPlan.ts";
export type FilmDirection = {index:number; chapter:number; duration:number; line:string; purpose:string; visual:string; action:string; transition:"cut"|"continue"; image_path:string};
export type Assembly = {key:string; indices:number[]; state:string; job_id?:string; video_path?:string; error?:string; output_url?:string};
export function narrationSeconds(script:string) { return script.trim().split(/\s+/).filter(Boolean).length / 2.5; }
export function narrationMismatch(script:string, seconds:number) { return Math.abs(narrationSeconds(script)-seconds)>seconds*0.25; }
export function draftDirections(script:string, seconds:number, image_path=""):FilmDirection[] {
  const plan=planCharacterFilm(seconds);
  const words=script.trim().split(/\s+/).filter(Boolean);
  return plan.chapters.flatMap(c=>c.shots.map(s=>{
    const line=words.slice(Math.floor(s.index*words.length/plan.shotCount),Math.floor((s.index+1)*words.length/plan.shotCount)).join(" ");
    return {...s,chapter:c.chapterIndex,line,purpose:s.index===0?"Introduce the idea":s.index===plan.shotCount-1?"Resolve the story":"Develop the next idea",visual:`Same character, face, hairstyle, clothing and palette in the reference scene. Shot ${s.index+1}: ${line}`,action:s.index===0?"Look toward the viewer, then gesture to the main subject":s.index===plan.shotCount-1?"Complete the demonstration and return attention to the viewer":`Demonstrate this idea with a distinct physical gesture: ${line}`,transition:s.index===0?"cut" as const:"continue" as const,image_path};
  }));
}
export function readyShots(shots:{index:number; state:string; transition:string}[],limit=2) {
  const active=shots.filter(s=>["submitting","checking","queued","generating","saving"].includes(s.state)).length;
  return shots.filter(s=>s.state==="pending"&&(s.transition!=="continue"||shots.find(p=>p.index===s.index-1)?.state==="ready")).slice(0,Math.max(0,limit-active));
}
export function assemblies(seconds:number):Assembly[] {
  return planCharacterFilm(seconds).chapters.map(c=>({key:`chapter-${c.chapterIndex}`,indices:c.shots.map(s=>s.index),state:"pending"}));
}
export function orderedInputs(a:Assembly, saved:ReadonlyMap<number,string>) { return stitchInputs(a.indices,saved); }
export const SAMPLE_SCRIPT="A small habit can change your whole day. Daniel puts his phone aside and opens a notebook. Instead of trying to do everything, he writes down one useful task. He takes a breath, starts with the first step, and finishes it before reaching for his phone again. One clear choice creates momentum. Tomorrow, he can repeat the same simple routine and build on the progress he made today.";