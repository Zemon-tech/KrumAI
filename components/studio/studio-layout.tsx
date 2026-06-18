"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { toast } from "sonner";
import type { PanelImperativeHandle } from "react-resizable-panels";

import { AssetSidebar, type AssetItem, type AssetFolder } from "./asset-sidebar";
import { PreviewPanel, type GenerationState } from "./preview-panel";
import { AiPanel, type GenSettings } from "./ai-panel";

// Default library assets
const DEFAULT_FOLDERS: AssetFolder[] = [
  {
    id: "f1",
    name: "Scenery",
    items: [
      { id: "a1", name: "mountain_sunset.png", type: "image", createdAt: new Date(), prompt: "majestic mountain peaks at sunset with cinematic lighting", model: "FLUX Dev", url: "https://picsum.photos/seed/mountain/1024/1024" },
      { id: "a2", name: "ocean_waves.mp4", type: "video", createdAt: new Date(), prompt: "cinematic drone shot of ocean waves crashing on black sand beach", model: "CogVideoX-5B", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4" },
    ],
  },
  {
    id: "f2",
    name: "Characters",
    items: [
      { id: "a3", name: "cyber_portrait.png", type: "image", createdAt: new Date(), prompt: "cyberpunk character with neon visor, detailed portrait", model: "FLUX Schnell", url: "https://picsum.photos/seed/cyberpunk/1024/1024" },
    ],
  },
];

const DEFAULT_ROOT_ITEMS: AssetItem[] = [
  { id: "a4", name: "ambient_relax.wav", type: "audio", createdAt: new Date(), prompt: "lofi ambient synth loop for deep study and relaxation", model: "MusicGen", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { id: "a5", name: "abstract_painting.png", type: "image", createdAt: new Date(), prompt: "colorful fluid dynamics abstract painting", model: "SDXL 1.0", url: "https://picsum.photos/seed/abstract/1024/1024" },
];

export function StudioLayout() {
  const { theme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const leftPanelRef = useRef<PanelImperativeHandle>(null);
  const rightPanelRef = useRef<PanelImperativeHandle>(null);

  // Studio Asset States
  const [folders, setFolders] = useState<AssetFolder[]>(DEFAULT_FOLDERS);
  const [rootItems, setRootItems] = useState<AssetItem[]>(DEFAULT_ROOT_ITEMS);
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);

  // Generation status state
  const [generation, setGeneration] = useState<GenerationState>({
    status: "idle",
    progress: 0,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // Sidebar toggle methods using refs to prevent full re-renders and unmounts
  const toggleLeft = useCallback(() => {
    const panel = leftPanelRef.current;
    if (panel) {
      if (panel.isCollapsed()) {
        panel.expand();
        setLeftOpen(true);
      } else {
        panel.collapse();
        setLeftOpen(false);
      }
    }
  }, []);

  const toggleRight = useCallback(() => {
    const panel = rightPanelRef.current;
    if (panel) {
      if (panel.isCollapsed()) {
        panel.expand();
        setRightOpen(true);
      } else {
        panel.collapse();
        setRightOpen(false);
      }
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);

    // Load directories and library items from LocalStorage on mount
    const savedFolders = localStorage.getItem("krum-studio-folders");
    if (savedFolders) {
      try {
        setFolders(JSON.parse(savedFolders));
      } catch (e) {
        console.error("Failed to restore folders from LocalStorage:", e);
      }
    }

    const savedRootItems = localStorage.getItem("krum-studio-rootItems");
    if (savedRootItems) {
      try {
        const parsed = JSON.parse(savedRootItems);
        const formatted = parsed.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt),
        }));
        setRootItems(formatted);
      } catch (e) {
        console.error("Failed to restore rootItems from LocalStorage:", e);
      }
    }

    // Fetch actual generated files from disk
    const fetchGeneratedAssets = async () => {
      try {
        const res = await fetch("/api/generate/assets");
        if (res.ok) {
          const actualAssets = await res.json();
          if (actualAssets && actualAssets.length > 0) {
            // Map JSON string dates back to Date objects
            const formattedAssets = actualAssets.map((asset: any) => ({
              ...asset,
              createdAt: new Date(asset.createdAt)
            }));
            setRootItems((prev) => {
              const prevFiltered = prev.filter(item => !item.id.startsWith("gen-fs-"));
              return [...formattedAssets, ...prevFiltered];
            });
          }
        }
      } catch (err) {
        console.error("Failed to load actual generated assets:", err);
      }
    };

    fetchGeneratedAssets();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, []);

  // Save asset lists to LocalStorage on modification (after mount)
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("krum-studio-folders", JSON.stringify(folders));
    }
  }, [folders, isMounted]);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("krum-studio-rootItems", JSON.stringify(rootItems));
    }
  }, [rootItems, isMounted]);

  // Asset selection
  const handleSelect = useCallback((id: string) => {
    // Search in root items
    const rootAsset = rootItems.find((item) => item.id === id);
    if (rootAsset) {
      setSelectedAsset(rootAsset);
      setGeneration({ status: "idle", progress: 0 });
      return;
    }
    // Search in folders
    for (const folder of folders) {
      const folderAsset = folder.items.find((item) => item.id === id);
      if (folderAsset) {
        setSelectedAsset(folderAsset);
        setGeneration({ status: "idle", progress: 0 });
        return;
      }
    }
  }, [folders, rootItems]);

  // Asset deletion
  const handleDelete = useCallback((id: string) => {
    if (selectedAsset?.id === id) {
      setSelectedAsset(null);
    }
    setRootItems((prev) => prev.filter((item) => item.id !== id));
    setFolders((prev) =>
      prev.map((folder) => ({
        ...folder,
        items: folder.items.filter((item) => item.id !== id),
      }))
    );
  }, [selectedAsset]);

  // Generation execution
  const handleGenerate = useCallback(async (prompt: string, settings: GenSettings) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    // Determine the source image filename if it is image-to-image (i2i) or image-to-video (i2v)
    let inputImageFilename: string | undefined = undefined;
    if (settings.type === "i2i" || settings.type === "i2v") {
      if (!selectedAsset || selectedAsset.type !== "image") {
        toast.error("Please select a source image from the library sidebar first.");
        return;
      }
      inputImageFilename = selectedAsset.url;
    }

    const selectedAssetPrompt = selectedAsset?.prompt || undefined;

    setSelectedAsset(null);
    setGeneration({
      status: "dispatched",
      progress: 0,
      prompt,
      model: settings.model,
      assetType: (settings.type as string) === "t2a" ? "audio" : settings.type.includes("v") ? "video" : "image",
    });

    let finalPromptToSave = prompt;
    let finalModelToSave = settings.model;

    try {
      // 1. Dispatch prompt to Next.js server API
      const res = await fetch("/api/generate/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          settings,
          inputImageFilename,
          selectedAssetPrompt,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to dispatch prompt to ComfyUI");
      }

      const { prompt_id, client_id, ws_url, enhanced_prompt, settings: newSettings } = await res.json();
      console.log(`Successfully dispatched. Prompt ID: ${prompt_id}, Client ID: ${client_id}`);

      if (enhanced_prompt) {
        finalPromptToSave = enhanced_prompt;
      }
      if (newSettings?.model) {
        finalModelToSave = newSettings.model;
      }

      // Update generation display details with enhanced version
      setGeneration((prev) => ({
        ...prev,
        prompt: finalPromptToSave,
        model: finalModelToSave,
      }));

      // 2. Establish direct WebSocket connection with ComfyUI
      const finalWsUrl = ws_url || process.env.NEXT_PUBLIC_COMFYUI_WS_URL || "ws://127.0.0.1:8188/ws";
      console.log(`Connecting client WebSocket to ComfyUI at: ${finalWsUrl}`);
      const ws = new WebSocket(`${finalWsUrl}?clientId=${client_id}`);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connection established with ComfyUI");
      };

      ws.onmessage = async (event) => {
        try {
          if (typeof event.data !== "string") {
            // Skip binary preview data frames
            return;
          }

          const message = JSON.parse(event.data);

          if (message.type === "progress") {
            const { value, max } = message.data;
            const progressPercentage = Math.round((value / max) * 100);
            setGeneration((prev) => ({
              ...prev,
              status: "generating",
              progress: progressPercentage,
            }));
          } else if (message.type === "executing") {
            const { node, prompt_id: msgPromptId } = message.data;
            if (node === null && msgPromptId === prompt_id) {
              console.log("Entire workflow execution complete on ComfyUI.");
            }
          } else if (message.type === "executed") {
            const { node, output, prompt_id: msgPromptId } = message.data;
            if (msgPromptId === prompt_id) {
              console.log(`Node ${node} executed. Outputs:`, output);

              if (!output) {
                return;
              }

              // Look for any output file in outputs
              let filename = "";
              let subfolder = "";
              let fileType = "output";

              if (output.images && output.images.length > 0) {
                filename = output.images[0].filename;
                subfolder = output.images[0].subfolder;
                fileType = output.images[0].type;
              } else if (output.gifs && output.gifs.length > 0) {
                filename = output.gifs[0].filename;
                subfolder = output.gifs[0].subfolder;
                fileType = output.gifs[0].type;
              } else if (output.videos && output.videos.length > 0) {
                filename = output.videos[0].filename;
                subfolder = output.videos[0].subfolder;
                fileType = output.videos[0].type;
              }

              if (filename) {
                console.log(`Persisting asset: ${filename}`);

                // Call local persist handler
                const persistRes = await fetch("/api/generate/persist", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    filename,
                    subfolder,
                    type: fileType,
                  }),
                });

                if (!persistRes.ok) {
                  throw new Error("Failed to persist generated file locally");
                }

                const persistData = await persistRes.json();
                if (persistData.success) {
                  const assetUrl = persistData.url;
                  const type = (settings.type as string) === "t2a" ? "audio" : settings.type.includes("v") ? "video" : "image";

                  const generatedAsset: AssetItem = {
                    id: `gen-${Date.now()}`,
                    name: filename,
                    type,
                    createdAt: new Date(),
                    prompt: finalPromptToSave,
                    model: finalModelToSave,
                    url: assetUrl,
                  };

                  setSelectedAsset(generatedAsset);
                  setGeneration({
                    status: "done",
                    progress: 100,
                    prompt: finalPromptToSave,
                    model: finalModelToSave,
                    assetType: type,
                    assetUrl,
                  });

                  // Add new asset to the root list
                  setRootItems((prev) => [generatedAsset, ...prev]);
                  toast.success("Generation completed and saved!");
                } else {
                  throw new Error(persistData.error || "Error during asset save");
                }

                ws.close();
                socketRef.current = null;
              }
            }
          }
        } catch (err: any) {
          console.error("Error in websocket onmessage:", err);
          toast.error(`Error saving asset: ${err.message}`);
          setGeneration((prev) => ({ ...prev, status: "error" }));
          ws.close();
          socketRef.current = null;
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        toast.error("WebSocket connection error with ComfyUI server.");
        setGeneration((prev) => ({ ...prev, status: "error" }));
        socketRef.current = null;
      };

      ws.onclose = () => {
        console.log("WebSocket connection with ComfyUI closed.");
        socketRef.current = null;
      };

    } catch (err: any) {
      console.error("Error during generation:", err);
      toast.error(`Dispatch failed: ${err.message}`);
      setGeneration({
        status: "error",
        progress: 0,
      });
      socketRef.current = null;
    }
  }, [selectedAsset]);

  // SSR Safe Static Header shell
  if (!isMounted) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background">
        <header className="flex items-center gap-2 px-3 h-10 border-b border-border bg-card/60 backdrop-blur-sm shrink-0 z-10">
          <Button variant="ghost" size="icon-sm" className="size-7 text-muted-foreground" disabled>
            <PanelLeftIcon className="size-4" />
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1.5 select-none">
            <SparklesIcon className="size-3.5 text-primary" />
            <span className="text-xs font-semibold tracking-tight">Krum Studio</span>
          </div>
          <div className="flex-1" />
          <Button variant="ghost" size="icon-sm" className="size-7 text-muted-foreground" disabled>
            <SunIcon className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="size-7 text-muted-foreground" disabled>
            <PanelRightIcon className="size-4" />
          </Button>
        </header>
        <div className="flex-1 bg-background" />
      </div>
    );
  }

  // Active element to preview is either selectedAsset or the completed generation
  const activeAssetToPreview = selectedAsset || (generation.status === "done" ? {
    id: "gen-active",
    name: "generated_preview",
    type: generation.assetType || "image",
    url: generation.assetUrl,
    prompt: generation.prompt,
    model: generation.model,
    createdAt: new Date(),
  } : null);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background">
      {/* ── Top Bar ── */}
      <header className="flex items-center gap-2 px-3 h-10 border-b border-border bg-card/60 backdrop-blur-sm shrink-0 z-10">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleLeft}
          className={cn("size-7", leftOpen ? "text-foreground" : "text-muted-foreground")}
          title="Toggle library sidebar"
        >
          <PanelLeftIcon className="size-4" />
        </Button>

        <Separator orientation="vertical" className="h-4" />

        <div className="flex items-center gap-1.5 select-none">
          <SparklesIcon className="size-3.5 text-primary" />
          <span className="text-xs font-semibold tracking-tight">Krum Studio</span>
        </div>

        <div className="flex-1" />

        {/* Theme Toggler */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="size-7 text-muted-foreground hover:text-foreground"
          title="Toggle color theme"
        >
          {theme === "dark" ? (
            <SunIcon className="size-3.5" />
          ) : (
            <MoonIcon className="size-3.5" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleRight}
          className={cn("size-7", rightOpen ? "text-foreground" : "text-muted-foreground")}
          title="Toggle AI side panel"
        >
          <PanelRightIcon className="size-4" />
        </Button>
      </header>

      {/* ── Sidebars & Main Viewport ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <ResizablePanelGroup
          orientation="horizontal"
          className="flex-1 min-h-0"
          style={{ height: "100%" }}
        >
          {/* Left panel (Assets) */}
          <ResizablePanel
            panelRef={leftPanelRef}
            collapsible
            onResize={(size) => {
              setLeftOpen(size.asPercentage > 0);
            }}
            defaultSize="18%"
            minSize="14%"
            maxSize="28%"
          >
            <div className="h-full overflow-hidden">
              <AssetSidebar
                folders={folders}
                rootItems={rootItems}
                selectedId={selectedAsset?.id || null}
                onSelect={handleSelect}
                onDelete={handleDelete}
              />
            </div>
          </ResizablePanel>
          <ResizableHandle
            disabled={!leftOpen}
            className={cn(!leftOpen && "hidden")}
            withHandle
          />

          {/* Middle panel (Workspace Canvas) */}
          <ResizablePanel minSize={30}>
            <div className="h-full overflow-hidden">
              <PreviewPanel activeAsset={activeAssetToPreview} generation={generation} />
            </div>
          </ResizablePanel>

          {/* Right panel (AI control) */}
          <ResizableHandle
            disabled={!rightOpen}
            className={cn(!rightOpen && "hidden")}
            withHandle
          />
          <ResizablePanel
            panelRef={rightPanelRef}
            collapsible
            onResize={(size) => {
              setRightOpen(size.asPercentage > 0);
            }}
            defaultSize="30%"
            minSize="22%"
            maxSize="44%"
          >
            <div className="h-full overflow-hidden">
              <AiPanel
                generation={generation}
                selectedAsset={selectedAsset}
                onGenerate={handleGenerate}
                onClose={toggleRight}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
