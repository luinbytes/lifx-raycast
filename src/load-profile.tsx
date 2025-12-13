import { List, ActionPanel, Action, Icon, showToast, Toast, Alert, confirmAlert } from "@raycast/api";
import { useEffect, useState } from "react";
import { LIFXClientManager } from "./lib/lifx-client";
import { ProfileStorage } from "./lib/storage";
import { LightProfile } from "./lib/types";

export default function Command() {
  const [profiles, setProfiles] = useState<LightProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [client] = useState(() => new LIFXClientManager());
  const [storage] = useState(() => new ProfileStorage());

  useEffect(() => {
    loadProfiles();

    return () => {
      client.destroy();
    };
  }, []);

  async function loadProfiles() {
    try {
      const savedProfiles = await storage.getProfiles();
      setProfiles(savedProfiles);
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to load profiles",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function applyProfile(profile: LightProfile) {
    const confirmed = await confirmAlert({
      title: `Apply profile "${profile.name}"?`,
      message: `This will update ${profile.lights.length} light${profile.lights.length !== 1 ? "s" : ""}`,
      primaryAction: { title: "Apply", style: Alert.ActionStyle.Default },
    });

    if (!confirmed) return;

    try {
      await client.initialize();

      let successCount = 0;
      let failCount = 0;

      for (const lightState of profile.lights) {
        try {
          await client.controlLight(lightState.lightId, {
            power: lightState.power,
            brightness: lightState.brightness,
            hue: lightState.hue,
            saturation: lightState.saturation,
            kelvin: lightState.kelvin,
          });
          successCount++;
        } catch (error) {
          console.warn(`Failed to apply profile to ${lightState.lightLabel}:`, error);
          failCount++;
        }
      }

      if (successCount > 0) {
        showToast({
          style: Toast.Style.Success,
          title: `Applied profile to ${successCount} light${successCount !== 1 ? "s" : ""}`,
          message: failCount > 0 ? `${failCount} light${failCount !== 1 ? "s" : ""} failed` : undefined,
        });
      } else {
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to apply profile",
          message: "No lights were updated",
        });
      }
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to apply profile",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search profiles...">
      {profiles.length === 0 ? (
        <List.EmptyView
          title="No Profiles Saved"
          description="Save your current light setup as a profile to load it later"
          icon={Icon.SaveDocument}
        />
      ) : (
        profiles.map((profile) => (
          <List.Item
            key={profile.id}
            title={profile.name}
            subtitle={profile.description}
            accessories={[
              { text: `${profile.lights.length} light${profile.lights.length !== 1 ? "s" : ""}` },
              { date: new Date(profile.updatedAt) },
            ]}
            actions={
              <ActionPanel>
                <Action title="Apply Profile" icon={Icon.Checkmark} onAction={() => applyProfile(profile)} />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
