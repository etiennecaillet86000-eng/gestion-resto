import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  useAmortissements,
  useCreateAmortissement,
  useCreateEmprunt,
  useDeleteAmortissement,
  useDeleteEmprunt,
  useEmprunts,
  useUpdateEmprunt,
} from "@/hooks/useQueries";
import type { Emprunt, LigneAmortissement } from "@/hooks/useQueries";
import { fmtEur } from "@/utils/format";
import { Landmark, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ── Emprunt types ────────────────────────────────────────────────────────────

interface EmpruntFormState {
  nom: string;
  montantStr: string;
  tauxStr: string;
  dureeStr: string;
  dateDebut: string;
  differeStr: string;
}

const emptyEmpruntForm = (): EmpruntFormState => ({
  nom: "",
  montantStr: "",
  tauxStr: "",
  dureeStr: "",
  dateDebut: "",
  differeStr: "0",
});

// ── Investissement (amortissement) types ─────────────────────────────────────

interface InvestForm {
  nom: string;
  coutStr: string;
  amortissable: boolean;
  dureeAnsStr: string;
}

const emptyInvestForm = (): InvestForm => ({
  nom: "",
  coutStr: "",
  amortissable: true,
  dureeAnsStr: "",
});

const YEARS_N = [1, 2, 3, 4, 5];

// ── Loan amortization helpers ─────────────────────────────────────────────────

interface LigneAmortPret {
  mois: number;
  date: string;
  mensualite: number;
  interets: number;
  capitalRembourse: number;
  capitalRestant: number;
}

function formatMoisDate(dateDebut: string, offsetMois: number): string {
  if (!dateDebut) return `M${offsetMois}`;
  const [mm, yyyy] = dateDebut.split("/");
  if (!mm || !yyyy) return `M${offsetMois}`;
  const d = new Date(
    Number.parseInt(yyyy),
    Number.parseInt(mm) - 1 + offsetMois - 1,
    1,
  );
  return d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}

function calcAmortissementPret(e: Emprunt): LigneAmortPret[] {
  const { montant, tauxAnnuel, dateDebut } = e;
  const dureeMois = Number(e.dureeMois);
  const differeMois = Number(e.differeMois);
  if (montant <= 0 || dureeMois <= 0) return [];

  const tauxMensuel = tauxAnnuel / 100 / 12;
  let mensualite: number;
  if (tauxAnnuel === 0) {
    mensualite = montant / dureeMois;
  } else {
    mensualite =
      (montant * tauxMensuel) / (1 - (1 + tauxMensuel) ** -dureeMois);
  }

  const lignes: LigneAmortPret[] = [];
  let capitalRestant = montant;
  const diff = differeMois || 0;

  for (let i = 1; i <= dureeMois; i++) {
    if (i <= diff) {
      const interets = capitalRestant * tauxMensuel;
      lignes.push({
        mois: i,
        date: formatMoisDate(dateDebut, i),
        mensualite: interets,
        interets,
        capitalRembourse: 0,
        capitalRestant,
      });
    } else {
      const interets = capitalRestant * tauxMensuel;
      const capitalRembourse = Math.min(mensualite - interets, capitalRestant);
      capitalRestant = Math.max(0, capitalRestant - capitalRembourse);
      lignes.push({
        mois: i,
        date: formatMoisDate(dateDebut, i),
        mensualite: capitalRembourse + interets,
        interets,
        capitalRembourse,
        capitalRestant,
      });
    }
  }
  return lignes;
}

function calcMensualiteEmprunt(e: Omit<Emprunt, "id">): number {
  const { montant, tauxAnnuel } = e;
  const dureeMois = Number(e.dureeMois);
  if (montant <= 0 || dureeMois <= 0) return 0;
  if (tauxAnnuel === 0) return montant / dureeMois;
  const tm = tauxAnnuel / 100 / 12;
  return (montant * tm) / (1 - (1 + tm) ** -dureeMois);
}

// ── Asset depreciation helpers ────────────────────────────────────────────────

/**
 * Returns the annual depreciation for asset `a` in year `n` (1-indexed).
 * dureeMois field now stores YEARS (not months) since the UI switch.
 * Strict rule: 0€ after the depreciation period.
 */
function getDotationAnnuelle(a: LigneAmortissement, year: number): number {
  const dureeAns = Number(a.dureeMois);
  if (dureeAns <= 0) return 0;
  return year <= dureeAns ? a.coutTotal / dureeAns : 0;
}

const SKELETON_COUNT = [0, 1, 2];

// ── Component ────────────────────────────────────────────────────────────────

export default function Emprunts() {
  // ── Emprunts (loans) ────────────────────────────────────────────────────────
  const { data: emprunts = [], isLoading: isLoadingEmprunts } = useEmprunts();
  const createEmpruntMut = useCreateEmprunt();
  const updateEmpruntMut = useUpdateEmprunt();
  const deleteEmpruntMut = useDeleteEmprunt();

  const [empruntOpen, setEmpruntOpen] = useState(false);
  const [editingEmprunt, setEditingEmprunt] = useState<Emprunt | null>(null);
  const [empruntForm, setEmpruntForm] = useState<EmpruntFormState>(
    emptyEmpruntForm(),
  );

  // ── Investissements / Amortissements ────────────────────────────────────────
  const { data: amortissements = [], isLoading: isLoadingAmort } =
    useAmortissements();
  const createAmortMut = useCreateAmortissement();
  const deleteAmortMut = useDeleteAmortissement();

  const [investForm, setInvestForm] = useState<InvestForm>(emptyInvestForm());

  // ── Loan form handlers ───────────────────────────────────────────────────────

  function openAddEmprunt() {
    setEditingEmprunt(null);
    setEmpruntForm(emptyEmpruntForm());
    setEmpruntOpen(true);
  }

  function openEditEmprunt(e: Emprunt) {
    setEditingEmprunt(e);
    setEmpruntForm({
      nom: e.nom,
      montantStr: e.montant === 0 ? "" : String(e.montant),
      tauxStr: e.tauxAnnuel === 0 ? "" : String(e.tauxAnnuel),
      dureeStr: Number(e.dureeMois) === 0 ? "" : String(Number(e.dureeMois)),
      dateDebut: e.dateDebut,
      differeStr: String(Number(e.differeMois)),
    });
    setEmpruntOpen(true);
  }

  function buildEmpruntData(): Omit<Emprunt, "id"> {
    return {
      nom: empruntForm.nom,
      montant: Number.parseFloat(empruntForm.montantStr) || 0,
      tauxAnnuel: Number.parseFloat(empruntForm.tauxStr) || 0,
      dureeMois: BigInt(Number.parseInt(empruntForm.dureeStr) || 0),
      dateDebut: empruntForm.dateDebut,
      differeMois: BigInt(Number.parseInt(empruntForm.differeStr) || 0),
    };
  }

  async function handleSaveEmprunt() {
    const data = buildEmpruntData();
    try {
      if (editingEmprunt) {
        await updateEmpruntMut.mutateAsync({ ...data, id: editingEmprunt.id });
        toast.success("Emprunt mis à jour");
      } else {
        await createEmpruntMut.mutateAsync(data);
        toast.success("Emprunt créé");
      }
      setEmpruntOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erreur lors de la sauvegarde : ${msg}`);
    }
  }

  async function handleDeleteEmprunt(id: string) {
    try {
      await deleteEmpruntMut.mutateAsync(id);
      toast.success("Emprunt supprimé");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erreur lors de la suppression : ${msg}`);
    }
  }

  // ── Investment form handlers ──────────────────────────────────────────────────

  async function handleSaveInvest() {
    if (!investForm.nom.trim()) {
      toast.error("Saisissez une désignation");
      return;
    }
    const cout = Number.parseFloat(investForm.coutStr);
    if (!investForm.coutStr || Number.isNaN(cout) || cout <= 0) {
      toast.error("Coût total invalide");
      return;
    }
    try {
      if (investForm.amortissable) {
        const dureeAns = Number.parseInt(investForm.dureeAnsStr);
        if (
          !investForm.dureeAnsStr ||
          Number.isNaN(dureeAns) ||
          dureeAns <= 0
        ) {
          toast.error("Durée d'amortissement invalide (minimum 1 an)");
          return;
        }
        // Store dureeAns in dureeMois field (standardized to years)
        await createAmortMut.mutateAsync({
          nom: investForm.nom.trim(),
          coutTotal: cout,
          dureeMois: BigInt(dureeAns), // field now stores YEARS
        });
      } else {
        // Non-amortissable: store with dureeMois = 0
        await createAmortMut.mutateAsync({
          nom: investForm.nom.trim(),
          coutTotal: cout,
          dureeMois: BigInt(0),
        });
      }
      toast.success("Investissement enregistré");
      setInvestForm(emptyInvestForm());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erreur lors de l'enregistrement : ${msg}`);
    }
  }

  async function handleDeleteAmort(id: string) {
    try {
      await deleteAmortMut.mutateAsync(id);
      toast.success("Investissement supprimé");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erreur : ${msg}`);
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────────

  const isEmpruntPending =
    createEmpruntMut.isPending || updateEmpruntMut.isPending;

  const totalMensualites = emprunts.reduce(
    (s, e) => s + calcMensualiteEmprunt(e),
    0,
  );

  // Only amortissable items (dureeAns > 0)
  const amortissables = amortissements.filter((a) => Number(a.dureeMois) > 0);
  const nonAmortissables = amortissements.filter(
    (a) => Number(a.dureeMois) === 0,
  );

  // Per-year totals (strict 0€ after dureeAns)
  const totalParAnnee = YEARS_N.map((n) =>
    amortissables.reduce((sum, a) => sum + getDotationAnnuelle(a, n), 0),
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* ================================================================= */}
      {/*  SECTION 1 : EMPRUNTS                                             */}
      {/* ================================================================= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              Investissements &amp; Emprunts
            </h2>
            <p className="text-sm text-muted-foreground">
              Prévisionnel de financement, amortissements et plan sur 5 ans
            </p>
          </div>
        </div>

        {/* Sous-titre emprunts */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" />
            Emprunts bancaires
          </h3>
          <Button
            onClick={openAddEmprunt}
            data-ocid="emprunts.open_modal_button"
          >
            <Plus className="mr-2 h-4 w-4" /> Ajouter un emprunt
          </Button>
        </div>

        {/* Récap rapide */}
        {emprunts.length > 0 && (
          <div className="rounded-lg border bg-card p-4 flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-muted-foreground">
                Nombre d&apos;emprunts
              </p>
              <p className="text-xl font-bold">{emprunts.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Montant total emprunté
              </p>
              <p className="text-xl font-bold">
                {fmtEur(emprunts.reduce((s, e) => s + e.montant, 0))}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Charge mensuelle totale
              </p>
              <p className="text-xl font-bold">{fmtEur(totalMensualites)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Charge annuelle totale
              </p>
              <p className="text-xl font-bold">
                {fmtEur(totalMensualites * 12)}
              </p>
            </div>
          </div>
        )}

        {/* Liste des emprunts */}
        {isLoadingEmprunts ? (
          <div className="space-y-3">
            {SKELETON_COUNT.map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : emprunts.length === 0 ? (
          <div
            className="rounded-lg border bg-card p-10 text-center text-muted-foreground"
            data-ocid="emprunts.empty_state"
          >
            <Landmark className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Aucun emprunt enregistré.</p>
            <p className="text-sm mt-1">
              Ajoutez vos prêts bancaires pour générer le tableau
              d&apos;amortissement.
            </p>
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-3">
            {emprunts.map((e, idx) => {
              const lignes = calcAmortissementPret(e);
              const totalInterets = lignes.reduce((s, l) => s + l.interets, 0);
              const totalCapital = lignes.reduce(
                (s, l) => s + l.capitalRembourse,
                0,
              );
              const coutTotal = totalInterets + totalCapital;
              const mensualite = calcMensualiteEmprunt(e);

              return (
                <AccordionItem
                  key={e.id}
                  value={e.id}
                  className="rounded-lg border bg-card shadow-sm overflow-hidden"
                  data-ocid={`emprunts.item.${idx + 1}`}
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex flex-wrap items-center gap-4 text-left w-full">
                      <div className="min-w-[140px]">
                        <p className="font-semibold text-sm">{e.nom}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.dureeMois} mois · début {e.dateDebut || "N/A"}
                        </p>
                      </div>
                      <Badge variant="outline">{fmtEur(e.montant)}</Badge>
                      <Badge variant="secondary">{e.tauxAnnuel} % / an</Badge>
                      <div className="ml-auto mr-4 text-right">
                        <p className="text-sm font-medium">
                          {fmtEur(mensualite)} / mois
                        </p>
                        {e.differeMois > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Différé : {e.differeMois} mois
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            openEditEmprunt(e);
                          }}
                          data-ocid={`emprunts.edit_button.${idx + 1}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            handleDeleteEmprunt(e.id);
                          }}
                          data-ocid={`emprunts.delete_button.${idx + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="px-4 pb-4 space-y-3">
                      <div className="flex flex-wrap gap-6 text-sm rounded-md bg-muted/40 p-3">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Total intérêts
                          </p>
                          <p className="font-semibold text-destructive">
                            {fmtEur(totalInterets)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Capital remboursé
                          </p>
                          <p className="font-semibold">
                            {fmtEur(totalCapital)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Coût total du crédit
                          </p>
                          <p className="font-semibold">{fmtEur(coutTotal)}</p>
                        </div>
                      </div>
                      <Separator />
                      <div className="overflow-x-auto">
                        <Table className="text-xs">
                          <TableHeader>
                            <TableRow className="bg-muted/40">
                              <TableHead className="w-12">Mois</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead className="text-right">
                                Mensualité
                              </TableHead>
                              <TableHead className="text-right">
                                Intérêts
                              </TableHead>
                              <TableHead className="text-right">
                                Capital remb.
                              </TableHead>
                              <TableHead className="text-right">
                                Capital restant
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lignes.map((l) => (
                              <TableRow key={l.mois}>
                                <TableCell className="text-muted-foreground">
                                  {l.mois}
                                </TableCell>
                                <TableCell>{l.date}</TableCell>
                                <TableCell className="text-right">
                                  {fmtEur(l.mensualite)}
                                </TableCell>
                                <TableCell className="text-right text-destructive">
                                  {fmtEur(l.interets)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {fmtEur(l.capitalRembourse)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {fmtEur(l.capitalRestant)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          <tfoot>
                            <TableRow className="bg-muted/40 font-semibold border-t-2">
                              <TableCell colSpan={2}>TOTAL</TableCell>
                              <TableCell className="text-right">
                                {fmtEur(
                                  lignes.reduce((s, l) => s + l.mensualite, 0),
                                )}
                              </TableCell>
                              <TableCell className="text-right text-destructive">
                                {fmtEur(totalInterets)}
                              </TableCell>
                              <TableCell className="text-right">
                                {fmtEur(totalCapital)}
                              </TableCell>
                              <TableCell />
                            </TableRow>
                          </tfoot>
                        </Table>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>

      {/* ================================================================= */}
      {/*  SECTION 2 : PLAN D'AMORTISSEMENT DES INVESTISSEMENTS             */}
      {/* ================================================================= */}
      <Separator />
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold">
            Investissements &amp; Plan d&apos;Amortissement
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Ajoutez vos biens et équipements. La dotation annuelle (coût ÷ durée)
          est calculée automatiquement et alimente le Prévisionnel Économique.
          L&apos;amortissement s&apos;arrête strictement à la fin de la durée
          choisie (0€ après).
        </p>

        {/* Tableau plan d'amortissement sur 5 ans */}
        {isLoadingAmort ? (
          <Skeleton className="h-32 w-full" />
        ) : amortissables.length === 0 ? (
          <div className="rounded-lg border bg-muted/30 p-8 text-center text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Aucun bien amortissable enregistré.</p>
            <p className="text-xs mt-1">
              Ajoutez un investissement amortissable ci-dessous pour générer le
              plan sur 5 ans.
            </p>
          </div>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader className="pb-2 bg-slate-50">
              <CardTitle className="text-sm font-semibold text-slate-700">
                Plan d&apos;amortissement sur 5 ans
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-800">
                      <TableHead className="text-white font-semibold min-w-[180px]">
                        Désignation
                      </TableHead>
                      <TableHead className="text-white font-semibold text-right">
                        Coût total
                      </TableHead>
                      <TableHead className="text-white font-semibold text-right">
                        Durée
                      </TableHead>
                      <TableHead className="text-white font-semibold text-right">
                        Année 1
                      </TableHead>
                      <TableHead className="text-white font-semibold text-right">
                        Année 2
                      </TableHead>
                      <TableHead className="text-white font-semibold text-right">
                        Année 3
                      </TableHead>
                      <TableHead className="text-white font-semibold text-right">
                        Année 4
                      </TableHead>
                      <TableHead className="text-white font-semibold text-right">
                        Année 5
                      </TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {amortissables.map((a, idx) => {
                      const dureeAns = Number(a.dureeMois);
                      const dotationAnnuelle = a.coutTotal / dureeAns;
                      return (
                        <TableRow
                          key={a.id}
                          className={idx % 2 === 1 ? "bg-slate-50" : "bg-white"}
                        >
                          <TableCell className="font-medium text-sm">
                            {a.nom}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {fmtEur(a.coutTotal)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {dureeAns} an{dureeAns > 1 ? "s" : ""}
                          </TableCell>
                          {YEARS_N.map((n) => {
                            const active = n <= dureeAns;
                            return (
                              <TableCell
                                key={n}
                                className={`text-right text-sm ${
                                  active
                                    ? "font-medium text-blue-700"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {active ? fmtEur(dotationAnnuelle) : "—"}
                              </TableCell>
                            );
                          })}
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteAmort(a.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <tfoot>
                    <TableRow className="bg-blue-700 font-bold">
                      <TableCell className="text-white text-sm" colSpan={3}>
                        TOTAL DOTATIONS AUX AMORTISSEMENTS
                      </TableCell>
                      {YEARS_N.map((n, i) => (
                        <TableCell
                          key={n}
                          className="text-right text-white text-sm font-bold"
                        >
                          {fmtEur(totalParAnnee[i] ?? 0)}
                        </TableCell>
                      ))}
                      <TableCell />
                    </TableRow>
                  </tfoot>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Biens non amortissables */}
        {nonAmortissables.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-800">
                Biens non amortissables ({nonAmortissables.length})
              </CardTitle>
              <p className="text-xs text-amber-700">
                Ces biens (terrains, cautions, dépôts) ne génèrent pas de
                dotation aux amortissements.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="text-sm">
                <TableBody>
                  {nonAmortissables.map((a) => (
                    <TableRow key={a.id} className="bg-amber-50/30">
                      <TableCell className="font-medium">{a.nom}</TableCell>
                      <TableCell className="text-right">
                        {fmtEur(a.coutTotal)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        Non amortissable
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteAmort(a.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* ── Formulaire ajout investissement ──────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Ajouter un investissement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Nom et coût */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Désignation du bien</Label>
                <Input
                  placeholder="Ex : Four professionnel, Terrasse..."
                  value={investForm.nom}
                  onChange={(e) =>
                    setInvestForm((f) => ({ ...f, nom: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Coût total HT (€)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex : 8500"
                  value={investForm.coutStr}
                  onChange={(e) =>
                    setInvestForm((f) => ({ ...f, coutStr: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Amortissable ? */}
            <div className="space-y-2">
              <Label>
                Ce bien est-il amortissable ?
                <span className="text-destructive ml-1">*</span>
              </Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setInvestForm((f) => ({ ...f, amortissable: true }))
                  }
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                    investForm.amortissable
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  Oui — amortissable
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setInvestForm((f) => ({
                      ...f,
                      amortissable: false,
                      dureeAnsStr: "",
                    }))
                  }
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                    !investForm.amortissable
                      ? "border-amber-500 bg-amber-500 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  Non — terrain / caution
                </button>
              </div>
              {!investForm.amortissable && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
                  Ce bien ne sera pas amorti. Il apparaîtra dans la liste des
                  biens non amortissables et ne génère aucune dotation.
                </p>
              )}
            </div>

            {/* Durée (visible uniquement si amortissable) */}
            {investForm.amortissable && (
              <div className="grid gap-1.5 max-w-xs">
                <Label>
                  Durée d&apos;amortissement (en années)
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex : 5"
                  value={investForm.dureeAnsStr}
                  onChange={(e) =>
                    setInvestForm((f) => ({
                      ...f,
                      dureeAnsStr: e.target.value,
                    }))
                  }
                />
                {investForm.coutStr && investForm.dureeAnsStr && (
                  <p className="text-xs text-blue-700 font-medium">
                    Dotation annuelle :{" "}
                    {fmtEur(
                      (Number.parseFloat(investForm.coutStr) || 0) /
                        (Number.parseInt(investForm.dureeAnsStr) || 1),
                    )}{" "}
                    / an
                  </p>
                )}
              </div>
            )}

            <Button
              onClick={handleSaveInvest}
              disabled={createAmortMut.isPending}
              data-ocid="investissements.add_button"
            >
              <Plus className="mr-2 h-4 w-4" />
              {createAmortMut.isPending
                ? "Enregistrement..."
                : "Enregistrer l'investissement"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ================================================================= */}
      {/*  DIALOG : Ajout/édition emprunt                                   */}
      {/* ================================================================= */}
      <Dialog open={empruntOpen} onOpenChange={setEmpruntOpen}>
        <DialogContent className="max-w-md" data-ocid="emprunts.dialog">
          <DialogHeader>
            <DialogTitle>
              {editingEmprunt ? "Modifier l'emprunt" : "Nouvel emprunt"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="emp-nom">Nom / objet du prêt</Label>
              <Input
                id="emp-nom"
                placeholder="ex : Prêt matériel cuisine"
                value={empruntForm.nom}
                onChange={(e) =>
                  setEmpruntForm((f) => ({ ...f, nom: e.target.value }))
                }
                data-ocid="emprunts.input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="emp-montant">Montant (€)</Label>
                <Input
                  id="emp-montant"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={empruntForm.montantStr}
                  onChange={(e) =>
                    setEmpruntForm((f) => ({
                      ...f,
                      montantStr: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="emp-taux">Taux annuel (%)</Label>
                <Input
                  id="emp-taux"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={empruntForm.tauxStr}
                  onChange={(e) =>
                    setEmpruntForm((f) => ({ ...f, tauxStr: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="emp-duree">Durée (mois)</Label>
                <Input
                  id="emp-duree"
                  type="text"
                  inputMode="numeric"
                  placeholder="60"
                  value={empruntForm.dureeStr}
                  onChange={(e) =>
                    setEmpruntForm((f) => ({ ...f, dureeStr: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="emp-differe">Différé (mois)</Label>
                <Input
                  id="emp-differe"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={empruntForm.differeStr}
                  onChange={(e) =>
                    setEmpruntForm((f) => ({
                      ...f,
                      differeStr: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="emp-date">Date de début (MM/AAAA)</Label>
              <Input
                id="emp-date"
                type="text"
                placeholder="01/2025"
                value={empruntForm.dateDebut}
                onChange={(e) =>
                  setEmpruntForm((f) => ({ ...f, dateDebut: e.target.value }))
                }
              />
            </div>
            {empruntForm.montantStr && empruntForm.dureeStr && (
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <p className="text-muted-foreground">Mensualité estimée :</p>
                <p className="text-lg font-bold">
                  {fmtEur(
                    calcMensualiteEmprunt({
                      nom: empruntForm.nom,
                      montant: Number.parseFloat(empruntForm.montantStr) || 0,
                      tauxAnnuel: Number.parseFloat(empruntForm.tauxStr) || 0,
                      dureeMois: BigInt(
                        Number.parseInt(empruntForm.dureeStr) || 0,
                      ),
                      dateDebut: empruntForm.dateDebut,
                      differeMois: BigInt(
                        Number.parseInt(empruntForm.differeStr) || 0,
                      ),
                    }),
                  )}{" "}
                  / mois
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEmpruntOpen(false)}
              data-ocid="emprunts.cancel_button"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveEmprunt}
              disabled={
                isEmpruntPending || !empruntForm.nom || !empruntForm.montantStr
              }
              data-ocid="emprunts.submit_button"
            >
              {isEmpruntPending ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
