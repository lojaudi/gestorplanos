import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface WhmcsClient {
  id: number;
  firstname?: string;
  lastname?: string;
  companyname?: string;
  email?: string;
  phonenumber?: string;
  country?: string;
  status?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const PAGE_SIZE = 25;

export function WhmcsImportDialog({ open, onClose, onImported }: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clients, setClients] = useState<WhmcsClient[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const load = async (p = 0) => {
    setLoading(true);
    setSelected(new Set());
    try {
      const { data, error } = await supabase.functions.invoke("whmcs-sync", {
        body: {
          action: "list-clients",
          limitstart: p * PAGE_SIZE,
          limitnum: PAGE_SIZE,
          search,
          status,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setClients(((data as any).clients || []) as WhmcsClient[]);
      setTotal((data as any).totalresults || 0);
      setPage(p);
    } catch (e: any) {
      toast({ title: "Erro ao buscar clientes", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const toggleAll = () => {
    if (selected.size === clients.length) setSelected(new Set());
    else setSelected(new Set(clients.map((c) => c.id)));
  };

  const toggle = (id: number) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };

  const handleImport = async () => {
    if (!selected.size) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("whmcs-sync", {
        body: { action: "import-clients", client_ids: Array.from(selected) },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const r = data as any;
      toast({
        title: "Importação concluída",
        description: `Importados: ${r.imported.length} • Pulados: ${r.skipped.length} • Erros: ${r.errors.length}`,
      });
      setSelected(new Set());
      onImported();
    } catch (e: any) {
      toast({ title: "Erro ao importar", description: e.message, variant: "destructive" });
    }
    setImporting(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar clientes do WHMCS</DialogTitle>
          <DialogDescription>
            Selecione os clientes para importar para a sua conta. Clientes com mesmo telefone já cadastrado serão pulados.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(0)}
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Todos</option>
            <option value="Active">Ativos</option>
            <option value="Inactive">Inativos</option>
            <option value="Closed">Encerrados</option>
          </select>
          <Button onClick={() => load(0)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
          </Button>
        </div>

        {clients.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            {loading ? "Carregando..." : "Clique em Buscar para listar clientes do WHMCS"}
          </div>
        ) : (
          <>
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selected.size === clients.length && clients.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((c) => {
                    const name = `${c.firstname || ""} ${c.lastname || ""}`.trim() || c.companyname || `#${c.id}`;
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                        </TableCell>
                        <TableCell className="font-medium">{name}</TableCell>
                        <TableCell className="hidden md:table-cell text-xs">{c.email}</TableCell>
                        <TableCell className="text-xs">{c.phonenumber || "—"}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs">{c.status}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between mt-3 text-sm">
              <span className="text-muted-foreground">
                {total} clientes • Página {page + 1} de {Math.max(1, totalPages)}
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={page === 0 || loading} onClick={() => load(page - 1)}>
                  Anterior
                </Button>
                <Button size="sm" variant="outline" disabled={page + 1 >= totalPages || loading} onClick={() => load(page + 1)}>
                  Próxima
                </Button>
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={handleImport} disabled={!selected.size || importing}>
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Importar selecionados ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
