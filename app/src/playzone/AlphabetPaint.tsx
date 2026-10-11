import React, { useEffect, useId, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import Svg, { Defs, G, Mask, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { CRAYONS } from './coloringPages';
import { PAINT_PAGES, type PaintPage } from './alphabetPaintPages';
import { blankArt, loadPaint, paintKey, savePaint, type PaintArt, type PaintStroke } from './alphabetPaintArt';
import { useScrollLock } from './common';
import CorrectAnswerCelebration from '../components/CorrectAnswerCelebration';

type Tool = 'brush' | 'pencil' | 'marker' | 'fill' | 'eraser';
const TOOLS: {key: Tool; name: string; icon: string; hint: string}[] = [
  {key:'brush', name:'Brush', icon:'🖌️', hint:'Drag your brush across the paper.'},
  {key:'pencil', name:'Pencil', icon:'✏️', hint:'Draw little details with your pencil.'},
  {key:'marker', name:'Marker', icon:'🖍️', hint:'Layer soft colors with your marker.'},
  {key:'fill', name:'Fill', icon:'🪣', hint:'Tap inside a shape to fill it with color.'},
  {key:'eraser', name:'Eraser', icon:'🧽', hint:'Rub away brush marks. Use white fill to clear painted shapes.'},
];
const inkPoints = (s: PaintStroke) => s.points.map(p => p.join(',')).join(' ');

/** Colorable shapes first, then freehand ink, then crisp picture outlines. */
function Picture({page,art,width,height,onFill,children}: {page:PaintPage;art:PaintArt;width:number;height:number;onFill?:(i:number)=>void;children?:React.ReactNode}) {
  const outlineId = 'outline' + useId().replace(/[^a-zA-Z0-9]/g,'');
  const parts = page.parts ?? page.legacy!.parts.map((p,i)=>({...p,name:`shape ${i+1}`}));
  const lines = page.lines ?? page.legacy?.lines;
  return <Svg width={width} height={height} viewBox={`0 0 ${page.width} ${page.height}`}>
    <Rect width={page.width} height={page.height} fill="#FFFFFF"/>
    {page.legacy && <SvgText x={8} y={30} fontSize={30} fontWeight="900" fontFamily="Arial" fill={art.fills[parts.length]??'#FFFFFF'} stroke="#302636" strokeWidth={.8} onPress={()=>onFill?.(parts.length)}>{page.letter}</SvgText>}
    <G transform={page.legacy?'translate(22 22) scale(.75)':undefined}>
      {parts.map((p,i)=><Path key={i} testID={onFill?`paint-region-${i}`:undefined} accessibilityLabel={onFill?`Fill ${p.name}`:undefined} d={p.d} fill={art.fills[i]??'#FFFFFF'} stroke="#302636" strokeWidth={page.legacy?1.2:.8} strokeLinejoin="round" onPress={()=>onFill?.(i)}/>)}
    </G>
    {children}
    <Defs>{parts.map((_,i)=><Mask key={i} id={`${outlineId}-${i}`} maskUnits="userSpaceOnUse" x={0} y={0} width={page.width} height={page.height}>
      <Rect width={page.width} height={page.height} fill="white"/>
      {parts.slice(i+1).map((p,j)=><Path key={j} d={p.d} fill="black"/>)}
    </Mask>)}</Defs>
    <G pointerEvents="none" transform={page.legacy?'translate(22 22) scale(.75)':undefined}>
      {parts.map((p,i)=><Path key={i} d={p.d} mask={`url(#${outlineId}-${i})`} fill="none" stroke="#302636" strokeWidth={page.legacy?1.2:.8} strokeLinejoin="round"/>)}
      {lines?.map((d,i)=><Path key={i} d={d} fill="none" stroke="#302636" strokeWidth={page.legacy?1.2:.75} strokeLinecap="round"/>)}
    </G>
  </Svg>;
}

function Ink({strokes,page}: {strokes:PaintStroke[];page:PaintPage}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g,'');
  return <G pointerEvents="none">
    <Defs>{strokes.map((s,i)=>!s.erase && strokes.slice(i+1).some(e=>e.erase)?<Mask key={i} id={`${id}-${i}`} maskUnits="userSpaceOnUse" x={0} y={0} width={page.width} height={page.height}>
      <Rect width={page.width} height={page.height} fill="white"/>
      {strokes.slice(i+1).filter(e=>e.erase).map((e,j)=><Polyline key={j} points={inkPoints(e)} stroke="black" strokeWidth={e.width} fill="none" strokeLinecap="round" strokeLinejoin="round"/>)}
    </Mask>:null)}</Defs>
    {strokes.map((s,i)=>!s.erase?<Polyline testID="paint-ink-stroke" key={i} points={inkPoints(s)} stroke={s.color} strokeWidth={s.width} opacity={s.opacity??1} fill="none" strokeLinecap="round" strokeLinejoin="round" mask={strokes.slice(i+1).some(e=>e.erase)?`url(#${id}-${i})`:undefined}/>:null)}
  </G>;
}

function Control({label,icon,onPress,disabled=false,selected=false}: {label:string;icon:string;onPress:()=>void;disabled?:boolean;selected?:boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled,selected}} disabled={disabled} onPress={onPress} style={({pressed})=>[styles.control,selected&&styles.controlSelected,disabled&&styles.disabled,pressed&&styles.pressed]}>
    <Text style={styles.controlIcon}>{icon}</Text><Text style={styles.controlText}>{label}</Text>
  </Pressable>;
}

export default function AlphabetPaint({childId,onBack}: {childId:string;onBack:()=>void}) {
  const [pageIndex,setPageIndex]=useState(0);
  const [library,setLibrary]=useState(false);
  const page=PAINT_PAGES[pageIndex]!;
  return <>
    <PaintEditor key={`${childId}/${page.key}`} childId={childId} page={page} onBack={onBack} onPictures={()=>setLibrary(true)}/>
    <Modal visible={library} transparent animationType="fade" onRequestClose={()=>setLibrary(false)}>
      <View style={styles.scrim} accessibilityViewIsModal>
        <View style={styles.library}>
          <View style={styles.libraryHeader}><Text accessibilityRole="header" style={styles.title}>Pick a picture</Text><Control label="Close pictures" icon="✕" onPress={()=>setLibrary(false)}/></View>
          <ScrollView contentContainerStyle={styles.libraryGrid}>
            {PAINT_PAGES.map((p,i)=><Pressable key={p.key} accessibilityRole="button" accessibilityLabel={`Paint ${p.name}`} accessibilityState={{selected:i===pageIndex}} onPress={()=>{setPageIndex(i);setLibrary(false);}} style={[styles.thumbnail,i===pageIndex&&styles.controlSelected]}>
              <View pointerEvents="none"><Picture page={p} art={blankArt()} width={180} height={135}/></View>
              <Text style={styles.thumbnailText}>{p.letter} · {p.name}</Text>
            </Pressable>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}

function PaintEditor({childId,page,onBack,onPictures}: {childId:string;page:PaintPage;onBack:()=>void;onPictures:()=>void}) {
  const key=paintKey(childId,page.key);
  const [art,setArt]=useState<PaintArt>(blankArt);
  const artRef=useRef(art);
  const [past,setPast]=useState<PaintArt[]>([]);
  const [future,setFuture]=useState<PaintArt[]>([]);
  const [color,setColor]=useState(CRAYONS[0]!);
  const [tool,setTool]=useState<Tool>('fill');
  const [thickness,setThickness]=useState(2.5);
  const [ready,setReady]=useState(false);
  const [loadError,setLoadError]=useState(false);
  const [loadAttempt,setLoadAttempt]=useState(0);
  const [notice,setNotice]=useState('Opening your picture…');
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState(false);
  const [confirmClear,setConfirmClear]=useState(false);
  const [celebrate,setCelebrate]=useState(0);
  const [draft,setDraft]=useState<PaintStroke|null>(null);
  const stroke=useRef<PaintStroke|null>(null);
  const live=useRef(true);
  const revision=useRef(0);
  const lock=useScrollLock();
  const {width:windowWidth,height:windowHeight}=useWindowDimensions();
  const [available,setAvailable]=useState(Math.min(1140,windowWidth-40));
  const wide=available>=760;
  const canvasWidth=Math.max(180,Math.floor(Math.min(available-(wide?226:0),wide?Math.max(330,windowHeight-250)*page.width/page.height:760)));
  const canvasHeight=canvasWidth*page.height/page.width;
  useEffect(()=>{
    live.current=true;setReady(false);setLoadError(false);
    void loadPaint(key).then(saved=>{if(live.current){artRef.current=saved;setArt(saved);setReady(true);setNotice('Your picture saves automatically.');}}).catch(()=>{if(live.current){setLoadError(true);setNotice('We could not open this picture. Tap Retry to try again.');}});
    return()=>{live.current=false;lock(false);};
  },[key,loadAttempt,lock]);
  function save(next:PaintArt) {
    artRef.current=next;setArt(next);setSaving(true);setSaveError(false);
    const mine=++revision.current;
    void savePaint(key,next).then(()=>{if(live.current&&mine===revision.current){setSaving(false);setNotice('Saved on this device ✓');}}).catch(()=>{if(live.current&&mine===revision.current){setSaving(false);setSaveError(true);setNotice('Your picture is here, but could not be saved. Tap Save again.');}});
  }
  function change(next:PaintArt) {const previous=artRef.current;setPast(h=>[...h.slice(-29),previous]);setFuture([]);save(next);}
  const point=(e:GestureResponderEvent):[number,number]=>[
    Math.max(0,Math.min(page.width,e.nativeEvent.locationX/canvasWidth*page.width)),
    Math.max(0,Math.min(page.height,e.nativeEvent.locationY/canvasHeight*page.height)),
  ];
  function startStroke(e:GestureResponderEvent) {
    if(!ready)return;
    lock(true);const p=point(e);
    stroke.current={color:color.hex,width:tool==='pencil'?thickness*.4:tool==='eraser'?thickness*2.5:tool==='marker'?thickness*2:thickness,erase:tool==='eraser',opacity:tool==='marker'?.45:1,points:[p,[p[0]+.01,p[1]]]};
    setDraft({...stroke.current});
  }
  function moveStroke(e:GestureResponderEvent) {
    if(!stroke.current)return;
    const p=point(e),last=stroke.current.points[stroke.current.points.length-1]!;
    if(Math.hypot(p[0]-last[0],p[1]-last[1])<.15)return;
    stroke.current.points.push(p);setDraft({...stroke.current});
  }
  function finishStroke() {
    const current=stroke.current;stroke.current=null;setDraft(null);lock(false);
    if(current)change({...artRef.current,strokes:[...artRef.current.strokes,current]});
  }
  function fill(i:number) {if(!ready||tool!=='fill'||artRef.current.fills[i]===color.hex)return;const fills=[...artRef.current.fills];fills[i]=color.hex;change({...artRef.current,fills});}
  function undo() {const last=past[past.length-1];if(last){const current=artRef.current;setFuture(h=>[...h,current]);setPast(h=>h.slice(0,-1));save(last);}}
  function redo() {const last=future[future.length-1];if(last){const current=artRef.current;setPast(h=>[...h,current]);setFuture(h=>h.slice(0,-1));save(last);}}
  const palette=<View style={[styles.palette,wide&&styles.paletteSide]} accessibilityRole="radiogroup" accessibilityLabel="Paint colors">
    {CRAYONS.map(c=><Pressable key={c.name} accessibilityRole="radio" accessibilityLabel={`Paint ${c.name}`} accessibilityState={{checked:color.hex===c.hex}} onPress={()=>{setColor(c);if(tool==='eraser')setTool('brush');}} style={({pressed})=>[styles.paint,wide&&styles.paintSide,color.hex===c.hex&&styles.paintSelected,pressed&&styles.pressed]}>
      <View style={[styles.nib,{backgroundColor:c.hex}]}><View style={styles.shine}/></View>
      <View style={styles.paintHandle}><View style={[styles.paintStripe,{backgroundColor:c.hex}]}/></View>
      {color.hex===c.hex?<View style={styles.colorCheck}><Text style={styles.colorCheckText}>✓</Text></View>:null}
    </Pressable>)}
  </View>;
  const tools=<View style={[styles.tools,wide&&styles.toolsSide]}>{TOOLS.map(t=><Control key={t.key} label={t.name} icon={t.icon} onPress={()=>setTool(t.key)} selected={tool===t.key}/>)}</View>;
  return <View style={styles.root} onLayout={e=>setAvailable(e.nativeEvent.layout.width)}>
    <CorrectAnswerCelebration nonce={celebrate} message="Beautiful artwork!"/>
    <View style={styles.top}>
      <Control label="Art & Music" icon="←" onPress={onBack}/>
      <View style={styles.titleBlock}><Text style={styles.eyebrow}>ALPHABET PAINT</Text><Text accessibilityRole="header" style={styles.title}>{page.name}</Text></View>
      <Control label="Pictures" icon="🖼️" onPress={onPictures}/>
    </View>
    <View style={styles.toolbar}>
      <Control label="Undo" icon="↶" onPress={undo} disabled={!ready||!past.length}/>
      <Control label="Redo" icon="↷" onPress={redo} disabled={!ready||!future.length}/>
      <Control label="Start over" icon="🗑️" onPress={()=>setConfirmClear(true)} disabled={!ready}/>
      {tool!=='fill'?<View style={styles.sizes} accessibilityRole="radiogroup" accessibilityLabel="Tool size">{[1.2,2.5,4.5].map((s,i)=><Pressable key={s} accessibilityRole="radio" accessibilityLabel={['Small tip','Medium tip','Big tip'][i]} accessibilityState={{checked:thickness===s}} onPress={()=>setThickness(s)} style={[styles.size,thickness===s&&styles.controlSelected]}><View style={{width:7+s*3,height:7+s*3,borderRadius:20,backgroundColor:'#634997'}}/></Pressable>)}</View>:null}
      <Pressable disabled={!ready} accessibilityRole="button" accessibilityLabel="Finished painting" onPress={()=>{if(saveError)save(artRef.current);setCelebrate(n=>n+1);}} style={[styles.finish,!ready&&styles.disabled]}><Text style={styles.finishText}>✓ Finished!</Text></Pressable>
    </View>
    <View style={[styles.workspace,wide&&styles.workspaceWide]}>
      <View style={[styles.paper,{width:canvasWidth,height:canvasHeight}]} testID="alphabet-canvas">
        <Picture page={page} art={art} width={canvasWidth} height={canvasHeight} onFill={fill}><Ink page={page} strokes={[...art.strokes,...(draft?[draft]:[])]}/></Picture>
        {tool!=='fill'?<View testID="paint-drawing-surface" style={StyleSheet.absoluteFill} onStartShouldSetResponder={()=>ready} onMoveShouldSetResponder={()=>ready} onResponderGrant={startStroke} onResponderMove={moveStroke} onResponderRelease={finishStroke} onResponderTerminate={finishStroke} onResponderTerminationRequest={()=>false}/>:null}
      </View>
      {palette}{tools}
    </View>
    <View style={styles.footer}><Text style={styles.hint}>{TOOLS.find(t=>t.key===tool)!.hint}</Text><Text accessibilityLiveRegion="polite" style={styles.saved}>{saving?'Saving…':notice}</Text></View>
    {loadError?<Control label="Retry" icon="↻" onPress={()=>setLoadAttempt(n=>n+1)}/>:null}
    {saveError?<Control label="Save again" icon="💾" onPress={()=>save(artRef.current)}/>:null}
    <Modal visible={confirmClear} transparent animationType="fade" onRequestClose={()=>setConfirmClear(false)}><View style={styles.scrim} accessibilityViewIsModal><View style={styles.confirm}>
      <Text style={styles.title}>Start a fresh picture?</Text><Text style={styles.hint}>You can use Undo to bring this one back.</Text>
      <View style={styles.toolbar}><Control label="Keep drawing" icon="🎨" onPress={()=>setConfirmClear(false)}/><Control label="Yes, clear" icon="🧽" onPress={()=>{change(blankArt());setConfirmClear(false);}}/></View>
    </View></View></Modal>
  </View>;
}

const styles=StyleSheet.create({
  root:{width:'100%',gap:12,backgroundColor:'#E9DEFC',borderRadius:26,paddingVertical:14},
  top:{flexDirection:'row',flexWrap:'wrap',gap:10,alignItems:'center',paddingHorizontal:12},
  titleBlock:{flex:1,minWidth:100},eyebrow:{fontSize:11,fontWeight:'900',letterSpacing:1.8,color:'#7E64AC'},title:{fontSize:24,fontWeight:'900',color:'#493361'},
  toolbar:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'center',gap:8,paddingHorizontal:8},
  control:{minWidth:54,minHeight:54,paddingHorizontal:9,paddingVertical:5,borderRadius:17,backgroundColor:'#F9F5FF',borderWidth:2,borderBottomWidth:4,borderColor:'#CDB7EF',alignItems:'center',justifyContent:'center',gap:1},
  controlSelected:{backgroundColor:'#FFFFFF',borderColor:'#915BCF'},controlIcon:{fontSize:25,color:'#644294'},controlText:{fontSize:11,fontWeight:'900',color:'#644294'},disabled:{opacity:.38},pressed:{transform:[{scale:.96}]},
  finish:{minHeight:52,borderRadius:17,paddingHorizontal:18,justifyContent:'center',backgroundColor:'#329B65',borderBottomWidth:4,borderColor:'#227447'},finishText:{fontSize:18,fontWeight:'900',color:'#FFFFFF'},
  sizes:{flexDirection:'row',gap:4},size:{width:42,height:44,borderRadius:14,backgroundColor:'#F9F5FF',borderWidth:2,borderColor:'#CDB7EF',alignItems:'center',justifyContent:'center'},
  workspace:{alignItems:'center',gap:10},workspaceWide:{flexDirection:'row',justifyContent:'center',alignItems:'flex-start'},paper:{backgroundColor:'#FFFFFF',overflow:'hidden',borderRadius:8},
  palette:{flexDirection:'row',flexWrap:'wrap',gap:5,justifyContent:'center',padding:6,maxWidth:'100%',backgroundColor:'#F5EDFF',borderRadius:22},paletteSide:{width:124},
  paint:{width:40,height:52,borderRadius:13,borderWidth:2,borderColor:'transparent',alignItems:'center',justifyContent:'center',overflow:'hidden'},paintSide:{width:49,height:57},paintSelected:{borderColor:'#8D56C9',backgroundColor:'#FFFFFF'},
  nib:{width:26,height:25,borderTopLeftRadius:19,borderTopRightRadius:5,borderBottomLeftRadius:10,borderBottomRightRadius:10,borderWidth:1.5,borderColor:'rgba(60,40,80,.35)',transform:[{rotate:'-12deg'}]},shine:{width:7,height:12,borderRadius:6,backgroundColor:'rgba(255,255,255,.38)',position:'absolute',left:5,top:4,transform:[{rotate:'25deg'}]},
  paintHandle:{width:20,height:20,backgroundColor:'#C9B7D3',borderColor:'#726078',borderWidth:1.5,borderBottomLeftRadius:5,borderBottomRightRadius:5,overflow:'hidden'},paintStripe:{height:5,marginTop:3,opacity:.6},colorCheck:{position:'absolute',right:0,bottom:0,width:17,height:17,borderRadius:9,backgroundColor:'#644294',alignItems:'center'},colorCheckText:{color:'#FFF',fontWeight:'900',fontSize:12},
  tools:{flexDirection:'row',flexWrap:'wrap',gap:6,justifyContent:'center',paddingHorizontal:4},toolsSide:{width:82,flexDirection:'column',alignItems:'stretch'},
  footer:{gap:3,paddingHorizontal:12},hint:{fontSize:14,color:'#5E4A76',textAlign:'center'},saved:{fontSize:12,color:'#655577',textAlign:'center'},
  scrim:{flex:1,backgroundColor:'rgba(36,21,57,.55)',justifyContent:'center',alignItems:'center',padding:16},library:{width:'100%',maxWidth:880,maxHeight:'90%',backgroundColor:'#FFF9EF',borderRadius:26,padding:16,gap:14},libraryHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},libraryGrid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:12,paddingBottom:16},thumbnail:{borderWidth:3,borderColor:'#DED1EF',borderRadius:20,padding:8,backgroundColor:'#FFFFFF',width:204,alignItems:'center',gap:8},thumbnailText:{fontSize:14,fontWeight:'800',color:'#634997',textAlign:'center'},confirm:{width:'100%',maxWidth:400,backgroundColor:'#FFF9EF',borderRadius:26,padding:24,gap:16},
});
