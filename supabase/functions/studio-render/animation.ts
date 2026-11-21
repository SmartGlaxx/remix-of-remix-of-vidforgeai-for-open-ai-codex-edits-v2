import type { Cue, Word } from "./timeline.ts";
import { walk, walkPose } from "./motion.ts";

// Host is drawn with the shoe soles at local y=0 so the whole group sits on the floor.
function limb(id: string, leg: boolean) {
  const length = leg ? 60 : 38, colour = leg ? "#244466" : "#bf7959";
  const seg = '<path d="M0 0 L0 '+length+'" stroke="#222c38" stroke-width="25"/><path d="M0 0 L0 '+length+'" stroke="'+colour+'" stroke-width="18"/>';
  const tip = leg ? '<path d="M-10 0 Q0 -8 12 -2 L23 6 Q24 12 13 12 H-10Z" fill="#ffca53"/>'
    : '<ellipse rx="11" ry="14" fill="#bf7959"/>'+(id==="rightArm"?'<path id="finger" d="M0 8 L0 30" stroke="#bf7959" stroke-width="9" opacity="0"/>':"");
  return '<g id="'+id+'">'+seg+'<g transform="translate(0 '+length+')"><g id="'+id+'Lower">'+seg+'<g transform="translate(0 '+length+')"><g id="'+id+'Tip">'+tip+'</g></g></g></g></g>';
}
const shoulder = (id: string, x: number, y: number, arm: string) =>
  `<g id="${id}"><g transform="translate(${x} ${y})">${limb(arm,false)}</g><circle cx="${x}" cy="${y}" r="15" fill="#12aa96"/></g>`;

const host = `<g id="host"><g id="hostScale"><g id="body" transform="translate(0 -173)">
<g transform="translate(-17 53)">${limb("leftLeg",true)}</g><g transform="translate(17 53)">${limb("rightLeg",true)}</g>
${shoulder("shL",-35,-24,"leftArm")}
<g id="torso"><path fill="#12aa96" d="M-37 -33Q0 -54 36 -32L32 57Q0 68 -32 55Z"/><path d="M-16 -37L0 -22 16 -38" fill="#ffe19c"/></g>
<g id="head"><rect x="-28" y="-115" width="59" height="81" rx="27" fill="#bd7958"/>
<path d="M-30 -80Q-46 -102 -31 -118Q-39 -138 -18 -137Q-6 -151 6 -139Q32 -148 36 -124Q50 -106 28 -89L24 -110Q-1 -97 -21 -105L-23 -83Z" fill="#343043"/>
<g id="face"><ellipse cx="-10" cy="-82" rx="3" ry="5"/><ellipse cx="17" cy="-82" rx="3" ry="5"/><path id="brow" d="M-16 -94l12 -1M10 -95l13 1" fill="none"/><path id="mouth" d="M-7 -58 Q4 -53 14 -60" fill="none"/></g></g>
${shoulder("shR",35,-25,"rightArm")}</g></g></g>`;

export interface Plan { total: number; words: Word[]; cues: Cue[]; sceneStarts: number[]; narrationEnd: number }

export function animation(plan: Plan, layer?: {background: string; foreground: string; css: string; js: string}) {
  const colours = ["#ffbb48","#f47e6f","#35b6a0","#8293eb"], labels = ["Start","Year 1","Year 2","Year 3"];
  const bars = plan.cues.map((c,i)=>`<div class="col" style="left:${600+i*160}px"><span id="value${i}"></span><div id="bar${i}" class="bar" style="height:${Math.round(c.value*2.55)}px;background:${colours[i]}"><small>${labels[i]}</small></div></div>`).join("");
  const data = JSON.stringify({ total: plan.total, words: plan.words, cues: plan.cues, scenes: plan.sceneStarts, end: plan.narrationEnd });
  return { type: "html5",
    html: `<main id="stage">${layer?.background ?? ""}<svg width="1280" height="720" viewBox="0 0 1280 720"><rect y="600" width="1280" height="120" fill="#f3e2bd"/><path d="M0 600H1280" stroke="#b5ab93" stroke-width="4"/><g fill="#252d39" stroke="#252d39" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${host}</g></svg><section id="chart">${bars}</section>${layer?.foreground ?? ""}<div id="cap"></div></main>`,
    css: `*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#fff3d7;font-family:sans-serif}#stage{position:absolute;width:1280px;height:720px;transform:scale(1.5);transform-origin:top left}svg{position:absolute;left:0;top:0;z-index:2}
#chart{position:absolute;left:0;top:0;width:1280px;height:600px;z-index:1}.col{position:absolute;bottom:0;width:120px;text-align:center;font:bold 38px sans-serif;color:#252d39}
.bar{width:120px;border:4px solid #252d39;border-bottom:none;border-radius:14px 14px 0 0;transform-origin:bottom;position:relative}.bar small{position:absolute;left:0;right:0;bottom:12px;font:bold 22px sans-serif}
#cap{position:absolute;left:140px;right:140px;top:622px;height:72px;z-index:3;display:flex;align-items:center;justify-content:center}
#cap div{background:rgba(37,45,57,.92);color:#fff;font:bold 34px sans-serif;padding:10px 26px;border-radius:16px;white-space:nowrap}#cap b{color:#ffca53}${layer?.css ?? ""}`,
    js: `const P=${data}, S=1.65, HOME=290, R=Math.PI/180, $=id=>document.getElementById(id);
const ease=f=>f<0?0:f>1?1:f*f*(3-2*f), env=(t,a,up,b,down)=>t<a||t>b+down?0:t<a+up?ease((t-a)/up):t<=b?1:1-ease((t-b)/down), mix=(a,b,k)=>a+(b-a)*k;
const set=(id,v)=>$(id).setAttribute("transform",v), rot=(id,a)=>set(id,"rotate("+a.toFixed(2)+")");
const walk=${walk.toString()}, walkPose=${walkPose.toString()};
const W=[walk(0,-170,HOME,.36),walk(P.end+.4,HOME,1400,.34)];
function ik(dx,dy){const r=Math.min(Math.hypot(dx,dy),119.5),th=Math.atan2(-dx,dy)/R,a=Math.acos(r/120)/R;return{th,t1:th-a,k:2*a}}
const phrases=[];{let cur=[];P.words.forEach((w,i)=>{cur.push(i);if(cur.length>=4||/[.,?!—]$/.test(w.word)){phrases.push(cur);cur=[]}});if(cur.length)phrases.push(cur)}
let lastCap="";
${layer?.js ?? ""}
function render(t){
 let x=HOME,feet=null;
 for(const w of W){if(t<w.t0){x=w===W[0]?w.xa:x;break}if(t<=w.t0+w.duration){const p=walkPose(w,t);x=p.x;feet=p.feet;break}x=w.xb}
 if(t<W[0].t0)x=W[0].xa;
 set("host","translate("+x.toFixed(2)+" 600) scale("+S+")");set("body","translate(0 -173)");
 const legs=["left","right"].map((side,i)=>{const hip=i?17:-17,foot=feet?feet[i]:{x:x+hip*S,lift:0};const g=ik((foot.x-x)/S-hip,108-foot.lift/S);rot(side+"Leg",g.t1);rot(side+"LegLower",g.k);rot(side+"LegTip",-(g.t1+g.k));return g.th});
 // arms: walking swing (opposite arm to leg)
 let la=feet?legs[1]*1.1:0,ll=feet?-12:-6,ra=feet?legs[0]*1.1:0,rl=feet?-12:-6,finger=0,sh=0,headY=0,lean=0,brow=0;
 // pointing: one reach per bar, elbow bends between reaches
 const c=P.cues;if(c.length){const pe=env(t,c[0].start-.5,.5,c[3].end+.9,.5);if(pe>0){let k=0;for(let i=0;i<4;i++)if(t>=c[i].start-.5)k=i;
  const ang=i=>{const bx=660+i*160,by=600-c[i].value*2.55-30,sx=x+35*S,sy=600-198*S;return Math.atan2(-(bx-sx),by-sy)/R};
  const f=Math.min(1,Math.max(0,(t-(c[k].start-.5))/.5)),from=k?ang(k-1):0,to=ang(k),a=mix(from,to,ease(f));
  ra=mix(ra,a,pe);rl=mix(rl,-4-55*Math.sin(Math.PI*f)*(k?1:0),pe);finger=pe;lean=pe*(3+k*2);brow=pe*-3}}
 // two-part wave: raise, then forearm waggle
 for(const w0 of [W[0].t0+W[0].duration+.2,P.end-1.9]){const e=env(t,w0,.35,w0+1.5,.4);if(e>0){ra=mix(ra,-135,e);rl=mix(rl,-35+(t>w0+.35?30*Math.sin((t-w0-.35)*2*Math.PI*2.4):0),e);brow=mix(brow,-4,e)}}
 // shrug: shoulders rise, elbows out, palms up
 {const s0=P.scenes[2]+.3,e=env(t,s0,.35,s0+.9,.45);if(e>0){sh=-15*e;headY=5*e;la=mix(la,38,e);ll=mix(ll,85,e);ra=mix(ra,-38,e);rl=mix(rl,-85,e);brow=-6*e}}
 set("shL","translate(0 "+sh+")");set("shR","translate(0 "+sh+")");set("head","translate(0 "+headY+")");set("torso","rotate("+lean+")");
 rot("leftArm",la);rot("leftArmLower",ll);rot("rightArm",ra);rot("rightArmLower",rl);$("finger").setAttribute("opacity",finger);
 $("brow").setAttribute("transform","translate(0 "+brow+")");
 const talking=P.words.some(w=>t>=w.start&&t<=w.end);$("mouth").setAttribute("transform","translate(4 -57) scale(1 "+(talking?1.4+.8*Math.abs(Math.sin(t*18)):1)+") translate(-4 57)");
 ${layer ? "drawBank(t);" : ""}
 // chart
 const ch=t<P.scenes[1]?0:t<P.scenes[1]+.5?(t-P.scenes[1])/.5:1-ease((t-P.scenes[2]-.2)/1);$("chart").style.opacity=Math.max(0,ch);
 c.forEach((q,i)=>{const g=ease((t-q.start)/.9);$("bar"+i).style.transform="scaleY("+g+")";$("value"+i).textContent=g>0?"$"+Math.round(q.value*g):""});
 // captions: short phrase, current word highlighted
 let html="";for(let p=0;p<phrases.length;p++){const ws=phrases[p],s=P.words[ws[0]].start,e=P.words[ws[ws.length-1]].end,next=phrases[p+1]?P.words[phrases[p+1][0]].start:1e9;
  if(t>=s-.05&&t<Math.min(next-.05,e+.8)){let cur=ws[0];ws.forEach(i=>{if(t>=P.words[i].start-.03)cur=i});html="<div>"+ws.map(i=>i===cur?"<b>"+P.words[i].word+"</b>":P.words[i].word).join(" ")+"</div>";break}}
 if(html!==lastCap){$("cap").innerHTML=html;lastCap=html}
}
const tl=gsap.timeline(),clock={t:0};render(0);tl.to(clock,{t:P.total,duration:P.total,ease:"none",onUpdate:()=>render(clock.t)},0);`};
}
