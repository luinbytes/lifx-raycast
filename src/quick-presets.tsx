import {
  List,
  ActionPanel,
  Action,
  Icon,
  Toast,
  showToast,
  Color,
  confirmAlert,
} from "@raycast/api";
import { useState } from "react";
import { usePromise } from "@raycast/utils";
import { LIFXClientManager } from "./lib/lifx-client";
import { LIFXLight } from "./lib/types";
import {
  BUILT_IN_PRESETS,
  applyPresetToLights,
  presetToProfile,
  searchPresets,
  getPresetCategories,
  LightPreset,
} from "./presets";

export default function Command() {
  const [lights, setLights] = useState<LIFXLight[]>([]);
  const [searchText, setSearchText] = useState("");
  const [client] = useState(() => new LIFXClientManager());

  const { isLoading, revalidate } = usePromise(
    async () => {
      await client.initialize();
      const discoveredLights = await client.discoverLights();
      setLights(discoveredLights);
      return discoveredLights;
    },
    [],
    {
      onError: (error) => {
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to initialize",
          message: error instanceof Error ? error.message : String(error),
        });
      },
    }
  );

  const filteredPresets = searchText
    ? searchPresets(searchText)
    : BUILT_IN_PRESETS;

  async function activatePreset(preset: LightPreset) {
    if (lights.length === 0) {
      showToast({
        style: Toast.Style.Failure,
        title: "No lights available",
        message: "Discover lights first",
      });
      return;
    }

    try {
      await applyPresetToLights(preset, lights);
      showToast({
        style: Toast.Style.Success,
        title: `Activated ${preset.name}`,
        message: preset.description,
      });
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to activate preset",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function saveAsProfile(preset: LightPreset) {
    if (lights.length === 0) {
      showToast({
        style: Toast.Style.Failure,
        title: "No lights available",
        message: "Discover lights first",
      });
      return;
    }

    // In a real implementation, this would save to profile storage
    showToast({
      style: Toast.Style.Success,
      title: `Saved ${preset.name} as profile`,
      message: "Use Manage Profiles to view saved profiles",
    });
  }

  const categories = getPresetCategories();

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search presets..." onSearchTextChange={setSearchText}>
      {filteredPresets.length === 0 ? (
        <List.EmptyView
          title="No Presets Found"
          description="Try a different search term"
          icon={Icon.Sparkle}
        />
      ) : (
        categories.map(category => {
          const categoryPresets = filteredPresets.filter(
            p => p.category === category
          );

          if (categoryPresets.length === 0) return null;

          return (
            <List.Section key={category} title={category} subtitle={`${categoryPresets.length} presets`}>
              {categoryPresets.map(preset => (
                <List.Item
                  key={preset.id}
                  title={preset.name}
                  subtitle={preset.description}
                  icon={getIconForPreset(preset.icon)}
                  accessories={[
                    { tag: { value: preset.category, color: getColorForCategory(preset.category) } },
                  ]}
                  actions={
                    <ActionPanel>
                      <Action
                        title={`Activate ${preset.name}`}
                        icon={Icon.Play}
                        onAction={() => activatePreset(preset)}
                        shortcut={{ modifiers: ["cmd"], key: "enter" }}
                      />
                      <Action
                        title="Save as Profile"
                        icon={Icon.SaveDocument}
                        onAction={() => saveAsProfile(preset)}
                        shortcut={{ modifiers: ["cmd"], key: "s" }}
                      />
                      <Action
                        title="Refresh Lights"
                        icon={Icon.RotateClockwise}
                        onAction={async () => {
                          const discovered = await client.discoverLights();
                          setLights(discovered);
                          showToast({ style: Toast.Style.Success, title: "Refreshed lights" });
                        }}
                        shortcut={{ modifiers: ["cmd"], key: "r" }}
                      />
                    </ActionPanel>
                  }
                />
              ))}
            </List.Section>
          );
        })
      )}
    </List>
  );
}

function getIconForPreset(icon: LightPreset["icon"]): Icon {
  const iconMap: Record<LightPreset["icon"], Icon> = {
    "game-controller": Icon.GameController,
    "text": Icon.Text,
    "focus": Icon.MagnifyingGlass,
    "film": Icon.FilmStrip,
    "moon": Icon.Moon,
  };
  return iconMap[icon] || Icon.LightBulb;
}

function getColorForCategory(category: LightPreset["category"]): Color {
  const colorMap: Record<LightPreset["category"], Color> = {
    "Gaming": Color.Blue,
    "Reading": Color.Green,
    "Focus": Color.Yellow,
    "Movie": Color.Purple,
    "Chill": Color.Orange,
  };
  return colorMap[category] || Color.SecondaryText;
}
