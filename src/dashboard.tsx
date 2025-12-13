import {
  List,
  Grid,
  Form,
  showToast,
  Toast,
  ActionPanel,
  Action,
  Icon,
  Color,
  Alert,
  confirmAlert,
  popToRoot,
  getPreferenceValues,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { useCachedState, usePromise } from "@raycast/utils";
import { LIFXClientManager } from "./lib/lifx-client";
import { ProfileStorage } from "./lib/storage";
import { LIFXLight, LightProfile, ProfileLightState } from "./lib/types";
import { LightListItem } from "./components/LightListItem";
import { LightGridItem } from "./components/LightGridItem";

type ViewMode = "list" | "grid";
type DashboardView = "lights" | "profiles" | "save-profile";

interface Preferences {
  httpApiToken?: string;
  defaultFadeDuration?: string;
  lanTimeout?: string;
  enableLanDiscovery?: boolean;
}

export default function Command() {
  const [lights, setLights] = useState<LIFXLight[]>([]);
  const [profiles, setProfiles] = useState<LightProfile[]>([]);
  const [viewMode, setViewMode] = useCachedState<ViewMode>("view-mode", "list");
  const [dashboardView, setDashboardView] = useCachedState<DashboardView>("dashboard-view", "lights");
  const [client] = useState(() => new LIFXClientManager());
  const [storage] = useState(() => new ProfileStorage());
  const preferences = getPreferenceValues<Preferences>();

  const { isLoading, revalidate } = usePromise(
    async () => {
      await client.initialize();
      const discoveredLights = await client.discoverLights();
      setLights(discoveredLights);

      const savedProfiles = await storage.getProfiles();
      setProfiles(savedProfiles);

      const state = client.getConnectionState();
      if (discoveredLights.length === 0) {
        showToast({
          style: Toast.Style.Failure,
          title: "No lights discovered",
          message: state.lanAvailable || state.httpAvailable ? "No LIFX lights found" : "Enable LAN or provide API token",
        });
      } else {
        showToast({
          style: Toast.Style.Success,
          title: `Found ${discoveredLights.length} light${discoveredLights.length !== 1 ? "s" : ""}`,
        });
      }

      return { lights: discoveredLights, profiles: savedProfiles };
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

  useEffect(() => {
    return () => {
      client.destroy();
    };
  }, []);

  async function refreshLights() {
    console.log(`[UI] Refresh requested`);
    try {
      const discoveredLights = await client.discoverLights();
      console.log(`[UI] Setting ${discoveredLights.length} lights in state`);
      setLights(discoveredLights);
      showToast({
        style: Toast.Style.Success,
        title: `Refreshed - ${discoveredLights.length} light${discoveredLights.length !== 1 ? "s" : ""}`,
      });
    } catch (error) {
      console.error(`[UI] Refresh failed:`, error);
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to refresh lights",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function refreshProfiles() {
    try {
      const savedProfiles = await storage.getProfiles();
      setProfiles(savedProfiles);
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to refresh profiles",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function controlAllLights(action: "on" | "off" | "brightness", value?: number) {
    try {
      for (const light of lights) {
        if (action === "on") {
          await client.controlLight(light.id, { power: true });
        } else if (action === "off") {
          await client.controlLight(light.id, { power: false });
        } else if (action === "brightness" && value !== undefined) {
          await client.controlLight(light.id, { brightness: value });
        }
      }
      showToast({
        style: Toast.Style.Success,
        title: `All lights ${action === "on" ? "turned on" : action === "off" ? "turned off" : `set to ${value}%`}`,
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

  async function applyProfile(profile: LightProfile) {
    const confirmed = await confirmAlert({
      title: `Apply profile "${profile.name}"?`,
      message: `This will update ${profile.lights.length} light${profile.lights.length !== 1 ? "s" : ""}`,
      primaryAction: { title: "Apply", style: Alert.ActionStyle.Default },
    });

    if (!confirmed) return;

    try {
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
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await refreshLights();
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

  async function deleteProfile(profile: LightProfile) {
    const confirmed = await confirmAlert({
      title: `Delete profile "${profile.name}"?`,
      message: "This action cannot be undone",
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
    });

    if (!confirmed) return;

    try {
      await storage.deleteProfile(profile.id);
      showToast({ style: Toast.Style.Success, title: `Deleted profile "${profile.name}"` });
      await refreshProfiles();
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to delete profile",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const toggleViewMode = () => {
    setViewMode(viewMode === "list" ? "grid" : "list");
  };

  const navigationActions = (
    <ActionPanel.Section title="Navigation">
      <Action
        title="View Lights"
        icon={Icon.LightBulb}
        onAction={() => setDashboardView("lights")}
        shortcut={{ modifiers: ["cmd"], key: "1" }}
      />
      <Action
        title="View Profiles"
        icon={Icon.SaveDocument}
        onAction={() => setDashboardView("profiles")}
        shortcut={{ modifiers: ["cmd"], key: "2" }}
      />
      <Action
        title="Save New Profile"
        icon={Icon.Plus}
        onAction={() => setDashboardView("save-profile")}
        shortcut={{ modifiers: ["cmd"], key: "n" }}
      />
    </ActionPanel.Section>
  );

  const commonActions = (
    <ActionPanel.Section>
      <Action
        title={`Switch to ${viewMode === "list" ? "Grid" : "List"} View`}
        icon={viewMode === "list" ? Icon.Grid : Icon.List}
        onAction={toggleViewMode}
        shortcut={{ modifiers: ["cmd"], key: "v" }}
      />
      <Action
        title="Refresh"
        icon={Icon.ArrowClockwise}
        onAction={async () => {
          await refreshLights();
          await refreshProfiles();
        }}
        shortcut={{ modifiers: ["cmd"], key: "r" }}
      />
    </ActionPanel.Section>
  );

  const allLightsActions = (
    <>
      <ActionPanel.Section title="All Lights">
        <Action
          title="Turn All On"
          icon={Icon.Power}
          onAction={() => controlAllLights("on")}
          shortcut={{ modifiers: ["cmd", "shift"], key: "o" }}
        />
        <Action
          title="Turn All Off"
          icon={Icon.PowerOff}
          onAction={() => controlAllLights("off")}
          shortcut={{ modifiers: ["cmd", "shift"], key: "x" }}
        />
      </ActionPanel.Section>
      <ActionPanel.Section title="Set All Brightness">
        <Action
          title="All to 100%"
          icon={Icon.Sun}
          onAction={() => controlAllLights("brightness", 100)}
          shortcut={{ modifiers: ["cmd", "shift"], key: "1" }}
        />
        <Action
          title="All to 75%"
          icon={Icon.Sun}
          onAction={() => controlAllLights("brightness", 75)}
          shortcut={{ modifiers: ["cmd", "shift"], key: "2" }}
        />
        <Action
          title="All to 50%"
          icon={Icon.Circle}
          onAction={() => controlAllLights("brightness", 50)}
          shortcut={{ modifiers: ["cmd", "shift"], key: "3" }}
        />
        <Action
          title="All to 25%"
          icon={Icon.Circle}
          onAction={() => controlAllLights("brightness", 25)}
          shortcut={{ modifiers: ["cmd", "shift"], key: "4" }}
        />
      </ActionPanel.Section>
      {navigationActions}
      {commonActions}
    </>
  );

  // Render Save Profile Form
  if (dashboardView === "save-profile") {
    return <SaveProfileForm lights={lights} storage={storage} onComplete={() => setDashboardView("profiles")} />;
  }

  // Render Profiles View
  if (dashboardView === "profiles") {
    return (
      <List isLoading={isLoading} searchBarPlaceholder="Search profiles...">
        {profiles.length === 0 ? (
          <List.EmptyView
            title="No Profiles Saved"
            description="Save your current light setup as a profile"
            icon={Icon.SaveDocument}
            actions={
              <ActionPanel>
                <Action
                  title="Save New Profile"
                  icon={Icon.Plus}
                  onAction={() => setDashboardView("save-profile")}
                />
                {navigationActions}
                {commonActions}
              </ActionPanel>
            }
          />
        ) : (
          profiles.map((profile: LightProfile) => {
            const accessories: List.Item.Accessory[] = [];

            if (profile.tags && profile.tags.length > 0) {
              accessories.push({
                tag: { value: profile.tags[0], color: Color.Blue },
                tooltip: `Tags: ${profile.tags.join(", ")}`,
              });
            }

            accessories.push({
              text: `${profile.lights.length} light${profile.lights.length !== 1 ? "s" : ""}`,
              icon: Icon.LightBulb,
            });
            accessories.push({ date: new Date(profile.updatedAt) });

            return (
              <List.Item
                key={profile.id}
                title={profile.name}
                subtitle={profile.description}
                icon={{ source: Icon.SaveDocument, tintColor: Color.Green }}
                accessories={accessories}
                actions={
                  <ActionPanel>
                    <ActionPanel.Section title="Profile Actions">
                      <Action
                        title="Apply Profile"
                        icon={Icon.Checkmark}
                        onAction={() => applyProfile(profile)}
                        shortcut={{ modifiers: ["cmd"], key: "enter" }}
                      />
                      <Action
                        title="Delete Profile"
                        icon={Icon.Trash}
                        style={Action.Style.Destructive}
                        onAction={() => deleteProfile(profile)}
                        shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                      />
                    </ActionPanel.Section>
                    <ActionPanel.Section title="Copy">
                      <Action.CopyToClipboard
                        title="Copy Profile Name"
                        content={profile.name}
                        shortcut={{ modifiers: ["cmd"], key: "c" }}
                      />
                      {profile.description && (
                        <Action.CopyToClipboard
                          title="Copy Description"
                          content={profile.description}
                          shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                        />
                      )}
                    </ActionPanel.Section>
                    {navigationActions}
                    {commonActions}
                  </ActionPanel>
                }
              />
            );
          })
        )}
      </List>
    );
  }

  // Render Lights View (Grid)
  if (viewMode === "grid") {
    return (
      <Grid
        isLoading={isLoading}
        columns={4}
        aspectRatio="1"
        fit={Grid.Fit.Fill}
        searchBarPlaceholder="Search lights..."
        actions={
          lights.length === 0 && !isLoading ? (
            <ActionPanel>
              <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={refreshLights} />
              {navigationActions}
              {commonActions}
            </ActionPanel>
          ) : undefined
        }
      >
        {lights.length === 0 && !isLoading ? (
          <Grid.EmptyView
            title="No LIFX Lights Found"
            description="Make sure your lights are powered on and connected to the network"
            icon={Icon.LightBulb}
          />
        ) : (
          <>
            {lights.length > 1 && (
              <Grid.Section title="Quick Actions">
                <Grid.Item
                  title="All Lights"
                  subtitle={`${lights.length} total`}
                  content={{
                    source: Icon.LightBulb,
                    tintColor: lights.every((l: LIFXLight) => l.power) ? Color.Green : Color.SecondaryText,
                  }}
                  actions={<ActionPanel>{allLightsActions}</ActionPanel>}
                />
              </Grid.Section>
            )}
            <Grid.Section title="Your Lights" subtitle={`${lights.length} light${lights.length !== 1 ? "s" : ""}`}>
              {lights.map((light: LIFXLight) => (
                <LightGridItem key={light.id} light={light} client={client} onUpdate={refreshLights} />
              ))}
            </Grid.Section>
          </>
        )}
      </Grid>
    );
  }

  // Render Lights View (List)
  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search lights..."
      actions={
        lights.length === 0 && !isLoading ? (
          <ActionPanel>
            <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={refreshLights} />
            {navigationActions}
            {commonActions}
          </ActionPanel>
        ) : undefined
      }
    >
      {lights.length === 0 && !isLoading ? (
        <List.EmptyView
          title="No LIFX Lights Found"
          description="Make sure your lights are powered on and connected to the network"
          icon={Icon.LightBulb}
        />
      ) : (
        <>
          {lights.length > 1 && (
            <List.Section title="All Lights">
              <List.Item
                title={`Control All Lights (${lights.length} total)`}
                icon={Icon.LightBulb}
                accessories={[{ text: "Quick actions for all lights" }]}
                actions={
                  <ActionPanel>
                    <ActionPanel.Section title="All Lights">
                      <Action
                        title="Turn All On"
                        icon={Icon.Power}
                        onAction={() => controlAllLights("on")}
                        shortcut={{ modifiers: ["ctrl", "shift"], key: "o" }}
                      />
                      <Action
                        title="Turn All Off"
                        icon={Icon.PowerOff}
                        onAction={() => controlAllLights("off")}
                        shortcut={{ modifiers: ["ctrl", "shift"], key: "x" }}
                      />
                    </ActionPanel.Section>
                    <ActionPanel.Section title="Set All Brightness">
                      <Action
                        title="All to 100%"
                        onAction={() => controlAllLights("brightness", 100)}
                        shortcut={{ modifiers: ["ctrl", "shift"], key: "1" }}
                      />
                      <Action
                        title="All to 75%"
                        onAction={() => controlAllLights("brightness", 75)}
                        shortcut={{ modifiers: ["ctrl", "shift"], key: "2" }}
                      />
                      <Action
                        title="All to 50%"
                        onAction={() => controlAllLights("brightness", 50)}
                        shortcut={{ modifiers: ["ctrl", "shift"], key: "3" }}
                      />
                      <Action
                        title="All to 25%"
                        onAction={() => controlAllLights("brightness", 25)}
                        shortcut={{ modifiers: ["ctrl", "shift"], key: "4" }}
                      />
                    </ActionPanel.Section>
                    {navigationActions}
                    {commonActions}
                  </ActionPanel>
                }
              />
            </List.Section>
          )}
          <List.Section title="Individual Lights" subtitle={`${lights.length} light${lights.length !== 1 ? "s" : ""}`}>
            {lights.map((light: LIFXLight) => (
              <LightListItem key={light.id} light={light} client={client} onUpdate={refreshLights} />
            ))}
          </List.Section>
        </>
      )}
    </List>
  );
}

// Save Profile Form Component
function SaveProfileForm({
  lights,
  storage,
  onComplete,
}: {
  lights: LIFXLight[];
  storage: ProfileStorage;
  onComplete: () => void;
}) {
  const [profileName, setProfileName] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [profileTags, setProfileTags] = useState<string[]>([]);

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
        tags: profileTags.length > 0 ? profileTags : undefined,
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
      onComplete();
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to save profile",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const tagOptions = [
    { value: "work", title: "Work" },
    { value: "relax", title: "Relax" },
    { value: "sleep", title: "Sleep" },
    { value: "focus", title: "Focus" },
    { value: "party", title: "Party" },
    { value: "reading", title: "Reading" },
    { value: "gaming", title: "Gaming" },
    { value: "movie", title: "Movie" },
    { value: "morning", title: "Morning" },
    { value: "evening", title: "Evening" },
  ];

  const nameError = profileName.trim() === "" ? "Profile name is required" : undefined;

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save Profile"
            icon={Icon.SaveDocument}
            onSubmit={handleSubmit}
            shortcut={{ modifiers: ["cmd"], key: "s" }}
          />
          <Action
            title="Cancel"
            icon={Icon.XMarkCircle}
            onAction={onComplete}
            shortcut={{ modifiers: ["cmd"], key: "w" }}
            style={Action.Style.Destructive}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Profile Name"
        placeholder="Evening ambiance"
        value={profileName}
        onChange={setProfileName}
        error={nameError}
        info="Give your profile a memorable name"
      />
      <Form.TextArea
        id="description"
        title="Description"
        placeholder="Optional description for this profile"
        value={profileDescription}
        onChange={setProfileDescription}
        enableMarkdown
      />
      <Form.TagPicker
        id="tags"
        title="Tags"
        placeholder="Add tags to organize profiles"
        value={profileTags}
        onChange={setProfileTags}
      >
        {tagOptions.map((tag) => (
          <Form.TagPicker.Item key={tag.value} value={tag.value} title={tag.title} />
        ))}
      </Form.TagPicker>
      <Form.Separator />
      <Form.Description
        title="Lights to Save"
        text={`This profile will save the current state of ${lights.length} light${lights.length !== 1 ? "s" : ""}:\n\n${lights.map((l: LIFXLight) => `• ${l.label} - ${l.power ? "On" : "Off"}, ${l.brightness}%`).join("\n")}`}
      />
    </Form>
  );
}
