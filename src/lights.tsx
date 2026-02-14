import { List, showToast, Toast, Action, Icon, getPreferenceValues } from "@raycast/api";
import { useEffect, useState } from "react";
import { LIFXClientManager } from "./lib/lifx-client";

interface Preferences {
  httpApiToken?: string;
}

export default function Command() {
  const [client] = useState(() => new LIFXClientManager());
  const [isLoading, setIsLoading] = useState(false);
  const preferences = getPreferenceValues<Preferences>();

  const ACTIONS = [
    {
      id: "on",
      title: "Turn All Lights On",
      subtitle: "Power on all discovered lights",
      icon: Icon.Lightbulb,
      color: Color.Green as any,
    },
    {
      id: "off",
      title: "Turn All Lights Off",
      subtitle: "Power off all discovered lights",
      icon: Icon.LightbulbOff,
      color: Color.Red as any,
    },
  ];

  useEffect(() => {
    client.initialize().catch((error) => {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to initialize LIFX client",
        message: error instanceof Error ? error.message : String(error),
      });
    });
  }, [client]);

  async function controlAllLights(action: "on" | "off") {
    setIsLoading(true);
    try {
      const lights = await client.discoverLights();

      if (lights.length === 0) {
        showToast({
          style: Toast.Style.Failure,
          title: "No Lights Found",
          message: "No LIFX lights were discovered",
        });
        return;
      }

      // Control all lights
      const promises = lights.map((light) =>
        client.controlLight(light.id, { power: action === "on" })
      );

      await Promise.all(promises);

      showToast({
        style: Toast.Style.Success,
        title: "All Lights Controlled",
        message: `All ${lights.length} light(s) turned ${action}`,
      });
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to Control Lights",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search actions...">
      {ACTIONS.map((action) => (
        <List.Item
          key={action.id}
          id={action.id}
          title={action.title}
          subtitle={action.subtitle}
          icon={action.icon}
          actions={
            <ActionPanel>
              <Action
                title="Execute"
                onAction={() => controlAllLights(action.id as "on" | "off")}
                icon={Icon.PlayCircle}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
