import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Owl from './Owl';
import Sheet from './Sheet';
import { OwlStage, ChunkyButton } from './Playful';
import { speak, stopSpeaking, useSpeechState, lastSpeechError } from '../speech';

/** A tap-to-talk host. Uses the shared narrator so focus, cancellation and caching stay consistent. */
export default function AdventureGuide({ name, width, reduceMotion, games, animals, art, compact = false }: {
  compact?: boolean; name?: string; width: number; reduceMotion: boolean; games: boolean; animals: boolean; art: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ownsSpeech = useRef(false);
  const speech = useSpeechState();
  const greeting = `Hi${name?.trim() ? `, ${name.trim()}` : ', friend'}! Welcome to KidCog! I'm Owl, your adventure buddy.`;
  const message = [greeting,
    games && 'Pop bubbles and play number games in the Play Zone.',
    animals && 'Meet amazing animals and listen to their sounds in Animal Explorer.',
    art && 'Or paint a picture and make music in Art and Music.',
    'Pick something you love. Let’s learn and play together!',
  ].filter(Boolean).join(' ');
  useEffect(() => () => { if (ownsSpeech.current) stopSpeaking(); }, [name]);
  const play = () => {
    stopSpeaking();
    ownsSpeech.current = true;
    void speak(message, { voice: 'generated', allowDeviceFallback: false });
  };
  const close = () => { stopSpeaking(); ownsSpeech.current = false; setOpen(false); };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Say hello to Owl" accessibilityHint="Hear a welcome and discover what you can play" onPress={() => { setOpen(true); play(); }} style={styles.launch}>
      {compact ? <Owl size={64} still={reduceMotion} /> : <OwlStage width={width} owlSize={Math.round(width * .3)} tint="sun" still={reduceMotion} bubble="Hello, explorer! 👋" />}
      <Text style={styles.tap}>{compact ? '🔊 Hello!' : '🔊 Tap Owl to say hello'}</Text>
    </Pressable>
    <Sheet visible={open} onClose={close} closeLabel="Close Owl's welcome">
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>Your adventure buddy</Text>
        <View style={styles.stage}><Owl size={140} talking={speech === 'playing'} still={reduceMotion || speech !== 'playing'} /></View>
        <View style={styles.bubble}><Text style={styles.greeting}>{greeting}</Text><Text style={styles.copy}>{message.slice(greeting.length).trim()}</Text></View>
        <Text accessibilityLiveRegion="polite" style={styles.status}>{speech === 'loading' ? 'Owl is getting ready…' : speech === 'playing' ? 'Owl is speaking…' : lastSpeechError ? 'Owl’s voice is resting. You can read along or try again.' : 'Ready for an adventure?'}</Text>
        <View style={styles.controls}>
          <ChunkyButton size="md" colour="grape" title={speech === 'idle' ? '🔊 Hear again' : '■ Stop voice'} onPress={speech === 'idle' ? play : stopSpeaking} />
          <ChunkyButton size="md" colour="grass" title="Let’s explore! →" onPress={close} />
        </View>
        <Text style={styles.disclosure}>Owl uses an AI-generated voice.</Text>
      </ScrollView>
    </Sheet>
  </>;
}
const styles = StyleSheet.create({
  launch: { alignItems: 'center', borderRadius: 24 },
  tap: { color: '#593C96', fontWeight: '800', fontSize: 14, paddingVertical: 10 },
  content: { alignItems: 'center', gap: 12, paddingBottom: 8 },
  title: { color: '#593C96', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  stage: { padding: 12, borderRadius: 100, backgroundColor: '#F1EBFF' },
  bubble: { backgroundColor: '#FFF4D2', borderColor: '#FFC83D', borderWidth: 2, borderRadius: 24, padding: 18, gap: 10, width: '100%' },
  greeting: { fontSize: 20, lineHeight: 27, fontWeight: '900', color: '#633E12', textAlign: 'center' },
  copy: { fontSize: 16, lineHeight: 24, color: '#513A27', textAlign: 'center' },
  status: { fontSize: 14, color: '#593C96', textAlign: 'center' },
  controls: { gap: 10, width: '100%' },
  disclosure: { fontSize: 12, color: '#6D6259', textAlign: 'center' },
});
