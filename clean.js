#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// The "shape" we expect for our tray
// If any property is missing, we'll fill in a default.
// If a property is extra, we'll ignore it.
function normalizeTray(data) {
  return {
    uuid:        typeof data.uuid === 'string'        ? data.uuid        : '',
    name:        typeof data.name === 'string'        ? data.name        : '',
    isFolded:    typeof data.isFolded === 'boolean'   ? data.isFolded    : false,
    borderColor: typeof data.borderColor === 'string' ? data.borderColor : '#000000',
    children:    Array.isArray(data.children)         ? data.children    : [],
    lastModified: typeof data.lastModified === 'number'
                    ? data.lastModified
                    : Date.now(),
    metaData:    typeof data.metaData === 'object' && data.metaData !== null
                    ? data.metaData
                    : {},
    // Make sure parentUuid is either an array of strings, null, or undefined
    parentUuid: Array.isArray(data.parentUuid)
      ? data.parentUuid.map(item => (typeof item === 'string' ? item : ''))
      : null,
  };
}

const TRAY_GLOB = '/home/tatsuya/Documents/Obsidian Vault/trays/*.md';

// 1. Glob all JSON files under ./trays/
glob.glob(TRAY_GLOB, {}, (err, files) => {
  if (err) {
    console.error('Error while globbing files:', err);
    process.exit(1);
  }

  console.log(`Found ${files.length} tray files.`);

  // 2. For each file, read/parse JSON, then clean it up
  files.forEach(filePath => {
    try {
      // Read file
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);

      // 3. Normalize data to our desired interface
      const cleaned = normalizeTray(data);

      // 4. Write back to the same file (or a new file)
      fs.writeFileSync(
        filePath,
        JSON.stringify(cleaned, null, 2),
        'utf8'
      );

      console.log(`Cleaned file: ${filePath}`);
    } catch (err) {
      console.error(`Error handling file ${filePath}:`, err);
    }
  });
});
