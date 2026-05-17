import { createContext, useContext, useState, ReactNode } from "react";

export type ScriptSection = { section: string; text: string };

type ProjectState = {
  selectedTitle: string | null;
  setSelectedTitle: (t: string | null) => void;
  scriptSections: ScriptSection[];
  setScriptSections: (s: ScriptSection[]) => void;
  scriptMeta: { words: number; minutes: number; retention: number } | null;
  setScriptMeta: (m: { words: number; minutes: number; retention: number } | null) => void;
};

const Ctx = createContext<ProjectState | null>(null);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [scriptSections, setScriptSections] = useState<ScriptSection[]>([]);
  const [scriptMeta, setScriptMeta] = useState<ProjectState["scriptMeta"]>(null);
  return (
    <Ctx.Provider value={{ selectedTitle, setSelectedTitle, scriptSections, setScriptSections, scriptMeta, setScriptMeta }}>
      {children}
    </Ctx.Provider>
  );
};

export const useProject = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProject must be used within ProjectProvider");
  return v;
};