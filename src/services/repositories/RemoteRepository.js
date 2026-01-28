/**
 * Remote API implementation of EventInterpretationRepository.
 * Connects to a remote server via HTTP (typically accessed through SSH tunnel).
 */

import { EventInterpretationRepository } from "./EventInterpretationRepository";
import EventInterpretation from "../../helpers/EventInterpretation";

export class RemoteRepository extends EventInterpretationRepository {
  constructor(config = {}) {
    super();
    this.baseUrl = config.baseUrl || null;
    this.authToken = config.authToken || null;
  }

  _headers() {
    const headers = {
      "Content-Type": "application/json",
    };
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  async _fetch(endpoint, options = {}) {
    if (!this.baseUrl) {
      throw new Error(
        `Remote repository requires 'remoteApiUrl' in dataset config.\n\n` +
        `Add "remoteApiUrl": "http://localhost:6050" to your dataset entry in datasets.json\n\n` +
        `Example:\n` +
        `{\n` +
        `  "id": "your-dataset",\n` +
        `  "auditLoggingRepo": "remote",\n` +
        `  "remoteApiUrl": "http://localhost:6050"\n` +
        `}`
      );
    }

    const url = `${this.baseUrl}${endpoint}`;

    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers: this._headers(),
      });
    } catch (err) {
      if (err.name === "TypeError") {
        throw new Error(
          `Cannot connect to remote API at ${this.baseUrl}.\n` +
          `Is your SSH tunnel running?\n\n` +
          `Example: ssh -L 6050:localhost:6050 your-hpc-server`
        );
      }
      throw err;
    }

    if (!response.ok) {
      throw new Error(`Remote API error: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async save(interpretation) {
    const json = interpretation.toJSON ? interpretation.toJSON() : interpretation;
    
    const response = await this._fetch(
      `/datasets/${json.datasetId}/cases/${json.caseId}/interpretations/${json.alterationId}/${json.authorId}`,
      {
        method: "PUT",
        body: JSON.stringify(json),
      }
    );
    
    return new EventInterpretation(response);
  }

  async get(datasetId, caseId, alterationId, authorId) {
    const response = await this._fetch(
      `/datasets/${datasetId}/cases/${caseId}/interpretations/${alterationId}/${authorId}`
    );
    return response ? new EventInterpretation(response) : null;
  }

  async getForCase(datasetId, caseId) {
    const response = await this._fetch(`/datasets/${datasetId}/cases/${caseId}/interpretations`);
    return (response?.interpretations || []).map((data) =>
      new EventInterpretation(data)
    );
  }

  async delete(datasetId, caseId, alterationId, authorId) {
    return this._fetch(`/datasets/${datasetId}/cases/${caseId}/interpretations/${alterationId}/${authorId}`, {
      method: "DELETE",
    });
  }

  async clearCase(datasetId, caseId) {
    return this._fetch(`/datasets/${datasetId}/cases/${caseId}/interpretations`, {
      method: "DELETE",
    });
  }

  async bulkSave(interpretations) {
    const normalized = interpretations.map((interp) =>
      interp.toJSON ? interp.toJSON() : interp
    );
    
    const response = await this._fetch("/interpretations/bulk", {
      method: "POST",
      body: JSON.stringify({ interpretations: normalized }),
    });
    
    return (response?.interpretations || []).map((data) =>
      new EventInterpretation(data)
    );
  }

  async saveGlobalNotes(datasetId, caseId, notes) {
    return this._fetch(`/datasets/${datasetId}/cases/${caseId}/notes`, {
      method: "PUT",
      body: JSON.stringify({ notes }),
    });
  }

  async getGlobalNotes(datasetId, caseId) {
    const response = await this._fetch(`/datasets/${datasetId}/cases/${caseId}/notes`);
    return response?.notes ?? null;
  }

  async getCasesWithInterpretations(datasetId) {
    const response = await this._fetch(`/datasets/${datasetId}/cases`);
    
    // Convert byAuthor and byGene from object to Map with Sets
    const byAuthor = new Map();
    if (response?.byAuthor) {
      Object.entries(response.byAuthor).forEach(([author, cases]) => {
        byAuthor.set(author, new Set(cases));
      });
    }
    
    const byGene = new Map();
    if (response?.byGene) {
      Object.entries(response.byGene).forEach(([gene, cases]) => {
        byGene.set(gene, new Set(cases));
      });
    }
    
    return {
      withTierChange: new Set(response?.withTierChange || []),
      byAuthor,
      byGene,
      all: new Set(response?.all || []),
    };
  }

  async getCasesInterpretationsCount(datasetId) {
    const response = await this._fetch(`/datasets/${datasetId}/cases/counts`);
    return new Map(Object.entries(response?.counts || {}));
  }

  async getTierCountsByGeneVariantType(gene, variantType) {
    const response = await this._fetch(`/genes/${gene}/variant-types/${variantType}/tier-counts`);
    return response?.counts || { 1: 0, 2: 0, 3: 0 };
  }
}
