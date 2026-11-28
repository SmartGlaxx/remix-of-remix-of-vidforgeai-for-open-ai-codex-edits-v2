import type { Shot } from "./filmEngine.ts";
import { assertPreparedShot, independentShot, requiresExtraction } from "./automaticDirection.ts";

// Reviewed shared boundaries are eligible for parallel rendering; legacy continuation uses extracted output.
export function filmAnimationRequest(shot: Shot, owner: string, audioMode: string, previous?: Shot) {
  assertPreparedShot(shot, previous);
  if (requiresExtraction(shot) && !shot.frame_path) throw new Error("Waiting for the preceding final frame");
  const image = requiresExtraction(shot) ? shot.frame_path : shot.board_start_path ?? shot.image_path;
  const continuity = shot.transition === "continue"
    ? "Continue the movement from this exact frame. Previous action: " + (previous?.action ?? "") + ". Preserve pose, props, direction and camera."
    : "Start at the composed opening frame.";
  return {
    action: "submit", request_id: shot.request_id, owner_id: owner,
    image_path: image, end_image_path: independentShot(shot) ? undefined : shot.board_end_path, duration: shot.duration,
    prompt: `${continuity}\n${shot.direction?.motion_prompt ?? `${shot.visual}\nPhysical action: ${shot.action}`}\nOne continuous take. No dissolve, frozen-picture crossfade, midpoint cut or camera morph.\n${audioMode === "native" ? `Native scene sound; dialogue, if appropriate: ${shot.line}` : "Environmental sound only. No speech, no dialogue, no music; narration will be added separately."}`.slice(0, 4000),
  };
}