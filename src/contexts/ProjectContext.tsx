import { createContext, useContext, useState, ReactNode } from "react";

export type ScriptSection = { section: string; text: string };

export type TitleCandidate = {
  title: string;
  score: number;
  views: string;
  ctr: string;
  language: string;
  reason?: string;
};

export type SeoInsights = {
  competition: "Low" | "Medium" | "High";
  search_volume: string;
  trending: string;
  primary_keyword?: string;
  notes?: string;
};

type ProjectState = {
  // Title step
  topic: string;
  setTopic: (t: string) => void;
  customTitle: string;
  setCustomTitle: (t: string) => void;
  titles: TitleCandidate[];
  setTitles: (t: TitleCandidate[]) => void;
  seo: SeoInsights | null;
  setSeo: (s: SeoInsights | null) => void;
  selectedTitle: string | null;
  setSelectedTitle: (t: string | null) => void;
  // Script step
  scriptSections: ScriptSection[];
  setScriptSections: (s: ScriptSection[]) => void;
  scriptMeta: { words: number; minutes: number; retention: number } | null;
  setScriptMeta: (m: { words: number; minutes: number; retention: number } | null) => void;
  // Video step
  imagePrompt: string;
  setImagePrompt: (s: string) => void;
  musicPrompt: string;
  setMusicPrompt: (s: string) => void;
  voice: string;
  setVoice: (s: string) => void;
  videoUrl: string | null;
  setVideoUrl: (s: string | null) => void;
};

const Ctx = createContext<ProjectState | null>(null);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const [topic, setTopic] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [titles, setTitles] = useState<TitleCandidate[]>([]);
  const [seo, setSeo] = useState<SeoInsights | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [scriptSections, setScriptSections] = useState<ScriptSection[]>([]);
  const [scriptMeta, setScriptMeta] = useState<ProjectState["scriptMeta"]>(null);
  const [imagePrompt, setImagePrompt] = useState("Cinematic close-up portrait of a narrator, soft lighting, 4k");
  const [musicPrompt, setMusicPrompt] = useState("Cinematic ambient background music, soft and atmospheric");
  const [voice, setVoice] = useState("af_heart");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  return (
    <Ctx.Provider value={{
      topic, setTopic, customTitle, setCustomTitle, titles, setTitles, seo, setSeo,
      selectedTitle, setSelectedTitle,
      scriptSections, setScriptSections, scriptMeta, setScriptMeta,
      imagePrompt, setImagePrompt, musicPrompt, setMusicPrompt, voice, setVoice,
      videoUrl, setVideoUrl,
    }}>
      {children}
    </Ctx.Provider>
  );
};

export const useProject = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProject must be used within ProjectProvider");
  return v;
};