// src/utils/trayHelpers.ts

import { Tray } from "../models/trayModel";

/** 
 * Return a random hex color string like "#A1B2C3".
 */
export function getRandomColor(): string {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

/**
 * Compare two arrays of strings for equality.
 */
export function arraysEqual(a: string[] | null, b: string[] | null) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((val, i) => val === b[i]);
}

/**
 * Given a tray.uuid (the root of the subtree),
 * fetch that tray and all its descendants from your store/database
 * and return them in a flattened array.
 */
export async function exportTraySubtree(
  rootUuid: string,
  loadTray: (uuid: string) => Promise<Tray | null>
): Promise<Tray[]> {
  const visited = new Map<string, Tray>();
  const stack = [rootUuid];

  while (stack.length > 0) {
    const currentUuid = stack.pop()!;
    if (visited.has(currentUuid)) continue;

    const currentTray = await loadTray(currentUuid);
    if (!currentTray) continue;

    visited.set(currentTray.uuid, { ...currentTray });

    // push children onto the stack
    for (const childUuid of currentTray.children) {
      if (!visited.has(childUuid)) {
        stack.push(childUuid);
      }
    }
  }

  // Return a list of all trays in this subtree
  return Array.from(visited.values());
}

/**
 * Given a list of trays (flattened subtree), return a *new* list of trays,
 * with fresh UUIDs. Also update the references in 'children' and 'parentUuid'.
 */
export function reassignUuidsAndTimestamps(trays: Tray[]): Tray[] {
  const uuidMap = new Map<string, string>();

  // First pass: create new copies with new UUIDs
  const newTrays = trays.map((oldTray) => {
    const newUuid = crypto.randomUUID();
    uuidMap.set(oldTray.uuid, newUuid);

    return {
      ...oldTray,
      uuid: newUuid,
      lastModified: Date.now(),
      editingStart: false,
    };
  });

  // Second pass: update all references in children[] and parentUuid[]
  newTrays.forEach((t) => {
    t.children = t.children.map((childUuid) => uuidMap.get(childUuid) || childUuid);
    t.parentUuid = t.parentUuid?.map((p) => uuidMap.get(p) || p);
  });

  return newTrays;
}

/**
 * The main function for "pasting" a subtree into the current parent tray.
 */
export async function importTraySubtree(
  subtreeData: string,
  onChildUpdate: (t: Tray) => Promise<void>,
  parentTray: Tray,
  onUpdate: (updatedTray: Tray) => void
): Promise<Tray | null> {
  let trays: Tray[];
  try {
    trays = JSON.parse(subtreeData) as Tray[];
  } catch (error) {
    console.error("Invalid JSON in clipboard:", error);
    return null;
  }
  if (!Array.isArray(trays) || trays.length === 0) return null;

  // Reassign new UUIDs
  const newTrays = reassignUuidsAndTimestamps(trays);

  // The first tray in the list we can consider as the root
  const newRootTray = newTrays[0];

  // Insert the subtree into the parent’s children
  onUpdate({
    ...parentTray,
    children: [newRootTray.uuid, ...parentTray.children],
    isFolded: false,
  });

  // Save all trays
  for (const t of newTrays) {
    await onChildUpdate(t);
  }

  return newRootTray;
}

/**
 * Deep copy of a tray subtree (exports JSON to clipboard).
 */
export async function handleDeepCopyTray(
  tray: Tray,
  loadTray: (uuid: string) => Promise<Tray | null>
) {
  const subtree = await exportTraySubtree(tray.uuid, loadTray);
  const text = JSON.stringify(subtree);
  await navigator.clipboard.writeText(text);
}

/**
 * Deep paste of a tray subtree (reads JSON from clipboard).
 */
export async function handleDeepPasteTray(
  tray: Tray,
  loadTray: (uuid: string) => Promise<Tray | null>,
  onChildUpdate: (child: Tray) => Promise<void>,
  onUpdate: (updatedTray: Tray) => void
) {
  const data = await navigator.clipboard.readText();
  await importTraySubtree(data, onChildUpdate, tray, onUpdate);
}
