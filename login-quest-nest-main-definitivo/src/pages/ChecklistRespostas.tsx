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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Plus, Save, X, Edit, Trash2, RefreshCw } from "lucide-react";

type ChecklistRespostaRow =
  Database["public"]["Tables"]["checklist_respostas"]["Row"];
type ChecklistRespostaInsert =
  Database["public"]["Tables"]["checklist_respostas"]["Insert"];
type ChecklistExecucaoRow =
  Database["public"]["Tables"]["checklist_execucoes"]["Row"];
type ChecklistItemRow = Database["public"]["Tables"]["checklist_itens"]["Row"];

interface ChecklistExecucaoWithRelations extends ChecklistExecucaoRow {
  checklist?: { nome: string | null } | null;
  colaborador?: { id: string | null; nome_completo: string | null } | null;
  status?: ChecklistExecucaoRow["status"];
}

interface ChecklistRespostaWithRelations extends ChecklistRespostaRow {
  execucao?: {
    id: string;
    data_execucao: string | null;
    status: ChecklistExecucaoRow["status"];
    checklist?: { nome: string | null } | null;
    colaborador?: { id: string | null; nome_completo: string | null } | null;
  } | null;
  item?: { descricao: string | null } | null;
}

interface ChecklistRespostaForm {
  execucao_id: string;
  item_id: string;
  resposta: string;
  conforme: "true" | "false" | "null";
  foto_url: string;
  observacao: string;
  created_at: string;
}

const initialForm: ChecklistRespostaForm = {
  execucao_id: "",
  item_id: "",
  resposta: "",
  conforme: "null",
  foto_url: "",
  observacao: "",
  created_at: "",
};

const ChecklistRespostas = () => {
  const [respostas, setRespostas] = useState<ChecklistRespostaWithRelations[]>(
    []
  );
  const [execucoes, setExecucoes] = useState<ChecklistExecucaoWithRelations[]>(
    []
  );
  const [itens, setItens] = useState<ChecklistItemRow[]>([]);
  const [formData, setFormData] = useState<ChecklistRespostaForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedResposta, setSelectedResposta] =
    useState<ChecklistRespostaWithRelations | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchRespostas(), fetchExecucoes(), fetchItens()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRespostas = async () => {
    const { data, error } = await supabase
      .from("checklist_respostas")
      .select(
        `
        id,
        execucao_id,
        item_id,
        resposta,
        conforme,
        foto_url,
        observacao,
        created_at,
        execucao:checklist_execucoes (
          id,
          data_execucao,
          status,
          checklist:checklists ( nome ),
          colaborador:colaboradores ( id, nome_completo )
        ),
        item:checklist_itens ( descricao )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar respostas");
      return;
    }

    setRespostas((data as ChecklistRespostaWithRelations[]) ?? []);
  };

  const fetchExecucoes = async () => {
    const { data, error } = await supabase
      .from("checklist_execucoes")
      .select(
        `
        id,
        checklist_id,
        data_execucao,
        status,
        checklist:checklists ( nome ),
        colaborador:colaboradores ( id, nome_completo )
      `
      )
      .order("data_execucao", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar execuÃ§Ãµes");
      return;
    }
    setExecucoes((data as ChecklistExecucaoWithRelations[]) ?? []);
  };

  const fetchItens = async () => {
    const { data, error } = await supabase
      .from("checklist_itens")
      .select("id, descricao, checklist_id")
      .order("descricao");
    if (error) {
      toast.error("Erro ao carregar itens");
      return;
    }
    setItens(data ?? []);
  };

  const filteredRespostas = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return respostas.filter(
      (resposta) =>
        resposta.item?.descricao?.toLowerCase().includes(term) ||
        resposta.execucao?.checklist?.nome?.toLowerCase().includes(term) ||
        resposta.execucao?.colaborador?.nome_completo
          ?.toLowerCase()
          .includes(term) ||
        resposta.resposta?.toLowerCase().includes(term)
    );
  }, [respostas, searchTerm]);

  const resetForm = () => {
    setFormData(initialForm);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.execucao_id) {
      toast.warning("Selecione uma execução");
      return;
    }

    const execucaoSelecionada = execucoes.find(
      (execucao) => execucao.id === formData.execucao_id
    );

    if (execucaoSelecionada?.status === "concluido") {
      toast.warning(
        "Esta execução já está concluída. Edite a execução e altere o status para registrar novas respostas."
      );
      return;
    }

    setSaving(true);

    const payload: ChecklistRespostaInsert = {
      execucao_id: formData.execucao_id,
      item_id: formData.item_id || null,
      resposta: formData.resposta.trim() || null,
      conforme:
        formData.conforme === "null" ? null : formData.conforme === "true",
      foto_url: formData.foto_url.trim() || null,
      observacao: formData.observacao.trim() || null,
      created_at: formData.created_at
        ? new Date(formData.created_at).toISOString()
        : undefined,
    };

    try {
      if (editingId) {
        const { error } = await supabase
          .from("checklist_respostas")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("checklist_respostas")
          .insert(payload);
        if (error) throw error;
      }

      toast.success(
        `Resposta ${editingId ? "atualizada" : "registrada"} com sucesso!`
      );
      resetForm();
      fetchRespostas();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar resposta");
    } finally {
      setSaving(false);
    }
  };
  const handleEdit = (resposta: ChecklistRespostaWithRelations) => {
    setEditingId(resposta.id);
    setFormData({
      execucao_id: resposta.execucao_id ?? "",
      item_id: resposta.item_id ?? "",
      resposta: resposta.resposta ?? "",
      conforme:
        resposta.conforme === null
          ? "null"
          : resposta.conforme
          ? "true"
          : "false",
      foto_url: resposta.foto_url ?? "",
      observacao: resposta.observacao ?? "",
      created_at: resposta.created_at
        ? new Date(resposta.created_at).toISOString().slice(0, 16)
        : "",
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta resposta?")) return;
    const { error } = await supabase
      .from("checklist_respostas")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Erro ao excluir resposta");
      return;
    }
    toast.success("Resposta excluída");
    fetchRespostas();
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Responder Checklist</h1>
          </div>
          <Button variant="outline" onClick={fetchAll} disabled={loading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Atualizar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {editingId ? "Editar resposta" : "Registrar resposta"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {editingId && (
                <div className="space-y-2">
                  <Label>ID (somente leitura)</Label>
                  <Input value={editingId} disabled />
                </div>
              )}
              <div className="space-y-2">
                <Label>Execução *</Label>
                <Select
                  value={formData.execucao_id}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, execucao_id: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {execucoes.map((execucao) => (
                      <SelectItem key={execucao.id} value={execucao.id}>
                        {execucao.checklist?.nome ?? execucao.id} -{" "}
                        {execucao.data_execucao
                          ? new Date(execucao.data_execucao).toLocaleString(
                              "pt-BR"
                            )
                          : "Sem data"}{" "}
                        -{" "}
                        {execucao.colaborador?.nome_completo ??
                          "Sem responsável"}{" "}
                        - Status:{" "}
                        {execucao.status
                          ? execucao.status.replace("_", " ")
                          : "sem status"}
                      </SelectItem>
                    ))}
                    {execucoes.length === 0 && (
                      <SelectItem value="__placeholder" disabled>
                        Cadastre uma execução primeiro
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Não é possível registrar respostas em execuções concluídas.
                  Edite a execução e altere o status para responder novamente.
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Resposta</Label>
                <Textarea
                  value={formData.resposta}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      resposta: e.target.value,
                    }))
                  }
                  placeholder="Conteúdo da resposta"
                />
              </div>

              <div className="space-y-2">
                <Label>Conforme?</Label>
                <Select
                  value={formData.conforme}
                  onValueChange={(value: ChecklistRespostaForm["conforme"]) =>
                    setFormData((prev) => ({ ...prev, conforme: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">Não informado</SelectItem>
                    <SelectItem value="true">Sim</SelectItem>
                    <SelectItem value="false">NÃ£o</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data de criação</Label>
                <Input
                  type="datetime-local"
                  value={formData.created_at}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      created_at: e.target.value,
                    }))
                  }
                  placeholder="Opcional"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Observação</Label>
                <Textarea
                  value={formData.observacao}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      observacao: e.target.value,
                    }))
                  }
                  placeholder="Observações adicionais"
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
      </div>

      <Dialog
        open={!!selectedResposta}
        onOpenChange={() => setSelectedResposta(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da resposta</DialogTitle>
          </DialogHeader>
          {selectedResposta && (
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">ID:</span>{" "}
                {selectedResposta.id}
              </div>
              <div>
                <span className="font-medium text-foreground">Checklist:</span>{" "}
                {selectedResposta.execucao?.checklist?.nome ?? "Não informado"}
              </div>
              <div>
                <span className="font-medium text-foreground">Execução:</span>{" "}
                {selectedResposta.execucao?.id}
              </div>
              <div>
                <span className="font-medium text-foreground">
                  Responsável:
                </span>{" "}
                {selectedResposta.execucao?.colaborador?.nome_completo ??
                  "Não informado"}
              </div>
              <div>
                <span className="font-medium text-foreground">Item:</span>{" "}
                {selectedResposta.item?.descricao ?? "Sem item vinculado"}
              </div>
              <div>
                <span className="font-medium text-foreground">Resposta:</span>{" "}
                {selectedResposta.resposta || "Sem resposta"}
              </div>
              <div>
                <span className="font-medium text-foreground">Conforme:</span>{" "}
                {selectedResposta.conforme === null
                  ? "Não informado"
                  : selectedResposta.conforme
                  ? "Conforme"
                  : "Não conforme"}
              </div>
              <div>
                <span className="font-medium text-foreground">Observação:</span>{" "}
                {selectedResposta.observacao || "Sem observações"}
              </div>
              <div>
                <span className="font-medium text-foreground">
                  Registrada em:
                </span>{" "}
                {selectedResposta.created_at
                  ? new Date(selectedResposta.created_at).toLocaleString(
                      "pt-BR"
                    )
                  : "-"}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ChecklistRespostas;
