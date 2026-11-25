export type StoryFormat = "illustrated" | "whiteboard" | "comic";

export const artDirections = {
  illustrated: "Editorial narrative illustration, readable silhouettes, natural light, consistent cast and palette.",
  comic: "Single cinematic inked graphic novel panel, expressive gesture, consistent costume and palette. No lettering or gutters.",
  whiteboard: "One large recognizable subject as clean sparse black marker line art on pure white. No text, shading or fills.",
};

// Sample the actual ink in the illustration. Blank paper never becomes a visible stroke.
export function boardStrokes(image: HTMLImageElement) {
  const paper = document.createElement("canvas");
  paper.width = 384; paper.height = 216;
  const ctx = paper.getContext("2d", {willReadFrequently:true})!;
  ctx.fillStyle = "white"; ctx.fillRect(0,0,384,216);
  ctx.drawImage(image,0,0,384,216);
  const pixels = ctx.getImageData(0,0,384,216).data;
  const ink = new Set<number>();
  for (let i=0;i<384*216;i++) {
    const k=i*4;
    if ((pixels[k]*.299+pixels[k+1]*.587+pixels[k+2]*.114)<165) ink.add(i);
  }
  const strokes: number[][]=[];
  const steps=[1,384,-1,-384,385,383,-385,-383];
  for (const seed of ink) {
    const stroke: number[]=[];
    let point: number|undefined=seed;
    while(point!==undefined) {
      const current:number=point;
      ink.delete(current); stroke.push(current);
      point=steps.map(d=>current+d).find(n=>Math.abs(n%384-current%384)<=1 && ink.has(n));
    }
    strokes.push(stroke);
  }
  return strokes;
}

export function drawBoard(ctx: CanvasRenderingContext2D, strokes:number[][], progress:number) {
  ctx.fillStyle="#fffdf7"; ctx.fillRect(0,0,1280,720);
  let count=Math.ceil(strokes.reduce((n,s)=>n+s.length,0)*Math.min(1,progress*1.18));
  let x=0,y=0;
  ctx.strokeStyle="#18212a"; ctx.fillStyle=ctx.strokeStyle; ctx.lineWidth=3.5; ctx.lineCap="round";
  for (const stroke of strokes) {
    if(count<=0) break;
    ctx.beginPath();
    for(let i=0;i<Math.min(count,stroke.length);i++){
      x=(stroke[i]%384)*3.32; y=Math.floor(stroke[i]/384)*3.32;
      if(i===0){ctx.moveTo(x,y);ctx.lineTo(x+.1,y);} else ctx.lineTo(x,y);
    }
    ctx.stroke(); count-=stroke.length;
  }
  if(progress<.85 && strokes.length){
    ctx.save(); ctx.translate(x,y); ctx.rotate(-.55);
    ctx.fillStyle="#242a37"; ctx.fillRect(0,-3,76,8);
    ctx.fillStyle="#da9b70"; ctx.beginPath();ctx.ellipse(59,12,26,14,.25,0,Math.PI*2);ctx.fill();
    for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(40+i*6,6+i*4,12,4,.35,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
}

export function drawComic(ctx:CanvasRenderingContext2D, first:HTMLImageElement, last:HTMLImageElement, p:number, line:string){
  ctx.fillStyle="#131318";ctx.fillRect(0,0,1280,720);
  function panel(image:HTMLImageElement,x:number,w:number,zoom:number){
    ctx.save();ctx.beginPath();ctx.rect(x,12,w,696);ctx.clip();
    const scale=Math.max(w/image.width,696/image.height)*zoom;
    ctx.drawImage(image,x+(w-image.width*scale)/2,12+(696-image.height*scale)/2,image.width*scale,image.height*scale);
    ctx.restore();
  }
  panel(first,12,612,1+p*.05);
  ctx.save();ctx.globalAlpha=Math.min(1,Math.max(0,(p-.22)*5));panel(last,636,632,1.06-p*.05);ctx.restore();
  const words=line.trim().split(/\s+/);
  const chunk=Math.min(Math.ceil(words.length/9)-1,Math.floor(p*Math.ceil(words.length/9)));
  const caption=words.slice(chunk*9,chunk*9+9).join(" ");
  ctx.font="bold 30px sans-serif";const width=Math.min(1176,ctx.measureText(caption).width+48);
  ctx.fillStyle="#fffaf0";ctx.beginPath();ctx.roundRect(46,555,width,76,24);ctx.fill();
  ctx.beginPath();ctx.moveTo(98,555);ctx.lineTo(84,526);ctx.lineTo(142,555);ctx.fill();
  ctx.fillStyle="#151520";ctx.fillText(caption,70,603,width-48);
}
