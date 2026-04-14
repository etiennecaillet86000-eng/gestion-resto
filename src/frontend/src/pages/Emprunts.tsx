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
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Landmark,
  Package,
  Pencil,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ── Emprunt types ─────────────────────────────────────────────────────────────

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

// ── Investissement (amortissement) types ──────────────────────────────────────

interface InvestForm {
  nom: string;
  coutStr: string;
  amortissable: boolean;
  /** Durée en années — maps to backend field dureeMois (stores years) */
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
 * backend field: dureeMois (stores years) — NOT months.
 * Strict rule: 0 € after the depreciation period ends.
 */
function getDotationAnnuelle(a: LigneAmortissement, year: number): number {
  // dureeAnnees — read from backend field dureeMois (stores years)
  const dureeAnnees = Number(a.dureeMois); // backend field: dureeMois (stores years)
  if (dureeAnnees <= 0) return 0;
  return year <= dureeAnnees ? a.coutTotal / dureeAnnees : 0;
}

const SKELETON_COUNT = [0, 1, 2];

// ── Component ─────────────────────────────────────────────────────────────────

export default function Emprunts() {
  // ── Emprunts (loans) ─────────────────────────────────────────────────────────
  const { data: emprunts = [], isLoading: isLoadingEmprunts } = useEmprunts();
  const createEmpruntMut = useCreateEmprunt();
  const updateEmpruntMut = useUpdateEmprunt();
  const deleteEmpruntMut = useDeleteEmprunt();

  const [empruntOpen, setEmpruntOpen] = useState(false);
  const [editingEmprunt, setEditingEmprunt] = useState<Emprunt | null>(null);
  const [empruntForm, setEmpruntForm] = useState<EmpruntFormState>(
    emptyEmpruntForm(),
  );

  // ── Investissements / Amortissements ─────────────────────────────────────────
  const { data: amortissements = [], isLoading: isLoadingAmort } =
    useAmortissements();
  const createAmortMut = useCreateAmortissement();
  const deleteAmortMut = useDeleteAmortissement();

  const [investForm, setInvestForm] = useState<InvestForm>(emptyInvestForm());

  // ── Plan de Financement — états locaux (session uniquement) ──────────────────
  const [apportPersonnelStr, setApportPersonnelStr] = useState("");
  const [fraisEtablissementStr, setFraisEtablissementStr] = useState("");

  // ── Sort states ───────────────────────────────────────────────────────────────
  const [sortKeyEmp, setSortKeyEmp] = useState<"nom" | "montant" | null>(null);
  const [sortOrderEmp, setSortOrderEmp] = useState<"asc" | "desc">("asc");
  const [sortKeyAmort, setSortKeyAmort] = useState<"nom" | "coutTotal" | null>(
    null,
  );
  const [sortOrderAmort, setSortOrderAmort] = useState<"asc" | "desc">("asc");

  // ── Loan form handlers ────────────────────────────────────────────────────────

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

  // ── Investment form handlers ───────────────────────────────────────────────────

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
        const dureeAnnees = Number.parseInt(investForm.dureeAnsStr);
        if (
          !investForm.dureeAnsStr ||
          Number.isNaN(dureeAnnees) ||
          dureeAnnees <= 0
        ) {
          toast.error("Durée d'amortissement invalide (minimum 1 an)");
          return;
        }
        // Pass dureeAnnees into dureeMois backend field (backend field: dureeMois stores years)
        await createAmortMut.mutateAsync({
          nom: investForm.nom.trim(),
          coutTotal: cout,
          dureeMois: BigInt(dureeAnnees), // backend field: dureeMois (stores years)
        });
      } else {
        // Non-amortissable: dureeMois = 0 signals no depreciation
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

  // ── Derived values ─────────────────────────────────────────────────────────────

  const isEmpruntPending =
    createEmpruntMut.isPending || updateEmpruntMut.isPending;

  const totalMensualites = emprunts.reduce(
    (s, e) => s + calcMensualiteEmprunt(e),
    0,
  );

  // Only amortissable items (dureeAnnees > 0)
  const amortissables = amortissements.filter((a) => Number(a.dureeMois) > 0);
  const nonAmortissables = amortissements.filter(
    (a) => Number(a.dureeMois) === 0,
  );

  // Per-year totals (strict 0 € after dureeAnnees)
  const totalParAnnee = YEARS_N.map((n) =>
    amortissables.reduce((sum, a) => sum + getDotationAnnuelle(a, n), 0),
  );

  // ── Sort helpers ──────────────────────────────────────────────────────────────

  function toggleSortEmp(key: "nom" | "montant") {
    if (sortKeyEmp === key) {
      setSortOrderEmp((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKeyEmp(key);
      setSortOrderEmp("asc");
    }
  }

  function toggleSortAmort(key: "nom" | "coutTotal") {
    if (sortKeyAmort === key) {
      setSortOrderAmort((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKeyAmort(key);
      setSortOrderAmort("asc");
    }
  }

  function SortIconEmp({ col }: { col: "nom" | "montant" }) {
    if (sortKeyEmp !== col)
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortOrderEmp === "asc" ? (
      <ChevronUp className="h-3 w-3 ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 ml-1" />
    );
  }

  function SortIconAmort({ col }: { col: "nom" | "coutTotal" }) {
    if (sortKeyAmort !== col)
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortOrderAmort === "asc" ? (
      <ChevronUp className="h-3 w-3 ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 ml-1" />
    );
  }

  const sortedEmprunts = [...emprunts].sort((a, b) => {
    if (!sortKeyEmp) return 0;
    const dir = sortOrderEmp === "asc" ? 1 : -1;
    if (sortKeyEmp === "nom") return a.nom.localeCompare(b.nom, "fr") * dir;
    return (a.montant - b.montant) * dir;
  });

  const sortedAmortissables = [...amortissables].sort((a, b) => {
    if (!sortKeyAmort) return 0;
    const dir = sortOrderAmort === "asc" ? 1 : -1;
    if (sortKeyAmort === "nom") return a.nom.localeCompare(b.nom, "fr") * dir;
    return (a.coutTotal - b.coutTotal) * dir;
  });

  // ── Plan de Financement — calculs dérivés ─────────────────────────────────────

  const apportPersonnel = Number.parseFloat(apportPersonnelStr) || 0;
  const fraisEtablissement = Number.parseFloat(fraisEtablissementStr) || 0;

  const totalEmprunts = emprunts.reduce((s, e) => s + e.montant, 0);
  const totalInvestissements = amortissements.reduce(
    (s, a) => s + a.coutTotal,
    0,
  );

  const totalRessources = apportPersonnel + totalEmprunts;
  const totalEmplois = totalInvestissements + fraisEtablissement;
  const solde = totalRessources - totalEmplois;
  const financement_equilivre = solde >= 0;

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* ================================================================= */}
      {/*  SECTION 0 : PLAN DE FINANCEMENT (RESSOURCES VS EMPLOIS)          */}
      {/* ================================================================= */}
      <Card className="border-2 shadow-md" data-ocid="plan-financement.section">
        <CardHeader className="pb-3 bg-muted/30 rounded-t-lg border-b">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            Plan de Financement (Ressources vs Emplois)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tableau de bord de synthèse — vérifiez que vos ressources couvrent
            vos emplois avant de valider votre dossier.
          </p>
        </CardHeader>
        <CardContent className="pt-5 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ── Ressources ── */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-emerald-700 uppercase tracking-wide flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                Ressources
              </h4>
              <div className="space-y-2 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                {/* Apport personnel */}
                <div className="flex items-center justify-between gap-3">
                  <Label
                    htmlFor="apport-personnel"
                    className="text-sm shrink-0"
                  >
                    Apport Personnel (€)
                  </Label>
                  <Input
                    id="apport-personnel"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={apportPersonnelStr}
                    onChange={(e) => setApportPersonnelStr(e.target.value)}
                    className="max-w-[160px] text-right"
                    data-ocid="plan-financement.apport_input"
                  />
                </div>
                {/* Total emprunts (auto) */}
                <div className="flex items-center justify-between gap-3 py-1">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    Total des Emprunts (€)
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                      auto
                    </span>
                  </span>
                  <span className="text-sm font-medium tabular-nums">
                    {fmtEur(totalEmprunts)}
                  </span>
                </div>
                <Separator className="bg-emerald-200" />
                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-sm font-bold text-emerald-800">
                    Total Ressources (€)
                  </span>
                  <span className="text-lg font-black text-emerald-800 tabular-nums">
                    {fmtEur(totalRessources)}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Emplois ── */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-rose-700 uppercase tracking-wide flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-rose-500" />
                Emplois
              </h4>
              <div className="space-y-2 rounded-lg border border-rose-100 bg-rose-50/50 p-3">
                {/* Total investissements (auto) */}
                <div className="flex items-center justify-between gap-3 py-1">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    Total des Investissements (€)
                    <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-medium">
                      auto
                    </span>
                  </span>
                  <span className="text-sm font-medium tabular-nums">
                    {fmtEur(totalInvestissements)}
                  </span>
                </div>
                {/* Frais d'établissement */}
                <div className="flex items-center justify-between gap-3">
                  <Label
                    htmlFor="frais-etablissement"
                    className="text-sm shrink-0"
                  >
                    Frais d&apos;établissement / Trésorerie de départ (€)
                  </Label>
                  <Input
                    id="frais-etablissement"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={fraisEtablissementStr}
                    onChange={(e) => setFraisEtablissementStr(e.target.value)}
                    className="max-w-[160px] text-right"
                    data-ocid="plan-financement.frais_input"
                  />
                </div>
                <Separator className="bg-rose-200" />
                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-sm font-bold text-rose-800">
                    Total Emplois (€)
                  </span>
                  <span className="text-lg font-black text-rose-800 tabular-nums">
                    {fmtEur(totalEmplois)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Indicateur visuel ── */}
          <div
            className={`flex items-center justify-between gap-4 rounded-xl border-2 px-5 py-4 ${
              financement_equilivre
                ? "border-emerald-400 bg-emerald-50"
                : "border-rose-400 bg-rose-50"
            }`}
            data-ocid="plan-financement.indicator"
          >
            <div className="flex items-center gap-3">
              {financement_equilivre ? (
                <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="h-8 w-8 text-rose-600 shrink-0" />
              )}
              <div>
                <p
                  className={`text-base font-bold ${
                    financement_equilivre ? "text-emerald-800" : "text-rose-800"
                  }`}
                >
                  {financement_equilivre
                    ? "✓ Financement équilibré"
                    : "⚠ Déficit de financement"}
                </p>
                <p
                  className={`text-xs mt-0.5 ${
                    financement_equilivre ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {financement_equilivre
                    ? "Vos ressources couvrent l'intégralité de vos emplois."
                    : "Vos ressources sont insuffisantes pour financer vos emplois."}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p
                className={`text-xs font-medium uppercase tracking-wide ${
                  financement_equilivre ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {financement_equilivre ? "Excédent" : "Déficit"}
              </p>
              <p
                className={`text-2xl font-black tabular-nums ${
                  financement_equilivre ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {fmtEur(Math.abs(solde))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
          <>
            {/* Sort controls */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Trier par :</span>
              <button
                type="button"
                onClick={() => toggleSortEmp("nom")}
                className="flex items-center gap-0.5 px-2 py-1 rounded border hover:bg-muted/50 cursor-pointer transition-colors"
                data-ocid="emprunts.sort_nom"
              >
                Nom <SortIconEmp col="nom" />
              </button>
              <button
                type="button"
                onClick={() => toggleSortEmp("montant")}
                className="flex items-center gap-0.5 px-2 py-1 rounded border hover:bg-muted/50 cursor-pointer transition-colors"
                data-ocid="emprunts.sort_montant"
              >
                Montant <SortIconEmp col="montant" />
              </button>
            </div>
            <Accordion type="multiple" className="space-y-3">
              {sortedEmprunts.map((e, idx) => {
                const lignes = calcAmortissementPret(e);
                const totalInterets = lignes.reduce(
                  (s, l) => s + l.interets,
                  0,
                );
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
                                    lignes.reduce(
                                      (s, l) => s + l.mensualite,
                                      0,
                                    ),
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
          </>
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
          choisie (0 € après).
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
                      <TableHead
                        className="text-white font-semibold min-w-[180px] cursor-pointer select-none"
                        onClick={() => toggleSortAmort("nom")}
                        data-ocid="investissements.sort_nom"
                      >
                        <span className="flex items-center">
                          Désignation <SortIconAmort col="nom" />
                        </span>
                      </TableHead>
                      <TableHead
                        className="text-white font-semibold text-right cursor-pointer select-none"
                        onClick={() => toggleSortAmort("coutTotal")}
                        data-ocid="investissements.sort_cout"
                      >
                        <span className="flex items-center justify-end">
                          Coût total <SortIconAmort col="coutTotal" />
                        </span>
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
                    {sortedAmortissables.map((a, idx) => {
                      // dureeAnnees — backend field: dureeMois (stores years)
                      const dureeAnnees = Number(a.dureeMois);
                      const dotationAnnuelle = a.coutTotal / dureeAnnees;
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
                            {dureeAnnees} an{dureeAnnees > 1 ? "s" : ""}
                          </TableCell>
                          {YEARS_N.map((n) => {
                            const active = n <= dureeAnnees;
                            return (
                              <TableCell
                                key={n}
                                className={`text-right text-sm ${
                                  active
                                    ? "font-medium text-blue-700"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {active ? fmtEur(dotationAnnuelle) : fmtEur(0)}
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

            {/* Durée — visible uniquement si amortissable */}
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
                  data-ocid="investissements.duree_input"
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
