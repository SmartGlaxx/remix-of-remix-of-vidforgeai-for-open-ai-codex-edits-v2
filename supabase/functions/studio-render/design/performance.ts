import type { Plan } from "../animation.ts";
import { walk, walkPose } from "../motion.ts";

export function performanceTimes(plan: Plan) {
  const entrance=walk(0,-160,380,.48), exit=walk(plan.narrationEnd+.4,380,1420,.34);
  return { entrance, exit, wave:entrance.duration+.25, shrug:plan.sceneStarts[2]+.3, finalWave:plan.narrationEnd-2.2 };
}
export function danielPose(plan: Plan,t:number) {
  const clamp=(v:number)=>Math.max(0,Math.min(1,v));
  const ease=(v:number)=>{const f=clamp(v);return f*f*(3-2*f)};
  const env=(a:number,hold:number)=>ease((t-a)/.4)*(1-ease((t-a-hold)/.4));
  const times=performanceTimes(plan), S=1.15;
  let x=380, feet: {x:number;lift:number}[] | undefined;
  for(const w of [times.entrance,times.exit]) {
    if(t<w.t0){if(w===times.entrance)x=w.xa;break;}
    if(t<=w.t0+w.duration){const pose=walkPose(w,t);x=pose.x;feet=pose.feet;break;}
    x=w.xb;
  }
  const bob=feet?2*Math.sin(t*Math.PI/.48)**2:0;
  const legs=[-17,17].map((hip,i)=>{
    const dx=feet?(feet[i].x-x)/S-hip:0, dy=140-(feet?.[i].lift??0)/S-bob;
    const r=Math.min(139.98,Math.hypot(dx,dy)), th=Math.atan2(-dx,dy)*180/Math.PI, a=Math.acos(r/140)*180/Math.PI;
    return {upper:th-a, lower:2*a};
  });
  let left=feet?legs[1].upper*.6:7, leftLower=-7, right=feet?legs[0].upper*.6:-7, rightLower=7;
  let hand:"rest"|"open"|"point"="rest", gaze=0, head=0, shoulders=0, smile=true;
  const cues=plan.cues;
  if(cues.length===4){
    const active=env(cues[0].start-.5,cues[3].end-cues[0].start+1.5);
    if(active>0){
      let k=0; for(let i=0;i<4;i++)if(t>=cues[i].start-.5)k=i;
      const angle=(i:number)=>{
        const bx=628+i*126, by=431-cues[i].value*1.55-25;
        return Math.atan2(-(bx-(x+34*S)),by-(553-252*S))*180/Math.PI;
      };
      const f=ease((t-(cues[k].start-.5))/.5), previous=k?angle(k-1):0;
      right=right*(1-active)+(previous+(angle(k)-previous)*f)*active;
      rightLower=-4-25*Math.sin(Math.PI*f)*(k?1:0); hand="point"; gaze=4*active;head=6*active;smile=false;
    }
  }
  for(const start of [times.wave,times.finalWave]) {
    const e=env(start,1.65);
    if(e>0){right=right*(1-e)-142*e;rightLower=-18+23*Math.sin(Math.max(0,t-start-.4)*Math.PI*4);hand="open";gaze=0;head=-3*e;smile=true;}
  }
  const shrug=env(times.shrug,1.25);
  if(shrug>0){left=40*shrug;leftLower=80*shrug;right=-40*shrug;rightLower=-80*shrug;shoulders=-12*shrug;hand="open";head=-3*shrug;smile=false;}
  return {x,scale:S,bob,legs,left,leftLower,right,rightLower,hand,gaze,head,shoulders,smile,walking:!!feet};
}