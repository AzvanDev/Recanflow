import { useEffect, useRef, useState } from "react";
import type { Edge } from "@xyflow/react";
import type { FlowNode } from "./types";

type Snapshot = { nodes: FlowNode[]; edges: Edge[] };

/**
 * Debounced undo/redo: rapid changes (e.g. a node drag firing many position
 * updates) settle into a single history entry 400ms after they stop, so one
 * undo reverts "the drag" rather than one pixel of it.
 */
export function useHistory(nodes: FlowNode[], edges: Edge[], setNodes: (nodes: FlowNode[]) => void, setEdges: (edges: Edge[]) => void) {
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const lastCommitted = useRef<Snapshot>({ nodes, edges });
  const skipNext = useRef(false);
  const [, setVersion] = useState(0);

  useEffect(() => {
    // Reference equality (not a "first render" flag) correctly no-ops React StrictMode's
    // double-invocation of this effect in dev, since it re-fires with the exact same arrays.
    if (nodes === lastCommitted.current.nodes && edges === lastCommitted.current.edges) return;
    if (skipNext.current) {
      skipNext.current = false;
      lastCommitted.current = { nodes, edges };
      return;
    }
    const timer = setTimeout(() => {
      past.current.push(lastCommitted.current);
      if (past.current.length > 100) past.current.shift();
      lastCommitted.current = { nodes, edges };
      future.current = [];
      setVersion((v) => v + 1);
    }, 400);
    return () => clearTimeout(timer);
  }, [nodes, edges]);

  function undo() {
    if (!past.current.length) return;
    const previous = past.current.pop()!;
    future.current.push(lastCommitted.current);
    skipNext.current = true;
    lastCommitted.current = previous;
    setNodes(previous.nodes);
    setEdges(previous.edges);
    setVersion((v) => v + 1);
  }

  function redo() {
    if (!future.current.length) return;
    const next = future.current.pop()!;
    past.current.push(lastCommitted.current);
    skipNext.current = true;
    lastCommitted.current = next;
    setNodes(next.nodes);
    setEdges(next.edges);
    setVersion((v) => v + 1);
  }

  return { undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
