import { and, asc, count, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@/db/client";
import type { DrizzleStatement, QueryDatabase } from "@/db/query";
import {
  academicAssessment,
  academicClassMaster,
  academicClassSubject,
  academicClassSubjectAssessment,
  academicGrade,
  academicGradeType,
  academicSession,
  academicSubject,
  academicSubjectHead,
  academicSubjectType,
  accessGroup,
  accessGroupRole,
  accessPermission,
  accessRole,
  accessRolePermission,
  auditEvent,
  organization,
  organizationInvitation,
  organizationMember,
  user,
  userPreference,
} from "@/db/schema";

import {
  groupCatalog,
  groupRoleDefaults,
  permissionCatalog,
  roleCatalog,
  rolePermissionDefaults,
} from "@/lib/access-control";
import type { AccessGroupKey, AccessRoleKey, PermissionKey } from "@/lib/access-control";
import { nextMarkSheetStatus } from "@/lib/academic-results";
import { createAuth } from "@/lib/auth";
import { sendInvitationEmail } from "@/lib/invitation-email";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { allocationsFitFund, sponsorshipDisplayName } from "@/lib/sponsorship";

const preferenceSchema = z.object({
  academicSessionId: z.string().uuid(),
});

const organizationSettingsSchema = z.object({
  name: z.string().trim().min(2).max(100),
  timezone: z.string().trim().min(1).max(64),
  locale: z
    .string()
    .trim()
    .regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/),
});

const memberRoleSchema = z.object({
  group: z.enum(["admin", "staff", "viewer"]),
});

const invitationSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  group: z.enum(["admin", "staff", "viewer"]),
});

const groupRolesSchema = z.object({
  roleKeys: z
    .array(
      z.enum([
        "organization_administrator",
        "registration",
        "school",
        "sponsorship",
        "scholarship",
        "dispensary",
        "staff_operations",
        "auditor",
      ]),
    )
    .max(roleCatalog.length),
});

const invitationTokenSchema = z.object({
  token: z.string().min(32).max(256),
});

const transferOwnershipSchema = z.object({
  targetMemberId: z.string().uuid(),
});

const signUpInputSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
});

const peopleQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  kind: z.enum(["all", "child", "elderly", "staff"]).default("all"),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});

const schoolOverviewQuerySchema = z.object({
  sessionId: z.uuid(),
});

const schoolStudentFiltersSchema = z.object({
  sessionId: z.uuid(),
  q: z.string().trim().max(100).default(""),
  school: z.string().trim().max(160).default("all"),
  className: z.string().trim().max(100).default("all"),
  house: z.string().trim().max(100).default("all"),
  status: z
    .enum(["all", "recorded", "enrolled", "transferred", "withdrawn", "completed"])
    .default("all"),
});

const schoolStudentsQuerySchema = schoolStudentFiltersSchema.extend({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});

const schoolStudentReportQuerySchema = schoolStudentFiltersSchema;

const schoolRostersQuerySchema = z.object({
  sessionId: z.uuid(),
  q: z.string().trim().max(100).default(""),
  school: z.string().trim().max(160).default("all"),
});

const schoolMasterSchema = z.object({
  name: z.string().trim().min(2).max(160),
  locationName: z
    .string()
    .trim()
    .max(160)
    .nullable()
    .transform((value) => value || null),
  affiliationNumber: z
    .string()
    .trim()
    .max(100)
    .nullable()
    .transform((value) => value || null),
  isActive: z.boolean(),
});

const academicClassMasterSchema = z.object({
  name: z.string().trim().min(1).max(100),
  section: z
    .string()
    .trim()
    .max(30)
    .nullable()
    .transform((value) => value || null),
  level: z.number().int().min(0).max(30).nullable(),
  sortOrder: z.number().int().min(0).max(1_000).nullable(),
  isActive: z.boolean(),
});

const houseMasterSchema = z.object({
  name: z.string().trim().min(1).max(100),
  isActive: z.boolean(),
});

const schoolAssignmentsSchema = z.object({
  sessionId: z.uuid(),
  classIds: z.array(z.uuid()).max(500),
  houseIds: z.array(z.uuid()).max(500),
});

const isoDateSchema = z.iso.date();

const admissionSchema = z.object({
  sessionId: z.uuid(),
  admissionNumber: z.string().trim().min(1).max(50),
  displayName: z.string().trim().min(2).max(120),
  gender: z.enum(["female", "male", "other", "unknown"]).optional(),
  dateOfBirth: isoDateSchema.optional(),
  admittedOn: isoDateSchema,
  schoolId: z.uuid(),
  academicClassId: z.uuid(),
  houseId: z.uuid().optional(),
  rollNumber: z.string().trim().max(50).optional(),
});

const enrollmentIdSchema = z.uuid();

const enrollmentChangeSchema = z
  .object({
    action: z.enum([
      "placement_changed",
      "internal_transfer",
      "transferred_out",
      "withdrawn",
      "completed",
    ]),
    effectiveOn: isoDateSchema,
    schoolId: z.uuid().optional(),
    academicClassId: z.uuid().optional(),
    houseId: z.uuid().nullable().optional(),
    rollNumber: z.string().trim().max(50).nullable().optional(),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((value, context) => {
    if ((value.action === "withdrawn" || value.action === "completed") && !value.note) {
      context.addIssue({
        code: "custom",
        message: "Enter a reason.",
        path: ["note"],
      });
    }
  });

const enrollmentEndDetailsSchema = z.object({
  effectiveOn: isoDateSchema,
  reason: z.string().trim().min(1).max(500),
});

const historicalResultsOverviewQuerySchema = z.object({
  sessionId: z.uuid().optional(),
});

const historicalResultsQuerySchema = z.object({
  sessionId: z.uuid(),
  q: z.string().trim().max(100).default(""),
  school: z.string().trim().max(160).default("all"),
  className: z.string().trim().max(160).default("all"),
  subject: z.string().trim().max(160).default("all"),
  term: z.string().trim().max(160).default("all"),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});

const resultSetupQuerySchema = z.object({ sessionId: z.uuid() });

const academicConfigurationMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("saveCatalog"),
    sessionId: z.uuid(),
    kind: z.enum(["subjectType", "subjectHead", "gradeType"]),
    id: z.uuid().optional(),
    name: z.string().trim().min(1).max(120),
  }),
  z
    .object({
      action: z.literal("saveGrade"),
      sessionId: z.uuid(),
      id: z.uuid().optional(),
      gradeTypeId: z.uuid(),
      name: z.string().trim().min(1).max(30),
      startsAt: z.number().min(0).max(10_000),
      endsAt: z.number().min(0).max(10_000),
      points: z.number().min(0).max(10_000),
    })
    .refine((value) => value.startsAt <= value.endsAt, { message: "The grade range is reversed." }),
  z.object({
    action: z.literal("saveSubject"),
    sessionId: z.uuid(),
    id: z.uuid().optional(),
    name: z.string().trim().min(1).max(120),
    shortName: z.string().trim().max(30).nullable(),
    subjectTypeId: z.uuid().nullable(),
    subjectHeadId: z.uuid().nullable(),
    gradeTypeId: z.uuid().nullable(),
    isOptional: z.boolean(),
    passingPercentage: z.number().min(0).max(100).nullable(),
    isActive: z.boolean(),
  }),
  z.object({
    action: z.literal("saveClassSubject"),
    sessionId: z.uuid(),
    academicClassId: z.uuid(),
    subjectId: z.uuid(),
    enabled: z.boolean(),
    maximumMarks: z.number().positive().max(10_000),
    displayOrder: z.number().int().min(0).max(1_000),
    assessmentLimits: z
      .array(z.object({ assessmentId: z.uuid(), maximumMarks: z.number().positive().max(10_000) }))
      .max(100),
  }),
  z.object({
    action: z.literal("delete"),
    sessionId: z.uuid(),
    kind: z.enum(["subjectType", "subjectHead", "gradeType", "grade", "subject"]),
    id: z.uuid(),
  }),
]);

const resultSummaryQuerySchema = z.object({
  sessionId: z.uuid(),
  q: z.string().trim().max(100).default(""),
  school: z.string().trim().max(160).default("all"),
  className: z.string().trim().max(160).default("all"),
  subject: z.string().trim().max(160).default("all"),
  term: z.string().trim().max(160).default("all"),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});

const reportCardQuerySchema = z.object({
  sessionId: z.uuid(),
  personId: z.uuid(),
  termId: z.uuid(),
});

const resultCatalogSchema = z.object({
  sessionId: z.uuid(),
  subject: z.object({
    name: z.string().trim().min(1).max(120),
    shortName: z.string().trim().max(30).nullable().optional(),
    isOptional: z.boolean().default(false),
    passingPercentage: z.number().min(0).max(100).nullable().optional(),
  }),
  term: z.object({ name: z.string().trim().min(1).max(80) }),
  assessments: z
    .array(z.object({ name: z.string().trim().min(1).max(100) }))
    .min(1)
    .max(20),
});

const markEntrySchema = z.object({
  personId: z.uuid(),
  assessmentId: z.uuid(),
  marks: z.number().min(0).nullable(),
  maximumMarks: z.number().positive().max(10_000),
  note: z.string().trim().max(500).nullable().optional(),
});

const markSheetMutationSchema = z
  .object({
    sessionId: z.uuid(),
    schoolId: z.uuid(),
    academicClassId: z.uuid(),
    subjectId: z.uuid(),
    termId: z.uuid(),
    recordedOn: isoDateSchema,
    maximumMarks: z.number().positive().max(10_000).nullable().optional(),
    marks: z.array(markEntrySchema).min(1).max(5_000),
  })
  .superRefine((value, context) => {
    const keys = new Set<string>();
    for (const [index, mark] of value.marks.entries()) {
      const key = `${mark.personId}:${mark.assessmentId}`;
      if (keys.has(key))
        context.addIssue({
          code: "custom",
          message: "Duplicate mark entry.",
          path: ["marks", index],
        });
      keys.add(key);
      if (mark.marks !== null && mark.marks > mark.maximumMarks) {
        context.addIssue({
          code: "custom",
          message: "Marks cannot exceed maximum marks.",
          path: ["marks", index, "marks"],
        });
      }
    }
  });

const markSheetStatusSchema = z.object({ action: z.enum(["verify", "finalize", "reopen"]) });

const scholarshipListQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  status: z.enum(["all", "active", "closed"]).default("all"),
  course: z.string().trim().max(160).default("all"),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});

const scholarshipReportQuerySchema = z.object({
  report: z.enum(["ledger", "courseCompleted", "newStudents", "placeWise", "yearWise", "students"]),
  session: z.union([z.literal("all"), z.uuid()]).default("all"),
});

const scholarshipRecordSchema = z.object({
  personId: z.uuid(),
  sessionId: z.uuid().nullable().optional(),
  courseId: z.uuid(),
  beneficiaryCategory: z.string().trim().max(100).nullable().optional(),
  studentName: z.string().trim().min(1).max(160),
  admissionNumber: z.string().trim().max(80).nullable().optional(),
  fatherName: z.string().trim().max(160).nullable().optional(),
  gender: z.enum(["female", "male", "other", "unknown"]).nullable().optional(),
  dateOfBirth: isoDateSchema.nullable().optional(),
  classStream: z.string().trim().max(120).nullable().optional(),
  classPercentage: z.number().min(0).max(100).nullable().optional(),
  admissionYear: z.number().int().min(1900).max(2200).nullable().optional(),
  courseDuration: z.string().trim().max(80).nullable().optional(),
  collegeTraining: z.boolean().default(false),
  cityName: z.string().trim().max(160).nullable().optional(),
  permanentAddress: z.string().trim().max(1000).nullable().optional(),
  mailingAddress: z.string().trim().max(1000).nullable().optional(),
  specialAllowance: z.boolean().default(false),
  scholarshipAwarded: z.number().min(0).nullable().optional(),
  instituteName: z.string().trim().max(250).nullable().optional(),
  bankAccountNumber: z.string().trim().max(100).nullable().optional(),
  wardHealthRecord: z.string().trim().max(500).nullable().optional(),
  needyCase: z.string().trim().max(500).nullable().optional(),
  reason: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(["active", "closed"]),
  phone: z.string().trim().max(40).nullable().optional(),
  ledgerNumber: z.string().trim().max(80).nullable().optional(),
});

const scholarshipAnnualSchema = z.object({
  id: z.uuid().optional(),
  sessionId: z.uuid().nullable().optional(),
  studyYear: z.string().trim().min(1).max(80),
  passed: z.boolean(),
  percentage: z.number().min(0).max(100).nullable().optional(),
  division: z.string().trim().max(80).nullable().optional(),
  fees: z.number().min(0).nullable().optional(),
  remarks: z.string().trim().max(1000).nullable().optional(),
});

const scholarshipSanctionSchema = z.object({
  id: z.uuid().optional(),
  sessionId: z.uuid().nullable().optional(),
  amount: z.number().min(0),
  sanctionedOn: isoDateSchema,
  periodFrom: isoDateSchema.nullable().optional(),
  periodTo: isoDateSchema.nullable().optional(),
  paymentReference: z.string().trim().max(100).nullable().optional(),
  inFavourOf: z.string().trim().max(200).nullable().optional(),
  remarks: z.string().trim().max(1000).nullable().optional(),
  lines: z
    .array(
      z.object({
        headId: z.uuid(),
        cityName: z.string().trim().max(160).nullable().optional(),
        amount: z.number().min(0),
        advanceOn: isoDateSchema.nullable().optional(),
      }),
    )
    .min(1)
    .max(50),
});

const scholarshipActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("record"), value: scholarshipRecordSchema }),
  z.object({ action: z.literal("annual"), value: scholarshipAnnualSchema }),
  z.object({ action: z.literal("sanction"), value: scholarshipSanctionSchema }),
]);

const scholarshipSetupSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("courseCategory"),
    id: z.uuid().optional(),
    name: z.string().trim().min(1).max(120),
  }),
  z.object({
    kind: z.literal("course"),
    id: z.uuid().optional(),
    categoryId: z.uuid().nullable().optional(),
    name: z.string().trim().min(1).max(160),
  }),
  z.object({
    kind: z.literal("head"),
    id: z.uuid().optional(),
    name: z.string().trim().min(1).max(120),
  }),
  z.object({
    kind: z.literal("limit"),
    id: z.uuid().optional(),
    courseGroup: z.string().trim().min(1).max(160),
    headName: z.string().trim().min(1).max(120),
    amount: z.number().min(0).nullable().optional(),
  }),
  z.object({
    kind: z.literal("cityAdvance"),
    id: z.uuid().optional(),
    sessionId: z.uuid().nullable().optional(),
    cityName: z.string().trim().min(1).max(160),
    amount: z.number().min(0),
  }),
]);

const sponsorshipListQuerySchema = z.object({
  section: z.enum(["sponsors", "assignments", "funds", "correspondence", "visitors"]),
  q: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});

const sponsorshipReportQuerySchema = z.object({
  report: z.enum([
    "homeWise",
    "organizationWise",
    "addresses",
    "completionElderly",
    "completionStudent",
    "caseHistoryStudent",
    "caseHistoryElderly",
    "giftMoney",
    "payments",
    "sponsors",
    "visitors",
  ]),
  session: z.union([z.literal("all"), z.uuid()]).default("all"),
});

const sponsorshipMutationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("organization"),
    id: z.uuid().optional(),
    name: z.string().trim().min(1).max(180),
    countryName: z.string().trim().max(120).nullable().optional(),
    supportsChildren: z.boolean().default(false),
    supportsElderly: z.boolean().default(false),
  }),
  z.object({
    kind: z.literal("individual"),
    id: z.uuid().optional(),
    sponsorOrganizationId: z.uuid().nullable().optional(),
    sponsorTypeId: z.uuid().nullable().optional(),
    sponsorCategoryId: z.uuid().nullable().optional(),
    firstName: z.string().trim().min(1).max(100),
    middleName: z.string().trim().max(100).nullable().optional(),
    lastName: z.string().trim().max(100).nullable().optional(),
    address: z.string().trim().max(1000).nullable().optional(),
    countryName: z.string().trim().max(120).nullable().optional(),
    email: z.string().trim().email().max(254).nullable().optional(),
    phone: z.string().trim().max(60).nullable().optional(),
  }),
  z.object({
    kind: z.literal("assignment"),
    id: z.uuid().optional(),
    personId: z.uuid(),
    sponsorIndividualId: z.uuid(),
    statusId: z.uuid(),
    sessionId: z.uuid().nullable().optional(),
    statusOn: isoDateSchema,
    remarks: z.string().trim().max(1000).nullable().optional(),
  }),
  z.object({
    kind: z.literal("fund"),
    id: z.uuid().optional(),
    fundTypeId: z.uuid(),
    sessionId: z.uuid().nullable().optional(),
    sponsorKind: z.enum(["individual", "organization", "visitor"]),
    sponsorPartyId: z.uuid(),
    receivedOn: isoDateSchema,
    periodFrom: isoDateSchema.nullable().optional(),
    periodTo: isoDateSchema.nullable().optional(),
    amount: z.number().min(0),
    receiptNumber: z.string().trim().max(100).nullable().optional(),
    remarks: z.string().trim().max(1000).nullable().optional(),
    allocations: z
      .array(
        z.object({
          personId: z.uuid(),
          amount: z.number().min(0),
          remarks: z.string().trim().max(500).nullable().optional(),
        }),
      )
      .max(1000),
  }),
  z.object({
    kind: z.literal("correspondence"),
    id: z.uuid().optional(),
    correspondenceTypeId: z.uuid(),
    sponsorIndividualId: z.uuid().nullable().optional(),
    personId: z.uuid().nullable().optional(),
    sessionId: z.uuid().nullable().optional(),
    sender: z.string().trim().max(180).nullable().optional(),
    receiver: z.string().trim().max(180).nullable().optional(),
    receivedOn: isoDateSchema,
    repliedOn: isoDateSchema.nullable().optional(),
    replyDueOn: isoDateSchema.nullable().optional(),
    remarks: z.string().trim().max(2000).nullable().optional(),
  }),
  z.object({
    kind: z.literal("visitor"),
    id: z.uuid().optional(),
    visitorTypeId: z.uuid().nullable().optional(),
    firstName: z.string().trim().min(1).max(100),
    middleName: z.string().trim().max(100).nullable().optional(),
    lastName: z.string().trim().max(100).nullable().optional(),
    address: z.string().trim().max(1000).nullable().optional(),
    countryName: z.string().trim().max(120).nullable().optional(),
    email: z.string().trim().email().max(254).nullable().optional(),
    phone: z.string().trim().max(60).nullable().optional(),
    relatedPersonName: z.string().trim().max(180).nullable().optional(),
    visitedOn: isoDateSchema,
    mementoQuantity: z.number().int().min(0).nullable().optional(),
    giftsPresented: z.string().trim().max(500).nullable().optional(),
    visitSummary: z.string().trim().max(2000).nullable().optional(),
    comments: z.string().trim().max(2000).nullable().optional(),
  }),
  ...(
    [
      "sponsorType",
      "sponsorCategory",
      "status",
      "fundType",
      "correspondenceType",
      "visitorType",
    ] as const
  ).map((kind) =>
    z.object({
      kind: z.literal(kind),
      id: z.uuid().optional(),
      name: z.string().trim().min(1).max(160),
    }),
  ),
]);

const healthHistoryQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  kind: z.enum(["all", "child", "elderly", "staff", "other"]).default("all"),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});

const tbHistoryQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  kind: z.enum(["all", "child", "elderly", "staff", "other"]).default("all"),
  outcome: z.string().trim().max(100).default("all"),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});

const medicalAdvanceQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  kind: z.enum(["all", "child", "elderly", "staff", "other"]).default("all"),
  settlement: z.enum(["all", "settled", "unsettled"]).default("all"),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});

const personIdSchema = z.uuid();
const fileIdSchema = z.uuid();
const personFileCategorySchema = z.enum([
  "profile_photo",
  "parents_photo",
  "guardian_1_photo",
  "guardian_2_photo",
  "document",
]);
const personFileNameSchema = z.string().trim().min(1).max(160);

const nullablePersonText = (maximum: number) =>
  z.union([z.string().trim().max(maximum), z.null()]).transform((value) => (value ? value : null));

const nullablePersonDate = z
  .union([isoDateSchema, z.literal(""), z.null()])
  .transform((value) => (value ? value : null));

const personCoreDetailsSchema = z.object({
  primaryIdentifier: z.string().trim().min(1).max(50),
  displayName: z.string().trim().min(2).max(120),
  gender: z.enum(["female", "male", "other", "unknown"]),
  dateOfBirth: nullablePersonDate,
  admittedOrJoinedOn: nullablePersonDate,
  campusOrLocation: nullablePersonText(160),
  nationality: nullablePersonText(100),
});

const personFamilyDetailsSchema = z.object({
  parentageStatus: nullablePersonText(100),
  motherName: nullablePersonText(160),
  fatherName: nullablePersonText(160),
  motherOccupation: nullablePersonText(160),
  fatherOccupation: nullablePersonText(160),
  parentsPhone: nullablePersonText(60),
  parentsPermanentAddress: nullablePersonText(500),
  guardian1Name: nullablePersonText(160),
  guardian1Address: nullablePersonText(500),
  guardian1Email: nullablePersonText(254),
  guardian1Phone: nullablePersonText(60),
  guardian1Mobile: nullablePersonText(60),
  guardian2Name: nullablePersonText(160),
  guardian2Address: nullablePersonText(500),
  guardian2Email: nullablePersonText(254),
  guardian2Phone: nullablePersonText(60),
  guardian2Mobile: nullablePersonText(60),
  maritalStatus: nullablePersonText(100),
  spouseName: nullablePersonText(160),
  numberOfChildren: nullablePersonText(50),
});

const homePlacementSchema = z.object({
  homeName: z.string().trim().min(1).max(160),
  locationName: nullablePersonText(160),
  placementType: nullablePersonText(100),
  startedOn: isoDateSchema,
  reason: nullablePersonText(500),
  remarks: nullablePersonText(1_000),
});

const siblingOptionsQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
});

const siblingLinkSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("existing"), relatedPersonId: z.uuid() }),
  z.object({
    mode: z.literal("new"),
    displayName: z.string().trim().min(2).max(120),
    primaryIdentifier: z.string().trim().min(1).max(50),
    gender: z.enum(["female", "male", "other", "unknown"]),
  }),
]);

function classDisplayName(alias: "class" | "offering_class" | "from_class" | "to_class"): string {
  return `CASE
    WHEN lower(trim(coalesce(${alias}.section, ''))) NOT IN ('', 'none', '0', 'n/a', 'null')
      AND lower(replace(replace(trim(coalesce(nullif(${alias}.title, ''), ${alias}.name)), '''', ''), '"', ''))
        NOT LIKE '% ' || lower(trim(${alias}.section))
    THEN trim(coalesce(nullif(${alias}.title, ''), ${alias}.name)) || ' ' || trim(${alias}.section)
    ELSE trim(coalesce(nullif(${alias}.title, ''), ${alias}.name))
  END`;
}

type SignUpPayload = {
  user?: {
    id?: string;
  };
};

type MembershipContext = {
  memberId: string;
  organizationId: string;
  group: AccessGroupKey;
  permissions: PermissionKey[];
  userId: string;
};

type Invitation = {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  group: Exclude<AccessGroupKey, "owner">;
  roleNames: string[];
  expiresAt: string;
};

export const apiDispatcher = {
  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/auth/")) {
      return handleAuthRequest(request);
    }

    if (url.pathname === "/api/platform") {
      return handlePlatformRequest(request);
    }

    if (url.pathname === "/api/people") {
      return getPeopleRegistry(request);
    }

    if (url.pathname === "/api/school-operations/overview") {
      return getSchoolOperationsOverview(request);
    }

    if (url.pathname === "/api/school-operations/students") {
      return getSchoolOperationsStudents(request);
    }

    if (url.pathname === "/api/school-operations/student-report") {
      return getSchoolOperationsStudentReport(request);
    }

    if (url.pathname === "/api/school-operations/master-data") {
      return getSchoolMasterData(request);
    }

    const academicClassMatch = url.pathname.match(/^\/api\/school-operations\/classes\/([^/]+)$/);
    if (academicClassMatch) {
      return updateAcademicClassMaster(request, academicClassMatch[1]);
    }

    if (url.pathname === "/api/school-operations/classes") {
      return createAcademicClassMaster(request);
    }

    const houseMasterMatch = url.pathname.match(/^\/api\/school-operations\/houses\/([^/]+)$/);
    if (houseMasterMatch) {
      return updateHouseMaster(request, houseMasterMatch[1]);
    }

    if (url.pathname === "/api/school-operations/houses") {
      return createHouseMaster(request);
    }

    const schoolAssignmentsMatch = url.pathname.match(
      /^\/api\/school-operations\/schools\/([^/]+)\/assignments$/,
    );
    if (schoolAssignmentsMatch) {
      return handleSchoolAssignments(request, schoolAssignmentsMatch[1]);
    }

    const schoolMasterMatch = url.pathname.match(/^\/api\/school-operations\/schools\/([^/]+)$/);
    if (schoolMasterMatch) {
      return updateSchoolMaster(request, schoolMasterMatch[1]);
    }

    if (url.pathname === "/api/school-operations/schools") {
      return request.method === "POST"
        ? createSchoolMaster(request)
        : getSchoolOperationsSchools(request);
    }

    if (url.pathname === "/api/school-operations/rosters") {
      return getSchoolOperationsRosters(request);
    }

    if (url.pathname === "/api/school-operations/setup") {
      return getSchoolOperationsSetup(request);
    }

    if (url.pathname === "/api/school-operations/admissions") {
      return createStudentAdmission(request);
    }

    const enrollmentEndDetailsMatch = url.pathname.match(
      /^\/api\/school-operations\/enrollments\/([^/]+)\/end-details$/,
    );
    if (enrollmentEndDetailsMatch) {
      return correctEnrollmentEndDetails(request, enrollmentEndDetailsMatch[1]);
    }

    const enrollmentMatch = url.pathname.match(/^\/api\/school-operations\/enrollments\/([^/]+)$/);
    if (enrollmentMatch) {
      return handleStudentEnrollment(request, enrollmentMatch[1]);
    }

    if (url.pathname === "/api/school-operations/results/overview") {
      return getHistoricalResultsOverview(request);
    }

    if (url.pathname === "/api/school-operations/results/setup") {
      return handleAcademicResultSetup(request);
    }

    if (url.pathname === "/api/school-operations/academic-configuration") {
      return handleAcademicConfiguration(request);
    }

    if (url.pathname === "/api/school-operations/results/summaries") {
      return getAcademicResultSummaries(request);
    }

    if (url.pathname === "/api/school-operations/results/report-card") {
      return getAcademicReportCard(request);
    }

    const markSheetStatusMatch = url.pathname.match(
      /^\/api\/school-operations\/results\/([^/]+)\/status$/,
    );
    if (markSheetStatusMatch) return changeMarkSheetStatus(request, markSheetStatusMatch[1]);

    const markSheetMatch = url.pathname.match(/^\/api\/school-operations\/results\/([^/]+)$/);
    if (markSheetMatch) return handleMarkSheet(request, markSheetMatch[1]);

    if (url.pathname === "/api/school-operations/results") {
      return handleAcademicResults(request);
    }

    if (url.pathname === "/api/health/history") {
      return getHealthHistory(request);
    }

    if (url.pathname === "/api/scholarships/setup") {
      return handleScholarshipSetup(request);
    }

    if (url.pathname === "/api/scholarships/reports") {
      return getScholarshipReport(request);
    }

    const scholarshipMatch = url.pathname.match(/^\/api\/scholarships\/([^/]+)$/);
    if (scholarshipMatch) return handleScholarshipRecord(request, scholarshipMatch[1]);

    if (url.pathname === "/api/scholarships") {
      return handleScholarships(request);
    }

    if (url.pathname === "/api/sponsorship/setup") {
      return getSponsorshipSetup(request);
    }

    if (url.pathname === "/api/sponsorship/reports") {
      return getSponsorshipReport(request);
    }

    if (url.pathname === "/api/sponsorship") {
      return handleSponsorship(request);
    }

    if (url.pathname === "/api/health/tb") {
      return getTbHistory(request);
    }

    if (url.pathname === "/api/health/advances") {
      return getMedicalAdvances(request);
    }

    const siblingItemMatch = url.pathname.match(/^\/api\/people\/([^/]+)\/siblings\/([^/]+)$/);
    if (siblingItemMatch) {
      return removeSiblingRelationship(request, siblingItemMatch[1], siblingItemMatch[2]);
    }

    const siblingCollectionMatch = url.pathname.match(/^\/api\/people\/([^/]+)\/siblings$/);
    if (siblingCollectionMatch) {
      return addSiblingRelationship(request, siblingCollectionMatch[1]);
    }

    const siblingOptionsMatch = url.pathname.match(/^\/api\/people\/([^/]+)\/sibling-options$/);
    if (siblingOptionsMatch) {
      return getSiblingOptions(request, siblingOptionsMatch[1]);
    }

    const familyMatch = url.pathname.match(/^\/api\/people\/([^/]+)\/family$/);
    if (familyMatch) {
      return updatePersonFamily(request, familyMatch[1]);
    }

    const placementMatch = url.pathname.match(/^\/api\/people\/([^/]+)\/placements$/);
    if (placementMatch) {
      return addHomePlacement(request, placementMatch[1]);
    }

    const personFileItemMatch = url.pathname.match(/^\/api\/people\/([^/]+)\/files\/([^/]+)$/);
    if (personFileItemMatch) {
      return handlePersonFile(request, personFileItemMatch[1], personFileItemMatch[2]);
    }

    const personFilesMatch = url.pathname.match(/^\/api\/people\/([^/]+)\/files$/);
    if (personFilesMatch) {
      return addPersonFile(request, personFilesMatch[1]);
    }

    const personMatch = url.pathname.match(/^\/api\/people\/([^/]+)$/);
    if (personMatch) {
      return handlePersonProfile(request, personMatch[1]);
    }

    const fileMatch = url.pathname.match(/^\/api\/files\/([^/]+)$/);
    if (fileMatch) {
      return getPersonFile(request, fileMatch[1]);
    }

    if (url.pathname === "/api/invitations/preview") {
      return previewInvitation(request);
    }

    if (url.pathname === "/api/invitations/accept") {
      return acceptInvitationForCurrentUser(request);
    }

    if (url.pathname === "/api/organization") {
      return handleOrganizationRequest(request);
    }

    if (url.pathname === "/api/organization/invitations") {
      return createOrganizationInvitation(request);
    }

    const invitationResendMatch = url.pathname.match(
      /^\/api\/organization\/invitations\/([^/]+)\/resend$/,
    );
    if (invitationResendMatch) {
      return resendOrganizationInvitation(request, invitationResendMatch[1]);
    }

    const accessGroupMatch = url.pathname.match(/^\/api\/organization\/groups\/([^/]+)$/);
    if (accessGroupMatch) {
      return updateAccessGroup(request, accessGroupMatch[1]);
    }

    if (url.pathname === "/api/organization/transfer") {
      return transferOrganizationOwnership(request);
    }

    const memberMatch = url.pathname.match(/^\/api\/organization\/members\/([^/]+)$/);
    if (memberMatch) {
      return updateOrganizationMember(request, memberMatch[1]);
    }

    const invitationMatch = url.pathname.match(/^\/api\/organization\/invitations\/([^/]+)$/);
    if (invitationMatch) {
      return revokeOrganizationInvitation(request, invitationMatch[1]);
    }

    return new Response(null, { status: 404 });
  },
};

export function handleApiRequest({ request }: { request: Request }): Promise<Response> {
  return apiDispatcher.fetch(request);
}

async function handleAuthRequest(request: Request): Promise<Response> {
  const runtime = getRuntimeEnv();
  const url = new URL(request.url);
  const isEmailSignUp = url.pathname.endsWith("/sign-up/email");
  const signUpInput = isEmailSignUp ? await readSignUpInput(request.clone()) : null;
  const invitationToken = isEmailSignUp ? request.headers.get("x-tsewa-invitation") : null;
  const invitation = invitationToken
    ? await findInvitation(runtime.ORM, invitationToken, signUpInput?.email)
    : null;
  const userCount = isEmailSignUp
    ? await runtime.ORM.select({ count: count() })
        .from(user)
        .then((rows) => rows[0] ?? null)
    : null;
  const isFirstUser = isEmailSignUp && Number(userCount?.count ?? 0) === 0;
  const auth = createRequestAuth(request, isFirstUser || Boolean(invitation));
  const accountAuditAction = getAccountAuditAction(url.pathname);
  const actorSession = accountAuditAction
    ? await auth.api.getSession({ headers: request.headers })
    : null;
  const response = await auth.handler(request);

  if (isEmailSignUp && response.ok) {
    const payload = (await response.clone().json()) as SignUpPayload;
    const userId = payload.user?.id;

    if (userId && isFirstUser) {
      await bootstrapFirstOrganization(runtime.ORM, userId);
    } else if (userId && invitation) {
      await acceptInvitation(runtime.ORM, invitation, userId);
    }
  }

  if (response.ok && accountAuditAction && actorSession?.user.id) {
    await auditAccountAction(runtime.ORM, actorSession.user.id, accountAuditAction);
  }

  return response;
}

async function readSignUpInput(request: { json(): Promise<unknown> }) {
  try {
    const parsed = signUpInputSchema.safeParse(await request.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function createRequestAuth(request: Request, allowSignUp: boolean) {
  const runtime = getRuntimeEnv();
  return createAuth({
    database: runtime.DB,
    secret: runtime.BETTER_AUTH_SECRET,
    baseURL: new URL(request.url).origin,
    allowSignUp,
  });
}

function getAccountAuditAction(pathname: string): string | null {
  if (pathname.endsWith("/update-user")) return "account.profile_updated";
  if (pathname.endsWith("/change-email")) return "account.email_changed";
  if (pathname.endsWith("/change-password")) return "account.password_changed";
  return null;
}

async function auditAccountAction(
  database: Database,
  userId: string,
  action: string,
): Promise<void> {
  const membership = await database
    .select({ organizationId: organizationMember.organizationId })
    .from(organizationMember)
    .where(eq(organizationMember.userId, userId))
    .orderBy(asc(organizationMember.createdAt))
    .limit(1)
    .then((rows) => rows[0]);
  if (!membership) return;

  await database.insert(auditEvent).values({
    id: crypto.randomUUID(),
    organizationId: membership.organizationId,
    actorUserId: userId,
    action,
    entityType: "user",
    entityId: userId,
  });
}

function accessRoleId(organizationId: string, role: AccessRoleKey): string {
  return `${organizationId}:role:${role}`;
}

function accessGroupId(organizationId: string, group: AccessGroupKey): string {
  return `${organizationId}:group:${group}`;
}

async function ensureAccessControlSeeded(
  database: Database,
  organizationId: string,
): Promise<void> {
  for (const [key, name, category] of permissionCatalog) {
    await database.insert(accessPermission).values({ key, name, category }).onConflictDoNothing();
  }

  for (const role of roleCatalog) {
    const roleId = accessRoleId(organizationId, role.key);
    await database
      .insert(accessRole)
      .values({
        id: roleId,
        organizationId,
        key: role.key,
        name: role.name,
        description: role.description,
      })
      .onConflictDoNothing();
    for (const permission of rolePermissionDefaults[role.key]) {
      await database
        .insert(accessRolePermission)
        .values({ roleId, permissionKey: permission })
        .onConflictDoNothing();
    }
  }

  for (const group of groupCatalog) {
    const groupId = accessGroupId(organizationId, group.key);
    await database
      .insert(accessGroup)
      .values({
        id: groupId,
        organizationId,
        key: group.key,
        name: group.name,
        description: group.description,
      })
      .onConflictDoNothing();
    for (const roleKey of groupRoleDefaults[group.key]) {
      await database
        .insert(accessGroupRole)
        .values({ groupId, roleId: accessRoleId(organizationId, roleKey) })
        .onConflictDoNothing();
    }
  }
}

async function bootstrapFirstOrganization(database: Database, userId: string): Promise<void> {
  const organizationId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const auditId = crypto.randomUUID();

  const organizationRow = await database
    .insert(organization)
    .values({
      id: organizationId,
      name: "Tibetan Homes Foundation",
      slug: "tibetan-homes-foundation",
    })
    .onConflictDoNothing()
    .returning({ id: organization.id })
    .then(
      async (rows) =>
        rows[0] ??
        database
          .select({ id: organization.id })
          .from(organization)
          .where(eq(organization.slug, "tibetan-homes-foundation"))
          .limit(1)
          .then((existing) => existing[0]),
    );
  if (!organizationRow) throw new Error("The initial organization could not be created.");

  await database
    .insert(academicSession)
    .values({
      id: sessionId,
      organizationId: organizationRow.id,
      name: "2026–27",
      startsOn: "2026-04-01",
      endsOn: "2027-03-31",
      isActive: 1,
    })
    .onConflictDoNothing();
  await database.insert(auditEvent).values({
    id: auditId,
    organizationId: organizationRow.id,
    actorUserId: userId,
    action: "platform.bootstrap",
    entityType: "organization",
    entityId: organizationRow.id,
  });
  await ensureAccessControlSeeded(database, organizationRow.id);
  await database
    .insert(organizationMember)
    .values({
      id: memberId,
      organizationId: organizationRow.id,
      userId,
      role: "owner",
      groupId: accessGroupId(organizationRow.id, "owner"),
    })
    .onConflictDoNothing();
}

async function handlePlatformRequest(request: Request): Promise<Response> {
  if (request.method === "GET") {
    return getPlatformStatus(request);
  }

  if (request.method === "POST") {
    return savePlatformPreference(request);
  }

  return methodNotAllowed("GET, POST");
}

async function getSchoolOperationsOverview(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const url = new URL(request.url);
  const parsed = schoolOverviewQuerySchema.safeParse({
    sessionId: url.searchParams.get("sessionId"),
  });
  if (!parsed.success) {
    return Response.json({ error: "Select a valid academic session." }, { status: 400 });
  }

  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope) return forbidden();
  const runtime = getRuntimeEnv();
  const bindings = [scope.organizationId, scope.session.id];
  const [summary, schools, classes, houses] = await Promise.all([
    runtime.DATABASE.prepare(
      `SELECT COUNT(*) AS students,
              SUM(CASE WHEN person.status = 'active' THEN 1 ELSE 0 END) AS activeStudents,
              SUM(CASE WHEN person.status = 'inactive' THEN 1 ELSE 0 END) AS inactiveStudents,
              COUNT(DISTINCT enrollment.school_id) AS schools,
              COUNT(DISTINCT coalesce(enrollment.school_id, 'unmapped') || '|' ||
                ${classDisplayName("class")}) AS classes,
              COUNT(DISTINCT enrollment.house_id) AS houses,
              SUM(CASE WHEN enrollment.school_id IS NULL THEN 1 ELSE 0 END) AS unmappedSchools
       FROM student_enrollment enrollment
       JOIN person ON person.id = enrollment.person_id
         AND person.organization_id = enrollment.organization_id
       JOIN academic_class_master class ON class.id = enrollment.academic_class_id
         AND class.organization_id = enrollment.organization_id
       WHERE enrollment.organization_id = ? AND enrollment.academic_session_id = ?`,
    )
      .bind(...bindings)
      .first<{
        students: number;
        activeStudents: number;
        inactiveStudents: number;
        schools: number;
        classes: number;
        houses: number;
        unmappedSchools: number;
      }>(),
    runtime.DATABASE.prepare(
      `SELECT coalesce(school.id, 'unmapped') AS id,
              coalesce(school.name, 'School not set') AS name, COUNT(*) AS count
       FROM student_enrollment enrollment
       LEFT JOIN school_master school ON school.id = enrollment.school_id
         AND school.organization_id = enrollment.organization_id
       WHERE enrollment.organization_id = ? AND enrollment.academic_session_id = ?
       GROUP BY school.id, school.name
       ORDER BY count DESC, name COLLATE NOCASE`,
    )
      .bind(...bindings)
      .all<{ id: string; name: string; count: number }>(),
    runtime.DATABASE.prepare(
      `SELECT ${classDisplayName("class")} AS id,
              ${classDisplayName("class")} AS name,
              COUNT(*) AS count
       FROM student_enrollment enrollment
       JOIN academic_class_master class ON class.id = enrollment.academic_class_id
         AND class.organization_id = enrollment.organization_id
       WHERE enrollment.organization_id = ? AND enrollment.academic_session_id = ?
       GROUP BY ${classDisplayName("class")}
       ORDER BY coalesce(max(class.level), 999), name COLLATE NOCASE`,
    )
      .bind(...bindings)
      .all<{ id: string; name: string; count: number }>(),
    runtime.DATABASE.prepare(
      `SELECT coalesce(house.id, 'none') AS id,
              coalesce(house.name, 'No house') AS name, COUNT(*) AS count
       FROM student_enrollment enrollment
       LEFT JOIN house_master house ON house.id = enrollment.house_id
         AND house.organization_id = enrollment.organization_id
       WHERE enrollment.organization_id = ? AND enrollment.academic_session_id = ?
       GROUP BY house.id, house.name
       ORDER BY count DESC, name COLLATE NOCASE`,
    )
      .bind(...bindings)
      .all<{ id: string; name: string; count: number }>(),
  ]);

  return Response.json({
    session: scope.session,
    canEdit: hasPermission(scope, "school.enrollment.manage"),
    summary: {
      students: Number(summary?.students ?? 0),
      activeStudents: Number(summary?.activeStudents ?? 0),
      inactiveStudents: Number(summary?.inactiveStudents ?? 0),
      schools: Number(summary?.schools ?? 0),
      classes: Number(summary?.classes ?? 0),
      houses: Number(summary?.houses ?? 0),
      unmappedSchools: Number(summary?.unmappedSchools ?? 0),
    },
    filters: {
      schools: schools.results,
      classes: classes.results,
      houses: houses.results,
    },
  });
}

async function getSchoolOperationsSetup(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  const parsed = schoolOverviewQuerySchema.safeParse({ sessionId });
  if (!parsed.success) {
    return Response.json({ error: "Select an academic session." }, { status: 400 });
  }

  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope) return forbidden();
  const runtime = getRuntimeEnv();
  const [schools, classes, houses] = await Promise.all([
    runtime.DATABASE.prepare(
      `SELECT id, name FROM school_master
       WHERE organization_id = ? AND is_active = 1 ORDER BY name COLLATE NOCASE`,
    )
      .bind(scope.organizationId)
      .all<{ id: string; name: string }>(),
    runtime.DATABASE.prepare(
      `SELECT class.id, ${classDisplayName("class")} AS name, offering.school_id AS schoolId
       FROM school_class_offering offering
       JOIN academic_class_master class ON class.id = offering.academic_class_id
         AND class.organization_id = offering.organization_id
       WHERE offering.organization_id = ? AND offering.academic_session_id = ?
         AND offering.is_active = 1 AND class.is_active = 1
       ORDER BY offering.school_id, coalesce(class.sort_order, 999),
                coalesce(class.level, 999), name COLLATE NOCASE`,
    )
      .bind(scope.organizationId, scope.session.id)
      .all<{ id: string; name: string; schoolId: string }>(),
    runtime.DATABASE.prepare(
      `SELECT house.id, house.name, school_house.school_id AS schoolId
       FROM school_house_master school_house
       JOIN house_master house ON house.id = school_house.house_id
         AND house.organization_id = school_house.organization_id
       WHERE school_house.organization_id = ? AND house.is_active = 1
       ORDER BY school_house.school_id, house.name COLLATE NOCASE`,
    )
      .bind(scope.organizationId)
      .all<{ id: string; name: string; schoolId: string }>(),
  ]);

  return Response.json({
    canEdit: hasPermission(scope, "school.enrollment.manage"),
    session: scope.session,
    schools: schools.results,
    classes: classes.results,
    houses: houses.results,
  });
}

async function createStudentAdmission(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return forbidden();

  const parsed = admissionSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Check the student details and try again." }, { status: 400 });
  }

  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope) return forbidden();
  if (!hasPermission(scope, "school.enrollment.manage")) return forbidden();

  const runtime = getRuntimeEnv();
  const { academicClassId, admissionNumber, admittedOn, displayName, houseId, schoolId } =
    parsed.data;
  const [school, offering, house, existingPerson] = await Promise.all([
    runtime.DATABASE.prepare(
      `SELECT id FROM school_master WHERE id = ? AND organization_id = ? AND is_active = 1`,
    )
      .bind(schoolId, scope.organizationId)
      .first<{ id: string }>(),
    runtime.DATABASE.prepare(
      `SELECT offering.id FROM school_class_offering offering
       JOIN academic_class_master class ON class.id = offering.academic_class_id
         AND class.organization_id = offering.organization_id
       WHERE offering.organization_id = ? AND offering.academic_session_id = ?
         AND offering.school_id = ? AND offering.academic_class_id = ?
         AND offering.is_active = 1 AND class.is_active = 1`,
    )
      .bind(scope.organizationId, scope.session.id, schoolId, academicClassId)
      .first<{ id: string }>(),
    houseId
      ? runtime.DATABASE.prepare(
          `SELECT house.id FROM school_house_master school_house
           JOIN house_master house ON house.id = school_house.house_id
             AND house.organization_id = school_house.organization_id
           WHERE school_house.organization_id = ? AND school_house.school_id = ?
             AND house.id = ? AND house.is_active = 1`,
        )
          .bind(scope.organizationId, schoolId, houseId)
          .first<{ id: string }>()
      : Promise.resolve(null),
    runtime.DATABASE.prepare(
      `SELECT id FROM person
       WHERE organization_id = ? AND identifier_kind = 'admission'
         AND lower(primary_identifier) = lower(?)`,
    )
      .bind(scope.organizationId, admissionNumber)
      .first<{ id: string }>(),
  ]);

  if (!school) return Response.json({ error: "Choose an active school." }, { status: 400 });
  if (!offering)
    return Response.json({ error: "Choose a class assigned to this school." }, { status: 400 });
  if (houseId && !house)
    return Response.json({ error: "Choose a house assigned to this school." }, { status: 400 });
  if (existingPerson) {
    return Response.json({ error: "That admission number is already in use." }, { status: 409 });
  }

  const personId = crypto.randomUUID();
  const enrollmentId = crypto.randomUUID();
  const changeId = crypto.randomUUID();
  await runtime.DATABASE.batch([
    runtime.DATABASE.prepare(
      `INSERT INTO person
        (id, organization_id, kind, status, identifier_kind, primary_identifier,
         display_name, gender, date_of_birth, admitted_or_joined_on, campus_or_location,
         source_system, source_table, source_id, created_by_user_id, updated_by_user_id)
       VALUES (?, ?, 'child', 'active', 'admission', ?, ?, ?, ?, ?,
         (SELECT name FROM school_master WHERE id = ?), 'tsewa', 'person', ?, ?, ?)`,
    ).bind(
      personId,
      scope.organizationId,
      admissionNumber,
      displayName,
      parsed.data.gender ?? "unknown",
      parsed.data.dateOfBirth ?? null,
      admittedOn,
      schoolId,
      personId,
      scope.userId,
      scope.userId,
    ),
    runtime.DATABASE.prepare(
      `INSERT INTO student_enrollment
        (id, organization_id, person_id, academic_session_id, school_id,
         academic_class_id, house_id, school_class_offering_id, status, status_source,
         started_on, roll_number, source_system, source_table, source_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'enrolled', 'explicit', ?, ?,
         'tsewa', 'student_enrollment', ?)`,
    ).bind(
      enrollmentId,
      scope.organizationId,
      personId,
      scope.session.id,
      schoolId,
      academicClassId,
      houseId ?? null,
      offering.id,
      admittedOn,
      parsed.data.rollNumber || null,
      enrollmentId,
    ),
    runtime.DATABASE.prepare(
      `INSERT INTO student_enrollment_change
        (id, organization_id, enrollment_id, person_id, academic_session_id,
         change_type, effective_on, to_school_id, to_academic_class_id, to_house_id,
         to_status, to_roll_number, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, 'admitted', ?, ?, ?, ?, 'enrolled', ?, ?)`,
    ).bind(
      changeId,
      scope.organizationId,
      enrollmentId,
      personId,
      scope.session.id,
      admittedOn,
      schoolId,
      academicClassId,
      houseId ?? null,
      parsed.data.rollNumber || null,
      scope.userId,
    ),
    auditStatement(runtime.DATABASE, scope, "student.admitted", "person", personId, {
      admissionNumber,
      academicSessionId: scope.session.id,
      schoolId,
      academicClassId,
    }),
  ]);

  return Response.json({ personId, enrollmentId, displayName }, { status: 201 });
}

async function handleStudentEnrollment(request: Request, enrollmentId: string): Promise<Response> {
  const parsedId = enrollmentIdSchema.safeParse(enrollmentId);
  if (!parsedId.success) {
    return Response.json({ error: "Invalid enrollment." }, { status: 400 });
  }
  if (request.method === "GET") return getStudentEnrollment(request, parsedId.data);
  if (request.method === "PATCH") return changeStudentEnrollment(request, parsedId.data);
  return methodNotAllowed("GET, PATCH");
}

async function getStudentEnrollment(request: Request, enrollmentId: string): Promise<Response> {
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  const runtime = getRuntimeEnv();
  const enrollment = await readStudentEnrollment(
    runtime.DATABASE,
    context.organizationId,
    enrollmentId,
  );
  if (!enrollment) return Response.json({ error: "Enrollment not found." }, { status: 404 });

  const [schools, classes, houses, changes] = await Promise.all([
    runtime.DATABASE.prepare(
      `SELECT id, name FROM school_master
       WHERE organization_id = ? AND is_active = 1 ORDER BY name COLLATE NOCASE`,
    )
      .bind(context.organizationId)
      .all<{ id: string; name: string }>(),
    runtime.DATABASE.prepare(
      `SELECT class.id, ${classDisplayName("class")} AS name, offering.school_id AS schoolId
       FROM school_class_offering offering
       JOIN academic_class_master class ON class.id = offering.academic_class_id
         AND class.organization_id = offering.organization_id
       WHERE offering.organization_id = ? AND offering.academic_session_id = ?
         AND offering.is_active = 1 AND class.is_active = 1
       ORDER BY offering.school_id, coalesce(class.sort_order, 999),
                coalesce(class.level, 999), name COLLATE NOCASE`,
    )
      .bind(context.organizationId, enrollment.academicSessionId)
      .all<{ id: string; name: string; schoolId: string }>(),
    runtime.DATABASE.prepare(
      `SELECT house.id, house.name, school_house.school_id AS schoolId
       FROM school_house_master school_house
       JOIN house_master house ON house.id = school_house.house_id
         AND house.organization_id = school_house.organization_id
       WHERE school_house.organization_id = ? AND house.is_active = 1
       ORDER BY school_house.school_id, house.name COLLATE NOCASE`,
    )
      .bind(context.organizationId)
      .all<{ id: string; name: string; schoolId: string }>(),
    runtime.DATABASE.prepare(
      `SELECT change.id, change.change_type AS changeType,
              change.effective_on AS effectiveOn, change.from_status AS fromStatus,
              change.to_status AS toStatus, change.note, change.created_at AS createdAt,
              from_school.name AS fromSchoolName, to_school.name AS toSchoolName,
              ${classDisplayName("from_class")} AS fromClassName,
              ${classDisplayName("to_class")} AS toClassName,
              from_house.name AS fromHouseName, to_house.name AS toHouseName,
              change.from_roll_number AS fromRollNumber,
              change.to_roll_number AS toRollNumber,
              actor.name AS changedBy
       FROM student_enrollment_change change
       LEFT JOIN school_master from_school ON from_school.id = change.from_school_id
       LEFT JOIN school_master to_school ON to_school.id = change.to_school_id
       LEFT JOIN academic_class_master from_class
         ON from_class.id = change.from_academic_class_id
       LEFT JOIN academic_class_master to_class ON to_class.id = change.to_academic_class_id
       LEFT JOIN house_master from_house ON from_house.id = change.from_house_id
       LEFT JOIN house_master to_house ON to_house.id = change.to_house_id
       LEFT JOIN "user" actor ON actor.id = change.created_by_user_id
       WHERE change.organization_id = ? AND change.enrollment_id = ?
       ORDER BY change.effective_on DESC, change.created_at DESC`,
    )
      .bind(context.organizationId, enrollmentId)
      .all(),
  ]);

  const classOptions = [...classes.results];
  if (!classOptions.some((item) => item.id === enrollment.academicClassId)) {
    classOptions.push({
      id: enrollment.academicClassId,
      name: enrollment.className,
      schoolId: enrollment.schoolId ?? "",
    });
  }
  const houseOptions = [...houses.results];
  if (
    enrollment.houseId &&
    enrollment.houseName &&
    !houseOptions.some((item) => item.id === enrollment.houseId)
  ) {
    houseOptions.push({
      id: enrollment.houseId,
      name: enrollment.houseName,
      schoolId: enrollment.schoolId ?? "",
    });
  }

  return Response.json({
    enrollment: {
      ...enrollment,
      canEdit:
        hasPermission(context, "school.enrollment.manage") && isOpenEnrollment(enrollment.status),
    },
    options: {
      schools: schools.results,
      classes: classOptions,
      houses: houseOptions,
    },
    changes: changes.results,
  });
}

async function changeStudentEnrollment(request: Request, enrollmentId: string): Promise<Response> {
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "school.enrollment.manage")) return forbidden();

  const parsed = enrollmentChangeSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Check the enrollment change and try again." }, { status: 400 });
  }

  const runtime = getRuntimeEnv();
  const enrollment = await readStudentEnrollment(
    runtime.DATABASE,
    context.organizationId,
    enrollmentId,
  );
  if (!enrollment) return Response.json({ error: "Enrollment not found." }, { status: 404 });
  if (!isOpenEnrollment(enrollment.status)) {
    return Response.json({ error: "This enrollment has already ended." }, { status: 409 });
  }
  if (
    parsed.data.effectiveOn < enrollment.sessionStartsOn ||
    parsed.data.effectiveOn > enrollment.sessionEndsOn
  ) {
    return Response.json(
      { error: `Choose a date within the ${enrollment.sessionName} session.` },
      { status: 400 },
    );
  }

  const action = parsed.data.action;
  const keepsStudentEnrolled = action === "placement_changed" || action === "internal_transfer";
  const targetSchoolId = keepsStudentEnrolled
    ? action === "placement_changed"
      ? enrollment.schoolId
      : parsed.data.schoolId
    : enrollment.schoolId;
  const targetClassId = keepsStudentEnrolled
    ? (parsed.data.academicClassId ?? enrollment.academicClassId)
    : enrollment.academicClassId;
  const targetHouseId = keepsStudentEnrolled
    ? parsed.data.houseId === undefined
      ? enrollment.houseId
      : parsed.data.houseId
    : enrollment.houseId;

  if (keepsStudentEnrolled && (!targetSchoolId || !targetClassId)) {
    return Response.json({ error: "Choose a school and class." }, { status: 400 });
  }
  if (action === "internal_transfer" && targetSchoolId === enrollment.schoolId) {
    return Response.json({ error: "Choose a different school for a transfer." }, { status: 400 });
  }

  let offeringId = enrollment.schoolClassOfferingId;
  if (keepsStudentEnrolled && targetSchoolId && targetClassId) {
    const [school, offering, house] = await Promise.all([
      runtime.DATABASE.prepare(
        `SELECT id FROM school_master WHERE id = ? AND organization_id = ? AND is_active = 1`,
      )
        .bind(targetSchoolId, context.organizationId)
        .first<{ id: string }>(),
      runtime.DATABASE.prepare(
        `SELECT offering.id FROM school_class_offering offering
         JOIN academic_class_master class ON class.id = offering.academic_class_id
           AND class.organization_id = offering.organization_id
         WHERE offering.organization_id = ? AND offering.academic_session_id = ?
           AND offering.school_id = ? AND offering.academic_class_id = ?
           AND offering.is_active = 1 AND class.is_active = 1`,
      )
        .bind(context.organizationId, enrollment.academicSessionId, targetSchoolId, targetClassId)
        .first<{ id: string }>(),
      targetHouseId
        ? runtime.DATABASE.prepare(
            `SELECT house.id FROM school_house_master school_house
             JOIN house_master house ON house.id = school_house.house_id
               AND house.organization_id = school_house.organization_id
             WHERE school_house.organization_id = ? AND school_house.school_id = ?
               AND house.id = ? AND house.is_active = 1`,
          )
            .bind(context.organizationId, targetSchoolId, targetHouseId)
            .first<{ id: string }>()
        : Promise.resolve(null),
    ]);
    if (!school) return Response.json({ error: "Choose an active school." }, { status: 400 });
    if (!offering)
      return Response.json({ error: "Choose a class assigned to this school." }, { status: 400 });
    if (targetHouseId && !house)
      return Response.json({ error: "Choose a house assigned to this school." }, { status: 400 });
    offeringId = offering.id;
  }

  const nextStatus =
    action === "transferred_out"
      ? "transferred"
      : action === "withdrawn"
        ? "withdrawn"
        : action === "completed"
          ? "completed"
          : "enrolled";
  const changeType =
    action === "internal_transfer" || action === "transferred_out" ? "transferred" : action;
  const changeId = crypto.randomUUID();
  const statements = [
    runtime.DATABASE.prepare(
      `UPDATE student_enrollment SET school_id = ?, academic_class_id = ?, house_id = ?,
         school_class_offering_id = ?, status = ?, status_source = 'explicit',
         ended_on = ?, roll_number = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ? AND status IN ('recorded', 'enrolled')`,
    ).bind(
      targetSchoolId,
      targetClassId,
      targetHouseId,
      offeringId,
      nextStatus,
      keepsStudentEnrolled ? null : parsed.data.effectiveOn,
      keepsStudentEnrolled
        ? parsed.data.rollNumber === undefined
          ? enrollment.rollNumber
          : parsed.data.rollNumber
        : enrollment.rollNumber,
      enrollmentId,
      context.organizationId,
    ),
    runtime.DATABASE.prepare(
      `INSERT INTO student_enrollment_change
        (id, organization_id, enrollment_id, person_id, academic_session_id, change_type,
         effective_on, from_school_id, to_school_id, from_academic_class_id,
         to_academic_class_id, from_house_id, to_house_id, from_status, to_status,
         from_roll_number, to_roll_number, note, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      changeId,
      context.organizationId,
      enrollmentId,
      enrollment.personId,
      enrollment.academicSessionId,
      changeType,
      parsed.data.effectiveOn,
      enrollment.schoolId,
      targetSchoolId,
      enrollment.academicClassId,
      targetClassId,
      enrollment.houseId,
      targetHouseId,
      enrollment.status,
      nextStatus,
      enrollment.rollNumber,
      keepsStudentEnrolled
        ? parsed.data.rollNumber === undefined
          ? enrollment.rollNumber
          : parsed.data.rollNumber
        : enrollment.rollNumber,
      parsed.data.note || null,
      context.userId,
    ),
  ];

  if (!keepsStudentEnrolled && enrollment.academicSessionId === enrollment.latestSessionId) {
    statements.push(
      runtime.DATABASE.prepare(
        `UPDATE person SET status = 'inactive', updated_by_user_id = ?,
           updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
      ).bind(context.userId, enrollment.personId, context.organizationId),
    );
  }
  statements.push(
    auditStatement(
      runtime.DATABASE,
      context,
      `student.${changeType}`,
      "student_enrollment",
      enrollmentId,
      {
        personId: enrollment.personId,
        effectiveOn: parsed.data.effectiveOn,
        fromStatus: enrollment.status,
        toStatus: nextStatus,
      },
    ),
  );
  await runtime.DATABASE.batch(statements);

  return Response.json({ ok: true, status: nextStatus, changeId });
}

async function correctEnrollmentEndDetails(
  request: Request,
  enrollmentId: string,
): Promise<Response> {
  if (request.method !== "PATCH") return methodNotAllowed("PATCH");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "school.enrollment.manage")) return forbidden();

  const parsedId = enrollmentIdSchema.safeParse(enrollmentId);
  if (!parsedId.success) {
    return Response.json({ error: "Invalid enrollment ID." }, { status: 400 });
  }
  const parsed = enrollmentEndDetailsSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Enter an end date and reason." }, { status: 400 });
  }

  const runtime = getRuntimeEnv();
  const enrollment = await readStudentEnrollment(
    runtime.DATABASE,
    context.organizationId,
    parsedId.data,
  );
  if (!enrollment) return Response.json({ error: "Enrollment not found." }, { status: 404 });
  if (
    enrollment.status !== "withdrawn" &&
    enrollment.status !== "completed" &&
    enrollment.status !== "graduated"
  ) {
    return Response.json(
      { error: "Only a withdrawal or completion record can be corrected here." },
      { status: 409 },
    );
  }
  if (
    parsed.data.effectiveOn < enrollment.sessionStartsOn ||
    parsed.data.effectiveOn > enrollment.sessionEndsOn
  ) {
    return Response.json(
      { error: `Choose a date within the ${enrollment.sessionName} session.` },
      { status: 400 },
    );
  }

  const changeType = enrollment.status === "withdrawn" ? "withdrawn" : "completed";
  const existingChange = await runtime.DATABASE.prepare(
    `SELECT id, effective_on AS effectiveOn, note
     FROM student_enrollment_change
     WHERE organization_id = ? AND enrollment_id = ? AND change_type = ?
     ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(context.organizationId, parsedId.data, changeType)
    .first<{ id: string; effectiveOn: string; note: string | null }>();

  const statements = [
    runtime.DATABASE.prepare(
      `UPDATE student_enrollment SET ended_on = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
    ).bind(parsed.data.effectiveOn, parsedId.data, context.organizationId),
  ];

  if (existingChange) {
    statements.push(
      runtime.DATABASE.prepare(
        `UPDATE student_enrollment_change
         SET effective_on = ?, note = ?
         WHERE id = ? AND organization_id = ?`,
      ).bind(
        parsed.data.effectiveOn,
        parsed.data.reason,
        existingChange.id,
        context.organizationId,
      ),
    );
  } else {
    statements.push(
      runtime.DATABASE.prepare(
        `INSERT INTO student_enrollment_change
          (id, organization_id, enrollment_id, person_id, academic_session_id, change_type,
           effective_on, from_school_id, to_school_id, from_academic_class_id,
           to_academic_class_id, from_house_id, to_house_id, from_status, to_status,
           from_roll_number, to_roll_number, note, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        context.organizationId,
        parsedId.data,
        enrollment.personId,
        enrollment.academicSessionId,
        changeType,
        parsed.data.effectiveOn,
        enrollment.schoolId,
        enrollment.schoolId,
        enrollment.academicClassId,
        enrollment.academicClassId,
        enrollment.houseId,
        enrollment.houseId,
        "enrolled",
        enrollment.status,
        enrollment.rollNumber,
        enrollment.rollNumber,
        parsed.data.reason,
        context.userId,
      ),
    );
  }

  statements.push(
    auditStatement(
      runtime.DATABASE,
      context,
      "student.end_details_corrected",
      "student_enrollment",
      parsedId.data,
      {
        personId: enrollment.personId,
        status: enrollment.status,
        previousEffectiveOn: existingChange?.effectiveOn ?? enrollment.endedOn ?? "",
        previousReason: existingChange?.note ?? "",
        effectiveOn: parsed.data.effectiveOn,
        reason: parsed.data.reason,
      },
    ),
  );
  await runtime.DATABASE.batch(statements);

  return Response.json({ ok: true });
}

function isOpenEnrollment(status: StudentEnrollmentRecord["status"]): boolean {
  return status === "recorded" || status === "enrolled";
}

type StudentEnrollmentRecord = {
  id: string;
  personId: string;
  displayName: string;
  admissionNumber: string;
  academicSessionId: string;
  sessionName: string;
  sessionStartsOn: string;
  sessionEndsOn: string;
  latestSessionId: string;
  schoolId: string | null;
  schoolName: string | null;
  academicClassId: string;
  className: string;
  houseId: string | null;
  houseName: string | null;
  schoolClassOfferingId: string | null;
  rollNumber: string | null;
  status: "recorded" | "enrolled" | "transferred" | "withdrawn" | "completed" | "graduated";
  statusSource: "legacy_allocation" | "explicit";
  startedOn: string | null;
  endedOn: string | null;
};

async function readStudentEnrollment(
  database: QueryDatabase,
  organizationId: string,
  enrollmentId: string,
): Promise<StudentEnrollmentRecord | null> {
  return database
    .prepare(
      `SELECT enrollment.id, enrollment.person_id AS personId,
              person.display_name AS displayName,
              person.primary_identifier AS admissionNumber,
              enrollment.academic_session_id AS academicSessionId,
              session.name AS sessionName, session.starts_on AS sessionStartsOn,
              session.ends_on AS sessionEndsOn,
              (SELECT latest.id FROM academic_session latest
               WHERE latest.organization_id = enrollment.organization_id AND latest.is_active = 1
               ORDER BY latest.starts_on DESC LIMIT 1) AS latestSessionId,
              enrollment.school_id AS schoolId, school.name AS schoolName,
              enrollment.academic_class_id AS academicClassId,
              ${classDisplayName("class")} AS className,
              enrollment.house_id AS houseId, house.name AS houseName,
              enrollment.school_class_offering_id AS schoolClassOfferingId,
              enrollment.roll_number AS rollNumber, enrollment.status,
              enrollment.status_source AS statusSource, enrollment.started_on AS startedOn,
              enrollment.ended_on AS endedOn
       FROM student_enrollment enrollment
       JOIN person ON person.id = enrollment.person_id
         AND person.organization_id = enrollment.organization_id
       JOIN academic_session session ON session.id = enrollment.academic_session_id
         AND session.organization_id = enrollment.organization_id
       JOIN academic_class_master class ON class.id = enrollment.academic_class_id
         AND class.organization_id = enrollment.organization_id
       LEFT JOIN school_master school ON school.id = enrollment.school_id
       LEFT JOIN house_master house ON house.id = enrollment.house_id
       WHERE enrollment.id = ? AND enrollment.organization_id = ?`,
    )
    .bind(enrollmentId, organizationId)
    .first<StudentEnrollmentRecord>();
}

type SchoolStudentFilters = z.infer<typeof schoolStudentFiltersSchema>;

type SchoolStudentRow = {
  personId: string;
  enrollmentId: string;
  displayName: string;
  primaryIdentifier: string;
  status: "active" | "inactive";
  gender: "female" | "male" | "other" | "unknown" | null;
  schoolName: string | null;
  className: string;
  classSection: string | null;
  classTitle: string | null;
  houseName: string | null;
  rollNumber: string | null;
  boardRegistrationNumber: string | null;
  result: string | null;
  enrollmentStatus: StudentEnrollmentRecord["status"];
  statusSource: StudentEnrollmentRecord["statusSource"];
};

function buildSchoolStudentFilters(
  scope: { organizationId: string; session: { id: string } },
  filters: SchoolStudentFilters,
) {
  const conditions = [
    "enrollment.organization_id = ?",
    "enrollment.academic_session_id = ?",
    "person.organization_id = ?",
  ];
  const bindings: Array<string | number> = [
    scope.organizationId,
    scope.session.id,
    scope.organizationId,
  ];
  if (filters.q) {
    const search = `%${escapeLikePattern(filters.q.toLowerCase())}%`;
    conditions.push(
      `(lower(person.display_name) LIKE ? ESCAPE '\\' OR lower(person.primary_identifier) LIKE ? ESCAPE '\\' OR lower(coalesce(enrollment.roll_number, '')) LIKE ? ESCAPE '\\')`,
    );
    bindings.push(search, search, search);
  }
  if (filters.school !== "all") {
    if (filters.school === "unmapped") {
      conditions.push("enrollment.school_id IS NULL");
    } else {
      conditions.push("school.id = ?");
      bindings.push(filters.school);
    }
  }
  if (filters.className !== "all") {
    conditions.push(`${classDisplayName("class")} = ?`);
    bindings.push(filters.className);
  }
  if (filters.house !== "all") {
    if (filters.house === "none") {
      conditions.push("enrollment.house_id IS NULL");
    } else {
      conditions.push("house.id = ?");
      bindings.push(filters.house);
    }
  }
  if (filters.status !== "all") {
    if (filters.status === "completed") {
      conditions.push("enrollment.status IN ('completed', 'graduated')");
    } else {
      conditions.push("enrollment.status = ?");
      bindings.push(filters.status);
    }
  }
  return { bindings, where: conditions.join(" AND ") };
}

const schoolStudentFromSql = `FROM student_enrollment enrollment
       JOIN person ON person.id = enrollment.person_id
         AND person.organization_id = enrollment.organization_id
       JOIN academic_class_master class ON class.id = enrollment.academic_class_id
         AND class.organization_id = enrollment.organization_id
       LEFT JOIN school_master school ON school.id = enrollment.school_id
         AND school.organization_id = enrollment.organization_id
       LEFT JOIN house_master house ON house.id = enrollment.house_id
         AND house.organization_id = enrollment.organization_id`;

const schoolStudentSelectSql = `SELECT person.id AS personId, enrollment.id AS enrollmentId,
              person.display_name AS displayName,
              person.primary_identifier AS primaryIdentifier, person.status, person.gender,
              school.name AS schoolName, class.name AS className,
              class.section AS classSection, ${classDisplayName("class")} AS classTitle,
              house.name AS houseName, enrollment.roll_number AS rollNumber,
              enrollment.board_registration_number AS boardRegistrationNumber,
              enrollment.result, enrollment.status AS enrollmentStatus,
              enrollment.status_source AS statusSource`;

async function getSchoolOperationsStudents(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const url = new URL(request.url);
  const parsed = schoolStudentsQuerySchema.safeParse({
    sessionId: url.searchParams.get("sessionId"),
    q: url.searchParams.get("q") ?? "",
    school: url.searchParams.get("school") ?? "all",
    className: url.searchParams.get("class") ?? "all",
    house: url.searchParams.get("house") ?? "all",
    status: url.searchParams.get("status") ?? "all",
    page: url.searchParams.get("page") ?? "1",
    pageSize: url.searchParams.get("pageSize") ?? "25",
  });
  if (!parsed.success) {
    return Response.json({ error: "Check the filters and try again." }, { status: 400 });
  }

  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope) return forbidden();
  const { page, pageSize } = parsed.data;
  const { bindings: filterBindings, where } = buildSchoolStudentFilters(scope, parsed.data);
  const runtime = getRuntimeEnv();
  const offset = (page - 1) * pageSize;
  const [count, students] = await Promise.all([
    runtime.DATABASE.prepare(`SELECT COUNT(*) AS total ${schoolStudentFromSql} WHERE ${where}`)
      .bind(...filterBindings)
      .first<{ total: number }>(),
    runtime.DATABASE.prepare(
      `${schoolStudentSelectSql} ${schoolStudentFromSql} WHERE ${where}
       ORDER BY person.display_name COLLATE NOCASE, person.primary_identifier
       LIMIT ? OFFSET ?`,
    )
      .bind(...filterBindings, pageSize, offset)
      .all<SchoolStudentRow>(),
  ]);
  const total = Number(count?.total ?? 0);
  return Response.json({
    students: students.results.map((student) => ({
      ...student,
      canEdit:
        hasPermission(scope, "school.enrollment.manage") &&
        isOpenEnrollment(student.enrollmentStatus),
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

const MAX_STUDENT_REPORT_ROWS = 5_000;

async function getSchoolOperationsStudentReport(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const url = new URL(request.url);
  const parsed = schoolStudentReportQuerySchema.safeParse({
    sessionId: url.searchParams.get("sessionId"),
    q: url.searchParams.get("q") ?? "",
    school: url.searchParams.get("school") ?? "all",
    className: url.searchParams.get("class") ?? "all",
    house: url.searchParams.get("house") ?? "all",
    status: url.searchParams.get("status") ?? "all",
  });
  if (!parsed.success) {
    return Response.json({ error: "Check the report filters and try again." }, { status: 400 });
  }

  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope) return forbidden();
  const { bindings, where } = buildSchoolStudentFilters(scope, parsed.data);
  const runtime = getRuntimeEnv();
  const [count, organization] = await Promise.all([
    runtime.DATABASE.prepare(`SELECT COUNT(*) AS total ${schoolStudentFromSql} WHERE ${where}`)
      .bind(...bindings)
      .first<{ total: number }>(),
    runtime.DATABASE.prepare("SELECT name FROM organization WHERE id = ?")
      .bind(scope.organizationId)
      .first<{ name: string }>(),
  ]);
  const total = Number(count?.total ?? 0);
  if (total > MAX_STUDENT_REPORT_ROWS) {
    return Response.json(
      {
        error: `This list has ${total.toLocaleString()} students. Narrow the filters to ${MAX_STUDENT_REPORT_ROWS.toLocaleString()} or fewer before printing or downloading.`,
      },
      { status: 422 },
    );
  }

  const students = await runtime.DATABASE.prepare(
    `${schoolStudentSelectSql} ${schoolStudentFromSql} WHERE ${where}
     ORDER BY school.name COLLATE NOCASE, coalesce(class.sort_order, 999),
              classTitle COLLATE NOCASE, person.display_name COLLATE NOCASE,
              person.primary_identifier
     LIMIT ?`,
  )
    .bind(...bindings, MAX_STUDENT_REPORT_ROWS)
    .all<SchoolStudentRow>();

  return Response.json({
    generatedAt: new Date().toISOString(),
    organizationName: organization?.name ?? "School",
    session: scope.session,
    students: students.results,
    total,
  });
}

async function getSchoolOperationsSchools(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const url = new URL(request.url);
  const parsed = schoolOverviewQuerySchema.safeParse({
    sessionId: url.searchParams.get("sessionId"),
  });
  if (!parsed.success) {
    return Response.json({ error: "Select a valid academic session." }, { status: 400 });
  }

  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope) return forbidden();
  const runtime = getRuntimeEnv();
  const schools = await runtime.DATABASE.prepare(
    `WITH session_enrollments AS (
       SELECT * FROM student_enrollment
       WHERE organization_id = ? AND academic_session_id = ?
     ), session_offerings AS (
       SELECT * FROM school_class_offering
       WHERE organization_id = ? AND academic_session_id = ? AND is_active = 1
     )
     SELECT school.id, school.name, school.location_name AS locationName,
            school.affiliation_number AS affiliationNumber,
            school.is_active AS isActive,
            COUNT(DISTINCT enrollment.id) AS students,
            COUNT(DISTINCT CASE WHEN person.status = 'active' THEN enrollment.person_id END)
              AS currentActiveStudents,
            COUNT(DISTINCT ${classDisplayName("offering_class")}) AS classes,
            COUNT(DISTINCT school_house.house_id) AS houses
     FROM school_master school
     LEFT JOIN session_enrollments enrollment ON enrollment.school_id = school.id
     LEFT JOIN person ON person.id = enrollment.person_id
       AND person.organization_id = enrollment.organization_id
     LEFT JOIN session_offerings offering ON offering.school_id = school.id
     LEFT JOIN academic_class_master offering_class
       ON offering_class.id = offering.academic_class_id
      AND offering_class.organization_id = school.organization_id
     LEFT JOIN school_house_master school_house ON school_house.school_id = school.id
       AND school_house.organization_id = school.organization_id
     WHERE school.organization_id = ?
     GROUP BY school.id
     ORDER BY school.is_active DESC, school.name COLLATE NOCASE`,
  )
    .bind(
      scope.organizationId,
      scope.session.id,
      scope.organizationId,
      scope.session.id,
      scope.organizationId,
    )
    .all<{
      id: string;
      name: string;
      locationName: string | null;
      affiliationNumber: string | null;
      isActive: number;
      students: number;
      currentActiveStudents: number;
      classes: number;
      houses: number;
    }>();

  return Response.json({
    session: scope.session,
    schools: schools.results.map((school) => ({ ...school, isActive: Boolean(school.isActive) })),
  });
}

type AcademicClassRow = {
  id: string;
  name: string;
  title: string | null;
  section: string | null;
  level: number | null;
  sortOrder: number | null;
  isActive: number;
};

async function getSchoolMasterData(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  const parsed = schoolOverviewQuerySchema.safeParse({ sessionId });
  if (!parsed.success) {
    return Response.json({ error: "Select an academic session." }, { status: 400 });
  }
  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope) return forbidden();
  const runtime = getRuntimeEnv();
  const [classRows, houses] = await Promise.all([
    runtime.DATABASE.prepare(
      `SELECT id, name, title, section, level, sort_order AS sortOrder, is_active AS isActive
       FROM academic_class_master WHERE organization_id = ?
       ORDER BY coalesce(sort_order, 999), coalesce(level, 999), name COLLATE NOCASE`,
    )
      .bind(scope.organizationId)
      .all<AcademicClassRow>(),
    runtime.DATABASE.prepare(
      `SELECT id, name, is_active AS isActive
       FROM house_master WHERE organization_id = ?
       ORDER BY is_active DESC, name COLLATE NOCASE`,
    )
      .bind(scope.organizationId)
      .all<{ id: string; name: string; isActive: number }>(),
  ]);

  return Response.json({
    canEdit: hasPermission(scope, "school.setup.manage"),
    session: scope.session,
    classes: groupAcademicClasses(classRows.results),
    houses: houses.results.map((house) => ({ ...house, isActive: Boolean(house.isActive) })),
  });
}

async function createAcademicClassMaster(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "school.setup.manage")) return forbidden();
  const parsed = academicClassMasterSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "Check the class details." }, { status: 400 });

  const runtime = getRuntimeEnv();
  const rows = await readAcademicClassRows(runtime.DATABASE, context.organizationId);
  const displayName = academicClassName(parsed.data.name, parsed.data.section);
  if (
    rows.some(
      (row) => canonicalMasterName(academicClassRowName(row)) === canonicalMasterName(displayName),
    )
  ) {
    return Response.json({ error: "This class and section already exists." }, { status: 409 });
  }

  const id = crypto.randomUUID();
  await runtime.DATABASE.batch([
    runtime.DATABASE.prepare(
      `INSERT INTO academic_class_master (
         id, organization_id, name, level, section, title, sort_order, is_active,
         source_system, source_table, source_id
       ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 'tsewa', 'academic_class_master', ?)`,
    ).bind(
      id,
      context.organizationId,
      parsed.data.name,
      parsed.data.level,
      parsed.data.section,
      parsed.data.sortOrder,
      parsed.data.isActive ? 1 : 0,
      id,
    ),
    auditStatement(runtime.DATABASE, context, "class.created", "academic_class_master", id, {
      name: displayName,
    }),
  ]);
  return Response.json({ id, name: displayName }, { status: 201 });
}

async function updateAcademicClassMaster(request: Request, classId: string): Promise<Response> {
  if (request.method !== "PATCH") return methodNotAllowed("PATCH");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "school.setup.manage")) return forbidden();
  const parsedId = z.uuid().safeParse(classId);
  const parsed = academicClassMasterSchema.safeParse(await readJson(request));
  if (!parsedId.success || !parsed.success) {
    return Response.json({ error: "Check the class details." }, { status: 400 });
  }

  const runtime = getRuntimeEnv();
  const rows = await readAcademicClassRows(runtime.DATABASE, context.organizationId);
  const selected = rows.find((row) => row.id === parsedId.data);
  if (!selected) return Response.json({ error: "Class not found" }, { status: 404 });
  const oldKey = canonicalMasterName(academicClassRowName(selected));
  const group = rows.filter((row) => canonicalMasterName(academicClassRowName(row)) === oldKey);
  const newName = academicClassName(parsed.data.name, parsed.data.section);
  const newKey = canonicalMasterName(newName);
  if (
    rows.some(
      (row) => !group.includes(row) && canonicalMasterName(academicClassRowName(row)) === newKey,
    )
  ) {
    return Response.json({ error: "This class and section already exists." }, { status: 409 });
  }

  await runtime.DATABASE.batch([
    ...group.map((row) =>
      runtime.DATABASE.prepare(
        `UPDATE academic_class_master
         SET name = ?, title = NULL, section = ?, level = ?, sort_order = ?, is_active = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ?`,
      ).bind(
        parsed.data.name,
        parsed.data.section,
        parsed.data.level,
        parsed.data.sortOrder,
        parsed.data.isActive ? 1 : 0,
        row.id,
        context.organizationId,
      ),
    ),
    auditStatement(
      runtime.DATABASE,
      context,
      "class.updated",
      "academic_class_master",
      selected.id,
      {
        previousName: academicClassRowName(selected),
        name: newName,
        matchingRecords: String(group.length),
        active: String(parsed.data.isActive),
      },
    ),
  ]);
  return Response.json({ ok: true, id: selected.id, updatedRows: group.length });
}

async function createHouseMaster(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "school.setup.manage")) return forbidden();
  const parsed = houseMasterSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "Check the house details." }, { status: 400 });
  const runtime = getRuntimeEnv();
  const duplicate = await runtime.DATABASE.prepare(
    "SELECT id FROM house_master WHERE organization_id = ? AND lower(trim(name)) = lower(trim(?))",
  )
    .bind(context.organizationId, parsed.data.name)
    .first<{ id: string }>();
  if (duplicate)
    return Response.json({ error: "A house with this name already exists." }, { status: 409 });
  const id = crypto.randomUUID();
  await runtime.DATABASE.batch([
    runtime.DATABASE.prepare(
      `INSERT INTO house_master
        (id, organization_id, name, is_active, source_system, source_table, source_id)
       VALUES (?, ?, ?, ?, 'tsewa', 'house_master', ?)`,
    ).bind(id, context.organizationId, parsed.data.name, parsed.data.isActive ? 1 : 0, id),
    auditStatement(runtime.DATABASE, context, "house.created", "house_master", id, {
      name: parsed.data.name,
    }),
  ]);
  return Response.json({ id, name: parsed.data.name }, { status: 201 });
}

async function updateHouseMaster(request: Request, houseId: string): Promise<Response> {
  if (request.method !== "PATCH") return methodNotAllowed("PATCH");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "school.setup.manage")) return forbidden();
  const parsedId = z.uuid().safeParse(houseId);
  const parsed = houseMasterSchema.safeParse(await readJson(request));
  if (!parsedId.success || !parsed.success)
    return Response.json({ error: "Check the house details." }, { status: 400 });
  const runtime = getRuntimeEnv();
  const [house, duplicate] = await Promise.all([
    runtime.DATABASE.prepare(
      "SELECT id, name FROM house_master WHERE id = ? AND organization_id = ?",
    )
      .bind(parsedId.data, context.organizationId)
      .first<{ id: string; name: string }>(),
    runtime.DATABASE.prepare(
      "SELECT id FROM house_master WHERE organization_id = ? AND lower(trim(name)) = lower(trim(?)) AND id <> ?",
    )
      .bind(context.organizationId, parsed.data.name, parsedId.data)
      .first<{ id: string }>(),
  ]);
  if (!house) return Response.json({ error: "House not found" }, { status: 404 });
  if (duplicate)
    return Response.json({ error: "A house with this name already exists." }, { status: 409 });
  await runtime.DATABASE.batch([
    runtime.DATABASE.prepare(
      `UPDATE house_master SET name = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
    ).bind(parsed.data.name, parsed.data.isActive ? 1 : 0, parsedId.data, context.organizationId),
    auditStatement(runtime.DATABASE, context, "house.updated", "house_master", parsedId.data, {
      previousName: house.name,
      name: parsed.data.name,
      active: String(parsed.data.isActive),
    }),
  ]);
  return Response.json({ ok: true, id: parsedId.data });
}

async function readAcademicClassRows(database: QueryDatabase, organizationId: string) {
  const result = await database
    .prepare(
      `SELECT id, name, title, section, level, sort_order AS sortOrder, is_active AS isActive
     FROM academic_class_master WHERE organization_id = ?`,
    )
    .bind(organizationId)
    .all<AcademicClassRow>();
  return result.results;
}

function groupAcademicClasses(rows: AcademicClassRow[]) {
  return groupAcademicClassRows(rows)
    .map((group) => {
      const representative = [...group].sort((left, right) => left.id.localeCompare(right.id))[0];
      return {
        id: representative.id,
        name: academicClassRowName(representative),
        baseName: representative.title?.trim() || representative.name.trim(),
        section: representative.section,
        level: representative.level,
        sortOrder: representative.sortOrder,
        isActive: group.some((row) => Boolean(row.isActive)),
        matchingRecords: group.length,
      };
    })
    .sort(
      (left, right) =>
        (left.sortOrder ?? 999) - (right.sortOrder ?? 999) || left.name.localeCompare(right.name),
    );
}

function groupAcademicClassRows(rows: AcademicClassRow[]) {
  const groups = new Map<string, AcademicClassRow[]>();
  for (const row of rows) {
    const key = canonicalMasterName(academicClassRowName(row));
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()];
}

function academicClassRowName(row: Pick<AcademicClassRow, "name" | "title" | "section">) {
  return academicClassName(row.title?.trim() || row.name.trim(), row.section);
}

function academicClassName(name: string, section: string | null) {
  const cleanName = name.trim();
  const cleanSection = section?.trim();
  if (!cleanSection || ["none", "0", "n/a", "null"].includes(cleanSection.toLowerCase()))
    return cleanName;
  return cleanName.toLowerCase().endsWith(` ${cleanSection.toLowerCase()}`)
    ? cleanName
    : `${cleanName} ${cleanSection}`;
}

function canonicalMasterName(value: string) {
  return value.trim().replaceAll(/\s+/g, " ").toLowerCase();
}

async function createSchoolMaster(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "school.setup.manage")) return forbidden();

  const parsed = schoolMasterSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Check the school details." }, { status: 400 });
  }

  const runtime = getRuntimeEnv();
  const duplicate = await runtime.DATABASE.prepare(
    "SELECT id FROM school_master WHERE organization_id = ? AND lower(trim(name)) = lower(trim(?))",
  )
    .bind(context.organizationId, parsed.data.name)
    .first<{ id: string }>();
  if (duplicate) {
    return Response.json({ error: "A school with this name already exists." }, { status: 409 });
  }

  const id = crypto.randomUUID();
  await runtime.DATABASE.batch([
    runtime.DATABASE.prepare(
      `INSERT INTO school_master (
         id, organization_id, name, location_name, affiliation_number, is_active,
         source_system, source_table, source_id
       ) VALUES (?, ?, ?, ?, ?, ?, 'tsewa', 'school_master', ?)`,
    ).bind(
      id,
      context.organizationId,
      parsed.data.name,
      parsed.data.locationName,
      parsed.data.affiliationNumber,
      parsed.data.isActive ? 1 : 0,
      id,
    ),
    auditStatement(runtime.DATABASE, context, "school.created", "school_master", id, {
      name: parsed.data.name,
    }),
  ]);

  return Response.json({ id, name: parsed.data.name }, { status: 201 });
}

async function updateSchoolMaster(request: Request, schoolId: string): Promise<Response> {
  if (request.method !== "PATCH") return methodNotAllowed("PATCH");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "school.setup.manage")) return forbidden();

  const parsedId = z.uuid().safeParse(schoolId);
  const parsed = schoolMasterSchema.safeParse(await readJson(request));
  if (!parsedId.success || !parsed.success) {
    return Response.json({ error: "Check the school details." }, { status: 400 });
  }

  const runtime = getRuntimeEnv();
  const [school, duplicate] = await Promise.all([
    runtime.DATABASE.prepare(
      "SELECT id, name FROM school_master WHERE id = ? AND organization_id = ?",
    )
      .bind(parsedId.data, context.organizationId)
      .first<{ id: string; name: string }>(),
    runtime.DATABASE.prepare(
      `SELECT id FROM school_master
       WHERE organization_id = ? AND lower(trim(name)) = lower(trim(?)) AND id <> ?`,
    )
      .bind(context.organizationId, parsed.data.name, parsedId.data)
      .first<{ id: string }>(),
  ]);
  if (!school) return Response.json({ error: "School not found" }, { status: 404 });
  if (duplicate) {
    return Response.json({ error: "A school with this name already exists." }, { status: 409 });
  }

  await runtime.DATABASE.batch([
    runtime.DATABASE.prepare(
      `UPDATE school_master
       SET name = ?, location_name = ?, affiliation_number = ?, is_active = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
    ).bind(
      parsed.data.name,
      parsed.data.locationName,
      parsed.data.affiliationNumber,
      parsed.data.isActive ? 1 : 0,
      parsedId.data,
      context.organizationId,
    ),
    auditStatement(runtime.DATABASE, context, "school.updated", "school_master", parsedId.data, {
      previousName: school.name,
      name: parsed.data.name,
      active: String(parsed.data.isActive),
    }),
  ]);

  return Response.json({ ok: true, id: parsedId.data });
}

async function handleSchoolAssignments(request: Request, schoolId: string): Promise<Response> {
  const parsedSchoolId = z.uuid().safeParse(schoolId);
  if (!parsedSchoolId.success) {
    return Response.json({ error: "Invalid school." }, { status: 400 });
  }
  if (request.method === "GET") return getSchoolAssignments(request, parsedSchoolId.data);
  if (request.method === "PUT") return updateSchoolAssignments(request, parsedSchoolId.data);
  return methodNotAllowed("GET, PUT");
}

async function getSchoolAssignments(request: Request, schoolId: string): Promise<Response> {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  const parsed = schoolOverviewQuerySchema.safeParse({ sessionId });
  if (!parsed.success) {
    return Response.json({ error: "Select an academic session." }, { status: 400 });
  }
  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope) return forbidden();
  const runtime = getRuntimeEnv();
  const school = await runtime.DATABASE.prepare(
    "SELECT id, name FROM school_master WHERE id = ? AND organization_id = ?",
  )
    .bind(schoolId, scope.organizationId)
    .first<{ id: string; name: string }>();
  if (!school) return Response.json({ error: "School not found." }, { status: 404 });

  const [classRows, offerings, enrollmentClasses, houses, schoolHouses, enrollmentHouses] =
    await Promise.all([
      readAcademicClassRows(runtime.DATABASE, scope.organizationId),
      runtime.DATABASE.prepare(
        `SELECT id, academic_class_id AS academicClassId, is_active AS isActive
         FROM school_class_offering
         WHERE organization_id = ? AND academic_session_id = ? AND school_id = ?`,
      )
        .bind(scope.organizationId, scope.session.id, schoolId)
        .all<{ id: string; academicClassId: string; isActive: number }>(),
      runtime.DATABASE.prepare(
        `SELECT academic_class_id AS academicClassId, COUNT(*) AS students
         FROM student_enrollment
         WHERE organization_id = ? AND academic_session_id = ? AND school_id = ?
         GROUP BY academic_class_id`,
      )
        .bind(scope.organizationId, scope.session.id, schoolId)
        .all<{ academicClassId: string; students: number }>(),
      runtime.DATABASE.prepare(
        `SELECT id, name, is_active AS isActive FROM house_master
         WHERE organization_id = ? ORDER BY is_active DESC, name COLLATE NOCASE`,
      )
        .bind(scope.organizationId)
        .all<{ id: string; name: string; isActive: number }>(),
      runtime.DATABASE.prepare(
        `SELECT house_id AS houseId FROM school_house_master
         WHERE organization_id = ? AND school_id = ?`,
      )
        .bind(scope.organizationId, schoolId)
        .all<{ houseId: string }>(),
      runtime.DATABASE.prepare(
        `SELECT house_id AS houseId, COUNT(*) AS students FROM student_enrollment
         WHERE organization_id = ? AND academic_session_id = ? AND school_id = ?
           AND house_id IS NOT NULL GROUP BY house_id`,
      )
        .bind(scope.organizationId, scope.session.id, schoolId)
        .all<{ houseId: string; students: number }>(),
    ]);

  const activeOfferingIds = new Set(
    offerings.results.filter((item) => Boolean(item.isActive)).map((item) => item.academicClassId),
  );
  const classStudentCounts = new Map(
    enrollmentClasses.results.map((item) => [item.academicClassId, Number(item.students)]),
  );
  const assignedHouseIds = new Set(schoolHouses.results.map((item) => item.houseId));
  const houseStudentCounts = new Map(
    enrollmentHouses.results.map((item) => [item.houseId, Number(item.students)]),
  );

  return Response.json({
    canEdit: hasPermission(scope, "school.setup.manage"),
    school,
    session: scope.session,
    classes: groupAcademicClassRows(classRows)
      .map((group) => {
        const display = groupAcademicClasses(group)[0];
        return {
          ...display,
          assigned: group.some((row) => activeOfferingIds.has(row.id)),
          students: group.reduce((total, row) => total + (classStudentCounts.get(row.id) ?? 0), 0),
        };
      })
      .filter((item) => item.isActive || item.assigned)
      .sort(
        (left, right) =>
          (left.sortOrder ?? 999) - (right.sortOrder ?? 999) || left.name.localeCompare(right.name),
      ),
    houses: houses.results
      .map((house) => ({
        ...house,
        assigned: assignedHouseIds.has(house.id),
        isActive: Boolean(house.isActive),
        students: houseStudentCounts.get(house.id) ?? 0,
      }))
      .filter((house) => house.isActive || house.assigned),
  });
}

async function updateSchoolAssignments(request: Request, schoolId: string): Promise<Response> {
  if (!isSameOrigin(request)) return forbidden();
  const parsed = schoolAssignmentsSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Check the selected classes and houses." }, { status: 400 });
  }
  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope) return forbidden();
  if (!hasPermission(scope, "school.setup.manage")) return forbidden();
  const runtime = getRuntimeEnv();
  const school = await runtime.DATABASE.prepare(
    "SELECT id, name FROM school_master WHERE id = ? AND organization_id = ?",
  )
    .bind(schoolId, scope.organizationId)
    .first<{ id: string; name: string }>();
  if (!school) return Response.json({ error: "School not found." }, { status: 404 });

  const [classRows, offerings, enrollmentClasses, houses, schoolHouses, enrollmentHouses] =
    await Promise.all([
      readAcademicClassRows(runtime.DATABASE, scope.organizationId),
      runtime.DATABASE.prepare(
        `SELECT id, academic_class_id AS academicClassId, is_active AS isActive
         FROM school_class_offering
         WHERE organization_id = ? AND academic_session_id = ? AND school_id = ?`,
      )
        .bind(scope.organizationId, scope.session.id, schoolId)
        .all<{ id: string; academicClassId: string; isActive: number }>(),
      runtime.DATABASE.prepare(
        `SELECT academic_class_id AS academicClassId, COUNT(*) AS students
         FROM student_enrollment
         WHERE organization_id = ? AND academic_session_id = ? AND school_id = ?
         GROUP BY academic_class_id`,
      )
        .bind(scope.organizationId, scope.session.id, schoolId)
        .all<{ academicClassId: string; students: number }>(),
      runtime.DATABASE.prepare(
        "SELECT id, name, is_active AS isActive FROM house_master WHERE organization_id = ?",
      )
        .bind(scope.organizationId)
        .all<{ id: string; name: string; isActive: number }>(),
      runtime.DATABASE.prepare(
        `SELECT id, house_id AS houseId FROM school_house_master
         WHERE organization_id = ? AND school_id = ?`,
      )
        .bind(scope.organizationId, schoolId)
        .all<{ id: string; houseId: string }>(),
      runtime.DATABASE.prepare(
        `SELECT house_id AS houseId, COUNT(*) AS students FROM student_enrollment
         WHERE organization_id = ? AND academic_session_id = ? AND school_id = ?
           AND house_id IS NOT NULL GROUP BY house_id`,
      )
        .bind(scope.organizationId, scope.session.id, schoolId)
        .all<{ houseId: string; students: number }>(),
    ]);

  const classGroups = groupAcademicClassRows(classRows);
  const displayedClasses = classGroups.map((group) => ({
    group,
    display: groupAcademicClasses(group)[0],
  }));
  const classesById = new Map(displayedClasses.map((item) => [item.display.id, item]));
  const housesById = new Map(houses.results.map((house) => [house.id, house]));
  const selectedClassIds = new Set(parsed.data.classIds);
  const selectedHouseIds = new Set(parsed.data.houseIds);
  if (
    [...selectedClassIds].some((id) => !classesById.get(id)?.display.isActive) ||
    [...selectedHouseIds].some((id) => !housesById.get(id)?.isActive)
  ) {
    return Response.json({ error: "Choose only active classes and houses." }, { status: 400 });
  }

  const offeringByClassId = new Map<string, (typeof offerings.results)[number]>();
  for (const offering of offerings.results)
    offeringByClassId.set(offering.academicClassId, offering);
  const classStudentCounts = new Map(
    enrollmentClasses.results.map((item) => [item.academicClassId, Number(item.students)]),
  );
  const schoolHouseByHouseId = new Map(schoolHouses.results.map((item) => [item.houseId, item]));
  const houseStudentCounts = new Map(
    enrollmentHouses.results.map((item) => [item.houseId, Number(item.students)]),
  );

  const blockedClasses = displayedClasses
    .filter(
      ({ display, group }) =>
        !selectedClassIds.has(display.id) &&
        group.some((row) => Boolean(offeringByClassId.get(row.id)?.isActive)) &&
        group.some((row) => (classStudentCounts.get(row.id) ?? 0) > 0),
    )
    .map(({ display }) => display.name);
  const blockedHouses = houses.results
    .filter(
      (house) =>
        !selectedHouseIds.has(house.id) &&
        schoolHouseByHouseId.has(house.id) &&
        (houseStudentCounts.get(house.id) ?? 0) > 0,
    )
    .map((house) => house.name);
  if (blockedClasses.length || blockedHouses.length) {
    const names = [...blockedClasses, ...blockedHouses].slice(0, 4).join(", ");
    return Response.json(
      { error: `${names} cannot be removed because students use them in this session.` },
      { status: 409 },
    );
  }

  const statements: DrizzleStatement[] = [];
  for (const { display, group } of displayedClasses) {
    const shouldAssign = selectedClassIds.has(display.id);
    const current = group.map((row) => offeringByClassId.get(row.id)).filter(Boolean);
    if (shouldAssign) {
      const representative = offeringByClassId.get(display.id);
      if (representative) {
        if (!representative.isActive) {
          statements.push(
            runtime.DATABASE.prepare(
              "UPDATE school_class_offering SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            ).bind(representative.id),
          );
        }
      } else {
        const id = crypto.randomUUID();
        statements.push(
          runtime.DATABASE.prepare(
            `INSERT INTO school_class_offering
              (id, organization_id, academic_session_id, school_id, academic_class_id, origin,
               source_system, source_table, source_id)
             VALUES (?, ?, ?, ?, ?, 'manual', 'tsewa', 'school_class_offering', ?)`,
          ).bind(id, scope.organizationId, scope.session.id, schoolId, display.id, id),
        );
      }
    } else {
      for (const offering of current) {
        if (offering?.isActive) {
          statements.push(
            runtime.DATABASE.prepare(
              "UPDATE school_class_offering SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            ).bind(offering.id),
          );
        }
      }
    }
  }
  for (const house of houses.results) {
    const current = schoolHouseByHouseId.get(house.id);
    if (selectedHouseIds.has(house.id) && !current) {
      const id = crypto.randomUUID();
      statements.push(
        runtime.DATABASE.prepare(
          `INSERT INTO school_house_master
            (id, organization_id, school_id, house_id, source_system, source_table, source_id)
           VALUES (?, ?, ?, ?, 'tsewa', 'school_house_master', ?)`,
        ).bind(id, scope.organizationId, schoolId, house.id, id),
      );
    } else if (!selectedHouseIds.has(house.id) && current) {
      statements.push(
        runtime.DATABASE.prepare(
          "DELETE FROM school_house_master WHERE id = ? AND organization_id = ?",
        ).bind(current.id, scope.organizationId),
      );
    }
  }
  statements.push(
    auditStatement(
      runtime.DATABASE,
      scope,
      "school.assignments_updated",
      "school_master",
      schoolId,
      {
        academicSessionId: scope.session.id,
        classes: String(selectedClassIds.size),
        houses: String(selectedHouseIds.size),
      },
    ),
  );
  await runtime.DATABASE.batch(statements);
  return Response.json({
    ok: true,
    schoolName: school.name,
    classes: selectedClassIds.size,
    houses: selectedHouseIds.size,
  });
}

async function getSchoolOperationsRosters(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const url = new URL(request.url);
  const parsed = schoolRostersQuerySchema.safeParse({
    sessionId: url.searchParams.get("sessionId"),
    q: url.searchParams.get("q") ?? "",
    school: url.searchParams.get("school") ?? "all",
  });
  if (!parsed.success) {
    return Response.json({ error: "Check the class filters." }, { status: 400 });
  }

  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope) return forbidden();
  const conditions = [
    "offering.organization_id = ?",
    "offering.academic_session_id = ?",
    "offering.is_active = 1",
  ];
  const bindings: Array<string | number> = [scope.organizationId, scope.session.id];
  if (parsed.data.school !== "all") {
    conditions.push("school.id = ?");
    bindings.push(parsed.data.school);
  }
  if (parsed.data.q) {
    const search = `%${escapeLikePattern(parsed.data.q.toLowerCase())}%`;
    conditions.push(
      `(lower(school.name) LIKE ? ESCAPE '\\' OR lower(${classDisplayName("class")}) LIKE ? ESCAPE '\\')`,
    );
    bindings.push(search, search);
  }

  const runtime = getRuntimeEnv();
  const rosters = await runtime.DATABASE.prepare(
    `SELECT min(offering.id) AS id, school.id AS schoolId, school.name AS schoolName,
            ${classDisplayName("class")} AS classId,
            ${classDisplayName("class")} AS className,
            max(class.level) AS classLevel, max(class.section) AS classSection,
            COUNT(DISTINCT enrollment.id) AS students,
            COUNT(DISTINCT CASE WHEN person.status = 'active' THEN enrollment.person_id END)
              AS currentActiveStudents,
            COUNT(DISTINCT CASE WHEN person.gender = 'female' THEN enrollment.person_id END)
              AS femaleStudents,
            COUNT(DISTINCT CASE WHEN person.gender = 'male' THEN enrollment.person_id END)
              AS maleStudents,
            COUNT(DISTINCT enrollment.house_id) AS houses
     FROM school_class_offering offering
     JOIN school_master school ON school.id = offering.school_id
       AND school.organization_id = offering.organization_id
     JOIN academic_class_master class ON class.id = offering.academic_class_id
       AND class.organization_id = offering.organization_id
     LEFT JOIN student_enrollment enrollment
       ON enrollment.school_class_offering_id = offering.id
      AND enrollment.organization_id = offering.organization_id
     LEFT JOIN person ON person.id = enrollment.person_id
       AND person.organization_id = enrollment.organization_id
     WHERE ${conditions.join(" AND ")}
     GROUP BY school.id, school.name, ${classDisplayName("class")}
     ORDER BY school.name COLLATE NOCASE, coalesce(min(class.sort_order), 999),
              coalesce(max(class.level), 999), className COLLATE NOCASE`,
  )
    .bind(...bindings)
    .all<{
      id: string;
      schoolId: string;
      schoolName: string;
      classId: string;
      className: string;
      classLevel: number | null;
      classSection: string | null;
      students: number;
      currentActiveStudents: number;
      femaleStudents: number;
      maleStudents: number;
      houses: number;
    }>();

  return Response.json({ session: scope.session, rosters: rosters.results });
}

async function getHistoricalResultsOverview(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "school.results.read")) return forbidden();
  const url = new URL(request.url);
  const parsed = historicalResultsOverviewQuerySchema.safeParse({
    sessionId: url.searchParams.get("sessionId") || undefined,
  });
  if (!parsed.success)
    return Response.json({ error: "Select a valid result year." }, { status: 400 });
  const runtime = getRuntimeEnv();
  const sessions = await runtime.DATABASE.prepare(
    `SELECT session.id, session.name, COUNT(DISTINCT sheet.id) AS markSheets,
            COUNT(mark.id) AS results
     FROM academic_session session
     JOIN mark_sheet sheet ON sheet.academic_session_id = session.id
       AND sheet.organization_id = session.organization_id
     LEFT JOIN student_mark mark ON mark.mark_sheet_id = sheet.id
       AND mark.organization_id = sheet.organization_id
     WHERE session.organization_id = ?
     GROUP BY session.id, session.name, session.starts_on
     ORDER BY session.starts_on DESC`,
  )
    .bind(context.organizationId)
    .all<{ id: string; name: string; markSheets: number; results: number }>();
  const selectedId = parsed.data.sessionId ?? sessions.results[0]?.id;
  if (!selectedId)
    return Response.json({
      sessions: [],
      selectedSessionId: null,
      summary: { markSheets: 0, results: 0, students: 0 },
      filters: { schools: [], classes: [], subjects: [], terms: [] },
    });
  if (!sessions.results.some((session) => session.id === selectedId)) return forbidden();

  const [summary, schools, classes, subjects, terms] = await Promise.all([
    runtime.DATABASE.prepare(`SELECT COUNT(DISTINCT sheet.id) AS markSheets, COUNT(mark.id) AS results,
      COUNT(DISTINCT mark.person_id) AS students FROM mark_sheet sheet
      LEFT JOIN student_mark mark ON mark.mark_sheet_id=sheet.id AND mark.organization_id=sheet.organization_id
      WHERE sheet.organization_id=? AND sheet.academic_session_id=?`)
      .bind(context.organizationId, selectedId)
      .first<{ markSheets: number; results: number; students: number }>(),
    resultFilter(
      runtime.DATABASE,
      context.organizationId,
      selectedId,
      "school.id",
      "school.name",
      "school_master school",
      "school.id=sheet.school_id",
    ),
    resultFilter(
      runtime.DATABASE,
      context.organizationId,
      selectedId,
      "class.id",
      classDisplayName("class"),
      "academic_class_master class",
      "class.id=sheet.academic_class_id",
    ),
    resultFilter(
      runtime.DATABASE,
      context.organizationId,
      selectedId,
      "subject.id",
      "subject.name",
      "academic_subject subject",
      "subject.id=sheet.subject_id",
    ),
    resultFilter(
      runtime.DATABASE,
      context.organizationId,
      selectedId,
      "term.id",
      "term.name",
      "academic_term term",
      "term.id=sheet.term_id",
    ),
  ]);
  return Response.json({
    sessions: sessions.results,
    selectedSessionId: selectedId,
    summary: {
      markSheets: Number(summary?.markSheets ?? 0),
      results: Number(summary?.results ?? 0),
      students: Number(summary?.students ?? 0),
    },
    filters: {
      schools: schools.results,
      classes: classes.results,
      subjects: subjects.results,
      terms: terms.results,
    },
  });
}

function resultFilter(
  database: QueryDatabase,
  organizationId: string,
  sessionId: string,
  idSql: string,
  nameSql: string,
  joinTable: string,
  joinOn: string,
) {
  return database
    .prepare(`SELECT ${idSql} AS id, ${nameSql} AS name, COUNT(mark.id) AS count
    FROM mark_sheet sheet JOIN ${joinTable} ON ${joinOn}
    LEFT JOIN student_mark mark ON mark.mark_sheet_id=sheet.id
      AND mark.organization_id=sheet.organization_id AND mark.is_active=1
    WHERE sheet.organization_id=? AND sheet.academic_session_id=?
    GROUP BY ${idSql}, ${nameSql} ORDER BY ${nameSql} COLLATE NOCASE`)
    .bind(organizationId, sessionId)
    .all<{ id: string; name: string; count: number }>();
}

async function handleAcademicResults(request: Request): Promise<Response> {
  if (request.method === "GET") return getHistoricalResults(request);
  if (request.method === "POST") return createMarkSheet(request);
  return methodNotAllowed("GET, POST");
}

async function getHistoricalResults(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "school.results.read")) return forbidden();
  const url = new URL(request.url);
  const parsed = historicalResultsQuerySchema.safeParse({
    sessionId: url.searchParams.get("sessionId"),
    q: url.searchParams.get("q") ?? "",
    school: url.searchParams.get("school") ?? "all",
    className: url.searchParams.get("class") ?? "all",
    subject: url.searchParams.get("subject") ?? "all",
    term: url.searchParams.get("term") ?? "all",
    page: url.searchParams.get("page") ?? "1",
    pageSize: url.searchParams.get("pageSize") ?? "25",
  });
  if (!parsed.success)
    return Response.json({ error: "Check the result filters." }, { status: 400 });
  const { sessionId, q, school, className, subject, term, page, pageSize } = parsed.data;
  const conditions = ["sheet.organization_id=?", "sheet.academic_session_id=?", "mark.is_active=1"];
  const bindings: Array<string | number> = [context.organizationId, sessionId];
  for (const [value, sql] of [
    [school, "sheet.school_id"],
    [className, "sheet.academic_class_id"],
    [subject, "sheet.subject_id"],
    [term, "sheet.term_id"],
  ] as const) {
    if (value !== "all") {
      conditions.push(`${sql}=?`);
      bindings.push(value);
    }
  }
  if (q) {
    const search = `%${escapeLikePattern(q.toLowerCase())}%`;
    conditions.push(
      "(lower(person.display_name) LIKE ? ESCAPE '\\' OR lower(person.primary_identifier) LIKE ? ESCAPE '\\')",
    );
    bindings.push(search, search);
  }
  const where = conditions.join(" AND ");
  const runtime = getRuntimeEnv();
  const [count, rows] = await Promise.all([
    runtime.DATABASE.prepare(`SELECT COUNT(*) AS total FROM student_mark mark
      JOIN mark_sheet sheet ON sheet.id=mark.mark_sheet_id
      JOIN person ON person.id=mark.person_id AND person.organization_id=mark.organization_id
      WHERE ${where}`)
      .bind(...bindings)
      .first<{ total: number }>(),
    runtime.DATABASE.prepare(`SELECT mark.id, person.id AS personId, person.display_name AS studentName,
      person.primary_identifier AS admissionNumber, school.name AS schoolName,
      ${classDisplayName("class")} AS className, subject.name AS subjectName, term.name AS termName,
      assessment.name AS assessmentName, mark.marks, mark.maximum_marks AS maximumMarks,
      mark.note, sheet.recorded_on AS recordedOn, sheet.is_verified AS isVerified,
      sheet.status AS sheetStatus, sheet.id AS markSheetId, sheet.source_system AS sourceSystem
      FROM student_mark mark JOIN mark_sheet sheet ON sheet.id=mark.mark_sheet_id
      JOIN person ON person.id=mark.person_id AND person.organization_id=mark.organization_id
      JOIN school_master school ON school.id=sheet.school_id
      JOIN academic_class_master class ON class.id=sheet.academic_class_id
      JOIN academic_subject subject ON subject.id=sheet.subject_id
      JOIN academic_term term ON term.id=sheet.term_id
      JOIN academic_assessment assessment ON assessment.id=mark.assessment_id
      WHERE ${where}
      ORDER BY person.display_name COLLATE NOCASE, subject.name COLLATE NOCASE, assessment.name COLLATE NOCASE
      LIMIT ? OFFSET ?`)
      .bind(...bindings, pageSize, (page - 1) * pageSize)
      .all<{ isVerified: number; [key: string]: unknown }>(),
  ]);
  const total = Number(count?.total ?? 0);
  return Response.json({
    results: rows.results.map((row) => ({ ...row, isVerified: Boolean(row.isVerified) })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    capabilities: { manage: hasPermission(context, "school.results.manage") },
  });
}

async function handleAcademicResultSetup(request: Request): Promise<Response> {
  if (request.method === "GET") return getAcademicResultSetup(request);
  if (request.method === "POST") return createAcademicResultCatalog(request);
  return methodNotAllowed("GET, POST");
}

async function handleAcademicConfiguration(request: Request): Promise<Response> {
  if (request.method === "GET") return getAcademicConfiguration(request);
  if (request.method === "POST") return mutateAcademicConfiguration(request);
  return methodNotAllowed("GET, POST");
}

async function getAcademicConfiguration(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = resultSetupQuerySchema.safeParse({ sessionId: url.searchParams.get("sessionId") });
  if (!parsed.success)
    return Response.json({ error: "Select a valid academic session." }, { status: 400 });
  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope || !hasPermission(scope, "school.results.read")) return forbidden();
  const db = getRuntimeEnv().ORM;
  const [
    subjectTypes,
    subjectHeads,
    gradeTypes,
    grades,
    subjects,
    classes,
    assessments,
    mappings,
    limits,
  ] = await Promise.all([
    db
      .select({
        id: academicSubjectType.id,
        name: academicSubjectType.name,
        sourceSystem: academicSubjectType.sourceSystem,
      })
      .from(academicSubjectType)
      .where(
        and(
          eq(academicSubjectType.organizationId, scope.organizationId),
          eq(academicSubjectType.academicSessionId, scope.session.id),
        ),
      )
      .orderBy(asc(sql`lower(${academicSubjectType.name})`)),
    db
      .select({
        id: academicSubjectHead.id,
        name: academicSubjectHead.name,
        sourceSystem: academicSubjectHead.sourceSystem,
      })
      .from(academicSubjectHead)
      .where(
        and(
          eq(academicSubjectHead.organizationId, scope.organizationId),
          eq(academicSubjectHead.academicSessionId, scope.session.id),
        ),
      )
      .orderBy(asc(sql`lower(${academicSubjectHead.name})`)),
    db
      .select({
        id: academicGradeType.id,
        name: academicGradeType.name,
        sourceSystem: academicGradeType.sourceSystem,
      })
      .from(academicGradeType)
      .where(
        and(
          eq(academicGradeType.organizationId, scope.organizationId),
          eq(academicGradeType.academicSessionId, scope.session.id),
        ),
      )
      .orderBy(asc(sql`lower(${academicGradeType.name})`)),
    db
      .select({
        id: academicGrade.id,
        gradeTypeId: academicGrade.gradeTypeId,
        name: academicGrade.name,
        startsAt: academicGrade.startsAt,
        endsAt: academicGrade.endsAt,
        points: academicGrade.points,
        sourceSystem: academicGrade.sourceSystem,
      })
      .from(academicGrade)
      .innerJoin(academicGradeType, eq(academicGradeType.id, academicGrade.gradeTypeId))
      .where(
        and(
          eq(academicGrade.organizationId, scope.organizationId),
          eq(academicGradeType.academicSessionId, scope.session.id),
        ),
      )
      .orderBy(asc(sql`lower(${academicGradeType.name})`), desc(academicGrade.startsAt)),
    db
      .select({
        id: academicSubject.id,
        name: academicSubject.name,
        shortName: academicSubject.shortName,
        subjectTypeId: academicSubject.subjectTypeId,
        subjectHeadId: academicSubject.subjectHeadId,
        gradeTypeId: academicSubject.gradeTypeId,
        isOptional: academicSubject.isOptional,
        passingPercentage: academicSubject.passingPercentage,
        isActive: academicSubject.isActive,
        sourceSystem: academicSubject.sourceSystem,
      })
      .from(academicSubject)
      .where(
        and(
          eq(academicSubject.organizationId, scope.organizationId),
          eq(academicSubject.academicSessionId, scope.session.id),
        ),
      )
      .orderBy(asc(sql`lower(${academicSubject.name})`)),
    db
      .select({
        id: academicClassMaster.id,
        name: sql<string>`CASE
        WHEN lower(trim(coalesce(${academicClassMaster.section}, ''))) NOT IN ('', 'none', '0', 'n/a', 'null')
          AND lower(trim(coalesce(nullif(${academicClassMaster.title}, ''), ${academicClassMaster.name})))
            NOT LIKE '% ' || lower(trim(${academicClassMaster.section}))
        THEN trim(coalesce(nullif(${academicClassMaster.title}, ''), ${academicClassMaster.name})) || ' ' || trim(${academicClassMaster.section})
        ELSE trim(coalesce(nullif(${academicClassMaster.title}, ''), ${academicClassMaster.name}))
      END`,
      })
      .from(academicClassMaster)
      .where(eq(academicClassMaster.organizationId, scope.organizationId))
      .orderBy(
        asc(sql`coalesce(${academicClassMaster.level}, 999)`),
        asc(sql`lower(${academicClassMaster.name})`),
      ),
    db
      .select({
        id: academicAssessment.id,
        termId: academicAssessment.termId,
        name: academicAssessment.name,
      })
      .from(academicAssessment)
      .where(
        and(
          eq(academicAssessment.organizationId, scope.organizationId),
          eq(academicAssessment.academicSessionId, scope.session.id),
          eq(academicAssessment.isActive, 1),
        ),
      )
      .orderBy(asc(sql`lower(${academicAssessment.name})`)),
    db
      .select({
        id: academicClassSubject.id,
        academicClassId: academicClassSubject.academicClassId,
        subjectId: academicClassSubject.subjectId,
        maximumMarks: academicClassSubject.maximumMarks,
        displayOrder: academicClassSubject.displayOrder,
        sourceSystem: academicClassSubject.sourceSystem,
      })
      .from(academicClassSubject)
      .where(
        and(
          eq(academicClassSubject.organizationId, scope.organizationId),
          eq(academicClassSubject.academicSessionId, scope.session.id),
        ),
      )
      .orderBy(asc(academicClassSubject.academicClassId), asc(academicClassSubject.displayOrder)),
    db
      .select({
        id: academicClassSubjectAssessment.id,
        academicClassId: academicClassSubjectAssessment.academicClassId,
        subjectId: academicClassSubjectAssessment.subjectId,
        assessmentId: academicClassSubjectAssessment.assessmentId,
        maximumMarks: academicClassSubjectAssessment.maximumMarks,
      })
      .from(academicClassSubjectAssessment)
      .where(
        and(
          eq(academicClassSubjectAssessment.organizationId, scope.organizationId),
          eq(academicClassSubjectAssessment.academicSessionId, scope.session.id),
        ),
      ),
  ]);
  return Response.json({
    session: scope.session,
    subjectTypes,
    subjectHeads,
    gradeTypes,
    grades,
    subjects: subjects.map((row) => ({
      ...row,
      isOptional: Boolean(row.isOptional),
      isActive: Boolean(row.isActive),
    })),
    classes,
    assessments,
    mappings,
    assessmentLimits: limits,
    capabilities: { manage: hasPermission(scope, "school.results.manage") },
  });
}

async function mutateAcademicConfiguration(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return forbidden();
  const parsed = academicConfigurationMutationSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Check the academic configuration." },
      { status: 400 },
    );
  const data = parsed.data;
  const scope = await getSchoolSessionScope(request, data.sessionId);
  if (!scope || !hasPermission(scope, "school.results.manage")) return forbidden();
  const db = getRuntimeEnv().ORM;
  try {
    if (data.action === "saveCatalog") {
      const tableName = {
        subjectType: "academic_subject_type",
        subjectHead: "academic_subject_head",
        gradeType: "academic_grade_type",
      }[data.kind];
      const id = data.id ?? crypto.randomUUID();
      const values = {
        id,
        organizationId: scope.organizationId,
        academicSessionId: scope.session.id,
        name: data.name,
        sourceSystem: "tsewa",
        sourceTable: tableName,
        sourceId: id,
      };
      const changed =
        data.kind === "subjectType"
          ? data.id
            ? await db
                .update(academicSubjectType)
                .set({ name: data.name, updatedAt: sql`CURRENT_TIMESTAMP` })
                .where(
                  and(
                    eq(academicSubjectType.id, id),
                    eq(academicSubjectType.organizationId, scope.organizationId),
                    eq(academicSubjectType.academicSessionId, scope.session.id),
                  ),
                )
                .returning({ id: academicSubjectType.id })
            : await db
                .insert(academicSubjectType)
                .values(values)
                .returning({ id: academicSubjectType.id })
          : data.kind === "subjectHead"
            ? data.id
              ? await db
                  .update(academicSubjectHead)
                  .set({ name: data.name, updatedAt: sql`CURRENT_TIMESTAMP` })
                  .where(
                    and(
                      eq(academicSubjectHead.id, id),
                      eq(academicSubjectHead.organizationId, scope.organizationId),
                      eq(academicSubjectHead.academicSessionId, scope.session.id),
                    ),
                  )
                  .returning({ id: academicSubjectHead.id })
              : await db
                  .insert(academicSubjectHead)
                  .values(values)
                  .returning({ id: academicSubjectHead.id })
            : data.id
              ? await db
                  .update(academicGradeType)
                  .set({ name: data.name, updatedAt: sql`CURRENT_TIMESTAMP` })
                  .where(
                    and(
                      eq(academicGradeType.id, id),
                      eq(academicGradeType.organizationId, scope.organizationId),
                      eq(academicGradeType.academicSessionId, scope.session.id),
                    ),
                  )
                  .returning({ id: academicGradeType.id })
              : await db
                  .insert(academicGradeType)
                  .values(values)
                  .returning({ id: academicGradeType.id });
      if (data.id && changed.length === 0)
        return Response.json({ error: "Configuration item not found." }, { status: 404 });
      await auditInsert(db, scope, "academic.configuration_saved", tableName, id, {
        kind: data.kind,
        sessionId: scope.session.id,
      });
      return Response.json({ id }, { status: data.id ? 200 : 201 });
    }
    if (data.action === "saveGrade") {
      const type = await db
        .select({ id: academicGradeType.id })
        .from(academicGradeType)
        .where(
          and(
            eq(academicGradeType.id, data.gradeTypeId),
            eq(academicGradeType.organizationId, scope.organizationId),
            eq(academicGradeType.academicSessionId, scope.session.id),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!type)
        return Response.json({ error: "Choose a grade type from this session." }, { status: 400 });
      const id = data.id ?? crypto.randomUUID();
      const changed = data.id
        ? await db
            .update(academicGrade)
            .set({
              gradeTypeId: data.gradeTypeId,
              name: data.name,
              startsAt: data.startsAt,
              endsAt: data.endsAt,
              points: data.points,
              updatedAt: sql`CURRENT_TIMESTAMP`,
            })
            .where(
              and(eq(academicGrade.id, id), eq(academicGrade.organizationId, scope.organizationId)),
            )
            .returning({ id: academicGrade.id })
        : await db
            .insert(academicGrade)
            .values({
              id,
              organizationId: scope.organizationId,
              gradeTypeId: data.gradeTypeId,
              name: data.name,
              startsAt: data.startsAt,
              endsAt: data.endsAt,
              points: data.points,
              sourceSystem: "tsewa",
              sourceTable: "academic_grade",
              sourceId: id,
            })
            .returning({ id: academicGrade.id });
      if (data.id && changed.length === 0)
        return Response.json({ error: "Grade not found." }, { status: 404 });
      await auditInsert(db, scope, "academic.grade_saved", "academic_grade", id, {
        sessionId: scope.session.id,
        gradeTypeId: data.gradeTypeId,
      });
      return Response.json({ id }, { status: data.id ? 200 : 201 });
    }
    if (data.action === "saveSubject") {
      const references = await Promise.all([
        academicConfigurationReference(
          db,
          "academic_subject_type",
          data.subjectTypeId,
          scope.organizationId,
          scope.session.id,
        ),
        academicConfigurationReference(
          db,
          "academic_subject_head",
          data.subjectHeadId,
          scope.organizationId,
          scope.session.id,
        ),
        academicConfigurationReference(
          db,
          "academic_grade_type",
          data.gradeTypeId,
          scope.organizationId,
          scope.session.id,
        ),
      ]);
      if (references.some((valid) => !valid))
        return Response.json(
          { error: "Choose configuration values from this session." },
          { status: 400 },
        );
      const id = data.id ?? crypto.randomUUID();
      const subjectValues = {
        name: data.name,
        shortName: data.shortName,
        subjectTypeId: data.subjectTypeId,
        subjectHeadId: data.subjectHeadId,
        gradeTypeId: data.gradeTypeId,
        isOptional: data.isOptional ? 1 : 0,
        passingPercentage: data.passingPercentage,
        isActive: data.isActive ? 1 : 0,
      };
      const changed = data.id
        ? await db
            .update(academicSubject)
            .set({ ...subjectValues, updatedAt: sql`CURRENT_TIMESTAMP` })
            .where(
              and(
                eq(academicSubject.id, id),
                eq(academicSubject.organizationId, scope.organizationId),
                eq(academicSubject.academicSessionId, scope.session.id),
              ),
            )
            .returning({ id: academicSubject.id })
        : await db
            .insert(academicSubject)
            .values({
              id,
              organizationId: scope.organizationId,
              academicSessionId: scope.session.id,
              ...subjectValues,
              sourceSystem: "tsewa",
              sourceTable: "academic_subject",
              sourceId: id,
            })
            .returning({ id: academicSubject.id });
      if (data.id && changed.length === 0)
        return Response.json({ error: "Subject not found." }, { status: 404 });
      await auditInsert(db, scope, "academic.subject_saved", "academic_subject", id, {
        sessionId: scope.session.id,
      });
      return Response.json({ id }, { status: data.id ? 200 : 201 });
    }
    if (data.action === "saveClassSubject") {
      const [academicClass, configuredSubject, configuredAssessments] = await Promise.all([
        db
          .select({ id: academicClassMaster.id })
          .from(academicClassMaster)
          .where(
            and(
              eq(academicClassMaster.id, data.academicClassId),
              eq(academicClassMaster.organizationId, scope.organizationId),
            ),
          )
          .limit(1)
          .then((rows) => rows[0] ?? null),
        db
          .select({ id: academicSubject.id })
          .from(academicSubject)
          .where(
            and(
              eq(academicSubject.id, data.subjectId),
              eq(academicSubject.organizationId, scope.organizationId),
              eq(academicSubject.academicSessionId, scope.session.id),
            ),
          )
          .limit(1)
          .then((rows) => rows[0] ?? null),
        db
          .select({ id: academicAssessment.id })
          .from(academicAssessment)
          .where(
            and(
              eq(academicAssessment.organizationId, scope.organizationId),
              eq(academicAssessment.academicSessionId, scope.session.id),
            ),
          ),
      ]);
      const assessmentIds = new Set(configuredAssessments.map((item) => item.id));
      if (
        !academicClass ||
        !configuredSubject ||
        data.assessmentLimits.some((item) => !assessmentIds.has(item.assessmentId))
      )
        return Response.json(
          { error: "Choose a valid class, subject, and assessments." },
          { status: 400 },
        );
      const existing = await db
        .select({ id: academicClassSubject.id })
        .from(academicClassSubject)
        .where(
          and(
            eq(academicClassSubject.organizationId, scope.organizationId),
            eq(academicClassSubject.academicSessionId, scope.session.id),
            eq(academicClassSubject.academicClassId, data.academicClassId),
            eq(academicClassSubject.subjectId, data.subjectId),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!data.enabled) {
        if (existing)
          await db.batch([
            db
              .delete(academicClassSubjectAssessment)
              .where(
                and(
                  eq(academicClassSubjectAssessment.organizationId, scope.organizationId),
                  eq(academicClassSubjectAssessment.academicSessionId, scope.session.id),
                  eq(academicClassSubjectAssessment.academicClassId, data.academicClassId),
                  eq(academicClassSubjectAssessment.subjectId, data.subjectId),
                ),
              ),
            db
              .delete(academicClassSubject)
              .where(
                and(
                  eq(academicClassSubject.id, existing.id),
                  eq(academicClassSubject.organizationId, scope.organizationId),
                ),
              ),
            auditInsert(
              db,
              scope,
              "academic.class_subject_removed",
              "academic_class_subject",
              existing.id,
              {
                sessionId: scope.session.id,
                academicClassId: data.academicClassId,
                subjectId: data.subjectId,
              },
            ),
          ]);
        return Response.json({ removed: Boolean(existing) });
      }
      const id = existing?.id ?? crypto.randomUUID();
      await db
        .insert(academicClassSubject)
        .values({
          id,
          organizationId: scope.organizationId,
          academicSessionId: scope.session.id,
          academicClassId: data.academicClassId,
          subjectId: data.subjectId,
          maximumMarks: data.maximumMarks,
          displayOrder: data.displayOrder,
          sourceSystem: "tsewa",
          sourceTable: "academic_class_subject",
          sourceId: id,
        })
        .onConflictDoUpdate({
          target: academicClassSubject.id,
          set: {
            maximumMarks: data.maximumMarks,
            displayOrder: data.displayOrder,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        });
      await db
        .delete(academicClassSubjectAssessment)
        .where(
          and(
            eq(academicClassSubjectAssessment.organizationId, scope.organizationId),
            eq(academicClassSubjectAssessment.academicSessionId, scope.session.id),
            eq(academicClassSubjectAssessment.academicClassId, data.academicClassId),
            eq(academicClassSubjectAssessment.subjectId, data.subjectId),
          ),
        );
      for (const limit of data.assessmentLimits) {
        const limitId = crypto.randomUUID();
        await db.insert(academicClassSubjectAssessment).values({
          id: limitId,
          organizationId: scope.organizationId,
          academicSessionId: scope.session.id,
          academicClassId: data.academicClassId,
          subjectId: data.subjectId,
          assessmentId: limit.assessmentId,
          maximumMarks: limit.maximumMarks,
          sourceSystem: "tsewa",
          sourceTable: "academic_class_subject_assessment",
          sourceId: limitId,
        });
      }
      await auditInsert(db, scope, "academic.class_subject_saved", "academic_class_subject", id, {
        sessionId: scope.session.id,
        academicClassId: data.academicClassId,
        subjectId: data.subjectId,
        assessmentCount: String(data.assessmentLimits.length),
      });
      return Response.json({ id });
    }
    const table = {
      subjectType: "academic_subject_type",
      subjectHead: "academic_subject_head",
      gradeType: "academic_grade_type",
      grade: "academic_grade",
      subject: "academic_subject",
    }[data.kind];
    let deleted: Array<{ id: string }> = [];
    if (data.kind === "grade") {
      const gradeTypeIds = await db
        .select({ id: academicGradeType.id })
        .from(academicGradeType)
        .where(
          and(
            eq(academicGradeType.organizationId, scope.organizationId),
            eq(academicGradeType.academicSessionId, scope.session.id),
          ),
        )
        .then((rows) => rows.map((row) => row.id));
      if (gradeTypeIds.length) {
        deleted = await db
          .delete(academicGrade)
          .where(
            and(
              eq(academicGrade.id, data.id),
              eq(academicGrade.organizationId, scope.organizationId),
              inArray(academicGrade.gradeTypeId, gradeTypeIds),
            ),
          )
          .returning({ id: academicGrade.id });
      }
    } else if (data.kind === "subjectType") {
      deleted = await db
        .delete(academicSubjectType)
        .where(
          and(
            eq(academicSubjectType.id, data.id),
            eq(academicSubjectType.organizationId, scope.organizationId),
            eq(academicSubjectType.academicSessionId, scope.session.id),
          ),
        )
        .returning({ id: academicSubjectType.id });
    } else if (data.kind === "subjectHead") {
      deleted = await db
        .delete(academicSubjectHead)
        .where(
          and(
            eq(academicSubjectHead.id, data.id),
            eq(academicSubjectHead.organizationId, scope.organizationId),
            eq(academicSubjectHead.academicSessionId, scope.session.id),
          ),
        )
        .returning({ id: academicSubjectHead.id });
    } else if (data.kind === "gradeType") {
      deleted = await db
        .delete(academicGradeType)
        .where(
          and(
            eq(academicGradeType.id, data.id),
            eq(academicGradeType.organizationId, scope.organizationId),
            eq(academicGradeType.academicSessionId, scope.session.id),
          ),
        )
        .returning({ id: academicGradeType.id });
    } else {
      deleted = await db
        .delete(academicSubject)
        .where(
          and(
            eq(academicSubject.id, data.id),
            eq(academicSubject.organizationId, scope.organizationId),
            eq(academicSubject.academicSessionId, scope.session.id),
          ),
        )
        .returning({ id: academicSubject.id });
    }
    if (deleted.length) {
      await auditInsert(db, scope, "academic.configuration_deleted", table, data.id, {
        kind: data.kind,
        sessionId: scope.session.id,
      });
    }
    return Response.json({ deleted: deleted.length > 0 });
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : "";
    if (detail.includes("UNIQUE"))
      return Response.json({ error: "That name already exists in this session." }, { status: 409 });
    if (detail.includes("FOREIGN KEY"))
      return Response.json(
        { error: "This item is in use and cannot be removed." },
        { status: 409 },
      );
    throw reason;
  }
}

async function academicConfigurationReference(
  db: Database,
  table: string,
  id: string | null,
  organizationId: string,
  sessionId: string,
) {
  if (!id) return true;
  if (table === "academic_subject_type") {
    return db
      .select({ id: academicSubjectType.id })
      .from(academicSubjectType)
      .where(
        and(
          eq(academicSubjectType.id, id),
          eq(academicSubjectType.organizationId, organizationId),
          eq(academicSubjectType.academicSessionId, sessionId),
        ),
      )
      .limit(1)
      .then((rows) => Boolean(rows[0]));
  }
  if (table === "academic_subject_head") {
    return db
      .select({ id: academicSubjectHead.id })
      .from(academicSubjectHead)
      .where(
        and(
          eq(academicSubjectHead.id, id),
          eq(academicSubjectHead.organizationId, organizationId),
          eq(academicSubjectHead.academicSessionId, sessionId),
        ),
      )
      .limit(1)
      .then((rows) => Boolean(rows[0]));
  }
  if (table === "academic_grade_type") {
    return db
      .select({ id: academicGradeType.id })
      .from(academicGradeType)
      .where(
        and(
          eq(academicGradeType.id, id),
          eq(academicGradeType.organizationId, organizationId),
          eq(academicGradeType.academicSessionId, sessionId),
        ),
      )
      .limit(1)
      .then((rows) => Boolean(rows[0]));
  }
  return false;
}

async function getAcademicResultSetup(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = resultSetupQuerySchema.safeParse({ sessionId: url.searchParams.get("sessionId") });
  if (!parsed.success)
    return Response.json({ error: "Select a valid academic session." }, { status: 400 });
  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope) return forbidden();
  if (!hasPermission(scope, "school.results.read")) return forbidden();
  const runtime = getRuntimeEnv();
  const [
    schools,
    classes,
    subjects,
    terms,
    assessments,
    students,
    classSubjects,
    assessmentLimits,
  ] = await Promise.all([
    runtime.DATABASE.prepare(`SELECT DISTINCT school.id,school.name FROM school_class_offering offering
      JOIN school_master school ON school.id=offering.school_id
      WHERE offering.organization_id=? AND offering.academic_session_id=? AND offering.is_active=1
      ORDER BY school.name COLLATE NOCASE`)
      .bind(scope.organizationId, scope.session.id)
      .all<{ id: string; name: string }>(),
    runtime.DATABASE.prepare(`SELECT offering.school_id AS schoolId,class.id,
      ${classDisplayName("class")} AS name FROM school_class_offering offering
      JOIN academic_class_master class ON class.id=offering.academic_class_id
      WHERE offering.organization_id=? AND offering.academic_session_id=? AND offering.is_active=1
      ORDER BY coalesce(class.level,999),name COLLATE NOCASE`)
      .bind(scope.organizationId, scope.session.id)
      .all<{ schoolId: string; id: string; name: string }>(),
    runtime.DATABASE.prepare(`SELECT id,name,short_name AS shortName,is_optional AS isOptional,
      passing_percentage AS passingPercentage FROM academic_subject
      WHERE organization_id=? AND academic_session_id=? AND is_active=1 ORDER BY name COLLATE NOCASE`)
      .bind(scope.organizationId, scope.session.id)
      .all<{
        id: string;
        name: string;
        shortName: string | null;
        isOptional: number;
        passingPercentage: number | null;
      }>(),
    runtime.DATABASE.prepare(
      `SELECT id,name FROM academic_term WHERE organization_id=? AND is_active=1 ORDER BY name COLLATE NOCASE`,
    )
      .bind(scope.organizationId)
      .all<{ id: string; name: string }>(),
    runtime.DATABASE.prepare(`SELECT id,term_id AS termId,name FROM academic_assessment
      WHERE organization_id=? AND academic_session_id=? AND is_active=1 ORDER BY name COLLATE NOCASE`)
      .bind(scope.organizationId, scope.session.id)
      .all<{ id: string; termId: string; name: string }>(),
    runtime.DATABASE.prepare(`SELECT enrollment.school_id AS schoolId,enrollment.academic_class_id AS academicClassId,
      person.id,person.display_name AS name,person.primary_identifier AS admissionNumber
      FROM student_enrollment enrollment JOIN person ON person.id=enrollment.person_id
      WHERE enrollment.organization_id=? AND enrollment.academic_session_id=?
        AND enrollment.status IN ('recorded','enrolled') AND person.status='active'
      ORDER BY person.display_name COLLATE NOCASE`)
      .bind(scope.organizationId, scope.session.id)
      .all<{
        schoolId: string;
        academicClassId: string;
        id: string;
        name: string;
        admissionNumber: string;
      }>(),
    runtime.DATABASE.prepare(`SELECT academic_class_id AS academicClassId,subject_id AS subjectId,
      maximum_marks AS maximumMarks,display_order AS displayOrder FROM academic_class_subject
      WHERE organization_id=? AND academic_session_id=? ORDER BY academic_class_id,display_order`)
      .bind(scope.organizationId, scope.session.id)
      .all(),
    runtime.DATABASE.prepare(`SELECT academic_class_id AS academicClassId,subject_id AS subjectId,
      assessment_id AS assessmentId,maximum_marks AS maximumMarks
      FROM academic_class_subject_assessment WHERE organization_id=? AND academic_session_id=?`)
      .bind(scope.organizationId, scope.session.id)
      .all(),
  ]);
  return Response.json({
    session: scope.session,
    schools: schools.results,
    classes: classes.results,
    subjects: subjects.results.map((subject) => ({
      ...subject,
      isOptional: Boolean(subject.isOptional),
    })),
    terms: terms.results,
    assessments: assessments.results,
    students: students.results,
    classSubjects: classSubjects.results,
    assessmentLimits: assessmentLimits.results,
    capabilities: { manage: hasPermission(scope, "school.results.manage") },
  });
}

async function createAcademicResultCatalog(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return forbidden();
  const parsed = resultCatalogSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return Response.json({ error: "Check the subject, term, and assessments." }, { status: 400 });
  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope || !hasPermission(scope, "school.results.manage")) return forbidden();
  const runtime = getRuntimeEnv();
  const duplicateSubject = await runtime.DATABASE.prepare(`SELECT id FROM academic_subject
    WHERE organization_id=? AND academic_session_id=? AND lower(name)=lower(?)`)
    .bind(scope.organizationId, scope.session.id, parsed.data.subject.name)
    .first<{ id: string }>();
  if (duplicateSubject)
    return Response.json(
      { error: "That subject already exists for this session." },
      { status: 409 },
    );
  const duplicateAssessmentNames = new Set<string>();
  for (const item of parsed.data.assessments) {
    const key = item.name.toLowerCase();
    if (duplicateAssessmentNames.has(key))
      return Response.json({ error: "Assessment names must be unique." }, { status: 400 });
    duplicateAssessmentNames.add(key);
  }
  const existingTerm = await runtime.DATABASE.prepare(`SELECT id FROM academic_term
    WHERE organization_id=? AND lower(name)=lower(?)`)
    .bind(scope.organizationId, parsed.data.term.name)
    .first<{ id: string }>();
  const termId = existingTerm?.id ?? crypto.randomUUID();
  const subjectId = crypto.randomUUID();
  const statements: DrizzleStatement[] = [];
  if (!existingTerm)
    statements.push(
      runtime.DATABASE.prepare(`INSERT INTO academic_term
    (id,organization_id,name,is_active,source_system,source_table,source_id)
    VALUES (?,?,?,1,'tsewa','academic_term',?)`).bind(
        termId,
        scope.organizationId,
        parsed.data.term.name,
        termId,
      ),
    );
  statements.push(
    runtime.DATABASE.prepare(`INSERT INTO academic_subject
    (id,organization_id,academic_session_id,name,short_name,is_optional,passing_percentage,
     is_active,source_system,source_table,source_id)
    VALUES (?,?,?,?,?,?,?,1,'tsewa','academic_subject',?)`).bind(
      subjectId,
      scope.organizationId,
      scope.session.id,
      parsed.data.subject.name,
      parsed.data.subject.shortName ?? null,
      parsed.data.subject.isOptional ? 1 : 0,
      parsed.data.subject.passingPercentage ?? null,
      subjectId,
    ),
  );
  const assessments = parsed.data.assessments.map((item) => ({
    id: crypto.randomUUID(),
    name: item.name,
  }));
  for (const assessment of assessments)
    statements.push(
      runtime.DATABASE.prepare(`INSERT INTO academic_assessment
    (id,organization_id,academic_session_id,term_id,name,is_active,source_system,source_table,source_id)
    VALUES (?,?,?,?,?,1,'tsewa','academic_assessment',?)`).bind(
        assessment.id,
        scope.organizationId,
        scope.session.id,
        termId,
        assessment.name,
        assessment.id,
      ),
    );
  statements.push(
    auditStatement(
      runtime.DATABASE,
      scope,
      "academic.result_catalog_created",
      "academic_subject",
      subjectId,
      {
        sessionId: scope.session.id,
        termId,
        assessmentCount: String(assessments.length),
      },
    ),
  );
  await runtime.DATABASE.batch(statements);
  return Response.json({ subjectId, termId, assessments }, { status: 201 });
}

async function createMarkSheet(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return forbidden();
  const parsed = markSheetMutationSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return Response.json({ error: "Check the mark sheet entries." }, { status: 400 });
  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope || !hasPermission(scope, "school.results.manage")) return forbidden();
  const runtime = getRuntimeEnv();
  const data = parsed.data;
  const [
    offering,
    subject,
    term,
    assessments,
    roster,
    existing,
    configuredSubjects,
    configuredLimits,
  ] = await Promise.all([
    runtime.DATABASE.prepare(`SELECT id FROM school_class_offering WHERE organization_id=?
      AND academic_session_id=? AND school_id=? AND academic_class_id=? AND is_active=1`)
      .bind(scope.organizationId, scope.session.id, data.schoolId, data.academicClassId)
      .first<{ id: string }>(),
    runtime.DATABASE.prepare(`SELECT id FROM academic_subject WHERE id=? AND organization_id=?
      AND academic_session_id=? AND is_active=1`)
      .bind(data.subjectId, scope.organizationId, scope.session.id)
      .first<{ id: string }>(),
    runtime.DATABASE.prepare(
      "SELECT id FROM academic_term WHERE id=? AND organization_id=? AND is_active=1",
    )
      .bind(data.termId, scope.organizationId)
      .first<{ id: string }>(),
    runtime.DATABASE.prepare(`SELECT id FROM academic_assessment WHERE organization_id=?
      AND academic_session_id=? AND term_id=? AND is_active=1`)
      .bind(scope.organizationId, scope.session.id, data.termId)
      .all<{ id: string }>(),
    runtime.DATABASE.prepare(`SELECT person_id AS personId FROM student_enrollment WHERE organization_id=?
      AND academic_session_id=? AND school_id=? AND academic_class_id=? AND status IN ('recorded','enrolled')`)
      .bind(scope.organizationId, scope.session.id, data.schoolId, data.academicClassId)
      .all<{ personId: string }>(),
    runtime.DATABASE.prepare(`SELECT id FROM mark_sheet WHERE organization_id=? AND academic_session_id=?
      AND school_id=? AND academic_class_id=? AND subject_id=? AND term_id=?`)
      .bind(
        scope.organizationId,
        scope.session.id,
        data.schoolId,
        data.academicClassId,
        data.subjectId,
        data.termId,
      )
      .first<{ id: string }>(),
    runtime.DATABASE.prepare(`SELECT subject_id AS subjectId FROM academic_class_subject
      WHERE organization_id=? AND academic_session_id=? AND academic_class_id=?`)
      .bind(scope.organizationId, scope.session.id, data.academicClassId)
      .all<{ subjectId: string }>(),
    runtime.DATABASE.prepare(`SELECT assessment_id AS assessmentId,maximum_marks AS maximumMarks
      FROM academic_class_subject_assessment WHERE organization_id=? AND academic_session_id=?
      AND academic_class_id=? AND subject_id=?`)
      .bind(scope.organizationId, scope.session.id, data.academicClassId, data.subjectId)
      .all<{ assessmentId: string; maximumMarks: number }>(),
  ]);
  if (!offering || !subject || !term)
    return Response.json({ error: "Choose valid result setup values." }, { status: 400 });
  if (
    configuredSubjects.results.length &&
    !configuredSubjects.results.some((row) => row.subjectId === data.subjectId)
  )
    return Response.json({ error: "That subject is not assigned to this class." }, { status: 400 });
  if (existing)
    return Response.json(
      { error: "A mark sheet already exists for this class, subject, and term.", id: existing.id },
      { status: 409 },
    );
  const assessmentIds = new Set(assessments.results.map((row) => row.id));
  const maximumByAssessment = new Map(
    configuredLimits.results
      .filter((row) => row.maximumMarks !== null)
      .map((row) => [row.assessmentId, Number(row.maximumMarks)]),
  );
  const rosterIds = new Set(roster.results.map((row) => row.personId));
  if (
    data.marks.some(
      (mark) => !assessmentIds.has(mark.assessmentId) || !rosterIds.has(mark.personId),
    )
  ) {
    return Response.json(
      { error: "A mark entry is outside the selected class or term." },
      { status: 400 },
    );
  }
  if (
    data.marks.some(
      (mark) =>
        maximumByAssessment.has(mark.assessmentId) &&
        mark.maximumMarks !== maximumByAssessment.get(mark.assessmentId),
    )
  )
    return Response.json(
      { error: "Use the configured maximum marks for this class and subject." },
      { status: 400 },
    );
  const markSheetId = crypto.randomUUID();
  const statements: DrizzleStatement[] = [
    runtime.DATABASE.prepare(`INSERT INTO mark_sheet
    (id,organization_id,academic_session_id,school_id,academic_class_id,subject_id,term_id,
     recorded_on,is_verified,status,maximum_marks,source_system,source_table,source_id,
     created_by_user_id,updated_by_user_id)
    VALUES (?,?,?,?,?,?,?,?,0,'draft',?,'tsewa','mark_sheet',?,?,?)`).bind(
      markSheetId,
      scope.organizationId,
      scope.session.id,
      data.schoolId,
      data.academicClassId,
      data.subjectId,
      data.termId,
      data.recordedOn,
      data.maximumMarks ?? null,
      markSheetId,
      scope.userId,
      scope.userId,
    ),
  ];
  for (const mark of data.marks) {
    const id = crypto.randomUUID();
    statements.push(
      runtime.DATABASE.prepare(`INSERT INTO student_mark
      (id,organization_id,mark_sheet_id,person_id,assessment_id,marks,maximum_marks,note,
       source_system,source_table,source_id,created_by_user_id,updated_by_user_id)
      VALUES (?,?,?,?,?,?,?,?,'tsewa','student_mark',?,?,?)`).bind(
        id,
        scope.organizationId,
        markSheetId,
        mark.personId,
        mark.assessmentId,
        mark.marks,
        mark.maximumMarks,
        mark.note ?? null,
        id,
        scope.userId,
        scope.userId,
      ),
    );
  }
  statements.push(
    auditStatement(
      runtime.DATABASE,
      scope,
      "academic.mark_sheet_created",
      "mark_sheet",
      markSheetId,
      {
        sessionId: scope.session.id,
        entryCount: String(data.marks.length),
      },
    ),
  );
  await runtime.DATABASE.batch(statements);
  return Response.json({ id: markSheetId, status: "draft" }, { status: 201 });
}

async function handleMarkSheet(request: Request, markSheetId: string): Promise<Response> {
  if (!z.uuid().safeParse(markSheetId).success)
    return Response.json({ error: "Invalid mark sheet." }, { status: 400 });
  if (request.method === "GET") return getMarkSheet(request, markSheetId);
  if (request.method === "PATCH") return updateMarkSheet(request, markSheetId);
  return methodNotAllowed("GET, PATCH");
}

async function getMarkSheet(request: Request, markSheetId: string): Promise<Response> {
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "school.results.read")) return forbidden();
  const runtime = getRuntimeEnv();
  const sheet = await runtime.DATABASE.prepare(`SELECT id,academic_session_id AS sessionId,
    school_id AS schoolId,academic_class_id AS academicClassId,subject_id AS subjectId,
    term_id AS termId,recorded_on AS recordedOn,maximum_marks AS maximumMarks,status,
    source_system AS sourceSystem FROM mark_sheet WHERE id=? AND organization_id=?`)
    .bind(markSheetId, context.organizationId)
    .first<{
      id: string;
      sessionId: string;
      schoolId: string;
      academicClassId: string;
      subjectId: string;
      termId: string;
      recordedOn: string | null;
      maximumMarks: number | null;
      status: string;
      sourceSystem: string;
    }>();
  if (!sheet) return Response.json({ error: "Mark sheet not found." }, { status: 404 });
  const marks = await runtime.DATABASE.prepare(`SELECT id,person_id AS personId,
    assessment_id AS assessmentId,marks,maximum_marks AS maximumMarks,note
    FROM student_mark WHERE organization_id=? AND mark_sheet_id=? AND is_active=1`)
    .bind(context.organizationId, markSheetId)
    .all<{
      id: string;
      personId: string;
      assessmentId: string;
      marks: number | null;
      maximumMarks: number | null;
      note: string | null;
    }>();
  return Response.json({
    sheet,
    marks: marks.results,
    capabilities: {
      edit:
        hasPermission(context, "school.results.manage") &&
        sheet.status === "draft" &&
        sheet.sourceSystem.toLowerCase() === "tsewa",
    },
  });
}

async function updateMarkSheet(request: Request, markSheetId: string): Promise<Response> {
  if (!isSameOrigin(request)) return forbidden();
  const parsed = markSheetMutationSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return Response.json({ error: "Check the mark sheet entries." }, { status: 400 });
  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope || !hasPermission(scope, "school.results.manage")) return forbidden();
  const runtime = getRuntimeEnv();
  const sheet = await runtime.DATABASE.prepare(`SELECT id,status,source_system AS sourceSystem,
    school_id AS schoolId,academic_class_id AS academicClassId,subject_id AS subjectId,term_id AS termId
    FROM mark_sheet WHERE id=? AND organization_id=? AND academic_session_id=?`)
    .bind(markSheetId, scope.organizationId, scope.session.id)
    .first<{
      id: string;
      status: string;
      sourceSystem: string;
      schoolId: string;
      academicClassId: string;
      subjectId: string;
      termId: string;
    }>();
  if (!sheet) return Response.json({ error: "Mark sheet not found." }, { status: 404 });
  if (sheet.sourceSystem.toLowerCase() !== "tsewa" || sheet.status !== "draft")
    return Response.json({ error: "Only Tsewa draft mark sheets can be edited." }, { status: 409 });
  const data = parsed.data;
  if (
    sheet.schoolId !== data.schoolId ||
    sheet.academicClassId !== data.academicClassId ||
    sheet.subjectId !== data.subjectId ||
    sheet.termId !== data.termId
  )
    return Response.json({ error: "A mark sheet's scope cannot be changed." }, { status: 409 });

  const [assessments, roster, currentMarks, configuredLimits] = await Promise.all([
    runtime.DATABASE.prepare(`SELECT id FROM academic_assessment WHERE organization_id=?
      AND academic_session_id=? AND term_id=? AND is_active=1`)
      .bind(scope.organizationId, scope.session.id, data.termId)
      .all<{ id: string }>(),
    runtime.DATABASE.prepare(`SELECT person_id AS personId FROM student_enrollment WHERE organization_id=?
      AND academic_session_id=? AND school_id=? AND academic_class_id=? AND status IN ('recorded','enrolled')`)
      .bind(scope.organizationId, scope.session.id, data.schoolId, data.academicClassId)
      .all<{ personId: string }>(),
    runtime.DATABASE.prepare(`SELECT id,person_id AS personId,assessment_id AS assessmentId
      FROM student_mark WHERE organization_id=? AND mark_sheet_id=? AND is_active=1`)
      .bind(scope.organizationId, markSheetId)
      .all<{ id: string; personId: string; assessmentId: string }>(),
    runtime.DATABASE.prepare(`SELECT assessment_id AS assessmentId,maximum_marks AS maximumMarks
      FROM academic_class_subject_assessment WHERE organization_id=? AND academic_session_id=?
      AND academic_class_id=? AND subject_id=?`)
      .bind(scope.organizationId, scope.session.id, data.academicClassId, data.subjectId)
      .all<{ assessmentId: string; maximumMarks: number | null }>(),
  ]);
  const assessmentIds = new Set(assessments.results.map((row) => row.id));
  const rosterIds = new Set(roster.results.map((row) => row.personId));
  if (
    data.marks.some(
      (mark) => !assessmentIds.has(mark.assessmentId) || !rosterIds.has(mark.personId),
    )
  )
    return Response.json(
      { error: "A mark entry is outside the selected class or term." },
      { status: 400 },
    );
  const configuredMaximums = new Map(
    configuredLimits.results
      .filter((item) => item.maximumMarks !== null)
      .map((item) => [item.assessmentId, Number(item.maximumMarks)]),
  );
  if (
    data.marks.some(
      (mark) =>
        configuredMaximums.has(mark.assessmentId) &&
        mark.maximumMarks !== configuredMaximums.get(mark.assessmentId),
    )
  )
    return Response.json(
      { error: "Use the configured maximum marks for this class and subject." },
      { status: 400 },
    );

  const existingByKey = new Map(
    currentMarks.results.map((mark) => [`${mark.personId}:${mark.assessmentId}`, mark]),
  );
  const submittedKeys = new Set(data.marks.map((mark) => `${mark.personId}:${mark.assessmentId}`));
  const statements: DrizzleStatement[] = [
    runtime.DATABASE.prepare(`UPDATE mark_sheet SET recorded_on=?,maximum_marks=?,updated_by_user_id=?,
      updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?`).bind(
      data.recordedOn,
      data.maximumMarks ?? null,
      scope.userId,
      markSheetId,
      scope.organizationId,
    ),
  ];
  for (const mark of data.marks) {
    const key = `${mark.personId}:${mark.assessmentId}`;
    const existing = existingByKey.get(key);
    if (existing) {
      statements.push(
        runtime.DATABASE.prepare(`UPDATE student_mark SET marks=?,maximum_marks=?,note=?,
          updated_by_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?`).bind(
          mark.marks,
          mark.maximumMarks,
          mark.note ?? null,
          scope.userId,
          existing.id,
          scope.organizationId,
        ),
      );
    } else {
      const id = crypto.randomUUID();
      statements.push(
        runtime.DATABASE.prepare(`INSERT INTO student_mark
          (id,organization_id,mark_sheet_id,person_id,assessment_id,marks,maximum_marks,note,
           source_system,source_table,source_id,created_by_user_id,updated_by_user_id)
          VALUES (?,?,?,?,?,?,?,?,'tsewa','student_mark',?,?,?)`).bind(
          id,
          scope.organizationId,
          markSheetId,
          mark.personId,
          mark.assessmentId,
          mark.marks,
          mark.maximumMarks,
          mark.note ?? null,
          id,
          scope.userId,
          scope.userId,
        ),
      );
    }
  }
  for (const mark of currentMarks.results) {
    if (submittedKeys.has(`${mark.personId}:${mark.assessmentId}`)) continue;
    statements.push(
      runtime.DATABASE.prepare(`UPDATE student_mark SET is_active=0,removed_at=CURRENT_TIMESTAMP,
        updated_by_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?`).bind(
        scope.userId,
        mark.id,
        scope.organizationId,
      ),
    );
  }
  statements.push(
    auditStatement(
      runtime.DATABASE,
      scope,
      "academic.mark_sheet_updated",
      "mark_sheet",
      markSheetId,
      {
        entryCount: String(data.marks.length),
      },
    ),
  );
  await runtime.DATABASE.batch(statements);
  return Response.json({ id: markSheetId, status: "draft" });
}

async function getAcademicResultSummaries(request: Request): Promise<Response> {
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "school.results.read")) return forbidden();
  const url = new URL(request.url);
  const parsed = resultSummaryQuerySchema.safeParse({
    sessionId: url.searchParams.get("sessionId"),
    q: url.searchParams.get("q") ?? "",
    school: url.searchParams.get("school") ?? "all",
    className: url.searchParams.get("class") ?? "all",
    subject: url.searchParams.get("subject") ?? "all",
    term: url.searchParams.get("term") ?? "all",
    page: url.searchParams.get("page") ?? "1",
    pageSize: url.searchParams.get("pageSize") ?? "25",
  });
  if (!parsed.success)
    return Response.json({ error: "Check the summary filters." }, { status: 400 });
  const { sessionId, q, school, className, subject, term, page, pageSize } = parsed.data;
  const conditions = ["sheet.organization_id=?", "sheet.academic_session_id=?", "mark.is_active=1"];
  const bindings: Array<string | number> = [context.organizationId, sessionId];
  for (const [value, column] of [
    [school, "sheet.school_id"],
    [className, "sheet.academic_class_id"],
    [subject, "sheet.subject_id"],
    [term, "sheet.term_id"],
  ] as const) {
    if (value !== "all") {
      conditions.push(`${column}=?`);
      bindings.push(value);
    }
  }
  if (q) {
    const search = `%${escapeLikePattern(q.toLowerCase())}%`;
    conditions.push(
      "(lower(person.display_name) LIKE ? ESCAPE '\\' OR lower(person.primary_identifier) LIKE ? ESCAPE '\\')",
    );
    bindings.push(search, search);
  }
  const where = conditions.join(" AND ");
  const group = `person.id,person.display_name,person.primary_identifier,school.id,school.name,
    class.id,class.name,class.title,class.level,term.id,term.name`;
  const joins = `FROM student_mark mark JOIN mark_sheet sheet ON sheet.id=mark.mark_sheet_id
    JOIN person ON person.id=mark.person_id AND person.organization_id=mark.organization_id
    JOIN school_master school ON school.id=sheet.school_id
    JOIN academic_class_master class ON class.id=sheet.academic_class_id
    JOIN academic_term term ON term.id=sheet.term_id WHERE ${where}`;
  const runtime = getRuntimeEnv();
  const [count, summaries] = await Promise.all([
    runtime.DATABASE.prepare(
      `SELECT COUNT(*) AS total FROM (SELECT person.id ${joins} GROUP BY ${group}) grouped`,
    )
      .bind(...bindings)
      .first<{ total: number }>(),
    runtime.DATABASE.prepare(`SELECT person.id AS personId,person.display_name AS studentName,
      person.primary_identifier AS admissionNumber,school.id AS schoolId,school.name AS schoolName,
      class.id AS academicClassId,${classDisplayName("class")} AS className,
      term.id AS termId,term.name AS termName,COUNT(DISTINCT sheet.subject_id) AS subjectCount,
      SUM(CASE WHEN mark.marks IS NOT NULL THEN mark.marks ELSE 0 END) AS totalMarks,
      SUM(CASE WHEN mark.marks IS NOT NULL THEN mark.maximum_marks ELSE 0 END) AS totalMaximum,
      SUM(CASE WHEN mark.marks IS NOT NULL THEN 1 ELSE 0 END) AS recordedCount,
      SUM(CASE WHEN sheet.status='draft' THEN 1 ELSE 0 END) AS draftEntries,
      SUM(CASE WHEN sheet.status<>'final' THEN 1 ELSE 0 END) AS nonFinalEntries
      ${joins} GROUP BY ${group}
      ORDER BY person.display_name COLLATE NOCASE,term.name COLLATE NOCASE LIMIT ? OFFSET ?`)
      .bind(...bindings, pageSize, (page - 1) * pageSize)
      .all<Record<string, unknown>>(),
  ]);
  const total = Number(count?.total ?? 0);
  return Response.json({
    summaries: summaries.results.map((row) => ({
      ...row,
      percentage:
        Number(row.totalMaximum) > 0
          ? (Number(row.totalMarks) / Number(row.totalMaximum)) * 100
          : null,
      publicationStatus:
        Number(row.draftEntries) > 0
          ? "draft"
          : Number(row.nonFinalEntries) > 0
            ? "verified"
            : "final",
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

async function getAcademicReportCard(request: Request): Promise<Response> {
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "school.results.read")) return forbidden();
  const url = new URL(request.url);
  const parsed = reportCardQuerySchema.safeParse({
    sessionId: url.searchParams.get("sessionId"),
    personId: url.searchParams.get("personId"),
    termId: url.searchParams.get("termId"),
  });
  if (!parsed.success)
    return Response.json({ error: "Choose a valid student, session, and term." }, { status: 400 });
  const runtime = getRuntimeEnv();
  const [organization, session, student, rows, grades] = await Promise.all([
    runtime.DATABASE.prepare("SELECT name FROM organization WHERE id=?")
      .bind(context.organizationId)
      .first<{ name: string }>(),
    runtime.DATABASE.prepare(
      "SELECT id,name,starts_on AS startsOn,ends_on AS endsOn FROM academic_session WHERE id=? AND organization_id=?",
    )
      .bind(parsed.data.sessionId, context.organizationId)
      .first<{ id: string; name: string; startsOn: string; endsOn: string }>(),
    runtime.DATABASE.prepare(`SELECT person.id AS personId,person.display_name AS studentName,
      person.primary_identifier AS admissionNumber,school.name AS schoolName,
      ${classDisplayName("class")} AS className,term.id AS termId,term.name AS termName
      FROM student_mark mark JOIN mark_sheet sheet ON sheet.id=mark.mark_sheet_id
      JOIN person ON person.id=mark.person_id JOIN school_master school ON school.id=sheet.school_id
      JOIN academic_class_master class ON class.id=sheet.academic_class_id
      JOIN academic_term term ON term.id=sheet.term_id
      WHERE mark.organization_id=? AND mark.person_id=? AND sheet.academic_session_id=?
        AND sheet.term_id=? AND mark.is_active=1 LIMIT 1`)
      .bind(context.organizationId, parsed.data.personId, parsed.data.sessionId, parsed.data.termId)
      .first<Record<string, unknown>>(),
    runtime.DATABASE.prepare(`SELECT subject.id AS subjectId,subject.name AS subjectName,
      subject.grade_type_id AS gradeTypeId,subject.passing_percentage AS passingPercentage,assessment.id AS assessmentId,
      assessment.name AS assessmentName,mark.marks,mark.maximum_marks AS maximumMarks,
      mark.note,sheet.status,sheet.source_system AS sourceSystem
      FROM student_mark mark JOIN mark_sheet sheet ON sheet.id=mark.mark_sheet_id
      JOIN academic_subject subject ON subject.id=sheet.subject_id
      JOIN academic_assessment assessment ON assessment.id=mark.assessment_id
      WHERE mark.organization_id=? AND mark.person_id=? AND sheet.academic_session_id=?
        AND sheet.term_id=? AND mark.is_active=1
      ORDER BY subject.name COLLATE NOCASE,assessment.name COLLATE NOCASE`)
      .bind(context.organizationId, parsed.data.personId, parsed.data.sessionId, parsed.data.termId)
      .all<Record<string, unknown>>(),
    runtime.DATABASE.prepare(`SELECT grade.grade_type_id AS gradeTypeId,grade.name,
      grade.starts_at AS startsAt,grade.ends_at AS endsAt FROM academic_grade grade
      JOIN academic_grade_type type ON type.id=grade.grade_type_id
      WHERE grade.organization_id=? AND type.academic_session_id=? ORDER BY grade.starts_at DESC`)
      .bind(context.organizationId, parsed.data.sessionId)
      .all(),
  ]);
  if (!session || !student || !rows.results.length)
    return Response.json(
      { error: "No result card was found for that selection." },
      { status: 404 },
    );
  return Response.json({
    generatedAt: new Date().toISOString(),
    organizationName: organization?.name ?? "School",
    session,
    student,
    results: rows.results,
    grades: grades.results,
  });
}

async function handleScholarships(request: Request): Promise<Response> {
  if (request.method === "GET") return getScholarships(request);
  if (request.method === "POST") return createScholarship(request);
  return methodNotAllowed("GET, POST");
}

async function getScholarshipReport(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "scholarship.read")) return forbidden();
  const url = new URL(request.url);
  const parsed = scholarshipReportQuerySchema.safeParse({
    report: url.searchParams.get("report"),
    session: url.searchParams.get("session") ?? "all",
  });
  if (!parsed.success)
    return Response.json({ error: "Choose a valid scholarship report." }, { status: 400 });
  const { report, session } = parsed.data;
  const runtime = getRuntimeEnv();
  const sessionCondition = session === "all" ? "" : " AND record.academic_session_id=?";
  const bindings = session === "all" ? [context.organizationId] : [context.organizationId, session];
  const sessionRow =
    session === "all"
      ? null
      : await runtime.DATABASE.prepare(
          "SELECT name FROM academic_session WHERE id=? AND organization_id=?",
        )
          .bind(session, context.organizationId)
          .first<{ name: string }>();
  if (session !== "all" && !sessionRow)
    return Response.json({ error: "Academic session not found." }, { status: 404 });

  let title = "Scholarship students";
  let columns: Array<{ key: string; label: string; numeric?: boolean }> = [];
  let rows: Record<string, unknown>[] = [];
  if (report === "ledger") {
    title = "Scholarship ledger";
    columns = [
      { key: "sanctionedOn", label: "Date" },
      { key: "studentName", label: "Student" },
      { key: "admissionNumber", label: "Admission no." },
      { key: "courseName", label: "Course" },
      { key: "headName", label: "Head" },
      { key: "cityName", label: "City" },
      { key: "amount", label: "Amount", numeric: true },
      { key: "paymentReference", label: "Payment ref." },
    ];
    const ledgerCondition = session === "all" ? "" : " AND sanction.academic_session_id=?";
    const result = await runtime.DATABASE.prepare(`SELECT sanction.sanctioned_on AS sanctionedOn,
      record.student_name AS studentName,record.admission_number AS admissionNumber,course.name AS courseName,
      head.name AS headName,line.city_name AS cityName,line.amount,sanction.payment_reference AS paymentReference
      FROM scholarship_sanction_line line JOIN scholarship_sanction sanction ON sanction.id=line.sanction_id
      JOIN scholarship_record record ON record.id=sanction.scholarship_id
      LEFT JOIN scholarship_course course ON course.id=record.course_id
      JOIN scholarship_head head ON head.id=line.head_id
      WHERE sanction.organization_id=?${ledgerCondition}
      ORDER BY sanction.sanctioned_on,record.student_name COLLATE NOCASE,head.name COLLATE NOCASE`)
      .bind(...bindings)
      .all<Record<string, unknown>>();
    rows = result.results;
  } else if (report === "placeWise") {
    title = "Scholarship students · place-wise";
    columns = [
      { key: "cityName", label: "Place" },
      { key: "students", label: "Students", numeric: true },
      { key: "awardedAmount", label: "Awarded", numeric: true },
      { key: "sanctionedAmount", label: "Sanctioned", numeric: true },
    ];
    const result =
      await runtime.DATABASE.prepare(`SELECT coalesce(record.city_name,'Not recorded') AS cityName,
      COUNT(*) AS students,coalesce(SUM(record.scholarship_awarded),0) AS awardedAmount,
      coalesce(SUM((SELECT SUM(amount) FROM scholarship_sanction sanction WHERE sanction.scholarship_id=record.id)),0) AS sanctionedAmount
      FROM scholarship_record record WHERE record.organization_id=?${sessionCondition}
      GROUP BY coalesce(record.city_name,'Not recorded') ORDER BY students DESC,cityName COLLATE NOCASE`)
        .bind(...bindings)
        .all<Record<string, unknown>>();
    rows = result.results;
  } else if (report === "yearWise") {
    title = "Scholarship students · year-wise";
    columns = [
      { key: "courseCategory", label: "Category" },
      { key: "courseName", label: "Course" },
      { key: "studyYear", label: "Study year" },
      { key: "students", label: "Students", numeric: true },
    ];
    const result =
      await runtime.DATABASE.prepare(`SELECT coalesce(category.name,'Uncategorised') AS courseCategory,
      coalesce(course.name,'Course not recorded') AS courseName,
      coalesce((SELECT annual.study_year FROM scholarship_annual_detail annual
        WHERE annual.scholarship_id=record.id ORDER BY annual.created_at DESC,annual.id DESC LIMIT 1),'Not recorded') AS studyYear,
      COUNT(*) AS students FROM scholarship_record record
      LEFT JOIN scholarship_course course ON course.id=record.course_id
      LEFT JOIN scholarship_course_category category ON category.id=course.category_id
      WHERE record.organization_id=?${sessionCondition}
      GROUP BY courseCategory,courseName,studyYear
      ORDER BY courseCategory COLLATE NOCASE,courseName COLLATE NOCASE,studyYear COLLATE NOCASE`)
        .bind(...bindings)
        .all<Record<string, unknown>>();
    rows = result.results;
  } else {
    const extraCondition =
      report === "courseCompleted"
        ? " AND record.status='closed' AND lower(coalesce(record.reason,''))='course completed'"
        : "";
    title =
      report === "courseCompleted"
        ? "Scholarship students · course completed"
        : report === "newStudents"
          ? "New scholarship students"
          : "Scholarship students";
    columns = [
      { key: "studentName", label: "Student" },
      { key: "admissionNumber", label: "Admission no." },
      { key: "courseName", label: "Course" },
      { key: "instituteName", label: "Institute" },
      { key: "cityName", label: "City" },
      { key: "status", label: "Status" },
      { key: "scholarshipAwarded", label: "Awarded", numeric: true },
    ];
    const result = await runtime.DATABASE.prepare(`SELECT record.student_name AS studentName,
      record.admission_number AS admissionNumber,course.name AS courseName,record.institute_name AS instituteName,
      record.city_name AS cityName,record.status,record.scholarship_awarded AS scholarshipAwarded
      FROM scholarship_record record LEFT JOIN scholarship_course course ON course.id=record.course_id
      WHERE record.organization_id=?${sessionCondition}${extraCondition}
      ORDER BY record.student_name COLLATE NOCASE`)
      .bind(...bindings)
      .all<Record<string, unknown>>();
    rows = result.results;
  }
  return Response.json({
    generatedAt: new Date().toISOString(),
    report,
    title,
    sessionName: sessionRow?.name ?? "All sessions",
    columns,
    rows,
  });
}

async function getScholarships(request: Request): Promise<Response> {
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "scholarship.read")) return forbidden();
  const url = new URL(request.url);
  const parsed = scholarshipListQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    status: url.searchParams.get("status") ?? "all",
    course: url.searchParams.get("course") ?? "all",
    page: url.searchParams.get("page") ?? "1",
    pageSize: url.searchParams.get("pageSize") ?? "25",
  });
  if (!parsed.success)
    return Response.json({ error: "Check the scholarship filters." }, { status: 400 });
  const { q, status, course, page, pageSize } = parsed.data;
  const conditions = ["record.organization_id=?"];
  const bindings: Array<string | number> = [context.organizationId];
  if (status !== "all") {
    conditions.push("record.status=?");
    bindings.push(status);
  }
  if (course !== "all") {
    conditions.push("record.course_id=?");
    bindings.push(course);
  }
  if (q) {
    const search = `%${escapeLikePattern(q.toLowerCase())}%`;
    conditions.push(
      "(lower(record.student_name) LIKE ? ESCAPE '\\' OR lower(coalesce(record.admission_number,'')) LIKE ? ESCAPE '\\' OR lower(coalesce(record.institute_name,'')) LIKE ? ESCAPE '\\')",
    );
    bindings.push(search, search, search);
  }
  const where = conditions.join(" AND ");
  const runtime = getRuntimeEnv();
  const [count, summary, rows] = await Promise.all([
    runtime.DATABASE.prepare(`SELECT COUNT(*) total FROM scholarship_record record WHERE ${where}`)
      .bind(...bindings)
      .first<{ total: number }>(),
    runtime.DATABASE.prepare(`SELECT COUNT(*) scholarships,SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) active,
      (SELECT COUNT(*) FROM scholarship_sanction WHERE organization_id=?) sanctions,
      (SELECT SUM(amount) FROM scholarship_sanction WHERE organization_id=?) sanctionedAmount
      FROM scholarship_record WHERE organization_id=?`)
      .bind(context.organizationId, context.organizationId, context.organizationId)
      .first<Record<string, unknown>>(),
    runtime.DATABASE.prepare(`SELECT record.id,record.person_id AS personId,record.student_name AS studentName,
      record.admission_number AS admissionNumber,record.beneficiary_category AS beneficiaryCategory,
      record.institute_name AS instituteName,record.city_name AS cityName,record.status,
      record.admission_year AS admissionYear,record.course_duration AS courseDuration,
      course.name AS courseName,category.name AS courseCategory,
      (SELECT COUNT(*) FROM scholarship_annual_detail annual WHERE annual.scholarship_id=record.id) AS annualDetailCount,
      (SELECT COUNT(*) FROM scholarship_sanction sanction WHERE sanction.scholarship_id=record.id) AS sanctionCount,
      (SELECT coalesce(SUM(amount),0) FROM scholarship_sanction sanction WHERE sanction.scholarship_id=record.id) AS sanctionedAmount,
      (SELECT MAX(sanctioned_on) FROM scholarship_sanction sanction WHERE sanction.scholarship_id=record.id) AS lastSanctionOn
      FROM scholarship_record record LEFT JOIN scholarship_course course ON course.id=record.course_id
      LEFT JOIN scholarship_course_category category ON category.id=course.category_id
      WHERE ${where}
      ORDER BY record.student_name COLLATE NOCASE LIMIT ? OFFSET ?`)
      .bind(...bindings, pageSize, (page - 1) * pageSize)
      .all<Record<string, unknown>>(),
  ]);
  const total = Number(count?.total ?? 0);
  return Response.json({
    summary: {
      scholarships: Number(summary?.scholarships ?? 0),
      active: Number(summary?.active ?? 0),
      sanctions: Number(summary?.sanctions ?? 0),
      sanctionedAmount: Number(summary?.sanctionedAmount ?? 0),
    },
    scholarships: rows.results,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    capabilities: { manage: hasPermission(context, "scholarship.manage") },
  });
}

async function createScholarship(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "scholarship.manage")) return forbidden();
  const parsed = scholarshipRecordSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return Response.json({ error: "Check the scholarship record." }, { status: 400 });
  const runtime = getRuntimeEnv();
  if (!(await validScholarshipReferences(runtime.DATABASE, context.organizationId, parsed.data)))
    return Response.json({ error: "Choose a valid person, session, and course." }, { status: 400 });
  const id = crypto.randomUUID();
  await runtime.DATABASE.batch([
    scholarshipRecordWrite(runtime.DATABASE, "insert", context, id, parsed.data),
    auditStatement(
      runtime.DATABASE,
      context,
      "scholarship.record_created",
      "scholarship_record",
      id,
    ),
  ]);
  return Response.json({ id }, { status: 201 });
}

async function handleScholarshipRecord(request: Request, scholarshipId: string): Promise<Response> {
  if (!z.uuid().safeParse(scholarshipId).success)
    return Response.json({ error: "Invalid scholarship record." }, { status: 400 });
  if (request.method === "GET") return getScholarshipRecord(request, scholarshipId);
  if (request.method === "PATCH") return updateScholarshipRecord(request, scholarshipId);
  return methodNotAllowed("GET, PATCH");
}

async function getScholarshipRecord(request: Request, scholarshipId: string): Promise<Response> {
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "scholarship.read")) return forbidden();
  const runtime = getRuntimeEnv();
  const record =
    await runtime.DATABASE.prepare(`SELECT record.*,record.organization_id AS organizationId,
    record.person_id AS personId,record.academic_session_id AS sessionId,record.course_id AS courseId,
    record.beneficiary_category AS beneficiaryCategory,record.student_name AS studentName,
    record.admission_number AS admissionNumber,record.father_name AS fatherName,record.date_of_birth AS dateOfBirth,
    record.class_stream AS classStream,record.class_percentage AS classPercentage,record.admission_year AS admissionYear,
    record.course_duration AS courseDuration,record.college_training AS collegeTraining,record.city_name AS cityName,
    record.permanent_address AS permanentAddress,record.mailing_address AS mailingAddress,
    record.special_allowance AS specialAllowance,record.scholarship_awarded AS scholarshipAwarded,
    record.institute_name AS instituteName,record.bank_account_number AS bankAccountNumber,
    record.ward_health_record AS wardHealthRecord,record.needy_case AS needyCase,
    record.ledger_number AS ledgerNumber,course.name AS courseName,category.name AS courseCategory
    FROM scholarship_record record LEFT JOIN scholarship_course course ON course.id=record.course_id
    LEFT JOIN scholarship_course_category category ON category.id=course.category_id
    WHERE record.id=? AND record.organization_id=?`)
      .bind(scholarshipId, context.organizationId)
      .first<Record<string, unknown>>();
  if (!record) return Response.json({ error: "Scholarship record not found." }, { status: 404 });
  const [annual, sanctions] = await Promise.all([
    runtime.DATABASE.prepare(
      `SELECT id,academic_session_id AS sessionId,study_year AS studyYear,passed,percentage,division,fees,remarks,source_system AS sourceSystem FROM scholarship_annual_detail WHERE organization_id=? AND scholarship_id=? ORDER BY study_year,created_at`,
    )
      .bind(context.organizationId, scholarshipId)
      .all<Record<string, unknown>>(),
    runtime.DATABASE.prepare(`SELECT sanction.id,sanction.academic_session_id AS sessionId,sanction.amount,
      sanction.sanctioned_on AS sanctionedOn,sanction.period_from AS periodFrom,sanction.period_to AS periodTo,
      sanction.payment_reference AS paymentReference,sanction.in_favour_of AS inFavourOf,sanction.remarks,
      sanction.source_system AS sourceSystem,json_group_array(json_object('id',line.id,'headId',head.id,
      'headName',head.name,'cityName',line.city_name,'amount',line.amount,'advanceOn',line.advance_on)) AS linesJson
      FROM scholarship_sanction sanction LEFT JOIN scholarship_sanction_line line ON line.sanction_id=sanction.id
      LEFT JOIN scholarship_head head ON head.id=line.head_id WHERE sanction.organization_id=? AND sanction.scholarship_id=?
      GROUP BY sanction.id ORDER BY sanction.sanctioned_on DESC`)
      .bind(context.organizationId, scholarshipId)
      .all<Record<string, unknown>>(),
  ]);
  return Response.json({
    record: {
      ...record,
      collegeTraining: Boolean(record.collegeTraining),
      specialAllowance: Boolean(record.specialAllowance),
    },
    annualDetails: annual.results.map((item) => ({ ...item, passed: Boolean(item.passed) })),
    sanctions: sanctions.results.map((item) => ({
      ...item,
      lines: JSON.parse(String(item.linesJson)),
    })),
    capabilities: { manage: hasPermission(context, "scholarship.manage") },
  });
}

async function updateScholarshipRecord(request: Request, scholarshipId: string): Promise<Response> {
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "scholarship.manage")) return forbidden();
  const parsed = scholarshipActionSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return Response.json({ error: "Check the scholarship changes." }, { status: 400 });
  const runtime = getRuntimeEnv();
  const exists = await runtime.DATABASE.prepare(
    "SELECT id,person_id AS personId FROM scholarship_record WHERE id=? AND organization_id=?",
  )
    .bind(scholarshipId, context.organizationId)
    .first<{ id: string; personId: string | null }>();
  if (!exists) return Response.json({ error: "Scholarship record not found." }, { status: 404 });
  if (parsed.data.action === "record") {
    if (
      !(await validScholarshipReferences(
        runtime.DATABASE,
        context.organizationId,
        parsed.data.value,
      ))
    )
      return Response.json(
        { error: "Choose a valid person, session, and course." },
        { status: 400 },
      );
    await runtime.DATABASE.batch([
      scholarshipRecordWrite(runtime.DATABASE, "update", context, scholarshipId, parsed.data.value),
      auditStatement(
        runtime.DATABASE,
        context,
        "scholarship.record_updated",
        "scholarship_record",
        scholarshipId,
      ),
    ]);
  } else if (parsed.data.action === "annual") {
    const value = parsed.data.value;
    if (
      value.sessionId &&
      !(await scholarshipSessionExists(runtime.DATABASE, context.organizationId, value.sessionId))
    )
      return Response.json({ error: "Choose a valid academic session." }, { status: 400 });
    const id = value.id ?? crypto.randomUUID();
    const existing = value.id
      ? await runtime.DATABASE.prepare(
          "SELECT id FROM scholarship_annual_detail WHERE id=? AND organization_id=? AND scholarship_id=?",
        )
          .bind(value.id, context.organizationId, scholarshipId)
          .first()
      : null;
    if (value.id && !existing)
      return Response.json({ error: "Annual detail not found." }, { status: 404 });
    const statement = existing
      ? runtime.DATABASE.prepare(
          `UPDATE scholarship_annual_detail SET academic_session_id=?,study_year=?,passed=?,percentage=?,division=?,fees=?,remarks=?,updated_by_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?`,
        ).bind(
          value.sessionId ?? null,
          value.studyYear,
          value.passed ? 1 : 0,
          value.percentage ?? null,
          value.division ?? null,
          value.fees ?? null,
          value.remarks ?? null,
          context.userId,
          id,
          context.organizationId,
        )
      : runtime.DATABASE.prepare(
          `INSERT INTO scholarship_annual_detail (id,organization_id,scholarship_id,academic_session_id,study_year,passed,percentage,division,fees,remarks,source_system,source_table,source_id,created_by_user_id,updated_by_user_id) VALUES (?,?,?,?,?,?,?,?,?,?,'tsewa','scholarship_annual_detail',?,?,?)`,
        ).bind(
          id,
          context.organizationId,
          scholarshipId,
          value.sessionId ?? null,
          value.studyYear,
          value.passed ? 1 : 0,
          value.percentage ?? null,
          value.division ?? null,
          value.fees ?? null,
          value.remarks ?? null,
          id,
          context.userId,
          context.userId,
        );
    await runtime.DATABASE.batch([
      statement,
      auditStatement(
        runtime.DATABASE,
        context,
        existing ? "scholarship.annual_updated" : "scholarship.annual_created",
        "scholarship_annual_detail",
        id,
        { scholarshipId },
      ),
    ]);
  } else {
    const value = parsed.data.value;
    if (
      value.sessionId &&
      !(await scholarshipSessionExists(runtime.DATABASE, context.organizationId, value.sessionId))
    )
      return Response.json({ error: "Choose a valid academic session." }, { status: 400 });
    const headRows = await runtime.DATABASE.prepare(
      "SELECT id FROM scholarship_head WHERE organization_id=? AND is_active=1",
    )
      .bind(context.organizationId)
      .all<{ id: string }>();
    const headIds = new Set(headRows.results.map((item) => item.id));
    if (value.lines.some((line) => !headIds.has(line.headId)))
      return Response.json({ error: "Choose valid scholarship heads." }, { status: 400 });
    const id = value.id ?? crypto.randomUUID();
    const existing = value.id
      ? await runtime.DATABASE.prepare(
          "SELECT id FROM scholarship_sanction WHERE id=? AND organization_id=? AND scholarship_id=?",
        )
          .bind(value.id, context.organizationId, scholarshipId)
          .first()
      : null;
    if (value.id && !existing)
      return Response.json({ error: "Sanction not found." }, { status: 404 });
    const statements: DrizzleStatement[] = [
      existing
        ? runtime.DATABASE.prepare(
            `UPDATE scholarship_sanction SET academic_session_id=?,amount=?,sanctioned_on=?,period_from=?,period_to=?,payment_reference=?,in_favour_of=?,remarks=?,updated_by_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?`,
          ).bind(
            value.sessionId ?? null,
            value.amount,
            value.sanctionedOn,
            value.periodFrom ?? null,
            value.periodTo ?? null,
            value.paymentReference ?? null,
            value.inFavourOf ?? null,
            value.remarks ?? null,
            context.userId,
            id,
            context.organizationId,
          )
        : runtime.DATABASE.prepare(
            `INSERT INTO scholarship_sanction (id,organization_id,scholarship_id,academic_session_id,amount,sanctioned_on,period_from,period_to,payment_reference,in_favour_of,remarks,source_system,source_table,source_id,created_by_user_id,updated_by_user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,'tsewa','scholarship_sanction',?,?,?)`,
          ).bind(
            id,
            context.organizationId,
            scholarshipId,
            value.sessionId ?? null,
            value.amount,
            value.sanctionedOn,
            value.periodFrom ?? null,
            value.periodTo ?? null,
            value.paymentReference ?? null,
            value.inFavourOf ?? null,
            value.remarks ?? null,
            id,
            context.userId,
            context.userId,
          ),
    ];
    if (existing)
      statements.push(
        runtime.DATABASE.prepare(
          "DELETE FROM scholarship_sanction_line WHERE organization_id=? AND sanction_id=?",
        ).bind(context.organizationId, id),
      );
    for (const line of value.lines) {
      const lineId = crypto.randomUUID();
      statements.push(
        runtime.DATABASE.prepare(
          `INSERT INTO scholarship_sanction_line (id,organization_id,sanction_id,scholarship_id,person_id,head_id,city_name,amount,advance_on,source_system,source_table,source_id,created_by_user_id,updated_by_user_id) VALUES (?,?,?,?,?,?,?,?,?,'tsewa','scholarship_sanction_line',?,?,?)`,
        ).bind(
          lineId,
          context.organizationId,
          id,
          scholarshipId,
          exists.personId,
          line.headId,
          line.cityName ?? null,
          line.amount,
          line.advanceOn ?? null,
          lineId,
          context.userId,
          context.userId,
        ),
      );
    }
    statements.push(
      auditStatement(
        runtime.DATABASE,
        context,
        existing ? "scholarship.sanction_updated" : "scholarship.sanction_created",
        "scholarship_sanction",
        id,
        { scholarshipId, lineCount: String(value.lines.length) },
      ),
    );
    await runtime.DATABASE.batch(statements);
  }
  return Response.json({ id: scholarshipId });
}

async function handleScholarshipSetup(request: Request): Promise<Response> {
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "scholarship.read")) return forbidden();
  const runtime = getRuntimeEnv();
  if (request.method === "GET") {
    const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
    const search = `%${escapeLikePattern(q.toLowerCase())}%`;
    const [categories, courses, heads, limits, advances, sessions, people] = await Promise.all([
      runtime.DATABASE.prepare(
        "SELECT id,name,is_active AS isActive FROM scholarship_course_category WHERE organization_id=? ORDER BY name COLLATE NOCASE",
      )
        .bind(context.organizationId)
        .all(),
      runtime.DATABASE.prepare(
        "SELECT id,category_id AS categoryId,name,is_active AS isActive FROM scholarship_course WHERE organization_id=? ORDER BY name COLLATE NOCASE",
      )
        .bind(context.organizationId)
        .all(),
      runtime.DATABASE.prepare(
        "SELECT id,name,is_active AS isActive FROM scholarship_head WHERE organization_id=? ORDER BY name COLLATE NOCASE",
      )
        .bind(context.organizationId)
        .all(),
      runtime.DATABASE.prepare(
        "SELECT id,course_group AS courseGroup,head_name AS headName,amount,is_active AS isActive FROM scholarship_limit WHERE organization_id=? ORDER BY course_group,head_name",
      )
        .bind(context.organizationId)
        .all(),
      runtime.DATABASE.prepare(
        "SELECT id,academic_session_id AS sessionId,city_name AS cityName,amount FROM scholarship_city_advance WHERE organization_id=? ORDER BY city_name",
      )
        .bind(context.organizationId)
        .all(),
      runtime.DATABASE.prepare(
        "SELECT id,name FROM academic_session WHERE organization_id=? ORDER BY starts_on DESC",
      )
        .bind(context.organizationId)
        .all(),
      runtime.DATABASE.prepare(
        `SELECT id,display_name AS name,primary_identifier AS admissionNumber FROM person WHERE organization_id=? AND status='active' AND (?='' OR lower(display_name) LIKE ? ESCAPE '\\' OR lower(primary_identifier) LIKE ? ESCAPE '\\') ORDER BY display_name COLLATE NOCASE LIMIT 30`,
      )
        .bind(context.organizationId, q, search, search)
        .all(),
    ]);
    return Response.json({
      categories: categories.results,
      courses: courses.results,
      heads: heads.results,
      limits: limits.results,
      cityAdvances: advances.results,
      sessions: sessions.results,
      people: people.results,
      capabilities: { manage: hasPermission(context, "scholarship.manage") },
    });
  }
  if (request.method !== "POST") return methodNotAllowed("GET, POST");
  if (!isSameOrigin(request) || !hasPermission(context, "scholarship.manage")) return forbidden();
  const parsed = scholarshipSetupSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return Response.json({ error: "Check the scholarship setup values." }, { status: 400 });
  const value = parsed.data;
  if (value.kind === "course" && value.categoryId) {
    const category = await runtime.DATABASE.prepare(
      "SELECT id FROM scholarship_course_category WHERE id=? AND organization_id=?",
    )
      .bind(value.categoryId, context.organizationId)
      .first();
    if (!category)
      return Response.json({ error: "Choose a valid course category." }, { status: 400 });
  }
  if (
    value.kind === "cityAdvance" &&
    value.sessionId &&
    !(await scholarshipSessionExists(runtime.DATABASE, context.organizationId, value.sessionId))
  )
    return Response.json({ error: "Choose a valid academic session." }, { status: 400 });
  const id = value.id ?? crypto.randomUUID();
  const map =
    value.kind === "courseCategory"
      ? { table: "scholarship_course_category", columns: ["name"], values: [value.name] }
      : value.kind === "course"
        ? {
            table: "scholarship_course",
            columns: ["category_id", "name"],
            values: [value.categoryId ?? null, value.name],
          }
        : value.kind === "head"
          ? { table: "scholarship_head", columns: ["name"], values: [value.name] }
          : value.kind === "limit"
            ? {
                table: "scholarship_limit",
                columns: ["course_group", "head_name", "amount"],
                values: [value.courseGroup, value.headName, value.amount ?? null],
              }
            : {
                table: "scholarship_city_advance",
                columns: ["academic_session_id", "city_name", "amount"],
                values: [value.sessionId ?? null, value.cityName, value.amount],
              };
  const existing = value.id
    ? await runtime.DATABASE.prepare(`SELECT id FROM ${map.table} WHERE id=? AND organization_id=?`)
        .bind(value.id, context.organizationId)
        .first()
    : null;
  if (value.id && !existing)
    return Response.json({ error: "Setup record not found." }, { status: 404 });
  const statement = existing
    ? runtime.DATABASE.prepare(
        `UPDATE ${map.table} SET ${map.columns.map((column) => `${column}=?`).join(",")},updated_by_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?`,
      ).bind(...map.values, context.userId, id, context.organizationId)
    : runtime.DATABASE.prepare(
        `INSERT INTO ${map.table} (id,organization_id,${map.columns.join(",")},source_system,source_table,source_id,created_by_user_id,updated_by_user_id) VALUES (?,?${map.columns.map(() => ",?").join("")},'tsewa',?,?,?,?)`,
      ).bind(
        id,
        context.organizationId,
        ...map.values,
        map.table,
        id,
        context.userId,
        context.userId,
      );
  await runtime.DATABASE.batch([
    statement,
    auditStatement(
      runtime.DATABASE,
      context,
      `scholarship.${value.kind}_${existing ? "updated" : "created"}`,
      map.table,
      id,
    ),
  ]);
  return Response.json({ id }, { status: existing ? 200 : 201 });
}

async function handleSponsorship(request: Request): Promise<Response> {
  if (request.method === "GET") return getSponsorshipRecords(request);
  if (request.method === "POST") return writeSponsorshipRecord(request);
  return methodNotAllowed("GET, POST");
}

async function getSponsorshipReport(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "sponsorship.read")) return forbidden();
  const url = new URL(request.url);
  const parsed = sponsorshipReportQuerySchema.safeParse({
    report: url.searchParams.get("report"),
    session: url.searchParams.get("session") ?? "all",
  });
  if (!parsed.success)
    return Response.json({ error: "Choose a valid sponsorship report." }, { status: 400 });
  const { report, session } = parsed.data;
  const runtime = getRuntimeEnv();
  const sessionRow =
    session === "all"
      ? null
      : await runtime.DATABASE.prepare(
          "SELECT name FROM academic_session WHERE id=? AND organization_id=?",
        )
          .bind(session, context.organizationId)
          .first<{ name: string }>();
  if (session !== "all" && !sessionRow)
    return Response.json({ error: "Academic session not found." }, { status: 404 });

  let title = "Sponsors list";
  let columns: Array<{ key: string; label: string; numeric?: boolean }> = [];
  let rows: Record<string, unknown>[] = [];
  if (report === "homeWise" || report === "organizationWise") {
    const byHome = report === "homeWise";
    title = byHome ? "Sponsor list · home-wise" : "Sponsor list · organisation-wise";
    columns = [
      { key: byHome ? "homeName" : "organizationName", label: byHome ? "Home" : "Organisation" },
      { key: "beneficiaries", label: "Beneficiaries", numeric: true },
      { key: "sponsors", label: "Sponsors", numeric: true },
      { key: "approved", label: "Approved", numeric: true },
      { key: "latestStatusOn", label: "Latest status date" },
    ];
    const groupExpression = byHome
      ? "coalesce(placement.home_name,'No current home')"
      : "coalesce(parent.name,'Independent sponsors')";
    const sessionCondition = session === "all" ? "" : " AND assignment.academic_session_id=?";
    const bindings =
      session === "all" ? [context.organizationId] : [context.organizationId, session];
    const result =
      await runtime.DATABASE.prepare(`SELECT ${groupExpression} AS ${byHome ? "homeName" : "organizationName"},
      COUNT(DISTINCT assignment.person_id) AS beneficiaries,
      COUNT(DISTINCT assignment.sponsor_individual_id) AS sponsors,
      SUM(CASE WHEN lower(status.name)='approved' THEN 1 ELSE 0 END) AS approved,
      MAX(assignment.status_on) AS latestStatusOn
      FROM sponsorship_assignment assignment
      JOIN sponsorship_individual sponsor ON sponsor.id=assignment.sponsor_individual_id
      JOIN sponsorship_status status ON status.id=assignment.sponsorship_status_id
      LEFT JOIN sponsorship_organization parent ON parent.id=sponsor.sponsor_organization_id
      LEFT JOIN person_placement placement ON placement.person_id=assignment.person_id
        AND placement.organization_id=assignment.organization_id AND placement.is_current=1
      WHERE assignment.organization_id=?${sessionCondition}
      GROUP BY ${groupExpression} ORDER BY beneficiaries DESC,1 COLLATE NOCASE`)
        .bind(...bindings)
        .all<Record<string, unknown>>();
    rows = result.results;
  } else if (report === "addresses" || report === "sponsors") {
    title = report === "addresses" ? "Address of sponsors" : "Sponsors list";
    columns = [
      { key: "sponsorName", label: "Sponsor" },
      { key: "organizationName", label: "Organisation" },
      { key: "categoryName", label: "Category" },
      { key: "address", label: "Address" },
      { key: "countryName", label: "Country" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "beneficiaries", label: "Beneficiaries", numeric: true },
    ];
    const result = await runtime.DATABASE.prepare(`SELECT sponsor.display_name AS sponsorName,
      parent.name AS organizationName,category.name AS categoryName,sponsor.address,
      sponsor.country_name AS countryName,sponsor.email,sponsor.phone,
      (SELECT COUNT(*) FROM sponsorship_assignment assignment
        WHERE assignment.sponsor_individual_id=sponsor.id) AS beneficiaries
      FROM sponsorship_individual sponsor
      LEFT JOIN sponsorship_organization parent ON parent.id=sponsor.sponsor_organization_id
      LEFT JOIN sponsorship_sponsor_category category ON category.id=sponsor.sponsor_category_id
      WHERE sponsor.organization_id=? ORDER BY sponsor.display_name COLLATE NOCASE`)
      .bind(context.organizationId)
      .all<Record<string, unknown>>();
    rows = result.results;
  } else if (
    report === "completionElderly" ||
    report === "completionStudent" ||
    report === "caseHistoryStudent" ||
    report === "caseHistoryElderly"
  ) {
    const elderly = report === "completionElderly" || report === "caseHistoryElderly";
    const caseHistory = report === "caseHistoryStudent" || report === "caseHistoryElderly";
    title = `${caseHistory ? "Case history" : "Completion report"} · ${elderly ? "elderly" : "student"}`;
    columns = [
      { key: "beneficiaryName", label: "Beneficiary" },
      { key: "identifier", label: "Identifier" },
      { key: "homeName", label: "Home" },
      { key: "sponsorName", label: "Sponsor" },
      { key: "statusName", label: "Sponsorship status" },
      { key: "statusOn", label: "Status date" },
      { key: "remarks", label: "Remarks" },
    ];
    const sessionCondition = session === "all" ? "" : " AND assignment.academic_session_id=?";
    const bindings =
      session === "all"
        ? [context.organizationId, elderly ? "elderly" : "child"]
        : [context.organizationId, elderly ? "elderly" : "child", session];
    const completionCondition = caseHistory
      ? ""
      : " AND lower(status.name) IN ('discontinued','rejected','continued')";
    const result = await runtime.DATABASE.prepare(`SELECT person.display_name AS beneficiaryName,
      person.primary_identifier AS identifier,placement.home_name AS homeName,
      sponsor.display_name AS sponsorName,status.name AS statusName,
      assignment.status_on AS statusOn,assignment.remarks
      FROM sponsorship_assignment assignment JOIN person ON person.id=assignment.person_id
      JOIN sponsorship_individual sponsor ON sponsor.id=assignment.sponsor_individual_id
      JOIN sponsorship_status status ON status.id=assignment.sponsorship_status_id
      LEFT JOIN person_placement placement ON placement.person_id=person.id
        AND placement.organization_id=person.organization_id AND placement.is_current=1
      WHERE assignment.organization_id=? AND person.kind=?${sessionCondition}${completionCondition}
      ORDER BY person.display_name COLLATE NOCASE,assignment.status_on DESC`)
      .bind(...bindings)
      .all<Record<string, unknown>>();
    rows = result.results;
  } else if (report === "giftMoney" || report === "payments") {
    title = report === "giftMoney" ? "Gift money" : "Sponsorship payment list";
    columns = [
      { key: "receivedOn", label: "Received" },
      { key: "sponsorName", label: "Sponsor / donor" },
      { key: "fundType", label: "Fund type" },
      { key: "receiptNumber", label: "Receipt no." },
      { key: "amount", label: "Amount", numeric: true },
      { key: "allocatedAmount", label: "Allocated", numeric: true },
      { key: "beneficiaries", label: "Beneficiaries", numeric: true },
      { key: "remarks", label: "Remarks" },
    ];
    const sessionCondition = session === "all" ? "" : " AND fund.academic_session_id=?";
    const typeCondition = report === "giftMoney" ? " AND lower(type.name)='gift money'" : "";
    const bindings =
      session === "all" ? [context.organizationId] : [context.organizationId, session];
    const result = await runtime.DATABASE.prepare(`SELECT fund.received_on AS receivedOn,
      coalesce(individual.display_name,parent.name,visitor.display_name,'Legacy sponsor') AS sponsorName,
      type.name AS fundType,fund.receipt_number AS receiptNumber,fund.amount,
      coalesce(SUM(allocation.amount),0) AS allocatedAmount,
      COUNT(DISTINCT allocation.person_id) AS beneficiaries,fund.remarks
      FROM sponsorship_fund fund JOIN sponsorship_fund_type type ON type.id=fund.fund_type_id
      LEFT JOIN sponsorship_individual individual ON individual.id=fund.sponsor_individual_id
      LEFT JOIN sponsorship_organization parent ON parent.id=fund.sponsor_organization_id
      LEFT JOIN sponsorship_visitor visitor ON visitor.id=fund.visitor_id
      LEFT JOIN sponsorship_fund_allocation allocation ON allocation.fund_id=fund.id
      WHERE fund.organization_id=?${sessionCondition}${typeCondition}
      GROUP BY fund.id ORDER BY fund.received_on DESC,fund.id`)
      .bind(...bindings)
      .all<Record<string, unknown>>();
    rows = result.results;
  } else {
    title = "Visitor list";
    columns = [
      { key: "visitedOn", label: "Visited" },
      { key: "visitorName", label: "Visitor" },
      { key: "visitorType", label: "Type" },
      { key: "countryName", label: "Country" },
      { key: "relatedPersonName", label: "Related person" },
      { key: "giftsPresented", label: "Gifts presented" },
      { key: "visitSummary", label: "Visit summary" },
    ];
    const result = await runtime.DATABASE.prepare(`SELECT visitor.visited_on AS visitedOn,
      visitor.display_name AS visitorName,type.name AS visitorType,visitor.country_name AS countryName,
      visitor.related_person_name AS relatedPersonName,visitor.gifts_presented,visitor.visit_summary AS visitSummary
      FROM sponsorship_visitor visitor LEFT JOIN sponsorship_visitor_type type ON type.id=visitor.visitor_type_id
      WHERE visitor.organization_id=? ORDER BY visitor.visited_on DESC,visitor.display_name COLLATE NOCASE`)
      .bind(context.organizationId)
      .all<Record<string, unknown>>();
    rows = result.results;
  }
  return Response.json({
    generatedAt: new Date().toISOString(),
    report,
    title,
    sessionName: sessionRow?.name ?? "All sessions",
    columns,
    rows,
  });
}

async function getSponsorshipRecords(request: Request): Promise<Response> {
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "sponsorship.read")) return forbidden();
  const url = new URL(request.url);
  const parsed = sponsorshipListQuerySchema.safeParse({
    section: url.searchParams.get("section"),
    q: url.searchParams.get("q") ?? "",
    page: url.searchParams.get("page") ?? "1",
    pageSize: url.searchParams.get("pageSize") ?? "25",
  });
  if (!parsed.success)
    return Response.json({ error: "Check the sponsorship filters." }, { status: 400 });
  const { section, q, page, pageSize } = parsed.data;
  const runtime = getRuntimeEnv();
  const search = `%${escapeLikePattern(q.toLowerCase())}%`;
  const offset = (page - 1) * pageSize;
  const summaries = await runtime.DATABASE.prepare(`SELECT
    (SELECT COUNT(*) FROM sponsorship_individual WHERE organization_id=?) individuals,
    (SELECT COUNT(*) FROM sponsorship_organization WHERE organization_id=?) organizations,
    (SELECT COUNT(*) FROM sponsorship_assignment WHERE organization_id=?) assignments,
    (SELECT COUNT(*) FROM sponsorship_fund WHERE organization_id=?) funds,
    (SELECT coalesce(SUM(amount),0) FROM sponsorship_fund WHERE organization_id=?) receivedAmount,
    (SELECT COUNT(*) FROM sponsorship_letter WHERE organization_id=?) letters,
    (SELECT COUNT(*) FROM sponsorship_visitor WHERE organization_id=?) visitors`)
    .bind(...Array(7).fill(context.organizationId))
    .first<Record<string, unknown>>();
  let count = 0;
  let rows: Record<string, unknown>[] = [];
  if (section === "sponsors") {
    const where = `value.organization_id=? AND (?='' OR lower(value.display_name) LIKE ? ESCAPE '\\' OR lower(coalesce(value.email,'')) LIKE ? ESCAPE '\\' OR lower(coalesce(parent.name,'')) LIKE ? ESCAPE '\\')`;
    const bindings = [context.organizationId, q, search, search, search];
    const [total, result] = await Promise.all([
      runtime.DATABASE.prepare(
        `SELECT COUNT(*) total FROM sponsorship_individual value LEFT JOIN sponsorship_organization parent ON parent.id=value.sponsor_organization_id WHERE ${where}`,
      )
        .bind(...bindings)
        .first<{ total: number }>(),
      runtime.DATABASE.prepare(
        `SELECT value.id,value.display_name AS displayName,value.first_name AS firstName,value.middle_name AS middleName,value.last_name AS lastName,value.address,value.country_name AS countryName,value.email,value.phone,value.sponsor_organization_id AS sponsorOrganizationId,value.sponsor_type_id AS sponsorTypeId,value.sponsor_category_id AS sponsorCategoryId,parent.name AS organizationName,type.name AS sponsorType,category.name AS sponsorCategory,(SELECT COUNT(*) FROM sponsorship_assignment assignment WHERE assignment.sponsor_individual_id=value.id) assignmentCount FROM sponsorship_individual value LEFT JOIN sponsorship_organization parent ON parent.id=value.sponsor_organization_id LEFT JOIN sponsorship_sponsor_type type ON type.id=value.sponsor_type_id LEFT JOIN sponsorship_sponsor_category category ON category.id=value.sponsor_category_id WHERE ${where} ORDER BY value.display_name COLLATE NOCASE LIMIT ? OFFSET ?`,
      )
        .bind(...bindings, pageSize, offset)
        .all<Record<string, unknown>>(),
    ]);
    count = Number(total?.total ?? 0);
    rows = result.results;
  } else if (section === "assignments") {
    const where = `value.organization_id=? AND (?='' OR lower(person.display_name) LIKE ? ESCAPE '\\' OR lower(sponsor.display_name) LIKE ? ESCAPE '\\' OR lower(status.name) LIKE ? ESCAPE '\\')`;
    const bindings = [context.organizationId, q, search, search, search];
    const [total, result] = await Promise.all([
      runtime.DATABASE.prepare(
        `SELECT COUNT(*) total FROM sponsorship_assignment value JOIN person ON person.id=value.person_id JOIN sponsorship_individual sponsor ON sponsor.id=value.sponsor_individual_id JOIN sponsorship_status status ON status.id=value.sponsorship_status_id WHERE ${where}`,
      )
        .bind(...bindings)
        .first<{ total: number }>(),
      runtime.DATABASE.prepare(
        `SELECT value.id,value.person_id AS personId,value.sponsor_individual_id AS sponsorIndividualId,value.sponsorship_status_id AS statusId,value.academic_session_id AS sessionId,value.status_on AS statusOn,value.remarks,person.display_name AS personName,person.primary_identifier AS admissionNumber,sponsor.display_name AS sponsorName,status.name AS statusName,session.name AS sessionName FROM sponsorship_assignment value JOIN person ON person.id=value.person_id JOIN sponsorship_individual sponsor ON sponsor.id=value.sponsor_individual_id JOIN sponsorship_status status ON status.id=value.sponsorship_status_id LEFT JOIN academic_session session ON session.id=value.academic_session_id WHERE ${where} ORDER BY value.status_on DESC,person.display_name COLLATE NOCASE LIMIT ? OFFSET ?`,
      )
        .bind(...bindings, pageSize, offset)
        .all<Record<string, unknown>>(),
    ]);
    count = Number(total?.total ?? 0);
    rows = result.results;
  } else if (section === "funds") {
    const where = `value.organization_id=? AND (?='' OR lower(coalesce(individual.display_name,parent.name,visitor.display_name,'')) LIKE ? ESCAPE '\\' OR lower(coalesce(value.receipt_number,'')) LIKE ? ESCAPE '\\' OR lower(type.name) LIKE ? ESCAPE '\\')`;
    const bindings = [context.organizationId, q, search, search, search];
    const [total, result] = await Promise.all([
      runtime.DATABASE.prepare(
        `SELECT COUNT(*) total FROM sponsorship_fund value JOIN sponsorship_fund_type type ON type.id=value.fund_type_id LEFT JOIN sponsorship_individual individual ON individual.id=value.sponsor_individual_id LEFT JOIN sponsorship_organization parent ON parent.id=value.sponsor_organization_id LEFT JOIN sponsorship_visitor visitor ON visitor.id=value.visitor_id WHERE ${where}`,
      )
        .bind(...bindings)
        .first<{ total: number }>(),
      runtime.DATABASE.prepare(
        `SELECT value.id,value.fund_type_id AS fundTypeId,value.academic_session_id AS sessionId,value.sponsor_kind AS sponsorKind,coalesce(value.sponsor_individual_id,value.sponsor_organization_id,value.visitor_id) AS sponsorPartyId,value.received_on AS receivedOn,value.period_from AS periodFrom,value.period_to AS periodTo,value.amount,value.receipt_number AS receiptNumber,value.remarks,type.name AS fundType,coalesce(individual.display_name,parent.name,visitor.display_name,'Legacy sponsor') AS sponsorName,(SELECT COUNT(*) FROM sponsorship_fund_allocation allocation WHERE allocation.fund_id=value.id) allocationCount FROM sponsorship_fund value JOIN sponsorship_fund_type type ON type.id=value.fund_type_id LEFT JOIN sponsorship_individual individual ON individual.id=value.sponsor_individual_id LEFT JOIN sponsorship_organization parent ON parent.id=value.sponsor_organization_id LEFT JOIN sponsorship_visitor visitor ON visitor.id=value.visitor_id WHERE ${where} ORDER BY value.received_on DESC LIMIT ? OFFSET ?`,
      )
        .bind(...bindings, pageSize, offset)
        .all<Record<string, unknown>>(),
    ]);
    count = Number(total?.total ?? 0);
    rows = result.results;
  } else if (section === "correspondence") {
    const where = `value.organization_id=? AND (?='' OR lower(coalesce(value.sender,'')) LIKE ? ESCAPE '\\' OR lower(coalesce(value.receiver,'')) LIKE ? ESCAPE '\\' OR lower(type.name) LIKE ? ESCAPE '\\')`;
    const bindings = [context.organizationId, q, search, search, search];
    const [total, result] = await Promise.all([
      runtime.DATABASE.prepare(
        `SELECT COUNT(*) total FROM sponsorship_letter value JOIN sponsorship_correspondence_type type ON type.id=value.correspondence_type_id WHERE ${where}`,
      )
        .bind(...bindings)
        .first<{ total: number }>(),
      runtime.DATABASE.prepare(
        `SELECT value.id,value.correspondence_type_id AS correspondenceTypeId,value.sponsor_individual_id AS sponsorIndividualId,value.person_id AS personId,value.academic_session_id AS sessionId,value.sender,value.receiver,value.received_on AS receivedOn,value.replied_on AS repliedOn,value.reply_due_on AS replyDueOn,value.remarks,type.name AS correspondenceType,sponsor.display_name AS sponsorName,person.display_name AS personName,person.primary_identifier AS admissionNumber FROM sponsorship_letter value JOIN sponsorship_correspondence_type type ON type.id=value.correspondence_type_id LEFT JOIN sponsorship_individual sponsor ON sponsor.id=value.sponsor_individual_id LEFT JOIN person ON person.id=value.person_id WHERE ${where} ORDER BY value.received_on DESC LIMIT ? OFFSET ?`,
      )
        .bind(...bindings, pageSize, offset)
        .all<Record<string, unknown>>(),
    ]);
    count = Number(total?.total ?? 0);
    rows = result.results;
  } else {
    const where = `value.organization_id=? AND (?='' OR lower(value.display_name) LIKE ? ESCAPE '\\' OR lower(coalesce(value.country_name,'')) LIKE ? ESCAPE '\\' OR lower(coalesce(type.name,'')) LIKE ? ESCAPE '\\')`;
    const bindings = [context.organizationId, q, search, search, search];
    const [total, result] = await Promise.all([
      runtime.DATABASE.prepare(
        `SELECT COUNT(*) total FROM sponsorship_visitor value LEFT JOIN sponsorship_visitor_type type ON type.id=value.visitor_type_id WHERE ${where}`,
      )
        .bind(...bindings)
        .first<{ total: number }>(),
      runtime.DATABASE.prepare(
        `SELECT value.id,value.visitor_type_id AS visitorTypeId,value.first_name AS firstName,value.middle_name AS middleName,value.last_name AS lastName,value.display_name AS displayName,value.address,value.country_name AS countryName,value.email,value.phone,value.related_person_name AS relatedPersonName,value.visited_on AS visitedOn,value.memento_quantity AS mementoQuantity,value.gifts_presented AS giftsPresented,value.visit_summary AS visitSummary,value.comments,type.name AS visitorType FROM sponsorship_visitor value LEFT JOIN sponsorship_visitor_type type ON type.id=value.visitor_type_id WHERE ${where} ORDER BY value.visited_on DESC LIMIT ? OFFSET ?`,
      )
        .bind(...bindings, pageSize, offset)
        .all<Record<string, unknown>>(),
    ]);
    count = Number(total?.total ?? 0);
    rows = result.results;
  }
  if (section === "funds") {
    rows = await Promise.all(
      rows.map(async (row) => {
        const allocations = await runtime.DATABASE.prepare(`SELECT allocation.person_id AS personId,
          person.display_name AS personName,allocation.amount,allocation.remarks
          FROM sponsorship_fund_allocation allocation LEFT JOIN person ON person.id=allocation.person_id
          WHERE allocation.organization_id=? AND allocation.fund_id=? ORDER BY person.display_name COLLATE NOCASE`)
          .bind(context.organizationId, String(row.id))
          .all<Record<string, unknown>>();
        return { ...row, allocations: allocations.results };
      }),
    );
  }
  return Response.json({
    summary: summaries,
    records: rows,
    pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
    capabilities: { manage: hasPermission(context, "sponsorship.manage") },
  });
}

async function getSponsorshipSetup(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "sponsorship.read")) return forbidden();
  const runtime = getRuntimeEnv();
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const search = `%${escapeLikePattern(q.toLowerCase())}%`;
  const tables = [
    "sponsorship_sponsor_type",
    "sponsorship_sponsor_category",
    "sponsorship_status",
    "sponsorship_fund_type",
    "sponsorship_correspondence_type",
    "sponsorship_visitor_type",
  ];
  const [
    organizations,
    sponsorTypes,
    sponsorCategories,
    statuses,
    fundTypes,
    correspondenceTypes,
    visitorTypes,
    sessions,
    people,
    individuals,
    visitors,
  ] = await Promise.all([
    runtime.DATABASE.prepare(`SELECT id,name,country_name AS countryName,
      supports_children AS supportsChildren,supports_elderly AS supportsElderly
      FROM sponsorship_organization WHERE organization_id=? AND is_active=1
      ORDER BY name COLLATE NOCASE`)
      .bind(context.organizationId)
      .all(),
    ...tables.map((table) =>
      runtime.DATABASE.prepare(
        `SELECT id,name FROM ${table} WHERE organization_id=? AND is_active=1 ORDER BY name COLLATE NOCASE`,
      )
        .bind(context.organizationId)
        .all(),
    ),
    runtime.DATABASE.prepare(
      "SELECT id,name FROM academic_session WHERE organization_id=? ORDER BY starts_on DESC",
    )
      .bind(context.organizationId)
      .all(),
    runtime.DATABASE.prepare(
      `SELECT id,display_name AS name,primary_identifier AS admissionNumber FROM person WHERE organization_id=? AND (?='' OR lower(display_name) LIKE ? ESCAPE '\\' OR lower(primary_identifier) LIKE ? ESCAPE '\\') ORDER BY display_name COLLATE NOCASE LIMIT 50`,
    )
      .bind(context.organizationId, q, search, search)
      .all(),
    runtime.DATABASE.prepare(
      `SELECT id,display_name AS name FROM sponsorship_individual WHERE organization_id=? AND (?='' OR lower(display_name) LIKE ? ESCAPE '\\') ORDER BY display_name COLLATE NOCASE LIMIT 50`,
    )
      .bind(context.organizationId, q, search)
      .all(),
    runtime.DATABASE.prepare(
      `SELECT id,display_name AS name FROM sponsorship_visitor WHERE organization_id=? AND (?='' OR lower(display_name) LIKE ? ESCAPE '\\') ORDER BY display_name COLLATE NOCASE LIMIT 50`,
    )
      .bind(context.organizationId, q, search)
      .all(),
  ]);
  return Response.json({
    organizations: organizations.results,
    sponsorTypes: sponsorTypes.results,
    sponsorCategories: sponsorCategories.results,
    statuses: statuses.results,
    fundTypes: fundTypes.results,
    correspondenceTypes: correspondenceTypes.results,
    visitorTypes: visitorTypes.results,
    sessions: sessions.results,
    people: people.results,
    individuals: individuals.results,
    visitors: visitors.results,
    capabilities: { manage: hasPermission(context, "sponsorship.manage") },
  });
}

async function writeSponsorshipRecord(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "sponsorship.manage")) return forbidden();
  const parsed = sponsorshipMutationSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return Response.json({ error: "Check the sponsorship record." }, { status: 400 });
  const value = parsed.data;
  const runtime = getRuntimeEnv();
  const id = value.id ?? crypto.randomUUID();
  const catalogTables: Record<string, string> = {
    sponsorType: "sponsorship_sponsor_type",
    sponsorCategory: "sponsorship_sponsor_category",
    status: "sponsorship_status",
    fundType: "sponsorship_fund_type",
    correspondenceType: "sponsorship_correspondence_type",
    visitorType: "sponsorship_visitor_type",
  };
  if (
    value.kind === "sponsorType" ||
    value.kind === "sponsorCategory" ||
    value.kind === "status" ||
    value.kind === "fundType" ||
    value.kind === "correspondenceType" ||
    value.kind === "visitorType"
  ) {
    const catalogTable = catalogTables[value.kind];
    const existing = value.id
      ? await sponsorshipEntityExists(
          runtime.DATABASE,
          catalogTable,
          value.id,
          context.organizationId,
        )
      : false;
    if (value.id && !existing)
      return Response.json({ error: "Setup record not found." }, { status: 404 });
    const statement = existing
      ? runtime.DATABASE.prepare(
          `UPDATE ${catalogTable} SET name=?,updated_by_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?`,
        ).bind(value.name, context.userId, id, context.organizationId)
      : runtime.DATABASE.prepare(
          `INSERT INTO ${catalogTable} (id,organization_id,name,source_system,source_table,source_id,created_by_user_id,updated_by_user_id) VALUES (?,? ,?,'tsewa',?,?,?,?)`,
        ).bind(
          id,
          context.organizationId,
          value.name,
          catalogTable,
          id,
          context.userId,
          context.userId,
        );
    await runtime.DATABASE.batch([
      statement,
      auditStatement(
        runtime.DATABASE,
        context,
        `sponsorship.${value.kind}_${existing ? "updated" : "created"}`,
        catalogTable,
        id,
      ),
    ]);
    return Response.json({ id }, { status: existing ? 200 : 201 });
  }
  if (value.kind === "organization") {
    const existing = value.id
      ? await sponsorshipEntityExists(
          runtime.DATABASE,
          "sponsorship_organization",
          value.id,
          context.organizationId,
        )
      : false;
    if (value.id && !existing)
      return Response.json({ error: "Sponsor organization not found." }, { status: 404 });
    const statement = existing
      ? runtime.DATABASE.prepare(
          "UPDATE sponsorship_organization SET name=?,country_name=?,supports_children=?,supports_elderly=?,updated_by_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?",
        ).bind(
          value.name,
          value.countryName ?? null,
          value.supportsChildren ? 1 : 0,
          value.supportsElderly ? 1 : 0,
          context.userId,
          id,
          context.organizationId,
        )
      : runtime.DATABASE.prepare(
          "INSERT INTO sponsorship_organization (id,organization_id,name,country_name,supports_children,supports_elderly,source_system,source_table,source_id,created_by_user_id,updated_by_user_id) VALUES (?,?,?,?,?,?,'tsewa','sponsorship_organization',?,?,?)",
        ).bind(
          id,
          context.organizationId,
          value.name,
          value.countryName ?? null,
          value.supportsChildren ? 1 : 0,
          value.supportsElderly ? 1 : 0,
          id,
          context.userId,
          context.userId,
        );
    await runtime.DATABASE.batch([
      statement,
      auditStatement(
        runtime.DATABASE,
        context,
        `sponsorship.organization_${existing ? "updated" : "created"}`,
        "sponsorship_organization",
        id,
      ),
    ]);
    return Response.json({ id }, { status: existing ? 200 : 201 });
  }
  if (value.kind === "individual") {
    for (const [table, reference] of [
      ["sponsorship_organization", value.sponsorOrganizationId],
      ["sponsorship_sponsor_type", value.sponsorTypeId],
      ["sponsorship_sponsor_category", value.sponsorCategoryId],
    ] as const)
      if (
        reference &&
        !(await sponsorshipEntityExists(runtime.DATABASE, table, reference, context.organizationId))
      )
        return Response.json({ error: "Choose valid sponsor setup values." }, { status: 400 });
    const existing = value.id
      ? await sponsorshipEntityExists(
          runtime.DATABASE,
          "sponsorship_individual",
          value.id,
          context.organizationId,
        )
      : false;
    if (value.id && !existing)
      return Response.json({ error: "Individual sponsor not found." }, { status: 404 });
    const displayName = sponsorshipDisplayName([value.firstName, value.middleName, value.lastName]);
    const bindings = [
      value.sponsorOrganizationId ?? null,
      value.sponsorTypeId ?? null,
      value.sponsorCategoryId ?? null,
      value.firstName,
      value.middleName ?? null,
      value.lastName ?? null,
      displayName,
      value.address ?? null,
      value.countryName ?? null,
      value.email ?? null,
      value.phone ?? null,
    ];
    const statement = existing
      ? runtime.DATABASE.prepare(
          "UPDATE sponsorship_individual SET sponsor_organization_id=?,sponsor_type_id=?,sponsor_category_id=?,first_name=?,middle_name=?,last_name=?,display_name=?,address=?,country_name=?,email=?,phone=?,updated_by_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?",
        ).bind(...bindings, context.userId, id, context.organizationId)
      : runtime.DATABASE.prepare(
          "INSERT INTO sponsorship_individual (id,organization_id,sponsor_organization_id,sponsor_type_id,sponsor_category_id,first_name,middle_name,last_name,display_name,address,country_name,email,phone,source_system,source_table,source_id,created_by_user_id,updated_by_user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'tsewa','sponsorship_individual',?,?,?)",
        ).bind(id, context.organizationId, ...bindings, id, context.userId, context.userId);
    await runtime.DATABASE.batch([
      statement,
      auditStatement(
        runtime.DATABASE,
        context,
        `sponsorship.individual_${existing ? "updated" : "created"}`,
        "sponsorship_individual",
        id,
      ),
    ]);
    return Response.json({ id }, { status: existing ? 200 : 201 });
  }
  if (value.kind === "assignment") {
    if (
      !(await sponsorshipEntityExists(
        runtime.DATABASE,
        "person",
        value.personId,
        context.organizationId,
      )) ||
      !(await sponsorshipEntityExists(
        runtime.DATABASE,
        "sponsorship_individual",
        value.sponsorIndividualId,
        context.organizationId,
      )) ||
      !(await sponsorshipEntityExists(
        runtime.DATABASE,
        "sponsorship_status",
        value.statusId,
        context.organizationId,
      )) ||
      (value.sessionId &&
        !(await scholarshipSessionExists(
          runtime.DATABASE,
          context.organizationId,
          value.sessionId,
        )))
    )
      return Response.json(
        { error: "Choose a valid person, sponsor, status, and session." },
        { status: 400 },
      );
    const existing = value.id
      ? await sponsorshipEntityExists(
          runtime.DATABASE,
          "sponsorship_assignment",
          value.id,
          context.organizationId,
        )
      : false;
    if (value.id && !existing)
      return Response.json({ error: "Sponsor assignment not found." }, { status: 404 });
    const statement = existing
      ? runtime.DATABASE.prepare(
          "UPDATE sponsorship_assignment SET person_id=?,sponsor_individual_id=?,sponsorship_status_id=?,academic_session_id=?,status_on=?,remarks=?,updated_by_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?",
        ).bind(
          value.personId,
          value.sponsorIndividualId,
          value.statusId,
          value.sessionId ?? null,
          value.statusOn,
          value.remarks ?? null,
          context.userId,
          id,
          context.organizationId,
        )
      : runtime.DATABASE.prepare(
          "INSERT INTO sponsorship_assignment (id,organization_id,person_id,sponsor_individual_id,sponsorship_status_id,academic_session_id,status_on,remarks,source_system,source_table,source_id,created_by_user_id,updated_by_user_id) VALUES (?,?,?,?,?,?,?,?,'tsewa','sponsorship_assignment',?,?,?)",
        ).bind(
          id,
          context.organizationId,
          value.personId,
          value.sponsorIndividualId,
          value.statusId,
          value.sessionId ?? null,
          value.statusOn,
          value.remarks ?? null,
          id,
          context.userId,
          context.userId,
        );
    await runtime.DATABASE.batch([
      statement,
      auditStatement(
        runtime.DATABASE,
        context,
        `sponsorship.assignment_${existing ? "updated" : "created"}`,
        "sponsorship_assignment",
        id,
      ),
    ]);
    return Response.json({ id }, { status: existing ? 200 : 201 });
  }
  if (value.kind === "visitor") {
    if (
      value.visitorTypeId &&
      !(await sponsorshipEntityExists(
        runtime.DATABASE,
        "sponsorship_visitor_type",
        value.visitorTypeId,
        context.organizationId,
      ))
    )
      return Response.json({ error: "Choose a valid visitor type." }, { status: 400 });
    const existing = value.id
      ? await sponsorshipEntityExists(
          runtime.DATABASE,
          "sponsorship_visitor",
          value.id,
          context.organizationId,
        )
      : false;
    if (value.id && !existing)
      return Response.json({ error: "Visitor not found." }, { status: 404 });
    const displayName = sponsorshipDisplayName([value.firstName, value.middleName, value.lastName]);
    const bindings = [
      value.visitorTypeId ?? null,
      value.firstName,
      value.middleName ?? null,
      value.lastName ?? null,
      displayName,
      value.address ?? null,
      value.countryName ?? null,
      value.email ?? null,
      value.phone ?? null,
      value.relatedPersonName ?? null,
      value.visitedOn,
      value.mementoQuantity ?? null,
      value.giftsPresented ?? null,
      value.visitSummary ?? null,
      value.comments ?? null,
    ];
    const statement = existing
      ? runtime.DATABASE.prepare(
          "UPDATE sponsorship_visitor SET visitor_type_id=?,first_name=?,middle_name=?,last_name=?,display_name=?,address=?,country_name=?,email=?,phone=?,related_person_name=?,visited_on=?,memento_quantity=?,gifts_presented=?,visit_summary=?,comments=?,updated_by_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?",
        ).bind(...bindings, context.userId, id, context.organizationId)
      : runtime.DATABASE.prepare(
          "INSERT INTO sponsorship_visitor (id,organization_id,visitor_type_id,first_name,middle_name,last_name,display_name,address,country_name,email,phone,related_person_name,visited_on,memento_quantity,gifts_presented,visit_summary,comments,source_system,source_table,source_id,created_by_user_id,updated_by_user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'tsewa','sponsorship_visitor',?,?,?)",
        ).bind(id, context.organizationId, ...bindings, id, context.userId, context.userId);
    await runtime.DATABASE.batch([
      statement,
      auditStatement(
        runtime.DATABASE,
        context,
        `sponsorship.visitor_${existing ? "updated" : "created"}`,
        "sponsorship_visitor",
        id,
      ),
    ]);
    return Response.json({ id }, { status: existing ? 200 : 201 });
  }
  if (value.kind === "correspondence") {
    if (
      !(await sponsorshipEntityExists(
        runtime.DATABASE,
        "sponsorship_correspondence_type",
        value.correspondenceTypeId,
        context.organizationId,
      )) ||
      (value.sponsorIndividualId &&
        !(await sponsorshipEntityExists(
          runtime.DATABASE,
          "sponsorship_individual",
          value.sponsorIndividualId,
          context.organizationId,
        ))) ||
      (value.personId &&
        !(await sponsorshipEntityExists(
          runtime.DATABASE,
          "person",
          value.personId,
          context.organizationId,
        ))) ||
      (value.sessionId &&
        !(await scholarshipSessionExists(
          runtime.DATABASE,
          context.organizationId,
          value.sessionId,
        )))
    )
      return Response.json({ error: "Choose valid correspondence references." }, { status: 400 });
    const existing = value.id
      ? await sponsorshipEntityExists(
          runtime.DATABASE,
          "sponsorship_letter",
          value.id,
          context.organizationId,
        )
      : false;
    if (value.id && !existing)
      return Response.json({ error: "Correspondence not found." }, { status: 404 });
    const bindings = [
      value.correspondenceTypeId,
      value.sponsorIndividualId ?? null,
      value.personId ?? null,
      value.sessionId ?? null,
      value.sender ?? null,
      value.receiver ?? null,
      value.receivedOn,
      value.repliedOn ?? null,
      value.replyDueOn ?? null,
      value.remarks ?? null,
    ];
    const statement = existing
      ? runtime.DATABASE.prepare(
          "UPDATE sponsorship_letter SET correspondence_type_id=?,sponsor_individual_id=?,person_id=?,academic_session_id=?,sender=?,receiver=?,received_on=?,replied_on=?,reply_due_on=?,remarks=?,updated_by_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?",
        ).bind(...bindings, context.userId, id, context.organizationId)
      : runtime.DATABASE.prepare(
          "INSERT INTO sponsorship_letter (id,organization_id,correspondence_type_id,sponsor_individual_id,person_id,academic_session_id,sender,receiver,received_on,replied_on,reply_due_on,remarks,source_system,source_table,source_id,created_by_user_id,updated_by_user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'tsewa','sponsorship_letter',?,?,?)",
        ).bind(id, context.organizationId, ...bindings, id, context.userId, context.userId);
    await runtime.DATABASE.batch([
      statement,
      auditStatement(
        runtime.DATABASE,
        context,
        `sponsorship.correspondence_${existing ? "updated" : "created"}`,
        "sponsorship_letter",
        id,
      ),
    ]);
    return Response.json({ id }, { status: existing ? 200 : 201 });
  }
  if (value.kind !== "fund")
    return Response.json({ error: "Unsupported sponsorship record." }, { status: 400 });
  if (
    !(await sponsorshipEntityExists(
      runtime.DATABASE,
      "sponsorship_fund_type",
      value.fundTypeId,
      context.organizationId,
    )) ||
    (value.sessionId &&
      !(await scholarshipSessionExists(runtime.DATABASE, context.organizationId, value.sessionId)))
  )
    return Response.json({ error: "Choose a valid fund type and session." }, { status: 400 });
  const partyTable =
    value.sponsorKind === "individual"
      ? "sponsorship_individual"
      : value.sponsorKind === "organization"
        ? "sponsorship_organization"
        : "sponsorship_visitor";
  if (
    !(await sponsorshipEntityExists(
      runtime.DATABASE,
      partyTable,
      value.sponsorPartyId,
      context.organizationId,
    ))
  )
    return Response.json({ error: "Choose a valid remittance source." }, { status: 400 });
  const people = new Set(
    (
      await runtime.DATABASE.prepare("SELECT id FROM person WHERE organization_id=?")
        .bind(context.organizationId)
        .all<{ id: string }>()
    ).results.map((item) => item.id),
  );
  if (value.allocations.some((item) => !people.has(item.personId)))
    return Response.json({ error: "Choose valid allocation beneficiaries." }, { status: 400 });
  if (!allocationsFitFund(value.amount, value.allocations))
    return Response.json(
      { error: "Beneficiary allocations cannot exceed the remittance amount." },
      { status: 400 },
    );
  const existing = value.id
    ? await sponsorshipEntityExists(
        runtime.DATABASE,
        "sponsorship_fund",
        value.id,
        context.organizationId,
      )
    : false;
  if (value.id && !existing)
    return Response.json({ error: "Remittance not found." }, { status: 404 });
  const individualId = value.sponsorKind === "individual" ? value.sponsorPartyId : null;
  const organizationId = value.sponsorKind === "organization" ? value.sponsorPartyId : null;
  const visitorId = value.sponsorKind === "visitor" ? value.sponsorPartyId : null;
  const bindings = [
    value.fundTypeId,
    value.sessionId ?? null,
    value.sponsorKind,
    individualId,
    organizationId,
    visitorId,
    value.receivedOn,
    value.periodFrom ?? null,
    value.periodTo ?? null,
    value.amount,
    value.receiptNumber ?? null,
    value.remarks ?? null,
  ];
  const statements: DrizzleStatement[] = [
    existing
      ? runtime.DATABASE.prepare(
          "UPDATE sponsorship_fund SET fund_type_id=?,academic_session_id=?,sponsor_kind=?,sponsor_individual_id=?,sponsor_organization_id=?,visitor_id=?,received_on=?,period_from=?,period_to=?,amount=?,receipt_number=?,remarks=?,updated_by_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?",
        ).bind(...bindings, context.userId, id, context.organizationId)
      : runtime.DATABASE.prepare(
          "INSERT INTO sponsorship_fund (id,organization_id,fund_type_id,academic_session_id,sponsor_kind,sponsor_individual_id,sponsor_organization_id,visitor_id,received_on,period_from,period_to,amount,receipt_number,remarks,source_system,source_table,source_id,created_by_user_id,updated_by_user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'tsewa','sponsorship_fund',?,?,?)",
        ).bind(id, context.organizationId, ...bindings, id, context.userId, context.userId),
  ];
  if (existing)
    statements.push(
      runtime.DATABASE.prepare(
        "DELETE FROM sponsorship_fund_allocation WHERE fund_id=? AND organization_id=?",
      ).bind(id, context.organizationId),
    );
  for (const allocation of value.allocations) {
    const allocationId = crypto.randomUUID();
    statements.push(
      runtime.DATABASE.prepare(
        "INSERT INTO sponsorship_fund_allocation (id,organization_id,fund_id,person_id,academic_session_id,amount,period_from,period_to,remarks,source_system,source_table,source_id,created_by_user_id,updated_by_user_id) VALUES (?,?,?,?,?,?,?,?,?,'tsewa','sponsorship_fund_allocation',?,?,?)",
      ).bind(
        allocationId,
        context.organizationId,
        id,
        allocation.personId,
        value.sessionId ?? null,
        allocation.amount,
        value.periodFrom ?? null,
        value.periodTo ?? null,
        allocation.remarks ?? null,
        allocationId,
        context.userId,
        context.userId,
      ),
    );
  }
  statements.push(
    auditStatement(
      runtime.DATABASE,
      context,
      `sponsorship.fund_${existing ? "updated" : "created"}`,
      "sponsorship_fund",
      id,
      { allocationCount: String(value.allocations.length) },
    ),
  );
  await runtime.DATABASE.batch(statements);
  return Response.json({ id }, { status: existing ? 200 : 201 });
}

async function sponsorshipEntityExists(
  database: QueryDatabase,
  table: string,
  id: string,
  organizationId: string,
): Promise<boolean> {
  const allowed = new Set([
    "person",
    "sponsorship_organization",
    "sponsorship_sponsor_type",
    "sponsorship_sponsor_category",
    "sponsorship_status",
    "sponsorship_individual",
    "sponsorship_assignment",
    "sponsorship_fund_type",
    "sponsorship_visitor_type",
    "sponsorship_visitor",
    "sponsorship_fund",
    "sponsorship_correspondence_type",
    "sponsorship_letter",
  ]);
  if (!allowed.has(table)) return false;
  return Boolean(
    await database
      .prepare(`SELECT id FROM ${table} WHERE id=? AND organization_id=?`)
      .bind(id, organizationId)
      .first(),
  );
}

function scholarshipRecordWrite(
  database: QueryDatabase,
  mode: "insert" | "update",
  context: MembershipContext,
  id: string,
  value: z.infer<typeof scholarshipRecordSchema>,
) {
  const values = [
    value.personId,
    value.sessionId ?? null,
    value.courseId,
    value.beneficiaryCategory ?? null,
    value.studentName,
    value.admissionNumber ?? null,
    value.fatherName ?? null,
    value.gender ?? null,
    value.dateOfBirth ?? null,
    value.classStream ?? null,
    value.classPercentage ?? null,
    value.admissionYear ?? null,
    value.courseDuration ?? null,
    value.collegeTraining ? 1 : 0,
    value.cityName ?? null,
    value.permanentAddress ?? null,
    value.mailingAddress ?? null,
    value.specialAllowance ? 1 : 0,
    value.scholarshipAwarded ?? null,
    value.instituteName ?? null,
    value.bankAccountNumber ?? null,
    value.wardHealthRecord ?? null,
    value.needyCase ?? null,
    value.reason ?? null,
    value.status,
    value.phone ?? null,
    value.ledgerNumber ?? null,
  ];
  const columns = [
    "person_id",
    "academic_session_id",
    "course_id",
    "beneficiary_category",
    "student_name",
    "admission_number",
    "father_name",
    "gender",
    "date_of_birth",
    "class_stream",
    "class_percentage",
    "admission_year",
    "course_duration",
    "college_training",
    "city_name",
    "permanent_address",
    "mailing_address",
    "special_allowance",
    "scholarship_awarded",
    "institute_name",
    "bank_account_number",
    "ward_health_record",
    "needy_case",
    "reason",
    "status",
    "phone",
    "ledger_number",
  ];
  return mode === "update"
    ? database
        .prepare(
          `UPDATE scholarship_record SET ${columns.map((column) => `${column}=?`).join(",")},updated_by_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?`,
        )
        .bind(...values, context.userId, id, context.organizationId)
    : database
        .prepare(
          `INSERT INTO scholarship_record (id,organization_id,${columns.join(",")},source_system,source_table,source_id,created_by_user_id,updated_by_user_id) VALUES (?,?${columns.map(() => ",?").join("")},'tsewa','scholarship_record',?,?,?)`,
        )
        .bind(id, context.organizationId, ...values, id, context.userId, context.userId);
}

async function validScholarshipReferences(
  database: QueryDatabase,
  organizationId: string,
  value: z.infer<typeof scholarshipRecordSchema>,
) {
  const [person, course, session] = await Promise.all([
    database
      .prepare("SELECT id FROM person WHERE id=? AND organization_id=?")
      .bind(value.personId, organizationId)
      .first(),
    database
      .prepare("SELECT id FROM scholarship_course WHERE id=? AND organization_id=? AND is_active=1")
      .bind(value.courseId, organizationId)
      .first(),
    value.sessionId
      ? scholarshipSessionExists(database, organizationId, value.sessionId)
      : Promise.resolve(true),
  ]);
  return Boolean(person && course && session);
}
async function scholarshipSessionExists(
  database: QueryDatabase,
  organizationId: string,
  sessionId: string,
) {
  return Boolean(
    await database
      .prepare("SELECT id FROM academic_session WHERE id=? AND organization_id=?")
      .bind(sessionId, organizationId)
      .first(),
  );
}

async function changeMarkSheetStatus(request: Request, markSheetId: string): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!z.uuid().safeParse(markSheetId).success)
    return Response.json({ error: "Invalid mark sheet." }, { status: 400 });
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "school.results.manage")) return forbidden();
  const parsed = markSheetStatusSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return Response.json({ error: "Choose a valid status action." }, { status: 400 });
  const runtime = getRuntimeEnv();
  const sheet = await runtime.DATABASE.prepare(
    "SELECT id,status,source_system AS sourceSystem FROM mark_sheet WHERE id=? AND organization_id=?",
  )
    .bind(markSheetId, context.organizationId)
    .first<{ id: string; status: string; sourceSystem: string }>();
  if (!sheet) return Response.json({ error: "Mark sheet not found." }, { status: 404 });
  if (sheet.sourceSystem.toLowerCase() !== "tsewa") {
    return Response.json(
      { error: "Imported mark sheets are preserved as read-only history." },
      { status: 409 },
    );
  }
  const transition = nextMarkSheetStatus(
    sheet.status as "draft" | "verified" | "final",
    parsed.data.action,
  );
  if (!transition)
    return Response.json(
      { error: `Cannot ${parsed.data.action} a ${sheet.status} mark sheet.` },
      { status: 409 },
    );
  const verified = transition === "verified" || transition === "final";
  await runtime.DATABASE.batch([
    runtime.DATABASE.prepare(`UPDATE mark_sheet SET status=?,is_verified=?,
      verified_at=CASE WHEN ?='verified' THEN CURRENT_TIMESTAMP WHEN ?='draft' THEN NULL ELSE verified_at END,
      verified_by_user_id=CASE WHEN ?='verified' THEN ? WHEN ?='draft' THEN NULL ELSE verified_by_user_id END,
      finalized_at=CASE WHEN ?='final' THEN CURRENT_TIMESTAMP WHEN ?='draft' THEN NULL ELSE finalized_at END,
      finalized_by_user_id=CASE WHEN ?='final' THEN ? WHEN ?='draft' THEN NULL ELSE finalized_by_user_id END,
      updated_by_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?`).bind(
      transition,
      verified ? 1 : 0,
      transition,
      transition,
      transition,
      context.userId,
      transition,
      transition,
      transition,
      transition,
      context.userId,
      transition,
      context.userId,
      markSheetId,
      context.organizationId,
    ),
    auditStatement(
      runtime.DATABASE,
      context,
      `academic.mark_sheet_${transition}`,
      "mark_sheet",
      markSheetId,
    ),
  ]);
  return Response.json({ id: markSheetId, status: transition });
}

async function getHealthHistory(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "health.read")) return forbidden();
  const url = new URL(request.url);
  const parsed = healthHistoryQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    kind: url.searchParams.get("kind") ?? "all",
    page: url.searchParams.get("page") ?? "1",
    pageSize: url.searchParams.get("pageSize") ?? "25",
  });
  if (!parsed.success) {
    return Response.json({ error: "Check the health history filters." }, { status: 400 });
  }

  const { q, kind, page, pageSize } = parsed.data;
  const conditions = ["visit.organization_id = ?"];
  const bindings: Array<string | number> = [context.organizationId];
  if (kind !== "all") {
    conditions.push("visit.patient_kind = ?");
    bindings.push(kind);
  }
  if (q) {
    const search = `%${escapeLikePattern(q.toLowerCase())}%`;
    conditions.push(`(lower(visit.patient_name) LIKE ? ESCAPE '\\'
      OR lower(coalesce(visit.admission_number, '')) LIKE ? ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM health_diagnosis search_diagnosis
        WHERE search_diagnosis.health_visit_id=visit.id
          AND lower(search_diagnosis.diagnosis_name) LIKE ? ESCAPE '\\'))`);
    bindings.push(search, search, search);
  }
  const where = conditions.join(" AND ");
  const runtime = getRuntimeEnv();
  const [summary, count, rows] = await Promise.all([
    runtime.DATABASE.prepare(`SELECT COUNT(*) AS visits,
      COUNT(DISTINCT person_id) AS linkedPeople,
      MIN(checkup_date) AS firstVisitOn, MAX(checkup_date) AS lastVisitOn,
      (SELECT COUNT(*) FROM health_diagnosis diagnosis
        WHERE diagnosis.organization_id=?) AS diagnoses
      FROM health_visit WHERE organization_id=?`)
      .bind(context.organizationId, context.organizationId)
      .first<{
        visits: number;
        diagnoses: number;
        linkedPeople: number;
        firstVisitOn: string | null;
        lastVisitOn: string | null;
      }>(),
    runtime.DATABASE.prepare(`SELECT COUNT(*) AS total FROM health_visit visit WHERE ${where}`)
      .bind(...bindings)
      .first<{ total: number }>(),
    runtime.DATABASE.prepare(`SELECT visit.id,visit.person_id AS personId,
      visit.patient_name AS patientName,visit.patient_kind AS patientKind,
      visit.admission_number AS admissionNumber,visit.gender,visit.home_name AS homeName,
      visit.age_at_visit AS ageAtVisit,visit.checkup_date AS checkupDate,
      visit.admitted_on AS admittedOn,visit.discharged_on AS dischargedOn,
      visit.doctor_name AS doctorName,visit.referred_to AS referredTo,
      visit.referral_location AS referralLocation,visit.remarks,
      visit.hepatitis_b_status AS hepatitisBStatus,
      coalesce(json_group_array(json_object(
        'id',diagnosis.id,'name',diagnosis.diagnosis_name,
        'recordedOn',diagnosis.recorded_on,'remarks',diagnosis.remarks
      )) FILTER (WHERE diagnosis.id IS NOT NULL), '[]') AS diagnosesJson
      FROM health_visit visit
      LEFT JOIN health_diagnosis diagnosis ON diagnosis.health_visit_id=visit.id
        AND diagnosis.organization_id=visit.organization_id
      WHERE ${where}
      GROUP BY visit.id
      ORDER BY visit.checkup_date DESC,visit.patient_name COLLATE NOCASE
      LIMIT ? OFFSET ?`)
      .bind(...bindings, pageSize, (page - 1) * pageSize)
      .all<{ diagnosesJson: string; [key: string]: unknown }>(),
  ]);
  const total = Number(count?.total ?? 0);
  return Response.json({
    summary: {
      visits: Number(summary?.visits ?? 0),
      diagnoses: Number(summary?.diagnoses ?? 0),
      linkedPeople: Number(summary?.linkedPeople ?? 0),
      firstVisitOn: summary?.firstVisitOn ?? null,
      lastVisitOn: summary?.lastVisitOn ?? null,
    },
    visits: rows.results.map(({ diagnosesJson, ...row }) => ({
      ...row,
      diagnoses: JSON.parse(diagnosesJson) as Array<{
        id: string;
        name: string;
        recordedOn: string | null;
        remarks: string | null;
      }>,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

async function getTbHistory(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "health.read")) return forbidden();
  const url = new URL(request.url);
  const parsed = tbHistoryQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    kind: url.searchParams.get("kind") ?? "all",
    outcome: url.searchParams.get("outcome") ?? "all",
    page: url.searchParams.get("page") ?? "1",
    pageSize: url.searchParams.get("pageSize") ?? "25",
  });
  if (!parsed.success) {
    return Response.json({ error: "Check the TB history filters." }, { status: 400 });
  }

  const { q, kind, outcome, page, pageSize } = parsed.data;
  const conditions = ["record.organization_id = ?"];
  const bindings: Array<string | number> = [context.organizationId];
  if (kind !== "all") {
    conditions.push("record.patient_kind = ?");
    bindings.push(kind);
  }
  if (outcome !== "all") {
    conditions.push("record.outcome = ?");
    bindings.push(outcome);
  }
  if (q) {
    const search = `%${escapeLikePattern(q.toLowerCase())}%`;
    conditions.push(`(lower(record.patient_name) LIKE ? ESCAPE '\\'
      OR lower(coalesce(record.admission_number, '')) LIKE ? ESCAPE '\\'
      OR lower(coalesce(record.tb_card_number, '')) LIKE ? ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM health_tb_detail search_detail
        WHERE search_detail.tb_case_id=record.id
          AND (lower(search_detail.test_name) LIKE ? ESCAPE '\\'
            OR lower(coalesce(search_detail.result, '')) LIKE ? ESCAPE '\\')))`);
    bindings.push(search, search, search, search, search);
  }
  const where = conditions.join(" AND ");
  const runtime = getRuntimeEnv();
  const [summary, outcomes, count, rows] = await Promise.all([
    runtime.DATABASE.prepare(`SELECT COUNT(*) AS cases,
      COUNT(DISTINCT person_id) AS linkedPeople,
      MIN(registration_date) AS firstRegistrationOn,
      MAX(registration_date) AS lastRegistrationOn,
      SUM(CASE WHEN lower(outcome)='on treatment' THEN 1 ELSE 0 END) AS onTreatment,
      (SELECT COUNT(*) FROM health_tb_detail detail
        WHERE detail.organization_id=?) AS details
      FROM health_tb_case WHERE organization_id=?`)
      .bind(context.organizationId, context.organizationId)
      .first<{
        cases: number;
        details: number;
        linkedPeople: number;
        onTreatment: number;
        firstRegistrationOn: string | null;
        lastRegistrationOn: string | null;
      }>(),
    runtime.DATABASE.prepare(`SELECT outcome,COUNT(*) AS count FROM health_tb_case
      WHERE organization_id=? GROUP BY outcome ORDER BY count DESC,outcome COLLATE NOCASE`)
      .bind(context.organizationId)
      .all<{ outcome: string; count: number }>(),
    runtime.DATABASE.prepare(`SELECT COUNT(*) AS total FROM health_tb_case record WHERE ${where}`)
      .bind(...bindings)
      .first<{ total: number }>(),
    runtime.DATABASE.prepare(`SELECT record.id,record.person_id AS personId,
      record.patient_name AS patientName,record.patient_kind AS patientKind,
      record.tb_card_number AS tbCardNumber,record.admission_number AS admissionNumber,
      record.father_name AS fatherName,record.gender,
      record.age_at_registration AS ageAtRegistration,record.home_name AS homeName,
      record.treatment_regimen AS treatmentRegimen,
      record.registration_date AS registrationDate,
      record.treatment_start_date AS treatmentStartDate,
      record.treatment_end_date AS treatmentEndDate,record.outcome,
      record.tb_type AS tbType,record.case_type AS caseType,record.remarks,
      coalesce(json_group_array(json_object(
        'id',detail.id,'recordedOn',detail.recorded_on,'testName',detail.test_name,
        'result',detail.result,'remarks',detail.remarks
      )) FILTER (WHERE detail.id IS NOT NULL), '[]') AS detailsJson
      FROM health_tb_case record
      LEFT JOIN health_tb_detail detail ON detail.tb_case_id=record.id
        AND detail.organization_id=record.organization_id
      WHERE ${where}
      GROUP BY record.id
      ORDER BY record.registration_date DESC,record.patient_name COLLATE NOCASE
      LIMIT ? OFFSET ?`)
      .bind(...bindings, pageSize, (page - 1) * pageSize)
      .all<{ detailsJson: string; [key: string]: unknown }>(),
  ]);
  const total = Number(count?.total ?? 0);
  return Response.json({
    summary: {
      cases: Number(summary?.cases ?? 0),
      details: Number(summary?.details ?? 0),
      linkedPeople: Number(summary?.linkedPeople ?? 0),
      onTreatment: Number(summary?.onTreatment ?? 0),
      firstRegistrationOn: summary?.firstRegistrationOn ?? null,
      lastRegistrationOn: summary?.lastRegistrationOn ?? null,
    },
    outcomes: outcomes.results.map((item) => ({
      name: item.outcome,
      count: Number(item.count),
    })),
    cases: rows.results.map(({ detailsJson, ...row }) => ({
      ...row,
      details: JSON.parse(detailsJson) as Array<{
        id: string;
        recordedOn: string;
        testName: string;
        result: string | null;
        remarks: string | null;
      }>,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

async function getMedicalAdvances(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "health.read")) return forbidden();
  const url = new URL(request.url);
  const parsed = medicalAdvanceQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    kind: url.searchParams.get("kind") ?? "all",
    settlement: url.searchParams.get("settlement") ?? "all",
    page: url.searchParams.get("page") ?? "1",
    pageSize: url.searchParams.get("pageSize") ?? "25",
  });
  if (!parsed.success) {
    return Response.json({ error: "Check the medical advance filters." }, { status: 400 });
  }

  const { q, kind, settlement, page, pageSize } = parsed.data;
  const conditions = ["advance.organization_id = ?"];
  const bindings: Array<string | number> = [context.organizationId];
  if (kind !== "all") {
    conditions.push(`EXISTS (SELECT 1 FROM health_medical_advance_detail kind_detail
      WHERE kind_detail.medical_advance_id=advance.id AND kind_detail.patient_kind=?)`);
    bindings.push(kind);
  }
  if (settlement !== "all") {
    conditions.push(`${settlement === "settled" ? "" : "NOT "}EXISTS
      (SELECT 1 FROM health_medical_settlement status_settlement
       WHERE status_settlement.medical_advance_id=advance.id)`);
  }
  if (q) {
    const search = `%${escapeLikePattern(q.toLowerCase())}%`;
    conditions.push(`(lower(coalesce(advance.sanction_number, '')) LIKE ? ESCAPE '\\'
      OR lower(coalesce(advance.nurse_name, '')) LIKE ? ESCAPE '\\'
      OR lower(coalesce(advance.referring_doctor_name, '')) LIKE ? ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM health_medical_advance_detail search_detail
        WHERE search_detail.medical_advance_id=advance.id
          AND (lower(search_detail.patient_name) LIKE ? ESCAPE '\\'
            OR lower(coalesce(search_detail.diagnosis, '')) LIKE ? ESCAPE '\\'
            OR lower(coalesce(search_detail.medication, '')) LIKE ? ESCAPE '\\')))`);
    bindings.push(search, search, search, search, search, search);
  }
  const where = conditions.join(" AND ");
  const runtime = getRuntimeEnv();
  const [summary, count, rows] = await Promise.all([
    runtime.DATABASE.prepare(`SELECT COUNT(*) AS advances,SUM(advance_amount) AS advanceAmount,
      MIN(sanctioned_on) AS firstSanctionOn,MAX(sanctioned_on) AS lastSanctionOn,
      (SELECT COUNT(*) FROM health_medical_advance_detail detail
        WHERE detail.organization_id=?) AS patientAllocations,
      (SELECT COUNT(DISTINCT legacy_settlement_id) FROM health_medical_settlement value
        WHERE value.organization_id=?) AS settlements,
      (SELECT COUNT(*) FROM health_medical_settlement value
        WHERE value.organization_id=?) AS settlementLinks,
      (SELECT SUM(total_expenses) FROM (
        SELECT legacy_settlement_id,MAX(total_expenses) AS total_expenses
        FROM health_medical_settlement value WHERE value.organization_id=?
        GROUP BY legacy_settlement_id)) AS totalExpenses
      FROM health_medical_advance WHERE organization_id=?`)
      .bind(
        context.organizationId,
        context.organizationId,
        context.organizationId,
        context.organizationId,
        context.organizationId,
      )
      .first<{
        advances: number;
        advanceAmount: number;
        patientAllocations: number;
        settlements: number;
        settlementLinks: number;
        totalExpenses: number;
        firstSanctionOn: string | null;
        lastSanctionOn: string | null;
      }>(),
    runtime.DATABASE.prepare(
      `SELECT COUNT(*) AS total FROM health_medical_advance advance WHERE ${where}`,
    )
      .bind(...bindings)
      .first<{ total: number }>(),
    runtime.DATABASE.prepare(`SELECT advance.id,advance.sanctioned_on AS sanctionedOn,
      advance.nurse_name AS nurseName,advance.sanction_number AS sanctionNumber,
      advance.advance_amount AS advanceAmount,
      advance.referring_doctor_name AS referringDoctorName,
      advance.referral_location AS referralLocation,advance.remarks,
      coalesce((SELECT json_group_array(json_object(
        'id',detail.id,'personId',detail.person_id,'patientName',detail.patient_name,
        'patientKind',detail.patient_kind,'sanctionType',detail.sanction_type,
        'homeName',detail.home_name,'gender',detail.gender,'ageAtSanction',detail.age_at_sanction,
        'medication',detail.medication,'referredToDoctorName',detail.referred_to_doctor_name,
        'hospitalRegistrationNumber',detail.hospital_registration_number,
        'hospitalReferredTo',detail.hospital_referred_to,
        'hospitalAdmitted',detail.hospital_admitted,'diagnosis',detail.diagnosis,
        'admittedOn',detail.admitted_on,'dischargedOn',detail.discharged_on,
        'surgeryType',detail.surgery_type,'amount',detail.amount,'remarks',detail.remarks))
        FROM health_medical_advance_detail detail
        WHERE detail.medical_advance_id=advance.id), '[]') AS detailsJson,
      coalesce((SELECT json_group_array(json_object(
        'id',value.id,'settledOn',value.settled_on,'billNumber',value.bill_number,
        'nurseTada',value.nurse_tada,'totalExpenses',value.total_expenses,
        'extraExpenses',value.extra_expenses,'balance',value.balance,'remarks',value.remarks))
        FROM health_medical_settlement value
        WHERE value.medical_advance_id=advance.id), '[]') AS settlementsJson
      FROM health_medical_advance advance WHERE ${where}
      ORDER BY advance.sanctioned_on DESC,advance.sanction_number
      LIMIT ? OFFSET ?`)
      .bind(...bindings, pageSize, (page - 1) * pageSize)
      .all<{ detailsJson: string; settlementsJson: string; [key: string]: unknown }>(),
  ]);
  const total = Number(count?.total ?? 0);
  return Response.json({
    summary: {
      advances: Number(summary?.advances ?? 0),
      advanceAmount: Number(summary?.advanceAmount ?? 0),
      patientAllocations: Number(summary?.patientAllocations ?? 0),
      settlements: Number(summary?.settlements ?? 0),
      settlementLinks: Number(summary?.settlementLinks ?? 0),
      totalExpenses: Number(summary?.totalExpenses ?? 0),
      firstSanctionOn: summary?.firstSanctionOn ?? null,
      lastSanctionOn: summary?.lastSanctionOn ?? null,
    },
    advances: rows.results.map(({ detailsJson, settlementsJson, ...row }) => ({
      ...row,
      details: JSON.parse(detailsJson) as unknown[],
      settlements: JSON.parse(settlementsJson) as unknown[],
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

async function getSchoolSessionScope(request: Request, sessionId: string) {
  const context = await getMembershipContext(request);
  if (!context) return null;
  if (!hasPermission(context, "school.read")) return null;
  const runtime = getRuntimeEnv();
  const session = await runtime.DATABASE.prepare(
    `SELECT id, name, starts_on AS startsOn, ends_on AS endsOn
     FROM academic_session WHERE id = ? AND organization_id = ? AND is_active = 1`,
  )
    .bind(sessionId, context.organizationId)
    .first<{ id: string; name: string; startsOn: string; endsOn: string }>();
  return session ? { ...context, session } : null;
}

async function getPeopleRegistry(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "people.read")) return forbidden();

  const url = new URL(request.url);
  const parsed = peopleQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    kind: url.searchParams.get("kind") ?? "all",
    status: url.searchParams.get("status") ?? "all",
    page: url.searchParams.get("page") ?? "1",
    pageSize: url.searchParams.get("pageSize") ?? "25",
  });
  if (!parsed.success) {
    return Response.json({ error: "Check the people filters." }, { status: 400 });
  }

  const { q, kind, status, page, pageSize } = parsed.data;
  const conditions = ["organization_id = ?"];
  const bindings: Array<string | number> = [context.organizationId];

  if (kind !== "all") {
    conditions.push("kind = ?");
    bindings.push(kind);
  }
  if (status !== "all") {
    conditions.push("status = ?");
    bindings.push(status);
  }
  if (q) {
    const search = `%${escapeLikePattern(q.toLowerCase())}%`;
    conditions.push(
      `(lower(display_name) LIKE ? ESCAPE '\\' OR lower(primary_identifier) LIKE ? ESCAPE '\\')`,
    );
    bindings.push(search, search);
  }

  const where = conditions.join(" AND ");
  const offset = (page - 1) * pageSize;
  const runtime = getRuntimeEnv();
  const [count, people, summary, latestImport] = await Promise.all([
    runtime.DATABASE.prepare(`SELECT COUNT(*) AS total FROM person WHERE ${where}`)
      .bind(...bindings)
      .first<{ total: number }>(),
    runtime.DATABASE.prepare(
      `SELECT id, kind, status, identifier_kind AS identifierKind,
              primary_identifier AS primaryIdentifier, display_name AS displayName,
              gender, date_of_birth AS dateOfBirth,
              admitted_or_joined_on AS admittedOrJoinedOn,
              campus_or_location AS campusOrLocation,
              source_system AS sourceSystem, source_table AS sourceTable,
              source_id AS sourceId, imported_at AS importedAt
       FROM person WHERE ${where}
       ORDER BY display_name COLLATE NOCASE, primary_identifier
       LIMIT ? OFFSET ?`,
    )
      .bind(...bindings, pageSize, offset)
      .all<{
        id: string;
        kind: "child" | "elderly" | "staff";
        status: "active" | "inactive";
        identifierKind: "admission" | "staff";
        primaryIdentifier: string;
        displayName: string;
        gender: "female" | "male" | "other" | "unknown" | null;
        dateOfBirth: string | null;
        admittedOrJoinedOn: string | null;
        campusOrLocation: string | null;
        sourceSystem: string;
        sourceTable: string;
        sourceId: string;
        importedAt: string | null;
      }>(),
    runtime.DATABASE.prepare(
      `SELECT kind, status, COUNT(*) AS count
       FROM person WHERE organization_id = ? GROUP BY kind, status`,
    )
      .bind(context.organizationId)
      .all<{
        kind: "child" | "elderly" | "staff";
        status: "active" | "inactive";
        count: number;
      }>(),
    runtime.DATABASE.prepare(
      `SELECT id, source_system AS sourceSystem, mode, status,
              source_count AS sourceCount, eligible_count AS eligibleCount,
              imported_count AS importedCount,
              skipped_count AS skippedCount, issue_count AS issueCount,
              created_at AS createdAt, finished_at AS finishedAt
       FROM person_import_batch WHERE organization_id = ?
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(context.organizationId)
      .first<{
        id: string;
        sourceSystem: string;
        mode: "dry_run" | "import";
        status: "pending" | "running" | "completed" | "failed";
        sourceCount: number;
        eligibleCount: number;
        importedCount: number;
        skippedCount: number;
        issueCount: number;
        createdAt: string;
        finishedAt: string | null;
      }>(),
  ]);

  const total = Number(count?.total ?? 0);
  return Response.json({
    people: people.results,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    summary: summary.results,
    latestImport,
  });
}

async function handlePersonProfile(request: Request, personId: string): Promise<Response> {
  if (request.method === "GET") return getPersonProfile(request, personId);
  if (request.method === "PATCH") return updatePersonCoreDetails(request, personId);
  return methodNotAllowed("GET, PATCH");
}

async function getPersonProfile(request: Request, personId: string): Promise<Response> {
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "people.read")) return forbidden();

  const parsedId = personIdSchema.safeParse(personId);
  if (!parsedId.success) {
    return Response.json({ error: "Invalid person ID" }, { status: 400 });
  }

  const runtime = getRuntimeEnv();
  const [
    person,
    placements,
    academicRecords,
    schoolEnrollments,
    familyProfile,
    relationships,
    files,
  ] = await Promise.all([
    runtime.DATABASE.prepare(
      `SELECT id, kind, status, identifier_kind AS identifierKind,
              primary_identifier AS primaryIdentifier, display_name AS displayName,
              gender, date_of_birth AS dateOfBirth,
              admitted_or_joined_on AS admittedOrJoinedOn,
              campus_or_location AS campusOrLocation, nationality,
              CASE WHEN photo_asset_key IS NULL THEN 0 ELSE 1 END AS photoReferencePresent,
              source_system AS sourceSystem, source_table AS sourceTable,
              source_id AS sourceId, imported_at AS importedAt,
              CASE WHEN date_of_birth IS NULL THEN 1 ELSE 0 END AS dateOfBirthMissing,
              CASE WHEN admitted_or_joined_on IS NULL THEN 1 ELSE 0 END AS eventDateMissing,
              CASE WHEN date(admitted_or_joined_on) < '1900-01-01' THEN 1 ELSE 0 END AS eventDateBefore1900,
              CASE WHEN date(admitted_or_joined_on) < date(date_of_birth) THEN 1 ELSE 0 END AS eventBeforeBirth
       FROM person
       WHERE id = ? AND organization_id = ?`,
    )
      .bind(parsedId.data, context.organizationId)
      .first<{
        id: string;
        kind: "child" | "elderly" | "staff";
        status: "active" | "inactive";
        identifierKind: "admission" | "staff";
        primaryIdentifier: string;
        displayName: string;
        gender: "female" | "male" | "other" | "unknown" | null;
        dateOfBirth: string | null;
        admittedOrJoinedOn: string | null;
        campusOrLocation: string | null;
        nationality: string | null;
        photoReferencePresent: number;
        sourceSystem: string;
        sourceTable: string;
        sourceId: string;
        importedAt: string | null;
        dateOfBirthMissing: number;
        eventDateMissing: number;
        eventDateBefore1900: number;
        eventBeforeBirth: number;
      }>(),
    runtime.DATABASE.prepare(
      `SELECT id, home_name AS homeName, location_name AS locationName,
              placement_type AS placementType, started_on AS startedOn,
              ended_on AS endedOn, reason, remarks, is_current AS isCurrent,
              source_id AS sourceId
       FROM person_placement
       WHERE person_id = ? AND organization_id = ?
       ORDER BY is_current DESC, date(started_on) DESC, CAST(source_id AS INTEGER) DESC`,
    )
      .bind(parsedId.data, context.organizationId)
      .all<{
        id: string;
        homeName: string;
        locationName: string | null;
        placementType: string | null;
        startedOn: string;
        endedOn: string | null;
        reason: string | null;
        remarks: string | null;
        isCurrent: number;
        sourceId: string;
      }>(),
    runtime.DATABASE.prepare(
      `SELECT id, class_name AS className, class_level AS classLevel,
              class_section AS classSection, class_title AS classTitle,
              school_name AS schoolName, house_name AS houseName,
              academic_session AS academicSession, recorded_on AS recordedOn,
              result, roll_number AS rollNumber,
              board_registration_number AS boardRegistrationNumber,
              description, is_latest AS isLatest, source_id AS sourceId
       FROM person_academic_record
       WHERE person_id = ? AND organization_id = ?
       ORDER BY is_latest DESC, date(recorded_on) DESC, CAST(source_id AS INTEGER) DESC`,
    )
      .bind(parsedId.data, context.organizationId)
      .all<{
        id: string;
        className: string;
        classLevel: number | null;
        classSection: string | null;
        classTitle: string | null;
        schoolName: string | null;
        houseName: string | null;
        academicSession: string;
        recordedOn: string;
        result: string | null;
        rollNumber: string | null;
        boardRegistrationNumber: string | null;
        description: string | null;
        isLatest: number;
        sourceId: string;
      }>(),
    runtime.DATABASE.prepare(
      `SELECT enrollment.id, session.name AS academicSession,
                session.starts_on AS sessionStartsOn, session.ends_on AS sessionEndsOn,
                school.name AS schoolName, ${classDisplayName("class")} AS className,
                house.name AS houseName, enrollment.roll_number AS rollNumber,
                enrollment.status, enrollment.started_on AS startedOn,
                coalesce(end_change.effective_on, enrollment.ended_on) AS endedOn,
                end_change.note AS endReason
         FROM student_enrollment enrollment
         JOIN academic_session session ON session.id = enrollment.academic_session_id
           AND session.organization_id = enrollment.organization_id
         JOIN academic_class_master class ON class.id = enrollment.academic_class_id
           AND class.organization_id = enrollment.organization_id
         LEFT JOIN school_master school ON school.id = enrollment.school_id
           AND school.organization_id = enrollment.organization_id
         LEFT JOIN house_master house ON house.id = enrollment.house_id
           AND house.organization_id = enrollment.organization_id
         LEFT JOIN student_enrollment_change end_change ON end_change.id = (
           SELECT change.id FROM student_enrollment_change change
           WHERE change.organization_id = enrollment.organization_id
             AND change.enrollment_id = enrollment.id
             AND change.change_type IN ('withdrawn', 'completed', 'transferred')
           ORDER BY change.created_at DESC LIMIT 1
         )
         WHERE enrollment.person_id = ? AND enrollment.organization_id = ?
         ORDER BY date(session.starts_on) DESC, enrollment.created_at DESC`,
    )
      .bind(parsedId.data, context.organizationId)
      .all<{
        id: string;
        academicSession: string;
        sessionStartsOn: string;
        sessionEndsOn: string;
        schoolName: string | null;
        className: string;
        houseName: string | null;
        rollNumber: string | null;
        status: "recorded" | "enrolled" | "transferred" | "withdrawn" | "completed" | "graduated";
        startedOn: string;
        endedOn: string | null;
        endReason: string | null;
      }>(),
    runtime.DATABASE.prepare(
      `SELECT parentage_status AS parentageStatus,
              mother_name AS motherName, father_name AS fatherName,
              mother_occupation AS motherOccupation,
              father_occupation AS fatherOccupation,
              parents_phone AS parentsPhone,
              parents_permanent_address AS parentsPermanentAddress,
              guardian_1_name AS guardian1Name,
              guardian_1_address AS guardian1Address,
              guardian_1_email AS guardian1Email,
              guardian_1_phone AS guardian1Phone,
              guardian_1_mobile AS guardian1Mobile,
              guardian_2_name AS guardian2Name,
              guardian_2_address AS guardian2Address,
              guardian_2_email AS guardian2Email,
              guardian_2_phone AS guardian2Phone,
              guardian_2_mobile AS guardian2Mobile,
              marital_status AS maritalStatus, spouse_name AS spouseName,
              number_of_children AS numberOfChildren
       FROM person_family_profile
       WHERE person_id = ? AND organization_id = ?`,
    )
      .bind(parsedId.data, context.organizationId)
      .first<{
        parentageStatus: string | null;
        motherName: string | null;
        fatherName: string | null;
        motherOccupation: string | null;
        fatherOccupation: string | null;
        parentsPhone: string | null;
        parentsPermanentAddress: string | null;
        guardian1Name: string | null;
        guardian1Address: string | null;
        guardian1Email: string | null;
        guardian1Phone: string | null;
        guardian1Mobile: string | null;
        guardian2Name: string | null;
        guardian2Address: string | null;
        guardian2Email: string | null;
        guardian2Phone: string | null;
        guardian2Mobile: string | null;
        maritalStatus: string | null;
        spouseName: string | null;
        numberOfChildren: string | null;
      }>(),
    runtime.DATABASE.prepare(
      `WITH reciprocal_relationships AS (
         SELECT relationship.*,
                CASE
                  WHEN relationship.person_id = ? THEN relationship.related_person_id
                  ELSE relationship.person_id
                END AS counterpart_id
         FROM person_relationship AS relationship
         WHERE relationship.organization_id = ?
           AND relationship.relationship_type = 'sibling'
           AND relationship.is_active = 1
           AND (relationship.person_id = ? OR relationship.related_person_id = ?)
       ), ranked_relationships AS (
         SELECT reciprocal_relationships.*,
                ROW_NUMBER() OVER (
                  PARTITION BY counterpart_id
                  ORDER BY
                    CASE WHEN review_flag IS NULL THEN 1 ELSE 0 END,
                    CAST(source_id AS INTEGER), id
                ) AS relationship_rank
         FROM reciprocal_relationships
       )
       SELECT relationship.id, relationship.relationship_type AS relationshipType,
              relationship.review_flag AS reviewFlag,
              related.id AS personId, related.display_name AS displayName,
              related.primary_identifier AS primaryIdentifier,
              related.identifier_kind AS identifierKind,
              related.kind, related.status
       FROM ranked_relationships AS relationship
       JOIN person AS related
         ON related.id = relationship.counterpart_id
        AND related.organization_id = relationship.organization_id
       WHERE relationship.relationship_rank = 1
       ORDER BY related.display_name COLLATE NOCASE, relationship.source_id`,
    )
      .bind(parsedId.data, context.organizationId, parsedId.data, parsedId.data)
      .all<{
        id: string;
        relationshipType: "sibling";
        reviewFlag: "self_reference" | "duplicate_source_link" | null;
        personId: string;
        displayName: string;
        primaryIdentifier: string;
        identifierKind: "admission" | "staff";
        kind: "child" | "elderly" | "staff";
        status: "active" | "inactive";
      }>(),
    runtime.DATABASE.prepare(
      `SELECT id, category, label, file_name AS fileName,
              content_type AS contentType, byte_size AS byteSize,
              is_primary AS isPrimary
       FROM person_file
       WHERE person_id = ? AND organization_id = ? AND is_active = 1
       ORDER BY
         CASE category
           WHEN 'profile_photo' THEN 0
           WHEN 'parents_photo' THEN 1
           WHEN 'guardian_1_photo' THEN 2
           WHEN 'guardian_2_photo' THEN 3
           ELSE 4
         END,
         label COLLATE NOCASE, source_id`,
    )
      .bind(parsedId.data, context.organizationId)
      .all<{
        id: string;
        category:
          | "profile_photo"
          | "parents_photo"
          | "guardian_1_photo"
          | "guardian_2_photo"
          | "document";
        label: string;
        fileName: string;
        contentType: string;
        byteSize: number;
        isPrimary: number;
      }>(),
  ]);

  if (!person) return Response.json({ error: "Person not found" }, { status: 404 });

  const canEdit = hasPermission(context, "people.update");

  const reviewFlags = [
    person.dateOfBirthMissing ? "date_of_birth_missing" : null,
    person.eventDateMissing ? "event_date_missing" : null,
    person.eventDateBefore1900 ? "event_date_before_1900" : null,
    person.eventBeforeBirth ? "event_before_birth" : null,
  ].filter((flag): flag is string => Boolean(flag));

  return Response.json({
    person: {
      id: person.id,
      kind: person.kind,
      status: person.status,
      identifierKind: person.identifierKind,
      primaryIdentifier: person.primaryIdentifier,
      displayName: person.displayName,
      gender: person.gender,
      dateOfBirth: person.dateOfBirth,
      admittedOrJoinedOn: person.admittedOrJoinedOn,
      campusOrLocation: person.campusOrLocation,
      nationality: person.nationality,
      photoReferencePresent: Boolean(person.photoReferencePresent),
      sourceSystem: person.sourceSystem,
      sourceTable: person.sourceTable,
      sourceId: person.sourceId,
      importedAt: person.importedAt,
      canEdit,
      editRestriction: canEdit ? null : "permission",
      reviewFlags,
      placements: placements.results.map((placement) => ({
        id: placement.id,
        homeName: placement.homeName,
        locationName: placement.locationName,
        placementType: placement.placementType,
        startedOn: placement.startedOn,
        endedOn: placement.endedOn,
        reason: placement.reason,
        remarks: placement.remarks,
        isCurrent: Boolean(placement.isCurrent),
        sourceId: placement.sourceId,
      })),
      academicRecords: academicRecords.results.map((record) => ({
        id: record.id,
        className: record.className,
        classLevel: record.classLevel,
        classSection: record.classSection,
        classTitle: record.classTitle,
        schoolName: record.schoolName,
        houseName: record.houseName,
        academicSession: record.academicSession,
        recordedOn: record.recordedOn,
        result: record.result,
        rollNumber: record.rollNumber,
        boardRegistrationNumber: record.boardRegistrationNumber,
        description: record.description,
        isLatest: Boolean(record.isLatest),
        sourceId: record.sourceId,
      })),
      schoolEnrollments: schoolEnrollments.results.map((enrollment) => ({
        ...enrollment,
        canCorrectEndDetails:
          canEdit && ["withdrawn", "completed", "graduated"].includes(enrollment.status),
      })),
      family: familyProfile ?? null,
      relationships: relationships.results,
      files: files.results.map((file) => ({
        ...file,
        isPrimary: Boolean(file.isPrimary),
        url: `/api/files/${file.id}`,
      })),
    },
  });
}

async function updatePersonCoreDetails(request: Request, personId: string): Promise<Response> {
  if (!isSameOrigin(request)) return forbidden();

  const parsedId = personIdSchema.safeParse(personId);
  if (!parsedId.success) {
    return Response.json({ error: "Invalid person ID" }, { status: 400 });
  }

  const parsed = personCoreDetailsSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Check the person details and try again." }, { status: 400 });
  }

  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "people.update")) return forbidden();

  const runtime = getRuntimeEnv();
  const current = await runtime.DATABASE.prepare(
    `SELECT id, identifier_kind AS identifierKind,
            primary_identifier AS primaryIdentifier, display_name AS displayName,
            gender, date_of_birth AS dateOfBirth,
            admitted_or_joined_on AS admittedOrJoinedOn,
            campus_or_location AS campusOrLocation, nationality, source_system AS sourceSystem
     FROM person WHERE id = ? AND organization_id = ?`,
  )
    .bind(parsedId.data, context.organizationId)
    .first<{
      id: string;
      identifierKind: "admission" | "staff";
      primaryIdentifier: string;
      displayName: string;
      gender: "female" | "male" | "other" | "unknown" | null;
      dateOfBirth: string | null;
      admittedOrJoinedOn: string | null;
      campusOrLocation: string | null;
      nationality: string | null;
      sourceSystem: string;
    }>();

  if (!current) return Response.json({ error: "Person not found" }, { status: 404 });
  const duplicate = await runtime.DATABASE.prepare(
    `SELECT id FROM person
     WHERE organization_id = ? AND identifier_kind = ? AND id <> ?
       AND lower(primary_identifier) = lower(?)`,
  )
    .bind(
      context.organizationId,
      current.identifierKind,
      parsedId.data,
      parsed.data.primaryIdentifier,
    )
    .first<{ id: string }>();
  if (duplicate) {
    const label = current.identifierKind === "staff" ? "staff number" : "admission number";
    return Response.json({ error: `That ${label} is already in use.` }, { status: 409 });
  }

  const next = parsed.data;
  const changedFields = (
    [
      ["primaryIdentifier", current.primaryIdentifier, next.primaryIdentifier],
      ["displayName", current.displayName, next.displayName],
      ["gender", current.gender ?? "unknown", next.gender],
      ["dateOfBirth", current.dateOfBirth, next.dateOfBirth],
      ["admittedOrJoinedOn", current.admittedOrJoinedOn, next.admittedOrJoinedOn],
      ["campusOrLocation", current.campusOrLocation, next.campusOrLocation],
      ["nationality", current.nationality, next.nationality],
    ] as const
  )
    .filter(([, before, after]) => before !== after)
    .map(([field]) => field);

  if (!changedFields.length) {
    return Response.json({ personId: parsedId.data, changedFields });
  }

  try {
    await runtime.DATABASE.batch([
      runtime.DATABASE.prepare(
        `UPDATE person
         SET primary_identifier = ?, display_name = ?, gender = ?, date_of_birth = ?,
             admitted_or_joined_on = ?, campus_or_location = ?, nationality = ?,
             updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ?`,
      ).bind(
        next.primaryIdentifier,
        next.displayName,
        next.gender,
        next.dateOfBirth,
        next.admittedOrJoinedOn,
        next.campusOrLocation,
        next.nationality,
        context.userId,
        parsedId.data,
        context.organizationId,
      ),
      auditStatement(runtime.DATABASE, context, "person.details_updated", "person", parsedId.data, {
        changedFields: changedFields.join(","),
        sourceSystem: current.sourceSystem,
      }),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return Response.json({ error: "That identifier is already in use." }, { status: 409 });
    }
    throw error;
  }

  return Response.json({ personId: parsedId.data, changedFields });
}

async function addHomePlacement(request: Request, personId: string): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return forbidden();

  const parsedId = personIdSchema.safeParse(personId);
  const parsed = homePlacementSchema.safeParse(await readJson(request));
  if (!parsedId.success || !parsed.success) {
    return Response.json({ error: "Check the placement details and try again." }, { status: 400 });
  }

  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "people.placement.manage")) return forbidden();

  const runtime = getRuntimeEnv();
  const [person, current] = await Promise.all([
    runtime.DATABASE.prepare(`SELECT id, kind FROM person WHERE id = ? AND organization_id = ?`)
      .bind(parsedId.data, context.organizationId)
      .first<{ id: string; kind: "child" | "elderly" | "staff" }>(),
    runtime.DATABASE.prepare(
      `SELECT id, home_name AS homeName, location_name AS locationName,
              placement_type AS placementType, started_on AS startedOn
       FROM person_placement
       WHERE person_id = ? AND organization_id = ? AND is_current = 1`,
    )
      .bind(parsedId.data, context.organizationId)
      .first<{
        id: string;
        homeName: string;
        locationName: string | null;
        placementType: string | null;
        startedOn: string;
      }>(),
  ]);

  if (!person) return Response.json({ error: "Person not found" }, { status: 404 });
  if (person.kind === "staff") {
    return Response.json({ error: "Home placement is not used for staff." }, { status: 400 });
  }

  const placement = parsed.data;
  if (
    current &&
    current.homeName === placement.homeName &&
    current.locationName === placement.locationName &&
    current.placementType === placement.placementType &&
    current.startedOn === placement.startedOn
  ) {
    return Response.json({ error: "This is already the current placement." }, { status: 409 });
  }

  const placementId = crypto.randomUUID();
  const statements: DrizzleStatement[] = [];
  if (current) {
    statements.push(
      runtime.DATABASE.prepare(
        `UPDATE person_placement
         SET is_current = 0, ended_on = ?, updated_by_user_id = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ? AND is_current = 1`,
      ).bind(placement.startedOn, context.userId, current.id, context.organizationId),
    );
  }
  statements.push(
    runtime.DATABASE.prepare(
      `INSERT INTO person_placement (
         id, organization_id, person_id, home_name, location_name, placement_type,
         started_on, reason, remarks, is_current, source_system, source_table,
         source_id, created_by_user_id, updated_by_user_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'tsewa', 'person_placement', ?, ?, ?)`,
    ).bind(
      placementId,
      context.organizationId,
      parsedId.data,
      placement.homeName,
      placement.locationName,
      placement.placementType,
      placement.startedOn,
      placement.reason,
      placement.remarks,
      placementId,
      context.userId,
      context.userId,
    ),
    runtime.DATABASE.prepare(
      `UPDATE person
       SET campus_or_location = ?, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
    ).bind(
      placement.locationName ?? placement.homeName,
      context.userId,
      parsedId.data,
      context.organizationId,
    ),
    auditStatement(
      runtime.DATABASE,
      context,
      "person.home_placement_changed",
      "person",
      parsedId.data,
      {
        placementId,
        previousPlacementId: current?.id ?? "none",
        homeName: placement.homeName,
        startedOn: placement.startedOn,
      },
    ),
  );

  try {
    await runtime.DATABASE.batch(statements);
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return Response.json(
        { error: "The placement changed while this form was open. Please try again." },
        { status: 409 },
      );
    }
    throw error;
  }

  return Response.json({ personId: parsedId.data, placementId }, { status: 201 });
}

async function updatePersonFamily(request: Request, personId: string): Promise<Response> {
  if (request.method !== "PATCH") return methodNotAllowed("PATCH");
  if (!isSameOrigin(request)) return forbidden();

  const parsedId = personIdSchema.safeParse(personId);
  const parsed = personFamilyDetailsSchema.safeParse(await readJson(request));
  if (!parsedId.success || !parsed.success) {
    return Response.json({ error: "Check the family details and try again." }, { status: 400 });
  }

  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "people.family.manage")) return forbidden();

  const runtime = getRuntimeEnv();
  const person = await runtime.DATABASE.prepare(
    `SELECT id FROM person WHERE id = ? AND organization_id = ?`,
  )
    .bind(parsedId.data, context.organizationId)
    .first<{ id: string }>();
  if (!person) return Response.json({ error: "Person not found" }, { status: 404 });

  const current = await runtime.DATABASE.prepare(
    `SELECT id, source_system AS sourceSystem,
            parentage_status AS parentageStatus, mother_name AS motherName,
            father_name AS fatherName, mother_occupation AS motherOccupation,
            father_occupation AS fatherOccupation, parents_phone AS parentsPhone,
            parents_permanent_address AS parentsPermanentAddress,
            guardian_1_name AS guardian1Name, guardian_1_address AS guardian1Address,
            guardian_1_email AS guardian1Email, guardian_1_phone AS guardian1Phone,
            guardian_1_mobile AS guardian1Mobile, guardian_2_name AS guardian2Name,
            guardian_2_address AS guardian2Address, guardian_2_email AS guardian2Email,
            guardian_2_phone AS guardian2Phone, guardian_2_mobile AS guardian2Mobile,
            marital_status AS maritalStatus, spouse_name AS spouseName,
            number_of_children AS numberOfChildren
     FROM person_family_profile WHERE person_id = ? AND organization_id = ?`,
  )
    .bind(parsedId.data, context.organizationId)
    .first<FamilyDetailsRecord>();

  const familyFieldNames = Object.keys(parsed.data) as Array<keyof typeof parsed.data>;
  const changedFields = familyFieldNames.filter(
    (field) => (current?.[field] ?? null) !== parsed.data[field],
  );
  if (!changedFields.length) {
    return Response.json({ personId: parsedId.data, changedFields });
  }

  const profileId = current?.id ?? crypto.randomUUID();
  const details = parsed.data;
  await runtime.DATABASE.batch([
    runtime.DATABASE.prepare(
      `INSERT INTO person_family_profile (
         id, organization_id, person_id, parentage_status, mother_name, father_name,
         mother_occupation, father_occupation, parents_phone, parents_permanent_address,
         guardian_1_name, guardian_1_address, guardian_1_email, guardian_1_phone,
         guardian_1_mobile, guardian_2_name, guardian_2_address, guardian_2_email,
         guardian_2_phone, guardian_2_mobile, marital_status, spouse_name,
         number_of_children, source_system, source_table, source_id, updated_by_user_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
         'tsewa', 'person_family_profile', ?, ?)
       ON CONFLICT(organization_id, person_id) DO UPDATE SET
         parentage_status = excluded.parentage_status, mother_name = excluded.mother_name,
         father_name = excluded.father_name, mother_occupation = excluded.mother_occupation,
         father_occupation = excluded.father_occupation, parents_phone = excluded.parents_phone,
         parents_permanent_address = excluded.parents_permanent_address,
         guardian_1_name = excluded.guardian_1_name,
         guardian_1_address = excluded.guardian_1_address,
         guardian_1_email = excluded.guardian_1_email,
         guardian_1_phone = excluded.guardian_1_phone,
         guardian_1_mobile = excluded.guardian_1_mobile,
         guardian_2_name = excluded.guardian_2_name,
         guardian_2_address = excluded.guardian_2_address,
         guardian_2_email = excluded.guardian_2_email,
         guardian_2_phone = excluded.guardian_2_phone,
         guardian_2_mobile = excluded.guardian_2_mobile,
         marital_status = excluded.marital_status, spouse_name = excluded.spouse_name,
         number_of_children = excluded.number_of_children,
         updated_by_user_id = excluded.updated_by_user_id, updated_at = CURRENT_TIMESTAMP`,
    ).bind(
      profileId,
      context.organizationId,
      parsedId.data,
      details.parentageStatus,
      details.motherName,
      details.fatherName,
      details.motherOccupation,
      details.fatherOccupation,
      details.parentsPhone,
      details.parentsPermanentAddress,
      details.guardian1Name,
      details.guardian1Address,
      details.guardian1Email,
      details.guardian1Phone,
      details.guardian1Mobile,
      details.guardian2Name,
      details.guardian2Address,
      details.guardian2Email,
      details.guardian2Phone,
      details.guardian2Mobile,
      details.maritalStatus,
      details.spouseName,
      details.numberOfChildren,
      profileId,
      context.userId,
    ),
    auditStatement(runtime.DATABASE, context, "person.family_updated", "person", parsedId.data, {
      changedFields: changedFields.join(","),
      sourceSystem: current?.sourceSystem ?? "tsewa",
    }),
  ]);

  return Response.json({ personId: parsedId.data, changedFields });
}

type FamilyDetailsRecord = z.infer<typeof personFamilyDetailsSchema> & {
  id: string;
  sourceSystem: string;
};

async function getSiblingOptions(request: Request, personId: string): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const parsedId = personIdSchema.safeParse(personId);
  const parsedQuery = siblingOptionsQuerySchema.safeParse({
    q: new URL(request.url).searchParams.get("q") ?? "",
  });
  if (!parsedId.success || !parsedQuery.success) {
    return Response.json({ error: "Check the sibling search." }, { status: 400 });
  }

  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "people.read")) return forbidden();
  const runtime = getRuntimeEnv();
  const person = await runtime.DATABASE.prepare(
    `SELECT id FROM person WHERE id = ? AND organization_id = ?`,
  )
    .bind(parsedId.data, context.organizationId)
    .first<{ id: string }>();
  if (!person) return Response.json({ error: "Person not found" }, { status: 404 });

  const bindings: Array<string> = [
    context.organizationId,
    parsedId.data,
    context.organizationId,
    parsedId.data,
    parsedId.data,
  ];
  const conditions = [
    "candidate.organization_id = ?",
    "candidate.id <> ?",
    `NOT EXISTS (
       SELECT 1 FROM person_relationship relationship
       WHERE relationship.organization_id = ? AND relationship.relationship_type = 'sibling'
         AND relationship.is_active = 1
         AND ((relationship.person_id = ? AND relationship.related_person_id = candidate.id)
           OR (relationship.related_person_id = ? AND relationship.person_id = candidate.id))
     )`,
  ];
  if (parsedQuery.data.q) {
    const search = `%${escapeLikePattern(parsedQuery.data.q.toLowerCase())}%`;
    conditions.push(
      `(lower(candidate.display_name) LIKE ? ESCAPE '\\' OR lower(candidate.primary_identifier) LIKE ? ESCAPE '\\')`,
    );
    bindings.push(search, search);
  }

  const candidates = await runtime.DATABASE.prepare(
    `SELECT candidate.id, candidate.display_name AS displayName,
            candidate.primary_identifier AS primaryIdentifier,
            candidate.identifier_kind AS identifierKind, candidate.kind, candidate.status
     FROM person candidate
     WHERE ${conditions.join(" AND ")}
     ORDER BY candidate.display_name COLLATE NOCASE, candidate.primary_identifier
     LIMIT 20`,
  )
    .bind(...bindings)
    .all();

  return Response.json({ people: candidates.results });
}

async function addSiblingRelationship(request: Request, personId: string): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return forbidden();
  const parsedId = personIdSchema.safeParse(personId);
  const parsed = siblingLinkSchema.safeParse(await readJson(request));
  if (!parsedId.success || !parsed.success) {
    return Response.json({ error: "Check the sibling details and try again." }, { status: 400 });
  }

  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "people.family.manage")) return forbidden();
  const runtime = getRuntimeEnv();
  const person = await runtime.DATABASE.prepare(
    `SELECT id FROM person WHERE id = ? AND organization_id = ?`,
  )
    .bind(parsedId.data, context.organizationId)
    .first<{ id: string }>();
  if (!person) return Response.json({ error: "Person not found" }, { status: 404 });

  let relatedPersonId: string;
  let createdPersonId: string | null = null;
  if (parsed.data.mode === "existing") {
    if (parsed.data.relatedPersonId === parsedId.data) {
      return Response.json({ error: "A person cannot be their own sibling." }, { status: 400 });
    }
    const related = await runtime.DATABASE.prepare(
      `SELECT id FROM person WHERE id = ? AND organization_id = ?`,
    )
      .bind(parsed.data.relatedPersonId, context.organizationId)
      .first<{ id: string }>();
    if (!related) return Response.json({ error: "Sibling not found" }, { status: 404 });
    relatedPersonId = related.id;
  } else {
    const duplicate = await runtime.DATABASE.prepare(
      `SELECT id FROM person WHERE organization_id = ? AND identifier_kind = 'admission'
         AND lower(primary_identifier) = lower(?)`,
    )
      .bind(context.organizationId, parsed.data.primaryIdentifier)
      .first<{ id: string }>();
    if (duplicate) {
      return Response.json(
        {
          error: "That admission number already belongs to a person. Search and link them instead.",
        },
        { status: 409 },
      );
    }
    relatedPersonId = crypto.randomUUID();
    createdPersonId = relatedPersonId;
  }

  const existing = await runtime.DATABASE.prepare(
    `SELECT id FROM person_relationship
     WHERE organization_id = ? AND relationship_type = 'sibling' AND is_active = 1
       AND ((person_id = ? AND related_person_id = ?)
         OR (person_id = ? AND related_person_id = ?))
     LIMIT 1`,
  )
    .bind(context.organizationId, parsedId.data, relatedPersonId, relatedPersonId, parsedId.data)
    .first<{ id: string }>();
  if (existing)
    return Response.json(
      { error: "These people are already linked as siblings." },
      { status: 409 },
    );

  const relationshipId = crypto.randomUUID();
  const statements: DrizzleStatement[] = [];
  if (parsed.data.mode === "new") {
    statements.push(
      runtime.DATABASE.prepare(
        `INSERT INTO person (
           id, organization_id, kind, status, identifier_kind, primary_identifier,
           display_name, gender, source_system, source_table, source_id,
           created_by_user_id, updated_by_user_id
         ) VALUES (?, ?, 'child', 'active', 'admission', ?, ?, ?, 'tsewa', 'person', ?, ?, ?)`,
      ).bind(
        relatedPersonId,
        context.organizationId,
        parsed.data.primaryIdentifier,
        parsed.data.displayName,
        parsed.data.gender,
        relatedPersonId,
        context.userId,
        context.userId,
      ),
      auditStatement(
        runtime.DATABASE,
        context,
        "person.created_as_sibling",
        "person",
        relatedPersonId,
        {
          linkedFromPersonId: parsedId.data,
        },
      ),
    );
  }
  statements.push(
    runtime.DATABASE.prepare(
      `INSERT INTO person_relationship (
         id, organization_id, person_id, related_person_id, relationship_type,
         source_system, source_table, source_id, updated_by_user_id
       ) VALUES (?, ?, ?, ?, 'sibling', 'tsewa', 'person_relationship', ?, ?)`,
    ).bind(
      relationshipId,
      context.organizationId,
      parsedId.data,
      relatedPersonId,
      relationshipId,
      context.userId,
    ),
    auditStatement(
      runtime.DATABASE,
      context,
      "person.sibling_added",
      "person_relationship",
      relationshipId,
      {
        personId: parsedId.data,
        relatedPersonId,
      },
    ),
  );
  await runtime.DATABASE.batch(statements);

  return Response.json({ relationshipId, relatedPersonId, createdPersonId }, { status: 201 });
}

async function removeSiblingRelationship(
  request: Request,
  personId: string,
  relationshipId: string,
): Promise<Response> {
  if (request.method !== "DELETE") return methodNotAllowed("DELETE");
  if (!isSameOrigin(request)) return forbidden();
  const parsedPersonId = personIdSchema.safeParse(personId);
  const parsedRelationshipId = z.uuid().safeParse(relationshipId);
  if (!parsedPersonId.success || !parsedRelationshipId.success) {
    return Response.json({ error: "Invalid sibling link." }, { status: 400 });
  }

  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "people.family.manage")) return forbidden();
  const runtime = getRuntimeEnv();
  const relationship = await runtime.DATABASE.prepare(
    `SELECT id, person_id AS personId, related_person_id AS relatedPersonId
     FROM person_relationship
     WHERE id = ? AND organization_id = ? AND relationship_type = 'sibling'
       AND is_active = 1 AND (person_id = ? OR related_person_id = ?)`,
  )
    .bind(
      parsedRelationshipId.data,
      context.organizationId,
      parsedPersonId.data,
      parsedPersonId.data,
    )
    .first<{ id: string; personId: string; relatedPersonId: string }>();
  if (!relationship) return Response.json({ error: "Sibling link not found." }, { status: 404 });

  const relatedPersonId =
    relationship.personId === parsedPersonId.data
      ? relationship.relatedPersonId
      : relationship.personId;
  const count = await runtime.DATABASE.prepare(
    `SELECT COUNT(*) AS total FROM person_relationship
     WHERE organization_id = ? AND relationship_type = 'sibling' AND is_active = 1
       AND ((person_id = ? AND related_person_id = ?)
         OR (person_id = ? AND related_person_id = ?))`,
  )
    .bind(
      context.organizationId,
      parsedPersonId.data,
      relatedPersonId,
      relatedPersonId,
      parsedPersonId.data,
    )
    .first<{ total: number }>();

  await runtime.DATABASE.batch([
    runtime.DATABASE.prepare(
      `UPDATE person_relationship SET is_active = 0, removed_at = CURRENT_TIMESTAMP,
         updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = ? AND relationship_type = 'sibling' AND is_active = 1
         AND ((person_id = ? AND related_person_id = ?)
           OR (person_id = ? AND related_person_id = ?))`,
    ).bind(
      context.userId,
      context.organizationId,
      parsedPersonId.data,
      relatedPersonId,
      relatedPersonId,
      parsedPersonId.data,
    ),
    auditStatement(
      runtime.DATABASE,
      context,
      "person.sibling_removed",
      "person_relationship",
      relationship.id,
      {
        personId: parsedPersonId.data,
        relatedPersonId,
        hiddenSourceRows: String(Number(count?.total ?? 0)),
      },
    ),
  ]);

  return Response.json({ ok: true, relatedPersonId });
}

async function getPersonFile(request: Request, fileId: string): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "people.files.read")) return forbidden();

  const parsedId = fileIdSchema.safeParse(fileId);
  if (!parsedId.success) {
    return Response.json({ error: "Invalid file ID" }, { status: 400 });
  }

  const runtime = getRuntimeEnv();
  const file = await runtime.DATABASE.prepare(
    `SELECT r2_object_key AS r2ObjectKey, file_name AS fileName,
            content_type AS contentType, byte_size AS byteSize
     FROM person_file
     WHERE id = ? AND organization_id = ? AND is_active = 1`,
  )
    .bind(parsedId.data, context.organizationId)
    .first<{
      r2ObjectKey: string;
      fileName: string;
      contentType: string;
      byteSize: number;
    }>();
  if (!file) return Response.json({ error: "File not found" }, { status: 404 });

  const object = await runtime.FILES.get(file.r2ObjectKey);
  if (!object) return Response.json({ error: "Stored file not found" }, { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", file.contentType);
  headers.set("Content-Length", String(object.size));
  headers.set("Content-Disposition", inlineContentDisposition(file.fileName));
  headers.set("Cache-Control", "private, max-age=300");
  headers.set("ETag", object.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(object.body, { headers });
}

const MAX_PERSON_FILE_BYTES = 25 * 1024 * 1024;
const PHOTO_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DOCUMENT_CONTENT_TYPES = new Set([
  ...PHOTO_CONTENT_TYPES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

async function addPersonFile(request: Request, personId: string): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "people.files.manage")) return forbidden();

  const parsedPersonId = personIdSchema.safeParse(personId);
  if (!parsedPersonId.success)
    return Response.json({ error: "Invalid person ID" }, { status: 400 });

  const runtime = getRuntimeEnv();
  const person = await runtime.DATABASE.prepare(
    "SELECT id FROM person WHERE id = ? AND organization_id = ?",
  )
    .bind(parsedPersonId.data, context.organizationId)
    .first<{ id: string }>();
  if (!person) return Response.json({ error: "Person not found" }, { status: 404 });

  const parsed = await parsePersonFileForm(request);
  if (parsed instanceof Response) return parsed;

  if (parsed.category !== "document") {
    const existing = await runtime.DATABASE.prepare(
      `SELECT id FROM person_file
       WHERE organization_id = ? AND person_id = ? AND category = ? AND is_active = 1
       LIMIT 1`,
    )
      .bind(context.organizationId, parsedPersonId.data, parsed.category)
      .first<{ id: string }>();
    if (existing) {
      return Response.json(
        { error: "This photo already exists. Use Replace to change it." },
        { status: 409 },
      );
    }
  }

  return storePersonFile(runtime, context, parsedPersonId.data, parsed, null);
}

async function handlePersonFile(
  request: Request,
  personId: string,
  fileId: string,
): Promise<Response> {
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "people.files.manage")) return forbidden();

  const parsedPersonId = personIdSchema.safeParse(personId);
  const parsedFileId = fileIdSchema.safeParse(fileId);
  if (!parsedPersonId.success || !parsedFileId.success) {
    return Response.json({ error: "Invalid file ID" }, { status: 400 });
  }

  const runtime = getRuntimeEnv();
  const existing = await runtime.DATABASE.prepare(
    `SELECT id, category, label, file_name AS fileName, r2_object_key AS r2ObjectKey
     FROM person_file
     WHERE id = ? AND person_id = ? AND organization_id = ? AND is_active = 1`,
  )
    .bind(parsedFileId.data, parsedPersonId.data, context.organizationId)
    .first<{
      id: string;
      category: z.infer<typeof personFileCategorySchema>;
      label: string;
      fileName: string;
      r2ObjectKey: string;
    }>();
  if (!existing) return Response.json({ error: "File not found" }, { status: 404 });

  if (request.method === "PATCH") {
    const input = personFileNameSchema.safeParse(
      ((await request.json().catch(() => null)) as { name?: unknown } | null)?.name,
    );
    if (!input.success) {
      return Response.json(
        { error: "Enter a name between 1 and 160 characters." },
        { status: 400 },
      );
    }
    await runtime.DATABASE.batch([
      runtime.DATABASE.prepare(
        `UPDATE person_file SET label = ?, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ? AND is_active = 1`,
      ).bind(input.data, context.userId, existing.id, context.organizationId),
      auditStatement(runtime.DATABASE, context, "person.file_renamed", "person_file", existing.id, {
        personId: parsedPersonId.data,
        previousName: existing.label,
        name: input.data,
      }),
    ]);
    return Response.json({ ok: true });
  }

  if (request.method === "POST") {
    const parsed = await parsePersonFileForm(request, existing.category);
    if (parsed instanceof Response) return parsed;
    const response = await storePersonFile(runtime, context, parsedPersonId.data, parsed, existing);
    if (response.ok) await runtime.FILES.delete(existing.r2ObjectKey);
    return response;
  }

  if (request.method === "DELETE") {
    const statements = [
      runtime.DATABASE.prepare(
        `UPDATE person_file SET is_active = 0, removed_at = CURRENT_TIMESTAMP,
           updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ? AND is_active = 1`,
      ).bind(context.userId, existing.id, context.organizationId),
      auditStatement(runtime.DATABASE, context, "person.file_removed", "person_file", existing.id, {
        personId: parsedPersonId.data,
        name: existing.label,
        category: existing.category,
      }),
    ];
    if (existing.category === "profile_photo") {
      statements.push(
        runtime.DATABASE.prepare(
          "UPDATE person SET photo_asset_key = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?",
        ).bind(parsedPersonId.data, context.organizationId),
      );
    }
    await runtime.DATABASE.batch(statements);
    await runtime.FILES.delete(existing.r2ObjectKey);
    return Response.json({ ok: true });
  }

  return methodNotAllowed("PATCH, POST, DELETE");
}

async function parsePersonFileForm(
  request: Request,
  fixedCategory?: z.infer<typeof personFileCategorySchema>,
): Promise<
  { category: z.infer<typeof personFileCategorySchema>; name: string; file: File } | Response
> {
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "Upload a file." }, { status: 400 });
  const file = form.get("file");
  const category = fixedCategory ?? personFileCategorySchema.safeParse(form.get("category")).data;
  const name = personFileNameSchema.safeParse(form.get("name"));
  if (!(file instanceof File) || !category || !name.success) {
    return Response.json({ error: "Choose a file, type, and name." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_PERSON_FILE_BYTES) {
    return Response.json({ error: "Files must be between 1 byte and 25 MB." }, { status: 400 });
  }
  const allowed = category === "document" ? DOCUMENT_CONTENT_TYPES : PHOTO_CONTENT_TYPES;
  if (!allowed.has(file.type)) {
    return Response.json(
      {
        error:
          category === "document"
            ? "This file type is not supported."
            : "Use a JPEG, PNG, or WebP photo.",
      },
      { status: 400 },
    );
  }
  return { category, name: name.data, file };
}

async function storePersonFile(
  runtime: ReturnType<typeof getRuntimeEnv>,
  context: MembershipContext,
  personId: string,
  input: { category: z.infer<typeof personFileCategorySchema>; name: string; file: File },
  replaced: { id: string; r2ObjectKey: string } | null,
): Promise<Response> {
  const id = crypto.randomUUID();
  const bytes = await input.file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const objectKey = `organizations/${context.organizationId}/people/${personId}/uploads/${id}`;

  await runtime.FILES.put(objectKey, bytes, {
    httpMetadata: { contentType: input.file.type },
  });

  try {
    const statements = [];
    if (replaced) {
      statements.push(
        runtime.DATABASE.prepare(
          `UPDATE person_file SET is_active = 0, removed_at = CURRENT_TIMESTAMP,
             updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND organization_id = ? AND is_active = 1`,
        ).bind(context.userId, replaced.id, context.organizationId),
      );
    }
    statements.push(
      runtime.DATABASE.prepare(
        `INSERT INTO person_file (
           id, organization_id, person_id, category, label, file_name, content_type,
           byte_size, sha256, r2_object_key, is_primary, source_system, source_table,
           source_id, source_asset_id, created_by_user_id, updated_by_user_id, replaces_file_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'tsewa', 'person_file', ?, ?, ?, ?, ?)`,
      ).bind(
        id,
        context.organizationId,
        personId,
        input.category,
        input.name,
        input.file.name,
        input.file.type,
        input.file.size,
        sha256,
        objectKey,
        input.category === "profile_photo" ? 1 : 0,
        id,
        id,
        context.userId,
        context.userId,
        replaced?.id ?? null,
      ),
    );
    if (input.category === "profile_photo") {
      statements.push(
        runtime.DATABASE.prepare(
          "UPDATE person SET photo_asset_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?",
        ).bind(objectKey, personId, context.organizationId),
      );
    }
    statements.push(
      auditStatement(
        runtime.DATABASE,
        context,
        replaced ? "person.file_replaced" : "person.file_added",
        "person_file",
        id,
        {
          personId,
          category: input.category,
          name: input.name,
          replacedFileId: replaced?.id ?? "",
        },
      ),
    );
    await runtime.DATABASE.batch(statements);
  } catch (error) {
    await runtime.FILES.delete(objectKey);
    throw error;
  }
  return Response.json({ ok: true, id }, { status: replaced ? 200 : 201 });
}

function inlineContentDisposition(fileName: string): string {
  const fallback = fileName.replaceAll(/[\r\n"\\]/g, "_").replaceAll(/[^\x20-\x7e]/g, "_");
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

async function getPlatformStatus(request: Request): Promise<Response> {
  const runtime = getRuntimeEnv();
  const context = await getMembershipContext(request);
  const fallbackOrganization = context
    ? null
    : await runtime.ORM.select({ id: organization.id })
        .from(organization)
        .where(eq(organization.slug, runtime.DEFAULT_ORGANIZATION_SLUG))
        .limit(1)
        .then((rows) => rows[0] ?? null);
  const sessionOrganizationId = context?.organizationId ?? fallbackOrganization?.id;
  const [userCount, sessions, preference, memberships] = await Promise.all([
    runtime.ORM.select({ count: count() })
      .from(user)
      .then((rows) => rows[0] ?? { count: 0 }),
    sessionOrganizationId
      ? runtime.ORM.select({
          id: academicSession.id,
          name: academicSession.name,
          startsOn: academicSession.startsOn,
          endsOn: academicSession.endsOn,
        })
          .from(academicSession)
          .where(
            and(
              eq(academicSession.organizationId, sessionOrganizationId),
              eq(academicSession.isActive, 1),
            ),
          )
          .orderBy(desc(academicSession.startsOn))
      : Promise.resolve([]),
    context
      ? runtime.ORM.select({ activeSessionId: userPreference.activeAcademicSessionId })
          .from(userPreference)
          .where(
            and(
              eq(userPreference.userId, context.userId),
              eq(userPreference.activeOrganizationId, context.organizationId),
            ),
          )
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    context
      ? runtime.ORM.select({
          id: organization.id,
          name: organization.name,
          group: sql<AccessGroupKey>`coalesce(${accessGroup.key}, ${organizationMember.role})`,
        })
          .from(organizationMember)
          .innerJoin(organization, eq(organization.id, organizationMember.organizationId))
          .leftJoin(accessGroup, eq(accessGroup.id, organizationMember.groupId))
          .where(eq(organizationMember.userId, context.userId))
          .orderBy(asc(sql`lower(${organization.name})`))
      : Promise.resolve([]),
  ]);

  const organizationIds = memberships.map((membership) => membership.id);
  const organizationSessions = organizationIds.length
    ? await runtime.ORM.select({
        organizationId: academicSession.organizationId,
        id: academicSession.id,
        startsOn: academicSession.startsOn,
      })
        .from(academicSession)
        .where(
          and(
            inArray(academicSession.organizationId, organizationIds),
            eq(academicSession.isActive, 1),
          ),
        )
        .orderBy(desc(academicSession.startsOn))
    : [];
  const defaultSessionByOrganization = new Map<string, string>();
  for (const session of organizationSessions) {
    if (!defaultSessionByOrganization.has(session.organizationId)) {
      defaultSessionByOrganization.set(session.organizationId, session.id);
    }
  }

  return Response.json({
    needsSetup: Number(userCount?.count ?? 0) === 0,
    sessions,
    activeSessionId: preference?.activeSessionId ?? sessions[0]?.id ?? null,
    activeOrganizationId: context?.organizationId ?? null,
    organizations: memberships.map((membership) => ({
      ...membership,
      defaultSessionId: defaultSessionByOrganization.get(membership.id) ?? null,
    })),
  });
}

async function savePlatformPreference(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return forbidden();

  const runtime = getRuntimeEnv();
  const session = await getSession(request);
  if (!session?.user.id) return unauthorized();

  const body = await readJson(request);
  const parsed = preferenceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid academic session" }, { status: 400 });
  }

  const membership = await runtime.ORM.select({ organizationId: organizationMember.organizationId })
    .from(organizationMember)
    .innerJoin(
      academicSession,
      eq(academicSession.organizationId, organizationMember.organizationId),
    )
    .where(
      and(
        eq(organizationMember.userId, session.user.id),
        eq(academicSession.id, parsed.data.academicSessionId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!membership) return forbidden();

  await runtime.ORM.insert(userPreference)
    .values({
      userId: session.user.id,
      activeOrganizationId: membership.organizationId,
      activeAcademicSessionId: parsed.data.academicSessionId,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .onConflictDoUpdate({
      target: userPreference.userId,
      set: {
        activeOrganizationId: membership.organizationId,
        activeAcademicSessionId: parsed.data.academicSessionId,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      },
    });

  return Response.json({ ok: true });
}

async function handleOrganizationRequest(request: Request): Promise<Response> {
  if (request.method === "GET") return getOrganization(request);
  if (request.method === "PATCH") return updateOrganization(request);
  return methodNotAllowed("GET, PATCH");
}

async function getOrganization(request: Request): Promise<Response> {
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "organization.settings.read")) return forbidden();

  const runtime = getRuntimeEnv();
  const [organizationState, members, invitations, groups, roles, rolePermissions, groupRoles] =
    await Promise.all([
      runtime.ORM.select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        timezone: organization.timezone,
        locale: organization.locale,
      })
        .from(organization)
        .where(eq(organization.id, context.organizationId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      runtime.ORM.select({
        id: organizationMember.id,
        group: sql<AccessGroupKey>`coalesce(${accessGroup.key}, ${organizationMember.role})`,
        joinedAt: organizationMember.createdAt,
        userId: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
      })
        .from(organizationMember)
        .innerJoin(user, eq(user.id, organizationMember.userId))
        .leftJoin(accessGroup, eq(accessGroup.id, organizationMember.groupId))
        .where(eq(organizationMember.organizationId, context.organizationId))
        .orderBy(
          asc(sql`CASE coalesce(${accessGroup.key}, ${organizationMember.role})
            WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'staff' THEN 2 ELSE 3 END`),
          asc(sql`lower(${user.name})`),
        ),
      runtime.ORM.select({
        id: organizationInvitation.id,
        email: organizationInvitation.email,
        group: sql<
          Exclude<AccessGroupKey, "owner">
        >`coalesce(${accessGroup.key}, ${organizationInvitation.role})`,
        expiresAt: organizationInvitation.expiresAt,
        createdAt: organizationInvitation.createdAt,
        emailStatus: organizationInvitation.emailStatus,
        emailSentAt: organizationInvitation.emailSentAt,
        emailLastAttemptAt: organizationInvitation.emailLastAttemptAt,
        emailAttemptCount: organizationInvitation.emailAttemptCount,
      })
        .from(organizationInvitation)
        .leftJoin(accessGroup, eq(accessGroup.id, organizationInvitation.groupId))
        .where(
          and(
            eq(organizationInvitation.organizationId, context.organizationId),
            isNull(organizationInvitation.acceptedAt),
            isNull(organizationInvitation.revokedAt),
            gt(organizationInvitation.expiresAt, new Date().toISOString()),
          ),
        )
        .orderBy(desc(organizationInvitation.createdAt)),
      runtime.ORM.select({
        id: accessGroup.id,
        key: accessGroup.key,
        name: accessGroup.name,
        description: accessGroup.description,
      })
        .from(accessGroup)
        .where(eq(accessGroup.organizationId, context.organizationId))
        .orderBy(
          asc(sql`CASE ${accessGroup.key}
            WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'staff' THEN 2 ELSE 3 END`),
        ),
      runtime.ORM.select({
        id: accessRole.id,
        key: accessRole.key,
        name: accessRole.name,
        description: accessRole.description,
      })
        .from(accessRole)
        .where(eq(accessRole.organizationId, context.organizationId))
        .orderBy(asc(sql`lower(${accessRole.name})`)),
      runtime.ORM.select({
        roleKey: accessRole.key,
        permissionKey: accessRolePermission.permissionKey,
      })
        .from(accessRolePermission)
        .innerJoin(accessRole, eq(accessRole.id, accessRolePermission.roleId))
        .where(eq(accessRole.organizationId, context.organizationId)),
      runtime.ORM.select({ groupKey: accessGroup.key, roleKey: accessRole.key })
        .from(accessGroupRole)
        .innerJoin(accessGroup, eq(accessGroup.id, accessGroupRole.groupId))
        .innerJoin(accessRole, eq(accessRole.id, accessGroupRole.roleId))
        .where(eq(accessGroup.organizationId, context.organizationId)),
    ]);

  if (!organizationState)
    return Response.json({ error: "Organization not found" }, { status: 404 });

  return Response.json({
    organization: organizationState,
    currentMember: {
      id: context.memberId,
      group: context.group,
      permissions: context.permissions,
    },
    members: members.map((member) => ({
      ...member,
      emailVerified: Boolean(member.emailVerified),
    })),
    invitations,
    accessModel: {
      permissions: permissionCatalog.map(([key, name, category]) => ({ key, name, category })),
      roles: roles.map((role) => ({
        ...role,
        permissionKeys: rolePermissions
          .filter((mapping) => mapping.roleKey === role.key)
          .map((mapping) => mapping.permissionKey),
      })),
      groups: groups.map((group) => ({
        ...group,
        roleKeys: groupRoles
          .filter((mapping) => mapping.groupKey === group.key)
          .map((mapping) => mapping.roleKey),
      })),
    },
  });
}

async function updateOrganization(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "organization.settings.manage")) return forbidden();

  const parsed = organizationSettingsSchema.safeParse(await readJson(request));
  if (!parsed.success || !isValidTimezone(parsed.data?.timezone)) {
    return Response.json(
      { error: "Check the organization settings and try again." },
      { status: 400 },
    );
  }

  const runtime = getRuntimeEnv();
  await runtime.ORM.batch([
    runtime.ORM.update(organization)
      .set({
        name: parsed.data.name,
        timezone: parsed.data.timezone,
        locale: parsed.data.locale,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(organization.id, context.organizationId)),
    auditInsert(
      runtime.ORM,
      context,
      "organization.updated",
      "organization",
      context.organizationId,
      {
        name: parsed.data.name,
        timezone: parsed.data.timezone,
        locale: parsed.data.locale,
      },
    ),
  ]);

  return Response.json({ ok: true });
}

async function createOrganizationInvitation(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "organization.members.manage")) return forbidden();

  const parsed = invitationSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json(
      { error: "Enter a valid email address and access group." },
      { status: 400 },
    );
  }

  const runtime = getRuntimeEnv();
  const existingMember = await runtime.ORM.select({ id: organizationMember.id })
    .from(organizationMember)
    .innerJoin(user, eq(user.id, organizationMember.userId))
    .where(
      and(
        eq(organizationMember.organizationId, context.organizationId),
        eq(sql`lower(${user.email})`, parsed.data.email),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (existingMember) {
    return Response.json({ error: "That person is already a member." }, { status: 409 });
  }

  const recentInvitationCutoff = new Date(Date.now() - 60 * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
  const recentInvitations = await runtime.ORM.select({ count: count() })
    .from(organizationInvitation)
    .where(
      and(
        eq(organizationInvitation.organizationId, context.organizationId),
        eq(organizationInvitation.invitedByUserId, context.userId),
        gt(organizationInvitation.createdAt, recentInvitationCutoff),
      ),
    )
    .then((rows) => rows[0] ?? { count: 0 });
  if (Number(recentInvitations?.count ?? 0) >= 20) {
    return Response.json(
      { error: "Invitation limit reached. Try again in an hour." },
      { status: 429 },
    );
  }

  const token = createInvitationToken();
  const tokenHash = await hashInvitationToken(token);
  const invitationId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await runtime.ORM.batch([
    runtime.ORM.update(organizationInvitation)
      .set({ revokedAt: sql`CURRENT_TIMESTAMP` })
      .where(
        and(
          eq(organizationInvitation.organizationId, context.organizationId),
          eq(organizationInvitation.email, parsed.data.email),
          isNull(organizationInvitation.acceptedAt),
          isNull(organizationInvitation.revokedAt),
        ),
      ),
    runtime.ORM.insert(organizationInvitation).values({
      id: invitationId,
      organizationId: context.organizationId,
      email: parsed.data.email,
      role: parsed.data.group,
      groupId: accessGroupId(context.organizationId, parsed.data.group),
      tokenHash,
      invitedByUserId: context.userId,
      expiresAt,
    }),
    auditInsert(
      runtime.ORM,
      context,
      "invitation.created",
      "organization_invitation",
      invitationId,
      { email: parsed.data.email, group: parsed.data.group },
    ),
  ]);

  const invitationUrl = new URL(request.url);
  invitationUrl.pathname = "/";
  invitationUrl.search = new URLSearchParams({ invite: token }).toString();

  const delivery = await deliverOrganizationInvitation(
    runtime,
    context,
    invitationId,
    parsed.data.email,
    parsed.data.group,
    invitationUrl.toString(),
    expiresAt,
  );

  return Response.json(
    { invitationUrl: invitationUrl.toString(), expiresAt, delivery },
    { status: 201 },
  );
}

async function previewInvitation(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return Response.json({ error: "Invitation not found" }, { status: 404 });

  const invitation = await findInvitation(getRuntimeEnv().ORM, token);
  if (!invitation)
    return Response.json({ error: "This invitation is invalid or expired." }, { status: 404 });

  return Response.json({
    organizationName: invitation.organizationName,
    email: invitation.email,
    group: invitation.group,
    roleNames: invitation.roleNames,
    expiresAt: invitation.expiresAt,
  });
}

async function acceptInvitationForCurrentUser(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return forbidden();
  const session = await getSession(request);
  if (!session?.user.id || !session.user.email) return unauthorized();

  const parsed = invitationTokenSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "Invalid invitation" }, { status: 400 });

  const runtime = getRuntimeEnv();
  const invitation = await findInvitation(runtime.ORM, parsed.data.token, session.user.email);
  if (!invitation) {
    return Response.json({ error: "This invitation is invalid or expired." }, { status: 404 });
  }

  await acceptInvitation(runtime.ORM, invitation, session.user.id);
  return Response.json({ ok: true });
}

async function updateOrganizationMember(request: Request, memberId: string): Promise<Response> {
  if (request.method !== "PATCH") return methodNotAllowed("PATCH");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "organization.members.manage")) return forbidden();
  if (context.memberId === memberId) {
    return Response.json(
      { error: "Use ownership transfer to change your own access group." },
      { status: 400 },
    );
  }

  const parsed = memberRoleSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "Invalid access group" }, { status: 400 });

  const runtime = getRuntimeEnv();
  const target = await runtime.ORM.select({
    id: organizationMember.id,
    group: sql<AccessGroupKey>`coalesce(${accessGroup.key}, ${organizationMember.role})`,
  })
    .from(organizationMember)
    .leftJoin(accessGroup, eq(accessGroup.id, organizationMember.groupId))
    .where(
      and(
        eq(organizationMember.id, memberId),
        eq(organizationMember.organizationId, context.organizationId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!target) return Response.json({ error: "Member not found" }, { status: 404 });
  if (target.group === "owner") {
    return Response.json(
      { error: "Transfer ownership before changing the owner group." },
      { status: 400 },
    );
  }

  await runtime.ORM.batch([
    runtime.ORM.update(organizationMember)
      .set({
        role: parsed.data.group,
        groupId: accessGroupId(context.organizationId, parsed.data.group),
      })
      .where(eq(organizationMember.id, target.id)),
    auditInsert(runtime.ORM, context, "member.group_changed", "organization_member", target.id, {
      from: target.group,
      to: parsed.data.group,
    }),
  ]);

  return Response.json({ ok: true });
}

async function transferOrganizationOwnership(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (context.group !== "owner") return forbidden();

  const parsed = transferOwnershipSchema.safeParse(await readJson(request));
  if (!parsed.success || parsed.data.targetMemberId === context.memberId) {
    return Response.json({ error: "Choose another organization member." }, { status: 400 });
  }

  const runtime = getRuntimeEnv();
  const target = await runtime.ORM.select({
    id: organizationMember.id,
    userId: organizationMember.userId,
    group: sql<AccessGroupKey>`coalesce(${accessGroup.key}, ${organizationMember.role})`,
  })
    .from(organizationMember)
    .leftJoin(accessGroup, eq(accessGroup.id, organizationMember.groupId))
    .where(
      and(
        eq(organizationMember.id, parsed.data.targetMemberId),
        eq(organizationMember.organizationId, context.organizationId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!target) return Response.json({ error: "Member not found" }, { status: 404 });

  await runtime.ORM.batch([
    runtime.ORM.update(organizationMember)
      .set({ role: "owner", groupId: accessGroupId(context.organizationId, "owner") })
      .where(
        and(
          eq(organizationMember.id, target.id),
          eq(organizationMember.organizationId, context.organizationId),
        ),
      ),
    runtime.ORM.update(organizationMember)
      .set({ role: "admin", groupId: accessGroupId(context.organizationId, "admin") })
      .where(
        and(
          eq(organizationMember.id, context.memberId),
          eq(organizationMember.organizationId, context.organizationId),
          eq(organizationMember.role, "owner"),
        ),
      ),
    auditInsert(runtime.ORM, context, "ownership.transferred", "organization_member", target.id, {
      previousOwnerMemberId: context.memberId,
      newOwnerUserId: target.userId,
    }),
  ]);

  return Response.json({ ok: true });
}

async function updateAccessGroup(request: Request, groupKey: string): Promise<Response> {
  if (request.method !== "PATCH") return methodNotAllowed("PATCH");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "organization.roles.manage")) return forbidden();
  if (!(["admin", "staff", "viewer"] as const).includes(groupKey as never)) {
    return Response.json({ error: "That access group cannot be changed." }, { status: 400 });
  }

  const parsed = groupRolesSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Choose valid functional roles." }, { status: 400 });
  }

  const roleKeys = [...new Set(parsed.data.roleKeys)];
  const group = groupKey as Exclude<AccessGroupKey, "owner">;
  const runtime = getRuntimeEnv();
  const groupId = accessGroupId(context.organizationId, group);
  await runtime.ORM.delete(accessGroupRole).where(eq(accessGroupRole.groupId, groupId));
  for (const roleKey of roleKeys) {
    await runtime.ORM.insert(accessGroupRole).values({
      groupId,
      roleId: accessRoleId(context.organizationId, roleKey),
    });
  }
  await runtime.ORM.batch([
    runtime.ORM.update(accessGroup)
      .set({ updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(
        and(eq(accessGroup.id, groupId), eq(accessGroup.organizationId, context.organizationId)),
      ),
    auditInsert(runtime.ORM, context, "access_group.roles_changed", "access_group", groupId, {
      group,
      roleKeys: roleKeys.join(","),
    }),
  ]);
  return Response.json({ ok: true, group, roleKeys });
}

async function resendOrganizationInvitation(
  request: Request,
  invitationId: string,
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "organization.members.manage")) return forbidden();

  const runtime = getRuntimeEnv();
  const invitation = await runtime.ORM.select({
    id: organizationInvitation.id,
    email: organizationInvitation.email,
    group: sql<
      Exclude<AccessGroupKey, "owner">
    >`coalesce(${accessGroup.key}, ${organizationInvitation.role})`,
    emailLastAttemptAt: organizationInvitation.emailLastAttemptAt,
  })
    .from(organizationInvitation)
    .leftJoin(accessGroup, eq(accessGroup.id, organizationInvitation.groupId))
    .where(
      and(
        eq(organizationInvitation.id, invitationId),
        eq(organizationInvitation.organizationId, context.organizationId),
        isNull(organizationInvitation.acceptedAt),
        isNull(organizationInvitation.revokedAt),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!invitation) return Response.json({ error: "Invitation not found" }, { status: 404 });
  if (
    invitation.emailLastAttemptAt &&
    Date.now() - new Date(invitation.emailLastAttemptAt).getTime() < 60_000
  ) {
    return Response.json(
      { error: "Please wait one minute before resending this invitation." },
      { status: 429 },
    );
  }

  const token = createInvitationToken();
  const tokenHash = await hashInvitationToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await runtime.ORM.update(organizationInvitation)
    .set({
      tokenHash,
      expiresAt,
      emailStatus: "not_sent",
      emailMessageId: null,
      emailSentAt: null,
    })
    .where(eq(organizationInvitation.id, invitation.id));

  const invitationUrl = new URL(request.url);
  invitationUrl.pathname = "/";
  invitationUrl.search = new URLSearchParams({ invite: token }).toString();
  const delivery = await deliverOrganizationInvitation(
    runtime,
    context,
    invitation.id,
    invitation.email,
    invitation.group,
    invitationUrl.toString(),
    expiresAt,
  );
  await auditInsert(
    runtime.ORM,
    context,
    "invitation.resent",
    "organization_invitation",
    invitation.id,
    { email: invitation.email, group: invitation.group, delivery: delivery.status },
  );

  return Response.json({ invitationUrl: invitationUrl.toString(), expiresAt, delivery });
}

async function deliverOrganizationInvitation(
  runtime: ReturnType<typeof getRuntimeEnv>,
  context: MembershipContext,
  invitationId: string,
  recipient: string,
  group: Exclude<AccessGroupKey, "owner">,
  invitationUrl: string,
  expiresAt: string,
): Promise<{ status: "sent" | "failed"; messageId?: string }> {
  const [organizationState, inviter, roles] = await Promise.all([
    runtime.ORM.select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, context.organizationId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    runtime.ORM.select({ name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, context.userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    runtime.ORM.select({ name: accessRole.name })
      .from(accessGroupRole)
      .innerJoin(accessGroup, eq(accessGroup.id, accessGroupRole.groupId))
      .innerJoin(accessRole, eq(accessRole.id, accessGroupRole.roleId))
      .where(
        and(eq(accessGroup.organizationId, context.organizationId), eq(accessGroup.key, group)),
      )
      .orderBy(asc(sql`lower(${accessRole.name})`)),
  ]);
  if (!organizationState || !inviter) throw new Error("Invitation sender context is missing.");

  try {
    const messageId = await sendInvitationEmail(runtime, {
      organizationName: organizationState.name,
      expiresAt,
      invitationUrl,
      inviterEmail: inviter.email,
      inviterName: inviter.name,
      recipient,
      group,
      roleNames: roles.map((role) => role.name),
    });
    await runtime.ORM.update(organizationInvitation)
      .set({
        emailStatus: "sent",
        emailMessageId: messageId,
        emailSentAt: sql`CURRENT_TIMESTAMP`,
        emailLastAttemptAt: sql`CURRENT_TIMESTAMP`,
        emailAttemptCount: sql`${organizationInvitation.emailAttemptCount} + 1`,
      })
      .where(eq(organizationInvitation.id, invitationId));
    return { status: "sent", messageId };
  } catch (error) {
    console.error("Invitation email delivery failed", { invitationId, error });
    await runtime.ORM.update(organizationInvitation)
      .set({
        emailStatus: "failed",
        emailLastAttemptAt: sql`CURRENT_TIMESTAMP`,
        emailAttemptCount: sql`${organizationInvitation.emailAttemptCount} + 1`,
      })
      .where(eq(organizationInvitation.id, invitationId));
    return { status: "failed" };
  }
}

async function revokeOrganizationInvitation(
  request: Request,
  invitationId: string,
): Promise<Response> {
  if (request.method !== "DELETE") return methodNotAllowed("DELETE");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "organization.members.manage")) return forbidden();

  const runtime = getRuntimeEnv();
  const invitation = await runtime.ORM.select({ id: organizationInvitation.id })
    .from(organizationInvitation)
    .where(
      and(
        eq(organizationInvitation.id, invitationId),
        eq(organizationInvitation.organizationId, context.organizationId),
        isNull(organizationInvitation.acceptedAt),
        isNull(organizationInvitation.revokedAt),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!invitation) return Response.json({ error: "Invitation not found" }, { status: 404 });

  await runtime.ORM.batch([
    runtime.ORM.update(organizationInvitation)
      .set({ revokedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(organizationInvitation.id, invitation.id)),
    auditInsert(
      runtime.ORM,
      context,
      "invitation.revoked",
      "organization_invitation",
      invitation.id,
    ),
  ]);

  return Response.json({ ok: true });
}

async function getSession(request: Request) {
  return createRequestAuth(request, false).api.getSession({ headers: request.headers });
}

async function getMembershipContext(request: Request): Promise<MembershipContext | null> {
  const session = await getSession(request);
  if (!session?.user.id) return null;

  const runtime = getRuntimeEnv();
  const membership = await runtime.ORM.select({
    memberId: organizationMember.id,
    organizationId: organizationMember.organizationId,
    group: sql<AccessGroupKey>`coalesce(${accessGroup.key}, ${organizationMember.role})`,
  })
    .from(organizationMember)
    .leftJoin(accessGroup, eq(accessGroup.id, organizationMember.groupId))
    .leftJoin(userPreference, eq(userPreference.userId, organizationMember.userId))
    .where(eq(organizationMember.userId, session.user.id))
    .orderBy(
      asc(
        sql`CASE WHEN ${userPreference.activeOrganizationId} = ${organizationMember.organizationId}
          THEN 0 ELSE 1 END`,
      ),
      asc(organizationMember.createdAt),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!membership) return null;
  const permissions =
    membership.group === "owner"
      ? permissionCatalog.map(([key]) => key)
      : await runtime.ORM.selectDistinct({ permissionKey: accessRolePermission.permissionKey })
          .from(organizationMember)
          .innerJoin(accessGroupRole, eq(accessGroupRole.groupId, organizationMember.groupId))
          .innerJoin(accessRolePermission, eq(accessRolePermission.roleId, accessGroupRole.roleId))
          .where(
            and(
              eq(organizationMember.id, membership.memberId),
              eq(organizationMember.organizationId, membership.organizationId),
            ),
          )
          .then((rows) => rows.map((row) => row.permissionKey as PermissionKey));

  return {
    ...membership,
    permissions,
    userId: session.user.id,
  };
}

async function findInvitation(
  database: Database,
  token: string,
  expectedEmail?: string,
): Promise<Invitation | null> {
  if (token.length < 32 || token.length > 256) return null;
  const tokenHash = await hashInvitationToken(token);
  const invitation = await database
    .select({
      id: organizationInvitation.id,
      organizationId: organizationInvitation.organizationId,
      organizationName: organization.name,
      email: organizationInvitation.email,
      group: sql<
        Exclude<AccessGroupKey, "owner">
      >`coalesce(${accessGroup.key}, ${organizationInvitation.role})`,
      expiresAt: organizationInvitation.expiresAt,
      groupId: organizationInvitation.groupId,
    })
    .from(organizationInvitation)
    .innerJoin(organization, eq(organization.id, organizationInvitation.organizationId))
    .leftJoin(accessGroup, eq(accessGroup.id, organizationInvitation.groupId))
    .where(
      and(
        eq(organizationInvitation.tokenHash, tokenHash),
        isNull(organizationInvitation.acceptedAt),
        isNull(organizationInvitation.revokedAt),
        gt(organizationInvitation.expiresAt, new Date().toISOString()),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!invitation) return null;
  if (expectedEmail && invitation.email !== expectedEmail.trim().toLowerCase()) return null;
  const roles = invitation.groupId
    ? await database
        .select({ name: accessRole.name })
        .from(accessGroupRole)
        .innerJoin(accessRole, eq(accessRole.id, accessGroupRole.roleId))
        .where(eq(accessGroupRole.groupId, invitation.groupId))
        .orderBy(asc(sql`lower(${accessRole.name})`))
    : [];
  return {
    id: invitation.id,
    organizationId: invitation.organizationId,
    organizationName: invitation.organizationName,
    email: invitation.email,
    group: invitation.group,
    expiresAt: invitation.expiresAt,
    roleNames: roles.map((role) => role.name),
  };
}

async function acceptInvitation(
  database: Database,
  invitation: Invitation,
  userId: string,
): Promise<void> {
  const memberId = crypto.randomUUID();
  const auditId = crypto.randomUUID();

  await database.batch([
    database
      .insert(organizationMember)
      .values({
        id: memberId,
        organizationId: invitation.organizationId,
        userId,
        role: invitation.group,
        groupId: accessGroupId(invitation.organizationId, invitation.group),
      })
      .onConflictDoNothing(),
    database
      .update(organizationInvitation)
      .set({ acceptedAt: sql`CURRENT_TIMESTAMP`, acceptedByUserId: userId })
      .where(
        and(
          eq(organizationInvitation.id, invitation.id),
          isNull(organizationInvitation.acceptedAt),
          isNull(organizationInvitation.revokedAt),
          gt(organizationInvitation.expiresAt, new Date().toISOString()),
        ),
      ),
    database.insert(auditEvent).values({
      id: auditId,
      organizationId: invitation.organizationId,
      actorUserId: userId,
      action: "invitation.accepted",
      entityType: "organization_invitation",
      entityId: invitation.id,
      metadataJson: JSON.stringify({ email: invitation.email, group: invitation.group }),
    }),
  ]);
}

function auditInsert(
  database: Database,
  context: MembershipContext,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, string>,
) {
  return database.insert(auditEvent).values({
    id: crypto.randomUUID(),
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action,
    entityType,
    entityId,
    metadataJson: metadata ? JSON.stringify(metadata) : null,
  });
}

function auditStatement(
  database: QueryDatabase,
  context: MembershipContext,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, string>,
): DrizzleStatement {
  return database
    .prepare(
      `INSERT INTO audit_event
        (id, organization_id, actor_user_id, action, entity_type, entity_id, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      context.organizationId,
      context.userId,
      action,
      entityType,
      entityId,
      metadata ? JSON.stringify(metadata) : null,
    );
}

function createInvitationToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function hashInvitationToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isValidTimezone(timezone: string | undefined): boolean {
  if (!timezone) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

function escapeLikePattern(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function hasPermission(context: MembershipContext, permission: PermissionKey): boolean {
  return context.group === "owner" || context.permissions.includes(permission);
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden(): Response {
  return Response.json({ error: "Forbidden" }, { status: 403 });
}

function methodNotAllowed(allow: string): Response {
  return new Response(null, { status: 405, headers: { Allow: allow } });
}
