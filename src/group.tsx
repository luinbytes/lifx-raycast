import {
  List,
  showToast,
  Toast,
  Action,
  Icon,
  getPreferenceValues,
  Color,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { LIFXClientManager } from "./lib/lifx-client";
import { LIFXLight } from "./lib/types";

interface Preferences {
  httpApiToken?: string;
}

interface LightGroup {
  name: string;
  lights: LIFXLight[];
  id: string;
}

export default function Command() {
  const [groups, setGroups] = useState<LightGroup[]>([]);
  const [client] = useState(() => new LIFXClientManager());
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const preferences = getPreferenceValues<Preferences>();

  useEffect(() => {
    loadGroups();
  }, [preferences.httpApiToken, client]);

  async function loadGroups() {
    setIsLoading(true);
    try {
      await client.initialize();
      const lights = await client.discoverLights();

      // Group lights by group name
      const groupMap = new Map<string, LIFXLight[]>();

      // Lights without a group go to "Ungrouped"
      const ungrouped: LIFXLight[] = [];

      for (const light of lights) {
        if (light.group) {
          if (!groupMap.has(light.group)) {
            groupMap.set(light.group, []);
          }
          groupMap.get(light.group)!.push(light);
        } else {
          ungrouped.push(light);
        }
      }

      // Convert map to array
      const groupsList: LightGroup[] = [];

      for (const [name, groupLights] of groupMap.entries()) {
        groupsList.push({
          name,
          lights: groupLights,
          id: `group-${name}`,
        });
      }

      // Add ungrouped lights as a "group"
      if (ungrouped.length > 0) {
        groupsList.push({
          name: "Ungrouped Lights",
          lights: ungrouped,
          id: "ungrouped",
        });
      }

      // Sort alphabetically
      groupsList.sort((a, b) => a.name.localeCompare(b.name));

      setGroups(groupsList);
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to Load Groups",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function controlGroup(groupId: string, action: "on" | "off") {
    const group = groups.find((g) => g.id === groupId);

    if (!group) {
      return;
    }

    setIsActionLoading(groupId);

    try {
      const promises = group.lights.map((light) =>
        client.controlLight(light.id, { power: action === "on" })
      );

      await Promise.all(promises);

      showToast({
        style: Toast.Style.Success,
        title: "Group Controlled",
        message: `${group.name}: ${group.lights.length} light(s) turned ${action}`,
      });
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to Control Group",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsActionLoading(null);
    }
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search groups...">
      {groups.map((group) => (
        <List.Item
          key={group.id}
          id={group.id}
          title={group.name}
          subtitle={`${group.lights.length} light(s)`}
          icon={Icon.Box}
          accessories={[
            {
              text: group.id === "ungrouped" ? "Unorganized" : "Group",
              icon: group.id === "ungrouped" ? Icon.QuestionMark : Icon.Box,
            },
          ]}
          actions={
            <ActionPanel>
              <Action
                title="Turn On"
                onAction={() => controlGroup(group.id, "on")}
                icon={Icon.Lightbulb}
                style={Action.Style.Regular}
              />
              <Action
                title="Turn Off"
                onAction={() => controlGroup(group.id, "off")}
                icon={Icon.LightbulbOff}
                style={Action.Style.Regular}
              />
              <Action
                title="Refresh Groups"
                onAction={loadGroups}
                icon={Icon.ArrowClockwise}
                shortcut={{ modifiers: ["cmd"], key: "r" }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
