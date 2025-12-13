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

    for (const [id, lanLight] of this.lights) {
      const state = await new Promise<any>((resolve) => {
        lanLight.getState((err, data) => {
          resolve(err ? null : data);
        });
      });

      if (state) {
        lights.push({
          id,
          label: state.label || `Light ${id.substring(0, 8)}`,
          power: state.power === 1,
          brightness: Math.round((state.color.brightness / 65535) * 100),
          hue: Math.round((state.color.hue / 65535) * 360),
          saturation: Math.round((state.color.saturation / 65535) * 100),
          kelvin: state.color.kelvin,
          connected: true,
          source: "lan",
          reachable: true,
        });
      }
    }

    return lights;
  }

  async control(lightId: string, control: LightControl): Promise<void> {
    const light = this.lights.get(lightId);
    if (!light) throw new Error("Light not found");

    const duration = control.duration ?? 1000;

    // Handle power separately
    if (control.power !== undefined) {
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

      // Preserve all values we're not explicitly changing
      const hue = control.hue ?? Math.round((state.color.hue / 65535) * 360);
      const sat = control.saturation ?? Math.round((state.color.saturation / 65535) * 100);
      const bri = control.brightness ?? Math.round((state.color.brightness / 65535) * 100);
      const kelvin = control.kelvin ?? state.color.kelvin;

      // Convert back to 0-65535 range for the LIFX LAN protocol
      const hue65535 = Math.round((hue / 360) * 65535);
      const sat65535 = Math.round((sat / 100) * 65535);
      const bri65535 = Math.round((bri / 100) * 65535);

      // Set all color properties at once (required by LIFX LAN protocol)
      await new Promise<void>((resolve, reject) => {
        light.color(hue65535, sat65535, bri65535, kelvin, duration, () => resolve());
        setTimeout(() => reject(new Error("Control timeout")), 10000);
      });
    }
  }

  destroy(): void {
    if (this.client) {
      this.client.destroy();
    }
  }
}
