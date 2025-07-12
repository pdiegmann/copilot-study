# Anonymization & Privacy

Crawlz is designed with privacy by default, ensuring that all personally identifiable information (PII) is anonymized before storage or further processing.

## Anonymization Process

- **HMAC-based Hashing**: All fields likely to contain PII (e.g., names, emails) are anonymized using HMAC with a secret key.
- **Full Value & Parts**: Both the complete value and its individual parts (e.g., first/last name, email local/domain) are hashed.
- **Reversible Lookup**: An internal lookup database stores mappings between original and anonymized values for controlled reversibility.

## Example

For an email address:

- `email`: HMAC hash of the full email
- `email_alt`: HMAC hashes of the local part and domain

For a name:

- `name`: HMAC hash of the full name
- `name_alt`: HMAC hashes of each name part

## Lookup Database

- **Purpose**: Enables reversible anonymization for research scenarios where re-identification is permitted under strict controls.
- **Storage**: Mappings are stored in a local database file (`lookup.db` by default).
- **APIs**: The anonymizer provides methods to store and retrieve mappings for both full values and parts.
- **Full Disable Mode**: When the `LOOKUP_DB_DISABLE_IO` environment variable is set to a true-ish value (`"1"`, `"true"`, `"yes"`), the lookup database will not store or retain any mapping information at all—not even in memory. All reverse lookups are disabled, maximizing privacy and data security. No mapping data is ever persisted or available for retrieval during the run. This mode is intended for privacy-sensitive runs, regulatory compliance, or scenarios where any form of re-identification must be strictly prevented.

## Configuration

- **Secret**: Set via the `ANONYMIZATION_SECRET` environment variable.
- **Algorithm**: Defaults to `sha256`.
- **Separator**: Defaults to `|` for joining parts.
- **Disable Lookup DB (No Storage or Retention)**: Set the `LOOKUP_DB_DISABLE_IO` environment variable to `"1"`, `"true"`, or `"yes"` to fully disable the lookup database. In this mode, no mapping information is stored or retained—neither on disk nor in memory—and all reverse lookups are disabled.
  **Typical use cases:** privacy-sensitive runs, regulatory compliance, or when any form of mapping retention is unacceptable.

## Implementation

```typescript
const anonymizer = new Anonymizer({
  secret: process.env.ANONYMIZATION_SECRET,
  lookupDb,
  algorithm: 'sha256',
  separator: '|'
});
```

## Privacy Guarantees

- No PII is stored in cleartext in the output data.
- Only authorized users with access to the secret and lookup DB can reverse hashes.
- All anonymization is performed before data leaves the processing pipeline.

See [architecture.md](./architecture.md) for component integration.