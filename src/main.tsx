import { Plugin, ItemView, WorkspaceLeaf, App } from "obsidian";
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Tray, TrayData } from "./trayModel";
import { loadTrayFromNote, saveTrayToNote, ensureTrayFolder } from "./trayIO";
import TrayComponent from "./TrayComponent";

export const ROOT_TRAY_UUID = "root-tray-uuid";

function TrayRootView({ app }: { app: App }) {
  const [tray, setTray] = useState<Tray | null>(null);
  const [focusUuid, setFocusUuid] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      await ensureTrayFolder(app);
      let loaded = await loadTrayFromNote(app, ROOT_TRAY_UUID);
      if (!loaded) {
        const data :TrayData = {
          uuid:ROOT_TRAY_UUID,
          name: "Root Tray",
          borderColor: "#ccc",
          childrenUUids: [],
          lastModified: Date.now(),
          metaData: {},
          main: null,
        }
        loaded = {
          viewUUid: ROOT_TRAY_UUID,
          parentId:null,
          parentViewId:null,
          trayData:data,
          isFolded: false,
          flexDirection: "row",
          editingStart:false

        };
        await saveTrayToNote(app, data);
      }
      setTray(loaded);
      setFocusUuid(loaded.viewUUid);
    })();
  }, [app]);

  const handleUpdate = async (updatedTray: Tray) => {
    await saveTrayToNote(app, updatedTray.trayData);
    // After saving, reload the root tray to reflect changes in the entire hierarchy
    const reloadedRoot = await loadTrayFromNote(app, ROOT_TRAY_UUID);
    if (reloadedRoot) {
      setTray(reloadedRoot);
    }
  };

  const onChildUpdate = async (child: Tray) => {
    await saveTrayToNote(app, child.trayData);
  };

  const loadTrayFn = async (uuid: string) => {
    return await loadTrayFromNote(app, uuid);
  };

  if (!tray) return <div>Loading...</div>;

  return (
    <TrayComponent
      tray={tray}
      onUpdate={handleUpdate}
      loadTray={loadTrayFn}
      onChildUpdate={onChildUpdate}
      focusUuid={focusUuid}
      setFocusUuid={setFocusUuid}
      editingStart={false}
    />
  );
}

class ReactView extends ItemView {
  static VIEW_TYPE = "react-tray-view";

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return ReactView.VIEW_TYPE;
  }

  getDisplayText(): string {
    return "React Tray View";
  }

  async onOpen() {
    const root = createRoot(this.containerEl);
    root.render(<TrayRootView app={this.app} />);
  }

  async onClose() {}
}

export default class MyPlugin extends Plugin {
  async onload() {
    this.registerView(ReactView.VIEW_TYPE, (leaf) => new ReactView(leaf));

    // Add a ribbon icon to open the React Tray View on click
    const ribbonIconEl = this.addRibbonIcon(
      "dice", // choose an icon that exists in Obsidian's icon set
      "Open React Tray View",
      async (evt: MouseEvent) => {
        const leaf = this.app.workspace.getRightLeaf(true);
        if (leaf) {
          // Set the view type to our React view
          await leaf.setViewState({ type: ReactView.VIEW_TYPE });
          this.app.workspace.revealLeaf(leaf);
        }
      }
    );

    // Optionally add a CSS class to the ribbon icon
    ribbonIconEl.addClass("my-plugin-ribbon-class");
  }
}
