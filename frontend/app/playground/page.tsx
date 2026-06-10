// s:\1-Project\zemon\content-pipeline\frontend\app\playground\page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { GenerationCanvas } from "@/components/GenerationCanvas";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  Image as ImageIcon,
  Video as VideoIcon,
  Layers,
  Clock,
  Trash2,
  Download,
  PanelRightClose,
} from "lucide-react";

const MODEL_PRESETS = {
  image: [
    { label: "Qwen Image Edit Plus", value: "qwen_image_edit_2511_bf16.safetensors" },
  ],
  video: [
    { label: "LTX Video 2.3 (Dev FP8)", value: "ltx-2.3-22b-dev-fp8.safetensors" },
  ],
};

interface HistoryItem {
  id: string;
  prompt: string;
  negativePrompt?: string;
  url: string;
  type: "image" | "video";
  timestamp: number;
  model: string;
  aspect: string;
  duration?: number;
  frameRate?: number;
  quality?: "low" | "medium" | "high";
}

export default function PlaygroundPage() {
  const [inputPrompt, setInputPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [genType, setGenType] = useState<"image" | "video">("image");
  const [model, setModel] = useState(MODEL_PRESETS.image[0].value);
  const [aspect, setAspect] = useState<"1:1" | "16:9" | "9:16" | "4:3">("1:1");
  const [duration, setDuration] = useState<number>(10);
  const [frameRate, setFrameRate] = useState<number>(30);
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium");

  const activeParamsRef = useRef<{
    prompt: string;
    negativePrompt: string;
    type: "image" | "video";
    model: string;
    aspect: string;
    duration?: number;
    frameRate?: number;
    quality?: "low" | "medium" | "high";
  } | null>(null);

  // Flow State
  const [status, setStatus] = useState<"idle" | "generating" | "completed" | "failed">("idle");
  const [progress, setProgress] = useState(0);
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [activePrompt, setActivePrompt] = useState("");

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("zemon_generation_history");
        return saved ? JSON.parse(saved) : [];
      } catch (err) {
        console.error("Failed to load history:", err);
      }
    }
    return [];
  });
  const [showHistory, setShowHistory] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const clientId = useRef<string>("");

  useEffect(() => {
    clientId.current = crypto.randomUUID();
    return () => {
      cleanupWebSocket();
    };
  }, []);

  const saveToHistory = (
    url: string,
    params: {
      prompt: string;
      negativePrompt: string;
      type: "image" | "video";
      model: string;
      aspect: string;
      duration?: number;
      frameRate?: number;
      quality?: "low" | "medium" | "high";
    }
  ) => {
    const newItem: HistoryItem = {
      id: crypto.randomUUID(),
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      url,
      type: params.type,
      timestamp: Date.now(),
      model: params.model,
      aspect: params.aspect,
      ...(params.type === "video" ? {
        duration: params.duration,
        frameRate: params.frameRate,
        quality: params.quality,
      } : {}),
    };
    
    setHistory((prev) => {
      const updated = [newItem, ...prev];
      try {
        localStorage.setItem("zemon_generation_history", JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to save history:", err);
      }
      return updated;
    });
  };

  const handleLoadHistoryItem = (item: HistoryItem) => {
    setInputPrompt(item.prompt);
    if (item.negativePrompt) setNegativePrompt(item.negativePrompt);
    setGenType(item.type);
    setModel(item.model);
    setAspect(item.aspect as "1:1" | "16:9" | "9:16" | "4:3");
    if (item.type === "video") {
      if (item.duration !== undefined) setDuration(item.duration);
      if (item.frameRate !== undefined) setFrameRate(item.frameRate);
      if (item.quality !== undefined) setQuality(item.quality);
    }
    setAssetUrl(item.url);
    setActivePrompt(item.prompt);
    setStatus("completed");
    setProgress(100);
  };

  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem("zemon_generation_history", JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to update history after delete:", err);
      }
      return updated;
    });
  };

  const handleClearHistory = () => {
    if (confirm("Are you sure you want to clear all generation history?")) {
      setHistory([]);
      try {
        localStorage.removeItem("zemon_generation_history");
      } catch (err) {
        console.error("Failed to clear history:", err);
      }
    }
  };

  function cleanupWebSocket() {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }

  const handleGenerate = async (msg?: PromptInputMessage) => {
    const promptText = msg?.text || inputPrompt;
    if (!promptText.trim()) return;

    // Reset workflow states
    cleanupWebSocket();
    setStatus("generating");
    setProgress(0);
    setAssetUrl(null);
    setActivePrompt(promptText);

    // Save active generation params in ref to avoid race conditions
    activeParamsRef.current = {
      prompt: promptText,
      negativePrompt,
      type: genType,
      model,
      aspect,
      ...(genType === "video" ? { duration, frameRate, quality } : {}),
    };

    try {
      // 1. Dispatch payload to backend
      const response = await fetch("/api/generate/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          negativePrompt,
          type: genType,
          model,
          aspect,
          clientId: clientId.current,
          ...(genType === "video" ? { duration, frameRate, quality } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error("Dispatch request failed");
      }

      const { prompt_id, mock } = await response.json();

      if (mock) {
        // Run mock timer simulation for preview/dev mode
        simulateMockProgress();
      } else {
        // 2. Setup real WebSocket listener to local ComfyUI GPU node
        setupWebSocket(prompt_id);
      }
    } catch (err) {
      console.error(err);
      setStatus("failed");
    }
  };

  // Mock flow for testing interface styling offline
  const simulateMockProgress = () => {
    let mockVal = 0;
    const interval = setInterval(() => {
      mockVal += Math.random() * 20;
      if (mockVal >= 100) {
        mockVal = 100;
        clearInterval(interval);
        persistAsset(true);
      }
      setProgress(mockVal);
    }, 600);
  };

  // WS controller
  const setupWebSocket = (targetPromptId: string) => {
    const wsUrl = process.env.NEXT_PUBLIC_COMFYUI_WS_URL || "ws://127.0.0.1:8188/ws";
    const socket = new WebSocket(`${wsUrl}?clientId=${clientId.current}`);
    wsRef.current = socket;

    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === "progress") {
          const { value, max } = message.data;
          setProgress((value / max) * 100);
        }

        // Executing node status
        if (message.type === "executing") {
          const { node, prompt_id } = message.data;
          if (node === null && prompt_id === targetPromptId) {
            // Processing complete, notify Next.js Server proxy
            persistAsset(false, targetPromptId);
            cleanupWebSocket();
          }
        }
      } catch (err) {
        console.error("Failed parsing WS response packet:", err);
      }
    };

    socket.onerror = (err) => {
      console.error("WebSocket transport connection failure:", err);
      setStatus("failed");
      cleanupWebSocket();
    };

    socket.onclose = () => {
      console.log("WebSocket endpoint connection finished.");
    };
  };

  const persistAsset = async (isMock: boolean, promptId?: string) => {
    const params = activeParamsRef.current;
    const targetGenType = params?.type || genType;
    try {
      const response = await fetch("/api/generate/persist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptId,
          mock: isMock,
          genType: targetGenType,
        }),
      });

      if (!response.ok) {
        throw new Error("Persist assets API failed");
      }

      const { url } = await response.json();
      setAssetUrl(url);
      setStatus("completed");
      saveToHistory(url, params || {
        prompt: activePrompt,
        negativePrompt,
        type: genType,
        model,
        aspect,
        ...(genType === "video" ? { duration, frameRate, quality } : {}),
      });
    } catch (err) {
      console.error(err);
      setStatus("failed");
    }
  };

  return (
    <div className="flex-1 w-full min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 flex flex-col">
      {/* Premium Studio Navigation Header */}
      <header className="border-b border-zinc-200/80 bg-white/60 backdrop-blur-md dark:border-zinc-800/80 dark:bg-black/40 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center text-white shadow-md">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-zinc-900 via-violet-800 to-fuchsia-800 bg-clip-text text-transparent dark:from-zinc-50 dark:to-zinc-300">
              Zemon Creative Studio
            </h1>
            <p className="text-[10px] font-medium text-zinc-500 tracking-wider uppercase">
              AI Generative Orchestrator
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* History Sidebar Toggle */}
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shadow-sm",
              showHistory
                ? "bg-violet-600 border-violet-600 text-white shadow-inner"
                : "border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            )}
          >
            <Clock className="size-3.5" />
            <span>History</span>
            {history.length > 0 && (
              <span className={cn(
                "h-4 min-w-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center transition-all",
                showHistory ? "bg-white text-violet-600" : "bg-violet-600 text-white"
              )}>
                {history.length}
              </span>
            )}
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">VM Connected</span>
          </div>
        </div>
      </header>

      {/* Main Studio Dashboard Workspace */}
      <div className="flex-1 flex w-full max-w-[1600px] mx-auto min-h-0 relative overflow-hidden">
        {/* Main Grid Content */}
        <div className={cn(
          "flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 p-8 w-full overflow-y-auto transition-all duration-300",
          showHistory ? "lg:pr-[360px]" : ""
        )}>
          {/* Left Side: Generative Parameters Control Panel */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="rounded-xl border border-zinc-200/80 bg-white/60 p-6 shadow-md backdrop-blur-md dark:border-zinc-800/80 dark:bg-black/30 flex flex-col gap-6">
              <div>
                <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
                  <Layers className="size-4 text-violet-500" />
                  Workflow Mode Selection
                </h2>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Set creative parameters for target neural generation pipeline.
                </p>
              </div>

              {/* Pipeline Tabs */}
              <Tabs
                value={genType}
                onValueChange={(val) => {
                  const type = val as "image" | "video";
                  setGenType(type);
                  const presets = MODEL_PRESETS[type];
                  if (presets && presets[0]) {
                    setModel(presets[0].value);
                  }
                }}
                className="w-full"
              >
                <TabsList className="grid grid-cols-2 bg-zinc-100/80 dark:bg-zinc-900/80 p-1 h-10 rounded-lg">
                  <TabsTrigger value="image" className="text-xs gap-1 py-1.5 rounded-md">
                    <ImageIcon className="size-3.5" />
                    Image (Qwen)
                  </TabsTrigger>
                  <TabsTrigger value="video" className="text-xs gap-1 py-1.5 rounded-md">
                    <VideoIcon className="size-3.5" />
                    Video (LTX)
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Separator className="bg-zinc-200/60 dark:bg-zinc-850" />

              <div className="space-y-4">
                {/* Model Select */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Checkpoint Model
                  </Label>
                  <Select value={model} onValueChange={setModel} disabled={status === "generating"}>
                    <SelectTrigger className="w-full h-10 border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-black text-xs">
                      <SelectValue placeholder="Select Model" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-zinc-950 text-xs border border-zinc-200 dark:border-zinc-800">
                      {MODEL_PRESETS[genType]?.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Aspect Ratio Presets (only relevant to image/video) */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Aspect Ratio Dimensions
                  </Label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["1:1", "16:9", "9:16", "4:3"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        disabled={status === "generating"}
                        onClick={() => setAspect(r)}
                        className={cn(
                          "py-2 px-3 text-xs font-semibold rounded-lg border transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed",
                          aspect === r
                            ? "bg-violet-600 border-violet-600 text-white shadow-sm"
                            : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700 bg-transparent text-zinc-600 dark:text-zinc-400"
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Video Generation Controls (Visible in video mode only) */}
                {genType === "video" && (
                  <div className="space-y-4 pt-4 border-t border-zinc-200/60 dark:border-zinc-800/60">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          Video Duration
                        </Label>
                        <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 px-1.5 py-0.5 rounded">
                          {duration} seconds
                        </span>
                      </div>
                      <Slider
                        value={[duration]}
                        onValueChange={(val) => setDuration(val[0])}
                        min={2}
                        max={15}
                        step={1}
                        disabled={status === "generating"}
                        className="py-1"
                      />
                      <div className="flex justify-between text-[9px] text-zinc-400 dark:text-zinc-500 px-0.5 font-medium">
                        <span>2s</span>
                        <span>5s</span>
                        <span>10s</span>
                        <span>15s</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          Frame Rate (FPS)
                        </Label>
                        <Select
                          value={String(frameRate)}
                          onValueChange={(val) => setFrameRate(Number(val))}
                          disabled={status === "generating"}
                        >
                          <SelectTrigger className="w-full h-10 border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-black text-xs">
                            <SelectValue placeholder="FPS" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-zinc-950 text-xs border border-zinc-200 dark:border-zinc-800">
                            <SelectItem value="24">24 fps</SelectItem>
                            <SelectItem value="30">30 fps</SelectItem>
                            <SelectItem value="60">60 fps</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          Quality Preset
                        </Label>
                        <Select
                          value={quality}
                          onValueChange={(val) => setQuality(val as "low" | "medium" | "high")}
                          disabled={status === "generating"}
                        >
                          <SelectTrigger className="w-full h-10 border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-black text-xs">
                            <SelectValue placeholder="Quality" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-zinc-950 text-xs border border-zinc-200 dark:border-zinc-800">
                            <SelectItem value="low">Low (Fast)</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High (Slow)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Negative Prompting fields */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Negative Prompt
                  </Label>
                  <Textarea
                    placeholder="Describe elements to avoid in neural generation..."
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    disabled={status === "generating"}
                    className="min-h-[70px] text-xs resize-none border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Creative Generation Canvas & Console Prompt Input */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Main Visual Generation Area */}
            <GenerationCanvas
              status={status}
              progress={progress}
              url={assetUrl}
              type={genType}
              prompt={activePrompt}
            />

            {/* Vercel AI Elements Prompt Input */}
            <div className="rounded-xl border border-zinc-200/80 bg-white/60 p-4 shadow-md backdrop-blur-md dark:border-zinc-800/80 dark:bg-black/30">
              <PromptInput
                onSubmit={handleGenerate}
                className="relative w-full"
              >
                <PromptInputTextarea
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  placeholder={`Describe the perfect creative asset to generate... (${genType === "video" ? "e.g., cinematic golden hour valley" : "e.g., cyberpunk street portrait"})`}
                  className="pr-14 min-h-[50px] max-h-[120px] text-xs resize-none"
                />
                <PromptInputSubmit
                  status={status === "generating" ? "streaming" : "ready"}
                  disabled={!inputPrompt.trim() || status === "generating"}
                  className="absolute bottom-2.5 right-2.5 size-7 rounded-md"
                />
              </PromptInput>
            </div>
          </div>
        </div>

        {/* Collapsible History Sidebar Panel */}
        <div
          className={cn(
            "fixed lg:absolute top-0 right-0 h-full w-[340px] border-l border-zinc-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md shadow-2xl flex flex-col z-40 transition-all duration-300 ease-in-out transform",
            showHistory ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
          )}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-violet-500" />
              <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">Generation History</h3>
            </div>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 hover:text-red-500 transition-colors"
                  title="Clear history"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 transition-colors"
              >
                <PanelRightClose className="size-4" />
              </button>
            </div>
          </div>

          {/* Sidebar Scrollable Card Area */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {history.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-400 dark:text-zinc-600 gap-2">
                <Clock className="size-8 stroke-[1.5]" />
                <p className="text-xs font-semibold">No history items yet</p>
                <p className="text-[10px] text-zinc-500 max-w-[200px]">
                  Generated studio assets will be automatically saved here.
                </p>
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleLoadHistoryItem(item)}
                  className="group relative border border-zinc-200 dark:border-zinc-800 hover:border-violet-500 dark:hover:border-violet-500/50 bg-white/50 dark:bg-zinc-900/50 rounded-xl p-3 flex flex-col gap-2.5 cursor-pointer hover:shadow-md transition-all duration-200"
                >
                  {/* Thumbnail & Metadata */}
                  <div className="flex gap-2.5 items-start">
                    <div className="relative h-14 w-20 rounded bg-zinc-100 dark:bg-zinc-950 border border-zinc-200/50 dark:border-zinc-800/50 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {item.type === "video" ? (
                        <>
                          <video
                            src={item.url}
                            className="h-full w-full object-cover"
                            preload="metadata"
                            muted
                            playsInline
                          />
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                            <span className="h-5 w-5 rounded-full bg-white/95 flex items-center justify-center text-zinc-950 shadow-sm">
                              <span className="border-y-[3.5px] border-y-transparent border-l-[6px] border-l-zinc-950 ml-0.5" />
                            </span>
                          </div>
                        </>
                      ) : (
                        <img
                          src={item.url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 line-clamp-2 leading-tight">
                        {item.prompt}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1">
                        <span className="text-[9px] font-bold uppercase text-violet-600 dark:text-violet-400">
                          {item.type}
                        </span>
                        <span className="text-[9px] text-zinc-400 font-medium">
                          {item.aspect}
                        </span>
                        {item.type === "video" && item.duration !== undefined && (
                          <span className="text-[9px] text-zinc-600 dark:text-zinc-300 font-semibold bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">
                            {item.duration}s{item.frameRate ? ` @ ${item.frameRate}fps` : ""}{item.quality ? ` (${item.quality})` : ""}
                          </span>
                        )}
                        <span className="text-[9px] text-zinc-400 font-medium">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-zinc-100 dark:border-zinc-800/50 mt-0.5">
                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium line-clamp-1 max-w-[160px]" title={item.model}>
                      {item.model.split('/').pop()}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const response = await fetch(item.url);
                            const blob = await response.blob();
                            const blobUrl = URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.href = blobUrl;
                            link.download = `generation_${item.timestamp}.${item.type === 'video' ? 'mp4' : 'png'}`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(blobUrl);
                          } catch (error) {
                            console.error("Download failed:", error);
                          }
                        }}
                        className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-805 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                        title="Download file"
                      >
                        <Download className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                        className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-805 text-zinc-500 hover:text-red-500 transition-colors"
                        title="Delete from history"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
