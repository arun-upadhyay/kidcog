import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import Button from '../components/Button';
import CorrectAnswerCelebration from '../components/CorrectAnswerCelebration';
import { playSound } from '../games/sounds';
import { speak, stopSpeaking } from '../speech';
import { spacing } from '../theme';
import { DC_PATH, MAP_HEIGHT, MAP_WIDTH, US_STATES } from '../explore/usStates';
import { STATE_BY_CODE, makeStateRound, questionSpeech, type StateQuestion } from '../explore/usMapQuiz';
import { GameFrame, WinCard, useUsableHeight } from './common';

/**
 * USA Map: a real map of the 50 states. One state is coloured in and the child
 * picks its name from four (every state can come up). "Explore" lets them tap
 * any state to hear its name and nickname.
 *
 * Made in code, works offline (only the read-aloud voice uses the network).
 * Like the other games: two tries, a gentle "try again", never a red "wrong".
 */
const ROUND = 8;
const INTRO = 'Look at the map of the USA! One state is coloured in. Tap its name. Tap the speaker to hear the names.';

const LAND = '#CDE8D4';
const ASKED = '#FFB703';
const RIGHT = '#53B37A';
const PICKED = '#8FB8F0';

const say = (text: string) => { stopSpeaking(); void speak(text); };

function UsMap({ width, highlight, colour, onPressState }: {
  width: number; highlight?: string; colour: string; onPressState?: (code: string) => void;
}) {
  const height = (width * MAP_HEIGHT) / MAP_WIDTH;
  const lit = highlight ? STATE_BY_CODE[highlight] : undefined;
  return (
    <View style={[styles.mapCard, { width, height }]} accessibilityRole="image"
      accessibilityLabel={onPressState ? 'Map of the USA. Tap a state to hear its name.' : 'Map of the USA with one state coloured in'}>
      <Svg width={width} height={height} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}>
        <Path d={DC_PATH} fill={LAND} stroke="#FFFFFF" strokeWidth={1} />
        {US_STATES.map(s => (
          <Path key={s.code} d={s.d} testID={`map-state-${s.code}`}
            fill={s.code === highlight ? colour : LAND}
            stroke="#FFFFFF" strokeWidth={1.2} strokeLinejoin="round"
            onPress={onPressState ? () => onPressState(s.code) : undefined} />
        ))}
        {/* Drawn last so the coloured state's whole border shows on top of its neighbours. */}
        {lit ? (
          <G pointerEvents="none">
            <Path d={lit.d} fill={colour} stroke="#7A4E08" strokeWidth={2.5} strokeLinejoin="round" />
            {lit.small ? <Circle cx={lit.cx} cy={lit.cy} r={26} fill="none" stroke="#E8572F" strokeWidth={5} /> : null}
          </G>
        ) : null}
      </Svg>
    </View>
  );
}

export default function UsaMap({ level, onBack, onFinish }: {
  level: number; onBack: () => void; onFinish: (stars: number, nextLevel: number) => void;
}) {
  const [mode, setMode] = useState<'quiz' | 'explore'>('quiz');
  const [boxWidth, setBoxWidth] = useState(320);
  const usable = useUsableHeight();
  // Leave room under the map for the question and the four names.
  const mapWidth = Math.floor(Math.max(240, Math.min(boxWidth, 900, (usable * 0.5 * MAP_WIDTH) / MAP_HEIGHT)));

  return (
    <GameFrame emoji="🗺️" title="USA Map" level={level} onBack={onBack} intro={INTRO}>
      <View style={styles.body} onLayout={e => setBoxWidth(e.nativeEvent.layout.width)}>
        <View style={styles.tabs} accessibilityRole="tablist">
          {([['quiz', '❓ Guess the state'], ['explore', '👆 Explore the map']] as const).map(([key, label]) => (
            <Pressable key={key} onPress={() => { stopSpeaking(); setMode(key); }} accessibilityRole="tab"
              accessibilityState={{ selected: mode === key }} style={[styles.tab, mode === key && styles.tabOn]}>
              <Text style={[styles.tabText, mode === key && styles.tabTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {mode === 'quiz'
          ? <Quiz mapWidth={mapWidth} onExit={onBack} onDone={stars => onFinish(stars, level)} />
          : <Explore mapWidth={mapWidth} />}
      </View>
    </GameFrame>
  );
}

function Quiz({ mapWidth, onExit, onDone }: { mapWidth: number; onExit: () => void; onDone: (stars: number) => void }) {
  const [round, setRound] = useState<StateQuestion[]>(() => makeStateRound(ROUND));
  const [index, setIndex] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [solved, setSolved] = useState<'first' | 'later' | 'shown' | null>(null);
  const [firstTry, setFirstTry] = useState(0);
  const [celebration, setCelebration] = useState(0);
  const [won, setWon] = useState<number | null>(null);
  const q = round[index]!;
  const answer = STATE_BY_CODE[q.answer]!;

  const choose = (code: string) => {
    if (solved || wrong.includes(code)) return;
    if (code === q.answer) {
      playSound('yay');
      setCelebration(n => n + 1);
      setSolved(wrong.length === 0 ? 'first' : 'later');
      if (wrong.length === 0) setFirstTry(n => n + 1);
      say(`Yes! It's ${answer.name}, ${answer.nickname}.`);
    } else if (wrong.length === 0) {
      playSound('oops');
      setWrong([code]);
    } else {
      // Second miss: show the answer kindly and move on.
      playSound('oops');
      setWrong([...wrong, code]);
      setSolved('shown');
      say(`This one is ${answer.name}.`);
    }
  };

  const next = () => {
    stopSpeaking();
    if (index + 1 >= round.length) {
      const stars = firstTry >= ROUND - 1 ? 3 : firstTry >= ROUND - 3 ? 2 : 1;
      playSound('tada');
      onDone(stars);
      setWon(stars);
      return;
    }
    setIndex(index + 1); setWrong([]); setSolved(null);
  };

  const again = () => {
    stopSpeaking();
    setRound(makeStateRound(ROUND)); setIndex(0); setWrong([]); setSolved(null); setFirstTry(0); setWon(null);
  };

  return (
    <View style={styles.section}>
      <CorrectAnswerCelebration nonce={celebration} />
      <View style={styles.dots} accessibilityLabel={`Question ${index + 1} of ${round.length}`}>
        {round.map((_, i) => <View key={i} style={[styles.dot, i < index && styles.dotDone, i === index && styles.dotNow]} />)}
      </View>
      <View style={styles.promptRow}>
        <Text style={styles.prompt} accessibilityRole="header">Which state is coloured in?</Text>
        <Pressable onPress={() => say(questionSpeech(q))} accessibilityRole="button" accessibilityLabel="Read the question aloud"
          hitSlop={8} style={({ pressed }) => [styles.speaker, pressed && styles.pressed]}>
          <Text style={styles.speakerText}>🔊</Text>
        </Pressable>
      </View>

      <UsMap width={mapWidth} highlight={q.answer} colour={solved && solved !== 'shown' ? RIGHT : ASKED} />

      <View style={[styles.choices, { width: mapWidth }]}>
        {q.choices.map(code => {
          const state = STATE_BY_CODE[code]!;
          const missed = wrong.includes(code);
          const reveal = solved !== null && code === q.answer;
          return (
            <View key={code} style={styles.choiceCell}>
              <Pressable onPress={() => choose(code)} disabled={solved !== null || missed} testID="state-choice"
                accessibilityRole="button" accessibilityLabel={state.name}
                accessibilityState={{ disabled: solved !== null || missed, selected: reveal }}
                style={({ pressed }) => [styles.choice, reveal && styles.choiceRight, missed && styles.choiceMissed, pressed && styles.pressed]}>
                <Text style={[styles.choiceText, missed && styles.choiceTextMissed]} numberOfLines={1} adjustsFontSizeToFit>{state.name}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {wrong.length === 1 && !solved ? <Text style={styles.tryAgain}>Not quite. Try again! 💪</Text> : null}
      {solved ? (
        <View style={[styles.reveal, { width: mapWidth }]}>
          <Text style={styles.revealTitle}>{solved === 'shown' ? `This one is ${answer.name}.` : `It's ${answer.name}! 🎉`}</Text>
          <Text style={styles.revealText}>{answer.name} is called {answer.nickname}.</Text>
          <Button title={index + 1 >= round.length ? 'See my stars ⭐' : 'Next state ▶'} onPress={next} />
        </View>
      ) : null}

      {won !== null ? (
        <WinCard stars={won} message={`You named ${firstTry} of ${ROUND} states on the first try!`}
          nextLabel="More states ▶" onNext={again} onAgain={again} onExit={onExit} />
      ) : null}
    </View>
  );
}

function Explore({ mapWidth }: { mapWidth: number }) {
  const [picked, setPicked] = useState<string | undefined>();
  const state = picked ? STATE_BY_CODE[picked] : undefined;
  const pick = (code: string) => {
    const s = STATE_BY_CODE[code]!;
    playSound('pop');
    setPicked(code);
    say(`${s.name}, ${s.nickname}.`);
  };
  return (
    <View style={styles.section}>
      <Text style={styles.prompt}>Tap any state to hear its name!</Text>
      <UsMap width={mapWidth} highlight={picked} colour={PICKED} onPressState={pick} />
      <View style={[styles.reveal, styles.exploreCard, { width: mapWidth }]} accessibilityLiveRegion="polite">
        {state ? (
          <>
            <Text style={styles.revealTitle}>{state.name}</Text>
            <Text style={styles.revealText}>{state.nickname[0]!.toUpperCase() + state.nickname.slice(1)}</Text>
          </>
        ) : <Text style={styles.revealText}>There are 50 states. Alaska and Hawaii are drawn in the corner because they are far away.</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { alignSelf: 'stretch', alignItems: 'center', gap: spacing(1.25) },
  section: { alignSelf: 'stretch', alignItems: 'center', gap: spacing(1.25) },
  tabs: { flexDirection: 'row', gap: spacing(0.75), backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 999, padding: 4 },
  tab: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing(1.5), borderRadius: 999 },
  tabOn: { backgroundColor: '#7650C7' },
  tabText: { fontSize: 14, fontWeight: '900', color: '#4E3590' },
  tabTextOn: { color: '#FFFFFF' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1.5, borderColor: '#CABAF0' },
  dotDone: { backgroundColor: '#9B7EDE', borderColor: '#9B7EDE' },
  dotNow: { width: 24, backgroundColor: '#E8724F', borderColor: '#E8724F' },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  prompt: { fontSize: 21, fontWeight: '900', color: '#3F3126', textAlign: 'center', flexShrink: 1 },
  speaker: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEE9FF', borderWidth: 2, borderColor: '#CABAF0', alignItems: 'center', justifyContent: 'center' },
  speakerText: { fontSize: 20 },
  mapCard: { backgroundColor: '#EAF6FD', borderRadius: 20, borderWidth: 2, borderColor: '#FFFFFF', overflow: 'hidden' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', maxWidth: '100%' },
  choiceCell: { width: '50%', padding: spacing(0.5) },
  choice: { minHeight: 56, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing(1), backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 2.5, borderBottomWidth: 5, borderColor: '#CABAF0' },
  choiceRight: { backgroundColor: '#E3F4E8', borderColor: '#53B37A' },
  choiceMissed: { opacity: 0.45 },
  choiceText: { fontSize: 19, fontWeight: '900', color: '#3F3126' },
  choiceTextMissed: { textDecorationLine: 'line-through' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  tryAgain: { fontSize: 17, fontWeight: '800', color: '#8A5A0A' },
  reveal: { maxWidth: '100%', backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 2, borderColor: '#BFE3CB', padding: spacing(1.5), gap: spacing(1) },
  exploreCard: { alignItems: 'center', minHeight: 70, justifyContent: 'center' },
  revealTitle: { fontSize: 20, fontWeight: '900', color: '#235E46', textAlign: 'center' },
  revealText: { fontSize: 16, fontWeight: '700', color: '#4D5B52', textAlign: 'center', lineHeight: 22 },
});
