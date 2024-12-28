export interface Tray {
    uuid: string;
    name: string;
    isFolded: boolean;
    borderColor: string;
    children: string[];
    lastModified: number;
    metaData: Record<string, any>;
    parentUuid: string[] | null|undefined; // added parentUuid
    main:string|null
    flexDirection:"row"|"column"
    editingStart:boolean
    tags:string[] |null
    watchTags:string[]|null
  }
  


  