import { App, TFile } from "obsidian";
import { Tray, TrayData } from "./trayModel";

const TRAY_FOLDER = "trays";

export async function ensureTrayFolder(app: App) {
  const folder = app.vault.getAbstractFileByPath(TRAY_FOLDER);
  if (!folder) {
    await app.vault.createFolder(TRAY_FOLDER);
  }
}

export async function saveTrayToNote(app: App, tray: TrayData): Promise<void> {
  const content = JSON.stringify(tray, null, 2);
  const filePath = `${TRAY_FOLDER}/${tray.uuid}.md`;
  await ensureTrayFolder(app);
  let file = app.vault.getAbstractFileByPath(filePath);
  if (!file) {
    await app.vault.create(filePath, content);
  } else if (file instanceof TFile) {
    await app.vault.modify(file, content);
  }
}

export async function loadTrayFromNote(app: App, uuid: string): Promise<Tray | null> {
  const filePath = `${TRAY_FOLDER}/${uuid}.md`;
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file || !(file instanceof TFile)) {
    return null;
  }
  const content = await app.vault.read(file);
  try {
    const tray = JSON.parse(content) as Tray;
    return tray;
  } catch (e) {
    console.error("Failed to parse tray:", e);
    return null;
  }
}
