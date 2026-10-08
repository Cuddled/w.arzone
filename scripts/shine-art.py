"""Original procedural material artwork. No screenshots or user content are used."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parent.parent
out=root/'assets/shine-motion'; out.mkdir(exist_ok=True)
w,h=720,1440
Y,X=np.mgrid[0:h,0:w]; x=X/w; y=Y/h
rng=np.random.default_rng(406)
base=np.zeros((h,w,3),float)+np.array([7,9,17])
def glow(a,dist,color,width,power=1):
    a+=np.exp(-np.square(dist/width))[:,:,None]*np.array(color)*power
art={}
a=base.copy()
# Folded chrome ribbons along the outer rim: narrow bright reflections, broad dark troughs.
for center,side in [(0.01,1),(.99,-1)]:
    ribbon=center+side*(.035+.07*np.sin(y*7)+.035*np.sin(y*19))
    d=x-ribbon
    for shift,width,color in [(0,.046,[56,62,70]),(.015*side,.010,[200,209,215]),(-.021*side,.003,[236,245,255]),(.041*side,.017,[35,44,58])]:
        glow(a,d-shift,color,width)
for cy in [.09,.91]:
    d=np.sqrt(((x-.5)/.74)**2+((y-cy)/.11)**2)-1
    glow(a,d,[100,110,126],.15); glow(a,d-.06,[150,166,180],.018)
art['mercury']=a
# Spectral refraction, with a calm ink center.
a=base.copy()
for side in [0,1]:
    d=x-(side+(.045 if side==0 else -.045)*np.sin(y*10))
    for j,c in enumerate([[90,80,250],[210,40,190],[35,175,225],[75,230,195]]):
        glow(a,d+(j-1.5)*.013,c,.018,power=.65)
for cy in [.04,.97]:
    d=y-cy+.024*np.sin(x*9)
    for j,c in enumerate([[80,190,245],[230,50,160],[150,100,245]]): glow(a,d+j*.006,c,.008,power=.65)
a+=np.exp(-((x-.12)**2/.015+(y-.22)**2/.05))[:,:,None]*[30,13,58]
art['prism']=a
# Continuous thin light trails; no flashing or full-screen strobes.
a=base.copy()
for side,c in [(0,[18,177,225]),(1,[220,25,135])]:
    for j in range(3):
        path=side+(.06 if side==0 else -.06)+.03*np.sin(y*11+j*.6)
        glow(a,x-path,c,.025,power=.15); glow(a,x-path,c,.0025,power=.85)
for cy,c in [(.08,[220,25,140]),(.95,[30,190,225])]:
    d=y-cy-.045*np.sin(x*5)
    glow(a,d,c,.018,power=.15); glow(a,d,c,.0016,power=.8)
art['afterimage']=a
# Bioluminescent translucent bells and fine trailing tentacles.
a=base.copy()+[5,0,11]
for cx,cy,size,col in [(.15,.19,.12,[85,45,205]),(.88,.48,.11,[20,140,175]),(.2,.83,.1,[155,40,145]),(.84,.92,.06,[65,75,200])]:
    dx=(x-cx)/size; dy=(y-cy)/(size*.48)
    radius=np.sqrt(dx*dx+dy*dy)
    mask=(dy<.3)
    glow(a,radius-1,col,.18,power=.65)
    a+=np.exp(-radius**2)[:,:,None]*np.array(col)*.17
    for j in range(7):
        tx=cx+(j-3)*size*.22+.008*np.sin((y-cy)*65+j)
        trail=np.exp(-((x-tx)/.0017)**2)*((y>cy)&(y<cy+size*1.6))*np.maximum(0,1-(y-cy)/(size*1.6))
        a+=trail[:,:,None]*np.array(col)*.55
for _ in range(32):
    cx,cy=rng.random(2); glow(a,np.sqrt((x-cx)**2+(y-cy)**2),[30,70,90],.002,power=.5)
art['jellyfish']=a
for name,a in art.items():
    a=np.clip(a,0,255).astype('uint8'); Image.fromarray(a).save(out/(name+'.jpg'),quality=86,optimize=True)
# A separate illustrative preview; the plugin keeps Discord's own layout.
canvas=Image.new('RGB',(1440,1640),'#070911'); draw=ImageDraw.Draw(canvas)
fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font=ImageFont.truetype(fontpath,22); small=ImageFont.truetype(fontpath,17); title=ImageFont.truetype(fontpath,30)
for i,name in enumerate(art):
    ox=(i%2)*720; oy=(i//2)*820
    im=Image.open(out/(name+'.jpg')).resize((340,680)); canvas.paste(im,(ox+190,oy+85))
    draw.text((ox+190,oy+30),name.upper(),font=title,fill='#eef2ff')
    draw.rounded_rectangle((ox+200,oy+110,ox+520,oy+161),14,fill='#111523',outline='#394050')
    draw.text((ox+219,oy+125),'‹   Messages                  ⌕',font=small,fill='#dee4f0')
    for j,(who,msg) in enumerate([('kittenk','this looks unreal'),('kev','the reflections move?'),('kittenk','yeah, slowly ✧'),('kev','clean. keep it.')]):
        yy=oy+222+j*95
        draw.ellipse((ox+211,yy,ox+239,yy+28),fill=['#9788ca','#659cab'][j%2])
        draw.text((ox+252,yy),who,font=small,fill='#ecf0ff')
        draw.text((ox+252,yy+30),msg,font=small,fill='#b6bdce')
    draw.rounded_rectangle((ox+205,oy+680,ox+515,oy+735),16,fill='#151a2b',outline='#414658')
    draw.text((ox+226,oy+698),'+   Message…',font=small,fill='#bbc1d4')
canvas.save(out/'preview.jpg',quality=90)
print({n:(out/(n+'.jpg')).stat().st_size for n in art})
