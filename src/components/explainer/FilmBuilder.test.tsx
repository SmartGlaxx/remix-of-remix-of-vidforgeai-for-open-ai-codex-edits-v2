import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import FilmBuilder from "./FilmBuilder";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "explainer-test" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

beforeEach(() => {
  localStorage.clear();
  invoke.mockReset();
  // jsdom's older AbortSignal lacks the browser API used by FilmBuilder.
  Object.defineProperty(AbortSignal.prototype, "throwIfAborted", {
    configurable: true,
    value: function (this: AbortSignal) { if (this.aborted) throw this.reason; },
  });
});
afterEach(cleanup);

it("plans the Explainer from its brief without requiring a separate title", async () => {
  const scenes = Array.from({ length: 6 }, (_, i) => ({
    line: `Rain explanation ${i + 1}`, prompt: `Rain illustration ${i + 1}`, label: `Scene ${i + 1}`,
  }));
  invoke.mockResolvedValueOnce({ data: { scenes }, error: null });
  invoke.mockResolvedValue({ data: { error: "Illustration unavailable" }, error: null });
  render(<FilmBuilder />);
  fireEvent.change(screen.getByLabelText("Video brief"), { target: { value: "  Explain how rain forms.  " } });
  fireEvent.click(screen.getByRole("button", { name: "Generate film" }));
  await waitFor(() => expect(invoke).toHaveBeenCalledWith("generate-script", {
    body: { explainerBrief: "Explain how rain forms." }, signal: expect.any(AbortSignal),
  }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Illustration unavailable"));
  expect(JSON.parse(localStorage.getItem("genvast.film.explainer-test") || "{}").scenes).toHaveLength(6);
  expect(screen.getByRole("button", { name: "Resume generation" })).toBeEnabled();
});

it("keeps the form visible and retryable when an outdated service rejects the brief", async () => {
  invoke.mockResolvedValue({ data: null, error: {
    context: { json: async () => ({ error: "Missing title" }) }, message: "Edge function returned 400",
  } });
  render(<FilmBuilder />);
  fireEvent.change(screen.getByLabelText("Video brief"), { target: { value: "Explain rain." } });
  fireEvent.click(screen.getByRole("button", { name: "Generate film" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("needs the Explainer update"));
  expect(screen.getByLabelText("Video brief")).toHaveValue("Explain rain.");
  expect(screen.getByRole("button", { name: "Generate film" })).toBeEnabled();
});

it("blocks planning when the brief is empty", () => {
  render(<FilmBuilder />);
  expect(screen.getByRole("button", { name: "Generate film" })).toBeDisabled();
  expect(invoke).not.toHaveBeenCalled();
});
it("uses one click to plan a whiteboard and export the six narrated scenes", async () => {
  const { renderFilm } = await import("./renderFilm");
  Object.defineProperty(URL,"createObjectURL",{configurable:true,value:()=>"blob:film"});
  Object.defineProperty(URL,"revokeObjectURL",{configurable:true,value:()=>{}});
  const scenes = Array.from({length:6}, (_, i) => ({line:"Line "+i, prompt:"Diagram "+i, label:"Step "+i}));
  invoke.mockImplementation(async name => ({data:name === "generate-script" ? {scenes}
    : name === "generate-visual" ? {image_url:"https://example.com/chart.png"}
    : {audio_url:"https://example.com/audio.mp3"}}));
  render(<FilmBuilder format="auto"/>);
  fireEvent.change(screen.getByLabelText("What should your video explain?"), {target:{value:"Compound interest"}});
  fireEvent.click(screen.getByRole("button",{name:"Create explainer"}));
  await waitFor(() => expect(renderFilm).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({audio:"https://example.com/audio.mp3"})]),expect.any(Function),expect.any(AbortSignal),"whiteboard"));
  expect(await screen.findByText("Download video")).toBeVisible();
});
vi.mock("./renderFilm", () => ({renderFilm:vi.fn(async () => new Blob(["video"],{type:"video/mp4"}))}));
