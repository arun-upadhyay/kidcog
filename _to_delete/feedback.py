import sys,os,re
root=sys.argv[1]  # app dir
def r(p,a,b,c=1):
    p=os.path.join(root,p); s=open(p).read(); assert s.count(a)==c,(p,a,s.count(a)); open(p,'w').write(s.replace(a,b))
M='src/components/AppMenu.tsx'
r(M,"""          {width < 900 ? (
            <Pressable
              testID="header-feedback"
              onPress={() => setFeedbackOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Give feedback"
              style={({ pressed }) => [styles.headerFeedback, pressed && styles.menuButtonPressed]}
            ><Text style={styles.headerFeedbackIcon}>💬</Text></Pressable>
          ) : null}""","""          {/* Feedback lives at the right end of the top bar on every screen size:
              always in the same place, never covering the page, and readable
              (a sideways tab cut its own label off). On narrow phones it's just 💬. */}
          <Pressable
            testID="header-feedback"
            onPress={() => setFeedbackOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Give feedback"
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.headerFeedback, width >= 600 && styles.headerFeedbackWide, (pressed || hovered) && styles.headerFeedbackActive]}
          >
            <Text style={styles.headerFeedbackIcon}>💬</Text>
            {width >= 600 ? <Text testID="header-feedback-label" style={styles.headerFeedbackText}>Feedback</Text> : null}
          </Pressable>""")
p=os.path.join(root,M); s=open(p).read()
i=s.index("      {width >= 900 ? (\n        <View style={[styles.sideFeedbackDock")
j=s.index("      ) : null}\n",i)+len("      ) : null}\n")
s=s[:i]+s[j:]
a="""  headerFeedback: { marginLeft: 'auto', width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEE9FF', borderWidth: 1.5, borderColor: '#CABAF0' },
  headerFeedbackIcon: { fontSize: 20 },"""
assert s.count(a)==1
s=s.replace(a,"""  headerFeedback: { marginLeft: 'auto', minWidth: 42, height: 42, borderRadius: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#EEE9FF', borderWidth: 1.5, borderColor: '#CABAF0' },
  headerFeedbackWide: { paddingHorizontal: spacing(1.75), backgroundColor: '#7650C7', borderColor: '#7650C7' },
  headerFeedbackActive: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  headerFeedbackIcon: { fontSize: 18 },
  headerFeedbackText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },""")
# Drop the side tab's styles and hover state (no longer used).
s=re.sub(r"  sideFeedback[A-Za-z]*: \{.*\n", "", s)
s=s.replace("  const [feedbackHovered, setFeedbackHovered] = useState(false);\n","")
assert 'sideFeedback' not in s and 'feedbackHovered' not in s, 'leftovers'
open(p,'w').write(s)

E='e2e/flows.spec.ts'
p=os.path.join(root,E); s=open(p).read()
i=s.index("test('feedback has a responsive one-tap entry point'")
j=s.index("\n});\n",i)+len("\n});\n")
s=s[:i]+"""test('feedback has a one-tap entry point in the top bar', async ({ page }) => {
  await prepare(page);
  const viewport = page.viewportSize()!;
  const entry = page.getByRole('button', { name: 'Give feedback' });
  await inViewport(page, entry);
  await expect(page.getByTestId('header-feedback')).toBeVisible();
  if (viewport.width >= 600) {
    // The word "Feedback" shows in full inside the button.
    const box = (await entry.boundingBox())!;
    const label = (await page.getByTestId('header-feedback-label').boundingBox())!;
    expect(label.x).toBeGreaterThanOrEqual(box.x);
    expect(label.x + label.width).toBeLessThanOrEqual(box.x + box.width);
    expect(await page.getByTestId('header-feedback-label').evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  }
  await entry.click();
  await expect(page.getByRole('heading', { name: 'Help us improve KidCog' })).toBeVisible();
});
"""+s[j:]
open(p,'w').write(s)
print('ok')
