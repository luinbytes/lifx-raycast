import Lifx from "lifxjs";
import { LIFXLight, LightControl } from "./types";

export class LIFXHttpClient {
  private client: any;

  async initialize(apiToken: string): Promise<void> {
    if (!apiToken) {
      throw new Error("HTTP API token is required");
    }
    this.client = new Lifx();
    this.client.init({ appToken: apiToken });
  }

  async getLights(): Promise<LIFXLight[]> {
    const response = await this.client.get.all();

    return response.map((light: any) => ({
      id: light.id,
      label: light.label,
      power: light.power === "on",
      brightness: Math.round(light.brightness * 100),
      hue: Math.round(light.color.hue),
      saturation: Math.round(light.color.saturation * 100),
      kelvin: light.color.kelvin,
      connected: light.connected,
      source: "http" as const,
      reachable: light.reachable,
    }));
  }

  async control(lightId: string, control: LightControl): Promise<void> {
    const duration = (control.duration ?? 1000) / 1000; // Convert to seconds

    if (control.power !== undefined) {
      await this.client.power.light(lightId, control.power ? "on" : "off", duration);
    }

    if (
      control.hue !== undefined ||
      control.saturation !== undefined ||
      control.brightness !== undefined ||
      control.kelvin !== undefined
    ) {
      const colorConfig: any = { duration };

      if (control.hue !== undefined) colorConfig.hue = control.hue;
      if (control.saturation !== undefined) colorConfig.saturation = control.saturation / 100;
      if (control.brightness !== undefined) colorConfig.brightness = control.brightness / 100;
      if (control.kelvin !== undefined) colorConfig.kelvin = control.kelvin;

      await this.client.color.light(lightId, colorConfig);
    }
  }
}
