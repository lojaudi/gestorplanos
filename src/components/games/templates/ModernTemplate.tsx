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

export function ModernTemplate({ matches, title, logoUrl, whatsapp, primaryColor, secondaryColor, accentColor, backgroundUrl }: Props) {
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
        background: `linear-gradient(180deg, ${primaryColor} 0%, ${secondaryColor} 50%, ${primaryColor}dd 100%)`,
        color: "#fff",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      {/* Stadium lights effect */}
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.12) 0%, transparent 60%)",
      }} />

      <div className="relative z-10 flex h-full">
        {/* Left column - Player / Branding (38%) */}
        <div className="relative" style={{ width: "38%", overflow: "hidden" }}>
          {/* Gradient overlay for blending */}
          <div className="absolute inset-0 z-10" style={{
            background: `linear-gradient(to right, transparent 60%, ${primaryColor} 100%)`,
          }} />
          <div className="absolute inset-0 z-10" style={{
            background: `linear-gradient(to top, ${primaryColor}dd 0%, transparent 20%)`,
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
              background: `linear-gradient(135deg, ${primaryColor}40, ${primaryColor}10)`,
            }} />
          )}

          {/* Logo watermarks on left */}
          {logoUrl && (
            <>
              <img src={logoUrl} alt="" className="absolute z-20 object-contain" style={{ top: "3%", left: "5%", height: "2.5em", width: "auto", opacity: 0.7 }} />
              <img src={logoUrl} alt="" className="absolute z-20 object-contain" style={{ top: "50%", left: "5%", height: "2em", width: "auto", opacity: 0.3 }} />
            </>
          )}

          {/* Bottom logo */}
          {logoUrl && (
            <div className="absolute z-20 flex items-center" style={{ bottom: "4%", left: "5%" }}>
              <img src={logoUrl} alt="" className="object-contain" style={{ height: "3em", width: "auto" }} />
            </div>
          )}
        </div>

        {/* Right column - Matches (62%) */}
        <div className="flex flex-col" style={{ width: "62%", padding: "3% 3% 2% 1%" }}>
          {/* Header - Title + Date */}
          <div className="flex items-center justify-center" style={{ marginBottom: "3%", gap: "3%" }}>
            <h1 className="font-black uppercase text-right" style={{ fontSize: "2.2em", letterSpacing: "0.04em", lineHeight: 1.05 }}>
              <span style={{ color: accentColor }}>{title || "JOGOS DO DIA"}</span>
            </h1>
            <div className="flex flex-col items-center rounded-lg" style={{ background: accentColor, padding: "3% 5%", minWidth: "2.5em" }}>
              <span className="font-black" style={{ fontSize: "1.8em", lineHeight: 1 }}>{day}</span>
              <span className="font-bold uppercase" style={{ fontSize: "0.4em" }}>DE {month}</span>
            </div>
          </div>

          {/* Match cards */}
          <div className="flex-1 flex flex-col justify-center overflow-hidden" style={{ gap: gapSize }}>
            {matches.map((m) => (
              <div
                key={m.id}
                className="flex items-center rounded-lg"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  backdropFilter: "blur(4px)",
                  padding: `${rowPad} 2.5%`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                }}
              >
                {/* League logo */}
                <div className="shrink-0 flex flex-col items-center justify-center" style={{ width: leagueSize, marginRight: "2%" }}>
                  <img src={m.league.logo} alt={m.league.name} className="object-contain" style={{ width: "100%", height: leagueSize }} />
                </div>

                {/* Time */}
                <div className="shrink-0 text-center" style={{ minWidth: "3em", marginRight: "2%" }}>
                  <span className="font-black" style={{ fontSize: timeFontSize }}>{formatTime(m.date)}</span>
                </div>

                {/* Home logo */}
                <div className="shrink-0 flex items-center justify-center" style={{ width: teamLogoSize, height: teamLogoSize }}>
                  <img src={m.home.logo} alt={m.home.name} className="object-contain" style={{ maxWidth: "100%", maxHeight: "100%" }} />
                </div>

                {/* X */}
                <span className="font-black shrink-0" style={{ fontSize: "0.7em", color: "rgba(255,255,255,0.4)", margin: "0 1.5%" }}>x</span>

                {/* Away logo */}
                <div className="shrink-0 flex items-center justify-center" style={{ width: teamLogoSize, height: teamLogoSize }}>
                  <img src={m.away.logo} alt={m.away.name} className="object-contain" style={{ maxWidth: "100%", maxHeight: "100%" }} />
                </div>

                {/* Names + Channels (right block) */}
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
                          <span key={ch} className="font-bold" style={{ fontSize: "0.3em", background: "rgba(255,255,255,0.15)", padding: "1px 4px", borderRadius: "3px" }}>{ch}</span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="text-center" style={{ marginTop: "2.5%", paddingTop: "2%" }}>
            <div className="inline-block rounded-full font-black uppercase" style={{ background: accentColor, padding: "0.4% 3%", fontSize: "0.7em", letterSpacing: "0.05em", marginBottom: "1%" }}>
              ASSINE JÁ!
            </div>
            {whatsapp && (
              <div className="font-black" style={{ fontSize: "1.2em", color: accentColor, marginTop: "1%" }}>
                📱 {whatsapp}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
