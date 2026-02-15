import { LIFXLight, LightProfile } from "./lib/types";

export interface LightPreset {
  id: string;
  name: string;
  description: string;
  icon: "game-controller" | "text" | "focus" | "film" | "moon";
  category: "Gaming" | "Reading" | "Focus" | "Movie" | "Chill";
  lights: Array<{
    power: boolean;
    brightness: number;
    hue?: number;
    saturation?: number;
    kelvin?: number;
  }>;
}

/**
 * Built-in lighting presets for common scenarios
 */
export const BUILT_IN_PRESETS: LightPreset[] = [
  {
    id: "gaming-mode",
    name: "Gaming Mode",
    description: "Blue/cool white at 100% brightness for gaming",
    icon: "game-controller",
    category: "Gaming",
    lights: [
      {
        power: true,
        brightness: 100,
        hue: 220, // Blue
        saturation: 100,
      },
    ],
  },
  {
    id: "reading-mode",
    name: "Reading Mode",
    description: "Warm white at 80% brightness for comfortable reading",
    icon: "text",
    category: "Reading",
    lights: [
      {
        power: true,
        brightness: 80,
        kelvin: 4000, // Neutral white
      },
    ],
  },
  {
    id: "focus-mode",
    name: "Focus Mode",
    description: "Bright white at 90% brightness for concentration",
    icon: "focus",
    category: "Focus",
    lights: [
      {
        power: true,
        brightness: 90,
        kelvin: 5000, // Cool daylight
      },
    ],
  },
  {
    id: "movie-mode",
    name: "Movie Mode",
    description: "Warm dim at 20% brightness for cinema experience",
    icon: "film",
    category: "Movie",
    lights: [
      {
        power: true,
        brightness: 20,
        kelvin: 2700, // Warm
      },
    ],
  },
  {
    id: "night-mode",
    name: "Night Mode",
    description: "Warm red at 10% brightness for nighttime",
    icon: "moon",
    category: "Chill",
    lights: [
      {
        power: true,
        brightness: 10,
        hue: 0, // Red
        saturation: 80,
      },
    ],
  },
  {
    id: "relax-mode",
    name: "Relax Mode",
    description: "Soft warm glow at 40% brightness",
    icon: "moon",
    category: "Chill",
    lights: [
      {
        power: true,
        brightness: 40,
        kelvin: 3000, // Warm white
      },
    ],
  },
  {
    id: "work-mode",
    name: "Work Mode",
    description: "Bright neutral white at 85% brightness",
    icon: "focus",
    category: "Focus",
    lights: [
      {
        power: true,
        brightness: 85,
        kelvin: 4500, // Neutral
      },
    ],
  },
];

/**
 * Apply a preset to a list of lights
 */
export function applyPresetToLights(preset: LightPreset, lights: LIFXLight[]): Promise<void> {
  // For each light in the preset
  for (const presetLight of preset.lights) {
    // Apply to all lights (or could be mapped to specific lights)
    for (const light of lights) {
      if (presetLight.power !== undefined) {
        light.setPower(presetLight.power);
      }
      if (presetLight.brightness !== undefined) {
        light.setBrightness(presetLight.brightness);
      }
      if (presetLight.hue !== undefined) {
        light.setColor(presetLight.hue, presetLight.saturation || 0);
      }
      if (presetLight.kelvin !== undefined) {
        light.setTemperature(presetLight.kelvin);
      }
    }
  }
}

/**
 * Convert preset to profile format for saving
 */
export function presetToProfile(preset: LightPreset, lights: LIFXLight[]): LightProfile {
  return {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    tags: ["preset", preset.category.toLowerCase()],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lights: lights.map((light) => ({
      lightId: light.id,
      lightLabel: light.label || light.id,
      power: preset.lights[0]?.power || false,
      brightness: preset.lights[0]?.brightness || 0,
      hue: preset.lights[0]?.hue || 0,
      saturation: preset.lights[0]?.saturation || 0,
      kelvin: preset.lights[0]?.kelvin || 3500,
    })),
  };
}

/**
 * Get preset by ID
 */
export function getPresetById(id: string): LightPreset | undefined {
  return BUILT_IN_PRESETS.find((preset) => preset.id === id);
}

/**
 * Get presets by category
 */
export function getPresetsByCategory(category: LightPreset["category"]): LightPreset[] {
  return BUILT_IN_PRESETS.filter((preset) => preset.category === category);
}

/**
 * Search presets by name
 */
export function searchPresets(query: string): LightPreset[] {
  const lowerQuery = query.toLowerCase();
  return BUILT_IN_PRESETS.filter(
    (preset) =>
      preset.name.toLowerCase().includes(lowerQuery) ||
      preset.description.toLowerCase().includes(lowerQuery) ||
      preset.category.toLowerCase().includes(lowerQuery),
  );
}

/**
 * Get all preset categories
 */
export function getPresetCategories(): LightPreset["category"][] {
  const categories = new Set<LightPreset["category"]>();
  for (const preset of BUILT_IN_PRESETS) {
    categories.add(preset.category);
  }
  return Array.from(categories).sort();
}
