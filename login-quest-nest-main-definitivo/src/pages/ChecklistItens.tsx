import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Plus, Save, X, Edit, Trash2, RefreshCw } from "lucide-react";

type ChecklistItemRow = Database["public"]["Tables"]["checklist_itens"]["Row"];
type ChecklistItemInsert =
  Database["public"]["Tables"]["checklist_itens"]["Insert"];
type ChecklistRow = Database["public"]["Tables"]["checklists"]["Row"];

type TipoResposta = Exclude<ChecklistItemRow["tipo_resposta"], null>;

interface ChecklistItemWithChecklist extends ChecklistItemRow {
  checklist?: { nome: string | null } | null;
}

interface ChecklistItemForm {
  checklist_id: string;
  descricao: string;
  tipo_resposta: TipoResposta;
  obrigatorio: "true" | "false";
}

const tipoRespostaOptions: TipoResposta[] = [
  "sim_nao",
  "texto",
  "numero",
  "foto",
];

const initialForm: ChecklistItemForm = {
  checklist_id: "",
  descricao: "",
  tipo_resposta: "sim_nao",
  obrigatorio: "true",
};

const ChecklistItens = () => {
  const [itens, setItens] = useState<ChecklistItemWithChecklist[]>([]);
  const [checklists, setChecklists] = useState<ChecklistRow[]>([]);
  const [formData, setFormData] = useState<ChecklistItemForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchItens(), fetchChecklists()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchItens = async () => {
    const { data, error } = await supabase
      .from("checklist_itens")
      .select(
        `
        id,
        checklist_id,
        ordem,
        descricao,
        tipo_resposta,
        obrigatorio,
        created_at,
        checklist:checklists ( nome )
      `
      )
      .order("checklist_id", { ascending: true })
      .order("ordem", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar itens");
      return;
    }

    setItens((data as ChecklistItemWithChecklist[]) ?? []);
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

  const filteredItens = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return itens.filter(
      (item) =>
        item.descricao.toLowerCase().includes(term) ||
        item.checklist?.nome?.toLowerCase().includes(term) ||
        `${item.ordem}`.includes(term)
    );
  }, [itens, searchTerm]);

  const resetForm = () => {
    setFormData(initialForm);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.checklist_id || !formData.descricao.trim()) {
      toast.warning("Preencha checklist e descrição");
      return;
    }

    setSaving(true);
    const gerarOrdemUnica = async (): Promise<number> => {
      const min = 1;
      const max = 999999;
      let tentativa = 0;

      while (tentativa < 50) {
        tentativa++;
        const ordemAleatoria =
          Math.floor(Math.random() * (max - min + 1)) + min;

        const { count, error } = await supabase
          .from("checklist_itens")
          .select("id", { count: "exact", head: true })
          .eq("ordem", ordemAleatoria);

        if (error) throw error;
        if (!count || count === 0) {
          return ordemAleatoria;
        }
      }

      throw new Error("Não foi possível gerar uma ordem única. Tente novamente.");
    };

    let ordemGerada = 0;

    try {
      ordemGerada = await gerarOrdemUnica();
    } catch (error: any) {
      toast.error(error.message || "Erro ao gerar ordem aleatória");
      setSaving(false);
      return;
    }

    const payload: ChecklistItemInsert = {
      checklist_id: formData.checklist_id,
      ordem: ordemGerada,
      descricao: formData.descricao.trim(),
      tipo_resposta: formData.tipo_resposta,
      obrigatorio: formData.obrigatorio === "true",
    };

    try {
      if (editingId) {
        const { error } = await supabase
          .from("checklist_itens")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("checklist_itens")
          .insert(payload);
        if (error) throw error;
      }
      toast.success(`Item ${editingId ? "atualizado" : "criado"} com sucesso!`);
      resetForm();
      fetchItens();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar item");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: ChecklistItemWithChecklist) => {
    setEditingId(item.id);
    setFormData({
      checklist_id: item.checklist_id?.toString() ?? "",
      descricao: item.descricao ?? "",
      tipo_resposta: (item.tipo_resposta as TipoResposta) ?? "sim_nao",
      obrigatorio: item.obrigatorio ? "true" : "false",
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este item?")) return;
    const { error } = await supabase
      .from("checklist_itens")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Erro ao excluir item");
      return;
    }
    toast.success("Item excluído");
    fetchItens();
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Itens de Checklist</h1>
            <p className="text-muted-foreground">
              Gerencie os itens vinculados a cada checklist.
            </p>
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
            <CardTitle>{editingId ? "Editar item" : "Novo item"}</CardTitle>
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
                      <SelectItem key={checklist.id} value={checklist.id}>
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

              <div className="space-y-2 md:col-span-2">
                <Label>Descrição *</Label>
                <Textarea
                  value={formData.descricao}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      descricao: e.target.value,
                    }))
                  }
                  placeholder="Descreva o item do checklist"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de resposta *</Label>
                <Select
                  value={formData.tipo_resposta}
                  onValueChange={(value: TipoResposta) =>
                    setFormData((prev) => ({ ...prev, tipo_resposta: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tipoRespostaOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Obrigatório *</Label>
                <Select
                  value={formData.obrigatorio}
                  onValueChange={(value: "true" | "false") =>
                    setFormData((prev) => ({ ...prev, obrigatorio: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Sim</SelectItem>
                    <SelectItem value="false">Não</SelectItem>
                  </SelectContent>
                </Select>
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
              <CardTitle>Itens cadastrados</CardTitle>
              <Input
                placeholder="Buscar por checklist, ordem ou descrição"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-xs"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Checklist</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItens.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.checklist?.nome ?? "-"}</TableCell>
                    <TableCell className="max-w-lg text-sm text-muted-foreground">
                      {item.descricao}
                    </TableCell>
                    <TableCell>
                      {item.created_at
                        ? new Date(item.created_at).toLocaleString("pt-BR")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(item)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filteredItens.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-sm text-muted-foreground"
                    >
                      Nenhum item cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ChecklistItens;
