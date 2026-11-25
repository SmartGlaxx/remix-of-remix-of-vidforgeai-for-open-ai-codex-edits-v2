import { expect, it } from "vitest";
import { advanceFilm, type Film, type FilmServices, type Shot } from "../../supabase/functions/_shared/filmEngine";
import { assemblies, draftDirections } from "../../supabase/functions/_shared/filmWorkflow";
import { planCharacterFilm } from "../../supabase/functions/_shared/characterFilmPlan";

// A complete stand-in for Pruna + stitch + storage: same states, same rules, no paid provider calls.
// `submitted` counts paid predictions only; later checks of the same attempt are free polls.
function harness(seconds: number, options: { clipDelay?: number; failStitchKey?: string; billingError?: string } = {}) {
  const script = "A small habit changes the whole day. ".repeat(Math.max(12, Math.round(seconds / 4)));
  const directions = draftDirections(script, seconds, "owner/reference.png");
  const film: Film = { id: "film-1", owner_id: "owner", state: "running", seconds, audio_mode: "native", narration: [], chapters: assemblies(seconds) };
  const shots: Shot[] = directions.map(d => ({
    index: d.index, chapter: d.chapter, duration: d.duration, line: d.line, purpose: d.purpose,
    visual: d.visual, action: d.action, transition: d.transition, image_path: d.image_path,
    id: "shot-" + d.index, request_id: "req-" + d.index, state: "pending",
  }));
  const submitted = new Map<string, number>();
  const polls = new Map<string, number>();
  const stitched = new Map<string, number>();
  const framed = new Map<string, number>();
  const saves: string[] = [];
  const stitchInputs: Record<string, { url: string; shot_index: number }[]> = {};

  const services: FilmServices = {
    load: async () => ({ film: structuredClone(film), shots: structuredClone(shots) }),
    film: async values => { Object.assign(film, structuredClone(values)); },
    shot: async (id, values) => { const target = shots.find(s => s.id === id); if (target) Object.assign(target, structuredClone(values)); },
    animate: async shot => {
      const seen = (polls.get(shot.request_id) ?? 0) + 1;
      polls.set(shot.request_id, seen);
      if (!submitted.has(shot.request_id)) submitted.set(shot.request_id, 1);
      if (options.billingError) return { id: "job-" + shot.index, state: "failed", error: options.billingError };
      if (seen <= (options.clipDelay ?? 0)) return { id: "job-" + shot.index, state: "generating" };
      return { id: "job-" + shot.index, state: "ready", video_path: `owner/clip-${shot.index}.mp4` };
    },
    frame: async shot => { framed.set(shot.request_id, (framed.get(shot.request_id) ?? 0) + 1); return { path: `owner/frame-${shot.index}.jpg` }; },
    stitch: async (assembly, inputs) => {
      const count = (stitched.get(assembly.key) ?? 0) + 1;
      stitched.set(assembly.key, count);
      stitchInputs[assembly.key] = inputs;
      if (assembly.key === options.failStitchKey && count === 1) return { state: "failed", error: "Stitch failed. Retry assembly from saved clips." };
      if (!assembly.job_id) return { job_id: "job-" + assembly.key, state: "queued" };
      return { job_id: assembly.job_id, state: "saving", output_url: `https://replicate.delivery/${assembly.key}.mp4` };
    },
    save: async (_url, key) => { const path = `owner/film-film-1-${key}.mp4`; saves.push(path); return path; },
    video: async path => `https://saved.test/${path}`,
    audio: async path => `https://saved.test/${path}`,
  };
  const run = async (limit = 400) => {
    for (let tick = 0; tick < limit && !["ready", "attention", "billing_paused", "stopped"].includes(film.state); tick++) await advanceFilm(services);
    return { film, shots, submitted, polls, stitched, framed, saves, stitchInputs };
  };
  return { film, shots, services, run };
}

it("finishes the 3-minute film as 18 clips, 2 chapter MP4s and one final MP4", async () => {
  const result = await harness(180).run();
  expect(result.film.state).toBe("ready");
  expect(result.shots).toHaveLength(18);
  expect(result.shots.every(s => s.state === "ready" && s.video_path)).toBe(true);
  expect(result.submitted.size).toBe(18);
  expect(result.saves).toEqual(["owner/film-film-1-chapter-0.mp4", "owner/film-film-1-chapter-1.mp4", "owner/film-film-1-final.mp4"]);
  expect(result.stitchInputs["final"].map(i => i.url)).toEqual([
    "https://saved.test/owner/film-film-1-chapter-0.mp4",
    "https://saved.test/owner/film-film-1-chapter-1.mp4",
  ]);
  expect(result.film.final_video_path).toBe("owner/film-film-1-final.mp4");
  expect(planCharacterFilm(180).estimatedUsd).toBe(0.9);
});

it("drains the 30-minute / 180-clip plan with one paid prediction per shot and 16 saved MP4s", async () => {
  const result = await harness(1800).run();
  expect(result.film.state).toBe("ready");
  expect(result.submitted.size).toBe(180);
  expect(result.saves).toHaveLength(16);
  expect(result.film.final_video_path).toBe("owner/film-film-1-final.mp4");
  expect(planCharacterFilm(1800).estimatedUsd).toBe(9);
}, 60000);

it("never pays for the same shot twice across repeated ticks or a worker restart", async () => {
  const { film, services, run } = harness(60, { clipDelay: 2 });
  await advanceFilm(services);
  expect(film.state).toBe("running");
  const result = await run();
  expect(result.film.state).toBe("ready");
  expect(result.submitted.size).toBe(6);
  // Later attempts were free status checks of the same prediction, not new submissions.
  expect([...result.polls.values()].some(n => n > 1)).toBe(true);
});

it("pauses the queue on a billing failure and keeps every saved clip", async () => {
  const result = await harness(60, { billingError: "Replicate billing needs credit. Add credit to Replicate." }).run();
  expect(result.film.state).toBe("billing_paused");
  expect(result.film.error).toMatch(/billing/i);
  expect(result.saves).toEqual([]);
  expect(result.submitted.size).toBe(1);
  expect(result.shots.filter(s => s.state === "ready").length).toBe(0);
});

it("retries a failed assembly from saved clips without regenerating a single clip", async () => {
  const { film, run } = harness(180, { failStitchKey: "chapter-0" });
  const first = await run();
  expect(first.film.state).toBe("attention");
  expect(first.film.error).toMatch(/Stitch failed/i);
  const clipsBefore = first.submitted.size;
  // The owner's "retry assembly" action re-arms only the failed chapter.
  const chapters = film.chapters.map(a => ({ ...a }));
  const target = chapters.find(a => a.state === "failed");
  expect(target).toBeTruthy();
  target!.state = "pending"; delete target!.job_id; delete target!.output_url;
  film.chapters = chapters; film.state = "assembling"; film.error = undefined;
  const second = await run();
  expect(second.film.state).toBe("ready");
  expect(second.submitted.size).toBe(clipsBefore);
  expect(second.stitched.get("chapter-0")).toBeGreaterThan(1);
  expect(second.saves).toEqual(["owner/film-film-1-chapter-0.mp4", "owner/film-film-1-chapter-1.mp4", "owner/film-film-1-final.mp4"]);
});

it("waits for the prerequisite clip before a continuation shot and uses its extracted frame", async () => {
  const { shots, run } = harness(60);
  shots[1].transition = "continue";
  const result = await run();
  expect(result.film.state).toBe("ready");
  expect(result.framed.get("req-1")).toBe(1);
  expect(result.shots[1].frame_path).toBe("owner/frame-1.jpg");
  // The continuation could only start once its prerequisite was saved.
  expect([...result.submitted.keys()].indexOf("req-1")).toBeGreaterThan(0);
});

it("stops a running film and refuses further submissions", async () => {
  const { film, services, run } = harness(180, { clipDelay: 3 });
  await advanceFilm(services);
  film.state = "stopped";
  const result = await run();
  expect(result.film.state).toBe("stopped");
  expect(result.submitted.size).toBeLessThanOrEqual(2);
});
