import { useEffect, useState } from 'react';
import { ArtifactGenerator } from './components/ArtifactGenerator';
import { AuthScreen } from './components/auth/AuthScreen';
import {
  login as loginUser,
  fetchCurrentUser,
  getAuthToken,
  clearAuthToken
} from './services/authService';
import { Menu, Presentation } from 'lucide-react';

export default function App() {
  const [authUser, setAuthUser] = useState<{ login?: string; email?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [historyOverlayOpen, setHistoryOverlayOpen] = useState(false);
  const [overlayAllowed, setOverlayAllowed] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }
    fetchCurrentUser()
      .then(user => {
        setAuthUser({ login: user.login, email: user.email });
      })
      .catch(() => {
        clearAuthToken();
        setAuthUser(null);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(max-width: 1024px)');
    const handleChange = () => {
      setOverlayAllowed(media.matches);
      if (!media.matches) {
        setHistoryOverlayOpen(false);
      }
    };
    handleChange();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const handleLogin = async (email: string, password: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await loginUser(email, password);
      const user = await fetchCurrentUser();
      setAuthUser({ login: user.login, email: user.email });
    } catch (error: any) {
      setAuthError(error?.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <div className="text-sm text-neutral-400">Loading...</div>
      </div>
    );
  }

  if (!authUser) {
    return <AuthScreen loading={authLoading} error={authError} onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-indigo-500 selection:text-white flex flex-col">
      <header className="shrink-0 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="xl:hidden p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors"
              onClick={() => setHistoryOverlayOpen(true)}
              aria-label="Open artifacts"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Presentation className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Artifact</h1>
          </div>
          <div className="text-sm text-neutral-400 hidden sm:block">
            Powered by AE2
          </div>
        </div>
      </header>

      <main className="flex-1 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <ArtifactGenerator
            historyOverlayOpen={overlayAllowed && historyOverlayOpen}
            onHistoryOverlayClose={() => setHistoryOverlayOpen(false)}
          />
        </div>
      </main>
    </div>
  );
}
