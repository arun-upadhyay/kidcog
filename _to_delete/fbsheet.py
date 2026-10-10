import sys,os
root=sys.argv[1]
p=os.path.join(root,'src/components/FeedbackSheet.tsx'); s=open(p).read()
def r(a,b):
    global s; assert s.count(a)==1,a; s=s.replace(a,b)
r("import Sheet from './Sheet';","import { useSafeAreaInsets } from 'react-native-safe-area-context';\nimport Sheet, { CENTERED_FROM_WIDTH } from './Sheet';")
r("import { colors, spacing, type } from '../theme';","import { colors, spacing, type, GUTTER } from '../theme';")
r("  const { height } = useWindowDimensions();\n","""  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Fit the form inside the panel (a centred card on wide screens, a bottom
  // sheet on phones), so its last button is never cut off at the bottom.
  const centered = width >= CENTERED_FROM_WIDTH;
  const panelSide = centered ? spacing(3) : GUTTER;
  const scrollMax = centered ? height * 0.88 - spacing(6) - 4 : height * 0.9 - 30 - insets.bottom - spacing(3) - 4;
""")
r("""        <ScrollView style={[styles.scroll, { maxHeight: Math.max(260, height * 0.82) }]} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} showsVerticalScrollIndicator>""",
  """        {/* The scroll area reaches the panel's edges (content padded back in), so the
            scroll bar sits at the panel's edge instead of over the text boxes. */}
        <ScrollView style={[styles.scroll, { maxHeight: Math.max(260, scrollMax), marginHorizontal: -panelSide }]} keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingHorizontal: panelSide }]} showsVerticalScrollIndicator>""")
open(p,'w').write(s); print('ok')
