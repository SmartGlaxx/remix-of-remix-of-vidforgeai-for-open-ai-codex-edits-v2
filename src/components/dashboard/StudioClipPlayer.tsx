import PlaybackControls from "./PlaybackControls";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Download, ExternalLink, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { videoUrl: string; shot?: number; take?: number; saved: boolean; label?: string; poster?: string; director?: boolean; active?: boolean };

export default function StudioClipPlayer({ videoUrl, shot, take, saved, label, poster, director = false, active = true }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackFailed, setPlaybackFailed] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  useEffect(() => { if (!active && videoRef.current && !videoRef.current.paused) videoRef.current.pause(); }, [active]);
  useEffect(() => { setCurrentTime(0); setDuration(0); setPlaying(false); setPlaybackFailed(false); }, [videoUrl]);
  const updateDuration = () => { const value = videoRef.current?.duration; setDuration(value && Number.isFinite(value) ? value : 0); };
  return (
    <>
      <div className={director ? "director-player" : undefined}>
      <video ref={videoRef} aria-label={label ?? `Shot ${shot}${take ? ` take ${take}` : ""}`} src={videoUrl} poster={poster} controls={!director} playsInline preload="metadata"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
        onLoadedMetadata={updateDuration} onDurationChange={updateDuration}
        onVolumeChange={() => setVolume(videoRef.current?.muted ? 0 : videoRef.current?.volume ?? 1)}
        onError={() => setPlaybackFailed(true)} onLoadedData={() => setPlaybackFailed(false)}
        className={director ? "director-video-surface" : "w-full aspect-video rounded-lg bg-muted"} />
      {director && <PlaybackControls videoRef={videoRef} playing={playing} currentTime={currentTime} duration={duration} volume={volume} onPlaybackError={() => setPlaybackFailed(true)} />}
      </div>
      {!saved && <p role="status" className="text-sm text-muted-foreground">Could not save this clip to app storage. The original video link is still available.</p>}
      {playbackFailed && (
        <div role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>This video could not load. Retry playback or open it in a new tab.</span>
        </div>
      )}
      <div className={`flex flex-wrap gap-2 ${director ? "director-download-links" : ""}`}>
        <Button asChild variant="outline" size="sm">
          <a href={videoUrl} target="_blank" rel="noreferrer" download><Download className="w-4 h-4" /> Download</a>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <a href={videoUrl} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /> Open video in new tab</a>
        </Button>
        {playbackFailed && <Button variant="outline" size="sm" onClick={() => {
          setPlaybackFailed(false);
          videoRef.current?.load();
        }}><RotateCcw className="w-4 h-4" /> Retry playback</Button>}
      </div>
    </>
  );
}