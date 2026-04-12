/* eslint-disable */

// @ts-nocheck

import { IDL } from '@icp-sdk/core/candid';

const RecetteIngredient = IDL.Record({
  ingredientId: IDL.Text,
  quantite: IDL.Float64,
  unite: IDL.Text,
});

const Ingredient = IDL.Record({
  id: IDL.Text,
  nom: IDL.Text,
  unite: IDL.Text,
  prixUnitaireHT: IDL.Float64,
  seuilSecurite: IDL.Float64,
  stockInitial: IDL.Float64,
});

const Recette = IDL.Record({
  id: IDL.Text,
  nom: IDL.Text,
  categorie: IDL.Text,
  categorieTVA: IDL.Text,
  tauxTVA: IDL.Float64,
  ingredients: IDL.Vec(RecetteIngredient),
  consommablesHT: IDL.Float64,
  prixVenteTTC: IDL.Float64,
});

const LigneFraisFixes = IDL.Record({
  nom: IDL.Text,
  montantMensuelAvecRemu: IDL.Float64,
  montantMensuelHorsRemu: IDL.Float64,
});

const ParametresRentabilite = IDL.Record({
  ticketMoyenHT: IDL.Float64,
  nbClientsParSemaine: IDL.Float64,
  nbSemainesSaison: IDL.Float64,
  tauxFoodCostParCategorie: IDL.Vec(IDL.Tuple(IDL.Text, IDL.Float64)),
});

const MouvementStock = IDL.Record({
  id: IDL.Text,
  ingredientId: IDL.Text,
  date: IDL.Text,
  typeOp: IDL.Text,
  quantite: IDL.Float64,
  motif: IDL.Text,
});

const VenteRecette = IDL.Record({
  id: IDL.Text,
  recetteId: IDL.Text,
  date: IDL.Text,
  quantite: IDL.Float64,
});

const Emprunt = IDL.Record({
  id: IDL.Text,
  nom: IDL.Text,
  montant: IDL.Float64,
  tauxAnnuel: IDL.Float64,
  dureeMois: IDL.Nat,
  dateDebut: IDL.Text,
  differeMois: IDL.Nat,
});

const AssocieGerant = IDL.Record({
  id: IDL.Text,
  nom: IDL.Text,
  statut: IDL.Text,
  remunerationAnnuelle: IDL.Float64,
});

const Salarie = IDL.Record({
  id: IDL.Text,
  nom: IDL.Text,
  poste: IDL.Text,
  salaireAnnuelBrut: IDL.Float64,
});

const ParametresJuridiques = IDL.Record({
  formeJuridique: IDL.Text,
  regimeFiscal: IDL.Text,
  regimeSocial: IDL.Text,
});

const LigneAmortissement = IDL.Record({
  id: IDL.Text,
  nom: IDL.Text,
  coutTotal: IDL.Float64,
  dureeMois: IDL.Nat,
});

export const idlService = IDL.Service({
  getIngredients: IDL.Func([], [IDL.Vec(Ingredient)], ['query']),
  createIngredient: IDL.Func([IDL.Text, IDL.Text, IDL.Float64, IDL.Float64, IDL.Float64], [Ingredient], []),
  updateIngredient: IDL.Func([IDL.Text, IDL.Text, IDL.Text, IDL.Float64, IDL.Float64, IDL.Float64], [IDL.Bool], []),
  deleteIngredient: IDL.Func([IDL.Text], [IDL.Bool], []),
  getRecettes: IDL.Func([], [IDL.Vec(Recette)], ['query']),
  createRecette: IDL.Func([IDL.Text, IDL.Text, IDL.Text, IDL.Float64, IDL.Vec(RecetteIngredient), IDL.Float64, IDL.Float64], [Recette], []),
  updateRecette: IDL.Func([IDL.Text, IDL.Text, IDL.Text, IDL.Text, IDL.Float64, IDL.Vec(RecetteIngredient), IDL.Float64, IDL.Float64], [IDL.Bool], []),
  deleteRecette: IDL.Func([IDL.Text], [IDL.Bool], []),
  getFraisFixes: IDL.Func([], [IDL.Vec(LigneFraisFixes)], ['query']),
  saveFraisFixes: IDL.Func([IDL.Vec(LigneFraisFixes)], [IDL.Bool], []),
  getParametres: IDL.Func([], [ParametresRentabilite], ['query']),
  saveParametres: IDL.Func([ParametresRentabilite], [IDL.Bool], []),
  getJoursOuvertureParSemaine: IDL.Func([], [IDL.Float64], ['query']),
  saveJoursOuvertureParSemaine: IDL.Func([IDL.Float64], [IDL.Bool], []),
  getMixProduitParCategorie: IDL.Func([], [IDL.Vec(IDL.Tuple(IDL.Text, IDL.Float64))], ['query']),
  saveMixProduitParCategorie: IDL.Func([IDL.Vec(IDL.Tuple(IDL.Text, IDL.Float64))], [IDL.Bool], []),
  getMouvementsStock: IDL.Func([], [IDL.Vec(MouvementStock)], ['query']),
  createMouvement: IDL.Func([IDL.Text, IDL.Text, IDL.Text, IDL.Float64, IDL.Text], [MouvementStock], []),
  deleteMouvement: IDL.Func([IDL.Text], [IDL.Bool], []),
  getVentesRecettes: IDL.Func([], [IDL.Vec(VenteRecette)], ['query']),
  createVente: IDL.Func([IDL.Text, IDL.Text, IDL.Float64], [VenteRecette], []),
  deleteVente: IDL.Func([IDL.Text], [IDL.Bool], []),
  getEmprunts: IDL.Func([], [IDL.Vec(Emprunt)], ['query']),
  createEmprunt: IDL.Func([IDL.Text, IDL.Float64, IDL.Float64, IDL.Nat, IDL.Text, IDL.Nat], [Emprunt], []),
  updateEmprunt: IDL.Func([IDL.Text, IDL.Text, IDL.Float64, IDL.Float64, IDL.Nat, IDL.Text, IDL.Nat], [IDL.Bool], []),
  deleteEmprunt: IDL.Func([IDL.Text], [IDL.Bool], []),
  getAssociesGerants: IDL.Func([], [IDL.Vec(AssocieGerant)], ['query']),
  createAssocieGerant: IDL.Func([IDL.Text, IDL.Text, IDL.Float64], [AssocieGerant], []),
  updateAssocieGerant: IDL.Func([IDL.Text, IDL.Text, IDL.Text, IDL.Float64], [IDL.Bool], []),
  deleteAssocieGerant: IDL.Func([IDL.Text], [IDL.Bool], []),
  getSalaries: IDL.Func([], [IDL.Vec(Salarie)], ['query']),
  createSalarie: IDL.Func([IDL.Text, IDL.Text, IDL.Float64], [Salarie], []),
  updateSalarie: IDL.Func([IDL.Text, IDL.Text, IDL.Text, IDL.Float64], [IDL.Bool], []),
  deleteSalarie: IDL.Func([IDL.Text], [IDL.Bool], []),
  getParametresJuridiques: IDL.Func([], [ParametresJuridiques], ['query']),
  saveParametresJuridiques: IDL.Func([ParametresJuridiques], [IDL.Bool], []),
  getAmortissements: IDL.Func([], [IDL.Vec(LigneAmortissement)], ['query']),
  createAmortissement: IDL.Func([IDL.Text, IDL.Float64, IDL.Nat], [LigneAmortissement], []),
  updateAmortissement: IDL.Func([IDL.Text, IDL.Text, IDL.Float64, IDL.Nat], [IDL.Bool], []),
  deleteAmortissement: IDL.Func([IDL.Text], [IDL.Bool], []),
});

export const idlInitArgs = [];

export const idlFactory = ({ IDL }) => {
  const RecetteIngredient = IDL.Record({
    ingredientId: IDL.Text,
    quantite: IDL.Float64,
    unite: IDL.Text,
  });
  const Ingredient = IDL.Record({
    id: IDL.Text,
    nom: IDL.Text,
    unite: IDL.Text,
    prixUnitaireHT: IDL.Float64,
    seuilSecurite: IDL.Float64,
    stockInitial: IDL.Float64,
  });
  const Recette = IDL.Record({
    id: IDL.Text,
    nom: IDL.Text,
    categorie: IDL.Text,
    categorieTVA: IDL.Text,
    tauxTVA: IDL.Float64,
    ingredients: IDL.Vec(RecetteIngredient),
    consommablesHT: IDL.Float64,
    prixVenteTTC: IDL.Float64,
  });
  const LigneFraisFixes = IDL.Record({
    nom: IDL.Text,
    montantMensuelAvecRemu: IDL.Float64,
    montantMensuelHorsRemu: IDL.Float64,
  });
  const ParametresRentabilite = IDL.Record({
    ticketMoyenHT: IDL.Float64,
    nbClientsParSemaine: IDL.Float64,
    nbSemainesSaison: IDL.Float64,
    tauxFoodCostParCategorie: IDL.Vec(IDL.Tuple(IDL.Text, IDL.Float64)),
  });
  const MouvementStock = IDL.Record({
    id: IDL.Text,
    ingredientId: IDL.Text,
    date: IDL.Text,
    typeOp: IDL.Text,
    quantite: IDL.Float64,
    motif: IDL.Text,
  });
  const VenteRecette = IDL.Record({
    id: IDL.Text,
    recetteId: IDL.Text,
    date: IDL.Text,
    quantite: IDL.Float64,
  });
  const Emprunt = IDL.Record({
    id: IDL.Text,
    nom: IDL.Text,
    montant: IDL.Float64,
    tauxAnnuel: IDL.Float64,
    dureeMois: IDL.Nat,
    dateDebut: IDL.Text,
    differeMois: IDL.Nat,
  });
  const AssocieGerant = IDL.Record({
    id: IDL.Text,
    nom: IDL.Text,
    statut: IDL.Text,
    remunerationAnnuelle: IDL.Float64,
  });
  const Salarie = IDL.Record({
    id: IDL.Text,
    nom: IDL.Text,
    poste: IDL.Text,
    salaireAnnuelBrut: IDL.Float64,
  });
  const ParametresJuridiques = IDL.Record({
    formeJuridique: IDL.Text,
    regimeFiscal: IDL.Text,
    regimeSocial: IDL.Text,
  });
  const LigneAmortissement = IDL.Record({
    id: IDL.Text,
    nom: IDL.Text,
    coutTotal: IDL.Float64,
    dureeMois: IDL.Nat,
  });
  return IDL.Service({
    getIngredients: IDL.Func([], [IDL.Vec(Ingredient)], ['query']),
    createIngredient: IDL.Func([IDL.Text, IDL.Text, IDL.Float64, IDL.Float64, IDL.Float64], [Ingredient], []),
    updateIngredient: IDL.Func([IDL.Text, IDL.Text, IDL.Text, IDL.Float64, IDL.Float64, IDL.Float64], [IDL.Bool], []),
    deleteIngredient: IDL.Func([IDL.Text], [IDL.Bool], []),
    getRecettes: IDL.Func([], [IDL.Vec(Recette)], ['query']),
    createRecette: IDL.Func([IDL.Text, IDL.Text, IDL.Text, IDL.Float64, IDL.Vec(RecetteIngredient), IDL.Float64, IDL.Float64], [Recette], []),
    updateRecette: IDL.Func([IDL.Text, IDL.Text, IDL.Text, IDL.Text, IDL.Float64, IDL.Vec(RecetteIngredient), IDL.Float64, IDL.Float64], [IDL.Bool], []),
    deleteRecette: IDL.Func([IDL.Text], [IDL.Bool], []),
    getFraisFixes: IDL.Func([], [IDL.Vec(LigneFraisFixes)], ['query']),
    saveFraisFixes: IDL.Func([IDL.Vec(LigneFraisFixes)], [IDL.Bool], []),
    getParametres: IDL.Func([], [ParametresRentabilite], ['query']),
    saveParametres: IDL.Func([ParametresRentabilite], [IDL.Bool], []),
    getJoursOuvertureParSemaine: IDL.Func([], [IDL.Float64], ['query']),
    saveJoursOuvertureParSemaine: IDL.Func([IDL.Float64], [IDL.Bool], []),
    getMixProduitParCategorie: IDL.Func([], [IDL.Vec(IDL.Tuple(IDL.Text, IDL.Float64))], ['query']),
    saveMixProduitParCategorie: IDL.Func([IDL.Vec(IDL.Tuple(IDL.Text, IDL.Float64))], [IDL.Bool], []),
    getMouvementsStock: IDL.Func([], [IDL.Vec(MouvementStock)], ['query']),
    createMouvement: IDL.Func([IDL.Text, IDL.Text, IDL.Text, IDL.Float64, IDL.Text], [MouvementStock], []),
    deleteMouvement: IDL.Func([IDL.Text], [IDL.Bool], []),
    getVentesRecettes: IDL.Func([], [IDL.Vec(VenteRecette)], ['query']),
    createVente: IDL.Func([IDL.Text, IDL.Text, IDL.Float64], [VenteRecette], []),
    deleteVente: IDL.Func([IDL.Text], [IDL.Bool], []),
    getEmprunts: IDL.Func([], [IDL.Vec(Emprunt)], ['query']),
    createEmprunt: IDL.Func([IDL.Text, IDL.Float64, IDL.Float64, IDL.Nat, IDL.Text, IDL.Nat], [Emprunt], []),
    updateEmprunt: IDL.Func([IDL.Text, IDL.Text, IDL.Float64, IDL.Float64, IDL.Nat, IDL.Text, IDL.Nat], [IDL.Bool], []),
    deleteEmprunt: IDL.Func([IDL.Text], [IDL.Bool], []),
    getAssociesGerants: IDL.Func([], [IDL.Vec(AssocieGerant)], ['query']),
    createAssocieGerant: IDL.Func([IDL.Text, IDL.Text, IDL.Float64], [AssocieGerant], []),
    updateAssocieGerant: IDL.Func([IDL.Text, IDL.Text, IDL.Text, IDL.Float64], [IDL.Bool], []),
    deleteAssocieGerant: IDL.Func([IDL.Text], [IDL.Bool], []),
    getSalaries: IDL.Func([], [IDL.Vec(Salarie)], ['query']),
    createSalarie: IDL.Func([IDL.Text, IDL.Text, IDL.Float64], [Salarie], []),
    updateSalarie: IDL.Func([IDL.Text, IDL.Text, IDL.Text, IDL.Float64], [IDL.Bool], []),
    deleteSalarie: IDL.Func([IDL.Text], [IDL.Bool], []),
    getParametresJuridiques: IDL.Func([], [ParametresJuridiques], ['query']),
    saveParametresJuridiques: IDL.Func([ParametresJuridiques], [IDL.Bool], []),
    getAmortissements: IDL.Func([], [IDL.Vec(LigneAmortissement)], ['query']),
    createAmortissement: IDL.Func([IDL.Text, IDL.Float64, IDL.Nat], [LigneAmortissement], []),
    updateAmortissement: IDL.Func([IDL.Text, IDL.Text, IDL.Float64, IDL.Nat], [IDL.Bool], []),
    deleteAmortissement: IDL.Func([IDL.Text], [IDL.Bool], []),
  });
};

export const init = ({ IDL }) => { return []; };
