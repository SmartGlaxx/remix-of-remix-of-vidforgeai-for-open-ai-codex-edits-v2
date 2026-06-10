import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export type ScriptSection = { section: string; text: string };

export type VisualScene = {
  id: string;
  section: string;
  text: string;
  prompt: string;
  imageUrl?: string;
  status: "pending" | "generating" | "done" | "error";
  error?: string;
  // Storyboard fields
  conceptualPrompt?: string;
  cameraAngle?: string;
  // Per-frame overrides (fall back to global when undefined)
  styleOverride?: string;
  ambianceOverride?: string;
  engineOverride?: string;
  paletteOverride?: string;
  aspectOverride?: string;
};

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

export type SoundtrackTrack = {
  id: string;
  segment: string;
  status: "generating" | "done" | "error";
  url?: string;
  source_url?: string;
  storage_path?: string;
  rehosted?: boolean;
  error?: string;
  created_at?: number;
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
  // Visuals step
  visualScenes: VisualScene[];
  setVisualScenes: (s: VisualScene[]) => void;
  visualCount: number;
  setVisualCount: (n: number) => void;
  visualStyle: string;
  setVisualStyle: (s: string) => void;
  visualAspectRatio: string;
  setVisualAspectRatio: (s: string) => void;
  visualQuality: string;
  setVisualQuality: (s: string) => void;
  visualMotion: string;
  setVisualMotion: (s: string) => void;
  visualAmbiance: string;
  setVisualAmbiance: (s: string) => void;
  visualCamera: string;
  setVisualCamera: (s: string) => void;
  visualEngine: string;
  setVisualEngine: (s: string) => void;
  visualPalette: string;
  setVisualPalette: (s: string) => void;
  // Video step
  imagePrompt: string;
  setImagePrompt: (s: string) => void;
  musicPrompt: string;
  setMusicPrompt: (s: string) => void;
  voice: string;
  setVoice: (s: string) => void;
  videoUrl: string | null;
  setVideoUrl: (s: string | null) => void;
  soundtrackTracks: SoundtrackTrack[];
  setSoundtrackTracks: (t: SoundtrackTrack[]) => void;
  audioDuration: number;
  setAudioDuration: (n: number) => void;
  resetProject: () => void;
  resetNonce: number;
};

const Ctx = createContext<ProjectState | null>(null);
const STORAGE_KEY = "vidforge_project_state_v1";

const readSavedProject = (): Partial<ProjectState> => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as Partial<ProjectState>;
  } catch {
    return {};
  }
};

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const saved = useMemo(readSavedProject, []);
  const [topic, setTopic] = useState(saved.topic ?? "");
  const [customTitle, setCustomTitle] = useState(saved.customTitle ?? "");
  const [titles, setTitles] = useState<TitleCandidate[]>(saved.titles ?? []);
  const [seo, setSeo] = useState<SeoInsights | null>(saved.seo ?? null);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(saved.selectedTitle ?? null);
  const [scriptSections, setScriptSections] = useState<ScriptSection[]>(saved.scriptSections ?? []);
  const [scriptMeta, setScriptMeta] = useState<ProjectState["scriptMeta"]>(saved.scriptMeta ?? null);
  const [visualScenes, setVisualScenes] = useState<VisualScene[]>(saved.visualScenes ?? []);
  const [visualCount, setVisualCount] = useState(saved.visualCount ?? 80);
  const [visualStyle, setVisualStyle] = useState(saved.visualStyle ?? "Cinematic");
  const [visualAspectRatio, setVisualAspectRatio] = useState(saved.visualAspectRatio ?? "16:9");
  const [visualQuality, setVisualQuality] = useState(saved.visualQuality ?? "HD");
  const [visualMotion, setVisualMotion] = useState(saved.visualMotion ?? "Static");
  const [visualAmbiance, setVisualAmbiance] = useState(saved.visualAmbiance ?? "Neutral & Realistic");
  const [visualCamera, setVisualCamera] = useState(saved.visualCamera ?? "Epic Landscape (Scale)");
  const [visualEngine, setVisualEngine] = useState(saved.visualEngine ?? "IMAX Hollywood Quality");
  const [visualPalette, setVisualPalette] = useState(saved.visualPalette ?? "Teal & Tangerine");
  const [imagePrompt, setImagePrompt] = useState(saved.imagePrompt ?? "Cinematic close-up portrait of a narrator, soft lighting, 4k");
  const [musicPrompt, setMusicPrompt] = useState(saved.musicPrompt ?? "Cinematic ambient background music, soft and atmospheric");
  const [voice, setVoice] = useState(saved.voice ?? "af_heart");
  const [videoUrl, setVideoUrl] = useState<string | null>(saved.videoUrl ?? null);
  const [soundtrackTracks, setSoundtrackTracks] = useState<SoundtrackTrack[]>(saved.soundtrackTracks ?? []);
  const [audioDuration, setAudioDuration] = useState<number>(saved.audioDuration ?? 0);
  const [resetNonce, setResetNonce] = useState(0);

  const resetProject = () => {
    setTopic("");
    setCustomTitle("");
    setTitles([]);
    setSeo(null);
    setSelectedTitle(null);
    setScriptSections([]);
    setScriptMeta(null);
    setVisualScenes([]);
    setVisualCount(80);
    setVisualStyle("Cinematic");
    setVisualAspectRatio("16:9");
    setVisualQuality("HD");
    setVisualMotion("Static");
    setVisualAmbiance("Neutral & Realistic");
    setVisualCamera("Epic Landscape (Scale)");
    setVisualEngine("IMAX Hollywood Quality");
    setVisualPalette("Teal & Tangerine");
    setImagePrompt("Cinematic close-up portrait of a narrator, soft lighting, 4k");
    setMusicPrompt("Cinematic ambient background music, soft and atmospheric");
    setVoice("af_heart");
    setVideoUrl(null);
    setSoundtrackTracks([]);
    setAudioDuration(0);
    try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
    setResetNonce((n) => n + 1);
  };

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      topic, customTitle, titles, seo, selectedTitle, scriptSections, scriptMeta,
      visualScenes, visualCount, visualStyle, visualAspectRatio, visualQuality, visualMotion,
      visualAmbiance, visualCamera, visualEngine, visualPalette,
      imagePrompt, musicPrompt, voice, videoUrl, soundtrackTracks,
      audioDuration,
    }));
  }, [topic, customTitle, titles, seo, selectedTitle, scriptSections, scriptMeta, visualScenes, visualCount, visualStyle, visualAspectRatio, visualQuality, visualMotion, visualAmbiance, visualCamera, visualEngine, visualPalette, imagePrompt, musicPrompt, voice, videoUrl, soundtrackTracks, audioDuration]);

  return (
    <Ctx.Provider value={{
      topic, setTopic, customTitle, setCustomTitle, titles, setTitles, seo, setSeo,
      selectedTitle, setSelectedTitle,
      scriptSections, setScriptSections, scriptMeta, setScriptMeta,
      visualScenes, setVisualScenes, visualCount, setVisualCount, visualStyle, setVisualStyle,
      visualAspectRatio, setVisualAspectRatio, visualQuality, setVisualQuality, visualMotion, setVisualMotion,
      visualAmbiance, setVisualAmbiance, visualCamera, setVisualCamera, visualEngine, setVisualEngine, visualPalette, setVisualPalette,
      imagePrompt, setImagePrompt, musicPrompt, setMusicPrompt, voice, setVoice,
      videoUrl, setVideoUrl,
      soundtrackTracks, setSoundtrackTracks,
      audioDuration, setAudioDuration,
      resetProject,
      resetNonce,
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