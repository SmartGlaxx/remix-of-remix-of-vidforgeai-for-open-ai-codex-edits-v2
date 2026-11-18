import type { chartCues } from "./narration.ts";

// Both limbs use the same joint geometry, mirrored by the starting pose.
function limb(id: string, leg: boolean) {
  const length = leg ? 55 : 38;
  const colour = leg ? "#244466" : "#bf7959";
  const segment = '<path d="M0 0 L0 '+length+'" stroke="#222c38" stroke-width="25"/><path d="M0 0 L0 '+length+'" stroke="'+colour+'" stroke-width="18"/>';
  const tip = leg ? '<path d="M-10 0 Q0 -8 12 -2 L23 6 Q24 12 13 12 H-10Z" fill="#ffca53"/>' : '<ellipse rx="11" ry="14" fill="#bf7959"/>';
  return '<g id="'+id+'">'+segment+'<g transform="translate(0 '+length+')"><g id="'+id+'Lower">'+segment+'<g transform="translate(0 '+length+')"><g id="'+id+'Tip">'+tip+'</g></g></g></g></g>';
}

const host = `<g id="host"><g transform="translate(255 352)"><g id="body">
<g transform="translate(-17 53)">${limb("leftLeg",true)}</g><g transform="translate(17 53)">${limb("rightLeg",true)}</g>
<g transform="translate(-35 -24)">${limb("leftArm",false)}</g>
<path fill="#12aa96" d="M-37 -33Q0 -54 36 -32L32 57Q0 68 -32 55Z"/><path d="M-16 -37L0 -22 16 -38" fill="#ffe19c"/>
<g id="head"><rect x="-28" y="-115" width="59" height="81" rx="27" fill="#bd7958"/>
<path d="M-30 -80Q-46 -102 -31 -118Q-39 -138 -18 -137Q-6 -151 6 -139Q32 -148 36 -124Q50 -106 28 -89L24 -110Q-1 -97 -21 -105L-23 -83Z" fill="#343043"/>
<g id="face"><ellipse cx="-10" cy="-82" rx="3" ry="5"/><ellipse cx="17" cy="-82" rx="3" ry="5"/><path id="brow" d="M6 -92l15 -2" fill="none"/><path id="mouth" d="M-7 -58 Q4 -53 14 -60" fill="none"/></g></g>
<g transform="translate(35 -25)">${limb("rightArm",false)}</g></g></g></g>`;

export function animation(scene:number, duration:number, cues:ReturnType<typeof chartCues>) {
  const bars = cues.map((cue,i)=>`<div class="column"><span id="value${i}"></span><div id="bar${i}" class="bar" style="height:${cue.value*2.2}px;background:${["#ffbb48","#f47e6f","#35b6a0","#8293eb"][i]}"></div><small>${["Start","Year 1","Year 2","Year 3"][i]}</small></div>`).join("");
  return {type:"html5",html:`<svg width="1280" height="720" viewBox="0 0 1280 720"><path d="M0 530H1280" stroke="#b5ab93" stroke-width="4"/><g fill="#252d39" stroke="#252d39" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${host}</g></svg><section>${bars}</section>`,
    css:`*{box-sizing:border-box}html,body{margin:0;width:1280px;height:720px;overflow:hidden;background:#fff3d7}section{position:absolute;left:490px;top:115px;width:710px;height:415px;display:flex;align-items:flex-end;justify-content:space-between}.column{width:145px;text-align:center;font:bold 36px sans-serif}.bar{width:100%;border:4px solid #252d39;border-radius:12px 12px 0 0}.column small{position:absolute;display:block;width:145px;font:24px sans-serif;margin-top:8px}`,
    js:`const tl=gsap.timeline(), d=${duration}, scene=${scene}, cues=${JSON.stringify(cues)};
    const joint=(name,angle,time,length)=>tl.to("#"+name,{rotation:angle,transformOrigin:"0px 0px",duration:length,ease:"sine.inOut"},time);
    function idle(t,end){for(let s=t;s<end;s+=1.4)tl.to("#body",{y:s%2?2:-2,duration:Math.min(1.4,end-s),ease:"sine.inOut"},s)}
    function walk(t,len,from,to){const step=len/10;tl.fromTo("#host",{x:from},{x:to,duration:len,ease:"none"},t);for(let k=0;k<10;k++){const a=t+k*step;for(const [i,side] of ["left","right"].entries()){const f=(k+i)%2===0; joint(side+"Leg",f?22:-22,a,step);joint(side+"LegLower",f?-35:0,a,step);joint(side+"Arm",f?-21:21,a,step)}tl.to("#body",{y:-4,duration:step/2,yoyo:true,repeat:1},a)}for(const side of ["left","right"]){for(const part of ["Leg","LegLower","Arm"])joint(side+part,0,t+len,.22)}}
    function wave(t){joint("rightArm",-126,t,.36);joint("rightArmLower",-28,t,.36);for(let k=0;k<4;k++)joint("rightArmLower",k%2?-21:-57,t+.36+k*.23,.23);joint("rightArm",0,t+1.4,.45);joint("rightArmLower",0,t+1.4,.45);tl.to("#face",{x:3,duration:.4},t);tl.to("#mouth",{scaleY:1.8,transformOrigin:"center",duration:.3},t)}
    function shrug(t){for(const [i,side] of ["left","right"].entries()){joint(side+"Arm",i?-42:42,t,.4);joint(side+"ArmLower",i?-76:76,t,.45);joint(side+"ArmTip",i?-55:55,t,.4);for(const p of ["Arm","ArmLower","ArmTip"])joint(side+p,0,t+1.1,.45)}}
    function point(t){joint("rightArm",-77,Math.max(0,t-.45),.45);joint("rightArmLower",-12,Math.max(0,t-.45),.45);tl.to("#face",{x:6,duration:.4},0);joint("brow",-7,0,.3)}
    if(scene===0){walk(0,3.6,-410,0);wave(4);idle(6,d)}
    if(scene===1){idle(0,d);point(cues[0].start);cues.forEach((c,i)=>{const len=Math.max(.12,c.end-c.start);tl.fromTo("#bar"+i,{scaleY:0},{scaleY:1,transformOrigin:"bottom",duration:len},c.start);const n={v:0};tl.to(n,{v:c.value,duration:len,onUpdate:()=>document.querySelector("#value"+i).textContent="$"+Math.round(n.v)},c.start)});joint("rightArm",0,cues[3].end,.5)}
    if(scene===2){tl.set("section span",{textContent:""},0);cues.forEach((c,i)=>tl.set("#value"+i,{textContent:"$"+c.value},0));tl.to("section",{opacity:0,duration:1.5},0);shrug(.2);wave(2);idle(4,d-4);walk(d-4,3.7,0,1170)}`};
}
