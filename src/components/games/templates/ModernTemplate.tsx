import { Match } from "../MatchSelectionGrid";

interface Props {
  matches: Match[];
  title: string;
  logoUrl: string | null;
  whatsapp: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  format: "square" | "story";
  backgroundUrl?: string | null;
}

const CHANNEL_NAMES: Record<string, string> = {
  globo: "Globo", sportv: "SporTV", premiere: "Premiere", espn: "ESPN",
  star_plus: "Star+", amazon: "Prime Video", cazetv: "CazéTV",
  band: "Band", record: "Record", paramount: "Paramount+",
};

function formatTime(dateStr: string) {
  try { return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

export function ModernTemplate({ matches, title, logoUrl, whatsapp, primaryColor, secondaryColor, accentColor, format, backgroundUrl }: Props) {
  const isStory = format === "story";
  const w = 1080;
  const h = isStory ? 1920 : 1080;

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: "100%",
        aspectRatio: `${w}/${h}`,
        background: `linear-gradient(135deg, ${primaryColor}, #0a0a1a)`,
        color: secondaryColor,
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Background image */}
      {backgroundUrl && (
        <div className="absolute inset-0" style={{ backgroundImage: `url(${backgroundUrl})`, backgroundSize: "100% 100%", backgroundPosition: "center" }} />
      )}
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)", backgroundSize: "30px 30px" }} />

      <div className="relative z-10 flex flex-col h-full p-[5%]">
        {/* Header */}
        <div className="flex items-center justify-between mb-[4%]">
          <div>
            <h1 className="font-black uppercase tracking-wider" style={{ fontSize: isStory ? "1.8em" : "1.5em", color: accentColor }}>
              {title}
            </h1>
            <p className="text-sm opacity-70 mt-0.5">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          {logoUrl && <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain" crossOrigin="anonymous" />}
        </div>

        {/* Matches grid */}
        <div className="flex-1 grid gap-[2%]" style={{ gridTemplateColumns: "1fr 1fr", gridTemplateRows: `repeat(${Math.ceil(matches.length / 2)}, 1fr)` }}>
          {matches.map((m) => (
            <div key={m.id} className="rounded-xl p-[6%] flex flex-col justify-center" style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <p className="text-[0.6em] uppercase tracking-widest opacity-60 mb-[4%] truncate">{m.league.name}</p>
              <div className="flex items-center justify-between gap-[4%]">
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <img src={m.home.logo} alt="" className="h-8 w-8 object-contain mb-1" crossOrigin="anonymous" />
                  <span className="text-[0.55em] font-bold text-center truncate w-full">{m.home.name}</span>
                </div>
                <div className="text-center shrink-0">
                  <span className="font-black text-[0.9em]" style={{ color: accentColor }}>
                    {formatTime(m.date)}
                  </span>
                </div>
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <img src={m.away.logo} alt="" className="h-8 w-8 object-contain mb-1" crossOrigin="anonymous" />
                  <span className="text-[0.55em] font-bold text-center truncate w-full">{m.away.name}</span>
                </div>
              </div>
              {m.channels && m.channels.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-[4%] justify-center">
                  {m.channels.map((ch) => (
                    <span key={ch} className="text-[0.4em] px-1.5 py-0.5 rounded-full font-bold" style={{ background: accentColor, color: primaryColor }}>
                      {CHANNEL_NAMES[ch] || ch}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-[3%] flex items-center justify-between pt-[2%]" style={{ borderTop: `1px solid rgba(255,255,255,0.15)` }}>
          {logoUrl && <img src={logoUrl} alt="" className="h-8 w-auto object-contain" crossOrigin="anonymous" />}
          {whatsapp && (
            <div className="flex items-center gap-2">
              <span className="text-[0.7em]">📱</span>
              <span className="text-[0.7em] font-bold">{whatsapp}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
