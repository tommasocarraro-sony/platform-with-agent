import { createContext, useContext, useState } from 'react';

const MovieContext = createContext();

export function MovieProvider({ children }) {
  const [recommendedMovieIds, setRecommendedMovieIds] = useState([]);
  const [allMovies, setAllMovies] = useState([]);

  return (
    <MovieContext.Provider value={{
      recommendedMovieIds,
      setRecommendedMovieIds,
      allMovies,
      setAllMovies
    }}>
      {children}
    </MovieContext.Provider>
  );
}

export function useMovieContext() {
  return useContext(MovieContext);
}