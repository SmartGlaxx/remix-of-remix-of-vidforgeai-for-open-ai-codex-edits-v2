import { armArt, headArt, legArt, torsoArt } from "../../../supabase/functions/studio-render/design/daniel";

export type Gesture = "Explain" | "Wave" | "Point" | "Shrug";
export const gestures: Gesture[] = ["Explain","Wave","Point","Shrug"];
export type Beat = {line:string; action:Gesture};
export function direct(script:string): Beat[] {
  return (script.match(/[^.!?\n]+(?:[.!?]+|$)?/g) ?? []).map(s=>s.trim()).filter(Boolean).map((line,i)=>({
    line,action: /\?|perhaps|unsure/i.test(line) ? "Shrug" : /\d|look|notice|compare/i.test(line) ? "Point" : i===0 ? "Wave" : "Explain",
  }));
}
export function schedule(beats:Beat[],duration:number) {
  const weights=beats.map(b=>Math.max(1,b.line.trim().split(/\s+/).length));
  const total=weights.reduce((a,b)=>a+b,0);
  let start=0;
  return beats.map((beat,i)=>{
    const length=duration*weights[i]/total;
    const result={...beat,start,length};start+=length;return result;
  });
}
export function hostMarkup(action:Gesture, t:number) {
  const sway=Math.sin(t*3), breath=Math.sin(t*2);
  const shoulders=action==="Shrug" ? -9*(.5-.5*Math.cos(t*3)):0;
  const arm= action==="Wave" ? -146+8*sway : action==="Point" ? -78+2*sway : -21+12*sway;
  const elbow=action==="Wave" ? -12+20*Math.sin(t*6) : action==="Point" ? -12 : -25+9*sway;
  const pose=(x:number,y:number,part:string)=>'<g transform="translate('+x+' '+y+')">'+part+'</g>';
  return '<g stroke="#263234" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+
    pose(-17,-140,legArt(3,-6,"left"))+pose(17,-140,legArt(-3,6,"right"))+
    pose(-33,-250+breath+shoulders,armArt(12+5*sway+(action==="Shrug"?30:0),-8,action==="Shrug"?"open":"rest","left-arm"))+
    pose(0,-250+breath,torsoArt())+pose(0,-292+breath,'<g transform="rotate('+2*sway+')">'+headArt(action==="Point"?"thinking":"smile",action==="Point"?3:0)+'</g>')+
    pose(33,-250+breath+shoulders,armArt(arm,elbow,action==="Point"?"point":action==="Explain"?"rest":"open","right-arm"))+'</g>';
}
