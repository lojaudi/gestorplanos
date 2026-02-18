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
}

const CHANNEL_NAMES: Record<string, string> = {
  globo: "Globo", sportv: "SporTV", premiere: "Premiere", espn: "ESPN",
  star_plus: "Star+", amazon: "Prime Video", cazetv: "CazéTV",
  band: "Band", record: "Record", paramount: "Paramount+",
};

function formatTime(dateStr: string) {
  try { return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

export function MinimalTemplate({ matches, title, logoUrl, whatsapp, primaryColor, secondaryColor, accentColor, format }: Props) {
  const isStory = format === "story";
  const w = 1080;
  const h = isStory ? 1920 : 1080;

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: "100%",
        aspectRatio: `${w}/${h}`,
        background: "#fafafa",
        color: "#111",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div className="flex flex-col h-full p-[6%]">
        {/* Header */}
        <div className="flex items-center justify-between mb-[5%]">
          <div>
            <h1 className="font-black uppercase" style={{ fontSize: isStory ? "2.2em" : "1.8em", color: primaryColor, letterSpacing: "-0.02em" }}>
              {title}
            </h1>
            <p className="text-sm" style={{ color: "#666" }}>
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          {logoUrl && <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain" crossOrigin="anonymous" />}
        </div>

        <div className="w-full h-[2px] mb-[4%]" style={{ background: primaryColor }} />

        {/* Matches */}
        <div className="flex-1 flex flex-col">
          {matches.map((m, i) => (
            <div key={m.id}>
              <div className="py-[3%] flex items-center gap-[4%]">
                {/* Time */}
                <div className="shrink-0 w-[12%]">
                  <span className="font-black text-[1em]" style={{ color: accentColor }}>
                    {formatTime(m.date)}
                  </span>
                </div>

                {/* Match */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <img src={m.home.logo} alt="" className="h-6 w-6 object-contain" crossOrigin="anonymous" />
                    <span className="text-[0.75em] font-bold">{m.home.name}</span>
                    <span className="text-[0.6em] font-black mx-1" style={{ color: "#999" }}>×</span>
                    <span className="text-[0.75em] font-bold">{m.away.name}</span>
                    <img src={m.away.logo} alt="" className="h-6 w-6 object-contain" crossOrigin="anonymous" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[0.5em] uppercase tracking-widest" style={{ color: "#999" }}>{m.league.name}</span>
                    {m.channels && m.channels.length > 0 && (
                      <div className="flex gap-1">
                        {m.channels.map((ch) => (
                          <span key={ch} className="text-[0.4em] px-1 py-0.5 rounded font-bold" style={{ background: primaryColor, color: "#fff" }}>
                            {CHANNEL_NAMES[ch] || ch}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {i < matches.length - 1 && <div className="h-px" style={{ background: "#e5e5e5" }} />}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-[3%] pt-[3%] flex items-center justify-between" style={{ borderTop: `2px solid ${primaryColor}` }}>
          {logoUrl && <img src={logoUrl} alt="" className="h-8 w-auto object-contain" crossOrigin="anonymous" />}
          {whatsapp && (
            <span className="text-[0.7em] font-bold" style={{ color: primaryColor }}>📱 {whatsapp}</span>
          )}
        </div>
      </div>
    </div>
  );
}
