import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// League IDs for api-football (api-sports.io)
const APIFOOTBALL_LEAGUES = [71, 72, 73, 13];

// Competition codes for football-data.org
const FOOTBALLDATA_COMPETITIONS = ["BSA", "BSB", "CLI", "CPB"];
// BSA = Brasileirão Série A, BSB = Série B, CLI = Libertadores, CPB = Copa do Brasil (if available)

// Simple in-memory cache
const cache: Record<string, { data: any; ts: number }> = {};
const CACHE_TTL = 15 * 60 * 1000;

function getCached(key: string) {
  const entry = cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key: string, data: any) {
  cache[key] = { data, ts: Date.now() };
}

// ── api-football (api-sports.io) ──
async function fetchFromApiFootball(apiKey: string, date: string, timezone: string) {
  const url = `https://v3.football.api-sports.io/fixtures?date=${date}&timezone=${encodeURIComponent(timezone)}`;
  const res = await fetch(url, { headers: { "x-apisports-key": apiKey } });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro na API-Football: ${res.status} – ${text}`);
  }

  const json = await res.json();

  if (json.errors && Object.keys(json.errors).length > 0) {
    const errMsg = Object.values(json.errors).join("; ");
    throw new Error(`API-Football erro: ${errMsg}`);
  }

  const allFixtures = json.response || [];
  const leagueIds = new Set(APIFOOTBALL_LEAGUES);
  const filtered = allFixtures.filter((f: any) => leagueIds.has(f.league.id));

  return filtered.map((fixture: any) => ({
    id: fixture.fixture.id,
    date: fixture.fixture.date,
    timestamp: fixture.fixture.timestamp,
    status: fixture.fixture.status.short,
    league: {
      id: fixture.league.id,
      name: fixture.league.name,
      country: fixture.league.country,
      logo: fixture.league.logo,
    },
    home: {
      id: fixture.teams.home.id,
      name: fixture.teams.home.name,
      logo: fixture.teams.home.logo,
    },
    away: {
      id: fixture.teams.away.id,
      name: fixture.teams.away.name,
      logo: fixture.teams.away.logo,
    },
    goals: {
      home: fixture.goals.home,
      away: fixture.goals.away,
    },
  }));
}

// ── football-data.org ──
async function fetchFromFootballData(apiKey: string, date: string) {
  const allMatches: any[] = [];

  for (const code of FOOTBALLDATA_COMPETITIONS) {
    try {
      const url = `https://api.football-data.org/v4/competitions/${code}/matches?dateFrom=${date}&dateTo=${date}`;
      const res = await fetch(url, { headers: { "X-Auth-Token": apiKey } });

      if (!res.ok) {
        // Might be a competition not in plan, skip gracefully
        console.log(`football-data.org ${code}: ${res.status}`);
        continue;
      }

      const json = await res.json();
      const matches = json.matches || [];
      allMatches.push(...matches.map((m: any) => ({ ...m, _comp: code })));
    } catch (err) {
      console.log(`football-data.org ${code} error:`, err);
    }
  }

  return allMatches.map((m: any) => ({
    id: m.id,
    date: m.utcDate,
    timestamp: Math.floor(new Date(m.utcDate).getTime() / 1000),
    status: mapFootballDataStatus(m.status),
    league: {
      id: m.competition?.id || 0,
      name: m.competition?.name || m._comp,
      country: m.area?.name || "Brazil",
      logo: m.competition?.emblem || "",
    },
    home: {
      id: m.homeTeam?.id || 0,
      name: m.homeTeam?.shortName || m.homeTeam?.name || "Home",
      logo: m.homeTeam?.crest || "",
    },
    away: {
      id: m.awayTeam?.id || 0,
      name: m.awayTeam?.shortName || m.awayTeam?.name || "Away",
      logo: m.awayTeam?.crest || "",
    },
    goals: {
      home: m.score?.fullTime?.home ?? null,
      away: m.score?.fullTime?.away ?? null,
    },
  }));
}

function mapFootballDataStatus(status: string): string {
  const map: Record<string, string> = {
    SCHEDULED: "NS",
    TIMED: "NS",
    IN_PLAY: "LIVE",
    PAUSED: "HT",
    FINISHED: "FT",
    POSTPONED: "PST",
    CANCELLED: "CANC",
    SUSPENDED: "SUSP",
  };
  return map[status] || status;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: settings } = await supabase
      .from("platform_settings")
      .select("football_api_key, football_api_key_secondary, football_api_provider, football_timezone")
      .limit(1)
      .maybeSingle();

    const provider = settings?.football_api_provider || "api-football";
    const timezone = settings?.football_timezone || "America/Sao_Paulo";

    // Pick the right API key based on provider
    let apiKey: string | null = null;
    if (provider === "football-data") {
      apiKey = (settings as any)?.football_api_key_secondary;
    } else {
      apiKey = settings?.football_api_key;
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: `API Key de futebol não configurada para o provedor: ${provider}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get-matches") {
      const date = params.date || new Date().toISOString().slice(0, 10);
      const cacheKey = `matches-${provider}-${date}-${timezone}`;
      const cached = getCached(cacheKey);
      if (cached) {
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let matches: any[];
      if (provider === "football-data") {
        matches = await fetchFromFootballData(apiKey, date);
      } else {
        matches = await fetchFromApiFootball(apiKey, date, timezone);
      }

      const result = { matches, date, timezone, provider };
      setCache(cacheKey, result);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-leagues") {
      const cacheKey = `leagues-${provider}`;
      const cached = getCached(cacheKey);
      if (cached) {
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let leagues: any[] = [];

      if (provider === "football-data") {
        // Return the fixed list for football-data.org
        for (const code of FOOTBALLDATA_COMPETITIONS) {
          try {
            const url = `https://api.football-data.org/v4/competitions/${code}`;
            const res = await fetch(url, { headers: { "X-Auth-Token": apiKey } });
            if (res.ok) {
              const json = await res.json();
              leagues.push({
                id: json.id,
                name: json.name,
                country: json.area?.name || "Brazil",
                logo: json.emblem || "",
              });
            }
          } catch { /* skip */ }
        }
      } else {
        const url = "https://v3.football.api-sports.io/leagues?current=true";
        const res = await fetch(url, { headers: { "x-apisports-key": apiKey } });
        if (res.ok) {
          const json = await res.json();
          leagues = (json.response || []).map((item: any) => ({
            id: item.league.id,
            name: item.league.name,
            country: item.country.name,
            logo: item.league.logo,
          }));
        }
      }

      setCache(cacheKey, { leagues });

      return new Response(JSON.stringify({ leagues }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
