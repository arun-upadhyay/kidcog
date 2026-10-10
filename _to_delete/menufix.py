import sys,os
root=sys.argv[1]
p=os.path.join(root,'src/components/AppMenu.tsx'); s=open(p).read()
def r(a,b,c=1):
    global s; assert s.count(a)==c,(a,s.count(a)); s=s.replace(a,b)
r("import { AccessibilityInfo, Animated, Linking, Modal, Platform, View, Text, TextInput, StyleSheet, Pressable, Switch, useWindowDimensions } from 'react-native';",
  "import { AccessibilityInfo, Animated, Linking, Modal, Platform, ScrollView, View, Text, TextInput, StyleSheet, Pressable, Switch, useWindowDimensions } from 'react-native';")
r("  const { width } = useWindowDimensions();","  const { width, height: windowHeight } = useWindowDimensions();")
r("  const memberSince = new Date(accountCreatedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });",
  "  const created = new Date(accountCreatedAt);\n  const memberSince = Number.isNaN(created.getTime()) ? '—' : created.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });")
r("""          <View style={[styles.accountMenu, { top: insets.top + spacing(1) }]} accessibilityViewIsModal>
""","""          <View style={[styles.accountMenu, { top: insets.top + spacing(1), maxHeight: windowHeight - insets.top - insets.bottom - spacing(2) }]} accessibilityViewIsModal>
            {/* Scrolls on short screens, so Sign out and Delete account are never under the home bar. */}
            <ScrollView bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
""")
r("""          </View>
          </View>
        </View>
      </Modal>""","""            </ScrollView>
          </View>
          </View>
        </View>
      </Modal>""")
r("maxWidth: 400, maxHeight: '92%', backgroundColor: colors.surface,","maxWidth: 400, backgroundColor: colors.surface,")
open(p,'w').write(s); print('ok')
