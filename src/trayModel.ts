export interface TrayData {
    uuid: string;
    name: string;
    borderColor: string;
    childrenUUids: string[];
    lastModified: number;
    metaData: Record<string, any>;
    // parentUuid: string[] | null
    main:string|null
  }
  
export interface Tray{
  parentId : string|null
  parentViewId:string|null
  viewUUid : string
  trayData :TrayData
  isFolded :boolean
  flexDirection:"row"|"column"
  editingStart:boolean

  // flexDirection:
}