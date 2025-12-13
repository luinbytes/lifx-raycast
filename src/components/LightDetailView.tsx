import { Detail, ActionPanel, Action, Icon, Color, showToast, Toast } from "@raycast/api";
import { LIFXLight } from "../lib/types";
import { LIFXClientManager } from "../lib/lifx-client";
import { BrightnessControl } from "./BrightnessControl";
import { ColorPicker } from "./ColorPicker";
import { TemperatureControl } from "./TemperatureControl";

interface Props {
  light: LIFXLight;
  client: LIFXClientManager;
  onUpdate: () => void;
}

const COLOR_PRESETS = [
  { hue: 0, saturation: 100, brightness: 100, name: "Red", icon: "🔴" },
  { hue: 30, saturation: 100, brightness: 100, name: "Orange", icon: "🟠" },
  { hue: 60, saturation: 100, brightness: 100, name: "Yellow", icon: "🟡" },
  { hue: 120, saturation: 100, brightness: 100, name: "Green", icon: "🟢" },
  { hue: 180, saturation: 100, brightness: 100, name: "Cyan", icon: "🩵" },
  { hue: 240, saturation: 100, brightness: 100, name: "Blue", icon: "🔵" },
  { hue: 280, saturation: 100, brightness: 100, name: "Purple", icon: "🟣" },
  { hue: 300, saturation: 100, brightness: 100, name: "Magenta", icon: "🩷" },
];

const WHITE_PRESETS = [
  { kelvin: 2500, name: "Ultra Warm" },
  { kelvin: 2700, name: "Warm White" },
  { kelvin: 3500, name: "Neutral White" },
  { kelvin: 5000, name: "Daylight" },
  { kelvin: 6500, name: "Cool Daylight" },
];

const BRIGHTNESS_PRESETS = [100, 75, 50, 25, 10, 5, 1];

export function LightDetailView({ light, client, onUpdate }: Props) {
  async function togglePower() {
    try {
      await client.controlLight(light.id, { power: !light.power });
      showToast({
        style: Toast.Style.Success,
        title: `${light.label} ${!light.power ? "on" : "off"}`,
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      onUpdate();
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to toggle power",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function setBrightness(brightness: number) {
    try {
      await client.controlLight(light.id, { brightness });
      showToast({
        style: Toast.Style.Success,
        title: `Set to ${brightness}%`,
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      onUpdate();
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to set brightness",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function setColor(hue: number, saturation: number) {
    try {
      await client.controlLight(light.id, { hue, saturation });
      showToast({
        style: Toast.Style.Success,
        title: "Color updated",
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      onUpdate();
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to set color",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function setTemperature(kelvin: number) {
    try {
      await client.controlLight(light.id, { kelvin, saturation: 0 });
      showToast({
        style: Toast.Style.Success,
        title: `Set to ${kelvin}K`,
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      onUpdate();
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to set temperature",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const getStatusEmoji = () => {
    if (!light.power) return "⚫";
    if (light.saturation > 0) {
      if (light.hue >= 0 && light.hue < 30) return "🔴";
      if (light.hue >= 30 && light.hue < 90) return "🟡";
      if (light.hue >= 90 && light.hue < 150) return "🟢";
      if (light.hue >= 150 && light.hue < 210) return "🔵";
      if (light.hue >= 210 && light.hue < 270) return "🟣";
      if (light.hue >= 270 && light.hue < 330) return "🩷";
      return "🔴";
    }
    return "⚪";
  };

  const markdown = `
# ${getStatusEmoji()} ${light.label}

---

## Current State
${light.power ? "### 🟢 Powered On" : "### 🔴 Powered Off"}

${
  light.saturation > 0
    ? `
**Color Mode**
- Hue: ${light.hue}°
- Saturation: ${light.saturation}%
`
    : `
**White Mode**
- Temperature: ${light.kelvin}K
`
}

**Brightness:** ${light.brightness}%

---

## Connection
- **Type:** ${light.source.toUpperCase()}
- **Status:** ${light.connected ? "✅ Connected" : "❌ Disconnected"}
`;

  return (
    <Detail
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Light Name" text={light.label} icon={Icon.LightBulb} />

          <Detail.Metadata.Separator />

          <Detail.Metadata.Label
            title="Power"
            icon={{ source: Icon.Circle, tintColor: light.power ? Color.Green : Color.Red }}
            text={light.power ? "On" : "Off"}
          />

          <Detail.Metadata.Label title="Brightness" text={`${light.brightness}%`} icon={Icon.Sun} />

          <Detail.Metadata.Separator />

          {light.saturation > 0 ? (
            <>
              <Detail.Metadata.Label title="Mode" text="Color" icon={Icon.Palette} />
              <Detail.Metadata.Label title="Hue" text={`${light.hue}°`} />
              <Detail.Metadata.Label title="Saturation" text={`${light.saturation}%`} />
            </>
          ) : (
            <>
              <Detail.Metadata.Label title="Mode" text="White" icon={Icon.Circle} />
              <Detail.Metadata.Label title="Temperature" text={`${light.kelvin}K`} icon={Icon.Temperature} />
            </>
          )}

          <Detail.Metadata.Separator />

          <Detail.Metadata.TagList title="Connection">
            <Detail.Metadata.TagList.Item
              text={light.source.toUpperCase()}
              color={light.source === "lan" ? Color.Blue : Color.Purple}
            />
            <Detail.Metadata.TagList.Item
              text={light.connected ? "Connected" : "Disconnected"}
              color={light.connected ? Color.Green : Color.Red}
            />
          </Detail.Metadata.TagList>
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section title="Power">
            <Action
              title={light.power ? "Turn Off" : "Turn On"}
              icon={light.power ? Icon.LightBulbOff : Icon.LightBulb}
              onAction={togglePower}
            />
          </ActionPanel.Section>

          <ActionPanel.Section title="Quick Settings">
            <Action.Push
              title="Adjust Brightness"
              icon={Icon.Sun}
              target={<BrightnessControl light={light} client={client} onComplete={onUpdate} />}
              shortcut={{ modifiers: ["cmd"], key: "b" }}
            />
            <Action.Push
              title="Choose Color"
              icon={Icon.Palette}
              target={<ColorPicker light={light} client={client} onComplete={onUpdate} />}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
            <Action.Push
              title="Set White Temperature"
              icon={Icon.Temperature}
              target={<TemperatureControl light={light} client={client} onComplete={onUpdate} />}
              shortcut={{ modifiers: ["cmd"], key: "k" }}
            />
          </ActionPanel.Section>

          <ActionPanel.Section title="Brightness">
            {BRIGHTNESS_PRESETS.map((value) => (
              <Action
                key={value}
                title={`${value}%`}
                icon={Icon.Circle}
                onAction={() => setBrightness(value)}
              />
            ))}
          </ActionPanel.Section>

          <ActionPanel.Section title="Colors">
            {COLOR_PRESETS.map((preset) => (
              <Action
                key={preset.name}
                title={`${preset.icon} ${preset.name}`}
                onAction={() => setColor(preset.hue, preset.saturation)}
              />
            ))}
          </ActionPanel.Section>

          <ActionPanel.Section title="White Temperatures">
            {WHITE_PRESETS.map((preset) => (
              <Action key={preset.kelvin} title={preset.name} onAction={() => setTemperature(preset.kelvin)} />
            ))}
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
