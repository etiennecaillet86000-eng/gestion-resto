import {
  NumericInput,
  parseNumber,
  validateNumber,
} from "@/components/NumericInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  useDeleteMouvement,
  useIngredients,
  useMouvementsStock,
  useRecettes,
  useUpdateIngredient,
  useVentesRecettes,
} from "@/hooks/useQueries";
import type { Ingredient } from "@/hooks/useQueries";
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const SKELETON_ING = [0, 1, 2, 3, 4];
const SKELETON_COLS_THEO = [0, 1, 2, 3, 4, 5, 6];
const SKELETON_MVT = [0, 1, 2];
const SKELETON_COLS_MVT = [0, 1, 2, 3, 4, 5];

type ConfigState = Record<string, { stockStr: string; seuilStr: string }>;

/** Normalise un typeOp en minuscules sans accents pour comparer */
function normaliseTypeOp(typeOp: string): string {
  return typeOp
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function isEntree(typeOp: string): boolean {
  const n = normaliseTypeOp(typeOp);
  return n === "entree" || n === "entrée" || n.startsWith("entr");
}

function isSortieOuPerte(typeOp: string): boolean {
  const n = normaliseTypeOp(typeOp);
  return (
    n === "sortie" ||
    n === "perte" ||
    n.startsWith("sort") ||
    n.startsWith("pert")
  );
}

export default function Stock() {
  const { data: ingredients = [], isLoading: loadingIng } = useIngredients();
  const { data: mouvements = [], isLoading: loadingMvt } = useMouvementsStock();
  const { data: recettes = [] } = useRecettes();
  const { data: ventes = [] } = useVentesRecettes();
  const createMvt = useCreateMouvement();
  const deleteMvt = useDeleteMouvement();
  const updateIng = useUpdateIngredient();

  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    ingredientId: "",
    date: today,
    typeOp: "Entrée",
    quantiteStr: "",
    motif: "",
  });

  const [configState, setConfigState] = useState<ConfigState>({});
  const [sortKey, setSortKey] = useState<
    "nom" | "stockInitial" | "stockActuel" | null
  >(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  function handleSort(key: "nom" | "stockInitial" | "stockActuel") {
    if (sortKey === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  }

  function SortIcon({ col }: { col: "nom" | "stockInitial" | "stockActuel" }) {
    if (sortKey !== col)
      return <ArrowUpDown className="ml-1 h-3.5 w-3.5 inline opacity-50" />;
    return sortOrder === "asc" ? (
      <ChevronUp className="ml-1 h-3.5 w-3.5 inline" />
    ) : (
      <ChevronDown className="ml-1 h-3.5 w-3.5 inline" />
    );
  }

  useEffect(() => {
    setConfigState((prev) => {
      const next: ConfigState = {};
      for (const ing of ingredients) {
        if (!prev[ing.id]) {
          next[ing.id] = {
            stockStr: ing.stockInitial === 0 ? "" : String(ing.stockInitial),
            seuilStr: ing.seuilSecurite === 0 ? "" : String(ing.seuilSecurite),
          };
        } else {
          next[ing.id] = prev[ing.id];
        }
      }
      return next;
    });
  }, [ingredients]);

  /**
   * Calcul du Stock Théorique pour chaque ingrédient.
   * Retourne une Map<ingredientId, { stockInitial, entrees, sortiesManuel, consommationVentes, stockActuel }>
   */
  const stockTheorique = useMemo(() => {
    type StockCalc = {
      stockInitial: number;
      entrees: number;
      sortiesManuel: number;
      consommationVentes: number;
      stockActuel: number;
    };
    const map = new Map<string, StockCalc>();

    // Initialise chaque ingrédient
    for (const ing of ingredients) {
      map.set(ing.id, {
        stockInitial: ing.stockInitial,
        entrees: 0,
        sortiesManuel: 0,
        consommationVentes: 0,
        stockActuel: 0,
      });
    }

    // Entrées et sorties manuelles depuis les mouvements
    for (const m of mouvements) {
      const entry = map.get(m.ingredientId);
      if (!entry) continue;
      if (isEntree(m.typeOp)) {
        entry.entrees += m.quantite;
      } else if (isSortieOuPerte(m.typeOp)) {
        entry.sortiesManuel += m.quantite;
      }
    }

    // Consommation automatique via les ventes de recettes
    for (const vente of ventes) {
      const recette = recettes.find((r) => r.id === vente.recetteId);
      if (!recette) continue;
      for (const ligneRecette of recette.ingredients) {
        const entry = map.get(ligneRecette.ingredientId);
        if (!entry) continue;
        // Quantité consommée = quantité vendue × quantité de l'ingrédient dans la recette
        entry.consommationVentes += vente.quantite * ligneRecette.quantite;
      }
    }

    // Calcul final du stock actuel théorique
    for (const entry of map.values()) {
      entry.stockActuel =
        entry.stockInitial +
        entry.entrees -
        entry.sortiesManuel -
        entry.consommationVentes;
    }

    return map;
  }, [ingredients, mouvements, recettes, ventes]);

  function isAlerte(stockActuel: number, ing: Ingredient): boolean {
    return ing.seuilSecurite > 0 && stockActuel <= ing.seuilSecurite;
  }

  function fmtQty(val: number): string {
    return val.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
  }

  async function handleAdd() {
    if (!form.ingredientId) {
      toast.error("Sélectionnez un ingrédient");
      return;
    }
    if (!validateNumber(form.quantiteStr) || !form.quantiteStr) {
      toast.error("Format invalide. Utilisez uniquement des chiffres");
      return;
    }
    const quantite = parseNumber(form.quantiteStr);
    try {
      await createMvt.mutateAsync({
        ingredientId: form.ingredientId,
        date: form.date,
        typeOp: form.typeOp,
        quantite,
        motif: form.motif,
      });
      toast.success("Mouvement ajouté");
      setForm((f) => ({ ...f, quantiteStr: "", motif: "" }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erreur lors de l'ajout : ${msg}`);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMvt.mutateAsync(id);
      toast.success("Mouvement supprimé");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erreur lors de la suppression : ${msg}`);
    }
  }

  async function handleSaveConfig(ing: Ingredient) {
    const cfg = configState[ing.id];
    if (!cfg) return;
    if (!validateNumber(cfg.stockStr) || !validateNumber(cfg.seuilStr)) {
      toast.error("Format invalide. Utilisez uniquement des chiffres");
      return;
    }
    const stockInitial = parseNumber(cfg.stockStr);
    const seuilSecurite = parseNumber(cfg.seuilStr);
    try {
      await updateIng.mutateAsync({ ...ing, stockInitial, seuilSecurite });
      toast.success(`Stock configuré pour ${ing.nom}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erreur : ${msg}`);
    }
  }

  function updateConfig(
    id: string,
    field: "stockStr" | "seuilStr",
    val: string,
  ) {
    setConfigState((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: val },
    }));
  }

  const sortedIngredients = [...ingredients].sort((a, b) => {
    if (!sortKey) return 0;
    const dir = sortOrder === "asc" ? 1 : -1;
    if (sortKey === "nom") return a.nom.localeCompare(b.nom, "fr") * dir;
    if (sortKey === "stockInitial")
      return (a.stockInitial - b.stockInitial) * dir;
    // stockActuel: use computed value from stockTheorique map
    const aCalc = stockTheorique.get(a.id);
    const bCalc = stockTheorique.get(b.id);
    const aVal = aCalc ? aCalc.stockActuel : a.stockInitial;
    const bVal = bCalc ? bCalc.stockActuel : b.stockInitial;
    return (aVal - bVal) * dir;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Stock Théorique</h2>
        <p className="text-sm text-muted-foreground">
          Stock Actuel = Stock Initial + Entrées − Pertes manuelles −
          Consommation Ventes
        </p>
      </div>

      {/* ── Tableau Stock Théorique ─────────────────────────────────────── */}
      <div className="rounded-lg border bg-card shadow-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("nom")}
              >
                Ingrédient <SortIcon col="nom" />
              </TableHead>
              <TableHead>Unité</TableHead>
              <TableHead
                className="text-right cursor-pointer select-none"
                onClick={() => handleSort("stockInitial")}
              >
                Stock Initial <SortIcon col="stockInitial" />
              </TableHead>
              <TableHead className="text-right text-green-700">
                Entrées (+)
              </TableHead>
              <TableHead className="text-right text-amber-700">
                Pertes (−)
              </TableHead>
              <TableHead className="text-right text-blue-700">
                Ventes (−)
              </TableHead>
              <TableHead
                className="text-right font-semibold cursor-pointer select-none"
                onClick={() => handleSort("stockActuel")}
              >
                Stock Actuel (=) <SortIcon col="stockActuel" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingIng ? (
              SKELETON_ING.map((row) => (
                <TableRow key={row}>
                  {SKELETON_COLS_THEO.map((col) => (
                    <TableCell key={col}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : ingredients.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-8"
                  data-ocid="stock.empty_state"
                >
                  Aucun ingrédient. Ajoutez des ingrédients d'abord.
                </TableCell>
              </TableRow>
            ) : (
              sortedIngredients.map((ing, idx) => {
                const calc = stockTheorique.get(ing.id) ?? {
                  stockInitial: ing.stockInitial,
                  entrees: 0,
                  sortiesManuel: 0,
                  consommationVentes: 0,
                  stockActuel: ing.stockInitial,
                };
                const alerte = isAlerte(calc.stockActuel, ing);
                return (
                  <TableRow
                    key={ing.id}
                    data-ocid={`stock.item.${idx + 1}`}
                    className={alerte ? "bg-red-50 hover:bg-red-100" : ""}
                  >
                    {/* Nom */}
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        {alerte && (
                          <span title="Stock sous seuil d'alerte">⚠️</span>
                        )}
                        {ing.nom}
                      </div>
                    </TableCell>

                    {/* Unité */}
                    <TableCell className="text-muted-foreground">
                      {ing.unite}
                    </TableCell>

                    {/* Stock Initial */}
                    <TableCell className="text-right">
                      {fmtQty(calc.stockInitial)}
                    </TableCell>

                    {/* Entrées */}
                    <TableCell className="text-right text-green-700 font-medium">
                      {calc.entrees > 0 ? `+${fmtQty(calc.entrees)}` : "0"}
                    </TableCell>

                    {/* Pertes manuelles */}
                    <TableCell className="text-right text-amber-700 font-medium">
                      {calc.sortiesManuel > 0
                        ? `−${fmtQty(calc.sortiesManuel)}`
                        : "0"}
                    </TableCell>

                    {/* Consommation ventes */}
                    <TableCell className="text-right text-blue-700 font-medium">
                      {calc.consommationVentes > 0
                        ? `−${fmtQty(calc.consommationVentes)}`
                        : "0"}
                    </TableCell>

                    {/* Stock Actuel */}
                    <TableCell
                      className={`text-right font-semibold ${
                        alerte ? "text-destructive" : ""
                      }`}
                    >
                      {fmtQty(calc.stockActuel)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Configuration stock par ingrédient ───────────────────────── */}
      {ingredients.length > 0 && (
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Configuration du stock par ingrédient
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Définissez le stock initial et le seuil d'alerte. Le stock
              théorique est recalculé automatiquement.
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Ingrédient</TableHead>
                  <TableHead>Unité</TableHead>
                  <TableHead className="min-w-[140px]">Stock initial</TableHead>
                  <TableHead className="min-w-[140px]">
                    Seuil d'alerte
                  </TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredients.map((ing) => {
                  const cfg = configState[ing.id] ?? {
                    stockStr: "",
                    seuilStr: "",
                  };
                  return (
                    <TableRow key={ing.id}>
                      <TableCell className="font-medium">{ing.nom}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {ing.unite}
                      </TableCell>
                      <TableCell>
                        <NumericInput
                          value={cfg.stockStr}
                          onChange={(v) => updateConfig(ing.id, "stockStr", v)}
                          placeholder="0"
                          className="w-28 h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <NumericInput
                          value={cfg.seuilStr}
                          onChange={(v) => updateConfig(ing.id, "seuilStr", v)}
                          placeholder="0"
                          className="w-28 h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => handleSaveConfig(ing)}
                          disabled={updateIng.isPending}
                        >
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Ajouter un mouvement ──────────────────────────────────────── */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Ajouter un mouvement de stock
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Saisissez manuellement vos arrivages fournisseurs (Entrée) ou
            produits jetés (Sortie).
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
            <div className="grid gap-1.5">
              <Label>Ingrédient</Label>
              <Select
                value={form.ingredientId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, ingredientId: v }))
                }
              >
                <SelectTrigger data-ocid="stock.select">
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {ingredients.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
                data-ocid="stock.input"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select
                value={form.typeOp}
                onValueChange={(v) => setForm((f) => ({ ...f, typeOp: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Entrée">Entrée (arrivage)</SelectItem>
                  <SelectItem value="Sortie">Sortie (perte / casse)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Quantité</Label>
              <NumericInput
                value={form.quantiteStr}
                onChange={(v) => setForm((f) => ({ ...f, quantiteStr: v }))}
                placeholder="0"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Motif</Label>
              <Input
                value={form.motif}
                onChange={(e) =>
                  setForm((f) => ({ ...f, motif: e.target.value }))
                }
                placeholder="Optionnel"
              />
            </div>
            <Button
              onClick={handleAdd}
              disabled={
                createMvt.isPending || !form.ingredientId || !form.quantiteStr
              }
              data-ocid="stock.primary_button"
            >
              <Plus className="mr-2 h-4 w-4" /> Ajouter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Historique ───────────────────────────────────────────────── */}
      <div>
        <h3 className="text-base font-semibold mb-3">
          Historique des mouvements manuels
        </h3>
        <div className="rounded-lg border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Date</TableHead>
                <TableHead>Ingrédient</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingMvt ? (
                SKELETON_MVT.map((row) => (
                  <TableRow key={row}>
                    {SKELETON_COLS_MVT.map((col) => (
                      <TableCell key={col}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : mouvements.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-6"
                  >
                    Aucun mouvement enregistré
                  </TableCell>
                </TableRow>
              ) : (
                [...mouvements].reverse().map((m, idx) => {
                  const ing = ingredients.find((i) => i.id === m.ingredientId);
                  const entree = isEntree(m.typeOp);
                  return (
                    <TableRow key={m.id} data-ocid={`stock.row.${idx + 1}`}>
                      <TableCell className="text-sm">{m.date}</TableCell>
                      <TableCell className="font-medium">
                        {ing?.nom ?? m.ingredientId}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={entree ? "default" : "secondary"}
                          className={
                            entree
                              ? "bg-green-100 text-green-800 hover:bg-green-100"
                              : "bg-red-100 text-red-800 hover:bg-red-100"
                          }
                        >
                          {m.typeOp}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {m.quantite.toLocaleString("fr-FR", {
                          maximumFractionDigits: 3,
                        })}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {m.motif || "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(m.id)}
                          data-ocid={`stock.delete_button.${idx + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
