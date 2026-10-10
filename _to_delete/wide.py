import sys,os,re
root=sys.argv[1]  # app dir
def r(p,a,b,c=1):
    p=os.path.join(root,p); s=open(p).read(); assert s.count(a)==c,(p,a,s.count(a)); open(p,'w').write(s.replace(a,b))

T='src/theme.ts'
r(T,"import type { TextStyle } from 'react-native';","import { Platform, type TextStyle } from 'react-native';")
r(T,"""export const CONTENT_MAX_WIDTH = 760;
export const column = { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' } as const;""",
"""export const CONTENT_MAX_WIDTH = 760;
/**
 * In a web browser on a computer, the home screens (players, activities, Play
 * Zone and the top bar) use up to 80% of a wide window, up to 1600px, so a big
 * screen isn't mostly empty. Phones and tablets are unchanged. Reading screens
 * (questions, results, sign-in, legal pages, the games) keep `readingColumn`,
 * because very long lines are hard to read and to follow aloud.
 */
export const WIDE_MAX_WIDTH = 1600;
const wideWeb = Platform.OS === 'web';
/** The column's width in pixels for a window this wide (for layouts that count columns). */
export function contentMaxWidth(windowWidth: number): number {
  return wideWeb ? Math.max(CONTENT_MAX_WIDTH, Math.min(Math.round(windowWidth * 0.8), WIDE_MAX_WIDTH)) : CONTENT_MAX_WIDTH;
}
export const readingColumn = { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' } as const;
export const column = (wideWeb
  // CSS works out the same width as contentMaxWidth(), and follows window resizes.
  ? { width: '100%', maxWidth: `max(${CONTENT_MAX_WIDTH}px, min(80vw, ${WIDE_MAX_WIDTH}px))`, alignSelf: 'center' }
  : readingColumn) as unknown as typeof readingColumn;""")

# Reading screens keep the narrow column.
for f, n in [('src/screens/QuizScreen.tsx',3),('src/screens/LegalScreen.tsx',1),('src/screens/ThankYouScreen.tsx',1),('src/screens/LoginScreen.tsx',1),('src/screens/ResultsScreen.tsx',1),('src/screens/HistoryScreen.tsx',1)]:
    p=os.path.join(root,f); s=open(p).read()
    assert s.count('...column')==n,(f,s.count('...column'))
    s=s.replace('...column','...readingColumn')
    imp=re.search(r"import \{([^}]*)\} from '../theme';", s)
    names=[x.strip() for x in imp.group(1).split(',')]
    names=[('readingColumn' if x=='column' else x) for x in names]
    s=s.replace(imp.group(0), "import { "+", ".join(names)+" } from '../theme';",1)
    open(p,'w').write(s)

# Games stay narrow too (their boards are sized for it).
P='src/screens/PlayZoneScreen.tsx'
p=os.path.join(root,P); s=open(p).read()
a="gameScreen: { flexGrow: 1, paddingBottom: spacing(6), backgroundColor: '#FFF8EF', padding: GUTTER, paddingTop: spacing(1.5), ...column"
assert s.count(a)==1; s=s.replace(a,"gameScreen: { flexGrow: 1, paddingBottom: spacing(6), backgroundColor: '#FFF8EF', padding: GUTTER, paddingTop: spacing(1.5), ...readingColumn")
s=s.replace("import { colors, column, spacing, GUTTER } from '../theme';","import { colors, column, contentMaxWidth, readingColumn, spacing, GUTTER } from '../theme';")
assert 'contentMaxWidth, readingColumn' in s
# Game cards: 2 per row on a phone, 3 when the wide column has room.
a="  width: '50%' | '100%'; reduceMotion: boolean; onPress: () => void;"
assert s.count(a)==1; s=s.replace(a,"  width: '33.333%' | '50%' | '100%'; reduceMotion: boolean; onPress: () => void;")
a="  const twoColumns = width >= 420;"
assert s.count(a)==1; s=s.replace(a,"  const twoColumns = width >= 420;\n  const threeColumns = Math.min(width, contentMaxWidth(width)) - GUTTER * 2 >= 900;")
a="              width={twoColumns ? '50%' : '100%'}"
assert s.count(a)==1; s=s.replace(a,"              width={threeColumns ? '33.333%' : twoColumns ? '50%' : '100%'}")
open(p,'w').write(s)

# Activity tiles: more per row as the column gets wider.
C='src/screens/CategoryScreen.tsx'
r(C,"import { colors, spacing, column, GUTTER, CONTENT_MAX_WIDTH } from '../theme';","import { colors, spacing, column, GUTTER, contentMaxWidth } from '../theme';")
r(C,"""  // Two tiles per row on a phone, three when there is room.
  const { width } = useWindowDimensions();
  const inner = Math.min(width, CONTENT_MAX_WIDTH) - GUTTER * 2;
  const tileWidth = inner >= 480 ? '33.333%' : '50%';""","""  // Two tiles per row on a phone, three when there is room, up to five on a wide computer screen.
  const { width } = useWindowDimensions();
  const inner = Math.min(width, contentMaxWidth(width)) - GUTTER * 2;
  const tileWidth = inner >= 1150 ? '20%' : inner >= 860 ? '25%' : inner >= 480 ? '33.333%' : '50%';""")

# Welcome page: same 80% width on a computer (its tiles already add columns as it widens).
r('src/screens/WelcomeScreen.tsx',"  container: { width: '100%', maxWidth: 1040, alignSelf: 'center', paddingHorizontal: spacing(2), paddingBottom: spacing(5) },",
  "  container: { ...column, paddingHorizontal: spacing(2), paddingBottom: spacing(5) },")
p=os.path.join(root,'src/screens/WelcomeScreen.tsx'); s=open(p).read()
imp=re.search(r"import \{([^}]*)\} from '../theme';", s)
if 'column' not in [x.strip() for x in imp.group(1).split(',')]:
    s=s.replace(imp.group(0), "import {"+imp.group(1).rstrip()+", column } from '../theme';",1)
open(p,'w').write(s)
print('ok')
