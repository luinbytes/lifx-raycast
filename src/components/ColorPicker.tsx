import { Form, ActionPanel, Action, showToast, Toast, popToRoot } from "@raycast/api";
import { useState } from "react";
import { LIFXLight } from "../lib/types";
import { LIFXClientManager } from "../lib/lifx-client";

interface Props {
  light: LIFXLight;
  client: LIFXClientManager;
  onComplete: () => void;
}

const COLOR_PRESETS = [
  { hue: 0, saturation: 100, label: "Red", icon: "🔴" },
  { hue: 30, saturation: 100, label: "Orange", icon: "🟠" },
  { hue: 60, saturation: 100, label: "Yellow", icon: "🟡" },
  { hue: 120, saturation: 100, label: "Green", icon: "🟢" },
  { hue: 180, saturation: 100, label: "Cyan", icon: "🩵" },
  { hue: 240, saturation: 100, label: "Blue", icon: "🔵" },
  { hue: 280, saturation: 100, label: "Purple", icon: "🟣" },
  { hue: 300, saturation: 100, label: "Magenta", icon: "🩷" },
  { hue: 0, saturation: 50, label: "Pink", icon: "💗" },
];

export function ColorPicker({ light, client, onComplete }: Props) {
  const [selectedColor, setSelectedColor] = useState("0");

  async function handleSubmit() {
    const preset = COLOR_PRESETS[parseInt(selectedColor)];

    try {
      await client.controlLight(light.id, {
        hue: preset.hue,
        saturation: preset.saturation,
        // Don't pass brightness - let the client preserve current state
      });
      showToast({ style: Toast.Style.Success, title: `Set ${light.label} to ${preset.label}` });
      onComplete();
      popToRoot();
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to set color",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Set Color" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="color" title="Color" value={selectedColor} onChange={setSelectedColor}>
        {COLOR_PRESETS.map((preset, index) => (
          <Form.Dropdown.Item
            key={index}
            value={index.toString()}
            title={`${preset.icon} ${preset.label}`}
          />
        ))}
      </Form.Dropdown>
      <Form.Description text={`Current: ${light.hue}° hue, ${light.saturation}% saturation at ${light.brightness}% brightness`} />
    </Form>
  );
}
