import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  useIngredients,
  useParametres,
  useRecettes,
  useSaveParametres,
} from "@/hooks/useQueries";
import type {
  Ingredient,
  ParametresRentabilite,
  Recette,
  RecetteIngredient,
} from "@/hooks/useQueries";
import { ArrowRight, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(n: number): string {
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function calculerCoutMatiere(
  recette: Recette,
  ingredientsMap: Map<string, Ingredient>,
): number {
  const coutIngs = recette.ingredients.reduce(
    (sum: number, li: RecetteIngredient) => {
      const ing = ingredientsMap.get(li.ingredientId);
      const prix = ing ? ing.prixUnitaireHT : 0;
      return sum + prix * li.quantite;
    },
    0,
  );
  return coutIngs + recette.consommablesHT;
}

function getPrixHT(recette: Recette): number {
  const tva = recette.tauxTVA ?? 10;
  return recette.prixVenteTTC / (1 + tva / 100);
}

// ── Ligne calculée ────────────────────────────────────────────────────────────

interface LigneCalculee {
  recette: Recette;
  prixHT: number;
  coutMatiere: number;
  volume: number;
  caEstimeTTC: number;
  caEstimeHT: number;
  margeBrute: number;
}

// ── Composant principal ───────────────────────────────────────────────────────

const SKELETON_ROWS = [0, 1, 2, 3];

export default function PilotageEntreprise() {
  const { data: recettes = [], isLoading: loadingRecettes } = useRecettes();
  const { data: ingredients = [], isLoading: loadingIngredients } =
    useIngredients();
  const { data: parametres } = useParametres();
  const saveParametres = useSaveParametres();

  const [volumes, setVolumes] = useState<Record<string, number>>({});

  // Map ingrédients par ID pour lookup O(1)
  const ingredientsMap = useMemo(() => {
    const m = new Map<string, Ingredient>();
    for (const ing of ingredients) m.set(ing.id, ing);
    return m;
  }, [ingredients]);

  // Lignes calculées — dérivées, pas de state
  const lignes: LigneCalculee[] = useMemo(() => {
    return recettes.map((r) => {
      const volume = volumes[r.id] ?? 0;
      const prixHT = getPrixHT(r);
      const coutMatiere = calculerCoutMatiere(r, ingredientsMap);
      return {
        recette: r,
        prixHT,
        coutMatiere,
        volume,
        caEstimeTTC: r.prixVenteTTC * volume,
        caEstimeHT: prixHT * volume,
        margeBrute: (prixHT - coutMatiere) * volume,
      };
    });
  }, [recettes, ingredientsMap, volumes]);

  // Totaux consolidés
  const totaux = useMemo(() => {
    return lignes.reduce(
      (acc, l) => ({
        volumeTotal: acc.volumeTotal + l.volume,
        caTotalTTC: acc.caTotalTTC + l.caEstimeTTC,
        caTotalHT: acc.caTotalHT + l.caEstimeHT,
        coutMatiereTotal: acc.coutMatiereTotal + l.coutMatiere * l.volume,
        margeBruteTotal: acc.margeBruteTotal + l.margeBrute,
      }),
      {
        volumeTotal: 0,
        caTotalTTC: 0,
        caTotalHT: 0,
        coutMatiereTotal: 0,
        margeBruteTotal: 0,
      },
    );
  }, [lignes]);

  function handleVolumeChange(recetteId: string, value: string) {
    const parsed = Math.max(0, Number.parseInt(value, 10) || 0);
    setVolumes((prev) => ({ ...prev, [recetteId]: parsed }));
  }

  async function handleAppliquer() {
    if (totaux.volumeTotal === 0) return;

    const ticketMoyenHT = totaux.caTotalHT / totaux.volumeTotal;
    const foodCostGlobal =
      totaux.caTotalHT > 0
        ? (totaux.coutMatiereTotal / totaux.caTotalHT) * 100
        : 0;

    // Construire les nouveaux paramètres en conservant les valeurs existantes
    const current: ParametresRentabilite = parametres ?? {
      ticketMoyenHT: 0,
      nbClientsParSemaine: 0,
      nbSemainesSaison: 0,
      tauxFoodCostParCategorie: [],
    };

    // Mettre à jour ou créer l'entrée "Global" dans tauxFoodCostParCategorie
    const tauxExistants = current.tauxFoodCostParCategorie ?? [];
    const hasGlobal = tauxExistants.some(([cat]) => cat === "Global");
    const nouveauxTaux: [string, number][] = hasGlobal
      ? tauxExistants.map(([cat, taux]) =>
          cat === "Global" ? [cat, foodCostGlobal] : [cat, taux],
        )
      : ([
          [...tauxExistants] as [string, number][],
          [["Global", foodCostGlobal]],
        ].flat() as [string, number][]);

    const payload: ParametresRentabilite = {
      ...current,
      ticketMoyenHT,
      tauxFoodCostParCategorie: nouveauxTaux,
    };

    try {
      await saveParametres.mutateAsync(payload);
      toast.success(
        `Prévisionnel mis à jour ! Ticket moyen HT : ${fmtEur(ticketMoyenHT)} € — Food cost : ${fmtEur(foodCostGlobal)} %`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erreur lors de la mise à jour : ${msg}`);
    }
  }

  const isLoading = loadingRecettes || loadingIngredients;
  const tauxFoodCostGlobal =
    totaux.caTotalHT > 0
      ? (totaux.coutMatiereTotal / totaux.caTotalHT) * 100
      : 0;
  const ticketMoyenCalc =
    totaux.volumeTotal > 0 ? totaux.caTotalHT / totaux.volumeTotal : 0;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Pilotage Entreprise</h2>
          <p className="text-sm text-muted-foreground">
            Liaison recettes réelles / prévisionnel — estimez vos volumes de
            vente mensuels
          </p>
        </div>
        <Button
          onClick={handleAppliquer}
          disabled={totaux.volumeTotal === 0 || saveParametres.isPending}
          className="bg-primary hover:bg-primary/90"
          data-ocid="pilotage-entreprise.appliquer_button"
        >
          <ArrowRight className="mr-2 h-4 w-4" />
          {saveParametres.isPending
            ? "Mise à jour..."
            : "Appliquer au Prévisionnel"}
        </Button>
      </div>

      {/* Tableau principal */}
      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="min-w-[180px]">Recette</TableHead>
              <TableHead className="text-right min-w-[110px]">
                Prix TTC (€)
              </TableHead>
              <TableHead className="text-right min-w-[110px]">
                Prix HT (€)
              </TableHead>
              <TableHead className="text-right min-w-[120px]">
                Coût Matière (€)
              </TableHead>
              <TableHead className="text-right min-w-[170px]">
                Volume estimé / mois
              </TableHead>
              <TableHead className="text-right min-w-[120px]">
                CA Estimé TTC (€)
              </TableHead>
              <TableHead className="text-right min-w-[120px]">
                Marge Brute (€)
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              SKELETON_ROWS.map((row) => (
                <TableRow key={row}>
                  {[0, 1, 2, 3, 4, 5, 6].map((col) => (
                    <TableCell key={col}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : recettes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-10"
                  data-ocid="pilotage-entreprise.empty_state"
                >
                  Aucune recette créée. Allez dans l&apos;onglet{" "}
                  <strong>Recettes</strong> pour commencer.
                </TableCell>
              </TableRow>
            ) : (
              lignes.map((l, idx) => (
                <TableRow
                  key={l.recette.id}
                  data-ocid={`pilotage-entreprise.item.${idx + 1}`}
                >
                  <TableCell className="font-medium">
                    {l.recette.nom}
                    <Badge
                      variant="secondary"
                      className="ml-2 text-xs hidden sm:inline-flex"
                    >
                      {l.recette.categorie}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {fmtEur(l.recette.prixVenteTTC)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {fmtEur(l.prixHT)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {fmtEur(l.coutMatiere)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={volumes[l.recette.id] ?? 0}
                      onChange={(e) =>
                        handleVolumeChange(l.recette.id, e.target.value)
                      }
                      className="w-24 ml-auto text-right h-8"
                      data-ocid={`pilotage-entreprise.volume.${idx + 1}`}
                    />
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium text-primary">
                    {fmtEur(l.caEstimeTTC)}
                  </TableCell>
                  <TableCell
                    className={`text-right text-sm font-medium ${
                      l.margeBrute >= 0 ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    {fmtEur(l.margeBrute)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Totaux consolidés */}
      {!isLoading && recettes.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-primary flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Totaux Consolidés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  Volumes totaux / mois
                </p>
                <p className="text-lg font-bold">{totaux.volumeTotal}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">CA Total TTC</p>
                <p className="text-lg font-bold text-primary">
                  {fmtEur(totaux.caTotalTTC)} €
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">CA Total HT</p>
                <p className="text-lg font-bold">
                  {fmtEur(totaux.caTotalHT)} €
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  Coût Matière Total
                </p>
                <p className="text-lg font-bold text-amber-700">
                  {fmtEur(totaux.coutMatiereTotal)} €
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  Marge Brute Totale
                </p>
                <p
                  className={`text-lg font-bold ${
                    totaux.margeBruteTotal >= 0
                      ? "text-green-700"
                      : "text-red-600"
                  }`}
                >
                  {fmtEur(totaux.margeBruteTotal)} €
                </p>
              </div>
            </div>

            {/* Indicateurs calculés */}
            {totaux.volumeTotal > 0 && (
              <div className="mt-4 pt-4 border-t border-primary/20 grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-background border space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Ticket moyen HT (calculé)
                  </p>
                  <p className="text-xl font-bold text-primary">
                    {fmtEur(ticketMoyenCalc)} €
                  </p>
                  <p className="text-xs text-muted-foreground">
                    = CA HT total / Σ volumes
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-background border space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Taux Food Cost global (calculé)
                  </p>
                  <p
                    className={`text-xl font-bold ${
                      tauxFoodCostGlobal <= 30
                        ? "text-green-700"
                        : tauxFoodCostGlobal <= 45
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                  >
                    {fmtEur(tauxFoodCostGlobal)} %
                  </p>
                  <p className="text-xs text-muted-foreground">
                    = (Coût matière / CA HT) × 100
                  </p>
                </div>
              </div>
            )}

            {totaux.volumeTotal > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary">
                <strong>Cliquez sur "Appliquer au Prévisionnel"</strong> pour
                transférer le ticket moyen HT ({fmtEur(ticketMoyenCalc)} €) et
                le taux food cost global ({fmtEur(tauxFoodCostGlobal)} %) dans
                l&apos;onglet Pilotage.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
