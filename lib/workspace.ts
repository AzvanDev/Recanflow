import type { SavedWorkspace } from "./types";
import { WORKSPACE_VERSION } from "./types";

const INDEX_KEY = "recan-flow-workspaces-index";
const ACTIVE_KEY = "recan-flow-active-workspace";
const dataKey = (id: string) => `recan-flow-workspace-data-${id}`;
const LEGACY_KEY = "recan-flow-workspace-v2";

export type WorkspaceSummary = { id: string; name: string; updatedAt: string };

function newId(prefix = "id") {
  return `${prefix}-${crypto.randomUUID()}`;
}

function emptyWorkspace(id: string, name: string): SavedWorkspace {
  return { version: WORKSPACE_VERSION, id, name, nodes: [], edges: [], updatedAt: new Date().toISOString() };
}

function isSavedWorkspace(value: unknown): value is SavedWorkspace {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return item.version === WORKSPACE_VERSION && Array.isArray(item.nodes) && Array.isArray(item.edges) && typeof item.name === "string";
}

function readIndex(): WorkspaceSummary[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((w): w is WorkspaceSummary => w && typeof w.id === "string" && typeof w.name === "string" && typeof w.updatedAt === "string");
  } catch {
    return [];
  }
}

function writeIndex(index: WorkspaceSummary[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // localStorage may be unavailable (private browsing, quota exceeded)
  }
}

/** One-time migration from the old single-workspace key into the new multi-workspace scheme. */
function migrateLegacyWorkspace(): SavedWorkspace | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isSavedWorkspace(parsed)) return null;
    const id = parsed.id && parsed.id !== "local" && parsed.id !== "demo" ? parsed.id : newId("workspace");
    const migrated: SavedWorkspace = { ...parsed, id };
    localStorage.setItem(dataKey(id), JSON.stringify(migrated));
    return migrated;
  } catch {
    return null;
  }
}

export function listWorkspaces(): WorkspaceSummary[] {
  const index = readIndex();
  if (index.length > 0) return index.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const migrated = migrateLegacyWorkspace();
  if (migrated) {
    const entry = { id: migrated.id, name: migrated.name, updatedAt: migrated.updatedAt };
    writeIndex([entry]);
    localStorage.setItem(ACTIVE_KEY, migrated.id);
    return [entry];
  }
  return [];
}

export function getActiveWorkspaceId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function setActiveWorkspaceId(id: string) {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // ignore
  }
}

/** Loads the active workspace, migrating legacy data or creating a fresh one if none exists yet. */
export function loadWorkspace(): SavedWorkspace {
  const index = listWorkspaces(); // also runs migration as a side effect
  const activeId = getActiveWorkspaceId();
  const targetId = activeId && index.some((w) => w.id === activeId) ? activeId : index[0]?.id;
  if (targetId) {
    try {
      const raw = localStorage.getItem(dataKey(targetId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isSavedWorkspace(parsed)) {
          setActiveWorkspaceId(targetId);
          return parsed;
        }
      }
    } catch {
      // fall through to creating a fresh workspace below
    }
  }
  const fresh = emptyWorkspace(newId("workspace"), "Untitled workspace");
  saveWorkspace(fresh);
  setActiveWorkspaceId(fresh.id);
  return fresh;
}

export function saveWorkspace(workspace: SavedWorkspace) {
  try {
    localStorage.setItem(dataKey(workspace.id), JSON.stringify(workspace));
    const index = readIndex().filter((w) => w.id !== workspace.id);
    index.push({ id: workspace.id, name: workspace.name, updatedAt: workspace.updatedAt });
    writeIndex(index);
  } catch {
    // localStorage may be unavailable (private browsing, quota exceeded); the in-memory state still works
  }
}

export function createWorkspace(name = "Untitled workspace"): SavedWorkspace {
  const workspace = emptyWorkspace(newId("workspace"), name);
  saveWorkspace(workspace);
  setActiveWorkspaceId(workspace.id);
  return workspace;
}

/** Switches the active workspace and returns its data, for the caller to load into state. */
export function switchWorkspace(id: string): SavedWorkspace | null {
  try {
    const raw = localStorage.getItem(dataKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isSavedWorkspace(parsed)) return null;
    setActiveWorkspaceId(id);
    return parsed;
  } catch {
    return null;
  }
}

/** Deletes a workspace. If it was active, the caller should load whatever this returns next. */
export function deleteWorkspace(id: string): SavedWorkspace {
  try {
    localStorage.removeItem(dataKey(id));
  } catch {
    // ignore
  }
  const remaining = readIndex().filter((w) => w.id !== id);
  writeIndex(remaining);
  const wasActive = getActiveWorkspaceId() === id;
  if (!wasActive && remaining.length > 0) {
    // still need something to return; load current active if it still exists
    const activeId = getActiveWorkspaceId();
    const current = activeId ? switchWorkspace(activeId) : null;
    if (current) return current;
  }
  if (remaining.length > 0) {
    const next = switchWorkspace(remaining[0].id);
    if (next) return next;
  }
  return createWorkspace();
}

export { newId };
