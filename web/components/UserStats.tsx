import React from 'react';

interface User {
  total_generations: number;
  total_tokens_used: number;
}

interface UserStatsProps {
  user: User;
}

export default function UserStats({ user }: UserStatsProps) {
  const stats = [
    {
      label: 'Total Generations',
      value: user.total_generations || 0,
      icon: '⚡',
    },
    {
      label: 'Tokens Used',
      value: (user.total_tokens_used || 0).toLocaleString(),
      icon: '🔤',
    },
    {
      label: 'Free Tier',
      value: 'Active',
      icon: '🎁',
    },
  ];

  return (
    <>
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-roblox-dark border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition-colors"
        >
          <div className="text-3xl mb-2">{stat.icon}</div>
          <p className="text-gray-400 text-sm">{stat.label}</p>
          <p className="text-3xl font-bold text-roblox-accent mt-2">{stat.value}</p>
        </div>
      ))}
    </>
  );
}
