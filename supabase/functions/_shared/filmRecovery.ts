import type { Shot } from "./filmEngine.ts";
import { anchorDirectedChapter, validateDirectedChapter, type DirectedChapter, type FrameCheck } from "./automaticDirection.ts";

export function needsActionReplan(shot: Shot, check: FrameCheck) {
  return Boolean(shot.direction && check.offending_frame === "end" && (!check.camera || !check.landmarks) && (shot.correction_attempts ?? 0) >= 2);
}

// Preserve the actual opening and narration; simplify motion, never move the room to fit it.
export function validateRecoveryPlan(plan: DirectedChapter, shots: Shot[]): DirectedChapter {
  const first = shots[0];
  if (!first?.direction || shots.some(shot => shot.animation_id || shot.state !== "pending")) throw new Error("Only unstarted shots can be replanned.");
  if (plan.shots.length !== shots.length) throw new Error("Recovery must retain the saved shot count and duration.");
  const anchored = anchorDirectedChapter(plan);
  const opening = anchored.shots[0];
  if (opening.direction.scene_id !== first.direction.scene_id || opening.direction.camera !== first.direction.camera || opening.direction.start_pose !== first.direction.start_pose || opening.direction.start_state !== first.direction.start_state) throw new Error("Recovery must preserve the actual opening pose, camera and scene.");
  anchored.shots[0].transition = first.transition as "cut" | "continue";
  for (const [index, event] of anchored.shots.entries()) {
    if (event.line !== shots[index].line || event.duration !== shots[index].duration) throw new Error("Recovery cannot change narration or shot durations.");
    if (index > 0 && event.transition === "cut") continue;
    if (event.direction.camera !== first.direction.camera || event.direction.scene_id !== first.direction.scene_id) throw new Error("A new camera or location requires a deliberate cut.");
  }
  validateDirectedChapter({ ...anchored, shots: [{ ...anchored.shots[0], transition: "cut" }, ...anchored.shots.slice(1)] }, shots.reduce((n, shot) => n + shot.duration, 0), shots.length, undefined, plan.scenes);
  return anchored;
}