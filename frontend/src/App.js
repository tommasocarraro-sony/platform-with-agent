import { AuthProvider, useAuth } from './AuthContext';
import { MovieProvider } from './MovieContext';
import LoginDialog from './LoginDialog';
import MovieGrid from "./MovieGrid";
import AgentChat from "./AgentChat";

function AppContent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginDialog />;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <MovieGrid />
      <AgentChat />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <MovieProvider>
        <AppContent />
      </MovieProvider>
    </AuthProvider>
  );
}

export default App;