import { getPreferenceValues } from "@raycast/api";
import { LIFXLanClient } from "./lifx-lan";
import { LIFXHttpClient } from "./lifx-http";
import { LIFXLight, LightControl, Preferences, ConnectionState } from "./types";

export class LIFXClientManager {
  private lanClient: LIFXLanClient | null = null;
  private httpClient: LIFXHttpClient | null = null;
  private connectionState: ConnectionState = {
    lanAvailable: false,
    httpAvailable: false,
    activeLights: [],
    lastDiscovery: null,
    discoveryStatus: "idle",
    connectionType: "none",
    lastError: undefined,
    errorType: undefined,
  };

  async initialize(): Promise<void> {
    const preferences = getPreferenceValues<Preferences>();
    this.connectionState.discoveryStatus = "running";

    // Try LAN discovery first (if enabled in preferences)
    if (preferences.enableLanDiscovery) {
      try {
        const timeout = parseInt(preferences.lanTimeout) || 5000;
        const stateTimeout = parseInt(preferences.lanStateTimeout) || 5000;
        const retryAttempts = parseInt(preferences.lanRetryAttempts) || 3;
        const cooldownPeriod = parseInt(preferences.lanCooldownPeriod) || 2000;

        this.lanClient = new LIFXLanClient({
          stateTimeout,
          retryAttempts,
          cooldownPeriod,
        });
        await this.lanClient.initialize(timeout);
        this.connectionState.lanAvailable = true;
        this.connectionState.connectionType = "lan";
        this.connectionState.discoveryStatus = "success";
        this.connectionState.lastError = undefined;
        this.connectionState.errorType = undefined;
      } catch (error) {
        const err = error as Error;
        const errorType = (err as any).type || "unknown";
        console.warn("LAN discovery failed:", error);

        this.connectionState.lanAvailable = false;
        this.connectionState.discoveryStatus = "error";
        this.connectionState.lastError = err.message;
        this.connectionState.errorType = errorType;

        // Provide user-friendly error messages
        if (errorType === "no-lights") {
          this.connectionState.lastError = "No LIFX lights found on your network";
        } else if (errorType === "timeout") {
          this.connectionState.lastError = "Network timeout - check if lights are powered on";
        } else if (errorType === "connection-refused") {
          this.connectionState.lastError = "Connection refused - check your network connection";
        } else if (errorType === "network-error") {
          this.connectionState.lastError = "Network error - check your internet connection";
        }
      }
    }

    // Initialize HTTP client (requires API token) - fallback if LAN fails
    if (preferences.httpApiToken) {
      try {
        this.httpClient = new LIFXHttpClient();
        await this.httpClient.initialize(preferences.httpApiToken);
        this.connectionState.httpAvailable = true;

        // If LAN failed, use HTTP as primary
        if (!this.connectionState.lanAvailable) {
          this.connectionState.connectionType = "http";
          this.connectionState.discoveryStatus = "success";
        }
      } catch (error) {
        console.warn("HTTP API initialization failed:", error);
        this.connectionState.httpAvailable = false;
        const err = error as Error;
        this.connectionState.lastError = `HTTP API failed: ${err.message}`;
      }
    }

    if (!this.connectionState.lanAvailable && !this.connectionState.httpAvailable) {
      this.connectionState.discoveryStatus = "error";
      this.connectionState.connectionType = "none";
      throw new Error("No connection method available. Enable LAN discovery or provide HTTP API token.");
    }
  }

  async discoverLights(): Promise<LIFXLight[]> {
    console.log(`[Client Manager] Starting light discovery...`);
    this.connectionState.discoveryStatus = "running";
    const lights: Map<string, LIFXLight> = new Map();

    // Prefer LAN lights (faster, local)
    if (this.lanClient && this.connectionState.lanAvailable) {
      try {
        const lanLights = await this.lanClient.getLights();
        lanLights.forEach((light) => lights.set(light.id, light));
        console.log(`[Client Manager] Found ${lanLights.length} LAN lights`);
      } catch (error) {
        console.warn("Failed to get LAN lights:", error);
        // Try HTTP as fallback if LAN fails during discovery
        if (this.httpClient && this.connectionState.httpAvailable) {
          this.connectionState.connectionType = "http";
        }
      }
    }

    // Add HTTP lights not found via LAN
    if (this.httpClient && this.connectionState.httpAvailable) {
      try {
        const httpLights = await this.httpClient.getLights();
        httpLights.forEach((light) => {
          if (!lights.has(light.id)) {
            lights.set(light.id, light);
          }
        });
        console.log(`[Client Manager] Found ${httpLights.length} HTTP lights`);
      } catch (error) {
        console.warn("Failed to get HTTP lights:", error);
      }
    }

    this.connectionState.activeLights = Array.from(lights.values());
    this.connectionState.lastDiscovery = new Date();

    // Update discovery status
    if (this.connectionState.activeLights.length === 0) {
      this.connectionState.discoveryStatus = "error";
      this.connectionState.lastError = "No lights discovered";
      this.connectionState.errorType = "no-lights";
    } else {
      this.connectionState.discoveryStatus = "success";
      this.connectionState.lastError = undefined;
    }

    console.log(`[Client Manager] Total lights discovered: ${this.connectionState.activeLights.length}`);
    return this.connectionState.activeLights;
  }

  async getLightState(lightId: string): Promise<LIFXLight | null> {
    // Force fresh discovery to get current state
    await this.discoverLights();
    return this.connectionState.activeLights.find((l) => l.id === lightId) || null;
  }

  async controlLight(lightId: string, control: LightControl): Promise<void> {
    const light = this.connectionState.activeLights.find((l) => l.id === lightId);
    if (!light) throw new Error("Light not found");

    console.log(`[Client Manager] Controlling ${light.label} via ${light.source}:`, control);

    // Try preferred source first, fallback to alternative
    try {
      if (light.source === "lan" && this.lanClient) {
        await this.lanClient.control(lightId, control);
        console.log(`[Client Manager] Control succeeded via LAN`);
        return;
      } else if (this.httpClient) {
        await this.httpClient.control(lightId, control);
        console.log(`[Client Manager] Control succeeded via HTTP`);
        return;
      }
    } catch (error) {
      console.warn(`Primary control method failed for ${light.label}, trying fallback:`, error);

      // Fallback to alternative source
      if (light.source === "lan" && this.httpClient) {
        await this.httpClient.control(lightId, control);
        console.log(`[Client Manager] Control succeeded via HTTP (fallback)`);
      } else if (light.source === "http" && this.lanClient) {
        await this.lanClient.control(lightId, control);
        console.log(`[Client Manager] Control succeeded via LAN (fallback)`);
      } else {
        throw error;
      }
    }
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  getTroubleshootingSteps(): string[] {
    const steps: string[] = [];

    if (this.connectionState.errorType === "no-lights" || this.connectionState.activeLights.length === 0) {
      steps.push("Make sure your LIFX lights are powered on");
      steps.push("Check that your computer and lights are on the same network");
      steps.push("Try resetting your LIFX lights by unplugging and replugging them");
    }

    if (this.connectionState.errorType === "timeout" || this.connectionState.errorType === "connection-refused") {
      steps.push("Check your network connection");
      steps.push("Try disabling any VPN or firewall temporarily");
      steps.push("Restart your router if needed");
    }

    if (!this.connectionState.httpAvailable) {
      steps.push("Add an HTTP API token from https://cloud.lifx.com/settings as a fallback");
    }

    steps.push("Try restarting the extension by closing and reopening Raycast");
    steps.push("Try increasing the LAN Discovery Timeout in preferences");

    return steps;
  }

  getErrorDescription(): string {
    if (!this.connectionState.lastError) {
      return "";
    }

    let description = this.connectionState.lastError;

    // Add troubleshooting hint
    if (this.connectionState.errorType === "no-lights") {
      description += "\n\n💡 Tip: Ensure lights are on the same WiFi network as your Mac";
    } else if (this.connectionState.errorType === "timeout") {
      description += "\n\n💡 Tip: Check that your lights are powered on and not in a power-saving mode";
    } else if (this.connectionState.errorType === "connection-refused") {
      description += "\n\n💡 Tip: Try disabling your VPN or checking firewall settings";
    }

    return description;
  }

  destroy(): void {
    if (this.lanClient) {
      this.lanClient.destroy();
    }
  }
}
