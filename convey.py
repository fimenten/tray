import json
import datetime


# [{"uuid":"ae58e0e4-7dd1-4249-8e00-23c001266e0f","name":"","isFolded":false,
#   "borderColor":"#ccc","children":[],"lastModified":1736550666867,"metaData":{},"parentUuid":["6bd66184-2ddb-46d6-81c9-6f7faa22c659"],
#   "main":null,"flexDirection":"column","editingStart":false,"tags":[],"watchTags":[]}]
def convey(d:dict,ds:list):
    dd = {}
    ds.append(dd)
    dd["uuid"] = d["id"]
    dd["name"] =d["name"]
    dd["borderColor"] = d["borderColor"]
    dd["lastModified"] = int(datetime.datetime.fromisoformat(d["created_dt"]).timestamp()*1000)
    dd["parentUuid"] = [d["parentId"]]
    dd["flexDirection"] = "column"
    dd["isFolded"] = False
    dd["main"] = {}
    dd["metaData"] = {}
    dd["editingStart"] = False
    dd["tags"] = []
    dd["watchTags"] = []
    if d["children"]:
        dd["children"] = [a["id"] for a in d["children"]]
        for c in d["children"]:
            convey(c,ds)
        return ds
    else:
        return ds
import uuid
if __name__ =="__main__":
    with open("data/past2",mode="r") as f:
        s = f.read()
    # print(s)
    # print(convey(json.loads(s),[]))
    # print(json.dumps(convey(json.loads(s),[]),ensure_ascii=False))
    ds = convey(json.loads(s),[])
    ids = [d["uuid"] for d in ds]
    mapping = {str(i):str(uuid.uuid4()) for i in ids}
    dds = []
    # for d in ds:
        # d["uuid"] = mapping[d["uuid"]]
        # d["children"] = [mapping[str(c)] for c in d["children"]]
        # d["parentUuid"] = [mapping[str(c)] for c in d["parentUuid"]]
        # dds.append(d)
    print(json.dumps(ds,ensure_ascii=False))
    
