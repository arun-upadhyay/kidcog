import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Button from '../components/Button';
import Owl from '../components/Owl';
import { playSound } from '../games/sounds';
import { ANIMALS, ANIMAL_BY_KEY, HOME_WORDS, animalOfTheDay, withArticle, type Animal } from '../explore/animals';
import { makeRound } from '../explore/animalQuiz';
import { playAnimal, playRecording, say } from '../explore/animalSounds';
import { factsFor } from '../explore/funFacts';
import { stopSpeaking } from '../speech';
import { colors, spacing } from '../theme';
import { WinCard } from './common';
import SoundBoard from './SoundBoard';

/**
 * Animal Explorer: a picture quiz about animals, a sound board, and an album
 * that fills up as the child meets each animal. Made entirely in code, so it
 * is instant, free to run and works offline (only the read-aloud voice uses
 * the network, and falls back to the phone's own voice).
 *
 * Like the other games: two tries, a gentle "try again", never a red "wrong".
 */
const ROUND = 8;
type Mode = 'hub' | 'quiz' | 'album' | 'sounds';

export default function AnimalExplorer({ level: startLevel, found, onBack, onFinish, onFound }: {
  level: number;
  /** Animals this child has already met (album). */
  found: string[];
  onBack: () => void;
  onFinish: (stars: number, nextLevel: number) => void;
  onFound: (keys: string[]) => void;
}) {
  const [mode, setMode] = useState<Mode>('hub');
  const [level, setLevel] = useState(Math.max(1, Math.min(4, startLevel)));
  const [card, setCard] = useState<Animal | null>(null);
  const met = useMemo(() => new Set(found), [found]);
  const today = animalOfTheDay();

  const meet = (key: string) => { if (!met.has(key)) onFound([key]); };
  const leave = () => { stopSpeaking(); setMode('hub'); };

  if (mode === 'quiz') {
    return <Quiz level={level} onExit={leave} onBack={onBack} onMeet={meet}
      onDone={(stars, firstTry) => {
        const next = firstTry >= ROUND - 1 ? Math.min(4, level + 1) : level;
        onFinish(stars, next);
        return next;
      }}
      onLevel={setLevel} />;
  }

  return (
    <View style={styles.screen}>
      <TopBar title={mode === 'album' ? '📒 My animal album' : mode === 'sounds' ? '🔊 Animal sounds' : '🦁 Animal Explorer'}
        backLabel={mode === 'hub' ? '← Games' : '← Explorer'} onBack={mode === 'hub' ? () => { stopSpeaking(); onBack(); } : leave} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody}>
        {mode === 'hub' ? (
          <>
            <Pressable onPress={() => { meet(today.key); setCard(today); }} accessibilityRole="button"
              accessibilityLabel={`Animal of the day: ${today.name}. Tap to see its card.`} style={({ pressed }) => [styles.today, pressed && styles.pressed]}>
              <Text style={styles.todayEmoji}>{today.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>ANIMAL OF THE DAY</Text>
                <Text style={styles.todayName}>{capital(today.name)}</Text>
                <Text style={styles.todayFact}>{today.fact}</Text>
                <Text style={styles.todayTap}>Tap to meet it ▶</Text>
              </View>
            </Pressable>

            <Tile emoji="❓" title="Animal quiz" sub={`${ROUND} picture questions · Level ${level}`} color="#FFE9E3" border="#E88970"
              onPress={() => setMode('quiz')} />
            <Tile emoji="🔊" title="Animal sounds" sub="Tap to listen, or play Guess who" color="#E5F3FF" border="#68A8D6"
              onPress={() => setMode('sounds')} />
            <Tile emoji="📒" title="My animal album" sub={`${met.size} of ${ANIMALS.length} animals met`} color="#E5F5EA" border="#63AA7D"
              onPress={() => setMode('album')} />
            <Text style={styles.note}>For grown-ups: questions grow with your child, from finding an animal by name to where animals live, what they eat and how many legs they have. Every right answer adds that animal to the album.</Text>
          </>
        ) : null}

        {mode === 'sounds' ? (
          <SoundBoard />
        ) : null}

        {mode === 'album' ? (
          <>
            <View style={styles.albumHead}>
              <Text style={styles.albumCount}>{met.size} / {ANIMALS.length}</Text>
              <Text style={styles.albumHint}>{met.size === 0 ? 'Play the animal quiz to fill your album!' : 'Tap an animal to see its card.'}</Text>
            </View>
            <Grid animals={ANIMALS} dim={a => !met.has(a.key)} renderLabel={a => (met.has(a.key) ? a.name : '?')}
              onPress={a => {
                if (met.has(a.key)) setCard(a);
              }} />
          </>
        ) : null}
      </ScrollView>
      <Modal visible={card !== null} transparent animationType="fade" onRequestClose={() => { stopSpeaking(); setCard(null); }}>
        {card ? <AnimalCard animal={card} onClose={() => { stopSpeaking(); setCard(null); }} /> : null}
      </Modal>
    </View>
  );
}

function Quiz({ level, onExit, onBack, onMeet, onDone, onLevel }: {
  level: number; onExit: () => void; onBack: () => void; onMeet: (key: string) => void;
  onDone: (stars: number, firstTry: number) => number; onLevel: (level: number) => void;
}) {
  const [round, setRound] = useState(() => makeRound(level, ROUND));
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [wrong, setWrong] = useState<string[]>([]);
  const [solved, setSolved] = useState<'first' | 'later' | 'shown' | null>(null);
  // A different fun fact each time (all are true; variety keeps it fresh).
  const [factIndex, setFactIndex] = useState(randomFact);
  const [firstTry, setFirstTry] = useState(0);
  const [won, setWon] = useState<number | null>(null);
  const { width } = useWindowDimensions();
  const q = round[index]!;
  const about = ANIMAL_BY_KEY[q.about]!;


  const choose = (key: string) => {
    if (solved || wrong.includes(key)) return;
    if (key === q.answer) {
      playSound('yay');
      setSolved(wrong.length === 0 ? 'first' : 'later');
      if (wrong.length === 0) setFirstTry(n => n + 1);
      onMeet(q.about);
      stopSpeaking();
    } else if (wrong.length === 0) {
      playSound('oops');
      setWrong([key]);
    } else {
      // Second miss: show the answer kindly and move on.
      playSound('oops');
      setWrong([...wrong, key]);
      setSolved('shown');
      stopSpeaking();
    }
  };

  const next = () => {
    if (index + 1 >= round.length) {
      const stars = firstTry >= ROUND - 1 ? 3 : firstTry >= ROUND - 3 ? 2 : 1;
      playSound('tada');
      const nextLevel = onDone(stars, firstTry);
      if (nextLevel !== level) onLevel(nextLevel);
      setWon(stars);
      stopSpeaking();
      return;
    }
    stopSpeaking();
    setIndex(index + 1); setWrong([]); setSolved(null); setFactIndex(randomFact());
  };

  const again = () => {
    const fresh = makeRound(level, ROUND);
    stopSpeaking();
    setRound(fresh); setIndex(0); setWrong([]); setSolved(null); setFirstTry(0); setWon(null); setFactIndex(randomFact());
  };

  const columns = q.style === 'words' ? 1 : q.choices.length === 4 && width < 560 ? 2 : q.choices.length;
  const shown = q.show ? ANIMAL_BY_KEY[q.show] : undefined;

  return (
    <View style={styles.screen}>
      <TopBar title="❓ Animal quiz" backLabel="← Explorer" onBack={onExit} right={`${index + 1} / ${round.length}`} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody}>
        {!started ? (
          <View style={styles.startCard}>
            <Owl mood="happy" size={88} />
            <Text style={styles.startTitle}>Ready to explore?</Text>
            <Text style={styles.startText}>Tap 🔊 to hear a question, then tap the right animal. You get two tries!</Text>
            <Button title="▶ Start" onPress={() => setStarted(true)} />
          </View>
        ) : (
          <>
            <View style={styles.dots} accessibilityLabel={`Question ${index + 1} of ${round.length}`}>
              {round.map((_, i) => <View key={i} style={[styles.dot, i < index && styles.dotDone, i === index && styles.dotNow]} />)}
            </View>
            <View style={styles.promptRow}>
              <Text style={styles.prompt} accessibilityRole="header">{q.prompt}</Text>
              <Pressable onPress={() => say(q.speech)} accessibilityRole="button" accessibilityLabel="Read the question aloud"
                hitSlop={8} style={({ pressed }) => [styles.speaker, pressed && styles.pressed]}>
                <Text style={styles.speakerText}>🔊</Text>
              </Pressable>
            </View>
            {q.listen ? (
              <Pressable onPress={() => playRecording(q.listen!)} accessibilityRole="button" style={({ pressed }) => [styles.listen, pressed && styles.pressed]}>
                <Text style={styles.listenText}>▶ Play the sound</Text>
              </Pressable>
            ) : null}
            {shown ? <Text style={styles.shown} accessibilityLabel="Picture of the animal">{shown.emoji}</Text> : null}

            <View style={[styles.choices, { flexDirection: columns === 1 ? 'column' : 'row' }]}>
              {q.choices.map(c => {
                const isAnswer = c.key === q.answer;
                const missed = wrong.includes(c.key);
                const reveal = solved !== null && isAnswer;
                return (
                  <View key={c.key} style={{ width: columns === 1 ? '100%' : `${100 / columns}%`, padding: spacing(0.75) }}>
                    <Pressable onPress={() => choose(c.key)} disabled={solved !== null || missed}
                      testID="animal-quiz-choice"
                      accessibilityRole="button" accessibilityLabel={c.label} accessibilityState={{ disabled: solved !== null || missed, selected: reveal }}
                      style={({ pressed }) => [
                        c.emoji ? styles.pictureChoice : styles.wordChoice,
                        reveal && styles.choiceRight,
                        missed && styles.choiceMissed,
                        pressed && styles.pressed,
                      ]}>
                      {c.emoji ? <Text style={styles.choiceEmoji}>{c.emoji}</Text> : null}
                      {c.emoji ? (reveal ? <Text style={styles.choiceName}>{c.label}</Text> : null)
                        : <Text style={styles.wordText}>{c.label}</Text>}
                    </Pressable>
                  </View>
                );
              })}
            </View>

            {wrong.length === 1 && !solved ? <Text style={styles.tryAgain}>Not quite. Try again! 💪</Text> : null}

            {solved ? (
              <View style={styles.factCard}>
                <Text style={styles.factHead}>{solved === 'shown' ? `It's the ${about.name}!` : solved === 'first' ? '⭐ Yes, well done!' : '👍 You got it!'}</Text>
                <FunFact animal={about} index={factIndex} />
                <View style={styles.factButtons}>
                  <Pressable onPress={() => playAnimal(about)} accessibilityRole="button" style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}>
                    <Text style={styles.smallButtonText}>🔊 Hear the {about.name}</Text>
                  </Pressable>
                </View>
                <Button title={index + 1 >= round.length ? 'See my stars ⭐' : 'Next ▶'} onPress={next} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <Modal visible={won !== null} transparent animationType="fade" onRequestClose={onExit}>
      {won !== null ? (
        <WinCard stars={won} message={`You got ${firstTry} of ${round.length} right first time, and learned about ${new Set(round.map(r => r.about)).size} animals!`}
          onNext={onExit} nextLabel="🦁 Explorer home" onAgain={again} onExit={() => { stopSpeaking(); onBack(); }} />
      ) : null}
      </Modal>
    </View>
  );
}

function TopBar({ title, backLabel, onBack, right }: { title: string; backLabel: string; onBack: () => void; right?: string }) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8} style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}>
        <Text style={styles.backText}>{backLabel}</Text>
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {right ? <Text style={styles.badge}>{right}</Text> : <View style={{ width: 8 }} />}
    </View>
  );
}

function Tile({ emoji, title, sub, color, border, onPress }: { emoji: string; title: string; sub: string; color: string; border: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`}
      style={({ pressed }) => [styles.tile, { backgroundColor: color, borderColor: border }, pressed && styles.pressed]}>
      <View style={[styles.tileIcon, { borderColor: border }]}><Text style={styles.tileEmoji}>{emoji}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileSub}>{sub}</Text>
      </View>
      <Text style={styles.tileGo}>▶</Text>
    </Pressable>
  );
}

function Grid({ animals, onPress, renderLabel, dim }: { animals: Animal[]; onPress: (a: Animal) => void; renderLabel: (a: Animal) => string; dim?: (a: Animal) => boolean }) {
  const { width } = useWindowDimensions();
  const columns = width < 380 ? 3 : width < 560 ? 4 : 5;
  return (
    <View style={styles.grid}>
      {animals.map(a => {
        const faded = dim?.(a) ?? false;
        return (
          <View key={a.key} style={{ width: `${100 / columns}%`, padding: spacing(0.5) }}>
            <Pressable onPress={() => onPress(a)} accessibilityRole="button" accessibilityLabel={faded ? 'An animal you have not met yet' : a.name}
              style={({ pressed }) => [styles.cell, faded && styles.cellDim, pressed && styles.pressed]}>
              <Text style={[styles.cellEmoji, faded && { opacity: 0.18 }]}>{a.emoji}</Text>
              <Text style={styles.cellLabel} numberOfLines={1}>{renderLabel(a)}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const randomFact = () => Math.floor(Math.random() * 3);
const factAt = (animal: Animal, index: number) => { const facts = factsFor(animal); return facts[index % facts.length]!; };

/** "Did you know?" title with a small 🔊 that reads the fact aloud. */
function DidYouKnow({ fact }: { fact: string }) {
  return (
    <View style={styles.funFactHead}>
      <Text style={styles.funFactLabel}>🤩 Did you know?</Text>
      <Pressable onPress={() => say(fact)} accessibilityRole="button" accessibilityLabel="Read the fact aloud" hitSlop={8}
        style={({ pressed }) => [styles.factSpeaker, pressed && styles.pressed]}>
        <Text style={styles.factSpeakerText}>🔊</Text>
      </Pressable>
    </View>
  );
}

/** "Did you know?" with the animal and one of its fun facts. */
function FunFact({ animal, index }: { animal: Animal; index: number }) {
  const fact = factAt(animal, index);
  return (
    <View style={styles.funFact}>
      <DidYouKnow fact={fact} />
      <View style={styles.factRow}>
        <Text style={styles.factEmoji}>{animal.emoji}</Text>
        <Text style={styles.factText}>{fact}</Text>
      </View>
    </View>
  );
}

function AnimalCard({ animal, onClose }: { animal: Animal; onClose: () => void }) {
  const [factIndex] = useState(randomFact);
  const fact = factAt(animal, factIndex);
  const home = animal.homes.map(h => HOME_WORDS[h]).find(Boolean);
  const facts = [
    animal.says ? `Says: “${animal.says}”` : null,
    animal.babies ? `Baby: ${withArticle(animal.babies[0]!)}` : null,
    home ? `Lives ${home}` : animal.homes[0] === 'long-ago' ? 'Lived long, long ago' : null,
    animal.legs !== undefined ? `Legs: ${animal.legs}` : null,
  ].filter(Boolean) as string[];
  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={styles.cardBox}>
        <Text style={styles.cardEmoji}>{animal.emoji}</Text>
        <Text style={styles.cardName}>{capital(animal.name)}</Text>
        <View style={{ alignSelf: 'stretch' }}><DidYouKnow fact={fact} /></View>
        <Text style={styles.cardFact}>{fact}</Text>
        <View style={styles.chips}>{facts.map(f => <Text key={f} style={styles.chip}>{f}</Text>)}</View>
        <View style={{ alignSelf: 'stretch', gap: spacing(1) }}>
          <Button title="🔊 Hear it" onPress={() => playAnimal(animal)} />
          <Pressable onPress={onClose} accessibilityRole="button" style={styles.close}><Text style={styles.closeText}>Close</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const styles = StyleSheet.create({
  screen: { flex: 1, alignSelf: 'stretch' },
  scroll: { flex: 1 },
  scrollBody: { paddingVertical: spacing(1.5), gap: spacing(1.5) },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  back: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing(1.5), borderRadius: 999, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
  backText: { fontSize: 14, fontWeight: '800', color: colors.inkSoft },
  title: { flex: 1, fontSize: 20, fontWeight: '900', color: '#3F3126', textAlign: 'center' },
  badge: { fontSize: 13, fontWeight: '900', color: '#4E3590', backgroundColor: '#EEE9FF', borderRadius: 999, paddingHorizontal: spacing(1.25), paddingVertical: 4, overflow: 'hidden' },

  today: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), backgroundColor: '#FFF4D6', borderRadius: 24, padding: spacing(2), borderWidth: 2, borderColor: '#F4C966' },
  todayEmoji: { fontSize: 72 },
  eyebrow: { fontSize: 11, letterSpacing: 1.4, fontWeight: '900', color: '#8A5A0A' },
  todayName: { fontSize: 24, fontWeight: '900', color: '#5A3B08', marginTop: 2 },
  todayFact: { fontSize: 15, lineHeight: 21, color: '#5E4A2B', marginTop: 4 },
  todayTap: { fontSize: 13, fontWeight: '900', color: '#8A5A0A', marginTop: 6 },

  tile: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), borderRadius: 22, borderWidth: 2, padding: spacing(1.75) },
  tileIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tileEmoji: { fontSize: 30 },
  tileTitle: { fontSize: 19, fontWeight: '900', color: '#3F3126' },
  tileSub: { fontSize: 14, fontWeight: '700', color: '#5E5249', marginTop: 2 },
  tileGo: { fontSize: 20, fontWeight: '900', color: '#5E5249' },
  note: { fontSize: 13, lineHeight: 19, color: colors.inkSoft, textAlign: 'center', paddingHorizontal: spacing(1) },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing(0.5) },
  cell: { alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#EADFD0', paddingVertical: spacing(1), minHeight: 96 },
  cellDim: { backgroundColor: '#F6F1EA', borderStyle: 'dashed' },
  cellEmoji: { fontSize: 40 },
  cellLabel: { fontSize: 13, fontWeight: '800', color: '#5E5249', marginTop: 2, paddingHorizontal: 4 },
  albumHead: { alignItems: 'center', gap: 2 },
  albumCount: { fontSize: 30, fontWeight: '900', color: '#34734E' },
  albumHint: { fontSize: 15, fontWeight: '700', color: colors.inkSoft, textAlign: 'center' },

  startCard: { alignItems: 'center', gap: spacing(1.5), backgroundColor: '#FFFFFF', borderRadius: 26, padding: spacing(3), borderWidth: 2, borderColor: '#EADFD0' },
  startTitle: { fontSize: 24, fontWeight: '900', color: colors.primary },
  startText: { fontSize: 16, lineHeight: 22, color: colors.inkSoft, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EADFD0' },
  dotDone: { backgroundColor: '#63AA7D' },
  dotNow: { backgroundColor: colors.primary, width: 22 },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), backgroundColor: '#FFFFFF', borderRadius: 22, padding: spacing(1.75), borderWidth: 2, borderColor: '#EADFD0' },
  prompt: { flex: 1, fontSize: 23, lineHeight: 30, fontWeight: '900', color: '#3F3126' },
  speaker: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#EEE9FF', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#CABAF0' },
  speakerText: { fontSize: 24 },
  listen: { alignSelf: 'center', backgroundColor: '#4A8FC4', borderRadius: 999, paddingHorizontal: spacing(3), paddingVertical: spacing(1.5) },
  listenText: { fontSize: 19, fontWeight: '900', color: '#FFFFFF' },
  shown: { fontSize: 110, textAlign: 'center' },
  choices: { flexWrap: 'wrap', marginHorizontal: -spacing(0.75) },
  pictureChoice: { aspectRatio: 1, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#EADFD0', alignItems: 'center', justifyContent: 'center', shadowColor: '#4A3728', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  choiceEmoji: { fontSize: 64 },
  choiceName: { fontSize: 15, fontWeight: '900', color: '#34734E', marginTop: 2 },
  wordChoice: { minHeight: 60, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#EADFD0', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing(2) },
  wordText: { fontSize: 22, fontWeight: '900', color: '#3F3126' },
  choiceRight: { borderColor: '#3F9A6E', backgroundColor: '#E3F2EA' },
  choiceMissed: { opacity: 0.35 },
  tryAgain: { fontSize: 18, fontWeight: '900', color: '#A84733', textAlign: 'center' },
  factCard: { backgroundColor: '#E5F5EA', borderRadius: 24, padding: spacing(2), gap: spacing(1.5), borderWidth: 2, borderColor: '#9FD0B0' },
  factHead: { fontSize: 20, fontWeight: '900', color: '#235E46' },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  factEmoji: { fontSize: 48 },
  funFact: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: spacing(1.5), gap: spacing(1), borderWidth: 2, borderColor: '#CDE7D6' },
  funFactHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  funFactLabel: { fontSize: 15, fontWeight: '900', color: '#7A4E08' },
  factSpeaker: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEE9FF', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#CABAF0' },
  factSpeakerText: { fontSize: 18 },
  factText: { flex: 1, fontSize: 17, lineHeight: 24, color: '#2F4A3A', fontWeight: '700' },
  factButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) },
  smallButton: { backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: spacing(2), paddingVertical: spacing(1), borderWidth: 2, borderColor: '#9FD0B0' },
  smallButtonText: { fontSize: 15, fontWeight: '900', color: '#235E46' },

  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(42,33,24,0.35)', alignItems: 'center', justifyContent: 'center', padding: spacing(2), zIndex: 20 },
  cardBox: { width: '100%', maxWidth: 380, backgroundColor: colors.surface, borderRadius: 28, padding: spacing(3), alignItems: 'center', gap: spacing(1.25) },
  cardEmoji: { fontSize: 96 },
  cardName: { fontSize: 28, fontWeight: '900', color: colors.primary },
  cardFact: { fontSize: 17, lineHeight: 24, color: colors.ink, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing(0.75) },
  chip: { fontSize: 13, fontWeight: '800', color: '#4E3590', backgroundColor: '#EEE9FF', borderRadius: 999, paddingHorizontal: spacing(1.25), paddingVertical: 5, overflow: 'hidden' },
  close: { alignSelf: 'center', minHeight: 40, justifyContent: 'center' },
  closeText: { fontSize: 15, fontWeight: '800', color: colors.inkSoft },
});
