import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  useAssociesGerants,
  useEmprunts,
  useFraisFixes,
  useIngredients,
  useMouvementsStock,
  useSalaries,
  useSaveFraisFixes,
} from "@/hooks/useQueries";
import type { LigneFraisFixes } from "@/hooks/useQueries";
import { fmtEur } from "@/utils/format";
import { Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const LIGNES_DEFAUT = [
  "Location/aménagement",
  "Licences/Assurances",
  "Énergie/eau",
  "Communication/marketing",
  "Animation/musique",
  "Salaire/cotisations",
  "Emprunt",
  "Stock boissons/nourritures",
];

// Comparaison flexible : gère les variantes de noms stockés en base
// (ex: "Stock boissons / nourritures" vs "Stock boissons/nourritures")
function normNom(s: string) {
  return s.toLowerCase().replace(/[\s/]/g, "");
}
function isStockRow(nom: string) {
  return normNom(nom).startsWith("stockboissons");
}
function isEmpruntRow(nom: string) {
  return normNom(nom) === "emprunt";
}
function isSalaireRow(nom: string) {
  return normNom(nom).startsWith("salaire");
}

const SKELETON_ROWS = [0, 1, 2, 3, 4, 5, 6, 7];
const SKELETON_COLS = [0, 1, 2, 3];

function calcMensualite(
  montant: number,
  tauxAnnuel: number,
  dureeMois: number,
): number {
  if (dureeMois <= 0 || montant <= 0) return 0;
  if (tauxAnnuel === 0) return montant / dureeMois;
  const tauxMensuel = tauxAnnuel / 100 / 12;
  return (montant * tauxMensuel) / (1 - (1 + tauxMensuel) ** -dureeMois);
}

function coutAssocieAnnuel(remu: number, statut: string): number {
  if (statut === "TNS") return remu * 1.45;
  return remu * 1.42;
}

export default function FraisFixes() {
  const { data: saved = [], isLoading } = useFraisFixes();
  const { data: emprunts = [] } = useEmprunts();
  const { data: associes = [] } = useAssociesGerants();
  const { data: salariesData = [] } = useSalaries();
  const { data: mouvements = [] } = useMouvementsStock();
  const { data: ingredients = [] } = useIngredients();
  const { data: amortissements = [] } = useAmortissements();
  const saveMut = useSaveFraisFixes();

  const [lignes, setLignes] = useState<LigneFraisFixes[]>([]);
  const [selectedYM, setSelectedYM] = useState(
    () => new Date().toISOString().slice(0, 7), // "YYYY-MM"
  );

  // Initialiser lignes
  useEffect(() => {
    if (saved.length > 0) {
      setLignes(saved);
    } else {
      setLignes(
        LIGNES_DEFAUT.map((nom) => ({
          nom,
          montantMensuelAvecRemu: 0,
          montantMensuelHorsRemu: 0,
        })),
      );
    }
  }, [saved]);

  // Auto : Emprunt
  useEffect(() => {
    if (emprunts.length === 0) return;
    const totalMensuelEmprunts = emprunts.reduce(
      (sum, e) =>
        sum + calcMensualite(e.montant, e.tauxAnnuel, Number(e.dureeMois)),
      0,
    );
    setLignes((prev) =>
      prev.map((l) =>
        isEmpruntRow(l.nom)
          ? {
              ...l,
              montantMensuelAvecRemu: totalMensuelEmprunts,
              montantMensuelHorsRemu: totalMensuelEmprunts,
            }
          : l,
      ),
    );
  }, [emprunts]);

  // Auto : Salaires/Cotisations
  useEffect(() => {
    const totalAnnuelAssocies = associes.reduce(
      (s, a) => s + coutAssocieAnnuel(a.remunerationAnnuelle, a.statut),
      0,
    );
    const totalAnnuelSalaries = salariesData.reduce(
      (s, sal) => s + sal.salaireAnnuelBrut * 1.42,
      0,
    );
    const totalMensuel = (totalAnnuelAssocies + totalAnnuelSalaries) / 12;
    if (totalMensuel === 0) return;
    setLignes((prev) =>
      prev.map((l) =>
        isSalaireRow(l.nom)
          ? {
              ...l,
              montantMensuelAvecRemu: totalMensuel,
              montantMensuelHorsRemu: totalMensuel,
            }
          : l,
      ),
    );
  }, [associes, salariesData]);

  // Auto : Stock boissons/nourritures = Σ(entrée.quantite × ing.prixUnitaireHT) pour le mois sélectionné
  const ingMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const ing of ingredients) m.set(ing.id, ing.prixUnitaireHT);
    return m;
  }, [ingredients]);

  useEffect(() => {
    const stockMensuel = mouvements
      .filter((m) => m.typeOp === "Sortie" && m.date.startsWith(selectedYM))
      .reduce((sum, m) => {
        const prix = ingMap.get(m.ingredientId) ?? 0;
        return sum + m.quantite * prix;
      }, 0);
    setLignes((prev) =>
      prev.map((l) =>
        isStockRow(l.nom)
          ? {
              ...l,
              montantMensuelAvecRemu: stockMensuel,
              montantMensuelHorsRemu: stockMensuel,
            }
          : l,
      ),
    );
  }, [mouvements, ingMap, selectedYM]);

  // Amortissements mensuel (Année 1)
  // dureeMois field now stores YEARS — monthly = (coutTotal / dureeAns) / 12
  const totalAmortMensuel = useMemo(() => {
    return amortissements.reduce((sum, a) => {
      const dureeAns = Number(a.dureeMois);
      if (dureeAns <= 0) return sum;
      return sum + a.coutTotal / dureeAns / 12;
    }, 0);
  }, [amortissements]);

  function updateLigne(
    idx: number,
    field: keyof LigneFraisFixes,
    value: number,
  ) {
    setLignes((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)),
    );
  }

  const totalAvec =
    lignes.reduce((s, l) => s + l.montantMensuelAvecRemu, 0) +
    totalAmortMensuel;

  async function handleSave() {
    console.log(
      "[FraisFixes] handleSave called, lignes:",
      JSON.stringify(lignes),
    );
    // Maintain backend compatibility: send montantMensuelHorsRemu = montantMensuelAvecRemu
    const lignesCompat = lignes.map((l) => ({
      ...l,
      montantMensuelHorsRemu: l.montantMensuelAvecRemu,
    }));
    try {
      await saveMut.mutateAsync(lignesCompat);
      toast.success("Frais fixes sauvegardés");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[handleSave] error:", e);
      toast.error(`Erreur lors de la sauvegarde : ${msg}`);
    }
  }

  function isAutoRow(nom: string) {
    return isEmpruntRow(nom) || isSalaireRow(nom) || isStockRow(nom);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Frais Fixes</h2>
          <p className="text-sm text-muted-foreground">
            Charges mensuelles fixes de l&apos;établissement
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saveMut.isPending}
          data-ocid="frais.save_button"
        >
          <Save className="mr-2 h-4 w-4" />
          {saveMut.isPending ? "Sauvegarde..." : "Sauvegarder"}
        </Button>
      </div>

      {/* ── Tableau frais ───────────────────────────────────────── */}
      <div className="rounded-lg border bg-card shadow-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="min-w-[220px]">Poste</TableHead>
              <TableHead className="text-right min-w-[180px]">
                Frais fixe/mois
                <br />
                <span className="text-xs font-normal text-muted-foreground">
                  € / mois
                </span>
              </TableHead>
              <TableHead className="text-right min-w-[120px]">
                → Hebdo
              </TableHead>
              <TableHead className="text-right min-w-[120px]">
                → Journalier
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? SKELETON_ROWS.map((row) => (
                  <TableRow key={row}>
                    {SKELETON_COLS.map((col) => (
                      <TableCell key={col}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : lignes.map((l, idx) => {
                  const auto = isAutoRow(l.nom);
                  const isStock = isStockRow(l.nom);
                  return (
                    <TableRow key={l.nom} data-ocid={`frais.item.${idx + 1}`}>
                      <TableCell className="font-medium text-sm">
                        {l.nom}
                        {auto && (
                          <span className="ml-1 text-xs text-primary font-normal">
                            (auto)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={l.montantMensuelAvecRemu}
                            onChange={(e) =>
                              updateLigne(
                                idx,
                                "montantMensuelAvecRemu",
                                Number.parseFloat(e.target.value) || 0,
                              )
                            }
                            className="w-28 ml-auto text-right h-8"
                            readOnly={auto}
                            disabled={auto}
                            data-ocid={`frais.input.${idx + 1}`}
                          />
                          {isStock && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                Période :
                              </span>
                              <Input
                                type="month"
                                value={selectedYM}
                                onChange={(e) => setSelectedYM(e.target.value)}
                                className="w-36 h-7 text-xs"
                                data-ocid="frais.stock.select"
                              />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {fmtEur(l.montantMensuelAvecRemu / 4.33)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {fmtEur(l.montantMensuelAvecRemu / 30.5)}
                      </TableCell>
                    </TableRow>
                  );
                })}
            {/* Ligne amortissements auto (Année 1 mensuel = dotation annuelle / 12) */}
            {!isLoading && totalAmortMensuel > 0 && (
              <TableRow className="bg-blue-50/50">
                <TableCell className="font-medium text-sm">
                  Amortissements matériel
                  <span className="ml-1 text-xs text-primary font-normal">
                    (auto)
                  </span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    — géré dans Investissements &amp; Emprunts
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {fmtEur(totalAmortMensuel)}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {fmtEur(totalAmortMensuel / 4.33)}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {fmtEur(totalAmortMensuel / 30.5)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {!isLoading && (
            <tfoot>
              <TableRow className="bg-muted/40 font-semibold border-t-2">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right">
                  {fmtEur(totalAvec)}
                </TableCell>
                <TableCell className="text-right">
                  {fmtEur(totalAvec / 4.33)}
                </TableCell>
                <TableCell className="text-right">
                  {fmtEur(totalAvec / 30.5)}
                </TableCell>
              </TableRow>
            </tfoot>
          )}
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        <strong>Emprunt</strong> : total des mensualités calculées depuis
        l&apos;onglet Investissements &amp; Emprunts.{" "}
        <strong>Salaire/cotisations</strong> : coût employeur total mensuel
        depuis l&apos;onglet Salaires.{" "}
        <strong>Stock boissons/nourritures</strong> : somme des sorties de stock
        (quantité × prix HT) enregistrées pour le mois sélectionné.{" "}
        <strong>Amortissements</strong> : dotation annuelle ÷ 12 — géré dans
        l&apos;onglet Investissements &amp; Emprunts.
      </p>
    </div>
  );
}
