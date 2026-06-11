"use client";

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
} from "lucide-react";
import { Shimmer } from "@/components/ai-elements/shimmer";

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
  generation: GenerationState;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 h-full text-center px-8">
      <div className="p-4 rounded-2xl bg-muted/40 border border-border">
        <ZapIcon className="size-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Ready to generate</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Describe what you want to create in the panel on the right, choose a generation type and hit generate.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {["Text → Image", "Text → Video", "Image → Video", "Text → Audio"].map((t) => (
          <Badge key={t} variant="outline" className="text-xs text-muted-foreground">
            {t}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function GeneratingState({ progress, prompt }: { progress: number; prompt?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 h-full px-8">
      {/* Shimmer placeholder */}
      <div className="w-full max-w-sm aspect-square rounded-2xl overflow-hidden relative bg-muted/30 border border-border">
        <Skeleton className="absolute inset-0 rounded-2xl" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <ZapIcon className="size-6 text-muted-foreground animate-pulse" />
          <div className="text-center space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{progress}%</p>
            <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      {prompt && (
        <Shimmer className="text-xs text-muted-foreground max-w-sm text-center" duration={2}>
          {prompt}
        </Shimmer>
      )}
    </div>
  );
}

function AssetPreview({ url, type, prompt, model }: {
  url: string;
  type: "image" | "video" | "audio";
  prompt?: string;
  model?: string;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Media */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="relative max-h-full max-w-full rounded-2xl overflow-hidden border border-border shadow-lg bg-muted/20">
          {type === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={prompt ?? "Generated image"} className="max-h-[60vh] object-contain rounded-2xl" />
          )}
          {type === "video" && (
            <video src={url} controls className="max-h-[60vh] rounded-2xl" />
          )}
          {type === "audio" && (
            <div className="p-8 flex flex-col items-center gap-4">
              <div className="p-6 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <MusicIcon className="size-8 text-emerald-400" />
              </div>
              <audio src={url} controls className="w-64" />
            </div>
          )}
        </div>
      </div>

      {/* Metadata bar */}
      <div className="shrink-0 border-t border-border px-4 py-3 flex items-center justify-between gap-4 bg-card/50">
        <div className="flex items-center gap-3 min-w-0">
          {type === "image" && <ImageIcon className="size-3.5 text-violet-400 shrink-0" />}
          {type === "video" && <VideoIcon className="size-3.5 text-blue-400 shrink-0" />}
          {type === "audio" && <MusicIcon className="size-3.5 text-emerald-400 shrink-0" />}
          <span className="text-xs text-muted-foreground truncate">{prompt ?? "No prompt"}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {model && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              {model}
            </Badge>
          )}
          <Button variant="ghost" size="icon-sm" className="size-7">
            <DownloadIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PreviewPanel({ generation }: PreviewPanelProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preview</span>
        <div className="flex items-center gap-2">
          {generation.status === "generating" && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ClockIcon className="size-3 animate-spin" />
              <span>Generating…</span>
            </div>
          )}
          {generation.status === "done" && (
            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              Done
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={cn("flex-1 overflow-hidden", generation.status === "idle" && "flex items-center justify-center")}>
        {generation.status === "idle" && <EmptyState />}
        {(generation.status === "dispatched" || generation.status === "generating") && (
          <GeneratingState progress={generation.progress} prompt={generation.prompt} />
        )}
        {generation.status === "done" && generation.assetUrl && generation.assetType && (
          <AssetPreview
            url={generation.assetUrl}
            type={generation.assetType}
            prompt={generation.prompt}
            model={generation.model}
          />
        )}
        {generation.status === "error" && (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-8">
            <Badge variant="destructive" className="text-xs">Generation failed</Badge>
            <p className="text-xs text-muted-foreground text-center">{generation.error ?? "Unknown error occurred."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
