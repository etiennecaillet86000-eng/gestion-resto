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
  useCreateMouvement,
  useCreateVente,
  useDeleteVente,
  useIngredients,
  useRecettes,
  useVentesRecettes,
} from "@/hooks/useQueries";
import type { Recette, VenteRecette } from "@/hooks/useQueries";
import {
  CalendarDays,
  Euro,
  Loader2,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Users,
  Utensils,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const fmtPct = (n: number) =>
  n.toLocaleString("fr-FR", { style: "percent", maximumFractionDigits: 1 });

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function coutMatiereRecette(
  recette: Recette,
  ingredients: { id: string; prixUnitaireHT: number }[],
) {
  const ingMap = new Map(ingredients.map((i) => [i.id, i.prixUnitaireHT]));
  const coutIng = recette.ingredients.reduce((sum, ri) => {
    const prix = ingMap.get(ri.ingredientId) ?? 0;
    return sum + prix * ri.quantite;
  }, 0);
  return coutIng + recette.consommablesHT;
}

const SKELETON_IDS = ["sk1", "sk2", "sk3", "sk4"];

export default function VentesDuJour() {
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const { data: recettes = [], isLoading: loadingR } = useRecettes();
  const { data: ingredients = [], isLoading: loadingI } = useIngredients();
  const { data: allVentes = [], isLoading: loadingV } = useVentesRecettes();
  const createVente = useCreateVente();
  const createMouvement = useCreateMouvement();
  const deleteVente = useDeleteVente();

  const isLoading = loadingR || loadingI || loadingV;

  const ventesDuJour = allVentes.filter((v) => v.date === selectedDate);
  const recetteMap = new Map<string, Recette>(recettes.map((r) => [r.id, r]));

  const stats = ventesDuJour.reduce(
    (acc, v) => {
      const r = recetteMap.get(v.recetteId);
      if (!r) return acc;
      const caHT = (r.prixVenteTTC / (1 + r.tauxTVA / 100)) * v.quantite;
      const caTTC = r.prixVenteTTC * v.quantite;
      const cout = coutMatiereRecette(r, ingredients) * v.quantite;
      return {
        caTTC: acc.caTTC + caTTC,
        caHT: acc.caHT + caHT,
        cout: acc.cout + cout,
        couverts: acc.couverts + v.quantite,
      };
    },
    { caTTC: 0, caHT: 0, cout: 0, couverts: 0 },
  );

  const marge = stats.caHT - stats.cout;
  const tauxMarge = stats.caHT > 0 ? marge / stats.caHT : 0;

  async function handleEnregistrer() {
    console.log(
      "[VentesDuJour] handleEnregistrer called, quantities:",
      JSON.stringify(quantities),
    );
    const lignes = Object.entries(quantities).filter(([, q]) => q > 0);
    if (lignes.length === 0) {
      toast.error("Aucune quantité saisie");
      return;
    }
    setSaving(true);
    try {
      const tasks: Promise<unknown>[] = [];
      for (const [recetteId, quantite] of lignes) {
        const recette = recetteMap.get(recetteId);
        if (!recette) continue;
        tasks.push(
          createVente.mutateAsync({ recetteId, date: selectedDate, quantite }),
        );
        for (const ri of recette.ingredients) {
          tasks.push(
            createMouvement.mutateAsync({
              ingredientId: ri.ingredientId,
              date: selectedDate,
              typeOp: "Sortie",
              quantite: ri.quantite * quantite,
              motif: `Vente - ${recette.nom}`,
            }),
          );
        }
      }
      await Promise.all(tasks);
      setQuantities({});
      toast.success("Service enregistré avec succès");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[handleEnregistrer] error:", e);
      toast.error(`Erreur lors de l'enregistrement : ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteVente(id: string) {
    try {
      await deleteVente.mutateAsync(id);
      toast.success("Vente supprimée");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[handleDelete] error:", e);
      toast.error(`Erreur lors de la suppression : ${msg}`);
    }
  }

  return (
    <div className="space-y-6" data-ocid="ventes.page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" />
            Ventes du jour
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Saisissez les ventes du service et mettez à jour le stock
            automatiquement
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-40"
            data-ocid="ventes.input"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          SKELETON_IDS.map((sk) => (
            <Skeleton key={sk} className="h-24 rounded-xl" />
          ))
        ) : (
          <>
            <Card className="border-l-4 border-l-primary">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Euro className="h-3.5 w-3.5" /> CA TTC
                </div>
                <p className="text-xl font-bold text-foreground">
                  {fmt(stats.caTTC)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Utensils className="h-3.5 w-3.5" /> Coût matière
                </div>
                <p className="text-xl font-bold text-foreground">
                  {fmt(stats.cout)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingUp className="h-3.5 w-3.5" /> Marge brute
                </div>
                <p className="text-xl font-bold text-foreground">
                  {fmt(marge)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    ({fmtPct(tauxMarge)})
                  </span>
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Users className="h-3.5 w-3.5" /> Couverts
                </div>
                <p className="text-xl font-bold text-foreground">
                  {stats.couverts}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Saisie du service */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saisie du service</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2" data-ocid="ventes.loading_state">
              {SKELETON_IDS.map((sk) => (
                <Skeleton key={sk} className="h-10 w-full" />
              ))}
            </div>
          ) : recettes.length === 0 ? (
            <div
              className="text-center py-8 text-muted-foreground"
              data-ocid="ventes.empty_state"
            >
              <Utensils className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">
                Aucune recette disponible — ajoutez des recettes d'abord
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recette</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-right">Prix TTC</TableHead>
                    <TableHead className="text-right">Coût mat.</TableHead>
                    <TableHead className="w-32 text-right">
                      Qté vendue
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recettes.map((r, i) => {
                    const cout = coutMatiereRecette(r, ingredients);
                    return (
                      <TableRow key={r.id} data-ocid={`ventes.row.${i + 1}`}>
                        <TableCell className="font-medium">{r.nom}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{r.categorie}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(r.prixVenteTTC)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {fmt(cout)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={quantities[r.id] ?? ""}
                            onChange={(e) => {
                              const v = Math.max(
                                0,
                                Math.floor(Number(e.target.value) || 0),
                              );
                              setQuantities((prev) => ({ ...prev, [r.id]: v }));
                            }}
                            className="w-24 text-right ml-auto"
                            placeholder="0"
                            data-ocid={`ventes.input.${i + 1}`}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleEnregistrer}
                  disabled={saving}
                  data-ocid="ventes.submit_button"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enregistrement…
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Enregistrer le service
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Détail ventes enregistrées */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Détail des ventes enregistrées
            {ventesDuJour.length > 0 && (
              <Badge className="ml-2" variant="secondary">
                {ventesDuJour.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : ventesDuJour.length === 0 ? (
            <div
              className="text-center py-8 text-muted-foreground"
              data-ocid="ventes.detail.empty_state"
            >
              <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">
                Aucune vente enregistrée pour cette date
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recette</TableHead>
                  <TableHead className="text-right">Quantité</TableHead>
                  <TableHead className="text-right">CA TTC</TableHead>
                  <TableHead className="text-right">Coût mat.</TableHead>
                  <TableHead className="text-right">Marge</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventesDuJour.map((v: VenteRecette, i: number) => {
                  const r = recetteMap.get(v.recetteId);
                  if (!r) return null;
                  const caHT =
                    (r.prixVenteTTC / (1 + r.tauxTVA / 100)) * v.quantite;
                  const caTTC = r.prixVenteTTC * v.quantite;
                  const cout = coutMatiereRecette(r, ingredients) * v.quantite;
                  const mg = caHT - cout;
                  return (
                    <TableRow
                      key={v.id}
                      data-ocid={`ventes.detail.item.${i + 1}`}
                    >
                      <TableCell className="font-medium">{r.nom}</TableCell>
                      <TableCell className="text-right">{v.quantite}</TableCell>
                      <TableCell className="text-right">{fmt(caTTC)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {fmt(cout)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            mg >= 0 ? "text-green-600" : "text-red-500"
                          }
                        >
                          {fmt(mg)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteVente(v.id)}
                          className="text-muted-foreground hover:text-destructive"
                          data-ocid={`ventes.delete_button.${i + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
