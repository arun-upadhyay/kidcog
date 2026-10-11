import { isAudioFocused } from '../audioFocus';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { playSound } from '../games/sounds';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import Svg, { Path, Polyline } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACTIVITIES, PALETTE, SCENES, SONGS, WORDS, type Activity, type Stroke } from './artContent';
import { useMusicAudio } from './musicAudio';
import { useScrollLock, useUsableHeight } from './common';
import { GLYPHS } from './TraceDraw';
import { useReduceMotion } from '../screens/WelcomeScreen';
import ColoringBook from './ColoringBook';
import RainbowLetters from './RainbowLetters';
import CalmBubbles from './CalmBubbles';

function Action({ title, onPress, selected = false, disabled = false }: { title: string; onPress: () => void; selected?: boolean; disabled?: boolean }) {
 return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} aria-selected={selected} disabled={disabled} onPress={onPress} style={[styles.action, selected && styles.selected, disabled && { opacity: .4 }]}><Text style={styles.actionText}>{title}</Text></Pressable>;
}
/** A big picture button for the drawing tools: kids read the icon, grown-ups the word under it. */
function Tool({ icon, title, onPress, selected = false, disabled = false, wide }: { icon: string; title: string; onPress: () => void; selected?: boolean; disabled?: boolean; wide: boolean }) {
 return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ selected, disabled }} aria-selected={selected} disabled={disabled} onPress={onPress}
  style={({ pressed }) => [styles.tool, wide && styles.toolWide, selected && styles.toolOn, disabled && { opacity: .4 }, pressed && { transform: [{ scale: .94 }] }]}>
  <Text style={styles.toolIcon}>{icon}</Text><Text style={[styles.toolLabel, selected && { color: '#FFFFFF' }]} numberOfLines={1}>{title.replace(' picture', '').replace('Load saved', 'Open')}</Text>
 </Pressable>;
}
/** Stars that tumble down over the canvas when a trace is finished. */
function FallingStars({ nonce }: { nonce: number }) {
 const fall = useRef(new Animated.Value(0)).current;
 const [stars] = useState(() => Array.from({ length: 14 }, (_, i) => ({ left: (i * 37) % 100, delay: (i % 5) * 0.08, size: 22 + (i % 3) * 8, icon: i % 4 === 0 ? '🌟' : i % 3 === 0 ? '✨' : '⭐' })));
 useEffect(() => { if (!nonce) return; fall.setValue(0); Animated.timing(fall, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(); }, [nonce, fall]);
 if (!nonce) return null;
 return <View pointerEvents="none" style={StyleSheet.absoluteFill}>{stars.map((s, i) => <Animated.Text key={i} style={{ position: 'absolute', left: `${s.left}%`, top: 0, fontSize: s.size,
  opacity: fall.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] }),
  transform: [{ translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [-40 - i * 6, 420 + (i % 4) * 30] }) }, { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${i % 2 ? 200 : -200}deg`] }) }] }}>{s.icon}</Animated.Text>)}</View>;
}
/** How much of the guide the child's lines cover (0–1). */
function coverage(lines: [number, number][][], strokes: Stroke[]) {
 const targets: [number, number][] = [];
 for (const line of lines) for (let i = 0; i < line.length; i++) { const [x, y] = line[i]!; targets.push([x, y]); const n = line[i + 1]; if (!n) continue; const d = Math.hypot(n[0] - x, n[1] - y); for (let k = 4; k < d; k += 4) targets.push([x + (n[0] - x) * k / d, y + (n[1] - y) * k / d]); }
 const pts = strokes.filter(s => s.color !== '#FFFFFF').flatMap(s => s.points);
 if (!targets.length || !pts.length) return 0;
 return targets.filter(([x, y]) => pts.some(([a, b]) => (a - x) ** 2 + (b - y) ** 2 < 42)).length / targets.length;
}
const TRACES = ['A', 'B', 'C', 'LOOK', 'BIG', 'GO', 'Star', 'Heart', 'Diamond', 'Trapezoid'];
function guides(label: string): [number, number][][] {
 if (label === 'Star') return [Array.from({ length: 11 }, (_, i) => { const a = (i * 36 - 90) * Math.PI / 180; const r = i % 2 ? 18 : 39; return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r]; })];
 if (label === 'Diamond') return [[[50,10],[87,50],[50,90],[13,50],[50,10]]];
 if (label === 'Trapezoid') return [[[32,20],[68,20],[90,80],[10,80],[32,20]]];
 if (label === 'Heart') return [Array.from({length:65},(_,i)=>{const t=i*Math.PI/32; return [50+2.3*16*Math.pow(Math.sin(t),3),48-2.3*(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))];})];
 return [...label].flatMap((letter, i) => (GLYPHS[letter] ?? []).map(stroke => stroke.map(([x,y]) => [(x + i * 100) / label.length, 20 + y * .6] as [number,number])));
}
function ArtStudio({ mode, childId }: { mode: 'color'|'numbers'|'words'|'draw'|'trace'; childId: string }) {
 const [scene, setScene] = useState(0); const [trace, setTrace] = useState('A'); const [color, setColor] = useState(0);
 const [fills, setFills] = useState<string[]>([]); const [history, setHistory] = useState<string[][]>([]);
 const [strokes, setStrokes] = useState<Stroke[]>([]); const [brush, setBrush] = useState(5); const [erase, setErase] = useState(false);
 const [notice, setNotice] = useState(''); const [saving, setSaving] = useState(false); const [confirmClear, setConfirmClear] = useState(false);
 const [width, setWidth] = useState(280); const drawing = mode === 'draw' || mode === 'trace'; const lock = useScrollLock();
 const { width: screen } = useWindowDimensions(); const wide = screen >= 700; const tall = useUsableHeight(); const canvasMax = Math.max(260, Math.min(560, tall - 110)); const [stars, setStars] = useState(0); const [traced, setTraced] = useState(false);
 const paint = SCENES[scene]!; const key = `kidcog.art.v1.${childId}.${mode}.${drawing ? trace : scene}`;
 const live = useRef(true); useEffect(() => { live.current = true; return () => { live.current = false; lock(false); }; }, [lock]);
 function fill(index: number) {
  const region = paint.regions[index]!;
  if (mode !== 'color' && color !== region.color) { setNotice(`Find ${mode === 'numbers' ? `number ${region.color+1}` : `the word “${WORDS[region.color]}”`} on the palette.`); return; }
  setHistory(h => [...h.slice(-39), fills]); setFills(f => { const next = [...f]; next[index] = PALETTE[color]!.hex; return next; }); setNotice('Lovely color!');
 }
 function point(e: GestureResponderEvent): [number,number] { return [Math.max(0,Math.min(100,e.nativeEvent.locationX/width*100)),Math.max(0,Math.min(100,e.nativeEvent.locationY/width*100))]; }
 function begin(e: GestureResponderEvent) { lock(true); const p=point(e); setStrokes(s => [...s.slice(-199), { color: erase ? '#FFFFFF' : PALETTE[color]!.hex, width: erase ? 14 : brush, points:[p,[p[0]+.05,p[1]+.05]] }]); }
 function move(e: GestureResponderEvent) { const p=point(e); setStrokes(s => {const last=s[s.length-1]; if(!last || last.points.length>=600) return s; return [...s.slice(0,-1), {...last,points:[...last.points,p]}];}); }
 function finish() {
  lock(false);
  if (mode !== 'trace' || traced) return;
  if (coverage(guides(trace), strokes) >= 0.85) { setTraced(true); setStars(n => n + 1); playSound('yay'); setNotice(`⭐ Great tracing! You traced ${trace}!`); }
 }
 async function save() { setSaving(true); try { await AsyncStorage.setItem(key,JSON.stringify({fills,strokes})); if(live.current) setNotice('Saved on this device for this child.'); } catch { if(live.current) setNotice('Could not save. Please try again.'); } finally { if(live.current) setSaving(false); } }
 async function load() { try { const raw=await AsyncStorage.getItem(key); if(!live.current) return; if(!raw) {setNotice('No saved picture here yet.');return;} const data=JSON.parse(raw); if(!Array.isArray(data.fills)||!Array.isArray(data.strokes)) throw Error(); setFills(data.fills);setStrokes(data.strokes);setHistory([]);setNotice('Your saved picture is back!'); } catch { if(live.current) setNotice('Could not open this picture.'); } }
 const label = mode==='numbers' ? 'Match numbers on the picture and palette.' : mode==='words' ? 'Match words on the picture and palette.' : drawing ? 'Draw with your finger or mouse. Pick a color to begin.' : 'Choose a color, then tap a part of your picture.';
 return <View style={styles.panel}>
  <Text style={styles.hint}>{label}</Text>
  <View style={styles.row}>{drawing ? mode==='trace' && TRACES.map(t=><Action key={t} title={t} selected={trace===t} onPress={()=>{setTrace(t);setStrokes([]);setNotice('');setTraced(false);}} />) : SCENES.map((p,i)=><Action key={p.name} title={`${p.emoji} ${p.name}`} selected={scene===i} onPress={()=>{setScene(i);setFills([]);setHistory([]);setNotice('');}} />)}</View>
  <View style={styles.row}>{PALETTE.map((p,i)=><Pressable key={p.name} accessibilityRole="button" accessibilityLabel={`${mode==='numbers' ? `${i+1} ` : mode==='words' ? `${WORDS[i]} ` : ''}${p.name}`} accessibilityState={{selected:color===i&&!erase}} aria-selected={color===i&&!erase} onPress={()=>{setColor(i);setErase(false);}} style={[styles.swatch,{backgroundColor:p.hex},color===i&&!erase&&styles.swatchSelected]}><Text style={styles.swatchText}>{mode==='numbers'?i+1:mode==='words'?WORDS[i]:color===i&&!erase?'✓':''}</Text></Pressable>)}</View>
  <View style={[styles.bench, wide && styles.benchWide]}>
  <View testID="art-canvas" onLayout={e=>setWidth(e.nativeEvent.layout.width)} style={[styles.canvas, wide && styles.canvasWide, wide && { maxWidth: canvasMax }]}
   onStartShouldSetResponder={()=>drawing} onMoveShouldSetResponder={()=>drawing} onResponderGrant={begin} onResponderMove={move} onResponderRelease={finish} onResponderTerminate={()=>lock(false)} onResponderTerminationRequest={()=>false}>
   <Svg pointerEvents={drawing?'none':'auto'} width="100%" height="100%" viewBox="0 0 100 100">
    {drawing ? <>
      {mode==='trace' && guides(trace).map((pts,i)=><Polyline key={`lane${i}`} points={pts.map(p=>p.join(',')).join(' ')} fill="none" stroke="#B9B1CB" strokeOpacity={0.18} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />)}
      {mode==='trace' && guides(trace).map((pts,i)=><Polyline key={`guide${i}`} points={pts.map(p=>p.join(',')).join(' ')} fill="none" stroke="#B9B1CB" strokeWidth={1.5} strokeDasharray="2 2" />)}
      {strokes.map((s,i)=><Polyline key={i} points={s.points.map(p=>p.join(',')).join(' ')} fill="none" stroke={s.color} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" />)}
    </> : paint.regions.map((r,i)=><Path key={i} d={r.path} fill={fills[i]??'#FFFFFF'} stroke="#514469" strokeWidth={1.2} strokeLinejoin="round" onPress={()=>fill(i)} />)}
   </Svg>
   {!drawing && paint.regions.map((r,i)=><Pressable key={i} accessibilityRole="button" accessibilityLabel={`Paint region ${i+1}${mode==='numbers'?`, number ${r.color+1}`:mode==='words'?`, word ${WORDS[r.color]}`:''}`} onPress={()=>fill(i)} style={[styles.region,{left:`${r.x}%`,top:`${r.y}%`}]}><Text style={styles.regionText}>{mode==='numbers'?r.color+1:mode==='words'?WORDS[r.color]:'●'}</Text></Pressable>)}
   <FallingStars nonce={stars} />
  </View>
  <View style={[styles.toolbar, wide && styles.toolbarWide, wide && tall < 760 && styles.toolbarTwo]}>
   {drawing && <><Tool wide={wide} icon="✏️" title="Thin brush" selected={brush===5&&!erase} onPress={()=>{setBrush(5);setErase(false);}}/><Tool wide={wide} icon="🖌️" title="Thick brush" selected={brush===9&&!erase} onPress={()=>{setBrush(9);setErase(false);}}/><Tool wide={wide} icon="🧽" title="Eraser" selected={erase} onPress={()=>setErase(true)}/></>}
   <Tool wide={wide} icon="↩️" title="Undo" disabled={drawing?!strokes.length:!history.length} onPress={()=>{if(drawing)setStrokes(s=>s.slice(0,-1));else{setFills(history[history.length-1]!);setHistory(h=>h.slice(0,-1));}}}/>
   <Tool wide={wide} icon="🗑️" title="Start over" onPress={()=>setConfirmClear(true)}/><Tool wide={wide} icon="💾" title={saving?'Saving…':'Save picture'} disabled={saving} onPress={()=>void save()}/><Tool wide={wide} icon="📂" title="Load saved picture" onPress={()=>void load()}/>
  </View>
  </View>
  {confirmClear && <View style={styles.row}><Text>Clear this canvas?</Text><Action title="Yes, clear" onPress={()=>{setStrokes([]);setFills([]);setHistory([]);setConfirmClear(false);setTraced(false);setNotice('Ready for a new idea!');}}/><Action title="Keep drawing" onPress={()=>setConfirmClear(false)}/></View>}
  <Text accessibilityLiveRegion="polite" style={styles.hint}>{notice}</Text>
 </View>;
}
function MusicStudio({ mode }: {mode:'piano'|'beats'|'songs'}) {
 const audio=useMusicAudio(); const audioRef=useRef(audio); audioRef.current=audio;
 const reduce=useReduceMotion(); const [note,setNote]=useState(-1); const [running,setRunning]=useState(false); const [step,setStep]=useState(-1);
 const [pattern,setPattern]=useState<boolean[][]>([[true,false,false,false,true,false,false,false],[false,false,true,false,false,false,true,false],[true,false,true,false,true,false,true,false]]);
 const patternRef=useRef(pattern);patternRef.current=pattern;
 const [tempo,setTempo]=useState(100);const [song,setSong]=useState(0);const [notice,setNotice]=useState('');
 const chosen=SONGS[song]!;
 const stop=()=>{setRunning(false);setStep(-1);setNote(-1);audioRef.current.stop();};
 useEffect(()=>{if(!audio.enabled)stop();},[audio.enabled]);
 useEffect(()=>{
  if(!running)return;
  let beat=0; let cancelled=false;
  const tick=()=>{
   if(!isAudioFocused())return;
   if(mode==='songs'&&beat>=chosen.notes.length){stop();return;}
   const current=mode==='beats'?beat%8:beat;setStep(current);
   const notes=mode==='beats'?patternRef.current.flatMap((row,i)=>row[current]?[i+8]:[]):[chosen.notes[current]!];
   if(mode==='songs')setNote(chosen.notes[current]!);
   notes.forEach(n=>{void audioRef.current.play(n).then(ok=>{if(!ok&&!cancelled)setNotice('Audio could not play. Check sound settings and try again.');});});beat++;
  };
  tick();const timer=setInterval(tick,60000/tempo);
  return()=>{cancelled=true;clearInterval(timer);audioRef.current.stop();};
 },[running,mode,song,tempo]);
 async function hit(i:number){setNote(i);if(!await audio.play(i))setNotice(audio.enabled?'Audio could not play. Try again.':'Sound is off. Turn it on in the app menu.');}
 return <View style={styles.panel}>
  {!audio.enabled&&<Text style={styles.hint}>Sound is off. Turn it on in the app menu to hear music.</Text>}
  {mode==='piano'?<><Text style={styles.hint}>Tap a key. Make your own melody!</Text><View style={styles.row}>{['C','D','E','F','G','A','B','High C'].map((key,i)=><Pressable key={key} accessibilityRole="button" accessibilityLabel={`Play ${key}`} onPress={()=>void hit(i)} style={[styles.pianoKey,{backgroundColor:PALETTE[i%6]!.hex},note===i&&styles.swatchSelected]}><Text style={styles.keyText}>{key}</Text><Text>♪</Text></Pressable>)}</View><Text accessibilityLiveRegion="polite" style={styles.hint}>{note>=0?`Last note: ${['C','D','E','F','G','A','B','High C'][note]}`:'Eight notes. Endless possibilities.'}</Text></>:null}
  {mode==='beats'?<><Text style={styles.hint}>Tap squares to build a beat, then press Play.</Text>{['Kick','Snare','Hi-hat'].map((name,row)=><View key={name} style={{gap:8}}><Action title={`Hear ${name}`} onPress={()=>void hit(row+8)}/><View style={styles.beats}>{pattern[row]!.map((active,col)=><Pressable key={col} accessibilityRole="checkbox" accessibilityLabel={`${name} beat ${col+1}`} accessibilityState={{checked:active}} aria-checked={active} onPress={()=>setPattern(p=>p.map((line,i)=>i===row?line.map((v,j)=>j===col?!v:v):line))} style={[styles.beat,active&&styles.selected,step===col&&styles.current]}><Text>{col+1}</Text></Pressable>)}</View></View>)}</>:null}
  {mode==='songs'?<><View style={styles.row}>{SONGS.map((s,i)=><Action key={s.name} title={s.name} selected={song===i} onPress={()=>{stop();setSong(i);}}/>)}</View><View style={styles.stage}><View style={styles.row}>{('friends' in chosen && chosen.friends ? chosen.friends : [chosen.emoji]).map((f,i)=><Text key={f+i} style={[styles.dancer,{transform:[{rotate:!reduce&&running&&(step+i)%2?'12deg':'-6deg'},{translateY:!reduce&&running&&(step+i)%2?-10:0}]}]}>{f}</Text>)}</View><Text style={styles.songTitle}>{chosen.name}</Text><Text style={styles.hint}>An original KidCog tune. Chant the words and follow the moves.</Text>{chosen.lines.map((line,i)=><Text key={line} style={[styles.lyric,Math.floor(step/4)===i&&styles.activeLyric]}>{line}</Text>)}</View></>:null}
  {mode!=='piano'&&<View style={styles.row}><Action title={running?'Stop music':'Play music'} disabled={!audio.enabled} onPress={()=>{if(running)stop();else{setNotice('');setRunning(true);}}}/>{[80,100,120].map(t=><Action key={t} title={`${t} BPM`} selected={tempo===t} onPress={()=>{stop();setTempo(t);}}/>)}</View>}
  <Text accessibilityLiveRegion="polite" style={styles.hint}>{notice}</Text>
 </View>;
}
export default function ArtMusic({childId,onBack,onDots}:{childId:string;onBack:()=>void;onDots:()=>void}) {
 const [activity,setActivity]=useState<Activity|null>(null);const [filter,setFilter]=useState('All'); const {width}=useWindowDimensions();
 const selected=ACTIVITIES.find(a=>a.key===activity);
 return <View style={styles.root}>
  <Action title={activity?'← Art & Music':'← Games'} onPress={()=>activity?setActivity(null):onBack()}/>
  <View style={styles.hero}><Text style={styles.heroIcon}>{selected?.emoji??'🎨 🎵'}</Text><Text accessibilityRole="header" style={styles.heading}>{selected?.name??'Art & Music'}</Text><Text style={styles.subtitle}>{selected?.text??'A little imagination. A whole world to make.'}</Text></View>
  {!activity?<><View style={styles.row}>{['All','Art','Music'].map(f=><Action key={f} title={f} selected={filter===f} onPress={()=>setFilter(f)}/>)}</View><View style={styles.row}>{ACTIVITIES.filter(a=>filter==='All'||a.group===filter).map(a=><Pressable key={a.key} accessibilityRole="button" accessibilityLabel={`Open ${a.name}`} onPress={()=>a.key==='dots'?onDots():setActivity(a.key)} style={[styles.tile,{width:width<460?'100%':'47%',backgroundColor:a.group==='Art'?'#FFF0DA':'#ECE7FF'}]}>{(['book','rainbow','calm'] as string[]).includes(a.key)?<Text style={styles.newBadge}>NEW</Text>:null}<Text style={styles.tileEmoji}>{a.emoji}</Text><Text style={styles.tileTitle}>{a.name}</Text><Text style={styles.hint}>{a.text}</Text></Pressable>)}</View><Text style={styles.hint}>Pictures are saved on this device for the selected child. Music starts only when you press play.</Text></>:activity==='book'?<ColoringBook childId={childId}/>:activity==='rainbow'?<RainbowLetters/>:activity==='calm'?<CalmBubbles/>:activity==='piano'||activity==='beats'||activity==='songs'?<MusicStudio key={activity} mode={activity}/>:activity!=='dots'?<ArtStudio key={activity} mode={activity} childId={childId}/>:null}
 </View>;
}
const styles=StyleSheet.create({
 root:{width:'100%',maxWidth:850,alignSelf:'center',gap:18,paddingBottom:24},hero:{backgroundColor:'#EEE5FA',borderRadius:28,padding:24,alignItems:'center',gap:8},heroIcon:{fontSize:42},heading:{fontSize:30,fontWeight:'900',color:'#53347E',textAlign:'center'},subtitle:{fontSize:16,color:'#624B77',textAlign:'center'},
 row:{flexDirection:'row',flexWrap:'wrap',gap:10,justifyContent:'center'},action:{minHeight:44,borderRadius:18,borderWidth:2,borderColor:'#C9BADF',backgroundColor:'#FFF',paddingHorizontal:14,paddingVertical:10,justifyContent:'center'},actionText:{fontSize:14,fontWeight:'800',color:'#493663'},selected:{backgroundColor:'#C6B2EF',borderColor:'#644498'},
 tile:{borderRadius:26,padding:20,minHeight:180,alignItems:'center',gap:10,borderWidth:3,borderBottomWidth:8,borderColor:'#D3C5E4'},tileEmoji:{fontSize:56},newBadge:{position:'absolute',top:12,right:12,backgroundColor:'#E5533D',color:'#FFFFFF',fontWeight:'900',fontSize:12,letterSpacing:1,paddingHorizontal:10,paddingVertical:4,borderRadius:999,overflow:'hidden'},tileTitle:{fontSize:21,fontWeight:'900',color:'#493663',textAlign:'center'},hint:{fontSize:15,lineHeight:22,color:'#5A4B66',textAlign:'center'},panel:{padding:12,borderRadius:24,backgroundColor:'#FAF7FF',gap:16},
 swatch:{minWidth:44,minHeight:44,borderRadius:22,borderWidth:2,borderColor:'#FFF',alignItems:'center',justifyContent:'center',padding:6},swatchSelected:{borderColor:'#342347',borderWidth:3},swatchText:{fontSize:14,fontWeight:'900',color:'#2A2034'},
 bench:{flexDirection:'column-reverse',alignItems:'center',gap:12},benchWide:{flexDirection:'row',alignItems:'flex-start',justifyContent:'center',alignSelf:'stretch'},canvasWide:{flex:1,width:undefined,maxWidth:560},
 toolbar:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:8},toolbarWide:{flexDirection:'column',flexWrap:'nowrap'},toolbarTwo:{flexDirection:'row',flexWrap:'wrap',width:200,justifyContent:'flex-start'},
 tool:{width:72,minHeight:68,borderRadius:20,borderWidth:2.5,borderBottomWidth:5,borderColor:'#C9BADF',backgroundColor:'#FFF',alignItems:'center',justifyContent:'center',paddingVertical:4},toolWide:{width:96,minHeight:64},toolOn:{backgroundColor:'#7650C7',borderColor:'#54369A'},toolIcon:{fontSize:28},toolLabel:{fontSize:11,fontWeight:'900',color:'#493663',textAlign:'center'},
 canvas:{width:'100%',maxWidth:540,aspectRatio:1,alignSelf:'center',backgroundColor:'#FFF',borderWidth:1,borderColor:'#D0C8DA',borderRadius:12,overflow:'hidden'},region:{position:'absolute',width:44,height:44,marginLeft:-22,marginTop:-22,alignItems:'center',justifyContent:'center'},regionText:{fontSize:11,fontWeight:'800',color:'#322640',backgroundColor:'#FFFFFFB0',borderRadius:8,padding:2},
 pianoKey:{width:'21%',minHeight:108,borderRadius:16,borderWidth:2,borderBottomWidth:7,borderColor:'#FFFFFF',alignItems:'center',justifyContent:'center',gap:10},keyText:{fontSize:21,fontWeight:'900',color:'#302444'},beats:{flexDirection:'row',gap:3},beat:{flex:1,minHeight:44,borderWidth:2,borderColor:'#CEC2E1',borderRadius:8,backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'},current:{borderColor:'#DB722B',borderWidth:3},stage:{backgroundColor:'#F5EDFF',borderRadius:24,padding:16,gap:12,alignItems:'center'},dancer:{fontSize:76},songTitle:{fontSize:24,fontWeight:'900',color:'#53347E',textAlign:'center'},lyric:{fontSize:17,color:'#60526A',textAlign:'center',padding:6,borderRadius:12},activeLyric:{backgroundColor:'#F9DA81',color:'#3F303A',fontWeight:'900'},
});
