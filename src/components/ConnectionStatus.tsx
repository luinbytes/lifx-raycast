import { Icon, Color, List } from "@raycast/api";

interface ConnectionStatusProps {
  lanAvailable: boolean;
  httpAvailable: boolean;
  connectionType: "lan" | "http" | "none";
  discoveryStatus: "idle" | "running" | "success" | "error";
  lastError?: string;
}

export function ConnectionStatus({
  lanAvailable,
  httpAvailable,
  connectionType,
  discoveryStatus,
  lastError,
}: ConnectionStatusProps) {
  const getStatusIcon = () => {
    if (discoveryStatus === "running") {
      return { icon: Icon.ArrowClockwise, color: Color.Blue, label: "Discovering..." };
    } else if (discoveryStatus === "error" || connectionType === "none") {
      return { icon: Icon.ExclamationMark, color: Color.Red, label: "Connection Error" };
    } else if (connectionType === "lan") {
      return { icon: Icon.Wifi, color: Color.Green, label: "LAN Connected" };
    } else if (connectionType === "http") {
      return { icon: Icon.Globe, color: Color.Orange, label: "HTTP API Connected" };
    } else {
      return { icon: Icon.QuestionMarkCircle, color: Color.SecondaryText, label: "Unknown" };
    }
  };

  const status = getStatusIcon();

  const accessories: List.Item.Accessory[] = [
    {
      icon: lanAvailable ? { source: Icon.CheckCircle, tintColor: Color.Green } : { source: Icon.XMarkCircle, tintColor: Color.SecondaryText },
      tooltip: "LAN Discovery",
    },
    {
      icon: httpAvailable ? { source: Icon.CheckCircle, tintColor: Color.Green } : { source: Icon.XMarkCircle, tintColor: Color.SecondaryText },
      tooltip: "HTTP API",
    },
  ];

  if (lastError) {
    accessories.push({ text: "⚠️ Error", tooltip: lastError });
  }

  return (
    <List.Item
      title="Connection Status"
      subtitle={status.label}
      icon={{ source: status.icon, tintColor: status.color }}
      accessories={accessories}
    />
  );
}
