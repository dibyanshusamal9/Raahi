"use client";

import React, { useEffect, useState, useRef, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PhoneOff, Mic, MicOff, X, Send, Volume2, Loader2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { sendTurn, newCallerId, transcribeAudio, SimulatorResponse } from "@/api/simulator";

type CallState = "connecting" | "connected" | "ended";

// How long the caller can pause before their spoken answer is sent.
const SILENCE_MS = 1800;

// Every answer is recorded and transcribed by Sarvam in the caller's own
// language (the browser's recogniser hears many Indian languages as English).
const VAD_INTERVAL_MS = 100;    // how often the mic level is checked
const MIN_SPEECH_MS = 250;      // this much sound means the caller is speaking
const MAX_ANSWER_MS = 30000;    // longest single answer that is recorded

type Message = {
  id: string;
  speaker: "RAAHI" | "USER";
  text: string;
};

type ExtractedData = {
  DISTRICT?: string | null;
  AGE?: string | null;
  PREFERENCE?: string | null;
  "SKILL INTENT"?: string | null;
};

interface CallExperienceProps {
  isActive: boolean;
  onClose: () => void;
}

// Languages whose "{score}%" label is written in their own digits.
const NATIVE_DIGITS: Record<string, string> = { bn: "beng" };

// RAAHI's voice is recorded by the backend (Sarvam). When it sends no audio
// for a line (the speech service is down or out of credits), the device's own
// voice reads the line instead, if the device has one for the call language.
const SPEECH_LOCALE: Record<string, string> = {
  en: "en-IN", hi: "hi-IN", bn: "bn-IN", gu: "gu-IN", kn: "kn-IN", ml: "ml-IN",
  mr: "mr-IN", or: "or-IN", pa: "pa-IN", ta: "ta-IN", te: "te-IN",
};

function deviceVoice(language: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const locale = (SPEECH_LOCALE[language] || language).toLowerCase();
  const tag = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace("_", "-");
  const voices = window.speechSynthesis.getVoices();
  return voices.find(v => tag(v) === locale)
    || voices.find(v => tag(v).split("-")[0] === locale.split("-")[0])
    || null;
}

// Something RAAHI says: a recorded clip, or a line for the device to read.
type Clip = { url: string } | { text: string };

// The browser's own speech recogniser, if it has one (Chrome, Edge).
function browserRecognizer(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

// The backend's 0-100 match score, in the language's digits.
function formatScore(score: number, language: string): string {
  const numbering = NATIVE_DIGITS[language];
  return numbering ? new Intl.NumberFormat(`en-u-nu-${numbering}`).format(score) : String(score);
}

export default function CallExperience({ isActive, onClose }: CallExperienceProps) {
  const [callState, setCallState] = useState<CallState>("connecting");
  const [timer, setTimer] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [extracted, setExtracted] = useState<ExtractedData>({});
  const [reduceMotion, setReduceMotion] = useState(false);
  const { t, language } = useLanguage();

  // Real backend integration state
  const [sessionId, setSessionId] = useState<string | null>(null);
  // One phone ID per call: every turn must reach the same caller and session.
  const callerIdRef = useRef<string>(newCallerId());
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [top3, setTop3] = useState<any[] | null>(null);

  // Voice loop. RAAHI speaks; when she has asked a question the mic listens
  // by itself and sends the answer once the caller pauses, so nobody has to
  // press Enter. The text bar stays as a fallback.
  const [micOn, setMicOn] = useState(true);          // the caller can mute it
  const [micSupported, setMicSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const micOnRef = useRef(true);
  const callLiveRef = useRef(false);         // connected and not ended
  const processingRef = useRef(false);
  const awaitingAnswerRef = useRef(false);   // RAAHI's last line was a question
  const wantListenRef = useRef(false);       // waiting for the caller's answer
  const audioQueueRef = useRef<Clip[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Speech recognition: the answer is recorded and transcribed by Sarvam.
  const [isTranscribing, setIsTranscribing] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const vadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // When the speech service can't transcribe (down or out of credits), the
  // browser's own recogniser takes over for the rest of the call.
  const browserSttRef = useRef(false);
  const recognitionRef = useRef<any>(null);

  // Ref for auto-scrolling transcript
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Formatting time
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const turnMicOff = (message: string) => {
    setMicError(message);
    micOnRef.current = false;
    setMicOn(false);
    wantListenRef.current = false;
  };

  const stopListening = () => {
    wantListenRef.current = false;
    // Drop the current recording without sending it.
    if (vadTimerRef.current) {
      clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      recorder.onstop = null;
      try { recorder.stop(); } catch { /* already stopped */ }
    }
    chunksRef.current = [];
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try { recognition.abort(); } catch { /* already stopped */ }
    }
    setIsListening(false);
  };

  // Let go of the microphone (end of call).
  const releaseMic = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => { /* already closed */ });
    audioCtxRef.current = null;
    analyserRef.current = null;
  };

  // Record the answer, notice from the mic level when the caller has spoken
  // and then paused, and have the backend (Sarvam) transcribe it in the
  // caller's own language.
  const startRecording = async () => {
    if (browserSttRef.current) {
      startBrowserRecognition();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === "undefined") {
      setMicSupported(false);
      micOnRef.current = false;
      setMicOn(false);
      return;
    }
    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      }
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx: AudioContext = new AudioContextClass();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        ctx.createMediaStreamSource(streamRef.current).connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
      }
      if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
    } catch (err: any) {
      turnMicOff(err?.name === "NotAllowedError"
        ? "Microphone access is blocked. Allow it in your browser, or type your reply below."
        : "No microphone was found. Please type your reply below.");
      return;
    }
    // Stopped while waiting for permission, or already recording.
    if (!wantListenRef.current || recorderRef.current || !streamRef.current || !analyserRef.current) return;

    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]
      .find(type => MediaRecorder.isTypeSupported(type));
    const recorder = mimeType
      ? new MediaRecorder(streamRef.current, { mimeType })
      : new MediaRecorder(streamRef.current);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorderRef.current = recorder;
    recorder.start(250);
    setIsListening(true);
    setMicError(null);

    const analyser = analyserRef.current;
    const samples = new Float32Array(analyser.fftSize);
    const startedAt = performance.now();
    let lastSoundAt = startedAt;
    let soundMs = 0;
    let spoke = false;
    let noise = 0.01;                 // running background level
    vadTimerRef.current = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
      const level = Math.sqrt(sum / samples.length);
      const now = performance.now();
      if (level > Math.max(0.02, noise * 3)) {
        soundMs += VAD_INTERVAL_MS;
        lastSoundAt = now;
        if (soundMs >= MIN_SPEECH_MS) spoke = true;
      } else {
        noise = noise * 0.95 + level * 0.05;
        if (!spoke) soundMs = 0;
      }
      if (spoke && now - lastSoundAt > SILENCE_MS) finishRecordingRef.current(true);
      else if (now - startedAt > MAX_ANSWER_MS) finishRecordingRef.current(spoke);
    }, VAD_INTERVAL_MS);
  };

  // Stop recording; send it for transcription if the caller spoke, otherwise
  // start a fresh recording and keep waiting.
  const finishRecording = (send: boolean) => {
    if (vadTimerRef.current) {
      clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setIsListening(false);
    if (!recorder) return;
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      chunksRef.current = [];
      if (!wantListenRef.current) return;          // typed or muted meanwhile
      if (!send) {
        startRecordingRef.current();
        return;
      }
      setIsTranscribing(true);
      let text = "";
      let available = true;
      try {
        ({ text, available } = await transcribeAudio(blob, language));
      } catch (err) {
        console.error(err);
      } finally {
        setIsTranscribing(false);
      }
      if (!wantListenRef.current) return;
      if (text) {
        submitAnswerRef.current(text);
      } else if (!available) {
        if (browserRecognizer()) {
          browserSttRef.current = true;
          startRecordingRef.current();
          setMicError("Switched to your browser's speech recognition. Please say that again.");
          setTimeout(() => setMicError(null), 4000);
        } else {
          turnMicOff("Voice answers aren't available right now. Please type your reply below.");
        }
      } else {
        setMicError("Sorry, I didn't catch that. Please say it again, or type below.");
        setTimeout(() => setMicError(null), 4000);
        startRecordingRef.current();
      }
    };
    try { recorder.stop(); } catch { /* already stopped */ }
  };

  // The fallback: the browser recognises one answer in the call's language,
  // then hands it over like a transcribed recording.
  const startBrowserRecognition = () => {
    const Recognition = browserRecognizer();
    if (!wantListenRef.current || recognitionRef.current) return;
    if (!Recognition) {
      turnMicOff("Voice answers aren't available right now. Please type your reply below.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = SPEECH_LOCALE[language] || "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    let heard = "";
    recognition.onresult = (e: any) => {
      heard = (e.results?.[0]?.[0]?.transcript || "").trim();
    };
    recognition.onerror = (e: any) => {
      if (e.error === "no-speech" || e.error === "aborted") return;   // onend listens again
      recognitionRef.current = null;
      setIsListening(false);
      browserSttRef.current = false;
      turnMicOff(e.error === "not-allowed"
        ? "Microphone access is blocked. Allow it in your browser, or type your reply below."
        : "Voice answers aren't available right now. Please type your reply below.");
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;   // stopped or failed
      recognitionRef.current = null;
      setIsListening(false);
      if (!wantListenRef.current) return;
      if (heard) submitAnswerRef.current(heard);
      else setTimeout(() => startRecordingRef.current(), 300);   // silence: keep listening
    };
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      recognitionRef.current = null;
      turnMicOff("Voice answers aren't available right now. Please type your reply below.");
    }
  };

  const startListening = () => {
    if (!micOnRef.current || !callLiveRef.current || processingRef.current) return;
    if (wantListenRef.current) return;   // already listening
    setInputText("");
    wantListenRef.current = true;
    startRecording();
  };

  // Shows and sends a spoken answer.
  const submitAnswer = (text: string) => {
    if (!text || processingRef.current) return;
    stopListening();
    setInputText("");
    setMessages(prev => [...prev, { id: `${Date.now()}u`, speaker: "USER", text }]);
    handleSendTurnRef.current(text);
  };

  // RAAHI's voice: clips play one after another; when the last one ends and
  // she has asked a question, the mic starts listening.
  const playNext = () => {
    if (audioRef.current || utteranceRef.current) return;   // already speaking
    const clip = audioQueueRef.current.shift();
    if (!clip) {
      setIsSpeaking(false);
      if (awaitingAnswerRef.current) startListeningRef.current();
      return;
    }
    setIsSpeaking(true);
    if ("text" in clip) {
      const voice = deviceVoice(language);
      if (!voice) {
        playNextRef.current();
        return;
      }
      // Said as one word, not spelled out letter by letter.
      const utterance = new SpeechSynthesisUtterance(clip.text.replace(/RAAHI/g, "Raahi"));
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utteranceRef.current = utterance;
      const spoken = () => {
        if (utteranceRef.current !== utterance) return;
        utteranceRef.current = null;
        playNextRef.current();
      };
      utterance.onend = spoken;
      utterance.onerror = spoken;
      window.speechSynthesis.speak(utterance);
      return;
    }
    const audio = new Audio(clip.url);
    audioRef.current = audio;
    const done = () => {
      if (audioRef.current !== audio) return;
      audioRef.current = null;
      playNextRef.current();
    };
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done);
  };

  const stopAudio = () => {
    audioQueueRef.current = [];
    const audio = audioRef.current;
    audioRef.current = null;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
    }
    if (utteranceRef.current) {
      utteranceRef.current = null;
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const handleSendTurn = async (textToSend: string) => {
    awaitingAnswerRef.current = false;
    processingRef.current = true;
    setIsProcessing(true);
    let continueToResults = false;
    try {
      const res = await sendTurn(textToSend || null, language, callerIdRef.current);

      if (!sessionId) {
        setSessionId(res.session_id);
      }

      // RAAHI's line: the next question, or the results
      const line = res.next_question || res.composer_text;
      if (line) {
        setMessages(prev => [...prev, { id: `${Date.now()}r`, speaker: "RAAHI", text: line }]);
      }

      // Update slots
      if (res.slots) {
        setExtracted(res.slots);
      }

      // Show a match only once the caller has said what work they want;
      // before that the ranker is just guessing.
      if (res.top3 && res.top3.length > 0 && (res.done || res.slots?.["SKILL INTENT"])) {
        setTop3(res.top3);
      }

      // A question means: listen for the answer once RAAHI has spoken.
      awaitingAnswerRef.current = !!res.next_question && !res.finalizing && !res.done;
      // "Let me check" — fetch the results straight away, while that line plays.
      continueToResults = !!res.finalizing;

      if (res.done) {
        callLiveRef.current = false;
        setCallState("ended");
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        releaseMic();
      }

      if (res.audio_url) {
        audioQueueRef.current.push({ url: (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") + res.audio_url });
        setVoiceNotice(null);
      } else if (line) {
        // No recording from the server: the device reads the line sentence by
        // sentence (long utterances get cut off in some browsers), or, with no
        // voice for this language, the caller is told to read it on screen.
        if (deviceVoice(language)) {
          for (const sentence of line.split(/(?<=[.!?।])\s+/)) {
            if (sentence.trim()) audioQueueRef.current.push({ text: sentence.trim() });
          }
        } else {
          setVoiceNotice("RAAHI's voice isn't available right now. Please read her questions on screen.");
        }
      }
      playNextRef.current();
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { id: `${Date.now()}e`, speaker: "RAAHI", text: "Sorry, I am having trouble connecting to the server. Please try again." }]);
      awaitingAnswerRef.current = true;
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
      // Nothing left to say (no audio) — listen right away.
      if (awaitingAnswerRef.current && !audioRef.current && audioQueueRef.current.length === 0) {
        startListeningRef.current();
      }
    }
    if (continueToResults) await handleSendTurnRef.current("");
  };

  // Latest versions for callbacks that outlive a render (audio, recognizer, timers).
  const handleSendTurnRef = useRef(handleSendTurn);
  handleSendTurnRef.current = handleSendTurn;
  const startListeningRef = useRef(startListening);
  startListeningRef.current = startListening;
  const playNextRef = useRef(playNext);
  playNextRef.current = playNext;
  const submitAnswerRef = useRef(submitAnswer);
  submitAnswerRef.current = submitAnswer;
  const startRecordingRef = useRef(startRecording);
  startRecordingRef.current = startRecording;
  const finishRecordingRef = useRef(finishRecording);
  finishRecordingRef.current = finishRecording;

  // Stop everything when the component goes away
  useEffect(() => {
    return () => {
      wantListenRef.current = false;
      if (vadTimerRef.current) clearInterval(vadTimerRef.current);
      try { recorderRef.current?.stop(); } catch { /* already stopped */ }
      try { recognitionRef.current?.abort(); } catch { /* already stopped */ }
      streamRef.current?.getTracks().forEach(track => track.stop());
      audioCtxRef.current?.close().catch(() => { /* already closed */ });
      audioRef.current?.pause();
      if (utteranceRef.current) {
        utteranceRef.current = null;
        window.speechSynthesis.cancel();
      }
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Start Call Sequence
  useEffect(() => {
    if (typeof window !== "undefined") {
      setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      // Browsers load their voices lazily; ask now so the fallback voice is
      // ready by the time RAAHI's welcome arrives.
      window.speechSynthesis?.getVoices();
    }

    if (!isActive) {
      // Reset state when closed
      callLiveRef.current = false;
      awaitingAnswerRef.current = false;
      stopListening();
      stopAudio();
      releaseMic();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setCallState("connecting");
      setTimer(0);
      setMessages([]);
      setExtracted({});
      setSessionId(null);
      callerIdRef.current = newCallerId();   // the next call is a new caller
      setTop3(null);
      setInputText("");
      micOnRef.current = true;
      setMicOn(true);
      setMicError(null);
      setVoiceNotice(null);
      browserSttRef.current = false;
      return;
    }

    // Connect, then let RAAHI open the conversation with her welcome
    const connect = setTimeout(() => {
      setCallState("connected");
      callLiveRef.current = true;
      timerIntervalRef.current = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
      handleSendTurnRef.current("");
    }, 2000);

    return () => {
      clearTimeout(connect);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isActive]);

  const handleUserInput = () => {
    const text = inputText.trim();
    if (!text || isProcessing) return;
    stopListening();
    stopAudio();
    setInputText("");
    setMessages(prev => [...prev, { id: `${Date.now()}u`, speaker: "USER", text }]);
    handleSendTurn(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleUserInput();
    }
  };

  // Typing takes over from the mic for this answer.
  const handleTyping = (value: string) => {
    if (wantListenRef.current) stopListening();
    setInputText(value);
  };

  // The big mic button: interrupt RAAHI and answer, or mute / unmute.
  const handleMicButton = () => {
    if (!micSupported) return;
    if (isSpeaking) {
      stopAudio();
      micOnRef.current = true;
      setMicOn(true);
      startListening();
      return;
    }
    if (micOn) {
      micOnRef.current = false;
      setMicOn(false);
      stopListening();
    } else {
      micOnRef.current = true;
      setMicOn(true);
      setMicError(null);
      if (awaitingAnswerRef.current) startListening();
    }
  };

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  const handleEndCall = () => {
    callLiveRef.current = false;
    awaitingAnswerRef.current = false;
    stopListening();
    stopAudio();
    releaseMic();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setCallState("ended");
  };

  const canSend = !isProcessing && !!inputText.trim();

  const micStatus = !micSupported
    ? "Voice input isn't supported in this browser — please type below."
    : isSpeaking ? "RAAHI is speaking — tap the mic to answer now"
    : isTranscribing ? "Got it — recognising your answer…"
    : isProcessing ? "RAAHI is thinking…"
    : !micOn ? "Mic is off — tap to speak, or type below"
    : isListening ? "Listening… just speak, it sends when you pause"
    : "Mic is on";

  if (!isActive) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "#0a0f18", // Dark navy/black
        zIndex: 9999,
        display: "block",
        color: "white",
        fontFamily: "var(--font-hind), sans-serif",
        overflow: "hidden"
      }}
    >
      {!reduceMotion && (
        <video
          autoPlay
          muted
          loop
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            zIndex: 0,
            pointerEvents: "none"
          }}
        >
          <source src="/videos/village-autumn-breeze.mp4" type="video/mp4" />
        </video>
      )}
      
      {/* Background Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle, rgba(10,15,24,0.4) 0%, rgba(10,15,24,0.85) 100%)",
          zIndex: 1,
          pointerEvents: "none"
        }}
      />
      
      <div style={{ position: "relative", zIndex: 2, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="call-exp-container" style={{ position: "relative", width: "100%" }}>
          
          {/* LEFT SIDE - TRANSCRIPT */}
          <div className="call-panel-left">
            <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
            style={{ height: "60%", display: "flex", flexDirection: "column" }}
          >
            <h3 style={{ fontSize: "0.8rem", letterSpacing: "2px", color: "var(--color-sun)", textTransform: "uppercase", marginBottom: "2rem" }}>LIVE TRANSCRIPT</h3>
            <div ref={transcriptRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.5rem", paddingRight: "1rem" }}>
              <AnimatePresence>
                {messages.map(msg => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: msg.speaker === "RAAHI" ? "flex-start" : "flex-end"
                    }}
                  >
                    <span style={{ fontSize: "0.7rem", color: "#6b7280", marginBottom: "0.25rem", letterSpacing: "1px" }}>{msg.speaker}</span>
                    <div style={{
                      backgroundColor: msg.speaker === "RAAHI" ? "#16283a" : "#2a1e12",
                      padding: "1rem 1.25rem",
                      borderRadius: msg.speaker === "RAAHI" ? "0 16px 16px 16px" : "16px 0 16px 16px",
                      border: `1px solid ${msg.speaker === "RAAHI" ? "#1e3a5f" : "#4a3520"}`,
                      maxWidth: "90%",
                      fontSize: "1.1rem",
                      lineHeight: 1.5,
                      whiteSpace: "pre-line"   // results come laid out on separate lines
                    }}>
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* CENTER - PHONE */}
        <div className="call-panel-center">
          <motion.div
            initial={{ rotateX: 45, y: 150, scale: 0.8, opacity: 0 }}
            animate={{ rotateX: 0, y: 0, scale: 1, opacity: 1 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} // Cinematic physical ease
            style={{
              width: "320px",
              height: "660px",
              backgroundColor: "#0d1117",
              borderRadius: "45px",
              border: "12px solid #000",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.8), inset 0 0 20px rgba(0,0,0,0.5)",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }}
          >
            {/* Phone Screen Glow */}
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 30%, rgba(26,50,69,0.5) 0%, transparent 70%)", pointerEvents: "none" }} />
            
            {/* Phone Top / Notch */}
            <div style={{ width: "100%", height: "40px", display: "flex", justifyContent: "center", alignItems: "flex-end", zIndex: 10 }}>
              <div style={{ width: "80px", height: "20px", backgroundColor: "#000", borderBottomLeftRadius: "12px", borderBottomRightRadius: "12px" }} />
            </div>

            {/* Phone Content */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "1.25rem 1.25rem 1rem", zIndex: 10, overflow: "hidden" }}>
              
              {/* Call Status Top */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: callState === "connected" ? "#10b981" : (callState === "ended" ? "#6b7280" : "#f59e0b") }} />
                  <span style={{ fontSize: "0.8rem", color: "#9ca3af", letterSpacing: "1px", textTransform: "uppercase" }}>
                    {callState === "connecting" ? t.call.connecting : (callState === "ended" ? t.call.callEnded : "LIVE CALL")}
                  </span>
                </div>
                {callState === "connected" && (
                  <span style={{ fontFamily: "monospace", fontSize: "1.2rem", fontWeight: "300", color: "#e5e7eb" }}>{formatTime(timer)}</span>
                )}
                {callState === "ended" && (
                  <span style={{ fontFamily: "monospace", fontSize: "1.2rem", fontWeight: "300", color: "#e5e7eb" }}>{formatTime(timer)}</span>
                )}
              </div>

              {/* Center ID */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                <motion.div 
                  animate={{ scale: callState === "connected" ? [1, 1.05, 1] : 1 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  style={{
                    width: "100px", height: "100px", borderRadius: "50%",
                    background: callState === "connected" ? "linear-gradient(135deg, #1e3a5f, #0f172a)" : "#1f2937",
                    display: "flex", justifyContent: "center", alignItems: "center",
                    boxShadow: callState === "connected" ? "0 0 30px rgba(30,58,95,0.4)" : "none",
                    marginBottom: "1.5rem"
                  }}
                >
                  <h2 style={{ fontFamily: "var(--font-yatra-one)", fontSize: "2rem", color: "white", margin: 0 }}>R</h2>
                </motion.div>
                <h3 style={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "0.25rem" }}>RAAHI</h3>
                <span style={{ fontSize: "0.9rem", color: "#6b7280" }}>{t.call.livelihoodCounselor}</span>
              </div>

              {/* End Screen Content */}
              {callState === "ended" && (
                <div style={{ width: "100%", marginBottom: "2rem", textAlign: "center" }}>
                  <p style={{ fontSize: "0.9rem", color: "#10b981", marginBottom: "1rem" }}>{t.call.profilePrepared}</p>
                  <button 
                    onClick={onClose}
                    style={{
                      background: "transparent",
                      border: "1px solid #374151",
                      color: "white",
                      padding: "0.75rem 1.5rem",
                      borderRadius: "100px",
                      fontSize: "0.9rem",
                      cursor: "pointer"
                    }}
                  >
                    {t.call.returnHome}
                  </button>
                </div>
              )}

              {/* Bottom Controls */}
              {callState !== "ended" && (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {/* RAAHI's voice unavailable */}
                  <AnimatePresence>
                    {voiceNotice && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        role="status"
                        style={{ fontSize: "0.68rem", color: "#fbbf24", textAlign: "center", padding: "0.25rem 0.5rem", background: "rgba(245,158,11,0.1)", borderRadius: "8px", border: "1px solid rgba(245,158,11,0.25)" }}
                      >
                        {voiceNotice}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Mic error */}
                  <AnimatePresence>
                    {micError && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        style={{ fontSize: "0.68rem", color: "#f87171", textAlign: "center", padding: "0.25rem 0.5rem", background: "rgba(239,68,68,0.1)", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.2)" }}
                      >
                        {micError}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Voice — the main way to answer. The mic listens by itself
                      after RAAHI asks; tap to mute, unmute, or interrupt her. */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.45rem" }}>
                    <div style={{ position: "relative", width: "64px", height: "64px" }}>
                      {isListening && !reduceMotion && (
                        <motion.div
                          animate={{ scale: [1, 1.45], opacity: [0.45, 0] }}
                          transition={{ repeat: Infinity, duration: 1.4, ease: "easeOut" }}
                          style={{ position: "absolute", inset: 0, borderRadius: "50%", backgroundColor: "#10b981", pointerEvents: "none" }}
                        />
                      )}
                      <button
                        onClick={handleMicButton}
                        disabled={!micSupported}
                        aria-label={micStatus}
                        title={micStatus}
                        style={{
                          position: "relative",
                          width: "64px",
                          height: "64px",
                          borderRadius: "50%",
                          backgroundColor: !micSupported ? "#374151"
                            : isSpeaking ? "#1e3a5f"
                            : isListening ? "#10b981"
                            : micOn ? "#065f46" : "#374151",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          color: "white",
                          border: "none",
                          cursor: micSupported ? "pointer" : "not-allowed",
                          boxShadow: isListening ? "0 0 18px rgba(16,185,129,0.55)" : "0 4px 12px rgba(0,0,0,0.35)",
                          transition: "background-color 0.2s",
                        }}
                      >
                        {isSpeaking ? <Volume2 size={26} />
                          : isProcessing || isTranscribing ? (
                            <motion.span
                              animate={reduceMotion ? undefined : { rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                              style={{ display: "flex" }}
                            >
                              <Loader2 size={26} />
                            </motion.span>
                          )
                          : micOn && micSupported ? <Mic size={26} /> : <MicOff size={26} />}
                      </button>
                    </div>
                    <span
                      aria-live="polite"
                      style={{ fontSize: "0.7rem", color: isListening ? "#6ee7b7" : "#9ca3af", textAlign: "center", lineHeight: 1.3, minHeight: "1.8em", padding: "0 0.25rem" }}
                    >
                      {micStatus}
                    </span>
                  </div>

                  {/* Text input row — fallback when speaking isn't possible */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "#1f2937",
                    borderRadius: "100px",
                    padding: "4px 4px 4px 12px",
                    border: isListening ? "1px solid rgba(16,185,129,0.5)" : "1px solid transparent",
                    transition: "border-color 0.3s",
                    gap: "4px",
                  }}>
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => handleTyping(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={isListening ? "Listening…" : isProcessing ? "RAAHI is thinking…" : "Or type your reply…"}
                      disabled={isProcessing}
                      style={{
                        flex: 1,
                        background: "transparent",
                        border: "none",
                        color: "white",
                        padding: "0.55rem 0",
                        fontSize: "0.88rem",
                        outline: "none",
                        fontFamily: "inherit",
                        minWidth: 0,
                      }}
                    />

                    {/* Send Button */}
                    <button
                      onClick={handleUserInput}
                      disabled={!canSend}
                      title="Send message"
                      style={{
                        flexShrink: 0,
                        width: "34px",
                        height: "34px",
                        borderRadius: "50%",
                        backgroundColor: canSend ? "var(--color-accent)" : "#374151",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        color: "white",
                        border: "none",
                        cursor: canSend ? "pointer" : "not-allowed",
                        transition: "background-color 0.2s",
                        opacity: canSend ? 1 : 0.5,
                      }}
                    >
                      <Send size={14} />
                    </button>
                  </div>

                  {/* End Call Button */}
                  <div style={{ display: "flex", justifyContent: "center", paddingTop: "0.2rem" }}>
                    <button
                      onClick={handleEndCall}
                      style={{
                        width: "50px", height: "50px", borderRadius: "50%",
                        backgroundColor: "#ef4444",
                        display: "flex", justifyContent: "center", alignItems: "center",
                        color: "white", border: "none", cursor: "pointer",
                        boxShadow: "0 4px 14px rgba(239, 68, 68, 0.4)"
                      }}
                    >
                      <PhoneOff size={22} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* RIGHT SIDE - EXTRACTION */}
        <div className="call-panel-right">
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
            // Size to the content (centred in the column) so the match card
            // sits fully on screen; scroll rather than cut off on short screens.
            style={{ maxHeight: "100%", overflowY: "auto", display: "flex", flexDirection: "column" }}
          >
            <h3 style={{ fontSize: "0.8rem", letterSpacing: "2px", color: "var(--color-sun)", textTransform: "uppercase", marginBottom: "1.25rem" }}>LIVE EXTRACTION</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
              {["DISTRICT", "AGE", "PREFERENCE", "SKILL INTENT"].map((key) => (
                <div key={key} style={{ 
                  backgroundColor: "#111827", 
                  border: "1px solid #1f2937", 
                  borderRadius: "12px", 
                  padding: "1rem",
                  position: "relative",
                  overflow: "hidden"
                }}>
                  <span style={{ fontSize: "0.65rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: "0.25rem" }}>
                    {key}
                  </span>
                  <div style={{ fontSize: "1rem", fontWeight: "600", color: extracted[key as keyof ExtractedData] ? "white" : "#374151" }}>
                    {extracted[key as keyof ExtractedData] || "—"}
                  </div>
                  {/* Subtle highlight when updated */}
                  <AnimatePresence>
                    {extracted[key as keyof ExtractedData] && (
                      <motion.div
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 0 }}
                        transition={{ duration: 1 }}
                        style={{ position: "absolute", inset: 0, backgroundColor: "rgba(217,114,11,0.2)", pointerEvents: "none" }}
                      />
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            {/* Recommendation Card */}
            <AnimatePresence>
              {top3 && top3.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  style={{
                    backgroundColor: "#0d1b11",
                    border: "1px solid #065f46",
                    borderRadius: "16px",
                    padding: "1.5rem",
                    boxShadow: "0 10px 30px rgba(6, 95, 70, 0.2)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                    <span style={{ fontSize: "0.7rem", color: "#34d399", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "bold" }}>
                      {t.call.matchFound}
                    </span>
                    {typeof top3[0].match_score === "number" && (
                      <span style={{ fontSize: "0.7rem", backgroundColor: "#064e3b", color: "#6ee7b7", padding: "2px 8px", borderRadius: "100px" }}>
                        {t.call.confidence.replace("{score}", formatScore(top3[0].match_score, language))}
                      </span>
                    )}
                  </div>
                  
                  <h4 style={{ fontSize: "1.2rem", fontWeight: "700", marginBottom: "0.5rem" }}>
                    {top3[0].qualification_name}
                  </h4>
                  
                  {top3[0].centre_name && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", color: "#a7f3d0", fontSize: "0.85rem" }}>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <span>
                          {top3[0].nearest_fallback && "📍 "}
                          {`${top3[0].centre_name} (${top3[0].centre_district || ''}${top3[0].centre_state ? `, ${top3[0].centre_state}` : ''})`}
                        </span>
                      </div>
                    </div>
                  )}

                  {callState === "ended" && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px dashed #065f46", fontSize: "0.8rem", color: "#6ee7b7", display: "flex", alignItems: "center", gap: "0.5rem" }}
                    >
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#34d399" }} />
                      {t.call.sentWhatsapp}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        </div>

      </div>
      </div>

      {/* Optional: Close Button for testing/escape */}
      <button 
        onClick={onClose}
        style={{
          position: "absolute", top: "2rem", right: "2rem",
          background: "transparent", border: "none", color: "#6b7280", cursor: "pointer"
        }}
      >
        <X size={24} />
      </button>

    </motion.div>
  );
}
