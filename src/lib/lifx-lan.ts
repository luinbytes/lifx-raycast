import { Client } from "lifx-lan-client";
import { LIFXLight, LightControl } from "./types";

interface LifxLanLight {
  id: string;
  address: string;
  port: number;
  on: (duration: number, callback?: () => void) => void;
  off: (duration: number, callback?: () => void) => void;
  color: (hue: number, saturation: number, brightness: number, kelvin: number, duration: number, callback?: () => void) => void;
  getState: (callback: (error: Error | null, state: any) => void) => void;
}

export class LIFXLanClient {
  private client: Client;
  private lights: Map<string, LifxLanLight>;

  constructor() {
    this.client = new Client();
    this.lights = new Map();
  }

  async initialize(timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.lights.size === 0) {
          reject(new Error("No lights discovered via LAN"));
        } else {
          resolve();
        }
      }, timeout);

      this.client.on("light-new", (light: LifxLanLight) => {
        this.lights.set(light.id, light);
        if (timer && this.lights.size === 1) {
          clearTimeout(timer);
          resolve();
        }
      });

      this.client.init();
    });
  }

  async getLights(): Promise<LIFXLight[]> {
    const lights: LIFXLight[] = [];
    console.log(`[LAN Discovery] Querying ${this.lights.size} lights for state...`);

    for (const [id, lanLight] of this.lights) {
      const state = await new Promise<any>((resolve) => {
        lanLight.getState((err, data) => {
          resolve(err ? null : data);
        });
      });

      if (state) {
        console.log(`[LAN Discovery] Raw state from bulb:`, state.color);

        // IMPORTANT: The lifx-lan-client library returns brightness as 0-100, NOT 0-65535
        // but hue and saturation ARE in 0-65535 range
        const lightData = {
          id,
          label: state.label || `Light ${id.substring(0, 8)}`,
          power: state.power === 1,
          brightness: Math.round(state.color.brightness), // Already 0-100
          hue: Math.round((state.color.hue / 65535) * 360),
          saturation: Math.round((state.color.saturation / 65535) * 100),
          kelvin: state.color.kelvin,
          connected: true,
          source: "lan",
          reachable: true,
        };
        console.log(`[LAN Discovery] ${lightData.label}: Power:${lightData.power} H:${lightData.hue}° S:${lightData.saturation}% B:${lightData.brightness}% K:${lightData.kelvin}K`);
        lights.push(lightData);
      }
    }

    return lights;
  }

  async control(lightId: string, control: LightControl): Promise<void> {
    const light = this.lights.get(lightId);
    if (!light) throw new Error("Light not found");

    console.log(`[LAN Control] Light: ${lightId.substring(0, 8)}, Requested:`, control);

    const duration = control.duration ?? 1000;

    // Handle power separately
    if (control.power !== undefined) {
      console.log(`[LAN Control] Setting power to ${control.power}`);
      await new Promise<void>((resolve, reject) => {
        if (control.power) {
          light.on(duration, () => resolve());
        } else {
          light.off(duration, () => resolve());
        }
        setTimeout(() => reject(new Error("Control timeout")), 10000);
      });
    }

    // For color/brightness/temp changes, ALWAYS get fresh state first to preserve other values
    if (
      control.hue !== undefined ||
      control.saturation !== undefined ||
      control.brightness !== undefined ||
      control.kelvin !== undefined
    ) {
      // Get FRESH current state
      const state = await new Promise<any>((resolve, reject) => {
        light.getState((err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      if (!state) {
        throw new Error("Failed to get light state");
      }

      // Log raw state from bulb
      console.log(`[LAN Control] Raw state from bulb:`, state.color);

      // IMPORTANT: The lifx-lan-client library returns brightness as 0-100, NOT 0-65535
      // but hue and saturation ARE in 0-65535 range
      const currentHue = Math.round((state.color.hue / 65535) * 360);
      const currentSat = Math.round((state.color.saturation / 65535) * 100);
      const currentBri = Math.round(state.color.brightness); // Already 0-100
      const currentKelvin = state.color.kelvin;
      console.log(`[LAN Control] Current state from bulb: H:${currentHue}° S:${currentSat}% B:${currentBri}% K:${currentKelvin}K`);

      // Preserve all values we're not explicitly changing
      const hue = control.hue ?? currentHue;
      const sat = control.saturation ?? currentSat;

      // IMPORTANT: If brightness is not explicitly set and current brightness is 0,
      // default to 100% when changing color/temp (otherwise light appears off)
      let bri = control.brightness ?? currentBri;
      if (bri === 0 && control.brightness === undefined && (control.hue !== undefined || control.saturation !== undefined || control.kelvin !== undefined)) {
        console.log(`[LAN Control] WARNING: Brightness is 0%, defaulting to 100% for color/temp change`);
        bri = 100;
      }

      const kelvin = control.kelvin ?? currentKelvin;

      console.log(`[LAN Control] Sending to bulb: H:${hue}° S:${sat}% B:${bri}% K:${kelvin}K`);

      // Convert to library's expected format:
      // - hue and saturation: 0-65535 range
      // - brightness: 0-100 range (NOT 0-65535!)
      // - kelvin: absolute value
      const hue65535 = Math.round((hue / 360) * 65535);
      const sat65535 = Math.round((sat / 100) * 65535);
      const briValue = Math.round(bri); // Already 0-100

      console.log(`[LAN Control] Converted values: H:${hue65535} S:${sat65535} B:${briValue} K:${kelvin}`);

      // Set all color properties at once (required by LIFX LAN protocol)
      await new Promise<void>((resolve, reject) => {
        light.color(hue65535, sat65535, briValue, kelvin, duration, () => resolve());
        setTimeout(() => reject(new Error("Control timeout")), 10000);
      });
      console.log(`[LAN Control] Command sent successfully`);
    }
  }

  destroy(): void {
    if (this.client) {
      this.client.destroy();
    }
  }
}
