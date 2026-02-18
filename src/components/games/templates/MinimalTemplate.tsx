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

export function MinimalTemplate({ matches, title, logoUrl, whatsapp, primaryColor, secondaryColor, accentColor, format, backgroundUrl }: Props) {
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
      {backgroundUrl && (
        <div className="absolute inset-0" style={{ backgroundImage: `url(${backgroundUrl})`, backgroundSize: "100% 100%", backgroundPosition: "center" }} />
      )}
      <div className="relative z-10 flex flex-col h-full p-[6%]">
        {/* Header */}
        <div className="flex items-center justify-between mb-[4%]">
          <div>
            <h1 className="font-black uppercase" style={{ fontSize: isStory ? "2.2em" : "1.8em", color: primaryColor, letterSpacing: "-0.02em" }}>{title}</h1>
            <p className="text-sm" style={{ color: "#666" }}>{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          {logoUrl && <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain" />}
        </div>

        <div className="w-full h-[2px] mb-[3%]" style={{ background: primaryColor }} />

        {/* Matches List */}
        <div className="flex-1 flex flex-col">
          {matches.map((m, i) => (
            <div key={m.id}>
              <div className="py-[2.5%] flex items-center gap-[3%]">
                {/* Time */}
                <div className="shrink-0 w-[10%] text-center">
                  <span className="font-black text-[0.9em]" style={{ color: accentColor }}>{formatTime(m.date)}</span>
                </div>

                {/* Match info */}
                <div className="flex-1 flex items-center gap-[2%]">
                  <div className="flex items-center justify-center shrink-0" style={{ width: "1.5em", height: "1.5em" }}>
                    <img src={m.home.logo} alt="" className="object-contain" style={{ maxWidth: "100%", maxHeight: "100%" }} />
                  </div>
                  <span className="text-[0.65em] font-bold truncate">{m.home.name}</span>
                  <span className="text-[0.55em] font-black mx-0.5" style={{ color: "#bbb" }}>×</span>
                  <span className="text-[0.65em] font-bold truncate">{m.away.name}</span>
                  <div className="flex items-center justify-center shrink-0" style={{ width: "1.5em", height: "1.5em" }}>
                    <img src={m.away.logo} alt="" className="object-contain" style={{ maxWidth: "100%", maxHeight: "100%" }} />
                  </div>
                </div>

                {/* League + channels */}
                <div className="shrink-0 text-right flex flex-col items-end gap-0.5">
                  <span className="text-[0.4em] uppercase tracking-widest" style={{ color: "#999" }}>{m.league.name}</span>
                  {m.channels && m.channels.length > 0 && (
                    <div className="flex gap-1 items-center">
                      {m.channels.slice(0, 2).map((ch) => {
                        const info = CHANNEL_MAP[ch];
                        return info ? (
                          <img key={ch} src={info.logo} alt={info.name} title={info.name} className="object-contain" style={{ height: "0.6em", width: "auto", opacity: 0.5 }} />
                        ) : (
                          <span key={ch} className="text-[0.3em] px-1 py-0.5 rounded font-medium" style={{ background: primaryColor, color: "#fff" }}>{ch}</span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              {i < matches.length - 1 && <div className="h-px" style={{ background: "#e5e5e5" }} />}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-[3%] pt-[3%] flex items-center justify-between" style={{ borderTop: `2px solid ${primaryColor}` }}>
          {logoUrl && <img src={logoUrl} alt="" className="h-8 w-auto object-contain" />}
          {whatsapp && <span className="text-[0.7em] font-bold" style={{ color: primaryColor }}>📱 {whatsapp}</span>}
        </div>
      </div>
    </div>
  );
}
