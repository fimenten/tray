import { Tray } from "./trayModel"

export const tagMapping : Map<string,string[]> = new Map()


export const initializeTagMap=(trays:Tray[])=>{
    console.log(tagMapping)

    trays.forEach((rootTray)=>{
    if (rootTray.tags){
        rootTray.tags.forEach((tag)=>{      
          const existingLists = tagMapping.get(tag)
          if (existingLists&&existingLists.includes(rootTray.uuid)){}else{
            const newe = tagMapping.get(tag) ? tagMapping.get(tag)?.concat([rootTray.uuid]) as string[]: [rootTray.uuid];
            tagMapping.set(tag,newe)
          }
      })
    }
console.log(tagMapping)
})
}

export const removeFromTagMap =(tray:Tray,removed:string[])=>{
  removed.forEach(tag=>{
    const before = tagMapping.get(tag)
    const after = before? before.filter(t=>t!=tray.uuid):[]
    tagMapping.set(tag,after)
  })

}



export const onUpdateTags=(tray:Tray,before_tag:string[] =[])=>{
    console.log("asdfasdf")
    initializeTagMap([tray])
    const subed = tray.tags ? before_tag.filter(tag=>{!tray.tags?.includes(tag)}):[]
    removeFromTagMap(tray,subed)
}





[{"uuid":"6fa1c462-39b8-47b9-ae87-3b5b5192c52e","name":"test","isFolded":false,"borderColor":"#ccc","children":[],"lastModified":1735369450861,"metaData":{},"parentUuid":["81893f52-a8d8-4957-88ab-319ca6e9a169"],"main":null,"flexDirection":"column","editingStart":false,"tags":[],"watchTags":["開発"]}]