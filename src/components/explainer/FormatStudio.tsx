import { useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Drama, Images } from "lucide-react";
import { IllustratedStories } from "./IllustratedStories";
import CharacterStudio from "./CharacterStudio";

const formats = [
  ["character", "Character Animation", "Direct a sequence of full-body performances."],
  ["illustrated", "Illustrated Stories", "Build a narrated film from illustrated scenes."],
  ["whiteboard", "Whiteboard / Hand Reveal", "A drawing unfolds beneath a moving pen."],
  ["comic", "Motion Comics", "Stage dialogue and action across comic panels."],
  ["silhouette", "Silhouette Animation", "Tell a story with shadow and silhouette."],
  ["cutout", "Paper Cutout", "Move layered paper characters and props."],
  ["graphics", "Motion Graphics", "Explain an idea with animated shapes and symbols."],
  ["data", "Data Animation", "Show quantities changing through animated charts."],
  ["type", "Kinetic Typography", "Time expressive lettering to the spoken word."],
  ["maps", "Maps and Timelines", "Trace journeys and events across space and time."],
  ["technical", "Scientific and Technical", "Show how a system or mechanism works."],
  ["parallax", "2.5D Parallax", "Create depth with independently moving layers."],
  ["drawn", "Frame-by-Frame", "Build movement from a series of drawings."],
  ["3d", "3D Animation", "Stage characters and cameras in three dimensions."],
  ["stop", "Stop Motion", "Animate physical objects one frame at a time."],
  ["rotoscope", "Rotoscoping", "Trace movement from filmed performances."],
];
export default function FormatStudio() {
  const [params, setParams] = useSearchParams();
  const format = params.get("format");
  function select(value?: string) {
    const next = new URLSearchParams(params);
    if (value) next.set("format", value); else next.delete("format");
    setParams(next);
  }
  if (format === "character" || format === "illustrated") return <section className="mx-auto max-w-6xl space-y-4">
    <button className="inline-flex items-center gap-2 text-sm text-muted-foreground" onClick={() => select()}><ArrowLeft size={16}/> Explainer formats</button>
    {format === "character" ? <CharacterStudio/> : <IllustratedStories/>}
  </section>;
  return <section className="mx-auto max-w-6xl space-y-5">
    <header><h2 className="text-3xl font-bold">Explainer Studio</h2><p className="text-muted-foreground">Choose an animation format.</p></header>
    <div className="grid gap-4 sm:grid-cols-2">{formats.slice(0,2).map(([id,title,description]) => {
      const Icon = id === "character" ? Drama : Images;
      return <button key={id} onClick={() => select(id)} className="workspace-card space-y-3 text-left hover:border-primary focus-visible:ring-2">
        <div className="flex justify-between text-primary"><Icon/><ArrowUpRight/></div>
        <h3 className="text-xl font-semibold">{title}</h3><p className="text-sm text-muted-foreground">{description}</p>
      </button>;
    })}</div>
    <h3 className="text-lg font-semibold">Planned formats</h3>
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{formats.slice(2).map(([id,title,description]) =>
      <li key={id} className="rounded-xl border bg-card p-4"><h4 className="font-semibold">{title}</h4><p className="mt-1 text-sm text-muted-foreground">{description}</p></li>
    )}</ul>
  </section>;
}
