import wave, math, struct, random
from pathlib import Path
p=Path(__file__).resolve().parents[1] / 'assets' / 'music'; p.mkdir(exist_ok=True)
rng=random.Random(17)
for name,freq in zip(['c','d','e','f','g','a','b','high-c','kick','snare','hat'],[261.63,293.66,329.63,349.23,392,440,493.88,523.25,65,180,7000]):
 rate=22050; duration=.45 if freq<1000 else .13; data=[]
 for i in range(int(rate*duration)):
  t=i/rate; envelope=min(1,t/.008)*math.exp(-t*9)*(1-t/duration)
  value=math.sin(2*math.pi*freq*t)+.2*math.sin(4*math.pi*freq*t)
  if name=='kick': value=math.sin(2*math.pi*(65*t+2*(1-math.exp(-t*25))))
  if name in ['snare','hat']: value=rng.uniform(-1,1)
  data.append(struct.pack('<h',int(value*envelope*14000)))
 with wave.open(str(p/(name+'.wav')),'wb') as w: w.setparams((1,2,rate,0,'NONE','not compressed')); w.writeframes(b''.join(data))
