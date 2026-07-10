import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import TokenSection from './TokenSection';
import GenerationHistory from './GenerationHistory';
import UserStats from './UserStats';

interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  api_token: string;
  api_token_created_at: string;
  total_generations: number;
  total_tokens_used: number;
}

interface Generation {
  id: string;
  prompt: string;
  generated_code: string;
  tokens_used: number;
  created_at: string;
  source_script_name?: string;
}

export default function Dashboard() {
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<User | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');

  useEffect(() => {
    fetchUserData();
    fetchGenerations();
  }, []);

  async function fetchUserData() {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setError('Not authenticated');
        return;
      }

      const { data, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (dbError) throw dbError;
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user data');
    } finally {
      setLoading(false);
    }
  }

  async function fetchGenerations() {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data, error: dbError } = await supabase
        .from('generations_history')
        .select('*')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (dbError) throw dbError;
      setGenerations(data || []);
    } catch (err) {
      console.error('Failed to fetch generations:', err);
    }
  }

  async function handleClearHistory() {
    if (!user || !window.confirm('Are you sure? This cannot be undone.')) return;

    try {
      const { error: dbError } = await supabase
        .from('generations_history')
        .delete()
        .eq('user_id', user.id);

      if (dbError) throw dbError;
      setGenerations([]);
      alert('History cleared successfully');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to clear history');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-roblox-darker">
        <div className="text-roblox-accent text-lg">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-roblox-darker">
        <div className="text-red-500 text-lg">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-roblox-darker text-white">
      {/* Header */}
      <header className="bg-roblox-dark border-b border-gray-700 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-roblox-accent mb-2">
            Roblox AI Assistant
          </h1>
          <p className="text-gray-400">Welcome, {user?.display_name || user?.username}</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-3 font-semibold transition-colors ${
              activeTab === 'overview'
                ? 'text-roblox-accent border-b-2 border-roblox-accent'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-3 font-semibold transition-colors ${
              activeTab === 'history'
                ? 'text-roblox-accent border-b-2 border-roblox-accent'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            History
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && user && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <UserStats user={user} />
            </div>
            <TokenSection user={user} onTokenRefresh={fetchUserData} />
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Generation History</h2>
              <button
                onClick={handleClearHistory}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-sm font-semibold"
              >
                Clear History
              </button>
            </div>
            <GenerationHistory generations={generations} />
          </div>
        )}
      </main>
    </div>
  );
}
