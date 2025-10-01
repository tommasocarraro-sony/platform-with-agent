import { MovieProvider } from './MovieContext';
import MovieGrid from "./MovieGrid";
import AgentChat from "./AgentChat";

function App() {
  return (
    <MovieProvider>
        <div className="bg-gray-900 min-h-screen text-white">
          <h1 className="text-3xl font-bold p-6">MovieLens App</h1>
          <MovieGrid />
            <AgentChat/>
        </div>
    </MovieProvider>
  );
}

export default App;