import { Match } from "../MatchSelectionGrid";
import { CHANNEL_MAP } from "../channelLogos";

interface Props {
  matches: Match[];
  leagueName: string;
  leagueLogo: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

function formatTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDay() {
  const now = new Date();
  const day = now.getDate().toString().padStart(2, "0");
  const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const weekDays = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
  return { day, month: months[now.getMonth()], weekDay: weekDays[now.getDay()] };
}

export function AutoBannerTemplate({ matches, leagueName, leagueLogo, primaryColor, secondaryColor, accentColor }: Props) {
  const w = 1080;
  const h = 1080;
  const { day, month, weekDay } = formatDay();
  const mc = matches.length;

  const matchRowHeight = mc <= 2 ? 220 : mc <= 4 ? 160 : mc <= 6 ? 130 : 110;
  const teamLogoSize = mc <= 2 ? 90 : mc <= 4 ? 70 : mc <= 6 ? 55 : 45;
  const teamNameSize = mc <= 2 ? 16 : mc <= 4 ? 14 : mc <= 6 ? 12 : 11;
  const timeSize = mc <= 2 ? 22 : mc <= 4 ? 18 : mc <= 6 ? 16 : 14;
  const channelLogoH = mc <= 2 ? 22 : mc <= 4 ? 18 : mc <= 6 ? 15 : 13;

  return (
    <div
      style={{
        width: w,
        height: h,
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        background: `linear-gradient(145deg, ${primaryColor} 0%, ${primaryColor}ee 40%, ${secondaryColor}30 100%)`,
        color: "#fff",
      }}
    >
      {/* Background pattern */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(255,255,255,0.02) 40px, rgba(255,255,255,0.02) 80px)",
      }} />
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse at 50% -10%, rgba(255,255,255,0.15) 0%, transparent 50%)",
      }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%", padding: "40px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 15 }}>
          <img
            src={leagueLogo}
            alt={leagueName}
            style={{ width: 70, height: 70, objectFit: "contain" }}
            crossOrigin="anonymous"
          />
          <div style={{ textAlign: "center" }}>
            <h1 style={{
              fontSize: 28,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              lineHeight: 1.1,
              margin: 0,
            }}>
              {leagueName}
            </h1>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginTop: 6,
              background: accentColor,
              borderRadius: 6,
              padding: "4px 16px",
              fontSize: 14,
              fontWeight: 800,
            }}>
              <span>{weekDay}</span>
              <span>•</span>
              <span>{day} DE {month}</span>
            </div>
          </div>
          <img
            src={leagueLogo}
            alt=""
            style={{ width: 70, height: 70, objectFit: "contain", opacity: 0.5 }}
            crossOrigin="anonymous"
          />
        </div>

        <div style={{
          width: "100%",
          height: 3,
          background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
          marginBottom: 20,
        }} />

        {/* Matches */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: mc <= 4 ? 12 : 8 }}>
          {matches.map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(4px)",
                borderRadius: 12,
                padding: `${mc <= 4 ? 16 : 10}px 20px`,
                boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
                border: "1px solid rgba(255,255,255,0.08)",
                minHeight: matchRowHeight * 0.6,
              }}
            >
              {/* Home team */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "30%", gap: 6 }}>
                <img
                  src={m.home.logo}
                  alt={m.home.name}
                  style={{ width: teamLogoSize, height: teamLogoSize, objectFit: "contain" }}
                  crossOrigin="anonymous"
                />
                <span style={{
                  fontSize: teamNameSize,
                  fontWeight: 700,
                  textAlign: "center",
                  lineHeight: 1.2,
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {m.home.name}
                </span>
              </div>

              {/* Center - Time & Channels */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "40%", gap: 6 }}>
                <span style={{
                  fontSize: timeSize,
                  fontWeight: 900,
                  color: accentColor,
                  letterSpacing: "0.05em",
                }}>
                  {formatTime(m.date)}
                </span>
                <span style={{
                  fontSize: timeSize * 0.7,
                  fontWeight: 800,
                  color: "rgba(255,255,255,0.35)",
                }}>VS</span>

                {m.channels && m.channels.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                    {m.channels.slice(0, 3).map((ch) => {
                      const info = CHANNEL_MAP[ch];
                      return (
                        <div key={ch} style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          background: "rgba(255,255,255,0.12)",
                          borderRadius: 4,
                          padding: "2px 8px",
                        }}>
                          <span style={{ fontSize: channelLogoH * 0.7, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>
                            {info?.name || ch}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Away team */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "30%", gap: 6 }}>
                <img
                  src={m.away.logo}
                  alt={m.away.name}
                  style={{ width: teamLogoSize, height: teamLogoSize, objectFit: "contain" }}
                  crossOrigin="anonymous"
                />
                <span style={{
                  fontSize: teamNameSize,
                  fontWeight: 700,
                  textAlign: "center",
                  lineHeight: 1.2,
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {m.away.name}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          textAlign: "center",
          marginTop: 15,
          paddingTop: 12,
          borderTop: "1px solid rgba(255,255,255,0.1)",
        }}>
          <div style={{
            display: "inline-block",
            background: accentColor,
            borderRadius: 20,
            padding: "6px 24px",
            fontSize: 14,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}>
            ⚽ JOGOS DO DIA
          </div>
        </div>
      </div>
    </div>
  );
}
