import { fireEvent, render as renderUI, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudioClipPanel, { COLD_START_BUDGET_MS } from "./StudioClipPanel";
import { approveTake, firstFrameIgnored, sequenceSummary, validateFrameUrl } from "./studioClipUtils";
import { ProjectProvider, type StudioShot, type StudioTake } from "@/contexts/ProjectContext";

const { invoke, tracks } = vi.hoisted(() => ({ invoke: vi.fn(), tracks: [{ id: "music", segment: "Music tab track", status: "done", url: "https://example.com/music.mp3" }] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
const render = (ui: React.ReactNode) => renderUI(<ProjectProvider>{ui}</ProjectProvider>);

const START = "https://example.com/start.png";
const END = "https://example.com/end.png";
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("vidforge_project_state_v1", JSON.stringify({ visualScenes: [{ imageUrl: START }, { imageUrl: END }], soundtrackTracks: tracks }));
  const original = window.setTimeout.bind(window);
  vi.spyOn(window, "setTimeout").mockImplementation(((h: TimerHandler, t?: number, ...a: unknown[]) => original(h, t === 5000 ? 0 : t, ...a)) as typeof window.setTimeout);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); invoke.mockReset(); });

const fillShot = (prompt = "Shot") => {
  fireEvent.change(screen.getByLabelText("Shot description"), { target: { value: prompt } });
  fireEvent.change(screen.getByLabelText("Start frame (required)"), { target: { value: START } });
  fireEvent.change(screen.getByLabelText("End frame (required)"), { target: { value: END } });
};
const ok = (job: string, extra: Record<string, unknown> = {}) => [
  { data: { job_id: job } },
  { data: { status: "COMPLETED", executionTime: 60_000, output: { video_url: `https://example.com/${job}.mp4`, ...extra } } },
  { data: { rehosted: true, url: `https://example.com/saved-${job}.mp4` } },
];
const queue = (...steps: unknown[]) => steps.flat().forEach((s) => invoke.mockResolvedValueOnce(s));

describe("Frame validation", () => {
  it("rejects http, data/Base64 and reports which frame is bad", () => {
    expect(validateFrameUrl(" ")).toBeUndefined();
    expect(validateFrameUrl(START, "Start frame")).toBe(START);
    expect(() => validateFrameUrl("http://example.com/a.png", "End frame")).toThrow("End frame must be");
    expect(() => validateFrameUrl("data:image/png;base64,abc", "Start frame")).toThrow("Start frame must be");
  });
  it("recognizes ignored first-frame warnings", () => {
    expect(firstFrameIgnored({ output: { warnings: ["first_frame_url ignored"] } })).toBe(true);
    expect(firstFrameIgnored({ generation_metadata: { image_arg_configured: true } })).toBe(false);
  });
  it("budgets 14 minutes for cold starts", () => { expect(COLD_START_BUDGET_MS).toBe(840_000); });
  it("keeps Generate and backup disabled unless both frames are valid HTTPS links", () => {
    render(<StudioClipPanel />);
    fireEvent.change(screen.getByLabelText("Shot description"), { target: { value: "Shot" } });
    fireEvent.change(screen.getByLabelText("Start frame (required)"), { target: { value: START } });
    expect(screen.getByText("Generate clip")).toBeDisabled();
    expect(screen.getByText("Use backup engine")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("End frame (required)"), { target: { value: "data:image/png;base64,abc" } });
    expect(screen.getByText("Generate clip")).toBeDisabled();
    expect(screen.getByText("End frame must be a public HTTPS image URL.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("End frame (required)"), { target: { value: END } });
    expect(screen.getByText("Generate clip")).toBeEnabled();
    expect(screen.getByText("Use backup engine")).toBeEnabled();
    fireEvent.click(screen.getByText("Generate clip"));
    expect(invoke.mock.calls[0][1].body).toMatchObject({ first_frame_url: START, last_frame_url: END });
  });
});

describe("Chaining", () => {
  it("sets the next start to the current end instantly, keeps the prompt and clears the line", () => {
    render(<StudioClipPanel />);
    fillShot("Rainy alley");
    fireEvent.change(screen.getByLabelText("Dialogue"), { target: { value: "Who's there?" } });
    fireEvent.click(screen.getByText("Chain next shot"));
    expect(invoke).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Start frame (required)")).toHaveValue(END);
    expect(screen.getByLabelText("End frame (required)")).toHaveValue("");
    expect(screen.getByLabelText("Shot description")).toHaveValue("Rainy alley");
    expect(screen.getByLabelText("Dialogue")).toHaveValue("");
  });
});

describe("Automatic failover", () => {
  it("dispatches the exact 9 fields with the identical seed and last_frame_url, and records the fallback", async () => {
    queue({ data: { job_id: "p1" } }, { data: { status: "FAILED", error: "worker crashed" } }, ok("b1"));
    render(<StudioClipPanel />);
    fillShot();
    fireEvent.change(screen.getByLabelText("Dialogue"), { target: { value: "Line" } });
    fireEvent.click(screen.getByText("Generate clip"));
    await waitFor(() => expect(screen.getByLabelText("Shot 1 take 1")).toBeInTheDocument());
    const { action: a1, tier: t1, ...primary } = invoke.mock.calls[0][1].body;
    const { action: a2, tier: t2, ...backup } = invoke.mock.calls[2][1].body;
    expect([a1, a2, t1, t2]).toEqual(["submit", "submit", "primary", "backup"]);
    expect(Object.keys(primary).sort()).toEqual(["aspect_ratio", "camera_motion", "dialogue", "duration_seconds",
      "first_frame_url", "last_frame_url", "prompt", "resolution", "seed"]);
    expect(backup).toEqual(primary);
    expect(backup.last_frame_url).toBe(END);
    expect(typeof backup.seed).toBe("number");
    expect(screen.getByText(/job p1: worker crashed\). Rendered on backup, job b1/)).toBeInTheDocument();
  });
  it("fails over when the primary is unavailable at submit", async () => {
    queue({ error: new Error("endpoint paused") }, ok("b2"));
    render(<StudioClipPanel />);
    fillShot();
    fireEvent.click(screen.getByText("Generate clip"));
    await waitFor(() => expect(screen.getByText(/job not started: endpoint paused/)).toBeInTheDocument());
  });
  it("never retries a manual backup failure, and records the billed failed take without a video", async () => {
    queue({ data: { job_id: "b3" } }, { data: { status: "FAILED", executionTime: 30_000, error: "backup down" } });
    render(<StudioClipPanel />);
    fillShot();
    fireEvent.click(screen.getByText("Use backup engine"));
    await waitFor(() => expect(screen.getByText(/No video — backup down/)).toBeInTheDocument());
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Shot 1 QC")).toHaveTextContent("failed");
    expect(screen.getByText(/Job b3 · seed \d+ · 30.0s GPU · \$0.0208/)).toBeInTheDocument();
  });
});

describe("QC + retake loop", () => {
  it("rejects, retakes with a new seed, approves the new take, keeps the old take and stitches the approved one", async () => {
    queue(ok("one", { last_frame_url: "https://example.com/one-last.png" }), ok("two", { last_frame_url: "https://example.com/two-last.png" }));
    render(<StudioClipPanel />);
    fillShot();
    fireEvent.click(screen.getByText("Generate clip"));
    await waitFor(() => expect(screen.getByLabelText("Shot 1 take 1")).toBeInTheDocument());
    expect(screen.getByLabelText("Shot 1 QC")).toHaveTextContent("needs review");
    fireEvent.click(screen.getByText("Reject take 1"));
    fireEvent.click(screen.getByText("Retake (new seed)"));
    await waitFor(() => expect(screen.getByLabelText("Shot 1 take 2")).toBeInTheDocument());
    const seed1 = invoke.mock.calls[0][1].body.seed;
    const seed2 = invoke.mock.calls[3][1].body.seed;
    expect(seed2).not.toBe(seed1);
    expect(invoke.mock.calls[3][1].body).toMatchObject({ first_frame_url: START, last_frame_url: END });
    fireEvent.click(screen.getByText("Approve take 2"));
    expect(screen.getByLabelText("Shot 1 QC")).toHaveTextContent("passed");
    expect(screen.getByLabelText("Shot 1 take 1")).toHaveAttribute("src", "https://example.com/saved-one.mp4");
    expect(screen.getByText("rejected")).toBeInTheDocument();
    // Both takes billed: 2 × 60s × $2.50/hr = $0.0833 total; 1 approved 10s shot.
    expect(screen.getByTestId("cost-total")).toHaveTextContent("$0.0833");
    expect(screen.getByTestId("cost-per-minute")).toHaveTextContent("$0.5000");
    // Chain continues from the approved take's end.
    fireEvent.click(screen.getByText("Start: previous shot's end"));
    expect(screen.getByLabelText("Start frame (required)")).toHaveValue(END);
  });
});

const take = (over: Partial<StudioTake> = {}): StudioTake => ({ videoUrl: "https://example.com/v.mp4", lastFrame: null, tier: "primary",
  saved: true, status: "needs_review", seed: 1, createdAt: 0, generationSeconds: 60, ...over });
const shot = (over: Partial<StudioShot> = {}): StudioShot => ({ id: Math.random().toString(), prompt: "p", firstFrame: START, lastFrame: END,
  durationSeconds: 10, resolution: "720p", aspectRatio: "16:9", activeTakeIndex: 0, takes: [take()], ...over });

describe("Re-anchoring", () => {
  it("approving a take with a different last frame re-anchors the next shot's start", () => {
    const shots = [shot({ takes: [take(), take({ lastFrame: "https://example.com/new-end.png" })] }), shot()];
    const next = approveTake(shots, 0, 1);
    expect(next[0].activeTakeIndex).toBe(1);
    expect(next[0].takes[1].status).toBe("passed");
    expect(next[1].firstFrame).toBe("https://example.com/new-end.png");
  });
  it("leaves an already-approved dependent shot untouched", () => {
    const shots = [shot({ takes: [take({ lastFrame: "https://example.com/new-end.png" })] }), shot({ takes: [take({ status: "passed" })] })];
    expect(approveTake(shots, 0, 0)[1].firstFrame).toBe(START);
  });
});

describe("Sequence cost summary", () => {
  it("totals every take including rejected ones and divides by approved shots and minutes", () => {
    const shots = [
      shot({ activeTakeIndex: 1, takes: [take({ status: "failed", rejected: true }), take({ status: "passed" })] }),
      shot({ durationSeconds: 20, takes: [take({ status: "passed", generationSeconds: 120 })] }),
    ];
    const s = sequenceSummary(shots, 2.5);
    expect(s.total).toBeCloseTo((60 + 60 + 120) * 2.5 / 3600);
    expect(s.perApprovedShot).toBeCloseTo(s.total / 2);
    expect(s.perFinishedMinute).toBeCloseTo(s.total / 0.5);
  });
  it("returns $0.00 per shot and per minute while nothing is approved", () => {
    const s = sequenceSummary([shot()], 2.5);
    expect(s.total).toBeGreaterThan(0);
    expect(s.perApprovedShot).toBe(0);
    expect(s.perFinishedMinute).toBe(0);
  });
});

describe("Stitching", () => {
  it.each([true, false])("stitches active takes with the Music soundtrack and keeps the source if saving fails: saved=%s", async (saved) => {
    queue(ok("one"), ok("two"), { data: { job_id: "stitch" } },
      { data: { status: "COMPLETED", output: { output: { url: "https://example.com/final.mp4" } } } },
      { data: { rehosted: saved, url: saved ? "https://example.com/saved-final.mp4" : "https://example.com/final.mp4" } });
    render(<StudioClipPanel />);
    expect(screen.getByRole("button", { name: "Stitch final cut" })).toBeDisabled();
    fillShot();
    fireEvent.click(screen.getByText("Generate clip"));
    await waitFor(() => expect(screen.getByLabelText("Shot 1 take 1")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Approve take 1"));
    fireEvent.click(screen.getByText("Generate clip"));
    await waitFor(() => expect(screen.getByLabelText("Shot 2 take 1")).toBeInTheDocument());
    fireEvent.click(screen.getAllByText("Approve take 1").at(-1)!);
    fireEvent.change(screen.getByLabelText("Sequence soundtrack"), { target: { value: "music" } });
    fireEvent.click(screen.getByRole("button", { name: "Stitch final cut" }));
    await waitFor(() => expect(screen.getByLabelText("Finished video")).toBeInTheDocument());
    expect(invoke.mock.calls[6]).toEqual(["studio-stitch", { body: { action: "submit", video_clips: [
      { url: "https://example.com/saved-one.mp4", shot_index: 0 },
      { url: "https://example.com/saved-two.mp4", shot_index: 1 },
    ], soundtrack_url: "https://example.com/music.mp3" } }]);
    expect(screen.getByText("Stitch job · stitch")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("vidforge_project_state_v1") || "{}").studioSequence.jobId).toBe("stitch");
    expect(screen.getByLabelText("Finished video")).toHaveAttribute("src", saved ? "https://example.com/saved-final.mp4" : "https://example.com/final.mp4");
  });
  it.each(["fallback", "error", "throw"])("retains a completed take when storage returns %s", async (failure) => {
    queue({ data: { job_id: "one" } }, { data: { status: "COMPLETED", output: { video_url: "https://example.com/one.mp4" } } });
    if (failure === "throw") invoke.mockRejectedValueOnce(new Error("Storage unavailable"));
    else invoke.mockResolvedValueOnce(failure === "error" ? { error: new Error("Storage unavailable") } : { data: { rehosted: false, url: "https://example.com/one.mp4" } });
    render(<StudioClipPanel />);
    fillShot();
    fireEvent.click(screen.getByText("Generate clip"));
    await waitFor(() => expect(screen.getByLabelText("Shot 1 take 1")).toHaveAttribute("src", "https://example.com/one.mp4"));
    expect(screen.getByRole("link", { name: "Open video in new tab" })).toHaveAttribute("href", "https://example.com/one.mp4");
  });
});
