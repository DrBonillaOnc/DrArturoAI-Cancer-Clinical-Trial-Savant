import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { Message } from '../types';
import { SendIcon, TrashIcon, SpeakerWaveIcon, StopIcon, SettingsIcon, UserCircleIcon, HeartIcon, BriefcaseIcon, BeakerIcon, SwitchUserIcon, OrbIcon } from './icons';
import { decode, decodeAudioData } from '../utils/audioUtils';
import { getChatSystemInstruction } from '../utils/systemInstructions';

const MALE_VOICES = ['Zephyr', 'Puck', 'Fenrir'];
const FEMALE_VOICES = ['Kore', 'Charon'];

type UserPersona = 'Patient' | 'Caregiver' | 'Physician' | 'Researcher';

const getWelcomeMessage = (persona: UserPersona, isMale: boolean): string => {
    const name = isMale ? 'Dr. Arturo AI' : 'your AI Navigator';
    const baseIntro = `Hello! I am ${name}, your augmented intelligence navigator from Massive Bio. I'm designed to provide in-depth, reliable information about cancer clinical trials, acting as your personal clinical research coordinator, patient navigator, and medical oncologist.`;

    switch (persona) {
        case 'Patient':
            return `${baseIntro}\n\nAs a patient, you are at the center of this journey. How can I help you understand your clinical trial options or answer your questions today?`;
        case 'Caregiver':
            return `${baseIntro}\n\nI understand the vital role you play as a caregiver. How can I assist you in navigating clinical trials for your loved one?`;
        case 'Physician':
            return `${baseIntro}\n\nAs a physician, your time is critical. How can I efficiently help you identify potential clinical trials for your patients or provide specific trial information?`;
        case 'Researcher':
            return `${baseIntro}\n\nAs a researcher, you're advancing the future of oncology. How can I assist with your clinical trial information needs today?`;
        default:
             return `${baseIntro}\n\nHow can I assist you today?`;
    }
};

/**
 * A safe markdown parser that only handles **bold** and *italic*.
 * It escapes all other HTML to prevent XSS attacks.
 */
const parseMarkdown = (text: string): string => {
    if (!text) return '';
    const escapedText = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    
    return escapedText
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
};

const PersonaButton: React.FC<{icon: React.ReactNode, title: string, onClick: () => void}> = ({ icon, title, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="group flex flex-col items-center justify-center p-6 sm:p-8 bg-slate-900/50 backdrop-blur-md rounded-xl border border-slate-700/50 hover:border-blue-500 hover:bg-slate-800/70 transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-blue-500/20"
        >
            <div className="mb-4 text-blue-400 group-hover:text-blue-300 transition-colors">{icon}</div>
            <span className="text-lg font-semibold text-slate-200">{title}</span>
        </button>
    );
};

const BotMessage: React.FC<{
    message: Message;
    playingMessageId: string | null;
    isTtsLoading: string | null;
    onPlayTTS: (messageId: string, text: string) => void;
}> = ({ message, playingMessageId, isTtsLoading, onPlayTTS }) => {
    const isPlaying = playingMessageId === message.id;
    const isLoadingTts = isTtsLoading === message.id;
    
    return (
      <div className="flex items-start gap-3 animate-[slide-in-bottom_0.4s_ease-out]">
        <div className="flex-shrink-0 pt-1">
            <OrbIcon isAnimated={false} />
        </div>
        <div className="flex items-end gap-2">
            <div className="bg-slate-800/70 backdrop-blur-sm border border-slate-700/50 rounded-lg p-4 max-w-xl shadow-md">
                {message.text && (
                    <div className="prose text-slate-300" dangerouslySetInnerHTML={{ __html: parseMarkdown(message.text) }}></div>
                )}
                
                {(message.imageIsLoading || message.imageUrl || message.imageError) && (
                    <div className={`mt-3 ${message.text ? 'border-t border-slate-700 pt-3' : ''}`}>
                        {message.imageIsLoading && (
                            <div className="flex flex-col items-center justify-center text-slate-400">
                                <div className="w-8 h-8 border-2 border-blue-400/20 border-t-blue-400 rounded-full animate-spin"></div>
                                <p className="text-xs mt-2">Generating visual aid...</p>
                            </div>
                        )}
                        {message.imageUrl && (
                             <img src={message.imageUrl} alt="Generated visual aid" className="rounded-md w-full shadow-lg" />
                        )}
                        {message.imageError && (
                             <div className="text-center text-red-400 text-sm">
                                <p>{message.imageError}</p>
                            </div>
                        )}
                    </div>
                )}

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
                onClick={() => onPlayTTS(message.id, message.text)}
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

const Chat: React.FC = () => {
    const [userPersona, setUserPersona] = useState<UserPersona | null>(() => {
        return localStorage.getItem('massivebio-user-persona') as UserPersona | null;
    });
    
    const [isThinkingMode, setIsThinkingMode] = useState<boolean>(() => {
        return localStorage.getItem('massivebio-thinking-mode') === 'true';
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
            text: getWelcomeMessage(userPersona, isMale),
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
            // Only save if there's more than the initial welcome message.
            if (messages.length > 1) {
                localStorage.setItem('massivebio-chat-history', JSON.stringify(messages));
            }
        } catch(error) {
            console.error("Could not save chat history:", error);
        }
    }, [messages, userPersona]);
    
    useEffect(() => {
        localStorage.setItem('massivebio-thinking-mode', isThinkingMode.toString());
    }, [isThinkingMode]);
  
    useEffect(() => {
        // If the chat is pristine (only the welcome message), update the welcome message
        // when the voice (gender) or persona changes.
        if (userPersona && messages.length === 1 && messages[0].id === 'init') {
            const isMale = MALE_VOICES.includes(ttsVoice);
            setMessages([{
                ...messages[0],
                text: getWelcomeMessage(userPersona, isMale),
            }]);
        }
    }, [ttsVoice, userPersona]);

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

    const generateAndAddImage = async (messageId: string, prompt: string) => {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: prompt,
                config: {
                  numberOfImages: 1,
                  outputMimeType: 'image/jpeg',
                  aspectRatio: '16:9',
                },
            });
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
    
            setMessages(prevMessages => prevMessages.map(msg => 
                msg.id === messageId 
                ? { ...msg, imageUrl, imageIsLoading: false } 
                : msg
            ));
        } catch (error) {
            console.error("Image generation failed:", error);
            setMessages(prevMessages => prevMessages.map(msg => 
                msg.id === messageId 
                ? { ...msg, imageIsLoading: false, imageError: "Failed to generate visual aid." } 
                : msg
            ));
        }
    };

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

            const model = isThinkingMode ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
            const config: any = {
                systemInstruction: getChatSystemInstruction(userPersona!, MALE_VOICES.includes(ttsVoice), isThinkingMode),
                tools: [{ googleSearch: {} }],
            };

            if (isThinkingMode) {
                config.thinkingConfig = { thinkingBudget: 32768 };
            }
            
            const response = await ai.models.generateContent({
                model,
                contents,
                config,
            });

            const botText = response.text;
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            const visualizeTagRegex = /\[VISUALIZE:\s*(.*?)\s*\]/;
            const match = botText.match(visualizeTagRegex);
    
            const botMessage: Message = {
                id: (Date.now() + 1).toString(),
                sender: 'bot',
                text: botText.replace(visualizeTagRegex, '').trim(),
                sources: groundingChunks,
            };

            if (match) {
                botMessage.imageIsLoading = true;
                const imagePrompt = match[1];
                setMessages(prev => [...prev, botMessage]);
                await generateAndAddImage(botMessage.id, imagePrompt);
            } else {
                setMessages(prev => [...prev, botMessage]);
            }

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
  
    const handleClearHistory = (personaOverride?: UserPersona) => {
        const currentPersona = personaOverride || userPersona;
        if (!currentPersona) return;

        const isMaleVoice = MALE_VOICES.includes(ttsVoice);
        setMessages([
            {
              id: 'init',
              sender: 'bot',
              text: getWelcomeMessage(currentPersona, isMaleVoice),
            }
        ]);
        localStorage.removeItem('massivebio-chat-history');
    }
    
    const selectPersona = (persona: UserPersona) => {
        setUserPersona(persona);
        localStorage.setItem('massivebio-user-persona', persona);
        handleClearHistory(persona); // Resets and sets welcome message
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
            <div className="h-full flex flex-col items-center justify-center p-4 sm:p-8 animate-[fade-in_0.5s_ease-out]">
                <div className="text-center mb-10">
                    <h2 className="text-3xl sm:text-4xl font-bold text-slate-100 mb-2" style={{textShadow: '0 0 10px rgba(255,255,255,0.2)'}}>Welcome to the AI Navigator</h2>
                    <p className="text-slate-400 max-w-lg">To provide a personalized experience, please select your role.</p>
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
  
    return (
        <div className="h-full flex flex-col bg-transparent">
          <div className="flex-shrink-0 px-4 sm:px-6 py-3 border-b border-slate-700/50 bg-slate-900/60 backdrop-blur-md">
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
                        onClick={() => handleClearHistory()} 
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
                  <div className="bg-blue-600/70 backdrop-blur-sm border border-blue-500/50 text-white rounded-lg p-4 max-w-xl shadow-md" style={{boxShadow: '0 0 10px rgba(37, 99, 235, 0.5)'}}>
                    <div className="prose" dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.text) }}></div>
                  </div>
                </div>
              ) : (
                <BotMessage 
                    key={msg.id} 
                    message={msg}
                    playingMessageId={playingMessageId}
                    isTtsLoading={isTtsLoading}
                    onPlayTTS={handlePlayTTS}
                />
              )
            )}
            {isLoading && (
              <div className="flex items-start gap-3 animate-[slide-in-bottom_0.4s_ease-out]">
                <div className="flex-shrink-0 pt-1"><OrbIcon isAnimated={false} /></div>
                <div className="bg-slate-800/70 backdrop-blur-sm border border-slate-700/50 rounded-lg p-3 max-w-lg">
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

          <div className="p-4 sm:p-6 border-t border-slate-700/50 bg-slate-900/60 backdrop-blur-md">
            {(error || ttsError) && <p className="text-red-500 text-sm mb-2 text-center">{error || ttsError}</p>}
            
            <div className="flex items-center justify-end gap-3 mb-2">
                <label htmlFor="thinking-mode-toggle" className="text-sm font-semibold text-slate-300 cursor-pointer">
                    Thinking Mode
                </label>
                <button
                    id="thinking-mode-toggle"
                    role="switch"
                    aria-checked={isThinkingMode}
                    onClick={() => setIsThinkingMode(!isThinkingMode)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                        isThinkingMode ? 'bg-blue-600 shadow-[0_0_8px_var(--primary-glow-color)]' : 'bg-slate-700'
                    }`}
                >
                    <span
                        aria-hidden="true"
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isThinkingMode ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    ></span>
                </button>
            </div>
            <p className="text-xs text-slate-500 text-right mb-3 -mt-1">
                {isThinkingMode 
                    ? "For complex queries. Slower, more powerful." 
                    : "Faster responses for general questions."}
            </p>

            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about clinical trials..."
                className="flex-1 w-full px-4 py-2 bg-slate-800/70 text-slate-200 placeholder-slate-500 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-700 transition-shadow duration-300 focus:shadow-[0_0_15px_var(--primary-glow-color)]"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-blue-500/40 focus:outline-none focus:ring-2 ring-offset-2 ring-offset-slate-900 ring-blue-500"
              >
                <SendIcon />
              </button>
            </form>
          </div>
        </div>
    );
};

export default Chat;