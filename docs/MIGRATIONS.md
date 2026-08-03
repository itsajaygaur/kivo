# Migrations and recovery

Use D1 migrations in lexical order and deploy only backward-compatible changes. Test on a copy, take a D1 export and record R2 object inventory before production changes. Roll forward is preferred; rollback SQL must not discard newly written columns. Rebuild `chunk_fts` from `chunk` after restore. Vectorize is also derived and can be reindexed from chunks.

The seed is deterministic and for local use only. Production restore order is D1 schema/data, R2 object validation, FTS rebuild, then Vectorize reindex. Run tenant-count and citation referential checks before reopening traffic.
