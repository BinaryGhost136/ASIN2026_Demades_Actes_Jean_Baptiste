import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { DEPOT_VALIDE, demarrerServeurDeTest } from "./helpers.js";

let api: Awaited<ReturnType<typeof demarrerServeurDeTest>>;
before(async () => {
  api = await demarrerServeurDeTest();
});
after(() => api.arreter());

describe("API — scénario de recette de bout en bout", () => {
  test("POST /demandes → 201, Location et statut DEPOSEE", async () => {
    const { status, headers, json } = await api.requete("POST", "/demandes", DEPOT_VALIDE);
    assert.equal(status, 201);
    assert.equal(headers.get("location"), `/demandes/${json.id}`);
    assert.equal(json.statut, "DEPOSEE");
    assert.equal(typeof json.id, "number");
  });

  test("POST /demandes invalide → 400 avec un message clair", async () => {
    const { status, json } = await api.requete("POST", "/demandes", { ...DEPOT_VALIDE, npi: "123" });
    assert.equal(status, 400);
    assert.equal(json.error.code, "VALIDATION_ERROR");
    assert.match(json.error.message, /exactement 10 chiffres/);
    assert.equal(json.error.details[0].champ, "npi");
  });

  test("POST /demandes avec un JSON cassé → 400", async () => {
    const reponse = await fetch(`${api.url}/demandes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{oups",
    });
    assert.equal(reponse.status, 400);
    assert.equal(((await reponse.json()) as { error: { code: string } }).error.code, "JSON_INVALIDE");
  });

  test("GET /usagers/:npi/demandes : récent d'abord, filtre et pagination", async () => {
    const npi = "1111111111";
    for (let i = 0; i < 22; i++) await api.requete("POST", "/demandes", { ...DEPOT_VALIDE, npi });
    const premiere = (await api.requete("GET", `/usagers/${npi}/demandes`)).json;
    const seconde = (await api.requete("GET", `/usagers/${npi}/demandes?page=2`)).json;

    assert.equal(premiere.data.length, 20);
    assert.equal(seconde.data.length, 2);
    assert.ok(premiere.data[0].id > premiere.data[1].id);
    assert.deepEqual(premiere.pagination, { page: 1, taille: 20, total: 22, totalPages: 2 });

    const filtre = (await api.requete("GET", `/usagers/${npi}/demandes?statut=VALIDEE`)).json;
    assert.equal(filtre.data.length, 0);
  });

  test("GET /usagers/:npi/demandes avec un NPI ou un statut invalide → 400", async () => {
    assert.equal((await api.requete("GET", "/usagers/abc/demandes")).status, 400);
    assert.equal((await api.requete("GET", "/usagers/0123456789/demandes?statut=X")).status, 400);
  });

  test("PATCH /demandes/:id/statut : cycle de vie complet puis action interdite", async () => {
    const { id } = (await api.requete("POST", "/demandes", DEPOT_VALIDE)).json;

    const interdit = await api.requete("PATCH", `/demandes/${id}/statut`, { statut: "VALIDEE" });
    assert.equal(interdit.status, 409);
    assert.match(interdit.json.error.message, /Transition interdite/);

    assert.equal((await api.requete("PATCH", `/demandes/${id}/statut`, { statut: "EN_COURS" })).json.statut, "EN_COURS");

    const sansMotif = await api.requete("PATCH", `/demandes/${id}/statut`, { statut: "REJETEE" });
    assert.equal(sansMotif.status, 400);
    assert.match(sansMotif.json.error.message, /motivé/);

    const rejet = await api.requete("PATCH", `/demandes/${id}/statut`, { statut: "REJETEE", motifRejet: "Pièce manquante" });
    assert.equal(rejet.status, 200);
    assert.equal(rejet.json.motifRejet, "Pièce manquante");

    const final = await api.requete("PATCH", `/demandes/${id}/statut`, { statut: "EN_COURS" });
    assert.equal(final.status, 409);
    assert.match(final.json.error.message, /ne peut plus changer/);
  });

  test("demande inexistante → 404 ; identifiant invalide → 400", async () => {
    assert.equal((await api.requete("GET", "/demandes/99999")).status, 404);
    assert.equal((await api.requete("PATCH", "/demandes/99999/statut", { statut: "EN_COURS" })).status, 404);
    assert.equal((await api.requete("GET", "/demandes/abc")).status, 400);
  });

  test("GET /demandes/statistiques : nombre par statut", async () => {
    const { status, json } = await api.requete("GET", "/demandes/statistiques");
    assert.equal(status, 200);
    assert.deepEqual(Object.keys(json.parStatut), ["DEPOSEE", "EN_COURS", "VALIDEE", "REJETEE"]);
    assert.equal(json.total, Object.values(json.parStatut as Record<string, number>).reduce((a, b) => a + b, 0));
    assert.equal((await api.requete("GET", "/demandes/statistiques?npi=12")).status, 400);
  });

  test("référentiels, écran et route inconnue", async () => {
    assert.equal((await api.requete("GET", "/referentiels")).json.statuts.length, 4);
    assert.equal((await api.requete("GET", "/health")).json.status, "ok");
    assert.equal((await api.requete("GET", "/nimportequoi")).status, 404);
  });
});
