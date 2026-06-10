// s:\1-Project\zemon\content-pipeline\frontend\components\GenerationCanvas.tsx
"use client";

import React from "react";
import { DownloadIcon, CopyIcon, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AudioPlayer,
  AudioPlayerElement,
  AudioPlayerControlBar,
  AudioPlayerPlayButton,
  AudioPlayerSeekBackwardButton,
  AudioPlayerSeekForwardButton,
  AudioPlayerTimeDisplay,
  AudioPlayerTimeRange,
  AudioPlayerDurationDisplay,
  AudioPlayerMuteButton,
  AudioPlayerVolumeRange,
} from "@/components/ai-elements/audio-player";
import { Card, CardContent } from "@/components/ui/card";

interface GenerationCanvasProps {
  status: "idle" | "generating" | "completed" | "failed";
  progress: number;
  url: string | null;
  type: "image" | "video";
  prompt: string;
}

export const GenerationCanvas = ({
  status,
  progress,
  url,
  type,
  prompt,
}: GenerationCanvasProps) => {
  const handleCopyLink = () => {
    if (url) {
      navigator.clipboard.writeText(window.location.origin + url);
    }
  };

  const handleDownload = async () => {
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `generation_${Date.now()}.${
        type === "video" ? "mp4" : "png"
      }`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  return (
    <Card className="border border-zinc-200/80 bg-white/80 shadow-xl backdrop-blur-md dark:border-zinc-800/80 dark:bg-black/60 overflow-hidden relative min-h-[450px] flex flex-col items-center justify-center">
      {/* Decorative Grid Patterns */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      <CardContent className="w-full flex-1 flex flex-col items-center justify-center p-6 min-h-[400px]">
        {status === "idle" && (
          <div className="text-center max-w-sm space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-400 dark:text-zinc-600">
              <Sparkles className="size-6 animate-pulse text-violet-500" />
            </div>
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
              Ready for Generation
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Choose your parameters on the left and click "Generate Studio Asset" to begin.
            </p>
          </div>
        )}

        {status === "generating" && (
          <div className="w-full max-w-md space-y-6 text-center">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                Generating Creative Output...
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1 italic">
                "{prompt}"
              </p>
            </div>

            {/* Glowing progress slider container */}
            <div className="space-y-3">
              <Progress value={progress} className="h-2 bg-zinc-100 dark:bg-zinc-950" />
              <div className="flex justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <span>ComfyUI Graph Execution</span>
                <span className="text-violet-600 dark:text-violet-400 font-semibold">{Math.round(progress)}%</span>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-100 bg-violet-50/50 text-[11px] text-violet-700 dark:border-violet-900/30 dark:bg-violet-950/20 dark:text-violet-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
              </span>
              Streaming events from Ubuntu GPU node
            </div>
          </div>
        )}

        {status === "failed" && (
          <div className="text-center max-w-sm space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-red-500">
              <AlertCircle className="size-6" />
            </div>
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
              Generation Failed
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              WebSocket stream ended unexpectedly. Please check ComfyUI VM availability and configuration.
            </p>
          </div>
        )}

        {status === "completed" && url && (
          <div className="w-full h-full flex flex-col items-center justify-center gap-6">
            {/* Visual Media Wrapper */}
            <div className="relative w-full max-w-2xl rounded-lg overflow-hidden border border-zinc-200/80 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 shadow-inner flex items-center justify-center p-2 min-h-[300px]">
              {type === "video" ? (
                <video
                  src={url}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="max-h-[380px] w-full rounded object-contain"
                />
              ) : (
                <img
                  src={url}
                  alt={prompt}
                  className="max-h-[380px] w-full rounded object-contain transition-transform duration-300 hover:scale-[1.01]"
                />
              )}
            </div>

            {/* Utility control buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="gap-2 text-xs h-9"
              >
                <CopyIcon className="size-3.5" />
                Copy Asset Link
              </Button>
              <Button
                size="sm"
                onClick={handleDownload}
                className="gap-2 text-xs h-9 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950"
              >
                <DownloadIcon className="size-3.5" />
                Download File
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
