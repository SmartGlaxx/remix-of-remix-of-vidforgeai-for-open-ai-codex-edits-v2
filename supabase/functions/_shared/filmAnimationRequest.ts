import type { Shot } from "./filmEngine.ts";

// A board is an intended pose; only an extracted saved-video frame can anchor continuity.
export function filmAnimationRequest(shot: Shot, owner: string, audioMode: string, previous?: Shot) {
  if (shot.transition === "continue" && !shot.frame_path) throw new Error("Waiting for the preceding final frame");
  const image = shot.transition === "continue" ? shot.frame_path : shot.image_path;
  const continuity = shot.transition === "continue"
    ? "Continue the movement from this exact frame. Previous action: " + (previous?.action ?? "") + ". Preserve pose, props, direction and camera."
    : "Start at the composed opening frame.";
  return {
    action: "submit", request_id: shot.request_id, owner_id: owner,
    image_path: image, end_image_path: shot.board_end_path, duration: shot.duration,
    prompt: `${continuity}\n${shot.visual}\nPhysical action: ${shot.action}\n${audioMode === "native" ? `Native scene sound; dialogue, if appropriate: ${shot.line}` : "Environmental sound only. No speech, no dialogue, no music; narration will be added separately."}`.slice(0, 4000),
  };
}