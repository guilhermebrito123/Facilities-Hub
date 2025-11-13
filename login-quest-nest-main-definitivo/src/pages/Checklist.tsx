import { useCallback, useEffect, useMemo, useState } from "react";
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

type ChecklistRow = Database["public"]["Tables"]["checklists"]["Row"];
type ChecklistInsert = Database["public"]["Tables"]["checklists"]["Insert"];
type UnidadeRow = Pick<
  Database["public"]["Tables"]["unidades"]["Row"],
  "id" | "nome"
>;

const tipoOptions = ["diario", "semanal", "mensal", "pontual"] as const;
const statusOptions = ["ativo", "inativo"] as const;
type ChecklistTipo = (typeof tipoOptions)[number];
type ChecklistStatus = (typeof statusOptions)[number];

interface ChecklistForm {
  nome: string;
  descricao: string;
  tipo: ChecklistTipo;
  unidade_id: string;
  status: ChecklistStatus;
}

const initialForm: ChecklistForm = {
  nome: "",
  descricao: "",
  tipo: "diario",
  unidade_id: "",
  status: "ativo",
};

const NONE_VALUE = "__none__";

const Checklist = () => {
  const [checklists, setChecklists] = useState<ChecklistRow[]>([]);
  const [unidades, setUnidades] = useState<UnidadeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ChecklistForm>(initialForm);
  const [editingId, setEditingId] = useState<ChecklistRow["id"] | null>(null);

  const fetchChecklists = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("checklists")
        .select(
          "id, nome, descricao, tipo, unidade_id, status, created_at, updated_at"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      setChecklists((data as ChecklistRow[]) ?? []);
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível carregar os checklists");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUnidades = useCallback(async () => {
    const { data, error } = await supabase
      .from("unidades")
      .select("id, nome")
      .order("nome");
    if (error) {
      toast.error("Não foi possível carregar as unidades");
      return;
    }
    setUnidades(data ?? []);
  }, []);

  useEffect(() => {
    fetchChecklists();
    fetchUnidades();
  }, [fetchChecklists, fetchUnidades]);

  const unidadeMap = useMemo(() => {
    const map = new Map<string, string>();
    unidades.forEach((unidade) => map.set(unidade.id, unidade.nome));
    return map;
  }, [unidades]);

  const resetForm = () => {
    setFormData(initialForm);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      toast.warning("Informe o nome do checklist");
      return;
    }

    setSaving(true);
    const payload: ChecklistInsert = {
      nome: formData.nome.trim(),
      descricao: formData.descricao.trim() || null,
      tipo: formData.tipo,
      unidade_id: formData.unidade_id || null,
      status: formData.status || "ativo",
    };

    try {
      if (editingId) {
        const { error } = await supabase
          .from("checklists")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("checklists").insert(payload);
        if (error) throw error;
      }
      toast.success(
        `Checklist ${editingId ? "atualizado" : "criado"} com sucesso`
      );
      resetForm();
      fetchChecklists();
    } catch (error) {
      toast.error("Erro ao salvar checklist");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (checklist: ChecklistRow) => {
    setEditingId(checklist.id);
    setFormData({
      nome: checklist.nome,
      descricao: checklist.descricao ?? "",
      tipo:
        checklist.tipo && tipoOptions.includes(checklist.tipo as ChecklistTipo)
          ? (checklist.tipo as ChecklistTipo)
          : "diario",
      unidade_id: checklist.unidade_id ?? "",
      status:
        checklist.status &&
        statusOptions.includes(checklist.status as ChecklistStatus)
          ? (checklist.status as ChecklistStatus)
          : "ativo",
    });
  };

  const handleDelete = async (id: ChecklistRow["id"]) => {
    if (!confirm("Deseja realmente excluir este checklist?")) return;
    const { error } = await supabase.from("checklists").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir checklist");
      return;
    }
    toast.success("Checklist excluído");
    fetchChecklists();
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Checklists</h1>
            <p className="text-muted-foreground">
              Cadastre e acompanhe os modelos utilizados nas inspeções.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={fetchChecklists}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Atualizar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {editingId ? "Editar checklist" : "Novo checklist"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {editingId && (
                <div className="space-y-2 md:col-span-2">
                  <Label>ID</Label>
                  <Input value={editingId} disabled />
                </div>
              )}

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, nome: e.target.value }))
                  }
                  placeholder="Ex: Checklist semanal de segurança"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      descricao: e.target.value,
                    }))
                  }
                  placeholder="Detalhe o objetivo do checklist"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value: ChecklistForm["tipo"]) =>
                    setFormData((prev) => ({ ...prev, tipo: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tipoOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select
                  value={formData.unidade_id || NONE_VALUE}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      unidade_id: value === NONE_VALUE ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Sem unidade</SelectItem>
                    {unidades.map((unidade) => (
                      <SelectItem key={unidade.id} value={unidade.id}>
                        {unidade.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: ChecklistForm["status"]) =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
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
            <CardTitle>Checklists cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Atualizado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checklists.map((checklist) => (
                  <TableRow key={checklist.id}>
                    <TableCell>{checklist.nome}</TableCell>
                    <TableCell>{checklist.tipo || "-"}</TableCell>
                    <TableCell>
                      {(checklist.unidade_id &&
                        unidadeMap.get(checklist.unidade_id)) ??
                        "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          checklist.status === "ativo" ? "default" : "secondary"
                        }
                      >
                        {checklist.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {checklist.created_at
                        ? new Date(checklist.created_at).toLocaleString("pt-BR")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {checklist.updated_at
                        ? new Date(checklist.updated_at).toLocaleString("pt-BR")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(checklist)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(checklist.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && checklists.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-sm text-muted-foreground"
                    >
                      Nenhum checklist cadastrado
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

export default Checklist;
