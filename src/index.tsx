import { List, showToast, Toast, ActionPanel, Action, Icon, Color, getPreferenceValues } from "@raycast/api";
import { useEffect, useState } from "react";
import { usePromise } from "@raycast/utils";
import { LIFXClientManager } from "./lib/lifx-client";
import { LIFXLight } from "./lib/types";
import { LightDetailView } from "./components/LightDetailView";
import { BrightnessControl } from "./components/BrightnessControl";
import { ColorPicker } from "./components/ColorPicker";
import { TemperatureControl } from "./components/TemperatureControl";

interface Preferences {
  httpApiToken?: string;
  defaultFadeDuration?: string;
  lanTimeout?: string;
  enableLanDiscovery?: boolean;
}

export default function Command() {
  const [lights, setLights] = useState<LIFXLight[]>([]);
  const [client] = useState(() => new LIFXClientManager());
  const preferences = getPreferenceValues<Preferences>();

  const { isLoading, revalidate } = usePromise(
    async () => {
      await client.initialize();
      const discoveredLights = await client.discoverLights();
      setLights(discoveredLights);

      const state = client.getConnectionState();
      if (discoveredLights.length === 0) {
        showToast({
          style: Toast.Style.Failure,
          title: "No lights discovered",
          message: state.lanAvailable || state.httpAvailable ? "No LIFX lights found" : "Enable LAN or provide API token",
        });
      }

      return discoveredLights;
    },
    [],
    {
      onError: (error) => {
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to discover lights",
          message: error instanceof Error ? error.message : String(error),
        });
      },
    }
  );

  useEffect(() => {
    return () => {
      client.destroy();
    };
  }, []);

  async function refreshLights() {
    try {
      const discoveredLights = await client.discoverLights();
      setLights(discoveredLights);
      showToast({
        style: Toast.Style.Success,
        title: `Refreshed ${discoveredLights.length} light${discoveredLights.length !== 1 ? "s" : ""}`,
      });
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to refresh",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function togglePower(light: LIFXLight) {
    try {
      await client.controlLight(light.id, { power: !light.power });
      showToast({
        style: Toast.Style.Success,
        title: `${light.label} ${!light.power ? "on" : "off"}`,
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await refreshLights();
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to toggle power",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function controlAllLights(action: "on" | "off") {
    try {
      await Promise.all(lights.map((light) => client.controlLight(light.id, { power: action === "on" })));
      showToast({
        style: Toast.Style.Success,
        title: `All lights ${action}`,
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await refreshLights();
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to control all lights",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const getLightIcon = (light: LIFXLight): { source: Icon; tintColor: Color } => {
    if (!light.power) {
      return { source: Icon.LightBulb, tintColor: Color.SecondaryText };
    }

    if (light.saturation > 0) {
      // Color mode - map hue to Raycast colors
      if (light.hue >= 0 && light.hue < 30) return { source: Icon.LightBulbFilled, tintColor: Color.Red };
      if (light.hue >= 30 && light.hue < 90) return { source: Icon.LightBulbFilled, tintColor: Color.Yellow };
      if (light.hue >= 90 && light.hue < 150) return { source: Icon.LightBulbFilled, tintColor: Color.Green };
      if (light.hue >= 150 && light.hue < 210) return { source: Icon.LightBulbFilled, tintColor: Color.Blue };
      if (light.hue >= 210 && light.hue < 270) return { source: Icon.LightBulbFilled, tintColor: Color.Purple };
      if (light.hue >= 270 && light.hue < 330) return { source: Icon.LightBulbFilled, tintColor: Color.Magenta };
      return { source: Icon.LightBulbFilled, tintColor: Color.Red };
    }

    // White mode - use orange for warm white
    return { source: Icon.LightBulbFilled, tintColor: Color.Orange };
  };

  const getLightSubtitle = (light: LIFXLight): string => {
    const parts: string[] = [];

    if (light.saturation > 0) {
      parts.push(`${light.hue}° hue`);
    } else {
      parts.push(`${light.kelvin}K`);
    }

    return parts.join(" • ");
  };

  const getLightAccessories = (light: LIFXLight): List.Item.Accessory[] => {
    const accessories: List.Item.Accessory[] = [];

    // Brightness indicator
    accessories.push({
      text: `${light.brightness}%`,
      icon: Icon.Sun,
    });

    // Power status with colored dot
    accessories.push({
      tag: {
        value: light.power ? "On" : "Off",
        color: light.power ? Color.Green : Color.SecondaryText,
      },
    });

    // Connection type badge
    accessories.push({
      tag: {
        value: light.source.toUpperCase(),
        color: light.source === "lan" ? Color.Blue : Color.Purple,
      },
    });

    return accessories;
  };

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search lights..."
      filtering={true}
    >
      {lights.length === 0 && !isLoading ? (
        <List.EmptyView
          icon={Icon.LightBulb}
          title="No Lights Found"
          description="Make sure your LIFX lights are connected and LAN discovery is enabled"
        />
      ) : (
        <List.Section title="Lights" subtitle={`${lights.length} ${lights.length === 1 ? "light" : "lights"}`}>
          {lights.map((light) => (
            <List.Item
              key={light.id}
              icon={getLightIcon(light)}
              title={light.label}
              subtitle={getLightSubtitle(light)}
              accessories={getLightAccessories(light)}
              actions={
                <ActionPanel>
                  <ActionPanel.Section>
                    <Action.Push
                      title="View Details"
                      icon={Icon.Eye}
                      target={<LightDetailView light={light} client={client} onUpdate={refreshLights} />}
                    />
                    <Action
                      title={light.power ? "Turn Off" : "Turn On"}
                      icon={light.power ? Icon.LightBulbOff : Icon.LightBulb}
                      onAction={() => togglePower(light)}
                    />
                  </ActionPanel.Section>

                  <ActionPanel.Section title="Adjust">
                    <Action.Push
                      title="Set Brightness"
                      icon={Icon.Sun}
                      target={<BrightnessControl light={light} client={client} onComplete={refreshLights} />}
                      shortcut={{ modifiers: ["cmd"], key: "b" }}
                    />
                    <Action.Push
                      title="Set Color"
                      icon={Icon.Palette}
                      target={<ColorPicker light={light} client={client} onComplete={refreshLights} />}
                      shortcut={{ modifiers: ["cmd"], key: "c" }}
                    />
                    <Action.Push
                      title="Set Temperature"
                      icon={Icon.Temperature}
                      target={<TemperatureControl light={light} client={client} onComplete={refreshLights} />}
                      shortcut={{ modifiers: ["cmd"], key: "k" }}
                    />
                  </ActionPanel.Section>

                  <ActionPanel.Section title="All Lights">
                    <Action
                      title="Turn All On"
                      icon={Icon.LightBulb}
                      onAction={() => controlAllLights("on")}
                      shortcut={{ modifiers: ["cmd", "shift"], key: "o" }}
                    />
                    <Action
                      title="Turn All Off"
                      icon={Icon.LightBulbOff}
                      onAction={() => controlAllLights("off")}
                      shortcut={{ modifiers: ["cmd", "shift"], key: "f" }}
                    />
                  </ActionPanel.Section>

                  <ActionPanel.Section>
                    <Action
                      title="Refresh Lights"
                      icon={Icon.ArrowClockwise}
                      onAction={refreshLights}
                      shortcut={{ modifiers: ["cmd"], key: "r" }}
                    />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}
    </List>
  );
}
