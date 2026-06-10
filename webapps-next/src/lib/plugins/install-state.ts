"use client";

// Runtime install state for managed plugins. The code is bundled at build
// time (v0 registry), so "installing" toggles availability — consumers gate
// their feature on this state and render nothing when not installed.

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "deepflow.plugins.installed";
const CHANGE_EVENT = "deepflow:plugins-changed";

type StateMap = Record<string, boolean>;

function read(): StateMap {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as StateMap;
  } catch {
    return {};
  }
}

export function isPluginInstalled(id: string, defaultEnabled = true): boolean {
  if (typeof window === "undefined") return defaultEnabled;
  return read()[id] ?? defaultEnabled;
}

export function setPluginInstalled(id: string, installed: boolean): void {
  const map = read();
  map[id] = installed;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Reactive install state — re-renders on install/uninstall (any tab). */
export function usePluginInstalled(id: string, defaultEnabled = true): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isPluginInstalled(id, defaultEnabled),
    () => defaultEnabled,
  );
}

/**
 * Reactive install state for a list of plugins in ONE hook call (safe to
 * derive from arrays without breaking the rules of hooks). Returns a "10…"
 * bitstring aligned with `entries`; check `key[i] === "1"`.
 */
export function useInstalledKey(entries: ReadonlyArray<{ id: string; defaultEnabled: boolean }>): string {
  return useSyncExternalStore(
    subscribe,
    () => entries.map((e) => (isPluginInstalled(e.id, e.defaultEnabled) ? "1" : "0")).join(""),
    () => entries.map((e) => (e.defaultEnabled ? "1" : "0")).join(""),
  );
}
