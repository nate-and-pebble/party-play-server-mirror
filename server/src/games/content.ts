/** Static content banks for the launch games. Family/party-appropriate. */

export const QUIBBLE_PROMPTS: string[] = [
  'A terrible name for a cruise ship',
  'The worst possible thing to say on a first date',
  'A rejected slogan for a brand of toothpaste',
  'What aliens would be most confused about on Earth',
  'A bad name for a superhero',
  'The real reason the dinosaurs went extinct',
  'A terrible theme for a wedding',
  'The worst superpower to have',
  'A surprising item to find in a time capsule',
  'A bad motivational poster caption',
  'The most useless invention ever',
  'What your pet is REALLY thinking about you',
  'A terrible name for a boy band',
  'The worst possible fortune cookie message',
  'An awful name for a new ice cream flavor',
  'What you’d find in a vending machine in the underworld',
  'A bad reason to call in sick to work',
  'The worst thing to hear from your pilot',
  'A rejected name for the planet Earth',
  'A terrible feature for a new smartphone',
  'The worst possible thing to whisper at a funeral',
  'A bad name for a national holiday',
  'What the last text message on Earth will say',
  'A terrible theme park ride',
  'An honest slogan for the city you live in',
  'The worst possible superhero catchphrase',
  'A bad name for a perfume',
  'Something you should never microwave',
  'The worst possible thing to find in your salad',
  'A terrible piece of advice for newlyweds',
  'A rejected emoji nobody asked for',
  'The worst possible name for a hospital',
  'What a dog would say if it could talk for one minute',
  'A bad name for a cereal aimed at adults',
  'The worst possible thing to be famous for',
  'A terrible idea for a children’s TV show',
  'A surprising thing to keep in your freezer',
  'The worst possible password',
  'A bad name for a roller coaster',
  'Something you’d regret saying to a robot',
];

export interface TriviaQuestion {
  category: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
}

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  { category: 'Geography', question: 'What is the smallest country in the world by area?', options: ['Monaco', 'Vatican City', 'Nauru', 'San Marino'], correctIndex: 1 },
  { category: 'Science', question: 'What is the most abundant gas in Earth’s atmosphere?', options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'], correctIndex: 2 },
  { category: 'Pop Culture', question: 'Which planet is featured in the movie title with Matt Damon stranded on it?', options: ['Venus', 'Jupiter', 'Mars', 'Saturn'], correctIndex: 2 },
  { category: 'History', question: 'In what year did the first humans land on the Moon?', options: ['1965', '1969', '1972', '1959'], correctIndex: 1 },
  { category: 'Animals', question: 'What is a group of crows called?', options: ['A murder', 'A flock', 'A gaggle', 'A pod'], correctIndex: 0 },
  { category: 'Food', question: 'Which fruit has its seeds on the outside?', options: ['Kiwi', 'Strawberry', 'Blueberry', 'Grape'], correctIndex: 1 },
  { category: 'Science', question: 'How many bones are in the adult human body?', options: ['206', '186', '226', '198'], correctIndex: 0 },
  { category: 'Geography', question: 'Which river is the longest in the world?', options: ['Amazon', 'Yangtze', 'Nile', 'Mississippi'], correctIndex: 2 },
  { category: 'Music', question: 'How many keys are on a standard piano?', options: ['76', '88', '92', '64'], correctIndex: 1 },
  { category: 'Sports', question: 'How many players are on the field per team in soccer?', options: ['9', '10', '11', '12'], correctIndex: 2 },
  { category: 'Space', question: 'What is the closest planet to the Sun?', options: ['Venus', 'Earth', 'Mercury', 'Mars'], correctIndex: 2 },
  { category: 'History', question: 'Who painted the Mona Lisa?', options: ['Michelangelo', 'Raphael', 'Da Vinci', 'Donatello'], correctIndex: 2 },
  { category: 'Science', question: 'What is the chemical symbol for gold?', options: ['Gd', 'Au', 'Ag', 'Go'], correctIndex: 1 },
  { category: 'Animals', question: 'What is the fastest land animal?', options: ['Lion', 'Cheetah', 'Pronghorn', 'Greyhound'], correctIndex: 1 },
  { category: 'Geography', question: 'On which continent is the Sahara Desert?', options: ['Asia', 'Australia', 'Africa', 'South America'], correctIndex: 2 },
  { category: 'Pop Culture', question: 'What does the “www” stand for in a website browser?', options: ['World Wide Web', 'Web Wide World', 'Wide World Web', 'World Web Wide'], correctIndex: 0 },
  { category: 'Food', question: 'What is the main ingredient in guacamole?', options: ['Pea', 'Avocado', 'Cucumber', 'Lime'], correctIndex: 1 },
  { category: 'Science', question: 'What planet is known as the Red Planet?', options: ['Jupiter', 'Mars', 'Mercury', 'Venus'], correctIndex: 1 },
  { category: 'History', question: 'The Great Wall is located in which country?', options: ['Japan', 'India', 'China', 'Mongolia'], correctIndex: 2 },
  { category: 'Music', question: 'Which instrument has 6 strings in its standard form?', options: ['Violin', 'Guitar', 'Cello', 'Banjo'], correctIndex: 1 },
  { category: 'Movies', question: 'In “The Lion King”, what kind of animal is Pumbaa?', options: ['Meerkat', 'Warthog', 'Hyena', 'Boar'], correctIndex: 1 },
  { category: 'Science', question: 'What gas do plants absorb from the atmosphere?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'], correctIndex: 2 },
  { category: 'Geography', question: 'What is the capital of Australia?', options: ['Sydney', 'Melbourne', 'Canberra', 'Perth'], correctIndex: 2 },
  { category: 'Body', question: 'Which organ pumps blood through the body?', options: ['Liver', 'Lungs', 'Heart', 'Kidney'], correctIndex: 2 },
  { category: 'Tech', question: 'What does “CPU” stand for?', options: ['Central Process Unit', 'Central Processing Unit', 'Computer Personal Unit', 'Central Power Unit'], correctIndex: 1 },
  { category: 'Animals', question: 'How many hearts does an octopus have?', options: ['1', '2', '3', '4'], correctIndex: 2 },
  { category: 'Geography', question: 'Mount Everest sits on the border of Nepal and which country?', options: ['India', 'China', 'Bhutan', 'Pakistan'], correctIndex: 1 },
  { category: 'Food', question: 'Which country is credited with inventing pizza?', options: ['Greece', 'France', 'Italy', 'Spain'], correctIndex: 2 },
  { category: 'Science', question: 'At what temperature (°C) does water boil at sea level?', options: ['90', '100', '110', '80'], correctIndex: 1 },
  { category: 'Space', question: 'Which is the largest planet in our solar system?', options: ['Saturn', 'Neptune', 'Jupiter', 'Uranus'], correctIndex: 2 },
  { category: 'History', question: 'Who was the first President of the United States?', options: ['Jefferson', 'Lincoln', 'Washington', 'Adams'], correctIndex: 2 },
  { category: 'Animals', question: 'What is the only mammal capable of true flight?', options: ['Flying squirrel', 'Bat', 'Sugar glider', 'Colugo'], correctIndex: 1 },
];

export interface DoodleWordSet {
  easy: string[];
  medium: string[];
  hard: string[];
}

export const DOODLE_WORDS: DoodleWordSet = {
  easy: ['cat', 'sun', 'house', 'tree', 'fish', 'star', 'apple', 'car', 'hat', 'boat', 'cloud', 'flower', 'moon', 'cake', 'duck', 'snake', 'cup', 'key', 'ball', 'bird'],
  medium: ['robot', 'pirate', 'rainbow', 'rocket', 'castle', 'guitar', 'volcano', 'octopus', 'igloo', 'lighthouse', 'dragon', 'cactus', 'snowman', 'umbrella', 'dinosaur', 'mermaid', 'tornado', 'sandwich', 'penguin', 'spider'],
  hard: ['gravity', 'democracy', 'photosynthesis', 'procrastination', 'déjà vu', 'time travel', 'awkward', 'introvert', 'recursion', 'nostalgia', 'karaoke', 'tightrope', 'eclipse', 'origami', 'avalanche', 'metamorphosis'],
};
