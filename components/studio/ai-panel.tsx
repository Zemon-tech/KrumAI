"use client";

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronRightIcon,
  SparklesIcon,
  SlidersHorizontalIcon,
  MessageSquareIcon,
  XIcon,
} from "lucide-react";

import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionAddAttachments,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";

import type { GenerationState } from "./preview-panel";

// Types
export type GenType = "t2i" | "t2v" | "i2v" | "i2i";

export interface GenSettings {
  type: GenType;
  model: string;
  steps: number;
  guidance: number;
  width: number;
  height: number;
  llmProvider: "openrouter" | "llamacpp";
}

const GEN_TYPES: { id: GenType; label: string; description: string }[] = [
  { id: "t2i", label: "Text → Image (Flux)", description: "Generate images from text prompts" },
  { id: "t2v", label: "Text → Video (LTX)", description: "Generate short videos from text prompts" },
  { id: "i2v", label: "Image → Video (LTX)", description: "Animate a selected library image" },
  { id: "i2i", label: "Image Edit (Qwen)", description: "Edit a library image using Qwen Image Edit" },
];

const MODELS: Record<GenType, { id: string; name: string; provider: string }[]> = {
  t2i: [
    { id: "flux-dev", name: "FLUX Dev", provider: "black-forest-labs" },
  ],
  t2v: [
    { id: "ltx-video-t2v", name: "LTX Video T2V", provider: "lightricks" },
  ],
  i2v: [
    { id: "ltx-video-i2v", name: "LTX Video I2V", provider: "lightricks" },
  ],
  i2i: [
    { id: "qwen-image-edit", name: "Qwen Image Edit", provider: "alibaba" },
  ],
};

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const INITIAL_WELCOME: ChatMessage[] = [
  {
    id: "w1",
    role: "assistant",
    content: "Welcome to **Krum Studio**! Describe what you'd like to create (e.g. *'a scenic sunset on a snowy mountain'* or *'a cinematic cyber-synth loop'*). I'll help set up the prompt and parameter guidelines.",
  },
];

interface AiPanelProps {
  generation: GenerationState;
  onGenerate: (prompt: string, settings: GenSettings) => void;
  onClose?: () => void;
}

export function AiPanel({ generation, onGenerate, onClose }: AiPanelProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "settings">("chat");
  const [settings, setSettings] = useState<GenSettings>({
    type: "t2i",
    model: "flux-dev",
    steps: 25,
    guidance: 6.0,
    width: 1024,
    height: 1024,
    llmProvider: "llamacpp",
  });

  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_WELCOME);
  const [modelOpen, setModelOpen] = useState(false);
  const [llmModelOpen, setLlmModelOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  const modelsForType = MODELS[settings.type] || [];
  const currentModel = modelsForType.find((m) => m.id === settings.model) || modelsForType[0];

  // Sync default model when generation type changes
  const handleTypeChange = (type: GenType) => {
    const defaultModel = MODELS[type]?.[0]?.id || "";
    const isVideo = type === "t2v" || type === "i2v";
    setSettings((prev) => ({
      ...prev,
      type,
      model: defaultModel,
      width: isVideo ? 768 : 1024,
      height: isVideo ? 512 : 1024,
    }));
  };

  const isGenerating = generation.status === "dispatched" || generation.status === "generating";

  const handleSend = useCallback(async (msg: PromptInputMessage) => {
    if (!msg.text.trim() || chatLoading || isGenerating) return;

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: msg.text,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setChatLoading(true);

    // Create a new assistant message placeholder in state
    const assistantMessageId = `ast-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
      },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: updatedMessages,
          settings,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "Failed to communicate with AI Creative Director");
        throw new Error(errText);
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("No response reader stream available");
      }

      const decoder = new TextDecoder();
      let done = false;
      let accumulatedText = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunkValue = decoder.decode(value, { stream: !done });
          accumulatedText += chunkValue;

          // Split off the trigger JSON tag if present
          let displayText = accumulatedText;
          const triggerIndex = accumulatedText.indexOf("[TRIGGER_GENERATION]");
          if (triggerIndex !== -1) {
            displayText = accumulatedText.substring(0, triggerIndex).trim();
          }

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content: displayText || "Generating content..." }
                : m
            )
          );
        }
      }

      // Once streaming finishes, check if we need to trigger generation
      const triggerIndex = accumulatedText.indexOf("[TRIGGER_GENERATION]");
      if (triggerIndex !== -1) {
        const jsonPart = accumulatedText.substring(triggerIndex + "[TRIGGER_GENERATION]".length).trim();
        try {
          const parsed = JSON.parse(jsonPart);
          console.log("AI Director triggered generation with enhanced prompt:", parsed.enhancedPrompt);
          onGenerate(parsed.enhancedPrompt, {
            ...settings,
            steps: parsed.steps ?? settings.steps,
            guidance: parsed.guidance ?? settings.guidance,
            width: parsed.width ?? settings.width,
            height: parsed.height ?? settings.height,
          });
        } catch (e) {
          console.warn("Failed to parse local LLM trigger JSON:", e);
        }
      }
    } catch (err: any) {
      console.error("Error in chat reasoning loop:", err);
      // Remove the empty assistant message placeholder if it was added
      setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
      setMessages((prev) => [
        ...prev,
        {
          id: `ast-err-${Date.now()}`,
          role: "assistant",
          content: `⚠️ **Error:** ${err.message || "Failed to reach AI Creative Director."}`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [messages, settings, onGenerate, chatLoading, isGenerating]);

  const promptInputStatus = chatLoading
    ? "submitted"
    : isGenerating
      ? (generation.status === "dispatched" ? "submitted" : "streaming")
      : "ready";

  useEffect(() => {
    if (generation.status === "done" && generation.assetUrl) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ast-done-${Date.now()}`,
          role: "assistant",
          content: `✨ **Generation complete!** The asset has been successfully loaded into the Workspace Canvas.`,
        },
      ]);
    } else if (generation.status === "error") {
      setMessages((prev) => [
        ...prev,
        {
          id: `ast-err-${Date.now()}`,
          role: "assistant",
          content: `❌ **Generation failed:** ${generation.error || "An error occurred during ComfyUI execution."}`,
        },
      ]);
    }
  }, [generation.status, generation.assetUrl, generation.error]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-sidebar border-l border-sidebar-border">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-1.5">
          <SparklesIcon className="size-3.5 text-primary" />
          <span className="text-xs font-semibold text-sidebar-foreground">Studio AI Assistant</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isGenerating && (
            <Badge variant="outline" className="text-[10px] animate-pulse border-primary/30 text-primary">
              Running {generation.progress}%
            </Badge>
          )}
          {onClose && (
            <Button variant="ghost" size="icon-sm" onClick={onClose} className="size-6 text-muted-foreground hover:text-foreground">
              <XIcon className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      {/* ── Tabs ── */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "chat" | "settings")}
        className="flex flex-col flex-1 min-h-0 overflow-hidden"
      >
        <TabsList className="mx-3 mt-2 mb-1 h-7.5 grid grid-cols-2 shrink-0 bg-muted/50 p-0.5">
          <TabsTrigger value="chat" className="text-[11px] gap-1.5 py-1">
            <MessageSquareIcon className="size-3" />
            Chat Assistant
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-[11px] gap-1.5 py-1">
            <SlidersHorizontalIcon className="size-3" />
            Generator Settings
          </TabsTrigger>
        </TabsList>

        {/* ── Chat Tab Content ── */}
        <TabsContent value="chat" className="flex flex-col flex-1 min-h-0 mt-0 overflow-hidden outline-none">
          <div className="flex-1 min-h-0 overflow-hidden">
            <Conversation className="h-full">
              <ConversationContent className="px-3 py-2 space-y-4">
                {messages.map((msg) => (
                  <Message key={msg.id} from={msg.role}>
                    <MessageContent>
                      <MessageResponse>{msg.content}</MessageResponse>
                    </MessageContent>
                  </Message>
                ))}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
          </div>
        </TabsContent>

        {/* ── Settings Tab Content ── */}
        <TabsContent value="settings" className="flex-1 min-h-0 mt-0 overflow-hidden outline-none">
          <ScrollArea className="h-full">
            <div className="p-3.5 space-y-5">
              {/* Type Select */}
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Generation Output</Label>
                <div className="grid grid-cols-1 gap-1">
                  {GEN_TYPES.map((gt) => (
                    <button
                      key={gt.id}
                      onClick={() => handleTypeChange(gt.id)}
                      className={cn(
                        "flex flex-col items-start px-3 py-2 rounded-lg text-[11px] border transition-all text-left w-full",
                        settings.type === gt.id
                          ? "border-primary/50 bg-primary/5 text-foreground ring-1 ring-primary/20"
                          : "border-border/60 bg-card/40 hover:bg-muted/40 text-muted-foreground"
                      )}
                    >
                      <span className="font-semibold text-foreground">{gt.label}</span>
                      <span className="text-[9px] text-muted-foreground/80 mt-0.5">{gt.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Separator className="bg-border/60" />

              {/* Model Select */}
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Neural Model</Label>
                <ModelSelector open={modelOpen} onOpenChange={setModelOpen}>
                  <ModelSelectorTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-between text-[11px] h-8.5 bg-background/50 border-border/60 px-2.5">
                      {currentModel ? (
                        <div className="flex items-center gap-2">
                          <ModelSelectorLogo provider={currentModel.provider} className="size-3.5" />
                          <span>{currentModel.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Select model...</span>
                      )}
                      <ChevronRightIcon className="size-3.5 rotate-90 text-muted-foreground" />
                    </Button>
                  </ModelSelectorTrigger>
                  <ModelSelectorContent>
                    <ModelSelectorInput placeholder="Filter models..." />
                    <ModelSelectorList>
                      <ModelSelectorEmpty>No model found.</ModelSelectorEmpty>
                      <ModelSelectorGroup heading={settings.type.toUpperCase()}>
                        {modelsForType.map((m) => (
                          <ModelSelectorItem
                            key={m.id}
                            value={m.id}
                            onSelect={() => {
                              setSettings((s) => ({ ...s, model: m.id }));
                              setModelOpen(false);
                            }}
                          >
                            <ModelSelectorLogo provider={m.provider} />
                            <ModelSelectorName>{m.name}</ModelSelectorName>
                            <ModelSelectorLogoGroup>
                              <ModelSelectorLogo provider={m.provider} />
                            </ModelSelectorLogoGroup>
                          </ModelSelectorItem>
                        ))}
                      </ModelSelectorGroup>
                    </ModelSelectorList>
                  </ModelSelectorContent>
                </ModelSelector>
              </div>

              {/* LLM Enhancer Model Select */}
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Prompt Enhancer LLM</Label>
                <ModelSelector open={llmModelOpen} onOpenChange={setLlmModelOpen}>
                  <ModelSelectorTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-between text-[11px] h-8.5 bg-background/50 border-border/60 px-2.5">
                      <div className="flex items-center gap-2">
                        <ModelSelectorLogo provider={settings.llmProvider === "llamacpp" ? "llama" : "openrouter"} className="size-3.5" />
                        <span>{settings.llmProvider === "llamacpp" ? "Llama.cpp (Local)" : "OpenRouter (Cloud)"}</span>
                      </div>
                      <ChevronRightIcon className="size-3.5 rotate-90 text-muted-foreground" />
                    </Button>
                  </ModelSelectorTrigger>
                  <ModelSelectorContent>
                    <ModelSelectorInput placeholder="Filter LLMs..." />
                    <ModelSelectorList>
                      <ModelSelectorEmpty>No model found.</ModelSelectorEmpty>
                      <ModelSelectorGroup heading="LLM ASSISTANTS">
                        <ModelSelectorItem
                          value="openrouter"
                          onSelect={() => {
                            setSettings((s) => ({ ...s, llmProvider: "openrouter" }));
                            setLlmModelOpen(false);
                          }}
                        >
                          <ModelSelectorLogo provider="openrouter" />
                          <ModelSelectorName>OpenRouter (Cloud LLM)</ModelSelectorName>
                        </ModelSelectorItem>
                        <ModelSelectorItem
                          value="llamacpp"
                          onSelect={() => {
                            setSettings((s) => ({ ...s, llmProvider: "llamacpp" }));
                            setLlmModelOpen(false);
                          }}
                        >
                          <ModelSelectorLogo provider="llama" />
                          <ModelSelectorName>Llama.cpp (Local LLM Server)</ModelSelectorName>
                        </ModelSelectorItem>
                      </ModelSelectorGroup>
                    </ModelSelectorList>
                  </ModelSelectorContent>
                </ModelSelector>
              </div>

              <Separator className="bg-border/60" />

              {/* Params Collapsible */}
              <Collapsible defaultOpen className="space-y-2">
                <CollapsibleTrigger className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-full hover:text-foreground">
                  <span>Advanced Parameters</span>
                  <ChevronRightIcon className="size-3.5 transition-transform data-[state=open]:rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-1.5">
                  {/* Steps */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <Label className="text-muted-foreground">Inference Steps</Label>
                      <span className="font-mono text-[11px] text-foreground">{settings.steps}</span>
                    </div>
                    <Slider
                      min={5}
                      max={50}
                      step={1}
                      value={[settings.steps]}
                      onValueChange={([val]) => setSettings((s) => ({ ...s, steps: val }))}
                    />
                  </div>

                  {/* Guidance */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <Label className="text-muted-foreground">CFG Guidance Scale</Label>
                      <span className="font-mono text-[11px] text-foreground">{settings.guidance.toFixed(1)}</span>
                    </div>
                    <Slider
                      min={1.0}
                      max={15.0}
                      step={0.5}
                      value={[settings.guidance]}
                      onValueChange={([val]) => setSettings((s) => ({ ...s, guidance: val }))}
                    />
                  </div>

                  {/* Aspect Ratio */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Canvas Aspect Ratio</Label>
                    <Select
                      value={`${settings.width}x${settings.height}`}
                      onValueChange={(val) => {
                        const [w, h] = val.split("x").map(Number);
                        setSettings((s) => ({ ...s, width: w, height: h }));
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background/50 border-border/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1024x1024">1:1 Square (1024 × 1024)</SelectItem>
                        <SelectItem value="1024x576">16:9 Landscape (1024 × 576)</SelectItem>
                        <SelectItem value="576x1024">9:16 Portrait (576 × 1024)</SelectItem>
                        <SelectItem value="768x512">3:2 Cinematic (768 × 512)</SelectItem>
                        <SelectItem value="512x768">2:3 Portrait (512 × 768)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* ── Unified Prompt Input ── */}
      <div className="shrink-0 border-t border-border p-2 bg-card/10">
        <PromptInput onSubmit={handleSend} className="w-full">
          <PromptInputBody>
            <PromptInputTextarea
              placeholder="Describe what you want to generate..."
              className="min-h-[50px] max-h-[120px] text-xs resize-none bg-background/50 border-border/60 focus-visible:ring-1 focus-visible:ring-primary/40"
            />
          </PromptInputBody>
          <PromptInputFooter className="flex items-center justify-between mt-1 px-1">
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
            </PromptInputTools>
            <PromptInputSubmit status={promptInputStatus} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
