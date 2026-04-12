import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;

export interface RecetteIngredient {
  ingredientId: string;
  quantite: number;
  unite: string;
}

export interface Ingredient {
  id: string;
  nom: string;
  unite: string;
  prixUnitaireHT: number;
  seuilSecurite: number;
  stockInitial: number;
}

export interface Recette {
  id: string;
  nom: string;
  categorie: string;
  categorieTVA: string;
  tauxTVA: number;
  ingredients: RecetteIngredient[];
  consommablesHT: number;
  prixVenteTTC: number;
}

export interface LigneFraisFixes {
  nom: string;
  montantMensuelAvecRemu: number;
  montantMensuelHorsRemu: number;
}

export interface ParametresRentabilite {
  ticketMoyenHT: number;
  nbClientsParSemaine: number;
  nbSemainesSaison: number;
  tauxFoodCostParCategorie: [string, number][];
}

export interface MouvementStock {
  id: string;
  ingredientId: string;
  date: string;
  typeOp: string;
  quantite: number;
  motif: string;
}

export interface VenteRecette {
  id: string;
  recetteId: string;
  date: string;
  quantite: number;
}

export interface Emprunt {
  id: string;
  nom: string;
  montant: number;
  tauxAnnuel: number;
  dureeMois: number;
  dateDebut: string;
  differeMois: number;
}

export interface AssocieGerant {
  id: string;
  nom: string;
  statut: string; // "TNS" ou "assimile"
  remunerationAnnuelle: number;
}

export interface Salarie {
  id: string;
  nom: string;
  poste: string;
  salaireAnnuelBrut: number;
}

export interface ParametresJuridiques {
  formeJuridique: string; // "EI", "EIRL", "EURL", "SARL", "SAS", "SASU", "SA"
  regimeFiscal: string;   // "IR" ou "IS"
  regimeSocial: string;   // "TNS" ou "assimile"
}

export interface LigneAmortissement {
  id: string;
  nom: string;
  coutTotal: number;
  dureeMois: number;
}

export interface backendInterface {
  getIngredients(): Promise<Ingredient[]>;
  createIngredient(nom: string, unite: string, prixUnitaireHT: number, seuilSecurite: number, stockInitial: number): Promise<Ingredient>;
  updateIngredient(id: string, nom: string, unite: string, prixUnitaireHT: number, seuilSecurite: number, stockInitial: number): Promise<boolean>;
  deleteIngredient(id: string): Promise<boolean>;

  getRecettes(): Promise<Recette[]>;
  createRecette(nom: string, categorie: string, categorieTVA: string, tauxTVA: number, ingredients: RecetteIngredient[], consommablesHT: number, prixVenteTTC: number): Promise<Recette>;
  updateRecette(id: string, nom: string, categorie: string, categorieTVA: string, tauxTVA: number, ingredients: RecetteIngredient[], consommablesHT: number, prixVenteTTC: number): Promise<boolean>;
  deleteRecette(id: string): Promise<boolean>;

  getFraisFixes(): Promise<LigneFraisFixes[]>;
  saveFraisFixes(lignes: LigneFraisFixes[]): Promise<boolean>;

  getParametres(): Promise<ParametresRentabilite>;
  saveParametres(p: ParametresRentabilite): Promise<boolean>;

  getJoursOuvertureParSemaine(): Promise<number>;
  saveJoursOuvertureParSemaine(v: number): Promise<boolean>;

  getMixProduitParCategorie(): Promise<[string, number][]>;
  saveMixProduitParCategorie(m: [string, number][]): Promise<boolean>;

  getMouvementsStock(): Promise<MouvementStock[]>;
  createMouvement(ingredientId: string, date: string, typeOp: string, quantite: number, motif: string): Promise<MouvementStock>;
  deleteMouvement(id: string): Promise<boolean>;

  getVentesRecettes(): Promise<VenteRecette[]>;
  createVente(recetteId: string, date: string, quantite: number): Promise<VenteRecette>;
  deleteVente(id: string): Promise<boolean>;

  getEmprunts(): Promise<Emprunt[]>;
  createEmprunt(nom: string, montant: number, tauxAnnuel: number, dureeMois: number, dateDebut: string, differeMois: number): Promise<Emprunt>;
  updateEmprunt(id: string, nom: string, montant: number, tauxAnnuel: number, dureeMois: number, dateDebut: string, differeMois: number): Promise<boolean>;
  deleteEmprunt(id: string): Promise<boolean>;

  getAssociesGerants(): Promise<AssocieGerant[]>;
  createAssocieGerant(nom: string, statut: string, remunerationAnnuelle: number): Promise<AssocieGerant>;
  updateAssocieGerant(id: string, nom: string, statut: string, remunerationAnnuelle: number): Promise<boolean>;
  deleteAssocieGerant(id: string): Promise<boolean>;

  getSalaries(): Promise<Salarie[]>;
  createSalarie(nom: string, poste: string, salaireAnnuelBrut: number): Promise<Salarie>;
  updateSalarie(id: string, nom: string, poste: string, salaireAnnuelBrut: number): Promise<boolean>;
  deleteSalarie(id: string): Promise<boolean>;

  getParametresJuridiques(): Promise<ParametresJuridiques>;
  saveParametresJuridiques(p: ParametresJuridiques): Promise<boolean>;

  getAmortissements(): Promise<LigneAmortissement[]>;
  createAmortissement(nom: string, coutTotal: number, dureeMois: number): Promise<LigneAmortissement>;
  updateAmortissement(id: string, nom: string, coutTotal: number, dureeMois: number): Promise<boolean>;
  deleteAmortissement(id: string): Promise<boolean>;
}
