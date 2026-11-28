import type { Shot } from "./filmEngine.ts";

export type SceneRecord = {
  id: string; layout: string; materials: string; lighting: string;
  cast: { id: string; appearance: string; position: string; facing: string }[];
  props: { id: string; position: string; owner: string; hand: string }[];
  landmarks: { id: string; position: string }[];
  reference_path?: string;
};
export type EventDirection = {
  scene_id: string; camera: string; start_pose: string; end_pose: string;
  edit_region?: FrameCheck["edit_region"];
  movements: string[]; motion_prompt: string;
  start_state: string; end_state: string;
  continuity: "shared" | "extracted" | "independent";
};
export type FrameCheck = {
  identity: boolean; pose: boolean; camera: boolean; lighting: boolean;
  landmarks: boolean; props: boolean; feasible: boolean;
  issues: string[]; correction: string; offending_frame: "start" | "end";
  edit_region?: { x: number; y: number; width: number; height: number } | null;
};
export type FrameEditReceipt = { source: string; target: string; model: string; quality: string; prompt: string; edit_region: FrameCheck["edit_region"]; source_sha256: string; provider_request_id: string | null; status: number };
export type Preparation = { shot_style?: "cuts"; phase: "script" | "scene" | "direction" | "frames" | "review" | "replan" | "ready"; chapter: number; authorized: boolean; topic?: string; budget: PreparationBudget; task?: string | null; recovery_shot?: string; frame_revision?: number; located_ending?: { target: string; region: NonNullable<FrameCheck["edit_region"]> }; edits?: FrameEditReceipt[]; replans?: Record<string, number>; evidence?: { shot_id: string; start: string; end: string; attempt: number; check: FrameCheck }[] };
export type DirectedEvent = { line: string; purpose: string; visual: string; action: string; transition: "cut" | "continue"; duration: number; direction: EventDirection };
export type DirectedChapter = { scenes: SceneRecord[]; shots: DirectedEvent[] };
// New explainers use independent single-image clips; existing paired drafts stay paired.
export function cutDirectedChapter(plan: DirectedChapter): DirectedChapter {
  return { ...plan, shots: plan.shots.map(event => ({ ...event, transition: "cut", direction: { ...event.direction, continuity: "independent", edit_region: null } })) };
}
export function independentShot(shot: Pick<Shot, "direction" | "transition">) {
  return shot.transition === "cut" && shot.direction?.continuity === "independent";
}
export function anchorDirectedChapter(plan: DirectedChapter, previous?: Shot): DirectedChapter {
  let prior = previous?.direction;
  return { ...plan, shots: plan.shots.map(event => {
    const direction = { ...event.direction };
    let transition = event.transition;
    if (transition === "continue" && direction.continuity === "shared") {
      if (!prior || prior.scene_id !== direction.scene_id || prior.camera !== direction.camera) transition = "cut";
      else { direction.start_pose = prior.end_pose; direction.start_state = prior.end_state; }
    }
    prior = direction;
    return { ...event, transition, direction };
  }) };
}
export function validateDirectedChapter(plan: DirectedChapter, seconds: number, maxClips: number, previous?: Shot, knownScenes: SceneRecord[] = []) {
  if (!plan.shots.length || plan.shots.length > maxClips || plan.shots.reduce((n, s) => n + s.duration, 0) !== seconds) throw new Error("The director must fit the selected duration and clip allowance.");
  const sceneIds = new Set([...knownScenes, ...plan.scenes].map(s => s.id));
  let prior = previous;
  for (const [index, event] of plan.shots.entries()) {
    if (!sceneIds.has(event.direction.scene_id) || event.duration < 2 || event.duration > 10 || !Number.isInteger(event.duration) || event.direction.movements.length < 1 || event.direction.movements.length > 5) throw new Error("The director returned an overloaded action or unknown scene.");
    if (event.direction.continuity === "independent" && event.transition !== "cut") throw new Error("Independent explainer shots require a cut.");
    if (event.transition === "continue" && event.direction.continuity === "shared" && (!prior?.direction || event.direction.start_pose !== prior.direction.end_pose || event.direction.start_state !== prior.direction.end_state || event.direction.camera !== prior.direction.camera || event.direction.scene_id !== prior.direction.scene_id)) throw new Error("A camera or scene-state change requires a cut between clips.");
    prior = { ...event, id: "planned-" + index, request_id: "", index, chapter: 0, state: "pending", image_path: "" };
  }
}
export type PreparationBudget = {
  max_video_clips: number; max_image_calls: number; image_calls: number;
  max_check_calls: number; check_calls: number;
};
export function automaticBudget(seconds: number): PreparationBudget {
  const clips = Math.ceil(seconds / 5);
  return { max_video_clips: clips, max_image_calls: clips * 3 + 2, image_calls: 0, max_check_calls: clips * 3, check_calls: 0 };
}
export function reservePreparationCall(budget: PreparationBudget, kind: "image" | "check"): PreparationBudget {
  const key = kind === "image" ? "image_calls" : "check_calls";
  const max = kind === "image" ? budget.max_image_calls : budget.max_check_calls;
  if (budget[key] >= max) throw new Error("The displayed preparation allowance is exhausted. Saved frames are retained.");
  return { ...budget, [key]: budget[key] + 1 };
}
export function checkPassed(check?: FrameCheck | null) {
  return Boolean(check && [check.identity, check.pose, check.camera, check.lighting, check.landmarks, check.props, check.feasible].every(value => value === true) && check.issues.length === 0);
}
export function sharesBoundary(shot: Shot, previous?: Shot) {
  return Boolean(shot.direction?.continuity === "shared" && shot.transition === "continue" && previous?.board_end_path &&
    shot.board_start_path === previous.board_end_path && shot.direction.scene_id === previous.direction?.scene_id &&
    shot.direction.camera === previous.direction?.camera && shot.direction.start_state === previous.direction?.end_state &&
    shot.direction.start_pose === previous.direction?.end_pose);
}
export function requiresExtraction(shot: Shot) {
  return shot.transition === "continue" && shot.direction?.continuity !== "shared";
}
export function assertPreparedShot(shot: Shot, previous?: Shot) {
  if (!shot.direction) return; // Legacy films keep the actual-final-frame continuation contract.
  if (shot.direction.continuity === "independent" && !independentShot(shot)) throw new Error("Independent explainer shots require a cut.");
  if (!shot.board_start_path || (!independentShot(shot) && !shot.board_end_path) || !checkPassed(shot.frame_check)) throw new Error("Continuity review must pass before video submission.");
  if (shot.direction.continuity === "shared" && shot.transition === "continue" && !sharesBoundary(shot, previous)) throw new Error("The continuation does not share the preceding ending image and scene state.");
  if (!shot.direction.movements.length || shot.direction.movements.length > 5 || shot.duration < 2 || shot.duration > 10) throw new Error("Split the action into achievable 2–10 second shots.");
}
export function sceneFramePrompt(scene: SceneRecord, direction: EventDirection, side: "start" | "end") {
  return `${JSON.stringify(scene)}\nWorld coordinates are authoritative, not screen-left/right. Camera: ${direction.camera}. ${side === "start" ? direction.start_state : direction.end_state}. Show ONLY the ${side === "start" ? direction.start_pose : direction.end_pose}. ${side === "end" ? "Edit this attached opening frame as the ending of the SAME take. Only the directed character/prop movement changes; lock lens, scale, camera, landmarks, lighting, clothes and background geometry." : "Place the camera using the fixed world-space landmarks. This is one opening composition, not an action sequence."}`;
}