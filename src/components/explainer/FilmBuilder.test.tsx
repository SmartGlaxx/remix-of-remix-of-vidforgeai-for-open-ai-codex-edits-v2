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