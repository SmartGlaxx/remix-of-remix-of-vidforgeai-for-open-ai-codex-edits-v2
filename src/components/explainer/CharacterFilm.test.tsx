import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CharacterFilm from "./CharacterFilm";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "owner" } }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke },
    storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: "https://illustration.test/reference.png" } }) }) },
  },
}));

const shot = (index: number, over = {}) => ({
  id: "shot-" + index, index, chapter: 0, duration: 10, line: `Line ${index + 1}`, purpose: `Purpose ${index + 1}`,
  visual: `Visual ${index + 1}`, action: `Action ${index + 1}`, transition: "cut", state: "pending", error: null, video_path: null, ...over,
});
const view = {
  film: {
    id: "film-1", state: "draft", seconds: 30, script: "A small habit can change your whole day.", audio_mode: "native",
    image_path: "owner/reference.png", estimated_usd: 0.15, final_video_url: null, error: null, mismatch: false,
    spoken_seconds: 9, narration: [], chapters: [{ key: "chapter-0", indices: [0, 1, 2], state: "pending" }],
  },
  shots: [shot(0), shot(1), shot(2)],
  progress: { saved: 0, total: 3, chapter: 1, chapters: 1, phase: "Generating clips" },
};

beforeEach(() => { localStorage.clear(); window.history.replaceState(null,"","/"); invoke.mockReset(); invoke.mockResolvedValue({ data: view, error: null }); });
afterEach(cleanup);

it("opens a planned 30-second, three-shot film costing US$0.15", async () => {
  render(<CharacterFilm />);
  expect(await screen.findByRole("heading", { name: "Create a film" })).toBeInTheDocument();
  expect(await screen.findByText("Estimated US$0.15")).toBeInTheDocument();
  expect(screen.getByText("30s runtime · 3 clips · 1 chapter")).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Shot" })).toHaveValue("0");
  expect(invoke).toHaveBeenCalledWith("character-film", { body: { action: "prepare" } });
});

it("authorizes one automatic request with topic or script and the selected duration", async () => {
  render(<CharacterFilm />);
  const create = await screen.findByRole("button", { name: /Create video/ });
  await waitFor(()=>expect(create).toBeEnabled());
  fireEvent.click(create);
  await waitFor(() => expect(invoke).toHaveBeenCalledWith("character-film", { body: expect.objectContaining({ action: "create", seconds: 30, script: view.film.script, image_path: "owner/reference.png", prepare_only: false, request_id: expect.any(String) }) }));
  expect(invoke.mock.calls.filter(([, args]) => args.body.action === "generate")).toHaveLength(0);
});

it("keeps deliberate manual planning and paying available in director details", async () => {
  render(<CharacterFilm />);
  const plan = await screen.findByRole("button", { name: /Plan film/ });
  const generate = screen.getByRole("button", { name: /Generate film · US\$0\.15/ });
  expect(plan).toBeEnabled();
  expect(generate).toBeEnabled();
  fireEvent.click(generate);
  await waitFor(() => expect(invoke).toHaveBeenCalledWith("character-film", { body: { action: "generate", id: "film-1" } }));
  expect(invoke.mock.calls.filter(([, args]) => args.body.action === "plan").length).toBe(0);
});

it("warns before spending when the script does not fit the chosen length", async () => {
  invoke.mockResolvedValue({ data: { ...view, film: { ...view.film, mismatch: true, spoken_seconds: 220 } }, error: null });
  render(<CharacterFilm />);
  expect(await screen.findByRole("alert")).toHaveTextContent("about 220s, not 30s");
});

it("offers stop while the worker runs the film", async () => {
  invoke.mockResolvedValue({ data: { ...view, film: { ...view.film, state: "running" } }, error: null });
  render(<CharacterFilm />);
  const stop = await screen.findByRole("button", { name: "Stop" });
  fireEvent.click(stop);
  await waitFor(() => expect(invoke).toHaveBeenCalledWith("character-film", { body: { action: "stop", id: "film-1" } }));
});

it("navigates a 180-shot film without rendering 180 shot buttons", async () => {
  const shots=Array.from({length:180},(_,i)=>shot(i,{chapter:Math.floor(i/12)}));
  invoke.mockResolvedValue({data:{...view, shots},error:null});
  render(<CharacterFilm/>);
  const chapters=await screen.findByLabelText("Chapter");
  fireEvent.change(chapters,{target:{value:"14"}});
  expect(screen.getByLabelText("Shot")).toHaveValue("168");
  fireEvent.click(screen.getByRole("button",{name:"Next shot"}));
  expect(screen.getByRole("heading",{name:"Shot 170"})).toBeInTheDocument();
  expect(screen.queryAllByRole("button",{name:/^Shot \d/})).toHaveLength(0);
});
