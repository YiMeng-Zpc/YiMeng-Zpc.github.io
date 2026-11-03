import os
from PIL import Image, ImageDraw, ImageFont
base = r"D:/AI工作空间/YiMeng/YiMeng-Zpc.github.io/static/images/uploads/posts"
slugs = sorted(os.listdir(base))
TH, COLS, ROWS = 260, 6, 5
font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 20)
items=[]
for s in slugs:
    for f in sorted(os.listdir(os.path.join(base,s))):
        items.append((s,f))
print("total:",len(items))
per=COLS*ROWS
for pg in range(0,len(items),per):
    chunk=items[pg:pg+per]
    rows=(len(chunk)+COLS-1)//COLS
    sheet=Image.new("RGB",(TH*COLS,(TH+26)*rows),(18,18,18)); d=ImageDraw.Draw(sheet)
    for i,(s,f) in enumerate(chunk):
        im=Image.open(os.path.join(base,s,f)).convert("RGB"); im.thumbnail((TH-6,TH-6))
        x=(i%COLS)*TH+(TH-im.width)//2; y=(i//COLS)*(TH+26)+(TH-im.height)//2
        sheet.paste(im,(x,y))
        d.text(((i%COLS)*TH+5,(i//COLS)*(TH+26)+TH+2), f"{s[:14]}/{f.replace('.webp','')}", fill=(255,215,0), font=font)
    out=f"ap_{pg//per+1}.jpg"; sheet.save(out,quality=82); print("saved",out,chunk[0][0],"/",chunk[-1][0])
