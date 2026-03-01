import { Loader2 } from "lucide-react";

const TMDB_IMG = "https://image.tmdb.org/t/p";

interface TmdbResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
}

interface Props {
  results: TmdbResult[];
  loadingDetails: boolean;
  onSelect: (item: TmdbResult) => void;
}

export function VideoBannerResults({ results, loadingDetails, onSelect }: Props) {
  if (results.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3 text-foreground">Resultados</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {results.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelect(r)}
            className="group relative rounded-lg overflow-hidden border bg-card shadow-sm hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {r.poster_path ? (
              <img
                src={`${TMDB_IMG}/w342${r.poster_path}`}
                alt={r.title || r.name}
                className="w-full aspect-[2/3] object-cover"
              />
            ) : (
              <div className="w-full aspect-[2/3] bg-muted flex items-center justify-center text-muted-foreground text-xs p-2 text-center">
                {r.title || r.name}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
              <p className="text-xs text-white font-medium truncate">{r.title || r.name}</p>
              <p className="text-[10px] text-white/70">
                {r.media_type === "tv" ? "Série" : "Filme"} • {(r.release_date || r.first_air_date || "").slice(0, 4)}
              </p>
            </div>
            {loadingDetails && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
