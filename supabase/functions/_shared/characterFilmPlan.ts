// Shared by the film setup screen and durable worker. All times are whole seconds.
import { ESTIMATED_COST, PRESET } from "./prunaContract.ts";

export const filmPresets = [30, 60, 180, 300, 600, 900, 1800] as const;
const chapterLimit = 120;

export function planCharacterFilm(seconds: number) {
  if (!Number.isInteger(seconds) || seconds < 30 || seconds > 1800) {
    throw new RangeError("Choose a duration from 30 to 1,800 whole seconds.");
  }
  const count = Math.ceil(seconds / PRESET.duration);
  const chapterCount = Math.ceil(seconds / chapterLimit);
  // Balance the final partial chapter rather than leaving a one-shot chapter.
  const chapters = Array.from({length:chapterCount}, (_,chapterIndex) => {
    const first = Math.floor(chapterIndex * count / chapterCount);
    const end = Math.floor((chapterIndex + 1) * count / chapterCount);
    const shots = Array.from({length:end-first}, (_,i) => {
      const index = first+i;
      const start = index*PRESET.duration;
      return {index, start, duration: Math.min(PRESET.duration,seconds-start)};
    });
    return {chapterIndex,shots};
  });
  return {seconds, shotCount:count, chapters, estimatedUsd: seconds*ESTIMATED_COST/PRESET.duration};
}

// Call only after ownership and chapter membership have been verified by the worker.
export function stitchInputs(indices: readonly number[], saved: ReadonlyMap<number,string>) {
  if (indices.length < 2 || new Set(indices).size !== indices.length) {
    throw new Error("Stitching requires at least two distinct shots or chapters.");
  }
  return [...indices].sort((a,b)=>a-b).map((index,shot_index)=>{
    const url=saved.get(index);
    if(!url || new URL(url).protocol!=="https:") throw new Error("Missing saved video for position "+index);
    return {url,shot_index};
  });
}
