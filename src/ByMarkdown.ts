import { Tray } from "./trayModel";


/**
 * Parses a Markdown-like string (using dashes and indentation) into an
 * array of `Tray` objects that form a hierarchical (tree/graph) structure.
 *
 * Example Markdown input:
 *   - Root 1
 *     - Child 1.1
 *       - GrandChild 1.1.1
 *     - Child 1.2
 *   - Root 2
 *
 * @param markdown The Markdown string to parse
 * @returns Tray[] An array of Trays. Each tray has its own parentUuid (array)
 *   and children array.
 */
export function parseMarkdownToTrays(markdown: string): Tray[] {
  // Utility: Count how many "indentation levels" a line has
  // Here, we assume every 2 leading spaces = 1 indent level
  const getIndentLevel = (line: string): number => {
    let count = 0;
    for (const ch of line) {
      if (ch === ' ') {
        count++;
      } else {
        break;
      }
    }
    // Adjust the divisor (2) if your indentation rule is different
    return Math.floor(count / 2);
  };

  // Split input into lines, ignoring empty lines
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trimEnd()) // remove trailing spaces
    .filter((line) => line.trim().length > 0);

  const trays: Tray[] = [];
  // We'll keep a stack of trays to handle hierarchy
  // stack[depth] = Tray at that depth
  const stack: Tray[] = [];

  for (const rawLine of lines) {
    // We still have the raw line with some leading spaces
    // to detect indentation level; so let's not "trimStart" it.
    const indentLevel = getIndentLevel(rawLine);

    // Extract the text after the dash
    // e.g. "    - My Tray Name" => "My Tray Name"
    // Adjust the regex if you have different patterns
    const match = rawLine.trim().match(/^-+\s*(.*)$/);
    if (!match) {
      // If a line doesn't match the pattern, skip or handle error
      continue;
    }
    const name = match[1].trim();

    // If our indent level is deeper than stack, we need to fix it
    // For example, if indentLevel = 2 but there's no item on stack at depth 1
    while (stack.length > indentLevel) {
      stack.pop();
    }

    // Create a new Tray
    const newTray: Tray = {
      uuid: crypto.randomUUID(), // or any other UUID generator
      name,
      isFolded: false,
      borderColor: '#000000',
      children: [],
      lastModified: Date.now(),
      metaData: {},
      parentUuid: null,
      main: null,
      flexDirection: 'column',
      editingStart: false,
      tags: null,
      watchTags: null,
    };

    // If there's a parent at the current indentLevel - 1, link them
    if (indentLevel > 0 && stack.length > 0) {
      const parent = stack[stack.length - 1];
      newTray.parentUuid = [parent.uuid];
      parent.children.push(newTray.uuid);
    }

    trays.push(newTray);
    stack.push(newTray);
  }

  return trays;
}
