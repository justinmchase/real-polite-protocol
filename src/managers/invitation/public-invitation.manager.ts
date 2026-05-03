import { ApplicationError } from "@justinmchase/grove";
import { globToRegExp } from "@std/path/glob-to-regexp";
import { generate as generateUUIDv7 } from "@std/uuid/v7";
import type {
  DomainFilter,
  PublicInvitation,
  Receipt,
  ReceiptTerms,
} from "../../models/mod.ts";
import type { PublicInvitationRepository } from "../../repositories/mod.ts";
import type { ReceiptManager } from "../receipt/receipt.manager.ts";

export class PublicInvitationNotFoundError extends ApplicationError {
  constructor(invitationId: string) {
    super(
      404,
      "E_PUBLIC_INVITATION_NOT_FOUND",
      `Public invitation ${invitationId} not found`,
    );
  }
}

export class PublicInvitationNotActiveError extends ApplicationError {
  constructor(invitationId: string, status: string) {
    super(
      400,
      "E_PUBLIC_INVITATION_NOT_ACTIVE",
      `Public invitation ${invitationId} is not active (status: ${status})`,
    );
  }
}

export class PublicInvitationMaxAcceptancesError extends ApplicationError {
  constructor(invitationId: string) {
    super(
      400,
      "E_PUBLIC_INVITATION_MAX_ACCEPTANCES",
      `Public invitation ${invitationId} has reached its acceptance limit`,
    );
  }
}

export class PublicInvitationDomainFilterError extends ApplicationError {
  constructor(invitationId: string, domain: string) {
    super(
      403,
      "E_RECEPTIVE_POLICY_CLOSED",
      `Public invitation ${invitationId} does not accept invitations from domain ${domain}`,
    );
  }
}

export class PublicInvitationNotOwnedError extends ApplicationError {
  constructor(invitationId: string) {
    super(
      404,
      "E_PUBLIC_INVITATION_NOT_FOUND",
      `Public invitation ${invitationId} not found`,
    );
  }
}

export class PublicInvitationTermsImmutableError extends ApplicationError {
  constructor(invitationId: string) {
    super(
      400,
      "E_PUBLIC_INVITATION_TERMS_IMMUTABLE",
      `proposed_terms cannot be changed on public invitation ${invitationId}`,
    );
  }
}

export interface CreatePublicInvitationOptions {
  displayName?: string;
  description?: string;
  domainFilter?: DomainFilter;
  maxAcceptances?: number;
  expiresAt?: Date;
}

export interface UpdatePublicInvitationFields {
  displayName?: string | null;
  description?: string | null;
  domainFilter?: DomainFilter | null;
  proposedTerms?: unknown; // Will trigger immutability error
}

function evaluateDomainFilter(filter: DomainFilter, domain: string): boolean {
  for (const rule of filter.rules) {
    const regex = globToRegExp(rule.pattern, { caseInsensitive: true });
    if (regex.test(domain)) {
      return rule.action === "allow";
    }
  }
  // Unmatched → blocked
  return false;
}

function computeStatus(invitation: PublicInvitation): PublicInvitation {
  if (invitation.status === "cancelled") return invitation;
  if (invitation.expires_at && invitation.expires_at <= new Date()) {
    return { ...invitation, status: "expired" };
  }
  return { ...invitation, status: "active" };
}

export class PublicInvitationManager {
  constructor(
    private readonly publicInvitations: PublicInvitationRepository,
    private readonly receiptManager: ReceiptManager,
  ) {}

  async create(
    oid: string,
    domain: string,
    proposedTerms: ReceiptTerms,
    opts: CreatePublicInvitationOptions = {},
  ): Promise<PublicInvitation> {
    const invitation: PublicInvitation = {
      invitation_id: generateUUIDv7(),
      oid,
      domain,
      proposed_terms: proposedTerms,
      acceptance_count: 0,
      created_at: new Date(),
      status: "active",
      ...(opts.displayName !== undefined && { display_name: opts.displayName }),
      ...(opts.description !== undefined && { description: opts.description }),
      ...(opts.domainFilter !== undefined && {
        domain_filter: opts.domainFilter,
      }),
      ...(opts.maxAcceptances !== undefined && {
        max_acceptances: opts.maxAcceptances,
      }),
      ...(opts.expiresAt !== undefined && { expires_at: opts.expiresAt }),
    };
    return await this.publicInvitations.set(invitation);
  }

  async get(invitationId: string): Promise<PublicInvitation | undefined> {
    const inv = await this.publicInvitations.get(invitationId);
    if (!inv) return undefined;
    return computeStatus(inv);
  }

  async list(oid: string): Promise<PublicInvitation[]> {
    const all = await this.publicInvitations.listByOid(oid);
    return all.map(computeStatus);
  }

  async update(
    invitationId: string,
    oid: string,
    fields: UpdatePublicInvitationFields,
  ): Promise<PublicInvitation> {
    const inv = await this.publicInvitations.get(invitationId);
    if (!inv || inv.oid !== oid) {
      throw new PublicInvitationNotOwnedError(invitationId);
    }
    if (fields.proposedTerms !== undefined) {
      throw new PublicInvitationTermsImmutableError(invitationId);
    }

    const updated: PublicInvitation = {
      ...inv,
      ...(fields.displayName !== undefined && {
        ...(fields.displayName === null
          ? { display_name: undefined }
          : { display_name: fields.displayName }),
      }),
      ...(fields.description !== undefined && {
        ...(fields.description === null
          ? { description: undefined }
          : { description: fields.description }),
      }),
      ...(fields.domainFilter !== undefined && {
        ...(fields.domainFilter === null
          ? { domain_filter: undefined }
          : { domain_filter: fields.domainFilter }),
      }),
    };
    return await this.publicInvitations.set(updated);
  }

  async cancel(
    invitationId: string,
    oid: string,
  ): Promise<PublicInvitation> {
    const inv = await this.publicInvitations.get(invitationId);
    if (!inv || inv.oid !== oid) {
      throw new PublicInvitationNotOwnedError(invitationId);
    }
    const updated: PublicInvitation = {
      ...inv,
      status: "cancelled",
      cancelled_at: new Date(),
    };
    return await this.publicInvitations.set(updated);
  }

  async accept(
    invitationId: string,
    acceptorOid: string,
    acceptorDomain: string,
    negotiatedTerms?: ReceiptTerms,
  ): Promise<{ invitation: PublicInvitation; receipt: Receipt }> {
    const inv = await this.publicInvitations.get(invitationId);
    if (!inv) {
      throw new PublicInvitationNotFoundError(invitationId);
    }

    const current = computeStatus(inv);
    if (current.status !== "active") {
      throw new PublicInvitationNotActiveError(invitationId, current.status);
    }

    if (
      inv.max_acceptances !== undefined &&
      inv.acceptance_count >= inv.max_acceptances
    ) {
      throw new PublicInvitationMaxAcceptancesError(invitationId);
    }

    if (inv.domain_filter) {
      if (!evaluateDomainFilter(inv.domain_filter, acceptorDomain)) {
        throw new PublicInvitationDomainFilterError(
          invitationId,
          acceptorDomain,
        );
      }
    }

    // Increment acceptance count.
    const updated: PublicInvitation = {
      ...inv,
      acceptance_count: inv.acceptance_count + 1,
    };
    const saved = await this.publicInvitations.set(updated);

    const acceptedTerms = negotiatedTerms ?? inv.proposed_terms;
    const receipt = await this.receiptManager.issue(
      acceptorOid,
      inv.domain, // the invitation creator's domain becomes the sender
      acceptedTerms,
      invitationId,
    );

    return { invitation: saved, receipt };
  }
}
