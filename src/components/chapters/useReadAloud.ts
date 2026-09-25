"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Browser Web Speech API only. Sentence-sized utterances (Chrome cuts off long ones),
// word highlighting from `boundary` events.

const WARM_VOICES = [
  "Microsoft Aria Online (Natural)",
  "Microsoft Jenny Online (Natural)",
  "Microsoft Ava Online (Natural)",
  "Samantha",
  "Google UK English Female",
  "Karen",
  "Moira",
  "Serena",
  "Google US English",
  "Microsoft Zira",
];

export interface Token {
  text: string;
  start: number; // char offset in the full text
  isWord: boolean;
}

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const re = /(\S+)|(\s+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ text: m[0], start: m.index, isWord: !!m[1] });
  return out;
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  for (const name of WARM_VOICES) {
    const v = voices.find((x) => x.name.startsWith(name));
    if (v) return v;
  }
  return voices.find((v) => /^en[-_]/i.test(v.lang) && /female|natural/i.test(v.name)) ?? voices.find((v) => /^en/i.test(v.lang)) ?? null;
}

export type ReadState = "idle" | "playing" | "paused";

export function useReadAloud(text: string) {
  const tokens = useMemo(() => tokenize(text), [text]);
  const [state, setState] = useState<ReadState>("idle");
  const [activeChar, setActiveChar] = useState<number>(-1);
  const [supported, setSupported] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const runId = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSupported(true);
    const load = () => (voiceRef.current = pickVoice());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    runId.current++;
    window.speechSynthesis?.cancel();
    setState("idle");
    setActiveChar(-1);
  }, []);

  useEffect(() => stop, [text, stop]);

  const play = useCallback(() => {
    const synth = window.speechSynthesis;
    if (state === "paused") {
      synth.resume();
      setState("playing");
      return;
    }
    synth.cancel();
    const id = ++runId.current;
    const sentences: { text: string; offset: number }[] = [];
    const re = /[^.!?]+[.!?"”]*\s*/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) if (m[0].trim()) sentences.push({ text: m[0], offset: m.index });

    sentences.forEach((s, i) => {
      const u = new SpeechSynthesisUtterance(s.text);
      if (voiceRef.current) u.voice = voiceRef.current;
      u.lang = voiceRef.current?.lang ?? "en-US";
      u.rate = 0.9;
      u.pitch = 1.05;
      u.onboundary = (e) => {
        if (runId.current === id && (e.name === "word" || e.name === undefined)) setActiveChar(s.offset + e.charIndex);
      };
      u.onstart = () => runId.current === id && setActiveChar(s.offset);
      if (i === sentences.length - 1)
        u.onend = () => {
          if (runId.current !== id) return;
          setState("idle");
          setActiveChar(-1);
        };
      synth.speak(u);
    });
    setState("playing");
  }, [state, text]);

  const pause = useCallback(() => {
    window.speechSynthesis.pause();
    setState("paused");
  }, []);

  // Index of the word token containing activeChar.
  const activeToken = useMemo(() => {
    if (activeChar < 0) return -1;
    let idx = -1;
    tokens.forEach((t, i) => {
      if (t.isWord && t.start <= activeChar) idx = i;
    });
    return idx;
  }, [activeChar, tokens]);

  return { tokens, state, activeToken, play, pause, stop, supported };
}
