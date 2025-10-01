import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useMovieContext } from "./MovieContext";
import { useAuth } from "./AuthContext";
import { LogOut, ChevronLeft, ChevronRight } from "lucide-react";

export default function MovieGrid() {
  const [allMovies, setAllMovies] = useState([]);
  const [carousels, setCarousels] = useState([]);
  const [filteredMovies, setFilteredMovies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [carouselsLoading, setCarouselsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const { recommendedMovieIds, setRecommendedMovieIds } = useMovieContext(); // Added setter
  const { user, logout } = useAuth();
  const carouselRefs = useRef({});

  // Enhanced logout function that clears recommendations
  const handleLogout = () => {
    // Clear recommendation state
    setRecommendedMovieIds([]);
    // Reset to all movies tab
    setActiveTab('all');
    // Call the original logout
    logout();
  };

  // Load carousels and all movies
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      setLoading(true);
      setCarouselsLoading(true);

      try {
        // Load carousels
        const carouselsResponse = await axios.get(`http://127.0.0.1:8000/carousels?user_id=${user.id}`);
        setCarousels(carouselsResponse.data);

        // Load all movies
        const ids = Array.from({ length: 1682 }, (_, i) => i + 1);
        const query = ids.join(",");
        const moviesResponse = await axios.get(`http://127.0.0.1:8000/movies?ids=${query}&user_id=${user.id}`);
        setAllMovies(moviesResponse.data);
        setFilteredMovies(moviesResponse.data);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
        setCarouselsLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Update displayed movies when tab or recommendations change
  useEffect(() => {
    if (activeTab === 'recommended' && recommendedMovieIds.length > 0) {
      const movieLookup = {};
      allMovies.forEach(movie => {
        const movieId = parseInt(movie.item_id || movie.movie_id);
        movieLookup[movieId] = movie;
      });

      const recommendedMovies = recommendedMovieIds
        .map(id => movieLookup[id])
        .filter(movie => movie !== undefined);

      setFilteredMovies(recommendedMovies);
    } else {
      setFilteredMovies(allMovies);
    }
  }, [activeTab, recommendedMovieIds, allMovies]);

  // Auto-switch to recommendations tab when new recommendations arrive
  useEffect(() => {
    if (recommendedMovieIds.length > 0) {
      setActiveTab('recommended');
    }
  }, [recommendedMovieIds]);

  // Reset to 'all' tab when user changes (on logout/login)
  useEffect(() => {
    setActiveTab('all');
    setRecommendedMovieIds([]); // Clear any existing recommendations
  }, [user, setRecommendedMovieIds]);

  // Carousel scroll functions
  const scrollCarousel = (carouselKey, direction) => {
    const container = carouselRefs.current[carouselKey];
    if (container) {
      const scrollAmount = 400;
      container.scrollLeft += direction * scrollAmount;
    }
  };

  const MovieCard = ({ movie, showBadge = false, badgeText = "Recommended", badgeColor = "green" }) => (
    <div
      onClick={() => setSelected(movie)}
      className="cursor-pointer bg-gray-800 rounded-lg shadow-lg overflow-hidden hover:scale-105 transition-transform duration-200 flex-shrink-0 w-48"
    >
      <img
        src={movie.poster_url || "/placeholder-poster.jpg"}
        alt={movie.title}
        className="w-full h-64 object-cover"
      />
      <div className="p-3">
        <h3 className="text-sm font-semibold truncate mb-1 text-white">{movie.title}</h3>
        <p className="text-yellow-400 text-xs">⭐ {movie.imdb_rating || "N/A"}</p>
        {showBadge && (
          <div className="mt-1">
            <span className={`inline-block bg-${badgeColor}-600 text-white text-xs px-2 py-1 rounded-full`}>
              {badgeText}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  if (!user) {
    return null;
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
            onClick={handleLogout} // Use the enhanced logout function
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

        {/* Content based on active tab */}
        {activeTab === 'all' && (
          <>
            {/* Carousels Section - Only show in "All Movies" tab */}
            {!carouselsLoading && Object.keys(carousels).length > 0 && (
              <div className="space-y-8 mb-12">
                {Object.entries(carousels).map(([key, carousel]) => (
                  <div key={key} className="carousel-section">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-bold text-white">{carousel.name}</h2>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => scrollCarousel(key, -1)}
                          className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors"
                        >
                          <ChevronLeft size={20} className="text-white" />
                        </button>
                        <button
                          onClick={() => scrollCarousel(key, 1)}
                          className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors"
                        >
                          <ChevronRight size={20} className="text-white" />
                        </button>
                      </div>
                    </div>

                    <div
                      ref={el => carouselRefs.current[key] = el}
                      className="flex space-x-4 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      {carousel.movies.map((movie, index) => (
                        <MovieCard
                          key={`${key}-${movie.item_id || movie.movie_id}`}
                          movie={movie}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Carousels Loading State */}
            {carouselsLoading && (
              <div className="mb-12">
                <div className="animate-pulse">
                  <div className="h-6 bg-gray-700 rounded w-48 mb-4"></div>
                  <div className="flex space-x-4">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="w-48 h-80 bg-gray-700 rounded-lg"></div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* All Movies Section */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">All Movies</h2>
                <p className="text-gray-400 text-sm">
                  Showing {filteredMovies.length} {filteredMovies.length === 1 ? 'movie' : 'movies'}
                </p>
              </div>

              {/* Movie Grid */}
              <div className="grid grid-cols-9">
                {filteredMovies.map((m) => (
                  <MovieCard
                    key={m.item_id || m.movie_id}
                    movie={m}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'recommended' && (
          /* AI Recommended Section - Only show in "Recommended" tab */
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">AI Recommended Movies</h2>
              <p className="text-gray-400 text-sm">
                Showing {filteredMovies.length} {filteredMovies.length === 1 ? 'movie' : 'movies'}
              </p>
            </div>

            {/* Movie Grid for Recommendations */}
            <div className="grid grid-cols-9">
              {filteredMovies.map((m) => (
                <MovieCard
                  key={m.item_id || m.movie_id}
                  movie={m}
                  showBadge={true}
                  badgeText="AI Recommended"
                  badgeColor="green"
                />
              ))}
            </div>
          </div>
        )}

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
                    <p><b>Actors:</b> {selected.actors || "Unknown"}</p>
                    <p><b>Producer:</b> {selected.producer || "Unknown"}</p>
                    <p><b>Genres:</b> {selected.genres || "Unknown"}</p>
                    <p><b>Country:</b> {selected.country || "Unknown"}</p>
                    <p><b>Year:</b> {selected.release_date || "Unknown"}</p>
                    <p><b>Duration:</b> {selected.duration || "Unknown"}</p>
                    <p>
                      <b>Link to movie:</b>{" "}
                      {selected.movie_url ? (
                        <a
                          href={selected.movie_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          IMDb
                        </a>
                      ) : (
                        "Unknown"
                      )}
                    </p>
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

      {/* Custom CSS for hiding scrollbar */}
      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}