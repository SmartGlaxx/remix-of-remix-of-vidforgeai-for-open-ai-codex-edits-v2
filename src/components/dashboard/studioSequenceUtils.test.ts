import { describe, expect, it } from "vitest";
import { STITCH_ENDPOINT, stitchEnvelope } from "../../../supabase/functions/studio-stitch/contract";
import { sequenceVideoUrl } from "./studioSequenceUtils";

describe("Studio stitch contract", () => {
  const clips = [{ url: "https://example.com/1.mp4", shot_index: 0 }, { url: "https://example.com/2.mp4", shot_index: 1 }];
  it("targets the confirmed stitch endpoint with route and params under input", () => {
    expect(STITCH_ENDPOINT).toBe("j1w8fwnmokl1nf");
    expect(stitchEnvelope({ video_clips: clips }).input).toEqual({ route: "capscify/stitch-final", params: {
      video_clips: clips, preserve_clip_audio: true, resolution: "1280x720", music_volume: 0.35, ducking: true,
    } });
  });
  it("preserves native audio by default", () => {
    expect(stitchEnvelope({ video_clips: clips }).input.params.preserve_clip_audio).toBe(true);
  });
  it("passes optional soundtrack without inventing a voiceover ducking trigger", () => {
    const params = stitchEnvelope({ video_clips: clips, soundtrack_url: "https://example.com/music.mp3" }).input.params;
    expect(params.soundtrack_url).toBe("https://example.com/music.mp3");
    expect(params).not.toHaveProperty("voiceover_url");
    expect(params.ducking).toBe(true);
  });
  it("omits soundtrack when no Music track is selected", () => {
    expect(stitchEnvelope({ video_clips: clips }).input.params).not.toHaveProperty("soundtrack_url");
  });
  it("accepts direct and nested HTTPS video outputs, but rejects failures and unsafe URLs", () => {
    expect(sequenceVideoUrl({ video_url: "https://example.com/final.mp4" })).toBe("https://example.com/final.mp4");
    expect(sequenceVideoUrl({ output: { url: "https://example.com/final.mp4" } })).toBe("https://example.com/final.mp4");
    expect(() => sequenceVideoUrl({ output: { error: "FFmpeg failed" } })).toThrow("FFmpeg failed");
    expect(() => sequenceVideoUrl({ url: "http://example.com/final.mp4" })).toThrow();
  });
});