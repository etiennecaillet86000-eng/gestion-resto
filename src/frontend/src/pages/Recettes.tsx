import {
  NumericInput,
  parseNumber,
  validateNumber,
} from "@/components/NumericInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  useCreateRecette,
  useDeleteRecette,
  useIngredients,
  useParametres,
  useRecettes,
  useUpdateRecette,
} from "@/hooks/useQueries";
import type { Recette, RecetteIngredient } from "@/hooks/useQueries";
import {
  coutMatiereHT,
  fmtEur,
  fmtPct,
  margeBrute,
  prixHT,
} from "@/utils/format";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  PlusCircle,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FOOD_COST_CATEGORIES } from "./PilotageGlobal";

// Les catégories recettes correspondent aux catégories food cost
const CATEGORIES = FOOD_COST_CATEGORIES;

const TVA_CATS: { label: string; taux: number }[] = [
  { label: "Alcools (20 %)", taux: 20 },
  { label: "Restauration / Soft (10 %)", taux: 10 },
  { label: "Alimentation / Vente à emporter (5,5 %)", taux: 5.5 },
];
const UNITES = ["kg", "g", "L", "cl", "U"];
const SKELETON_ROWS = [0, 1, 2, 3];
const SKELETON_COLS = [0, 1, 2, 3, 4, 5, 6];

type FormState = Omit<Recette, "id"> & {
  prixStr: string;
  consommablesStr: string;
};

const emptyForm = (): FormState => ({
  nom: "",
  categorie: CATEGORIES[0],
  categorieTVA: "Restauration / Soft (10 %)",
  tauxTVA: 10,
  ingredients: [],
  consommablesHT: 0,
  prixVenteTTC: 0,
  prixStr: "",
  consommablesStr: "",
});

export default function Recettes() {
  const { data: recettes = [], isLoading } = useRecettes();
  const { data: ingredients = [] } = useIngredients();
  const { data: parametres } = useParametres();
  const createMut = useCreateRecette();
  const updateMut = useUpdateRecette();
  const deleteMut = useDeleteRecette();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Recette | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  type RecetteSortKey = "nom" | "categorie" | "prixVenteTTC" | "coutMatiere";
  const [sortKey, setSortKey] = useState<RecetteSortKey | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  function handleSort(key: RecetteSortKey) {
    if (sortKey === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  }

  function SortIcon({ col }: { col: RecetteSortKey }) {
    if (sortKey !== col)
      return (
        <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 text-muted-foreground" />
      );
    return sortOrder === "asc" ? (
      <ChevronUp className="ml-1 inline h-3.5 w-3.5" />
    ) : (
      <ChevronDown className="ml-1 inline h-3.5 w-3.5" />
    );
  }

  const ingredientsMap = useMemo(() => {
    const m = new Map<string, (typeof ingredients)[0]>();
    for (const ing of ingredients) m.set(ing.id, ing);
    return m;
  }, [ingredients]);

  const sortedRecettes = useMemo(() => {
    if (!sortKey) return recettes;
    return [...recettes].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "nom") {
        cmp = a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" });
      } else if (sortKey === "categorie") {
        cmp = a.categorie.localeCompare(b.categorie, "fr", {
          sensitivity: "base",
        });
      } else if (sortKey === "prixVenteTTC") {
        cmp = a.prixVenteTTC - b.prixVenteTTC;
      } else if (sortKey === "coutMatiere") {
        cmp =
          coutMatiereHT(a, ingredientsMap) - coutMatiereHT(b, ingredientsMap);
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [recettes, sortKey, sortOrder, ingredientsMap]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(r: Recette) {
    setEditing(r);
    const matchedCat = TVA_CATS.find((t) => t.taux === r.tauxTVA);
    setForm({
      nom: r.nom,
      categorie: r.categorie,
      categorieTVA: matchedCat?.label ?? r.categorieTVA,
      tauxTVA: r.tauxTVA,
      ingredients: r.ingredients.map((i) => ({ ...i })),
      consommablesHT: r.consommablesHT,
      prixVenteTTC: r.prixVenteTTC,
      prixStr: r.prixVenteTTC === 0 ? "" : String(r.prixVenteTTC),
      consommablesStr: r.consommablesHT === 0 ? "" : String(r.consommablesHT),
    });
    setOpen(true);
  }

  function setCategorieTVA(val: string) {
    const tva = TVA_CATS.find((t) => t.label === val);
    setForm((f) => ({
      ...f,
      categorieTVA: val,
      tauxTVA: tva?.taux ?? f.tauxTVA,
    }));
  }

  function addIngredientLine() {
    if (ingredients.length === 0) return;
    setForm((f) => ({
      ...f,
      ingredients: [
        ...f.ingredients,
        {
          ingredientId: ingredients[0].id,
          quantite: 0,
          unite: ingredients[0].unite,
        },
      ],
    }));
  }

  function updateIngredientLine(
    idx: number,
    patch: Partial<RecetteIngredient>,
  ) {
    setForm((f) => {
      const updated = f.ingredients.map((ri, i) =>
        i === idx ? { ...ri, ...patch } : ri,
      );
      return { ...f, ingredients: updated };
    });
  }

  function removeIngredientLine(idx: number) {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.filter((_, i) => i !== idx),
    }));
  }

  const coutCalc = useMemo(
    () => coutMatiereHT(form, ingredientsMap),
    [form, ingredientsMap],
  );

  const prixTTC = parseNumber(form.prixStr);
  const prHT = useMemo(
    () => prixHT(prixTTC, form.tauxTVA),
    [prixTTC, form.tauxTVA],
  );
  const margeCalc = useMemo(() => margeBrute(prHT, coutCalc), [prHT, coutCalc]);

  // Prix de vente conseillé basé sur food cost cible
  const foodCostCible = useMemo(() => {
    if (!parametres) return null;
    const found = parametres.tauxFoodCostParCategorie.find(
      ([c]) => c === form.categorie,
    );
    return found ? found[1] : null;
  }, [parametres, form.categorie]);

  const prixHTConseille = useMemo(() => {
    if (!foodCostCible || foodCostCible <= 0 || coutCalc <= 0) return 0;
    return coutCalc / (foodCostCible / 100);
  }, [foodCostCible, coutCalc]);

  const prixTTCConseille = useMemo(
    () => prixHTConseille * (1 + form.tauxTVA / 100),
    [prixHTConseille, form.tauxTVA],
  );

  const ecartPrix = prixTTC - prixTTCConseille;

  const canSave =
    !!form.nom &&
    validateNumber(form.prixStr) &&
    validateNumber(form.consommablesStr);

  async function handleSave() {
    if (!canSave) {
      toast.error("Corrigez les champs invalides avant de sauvegarder.");
      return;
    }
    const payload: Omit<Recette, "id"> = {
      nom: form.nom,
      categorie: form.categorie,
      categorieTVA: form.categorieTVA,
      tauxTVA: form.tauxTVA,
      ingredients: form.ingredients,
      consommablesHT: parseNumber(form.consommablesStr),
      prixVenteTTC: parseNumber(form.prixStr),
    };
    console.log("[Recettes] handleSave called, form:", JSON.stringify(payload));
    try {
      if (editing) {
        await updateMut.mutateAsync({ ...payload, id: editing.id });
        toast.success("Recette mise à jour");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Recette créée");
      }
      setOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[handleSave] error:", e);
      toast.error(`Erreur lors de la sauvegarde : ${msg}`);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Recette supprimée");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[handleDelete] error:", e);
      toast.error(`Erreur lors de la suppression : ${msg}`);
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Recettes</h2>
          <p className="text-sm text-muted-foreground">
            Produits vendus composés d'ingrédients
          </p>
        </div>
        <Button onClick={openAdd} data-ocid="recettes.open_modal_button">
          <Plus className="mr-2 h-4 w-4" /> Ajouter une recette
        </Button>
      </div>

      <div className="rounded-lg border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("nom")}
                data-ocid="recettes.nom.toggle"
              >
                Nom <SortIcon col="nom" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("categorie")}
                data-ocid="recettes.categorie.toggle"
              >
                Catégorie <SortIcon col="categorie" />
              </TableHead>
              <TableHead>TVA</TableHead>
              <TableHead
                className="text-right cursor-pointer select-none"
                onClick={() => handleSort("coutMatiere")}
                data-ocid="recettes.cout_matiere.toggle"
              >
                Coût matière HT <SortIcon col="coutMatiere" />
              </TableHead>
              <TableHead
                className="text-right cursor-pointer select-none"
                onClick={() => handleSort("prixVenteTTC")}
                data-ocid="recettes.prix_ttc.toggle"
              >
                Prix TTC saisi <SortIcon col="prixVenteTTC" />
              </TableHead>
              <TableHead className="text-right">Marge brute</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              SKELETON_ROWS.map((row) => (
                <TableRow key={row}>
                  {SKELETON_COLS.map((col) => (
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
                  className="text-center text-muted-foreground py-8"
                  data-ocid="recettes.empty_state"
                >
                  Aucune recette. Ajoutez vos plats et boissons.
                </TableCell>
              </TableRow>
            ) : (
              sortedRecettes.map((r, idx) => {
                const cout = coutMatiereHT(r, ingredientsMap);
                const ph = prixHT(r.prixVenteTTC, r.tauxTVA);
                const marge = margeBrute(ph, cout);
                return (
                  <TableRow key={r.id} data-ocid={`recettes.item.${idx + 1}`}>
                    <TableCell className="font-medium">{r.nom}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {r.categorie}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.tauxTVA} %
                    </TableCell>
                    <TableCell className="text-right">{fmtEur(cout)}</TableCell>
                    <TableCell className="text-right">
                      {fmtEur(r.prixVenteTTC)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        marge >= 60
                          ? "text-green-600"
                          : marge >= 30
                            ? "text-amber-600"
                            : "text-red-600"
                      }`}
                    >
                      {fmtPct(marge)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(r)}
                          data-ocid={`recettes.edit_button.${idx + 1}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(r.id)}
                          data-ocid={`recettes.delete_button.${idx + 1}`}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          data-ocid="recettes.dialog"
        >
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier la recette" : "Nouvelle recette"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Nom + Catégorie */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Nom de la recette</Label>
                <Input
                  value={form.nom}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nom: e.target.value }))
                  }
                  data-ocid="recettes.input"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Catégorie</Label>
                <Select
                  value={form.categorie}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, categorie: v }))
                  }
                >
                  <SelectTrigger data-ocid="recettes.select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* TVA */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Catégorie TVA</Label>
                <Select
                  value={form.categorieTVA}
                  onValueChange={setCategorieTVA}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TVA_CATS.map((t) => (
                      <SelectItem key={t.label} value={t.label}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Taux TVA (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={form.tauxTVA}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      tauxTVA: Number.parseFloat(e.target.value) || 0,
                    }))
                  }
                  placeholder="Ex: 10"
                />
              </div>
            </div>

            {/* Prix + Consommables */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Consommables HT (€)</Label>
                <NumericInput
                  placeholder="0.00"
                  value={form.consommablesStr}
                  onChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      consommablesStr: v,
                      consommablesHT: validateNumber(v)
                        ? parseNumber(v)
                        : f.consommablesHT,
                    }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Prix de vente TTC (€)</Label>
                <NumericInput
                  placeholder="0.00"
                  value={form.prixStr}
                  onChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      prixStr: v,
                      prixVenteTTC: validateNumber(v)
                        ? parseNumber(v)
                        : f.prixVenteTTC,
                    }))
                  }
                />
              </div>
            </div>

            {/* Récap calculs */}
            <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/60 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Coût matière HT</p>
                <p className="font-semibold">{fmtEur(coutCalc)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Prix HT saisi</p>
                <p className="font-semibold">{fmtEur(prHT)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Marge brute</p>
                <p
                  className={`font-semibold ${
                    margeCalc >= 60
                      ? "text-green-600"
                      : margeCalc >= 30
                        ? "text-amber-600"
                        : "text-red-600"
                  }`}
                >
                  {fmtPct(margeCalc)}
                </p>
              </div>
            </div>

            {/* Prix de vente conseillé */}
            {foodCostCible !== null && coutCalc > 0 && (
              <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 text-sm space-y-2">
                <p className="font-medium text-primary">
                  Prix de vente conseillé (food cost cible : {foodCostCible} %)
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Prix HT conseillé
                    </p>
                    <p className="font-semibold">{fmtEur(prixHTConseille)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Prix TTC conseillé
                    </p>
                    <p className="font-semibold text-primary">
                      {fmtEur(prixTTCConseille)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Écart vs saisi
                    </p>
                    <p
                      className={`font-semibold ${
                        prixTTC === 0
                          ? "text-muted-foreground"
                          : ecartPrix >= 0
                            ? "text-green-600"
                            : "text-red-600"
                      }`}
                    >
                      {prixTTC === 0
                        ? "—"
                        : `${ecartPrix >= 0 ? "+" : ""}${fmtEur(ecartPrix)}`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Ingrédients */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Ingrédients de la recette</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addIngredientLine}
                  disabled={ingredients.length === 0}
                >
                  <PlusCircle className="h-3.5 w-3.5 mr-1" /> Ajouter
                </Button>
              </div>
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {form.ingredients.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-3 border rounded-lg border-dashed">
                    Aucun ingrédient ajouté
                  </p>
                )}
                {form.ingredients.map((ri, idx) => {
                  const ing = ingredientsMap.get(ri.ingredientId);
                  return (
                    <div
                      key={`ri-${ri.ingredientId}-${idx}`}
                      className="flex gap-2 items-center"
                    >
                      <Select
                        value={ri.ingredientId}
                        onValueChange={(v) => {
                          const found = ingredientsMap.get(v);
                          updateIngredientLine(idx, {
                            ingredientId: v,
                            unite: found?.unite ?? ri.unite,
                          });
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ingredients.map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.nom} ({i.unite})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        placeholder="Qté"
                        className="w-24"
                        value={ri.quantite}
                        onChange={(e) =>
                          updateIngredientLine(idx, {
                            quantite: Number.parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                      <Select
                        value={ri.unite}
                        onValueChange={(v) =>
                          updateIngredientLine(idx, { unite: v })
                        }
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITES.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground w-20 text-right">
                        {ing ? fmtEur(ri.quantite * ing.prixUnitaireHT) : "-"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => removeIngredientLine(idx)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              data-ocid="recettes.cancel_button"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending || !canSave}
              data-ocid="recettes.submit_button"
            >
              {isPending ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
