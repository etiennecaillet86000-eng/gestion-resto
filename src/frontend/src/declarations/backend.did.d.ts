/* eslint-disable */

// @ts-nocheck

import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';
import type { Principal } from '@icp-sdk/core/principal';

export interface RecetteIngredient { ingredientId: string; quantite: number; unite: string; }
export interface Ingredient { id: string; nom: string; unite: string; prixUnitaireHT: number; seuilSecurite: number; stockInitial: number; }
export interface Recette { id: string; nom: string; categorie: string; categorieTVA: string; tauxTVA: number; ingredients: RecetteIngredient[]; consommablesHT: number; prixVenteTTC: number; }
export interface LigneFraisFixes { nom: string; montantMensuelAvecRemu: number; montantMensuelHorsRemu: number; }
export interface ParametresRentabilite { ticketMoyenHT: number; nbClientsParSemaine: number; nbSemainesSaison: number; tauxFoodCostParCategorie: [string, number][]; }
export interface MouvementStock { id: string; ingredientId: string; date: string; typeOp: string; quantite: number; motif: string; }
export interface VenteRecette { id: string; recetteId: string; date: string; quantite: number; }
export interface Emprunt { id: string; nom: string; montant: number; tauxAnnuel: number; dureeMois: bigint; dateDebut: string; differeMois: bigint; }
export interface AssocieGerant { id: string; nom: string; statut: string; remunerationAnnuelle: number; }
export interface Salarie { id: string; nom: string; poste: string; salaireAnnuelBrut: number; }
export interface ParametresJuridiques { formeJuridique: string; regimeFiscal: string; regimeSocial: string; }
export interface LigneAmortissement { id: string; nom: string; coutTotal: number; dureeMois: bigint; }

export interface _SERVICE {
  getIngredients: ActorMethod<[], Ingredient[]>;
  createIngredient: ActorMethod<[string, string, number, number, number], Ingredient>;
  updateIngredient: ActorMethod<[string, string, string, number, number, number], boolean>;
  deleteIngredient: ActorMethod<[string], boolean>;
  getRecettes: ActorMethod<[], Recette[]>;
  createRecette: ActorMethod<[string, string, string, number, RecetteIngredient[], number, number], Recette>;
  updateRecette: ActorMethod<[string, string, string, string, number, RecetteIngredient[], number, number], boolean>;
  deleteRecette: ActorMethod<[string], boolean>;
  getFraisFixes: ActorMethod<[], LigneFraisFixes[]>;
  saveFraisFixes: ActorMethod<[LigneFraisFixes[]], boolean>;
  getParametres: ActorMethod<[], ParametresRentabilite>;
  saveParametres: ActorMethod<[ParametresRentabilite], boolean>;
  getJoursOuvertureParSemaine: ActorMethod<[], number>;
  saveJoursOuvertureParSemaine: ActorMethod<[number], boolean>;
  getMixProduitParCategorie: ActorMethod<[], [string, number][]>;
  saveMixProduitParCategorie: ActorMethod<[[string, number][]], boolean>;
  getMouvementsStock: ActorMethod<[], MouvementStock[]>;
  createMouvement: ActorMethod<[string, string, string, number, string], MouvementStock>;
  deleteMouvement: ActorMethod<[string], boolean>;
  getVentesRecettes: ActorMethod<[], VenteRecette[]>;
  createVente: ActorMethod<[string, string, number], VenteRecette>;
  deleteVente: ActorMethod<[string], boolean>;
  getEmprunts: ActorMethod<[], Emprunt[]>;
  createEmprunt: ActorMethod<[string, number, number, bigint, string, bigint], Emprunt>;
  updateEmprunt: ActorMethod<[string, string, number, number, bigint, string, bigint], boolean>;
  deleteEmprunt: ActorMethod<[string], boolean>;
  getAssociesGerants: ActorMethod<[], AssocieGerant[]>;
  createAssocieGerant: ActorMethod<[string, string, number], AssocieGerant>;
  updateAssocieGerant: ActorMethod<[string, string, string, number], boolean>;
  deleteAssocieGerant: ActorMethod<[string], boolean>;
  getSalaries: ActorMethod<[], Salarie[]>;
  createSalarie: ActorMethod<[string, string, number], Salarie>;
  updateSalarie: ActorMethod<[string, string, string, number], boolean>;
  deleteSalarie: ActorMethod<[string], boolean>;
  getParametresJuridiques: ActorMethod<[], ParametresJuridiques>;
  saveParametresJuridiques: ActorMethod<[ParametresJuridiques], boolean>;
  getAmortissements: ActorMethod<[], LigneAmortissement[]>;
  createAmortissement: ActorMethod<[string, number, bigint], LigneAmortissement>;
  updateAmortissement: ActorMethod<[string, string, number, bigint], boolean>;
  deleteAmortissement: ActorMethod<[string], boolean>;
}
export declare const idlService: IDL.ServiceClass;
export declare const idlInitArgs: IDL.Type[];
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
