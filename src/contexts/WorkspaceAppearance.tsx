import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
export const workspaceAccents = [
  { id: "mint", name: "Mint", color: "#2fe6a7", description: "Coastal green" },
  { id: "magenta", name: "Magenta", color: "#ff4da6", description: "Vivid pink" },
  { id: "lime", name: "Lime", color: "#b8e62e", description: "Electric chartreuse" },
  { id: "amber", name: "Amber", color: "#ffb020", description: "Warm gold" },
  { id: "cyan", name: "Cyan", color: "#2ec5e6", description: "Ocean blue" },
];
const Context = createContext({ accent: "mint", setAccent: (_value: string) => {} });
export function WorkspaceAppearanceProvider({ children }: { children: ReactNode }) {
  const [accent, setAccent] = useState(() => { try { return localStorage.getItem("genvast-accent") || "mint"; } catch { return "mint"; } });
  useEffect(() => { try { localStorage.setItem("genvast-accent", accent); } catch { /* Browser storage may be unavailable. */ } }, [accent]);
  return <Context.Provider value={{ accent, setAccent }}>{children}</Context.Provider>;
}
export const useWorkspaceAppearance = () => useContext(Context);
export function WorkspaceThemeDots() {
  const { accent, setAccent } = useWorkspaceAppearance();
  return <div className="workspace-theme-dots" aria-label="Workspace accent">{workspaceAccents.map((item) => <button key={item.id} type="button" aria-label={`${item.name} theme`} title={`${item.name} theme`} aria-pressed={accent === item.id} style={{ background: item.color }} onClick={() => setAccent(item.id)} />)}</div>;
}
