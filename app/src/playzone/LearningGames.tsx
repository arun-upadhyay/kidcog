import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GameFrame, WinCard } from './common';
import { LEARNING_GAMES, makeDeck, makeRound, type LearningKey } from './learningContent';
import { speak, stopSpeaking } from '../speech';
import { playSound } from '../games/sounds';

export default function LearningGames({ kind, level: initialLevel, onBack, onFinish }: {
  kind: LearningKey; level: number; onBack: () => void; onFinish: (stars: number, nextLevel: number) => void;
}) {
  const info = LEARNING_GAMES.find(game => game.key === kind)!;
  const [level, setLevel] = useState(initialLevel);
  const [round, setRound] = useState(() => makeRound(kind === 'number-pairs' ? 'counting-picnic' : kind, initialLevel));
  const [deck, setDeck] = useState(() => makeDeck(initialLevel));
  const [open, setOpen] = useState<string[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [counted, setCounted] = useState<number[]>([]);
  const [completed, setCompleted] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [tried, setTried] = useState<string[]>([]);
  const [correct, setCorrect] = useState(false);
  const [won, setWon] = useState(false);
  const [stars, setStars] = useState(0);
  const mistakes = useRef(0); const locked = useRef(false); const awarded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); stopSpeaking(); }, []);
  function win() {
    if (awarded.current) return;
    awarded.current = true;
    const reward = mistakes.current === 0 ? 3 : mistakes.current <= 3 ? 2 : 1;
    setStars(reward); setWon(true); playSound('yay'); onFinish(reward, Math.min(4, level + 1));
  }
  function reset(next: number) {
    if (timer.current) clearTimeout(timer.current);
    stopSpeaking(); setLevel(next); setRound(makeRound(kind === 'number-pairs' ? 'counting-picnic' : kind, next));
    setDeck(makeDeck(next)); setOpen([]); setMatched([]); setCounted([]); setCompleted(0); setFeedback(''); setTried([]); setCorrect(false); setWon(false);
    mistakes.current = 0; locked.current = false; awarded.current = false;
  }
  function choose(answer: string) {
    if (locked.current || won || tried.includes(answer)) return;
    if (answer !== round.answer) { mistakes.current++; setTried(v => [...v, answer]); setFeedback('Good try! Look again and choose another.'); playSound('pop'); return; }
    locked.current = true; setCorrect(true); setFeedback('You found it! ⭐'); playSound('yay');
    if (completed === 4) win();
  }
  function nextRound() {
    setCompleted(n => n + 1); setRound(makeRound(kind === 'number-pairs' ? 'counting-picnic' : kind, level));
    setCorrect(false); setTried([]); setCounted([]); setFeedback(''); locked.current = false;
  }
  function flip(id: string) {
    const card = deck.find(c => c.id === id)!;
    if (locked.current || won || open.includes(id) || matched.includes(card.value)) return;
    playSound('flip'); const next = [...open, id]; setOpen(next);
    if (next.length < 2) return;
    locked.current = true;
    if (deck.find(c => c.id === next[0])!.value === card.value) {
      const found = [...matched, card.value]; setMatched(found); setFeedback('A number and its dots! ⭐'); setOpen([]); locked.current = false;
      if (found.length === deck.length / 2) win();
    } else {
      mistakes.current++; setFeedback('Remember those cards. Try another pair!');
      timer.current = setTimeout(() => { setOpen([]); locked.current = false; }, 1000);
    }
  }
  const memory = kind === 'number-pairs';
  const prompt = memory ? 'Turn over two cards. Match each number to the same number of dots.' : round.prompt;
  return <GameFrame emoji={info.emoji} title={info.name} level={level} onBack={onBack} hint={prompt}>
    <View style={styles.board}>
      <Text style={styles.progress}>{memory ? `${matched.length} / ${deck.length / 2} pairs` : `Round ${completed + 1} of 5`}</Text>
      {memory ? <View style={styles.grid}>{deck.map(card => {
        const visible = open.includes(card.id) || matched.includes(card.value);
        return <Pressable key={card.id} accessibilityRole="button" accessibilityLabel={visible ? card.label : `Hidden card ${deck.indexOf(card) + 1}`} disabled={won || matched.includes(card.value)} onPress={() => flip(card.id)} style={[styles.card, visible && styles.visible, matched.includes(card.value) && styles.matched]}>
          <Text style={[styles.cardText, visible && styles.visibleText]}>{visible ? card.face : '?'}</Text>
        </Pressable>;
      })}</View> : <>
        {kind === 'counting-picnic' ? <View style={styles.grid}>{round.picture.split(' ').map((fruit, i) => <Pressable key={i} accessibilityRole="button" accessibilityLabel={`Count fruit ${i + 1}`} disabled={counted.includes(i) || correct || won} onPress={() => { const next = [...counted, i]; setCounted(next); stopSpeaking(); void speak(String(next.length)); }} style={[styles.fruit, counted.includes(i) && styles.matched]}><Text style={styles.fruitText}>{fruit}</Text>{counted.includes(i) && <Text>{counted.indexOf(i) + 1}</Text>}</Pressable>)}</View> : <Text style={styles.picture}>{round.picture}</Text>}
        <View style={styles.grid}>{round.options.map(option => <Pressable key={option} accessibilityRole="button" accessibilityLabel={`Answer ${option}`} disabled={correct || won || tried.includes(option)} onPress={() => choose(option)} style={[styles.option, tried.includes(option) && styles.dim, correct && option === round.answer && styles.matched]}><Text style={styles.optionText}>{option}</Text></Pressable>)}</View>
      </>}
      <Text accessibilityLiveRegion="polite" style={styles.feedback}>{feedback || 'Take your time. You can do it!'}</Text>
      {correct && !won && <Pressable accessibilityRole="button" onPress={nextRound} style={styles.next}><Text style={styles.nextText}>Next round →</Text></Pressable>}
    </View>
    {won && <WinCard stars={stars} message={memory ? 'You matched every number to its dots!' : 'Five rounds of learning. Great exploring!'} onAgain={() => reset(level)} onNext={() => reset(Math.min(4, level + 1))} nextLabel={level >= 4 ? 'New challenge ▶' : 'Next level ▶'} onExit={onBack} />}
  </GameFrame>;
}
const styles = StyleSheet.create({
  board: { width: '100%', maxWidth: 680, minHeight: 380, backgroundColor: '#FFFDF7', padding: 16, borderRadius: 28, borderWidth: 2, borderColor: '#DED2F2', gap: 20 },
  progress: { textAlign: 'center', color: '#62449B', fontWeight: '800', fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  card: { width: '28%', minHeight: 78, borderRadius: 16, backgroundColor: '#7352AE', padding: 8, alignItems: 'center', justifyContent: 'center' },
  visible: { backgroundColor: '#EEE7FA' }, matched: { backgroundColor: '#CBECD6' },
  cardText: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', textAlign: 'center' }, visibleText: { color: '#40315F' },
  picture: { textAlign: 'center', fontSize: 32, fontWeight: '900', color: '#40315F', paddingVertical: 24 },
  fruit: { minWidth: 52, minHeight: 64, borderRadius: 12, alignItems: 'center', padding: 5 }, fruitText: { fontSize: 32 },
  option: { minWidth: 64, minHeight: 64, backgroundColor: '#E7EFFC', borderColor: '#8AABDD', borderWidth: 2, borderRadius: 18, padding: 12, justifyContent: 'center', alignItems: 'center' },
  optionText: { fontSize: 30, fontWeight: '900', color: '#294B7A' }, dim: { opacity: 0.35 },
  feedback: { fontSize: 17, fontWeight: '700', textAlign: 'center', color: '#435844', minHeight: 44 },
  next: { backgroundColor: '#2C965D', borderRadius: 20, padding: 16, alignItems: 'center' }, nextText: { color: '#FFFFFF', fontWeight: '900', fontSize: 18 },
});
