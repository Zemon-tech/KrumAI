# Qwen Image Edit System Specification

## Overview

This document defines the complete parameter architecture for a Qwen Image Edit powered image editing system.

The goal is to:

* Provide simple controls for end users.
* Allow AI to intelligently optimize editing quality.
* Leverage Qwen Image Edit's strengths:

  * Appearance Editing
  * Semantic Editing
  * Text Editing
  * Identity Preservation
  * Style Transfer
  * Multi-Pass Refinement
* Hide low-level diffusion parameters from users.

---

# System Architecture

The system consists of:

```text
User Request
      ↓
AI Analysis Layer
      ↓
Editing Strategy Selection
      ↓
Parameter Optimization
      ↓
Prompt Enhancement
      ↓
Qwen Image Edit Workflow
      ↓
Result
```

---

# User Parameters

These parameters are visible and editable by users.

---

## Prompt

### Type

```typescript
string
```

### Description

Natural language editing instruction.

### Examples

```text
Add a coffee cup to the table.

Replace the background with a beach.

Change the text from "SALE" to "50% OFF".
```

---

## Edit Type

### Type

```typescript
enum
```

### Values

```typescript
auto
text_edit
object_add
object_remove
object_replace
background_change
style_transfer
face_edit
product_edit
poster_edit
logo_edit
rotation
```

### Default

```typescript
auto
```

---

## Edit Strength

### Type

```typescript
number
```

### Range

```typescript
0 - 100
```

### Description

Controls how aggressively the image is modified.

### Mapping

```text
0   = Minimal change
50  = Balanced edit
100 = Maximum transformation
```

---

## Preservation Mode

### Type

```typescript
enum
```

### Values

```typescript
strict
balanced
creative
```

### Description

Determines how much of the original image should remain unchanged.

---

## Quality

### Type

```typescript
enum
```

### Values

```typescript
draft
standard
high
ultra
```

---

## Style

### Type

```typescript
enum
```

### Values

```typescript
auto
photorealistic
cinematic
editorial
product
luxury
anime
ghibli
watercolor
oil_painting
comic
3d_render
pixel_art
```

---

## Style Strength

### Type

```typescript
number
```

### Range

```typescript
0 - 100
```

---

## Realism

### Type

```typescript
number
```

### Range

```typescript
0 - 100
```

---

## Creativity

### Type

```typescript
number
```

### Range

```typescript
0 - 100
```

---

## Detail Level

### Type

```typescript
number
```

### Range

```typescript
0 - 100
```

---

## Identity Lock

### Type

```typescript
number
```

### Range

```typescript
0 - 100
```

### Description

Preserves identity consistency for:

* Humans
* Characters
* Mascots
* Avatars

---

## Face Preservation

### Type

```typescript
number
```

### Range

```typescript
0 - 100
```

---

## Background Lock

### Type

```typescript
number
```

### Range

```typescript
0 - 100
```

---

## Object Lock

### Type

```typescript
number
```

### Range

```typescript
0 - 100
```

---

## Scene Consistency

### Type

```typescript
number
```

### Range

```typescript
0 - 100
```

### Description

Preserves:

* reflections
* shadows
* perspective
* lighting
* environmental interactions

---

# Typography Controls

Qwen Image Edit has exceptional text editing capabilities.

---

## Text Mode

### Type

```typescript
enum
```

### Values

```typescript
auto
add
replace
remove
preserve
```

---

## Typography Quality

### Type

```typescript
enum
```

### Values

```typescript
standard
high
maximum
```

---

## Font Preservation

### Type

```typescript
number
```

### Range

```typescript
0 - 100
```

---

## Text Accuracy

### Type

```typescript
number
```

### Range

```typescript
0 - 100
```

---

# Composition Controls

---

## Composition Lock

### Type

```typescript
number
```

### Range

```typescript
0 - 100
```

---

## Camera Style

### Type

```typescript
enum
```

### Values

```typescript
auto
portrait
cinematic
studio
fashion
product
macro
```

---

## Lighting Style

### Type

```typescript
enum
```

### Values

```typescript
auto
natural
soft
hard
studio
golden_hour
dramatic
cinematic
```

---

# Precision Controls

---

## Precision

### Type

```typescript
enum
```

### Values

```typescript
low
medium
high
pixel_perfect
```

### Description

Controls localization precision of edits.

---

## Auto Refine

### Type

```typescript
boolean
```

### Default

```typescript
true
```

---

## Refinement Passes

### Type

```typescript
number
```

### Range

```typescript
1 - 5
```

### Default

```typescript
2
```

---

# Output Controls

---

## Upscale

### Type

```typescript
boolean
```

---

## Upscale Factor

### Type

```typescript
enum
```

### Values

```typescript
1x
2x
4x
```

---

## Output Quality

### Type

```typescript
enum
```

### Values

```typescript
standard
high
ultra
```

---

# AI Controlled Parameters

These parameters are hidden from users.

AI automatically determines them.

---

## Diffusion Parameters

```typescript
steps
cfg
sampler
scheduler
denoise
shift
```

---

## Workflow Parameters

```typescript
latent_method
conditioning_method
guidance_mode
sampling_strategy
```

---

## Prompt Processing

```typescript
prompt_classification
prompt_expansion
prompt_rewriting
prompt_repair
prompt_optimization
```

---

## Editing Strategy

### Values

```typescript
appearance
semantic
hybrid
```

### Description

Appearance Editing:

* localized changes
* preserve surrounding pixels

Semantic Editing:

* style transfer
* character transformation
* object rotation

Hybrid Editing:

* combines both approaches

---

## Semantic Strength

```typescript
0 - 100
```

---

## Appearance Strength

```typescript
0 - 100
```

---

## Reflection Preservation

```typescript
boolean
```

---

## Shadow Preservation

```typescript
boolean
```

---

## Perspective Preservation

```typescript
boolean
```

---

## Identity Protection

```typescript
boolean
```

---

## Face Protection

```typescript
boolean
```

---

## Camera Selection

Automatically choose:

```typescript
24mm
35mm
50mm
85mm
100mm Macro
Anamorphic
```

based on image type.

---

## Lighting Selection

Automatically choose:

```typescript
Natural
Studio
Golden Hour
Cinematic
Rembrandt
Softbox
```

based on image content.

---

## Composition Selection

Automatically choose:

```typescript
Rule of Thirds
Symmetry
Leading Lines
Centered
Negative Space
```

---

# Internal Parameters

These should never be exposed.

```typescript
seed
noise_seed
vae
clip
unet
lora_weights
cfg_norm_strength
ema
device
dtype
memory_mode
batch_size
latent_scaling
```

---

# Quality Mapping

## Draft

```json
{
  "steps": 10,
  "cfg": 2,
  "auto_refine": false
}
```

---

## Standard

```json
{
  "steps": 20,
  "cfg": 3,
  "auto_refine": true
}
```

---

## High

```json
{
  "steps": 30,
  "cfg": 4,
  "auto_refine": true
}
```

---

## Ultra

```json
{
  "steps": 40,
  "cfg": 4,
  "auto_refine": true,
  "refinement_passes": 3
}
```

---

# Recommended Default Configuration

```json
{
  "editType": "auto",
  "editStrength": 50,
  "preservationMode": "balanced",
  "quality": "high",
  "style": "auto",
  "styleStrength": 50,
  "realism": 80,
  "creativity": 50,
  "detailLevel": 80,
  "identityLock": 80,
  "facePreservation": 80,
  "backgroundLock": 70,
  "objectLock": 70,
  "sceneConsistency": 90,
  "textMode": "auto",
  "typographyQuality": "maximum",
  "fontPreservation": 90,
  "textAccuracy": 100,
  "precision": "high",
  "autoRefine": true,
  "refinementPasses": 2,
  "upscale": false,
  "upscaleFactor": "1x"
}
```

---

# Design Principle

The user should control intent.

The AI should control implementation.

Users specify:

* what to change
* how strong the change should be
* how much should be preserved

The AI determines:

* diffusion settings
* prompt optimization
* editing strategy
* preservation strategy
* refinement workflow

This ensures maximum editing quality while keeping the interface simple.
