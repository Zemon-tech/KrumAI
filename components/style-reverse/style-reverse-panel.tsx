"use client";

import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  UploadCloudIcon,
  SparklesIcon,
  WandIcon,
  PaletteIcon,
  CopyIcon,
  ImageIcon,
  Loader2Icon,
  CheckIcon,
  ArrowLeftIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type BranchType = "style_extract" | "style_generate" | "style_transfer";
type UploadState = "idle" | "uploading" | "done" | "error";
type GenerationStatus = "idle" | "dispatched" | "generating" | "polling" | "done" | "error";

interface UploadedImage {
  file: File;
  previewUrl: string;
  s3Key: string;
  uploadState: UploadState;
  progress: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StyleReversePanel() {
  // Upload states
  const [styleImage, setStyleImage] = useState<UploadedImage | null>(null);
  const [contentImage, setContentImage] = useState<UploadedImage | null>(null);

  // Branch states
  const [activeBranch, setActiveBranch] = useState<BranchType | null>(null);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>("idle");
  const [progress, setProgress] = useState(0);

  // Results
  const [extractedText, setExtractedText] = useState<string>("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string>("");
  const [transferredImageUrl, setTransferredImageUrl] = useState<string>("");

  // Branch 2 inputs
  const [subjectPrompt, setSubjectPrompt] = useState("");
  const [turboMode, setTurboMode] = useState(true);
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Refs
  const styleInputRef = useRef<HTMLInputElement>(null);
  const contentInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // ─── Upload to S3 ──────────────────────────────────────────────────────────

  const uploadToS3 = useCallback(async (
    file: File,
    setter: React.Dispatch<React.SetStateAction<UploadedImage | null>>
  ) => {
    const previewUrl = URL.createObjectURL(file);
    setter({
      file,
      previewUrl,
      s3Key: "",
      uploadState: "uploading",
      progress: 0,
    });

    try {
      // 1. Get presigned URL
      const presignRes = await fetch("/api/storage/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });

      if (!presignRes.ok) {
        throw new Error("Failed to get presigned URL");
      }

      const { uploadUrl, s3Key } = await presignRes.json();

      // 2. Upload directly to S3 via presigned URL
      const xhr = new XMLHttpRequest();
      
      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setter((prev) => prev ? { ...prev, progress: pct } : prev);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Upload network error")));
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      setter({
        file,
        previewUrl,
        s3Key,
        uploadState: "done",
        progress: 100,
      });

      toast.success(`Uploaded ${file.name}`);
    } catch (err: any) {
      setter((prev) => prev ? { ...prev, uploadState: "error" } : prev);
      toast.error(err.message || "Upload failed");
    }
  }, []);

  const handleStyleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadToS3(file, setStyleImage);
  };

  const handleContentImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadToS3(file, setContentImage);
  };

  // ─── WebSocket Progress Tracking ──────────────────────────────────────────

  const trackProgress = useCallback((wsUrl: string, clientId: string, promptId: string, branch: BranchType) => {
    const ws = new WebSocket(`${wsUrl}?clientId=${clientId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "progress") {
          const pct = Math.round((msg.data.value / msg.data.max) * 100);
          setProgress(pct);
          setGenerationStatus("generating");
        }

        // Capture text output from executed nodes (for Branch 1)
        if (msg.type === "executed" && msg.data.prompt_id === promptId) {
          const output = msg.data.output;
          if (output && output.text && Array.isArray(output.text)) {
            const text = output.text.join("\n");
            if (text && branch === "style_extract") {
              setExtractedText(text);
            }
          }
        }

        if (msg.type === "executing" && msg.data.node === null && msg.data.prompt_id === promptId) {
          // Generation complete
          ws.close();
          wsRef.current = null;
          setProgress(100);

          if (branch === "style_extract") {
            // If we already captured text via "executed" message, we're done
            setGenerationStatus("done");
            if (!extractedText) {
              // Fallback: try polling history
              pollResult(promptId, branch);
            }
          } else {
            pollResult(promptId, branch);
          }
        }
      } catch {}
    };

    ws.onerror = () => {
      setGenerationStatus("error");
      toast.error("WebSocket connection error");
    };
  }, [extractedText]);

  // ─── Poll Result from History ─────────────────────────────────────────────

  const pollResult = useCallback(async (promptId: string, branch: BranchType) => {
    setGenerationStatus("polling");

    // Poll with retries — Ollama/generation can take 15-60 seconds
    const maxAttempts = 30;
    const delayMs = 3000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, delayMs));

      try {
        const res = await fetch(`/api/generate/history?prompt_id=${promptId}`);
        
        if (res.status === 404) {
          // Not ready yet, keep polling
          continue;
        }

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to fetch generation result");
        }

        const data = await res.json();

        if (branch === "style_extract") {
          setExtractedText(data.extractedText || "No style text was extracted.");
        } else if (branch === "style_generate") {
          if (data.imageOutputs && data.imageOutputs.length > 0) {
            const filename = data.imageOutputs[0];
            const persistRes = await fetch("/api/generate/persist", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ filename, source: "s3" }),
            });
            if (persistRes.ok) {
              const persistData = await persistRes.json();
              setGeneratedImageUrl(persistData.url);
            }
          }
        } else if (branch === "style_transfer") {
          if (data.imageOutputs && data.imageOutputs.length > 0) {
            const filename = data.imageOutputs[0];
            const persistRes = await fetch("/api/generate/persist", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ filename, source: "s3" }),
            });
            if (persistRes.ok) {
              const persistData = await persistRes.json();
              setTransferredImageUrl(persistData.url);
            }
          }
        }

        setGenerationStatus("done");
        return;
      } catch (err: any) {
        // Only throw on last attempt
        if (attempt === maxAttempts - 1) {
          setGenerationStatus("error");
          toast.error(err.message || "Failed to retrieve result");
          return;
        }
      }
    }

    setGenerationStatus("error");
    toast.error("Generation timed out. Check ComfyUI logs.");
  }, []);

  // ─── Dispatch Generation ──────────────────────────────────────────────────

  const dispatch = useCallback(async (branch: BranchType) => {
    if (branch !== "style_generate" && (!styleImage || styleImage.uploadState !== "done")) {
      toast.error("Please upload a style reference image first.");
      return;
    }

    if (branch === "style_transfer" && (!contentImage || contentImage.uploadState !== "done")) {
      toast.error("Please upload a content image for style transfer.");
      return;
    }

    if (branch === "style_generate" && !subjectPrompt.trim()) {
      toast.error("Please enter a subject prompt.");
      return;
    }

    setActiveBranch(branch);
    setGenerationStatus("dispatched");
    setProgress(0);

    // Clear previous results for this branch
    if (branch === "style_extract") setExtractedText("");
    if (branch === "style_generate") setGeneratedImageUrl("");
    if (branch === "style_transfer") setTransferredImageUrl("");

    try {
      const payload: Record<string, any> = {
        type: branch,
        styleImageKey: styleImage?.s3Key || "",
        turboMode,
      };

      if (branch === "style_generate") {
        // Enhance the prompt using LLM before sending to Flux.2
        let fullPrompt = subjectPrompt.trim();
        
        if (extractedText) {
          setIsEnhancing(true);
          try {
            const enhanceRes = await fetch("/api/generate/style-enhance", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                styleKeywords: extractedText,
                userSubject: subjectPrompt.trim(),
              }),
            });

            if (enhanceRes.ok) {
              const enhanceData = await enhanceRes.json();
              fullPrompt = enhanceData.enhancedPrompt;
              setEnhancedPrompt(fullPrompt);
            } else {
              // Fallback: simple concatenation
              fullPrompt = `${subjectPrompt.trim()}, ${extractedText}`;
              setEnhancedPrompt(fullPrompt);
            }
          } catch {
            fullPrompt = `${subjectPrompt.trim()}, ${extractedText}`;
            setEnhancedPrompt(fullPrompt);
          } finally {
            setIsEnhancing(false);
          }
        }
        
        payload.prompt = fullPrompt;
      }

      if (branch === "style_transfer") {
        payload.contentImageKey = contentImage?.s3Key || "";
      }

      const res = await fetch("/api/generate/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Dispatch failed");
      }

      const { prompt_id, client_id, ws_url } = await res.json();
      trackProgress(ws_url, client_id, prompt_id, branch);
    } catch (err: any) {
      setGenerationStatus("error");
      toast.error(err.message || "Generation failed");
    }
  }, [styleImage, contentImage, subjectPrompt, extractedText, turboMode, trackProgress]);

  // ─── Copy to clipboard ────────────────────────────────────────────────────

  const [copied, setCopied] = useState(false);
  const copyText = () => {
    navigator.clipboard.writeText(extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const isGenerating = generationStatus === "dispatched" || generationStatus === "generating" || generationStatus === "polling";

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border/60 bg-card/30 backdrop-blur-sm">
        <Link href="/">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeftIcon className="size-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <PaletteIcon className="size-5 text-primary" />
          <h1 className="text-sm font-semibold">Style Reverse-Engineering</h1>
        </div>
        <Badge variant="secondary" className="text-[10px] ml-2">Beta</Badge>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* Upload Section */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Style Reference Upload */}
            <UploadCard
              label="Style Reference Image"
              description="The image whose visual style you want to extract or transfer"
              image={styleImage}
              onSelect={() => styleInputRef.current?.click()}
              onClear={() => setStyleImage(null)}
            />
            <input
              ref={styleInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleStyleImageSelect}
            />

            {/* Content Image Upload (for Branch 3) */}
            <UploadCard
              label="Content Image (for Transfer)"
              description="The image to repaint in the style above"
              image={contentImage}
              onSelect={() => contentInputRef.current?.click()}
              onClear={() => setContentImage(null)}
              optional
            />
            <input
              ref={contentInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleContentImageSelect}
            />
          </section>

          <Separator />

          {/* Three Branches */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Branch 1: Extract Style */}
            <BranchCard
              title="Extract Style"
              description="Analyze the style reference with a vision LLM and output style keywords"
              icon={<SparklesIcon className="size-4" />}
              active={activeBranch === "style_extract"}
              disabled={!styleImage || styleImage.uploadState !== "done" || isGenerating}
              loading={isGenerating && activeBranch === "style_extract"}
              progress={activeBranch === "style_extract" ? progress : 0}
              onRun={() => dispatch("style_extract")}
            >
              {extractedText && (
                <div className="mt-3 space-y-2">
                  <div className="relative">
                    <Textarea
                      readOnly
                      value={extractedText}
                      className="text-xs min-h-[100px] resize-none bg-muted/30"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 size-7"
                      onClick={copyText}
                    >
                      {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
                    </Button>
                  </div>
                </div>
              )}
            </BranchCard>

            {/* Branch 2: Generate in Style */}
            <BranchCard
              title="Generate in Style"
              description="Create a new image using extracted style + your subject"
              icon={<WandIcon className="size-4" />}
              active={activeBranch === "style_generate"}
              disabled={isGenerating}
              loading={isGenerating && activeBranch === "style_generate"}
              progress={activeBranch === "style_generate" ? progress : 0}
              onRun={() => dispatch("style_generate")}
            >
              <div className="mt-3 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Subject Prompt</Label>
                  <Input
                    placeholder="e.g. a red fox sitting in snow"
                    value={subjectPrompt}
                    onChange={(e) => setSubjectPrompt(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
                {extractedText && (
                  <p className="text-[10px] text-muted-foreground/70 leading-tight">
                    Style keywords will be appended automatically from Branch 1.
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Switch checked={turboMode} onCheckedChange={setTurboMode} id="turbo" />
                  <Label htmlFor="turbo" className="text-xs text-muted-foreground">Turbo Mode (faster, 8 steps)</Label>
                </div>
              </div>
              {generatedImageUrl && (
                <div className="mt-3">
                  <img
                    src={generatedImageUrl}
                    alt="Generated"
                    className="w-full rounded-lg border border-border/60 shadow-sm"
                  />
                </div>
              )}
              {enhancedPrompt && (
                <div className="mt-3 p-2 rounded-lg bg-muted/20 border border-border/40">
                  <p className="text-[10px] text-muted-foreground/70 font-medium mb-1">Enhanced Prompt:</p>
                  <p className="text-[10px] text-foreground/80 leading-relaxed">{enhancedPrompt}</p>
                </div>
              )}
              {isEnhancing && (
                <div className="mt-3 flex items-center gap-2">
                  <Loader2Icon className="size-3 text-primary animate-spin" />
                  <span className="text-[10px] text-muted-foreground">Enhancing prompt with LLM...</span>
                </div>
              )}
            </BranchCard>

            {/* Branch 3: Transfer Style */}
            <BranchCard
              title="Transfer Style"
              description="Repaint the content image in the style of the reference"
              icon={<PaletteIcon className="size-4" />}
              active={activeBranch === "style_transfer"}
              disabled={!styleImage || styleImage.uploadState !== "done" || !contentImage || contentImage.uploadState !== "done" || isGenerating}
              loading={isGenerating && activeBranch === "style_transfer"}
              progress={activeBranch === "style_transfer" ? progress : 0}
              onRun={() => dispatch("style_transfer")}
            >
              {transferredImageUrl && (
                <div className="mt-3">
                  <img
                    src={transferredImageUrl}
                    alt="Style transferred"
                    className="w-full rounded-lg border border-border/60 shadow-sm"
                  />
                </div>
              )}
            </BranchCard>

          </section>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function UploadCard({
  label,
  description,
  image,
  onSelect,
  onClear,
  optional = false,
}: {
  label: string;
  description: string;
  image: UploadedImage | null;
  onSelect: () => void;
  onClear: () => void;
  optional?: boolean;
}) {
  return (
    <div className="relative group">
      <div
        className={cn(
          "border border-dashed border-border/80 rounded-xl p-4 transition-all",
          "hover:border-primary/40 hover:bg-muted/20 cursor-pointer",
          image?.uploadState === "done" && "border-solid border-primary/30 bg-primary/5"
        )}
        onClick={!image ? onSelect : undefined}
      >
        <div className="flex items-start gap-3">
          <div className={cn(
            "size-10 rounded-lg flex items-center justify-center shrink-0",
            image?.uploadState === "done" ? "bg-primary/10" : "bg-muted/40"
          )}>
            {image?.uploadState === "uploading" ? (
              <Loader2Icon className="size-4 text-primary animate-spin" />
            ) : image?.uploadState === "done" ? (
              <CheckIcon className="size-4 text-primary" />
            ) : (
              <UploadCloudIcon className="size-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium">{label}</p>
              {optional && <Badge variant="outline" className="text-[9px] px-1.5 py-0">Optional</Badge>}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>

            {image?.uploadState === "uploading" && (
              <div className="mt-2 w-full h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-200"
                  style={{ width: `${image.progress}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        {image?.previewUrl && (
          <div className="mt-3 relative">
            <img
              src={image.previewUrl}
              alt={label}
              className="w-full h-32 object-cover rounded-lg border border-border/40"
            />
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-1 right-1 size-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
            >
              <XIcon className="size-3" />
            </Button>
          </div>
        )}

        {!image && (
          <p className="text-[10px] text-muted-foreground/60 mt-2 text-center">
            Click to select an image
          </p>
        )}
      </div>
    </div>
  );
}

function BranchCard({
  title,
  description,
  icon,
  active,
  disabled,
  loading,
  progress,
  onRun,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  active: boolean;
  disabled: boolean;
  loading: boolean;
  progress: number;
  onRun: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-all",
        active ? "border-primary/50 bg-primary/5 shadow-sm" : "border-border/60 bg-card/30",
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "size-8 rounded-lg flex items-center justify-center shrink-0",
          active ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground"
        )}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold">{title}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>

      {/* Progress */}
      {loading && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <Loader2Icon className="size-3 text-primary animate-spin" />
            <span className="text-[10px] font-mono text-muted-foreground">{progress}%</span>
          </div>
          <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {children}

      <Button
        size="sm"
        className="mt-3 w-full text-xs"
        disabled={disabled || loading}
        onClick={onRun}
      >
        {loading ? (
          <>
            <Loader2Icon className="size-3 mr-1.5 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            {icon}
            <span className="ml-1.5">Run</span>
          </>
        )}
      </Button>
    </div>
  );
}
