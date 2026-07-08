import React, { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface User {
  id: string;
  api_token: string;
  api_token_created_at: string;
}

interface TokenSectionProps {
  user: User;
  onTokenRefresh: () => Promise<void>;
}

export default function TokenSection({ user, onTokenRefresh }: TokenSectionProps) {
  const supabase = createClientComponentClient();
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(user.api_token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerateToken = async () => {
    if (!window.confirm('This will invalidate your current token. Continue?')) return;

    setRegenerating(true);
    try {
      // Generate new token
      const crypto = require('crypto');
      const newToken = `sk_roblox_${crypto.randomBytes(24).toString('hex')}`;

      // Update in database
      const { error } = await supabase
        .from('users')
        .update({ api_token: newToken })
        .eq('id', user.id);

      if (error) throw error;

      // Archive old token
      await supabase.from('api_tokens_archive').insert({
        user_id: user.id,
        token_hash: user.api_token,
        created_at: user.api_token_created_at,
        reason: 'manual_revoke',
      });

      await onTokenRefresh();
      alert('Token regenerated successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to regenerate token');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="bg-roblox-dark border border-gray-700 rounded-lg p-6">
      <h3 className="text-2xl font-bold mb-4">Plugin Access Token</h3>
      <p className="text-gray-400 text-sm mb-4">
        This token authenticates your Roblox Studio plugin. Keep it secret!
      </p>

      {/* Token Display */}
      <div className="bg-black rounded-lg p-4 mb-4 border border-gray-600">
        <div className="flex items-center justify-between gap-4">
          <code className="text-roblox-accent font-mono text-sm truncate">
            {showToken ? user.api_token : '•'.repeat(50)}
          </code>
          <div className="flex gap-2">
            <button
              onClick={() => setShowToken(!showToken)}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
              title="Toggle visibility"
            >
              {showToken ? '👁️ Hide' : '👁️ Show'}
            </button>
            <button
              onClick={copyToClipboard}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
              title="Copy to clipboard"
            >
              {copied ? '✓ Copied!' : '📋 Copy'}
            </button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4 mb-4">
        <h4 className="font-semibold text-blue-400 mb-2">Setup Instructions:</h4>
        <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
          <li>Copy your token above</li>
          <li>Open Roblox Studio</li>
          <li>Open the Roblox AI Assistant plugin</li>
          <li>Paste token in "Settings" → "API Token"</li>
          <li>Click "Save" and start generating code!</li>
        </ol>
      </div>

      {/* Regenerate Button */}
      <button
        onClick={regenerateToken}
        disabled={regenerating}
        className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 rounded-lg font-semibold transition-colors"
      >
        {regenerating ? 'Regenerating...' : '🔄 Regenerate Token'}
      </button>

      <p className="text-gray-500 text-xs mt-3">
        Created: {new Date(user.api_token_created_at).toLocaleDateString()}
      </p>
    </div>
  );
}
