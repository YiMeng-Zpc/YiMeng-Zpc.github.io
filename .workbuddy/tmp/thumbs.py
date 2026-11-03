import os
from PIL import Image
base = r"D:/AI工作空间/YiMeng/YiMeng-Zpc.github.io/static/images/uploads/posts"
n=0
for s in sorted(os.listdir(base)):
    d = os.path.join(base,s)
    for f in sorted(os.listdir(d)):
        if not f.endswith(".webp") or f.endswith("-sm.webp"): continue
        p = os.path.join(d,f)
        t = p[:-5]+"-sm.webp"
        if os.path.exists(t): continue
        im = Image.open(p).convert("RGB")
        im.thumbnail((800,800), Image.LANCZOS)
        im.save(t,"WEBP",quality=72,method=6)
        n+=1
print("生成缩略图:",n)
