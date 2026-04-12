import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AssocieGerant,
  Emprunt,
  Ingredient,
  LigneAmortissement,
  LigneFraisFixes,
  MouvementStock,
  ParametresJuridiques,
  ParametresRentabilite,
  Recette,
  RecetteIngredient,
  Salarie,
  VenteRecette,
  backendInterface,
} from "../backend.d";
import { useActor } from "./useActor";

export type {
  Ingredient,
  Recette,
  RecetteIngredient,
  LigneFraisFixes,
  LigneAmortissement,
  ParametresRentabilite,
  MouvementStock,
  VenteRecette,
  Emprunt,
  AssocieGerant,
  Salarie,
  ParametresJuridiques,
};

function typed(actor: unknown): backendInterface {
  return actor as backendInterface;
}

/**
 * Accepts `unknown` to avoid structural-type mismatch between backend.ts and
 * backend.d.ts — the runtime object is the same; only the TS declarations differ.
 */
function requireActor(actor: unknown): backendInterface {
  if (!actor)
    throw new Error("Backend non disponible — veuillez recharger la page");
  return actor as backendInterface;
}

export function useIngredients() {
  const { actor, isFetching } = useActor();
  return useQuery<Ingredient[]>({
    queryKey: ["ingredients"],
    queryFn: async () => {
      if (!actor) {
        console.warn("[getIngredients] actor is null, returning []");
        return [];
      }
      console.log("[getIngredients] fetching...");
      const result = await typed(actor).getIngredients();
      console.log("[getIngredients] got", result.length, "items");
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateIngredient() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Omit<Ingredient, "id">) => {
      const a = requireActor(actor);
      console.log("[createIngredient] payload:", JSON.stringify(v));
      return typed(a).createIngredient(
        v.nom,
        v.unite,
        v.prixUnitaireHT,
        v.seuilSecurite,
        v.stockInitial,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ingredients"] }),
  });
}

export function useUpdateIngredient() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Ingredient) => {
      const a = requireActor(actor);
      console.log("[updateIngredient] payload:", JSON.stringify(v));
      return typed(a).updateIngredient(
        v.id,
        v.nom,
        v.unite,
        v.prixUnitaireHT,
        v.seuilSecurite,
        v.stockInitial,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ingredients"] }),
  });
}

export function useDeleteIngredient() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const a = requireActor(actor);
      console.log("[deleteIngredient] id:", id);
      return typed(a).deleteIngredient(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ingredients"] }),
  });
}

export function useRecettes() {
  const { actor, isFetching } = useActor();
  return useQuery<Recette[]>({
    queryKey: ["recettes"],
    queryFn: async () => {
      if (!actor) {
        console.warn("[getRecettes] actor is null, returning []");
        return [];
      }
      console.log("[getRecettes] fetching...");
      const result = await typed(actor).getRecettes();
      console.log("[getRecettes] got", result.length, "items");
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateRecette() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Omit<Recette, "id">) => {
      const a = requireActor(actor);
      console.log("[createRecette] payload:", JSON.stringify(v));
      return typed(a).createRecette(
        v.nom,
        v.categorie,
        v.categorieTVA,
        v.tauxTVA,
        v.ingredients,
        v.consommablesHT,
        v.prixVenteTTC,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recettes"] }),
  });
}

export function useUpdateRecette() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Recette) => {
      const a = requireActor(actor);
      console.log("[updateRecette] payload:", JSON.stringify(v));
      return typed(a).updateRecette(
        v.id,
        v.nom,
        v.categorie,
        v.categorieTVA,
        v.tauxTVA,
        v.ingredients,
        v.consommablesHT,
        v.prixVenteTTC,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recettes"] }),
  });
}

export function useDeleteRecette() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const a = requireActor(actor);
      console.log("[deleteRecette] id:", id);
      return typed(a).deleteRecette(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recettes"] }),
  });
}

export function useFraisFixes() {
  const { actor, isFetching } = useActor();
  return useQuery<LigneFraisFixes[]>({
    queryKey: ["fraisFixes"],
    queryFn: async () => {
      if (!actor) {
        console.warn("[getFraisFixes] actor is null, returning []");
        return [];
      }
      console.log("[getFraisFixes] fetching...");
      const result = await typed(actor).getFraisFixes();
      console.log("[getFraisFixes] got", result.length, "lignes");
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSaveFraisFixes() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lignes: LigneFraisFixes[]) => {
      const a = requireActor(actor);
      console.log("[saveFraisFixes] payload:", JSON.stringify(lignes));
      return typed(a).saveFraisFixes(lignes);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fraisFixes"] }),
  });
}

export function useParametres() {
  const { actor, isFetching } = useActor();
  return useQuery<ParametresRentabilite>({
    queryKey: ["parametres"],
    queryFn: async () => {
      if (!actor)
        return {
          ticketMoyenHT: 0,
          nbClientsParSemaine: 0,
          nbSemainesSaison: 0,
          tauxFoodCostParCategorie: [],
        };
      console.log("[getParametres] fetching...");
      const result = await typed(actor).getParametres();
      console.log("[getParametres] result:", JSON.stringify(result));
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSaveParametres() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: ParametresRentabilite) => {
      const a = requireActor(actor);
      console.log("[saveParametres] payload:", JSON.stringify(p));
      return typed(a).saveParametres(p);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parametres"] }),
  });
}

export function useMouvementsStock() {
  const { actor, isFetching } = useActor();
  return useQuery<MouvementStock[]>({
    queryKey: ["mouvements"],
    queryFn: async () => {
      if (!actor) {
        console.warn("[getMouvements] actor is null, returning []");
        return [];
      }
      console.log("[getMouvements] fetching...");
      const result = await typed(actor).getMouvementsStock();
      console.log("[getMouvements] got", result.length, "items");
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateMouvement() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      ingredientId: string;
      date: string;
      typeOp: string;
      quantite: number;
      motif: string;
    }) => {
      const a = requireActor(actor);
      console.log("[createMouvement] payload:", JSON.stringify(v));
      return typed(a).createMouvement(
        v.ingredientId,
        v.date,
        v.typeOp,
        v.quantite,
        v.motif,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mouvements"] }),
  });
}

export function useDeleteMouvement() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const a = requireActor(actor);
      console.log("[deleteMouvement] id:", id);
      return typed(a).deleteMouvement(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mouvements"] }),
  });
}

export function useVentesRecettes() {
  const { actor, isFetching } = useActor();
  return useQuery<VenteRecette[]>({
    queryKey: ["ventes"],
    queryFn: async () => {
      if (!actor) {
        console.warn("[getVentes] actor is null, returning []");
        return [];
      }
      console.log("[getVentes] fetching...");
      const result = await typed(actor).getVentesRecettes();
      console.log("[getVentes] got", result.length, "items");
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateVente() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { recetteId: string; date: string; quantite: number }) => {
      const a = requireActor(actor);
      console.log("[createVente] payload:", JSON.stringify(v));
      return typed(a).createVente(v.recetteId, v.date, v.quantite);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ventes"] }),
  });
}

export function useDeleteVente() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const a = requireActor(actor);
      console.log("[deleteVente] id:", id);
      return typed(a).deleteVente(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ventes"] }),
  });
}

// ── EMPRUNTS ─────────────────────────────────────────────────────────────────────────────

export function useEmprunts() {
  const { actor, isFetching } = useActor();
  return useQuery<Emprunt[]>({
    queryKey: ["emprunts"],
    queryFn: async () => {
      if (!actor) {
        console.warn("[getEmprunts] actor is null, returning []");
        return [];
      }
      console.log("[getEmprunts] fetching...");
      const result = await typed(actor).getEmprunts();
      console.log("[getEmprunts] got", result.length, "items");
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateEmprunt() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Omit<Emprunt, "id">) => {
      const a = requireActor(actor);
      console.log("[createEmprunt] payload:", JSON.stringify(v));
      return typed(a).createEmprunt(
        v.nom,
        v.montant,
        v.tauxAnnuel,
        v.dureeMois,
        v.dateDebut,
        v.differeMois,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emprunts"] }),
  });
}

export function useUpdateEmprunt() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Emprunt) => {
      const a = requireActor(actor);
      console.log("[updateEmprunt] payload:", JSON.stringify(v));
      return typed(a).updateEmprunt(
        v.id,
        v.nom,
        v.montant,
        v.tauxAnnuel,
        v.dureeMois,
        v.dateDebut,
        v.differeMois,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emprunts"] }),
  });
}

export function useDeleteEmprunt() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const a = requireActor(actor);
      console.log("[deleteEmprunt] id:", id);
      return typed(a).deleteEmprunt(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emprunts"] }),
  });
}

// ── ASSOCIES / GERANTS ───────────────────────────────────────────────────────────────────

export function useAssociesGerants() {
  const { actor, isFetching } = useActor();
  return useQuery<AssocieGerant[]>({
    queryKey: ["associes"],
    queryFn: async () => {
      if (!actor) {
        console.warn("[getAssocies] actor is null, returning []");
        return [];
      }
      console.log("[getAssocies] fetching...");
      const result = await typed(actor).getAssociesGerants();
      console.log("[getAssocies] got", result.length, "items");
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateAssocieGerant() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Omit<AssocieGerant, "id">) => {
      const a = requireActor(actor);
      console.log("[createAssocieGerant] payload:", JSON.stringify(v));
      return typed(a).createAssocieGerant(
        v.nom,
        v.statut,
        v.remunerationAnnuelle,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["associes"] }),
  });
}

export function useUpdateAssocieGerant() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: AssocieGerant) => {
      const a = requireActor(actor);
      console.log("[updateAssocieGerant] payload:", JSON.stringify(v));
      return typed(a).updateAssocieGerant(
        v.id,
        v.nom,
        v.statut,
        v.remunerationAnnuelle,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["associes"] }),
  });
}

export function useDeleteAssocieGerant() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const a = requireActor(actor);
      console.log("[deleteAssocieGerant] id:", id);
      return typed(a).deleteAssocieGerant(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["associes"] }),
  });
}

// ── SALARIES ─────────────────────────────────────────────────────────────────────────────

export function useSalaries() {
  const { actor, isFetching } = useActor();
  return useQuery<Salarie[]>({
    queryKey: ["salaries"],
    queryFn: async () => {
      if (!actor) {
        console.warn("[getSalaries] actor is null, returning []");
        return [];
      }
      console.log("[getSalaries] fetching...");
      const result = await typed(actor).getSalaries();
      console.log("[getSalaries] got", result.length, "items");
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateSalarie() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Omit<Salarie, "id">) => {
      const a = requireActor(actor);
      console.log("[createSalarie] payload:", JSON.stringify(v));
      return typed(a).createSalarie(v.nom, v.poste, v.salaireAnnuelBrut);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salaries"] }),
  });
}

export function useUpdateSalarie() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Salarie) => {
      const a = requireActor(actor);
      console.log("[updateSalarie] payload:", JSON.stringify(v));
      return typed(a).updateSalarie(v.id, v.nom, v.poste, v.salaireAnnuelBrut);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salaries"] }),
  });
}

export function useDeleteSalarie() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const a = requireActor(actor);
      console.log("[deleteSalarie] id:", id);
      return typed(a).deleteSalarie(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salaries"] }),
  });
}

// ── PARAMETRES JURIDIQUES ───────────────────────────────────────────────────────────────────

export function useParametresJuridiques() {
  const { actor, isFetching } = useActor();
  return useQuery<ParametresJuridiques>({
    queryKey: ["parametresJuridiques"],
    queryFn: async () => {
      if (!actor)
        return {
          formeJuridique: "EI",
          regimeFiscal: "IR",
          regimeSocial: "TNS",
        };
      console.log("[getParametresJuridiques] fetching...");
      const result = await typed(actor).getParametresJuridiques();
      console.log("[getParametresJuridiques] result:", JSON.stringify(result));
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSaveParametresJuridiques() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: ParametresJuridiques) => {
      const a = requireActor(actor);
      console.log("[saveParametresJuridiques] payload:", JSON.stringify(p));
      return typed(a).saveParametresJuridiques(p);
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["parametresJuridiques"] }),
  });
}

// ── AMORTISSEMENTS ──────────────────────────────────────────────────────────────────────────

export function useAmortissements() {
  const { actor, isFetching } = useActor();
  return useQuery<LigneAmortissement[]>({
    queryKey: ["amortissements"],
    queryFn: async () => {
      if (!actor) {
        console.warn("[getAmortissements] actor is null, returning []");
        return [];
      }
      console.log("[getAmortissements] fetching...");
      const result = await typed(actor).getAmortissements();
      console.log("[getAmortissements] got", result.length, "items");
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateAmortissement() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Omit<LigneAmortissement, "id">) => {
      const a = requireActor(actor);
      console.log("[createAmortissement] payload:", JSON.stringify(v));
      return typed(a).createAmortissement(v.nom, v.coutTotal, v.dureeMois);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["amortissements"] }),
  });
}

export function useUpdateAmortissement() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: LigneAmortissement) => {
      const a = requireActor(actor);
      console.log("[updateAmortissement] payload:", JSON.stringify(v));
      return typed(a).updateAmortissement(
        v.id,
        v.nom,
        v.coutTotal,
        v.dureeMois,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["amortissements"] }),
  });
}

export function useDeleteAmortissement() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const a = requireActor(actor);
      console.log("[deleteAmortissement] id:", id);
      return typed(a).deleteAmortissement(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["amortissements"] }),
  });
}

// ── JOURS OUVERTURE PAR SEMAINE ──────────────────────────────────────────────

export function useJoursOuvertureParSemaine() {
  const { actor, isFetching } = useActor();
  return useQuery<number>({
    queryKey: ["joursOuverture"],
    queryFn: async () => {
      if (!actor) return 6;
      const result = await typed(actor).getJoursOuvertureParSemaine();
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSaveJoursOuvertureParSemaine() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: number) => {
      const a = requireActor(actor);
      return typed(a).saveJoursOuvertureParSemaine(v);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["joursOuverture"] }),
  });
}

// ── MIX PRODUIT PAR CATEGORIE ────────────────────────────────────────────────

export function useMixProduitParCategorie() {
  const { actor, isFetching } = useActor();
  return useQuery<[string, number][]>({
    queryKey: ["mixProduit"],
    queryFn: async () => {
      if (!actor) return [];
      const result = await typed(actor).getMixProduitParCategorie();
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSaveMixProduitParCategorie() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: [string, number][]) => {
      const a = requireActor(actor);
      return typed(a).saveMixProduitParCategorie(m);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mixProduit"] }),
  });
}
