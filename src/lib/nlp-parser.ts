import { LightProfile } from "./types";

export interface ParsedCommand {
  type: "power" | "color" | "brightness" | "profile" | "scene" | "temperature" | "compound" | "unknown";
  action?: string;
  value?: number;
  color?: { hue: number; saturation: number };
  temperature?: number;
  profileName?: string;
  lightSelector?: "all" | "specific" | "first";
  confidence: number;
  originalText: string;
  subCommands?: ParsedCommand[];
}

// Color mappings for common colors
const COLOR_MAP: Record<string, { hue: number; saturation: number }> = {
  red: { hue: 0, saturation: 100 },
  orange: { hue: 30, saturation: 100 },
  yellow: { hue: 60, saturation: 100 },
  lime: { hue: 90, saturation: 100 },
  green: { hue: 120, saturation: 100 },
  cyan: { hue: 180, saturation: 100 },
  blue: { hue: 240, saturation: 100 },
  purple: { hue: 270, saturation: 100 },
  violet: { hue: 270, saturation: 100 },
  magenta: { hue: 300, saturation: 100 },
  pink: { hue: 330, saturation: 100 },
  white: { hue: 0, saturation: 0 },
  warm: { hue: 30, saturation: 20 },
  cool: { hue: 200, saturation: 20 },
  turquoise: { hue: 180, saturation: 80 },
  teal: { hue: 180, saturation: 60 },
  indigo: { hue: 260, saturation: 100 },
  lavender: { hue: 270, saturation: 40 },
  peach: { hue: 20, saturation: 70 },
  coral: { hue: 15, saturation: 80 },
};

// Brightness keywords and their values
const BRIGHTNESS_KEYWORDS: Record<string, number> = {
  max: 100,
  maximum: 100,
  full: 100,
  bright: 100,
  high: 80,
  medium: 50,
  mid: 50,
  low: 25,
  dim: 25,
  minimal: 10,
  off: 0,
};

// Temperature keywords (in Kelvin)
const TEMPERATURE_KEYWORDS: Record<string, number> = {
  warm: 2700,
  "warm white": 2700,
  neutral: 4000,
  "neutral white": 4000,
  cool: 5500,
  "cool white": 5500,
  daylight: 6500,
  "bright white": 6500,
};

export class NaturalLanguageParser {
  /**
   * Parse natural language input into a structured command
   */
  parse(input: string, availableProfiles: LightProfile[] = []): ParsedCommand {
    const normalized = input.toLowerCase().trim();

    // Check for compound commands (e.g., "set to red and dim it")
    const compoundCommand = this.parseCompoundCommand(normalized, availableProfiles);
    if (compoundCommand.confidence > 0.7) return { ...compoundCommand, originalText: input };

    // Try to parse each command type in order of specificity
    const powerCommand = this.parsePowerCommand(normalized);
    if (powerCommand.confidence > 0.7) return { ...powerCommand, originalText: input };

    const profileCommand = this.parseProfileCommand(normalized, availableProfiles);
    if (profileCommand.confidence > 0.7) return { ...profileCommand, originalText: input };

    const colorCommand = this.parseColorCommand(normalized);
    if (colorCommand.confidence > 0.6) return { ...colorCommand, originalText: input };

    const temperatureCommand = this.parseTemperatureCommand(normalized);
    if (temperatureCommand.confidence > 0.6) return { ...temperatureCommand, originalText: input };

    const brightnessCommand = this.parseBrightnessCommand(normalized);
    if (brightnessCommand.confidence > 0.6) return { ...brightnessCommand, originalText: input };

    // Unknown command
    return {
      type: "unknown",
      confidence: 0,
      originalText: input,
    };
  }

  private parseCompoundCommand(input: string, profiles: LightProfile[]): ParsedCommand {
    // Split on common conjunctions
    const parts = input.split(/\s+(?:and|then|,)\s+/i);

    if (parts.length > 1) {
      const subCommands: ParsedCommand[] = [];
      let lowestConfidence = 1.0;
      let lightSelector: "all" | "specific" | "first" = "first";

      for (const part of parts) {
        const cmd = this.parseSingleCommand(part.trim(), profiles);
        if (cmd.type !== "unknown") {
          subCommands.push(cmd);
          lowestConfidence = Math.min(lowestConfidence, cmd.confidence);
          if (cmd.lightSelector === "all") lightSelector = "all";
        }
      }

      if (subCommands.length > 1) {
        return {
          type: "compound",
          subCommands,
          lightSelector,
          confidence: lowestConfidence * 0.9, // Slight penalty for compound commands
          originalText: input,
        };
      }
    }

    return { type: "unknown", confidence: 0, originalText: input };
  }

  private parseSingleCommand(input: string, profiles: LightProfile[]): ParsedCommand {
    const powerCmd = this.parsePowerCommand(input);
    if (powerCmd.confidence > 0.7) return powerCmd;

    const colorCmd = this.parseColorCommand(input);
    if (colorCmd.confidence > 0.6) return colorCmd;

    const brightnessCmd = this.parseBrightnessCommand(input);
    if (brightnessCmd.confidence > 0.6) return brightnessCmd;

    const temperatureCmd = this.parseTemperatureCommand(input);
    if (temperatureCmd.confidence > 0.6) return temperatureCmd;

    return { type: "unknown", confidence: 0, originalText: input };
  }

  private parsePowerCommand(input: string): ParsedCommand {
    const onPatterns = [
      /^(?:turn|switch)\s+(?:on|the lights? on)/i,
      /^(?:lights?|all)\s+on$/i,
      /^on$/i,
      /^power\s+on/i,
      /^enable/i,
    ];

    const offPatterns = [
      /^(?:turn|switch)\s+(?:off|the lights? off)/i,
      /^(?:lights?|all)\s+off$/i,
      /^off$/i,
      /^power\s+off/i,
      /^disable/i,
      /^shut\s+(?:off|down)/i,
    ];

    for (const pattern of onPatterns) {
      if (pattern.test(input)) {
        return {
          type: "power",
          action: "on",
          lightSelector: input.includes("all") ? "all" : "first",
          confidence: 0.95,
          originalText: input,
        };
      }
    }

    for (const pattern of offPatterns) {
      if (pattern.test(input)) {
        return {
          type: "power",
          action: "off",
          lightSelector: input.includes("all") ? "all" : "first",
          confidence: 0.95,
          originalText: input,
        };
      }
    }

    return { type: "unknown", confidence: 0, originalText: input };
  }

  private parseColorCommand(input: string): ParsedCommand {
    // Look for color keywords
    for (const [colorName, colorValue] of Object.entries(COLOR_MAP)) {
      const colorPatterns = [
        new RegExp(`(?:set|change|make|turn)\\s+(?:it|the light[s]?)?\\s*(?:to)?\\s*${colorName}`, "i"),
        new RegExp(`^${colorName}$`, "i"),
        new RegExp(`${colorName}\\s+(?:color|light)`, "i"),
        new RegExp(`(?:go|switch to)\\s+${colorName}`, "i"),
        new RegExp(`make\\s+(?:it|them)?\\s*${colorName}`, "i"),
      ];

      for (const pattern of colorPatterns) {
        if (pattern.test(input)) {
          return {
            type: "color",
            color: colorValue,
            lightSelector: input.includes("all") ? "all" : "first",
            confidence: 0.9,
            originalText: input,
          };
        }
      }
    }

    return { type: "unknown", confidence: 0, originalText: input };
  }

  private parseBrightnessCommand(input: string): ParsedCommand {
    // Check for percentage values
    const percentMatch = input.match(/(\d+)\s*%/);
    if (percentMatch) {
      const value = parseInt(percentMatch[1]);
      if (value >= 0 && value <= 100) {
        return {
          type: "brightness",
          value,
          lightSelector: input.includes("all") ? "all" : "first",
          confidence: 0.95,
          originalText: input,
        };
      }
    }

    // Check for brightness keywords
    for (const [keyword, value] of Object.entries(BRIGHTNESS_KEYWORDS)) {
      const patterns = [
        new RegExp(`(?:set|make|turn)\\s+(?:it|the light[s]?|them)?\\s*(?:to)?\\s*${keyword}`, "i"),
        new RegExp(`^${keyword}$`, "i"),
        new RegExp(`${keyword}\\s+brightness`, "i"),
        new RegExp(`(?:go|switch to)\\s+${keyword}`, "i"),
      ];

      for (const pattern of patterns) {
        if (pattern.test(input)) {
          return {
            type: "brightness",
            value,
            lightSelector: input.includes("all") ? "all" : "first",
            confidence: 0.85,
            originalText: input,
          };
        }
      }
    }

    // Relative brightness changes
    const dimPatterns = [
      /dim(?:\s+(?:it|the light[s]?|them))?(?:\s+a\s+(?:bit|little))?/i,
      /darker/i,
      /lower(?:\s+(?:the\s+)?brightness)?/i,
      /turn\s+down/i,
    ];

    const brightenPatterns = [
      /bright(?:en)?(?:\s+(?:it|the light[s]?|them))?(?:\s+a\s+(?:bit|little))?/i,
      /lighter/i,
      /raise(?:\s+(?:the\s+)?brightness)?/i,
      /turn\s+up/i,
      /increase/i,
    ];

    for (const pattern of dimPatterns) {
      if (pattern.test(input)) {
        const adjustment = input.includes("a bit") || input.includes("a little") || input.includes("little") ? -15 : -25;
        return {
          type: "brightness",
          value: adjustment,
          action: "adjust",
          lightSelector: input.includes("all") ? "all" : "first",
          confidence: 0.8,
          originalText: input,
        };
      }
    }

    for (const pattern of brightenPatterns) {
      if (pattern.test(input)) {
        const adjustment = input.includes("a bit") || input.includes("a little") || input.includes("little") ? 15 : 25;
        return {
          type: "brightness",
          value: adjustment,
          action: "adjust",
          lightSelector: input.includes("all") ? "all" : "first",
          confidence: 0.8,
          originalText: input,
        };
      }
    }

    return { type: "unknown", confidence: 0, originalText: input };
  }

  private parseTemperatureCommand(input: string): ParsedCommand {
    for (const [keyword, kelvin] of Object.entries(TEMPERATURE_KEYWORDS)) {
      const patterns = [
        new RegExp(`(?:set|change|make)\\s+(?:to)?\\s*${keyword}`, "i"),
        new RegExp(`^${keyword}$`, "i"),
      ];

      for (const pattern of patterns) {
        if (pattern.test(input)) {
          return {
            type: "temperature",
            temperature: kelvin,
            lightSelector: input.includes("all") ? "all" : "first",
            confidence: 0.85,
            originalText: input,
          };
        }
      }
    }

    // Check for Kelvin values
    const kelvinMatch = input.match(/(\d{4,5})\s*k(?:elvin)?/i);
    if (kelvinMatch) {
      const kelvin = parseInt(kelvinMatch[1]);
      if (kelvin >= 2500 && kelvin <= 9000) {
        return {
          type: "temperature",
          temperature: kelvin,
          lightSelector: input.includes("all") ? "all" : "first",
          confidence: 0.9,
          originalText: input,
        };
      }
    }

    return { type: "unknown", confidence: 0, originalText: input };
  }

  private parseProfileCommand(input: string, profiles: LightProfile[]): ParsedCommand {
    // Look for profile-related keywords
    const profilePatterns = [
      /(?:set|load|apply|use)(?:\s+to)?(?:\s+my)?(?:\s+the)?\s+(.+?)\s+profile/i,
      /profile\s+(.+)/i,
      /(?:set|load|apply|use)(?:\s+to)?(?:\s+my)?\s+(.+?)(?:\s+scene)?$/i,
      /(?:switch to|go to)(?:\s+my)?\s+(.+)/i,
    ];

    for (const pattern of profilePatterns) {
      const match = input.match(pattern);
      if (match) {
        const profileNameQuery = match[1].trim().toLowerCase();

        // Find matching profile (with fuzzy matching)
        const matchedProfile = profiles.find((p) => {
          const profileNameLower = p.name.toLowerCase();
          const nameMatch =
            profileNameLower.includes(profileNameQuery) ||
            profileNameQuery.includes(profileNameLower) ||
            this.fuzzyMatch(profileNameLower, profileNameQuery);

          // Also check tags
          const tagMatch = p.tags?.some((tag) => tag.toLowerCase() === profileNameQuery);

          return nameMatch || tagMatch;
        });

        if (matchedProfile) {
          return {
            type: "profile",
            profileName: matchedProfile.name,
            lightSelector: "all",
            confidence: 0.95,
            originalText: input,
          };
        } else {
          // Profile keyword found but no matching profile
          return {
            type: "profile",
            profileName: profileNameQuery,
            lightSelector: "all",
            confidence: 0.5,
            originalText: input,
          };
        }
      }
    }

    return { type: "unknown", confidence: 0, originalText: input };
  }

  /**
   * Simple fuzzy matching for profile names
   */
  private fuzzyMatch(str1: string, str2: string): boolean {
    // Remove common words and check if one contains most of the other
    const removeCommon = (s: string) =>
      s.replace(/\b(the|my|a|an|to|for|and|or|of|in|on|at)\b/gi, "").trim();

    const cleaned1 = removeCommon(str1);
    const cleaned2 = removeCommon(str2);

    if (cleaned1.includes(cleaned2) || cleaned2.includes(cleaned1)) {
      return true;
    }

    // Check if they share significant portions
    const words1 = cleaned1.split(/\s+/);
    const words2 = cleaned2.split(/\s+/);

    const sharedWords = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));

    return sharedWords.length >= Math.min(words1.length, words2.length) * 0.6;
  }

  /**
   * Generate a human-readable description of the parsed command
   */
  describeCommand(command: ParsedCommand): string {
    switch (command.type) {
      case "power":
        return `Turn ${command.action === "on" ? "on" : "off"} ${command.lightSelector === "all" ? "all lights" : "light"}`;
      case "color":
        if (command.color) {
          const colorName = Object.entries(COLOR_MAP).find(
            ([_, val]) => val.hue === command.color!.hue && val.saturation === command.color!.saturation
          )?.[0];
          return `Set color to ${colorName || "custom"}`;
        }
        return "Change color";
      case "brightness":
        if (command.action === "adjust") {
          return command.value! > 0 ? `Increase brightness by ${command.value}%` : `Decrease brightness by ${Math.abs(command.value!)}%`;
        }
        return `Set brightness to ${command.value}%`;
      case "temperature":
        return `Set color temperature to ${command.temperature}K`;
      case "profile":
        return `Apply profile: ${command.profileName}`;
      case "compound":
        if (command.subCommands && command.subCommands.length > 0) {
          return command.subCommands.map((cmd) => this.describeCommand(cmd)).join(" + ");
        }
        return "Compound command";
      default:
        return "Unknown command";
    }
  }
}
