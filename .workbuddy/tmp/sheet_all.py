import os, json
from PIL import Image, ImageDraw, ImageFont
base = r"D:/AI工作空间/YiMeng/YiMeng-Zpc.github.io/static/images/uploads/posts"
slugs = sorted(os.listdir(base))
TH, COLS, ROWS = 300, 5, 4
font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 24)
sheet = Image.new("RGB",(TH*COLS,(TH+30)*ROWS*2),(18,18,18))
d = ImageDraw.Draw(sheet)
pos = 0
for s in slugs:
    fs = sorted(os.listdir(os.path.join(base,s)))
    for f in fs:
        if pos >= COLS*ROWS*2: break
        im = Image.open(os.path.join(base,s,f)).convert("RGB")
        im.thumbnail((TH-8,TH-8))
        x=(pos%COLS)*TH+(TH-im.width)//2; y=(pos//COLS)*(TH+30)+(TH-im.height)//2
        sheet.paste(im,(x,y))
        d.text(((pos%COLS)*TH+6,(pos//COLS)*(TH+30)+TH+2), f"{s[:12]}/{f.replace('.webp','')}", fill=(255,215,0), font=font)
        pos+=1
sheet.save("all_posts.jpg",quality=80)
print("saved, total imgs:", pos, "slugs:", len(slugs))
