
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { MicrophoneIcon, StopIcon, TrashIcon } from './icons';
import { decode, createBlob, decodeAudioData } from '../utils/audioUtils';
import { TranscriptionTurn } from '../types';
import { getVoiceSystemInstruction } from '../utils/systemInstructions';

const Orb: React.FC<{ state: 'idle' | 'connecting' | 'listening' | 'speaking' | 'error' }> = ({ state }) => {
    const getCoreStateClasses = () => {
        switch (state) {
            case 'connecting':
                return 'animate-spin';
            case 'listening':
                return 'scale-110 shadow-cyan-400/50';
            case 'speaking':
                return 'scale-105 shadow-blue-400/50';
            case 'error':
                return 'shadow-red-500/50';
            default: // idle
                return 'shadow-slate-700/50';
        }
    };

    return (
        <div className="relative w-48 h-48 sm:w-64 sm:h-64 flex items-center justify-center">
            {/* Outer rings */}
            <div className={`absolute inset-0 rounded-full border-2 border-cyan-400/30 transition-all duration-500 ${state === 'listening' ? 'animate-[orb-rotate-1_5s_linear_infinite]' : 'animate-[orb-rotate-1_20s_linear_infinite]'}`}></div>
            <div className={`absolute inset-4 rounded-full border-2 border-blue-500/30 transition-all duration-500 ${state === 'speaking' ? 'animate-[orb-rotate-2_8s_linear_infinite]' : 'animate-[orb-rotate-2_15s_linear_infinite]'}`}></div>
            
            {/* Core */}
            <div className={`absolute inset-10 rounded-full bg-slate-900 transition-transform duration-500 ease-in-out shadow-2xl ${getCoreStateClasses()}`}>
                <div 
                    className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 opacity-60"
                    style={{ animation: (state === 'speaking' || state === 'listening') ? 'orb-breathe 2s ease-in-out infinite' : 'none' }}
                ></div>
            </div>
        </div>
    );
};


const VoiceChat: React.FC = () => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [status, setStatus] = useState('Idle. Press the orb to begin.');
  const [orbState, setOrbState] = useState<'idle' | 'connecting' | 'listening' | 'speaking' | 'error'>('idle');

  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionTurn[]>(() => {
    try {
      const saved = localStorage.getItem('massivebio-voice-history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (error) {
      console.error('Could not load voice history:', error);
    }
    return [];
  });

  const [currentInput, setCurrentInput] = useState('');
  const [currentOutput, setCurrentOutput] = useState('');

  // --- Internal refs ---
  const sessionRef = useRef<any | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const inputAudioContext = useRef<AudioContext | null>(null);
  const outputAudioContext = useRef<AudioContext | null>(null);
  const scriptProcessor = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSource = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTime = useRef(0);
  const audioSources = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Keep authoritative copies of the current turn text to avoid setState race
  const currentInputRef = useRef('');
  const currentOutputRef = useRef('');

  useEffect(() => {
    if (isConnecting) {
      setOrbState('connecting');
    } else if (isSessionActive) {
      if (currentOutputRef.current.length > 0) {
        setOrbState('speaking');
      } else {
        setOrbState('listening');
      }
    } else {
      if (status.toLowerCase().includes('error')) {
        setOrbState('error');
      } else {
        setOrbState('idle');
      }
    }
  }, [isConnecting, isSessionActive, status, currentOutput]);

  useEffect(() => {
    try {
      if (transcriptionHistory.length > 0) {
        localStorage.setItem('massivebio-voice-history', JSON.stringify(transcriptionHistory));
      } else {
        localStorage.removeItem('massivebio-voice-history');
      }
    } catch (error) {
      console.error('Could not save voice history:', error);
    }
  }, [transcriptionHistory]);

  const cleanup = () => {
    try {
      scriptProcessor.current?.disconnect();
      scriptProcessor.current = null;

      mediaStreamSource.current?.disconnect();
      mediaStreamSource.current = null;

      // Stop mic tracks
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;

      inputAudioContext.current?.close().catch(console.error);
      outputAudioContext.current?.close().catch(console.error);
    } finally {
      inputAudioContext.current = null;
      outputAudioContext.current = null;

      audioSources.current.forEach((s) => s.stop());
      audioSources.current.clear();
      nextStartTime.current = 0;
    }
  };

  const startSession = async () => {
    if (isSessionActive || isConnecting) return;
    setIsConnecting(true);
    setStatus('Initializing AI Core…');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
      });
      mediaStreamRef.current = stream;

      inputAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      outputAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: getVoiceSystemInstruction(),
        },
        callbacks: {
          onopen: async () => {
            setIsSessionActive(true);
            setIsConnecting(false);
            setStatus('Connection established. Listening…');

            mediaStreamSource.current = inputAudioContext.current!.createMediaStreamSource(stream);
            scriptProcessor.current = inputAudioContext.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.current.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };

            mediaStreamSource.current.connect(scriptProcessor.current);
            scriptProcessor.current.connect(inputAudioContext.current!.destination);

            try {
              if (outputAudioContext.current?.state === 'suspended') {
                await outputAudioContext.current.resume();
              }
            } catch {}
          },

          onmessage: (msg: LiveServerMessage) => {
            handleServerMessage(msg);
          },

          onerror: (e: ErrorEvent) => {
            console.error('Session Error:', e);
            setStatus(`Error: ${e.message}. Please try again.`);
            stopSession();
          },

          onclose: () => {
            // Handled in stopSession/cleanup
          },
        },
      });
      sessionRef.current = await sessionPromise;
    } catch (error) {
      console.error('Failed to start session:', error);
      setStatus('Error: Could not access microphone.');
      cleanup();
      setIsConnecting(false);
    }
  };

  const handleServerMessage = async (message: LiveServerMessage) => {
    const sc = message.serverContent;

    if (sc?.inputTranscription?.text) {
      currentInputRef.current += sc.inputTranscription.text;
      setCurrentInput(currentInputRef.current);
    }
    if (sc?.outputTranscription?.text) {
      currentOutputRef.current += sc.outputTranscription.text;
      setCurrentOutput(currentOutputRef.current);
      setStatus('AI is responding…');
    }

    const base64Audio = sc?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio && outputAudioContext.current) {
      nextStartTime.current = Math.max(nextStartTime.current, outputAudioContext.current.currentTime);
      const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        outputAudioContext.current,
        24000,
        1
      );
      const source = outputAudioContext.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(outputAudioContext.current.destination);
      source.addEventListener('ended', () => audioSources.current.delete(source));
      source.start(nextStartTime.current);
      nextStartTime.current += audioBuffer.duration;
      audioSources.current.add(source);
    }

    if (sc?.interrupted) {
      audioSources.current.forEach((s) => s.stop());
      audioSources.current.clear();
      nextStartTime.current = 0;
    }

    if (sc?.turnComplete) {
      setTranscriptionHistory((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          userInput: currentInputRef.current,
          modelOutput: currentOutputRef.current,
        },
      ]);
      currentInputRef.current = '';
      currentOutputRef.current = '';
      setCurrentInput('');
      setCurrentOutput('');
      setStatus('Listening…');
    }
  };

  const stopSession = async () => {
    setStatus('Disconnecting…');
    try {
      await sessionRef.current?.close();
    } catch (e) {
      console.error('Error closing session', e);
    } finally {
      sessionRef.current = null;
      cleanup();
      setIsSessionActive(false);
      setIsConnecting(false);
      setStatus('Idle. Press the orb to begin.');
    }
  };

  const handleClearHistory = () => {
    setTranscriptionHistory([]);
    localStorage.removeItem('massivebio-voice-history');
  };

  useEffect(() => {
    return () => {
      try {
        sessionRef.current?.close();
      } catch {}
      cleanup();
    };
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center p-4 sm:p-6 text-center animate-[fade-in_0.5s_ease-out]">
      <div className="w-full max-w-4xl h-full flex flex-col">
        {/* Transcription Panel */}
        <div 
          className="relative flex-1 bg-slate-900/50 backdrop-blur-md border border-slate-700/50 rounded-xl p-4 overflow-y-auto space-y-4 text-left shadow-2xl mb-6"
          style={{
            boxShadow: '0 0 40px rgba(37, 99, 235, 0.2), inset 0 0 15px rgba(37, 99, 235, 0.2)'
          }}
        >
          <div className="absolute top-3 right-3 z-10">
            <button
              onClick={handleClearHistory}
              className="p-1.5 rounded-full text-slate-400 hover:text-red-400 bg-slate-800/50 hover:bg-slate-700 transition-colors"
              aria-label="Clear voice history"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          </div>
          {transcriptionHistory.length === 0 && !currentInput && !currentOutput && (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <p className="text-lg">Conversation transcript will appear here.</p>
                <p className="text-sm">Press the orb to begin.</p>
            </div>
          )}
          {transcriptionHistory.map((turn) => (
            <div key={turn.id} className="animate-[slide-in-bottom_0.4s_ease-out]">
              <p className="text-slate-300"><strong className="font-semibold text-blue-400">You:</strong> {turn.userInput}</p>
              <p className="mt-1"><strong className="font-semibold text-cyan-400">AI:</strong> {turn.modelOutput}</p>
            </div>
          ))}
          {(currentInput || currentOutput) && (
            <div className="pt-2 border-t border-slate-700/50">
              {currentInput && <p className="text-slate-300"><strong className="font-semibold text-blue-400">You:</strong> {currentInput}<span className="inline-block w-2 h-4 bg-slate-400 animate-pulse ml-1"></span></p>}
              {currentOutput && <p className="mt-1"><strong className="font-semibold text-cyan-400">AI:</strong> {currentOutput}<span className="inline-block w-2 h-4 bg-slate-400 animate-pulse ml-1"></span></p>}
            </div>
          )}
        </div>

        {/* Orb and controls */}
        <div className="flex flex-col items-center justify-center">
            <p className="text-slate-400 h-6 mb-4 transition-opacity duration-300">{status}</p>
            <button onClick={isSessionActive ? stopSession : startSession} disabled={isConnecting} className="group rounded-full focus:outline-none focus-visible:ring-4 ring-blue-500/50 relative">
              <Orb state={orbState} />
              <div className="absolute inset-0 flex items-center justify-center">
                  {!isSessionActive ? 
                    <MicrophoneIcon className={`h-12 w-12 text-slate-400 group-hover:text-white transition-colors duration-300 ${isConnecting ? 'opacity-0' : 'opacity-100'}`} /> : 
                    <StopIcon className="h-12 w-12 text-slate-400 group-hover:text-white transition-colors duration-300" />}
              </div>
            </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceChat;