import {
  sqliteTable,
  customType,
  integer,
  text,
  numeric,
  index,
  foreignKey,
  uniqueIndex,
  primaryKey,
  real,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const timestampText = customType<{ data: Date; driverData: string }>({
  dataType() {
    return "text";
  },
  fromDriver(value) {
    return new Date(value);
  },
  toDriver(value) {
    return value.toISOString();
  },
});

export const d1Migrations = sqliteTable("d1_migrations", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text(),
  appliedAt: numeric("applied_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
});

export const user = sqliteTable("user", {
  id: text().primaryKey().notNull(),
  name: text().notNull(),
  email: text().notNull(),
  emailVerified: integer({ mode: "boolean" }).default(false).notNull(),
  image: text(),
  createdAt: timestampText()
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestampText()
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text().primaryKey().notNull(),
    expiresAt: timestampText().notNull(),
    token: text().notNull(),
    createdAt: timestampText()
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestampText()
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text().primaryKey().notNull(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestampText(),
    refreshTokenExpiresAt: timestampText(),
    scope: text(),
    password: text(),
    createdAt: timestampText()
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestampText()
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text().primaryKey().notNull(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestampText().notNull(),
    createdAt: timestampText()
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestampText()
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const organization = sqliteTable("organization", {
  id: text().primaryKey().notNull(),
  name: text().notNull(),
  slug: text().notNull(),
  displayTitle: text("display_title"),
  logoAssetKey: text("logo_asset_key"),
  timezone: text().default("Asia/Kolkata").notNull(),
  locale: text().default("en-IN").notNull(),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const organizationMember = sqliteTable(
  "organization_member",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text().notNull(),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    groupId: text("group_id").references(() => accessGroup.id, { onDelete: "restrict" }),
  },
  (table) => [
    index("organization_member_group_idx").on(table.groupId),
    index("organization_member_user_idx").on(table.userId, table.organizationId),
  ],
);

export const academicSession = sqliteTable(
  "academic_session",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on").notNull(),
    isActive: integer("is_active").default(1).notNull(),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    sourceSystem: text("source_system"),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
  },
  (table) => [
    uniqueIndex("academic_session_source_idx")
      .on(table.organizationId, table.sourceSystem, table.sourceTable, table.sourceId)
      .where(
        sql`${table.sourceSystem} IS NOT NULL AND ${table.sourceTable} IS NOT NULL AND ${table.sourceId} IS NOT NULL`,
      ),
    index("academic_session_org_idx").on(table.organizationId, table.isActive, table.startsOn),
  ],
);

export const userPreference = sqliteTable("user_preference", {
  userId: text("user_id")
    .primaryKey()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  activeOrganizationId: text("active_organization_id").references(() => organization.id, {
    onDelete: "set null",
  }),
  activeAcademicSessionId: text("active_academic_session_id").references(() => academicSession.id, {
    onDelete: "set null",
  }),
  theme: text().default("system").notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const auditEvent = sqliteTable(
  "audit_event",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    action: text().notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadataJson: text("metadata_json"),
    occurredAt: text("occurred_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [index("audit_event_org_time_idx").on(table.organizationId, table.occurredAt)],
);

export const organizationInvitation = sqliteTable(
  "organization_invitation",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text().notNull(),
    role: text().notNull(),
    tokenHash: text("token_hash").notNull(),
    invitedByUserId: text("invited_by_user_id").references(() => user.id, { onDelete: "set null" }),
    acceptedByUserId: text("accepted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    expiresAt: text("expires_at").notNull(),
    acceptedAt: text("accepted_at"),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    groupId: text("group_id").references(() => accessGroup.id, { onDelete: "restrict" }),
    emailStatus: text("email_status").default("not_sent").notNull(),
    emailMessageId: text("email_message_id"),
    emailSentAt: text("email_sent_at"),
    emailLastAttemptAt: text("email_last_attempt_at"),
    emailAttemptCount: integer("email_attempt_count").default(0).notNull(),
  },
  (table) => [
    index("organization_invitation_delivery_idx").on(
      table.organizationId,
      table.emailStatus,
      table.createdAt,
    ),
    index("organization_invitation_group_idx").on(table.groupId),
    uniqueIndex("organization_invitation_active_email_idx")
      .on(table.organizationId, table.email)
      .where(sql`${table.acceptedAt} IS NULL AND ${table.revokedAt} IS NULL`),
    index("organization_invitation_org_idx").on(table.organizationId, table.createdAt),
  ],
);

export const personImportBatch = sqliteTable(
  "person_import_batch",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    sourceSystem: text("source_system").notNull(),
    sourceDatabase: text("source_database").notNull(),
    sourceFingerprint: text("source_fingerprint"),
    mode: text().notNull(),
    status: text().notNull(),
    sourceCount: integer("source_count").default(0).notNull(),
    importedCount: integer("imported_count").default(0).notNull(),
    skippedCount: integer("skipped_count").default(0).notNull(),
    issueCount: integer("issue_count").default(0).notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    eligibleCount: integer("eligible_count").default(0).notNull(),
  },
  (table) => [index("person_import_batch_org_idx").on(table.organizationId, table.createdAt)],
);

export const person = sqliteTable(
  "person",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    status: text().notNull(),
    identifierKind: text("identifier_kind").notNull(),
    primaryIdentifier: text("primary_identifier").notNull(),
    displayName: text("display_name").notNull(),
    gender: text(),
    dateOfBirth: text("date_of_birth"),
    admittedOrJoinedOn: text("admitted_or_joined_on"),
    campusOrLocation: text("campus_or_location"),
    nationality: text(),
    educationNumber: text("education_number"),
    registrationCertificateNumber: text("registration_certificate_number"),
    identityCertificateNumber: text("identity_certificate_number"),
    photoAssetKey: text("photo_asset_key"),
    sourceSystem: text("source_system").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    importBatchId: text("import_batch_id").references(() => personImportBatch.id, {
      onDelete: "set null",
    }),
    importedAt: text("imported_at"),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("person_registry_name_idx").on(table.organizationId, table.displayName),
    index("person_registry_filter_idx").on(
      table.organizationId,
      table.kind,
      table.status,
      table.displayName,
    ),
  ],
);

export const personImportIssue = sqliteTable(
  "person_import_issue",
  {
    id: text().primaryKey().notNull(),
    importBatchId: text("import_batch_id")
      .notNull()
      .references(() => personImportBatch.id, { onDelete: "cascade" }),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    fieldName: text("field_name"),
    issueCode: text("issue_code").notNull(),
    severity: text().notNull(),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("person_import_issue_batch_idx").on(table.importBatchId, table.severity, table.issueCode),
  ],
);

export const personImportIssueSummary = sqliteTable(
  "person_import_issue_summary",
  {
    importBatchId: text("import_batch_id")
      .notNull()
      .references(() => personImportBatch.id, { onDelete: "cascade" }),
    sourceTable: text("source_table").notNull(),
    issueCode: text("issue_code").notNull(),
    severity: text().notNull(),
    recordCount: integer("record_count").notNull(),
  },
  (table) => [
    index("person_import_issue_summary_batch_idx").on(
      table.importBatchId,
      table.severity,
      table.issueCode,
    ),
    primaryKey({
      columns: [table.importBatchId, table.sourceTable, table.issueCode],
      name: "person_import_issue_summary_import_batch_id_source_table_issue_code_pk",
    }),
  ],
);

export const personPlacementImportBatch = sqliteTable(
  "person_placement_import_batch",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    sourceSystem: text("source_system").notNull(),
    sourceDatabase: text("source_database").notNull(),
    sourceFingerprint: text("source_fingerprint"),
    status: text().notNull(),
    sourceCount: integer("source_count").default(0).notNull(),
    importedCount: integer("imported_count").default(0).notNull(),
    skippedCount: integer("skipped_count").default(0).notNull(),
    currentPlacementCount: integer("current_placement_count").default(0).notNull(),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("person_placement_import_batch_org_idx").on(table.organizationId, table.createdAt),
  ],
);

export const personPlacement = sqliteTable(
  "person_placement",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    homeName: text("home_name").notNull(),
    locationName: text("location_name"),
    placementType: text("placement_type"),
    startedOn: text("started_on").notNull(),
    reason: text(),
    remarks: text(),
    isCurrent: integer("is_current").default(0).notNull(),
    sourceSystem: text("source_system").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    importBatchId: text("import_batch_id").references(() => personPlacementImportBatch.id, {
      onDelete: "set null",
    }),
    importedAt: text("imported_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    endedOn: text("ended_on"),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    index("person_placement_current_home_idx").on(
      table.organizationId,
      table.homeName,
      table.isCurrent,
    ),
    uniqueIndex("person_placement_one_current_idx")
      .on(table.organizationId, table.personId)
      .where(sql`${table.isCurrent} = 1`),
    index("person_placement_timeline_idx").on(
      table.organizationId,
      table.personId,
      table.startedOn,
      table.sourceId,
    ),
  ],
);

export const personAcademicImportBatch = sqliteTable(
  "person_academic_import_batch",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    sourceSystem: text("source_system").notNull(),
    sourceDatabase: text("source_database").notNull(),
    sourceFingerprint: text("source_fingerprint"),
    status: text().notNull(),
    sourceCount: integer("source_count").default(0).notNull(),
    importedCount: integer("imported_count").default(0).notNull(),
    skippedCount: integer("skipped_count").default(0).notNull(),
    latestRecordCount: integer("latest_record_count").default(0).notNull(),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("person_academic_import_batch_org_idx").on(table.organizationId, table.createdAt),
  ],
);

export const personAcademicRecord = sqliteTable(
  "person_academic_record",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    className: text("class_name").notNull(),
    classLevel: integer("class_level"),
    classSection: text("class_section"),
    classTitle: text("class_title"),
    schoolName: text("school_name"),
    houseName: text("house_name"),
    academicSession: text("academic_session").notNull(),
    recordedOn: text("recorded_on").notNull(),
    result: text(),
    rollNumber: text("roll_number"),
    boardRegistrationNumber: text("board_registration_number"),
    description: text(),
    isLatest: integer("is_latest").default(0).notNull(),
    sourceSystem: text("source_system").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    importBatchId: text("import_batch_id").references(() => personAcademicImportBatch.id, {
      onDelete: "set null",
    }),
    importedAt: text("imported_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("person_academic_one_latest_idx")
      .on(table.organizationId, table.personId)
      .where(sql`${table.isLatest} = 1`),
    index("person_academic_timeline_idx").on(
      table.organizationId,
      table.personId,
      table.recordedOn,
      table.sourceId,
    ),
  ],
);

export const personFamilyImportBatch = sqliteTable(
  "person_family_import_batch",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    sourceSystem: text("source_system").notNull(),
    sourceDatabase: text("source_database").notNull(),
    sourceFingerprint: text("source_fingerprint"),
    status: text().notNull(),
    sourceProfileCount: integer("source_profile_count").default(0).notNull(),
    importedProfileCount: integer("imported_profile_count").default(0).notNull(),
    sourceRelationshipCount: integer("source_relationship_count").default(0).notNull(),
    importedRelationshipCount: integer("imported_relationship_count").default(0).notNull(),
    reviewCount: integer("review_count").default(0).notNull(),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("person_family_import_batch_org_idx").on(table.organizationId, table.createdAt),
  ],
);

export const personFamilyProfile = sqliteTable(
  "person_family_profile",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    parentageStatus: text("parentage_status"),
    motherName: text("mother_name"),
    fatherName: text("father_name"),
    motherOccupation: text("mother_occupation"),
    fatherOccupation: text("father_occupation"),
    parentsPhone: text("parents_phone"),
    parentsPermanentAddress: text("parents_permanent_address"),
    guardian1Name: text("guardian_1_name"),
    guardian1Address: text("guardian_1_address"),
    guardian1Email: text("guardian_1_email"),
    guardian1Phone: text("guardian_1_phone"),
    guardian1Mobile: text("guardian_1_mobile"),
    guardian2Name: text("guardian_2_name"),
    guardian2Address: text("guardian_2_address"),
    guardian2Email: text("guardian_2_email"),
    guardian2Phone: text("guardian_2_phone"),
    guardian2Mobile: text("guardian_2_mobile"),
    maritalStatus: text("marital_status"),
    spouseName: text("spouse_name"),
    numberOfChildren: text("number_of_children"),
    sourceSystem: text("source_system").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    importBatchId: text("import_batch_id").references(() => personFamilyImportBatch.id, {
      onDelete: "set null",
    }),
    importedAt: text("imported_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [index("person_family_profile_person_idx").on(table.organizationId, table.personId)],
);

export const personRelationship = sqliteTable(
  "person_relationship",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    relatedPersonId: text("related_person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    relationshipType: text("relationship_type").notNull(),
    reviewFlag: text("review_flag"),
    sourceSystem: text("source_system").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    importBatchId: text("import_batch_id").references(() => personFamilyImportBatch.id, {
      onDelete: "set null",
    }),
    importedAt: text("imported_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    isActive: integer("is_active").default(1).notNull(),
    removedAt: text("removed_at"),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    index("person_relationship_active_pair_idx").on(
      table.organizationId,
      table.relationshipType,
      table.personId,
      table.relatedPersonId,
      table.isActive,
    ),
    index("person_relationship_related_idx").on(
      table.organizationId,
      table.relatedPersonId,
      table.relationshipType,
      table.personId,
    ),
    index("person_relationship_person_idx").on(
      table.organizationId,
      table.personId,
      table.relationshipType,
      table.relatedPersonId,
    ),
  ],
);

export const personFileImportBatch = sqliteTable(
  "person_file_import_batch",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    sourceSystem: text("source_system").notNull(),
    sourceDatabase: text("source_database").notNull(),
    sourceFingerprint: text("source_fingerprint"),
    status: text().notNull(),
    selectedPersonCount: integer("selected_person_count").default(0).notNull(),
    sourceFileCount: integer("source_file_count").default(0).notNull(),
    importedFileCount: integer("imported_file_count").default(0).notNull(),
    sourceByteCount: integer("source_byte_count").default(0).notNull(),
    importedByteCount: integer("imported_byte_count").default(0).notNull(),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [index("person_file_import_batch_org_idx").on(table.organizationId, table.createdAt)],
);

export const personFile = sqliteTable(
  "person_file",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    category: text().notNull(),
    label: text().notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    sha256: text().notNull(),
    r2ObjectKey: text("r2_object_key").notNull(),
    isPrimary: integer("is_primary").default(0).notNull(),
    sourceSystem: text("source_system").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    sourceAssetId: text("source_asset_id").notNull(),
    importBatchId: text("import_batch_id").references(() => personFileImportBatch.id, {
      onDelete: "set null",
    }),
    importedAt: text("imported_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    isActive: integer("is_active").default(1).notNull(),
    removedAt: text("removed_at"),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, { onDelete: "set null" }),
    replacesFileId: text("replaces_file_id"),
  },
  (table) => [
    index("person_file_active_person_idx").on(
      table.organizationId,
      table.personId,
      table.isActive,
      table.category,
      table.label,
    ),
    index("person_file_source_idx").on(table.organizationId, table.sourceTable, table.sourceId),
    index("person_file_person_idx").on(
      table.organizationId,
      table.personId,
      table.category,
      table.label,
    ),
    foreignKey(() => ({
      columns: [table.replacesFileId],
      foreignColumns: [table.id],
      name: "person_file_replaces_file_id_person_file_id_fk",
    })).onDelete("set null"),
  ],
);

export const schoolOperationsImportBatch = sqliteTable(
  "school_operations_import_batch",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    sourceSystem: text("source_system").notNull(),
    sourceDatabase: text("source_database").notNull(),
    sourceFingerprint: text("source_fingerprint").notNull(),
    status: text().notNull(),
    sessionCount: integer("session_count").default(0).notNull(),
    schoolCount: integer("school_count").default(0).notNull(),
    classCount: integer("class_count").default(0).notNull(),
    houseCount: integer("house_count").default(0).notNull(),
    schoolHouseCount: integer("school_house_count").default(0).notNull(),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("school_operations_import_batch_org_idx").on(table.organizationId, table.createdAt),
  ],
);

export const schoolMaster = sqliteTable(
  "school_master",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    locationName: text("location_name"),
    affiliationNumber: text("affiliation_number"),
    isActive: integer("is_active").default(1).notNull(),
    sourceSystem: text("source_system").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    importBatchId: text("import_batch_id").references(() => schoolOperationsImportBatch.id, {
      onDelete: "set null",
    }),
    importedAt: text("imported_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [index("school_master_org_name_idx").on(table.organizationId, table.name)],
);

export const academicClassMaster = sqliteTable(
  "academic_class_master",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    level: integer(),
    section: text(),
    title: text(),
    sortOrder: integer("sort_order"),
    isActive: integer("is_active").default(1).notNull(),
    sourceSystem: text("source_system").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    importBatchId: text("import_batch_id").references(() => schoolOperationsImportBatch.id, {
      onDelete: "set null",
    }),
    importedAt: text("imported_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("academic_class_master_org_sort_idx").on(
      table.organizationId,
      table.sortOrder,
      table.level,
      table.section,
      table.name,
    ),
  ],
);

export const houseMaster = sqliteTable(
  "house_master",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    sourceSystem: text("source_system").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    importBatchId: text("import_batch_id").references(() => schoolOperationsImportBatch.id, {
      onDelete: "set null",
    }),
    importedAt: text("imported_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    isActive: integer("is_active").default(1).notNull(),
  },
  (table) => [
    index("house_master_active_name_idx").on(table.organizationId, table.isActive, table.name),
    index("house_master_org_name_idx").on(table.organizationId, table.name),
  ],
);

export const schoolHouseMaster = sqliteTable(
  "school_house_master",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    schoolId: text("school_id")
      .notNull()
      .references(() => schoolMaster.id, { onDelete: "cascade" }),
    houseId: text("house_id")
      .notNull()
      .references(() => houseMaster.id, { onDelete: "cascade" }),
    sourceSystem: text("source_system").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    importBatchId: text("import_batch_id").references(() => schoolOperationsImportBatch.id, {
      onDelete: "set null",
    }),
    importedAt: text("imported_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("school_house_master_org_school_idx").on(
      table.organizationId,
      table.schoolId,
      table.houseId,
    ),
  ],
);

export const studentEnrollmentImportBatch = sqliteTable(
  "student_enrollment_import_batch",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    sourceSystem: text("source_system").notNull(),
    sourceDatabase: text("source_database").notNull(),
    sourceFingerprint: text("source_fingerprint").notNull(),
    status: text().notNull(),
    sourceRowCount: integer("source_row_count").default(0).notNull(),
    enrollmentCount: integer("enrollment_count").default(0).notNull(),
    supersededRowCount: integer("superseded_row_count").default(0).notNull(),
    offeringCount: integer("offering_count").default(0).notNull(),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("student_enrollment_import_batch_org_idx").on(table.organizationId, table.createdAt),
  ],
);

export const schoolClassOffering = sqliteTable(
  "school_class_offering",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    academicSessionId: text("academic_session_id")
      .notNull()
      .references(() => academicSession.id, { onDelete: "cascade" }),
    schoolId: text("school_id")
      .notNull()
      .references(() => schoolMaster.id, { onDelete: "cascade" }),
    academicClassId: text("academic_class_id")
      .notNull()
      .references(() => academicClassMaster.id, { onDelete: "cascade" }),
    isActive: integer("is_active").default(1).notNull(),
    origin: text().notNull(),
    sourceSystem: text("source_system"),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
    importBatchId: text("import_batch_id").references(() => studentEnrollmentImportBatch.id, {
      onDelete: "set null",
    }),
    importedAt: text("imported_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("school_class_offering_roster_idx").on(
      table.organizationId,
      table.academicSessionId,
      table.schoolId,
      table.academicClassId,
      table.isActive,
    ),
  ],
);

export const studentEnrollment = sqliteTable(
  "student_enrollment",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    academicSessionId: text("academic_session_id")
      .notNull()
      .references(() => academicSession.id, { onDelete: "cascade" }),
    schoolId: text("school_id").references(() => schoolMaster.id, { onDelete: "restrict" }),
    academicClassId: text("academic_class_id")
      .notNull()
      .references(() => academicClassMaster.id, { onDelete: "restrict" }),
    houseId: text("house_id").references(() => houseMaster.id, { onDelete: "restrict" }),
    schoolClassOfferingId: text("school_class_offering_id").references(
      () => schoolClassOffering.id,
      { onDelete: "restrict" },
    ),
    status: text().default("recorded").notNull(),
    statusSource: text("status_source").default("legacy_allocation").notNull(),
    startedOn: text("started_on"),
    endedOn: text("ended_on"),
    sourceRecordedOn: text("source_recorded_on"),
    rollNumber: text("roll_number"),
    boardRegistrationNumber: text("board_registration_number"),
    result: text(),
    sourceAcademicRecordId: text("source_academic_record_id").references(
      () => personAcademicRecord.id,
      { onDelete: "set null" },
    ),
    sourceSystem: text("source_system").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    importBatchId: text("import_batch_id").references(() => studentEnrollmentImportBatch.id, {
      onDelete: "set null",
    }),
    importedAt: text("imported_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("student_enrollment_person_history_idx").on(
      table.organizationId,
      table.personId,
      table.academicSessionId,
    ),
    index("student_enrollment_session_roster_idx").on(
      table.organizationId,
      table.academicSessionId,
      table.schoolId,
      table.academicClassId,
      table.status,
    ),
    index("student_enrollment_offering_idx").on(table.organizationId, table.schoolClassOfferingId),
  ],
);

export const historicalResultsImportBatch = sqliteTable("historical_results_import_batch", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  sourceSystem: text("source_system").notNull(),
  sourceDatabase: text("source_database").notNull(),
  sourceFingerprint: text("source_fingerprint").notNull(),
  status: text().notNull(),
  subjectCount: integer("subject_count").default(0).notNull(),
  termCount: integer("term_count").default(0).notNull(),
  assessmentCount: integer("assessment_count").default(0).notNull(),
  markSheetCount: integer("mark_sheet_count").default(0).notNull(),
  resultCount: integer("result_count").default(0).notNull(),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

const academicCatalogColumns = () => ({
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  academicSessionId: text("academic_session_id")
    .notNull()
    .references(() => academicSession.id, { onDelete: "cascade" }),
  name: text().notNull(),
  sourceSystem: text("source_system").notNull(),
  sourceTable: text("source_table").notNull(),
  sourceId: text("source_id").notNull(),
  importedAt: text("imported_at"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const academicSubjectType = sqliteTable("academic_subject_type", academicCatalogColumns());
export const academicSubjectHead = sqliteTable("academic_subject_head", academicCatalogColumns());
export const academicGradeType = sqliteTable("academic_grade_type", academicCatalogColumns());

export const academicGrade = sqliteTable("academic_grade", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  gradeTypeId: text("grade_type_id")
    .notNull()
    .references(() => academicGradeType.id, { onDelete: "cascade" }),
  name: text().notNull(),
  startsAt: real("starts_at").notNull(),
  endsAt: real("ends_at").notNull(),
  points: real().notNull(),
  sourceSystem: text("source_system").notNull(),
  sourceTable: text("source_table").notNull(),
  sourceId: text("source_id").notNull(),
  importedAt: text("imported_at"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const academicSubject = sqliteTable(
  "academic_subject",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    academicSessionId: text("academic_session_id")
      .notNull()
      .references(() => academicSession.id, { onDelete: "cascade" }),
    name: text().notNull(),
    shortName: text("short_name"),
    subjectTypeId: text("subject_type_id").references(() => academicSubjectType.id, {
      onDelete: "set null",
    }),
    subjectHeadId: text("subject_head_id").references(() => academicSubjectHead.id, {
      onDelete: "set null",
    }),
    gradeTypeId: text("grade_type_id").references(() => academicGradeType.id, {
      onDelete: "set null",
    }),
    isOptional: integer("is_optional").default(0).notNull(),
    passingPercentage: real("passing_percentage"),
    isActive: integer("is_active").default(1).notNull(),
    sourceSystem: text("source_system").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    importBatchId: text("import_batch_id").references(() => historicalResultsImportBatch.id, {
      onDelete: "set null",
    }),
    importedAt: text("imported_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("academic_subject_session_name_idx").on(
      table.organizationId,
      table.academicSessionId,
      table.name,
    ),
  ],
);

export const academicTerm = sqliteTable("academic_term", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text().notNull(),
  isActive: integer("is_active").default(1).notNull(),
  sourceSystem: text("source_system").notNull(),
  sourceTable: text("source_table").notNull(),
  sourceId: text("source_id").notNull(),
  importBatchId: text("import_batch_id").references(() => historicalResultsImportBatch.id, {
    onDelete: "set null",
  }),
  importedAt: text("imported_at"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const academicAssessment = sqliteTable("academic_assessment", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  academicSessionId: text("academic_session_id")
    .notNull()
    .references(() => academicSession.id, { onDelete: "cascade" }),
  termId: text("term_id")
    .notNull()
    .references(() => academicTerm.id, { onDelete: "restrict" }),
  name: text().notNull(),
  isActive: integer("is_active").default(1).notNull(),
  sourceSystem: text("source_system").notNull(),
  sourceTable: text("source_table").notNull(),
  sourceId: text("source_id").notNull(),
  importBatchId: text("import_batch_id").references(() => historicalResultsImportBatch.id, {
    onDelete: "set null",
  }),
  importedAt: text("imported_at"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const academicClassSubject = sqliteTable("academic_class_subject", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  academicSessionId: text("academic_session_id")
    .notNull()
    .references(() => academicSession.id, { onDelete: "cascade" }),
  academicClassId: text("academic_class_id")
    .notNull()
    .references(() => academicClassMaster.id, { onDelete: "cascade" }),
  subjectId: text("subject_id")
    .notNull()
    .references(() => academicSubject.id, { onDelete: "cascade" }),
  maximumMarks: real("maximum_marks"),
  displayOrder: integer("display_order"),
  sourceSystem: text("source_system").notNull(),
  sourceTable: text("source_table").notNull(),
  sourceId: text("source_id").notNull(),
  importedAt: text("imported_at"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const academicClassSubjectAssessment = sqliteTable("academic_class_subject_assessment", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  academicSessionId: text("academic_session_id")
    .notNull()
    .references(() => academicSession.id, { onDelete: "cascade" }),
  academicClassId: text("academic_class_id")
    .notNull()
    .references(() => academicClassMaster.id, { onDelete: "cascade" }),
  subjectId: text("subject_id")
    .notNull()
    .references(() => academicSubject.id, { onDelete: "cascade" }),
  assessmentId: text("assessment_id")
    .notNull()
    .references(() => academicAssessment.id, { onDelete: "cascade" }),
  maximumMarks: real("maximum_marks"),
  sourceSystem: text("source_system").notNull(),
  sourceTable: text("source_table").notNull(),
  sourceId: text("source_id").notNull(),
  importedAt: text("imported_at"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const markSheet = sqliteTable(
  "mark_sheet",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    academicSessionId: text("academic_session_id")
      .notNull()
      .references(() => academicSession.id, { onDelete: "cascade" }),
    schoolId: text("school_id").references(() => schoolMaster.id, { onDelete: "restrict" }),
    academicClassId: text("academic_class_id")
      .notNull()
      .references(() => academicClassMaster.id, { onDelete: "restrict" }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => academicSubject.id, { onDelete: "restrict" }),
    termId: text("term_id")
      .notNull()
      .references(() => academicTerm.id, { onDelete: "restrict" }),
    recordedOn: text("recorded_on"),
    isVerified: integer("is_verified").default(0).notNull(),
    status: text().default("draft").notNull(),
    verifiedAt: text("verified_at"),
    verifiedByUserId: text("verified_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    finalizedAt: text("finalized_at"),
    finalizedByUserId: text("finalized_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    maximumMarks: real("maximum_marks"),
    sourceSystem: text("source_system").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    importBatchId: text("import_batch_id").references(() => historicalResultsImportBatch.id, {
      onDelete: "set null",
    }),
    importedAt: text("imported_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("mark_sheet_filter_idx").on(
      table.organizationId,
      table.academicSessionId,
      table.schoolId,
      table.academicClassId,
      table.subjectId,
    ),
    uniqueIndex("mark_sheet_scope_unique_idx").on(
      table.organizationId,
      table.academicSessionId,
      table.schoolId,
      table.academicClassId,
      table.subjectId,
      table.termId,
    ),
    index("mark_sheet_status_idx").on(
      table.organizationId,
      table.academicSessionId,
      table.status,
      table.recordedOn,
    ),
  ],
);

export const studentMark = sqliteTable(
  "student_mark",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    markSheetId: text("mark_sheet_id")
      .notNull()
      .references(() => markSheet.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    assessmentId: text("assessment_id")
      .notNull()
      .references(() => academicAssessment.id, { onDelete: "restrict" }),
    marks: real(),
    maximumMarks: real("maximum_marks"),
    note: text(),
    isActive: integer("is_active").default(1).notNull(),
    removedAt: text("removed_at"),
    sourceSystem: text("source_system").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    importBatchId: text("import_batch_id").references(() => historicalResultsImportBatch.id, {
      onDelete: "set null",
    }),
    importedAt: text("imported_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("student_mark_person_idx").on(table.organizationId, table.personId, table.markSheetId),
    index("student_mark_active_sheet_idx").on(
      table.organizationId,
      table.markSheetId,
      table.isActive,
      table.personId,
    ),
  ],
);

export const studentEnrollmentChange = sqliteTable(
  "student_enrollment_change",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => studentEnrollment.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    academicSessionId: text("academic_session_id")
      .notNull()
      .references(() => academicSession.id, { onDelete: "cascade" }),
    changeType: text("change_type").notNull(),
    effectiveOn: text("effective_on").notNull(),
    fromSchoolId: text("from_school_id").references(() => schoolMaster.id, {
      onDelete: "restrict",
    }),
    toSchoolId: text("to_school_id").references(() => schoolMaster.id, { onDelete: "restrict" }),
    fromAcademicClassId: text("from_academic_class_id").references(() => academicClassMaster.id, {
      onDelete: "restrict",
    }),
    toAcademicClassId: text("to_academic_class_id").references(() => academicClassMaster.id, {
      onDelete: "restrict",
    }),
    fromHouseId: text("from_house_id").references(() => houseMaster.id, { onDelete: "restrict" }),
    toHouseId: text("to_house_id").references(() => houseMaster.id, { onDelete: "restrict" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    note: text(),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    fromRollNumber: text("from_roll_number"),
    toRollNumber: text("to_roll_number"),
  },
  (table) => [
    index("student_enrollment_change_enrollment_idx").on(
      table.organizationId,
      table.enrollmentId,
      table.createdAt,
    ),
    index("student_enrollment_change_history_idx").on(
      table.organizationId,
      table.personId,
      table.academicSessionId,
      table.effectiveOn,
      table.createdAt,
    ),
  ],
);

export const healthHistoryImportBatch = sqliteTable("health_history_import_batch", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  sourceSystem: text("source_system").notNull(),
  sourceDatabase: text("source_database").notNull(),
  sourceFingerprint: text("source_fingerprint").notNull(),
  status: text().notNull(),
  visitCount: integer("visit_count").default(0).notNull(),
  diagnosisCount: integer("diagnosis_count").default(0).notNull(),
  tbCaseCount: integer("tb_case_count").default(0).notNull(),
  tbDetailCount: integer("tb_detail_count").default(0).notNull(),
  medicalAdvanceCount: integer("medical_advance_count").default(0).notNull(),
  medicalAdvanceDetailCount: integer("medical_advance_detail_count").default(0).notNull(),
  medicalSettlementCount: integer("medical_settlement_count").default(0).notNull(),
  linkedPersonCount: integer("linked_person_count").default(0).notNull(),
  unlinkedPersonCount: integer("unlinked_person_count").default(0).notNull(),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const healthVisit = sqliteTable(
  "health_visit",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    personId: text("person_id").references(() => person.id, { onDelete: "set null" }),
    patientName: text("patient_name").notNull(),
    patientKind: text("patient_kind").notNull(),
    admissionNumber: text("admission_number"),
    gender: text(),
    homeName: text("home_name"),
    ageAtVisit: integer("age_at_visit"),
    checkupDate: text("checkup_date").notNull(),
    admittedOn: text("admitted_on"),
    dischargedOn: text("discharged_on"),
    doctorName: text("doctor_name"),
    referredTo: text("referred_to"),
    referralLocation: text("referral_location"),
    remarks: text(),
    hepatitisBStatus: text("hepatitis_b_status"),
    sourceSystem: text("source_system").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    importBatchId: text("import_batch_id").references(() => healthHistoryImportBatch.id, {
      onDelete: "set null",
    }),
    importedAt: text("imported_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("health_visit_date_idx").on(table.organizationId, table.checkupDate, table.patientName),
    index("health_visit_person_idx").on(table.organizationId, table.personId, table.checkupDate),
  ],
);

export const healthDiagnosis = sqliteTable(
  "health_diagnosis",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    healthVisitId: text("health_visit_id")
      .notNull()
      .references(() => healthVisit.id, { onDelete: "cascade" }),
    diagnosisName: text("diagnosis_name").notNull(),
    recordedOn: text("recorded_on"),
    remarks: text(),
    sourceSystem: text("source_system").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    importBatchId: text("import_batch_id").references(() => healthHistoryImportBatch.id, {
      onDelete: "set null",
    }),
    importedAt: text("imported_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("health_diagnosis_visit_idx").on(
      table.organizationId,
      table.healthVisitId,
      table.recordedOn,
    ),
  ],
);

export const healthTbCase = sqliteTable(
  "health_tb_case",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    personId: text("person_id").references(() => person.id, { onDelete: "set null" }),
    patientName: text("patient_name").notNull(),
    patientKind: text("patient_kind").notNull(),
    tbCardNumber: text("tb_card_number"),
    admissionNumber: text("admission_number"),
    fatherName: text("father_name"),
    gender: text(),
    ageAtRegistration: integer("age_at_registration"),
    homeName: text("home_name"),
    treatmentRegimen: text("treatment_regimen"),
    registrationDate: text("registration_date").notNull(),
    treatmentStartDate: text("treatment_start_date"),
    treatmentEndDate: text("treatment_end_date"),
    outcome: text(),
    tbType: text("tb_type"),
    caseType: text("case_type"),
    remarks: text(),
    sourceSystem: text("source_system").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    importBatchId: text("import_batch_id").references(() => healthHistoryImportBatch.id, {
      onDelete: "set null",
    }),
    importedAt: text("imported_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("health_tb_case_date_idx").on(
      table.organizationId,
      table.registrationDate,
      table.patientName,
    ),
    index("health_tb_case_person_idx").on(
      table.organizationId,
      table.personId,
      table.registrationDate,
    ),
  ],
);

export const healthTbDetail = sqliteTable(
  "health_tb_detail",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    tbCaseId: text("tb_case_id")
      .notNull()
      .references(() => healthTbCase.id, { onDelete: "cascade" }),
    recordedOn: text("recorded_on").notNull(),
    testName: text("test_name").notNull(),
    result: text(),
    remarks: text(),
    sourceSystem: text("source_system").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    importBatchId: text("import_batch_id").references(() => healthHistoryImportBatch.id, {
      onDelete: "set null",
    }),
    importedAt: text("imported_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("health_tb_detail_case_idx").on(table.organizationId, table.tbCaseId, table.recordedOn),
  ],
);

export const healthMedicalAdvance = sqliteTable(
  "health_medical_advance",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    sanctionedOn: text("sanctioned_on").notNull(),
    nurseName: text("nurse_name"),
    sanctionNumber: text("sanction_number"),
    advanceAmount: real("advance_amount").notNull(),
    referringDoctorName: text("referring_doctor_name"),
    referralLocation: text("referral_location"),
    remarks: text(),
    sourceSystem: text("source_system").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    importBatchId: text("import_batch_id").references(() => healthHistoryImportBatch.id, {
      onDelete: "set null",
    }),
    importedAt: text("imported_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("health_medical_advance_date_idx").on(
      table.organizationId,
      table.sanctionedOn,
      table.sanctionNumber,
    ),
  ],
);

export const healthMedicalAdvanceDetail = sqliteTable(
  "health_medical_advance_detail",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    medicalAdvanceId: text("medical_advance_id")
      .notNull()
      .references(() => healthMedicalAdvance.id, { onDelete: "cascade" }),
    personId: text("person_id").references(() => person.id, { onDelete: "set null" }),
    patientName: text("patient_name").notNull(),
    patientKind: text("patient_kind").notNull(),
    sanctionType: text("sanction_type").notNull(),
    homeName: text("home_name"),
    gender: text(),
    ageAtSanction: integer("age_at_sanction"),
    medication: text(),
    referredToDoctorName: text("referred_to_doctor_name"),
    hospitalRegistrationNumber: text("hospital_registration_number"),
    hospitalReferredTo: text("hospital_referred_to"),
    hospitalAdmitted: text("hospital_admitted"),
    diagnosis: text(),
    admittedOn: text("admitted_on"),
    dischargedOn: text("discharged_on"),
    surgeryType: text("surgery_type"),
    amount: real(),
    remarks: text(),
    sourceSystem: text("source_system").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    importBatchId: text("import_batch_id").references(() => healthHistoryImportBatch.id, {
      onDelete: "set null",
    }),
    importedAt: text("imported_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("health_medical_advance_detail_advance_idx").on(
      table.organizationId,
      table.medicalAdvanceId,
      table.patientName,
    ),
    index("health_medical_advance_detail_person_idx").on(
      table.organizationId,
      table.personId,
      table.medicalAdvanceId,
    ),
  ],
);

export const healthMedicalSettlement = sqliteTable(
  "health_medical_settlement",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    medicalAdvanceId: text("medical_advance_id")
      .notNull()
      .references(() => healthMedicalAdvance.id, { onDelete: "cascade" }),
    settledOn: text("settled_on").notNull(),
    billNumber: text("bill_number"),
    nurseTada: real("nurse_tada"),
    totalExpenses: real("total_expenses"),
    extraExpenses: real("extra_expenses"),
    balance: real(),
    remarks: text(),
    legacySettlementId: text("legacy_settlement_id").notNull(),
    sourceSystem: text("source_system").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    importBatchId: text("import_batch_id").references(() => healthHistoryImportBatch.id, {
      onDelete: "set null",
    }),
    importedAt: text("imported_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("health_medical_settlement_advance_idx").on(
      table.organizationId,
      table.medicalAdvanceId,
      table.settledOn,
    ),
  ],
);

export const scholarshipImportBatch = sqliteTable("scholarship_import_batch", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  sourceSystem: text("source_system").notNull(),
  sourceDatabase: text("source_database").notNull(),
  sourceFingerprint: text("source_fingerprint").notNull(),
  status: text().notNull(),
  scholarshipCount: integer("scholarship_count").default(0).notNull(),
  annualDetailCount: integer("annual_detail_count").default(0).notNull(),
  sanctionCount: integer("sanction_count").default(0).notNull(),
  sanctionLineCount: integer("sanction_line_count").default(0).notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

const scholarshipSourceColumns = () => ({
  sourceSystem: text("source_system").notNull(),
  sourceTable: text("source_table").notNull(),
  sourceId: text("source_id").notNull(),
  importBatchId: text("import_batch_id").references(() => scholarshipImportBatch.id, {
    onDelete: "set null",
  }),
  importedAt: text("imported_at"),
  createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
  updatedByUserId: text("updated_by_user_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const scholarshipCourseCategory = sqliteTable("scholarship_course_category", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text().notNull(),
  isActive: integer("is_active").default(1).notNull(),
  ...scholarshipSourceColumns(),
});

export const scholarshipCourse = sqliteTable("scholarship_course", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  categoryId: text("category_id").references(() => scholarshipCourseCategory.id, {
    onDelete: "set null",
  }),
  name: text().notNull(),
  isActive: integer("is_active").default(1).notNull(),
  ...scholarshipSourceColumns(),
});

export const scholarshipHead = sqliteTable("scholarship_head", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text().notNull(),
  isActive: integer("is_active").default(1).notNull(),
  ...scholarshipSourceColumns(),
});

export const scholarshipRecord = sqliteTable("scholarship_record", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  personId: text("person_id").references(() => person.id, { onDelete: "set null" }),
  academicSessionId: text("academic_session_id").references(() => academicSession.id, {
    onDelete: "set null",
  }),
  courseId: text("course_id").references(() => scholarshipCourse.id, { onDelete: "set null" }),
  beneficiaryCategory: text("beneficiary_category"),
  studentName: text("student_name").notNull(),
  admissionNumber: text("admission_number"),
  fatherName: text("father_name"),
  gender: text(),
  dateOfBirth: text("date_of_birth"),
  classStream: text("class_stream"),
  classPercentage: real("class_percentage"),
  admissionYear: integer("admission_year"),
  courseDuration: text("course_duration"),
  collegeTraining: integer("college_training").default(0).notNull(),
  cityName: text("city_name"),
  permanentAddress: text("permanent_address"),
  mailingAddress: text("mailing_address"),
  specialAllowance: integer("special_allowance").default(0).notNull(),
  scholarshipAwarded: real("scholarship_awarded"),
  instituteName: text("institute_name"),
  bankAccountNumber: text("bank_account_number"),
  wardHealthRecord: text("ward_health_record"),
  needyCase: text("needy_case"),
  reason: text(),
  status: text().default("active").notNull(),
  phone: text(),
  ledgerNumber: text("ledger_number"),
  ...scholarshipSourceColumns(),
});

export const scholarshipAnnualDetail = sqliteTable("scholarship_annual_detail", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  scholarshipId: text("scholarship_id").references(() => scholarshipRecord.id, {
    onDelete: "cascade",
  }),
  academicSessionId: text("academic_session_id").references(() => academicSession.id, {
    onDelete: "set null",
  }),
  legacyScholarshipId: text("legacy_scholarship_id"),
  studyYear: text("study_year").notNull(),
  passed: integer().default(0).notNull(),
  percentage: real(),
  division: text(),
  fees: real(),
  remarks: text(),
  ...scholarshipSourceColumns(),
});

export const scholarshipSanction = sqliteTable("scholarship_sanction", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  scholarshipId: text("scholarship_id")
    .notNull()
    .references(() => scholarshipRecord.id, { onDelete: "cascade" }),
  academicSessionId: text("academic_session_id").references(() => academicSession.id, {
    onDelete: "set null",
  }),
  amount: real().notNull(),
  sanctionedOn: text("sanctioned_on").notNull(),
  periodFrom: text("period_from"),
  periodTo: text("period_to"),
  paymentReference: text("payment_reference"),
  inFavourOf: text("in_favour_of"),
  remarks: text(),
  ...scholarshipSourceColumns(),
});

export const scholarshipSanctionLine = sqliteTable("scholarship_sanction_line", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  sanctionId: text("sanction_id").references(() => scholarshipSanction.id, { onDelete: "cascade" }),
  scholarshipId: text("scholarship_id").references(() => scholarshipRecord.id, {
    onDelete: "set null",
  }),
  personId: text("person_id").references(() => person.id, { onDelete: "set null" }),
  headId: text("head_id")
    .notNull()
    .references(() => scholarshipHead.id, { onDelete: "restrict" }),
  cityName: text("city_name"),
  amount: real().notNull(),
  advanceOn: text("advance_on"),
  legacySanctionId: text("legacy_sanction_id"),
  ...scholarshipSourceColumns(),
});

export const scholarshipCityAdvance = sqliteTable("scholarship_city_advance", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  academicSessionId: text("academic_session_id").references(() => academicSession.id, {
    onDelete: "set null",
  }),
  cityName: text("city_name").notNull(),
  amount: real().notNull(),
  ...scholarshipSourceColumns(),
});

export const scholarshipLimit = sqliteTable("scholarship_limit", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  courseGroup: text("course_group").notNull(),
  headName: text("head_name").notNull(),
  amount: real(),
  isActive: integer("is_active").default(1).notNull(),
  ...scholarshipSourceColumns(),
});

export const sponsorshipImportBatch = sqliteTable("sponsorship_import_batch", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  sourceSystem: text("source_system").notNull(),
  sourceDatabase: text("source_database").notNull(),
  sourceFingerprint: text("source_fingerprint").notNull(),
  status: text().notNull(),
  individualCount: integer("individual_count").default(0).notNull(),
  assignmentCount: integer("assignment_count").default(0).notNull(),
  fundCount: integer("fund_count").default(0).notNull(),
  allocationCount: integer("allocation_count").default(0).notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

const sponsorshipSourceColumns = () => ({
  sourceSystem: text("source_system").notNull(),
  sourceTable: text("source_table").notNull(),
  sourceId: text("source_id").notNull(),
  importBatchId: text("import_batch_id").references(() => sponsorshipImportBatch.id, {
    onDelete: "set null",
  }),
  importedAt: text("imported_at"),
  createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
  updatedByUserId: text("updated_by_user_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const sponsorshipOrganization = sqliteTable("sponsorship_organization", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text().notNull(),
  countryName: text("country_name"),
  supportsChildren: integer("supports_children").default(0).notNull(),
  supportsElderly: integer("supports_elderly").default(0).notNull(),
  isActive: integer("is_active").default(1).notNull(),
  ...sponsorshipSourceColumns(),
});

export const sponsorshipSponsorType = sqliteTable("sponsorship_sponsor_type", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text().notNull(),
  isActive: integer("is_active").default(1).notNull(),
  ...sponsorshipSourceColumns(),
});

export const sponsorshipSponsorCategory = sqliteTable("sponsorship_sponsor_category", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text().notNull(),
  isActive: integer("is_active").default(1).notNull(),
  ...sponsorshipSourceColumns(),
});

export const sponsorshipStatus = sqliteTable("sponsorship_status", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text().notNull(),
  isActive: integer("is_active").default(1).notNull(),
  ...sponsorshipSourceColumns(),
});

export const sponsorshipIndividual = sqliteTable("sponsorship_individual", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  sponsorOrganizationId: text("sponsor_organization_id").references(
    () => sponsorshipOrganization.id,
    { onDelete: "set null" },
  ),
  legacySponsorOrganizationId: text("legacy_sponsor_organization_id"),
  sponsorTypeId: text("sponsor_type_id").references(() => sponsorshipSponsorType.id, {
    onDelete: "set null",
  }),
  sponsorCategoryId: text("sponsor_category_id").references(() => sponsorshipSponsorCategory.id, {
    onDelete: "set null",
  }),
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  lastName: text("last_name"),
  displayName: text("display_name").notNull(),
  address: text(),
  countryName: text("country_name"),
  email: text(),
  phone: text(),
  isActive: integer("is_active").default(1).notNull(),
  ...sponsorshipSourceColumns(),
});

export const sponsorshipAssignment = sqliteTable("sponsorship_assignment", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  personId: text("person_id")
    .notNull()
    .references(() => person.id, { onDelete: "cascade" }),
  sponsorIndividualId: text("sponsor_individual_id")
    .notNull()
    .references(() => sponsorshipIndividual.id, { onDelete: "cascade" }),
  sponsorshipStatusId: text("sponsorship_status_id")
    .notNull()
    .references(() => sponsorshipStatus.id, { onDelete: "restrict" }),
  academicSessionId: text("academic_session_id").references(() => academicSession.id, {
    onDelete: "set null",
  }),
  statusOn: text("status_on"),
  remarks: text(),
  ...sponsorshipSourceColumns(),
});

export const sponsorshipFundType = sqliteTable("sponsorship_fund_type", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text().notNull(),
  isActive: integer("is_active").default(1).notNull(),
  ...sponsorshipSourceColumns(),
});

export const sponsorshipVisitorType = sqliteTable("sponsorship_visitor_type", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text().notNull(),
  isActive: integer("is_active").default(1).notNull(),
  ...sponsorshipSourceColumns(),
});

export const sponsorshipVisitor = sqliteTable("sponsorship_visitor", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  visitorTypeId: text("visitor_type_id").references(() => sponsorshipVisitorType.id, {
    onDelete: "set null",
  }),
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  lastName: text("last_name"),
  displayName: text("display_name").notNull(),
  address: text(),
  countryName: text("country_name"),
  email: text(),
  phone: text(),
  relatedPersonName: text("related_person_name"),
  visitedOn: text("visited_on"),
  mementoQuantity: integer("memento_quantity"),
  giftsPresented: text("gifts_presented"),
  visitSummary: text("visit_summary"),
  comments: text(),
  ...sponsorshipSourceColumns(),
});

export const sponsorshipFund = sqliteTable("sponsorship_fund", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  fundTypeId: text("fund_type_id")
    .notNull()
    .references(() => sponsorshipFundType.id, { onDelete: "restrict" }),
  academicSessionId: text("academic_session_id").references(() => academicSession.id, {
    onDelete: "set null",
  }),
  sponsorKind: text("sponsor_kind").notNull(),
  sponsorIndividualId: text("sponsor_individual_id").references(() => sponsorshipIndividual.id, {
    onDelete: "set null",
  }),
  sponsorOrganizationId: text("sponsor_organization_id").references(
    () => sponsorshipOrganization.id,
    { onDelete: "set null" },
  ),
  visitorId: text("visitor_id").references(() => sponsorshipVisitor.id, { onDelete: "set null" }),
  legacySponsorPartyId: text("legacy_sponsor_party_id"),
  receivedOn: text("received_on").notNull(),
  periodFrom: text("period_from"),
  periodTo: text("period_to"),
  amount: real().notNull(),
  receiptNumber: text("receipt_number"),
  remarks: text(),
  ...sponsorshipSourceColumns(),
});

export const sponsorshipFundAllocation = sqliteTable("sponsorship_fund_allocation", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  fundId: text("fund_id")
    .notNull()
    .references(() => sponsorshipFund.id, { onDelete: "cascade" }),
  personId: text("person_id").references(() => person.id, { onDelete: "set null" }),
  legacyBeneficiaryId: text("legacy_beneficiary_id"),
  academicSessionId: text("academic_session_id").references(() => academicSession.id, {
    onDelete: "set null",
  }),
  amount: real().notNull(),
  receiptNumber: text("receipt_number"),
  periodFrom: text("period_from"),
  periodTo: text("period_to"),
  remarks: text(),
  ...sponsorshipSourceColumns(),
});

export const sponsorshipCorrespondenceType = sqliteTable("sponsorship_correspondence_type", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text().notNull(),
  isActive: integer("is_active").default(1).notNull(),
  ...sponsorshipSourceColumns(),
});

export const sponsorshipLetter = sqliteTable("sponsorship_letter", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  correspondenceTypeId: text("correspondence_type_id")
    .notNull()
    .references(() => sponsorshipCorrespondenceType.id, { onDelete: "restrict" }),
  sponsorIndividualId: text("sponsor_individual_id").references(() => sponsorshipIndividual.id, {
    onDelete: "set null",
  }),
  personId: text("person_id").references(() => person.id, { onDelete: "set null" }),
  academicSessionId: text("academic_session_id").references(() => academicSession.id, {
    onDelete: "set null",
  }),
  sender: text(),
  receiver: text(),
  receivedOn: text("received_on").notNull(),
  repliedOn: text("replied_on"),
  replyDueOn: text("reply_due_on"),
  remarks: text(),
  ...sponsorshipSourceColumns(),
});

export const staffImportBatch = sqliteTable("staff_import_batch", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  sourceSystem: text("source_system").notNull(),
  sourceDatabase: text("source_database").notNull(),
  sourceFingerprint: text("source_fingerprint").notNull(),
  status: text().notNull(),
  departmentCount: integer("department_count").default(0).notNull(),
  designationCount: integer("designation_count").default(0).notNull(),
  categoryCount: integer("category_count").default(0).notNull(),
  profileCount: integer("profile_count").default(0).notNull(),
  employmentEventCount: integer("employment_event_count").default(0).notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

const staffSourceColumns = () => ({
  sourceSystem: text("source_system").notNull(),
  sourceTable: text("source_table").notNull(),
  sourceId: text("source_id").notNull(),
  importBatchId: text("import_batch_id").references(() => staffImportBatch.id, {
    onDelete: "set null",
  }),
  importedAt: text("imported_at"),
  createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
  updatedByUserId: text("updated_by_user_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const staffDepartment = sqliteTable(
  "staff_department",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    isActive: integer("is_active").default(1).notNull(),
    ...staffSourceColumns(),
  },
  (table) => [
    index("staff_department_name_idx").on(table.organizationId, table.isActive, table.name),
  ],
);

export const staffDesignation = sqliteTable(
  "staff_designation",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    departmentId: text("department_id").references(() => staffDepartment.id, {
      onDelete: "set null",
    }),
    legacyDepartmentId: text("legacy_department_id"),
    name: text().notNull(),
    isActive: integer("is_active").default(1).notNull(),
    ...staffSourceColumns(),
  },
  (table) => [
    index("staff_designation_name_idx").on(
      table.organizationId,
      table.departmentId,
      table.isActive,
      table.name,
    ),
  ],
);

export const staffCategory = sqliteTable("staff_category", {
  id: text().primaryKey().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text().notNull(),
  isActive: integer("is_active").default(1).notNull(),
  ...staffSourceColumns(),
});

export const staffProfile = sqliteTable(
  "staff_profile",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    departmentId: text("department_id").references(() => staffDepartment.id, {
      onDelete: "set null",
    }),
    designationId: text("designation_id").references(() => staffDesignation.id, {
      onDelete: "set null",
    }),
    categoryId: text("category_id").references(() => staffCategory.id, {
      onDelete: "set null",
    }),
    legacyDepartmentId: text("legacy_department_id"),
    legacyDesignationId: text("legacy_designation_id"),
    permanentOn: text("permanent_on"),
    spouseName: text("spouse_name"),
    settlementName: text("settlement_name"),
    allocatedPlace: text("allocated_place"),
    motherName: text("mother_name"),
    fatherName: text("father_name"),
    address: text(),
    maritalStatus: text("marital_status"),
    registrationCertificateNumber: text("registration_certificate_number"),
    panNumber: text("pan_number"),
    phone: text(),
    email: text(),
    quarterNumber: text("quarter_number"),
    nominee: text(),
    birthPlace: text("birth_place"),
    city: text(),
    region: text(),
    country: text(),
    withdrawalReason: text("withdrawal_reason"),
    withdrawalOn: text("withdrawal_on"),
    identityCardNumber: text("identity_card_number"),
    greenBookNumber: text("green_book_number"),
    remarks: text(),
    ...staffSourceColumns(),
  },
  (table) => [
    uniqueIndex("staff_profile_person_idx").on(table.organizationId, table.personId),
    index("staff_profile_directory_idx").on(
      table.organizationId,
      table.departmentId,
      table.designationId,
      table.personId,
    ),
  ],
);

export const staffEmploymentEvent = sqliteTable(
  "staff_employment_event",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    departmentId: text("department_id").references(() => staffDepartment.id, {
      onDelete: "set null",
    }),
    designationId: text("designation_id").references(() => staffDesignation.id, {
      onDelete: "set null",
    }),
    legacyDepartmentId: text("legacy_department_id"),
    legacyDesignationId: text("legacy_designation_id"),
    locationName: text("location_name"),
    effectiveOn: text("effective_on"),
    transferReason: text("transfer_reason"),
    remarks: text(),
    ...staffSourceColumns(),
  },
  (table) => [
    index("staff_employment_event_timeline_idx").on(
      table.organizationId,
      table.personId,
      table.effectiveOn,
    ),
  ],
);

export const accessPermission = sqliteTable("access_permission", {
  key: text().primaryKey().notNull(),
  name: text().notNull(),
  category: text().notNull(),
  description: text(),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const accessRole = sqliteTable(
  "access_role",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    key: text().notNull(),
    name: text().notNull(),
    description: text(),
    isSystem: integer("is_system").default(1).notNull(),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [index("access_role_org_idx").on(table.organizationId, table.name)],
);

export const accessRolePermission = sqliteTable(
  "access_role_permission",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => accessRole.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key")
      .notNull()
      .references(() => accessPermission.key, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      columns: [table.roleId, table.permissionKey],
      name: "access_role_permission_role_id_permission_key_pk",
    }),
  ],
);

export const accessGroup = sqliteTable(
  "access_group",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    key: text().notNull(),
    name: text().notNull(),
    description: text(),
    isSystem: integer("is_system").default(1).notNull(),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [index("access_group_org_idx").on(table.organizationId, table.name)],
);

export const accessGroupRole = sqliteTable(
  "access_group_role",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => accessGroup.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => accessRole.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      columns: [table.groupId, table.roleId],
      name: "access_group_role_group_id_role_id_pk",
    }),
  ],
);
