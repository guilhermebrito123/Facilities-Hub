import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Plus, Save, X, Edit, Trash2, RefreshCw } from "lucide-react";
import { format } from "date-fns";

type ChecklistExecucaoRow =
  Database["public"]["Tables"]["checklist_execucoes"]["Row"];
type ChecklistExecucaoInsert =
  Database["public"]["Tables"]["checklist_execucoes"]["Insert"];
type ChecklistRow = Database["public"]["Tables"]["checklists"]["Row"];
type ColaboradorRow = Database["public"]["Tables"]["colaboradores"]["Row"];

interface ChecklistExecucaoForm {
  checklist_id: string;
  colaborador_id: string;
  data_execucao: string;
  status: "em_andamento" | "concluido";
  observacoes: string;
}

const initialForm: ChecklistExecucaoForm = {
  checklist_id: "",
  colaborador_id: "",
  data_execucao: "",
  status: "em_andamento",
  observacoes: "",
};

const statusOptions: ChecklistExecucaoForm["status"][] = [
  "em_andamento",
  "concluido",
];

const ChecklistExecucoes = () => {
  const [execucoes, setExecucoes] = useState<ChecklistExecucaoRow[]>([]);
  const [checklists, setChecklists] = useState<ChecklistRow[]>([]);
  const [colaboradores, setColaboradores] = useState<ColaboradorRow[]>([]);
  const [formData, setFormData] = useState<ChecklistExecucaoForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [colaboradorFilter, setColaboradorFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedExecucao, setExpandedExecucao] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    format(new Date(), "yyyy-MM")
  );
  const [execucaoConclusoes, setExecucaoConclusoes] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchExecucoes(),
        fetchChecklists(),
        fetchColaboradores(),
        fetchExecucaoConclusoes(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchExecucoes = async () => {
    const { data, error } = await supabase
      .from("checklist_execucoes")
      .select(
        "id, checklist_id, colaborador_id, data_execucao, status, observacoes, created_at"
      )
      .order("data_execucao", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar execuções");
      return;
    }

    setExecucoes((data as ChecklistExecucaoRow[]) ?? []);
  };

  const fetchChecklists = async () => {
    const { data, error } = await supabase
      .from("checklists")
      .select("id, nome")
      .order("nome");
    if (error) {
      toast.error("Erro ao carregar checklists");
      return;
    }
    setChecklists(data ?? []);
  };

  const fetchColaboradores = async () => {
    const { data, error } = await supabase
      .from("colaboradores")
      .select("id, nome_completo")
      .order("nome_completo");
    if (error) {
      toast.error("Erro ao carregar colaboradores");
      return;
    }
    setColaboradores(data ?? []);
  };

  const fetchExecucaoConclusoes = async () => {
    const { data, error } = await supabase
      .from("checklist_respostas")
      .select("execucao_id, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erro ao carregar conclusoes de execucoes:", error);
      return;
    }

    const map: Record<string, string> = {};
    data?.forEach((resposta) => {
      if (resposta.execucao_id && !map[resposta.execucao_id]) {
        map[resposta.execucao_id] = resposta.created_at ?? "";
      }
    });
    setExecucaoConclusoes(map);
  };

  const checklistNameMap = useMemo(() => {
    const map = new Map<number, string>();
    checklists.forEach((item) => map.set(item.id, item.nome));
    return map;
  }, [checklists]);

  const colaboradorNameMap = useMemo(() => {
    const map = new Map<string, string>();
    colaboradores.forEach(
      (item) => item.id && map.set(item.id, item.nome_completo ?? "")
    );
    return map;
  }, [colaboradores]);

  const monthOptions = useMemo(() => {
    const keys = new Set<string>();
    execucoes.forEach((execucao) => {
      if (execucao.data_execucao) {
        keys.add(format(new Date(execucao.data_execucao), "yyyy-MM"));
      }
    });
    return Array.from(keys).sort().reverse();
  }, [execucoes]);

  useEffect(() => {
    if (monthOptions.length > 0 && !monthOptions.includes(selectedMonth)) {
      setSelectedMonth(monthOptions[0]);
    }
  }, [monthOptions, selectedMonth]);

  const concludedCountForSelectedMonth = useMemo(() => {
    if (!selectedMonth) return 0;
    return execucoes.filter(
      (execucao) =>
        execucao.status === "concluido" &&
        execucao.data_execucao &&
        format(new Date(execucao.data_execucao), "yyyy-MM") === selectedMonth
    ).length;
  }, [execucoes, selectedMonth]);

  const filteredExecucoes = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return execucoes.filter((execucao) => {
      const checklistName =
        checklistNameMap.get(Number(execucao.checklist_id)) ?? "";
      const colaboradorName = execucao.colaborador_id
        ? colaboradorNameMap.get(execucao.colaborador_id) ?? ""
        : "";
      const matchesSearch =
        checklistName.toLowerCase().includes(term) ||
        colaboradorName.toLowerCase().includes(term) ||
        `${execucao.checklist_id}`.includes(term) ||
        execucao.colaborador_id?.toLowerCase().includes(term) ||
        execucao.status?.toLowerCase().includes(term);

      const matchesColaborador =
        colaboradorFilter === "all" ||
        execucao.colaborador_id === colaboradorFilter;
      const matchesStatus =
        statusFilter === "all" || execucao.status === statusFilter;

      return matchesSearch && matchesColaborador && matchesStatus;
    });
  }, [
    execucoes,
    searchTerm,
    colaboradorFilter,
    statusFilter,
    checklistNameMap,
    colaboradorNameMap,
  ]);

  const resetForm = () => {
    setFormData(initialForm);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.checklist_id ||
      !formData.colaborador_id ||
      !formData.data_execucao
    ) {
      toast.warning("Preencha checklist, colaborador e data de execução");
      return;
    }

    setSaving(true);
    const payload: ChecklistExecucaoInsert = {
      checklist_id: Number(formData.checklist_id),
      colaborador_id: formData.colaborador_id,
      data_execucao: new Date(formData.data_execucao).toISOString(),
      status: formData.status,
      observacoes: formData.observacoes.trim() || null,
    };

    try {
      if (editingId) {
        const { error } = await supabase
          .from("checklist_execucoes")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("checklist_execucoes")
          .insert(payload);
        if (error) throw error;
      }
      toast.success(
        `Execução ${editingId ? "atualizada" : "criada"} com sucesso!`
      );
      resetForm();
      fetchExecucoes();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar execução");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (execucao: ChecklistExecucaoRow) => {
    setEditingId(execucao.id);
    setFormData({
      checklist_id: String(execucao.checklist_id ?? ""),
      colaborador_id: execucao.colaborador_id ?? "",
      data_execucao: execucao.data_execucao
        ? new Date(execucao.data_execucao).toISOString().slice(0, 16)
        : "",
      status:
        (execucao.status as ChecklistExecucaoForm["status"]) ?? "em_andamento",
      observacoes: execucao.observacoes ?? "",
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta execução?")) return;
    const { error } = await supabase
      .from("checklist_execucoes")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Erro ao excluir execução");
      return;
    }
    toast.success("Execução excluída");
    setExpandedExecucao((prev) => (prev === id ? null : prev));
    await Promise.all([fetchExecucoes(), fetchExecucaoConclusoes()]);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Execuções de Checklist</h1>
            <p className="text-muted-foreground">
              Registre as execuções realizadas em campo.
            </p>
          </div>
          <Button variant="outline" onClick={fetchAll} disabled={loading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Execuções concluídas</CardTitle>
                <Select
                  value={selectedMonth}
                  onValueChange={setSelectedMonth}
                  disabled={monthOptions.length === 0}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Selecione o m��s" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((month) => {
                      const [year, m] = month.split("-");
                      const label = new Date(
                        Number(year),
                        Number(m) - 1,
                        1
                      ).toLocaleDateString("pt-BR", {
                        month: "long",
                        year: "numeric",
                      });
                      return (
                        <SelectItem key={month} value={month}>
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">
                {concludedCountForSelectedMonth}
              </p>
              <p className="text-sm text-muted-foreground">
                Execuções marcadas como concluídas no mês selecionado
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {editingId ? "Editar execução" : "Nova execução"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <div className="space-y-2">
                <Label>Checklist *</Label>
                <Select
                  value={formData.checklist_id}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, checklist_id: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {checklists.map((checklist) => (
                      <SelectItem
                        key={checklist.id}
                        value={String(checklist.id)}
                      >
                        {checklist.nome}
                      </SelectItem>
                    ))}
                    {checklists.length === 0 && (
                      <SelectItem value="__placeholder" disabled>
                        Cadastre um checklist primeiro
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Colaborador *</Label>
                <Select
                  value={formData.colaborador_id}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, colaborador_id: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {colaboradores.map((colaborador) => (
                      <SelectItem key={colaborador.id} value={colaborador.id}>
                        {colaborador.nome_completo}
                      </SelectItem>
                    ))}
                    {colaboradores.length === 0 && (
                      <SelectItem value="__placeholder" disabled>
                        Nenhum colaborador cadastrado
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data da execução *</Label>
                <Input
                  type="datetime-local"
                  value={formData.data_execucao}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      data_execucao: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: ChecklistExecucaoForm["status"]) =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      observacoes: e.target.value,
                    }))
                  }
                  placeholder="Anote observações relevantes"
                />
              </div>

              <div className="flex gap-2 md:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Save className="h-4 w-4 mr-2 animate-spin" />
                      Salvando
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      {editingId ? "Atualizar" : "Cadastrar"}
                    </>
                  )}
                </Button>
                {editingId && (
                  <Button type="button" variant="secondary" onClick={resetForm}>
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <CardTitle>Execuções cadastradas</CardTitle>
              <Input
                placeholder="Buscar por checklist, colaborador ou status"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-xs"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
              <Select
                value={colaboradorFilter}
                onValueChange={setColaboradorFilter}
              >
                <SelectTrigger className="w-full md:w-[240px]">
                  <SelectValue placeholder="Colaborador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os colaboradores</SelectItem>
                  {colaboradores.map((colaborador) => (
                    <SelectItem
                      key={colaborador.id}
                      value={colaborador.id ?? ""}
                    >
                      {colaborador.nome_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              {filteredExecucoes.map((execucao) => {
                const isExpanded = expandedExecucao === execucao.id;
                const checklistName =
                  checklistNameMap.get(Number(execucao.checklist_id)) ??
                  execucao.checklist_id;
                const colaboradorName = execucao.colaborador_id
                  ? colaboradorNameMap.get(execucao.colaborador_id) ??
                    execucao.colaborador_id
                  : "-";

                return (
                  <div
                    key={execucao.id}
                    className="rounded-lg border p-4 transition hover:shadow-sm cursor-pointer"
                    onClick={() =>
                      setExpandedExecucao((prev) =>
                        prev === execucao.id ? null : execucao.id
                      )
                    }
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold">{checklistName}</p>
                        <p className="text-sm text-muted-foreground">
                          Colaborador: {colaboradorName}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {execucao.status
                            ? execucao.status.replace("_", " ")
                            : "sem status"}
                        </Badge>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(execucao);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(execucao.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-sm text-muted-foreground">
                      Execução:{" "}
                      {execucao.data_execucao
                        ? new Date(execucao.data_execucao).toLocaleString(
                            "pt-BR"
                          )
                        : "-"}
                    </div>

                    {isExpanded && (
                      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                        <div className="font-medium text-foreground">
                          Detalhes da execução
                        </div>
                        <div>ID da execução: {execucao.id}</div>
                        {execucaoConclusoes[execucao.id] && (
                          <div>
                            Concluido em:{" "}
                            {new Date(
                              execucaoConclusoes[execucao.id]
                            ).toLocaleString("pt-BR")}
                          </div>
                        )}
                        <div>
                          Observações:{" "}
                          {execucao.observacoes?.trim() || "Sem observações"}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {!loading && filteredExecucoes.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-6">
                  Nenhuma execução encontrada
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ChecklistExecucoes;
