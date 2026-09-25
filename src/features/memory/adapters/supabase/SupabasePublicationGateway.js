// Explicit publication operations only; never receives an entire private card/board bundle.
const SAFE_ERRORS = new Set([
  "AUTH_REQUIRED", "PUBLICATION_DISABLED", "PUBLICATION_RESTRICTED", "INVALID_SELECTION",
  "DUPLICATE_CARD", "NOT_FOUND", "PUBLIC_VISUAL_NOT_READY", "PUBLICATION_CONFLICT",
  "INVALID_OPERATION", "OPERATION_MISMATCH", "CONSENT_MISMATCH", "PREVIEW_CHANGED",
  "RATE_LIMITED", "MODERATOR_REQUIRED",
]);

export class PublicationGatewayError extends Error {
  constructor(code) {
    super(code);
    this.name = "PublicationGatewayError";
    this.code = code;
  }
}

export class SupabasePublicationGateway {
  constructor(client) {
    if (typeof client?.rpc !== "function") throw new PublicationGatewayError("CLIENT_REQUIRED");
    this.client = client;
  }

  async request(name, args, { signal } = {}) {
    try {
      let request = this.client.rpc(name, args);
      if (signal) request = request.abortSignal(signal);
      const { data, error, status } = await request;
      if (error) {
        const code = signal?.aborted ? "REQUEST_ABORTED" : SAFE_ERRORS.has(error.message) ? error.message
          : status === 429 || error.status === 429 || error.code === "429" ? "RATE_LIMITED" : "PUBLICATION_REQUEST_FAILED";
        throw new PublicationGatewayError(code);
      }
      return data;
    } catch (error) {
      if (error instanceof PublicationGatewayError) throw error;
      throw new PublicationGatewayError(signal?.aborted ? "REQUEST_ABORTED" : "PUBLICATION_REQUEST_FAILED");
    }
  }

  get(boardId, options) {
    return this.request("get_memory_publication", { p_board_id: boardId }, options);
  }

  prepare({ boardId, expectedRevision, title, description, cards }, options) {
    return this.request("prepare_memory_publication", {
      p_board_id: boardId, p_expected_revision: expectedRevision,
      p_selection: { title, description, cards: cards.map(({ cardId, fields }) => ({ cardId, fields: [...fields] })) },
    }, options);
  }

  publish({ id, expectedRevision, reviewHash, policyRevision, operationId }, options) {
    return this.request("publish_memory_publication", {
      p_id: id, p_expected_revision: expectedRevision, p_review_hash: reviewHash,
      p_policy_revision: policyRevision, p_operation_id: operationId,
    }, options);
  }

  revoke({ id, expectedRevision }, options) {
    return this.request("revoke_memory_publication", { p_id: id, p_expected_revision: expectedRevision }, options);
  }

  revokeCard(cardId, options) {
    return this.request("revoke_memory_card_publications", { p_card_id: cardId }, options);
  }

  retireCard(cardId, options) {
    return this.request("retire_memory_card_publications", { p_card_id: cardId }, options);
  }

  read(id, options) {
    return this.request("read_memory_publication", { p_id: id }, options);
  }
  readAuthor(id, options) {
    return this.request("read_memory_publication_author", { p_id: id }, options);
  }

  getHome(options) { return this.request("get_memory_minihome", {}, options); }
  listHomeBoards(after, options) { return this.request("list_memory_minihome_boards", { p_after: after }, options); }
  prepareHome(revision, selection, options) {
    return this.request("prepare_memory_minihome", { p_expected_revision: revision, p_selection: selection }, options);
  }
  publishHome({ revision, reviewHash, policyRevision, operationId }, options) {
    return this.request("publish_memory_minihome", { p_expected_revision: revision, p_review_hash: reviewHash,
      p_policy_revision: policyRevision, p_operation_id: operationId }, options);
  }
  revokeHome(revision, options) { return this.request("revoke_memory_minihome", { p_expected_revision: revision }, options); }
  readHome(id, options) { return this.request("read_memory_minihome", { p_id: id }, options); }
  relationship(id, options) { return this.request("get_memory_relationship", { p_home_id: id }, options); }
  setRelationship(id, action, options) { return this.request("set_memory_relationship", { p_home_id: id, p_action: action }, options); }
  relationships(blocked = false, after = null, options) { return this.request("list_memory_relationships", { p_blocked: blocked, p_after: after }, options); }
  report({ kind, target, category, operation, note }, options) { return this.request("submit_memory_report", { p_kind: kind, p_target: target, p_category: category, p_operation: operation, p_note: note }, options); }
  safety(after = null, options) { return this.request("list_memory_safety", { p_after: after }, options); }
  appeal(id, text, options) { return this.request("appeal_memory_notice", { p_id: id, p_text: text }, options); }
}
