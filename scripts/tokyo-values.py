"""Create value/squint review sheets; Pillow required. Numeric contrast is diagnostic, not art sign-off."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageFilter, ImageOps, ImageStat, ImageDraw
root=Path(sys.argv[1])
metrics=[]
for device in ('desktop','phone'):
    sheets=[]
    for sky in ('day','sunset','night'):
        path=root/f'{device}-{sky}.png'
        if not path.exists(): continue
        im=Image.open(path).convert('RGB')
        gray=ImageOps.grayscale(im)
        gray.save(root/f'{device}-{sky}-values.png')
        thumb=gray.resize((160,round(im.height*160/im.width)),Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))
        thumb.save(root/f'{device}-{sky}-squint.png')
        sheets.append(thumb)
        cd=(500,290,660,440) if device=='desktop' else (120,300,230,410)
        bg=(500,170,660,260) if device=='desktop' else (120,200,230,260)
        histogram=gray.histogram(); total=sum(histogram)
        def quantile(q):
            n=0
            for i,count in enumerate(histogram):
                n+=count
                if n>=total*q: return i
        metrics.append({'device':device,'sky':sky,'p05':quantile(.05),'p95':quantile(.95),'cd_mean':round(ImageStat.Stat(gray.crop(cd)).mean[0],1),'background_mean':round(ImageStat.Stat(gray.crop(bg)).mean[0],1)})
    if sheets:
        sheet=Image.new('L',(len(sheets)*160,max(x.height for x in sheets)),255)
        for i,im in enumerate(sheets): sheet.paste(im,(i*160,0))
        sheet.save(root/f'{device}-squint-sheet.png')
signs=sorted(root.glob('sign-*.png'))
if signs:
    sheet=Image.new('RGB',(len(signs)*128,512),'#ffffff')
    for i,path in enumerate(signs): sheet.paste(Image.open(path).convert('RGB').resize((128,512)),(i*128,0))
    sheet.save(root/'sign-proof.png')
(root/'values.json').write_text(json.dumps(metrics,indent=2))
print(json.dumps(metrics))
