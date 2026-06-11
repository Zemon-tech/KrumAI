"use client";

import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  PanelLeftIcon,
  PanelRightIcon,
  SparklesIcon,
  SunIcon,
  MoonIcon,
} from "lucide-react";
import { useTheme } from "next-themes";

import { AssetSidebar } from "./asset-sidebar";
import { PreviewPanel, type GenerationState } from "./preview-panel";
import { AiPanel, type GenSettings } from "./ai-panel";

export function StudioLayout() {
  const { theme, setTheme } = useTheme();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

  const [generation, setGeneration] = useState<GenerationState>({
    status: "idle",
    progress: 0,
  });

  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleGenerate = useCallback((prompt: string, settings: GenSettings) => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    setGeneration({ status: "dispatched", progress: 0, prompt, model: settings.model });

    let p = 0;
    progressIntervalRef.current = setInterval(() => {
      p += Math.floor(Math.random() * 8) + 3;
      if (p >= 100) {
        p = 100;
        clearInterval(progressIntervalRef.current!);
        setGeneration({
          status: "done",
          progress: 100,
          prompt,
          model: settings.model,
          assetType: settings.type === "t2a" ? "audio" : settings.type.includes("v") ? "video" : "image",
          assetUrl: settings.type === "t2a"
            ? ""
            : `https://picsum.photos/seed/${Date.now()}/800/600`,
        });
      } else {
        setGeneration((prev) => ({ ...prev, status: "generating", progress: p }));
      }
    }, 150);
  }, []);

  return (
    // flex-1 + min-h-0 lets this fill the parent flex column without overflow
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background">
      {/* ── Top Bar ── */}
      <header className="flex items-center gap-2 px-3 h-10 border-b border-border bg-card/60 backdrop-blur-sm shrink-0 z-10">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setLeftOpen((v) => !v)}
          className={cn("size-7", leftOpen ? "text-foreground" : "text-muted-foreground")}
          title="Toggle asset panel"
        >
          <PanelLeftIcon className="size-4" />
        </Button>

        <Separator orientation="vertical" className="h-4" />

        <div className="flex items-center gap-1.5 select-none">
          <SparklesIcon className="size-3.5 text-primary" />
          <span className="text-xs font-semibold tracking-tight">Krum Studio</span>
        </div>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="size-7 text-muted-foreground hover:text-foreground"
          title="Toggle theme"
        >
          {theme === "dark"
            ? <SunIcon className="size-3.5" />
            : <MoonIcon className="size-3.5" />
          }
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setRightOpen((v) => !v)}
          className={cn("size-7", rightOpen ? "text-foreground" : "text-muted-foreground")}
          title="Toggle AI panel"
        >
          <PanelRightIcon className="size-4" />
        </Button>
      </header>

      {/* ── Panels ── flex-1 + min-h-0 so they fill remaining height */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <ResizablePanelGroup
          direction="horizontal"
          className="flex-1 min-h-0"
          style={{ height: "100%" }}
        >
          {leftOpen && (
            <>
              <ResizablePanel defaultSize={16} minSize={12} maxSize={28}>
                {/* h-full ensures sidebar fills panel height */}
                <div className="h-full overflow-hidden">
                  <AssetSidebar
                    selectedId={selectedAsset}
                    onSelect={setSelectedAsset}
                  />
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}

          <ResizablePanel defaultSize={leftOpen && rightOpen ? 54 : rightOpen ? 70 : leftOpen ? 84 : 100} minSize={30}>
            <div className="h-full overflow-hidden">
              <PreviewPanel generation={generation} />
            </div>
          </ResizablePanel>

          {rightOpen && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={30} minSize={22} maxSize={44}>
                <div className="h-full overflow-hidden">
                  <AiPanel
                    generation={generation}
                    onGenerate={handleGenerate}
                    onClose={() => setRightOpen(false)}
                  />
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
