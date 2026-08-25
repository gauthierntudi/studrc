"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import "./hls-player.css";
void import("hls.js");

type Props = {
  src: string;
  poster?: string | null;
  title?: string;
  /** STU STORIES = or, STU TALK = rouge */
  accent?: "gold" | "red";
  durationSec?: number | null;
};

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function bufferedEnd(video: HTMLVideoElement) {
  try {
    if (!video.buffered.length) return 0;
    return video.buffered.end(video.buffered.length - 1);
  } catch {
    return 0;
  }
}

type PipVideo = HTMLVideoElement & {
  webkitSetPresentationMode?: (mode: "inline" | "picture-in-picture") => void;
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitPresentationMode?: string;
};

async function enterNativePip(video: HTMLVideoElement) {
  const pipVideo = video as PipVideo;
  if (document.pictureInPictureElement === video) return true;
  if (document.pictureInPictureEnabled && !video.disablePictureInPicture) {
    await video.requestPictureInPicture();
    return true;
  }
  if (pipVideo.webkitSupportsPresentationMode?.("picture-in-picture")) {
    pipVideo.webkitSetPresentationMode?.("picture-in-picture");
    return true;
  }
  return false;
}

async function exitNativePip(video: HTMLVideoElement) {
  const pipVideo = video as PipVideo;
  if (document.pictureInPictureElement === video) {
    await document.exitPictureInPicture();
  }
  if (pipVideo.webkitPresentationMode === "picture-in-picture") {
    pipVideo.webkitSetPresentationMode?.("inline");
  }
}

function SkipTen({ dir }: { dir: "back" | "fwd" }) {
  const Icon = dir === "back" ? RotateCcw : RotateCw;
  return (
    <span className="opt-hls__skip-glyph" aria-hidden>
      <Icon size={26} strokeWidth={1.7} />
      <span>10</span>
    </span>
  );
}

export function HlsPlayer({
  src,
  poster,
  title,
  accent = "red",
  durationSec,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekRef = useRef<HTMLDivElement>(null);
  const volRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const hideTimer = useRef(0);
  const dragging = useRef(false);
  const volDragging = useRef(false);
  const wantPlayRef = useRef(false);
  const playingRef = useRef(false);
  const skipAutoPip = useRef(false);
  const floatRef = useRef(false);
  const cueTimer = useRef(0);

  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(durationSec ?? 0);
  const [buffered, setBuffered] = useState(0);
  const [chrome, setChrome] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [float, setFloat] = useState(false);
  const [pip, setPip] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [cue, setCue] = useState<"play" | "pause" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const tearDown = useCallback(() => {
    hlsRef.current?.destroy();
    hlsRef.current = null;
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.removeAttribute("src");
    video.load();
  }, []);

  const showChrome = useCallback((sticky = false) => {
    setChrome(true);
    window.clearTimeout(hideTimer.current);
    if (sticky) return;
    const video = videoRef.current;
    if (!video || video.paused) return;
    hideTimer.current = window.setTimeout(() => setChrome(false), 2400);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    let cancelled = false;

    async function attach() {
      if (!video) return;
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        if (wantPlayRef.current) {
          try {
            await video.play();
          } catch {
            /* overlay / barre custom */
          }
        }
        return;
      }

      const { default: Hls } = await import("hls.js");
      if (cancelled || !videoRef.current) return;
      if (!Hls.isSupported()) {
        setError("Lecture HLS non supportée sur ce navigateur.");
        return;
      }
      const BaseLoader = Hls.DefaultConfig.loader;
      class CorsLoader extends BaseLoader {
        load(context: any, config: any, callbacks: any) {
          if (context.url && !/[?&]cors=1(?:&|$)/.test(context.url)) {
            context.url += context.url.includes("?") ? "&cors=1" : "?cors=1";
          }
          super.load(context, config, callbacks);
        }
      }
      const instance = new Hls({
        enableWorker: true,
        capLevelToPlayerSize: true,
        autoStartLoad: false,
        startLevel: -1,
        testBandwidth: false,
        abrEwmaDefaultEstimate: 400_000,
        startFragPrefetch: true,
        progressive: true,
        maxBufferLength: 18,
        maxMaxBufferLength: 40,
        maxStarvationDelay: 2,
        loader: CorsLoader,
        xhrSetup(xhr) {
          xhr.withCredentials = false;
        },
      });
      hlsRef.current = instance;
      instance.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        setError("Impossible de lire la vidéo. Réessayez.");
        instance.destroy();
        hlsRef.current = null;
      });
      instance.on(Hls.Events.MANIFEST_PARSED, () => {
        const levels = instance.levels;
        if (levels.length > 0) {
          let min = 0;
          let cap = 0;
          for (let i = 1; i < levels.length; i++) {
            const level = levels[i]!;
            if (level.bitrate < levels[min]!.bitrate) min = i;
            if ((level.height ?? 0) <= 480) cap = i;
          }
          instance.startLevel = min;
          instance.autoLevelCapping = cap;
        }
        instance.startLoad();
        if (!wantPlayRef.current) return;
        void videoRef.current?.play().catch(() => undefined);
      });
      instance.loadSource(src);
      instance.attachMedia(videoRef.current);
      if (wantPlayRef.current) {
        void videoRef.current?.play().catch(() => undefined);
      }
    }

    void attach();
    return () => {
      cancelled = true;
      tearDown();
    };
  }, [src, retryKey, tearDown]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const sync = () => {
      if (!dragging.current) setCurrent(video.currentTime);
      setDuration(Number.isFinite(video.duration) ? video.duration : durationSec ?? 0);
      setBuffered(bufferedEnd(video));
      const isPlaying = !video.paused && !video.ended;
      playingRef.current = isPlaying;
      setPlaying(isPlaying);
      setEnded(video.ended);
      setMuted(video.muted || video.volume === 0);
      setVolume(video.muted ? 0 : video.volume);
    };

    const onPlay = () => {
      playingRef.current = true;
      setPlaying(true);
      setEnded(false);
      setWaiting(false);
      showChrome();
    };
    const onPause = () => {
      playingRef.current = false;
      setPlaying(false);
      showChrome(true);
    };
    const onWaiting = () => setWaiting(true);
    const onPlaying = () => setWaiting(false);
    const onEnded = () => {
      playingRef.current = false;
      setEnded(true);
      setPlaying(false);
      setChrome(true);
      floatRef.current = false;
      setFloat(false);
      void exitNativePip(video).catch(() => undefined);
    };

    video.addEventListener("timeupdate", sync);
    video.addEventListener("progress", sync);
    video.addEventListener("durationchange", sync);
    video.addEventListener("volumechange", sync);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("ended", onEnded);
    sync();

    return () => {
      video.removeEventListener("timeupdate", sync);
      video.removeEventListener("progress", sync);
      video.removeEventListener("durationchange", sync);
      video.removeEventListener("volumechange", sync);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("ended", onEnded);
    };
  }, [durationSec, showChrome]);

  useEffect(() => {
    const onFs = () => {
      const node = rootRef.current;
      setFullscreen(
        Boolean(
          document.fullscreenElement === node ||
            (document as Document & { webkitFullscreenElement?: Element })
              .webkitFullscreenElement === node,
        ),
      );
    };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener(
        "webkitfullscreenchange",
        onFs as EventListener,
      );
      window.clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const video = videoRef.current;
    if (!wrap || !video || !started) return;

    const onEnterPip = () => {
      setPip(true);
      floatRef.current = false;
      setFloat(false);
    };
    const onLeavePip = () => {
      setPip(false);
      const rect = wrap.getBoundingClientRect();
      const visible =
        rect.bottom > 80 && rect.top < window.innerHeight - 40;
      if (!visible && playingRef.current) skipAutoPip.current = true;
    };
    video.addEventListener("enterpictureinpicture", onEnterPip);
    video.addEventListener("leavepictureinpicture", onLeavePip);

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (document.fullscreenElement) return;
        const hidden = entry.intersectionRatio < 0.28;
        if (hidden && playingRef.current && !video.ended) {
          if (skipAutoPip.current) return;
          if (document.pictureInPictureElement === video) return;
          if (floatRef.current) return;
          floatRef.current = true;
          setFloat(true);
          return;
        }
        if (!hidden) {
          skipAutoPip.current = false;
          floatRef.current = false;
          setFloat(false);
          void exitNativePip(video).catch(() => undefined);
        }
      },
      { threshold: [0, 0.12, 0.28, 0.5, 1] },
    );
    io.observe(wrap);
    return () => {
      io.disconnect();
      video.removeEventListener("enterpictureinpicture", onEnterPip);
      video.removeEventListener("leavepictureinpicture", onLeavePip);
    };
  }, [started]);

  async function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    wantPlayRef.current = true;
    setStarted(true);
    setError(null);
    if (video.ended) {
      video.currentTime = 0;
    }
    if (video.paused) {
      try {
        await video.play();
        flashCue("play");
      } catch {
        /* barre visible */
      }
    } else {
      video.pause();
      flashCue("pause");
    }
  }

  function flashCue(kind: "play" | "pause") {
    if (!started) return;
    setCue(kind);
    window.clearTimeout(cueTimer.current);
    cueTimer.current = window.setTimeout(() => setCue(null), 520);
  }

  function skipBy(delta: number) {
    const video = videoRef.current;
    if (!video) return;
    const max = Number.isFinite(video.duration) ? video.duration : duration;
    video.currentTime = Math.min(Math.max(0, video.currentTime + delta), max || video.currentTime + delta);
    setCurrent(video.currentTime);
    showChrome();
  }

  function onStart() {
    void togglePlay();
  }

  function onRetry() {
    wantPlayRef.current = true;
    setError(null);
    setStarted(true);
    setRetryKey((n) => n + 1);
  }

  function ratioFromClientX(clientX: number) {
    const el = seekRef.current;
    const video = videoRef.current;
    if (!el || !video || !video.duration) return 0;
    const rect = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }

  function seekToClientX(clientX: number) {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const next = ratioFromClientX(clientX) * video.duration;
    video.currentTime = next;
    setCurrent(next);
  }

  function onSeekPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    setSeeking(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    seekToClientX(e.clientX);
    showChrome(true);
  }

  function onSeekPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const dur = videoRef.current?.duration || duration;
    if (dur) setHoverTime(ratioFromClientX(e.clientX) * dur);
    if (!dragging.current) return;
    seekToClientX(e.clientX);
  }

  function onSeekPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    dragging.current = false;
    setSeeking(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    showChrome();
  }

  function onSeekLeave() {
    if (!dragging.current) setHoverTime(null);
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) video.volume = 0.8;
    showChrome();
  }

  function onVolume(value: number) {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.min(1, Math.max(0, value));
    video.volume = next;
    video.muted = next === 0;
    showChrome();
  }

  function volumeFromClientY(clientY: number) {
    const el = volRef.current;
    if (!el) return muted ? 0 : volume;
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0) return muted ? 0 : volume;
    return Math.min(1, Math.max(0, 1 - (clientY - rect.top) / rect.height));
  }

  function onVolPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    volDragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    onVolume(volumeFromClientY(e.clientY));
    showChrome(true);
  }

  function onVolPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!volDragging.current) return;
    onVolume(volumeFromClientY(e.clientY));
  }

  function onVolPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    volDragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    showChrome();
  }

  async function toggleFullscreen() {
    const node = rootRef.current;
    const video = videoRef.current;
    if (!node) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (node.requestFullscreen) {
        await node.requestFullscreen();
      } else {
        const webkit = video as HTMLVideoElement & {
          webkitEnterFullscreen?: () => void;
        };
        webkit.webkitEnterFullscreen?.();
      }
    } catch {
      /* iOS / policy */
    }
    showChrome();
  }

  async function togglePip() {
    const video = videoRef.current;
    if (!video) return;
    skipAutoPip.current = false;
    await exitNativePip(video).catch(() => undefined);
    if (floatRef.current || pip) {
      floatRef.current = false;
      setFloat(false);
      showChrome();
      return;
    }
    floatRef.current = true;
    setFloat(true);
    showChrome();
  }

  function dismissFloat() {
    skipAutoPip.current = true;
    floatRef.current = false;
    setFloat(false);
    videoRef.current?.pause();
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const video = videoRef.current;
    if (!video) return;
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      void togglePlay();
    } else if (e.key === "f") {
      e.preventDefault();
      void toggleFullscreen();
    } else if (e.key === "m") {
      e.preventDefault();
      toggleMute();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      skipBy(10);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      skipBy(-10);
    }
  }

  const dur = duration || durationSec || 0;
  const remain = Math.max(0, dur - current);
  const playedPct = dur > 0 ? Math.min(100, (current / dur) * 100) : 0;
  const bufPct = dur > 0 ? Math.min(100, (buffered / dur) * 100) : 0;
  const hoverPct =
    hoverTime != null && dur > 0 ? Math.min(100, (hoverTime / dur) * 100) : null;
  const showBar = started && (chrome || !playing || ended || float);

  return (
    <div
      ref={wrapRef}
      className={`opt-hls-wrap${float ? " is-floating" : ""}${pip ? " is-pip" : ""}`}
    >
      <div
        ref={rootRef}
        className={`opt-hls opt-hls--${accent}${started ? " is-started" : ""}${
          playing ? " is-playing" : ""
        }${showBar ? " is-chrome" : ""}${seeking ? " is-seeking" : ""}${
          float ? " is-float" : ""
        }`}
        style={{ ["--hls-played" as string]: `${playedPct}%` }}
        tabIndex={0}
        onMouseMove={() => started && showChrome()}
        onKeyDown={onKeyDown}
        aria-label={title ? `Lecteur : ${title}` : "Lecteur vidéo"}
      >
        <video
          ref={videoRef}
          className="opt-hls__video"
          poster={poster ?? undefined}
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          controlsList="nodownload noremoteplayback"
          title={title}
          onClick={() => {
            if (!started) return;
            void togglePlay();
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            void toggleFullscreen();
          }}
        />

        {waiting && started && !ended ? (
          <span className="opt-hls__spinner" aria-hidden />
        ) : null}

        {!started && !error ? (
          <button
            type="button"
            className="opt-hls__start"
            onClick={onStart}
            aria-label={title ? `Lire : ${title}` : "Lire la vidéo"}
          >
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={poster} alt="" className="opt-hls__poster" />
            ) : null}
            <span className="opt-hls__scrim" aria-hidden />
            <span className="opt-hls__play-big">
              <Play size={34} fill="currentColor" strokeWidth={0} />
            </span>
            {durationSec ? (
              <span className="opt-hls__badge">{formatTime(durationSec)}</span>
            ) : null}
          </button>
        ) : null}

        {ended && started && !error ? (
          <button
            type="button"
            className="opt-hls__replay"
            onClick={() => void togglePlay()}
            aria-label="Relire la vidéo"
          >
            <span className="opt-hls__replay-disc">
              <RotateCcw size={26} strokeWidth={2.2} />
            </span>
            <span>Relire</span>
          </button>
        ) : null}

        {cue && started && !ended ? (
          <span className="opt-hls__cue" aria-hidden>
            <span className="opt-hls__cue-disc">
              {cue === "pause" ? (
                <Pause size={26} fill="currentColor" />
              ) : (
                <Play size={26} fill="currentColor" />
              )}
            </span>
          </span>
        ) : null}

        {started && !error ? <div className="opt-hls__top" aria-hidden /> : null}

        {started && !error ? (
          <div className="opt-hls__chrome" onClick={(e) => e.stopPropagation()}>
            <div className="opt-hls__timeline">
              <div
                ref={seekRef}
                className="opt-hls__seek"
                role="slider"
                tabIndex={0}
                aria-label="Progression"
                aria-valuemin={0}
                aria-valuemax={Math.round(dur)}
                aria-valuenow={Math.round(current)}
                aria-valuetext={`${formatTime(current)} sur ${formatTime(dur)}`}
                onPointerDown={onSeekPointerDown}
                onPointerMove={onSeekPointerMove}
                onPointerUp={onSeekPointerUp}
                onPointerCancel={onSeekPointerUp}
                onPointerLeave={onSeekLeave}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    e.stopPropagation();
                    skipBy(e.key === "ArrowRight" ? 10 : -10);
                  }
                }}
              >
                <span
                  className="opt-hls__buf"
                  style={{ width: `${bufPct}%` }}
                  aria-hidden
                />
                <span
                  className="opt-hls__played"
                  style={{ width: `${playedPct}%` }}
                  aria-hidden
                />
                <span
                  className="opt-hls__thumb"
                  style={{ left: `${playedPct}%` }}
                  aria-hidden
                />
                {hoverPct != null && hoverTime != null ? (
                  <span
                    className="opt-hls__tip"
                    style={{ left: `${hoverPct}%` }}
                  >
                    {formatTime(hoverTime)}
                  </span>
                ) : null}
              </div>
              {dur > 0 ? (
                <span className="opt-hls__remain">-{formatTime(remain)}</span>
              ) : null}
            </div>

            <div className="opt-hls__bar">
              <div className="opt-hls__left">
                <button
                  type="button"
                  className="opt-hls__play"
                  onClick={() => void togglePlay()}
                  aria-label={playing ? "Pause" : "Lecture"}
                >
                  {playing ? (
                    <Pause size={22} fill="currentColor" />
                  ) : (
                    <Play size={22} fill="currentColor" />
                  )}
                </button>
                <button
                  type="button"
                  className="opt-hls__skip"
                  onClick={() => skipBy(-10)}
                  aria-label="Reculer de 10 secondes"
                >
                  <SkipTen dir="back" />
                </button>
                <button
                  type="button"
                  className="opt-hls__skip"
                  onClick={() => skipBy(10)}
                  aria-label="Avancer de 10 secondes"
                >
                  <SkipTen dir="fwd" />
                </button>
                <div className="opt-hls__vol">
                  <button
                    type="button"
                    className="opt-hls__icon"
                    onClick={toggleMute}
                    aria-label={muted ? "Activer le son" : "Couper le son"}
                  >
                    {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                  <div className="opt-hls__vol-pop">
                    <div
                      ref={volRef}
                      className="opt-hls__vol-track"
                      role="slider"
                      tabIndex={0}
                      aria-label="Volume"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round((muted ? 0 : volume) * 100)}
                      aria-orientation="vertical"
                      onPointerDown={onVolPointerDown}
                      onPointerMove={onVolPointerMove}
                      onPointerUp={onVolPointerUp}
                      onPointerCancel={onVolPointerUp}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp" || e.key === "ArrowRight") {
                          e.preventDefault();
                          onVolume((muted ? 0 : volume) + 0.1);
                        } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
                          e.preventDefault();
                          onVolume((muted ? 0 : volume) - 0.1);
                        }
                      }}
                    >
                      <span
                        className="opt-hls__vol-fill"
                        style={{
                          height: `${Math.round((muted ? 0 : volume) * 100)}%`,
                        }}
                        aria-hidden
                      />
                      <span
                        className="opt-hls__vol-knob"
                        style={{
                          bottom: `${Math.round((muted ? 0 : volume) * 100)}%`,
                        }}
                        aria-hidden
                      />
                    </div>
                  </div>
                </div>
              </div>

              {title ? <p className="opt-hls__title">{title}</p> : <span />}

              <div className="opt-hls__right">
                <button
                  type="button"
                  className="opt-hls__icon"
                  onClick={() => void togglePip()}
                  aria-label={
                    pip || float
                      ? "Quitter le mode Picture-in-Picture"
                      : "Picture-in-Picture"
                  }
                >
                  <PictureInPicture2 size={20} />
                </button>
                <button
                  type="button"
                  className="opt-hls__icon"
                  onClick={() => void toggleFullscreen()}
                  aria-label={
                    fullscreen ? "Quitter le plein écran" : "Plein écran"
                  }
                >
                  {fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {float ? (
          <button
            type="button"
            className="opt-hls__close"
            onClick={dismissFloat}
            aria-label="Fermer le mini-lecteur"
          >
            <X size={14} strokeWidth={2.4} />
          </button>
        ) : null}

        {error ? (
          <div className="opt-hls__error" role="alert">
            <p>{error}</p>
            <button type="button" className="opt-hls__retry" onClick={onRetry}>
              Réessayer
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
