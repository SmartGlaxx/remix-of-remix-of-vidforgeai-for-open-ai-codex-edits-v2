import { useRef, useState } from "react";
import { AlertCircle, Download, ExternalLink, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { videoUrl: string; shot?: number; saved: boolean; label?: string };

export default function StudioClipPlayer({ videoUrl, shot, saved, label }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackFailed, setPlaybackFailed] = useState(false);

  return (
    <>
      <video ref={videoRef} aria-label={label ?? `Shot ${shot}`} src={videoUrl} controls preload="metadata"
        onError={() => setPlaybackFailed(true)} onLoadedData={() => setPlaybackFailed(false)}
        className="w-full aspect-video rounded-lg bg-muted" />
      {!saved && <p role="status" className="text-sm text-muted-foreground">Could not save this clip to app storage. The original video link is still available.</p>}
      {playbackFailed && (
        <div role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>This video could not load. Retry playback or open it in a new tab.</span>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
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