import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { ConflictError, NotFoundError } from "../src/domain/errors.js";
import type { DemandeService } from "../src/domain/demande.service.js";
import { DEPOT_VALIDE, creerServiceDeTest } from "./helpers.js";

let service: DemandeService;
beforeEach(() => {
  service = creerServiceDeTest().service;
});

const avancer = (id: number, statut: "EN_COURS" | "VALIDEE") =>
  service.changerStatut(id, { statut, motifRejet: null });

describe("Dépôt d'une demande", () => {
  test("reçoit un identifiant et le statut « déposée »", () => {
    const demande = service.deposer(DEPOT_VALIDE);
    assert.equal(demande.id, 1);
    assert.equal(demande.statut, "DEPOSEE");
    assert.equal(demande.motifRejet, null);
    assert.equal(demande.nombreCopies, 2);
  });

  test("chaque demande a un identifiant distinct", () => {
    const ids = [1, 2, 3].map(() => service.deposer(DEPOT_VALIDE).id);
    assert.deepEqual(ids, [1, 2, 3]);
  });
});

describe("Consultation des demandes d'un usager", () => {
  test("de la plus récente à la plus ancienne", () => {
    const [a, b, c] = [1, 2, 3].map(() => service.deposer(DEPOT_VALIDE));
    const { data } = service.lister(DEPOT_VALIDE.npi, { page: 1, taille: 20 });
    assert.deepEqual(data.map((d) => d.id), [c!.id, b!.id, a!.id]);
  });

  test("ne renvoie que les demandes de l'usager demandé", () => {
    service.deposer(DEPOT_VALIDE);
    service.deposer({ ...DEPOT_VALIDE, npi: "9999999999" });
    const { data, pagination } = service.lister("9999999999", { page: 1, taille: 20 });
    assert.equal(data.length, 1);
    assert.equal(pagination.total, 1);
  });

  test("filtre facultatif par statut", () => {
    const premiere = service.deposer(DEPOT_VALIDE);
    service.deposer(DEPOT_VALIDE);
    avancer(premiere.id, "EN_COURS");

    const enCours = service.lister(DEPOT_VALIDE.npi, { statut: "EN_COURS", page: 1, taille: 20 });
    assert.deepEqual(enCours.data.map((d) => d.id), [premiere.id]);
    assert.equal(service.lister(DEPOT_VALIDE.npi, { page: 1, taille: 20 }).data.length, 2);
  });

  test("usager sans demande : liste vide, pas d'erreur", () => {
    const resultat = service.lister("5555555555", { page: 1, taille: 20 });
    assert.deepEqual(resultat, { data: [], pagination: { page: 1, taille: 20, total: 0, totalPages: 0 } });
  });
});

describe("Pagination (20 demandes par page au maximum)", () => {
  beforeEach(() => {
    for (let i = 0; i < 45; i++) service.deposer(DEPOT_VALIDE);
  });

  test("45 demandes → 3 pages de 20, 20 et 5", () => {
    const tailles = [1, 2, 3].map((page) => service.lister(DEPOT_VALIDE.npi, { page, taille: 20 }).data.length);
    assert.deepEqual(tailles, [20, 20, 5]);
    assert.equal(service.lister(DEPOT_VALIDE.npi, { page: 1, taille: 20 }).pagination.totalPages, 3);
  });

  test("les pages se suivent sans doublon ni trou (ordre décroissant)", () => {
    const ids = [1, 2, 3].flatMap((page) =>
      service.lister(DEPOT_VALIDE.npi, { page, taille: 20 }).data.map((d) => d.id),
    );
    assert.deepEqual(ids, Array.from({ length: 45 }, (_, i) => 45 - i));
  });

  test("page au-delà de la dernière : liste vide", () => {
    assert.equal(service.lister(DEPOT_VALIDE.npi, { page: 9, taille: 20 }).data.length, 0);
  });
});

describe("Cycle de vie d'une demande", () => {
  test("déposée → en cours → validée", () => {
    const { id } = service.deposer(DEPOT_VALIDE);
    assert.equal(avancer(id, "EN_COURS").statut, "EN_COURS");
    assert.equal(avancer(id, "VALIDEE").statut, "VALIDEE");
  });

  test("déposée → en cours → rejetée, avec son motif", () => {
    const { id } = service.deposer(DEPOT_VALIDE);
    avancer(id, "EN_COURS");
    const rejetee = service.changerStatut(id, { statut: "REJETEE", motifRejet: "Pièce illisible" });
    assert.equal(rejetee.statut, "REJETEE");
    assert.equal(rejetee.motifRejet, "Pièce illisible");
  });

  test("met à jour la date de modification, pas celle de création", () => {
    const { id, creeLe } = service.deposer(DEPOT_VALIDE);
    const apres = avancer(id, "EN_COURS");
    assert.equal(apres.creeLe, creeLe);
    assert.ok(apres.modifieLe > creeLe);
  });

  test("interdit de sauter une étape : déposée → validée", () => {
    const { id } = service.deposer(DEPOT_VALIDE);
    assert.throws(() => avancer(id, "VALIDEE"), ConflictError);
    assert.equal(service.consulter(id).statut, "DEPOSEE");
  });

  test("interdit de reculer : en cours → déposée", () => {
    const { id } = service.deposer(DEPOT_VALIDE);
    avancer(id, "EN_COURS");
    assert.throws(() => service.changerStatut(id, { statut: "DEPOSEE", motifRejet: null }), ConflictError);
  });

  test("une demande validée ne change plus", () => {
    const { id } = service.deposer(DEPOT_VALIDE);
    avancer(id, "EN_COURS");
    avancer(id, "VALIDEE");
    assert.throws(() => service.changerStatut(id, { statut: "REJETEE", motifRejet: "trop tard" }), /ne peut plus changer/);
    assert.equal(service.consulter(id).statut, "VALIDEE");
  });

  test("une demande rejetée ne change plus", () => {
    const { id } = service.deposer(DEPOT_VALIDE);
    avancer(id, "EN_COURS");
    service.changerStatut(id, { statut: "REJETEE", motifRejet: "Dossier incomplet" });
    assert.throws(() => avancer(id, "EN_COURS"), ConflictError);
  });

  test("demande inexistante : NotFoundError", () => {
    assert.throws(() => avancer(404, "EN_COURS"), NotFoundError);
    assert.throws(() => service.consulter(404), NotFoundError);
  });

  test("le message d'erreur indique la transition possible", () => {
    const { id } = service.deposer(DEPOT_VALIDE);
    assert.throws(() => avancer(id, "VALIDEE"), /seule la transition vers .*EN_COURS/);
  });
});

describe("Statistiques par statut", () => {
  test("comptabilise tous les statuts, y compris ceux à 0", () => {
    assert.deepEqual(service.statistiques(), {
      total: 0,
      parStatut: { DEPOSEE: 0, EN_COURS: 0, VALIDEE: 0, REJETEE: 0 },
    });
  });

  test("global puis restreint à un usager", () => {
    const a = service.deposer(DEPOT_VALIDE);
    service.deposer(DEPOT_VALIDE);
    service.deposer({ ...DEPOT_VALIDE, npi: "9999999999" });
    avancer(a.id, "EN_COURS");

    assert.deepEqual(service.statistiques(), {
      total: 3,
      parStatut: { DEPOSEE: 2, EN_COURS: 1, VALIDEE: 0, REJETEE: 0 },
    });
    assert.deepEqual(service.statistiques(DEPOT_VALIDE.npi).parStatut, {
      DEPOSEE: 1,
      EN_COURS: 1,
      VALIDEE: 0,
      REJETEE: 0,
    });
  });
});
