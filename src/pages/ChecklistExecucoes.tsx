import { useEffect, useMemo, useState } from "react";
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
import { CheckCircle2, Clock, Edit2, Plus, RefreshCw, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ExecucaoRow = Database["public"]["Tables"]["execucao_checklist"]["Row"];
type ExecucaoInsert = Database["public"]["Tables"]["execucao_checklist"]["Insert"];
type ExecucaoStatus = Database["public"]["Enums"]["status_execucao"];
type ChecklistSummary = Pick<Database["public"]["Tables"]["checklist"]["Row"], "id" | "nome" | "periodicidade">;
type ChecklistItem = Pick<Database["public"]["Tables"]["checklist_item"]["Row"], "id" | "checklist_id">;
type ProfileSummary = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "full_name">;

type ExecucaoWithRelations = ExecucaoRow & {
  checklist?: ChecklistSummary | null;
  supervisor?: ProfileSummary | null;
};

interface ExecucaoForm {
  checklist_id: string;
  data_prevista: string;
  supervisor_id: string;
  status: ExecucaoStatus;
}

const statusLabels: Record<ExecucaoStatus, string> = {
  ativo: "Ativo",
  concluido: "Concluido",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

const genId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

const ChecklistExecucoes = () => {
  const [execucoes, setExecucoes] = useState<ExecucaoWithRelations[]>([]);
  const [checklists, setChecklists] = useState<ChecklistSummary[]>([]);
  const [supervisores, setSupervisores] = useState<ProfileSummary[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ExecucaoStatus | "all">("all");
  const [formData, setFormData] = useState<ExecucaoForm>({
    checklist_id: "",
    data_prevista: "",
    supervisor_id: "none",
    status: "ativo",
  });

  useEffect(() => {
    loadInitial();
  }, []);

  const loadInitial = async () => {
    try {
      await Promise.all([loadChecklists(), loadSupervisores(), loadExecucoes()]);
    } catch (error) {
      console.error("Erro ao carregar execucoes:", error);
      toast.error("Nao foi possivel carregar as execucoes de checklist.");
    } finally {
      setLoading(false);
    }
  };

  const loadChecklists = async () => {
    const { data } = await supabase.from("checklist").select("id, nome, periodicidade");
    setChecklists((data as ChecklistSummary[]) ?? []);
  };

  const loadSupervisores = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "supervisor");

    let supervisorQuery = supabase.from("profiles").select("id, full_name");
    if (roles && roles.length > 0) {
      supervisorQuery = supervisorQuery.in(
        "id",
        roles.map((role) => role.user_id)
      );
    }

    const { data } = await supervisorQuery;
    setSupervisores((data as ProfileSummary[]) ?? []);
  };

  const loadExecucoes = async () => {
    const { data, error } = await supabase
      .from("execucao_checklist")
      .select(
        `
        *,
        checklist:checklist ( id, nome, periodicidade ),
        supervisor:profiles ( id, full_name )
      `
      )
      .order("data_prevista", { ascending: false });

    if (error) throw error;
    setExecucoes((data as ExecucaoWithRelations[]) ?? []);
  };

  const loadChecklistItems = async (checklistId: string) => {
    const { data, error } = await supabase
      .from("checklist_item")
      .select("id, checklist_id")
      .eq("checklist_id", checklistId);

    if (error) throw error;
    return (data as ChecklistItem[]) ?? [];
  };

  const createExecutionItems = async (execucaoId: string, checklistId: string, dataPrevista: string) => {
    const items = await loadChecklistItems(checklistId);
    if (items.length === 0) return;

    const payload = items.map((item) => ({
      id: genId(),
      execucao_checklist_id: execucaoId,
      checklist_item_id: item.id,
      data_prevista: dataPrevista,
      status: "ativo" as ExecucaoStatus,
    }));

    await supabase.from("execucao_checklist_item").insert(payload);
  };

  const resetForm = () => {
    setFormData({
      checklist_id: "",
      data_prevista: "",
      supervisor_id: "",
      status: "ativo",
    });
    setEditingId(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.checklist_id || !formData.data_prevista) {
      toast.error("Selecione o checklist e a data prevista.");
      return;
    }

    const payload: ExecucaoInsert = {
      checklist_id: formData.checklist_id,
      data_prevista: formData.data_prevista,
      supervisor_id: formData.supervisor_id === "none" ? null : formData.supervisor_id,
      status: formData.status,
    };

    try {
      setSaving(true);
      if (editingId) {
        const { error } = await supabase.from("execucao_checklist").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Execução atualizada.");
      } else {
        const newId = genId();
        const { data, error } = await supabase
          .from("execucao_checklist")
          .insert({ ...payload, id: newId })
          .select("id, checklist_id, data_prevista")
          .single();
        if (error) throw error;
        if (data) {
          await createExecutionItems(data.id, data.checklist_id, data.data_prevista);
        }
        toast.success("Execução criada.");
      }

      await loadExecucoes();
      resetForm();
    } catch (error) {
      console.error("Erro ao salvar execução:", error);
      toast.error("Nao foi possivel salvar a execução.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (execucao: ExecucaoWithRelations) => {
    setEditingId(execucao.id);
    setFormData({
      checklist_id: execucao.checklist_id,
      data_prevista: execucao.data_prevista,
      supervisor_id: execucao.supervisor_id ?? "none",
      status: execucao.status,
    });
  };

  const handleStatusUpdate = async (id: string, status: ExecucaoStatus) => {
    try {
      const { error } = await supabase.from("execucao_checklist").update({ status }).eq("id", id);
      if (error) throw error;
      toast.success("Status atualizado.");
      await loadExecucoes();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Nao foi possivel atualizar o status.");
    }
  };

  const filteredExecucoes = useMemo(() => {
    return execucoes.filter((execucao) =>
      statusFilter === "all" ? true : execucao.status === statusFilter
    );
  }, [execucoes, statusFilter]);

  const badgeVariant = (status: ExecucaoStatus) => {
    if (status === "concluido") return "default";
    if (status === "cancelado") return "secondary";
    if (status === "atrasado") return "destructive";
    return "outline";
  };

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
            <h1 className="text-3xl font-bold">Execuções de checklist</h1>
            <p className="text-muted-foreground">
              Agende execuções, vincule supervisores e acompanhe o status.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadInitial}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nova execução
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>{editingId ? "Editar execução" : "Nova execução"}</CardTitle>
              <CardDescription>Selecione o checklist, data e supervisor.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label>Checklist</Label>
                  <Select
                    value={formData.checklist_id}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, checklist_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o checklist" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {checklists.map((checklist) => (
                        <SelectItem key={checklist.id} value={checklist.id}>
                          {checklist.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data prevista</Label>
                  <Input
                    type="date"
                    value={formData.data_prevista}
                    onChange={(e) => setFormData((prev) => ({ ...prev, data_prevista: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Supervisor</Label>
                  <Select
                    value={formData.supervisor_id}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, supervisor_id: value }))}
                  >
                    <SelectTrigger>
                <SelectValue placeholder="Selecione o supervisor" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                      <SelectItem value="none">Sem supervisor</SelectItem>
                      {supervisores.map((perfil) => (
                        <SelectItem key={perfil.id} value={perfil.id}>
                          {perfil.full_name || perfil.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: ExecucaoStatus) => setFormData((prev) => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando..." : editingId ? "Atualizar" : "Agendar"}
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
              <CardTitle>Execuções cadastradas</CardTitle>
              <CardDescription>Visualize status e atue rapidamente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <Select value={statusFilter} onValueChange={(value: ExecucaoStatus | "all") => setStatusFilter(value)}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Filtrar status" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-sm text-muted-foreground">
                  {filteredExecucoes.length} execução(ões) encontrada(s)
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Checklist</TableHead>
                    <TableHead>Data prevista</TableHead>
                    <TableHead>Supervisor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Finalizado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExecucoes.map((execucao) => (
                    <TableRow key={execucao.id}>
                      <TableCell className="font-medium">{execucao.checklist?.nome || "-"}</TableCell>
                      <TableCell>
                        {execucao.data_prevista
                          ? format(new Date(execucao.data_prevista), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell>{execucao.supervisor?.full_name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={badgeVariant(execucao.status)} className="capitalize">
                          {statusLabels[execucao.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {execucao.finalizado_em
                          ? format(new Date(execucao.finalizado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(execucao)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleStatusUpdate(execucao.id, "concluido")}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleStatusUpdate(execucao.id, "cancelado")}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleStatusUpdate(execucao.id, "atrasado")}
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredExecucoes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhuma execução encontrada.
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

export default ChecklistExecucoes;
