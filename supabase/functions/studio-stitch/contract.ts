export const STITCH_ENDPOINT = "j1w8fwnmokl1nf";
export const STITCH_ROUTE = "capscify/stitch-final";

export type StitchParams = {
  video_clips: { url: string; shot_index: number }[];
  soundtrack_url?: string;
  resolution?: string;
};

export function stitchEnvelope(params: StitchParams) {
  return { input: { route: STITCH_ROUTE, params: {
    ...params,
    preserve_clip_audio: true,
    resolution: params.resolution ?? "1280x720",
    music_volume: 0.35,
    ducking: true,
  } } };
}