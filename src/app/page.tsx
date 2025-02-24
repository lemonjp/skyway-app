'use client';

import { useState, useEffect } from 'react';
import { LoginForm } from './components/LoginForm';
import { ParticipantsList } from './components/ParticipantsList';
import { useSkyWay } from './hooks/useSkyWay';
import { MuteButton } from './components/MuteButton';

export default function Home() {
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  const { participants, connect, disconnect, isMuted, toggleMute } = useSkyWay();

  // ページロード時に保存されているログイン情報を復元
  useEffect(() => {
    const savedUser = localStorage.getItem('loggedInUser');
    if (savedUser) {
      setLoggedInUser(savedUser);
      connect(savedUser);
    }
  }, [connect]);

  const handleLoginSuccess = (username: string) => {
    setLoggedInUser(username);
    localStorage.setItem('loggedInUser', username);
  };

  const handleLogout = async () => {
    await disconnect();
    setLoggedInUser(null);
    localStorage.removeItem('loggedInUser');
  };

  return (
    <main className="min-h-screen bg-gray-100">
      {!loggedInUser ? (
        <LoginForm onLoginSuccess={handleLoginSuccess} />
      ) : (
        <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">ようこそ、{loggedInUser}さん</h2>
            <div className="space-x-2">
              <MuteButton isMuted={isMuted} onToggle={toggleMute} />
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                ログアウト
              </button>
            </div>
          </div>
          <ParticipantsList participants={participants} />
          {/* ここに後でビデオチャット機能を追加 */}
        </div>
      )}
    </main>
  );
}
