/**
 * LookupDatabase
 *
 * Stores and retrieves anonymized data mappings for reversibility.
 * Uses a CSV file for persistence and supports full/part hash lookups and parent-child relationships.
 */

import { promises as fs } from 'fs';
import { getLogger } from './logging';
const logger = getLogger(["utils"]);

export class LookupDatabase {
  private dbPath: string;
  private entries: Map<string, string> = new Map();
  private reverseEntries: Map<string, string> = new Map();
  private parentLinks: Map<string, string> = new Map();
  private initialized: boolean = false;
  private diskIODisabled: boolean;
  private warnedAboutDiskIO: boolean = false;

  /**
   * @param dbPath Path to the CSV file for lookup storage
   */
  constructor(dbPath: string) {
    this.dbPath = dbPath;
    const env = process.env.LOOKUP_DB_DISABLE_IO;
    this.diskIODisabled = !!env && /^(1|true|yes)$/i.test(env.trim());
  }

  /**
   * Initialize the database from the CSV file, loading all entries into memory.
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.diskIODisabled) {
      if (!this.warnedAboutDiskIO) {
        logger.warn('Disk I/O for LookupDatabase is disabled via LOOKUP_DB_DISABLE_IO. Operating in-memory only.');
        this.warnedAboutDiskIO = true;
      }
      this.initialized = true;
      return;
    }
    try {
      const dir = this.dbPath.substring(0, this.dbPath.lastIndexOf('/'));
      await fs.mkdir(dir, { recursive: true });

      const file = Bun.file(this.dbPath);
      const exists = await file.exists();

      if (exists) {
        const content = await file.text();
        if (content.trim() === '') {
          await Bun.write(this.dbPath, 'type,key,value,parentHash\n');
        } else {
          const lines = content.trim().split('\n');
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            
            const [type, key, value, parentHash] = line.split(',');
            
            if ((type === 'full' || type === 'part') && key && value) {
              this.entries.set(this.getMapKey(type, key), value);
              this.reverseEntries.set(value, key);
              if (type === 'part' && parentHash) {
                this.parentLinks.set(value, parentHash);
              }
            }
          }
        }
      } else {
        await Bun.write(this.dbPath, 'type,key,value,parentHash\n');
      }

      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize lookup database:', { error });
      this.initialized = true; // Ensure we can still proceed with an in-memory DB
    }
  }

  /**
   * Get the map key for a given type and key (for internal storage).
   */
  private getMapKey(type: 'full' | 'part', key: string): string {
    return type === 'part' ? `part:${key}` : key;
  }

  /**
   * Store a new lookup entry in memory and append it to the CSV file.
   * Avoids duplicates and links part hashes to parent hashes if provided.
   */
  public async store(type: 'full' | 'part', key: string, value: string, parentHash?: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.diskIODisabled) {
      if (!this.warnedAboutDiskIO) {
        logger.warn('LookupDatabase privacy mode: all mapping and reverse lookup is disabled (LOOKUP_DB_DISABLE_IO set). No data will be stored or retained.');
        this.warnedAboutDiskIO = true;
      }
      return;
    }

    const mapKey = this.getMapKey(type, key);
    if (this.entries.has(mapKey)) return; // Avoid duplicates

    this.entries.set(mapKey, value);
    this.reverseEntries.set(value, key);
    if (type === 'part' && parentHash) {
      this.parentLinks.set(value, parentHash);
    }

    const line = `\n${type},${key},${value},${parentHash || ''}`;
    try {
      await fs.appendFile(this.dbPath, line);
    } catch (error) {
      logger.error('Failed to append to lookup database:', { error });
    }
  }

  /**
   * Lookup original value by hash (reverse lookup).
   */
  public async lookupByHash(hash: string): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (this.diskIODisabled) {
      if (!this.warnedAboutDiskIO) {
        logger.warn('LookupDatabase privacy mode: all mapping and reverse lookup is disabled (LOOKUP_DB_DISABLE_IO set). No data will be stored or retained.');
        this.warnedAboutDiskIO = true;
      }
      return null;
    }
    return this.reverseEntries.get(hash) || null;
  }

  /**
   * Lookup hash by original value (forward lookup).
   */
  public async lookupByValue(value: string, type: 'full' | 'part' = 'full'): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (this.diskIODisabled) {
      if (!this.warnedAboutDiskIO) {
        logger.warn('LookupDatabase privacy mode: all mapping and reverse lookup is disabled (LOOKUP_DB_DISABLE_IO set). No data will be stored or retained.');
        this.warnedAboutDiskIO = true;
      }
      return null;
    }
    return this.entries.get(this.getMapKey(type, value)) || null;
  }

  /**
   * Get all related part hashes for a given full hash (for part-based anonymization).
   */
  public async getRelatedParts(fullHash: string): Promise<{ hash: string; originalValue: string }[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (this.diskIODisabled) {
      if (!this.warnedAboutDiskIO) {
        logger.warn('LookupDatabase privacy mode: all mapping and reverse lookup is disabled (LOOKUP_DB_DISABLE_IO set). No data will be stored or retained.');
        this.warnedAboutDiskIO = true;
      }
      return [];
    }
    const result: { hash: string; originalValue: string }[] = [];
    for (const [partHash, parentHash] of this.parentLinks.entries()) {
      if (parentHash === fullHash) {
        const originalValue = await this.lookupByHash(partHash);
        if (originalValue) {
          result.push({ hash: partHash, originalValue });
        }
      }
    }
    return result;
  }

  /**
   * Get the full entry (parent) for a given part hash.
   */
  public async getFullEntryForPart(partHash: string): Promise<{ hash: string; originalValue: string; type: 'full' } | null> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (this.diskIODisabled) {
      if (!this.warnedAboutDiskIO) {
        logger.warn('LookupDatabase privacy mode: all mapping and reverse lookup is disabled (LOOKUP_DB_DISABLE_IO set). No data will be stored or retained.');
        this.warnedAboutDiskIO = true;
      }
      return null;
    }
    const parentHash = this.parentLinks.get(partHash);
    if (!parentHash) return null;
  
    const originalValue = await this.lookupByHash(parentHash);
    if (!originalValue) return null;
  
    return {
      hash: parentHash,
      originalValue,
      type: 'full'
    };
  }
}
