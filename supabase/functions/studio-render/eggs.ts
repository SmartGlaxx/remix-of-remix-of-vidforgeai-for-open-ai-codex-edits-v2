import type { Word } from "./timeline.ts";
import shelf from "./assets/egg-shelf.png.asset.json" with { type: "json" };
import delivery from "./assets/egg-delivery.png.asset.json" with { type: "json" };
import receipts from "./assets/egg-receipts.png.asset.json" with { type: "json" };

export const eggNarration = "Last week, a carton of eggs cost three dollars. This week, the same carton costs four. What changed? The shelf price alone can’t tell us. A store might pay more for its next delivery, or last week’s sale might simply have ended. Put the receipts side by side. They show exactly how much the price changed. To understand why, we need one more piece of information.";
export const eggImages = [shelf, delivery, receipts].map(asset => "https://framebound-story-forge.lovable.app" + asset.url);

export function eggPlan(words: Word[], seconds: number) {
  const cue = (phrase: string) => {
    const tokens = phrase.split(" ");
    const index = words.findIndex((_, i) => tokens.every((token, j) => words[i + j]?.word === token));
    if (index < 0) throw new Error("Missing egg narration cue: " + phrase);
    return words[index].start;
  };
  const cuts = [0, cue("A store might"), cue("Put the receipts")];
  const reveals = [cue("Put the receipts"), cue("They show exactly"), cue("how much the price changed.")];
  return { total: Math.max(30, seconds + 0.3), cuts, reveals, values: [3, 4, 4 - 3], words };
}

export function eggOverlay(plan: ReturnType<typeof eggPlan>) {
  return {
    type: "html5",
    html: '<main><h1>Why did my eggs cost more?</h1><section id="prices"><small>ILLUSTRATIVE EXAMPLE</small><div id="p0">Last week · $3.00</div><div id="p1">This week · $4.00</div><div id="p2">Difference · +$1.00</div></section><footer id="captions"></footer></main>',
    css: '*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;background:transparent;overflow:hidden;font-family:Arial,sans-serif}h1{position:absolute;left:70px;top:35px;margin:0;padding:18px 26px;font-size:44px;color:#ffffff;background:rgba(17,36,37,.94);border-radius:6px}#prices{position:absolute;right:70px;top:170px;width:600px;padding:28px 34px;background:rgba(17,36,37,.96);color:#ffffff;border-radius:6px;opacity:0}#prices small{font-size:24px;color:#c9d9d8}#prices div{font-size:46px;line-height:1.5;visibility:hidden}#p2{color:#ffd36c}footer{position:absolute;bottom:60px;left:100px;right:100px;height:90px;display:flex;justify-content:center;align-items:center}footer div{padding:17px 30px;background:rgba(17,36,37,.96);color:#ffffff;font-weight:bold;font-size:48px;border-radius:6px;white-space:nowrap}footer b{color:#ffd36c}',
    js: `const P=${JSON.stringify(plan)};const phrases=[];let phrase=[];P.words.forEach((w,i)=>{phrase.push(i);if(phrase.length===5||/[.,?!]$/.test(w.word)){phrases.push(phrase);phrase=[]}});if(phrase.length)phrases.push(phrase);
function render(t){document.getElementById('prices').style.opacity=t>=P.reveals[0]?1:0;P.reveals.forEach((at,i)=>document.getElementById('p'+i).style.visibility=t>=at?'visible':'hidden');const cap=document.getElementById('captions');cap.innerHTML='';for(let k=0;k<phrases.length;k++){const ids=phrases[k],next=phrases[k+1];if(t>=P.words[ids[0]].start&&t<(next?P.words[next[0]].start:P.words[ids[ids.length-1]].end+.3)){const line=document.createElement('div');ids.forEach((i,j)=>{const span=document.createElement(t>=P.words[i].start&&t<P.words[i].end?'b':'span');span.textContent=P.words[i].word+(j===ids.length-1?'':' ');line.appendChild(span)});cap.appendChild(line);break}}}
const clock={t:0};render(0);const tl=gsap.timeline();tl.to(clock,{t:P.total,duration:P.total,ease:'none',onUpdate:()=>render(clock.t)},0);`,
  };
}