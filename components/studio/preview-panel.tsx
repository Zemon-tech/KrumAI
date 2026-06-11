"use client";

import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ImageIcon,
  VideoIcon,
  MusicIcon,
  DownloadIcon,
  ZapIcon,
  ClockIcon,
  PlayIcon,
  PauseIcon,
  Volume2Icon,
} from "lucide-react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { type AssetItem } from "./asset-sidebar";

export type GenerationStatus = "idle" | "dispatched" | "generating" | "done" | "error";

export interface GenerationState {
  status: GenerationStatus;
  progress: number; // 0–100
  promptId?: string;
  assetUrl?: string;
  assetType?: "image" | "video" | "audio";
  prompt?: string;
  model?: string;
  error?: string;
}

interface PreviewPanelProps {
  activeAsset: AssetItem | null;
  generation: GenerationState;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 h-full text-center px-8 bg-background/50">
      <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 shadow-sm relative group">
        <div className="absolute inset-0 bg-primary/5 rounded-2xl blur-lg group-hover:bg-primary/10 transition-colors" />
        <ZapIcon className="size-8 text-primary relative z-10" />
      </div>
      <div className="space-y-1.5 max-w-sm">
        <p className="text-sm font-semibold text-foreground">Creative Workspace</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Create something stunning using the AI Assistant on the right, or pick an existing generation from your Library on the left.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5 justify-center max-w-xs pt-1">
        {["Text → Image", "Text → Video", "Text → Audio", "Image → Video"].map((t) => (
          <Badge key={t} variant="secondary" className="text-[10px] text-muted-foreground/80 font-normal px-2.5 py-0.5">
            {t}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function GeneratingState({ progress, prompt }: { progress: number; prompt?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 h-full px-8 bg-background/50">
      {/* Shimmer Placeholder container */}
      <div className="w-full max-w-md aspect-video rounded-2xl overflow-hidden relative bg-muted/20 border border-border/60 shadow-md flex items-center justify-center">
        <Skeleton className="absolute inset-0 rounded-2xl opacity-40" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
          <div className="relative size-12 flex items-center justify-center bg-card/60 backdrop-blur border border-border/80 rounded-full shadow-sm">
            <ZapIcon className="size-5 text-primary animate-pulse" />
          </div>
          <div className="text-center space-y-2">
            <span className="text-xs font-semibold text-foreground/90 font-mono tracking-tight">{progress}% Generated</span>
            <div className="w-40 h-1.5 bg-muted rounded-full overflow-hidden border border-border/30">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      {prompt && (
        <div className="max-w-sm bg-card/45 backdrop-blur-sm border border-border/60 rounded-xl px-4 py-2.5 text-center shadow-sm">
          <Shimmer className="text-xs text-muted-foreground/90" duration={2}>
            {prompt}
          </Shimmer>
        </div>
      )}
    </div>
  );
}

// Custom Premium Audio Player
function CustomAudioPlayer({ asset }: { asset: AssetItem }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [asset]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const seekValue = Number(e.target.value);
    audioRef.current.currentTime = seekValue;
    setCurrentTime(seekValue);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  return (
    <div className="w-full max-w-md bg-card/45 border border-border/60 rounded-2xl p-5 shadow-lg flex flex-col gap-4 backdrop-blur-md relative overflow-hidden">
      <audio
        ref={audioRef}
        src={asset.url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />
      {/* Decorative background glow */}
      <div className="absolute -right-10 -top-10 size-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-center gap-4">
        {/* Disc graphic */}
        <div className={cn(
          "size-16 rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-950 flex items-center justify-center shadow border border-zinc-700/60 transition-transform duration-1000 shrink-0",
          isPlaying ? "animate-spin" : ""
        )}
        style={{ animationDuration: "8s" }}>
          <div className="size-4 rounded-full bg-emerald-400/20 flex items-center justify-center">
            <div className="size-1.5 rounded-full bg-emerald-400" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground truncate">{asset.name}</p>
          <p className="text-[10px] text-muted-foreground/80 truncate mt-0.5">Synthesized Audio Loop</p>
        </div>
      </div>

      {/* Play Controls & Seek bar */}
      <div className="space-y-2">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-emerald-400 focus:outline-none"
        />
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/80">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 pt-1">
        <Button
          onClick={togglePlay}
          size="icon"
          variant="outline"
          className="size-10 rounded-full border-border/60 bg-background/50 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30 transition-all shadow-sm"
        >
          {isPlaying ? <PauseIcon className="size-4 fill-current" /> : <PlayIcon className="size-4 fill-current ml-0.5" />}
        </Button>
        <Volume2Icon className="size-4 text-muted-foreground/60 ml-2" />
      </div>
    </div>
  );
}

function AssetPreview({ asset }: { asset: AssetItem }) {
  const handleDownload = () => {
    if (!asset.url) return;
    const link = document.createElement("a");
    link.href = asset.url;
    link.download = asset.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="flex flex-col h-full bg-background/30">
      {/* Media Content Canvas */}
      <div className="flex-1 flex items-center justify-center p-6 min-h-0 overflow-hidden">
        <div className="relative max-h-full max-w-full rounded-2xl overflow-hidden border border-border/60 shadow-xl bg-card/10 flex items-center justify-center backdrop-blur-sm">
          {asset.type === "image" && asset.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.url}
              alt={asset.prompt ?? "Preview image"}
              className="max-h-[60vh] object-contain rounded-2xl shadow-inner select-none"
            />
          )}

          {asset.type === "video" && asset.url && (
            <video
              src={asset.url}
              controls
              className="max-h-[60vh] w-full rounded-2xl object-contain shadow-inner"
              playsInline
            />
          )}

          {asset.type === "audio" && (
            <div className="py-12 px-8 w-full flex justify-center">
              <CustomAudioPlayer asset={asset} />
            </div>
          )}
        </div>
      </div>

      {/* Metadata Bar */}
      <div className="shrink-0 border-t border-border px-4 py-3 flex items-center justify-between gap-4 bg-card/35 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 rounded-lg bg-muted border border-border/60 shrink-0">
            {asset.type === "image" && <ImageIcon className="size-3.5 text-violet-400" />}
            {asset.type === "video" && <VideoIcon className="size-3.5 text-blue-400" />}
            {asset.type === "audio" && <MusicIcon className="size-3.5 text-emerald-400" />}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Prompt Context</span>
            <span className="text-xs text-foreground/95 truncate font-medium mt-0.5" title={asset.prompt}>
              {asset.prompt ?? "Directly uploaded media asset"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {asset.model && (
            <Badge variant="outline" className="text-[10px] border-border/80 bg-background/50 font-mono text-muted-foreground">
              {asset.model}
            </Badge>
          )}
          <Button
            onClick={handleDownload}
            variant="ghost"
            size="icon-sm"
            className="size-7.5 border border-border/40 hover:bg-muted hover:text-foreground"
            title="Download asset"
          >
            <DownloadIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PreviewPanel({ activeAsset, generation }: PreviewPanelProps) {
  const isGenerating = generation.status === "dispatched" || generation.status === "generating";

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0 bg-card/10">
        <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">
          Workspace Canvas
        </span>
        <div className="flex items-center gap-2">
          {isGenerating && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80">
              <ClockIcon className="size-3 animate-spin text-primary" />
              <span className="text-[11px] font-medium">Generating asset…</span>
            </div>
          )}
          {!isGenerating && activeAsset && (
            <Badge variant="outline" className="text-[10px] bg-emerald-500/5 text-emerald-400 border-emerald-500/20 font-medium py-0.5">
              Active Preview
            </Badge>
          )}
        </div>
      </div>

      {/* ── Main Canvas View ── */}
      <div className={cn("flex-1 overflow-hidden", !activeAsset && !isGenerating ? "flex items-center justify-center" : "")}>
        {isGenerating ? (
          <GeneratingState progress={generation.progress} prompt={generation.prompt} />
        ) : activeAsset ? (
          <AssetPreview asset={activeAsset} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}
