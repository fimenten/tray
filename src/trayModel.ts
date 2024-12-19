export interface Tray {
    uuid: string;
    name: string;
    isFolded: boolean;
    borderColor: string;
    children: string[];
    lastModified: number;
    metaData: Record<string, any>;
    parentUuid: string | null; // added parentUuid
    deleted:boolean|null
    main:string|null
    flexDirection:"row"|"column"
    editingStart:boolean
  }
  