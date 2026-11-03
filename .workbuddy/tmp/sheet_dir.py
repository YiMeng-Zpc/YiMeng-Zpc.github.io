import os, sys
from PIL import Image, ImageDraw, ImageFont
src = sys.argv[1]; tag = sys.argv[2]
TH, COLS, ROWS = 250, 6, 5
files = sorted([f for f in os.listdir(src) if f.lower().endswith(('.jpg','.jpeg','.png'))])
font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 20)
per = COLS*ROWS
print(tag, "total:", len(files))
for pg in range(0,len(files),per):
    chunk = files[pg:pg+per]
    rows=(len(chunk)+COLS-1)//COLS
    sheet=Image.new("RGB",(TH*COLS,(TH+26)*rows),(18,18,18)); d=ImageDraw.Draw(sheet)
    for i,f in enumerate(chunk):
        try:
            im=Image.open(os.path.join(src,f)).convert("RGB"); im.thumbnail((TH-6,TH-6))
            x=(i%COLS)*TH+(TH-im.width)//2; y=(i//COLS)*(TH+26)+(TH-im.height)//2
            sheet.paste(im,(x,y))
        except Exception as e: print("ERR",f,e)
        d.text(((i%COLS)*TH+5,(i//COLS)*(TH+26)+TH+2), f"{pg+i+1} {f.replace('.JPG','').replace('.jpg','')}", fill=(255,215,0), font=font)
    out=f"d_{tag}_{pg//per+1}.jpg"; sheet.save(out,quality=82); print("saved",out,pg+1,"-",pg+len(chunk))
