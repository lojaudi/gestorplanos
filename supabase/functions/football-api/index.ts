import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Ligas filtradas para transmissão no Brasil
const BRAZIL_LEAGUES = [
  71,   // Brasileirão Série A
  73,   // Copa do Brasil
  13,   // Copa Libertadores
  11,   // Copa Sudamericana
  2,    // Champions League
  3,    // Europa League
  39,   // Premier League
  140,  // La Liga
  135,  // Serie A (Italy)
  78,   // Bundesliga
  61,   // Ligue 1
];

// Simple in-memory cache
const cache: Record<string, { data: any; ts: number }> = {};
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getCached(key: string) {
  const entry = cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key: string, data: any) {
  cache[key] = { data, ts: Date.now() };
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

    // Get football API key from platform_settings
    const { data: settings } = await supabase
      .from("platform_settings")
      .select("football_api_key, football_api_provider, football_timezone")
      .limit(1)
      .maybeSingle();

    const apiKey = settings?.football_api_key;
    const provider = settings?.football_api_provider || "api-football";
    const timezone = settings?.football_timezone || "America/Sao_Paulo";

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API Key de futebol não configurada pelo administrador" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get-matches") {
      const date = params.date || new Date().toISOString().slice(0, 10);
      const cacheKey = `matches-${date}-${timezone}`;
      const cached = getCached(cacheKey);
      if (cached) {
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch all matches for the date first (single request), then filter by preferred leagues
      const allUrl = `https://v3.football.api-sports.io/fixtures?date=${date}&timezone=${encodeURIComponent(timezone)}`;
      const res = await fetch(allUrl, { headers: { "x-apisports-key": apiKey } });

      if (!res.ok) {
        const text = await res.text();
        return new Response(
          JSON.stringify({ error: `Erro na API de futebol: ${res.status}`, details: text }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const json = await res.json();
      
      if (json.errors && Object.keys(json.errors).length > 0) {
        console.log("API errors:", JSON.stringify(json.errors));
      }

      const allFixtures = json.response || [];
      
      // Filter by preferred leagues (if any matches exist in those leagues)
      const leagueIds = new Set(params.leagueIds || BRAZIL_LEAGUES);
      const filteredFixtures = allFixtures.filter((f: any) => leagueIds.has(f.league.id));
      
      // Use filtered if there are results, otherwise show all
      const finalFixtures = filteredFixtures.length > 0 ? filteredFixtures : allFixtures;

      const matches = finalFixtures.map((fixture: any) => ({
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

      const result = { matches, date, timezone };
      setCache(cacheKey, result);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-leagues") {
      const cacheKey = "leagues";
      const cached = getCached(cacheKey);
      if (cached) {
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const url = "https://v3.football.api-sports.io/leagues?current=true";
      const res = await fetch(url, {
        headers: { "x-apisports-key": apiKey },
      });

      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: `Erro ao buscar ligas: ${res.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const json = await res.json();
      const leagues = (json.response || []).map((item: any) => ({
        id: item.league.id,
        name: item.league.name,
        country: item.country.name,
        logo: item.league.logo,
      }));

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
