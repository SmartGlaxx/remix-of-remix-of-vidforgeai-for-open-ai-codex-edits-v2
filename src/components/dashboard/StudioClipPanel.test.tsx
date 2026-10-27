import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StudioClipPanel, { COLD_START_BUDGET_MS } from "./StudioClipPanel";
import { firstFrameIgnored, validateFirstFrame } from "./studioClipUtils";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ visualScenes: [{ imageUrl: "https://example.com/first.png" }] }) }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); invoke.mockReset(); });

describe("Studio chaining", () => {
  it("budgets 14 minutes for cold starts", () => {
    expect(COLD_START_BUDGET_MS).toBe(840_000);
  });
  it("only accepts HTTPS first frames and omits an empty first frame", () => {
    expect(validateFirstFrame(" ")).toBeUndefined();
    expect(validateFirstFrame("https://example.com/first.png")).toBe("https://example.com/first.png");
    expect(() => validateFirstFrame("http://example.com/image.png")).toThrow();
    expect(() => validateFirstFrame("data:image/png;base64,abc")).toThrow();
  });
  it("recognizes ignored first-frame warnings without treating diagnostics as warnings", () => {
    expect(firstFrameIgnored({ output: { warnings: ["first_frame_url ignored"] } })).toBe(true);
    expect(firstFrameIgnored({ generation_metadata: { image_arg_configured: true } })).toBe(false);
  });
  it("sends the seed and chains the returned last frame using primary while retaining shot one", async () => {
    const original = window.setTimeout.bind(window);
    vi.spyOn(window, "setTimeout").mockImplementation(((handler: TimerHandler, timeout?: number, ...args: unknown[]) => original(handler, timeout === 5000 ? 0 : timeout, ...args)) as typeof window.setTimeout);
    invoke.mockResolvedValueOnce({ data: { job_id: "one" } })
      .mockResolvedValueOnce({ data: { status: "COMPLETED", output: { video_url: "https://example.com/one.mp4", last_frame_url: "https://example.com/last.png" } } })
      .mockResolvedValueOnce({ data: { rehosted: true, url: "https://example.com/saved-one.mp4" } })
      .mockResolvedValueOnce({ data: { job_id: "two" } })
      .mockResolvedValueOnce({ data: { status: "COMPLETED", output: { video_url: "https://example.com/two.mp4" } } })
      .mockResolvedValueOnce({ data: { rehosted: true, url: "https://example.com/saved-two.mp4" } });
    render(<StudioClipPanel />);
    fireEvent.click(screen.getByText("Use first storyboard image"));
    expect(screen.getByText("Use backup engine")).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Shot description"), { target: { value: "First shot" } });
    fireEvent.click(screen.getByText("Generate clip"));
    await waitFor(() => expect(screen.getByLabelText("Shot 1")).toBeInTheDocument());
    expect(invoke.mock.calls[2]).toEqual(["rehost-video", { body: { url: "https://example.com/one.mp4", label: "studio-one" } }]);
    expect(screen.getByLabelText("Shot 1")).toHaveAttribute("src", "https://example.com/saved-one.mp4");
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute("href", "https://example.com/saved-one.mp4");
    expect(invoke.mock.calls[0][1].body.first_frame_url).toBe("https://example.com/first.png");
    fireEvent.click(screen.getByText("Chain next shot"));
    expect(screen.getByLabelText("First frame (optional)")).toHaveValue("https://example.com/last.png");
    fireEvent.change(screen.getByLabelText("Shot description"), { target: { value: "Next shot" } });
    fireEvent.click(screen.getByText("Generate clip"));
    expect(screen.getByLabelText("Shot 1")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Shot 2")).toBeInTheDocument());
    expect(invoke.mock.calls[3][1].body).toMatchObject({ tier: "primary", first_frame_url: "https://example.com/last.png" });
    expect(screen.getByLabelText("Shot 2")).toHaveAttribute("src", "https://example.com/saved-two.mp4");
  });
  it.each(["fallback", "error", "throw"])("retains a completed clip and chaining when storage returns %s", async (failure) => {
    const original = window.setTimeout.bind(window);
    vi.spyOn(window, "setTimeout").mockImplementation(((handler: TimerHandler, timeout?: number, ...args: unknown[]) => original(handler, timeout === 5000 ? 0 : timeout, ...args)) as typeof window.setTimeout);
    invoke.mockResolvedValueOnce({ data: { job_id: "one" } })
      .mockResolvedValueOnce({ data: { status: "COMPLETED", output: { video_url: "https://example.com/one.mp4", last_frame_url: "https://example.com/last.png" } } });
    if (failure === "throw") invoke.mockRejectedValueOnce(new Error("Storage unavailable"));
    else invoke.mockResolvedValueOnce(failure === "error" ? { error: new Error("Storage unavailable") } : { data: { rehosted: false, url: "https://example.com/one.mp4" } });
    render(<StudioClipPanel />);
    fireEvent.change(screen.getByLabelText("Shot description"), { target: { value: "First shot" } });
    fireEvent.click(screen.getByText("Generate clip"));
    await waitFor(() => expect(screen.getByLabelText("Shot 1")).toHaveAttribute("src", "https://example.com/one.mp4"));
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open video in new tab" })).toHaveAttribute("href", "https://example.com/one.mp4");
    fireEvent.click(screen.getByText("Chain next shot"));
    expect(screen.getByLabelText("First frame (optional)")).toHaveValue("https://example.com/last.png");
  });
});