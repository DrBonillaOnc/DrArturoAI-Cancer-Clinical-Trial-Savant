
import { GroundingChunk } from "@google/genai";

export interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  sources?: GroundingChunk[];
}

export interface TranscriptionTurn {
  id: string;
  userInput: string;
  modelOutput: string;
}
