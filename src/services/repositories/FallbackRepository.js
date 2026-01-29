/**
 * Wrapper repository that provides automatic fallback to IndexedDB
 * when the primary repository (Remote/DynamoDB) is unavailable.
 */

import { message } from "antd";
import { IndexedDBRepository } from "./IndexedDBRepository";

export class FallbackRepository {
  constructor(primaryRepo, config = {}) {
    this._primary = primaryRepo;
    this._fallback = null;
    this._usingFallback = false;
    this._primaryName = config.primaryName || "remote server";
    this._notified = false;
  }

  _getFallback() {
    if (!this._fallback) {
      this._fallback = new IndexedDBRepository();
    }
    return this._fallback;
  }

  _showFallbackNotification() {
    if (!this._notified) {
      this._notified = true;
      message.warning(
        `Cannot connect to ${this._primaryName}. Using local storage instead. Your changes will be saved locally.`,
        5
      );
    }
  }

  _isConnectionError(err) {
    const msg = err.message || "";
    return (
      msg.includes("Cannot connect to remote API") ||
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      msg.includes("ECONNREFUSED") ||
      err.name === "TypeError"
    );
  }

  async _tryWithFallback(methodName, args) {
    // If already using fallback, go directly to fallback
    if (this._usingFallback) {
      return this._getFallback()[methodName](...args);
    }

    try {
      return await this._primary[methodName](...args);
    } catch (err) {
      if (this._isConnectionError(err)) {
        console.warn(
          `[FallbackRepository] ${this._primaryName} unavailable, falling back to IndexedDB:`,
          err.message
        );
        this._usingFallback = true;
        this._showFallbackNotification();
        return this._getFallback()[methodName](...args);
      }
      // Re-throw non-connection errors
      throw err;
    }
  }

  // Proxy all repository methods
  async save(interpretation) {
    return this._tryWithFallback("save", [interpretation]);
  }

  async get(datasetId, caseId, alterationId, authorId) {
    return this._tryWithFallback("get", [datasetId, caseId, alterationId, authorId]);
  }

  async getForCase(datasetId, caseId) {
    return this._tryWithFallback("getForCase", [datasetId, caseId]);
  }

  async delete(datasetId, caseId, alterationId, authorId) {
    return this._tryWithFallback("delete", [datasetId, caseId, alterationId, authorId]);
  }

  async clearCase(datasetId, caseId) {
    return this._tryWithFallback("clearCase", [datasetId, caseId]);
  }

  async bulkSave(interpretations) {
    return this._tryWithFallback("bulkSave", [interpretations]);
  }

  async saveGlobalNotes(datasetId, caseId, notes) {
    return this._tryWithFallback("saveGlobalNotes", [datasetId, caseId, notes]);
  }

  async getAll() {
    return this._tryWithFallback("getAll", []);
  }

  async getGlobalNotes(datasetId, caseId) {
    return this._tryWithFallback("getGlobalNotes", [datasetId, caseId]);
  }

  async getCasesWithInterpretations(datasetId) {
    return this._tryWithFallback("getCasesWithInterpretations", [datasetId]);
  }

  async getCasesInterpretationsCount(datasetId) {
    return this._tryWithFallback("getCasesInterpretationsCount", [datasetId]);
  }

  async getTierCountsByGeneVariantType(gene, variantType) {
    return this._tryWithFallback("getTierCountsByGeneVariantType", [gene, variantType]);
  }

  async getGeneVariantsWithTierChanges() {
    return this._tryWithFallback("getGeneVariantsWithTierChanges", []);
  }

  // Utility methods
  isUsingFallback() {
    return this._usingFallback;
  }

  resetFallback() {
    this._usingFallback = false;
    this._notified = false;
  }
}
