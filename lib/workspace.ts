import type { SavedWorkspace } from "./types";
import { WORKSPACE_VERSION } from "./types";

const KEY = "recan-flow-workspace-v2";

function emptyWorkspace(id = "local", name = "Untitled workspace"): SavedWorkspace {
  return { version: WORKSPACE_VERSION, id, name, nodes: [], edges: [], updatedAt: new Date().toISOString() };
}

function isSavedWorkspace(value: unknown): value is SavedWorkspace {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return item.version === WORKSPACE_VERSION && Array.isArray(item.nodes) && Array.isArray(item.edges) && typeof item.name === "string";
}

export function loadWorkspace(): SavedWorkspace {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isSavedWorkspace(parsed)) return parsed;
    }
  } catch {
    // fall through to a fresh workspace if the saved data is corrupted or from an older schema
  }
  return emptyWorkspace();
}

export function saveWorkspace(workspace: SavedWorkspace) {
  try {
    localStorage.setItem(KEY, JSON.stringify(workspace));
  } catch {
    // localStorage may be unavailable (private browsing, quota exceeded); the in-memory state still works
  }
}

export function newId(prefix = "node") {
  return `${prefix}-${crypto.randomUUID()}`;
}
