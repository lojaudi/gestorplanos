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

function formatDay() {
  const now = new Date();
  const day = now.getDate().toString().padStart(2, "0");
  const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  return { day, month: months[now.getMonth()] };
}

export function ModernTemplate({ matches, title, logoUrl, whatsapp, primaryColor, secondaryColor, accentColor, format, backgroundUrl }: Props) {
  const isStory = format === "story";
  const w = 1080;
  const h = isStory ? 1920 : 1080;
  const { day, month } = formatDay();

  const matchCount = matches.length;
  const logoSize = matchCount <= 4 ? "2.8em" : matchCount <= 6 ? "2.2em" : "1.8em";
  const fontSize = matchCount <= 4 ? "0.75em" : matchCount <= 6 ? "0.6em" : "0.5em";
  const timeFontSize = matchCount <= 4 ? "1em" : matchCount <= 6 ? "0.85em" : "0.7em";
  const channelHeight = matchCount <= 4 ? "1.1em" : matchCount <= 6 ? "0.9em" : "0.7em";
  const cols = isStory ? 1 : (matchCount <= 4 ? 2 : matchCount <= 6 ? 2 : 2);
  const useGrid = !isStory && matchCount > 1;

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: "100%",
        aspectRatio: `${w}/${h}`,
        background: `linear-gradient(135deg, ${primaryColor}, #0a0a1a)`,
        color: "#fff",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      {backgroundUrl && (
        <div className="absolute inset-0" style={{ backgroundImage: `url(${backgroundUrl})`, backgroundSize: "100% 100%", backgroundPosition: "center" }} />
      )}
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at top right, rgba(255,255,255,0.05) 0%, transparent 60%)",
      }} />

      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-[5%] pt-[4%] pb-[2%]">
          {logoUrl && <img src={logoUrl} alt="Logo" className="object-contain" style={{ height: "2.8em", width: "auto" }} />}
          <div className="flex items-center gap-[2%]">
            <h1 className="font-black uppercase" style={{ fontSize: isStory ? "1.8em" : "1.4em", letterSpacing: "0.03em" }}>
              <span style={{ color: accentColor }}>JOGOS</span>{" "}
              <span>DO DIA</span>
            </h1>
            <div className="flex flex-col items-center rounded-md px-[1.2%] py-[0.4%]" style={{ background: accentColor, color: "#fff" }}>
              <span className="font-black" style={{ fontSize: "1.3em", lineHeight: 1.1 }}>{day}</span>
              <span className="font-semibold uppercase" style={{ fontSize: "0.4em" }}>{month}</span>
            </div>
          </div>
        </div>

        {/* Matches */}
        <div className="flex-1 px-[4%] flex flex-col justify-center">
          {useGrid ? (
            <div className="grid gap-[2%]" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {matches.map((m) => (
                <MatchCard key={m.id} m={m} logoSize={logoSize} fontSize={fontSize} timeFontSize={timeFontSize} channelHeight={channelHeight} accentColor={accentColor} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-[1.5%]">
              {matches.map((m) => (
                <MatchRow key={m.id} m={m} logoSize={logoSize} fontSize={fontSize} timeFontSize={timeFontSize} channelHeight={channelHeight} accentColor={accentColor} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-[5%] pb-[3%] pt-[2%] flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          {logoUrl && <img src={logoUrl} alt="" className="object-contain" style={{ height: "2em", width: "auto" }} />}
          {whatsapp && <span className="font-bold" style={{ fontSize: "0.7em", color: accentColor }}>📱 {whatsapp}</span>}
        </div>
      </div>
    </div>
  );
}

function MatchCard({ m, logoSize, fontSize, timeFontSize, channelHeight, accentColor }: { m: Match; logoSize: string; fontSize: string; timeFontSize: string; channelHeight: string; accentColor: string }) {
  return (
    <div className="rounded-xl flex flex-col items-center justify-center" style={{
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.08)",
      padding: "4% 3%",
    }}>
      <p className="uppercase tracking-widest opacity-50 truncate text-center" style={{ fontSize: "0.4em", marginBottom: "3%" }}>{m.league.name}</p>
      <div className="flex items-center justify-center gap-[6%] w-full">
        <div className="flex flex-col items-center gap-[3px] flex-1 min-w-0">
          <div className="flex items-center justify-center" style={{ width: logoSize, height: logoSize }}>
            <img src={m.home.logo} alt="" className="object-contain" style={{ maxWidth: "100%", maxHeight: "100%" }} />
          </div>
          <span className="font-semibold text-center truncate w-full" style={{ fontSize: "0.45em" }}>{m.home.name}</span>
        </div>
        <div className="text-center shrink-0">
          <span className="font-black" style={{ fontSize: timeFontSize, color: accentColor }}>{formatTime(m.date)}</span>
        </div>
        <div className="flex flex-col items-center gap-[3px] flex-1 min-w-0">
          <div className="flex items-center justify-center" style={{ width: logoSize, height: logoSize }}>
            <img src={m.away.logo} alt="" className="object-contain" style={{ maxWidth: "100%", maxHeight: "100%" }} />
          </div>
          <span className="font-semibold text-center truncate w-full" style={{ fontSize: "0.45em" }}>{m.away.name}</span>
        </div>
      </div>
      {m.channels && m.channels.length > 0 && (
        <div className="flex gap-[4px] items-center justify-center mt-[4%]">
          {m.channels.slice(0, 3).map((ch) => {
            const info = CHANNEL_MAP[ch];
            return info ? (
              <img key={ch} src={info.logo} alt={info.name} title={info.name} className="object-contain" style={{ height: channelHeight, width: "auto" }} />
            ) : (
              <span key={ch} className="font-medium" style={{ fontSize: "0.3em", background: "rgba(255,255,255,0.15)", padding: "1px 4px", borderRadius: "3px" }}>{ch}</span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MatchRow({ m, logoSize, fontSize, timeFontSize, channelHeight, accentColor }: { m: Match; logoSize: string; fontSize: string; timeFontSize: string; channelHeight: string; accentColor: string }) {
  return (
    <div className="flex items-center rounded-xl" style={{
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.08)",
      padding: "2.5% 3%",
    }}>
      <div className="shrink-0 flex items-center justify-center" style={{ width: "2.5em", marginRight: "2%" }}>
        <img src={m.league.logo} alt={m.league.name} className="object-contain" style={{ maxWidth: "2em", maxHeight: "2em" }} />
      </div>
      <div className="shrink-0 text-center" style={{ width: "3.5em", marginRight: "2%" }}>
        <span className="font-black" style={{ fontSize: timeFontSize, color: accentColor }}>{formatTime(m.date)}</span>
      </div>
      <div className="shrink-0 flex items-center justify-center" style={{ width: logoSize, height: logoSize }}>
        <img src={m.home.logo} alt="" className="object-contain" style={{ maxWidth: "100%", maxHeight: "100%" }} />
      </div>
      <span className="font-black shrink-0 mx-[1.5%]" style={{ fontSize, color: "rgba(255,255,255,0.4)" }}>x</span>
      <div className="shrink-0 flex items-center justify-center" style={{ width: logoSize, height: logoSize }}>
        <img src={m.away.logo} alt="" className="object-contain" style={{ maxWidth: "100%", maxHeight: "100%" }} />
      </div>
      <div className="flex-1 min-w-0 ml-[2%] flex flex-col justify-center">
        <span className="font-bold truncate" style={{ fontSize, lineHeight: 1.3 }}>{m.home.name} x {m.away.name}</span>
        {m.channels && m.channels.length > 0 && (
          <div className="flex gap-[4px] items-center mt-[2px]">
            {m.channels.slice(0, 3).map((ch) => {
              const info = CHANNEL_MAP[ch];
              return info ? (
                <img key={ch} src={info.logo} alt={info.name} title={info.name} className="object-contain" style={{ height: channelHeight, width: "auto" }} />
              ) : (
                <span key={ch} className="font-medium" style={{ fontSize: "0.35em", background: "rgba(255,255,255,0.15)", padding: "1px 4px", borderRadius: "3px" }}>{ch}</span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
