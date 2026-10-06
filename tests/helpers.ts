import type { AddressInfo } from "node:net";
import { DemandeService } from "../src/domain/demande.service.js";
import { creerApp } from "../src/http/app.js";
import { BASE_EN_MEMOIRE, ouvrirBase } from "../src/infra/database.js";
import { SqliteDemandeRepository } from "../src/infra/sqlite-demande.repository.js";

/** Horloge déterministe : chaque appel avance d'une seconde (ordre des demandes prévisible). */
export function horlogeFictive(debut = "2026-01-01T00:00:00.000Z") {
  let instant = new Date(debut).getTime();
  return () => new Date((instant += 1000));
}

/** Service branché sur une base SQLite en mémoire, vierge à chaque appel. */
export function creerServiceDeTest() {
  const base = ouvrirBase(BASE_EN_MEMOIRE);
  const service = new DemandeService(new SqliteDemandeRepository(base), horlogeFictive());
  return { service, base };
}

/** Serveur HTTP réel sur un port libre, pour tester l'API de bout en bout. */
export async function demarrerServeurDeTest() {
  const { service, base } = creerServiceDeTest();
  const serveur = creerApp(service).listen(0);
  await new Promise((ok) => serveur.once("listening", ok));
  const url = `http://localhost:${(serveur.address() as AddressInfo).port}`;

  const requete = async (methode: string, chemin: string, corps?: unknown) => {
    const reponse = await fetch(url + chemin, {
      method: methode,
      headers: corps === undefined ? {} : { "Content-Type": "application/json" },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    const json = await reponse.json().catch(() => null);
    return { status: reponse.status, headers: reponse.headers, json };
  };

  return {
    url,
    requete,
    arreter: () => {
      serveur.close();
      base.close();
    },
  };
}

export const DEPOT_VALIDE = {
  npi: "0123456789",
  typeActe: "ACTE_NAISSANCE",
  nombreCopies: 2,
} as const;
