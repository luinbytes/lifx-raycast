import { Icon, Color, List, ActionPanel, Action, showToast, Toast, Clipboard } from "@raycast/api";

interface TroubleshootingGuideProps {
  steps: string[];
  errorType?: string;
  onDismiss: () => void;
}

export function TroubleshootingGuide({ steps, errorType, onDismiss }: TroubleshootingGuideProps) {
  const getErrorTitle = () => {
    switch (errorType) {
      case "no-lights":
        return "No Lights Found";
      case "timeout":
        return "Connection Timeout";
      case "connection-refused":
        return "Connection Refused";
      case "network-error":
        return "Network Error";
      default:
        return "Connection Issue";
    }
  };

  const getErrorDescription = () => {
    switch (errorType) {
      case "no-lights":
        return "No LIFX lights were discovered on your network";
      case "timeout":
        return "The connection to your lights timed out";
      case "connection-refused":
        return "The connection was refused by the network";
      case "network-error":
        return "A network error occurred while connecting";
      default:
        return "There was an issue connecting to your lights";
    }
  };

  return (
    <List navigationTitle="Troubleshooting Guide" searchBarPlaceholder="Search steps...">
      <List.Section title="Issue">
        <List.Item
          title={getErrorTitle()}
          subtitle={getErrorDescription()}
          icon={{ source: Icon.ExclamationMark, tintColor: Color.Red }}
          accessories={[{ icon: Icon.Info, tooltip: "Press Esc to return" }]}
        />
      </List.Section>

      <List.Section title="Troubleshooting Steps">
        {steps.map((step, index) => (
          <List.Item
            key={index}
            title={`Step ${index + 1}`}
            subtitle={step}
            icon={{ source: Icon.Gear, tintColor: Color.Blue }}
            actions={
              <ActionPanel>
                <Action.CopyToClipboard
                  title="Copy Step"
                  content={step}
                  onCopy={() => {
                    showToast({
                      style: Toast.Style.Success,
                      title: "Copied to clipboard",
                    });
                  }}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>

      <List.Section title="Additional Help">
        <List.Item
          title="View LIFX Documentation"
          subtitle="Official LIFX help and support"
          icon={{ source: Icon.Globe, tintColor: Color.Blue }}
          actions={
            <ActionPanel>
              <Action.OpenInBrowser
                title="Open LIFX Support"
                url="https://community.lifx.com/"
                icon={Icon.Globe}
              />
            </ActionPanel>
          }
        />
        <List.Item
          title="Check Network Settings"
          subtitle="Ensure your Mac and lights are on the same network"
          icon={{ source: Icon.Wifi, tintColor: Color.Green }}
          actions={
            <ActionPanel>
              <Action
                title="Open Network Settings"
                icon={Icon.Gear}
                shortcut={{ modifiers: ["cmd"], key: "," }}
                onAction={() => {
                  showToast({
                    style: Toast.Style.Animated,
                    title: "Opening Network Settings...",
                    message: "Go to System Settings → Network",
                  });
                }}
              />
            </ActionPanel>
          }
        />
        <List.Item
          title="Restart Extension"
          subtitle="Close and reopen Raycast to restart the extension"
          icon={{ source: Icon.ArrowClockwise, tintColor: Color.Orange }}
          actions={
            <ActionPanel>
              <Action
                title="Restart Extension"
                icon={Icon.ArrowClockwise}
                onAction={() => {
                  showToast({
                    style: Toast.Style.Success,
                    title: "Extension Restarted",
                    message: "Close and reopen Raycast to apply changes",
                  });
                }}
              />
            </ActionPanel>
          }
        />
      </List.Section>
    </List>
  );
}
