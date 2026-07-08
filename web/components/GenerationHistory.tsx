import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface Generation {
  id: string;
  prompt: string;
  generated_code: string;
  tokens_used: number;
  created_at: string;
  source_script_name?: string;
}

interface GenerationHistoryProps {
  generations: Generation[];
}

export default function GenerationHistory({ generations }: GenerationHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (generations.length === 0) {
    return (
      <div className="bg-roblox-dark border border-gray-700 rounded-lg p-12 text-center">
        <p className="text-gray-400 text-lg">No generations yet. Start creating code!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {generations.map((gen) => (
        <div
          key={gen.id}
          className="bg-roblox-dark border border-gray-700 rounded-lg overflow-hidden hover:border-gray-600 transition-colors"
        >
          {/* Header */}
          <button
            onClick={() => setExpandedId(expandedId === gen.id ? null : gen.id)}
            className="w-full p-4 text-left hover:bg-black transition-colors flex justify-between items-start"
          >
            <div className="flex-1">
              <p className="text-white font-semibold line-clamp-2">{gen.prompt}</p>
              <div className="flex gap-4 mt-2 text-xs text-gray-400">
                <span>📅 {formatDistanceToNow(new Date(gen.created_at), { addSuffix: true })}</span>
                <span>🔤 {gen.tokens_used} tokens</span>
                {gen.source_script_name && <span>📄 {gen.source_script_name}</span>}
              </div>
            </div>
            <span className="text-roblox-accent ml-4">
              {expandedId === gen.id ? '▼' : '▶'}
            </span>
          </button>

          {/* Expanded Content */}
          {expandedId === gen.id && (
            <div className="bg-black border-t border-gray-700 p-4 space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-2">Generated Code:</h4>
                <pre className="bg-roblox-darker rounded-lg p-4 overflow-x-auto text-xs text-gray-300 border border-gray-600 max-h-64 overflow-y-auto">
                  <code>{gen.generated_code}</code>
                </pre>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(gen.generated_code)}
                className="w-full px-4 py-2 bg-roblox-accent hover:bg-roblox-accent-dark rounded-lg font-semibold text-black transition-colors"
              >
                📋 Copy Code
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
