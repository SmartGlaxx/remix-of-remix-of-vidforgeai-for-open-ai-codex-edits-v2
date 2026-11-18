import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProjectProvider } from "@/contexts/ProjectContext";
import ScriptStep from "./ScriptStep";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
beforeEach(() => { localStorage.clear(); invoke.mockReset(); });
afterEach(cleanup);

it("blocks both regeneration buttons when a saved title contains only whitespace", () => {
  localStorage.setItem("vidforge_project_state_v1", JSON.stringify({
    topic: "  ", selectedTitle: "  ", scriptSections: [{ section: "Opening", text: "Keep this draft." }],
  }));
  render(<ProjectProvider><ScriptStep /></ProjectProvider>);
  expect(screen.getByRole("button", { name: /^Regenerate$/ })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Regenerate Script", hidden: true })).toBeDisabled();
  expect(invoke).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Script section 1")).toHaveValue("Keep this draft.");
});

it("sends the trimmed topic and saves returned script sections", async () => {
  invoke.mockResolvedValue({ data: { sections: [{ section: "Opening", text: "Rain begins with evaporation." }] }, error: null });
  render(<ProjectProvider><ScriptStep /></ProjectProvider>);
  fireEvent.change(screen.getByLabelText("Title / topic"), { target: { value: "  How rain forms  " } });
  fireEvent.click(screen.getByRole("button", { name: "Generate Script" }));
  await waitFor(() => expect(invoke).toHaveBeenCalledWith("generate-script", { body: expect.objectContaining({ title: "How rain forms" }) }));
  expect(await screen.findByLabelText("Script section 1")).toHaveValue("Rain begins with evaporation.");
});