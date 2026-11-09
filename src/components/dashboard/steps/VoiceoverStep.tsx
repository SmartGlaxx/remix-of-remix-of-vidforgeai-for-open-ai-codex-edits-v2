import { useState, useRef, useEffect, useCallback } from "react";
import {
  Volume2, Mic, Play, Pause, Download, Sliders, Loader2, Globe, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useProject } from "@/contexts/ProjectContext";

// Invoke generate-speech; if the backend returns { status: "processing", job_id, endpoint_id },
// keep polling via the same function (it finalizes + rehosts on completion).
async function invokeSpeechWithPolling(
  initialBody: Record<string, unknown>,
  { maxAttempts = 30, intervalMs = 5000 }: { maxAttempts?: number; intervalMs?: number } = {},
): Promise<any> {
  const { data, error } = await supabase.functions.invoke("generate-speech", { body: initialBody });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  let current = data;
  let attempts = 0;
  while (current?.status === "processing" && current?.job_id) {
    if (attempts++ >= maxAttempts) {
      throw new Error("Voice generation is taking longer than expected. Please try again.");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
    const { data: pollData, error: pollErr } = await supabase.functions.invoke("generate-speech", {
      body: { job_id: current.job_id, endpoint_id: current.endpoint_id, response_format: initialBody.response_format },
    });
    if (pollErr) throw pollErr;
    if (pollData?.error) throw new Error(pollData.error);
    current = pollData;
  }
  return current;
}

const sampleTexts: Record<string, string> = {
  af_alloy: "The future belongs to those who believe in the beauty of their dreams.",
  af_aoede: "Every sunrise brings a new melody to the world, waiting to be heard.",
  af_bella: "In the heart of every story lies a truth that words alone cannot capture.",
  af_heart: "Sometimes the smallest step in the right direction ends up being the biggest step of your life.",
  af_jadzia: "Leadership is not about being in charge. It's about taking care of those in your charge.",
  af_jessica: "Hey there! Life's too short to take everything so seriously, right?",
  af_kore: "Close your eyes and imagine a world where anything is possible.",
  af_nicole: "Our quarterly report shows a significant improvement in overall performance metrics.",
  af_nova: "Get ready for an incredible journey that will change everything you know!",
  af_river: "The river flows gently through the valley, carrying stories from the mountains.",
  af_sarah: "So I was thinking, what if we tried something completely different this time?",
  af_sky: "Light dances across the morning sky, painting everything in gold.",
  am_adam: "In a world of constant change, wisdom remains our greatest anchor.",
  am_echo: "Once upon a time, in a land far away, there lived a traveler with a story to tell.",
  am_eric: "The data clearly indicates a steady upward trend across all key indicators.",
  am_fenrir: "Break through the barriers. Push past the limits. This is your moment.",
  am_liam: "Yeah, I just figured we'd keep things simple and see what happens.",
  am_michael: "Today we'll be covering the fundamental principles of modern architecture.",
  am_onyx: "Deep beneath the surface, ancient forces shape the world we know.",
  am_puck: "Alright, buckle up everyone, because this is going to be a wild ride!",
  bf_alice: "The exhibition at the Royal Academy this season is absolutely extraordinary.",
  bf_emma: "I find that a cup of tea and a good conversation can solve most problems.",
  bf_isabella: "The elegance of simplicity is often overlooked in modern design.",
  bf_lily: "Let me tell you about the most wonderful garden I discovered last spring.",
  bm_daniel: "Throughout history, great civilizations have risen on the foundations of knowledge.",
  bm_fable: "And so the old storyteller began, his voice weaving magic in the firelight.",
  bm_george: "The traditions we uphold today are the pillars of our shared heritage.",
  bm_lewis: "If we consider the evidence carefully, a clear pattern begins to emerge.",
  jf_alpha: "桜の花が風に舞い、春の訪れを告げています。",
  jf_gongitsune: "昔々、ある山の中に小さな狐が住んでいました。",
  jf_nezumi: "静かな夜に、月の光が優しく降り注いでいます。",
  jf_tebukuro: "森の中で見つけた手袋には、不思議な力がありました。",
  jm_kumo: "空に浮かぶ雲は、自由の象徴のようです。",
  zf_xiaobei: "阳光透过窗户洒进来，新的一天开始了。",
  zf_xiaoni: "让我们一起来探索这个美丽的世界吧。",
  zf_xiaoxiao: "每一个清晨都带来新的希望和可能。",
  zf_xiaoyi: "知识是通往成功最可靠的桥梁。",
  zm_yunjian: "在这个伟大的时代，我们都是历史的见证者。",
  zm_yunxi: "温暖的春风吹过田野，带来了花的芳香。",
  zm_yunxia: "让我们携手共创美好的明天。",
  zm_yunyang: "各位听众朋友们，欢迎收听今天的节目。",
  kf_saebyeok: "새벽의 첫 빛이 세상을 부드럽게 깨우고 있습니다.",
  kf_soyeon: "오늘도 좋은 하루가 되길 바랍니다.",
  ff_siwis: "La beauté du monde se révèle à ceux qui prennent le temps de regarder.",
  hf_alpha: "हर सुबह एक नई शुरुआत और नई उम्मीद लेकर आती है।",
  hf_beta: "ज़िंदगी में छोटी छोटी खुशियाँ सबसे ज़्यादा मायने रखती हैं।",
  hm_omega: "ज्ञान ही सबसे बड़ी शक्ति है और शिक्षा उसका मार्ग।",
  hm_psi: "आइए मिलकर एक बेहतर कल का निर्माण करें।",
  if_sara: "La bellezza dell'Italia si riflette in ogni angolo delle sue città.",
  im_nicola: "Buongiorno a tutti, oggi parleremo di un argomento molto interessante.",
  pf_dora: "A beleza da vida está nas pequenas coisas que muitas vezes não percebemos.",
  pm_alex: "Vamos descobrir juntos o que o futuro nos reserva.",
  pm_santa: "Cada dia é uma nova oportunidade para fazer a diferença.",
  ef_dora: "La vida es un viaje lleno de momentos maravillosos por descubrir.",
  em_alex: "Vamos a explorar juntos las maravillas que el mundo tiene para ofrecer.",
  em_santa: "Cada amanecer trae consigo la promesa de un nuevo comienzo.",
};

const allVoices = [
  { id: "af_alloy", name: "Alloy", style: "Neutral & Versatile", lang: "en-us", gender: "female", accent: "American" },
  { id: "af_aoede", name: "Aoede", style: "Bright & Melodic", lang: "en-us", gender: "female", accent: "American" },
  { id: "af_bella", name: "Bella", style: "Clear & Expressive", lang: "en-us", gender: "female", accent: "American" },
  { id: "af_heart", name: "Heart", style: "Warm & Natural", lang: "en-us", gender: "female", accent: "American" },
  { id: "af_jadzia", name: "Jadzia", style: "Confident & Bold", lang: "en-us", gender: "female", accent: "American" },
  { id: "af_jessica", name: "Jessica", style: "Friendly & Casual", lang: "en-us", gender: "female", accent: "American" },
  { id: "af_kore", name: "Kore", style: "Gentle & Soothing", lang: "en-us", gender: "female", accent: "American" },
  { id: "af_nicole", name: "Nicole", style: "Calm & Professional", lang: "en-us", gender: "female", accent: "American" },
  { id: "af_nova", name: "Nova", style: "Energetic & Bright", lang: "en-us", gender: "female", accent: "American" },
  { id: "af_river", name: "River", style: "Smooth & Flowing", lang: "en-us", gender: "female", accent: "American" },
  { id: "af_sarah", name: "Sarah", style: "Friendly & Conversational", lang: "en-us", gender: "female", accent: "American" },
  { id: "af_sky", name: "Sky", style: "Light & Airy", lang: "en-us", gender: "female", accent: "American" },
  { id: "am_adam", name: "Adam", style: "Deep & Authoritative", lang: "en-us", gender: "male", accent: "American" },
  { id: "am_echo", name: "Echo", style: "Warm & Narrative", lang: "en-us", gender: "male", accent: "American" },
  { id: "am_eric", name: "Eric", style: "Clear & Steady", lang: "en-us", gender: "male", accent: "American" },
  { id: "am_fenrir", name: "Fenrir", style: "Bold & Dynamic", lang: "en-us", gender: "male", accent: "American" },
  { id: "am_liam", name: "Liam", style: "Casual & Relaxed", lang: "en-us", gender: "male", accent: "American" },
  { id: "am_michael", name: "Michael", style: "Neutral & Steady", lang: "en-us", gender: "male", accent: "American" },
  { id: "am_onyx", name: "Onyx", style: "Rich & Deep", lang: "en-us", gender: "male", accent: "American" },
  { id: "am_puck", name: "Puck", style: "Playful & Energetic", lang: "en-us", gender: "male", accent: "American" },
  { id: "bf_alice", name: "Alice", style: "Elegant & Articulate", lang: "en-gb", gender: "female", accent: "British" },
  { id: "bf_emma", name: "Emma", style: "Warm & Clear", lang: "en-gb", gender: "female", accent: "British" },
  { id: "bf_isabella", name: "Isabella", style: "Refined & Poised", lang: "en-gb", gender: "female", accent: "British" },
  { id: "bf_lily", name: "Lily", style: "Gentle & Kind", lang: "en-gb", gender: "female", accent: "British" },
  { id: "bm_daniel", name: "Daniel", style: "Authoritative & Warm", lang: "en-gb", gender: "male", accent: "British" },
  { id: "bm_fable", name: "Fable", style: "Storytelling & Rich", lang: "en-gb", gender: "male", accent: "British" },
  { id: "bm_george", name: "George", style: "Classic & Refined", lang: "en-gb", gender: "male", accent: "British" },
  { id: "bm_lewis", name: "Lewis", style: "Calm & Measured", lang: "en-gb", gender: "male", accent: "British" },
  { id: "jf_alpha", name: "Alpha", style: "Natural", lang: "ja", gender: "female", accent: "Japanese" },
  { id: "jf_gongitsune", name: "Gongitsune", style: "Soft & Warm", lang: "ja", gender: "female", accent: "Japanese" },
  { id: "jf_nezumi", name: "Nezumi", style: "Gentle", lang: "ja", gender: "female", accent: "Japanese" },
  { id: "jf_tebukuro", name: "Tebukuro", style: "Clear", lang: "ja", gender: "female", accent: "Japanese" },
  { id: "jm_kumo", name: "Kumo", style: "Steady", lang: "ja", gender: "male", accent: "Japanese" },
  { id: "zf_xiaobei", name: "Xiaobei", style: "Bright", lang: "zh", gender: "female", accent: "Chinese" },
  { id: "zf_xiaoni", name: "Xiaoni", style: "Warm", lang: "zh", gender: "female", accent: "Chinese" },
  { id: "zf_xiaoxiao", name: "Xiaoxiao", style: "Natural", lang: "zh", gender: "female", accent: "Chinese" },
  { id: "zf_xiaoyi", name: "Xiaoyi", style: "Clear", lang: "zh", gender: "female", accent: "Chinese" },
  { id: "zm_yunjian", name: "Yunjian", style: "Strong", lang: "zh", gender: "male", accent: "Chinese" },
  { id: "zm_yunxi", name: "Yunxi", style: "Warm", lang: "zh", gender: "male", accent: "Chinese" },
  { id: "zm_yunxia", name: "Yunxia", style: "Gentle", lang: "zh", gender: "male", accent: "Chinese" },
  { id: "zm_yunyang", name: "Yunyang", style: "Authoritative", lang: "zh", gender: "male", accent: "Chinese" },
  { id: "kf_saebyeok", name: "Saebyeok", style: "Warm", lang: "ko", gender: "female", accent: "Korean" },
  { id: "kf_soyeon", name: "Soyeon", style: "Clear", lang: "ko", gender: "female", accent: "Korean" },
  { id: "ff_siwis", name: "Siwis", style: "Elegant", lang: "fr", gender: "female", accent: "French" },
  { id: "hf_alpha", name: "Alpha", style: "Natural", lang: "hi", gender: "female", accent: "Hindi" },
  { id: "hf_beta", name: "Beta", style: "Warm", lang: "hi", gender: "female", accent: "Hindi" },
  { id: "hm_omega", name: "Omega", style: "Deep", lang: "hi", gender: "male", accent: "Hindi" },
  { id: "hm_psi", name: "Psi", style: "Clear", lang: "hi", gender: "male", accent: "Hindi" },
  { id: "if_sara", name: "Sara", style: "Warm", lang: "it", gender: "female", accent: "Italian" },
  { id: "im_nicola", name: "Nicola", style: "Steady", lang: "it", gender: "male", accent: "Italian" },
  { id: "pf_dora", name: "Dora", style: "Clear", lang: "pt", gender: "female", accent: "Portuguese" },
  { id: "pm_alex", name: "Alex", style: "Natural", lang: "pt", gender: "male", accent: "Portuguese" },
  { id: "pm_santa", name: "Santa", style: "Warm", lang: "pt", gender: "male", accent: "Portuguese" },
  { id: "ef_dora", name: "Dora", style: "Clear", lang: "es", gender: "female", accent: "Spanish" },
  { id: "em_alex", name: "Alex", style: "Natural", lang: "es", gender: "male", accent: "Spanish" },
  { id: "em_santa", name: "Santa", style: "Warm", lang: "es", gender: "male", accent: "Spanish" },
];

const languages = [
  { code: "all", label: "All Languages" },
  { code: "en-us", label: "English (US)" },
  { code: "en-gb", label: "English (UK)" },
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese" },
  { code: "ko", label: "Korean" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "hi", label: "Hindi" },
];

const VoiceoverStep = () => {
  const { scriptSections, voice: ctxVoice, setVoice: setCtxVoice, setAudioDuration, voiceoverTracks, setVoiceoverTracks } = useProject();
  const scriptText = scriptSections.map((s) => s.text).join("\n\n").trim();
  const [selectedVoice, setSelectedVoice] = useState(ctxVoice || "af_bella");
  const [text, setText] = useState(scriptText);
  const [speed, setSpeed] = useState(1.0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(voiceoverTracks.filter(track => track.status === "done" && track.url).at(-1)?.url ?? null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [langFilter, setLangFilter] = useState("en-us");
  const [searchQuery, setSearchQuery] = useState("");

  // If script becomes available later (user navigated back), prefill once when empty
  useEffect(() => {
    if (!text && scriptText) setText(scriptText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptText]);

  // Sample audio state
  const [sampleCache, setSampleCache] = useState<Record<string, string>>({});
  const [loadingSample, setLoadingSample] = useState<string | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

  // Main generation audio
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const filteredVoices = allVoices.filter((v) => {
    const matchesLang = langFilter === "all" || v.lang === langFilter;
    const matchesSearch =
      searchQuery === "" ||
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.style.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.accent.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLang && matchesSearch;
  });

  const selectedVoiceData = allVoices.find((v) => v.id === selectedVoice);

  // Main audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onDur = () => {
      setDuration(audio.duration);
      if (isFinite(audio.duration)) setAudioDuration(audio.duration);
    };
    const onEnd = () => setIsPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDur);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDur);
      audio.removeEventListener("ended", onEnd);
    };
  }, [audioUrl]);

  // Stop sample audio when component unmounts
  useEffect(() => {
    return () => {
      if (sampleAudioRef.current) {
        sampleAudioRef.current.pause();
        sampleAudioRef.current = null;
      }
    };
  }, []);

  const stopSampleAudio = useCallback(() => {
    if (sampleAudioRef.current) {
      sampleAudioRef.current.pause();
      sampleAudioRef.current.currentTime = 0;
    }
    setPlayingVoiceId(null);
  }, []);

  const handleSamplePlay = useCallback(
    async (voiceId: string, e: React.MouseEvent) => {
      e.stopPropagation();

      // If this voice is already playing, pause it
      if (playingVoiceId === voiceId) {
        stopSampleAudio();
        return;
      }

      // Stop any currently playing sample
      stopSampleAudio();

      // If cached, play immediately
      if (sampleCache[voiceId]) {
        const audio = new Audio(sampleCache[voiceId]);
        sampleAudioRef.current = audio;
        setPlayingVoiceId(voiceId);
        audio.onended = () => setPlayingVoiceId(null);
        audio.play().catch(() => setPlayingVoiceId(null));
        return;
      }

      // Generate sample
      const voice = allVoices.find((v) => v.id === voiceId);
      if (!voice) return;

      setLoadingSample(voiceId);
      try {
        const sampleText = sampleTexts[voiceId] || "Hello, this is a sample of my voice.";
        const data = await invokeSpeechWithPolling({
          text: sampleText,
          voice: voiceId,
          speed: 1.0,
          response_format: "mp3",
          language: voice.lang,
        });
        const url = data.audio_url;
        setSampleCache((prev) => ({ ...prev, [voiceId]: url }));

        const audio = new Audio(url);
        sampleAudioRef.current = audio;
        setPlayingVoiceId(voiceId);
        audio.onended = () => setPlayingVoiceId(null);
        audio.play().catch(() => setPlayingVoiceId(null));
      } catch (err: any) {
        console.error("Sample generation error:", err);
        toast.error(err.message || "Failed to generate voice sample");
      } finally {
        setLoadingSample(null);
      }
    },
    [playingVoiceId, sampleCache, stopSampleAudio]
  );

  const handleVoiceSelect = (voiceId: string) => {
    // Stop sample if switching voice
    if (playingVoiceId && playingVoiceId !== voiceId) {
      stopSampleAudio();
    }
    setSelectedVoice(voiceId);
    setCtxVoice(voiceId);
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast.error("Please enter text to generate speech");
      return;
    }
    stopSampleAudio();
    setIsGenerating(true);
    try {
      const voice = allVoices.find((v) => v.id === selectedVoice);
      const data = await invokeSpeechWithPolling({
        text: text.trim(),
        voice: selectedVoice,
        speed,
        response_format: "mp3",
        language: voice?.lang || "en-us",
      });
      if (!data.audio_url) throw new Error("No voiceover audio returned");
      setAudioUrl(data.audio_url);
      setVoiceoverTracks(previous => [...previous, { id: crypto.randomUUID(), segment: text.trim().slice(0, 80), status: "done", url: data.audio_url, created_at: Date.now() }]);
      toast.success(`Generated ${data.characters} characters of speech`);
    } catch (err: any) {
      console.error("TTS error:", err);
      toast.error(err.message || "Failed to generate speech");
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    stopSampleAudio();
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* Text input */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/20">
            <Mic className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground">Voice Studio</h3>
            <p className="text-xs text-muted-foreground">
              Generate AI voiceover • Click play on any voice to preview
            </p>
          </div>
        </div>

        <Textarea
          placeholder="Enter or paste your script here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[120px] bg-background/60 border-border/50 mb-2 resize-none"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground mb-5">
          <span>{text.length.toLocaleString()} characters</span>
          <span>Max 10,000</span>
        </div>

        {/* Language filter */}
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <select
            value={langFilter}
            onChange={(e) => setLangFilter(e.target.value)}
            className="text-xs bg-background/60 border border-border/50 rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <div className="flex-1 relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search voices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-background/60 border border-border/50 rounded-lg pl-8 pr-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>

        {/* Voice grid */}
        <div className="grid grid-cols-2 gap-2 mb-5 max-h-[320px] overflow-y-auto pr-1">
          {filteredVoices.map((voice) => {
            const isThisPlaying = playingVoiceId === voice.id;
            const isThisLoading = loadingSample === voice.id;
            const hasCached = !!sampleCache[voice.id];

            return (
              <div
                key={voice.id}
                role="button"
                tabIndex={0}
                onClick={() => handleVoiceSelect(voice.id)}
                className={`p-3 rounded-xl border text-left transition-all group relative cursor-pointer ${
                  selectedVoice === voice.id
                    ? "border-primary/40 bg-primary/8 shadow-lg shadow-primary/5"
                    : "border-border hover:border-primary/20 hover:bg-secondary/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                      selectedVoice === voice.id
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {voice.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-foreground block truncate">
                      {voice.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{voice.style}</span>
                  </div>

                  {/* Play/Pause sample button */}
                  <div
                    role="button"
                    onClick={(e) => handleSamplePlay(voice.id, e)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      isThisPlaying
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                        : isThisLoading
                        ? "bg-primary/20 text-primary"
                        : hasCached
                        ? "bg-primary/15 text-primary hover:bg-primary/25"
                        : "bg-secondary text-muted-foreground hover:bg-primary/20 hover:text-primary"
                    }`}
                  >
                    {isThisLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : isThisPlaying ? (
                      <Pause className="w-3 h-3" />
                    ) : (
                      <Play className="w-3 h-3 ml-0.5" />
                    )}
                  </div>
                </div>

                {/* Sample text preview */}
                <p className="text-[10px] text-muted-foreground/70 leading-tight line-clamp-2 mb-1.5 italic">
                  "{sampleTexts[voice.id]?.slice(0, 80) || "Hello, this is a sample of my voice."}
                  ..."
                </p>

                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="px-1.5 py-0.5 rounded bg-secondary/60">{voice.accent}</span>
                  <span className="capitalize">{voice.gender}</span>
                  {hasCached && (
                    <span className="ml-auto text-primary/60">
                      <Volume2 className="w-3 h-3 inline" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {filteredVoices.length === 0 && (
            <p className="col-span-2 text-center text-xs text-muted-foreground py-8">
              No voices match your filters
            </p>
          )}
        </div>

        {/* Speed control */}
        <div className="bg-secondary/30 rounded-xl p-4 mb-5 border border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <Sliders className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Speed</span>
            <span className="ml-auto text-xs text-primary font-semibold">{speed.toFixed(1)}x</span>
          </div>
          <Slider
            value={[speed]}
            onValueChange={([v]) => setSpeed(v)}
            min={0.5}
            max={2.0}
            step={0.1}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>0.5x</span>
            <span>2.0x</span>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !text.trim()}
          className="w-full glow-sm h-11"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 mr-2" /> Generate Voiceover
              {selectedVoiceData && (
                <span className="ml-1 opacity-70">• {selectedVoiceData.name}</span>
              )}
            </>
          )}
        </Button>
      </div>

      {/* Audio preview */}
      {audioUrl && (
        <div className="glass-card p-6">
          <h3 className="font-display font-semibold text-foreground mb-4">Generated Audio</h3>
          <audio ref={audioRef} src={audioUrl} preload="metadata" />
          <div className="bg-background/60 rounded-xl p-5 border border-border/50">
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={togglePlay}
                className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-shadow flex-shrink-0"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-primary-foreground" />
                ) : (
                  <Play className="w-5 h-5 text-primary-foreground ml-0.5" />
                )}
              </button>
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>{formatTime(currentTime)}</span>
                  <span>{duration ? formatTime(duration) : "0:00"}</span>
                </div>
                <div
                  className="h-2 bg-muted rounded-full overflow-hidden cursor-pointer"
                  onClick={(e) => {
                    if (!audioRef.current || !duration) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = (e.clientX - rect.left) / rect.width;
                    audioRef.current.currentTime = pct * duration;
                  }}
                >
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all"
                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <a
                href={audioUrl}
                download
                className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Volume2 className="w-3 h-3" />
              <span>Voice: {selectedVoiceData?.name}</span>
              <span>•</span>
              <span>Speed: {speed}x</span>
              <span>•</span>
              <span>Format: MP3</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceoverStep;
