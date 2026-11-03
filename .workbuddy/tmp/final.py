import os, json
from PIL import Image, ImageDraw, ImageFont
src = r"E:/图片/新疆/新疆禾木村、沙漠无人区、喀纳斯"
idx = json.load(open("hemu_index.json",encoding="utf-8"))
picks = [35,89,93,104,77,85,79,121]
TH, COLS = 520, 4
font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 32)
sheet = Image.new("RGB",(TH*COLS,(TH+40)*2),(18,18,18))
d = ImageDraw.Draw(sheet)
for i,n in enumerate(picks):
    f = idx[str(n)]
    im = Image.open(os.path.join(src,f)).convert("RGB")
    im.thumbnail((TH-10,TH-10))
    x=(i%COLS)*TH+(TH-im.width)//2; y=(i//COLS)*(TH+40)+(TH-im.height)//2
    sheet.paste(im,(x,y))
    d.text(((i%COLS)*TH+10,(i//COLS)*(TH+40)+TH+8), f"#{n} {f}", fill=(255,215,0), font=font)
sheet.save("final8.jpg",quality=90); print("saved", picks)
