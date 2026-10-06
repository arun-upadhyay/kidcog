import sys,os
p=os.path.join(sys.argv[1],'e2e/flows.spec.ts'); s=open(p).read()
a="""  await tap(dots[5]!);
  await expect(board).toHaveAccessibleName('Dot board. Next dot: 2');
"""
b="""  await tap(dots[5]!);
  await expect(board).toHaveAccessibleName('Dot board. Next dot: 2');
  await page.waitForTimeout(400); // let the "not that one" wiggle finish before measuring taps again
"""
assert s.count(a)==1; open(p,'w').write(s.replace(a,b)); print('ok')
