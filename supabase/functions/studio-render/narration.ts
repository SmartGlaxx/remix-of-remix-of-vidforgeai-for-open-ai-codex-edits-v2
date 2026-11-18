// Phase 0 narration is locked to the owner's approved script.
export const scenes = [
  "Here's a small question with a surprising answer. You put one hundred dollars aside, and it earns ten percent a year. After one year, you have one hundred and ten dollars. Simple enough. But what happens in year two? That is where it gets interesting.",
  "In year two, you do not just earn ten percent on your first hundred dollars. You earn it on one hundred and ten. Ten percent of one hundred and ten is eleven dollars, so now you have one hundred and twenty-one. Year three, the same thing again — ten percent of one hundred and twenty-one is about twelve dollars. One hundred and thirty-three dollars, from one hundred, and you never added a cent.",
  "That extra dollar, then two dollars — that is the whole idea. The money earns money, and the longer it runs, the faster it grows. Time does the heavy lifting.",
] as const;

interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export function timedWords(text: string, alignment: Alignment) {
  const {characters, character_start_times_seconds: starts, character_end_times_seconds: ends} = alignment;
  if (characters.join("") !== text || starts.length !== characters.length || ends.length !== characters.length) {
    throw new Error("ElevenLabs timing does not match the approved narration.");
  }
  let offset = 0;
  const offsets = new Map<number,number>();
  for (const [index, character] of characters.entries()) {
    offsets.set(offset, index);
    offset += character.length;
  }
  offsets.set(offset, characters.length);
  return Array.from(text.matchAll(/\S+/gu), match => {
    const first = offsets.get(match.index!);
    const after = offsets.get(match.index! + match[0].length);
    if (first === undefined || after === undefined) throw new Error("Invalid word boundary.");
    const start = starts[first], end = ends[after-1];
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) throw new Error("Invalid word timing.");
    return {word: match[0], start, end};
  });
}

export async function narrateScene(index: number, voiceId: string, apiKey: string) {
  const text = scenes[index];
  if (!text || !voiceId.trim()) throw new Error("Select a proof scene and ElevenLabs voice.");
  const response = await fetch(
    "https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(voiceId) + "/with-timestamps?output_format=mp3_44100_128",
    {method:"POST", headers:{"xi-api-key":apiKey, "Content-Type":"application/json"},
      body:JSON.stringify({text, model_id:"eleven_multilingual_v2"})}
  );
  if (!response.ok) throw new Error("ElevenLabs narration failed (HTTP " + response.status + ").");
  const data = await response.json();
  if (!data.alignment || !data.audio_base64) throw new Error("Missing ElevenLabs audio or word timing.");
  return {audio: Uint8Array.from(atob(data.audio_base64), c => c.charCodeAt(0)), words: timedWords(text, data.alignment)};
}

export function chartCues(words: ReturnType<typeof timedWords>) {
  const tokens = words.map(({word}) => word.toLowerCase().replace(/[^a-z-]/g, ""));
  const cues = [
    {value:100, phrase:"first hundred dollars", leadWords:1},
    {value:110, phrase:"one hundred and ten", leadWords:0},
    {value:121, phrase:"one hundred and twenty-one", leadWords:0},
    {value:133, phrase:"one hundred and thirty-three dollars", leadWords:0},
  ];
  return cues.map(({value, phrase, leadWords}) => {
    const phraseWords = phrase.split(" ");
    const first = tokens.findIndex((_, i) => phraseWords.every((token, j) => tokens[i+j] === token));
    if (first < 0) throw new Error("Missing chart cue for $" + value);
    return {value, start:words[first+leadWords].start, end:words[first+phraseWords.length-1].end};
  });
}
