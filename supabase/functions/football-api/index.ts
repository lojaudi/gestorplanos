import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// League IDs for api-football (api-sports.io)
const APIFOOTBALL_LEAGUES = [
  71,   // Brasileirão Série A
  72,   // Brasileirão Série B
  73,   // Copa do Brasil
  13,   // Copa Libertadores
  1,    // FIFA World Cup
  135,  // Serie A (Italy)
  2,    // UEFA Champions League
  78,   // Bundesliga
  4,    // European Championship (Euro)
  94,   // Primeira Liga (Portugal)
  71,   // Serie A (already included as Brasileirão)
];

// Competition codes for football-data.org
const FOOTBALLDATA_COMPETITIONS = [
  "BSA",  // Brasileirão Série A
  "BSB",  // Brasileirão Série B
  "CLI",  // Copa Libertadores
  "CPB",  // Copa do Brasil
  "WC",   // FIFA World Cup
  "SA",   // Serie A (Italy)
  "CL",   // UEFA Champions League
  "BL1",  // Bundesliga
  "EC",   // European Championship
  "PPL",  // Primeira Liga (Portugal)
];

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
async function fetchFromFootballData(apiKey: string, date: string, competitions?: string[]) {
  const allMatches: any[] = [];
  const competitionCodes = competitions || FOOTBALLDATA_COMPETITIONS;

  for (const code of competitionCodes) {
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

// ── apisport.online (SportData) ──
async function fetchFromApiSport(apiKey: string, date: string, timezone: string) {
  // Try fixtures endpoint with date parameter
  const url = `https://api.apisport.online/api/v1/fixtures?date=${date}`;
  console.log(`[apisport] Fetching: ${url}`);
  
  const res = await fetch(url, { headers: { "x-api-key": apiKey } });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro na ApiSport.online: ${res.status} – ${text}`);
  }

  const json = await res.json();
  console.log(`[apisport] Raw response keys:`, JSON.stringify(Object.keys(json)));
  
  // Log first item to understand structure
  const rawData = json.response || json.data || json.fixtures || json.results || json.matches || [];
  if (Array.isArray(rawData) && rawData.length > 0) {
    console.log(`[apisport] First item sample:`, JSON.stringify(rawData[0]).substring(0, 500));
  } else if (!Array.isArray(rawData)) {
    console.log(`[apisport] Response is not array, full keys:`, JSON.stringify(json).substring(0, 1000));
  }

  const items = Array.isArray(rawData) ? rawData : [];
  
  return items.map((item: any) => {
    // Adaptive parsing - try multiple known formats
    
    // Format 1: api-football style (fixture.id, teams.home, etc.)
    if (item.fixture) {
      return {
        id: item.fixture.id,
        date: item.fixture.date,
        timestamp: item.fixture.timestamp,
        status: item.fixture.status?.short || item.fixture.status || "NS",
        league: {
          id: item.league?.id || 0,
          name: item.league?.name || "Unknown",
          country: item.league?.country || "",
          logo: item.league?.logo || "",
        },
        home: {
          id: item.teams?.home?.id || 0,
          name: item.teams?.home?.name || "Home",
          logo: item.teams?.home?.logo || "",
        },
        away: {
          id: item.teams?.away?.id || 0,
          name: item.teams?.away?.name || "Away",
          logo: item.teams?.away?.logo || "",
        },
        goals: {
          home: item.goals?.home ?? null,
          away: item.goals?.away ?? null,
        },
      };
    }
    
    // Format 2: Flat structure (id, home_team, away_team, league_name, etc.)
    if (item.home_team || item.homeTeam || item.home) {
      const homeObj = item.home_team || item.homeTeam || item.home || {};
      const awayObj = item.away_team || item.awayTeam || item.away || {};
      const leagueObj = item.league || {};
      
      const homeName = typeof homeObj === "string" ? homeObj : (homeObj.name || homeObj.team_name || "Home");
      const awayName = typeof awayObj === "string" ? awayObj : (awayObj.name || awayObj.team_name || "Away");
      const homeLogo = typeof homeObj === "string" ? "" : (homeObj.logo || homeObj.crest || homeObj.image_path || "");
      const awayLogo = typeof awayObj === "string" ? "" : (awayObj.logo || awayObj.crest || awayObj.image_path || "");
      const homeId = typeof homeObj === "string" ? 0 : (homeObj.id || homeObj.team_id || 0);
      const awayId = typeof awayObj === "string" ? 0 : (awayObj.id || awayObj.team_id || 0);
      
      return {
        id: item.id || item.fixture_id || item.match_id || Math.random(),
        date: item.date || item.utcDate || item.match_date || item.starting_at || item.kick_off || new Date().toISOString(),
        timestamp: item.timestamp || Math.floor(new Date(item.date || item.utcDate || item.match_date || item.starting_at || "").getTime() / 1000),
        status: item.status?.short || item.status || item.state || "NS",
        league: {
          id: leagueObj.id || item.league_id || item.competition_id || 0,
          name: leagueObj.name || item.league_name || item.competition_name || "Unknown",
          country: leagueObj.country || item.country || "",
          logo: leagueObj.logo || leagueObj.emblem || item.league_logo || "",
        },
        home: { id: homeId, name: homeName, logo: homeLogo },
        away: { id: awayId, name: awayName, logo: awayLogo },
        goals: {
          home: item.goals?.home ?? item.score?.home ?? item.home_score ?? null,
          away: item.goals?.away ?? item.score?.away ?? item.away_score ?? null,
        },
      };
    }
    
    // Format 3: Unknown - log and return basic
    console.log(`[apisport] Unknown item format:`, JSON.stringify(item).substring(0, 300));
    return {
      id: item.id || Math.random(),
      date: item.date || new Date().toISOString(),
      timestamp: item.timestamp || 0,
      status: "NS",
      league: { id: 0, name: "Unknown", country: "", logo: "" },
      home: { id: 0, name: "Unknown", logo: "" },
      away: { id: 0, name: "Unknown", logo: "" },
      goals: { home: null, away: null },
    };
  });
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
      .select("football_api_key, football_api_key_secondary, football_api_key_tertiary, football_api_provider, football_timezone, football_apisport_leagues, football_footballdata_leagues")
      .limit(1)
      .maybeSingle();

    // Allow provider override from request (for fetching leagues from a specific provider)
    const providerOverride = params.provider;
    const provider = providerOverride || settings?.football_api_provider || "api-football";
    const timezone = settings?.football_timezone || "America/Sao_Paulo";

    // Pick the right API key based on provider
    let apiKey: string | null = null;
    if (provider === "football-data") {
      apiKey = (settings as any)?.football_api_key_secondary;
    } else if (provider === "apisport") {
      apiKey = (settings as any)?.football_api_key_tertiary;
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
        const selectedCompetitions: string[] = Array.isArray(settings?.football_footballdata_leagues) && (settings.football_footballdata_leagues as string[]).length > 0
          ? (settings.football_footballdata_leagues as string[])
          : FOOTBALLDATA_COMPETITIONS.map(String);
        matches = await fetchFromFootballData(apiKey, date, selectedCompetitions);
      } else if (provider === "apisport") {
        const selectedLeagues: number[] = Array.isArray(settings?.football_apisport_leagues) 
          ? settings.football_apisport_leagues 
          : [];
        matches = await fetchFromApiSport(apiKey, date, timezone);
        // Filter by selected leagues if any are configured
        if (selectedLeagues.length > 0) {
          const leagueSet = new Set(selectedLeagues);
          matches = matches.filter((m: any) => leagueSet.has(m.league.id));
        }
      } else {
        matches = await fetchFromApiFootball(apiKey, date, timezone);
      }

      const result = { matches, date, timezone, provider };
      setCache(cacheKey, result);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "scrape-channels") {
      const matchList = params.matches || [];
      if (!matchList.length) {
        return new Response(JSON.stringify({ channels: {} }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cacheKey = `channels-${new Date().toISOString().slice(0, 10)}-${matchList.length}`;
      const cachedChannels = getCached(cacheKey);
      if (cachedChannels) {
        return new Response(JSON.stringify(cachedChannels), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Brazilian TV broadcasting rights mapping by league/competition
      // These are based on current 2025-2026 broadcasting contracts
      const leagueChannelMap: Record<string, string[]> = {
        // Brasileirão Série A
        "71": ["globo", "sportv", "premiere"],
        "brasileirao serie a": ["globo", "sportv", "premiere"],
        "serie a brazil": ["globo", "sportv", "premiere"],
        "campeonato brasileiro série a": ["globo", "sportv", "premiere"],
        
        // Brasileirão Série B
        "72": ["sportv", "premiere", "band"],
        "brasileirao serie b": ["sportv", "premiere", "band"],
        "serie b brazil": ["sportv", "premiere", "band"],
        "campeonato brasileiro série b": ["sportv", "premiere", "band"],
        
        // Copa do Brasil
        "73": ["globo", "sportv", "premiere", "amazon"],
        "copa do brasil": ["globo", "sportv", "premiere", "amazon"],
        
        // Copa Libertadores
        "13": ["espn", "disney_plus", "paramount"],
        "copa libertadores": ["espn", "disney_plus", "paramount"],
        "conmebol libertadores": ["espn", "disney_plus", "paramount"],
        
        // FIFA World Cup
        "1": ["globo", "sportv", "cazetv"],
        "fifa world cup": ["globo", "sportv", "cazetv"],
        
        // Serie A (Italy)
        "135": ["espn", "disney_plus", "star_plus"],
        "serie a italy": ["espn", "disney_plus", "star_plus"],
        "serie a": ["espn", "disney_plus", "star_plus"],
        
        // UEFA Champions League
        "2": ["tnt_sports", "disney_plus"],
        "champions league": ["tnt_sports", "disney_plus"],
        "champions league uefa": ["tnt_sports", "disney_plus"],
        "uefa champions league": ["tnt_sports", "disney_plus"],
        
        // Bundesliga
        "78": ["espn", "disney_plus", "cazetv"],
        "bundesliga": ["espn", "disney_plus", "cazetv"],
        
        // European Championship
        "4": ["globo", "sportv", "cazetv"],
        "european championship": ["globo", "sportv", "cazetv"],
        "euro": ["globo", "sportv", "cazetv"],
        
        // Primeira Liga (Portugal)
        "94": ["espn", "disney_plus", "star_plus"],
        "primeira liga": ["espn", "disney_plus", "star_plus"],
        "liga portugal": ["espn", "disney_plus", "star_plus"],
        
        // Copa Sul-Americana
        "copa sul-americana": ["espn", "disney_plus", "paramount"],
        "conmebol sudamericana": ["espn", "disney_plus", "paramount"],
        
        // Premier League (England) - common fallback
        "premier league": ["espn", "disney_plus", "star_plus"],
        
        // La Liga (Spain)
        "la liga": ["espn", "disney_plus", "star_plus"],
        
        // Ligue 1 (France)
        "ligue 1": ["cazetv"],
        
        // Copa América
        "copa america": ["globo", "sportv"],
      };

      try {
        const channelMap: Record<string, string[]> = {};

        for (const m of matchList) {
          const matchKey = `${m.home} vs ${m.away}`;
          
          // Try to find channels by league ID first
          if (m.leagueId) {
            const byId = leagueChannelMap[String(m.leagueId)];
            if (byId) {
              channelMap[matchKey] = byId;
              continue;
            }
          }
          
          // Try by league name (fuzzy match)
          if (m.league) {
            const leagueLower = m.league.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            let found = false;
            for (const [key, channels] of Object.entries(leagueChannelMap)) {
              if (leagueLower.includes(key) || key.includes(leagueLower.split(" ")[0])) {
                channelMap[matchKey] = channels;
                found = true;
                break;
              }
            }
            if (found) continue;
          }

          // Default: no channels (user can select manually)
        }

        console.log("League-based channel map:", JSON.stringify(channelMap));

        const result = { channels: channelMap };
        setCache(cacheKey, result);

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("Channel mapping error:", err);
        return new Response(JSON.stringify({ channels: {}, error: String(err) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
        // Fetch all available competitions from football-data.org
        try {
          const url = `https://api.football-data.org/v4/competitions`;
          const res = await fetch(url, { headers: { "X-Auth-Token": apiKey } });
          if (res.ok) {
            const json = await res.json();
            const competitions = json.competitions || [];
            leagues = competitions.map((comp: any) => ({
              id: comp.code || String(comp.id),
              name: comp.name,
              country: comp.area?.name || "",
              logo: comp.emblem || "",
            }));
          }
        } catch (err) {
          console.log(`[football-data] Competitions fetch error:`, err);
        }
      } else if (provider === "apisport") {
        try {
          const url = "https://api.apisport.online/api/v1/leagues";
          const res = await fetch(url, { headers: { "x-api-key": apiKey } });
          if (res.ok) {
            const json = await res.json();
            console.log(`[apisport] Leagues response keys:`, JSON.stringify(Object.keys(json)));
            const rawLeagues = json.response || json.data || json.leagues || json.results || [];
            const items = Array.isArray(rawLeagues) ? rawLeagues : [];
            leagues = items.map((item: any) => ({
              id: item.league?.id || item.id || 0,
              name: item.league?.name || item.name || "Unknown",
              country: item.country?.name || item.country || "",
              logo: item.league?.logo || item.logo || "",
            }));
          } else {
            console.log(`[apisport] Leagues error: ${res.status}`);
          }
        } catch (err) {
          console.log(`[apisport] Leagues fetch error:`, err);
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
