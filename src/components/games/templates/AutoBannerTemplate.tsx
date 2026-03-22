import { Match } from "../MatchSelectionGrid";
import { CHANNEL_MAP } from "../channelLogos";

interface Props {
  matches: Match[];
  leagueName: string;
  leagueLogo: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundUrl?: string | null;
  logoUrl?: string | null;
  whatsapp?: string;
}

function formatTime(dateStr: string) {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return "";
  }
}

function formatDay() {
  const now = new Date();
  const day = now.getDate().toString().padStart(2, "0");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const weekDays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  return { day, month: months[now.getMonth()], weekDay: weekDays[now.getDay()] };
}

export function AutoBannerTemplate({
  matches,
  primaryColor,
  secondaryColor,
  accentColor,
  backgroundUrl,
  logoUrl,
  whatsapp,
}: Props) {
  const w = 1080;
  const h = 1080;
  const { day, month, weekDay } = formatDay();
  const mc = matches.length;

  // Dynamic sizing based on match count
  const rowHeight = mc <= 3 ? 160 : mc <= 5 ? 130 : mc <= 6 ? 115 : 100;
  const teamLogoSize = mc <= 3 ? 70 : mc <= 5 ? 58 : mc <= 6 ? 50 : 42;
  const teamNameSize = mc <= 3 ? 13 : mc <= 5 ? 11 : mc <= 6 ? 10 : 9;
  const timeSize = mc <= 3 ? 22 : mc <= 5 ? 18 : mc <= 6 ? 16 : 14;
  const channelNameSize = mc <= 3 ? 13 : mc <= 5 ? 11 : mc <= 6 ? 10 : 9;
  const leagueLogoSize = mc <= 3 ? 50 : mc <= 5 ? 42 : mc <= 6 ? 36 : 30;
  const vsSize = mc <= 3 ? 20 : mc <= 5 ? 17 : mc <= 6 ? 15 : 13;
  const rowGap = mc <= 3 ? 14 : mc <= 5 ? 10 : mc <= 6 ? 8 : 6;

  const headerHeight = 100;
  const footerHeight = 80;
  const contentTop = headerHeight + 10;
  const contentBottom = h - footerHeight;
  const contentHeight = contentBottom - contentTop;

  return (
    <div
      style={{
        width: w,
        height: h,
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        background: `linear-gradient(160deg, ${primaryColor} 0%, ${primaryColor}dd 50%, ${secondaryColor || primaryColor}aa 100%)`,
        color: "#fff",
      }}
    >
      {/* Background decorative pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(135deg, transparent, transparent 60px, rgba(255,255,255,0.015) 60px, rgba(255,255,255,0.015) 120px)",
        }}
      />
      {/* Top-right decorative diagonal */}
      <div
        style={{
          position: "absolute",
          top: -200,
          right: -100,
          width: 600,
          height: 600,
          background: `linear-gradient(135deg, rgba(255,255,255,0.06), transparent)`,
          transform: "rotate(20deg)",
        }}
      />

      {/* Background player image (if set) */}
      {backgroundUrl && (
        <img
          src={backgroundUrl}
          alt=""
          crossOrigin="anonymous"
          style={{
            position: "absolute",
            left: -40,
            bottom: 0,
            height: "85%",
            objectFit: "contain",
            objectPosition: "left bottom",
            opacity: 0.5,
            zIndex: 0,
            filter: "brightness(0.7)",
          }}
        />
      )}

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        {/* ── HEADER ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: "20px 40px 10px",
            height: headerHeight,
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: "8px 28px",
              textAlign: "center",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              agenda de jogos
            </div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>
              {weekDay}, <span style={{ color: accentColor }}>{day}.{month}</span>
            </div>
          </div>
        </div>

        {/* ── MATCH ROWS ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: rowGap,
            padding: "0 30px",
          }}
        >
          {matches.map((m) => {
            const time = formatTime(m.date);
            const matchChannels = (m.channels || []).slice(0, 3);
            return (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "rgba(200,210,230,0.12)",
                  backdropFilter: "blur(6px)",
                  borderRadius: 14,
                  height: rowHeight,
                  padding: "0 12px",
                  border: "1px solid rgba(255,255,255,0.06)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Home team */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    width: "18%",
                    gap: 4,
                  }}
                >
                  <img
                    src={m.home.logo}
                    alt={m.home.name}
                    style={{ width: teamLogoSize, height: teamLogoSize, objectFit: "contain" }}
                    crossOrigin="anonymous"
                  />
                  <span
                    style={{
                      fontSize: teamNameSize,
                      fontWeight: 700,
                      textAlign: "center",
                      textTransform: "uppercase",
                      lineHeight: 1.1,
                      maxWidth: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.home.name}
                  </span>
                </div>

                {/* VS badge */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "8%",
                  }}
                >
                  <span
                    style={{
                      fontSize: vsSize,
                      fontWeight: 900,
                      color: accentColor,
                      fontStyle: "italic",
                      textShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    }}
                  >
                    VS
                  </span>
                </div>

                {/* Away team */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    width: "18%",
                    gap: 4,
                  }}
                >
                  <img
                    src={m.away.logo}
                    alt={m.away.name}
                    style={{ width: teamLogoSize, height: teamLogoSize, objectFit: "contain" }}
                    crossOrigin="anonymous"
                  />
                  <span
                    style={{
                      fontSize: teamNameSize,
                      fontWeight: 700,
                      textAlign: "center",
                      textTransform: "uppercase",
                      lineHeight: 1.1,
                      maxWidth: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.away.name}
                  </span>
                </div>

                {/* Time badge */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "14%",
                  }}
                >
                  <div
                    style={{
                      background: accentColor,
                      borderRadius: 8,
                      padding: "4px 14px",
                      fontSize: timeSize,
                      fontWeight: 900,
                      color: "#fff",
                      textShadow: "0 1px 4px rgba(0,0,0,0.3)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {time}
                  </div>
                </div>

                {/* Channel names */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "22%",
                    gap: 3,
                  }}
                >
                  {matchChannels.map((chId) => {
                    const info = CHANNEL_MAP[chId];
                    return (
                      <div
                        key={chId}
                        style={{
                          background: "rgba(255,255,255,0.15)",
                          borderRadius: 6,
                          padding: "2px 10px",
                          fontSize: channelNameSize,
                          fontWeight: 700,
                          color: "rgba(255,255,255,0.9)",
                          textAlign: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {info?.name || chId}
                      </div>
                    );
                  })}
                </div>

                {/* League logo */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "12%",
                  }}
                >
                  {m.league.logo && (
                    <div
                      style={{
                        background: "rgba(255,255,255,0.12)",
                        borderRadius: 10,
                        padding: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <img
                        src={m.league.logo}
                        alt={m.league.name}
                        style={{
                          width: leagueLogoSize,
                          height: leagueLogoSize,
                          objectFit: "contain",
                        }}
                        crossOrigin="anonymous"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── FOOTER ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 40px 20px",
            height: footerHeight,
            gap: 16,
          }}
        >
          <div
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "rgba(255,255,255,0.5)",
              lineHeight: 1.5,
            }}
          >
            os canais podem <span style={{ color: accentColor, fontWeight: 700 }}>mudar a programação</span> sem aviso prévio.
            <br />
            por isso, pedimos a <span style={{ fontWeight: 700 }}>compreensão de todos</span>.
          </div>
        </div>
      </div>
    </div>
  );
}
