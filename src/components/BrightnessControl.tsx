import { Form, ActionPanel, Action, showToast, Toast, popToRoot } from "@raycast/api";
import { useState } from "react";
import { LIFXLight } from "../lib/types";
import { LIFXClientManager } from "../lib/lifx-client";

interface Props {
  light: LIFXLight;
  client: LIFXClientManager;
  onComplete: () => void;
}

const BRIGHTNESS_PRESETS = [
  { value: "100", label: "100% (Full Brightness)" },
  { value: "75", label: "75% (Bright)" },
  { value: "50", label: "50% (Medium)" },
  { value: "25", label: "25% (Dim)" },
  { value: "10", label: "10% (Very Dim)" },
  { value: "5", label: "5% (Night Light)" },
  { value: "1", label: "1% (Minimal)" },
];

export function BrightnessControl({ light, client, onComplete }: Props) {
  // Find closest preset or default to current brightness as string
  const findClosestPreset = (value: number) => {
    const presetValues = BRIGHTNESS_PRESETS.map(p => parseInt(p.value));
    const closest = presetValues.reduce((prev, curr) =>
      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
    );
    return closest.toString();
  };

  const [brightness, setBrightness] = useState(findClosestPreset(light.brightness));

  async function handleSubmit() {
    const brightnessValue = parseInt(brightness);

    try {
      await client.controlLight(light.id, { brightness: brightnessValue });
      showToast({ style: Toast.Style.Success, title: `Set ${light.label} to ${brightnessValue}%` });
      // Wait for bulb to broadcast new state before refreshing UI
      await new Promise(resolve => setTimeout(resolve, 1500));
      onComplete();
      popToRoot();
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to set brightness",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Set Brightness" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="brightness" title="Brightness" value={brightness} onChange={setBrightness}>
        {BRIGHTNESS_PRESETS.map((preset) => (
          <Form.Dropdown.Item key={preset.value} value={preset.value} title={preset.label} />
        ))}
      </Form.Dropdown>
      <Form.Description text={`Current brightness: ${light.brightness}%`} />
    </Form>
  );
}
