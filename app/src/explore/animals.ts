/**
 * The Animal Explorer's animals: what each looks like, says, eats and where it
 * lives, plus one fact a young child can enjoy.
 *
 * Pictures are the phone's own emoji, so there is nothing to license or
 * download and every animal works offline. Only fill in a field when it is
 * clearly true for the animal (a field left out is never asked about), because
 * questions are built from these facts and every question must have exactly
 * one right answer. `homes` errs on the generous side for the same reason: an
 * animal that might live somewhere is never offered as a "does not live there"
 * choice.
 */

export type Kind = 'mammal' | 'bird' | 'fish' | 'reptile' | 'amphibian' | 'insect' | 'other';
export type Home = 'farm' | 'house' | 'forest' | 'jungle' | 'grassland' | 'ocean' | 'river' | 'desert' | 'ice' | 'mountains' | 'garden' | 'long-ago';
export type Diet = 'plants' | 'meat' | 'both';
export type Cover = 'fur' | 'feathers' | 'scales' | 'shell';

export interface Animal {
  key: string;
  name: string;
  /** How the name should be read aloud, when that differs from `name`. */
  spoken?: string;
  emoji: string;
  /** 1 = every four-year-old knows it, 2 = familiar, 3 = new to many children. */
  level: 1 | 2 | 3;
  kind: Kind;
  homes: Home[];
  /** The sound children say for it ("Moo"), when there is a well-known one. */
  says?: string;
  /** Every right name for a baby (the first is the one we show). */
  babies?: string[];
  diet?: Diet;
  /** Only set when clearly true or clearly false. */
  flies?: boolean;
  cover?: Cover;
  legs?: number;
  fact: string;
}

export const ANIMALS: Animal[] = [
  // Farm and home
  { key: 'dog', name: 'dog', emoji: '🐕', level: 1, kind: 'mammal', homes: ['house', 'farm'], says: 'Woof', babies: ['puppy', 'pup'], flies: false, cover: 'fur', legs: 4, fact: 'Dogs can smell things much better than people can.' },
  { key: 'cat', name: 'cat', emoji: '🐈', level: 1, kind: 'mammal', homes: ['house', 'farm'], says: 'Meow', babies: ['kitten'], diet: 'meat', flies: false, cover: 'fur', legs: 4, fact: 'Cats spend a big part of every day sleeping.' },
  { key: 'cow', name: 'cow', emoji: '🐄', level: 1, kind: 'mammal', homes: ['farm'], says: 'Moo', babies: ['calf'], diet: 'plants', flies: false, cover: 'fur', legs: 4, fact: 'Cows give us milk.' },
  { key: 'pig', name: 'pig', emoji: '🐖', level: 1, kind: 'mammal', homes: ['farm', 'forest'], says: 'Oink', babies: ['piglet'], diet: 'both', flies: false, legs: 4, fact: 'Pigs roll in mud to keep cool.' },
  { key: 'sheep', name: 'sheep', emoji: '🐑', level: 1, kind: 'mammal', homes: ['farm', 'mountains', 'grassland'], says: 'Baa', babies: ['lamb'], diet: 'plants', flies: false, legs: 4, fact: 'The wool from sheep is made into warm jumpers.' },
  { key: 'horse', name: 'horse', emoji: '🐎', level: 1, kind: 'mammal', homes: ['farm', 'grassland'], says: 'Neigh', babies: ['foal'], diet: 'plants', flies: false, cover: 'fur', legs: 4, fact: 'Horses can sleep standing up.' },
  { key: 'hen', name: 'hen', emoji: '🐔', level: 1, kind: 'bird', homes: ['farm', 'garden'], says: 'Cluck', babies: ['chick'], diet: 'both', cover: 'feathers', legs: 2, fact: 'Hens lay eggs.' },
  { key: 'rooster', name: 'rooster', emoji: '🐓', level: 2, kind: 'bird', homes: ['farm', 'garden'], says: 'Cock-a-doodle-doo', babies: ['chick'], diet: 'both', cover: 'feathers', legs: 2, fact: 'Roosters often crow early in the morning.' },
  { key: 'duck', name: 'duck', emoji: '🦆', level: 1, kind: 'bird', homes: ['farm', 'river', 'garden'], says: 'Quack', babies: ['duckling'], flies: true, cover: 'feathers', legs: 2, fact: 'Ducks have webbed feet that help them swim.' },
  { key: 'goat', name: 'goat', emoji: '🐐', level: 2, kind: 'mammal', homes: ['farm', 'mountains'], says: 'Maa', babies: ['kid'], diet: 'plants', flies: false, cover: 'fur', legs: 4, fact: 'Goats are great climbers, even on steep rocks.' },
  { key: 'turkey', name: 'turkey', emoji: '🦃', level: 2, kind: 'bird', homes: ['farm', 'forest', 'grassland'], says: 'Gobble', babies: ['poult', 'chick'], cover: 'feathers', legs: 2, fact: 'A turkey\'s head can change colour when it is excited.' },
  { key: 'rabbit', name: 'rabbit', emoji: '🐇', level: 1, kind: 'mammal', homes: ['garden', 'grassland', 'house', 'farm', 'forest'], diet: 'plants', flies: false, cover: 'fur', legs: 4, fact: 'A rabbit\'s front teeth never stop growing.' },
  { key: 'mouse', name: 'mouse', emoji: '🐁', level: 1, kind: 'mammal', homes: ['house', 'farm', 'garden', 'forest', 'grassland'], says: 'Squeak', flies: false, cover: 'fur', legs: 4, fact: 'Mice use their long tails to help them balance.' },
  { key: 'hamster', name: 'hamster', emoji: '🐹', level: 2, kind: 'mammal', homes: ['house', 'desert', 'grassland'], flies: false, cover: 'fur', legs: 4, fact: 'Hamsters carry food in their stretchy cheeks.' },
  { key: 'buffalo', name: 'water buffalo', emoji: '🐃', level: 3, kind: 'mammal', homes: ['farm', 'river', 'grassland', 'jungle'], babies: ['calf'], diet: 'plants', flies: false, legs: 4, fact: 'Water buffaloes love to lie in mud and water to keep cool.' },
  { key: 'llama', name: 'llama', emoji: '🦙', level: 3, kind: 'mammal', homes: ['mountains', 'farm', 'grassland'], diet: 'plants', flies: false, cover: 'fur', legs: 4, fact: 'Llamas come from the mountains of South America.' },
  { key: 'camel', name: 'camel', emoji: '🐫', level: 2, kind: 'mammal', homes: ['desert'], babies: ['calf'], diet: 'plants', flies: false, cover: 'fur', legs: 4, fact: 'Camels can go a long time without drinking water.' },

  // Wild land animals
  { key: 'lion', name: 'lion', emoji: '🦁', level: 1, kind: 'mammal', homes: ['grassland'], says: 'Roar', babies: ['cub'], diet: 'meat', flies: false, cover: 'fur', legs: 4, fact: 'A lion\'s roar can be heard from very far away.' },
  { key: 'tiger', name: 'tiger', emoji: '🐅', level: 1, kind: 'mammal', homes: ['jungle', 'forest', 'grassland', 'river'], says: 'Roar', babies: ['cub'], diet: 'meat', flies: false, cover: 'fur', legs: 4, fact: 'Every tiger has its very own pattern of stripes.' },
  { key: 'leopard', name: 'leopard', emoji: '🐆', level: 3, kind: 'mammal', homes: ['grassland', 'jungle', 'forest', 'mountains', 'desert'], babies: ['cub'], diet: 'meat', flies: false, cover: 'fur', legs: 4, fact: 'Leopards climb trees, and can even carry their dinner up with them.' },
  { key: 'elephant', name: 'elephant', emoji: '🐘', level: 1, kind: 'mammal', homes: ['grassland', 'jungle', 'forest', 'desert'], babies: ['calf'], diet: 'plants', flies: false, legs: 4, fact: 'Elephants use their trunks to smell, drink and pick things up.' },
  { key: 'giraffe', name: 'giraffe', emoji: '🦒', level: 1, kind: 'mammal', homes: ['grassland'], babies: ['calf'], diet: 'plants', flies: false, cover: 'fur', legs: 4, fact: 'Giraffes are the tallest animals in the world.' },
  { key: 'zebra', name: 'zebra', emoji: '🦓', level: 1, kind: 'mammal', homes: ['grassland'], babies: ['foal'], diet: 'plants', flies: false, cover: 'fur', legs: 4, fact: 'No two zebras have exactly the same stripes.' },
  { key: 'rhino', name: 'rhino', spoken: 'rhino', emoji: '🦏', level: 2, kind: 'mammal', homes: ['grassland', 'jungle'], babies: ['calf'], diet: 'plants', flies: false, legs: 4, fact: 'A rhino\'s horn is made of the same stuff as your fingernails.' },
  { key: 'hippo', name: 'hippo', emoji: '🦛', level: 2, kind: 'mammal', homes: ['river', 'grassland'], babies: ['calf'], flies: false, legs: 4, fact: 'Hippos spend most of the day in water to stay cool.' },
  { key: 'monkey', name: 'monkey', emoji: '🐒', level: 1, kind: 'mammal', homes: ['jungle', 'forest', 'mountains', 'grassland'], says: 'Ooh ooh ah ah', flies: false, cover: 'fur', fact: 'Monkeys live together in groups called troops.' },
  { key: 'gorilla', name: 'gorilla', emoji: '🦍', level: 2, kind: 'mammal', homes: ['jungle', 'forest', 'mountains'], flies: false, cover: 'fur', fact: 'Gorillas are the biggest apes in the world.' },
  { key: 'orangutan', name: 'orangutan', spoken: 'orang-utan', emoji: '🦧', level: 3, kind: 'mammal', homes: ['jungle', 'forest'], flies: false, cover: 'fur', fact: 'Orangutans make a new leafy bed in the trees every night.' },
  { key: 'bear', name: 'bear', emoji: '🐻', level: 1, kind: 'mammal', homes: ['forest', 'mountains', 'grassland'], says: 'Grrr', babies: ['cub'], diet: 'both', flies: false, cover: 'fur', legs: 4, fact: 'Some bears sleep through the whole winter.' },
  { key: 'panda', name: 'panda', emoji: '🐼', level: 1, kind: 'mammal', homes: ['forest', 'mountains'], babies: ['cub'], flies: false, cover: 'fur', legs: 4, fact: 'Pandas munch bamboo for most of the day.' },
  { key: 'koala', name: 'koala', emoji: '🐨', level: 2, kind: 'mammal', homes: ['forest'], babies: ['joey'], diet: 'plants', flies: false, cover: 'fur', fact: 'Koalas eat the leaves of eucalyptus trees.' },
  { key: 'kangaroo', name: 'kangaroo', emoji: '🦘', level: 2, kind: 'mammal', homes: ['grassland', 'desert', 'forest'], babies: ['joey'], diet: 'plants', flies: false, cover: 'fur', fact: 'A baby kangaroo rides in its mother\'s pouch.' },
  { key: 'fox', name: 'fox', emoji: '🦊', level: 2, kind: 'mammal', homes: ['forest', 'grassland', 'garden', 'farm', 'mountains', 'desert', 'ice'], babies: ['cub', 'kit', 'pup'], diet: 'both', flies: false, cover: 'fur', legs: 4, fact: 'Foxes wrap their bushy tails around themselves to keep warm.' },
  { key: 'wolf', name: 'wolf', emoji: '🐺', level: 2, kind: 'mammal', homes: ['forest', 'mountains', 'grassland', 'ice', 'desert'], says: 'Awooo', babies: ['pup', 'cub'], diet: 'meat', flies: false, cover: 'fur', legs: 4, fact: 'Wolves live and hunt together in groups called packs.' },
  { key: 'deer', name: 'deer', emoji: '🦌', level: 2, kind: 'mammal', homes: ['forest', 'grassland', 'mountains', 'garden'], babies: ['fawn'], diet: 'plants', flies: false, cover: 'fur', legs: 4, fact: 'Male deer grow antlers, and lose them again every year.' },
  { key: 'chipmunk', name: 'chipmunk', emoji: '🐿️', level: 3, kind: 'mammal', homes: ['forest', 'garden'], flies: false, cover: 'fur', legs: 4, fact: 'Chipmunks stuff seeds into their cheeks to save for later.' },
  { key: 'hedgehog', name: 'hedgehog', emoji: '🦔', level: 2, kind: 'mammal', homes: ['garden', 'forest', 'grassland', 'farm'], babies: ['hoglet'], flies: false, legs: 4, fact: 'Hedgehogs roll into a spiky ball to stay safe.' },
  { key: 'bat', name: 'bat', emoji: '🦇', level: 2, kind: 'mammal', homes: ['forest', 'jungle', 'house', 'mountains', 'desert', 'farm', 'garden'], babies: ['pup'], flies: true, cover: 'fur', fact: 'Bats are the only mammals that can really fly.' },
  { key: 'raccoon', name: 'raccoon', emoji: '🦝', level: 3, kind: 'mammal', homes: ['forest', 'garden', 'house', 'river', 'farm'], babies: ['kit', 'cub'], diet: 'both', flies: false, cover: 'fur', legs: 4, fact: 'Raccoons have clever hands that can open things.' },
  { key: 'skunk', name: 'skunk', emoji: '🦨', level: 3, kind: 'mammal', homes: ['forest', 'grassland', 'garden', 'farm', 'desert'], babies: ['kit'], diet: 'both', flies: false, cover: 'fur', legs: 4, fact: 'Skunks spray a very stinky smell to scare other animals away.' },
  { key: 'sloth', name: 'sloth', emoji: '🦥', level: 3, kind: 'mammal', homes: ['jungle', 'forest'], flies: false, cover: 'fur', fact: 'Sloths move very slowly and hang upside down in trees.' },
  { key: 'otter', name: 'otter', emoji: '🦦', level: 3, kind: 'mammal', homes: ['river', 'ocean'], babies: ['pup'], diet: 'meat', flies: false, cover: 'fur', legs: 4, fact: 'Sea otters hold hands while they sleep so they don\'t float apart.' },
  { key: 'badger', name: 'badger', emoji: '🦡', level: 3, kind: 'mammal', homes: ['forest', 'grassland', 'farm', 'garden'], babies: ['cub'], flies: false, cover: 'fur', legs: 4, fact: 'Badgers dig big underground homes.' },

  // Reptiles and frogs
  { key: 'crocodile', name: 'crocodile', emoji: '🐊', level: 2, kind: 'reptile', homes: ['river', 'jungle', 'ocean', 'grassland'], babies: ['hatchling'], diet: 'meat', flies: false, cover: 'scales', legs: 4, fact: 'Crocodiles have very strong jaws.' },
  { key: 'snake', name: 'snake', emoji: '🐍', level: 1, kind: 'reptile', homes: ['jungle', 'desert', 'forest', 'grassland', 'garden', 'river', 'ocean', 'mountains', 'farm'], says: 'Hiss', babies: ['hatchling'], diet: 'meat', flies: false, cover: 'scales', legs: 0, fact: 'Snakes smell with the help of their tongues.' },
  { key: 'lizard', name: 'lizard', emoji: '🦎', level: 2, kind: 'reptile', homes: ['desert', 'jungle', 'garden', 'forest', 'grassland', 'mountains', 'house'], flies: false, cover: 'scales', legs: 4, fact: 'Some lizards can drop their tail to escape, then grow a new one.' },
  { key: 'turtle', name: 'turtle', emoji: '🐢', level: 1, kind: 'reptile', homes: ['ocean', 'river', 'garden', 'jungle', 'forest', 'house'], babies: ['hatchling'], flies: false, cover: 'shell', legs: 4, fact: 'A turtle\'s shell is part of its body.' },
  { key: 'frog', name: 'frog', emoji: '🐸', level: 1, kind: 'amphibian', homes: ['river', 'jungle', 'garden', 'forest'], says: 'Ribbit', babies: ['tadpole'], diet: 'meat', flies: false, legs: 4, fact: 'Frogs start life as tadpoles swimming in water.' },

  // Sea
  { key: 'fish', name: 'fish', emoji: '🐟', level: 1, kind: 'fish', homes: ['ocean', 'river', 'house'], flies: false, cover: 'scales', legs: 0, fact: 'Fish breathe underwater using gills.' },
  { key: 'tropical-fish', name: 'tropical fish', emoji: '🐠', level: 2, kind: 'fish', homes: ['ocean', 'house'], flies: false, cover: 'scales', legs: 0, fact: 'Many fish on coral reefs are bright and colourful.' },
  { key: 'pufferfish', name: 'pufferfish', emoji: '🐡', level: 3, kind: 'fish', homes: ['ocean'], flies: false, legs: 0, fact: 'A pufferfish puffs up like a ball when it is scared.' },
  { key: 'shark', name: 'shark', emoji: '🦈', level: 1, kind: 'fish', homes: ['ocean'], babies: ['pup'], diet: 'meat', flies: false, legs: 0, fact: 'Sharks keep growing new teeth all their lives.' },
  { key: 'whale', name: 'whale', emoji: '🐳', level: 1, kind: 'mammal', homes: ['ocean'], babies: ['calf'], flies: false, legs: 0, fact: 'Whales breathe air through a blowhole on top of their head.' },
  { key: 'dolphin', name: 'dolphin', emoji: '🐬', level: 1, kind: 'mammal', homes: ['ocean', 'river'], babies: ['calf'], diet: 'meat', flies: false, legs: 0, fact: 'Dolphins talk to each other with clicks and whistles.' },
  { key: 'octopus', name: 'octopus', emoji: '🐙', level: 2, kind: 'other', homes: ['ocean'], diet: 'meat', flies: false, fact: 'An octopus has eight arms.' },
  { key: 'squid', name: 'squid', emoji: '🦑', level: 3, kind: 'other', homes: ['ocean'], diet: 'meat', flies: false, fact: 'Squid squirt ink to hide from danger.' },
  { key: 'crab', name: 'crab', emoji: '🦀', level: 2, kind: 'other', homes: ['ocean', 'river'], flies: false, cover: 'shell', fact: 'Most crabs walk sideways.' },
  { key: 'lobster', name: 'lobster', emoji: '🦞', level: 3, kind: 'other', homes: ['ocean'], flies: false, cover: 'shell', fact: 'Lobsters have big claws and a hard shell.' },
  { key: 'shrimp', name: 'shrimp', emoji: '🦐', level: 3, kind: 'other', homes: ['ocean', 'river'], flies: false, fact: 'Shrimp flick their tails to zoom backwards when they are scared.' },

  // Birds
  { key: 'penguin', name: 'penguin', emoji: '🐧', level: 1, kind: 'bird', homes: ['ice', 'ocean'], babies: ['chick'], diet: 'meat', flies: false, cover: 'feathers', legs: 2, fact: 'Penguins cannot fly, but they are super swimmers.' },
  { key: 'owl', name: 'owl', emoji: '🦉', level: 1, kind: 'bird', homes: ['forest', 'farm', 'grassland', 'desert', 'jungle', 'mountains', 'garden', 'ice'], says: 'Hoo hoo', babies: ['owlet'], diet: 'meat', flies: true, cover: 'feathers', legs: 2, fact: 'Owls can turn their heads very far around.' },
  { key: 'eagle', name: 'eagle', emoji: '🦅', level: 2, kind: 'bird', homes: ['mountains', 'forest', 'grassland', 'river', 'desert', 'ocean'], babies: ['eaglet'], diet: 'meat', flies: true, cover: 'feathers', legs: 2, fact: 'Eagles can spot food from very high up in the sky.' },
  { key: 'parrot', name: 'parrot', emoji: '🦜', level: 1, kind: 'bird', homes: ['jungle', 'forest', 'house', 'grassland'], says: 'Squawk', babies: ['chick'], flies: true, cover: 'feathers', legs: 2, fact: 'Some parrots can copy words that people say.' },
  { key: 'swan', name: 'swan', emoji: '🦢', level: 2, kind: 'bird', homes: ['river'], babies: ['cygnet'], flies: true, cover: 'feathers', legs: 2, fact: 'Swans use their long necks to reach plants under the water.' },
  { key: 'peacock', name: 'peacock', emoji: '🦚', level: 2, kind: 'bird', homes: ['forest', 'jungle', 'farm', 'garden', 'grassland'], babies: ['chick'], flies: true, cover: 'feathers', legs: 2, fact: 'A peacock spreads its colourful tail feathers like a giant fan.' },
  { key: 'flamingo', name: 'flamingo', emoji: '🦩', level: 2, kind: 'bird', homes: ['river', 'ocean'], babies: ['chick'], flies: true, cover: 'feathers', legs: 2, fact: 'Flamingos are pink because of the food they eat.' },
  { key: 'dove', name: 'dove', emoji: '🕊️', level: 3, kind: 'bird', homes: ['garden', 'forest', 'house', 'farm', 'grassland', 'desert'], says: 'Coo', babies: ['squab', 'chick'], flies: true, cover: 'feathers', legs: 2, fact: 'A white dove is often used as a sign of peace.' },

  // Little creatures
  { key: 'butterfly', name: 'butterfly', emoji: '🦋', level: 1, kind: 'insect', homes: ['garden', 'grassland', 'jungle', 'forest', 'farm', 'mountains'], babies: ['caterpillar'], flies: true, legs: 6, fact: 'Butterflies taste with their feet.' },
  { key: 'bee', name: 'bee', emoji: '🐝', level: 1, kind: 'insect', homes: ['garden', 'grassland', 'forest', 'farm', 'jungle', 'mountains', 'desert'], says: 'Buzz', flies: true, legs: 6, fact: 'Bees make honey from the nectar inside flowers.' },
  { key: 'ladybug', name: 'ladybug', emoji: '🐞', level: 1, kind: 'insect', homes: ['garden', 'grassland', 'forest', 'farm'], flies: true, legs: 6, fact: 'Ladybugs eat tiny bugs that hurt plants.' },
  { key: 'ant', name: 'ant', emoji: '🐜', level: 1, kind: 'insect', homes: ['garden', 'forest', 'grassland', 'desert', 'jungle', 'house', 'farm', 'mountains'], legs: 6, fact: 'Ants can carry things much heavier than themselves.' },
  { key: 'caterpillar', name: 'caterpillar', emoji: '🐛', level: 1, kind: 'insect', homes: ['garden', 'forest', 'grassland', 'jungle', 'farm'], diet: 'plants', flies: false, fact: 'A caterpillar grows up to be a butterfly or a moth.' },
  { key: 'snail', name: 'snail', emoji: '🐌', level: 1, kind: 'other', homes: ['garden', 'forest', 'river', 'ocean', 'jungle', 'farm', 'grassland'], flies: false, cover: 'shell', fact: 'A snail carries its shell home everywhere it goes.' },
  { key: 'spider', name: 'spider', emoji: '🕷️', level: 1, kind: 'other', homes: ['garden', 'house', 'forest', 'jungle', 'desert', 'grassland', 'farm', 'mountains'], diet: 'meat', flies: false, legs: 8, fact: 'Spiders spin their webs from silk.' },
  { key: 'cricket', name: 'cricket', emoji: '🦗', level: 3, kind: 'insect', homes: ['garden', 'grassland', 'forest', 'farm', 'house', 'jungle'], says: 'Chirp', legs: 6, fact: 'Crickets chirp by rubbing their wings together.' },
  { key: 'mosquito', name: 'mosquito', emoji: '🦟', level: 3, kind: 'insect', homes: ['river', 'jungle', 'forest', 'garden', 'house', 'grassland', 'farm'], says: 'Bzzz', flies: true, legs: 6, fact: 'Only mother mosquitoes bite.' },
  { key: 'scorpion', name: 'scorpion', emoji: '🦂', level: 3, kind: 'other', homes: ['desert', 'jungle', 'forest', 'grassland', 'mountains'], diet: 'meat', flies: false, legs: 8, fact: 'Scorpions glow under a special purple light.' },

  // Long ago
  { key: 't-rex', name: 'T. rex', spoken: 'T rex', emoji: '🦖', level: 2, kind: 'reptile', homes: ['long-ago'], says: 'Rawr', diet: 'meat', flies: false, legs: 2, fact: 'T. rex was a giant dinosaur that lived long, long ago.' },
  { key: 'long-neck', name: 'long-neck dinosaur', emoji: '🦕', level: 2, kind: 'reptile', homes: ['long-ago'], diet: 'plants', flies: false, legs: 4, fact: 'Long-necked dinosaurs ate leaves from the tops of tall trees.' },
];

export const ANIMAL_BY_KEY: Record<string, Animal> = Object.fromEntries(ANIMALS.map(a => [a.key, a]));

/** "an elephant", "a dog". */
export function withArticle(name: string) {
  return /^[aeiou]/i.test(name) ? `an ${name}` : `a ${name}`;
}
export const spokenName = (a: Animal) => a.spoken ?? a.name;

/** The same animal for everyone on a given day. */
export function animalOfTheDay(date = new Date()) {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return ANIMALS[(day * 7) % ANIMALS.length]!;
}

export const HOME_WORDS: Partial<Record<Home, string>> = {
  ocean: 'in the ocean',
  desert: 'in the hot, dry desert',
  ice: 'where it is icy and cold',
  farm: 'on a farm',
  jungle: 'in the jungle',
  river: 'in rivers and ponds',
};
