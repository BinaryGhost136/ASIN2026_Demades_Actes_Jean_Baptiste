import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError, NotFoundError } from "../domain/errors.js";

/** Format d'erreur unique pour toute l'API : { "error": { code, message, details? } }. */
const reponseErreur = (code: string, message: string, details?: unknown) => ({
  error: { code, message, ...(details ? { details } : {}) },
});

export const routeInconnue: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route introuvable : ${req.method} ${req.path}`, "ROUTE_INTROUVABLE"));
};

const typeErreurHttp = (err: unknown): string | undefined =>
  typeof err === "object" && err !== null && "type" in err ? String(err.type) : undefined;

export const gestionnaireErreurs: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json(reponseErreur(err.code, err.message, err.details));
    return;
  }
  // Erreurs levées par express.json()
  if (typeErreurHttp(err) === "entity.parse.failed") {
    res
      .status(400)
      .json(reponseErreur("JSON_INVALIDE", "Le corps de la requête n'est pas un JSON valide."));
    return;
  }
  if (typeErreurHttp(err) === "entity.too.large") {
    res.status(413).json(reponseErreur("CORPS_TROP_VOLUMINEUX", "Le corps de la requête est trop volumineux."));
    return;
  }
  // Erreur imprévue : détail dans les logs, jamais envoyé au client.
  console.error(err);
  res.status(500).json(reponseErreur("ERREUR_INTERNE", "Une erreur interne est survenue."));
};
