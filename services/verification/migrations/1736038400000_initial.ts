import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createExtension('pgcrypto', { ifNotExists: true });

  pgm.createTable('ask_snapshots', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    owner_type: { type: 'text', notNull: true },
    owner_id: { type: 'text', notNull: true },
    ask_text: { type: 'text', notNull: true },
    derived_constraints: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    buyer_context: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    attachments: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    hash: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createTable('evaluation_specs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    ask_snapshot_id: { type: 'uuid', notNull: true, references: 'ask_snapshots(id)' },
    status: { type: 'text', notNull: true, default: 'DRAFT', check: "status IN ('DRAFT', 'REVIEW_REQUIRED', 'FROZEN')" },
    deliverable_type: { type: 'text', notNull: true, check: "deliverable_type IN ('ranked_table', 'memo')" },
    spec_json: { type: 'jsonb', notNull: true },
    schema_version: { type: 'text', notNull: true },
    hash: { type: 'text', notNull: true },
    translator_model_id: { type: 'text', notNull: true },
    translator_prompt_hash: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createTable('spec_acceptance_events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    spec_id: { type: 'uuid', notNull: true, references: 'evaluation_specs(id)' },
    actor_type: { type: 'text', notNull: true, check: "actor_type IN ('buyer', 'seller')" },
    actor_id: { type: 'text', notNull: true },
    accepted_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createTable('normalized_deliveries', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    spec_id: { type: 'uuid', notNull: true, references: 'evaluation_specs(id)' },
    delivery_raw: { type: 'jsonb', notNull: true },
    normalized_json: { type: 'jsonb', notNull: true },
    schema_version: { type: 'text', notNull: true },
    hash: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createTable('evidence_bundles', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    spec_id: { type: 'uuid', notNull: true, references: 'evaluation_specs(id)' },
    delivery_id: { type: 'uuid', notNull: true, references: 'normalized_deliveries(id)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createTable('evidence_items', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    bundle_id: { type: 'uuid', notNull: true, references: 'evidence_bundles(id)' },
    type: { type: 'text', notNull: true, check: "type IN ('url_snapshot', 'file')" },
    uri: { type: 'text', notNull: true },
    content_hash: { type: 'text', notNull: true },
    observed_at: { type: 'timestamptz' },
    metadata_json: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
  });

  pgm.createTable('verification_jobs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    spec_id: { type: 'uuid', notNull: true, references: 'evaluation_specs(id)' },
    delivery_id: { type: 'uuid', notNull: true, references: 'normalized_deliveries(id)' },
    evidence_bundle_id: { type: 'uuid', notNull: true, references: 'evidence_bundles(id)' },
    status: { type: 'text', notNull: true, default: 'QUEUED', check: "status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'REVIEW_REQUIRED')" },
    error_json: { type: 'jsonb' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createTable('verification_reports', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    job_id: { type: 'uuid', notNull: true, references: 'verification_jobs(id)' },
    spec_id: { type: 'uuid', notNull: true, references: 'evaluation_specs(id)' },
    report_json: { type: 'jsonb', notNull: true },
    decision: { type: 'text', notNull: true, check: "decision IN ('accept', 'reject', 'escalate')" },
    score: { type: 'real', notNull: true },
    gates_passed: { type: 'boolean', notNull: true },
    hash: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createTable('operator_registry', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'text', notNull: true },
    version: { type: 'text', notNull: true },
    code_hash: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'ACTIVE', check: "status IN ('ACTIVE', 'DEPRECATED')" },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createIndex('evaluation_specs', 'ask_snapshot_id');
  pgm.createIndex('normalized_deliveries', 'spec_id');
  pgm.createIndex('evidence_bundles', ['spec_id', 'delivery_id']);
  pgm.createIndex('evidence_items', 'bundle_id');
  pgm.createIndex('verification_jobs', 'spec_id');
  pgm.createIndex('verification_reports', 'job_id');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('operator_registry');
  pgm.dropTable('verification_reports');
  pgm.dropTable('verification_jobs');
  pgm.dropTable('evidence_items');
  pgm.dropTable('evidence_bundles');
  pgm.dropTable('normalized_deliveries');
  pgm.dropTable('spec_acceptance_events');
  pgm.dropTable('evaluation_specs');
  pgm.dropTable('ask_snapshots');
  pgm.dropExtension('pgcrypto', { ifExists: true });
}
