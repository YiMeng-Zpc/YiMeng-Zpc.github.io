import os, sys
from PIL import Image, ImageDraw, ImageFont
src = r"E:/图片/新疆/新疆禾木村、沙漠无人区、喀纳斯"
files = sorted(os.listdir(src))
files = [f for f in files if f.lower().endswith(('.jpg','.jpeg','.png'))]
print("总数:", len(files))
TH, COLS, ROWS = 300, 5, 4
per = COLS*ROWS
try:
    font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 26)
except: font = ImageFont.load_default()
for s in range(0, len(files), per):
    chunk = files[s:s+per]
    sheet = Image.new("RGB", (TH*COLS, (TH+34)*ROWS), (20,20,20))
    d = ImageDraw.Draw(sheet)
    for i, f in enumerate(chunk):
        try:
            im = Image.open(os.path.join(src,f)).convert("RGB")
            im.thumbnail((TH-8, TH-8))
            x = (i%COLS)*TH + (TH-im.width)//2
            y = (i//COLS)*(TH+34) + (TH-im.height)//2
            sheet.paste(im,(x,y))
        except Exception as e:
            print("ERR", f, e)
        idx = s+i+1
        d.text(((i%COLS)*TH+8, (i//COLS)*(TH+34)+TH+4), f"{idx}", fill=(255,220,0), font=font)
    out = f"hemu_sheet_{s//per+1}.jpg"
    sheet.save(out, quality=82)
    print("saved", out, [f for f in chunk][:1], "->", chunk[-1] if chunk else "")
