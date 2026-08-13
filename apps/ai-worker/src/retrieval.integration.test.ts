import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { retrieve } from "./retrieval";

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "packages",
  "db",
  "migrations",
);

function openMigratedDatabase(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of readdirSync(migrationsDir).sort())
    if (file.endsWith(".sql")) db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  return db;
}

function fakeD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const statement = {
        bound: [] as unknown[],
        bind(...args: unknown[]) {
          statement.bound = args;
          return statement;
        },
        async all() {
          return { results: db.prepare(sql).all(...statement.bound) };
        },
        async first() {
          return db.prepare(sql).get(...statement.bound) ?? null;
        },
        async run() {
          db.prepare(sql).run(...statement.bound);
          return {};
        },
      };
      return statement;
    },
  };
}

type FakeEnvOptions = {
  vectorMatches?: Array<{ id: string; score: number }>;
  rerankResponse?: Array<{ id: number; score: number }> | null;
};

function fakeEnv(db: DatabaseSync, options: FakeEnvOptions = {}): Env {
  return {
    DB: fakeD1(db),
    EMBEDDING_MODEL: "embedding-model",
    RERANK_MODEL: "rerank-model",
    GENERATION_MODEL: "generation-model",
    OCR_MODEL: "ocr-model",
    VECTOR_INDEX: {
      async query() {
        return { matches: options.vectorMatches ?? [] };
      },
      async upsert() {},
      async deleteByIds() {},
    },
    AI: {
      async run(model: string) {
        if (model === "embedding-model") return { data: [[0.1, 0.2, 0.3]] };
        if (model === "rerank-model") return { response: options.rerankResponse ?? [] };
        throw new Error(`unexpected model ${model}`);
      },
    },
  } as unknown as Env;
}

function seedTenants(db: DatabaseSync): void {
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
  for (const org of ["org_a", "org_b"]) {
    db.prepare(
      "INSERT INTO organization(id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?)",
    ).run(org, org, org, now, now);
    db.prepare(
      "INSERT INTO document(id,organization_id,title,filename,mime_type,bytes,checksum,status,current_version_id,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      `doc_${org}`,
      org,
      `Doc ${org}`,
      "doc.md",
      "text/markdown",
      10,
      `sum-${org}`,
      "ready",
      `ver_${org}`,
      "usr_a",
      now,
      now,
    );
    db.prepare(
      "INSERT INTO document_version(id,organization_id,document_id,version,r2_key,checksum,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
    ).run(`ver_${org}`, org, `doc_${org}`, 1, "k", `sum-${org}`, "ready", now, now);
    db.prepare(
      "INSERT INTO chunk(id,organization_id,document_id,version_id,collection_id,ordinal,content,heading,page,start_offset,end_offset,content_hash,vector_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      `ver_${org}:0`,
      org,
      `doc_${org}`,
      `ver_${org}`,
      null,
      0,
      `confidential zebra facts for ${org}`,
      null,
      null,
      0,
      30,
      `hash-${org}`,
      `ver_${org}:0`,
      now,
      now,
    );
  }
}

describe("retrieve tenant isolation", () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = openMigratedDatabase();
    seedTenants(db);
  });

  it("never surfaces another organization's chunks through FTS", async () => {
    const results = await retrieve(fakeEnv(db), {
      organizationId: "org_a",
      query: "confidential zebra",
      limit: 10,
    });
    expect(results.length).toBe(1);
    expect(results[0]?.chunkId).toBe("ver_org_a:0");
  });

  it("drops vector matches that belong to another organization", async () => {
    // Simulates a Vectorize response that ignored (or lacked) the metadata
    // filter: the D1 re-join must still enforce tenancy.
    const results = await retrieve(
      fakeEnv(db, { vectorMatches: [{ id: "ver_org_b:0", score: 0.99 }] }),
      { organizationId: "org_a", query: "nomatchterm anywhere", limit: 10 },
    );
    expect(results.length).toBe(0);
  });

  it("excludes chunks from collections outside the authorized grant", async () => {
    db.prepare(
      "INSERT INTO collection(id,organization_id,name,restricted,created_by,created_at,updated_at) VALUES('col_secret','org_a','Secret',1,'usr_a',1,1)",
    ).run();
    db.prepare("UPDATE chunk SET collection_id='col_secret' WHERE id='ver_org_a:0'").run();
    const results = await retrieve(fakeEnv(db), {
      organizationId: "org_a",
      query: "confidential zebra",
      limit: 10,
      authorizedCollectionIds: ["col_other"],
    });
    expect(results.length).toBe(0);
  });

  it("excludes soft-deleted documents", async () => {
    db.prepare("UPDATE document SET deleted_at=99 WHERE id='doc_org_a'").run();
    const results = await retrieve(fakeEnv(db), {
      organizationId: "org_a",
      query: "confidential zebra",
      limit: 10,
    });
    expect(results.length).toBe(0);
  });

  it("excludes chunks from superseded document versions", async () => {
    db.prepare("UPDATE document SET current_version_id='ver_new' WHERE id='doc_org_a'").run();
    const results = await retrieve(fakeEnv(db), {
      organizationId: "org_a",
      query: "confidential zebra",
      limit: 10,
    });
    expect(results.length).toBe(0);
  });
});

describe("retrieve reranker degradation", () => {
  it("keeps RRF candidates when the reranker returns an empty response", async () => {
    const db = openMigratedDatabase();
    seedTenants(db);
    db.prepare(
      "INSERT INTO chunk(id,organization_id,document_id,version_id,collection_id,ordinal,content,heading,page,start_offset,end_offset,content_hash,vector_id,created_at,updated_at) VALUES('ver_org_a:1','org_a','doc_org_a','ver_org_a',NULL,1,'more zebra confidential details',NULL,NULL,0,30,'hash-2','ver_org_a:1',1,1)",
    ).run();
    const results = await retrieve(fakeEnv(db, { rerankResponse: [] }), {
      organizationId: "org_a",
      query: "confidential zebra",
      limit: 10,
    });
    expect(results.length).toBeGreaterThan(0);
  });
});
