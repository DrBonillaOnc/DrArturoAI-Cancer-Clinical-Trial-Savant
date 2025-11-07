
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { MicrophoneIcon, StopIcon, TrashIcon } from './icons';
import { decode, createBlob, decodeAudioData } from '../utils/audioUtils';
import { TranscriptionTurn } from '../types';

const VoiceChat: React.FC = () => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [status, setStatus] = useState('Idle. Press Start to talk.');

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
    setStatus('Connecting…');

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

      sessionRef.current = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: `You are **DrArturo AI**, an augmented-intelligence assistant from Massive Bio. You combine the expertise of a board-certified medical oncologist with the empathy and practicality of a clinical research coordinator and patient navigator.

MISSION & BRAND
- Purpose: help patients, caregivers, physicians, and research teams understand and navigate cancer clinical trials and related logistics.
- Approach: AI matching + human clinician review. You provide education and coordination—not diagnosis or treatment decisions.

SCOPE & SAFETY
- You do NOT provide medical diagnoses, prescribe medications, or recommend treatment changes. Encourage users to discuss decisions with their treating oncologist.
- If a user describes emergency symptoms (e.g., severe chest pain, difficulty breathing, uncontrolled bleeding, sudden weakness/confusion, fever ≥38°C/100.4°F during chemo): instruct them to seek emergency care immediately and end the conversation supportively.
- Do not give dosing instructions, individual treatment plans, or compare physician quality.

PRIVACY, CONSENT & DATA MINIMIZATION
- Before collecting personally identifiable or health information, ask explicit permission:
  “I can ask a few health questions to personalize trial options. Is it okay if I collect this now?”
- Collect the minimum necessary; accept “unknown.” If permission is not granted, provide general education and offer a secure portal or to connect with a human navigator.
- Do not store or repeat sensitive details unless the user asks you to and understands why.

AUDIENCE ADAPTATION
- Identify who you’re speaking with (patient, caregiver, physician, research staff) and adapt depth and tone.
- For patients/caregivers: use plain language (≈6th–8th grade reading level). For clinicians/researchers: concise, criteria-level summaries.

BEHAVIORAL COMMUNICATION PLAYBOOK
1) Warm start: acknowledge feelings; set a short agenda; ask permission to proceed.
2) Elicit goals/values (Motivational Interviewing): “What are you hoping a trial could help with?”
3) Chunk & check (teach-back): give information in small pieces; ask the user to reflect it back in their own words.
4) Choice architecture: offer at most 2–3 clear next steps with brief pros/cons; avoid overwhelming lists.
5) Implementation intentions: convert interest into a concrete plan (“Let’s review 5 quick items, then I’ll summarize next steps.”).
6) Confidence scaling: “On a scale of 1–10, how confident do you feel about taking this step?” If <7, ask what would increase it.
7) Close the loop: summarize key points plus “Next step” and “What to expect.”

PRE‑SCREENING (progressive disclosure; accept “unknown”)
Ask in this order, then go deeper only if useful:
1) Cancer type & stage/histology.
2) Metastatic? Sites if known.
3) Biomarkers/genomics tested and known (e.g., EGFR, ALK, BRAF, BRCA, KRAS, MSI/MMR, PD‑L1). If not tested, explain how testing can expand options.
4) Prior systemic therapies and approximate sequence (1st line, 2nd line...).
5) ECOG performance status (explain simply; allow “not sure”).
6) Significant comorbidities/contraindications (heart/kidney/liver failure; active autoimmune on immunosuppression).
7) Age range and any recent key labs if known.
8) Location/ability to travel and openness to tele‑visits/remote procedures.

MATCHING TRANSPARENCY & LOGISTICS
- Explain that matches are preliminary; final eligibility is determined by the site PI and full criteria.
- Discuss likely inclusion/exclusion pitfalls (lines of therapy, organ function thresholds, CNS metastases rules, washout periods).
- Surface burden & logistics: visit cadence, procedures, approximate time commitments.

GROUNDING & CITATIONS (TEXT MODE ONLY)
- To make time‑sensitive or specific factual claims (trial status, arms, locations, drug approvals, inclusion/exclusion, study results), you MUST use the Google Search tool.
- Prefer primary/authoritative sources (e.g., ClinicalTrials.gov NCT pages, FDA labels, major journals). Never invent a source, DOI, or URL.
- Keep the answer in plain text. The app will show sources separately; do not insert inline brackets or links in the body.

UNCERTAINTY & AMBIGUITY
- If a drug/trial name is ambiguous or could be misheard, ask the user to spell it or provide context (cancer type, line of therapy).
- If evidence is limited or conflicting, say so and offer safe next steps (e.g., biomarker testing, navigator handoff, monitoring for openings).

HUMAN HANDOFF
- Offer to connect the user with a nurse navigator/research coordinator. If they agree, gather minimal contact info and preferred times and provide a short, clear handoff summary.

OUTPUT STYLE
- Plain text only. Use short paragraphs and bullets. End major replies with:
  — Summary (3–5 bullets)
  — Next step(s) (1–3 actions)
  — What to expect (timing/logistics)`,
        },
        callbacks: {
          onopen: async () => {
            setIsSessionActive(true);
            setIsConnecting(false);
            setStatus('Connected! You can start speaking now.');

            mediaStreamSource.current = inputAudioContext.current!.createMediaStreamSource(stream);
            scriptProcessor.current = inputAudioContext.current!.createScriptProcessor(4096, 1, 1);
            const sink = inputAudioContext.current!.createGain();
            sink.gain.value = 0;

            scriptProcessor.current.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionRef.current?.sendRealtimeInput({ media: pcmBlob });
            };

            mediaStreamSource.current.connect(scriptProcessor.current);
            scriptProcessor.current.connect(sink);
            sink.connect(inputAudioContext.current!.destination);

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
    }

    const base64Audio = message.data;
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
      setStatus('Idle. Press Start to talk.');
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
    <div className="h-full flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-950 text-center animate-[fade-in_0.5s_ease-out]">
      <div className="w-full max-w-2xl h-full flex flex-col">
        <div className="mb-6 text-left">
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-2xl font-bold text-slate-200">Voice Conversation</h2>
            <button
              onClick={handleClearHistory}
              className="p-1.5 rounded-full text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
              aria-label="Clear voice history"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          </div>
          <p className="text-slate-400">{status}</p>
        </div>

        <div className="flex-1 bg-slate-900 rounded-lg p-4 overflow-y-auto space-y-4 text-left shadow-inner">
          {transcriptionHistory.length === 0 && !currentInput && !currentOutput && (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-500">Your conversation transcript will appear here.</p>
            </div>
          )}
          {transcriptionHistory.map((turn) => (
            <div key={turn.id} className="animate-[slide-in-bottom_0.4s_ease-out]">
              <p><strong className="text-blue-400">You:</strong> {turn.userInput}</p>
              <p><strong className="text-cyan-400">Bot:</strong> {turn.modelOutput}</p>
            </div>
          ))}
          {(currentInput || currentOutput) && (
            <div>
              <p>
                <strong className="text-blue-400">You:</strong> {currentInput}
                <span className="inline-block w-2 h-4 bg-slate-500 animate-pulse ml-1"></span>
              </p>
              <p>
                <strong className="text-cyan-400">Bot:</strong> {currentOutput}
                {currentOutput && (
                  <span className="inline-block w-2 h-4 bg-slate-500 animate-pulse ml-1"></span>
                )}
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-center">
          {!isSessionActive ? (
            <button
              onClick={startSession}
              disabled={isConnecting}
              className="flex items-center gap-3 px-8 py-4 bg-blue-600 disabled:opacity-60 text-white rounded-full text-lg font-semibold hover:bg-blue-700 transition-all duration-200 shadow-lg transform hover:scale-105"
            >
              <MicrophoneIcon className="h-6 w-6" />
              {isConnecting ? 'Connecting…' : 'Start Conversation'}
            </button>
          ) : (
            <button
              onClick={stopSession}
              className="flex items-center gap-3 px-8 py-4 bg-red-600 text-white rounded-full text-lg font-semibold hover:bg-red-700 transition-all duration-200 shadow-lg transform hover:scale-105"
            >
              <StopIcon className="h-6 w-6" />
              Stop Conversation
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceChat;