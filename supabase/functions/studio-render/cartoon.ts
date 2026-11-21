// Original artwork for the bank-counter scene. Coordinates are in the same
// 1280 × 720 stage as the proof host. Captions stay on the topmost layer.
import type { Plan } from "./animation.ts";

const banknote = '<rect x="-39" y="-20" width="78" height="40" rx="5" fill="#91d68b"/><path d="M-29 -8q8 0 8 -5h42q0 5 8 5v16q-8 0 -8 5h-42q0 -5 -8 -5Z" fill="#c9efab"/><ellipse rx="9" ry="12" fill="#5ba476"/>';

const bank = `<svg viewBox="0 0 1280 600" aria-hidden="true">
<rect width="1280" height="600" fill="#f9da95"/>
<path d="M0 0h1280v25H0z" fill="#e6ac6d"/>
<g fill="#b8e3de" stroke="#434450" stroke-width="6"><rect x="50" y="64" width="375" height="242" rx="24"/><path d="M235 65v241M50 187h375"/></g>
<path d="m67 168 88-88h66l-88 88zm200 117 103-103h36l-103 103z" fill="#fff5d8" opacity=".65"/>
<g stroke="#343044" stroke-width="6" stroke-linejoin="round">
<rect x="693" y="50" width="445" height="75" rx="14" fill="#315758"/>
<path d="m725 82 28-16 28 16zm4 18h48m-42-15v12m17-12v12m17-12v12" stroke="#fbe9bd" fill="#fbe9bd"/>
<g transform="translate(888 242)">
<g id="clerkHead"><path d="M-62 -24q-6-77 62-73 66 2 63 75l-13 36H-51z" fill="#483444"/>
<path d="M-43 -39q17 2 39-23 14 23 47 30v29q-2 45-42 48-42-2-44-48z" fill="#bb795c"/>
<g fill="#fff7e1"><circle cx="-22" cy="-10" r="15"/><circle cx="18" cy="-10" r="15"/><path d="M-7 -10h10"/></g>
<g fill="#353043" stroke="none"><circle cx="-26" cy="-9" r="5"/><circle cx="14" cy="-9" r="5"/></g>
<path id="clerkSmile" d="M-11 15q12 12 25-2" fill="none"/></g>
<path d="M-20 45 0 61l21-16q42 6 53 88H-76q9-78 56-88z" fill="#c15a47"/>
<path d="M-16 47 0 74l18-27" fill="#f9ddaa"/>
<g transform="translate(-48 74)"><g id="clerkArm"><path d="M0 0q-18 25-39 25l-50-7" fill="none" stroke-width="22" stroke="#343044"/><path d="M0 0q-18 25-39 25l-50-7" fill="none" stroke-width="14" stroke="#bb795c"/></g></g></g>
<path d="M560 365h720v235H585z" fill="#558d88"/><path d="M544 348h736v29H552z" fill="#ffe7ba"/>
<path d="M610 410h615v155H610z" fill="#70aaa2"/>
<g id="depositNote">${banknote}</g></g></svg>
<strong class="bankName">COMMUNITY BANK</strong>`;

function ledger(plan: Plan) {
  return `<div id="ledger"><div class="ledgerTop">SAVINGS PASSBOOK</div>
  <div class="ledgerHeading">Account balance</div>
  ${plan.cues.map((c,i)=>`<div class="ledgerRow" id="entry${i}"><span>${i ? 'Year '+i : 'Opening deposit'}</span><strong>$${c.value}</strong></div>`).join("")}
  </div>`;
}

export function cartoonLayer(plan: Plan) {
  // Use the first spoken deposit amount for the exchange, and the closing
  // "Time" for the final cut back to the people behind the numbers.
  const deposit = plan.words.find(w => w.word.toLowerCase().startsWith("hundred"));
  const closing = plan.words.find(w => w.start >= plan.sceneStarts[2] && w.word.toLowerCase() === "time");
  if (!deposit || !closing || plan.cues.length !== 4) throw new Error("Missing bank story cues.");
  return {
    background: `<div id="bankSet">${bank}</div>`,
    foreground: ledger(plan),
    css: `#bankSet{position:absolute;inset:0 0 auto;height:600px;z-index:0;overflow:hidden;color:#fff1cd}
#bankSet svg{width:100%;height:100%}.bankName{position:absolute;z-index:3;left:803px;top:73px;font:bold 27px sans-serif;letter-spacing:2px}
#ledger{position:absolute;z-index:2;left:530px;top:40px;width:610px;padding:32px 48px 42px;background:#fff4d9;border:6px solid #343044;border-radius:24px;box-shadow:13px 13px #d4aa78;transform:rotate(-2deg);color:#343044}
.ledgerTop{font:bold 17px sans-serif;letter-spacing:4px;color:#34756e}.ledgerHeading{font:bold 48px sans-serif;margin:12px 0 18px}.ledgerRow{display:flex;justify-content:space-between;align-items:center;height:69px;border-top:2px solid #cca982;font:26px sans-serif}.ledgerRow strong{color:#205e54;font:bold 36px sans-serif}`,
    js: `function drawBank(t){
      const inBank=t<P.scenes[1]||t>=P.scenes[2], close=t>=P.scenes[2]&&t<${closing.start};
      $("bankSet").style.display=inBank?"block":"none";
      $("ledger").style.display=close?"block":"none";
      const f=ease((t-${deposit.start})/1.3);
      const passing=inBank&&t>=${deposit.start}-.35&&f<1;
      $("depositNote").style.opacity=passing?1:0;
      set("depositNote","translate("+mix(386,751,f)+" "+(327-42*Math.sin(Math.PI*f))+") rotate("+mix(-12,3,f)+")");
      const nod=Math.sin(t*2)*2+Math.sin(Math.PI*f)*8;
      set("clerkHead","rotate("+nod+" 0 42)");
      rot("clerkArm",12-24*Math.sin(Math.PI*f)+2*Math.sin(t*2));
      if(passing){const reach=env(t,${deposit.start}-.35,.35,${deposit.start}+.65,.65);rot("rightArm",-66*reach);rot("rightArmLower",-20*reach)}
      if(close)for(let i=0;i<4;i++)$("entry"+i).style.opacity=ease((t-P.scenes[2]-i*.22)/.28);
    }`,
  };
}
