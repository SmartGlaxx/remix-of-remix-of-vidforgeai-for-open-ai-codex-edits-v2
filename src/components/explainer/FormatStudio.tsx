import { useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Drama, Images, PanelsTopLeft, PenTool } from "lucide-react";
import CharacterStudio from "./CharacterStudio";
import FilmBuilder from "./FilmBuilder";
import { IllustratedStories } from "./IllustratedStories";

const formats = [
  { id: "character", title: "Character Animation", description: "Direct full-body performances across a sequence of shots.", icon: Drama },
  { id: "illustrated", title: "Illustrated Stories", description: "Tell a narrated story with original scene illustrations.", icon: Images },
  { id: "whiteboard", title: "Whiteboard / Hand Reveal", description: "Follow a moving pen as each idea takes shape.", icon: PenTool },
  { id: "comic", title: "Motion Comics", description: "Stage action and dialogue across illustrated panels.", icon: PanelsTopLeft },
] as const;

export default function FormatStudio() {
  const [params, setParams] = useSearchParams();
  const format = formats.find(item => item.id === params.get("format"));
  function select(id?: string) {
    const next = new URLSearchParams(params);
    if (id) next.set("format", id); else next.delete("format");
    setParams(next);
  }
  return <section className="mx-auto w-full max-w-6xl space-y-5">
    {format ? <>
      <button className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" onClick={() => select()}><ArrowLeft size={16}/>Explainer formats</button>
      {format.id === "character" ? <CharacterStudio/> : <>
        <h2 className="text-3xl font-bold tracking-tight">{format.title}</h2>
        <FilmBuilder key={format.id} format={format.id}/>
        {format.id === "illustrated" && <details className="workspace-card"><summary className="cursor-pointer font-medium">Illustrated scene study</summary><IllustratedStories/></details>}
      </>}
    </> : <>
      <header><h2 className="text-3xl font-bold tracking-tight">Explainer Studio</h2><p className="mt-1 text-muted-foreground">Choose how to tell your story.</p></header>
      <div className="grid gap-4 sm:grid-cols-2">{formats.map(({id,title,description,icon:Icon}) =>
        <button key={id} onClick={() => select(id)} className="workspace-card group text-left transition-colors hover:border-primary focus-visible:ring-2">
          <span className="mb-5 flex items-center justify-between"><span className="rounded-xl bg-primary/10 p-3 text-primary"><Icon size={24}/></span><ArrowUpRight size={18} className="text-muted-foreground group-hover:text-primary"/></span>
          <h3 className="text-xl font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </button>)}</div>
    </>}
  </section>;
}
