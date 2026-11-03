import os, json
src = r"E:/图片/新疆/新疆禾木村、沙漠无人区、喀纳斯"
files = sorted([f for f in os.listdir(src) if f.lower().endswith(('.jpg','.jpeg','.png'))])
out = {i+1: f for i, f in enumerate(files)}
json.dump(out, open("hemu_index.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)
for i in [1,25,29,30,31,33,35,36,40,44,48,60,61,70,77,78,79,80,81,84,85,86,89,91,96,100,104,105,106,116,119,121,122,126]:
    print(i, out[i])
