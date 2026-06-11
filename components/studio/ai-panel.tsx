"use client";

import { useState, useCallback } from "react";
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

// ─── Types ───────────────────────────────────────────────────────────────────

export type GenType = "t2i" | "t2v" | "t2a" | "i2v" | "i2i";

export interface GenSettings {
  type: GenType;
  model: string;
  steps: number;
  guidance: number;
  width: number;
  height: number;
}

const GEN_TYPES: { id: GenType; label: string; description: string }[] = [
  { id: "t2i", label: "Text → Image", description: "Generate images from text" },
  { id: "t2v", label: "Text → Video", description: "Generate video from text" },
  { id: "t2a", label: "Text → Audio", description: "Generate audio from text" },
  { id: "i2v", label: "Image → Video", description: "Animate an existing image" },
  { id: "i2i", label: "Image → Image", description: "Transform an image" },
];

const MODELS: Record<GenType, { id: string; name: string; provider: string }[]> = {
  t2i: [
    { id: "sdxl", name: "SDXL 1.0", provider: "stability" },
    { id: "flux-dev", name: "FLUX Dev", provider: "black-forest-labs" },
    { id: "flux-schnell", name: "FLUX Schnell", provider: "black-forest-labs" },
  ],
  t2v: [
    { id: "cogvideox", name: "CogVideoX-5B", provider: "zhipu" },
    { id: "wan-t2v", name: "Wan T2V", provider: "wan" },
  ],
  t2a: [
    { id: "audiocraft", name: "AudioCraft", provider: "meta" },
    { id: "musicgen", name: "MusicGen", provider: "meta" },
  ],
  i2v: [
    { id: "stable-video", name: "Stable Video", provider: "stability" },
    { id: "cogvideox-i2v", name: "CogVideoX I2V", provider: "zhipu" },
  ],
  i2i: [
    { id: "sdxl-img2img", name: "SDXL Img2Img", provider: "stability" },
    { id: "flux-img2img", name: "FLUX Img2Img", provider: "black-forest-labs" },
  ],
};

// ─── Mock chat messages ───────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const WELCOME: ChatMessage[] = [
  {
    id: "w1",
    role: "assistant",
    content: "Welcome to Krum Studio! Describe what you want to generate — an image, video, or audio — and I'll help you craft the perfect prompt and settings.",
  },
];

// ─── Settings Panel ───────────────────────────────────────────────────────────

interface SettingsPanelProps {
  settings: GenSettings;
  onChange: (s: Partial<GenSettings>) => void;
}

function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const [modelOpen, setModelOpen] = useState(false);
  const models = MODELS[settings.type] ?? [];
  const currentModel = models.find((m) => m.id === settings.model) ?? models[0];

  return (
    <ScrollArea className="h-full">
      <div className="p-4 flex flex-col gap-5">
        {/* Generation type */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Generation Type</Label>
          <div className="grid grid-cols-1 gap-1.5">
            {GEN_TYPES.map((gt) => (
              <button
                key={gt.id}
                onClick={() => onChange({ type: gt.id, model: (MODELS[gt.id]?.[0]?.id ?? "") })}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg text-xs border transition-colors text-left",
                  settings.type === gt.id
                    ? "border-primary/50 bg-primary/8 text-foreground"
                    : "border-border bg-card hover:bg-muted/50 text-muted-foreground"
                )}
              >
                <span className="font-medium">{gt.label}</span>
                <span className="text-[10px] text-muted-foreground hidden sm:block">{gt.description}</span>
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Model selector */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Model</Label>
          <ModelSelector open={modelOpen} onOpenChange={setModelOpen}>
            <ModelSelectorTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-8">
                {currentModel && (
                  <>
                    <ModelSelectorLogo provider={currentModel.provider} />
                    <span>{currentModel.name}</span>
                  </>
                )}
              </Button>
            </ModelSelectorTrigger>
            <ModelSelectorContent>
              <ModelSelectorInput placeholder="Search models…" />
              <ModelSelectorList>
                <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                <ModelSelectorGroup heading={settings.type.toUpperCase()}>
                  {models.map((m) => (
                    <ModelSelectorItem
                      key={m.id}
                      value={m.id}
                      onSelect={() => { onChange({ model: m.id }); setModelOpen(false); }}
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

        <Separator />

        {/* Generation params */}
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-full group">
            <ChevronRightIcon className="size-3 transition-transform group-data-[state=open]:rotate-90" />
            Parameters
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 flex flex-col gap-4">
              {/* Steps */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Steps</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">{settings.steps}</span>
                </div>
                <Slider
                  min={1} max={50} step={1}
                  value={[settings.steps]}
                  onValueChange={([v]) => onChange({ steps: v })}
                />
              </div>

              {/* Guidance */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">CFG Scale</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">{settings.guidance.toFixed(1)}</span>
                </div>
                <Slider
                  min={1} max={20} step={0.5}
                  value={[settings.guidance]}
                  onValueChange={([v]) => onChange({ guidance: v })}
                />
              </div>

              {/* Aspect ratio */}
              <div className="space-y-2">
                <Label className="text-xs">Aspect Ratio</Label>
                <Select
                  value={`${settings.width}x${settings.height}`}
                  onValueChange={(v) => {
                    const [w, h] = v.split("x").map(Number);
                    onChange({ width: w, height: h });
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="512x512">512 × 512 (1:1)</SelectItem>
                    <SelectItem value="768x512">768 × 512 (3:2)</SelectItem>
                    <SelectItem value="512x768">512 × 768 (2:3)</SelectItem>
                    <SelectItem value="1024x576">1024 × 576 (16:9)</SelectItem>
                    <SelectItem value="576x1024">576 × 1024 (9:16)</SelectItem>
                    <SelectItem value="1024x1024">1024 × 1024 (1:1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </ScrollArea>
  );
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (msg: PromptInputMessage) => void;
  status: "ready" | "streaming";
  onGenerate: (prompt: string) => void;
}

function ChatPanel({ messages, onSend, status, onGenerate }: ChatPanelProps) {
  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden">
        <Conversation className="h-full">
          <ConversationContent className="px-3 py-2">
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

      <div className="shrink-0 border-t border-border p-2">
        <PromptInput onSubmit={onSend} className="w-full">
          <PromptInputBody>
            <PromptInputTextarea placeholder="Describe what to generate…" className="min-h-[60px] text-sm" />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
            </PromptInputTools>
            <PromptInputSubmit status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

// ─── Generate Bar ─────────────────────────────────────────────────────────────

interface GenerateBarProps {
  settings: GenSettings;
  onGenerate: () => void;
  disabled: boolean;
}

function GenerateBar({ settings, onGenerate, disabled }: GenerateBarProps) {
  const gt = GEN_TYPES.find((g) => g.id === settings.type);
  return (
    <div className="shrink-0 border-t border-border px-3 py-2.5 flex items-center gap-2 bg-card/40">
      <div className="flex-1 min-w-0">
        <Badge variant="outline" className="text-[10px] text-muted-foreground">
          {gt?.label ?? settings.type}
        </Badge>
      </div>
      <Button
        onClick={onGenerate}
        disabled={disabled}
        size="sm"
        className="gap-1.5 text-xs h-8 px-4"
      >
        <SparklesIcon className="size-3.5" />
        Generate
      </Button>
    </div>
  );
}

// ─── Main AI Panel ────────────────────────────────────────────────────────────

interface AiPanelProps {
  generation: GenerationState;
  onGenerate: (prompt: string, settings: GenSettings) => void;
  onClose?: () => void;
}

export function AiPanel({ generation, onGenerate, onClose }: AiPanelProps) {
  const [settings, setSettings] = useState<GenSettings>({
    type: "t2i",
    model: "sdxl",
    steps: 20,
    guidance: 7.5,
    width: 1024,
    height: 1024,
  });

  const [messages, setMessages] = useState<ChatMessage[]>(WELCOME);
  const [chatStatus, setChatStatus] = useState<"ready" | "streaming">("ready");
  const [lastPrompt, setLastPrompt] = useState("");

  const handleSend = useCallback((msg: PromptInputMessage) => {
    if (!msg.text.trim()) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: msg.text };
    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: `Got it! I'll use "${msg.text}" as your prompt with ${MODELS[settings.type]?.find(m => m.id === settings.model)?.name ?? settings.model}. Click **Generate** when ready, or adjust the settings.`,
    };

    setLastPrompt(msg.text);
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
  }, [settings]);

  const handleGenerate = useCallback(() => {
    if (!lastPrompt) return;
    onGenerate(lastPrompt, settings);
  }, [lastPrompt, settings, onGenerate]);

  const handleSettingsChange = useCallback((patch: Partial<GenSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const isGenerating = generation.status === "dispatched" || generation.status === "generating";

  return (
    <div className="flex flex-col h-full overflow-hidden bg-sidebar border-l border-sidebar-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-3.5 text-primary" />
          <span className="text-xs font-semibold text-sidebar-foreground">Studio AI</span>
        </div>
        <div className="flex items-center gap-1">
          {isGenerating && (
            <Badge variant="outline" className="text-[10px] animate-pulse border-primary/30 text-primary">
              Generating {generation.progress}%
            </Badge>
          )}
          {onClose && (
            <Button variant="ghost" size="icon-sm" onClick={onClose} className="size-6 text-muted-foreground">
              <XIcon className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="chat" className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <TabsList className="mx-3 mt-2 mb-0 h-8 grid w-[calc(100%-1.5rem)] grid-cols-2 shrink-0">
          <TabsTrigger value="chat" className="text-xs gap-1.5">
            <MessageSquareIcon className="size-3" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs gap-1.5">
            <SlidersHorizontalIcon className="size-3" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="flex flex-col flex-1 min-h-0 mt-0 overflow-hidden data-[state=inactive]:hidden">
          <ChatPanel
            messages={messages}
            onSend={handleSend}
            status={chatStatus}
            onGenerate={handleGenerate}
          />
        </TabsContent>

        <TabsContent value="settings" className="flex-1 min-h-0 mt-0 overflow-hidden data-[state=inactive]:hidden">
          <SettingsPanel settings={settings} onChange={handleSettingsChange} />
        </TabsContent>
      </Tabs>

      {/* Generate bar — always visible */}
      <GenerateBar
        settings={settings}
        onGenerate={handleGenerate}
        disabled={!lastPrompt || isGenerating}
      />
    </div>
  );
}
