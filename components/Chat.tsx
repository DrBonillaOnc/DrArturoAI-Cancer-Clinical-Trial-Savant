
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { Message } from '../types';
import { SendIcon, TrashIcon, SpeakerWaveIcon, StopIcon, SettingsIcon, UserCircleIcon, HeartIcon, BriefcaseIcon, BeakerIcon, SwitchUserIcon } from './icons';
import { decode, decodeAudioData } from '../utils/audioUtils';

const MALE_VOICES = ['Zephyr', 'Puck', 'Fenrir'];
const FEMALE_VOICES = ['Kore', 'Charon'];

type UserPersona = 'Patient' | 'Caregiver' | 'Physician' | 'Researcher';

const DR_ARTURO_WELCOME = `Hello! I am DrArturo AI, your augmented intelligence navigator from Massive Bio. I'm designed to provide in-depth, reliable information about cancer clinical trials, acting as your personal clinical research coordinator, patient navigator, and medical oncologist.

How can I assist you, your patient, or your research team today?`;

const AI_NAVIGATOR_WELCOME = `Hello! I am your AI Navigator from Massive Bio. I'm designed to provide in-depth, reliable information about cancer clinical trials, acting as your personal clinical research coordinator, patient navigator, and medical oncology expert.

How can I assist you, your patient, or your research team today?`;

const DR_ARTURO_SYSTEM_INSTRUCTION = `You are **DrArturo AI**, an augmented-intelligence assistant from Massive Bio. You combine the expertise of a board-certified medical oncologist with the empathy and practicality of a clinical research coordinator and patient navigator.

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
  — What to expect (timing/logistics)`;

const AI_NAVIGATOR_SYSTEM_INSTRUCTION = `You are the **AI Navigator**, an augmented-intelligence assistant from Massive Bio. You combine the expertise of a board-certified medical oncologist with the empathy and practicality of a clinical research coordinator and patient navigator.

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
- To make time‑sensitive or specific factual claims (trial status, arms, locations, drug approvals, inclusion/exclusion, study results), you MUST use the Goolge Search tool.
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
  — What to expect (timing/logistics)`;


const PersonaButton: React.FC<{icon: React.ReactNode, title: string, onClick: () => void}> = ({ icon, title, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="group flex flex-col items-center justify-center p-6 sm:p-8 bg-slate-800/50 rounded-xl border border-slate-700 hover:border-blue-500 hover:bg-slate-800 transition-all duration-300 transform hover:-translate-y-1"
        >
            <div className="mb-4 text-blue-400 group-hover:text-blue-300 transition-colors">{icon}</div>
            <span className="text-lg font-semibold text-slate-200">{title}</span>
        </button>
    );
};


const Chat: React.FC = () => {
    const [userPersona, setUserPersona] = useState<UserPersona | null>(() => {
        return localStorage.getItem('massivebio-user-persona') as UserPersona | null;
    });

    const getInitialMessages = (): Message[] => {
        if (!userPersona) return [];
        try {
          const saved = localStorage.getItem('massivebio-chat-history');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
          }
        } catch (error) {
            console.error("Could not load chat history:", error);
        }
        const initialVoice = localStorage.getItem('massivebio-tts-voice') || 'Kore';
        const isMale = MALE_VOICES.includes(initialVoice);
        return [{
            id: 'init',
            sender: 'bot',
            text: isMale ? DR_ARTURO_WELCOME : AI_NAVIGATOR_WELCOME,
        }];
    };

    const [messages, setMessages] = useState<Message[]>(getInitialMessages);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // TTS State
    const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
    const [isTtsLoading, setIsTtsLoading] = useState<string | null>(null);
    const [ttsError, setTtsError] = useState<string | null>(null);
    const [ttsVoice, setTtsVoice] = useState<string>(() => localStorage.getItem('massivebio-tts-voice') || 'Kore');
    const [ttsVolume, setTtsVolume] = useState<number>(() => {
        const savedVolume = localStorage.getItem('massivebio-tts-volume');
        return savedVolume ? parseInt(savedVolume, 10) : 80;
    });
    const [showTtsSettings, setShowTtsSettings] = useState(false);
    const audioRef = useRef<{ context: AudioContext; source: AudioBufferSourceNode; gainNode: GainNode } | null>(null);
  
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    useEffect(() => {
        try {
            if (!userPersona) return;
            const initialMessageText = messages[0]?.text;
            if (messages.length > 1 || (initialMessageText !== DR_ARTURO_WELCOME && initialMessageText !== AI_NAVIGATOR_WELCOME)) { 
                localStorage.setItem('massivebio-chat-history', JSON.stringify(messages));
            }
        } catch(error) {
            console.error("Could not save chat history:", error);
        }
    }, [messages, userPersona]);
  
    useEffect(() => {
        localStorage.setItem('massivebio-tts-voice', ttsVoice);
    }, [ttsVoice]);

    useEffect(() => {
        localStorage.setItem('massivebio-tts-volume', ttsVolume.toString());
    }, [ttsVolume]);

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.source.stop();
                audioRef.current.context.close();
            }
        };
    }, []);

    const getSystemInstruction = () => {
        if (!userPersona) return '';
        const isMaleVoice = MALE_VOICES.includes(ttsVoice);
        const baseInstruction = isMaleVoice ? DR_ARTURO_SYSTEM_INSTRUCTION : AI_NAVIGATOR_SYSTEM_INSTRUCTION;
        const prefix = `You are speaking with a ${userPersona}. Adapt your language, tone, and the technical depth of your responses accordingly.\n\n`;
        return prefix + baseInstruction;
    }

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { id: Date.now().toString(), sender: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            
            const history = messages
                .slice(1) // remove initial welcome message
                .slice(-20) // take last 20 messages
                .map(msg => ({
                    role: msg.sender === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.text }]
                }));

            const contents = [...history, { role: 'user', parts: [{ text: input }] }];
            
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: contents,
                config: {
                    systemInstruction: getSystemInstruction(),
                    tools: [{ googleSearch: {} }],
                },
            });

            const botMessage: Message = {
                id: (Date.now() + 1).toString(),
                sender: 'bot',
                text: response.text,
                sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks,
            };
            setMessages(prev => [...prev, botMessage]);
        } catch (err) {
            console.error(err);
            setError('Sorry, something went wrong. Please try again.');
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                sender: 'bot',
                text: 'I apologize, but I encountered an error while processing your request. Please check your connection or try again later.',
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };
  
    const handleClearHistory = () => {
        const isMaleVoice = MALE_VOICES.includes(ttsVoice);
        setMessages([
            {
              id: 'init',
              sender: 'bot',
              text: isMaleVoice ? DR_ARTURO_WELCOME : AI_NAVIGATOR_WELCOME,
            }
        ]);
        localStorage.removeItem('massivebio-chat-history');
    }
    
    const selectPersona = (persona: UserPersona) => {
        setUserPersona(persona);
        localStorage.setItem('massivebio-user-persona', persona);
        handleClearHistory(); // Resets and sets welcome message
    }

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseInt(e.target.value, 10);
        setTtsVolume(newVolume);
        if (audioRef.current) {
            audioRef.current.gainNode.gain.setValueAtTime(newVolume / 100, audioRef.current.context.currentTime);
        }
    };

    const handlePlayTTS = async (messageId: string, text: string) => {
        const stopCurrentAudio = () => {
            if (audioRef.current) {
                audioRef.current.source.onended = null;
                audioRef.current.source.stop();
                audioRef.current.context.close().catch(console.error);
                audioRef.current = null;
                setPlayingMessageId(null);
            }
        };

        if (isTtsLoading) return;
        if (playingMessageId === messageId) {
            stopCurrentAudio();
            return;
        } else {
            stopCurrentAudio();
        }

        setIsTtsLoading(messageId);
        setTtsError(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: ttsVoice } } }
                },
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!base64Audio) throw new Error("No audio data received.");
            
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const gainNode = audioContext.createGain();
            gainNode.gain.value = ttsVolume / 100;

            const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            source.start();

            audioRef.current = { context: audioContext, source, gainNode };
            setPlayingMessageId(messageId);

            source.onended = () => {
                if (audioRef.current?.source === source) {
                    setPlayingMessageId(null);
                    audioRef.current = null;
                }
            };

        } catch (err) {
            console.error("TTS Error:", err);
            setTtsError("Sorry, couldn't play audio.");
        } finally {
            setIsTtsLoading(null);
        }
    };
    
    if (!userPersona) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-4 sm:p-8 bg-slate-900 animate-[fade-in_0.5s_ease-out]">
                <div className="text-center">
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-2">Welcome to the AI Navigator</h2>
                    <p className="text-slate-400 mb-8 max-w-lg">To personalize your experience, please tell us who you are.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 w-full max-w-4xl">
                    <PersonaButton icon={<UserCircleIcon className="h-10 w-10" />} title="Patient" onClick={() => selectPersona('Patient')} />
                    <PersonaButton icon={<HeartIcon className="h-10 w-10" />} title="Caregiver" onClick={() => selectPersona('Caregiver')} />
                    <PersonaButton icon={<BriefcaseIcon className="h-10 w-10" />} title="Physician" onClick={() => selectPersona('Physician')} />
                    <PersonaButton icon={<BeakerIcon className="h-10 w-10" />} title="Researcher" onClick={() => selectPersona('Researcher')} />
                </div>
            </div>
        );
    }

    const BotMessage: React.FC<{message: Message}> = ({ message }) => {
        const isPlaying = playingMessageId === message.id;
        const isLoadingTts = isTtsLoading === message.id;
        
        return (
          <div className="flex items-start gap-3 animate-[slide-in-bottom_0.4s_ease-out]">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-sm">MB</div>
            <div className="flex items-end gap-2">
                <div className="bg-slate-800 rounded-lg p-3 max-w-lg shadow-md">
                    <p className="text-sm text-slate-300" dangerouslySetInnerHTML={{ __html: message.text.replace(/\n/g, '<br />') }}></p>
                    {message.sources && message.sources.length > 0 && (
                        <div className="mt-3 border-t border-slate-700 pt-2">
                        <h4 className="text-xs font-semibold mb-1 text-slate-400">Sources:</h4>
                        <ul className="text-xs list-none space-y-1">
                            {message.sources.map((source, index) => (
                            <li key={index} className="truncate">
                                <a
                                href={source.web?.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline"
                                >
                                {index + 1}. {source.web?.title}
                                </a>
                            </li>
                            ))}
                        </ul>
                        </div>
                    )}
                </div>
                <button
                    onClick={() => handlePlayTTS(message.id, message.text)}
                    disabled={isLoadingTts}
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-700 disabled:cursor-wait transition-colors"
                    aria-label={isPlaying ? 'Stop audio' : 'Play audio'}
                >
                    {isLoadingTts ? (
                        <div className="w-4 h-4 border-2 border-slate-500 border-t-blue-400 rounded-full animate-spin"></div>
                    ) : isPlaying ? (
                        <StopIcon className="h-5 w-5 text-blue-400" />
                    ) : (
                        <SpeakerWaveIcon className="h-5 w-5" />
                    )}
                </button>
            </div>
          </div>
        );
    };
  
    return (
        <div className="h-full flex flex-col bg-slate-900">
          <div className="flex-shrink-0 px-4 sm:px-6 py-3 border-b border-slate-700/50">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-slate-200">Chat ({userPersona})</h3>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setUserPersona(null)}
                        className="p-1.5 rounded-full text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
                        aria-label="Change Role"
                    >
                        <SwitchUserIcon className="h-5 w-5" />
                    </button>
                    <button
                        onClick={() => setShowTtsSettings(prev => !prev)}
                        className={`p-1.5 rounded-full text-slate-400 transition-colors ${showTtsSettings ? 'bg-slate-700 text-blue-400' : 'hover:bg-slate-800'}`}
                        aria-label="Audio settings"
                    >
                        <SettingsIcon className="h-5 w-5" />
                    </button>
                    <button 
                        onClick={handleClearHistory} 
                        className="p-1.5 rounded-full text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors" 
                        aria-label="Clear chat history"
                    >
                        <TrashIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
            {showTtsSettings && (
                <div className="mt-4 p-4 bg-slate-800/50 rounded-lg space-y-4 animate-[fade-in_0.3s_ease-out]">
                    <h4 className="font-semibold text-sm text-slate-300">Audio Playback Settings</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="tts-voice" className="block text-xs font-medium text-slate-400 mb-1">Voice</label>
                            <select 
                                id="tts-voice"
                                value={ttsVoice}
                                onChange={(e) => setTtsVoice(e.target.value)}
                                className="w-full px-3 py-1.5 bg-slate-700 text-sm rounded-md border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            >
                                <optgroup label="Female Voices">
                                    {FEMALE_VOICES.map(voice => <option key={voice} value={voice}>{voice}</option>)}
                                </optgroup>
                                <optgroup label="Male Voices">
                                    {MALE_VOICES.map(voice => <option key={voice} value={voice}>{voice}</option>)}
                                </optgroup>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="tts-volume" className="block text-xs font-medium text-slate-400 mb-1">Volume</label>
                            <input
                                id="tts-volume"
                                type="range"
                                min="0"
                                max="100"
                                value={ttsVolume}
                                onChange={handleVolumeChange}
                                className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    </div>
                </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {messages.map((msg) =>
              msg.sender === 'user' ? (
                <div key={msg.id} className="flex justify-end animate-[slide-in-bottom_0.4s_ease-out]">
                  <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-lg p-3 max-w-lg shadow-md">
                    <p className="text-sm">{msg.text}</p>
                  </div>
                </div>
              ) : (
                <BotMessage key={msg.id} message={msg} />
              )
            )}
            {isLoading && (
              <div className="flex items-start gap-3 animate-[slide-in-bottom_0.4s_ease-out]">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-sm">MB</div>
                <div className="bg-slate-800 rounded-lg p-3 max-w-lg">
                  <div className="flex items-center gap-2">
                      <div className="h-2 w-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="h-2 w-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="h-2 w-2 bg-blue-400 rounded-full animate-bounce"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 sm:p-6 border-t border-slate-700/50 bg-slate-900">
            {(error || ttsError) && <p className="text-red-500 text-sm mb-2 text-center">{error || ttsError}</p>}
            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about clinical trials..."
                className="flex-1 w-full px-4 py-2 bg-slate-800 text-slate-200 placeholder-slate-500 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
              >
                <SendIcon />
              </button>
            </form>
          </div>
        </div>
    );
};

export default Chat;
