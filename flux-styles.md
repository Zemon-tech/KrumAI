# FLUX.2 Style System Specification

## Objective

Create a style engine for FLUX.2 image generation models.

The engine must:

1. Select an appropriate style preset based on user intent.
2. Inject style-specific prompt instructions.
3. Adjust generation parameters.
4. Preserve the user's original subject and intent.
5. Optimize image quality, realism, composition, typography, and visual consistency.

---

# Global Rules

## Follow FLUX.2 Prompting Principles

Use structured prompting:

```text
[SUBJECT]

[LOCATION]

[STYLE]

[CAMERA]

[LIGHTING]

[COLORS]

[EFFECTS]

[ADDITIONAL DETAILS]
```

Avoid prompt stuffing.

Do NOT inject:

```text
masterpiece
best quality
8k
award winning
trending on artstation
ultra detailed
insane quality
```

These terms provide little value for FLUX.2.

---

# Shared Quality Injection

Append this to every generation.

```text
Professional composition.
Realistic lighting and shadows.
Physically accurate materials.
Clean depth separation.
Premium color grading.
Strong visual hierarchy.
High clarity.
Natural texture detail.
Commercial production quality.

If text appears in the image:
ensure perfect spelling,
high readability,
professional typography,
clean alignment,
visual balance.
```

---

# Style Presets

---

## STYLE_PHOTOREALISTIC

### Use Cases

* portraits
* people
* lifestyle
* travel
* realism

### Prompt Injection

```text
Style: High-end commercial photography.

Shot on Hasselblad X2D.
80mm lens.
f/2.8 aperture.

Natural realistic lighting.
Authentic skin textures.
Premium commercial photography.
Shallow depth of field.
Accurate colors.
```

### Parameters

```json
{
  "steps": 28,
  "guidance": 3.5,
  "sampler": "dpmpp_2m",
  "detail": 85,
  "realism": 100
}
```

---

## STYLE_CINEMATIC

### Use Cases

* movie scenes
* storytelling
* action
* drama

### Prompt Injection

```text
Style: Cinematic film still.

Shot using anamorphic cinema lenses.

Dramatic practical lighting.
Volumetric atmosphere.
Film-quality contrast.
Natural lens characteristics.
Visual storytelling.
```

### Parameters

```json
{
  "steps": 30,
  "guidance": 4,
  "sampler": "dpmpp_sde",
  "detail": 90,
  "realism": 90
}
```

---

## STYLE_PRODUCT

### Use Cases

* ecommerce
* advertisements
* product showcases

### Prompt Injection

```text
Style: Premium luxury product photography.

Professional studio lighting.
Clean reflections.
Perfect edge definition.
Commercial advertising quality.
Minimal distractions.
```

### Parameters

```json
{
  "steps": 32,
  "guidance": 4.5,
  "sampler": "dpmpp_2m",
  "detail": 100,
  "realism": 95
}
```

---

## STYLE_SOCIAL_MEDIA

### Use Cases

* instagram posts
* youtube thumbnails
* marketing graphics

### Prompt Injection

```text
Style: Modern social media design.

Strong visual hierarchy.
Bold focal point.
Clear communication.
High engagement design.
Professional layout.
```

### Parameters

```json
{
  "steps": 24,
  "guidance": 4,
  "sampler": "euler",
  "detail": 80,
  "realism": 75
}
```

---

## STYLE_TYPOGRAPHY

### Use Cases

* posters
* advertisements
* quote graphics
* banners

### Prompt Injection

```text
Style: Professional graphic design.

Typography is the primary focus.

All text must be:
perfectly spelled,
fully readable,
professionally typeset,
well aligned,
high contrast,
visually balanced.
```

### Parameters

```json
{
  "steps": 32,
  "guidance": 5,
  "sampler": "dpmpp_2m",
  "detail": 95,
  "text_quality": 100
}
```

---

## STYLE_EDITORIAL

### Use Cases

* magazine covers
* fashion
* luxury brands

### Prompt Injection

```text
Style: Luxury editorial photography.

Fashion magazine quality.
Premium composition.
Elegant posing.
Sophisticated lighting.
Luxury color grading.
```

### Parameters

```json
{
  "steps": 30,
  "guidance": 4,
  "sampler": "dpmpp_sde",
  "detail": 95,
  "realism": 90
}
```

---

## STYLE_CONCEPT_ART

### Use Cases

* fantasy
* sci-fi
* game assets
* environments

### Prompt Injection

```text
Style: AAA concept art.

Large-scale visual design.
Rich environmental storytelling.
Epic composition.
Advanced atmosphere.
High-detail worldbuilding.
```

### Parameters

```json
{
  "steps": 35,
  "guidance": 4.5,
  "sampler": "dpmpp_sde",
  "detail": 100,
  "realism": 70
}
```

---

# Automatic Camera Selection

The system should choose a camera style automatically.

## Portrait

```text
85mm lens
f/2.8
```

## Product

```text
100mm macro lens
f/8
```

## Landscape

```text
24mm lens
f/11
```

## Editorial

```text
50mm lens
f/2.8
```

## Cinematic

```text
Anamorphic cinema lens
```

---

# Automatic Lighting Selection

## Portrait

```text
Soft diffused natural light
```

## Luxury Product

```text
Controlled studio lighting
```

## Cinematic

```text
Practical cinematic lighting
```

## Nature

```text
Golden hour lighting
```

## Architecture

```text
Balanced daylight illumination
```

---

# Automatic Color Palettes

## Luxury

```text
Black
Gold
Champagne
```

## Technology

```text
Blue
Silver
White
```

## Nature

```text
Green
Brown
Amber
```

## Cinematic

```text
Teal
Orange
```

## Editorial

```text
Neutral premium tones
```

---

# Quality Modes

## Draft

```json
{
  "steps": 16,
  "resolution_multiplier": 1.0
}
```

## Standard

```json
{
  "steps": 24,
  "resolution_multiplier": 1.0
}
```

## High

```json
{
  "steps": 30,
  "resolution_multiplier": 1.25
}
```

## Ultra

```json
{
  "steps": 36,
  "resolution_multiplier": 1.5
}
```

---

# Text Rendering Rules

If the prompt contains text:

1. Wrap exact text in quotation marks.
2. Describe placement.
3. Describe typography style.
4. Make text the first priority.

Example:

```text
The text "OPEN NOW" appears above the storefront
in bold red neon typography.

The text must be perfectly readable,
correctly spelled,
and visually dominant.
```

---

# Final Prompt Assembly

Build prompts in this order:

```text
USER SUBJECT

LOCATION

SELECTED STYLE

CAMERA SETTINGS

LIGHTING

COLOR PALETTE

VISUAL EFFECTS

ADDITIONAL DETAILS

GLOBAL QUALITY INJECTION
```

Never replace the user's subject.

Only enhance and structure it.
