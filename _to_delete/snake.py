import sys,os
root=sys.argv[1]
def r(p,a,b):
    p=os.path.join(root,p); s=open(p).read(); assert s.count(a)==1,(p,a); open(p,'w').write(s.replace(a,b))
# Number Snake: a little more room for the arrows and Pause on short and notched phones.
r('src/playzone/NumberSnake.tsx',"Math.max(150, viewportHeight - 462)","Math.max(130, viewportHeight - 520)")
# Connect the Dots: the crayon box and Done fit on the smallest phones too.
r('src/playzone/DotToDot.tsx',"Math.max(colouring ? 140 : 200, screenHeight - 400 - reserve)","Math.max(colouring ? 120 : 200, screenHeight - 400 - reserve)")
print('ok')
