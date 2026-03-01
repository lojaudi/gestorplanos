import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";

interface Props {
  query: string;
  setQuery: (v: string) => void;
  searching: boolean;
  onSearch: () => void;
}

export function VideoBannerSearch({ query, setQuery, searching, onSearch }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Search className="h-4 w-4" /> Pesquisar Filmes, Séries & Novelas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite o nome do título..."
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
          />
          <Button onClick={onSearch} disabled={searching}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
