import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { CHANNELS } from "./channelLogos";

export interface Match {
  id: number;
  date: string;
  timestamp: number;
  status: string;
  league: { id: number; name: string; country: string; logo: string };
  home: { id: number; name: string; logo: string };
  away: { id: number; name: string; logo: string };
  goals: { home: number | null; away: number | null };
  channels?: string[];
}



interface Props {
  matches: Match[];
  loading: boolean;
  selected: Match[];
  onToggle: (match: Match) => void;
  onChannelChange: (matchId: number, channels: string[]) => void;
  leagueFilter: string;
  onLeagueFilterChange: (v: string) => void;
  leagues: string[];
}

export function MatchSelectionGrid({ matches, loading, selected, onToggle, onChannelChange, leagueFilter, onLeagueFilterChange, leagues }: Props) {
  const filtered = leagueFilter && leagueFilter !== "all"
    ? matches.filter((m) => m.league.name === leagueFilter)
    : matches;

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Buscando jogos do dia...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg">
            Selecione as partidas ({selected.length} selecionadas)
          </CardTitle>
          {leagues.length > 0 && (
            <Select value={leagueFilter} onValueChange={onLeagueFilterChange}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtrar por liga" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ligas</SelectItem>
                {leagues.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum jogo encontrado para hoje.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((match) => {
              const isSelected = selected.some((s) => s.id === match.id);
              return (
                <div
                  key={match.id}
                  className={`relative rounded-lg border p-3 transition-colors cursor-pointer ${
                    isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50"
                  }`}
                  onClick={() => onToggle(match)}
                >
                  <div className="flex items-start gap-2">
                    <Checkbox checked={isSelected} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <Badge variant="outline" className="text-[10px] mb-2">{match.league.name}</Badge>
                      <div className="flex items-center gap-2 mb-1">
                        <img src={match.home.logo} alt="" className="h-6 w-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <span className="text-sm font-medium truncate">{match.home.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <img src={match.away.logo} alt="" className="h-6 w-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <span className="text-sm font-medium truncate">{match.away.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        🕐 {formatTime(match.date)}
                      </p>
                      {/* Channel selector */}
                      {isSelected && (
                        <div className="mt-2 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                          {CHANNELS.map((ch) => {
                            const active = match.channels?.includes(ch.id);
                            return (
                              <button
                                key={ch.id}
                                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                                  active
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                                }`}
                                onClick={() => {
                                  const current = match.channels || [];
                                  const next = active ? current.filter((c) => c !== ch.id) : [...current, ch.id];
                                  onChannelChange(match.id, next);
                                }}
                              >
                                {ch.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
