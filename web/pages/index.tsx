export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">
          🎮 Roblox AI Assistant
        </h1>
        <p className="text-xl text-gray-400 mb-8">
          Generate Luau code with AI
        </p>
        <a
          href="/dashboard"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded"
        >
          Get Started →
        </a>
      </div>
    </div>
  );
}
