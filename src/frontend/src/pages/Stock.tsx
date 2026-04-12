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
  useUpdateIngredient,
} from "@/hooks/useQueries";
import type { Ingredient } from "@/hooks/useQueries";
import { AlertTriangle, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const SKELETON_ING = [0, 1, 2, 3, 4];
const SKELETON_COLS_ING = [0, 1, 2, 3, 4, 5, 6, 7];
const SKELETON_MVT = [0, 1, 2];
const SKELETON_COLS_MVT = [0, 1, 2, 3, 4, 5];

type ConfigState = Record<string, { stockStr: string; seuilStr: string }>;

export default function Stock() {
  const { data: ingredients = [], isLoading: loadingIng } = useIngredients();
  const { data: mouvements = [], isLoading: loadingMvt } = useMouvementsStock();
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

  // Initialize config state from ingredients using functional updater to avoid stale closure
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

  const stockActuel = useMemo(() => {
    const map = new Map<string, number>();
    for (const ing of ingredients) {
      map.set(ing.id, ing.stockInitial);
    }
    for (const m of mouvements) {
      const cur = map.get(m.ingredientId) ?? 0;
      if (m.typeOp === "Entrée") map.set(m.ingredientId, cur + m.quantite);
      else map.set(m.ingredientId, cur - m.quantite);
    }
    return map;
  }, [ingredients, mouvements]);

  const mouvStats = useMemo(() => {
    const entr = new Map<string, number>();
    const sort = new Map<string, number>();
    for (const m of mouvements) {
      if (m.typeOp === "Entrée")
        entr.set(m.ingredientId, (entr.get(m.ingredientId) ?? 0) + m.quantite);
      else
        sort.set(m.ingredientId, (sort.get(m.ingredientId) ?? 0) + m.quantite);
    }
    return { entr, sort };
  }, [mouvements]);

  function isStockBas(stock: number, ing: Ingredient): boolean {
    return ing.seuilSecurite > 0 && stock < ing.seuilSecurite;
  }

  function getStatut(stock: number, ing: Ingredient) {
    if (ing.seuilSecurite > 0 && stock < ing.seuilSecurite)
      return {
        label: "RUPTURE",
        cls: "bg-destructive text-destructive-foreground",
      };
    if (ing.seuilSecurite > 0 && stock < ing.seuilSecurite * 2)
      return { label: "FAIBLE", cls: "bg-warning text-warning-foreground" };
    if (ing.seuilSecurite === 0)
      return { label: "N/D", cls: "bg-muted text-muted-foreground" };
    return { label: "OK", cls: "bg-success text-success-foreground" };
  }

  async function handleAdd() {
    console.log("[Stock] handleAdd called, form:", JSON.stringify(form));
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
      console.error("[handleAdd] error:", e);
      toast.error(`Erreur lors de l'ajout : ${msg}`);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMvt.mutateAsync(id);
      toast.success("Mouvement supprimé");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[handleDelete] error:", e);
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
      await updateIng.mutateAsync({
        ...ing,
        stockInitial,
        seuilSecurite,
      });
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Gestion de Stock</h2>
        <p className="text-sm text-muted-foreground">
          Suivi en temps réel. Stock Actuel = Stock Initial + Entrées - Sorties
        </p>
      </div>

      {/* ── Tableau stock actuel ───────────────────────────────────────── */}
      <div className="rounded-lg border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Ingrédient</TableHead>
              <TableHead>Unité</TableHead>
              <TableHead className="text-right">Seuil d'alerte</TableHead>
              <TableHead className="text-right">Stock initial</TableHead>
              <TableHead className="text-right">Entrées</TableHead>
              <TableHead className="text-right">Sorties</TableHead>
              <TableHead className="text-right">Stock actuel</TableHead>
              <TableHead className="text-center">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingIng ? (
              SKELETON_ING.map((row) => (
                <TableRow key={row}>
                  {SKELETON_COLS_ING.map((col) => (
                    <TableCell key={col}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : ingredients.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground py-8"
                  data-ocid="stock.empty_state"
                >
                  Aucun ingrédient. Ajoutez des ingrédients d'abord.
                </TableCell>
              </TableRow>
            ) : (
              ingredients.map((ing, idx) => {
                const stock = stockActuel.get(ing.id) ?? ing.stockInitial;
                const totalE = mouvStats.entr.get(ing.id) ?? 0;
                const totalS = mouvStats.sort.get(ing.id) ?? 0;
                const statut = getStatut(stock, ing);
                const alerte = isStockBas(stock, ing);
                return (
                  <TableRow key={ing.id} data-ocid={`stock.item.${idx + 1}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        {alerte && (
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        )}
                        {ing.nom}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {ing.unite}
                    </TableCell>
                    <TableCell className="text-right">
                      {ing.seuilSecurite > 0 ? (
                        `${ing.seuilSecurite} ${ing.unite}`
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          Non défini
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {ing.stockInitial} {ing.unite}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {totalE > 0 ? `+${totalE}` : "0"}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {totalS > 0 ? `-${totalS}` : "0"}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        alerte ? "text-destructive" : ""
                      }`}
                    >
                      {stock.toLocaleString("fr-FR", {
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-xs ${statut.cls}`}>
                        {statut.label}
                      </Badge>
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
              Définissez le stock initial et le seuil d'alerte. Le stock actuel
              est recalculé automatiquement.
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
                  <SelectItem value="Entrée">Entrée</SelectItem>
                  <SelectItem value="Sortie">Sortie</SelectItem>
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
          Historique des mouvements
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
                  return (
                    <TableRow key={m.id} data-ocid={`stock.row.${idx + 1}`}>
                      <TableCell className="text-sm">{m.date}</TableCell>
                      <TableCell className="font-medium">
                        {ing?.nom ?? m.ingredientId}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            m.typeOp === "Entrée" ? "default" : "secondary"
                          }
                          className={
                            m.typeOp === "Entrée"
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
