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

  const mc = matches.length;
  const teamLogoSize = mc <= 4 ? "2.4em" : mc <= 6 ? "2em" : mc <= 8 ? "1.7em" : "1.4em";
  const timeFontSize = mc <= 4 ? "1.3em" : mc <= 6 ? "1.1em" : mc <= 8 ? "0.9em" : "0.75em";
  const namesFontSize = mc <= 4 ? "0.5em" : mc <= 6 ? "0.44em" : mc <= 8 ? "0.38em" : "0.32em";
  const channelHeight = mc <= 4 ? "0.7em" : mc <= 6 ? "0.6em" : mc <= 8 ? "0.5em" : "0.4em";
  const leagueSize = mc <= 4 ? "2.4em" : mc <= 6 ? "2em" : mc <= 8 ? "1.7em" : "1.4em";
  const rowPad = mc <= 4 ? "2%" : mc <= 6 ? "1.5%" : mc <= 8 ? "1%" : "0.7%";
  const gapSize = mc <= 4 ? "1.2%" : mc <= 6 ? "1%" : mc <= 8 ? "0.7%" : "0.5%";

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: "100%",
        aspectRatio: `${w}/${h}`,
        background: "#f0f2f5",
        color: "#1a1a1a",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      <div className="relative z-10 flex h-full">
        {/* Left column - Player / Branding (38%) */}
        <div className="relative" style={{ width: "38%", overflow: "hidden" }}>
          <div className="absolute inset-0 z-10" style={{
            background: "linear-gradient(to right, transparent 50%, #f0f2f5 100%)",
          }} />
          <div className="absolute inset-0 z-10" style={{
            background: "linear-gradient(to top, #f0f2f5 0%, transparent 15%)",
          }} />

          {backgroundUrl ? (
            <img
              src={backgroundUrl}
              alt=""
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: "cover", objectPosition: "top center" }}
            />
          ) : (
            <div className="absolute inset-0" style={{
              background: `linear-gradient(135deg, ${primaryColor}20, ${primaryColor}08)`,
            }} />
          )}

          {logoUrl && (
            <>
              <img src={logoUrl} alt="" className="absolute z-20 object-contain" style={{ top: "3%", left: "5%", height: "2.5em", width: "auto", opacity: 0.8 }} />
            </>
          )}

          {logoUrl && (
            <div className="absolute z-20 flex items-center" style={{ bottom: "4%", left: "5%" }}>
              <img src={logoUrl} alt="" className="object-contain" style={{ height: "3em", width: "auto" }} />
            </div>
          )}
        </div>

        {/* Right column - Matches (62%) */}
        <div className="flex flex-col" style={{ width: "62%", padding: "3% 3% 2% 1%" }}>
          {/* Header */}
          <div className="flex items-center justify-center" style={{ marginBottom: "3%", gap: "3%" }}>
            <h1 className="font-black uppercase text-right" style={{ fontSize: "2.2em", color: primaryColor, letterSpacing: "0.02em", lineHeight: 1.05 }}>
              {title || "JOGOS DO DIA"}
            </h1>
            <div className="flex flex-col items-center rounded-lg" style={{ background: primaryColor, color: "#fff", padding: "3% 5%", minWidth: "2.5em" }}>
              <span className="font-black" style={{ fontSize: "1.8em", lineHeight: 1 }}>{day}</span>
              <span className="font-bold uppercase" style={{ fontSize: "0.4em" }}>DE {month}</span>
            </div>
          </div>

          <div className="mx-auto h-[2px]" style={{ background: primaryColor, width: "90%", marginBottom: "2%" }} />

          {/* Match cards */}
          <div className="flex-1 flex flex-col justify-center overflow-hidden" style={{ gap: gapSize }}>
            {matches.map((m, i) => (
              <div
                key={m.id}
                className="flex items-center rounded-lg"
                style={{
                  background: i % 2 === 0 ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.02)",
                  padding: `${rowPad} 2.5%`,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                }}
              >
                {/* League logo */}
                <div className="shrink-0 flex items-center justify-center" style={{ width: leagueSize, marginRight: "2%" }}>
                  <img src={m.league.logo} alt={m.league.name} className="object-contain" style={{ width: "100%", height: leagueSize }} />
                </div>

                {/* Time */}
                <div className="shrink-0 text-center" style={{ minWidth: "3em", marginRight: "2%" }}>
                  <span className="font-black" style={{ fontSize: timeFontSize, color: accentColor }}>{formatTime(m.date)}</span>
                </div>

                {/* Home logo */}
                <div className="shrink-0 flex items-center justify-center" style={{ width: teamLogoSize, height: teamLogoSize }}>
                  <img src={m.home.logo} alt={m.home.name} className="object-contain" style={{ maxWidth: "100%", maxHeight: "100%" }} />
                </div>

                <span className="font-black shrink-0" style={{ fontSize: "0.7em", color: "#bbb", margin: "0 1.5%" }}>x</span>

                {/* Away logo */}
                <div className="shrink-0 flex items-center justify-center" style={{ width: teamLogoSize, height: teamLogoSize }}>
                  <img src={m.away.logo} alt={m.away.name} className="object-contain" style={{ maxWidth: "100%", maxHeight: "100%" }} />
                </div>

                {/* Names + Channels */}
                <div className="flex-1 min-w-0" style={{ marginLeft: "2.5%" }}>
                  <div className="font-bold leading-tight" style={{ fontSize: namesFontSize }}>
                    {m.home.name}<br />x {m.away.name}
                  </div>
                  {m.channels && m.channels.length > 0 && (
                    <div className="flex items-center flex-wrap" style={{ gap: "4px", marginTop: "2px" }}>
                      {m.channels.slice(0, 3).map((ch) => {
                        const info = CHANNEL_MAP[ch];
                        return info ? (
                          <img key={ch} src={info.logo} alt={info.name} title={info.name} className="object-contain" style={{ height: channelHeight, width: "auto" }} />
                        ) : (
                          <span key={ch} className="font-bold" style={{ fontSize: "0.3em", background: "rgba(0,0,0,0.08)", padding: "1px 4px", borderRadius: "3px" }}>{ch}</span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="text-center" style={{ marginTop: "2.5%", paddingTop: "2%", borderTop: `2px solid ${primaryColor}` }}>
            {whatsapp && (
              <div className="font-black" style={{ fontSize: "1.2em", color: primaryColor, marginTop: "1%" }}>
                📱 {whatsapp}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
