export const DEFAULT_STUDIO_DRAFT = {
  startFrame: "", endFrame: "", prompt: "", dialogue: "", duration: 10,
  resolution: "720p" as "720p" | "1080p", aspect: "16:9" as "16:9" | "9:16", camera: "static",
};
export const DEFAULT_SCRIPT_DRAFT = { selectedTone: 0, duration: "8-10 min", hook: "Shocking Fact", language: "English" };
export type MusicSegment = { label: string; mood: string; intensity: number; duration: number };
export const DEFAULT_MUSIC_DRAFT = {
  genreIdx: 0, bpmIdx: 0, mixIdx: 0,
  segments: [
    { label: "Intro Hook", mood: "Mysterious, building tension", intensity: 30, duration: 15 },
    { label: "Rising Action", mood: "Energetic, driving rhythm", intensity: 60, duration: 20 },
    { label: "Climax", mood: "Peak energy, dramatic", intensity: 95, duration: 20 },
    { label: "Resolution", mood: "Reflective, fading out", intensity: 40, duration: 15 },
  ] as MusicSegment[],
};
