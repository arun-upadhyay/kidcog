import sys,os
root=sys.argv[1]
def r(p,a,b,c=1):
    p=os.path.join(root,p); s=open(p).read(); assert s.count(a)==c,(p,a,s.count(a)); open(p,'w').write(s.replace(a,b))
r('src/playzone/common.tsx',"export type GameKey = 'animals' | 'snake' | 'bubbles' | 'maze' | 'trace';","export type GameKey = 'animals' | 'snake' | 'bubbles' | 'maze' | 'trace' | 'dots';")
P='src/screens/PlayZoneScreen.tsx'
r(P,"import TraceDraw from '../playzone/TraceDraw';\n","import TraceDraw from '../playzone/TraceDraw';\nimport DotToDot from '../playzone/DotToDot';\nimport { defaultDotLevel } from '../playzone/dotPictures';\n")
r(P,"  { key: 'trace', emoji: '✏️', name: 'Trace & Draw', blurb: 'Write numbers and letters', background: '#FFE9E3', border: '#E88970', ink: '#A84733', unlockAfter: 3 },\n",
  "  { key: 'trace', emoji: '✏️', name: 'Trace & Draw', blurb: 'Write numbers and letters', background: '#FFE9E3', border: '#E88970', ink: '#A84733', unlockAfter: 3 },\n  { key: 'dots', emoji: '🖍️', name: 'Connect the Dots', blurb: 'Join 1, 2, 3… and a picture appears', background: '#E3F1FB', border: '#5B9BD0', ink: '#286A98', unlockAfter: 0, isNew: true },\n")
r(P,"  if (game === 'animals') return defaultAnimalLevel(age);\n","  if (game === 'animals') return defaultAnimalLevel(age);\n  if (game === 'dots') return defaultDotLevel(age);\n")
r(P,"        {playing === 'trace' ? <TraceDraw {...props} /> : null}\n","        {playing === 'trace' ? <TraceDraw {...props} /> : null}\n        {playing === 'dots' ? <DotToDot {...props} /> : null}\n")
W='src/screens/WelcomeScreen.tsx'
r(W,"  { key: 'trace', icon: '✏️', name: 'Trace & Draw', background: '#FFE9E3', border: '#E88970' },\n","  { key: 'trace', icon: '✏️', name: 'Trace & Draw', background: '#FFE9E3', border: '#E88970' },\n  { key: 'dots', icon: '🖍️', name: 'Connect the Dots', background: '#E3F1FB', border: '#5B9BD0' },\n")
r(W,"line: 'Snake, bubbles, mazes and tracing', icons: ['🐍', '🫧', '🦉', '✏️']","line: 'Snake, bubbles, mazes, tracing and dots', icons: ['🐍', '🫧', '🖍️', '✏️']")
r('src/screens/CategoryScreen.tsx',"Number Snake, Bubble Pop, mazes and tracing</Text>","Number Snake, Bubble Pop, mazes, tracing and dots</Text>")
E='e2e/flows.spec.ts'
r(E,"for (const name of ['Number Snake', 'Bubble Pop', 'Maze Runner', 'Trace & Draw']) {\n  test(","for (const name of ['Number Snake', 'Bubble Pop', 'Maze Runner', 'Trace & Draw', 'Connect the Dots']) {\n  test(")
r(E,"    if (name === 'Trace & Draw') await inViewport(page, page.getByRole('button', { name: /Skip/ }));\n","    if (name === 'Trace & Draw') await inViewport(page, page.getByRole('button', { name: /Skip/ }));\n    if (name === 'Connect the Dots') await inViewport(page, page.getByRole('button', { name: '↺ Start again', exact: true }));\n")
r(E,"    for (const name of ['Number Snake', 'Bubble Pop', 'Maze Runner', 'Trace & Draw']) {\n      await page","    for (const name of ['Number Snake', 'Bubble Pop', 'Maze Runner', 'Trace & Draw', 'Connect the Dots']) {\n      await page")
r(E,"import { test, expect, type Page, type Locator } from '@playwright/test';\n","import { test, expect, type Page, type Locator } from '@playwright/test';\nimport { DOT_PICTURES } from '../src/playzone/dotPictures';\n")
s=open(os.path.join(root,E)).read()
s+="""
test('Connect the Dots: wrong dots wiggle, joining every dot reveals the picture', async ({ page }) => {
  await games(page);
  await page.getByRole('button', { name: 'Play Connect the Dots', exact: true }).click();
  // The test child is 5, so the game starts on level 2: the heart comes first.
  const board = page.getByLabel(/^Dot board/);
  await expect(board).toHaveAccessibleName('Dot board. Next dot: 2');
  const box = (await board.boundingBox())!;
  const tap = ([x, y]: [number, number]) => page.mouse.click(box.x + (x / 100) * box.width, box.y + (y / 100) * box.height);
  const dots = DOT_PICTURES.heart!.dots;
  await tap(dots[5]!);
  await expect(board).toHaveAccessibleName('Dot board. Next dot: 2');
  for (const dot of dots.slice(1)) await tap(dot);
  await expect(page.getByText('❤️ Heart!', { exact: true })).toBeVisible();
  await inViewport(page, page.getByRole('button', { name: 'Next picture ▶', exact: true }));
  await page.getByRole('button', { name: 'Next picture ▶', exact: true }).click();
  await expect(page.getByLabel(/^Dot board/)).toHaveAccessibleName('Dot board. Next dot: 2');
});
"""
open(os.path.join(root,E),'w').write(s)
print('ok')
