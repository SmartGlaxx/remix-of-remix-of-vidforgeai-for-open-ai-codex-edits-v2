import { expect, it } from "vitest";
import { filmAnimationRequest } from "../../supabase/functions/_shared/filmAnimationRequest";
import { providerInput } from "../../supabase/functions/_shared/prunaContract";
import type { Shot } from "../../supabase/functions/_shared/filmEngine";

const shot: Shot = { id: "shot-1", request_id: "request-1", index: 0, chapter: 0, duration: 10, line: "Daniel sits down.", purpose: "Sit", visual: "Café", action: "Sit down and remain seated", transition: "cut", state: "pending", image_path: "owner/start.png", board_start_path: "owner/start.png", board_end_path: "owner/seated.png" };

it("sends the draft start and end paths through to Pruna image and last_frame_image", () => {
  const request = filmAnimationRequest(shot, "owner", "native");
  expect(request.image_path).toBe("owner/start.png");
  expect(request.end_image_path).toBe("owner/seated.png");
  const input = providerInput("pruna", request.duration, "https://frames.test/start.png", request.prompt, "https://frames.test/seated.png");
  expect(input).toMatchObject({ image: "https://frames.test/start.png", last_frame_image: "https://frames.test/seated.png" });
});

it("anchors shot two on the extracted final frame, not its planned opening board", () => {
  const request = filmAnimationRequest({ ...shot, index: 1, transition: "continue", frame_path: "owner/actual-final.jpg", board_start_path: "owner/planned-opening.png", board_end_path: "owner/mug-raised.png" }, "owner", "native", shot);
  expect(request.image_path).toBe("owner/actual-final.jpg");
  expect(request.end_image_path).toBe("owner/mug-raised.png");
});

it("never submits a continuation without the previous video's final frame", () => {
  expect(() => filmAnimationRequest({ ...shot, transition: "continue" }, "owner", "native")).toThrow("Waiting for the preceding final frame");
});