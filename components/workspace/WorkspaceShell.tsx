"use client";

import dynamic from "next/dynamic";

// XYFlow measures browser-only layout during startup. Its canvas is therefore
// intentionally mounted after hydration, preventing server/client markup drift.
const Workspace = dynamic(
  () => import("./Workspace").then((module) => module.Workspace),
  { ssr: false, loading: () => <main className="workspace" aria-label="Loading ReCan Flow" /> },
);

export function WorkspaceShell() { return <Workspace />; }
