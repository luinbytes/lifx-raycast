import { Form, ActionPanel, Action, showToast, Toast, popToRoot } from "@raycast/api";
import { useEffect, useState } from "react";
import { LIFXClientManager } from "./lib/lifx-client";
import { ProfileStorage } from "./lib/storage";
import { LIFXLight, LightProfile } from "./lib/types";

export default function Command() {
  const [lights, setLights] = useState<LIFXLight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [profileName, setProfileName] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [client] = useState(() => new LIFXClientManager());
  const [storage] = useState(() => new ProfileStorage());

  useEffect(() => {
    loadLights();

    return () => {
      client.destroy();
    };
  }, []);

  async function loadLights() {
    try {
      await client.initialize();
      const discoveredLights = await client.discoverLights();
      setLights(discoveredLights);
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to discover lights",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit() {
    if (!profileName.trim()) {
      showToast({ style: Toast.Style.Failure, title: "Profile name is required" });
      return;
    }

    if (lights.length === 0) {
      showToast({ style: Toast.Style.Failure, title: "No lights available to save" });
      return;
    }

    try {
      const profile: LightProfile = {
        id: `profile-${Date.now()}`,
        name: profileName.trim(),
        description: profileDescription.trim() || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lights: lights.map((light) => ({
          lightId: light.id,
          lightLabel: light.label,
          power: light.power,
          brightness: light.brightness,
          hue: light.hue,
          saturation: light.saturation,
          kelvin: light.kelvin,
        })),
      };

      await storage.saveProfile(profile);
      showToast({
        style: Toast.Style.Success,
        title: `Saved profile "${profileName}"`,
        message: `${lights.length} light${lights.length !== 1 ? "s" : ""} saved`,
      });
      popToRoot();
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to save profile",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Profile" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Profile Name"
        placeholder="Evening ambiance"
        value={profileName}
        onChange={setProfileName}
      />
      <Form.TextArea
        id="description"
        title="Description"
        placeholder="Optional description"
        value={profileDescription}
        onChange={setProfileDescription}
      />
      <Form.Separator />
      <Form.Description text={`This profile will save the current state of ${lights.length} light${lights.length !== 1 ? "s" : ""}`} />
    </Form>
  );
}
