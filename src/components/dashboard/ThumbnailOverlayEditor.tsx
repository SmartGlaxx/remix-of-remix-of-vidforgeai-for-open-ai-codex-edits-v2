import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Type, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Props = {
  imageUrl: string;
  defaultTitle?: string;
  defaultOverlay?: string;
  index: number;
};

const FONT_PRESETS = [
  { label: "Impact", css: "'Anton', 'Impact', sans-serif" },
  { label: "Bebas", css: "'Bebas Neue', sans-serif" },
  { label: "Inter Black", css: "'Inter', sans-serif" },
  { label: "Oswald", css: "'Oswald', sans-serif" },
];
const POSITIONS = ["top", "center", "bottom"] as const;
const ALIGNS = ["left", "center", "right"] as const;

const ThumbnailOverlayEditor = ({ imageUrl, defaultTitle = "", defaultOverlay = "", index }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [text, setText] = useState(defaultOverlay || defaultTitle || "YOUR TITLE");
  const [font, setFont] = useState(FONT_PRESETS[0].css);
  const [color, setColor] = useState("#FFFF00");
  const [stroke, setStroke] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(10);
  const [size, setSize] = useState(120);
  const [position, setPosition] = useState<(typeof POSITIONS)[number]>("bottom");
  const [align, setAlign] = useState<(typeof ALIGNS)[number]>("center");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  // Load image once
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { imgRef.current = img; setReady(true); };
    img.onerror = () => setReady(false);
    img.src = imageUrl;
  }, [imageUrl]);

  // Redraw whenever any control changes
  useEffect(() => {
    const c = canvasRef.current; const img = imgRef.current;
    if (!c || !img || !ready) return;
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    if (!text.trim()) return;

    ctx.font = `900 ${size}px ${font}`;
    ctx.textAlign = align as CanvasTextAlign;
    ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;

    const padX = c.width * 0.05;
    const x = align === "left" ? padX : align === "right" ? c.width - padX : c.width / 2;
    const y = position === "top" ? size + padX
      : position === "center" ? c.height / 2 + size / 3
      : c.height - padX;

    // Word-wrap into max 2 lines
    const words = text.split(/\s+/);
    const maxWidth = c.width - padX * 2;
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
      else line = test;
      if (lines.length >= 1 && ctx.measureText(line).width > maxWidth) {
        lines.push(line); line = ""; break;
      }
    }
    if (line) lines.push(line);
    const limited = lines.slice(0, 2);

    const lineHeight = size * 1.05;
    const totalH = lineHeight * limited.length;
    let startY = y;
    if (position === "center") startY = c.height / 2 - totalH / 2 + size;
    if (position === "top") startY = padX + size;
    if (position === "bottom") startY = c.height - padX - (limited.length - 1) * lineHeight;

    limited.forEach((ln, i) => {
      const ly = startY + i * lineHeight;
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = stroke;
      ctx.strokeText(ln, x, ly);
      ctx.fillStyle = color;
      ctx.fillText(ln, x, ly);
    });
  }, [ready, text, font, color, stroke, strokeWidth, size, position, align]);

  const downloadPng = async () => {
    const c = canvasRef.current; if (!c) return;
    const url = c.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url; a.download = `thumbnail-${index + 1}.png`; a.click();
  };

  const saveToLibrary = async () => {
    const c = canvasRef.current; if (!c) return;
    setBusy(true);
    try {
      const blob: Blob = await new Promise((res, rej) =>
        c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/png", 0.95),
      );
      const name = `composited/${Date.now()}-${index + 1}.png`;
      const { error } = await supabase.storage.from("thumbnails").upload(name, blob, {
        contentType: "image/png", upsert: true,
      });
      if (error) throw error;
      toast({ title: "Saved", description: "Composited thumbnail saved to library." });
    } catch (e) {
      toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2 p-2 border-t border-border bg-background/40">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Type className="w-3 h-3" /> Crisp text overlay (rendered client-side, never gibberish)
      </div>
      <canvas ref={canvasRef} className="w-full rounded-md bg-secondary/40" />
      <input
        value={text} onChange={(e) => setText(e.target.value)}
        className="w-full bg-background/80 border border-border rounded-md px-2 py-1.5 text-xs"
        placeholder="Headline text"
      />
      <div className="grid grid-cols-2 gap-1.5">
        <select value={font} onChange={(e) => setFont(e.target.value)} className="bg-background/80 border border-border rounded-md px-1.5 py-1 text-[10px]">
          {FONT_PRESETS.map((f) => <option key={f.label} value={f.css}>{f.label}</option>)}
        </select>
        <select value={position} onChange={(e) => setPosition(e.target.value as any)} className="bg-background/80 border border-border rounded-md px-1.5 py-1 text-[10px]">
          {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={align} onChange={(e) => setAlign(e.target.value as any)} className="bg-background/80 border border-border rounded-md px-1.5 py-1 text-[10px]">
          {ALIGNS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="number" min={40} max={260} value={size} onChange={(e) => setSize(Number(e.target.value))} className="bg-background/80 border border-border rounded-md px-1.5 py-1 text-[10px]" />
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">Fill <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-6 h-6 rounded" /></label>
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">Stroke <input type="color" value={stroke} onChange={(e) => setStroke(e.target.value)} className="w-6 h-6 rounded" /></label>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={downloadPng}>
          <Download className="w-3 h-3 mr-1" /> Download
        </Button>
        <Button size="sm" className="h-7 text-[10px] bg-accent hover:bg-accent/90" disabled={busy} onClick={saveToLibrary}>
          {busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null} Save
        </Button>
      </div>
    </div>
  );
};

export default ThumbnailOverlayEditor;