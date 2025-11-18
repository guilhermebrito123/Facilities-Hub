import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Plus,
  Search,
  Edit,
  Trash2,
  History,
  Calendar,
  MapPin,
  Unlink,
} from "lucide-react";
import { ColaboradorForm } from "@/components/colaboradores/ColaboradorForm";
import { PresencaDialog } from "@/components/colaboradores/PresencaDialog";
import { RequisitosMissingDialog } from "@/components/colaboradores/RequisitosMissingDialog";
import { AtribuirEscalaDialog } from "@/components/colaboradores/AtribuirEscalaDialog";
import { AtribuirUnidadeDialog } from "@/components/colaboradores/AtribuirUnidadeDialog";
import { CalendarioPresencaDialog } from "@/components/colaboradores/CalendarioPresencaDialog";
import { DashboardLayout } from "@/components/DashboardLayout";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Colaboradores() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [alocacaoFilter, setAlocacaoFilter] = useState<string>("all");
  const [cargoFilter, setCargoFilter] = useState<string>("all");
  const [unidadeFilter, setUnidadeFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingColaborador, setEditingColaborador] = useState<any>(null);
  const [presencaColaborador, setPresencaColaborador] = useState<any>(null);
  const [showRequisitosMissing, setShowRequisitosMissing] = useState(false);
  const [missingEntities, setMissingEntities] = useState<string[]>([]);
  const [escalaColaborador, setEscalaColaborador] = useState<any>(null);
  const [unidadeColaborador, setUnidadeColaborador] = useState<any>(null);
  const [calendarioColaborador, setCalendarioColaborador] = useState<any>(null);
  const [colaboradorDetalhe, setColaboradorDetalhe] = useState<any>(null);

  const { data: colaboradores, refetch } = useQuery({
    queryKey: ["colaboradores", statusFilter, unidadeFilter, alocacaoFilter, cargoFilter],
    queryFn: async () => {
      let query = supabase
        .from("colaboradores")
        .select(
          `
          *,
          unidade:unidades(id, nome, contratos(id, nome, codigo)),
          escala:escalas(nome, tipo),
          posto:postos_servico(
            id,
            nome,
            codigo,
            unidade:unidades(id, nome, contratos(id, nome, codigo))
          )
        `
        )
        .order("nome_completo");

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (unidadeFilter !== "all") {
        query = query.eq("unidade_id", unidadeFilter);
      }
      if (alocacaoFilter === "alocado") {
        query = query.not("posto_servico_id", "is", null);
      } else if (alocacaoFilter === "nao_alocado") {
        query = query.is("posto_servico_id", null);
      }
      if (cargoFilter !== "all") {
        query = query.eq("cargo", cargoFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: unidades } = useQuery({
    queryKey: ["unidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidades")
        .select("id, nome")
        .eq("status", "ativo")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const filteredColaboradores = colaboradores?.filter(
    (colab) =>
      colab.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      colab.cpf?.includes(searchTerm) ||
      colab.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (colaborador: any) => {
    setEditingColaborador(colaborador);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("colaboradores")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Colaborador excluÃ­do com sucesso");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir colaborador");
    }
  };

  const handleDesvincularPosto = async (colaboradorId: string) => {
    try {
      const { error } = await supabase
        .from("colaboradores")
        .update({ posto_servico_id: null })
        .eq("id", colaboradorId);

      if (error) throw error;
      toast.success("Posto de serviÃ§o desvinculado com sucesso");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Erro ao desvincular posto de serviÃ§o");
    }
  };

  const handleNewColaborador = () => {
    // Verificar requisitos
    const missing = [];
    if (!unidades || unidades.length === 0) missing.push("Unidades");

    if (missing.length > 0) {
      setMissingEntities(missing);
      setShowRequisitosMissing(true);
      return;
    }

    setShowForm(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Colaboradores</h1>
          <Button onClick={handleNewColaborador}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Colaborador
          </Button>
        </div>

        <div className="flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4 w-full md:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="afastado">Afastado</SelectItem>
                <SelectItem value="ferias">Férias</SelectItem>
                <SelectItem value="desligado">Desligado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Unidades</SelectItem>
                {unidades?.map((unidade) => (
                  <SelectItem key={unidade.id} value={unidade.id}>
                    {unidade.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={alocacaoFilter} onValueChange={setAlocacaoFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Alocação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="alocado">Alocado</SelectItem>
                <SelectItem value="nao_alocado">Não alocado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={cargoFilter} onValueChange={setCargoFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Cargos</SelectItem>
                {Array.from(
                  new Set(
                    (colaboradores || [])
                      .map((c: any) => c.cargo)
                      .filter(Boolean)
                  )
                ).map((cargo) => (
                  <SelectItem key={cargo as string} value={cargo as string}>
                    {cargo as string}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Unidade Padrão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredColaboradores?.map((colaborador) => (
                <TableRow
                  key={colaborador.id}
                  className="cursor-pointer"
                  onClick={() => setColaboradorDetalhe(colaborador)}
                >
                  <TableCell className="font-medium">
                    {colaborador.nome_completo}
                  </TableCell>
                  <TableCell>{colaborador.cargo || "-"}</TableCell>
                  <TableCell>
                    {colaborador.escala?.tipo === "12x36"
                      ? "escala_12x36"
                      : colaborador.escala?.tipo === "diarista"
                      ? "diarista"
                      : colaborador.escala?.tipo || "efetivo"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        colaborador.status === "ativo"
                          ? "default"
                          : colaborador.status === "ferias"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {colaborador.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{colaborador.unidade?.nome || "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!colaborador.posto_servico_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUnidadeColaborador(colaborador);
                        }}
                          title="Atribuir Unidade/Posto"
                        >
                          <MapPin className="h-4 w-4" />
                        </Button>
                      )}
                      {colaborador.posto_servico_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDesvincularPosto(colaborador.id);
                        }}
                          title="Desvincular Posto de ServiÃ§o"
                        >
                          <Unlink className="h-4 w-4 text-orange-500" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPresencaColaborador(colaborador);
                      }}
                        title="Histórico de presença"
                      >
                        <History className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(colaborador);
                      }}
                      >
                        <Edit className="h-4 w-4" />
                        </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Confirmar exclusão
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir este colaborador?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(colaborador.id)}
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {showForm && (
          <ColaboradorForm
            open={showForm}
            onClose={() => {
              setShowForm(false);
              setEditingColaborador(null);
            }}
            colaborador={editingColaborador}
            onSuccess={() => {
              setShowForm(false);
              setEditingColaborador(null);
              refetch();
            }}
          />
        )}

        {presencaColaborador && (
          <PresencaDialog
            open={!!presencaColaborador}
            onClose={() => setPresencaColaborador(null)}
            colaborador={presencaColaborador}
            onSuccess={refetch}
          />
        )}

        {showRequisitosMissing && (
          <RequisitosMissingDialog
            open={showRequisitosMissing}
            onClose={() => setShowRequisitosMissing(false)}
            missingEntities={missingEntities}
          />
        )}

        {escalaColaborador && (
          <AtribuirEscalaDialog
            open={!!escalaColaborador}
            onClose={() => setEscalaColaborador(null)}
            colaborador={escalaColaborador}
            onSuccess={refetch}
          />
        )}

        {unidadeColaborador && (
          <AtribuirUnidadeDialog
            open={!!unidadeColaborador}
            onClose={() => setUnidadeColaborador(null)}
            colaborador={unidadeColaborador}
            onSuccess={refetch}
          />
        )}

        {calendarioColaborador && (
          <CalendarioPresencaDialog
            open={!!calendarioColaborador}
            onClose={() => setCalendarioColaborador(null)}
            colaborador={calendarioColaborador}
          />
        )}

        <Dialog
          open={!!colaboradorDetalhe}
          onOpenChange={(open) => {
            if (!open) setColaboradorDetalhe(null);
          }}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {colaboradorDetalhe?.nome_completo || "Colaborador"}
              </DialogTitle>
              <DialogDescription>
                Informações completas do colaborador
              </DialogDescription>
            </DialogHeader>

            {colaboradorDetalhe && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium">{colaboradorDetalhe.email || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="font-medium">{colaboradorDetalhe.telefone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium">{colaboradorDetalhe.status}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cargo</p>
                    <p className="font-medium">{colaboradorDetalhe.cargo || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo / Escala</p>
                    <p className="font-medium">
                      {colaboradorDetalhe.escala?.tipo
                        ? colaboradorDetalhe.escala.tipo
                        : "efetivo"}
                    </p>
                  </div>
                </div>

                <div className="rounded-md border p-4 space-y-2">
                  <p className="font-semibold">Alocação</p>
                  {colaboradorDetalhe.posto_servico_id ? (
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="font-medium">Posto: </span>
                        {colaboradorDetalhe.posto?.codigo
                          ? `${colaboradorDetalhe.posto.codigo} - ${colaboradorDetalhe.posto.nome}`
                          : colaboradorDetalhe.posto?.nome || "-"}
                      </p>
                      <p>
                        <span className="font-medium">Unidade: </span>
                        {colaboradorDetalhe.posto?.unidade?.nome ||
                          colaboradorDetalhe.unidade?.nome ||
                          "-"}
                      </p>
                      <p>
                        <span className="font-medium">Contrato: </span>
                        {colaboradorDetalhe.posto?.unidade?.contratos?.nome ||
                          colaboradorDetalhe.unidade?.contratos?.nome ||
                          "-"}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Não alocado a um posto de serviço.
                    </p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
