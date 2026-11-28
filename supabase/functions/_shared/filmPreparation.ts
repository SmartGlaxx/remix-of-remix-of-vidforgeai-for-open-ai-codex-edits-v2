import { openingTag, tightRegion, validRegion, type EditRegion } from "./frameMask.ts";
import type { Film, Shot } from "./filmEngine.ts";
import { needsActionReplan, validateRecoveryPlan } from "./filmRecovery.ts";
import { anchorDirectedChapter, cutDirectedChapter, independentShot, checkPassed, reservePreparationCall, sceneFramePrompt, validateDirectedChapter, type DirectedChapter, type FrameEditReceipt, type FrameCheck, type Preparation, type SceneRecord } from "./automaticDirection.ts";

export interface PreparationServices {
  load(): Promise<{ film: Film; shots: Shot[] }>;
  film(values: Partial<Film>): Promise<void>;
  shot(id: string, values: Partial<Shot>): Promise<void>;
  script(topic: string, seconds: number): Promise<string>;
  observe(path: string, script: string): Promise<SceneRecord>;
  plan(lines: string[], seconds: number, scenes: SceneRecord[], previous?: Shot): Promise<DirectedChapter>;
  replan(shots: Shot[], scene: SceneRecord, check: FrameCheck): Promise<DirectedChapter>;
  install(chapter: number, plan: DirectedChapter): Promise<void>;
  draw(source: string, target: string, prompt: string, region?: FrameCheck["edit_region"]): Promise<void | FrameEditReceipt>;
  locate(opening: string, shot: Shot): Promise<EditRegion>;
  exists(path: string): Promise<boolean>;
  review(shot: Shot, scene: SceneRecord): Promise<FrameCheck>;
}

// One provider operation per durable tick. Intent and allowance are saved BEFORE each call.
export async function prepareFilm(s: PreparationServices) {
  const { film, shots } = await s.load();
  const p = film.preparation;
  if (film.state !== "preparing" || !p) return;
  if (p.task) throw new Error("Preparation was interrupted during " + p.task + ". No automatic duplicate request was sent; saved work is retained.");
  const edits = [...(p.edits ?? [])];
  const persist = async (next: Preparation) => s.film({ preparation: { ...next, edits } });
  const draw: PreparationServices["draw"] = async (...args) => { const receipt = await s.draw(...args); if (receipt) edits.push(receipt); return receipt; };
  async function endingRegion(shot: Shot, state: Preparation, suggestion?: FrameCheck["edit_region"]) {
    const opening = shot.board_start_path;
    if (!opening) throw new Error("An opening frame is required to localize movement.");
    if (tightRegion(suggestion)) return { region: suggestion, budget: state.budget };
    if (tightRegion(shot.direction?.edit_region)) return { region: shot.direction.edit_region, budget: state.budget };
    const previous = edits.find(edit => edit.source === opening && edit.target === shot.board_end_path);
    if (tightRegion(previous?.edit_region)) return { region: previous.edit_region, budget: state.budget };
    // Check image allowance before spending a vision call. The caller reserves the image before drawing.
    reservePreparationCall(state.budget, "image");
    const budget = reservePreparationCall(state.budget, "check");
    await persist({ ...state, budget, task: "localizing movement " + shot.id });
    const region = await s.locate(opening, shot);
    if (!validRegion(region)) throw new Error("Invalid localized movement in the opening frame.");
    return { region, budget };
  }
  if (p.phase === "script") {
    await persist({ ...p, task: "script" });
    const script = await s.script(p.topic ?? "", film.seconds);
    await s.film({ script, preparation: { ...p, phase: "scene", task: null } });
    return;
  }
  if (p.phase === "scene") {
    const budget = reservePreparationCall(p.budget, "check");
    await persist({ ...p, budget, task: "reference scene inspection" });
    const scene = await s.observe(film.image_path ?? "", film.script ?? "");
    await s.film({ scenes: [{ ...scene, reference_path: film.image_path }], preparation: { ...p, budget, phase: "direction", task: null } });
    return;
  }
  if (p.phase === "direction") {
    const chapter = film.chapters[p.chapter];
    if (!chapter) { await persist({ ...p, phase: "frames", task: null }); return; }
    const group = shots.filter(shot => shot.chapter === p.chapter);
    const chapterSeconds = group.reduce((sum, shot) => sum + shot.duration, 0);
    // Use script slices by chapter, not stale generic lines after topic writing.
    const words = (film.script ?? "").trim().split(/\s+/);
    const line = words.slice(Math.floor(p.chapter * words.length / film.chapters.length), Math.floor((p.chapter + 1) * words.length / film.chapters.length)).join(" ");
    const previous = shots.filter(shot => shot.chapter < p.chapter).at(-1);
    await persist({ ...p, task: "direction chapter " + (p.chapter + 1) });
    const chapterWords = line.split(/\s+/);
    const lines = group.map((_, i) => chapterWords.slice(Math.floor(i * chapterWords.length / group.length), Math.floor((i + 1) * chapterWords.length / group.length)).join(" "));
    const directed = await s.plan(lines, chapterSeconds, film.scenes ?? [], previous);
    const plan = p.shot_style === "cuts" ? cutDirectedChapter(directed) : anchorDirectedChapter(directed, previous);
    validateDirectedChapter(plan, chapterSeconds, Math.ceil(chapterSeconds / 5), previous, film.scenes);
    if (plan.shots.map(shot => shot.line).join(" ").replace(/\s+/g, " ").trim() !== line.replace(/\s+/g, " ").trim()) throw new Error("The director changed the narration. Saved script retained; no video submitted.");
    await s.install(p.chapter, plan);
    await persist({ ...p, chapter: p.chapter + 1, task: null });
    return;
  }
  if (p.phase === "replan") {
    const failed = shots.find(shot => shot.id === p.recovery_shot);
    const scene = film.scenes?.find(scene => scene.id === failed?.direction?.scene_id);
    if (!failed?.frame_check || !scene || !failed.direction) throw new Error("Recovery context is missing.");
    if ((p.replans?.[failed.id] ?? 0) >= 1) throw new Error("The bounded action replan is exhausted. Saved frames retained; no video submitted.");
    // Reserve both operation intent and its allowance before any planner request.
    const budget = reservePreparationCall(p.budget, "check");
    const replans = { ...p.replans, [failed.id]: 1 };
    await persist({ ...p, budget, replans, task: "replanning action " + failed.id });
    const affected = shots.filter(shot => shot.chapter === failed.chapter && shot.index >= failed.index);
    const plan = validateRecoveryPlan(await s.replan(affected, scene, failed.frame_check), affected);
    for (const [index, event] of plan.shots.entries()) {
      const shot = affected[index];
      await s.shot(shot.id, { ...event, correction_attempts: 0, frame_check: null, board_end_path: undefined,
        ...(index > 0 ? { board_start_path: undefined, image_path: film.image_path ?? "" } : {}) });
    }
    // Later chapters must be directed against the new authoritative ending state.
    for (const next of shots.filter(shot => shot.chapter > failed.chapter)) {
      if (next.animation_id || next.state !== "pending") throw new Error("Cannot replace started downstream work.");
      await s.shot(next.id, { direction: undefined, board_start_path: undefined, board_end_path: undefined, frame_check: null });
    }
    await persist({ ...p, budget, replans, task: null, recovery_shot: undefined, phase: "direction", frame_revision: (p.frame_revision ?? 0) + 1, chapter: failed.chapter + 1 });
    return;
  }
  // A film paused before movement masks shipped can already have a rejected ending
  // and two spent corrections. Reviewing that same saved image again cannot repair it.
  if (p.phase === "review" || p.phase === "frames") {
    const legacy = shots.find(shot => {
      const prefix = film.owner_id + "/boards/" + shot.id + "-";
      const path = shot.board_end_path;
      return !independentShot(shot) && shot.direction && shot.board_start_path && path?.startsWith(prefix)
        && /^(?:auto-end|corrected-end)-\d+-r\d+\.png$/.test(path.slice(prefix.length))
        && shot.frame_check?.offending_frame === "end" && !checkPassed(shot.frame_check);
    });
    if (legacy) {
      if (p.phase === "review") {
        await persist({ ...p, phase: "frames" });
        return;
      }
      const chain = [legacy];
      for (const next of shots.filter(item => item.index > legacy.index)) {
        const prior = chain[chain.length - 1];
        if (next.index !== prior.index + 1 || next.transition !== "continue"
          || next.direction?.continuity !== "shared" || !prior.board_end_path
          || next.board_start_path !== prior.board_end_path) break;
        chain.push(next);
      }
      if (chain.some(item => item.state !== "pending" || item.animation_id)) throw new Error("Cannot replace a storyboard for a started shot.");
      // Clear dependants first. If interrupted, the rejected root remains discoverable.
      for (const item of chain.reverse()) {
        await s.shot(item.id, { board_end_path: undefined, frame_check: null,
          ...(item.id === legacy.id ? {} : { board_start_path: undefined, image_path: film.image_path ?? "" }) });
      }
      return;
    }
  }
  if (p.phase === "frames") {
    for (const scene of film.scenes ?? []) {
      if (!scene.reference_path) throw new Error("The location has no canonical reference path.");
      if (!(await s.exists(scene.reference_path))) {
        const budget = reservePreparationCall(p.budget, "image");
        await persist({ ...p, budget, task: "scene reference " + scene.id });
        await draw(film.image_path ?? "", scene.reference_path, "Establish this ONE scene and its cast in a single reference view. " + JSON.stringify(scene));
        await persist({ ...p, budget, task: null });
        return;
      }
    }
    for (const shot of shots) {
      if (!shot.direction) throw new Error("Shot direction is incomplete.");
      const scene = film.scenes?.find(scene => scene.id === shot.direction?.scene_id);
      if (!scene) throw new Error("Scene reference is missing.");
      const previous = shots.find(item => item.index === shot.index - 1);
      if (!shot.board_start_path) {
        const shared = shot.transition === "continue" && shot.direction.continuity === "shared";
        if (shared && !previous?.board_end_path) throw new Error("The shared ending frame must be saved first.");
        const target = shared ? previous?.board_end_path : shot.index === 0 ? film.image_path : `${film.owner_id}/boards/${shot.id}-auto-start-${shot.correction_attempts ?? 0}-r${p.frame_revision ?? 0}.png`;
        if (!target) throw new Error("Upload a character reference first.");
        if (!shared && shot.index !== 0 && !(await s.exists(target))) {
          const budget = reservePreparationCall(p.budget, "image");
          await persist({ ...p, budget, task: "opening frame " + shot.id });
          await draw(scene.reference_path ?? film.image_path ?? "", target, sceneFramePrompt(scene, shot.direction, "start"));
          await persist({ ...p, budget, task: null });
        }
        await s.shot(shot.id, { image_path: target, board_start_path: target });
        return;
      }
      if (!independentShot(shot) && !shot.board_end_path) {
        const target = `${film.owner_id}/boards/${shot.id}-auto-end-masked-${await openingTag(shot.board_start_path)}-${shot.correction_attempts ?? 0}-r${p.frame_revision ?? 0}.png`;
        if (!(await s.exists(target))) {
          let region = shot.direction.edit_region;
          if (p.located_ending?.target === target && validRegion(p.located_ending.region)) {
            region = p.located_ending.region;
          } else if (!tightRegion(region)) {
            const located = await endingRegion(shot, p);
            await persist({ ...p, budget: located.budget, located_ending: { target, region: located.region }, task: null });
            return;
          }
          const budget = reservePreparationCall(p.budget, "image");
          await persist({ ...p, budget, task: "ending frame " + shot.id });
          await draw(shot.board_start_path, target, sceneFramePrompt(scene, shot.direction, "end"), region);
          await persist({ ...p, budget, located_ending: undefined, task: null });
        }
        await s.shot(shot.id, { board_end_path: target });
        return;
      }
    }
    await persist({ ...p, phase: "review" });
    return;
  }
  if (p.phase === "review") {
    const shot = shots.find(shot => !checkPassed(shot.frame_check));
    if (!shot) { await s.film({ state: p.authorized ? "running" : "draft", preparation: { ...p, edits, phase: "ready" }, error: undefined }); return; }
    const scene = film.scenes?.find(scene => scene.id === shot.direction?.scene_id);
    if (!scene || !shot.direction) throw new Error("Cannot review a shot without its scene and event.");
    const budget = reservePreparationCall(p.budget, "check");
    await persist({ ...p, budget, task: "continuity review " + shot.id });
    const check = await s.review(shot, scene);
    if (independentShot(shot) && check.offending_frame !== "start") throw new Error("Opening-frame review returned an invalid result. No video was submitted.");
    await s.shot(shot.id, { frame_check: check });
    const evidence = [...(p.evidence ?? []), { shot_id: shot.id, start: shot.board_start_path ?? "", end: shot.board_end_path ?? "", attempt: shot.correction_attempts ?? 0, check }];
    const reviewed = { ...p, budget, evidence, task: null };
    await persist(reviewed);
    if (!checkPassed(check)) {
      if (needsActionReplan(shot, check) && !(p.replans?.[shot.id])) {
        await persist({ ...reviewed, phase: "replan", recovery_shot: shot.id });
        return;
      }
      if ((shot.correction_attempts ?? 0) >= 2 || check.offending_frame === "start" && !independentShot(shot) && (shot.index === 0 || shot.transition === "continue")) throw new Error("Continuity needs attention: " + check.issues.join("; ") + ". No video was submitted.");
      const correction = (shot.correction_attempts ?? 0) + 1;
      const side = check.offending_frame;
      const correctionSide = side === "end" ? "end-masked-" + await openingTag(shot.board_start_path ?? "") : side;
      const target = `${film.owner_id}/boards/${shot.id}-corrected-${correctionSide}-${correction}-r${p.frame_revision ?? 0}.png`;
      const located = side === "end" ? await endingRegion(shot, reviewed, check.edit_region) : null;
      const correctedBudget = reservePreparationCall(located?.budget ?? budget, "image");
      await persist({ ...reviewed, budget: correctedBudget, task: "correcting " + shot.id });
      await draw(side === "end" ? shot.board_start_path ?? "" : scene.reference_path ?? film.image_path ?? "", target, sceneFramePrompt(scene, shot.direction, side) + "\nCorrect these issues: " + check.correction, located?.region ?? null);
      await s.shot(shot.id, { correction_attempts: correction, frame_check: null, ...(side === "end" ? { board_end_path: target } : { board_start_path: target, image_path: target, board_end_path: undefined }) });
      // A shared boundary is ONE asset, including after repair; downstream endings must be redrawn.
      for (const next of shots.filter(next => next.index > shot.index && next.transition === "continue")) {
        const preceding = shots.find(prev => prev.index === next.index - 1);
        if (next.direction?.continuity !== "shared" || next.board_start_path !== preceding?.board_end_path) break;
        await s.shot(next.id, { board_start_path: next.index === shot.index + 1 ? target : undefined, image_path: next.index === shot.index + 1 ? target : film.image_path ?? "", board_end_path: undefined, frame_check: null });
      }
      await persist({ ...reviewed, phase: "frames", budget: correctedBudget, task: null });
    }
  }
}