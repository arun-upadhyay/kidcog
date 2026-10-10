export const PALETTE = [
  { name: 'Red', hex: '#EF665D' }, { name: 'Orange', hex: '#F4A340' },
  { name: 'Yellow', hex: '#F8D75B' }, { name: 'Green', hex: '#61BA8D' },
  { name: 'Blue', hex: '#63A9E6' }, { name: 'Purple', hex: '#9472CE' },
];
export const ACTIVITIES = [
  { key: 'book', name: 'Coloring Book', emoji: '📚', group: 'Art', text: '39 pictures to colour: animals, space, music, food and more!' },
  { key: 'rainbow', name: 'Rainbow Letters', emoji: '🌈', group: 'Art', text: 'Trace ABC, abc, numbers, words and shapes in rainbow ink.' },
  { key: 'calm', name: 'Calm Bubbles', emoji: '🫧', group: 'Music', text: 'Pop soft bubbles, hear their colours and breathe slowly.' },
  { key: 'color', name: 'Coloring Studio', emoji: '🖍️', group: 'Art', text: 'Make a rocket, garden or ocean your own.' },
  { key: 'numbers', name: 'Paint by Number', emoji: '🔢', group: 'Art', text: 'Match the number to its color.' },
  { key: 'words', name: 'Paint by Word', emoji: '📖', group: 'Art', text: 'Find little words and reveal a picture.' },
  { key: 'draw', name: 'Free Draw', emoji: '🎨', group: 'Art', text: 'A blank canvas for your big ideas.' },
  { key: 'trace', name: 'Rainbow Tracing', emoji: '🌈', group: 'Art', text: 'Trace letters, words and shapes.' },
  { key: 'piano', name: 'Piano Playground', emoji: '🎹', group: 'Music', text: 'Play eight colorful musical notes.' },
  { key: 'beats', name: 'Beat Builder', emoji: '🥁', group: 'Music', text: 'Make a rhythm with three drum sounds.' },
  { key: 'songs', name: 'Music & Movement', emoji: '🎵', group: 'Music', text: 'Move, chant and play along to new tunes.' },
  { key: 'dots', name: 'Connect the Dots', emoji: '✏️', group: 'Art', text: 'Join numbers to reveal a picture.' },
] as const;
export type Activity = typeof ACTIVITIES[number]['key'];
export const WORDS = ['see', 'the', 'big', 'look', 'go', 'up'];
export type Region = { path: string; x: number; y: number; color: number };
export const SCENES: { name: string; emoji: string; regions: Region[] }[] = [
 { name: 'Rocket', emoji: '🚀', regions: [
  {path:'M35 70 L35 35 Q50 0 65 35 L65 70 Z',x:50,y:48,color:4},
  {path:'M35 50 L20 72 L35 68 Z',x:30,y:64,color:0},
  {path:'M65 50 L80 72 L65 68 Z',x:70,y:64,color:0},
  {path:'M39 73 L50 95 L61 73 Z',x:50,y:79,color:1},
  {path:'M42 37 A8 8 0 1 0 58 37 A8 8 0 1 0 42 37',x:50,y:37,color:2},
 ]},
 { name: 'Garden', emoji: '🌼', regions: [
  {path:'M47 45 L53 45 L53 88 L47 88 Z',x:50,y:72,color:3},
  {path:'M47 76 Q15 75 25 55 Q43 57 47 76',x:33,y:65,color:3},
  {path:'M53 79 Q85 70 75 54 Q57 57 53 79',x:68,y:65,color:3},
  {path:'M50 32 C15 5 12 46 37 45 C12 72 56 77 50 48 C77 76 90 38 62 39 C85 13 47 5 50 32',x:36,y:32,color:5},
  {path:'M40 41 A10 10 0 1 0 60 41 A10 10 0 1 0 40 41',x:50,y:41,color:2},
 ]},
 { name: 'Ocean', emoji: '🐟', regions: [
  {path:'M20 48 Q48 17 72 48 Q48 80 20 48 Z',x:47,y:48,color:1},
  {path:'M70 48 L91 28 L91 68 Z',x:84,y:48,color:5},
  {path:'M37 31 L52 17 L60 32 Z',x:51,y:28,color:0},
  {path:'M10 89 Q2 61 15 68 Q22 74 19 90 Z',x:14,y:79,color:3},
  {path:'M64 90 Q54 68 65 68 Q78 71 73 90 Z',x:66,y:79,color:3},
  {path:'M10 18 A7 7 0 1 0 24 18 A7 7 0 1 0 10 18',x:17,y:18,color:4},
 ]},
];
export type Stroke = { color: string; width: number; points: [number, number][] };
export const SONGS = [
 {name:'Colors in the Sky',emoji:'🌈',lines:['Red and orange, reach up high!','Yellow sunshine in the sky.','Green and blue, now sway with me.','Purple makes our rainbow complete!'], notes:[0,2,4,4,3,2,1,0,2,3,4,5,4,2,1,0]},
 {name:'Little Shape Parade',emoji:'🔷',lines:['Circle arms go round and round.','Triangle fingers point from the ground.','Square takes four big steps today.','Wave your star hands, hip hooray!'], notes:[0,0,2,4,3,3,1,0,4,4,5,7,6,4,2,0]},
 {name:'Garden Beat',emoji:'🌱',lines:['Tap your knees: one, two, three, four.','Clap your hands and tap some more.','Stretch up tall, a growing tree.','Take a breath and sway with me.'], notes:[0,2,0,2,4,4,2,0,3,5,3,5,4,2,1,0]},
 // Original KidCog sing-alongs (words and tunes written for KidCog).
 {name:'Zoo Parade',emoji:'🦁',friends:['🦁','🐘','🦒','🐒'],lines:['The lion goes ROAR and shakes his hair.','The elephant stomps here and there.','The giraffe stretches up so tall.','The monkey swings and waves to all!'], notes:[0,2,4,4,5,4,2,0,4,4,5,7,5,4,2,0]},
 {name:'Up and Down Opposites',emoji:'🔁',friends:['⬆️','⬇️','🐢','🐇'],lines:['Hands go up, then hands go down.','Big and tall, then small and round.','Slow like a turtle, fast like a hare.','Open and shut, then stop right there!'], notes:[4,7,4,0,2,4,2,0,0,0,4,4,5,4,2,0]},
 {name:'Crunchy Veggies',emoji:'🥕',friends:['🥕','🥦','🌽','🍅'],lines:['Carrots crunch, crunch, orange and bright.','Broccoli trees, take a little bite.','Yellow corn goes pop, pop, pop.','Red tomatoes, we never stop!'], notes:[0,0,2,2,4,4,2,2,3,3,5,5,4,2,1,0]},
 {name:'Counting Stars',emoji:'⭐',friends:['⭐','🌙','✨','🌟'],lines:['One little star, two little stars,','Three little stars shine near and far.','Four and five, they wink at me.','Count them all: how many can you see?'], notes:[0,4,4,5,5,4,3,3,2,2,1,1,0,2,4,0]},
 {name:'Shape Hunt',emoji:'🔷',friends:['🔵','🟥','🔺','⭐'],lines:['A circle like the big round sun.','A square box, now that is fun!','A triangle, a slice of cheese.','A star up high, say shapes, please!'], notes:[2,4,2,0,2,4,5,4,7,5,4,2,4,2,1,0]},
 {name:'Brush Brush Brush',emoji:'🪥',friends:['🪥','😁','💧','🫧'],lines:['Brush, brush, brush the top.','Brush, brush, never stop!','Round and round on every tooth.','A sparkly smile, that is the truth!'], notes:[4,4,4,2,4,4,4,2,5,4,2,0,2,4,2,0]},
];
