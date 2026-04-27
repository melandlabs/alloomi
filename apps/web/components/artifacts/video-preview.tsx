"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { RemixIcon } from "@/components/remix-icon";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export interface VideoPreviewProps {
  /** Video file URL (blob URL, file path, or HTTP URL) */
  src: string;
  /** Video file name */
  filename?: string;
  /** Optional className */
  className?: string;
  /** Optional MIME type */
  mimeType?: string;
}

function formatTime(seconds: number): string {
  if (Number.isNaN(seconds) || !Number.isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Video preview component using HTML5 video element with custom controls
 * Supports: mp4, webm, mov, avi, mkv
 */
export function VideoPreview({
  src,
  filename,
  className,
  mimeType,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => setError("Failed to play video"));
    } else {
      video.pause();
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    setIsLoading(false);
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
    }
  }, []);

  const handleError = useCallback(() => {
    setError("Failed to load video");
    setIsLoading(false);
  }, []);

  const handleSeek = useCallback(
    (value: number[]) => {
      const video = videoRef.current;
      if (!video || !value.length) return;
      const newTime = (value[0] / 100) * duration;
      video.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [duration],
  );

  const handleVolumeChange = useCallback((value: number[]) => {
    const video = videoRef.current;
    if (!video || !value.length) return;
    const newVolume = value[0] / 100;
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Fullscreen not supported
    }
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
    };
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Video player"
      className={cn(
        "relative flex flex-col items-center justify-center bg-neutral-900 rounded-lg overflow-hidden",
        isFullscreen ? "fixed inset-0 z-50 rounded-none" : "",
        className,
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {error ? (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <RemixIcon
            name="video"
            size="size-12"
            className="text-neutral-400 mb-4"
          />
          <p className="text-neutral-300 font-medium mb-2">{error}</p>
          {filename && <p className="text-neutral-500 text-sm">{filename}</p>}
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            src={src}
            className={cn(
              "max-w-full max-h-full object-contain",
              isFullscreen ? "w-screen h-screen" : "w-full h-full",
            )}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            onError={handleError}
            onWaiting={() => setIsLoading(true)}
            onCanPlay={() => setIsLoading(false)}
            playsInline
            preload="metadata"
          />

          {/* Loading indicator */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <RemixIcon
                name="loader_2"
                size="size-8"
                className="animate-spin text-white"
              />
            </div>
          )}

          {/* Click to play/pause overlay */}
          <button
            type="button"
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity",
              !isPlaying && showControls
                ? "opacity-100"
                : "opacity-0 pointer-events-none",
            )}
            onClick={handlePlayPause}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-black/60">
              <RemixIcon
                name={isPlaying ? "pause" : "play"}
                size="size-8"
                className="text-white ml-0.5"
              />
            </div>
          </button>

          {/* Controls bar */}
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3 transition-opacity",
              showControls ? "opacity-100" : "opacity-0",
            )}
          >
            {/* Progress bar */}
            <div className="mb-2">
              <Slider
                value={[progressPercent]}
                onValueChange={handleSeek}
                max={100}
                step={0.1}
                className="cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Play/Pause button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={handlePlayPause}
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  <RemixIcon
                    name={isPlaying ? "pause" : "play"}
                    size="size-4"
                  />
                </Button>

                {/* Volume controls */}
                <div className="flex items-center gap-1 group">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={toggleMute}
                    aria-label={isMuted ? "Unmute" : "Mute"}
                  >
                    <RemixIcon
                      name={
                        isMuted || volume === 0
                          ? "volume-mute"
                          : volume < 0.5
                            ? "volume-down"
                            : "volume-up"
                      }
                      size="size-4"
                    />
                  </Button>
                  <div className="w-0 overflow-hidden transition-all group-hover:w-20">
                    <Slider
                      value={[isMuted ? 0 : volume * 100]}
                      onValueChange={handleVolumeChange}
                      max={100}
                      className="cursor-pointer"
                    />
                  </div>
                </div>

                {/* Time display */}
                <span className="text-white text-xs font-mono ml-2">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Fullscreen button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  <RemixIcon
                    name={isFullscreen ? "fullscreen_exit" : "fullscreen"}
                    size="size-4"
                  />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
