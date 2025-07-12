/**
 * Anonymizer
 *
 * Provides HMAC-based anonymization for sensitive data (names, emails, objects) using a lookup database for reversibility.
 * Recursively anonymizes nested objects and arrays, supporting both full and part-based hashing.
 */

import { createHmac } from 'crypto';
import { LookupDatabase } from './lookup-db';

export interface AnonymizationOptions {
  secret: string;
  lookupDb: LookupDatabase;
  algorithm?: string;
  separator?: string;
}

export class Anonymizer {
  private secret: string;
  private algorithm: string;
  private separator: string;
  private lookupDb: LookupDatabase;

  /**
   * @param options - Configuration for secret, lookupDb, algorithm, and separator
   */
  constructor(options: AnonymizationOptions) {
    this.secret = options.secret;
    this.lookupDb = options.lookupDb;
    this.algorithm = options.algorithm || 'sha256';
    this.separator = options.separator || '|';
  }

  /**
   * Hash a value using HMAC, checking the lookup database first for reversibility.
   * @param value The value to hash
   * @param type 'full' for complete value, 'part' for subcomponents
   * @param parentHash Optional parent hash for part-based anonymization
   */
  private async hash(value: string, type: 'full' | 'part' = 'full', parentHash?: string): Promise<string> {
    if (!value) return '';
    const existingHash = await this.lookupDb.lookupByValue(value, type);
    if (existingHash) {
      return existingHash;
    }
    const newHash = createHmac(this.algorithm, this.secret)
      .update(value)
      .digest('hex');
    await this.lookupDb.store(type, value, newHash, parentHash);
    return newHash;
  }

  /**
   * Anonymize a name by hashing the complete name and individual parts.
   * Returns both the full hash and a separator-joined hash of parts.
   */
  public async anonymizeName(name: string): Promise<{ default: string; alt: string }> {
    if (!name) {
      return { default: '', alt: '' };
    }
    const completeHash = await this.hash(name, 'full');
    const parts = name.split(/\s+/);
    const partHashes = await Promise.all(
      parts.map(part => this.hash(part, 'part', completeHash))
    );
    return {
      default: completeHash,
      alt: partHashes.join(this.separator)
    };
  }

  /**
   * Anonymize an email address by hashing the complete address and its parts.
   * Returns both the full hash and a separator-joined hash of local/domain parts.
   */
  public async anonymizeEmail(email: string): Promise<{ default: string; alt: string }> {
    if (!email) {
      return { default: '', alt: '' };
    }
    const completeHash = await this.hash(email, 'full');
    const [localPart, domain] = email.split('@');
    if (!domain) {
      return { default: completeHash, alt: completeHash };
    }
    const localPartHash = localPart ? await this.hash(localPart, 'part', completeHash) : "";
    const domainHash = await this.hash(domain, 'part', completeHash);
    return {
      default: completeHash,
      alt: `${localPartHash}${this.separator}${domainHash}`
    };
  }

  /**
   * Anonymize an object by replacing likely PII fields (author_name, email, author_email).
   * Recursively anonymizes nested objects and arrays. Adds an `anonymized: true` flag.
   * @param obj The object to anonymize
   */
  public async anonymizeObject(obj: any): Promise<any> {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    const result: any = { ...obj, anonymized: true };
    if (result.author_name) {
      const anonymizedName = await this.anonymizeName(result.author_name);
      result.author_name = anonymizedName.default;
      result.author_name_alt = anonymizedName.alt;
    }
    if (result.email) {
      const anonymizedEmail = await this.anonymizeEmail(result.email);
      result.email = anonymizedEmail.default;
      result.email_alt = anonymizedEmail.alt;
    }
    if (result.author_email) {
      const anonymizedEmail = await this.anonymizeEmail(result.author_email);
      result.author_email = anonymizedEmail.default;
      result.author_email_alt = anonymizedEmail.alt;
    }
    // Recursively anonymize nested objects/arrays
    for (const key in result) {
      if (result[key] && typeof result[key] === 'object') {
        if (Array.isArray(result[key])) {
          result[key] = await Promise.all(
            result[key].map((item: any) => this.anonymizeObject(item))
          );
        } else {
          result[key] = await this.anonymizeObject(result[key]);
        }
      }
    }
    return result;
  }
}
