import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(packageRoot, "migrations");

function openMigratedDatabase(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of readdirSync(migrationsDir).sort())
    if (file.endsWith(".sql")) db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  return db;
}

function seedFixture(db: DatabaseSync): void {
  db.exec(readFileSync(join(packageRoot, "seed.sql"), "utf8"));
}

function ftsCount(db: DatabaseSync, versionId: string): number {
  const row = db
    .prepare("SELECT COUNT(*) AS total FROM chunk_fts WHERE version_id=?")
    .get(versionId) as { total: number };
  return row.total;
}

function insertChunk(db: DatabaseSync, ordinal: number, content: string, versionId = "ver_a") {
  db.prepare(
    "INSERT INTO chunk(id,organization_id,document_id,version_id,collection_id,ordinal,content,heading,page,start_offset,end_offset,content_hash,vector_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
  ).run(
    `${versionId}:${ordinal}`,
    "org_a",
    "doc_a",
    versionId,
    null,
    ordinal,
    content,
    null,
    null,
    0,
    content.length,
    `hash-${ordinal}`,
    `${versionId}:${ordinal}`,
    1,
    1,
  );
}

describe("migrations", () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = openMigratedDatabase();
    const now = 1;
    db.prepare("INSERT INTO user VALUES(?,?,?,?,?,?,?,?)").run(
      "usr_a",
      "User A",
      "a@example.com",
      1,
      null,
      null,
      now,
      now,
    );
    db.prepare(
      "INSERT INTO organization(id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?)",
    ).run("org_a", "Org A", "org-a", now, now);
    db.prepare(
      "INSERT INTO document(id,organization_id,title,filename,mime_type,bytes,checksum,status,current_version_id,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      "doc_a",
      "org_a",
      "Doc A",
      "a.md",
      "text/markdown",
      10,
      "sum-a",
      "ready",
      "ver_a",
      "usr_a",
      now,
      now,
    );
    db.prepare(
      "INSERT INTO document_version(id,organization_id,document_id,version,r2_key,checksum,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
    ).run("ver_a", "org_a", "doc_a", 1, "k", "sum-a", "ready", now, now);
  });

  it("applies the deterministic seed after all migrations", () => {
    expect(() => seedFixture(db)).not.toThrow();
    const chunk = db.prepare("SELECT id FROM chunk WHERE id='chk_northstar'").get();
    expect(chunk).toBeTruthy();
    expect(ftsCount(db, "ver_handbook")).toBe(1);
  });

  it("adds the ocr_pages usage column", () => {
    db.prepare(
      "INSERT INTO usage_daily(organization_id,day,ocr_pages,created_at,updated_at) VALUES(?,?,?,?,?)",
    ).run("org_a", "2026-08-13", 3, 1, 1);
    const row = db
      .prepare("SELECT ocr_pages AS ocrPages FROM usage_daily WHERE organization_id='org_a'")
      .get() as { ocrPages: number };
    expect(row.ocrPages).toBe(3);
  });

  it("keeps chunk_fts in sync across delete-then-insert re-indexing", () => {
    insertChunk(db, 0, "original alphaword content");
    insertChunk(db, 1, "second chunk content");
    expect(ftsCount(db, "ver_a")).toBe(2);
    // The ingestion API replaces a version's chunks with DELETE + INSERT; the
    // delete trigger must remove the superseded FTS rows.
    db.prepare("DELETE FROM chunk WHERE organization_id=? AND version_id=?").run("org_a", "ver_a");
    expect(ftsCount(db, "ver_a")).toBe(0);
    insertChunk(db, 0, "replacement betaword content");
    expect(ftsCount(db, "ver_a")).toBe(1);
    const stale = db
      .prepare("SELECT COUNT(*) AS total FROM chunk_fts WHERE chunk_fts MATCH 'alphaword'")
      .get() as { total: number };
    expect(stale.total).toBe(0);
    const fresh = db
      .prepare("SELECT COUNT(*) AS total FROM chunk_fts WHERE chunk_fts MATCH 'betaword'")
      .get() as { total: number };
    expect(fresh.total).toBe(1);
  });

  it("documents why INSERT OR REPLACE must not be used for chunk re-indexing", () => {
    insertChunk(db, 0, "original alphaword content");
    // REPLACE-conflict resolution does not fire the FTS delete trigger, so the
    // write path uses explicit DELETE + INSERT instead.
    db.prepare(
      "INSERT OR REPLACE INTO chunk(id,organization_id,document_id,version_id,collection_id,ordinal,content,heading,page,start_offset,end_offset,content_hash,vector_id,created_at,updated_at) VALUES('ver_a:0','org_a','doc_a','ver_a',NULL,0,'replaced betaword',NULL,NULL,0,10,'hash-r','ver_a:0',2,2)",
    ).run();
    expect(ftsCount(db, "ver_a")).toBeGreaterThan(1);
  });

  it("purges chunk text and FTS rows when a document's chunks are deleted", () => {
    insertChunk(db, 0, "purge me completely");
    db.prepare("DELETE FROM chunk WHERE organization_id=? AND document_id=?").run("org_a", "doc_a");
    expect(ftsCount(db, "ver_a")).toBe(0);
  });

  it("cascades document hard-deletion through versions, chunks, and FTS", () => {
    insertChunk(db, 0, "cascade content");
    db.prepare("DELETE FROM document WHERE id='doc_a'").run();
    const chunks = db.prepare("SELECT COUNT(*) AS total FROM chunk").get() as { total: number };
    const versions = db.prepare("SELECT COUNT(*) AS total FROM document_version").get() as {
      total: number;
    };
    expect(chunks.total).toBe(0);
    expect(versions.total).toBe(0);
    expect(ftsCount(db, "ver_a")).toBe(0);
  });
});
