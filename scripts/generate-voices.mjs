import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'audio', 'voices');

// Read API key from environment or .env file
const ELEVEN_KEY = process.env.ELEVEN_LABS || (() => {
  try { return fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').match(/ELEVEN_LABS=(.*)/)?.[1]?.trim(); } catch { return ''; }
})();

// ElevenLabs voices — picked for character personality
const VOICES = {
  cute_female: 'cgSgspJ2msm6clMCkdW9',    // Jessica - Playful, Bright, Cute
  quirky_female: 'FGY2WhTYpPnrIDTdsKH5',   // Laura - Quirky, Sassy
  warrior: 'SOYHLrjzK2X1ezoPC6cr',          // Harry - Fierce Warrior
  hyped: 'IKne3meq5aSn9XLyUdCD',            // Charlie - Energetic
  trickster: 'N2lVS1w4EtoT3dr4eOWO',        // Callum - Husky Trickster
  storyteller: 'JBFqnCBsd6RMkjVDRZzb',      // George - British Storyteller
};

// Short, fun, silly lines — no sentences, just exclamations!
const COSTUMES = {
  wrestler: {
    voice: VOICES.warrior,
    lines: {
      ready: 'Wahoo! Let\'s go!',
      attack: 'Bam!',
      hit: 'Owie!',
      death: 'Waaaaah!',
      victory: 'Woohoo! Yeah!',
    },
  },
  chicken: {
    voice: VOICES.cute_female,
    lines: {
      ready: 'Cluck cluck cluck! Here we go!',
      attack: 'Ha!',
      hit: 'Ouch!',
      death: 'Bawk bawk bawwwwk!',
      victory: 'Bawk bawk woohoo!',
    },
  },
  dinosaur: {
    voice: VOICES.hyped,
    lines: {
      ready: 'Rawr rawr!',
      attack: 'Chomp chomp!',
      hit: 'Oww!',
      death: 'Rawwwr noooo!',
      victory: 'Rawr! I win I win!',
    },
  },
  astronaut: {
    voice: VOICES.quirky_female,
    lines: {
      ready: 'Whoosh! Blast off!',
      attack: 'Take that!',
      hit: 'Bonk!',
      death: 'Oh noooo!',
      victory: 'Yippee! To the moon!',
    },
  },
  pirate: {
    voice: VOICES.storyteller,
    lines: {
      ready: 'Arr arr arr!',
      attack: 'Yarr!',
      hit: 'Ooh!',
      death: 'Blimey noo!',
      victory: 'Arr ha ha ha!',
    },
  },
  robot: {
    voice: VOICES.trickster,
    lines: {
      ready: 'Systems online! Ready!',
      attack: 'Pow!',
      hit: 'Ow ow ow!',
      death: 'Shutting down!',
      victory: 'Victory is mine! Woohoo!',
    },
  },
  ninja: {
    voice: VOICES.cute_female,
    lines: {
      ready: 'Hee hee hee!',
      attack: 'Hiyah!',
      hit: 'Eep!',
      death: 'Whoopsie!',
      victory: 'Tee hee! I win!',
    },
  },
  luchador: {
    voice: VOICES.hyped,
    lines: {
      ready: 'Andale andale!',
      attack: 'Pow pow!',
      hit: 'Ay ay ay!',
      death: 'Ayyyy noooo!',
      victory: 'Arriba! Woohoo!',
    },
  },
  redChicken: {
    voice: VOICES.quirky_female,
    lines: {
      ready: 'Red chicken ready! Lets go!',
      attack: 'Ha ha!',
      hit: 'Owie!',
      death: 'Cluck cluck waahh!',
      victory: 'Bawk bawk yeahh!',
    },
  },
};

async function generateVoice(text, voiceId, outPath) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVEN_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.3,           // Low stability = more expressive/varied
        similarity_boost: 0.7,
        style: 0.8,              // High style = more dramatic
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs API error (${res.status}): ${err}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buffer);
  console.log(`  -> ${outPath} (${buffer.length} bytes)`);
}

async function main() {
  console.log('Generating voice lines with ElevenLabs...\n');

  for (const [costume, config] of Object.entries(COSTUMES)) {
    console.log(`${costume}`);
    for (const [line, text] of Object.entries(config.lines)) {
      const outPath = path.join(OUT_DIR, costume, `${line}.mp3`);
      if (fs.existsSync(outPath)) {
        console.log(`  -> ${outPath} (exists, skipping)`);
        continue;
      }
      await generateVoice(text, config.voice, outPath);
      // Small delay to respect rate limits
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log('\nDone! All voice lines generated.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
