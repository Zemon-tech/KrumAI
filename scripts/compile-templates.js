const fs = require('fs');
const path = require('path');

// Dictionary of known widget names and their positional order for standard ComfyUI nodes
const KNOWN_WIDGETS = {
  'KSampler': ['seed', 'control_after_generate', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise'],
  'KSamplerSelect': ['sampler_name'],
  'VAELoader': ['vae_name'],
  'SaveImage': ['filename_prefix'],
  'CLIPLoader': ['clip_name', 'type', 'device'],
  'UNETLoader': ['unet_name', 'weight_dtype'],
  'LoraLoaderModelOnly': ['lora_name', 'strength_model'],
  'PrimitiveInt': ['value', 'control_after_generate'],
  'PrimitiveFloat': ['value', 'control_after_generate'],
  'PrimitiveBoolean': ['value'],
  'PrimitiveStringMultiline': ['value'],
  'CheckpointLoaderSimple': ['ckpt_name'],
  'CFGNorm': ['strength', 'use_ema'],
  'FluxGuidance': ['guidance'],
  'EmptyFlux2LatentImage': ['width', 'height', 'batch_size'],
  'EmptyLTXVLatentVideo': ['width', 'height', 'length', 'batch_size'],
  'RandomNoise': ['noise_seed', 'control_after_generate'],
  'BasicGuider': [],
  'SamplerCustomAdvanced': [],
  'VAEDecode': [],
  'VAEEncode': [],
  'SaveVideo': ['filename_prefix', 'format', 'codec'],
  'CFGGuider': ['cfg'],
  'ResizeImagesByLongerEdge': ['longer_edge'],
  'LTXVPreprocess': ['img_compression'],
  'ResizeImageMaskNode': ['resize_type', 'resize_type.width', 'resize_type.height', 'resize_type.crop', 'scale_method'],
  'ComfyMathExpression': ['expression'],
  'LTXVImgToVideoInplace': ['strength', 'active'],
  'LTXVCropGuides': [],
  'LTXVConcatAVLatent': [],
  'LTXVSeparateAVLatent': [],
  'LTXVAudioVAELoader': ['ckpt_name'],
  'LTXVAudioVAEDecode': [],
  'LTXVEmptyLatentAudio': ['length', 'sample_rate', 'batch_size'],
  'ManualSigmas': ['sigmas'],
  'CreateVideo': ['fps'],
  'LatentUpscaleModelLoader': ['model_name'],
  'LTXVConditioning': ['steps'],
  'VAEDecodeTiled': ['tile_size', 'overlap', 'temporal_size', 'temporal_overlap'],
  'LTXVLatentUpsampler': [],
  'CLIPTextEncode': ['text'],
  'LoadImage': ['image', 'upload'],
  'ComfySwitchNode': [],
  'Flux2Scheduler': ['steps', 'width', 'height'],
  'ModelSamplingAuraFlow': ['shift'],
  'FluxKontextMultiReferenceLatentMethod': ['method'],
  'TextEncodeQwenImageEditPlus': ['prompt'],
  'FluxKontextImageScale': [],
  'LTXAVTextEncoderLoader': ['text_encoder', 'ckpt_name', 'device'],
  'EmptyImage': ['width', 'height', 'batch_size', 'color'],
  'LoraLoader': ['lora_name', 'strength_model', 'strength_clip'],
  'TextGenerateLTX2Prompt': ['prompt', 'max_length', 'sampling_mode', 'sampling_mode.temperature', 'sampling_mode.top_k', 'sampling_mode.top_p', 'sampling_mode.min_p', 'sampling_mode.repetition_penalty', 'sampling_mode.seed', 'sampling_mode.presence_penalty', 'prompt_enhance', 'active'],
  'PreviewAny': ['value', 'value_1', 'value_2']
};

class CompileContext {
  constructor(wf, subgraphDef = null, prefix = '', parentNode = null, parentContext = null) {
    this.wf = wf;
    this.subgraphDef = subgraphDef;
    this.prefix = prefix;
    this.parentNode = parentNode;
    this.parentContext = parentContext;
    
    this.nodes = subgraphDef ? subgraphDef.nodes : wf.nodes;
    this.links = subgraphDef ? (subgraphDef.links || (subgraphDef.state ? subgraphDef.state.links : [])) : wf.links;
    
    this.linkMap = {};
    if (this.links) {
      this.links.forEach(l => {
        if (Array.isArray(l)) {
          this.linkMap[l[0]] = {
            id: l[0],
            sourceId: l[1],
            sourceSlot: l[2],
            targetId: l[3],
            targetSlot: l[4],
            type: l[5]
          };
        } else if (l && typeof l === 'object') {
          this.linkMap[l.id] = {
            id: l.id,
            sourceId: l.origin_id,
            sourceSlot: l.origin_slot,
            targetId: l.target_id,
            targetSlot: l.target_slot,
            type: l.type
          };
        }
      });
    }
    
    this.nodeMap = {};
    if (this.nodes) {
      this.nodes.forEach(n => {
        this.nodeMap[n.id] = n;
      });
    }
  }
}

function resolveLink(linkId, context, subgraphs) {
  const l = context.linkMap[linkId];
  if (!l) return null;
  
  // If the source node is -10 (subgraph input), it comes from parent context
  if (l.sourceId === -10) {
    if (!context.parentContext || !context.parentNode) return null;
    
    const subInput = context.subgraphDef.inputs.find(inp => inp.linkIds && inp.linkIds.includes(linkId));
    if (!subInput) return null;
    
    // Find matching input in parent node
    const parentInput = context.parentNode.inputs.find(inp => 
      (subInput.name && inp.name === subInput.name) || 
      (subInput.label && inp.label === subInput.label) ||
      (inp.widget && inp.widget.name && inp.widget.name === subInput.name)
    );
    
    if (parentInput && parentInput.link !== null) {
      return resolveLink(parentInput.link, context.parentContext, subgraphs);
    } else {
      // It is a parent widget. Find parent widget value.
      // Check proxyWidgets
      if (context.parentNode.properties && context.parentNode.properties.proxyWidgets) {
        const targetNode = context.nodeMap[l.targetId];
        let targetInputName = '';
        if (targetNode.inputs && targetNode.inputs[l.targetSlot]) {
          targetInputName = targetNode.inputs[l.targetSlot].name;
        }
        
        const proxyIndex = context.parentNode.properties.proxyWidgets.findIndex(pw => 
          String(pw[0]) === String(l.targetId) && pw[1] === targetInputName
        );
        
        if (proxyIndex !== -1 && context.parentNode.widgets_values && context.parentNode.widgets_values[proxyIndex] !== undefined) {
          return { type: 'value', value: context.parentNode.widgets_values[proxyIndex] };
        }
      }
      
      // Fallback to the inner node's own default widget value
      const targetNode = context.nodeMap[l.targetId];
      if (targetNode && KNOWN_WIDGETS[targetNode.type]) {
        let targetInputName = '';
        if (targetNode.inputs && targetNode.inputs[l.targetSlot]) {
          targetInputName = targetNode.inputs[l.targetSlot].name;
        }
        const wIdx = KNOWN_WIDGETS[targetNode.type].indexOf(targetInputName);
        if (wIdx !== -1 && targetNode.widgets_values && targetNode.widgets_values[wIdx] !== undefined) {
          return { type: 'value', value: targetNode.widgets_values[wIdx] };
        }
      }
      
      return null;
    }
  }
  
  const srcNode = context.nodeMap[l.sourceId];
  if (!srcNode) return null;
  
  // If the source is a Reroute node, bypass it
  if (srcNode.type === 'Reroute') {
    if (srcNode.inputs && srcNode.inputs[0] && srcNode.inputs[0].link !== null) {
      return resolveLink(srcNode.inputs[0].link, context, subgraphs);
    }
    return null;
  }
  
  // If the source node is a subgraph instance, trace it to the inner node inside the subgraph
  if (subgraphs[srcNode.type]) {
    const subDef = subgraphs[srcNode.type];
    const subOutput = subDef.outputs[l.sourceSlot];
    if (!subOutput || !subOutput.linkIds || subOutput.linkIds.length === 0) return null;
    
    const subPrefix = context.prefix ? `${context.prefix}_${srcNode.id}` : `${srcNode.id}`;
    const subContext = new CompileContext(context.wf, subDef, subPrefix, srcNode, context);
    
    return resolveLink(subOutput.linkIds[0], subContext, subgraphs);
  }
  
  // Standard connection
  const compiledSourceId = context.prefix ? `${context.prefix}_${l.sourceId}` : `${l.sourceId}`;
  return { type: 'connection', nodeId: compiledSourceId, slot: l.sourceSlot };
}

function compileWorkflow(wf) {
  const subgraphs = {};
  if (wf.definitions && wf.definitions.subgraphs) {
    wf.definitions.subgraphs.forEach(sub => {
      subgraphs[sub.id] = sub;
    });
  }
  
  const apiJson = {};
  const rootContext = new CompileContext(wf);
  
  function compileContext(context) {
    context.nodes.forEach(node => {
      // Skip comments/notes and Reroute
      if (node.type === 'MarkdownNote' || node.type === 'Note' || node.type === 'Reroute' || node.type === 'PreviewAny' && !node.inputs) {
        return;
      }
      
      // Subgraph instance
      if (subgraphs[node.type]) {
        const subDef = subgraphs[node.type];
        const subPrefix = context.prefix ? `${context.prefix}_${node.id}` : `${node.id}`;
        const childContext = new CompileContext(context.wf, subDef, subPrefix, node, context);
        compileContext(childContext);
        return;
      }
      
      // Standard Node
      const compiledId = context.prefix ? `${context.prefix}_${node.id}` : `${node.id}`;
      const classType = node.type;
      const inputs = {};
      
      const widgetNames = KNOWN_WIDGETS[classType] || [];
      
      // 1. Process standard widgets
      widgetNames.forEach((wName, wIdx) => {
        // Find if this widget is exposed as an input
        const inp = node.inputs ? node.inputs.find(i => i.name === wName || (i.widget && i.widget.name === wName)) : null;
        
        if (inp && inp.link !== null) {
          const res = resolveLink(inp.link, context, subgraphs);
          if (res) {
            if (res.type === 'connection') {
              inputs[wName] = [res.nodeId, res.slot];
            } else if (res.type === 'value') {
              inputs[wName] = res.value;
            }
          }
        } else {
          // If the input link is null but it exists, check for parent widget value mapping
          if (inp && context.parentNode && context.parentNode.properties && context.parentNode.properties.proxyWidgets) {
            const proxyIndex = context.parentNode.properties.proxyWidgets.findIndex(pw => 
              String(pw[0]) === String(node.id) && pw[1] === wName
            );
            if (proxyIndex !== -1 && context.parentNode.widgets_values && context.parentNode.widgets_values[proxyIndex] !== undefined) {
              inputs[wName] = context.parentNode.widgets_values[proxyIndex];
              return;
            }
          }
          
          // Fall back to node's own widgets_values
          if (node.widgets_values && node.widgets_values[wIdx] !== undefined) {
            inputs[wName] = node.widgets_values[wIdx];
          }
        }
      });
      
      // 2. Process non-widget inputs
      if (node.inputs) {
        node.inputs.forEach(inp => {
          // Skip if already processed as standard widget
          if (widgetNames.includes(inp.name) || (inp.widget && widgetNames.includes(inp.widget.name))) {
            return;
          }
          
          if (inp.link !== null) {
            const res = resolveLink(inp.link, context, subgraphs);
            if (res) {
              if (res.type === 'connection') {
                inputs[inp.name] = [res.nodeId, res.slot];
              } else if (res.type === 'value') {
                inputs[inp.name] = res.value;
              }
            }
          }
        });
      }
      
      apiJson[compiledId] = {
        class_type: classType,
        inputs: inputs
      };
    });
  }
  
  compileContext(rootContext);
  
  // Sort keys alphabetically/numerically
  const sortedApiJson = {};
  Object.keys(apiJson).sort((a, b) => {
    // Attempt numerical sort if appropriate, otherwise alphabetical
    const aParts = a.split('_').map(Number);
    const bParts = b.split('_').map(Number);
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      if (aParts[i] === undefined) return -1;
      if (bParts[i] === undefined) return 1;
      if (isNaN(aParts[i]) || isNaN(bParts[i])) {
        return a.localeCompare(b);
      }
      if (aParts[i] !== bParts[i]) return aParts[i] - bParts[i];
    }
    return 0;
  }).forEach(key => {
    sortedApiJson[key] = apiJson[key];
  });
  
  return sortedApiJson;
}

// Target and source paths
const sourceConfigs = [
  { wf: 'image_flux2_text_to_image.json', targetWfName: 'image_flux2_text_to_image.json', targetApiName: 'api_flux.json' },
  { wf: 'qwen_image_workflow(1).json', targetWfName: 'qwen_image_workflow.json', targetApiName: 'api_qwen.json' },
  { wf: 'video_ltx2_3_t2v.json', targetWfName: 'video_ltx2_3_t2v.json', targetApiName: 'api_video.json' }
];

const targetDir = path.join(__dirname, '..', 'lib', 'comfy-templates');

// Recreate directory cleanly
if (fs.existsSync(targetDir)) {
  console.log(`Deleting existing comfy-templates directory at: ${targetDir}`);
  fs.rmSync(targetDir, { recursive: true, force: true });
}
fs.mkdirSync(targetDir, { recursive: true });
console.log(`Created new comfy-templates directory at: ${targetDir}`);

sourceConfigs.forEach(config => {
  const wfPath = path.join(__dirname, '..', config.wf);
  if (!fs.existsSync(wfPath)) {
    console.error(`Workflow file not found: ${wfPath}`);
    process.exit(1);
  }
  
  console.log(`Compiling workflow ${config.wf}...`);
  const wfContent = JSON.parse(fs.readFileSync(wfPath, 'utf8'));
  const apiJson = compileWorkflow(wfContent);
  
  // Write API JSON
  const apiPath = path.join(targetDir, config.targetApiName);
  fs.writeFileSync(apiPath, JSON.stringify(apiJson, null, 2) + '\n', 'utf8');
  console.log(`  -> Written API template to ${apiPath}`);
  
  // Copy workflow JSON
  const destWfPath = path.join(targetDir, config.targetWfName);
  fs.writeFileSync(destWfPath, JSON.stringify(wfContent, null, 2) + '\n', 'utf8');
  console.log(`  -> Copied workflow source to ${destWfPath}`);
});

console.log('Template generation completed successfully.');
