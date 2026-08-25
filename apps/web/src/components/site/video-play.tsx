import { Play } from "lucide-react";
import "./video-play.css";

type VideoPlayProps = {
  size?: number;
  className?: string;
};

/** Pastille lecture — overlay visuel sur les miniatures vidéo. */
export function VideoPlay({ size = 22, className }: VideoPlayProps) {
  return (
    <span
      className={`opt-video-play${className ? ` ${className}` : ""}`}
      aria-hidden
    >
      <Play size={size} strokeWidth={2} fill="currentColor" />
    </span>
  );
}
