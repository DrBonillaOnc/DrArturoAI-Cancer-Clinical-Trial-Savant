import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';

const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('A hopeful, abstract visualization of a successful clinical trial, with glowing particles representing healing.');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('1:1');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setImageUrl(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: aspectRatio,
        },
      });
      
      const base64ImageBytes = response.generatedImages[0].image.imageBytes;
      setImageUrl(`data:image/jpeg;base64,${base64ImageBytes}`);
    } catch (err) {
      console.error(err);
      setError('Failed to generate image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const aspectRatios: { value: '1:1' | '16:9' | '9:16' | '4:3' | '3:4'; label: string }[] = [
    { value: '1:1', label: 'Square' },
    { value: '16:9', label: 'Landscape' },
    { value: '9:16', label: 'Portrait' },
    { value: '4:3', label: 'Standard' },
    { value: '3:4', label: 'Tall' },
  ];

  return (
    <div className="h-full flex flex-col md:flex-row bg-slate-950 animate-[fade-in_0.5s_ease-out]">
      <div className="w-full md:w-1/3 p-4 sm:p-6 border-b md:border-b-0 md:border-r border-slate-700/50 flex flex-col">
        <h2 className="text-2xl font-bold mb-4 text-slate-200">Image Generation</h2>
        <div className="space-y-4 flex-grow flex flex-col">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-slate-400">Prompt</label>
            <textarea
              id="prompt"
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="mt-1 block w-full bg-slate-800 text-slate-200 rounded-md border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="e.g., A robot holding a red skateboard."
            />
          </div>
          <div>
            <label htmlFor="aspectRatio" className="block text-sm font-medium text-slate-400">Aspect Ratio</label>
            <select
              id="aspectRatio"
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as any)}
              className="mt-1 block w-full bg-slate-800 text-slate-200 rounded-md border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              {aspectRatios.map(ar => <option key={ar.value} value={ar.value}>{ar.label} ({ar.value})</option>)}
            </select>
          </div>
          <div className="flex-grow"></div>
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Generating...' : 'Generate Image'}
          </button>
        </div>
      </div>
      <div className="flex-1 p-4 sm:p-6 flex items-center justify-center bg-slate-900">
        {isLoading && (
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-400/20 border-t-blue-400 rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-400">Generating your image...</p>
          </div>
        )}
        {error && <p className="text-red-500">{error}</p>}
        {imageUrl && (
          <img src={imageUrl} alt="Generated" className="max-w-full max-h-full rounded-lg shadow-lg object-contain animate-[fade-in_0.5s_ease-out]" />
        )}
        {!isLoading && !error && !imageUrl && (
            <div className="text-center text-slate-600">
                <p>Your generated image will appear here.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default ImageGenerator;