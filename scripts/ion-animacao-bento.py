from PIL import Image,ImageDraw,ImageFont
import math,subprocess as sp,wave,struct
W,H=640,360
def render(t):
    im=Image.new('RGB',(W,H),'#b9e8ec');d=ImageDraw.Draw(im)
    e=d.ellipse;p=d.polygon;l=d.line
    for yy in range(145):
        q=yy/145
        d.line((0,yy,640,yy),fill=(int(147+56*q),int(210+29*q),int(231+8*q)))
    for hx,hy in [(34,232),(599,233)]:
        d.rounded_rectangle((hx-5,hy-63,hx+7,hy+22),radius=5,fill='#9d794e')
        for tx,ty in [(hx-14,hy-65),(hx+13,hy-77),(hx+20,hy-50)]:
            e((tx-28,ty-28,tx+28,ty+28),fill='#70a080')
    e((485,33,555,103),fill='#ffe283')
    for x,y in [(70,56),(255,75),(375,42)]:
        e((x,y,x+74,y+22),fill='#effbf4');e((x+20,y-10,x+53,y+23),fill='#effbf4')
    e((-150,157,450,390),fill='#93ca9a');e((280,147,860,393),fill='#80bd90')
    d.rectangle((0,235,640,360),fill='#79bb71')
    e((-60,262,710,420),fill='#a4cd77')
    for x,y in [(45,270),(580,259),(530,328),(85,333),(183,249),(415,320),(305,290)]:
        l((x-5,y-5,x,y,x+5,y-7),fill='#55945e',width=2)
        e((x+3,y-11,x+8,y-6),fill='#fff0a3')
    # Ball toss, return, a surprise bounce and a final leap.
    def interp(keys):
        for (a,v),(b,w) in zip(keys,keys[1:]):
            if t<=b:
                q=max(0,(t-a)/(b-a)); q=q*q*(3-2*q)
                return v+(w-v)*q
        return keys[-1][1]
    x=interp([(0,120),(5,120),(14,430),(16,430),(24,145),(30,145),(38,385),(41,440),(47,440),(54,170),(60,170)])
    bx=interp([(0,190),(5,190),(10,410),(14,500),(16,500),(24,82),(28,82),(31,208),(38,455),(41,510),(47,510),(54,107),(60,107)])
    by=interp([(0,266),(5,266),(7,116),(10,266),(11,212),(12,266),(13,241),(14,266),(16,266),(16.5,234),(24,234),(25,266),(31,266),(35,155),(38,266),(39.5,135),(41,207),(42,234),(54,234),(55,266)])
    moving=5<t<14 or 16<t<24 or 30<t<42 or 47<t<54
    direction=-1 if 16<=t<25 or 47<=t<55 else 1
    jump=abs(math.sin(t*12))*10 if moving else 2*math.sin(t*4)
    if 38.7<t<42: jump+=52*math.sin(math.pi*(t-38.7)/3.3)
    y=256-jump
    e((x-57,267,x+65,284),fill='#659b60');e((bx-12,273,bx+12,279),fill='#699f61')
    def box(x1,y1,x2,y2):
        a,b=x+direction*x1,x+direction*x2
        return (min(a,b),y+y1,max(a,b),y+y2)
    def oval(coords,col): e(box(*coords),fill=col)
    def stroke(coords,col,width):l([(x+direction*a,y+b) for a,b in coords],fill=col,width=width,joint='curve')
    swing=math.sin(t*13)*15 if moving else 0
    wag=math.sin(t*15)*10
    stroke([(-40,-9),(-58,-23+wag),(-66,-28+wag)],'#9f563e',10)
    for off,phase in [(-27,1),(18,-1)]:
        stroke([(off,0),(off+swing*phase,20)],'#a45c41',11)
        oval((off+swing*phase-7,15,off+swing*phase+10,25),'#e6ac72')
    oval((-46,-28,36,10),'#d98e57');oval((-36,-27,-9,5),'#b16b47')
    oval((12,-48,58,-8),'#e9a46a');oval((35,-30,68,-10),'#f9cc94')
    oval((13,-47,30,-18),'#914935');oval((60,-27,72,-18),'#382b30')
    if t%4<3.85: oval((44,-40,51,-32),'#2e2930')
    else: stroke([(44,-35),(51,-35)],'#2e2930',2)
    stroke([(53,-17),(58,-15),(63,-17)],'#814d40',2)
    if 16.5<=t<24 or 42<=t<54: bx=x-63;by=y-16
    e((bx-12,by-12,bx+12,by+12),fill='#f35e52',outline='#b94146',width=2)
    d.arc((bx-8,by-10,bx+8,by+9),20,130,fill='#ffe7ad',width=3)
    oval((14,-15,22,7),'#346d76')
    oval((20,-6,27,2),'#ffdd80')
    if 39<t<42:
        for k in range(3):
            ax=bx-30-k*12; ay=by+5+k*8
            l((ax-8,ay+4,ax,ay),fill='#fff1ad',width=2)
    if t<3.5 or t>56:
        title='Bento e a bola' if t<3.5 else 'Mais uma vez?'
        font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',29)
        d.rounded_rectangle((190,22,450,69),radius=18,fill='#fff4ce');d.text((320,45),title,font=font,anchor='mm',fill='#254650')
    if 25<t<30 or 41<t<47:
        z=.15*math.sin(math.pi*(t-(25 if t<30 else 41))/(5 if t<30 else 6))
        dx=int(640*z/2);dy=int(360*z/2)
        shift=int((x-320)*z)
        im=im.crop((dx+shift,dy,640-dx+shift,360-dy)).resize((640,360),Image.Resampling.BICUBIC)
    return im
if __name__ == "__main__":
    fps=24
    p=sp.Popen(['ffmpeg','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','640x360','-r',str(fps),'-i','-','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','saida/visual.mp4'],stdin=sp.PIPE)
    for i in range(60*fps): p.stdin.write(render(i/fps).tobytes())
    p.stdin.close()
    assert p.wait()==0
    rate=24000
    notes=[72,76,79,76,74,77,81,77,76,79,83,79,74,77,79,67]
    bass=[48,53,52,55]
    def tone(m,t,d):
        if t<0 or t>=d:return 0
        f=440*2**((m-69)/12)
        return min(t/.025,1)*math.exp(-4*t)*min((d-t)/.08,1)*(math.sin(2*math.pi*f*t)+.23*math.sin(4*math.pi*f*t))
    out=bytearray()
    for i in range(rate*60):
        t=i/rate;k=int(t/.375);q=int(t/1.5)
        v=.23*tone(notes[k%16],t-k*.375,.375)+.15*tone(bass[q%4],t-q*1.5,1.5)
        for hit in (5,10,11.9,14,25,31,38,41,55):
            u=t-hit
            if 0<=u<.30: v+=.20*math.sin(2*math.pi*(145*u-128*u*u))*math.exp(-20*u)
        v*=min(1,t/.4,(60-t)/1.2)
        out.extend(struct.pack('<h',int(v*23000)))
    with wave.open('saida/music.wav','wb') as w:
        w.setparams((1,2,rate,0,'NONE','not compressed'));w.writeframes(out)
