import {
  NumericInput,
  parseNumber,
  validateNumber,
} from "@/components/NumericInput";
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
  useCreateIngredient,
  useDeleteIngredient,
  useIngredients,
  useUpdateIngredient,
} from "@/hooks/useQueries";
import type { Ingredient } from "@/hooks/useQueries";
import { fmtEur } from "@/utils/format";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const UNITES = ["kg", "g", "L", "cl", "ml", "U"];

interface FormState {
  nom: string;
  unite: string;
  prixStr: string;
}

const emptyForm = (): FormState => ({
  nom: "",
  unite: "kg",
  prixStr: "",
});

const SKELETON_ROWS = [0, 1, 2, 3];
const SKELETON_COLS = [0, 1, 2, 3];

export default function Ingredients() {
  const { data: ingredients = [], isLoading } = useIngredients();
  const createMut = useCreateIngredient();
  const updateMut = useUpdateIngredient();
  const deleteMut = useDeleteIngredient();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [sortKey, setSortKey] = useState<"nom" | "prixUnitaireHT" | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  function handleSort(key: "nom" | "prixUnitaireHT") {
    if (sortKey === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  }

  function SortIcon({ col }: { col: "nom" | "prixUnitaireHT" }) {
    if (sortKey !== col)
      return <ArrowUpDown className="ml-1 h-3.5 w-3.5 inline opacity-50" />;
    return sortOrder === "asc" ? (
      <ChevronUp className="ml-1 h-3.5 w-3.5 inline" />
    ) : (
      <ChevronDown className="ml-1 h-3.5 w-3.5 inline" />
    );
  }

  const sortedIngredients = [...ingredients].sort((a, b) => {
    if (!sortKey) return 0;
    const dir = sortOrder === "asc" ? 1 : -1;
    if (sortKey === "nom") return a.nom.localeCompare(b.nom, "fr") * dir;
    return (a.prixUnitaireHT - b.prixUnitaireHT) * dir;
  });

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(ing: Ingredient) {
    setEditing(ing);
    setForm({
      nom: ing.nom,
      unite: ing.unite,
      prixStr: ing.prixUnitaireHT === 0 ? "" : String(ing.prixUnitaireHT),
    });
    setOpen(true);
  }

  const prixValid = validateNumber(form.prixStr);
  const canSave = !!form.nom && prixValid;

  async function handleSave() {
    console.log("[Ingredients] handleSave called");
    if (!canSave) {
      toast.error("Format invalide. Corrigez les champs en rouge.");
      return;
    }
    const prix = parseNumber(form.prixStr);
    const data: Omit<Ingredient, "id"> = {
      nom: form.nom,
      unite: form.unite,
      prixUnitaireHT: prix,
      // Preserve seuil/stock from existing ingredient (set from Stock tab)
      seuilSecurite: editing?.seuilSecurite ?? 0,
      stockInitial: editing?.stockInitial ?? 0,
    };
    console.log("[Ingredients] data:", JSON.stringify(data));
    try {
      if (editing) {
        await updateMut.mutateAsync({ ...data, id: editing.id });
        toast.success("Ingrédient mis à jour");
      } else {
        await createMut.mutateAsync(data);
        toast.success("Ingrédient créé");
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
      toast.success("Ingrédient supprimé");
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
          <h2 className="text-lg font-semibold">Ingrédients</h2>
          <p className="text-sm text-muted-foreground">
            Produits achetés et matières premières. Le stock initial et le seuil
            d'alerte se configurent dans l'onglet Stock.
          </p>
        </div>
        <Button onClick={openAdd} data-ocid="ingredients.open_modal_button">
          <Plus className="mr-2 h-4 w-4" /> Ajouter
        </Button>
      </div>

      <div className="rounded-lg border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("nom")}
              >
                Nom <SortIcon col="nom" />
              </TableHead>
              <TableHead>Unité</TableHead>
              <TableHead
                className="text-right cursor-pointer select-none"
                onClick={() => handleSort("prixUnitaireHT")}
              >
                Prix unitaire HT <SortIcon col="prixUnitaireHT" />
              </TableHead>
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
            ) : ingredients.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-8"
                  data-ocid="ingredients.empty_state"
                >
                  Aucun ingrédient. Ajoutez vos matières premières.
                </TableCell>
              </TableRow>
            ) : (
              sortedIngredients.map((ing, idx) => (
                <TableRow
                  key={ing.id}
                  data-ocid={`ingredients.item.${idx + 1}`}
                >
                  <TableCell className="font-medium">{ing.nom}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {ing.unite}
                  </TableCell>
                  <TableCell className="text-right">
                    {fmtEur(ing.prixUnitaireHT)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(ing)}
                        data-ocid={`ingredients.edit_button.${idx + 1}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(ing.id)}
                        data-ocid={`ingredients.delete_button.${idx + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-ocid="ingredients.dialog">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier l'ingrédient" : "Nouvel ingrédient"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ing-nom">Nom</Label>
              <Input
                id="ing-nom"
                value={form.nom}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nom: e.target.value }))
                }
                data-ocid="ingredients.input"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ing-unite">Unité</Label>
              <Select
                value={form.unite}
                onValueChange={(v) => setForm((f) => ({ ...f, unite: v }))}
              >
                <SelectTrigger id="ing-unite" data-ocid="ingredients.select">
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
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ing-prix">
                Prix unitaire HT (€ / {form.unite})
              </Label>
              <NumericInput
                id="ing-prix"
                placeholder="0.00"
                value={form.prixStr}
                onChange={(v) => setForm((f) => ({ ...f, prixStr: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              data-ocid="ingredients.cancel_button"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending || !canSave}
              data-ocid="ingredients.submit_button"
            >
              {isPending ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
