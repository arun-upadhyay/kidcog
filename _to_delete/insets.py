import sys,os,re
root=sys.argv[1]  # app dir
def r(p,a,b,c=1):
    p=os.path.join(root,p); s=open(p).read(); assert s.count(a)==c,(p,a,s.count(a)); open(p,'w').write(s.replace(a,b))
C='src/playzone/common.tsx'
s=open(os.path.join(root,C)).read()
m=re.search(r"^import .*$", s, re.M)
# add the safe-area import after the react-native import line
rn=re.search(r"^import \{[^}]*\} from 'react-native';$", s, re.M).group(0)
r(C, rn, rn+"\nimport { useSafeAreaInsets } from 'react-native-safe-area-context';")

r(C,"  const { width, height } = useWindowDimensions();","  const { width } = useWindowDimensions();\n  const height = useUsableHeight();")
r(C,"  const { height } = useWindowDimensions();","  const height = useUsableHeight();",2)
r(C,"export const useNative = Platform.OS !== 'web';","""export const useNative = Platform.OS !== 'web';

/**
 * The height a game can really use: the window minus the status bar / notch
 * and the home bar. Sizing boards from the whole window put the controls under
 * the home bar on notched iPhones and most Androids.
 */
export function useUsableHeight() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return height - insets.top - insets.bottom;
}""")
for f,var in [('BubblePop.tsx','screenHeight'),('DotToDot.tsx','screenHeight'),('MazeRunner.tsx','screenHeight'),('TraceDraw.tsx','screenHeight'),('NumberSnake.tsx','viewportHeight')]:
    p='src/playzone/'+f
    r(p,f"  const {{ height: {var} }} = useWindowDimensions();",f"  const {var} = useUsableHeight();")
    s=open(os.path.join(root,p)).read()
    imp=re.search(r"^import \{([^}]*)\} from './common';$", s, re.M)
    assert imp, f
    names=imp.group(1).strip()
    r(p, imp.group(0), "import { "+names+", useUsableHeight } from './common';")
print('ok')
