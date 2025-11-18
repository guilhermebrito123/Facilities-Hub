import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Edit, Plus, RefreshCw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Periodicidade = Database["public"]["Enums"]["periodicidade_type"];
type ChecklistRow = Database["public"]["Tables"]["checklist"]["Row"];
type ChecklistInsert = Database["public"]["Tables"]["checklist"]["Insert"];
type ContratoSummary = Pick<Database["public"]["Tables"]["contratos"]["Row"], "id" | "nome" | "codigo">;
type UnidadeSummary = Pick<Database["public"]["Tables"]["unidades"]["Row"], "id" | "nome" | "codigo" | "contrato_id">;

type ChecklistWithRelations = ChecklistRow & {
  contrato?: ContratoSummary | null;
  unidade?: UnidadeSummary | null;
};

interface ChecklistForm {
  nome: string;
  periodicidade: Periodicidade;
  contrato_id: string;
  unidade_id: string;
}

const periodicidadeOptions: { value: Periodicidade; label: string }[] = [
  { value: "diaria", label: "Diaria" },
  { value: "semanal", label: "Semanal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

const Checklist = () => {
  const [checklists, setChecklists] = useState<ChecklistWithRelations[]>([]);
  const [contratos, setContratos] = useState<ContratoSummary[]>([]);
  const [unidades, setUnidades] = useState<UnidadeSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ChecklistForm>({
    nome: "",
    periodicidade: "mensal",
    contrato_id: "none",
    unidade_id: "none",
  });
  const [unidadeFilter, setUnidadeFilter] = useState<string>("all");

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      await Promise.all([loadChecklists(), loadCombos()]);
    } catch (error) {
      console.error("Erro ao carregar dados de checklist:", error);
      toast.error("Nao foi possivel carregar os checklists.");
    } finally {
      setLoading(false);
    }
  };

  const loadCombos = async () => {
    const [{ data: contratosData }, { data: unidadesData }] = await Promise.all([
      supabase.from("contratos").select("id, nome, codigo"),
      supabase.from("unidades").select("id, nome, codigo, contrato_id"),
    ]);

    setContratos((contratosData as ContratoSummary[]) ?? []);
    setUnidades((unidadesData as UnidadeSummary[]) ?? []);
  };

  const loadChecklists = async () => {
    const { data, error } = await supabase
      .from("checklist")
      .select(
        `
        *,
        contrato:contratos ( id, nome, codigo ),
        unidade:unidades ( id, nome, codigo, contrato_id )
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    setChecklists((data as ChecklistWithRelations[]) ?? []);
  };

  const filteredChecklists = useMemo(() => {
    return checklists.filter((checklist) => {
      const matchSearch =
        checklist.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        checklist.contrato?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        checklist.unidade?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchUnidade = unidadeFilter === "all" || checklist.unidade_id === unidadeFilter;
      return matchSearch && matchUnidade;
    });
  }, [checklists, searchTerm, unidadeFilter]);

  const resetForm = () => {
    setFormData({
      nome: "",
      periodicidade: "mensal",
      contrato_id: "none",
      unidade_id: "none",
    });
    setEditingId(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.nome) {
      toast.error("Informe o nome do checklist.");
      return;
    }

    const payload: ChecklistInsert = {
      nome: formData.nome,
      periodicidade: formData.periodicidade,
      contrato_id: formData.contrato_id === "none" ? null : formData.contrato_id,
      unidade_id: formData.unidade_id === "none" ? null : formData.unidade_id,
    };

    try {
      setSaving(true);
      if (editingId) {
        const { error } = await supabase.from("checklist").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Checklist atualizado.");
      } else {
        const { error } = await supabase.from("checklist").insert(payload);
        if (error) throw error;
        toast.success("Checklist criado.");
      }
      await loadChecklists();
      resetForm();
    } catch (error) {
      console.error("Erro ao salvar checklist:", error);
      toast.error("Nao foi possivel salvar o checklist.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entry: ChecklistWithRelations) => {
    setEditingId(entry.id);
    setFormData({
      nome: entry.nome,
      periodicidade: entry.periodicidade,
      contrato_id: entry.contrato_id ?? "none",
      unidade_id: entry.unidade_id ?? "none",
    });
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("checklist").delete().eq("id", id);
      if (error) throw error;
      toast.success("Checklist removido.");
      await loadChecklists();
    } catch (error) {
      console.error("Erro ao remover checklist:", error);
      toast.error("Nao foi possivel remover o checklist.");
    }
  };

  const getPeriodicidadeLabel = (value: Periodicidade) =>
    periodicidadeOptions.find((opt) => opt.value === value)?.label ?? value;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Checklists</h1>
            <p className="text-muted-foreground">
              Gerencie a base de checklists de acordo com o contrato e unidade.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadInitialData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Novo checklist
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>{editingId ? "Editar checklist" : "Novo checklist"}</CardTitle>
              <CardDescription>Defina o checklist e seu escopo.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
                    placeholder="Inspeção mensal, checklist de limpeza..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Periodicidade</Label>
                  <Select
                    value={formData.periodicidade}
                    onValueChange={(value: Periodicidade) =>
                      setFormData((prev) => ({ ...prev, periodicidade: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a periodicidade" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {periodicidadeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Contrato</Label>
                  <Select
                    value={formData.contrato_id}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, contrato_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o contrato" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="none">Sem vínculo</SelectItem>
                      {contratos.map((contrato) => (
                        <SelectItem key={contrato.id} value={contrato.id}>
                          {contrato.nome} ({contrato.codigo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Select
                    value={formData.unidade_id}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, unidade_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a unidade" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="none">Sem vínculo</SelectItem>
                      {unidades
                        .filter(
                          (unidade) =>
                            formData.contrato_id === "none" || unidade.contrato_id === formData.contrato_id
                        )
                        .map((unidade) => (
                          <SelectItem key={unidade.id} value={unidade.id}>
                            {unidade.nome} ({unidade.codigo})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando..." : editingId ? "Atualizar" : "Cadastrar"}
                  </Button>
                  {editingId && (
                    <Button type="button" variant="secondary" onClick={resetForm}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Checklists cadastrados</CardTitle>
              <CardDescription>Listagem com filtro rápido por unidade ou nome.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    placeholder="Buscar por nome, contrato ou unidade"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Filtrar por unidade" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="all">Todas as unidades</SelectItem>
                      {unidades.map((unidade) => (
                        <SelectItem key={unidade.id} value={unidade.id}>
                          {unidade.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-sm text-muted-foreground">
                  {filteredChecklists.length} checklist(s) listado(s)
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Periodicidade</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChecklists.map((checklist) => (
                    <TableRow key={checklist.id}>
                      <TableCell className="font-medium">{checklist.nome}</TableCell>
                      <TableCell>
                        {checklist.contrato?.nome ? (
                          <div className="flex flex-col">
                            <span>{checklist.contrato.nome}</span>
                            <span className="text-xs text-muted-foreground">
                              Código: {checklist.contrato.codigo}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Sem contrato</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {checklist.unidade?.nome ? (
                          <div className="flex flex-col">
                            <span>{checklist.unidade.nome}</span>
                            <span className="text-xs text-muted-foreground">
                              Código: {checklist.unidade.codigo}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Sem unidade</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {getPeriodicidadeLabel(checklist.periodicidade)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {checklist.created_at
                          ? format(new Date(checklist.created_at), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(checklist)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(checklist.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredChecklists.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhum checklist cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Checklist;



