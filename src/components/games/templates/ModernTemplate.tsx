import { Match } from "../MatchSelectionGrid";
import { CHANNEL_MAP } from "../channelLogos";

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
      {backgroundUrl && (
        <div className="absolute inset-0" style={{ backgroundImage: `url(${backgroundUrl})`, backgroundSize: "100% 100%", backgroundPosition: "center" }} />
      )}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)", backgroundSize: "30px 30px" }} />

      <div className="relative z-10 flex flex-col h-full p-[5%]">
        {/* Header */}
        <div className="flex items-center justify-between mb-[3%]">
          <div>
            <h1 className="font-black uppercase tracking-wider" style={{ fontSize: isStory ? "1.8em" : "1.5em", color: accentColor }}>{title}</h1>
            <p className="text-sm opacity-70 mt-0.5">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          {logoUrl && <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain" />}
        </div>

        {/* Matches Grid */}
        <div className="flex-1 grid gap-[2%]" style={{ gridTemplateColumns: "1fr 1fr", gridTemplateRows: `repeat(${Math.ceil(matches.length / 2)}, 1fr)` }}>
          {matches.map((m) => (
            <div key={m.id} className="rounded-xl flex flex-col justify-center" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)", padding: "5% 4%" }}>
              {/* League */}
              <p className="text-[0.5em] uppercase tracking-widest opacity-50 mb-[3%] truncate text-center">{m.league.name}</p>

              {/* Teams row */}
              <div className="flex items-center justify-between gap-[2%]">
                {/* Home */}
                <div className="flex flex-col items-center flex-1 min-w-0 gap-[2px]">
                  <div className="flex items-center justify-center" style={{ width: "2.2em", height: "2.2em" }}>
                    <img src={m.home.logo} alt="" className="object-contain" style={{ maxWidth: "100%", maxHeight: "100%" }} />
                  </div>
                  <span className="text-[0.5em] font-semibold text-center truncate w-full leading-tight">{m.home.name}</span>
                </div>

                {/* Center: time */}
                <div className="text-center shrink-0 px-1">
                  <span className="font-black text-[0.85em] block" style={{ color: accentColor }}>{formatTime(m.date)}</span>
                </div>

                {/* Away */}
                <div className="flex flex-col items-center flex-1 min-w-0 gap-[2px]">
                  <div className="flex items-center justify-center" style={{ width: "2.2em", height: "2.2em" }}>
                    <img src={m.away.logo} alt="" className="object-contain" style={{ maxWidth: "100%", maxHeight: "100%" }} />
                  </div>
                  <span className="text-[0.5em] font-semibold text-center truncate w-full leading-tight">{m.away.name}</span>
                </div>
              </div>

              {/* Channels - small, inline, below teams */}
              {m.channels && m.channels.length > 0 && (
                <div className="flex gap-1 items-center justify-center mt-[4%] opacity-70">
                  {m.channels.slice(0, 3).map((ch) => {
                    const info = CHANNEL_MAP[ch];
                    return info ? (
                      <img key={ch} src={info.logo} alt={info.name} title={info.name} className="object-contain" style={{ height: "0.7em", width: "auto", filter: "brightness(0) invert(1)", opacity: 0.6 }} />
                    ) : (
                      <span key={ch} className="text-[0.3em] px-1 py-0.5 rounded font-medium" style={{ background: "rgba(255,255,255,0.15)" }}>{ch}</span>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-[3%] flex items-center justify-between pt-[2%]" style={{ borderTop: `1px solid rgba(255,255,255,0.15)` }}>
          {logoUrl && <img src={logoUrl} alt="" className="h-8 w-auto object-contain" />}
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
