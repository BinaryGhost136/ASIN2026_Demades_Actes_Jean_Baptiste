import express, { type Express } from "express";
import { fileURLToPath } from "node:url";
import type { DemandeService } from "../domain/demande.service.js";
import { gestionnaireErreurs, routeInconnue } from "./error-handler.js";
import { creerRoutes } from "./routes.js";

const DOSSIER_PUBLIC = fileURLToPath(new URL("../../public", import.meta.url));

export function creerApp(service: DemandeService): Express {
  const app = express();
  app.disable("x-powered-by");

  app.use(express.json({ limit: "10kb" }));
  app.use(express.static(DOSSIER_PUBLIC)); // écran de consultation (public/index.html)

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use(creerRoutes(service));

  app.use(routeInconnue);
  app.use(gestionnaireErreurs);
  return app;
}
