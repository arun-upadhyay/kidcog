import sys,os
root=sys.argv[1]  # app dir
def rf(p,a,b,c=1):
    p=os.path.join(root,p); s=open(p).read(); assert s.count(a)==c,(p,a[:60],s.count(a)); open(p,'w').write(s.replace(a,b))

W='src/screens/WelcomeScreen.tsx'
rf(W,"\nfunction useReduceMotion() {","\nexport function useReduceMotion() {")
rf(W,"\nfunction useWave(ms: number, still: boolean, delay = 0) {","\nexport function useWave(ms: number, still: boolean, delay = 0) {")
rf(W,"\nfunction Background({ still }: { still: boolean }) {","\n/** The floating animals and soft colour blobs behind the welcome and sign-in pages. */\nexport function Background({ still }: { still: boolean }) {")

L='src/screens/LoginScreen.tsx'
p=os.path.join(root,L); s=open(p).read()
def r(a,b,c=1):
    global s; assert s.count(a)==c,(a[:70],s.count(a)); s=s.replace(a,b)
r("import {\n  ActivityIndicator,\n","import {\n  ActivityIndicator,\n  Animated,\n")
r("import WelcomeScreen from './WelcomeScreen';","import WelcomeScreen, { Background, useReduceMotion, useWave } from './WelcomeScreen';")
r("  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;",
  "  // Owl bobs gently (still when the device asks for reduced motion).\n  const still = useReduceMotion();\n  const bob = useWave(1600, still);\n\n  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;")
r("""    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">""","""    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Background still={still} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">""")
r("""            <Text style={styles.backButtonText}>← Activities</Text>
          </Pressable>
          <View style={styles.authOwl}><Owl size={76} /></View>
          <Text style={styles.title}>{chosenAdventure ? `Unlock ${chosenAdventure}` : 'Welcome to KidCog'}</Text>
          <Text style={styles.body}>{chosenAdventure
            ? 'A parent or guardian signs in first. Then the adventure can begin!'
            : 'Sign in as a parent to keep child nicknames, progress, and activities together.'}</Text>""","""            <Text style={styles.backButtonText}>← Back to the games</Text>
          </Pressable>
          <View style={styles.hero}>
            <View style={styles.bubble}><Text style={styles.bubbleText}>{chosenAdventure ? 'Almost there! 🎉' : 'Hi, grown-up! 👋'}</Text></View>
            <Animated.View style={{ transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }}>
              <Owl size={96} mood="happy" />
            </Animated.View>
          </View>
          <Text style={styles.title}>{chosenAdventure ? `Unlock ${chosenAdventure}` : 'Welcome to KidCog'}</Text>
          <Text style={styles.parade} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🦁 🐘 🐧 🦋 🐸 🚀</Text>
          <Text style={styles.body}>{chosenAdventure
            ? 'A grown-up signs in first, then the adventure can begin!'
            : 'A grown-up signs in here. Then every game, star and sticker is saved for your kids!'}</Text>""")
r("""          {verificationEmail ? (
            <View style={styles.verifyCard}>""","""          <View style={styles.card}>
          {/* A little rainbow across the top of the card. */}
          <View style={styles.stripe} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {['#E8724F', '#F4C930', '#6CC08B', '#3FA7D6', '#7B61D1'].map(c => <View key={c} style={[styles.stripePart, { backgroundColor: c }]} />)}
          </View>
          {verificationEmail ? (
            <View style={styles.verifyCard}>""")
r("""          )}
          <Text style={[type.soft, styles.note]}>This account belongs to the parent or guardian. Children do not sign in.</Text>""","""          )}
          </View>
          <View style={styles.kidNote}>
            <Text style={styles.kidNoteIcon}>🧒</Text>
            <Text style={styles.kidNoteText}>Kids: ask a grown-up to help with this page!</Text>
          </View>
          <Text style={[type.soft, styles.note]}>This account belongs to the parent or guardian. Children do not sign in.</Text>""")
r("""                  <Text style={[styles.tabText, mode === 'signIn' && styles.tabTextActive]}>Sign in</Text>""",
  """                  <Text style={styles.tabIcon}>🔑</Text><Text style={[styles.tabText, mode === 'signIn' && styles.tabTextActive]}>Sign in</Text>""")
r("""                  <Text style={[styles.tabText, mode === 'create' && styles.tabTextActive]}>Create account</Text>""",
  """                  <Text style={styles.tabIcon}>🌱</Text><Text style={[styles.tabText, mode === 'create' && styles.tabTextActive]}>Create account</Text>""")
r("""              <Text style={styles.label}>EMAIL</Text>""","""              <Text style={styles.label}>📧  Grown-up’s email</Text>""")
r("""              <Text style={styles.label}>PASSWORD</Text>""","""              <Text style={styles.label}>🔒  Password</Text>""")

# Styles: playful, roomy, rounded.
def style(key, new):
    global s
    import re
    m=re.search(r"^  "+key+r": \{.*\},\n", s, re.M)
    assert m, key
    s=s[:m.start()]+"  "+key+": "+new+",\n"+s[m.end():]
style('screen',"{ flex: 1, backgroundColor: colors.bg, overflow: 'hidden' }")
style('container',"{ paddingVertical: spacing(3), paddingHorizontal: GUTTER, ...column, maxWidth: 560 }")
style('backButton',"{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing(1.75), marginBottom: spacing(1), borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#F3D9C9' }")
style('backButtonText',"{ color: colors.primary, fontSize: 15, fontWeight: '900' }")
style('title',"{ fontSize: 31, fontWeight: '900', textAlign: 'center', color: '#5D439B', marginTop: spacing(1) }")
style('body',"{ ...type.body, textAlign: 'center', marginTop: spacing(1), marginBottom: spacing(2.5), color: '#4A3728' }")
style('tabs',"{ flexDirection: 'row', backgroundColor: '#F3EEFF', borderRadius: 999, padding: 5, marginBottom: spacing(2.5), gap: 4 }")
style('tab',"{ flex: 1, minHeight: 48, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 999 }")
style('tabActive',"{ backgroundColor: '#7650C7', shadowColor: '#4E3590', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 }")
style('tabText',"{ fontSize: 15, fontWeight: '900', color: '#6A58A0' }")
style('tabTextActive',"{ color: '#FFFFFF' }")
style('label',"{ fontSize: 15, fontWeight: '900', color: '#5D439B', marginBottom: spacing(1) }")
style('input',"{ minHeight: 56, borderWidth: 2, borderColor: '#E3DAF7', borderRadius: 18, backgroundColor: '#FFFDF8', color: colors.ink, fontSize: 17, paddingHorizontal: spacing(2), marginBottom: spacing(2) }")
style('showPassword',"{ position: 'absolute', right: spacing(1), top: 0, height: 56, minWidth: 60, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing(1) }")
style('showPasswordText',"{ fontSize: 15, fontWeight: '900', color: '#7650C7' }")
style('verifyCard',"{ paddingVertical: spacing(1) }")
s=s.replace("""  authOwl: { alignItems: 'center' },\n""","""  authOwl: { alignItems: 'center' },
  hero: { alignItems: 'center', marginTop: spacing(1) },
  bubble: { backgroundColor: '#FFFFFF', borderRadius: 999, borderWidth: 2, borderColor: '#F4C966', paddingHorizontal: spacing(2), paddingVertical: spacing(0.75), marginBottom: spacing(0.5) },
  bubbleText: { fontSize: 16, fontWeight: '900', color: '#8A5A0A' },
  parade: { fontSize: 24, textAlign: 'center', marginTop: spacing(1), letterSpacing: 2 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 28, borderWidth: 2, borderColor: '#EADFF7', padding: spacing(2.5), paddingTop: spacing(3.5), overflow: 'hidden', shadowColor: '#5D439B', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  stripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 8, flexDirection: 'row' },
  stripePart: { flex: 1 },
  tabIcon: { fontSize: 16 },
  kidNote: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), alignSelf: 'center', marginTop: spacing(3), paddingVertical: spacing(1), paddingHorizontal: spacing(2), borderRadius: 999, backgroundColor: '#FFF1C9', borderWidth: 2, borderColor: '#F4C966' },
  kidNoteIcon: { fontSize: 20 },
  kidNoteText: { flexShrink: 1, fontSize: 14, fontWeight: '800', color: '#8A5A0A' },
""",1)
assert 'kidNote:' in s
s=s.replace("  note: { textAlign: 'center', marginTop: spacing(3) },","  note: { textAlign: 'center', marginTop: spacing(1.5) },")
open(p,'w').write(s); print('ok')
