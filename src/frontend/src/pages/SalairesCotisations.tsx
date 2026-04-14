import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAssociesGerants,
  useCreateAssocieGerant,
  useCreateSalarie,
  useDeleteAssocieGerant,
  useDeleteSalarie,
  useParametresJuridiques,
  useSalaries,
  useUpdateAssocieGerant,
  useUpdateSalarie,
} from "@/hooks/useQueries";
import type { AssocieGerant, Salarie } from "@/hooks/useQueries";
import { fmtEur } from "@/utils/format";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ── Calcul TNS ─────────────────────────────────────────────────────────────────
function calcTNS(net: number) {
  return {
    net,
    cotisations: net * 0.45,
    coutTotal: net * 1.45,
  };
}

// ── Calcul Assimilé salarié ────────────────────────────────────────────────────
function calcAssimile(brut: number) {
  return {
    brut,
    chargesSalariales: brut * 0.22,
    net: brut * 0.78,
    chargesPatronales: brut * 0.42,
    coutEmployeur: brut * 1.42,
  };
}

// ── Associé form ──────────────────────────────────────────────────────────────
interface AssocieForm {
  nom: string;
  statut: string;
  remuStr: string;
}

const emptyAssocieForm = (defaultStatut = "TNS"): AssocieForm => ({
  nom: "",
  statut: defaultStatut,
  remuStr: "",
});

// ── Salarié form ──────────────────────────────────────────────────────────────
interface SalarieForm {
  nom: string;
  poste: string;
  brutStr: string;
}

const emptySalarieForm = (): SalarieForm => ({
  nom: "",
  poste: "",
  brutStr: "",
});

const SKELETON_ROWS = [0, 1, 2];

export default function SalairesCotisations() {
  const { data: parametres } = useParametresJuridiques();
  const defaultStatut = parametres?.regimeSocial ?? "TNS";

  // Associés
  const { data: associes = [], isLoading: loadingAssocies } =
    useAssociesGerants();
  const createAssocMut = useCreateAssocieGerant();
  const updateAssocMut = useUpdateAssocieGerant();
  const deleteAssocMut = useDeleteAssocieGerant();

  const [assocOpen, setAssocOpen] = useState(false);
  const [editingAssoc, setEditingAssoc] = useState<AssocieGerant | null>(null);
  const [assocForm, setAssocForm] = useState<AssocieForm>(
    emptyAssocieForm(defaultStatut),
  );

  // Salariés
  const { data: salaries = [], isLoading: loadingSalaries } = useSalaries();
  const createSalMut = useCreateSalarie();
  const updateSalMut = useUpdateSalarie();
  const deleteSalMut = useDeleteSalarie();

  const [salOpen, setSalOpen] = useState(false);
  const [editingSal, setEditingSal] = useState<Salarie | null>(null);
  const [salForm, setSalForm] = useState<SalarieForm>(emptySalarieForm());

  // ── Associés handlers ────────────────────────────────────────────────────────
  function openAddAssoc() {
    setEditingAssoc(null);
    setAssocForm(emptyAssocieForm(defaultStatut));
    setAssocOpen(true);
  }

  function openEditAssoc(a: AssocieGerant) {
    setEditingAssoc(a);
    setAssocForm({
      nom: a.nom,
      statut: a.statut,
      remuStr:
        a.remunerationAnnuelle === 0 ? "" : String(a.remunerationAnnuelle),
    });
    setAssocOpen(true);
  }

  async function handleSaveAssoc() {
    console.log("[SalairesCotisations] handleSaveAssoc called");
    const data: Omit<AssocieGerant, "id"> = {
      nom: assocForm.nom,
      statut: assocForm.statut,
      remunerationAnnuelle: Number.parseFloat(assocForm.remuStr) || 0,
    };
    try {
      if (editingAssoc) {
        await updateAssocMut.mutateAsync({ ...data, id: editingAssoc.id });
        toast.success("Associé mis à jour");
      } else {
        await createAssocMut.mutateAsync(data);
        toast.success("Associé créé");
      }
      setAssocOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[handleSave] error:", e);
      toast.error(`Erreur lors de la sauvegarde : ${msg}`);
    }
  }

  async function handleDeleteAssoc(id: string) {
    try {
      await deleteAssocMut.mutateAsync(id);
      toast.success("Associé supprimé");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[handleDelete] error:", e);
      toast.error(`Erreur lors de la suppression : ${msg}`);
    }
  }

  // ── Salariés handlers ────────────────────────────────────────────────────────
  function openAddSal() {
    setEditingSal(null);
    setSalForm(emptySalarieForm());
    setSalOpen(true);
  }

  function openEditSal(s: Salarie) {
    setEditingSal(s);
    setSalForm({
      nom: s.nom,
      poste: s.poste,
      brutStr: s.salaireAnnuelBrut === 0 ? "" : String(s.salaireAnnuelBrut),
    });
    setSalOpen(true);
  }

  async function handleSaveSal() {
    console.log("[SalairesCotisations] handleSaveSal called");
    const data: Omit<Salarie, "id"> = {
      nom: salForm.nom,
      poste: salForm.poste,
      salaireAnnuelBrut: Number.parseFloat(salForm.brutStr) || 0,
    };
    try {
      if (editingSal) {
        await updateSalMut.mutateAsync({ ...data, id: editingSal.id });
        toast.success("Salarié mis à jour");
      } else {
        await createSalMut.mutateAsync(data);
        toast.success("Salarié créé");
      }
      setSalOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[handleSave] error:", e);
      toast.error(`Erreur lors de la sauvegarde : ${msg}`);
    }
  }

  async function handleDeleteSal(id: string) {
    try {
      await deleteSalMut.mutateAsync(id);
      toast.success("Salarié supprimé");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[handleDelete] error:", e);
      toast.error(`Erreur lors de la suppression : ${msg}`);
    }
  }

  // ── Totaux ────────────────────────────────────────────────────────────────────
  const totalCoutAssocies = associes.reduce((s, a) => {
    const remu = a.remunerationAnnuelle;
    return (
      s +
      (a.statut === "TNS"
        ? calcTNS(remu).coutTotal
        : calcAssimile(remu).coutEmployeur)
    );
  }, 0);

  const totalCoutSalaries = salaries.reduce(
    (s, sal) => s + calcAssimile(sal.salaireAnnuelBrut).coutEmployeur,
    0,
  );

  const totalCharges = totalCoutAssocies + totalCoutSalaries;

  const isAssocPending = createAssocMut.isPending || updateAssocMut.isPending;
  const isSalPending = createSalMut.isPending || updateSalMut.isPending;

  // ── Sort states ───────────────────────────────────────────────────────────────
  const [sortKeyAssoc, setSortKeyAssoc] = useState<"nom" | "coutTotal" | null>(
    null,
  );
  const [sortOrderAssoc, setSortOrderAssoc] = useState<"asc" | "desc">("asc");
  const [sortKeySal, setSortKeySal] = useState<"nom" | "coutEmployeur" | null>(
    null,
  );
  const [sortOrderSal, setSortOrderSal] = useState<"asc" | "desc">("asc");

  function toggleSortAssoc(key: "nom" | "coutTotal") {
    if (sortKeyAssoc === key) {
      setSortOrderAssoc((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKeyAssoc(key);
      setSortOrderAssoc("asc");
    }
  }

  function toggleSortSal(key: "nom" | "coutEmployeur") {
    if (sortKeySal === key) {
      setSortOrderSal((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKeySal(key);
      setSortOrderSal("asc");
    }
  }

  function SortIconAssoc({ col }: { col: "nom" | "coutTotal" }) {
    if (sortKeyAssoc !== col)
      return <ArrowUpDown className="inline h-3 w-3 ml-1 opacity-50" />;
    return sortOrderAssoc === "asc" ? (
      <ChevronUp className="inline h-3 w-3 ml-1" />
    ) : (
      <ChevronDown className="inline h-3 w-3 ml-1" />
    );
  }

  function SortIconSal({ col }: { col: "nom" | "coutEmployeur" }) {
    if (sortKeySal !== col)
      return <ArrowUpDown className="inline h-3 w-3 ml-1 opacity-50" />;
    return sortOrderSal === "asc" ? (
      <ChevronUp className="inline h-3 w-3 ml-1" />
    ) : (
      <ChevronDown className="inline h-3 w-3 ml-1" />
    );
  }

  const sortedAssocies = [...associes].sort((a, b) => {
    if (!sortKeyAssoc) return 0;
    const dir = sortOrderAssoc === "asc" ? 1 : -1;
    if (sortKeyAssoc === "nom") return a.nom.localeCompare(b.nom, "fr") * dir;
    const coutA =
      a.statut === "TNS"
        ? calcTNS(a.remunerationAnnuelle).coutTotal
        : calcAssimile(a.remunerationAnnuelle).coutEmployeur;
    const coutB =
      b.statut === "TNS"
        ? calcTNS(b.remunerationAnnuelle).coutTotal
        : calcAssimile(b.remunerationAnnuelle).coutEmployeur;
    return (coutA - coutB) * dir;
  });

  const sortedSalaries = [...salaries].sort((a, b) => {
    if (!sortKeySal) return 0;
    const dir = sortOrderSal === "asc" ? 1 : -1;
    if (sortKeySal === "nom") return a.nom.localeCompare(b.nom, "fr") * dir;
    return (
      (calcAssimile(a.salaireAnnuelBrut).coutEmployeur -
        calcAssimile(b.salaireAnnuelBrut).coutEmployeur) *
      dir
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Salaires & Cotisations</h2>
        <p className="text-sm text-muted-foreground">
          Rémunération des associés/gérants et des salariés avec calcul
          automatique des charges sociales françaises.
        </p>
      </div>

      {/* ── Section Associés / Gérants ──────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">Associés & Gérants</h3>
            <p className="text-xs text-muted-foreground">
              Régime par défaut :{" "}
              {defaultStatut === "TNS" ? "TNS" : "Assimilé salarié"}{" "}
              (configurable dans Paramètres)
            </p>
          </div>
          <Button
            size="sm"
            onClick={openAddAssoc}
            data-ocid="salaires.associes.open_modal_button"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Ajouter
          </Button>
        </div>

        <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSortAssoc("nom")}
                  data-ocid="salaires.associes.sort_nom"
                >
                  <span className="flex items-center">
                    Nom <SortIconAssoc col="nom" />
                  </span>
                </TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Rémunération</TableHead>
                <TableHead className="text-right">Charges</TableHead>
                <TableHead className="text-right">Net perçu</TableHead>
                <TableHead
                  className="text-right cursor-pointer select-none"
                  onClick={() => toggleSortAssoc("coutTotal")}
                  data-ocid="salaires.associes.sort_cout"
                >
                  <span className="flex items-center justify-end">
                    Coût total / an <SortIconAssoc col="coutTotal" />
                  </span>
                </TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingAssocies ? (
                SKELETON_ROWS.map((r) => (
                  <TableRow key={r}>
                    {[0, 1, 2, 3, 4, 5, 6].map((c) => (
                      <TableCell key={c}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : associes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-8"
                    data-ocid="salaires.associes.empty_state"
                  >
                    Aucun associé/gérant. Cliquez sur Ajouter.
                  </TableCell>
                </TableRow>
              ) : (
                sortedAssocies.map((a, idx) => {
                  const remu = a.remunerationAnnuelle;
                  const isTNS = a.statut === "TNS";
                  const tns = calcTNS(remu);
                  const assimile = calcAssimile(remu);

                  return (
                    <TableRow
                      key={a.id}
                      data-ocid={`salaires.associes.item.${idx + 1}`}
                    >
                      <TableCell className="font-medium">{a.nom}</TableCell>
                      <TableCell>
                        <Badge
                          variant={isTNS ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {isTNS ? "TNS" : "Assimilé sal."}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <p>{fmtEur(remu)}</p>
                          <p className="text-xs text-muted-foreground">
                            {isTNS ? "net" : "brut"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        {isTNS
                          ? fmtEur(tns.cotisations)
                          : fmtEur(
                              assimile.chargesSalariales +
                                assimile.chargesPatronales,
                            )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isTNS ? fmtEur(remu) : fmtEur(assimile.net)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {isTNS
                          ? fmtEur(tns.coutTotal)
                          : fmtEur(assimile.coutEmployeur)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditAssoc(a)}
                            data-ocid={`salaires.associes.edit_button.${idx + 1}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteAssoc(a.id)}
                            data-ocid={`salaires.associes.delete_button.${idx + 1}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* ── Section Salariés ────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">Salariés</h3>
            <p className="text-xs text-muted-foreground">
              Régime assimilé salarié : charges pat. 42 % + sal. 22 %
            </p>
          </div>
          <Button
            size="sm"
            onClick={openAddSal}
            data-ocid="salaires.salaries.open_modal_button"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Ajouter
          </Button>
        </div>

        <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSortSal("nom")}
                  data-ocid="salaires.salaries.sort_nom"
                >
                  <span className="flex items-center">
                    Nom <SortIconSal col="nom" />
                  </span>
                </TableHead>
                <TableHead>Poste</TableHead>
                <TableHead className="text-right">Brut annuel</TableHead>
                <TableHead className="text-right">Ch. salariales</TableHead>
                <TableHead className="text-right">Net annuel</TableHead>
                <TableHead className="text-right">Ch. patronales</TableHead>
                <TableHead
                  className="text-right cursor-pointer select-none"
                  onClick={() => toggleSortSal("coutEmployeur")}
                  data-ocid="salaires.salaries.sort_cout"
                >
                  <span className="flex items-center justify-end">
                    Coût employeur / an <SortIconSal col="coutEmployeur" />
                  </span>
                </TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingSalaries ? (
                SKELETON_ROWS.map((r) => (
                  <TableRow key={r}>
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((c) => (
                      <TableCell key={c}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : salaries.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground py-8"
                    data-ocid="salaires.salaries.empty_state"
                  >
                    Aucun salarié enregistré.
                  </TableCell>
                </TableRow>
              ) : (
                sortedSalaries.map((s, idx) => {
                  const calc = calcAssimile(s.salaireAnnuelBrut);
                  return (
                    <TableRow
                      key={s.id}
                      data-ocid={`salaires.salaries.item.${idx + 1}`}
                    >
                      <TableCell className="font-medium">{s.nom}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.poste}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtEur(s.salaireAnnuelBrut)}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        {fmtEur(calc.chargesSalariales)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtEur(calc.net)}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        {fmtEur(calc.chargesPatronales)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {fmtEur(calc.coutEmployeur)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditSal(s)}
                            data-ocid={`salaires.salaries.edit_button.${idx + 1}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteSal(s.id)}
                            data-ocid={`salaires.salaries.delete_button.${idx + 1}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* ── Récapitulatif ────────────────────────────────────────────────────── */}
      {(associes.length > 0 || salaries.length > 0) && (
        <section>
          <Separator className="mb-4" />
          <h3 className="font-semibold mb-3">Récapitulatif général</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs text-muted-foreground font-normal">
                  Coût total associés / an
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-xl font-bold">{fmtEur(totalCoutAssocies)}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtEur(totalCoutAssocies / 12)} / mois
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs text-muted-foreground font-normal">
                  Coût total salariés / an
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-xl font-bold">{fmtEur(totalCoutSalaries)}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtEur(totalCoutSalaries / 12)} / mois
                </p>
              </CardContent>
            </Card>

            <Card className="col-span-2 border-primary/30 bg-primary/5">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs text-muted-foreground font-normal">
                  Charges sociales totales / an
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold">{fmtEur(totalCharges)}</p>
                <p className="text-xs text-muted-foreground">
                  Soit {fmtEur(totalCharges / 12)} / mois
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* ── Dialog Associé ───────────────────────────────────────────────────── */}
      <Dialog open={assocOpen} onOpenChange={setAssocOpen}>
        <DialogContent data-ocid="salaires.associes.dialog">
          <DialogHeader>
            <DialogTitle>
              {editingAssoc
                ? "Modifier l'associé/gérant"
                : "Nouvel associé/gérant"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="assoc-nom">Nom</Label>
              <Input
                id="assoc-nom"
                value={assocForm.nom}
                onChange={(e) =>
                  setAssocForm((f) => ({ ...f, nom: e.target.value }))
                }
                data-ocid="salaires.associes.input"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="assoc-statut">Statut social</Label>
              <Select
                value={assocForm.statut}
                onValueChange={(v) =>
                  setAssocForm((f) => ({ ...f, statut: v }))
                }
              >
                <SelectTrigger
                  id="assoc-statut"
                  data-ocid="salaires.associes.select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TNS">
                    TNS — Travailleur Non Salarié
                  </SelectItem>
                  <SelectItem value="assimile">Assimilé salarié</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="assoc-remu">
                {assocForm.statut === "TNS"
                  ? "Rémunération nette souhaitée (€ / an)"
                  : "Salaire brut (€ / an)"}
              </Label>
              <Input
                id="assoc-remu"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={assocForm.remuStr}
                onChange={(e) =>
                  setAssocForm((f) => ({ ...f, remuStr: e.target.value }))
                }
              />
            </div>

            {/* Preview charges */}
            {assocForm.remuStr && (
              <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                {assocForm.statut === "TNS" ? (
                  <>
                    <p>
                      Cotisations sociales :{" "}
                      <strong>
                        {fmtEur(
                          calcTNS(Number.parseFloat(assocForm.remuStr) || 0)
                            .cotisations,
                        )}
                      </strong>{" "}
                      / an
                    </p>
                    <p>
                      Coût total :{" "}
                      <strong>
                        {fmtEur(
                          calcTNS(Number.parseFloat(assocForm.remuStr) || 0)
                            .coutTotal,
                        )}
                      </strong>{" "}
                      / an
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Net perçu :{" "}
                      <strong>
                        {fmtEur(
                          calcAssimile(
                            Number.parseFloat(assocForm.remuStr) || 0,
                          ).net,
                        )}
                      </strong>{" "}
                      / an
                    </p>
                    <p>
                      Charges salariales :{" "}
                      <strong>
                        {fmtEur(
                          calcAssimile(
                            Number.parseFloat(assocForm.remuStr) || 0,
                          ).chargesSalariales,
                        )}
                      </strong>
                    </p>
                    <p>
                      Charges patronales :{" "}
                      <strong>
                        {fmtEur(
                          calcAssimile(
                            Number.parseFloat(assocForm.remuStr) || 0,
                          ).chargesPatronales,
                        )}
                      </strong>
                    </p>
                    <p>
                      Coût employeur :{" "}
                      <strong>
                        {fmtEur(
                          calcAssimile(
                            Number.parseFloat(assocForm.remuStr) || 0,
                          ).coutEmployeur,
                        )}
                      </strong>{" "}
                      / an
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssocOpen(false)}
              data-ocid="salaires.associes.cancel_button"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveAssoc}
              disabled={isAssocPending || !assocForm.nom}
              data-ocid="salaires.associes.submit_button"
            >
              {isAssocPending ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Salarié ───────────────────────────────────────────────────── */}
      <Dialog open={salOpen} onOpenChange={setSalOpen}>
        <DialogContent data-ocid="salaires.salaries.dialog">
          <DialogHeader>
            <DialogTitle>
              {editingSal ? "Modifier le salarié" : "Nouveau salarié"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="sal-nom">Nom</Label>
              <Input
                id="sal-nom"
                value={salForm.nom}
                onChange={(e) =>
                  setSalForm((f) => ({ ...f, nom: e.target.value }))
                }
                data-ocid="salaires.salaries.input"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sal-poste">Poste</Label>
              <Input
                id="sal-poste"
                placeholder="ex : Commis de cuisine"
                value={salForm.poste}
                onChange={(e) =>
                  setSalForm((f) => ({ ...f, poste: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sal-brut">Salaire annuel brut (€)</Label>
              <Input
                id="sal-brut"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={salForm.brutStr}
                onChange={(e) =>
                  setSalForm((f) => ({ ...f, brutStr: e.target.value }))
                }
              />
            </div>

            {/* Preview charges */}
            {salForm.brutStr && (
              <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                {(() => {
                  const c = calcAssimile(
                    Number.parseFloat(salForm.brutStr) || 0,
                  );
                  return (
                    <>
                      <p>
                        Net annuel : <strong>{fmtEur(c.net)}</strong>
                        <span className="text-muted-foreground">
                          {" "}
                          ({fmtEur(c.net / 12)} / mois)
                        </span>
                      </p>
                      <p>
                        Charges patronales :{" "}
                        <strong>{fmtEur(c.chargesPatronales)}</strong>
                      </p>
                      <p>
                        Coût employeur :{" "}
                        <strong>{fmtEur(c.coutEmployeur)}</strong> / an
                      </p>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSalOpen(false)}
              data-ocid="salaires.salaries.cancel_button"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveSal}
              disabled={isSalPending || !salForm.nom}
              data-ocid="salaires.salaries.submit_button"
            >
              {isSalPending ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { Users };
