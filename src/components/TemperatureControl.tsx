import { Form, ActionPanel, Action, showToast, Toast, popToRoot } from "@raycast/api";
import { useState } from "react";
import { LIFXLight } from "../lib/types";
import { LIFXClientManager } from "../lib/lifx-client";

interface Props {
  light: LIFXLight;
  client: LIFXClientManager;
  onComplete: () => void;
}

const TEMPERATURE_PRESETS = [
  { value: "2500", label: "Ultra Warm (2500K)" },
  { value: "2700", label: "Warm White (2700K)" },
  { value: "3000", label: "Soft White (3000K)" },
  { value: "3500", label: "Neutral (3500K)" },
  { value: "4000", label: "Cool White (4000K)" },
  { value: "5000", label: "Daylight (5000K)" },
  { value: "6500", label: "Cool Daylight (6500K)" },
  { value: "9000", label: "Ultra Cool (9000K)" },
];

export function TemperatureControl({ light, client, onComplete }: Props) {
  const [kelvin, setKelvin] = useState(light.kelvin.toString());

  async function handleSubmit() {
    const kelvinValue = parseInt(kelvin);

    try {
      // Only set kelvin and saturation - brightness will be preserved automatically
      await client.controlLight(light.id, {
        kelvin: kelvinValue,
        saturation: 0,
      });
      showToast({ style: Toast.Style.Success, title: `Set ${light.label} to ${kelvinValue}K` });
      // Wait for bulb to broadcast new state before refreshing UI
      await new Promise(resolve => setTimeout(resolve, 1500));
      onComplete();
      popToRoot();
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to set temperature",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Set Temperature" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="kelvin" title="White Temperature" value={kelvin} onChange={setKelvin}>
        {TEMPERATURE_PRESETS.map((preset) => (
          <Form.Dropdown.Item key={preset.value} value={preset.value} title={preset.label} />
        ))}
      </Form.Dropdown>
      <Form.Description text={`Current: ${light.kelvin}K at ${light.brightness}% brightness`} />
    </Form>
  );
}
