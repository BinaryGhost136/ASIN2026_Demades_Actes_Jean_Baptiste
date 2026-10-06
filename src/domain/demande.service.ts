import {
  LIBELLES_STATUT,
  TRANSITIONS,
  estStatutFinal,
  peutTransitionner,
  type ChangementStatut,
  type CritereListe,
  type Demande,
  type NouvelleDemande,
  type StatutDemande,
} from "./demande.js";
import { ConflictError, NotFoundError } from "./errors.js";
import type { DemandeRepository } from "../infra/sqlite-demande.repository.js";

export interface PageDemandes {
  data: Demande[];
  pagination: { page: number; taille: number; total: number; totalPages: number };
}

export interface Statistiques {
  total: number;
  parStatut: Record<StatutDemande, number>;
}

const libelle = (statut: StatutDemande) => `« ${LIBELLES_STATUT[statut]} » (${statut})`;

/**
 * Cas d'usage métier. Les saisies arrivent déjà validées (voir rules.ts) ;
 * ce service applique les règles qui dépendent de l'état : existence, cycle de vie.
 */
export class DemandeService {
  constructor(
    private readonly repository: DemandeRepository,
    private readonly maintenant: () => Date = () => new Date(),
  ) {}

  /** Dépose une demande : elle reçoit un identifiant et le statut « déposée ». */
  deposer(demande: NouvelleDemande): Demande {
    return this.repository.creer(demande, this.horodatage());
  }

  consulter(id: number): Demande {
    const demande = this.repository.trouverParId(id);
    if (!demande) throw new NotFoundError(`La demande n°${id} est introuvable.`, "DEMANDE_INTROUVABLE");
    return demande;
  }

  /** Demandes d'un usager, de la plus récente à la plus ancienne. */
  lister(npi: string, { statut, page, taille }: CritereListe): PageDemandes {
    const { elements, total } = this.repository.lister(npi, {
      statut,
      limite: taille,
      decalage: (page - 1) * taille,
    });
    return {
      data: elements,
      pagination: { page, taille, total, totalPages: Math.ceil(total / taille) },
    };
  }

  /** Fait avancer une demande selon son cycle de vie. */
  changerStatut(id: number, changement: ChangementStatut): Demande {
    const demande = this.consulter(id);

    if (!peutTransitionner(demande.statut, changement.statut)) {
      throw new ConflictError(this.messageTransitionInterdite(demande, changement.statut));
    }
    return this.repository.changerStatut(id, changement, this.horodatage())!;
  }

  statistiques(npi?: string): Statistiques {
    const parStatut = this.repository.compterParStatut(npi);
    const total = Object.values(parStatut).reduce((somme, n) => somme + n, 0);
    return { total, parStatut };
  }

  private horodatage(): string {
    return this.maintenant().toISOString();
  }

  private messageTransitionInterdite({ id, statut }: Demande, cible: StatutDemande): string {
    if (estStatutFinal(statut)) {
      return `La demande n°${id} est déjà ${libelle(statut)} : elle ne peut plus changer de statut.`;
    }
    const autorises = TRANSITIONS[statut].map(libelle).join(" ou ");
    return (
      `Transition interdite pour la demande n°${id} : de ${libelle(statut)} vers ${libelle(cible)}. ` +
      `Depuis ce statut, seule la transition vers ${autorises} est possible.`
    );
  }
}
