import os, json
from PIL import Image, ImageDraw, ImageFont
src = r"E:/图片/新疆/新疆禾木村、沙漠无人区、喀纳斯"
idx = json.load(open("hemu_index.json",encoding="utf-8"))
cands = [35,61,63,66,71,77,78,79,81,83,85,88,89,91,93,96,99,101,104,105,106,116,119,121,122,125]
TH, COLS, ROWS = 420, 4, 4
font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 30)
for s in range(0, len(cands), COLS*ROWS):
    chunk = cands[s:s+COLS*ROWS]
    sheet = Image.new("RGB",(TH*COLS,(TH+38)*ROWS),(18,18,18))
    d = ImageDraw.Draw(sheet)
    for i,n in enumerate(chunk):
        f = idx[str(n)]
        im = Image.open(os.path.join(src,f)).convert("RGB")
        im.thumbnail((TH-10,TH-10))
        x=(i%COLS)*TH+(TH-im.width)//2; y=(i//COLS)*(TH+38)+(TH-im.height)//2
        sheet.paste(im,(x,y))
        d.text(((i%COLS)*TH+10,(i//COLS)*(TH+38)+TH+6), f"#{n} {f.replace('.JPG','').replace('.jpg','')}", fill=(255,215,0), font=font)
    out=f"cand_{s//(COLS*ROWS)+1}.jpg"; sheet.save(out,quality=88); print("saved",out,chunk[0],"-",chunk[-1])
