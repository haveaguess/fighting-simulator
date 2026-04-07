import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Read API key from environment or .env file
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || (() => {
  try { return fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').match(/OPENAI_API_KEY=(.*)/)?.[1]?.trim(); } catch { return ''; }
})();

const VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
const TITLE = 'WOBBLY BRAWLER';
const LETTERS_DIR = path.join(__dirname, '..', 'public', 'audio', 'music', 'letters');
const SHOUTS_DIR = path.join(__dirname, '..', 'public', 'audio', 'music');

async function generateSpeech(text, voice, outputPath) {
  console.log(`Generating: "${text}" with voice ${voice} -> ${path.basename(outputPath)}`);
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      voice,
      input: text,
      response_format: 'mp3',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI TTS error (${res.status}): ${err}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
  console.log(`  Saved ${path.basename(outputPath)} (${buffer.length} bytes)`);
}

async function main() {
  // Ensure directories exist
  fs.mkdirSync(LETTERS_DIR, { recursive: true });
  fs.mkdirSync(SHOUTS_DIR, { recursive: true });

  // Generate each letter of "WOBBLY BRAWLER"
  const letters = TITLE.replace(' ', '').split('');
  for (let i = 0; i < letters.length; i++) {
    const letter = letters[i];
    const voice = VOICES[i % VOICES.length];
    const prompt = `${letter}!`;
    const filename = `letter_${i}_${letter.toLowerCase()}.mp3`;
    await generateSpeech(prompt, voice, path.join(LETTERS_DIR, filename));
  }

  // Generate shout clips
  const shouts = [
    { text: 'Wobbly!', voice: 'onyx', file: 'shout_wobbly_1.mp3' },
    { text: 'Wobbly!', voice: 'nova', file: 'shout_wobbly_2.mp3' },
    { text: 'Brawler!', voice: 'echo', file: 'shout_brawler_1.mp3' },
    { text: 'Brawler!', voice: 'fable', file: 'shout_brawler_2.mp3' },
    { text: 'Wobbly Brawler!', voice: 'alloy', file: 'shout_wobbly_brawler.mp3' },
  ];

  for (const shout of shouts) {
    await generateSpeech(shout.text, shout.voice, path.join(SHOUTS_DIR, shout.file));
  }

  console.log('\nDone! All audio files generated.');
}

main().catch(console.error);
