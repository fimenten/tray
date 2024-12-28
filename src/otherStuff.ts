// otherStuff.ts
import { Tray } from "./trayModel";

/** Utility function: getRandomColor */
export const getRandomColor = (): string => {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

/** Utility function: check if arrays are equal */
export const arraysEqual = (a: string[] | null, b: string[] | null): boolean => {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((val, i) => val === b[i]);
};

/** Export sub-tree from a given root. */
export const exportTraySubtree = async (
  rootUuid: string,
  loadTray: (uuid: string) => Promise<Tray | null>
): Promise<Tray[]> => {
  const visited = new Map<string, Tray>();
  const stack = [rootUuid];

  while (stack.length) {
    const currentUuid = stack.pop()!;
    if (visited.has(currentUuid)) continue;
    const currentTray = await loadTray(currentUuid);
    if (!currentTray) continue;
    visited.set(currentTray.uuid, { ...currentTray });
    currentTray.children.forEach((childUuid) => {
      if (!visited.has(childUuid)) {
        stack.push(childUuid);
      }
    });
  }
  return [...visited.values()];
};

/** Reassign UUIDs and remove editing flags. */
export const reassignUuidsAndTimestamps = (trays: Tray[]): Tray[] => {
  const uuidMap = new Map<string, string>();

  const newTrays = trays.map((oldTray) => {
    const newUuid = crypto.randomUUID();
    uuidMap.set(oldTray.uuid, newUuid);
    return {
      ...oldTray,
      uuid: newUuid,
      editingStart: false,
    };
  });

  newTrays.forEach((t) => {
    t.children = t.children.map((childUuid) => uuidMap.get(childUuid) || childUuid);
    t.parentUuid = t.parentUuid?.map((p) => uuidMap.get(p) || p);
  });

  return newTrays;
};

/** Import/paste sub-tree into the given parent tray. */
export const importTraySubtree = async (
  subtreeData: string,
  onChildUpdate: (t: Tray) => Promise<void>,
  parentTray: Tray,
  onUpdate: (updatedTray: Tray) => void
): Promise<Tray | null> => {
  try {
    const trays = JSON.parse(subtreeData) as Tray[];
    if (!Array.isArray(trays) || trays.length === 0) return null;
    let newTrays;
    if (trays.length==1&&trays[0].children.length!=0)

    {
    //   // traysが一つのとき、子がいないならばDeepCopy、、、ってのも乱暴か。やめた
    // いやそうでもねえか。
      newTrays = trays
    }
    else{
      newTrays = reassignUuidsAndTimestamps(trays);
    }
    // const  newTrays = reassignUuidsAndTimestamps(trays);

    const newRootTray = newTrays[0]
    const newParents = [...newRootTray.parentUuid as string[],parentTray.uuid]
    newRootTray.parentUuid = newParents
    
    // onUpdate({...newRootTray,parentUuid:newParents})



    onUpdate({
      ...parentTray,
      children: [newRootTray.uuid, ...parentTray.children],
      isFolded: false,
    });

  

    for (const t of newTrays) {
      await onChildUpdate(t);
    }
    return newRootTray;
  } catch (error) {
    console.error("Invalid JSON in clipboard:", error);
    return null;
  }
};

/** Deep copy a tray subtree and write JSON to clipboard. */
export const handleDeepCopyTray = async (
  tray: Tray,
  loadTray: (uuid: string) => Promise<Tray | null>
) => {
  const subtree = await exportTraySubtree(tray.uuid, loadTray);
  const text = JSON.stringify(subtree);
  await navigator.clipboard.writeText(text);
};

/** Deep paste a subtree from clipboard into current tray. */
export const handleDeepPasteTray = async (
  tray: Tray,
  loadTray: (uuid: string) => Promise<Tray | null>,
  onChildUpdate: (child: Tray) => Promise<void>,
  onUpdate: (updatedTray: Tray) => void
) => {
  const data = await navigator.clipboard.readText();
  await importTraySubtree(data, onChildUpdate, tray, onUpdate);
};

export const trayFixingFamilyProblem = async (
  tray: Tray,
  loadTray: (uuid: string) => Promise<Tray | null>,
  onUpdate: (updateTray: Tray) => void
) => {
  // 1) Resolve children trays
  const childrenParentRecognises = await Promise.all(
    tray.children.map((uuid) => loadTray(uuid))
  );

  // Filter out any null trays
  const validChildren = childrenParentRecognises.filter(
    (childTray): childTray is Tray => childTray !== null
  );

  // Now we can safely filter and forEach on real Tray objects
  validChildren
    // Keep only those children who do not already list 'tray.uuid' in their parentUuid
    .filter((childTray) => !(childTray.parentUuid?.includes(tray.uuid)))
    .forEach((childTray) => {
      const newParents = childTray.parentUuid
        ? [...childTray.parentUuid, tray.uuid]
        : [tray.uuid]; // Could also be []
      onUpdate({ ...childTray, parentUuid: newParents });
    });

  // 2) Resolve parent trays
  const meThinkingParents = tray.parentUuid
    ? await Promise.all(tray.parentUuid.map((uuid) => loadTray(uuid)))
    : [];

  // Filter out any null parent trays
  const validParents = meThinkingParents.filter(
    (parentTray): parentTray is Tray => parentTray !== null
  );

  // Now we can do the forEach on the real parent trays
  validParents.forEach((parentTray) => {
    // Check if the parentTray already includes 'tray.uuid' in its children
    const parentRegard = parentTray.children.includes(tray.uuid);
    if (!parentRegard) {
      const newChildrenForParent = [...parentTray.children, tray.uuid];
      onUpdate({ ...parentTray, children: newChildrenForParent });
    }
  });
  await Promise.all(validChildren.map(t=>trayFixingFamilyProblem(t,loadTray,onUpdate)))


};
