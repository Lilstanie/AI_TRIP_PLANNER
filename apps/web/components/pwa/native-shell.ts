"use client";

export type NativeListener = { remove(): Promise<void> | void };

type CapacitorBridge = {
  PluginHeaders?: { name: string }[];
  nativePromise(plugin: string, method: string, options?: object): Promise<unknown>;
  addListener(plugin: string, event: string, callback: (data: unknown) => void): NativeListener;
};

export type NativePlugin = {
  call<T = unknown>(method: string, options?: object): Promise<T>;
  on(event: string, callback: (data: unknown) => void): NativeListener;
};

export function nativePlugin(name: string): NativePlugin | undefined {
  if (typeof document === "undefined" || document.documentElement.dataset.shell !== "ios-app")
    return undefined;
  const bridge = (globalThis as { Capacitor?: Partial<CapacitorBridge> }).Capacitor;
  if (!bridge?.nativePromise || !bridge.addListener) return undefined;
  if (!bridge.PluginHeaders?.some((header) => header.name === name)) return undefined;
  const { nativePromise, addListener } = bridge as CapacitorBridge;
  return {
    call: <T>(method: string, options: object = {}) =>
      nativePromise.call(bridge, name, method, options) as Promise<T>,
    on: (event, callback) => addListener.call(bridge, name, event, callback),
  };
}
