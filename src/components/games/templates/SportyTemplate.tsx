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

export function SportyTemplate({ matches, title, logoUrl, whatsapp, primaryColor, secondaryColor, accentColor, format, backgroundUrl }: Props) {
  const isStory = format === "story";
  const w = 1080;
  const h = isStory ? 1920 : 1080;

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: "100%",
        aspectRatio: `${w}/${h}`,
        background: `linear-gradient(180deg, #1a1a2e 0%, ${primaryColor} 100%)`,
        color: secondaryColor,
        fontFamily: "Inter, sans-serif",
      }}
    >
      {backgroundUrl && (
        <div className="absolute inset-0" style={{ backgroundImage: `url(${backgroundUrl})`, backgroundSize: "100% 100%", backgroundPosition: "center" }} />
      )}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.1) 20px, rgba(255,255,255,0.1) 22px)`,
      }} />
      <div className="absolute top-0 left-0 right-0 h-2" style={{ background: accentColor }} />

      <div className="relative z-10 flex flex-col h-full p-[5%] pt-[6%]">
        <div className="flex items-center gap-3 mb-[4%]">
          {logoUrl && <img src={logoUrl} alt="Logo" className="h-14 w-auto object-contain" crossOrigin="anonymous" />}
          <div>
            <h1 className="font-black uppercase tracking-wider" style={{ fontSize: isStory ? "2em" : "1.6em", color: accentColor, textShadow: "2px 2px 8px rgba(0,0,0,0.5)" }}>{title}</h1>
            <p className="text-sm opacity-70">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-[2%]">
          {matches.map((m, i) => (
            <div key={m.id} className="rounded-xl p-[3%] flex items-center gap-[3%]" style={{
              background: i % 2 === 0 ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
              borderLeft: `4px solid ${accentColor}`,
            }}>
              <div className="shrink-0 text-center w-[15%]">
                <span className="font-black text-[0.9em]" style={{ color: accentColor }}>{formatTime(m.date)}</span>
                <p className="text-[0.45em] uppercase tracking-widest opacity-60 mt-0.5 truncate">{m.league.name}</p>
                {m.channels && m.channels.length > 0 && (
                  <div className="flex gap-1 mt-1 justify-center items-center flex-wrap">
                    {m.channels.slice(0, 3).map((ch) => {
                      const info = CHANNEL_MAP[ch];
                      return info ? (
                        <img key={ch} src={info.logo} alt={info.name} title={info.name} className="object-contain" style={{ height: "0.85em", maxHeight: "13px", width: "auto", filter: "brightness(0) invert(1)", opacity: 0.85 }} crossOrigin="anonymous" />
                      ) : (
                        <span key={ch} className="text-[0.35em] px-1 py-0.5 rounded font-bold" style={{ background: "rgba(255,255,255,0.15)" }}>{ch}</span>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex-1 flex items-center gap-[3%]">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <img src={m.home.logo} alt="" className="object-contain shrink-0" style={{ width: "2em", height: "2em", maxWidth: "32px", maxHeight: "32px" }} crossOrigin="anonymous" />
                  <span className="text-[0.65em] font-bold truncate">{m.home.name}</span>
                </div>
                <span className="text-[0.6em] font-black opacity-40 shrink-0">VS</span>
                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  <span className="text-[0.65em] font-bold truncate text-right">{m.away.name}</span>
                  <img src={m.away.logo} alt="" className="object-contain shrink-0" style={{ width: "2em", height: "2em", maxWidth: "32px", maxHeight: "32px" }} crossOrigin="anonymous" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[3%] flex items-center justify-center gap-4 pt-[2%]" style={{ borderTop: `2px solid ${accentColor}` }}>
          {logoUrl && <img src={logoUrl} alt="" className="h-8 w-auto object-contain" crossOrigin="anonymous" />}
          {whatsapp && <span className="text-[0.75em] font-bold">📱 {whatsapp}</span>}
        </div>
      </div>
    </div>
  );
}
