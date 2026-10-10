import sys,os
root=sys.argv[1]
p=os.path.join(root,'src/playzone/AnimalExplorer.tsx'); s=open(p).read()
a="  const pictureSize = usable < 600 ? 56 : usable < 720 ? 80 : 110;"
assert s.count(a)==1
s=s.replace(a,"  const short = usable < 600;\n  const pictureSize = short ? 44 : usable < 720 ? 80 : 110;")
# The quiz's scroll view is the one right after the "Animal quiz" top bar.
a='''      <TopBar title="❓ Animal quiz" backLabel="← Explorer" onBack={onExit} right={`${index + 1} / ${round.length}`} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody}'''
assert s.count(a)==1
s=s.replace(a,'''      <TopBar title="❓ Animal quiz" backLabel="← Explorer" onBack={onExit} right={`${index + 1} / ${round.length}`} />
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollBody, short && { gap: spacing(1) }]}''')
open(p,'w').write(s); print('ok')
