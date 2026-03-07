import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// League IDs for api-football (api-sports.io)
const APIFOOTBALL_LEAGUES = [
  71, 72, 73, 13, 1, 135, 2, 78, 4, 94,
];

// Competition codes for football-data.org
const FOOTBALLDATA_COMPETITIONS = [
  "BSA", "BSB", "CLI", "CPB", "WC", "SA", "CL", "BL1", "EC", "PPL",
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
  if (!res.ok) { const text = await res.text(); throw new Error(`Erro na API-Football: ${res.status} – ${text}`); }
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football erro: ${Object.values(json.errors).join("; ")}`);
  }
  const allFixtures = json.response || [];
  return allFixtures.map((fixture: any) => ({
    id: fixture.fixture.id,
    date: fixture.fixture.date,
    timestamp: fixture.fixture.timestamp,
    status: fixture.fixture.status.short,
    league: { id: fixture.league.id, name: fixture.league.name, country: fixture.league.country, logo: fixture.league.logo },
    home: { id: fixture.teams.home.id, name: fixture.teams.home.name, logo: fixture.teams.home.logo },
    away: { id: fixture.teams.away.id, name: fixture.teams.away.name, logo: fixture.teams.away.logo },
    goals: { home: fixture.goals.home, away: fixture.goals.away },
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
      if (!res.ok) { console.log(`football-data.org ${code}: ${res.status}`); continue; }
      const json = await res.json();
      allMatches.push(...(json.matches || []).map((m: any) => ({ ...m, _comp: code })));
    } catch (err) { console.log(`football-data.org ${code} error:`, err); }
  }
  return allMatches.map((m: any) => ({
    id: m.id,
    date: m.utcDate,
    timestamp: Math.floor(new Date(m.utcDate).getTime() / 1000),
    status: mapFootballDataStatus(m.status),
    league: { id: m.competition?.id || 0, name: m.competition?.name || m._comp, country: m.area?.name || "Brazil", logo: m.competition?.emblem || "" },
    home: { id: m.homeTeam?.id || 0, name: m.homeTeam?.shortName || m.homeTeam?.name || "Home", logo: m.homeTeam?.crest || "" },
    away: { id: m.awayTeam?.id || 0, name: m.awayTeam?.shortName || m.awayTeam?.name || "Away", logo: m.awayTeam?.crest || "" },
    goals: { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null },
  }));
}

function mapFootballDataStatus(status: string): string {
  const map: Record<string, string> = { SCHEDULED: "NS", TIMED: "NS", IN_PLAY: "LIVE", PAUSED: "HT", FINISHED: "FT", POSTPONED: "PST", CANCELLED: "CANC", SUSPENDED: "SUSP" };
  return map[status] || status;
}

// ── apisport.online (SportData) ──
async function fetchFromApiSport(apiKey: string, date: string, timezone: string) {
  const allItems: any[] = [];
  let page = 1;
  const maxPages = 10;
  while (page <= maxPages) {
    const url = `https://api.apisport.online/api/v1/fixtures?date=${date}&page=${page}`;
    const res = await fetch(url, { headers: { "x-api-key": apiKey } });
    if (!res.ok) { const text = await res.text(); throw new Error(`Erro na ApiSport.online: ${res.status} – ${text}`); }
    const json = await res.json();
    const rawData = json.data || json.response || json.fixtures || json.results || json.matches || [];
    const items = Array.isArray(rawData) ? rawData : [];
    if (items.length === 0) break;
    allItems.push(...items);
    const pagination = json.pagination;
    if (pagination) {
      const totalPages = pagination.totalPages || pagination.total_pages || pagination.lastPage || pagination.last_page || 1;
      if (page >= totalPages) break;
    } else break;
    page++;
  }

  return allItems.map((item: any) => {
    if (item.fixture) {
      return {
        id: item.fixture.id, date: item.fixture.date, timestamp: item.fixture.timestamp,
        status: item.fixture.status?.short || item.fixture.status || "NS",
        league: { id: item.league?.id || 0, name: item.league?.name || "Unknown", country: item.league?.country || "", logo: item.league?.logo || item.league?.logoUrl || "" },
        home: { id: item.teams?.home?.id || 0, name: item.teams?.home?.name || "Home", logo: item.teams?.home?.logo || item.teams?.home?.logoUrl || "" },
        away: { id: item.teams?.away?.id || 0, name: item.teams?.away?.name || "Away", logo: item.teams?.away?.logo || item.teams?.away?.logoUrl || "" },
        goals: { home: item.goals?.home ?? null, away: item.goals?.away ?? null },
      };
    }
    if (item.homeTeam || item.home_team || item.home) {
      const homeObj = item.homeTeam || item.home_team || item.home || {};
      const awayObj = item.awayTeam || item.away_team || item.away || {};
      const leagueObj = item.league || {};
      const countryObj = leagueObj.country || {};
      const homeName = typeof homeObj === "string" ? homeObj : (homeObj.shortName || homeObj.name || homeObj.team_name || "Home");
      const awayName = typeof awayObj === "string" ? awayObj : (awayObj.shortName || awayObj.name || awayObj.team_name || "Away");
      const homeLogo = typeof homeObj === "string" ? "" : (homeObj.logoUrl || homeObj.logo || homeObj.crest || homeObj.image_path || "");
      const awayLogo = typeof awayObj === "string" ? "" : (awayObj.logoUrl || awayObj.logo || awayObj.crest || awayObj.image_path || "");
      const homeId = typeof homeObj === "string" ? 0 : (homeObj.id || homeObj.team_id || 0);
      const awayId = typeof awayObj === "string" ? 0 : (awayObj.id || awayObj.team_id || 0);
      const countryName = typeof countryObj === "string" ? countryObj : (countryObj.name || item.country || "");
      const matchDate = item.startTime || item.startTimestamp
        ? (item.startTime || new Date((item.startTimestamp || 0) * 1000).toISOString())
        : (item.scheduledAt || item.date || item.utcDate || item.match_date || item.starting_at || item.kick_off || "");
      const matchTimestamp = item.startTimestamp || (matchDate ? Math.floor(new Date(matchDate).getTime() / 1000) : 0);
      return {
        id: item.id || item.fixture_id || item.match_id || Math.random(),
        date: matchDate, timestamp: matchTimestamp,
        status: item.status?.short || item.status?.type || item.status || item.state || "NS",
        league: { id: leagueObj.id || item.league_id || item.competition_id || 0, name: leagueObj.name || item.league_name || item.competition_name || "Unknown", country: countryName, logo: leagueObj.logoUrl || leagueObj.logo || leagueObj.emblem || item.league_logo || "" },
        home: { id: homeId, name: homeName, logo: homeLogo },
        away: { id: awayId, name: awayName, logo: awayLogo },
        goals: { home: item.result?.home ?? item.goals?.home ?? item.score?.home ?? item.homeScore?.current ?? item.home_score ?? null, away: item.result?.away ?? item.goals?.away ?? item.score?.away ?? item.awayScore?.current ?? item.away_score ?? null },
      };
    }
    return {
      id: item.id || Math.random(), date: item.date || new Date().toISOString(), timestamp: item.timestamp || 0, status: "NS",
      league: { id: 0, name: "Unknown", country: "", logo: "" },
      home: { id: 0, name: "Unknown", logo: "" }, away: { id: 0, name: "Unknown", logo: "" },
      goals: { home: null, away: null },
    };
  });
}

// ── apisportmax (painelmaster - free, no key needed) ──
async function fetchFromApiSportMax(): Promise<{ matches: any[]; channelMap: Record<string, string[]> }> {
  const url = "https://apisportmax.painelmaster.lol/jogos.json";
  const res = await fetch(url);
  if (!res.ok) { const text = await res.text(); throw new Error(`Erro na ApiSportMax: ${res.status} – ${text}`); }
  const json = await res.json();
  const items = Array.isArray(json) ? json : [];

  // Map channel names from API to our internal channel IDs
  const channelNameToId: Record<string, string> = {
    "globo": "globo", "tv globo": "globo",
    "sportv": "sportv", "sportv 2": "sportv", "sportv 3": "sportv",
    "premiere": "premiere",
    "espn": "espn", "espn 2": "espn", "espn 3": "espn", "espn 4": "espn",
    "star+": "star_plus", "star plus": "star_plus",
    "amazon prime video": "amazon", "prime video": "amazon",
    "cazétv": "cazetv", "cazetv": "cazetv", "cazé tv": "cazetv",
    "band": "band", "bandeirantes": "band",
    "record": "record", "record tv": "record",
    "paramount+": "paramount", "paramount plus": "paramount",
    "tnt sports": "tnt_sports", "tnt": "tnt_sports",
    "disney+": "disney_plus", "disney+ premium": "disney_plus", "disney plus": "disney_plus",
  };

  function mapChannelName(nome: string): string | null {
    const lower = nome.toLowerCase().trim();
    if (channelNameToId[lower]) return channelNameToId[lower];
    // Partial match
    for (const [key, id] of Object.entries(channelNameToId)) {
      if (lower.includes(key) || key.includes(lower)) return id;
    }
    return null;
  }

  const today = new Date().toISOString().slice(0, 10);
  const channelMap: Record<string, string[]> = {};

  const matches = items.map((item: any, idx: number) => {
    // Build a proper ISO date from horario
    const horario = item.horario || "00:00";
    const dateStr = `${today}T${horario}:00`;

    // Map channels
    const channels: string[] = [];
    if (Array.isArray(item.canais)) {
      for (const ch of item.canais) {
        const mapped = mapChannelName(ch.nome || "");
        if (mapped && !channels.includes(mapped)) channels.push(mapped);
      }
    }

    const homeName = item.time1 || "Home";
    const awayName = item.time2 || "Away";
    const matchKey = `${homeName} vs ${awayName}`;
    if (channels.length > 0) channelMap[matchKey] = channels;

    // Map status
    let status = "NS";
    const rawStatus = (item.status || "").toLowerCase().trim();
    if (rawStatus.includes("fim") || rawStatus.includes("encerrado")) status = "FT";
    else if (rawStatus.includes("intervalo")) status = "HT";
    else if (rawStatus.includes("ao vivo") || rawStatus.includes("1º tempo") || rawStatus.includes("2º tempo")) status = "LIVE";
    else if (rawStatus.includes("adiado")) status = "PST";
    else if (rawStatus.includes("cancelado")) status = "CANC";

    return {
      id: idx + 90000,
      date: dateStr,
      timestamp: Math.floor(new Date(dateStr).getTime() / 1000),
      status,
      league: {
        id: 0,
        name: item.competicao || "Desconhecido",
        country: "",
        logo: item.img_competicao_url || "",
      },
      home: { id: 0, name: homeName, logo: item.img_time1_url || "" },
      away: { id: 0, name: awayName, logo: item.img_time2_url || "" },
      goals: {
        home: item.placar_time1 !== null && item.placar_time1 !== undefined && item.placar_time1 !== "" ? Number(item.placar_time1) : null,
        away: item.placar_time2 !== null && item.placar_time2 !== undefined && item.placar_time2 !== "" ? Number(item.placar_time2) : null,
      },
      channels,
    };
  });

  return { matches, channelMap };
}


// Channel mapping by league
const leagueChannelMap: Record<string, string[]> = {
  "71": ["globo", "sportv", "premiere"], "brasileirao serie a": ["globo", "sportv", "premiere"], "campeonato brasileiro série a": ["globo", "sportv", "premiere"],
  "72": ["sportv", "premiere", "band"], "brasileirao serie b": ["sportv", "premiere", "band"], "campeonato brasileiro série b": ["sportv", "premiere", "band"],
  "73": ["globo", "sportv", "premiere", "amazon"], "copa do brasil": ["globo", "sportv", "premiere", "amazon"],
  "13": ["espn", "disney_plus", "paramount"], "copa libertadores": ["espn", "disney_plus", "paramount"], "conmebol libertadores": ["espn", "disney_plus", "paramount"],
  "1": ["globo", "sportv", "cazetv"], "fifa world cup": ["globo", "sportv", "cazetv"],
  "135": ["espn", "disney_plus", "star_plus"], "serie a": ["espn", "disney_plus", "star_plus"],
  "2": ["tnt_sports", "disney_plus"], "champions league": ["tnt_sports", "disney_plus"], "uefa champions league": ["tnt_sports", "disney_plus"],
  "78": ["espn", "disney_plus", "cazetv"], "bundesliga": ["espn", "disney_plus", "cazetv"],
  "4": ["globo", "sportv", "cazetv"], "european championship": ["globo", "sportv", "cazetv"],
  "94": ["espn", "disney_plus", "star_plus"], "primeira liga": ["espn", "disney_plus", "star_plus"], "liga portugal": ["espn", "disney_plus", "star_plus"],
  "copa sul-americana": ["espn", "disney_plus", "paramount"], "conmebol sudamericana": ["espn", "disney_plus", "paramount"],
  "premier league": ["espn", "disney_plus", "star_plus"],
  "la liga": ["espn", "disney_plus", "star_plus"],
  "ligue 1": ["cazetv"],
  "copa america": ["globo", "sportv"],
};

function resolveChannels(matchList: any[]): Record<string, string[]> {
  const channelMap: Record<string, string[]> = {};
  for (const m of matchList) {
    const matchKey = `${m.home?.name || m.home} vs ${m.away?.name || m.away}`;
    if (m.league?.id) {
      const byId = leagueChannelMap[String(m.league.id)];
      if (byId) { channelMap[matchKey] = byId; continue; }
    }
    const leagueName = m.league?.name || m.league || "";
    if (leagueName) {
      const leagueLower = leagueName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      for (const [key, channels] of Object.entries(leagueChannelMap)) {
        if (leagueLower.includes(key) || key.includes(leagueLower.split(" ")[0])) {
          channelMap[matchKey] = channels; break;
        }
      }
    }
  }
  return channelMap;
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
      .select("football_api_key, football_api_key_secondary, football_api_key_tertiary, football_api_provider, football_timezone, football_apisport_leagues, football_footballdata_leagues, football_apifootball_leagues")
      .limit(1)
      .maybeSingle();

    const providerOverride = params.provider;
    const provider = providerOverride || settings?.football_api_provider || "api-football";
    const timezone = settings?.football_timezone || "America/Sao_Paulo";

    let apiKey: string | null = null;
    if (provider === "football-data") apiKey = (settings as any)?.football_api_key_secondary;
    else if (provider === "apisport") apiKey = (settings as any)?.football_api_key_tertiary;
    else apiKey = settings?.football_api_key;

    // ── ACTION: cache-matches (called by cron at midnight) ──
    if (action === "cache-matches") {
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "API Key não configurada" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const date = new Date().toISOString().slice(0, 10);
      console.log(`[cache-matches] Fetching matches for ${date} via ${provider}`);

      let matches: any[];
      if (provider === "football-data") {
        const selectedCompetitions: string[] = Array.isArray(settings?.football_footballdata_leagues) && (settings.football_footballdata_leagues as string[]).length > 0
          ? (settings.football_footballdata_leagues as string[]) : FOOTBALLDATA_COMPETITIONS.map(String);
        matches = await fetchFromFootballData(apiKey, date, selectedCompetitions);
      } else if (provider === "apisport") {
        const selectedLeagues: number[] = Array.isArray(settings?.football_apisport_leagues) ? settings.football_apisport_leagues : [];
        matches = await fetchFromApiSport(apiKey, date, timezone);
        if (selectedLeagues.length > 0) {
          const leagueSet = new Set(selectedLeagues);
          matches = matches.filter((m: any) => leagueSet.has(m.league.id));
        }
      } else {
        const selectedApifootballLeagues: number[] = Array.isArray((settings as any)?.football_apifootball_leagues) && ((settings as any).football_apifootball_leagues as number[]).length > 0
          ? ((settings as any).football_apifootball_leagues as number[]) : APIFOOTBALL_LEAGUES;
        matches = await fetchFromApiFootball(apiKey, date, timezone);
        const leagueSet = new Set(selectedApifootballLeagues);
        matches = matches.filter((m: any) => leagueSet.has(m.league.id));
      }

      // Resolve channels
      const channels = resolveChannels(matches);

      // Upsert into cache table
      const { error } = await supabase.from("football_daily_cache").upsert({
        cache_date: date,
        provider,
        matches,
        channels,
      }, { onConflict: "cache_date,provider" });

      if (error) {
        console.error("[cache-matches] DB error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`[cache-matches] Cached ${matches.length} matches for ${date}`);
      return new Response(JSON.stringify({ success: true, matchesCount: matches.length, date, provider }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: get-matches (reads from DB cache first, falls back to API) ──
    if (action === "get-matches") {
      const date = params.date || new Date().toISOString().slice(0, 10);

      // Try DB cache first
      const { data: cached } = await supabase
        .from("football_daily_cache")
        .select("matches, channels")
        .eq("cache_date", date)
        .eq("provider", provider)
        .maybeSingle();

      if (cached && cached.matches && (cached.matches as any[]).length > 0) {
        console.log(`[get-matches] Serving ${(cached.matches as any[]).length} matches from DB cache for ${date}`);
        return new Response(JSON.stringify({ matches: cached.matches, channels: cached.channels || {}, date, timezone, provider, fromCache: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // No cache - fetch from API (fallback)
      if (!apiKey) {
        return new Response(JSON.stringify({ error: `API Key de futebol não configurada para o provedor: ${provider}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const cacheKey = `matches-${provider}-${date}-${timezone}`;
      const memCached = getCached(cacheKey);
      if (memCached) {
        return new Response(JSON.stringify(memCached), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let matches: any[];
      if (provider === "football-data") {
        const selectedCompetitions: string[] = Array.isArray(settings?.football_footballdata_leagues) && (settings.football_footballdata_leagues as string[]).length > 0
          ? (settings.football_footballdata_leagues as string[]) : FOOTBALLDATA_COMPETITIONS.map(String);
        matches = await fetchFromFootballData(apiKey, date, selectedCompetitions);
      } else if (provider === "apisport") {
        const selectedLeagues: number[] = Array.isArray(settings?.football_apisport_leagues) ? settings.football_apisport_leagues : [];
        matches = await fetchFromApiSport(apiKey, date, timezone);
        if (selectedLeagues.length > 0) {
          const leagueSet = new Set(selectedLeagues);
          matches = matches.filter((m: any) => leagueSet.has(m.league.id));
        }
      } else {
        const selectedApifootballLeagues: number[] = Array.isArray((settings as any)?.football_apifootball_leagues) && ((settings as any).football_apifootball_leagues as number[]).length > 0
          ? ((settings as any).football_apifootball_leagues as number[]) : APIFOOTBALL_LEAGUES;
        matches = await fetchFromApiFootball(apiKey, date, timezone);
        const leagueSet = new Set(selectedApifootballLeagues);
        matches = matches.filter((m: any) => leagueSet.has(m.league.id));
      }

      // Also save to DB cache for future requests
      const channels = resolveChannels(matches);
      await supabase.from("football_daily_cache").upsert({
        cache_date: date, provider, matches, channels,
      }, { onConflict: "cache_date,provider" }).then(() => {});

      const result = { matches, channels, date, timezone, provider };
      setCache(cacheKey, result);

      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "scrape-channels") {
      const matchList = params.matches || [];
      if (!matchList.length) {
        return new Response(JSON.stringify({ channels: {} }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const channelMap = resolveChannels(matchList);
      return new Response(JSON.stringify({ channels: channelMap }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "get-leagues") {
      if (!apiKey) {
        return new Response(JSON.stringify({ error: `API Key não configurada para: ${provider}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const cacheKey = `leagues-${provider}`;
      const cached = getCached(cacheKey);
      if (cached) {
        return new Response(JSON.stringify(cached), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      let leagues: any[] = [];
      if (provider === "football-data") {
        try {
          const url = `https://api.football-data.org/v4/competitions`;
          const res = await fetch(url, { headers: { "X-Auth-Token": apiKey } });
          if (res.ok) {
            const json = await res.json();
            leagues = (json.competitions || []).map((comp: any) => ({ id: comp.code || String(comp.id), name: comp.name, country: comp.area?.name || "", logo: comp.emblem || "" }));
          }
        } catch (err) { console.log(`[football-data] Competitions fetch error:`, err); }
      } else if (provider === "apisport") {
        try {
          const url = "https://api.apisport.online/api/v1/leagues";
          const res = await fetch(url, { headers: { "x-api-key": apiKey } });
          if (res.ok) {
            const json = await res.json();
            const rawLeagues = json.response || json.data || json.leagues || json.results || [];
            leagues = (Array.isArray(rawLeagues) ? rawLeagues : []).map((item: any) => ({ id: item.league?.id || item.id || 0, name: item.league?.name || item.name || "Unknown", country: item.country?.name || item.country || "", logo: item.league?.logo || item.logo || "" }));
          }
        } catch (err) { console.log(`[apisport] Leagues fetch error:`, err); }
      } else {
        const url = "https://v3.football.api-sports.io/leagues?current=true";
        const res = await fetch(url, { headers: { "x-apisports-key": apiKey } });
        if (res.ok) {
          const json = await res.json();
          leagues = (json.response || []).map((item: any) => ({ id: item.league.id, name: item.league.name, country: item.country.name, logo: item.league.logo }));
        }
      }
      setCache(cacheKey, { leagues });
      return new Response(JSON.stringify({ leagues }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
