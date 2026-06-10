// s:\1-Project\zemon\content-pipeline\frontend\lib\comfyGraphParser.ts

export interface ComfyNode {
  class_type: string;
  inputs: Record<string, any>;
  _meta?: {
    title?: string;
    [key: string]: unknown;
  };
}

export type ComfyGraph = Record<string, ComfyNode>;

export const NODE_TARGETS = {
  PROMPT: 'CLIPTextEncode',
  MODEL: 'CheckpointLoaderSimple',
  LATENT_SIZE: 'EmptyLatentImage',
  IMAGE_LOADER: 'LoadImage'
};

export interface ParserOptions {
  prompt?: string;
  negativePrompt?: string;
  modelName?: string;
  width?: number;
  height?: number;
  imageUrl?: string;
  duration?: number;
  frameRate?: number;
  qualityPreset?: "low" | "medium" | "high";
}

/**
 * Searches for nodes in the ComfyUI workflow JSON corresponding to specific class types,
 * and updates their input values dynamically.
 */
export function parseComfyGraph(graph: ComfyGraph, options: ParserOptions): ComfyGraph {
  // Create a deep copy of the graph to avoid mutating the original template
  const parsedGraph: ComfyGraph = JSON.parse(JSON.stringify(graph));

  let clipTextNodeIndex = 0;

  // Check if prompt enhancement is enabled in the graph
  let isEnhanceEnabled = false;
  for (const nodeId in parsedGraph) {
    const node = parsedGraph[nodeId];
    if (node && node.inputs && node.class_type === 'PrimitiveBoolean') {
      const title = node._meta?.title || '';
      if (title.includes('Enable Prompt Enhance') && node.inputs.value === true) {
        isEnhanceEnabled = true;
        break;
      }
    }
  }

  for (const nodeId in parsedGraph) {
    const node = parsedGraph[nodeId];
    if (!node || !node.inputs) continue;

    // 1. Handle CLIPTextEncode (Prompt / Negative Prompt)
    if (node.class_type === NODE_TARGETS.PROMPT) {
      // Typically the first CLIPTextEncode is the positive prompt, the second is negative.
      // We also look for specific template placeholders like ${prompt} or __PROMPT__.
      const currentText = typeof node.inputs.text === 'string' ? node.inputs.text : '';
      
      if (currentText.includes('${prompt}') || currentText.includes('__PROMPT__')) {
        node.inputs.text = currentText
          .replace(/\$\{prompt\}/g, options.prompt || '')
          .replace(/__PROMPT__/g, options.prompt || '');
      } else if (currentText.includes('${negative_prompt}') || currentText.includes('__NEGATIVE_PROMPT__')) {
        node.inputs.text = currentText
          .replace(/\$\{negative_prompt\}/g, options.negativePrompt || 'nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry')
          .replace(/__NEGATIVE_PROMPT__/g, options.negativePrompt || 'nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry');
      } else {
        // Fallback: If no explicit placeholder is found, assign by occurrence
        if (clipTextNodeIndex === 0 && options.prompt) {
          // If prompt enhancement is disabled (or it's already a string), we assign directly
          if (!isEnhanceEnabled || typeof node.inputs.text === 'string') {
            node.inputs.text = options.prompt;
          }
        } else if (clipTextNodeIndex === 1 && options.negativePrompt) {
          if (typeof node.inputs.text === 'string') {
            node.inputs.text = options.negativePrompt;
          }
        }
      }
      clipTextNodeIndex++;
    }

    // 2. Handle Model Loader / Checkpoint Loader Selection (Model Selection)
    if (node.inputs.ckpt_name !== undefined && options.modelName) {
      node.inputs.ckpt_name = options.modelName;
    }

    // 3. Handle EmptyLatentImage (Latent Size)
    if (node.class_type === NODE_TARGETS.LATENT_SIZE) {
      if (options.width) node.inputs.width = options.width;
      if (options.height) node.inputs.height = options.height;
    }

    // 4. Handle LoadImage (Input Image for Image-to-Video or Image-to-Image)
    if (node.class_type === NODE_TARGETS.IMAGE_LOADER && options.imageUrl) {
      node.inputs.image = options.imageUrl;
    }

    // 5. Handle Video Settings (Duration and Frame Rate)
    if (node.class_type === 'PrimitiveInt') {
      const title = (node._meta?.title as string) || '';
      if (title === 'Duration' && options.duration !== undefined) {
        node.inputs.value = options.duration;
      } else if (title === 'Frame Rate' && options.frameRate !== undefined) {
        node.inputs.value = options.frameRate;
      }
    }

    // 6. Handle Quality Step Scheduling (ManualSigmas)
    if (node.class_type === 'ManualSigmas' && options.qualityPreset && typeof node.inputs.sigmas === 'string') {
      const sigmasStr = node.inputs.sigmas;
      if (sigmasStr.startsWith('1.0')) {
        // First stage manual sigmas
        if (options.qualityPreset === 'low') {
          node.inputs.sigmas = "1.0, 0.975, 0.90, 0.70, 0.40, 0.0"; // 5 steps
        } else if (options.qualityPreset === 'medium') {
          node.inputs.sigmas = "1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0"; // 8 steps (default)
        } else if (options.qualityPreset === 'high') {
          node.inputs.sigmas = "1.0, 0.995, 0.99, 0.985, 0.98, 0.97, 0.95, 0.92, 0.88, 0.82, 0.75, 0.65, 0.50, 0.30, 0.0"; // 14 steps
        }
      } else if (sigmasStr.startsWith('0.85')) {
        // Second stage manual sigmas
        if (options.qualityPreset === 'low') {
          node.inputs.sigmas = "0.85, 0.50, 0.0"; // 2 steps
        } else if (options.qualityPreset === 'medium') {
          node.inputs.sigmas = "0.85, 0.7250, 0.4219, 0.0"; // 3 steps (default)
        } else if (options.qualityPreset === 'high') {
          node.inputs.sigmas = "0.85, 0.75, 0.65, 0.50, 0.30, 0.0"; // 5 steps
        }
      }
    }

    // Generic placeholder string replacement across all inputs
    for (const key in node.inputs) {
      const value = node.inputs[key];
      if (typeof value === 'string') {
        let updated = value;
        if (options.prompt) {
          updated = updated.replace(/\$\{prompt\}/g, options.prompt).replace(/__PROMPT__/g, options.prompt);
        }
        if (options.negativePrompt) {
          updated = updated.replace(/\$\{negative_prompt\}/g, options.negativePrompt).replace(/__NEGATIVE_PROMPT__/g, options.negativePrompt);
        }
        if (options.modelName) {
          updated = updated.replace(/\$\{model\}/g, options.modelName).replace(/__MODEL__/g, options.modelName);
        }
        if (options.imageUrl) {
          updated = updated.replace(/\$\{image\}/g, options.imageUrl).replace(/__IMAGE__/g, options.imageUrl);
        }
        node.inputs[key] = updated;
      }
    }
  }

  return parsedGraph;
}
