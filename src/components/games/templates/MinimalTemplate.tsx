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
  backgroundUrl?: string | null;
}

function formatTime(dateStr: string) {
  try { return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

function formatDay() {
  const now = new Date();
  const day = now.getDate().toString().padStart(2, "0");
  const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  return { day, month: months[now.getMonth()] };
}

export function MinimalTemplate({ matches, title, logoUrl, whatsapp, primaryColor, secondaryColor, accentColor, backgroundUrl }: Props) {
  const w = 1404;
  const h = 1600;
  const { day, month } = formatDay();

  const matchCount = matches.length;
  const logoSize = matchCount <= 4 ? "3em" : matchCount <= 6 ? "2.5em" : matchCount <= 8 ? "2em" : "1.6em";
  const nameSize = matchCount <= 4 ? "0.45em" : matchCount <= 6 ? "0.4em" : matchCount <= 8 ? "0.35em" : "0.3em";
  const fontSize = matchCount <= 4 ? "0.85em" : matchCount <= 6 ? "0.7em" : matchCount <= 8 ? "0.55em" : "0.48em";
  const timeFontSize = matchCount <= 4 ? "1.4em" : matchCount <= 6 ? "1.1em" : matchCount <= 8 ? "0.9em" : "0.75em";
  const channelHeight = matchCount <= 4 ? "0.85em" : matchCount <= 6 ? "0.7em" : matchCount <= 8 ? "0.55em" : "0.45em";
  const rowPad = matchCount <= 4 ? "2.5%" : matchCount <= 6 ? "1.8%" : matchCount <= 8 ? "1.2%" : "0.8%";
  const leagueSize = matchCount <= 4 ? "2.8em" : matchCount <= 6 ? "2.2em" : matchCount <= 8 ? "1.8em" : "1.5em";
  const gapSize = matchCount <= 4 ? "1.2%" : matchCount <= 6 ? "1%" : matchCount <= 8 ? "0.7%" : "0.5%";

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: "100%",
        aspectRatio: `${w}/${h}`,
        background: "#f8f8f8",
        color: "#1a1a1a",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      {backgroundUrl && (
        <div className="absolute inset-0" style={{ backgroundImage: `url(${backgroundUrl})`, backgroundSize: "100% 100%", backgroundPosition: "center" }} />
      )}

      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-[5%] pt-[4%] pb-[2%]">
          {logoUrl && <img src={logoUrl} alt="Logo" className="object-contain" style={{ height: "3em", width: "auto" }} />}
          <div className="flex items-center gap-[2%]">
            <h1 className="font-black uppercase" style={{ fontSize: "2em", color: primaryColor, letterSpacing: "0.02em", lineHeight: 1 }}>
              {title || "JOGOS DO DIA"}
            </h1>
            <div className="flex flex-col items-center rounded-md px-[1.5%] py-[0.5%]" style={{ background: primaryColor, color: "#fff" }}>
              <span className="font-black" style={{ fontSize: "1.5em", lineHeight: 1.1 }}>{day}</span>
              <span className="font-semibold uppercase" style={{ fontSize: "0.45em" }}>DE {month}</span>
            </div>
          </div>
        </div>

        <div className="w-[90%] mx-auto h-[2px]" style={{ background: primaryColor }} />

        {/* Matches */}
        <div className="flex-1 flex flex-col justify-center px-[4%] overflow-hidden" style={{ gap: gapSize }}>
          {matches.map((m, i) => (
            <div
              key={m.id}
              className="flex items-center rounded-xl"
              style={{
                background: i % 2 === 0 ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.02)",
                padding: `${rowPad} 3%`,
              }}
            >
              {/* League logo */}
              <div className="shrink-0 flex items-center justify-center" style={{ width: leagueSize, height: leagueSize, marginRight: "2%" }}>
                <img src={m.league.logo} alt={m.league.name} className="object-contain" style={{ maxWidth: "100%", maxHeight: "100%" }} />
              </div>

              {/* Time */}
              <div className="shrink-0 text-center" style={{ width: "3.8em", marginRight: "2%" }}>
                <span className="font-black" style={{ fontSize: timeFontSize, color: accentColor }}>{formatTime(m.date)}</span>
              </div>

              {/* Home team */}
              <div className="shrink-0 flex flex-col items-center" style={{ width: logoSize }}>
                <div className="flex items-center justify-center" style={{ width: logoSize, height: logoSize }}>
                  <img src={m.home.logo} alt={m.home.name} className="object-contain" style={{ maxWidth: "100%", maxHeight: "100%" }} />
                </div>
                <span className="font-bold text-center leading-tight mt-[2px] w-full truncate" style={{ fontSize: nameSize }}>{m.home.name}</span>
              </div>

              {/* X */}
              <span className="font-black shrink-0 mx-[1.5%]" style={{ fontSize: "0.9em", color: "#bbb" }}>x</span>

              {/* Away team */}
              <div className="shrink-0 flex flex-col items-center" style={{ width: logoSize }}>
                <div className="flex items-center justify-center" style={{ width: logoSize, height: logoSize }}>
                  <img src={m.away.logo} alt={m.away.name} className="object-contain" style={{ maxWidth: "100%", maxHeight: "100%" }} />
                </div>
                <span className="font-bold text-center leading-tight mt-[2px] w-full truncate" style={{ fontSize: nameSize }}>{m.away.name}</span>
              </div>

              {/* Channels */}
              {m.channels && m.channels.length > 0 && (
                <div className="flex-1 min-w-0 ml-[2%] flex items-center gap-[6px] flex-wrap">
                  {m.channels.slice(0, 3).map((ch) => {
                    const info = CHANNEL_MAP[ch];
                    return info ? (
                      <img key={ch} src={info.logo} alt={info.name} title={info.name} className="object-contain" style={{ height: channelHeight, width: "auto" }} />
                    ) : (
                      <span key={ch} className="font-bold" style={{ fontSize: "0.4em", background: "rgba(0,0,0,0.08)", padding: "2px 6px", borderRadius: "4px" }}>{ch}</span>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-[5%] pb-[3%] pt-[2%] flex items-center justify-between" style={{ borderTop: `2px solid ${primaryColor}` }}>
          {logoUrl && <img src={logoUrl} alt="" className="object-contain" style={{ height: "2.2em", width: "auto" }} />}
          {whatsapp && <span className="font-black" style={{ fontSize: "1.3em", color: primaryColor }}>📱 {whatsapp}</span>}
        </div>
      </div>
    </div>
  );
}
