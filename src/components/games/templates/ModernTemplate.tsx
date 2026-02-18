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
        <div className="flex items-center justify-between mb-[4%]">
          <div>
            <h1 className="font-black uppercase tracking-wider" style={{ fontSize: isStory ? "1.8em" : "1.5em", color: accentColor }}>{title}</h1>
            <p className="text-sm opacity-70 mt-0.5">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          {logoUrl && <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain" />}
        </div>

        <div className="flex-1 grid gap-[2%]" style={{ gridTemplateColumns: "1fr 1fr", gridTemplateRows: `repeat(${Math.ceil(matches.length / 2)}, 1fr)` }}>
          {matches.map((m) => (
            <div key={m.id} className="rounded-xl p-[6%] flex flex-col justify-center" style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <p className="text-[0.6em] uppercase tracking-widest opacity-60 mb-[4%] truncate">{m.league.name}</p>
              <div className="flex items-center justify-between gap-[4%]">
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <img src={m.home.logo} alt="" className="object-contain mb-1" style={{ width: "2.5em", height: "2.5em", maxWidth: "40px", maxHeight: "40px" }} />
                  <span className="text-[0.55em] font-bold text-center truncate w-full">{m.home.name}</span>
                </div>
                <div className="text-center shrink-0 flex flex-col items-center gap-1">
                  <span className="font-black text-[0.9em]" style={{ color: accentColor }}>{formatTime(m.date)}</span>
                  {m.channels && m.channels.length > 0 && (
                    <div className="flex gap-1 items-center justify-center flex-wrap">
                      {m.channels.map((ch) => {
                        const info = CHANNEL_MAP[ch];
                        return info ? (
                          <img key={ch} src={info.logo} alt={info.name} title={info.name} className="object-contain" style={{ height: "0.9em", maxHeight: "14px", width: "auto", filter: "brightness(0) invert(1)", opacity: 0.85 }} />
                        ) : (
                          <span key={ch} className="text-[0.35em] px-1 py-0.5 rounded-full font-bold" style={{ background: accentColor, color: primaryColor }}>{ch}</span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <img src={m.away.logo} alt="" className="object-contain mb-1" style={{ width: "2.5em", height: "2.5em", maxWidth: "40px", maxHeight: "40px" }} />
                  <span className="text-[0.55em] font-bold text-center truncate w-full">{m.away.name}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

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
