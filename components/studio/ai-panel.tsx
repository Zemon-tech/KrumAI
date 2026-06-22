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
import type { AssetItem } from "./asset-sidebar";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

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
  duration?: number;
  fps?: number;
  useEnhancer?: boolean;

  // User-Facing Parameters (Safe)
  prompt?: string;
  negativePrompt?: string;
  qualityLevel?: "Draft" | "Standard" | "High" | "Ultra";
  styleStrength?: number;
  promptEnhancement?: number;
  creativity?: number;
  detailLevel?: number;
  faceDetail?: number;
  lightingStyle?: "Auto" | "Natural" | "Studio" | "Cinematic" | "Golden Hour" | "Dramatic";
  cameraType?: "Auto" | "Smartphone" | "DSLR" | "Cinema" | "Macro";
  aspectRatio?: "Auto" | "1:1" | "16:9" | "9:16" | "3:2" | "4:5";
  resolution?: "Auto" | "HD" | "2K" | "4K";
  colorStyle?: "Natural" | "Vibrant" | "Muted" | "Filmic";
  sharpness?: number;
  realism?: number;
  upscaleOutput?: boolean;
  upscaleFactor?: "1x" | "2x" | "4x";
  turboMode?: boolean;
  presetStyle?: string;
  sampler?: string;

  // Qwen Image Edit parameters
  editType?: "auto" | "text_edit" | "object_add" | "object_remove" | "object_replace" | "background_change" | "style_transfer" | "face_edit" | "product_edit" | "poster_edit" | "logo_edit" | "rotation";
  editStrength?: number;
  preservationMode?: "strict" | "balanced" | "creative";
  identityLock?: number;
  facePreservation?: number;
  backgroundLock?: number;
  objectLock?: number;
  sceneConsistency?: number;
  textMode?: "auto" | "add" | "replace" | "remove" | "preserve";
  typographyQuality?: "standard" | "high" | "maximum";
  fontPreservation?: number;
  textAccuracy?: number;
  compositionLock?: number;
  cameraStyle?: "auto" | "portrait" | "cinematic" | "studio" | "fashion" | "product" | "macro";
  precisionMode?: "low" | "medium" | "high" | "pixel_perfect";
  autoRefine?: boolean;
  refinementPasses?: number;
  style?: "auto" | "photorealistic" | "cinematic" | "editorial" | "product" | "luxury" | "anime" | "ghibli" | "watercolor" | "oil_painting" | "comic" | "3d_render" | "pixel_art";
  outputQuality?: "standard" | "high" | "ultra";
}

export function calculateDimensions(type: GenType, aspectRatio: string, resolution: string, qualityLevel: string = "Standard") {
  const isVideo = type === "t2v" || type === "i2v";
  
  // Base maximum dimension
  let maxDim = isVideo ? 768 : 1024;
  
  // Adjust base size by resolution setting
  if (resolution === "HD") {
    maxDim = isVideo ? 1024 : 1024;
  } else if (resolution === "2K") {
    maxDim = isVideo ? 1280 : 2048;
  } else if (resolution === "4K") {
    maxDim = isVideo ? 1920 : 3840;
  }

  // Apply Quality resolution multiplier (only for image generation)
  if (!isVideo && type === "t2i") {
    let multiplier = 1.0;
    if (qualityLevel === "High") {
      multiplier = 1.25;
    } else if (qualityLevel === "Ultra") {
      multiplier = 1.5;
    }
    maxDim = Math.round(maxDim * multiplier);
  }

  // Calculate dimensions based on aspect ratio
  if (aspectRatio === "1:1") {
    return { width: maxDim, height: maxDim };
  } else if (aspectRatio === "16:9") {
    return { width: maxDim, height: isVideo ? 512 : Math.round(maxDim * 9 / 16) };
  } else if (aspectRatio === "9:16") {
    return { width: isVideo ? 512 : Math.round(maxDim * 9 / 16), height: maxDim };
  } else if (aspectRatio === "3:2") {
    return { width: maxDim, height: Math.round(maxDim * 2 / 3) };
  } else if (aspectRatio === "4:5") {
    return { width: Math.round(maxDim * 4 / 5), height: maxDim };
  }
  
  // Auto / Default
  return isVideo ? { width: 768, height: 512 } : { width: 1024, height: 1024 };
}

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  promptInjection: string;
  parameters: {
    steps?: number;
    guidance?: number;
    detailLevel?: number;
    realism?: number;
    textQuality?: number;
    sampler?: string;
  };
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "none",
    name: "None / Custom",
    description: "Use your own custom parameters",
    promptInjection: "",
    parameters: {}
  },
  {
    id: "photorealistic",
    name: "Photorealistic",
    description: "Portraits, people, lifestyle, travel realism",
    promptInjection: "Style: High-end commercial photography. Shot on Hasselblad X2D. 80mm lens. f/2.8 aperture. Natural realistic lighting. Authentic skin textures. Premium commercial photography. Shallow depth of field. Accurate colors.",
    parameters: {
      steps: 28,
      guidance: 3.5,
      detailLevel: 85,
      realism: 100,
      sampler: "dpmpp_2m"
    }
  },
  {
    id: "cinematic",
    name: "Cinematic",
    description: "Movie scenes, dramatic storytelling, film still",
    promptInjection: "Style: Cinematic film still. Shot using anamorphic cinema lenses. Dramatic practical lighting. Volumetric atmosphere. Film-quality contrast. Natural lens characteristics. Visual storytelling.",
    parameters: {
      steps: 30,
      guidance: 4.0,
      detailLevel: 90,
      realism: 90,
      sampler: "dpmpp_sde"
    }
  },
  {
    id: "product",
    name: "Product Showcase",
    description: "Premium luxury product advertising shots",
    promptInjection: "Style: Premium luxury product photography. Professional studio lighting. Clean reflections. Perfect edge definition. Commercial advertising quality. Minimal distractions.",
    parameters: {
      steps: 32,
      guidance: 4.5,
      detailLevel: 100,
      realism: 95,
      sampler: "dpmpp_2m"
    }
  },
  {
    id: "social_media",
    name: "Social Media Design",
    description: "Instagram posts, thumbnails, high engagement graphics",
    promptInjection: "Style: Modern social media design. Strong visual hierarchy. Bold focal point. Clear communication. High engagement design. Professional layout.",
    parameters: {
      steps: 24,
      guidance: 4.0,
      detailLevel: 80,
      realism: 75,
      sampler: "euler"
    }
  },
  {
    id: "typography",
    name: "Typography Focus",
    description: "Banners, quote layouts, readable clear text",
    promptInjection: "Style: Professional graphic design. Typography is the primary focus. All text must be perfectly spelled, fully readable, professionally typeset, well aligned, high contrast, visually balanced.",
    parameters: {
      steps: 32,
      guidance: 5.0,
      detailLevel: 95,
      sampler: "dpmpp_2m"
    }
  },
  {
    id: "editorial",
    name: "Luxury Editorial",
    description: "Magazine covers, fashion editorial look",
    promptInjection: "Style: Luxury editorial photography. Fashion magazine quality. Premium composition. Elegant posing. Sophisticated lighting. Luxury color grading.",
    parameters: {
      steps: 30,
      guidance: 4.0,
      detailLevel: 95,
      realism: 90,
      sampler: "dpmpp_sde"
    }
  },
  {
    id: "concept_art",
    name: "AAA Concept Art",
    description: "Sci-fi/fantasy worldbuilding, game environments",
    promptInjection: "Style: AAA concept art. Large-scale visual design. Rich environmental storytelling. Epic composition. Advanced atmosphere. High-detail worldbuilding.",
    parameters: {
      steps: 35,
      guidance: 4.5,
      detailLevel: 100,
      realism: 70,
      sampler: "dpmpp_sde"
    }
  }
];

export function assembleFluxPrompt(promptText: string, settings: GenSettings): string {
  if (settings.type !== "t2i") return promptText;

  const parts: string[] = [promptText];

  // Selected Style
  if (settings.presetStyle && settings.presetStyle !== "none") {
    const preset = STYLE_PRESETS.find((p) => p.id === settings.presetStyle);
    if (preset && preset.promptInjection) {
      parts.push(preset.promptInjection);
    }
  }

  // Camera Settings
  if (settings.cameraType && settings.cameraType !== "Auto") {
    if (settings.cameraType === "Smartphone") {
      parts.push("Shot on modern smartphone camera, mobile photo style.");
    } else if (settings.cameraType === "DSLR") {
      parts.push("Professional DSLR camera photography, sharp focus, high depth of field.");
    } else if (settings.cameraType === "Cinema") {
      parts.push("Shot using professional anamorphic cinema lenses, film capture look.");
    } else if (settings.cameraType === "Macro") {
      parts.push("Macro lens close-up photography, extreme detail capture.");
    }
  }

  // Lighting
  if (settings.lightingStyle && settings.lightingStyle !== "Auto") {
    if (settings.lightingStyle === "Natural") {
      parts.push("Soft diffused natural lighting.");
    } else if (settings.lightingStyle === "Studio") {
      parts.push("Controlled professional studio lighting, portrait photography setups.");
    } else if (settings.lightingStyle === "Cinematic") {
      parts.push("Cinematic lighting, practical lights in scene, atmospheric contrast.");
    } else if (settings.lightingStyle === "Golden Hour") {
      parts.push("Warm golden hour sunset lighting, soft long shadow gradients.");
    } else if (settings.lightingStyle === "Dramatic") {
      parts.push("Dramatic high contrast chiaroscuro lighting, dark moody shadow definition.");
    }
  }

  // Color Style
  if (settings.colorStyle && settings.colorStyle !== "Natural") {
    if (settings.colorStyle === "Vibrant") {
      parts.push("Vibrant color palette, highly saturated tones.");
    } else if (settings.colorStyle === "Muted") {
      parts.push("Muted color palette, earthy organic tones.");
    } else if (settings.colorStyle === "Filmic") {
      parts.push("Filmic color grading, vintage lift and color tones.");
    }
  }

  // Detailing & Realism Sliders mapping
  if (settings.detailLevel !== undefined && settings.detailLevel > 60) {
    parts.push(`High detail rendering, rich textures, fine structures.`);
  }
  if (settings.realism !== undefined && settings.realism > 60) {
    parts.push(`Photorealistic fidelity, highly lifelike details.`);
  }
  if (settings.sharpness !== undefined && settings.sharpness > 60) {
    parts.push(`Crisp sharpness, sharp focus on subject.`);
  }
  if (settings.faceDetail !== undefined && settings.faceDetail > 60) {
    parts.push(`High-definition facial features, detailed skin texture.`);
  }

  // Global Quality Injection
  parts.push(
    "Professional composition.\nRealistic lighting and shadows.\nPhysically accurate materials.\nClean depth separation.\nPremium color grading.\nStrong visual hierarchy.\nHigh clarity.\nNatural texture detail.\nCommercial production quality."
  );

  return parts.filter(Boolean).join("\n\n");
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
  selectedAsset?: AssetItem | null;
  onGenerate: (prompt: string, settings: GenSettings) => void;
  onClose?: () => void;
  availableAssets?: AssetItem[];
  onSelectAsset?: (id: string) => void;
}

export function AiPanel({ generation, selectedAsset, onGenerate, onClose, availableAssets = [], onSelectAsset }: AiPanelProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "settings">("chat");
  const [settings, setSettings] = useState<GenSettings>({
    type: "t2i",
    model: "flux-dev",
    steps: 25,
    guidance: 6.0,
    width: 1024,
    height: 1024,
    llmProvider: "llamacpp",
    useEnhancer: true,
    negativePrompt: "",
    qualityLevel: "Standard",
    styleStrength: 50,
    promptEnhancement: 50,
    creativity: 50,
    detailLevel: 50,
    faceDetail: 50,
    lightingStyle: "Auto",
    cameraType: "Auto",
    aspectRatio: "Auto",
    resolution: "Auto",
    colorStyle: "Natural",
    sharpness: 50,
    realism: 50,
    upscaleOutput: false,
    upscaleFactor: "2x",
    turboMode: true,
    presetStyle: "none",

    // Qwen Image Edit defaults
    editType: "auto",
    editStrength: 50,
    preservationMode: "balanced",
    identityLock: 80,
    facePreservation: 80,
    backgroundLock: 70,
    objectLock: 70,
    sceneConsistency: 90,
    textMode: "auto",
    typographyQuality: "maximum",
    fontPreservation: 90,
    textAccuracy: 100,
    compositionLock: 80,
    cameraStyle: "auto",
    precisionMode: "high",
    autoRefine: true,
    refinementPasses: 2,
    style: "auto",
    outputQuality: "high",
  });

  const [directPrompt, setDirectPrompt] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_WELCOME);
  const [modelOpen, setModelOpen] = useState(false);
  const [llmModelOpen, setLlmModelOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const modelsForType = MODELS[settings.type] || [];
  const currentModel = modelsForType.find((m) => m.id === settings.model) || modelsForType[0];

  // Sync default model when generation type changes
  const handleTypeChange = useCallback((type: GenType) => {
    const defaultModel = MODELS[type]?.[0]?.id || "";
    const isVideo = type === "t2v" || type === "i2v";
    setSettings((prev) => {
      const currentRatio = prev.aspectRatio || "Auto";
      const currentRes = prev.resolution || "Auto";
      const { width, height } = calculateDimensions(type, currentRatio, currentRes);
      return {
        ...prev,
        type,
        model: defaultModel,
        width,
        height,
        duration: isVideo ? 5 : undefined,
        fps: isVideo ? 25 : undefined,
      };
    });
  }, []);


  // Restore settings and conversations from LocalStorage on mount
  useEffect(() => {
    setIsMounted(true);

    const savedSettings = localStorage.getItem("krum-studio-settings");
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error("Failed to restore settings from LocalStorage:", e);
      }
    }

    const savedMessages = localStorage.getItem("krum-studio-messages");
    if (savedMessages) {
      try {
        setMessages(JSON.parse(savedMessages));
      } catch (e) {
        console.error("Failed to restore messages from LocalStorage:", e);
      }
    }

    const savedTab = localStorage.getItem("krum-studio-active-tab");
    if (savedTab) {
      setActiveTab(savedTab as "chat" | "settings");
    }
  }, []);

  // Save changes to LocalStorage after mount
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("krum-studio-settings", JSON.stringify(settings));
    }
  }, [settings, isMounted]);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("krum-studio-messages", JSON.stringify(messages));
    }
  }, [messages, isMounted]);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("krum-studio-active-tab", activeTab);
    }
  }, [activeTab, isMounted]);

  const isGenerating = generation.status === "dispatched" || generation.status === "generating";

  const handleDirectGenerate = useCallback(() => {
    if (!directPrompt.trim() || isGenerating) return;
    const isVideo = settings.type === "t2v" || settings.type === "i2v";
    const defaultModel = MODELS[settings.type]?.[0]?.id || "";
    
    const finalPrompt = settings.type === "t2i"
      ? assembleFluxPrompt(directPrompt, settings)
      : directPrompt;

    onGenerate(finalPrompt, {
      ...settings,
      model: settings.model ?? defaultModel,
      duration: isVideo ? (settings.duration ?? 5) : undefined,
      fps: isVideo ? (settings.fps ?? 25) : undefined,
    });
  }, [directPrompt, settings, onGenerate, isGenerating]);

  const handleSend = useCallback(async (msg: PromptInputMessage) => {
    if (!msg.text.trim() || chatLoading || isGenerating) return;

    if (settings.useEnhancer === false) {
      const isVideo = settings.type === "t2v" || settings.type === "i2v";
      const defaultModel = MODELS[settings.type]?.[0]?.id || "";
      
      const finalPrompt = settings.type === "t2i"
        ? assembleFluxPrompt(msg.text, settings)
        : msg.text;

      onGenerate(finalPrompt, {
        ...settings,
        model: settings.model ?? defaultModel,
        duration: isVideo ? (settings.duration ?? 5) : undefined,
        fps: isVideo ? (settings.fps ?? 25) : undefined,
      });
      return;
    }

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
          hasSelectedImage: !!selectedAsset && selectedAsset.type === "image",
          selectedAssetPrompt: selectedAsset?.prompt || undefined,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "Failed to communicate with AI Creative Director");
        throw new Error(errText);
      }

      // Check if server classified the request into a different mode/API
      let activeType = settings.type;
      const detectedType = res.headers.get("x-detected-type");
      if (detectedType && detectedType !== settings.type) {
        console.log(`[AI Panel] Classification type override: ${detectedType}`);
        activeType = detectedType as GenType;
        handleTypeChange(activeType);
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
        let jsonPart = accumulatedText.substring(triggerIndex + "[TRIGGER_GENERATION]".length).trim();
        
        // Robust JSON extraction: locate the outermost curly braces
        const firstBrace = jsonPart.indexOf("{");
        const lastBrace = jsonPart.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonPart = jsonPart.substring(firstBrace, lastBrace + 1);
        }

        try {
          const parsed = JSON.parse(jsonPart);
          
          const finalPrompt = typeof parsed.enhancedPrompt === "object"
            ? JSON.stringify(parsed.enhancedPrompt)
            : String(parsed.enhancedPrompt || "");

          console.log("AI Director triggered generation with enhanced prompt:", finalPrompt);
          
          const defaultModel = MODELS[activeType]?.[0]?.id || "";
          const isVideo = activeType === "t2v" || activeType === "i2v";

          onGenerate(finalPrompt, {
            ...settings,
            type: activeType,
            model: parsed.model ?? defaultModel,
            steps: parsed.steps ?? settings.steps,
            guidance: parsed.guidance ?? settings.guidance,
            width: parsed.width ?? (isVideo ? 768 : 1024),
            height: parsed.height ?? (isVideo ? 512 : 1024),
            duration: isVideo ? (parsed.duration ?? 5) : undefined,
            fps: isVideo ? (parsed.fps ?? 25) : undefined,
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
  }, [messages, settings, onGenerate, chatLoading, isGenerating, selectedAsset, handleTypeChange]);

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

              {/* AI Enhancer Switch */}
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 bg-card/25">
                <div className="space-y-0.5">
                  <Label className="text-[10px] font-semibold text-foreground uppercase tracking-wider">AI Prompt Enhancer</Label>
                  <p className="text-[9px] text-muted-foreground font-light">Automatically refine prompts using LLM</p>
                </div>
                <Switch
                  checked={settings.useEnhancer !== false}
                  onCheckedChange={(checked) => {
                    setSettings((s) => ({ ...s, useEnhancer: checked }));
                  }}
                />
              </div>

              {settings.useEnhancer !== false ? (
                /* LLM Enhancer Model Select */
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
              ) : (
                /* Direct Prompt Card */
                <div className="space-y-2 border border-primary/20 rounded-lg p-3 bg-primary/5">
                  <Label className="text-[10px] font-semibold text-primary uppercase tracking-wider">Direct Prompt Generation</Label>
                  <Textarea
                    placeholder="Enter your prompt (bypasses AI enhancement)..."
                    value={directPrompt}
                    onChange={(e) => setDirectPrompt(e.target.value)}
                    className="min-h-[70px] text-xs resize-none bg-background/50 border-border/60 focus-visible:ring-1 focus-visible:ring-primary/40"
                  />
                  <Button
                    onClick={handleDirectGenerate}
                    disabled={!directPrompt.trim() || isGenerating}
                    className="w-full text-xs h-8 gap-1.5"
                  >
                    <SparklesIcon className="size-3.5" />
                    Generate Directly
                  </Button>
                </div>
              )}

              {/* SECTION: Source Image Selector */}
              {(settings.type === "i2i" || settings.type === "i2v") && (
                <>
                  <Separator className="bg-border/60" />
                  <Collapsible defaultOpen className="space-y-2 animate-in fade-in duration-200">
                    <CollapsibleTrigger className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-full hover:text-foreground">
                      <span>Source Image Selection</span>
                      <ChevronRightIcon className="size-3.5 transition-transform data-[state=open]:rotate-90" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 pt-1.5">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground font-medium">Select Image to Edit</Label>
                        <Select
                          value={selectedAsset?.id || ""}
                          onValueChange={(val) => {
                            if (onSelectAsset) {
                              onSelectAsset(val);
                            }
                          }}
                        >
                          <SelectTrigger className="h-9 text-xs bg-background/50 border-border/60">
                            <SelectValue placeholder="Choose from library..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableAssets && availableAssets.length > 0 ? (
                              availableAssets.map((asset) => (
                                <SelectItem key={asset.id} value={asset.id}>
                                  <div className="flex items-center gap-2 py-0.5">
                                    {asset.url && (
                                      <img
                                        src={asset.url}
                                        alt={asset.name}
                                        className="size-5 rounded object-cover border border-border/60"
                                      />
                                    )}
                                    <span className="font-semibold text-[11px] truncate max-w-[150px]">{asset.name}</span>
                                  </div>
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="none" disabled>
                                No source images in Workspace
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Display Selected Image Preview Card */}
                      {selectedAsset ? (
                        <div className="flex items-center gap-2.5 p-2 rounded-lg border border-primary/20 bg-primary/5">
                          {selectedAsset.url && (
                            <img
                              src={selectedAsset.url}
                              alt={selectedAsset.name}
                              className="size-10 rounded object-cover border border-primary/30"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-semibold text-foreground truncate">{selectedAsset.name}</div>
                            <div className="text-[9px] text-muted-foreground truncate">{selectedAsset.model || "Imported"}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 text-center text-[10px] text-destructive border border-destructive/20 bg-destructive/5 rounded-lg">
                          ⚠️ No source image selected. Select one to enable editing.
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </>
              )}

              {settings.type === "t2i" && (
                <>
                  <Separator className="bg-border/60" />
                  {/* SECTION: Style Presets */}
                  <Collapsible defaultOpen className="space-y-2 animate-in fade-in duration-200">
                    <CollapsibleTrigger className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-full hover:text-foreground">
                      <span>Style Preset</span>
                      <ChevronRightIcon className="size-3.5 transition-transform data-[state=open]:rotate-90" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 pt-1.5">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground font-medium">Select Preset Style</Label>
                        <Select
                          value={settings.presetStyle || "none"}
                          onValueChange={(val) => {
                            const preset = STYLE_PRESETS.find((p) => p.id === val);
                            if (preset) {
                              setSettings((s) => {
                                const nextSettings = { ...s, presetStyle: val };
                                if (preset.parameters.steps !== undefined) {
                                  nextSettings.steps = preset.parameters.steps;
                                }
                                if (preset.parameters.guidance !== undefined) {
                                  nextSettings.guidance = preset.parameters.guidance;
                                }
                                if (preset.parameters.detailLevel !== undefined) {
                                  nextSettings.detailLevel = preset.parameters.detailLevel;
                                }
                                if (preset.parameters.realism !== undefined) {
                                  nextSettings.realism = preset.parameters.realism;
                                }
                                if (preset.parameters.sampler !== undefined) {
                                  nextSettings.sampler = preset.parameters.sampler;
                                }
                                return nextSettings;
                              });
                            }
                          }}
                        >
                          <SelectTrigger className="h-9 text-xs bg-background/50 border-border/60">
                            <SelectValue placeholder="Select style preset" />
                          </SelectTrigger>
                          <SelectContent>
                            {STYLE_PRESETS.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                <div className="flex flex-col items-start py-0.5">
                                  <span className="font-semibold text-[11px]">{p.name}</span>
                                  <span className="text-[9px] text-muted-foreground/80 leading-normal">{p.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </>
              )}

              <Separator className="bg-border/60" />

              {/* SECTION: Prompts & Text Context */}
              <Collapsible defaultOpen className="space-y-2">
                <CollapsibleTrigger className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-full hover:text-foreground">
                  <span>Prompting & Context</span>
                  <ChevronRightIcon className="size-3.5 transition-transform data-[state=open]:rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-1.5">
                  {/* Prompt (Hidden if Enhancer is active since user uses chat) */}
                  {settings.useEnhancer === false && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground font-medium">Core Generation Prompt</Label>
                      <Textarea
                        placeholder="Describe your subject and scene..."
                        value={directPrompt}
                        onChange={(e) => {
                          setDirectPrompt(e.target.value);
                          setSettings((s) => ({ ...s, prompt: e.target.value }));
                        }}
                        className="min-h-[60px] text-xs resize-none bg-background/50 border-border/60 focus-visible:ring-1 focus-visible:ring-primary/40"
                      />
                    </div>
                  )}

                  {/* Negative Prompt */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] text-muted-foreground font-medium">Negative Prompt</Label>
                      <span className="text-[9px] text-muted-foreground/60 italic">Avoid elements</span>
                    </div>
                    <Textarea
                      placeholder="e.g. text, watermark, blurry, extra limbs..."
                      value={settings.negativePrompt || ""}
                      onChange={(e) => setSettings((s) => ({ ...s, negativePrompt: e.target.value }))}
                      className="min-h-[45px] text-xs resize-none bg-background/50 border-border/60 focus-visible:ring-1 focus-visible:ring-primary/40"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator className="bg-border/60" />

              {/* SECTION: Composition & Dimensions */}
              <Collapsible defaultOpen className="space-y-2">
                <CollapsibleTrigger className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-full hover:text-foreground">
                  <span>Composition & Format</span>
                  <ChevronRightIcon className="size-3.5 transition-transform data-[state=open]:rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3.5 pt-1.5">
                  {/* Aspect Ratio - Not typically customized for i2i since it follows input size */}
                  {settings.type !== "i2i" && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground font-medium">Aspect Ratio</Label>
                      <Select
                        value={settings.aspectRatio || "Auto"}
                        onValueChange={(val) => {
                          setSettings((s) => {
                            const { width, height } = calculateDimensions(s.type, val, s.resolution || "Auto");
                            return { ...s, aspectRatio: val as any, width, height };
                          });
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background/50 border-border/60">
                          <SelectValue placeholder="Select ratio" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Auto">Auto (Default)</SelectItem>
                          <SelectItem value="1:1">1:1 Square</SelectItem>
                          <SelectItem value="16:9">16:9 Landscape</SelectItem>
                          <SelectItem value="9:16">9:16 Portrait</SelectItem>
                          <SelectItem value="3:2">3:2 Cinematic</SelectItem>
                          <SelectItem value="4:5">4:5 Portrait</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Resolution */}
                  {settings.type !== "i2i" && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground font-medium">Target Resolution</Label>
                      <Select
                        value={settings.resolution || "Auto"}
                        onValueChange={(val) => {
                          setSettings((s) => {
                            const { width, height } = calculateDimensions(s.type, s.aspectRatio || "Auto", val);
                            return { ...s, resolution: val as any, width, height };
                          });
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background/50 border-border/60">
                          <SelectValue placeholder="Select resolution" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Auto">Auto (Default)</SelectItem>
                          <SelectItem value="HD">HD Quality</SelectItem>
                          <SelectItem value="2K">2K Resolution</SelectItem>
                          <SelectItem value="4K">4K Ultra HD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Duration - Video only */}
                  {(settings.type === "t2v" || settings.type === "i2v") && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <Label className="text-muted-foreground">Video Duration</Label>
                        <span className="font-mono text-[11px] text-foreground">{settings.duration || 5}s</span>
                      </div>
                      <Slider
                        min={1}
                        max={30}
                        step={1}
                        value={[settings.duration || 5]}
                        onValueChange={([val]) => setSettings((s) => ({ ...s, duration: val }))}
                      />
                    </div>
                  )}

                  {/* FPS - Video only */}
                  {(settings.type === "t2v" || settings.type === "i2v") && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground font-medium">Frames Per Second (FPS)</Label>
                      <Select
                        value={String(settings.fps || 25)}
                        onValueChange={(val) => {
                          setSettings((s) => ({ ...s, fps: Number(val) }));
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background/50 border-border/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="24">24 FPS (Cinematic)</SelectItem>
                          <SelectItem value="25">25 FPS (PAL Standard)</SelectItem>
                          <SelectItem value="30">30 FPS (NTSC Standard)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              <Separator className="bg-border/60" />

              {/* SECTION: Model Performance */}
              <Collapsible defaultOpen className="space-y-2">
                <CollapsibleTrigger className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-full hover:text-foreground">
                  <span>Neural Model Settings</span>
                  <ChevronRightIcon className="size-3.5 transition-transform data-[state=open]:rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3.5 pt-1.5">
                  {/* Quality Level */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground font-medium">Quality Level</Label>
                    <Select
                      value={settings.qualityLevel || "Standard"}
                      onValueChange={(val) => {
                        setSettings((s) => {
                          if (s.type === "i2i") {
                            const qwenMap = {
                              Draft: { steps: 10, guidance: 2, autoRefine: false, refinementPasses: 2 },
                              Standard: { steps: 20, guidance: 3, autoRefine: true, refinementPasses: 2 },
                              High: { steps: 30, guidance: 4, autoRefine: true, refinementPasses: 2 },
                              Ultra: { steps: 40, guidance: 4, autoRefine: true, refinementPasses: 3 },
                            };
                            const params = qwenMap[val as keyof typeof qwenMap] || {};
                            return {
                              ...s,
                              qualityLevel: val as any,
                              ...params,
                            };
                          }
                          const stepsMap = { Draft: 16, Standard: 24, High: 30, Ultra: 36 };
                          const nextSteps = stepsMap[val as keyof typeof stepsMap] || s.steps;
                          const { width, height } = calculateDimensions(s.type, s.aspectRatio || "Auto", s.resolution || "Auto", val);
                          return {
                            ...s,
                            qualityLevel: val as any,
                            steps: nextSteps,
                            width,
                            height,
                          };
                        });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background/50 border-border/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Draft">Draft (Fastest)</SelectItem>
                        <SelectItem value="Standard">Standard (Balanced)</SelectItem>
                        <SelectItem value="High">High Quality</SelectItem>
                        <SelectItem value="Ultra">Ultra Details</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Turbo Mode Toggle */}
                  <div className="flex items-center justify-between p-2 rounded-lg border border-border/40 bg-card/15">
                    <div className="space-y-0.5">
                      <Label className="text-[11px] text-foreground font-medium">Turbo Mode</Label>
                      <p className="text-[9px] text-muted-foreground">Lightning-fast generation steps</p>
                    </div>
                    <Switch
                      checked={settings.turboMode !== false}
                      onCheckedChange={(checked) => {
                        setSettings((s) => ({ ...s, turboMode: checked }));
                      }}
                    />
                  </div>

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
                </CollapsibleContent>
              </Collapsible>

              {settings.type !== "i2i" && (
                <>
                  <Separator className="bg-border/60" />

                  {/* SECTION: Aesthetic & Camera Styles */}
                  <Collapsible defaultOpen={false} className="space-y-2">
                    <CollapsibleTrigger className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-full hover:text-foreground">
                      <span>Aesthetics & Style</span>
                      <ChevronRightIcon className="size-3.5 transition-transform data-[state=open]:rotate-90" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3.5 pt-1.5">
                      {/* Lighting Style */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground font-medium">Lighting Style</Label>
                        <Select
                          value={settings.lightingStyle || "Auto"}
                          onValueChange={(val) => {
                            setSettings((s) => ({ ...s, lightingStyle: val as any }));
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background/50 border-border/60">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Auto">Auto Lighting</SelectItem>
                            <SelectItem value="Natural">Natural Light</SelectItem>
                            <SelectItem value="Studio">Studio Portra</SelectItem>
                            <SelectItem value="Cinematic">Cinematic Mood</SelectItem>
                            <SelectItem value="Golden Hour">Golden Hour Glow</SelectItem>
                            <SelectItem value="Dramatic">Dramatic Contrast</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Camera Type */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground font-medium">Camera Lens Type</Label>
                        <Select
                          value={settings.cameraType || "Auto"}
                          onValueChange={(val) => {
                            setSettings((s) => ({ ...s, cameraType: val as any }));
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background/50 border-border/60">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Auto">Auto Detection</SelectItem>
                            <SelectItem value="Smartphone">Smartphone Cam</SelectItem>
                            <SelectItem value="DSLR">Professional DSLR</SelectItem>
                            <SelectItem value="Cinema">Cinema Grade</SelectItem>
                            <SelectItem value="Macro">Macro Detail</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Color Style */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground font-medium">Color Palette Style</Label>
                        <Select
                          value={settings.colorStyle || "Natural"}
                          onValueChange={(val) => {
                            setSettings((s) => ({ ...s, colorStyle: val as any }));
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background/50 border-border/60">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Natural">Natural Palette</SelectItem>
                            <SelectItem value="Vibrant">Vibrant & Pop</SelectItem>
                            <SelectItem value="Muted">Muted Earthy</SelectItem>
                            <SelectItem value="Filmic">Filmic Grading</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Style Strength */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <Label className="text-muted-foreground">Style Influence Strength</Label>
                          <span className="font-mono text-[11px] text-foreground">{settings.styleStrength}%</span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[settings.styleStrength ?? 50]}
                          onValueChange={([val]) => setSettings((s) => ({ ...s, styleStrength: val }))}
                        />
                      </div>

                      {/* Prompt Enhancement */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <Label className="text-muted-foreground">Prompt Enhancement Weight</Label>
                          <span className="font-mono text-[11px] text-foreground">{settings.promptEnhancement}%</span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[settings.promptEnhancement ?? 50]}
                          onValueChange={([val]) => setSettings((s) => ({ ...s, promptEnhancement: val }))}
                        />
                      </div>

                      {/* Creativity / Denoise influence */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <Label className="text-muted-foreground">Creativity Index</Label>
                          <span className="font-mono text-[11px] text-foreground">{settings.creativity}%</span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[settings.creativity ?? 50]}
                          onValueChange={([val]) => setSettings((s) => ({ ...s, creativity: val }))}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator className="bg-border/60" />

                  {/* SECTION: Image Details & Realism */}
                  <Collapsible defaultOpen={false} className="space-y-2">
                    <CollapsibleTrigger className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-full hover:text-foreground">
                      <span>Details & Realism</span>
                      <ChevronRightIcon className="size-3.5 transition-transform data-[state=open]:rotate-90" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3.5 pt-1.5">
                      {/* Detail Level */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <Label className="text-muted-foreground">Detail Level</Label>
                          <span className="font-mono text-[11px] text-foreground">{settings.detailLevel}%</span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[settings.detailLevel ?? 50]}
                          onValueChange={([val]) => setSettings((s) => ({ ...s, detailLevel: val }))}
                        />
                      </div>

                      {/* Face Detail */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <Label className="text-muted-foreground">Face Restoration / Detail</Label>
                          <span className="font-mono text-[11px] text-foreground">{settings.faceDetail}%</span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[settings.faceDetail ?? 50]}
                          onValueChange={([val]) => setSettings((s) => ({ ...s, faceDetail: val }))}
                        />
                      </div>

                      {/* Sharpness */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <Label className="text-muted-foreground">Sharpness & Focus</Label>
                          <span className="font-mono text-[11px] text-foreground">{settings.sharpness}%</span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[settings.sharpness ?? 50]}
                          onValueChange={([val]) => setSettings((s) => ({ ...s, sharpness: val }))}
                        />
                      </div>

                      {/* Realism */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <Label className="text-muted-foreground">Photographic Realism</Label>
                          <span className="font-mono text-[11px] text-foreground">{settings.realism}%</span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[settings.realism ?? 50]}
                          onValueChange={([val]) => setSettings((s) => ({ ...s, realism: val }))}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </>
              )}

              {settings.type === "i2i" && (
                <>
                  <Separator className="bg-border/60" />

                  {/* QWEN SECTION: Edit Controls */}
                  <Collapsible defaultOpen className="space-y-2">
                    <CollapsibleTrigger className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-full hover:text-foreground">
                      <span>Edit Controls</span>
                      <ChevronRightIcon className="size-3.5 transition-transform data-[state=open]:rotate-90" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3.5 pt-1.5">
                      {/* Edit Type */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground font-medium">Edit Type / Mode</Label>
                        <Select
                          value={settings.editType || "auto"}
                          onValueChange={(val) => {
                            setSettings((s) => ({ ...s, editType: val as any }));
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background/50 border-border/60">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto (Detect)</SelectItem>
                            <SelectItem value="text_edit">Text Edit</SelectItem>
                            <SelectItem value="object_add">Add Object</SelectItem>
                            <SelectItem value="object_remove">Remove Object</SelectItem>
                            <SelectItem value="object_replace">Replace Object</SelectItem>
                            <SelectItem value="background_change">Change Background</SelectItem>
                            <SelectItem value="style_transfer">Style Transfer</SelectItem>
                            <SelectItem value="face_edit">Face Edit</SelectItem>
                            <SelectItem value="product_edit">Product Edit</SelectItem>
                            <SelectItem value="poster_edit">Poster Edit</SelectItem>
                            <SelectItem value="logo_edit">Logo Edit</SelectItem>
                            <SelectItem value="rotation">3D Rotation</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Edit Strength */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <Label className="text-muted-foreground font-medium">Edit Strength</Label>
                          <span className="font-mono text-[11px] text-foreground">{settings.editStrength}%</span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[settings.editStrength ?? 50]}
                          onValueChange={([val]) => setSettings((s) => ({ ...s, editStrength: val }))}
                        />
                      </div>

                      {/* Preservation Mode */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground font-medium">Preservation Mode</Label>
                        <Select
                          value={settings.preservationMode || "balanced"}
                          onValueChange={(val) => {
                            setSettings((s) => ({ ...s, preservationMode: val as any }));
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background/50 border-border/60">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="strict">Strict (Keep Original)</SelectItem>
                            <SelectItem value="balanced">Balanced (Recommended)</SelectItem>
                            <SelectItem value="creative">Creative (More Freedom)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator className="bg-border/60" />

                  {/* QWEN SECTION: Preservation Locks */}
                  <Collapsible defaultOpen={false} className="space-y-2">
                    <CollapsibleTrigger className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-full hover:text-foreground">
                      <span>Preservation Locks</span>
                      <ChevronRightIcon className="size-3.5 transition-transform data-[state=open]:rotate-90" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3.5 pt-1.5">
                      {/* Identity Lock */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <Label className="text-muted-foreground">Identity Lock</Label>
                          <span className="font-mono text-[11px] text-foreground">{settings.identityLock}%</span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[settings.identityLock ?? 80]}
                          onValueChange={([val]) => setSettings((s) => ({ ...s, identityLock: val }))}
                        />
                      </div>

                      {/* Face Preservation */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <Label className="text-muted-foreground">Face Preservation</Label>
                          <span className="font-mono text-[11px] text-foreground">{settings.facePreservation}%</span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[settings.facePreservation ?? 80]}
                          onValueChange={([val]) => setSettings((s) => ({ ...s, facePreservation: val }))}
                        />
                      </div>

                      {/* Background Lock */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <Label className="text-muted-foreground">Background Lock</Label>
                          <span className="font-mono text-[11px] text-foreground">{settings.backgroundLock}%</span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[settings.backgroundLock ?? 70]}
                          onValueChange={([val]) => setSettings((s) => ({ ...s, backgroundLock: val }))}
                        />
                      </div>

                      {/* Object Lock */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <Label className="text-muted-foreground">Object Lock</Label>
                          <span className="font-mono text-[11px] text-foreground">{settings.objectLock}%</span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[settings.objectLock ?? 70]}
                          onValueChange={([val]) => setSettings((s) => ({ ...s, objectLock: val }))}
                        />
                      </div>

                      {/* Scene Consistency */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <Label className="text-muted-foreground">Scene Consistency</Label>
                          <span className="font-mono text-[11px] text-foreground">{settings.sceneConsistency}%</span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[settings.sceneConsistency ?? 90]}
                          onValueChange={([val]) => setSettings((s) => ({ ...s, sceneConsistency: val }))}
                        />
                      </div>

                      {/* Composition Lock */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <Label className="text-muted-foreground">Composition Lock</Label>
                          <span className="font-mono text-[11px] text-foreground">{settings.compositionLock}%</span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[settings.compositionLock ?? 80]}
                          onValueChange={([val]) => setSettings((s) => ({ ...s, compositionLock: val }))}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator className="bg-border/60" />

                  {/* QWEN SECTION: Typography Controls */}
                  <Collapsible defaultOpen={false} className="space-y-2">
                    <CollapsibleTrigger className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-full hover:text-foreground">
                      <span>Typography Controls</span>
                      <ChevronRightIcon className="size-3.5 transition-transform data-[state=open]:rotate-90" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3.5 pt-1.5">
                      {/* Text Mode */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground font-medium">Text Edit Mode</Label>
                        <Select
                          value={settings.textMode || "auto"}
                          onValueChange={(val) => {
                            setSettings((s) => ({ ...s, textMode: val as any }));
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background/50 border-border/60">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto</SelectItem>
                            <SelectItem value="add">Add Text</SelectItem>
                            <SelectItem value="replace">Replace Text</SelectItem>
                            <SelectItem value="remove">Remove Text</SelectItem>
                            <SelectItem value="preserve">Preserve Original Text</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Typography Quality */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground font-medium">Typography Quality</Label>
                        <Select
                          value={settings.typographyQuality || "maximum"}
                          onValueChange={(val) => {
                            setSettings((s) => ({ ...s, typographyQuality: val as any }));
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background/50 border-border/60">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="high">High Quality</SelectItem>
                            <SelectItem value="maximum">Maximum Precision</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Font Preservation */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <Label className="text-muted-foreground">Font Style Preservation</Label>
                          <span className="font-mono text-[11px] text-foreground">{settings.fontPreservation}%</span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[settings.fontPreservation ?? 90]}
                          onValueChange={([val]) => setSettings((s) => ({ ...s, fontPreservation: val }))}
                        />
                      </div>

                      {/* Text Accuracy */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <Label className="text-muted-foreground">Text Accuracy</Label>
                          <span className="font-mono text-[11px] text-foreground">{settings.textAccuracy}%</span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[settings.textAccuracy ?? 100]}
                          onValueChange={([val]) => setSettings((s) => ({ ...s, textAccuracy: val }))}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator className="bg-border/60" />

                  {/* QWEN SECTION: Aesthetics & Style */}
                  <Collapsible defaultOpen={false} className="space-y-2">
                    <CollapsibleTrigger className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-full hover:text-foreground">
                      <span>Aesthetics & Style</span>
                      <ChevronRightIcon className="size-3.5 transition-transform data-[state=open]:rotate-90" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3.5 pt-1.5">
                      {/* Style */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground font-medium">Selected Style</Label>
                        <Select
                          value={settings.style || "auto"}
                          onValueChange={(val) => {
                            setSettings((s) => ({ ...s, style: val as any }));
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background/50 border-border/60">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto Style</SelectItem>
                            <SelectItem value="photorealistic">Photorealistic</SelectItem>
                            <SelectItem value="cinematic">Cinematic</SelectItem>
                            <SelectItem value="editorial">Editorial Photography</SelectItem>
                            <SelectItem value="product">Product Photography</SelectItem>
                            <SelectItem value="luxury">Luxury / Fine Art</SelectItem>
                            <SelectItem value="anime">Anime / Manga</SelectItem>
                            <SelectItem value="ghibli">Ghibli Style</SelectItem>
                            <SelectItem value="watercolor">Watercolor</SelectItem>
                            <SelectItem value="oil_painting">Oil Painting</SelectItem>
                            <SelectItem value="comic">Comic Book</SelectItem>
                            <SelectItem value="3d_render">3D Render</SelectItem>
                            <SelectItem value="pixel_art">Pixel Art</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Style Strength */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <Label className="text-muted-foreground">Style Strength</Label>
                          <span className="font-mono text-[11px] text-foreground">{settings.styleStrength}%</span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[settings.styleStrength ?? 50]}
                          onValueChange={([val]) => setSettings((s) => ({ ...s, styleStrength: val }))}
                        />
                      </div>

                      {/* Realism */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <Label className="text-muted-foreground">Realism Level</Label>
                          <span className="font-mono text-[11px] text-foreground">{settings.realism}%</span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[settings.realism ?? 80]}
                          onValueChange={([val]) => setSettings((s) => ({ ...s, realism: val }))}
                        />
                      </div>

                      {/* Creativity */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <Label className="text-muted-foreground">Creativity Level</Label>
                          <span className="font-mono text-[11px] text-foreground">{settings.creativity}%</span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[settings.creativity ?? 50]}
                          onValueChange={([val]) => setSettings((s) => ({ ...s, creativity: val }))}
                        />
                      </div>

                      {/* Detail Level */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <Label className="text-muted-foreground">Detail Level</Label>
                          <span className="font-mono text-[11px] text-foreground">{settings.detailLevel}%</span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[settings.detailLevel ?? 80]}
                          onValueChange={([val]) => setSettings((s) => ({ ...s, detailLevel: val }))}
                        />
                      </div>

                      {/* Camera Style */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground font-medium">Camera Style</Label>
                        <Select
                          value={settings.cameraStyle || "auto"}
                          onValueChange={(val) => {
                            setSettings((s) => ({ ...s, cameraStyle: val as any }));
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background/50 border-border/60">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto Camera</SelectItem>
                            <SelectItem value="portrait">Portrait Close-up</SelectItem>
                            <SelectItem value="cinematic">Cinematic Wide</SelectItem>
                            <SelectItem value="studio">Studio Lighting Focal</SelectItem>
                            <SelectItem value="fashion">Fashion Editorial</SelectItem>
                            <SelectItem value="product">Product Macro</SelectItem>
                            <SelectItem value="macro">Extreme Macro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Lighting Style */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground font-medium">Lighting Style</Label>
                        <Select
                          value={settings.lightingStyle || "Auto"}
                          onValueChange={(val) => {
                            setSettings((s) => ({ ...s, lightingStyle: val as any }));
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background/50 border-border/60">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Auto">Auto Lighting</SelectItem>
                            <SelectItem value="Natural">Natural Diffused</SelectItem>
                            <SelectItem value="soft">Soft Softbox</SelectItem>
                            <SelectItem value="hard">Hard Contrast / Spotlight</SelectItem>
                            <SelectItem value="studio">Studio Three-Point</SelectItem>
                            <SelectItem value="golden_hour">Golden Hour Glow</SelectItem>
                            <SelectItem value="dramatic">Dramatic Chiaroscuro</SelectItem>
                            <SelectItem value="cinematic">Cinematic Practical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator className="bg-border/60" />

                  {/* QWEN SECTION: Precision & Refinement */}
                  <Collapsible defaultOpen className="space-y-2">
                    <CollapsibleTrigger className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-full hover:text-foreground">
                      <span>Precision & Refinement</span>
                      <ChevronRightIcon className="size-3.5 transition-transform data-[state=open]:rotate-90" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3.5 pt-1.5">
                      {/* Precision */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground font-medium">Localization Precision</Label>
                        <Select
                          value={settings.precisionMode || "high"}
                          onValueChange={(val) => {
                            setSettings((s) => ({ ...s, precisionMode: val as any }));
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background/50 border-border/60">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low Precision (Faster)</SelectItem>
                            <SelectItem value="medium">Medium Precision</SelectItem>
                            <SelectItem value="high">High Precision</SelectItem>
                            <SelectItem value="pixel_perfect">Pixel Perfect Alignment</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Auto Refine */}
                      <div className="flex items-center justify-between p-2 rounded-lg border border-border/40 bg-card/15">
                        <div className="space-y-0.5">
                          <Label className="text-[11px] text-foreground font-medium">Auto Refine Passes</Label>
                          <p className="text-[9px] text-muted-foreground">Applies automatic detailing passes</p>
                        </div>
                        <Switch
                          checked={settings.autoRefine !== false}
                          onCheckedChange={(checked) => {
                            setSettings((s) => ({ ...s, autoRefine: checked }));
                          }}
                        />
                      </div>

                      {/* Refinement Passes */}
                      {settings.autoRefine !== false && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <Label className="text-muted-foreground">Refinement Passes</Label>
                            <span className="font-mono text-[11px] text-foreground">{settings.refinementPasses ?? 2}</span>
                          </div>
                          <Slider
                            min={1}
                            max={5}
                            step={1}
                            value={[settings.refinementPasses ?? 2]}
                            onValueChange={([val]) => setSettings((s) => ({ ...s, refinementPasses: val }))}
                          />
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </>
              )}

              <Separator className="bg-border/60" />

              {/* SECTION: Post-processing & Upscale */}
              <Collapsible defaultOpen={false} className="space-y-2">
                <CollapsibleTrigger className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-full hover:text-foreground">
                  <span>Upscaling & Post-Process</span>
                  <ChevronRightIcon className="size-3.5 transition-transform data-[state=open]:rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3.5 pt-1.5">
                  {/* Upscale Output Switch */}
                  <div className="flex items-center justify-between p-2 rounded-lg border border-border/40 bg-card/15">
                    <div className="space-y-0.5">
                      <Label className="text-[11px] text-foreground font-medium">Upscale Output</Label>
                      <p className="text-[9px] text-muted-foreground">Enables super-resolution output</p>
                    </div>
                    <Switch
                      checked={settings.upscaleOutput === true}
                      onCheckedChange={(checked) => {
                        setSettings((s) => ({ ...s, upscaleOutput: checked }));
                      }}
                    />
                  </div>

                  {/* Upscale Factor */}
                  {settings.upscaleOutput && (
                    <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                      <Label className="text-[11px] text-muted-foreground font-medium">Upscale Scale Factor</Label>
                      <Select
                        value={settings.upscaleFactor || "2x"}
                        onValueChange={(val) => {
                          setSettings((s) => ({ ...s, upscaleFactor: val as any }));
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background/50 border-border/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1x">1x (Denoise & Refine)</SelectItem>
                          <SelectItem value="2x">2x Standard Super-Res</SelectItem>
                          <SelectItem value="4x">4x Ultra-Resolution</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
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
              placeholder={settings.useEnhancer !== false ? "Describe what you want to generate..." : "Direct Prompt: Enter prompt to generate directly..."}
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
