"""Side-by-side concept comparisons; never treat a pixel/color metric as art sign-off."""
import json,sys
from pathlib import Path
from PIL import Image,ImageDraw,ImageStat
root=Path(sys.argv[1]); rows=[]
regions={'roof_left':(100,480,270,620),'architecture_left':(220,145,310,215),'upper_city':(430,145,1050,265)}
for sky in ('day','sunset','night'):
    reference=Image.open(f'docs/tokyo/images/concept-{sky}.webp').convert('RGB').resize((1280,760))
    actual=Image.open(root/f'desktop-{sky}.png').convert('RGB')
    board=Image.new('RGB',(2560,800),'#101629');draw=ImageDraw.Draw(board)
    draw.text((15,12),'APPROVED CONCEPT — '+sky.upper(),fill='white')
    draw.text((1295,12),'CURRENT APP — '+sky.upper(),fill='white')
    board.paste(reference,(0,40));board.paste(actual,(1280,40));board.save(root/f'compare-{sky}.webp',quality=92)
    for region,bounds in regions.items():
        means=[]
        for image in (reference,actual):
            crop=image.crop(bounds)
            rgb=ImageStat.Stat(crop).mean
            hsv=ImageStat.Stat(crop.convert('HSV')).mean
            means.append({'rgb':[round(x) for x in rgb],'mean_saturation':round(hsv[1]/255,3)})
        rows.append({'sky':sky,'region':region,'concept':means[0],'app':means[1]})
(root/'concept-color-diagnostics.json').write_text(json.dumps(rows,indent=2))
