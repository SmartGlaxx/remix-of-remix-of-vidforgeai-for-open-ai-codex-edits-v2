import { Play, Pause, SkipBack, SkipForward, Rewind, FastForward, Volume2, Maximize } from "lucide-react";
import type { RefObject } from "react";

const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
type Props = { videoRef?: RefObject<HTMLVideoElement>; playing?: boolean; currentTime?: number; duration?: number; volume?: number; onPlaybackError?: () => void };
export default function PlaybackControls({ videoRef, playing = false, currentTime = 0, duration = 0, volume = 1, onPlaybackError }: Props) {
  const enabled = !!videoRef && duration > 0;
  const seek = (position: number) => { if (videoRef?.current && enabled) videoRef.current.currentTime = Math.max(0, Math.min(duration, position)); };
  return <div className="director-playback-controls" aria-label="Playback controls">
    <input type="range" aria-label="Seek video" min={0} max={duration || 1} step={0.1} value={Math.min(currentTime, duration)} disabled={!enabled} onChange={(e) => seek(Number(e.target.value))} />
    <div className="director-transport-row">
      <div className="director-transport-buttons">
        <button type="button" aria-label="Go to start" disabled={!enabled} onClick={() => seek(0)}><SkipBack size={16} /></button>
        <button type="button" aria-label="Rewind 5 seconds" disabled={!enabled} onClick={() => seek(currentTime - 5)}><Rewind size={16} /></button>
        <button type="button" className="transport-play" aria-label={playing ? "Pause video" : "Play video"} disabled={!enabled} onClick={() => {
          const video = videoRef?.current;
          if (!video) return;
          if (video.paused) { if (video.ended) video.currentTime = 0; void video.play().catch(() => onPlaybackError?.()); }
          else video.pause();
        }}>{playing ? <Pause size={20} /> : <Play size={20} />}</button>
        <button type="button" aria-label="Forward 5 seconds" disabled={!enabled} onClick={() => seek(currentTime + 5)}><FastForward size={16} /></button>
        <button type="button" aria-label="Go to end" disabled={!enabled} onClick={() => seek(duration)}><SkipForward size={16} /></button>
      </div>
      <output aria-label="Playback time">{time(currentTime)} / {time(duration)}</output>
      <div className="director-volume"><Volume2 size={16} /><input aria-label="Video volume" type="range" min={0} max={1} step={0.05} value={volume} disabled={!videoRef} onChange={(e) => { if (videoRef?.current) { videoRef.current.muted = false; videoRef.current.volume = Number(e.target.value); } }} /></div>
      <button type="button" aria-label="Fullscreen video" disabled={!videoRef} onClick={() => { void videoRef?.current?.requestFullscreen?.().catch(() => onPlaybackError?.()); }}><Maximize size={16} /></button>
    </div>
  </div>;
}
