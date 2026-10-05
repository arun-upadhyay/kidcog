import sys,os
p=os.path.join(sys.argv[1],'src/playzone/DotToDot.tsx'); s=open(p).read()
def r(a,b):
    global s; assert s.count(a)==1,a; s=s.replace(a,b)
r("""  const [won, setWon] = useState<number | null>(null);
""","""  const [won, setWon] = useState<number | null>(null);
  // While a finger (or the mouse button) is down: where it is and the path it took,
  // so the child sees the line stretching from the last dot to their finger.
  const [finger, setFinger] = useState<Pt | null>(null);
  const [trail, setTrail] = useState<Pt[]>([]);
""")
r("""    onPanResponderRelease: () => lockScroll(false),
    onPanResponderTerminate: () => lockScroll(false),
    onPanResponderGrant: e => {
      lockScroll(true);
      const p = toUnits(e.nativeEvent.locationX, e.nativeEvent.locationY);
      touch(p[0], p[1], true);
    },
    onPanResponderMove: e => {
      const p = toUnits(e.nativeEvent.locationX, e.nativeEvent.locationY);
      touch(p[0], p[1], false);
    },""","""    onPanResponderRelease: () => { lockScroll(false); setFinger(null); setTrail([]); },
    onPanResponderTerminate: () => { lockScroll(false); setFinger(null); setTrail([]); },
    onPanResponderGrant: e => {
      lockScroll(true);
      const p = toUnits(e.nativeEvent.locationX, e.nativeEvent.locationY);
      setFinger(p); setTrail([p]);
      touch(p[0], p[1], true);
    },
    onPanResponderMove: e => {
      const p = toUnits(e.nativeEvent.locationX, e.nativeEvent.locationY);
      setFinger(p); setTrail(t => [...t.slice(-60), p]);
      touch(p[0], p[1], false);
    },""")
r("""              {/* The next line, faint, so the child sees where they are heading. */}""","""              {/* The finger's path, faint, and a stretchy line from the last dot to the finger. */}
              {finger && !complete && trail.length > 1 ? <Polyline points={pts(trail)} fill="none" stroke={picture.outline} strokeOpacity={0.22} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /> : null}
              {finger && !complete ? (
                <>
                  <Line x1={dots[joined - 1]![0]} y1={dots[joined - 1]![1]} x2={finger[0]} y2={finger[1]} stroke={picture.outline} strokeOpacity={0.75} strokeWidth={1.8} strokeLinecap="round" />
                  <Circle cx={finger[0]} cy={finger[1]} r={3.4} fill={picture.outline} fillOpacity={0.3} />
                </>
              ) : null}
              {/* The next line, faint, so the child sees where they are heading. */}""")
r("""    setJoined(1); setComplete(false); setMissed(false); setWrong(null); setIdle(false); reveal.setValue(0);""","""    setJoined(1); setComplete(false); setMissed(false); setWrong(null); setIdle(false); setFinger(null); setTrail([]); reveal.setValue(0);""")
open(p,'w').write(s); print('ok')
