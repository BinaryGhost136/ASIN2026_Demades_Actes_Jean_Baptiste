import { Router } from "express";
import {
  LIBELLES_STATUT,
  LIBELLES_TYPE_ACTE,
  STATUTS,
  TRANSITIONS,
  TYPES_ACTE,
} from "../domain/demande.js";
import type { DemandeService } from "../domain/demande.service.js";
import {
  changerStatutSchema,
  deposerSchema,
  idSchema,
  listerSchema,
  npiSchema,
  statistiquesSchema,
  valider,
} from "../domain/rules.js";

/** Routes REST. Chaque route : valider la saisie → appeler le service → répondre. */
export function creerRoutes(service: DemandeService): Router {
  const router = Router();

  // Valeurs de référence (utilisées par l'écran, utiles à tout client de l'API).
  router.get("/referentiels", (_req, res) => {
    res.json({
      typesActe: TYPES_ACTE.map((code) => ({ code, libelle: LIBELLES_TYPE_ACTE[code] })),
      statuts: STATUTS.map((code) => ({ code, libelle: LIBELLES_STATUT[code] })),
      transitions: TRANSITIONS,
    });
  });

  // 1. Déposer une demande
  router.post("/demandes", (req, res) => {
    const demande = service.deposer(valider(deposerSchema, req.body));
    res.status(201).location(`/demandes/${demande.id}`).json(demande);
  });

  // Bonus : nombre de demandes par statut (déclarée avant /demandes/:id)
  router.get("/demandes/statistiques", (req, res) => {
    const { npi } = valider(statistiquesSchema, req.query);
    res.json(service.statistiques(npi));
  });

  router.get("/demandes/:id", (req, res) => {
    res.json(service.consulter(valider(idSchema, req.params.id, "id")));
  });

  // 3. Faire avancer le traitement d'une demande
  router.patch("/demandes/:id/statut", (req, res) => {
    const id = valider(idSchema, req.params.id, "id");
    res.json(service.changerStatut(id, valider(changerStatutSchema, req.body)));
  });

  // 2. Consulter les demandes d'un usager (filtre par statut + pagination)
  router.get("/usagers/:npi/demandes", (req, res) => {
    const npi = valider(npiSchema, req.params.npi, "npi");
    res.json(service.lister(npi, valider(listerSchema, req.query)));
  });

  return router;
}
