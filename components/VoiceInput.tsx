"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Square } from "lucide-react";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return (w.SpeechRecognition || w.webkitSpeechRecognition) as SpeechRecognitionCtor | null;
}

export default function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (getSpeechRecognition()) {
      setIsSupported(true);
    }
  }, []);

  const startRecording = () => {
    setError(null);
    const SR = getSpeechRecognition();
    if (!SR) {
      setError("Voice input not supported in this browser. Try Chrome or Edge.");
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        }
      }
      if (finalTranscript) {
        onTranscript(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "not-allowed") {
        setError("Microphone access denied. Please allow mic access in your browser settings and try again.");
      } else if (event.error === "no-speech") {
        setError("No speech detected. Please try again.");
      } else {
        setError(`Voice error: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      setError("Could not start microphone. Make sure no other tab is using it.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  };

  const toggle = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  if (!isSupported) {
    return (
      <button
        disabled
        className="p-2 rounded-full bg-gray-100 text-gray-400 cursor-not-allowed"
        title="Voice input not supported in this browser"
      >
        <MicOff className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={toggle}
        disabled={disabled}
        className={`relative p-3 rounded-full text-sm transition-all duration-200 active:scale-95 ${
          isRecording
            ? "bg-red-500 text-white mic-recording"
            : "bg-[#ff6b35] text-white hover:bg-[#ff8c5a]"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        title={isRecording ? "Stop recording" : "Start voice input"}
      >
        {isRecording ? (
          <Square className="w-4 h-4 fill-white" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </button>
      {isRecording && (
        <div className="flex items-center gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-red-500 animate-bounce"
              style={{ height: `${8 + (i % 2) * 8}px`, animationDelay: `${i * 0.1}s` }}
            />
          ))}
          <span className="text-xs text-red-600 font-medium ml-1">Listening...</span>
        </div>
      )}
      {error && <p className="text-xs text-red-500 text-center max-w-[160px]">{error}</p>}
    </div>
  );
}
