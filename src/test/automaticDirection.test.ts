import { webcrypto } from "node:crypto";
import { afterAll, beforeAll, vi, expect, it } from "vitest";
import { advanceFilm, type Film, type Shot, type FilmServices } from "../../supabase/functions/_shared/filmEngine";
import { anchorDirectedChapter, cutDirectedChapter, automaticBudget, assertPreparedShot, checkPassed, reservePreparationCall, sharesBoundary, validateDirectedChapter, type SceneRecord, type EventDirection, type FrameCheck, type DirectedChapter } from "../../supabase/functions/_shared/automaticDirection";
import { filmAnimationRequest } from "../../supabase/functions/_shared/filmAnimationRequest";
import { prepareFilm, type PreparationServices } from "../../supabase/functions/_shared/filmPreparation";
import { validateRecoveryPlan } from "../../supabase/functions/_shared/filmRecovery";
import { maskPixels } from "../../supabase/functions/_shared/frameMask";

beforeAll(() => vi.stubGlobal("crypto", webcrypto));
afterAll(() => vi.unstubAllGlobals());

const scene: SceneRecord = { id: "cafe", layout: "Window west of Daniel; table in front", materials: "Wooden table", lighting: "Window daylight from west", cast: [{ id: "daniel", appearance: "One Daniel, glasses and blue shirt", position: "At chair", facing: "Table north" }], props: [{ id: "teal-mug", position: "Table in front of right hand", owner: "daniel", hand: "right" }, { id: "notebook", position: "Table beside mug", owner: "daniel", hand: "left" }], landmarks: [{ id: "window", position: "west wall" }], reference_path: "owner/original.png" };
const passed: FrameCheck = { identity: true, pose: true, camera: true, lighting: true, landmarks: true, props: true, feasible: true, issues: [], correction: "", offending_frame: "end" };
const direction = (start: string, end: string): EventDirection => ({ scene_id: "cafe", camera: "Medium, camera south of table", start_pose: start, end_pose: end, start_state: start, end_state: end, movements: ["Fingers close around handle", "Mug leaves table", "Elbow bends"], motion_prompt: "Daniel stays seated. His right fingers close around the teal mug handle, then it leaves the table as his elbow bends. His left hand stays on the notebook. Hold the camera. No dissolve or midpoint cut.", continuity: "shared" });
function cafeShots(): (Shot & { direction: EventDirection })[] {
  return ["standing", "seated", "mug raised"].map((start, index) => ({ id: "s" + index, request_id: "r" + index, index, chapter: 0, duration: 10, line: ["Sit down", "Lift mug", "Take a sip"][index], purpose: "Café event", visual: "One Daniel in the café", action: "One physical action", transition: index ? "continue" : "cut", image_path: index ? `owner/end-${index-1}.png` : "owner/original.png", board_start_path: index ? `owner/end-${index-1}.png` : "owner/original.png", board_end_path: `owner/end-${index}.png`, state: "pending", direction: direction(start, ["seated", "mug raised", "sipping"][index]), frame_check: { ...passed } }));
}
it("reuses ONE asset as shot one's seated ending and shot two's opening", () => {
  const shots = cafeShots();
  expect(sharesBoundary(shots[1], shots[0])).toBe(true);
  expect(shots[1].board_start_path).toBe(shots[0].board_end_path);
  const request = filmAnimationRequest(shots[1], "owner", "native", shots[0]);
  expect(request.image_path).toBe("owner/end-0.png");
  expect(request.end_image_path).toBe("owner/end-1.png");
  expect(request.prompt).toContain("fingers close around the teal mug handle");
});
it("rejects a different camera at a shared boundary before submission", () => {
  const shots = cafeShots();
  const next = { ...shots[1], direction: { ...shots[1].direction as EventDirection, camera: "Reverse angle" } };
  expect(() => assertPreparedShot(next, shots[0])).toThrow("does not share");
});
it("makes scene-state sharing authoritative and puts camera changes between clips", () => {
  const shots = cafeShots();
  const second = { ...shots[1], direction: { ...shots[1].direction, start_pose: "restated seated pose", start_state: "restated props" } };
  const third = { ...shots[2], direction: { ...shots[2].direction, camera: "Reverse angle" } };
  const anchored = anchorDirectedChapter({ scenes: [scene], shots: [shots[0], second, third] });
  expect(anchored.shots[1].direction.start_pose).toBe(anchored.shots[0].direction.end_pose);
  expect(anchored.shots[1].direction.start_state).toBe(anchored.shots[0].direction.end_state);
  expect(anchored.shots[2].transition).toBe("cut");
  expect(() => validateDirectedChapter(anchored, 30, 6)).not.toThrow();
});
it.each(["identity", "pose", "camera", "lighting", "landmarks", "props", "feasible"] as const)("blocks video when the %s review fails", dimension => {
  const shots = cafeShots();
  const bad = { ...shots[0], frame_check: { ...passed, [dimension]: false } };
  expect(checkPassed(bad.frame_check)).toBe(false);
  expect(() => filmAnimationRequest(bad, "owner", "native")).toThrow("review must pass");
});
it("permits shorter actions while requiring exactly 30 seconds within the allowance", () => {
  const shots = cafeShots();
  const events = [...shots.map(shot => ({ ...shot, duration: 8 })), { ...shots[2], transition: "cut" as const, duration: 6 }];
  expect(() => validateDirectedChapter({ scenes: [scene], shots: events }, 30, 6)).not.toThrow();
  expect(() => validateDirectedChapter({ scenes: [scene], shots: events }, 29, 6)).toThrow("selected duration");
  expect(() => validateDirectedChapter({ scenes: [scene], shots: [{ ...events[0], duration: 11 }] }, 11, 6)).toThrow("overloaded");
});
it("bounds correction requests by the displayed preparation allowance", () => {
  let budget = automaticBudget(30);
  expect(budget.max_video_clips).toBe(6);
  expect(budget.max_image_calls).toBe(20);
  expect(budget.max_check_calls).toBe(18);
  for (let i = 0; i < 20; i++) budget = reservePreparationCall(budget, "image");
  expect(() => reservePreparationCall(budget, "image")).toThrow("allowance is exhausted");
});
it("starts eligible shared-boundary jobs together without waiting for a preceding render", async () => {
  const shots = cafeShots();
  const film: Film = { id: "film", owner_id: "owner", seconds: 30, audio_mode: "native", state: "running", chapters: [], narration: [] };
  const submitted: string[] = [];
  const services: FilmServices = { load: async () => ({ film, shots }), film: async v => { Object.assign(film, v); }, shot: async (id, v) => { const shot = shots.find(s => s.id === id); if (shot) Object.assign(shot, v); }, animate: async shot => { submitted.push(shot.id); return { id: "job" + shot.id, state: "generating" }; }, frame: async () => { throw new Error("Shared shots must not extract"); }, stitch: async () => ({ state: "queued" }), save: async () => "", video: async () => "", audio: async () => "" };
  await advanceFilm(services);
  expect(submitted).toEqual(["s0", "s1"]);
  expect(shots[0].state).toBe("generating");
  expect(shots[1].state).toBe("generating");
});

function preparationHarness(authorized = false) {
  const shots: Shot[] = cafeShots().map(shot => ({ ...shot, board_start_path: undefined, board_end_path: undefined, frame_check: null }));
  const film: Film = { id: "film", owner_id: "owner", image_path: "owner/original.png", script: "Sit down Lift mug Take a sip", seconds: 30, audio_mode: "native", state: "preparing", scenes: [scene], chapters: [{ key: "chapter-0", indices: [0, 1, 2], state: "pending" }], narration: [], preparation: { phase: "frames", chapter: 1, authorized, budget: automaticBudget(30) } };
  const images = new Set(["owner/original.png"]);
  const draws: { source: string; target: string; prompt: string; region?: FrameCheck["edit_region"] }[] = [];
  let plans = 0;
  const services: PreparationServices = { replan: async () => ({ scenes: [scene], shots: cafeShots() }), load: async () => ({ film: structuredClone(film), shots: structuredClone(shots) }), film: async values => { Object.assign(film, values); }, shot: async (id, values) => { const shot = shots.find(shot => shot.id === id); if (shot) Object.assign(shot, values); }, script: async () => "Sit down Lift mug Take a sip", observe: async()=>scene, plan: async () => { plans++; return { scenes: [scene], shots: cafeShots() }; }, install: async (_chapter, plan: DirectedChapter) => { shots.splice(0, shots.length, ...plan.shots.map((shot, i) => ({ ...shot, id: "s" + i, request_id: "r" + i, index: i, chapter: 0, state: "pending", image_path: "owner/original.png" }))); }, locate: async () => ({ x: 0.3, y: 0.4, width: 0.15, height: 0.1 }), draw: async (source, target, prompt, region) => { draws.push({ source, target, prompt, region }); images.add(target); return { source, target, prompt, edit_region: region ?? null, model: "test", quality: "test", status: 200, source_sha256: "test", provider_request_id: null }; }, exists: async path => images.has(path), review: async () => ({ ...passed }) };
  return { film, shots, services, draws, plans: () => plans };
}
it("prepares the café across fresh worker ticks using original opening and attached-start edits, without video authorization", async () => {
  const h = preparationHarness();
  for (let i = 0; i < 20 && h.film.state === "preparing"; i++) await prepareFilm({ ...h.services });
  expect(h.film.state).toBe("draft");
  expect(h.film.preparation?.phase).toBe("ready");
  expect(h.shots[0].board_start_path).toBe("owner/original.png");
  expect(h.draws).toHaveLength(3);
  expect(h.draws.every(draw => draw.region?.width === 0.15)).toBe(true);
  expect(h.draws[1].source).toBe(h.shots[0].board_end_path);
  expect(h.shots[1].board_start_path).toBe(h.shots[0].board_end_path);
  expect(h.shots[2].board_start_path).toBe(h.shots[1].board_end_path);
  expect(h.shots.every(shot => checkPassed(shot.frame_check))).toBe(true);
});
it("only transitions to video rendering after explicit one-click authorization and all reviews pass", async () => {
  const h = preparationHarness(true);
  for (let i = 0; i < 20 && h.film.state === "preparing"; i++) await prepareFilm(h.services);
  expect(h.film.state).toBe("running");
  expect(h.shots.every(shot => checkPassed(shot.frame_check))).toBe(true);
});
it("never repeats an uncertain planner request after restart", async () => {
  const h = preparationHarness();
  if (!h.film.preparation) throw new Error("Missing fixture preparation");
  h.film.preparation.phase = "direction";
  h.film.preparation.chapter = 0;
  h.services.plan = async () => { throw new Error("Interrupted response"); };
  await expect(prepareFilm(h.services)).rejects.toThrow("Interrupted response");
  await expect(prepareFilm({ ...h.services })).rejects.toThrow("No automatic duplicate request");
  expect(h.plans()).toBe(0);
});
it("replans after two camera/location corrections and preserves the opening", async () => {
  const h = preparationHarness();
  let calls = 0;
  h.services.review = async () => ++calls <= 3 ? { ...passed, camera: false, landmarks: false, issues: ["Camera changed"], correction: "Keep camera" } : { ...passed };
  let replans = 0;
  h.services.replan = async () => { replans++; return { scenes: [scene], shots: cafeShots() }; };
  for (let i = 0; i < 40 && h.film.state === "preparing"; i++) await prepareFilm(h.services);
  expect(replans).toBe(1);
  expect(h.film.state).toBe("draft");
  expect(h.shots[0].board_start_path).toBe("owner/original.png");
  expect(h.film.preparation?.evidence?.filter(e => !e.check.camera)).toHaveLength(3);
  expect(h.shots[1].board_start_path).toBe(h.shots[0].board_end_path);
});
it("does not repeat an uncertain recovery request or exceed its image allowance", async () => {
  const h = preparationHarness();
  if (!h.film.preparation) throw new Error("Missing preparation");
  h.film.preparation.phase = "replan"; h.film.preparation.recovery_shot = "s0";
  h.shots[0].board_start_path = "owner/original.png";
  h.shots[0].frame_check = { ...passed, camera: false, landmarks: false };
  let requests = 0;
  h.services.replan = async () => { requests++; throw new Error("Interrupted replan"); };
  await expect(prepareFilm(h.services)).rejects.toThrow("Interrupted replan");
  await expect(prepareFilm(h.services)).rejects.toThrow("No automatic duplicate request");
  expect(requests).toBe(1);
  expect(h.film.preparation.budget.image_calls).toBe(0);
});
it("rejects recovery that invents a seated opening or changes narration", () => {
  const shots = cafeShots();
  const plan = { scenes: [scene], shots: cafeShots() };
  plan.shots[0].direction.start_pose = "already seated";
  expect(() => validateRecoveryPlan(plan, shots)).toThrow("actual opening");
  plan.shots[0].direction.start_pose = "standing";
  plan.shots[1].line = "New narration";
  expect(() => validateRecoveryPlan(plan, shots)).toThrow("narration");
});
it("masks only the moving hand/forearm/mug region and rejects whole-frame edits", () => {
  const pixels = maskPixels(10, 10, { x: 0.2, y: 0.3, width: 0.3, height: 0.2 });
  expect(pixels[(3 * 10 + 2) * 4 + 3]).toBe(0);
  expect(pixels[3]).toBe(255);
  expect(pixels[(5 * 10 + 2) * 4 + 3]).toBe(255);
  expect(() => maskPixels(10, 10, { x: 0, y: 0, width: 1, height: 1 })).toThrow("localized");
});
it("uses a tight directed box without buying a localization call", async () => {
  const h = preparationHarness();
  const region = { x: 0.4, y: 0.6, width: 0.1, height: 0.08 };
  h.shots[0].direction!.edit_region = region;
  h.services.locate = async () => { throw new Error("Unexpected localization"); };
  await prepareFilm(h.services);
  await prepareFilm(h.services);
  expect(h.draws[0].region).toEqual(region);
  expect(h.film.preparation?.budget).toMatchObject({ check_calls: 0, image_calls: 1 });
});

it("localizes a broad suggestion on the actual opening and blocks an invalid result before drawing", async () => {
  const h = preparationHarness();
  h.shots[0].direction!.edit_region = { x: 0, y: 0, width: 1, height: 0.5 };
  h.services.locate = async (opening, shot) => {
    expect(opening).toBe(shot.board_start_path);
    expect(h.film.preparation?.budget.check_calls).toBe(1);
    return { x: 0.95, y: 0, width: 0.1, height: 0.1 };
  };
  await prepareFilm(h.services);
  await expect(prepareFilm(h.services)).rejects.toThrow("Invalid localized");
  expect(h.draws).toHaveLength(0);
  expect(h.film.preparation?.budget.image_calls).toBe(0);
});

it("uses a tight mask even when the reviewer supplies no correction box", async () => {
  const h = preparationHarness();
  let reviews = 0;
  h.services.review = async () => ++reviews === 1
    ? { ...passed, pose: false, issues: ["Card tilted"], correction: "Translate it with the grip fixed", edit_region: null }
    : passed;
  for (let i = 0; i < 40 && h.film.state === "preparing"; i++) await prepareFilm(h.services);
  const repair = h.draws.find(draw => draw.target.includes("-corrected-end"));
  expect(repair?.region).toEqual(h.draws[0].region);
  expect(h.shots[1].board_start_path).toBe(repair?.target);
  expect(h.draws.some(draw => draw.source === repair?.target && draw.target === h.shots[1].board_end_path)).toBe(true);
});

it("resumes a rejected legacy ending at its correction limit and rebuilds only its shared chain", async () => {
  const h = preparationHarness();
  h.film.preparation!.phase = "review";
  Object.assign(h.shots[0], { board_start_path: h.film.image_path, board_end_path: "owner/boards/s0-corrected-end-2-r0.png", correction_attempts: 2,
    frame_check: { ...passed, camera: false, issues: ["Panoramic opening replaced by a closer view"] } });
  Object.assign(h.shots[1], { board_start_path: h.shots[0].board_end_path, board_end_path: "owner/shared.png", frame_check: passed });
  Object.assign(h.shots[2], { transition: "cut", board_start_path: "owner/cut.png", board_end_path: "owner/cut-end.png", frame_check: passed });
  for (let i = 0; i < 20 && h.film.state === "preparing"; i++) await prepareFilm(h.services);
  expect(h.film.state).toBe("draft");
  expect(h.draws).toHaveLength(2);
  expect(h.draws[0].source).toBe("owner/original.png");
  expect(h.draws[1].source).toBe(h.draws[0].target);
  expect(h.draws.every(edit => edit.region && edit.target.includes("-masked-"))).toBe(true);
  expect(h.shots[0].correction_attempts).toBe(2);
  expect(h.shots[2].board_end_path).toBe("owner/cut-end.png");
  expect(h.film.preparation?.budget.image_calls).toBe(2);
});

it("directs new explainers as independent cuts without rewriting narration or durations", () => {
  const original = cafeShots();
  const plan = cutDirectedChapter({ scenes: [scene], shots: original });
  expect(plan.shots.map(shot => shot.transition)).toEqual(["cut", "cut", "cut"]);
  expect(plan.shots.map(shot => shot.direction.continuity)).toEqual(["independent", "independent", "independent"]);
  expect(plan.shots.map(shot => [shot.line, shot.duration])).toEqual(original.map(shot => [shot.line, shot.duration]));
  expect(original[1].transition).toBe("continue");
});

it("prepares a 30-second cut draft using only openings and never masks an ending", async () => {
  const h = preparationHarness();
  h.shots.forEach(shot => {
    shot.transition = "cut";
    if (shot.direction) shot.direction.continuity = "independent";
  });
  h.services.locate = async () => { throw new Error("No ending localization allowed"); };
  h.services.review = async shot => {
    expect(shot.board_start_path).toBeTruthy();
    expect(shot.board_end_path).toBeUndefined();
    return { ...passed, offending_frame: "start" };
  };
  for (let i = 0; i < 20 && h.film.state === "preparing"; i++) await prepareFilm(h.services);
  expect(h.film).toMatchObject({ state: "draft", seconds: 30, preparation: { authorized: false, phase: "ready" } });
  expect(h.draws).toHaveLength(2);
  expect(h.draws.every(draw => draw.region === undefined && draw.target.includes("auto-start"))).toBe(true);
  expect(h.shots.map(shot => filmAnimationRequest(shot, "owner", "native").end_image_path)).toEqual([undefined, undefined, undefined]);
});

it("keeps identity failures blocking single-image cut submissions", () => {
  const shot = { ...cafeShots()[0], board_end_path: undefined, direction: { ...direction("standing", "gesturing"), continuity: "independent" as const }, frame_check: { ...passed, identity: false } };
  expect(() => filmAnimationRequest(shot, "owner", "native")).toThrow("review must pass");
  expect(() => assertPreparedShot({ ...shot, frame_check: passed, transition: "continue" })).toThrow("require a cut");
});

it("rejects a failed cut opening twice without submitting video or endless correction", async () => {
  const h = preparationHarness();
  h.shots.forEach(shot => { shot.transition = "cut"; if (shot.direction) shot.direction.continuity = "independent"; });
  h.services.review = async () => ({ ...passed, identity: false, issues: ["Duplicated host"], correction: "One host only", offending_frame: "start" });
  await expect((async () => { for (let i = 0; i < 30; i++) await prepareFilm(h.services); })()).rejects.toThrow("Continuity needs attention");
  expect(h.film.preparation?.authorized).toBe(false);
  expect(h.shots[0].correction_attempts).toBe(2);
  expect(h.draws.filter(draw => draw.target.includes("corrected-start"))).toHaveLength(2);
});
