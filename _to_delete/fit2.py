import sys,os
root=sys.argv[1]  # app dir
def r(p,a,b,c=1):
    p=os.path.join(root,p); s=open(p).read(); assert s.count(a)==c,(p,a,s.count(a)); open(p,'w').write(s.replace(a,b))

# 1. Animal quiz: a smaller animal picture on short phones, so every answer fits on screen.
A='src/playzone/AnimalExplorer.tsx'
r(A,"import { WinCard } from './common';","import { WinCard, useUsableHeight } from './common';")
r(A,"""  const [won, setWon] = useState<number | null>(null);
  const { width } = useWindowDimensions();
  const q = round[index]!;""","""  const [won, setWon] = useState<number | null>(null);
  const { width } = useWindowDimensions();
  // Short phones (iPhone SE, small Androids): a smaller picture keeps all the answers on screen.
  const usable = useUsableHeight();
  const pictureSize = usable < 600 ? 56 : usable < 720 ? 80 : 110;
  const q = round[index]!;""")
r(A,"""{shown ? <Text style={styles.shown} accessibilityLabel="Picture of the animal">{shown.emoji}</Text> : null}""",
  """{shown ? <Text style={[styles.shown, { fontSize: pictureSize }]} accessibilityLabel="Picture of the animal">{shown.emoji}</Text> : null}""")

# 2. Parent menu: fits between the status bar and the home / navigation bar, and scrolls if it is taller.
M='src/components/AppMenu.tsx'
r(M,"import { AccessibilityInfo, Animated, Linking, Modal, Platform, View, Text, TextInput, StyleSheet, Pressable, Switch } from 'react-native';",
  "import { AccessibilityInfo, Animated, Linking, Modal, Platform, ScrollView, View, Text, TextInput, StyleSheet, Pressable, Switch, useWindowDimensions } from 'react-native';")
r(M,"""  const insets = useSafeAreaInsets();
  const [aboutOpen, setAboutOpen] = useState(false);""","""  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [aboutOpen, setAboutOpen] = useState(false);""")
r(M,"""          <View style={[styles.accountMenu, { top: insets.top + spacing(1) }]} accessibilityViewIsModal>
""","""          <View style={[styles.accountMenu, { top: insets.top + spacing(1), maxHeight: windowHeight - insets.top - insets.bottom - spacing(2) }]} accessibilityViewIsModal>
            {/* Scrolls on short screens, so Sign out and Delete account are never under the home bar. */}
            <ScrollView bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
""")
p=os.path.join(root,M); s=open(p).read()
a="""          </View>
          </View>
        </View>
      </Modal>
      <AboutSheet visible={aboutOpen}"""
assert s.count(a)==1
s=s.replace(a,"""            </ScrollView>
          </View>
          </View>
        </View>
      </Modal>
      <AboutSheet visible={aboutOpen}""")
s=s.replace("maxWidth: 400, maxHeight: '92%', backgroundColor: colors.surface, borderRadius: 22, padding: spacing(2.5),","maxWidth: 400, backgroundColor: colors.surface, borderRadius: 22, padding: spacing(2.5),")
open(p,'w').write(s)
print('ok')
