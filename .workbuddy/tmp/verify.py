import os
from PIL import Image, ImageDraw, ImageFont
base = r"D:/AI工作空间/YiMeng/YiMeng-Zpc.github.io/static/images/uploads/posts"
slugs=["hemu-snow","azerbaijan-baku","japan-travel","kazakhstan-almaty","xinjiang-wind-city"]
TH,COLS=430,4
font=ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf",26)
for s in slugs:
    fs=sorted([f for f in os.listdir(os.path.join(base,s)) if f.endswith(".webp") and not f.endswith("-sm.webp")])
    rows=(len(fs)+COLS-1)//COLS
    sheet=Image.new("RGB",(TH*COLS,(TH+34)*rows),(18,18,18)); d=ImageDraw.Draw(sheet)
    for i,f in enumerate(fs):
        im=Image.open(os.path.join(base,s,f)).convert("RGB"); im.thumbnail((TH-8,TH-8))
        x=(i%COLS)*TH+(TH-im.width)//2; y=(i//COLS)*(TH+34)+(TH-im.height)//2
        sheet.paste(im,(x,y))
        d.text(((i%COLS)*TH+6,(i//COLS)*(TH+34)+TH+4), f"{s[:16]}/{f.replace('.webp','')}", fill=(255,215,0), font=font)
    sheet.save(f"v_{s}.jpg",quality=86); print("saved",f"v_{s}.jpg")
