import { List, showToast, Toast, Action, Icon, getPreferenceValues } from "@raycast/api";
import { useEffect, useState } from "react";
import { LIFXClientManager } from "./lib/lifx-client";
import { LIFXScene } from "./lib/types";

interface Preferences {
  httpApiToken?: string;
}

const PRESET_SCENES: LIFXScene[] = [
  { id: "warm-relax", name: "Warm Relax", description: "Cozy warm lighting for relaxation" },
  { id: "cool-focus", name: "Cool Focus", description: "Bright cool light for productivity" },
  { id: "energize", name: "Energize", description: "Bright and energetic lighting" },
  { id: "night", name: "Night", description: "Dim lighting for nighttime" },
  { id: "reading", name: "Reading", description: "Warm neutral light for reading" },
  { id: "movie", name: "Movie", description: "Dimmed lights for movie watching" },
  { id: "party", name: "Party", description: "Colorful party atmosphere" },
  { id: "wakeup", name: "Wake Up", description: "Gradual bright morning light" },
  { id: "sunset", name: "Sunset", description: "Warm sunset colors" },
];

export default function Command() {
  const [scenes] = useState<LIFXScene[]>(PRESET_SCENES);
  const [client] = useState(() => new LIFXClientManager());
  const [isLoading, setIsLoading] = useState(false);
  const preferences = getPreferenceValues<Preferences>();

  useEffect(() => {
    if (preferences.httpApiToken) {
      client.initialize().catch((error) => {
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to initialize LIFX client",
          message: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }, [preferences.httpApiToken, client]);

  async function activateScene(sceneId: string) {
    if (!preferences.httpApiToken) {
      showToast({
        style: Toast.Style.Failure,
        title: "HTTP API Token Required",
        message: "Scenes require HTTP API. Please add your token in preferences.",
      });
      return;
    }

    setIsLoading(true);
    try {
      // LIFX scenes are cloud-only - need to use HTTP API directly
      const response = await fetch("https://api.lifx.com/v1/scenes/activate", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${preferences.httpApiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scene: sceneId }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to activate scene");
      }

      const scene = scenes.find((s) => s.id === sceneId);

      showToast({
        style: Toast.Style.Success,
        title: "Scene Activated",
        message: scene?.name || "Scene",
      });
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to Activate Scene",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search scenes...">
      {scenes.map((scene) => (
        <List.Item
          key={scene.id}
          id={scene.id}
          title={scene.name}
          subtitle={scene.description}
          icon={Icon.Sparkles}
          actions={
            <ActionPanel>
              <Action
                title="Activate Scene"
                onAction={() => activateScene(scene.id)}
                icon={Icon.PlayCircle}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
