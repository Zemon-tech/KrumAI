import path from "path";
import fs from "fs";

export interface GenSettings {
  type: string;
  model: string;
  steps: number;
  guidance: number;
  width: number;
  height: number;
  duration?: number; // video duration in seconds (default 5)
  fps?: number;      // video frames per second (default 25)

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

export function parseGraph(
  prompt: string,
  settings: GenSettings,
  inputImageFilename?: string
): Record<string, any> {
  const { type, steps, guidance, width, height, duration, fps } = settings;

  // Resolve template file path
  let templateFileName = "";
  if (type === "t2i") {
    templateFileName = "api_flux.json";
  } else if (type === "i2i") {
    templateFileName = "api_qwen.json";
  } else if (type === "t2v" || type === "i2v") {
    templateFileName = "api_video.json";
  } else {
    throw new Error(`Unsupported generation type: ${type}`);
  }

  const templatePath = path.join(
    process.cwd(),
    "lib",
    "comfy-templates",
    templateFileName
  );

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Workflow template not found: ${templateFileName}`);
  }

  const graph = JSON.parse(fs.readFileSync(templatePath, "utf8"));

  // Helper to get a random seed
  const getRandomSeed = () => Math.floor(Math.random() * 9007199254740991);

  if (type === "t2i") {
    // 1. Prompt Text
    if (graph["98_6"] && graph["98_6"].inputs) {
      graph["98_6"].inputs.text = prompt;
    }

    // 2. Seed
    const seed = getRandomSeed();
    if (graph["98_25"] && graph["98_25"].inputs) {
      graph["98_25"].inputs.noise_seed = seed;
    }

    // 3. Aspect Ratio / Latent Dimensions
    if (graph["98_47"] && graph["98_47"].inputs) {
      graph["98_47"].inputs.width = width;
      graph["98_47"].inputs.height = height;
    }
    if (graph["98_48"] && graph["98_48"].inputs) {
      graph["98_48"].inputs.width = width;
      graph["98_48"].inputs.height = height;
    }

    // 4. Guidance
    if (graph["98_26"] && graph["98_26"].inputs) {
      graph["98_26"].inputs.guidance = guidance;
    }

    // 5. Steps (controlled by turbo mode PrimitiveInt values)
    // We update both normal steps (ID 98_100) and turbo steps (ID 98_99)
    if (graph["98_100"] && graph["98_100"].inputs) {
      graph["98_100"].inputs.value = steps;
    }
    if (graph["98_99"] && graph["98_99"].inputs) {
      graph["98_99"].inputs.value = Math.max(4, Math.floor(steps / 2)); // Turbo steps are usually lower
    }

    // 6. Turbo Mode Toggle
    if (graph["98_104"] && graph["98_104"].inputs) {
      graph["98_104"].inputs.value = !!settings.turboMode;
    }

    // 7. Sampler
    if (settings.sampler && graph["98_16"] && graph["98_16"].inputs) {
      graph["98_16"].inputs.sampler_name = settings.sampler;
    }
  } else if (type === "i2i") {
    // Qwen Image Edit
    // 1. Base Image Filename
    if (inputImageFilename && graph["223"] && graph["223"].inputs) {
      graph["223"].inputs.image = inputImageFilename;
    }

    // 2. Prompt Text
    if (graph["170_151"] && graph["170_151"].inputs) {
      graph["170_151"].inputs.prompt = prompt;
    }

    // 3. Seed
    const seed = getRandomSeed();
    if (graph["170_169"] && graph["170_169"].inputs) {
      graph["170_169"].inputs.seed = seed;
    }

    // 4. Steps
    let resolvedSteps = steps;
    if (settings.qualityLevel) {
      const qwenQualitySteps = { Draft: 10, Standard: 20, High: 30, Ultra: 40 };
      resolvedSteps = qwenQualitySteps[settings.qualityLevel] || steps;
    }
    if (graph["170_166"] && graph["170_166"].inputs) {
      graph["170_166"].inputs.value = resolvedSteps;
    }
    if (graph["170_165"] && graph["170_165"].inputs) {
      graph["170_165"].inputs.value = Math.max(4, Math.floor(resolvedSteps / 10)); // Turbo steps are very low (e.g. 4)
    }

    // 5. CFG / Guidance
    let resolvedGuidance = guidance;
    if (settings.qualityLevel) {
      const qwenQualityCFG = { Draft: 2, Standard: 3, High: 4, Ultra: 4 };
      resolvedGuidance = qwenQualityCFG[settings.qualityLevel] || guidance;
    }
    if (graph["170_154"] && graph["170_154"].inputs) {
      graph["170_154"].inputs.value = resolvedGuidance;
    }

    // 6. Turbo Mode Toggle
    if (graph["170_168"] && graph["170_168"].inputs) {
      graph["170_168"].inputs.value = !!settings.turboMode;
    }

    // 7. Sampler
    if (settings.sampler && graph["170_169"] && graph["170_169"].inputs) {
      graph["170_169"].inputs.sampler_name = settings.sampler;
    }
  } else if (type === "t2v" || type === "i2v") {
    // LTX Video T2V / I2V
    // 1. Prompt Text
    if (graph["267_266"] && graph["267_266"].inputs) {
      graph["267_266"].inputs.value = prompt;
    }

    // 2. Seed
    const seed = getRandomSeed();
    if (graph["267_237"] && graph["267_237"].inputs) {
      graph["267_237"].inputs.noise_seed = seed;
    }

    // 3. Dimensions
    if (graph["267_257"] && graph["267_257"].inputs) {
      graph["267_257"].inputs.value = width;
    }
    if (graph["267_258"] && graph["267_258"].inputs) {
      graph["267_258"].inputs.value = height;
    }

    // 4. Duration (seconds) — e.g. 5, 8, or 10 seconds
    if (duration !== undefined && graph["267_225"] && graph["267_225"].inputs) {
      graph["267_225"].inputs.value = duration;
    }

    // 5. FPS
    if (fps !== undefined && graph["267_260"] && graph["267_260"].inputs) {
      graph["267_260"].inputs.value = fps;
    }

    // 4. If image-to-video, set base image
    if (inputImageFilename && graph["269"] && graph["269"].inputs) {
      graph["269"].inputs.image = inputImageFilename;
      // In LTXV, to make I2V work, we also configure the image inplace node inputs:
      if (graph["267_249"] && graph["267_249"].inputs) {
        graph["267_249"].inputs.active = true;
      }
      if (graph["267_230"] && graph["267_230"].inputs) {
        graph["267_230"].inputs.active = true;
      }
    } else {
      // If text-to-video, ensure inplace conditioning is disabled or set to defaults
      if (graph["267_249"] && graph["267_249"].inputs) {
        graph["267_249"].inputs.active = false;
      }
      if (graph["267_230"] && graph["267_230"].inputs) {
        graph["267_230"].inputs.active = false;
      }
    }
  }

  return graph;
}
