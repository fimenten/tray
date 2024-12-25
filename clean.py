#!/usr/bin/env python3

import glob
import json
import os
import time

def normalize_tray(data: dict) -> dict:
    """
    Ensures 'data' has the shape of our updated Tray interface.
    """

    # 1) uuid: string
    uuid = data.get("uuid", "")
    if not isinstance(uuid, str):
        uuid = ""

    # 2) name: string
    name = data.get("name", "")
    if len(name)==0:
        return {}
    if not isinstance(name, str):
        name = ""

    # 3) isFolded: boolean
    is_folded = data.get("isFolded", False)
    if not isinstance(is_folded, bool):
        is_folded = False

    # 4) borderColor: string
    border_color = data.get("borderColor", "#000000")
    if not isinstance(border_color, str):
        border_color = "#000000"

    # 5) children: string[]
    children = data.get("children", [])
    if not isinstance(children, list):
        children = []
    else:
        # ensure each child is a string
        children = [child for child in children if isinstance(child, str)]

    # 6) lastModified: number
    last_modified = data.get("lastModified", time.time())
    # if it's not numeric, replace with current time
    if not isinstance(last_modified, (int, float)):
        last_modified = time.time()

    # 7) metaData: object
    meta_data = data.get("metaData", {})
    if not isinstance(meta_data, dict):
        meta_data = {}

    # 8) parentUuid: string[] | null | undefined
    # In Python, we'll treat both null and undefined as `None`
    parent_uuid = data.get("parentUuid", None)
    if isinstance(parent_uuid, list):
        # Ensure each is a string
        parent_uuid = [
            p for p in parent_uuid if isinstance(p, str)
        ]
    elif parent_uuid is not None:
        parent_uuid = None

    # 9) main: string | null
    main = data.get("main", None)
    if not (isinstance(main, str) or main is None):
        # If main is not string/null, set to null
        main = None

    # 10) flexDirection: "row" | "column"
    flex_direction = "column"
    # flex_direction = data.get("flexDirection", "row")
    # if flex_direction not in ("row", "column"):
    #     flex_direction = "column"

    # 11) editingStart: boolean
    editing_start = data.get("editingStart", False)
    if not isinstance(editing_start, bool):
        editing_start = False

    return {
        "uuid": uuid,
        "name": name,
        "isFolded": is_folded,
        "borderColor": border_color,
        "children": children,
        "lastModified": last_modified,
        "metaData": meta_data,
        "parentUuid": parent_uuid,
        "main": main,
        "flexDirection": flex_direction,
        "editingStart": editing_start,
    }


def main():
    TRAY_GLOB = "/home/tatsuya/Documents/Obsidian Vault/trays/*.md"
    files = glob.glob(TRAY_GLOB)

    print(f"Found {len(files)} tray files.")

    for file_path in files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            # Normalize data to our desired interface
            cleaned_data = normalize_tray(data)
            if not len(cleaned_data):
                os.remove(file_path)
                continue
            # Write back to the same file (overwrite)
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(cleaned_data, f, indent=2,ensure_ascii=False)

            print(f"Cleaned file: {file_path}")

        except Exception as e:
            print(f"Error handling file {file_path}: {e}")


if __name__ == "__main__":
    main()
