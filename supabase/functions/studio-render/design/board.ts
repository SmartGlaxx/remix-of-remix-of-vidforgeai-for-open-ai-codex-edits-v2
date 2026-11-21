import { daniel } from "./daniel.ts";
import { danielArtwork } from "./actions.ts";
import { teachingSpace } from "./teachingSpace.ts";

// Version-pinned review scene; narration/cues will be resolved from the saved recording after approval.
export const reviewScene = {
  id: "compound-interest-art-review", character: { id:daniel.id, version:daniel.version },
  background: {id:teachingSpace.id, version:teachingSpace.version},
  actions: [{name:"walk",cue:"entrance"},{name:"wave",cue:"greeting"},{name:"point",cue:"chart-amounts"},{name:"shrug",cue:"takeaway"}],
  expression:"thinking", narration:{id:"compound-interest",revision:"existing-saved-audio"},
  timingCues:"existing-elevenlabs-alignment", review:"pending-owner-approval",
};

function text(x:number,y:number,label:string,size=28,colour="#263234",weight=500) {
  return `<text x="${x}" y="${y}" fill="${colour}" font-family="DejaVu Sans,sans-serif" font-size="${size}" font-weight="${weight}">${label}</text>`;
}
export function reviewChart() {
  const values=[100,110,121,133], colours=["#EAB64B","#E88F7A","#61B49B","#70A9D0"];
  return `<g>${text(572,159,"Interest earns interest",26,"#263234",700)}${values.map((v,i)=>{
    const x=587+i*126,h=v*1.55,y=431-h;
    return `<rect x="${x}" y="${y}" width="85" height="${h}" rx="3" fill="${colours[i]}" stroke="#263234" stroke-width="3"/>${text(x+9,y-16,"$"+v,27,"#263234",700)}${text(x+6,465,i?"Year "+i:"Start",21)}`;
  }).join("")}<path d="M571 431H1083" stroke="#263234" stroke-width="3"/></g>`;
}
export function teachingSceneSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1280 720">${teachingSpace.svg}${reviewChart()}<g transform="translate(380 553) scale(1.15)">${danielArtwork("point")}</g><rect x="195" y="625" width="890" height="64" rx="8" fill="#263234"/><text x="640" y="668" text-anchor="middle" fill="#FFFFFF" font-family="DejaVu Sans,sans-serif" font-size="34" font-weight="600">The money <tspan fill="#EAB64B" font-weight="800">earns</tspan> money.</text></svg>`;
}
export function designBoardSvg() {
  const poses = (["stand","walk","wave","point"] as const).map((action,i)=>{
    const x=i%2?1080:420,y=i<2?936:1736;
    const labels={stand:"01  /  Natural rest",walk:"02  /  Walking stride",wave:"03  /  Open-hand wave",point:"04  /  Chart-directed point"};
    return `<path d="M${x-200} ${y}H${x+200}" stroke="#C1D1CA" stroke-width="3"/><g transform="translate(${x} ${y}) scale(1.35)">${danielArtwork(action)}</g>${text(x-220,y+82,labels[action],28,"#263234",700)}`;
  }).join("");
  const scene=teachingSceneSvg().replace(/<svg[^>]*>/,"<svg x=\"1632\" y=\"460\" width=\"2048\" height=\"1152\" viewBox=\"0 0 1280 720\">");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="3840" height="2160" viewBox="0 0 3840 2160"><rect width="3840" height="2160" fill="#FFFFFF"/>
  <rect x="0" y="0" width="3840" height="18" fill="#378BCC"/>
  ${text(140,128,"CAPSCIFY",46,"#263234",800)}${text(140,222,"Daniel / character &amp; teaching space",64,"#263234",700)}
  ${text(140,289,"PHASE 0   ·   ORIGINAL ARTWORK   ·   DESIGN REVIEW 01",26,"#607D73",600)}
  <path d="M1530 360V1920" stroke="#D9E5E1" stroke-width="2"/>
  ${text(170,400,"ONE CHARACTER. FOUR READABLE POSES.",28,"#607D73",700)}${poses}
  ${text(1632,400,"FINISHED SCENE  /  16:9 TEACHING SPACE",28,"#607D73",700)}${scene}
  ${text(1632,1690,"A calm room. A clear host. One visual lesson.",39,"#263234",700)}
  ${text(1632,1750,"Large glasses and expressive eyes · distinct hands · grounded shoes",27,"#607D73")}
  ${text(1632,1800,"Chart values and captions occupy separate, phone-readable zones.",27,"#607D73")}
  ${text(170,1945,"Daniel · young East Asian teacher · short dark hair · blue shirt",29,"#263234",600)}
  ${text(170,1995,"Beige chinos · brown shoes · same layered parts in every pose",27,"#607D73")}
  <path d="M140 2050H3700" stroke="#D9E5E1" stroke-width="2"/>
  ${text(140,2105,"LIKENESS PENDING YOUR REVIEW — BASED ON THE WRITTEN DESCRIPTION, NOT A SUPPLIED DANIEL SHEET.",24,"#607D73",600)}
  ${text(1632,1900,"Static art review only. Walking and gesture timing are not yet verified.",24,"#607D73")}</svg>`;
}