import type { Plan } from "./animation.ts";
import { daniel, armArt, handArt, headArt, legArt, torsoArt } from "./design/daniel.ts";
import { teachingSpace } from "./design/teachingSpace.ts";
import { danielPose, performanceTimes } from "./design/performance.ts";
import { walk, walkPose } from "./motion.ts";

export interface Loudness {start:number;step:number;values:number[]}
// Both local previews and Shotstack receive this exact artwork and deterministic clock.
export function danielAnimation(plan:Plan,loudness:Loudness[]=[]) {
  const values=plan.cues.map((cue,i)=>`<div class="col" style="left:${587+i*126}px"><strong id="v${i}"></strong><div id="bar${i}" class="bar" style="height:${cue.value*1.55}px;background:${["#EAB64B","#E88F7A","#61B49B","#70A9D0"][i]}"></div><small>${i?"Year "+i:"Start"}</small></div>`).join("");
  const room=teachingSpace.svg.replace(/<g data-background-part="chart-board">[\s\S]*?<\/g>/,"");
  return {type:"html5",html:`<main id="stage"><svg viewBox="0 0 1280 720" width="1280" height="720">${room}<g id="panel"><rect x="533" y="113" width="583" height="389" rx="9" fill="#FFF" stroke="#607D73" stroke-width="4"/></g><g id="daniel"></g></svg><section id="chart"><header>Interest earns interest</header>${values}</section><div id="icon">↗<span>Interest</span></div><footer id="captions"></footer></main>`,
  css:`*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;overflow:hidden;font-family:Arial,sans-serif;background:#EEF3F2}#stage{width:1280px;height:720px;transform:scale(1.5);transform-origin:top left;position:relative}svg{position:absolute}#chart{position:absolute;inset:0;pointer-events:none}#chart header{position:absolute;left:572px;top:132px;font-size:26px;font-weight:bold;color:#263234}.col{position:absolute;top:431px;width:85px;text-align:center;color:#263234}.bar{position:absolute;bottom:0;width:85px;border:3px solid #263234;transform-origin:bottom}.col strong{position:absolute;bottom:0;left:-8px;width:101px;font-size:27px}.col small{position:absolute;top:12px;left:-8px;width:101px;font-size:21px}footer{position:absolute;left:130px;right:130px;top:625px;height:64px;display:flex;justify-content:center;align-items:center}footer div{background:#263234;color:#FFF;padding:10px 24px;border-radius:8px;font-size:34px;font-weight:bold}footer b{color:#EAB64B}#icon{position:absolute;left:726px;top:224px;width:190px;height:190px;background:#C2E9DA;border:4px solid #263234;border-radius:50%;color:#368867;text-align:center;font-size:115px;font-weight:bold}#icon span{display:block;color:#263234;font-size:27px;margin-top:8px}`,
  js:`const P=${JSON.stringify(plan)},L=${JSON.stringify(loudness)},c=${JSON.stringify(daniel.colours)};
const walk=${walk.toString()},walkPose=${walkPose.toString()},performanceTimes=${performanceTimes.toString()},danielPose=${danielPose.toString()};
const handArt=${handArt.toString()},headArt=${headArt.toString()},torsoArt=${torsoArt.toString()},armArt=${armArt.toString()},legArt=${legArt.toString()};
const $=id=>document.getElementById(id),e=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v)};
const phrases=[];let phrase=[];P.words.forEach((w,i)=>{phrase.push(i);if(phrase.length===4||/[.,?!—]$/.test(w.word)){phrases.push(phrase);phrase=[]}});if(phrase.length)phrases.push(phrase);
function render(t){
const p=danielPose(P,t),leg=(i,hip)=>'<g transform="translate('+hip+' '+(-150+p.bob)+')">'+legArt(p.legs[i].upper,p.legs[i].lower,i?'right-leg':'left-leg')+'</g>';
let amplitude=0;for(const l of L){const i=Math.floor((t-l.start)/l.step);if(i>=0&&i<l.values.length)amplitude=l.values[i]}
const face=headArt(p.smile?'smile':'thinking',p.gaze).replace('data-part="mouth"','data-part="mouth" transform="translate(0 8) scale(1 '+(1+amplitude*1.8)+') translate(0 -8)"');
$('daniel').innerHTML='<g transform="translate('+p.x+' 553) scale('+p.scale+')" stroke="'+c.ink+'" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+leg(0,-17)+leg(1,17)+'<g transform="translate(-34 '+(-262+p.bob+p.shoulders)+')">'+armArt(p.left,p.leftLower,p.shoulders?'open':'rest','left-arm')+'</g><g transform="translate(0 '+(-262+p.bob)+')">'+torsoArt()+'</g><g transform="translate('+p.gaze+' '+(-302+p.bob)+') rotate('+p.head+')">'+face+'</g><g transform="translate(34 '+(-262+p.bob+p.shoulders)+')">'+armArt(p.right,p.rightLower,p.hand,'right-arm')+'</g></g>';
const visible=t>=P.sceneStarts[1]?1-e((t-P.sceneStarts[2])/.8):0;
$('panel').style.opacity=visible;$('chart').style.opacity=visible;
$('icon').style.opacity=t>=P.sceneStarts[1]&&t<P.sceneStarts[1]+2?1:0;
P.cues.forEach((q,i)=>{const g=e((t-q.start)/.9),h=q.value*1.55;const bar=$('bar'+i);bar.style.transform='scaleY('+g+')';bar.style.opacity=t<P.sceneStarts[1]+2?0:1;const v=$('v'+i);v.textContent=g>0?'$'+Math.round(q.value*g):'';v.style.bottom=(h*g+12)+'px';});
let caption='';for(const indices of phrases){const first=P.words[indices[0]],last=P.words[indices[indices.length-1]];if(t>=first.start&&t<=last.end+.18){caption='<div>'+indices.map(i=>{const w=P.words[i];return t>=w.start&&t<=w.end?'<b>'+w.word+'</b>':w.word}).join(' ')+'</div>';break}}$('captions').innerHTML=caption;
}
const clock={t:0};const tl=gsap.timeline();render(0);tl.to(clock,{t:P.total,duration:P.total,ease:'none',onUpdate:()=>render(clock.t)},0);`};
}