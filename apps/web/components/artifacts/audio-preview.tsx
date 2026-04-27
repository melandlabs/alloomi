"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { RemixIcon } from "@/components/remix-icon";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export interface AudioPreviewProps {
  /** Audio file URL (blob URL, file path, or HTTP URL) */
  src: string;
  /** Audio file name */
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
 * Audio preview component using HTML5 audio element with custom controls
 * Supports: mp3, wav, flac, aac, ogg, m4a
 */
export function AudioPreview({ src, filename, className }: AudioPreviewProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.play().catch(() => setError("Failed to play audio"));
    } else {
      audio.pause();
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration);
    setIsLoading(false);
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
    }
  }, []);

  const handleError = useCallback(() => {
    setError("Failed to load audio");
    setIsLoading(false);
  }, []);

  const handleSeek = useCallback(
    (value: number[]) => {
      const audio = audioRef.current;
      if (!audio || !value.length) return;
      const newTime = (value[0] / 100) * duration;
      audio.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [duration],
  );

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
  }, []);

  const handleVolumeChange = useCallback((value: number[]) => {
    const audio = audioRef.current;
    if (!audio || !value.length) return;
    const newVolume = value[0] / 100;
    audio.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-6 bg-neutral-900 rounded-lg",
        className,
      )}
    >
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={handleError}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        preload="metadata"
      />

      {error ? (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <RemixIcon
            name="music_2"
            size="size-12"
            className="text-neutral-400 mb-4"
          />
          <p className="text-neutral-300 font-medium mb-2">{error}</p>
          {filename && <p className="text-neutral-500 text-sm">{filename}</p>}
        </div>
      ) : (
        <>
          {/* Album art / Audio icon */}
          <div className="relative mb-6">
            <div
              className={cn(
                "flex items-center justify-center w-32 h-32 rounded-full bg-neutral-800 transition-transform",
                isPlaying ? "scale-105" : "",
              )}
            >
              <RemixIcon
                name="music_2"
                size="size-16"
                className={cn(
                  "text-neutral-400 transition-transform",
                  isPlaying ? "animate-pulse" : "",
                )}
              />
            </div>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <RemixIcon
                  name="loader_2"
                  size="size-6"
                  className="animate-spin text-white"
                />
              </div>
            )}
          </div>

          {/* Filename */}
          {filename && (
            <p className="text-white font-medium mb-4 truncate max-w-full px-4">
              {filename}
            </p>
          )}

          {/* Progress bar */}
          <div className="w-full max-w-md mb-4">
            <Slider
              value={[progressPercent]}
              onValueChange={handleSeek}
              max={100}
              step={0.1}
              className="cursor-pointer"
            />
          </div>

          {/* Time display */}
          <div className="flex justify-between w-full max-w-md text-neutral-400 text-xs font-mono mb-4">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            {/* Play/Pause button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 w-12 h-12 rounded-full"
              onClick={handlePlayPause}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              <RemixIcon
                name={isPlaying ? "pause" : "play"}
                size="size-6"
                className="ml-0.5"
              />
            </Button>
          </div>

          {/* Volume control */}
          <div className="flex items-center gap-2 mt-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-neutral-400 hover:text-white hover:bg-white/10 w-8 h-8"
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
            <Slider
              value={[isMuted ? 0 : volume * 100]}
              onValueChange={handleVolumeChange}
              max={100}
              className="w-24 cursor-pointer"
            />
          </div>
        </>
      )}
    </div>
  );
}
