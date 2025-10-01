import { useState, useEffect } from "react";
import axios from "axios";
import { useMovieContext } from "./MovieContext";
import { useAuth } from "./AuthContext";
import { LogOut } from "lucide-react";

export default function MovieGrid() {
  const [allMovies, setAllMovies] = useState([]);
  const [filteredMovies, setFilteredMovies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const { recommendedMovieIds } = useMovieContext();
  const { user, logout } = useAuth();

  // Load all movies on initial render
  useEffect(() => {
    const loadAllMovies = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const ids = Array.from({ length: 1682 }, (_, i) => i + 1);
        const query = ids.join(",");
        const response = await axios.get(`http://127.0.0.1:8000/movies?ids=${query}&user_id=${user.id}`);
        setAllMovies(response.data);
        setFilteredMovies(response.data);
      } catch (err) {
        console.error('Error loading movies:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAllMovies();
  }, [user]);

  // Update displayed movies when tab or recommendations change
useEffect(() => {
  if (activeTab === 'recommended' && recommendedMovieIds.length > 0) {
    // Create a lookup object for quick movie access by ID
    const movieLookup = {};
    allMovies.forEach(movie => {
      const movieId = parseInt(movie.item_id || movie.movie_id);
      movieLookup[movieId] = movie;
    });

    // Preserve the AI's recommended order by mapping through recommendedMovieIds
    const recommendedMovies = recommendedMovieIds
      .map(id => movieLookup[id])
      .filter(movie => movie !== undefined);

    setFilteredMovies(recommendedMovies);
  } else {
    // Show all movies (you might want to keep them ordered by ID or title)
    setFilteredMovies(allMovies);
  }
}, [activeTab, recommendedMovieIds, allMovies]);

  // Auto-switch to recommendations tab when new recommendations arrive
  useEffect(() => {
    if (recommendedMovieIds.length > 0) {
      setActiveTab('recommended');
    }
  }, [recommendedMovieIds]);

  if (!user) {
    return null; // Should not happen when authenticated
  }

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center h-64">
        <div className="text-lg">Loading movies...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header with User Info and Logout */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">MovieLens Platform</h1>
            <p className="text-gray-400">Welcome, {user.name}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Navigation Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-800 rounded-lg p-1 w-fit">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-3 rounded-md font-medium transition-all duration-200 ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              All Movies {allMovies.length > 0 && `(${allMovies.length})`}
            </button>

            {recommendedMovieIds.length > 0 && (
              <button
                onClick={() => setActiveTab('recommended')}
                className={`px-6 py-3 rounded-md font-medium transition-all duration-200 ${
                  activeTab === 'recommended'
                    ? 'bg-green-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                Recommended {recommendedMovieIds.length > 0 && `(${recommendedMovieIds.length})`}
              </button>
            )}
          </div>

          {/* Tab Description */}
          <div className="mt-3">
            {activeTab === 'all' && (
              <p className="text-gray-400 text-sm">
                Browse all available movies in the collection
              </p>
            )}
            {activeTab === 'recommended' && (
              <p className="text-green-400 text-sm">
                🎯 AI-powered recommendations based on your preferences
              </p>
            )}
          </div>
        </div>

        {/* Movie Count */}
        <div className="mb-4">
          <p className="text-gray-400 text-sm">
            Showing {filteredMovies.length} {filteredMovies.length === 1 ? 'movie' : 'movies'} for {user.name}
          </p>
        </div>

        {/* Movie Grid */}
        <div className="grid grid-cols-5 gap-6">
          {filteredMovies.map((m) => (
            <div
              key={m.item_id || m.movie_id}
              onClick={() => setSelected(m)}
              className="cursor-pointer bg-gray-800 rounded-lg shadow-lg overflow-hidden hover:scale-105 transition-transform duration-200"
            >
              <img
                src={m.poster_url || "/placeholder-poster.jpg"}
                alt={m.title}
                className="w-full h-72 object-cover"
              />
              <div className="p-3">
                <h3 className="text-sm font-semibold truncate mb-1 text-white">{m.title}</h3>
                <p className="text-yellow-400 text-xs">⭐ {m.imdb_rating || "N/A"}</p>
                {activeTab === 'recommended' && (
                  <div className="mt-1">
                    <span className="inline-block bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                      Recommended
                    </span>
                  </div>
                )}
                {/* You can add user-specific indicators here based on user.id */}
                {m.user_specific_data && (
                  <div className="mt-1">
                    <span className="inline-block bg-purple-600 text-white text-xs px-2 py-1 rounded-full">
                      Personalized
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Modal */}
        {selected && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
            <div className="bg-white text-black p-6 rounded-lg w-2/3 max-h-[80vh] overflow-y-auto">
              <div className="flex gap-6">
                <img
                  src={selected.poster_url || "/placeholder-poster.jpg"}
                  alt={selected.title}
                  className="w-48 h-72 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-4">{selected.title}</h2>
                  {activeTab === 'recommended' && (
                    <span className="inline-block bg-green-600 text-white text-sm px-3 py-1 rounded-full mb-4">
                      🤖 AI Recommended
                    </span>
                  )}
                  <div className="space-y-3">
                    <p><b>Storyline:</b> {selected.storyline || selected.description || "No description available"}</p>
                    <p><b>Rating:</b> ⭐ {selected.imdb_rating || "N/A"}</p>
                    <p><b>Director:</b> {selected.director || "Unknown"}</p>
                    <p><b>Genres:</b> {selected.genres || "Unknown"}</p>
                    <p><b>Year:</b> {selected.year || "Unknown"}</p>
                    {/* User-specific data can be displayed here */}
                    {selected.user_rating && (
                      <p><b>Your Rating:</b> ⭐ {selected.user_rating}/10</p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="mt-6 bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}