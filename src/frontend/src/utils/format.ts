import type { Ingredient, Recette, RecetteIngredient } from "../backend.d";

export function fmtEur(n: number): string {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function fmtPct(n: number): string {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

export function coutMatiereHT(
  recette: { ingredients: RecetteIngredient[]; consommablesHT: number },
  ingredientsMap: Map<string, Pick<Ingredient, "prixUnitaireHT">>,
): number {
  const total = recette.ingredients.reduce((sum, ri) => {
    const ing = ingredientsMap.get(ri.ingredientId);
    return sum + (ing ? ri.quantite * ing.prixUnitaireHT : 0);
  }, 0);
  return total + recette.consommablesHT;
}

export function prixHT(prixTTC: number, tauxTVA: number): number {
  return prixTTC / (1 + tauxTVA / 100);
}

export function margeBrute(pHT: number, coutHT: number): number {
  if (pHT === 0) return 0;
  return ((pHT - coutHT) / pHT) * 100;
}

export type { Recette, RecetteIngredient, Ingredient };
